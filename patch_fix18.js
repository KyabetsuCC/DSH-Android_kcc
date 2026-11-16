// Sidebar <-> keyboard: opening the drawer always drops keyboard focus, so the IME never rides
// along with the sidebar and Back closes the drawer instead of a lingering keyboard.
// NOTE: LocalDensity.current / WindowInsets.ime must NOT be read inside BackHandler {...} — that
// lambda is not @Composable (compile error), and the drawer already clears focus on open.
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
rep('import androidx.compose.runtime.setValue\n',
    'import androidx.compose.runtime.setValue\nimport androidx.compose.ui.platform.LocalFocusManager\n',
    'import LocalFocusManager')
rep('    val drawer = rememberDrawerState(DrawerValue.Closed)\n    val scope = rememberCoroutineScope()\n',
    '    val drawer = rememberDrawerState(DrawerValue.Closed)\n    val scope = rememberCoroutineScope()\n    val focus = LocalFocusManager.current\n    // The IME must not ride along with the sidebar: opening the drawer always drops keyboard focus.\n    LaunchedEffect(drawer.isOpen) { if (drawer.isOpen) focus.clearFocus() }\n',
    'focus + drawer effect')
rep('onMenu = { scope.launch { drawer.open() } }', 'onMenu = { focus.clearFocus(); scope.launch { drawer.open() } }', 'onMenu clearFocus')
fs.writeFileSync(root, src)
console.log('changed=' + changed + ' failed=' + failed)
if (failed) process.exit(1)
