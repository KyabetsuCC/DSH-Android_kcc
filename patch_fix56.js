// 点输入框下方那排元素时不再收起输入法：把这些菜单改成非聚焦弹窗（不抢窗口焦点）。
const fs = require('fs');
const root = process.argv[2] || '.';
const P = root + '/app/src/main/java/io/github/jackwener/dsh/feature/conversation/Composer.kt';
const M = root + '/app/src/main/java/io/github/jackwener/dsh/feature/conversation/ModeUi.kt';
let bad = 0;
function edit(path, from, to, tag) {
  let s = fs.readFileSync(path, 'utf8');
  if (s.includes(to) && !s.includes(from)) { console.log('SKIP', tag); return; }
  if (!s.includes(from)) { console.log('MISS', tag); bad++; return; }
  s = s.replace(from, to);
  fs.writeFileSync(path, s);
  console.log('EDIT', tag);
}
// 1) 加号菜单
edit(P, 'DMenu(plusOpen || slashOpen, { plusOpen = false; slashOpen = false; if (state.text == "/") state.text = "" }, focusable = !slashOpen) {',
        'DMenu(plusOpen || slashOpen, { plusOpen = false; slashOpen = false; if (state.text == "/") state.text = "" }, focusable = false) {', 'plus');
// 2) 权限预设菜单
edit(P, '                DMenu(presetOpen, { presetOpen = false }) {',
        '                DMenu(presetOpen, { presetOpen = false }, focusable = false) {', 'preset');
// 3) 上下文圆环菜单
edit(P, '        DMenu(open, { open = false }) {',
        '        DMenu(open, { open = false }, focusable = false) {', 'ring');
// 4) 模型菜单：只有带搜索框（模型很多）时才需要焦点
edit(P, '                DMenu(modelOpen, { modelOpen = false }) {\n                    val listed = providers.filter { it.enabled && it.models.isNotEmpty() }\n                    // A long list (many third-party models) gets a search field: model id, display name or provider.\n                    val searchable = ModelSearch.shown(Models.size + listed.sumOf { it.models.size })',
        '                DMenu(modelOpen, { modelOpen = false }, focusable = modelSearchable) {\n                    val listed = providers.filter { it.enabled && it.models.isNotEmpty() }\n                    // A long list (many third-party models) gets a search field: model id, display name or provider.\n                    val searchable = modelSearchable', 'model');
edit(P, '            if (showChips) Box {\n                // Full access is marked by the warn tone',
        '            val modelSearchable = ModelSearch.shown(Models.size + providers.filter { it.enabled && it.models.isNotEmpty() }.sumOf { it.models.size })\n            if (showChips) Box {\n                // Full access is marked by the warn tone', 'model-searchable');
// 5) 会话模式菜单
edit(M, '        DMenu(open, { onOpen(false) }) {',
        '        DMenu(open, { onOpen(false) }, focusable = false) {', 'mode');
if (bad) { console.log('FAILED', bad); process.exit(1); }
console.log('fix56 done');
