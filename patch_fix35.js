// 0.0.40: context ring shows the cache hit rate beside it and the session's usage in its menu.
const fs = require('fs');
const root = process.argv[2] || '.';
const Q = String.fromCharCode(34);
let bad = 0;
const P = 'app/src/main/java/io/github/jackwener/dsh/feature/conversation/Composer.kt';
let s = fs.readFileSync(root + '/' + P, 'utf8');
if (s.includes('sessionUsage')) console.log('SKIP composer');
else {
  const rep = (a, b) => { if (!s.includes(a)) { console.log('MISS ' + a.slice(0, 60)); bad++; return; } s = s.replace(a, b); };
  const U = 'io.github.jackwener.dsh.core.session.Usage';
  const PR = 'io.github.jackwener.dsh.core.session.Pricing';

  // 1. param on Composer + pass through
  rep('    /** A line about the conversation\'s model shown above the editor (its own model is gone, #53); null = none. */',
      '    /** The session\'s token totals (ring menu): null hides them. */\n    sessionUsage: ' + U + ' = ' + U + '(),\n    /** A line about the conversation\'s model shown above the editor (its own model is gone, #53); null = none. */');
  rep('if (showChips && contextTokens > 0) ContextRing(contextTokens, model.contextWindow, model.contextSource)',
      'if (showChips && contextTokens > 0) ContextRing(contextTokens, model.contextWindow, model.contextSource, sessionUsage)');

  // 2. ContextRing signature
  rep('fun ContextRing(tokens: Long, window: Long, source: io.github.jackwener.dsh.core.provider.LimitSource? = null) {',
      'fun ContextRing(tokens: Long, window: Long, source: io.github.jackwener.dsh.core.provider.LimitSource? = null,\n                usage: ' + U + ' = ' + U + '()) {');

  // 3. hit rate left of the ring
  rep('            Canvas(Modifier.size(14.dp)) {\n                val sw = 2.dp.toPx(); val r = 5.5.dp.toPx()',
      '            val hit = usage.cacheHitRate\n            if (hit != null) {\n                Text("\u26a1" + (hit * 100).toInt() + "%", style = DshType.xxs12, color = c.labelTertiary)\n                Spacer(Modifier.width(3.dp))\n            }\n            Canvas(Modifier.size(14.dp)) {\n                val sw = 2.dp.toPx(); val r = 5.5.dp.toPx()');

  // 4. session stats in the menu
  rep('                // Third-party windows come from /models, the user, or the default: say which.',
      ['                if (!usage.isEmpty) {',
       '                    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {',
       '                        Text(stringResource(R.string.chat_usage), style = DshType.xs13, color = c.labelSecondary)',
       '                        Spacer(Modifier.weight(1f))',
       '                        Text(' + PR + '.cost(usage)?.let { ' + PR + '.format(it) } ?: ' + Q + '-' + Q + ', style = DshType.xs13.copy(fontWeight = FontWeight(600)), color = c.labelPrimary)',
       '                    }',
       '                    Text(' + Q + '\u2191' + Q + ' + Fmt.tokens(usage.input) + ' + Q + '  \u26a1' + Q + ' + Fmt.tokens(usage.cacheRead) + ' + Q + '  \u2193' + Q + ' + Fmt.tokens(usage.output), style = DshType.xxs12, color = c.labelTertiary)',
       '                }',
       '                // Third-party windows come from /models, the user, or the default: say which.'].join('\n'));

  fs.writeFileSync(root + '/' + P, s);
  console.log('EDIT composer');
}

// pass conv.usage from ComposerSlot (HomeScreen)
const HS = 'app/src/main/java/io/github/jackwener/dsh/feature/conversation/HomeScreen.kt';
let h = fs.readFileSync(root + '/' + HS, 'utf8');
if (h.includes('sessionUsage = conv.usage')) console.log('SKIP homescreen');
else {
  const a = '            onStop = { if (vm is HomeViewModel) vm.requestStop() else vm.stop() },';
  if (!h.includes(a)) { console.log('MISS onStop'); bad++; }
  else h = h.replace(a, a + '\n            sessionUsage = conv.usage,');
  fs.writeFileSync(root + '/' + HS, h);
  console.log('EDIT homescreen');
}

const ST = [
  ['values/strings.xml', ['chat_usage', '本会话用量']],
  ['values-en/strings.xml', ['chat_usage', 'Session usage']],
  ['values-ru/strings.xml', ['chat_usage', 'Расход сессии']],
];
for (const [f, [k, v]] of ST) {
  const p = root + '/app/src/main/res/' + f;
  let x = fs.readFileSync(p, 'utf8');
  if (x.includes('name=' + Q + k + Q)) { console.log('SKIP ' + f); continue; }
  x = x.replace('</resources>', '    <string name=' + Q + k + Q + '>' + v + '</string>\n</resources>');
  fs.writeFileSync(p, x);
  console.log('EDIT ' + f);
}
const t = fs.readFileSync(root + '/' + P, 'utf8');
if (!t.includes('chat_usage') || !t.includes('usage.cacheHitRate')) { console.log('CHECK FAIL'); bad++; }
process.exit(bad ? 1 : 0);
