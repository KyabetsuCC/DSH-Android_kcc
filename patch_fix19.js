// Keyboard: when the IME opens it shrinks this pane. If the reader was following the tail, keep the
// newest message visible instead of parking it behind the keyboard. Nobody else is moved.
// (No WindowInsets.ime API: the pane's own size change is the signal, so this cannot break on a BOM bump.)
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
rep('import androidx.compose.runtime.mutableStateOf\n',
    'import androidx.compose.runtime.mutableStateOf\nimport androidx.compose.runtime.mutableIntStateOf\nimport androidx.compose.ui.layout.onSizeChanged\n',
    'imports')
rep('    Box(modifier) {\n        LazyColumn(Modifier.fillMaxSize(), state = listState,',
    '    // The IME shrinks this pane: if the reader was already on the tail, keep the newest message in sight.\n' +
    '    var lastPaneHeight by remember { mutableIntStateOf(0) }\n' +
    '    Box(modifier.onSizeChanged { size ->\n' +
    '        val shrunk = lastPaneHeight != 0 && size.height < lastPaneHeight\n' +
    '        lastPaneHeight = size.height\n' +
    '        if (shrunk && follow && !listState.isScrollInProgress) {\n' +
    '            scope.launch {\n' +
    '                val n = listState.layoutInfo.totalItemsCount\n' +
    '                if (n > 0) {\n' +
    '                    listState.scrollToItem(n - 1)\n' +
    '                    if (listState.canScrollForward) listState.scrollBy(100000f)\n' +
    '                }\n' +
    '            }\n' +
    '        }\n' +
    '    }) {\n        LazyColumn(Modifier.fillMaxSize(), state = listState,',
    'pane onSizeChanged')
fs.writeFileSync(root, src)
console.log('changed=' + changed + ' failed=' + failed)
if (failed) process.exit(1)
