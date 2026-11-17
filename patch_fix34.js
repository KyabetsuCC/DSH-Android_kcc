// 0.0.40: money on the usage page (per-day chip, month total, CSV column).
const fs = require('fs');
const root = process.argv[2] || '.';
const Q = String.fromCharCode(34);
let bad = 0;
const P = 'app/src/main/java/io/github/jackwener/dsh/feature/settings/UsageSection.kt';
let s = fs.readFileSync(root + '/' + P, 'utf8');
if (s.includes('costText(')) console.log('SKIP usage page');
else {
  const rep = (a, b) => { if (!s.includes(a)) { console.log('MISS ' + a.slice(0, 50)); bad++; return; } s = s.replace(a, b); };

  // imports
  rep('import androidx.compose.ui.unit.sp',
      'import androidx.compose.ui.unit.sp\nimport io.github.jackwener.dsh.core.session.Pricing\nimport io.github.jackwener.dsh.core.session.Usage');

  // per-day chip: tokens · hit · money
  rep('                        Text(stringResource(R.string.usage_cache_hit_short, hitRate(u.inputTokens, u.cachedTokens)), style = DshType.mono12, color = c.labelTertiary)',
      '                        Text(stringResource(R.string.usage_cache_hit_short, hitRate(u.inputTokens, u.cachedTokens)) + costText(u), style = DshType.mono12, color = c.labelTertiary)');

  // month cost line
  rep('            stringResource(R.string.usage_month_detail, fmt(cached), fmt(output), hitRate(input, cached)),\n            style = DshType.xs13, color = c.labelSecondary,\n        )',
      '            stringResource(R.string.usage_month_detail, fmt(cached), fmt(output), hitRate(input, cached)),\n            style = DshType.xs13, color = c.labelSecondary,\n        )\n        if (month.isNotEmpty()) {\n            Spacer(Modifier.height(4.dp))\n            Text(\n                stringResource(R.string.usage_month_cost, monthCost(month)),\n                style = DshType.xs13, color = c.labelSecondary,\n            )\n        }');

  // CSV: header + column
  rep('val sb = StringBuilder(' + Q + 'day,input_tokens,cached_tokens,output_tokens,hit_rate\\n' + Q + ')',
      'val sb = StringBuilder(' + Q + 'day,input_tokens,cached_tokens,output_tokens,hit_rate,cost_usd\\n' + Q + ')');
  rep('.append(SEP).append(d.outputTokens).append(SEP).append(hitRate(d.inputTokens, d.cachedTokens)).append(NL)',
      '.append(SEP).append(d.outputTokens).append(SEP).append(hitRate(d.inputTokens, d.cachedTokens)).append(SEP).append(costNum(d)).append(NL)');

  // helpers at end of file
  s += [
    '',
    '/** A usage row as the pricing calculator wants it (cached tokens are already inside input). */',
    'private fun usageOf(u: UsageEntity): Usage {',
    '    val cached = u.cachedTokens.coerceAtMost(u.inputTokens)',
    '    return Usage(uncached = (u.inputTokens - cached).coerceAtLeast(0), output = u.outputTokens, cacheRead = cached)',
    '}',
    '',
    'private fun costText(u: UsageEntity): String = Pricing.cost(usageOf(u))?.let { ' + Q + ' · ' + Q + ' + Pricing.format(it) }.orEmpty()',
    '',
    'private fun costNum(u: UsageEntity): String =',
    '    Pricing.cost(usageOf(u))?.let { String.format(java.util.Locale.US, ' + Q + '%.6f' + Q + ', it) }.orEmpty()',
    '',
    'private fun monthCost(days: List<UsageEntity>): String {',
    '    var acc = Usage()',
    '    for (d in days) acc += usageOf(d)',
    '    return Pricing.cost(acc)?.let { Pricing.format(it) } ?: ' + Q + '-' + Q,
    '}',
    ''
  ].join('\n');
  fs.writeFileSync(root + '/' + P, s);
  console.log('EDIT usage page');
}

const ST = [
  ['values/strings.xml', ['usage_month_cost', '本月费用 %1$s']],
  ['values-en/strings.xml', ['usage_month_cost', 'This month %1$s']],
  ['values-ru/strings.xml', ['usage_month_cost', 'За месяц %1$s']],
];
for (const [f, [k, v]] of ST) {
  const p = root + '/app/src/main/res/' + f;
  let x = fs.readFileSync(p, 'utf8');
  if (x.includes('name=' + Q + k + Q)) { console.log('SKIP ' + f); continue; }
  x = x.replace('</resources>', '    <string name=' + Q + k + Q + '>' + v.replace(/&/g, '&amp;') + '</string>\n</resources>');
  fs.writeFileSync(p, x);
  console.log('EDIT ' + f);
}
const t = fs.readFileSync(root + '/' + P, 'utf8');
if (!t.includes('monthCost(') || !t.includes('cost_usd')) { console.log('CHECK FAIL'); bad++; }
process.exit(bad ? 1 : 0);
