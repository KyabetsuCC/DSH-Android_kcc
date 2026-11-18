// snippets (quick notes): sidebar header icon + overlay
const fs = require('fs');
const root = process.argv[2] || '.';
const P = root + '/app/src/main/java/io/github/jackwener/dsh/feature/conversation/SessionDrawer.kt';
let bad = 0;
function rep(a, b, name, key) {
  let s = fs.readFileSync(P, 'utf8');
  if (s.includes(key)) { console.log('SKIP ' + name); return; }
  if (!s.includes(a)) { console.log('ANCHOR ' + name); bad++; return; }
  s = s.replace(a, b);
  fs.writeFileSync(P, s);
  console.log('EDIT ' + name);
}

rep('    var now by remember { mutableLongStateOf(System.currentTimeMillis()) }\n',
  '    var now by remember { mutableLongStateOf(System.currentTimeMillis()) }\n    var notesOpen by remember { mutableStateOf(false) }\n', 'state', 'var notesOpen');

rep('        Row(Modifier.fillMaxWidth().heightIn(min = if (compact) 32.dp else 40.dp).padding(start = 8.dp, top = 2.dp), verticalAlignment = Alignment.CenterVertically) {\n',
  '        if (notesOpen) SnippetOverlay(onClose = { notesOpen = false })\n' +
  '        Row(Modifier.fillMaxWidth().heightIn(min = if (compact) 32.dp else 40.dp).padding(start = 8.dp, top = 2.dp), verticalAlignment = Alignment.CenterVertically) {\n', 'overlay', 'SnippetOverlay(');

rep('            IconBtn(R.drawable.ic_folder_plus, { creating = true }, size = if (compact) 34.dp else 40.dp, iconSize = 14.dp, tint = c.labelTertiary,\n' +
    '                contentDescription = stringResource(R.string.folder_new))\n',
  '            IconBtn(R.drawable.ic_folder_plus, { creating = true }, size = if (compact) 34.dp else 40.dp, iconSize = 14.dp, tint = c.labelTertiary,\n' +
  '                contentDescription = stringResource(R.string.folder_new))\n' +
  '            IconBtn(R.drawable.ic_note, { notesOpen = true }, size = if (compact) 34.dp else 40.dp, iconSize = 14.dp, tint = c.labelTertiary,\n' +
  '                contentDescription = stringResource(R.string.drawer_snippets))\n', 'header icon', 'R.drawable.ic_note');

const S = [
  ['values', 'snippet_title', '速记'],
  ['values', 'snippet_new', '新建速记'],
  ['values', 'snippet_empty', '还没有内容\n点右上角 ＋ 记一条常用指令或提示词'],
  ['values', 'snippet_copied', '已复制到剪贴板'],
  ['values', 'snippet_edit', '编辑'],
  ['values', 'snippet_title_hint', '标题（可选）'],
  ['values', 'snippet_hint', '粘贴一段指令、脚本或提示词…'],
  ['values', 'drawer_snippets', '速记'],
  ['values-en', 'snippet_title', 'Snippets'],
  ['values-en', 'snippet_new', 'New snippet'],
  ['values-en', 'snippet_empty', 'Nothing saved yet\nTap + to keep a command or prompt'],
  ['values-en', 'snippet_copied', 'Copied to clipboard'],
  ['values-en', 'snippet_edit', 'Edit'],
  ['values-en', 'snippet_title_hint', 'Title (optional)'],
  ['values-en', 'snippet_hint', 'Paste a command, script or prompt…'],
  ['values-en', 'drawer_snippets', 'Snippets'],
  ['values-ru', 'snippet_title', 'Заметки'],
  ['values-ru', 'snippet_new', 'Новая заметка'],
  ['values-ru', 'snippet_empty', 'Пока пусто\nНажмите +, чтобы сохранить команду или промпт'],
  ['values-ru', 'snippet_copied', 'Скопировано в буфер обмена'],
  ['values-ru', 'snippet_edit', 'Изменить'],
  ['values-ru', 'snippet_title_hint', 'Заголовок (необязательно)'],
  ['values-ru', 'snippet_hint', 'Вставьте команду, скрипт или промпт…'],
  ['values-ru', 'drawer_snippets', 'Заметки'],
];
for (const [dir, key, text] of S) {
  const f = root + '/app/src/main/res/' + dir + '/strings.xml';
  let s = fs.readFileSync(f, 'utf8');
  if (s.includes('name="' + key + '"')) { console.log('SKIP ' + dir + ' ' + key); continue; }
  s = s.replace('</resources>', '    <string name="' + key + '">' + text + '</string>\n</resources>');
  fs.writeFileSync(f, s);
  console.log('EDIT ' + dir + ' ' + key);
}

if (bad) { console.log('fix54 FAILED'); process.exit(1); }
console.log('fix54 done');
