// 0.0.39: warn before "stop" also kills the other running sessions (the SDK has no per-session cancel).
const fs = require('fs');
const root = process.argv[2] || '.';
let bad = 0;
const rd = (p) => fs.readFileSync(p, 'utf8');
const wr = (p, s) => fs.writeFileSync(p, s);
const Q = String.fromCharCode(34);
const HS = 'app/src/main/java/io/github/jackwener/dsh/feature/conversation/HomeScreen.kt';

let s = rd(root + '/' + HS);
if (s.includes('othersRunning')) { console.log('SKIP HomeScreen'); }
else {
  // imports
  for (const imp of ['DDialog', 'DButton', 'BtnVariant']) {
    const line = 'import io.github.jackwener.dsh.core.designsystem.' + imp;
    if (!s.includes(line)) s = s.replace('import io.github.jackwener.dsh.core.designsystem.DshType', 'import io.github.jackwener.dsh.core.designsystem.DshType\n' + line);
  }
  if (!s.includes('import androidx.compose.runtime.mutableStateOf')) {
    s = s.replace('import androidx.compose.runtime.remember', 'import androidx.compose.runtime.mutableStateOf\nimport androidx.compose.runtime.remember');
  }
  if (!s.includes('import androidx.compose.material3.Text')) {
    s = s.replace('import androidx.compose.runtime.getValue', 'import androidx.compose.material3.Text\nimport androidx.compose.runtime.getValue');
  }
  // state
  const a = '    val currentId by vm.currentId.collectAsStateWithLifecycle()';
  if (!s.includes(a)) { console.log('ANCHOR currentId'); bad++; }
  else s = s.replace(a, a + '\n    // 停止会把引擎进程停掉，所有正在跑的会话都会一起结束（SDK 没有单会话取消）：先列出来确认。\n    var stopOthers by remember { mutableStateOf(false) }\n    val othersRunning = sessions.filter { it.id != currentId && status[it.id]?.name == ' + Q + 'Running' + Q + ' }');
  // stop guard
  const stop = '            onStop = { vm.stop() },';
  if (!s.includes(stop)) { console.log('ANCHOR onStop'); bad++; }
  else s = s.replace(stop, '            onStop = { if (othersRunning.isEmpty()) vm.stop() else stopOthers = true },');
  // dialog next to the todo dock (composable scope)
  const dockA = '        if (live.running) TodoDock(conv.todos,';
  const idx = s.indexOf(dockA);
  if (idx < 0) { console.log('ANCHOR tododock'); bad++; }
  else {
    const dlg = [
      '        if (stopOthers) io.github.jackwener.dsh.core.designsystem.DDialog({ stopOthers = false }, stringResource(R.string.stop_others_title), buttons = {',
      '            io.github.jackwener.dsh.core.designsystem.DButton(stringResource(R.string.cancel), { stopOthers = false }, variant = io.github.jackwener.dsh.core.designsystem.BtnVariant.Outline)',
      '            io.github.jackwener.dsh.core.designsystem.DButton(stringResource(R.string.stop_all), { stopOthers = false; vm.stop() }, variant = io.github.jackwener.dsh.core.designsystem.BtnVariant.Danger)',
      '        }) {',
      '            Text(',
      '                stringResource(R.string.stop_others_body, othersRunning.size) + ' + Q + '\\n\\n' + Q + ' + othersRunning.joinToString(' + Q + '\\n' + Q + ') { ' + Q + '· ' + Q + ' + it.title.ifBlank { stringResource(R.string.untitled) } },',
      '                style = DshType.s14, color = c.labelSecondary,',
      '            )',
      '        }',
      ''
    ].join('\n');
    s = s.slice(0, idx) + dlg + s.slice(idx);
  }
  wr(root + '/' + HS, s);
  console.log('EDIT HomeScreen');
}

const ST = [
  ['values/strings.xml', '其他会话正在运行', '还会停掉另外 %1$d 个正在运行的会话：', '全部停止'],
  ['values-en/strings.xml', 'Other sessions are running', 'This also stops %1$d other running session(s):', 'Stop all'],
  ['values-ru/strings.xml', 'Другие сессии выполняются', 'Это остановит ещё %1$d выполняющихся сессий:', 'Остановить все']
];
for (const [f, t, b, o] of ST) {
  const p = root + '/app/src/main/res/' + f;
  let x = rd(p);
  if (x.includes('name=' + Q + 'stop_others_title' + Q)) { console.log('SKIP ' + f); continue; }
  x = x.replace('</resources>', '    <string name=' + Q + 'stop_others_title' + Q + '>' + t + '</string>\n' +
    '    <string name=' + Q + 'stop_others_body' + Q + '>' + b + '</string>\n' +
    '    <string name=' + Q + 'stop_all' + Q + '>' + o + '</string>\n</resources>');
  wr(p, x); console.log('EDIT ' + f);
}

const h = rd(root + '/' + HS);
const ok = h.includes('othersRunning') && h.includes('stopOthers = true') && h.includes('stop_others_title');
if (!ok) { console.log('CHECK FAIL homescreen'); bad++; } else console.log('ok homescreen');
process.exit(bad ? 1 : 0);
