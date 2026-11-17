package io.github.jackwener.dsh.feature.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
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
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.github.jackwener.dsh.core.session.Pricing
import io.github.jackwener.dsh.core.session.Usage
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import io.github.jackwener.dsh.R
import io.github.jackwener.dsh.core.data.UsageDao
import io.github.jackwener.dsh.core.data.UsageEntity
import io.github.jackwener.dsh.core.data.UsageModelDao
import io.github.jackwener.dsh.core.data.UsageModelEntity
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
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import android.net.Uri
import kotlinx.coroutines.flow.stateIn

@HiltViewModel
class UsageViewModel @Inject constructor(dao: UsageDao, modelDao: UsageModelDao) : androidx.lifecycle.ViewModel() {
    val days = dao.observe().stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
    /** Rows per day and model: each day is priced with the models that spent its tokens. */
    val modelDays = modelDao.observe().stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
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
    val modelDays by vm.modelDays.collectAsState()
    androidx.compose.runtime.LaunchedEffect(modelDays) {
        Pricing.dayCosts = modelDays.groupBy { it.day }.mapValues { (_, rows) ->
            rows.sumOf { row ->
                val cached = row.cachedTokens.coerceAtMost(row.inputTokens)
                Pricing.cost(Usage(uncached = (row.inputTokens - cached).coerceAtLeast(0), output = row.outputTokens, cacheRead = cached), row.model) ?: 0.0
            }
        }
    }
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
        listOf(stringResource(R.string.usage_tab_today), stringResource(R.string.usage_models), stringResource(R.string.usage_tab_overview)),
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
    } else if (tab == 2) {
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
        SettingsGroupTitle(stringResource(R.string.usage_month))
        SettingsCard { MonthSummary(days) }
    } else {
        ModelsTab(modelDays)
    }
}


@Composable
private fun ModelsTab(all: List<UsageModelEntity>) {
    val c = Dsh.colors
    var range by remember { mutableIntStateOf(1) }
    val today = remember { java.time.LocalDate.now().toString() }
    val month = today.substring(0, 7)
    val rows = remember(all, range) {
        when (range) {
            0 -> all.filter { it.day == today }
            1 -> all.filter { it.day.startsWith(month) }
            else -> all
        }
    }
    Segmented(
        listOf(
            stringResource(R.string.usage_range_day),
            stringResource(R.string.usage_range_month),
            stringResource(R.string.usage_range_all),
        ),
        range, { range = it }, compact = true,
    )
    val agg = remember(rows) {
        rows.groupBy { it.model.substringAfterLast('/').lowercase().let { k -> if (k.isBlank() || k == "auto") OTHER_ROW else k } }.map { (name, list) ->
            var input = 0L
            var cached = 0L
            var output = 0L
            var cost = 0.0
            list.forEach { r ->
                input += r.inputTokens
                cached += r.cachedTokens
                output += r.outputTokens
                val hit = r.cachedTokens.coerceAtMost(r.inputTokens)
                cost += Pricing.cost(Usage(uncached = (r.inputTokens - hit).coerceAtLeast(0), output = r.outputTokens, cacheRead = hit), r.model) ?: 0.0
            }
            ModelRowData(name, input, cached.coerceAtMost(input), output, cost)
        }.sortedWith(compareBy({ it.name == OTHER_ROW }, { -(it.input + it.output) }))
    }
    if (agg.isEmpty()) {
        SettingsGroupTitle(stringResource(R.string.usage_models))
        SettingsCard {
            Text(stringResource(R.string.usage_none), style = DshType.s14, color = c.labelTertiary, modifier = Modifier.padding(16.dp))
        }
        return
    }
    val peak = (agg.firstOrNull()?.let { it.input + it.output } ?: 1L).coerceAtLeast(1L)
    val sumIn = agg.sumOf { it.input }
    val sumCached = agg.sumOf { it.cached }
    val sumOut = agg.sumOf { it.output }
    SettingsGroupTitle(stringResource(R.string.usage_total))
    SettingsCard {
        Stats(sumIn, sumCached, sumOut)
        Text(
            stringResource(R.string.usage_cache_hit) + " " + hitRate(sumIn, sumCached) + " · " +
                Pricing.format(agg.sumOf { it.cost }) + " · " + fmt(sumIn + sumOut) + " tok",
            style = DshType.xs13, color = c.labelSecondary,
            modifier = Modifier.padding(start = 16.dp, end = 16.dp, bottom = 14.dp),
        )
    }
    SettingsGroupTitle(stringResource(R.string.usage_models))
    Text(
        stringResource(R.string.usage_models_note, rows.map { it.day }.distinct().size, rows.minOfOrNull { it.day } ?: "-"),
        Modifier.padding(start = 4.dp, end = 4.dp, bottom = 8.dp), style = DshType.xs13, color = c.labelTertiary,
    )
    SettingsCard {
        Column(Modifier.padding(vertical = 6.dp)) {
            agg.forEach { m ->
                var open by remember(m.name) { mutableStateOf(false) }
                Column(Modifier.fillMaxWidth().clickable { open = !open }.padding(horizontal = 16.dp, vertical = 8.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            if (m.name == OTHER_ROW) stringResource(R.string.usage_other) else m.name,
                            Modifier.weight(1f), style = DshType.s14, color = c.labelPrimary,
                            maxLines = 1, overflow = TextOverflow.Ellipsis,
                        )
                        Text(Pricing.format(m.cost), style = DshType.mono12, color = c.labelPrimary)
                        Text(
                            fmt(m.input + m.output), Modifier.width(62.dp), style = DshType.mono12,
                            color = c.labelTertiary, textAlign = TextAlign.End,
                        )
                    }
                    Spacer(Modifier.height(4.dp))
                    Box(Modifier.fillMaxWidth().height(4.dp).clip(RoundedCornerShape(2.dp)).background(c.borderL2)) {
                        Box(
                            Modifier.fillMaxWidth(((m.input + m.output).toFloat() / peak).coerceIn(0.02f, 1f)).height(4.dp)
                                .clip(RoundedCornerShape(2.dp)).background(c.kindMessages),
                        )
                    }
                    if (open) {
                        Text(
                            stringResource(R.string.usage_cache_hit) + " " + hitRate(m.input, m.cached) + " · ↑" + fmt(m.input) +
                                " ⚡" + fmt(m.cached) + " ↓" + fmt(m.output),
                            Modifier.padding(top = 6.dp), style = DshType.xs13, color = c.labelSecondary,
                        )
                    }
                }
            }
        }
    }
}

