// 修上游已知缺陷：node patch_fix.js [repoRoot]
// 1) 气泡贴得更近：placeCapsule 的 gap 6dp -> 2dp
// 2) PR#69 / issue #63 #65：markdown 表格单元格不再被单行省略号截断
// 3) PR#70 / issue #64：provider 编辑器可删除单个模型
const fs = require('fs');
const path = require('path');
const root = process.argv[2] || '.';
const P = (p) => path.join(root, p);

let bad = 0;
function edit(file, label, fn) {
  const f = P(file);
  if (!fs.existsSync(f)) { console.error('MISS ' + file); bad++; return; }
  const s = fs.readFileSync(f, 'utf8');
  const out = fn(s);
  if (out === null) { console.error('FAIL ' + label + ' (anchor not found)'); bad++; return; }
  if (out === s) { console.log('SKIP ' + label + ' (already patched)'); return; }
  fs.writeFileSync(f, out);
  console.log('OK   ' + label);
}
function after(s, anchor, add) {
  const i = s.indexOf(anchor);
  if (i < 0) return null;
  const at = i + anchor.length;
  return s.slice(0, at) + add + s.slice(at);
}

/* ---------- 1. 气泡更靠近悬浮球 ---------- */
edit('app/src/main/java/io/github/jackwener/dsh/service/FloatingBallService.kt', 'capsule gap dp(6)->dp(2)', (s) => {
  if (s.includes('val gap = dp(2)')) return s;
  if (!s.includes('val gap = dp(6)')) return null;
  return s.replace('val gap = dp(6)', 'val gap = dp(2)');
});

/* ---------- 2. PR#69 表格不截断 ---------- */
const IMPORTS = [
  'import com.mikepenz.markdown.compose.components.MarkdownComponent',
  'import com.mikepenz.markdown.compose.components.markdownComponents',
  'import com.mikepenz.markdown.compose.elements.MarkdownTable',
  'import com.mikepenz.markdown.compose.elements.MarkdownTableHeader',
  'import com.mikepenz.markdown.compose.elements.MarkdownTableRow',
].join('\n') + '\n';

const TABLE_COMPONENT = [
  '    val tableComponent: MarkdownComponent = { model ->',
  '        MarkdownTable(',
  '            content = model.content,',
  '            node = model.node,',
  '            style = model.typography.table,',
  '            headerBlock = { content, header, tableWidth, style ->',
  '                MarkdownTableHeader(content, header, tableWidth, style, maxLines = Int.MAX_VALUE)',
  '            },',
  '            rowBlock = { content, header, tableWidth, style ->',
  '                MarkdownTableRow(content, header, tableWidth, style, maxLines = Int.MAX_VALUE)',
  '            }',
  '        )',
  '    }',
  '',
].join('\n');

edit('app/src/main/java/io/github/jackwener/dsh/core/designsystem/Content.kt', 'markdown table imports', (s) => {
  if (s.includes('import com.mikepenz.markdown.compose.elements.MarkdownTable'))
    return s;
  return after(s, 'import coil3.compose.AsyncImage\n', IMPORTS);
});

edit('app/src/main/java/io/github/jackwener/dsh/core/designsystem/Content.kt', 'markdown table component', (s) => {
  if (s.includes('val tableComponent: MarkdownComponent')) return s;
  const anchor = '    val code = DshType.mono12.copy(fontSize = 11.sp, lineHeight = 19.sp, color = c.labelPrimary)\n';
  return after(s, anchor, TABLE_COMPONENT);
});

edit('app/src/main/java/io/github/jackwener/dsh/core/designsystem/Content.kt', 'markdown components = tableComponent', (s) => {
  if (s.includes('components = markdownComponents(table = tableComponent)')) return s;
  const anchor = '        padding = markdownPadding(block = if (compact)';
  const i = s.indexOf(anchor);
  if (i < 0) return null;
  return s.slice(0, i) + '        components = markdownComponents(table = tableComponent),\n' + s.slice(i);
});

/* ---------- 3. PR#70 删除单个模型 ---------- */
const TRASH = [
  '                        IconBtn(R.drawable.dsw_trash_outline, {',
  '                            offered.remove(m); selected.remove(m); manual.remove(m); missing.remove(m)',
  '                            overrides.remove(m); imageOverrides.remove(m); reasoningDecls.remove(m)',
  '                            if (editing == m) editing = null',
  '                        }, size = 32.dp, iconSize = 14.dp, tint = c.labelTertiary, contentDescription = stringResource(R.string.prov_model_remove))',
  '',
].join('\n');

edit('app/src/main/java/io/github/jackwener/dsh/feature/settings/ProvidersUi.kt', 'per-model remove button', (s) => {
  if (s.includes('dsw_trash_outline')) return s;
  const anchor = 'contentDescription = stringResource(R.string.prov_model_limits))\n';
  return after(s, anchor, TRASH);
});

/* ---------- 4. 三套 strings ---------- */
const S = {
  'app/src/main/res/values/strings.xml': '删除这个模型',
  'app/src/main/res/values-en/strings.xml': 'Remove this model',
  'app/src/main/res/values-ru/strings.xml': 'Удалить эту модель',
};
for (const [f, text] of Object.entries(S)) {
  edit(f, 'string prov_model_remove (' + f + ')', (s) => {
    if (s.includes('name="prov_model_remove"')) return s;
    const m = /^.*<string name="prov_model_limits_hint">.*$/m.exec(s);
    if (!m) return null;
    const add = '\n    <string name="prov_model_remove">' + text + '</string>';
    const at = m.index + m[0].length;
    return s.slice(0, at) + add + s.slice(at);
  });
}

if (bad) { console.error('patch_fix: ' + bad + ' step(s) failed'); process.exit(1); }
console.log('patch_fix: all done');
