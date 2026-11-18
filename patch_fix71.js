// 0.1.12: the bottom-right globe opens a small menu instead of silently reloading.
const fs = require('fs')
const root = process.argv[2] || '.'
const KEYS = [
  ['browser_menu', '更多', 'More'],
  ['browser_on', '已开启', 'On'],
  ['browser_off', '已关闭', 'Off'],
]
for (const [file, idx] of [['/app/src/main/res/values/strings.xml', 1], ['/app/src/main/res/values-en/strings.xml', 2]]) {
  const p = root + file
  let s = fs.readFileSync(p, 'utf8')
  if (s.includes('name="browser_menu"')) { console.log('  SKIP strings ' + file); continue }
  const add = KEYS.map((k) => '    <string name="' + k[0] + '">' + k[idx] + '</string>\n').join('')
  fs.writeFileSync(p, s.replace('</resources>', add + '</resources>'))
  console.log('  EDIT strings ' + file)
}
console.log('fix71 OK')
