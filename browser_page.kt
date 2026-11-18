package io.github.jackwener.dsh.feature.browser

import android.widget.FrameLayout
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.TextRange
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import io.github.jackwener.dsh.R
import io.github.jackwener.dsh.core.capability.BrowserSession
import io.github.jackwener.dsh.core.designsystem.Dsh
import io.github.jackwener.dsh.core.designsystem.DshType
import io.github.jackwener.dsh.core.designsystem.IconBtn
import io.github.jackwener.dsh.core.designsystem.Radius
import io.github.jackwener.dsh.core.designsystem.pressable

/** One shortcut on the start page: a label, the address it opens and the glyph drawn in the tile. */
private data class Shortcut(val label: String, val url: String, val glyph: String)

private val SHORTCUTS = listOf(
    Shortcut("百度", "https://www.baidu.com", "百"),
    Shortcut("Bing", "https://www.bing.com", "B"),
    Shortcut("DeepSeek", "https://chat.deepseek.com", "D"),
    Shortcut("GitHub", "https://github.com", "G"),
    Shortcut("知乎", "https://www.zhihu.com", "知"),
    Shortcut("B站", "https://m.bilibili.com", "B"),
    Shortcut("微博", "https://m.weibo.cn", "微"),
    Shortcut("淘宝", "https://m.taobao.com", "淘"),
)

/**
 * The visible browser: the same WebView the browser tools drive, on screen, so the user can watch the
 * agent work and take over the address bar at any time. Closing only hides it — the page stays alive.
 */
