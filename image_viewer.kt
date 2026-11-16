package io.github.jackwener.dsh.feature.conversation

import android.content.Context
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import coil3.compose.AsyncImage
import java.io.File

/** A user message's image lives in the engine's content-addressed store (attachments/v1/objects/ab/<sha256>). */
fun attachmentFile(context: Context, id: String): File =
    File(context.filesDir, "dsh-home/attachments/v1/objects/" + id.take(2) + "/" + id)

/** Full-screen viewer for the images of one user message: tap the left/right half to page, outside to close. */
@Composable
fun ImageViewer(ids: List<String>, onClose: () -> Unit) {
    if (ids.isEmpty()) return
    val context = LocalContext.current
    var index by remember(ids) { mutableIntStateOf(0) }
    val noInd = remember { MutableInteractionSource() }
    Dialog(onDismissRequest = onClose, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Box(Modifier.fillMaxSize().background(Color.Black)) {
            AsyncImage(
                model = attachmentFile(context, ids[index.coerceIn(0, ids.lastIndex)]),
                contentDescription = null,
                contentScale = ContentScale.Fit,
                modifier = Modifier.fillMaxSize().padding(8.dp),
            )
            Row(Modifier.fillMaxSize()) {
                Box(
                    Modifier.weight(1f).fillMaxHeight().clickable(
                        interactionSource = noInd, indication = null,
                    ) { if (index > 0) index-- else onClose() },
                )
                Box(
                    Modifier.weight(1f).fillMaxHeight().clickable(
                        interactionSource = noInd, indication = null,
                    ) { if (index < ids.lastIndex) index++ else onClose() },
                )
            }
            if (ids.size > 1) {
                Text(
                    (index + 1).toString() + " / " + ids.size,
                    color = Color.White,
                    modifier = Modifier.align(Alignment.BottomCenter).padding(bottom = 28.dp),
                )
            }
        }
    }
}
