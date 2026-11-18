package io.github.jackwener.dsh.feature.conversation

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import io.github.jackwener.dsh.R
import io.github.jackwener.dsh.core.data.UsageDao
import io.github.jackwener.dsh.core.designsystem.Dsh
import io.github.jackwener.dsh.core.designsystem.DshType
import io.github.jackwener.dsh.core.designsystem.Radius
import io.github.jackwener.dsh.core.session.Pricing
import io.github.jackwener.dsh.core.session.Usage
import java.time.Duration
import java.time.LocalDate
import java.time.ZoneOffset
import java.time.ZonedDateTime
import javax.inject.Inject
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.stateIn

@HiltViewModel
class DrawerStatsViewModel @Inject constructor(dao: UsageDao) : ViewModel() {
    val days = dao.observe().stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
}

private data class PeakState(val peak: Boolean, val fraction: Float, val remain: Duration)

/** DeepSeek 峰谷时段（UTC）：01:00–04:00、06:00–10:00 的周一至周五为峰时，其余为谷时。 */
private fun peakState(now: ZonedDateTime): PeakState {
    val utc = now.withZoneSameInstant(ZoneOffset.UTC)
    val minutes = utc.hour * 60 + utc.minute
    val weekday = utc.dayOfWeek.value <= 5
    val segs = if (weekday) listOf(60 to 240, 360 to 600) else emptyList()
    segs.forEach { (s, e) ->
        if (minutes >= s && minutes < e) {
            return PeakState(true, (minutes - s).toFloat() / (e - s), Duration.ofMinutes((e - minutes).toLong()))
        }
    }
    if (!weekday) return PeakState(false, 0f, Duration.ZERO)
    val nextStart = segs.firstOrNull { it.first > minutes }?.first ?: (24 * 60 + 60)
    val segStart = segs.lastOrNull { it.second <= minutes }?.second ?: 0
    return PeakState(false, (minutes - segStart).toFloat() / (nextStart - segStart), Duration.ofMinutes((nextStart - minutes).toLong()))
}

private fun compact(n: Long): String = when {
    n >= 1_000_000_000L -> String.format(java.util.Locale.US, "%.1fB", n / 1_000_000_000.0)
    n >= 1_000_000L -> String.format(java.util.Locale.US, "%.1fM", n / 1_000_000.0)
    n >= 1_000L -> String.format(java.util.Locale.US, "%.1fK", n / 1_000.0)
    else -> n.toString()
}

/** 侧栏底部：今日花费 / Token 与 DeepSeek 峰谷时段。 */
@Composable
fun DrawerStats(vm: DrawerStatsViewModel = hiltViewModel()) {
    val days by vm.days.collectAsStateWithLifecycle()
    val c = Dsh.colors
    val todayKey = LocalDate.now().toString()
    val today = days.firstOrNull { it.day == todayKey }
    val usage = Usage(
        uncached = ((today?.inputTokens ?: 0) - (today?.cachedTokens ?: 0)).coerceAtLeast(0),
        output = today?.outputTokens ?: 0,
        cacheRead = today?.cachedTokens ?: 0,
    )
    val cost = Pricing.cost(usage)
    val state = remember { peakState(ZonedDateTime.now()) }
    val remain = "${state.remain.toHours()}h ${state.remain.toMinutes() % 60}m"
    Column(Modifier.fillMaxWidth().padding(horizontal = 2.dp, vertical = 4.dp)) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Bottom) {
            Column(Modifier.weight(1f)) {
                Text(stringResource(R.string.drawer_today), style = DshType.tiny10, color = c.labelTertiary)
                Text(cost?.let { Pricing.format(it) } ?: "—", style = DshType.s14m, color = c.labelPrimary)
            }
            Column(horizontalAlignment = Alignment.End) {
                Text(stringResource(R.string.drawer_tokens), style = DshType.tiny10, color = c.labelTertiary)
                Text(compact(usage.total), style = DshType.s14m, color = c.labelPrimary)
            }
        }
        Spacer(Modifier.height(6.dp))
        Box(Modifier.fillMaxWidth().height(4.dp).background(c.borderL2, RoundedCornerShape(2.dp))) {
            Box(Modifier.fillMaxWidth(state.fraction.coerceIn(0.02f, 1f)).fillMaxHeight().background(c.business, RoundedCornerShape(2.dp)))
        }
        Spacer(Modifier.height(4.dp))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(stringResource(if (state.peak) R.string.drawer_peak else R.string.drawer_valley), style = DshType.tiny10,
                color = if (state.peak) c.warnLabel else c.labelTertiary)
            if (state.remain != Duration.ZERO) {
                Text(stringResource(R.string.drawer_remain, remain), style = DshType.tiny10, color = c.labelTertiary)
            }
        }
    }
}
