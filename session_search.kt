package io.github.jackwener.dsh.feature.conversation

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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import io.github.jackwener.dsh.R
import io.github.jackwener.dsh.core.designsystem.DIcon
import io.github.jackwener.dsh.core.designsystem.DInput
import io.github.jackwener.dsh.core.designsystem.Dsh
import io.github.jackwener.dsh.core.designsystem.DshType
import io.github.jackwener.dsh.core.designsystem.IconBtn
import io.github.jackwener.dsh.core.designsystem.Radius
import io.github.jackwener.dsh.core.designsystem.pressable
import io.github.jackwener.dsh.core.session.Block
import io.github.jackwener.dsh.core.session.Turn

/**
 * Where the conversation search wants the stream to scroll: [request] bumps [seq], and every
 * ChatStream in composition reacts once (a new session resets its own scroll anyway).
 */
object StreamJump {
    var seq by mutableIntStateOf(0)
    var index by mutableIntStateOf(-1)

    fun request(i: Int) { index = i; seq++ }
}

private data class Hit(val index: Int, val number: Int, val who: String, val text: String)

/** In-conversation search: user text and assistant replies of every turn, tap to jump. */
@Composable
fun SessionSearchOverlay(turns: List<Turn>, onClose: () -> Unit, onPick: (Int) -> Unit) {
    val c = Dsh.colors
    var q by remember { mutableStateOf("") }
    val hits = remember(q, turns) {
        val needle = q.trim()
        if (needle.isEmpty()) return@remember emptyList<Hit>()
        turns.mapIndexedNotNull { i, t ->
            val user = t.user?.text.orEmpty()
            val reply = t.blocks.filterIsInstance<Block.Text>().joinToString("\n") { it.text }
            val hay = user + "\n" + reply
            if (!hay.contains(needle, ignoreCase = true)) return@mapIndexedNotNull null
            val num = t.number ?: (i + 1)
            if (user.contains(needle, ignoreCase = true)) Hit(i, num, "you", user) else Hit(i, num, "ai", reply)
        }
    }
    Dialog(onDismissRequest = onClose, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Column(Modifier.fillMaxSize().background(c.bgBase).statusBarsPadding().navigationBarsPadding().padding(12.dp)) {
            Row(Modifier.fillMaxWidth().height(44.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(stringResource(R.string.search_in_session), Modifier.weight(1f), style = DshType.s14m, color = c.labelPrimary)
                IconBtn(R.drawable.ic_close, onClose, size = 36.dp, iconSize = 16.dp, tint = c.labelSecondary,
                    contentDescription = stringResource(R.string.cancel))
            }
            Spacer(Modifier.height(6.dp))
            DInput(q, { q = it }, placeholder = stringResource(R.string.search_in_session), modifier = Modifier.fillMaxWidth())
            Spacer(Modifier.height(8.dp))
            if (q.isNotBlank() && hits.isEmpty()) {
                Text(stringResource(R.string.search_no_hit), Modifier.padding(8.dp), style = DshType.xs13, color = c.labelTertiary)
            }
            LazyColumn(Modifier.fillMaxWidth().weight(1f)) {
                items(hits, key = { it.index }) { h ->
                    Row(Modifier.fillMaxWidth().clip(Radius.md).pressable({ onPick(h.index) }, Radius.md).padding(horizontal = 8.dp, vertical = 9.dp),
                        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Box(Modifier.width(28.dp), contentAlignment = Alignment.Center) {
                            Text("#" + h.number, style = DshType.tiny10, color = c.labelTertiary)
                        }
                        Box(Modifier.clip(CircleShape).background(c.bgLayer2).padding(horizontal = 6.dp, vertical = 2.dp)) {
                            DIcon(if (h.who == "you") R.drawable.dsw_new_chat_outline else R.drawable.dsw_inspect_outline, size = 10.dp, tint = c.labelSecondary)
                        }
                        Text(h.text.trim().replace('\n', ' '), Modifier.weight(1f), style = DshType.xs13, color = c.labelSecondary,
                            maxLines = 2, overflow = TextOverflow.Ellipsis)
                    }
                }
            }
        }
    }
}
