package io.github.jackwener.dsh.feature.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File

private class TermProc {
    var proc: Process? = null
}

private val TBg = Color(0xFF0E1116)
private val TPanel = Color(0xFF08090C)
private val TFg = Color(0xFFD6DCE6)
private val TDim = Color(0xFF78828F)
private val TAccent = Color(0xFF4C8DFF)
private val TChip = Color(0xFF1B1F26)
private const val MARK = "__END__"

/**
 * Stage-1 terminal: one long-lived `sh` on pipes (no pty). Commands run one after another, output
 * streams in, ↑/↓ recall history. Full-screen TUI programs are not supported.
 */
@Composable
fun TerminalOverlay(onClose: () -> Unit) {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    val holder = remember { TermProc() }
    val home = remember { File(ctx.filesDir, "home").also { it.mkdirs() } }
    val binDir = remember { File(ctx.filesDir, "bin") }
    var out by remember { mutableStateOf("") }
    var cmd by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    val history = remember { mutableListOf<String>() }
    var hIdx by remember { mutableIntStateOf(-1) }
    val scroll = rememberScrollState()
    val focus = remember { FocusRequester() }

    fun handle(chunk: String) {
        var text = out + chunk
        val re = Regex("(?m)^" + MARK + "(\\d+)\\s*$")
        if (re.containsMatchIn(text)) {
            text = text.replace(re, "")
            busy = false
        }
        if (text.length > 200000) text = text.substring(text.length - 200000)
        out = text
    }

    fun ensureProc(): Process? {
        holder.proc?.let { if (it.isAlive) return it }
        return try {
            val pb = ProcessBuilder("/system/bin/sh").directory(home)
            val env = pb.environment()
            env["HOME"] = home.absolutePath
            env["TMPDIR"] = ctx.cacheDir.absolutePath
            env["PATH"] = binDir.absolutePath + ":/system/bin:/system/xbin"
            val p = pb.redirectErrorStream(true).start()
            holder.proc = p
            scope.launch(Dispatchers.IO) {
                try {
                    val r = p.inputStream.bufferedReader()
                    val buf = CharArray(4096)
                    while (true) {
                        val n = r.read(buf)
                        if (n < 0) break
                        val s = String(buf, 0, n)
                        withContext(Dispatchers.Main) { handle(s) }
                    }
                } catch (e: Exception) {
                    withContext(Dispatchers.Main) { handle("\n[closed]\n"); busy = false }
                }
            }
            p
        } catch (e: Exception) {
            handle("[error] " + (e.message ?: "") + "\n")
            null
        }
    }

    fun submit() {
        val c = cmd
        if (c.isBlank() || busy) return
        val p = ensureProc() ?: return
        history.add(c)
        hIdx = -1
        cmd = ""
        busy = true
        handle("$ " + c + "\n")
        scope.launch(Dispatchers.IO) {
            try {
                p.outputStream.write((c + "\necho " + MARK + "$?\n").toByteArray())
                p.outputStream.flush()
            } catch (e: Exception) {
                withContext(Dispatchers.Main) { handle("[stdin closed]\n"); busy = false }
            }
        }
    }

    fun hist(up: Boolean) {
        if (history.isEmpty()) return
        hIdx = if (up) (if (hIdx < 0) history.size - 1 else (hIdx - 1).coerceAtLeast(0))
        else (hIdx + 1).coerceAtMost(history.size - 1)
        cmd = history[hIdx]
    }

    LaunchedEffect(out) { if (scroll.maxValue > 0) scroll.animateScrollTo(scroll.maxValue) }
    LaunchedEffect(Unit) { delay(250); focus.requestFocus() }

    Dialog(onDismissRequest = onClose, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Column(Modifier.fillMaxSize().background(TBg).statusBarsPadding().imePadding()) {
            // top bar: close | tab | clipboard + new
            Row(Modifier.fillMaxWidth().height(52.dp).padding(horizontal = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(40.dp).clip(RoundedCornerShape(12.dp)).clickable { onClose() }, contentAlignment = Alignment.Center) {
                    Text("✕", color = TFg, fontSize = 16.sp)
                }
                Spacer(Modifier.width(4.dp))
                Box(Modifier.clip(RoundedCornerShape(10.dp)).background(TChip).padding(horizontal = 12.dp, vertical = 6.dp)) {
                    Text("bash 1", color = TFg, fontSize = 13.sp, fontFamily = FontFamily.Monospace)
                }
                Spacer(Modifier.weight(1f))
                Box(Modifier.size(40.dp).clip(RoundedCornerShape(12.dp))
                    .clickable { copyText(ctx, out) }, contentAlignment = Alignment.Center) {
                    Text("⧉", color = TFg, fontSize = 17.sp)
                }
                Box(Modifier.size(40.dp).clip(RoundedCornerShape(12.dp)).clickable {
                    holder.proc?.destroy()
                    holder.proc = null
                    out = ""
                    busy = false
                }, contentAlignment = Alignment.Center) {
                    Text("＋", color = TFg, fontSize = 18.sp)
                }
            }
            // terminal body
            Box(Modifier.weight(1f).fillMaxWidth().padding(horizontal = 12.dp).padding(bottom = 6.dp)
                .clip(RoundedCornerShape(14.dp)).background(TPanel)) {
                Column(Modifier.fillMaxSize().padding(12.dp)) {
                    Text(
                        text = if (out.isEmpty()) "sh · " + home.absolutePath else out,
                        color = if (out.isEmpty()) TDim else TFg,
                        fontSize = 12.sp,
                        fontFamily = FontFamily.Monospace,
                        lineHeight = 17.sp,
                        modifier = Modifier.weight(1f).fillMaxWidth().verticalScroll(scroll)
                    )
                    Row(Modifier.fillMaxWidth().padding(top = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                        Text(if (busy) "… " else "$ ", color = if (busy) TDim else TAccent, fontSize = 13.sp, fontFamily = FontFamily.Monospace)
                        BasicTextField(
                            value = cmd,
                            onValueChange = { cmd = it },
                            textStyle = TextStyle(color = TFg, fontSize = 13.sp, fontFamily = FontFamily.Monospace),
                            singleLine = true,
                            modifier = Modifier.weight(1f).focusRequester(focus)
                        )
                        if (cmd.isNotEmpty()) Box(Modifier.clip(RoundedCornerShape(8.dp)).background(TAccent)
                            .clickable { submit() }.padding(horizontal = 10.dp, vertical = 6.dp)) {
                            Text("运行", color = Color.White, fontSize = 12.sp)
                        }
                    }
                }
            }
            // key row
            Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(horizontal = 10.dp).padding(bottom = 8.dp),
                verticalAlignment = Alignment.CenterVertically) {
                key("Esc", true) { cmd = "" }
                key("Tab", true) { cmd = cmd + "  " }
                key("Ctrl", false) {}
                key("Alt", false) {}
                key("←", false) {}
                key("↑", true) { hist(true) }
                key("↓", true) { hist(false) }
                key("→", false) {}
                key("|", true) { cmd = cmd + "|" }
                key("~", true) { cmd = cmd + "~" }
                key("/", true) { cmd = cmd + "/" }
                key("-", true) { cmd = cmd + "-" }
            }
        }
    }
}

@Composable
private fun key(label: String, enabled: Boolean, onClick: () -> Unit) {
    Box(Modifier.padding(end = 6.dp).clip(RoundedCornerShape(8.dp)).background(TChip)
        .clickable(enabled = enabled) { onClick() }.padding(horizontal = 11.dp, vertical = 7.dp)) {
        Text(label, color = if (enabled) TFg else TDim.copy(alpha = 0.45f), fontSize = 12.sp,
            fontFamily = FontFamily.Monospace)
    }
}

private fun copyText(ctx: android.content.Context, text: String) {
    try {
        val cm = ctx.getSystemService(android.content.Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager
        cm.setPrimaryClip(android.content.ClipData.newPlainText("terminal", text))
    } catch (_: Exception) {
    }
}
