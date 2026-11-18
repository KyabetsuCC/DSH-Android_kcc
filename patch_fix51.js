// 用法: node patch_fix51.js [repoRoot]
// 阅读设置：字号缩放 + 对话区宽度（设置→通用 里的「阅读」组）。
const fs = require('fs'), path = require('path');
const root = process.argv[2] || '.';
const Q = String.fromCharCode(34);
let bad = 0;
function rd(f) { return fs.readFileSync(path.join(root, f), 'utf8'); }
function wr(f, s) { fs.writeFileSync(path.join(root, f), s); }
function ins(file, anchor, text, skipKey) {
  let s = rd(file);
  if (skipKey && s.includes(skipKey)) { console.log('SKIP ' + file); return; }
  if (!s.includes(anchor)) { console.log('ANCHOR ' + file + ' :: ' + anchor.slice(0, 40)); bad++; return; }
  wr(file, s.replace(anchor, anchor + text));
}

const REPO = 'app/src/main/java/io/github/jackwener/dsh/core/data/SettingsRepository.kt';
ins(REPO, '    val compactDrawer: Boolean = false,\n', '    val fontScale: Int = 1,\n    val chatPadding: Int = 1,\n', 'val fontScale: Int = 1,');
ins(REPO, '        val compactDrawer = booleanPreferencesKey(' + Q + 'compact_drawer' + Q + ')\n',
  '        val fontScale = intPreferencesKey(' + Q + 'font_scale' + Q + ')\n        val chatPadding = intPreferencesKey(' + Q + 'chat_padding' + Q + ')\n', 'intPreferencesKey(' + Q + 'font_scale');
ins(REPO, '        compactDrawer = this[K.compactDrawer] ?: false,\n',
  '        fontScale = this[K.fontScale] ?: 1,\n        chatPadding = this[K.chatPadding] ?: 1,\n', 'fontScale = this[K.fontScale]');
ins(REPO, '        .onEach { UiPrefs.compactDrawer = it.compactDrawer }\n',
  '        .onEach {\n' +
  '            UiPrefs.readingScale = when (it.fontScale) { 0 -> 0.9f; 2 -> 1.15f; 3 -> 1.3f; else -> 1f }\n' +
  '            UiPrefs.chatPadding = when (it.chatPadding) { 0 -> 40; 2 -> 6; else -> 16 }\n' +
  '        }\n', 'UiPrefs.readingScale =');
ins(REPO, '    suspend fun setCompactDrawer(on: Boolean) = context.store.edit { it[K.compactDrawer] = on }\n',
  '\n    suspend fun setFontScale(v: Int) = context.store.edit { it[K.fontScale] = v }\n' +
  '    suspend fun setChatPadding(v: Int) = context.store.edit { it[K.chatPadding] = v }\n', 'fun setFontScale');

const VM = 'app/src/main/java/io/github/jackwener/dsh/feature/settings/SettingsViewModel.kt';
ins(VM, '    fun setCompactDrawer(on: Boolean) = viewModelScope.launch { repo.setCompactDrawer(on) }\n',
  '    fun setFontScale(v: Int) = viewModelScope.launch { repo.setFontScale(v) }\n' +
  '    fun setChatPadding(v: Int) = viewModelScope.launch { repo.setChatPadding(v) }\n', 'fun setFontScale');

// ---- 设置页「阅读」组 ----
const SCREEN = 'app/src/main/java/io/github/jackwener/dsh/feature/settings/SettingsScreen.kt';
let sc = rd(SCREEN);
if (sc.includes('set_read_group')) console.log('SKIP settings screen');
else {
  const anchor = '    SettingsGroupTitle(stringResource(R.string.set_entry_points))';
  if (!sc.includes(anchor)) { console.log('ANCHOR settings group'); bad++; }
  else {
    const block = [
      '        SettingsGroupTitle(stringResource(R.string.set_read_group))',
      '        SettingsCard {',
      '            SettingsRow(stringResource(R.string.set_font_size), stringResource(R.string.set_font_size_desc), divider = true, stacked = true) {',
      '                Segmented(listOf(',
      '                    stringResource(R.string.set_font_small),',
      '                    stringResource(R.string.set_font_normal),',
      '                    stringResource(R.string.set_font_large),',
      '                    stringResource(R.string.set_font_xl),',
      '                ), s.fontScale, { vm.setFontScale(it) }, compact = true)',
      '            }',
      '            SettingsRow(stringResource(R.string.set_chat_width), stringResource(R.string.set_chat_width_desc), divider = false, stacked = true) {',
      '                Segmented(listOf(',
      '                    stringResource(R.string.set_width_narrow),',
      '                    stringResource(R.string.set_width_normal),',
      '                    stringResource(R.string.set_width_wide),',
      '                ), s.chatPadding, { vm.setChatPadding(it) }, compact = true)',
      '            }',
      '        }',
      '',
    ].map(function (l) { return l.startsWith('    ') ? l.slice(4) : l; }).join('\n');
    sc = sc.replace(anchor, block + anchor);
  }
  wr(SCREEN, sc);
}

