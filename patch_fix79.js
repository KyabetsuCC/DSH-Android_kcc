// 0.1.24: swap the two symbols in the browser top bar
//  - the address-bar clear button goes back to X (it clears the field)
//  - the browser close button becomes a chevron-down ("put the browser down")
const fs = require('fs')
const root = process.argv[2] || '.'
const P = root + '/app/src/main/java/io/github/jackwener/dsh/feature/browser/BrowserPage.kt'
let s = fs.readFileSync(P, 'utf8')

if (s.includes('// browser-close-chevron')) {
  console.log('  SKIP BrowserPage')
  console.log('fix79 OK')
  process.exit(0)
}

// 1) clear button: back to X, still really clearing the field
const clearOld = [
  '                            // browser-ergonomics: put the draft down, not another X (the X beside it closes the browser).',
  '                            R.drawable.dsw_chevron_down_outline, { typing = TextFieldValue("") }, size = 32.dp, iconSize = 15.dp,',
].join('\n')
if (!s.includes(clearOld)) { console.log('ANCHOR clear'); process.exit(1) }
s = s.replace(clearOld, [
  '                            // browser-close-chevron: X clears the field; the chevron beside it puts the browser down.',
  '                            R.drawable.ic_close, { typing = TextFieldValue("") }, size = 30.dp, iconSize = 13.dp,',
].join('\n'))

// 2) close button: chevron-down
const closeOld = [
  '                IconBtn(',
  '                    R.drawable.ic_close, onClose, size = 34.dp, iconSize = 16.dp,',
  '                    tint = Dsh.colors.labelSecondary, contentDescription = stringResource(R.string.browser_close),',
  '                )',
].join('\n')
if (!s.includes(closeOld)) { console.log('ANCHOR close'); process.exit(1) }
s = s.replace(closeOld, [
  '                IconBtn(',
  '                    R.drawable.dsw_chevron_down_outline, onClose, size = 36.dp, iconSize = 18.dp,',
  '                    tint = Dsh.colors.labelSecondary, contentDescription = stringResource(R.string.browser_close),',
  '                )',
].join('\n'))

fs.writeFileSync(P, s)
const open = (s.match(/\{/g) || []).length
const close = (s.match(/\}/g) || []).length
console.log('  EDIT BrowserPage  braces ' + open + '/' + close + '  bytes ' + s.length)
console.log('fix79 OK')
