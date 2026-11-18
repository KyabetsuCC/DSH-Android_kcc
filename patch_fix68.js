// 0.1.9: the browser is the user's too - the globe is always in the title bar, the sidebar gets a
// browser entry, and a blank page offers a few quick links so the user can sign in before the agent runs.
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

// 1) HomeScreen: the globe no longer waits for a page - the user may want to open one first.
edit('/feature/conversation/HomeScreen.kt', (s) => {
  if (s.includes('browser-globe-always')) { console.log('  SKIP HomeScreen globe'); return s }
  s = must(s,
    "            if (BrowserSession.address.isNotBlank()) IconBtn(R.drawable.dsw_globe_outline, { browserOpen = true }, size = 40.dp, iconSize = 18.dp, tint = c.labelPrimary,",
    "            // browser-globe-always: the user opens the browser as well, e.g. to sign in first.\n            IconBtn(R.drawable.dsw_globe_outline, { browserOpen = true }, size = 40.dp, iconSize = 18.dp, tint = c.labelSecondary,",
    'globe always')
  return s
})

// 2) Sidebar: a browser panel entry, so the browser is reachable without a session.
edit('/feature/conversation/SessionDrawer.kt', (s) => {
  if (s.includes('browserOpen')) { console.log('  SKIP SessionDrawer'); return s }
  s = must(s,
    "import io.github.jackwener.dsh.core.designsystem.pressable",
    "import io.github.jackwener.dsh.core.designsystem.pressable\nimport io.github.jackwener.dsh.feature.browser.BrowserPage",
    'import')
  s = must(s,
    "    var notesOpen by remember { mutableStateOf(false) }",
    "    var notesOpen by remember { mutableStateOf(false) }\n    var browserOpen by remember { mutableStateOf(false) }",
    'state')
  s = must(s,
    "        PanelEntry(R.drawable.dsw_cordis_plugin_outline, stringResource(R.string.drawer_extensions)) { onSettings(\"Extensions\") }",
    "        PanelEntry(R.drawable.dsw_cordis_plugin_outline, stringResource(R.string.drawer_extensions)) { onSettings(\"Extensions\") }\n        PanelEntry(R.drawable.dsw_globe_outline, stringResource(R.string.browser_title)) { browserOpen = true }",
    'entry')
  s = must(s,
    "        if (notesOpen) SnippetOverlay(onClose = { notesOpen = false })",
    "        if (notesOpen) SnippetOverlay(onClose = { notesOpen = false })\n        if (browserOpen) BrowserPage { browserOpen = false }",
    'overlay')
  return s
})

const KEYS = [['browser_home_hint', '输入网址，或选择下面的站点', 'Type an address, or pick a site below']]
for (const [file, idx] of [['/app/src/main/res/values/strings.xml', 1], ['/app/src/main/res/values-en/strings.xml', 2]]) {
  const p = root + file
  let s = fs.readFileSync(p, 'utf8')
  if (s.includes('name="browser_home_hint"')) { console.log('  SKIP strings ' + file); continue }
  const add = KEYS.map((k) => '    <string name="' + k[0] + '">' + k[idx] + '</string>\n').join('')
  fs.writeFileSync(p, s.replace('</resources>', add + '</resources>'))
  console.log('  EDIT strings ' + file)
}
console.log('fix68 OK')
