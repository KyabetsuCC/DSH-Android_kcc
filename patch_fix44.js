// 用法: node patch_fix44.js [repoRoot]
// 侧栏紧凑模式（设置开关）+ 新建文件夹图标挪到「会话」标题行右侧。
const fs = require('fs'), path = require('path');
const root = process.argv[2] || '.';
let bad = 0;
const Q = String.fromCharCode(34);
function read(f) { const p = path.join(root, f); return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null; }
function write(f, s) { fs.writeFileSync(path.join(root, f), s); }
function after(s, anchor, add, tag) {
  const i = s.indexOf(anchor);
  if (i < 0) { console.log('ANCHOR ' + tag); bad++; return s; }
  const j = i + anchor.length;
  return s.slice(0, j) + '\n' + add + s.slice(j);
}

/* ---------- SettingsRepository ---------- */
const REPO = 'app/src/main/java/io/github/jackwener/dsh/core/data/SettingsRepository.kt';
let s = read(REPO);
if (s === null) { console.log('MISSING ' + REPO); process.exit(1); }
if (s.includes('compactDrawer')) console.log('SKIP repo');
else {
  s = after(s, '    val enterToSend: Boolean = false,',
    '    /** 侧栏紧凑模式: tighter drawer rows. */\n    val compactDrawer: Boolean = false,', 'repo field');
  s = after(s, '        val enterToSend = booleanPreferencesKey(' + Q + 'enter_to_send' + Q + ')',
    '        val compactDrawer = booleanPreferencesKey(' + Q + 'compact_drawer' + Q + ')', 'repo key');
  s = after(s, '        enterToSend = this[K.enterToSend] ?: false,',
    '        compactDrawer = this[K.compactDrawer] ?: false,', 'repo read');
  s = after(s, '    suspend fun setEnterToSend(on: Boolean) = context.store.edit { it[K.enterToSend] = on }',
    '    suspend fun setCompactDrawer(on: Boolean) = context.store.edit { it[K.compactDrawer] = on }', 'repo setter');
  s = after(s, '.onEach { io.github.jackwener.dsh.core.session.Pricing.currency = it.currency }',
    '        .onEach { UiPrefs.compactDrawer = it.compactDrawer }', 'repo onEach');
}

/* ---------- SettingsViewModel ---------- */
const VM = 'app/src/main/java/io/github/jackwener/dsh/feature/settings/SettingsViewModel.kt';
write(REPO, s);
s = read(VM);
if (!s.includes('setCompactDrawer')) {
  s = after(s, '    fun setEnterToSend(on: Boolean) = viewModelScope.launch { repo.setEnterToSend(on) }',
    '    fun setCompactDrawer(on: Boolean) = viewModelScope.launch { repo.setCompactDrawer(on) }', 'vm setter');
} else console.log('SKIP vm');
write(VM, s);

/* ---------- SettingsScreen ---------- */
const SCREEN = 'app/src/main/java/io/github/jackwener/dsh/feature/settings/SettingsScreen.kt';
s = read(SCREEN);
if (s.includes('R.string.set_drawer_compact')) console.log('SKIP screen');
else {
  const block = [
    '    SettingsGroupTitle(stringResource(R.string.set_drawer_group))',
    '    SettingsCard {',
    '        SettingsRow(stringResource(R.string.set_drawer_compact), stringResource(R.string.set_drawer_compact_desc), divider = false,',
    '            trailing = { DSwitch(s.compactDrawer, { on -> vm.setCompactDrawer(on) }) })',
    '    }',
    '',
  ].join('\n');
  const anchor = '    SettingsGroupTitle(stringResource(R.string.set_entry_points))';
  const i = s.indexOf(anchor);
  if (i < 0) { console.log('ANCHOR screen group'); bad++; }
  else { s = s.slice(0, i) + block + s.slice(i); }
}
write(SCREEN, s);

