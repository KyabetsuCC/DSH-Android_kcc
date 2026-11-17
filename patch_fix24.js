const fs = require('fs'), path = require('path');
const root = process.argv[2] || '.';
let bad = 0, changed = 0;
function edit(file, fn) {
  const p = path.join(root, file);
  if (!fs.existsSync(p)) { console.log('MISSING  ' + file); bad++; return; }
  const src = fs.readFileSync(p, 'utf8'); const out = fn(src);
  if (out === null) { console.log('SKIP     ' + file); return; }
  if (out === src) { console.log('NOCHANGE ' + file); bad++; return; }
  fs.writeFileSync(p, out); console.log('OK       ' + file); changed++;
}
function need(s, x, w) { if (!s.includes(x)) { console.log('ANCHOR0 ' + w); bad++; return false; } return true; }
function addImport(s, imp) {
  if (s.includes('import ' + imp + '\n')) return s;
  const end = s.indexOf('\n', s.lastIndexOf('\nimport '));
  return s.slice(0, end) + '\nimport ' + imp + s.slice(end);
}
function insertAfterLine(s, contains, line) {
  const lines = s.split('\n');
  const i = lines.findIndex((l) => l.includes(contains));
  if (i < 0) return null;
  lines.splice(i + 1, 0, line);
  return lines.join('\n');
}

edit('app/src/main/java/io/github/jackwener/dsh/core/data/SettingsRepository.kt', (s0) => {
  if (s0.includes('enterToSend')) return null;
  let s = s0;
  if (!need(s, '    val busySend: BusySend = BusySend.Queue,', 'field')) return null;
  s = insertAfterLine(s, '    val busySend: BusySend = BusySend.Queue,', '    /** 回车直接发送: Enter sends; off keeps Enter as a newline. */\n    val enterToSend: Boolean = false,');
  if (!s) { console.log('ANCHOR0 field'); bad++; return null; }
  s = insertAfterLine(s, '        val busySend = stringPreferencesKey("busy_send")', '        val enterToSend = booleanPreferencesKey("enter_to_send")');
  if (!s) { console.log('ANCHOR0 key'); bad++; return null; }
  s = insertAfterLine(s, 'busySend = this[K.busySend]', '        enterToSend = this[K.enterToSend] ?: false,');
  if (!s) { console.log('ANCHOR0 read'); bad++; return null; }
  s = insertAfterLine(s, 'suspend fun setBusySend(v: BusySend) = context.store.edit', '    suspend fun setEnterToSend(on: Boolean) = context.store.edit { it[K.enterToSend] = on }');
  if (!s) { console.log('ANCHOR0 setter'); bad++; return null; }
  return s;
});

edit('app/src/main/java/io/github/jackwener/dsh/feature/settings/SettingsViewModel.kt', (s) => {
  if (s.includes('setEnterToSend')) return null;
  const out = insertAfterLine(s, 'fun setBusySend(b: BusySend) = viewModelScope.launch', '    fun setEnterToSend(on: Boolean) = viewModelScope.launch { repo.setEnterToSend(on) }');
  if (!out) { console.log('ANCHOR0 vm setter'); bad++; return null; }
  return out;
});

edit('app/src/main/java/io/github/jackwener/dsh/feature/settings/SettingsScreen.kt', (s) => {
  if (s.includes('R.string.enter_to_send')) return null;
  const anchor = '    SettingsGroupTitle(stringResource(R.string.set_entry_points))';
  if (!need(s, anchor, 'general group')) return null;
  const block = [
    '    SettingsGroupTitle(stringResource(R.string.set_input_group))',
    '    SettingsCard {',
    '        SettingsRow(stringResource(R.string.enter_to_send), stringResource(R.string.enter_to_send_desc), divider = false,',
    '            trailing = { DSwitch(s.enterToSend, { on -> vm.setEnterToSend(on) }) })',
    '    }',
    anchor,
  ].join('\n');
  return s.replace(anchor, block);
});

edit('app/src/main/java/io/github/jackwener/dsh/feature/conversation/Composer.kt', (s0) => {
  if (s0.includes('enterToSend')) return null;
  let s = s0;
  s = addImport(s, 'androidx.compose.foundation.text.KeyboardActions');
  s = addImport(s, 'androidx.compose.ui.text.input.ImeAction');
  s = addImport(s, 'androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel');
  s = addImport(s, 'androidx.lifecycle.compose.collectAsStateWithLifecycle');
  s = addImport(s, 'io.github.jackwener.dsh.feature.settings.SettingsViewModel');
  const ko = '            keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences),';
  if (!need(s, ko, 'keyboardOptions')) return null;
  s = s.replace(ko, [
    '            keyboardOptions = KeyboardOptions(',
    '                capitalization = KeyboardCapitalization.Sentences,',
    '                imeAction = if (enterToSend) ImeAction.Send else ImeAction.Default,',
    '            ),',
    '            keyboardActions = KeyboardActions(onSend = { if (enterToSend) onSend() }),',
  ].join('\n'));
  const btf = '        BasicTextField(';
  if (!need(s, btf, 'basictextfield')) return null;
  return s.replace(btf, '        val enterToSend = hiltViewModel<SettingsViewModel>().settings.collectAsStateWithLifecycle().value.enterToSend\n' + btf);
});

const S = {
  'values/strings.xml': ['输入', '回车直接发送', '打开后按键盘回车直接发送消息；换行请用输入框右侧的换行键'],
  'values-en/strings.xml': ['Input', 'Enter to send', 'Enter sends the message; use the newline key to break lines'],
  'values-ru/strings.xml': ['Ввод', 'Enter — отправить', 'Enter отправляет сообщение'],
};
for (const f of Object.keys(S)) {
  edit('app/src/main/res/' + f, (src) => {
    if (src.includes('name="enter_to_send"')) return null;
    if (!need(src, '</resources>', f)) return null;
    const [g, t, d] = S[f];
    const add = '    <string name="set_input_group">' + g + '</string>\n'
      + '    <string name="enter_to_send">' + t + '</string>\n'
      + '    <string name="enter_to_send_desc">' + d + '</string>\n</resources>';
    return src.replace('</resources>', add);
  });
}

console.log(bad === 0 ? 'patch_fix24: all done (' + changed + ' files)' : 'patch_fix24: ' + bad + ' problem(s)');
process.exit(bad === 0 ? 0 : 1);
