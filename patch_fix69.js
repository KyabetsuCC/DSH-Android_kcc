// 0.1.10: a home button - back to the blank start page (address bar + quick links) at any time.
const fs = require('fs')
const root = process.argv[2] || '.'
const KEYS = [['browser_home', '首页', 'Home'], ['browser_search_hint', '搜索或输入网址', 'Search or type an address']]
for (const [file, idx] of [['/app/src/main/res/values/strings.xml', 1], ['/app/src/main/res/values-en/strings.xml', 2]]) {
  const p = root + file
  let s = fs.readFileSync(p, 'utf8')
  if (s.includes('name="browser_home"')) { console.log('  SKIP strings ' + file); continue }
  const add = KEYS.map((k) => '    <string name="' + k[0] + '">' + k[idx] + '</string>\n').join('')
  fs.writeFileSync(p, s.replace('</resources>', add + '</resources>'))
  console.log('  EDIT strings ' + file)
}
console.log('fix69 OK')
