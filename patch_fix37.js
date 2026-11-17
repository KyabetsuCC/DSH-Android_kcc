// 0.0.41: the usage page prices every day with the model(s) that actually spent it.
const fs = require('fs');
const root = process.argv[2] || '.';
const Q = String.fromCharCode(34);
let bad = 0;
const P = root + '/app/src/main/java/io/github/jackwener/dsh/feature/settings/UsageSection.kt';
let s = fs.readFileSync(P, 'utf8');
const rep = (a, b) => { if (!s.includes(a)) { console.log('MISS ' + a.slice(0, 60)); bad++; return; } s = s.replace(a, b); };

if (s.includes('modelDays')) console.log('SKIP usage model wiring');
else {
  rep('import io.github.jackwener.dsh.core.data.UsageEntity',
      'import io.github.jackwener.dsh.core.data.UsageEntity\nimport io.github.jackwener.dsh.core.data.UsageModelDao\nimport io.github.jackwener.dsh.core.data.UsageModelEntity');
  rep('class UsageViewModel @Inject constructor(dao: UsageDao) : androidx.lifecycle.ViewModel() {\n    val days = dao.observe().stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())\n}',
    ['class UsageViewModel @Inject constructor(dao: UsageDao, modelDao: UsageModelDao) : androidx.lifecycle.ViewModel() {',
     '    val days = dao.observe().stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())',
     '    /** Rows per day and model: each day is priced with the models that spent its tokens. */',
     '    val modelDays = modelDao.observe().stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())',
     '}'].join('\n'));

  // UsagePage: keep Pricing.dayCosts in sync with those rows.
  rep('    val days by vm.days.collectAsState()',
    ['    val days by vm.days.collectAsState()',
     '    val modelDays by vm.modelDays.collectAsState()',
     '    androidx.compose.runtime.LaunchedEffect(modelDays) {',
     '        Pricing.dayCosts = modelDays.groupBy { it.day }.mapValues { (_, rows) ->',
     '            rows.sumOf { row ->',
     '                val cached = row.cachedTokens.coerceAtMost(row.inputTokens)',
     '                Pricing.cost(Usage(uncached = (row.inputTokens - cached).coerceAtLeast(0), output = row.outputTokens, cacheRead = cached), row.model) ?: 0.0',
     '            }',
     '        }',
     '    }'].join('\n'));

  // helpers: prefer the recorded per-day, per-model money
  rep('private fun costText(u: UsageEntity): String = Pricing.cost(usageOf(u))?.let { ' + Q + ' · ' + Q + ' + Pricing.format(it) }.orEmpty()',
    'private fun costText(u: UsageEntity): String = (Pricing.dayCosts[u.day] ?: Pricing.cost(usageOf(u)))?.let { ' + Q + ' · ' + Q + ' + Pricing.format(it) }.orEmpty()');
  rep('    Pricing.cost(usageOf(u))?.let { String.format(java.util.Locale.US, ' + Q + '%.6f' + Q + ', it) }.orEmpty()',
    '    (Pricing.dayCosts[u.day] ?: Pricing.cost(usageOf(u)))?.let { String.format(java.util.Locale.US, ' + Q + '%.6f' + Q + ', it) }.orEmpty()');
  rep('private fun monthCost(days: List<UsageEntity>): String {',
    'private fun monthCost(days: List<UsageEntity>): String {\n    if (days.isNotEmpty() && days.all { Pricing.dayCosts.containsKey(it.day) }) return Pricing.format(days.sumOf { Pricing.dayCosts[it.day] ?: 0.0 })');
  fs.writeFileSync(P, s);
  console.log('EDIT usage page');
}
process.exit(bad ? 1 : 0);
