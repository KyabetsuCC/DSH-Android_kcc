// 用量页 v4：设置section里 UsageSection 已指向 UsagePage（patch_fix14）；这里只做自检。
// 若 workflow 复制了 usage_section.kt，则 SettingsScreen 的 UsageSection 必须调用 UsagePage。
const fs = require('fs')
const path = require('path')
const root = process.argv[2] || '.'
const p = path.join(root, 'app/src/main/java/io/github/jackwener/dsh/feature/settings/UsageSection.kt')
if (!fs.existsSync(p)) { console.error('MISSING UsageSection.kt'); process.exit(1) }
const src = fs.readFileSync(p, 'utf8')
const need = ['fun UsagePage(', 'SettingsCard', 'BoxWithConstraints', 'usage_heatmap']
for (const n of need) if (!src.includes(n)) { console.error('MISSING in UsageSection.kt: ' + n); process.exit(1) }
console.log('patch_fix16: usage page v4 ok')
