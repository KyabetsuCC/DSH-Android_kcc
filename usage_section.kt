package io.github.jackwener.dsh.feature.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.setValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import io.github.jackwener.dsh.R
import io.github.jackwener.dsh.core.data.UsageDao
import io.github.jackwener.dsh.core.data.UsageEntity
import io.github.jackwener.dsh.core.designsystem.Dsh
import io.github.jackwener.dsh.core.designsystem.DshType
import io.github.jackwener.dsh.core.designsystem.SettingsCard
import io.github.jackwener.dsh.core.designsystem.Segmented
import io.github.jackwener.dsh.core.designsystem.SettingsGroupTitle
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.format.TextStyle
import java.util.Locale
import javax.inject.Inject
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.stateIn

@HiltViewModel
class UsageViewModel @Inject constructor(dao: UsageDao) : androidx.lifecycle.ViewModel() {
    val days = dao.observe().stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
}

private fun fmt(v: Long): String = when {
    v >= 1_000_000_000L -> String.format(Locale.US, "%.1fB", v / 1_000_000_000.0)
    v >= 1_000_000L -> String.format(Locale.US, "%.1fM", v / 1_000_000.0)
    v >= 1_000L -> String.format(Locale.US, "%.1fK", v / 1_000.0)
    else -> v.toString()
}

private fun hitRate(input: Long, cached: Long): String =
    if (input <= 0L) "0%" else "${(cached * 100.0 / input).toInt()}%"

@Composable
fun UsagePage(vm: UsageViewModel = hiltViewModel()) {
    val c = Dsh.colors
    val days by vm.days.collectAsState()
    if (days.isEmpty()) {
        SettingsGroupTitle(stringResource(R.string.usage_today))
        SettingsCard {
            Text(
                stringResource(R.string.usage_none), style = DshType.s14, color = c.labelTertiary,
                modifier = Modifier.padding(16.dp),
            )
        }
        return
    }
    var tab by remember { mutableIntStateOf(0) }
    Spacer(Modifier.height(8.dp))
    Segmented(
        listOf(stringResource(R.string.usage_tab_today), stringResource(R.string.usage_tab_overview)),
        tab, { tab = it },
    )
    val today = days.firstOrNull()
    val total = remember(days) {
        days.fold(longArrayOf(0, 0, 0)) { a, d -> longArrayOf(a[0] + d.inputTokens, a[1] + d.cachedTokens, a[2] + d.outputTokens) }
    }
    Spacer(Modifier.height(2.dp))
    if (tab == 0) {
        SettingsGroupTitle(stringResource(R.string.usage_today))
        SettingsCard {
            Stats(today?.inputTokens ?: 0L, today?.cachedTokens ?: 0L, today?.outputTokens ?: 0L)
            Text(
                stringResource(R.string.usage_cache_hit) + " " + hitRate(today?.inputTokens ?: 0L, today?.cachedTokens ?: 0L),
                style = DshType.xs13, color = c.labelSecondary,
                modifier = Modifier.padding(start = 16.dp, end = 16.dp, bottom = 14.dp),
            )
        }
    
        SettingsGroupTitle(stringResource(R.string.usage_30d))
        SettingsCard { Bars(days) }
    } else {
        SettingsGroupTitle(stringResource(R.string.usage_total))
        SettingsCard {
            Stats(total[0], total[1], total[2])
            Text(
                stringResource(R.string.usage_cache_hit) + " " + hitRate(total[0], total[1]) + " · " +
                    fmt(total[0] + total[2]) + " tok · " + stringResource(R.string.usage_days, days.size),
                style = DshType.xs13, color = c.labelSecondary,
                modifier = Modifier.padding(start = 16.dp, end = 16.dp, bottom = 14.dp),
            )
        }
        SettingsGroupTitle(stringResource(R.string.usage_heatmap))
        SettingsCard { HeatMap(days) }
    }
}

@Composable
private fun Stats(input: Long, cached: Long, output: Long) {
    Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 16.dp)) {
        StatCell(stringResource(R.string.usage_input), fmt(input), Modifier.weight(1f))
        StatCell(stringResource(R.string.usage_cached), fmt(cached), Modifier.weight(1f))
        StatCell(stringResource(R.string.usage_output), fmt(output), Modifier.weight(1f))
    }
}

@Composable
private fun StatCell(label: String, value: String, modifier: Modifier = Modifier) {
    val c = Dsh.colors
    Column(modifier) {
        Text(value, style = DshType.s14m.copy(fontSize = 20.sp), color = c.labelPrimary, maxLines = 1)
        Spacer(Modifier.height(4.dp))
        Text(label, style = DshType.xs13, color = c.labelTertiary, maxLines = 1)
    }
}

