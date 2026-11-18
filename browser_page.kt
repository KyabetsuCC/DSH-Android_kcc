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
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
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
import io.github.jackwener.dsh.core.designsystem.BtnVariant
import io.github.jackwener.dsh.core.designsystem.DButton
import io.github.jackwener.dsh.core.designsystem.DDialog
import io.github.jackwener.dsh.core.designsystem.DInput
import io.github.jackwener.dsh.core.designsystem.Dsh
import io.github.jackwener.dsh.core.designsystem.DshType
import io.github.jackwener.dsh.core.designsystem.IconBtn
import io.github.jackwener.dsh.core.designsystem.Radius
import io.github.jackwener.dsh.core.designsystem.pressable

/**
 * The visible browser: the same WebView the browser tools drive, on screen, so the user can watch the
 * agent work and take over at any time. Closing only hides it — the tabs and their logins stay alive.
 *
 * The address bar sits at the top on purpose: with the keyboard open it has to stay put instead of
 * pushing the page around.
 */
@Composable
fun BrowserPage(onClose: () -> Unit) {
    val context = LocalContext.current
    val tabs = BrowserSession.tabs
    val active = BrowserSession.active
    val address = active?.address ?: ""
    val loading = active?.loading == true
    val progress = active?.progress ?: 0
    val canBack = active?.canBack == true
    val canForward = active?.canForward == true
    val home = active?.home ?: true
    val desktop = BrowserSession.desktop
    var typing by remember { mutableStateOf<TextFieldValue?>(null) }
    var tabsOpen by remember { mutableStateOf(false) }
    var adding by remember { mutableStateOf(false) }
    var removing by remember { mutableStateOf<Bookmark?>(null) }
    var newLabel by remember { mutableStateOf("") }
    var newUrl by remember { mutableStateOf("") }
    val value = typing ?: TextFieldValue(address, TextRange(address.length))
    val go: (String) -> Unit = { text ->
        typing = null
        val t = text.trim()
        if (t.isNotEmpty()) BrowserSession.web(context).loadUrl(BrowserSession.normalize(t))
    }

    LaunchedEffect(Unit) { if (tabs.isEmpty()) BrowserSession.newTab(context) }

    Dialog(onDismissRequest = onClose, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Column(
            Modifier.fillMaxSize().background(Dsh.colors.bgBase)
                .statusBarsPadding().navigationBarsPadding(),
        ) {
            Row(
                Modifier.fillMaxWidth().padding(start = 8.dp, end = 6.dp, top = 6.dp, bottom = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Row(
                    Modifier.weight(1f).height(44.dp).clip(Radius.xl)
                        .background(Dsh.colors.bgLayer2)
                        .padding(start = 12.dp, end = 2.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    IconBtn(
                        R.drawable.dsw_search_outline, {}, size = 26.dp, iconSize = 15.dp,
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
                            R.drawable.ic_close, { typing = null }, size = 30.dp, iconSize = 13.dp,
                            tint = Dsh.colors.labelTertiary, contentDescription = null,
                        )
                    }
                }
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
                    HomeSurface(
                        onOpen = { url -> go(url) },
                        onPick = { b -> BrowserSession.web(context).loadUrl(b.url) },
                        onLongPress = { b -> removing = b },
                        onAdd = {
                            newLabel = ""
                            newUrl = ""
                            adding = true
                        },
                    )
                }
            }
            Row(
                Modifier.fillMaxWidth().background(Dsh.colors.bgLayer1)
                    .padding(horizontal = 8.dp, vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
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
                Box(
                    Modifier.size(36.dp).clip(Radius.sm).pressable({ tabsOpen = true }, Radius.sm),
                    contentAlignment = Alignment.Center,
                ) {
                    Box(
                        Modifier.size(22.dp).clip(Radius.xs)
                            .background(Dsh.colors.bgLayer3, Radius.xs),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            tabs.size.toString(),
                            style = DshType.xxs12m,
                            color = Dsh.colors.labelPrimary,
                        )
                    }
                }
                IconBtn(
                    R.drawable.dsw_globe_outline, { BrowserSession.setDesktop(context, !desktop) },
                    size = 36.dp, iconSize = 17.dp,
                    tint = if (desktop) Dsh.colors.brandPrimary else Dsh.colors.labelTertiary,
                    contentDescription = stringResource(R.string.browser_desktop),
                )
            }
        }
    }

    if (tabsOpen) Dialog(onDismissRequest = { tabsOpen = false }) {
        Column(
            Modifier.fillMaxWidth().clip(Radius.lg).background(Dsh.colors.bgLayer1)
                .padding(vertical = 8.dp),
        ) {
            Text(
                stringResource(R.string.browser_tabs),
                Modifier.padding(horizontal = 16.dp, vertical = 10.dp),
                style = DshType.s14m,
                color = Dsh.colors.labelPrimary,
            )
            Column(Modifier.heightIn(max = 380.dp).verticalScroll(rememberScrollState())) {
                for ((i, t) in tabs.withIndex()) {
                    val label = t.pageTitle.ifBlank {
                        if (t.home) stringResource(R.string.browser_home) else t.address
                    }
                    Row(
                        Modifier.fillMaxWidth()
                            .let { m -> if (i == BrowserSession.activeIndex) m.background(Dsh.colors.bgLayer2) else m }
                            .padding(start = 16.dp, end = 4.dp, top = 4.dp, bottom = 4.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            label.ifBlank { stringResource(R.string.browser_tab_new) },
                            Modifier.weight(1f)
                                .clip(Radius.sm)
                                .pressable({
                                    BrowserSession.select(i)
                                    tabsOpen = false
                                }, Radius.sm)
                                .padding(vertical = 10.dp),
                            style = DshType.s14,
                            color = Dsh.colors.labelPrimary,
                            maxLines = 1,
                            overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
                        )
                        IconBtn(
                            R.drawable.ic_close, { BrowserSession.closeTab(i) }, size = 32.dp, iconSize = 13.dp,
                            tint = Dsh.colors.labelTertiary,
                            contentDescription = stringResource(R.string.browser_tab_close),
                        )
                    }
                }
            }
            Row(
                Modifier.fillMaxWidth().clip(Radius.sm)
                    .pressable({
                        BrowserSession.newTab(context)
                        tabsOpen = false
                    }, Radius.sm)
                    .padding(horizontal = 16.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                IconBtn(
                    R.drawable.ic_plus, {}, size = 24.dp, iconSize = 14.dp,
                    tint = Dsh.colors.labelSecondary, contentDescription = null,
                )
                Spacer(Modifier.width(6.dp))
                Text(
                    stringResource(R.string.browser_tab_new),
                    style = DshType.s14,
                    color = Dsh.colors.labelPrimary,
                )
            }
        }
    }

    if (adding) DDialog(
        onDismiss = { adding = false },
        title = stringResource(R.string.browser_add_bookmark),
        buttons = {
            DButton(stringResource(R.string.cancel), { adding = false }, variant = BtnVariant.Outline)
            DButton(stringResource(R.string.save), {
                BookmarkStore.add(context, newLabel, newUrl)
                adding = false
            })
        },
    ) {
        DInput(newLabel, { newLabel = it }, placeholder = stringResource(R.string.browser_bookmark_label))
        DInput(newUrl, { newUrl = it }, placeholder = stringResource(R.string.browser_bookmark_url))
    }

    removing?.let { b ->
        DDialog(
            onDismiss = { removing = null },
            title = b.label,
            buttons = {
                DButton(stringResource(R.string.cancel), { removing = null }, variant = BtnVariant.Outline)
                DButton(stringResource(R.string.browser_bookmark_delete), {
                    BookmarkStore.remove(context, b.url)
                    removing = null
                }, variant = BtnVariant.Danger)
            },
        ) {
            Text(b.url, style = DshType.xxs12, color = Dsh.colors.labelTertiary)
        }
    }

    DisposableEffect(Unit) { onDispose { BrowserSession.detach() } }
}

@Composable
private fun HomeSurface(
    onOpen: (String) -> Unit,
    onPick: (Bookmark) -> Unit,
    onLongPress: (Bookmark) -> Unit,
    onAdd: () -> Unit,
) {
    val context = LocalContext.current
    val marks = BookmarkStore.all(context)
    Column(Modifier.fillMaxSize().background(Dsh.colors.bgBase).padding(horizontal = 20.dp)) {
        Spacer(Modifier.height(24.dp))
        Text(
            stringResource(R.string.browser_home_hint),
            style = DshType.s14,
            color = Dsh.colors.labelTertiary,
        )
        Spacer(Modifier.height(18.dp))
        val cells = marks.map { it } + listOf(Bookmark("", ""))
        for (row in cells.chunked(4)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                for (b in row) {
                    if (b.url.isEmpty()) {
                        AddTile(Modifier.weight(1f), onAdd)
                    } else {
                        BookmarkTile(
                            b,
                            Modifier.weight(1f),
                            { onPick(b) },
                            { onLongPress(b) },
                        )
                    }
                }
                repeat(4 - row.size) { Spacer(Modifier.weight(1f)) }
            }
            Spacer(Modifier.height(14.dp))
        }
        Spacer(Modifier.weight(1f))
        Text(
            stringResource(R.string.browser_bookmark_note),
            Modifier.padding(bottom = 14.dp),
            style = DshType.xxs12,
            color = Dsh.colors.labelDimmed,
        )
    }
}

