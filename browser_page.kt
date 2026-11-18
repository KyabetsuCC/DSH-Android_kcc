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
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
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
import androidx.compose.ui.text.input.ImeAction
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

/** Sites offered on the blank page; the user can also just type into the address bar. */
private val QUICK_LINKS = listOf(
    "Bing" to "https://www.bing.com",
    "百度" to "https://www.baidu.com",
    "DeepSeek" to "https://chat.deepseek.com",
    "GitHub" to "https://github.com",
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
    var typing by remember { mutableStateOf("") }
    var edited by remember { mutableStateOf(false) }
    val shown = if (edited) typing else address

    Dialog(onDismissRequest = onClose, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Column(
            Modifier.fillMaxSize().background(Dsh.colors.bgBase)
                .statusBarsPadding().navigationBarsPadding(),
        ) {
            Row(
                Modifier.fillMaxWidth().height(52.dp).padding(start = 6.dp, end = 6.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                IconBtn(
                    R.drawable.ic_close, onClose, size = 34.dp, iconSize = 14.dp,
                    tint = Dsh.colors.labelSecondary, contentDescription = stringResource(R.string.browser_close),
                )
                Box(
                    Modifier.weight(1f).height(36.dp).clip(Radius.sm)
                        .background(Dsh.colors.bgLayer2).padding(start = 10.dp, end = 10.dp),
                    contentAlignment = Alignment.CenterStart,
                ) {
                    BasicTextField(
                        value = shown,
                        onValueChange = { typing = it; edited = true },
                        singleLine = true,
                        textStyle = DshType.s14.copy(color = Dsh.colors.labelPrimary),
                        cursorBrush = SolidColor(Dsh.colors.brandPrimary),
                        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Go),
                        keyboardActions = KeyboardActions(onGo = {
                            BrowserSession.web(context).loadUrl(BrowserSession.normalize(typing.ifBlank { shown }))
                            edited = false
                        }),
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
                IconBtn(
                    R.drawable.dsw_refresh_outline, { BrowserSession.reload() }, size = 34.dp, iconSize = 15.dp,
                    tint = Dsh.colors.labelSecondary, contentDescription = stringResource(R.string.browser_reload),
                )
            }
            if (loading) {
                LinearProgressIndicator(
                    progress = { progress / 100f },
                    modifier = Modifier.fillMaxWidth().height(2.dp),
                    color = Dsh.colors.brandPrimary,
                    trackColor = Dsh.colors.bgLayer2,
                )
            } else {
                Spacer(Modifier.height(2.dp))
            }
            Row(
                Modifier.fillMaxWidth().height(40.dp).padding(horizontal = 6.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                IconBtn(
                    R.drawable.dsw_chevron_left_outline, { BrowserSession.back() }, size = 32.dp, iconSize = 15.dp,
                    tint = if (canBack) Dsh.colors.labelSecondary else Dsh.colors.labelDimmed,
                    enabled = canBack, contentDescription = stringResource(R.string.browser_back),
                )
                IconBtn(
                    R.drawable.dsw_chevron_right_outline, { BrowserSession.forward() }, size = 32.dp, iconSize = 15.dp,
                    tint = if (canForward) Dsh.colors.labelSecondary else Dsh.colors.labelDimmed,
                    enabled = canForward, contentDescription = stringResource(R.string.browser_forward),
                )
                IconBtn(
                    R.drawable.dsw_globe_outline, { BrowserSession.setDesktop(context, !desktop) }, size = 32.dp,
                    iconSize = 15.dp, tint = if (desktop) Dsh.colors.brandPrimary else Dsh.colors.labelTertiary,
                    contentDescription = stringResource(R.string.browser_desktop),
                )
                Spacer(Modifier.width(6.dp))
                Text(
                    title.ifBlank { shown },
                    Modifier.weight(1f),
                    style = DshType.xxs12,
                    color = Dsh.colors.labelTertiary,
                    maxLines = 1,
                    overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
                )
            }
            Box(Modifier.fillMaxWidth().weight(1f)) {
                AndroidView(
                    factory = { c -> FrameLayout(c).also { BrowserSession.attach(c, it) } },
                    modifier = Modifier.fillMaxSize(),
                )
                if (address.isBlank()) {
                    Column(
                        Modifier.fillMaxSize().background(Dsh.colors.bgBase).padding(horizontal = 24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center,
                    ) {
                        Text(stringResource(R.string.browser_home_hint), style = DshType.s14, color = Dsh.colors.labelTertiary)
                        Spacer(Modifier.height(20.dp))
                        for ((label, url) in QUICK_LINKS) {
                            Text(
                                label,
                                Modifier.fillMaxWidth().clip(Radius.md).background(Dsh.colors.bgLayer1)
                                    .pressable({ BrowserSession.web(context).loadUrl(url) }, Radius.md)
                                    .padding(horizontal = 16.dp, vertical = 13.dp),
                                style = DshType.s14,
                                color = Dsh.colors.labelPrimary,
                            )
                            Spacer(Modifier.height(8.dp))
                        }
                    }
                }
            }
        }
    }
    DisposableEffect(Unit) { onDispose { BrowserSession.detach() } }
}
