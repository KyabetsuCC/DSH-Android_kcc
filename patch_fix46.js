// 用法: node patch_fix46.js [repoRoot]
// 首页仪表盘：空会话首页在标题下方显示今日/近 30 天的 Token、花费与缓存命中。
const fs = require('fs'), path = require('path');
const root = process.argv[2] || '.';
let bad = 0;
const Q = String.fromCharCode(34);
function read(f) { const p = path.join(root, f); return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null; }
function write(f, s) { fs.writeFileSync(path.join(root, f), s); }
function after(s, anchor, add, tag) {
  const i = s.indexOf(anchor);
  if (i < 0) { console.log('ANCHOR ' + tag); bad++; return s; }
  const j = i + anchor.length;
  return s.slice(0, j) + '\n' + add + s.slice(j);
}

const HOME = 'app/src/main/java/io/github/jackwener/dsh/feature/conversation/HomeScreen.kt';
let s = read(HOME);
if (s === null) { console.log('MISSING ' + HOME); process.exit(1); }
if (s.includes('HomeDashboard()')) console.log('SKIP home');
else {
  // 把 hero 的 28dp 间隔换成「仪表盘 + 12dp」
  const a = '        Spacer(Modifier.height(28.dp))\n        ComposerSlot(vm, composer, settings, live, conv, hero = true';
  const b = '        Spacer(Modifier.height(16.dp))\n        HomeDashboard()\n        Spacer(Modifier.height(12.dp))\n        ComposerSlot(vm, composer, settings, live, conv, hero = true';
  if (s.includes(a)) s = s.replace(a, b);
  else { console.log('ANCHOR hero'); bad++; }
}
write(HOME, s);

const STR = [
  ['app/src/main/res/values/strings.xml', '今日', 'Token', '花费', '命中率', '近 30 天 %1$s Token · %2$s · 命中 %3$s'],
  ['app/src/main/res/values-en/strings.xml', 'Today', 'Tokens', 'Cost', 'Hit rate', 'Last 30 days %1$s tokens · %2$s · %3$s hit'],
  ['app/src/main/res/values-ru/strings.xml', 'Сегодня', 'Токены', 'Стоимость', 'Кэш', 'За 30 дней: %1$s токенов · %2$s · кэш %3$s'],
];
STR.forEach(function (t) {
  const p = path.join(root, t[0]);
  let x = fs.readFileSync(p, 'utf8');
  if (x.includes('name=' + Q + 'dash_today' + Q)) { console.log('SKIP strings ' + t[0]); return; }
  const add = '    <string name=' + Q + 'dash_today' + Q + '>' + t[1] + '</string>\n' +
    '    <string name=' + Q + 'dash_tokens' + Q + '>' + t[2] + '</string>\n' +
    '    <string name=' + Q + 'dash_cost' + Q + '>' + t[3] + '</string>\n' +
    '    <string name=' + Q + 'dash_hit' + Q + '>' + t[4] + '</string>\n' +
    '    <string name=' + Q + 'dash_30d' + Q + '>' + t[5] + '</string>\n';
  x = x.replace('</resources>', add + '</resources>');
  fs.writeFileSync(p, x);
});
console.log(bad === 0 ? 'fix46 done' : ('fix46 FAILED ' + bad));
process.exit(bad === 0 ? 0 : 1);
