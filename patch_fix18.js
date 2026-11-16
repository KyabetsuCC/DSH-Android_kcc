// Sidebar <-> keyboard (issue #76-4 family): the IME must not ride along with the drawer,
// and Back closes the keyboard first, the drawer only on the next press.
const fs = require('fs')
const rel = '/app/src/main/java/io/github/jackwener/dsh/feature/conversation/HomeScreen.kt'
const root = (process.argv[2] || '.') + rel
let src = fs.readFileSync(root, 'utf8')
let changed = 0, failed = 0
function rep(from, to, tag) {
  if (src.includes(to)) { console.log('SKIP ' + tag); return }
  if (!src.includes(from)) { console.log('MISS ' + tag); failed++; return }
  src = src.replace(from, to); console.log('OK   ' + tag); changed++
}
rep('import androidx.compose.foundation.layout.imePadding\n',
    'import androidx.compose.foundation.layout.WindowInsets\nimport androidx.compose.foundation.layout.ime\nimport androidx.compose.foundation.layout.imePadding\n',
    'import WindowInsets/ime')
rep('import androidx.compose.runtime.setValue\n',
    'import androidx.compose.runtime.setValue\nimport androidx.compose.ui.platform.LocalDensity\nimport androidx.compose.ui.platform.LocalFocusManager\n',
    'import LocalDensity/LocalFocusManager')
rep('    val drawer = rememberDrawerState(DrawerValue.Closed)\n    val scope = rememberCoroutineScope()\n',
    '    val drawer = rememberDrawerState(DrawerValue.Closed)\n    val scope = rememberCoroutineScope()\n    val focus = LocalFocusManager.current\n    // The IME must not ride along with the sidebar: opening the drawer always drops keyboard focus.\n    LaunchedEffect(drawer.isOpen) { if (drawer.isOpen) focus.clearFocus() }\n',
    'focus + drawer effect')
rep('    BackHandler(drawer.isOpen) { scope.launch { drawer.close() } }\n',
    '    BackHandler(drawer.isOpen) {\n        if (WindowInsets.ime.getBottom(LocalDensity.current) > 0) focus.clearFocus()\n        else scope.launch { drawer.close() }\n    }\n',
    'BackHandler ime-first')
rep('onMenu = { scope.launch { drawer.open() } }', 'onMenu = { focus.clearFocus(); scope.launch { drawer.open() } }', 'onMenu clearFocus')
fs.writeFileSync(root, src)
console.log('changed=' + changed + ' failed=' + failed)
if (failed) process.exit(1)
