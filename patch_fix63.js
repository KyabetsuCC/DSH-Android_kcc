// 用法: node patch_fix63.js [repoRoot]
// 复制页入口放会话右上角（标题栏，搜索键旁边），不放输入栏；点开是全屏浮层。
const fs = require('fs'), path = require('path');
const root = process.argv[2] || '.';
let bad = 0;
function rd(f) { return fs.readFileSync(path.join(root, f), 'utf8'); }
function wr(f, s) { fs.writeFileSync(path.join(root, f), s); }

const HOME = 'app/src/main/java/io/github/jackwener/dsh/feature/conversation/HomeScreen.kt';
let h = rd(HOME);
if (h.includes('copyPageOpen')) console.log('SKIP home copy entry');
else {
  // 1) 状态：跟着 termOpen 一起声明
  const a = '        if (termOpen) io.github.jackwener.dsh.feature.settings.TerminalOverlay(onClose = { termOpen = false })\n';
  const b = '        if (copyPageOpen) CopyPage(conv.turns) { copyPageOpen = false }\n' + a;
  if (!h.includes(a)) { console.log('ANCHOR home term overlay'); bad++; }
  else h = h.replace(a, b);

  // 2) 标题栏入口：搜索键左边
  const c = '            if (!empty) IconBtn(R.drawable.dsw_search_outline, { searchOpen = true }, size = 40.dp, iconSize = 18.dp, tint = c.labelSecondary,\n';
  const d = '            if (!empty) IconBtn(R.drawable.ic_copy, { copyPageOpen = true }, size = 40.dp, iconSize = 18.dp, tint = c.labelSecondary,\n' +
    '                contentDescription = stringResource(R.string.copy_page_title))\n' + c;
  if (!h.includes(c)) { console.log('ANCHOR home search icon'); bad++; }
  else h = h.replace(c, d);

  wr(HOME, h);
  console.log('EDIT home copy entry');
}

// 3) 状态变量声明（和 termOpen 同一处）
let h2 = rd(HOME);
if (h2.includes('var copyPageOpen by remember')) console.log('SKIP home state');
else {
  const m = /( *)var termOpen by remember \{ mutableStateOf\(false\) \}\n/.exec(h2);
  if (!m) { console.log('ANCHOR home termOpen state'); bad++; }
  else h2 = h2.replace(m[0], m[0] + m[1] + 'var copyPageOpen by remember { mutableStateOf(false) }\n');
  wr(HOME, h2);
  console.log('EDIT home state');
}

// 4) 文案
const Q = String.fromCharCode(34);
const STR = [
  ['app/src/main/res/values/strings.xml', [
    ['copy_page_title', '复制页'],
    ['copy_page_all', '回复'],
    ['copy_page_code', '代码'],
    ['copy_page_empty', '这个会话还没有可复制的内容'],
    ['copy_page_item', '第 %1$d 条回复'],
    ['copy_page_item_code', '第 %1$d 条回复 · 代码 %2$d'],
    ['copy_page_newest', '最新的在上面'],
    ['copy_page_oldest', '最早的上面'],
  ]],
  ['app/src/main/res/values-en/strings.xml', [
    ['copy_page_title', 'Copy'],
    ['copy_page_all', 'Replies'],
    ['copy_page_code', 'Code'],
    ['copy_page_empty', 'Nothing to copy in this conversation yet'],
    ['copy_page_item', 'Reply %1$d'],
    ['copy_page_item_code', 'Reply %1$d · code %2$d'],
    ['copy_page_newest', 'Newest first'],
    ['copy_page_oldest', 'Oldest first'],
  ]],
];
STR.forEach(function (pair) {
  const f = pair[0];
  let x = rd(f);
  let added = 0;
  pair[1].forEach(function (kv) {
    const key = 'name=' + Q + kv[0] + Q;
    if (x.includes(key)) return;
    const line = '    <string ' + key + '>' + kv[1] + '</string>\n';
    if (!x.includes('</resources>')) { console.log('ANCHOR resources ' + f); bad++; return; }
    x = x.replace('</resources>', line + '</resources>');
    added++;
  });
  if (added > 0) { wr(f, x); console.log('EDIT strings ' + f + ' +' + added); }
  else console.log('SKIP strings ' + f);
});

console.log(bad === 0 ? 'fix63 OK' : ('fix63 BAD ' + bad));
process.exit(bad === 0 ? 0 : 1);
