package io.github.jackwener.dsh.core.data

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue

/** UI 偏好：随设置变化、需要让 Compose 立即重组的轻量状态。 */
object UiPrefs {
    /** 侧栏紧凑模式：行更矮、留白更少，一屏能放更多会话。 */
    var compactDrawer by mutableStateOf(false)
}
