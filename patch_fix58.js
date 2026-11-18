// 用法: node patch_fix58.js [repoRoot]
// 沉浸模式：隐藏状态栏（可从顶部下滑临时拉出），设置→外观 可开关。
const fs = require('fs'), path = require('path');
const root = process.argv[2] || '.';
const Q = String.fromCharCode(34);
let bad = 0;
function rd(f) { return fs.readFileSync(path.join(root, f), 'utf8'); }
function wr(f, s) { fs.writeFileSync(path.join(root, f), s); }
function ins(file, anchor, text, skipKey) {
  let s = rd(file);
  if (skipKey && s.includes(skipKey)) { console.log('SKIP ' + file); return; }
  if (!s.includes(anchor)) { console.log('ANCHOR ' + file + ' :: ' + anchor.slice(0, 48)); bad++; return; }
  wr(file, s.replace(anchor, anchor + text));
}

const REPO = 'app/src/main/java/io/github/jackwener/dsh/core/data/SettingsRepository.kt';
ins(REPO, '    val chatPadding: Int = 1,\n', '    val immersive: Boolean = false,\n', 'val immersive: Boolean');
ins(REPO, '        val chatPadding = intPreferencesKey(' + Q + 'chat_padding' + Q + ')\n',
  '        val immersive = booleanPreferencesKey(' + Q + 'immersive' + Q + ')\n', 'booleanPreferencesKey(' + Q + 'immersive');
ins(REPO, '        chatPadding = this[K.chatPadding] ?: 1,\n',
  '        immersive = this[K.immersive] ?: false,\n', 'immersive = this[K.immersive]');
ins(REPO, '            UiPrefs.chatPadding = when (it.chatPadding) { 0 -> 40; 2 -> 6; else -> 16 }\n',
  '            UiPrefs.immersive = it.immersive\n', 'UiPrefs.immersive');
ins(REPO, '    suspend fun setChatPadding(v: Int) = context.store.edit { it[K.chatPadding] = v }\n',
  '\n    suspend fun setImmersive(on: Boolean) = context.store.edit { it[K.immersive] = on }\n', 'fun setImmersive');

const VM = 'app/src/main/java/io/github/jackwener/dsh/feature/settings/SettingsViewModel.kt';
ins(VM, '    fun setChatPadding(v: Int) = viewModelScope.launch { repo.setChatPadding(v) }\n',
  '    fun setImmersive(on: Boolean) = viewModelScope.launch { repo.setImmersive(on) }\n', 'fun setImmersive');

// ---- 设置页「外观」组（放在「阅读」组之前） ----
const SCREEN = 'app/src/main/java/io/github/jackwener/dsh/feature/settings/SettingsScreen.kt';
let sc = rd(SCREEN);
if (sc.includes('set_look_group')) console.log('SKIP settings screen');
else {
  const anchor = '    SettingsGroupTitle(stringResource(R.string.set_read_group))';
  if (!sc.includes(anchor)) { console.log('ANCHOR settings look group'); bad++; }
  else {
    const block = [
      '    SettingsGroupTitle(stringResource(R.string.set_look_group))',
      '    SettingsCard {',
      '        SettingsRow(stringResource(R.string.set_immersive), stringResource(R.string.set_immersive_desc), divider = false, trailing = {',
      '            DSwitch(s.immersive, { on -> vm.setImmersive(on) })',
      '        })',
      '    }',
      '',
    ].join('\n');
    sc = sc.replace(anchor, block + anchor);
  }
  wr(SCREEN, sc);
}

// ---- MainActivity：应用 / 撤销沉浸 ----
const MAIN = 'app/src/main/java/io/github/jackwener/dsh/MainActivity.kt';
let mn = rd(MAIN);
if (mn.includes('applyImmersive')) console.log('SKIP main activity');
else {
  const a1 = '    override fun onNewIntent(intent: Intent) {';
  if (!mn.includes(a1)) { console.log('ANCHOR onNewIntent'); bad++; }
  else {
    const block = [
      '    override fun onResume() {',
      '        super.onResume()',
      '        applyImmersive()',
      '    }',
      '',
      '    /** 沉浸模式：隐藏状态栏；系统栏行为设为「滑动临时显示」，从顶部下滑仍能拉出通知栏。 */',
      '    private fun applyImmersive() {',
      '        val ctrl = androidx.core.view.WindowCompat.getInsetsController(window, window.decorView)',
      '        ctrl.systemBarsBehavior = androidx.core.view.WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE',
      '        if (io.github.jackwener.dsh.core.data.UiPrefs.immersive) {',
      '            ctrl.hide(androidx.core.view.WindowInsetsCompat.Type.statusBars())',
      '        } else {',
      '            ctrl.show(androidx.core.view.WindowInsetsCompat.Type.statusBars())',
      '        }',
      '    }',
      '',
    ].join('\n');
    mn = mn.replace(a1, block + a1);
  }
  // 开关变化时立即生效
  const a2 = '                LaunchedEffect(c.isDark) { account.darkTheme = c.isDark }';
  if (!mn.includes(a2)) { console.log('ANCHOR immersive effect'); bad++; }
  else {
    const eff = [
      '                val immersive = io.github.jackwener.dsh.core.data.UiPrefs.immersive',
      '                LaunchedEffect(immersive) { applyImmersive() }',
      '',
    ].join('\n');
    mn = mn.replace(a2, eff + a2);
  }
  wr(MAIN, mn);
}

// ---- 文案 ----
const STR = [
  ['app/src/main/res/values/strings.xml', [
    ['set_look_group', '外观'], ['set_immersive', '沉浸模式'],
    ['set_immersive_desc', '隐藏状态栏，内容顶到屏幕最上沿；从顶部下滑仍可拉出通知栏'],
  ]],
  ['app/src/main/res/values-en/strings.xml', [
    ['set_look_group', 'Appearance'], ['set_immersive', 'Immersive mode'],
    ['set_immersive_desc', 'Hide the status bar so content reaches the top edge; swipe down from the top to reveal it'],
  ]],
  ['app/src/main/res/values-ru/strings.xml', [
    ['set_look_group', 'Внешний вид'], ['set_immersive', 'Иммерсивный режим'],
    ['set_immersive_desc', 'Скрыть строку состояния, содержимое до верхнего края; смахните вниз сверху, чтобы показать её'],
  ]],
];
STR.forEach(function (pair) {
  const f = pair[0];
  let s = rd(f);
  if (s.includes('name=' + Q + 'set_immersive' + Q)) { console.log('SKIP ' + f); return; }
  const add = pair[1].map(function (kv) {
    return '    <string name=' + Q + kv[0] + Q + '>' + kv[1].replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/'/g, "\\'") + '</string>';
  }).join('\n') + '\n';
  if (!s.includes('</resources>')) { console.log('ANCHOR resources ' + f); bad++; return; }
  s = s.replace('</resources>', add + '</resources>');
  wr(f, s);
});

console.log(bad === 0 ? 'fix58 OK' : ('fix58 BAD ' + bad));
process.exit(bad === 0 ? 0 : 1);
