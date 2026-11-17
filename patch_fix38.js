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
  ['/app/src/main/res/values/strings.xml', '模型', '仅统计有模型记录的部分（%1$d 天，%2$s 起）；更早的用量没有记录模型',
    [['usage_range_day', '日'], ['usage_range_month', '月'], ['usage_range_all', '总']]],
  ['/app/src/main/res/values-en/strings.xml', 'Models', 'Only the part with a recorded model (%1$d days since %2$s); older usage recorded no model',
    [['usage_range_day', 'Day'], ['usage_range_month', 'Month'], ['usage_range_all', 'All']]],
  ['/app/src/main/res/values-ru/strings.xml', 'Модели', 'Только записи с моделью (%1$d дн. с %2$s); у старого расхода модели нет',
    [['usage_range_day', 'День'], ['usage_range_month', 'Месяц'], ['usage_range_all', 'Всё']]],
];
strings.forEach(([rel, label, note, extra]) => {
  const p = root + rel;
  let x = fs.readFileSync(p, 'utf8');
  if (x.includes('name="usage_range_all"')) { console.log('SKIP ' + rel); return; }
  if (!x.includes('</resources>')) { console.log('MISS ' + rel); bad++; return; }
  const add = (x.includes('name="usage_models"') ? '' : '    <string name="usage_models">' + label + '</string>\n') +
    (x.includes('name="usage_models_note"') ? '' : '    <string name="usage_models_note">' + note + '</string>\n') +
    extra.map(([k, v]) => '    <string name="' + k + '">' + v + '</string>\n').join('');
  x = x.replace('</resources>', add + '</resources>');
  fs.writeFileSync(p, x);
  console.log('EDIT ' + rel);
});
process.exit(bad ? 1 : 0);
