const fs = require('fs'), path = require('path');
const root = process.argv[2] || '.';
let bad = 0;
const Q = String.fromCharCode(34), BS = String.fromCharCode(92);
const NLKT = Q + BS + 'n' + Q;             // "\n" as Kotlin source
const F = 'app/src/main/java/io/github/jackwener/dsh/feature/conversation/SessionDrawer.kt';
const C = 'app/src/main/java/io/github/jackwener/dsh/feature/conversation/Composer.kt';
function read(f) { const p = path.join(root, f); return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null; }
function write(f, s) { fs.writeFileSync(path.join(root, f), s); }
function must(s, n, t) { if (!s.includes(n)) { console.log('ANCHOR0 ' + t); bad++; return false; } return true; }

/* ---------- SessionDrawer ---------- */
let s = read(F);
if (s === null) { console.log('MISSING ' + F); process.exit(1); }
if (s.includes('FolderHeader')) { console.log('SKIP drawer'); }
else {
  // state
  if (must(s, '        var creating by remember { mutableStateOf(false) }', 'creating state')) {
    s = s.replace('        var creating by remember { mutableStateOf(false) }',
      '        var creating by remember { mutableStateOf(false) }\n' +
      '        val collapsed = androidx.compose.runtime.mutableStateMapOf<String, Boolean>()\n' +
      '        var folderMenu by remember { mutableStateOf<String?>(null) }');
  }
const chipBlock = [
  '        LazyRow(Modifier.fillMaxWidth().padding(horizontal = 2.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {',
  '            item { FolderChip(stringResource(R.string.folder_all), folderSel == [Q]all[Q]) { folderSel = [Q]all[Q] } }',
  '            item { FolderChip(stringResource(R.string.folder_none), folderSel == [Q]none[Q]) { folderSel = [Q]none[Q] } }',
  '            items(folders, key = { [Q]f[Q] + it.id }) { f ->',
  '                FolderChip(f.name, folderSel == f.id) { folderSel = if (folderSel == f.id) [Q]all[Q] else f.id }',
  '            }',
  '            item { FolderChip(＋ + stringResource(R.string.folder_new), false) { creating = true } }',
  '        }',
].join('\n').replace(/\[Q\]/g, String.fromCharCode(34));
const header = [
  '        Row(Modifier.fillMaxWidth().padding(start = 8.dp, end = 4.dp), verticalAlignment = Alignment.CenterVertically) {',
  '            Text(stringResource(R.string.folder_group), Modifier.weight(1f), style = DshType.xs13m, color = Dsh.colors.labelTertiary)',
  '            IconBtn(R.drawable.ic_plus, { creating = true }, size = 34.dp, iconSize = 14.dp, tint = Dsh.colors.labelTertiary,',
  '                contentDescription = stringResource(R.string.folder_new))',
  '        }',
].join('\n');
  const cStart = s.indexOf('        LazyRow(Modifier.fillMaxWidth().padding(horizontal = 2.dp)');
  if (cStart < 0) { console.log('ANCHOR0 chip block'); bad++; }
  else {
    const cEnd = s.indexOf('\n        }\n', cStart);
    if (cEnd < 0) { console.log('ANCHOR0 chip end'); bad++; }
    else s = s.slice(0, cStart) + header + s.slice(cEnd + 10);
  }
  // chip row: long-press opens rename/delete
  const chipOld_UNUSED = '                FolderChip(f.name, folderSel == f.id) { folderSel = if (folderSel == f.id) "all" else f.id }';
  if (false) {
    s = s.replace(chipOld, '                FolderChip(f.name, folderSel == f.id,\n' +
      '                    { folderSel = if (folderSel == f.id) "all" else f.id },\n' +
      '                    { folderMenu = f.id })');
  }
  // rename / delete dialog
  const archiveComment = '        // dsh: 会话已归档，可 [撤销].';
  const menuDialog = [
'        folderMenu?.let { fid ->',
'            val f = folders.firstOrNull { it.id == fid }',
'            if (f != null) {',
'                var newName by remember(fid) { mutableStateOf(f.name) }',
'                DDialog({ folderMenu = null }, stringResource(R.string.folder_rename), buttons = {',
'                    DButton(stringResource(R.string.folder_delete), {',
'                        FolderStore.deleteFolder(fctx, fid)',
'                        folderMenu = null',
'                        folderSel = "all"',
'                    }, variant = BtnVariant.Outline)',
'                    DButton(stringResource(R.string.save), {',
'                        if (newName.isNotBlank()) FolderStore.renameFolder(fctx, fid, newName.trim())',
'                        folderMenu = null',
'                    }, enabled = newName.isNotBlank())',
'                }) { DInput(newName, { newName = it }, placeholder = stringResource(R.string.folder_name_hint)) }',
'            }',
'        }',
''].join('\n');
  if (must(s, archiveComment, 'archive comment')) s = s.replace(archiveComment, menuDialog + archiveComment);

  // grouped list when 全部
  const rowCall = '                SessionRow(s, status[s.id] ?: RowStatus.Idle, s.id == currentId, now, { onOpen(s.id) }, onRename, onPin, onMute, archive, onDelete)';
  const itemsOld = '            items(shown.filter { folderSel == "all" || (assign[it.id] ?: "none") == folderSel }, key = { it.id }) { s ->\n' + rowCall + '\n            }';
  const grouped = [
'            if (folderSel == "all") {',
'                folders.forEach { f ->',
'                    val kids = shown.filter { assign[it.id] == f.id }',
'                    run {',
'                        item(key = "h" + f.id) {',
'                            FolderHeader(f.name, kids.size, collapsed[f.id] == true, { collapsed[f.id] = collapsed[f.id] != true }, { folderMenu = f.id })',
'                        }',
'                        if (collapsed[f.id] != true && kids.isEmpty()) item(key = \'e\' + f.id) { EmptyNote(stringResource(R.string.folder_empty)) }\n                        if (collapsed[f.id] != true) items(kids, key = { it.id }) { s ->',
rowCall,
'                        }',
'                    }',
'                }',
'                val loose = shown.filter { assign[it.id] == null }',
'                if (loose.isNotEmpty()) {',
'                    item(key = "h-loose") {',
'                        FolderHeader(stringResource(R.string.folder_none), loose.size, collapsed["__none"] == true) { collapsed["__none"] = collapsed["__none"] != true }',
'                    }',
'                    if (collapsed["__none"] != true) items(loose, key = { it.id }) { s ->',
rowCall,
'                    }',
'                }',
'            } else {',
'                items(shown.filter { (assign[it.id] ?: "none") == folderSel }, key = { it.id }) { s ->',
rowCall,
'                }',
'            }'].join('\n');
  if (must(s, itemsOld, 'items block')) s = s.replace(itemsOld, grouped);

  // composables: chip with long-press + folder header
  const chipIdx = s.indexOf('@Composable\nprivate fun FolderChip(');
  if (chipIdx > 0) s = s.slice(0, chipIdx).trimEnd() + '\n';
  s += [
'',
'@Composable',
'private fun FolderChip(label: String, selected: Boolean, onClick: () -> Unit, onLongClick: () -> Unit) {',
'    val c = Dsh.colors',
'    Box(',
'        Modifier.clip(Radius.md)',
'            .background(if (selected) c.selector else androidx.compose.ui.graphics.Color.Transparent)',
'            .pressable(onClick, Radius.md, onLongClick = onLongClick)',
'            .padding(horizontal = 10.dp, vertical = 6.dp),',
'    ) {',
'        Text(label, style = DshType.xs13, color = if (selected) c.labelPrimary else c.labelTertiary, maxLines = 1)',
'    }',
'}',
'',
'@Composable',
'private fun FolderHeader(label: String, count: Int, collapsed: Boolean, onToggle: () -> Unit, onLongClick: () -> Unit) {',
'    val c = Dsh.colors',
'    Row(',
'        Modifier.fillMaxWidth().heightIn(min = 34.dp).clip(Radius.sm).pressable(onToggle, Radius.sm, onLongClick = onLongClick).padding(start = 2.dp, end = 8.dp),',
'        verticalAlignment = Alignment.CenterVertically,',
'    ) {',
'        DIcon(R.drawable.ic_folder, size = 12.dp, tint = c.labelTertiary)',
'        Spacer(Modifier.width(6.dp))',
'        Text(label + " · " + count, Modifier.weight(1f), style = DshType.xs13m, color = c.labelSecondary, maxLines = 1, overflow = TextOverflow.Ellipsis)',
'        Text(if (collapsed) "\uFF0B" else "\u2212", style = DshType.xs13m, color = c.labelTertiary)',
'    }',
'}',
''].join('\n');
  write(F, s);
  console.log('OK ' + F);
}

