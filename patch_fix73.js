// 0.1.18: long-press the "new folder" icon to reorder folders (up / down), order persisted.
const fs = require('fs')
const root = process.argv[2] || '.'
const P = root + '/app/src/main/java/io/github/jackwener/dsh'
function edit(file, fn) {
  const p = P + file
  let s = fs.readFileSync(p, 'utf8')
  const before = s
  s = fn(s)
  if (s === before) { console.log('  ~ no change ' + file); return }
  fs.writeFileSync(p, s)
  console.log('  EDIT ' + file)
}
function must(s, from, to, tag) {
  if (!s.includes(from)) { console.log('ANCHOR ' + tag); process.exit(1) }
  return s.replace(from, to)
}

edit('/feature/conversation/SessionDrawer.kt', (s) => {
  if (s.includes('folder-order-dialog')) { console.log('  SKIP SessionDrawer'); return s }

  // 0) imports for the scrolling dialog
  s = must(s,
    'import androidx.compose.foundation.background',
    'import androidx.compose.foundation.background\nimport androidx.compose.foundation.rememberScrollState\nimport androidx.compose.foundation.verticalScroll',
    'imports')

  // 1) state
  s = must(s,
    '    var creating by remember { mutableStateOf(false) }',
    '    var creating by remember { mutableStateOf(false) }\n    var ordering by remember { mutableStateOf(false) }',
    'state')

  // 2) the folder+ icon also answers a long press
  s = must(s,
    `            IconBtn(R.drawable.ic_folder_plus, { creating = true }, size = if (compact) 34.dp else 40.dp, iconSize = 14.dp, tint = c.labelTertiary,
                contentDescription = stringResource(R.string.folder_new))`,
    `            Box(Modifier.size(if (compact) 34.dp else 40.dp).pressable({ creating = true }, Radius.sm, onLongClick = { ordering = true }), contentAlignment = Alignment.Center) {
                DIcon(R.drawable.ic_folder_plus, size = 14.dp, tint = c.labelTertiary, contentDescription = stringResource(R.string.folder_new))
            }`,
    'folder icon')

  // 3) folders follow the saved order
  s = must(s,
    '        val folders = remember(fver) { FolderStore.folders(fctx) }',
    '        val folders = remember(fver) { FolderStore.ordered(fctx) }',
    'ordered')

  // 4) the reorder dialog, right after the create dialog
  const createEnd = `            }) { DInput(fname, { fname = it }, placeholder = stringResource(R.string.folder_name_hint)) }
        }
`
  const dialog = `            }) { DInput(fname, { fname = it }, placeholder = stringResource(R.string.folder_name_hint)) }
        }
        // folder-order-dialog: 长按「新建文件夹」进来，上下箭头调整顺序
        if (ordering) {
            DDialog({ ordering = false }, stringResource(R.string.folder_order), buttons = {
                DButton(stringResource(R.string.close), { ordering = false }, variant = BtnVariant.Outline)
            }) {
                Column(Modifier.fillMaxWidth().heightIn(max = 340.dp).verticalScroll(rememberScrollState())) {
                    if (folders.isEmpty()) {
                        Text(stringResource(R.string.folder_empty), style = DshType.xs13, color = c.labelTertiary)
                    }
                    folders.forEachIndexed { i, f ->
                        Row(Modifier.fillMaxWidth().padding(vertical = 2.dp), verticalAlignment = Alignment.CenterVertically) {
                            Text(f.name, Modifier.weight(1f), style = DshType.s14, color = c.labelPrimary, maxLines = 1)
                            IconBtn(R.drawable.dsw_chevron_up_outline, { FolderStore.moveFolder(fctx, f.id, -1) },
                                size = 32.dp, iconSize = 14.dp, enabled = i > 0, tint = c.labelSecondary,
                                contentDescription = stringResource(R.string.folder_move_up))
                            IconBtn(R.drawable.dsw_chevron_down_outline, { FolderStore.moveFolder(fctx, f.id, 1) },
                                size = 32.dp, iconSize = 14.dp, enabled = i < folders.lastIndex, tint = c.labelSecondary,
                                contentDescription = stringResource(R.string.folder_move_down))
                        }
                    }
                }
            }
        }
`
  s = must(s, createEnd, dialog, 'order dialog')
  return s
})

const KEYS = [
  ['folder_order', '文件夹排序', 'Folder order'],
  ['folder_move_up', '上移', 'Move up'],
  ['folder_move_down', '下移', 'Move down'],
]
for (const [file, idx] of [['/app/src/main/res/values/strings.xml', 1], ['/app/src/main/res/values-en/strings.xml', 2]]) {
  const p = root + file
  let s = fs.readFileSync(p, 'utf8')
  if (s.includes('name="folder_order"')) { console.log('  SKIP strings ' + file); continue }
  const add = KEYS.map((k) => '    <string name="' + k[0] + '">' + k[idx] + '</string>\n').join('')
  fs.writeFileSync(p, s.replace('</resources>', add + '</resources>'))
  console.log('  EDIT strings ' + file)
}
console.log('fix73 OK')
