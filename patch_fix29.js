// 0.0.37: price table + per-turn cost + caret-at-end for the composer text.
const fs = require('fs');
const root = process.argv[2] || '.';
let bad = 0;
const rd = (p) => fs.readFileSync(p, 'utf8');
const wr = (p, s) => fs.writeFileSync(p, s);
function edit(file, fn) {
  const p = root + '/' + file;
  let s;
  try { s = rd(p); } catch (e) { console.log('MISSING', file); bad++; return; }
  const before = s;
  s = fn(s);
  if (s === before) { console.log('SKIP', file); return; }
  wr(p, s);
  console.log('EDIT', file);
}
const must = (name, cond) => { if (!cond) { console.log('CHECK FAIL', name); bad++; } else console.log('ok', name); };

const CONV = 'app/src/main/java/io/github/jackwener/dsh/feature/conversation';

// 1) per-turn cost next to the token chip.
edit(CONV + '/Stream.kt', (s) => {
  if (s.includes('Pricing.cost(turn.usage)')) return s;
  const a = '            val hit = turn.usage.cacheHitRate?.let { " · " + stringResource(R.string.usage_cache_hit_short, Fmt.percent(it)) }.orEmpty()';
  if (!s.includes(a)) { console.log('ANCHOR stream-hit'); bad++; return s; }
  s = s.replace(a, a + '\n            val cost = io.github.jackwener.dsh.core.session.Pricing.cost(turn.usage)?.let { " · " + io.github.jackwener.dsh.core.session.Pricing.format(it) }.orEmpty()');
  s = s.replace('Text("↑${Fmt.tokens(turn.usage.input)} ↓${Fmt.tokens(turn.usage.output)}$hit"',
                'Text("↑${Fmt.tokens(turn.usage.input)} ↓${Fmt.tokens(turn.usage.output)}$hit$cost"');
  return s;
});

// 2) keep Pricing.model on the conversation's model.
edit(CONV + '/ConversationViewModel.kt', (s) => {
  if (s.includes('Pricing.model =')) return s;
  const a = '        .stateIn(viewModelScope, SharingStarted.Eagerly, SessionModels.resolve(null, Settings()))';
  if (!s.includes(a)) { console.log('ANCHOR vm-model'); bad++; return s; }
  return s.replace(a, a + '\n\n    init { viewModelScope.launch { model.collect { io.github.jackwener.dsh.core.session.Pricing.model = it.selection.model } } }');
});

// 3) composer keeps a TextFieldValue so an inserted newline also moves the caret.
edit(CONV + '/Composer.kt', (s) => {
  const a = 'class ComposerState {\n    var text by mutableStateOf("")';
  if (s.includes('var tv by mutableStateOf(TextFieldValue(')) return s;
  if (!s.includes(a)) { console.log('ANCHOR composer-state'); bad++; return s; }
  s = s.replace(a, 'class ComposerState {\n    /** The field itself: the caret has to be part of the state so an inserted "\\n" moves it. */\n    var tv by mutableStateOf(TextFieldValue(""))\n    var text: String\n        get() = tv.text\n        set(v) { tv = TextFieldValue(v, TextRange(v.length)) }\n    fun onEdit(v: TextFieldValue) { tv = v }');
  s = s.replace('fun clear() { text = ""; images.clear(); files.clear() }', 'fun clear() { tv = TextFieldValue(""); images.clear(); files.clear() }');
  s = s.replace('        BasicTextField(\n            state.text,\n            { v ->\n                if (voice?.active == true) voice.onUserEdit()\n                state.text = v',
                '        BasicTextField(\n            state.tv,\n            { v ->\n                if (voice?.active == true) voice.onUserEdit()\n                state.onEdit(v)');
  if (!s.includes('v.text == "/"')) {
    s = s.replace('if (v == "/") slashOpen = true else if (slashOpen && !v.startsWith("/")) slashOpen = false', 'if (v.text == "/") slashOpen = true else if (slashOpen && !v.text.startsWith("/")) slashOpen = false');
  }
  if (!s.includes('import androidx.compose.ui.text.input.TextFieldValue')) {
    s = s.replace('import androidx.compose.ui.text.input.KeyboardCapitalization',
      'import androidx.compose.ui.text.TextRange\nimport androidx.compose.ui.text.input.KeyboardCapitalization\nimport androidx.compose.ui.text.input.TextFieldValue');
  }
  return s;
});

// 4) checks
const st = rd(root + '/' + CONV + '/Stream.kt');
must('stream cost', st.includes('Pricing.format(it)'));
const vm = rd(root + '/' + CONV + '/ConversationViewModel.kt');
must('vm pricing model', vm.includes('Pricing.model = it.selection.model'));
const cp = rd(root + '/' + CONV + '/Composer.kt');
must('composer tv', cp.includes('var tv by mutableStateOf(TextFieldValue('));
must('composer onEdit', cp.includes('state.onEdit(v)'));
must('composer imports', cp.includes('import androidx.compose.ui.text.TextRange') && cp.includes('import androidx.compose.ui.text.input.TextFieldValue'));
must('pricing.kt', fs.existsSync(root + '/app/src/main/java/io/github/jackwener/dsh/core/session/Pricing.kt'));
process.exit(bad ? 1 : 0);
