package io.github.jackwener.dsh.feature.conversation

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
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import io.github.jackwener.dsh.R
import io.github.jackwener.dsh.core.data.UsageDao
import io.github.jackwener.dsh.core.data.UsageEntity
import io.github.jackwener.dsh.core.designsystem.Dsh
import io.github.jackwener.dsh.core.designsystem.DshType
import io.github.jackwener.dsh.core.designsystem.SettingsCard
import io.github.jackwener.dsh.core.session.Pricing
import io.github.jackwener.dsh.core.session.Usage
import java.time.LocalDate
import javax.inject.Inject
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.stateIn

@HiltViewModel
class HomeDashboardViewModel @Inject constructor(dao: UsageDao) : ViewModel() {
    val days = dao.observe().stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
}

private fun compact(n: Long): String = when {
    n >= 1_000_000_000L -> String.format(java.util.Locale.US, "%.1fB", n / 1_000_000_000.0)
    n >= 1_000_000L -> String.format(java.util.Locale.US, "%.1fM", n / 1_000_000.0)
    n >= 1_000L -> String.format(java.util.Locale.US, "%.1fK", n / 1_000.0)
    else -> n.toString()
}

private fun usageOf(u: UsageEntity) = Usage(
    uncached = (u.inputTokens - u.cachedTokens).coerceAtLeast(0),
    output = u.outputTokens,
    cacheRead = u.cachedTokens,
)

/** Empty-home dashboard: today + 30-day tokens, spend and cache hit rate. */
@Composable
fun HomeDashboard(vm: HomeDashboardViewModel = hiltViewModel()) {
    val days by vm.days.collectAsStateWithLifecycle()
    if (days.isEmpty()) return
    val c = Dsh.colors
    val todayKey = LocalDate.now().toString()
    val today = days.firstOrNull { it.day == todayKey }
    var sum = Usage()
    var cost = 0.0
    days.forEach { sum += usageOf(it); cost += Pricing.cost(usageOf(it)) ?: 0.0 }
    val todayUsage = today?.let { usageOf(it) } ?: Usage()
    val todayCost = today?.let { Pricing.cost(usageOf(it)) } ?: null
    val hit = sum.cacheHitRate
    Column(Modifier.fillMaxWidth().padding(horizontal = 8.dp)) {
        SettingsCard {
            Column(Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 12.dp)) {
                Text(stringResource(R.string.dash_today), style = DshType.tiny10, color = c.labelTertiary)
                Spacer(Modifier.height(6.dp))
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    DashCell(compact(todayUsage.total), stringResource(R.string.dash_tokens), Modifier.weight(1f))
                    DashCell(todayCost?.let { Pricing.format(it) } ?: "—", stringResource(R.string.dash_cost), Modifier.weight(1f))
                    DashCell(todayUsage.cacheHitRate?.let { (it * 100).toInt().toString() + "%" } ?: "—", stringResource(R.string.dash_hit), Modifier.weight(1f))
                }
                Spacer(Modifier.height(10.dp))
                Text(
                    stringResource(R.string.dash_30d, compact(sum.total), Pricing.format(cost), hit?.let { (it * 100).toInt().toString() + "%" } ?: "—"),
                    style = DshType.tiny10, color = c.labelTertiary,
                )
            }
        }
    }
}

@Composable
private fun DashCell(value: String, label: String, modifier: Modifier) {
    val c = Dsh.colors
    Column(modifier, horizontalAlignment = androidx.compose.ui.Alignment.CenterHorizontally) {
        Text(value, style = DshType.s14m, color = c.labelPrimary, maxLines = 1, textAlign = TextAlign.Center)
        Text(label, style = DshType.tiny10, color = c.labelTertiary, maxLines = 1, textAlign = TextAlign.Center)
    }
}
