// landscape: persistent sidebar next to the conversation
const fs = require('fs');
const root = process.argv[2] || '.';
const P = root + '/app/src/main/java/io/github/jackwener/dsh/feature/conversation/HomeScreen.kt';
let s = fs.readFileSync(P, 'utf8');
if (s.includes('wideSidebar')) { console.log('fix55 SKIP'); process.exit(0); }
let bad = 0;
function rep(a, b, name) {
  if (!s.includes(a)) { console.log('ANCHOR ' + name); bad++; return; }
  s = s.replace(a, b);
  console.log('EDIT ' + name);
}

rep('import androidx.compose.foundation.layout.fillMaxWidth\n',
  'import androidx.compose.foundation.layout.fillMaxHeight\nimport androidx.compose.foundation.layout.fillMaxWidth\n', 'import');

rep('    ModalNavigationDrawer(\n',
  '    val wide = androidx.compose.ui.platform.LocalConfiguration.current.orientation == android.content.res.Configuration.ORIENTATION_LANDSCAPE\n' +
  '    var wideSidebar by remember { androidx.compose.runtime.mutableStateOf(true) }\n' +
  '    if (wide) {\n' +
  '        Row(Modifier.fillMaxSize().background(c.bgBase)) {\n' +
  '            if (wideSidebar) Box(Modifier.width(300.dp).fillMaxHeight().background(c.sidebar)) {\n' +
  '                SessionDrawer(\n' +
  '                    sessions, status, currentId,\n' +
  '                    onNew = { wideSidebar = true; vm.newSession(null) },\n' +
  '                    onOpen = { vm.open(it) },\n' +
  '                    onAutomation = { onAutomation() },\n' +
  '                    onSettings = { section -> onSettings(section) },\n' +
  '                    onClose = { wideSidebar = false },\n' +
  '                    onRename = vm::rename, onPin = vm::pin, onMute = vm::mute, onArchive = vm::archive, onDelete = vm::delete,\n' +
  '                )\n' +
  '            }\n' +
  '            Box(Modifier.weight(1f).fillMaxHeight()) {\n' +
  '                ConversationPane(vm, onMenu = { wideSidebar = !wideSidebar }, onSettings = onSettings, onAutomation = onAutomation)\n' +
  '            }\n' +
  '        }\n' +
  '        return\n' +
  '    }\n' +
  '    ModalNavigationDrawer(\n', 'wide block');

if (bad) { console.log('fix55 FAILED'); process.exit(1); }
fs.writeFileSync(P, s);
console.log('fix55 done');
