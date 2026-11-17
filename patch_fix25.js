const fs = require('fs'), path = require('path');
const root = process.argv[2] || '.';
let bad = 0, changed = 0;
const S = {
  'values/strings.xml': ['本月', '本月合计', '缓存 %1$s · 输出 %2$s · 命中率 %3$s', '导出 CSV'],
  'values-en/strings.xml': ['This month', 'This month', 'cached %1$s · out %2$s · hit %3$s', 'Export CSV'],
  'values-ru/strings.xml': ['Этот месяц', 'За месяц', 'кэш %1$s · выход %2$s · попаданий %3$s', 'Экспорт CSV'],
};
for (const f of Object.keys(S)) {
  const p = path.join(root, 'app/src/main/res/' + f);
  if (!fs.existsSync(p)) { console.log('MISSING  ' + f); bad++; continue; }
  let src = fs.readFileSync(p, 'utf8');
  if (src.includes('name="usage_month"')) { console.log('SKIP     ' + f); continue; }
  if (!src.includes('</resources>')) { console.log('ANCHOR0 ' + f); bad++; continue; }
  const [m, mt, md, ex] = S[f];
  const add = '    <string name="usage_month">' + m + '</string>\n'
    + '    <string name="usage_month_total">' + mt + '</string>\n'
    + '    <string name="usage_month_detail">' + md + '</string>\n'
    + '    <string name="usage_export_csv">' + ex + '</string>\n</resources>';
  fs.writeFileSync(p, src.replace('</resources>', add));
  console.log('OK       ' + f); changed++;
}
console.log(bad === 0 ? 'patch_fix25: all done (' + changed + ' files)' : 'patch_fix25: ' + bad + ' problem(s)');
process.exit(bad === 0 ? 0 : 1);
