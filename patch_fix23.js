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
function need(src, s, what) { if (!src.includes(s)) { console.log('ANCHOR0 ' + what); bad++; return false; } return true; }

edit('app/src/main/java/io/github/jackwener/dsh/feature/settings/SettingsScreen.kt', (src) => {
  if (src.includes('SettingsSection.Backup')) return null;
  let s = src;
  if (!need(s, 'Usage(R.string.set_usage, R.drawable.dsw_gauge_outline), Phone(', 'enum usage')) return null;
  s = s.replace('Usage(R.string.set_usage, R.drawable.dsw_gauge_outline), Phone(',
    'Usage(R.string.set_usage, R.drawable.dsw_gauge_outline),\n    Backup(R.string.set_backup, R.drawable.dsw_archive_outline), Phone(');
  if (!need(s, 'SettingsSection.Usage -> UsageSection(vm)', 'when usage')) return null;
  s = s.replace('SettingsSection.Usage -> UsageSection(vm)',
    'SettingsSection.Usage -> UsageSection(vm)\n            SettingsSection.Backup -> BackupPage()');
  return s;
});

for (const f of ['values/strings.xml', 'values-en/strings.xml', 'values-ru/strings.xml']) {
  edit('app/src/main/res/' + f, (src) => {
    if (src.includes('name="set_backup"')) return null;
    const zh = f.startsWith('values/'), en = f.startsWith('values-en/');
    const val = zh ? '备份' : (en ? 'Backup' : 'Резервная копия');
    if (!need(src, '</resources>', f)) return null;
    return src.replace('</resources>', '    <string name="set_backup">' + val + '</string>\n</resources>');
  });
}
console.log(bad === 0 ? 'patch_fix23: all done (' + changed + ' files)' : 'patch_fix23: ' + bad + ' problem(s)');
process.exit(bad === 0 ? 0 : 1);
