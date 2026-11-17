// 0.0.39: stop asks first when other sessions are running (the SDK stops the whole engine).
const fs = require('fs');
const root = process.argv[2] || '.';
const Q = String.fromCharCode(34);
let bad = 0;
const rd = (p) => fs.readFileSync(root + '/' + p, 'utf8');
const wr = (p, s) => fs.writeFileSync(root + '/' + p, s);
const CVM = 'app/src/main/java/io/github/jackwener/dsh/feature/conversation/ConversationViewModel.kt';
const HS = 'app/src/main/java/io/github/jackwener/dsh/feature/conversation/HomeScreen.kt';

// --- 1. HomeViewModel: requestStop / confirmStop / dismissStop
let v = rd(CVM);
if (v.includes('fun requestStop(')) console.log('SKIP viewmodel');
else {
  const a = '    val rowStatus: StateFlow<Map<String, RowStatus>> = store.status';
  if (!v.includes(a)) { console.log('ANCHOR rowStatus'); bad++; }
  else v = v.replace(a, a + [
    '',
    '    /** >0 = a stop is waiting for confirmation: stopping kills the engine, so every running session ends. */',
    '    val stopConfirm = MutableStateFlow(0)',
    '',
    '    fun requestStop() = viewModelScope.launch {',
    '        val others = sessions.value.count { it.id != id && rowStatus.value[it.id]?.name == ' + Q + 'Running' + Q + ' }',
    '        if (others == 0) store.stop() else stopConfirm.value = others',
    '    }',
    '',
    '    fun confirmStop() {',
    '        stopConfirm.value = 0',
    '        viewModelScope.launch { store.stop() }',
    '    }',
    '',
    '    fun dismissStop() { stopConfirm.value = 0 }',
  ].join('\n'));
  wr(CVM, v); console.log('EDIT viewmodel');
}

// --- 2. HomeScreen: dialog in BottomDock + guarded onStop
let s = rd(HS);
if (s.includes('stopConfirm')) console.log('SKIP homescreen');
else {
  for (const imp of ['DDialog', 'DButton', 'BtnVariant']) {
    const line = 'import io.github.jackwener.dsh.core.designsystem.' + imp;
    if (!s.includes(line)) s = s.replace('import io.github.jackwener.dsh.core.designsystem.DshType', 'import io.github.jackwener.dsh.core.designsystem.DshType\n' + line);
  }
  if (!s.includes('import androidx.compose.material3.Text')) s = s.replace('import androidx.compose.runtime.getValue', 'import androidx.compose.material3.Text\nimport androidx.compose.runtime.getValue');

  const stop = '            onStop = { vm.stop() },';
  if (!s.includes(stop)) { console.log('ANCHOR onStop'); bad++; }
  else s = s.replace(stop, '            onStop = { if (vm is HomeViewModel) vm.requestStop() else vm.stop() },');

  const dock = '        if (live.running) TodoDock(conv.todos,';
  const idx = s.indexOf(dock);
  if (idx < 0) { console.log('ANCHOR tododock'); bad++; }
  else {
    const dlg = [
      '        val stopConfirm by vm.stopConfirm.collectAsStateWithLifecycle()',
      '        if (stopConfirm > 0) DDialog({ vm.dismissStop() }, stringResource(R.string.stop_others_title), buttons = {',
      '            DButton(stringResource(R.string.cancel), { vm.dismissStop() }, variant = BtnVariant.Outline)',
      '            DButton(stringResource(R.string.stop_all), { vm.confirmStop() }, variant = BtnVariant.Danger)',
      '        }) {',
      '            Text(stringResource(R.string.stop_others_body, stopConfirm), style = DshType.s14, color = c.labelSecondary)',
      '        }',
      ''
    ].join('\n');
    s = s.slice(0, idx) + dlg + s.slice(idx);
  }
  wr(HS, s); console.log('EDIT homescreen');
}

// --- 3. strings
const ST = [
  ['values/strings.xml', '其他会话正在运行', '还会停掉另外 %1$d 个正在运行的会话，它们也会一起结束。', '全部停止'],
  ['values-en/strings.xml', 'Other sessions are running', 'This also stops the other %1$d running session(s).', 'Stop all'],
  ['values-ru/strings.xml', 'Другие сессии выполняются', 'Это также остановит ещё %1$d выполняющихся сессий.', 'Остановить все'],
];
for (const [f, t, b, o] of ST) {
  const p = 'app/src/main/res/' + f;
  let x = rd(p);
  if (x.includes('name=' + Q + 'stop_others_title' + Q)) { console.log('SKIP ' + f); continue; }
  x = x.replace('</resources>', '    <string name=' + Q + 'stop_others_title' + Q + '>' + t + '</string>\n' +
    '    <string name=' + Q + 'stop_others_body' + Q + '>' + b + '</string>\n' +
    '    <string name=' + Q + 'stop_all' + Q + '>' + o + '</string>\n</resources>');
  wr(p, x); console.log('EDIT ' + f);
}
const h = rd(HS);
if (!h.includes('requestStop') || !h.includes('stop_others_body')) { console.log('CHECK FAIL'); bad++; }
process.exit(bad ? 1 : 0);