/* ---------- Composer: long-press send = newline ---------- */
let k = read(C);
if (k === null) { console.log('MISSING ' + C); bad++; }
else if (k.includes('onNewline')) console.log('SKIP composer');
else {
  const sig = 'fun SendButton(running: Boolean, empty: Boolean, onSend: () -> Unit, onStop: () -> Unit) {';
  if (must(k, sig, 'SendButton sig')) {
    k = k.replace(sig, 'fun SendButton(running: Boolean, empty: Boolean, onSend: () -> Unit, onStop: () -> Unit, onNewline: () -> Unit = {}) {');
  }
  const press = '.pressable({ if (stop) onStop() else if (!empty) onSend() }, CircleShape, enabled)';
  if (must(k, press, 'pressable')) {
    k = k.replace(press, '.pressable({ if (stop) onStop() else if (!empty) onSend() }, CircleShape, enabled, onLongClick = { if (!stop) onNewline() })');
  }
  const call = '            }, onStop)';
  if (must(k, call, 'call site')) {
    k = k.replace(call, '            }, onStop, onNewline = { if (!running) state.text = state.text + ' + NLKT + ' })');
  }
  write(C, k);
  console.log('OK ' + C);
}

/* ---------- strings ---------- */
const KEYS = ['usage_month_meta', 'folder_rename', 'folder_delete', 'folder_group', 'folder_empty'];
const S = {
  'values/strings.xml': ['本月合计 · %1$d 天有记录', '重命名文件夹', '删除文件夹', '文件夹', '暂无会话'],
  'values-en/strings.xml': ['This month · %1$d days', 'Rename folder', 'Delete folder', 'Folders', 'No chats yet'],
  'values-ru/strings.xml': ['Этот месяц · дней: %1$d', 'Переименовать папку', 'Удалить папку', 'Папки', 'Нет чатов'],
};
for (const f of Object.keys(S)) {
  let x = read('app/src/main/res/' + f);
  if (x === null) { console.log('MISSING ' + f); bad++; continue; }
  if (x.includes('name="usage_month_meta"')) { console.log('SKIP ' + f); continue; }
  const add = KEYS.map((kk, i) => '    <string name="' + kk + '">' + S[f][i] + '</string>').join('\n') + '\n';
  x = x.replace('</resources>', add + '</resources>');
  write('app/src/main/res/' + f, x);
  console.log('OK ' + f);
}
console.log(bad === 0 ? 'patch_fix28: all done' : 'patch_fix28: ' + bad + ' problem(s)');
process.exit(bad === 0 ? 0 : 1);
