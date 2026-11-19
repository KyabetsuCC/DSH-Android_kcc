// 0.1.23: browser ergonomics
//  - the address-bar clear button is a chevron-down ("put it down"), not a second X next to the close X
//  - the system Back gesture walks the page history first, and only closes the browser when there is none
//  - back/forward get bigger touch targets
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

edit('feature/browser/BrowserPage.kt', (s) => {
  let out = s

  // 1) clear button: chevron-down instead of a second X
  if (!out.includes('// browser-ergonomics')) {
    const xBtn = '                            R.drawable.ic_close, { typing = TextFieldValue("") }, size = 30.dp, iconSize = 13.dp,'
    if (!out.includes(xBtn)) throw new Error('ANCHOR clear btn')
    out = out.replace(
      xBtn,
      '                            // browser-ergonomics: put the draft down, not another X (the X beside it closes the browser).\n' +
      '                            R.drawable.dsw_chevron_down_outline, { typing = TextFieldValue("") }, size = 32.dp, iconSize = 15.dp,'
    )

    // 2) system Back walks the page history before it closes the browser
    const dlg = '    Dialog(onDismissRequest = onClose, properties = DialogProperties(usePlatformDefaultWidth = false)) {'
    if (!out.includes(dlg)) throw new Error('ANCHOR dialog')
    out = out.replace(
      dlg,
      '    // browser-ergonomics: the system Back gesture goes back in the page first; with no history left it closes.\n' +
      '    Dialog(\n' +
      '        onDismissRequest = { if (canBack) BrowserSession.back() else onClose() },\n' +
      '        properties = DialogProperties(usePlatformDefaultWidth = false),\n' +
      '    ) {'
    )

    // 3) bigger back / forward targets
    const backBtn = '                    R.drawable.dsw_chevron_left_outline, { BrowserSession.back() }, size = 36.dp,\n                    iconSize = 17.dp,'
    if (!out.includes(backBtn)) throw new Error('ANCHOR back btn')
    out = out.replace(backBtn, '                    R.drawable.dsw_chevron_left_outline, { BrowserSession.back() }, size = 40.dp,\n                    iconSize = 19.dp,')

    const fwdBtn = '                    R.drawable.dsw_chevron_right_outline, { BrowserSession.forward() }, size = 36.dp,\n                    iconSize = 17.dp,'
    if (!out.includes(fwdBtn)) throw new Error('ANCHOR forward btn')
    out = out.replace(fwdBtn, '                    R.drawable.dsw_chevron_right_outline, { BrowserSession.forward() }, size = 40.dp,\n                    iconSize = 19.dp,')
  }
  return out
})

console.log('fix78 OK')
