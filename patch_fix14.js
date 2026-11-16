// 用量页 v2：把设置里原有「用量」section 的旧实现替换成新的两页式页面（UsageSection.kt 里的 UsagePage）。
// 旧的 private fun UsageSection(vm: SettingsViewModel) 只保留签名，函数体改为调用 UsagePage()。
const fs = require('fs')
const path = require('path')

const root = process.argv[2] || '.'
const file = path.join(root, 'app/src/main/java/io/github/jackwener/dsh/feature/settings/SettingsScreen.kt')
let src = fs.readFileSync(file, 'utf8')

if (src.includes('UsagePage()')) {
  console.log('SKIP: UsageSection 已经指向 UsagePage')
  process.exit(0)
}

const sig = 'private fun UsageSection(vm: SettingsViewModel) {'
const start = src.indexOf(sig)
if (start < 0) { console.error('ANCHOR 0: 找不到 ' + sig); process.exit(1) }

// 从签名之后逐行找顶格的 "}"（函数结束）
const after = src.indexOf('\n', start) + 1
let end = -1
let i = after
while (i < src.length) {
  const nl = src.indexOf('\n', i)
  const line = src.slice(i, nl < 0 ? src.length : nl)
  if (line === '}') { end = i + 2; break }
  i = (nl < 0 ? src.length : nl + 1)
}
if (end < 0) { console.error('ANCHOR 1: 找不到函数结束'); process.exit(1) }

const body = '    io.github.jackwener.dsh.feature.settings.UsagePage()\n}\n'
src = src.slice(0, after) + body + src.slice(end)

if (!src.includes('UsagePage()')) { console.error('VERIFY 0: 替换后没有 UsagePage'); process.exit(1) }
if (src.includes('usage_cache_hit_short')) { console.error('VERIFY 1: 旧实现仍有残留'); process.exit(1) }
fs.writeFileSync(file, src)
console.log('patched: SettingsScreen.kt UsageSection -> UsagePage()')
