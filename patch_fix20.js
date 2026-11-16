// The bottom stretch that froze the conversation (#76-2): pinning while the list is ALREADY at its
// end scrolls into the overscroll region, and repeating that during a stream leaves the list stuck
// mid-stretch. Rule: if there is nothing below the viewport, do not touch the scroll at all.
const fs = require('fs')
const rel = '/app/src/main/java/io/github/jackwener/dsh/feature/conversation/Stream.kt'
const root = (process.argv[2] || '.') + rel
let src = fs.readFileSync(root, 'utf8')
let changed = 0, failed = 0
function rep(from, to, tag) {
  if (src.includes(to)) { console.log('SKIP ' + tag); return }
  if (!src.includes(from)) { console.log('MISS ' + tag); failed++; return }
  src = src.replace(from, to); console.log('OK   ' + tag); changed++
}
rep('        if (!follow || listState.isScrollInProgress) return@LaunchedEffect\n        val n = listState.layoutInfo.totalItemsCount\n',
    '        if (!follow || listState.isScrollInProgress) return@LaunchedEffect\n' +
    '        // Already showing the very end: pinning here would scroll into the overscroll region.\n' +
    '        if (!listState.canScrollForward) return@LaunchedEffect\n' +
    '        val n = listState.layoutInfo.totalItemsCount\n',
    'tailKey: never pin at the end')
fs.writeFileSync(root, src)
console.log('changed=' + changed + ' failed=' + failed)
if (failed) process.exit(1)
