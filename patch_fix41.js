// 0.0.47: usage page strings for the chart toggle and the "other" model row.
const fs = require('fs');
const root = process.argv[2] || '.';
let bad = 0;
const sets = [
  ['/app/src/main/res/values/strings.xml', '费用', '其他'],
  ['/app/src/main/res/values-en/strings.xml', 'Cost', 'Other'],
  ['/app/src/main/res/values-ru/strings.xml', 'Стоимость', 'Другое'],
];
sets.forEach(([rel, cost, other]) => {
  const p = root + rel;
  let x = fs.readFileSync(p, 'utf8');
  if (x.includes('name="usage_other"')) { console.log('SKIP ' + rel); return; }
  if (!x.includes('</resources>')) { console.log('MISS ' + rel); bad++; return; }
  x = x.replace('</resources>',
    '    <string name="usage_chart_cost">' + cost + '</string>\n' +
    '    <string name="usage_other">' + other + '</string>\n</resources>');
  fs.writeFileSync(p, x);
  console.log('EDIT ' + rel);
});
process.exit(bad ? 1 : 0);
