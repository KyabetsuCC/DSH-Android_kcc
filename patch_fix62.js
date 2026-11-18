// 用法: node patch_fix62.js [repoRoot]
// 去掉俄语：删除 values-ru/ 与 locales_config 里的 ru（保留中英）。
const fs = require('fs'), path = require('path');
const root = process.argv[2] || '.';
let bad = 0;
function p(f) { return path.join(root, f); }

// 1) 删掉整个 values-ru 目录
const RU = p('app/src/main/res/values-ru');
if (fs.existsSync(RU)) {
  fs.rmSync(RU, { recursive: true, force: true });
  console.log('EDIT remove values-ru');
} else {
  console.log('SKIP values-ru');
}

// 2) locales_config 去掉 ru 那一行
const CFG = p('app/src/main/res/xml/locales_config.xml');
if (!fs.existsSync(CFG)) { console.log('ANCHOR locales_config'); bad++; }
else {
  let s = fs.readFileSync(CFG, 'utf8');
  const line = /^[ \t]*<locale android:name="ru" \/>[ \t]*\r?\n/m;
  if (!line.test(s)) { console.log('SKIP locales_config'); }
  else { s = s.replace(line, ''); fs.writeFileSync(CFG, s); console.log('EDIT locales_config -ru'); }
}

// 3) 说明注释里提到的语言列表也顺手更新
const LANG = p('app/src/main/java/io/github/jackwener/dsh/core/platform/AppLanguage.kt');
if (fs.existsSync(LANG)) {
  let s = fs.readFileSync(LANG, 'utf8');
  const before = s;
  s = s.replace('(中文, English)', '(中文, English)');
  if (s !== before) fs.writeFileSync(LANG, s);
}

console.log(bad === 0 ? 'fix62 OK' : ('fix62 BAD ' + bad));
process.exit(bad === 0 ? 0 : 1);