@Composable
fun BrowserPage(onClose: () -> Unit) {
    val context = LocalContext.current
    val address = BrowserSession.address
    val title = BrowserSession.pageTitle
    val loading = BrowserSession.loading
    val progress = BrowserSession.progress
    val canBack = BrowserSession.canBack
    val canForward = BrowserSession.canForward
    val desktop = BrowserSession.desktop
    val home = BrowserSession.home
    // Null while the bar mirrors the page address; non-null once the user starts typing.
    var typing by remember { mutableStateOf<TextFieldValue?>(null) }
    val value = typing ?: TextFieldValue(address, TextRange(address.length))
    val go: (String) -> Unit = { text ->
        typing = null
        if (text.isNotBlank()) BrowserSession.web(context).loadUrl(BrowserSession.normalize(text))
    }

    Dialog(onDismissRequest = onClose, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Column(
            Modifier.fillMaxSize().background(Dsh.colors.bgBase)
                .statusBarsPadding().navigationBarsPadding(),
        ) {
            Row(
                Modifier.fillMaxWidth().height(46.dp).padding(start = 6.dp, end = 6.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    (if (home) "" else title).ifBlank { stringResource(R.string.browser_title) },
                    Modifier.weight(1f),
                    style = DshType.s14m,
                    color = Dsh.colors.labelPrimary,
                    maxLines = 1,
                    overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
                )
                IconBtn(
                    R.drawable.ic_close, onClose, size = 34.dp, iconSize = 16.dp,
                    tint = Dsh.colors.labelSecondary, contentDescription = stringResource(R.string.browser_close),
                )
            }
            if (loading) {
                LinearProgressIndicator(
                    progress = { progress / 100f },
                    modifier = Modifier.fillMaxWidth().height(2.dp),
                    color = Dsh.colors.brandPrimary,
                    trackColor = Dsh.colors.bgLayer2,
                )
            }
            Box(Modifier.fillMaxWidth().weight(1f)) {
                AndroidView(
                    factory = { c -> FrameLayout(c).also { BrowserSession.attach(c, it) } },
                    modifier = Modifier.fillMaxSize(),
                )
                if (home) {
                    Column(
                        Modifier.fillMaxSize().background(Dsh.colors.bgBase).padding(horizontal = 20.dp),
                    ) {
                        Spacer(Modifier.height(28.dp))
                        Text(
                            stringResource(R.string.browser_home_hint),
                            style = DshType.s14,
                            color = Dsh.colors.labelTertiary,
                        )
                        Spacer(Modifier.height(20.dp))
                        for (row in SHORTCUTS.chunked(4)) {
                            Row(
                                Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(6.dp),
                            ) {
                                for (s in row) {
                                    ShortcutTile(s, Modifier.weight(1f)) { go(s.url) }
                                }
                                repeat(4 - row.size) { Spacer(Modifier.weight(1f)) }
                            }
                            Spacer(Modifier.height(14.dp))
                        }
                    }
                }
            }
            Column(
                Modifier.fillMaxWidth().background(Dsh.colors.bgLayer1)
                    .padding(horizontal = 10.dp, vertical = 8.dp),
            ) {
                Row(
                    Modifier.fillMaxWidth().height(42.dp).clip(Radius.xl)
                        .background(Dsh.colors.bgLayer2)
                        .padding(start = 12.dp, end = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    IconBtn(
                        R.drawable.dsw_search_outline, {}, size = 28.dp, iconSize = 15.dp,
                        tint = Dsh.colors.labelTertiary, contentDescription = null,
                    )
                    Box(Modifier.weight(1f)) {
                        BasicTextField(
                            value = value,
                            onValueChange = { typing = it },
                            modifier = Modifier.fillMaxWidth(),
                            textStyle = DshType.s14.copy(color = Dsh.colors.labelPrimary),
                            singleLine = true,
                            cursorBrush = SolidColor(Dsh.colors.labelPrimary),
                            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Go),
                            keyboardActions = KeyboardActions(onGo = { go(value.text) }),
                        )
                        if (value.text.isBlank()) {
                            Text(
                                stringResource(R.string.browser_search_hint),
                                style = DshType.s14,
                                color = Dsh.colors.labelTertiary,
                            )
                        }
                    }
                    if (value.text.isNotBlank()) {
                        IconBtn(
                            R.drawable.ic_close, { typing = null }, size = 28.dp, iconSize = 13.dp,
                            tint = Dsh.colors.labelTertiary, contentDescription = null,
                        )
                    }
                }
                Spacer(Modifier.height(4.dp))
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    IconBtn(
                        R.drawable.dsw_chevron_left_outline, { BrowserSession.back() }, size = 36.dp,
                        iconSize = 17.dp, tint = if (canBack) Dsh.colors.labelSecondary else Dsh.colors.labelDimmed,
                        enabled = canBack, contentDescription = stringResource(R.string.browser_back),
                    )
                    IconBtn(
                        R.drawable.dsw_chevron_right_outline, { BrowserSession.forward() }, size = 36.dp,
                        iconSize = 17.dp, tint = if (canForward) Dsh.colors.labelSecondary else Dsh.colors.labelDimmed,
                        enabled = canForward, contentDescription = stringResource(R.string.browser_forward),
                    )
                    IconBtn(
                        R.drawable.ic_home, { BrowserSession.goHome() }, size = 36.dp, iconSize = 17.dp,
                        tint = if (home) Dsh.colors.brandPrimary else Dsh.colors.labelSecondary,
                        contentDescription = stringResource(R.string.browser_home),
                    )
                    IconBtn(
                        R.drawable.dsw_refresh_outline, { BrowserSession.reload() }, size = 36.dp,
                        iconSize = 16.dp, tint = Dsh.colors.labelSecondary,
                        contentDescription = stringResource(R.string.browser_reload),
                    )
                    Spacer(Modifier.weight(1f))
                    IconBtn(
                        R.drawable.dsw_globe_outline, { BrowserSession.setDesktop(context, !desktop) },
                        size = 36.dp, iconSize = 17.dp,
                        tint = if (desktop) Dsh.colors.brandPrimary else Dsh.colors.labelTertiary,
                        contentDescription = stringResource(R.string.browser_desktop),
                    )
                }
            }
        }
    }
    DisposableEffect(Unit) { onDispose { BrowserSession.detach() } }
}

@Composable
private fun ShortcutTile(s: Shortcut, modifier: Modifier = Modifier, onClick: () -> Unit) {
    Column(
        modifier.clip(Radius.md).pressable(onClick, Radius.md).padding(vertical = 6.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(
            Modifier.size(52.dp).clip(CircleShape).background(Dsh.colors.bgLayer2),
            contentAlignment = Alignment.Center,
        ) {
            Text(s.glyph, style = DshType.s14m, color = Dsh.colors.labelPrimary)
        }
        Spacer(Modifier.height(6.dp))
        Text(
            s.label,
            style = DshType.xxs12,
            color = Dsh.colors.labelSecondary,
            maxLines = 1,
            overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
        )
    }
}
