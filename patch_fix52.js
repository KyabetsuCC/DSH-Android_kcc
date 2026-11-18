// drag sessions into folders
const fs = require('fs');
const root = process.argv[2] || '.';
const P = root + '/app/src/main/java/io/github/jackwener/dsh/feature/conversation/SessionDrawer.kt';
let bad = 0;
if (fs.readFileSync(P, 'utf8').includes('onDragTo(startY + acc)')) { console.log('fix52 SKIP'); process.exit(0); }
function rep(a, b, name) {
  let s = fs.readFileSync(P, 'utf8');
  if (!s.includes(a)) { console.log('ANCHOR ' + name); bad++; return; }
  if (s.includes(b.split('\n')[0]) && b.split('\n')[0].trim() && s.includes(b.trim())) { console.log('SKIP ' + name); return; }
  s = s.replace(a, b);
  fs.writeFileSync(P, s);
  console.log('EDIT ' + name);
}

// 1) imports
rep('import androidx.compose.runtime.mutableStateOf\n',
  'import androidx.compose.runtime.mutableStateOf\n' +
  'import androidx.compose.runtime.mutableFloatStateOf\n' +
  'import androidx.compose.foundation.gestures.detectDragGesturesAfterLongPress\n' +
  'import androidx.compose.ui.input.pointer.pointerInput\n' +
  'import androidx.compose.ui.layout.boundsInRoot\n' +
  'import androidx.compose.ui.layout.onGloballyPositioned\n' +
  'import androidx.compose.ui.graphics.graphicsLayer\n', 'imports');

// 2) drag states
rep('        val assign = remember(fver) { FolderStore.assignments(fctx) }\n',
  '        val assign = remember(fver) { FolderStore.assignments(fctx) }\n' +
  '        var dragId by remember { mutableStateOf<String?>(null) }\n' +
  '        var hoverFolder by remember { mutableStateOf<String?>(null) }\n' +
  '        val folderRanges = remember { androidx.compose.runtime.mutableStateMapOf<String, kotlin.ranges.ClosedFloatingPointRange<Float>>() }\n', 'states');

// 3) folder header item: track bounds + highlight
rep('                        item(key = "h" + f.id) {\n' +
    '                            FolderHeader(f.name, kids.size, collapsed[f.id] == true, { collapsed[f.id] = collapsed[f.id] != true }, { folderMenu = f.id })\n' +
    '                        }\n',
  '                        item(key = "h" + f.id) {\n' +
  '                            androidx.compose.foundation.layout.Box(androidx.compose.ui.Modifier.onGloballyPositioned { co -> val b = co.boundsInRoot(); folderRanges[f.id] = b.top..b.bottom }) {\n' +
  '                                FolderHeader(f.name, kids.size, collapsed[f.id] == true, { collapsed[f.id] = collapsed[f.id] != true }, { folderMenu = f.id }, highlight = hoverFolder == f.id)\n' +
  '                            }\n' +
  '                        }\n', 'header item');

// 4) FolderHeader signature + highlight background
rep('private fun FolderHeader(label: String, count: Int, collapsed: Boolean, onToggle: () -> Unit, onLongClick: () -> Unit) {',
  'private fun FolderHeader(label: String, count: Int, collapsed: Boolean, onToggle: () -> Unit, onLongClick: () -> Unit, highlight: Boolean = false) {', 'header sig');
rep('Modifier.fillMaxWidth().heightIn(min = 34.dp).clip(Radius.sm).pressable(onToggle, Radius.sm, onLongClick = onLongClick).padding(start = 2.dp, end = 8.dp)',
  'Modifier.fillMaxWidth().heightIn(min = 34.dp).clip(Radius.sm).background(if (highlight) c.hoverSolid else androidx.compose.ui.graphics.Color.Transparent, Radius.sm).pressable(onToggle, Radius.sm, onLongClick = onLongClick).padding(start = 2.dp, end = 8.dp)', 'header bg');

// 5) SessionRow signature
rep('    onArchive: (String, Boolean) -> Unit, onDelete: (String) -> Unit,\n) {',
  '    onArchive: (String, Boolean) -> Unit, onDelete: (String) -> Unit,\n' +
  '    dragging: Boolean = false, onDragStart: () -> Unit = {}, onDragTo: (Float) -> Unit = {}, onDragEnd: () -> Unit = {},\n) {', 'row sig');
rep('    var deleting by remember { mutableStateOf(false) }\n',
  '    var deleting by remember { mutableStateOf(false) }\n    var rowTop by remember { mutableFloatStateOf(0f) }\n', 'row top state');

// 6) row modifier: long press now starts drag, menu stays on the ellipsis button
rep('            .pressable(onClick, Radius.md, onLongClick = { menu = true }).padding(start = 8.dp), verticalAlignment = Alignment.CenterVertically) {',
  '            .graphicsLayer(alpha = if (dragging) 0.45f else 1f)\n' +
  '            .onGloballyPositioned { rowTop = it.boundsInRoot().top }\n' +
  '            .pointerInput(s.id) {\n' +
  '                var startY = 0f\n' +
  '                var acc = 0f\n' +
  '                detectDragGesturesAfterLongPress(\n' +
  '                    onDragStart = { off -> startY = rowTop + off.y; acc = 0f; onDragStart() },\n' +
  '                    onDrag = { change, amount -> change.consume(); acc += amount.y; onDragTo(startY + acc) },\n' +
  '                    onDragEnd = { onDragEnd() },\n' +
  '                    onDragCancel = { onDragEnd() },\n' +
  '                )\n' +
  '            }\n' +
  '            .pressable(onClick, Radius.md).padding(start = 8.dp), verticalAlignment = Alignment.CenterVertically) {', 'row modifier');

// 7) all three call sites
{
  let s = fs.readFileSync(P, 'utf8');
  const a = 'SessionRow(s, status[s.id] ?: RowStatus.Idle, s.id == currentId, now, { onOpen(s.id) }, onRename, onPin, onMute, archive, onDelete)';
  const b = 'SessionRow(s, status[s.id] ?: RowStatus.Idle, s.id == currentId, now, { onOpen(s.id) }, onRename, onPin, onMute, archive, onDelete,\n' +
    '                    dragging = dragId == s.id,\n' +
    '                    onDragStart = { dragId = s.id },\n' +
    '                    onDragTo = { y -> hoverFolder = folderRanges.entries.firstOrNull { y in it.value }?.key },\n' +
    '                    onDragEnd = { val t = hoverFolder; if (dragId != null && t != null) FolderStore.assign(fctx, dragId!!, t); dragId = null; hoverFolder = null })';
  const n = s.split(a).length - 1;
  if (n === 0) { if (s.includes('dragging = dragId == s.id')) console.log('SKIP call sites'); else { console.log('ANCHOR call sites'); bad++; } }
  else { s = s.split(a).join(b); fs.writeFileSync(P, s); console.log('EDIT call sites x' + n); }
}

if (bad) { console.log('fix52 FAILED'); process.exit(1); }
console.log('fix52 done');
