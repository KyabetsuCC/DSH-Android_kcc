const fs = require('fs'), path = require('path');
const root = process.argv[2] || '.';
let bad = 0;
const F = 'app/src/main/java/io/github/jackwener/dsh/feature/conversation/SessionDrawer.kt';
function read(f) { const p = path.join(root, f); return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null; }
function write(f, s) { fs.writeFileSync(path.join(root, f), s); }
function must(s, needle, tag) { if (!s.includes(needle)) { console.log('ANCHOR0 ' + tag); bad++; return false; } return true; }

let s = read(F);
if (s === null) { console.log('MISSING ' + F); process.exit(1); }
if (s.includes('FolderStore')) { console.log('SKIP already patched'); process.exit(0); }

// 1) imports
if (must(s, 'import androidx.compose.foundation.lazy.items', 'lazy.items')) {
  s = s.replace('import androidx.compose.foundation.lazy.items', 'import androidx.compose.foundation.lazy.items\nimport androidx.compose.foundation.lazy.LazyRow');
}

// 2) folder chip row inside the drawer, right before the search box
const chipRow = [
'        // dsh: 会话文件夹（手动分类，存 SharedPreferences）',
'        val fctx = androidx.compose.ui.platform.LocalContext.current',
'        val fver = FolderStore.version',
'        val folders = remember(fver) { FolderStore.folders(fctx) }',
'        val assign = remember(fver) { FolderStore.assignments(fctx) }',
'        var folderSel by remember { mutableStateOf("all") }',
'        var creating by remember { mutableStateOf(false) }',
'        LazyRow(Modifier.fillMaxWidth().padding(horizontal = 2.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {',
'            item { FolderChip(stringResource(R.string.folder_all), folderSel == "all") { folderSel = "all" } }',
'            item { FolderChip(stringResource(R.string.folder_none), folderSel == "none") { folderSel = "none" } }',
'            items(folders, key = { "f" + it.id }) { f ->',
'                FolderChip(f.name, folderSel == f.id) { folderSel = if (folderSel == f.id) "all" else f.id }',
'            }',
'            item { FolderChip("\uFF0B " + stringResource(R.string.folder_new), false) { creating = true } }',
'        }',
'        if (creating) {',
'            var fname by remember { mutableStateOf("") }',
'            DDialog({ creating = false }, stringResource(R.string.folder_new), buttons = {',
'                DButton(stringResource(R.string.cancel), { creating = false }, variant = BtnVariant.Outline)',
'                DButton(stringResource(R.string.save), {',
'                    if (fname.isNotBlank()) { FolderStore.addFolder(fctx, fname); folderSel = "all" }',
'                    creating = false',
'                }, enabled = fname.isNotBlank())',
'            }) { DInput(fname, { fname = it }, placeholder = stringResource(R.string.folder_name_hint)) }',
'        }',
''].join('\n');
const searchAnchor = '        if (searching) Box(Modifier.padding(horizontal = 2.dp, vertical = 4.dp)) {';
if (must(s, searchAnchor, 'search box')) s = s.replace(searchAnchor, chipRow + searchAnchor);

// 3) filter the list by the selected folder
const listAnchor = '            items(shown, key = { it.id }) { s ->';
if (must(s, listAnchor, 'items(shown)')) {
  s = s.replace(listAnchor, '            items(shown.filter { folderSel == "all" || (assign[it.id] ?: "none") == folderSel }, key = { it.id }) { s ->');
}

// 4) SessionRow: state, menu entry, picker dialog
s = s.replace(
  '    var renaming by remember { mutableStateOf(false) }',
  '    var renaming by remember { mutableStateOf(false) }\n    var moving by remember { mutableStateOf(false) }'
);
const renameItem = '            MenuItem(stringResource(R.string.rename), { menu = false; renaming = true }, R.drawable.dsw_edit_outline)';
if (must(s, renameItem, 'rename menu')) {
  s = s.replace(renameItem, renameItem + '\n' + '            MenuItem(stringResource(R.string.move_to_folder), { menu = false; moving = true }, R.drawable.ic_folder)');
}
const moveDialog = [
'    if (moving) {',
'        val fs = FolderStore.folders(context)',
'        val cur = FolderStore.assignments(context)[s.id]',
'        DDialog({ moving = false }, stringResource(R.string.move_to_folder), buttons = {',
'            DButton(stringResource(R.string.cancel), { moving = false }, variant = BtnVariant.Outline)',
'        }) {',
'            Column {',
'                Text(',
'                    stringResource(R.string.folder_none),',
'                    Modifier.fillMaxWidth().clip(Radius.sm).pressable({ FolderStore.assign(context, s.id, null); moving = false }, Radius.sm).padding(vertical = 10.dp),',
'                    style = DshType.s14, color = if (cur == null) c.business else c.labelPrimary,',
'                )',
'                fs.forEach { f ->',
'                    Text(',
'                        if (f.id == cur) "\u2713 " + f.name else f.name,',
'                        Modifier.fillMaxWidth().clip(Radius.sm).pressable({ FolderStore.assign(context, s.id, f.id); moving = false }, Radius.sm).padding(vertical = 10.dp),',
'                        style = DshType.s14, color = if (f.id == cur) c.business else c.labelPrimary,',
'                    )',
'                }',
'            }',
'        }',
'    }',
''].join('\n');
const deleteAnchor = '    if (deleting) DDialog({ deleting = false }, stringResource(R.string.delete_session_title), buttons = {';
if (must(s, deleteAnchor, 'delete dialog')) s = s.replace(deleteAnchor, moveDialog + deleteAnchor);

// 5) FolderChip composable at end of file
s = s.trimEnd() + '\n\n@Composable\nprivate fun FolderChip(label: String, selected: Boolean, onClick: () -> Unit) {\n    val c = Dsh.colors\n    Box(\n        Modifier.clip(Radius.md)\n            .background(if (selected) c.selector else androidx.compose.ui.graphics.Color.Transparent)\n            .pressable(onClick, Radius.md)\n            .padding(horizontal = 10.dp, vertical = 6.dp),\n    ) {\n        Text(label, style = DshType.xs13, color = if (selected) c.labelPrimary else c.labelTertiary, maxLines = 1)\n    }\n}\n';
write(F, s);
console.log('OK ' + F);

// 6) strings
const S = {
  'values/strings.xml': ['全部', '未分组', '新建文件夹', '文件夹名称', '移到文件夹'],
  'values-en/strings.xml': ['All', 'Ungrouped', 'New folder', 'Folder name', 'Move to folder'],
  'values-ru/strings.xml': ['Все', 'Без группы', 'Новая папка', 'Название папки', 'Переместить'],
};
const KEYS = ['folder_all', 'folder_none', 'folder_new', 'folder_name_hint', 'move_to_folder'];
for (const f of Object.keys(S)) {
  let x = read('app/src/main/res/' + f);
  if (x === null) { console.log('MISSING ' + f); bad++; continue; }
  if (x.includes('name="folder_all"')) { console.log('SKIP ' + f); continue; }
  const add = KEYS.map((k, i) => '    <string name="' + k + '">' + S[f][i] + '</string>').join('\n') + '\n';
  x = x.replace('</resources>', add + '</resources>');
  write('app/src/main/res/' + f, x);
  console.log('OK ' + f);
}
console.log(bad === 0 ? 'patch_fix27: all done' : 'patch_fix27: ' + bad + ' problem(s)');
process.exit(bad === 0 ? 0 : 1);
