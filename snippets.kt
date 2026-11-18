package io.github.jackwener.dsh.feature.conversation

import android.content.Context
import android.widget.Toast
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
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import io.github.jackwener.dsh.R
import io.github.jackwener.dsh.core.designsystem.BtnVariant
import io.github.jackwener.dsh.core.designsystem.DButton
import io.github.jackwener.dsh.core.designsystem.DDialog
import io.github.jackwener.dsh.core.designsystem.DInput
import io.github.jackwener.dsh.core.designsystem.DMenu
import io.github.jackwener.dsh.core.designsystem.Dsh
import io.github.jackwener.dsh.core.designsystem.DshType
import io.github.jackwener.dsh.core.designsystem.IconBtn
import io.github.jackwener.dsh.core.designsystem.MenuDivider
import io.github.jackwener.dsh.core.designsystem.MenuItem
import io.github.jackwener.dsh.core.designsystem.Radius
import io.github.jackwener.dsh.core.designsystem.copyText
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.UUID

/** One saved snippet: a command, a prompt, or anything worth one tap. */
data class Snippet(val id: String, val title: String, val text: String)

/** Snippets live in files/notes/snippets.json — no Room migration involved. */
object SnippetStore {
    var version by mutableIntStateOf(0)
        private set

    private fun file(c: Context): File = File(File(c.filesDir, "notes"), "snippets.json")

    fun all(c: Context): List<Snippet> = runCatching {
        val f = file(c)
        if (!f.exists()) return@runCatching emptyList<Snippet>()
        val arr = JSONArray(f.readText())
        (0 until arr.length()).mapNotNull { i ->
            val o = arr.optJSONObject(i) ?: return@mapNotNull null
            val t = o.optString("text")
            if (t.isBlank()) null else Snippet(o.optString("id").ifBlank { UUID.randomUUID().toString() }, o.optString("title"), t)
        }
    }.getOrDefault(emptyList())

    private fun save(c: Context, list: List<Snippet>) {
        runCatching {
            val f = file(c)
            f.parentFile?.mkdirs()
            val arr = JSONArray()
            list.forEach { s -> arr.put(JSONObject().put("id", s.id).put("title", s.title).put("text", s.text)) }
            f.writeText(arr.toString())
            version++
        }
    }

    fun add(c: Context, title: String, text: String) {
        val t = text.trim()
        if (t.isEmpty()) return
        save(c, listOf(Snippet(UUID.randomUUID().toString(), title.trim(), t)) + all(c))
    }

    fun update(c: Context, id: String, title: String, text: String) {
        val t = text.trim()
        if (t.isEmpty()) return remove(c, id)
        save(c, all(c).map { if (it.id == id) it.copy(title = title.trim(), text = t) else it })
    }

    fun remove(c: Context, id: String) = save(c, all(c).filter { it.id != id })
}