// ---- 正文缩放 ----
const CONTENT = 'app/src/main/java/io/github/jackwener/dsh/core/designsystem/Content.kt';
let ct = rd(CONTENT);
if (ct.includes('UiPrefs.readingScale')) console.log('SKIP content scale');
else {
  const a = '    val body = (if (compact) DshType.xs13 else DshType.body).copy(color = color)';
  if (!ct.includes(a)) { console.log('ANCHOR content body'); bad++; }
  else {
    const b = '    val scale = io.github.jackwener.dsh.core.data.UiPrefs.readingScale\n' +
      '    val bodyBase = if (compact) DshType.xs13 else DshType.body\n' +
      '    val body = bodyBase.copy(color = color, fontSize = bodyBase.fontSize * scale,\n' +
      '        lineHeight = if (bodyBase.lineHeight.isSpecified) bodyBase.lineHeight * scale else bodyBase.lineHeight)';
    if (!ct.includes('import androidx.compose.ui.unit.isSpecified')) {
      ct = ct.replace('import androidx.compose.ui.unit.dp\n', 'import androidx.compose.ui.unit.dp\nimport androidx.compose.ui.unit.isSpecified\n');
    }
    ct = ct.replace(a, b);
    ct = ct.replace('    val code = DshType.mono12.copy(fontSize = 11.sp, lineHeight = 19.sp, color = c.labelPrimary)',
      '    val code = DshType.mono12.copy(fontSize = 11.sp * scale, lineHeight = 19.sp * scale, color = c.labelPrimary)');
  }
  wr(CONTENT, ct);
}

// ---- 用户气泡缩放 + 对话区宽度 ----
const STREAM = 'app/src/main/java/io/github/jackwener/dsh/feature/conversation/Stream.kt';
let st = rd(STREAM);
if (st.includes('UiPrefs.readingScale')) console.log('SKIP stream scale');
else {
  const a = '                style = DshType.s14, color = c.labelPrimary)';
  if (!st.includes(a)) { console.log('ANCHOR stream bubble'); bad++; }
  else st = st.replace(a, '                style = DshType.s14.copy(fontSize = DshType.s14.fontSize * io.github.jackwener.dsh.core.data.UiPrefs.readingScale), color = c.labelPrimary)');
  const b = 'contentPadding = PaddingValues(horizontal = 16.dp, vertical = 16.dp)';
  if (!st.includes(b)) { console.log('ANCHOR stream padding'); bad++; }
  else st = st.replace(b, 'contentPadding = PaddingValues(horizontal = io.github.jackwener.dsh.core.data.UiPrefs.chatPadding.dp, vertical = 16.dp)');
  wr(STREAM, st);
}

// ---- 文案 ----
const STR = [
  ['app/src/main/res/values/strings.xml', [
    ['set_read_group', '阅读'], ['set_font_size', '正文字号'], ['set_font_size_desc', '对话与思考内容的字号'],
    ['set_font_small', '小'], ['set_font_normal', '标准'], ['set_font_large', '大'], ['set_font_xl', '特大'],
    ['set_chat_width', '对话宽度'], ['set_chat_width_desc', '对话区左右留白，越宽显示的内容越多'],
    ['set_width_narrow', '窄'], ['set_width_normal', '标准'], ['set_width_wide', '宽'],
  ]],
  ['app/src/main/res/values-en/strings.xml', [
    ['set_read_group', 'Reading'], ['set_font_size', 'Text size'], ['set_font_size_desc', 'Size of replies and thinking blocks'],
    ['set_font_small', 'S'], ['set_font_normal', 'M'], ['set_font_large', 'L'], ['set_font_xl', 'XL'],
    ['set_chat_width', 'Content width'], ['set_chat_width_desc', 'Side padding of the conversation'],
    ['set_width_narrow', 'Narrow'], ['set_width_normal', 'Default'], ['set_width_wide', 'Wide'],
  ]],
  ['app/src/main/res/values-ru/strings.xml', [
    ['set_read_group', 'Чтение'], ['set_font_size', 'Размер текста'], ['set_font_size_desc', 'Размер ответов и размышлений'],
    ['set_font_small', 'S'], ['set_font_normal', 'M'], ['set_font_large', 'L'], ['set_font_xl', 'XL'],
    ['set_chat_width', 'Ширина диалога'], ['set_chat_width_desc', 'Отступы по краям диалога'],
    ['set_width_narrow', 'Узко'], ['set_width_normal', 'Обычно'], ['set_width_wide', 'Широко'],
  ]],
];
STR.forEach(function (t) {
  const p = path.join(root, t[0]);
  let x = fs.readFileSync(p, 'utf8');
  if (x.includes('name=' + Q + 'set_width_wide' + Q)) { console.log('SKIP strings ' + t[0]); return; }
  let add = '';
  t[1].forEach(function (kv) { add += '    <string name=' + Q + kv[0] + Q + '>' + kv[1] + '</string>\n'; });
  fs.writeFileSync(p, x.replace('</resources>', add + '</resources>'));
});
console.log(bad === 0 ? 'fix51 done' : ('fix51 FAILED ' + bad));
process.exit(bad === 0 ? 0 : 1);
