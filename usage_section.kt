package io.github.jackwener.dsh.feature.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.lerp
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import io.github.jackwener.dsh.core.data.UsageDao
import io.github.jackwener.dsh.core.data.UsageEntity
import io.github.jackwener.dsh.core.designsystem.Dsh
import io.github.jackwener.dsh.core.designsystem.DshType
import io.github.jackwener.dsh.core.designsystem.DshColors
import io.github.jackwener.dsh.core.designsystem.Tone
import io.github.jackwener.dsh.core.data.UsageDao
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.stateIn
import io.github.jackwener.dsh.core.designsystem.Tag
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class UsageViewModel @Inject constructor(dao: UsageDao) : ViewModel() {
    val days: StateFlow<List<UsageEntity>> =
        dao.observe().stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
}
private fun fmt(n: Long): String = when {
    n >= 1_000_000_000L -> "%.1fB".format(n / 1_000_000_000.0)
    n >= 1_000_000L -> "%.1fM".format(n / 1_000_000.0)
    n >= 1_000L -> "%.1fK".format(n / 1_000.0)
    else -> n.toString()
}

private fun hitRate(i: Long, c: Long): Int = if (i + c <= 0L) 0 else (c * 100 / (i + c)).toInt()

/** Usage statistics: today at a glance, then the last 30 days either as bars or as a heat map. */
@Composable
fun UsageSection(vm: UsageViewModel = hiltViewModel()) {
    val c = Dsh.colors
    val days by vm.days.collectAsStateWithLifecycle()
    var mode by remember { mutableIntStateOf(0) }
    val today = days.firstOrNull()
    val total = remember(days) { all.fold(longArrayOf(0, 0, 0)) { a, d -> longArrayOf(a[0] + d.inputTokens, a[1] + d.cachedTokens, a[2] + d.outputTokens) } }

    Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp)) {
        Row(Modifier.fillMaxWidth().padding(top = 8.dp, bottom = 12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf("今日", "30 天", "热力图").forEachIndexed { i, label ->
                Tag(label, tone = if (mode == i) io.github.jackwener.dsh.core.designsystem.Tone.Info else io.github.jackwener.dsh.core.designsystem.Tone.Neutral,
                    modifier = Modifier.clickable { mode = i })
            }
        }
        if (today == null) {
            Text("还没有用量记录", style = DshType.s14, color = c.labelTertiary, modifier = Modifier.padding(vertical = 24.dp))
            return@Column
        }
        Card(c) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                stat(c, "输入", fmt(today.inputTokens))
                stat(c, "缓存读取", fmt(today.cachedTokens))
                stat(c, "输出", fmt(today.outputTokens))
            }
            Spacer(Modifier.height(10.dp))
            Text("缓存命中率 ${hitRate(today.inputTokens, today.cachedTokens)}%", style = DshType.s14, color = c.labelSecondary)
            Spacer(Modifier.height(4.dp))
            Text("累计 ${fmt(total[0] + total[1])} tok · 输出 ${fmt(total[2])}", style = DshType.xs13, color = c.labelTertiary)
        }
        Spacer(Modifier.height(16.dp))
        when (mode) {
            0 -> Bars(days, c)
            1 -> Bars(days, c)
            else -> HeatMap(days.reversed(), c)
        }
        Spacer(Modifier.height(24.dp))
    }
}

@Composable
private fun Card(c: DshColors, content: @Composable () -> Unit) {
    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(c.selector).padding(14.dp)) { content() }
}

@Composable
private fun stat(c: DshColors, label: String, value: String) {
    Column {
        Text(value, style = DshType.s14m, color = c.labelPrimary, fontWeight = FontWeight.SemiBold)
        Text(label, style = DshType.xs13, color = c.labelTertiary)
    }
}

@Composable
private fun Bars(days: List<UsageEntity>, c: DshColors) {
    val max = remember(days) { days.maxOfOrNull { it.inputTokens + it.outputTokens } ?: 1L }
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        days.forEach { d ->
            val v = d.inputTokens + d.outputTokens
            Column {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text(d.day, style = DshType.xs13, color = c.labelSecondary)
                    Text("${fmt(v)} tok · 缓存 ${hitRate(d.inputTokens, d.cachedTokens)}%", style = DshType.xs13, color = c.labelTertiary)
                }
                Spacer(Modifier.height(4.dp))
                Box(Modifier.fillMaxWidth().height(6.dp).clip(RoundedCornerShape(3.dp)).background(c.selector)) {
                    Box(Modifier.fillMaxWidth(if (max <= 0L) 0f else (v.toFloat() / max)).height(6.dp).clip(RoundedCornerShape(3.dp)).background(c.business))
                }
            }
        }
    }
}

/** GitHub-style grid: one column per week, one cell per day, darker = more tokens that day. */
@Composable
private fun HeatMap(days: List<UsageEntity>, c: DshColors) {
    val max = remember(days) { days.maxOfOrNull { it.inputTokens + it.outputTokens } ?: 1L }
    val weeks = (days.size + 6) / 7
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        repeat(maxOf(weeks, 1)) { w ->
            Column(verticalArrangement = Arrangement.spacedBy(4.dp), modifier = Modifier.weight(1f)) {
                repeat(7) { d ->
                    val idx = w * 7 + d
                    val v = days.getOrNull(idx)?.let { it.inputTokens + it.outputTokens } ?: 0L
                    val a = if (max <= 0L) 0f else (v.toFloat() / max)
                    Box(
                        Modifier.fillMaxWidth().height(12.dp).clip(RoundedCornerShape(2.dp))
                            .background(if (v == 0L) c.selector else lerp(io.github.jackwener.dsh.core.designsystem.Dsh.colors.business.copy(alpha = 0.25f), c.business, a))
                    )
                }
            }
        }
    }
}
