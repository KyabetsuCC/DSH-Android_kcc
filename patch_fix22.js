const fs = require('fs');
const path = require('path');
const root = process.argv[2] || '.';
let bad = 0, changed = 0;

function edit(file, fn) {
  const p = path.join(root, file);
  if (!fs.existsSync(p)) { console.log('MISSING  ' + file); bad++; return; }
  const src = fs.readFileSync(p, 'utf8');
  const out = fn(src);
  if (out === null) { console.log('SKIP     ' + file); return; }
  if (out === src) { console.log('NOCHANGE ' + file); bad++; return; }
  fs.writeFileSync(p, out);
  console.log('OK       ' + file);
  changed++;
}
function has(src, s, what) { if (!src.includes(s)) { console.log('ANCHOR0 ' + what); bad++; return false; } return true; }

edit('app/src/main/java/io/github/jackwener/dsh/feature/conversation/HomeScreen.kt', (src) => {
  if (src.includes('TerminalOverlay')) return null;
  let s = src;
  if (!has(s, 'import androidx.compose.runtime.mutableLongStateOf', 'import anchor')) return null;
  s = s.replace('import androidx.compose.runtime.mutableLongStateOf',
    'import androidx.compose.runtime.mutableLongStateOf\nimport androidx.compose.runtime.mutableStateOf');
  if (!has(s, 'val composer = rememberComposerState(live.sessionId)', 'composer anchor')) return null;
  s = s.replace('val composer = rememberComposerState(live.sessionId)',
    'val composer = rememberComposerState(live.sessionId)\n    var termOpen by remember { mutableStateOf(false) }');
  if (!has(s, 'if (!empty) IconBtn(R.drawable.dsw_new_chat_outline', 'new chat anchor')) return null;
  s = s.replace('            if (!empty) IconBtn(R.drawable.dsw_new_chat_outline',
    '            IconBtn(R.drawable.ic_term, { termOpen = true }, size = 40.dp, iconSize = 18.dp, tint = c.labelPrimary, contentDescription = "终端")\n            if (!empty) IconBtn(R.drawable.dsw_new_chat_outline');
  if (!has(s, 'val agentDisplay by vm.agentDisplay.collectAsStateWithLifecycle()', 'agent anchor')) return null;
  s = s.replace('        val agentDisplay by vm.agentDisplay.collectAsStateWithLifecycle()',
    '        if (termOpen) io.github.jackwener.dsh.feature.settings.TerminalOverlay(onClose = { termOpen = false })\n        val agentDisplay by vm.agentDisplay.collectAsStateWithLifecycle()');
  return s;
});

console.log(bad === 0 ? 'patch_fix22: all done (' + changed + ' file)' : 'patch_fix22: ' + bad + ' problem(s)');
process.exit(bad === 0 ? 0 : 1);