private data class ModelRowData(val name: String, val input: Long, val cached: Long, val output: Long, val cost: Double)

/** Provider prefixes ("group/", "auto/", "minimaxai/") are dropped: only the exact model name counts. */
private fun modelKey(id: String): String = id.substringAfterLast('/').lowercase()

/** "auto" is a routing placeholder without a model name: those rows are grouped under "other". */
private const val OTHER_ROW = "__other__"

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
    var metric by remember { mutableIntStateOf(0) }
    var open by remember { mutableStateOf<String?>(null) }
    val values = remember(days, metric) {
        days.map { u ->
            if (metric == 0) (u.inputTokens + u.outputTokens).toDouble()
            else (Pricing.dayCosts[u.day] ?: Pricing.cost(usageOf(u)) ?: 0.0)
        }
    }
    val max = (values.maxOrNull() ?: 0.0).coerceAtLeast(if (metric == 0) 1.0 else 0.000001)
    Column(Modifier.padding(vertical = 8.dp)) {
        Row(Modifier.padding(horizontal = 16.dp, vertical = 2.dp)) {
            Segmented(
                listOf(stringResource(R.string.usage_tokens), stringResource(R.string.usage_chart_cost)),
                metric, { metric = it }, Modifier.weight(1f), compact = true,
            )
        }
        days.forEachIndexed { i, u ->
            val v = values[i]
            val label = if (metric == 0) fmt(u.inputTokens + u.outputTokens) + " tok" else Pricing.format(v)
            Column(Modifier.fillMaxWidth().clickable { open = if (open == u.day) null else u.day }) {
                Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp)) {
                    Text(u.day.removePrefix("20"), Modifier.width(48.dp), style = DshType.xs13, color = c.labelSecondary)
                    Column(Modifier.weight(1f)) {
                        Row {
                            Text(label, Modifier.weight(1f), style = DshType.mono12, color = c.labelPrimary)
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(costText(u).removePrefix(SEP_PREFIX), Modifier.width(56.dp), style = DshType.mono12, color = c.labelPrimary, textAlign = TextAlign.End)
                                Text(stringResource(R.string.usage_cache_hit_short, hitRate(u.inputTokens, u.cachedTokens)), Modifier.width(78.dp), style = DshType.mono12, color = c.labelTertiary, textAlign = TextAlign.End)
                            }
                        }
                        Spacer(Modifier.height(4.dp))
                        Box(Modifier.fillMaxWidth().height(4.dp).clip(RoundedCornerShape(2.dp)).background(c.borderL2)) {
                            Box(
                                Modifier.fillMaxWidth(((v / max).toFloat()).coerceIn(0.02f, 1f)).height(4.dp)
                                    .clip(RoundedCornerShape(2.dp)).background(c.kindMessages),
                            )
                        }
                    }
                }
                if (open == u.day) {
                    Text(
                        stringResource(R.string.usage_input) + " " + fmt(u.inputTokens) + " · " +
                            stringResource(R.string.usage_cached) + " " + fmt(u.cachedTokens) + " · " +
                            stringResource(R.string.usage_output) + " " + fmt(u.outputTokens) + " · " +
                            stringResource(R.string.usage_cache_hit) + " " + hitRate(u.inputTokens, u.cachedTokens),
                        style = DshType.xs13, color = c.labelSecondary,
                        modifier = Modifier.padding(start = 64.dp, end = 16.dp, bottom = 8.dp),
                    )
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

/** 本月汇总（含当月每日柱形图）+ 导出 CSV（按天一行，含命中率）。 */
@Composable
private fun MonthSummary(days: List<UsageEntity>) {
    val c = Dsh.colors
    val ctx = LocalContext.current
    val today = remember { LocalDate.now() }
    val month = remember(days) { days.filter { it.day.startsWith(today.toString().substring(0, 7)) } }
    val input = month.sumOf { it.inputTokens }
    val cached = month.sumOf { it.cachedTokens }
    val output = month.sumOf { it.outputTokens }
    val launcher = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("text/csv")) { uri: Uri? ->
        if (uri == null) return@rememberLauncherForActivityResult
        runCatching {
            ctx.contentResolver.openOutputStream(uri)?.use { out ->
                val sb = StringBuilder("day,input_tokens,cached_tokens,output_tokens,hit_rate,cost_usd\n")
                for (d in days.sortedBy { it.day }) {
                    sb.append(d.day).append(SEP).append(d.inputTokens).append(SEP).append(d.cachedTokens)
                        .append(SEP).append(d.outputTokens).append(SEP).append(hitRate(d.inputTokens, d.cachedTokens)).append(SEP).append(costNum(d)).append(NL)
                }
                out.write(sb.toString().toByteArray())
            }
        }
    }
    Column(Modifier.fillMaxWidth().padding(16.dp)) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Bottom) {
            Text(fmt(input + output), style = DshType.s14m.copy(fontSize = 18.sp), color = c.labelPrimary)
            Spacer(Modifier.width(8.dp))
            Text(stringResource(R.string.usage_month_meta, month.size), style = DshType.xs13, color = c.labelSecondary, modifier = Modifier.padding(bottom = 2.dp))
        }
        Spacer(Modifier.height(6.dp))
        Text(
            stringResource(R.string.usage_month_detail, fmt(cached), fmt(output), hitRate(input, cached)),
            style = DshType.xs13, color = c.labelSecondary,
        )
        if (month.isNotEmpty()) {
            Spacer(Modifier.height(4.dp))
            Text(
                stringResource(R.string.usage_month_cost, monthCost(month)),
                style = DshType.xs13, color = c.labelSecondary,
            )
        }
        Spacer(Modifier.height(14.dp))
        MonthBars(days, today)
        Spacer(Modifier.height(14.dp))
        Text(
            stringResource(R.string.usage_export_csv),
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(9.dp))
                .background(c.selector)
                .clickable { launcher.launch("dsh-usage-" + today + ".csv") }
                .padding(vertical = 10.dp),
            style = DshType.s14m, color = c.labelPrimary, textAlign = TextAlign.Center,
        )
    }
}

