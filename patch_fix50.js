// 用法: node patch_fix50.js [repoRoot]
// 会话内搜索结果计数的文案。
const fs = require('fs'), path = require('path');
const root = process.argv[2] || '.';
const Q = String.fromCharCode(34);
const STR = [
  ['app/src/main/res/values/strings.xml', '共 %1$d 条结果'],
  ['app/src/main/res/values-en/strings.xml', '%1$d results'],
  ['app/src/main/res/values-ru/strings.xml', 'совпадений: %1$d'],
];
STR.forEach(function (t) {
  const p = path.join(root, t[0]);
  let x = fs.readFileSync(p, 'utf8');
  if (x.includes('name=' + Q + 'search_hits' + Q)) { console.log('SKIP strings ' + t[0]); return; }
  x = x.replace('</resources>', '    <string name=' + Q + 'search_hits' + Q + '>' + t[1] + '</string>\n</resources>');
  fs.writeFileSync(p, x);
});
console.log('fix50 done');
