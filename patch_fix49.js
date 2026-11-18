// 用法: node patch_fix49.js [repoRoot]
// 1) markdown 代码块右上角加「复制」按钮；2) 会话内搜索跳转后高亮目标轮次。
const fs = require('fs'), path = require('path');
const root = process.argv[2] || '.';
const Q = String.fromCharCode(34);
let bad = 0;
function rd(f) { return fs.readFileSync(path.join(root, f), 'utf8'); }
function wr(f, s) { fs.writeFileSync(path.join(root, f), s); }

// ---------- 1. code block copy button ----------
const CONTENT = 'app/src/main/java/io/github/jackwener/dsh/core/designsystem/Content.kt';
let s = rd(CONTENT);
if (s.includes('codeBlockComponent')) console.log('SKIP content codeBlock');
else {
  const comp = [
    '    val codeBlockComponent: com.mikepenz.markdown.compose.components.MarkdownComponent = { model ->',
    '        val ctx = LocalContext.current',
    '        Box(Modifier.fillMaxWidth()) {',
    '            com.mikepenz.markdown.compose.elements.MarkdownCodeBlock(model.content, model.node, style = model.typography.code)',
    '            Box(Modifier.align(Alignment.TopEnd).padding(2.dp)) {',
    '                IconBtn(R.drawable.dsw_copy_outline, { copyText(ctx, model.content) }, size = 26.dp, iconSize = 12.dp,',
    '                    tint = Dsh.colors.labelTertiary, contentDescription = stringResource(R.string.copy))',
    '            }',
    '        }',
    '    }',
    '',
  ].join('\n');
  const a = '    Markdown(\n';
  if (!s.includes(a)) { console.log('ANCHOR content markdown call'); bad++; }
  else s = s.replace(a, comp + a);
  const b = '        components = markdownComponents(table = tableComponent),';
  if (!s.includes(b)) { console.log('ANCHOR content components'); bad++; }
  else s = s.replace(b, '        components = markdownComponents(table = tableComponent, codeBlock = codeBlockComponent),');
  wr(CONTENT, s);
}

// ---------- 2. jump highlight ----------
const STREAM = 'app/src/main/java/io/github/jackwener/dsh/feature/conversation/Stream.kt';
let t = rd(STREAM);
if (t.includes('highlight = jumpSeq > 0')) console.log('SKIP stream highlight');
else {
  if (!t.includes('import androidx.compose.foundation.lazy.itemsIndexed')) {
    const imp = 'import androidx.compose.foundation.lazy.items\n';
    if (!t.includes(imp)) { console.log('ANCHOR stream import'); bad++; }
    else t = t.replace(imp, imp + 'import androidx.compose.foundation.lazy.itemsIndexed\n');
  }
  const a = '            items(conv.turns, key = { it.key }) { turn ->\n                val isLast = turn === conv.turns.last()\n                TurnView(turn, isLast, live, details, onInspect, onRetry, onOpenSettings, onContinue, compact)\n            }';
  const b = '            itemsIndexed(conv.turns, key = { _, turn -> turn.key }) { idx, turn ->\n                val isLast = turn === conv.turns.last()\n                TurnView(turn, isLast, live, details, onInspect, onRetry, onOpenSettings, onContinue, compact, highlight = jumpSeq > 0 && idx == jumpIndex)\n            }';
  if (!t.includes(a)) { console.log('ANCHOR stream items'); bad++; }
  else t = t.replace(a, b);
  const c = '    onInspect: (String) -> Unit, onRetry: (TurnError) -> Unit, onOpenSettings: (String) -> Unit, onContinue: () -> Unit, compact: Boolean,\n) {';
  const d = '    onInspect: (String) -> Unit, onRetry: (TurnError) -> Unit, onOpenSettings: (String) -> Unit, onContinue: () -> Unit, compact: Boolean, highlight: Boolean = false,\n) {';
  if (!t.includes(c)) { console.log('ANCHOR stream turnview sig'); bad++; }
  else t = t.replace(c, d);
  const e = '    var open by rememberSaveable(turn.key) { mutableStateOf(defaultOpen) }\n    Column(Modifier.fillMaxWidth().padding(bottom = 12.dp)) {';
  const f = '    var open by rememberSaveable(turn.key) { mutableStateOf(defaultOpen) }\n    Column(Modifier.fillMaxWidth().clip(Radius.md).background(if (highlight) androidx.compose.ui.graphics.Color(0x1A4C8DFF) else androidx.compose.ui.graphics.Color.Transparent, Radius.md).padding(bottom = 12.dp)) {';
  if (!t.includes(e)) { console.log('ANCHOR stream column'); bad++; }
  else t = t.replace(e, f);
  wr(STREAM, t);
}
console.log(bad === 0 ? 'fix49 done' : ('fix49 FAILED ' + bad));
process.exit(bad === 0 ? 0 : 1);
