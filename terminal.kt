package io.github.jackwener.dsh.feature.settings

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextRange
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import io.github.jackwener.dsh.R
import io.github.jackwener.dsh.core.designsystem.IconBtn
import java.io.File
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

private const val MARK = "__DSHEND__"
private const val MAX_OUT = 200_000

private val TBg = Color(0xFF0B0C10)
private val TPanel = Color(0xFF101218)
private val TBorder = Color(0xFF23262E)
private val TFg = Color(0xFFDDE1E6)
private val TDim = Color(0xFF6C7280)
private val TAccent = Color(0xFF3B82F6)
private val TKey = Color(0xFF1A1D24)

private val Mono = TextStyle(fontFamily = FontFamily.Monospace, fontSize = 12.sp, lineHeight = 17.sp, color = TFg)

/** 常驻 sh 进程：写入命令 + 结束标记，读线程按标记切分输出。 */
private class ShSession {
    private var proc: Process? = null
    private var out = StringBuilder()

    fun start(ctx: Context) {
        kill()
        out = StringBuilder()
        val home = File(ctx.filesDir, "home")
        if (!home.exists()) home.mkdirs()
        val pb = ProcessBuilder("/system/bin/sh")
        pb.directory(home)
        val env = pb.environment()
        env["HOME"] = home.absolutePath
        env["TMPDIR"] = ctx.cacheDir.absolutePath
        env["PATH"] = ctx.filesDir.absolutePath + "/bin:/system/bin:/system/xbin"
        env["TERM"] = "dumb"
        pb.redirectErrorStream(true)
        proc = pb.start()
    }

    fun kill() {
        try { proc?.destroy() } catch (_: Throwable) {}
        proc = null
    }

    fun alive(): Boolean = proc != null

    fun clear() { out = StringBuilder() }

    fun append(s: String) {
        out.append(s)
        if (out.length > MAX_OUT) out = StringBuilder(out.substring(out.length - MAX_OUT))
    }

    fun text(): String = out.toString()

    fun submit(cmd: String) {
        val p = proc ?: return
        Thread {
            try {
                val w = p.outputStream
                w.write((cmd + "\necho " + MARK + "\$?\n").toByteArray())
                w.flush()
            } catch (_: Throwable) {}
        }.start()
    }

    /** 读一段输出；读到结束标记返回 true。 */
    suspend fun pump(): Boolean = withContext(Dispatchers.IO) {
        val p = proc ?: return@withContext false
        try {
            val n = p.inputStream.available()
            if (n <= 0) return@withContext false
            val buf = ByteArray(minOf(n, 4096))
            val read = p.inputStream.read(buf)
            if (read <= 0) return@withContext false
            val text = String(buf, 0, read)
            val idx = text.lastIndexOf(MARK)
            if (idx >= 0) {
                append(text.substring(0, idx))
                true
            } else {
                append(text)
                false
            }
        } catch (_: Throwable) {
            false
        }
    }
}

private fun copyText(ctx: Context, text: String) {
    val cm = ctx.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
    cm.setPrimaryClip(ClipData.newPlainText("terminal", text))
}