@Composable
private fun Bars(days: List<UsageEntity>) {
    val c = Dsh.colors
    val max = remember(days) { days.maxOfOrNull { it.inputTokens + it.outputTokens }?.coerceAtLeast(1L) ?: 1L }
    Column(Modifier.padding(vertical = 8.dp)) {
        days.forEach { u ->
            val v = u.inputTokens + u.outputTokens
            Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp)) {
                Text(u.day.removePrefix("20"), Modifier.width(48.dp), style = DshType.xs13, color = c.labelSecondary)
                Column(Modifier.weight(1f)) {
                    Row {
                        Text(fmt(v) + " tok", Modifier.weight(1f), style = DshType.mono12, color = c.labelPrimary)
                        Text(stringResource(R.string.usage_cache_hit_short, hitRate(u.inputTokens, u.cachedTokens)), style = DshType.mono12, color = c.labelTertiary)
                    }
                    Spacer(Modifier.height(4.dp))
                    Box(Modifier.fillMaxWidth().height(4.dp).clip(RoundedCornerShape(2.dp)).background(c.borderL2)) {
                        Box(
                            Modifier.fillMaxWidth((v.toFloat() / max).coerceIn(0.02f, 1f)).height(4.dp)
                                .clip(RoundedCornerShape(2.dp)).background(c.kindMessages),
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun HeatMap(days: List<UsageEntity>) {
    val c = Dsh.colors
    val byDay = remember(days) { days.associate { it.day to (it.inputTokens + it.outputTokens) } }
    val max = remember(days) { days.maxOfOrNull { it.inputTokens + it.outputTokens }?.coerceAtLeast(1L) ?: 1L }
    val today = remember { LocalDate.now() }
    val locale = remember { Locale.getDefault() }
    val weeks = 53
    val start = remember(today) { today.minusDays((today.dayOfWeek.value - 1).toLong()).minusWeeks((weeks - 1).toLong()) }
    BoxWithConstraints(Modifier.fillMaxWidth().padding(start = 12.dp, end = 12.dp, top = 14.dp, bottom = 10.dp)) {
        val labelW = 26.dp
        val gap = 1.dp
        val cell = ((maxWidth - labelW - gap * (weeks - 1)) / weeks).coerceAtLeast(1.dp)
        val round = RoundedCornerShape((cell.value * 0.32f).coerceIn(0.8f, 3f).dp)
        Column {
            Row(Modifier.padding(start = labelW)) {
                repeat(weeks) { w ->
                    val d = start.plusDays((w * 7).toLong())
                    val prev = start.plusDays(((w - 1) * 7).toLong())
                    val fresh = w == 0 || d.monthValue != prev.monthValue
                    Box(Modifier.width(cell + gap)) {
                        if (fresh) {
                            Text(
                                d.month.getDisplayName(TextStyle.SHORT, locale),
                                style = DshType.xs13.copy(fontSize = 9.sp), color = c.labelTertiary,
                                maxLines = 1, overflow = TextOverflow.Visible,
                            )
                        }
                    }
                }
            }
            Spacer(Modifier.height(3.dp))
            Row {
                Column(Modifier.width(labelW).padding(end = 4.dp), verticalArrangement = Arrangement.spacedBy(gap)) {
                    repeat(7) { i ->
                        Box(Modifier.height(cell).fillMaxWidth()) {
                            if (i % 2 == 0) {
                                Text(
                                    DayOfWeek.of(i + 1).getDisplayName(TextStyle.SHORT, locale),
                                    style = DshType.xs13.copy(fontSize = 8.sp), color = c.labelTertiary,
                                    maxLines = 1, overflow = TextOverflow.Visible,
                                )
                            }
                        }
                    }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(gap)) {
                    repeat(weeks) { w ->
                        Column(verticalArrangement = Arrangement.spacedBy(gap)) {
                            repeat(7) { d ->
                                val date = start.plusDays((w * 7 + d).toLong())
                                val v = byDay[date.toString()] ?: 0L
                                val t = (v.toFloat() / max).coerceIn(0f, 1f)
                                val color = if (v <= 0L) c.borderL2 else lerp(c.borderL2, c.kindMessages, 0.3f + 0.7f * t)
                                Box(Modifier.size(cell).clip(round).background(color))
                            }
                        }
                    }
                }
            }
            Spacer(Modifier.height(10.dp))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                Text(stringResource(R.string.usage_less), style = DshType.xs13.copy(fontSize = 10.sp), color = c.labelTertiary)
                Spacer(Modifier.width(6.dp))
                listOf(0f, 0.25f, 0.5f, 0.75f, 1f).forEach { t ->
                    Box(Modifier.size(9.dp).clip(RoundedCornerShape(2.dp)).background(lerp(c.borderL2, c.kindMessages, t)))
                    Spacer(Modifier.width(2.dp))
                }
                Spacer(Modifier.width(4.dp))
                Text(stringResource(R.string.usage_more), style = DshType.xs13.copy(fontSize = 10.sp), color = c.labelTertiary)
            }
        }
    }
}
