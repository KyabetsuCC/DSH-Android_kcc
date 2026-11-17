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
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import io.github.jackwener.dsh.R
import io.github.jackwener.dsh.core.designsystem.IconBtn
import java.io.File
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import kotlinx.coroutines.Dispatchers

private const val MARK = "__DSHEND__"
private const val MAX_OUT = 200_000

private val TBg = Color(0xFF0B0C10)
private val TPanel = Color(0xFF101218)
private val TBorder = Color(0xFF23262E)
private val TFg = Color(0xFFDDE1E6)
private val TDim = Color(0xFF6C7280)
private val TAccent = Color(0xFF3B82F6)

private val Mono = TextStyle(fontFamily = FontFamily.Monospace, fontSize = 12.sp, lineHeight = 17.sp, color = TFg)

/** 常驻 sh 进程：写入命令 + 结束标记，读线程按标记切分。 */
private class ShSession(ctx: Context) {
    private var proc: Process? = null
    private var out = StringBuilder()
    private var mark = 0

    fun start(ctx: Context) {
        kill()
        out = StringBuilder()
        mark = 0
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

    fun script(): StringBuilder = out

    fun submit(cmd: String) {
        val p = proc ?: return
        Thread {
            try {
                val w = p.outputStream
                w.write((cmd + "\necho " + MARK + "\\$?\n").toByteArray())
                w.flush()
            } catch (_: Throwable) {}
        }.start()
    }

    /** 反复读进程输出，直到拿到结束标记；返回是否读到。 */
    suspend fun pump(): Boolean = withContext(Dispatchers.IO) {
        val p = proc ?: return@withContext false
        val buf = ByteArray(4096)
        val sb = StringBuilder()
        try {
            val ins = p.inputStream
            val n = ins.read(buf)
            if (n <= 0) return@withContext false
            sb.append(String(buf, 0, n))
            val text = sb.toString()
            val idx = text.lastIndexOf(MARK)
            if (idx >= 0) {
                val head = text.substring(0, idx)
                out.append(head)
                if (out.length > MAX_OUT) out = StringBuilder(out.substring(out.length - MAX_OUT))
                true
            } else {
                out.append(text)
                if (out.length > MAX_OUT) out = StringBuilder(out.substring(out.length - MAX_OUT))
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
    val session = remember { ShSession(ctx) }
    var tick by remember { mutableIntStateOf(0) }
    var input by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var selOpen by remember { mutableStateOf(false) }
    val history = remember { mutableStateListOf<String>() }
    var hIdx by remember { mutableIntStateOf(-1) }
    val scroll = rememberScrollState()
    val focus = remember { FocusRequester() }

    fun refresh() { tick++ }

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
            if (done) { busy = false }
            delay(60)
        }
    }

    LaunchedEffect(tick) {
        scroll.animateScrollTo(scroll.maxValue)
    }

    fun run() {
        val cmd = input.trim()
        if (cmd.isEmpty()) return
        input = ""
        history.add(cmd)
        hIdx = -1
        if (!session.alive()) session.start(ctx)
        busy = true
        session.submit(cmd)
    }

    val body = session.script().toString()

    Dialog(onDismissRequest = onClose, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Column(
            Modifier.fillMaxSize().background(TBg).statusBarsPadding().imePadding()
        ) {
            Row(Modifier.fillMaxWidth().padding(start = 8.dp, end = 8.dp, top = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                IconBtn(R.drawable.ic_close, onClose, size = 40.dp, iconSize = 17.dp, tint = TFg, contentDescription = "关闭")
                Spacer(Modifier.width(4.dp))
                Text("bash 1", style = Mono.copy(color = TFg, fontSize = 11.sp), modifier = Modifier.padding(horizontal = 8.dp))
                Spacer(Modifier.width(4.dp))
                Box(Modifier.size(6.dp).background(if (session.alive()) TAccent else TDim, RoundedCornerShape(3.dp)))
                Spacer(Modifier.weight(1f))
                IconBtn(R.drawable.ic_copy, { selOpen = true }, size = 40.dp, iconSize = 17.dp, tint = TFg, contentDescription = "选择并复制")
                IconBtn(R.drawable.ic_plus, {
                    session.start(ctx)
                    refresh()
                }, size = 40.dp, iconSize = 17.dp, tint = TFg, contentDescription = "重开会话")
            }

            Column(
                Modifier.fillMaxSize().padding(horizontal = 8.dp, vertical = 8.dp)
                    .background(TPanel, RoundedCornerShape(10.dp))
                    .padding(12.dp)
                    .verticalScroll(scroll)
            ) {
                Text("sh · " + File(ctx.filesDir, "home").absolutePath, style = Mono.copy(color = TDim, fontSize = 10.sp))
                Spacer(Modifier.height(6.dp))
                Text(body, style = Mono)
                Row(verticalAlignment = Alignment.Top) {
                    Text("\\$ ", style = Mono.copy(color = TAccent))
                    BasicTextField(
                        value = input,
                        onValueChange = { input = it },
                        textStyle = Mono,
                        cursorBrush = androidx.compose.ui.graphics.SolidColor(TAccent),
                        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
                        keyboardActions = KeyboardActions(onDone = { if (!busy) run() }),
                        modifier = Modifier.weight(1f).focusRequester(focus)
                    )
                }
                if (busy) Text("…", style = Mono.copy(color = TDim))
            }

            Row(
                Modifier.fillMaxWidth().padding(horizontal = 6.dp, vertical = 6.dp),
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                KeyBtn("Esc") { input = "" }
                KeyBtn("Tab") { input = input + "  " }
                KeyBtn("↑") { if (history.isNotEmpty()) { if (hIdx < 0) hIdx = history.size - 1 else if (hIdx > 0) hIdx--; input = history[hIdx] } }
                KeyBtn("↓") { if (history.isNotEmpty()) { if (hIdx < history.size - 1) { hIdx++; input = history[hIdx] } else { hIdx = -1; input = "" } } }
                KeyBtn("|") { input = input + "|" }
                KeyBtn("~") { input = input + "~" }
                KeyBtn("/") { input = input + "/" }
                KeyBtn("-") { input = input + "-" }
            }
        }
    }

    if (selOpen) {
        Dialog(onDismissRequest = { selOpen = false }, properties = DialogProperties(usePlatformDefaultWidth = false)) {
            Column(Modifier.fillMaxSize().background(TBg).statusBarsPadding()) {
                Row(Modifier.fillMaxWidth().padding(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text("长按选择文字", style = Mono.copy(color = TDim, fontSize = 11.sp))
                    Spacer(Modifier.weight(1f))
                    Text("复制", style = Mono.copy(color = TAccent, fontSize = 12.sp), modifier = Modifier.clickable { copyText(ctx, body) }.padding(10.dp))
                    Text("关闭", style = Mono.copy(color = TFg, fontSize = 12.sp), modifier = Modifier.clickable { selOpen = false }.padding(10.dp))
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
private fun KeyBtn(label: String, onClick: () -> Unit) {
    Box(
        Modifier
            .background(Color(0xFF1A1D24), RoundedCornerShape(7.dp))
            .clickable { onClick() }
            .padding(horizontal = 10.dp, vertical = 7.dp)
    ) {
        Text(label, style = Mono.copy(color = TFg, fontSize = 11.sp))
    }
}
