// 0.0.44: usage_model keeps the bare model name (no provider prefix) + a "模型" string set.
const fs = require('fs');
const root = process.argv[2] || '.';
const D = '/app/src/main/java/io/github/jackwener/dsh';
let bad = 0;

const SS = root + '/' + D + '/core/session/SessionStore.kt';
let s = fs.readFileSync(SS, 'utf8');
const a = 'val model = data.o("message")?.o("source")?.s("model") ?: Pricing.model ?: return';
const b = 'val model = (data.o("message")?.o("source")?.s("model") ?: Pricing.model ?: return).substringAfterLast(\'/\')';
if (s.includes(b)) console.log('SKIP store');
else if (!s.includes(a)) { console.log('MISS store'); bad++; }
else { fs.writeFileSync(SS, s.replace(a, b)); console.log('EDIT store'); }

const strings = [
  ['/app/src/main/res/values/strings.xml', '模型'],
  ['/app/src/main/res/values-en/strings.xml', 'Models'],
  ['/app/src/main/res/values-ru/strings.xml', 'Модели'],
];
strings.forEach(([rel, label]) => {
  const p = root + rel;
  let x = fs.readFileSync(p, 'utf8');
  if (x.includes('name="usage_models"')) { console.log('SKIP ' + rel); return; }
  if (!x.includes('</resources>')) { console.log('MISS ' + rel); bad++; return; }
  x = x.replace('</resources>', '    <string name="usage_models">' + label + '</string>\n</resources>');
  fs.writeFileSync(p, x);
  console.log('EDIT ' + rel);
});
process.exit(bad ? 1 : 0);
