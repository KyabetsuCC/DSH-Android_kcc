// 用法: node patch_fix47.js [repoRoot]
// 侧栏：把「权限与无障碍」换成「扩展」（插件/技能/MCP），可用性更高。
const fs = require('fs'), path = require('path');
const root = process.argv[2] || '.';
let bad = 0;
const Q = String.fromCharCode(34);
function read(f) { const p = path.join(root, f); return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null; }
function write(f, s) { fs.writeFileSync(path.join(root, f), s); }

const DRAWER = 'app/src/main/java/io/github/jackwener/dsh/feature/conversation/SessionDrawer.kt';
let s = read(DRAWER);
if (s === null) { console.log('MISSING ' + DRAWER); process.exit(1); }
if (s.includes('drawer_extensions')) console.log('SKIP drawer');
else {
  const a = '        PanelEntry(R.drawable.dsw_shield_outline, stringResource(R.string.drawer_permissions)) { onSettings(' + Q + 'Phone' + Q + ') }';
  const b = '        PanelEntry(R.drawable.dsw_cordis_plugin_outline, stringResource(R.string.drawer_extensions)) { onSettings(' + Q + 'Extensions' + Q + ') }';
  if (!s.includes(a)) { console.log('ANCHOR drawer entry'); bad++; }
  else s = s.replace(a, b);
}
write(DRAWER, s);

const STR = [
  ['app/src/main/res/values/strings.xml', '扩展'],
  ['app/src/main/res/values-en/strings.xml', 'Extensions'],
  ['app/src/main/res/values-ru/strings.xml', 'Расширения'],
];
STR.forEach(function (t) {
  const p = path.join(root, t[0]);
  let x = fs.readFileSync(p, 'utf8');
  if (x.includes('name=' + Q + 'drawer_extensions' + Q)) { console.log('SKIP strings ' + t[0]); return; }
  x = x.replace('</resources>', '    <string name=' + Q + 'drawer_extensions' + Q + '>' + t[1] + '</string>\n</resources>');
  fs.writeFileSync(p, x);
});
console.log(bad === 0 ? 'fix47 done' : ('fix47 FAILED ' + bad));
process.exit(bad === 0 ? 0 : 1);
