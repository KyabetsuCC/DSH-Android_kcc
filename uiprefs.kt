package io.github.jackwener.dsh.core.data

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue

/** UI 偏好：随设置变化、需要让 Compose 立即重组的轻量状态。 */
object UiPrefs {
    /** 侧栏紧凑模式：行更矮、留白更少，一屏能放更多会话。 */
    var compactDrawer by mutableStateOf(false)

    /** 正文缩放（0.9 / 1.0 / 1.15 / 1.3）。 */
    var readingScale by mutableFloatStateOf(1f)

    /** 对话区左右留白（dp）：越大越窄。 */
    var chatPadding by mutableIntStateOf(16)
}
