// 导入后提示需要重启（配合 backup_page.kt 的原子改名 + 自动重启）
const fs = require('fs');
const root = process.argv[2] || '.';
const ZH = root + '/app/src/main/res/values/strings.xml';
const EN = root + '/app/src/main/res/values-en/strings.xml';
const NEEDLE = '<string name="backup_need_restart">';
if (fs.existsSync(ZH) && fs.readFileSync(ZH, 'utf8').includes(NEEDLE)) { console.log('fix72 SKIP'); process.exit(0); }
function add(path, afterNeedle, line, tag) {
  let s = fs.readFileSync(path, 'utf8');
  const i = s.indexOf(afterNeedle);
  if (i < 0) { console.error('ANCHOR ' + tag); process.exit(1); }
  const end = s.indexOf('\n', i) + 1;
  s = s.slice(0, end) + line + '\n' + s.slice(end);
  fs.writeFileSync(path, s);
}
add(ZH, '<string name="backup_done_import">',
  '    <string name="backup_need_restart">数据库已替换，App 会自动关闭，重新打开即可看到会话</string>', 'zh');
add(EN, '<string name="backup_done_import">',
  '    <string name="backup_need_restart">Database replaced. The app will close itself — reopen it to see your sessions.</string>', 'en');
console.log('fix72 OK');