@Composable
fun SnippetOverlay(onClose: () -> Unit) {
    val ctx = LocalContext.current
    val c = Dsh.colors
    val ver = SnippetStore.version
    val items = remember(ver) { SnippetStore.all(ctx) }
    var adding by remember { mutableStateOf(false) }
    var editing by remember { mutableStateOf<Snippet?>(null) }
    var deleting by remember { mutableStateOf<Snippet?>(null) }
    var menuId by remember { mutableStateOf<String?>(null) }

    Dialog(onDismissRequest = onClose, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Column(Modifier.fillMaxSize().background(c.bgBase).statusBarsPadding().navigationBarsPadding().padding(horizontal = 16.dp)) {
            Row(Modifier.fillMaxWidth().height(56.dp), verticalAlignment = Alignment.CenterVertically) {
                androidx.compose.material3.Text(stringResource(R.string.snippet_title), Modifier.weight(1f), style = DshType.s14m, color = c.labelPrimary)
                IconBtn(R.drawable.ic_plus, { adding = true }, size = 36.dp, iconSize = 16.dp, tint = c.labelPrimary, contentDescription = stringResource(R.string.snippet_new))
                Spacer(Modifier.width(4.dp))
                IconBtn(R.drawable.ic_close, onClose, size = 36.dp, iconSize = 16.dp, tint = c.labelSecondary, contentDescription = stringResource(R.string.close))
            }
            if (items.isEmpty()) {
                Box(Modifier.fillMaxWidth().weight(1f), contentAlignment = Alignment.Center) {
                    androidx.compose.material3.Text(stringResource(R.string.snippet_empty), style = DshType.xs13, color = c.labelTertiary, textAlign = androidx.compose.ui.text.style.TextAlign.Center)
                }
            } else {
                Column(Modifier.fillMaxWidth().weight(1f).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    items.forEach { s ->
                        Box {
                            Column(
                                Modifier.fillMaxWidth().clip(Radius.md).background(c.bgLayer2)
                                    .clickable {
                                        copyText(ctx, s.text)
                                        Toast.makeText(ctx, ctx.getString(R.string.snippet_copied), Toast.LENGTH_SHORT).show()
                                    }
                                    .padding(start = 12.dp, top = 10.dp, end = 4.dp, bottom = 12.dp),
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    val head = if (s.title.isNotBlank()) s.title else s.text.lineSequence().firstOrNull().orEmpty().take(40)
                                    androidx.compose.material3.Text(head, Modifier.weight(1f), style = DshType.s14m, color = c.labelPrimary, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                    IconBtn(R.drawable.dsw_ellipsis_outline, { menuId = s.id }, size = 32.dp, iconSize = 14.dp, tint = c.labelTertiary, contentDescription = stringResource(R.string.more_actions))
                                }
                                if (s.title.isNotBlank()) {
                                    Spacer(Modifier.height(4.dp))
                                    androidx.compose.material3.Text(s.text, Modifier.padding(end = 8.dp), style = DshType.xs13, color = c.labelSecondary, maxLines = 4, overflow = TextOverflow.Ellipsis)
                                }
                            }
                            DMenu(menuId == s.id, { menuId = null }) {
                                MenuItem(stringResource(R.string.rename), { menuId = null; editing = s }, R.drawable.dsw_edit_outline)
                                MenuItem(stringResource(R.string.copy), {
                                    menuId = null
                                    copyText(ctx, s.text)
                                    Toast.makeText(ctx, ctx.getString(R.string.snippet_copied), Toast.LENGTH_SHORT).show()
                                }, R.drawable.dsw_copy_outline)
                                MenuDivider()
                                MenuItem(stringResource(R.string.delete), { menuId = null; deleting = s }, R.drawable.dsw_trash_outline, danger = true)
                            }
                        }
                    }
                    Spacer(Modifier.height(24.dp))
                }
            }
        }
    }

    if (adding || editing != null) {
        val cur = editing
        var title by remember(cur?.id, adding) { mutableStateOf(cur?.title ?: "") }
        var text by remember(cur?.id, adding) { mutableStateOf(cur?.text ?: "") }
        DDialog({ adding = false; editing = null }, stringResource(if (cur == null) R.string.snippet_new else R.string.rename), buttons = {
            DButton(stringResource(R.string.cancel), { adding = false; editing = null }, variant = BtnVariant.Outline)
            DButton(stringResource(R.string.save), {
                if (cur == null) SnippetStore.add(ctx, title, text) else SnippetStore.update(ctx, cur.id, title, text)
                adding = false
                editing = null
            }, enabled = text.isNotBlank())
        }) {
            DInput(title, { title = it }, placeholder = stringResource(R.string.snippet_title_hint))
            DInput(text, { text = it }, placeholder = stringResource(R.string.snippet_hint), singleLine = false, minHeight = 120.dp)
        }
    }

    deleting?.let { s ->
        DDialog({ deleting = null }, stringResource(R.string.delete), buttons = {
            DButton(stringResource(R.string.cancel), { deleting = null }, variant = BtnVariant.Outline)
            DButton(stringResource(R.string.delete), { SnippetStore.remove(ctx, s.id); deleting = null }, variant = BtnVariant.Danger)
        }) {
            androidx.compose.material3.Text(s.text, style = DshType.xs13, color = c.labelSecondary, maxLines = 4, overflow = TextOverflow.Ellipsis)
        }
    }
}
