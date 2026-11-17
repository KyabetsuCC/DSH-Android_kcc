package io.github.jackwener.dsh.core.session

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue

/** USD per 1M tokens for one model. */
data class ModelPrice(val input: Double, val cachedInput: Double, val output: Double)

/**
 * Token -> money, for the cost rows (the engine counts tokens, never money).
 *
 * DeepSeek rows use the peak/off-peak weighted average: peak is Mon-Fri 01:00-04:00 and
 * 06:00-10:00 UTC (7 h x 5 d = 20.8% of the week) and costs twice the off-peak rate, so the
 * average is 1.2083 x off-peak. Currency is USD by default (the official tables are dollars);
 * [currency] switches the display to yuan at [cnyRate].
 */
object Pricing {
    private val table: List<Pair<String, ModelPrice>> = listOf(
        "deepseek-v4.1-flash" to ModelPrice(0.1813, 0.00363, 0.7250),
        "deepseek-v4-pro" to ModelPrice(0.7977, 0.02658, 2.3916),
        "deepseek-flash" to ModelPrice(0.1813, 0.00363, 0.7250),
        "deepseek-v4-flash" to ModelPrice(0.1813, 0.00363, 0.7250),
        "minimax-m3.1-flash" to ModelPrice(0.15, 0.015, 0.6),
        "minimax-m3" to ModelPrice(0.3, 0.06, 1.2),
        "glm-5.3-flash" to ModelPrice(0.15, 0.03, 0.5),
        "glm-5.3" to ModelPrice(1.4, 0.26, 4.4),
        "glm-4.7" to ModelPrice(0.6, 0.11, 2.2),
        "claude-haiku-5-5" to ModelPrice(0.1, 0.01, 0.5),
        "claude-opus-5-5" to ModelPrice(4.0, 0.2, 20.0),
        "claude-sonnet" to ModelPrice(3.0, 0.3, 15.0),
        "gpt-6-astra" to ModelPrice(10.0, 1.0, 50.0),
        "nemotron" to ModelPrice(0.0, 0.0, 0.0),
    )

    /** "USD" or "CNY": what the cost rows print. */
    var currency by mutableStateOf("USD")
    /** Yuan per dollar, used while [currency] is CNY. */
    var cnyRate by mutableStateOf(6.67)
    /** USD per day (YYYY-MM-DD), summed over the models that spent it; filled from usage_model. */
    var dayCosts: Map<String, Double> by mutableStateOf(emptyMap())

    /** The model the open conversation runs; the cost rows price their tokens with it. */
    var model by mutableStateOf<String?>(null)

    fun priceOf(id: String?): ModelPrice? {
        val m = id?.lowercase() ?: return null
        if (m.isEmpty()) return null
        return table.firstOrNull { m.contains(it.first) }?.second
    }

    /** USD for one usage record; null when the model has no price row (nothing is printed then). */
    fun cost(usage: Usage, id: String? = model): Double? {
        if (usage.isEmpty) return null
        val p = priceOf(id) ?: return null
        val prompt = usage.uncached.toDouble() + usage.cacheWrite.toDouble()
        return (prompt * p.input + usage.cacheRead.toDouble() * p.cachedInput + usage.output.toDouble() * p.output) / 1_000_000.0
    }

    fun format(usd: Double): String {
        val cny = currency == "CNY"
        val v = if (cny) usd * cnyRate else usd
        val sym = if (cny) "¥" else "$"
        val body = when {
            v == 0.0 -> "0"
            v >= 1.0 -> String.format(java.util.Locale.US, "%.2f", v)
            v >= 0.01 -> String.format(java.util.Locale.US, "%.3f", v)
            else -> String.format(java.util.Locale.US, "%.4f", v)
        }
        return sym + body
    }
}
