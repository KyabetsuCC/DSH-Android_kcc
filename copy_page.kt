package io.github.jackwener.dsh.feature.conversation

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import io.github.jackwener.dsh.R
import io.github.jackwener.dsh.core.designsystem.BtnVariant
import io.github.jackwener.dsh.core.designsystem.DButton
import io.github.jackwener.dsh.core.designsystem.Dsh
import io.github.jackwener.dsh.core.designsystem.DshType
import io.github.jackwener.dsh.core.designsystem.IconBtn
import io.github.jackwener.dsh.core.designsystem.Radius
import io.github.jackwener.dsh.core.designsystem.Segmented
import io.github.jackwener.dsh.core.designsystem.copyText
import io.github.jackwener.dsh.core.session.Turn

/** Fenced code blocks in one markdown reply, contents only. */
private val FENCE = Regex("```[A-Za-z0-9_+.#-]*\\n([\\s\\S]*?)```")

private fun codeBlocksOf(text: String): List<String> =
    FENCE.findAll(text).map { it.groupValues[1].trimEnd('\n') }.filter { it.isNotBlank() }.toList()

/**
 * 复制页：本会话里所有回复的纯文本（含代码块），全屏一页，逐条复制或一键全选复制。
 * 长按文字可以只选一段（SelectionContainer），不用去点气泡里那个小复制键。
 */
@Composable
fun CopyPage(turns: List<Turn>, onClose: () -> Unit) {
    val c = Dsh.colors
    val context = LocalContext.current
    var tab by remember { mutableIntStateOf(0) }
    val entries = remember(turns) {
        turns.mapNotNull { t -> t.reply?.text?.takeIf { it.isNotBlank() }?.let { (t.number ?: 0) to it } }
    }
    val codes = remember(entries) { entries.flatMap { (n, text) -> codeBlocksOf(text).map { n to it } } }
    val shown = if (tab == 0) entries else codes
    val all = shown.joinToString("\n\n") { it.second }

    Dialog(onDismissRequest = onClose, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Column(Modifier.fillMaxSize().background(c.bgBase).statusBarsPadding().navigationBarsPadding().padding(horizontal = 12.dp)) {
            Row(Modifier.fillMaxWidth().height(56.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(stringResource(R.string.copy_page_title), Modifier.weight(1f), style = DshType.s14m, color = c.labelPrimary)
                Segmented(
                    listOf(stringResource(R.string.copy_page_all), stringResource(R.string.copy_page_code)),
                    tab, { tab = it }, compact = true,
                )
                Spacer(Modifier.width(8.dp))
                IconBtn(R.drawable.ic_close, onClose, size = 36.dp, iconSize = 16.dp, tint = c.labelSecondary, contentDescription = stringResource(R.string.close))
            }
            if (shown.isEmpty()) {
                Column(Modifier.fillMaxWidth().weight(1f), verticalArrangement = Arrangement.Center, horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(stringResource(R.string.copy_page_empty), style = DshType.xs13, color = c.labelTertiary)
                }
            } else {
                Column(
                    Modifier.fillMaxWidth().weight(1f).verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    shown.forEachIndexed { i, (n, text) ->
                        Column(Modifier.fillMaxWidth().clip(Radius.md).background(c.bgLayer1).padding(12.dp)) {
                            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                                Text(
                                    if (tab == 0) stringResource(R.string.copy_page_item, n) else stringResource(R.string.copy_page_item_code, n, i + 1),
                                    Modifier.weight(1f), style = DshType.xxs12m, color = c.labelTertiary,
                                )
                                IconBtn(
                                    R.drawable.dsw_copy_outline, { copyText(context, text) },
                                    size = 30.dp, iconSize = 14.dp, tint = c.labelSecondary,
                                    contentDescription = stringResource(R.string.copy),
                                )
                            }
                            Spacer(Modifier.height(6.dp))
                            SelectionContainer { Text(text, style = DshType.mono12, color = c.labelPrimary) }
                        }
                    }
                }
            }
            Spacer(Modifier.height(10.dp))
            DButton(
                stringResource(R.string.copy_page_copy_all), { copyText(context, all) },
                Modifier.fillMaxWidth(), variant = BtnVariant.Primary, enabled = shown.isNotEmpty(),
            )
            Spacer(Modifier.height(12.dp))
        }
    }
}
