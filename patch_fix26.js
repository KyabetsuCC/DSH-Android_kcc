const fs = require('fs'), path = require('path');
const root = process.argv[2] || '.';
let bad = 0, changed = 0;
function edit(file, fn) {
  const p = path.join(root, file);
  if (!fs.existsSync(p)) { console.log('MISSING  ' + file); bad++; return; }
  const src = fs.readFileSync(p, 'utf8'); const out = fn(src);
  if (out === null) { console.log('SKIP     ' + file); return; }
  if (out === src) { console.log('NOCHANGE ' + file); bad++; return; }
  fs.writeFileSync(p, out); console.log('OK       ' + file); changed++;
}
edit('app/src/main/java/io/github/jackwener/dsh/feature/conversation/Composer.kt', (s) => {
  if (s.includes('R.string.menu_newline')) return null;
  const anchor = '                    MenuItem(stringResource(R.string.menu_file), { close(); pickFile.launch(arrayOf("*/*")) }, R.drawable.dsw_paperclip_outline)';
  if (!s.includes(anchor)) { console.log('ANCHOR0 menu_file'); bad++; return null; }
  const line = '                    MenuItem(stringResource(R.string.menu_newline), { close(); state.text = state.text + NEWLINE_CHAR }, R.drawable.ic_enter_outline)';
  return s.replace(anchor, anchor + '\n' + line);
});
const S = { 'values/strings.xml': '换行', 'values-en/strings.xml': 'New line', 'values-ru/strings.xml': 'Новая строка' };
for (const f of Object.keys(S)) {
  edit('app/src/main/res/' + f, (src) => {
    if (src.includes('name="menu_newline"')) return null;
    if (!src.includes('</resources>')) { console.log('ANCHOR0 ' + f); bad++; return null; }
    return src.replace('</resources>', '    <string name="menu_newline">' + S[f] + '</string>\n' + '    <string name="newline_placeholder" translatable="false">x</string>\n</resources>');
  });
}
console.log(bad === 0 ? 'patch_fix26: all done (' + changed + ' files)' : 'patch_fix26: ' + bad + ' problem(s)');
process.exit(bad === 0 ? 0 : 1);
