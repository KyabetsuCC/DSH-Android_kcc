// 用法: node patch_fix48.js [repoRoot]
// 侧栏底部卡片：今日花费 / 今日 Token / DeepSeek 峰谷时段进度。
const fs = require('fs'), path = require('path');
const root = process.argv[2] || '.';
const Q = String.fromCharCode(34);
let bad = 0;
const DRAWER = 'app/src/main/java/io/github/jackwener/dsh/feature/conversation/SessionDrawer.kt';
let s = fs.readFileSync(path.join(root, DRAWER), 'utf8');
if (s.includes('DrawerStats()')) console.log('SKIP drawer stats');
else {
  const a = '        // dsh sidebar footer: the account launcher';
  if (!s.includes(a)) { console.log('ANCHOR drawer stats'); bad++; }
  else s = s.replace(a, '        DrawerStats()\n' + a);
}
fs.writeFileSync(path.join(root, DRAWER), s);

const STR = [
  ['app/src/main/res/values/strings.xml',
   [['drawer_today', '今日'], ['drawer_tokens', 'Token'], ['drawer_peak', '峰时'], ['drawer_valley', '谷时'], ['drawer_remain', '剩余 %1$s']]],
  ['app/src/main/res/values-en/strings.xml',
   [['drawer_today', 'Today'], ['drawer_tokens', 'Tokens'], ['drawer_peak', 'Peak'], ['drawer_valley', 'Off-peak'], ['drawer_remain', '%1$s left']]],
  ['app/src/main/res/values-ru/strings.xml',
   [['drawer_today', 'Сегодня'], ['drawer_tokens', 'Токены'], ['drawer_peak', 'Пик'], ['drawer_valley', 'Вне пика'], ['drawer_remain', 'осталось %1$s']]],
];
STR.forEach(function (t) {
  const p = path.join(root, t[0]);
  let x = fs.readFileSync(p, 'utf8');
  if (x.includes('name=' + Q + 'drawer_remain' + Q)) { console.log('SKIP strings ' + t[0]); return; }
  let add = '';
  t[1].forEach(function (kv) { add += '    <string name=' + Q + kv[0] + Q + '>' + kv[1] + '</string>\n'; });
  x = x.replace('</resources>', add + '</resources>');
  fs.writeFileSync(p, x);
});
console.log(bad === 0 ? 'fix48 done' : ('fix48 FAILED ' + bad));
process.exit(bad === 0 ? 0 : 1);
