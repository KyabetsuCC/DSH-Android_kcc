// 用法: node patch_fix45.js [repoRoot]
// 会话内搜索：标题栏放大镜 → 全屏搜索层（匹配用户与 AI 文本，点结果跳到那一轮）。
const fs = require('fs'), path = require('path');
const root = process.argv[2] || '.';
let bad = 0;
const Q = String.fromCharCode(34);
function read(f) { const p = path.join(root, f); return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null; }
function write(f, s) { fs.writeFileSync(path.join(root, f), s); }
function before(s, anchor, add, tag) {
  const i = s.indexOf(anchor);
  if (i < 0) { console.log('ANCHOR ' + tag); bad++; return s; }
  return s.slice(0, i) + add + s.slice(i);
}

/* ---------- HomeScreen ---------- */
const HOME = 'app/src/main/java/io/github/jackwener/dsh/feature/conversation/HomeScreen.kt';
let s = read(HOME);
if (s === null) { console.log('MISSING ' + HOME); process.exit(1); }
if (s.includes('SessionSearchOverlay')) console.log('SKIP home');
else {
  s = before(s, '    val waitingOnUser = live.approval != null',
    '    var searchOpen by remember { androidx.compose.runtime.mutableStateOf(false) }\n', 'home state');
  s = before(s, '            if (!empty) IconBtn(R.drawable.dsw_new_chat_outline,',
    '            if (!empty) IconBtn(R.drawable.dsw_search_outline, { searchOpen = true }, size = 40.dp, iconSize = 18.dp, tint = c.labelSecondary,\n' +
    '                contentDescription = stringResource(R.string.search_in_session))\n', 'home icon');
  s = before(s, '        if (!empty && view == SessionView.Chat) BottomDock(',
    '        if (searchOpen) SessionSearchOverlay(conv.turns, onClose = { searchOpen = false },\n' +
    '            onPick = { idx -> searchOpen = false; StreamJump.request(idx) })\n', 'home overlay');
}
write(HOME, s);

/* ---------- Stream: react to a search jump ---------- */
const STREAM = 'app/src/main/java/io/github/jackwener/dsh/feature/conversation/Stream.kt';
s = read(STREAM);
if (s.includes('StreamJump.seq')) console.log('SKIP stream');
else {
  s = before(s, '    Box(modifier) {\n',
    '    // 会话内搜索：请求跳转到第 idx 轮（items 顺序与 turns 一致）。\n' +
    '    val jumpSeq = StreamJump.seq\n' +
    '    val jumpIndex = StreamJump.index\n' +
    '    LaunchedEffect(jumpSeq) { if (jumpSeq > 0 && jumpIndex >= 0) listState.scrollToItem(jumpIndex) }\n', 'stream jump');
}
write(STREAM, s);

/* ---------- strings ---------- */
const STR = [
  ['app/src/main/res/values/strings.xml', '会话内搜索', '没有匹配的内容'],
  ['app/src/main/res/values-en/strings.xml', 'Search in conversation', 'No matches'],
  ['app/src/main/res/values-ru/strings.xml', 'Поиск по чату', 'Совпадений нет'],
];
STR.forEach(function (t) {
  const p = path.join(root, t[0]);
  let x = fs.readFileSync(p, 'utf8');
  if (x.includes('name=' + Q + 'search_in_session' + Q)) { console.log('SKIP strings ' + t[0]); return; }
  const add = '    <string name=' + Q + 'search_in_session' + Q + '>' + t[1] + '</string>\n' +
    '    <string name=' + Q + 'search_no_hit' + Q + '>' + t[2] + '</string>\n';
  x = x.replace('</resources>', add + '</resources>');
  fs.writeFileSync(p, x);
});
console.log(bad === 0 ? 'fix45 done' : ('fix45 FAILED ' + bad));
process.exit(bad === 0 ? 0 : 1);