@Composable
fun TerminalOverlay(onClose: () -> Unit) {
    val ctx = LocalContext.current
    val session = remember { ShSession() }
    var tick by remember { mutableIntStateOf(0) }
    var tf by remember { mutableStateOf(TextFieldValue("")) }
    var busy by remember { mutableStateOf(false) }
    var selOpen by remember { mutableStateOf(false) }
    var ctrlOn by remember { mutableStateOf(false) }
    var shiftOn by remember { mutableStateOf(false) }
    var altOn by remember { mutableStateOf(false) }
    val history = remember { mutableStateListOf<String>() }
    var hIdx by remember { mutableIntStateOf(-1) }
    val scroll = rememberScrollState()
    val focus = remember { FocusRequester() }
    val scope = rememberCoroutineScope()

    fun refresh() { tick++ }

    fun insert(s: String) {
        val t = tf.text
        val start = tf.selection.start
        val end = tf.selection.end
        val next = t.substring(0, start) + s + t.substring(end)
        val pos = start + s.length
        tf = TextFieldValue(next, TextRange(pos))
    }

    fun submit() {
        val cmd = tf.text.trim()
        if (cmd.isEmpty() || busy) return
        history.add(cmd)
        hIdx = -1
        if (!session.alive()) session.start(ctx)
        session.append("\$ " + cmd + "\n")
        tf = TextFieldValue("")
        busy = true
        session.submit(cmd)
    }

    fun resetMods() { ctrlOn = false; shiftOn = false; altOn = false }

    fun hardStop() {
        session.kill()
        session.start(ctx)
        busy = false
        tf = TextFieldValue("")
        resetMods()
        refresh()
    }

    /** 带修饰键的输入：Ctrl+C 停掉当前命令，Ctrl+字母 显示成 ^X，Shift 转大写。 */
    fun typed(nv: TextFieldValue) {
        val old = tf.text
        val nt = nv.text
        val inserted = if (nt.length == old.length + 1) {
            val i = nv.selection.start - 1
            if (i in nt.indices) nt[i] else null
        } else null
        if (inserted == null) { tf = nv; resetMods(); return }
        when {
            ctrlOn && inserted.lowercaseChar() == 'c' -> hardStop()
            ctrlOn && inserted.isLetter() -> { insert("^" + inserted.uppercaseChar()); resetMods() }
            shiftOn -> { insert(inserted.uppercaseChar().toString()); resetMods() }
            altOn -> { insert(inserted.toString()); resetMods() }
            else -> tf = nv
        }
    }

    DisposableEffect(Unit) {
        session.start(ctx)
        onDispose { session.kill() }
    }

    LaunchedEffect(Unit) {
        delay(250)
        focus.requestFocus()
    }

    LaunchedEffect(session) {
        while (true) {
            val done = session.pump()
            refresh()
            if (done) busy = false
            delay(40)
        }
    }

    LaunchedEffect(tick) {
        scroll.animateScrollTo(scroll.maxValue)
    }

    val body = session.text()

    Dialog(onDismissRequest = onClose, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Column(Modifier.fillMaxSize().background(TBg).statusBarsPadding().imePadding()) {
            Row(
                Modifier.fillMaxWidth().padding(start = 8.dp, end = 8.dp, top = 6.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconBtn(R.drawable.ic_close, onClose, size = 40.dp, iconSize = 17.dp, tint = TFg, contentDescription = "关闭")
                Text("bash 1", style = Mono.copy(fontSize = 11.sp), modifier = Modifier.padding(start = 6.dp))
                Spacer(Modifier.width(6.dp))
                Box(Modifier.size(6.dp).background(if (session.alive()) TAccent else TDim, RoundedCornerShape(3.dp)))
                Spacer(Modifier.weight(1f))
                IconBtn(R.drawable.ic_copy, { selOpen = true }, size = 40.dp, iconSize = 17.dp, tint = TFg, contentDescription = "选择并复制")
                IconBtn(R.drawable.ic_plus, {
                    session.start(ctx)
                    refresh()
                }, size = 40.dp, iconSize = 17.dp, tint = TFg, contentDescription = "重开会话")
            }

            Column(
                Modifier.weight(1f).fillMaxWidth()
                    .padding(horizontal = 8.dp, vertical = 6.dp)
                    .background(TPanel, RoundedCornerShape(10.dp))
                    .padding(12.dp)
                    .verticalScroll(scroll)
            ) {
                Text("sh · " + File(ctx.filesDir, "home").absolutePath, style = Mono.copy(color = TDim, fontSize = 10.sp))
                Spacer(Modifier.height(6.dp))
                Text(body, style = Mono)
                Row {
                    Text("\$ ", style = Mono.copy(color = TAccent))
                    BasicTextField(
                        value = tf,
                        onValueChange = { typed(it) },
                        textStyle = Mono,
                        cursorBrush = SolidColor(TAccent),
                        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
                        keyboardActions = KeyboardActions(onDone = { submit() }),
                        modifier = Modifier.weight(1f).focusRequester(focus)
                    )
                }
                if (busy) Text("…", style = Mono.copy(color = TDim))
            }

            Row(
                Modifier.fillMaxWidth().padding(start = 8.dp, end = 8.dp, bottom = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                TermKey("Esc", 1f) { tf = TextFieldValue(""); resetMods() }
                TermKey("Tab", 1f) { insert("  ") }
                TermKey("Ctrl", 1f, active = ctrlOn) { ctrlOn = !ctrlOn; shiftOn = false; altOn = false }
                TermKey("-", 1f) { insert("-") }
                TermKey("←", 1f) {
                    val p = (tf.selection.start - 1).coerceAtLeast(0)
                    tf = tf.copy(selection = TextRange(p))
                }
                TermKey("↑", 1f) {
                    if (history.isNotEmpty()) {
                        if (hIdx < 0) hIdx = history.size - 1 else if (hIdx > 0) hIdx--
                        tf = TextFieldValue(history[hIdx])
                    }
                }
                TermKey("↓", 1f) {
                    if (history.isNotEmpty()) {
                        if (hIdx < history.size - 1) { hIdx++; tf = TextFieldValue(history[hIdx]) } else { hIdx = -1; tf = TextFieldValue("") }
                    }
                }
                TermKey("→", 1f) {
                    val p = (tf.selection.start + 1).coerceAtMost(tf.text.length)
                    tf = tf.copy(selection = TextRange(p))
                }
                TermKey("/", 1f) { insert("/") }
                TermKey("Shift", 1f, active = shiftOn) { shiftOn = !shiftOn; ctrlOn = false; altOn = false }
                TermKey("Alt", 1f, active = altOn) { altOn = !altOn; ctrlOn = false; shiftOn = false }
                TermKey("Del", 1f) {
                    val t = tf.text
                    val p = tf.selection.start
                    if (p < t.length) {
                        val next = t.substring(0, p) + t.substring(p + 1)
                        tf = TextFieldValue(next, TextRange(p))
                    }
                }
            }
        }
    }

    if (selOpen) {
        Dialog(onDismissRequest = { selOpen = false }, properties = DialogProperties(usePlatformDefaultWidth = false)) {
            Column(Modifier.fillMaxSize().background(TBg).statusBarsPadding()) {
                Row(Modifier.fillMaxWidth().padding(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text("长按选择文字", style = Mono.copy(color = TDim, fontSize = 11.sp))
                    Spacer(Modifier.weight(1f))
                    Text(
                        "复制",
                        style = Mono.copy(color = TAccent),
                        modifier = Modifier.clickable { copyText(ctx, body) }.padding(10.dp)
                    )
                    Text(
                        "关闭",
                        style = Mono.copy(color = TFg),
                        modifier = Modifier.clickable { selOpen = false }.padding(10.dp)
                    )
                }
                Spacer(Modifier.height(1.dp).fillMaxWidth().background(TBorder))
                SelectionContainer {
                    Text(
                        if (body.isEmpty()) "(无输出)" else body,
                        style = Mono,
                        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(12.dp)
                    )
                }
            }
        }
    }
}

@Composable
private fun androidx.compose.foundation.layout.RowScope.TermKey(label: String, w: Float, active: Boolean = false, onClick: () -> Unit) {
    Box(
        Modifier
            .weight(w)
            .background(if (active) TAccent else TKey, RoundedCornerShape(7.dp))
            .clickable { onClick() }
            .padding(vertical = 8.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(label, style = Mono.copy(fontSize = 10.sp, color = TFg), maxLines = 1)
    }
}
