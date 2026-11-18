// 用法: node patch_fix63.js [repoRoot]
// 输入栏右侧加「复制页」入口：点开是全屏浮层，装本会话所有回复，逐条复制 / 一键复制 / 手动选段。
const fs = require('fs'), path = require('path');
const root = process.argv[2] || '.';
let bad = 0;
function rd(f) { return fs.readFileSync(path.join(root, f), 'utf8'); }
function wr(f, s) { fs.writeFileSync(path.join(root, f), s); }

// ---------- 1. Composer：新增参数 + 入口按钮 + 浮层 ----------
const COMPOSER = 'app/src/main/java/io/github/jackwener/dsh/feature/conversation/Composer.kt';
let s = rd(COMPOSER);
if (s.includes('copyPageOpen')) console.log('SKIP composer copy entry');
else {
  // 1a. 参数
  const sigA = '    /** A line about the conversation\'s model shown above the editor (its own model is gone, #53); null = none. */\n    modelNotice: String? = null,\n) {';
  const sigB = '    /** A line about the conversation\'s model shown above the editor (its own model is gone, #53); null = none. */\n    modelNotice: String? = null,\n' +
    '    /** The conversation\'s turns, for the 复制页 (null hides its entry). */\n    copyTurns: List<io.github.jackwener.dsh.core.session.Turn>? = null,\n) {';
  if (!s.includes(sigA)) { console.log('ANCHOR composer sig'); bad++; }
  else s = s.replace(sigA, sigB);

  // 1b. 状态
  const stA = '    var modeOpen by remember { mutableStateOf(false) }\n';
  const stB = '    var modeOpen by remember { mutableStateOf(false) }\n    var copyPageOpen by remember { mutableStateOf(false) }\n';
  if (!s.includes(stA)) { console.log('ANCHOR composer state'); bad++; }
  else s = s.replace(stA, stB);

  // 1c. 入口按钮：麦克风左边
  const btnA = '            if (voice != null) io.github.jackwener.dsh.feature.voice.MicButton(voice)\n';
  const btnB = '            if (copyTurns != null) Box {\n' +
    '                IconBtn(\n' +
    '                    R.drawable.ic_copy, { copyPageOpen = true },\n' +
    '                    size = 32.dp, iconSize = 15.dp, tint = c.labelSecondary,\n' +
    '                    contentDescription = stringResource(R.string.copy_page_title),\n' +
    '                )\n' +
    '            }\n' +
    '            if (voice != null) io.github.jackwener.dsh.feature.voice.MicButton(voice)\n';
  if (!s.includes(btnA)) { console.log('ANCHOR composer button'); bad++; }
  else s = s.replace(btnA, btnB);

  // 1d. 浮层：放在 confirmFull 对话框之前
  const dlgA = '    if (confirmFull) RiskConfirmDialog(\n';
  const dlgB = '    if (copyPageOpen && copyTurns != null) CopyPage(copyTurns) { copyPageOpen = false }\n' +
    '    if (confirmFull) RiskConfirmDialog(\n';
  if (!s.includes(dlgA)) { console.log('ANCHOR composer dialog'); bad++; }
  else s = s.replace(dlgA, dlgB);

  wr(COMPOSER, s);
  console.log('EDIT composer copy entry');
}

// ---------- 2. ComposerSlot：把 turns 传进去 ----------
const HOME = 'app/src/main/java/io/github/jackwener/dsh/feature/conversation/HomeScreen.kt';
let h = rd(HOME);
if (h.includes('copyTurns = conv.turns')) console.log('SKIP home copyTurns');
else {
  const a = '            voice = voice,\n        )\n    }\n}';
  const b = '            voice = voice,\n            copyTurns = conv.turns,\n        )\n    }\n}';
  if (!h.includes(a)) { console.log('ANCHOR home voice'); bad++; }
  else h = h.replace(a, b);
  wr(HOME, h);
  console.log('EDIT home copyTurns');
}

// ---------- 3. 文案 ----------
const Q = String.fromCharCode(34);
const STR = [
  ['app/src/main/res/values/strings.xml', [
    ['copy_page_title', '复制页'],
    ['copy_page_all', '回复'],
    ['copy_page_code', '代码'],
    ['copy_page_empty', '这个会话还没有可复制的内容'],
    ['copy_page_item', '第 %1$d 条回复'],
    ['copy_page_item_code', '第 %1$d 条回复 · 代码 %2$d'],
    ['copy_page_copy_all', '复制全部'],
  ]],
  ['app/src/main/res/values-en/strings.xml', [
    ['copy_page_title', 'Copy'],
    ['copy_page_all', 'Replies'],
    ['copy_page_code', 'Code'],
    ['copy_page_empty', 'Nothing to copy in this conversation yet'],
    ['copy_page_item', 'Reply %1$d'],
    ['copy_page_item_code', 'Reply %1$d · code %2$d'],
    ['copy_page_copy_all', 'Copy all'],
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