/** 当月 1..N 日（N = 当月真实天数）的 token 柱形图。 */
@Composable
private fun MonthBars(days: List<UsageEntity>, today: LocalDate) {
    val c = Dsh.colors
    val len = today.lengthOfMonth()
    val byDay = remember(days) { days.associateBy { it.day } }
    var metric by remember { mutableIntStateOf(0) }
    var sel by remember { mutableIntStateOf(today.dayOfMonth) }
    val values = remember(days, len) {
        (1..len).map { d -> byDay[today.withDayOfMonth(d).toString()] }
    }
    val nums = remember(values, metric) {
        values.map { e ->
            when {
                e == null -> 0.0
                metric == 0 -> (e.inputTokens + e.outputTokens).toDouble()
                else -> Pricing.dayCosts[e.day] ?: Pricing.cost(usageOf(e)) ?: 0.0
            }
        }
    }
    val peak = (nums.maxOrNull() ?: 0.0).coerceAtLeast(if (metric == 0) 1.0 else 0.000001)
    Segmented(
        listOf(stringResource(R.string.usage_tokens), stringResource(R.string.usage_chart_cost)),
        metric, { metric = it }, compact = true,
    )
    Spacer(Modifier.height(6.dp))
    Row(Modifier.fillMaxWidth().height(58.dp), horizontalArrangement = Arrangement.spacedBy(1.dp)) {
        nums.forEachIndexed { i, v ->
            val on = sel == i + 1
            Box(
                Modifier.weight(1f).fillMaxHeight().clickable { sel = i + 1 },
                contentAlignment = Alignment.BottomCenter,
            ) {
                val h = if (v <= 0.0) 2.dp else ((56f * (v / peak).toFloat()).coerceAtLeast(3f)).dp
                Box(
                    Modifier.fillMaxWidth().height(h).clip(RoundedCornerShape(1.5.dp))
                        .background(if (v <= 0.0) c.borderL2 else if (on) c.kindMessages else c.business),
                )
            }
        }
    }
    Spacer(Modifier.height(4.dp))
    Row(Modifier.fillMaxWidth()) {
        Text("1", style = DshType.tiny10, color = c.labelTertiary)
        Spacer(Modifier.weight(1f))
        Text(today.dayOfMonth.toString(), style = DshType.tiny10, color = c.labelSecondary)
        Spacer(Modifier.weight(1f))
        Text(len.toString(), style = DshType.tiny10, color = c.labelTertiary)
    }
    val picked = today.withDayOfMonth(sel).toString()
    val e = byDay[picked]
    Spacer(Modifier.height(6.dp))
    Text(
        picked.removePrefix("20") + " · " +
            if (e == null) stringResource(R.string.usage_none)
            else stringResource(R.string.usage_input) + " " + fmt(e.inputTokens) + " · " +
                stringResource(R.string.usage_cached) + " " + fmt(e.cachedTokens) + " · " +
                stringResource(R.string.usage_output) + " " + fmt(e.outputTokens) + " · " +
                stringResource(R.string.usage_cache_hit) + " " + hitRate(e.inputTokens, e.cachedTokens) + " · " +
                (Pricing.dayCosts[picked]?.let { Pricing.format(it) } ?: costText(e).removePrefix(SEP_PREFIX)),
        style = DshType.xs13, color = c.labelSecondary,
    )
}

