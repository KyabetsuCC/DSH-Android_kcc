// 0.0.38: cost currency setting ("$" default, "¥" at the current rate).
const fs = require('fs');
const root = process.argv[2] || '.';
let bad = 0;
const rd = (p) => fs.readFileSync(p, 'utf8');
const wr = (p, s) => fs.writeFileSync(p, s);
function edit(file, fn) {
  const p = root + '/' + file;
  let s; try { s = rd(p); } catch (e) { console.log('MISSING', file); bad++; return; }
  const b = s; s = fn(s);
  if (s === b) { console.log('SKIP', file); return; }
  wr(p, s); console.log('EDIT', file);
}
const must = (n, c) => { if (!c) { console.log('CHECK FAIL', n); bad++; } else console.log('ok', n); };
const Q = String.fromCharCode(34);

edit('app/src/main/java/io/github/jackwener/dsh/core/data/SettingsRepository.kt', (s) => {
  if (s.includes('enterToSend')) { /* other patch owns that */ }
  if (s.includes('val currency: String')) return s;
  s = s.replace('    val busySend: BusySend = BusySend.Queue,',
    '    val busySend: BusySend = BusySend.Queue,\n    /** Cost rows print dollars by default (the official tables are USD); CNY converts at [Pricing.cnyRate]. */\n    val currency: String = ' + Q + 'USD' + Q + ',');
  s = s.replace('        val busySend = stringPreferencesKey(' + Q + 'busy_send' + Q + ')',
    '        val busySend = stringPreferencesKey(' + Q + 'busy_send' + Q + ')\n        val currency = stringPreferencesKey(' + Q + 'currency' + Q + ')');
  s = s.replace('        busySend = this[K.busySend]?.let { v -> BusySend.entries.firstOrNull { it.name == v } } ?: BusySend.Queue,',
    '        busySend = this[K.busySend]?.let { v -> BusySend.entries.firstOrNull { it.name == v } } ?: BusySend.Queue,\n        currency = this[K.currency] ?: ' + Q + 'USD' + Q + ',');
  s = s.replace('    val settings: Flow<Settings> = context.store.data.map { it.toSettings() }',
    '    val settings: Flow<Settings> = context.store.data.map { it.toSettings() }\n        .onEach { io.github.jackwener.dsh.core.session.Pricing.currency = it.currency }');
  if (!s.includes('import kotlinx.coroutines.flow.onEach')) {
    s = s.replace('import kotlinx.coroutines.flow.map', 'import kotlinx.coroutines.flow.map\nimport kotlinx.coroutines.flow.onEach');
  }
  s = s.replace('    suspend fun setBusySend(v: BusySend) = context.store.edit { it[K.busySend] = v.name }',
    '    suspend fun setBusySend(v: BusySend) = context.store.edit { it[K.busySend] = v.name }\n\n    suspend fun setCurrency(v: String) = context.store.edit { it[K.currency] = v }');
  return s;
});

edit('app/src/main/java/io/github/jackwener/dsh/feature/settings/SettingsViewModel.kt', (s) => {
  if (s.includes('fun setCurrency')) return s;
  const a = '    fun setBusySend(b: BusySend) = viewModelScope.launch { repo.setBusySend(b) }';
  if (!s.includes(a)) { console.log('ANCHOR vm-busy'); bad++; return s; }
  return s.replace(a, a + '\n    fun setCurrency(v: String) = viewModelScope.launch { repo.setCurrency(v) }');
});

edit('app/src/main/java/io/github/jackwener/dsh/feature/settings/SettingsScreen.kt', (s) => {
  if (s.includes('set_cost_currency')) return s;
  const a = '    SettingsGroupTitle(stringResource(R.string.set_entry_points))';
  if (!s.includes(a)) { console.log('ANCHOR screen-entry'); bad++; return s; }
  const block = [
    '    SettingsGroupTitle(stringResource(R.string.set_cost_group))',
    '    SettingsCard {',
    '        SettingsRow(stringResource(R.string.set_cost_currency), stringResource(R.string.set_cost_currency_desc), stacked = true) {',
    '            Segmented(listOf(' + Q + '\\$ USD' + Q + ', ' + Q + '¥ CNY' + Q + '), if (s.currency == ' + Q + 'CNY' + Q + ') 1 else 0, { i -> vm.setCurrency(if (i == 1) ' + Q + 'CNY' + Q + ' else ' + Q + 'USD' + Q + ') })',
    '        }',
    '    }',
    ''
  ].join('\n');
  return s.replace(a, block + a);
});

const STR = [
  ['values/strings.xml', '费用', '计价货币', '官方价目表以美元计价；选人民币时按当前汇率换算'],
  ['values-en/strings.xml', 'Cost', 'Currency', 'Official prices are in USD; yuan is converted at the current rate'],
  ['values-ru/strings.xml', 'Стоимость', 'Валюта', 'Официальные цены в долларах; юани по текущему курсу']
];
for (const [f, g, t, d] of STR) {
  edit('app/src/main/res/' + f, (s) => {
    if (s.includes('name=' + Q + 'set_cost_currency' + Q)) return s;
    return s.replace('</resources>', '    <string name=' + Q + 'set_cost_group' + Q + '>' + g + '</string>\n' +
      '    <string name=' + Q + 'set_cost_currency' + Q + '>' + t + '</string>\n' +
      '    <string name=' + Q + 'set_cost_currency_desc' + Q + '>' + d + '</string>\n</resources>');
  });
}

const repo = rd(root + '/app/src/main/java/io/github/jackwener/dsh/core/data/SettingsRepository.kt');
must('settings currency field', repo.includes('val currency: String'));
must('settings key', repo.includes('stringPreferencesKey(' + Q + 'currency' + Q + ')'));
must('settings mapping', repo.includes('currency = this[K.currency]'));
must('pricing sync', repo.includes('Pricing.currency = it.currency'));
const scr = rd(root + '/app/src/main/java/io/github/jackwener/dsh/feature/settings/SettingsScreen.kt');
must('screen currency segmented', scr.includes('set_cost_currency'));
must('screen setter', scr.includes('vm.setCurrency('));
process.exit(bad ? 1 : 0);
