// 0.1.22: browser home tweaks
//  - the X in the address bar really clears the field (it used to drop the draft and fall back to the url)
//  - a stale draft is dropped when the page navigates
//  - long-press a shortcut opens up/down/delete, so the start page can be reordered
const fs = require('fs')
const root = process.argv[2] || '.'

function edit(rel, fn) {
  const p = root + '/app/src/main/java/io/github/jackwener/dsh/' + rel
  let s = fs.readFileSync(p, 'utf8')
  const before = s
  s = fn(s)
  if (s === before) { console.log('  SKIP ' + rel.split('/').pop()); return }
  fs.writeFileSync(p, s)
  const open = (s.match(/\{/g) || []).length
  const close = (s.match(/\}/g) || []).length
  console.log('  EDIT ' + rel.split('/').pop() + '  braces ' + open + '/' + close + '  bytes ' + s.length)
}

// ---- BookmarkStore: reordering ---------------------------------------------------------------
edit('feature/browser/BookmarkStore.kt', (s) => {
  if (s.includes('bookmark-reorder')) return s
  const anchor = '    fun reset(c: Context) {'
  if (!s.includes(anchor)) throw new Error('ANCHOR reset')
  const add = [
    '    // bookmark-reorder: the start page order is the file order.',
    '    fun move(c: Context, url: String, delta: Int) {',
    '        val list = all(c).toMutableList()',
    '        val from = list.indexOfFirst { it.url == url }',
    '        if (from < 0) return',
    '        val to = (from + delta).coerceIn(0, list.lastIndex)',
    '        if (to == from) return',
    '        list.add(to, list.removeAt(from))',
    '        save(c, list)',
    '    }',
    '',
    '',
  ].join('\n')
  return s.replace(anchor, add + anchor)
})

// ---- BrowserPage: clear button + long-press menu ----------------------------------------------
edit('feature/browser/BrowserPage.kt', (s) => {
  let out = s
  if (!out.includes('bookmark-reorder-ui')) {
    // state: the shortcut being reordered, next to the delete confirmation
    if (!out.includes('var removing by remember')) throw new Error('ANCHOR removing state')
    out = out.replace(
      '    var removing by remember { mutableStateOf<Bookmark?>(null) }',
      '    var removing by remember { mutableStateOf<Bookmark?>(null) }\n' +
      '    var editing by remember { mutableStateOf<Bookmark?>(null) } // bookmark-reorder-ui'
    )

    // a stale draft must not survive a navigation
    if (!out.includes('LaunchedEffect(Unit) { if (tabs.isEmpty())')) throw new Error('ANCHOR launcher')
    out = out.replace(
      '    LaunchedEffect(Unit) { if (tabs.isEmpty()) BrowserSession.newTab(context) }',
      '    LaunchedEffect(Unit) { if (tabs.isEmpty()) BrowserSession.newTab(context) }\n' +
      '    // bookmark-reorder-ui: a draft typed for the previous page is dropped once the page changes.\n' +
      '    LaunchedEffect(address) { if (typing?.text.isNullOrEmpty()) typing = null }'
    )

    // the X clears the field instead of restoring the current url
    const xBtn = '                            R.drawable.ic_close, { typing = null }, size = 30.dp, iconSize = 13.dp,'
    if (!out.includes(xBtn)) throw new Error('ANCHOR clear btn')
    out = out.replace(xBtn, '                            R.drawable.ic_close, { typing = TextFieldValue("") }, size = 30.dp, iconSize = 13.dp,')

    // long-press opens the reorder menu
    const lp = '                        onLongPress = { b -> removing = b },'
    if (!out.includes(lp)) throw new Error('ANCHOR onLongPress')
    out = out.replace(lp, '                        onLongPress = { b -> editing = b },')

    // the menu itself, right before the delete confirmation
    const del = '    removing?.let { b ->'
    if (!out.includes(del)) throw new Error('ANCHOR removing dialog')
    const menu = [
      '    editing?.let { b ->',
      '        DDialog(',
      '            onDismiss = { editing = null },',
      '            title = b.label,',
      '            buttons = {',
      '                DButton(stringResource(R.string.folder_move_up), {',
      '                    BookmarkStore.move(context, b.url, -1)',
      '                    editing = null',
      '                }, variant = BtnVariant.Outline)',
      '                DButton(stringResource(R.string.folder_move_down), {',
      '                    BookmarkStore.move(context, b.url, 1)',
      '                    editing = null',
      '                }, variant = BtnVariant.Outline)',
      '                DButton(stringResource(R.string.browser_bookmark_delete), {',
      '                    editing = null',
      '                    removing = b',
      '                }, variant = BtnVariant.Danger)',
      '            },',
      '        ) {',
      '            Text(b.url, style = DshType.xxs12, color = Dsh.colors.labelTertiary)',
      '        }',
      '    }',
      '',
    ].join('\n')
    out = out.replace(del, menu + del)
  }
  return out
})

console.log('fix77 OK')
