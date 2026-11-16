// 用量页 v3 的字符串（三套语言）。插在 </resources> 之前，幂等。
const fs = require('fs')
const path = require('path')
const root = process.argv[2] || '.'
const sets = {
  'values': [
    ['usage_tab_today', '今日'],
    ['usage_tab_overview', '总览'],
    ['usage_total', '累计'],
    ['usage_heatmap', 'Token 用量热力图'],
    ['usage_less', '少'],
    ['usage_more', '多'],
    ['usage_days', '%1$d 天有记录'],
  ],
  'values-en': [
    ['usage_tab_today', 'Today'],
    ['usage_tab_overview', 'Overview'],
    ['usage_total', 'Total'],
    ['usage_heatmap', 'Token usage heatmap'],
    ['usage_less', 'Less'],
    ['usage_more', 'More'],
    ['usage_days', '%1$d days'],
  ],
  'values-ru': [
    ['usage_tab_today', 'Сегодня'],
    ['usage_tab_overview', 'Обзор'],
    ['usage_total', 'Всего'],
    ['usage_heatmap', 'Карта использования токенов'],
    ['usage_less', 'Меньше'],
    ['usage_more', 'Больше'],
    ['usage_days', 'дней: %1$d'],
  ],
}
let changed = 0
for (const [dir, list] of Object.entries(sets)) {
  const f = path.join(root, 'app/src/main/res', dir, 'strings.xml')
  if (!fs.existsSync(f)) { console.error('MISSING ' + f); process.exit(1) }
  let src = fs.readFileSync(f, 'utf8')
  const add = list.filter(([k]) => !src.includes('name="' + k + '"'))
  if (add.length === 0) { console.log('SKIP ' + dir); continue }
  const block = add.map(([k, v]) => '    <string name="' + k + '">' + v + '</string>').join('\n') + '\n'
  src = src.replace('</resources>', block + '</resources>')
  fs.writeFileSync(f, src)
  console.log('patched ' + dir + ' (+' + add.length + ')')
  changed++
}
console.log(changed === 0 ? 'patch_fix15: nothing to do' : 'patch_fix15: done')
