// 0.1.11: tabs + editable shortcuts on the browser start page.
const fs = require('fs')
const root = process.argv[2] || '.'
const KEYS = [
  ['browser_tabs', '标签页', 'Tabs'],
  ['browser_tab_new', '新建标签页', 'New tab'],
  ['browser_tab_close', '关闭', 'Close'],
  ['browser_add_bookmark', '添加收藏', 'Add'],
  ['browser_bookmark_label', '名称', 'Name'],
  ['browser_bookmark_url', '网址', 'Address'],
  ['browser_bookmark_delete', '删除', 'Delete'],
  ['browser_bookmark_note', '长按收藏可删除。这里放的是你准备交给 AI 的站点，先自己登录好。', 'Long-press a shortcut to remove it. Put here the sites you sign in to before handing the browser to the agent.'],
]
for (const [file, idx] of [['/app/src/main/res/values/strings.xml', 1], ['/app/src/main/res/values-en/strings.xml', 2]]) {
  const p = root + file
  let s = fs.readFileSync(p, 'utf8')
  if (s.includes('name="browser_tabs"')) { console.log('  SKIP strings ' + file); continue }
  const add = KEYS.map((k) => '    <string name="' + k[0] + '">' + k[idx] + '</string>\n').join('')
  fs.writeFileSync(p, s.replace('</resources>', add + '</resources>'))
  console.log('  EDIT strings ' + file)
}
console.log('fix70 OK')