private const val SEP = ','
private const val NL = '\n'

/** A usage row as the pricing calculator wants it (cached tokens are already inside input). */
private fun usageOf(u: UsageEntity): Usage {
    val cached = u.cachedTokens.coerceAtMost(u.inputTokens)
    return Usage(uncached = (u.inputTokens - cached).coerceAtLeast(0), output = u.outputTokens, cacheRead = cached)
}

private const val SEP_PREFIX = " · "

private fun costText(u: UsageEntity): String = (Pricing.dayCosts[u.day] ?: Pricing.cost(usageOf(u)))?.let { " · " + Pricing.format(it) }.orEmpty()

private fun costNum(u: UsageEntity): String =
    (Pricing.dayCosts[u.day] ?: Pricing.cost(usageOf(u)))?.let { String.format(java.util.Locale.US, "%.6f", it) }.orEmpty()

private fun monthCost(days: List<UsageEntity>): String {
    if (days.isNotEmpty() && days.all { Pricing.dayCosts.containsKey(it.day) }) return Pricing.format(days.sumOf { Pricing.dayCosts[it.day] ?: 0.0 })
    var acc = Usage()
    for (d in days) acc += usageOf(d)
    return Pricing.cost(acc)?.let { Pricing.format(it) } ?: "-"
}