@Composable
private fun BookmarkTile(b: Bookmark, modifier: Modifier = Modifier, onClick: () -> Unit, onLongClick: () -> Unit) {
    Column(
        modifier.clip(Radius.md).pressable(onClick, Radius.md, onLongClick = onLongClick).padding(vertical = 6.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(
            Modifier.size(52.dp).clip(CircleShape).background(Dsh.colors.bgLayer2),
            contentAlignment = Alignment.Center,
        ) {
            Text(b.label.take(1), style = DshType.s14m, color = Dsh.colors.labelPrimary)
        }
        Spacer(Modifier.height(6.dp))
        Text(
            b.label,
            style = DshType.xxs12,
            color = Dsh.colors.labelSecondary,
            maxLines = 1,
            overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
        )
    }
}

@Composable
private fun AddTile(modifier: Modifier = Modifier, onClick: () -> Unit) {
    Column(
        modifier.clip(Radius.md).pressable(onClick, Radius.md).padding(vertical = 6.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(
            Modifier.size(52.dp).clip(CircleShape).background(Dsh.colors.bgLayer1),
            contentAlignment = Alignment.Center,
        ) {
            IconBtn(
                R.drawable.ic_plus, onClick, size = 52.dp, iconSize = 18.dp,
                tint = Dsh.colors.labelSecondary, contentDescription = null,
            )
        }
        Spacer(Modifier.height(6.dp))
        Text(
            stringResource(R.string.browser_add_bookmark),
            style = DshType.xxs12,
            color = Dsh.colors.labelTertiary,
            maxLines = 1,
            overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
        )
    }
}
