// 0.0.48: heatmap caption + strings.
const fs = require('fs');
const root = process.argv[2] || '.';
let bad = 0;
const sets = [
  ['/app/src/main/res/values/strings.xml', '最近 %1$d 周的每日用量'],
  ['/app/src/main/res/values-en/strings.xml', 'Daily usage over the last %1$d weeks'],
  ['/app/src/main/res/values-ru/strings.xml', 'Ежедневный расход за %1$d нед.'],
];
sets.forEach(([rel, note]) => {
  const p = root + rel;
  let x = fs.readFileSync(p, 'utf8');
  if (x.includes('name="usage_heatmap_note"')) { console.log('SKIP ' + rel); return; }
  if (!x.includes('</resources>')) { console.log('MISS ' + rel); bad++; return; }
  x = x.replace('</resources>', '    <string name="usage_heatmap_note">' + note + '</string>\n</resources>');
  fs.writeFileSync(p, x);
  console.log('EDIT ' + rel);
});
process.exit(bad ? 1 : 0);
