package io.github.jackwener.dsh.feature.conversation

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import io.github.jackwener.dsh.R
import io.github.jackwener.dsh.core.data.UsageDao
import io.github.jackwener.dsh.core.data.UsageEntity
import io.github.jackwener.dsh.core.data.UsageModelDao
import io.github.jackwener.dsh.core.data.UsageModelEntity
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
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.stateIn

@HiltViewModel
class DrawerStatsViewModel @Inject constructor(dao: UsageDao, modelDao: UsageModelDao) : ViewModel() {
    val days = dao.observe().stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
    /** Per-day, per-model rows: the card prices the day with the models that spent it, not the open session's. */
    val modelDays = modelDao.observe().stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
}

/** 一天里的峰/谷状态：峰时 = UTC 01:00-04:00 与 06:00-10:00 的周一至周五。 */
private data class PeakState(val peak: Boolean, val remain: Duration, val minute: Int, val segments: List<IntRange>)

private fun peakState(now: ZonedDateTime): PeakState {
    val utc = now.withZoneSameInstant(ZoneOffset.UTC)
    val weekday = utc.dayOfWeek.value <= 5
    val shift = now.offset.totalSeconds / 60
    fun local(m: Int): Int = (((m + shift) % 1440) + 1440) % 1440
    val segs = if (weekday) listOf(local(60) until local(240), local(360) until local(600)) else emptyList()
    val minute = now.hour * 60 + now.minute
    segs.forEach { seg ->
        if (minute in seg) return PeakState(true, Duration.ofMinutes((seg.last + 1 - minute).toLong()), minute, segs)
    }
    val later = segs.map { it.first }.filter { it > minute }.minOrNull()
    val base = segs.firstOrNull()?.first ?: local(60)
    val next = later ?: (1440 + base)
    return PeakState(false, Duration.ofMinutes((next - minute).toLong()), minute, segs)
}

private fun usageOf(u: UsageEntity?): Usage =
    if (u == null) Usage() else Usage(uncached = (u.inputTokens - u.cachedTokens).coerceAtLeast(0L), output = u.outputTokens, cacheRead = u.cachedTokens)

private fun usageOfModel(row: UsageModelEntity): Usage {
    val cached = row.cachedTokens.coerceAtMost(row.inputTokens)
    return Usage(uncached = (row.inputTokens - cached).coerceAtLeast(0L), output = row.outputTokens, cacheRead = cached)
}

private fun compact(n: Long): String {
    val v = n.toDouble()
    return when {
        n >= 1_000_000_000L -> String.format(java.util.Locale.US, "%.2fB", v / 1_000_000_000.0)
        n >= 1_000_000L -> String.format(java.util.Locale.US, "%.1fM", v / 1_000_000.0)
        n >= 1_000L -> String.format(java.util.Locale.US, "%.1fK", v / 1_000.0)
        else -> n.toString()
    }
}

/** 侧栏底部卡片：今日花费 / 今日 Token / 峰谷时段（24 小时条，实时走动）。 */
@Composable
fun DrawerStats(vm: DrawerStatsViewModel = hiltViewModel()) {
    val c = Dsh.colors
    val days by vm.days.collectAsStateWithLifecycle()
    val modelDays by vm.modelDays.collectAsStateWithLifecycle()
    val today = LocalDate.now().toString()
    val usage = remember(days) { usageOf(days.firstOrNull { it.day == today }) }
    val cost = remember(days, modelDays) {
        val rows = modelDays
        val mine = rows.filter { it.day == today }
        val value = if (mine.isNotEmpty()) {
            mine.sumOf { Pricing.cost(usageOfModel(it), it.model) ?: 0.0 }
        } else {
            val fallback = rows.groupBy { it.model }.maxByOrNull { (_, v) -> v.sumOf { r -> r.inputTokens + r.outputTokens } }?.key
            Pricing.cost(usage, fallback) ?: 0.0
        }
        Pricing.format(value)
    }
    val now by produceState(initialValue = ZonedDateTime.now()) {
        while (true) {
            value = ZonedDateTime.now()
            delay(15_000)
        }
    }
    val state = remember(now) { peakState(now) }
    val rh = state.remain.toHours()
    val rm = state.remain.toMinutes() % 60
    val remain = if (rh > 0) "${rh}h ${rm}m" else "${rm}m"
    Column(Modifier.fillMaxWidth().clip(Radius.md).background(c.bgLayer2).padding(horizontal = 10.dp, vertical = 8.dp)) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(stringResource(R.string.drawer_today), style = DshType.tiny10, color = c.labelTertiary)
                Text(cost, style = DshType.s14m, color = c.labelPrimary)
            }
            Column(horizontalAlignment = Alignment.End) {
                Text(stringResource(R.string.drawer_tokens), style = DshType.tiny10, color = c.labelTertiary)
                Text(compact(usage.total), style = DshType.s14m, color = c.labelPrimary)
            }
        }
        Spacer(Modifier.height(8.dp))
        Canvas(Modifier.fillMaxWidth().height(8.dp)) {
            val h = size.height
            val r = CornerRadius(h / 2f, h / 2f)
            drawRoundRect(color = c.business.copy(alpha = 0.45f), cornerRadius = r)
            state.segments.forEach { seg ->
                drawRoundRect(
                    color = c.warn,
                    topLeft = Offset(size.width * (seg.first / 1440f), 0f),
                    size = Size(size.width * ((seg.last + 1 - seg.first) / 1440f), h),
                    cornerRadius = CornerRadius(2f, 2f),
                )
            }
            val x = (size.width * (state.minute / 1440f)).coerceIn(1f, size.width - 1f)
            drawRoundRect(color = c.labelPrimary, topLeft = Offset(x - 1f, -1f), size = Size(2f, h + 2f), cornerRadius = CornerRadius(1f, 1f))
        }
        Spacer(Modifier.height(5.dp))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(
                stringResource(if (state.peak) R.string.drawer_peak else R.string.drawer_valley),
                style = DshType.tiny10,
                color = if (state.peak) c.warnLabel else c.labelTertiary,
            )
            Text(stringResource(R.string.drawer_remain, remain), style = DshType.tiny10, color = c.labelTertiary)
        }
    }
}