/* ---------- SessionDrawer ---------- */
const DRAWER = 'app/src/main/java/io/github/jackwener/dsh/feature/conversation/SessionDrawer.kt';
s = read(DRAWER);
if (s.includes('UiPrefs.compactDrawer')) console.log('SKIP drawer');
else {
  // compact flag (inserted before the shown list)
  const shownAnchor = '    val shown = sessions.filter {';
  const i = s.indexOf(shownAnchor);
  if (i < 0) { console.log('ANCHOR drawer flag'); bad++; }
  else s = s.slice(0, i) + '    val compact = io.github.jackwener.dsh.core.data.UiPrefs.compactDrawer\n' + s.slice(i);
  // remove the standalone folder header row added by patch_fix28
  const fh = [
    '        Row(Modifier.fillMaxWidth().padding(start = 8.dp, end = 4.dp), verticalAlignment = Alignment.CenterVertically) {',
    '            Text(stringResource(R.string.folder_group), Modifier.weight(1f), style = DshType.xs13m, color = Dsh.colors.labelTertiary)',
    '            IconBtn(R.drawable.ic_plus, { creating = true }, size = 34.dp, iconSize = 14.dp, tint = Dsh.colors.labelTertiary,',
    '                contentDescription = stringResource(R.string.folder_new))',
    '        }',
    '',
  ].join('\n');
  if (s.includes(fh)) s = s.replace(fh, '');
  else console.log('ANCHOR drawer folder header');
  // folder-plus icon into the sessions header, right of the title
  const titleRow = '            Text(stringResource(R.string.sessions), Modifier.weight(1f), style = DshType.xs13m, color = c.labelTertiary)';
  s = after(s, titleRow,
    '            IconBtn(R.drawable.ic_folder_plus, { creating = true }, size = if (compact) 34.dp else 40.dp, iconSize = 14.dp, tint = c.labelTertiary,\n' +
    '                contentDescription = stringResource(R.string.folder_new))', 'drawer folder icon');
  // tighter metrics
  s = s.replace('Row(Modifier.fillMaxWidth().height(56.dp).padding(start = 4.dp)',
    'Row(Modifier.fillMaxWidth().height(if (compact) 46.dp else 56.dp).padding(start = 4.dp)');
  s = s.replace('.padding(bottom = 12.dp).fillMaxWidth().height(40.dp)',
    '.padding(bottom = if (compact) 6.dp else 12.dp).fillMaxWidth().height(if (compact) 34.dp else 40.dp)');
  s = s.replace('Row(Modifier.fillMaxWidth().heightIn(min = 40.dp).padding(start = 8.dp, top = 2.dp)',
    'Row(Modifier.fillMaxWidth().heightIn(min = if (compact) 32.dp else 40.dp).padding(start = 8.dp, top = 2.dp)');
  // row height inside SessionRow (reads the global so no call-site changes)
  s = s.replace('Row(Modifier.fillMaxWidth().heightIn(min = 44.dp).clip(Radius.md)',
    'Row(Modifier.fillMaxWidth().heightIn(min = if (io.github.jackwener.dsh.core.data.UiPrefs.compactDrawer) 34.dp else 44.dp).clip(Radius.md)');
}
write(DRAWER, s);

/* ---------- strings ---------- */
const STR = [
  ['app/src/main/res/values/strings.xml', '侧栏', '紧凑侧栏', '降低会话行的行高与留白，一屏显示更多会话'],
  ['app/src/main/res/values-en/strings.xml', 'Sidebar', 'Compact sidebar', 'Tighter rows and padding so more sessions fit on one screen'],
  ['app/src/main/res/values-ru/strings.xml', 'Боковая панель', 'Компактная панель', 'Меньше высота строк и отступы — на экран помещается больше сеансов'],
];
STR.forEach(function (t) {
  const p = path.join(root, t[0]);
  let x = fs.readFileSync(p, 'utf8');
  if (x.includes('name=' + Q + 'set_drawer_compact' + Q)) { console.log('SKIP strings ' + t[0]); return; }
  const add = '    <string name=' + Q + 'set_drawer_group' + Q + '>' + t[1] + '</string>\n' +
    '    <string name=' + Q + 'set_drawer_compact' + Q + '>' + t[2] + '</string>\n' +
    '    <string name=' + Q + 'set_drawer_compact_desc' + Q + '>' + t[3] + '</string>\n';
  x = x.replace('</resources>', add + '</resources>');
  fs.writeFileSync(p, x);
});
console.log(bad === 0 ? 'fix44 done' : ('fix44 FAILED ' + bad));
process.exit(bad === 0 ? 0 : 1);
