package io.github.jackwener.dsh.feature.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
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
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import io.github.jackwener.dsh.core.data.UsageDao
import io.github.jackwener.dsh.core.designsystem.Dsh
import io.github.jackwener.dsh.core.designsystem.DshType
import io.github.jackwener.dsh.core.designsystem.Segmented
import javax.inject.Inject
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.stateIn
import java.time.LocalDate

@HiltViewModel
class UsageViewModel @Inject constructor(dao: UsageDao) : androidx.lifecycle.ViewModel() {
    val days = dao.observe().stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
}

private fun fmt(v: Long): String = when {
    v >= 1_000_000_000L -> String.format("%.1fB", v / 1_000_000_000.0)
    v >= 1_000_000L -> String.format("%.1fM", v / 1_000_000.0)
    v >= 1_000L -> String.format("%.1fK", v / 1_000.0)
    else -> v.toString()
}

private fun hitRate(input: Long, cached: Long): String =
    if (input <= 0L) "0%" else "${(cached * 100.0 / input).toInt()}%"

@Composable
fun UsagePage(vm: UsageViewModel = hiltViewModel()) {
    val c = Dsh.colors
    val days by vm.days.collectAsState()
    var tab by remember { mutableIntStateOf(0) }
    Spacer(Modifier.height(10.dp))
    Segmented(listOf("今日", "总览"), tab, { tab = it })
    Spacer(Modifier.height(14.dp))
    if (days.isEmpty()) {
        Text("还没有用量记录", style = DshType.s14, color = c.labelTertiary, modifier = Modifier.padding(vertical = 24.dp))
        return
    }
    if (tab == 0) TodayPane(days) else OverviewPane(days)
}

@Composable
private fun TodayPane(days: List<io.github.jackwener.dsh.core.data.UsageEntity>) {
    val c = Dsh.colors
    val today = days.firstOrNull()
    GroupTitle("今日")
    Panel {
        Row(Modifier.padding(16.dp).fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Kv("输入", fmt(today?.inputTokens ?: 0L))
            Kv("缓存读取", fmt(today?.cachedTokens ?: 0L))
            Kv("输出", fmt(today?.outputTokens ?: 0L))
        }
        Text(
            "缓存命中率 " + hitRate(today?.inputTokens ?: 0L, today?.cachedTokens ?: 0L),
            style = DshType.xs13, color = c.labelSecondary, modifier = Modifier.padding(start = 16.dp, bottom = 14.dp),
        )
    }
    Spacer(Modifier.height(18.dp))
    GroupTitle("最近 30 天")
    Panel { Bars(days) }
}

@Composable
private fun OverviewPane(days: List<io.github.jackwener.dsh.core.data.UsageEntity>) {
    val c = Dsh.colors
    val total = remember(days) {
        days.fold(longArrayOf(0, 0, 0)) { a, d -> longArrayOf(a[0] + d.inputTokens, a[1] + d.cachedTokens, a[2] + d.outputTokens) }
    }
    GroupTitle("累计")
    Panel {
        Row(Modifier.padding(16.dp).fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Kv("输入", fmt(total[0]))
            Kv("缓存读取", fmt(total[1]))
            Kv("输出", fmt(total[2]))
        }
        Text(
            "命中率 " + hitRate(total[0], total[1]) + " · 共 " + fmt(total[0] + total[2]) + " tok · " + days.size + " 天有记录",
            style = DshType.xs13, color = c.labelSecondary, modifier = Modifier.padding(start = 16.dp, bottom = 14.dp),
        )
    }
    Spacer(Modifier.height(18.dp))
    GroupTitle("热力图")
    Panel { HeatMap(days) }
}

@Composable
private fun Kv(label: String, value: String) {
    val c = Dsh.colors
    Column {
        Text(value, style = DshType.s14m, color = c.labelPrimary)
        Spacer(Modifier.height(2.dp))
        Text(label, style = DshType.xs13, color = c.labelTertiary)
    }
}

@Composable
private fun Bars(days: List<io.github.jackwener.dsh.core.data.UsageEntity>) {
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
                        Text("缓存 " + hitRate(u.inputTokens, u.cachedTokens), style = DshType.mono12, color = c.labelTertiary)
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
private fun HeatMap(days: List<io.github.jackwener.dsh.core.data.UsageEntity>) {
    val c = Dsh.colors
    val byDay = remember(days) { days.associate { it.day to (it.inputTokens + it.outputTokens) } }
    val max = remember(days) { days.maxOfOrNull { it.inputTokens + it.outputTokens }?.coerceAtLeast(1L) ?: 1L }
    val today = remember { LocalDate.now() }
    val start = remember(today) { today.minusDays((today.dayOfWeek.value - 1).toLong()).minusWeeks(15L) }
    Row(Modifier.padding(16.dp), horizontalArrangement = Arrangement.spacedBy(3.dp)) {
        repeat(16) { w ->
            Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
                repeat(7) { d ->
                    val date = start.plusDays((w * 7 + d).toLong())
                    val v = byDay[date.toString()] ?: 0L
                    val t = (v.toFloat() / max).coerceIn(0f, 1f)
                    val color = if (v <= 0L) c.borderL2 else lerp(c.borderL2, c.kindMessages, 0.3f + 0.7f * t)
                    Box(Modifier.size(11.dp).clip(RoundedCornerShape(2.dp)).background(color))
                }
            }
        }
    }
}

@Composable
private fun GroupTitle(text: String) {
    val c = Dsh.colors
    Text(text, style = DshType.xs13m, color = c.labelTertiary, modifier = Modifier.padding(top = 4.dp, bottom = 8.dp))
}

@Composable
private fun Panel(content: @Composable () -> Unit) {
    val c = Dsh.colors
    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(c.selector)) { content() }
}
