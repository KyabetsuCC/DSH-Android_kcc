// 0.1.8: the browser becomes a real, visible page. The WebView moves into a shared BrowserSession so
// the tools drive the very page the user is looking at, and cookies persist between runs.
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

// 1) BrowserTools: hand the WebView over to BrowserSession (same instance the page shows).
edit('/core/capability/tools/BrowserTools.kt', (s) => {
  if (s.includes('BrowserSession.hooks')) { console.log('  SKIP BrowserTools'); return s }
  s = must(s,
    "import io.github.jackwener.dsh.core.capability.CallContext",
    "import io.github.jackwener.dsh.core.capability.BrowserSession\nimport io.github.jackwener.dsh.core.capability.CallContext",
    'import')
  const old = `    @SuppressLint("SetJavaScriptEnabled")
    private suspend fun view(): WebView = withContext(Dispatchers.Main) {
        web ?: WebView(context).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.userAgentString = settings.userAgentString.replace("; wv", "")
            webViewClient = object : WebViewClient() {
                override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) { nav.started = true }
                override fun onPageFinished(view: WebView?, url: String?) { nav.let { if (it.started) it.done.complete(Unit) } }
            }
            val m = context.resources.displayMetrics
            measure(View.MeasureSpec.makeMeasureSpec(m.widthPixels, View.MeasureSpec.EXACTLY),
                View.MeasureSpec.makeMeasureSpec(m.heightPixels, View.MeasureSpec.EXACTLY))
            layout(0, 0, m.widthPixels, m.heightPixels)
        }.also { web = it }
    }`
  const neu = `    private suspend fun view(): WebView = withContext(Dispatchers.Main) {
        BrowserSession.hooks(
            started = { nav.started = true },
            finished = { nav.let { if (it.started) it.done.complete(Unit) } },
        )
        BrowserSession.web(context)
    }`
  return must(s, old, neu, 'view()')
})

// 2) HomeScreen: a globe in the title bar (only once a page is loaded) opening the visible browser.
edit('/feature/conversation/HomeScreen.kt', (s) => {
  if (s.includes('browserOpen')) { console.log('  SKIP HomeScreen'); return s }
  s = must(s,
    "import io.github.jackwener.dsh.feature.trajectory.TrajectoryView",
    "import io.github.jackwener.dsh.core.capability.BrowserSession\nimport io.github.jackwener.dsh.feature.browser.BrowserPage\nimport io.github.jackwener.dsh.feature.trajectory.TrajectoryView",
    'import')
  s = must(s,
    "    var copyPageOpen by remember { mutableStateOf(false) }",
    "    var copyPageOpen by remember { mutableStateOf(false) }\n    var browserOpen by remember { mutableStateOf(false) }",
    'state')
  s = must(s,
    `            if (!empty) IconBtn(R.drawable.ic_copy, { copyPageOpen = true }, size = 40.dp, iconSize = 18.dp, tint = c.labelSecondary,
                contentDescription = stringResource(R.string.copy_page_title))`,
    `            if (!empty) IconBtn(R.drawable.ic_copy, { copyPageOpen = true }, size = 40.dp, iconSize = 18.dp, tint = c.labelSecondary,
                contentDescription = stringResource(R.string.copy_page_title))
            if (BrowserSession.address.isNotBlank()) IconBtn(R.drawable.dsw_globe_outline, { browserOpen = true }, size = 40.dp, iconSize = 18.dp, tint = c.labelPrimary,
                contentDescription = stringResource(R.string.browser_title))`,
    'globe')
  s = must(s,
    "        if (copyPageOpen) CopyPage(conv.turns) { copyPageOpen = false }",
    "        if (copyPageOpen) CopyPage(conv.turns) { copyPageOpen = false }\n        if (browserOpen) BrowserPage { browserOpen = false }",
    'page')
  return s
})

// 3) strings: zh + en only (Russian is gone).
const KEYS = [
  ['browser_title', '浏览器', 'Browser'],
  ['browser_close', '关闭', 'Close'],
  ['browser_reload', '刷新', 'Reload'],
  ['browser_back', '后退', 'Back'],
  ['browser_forward', '前进', 'Forward'],
  ['browser_desktop', '桌面版', 'Desktop site'],
]
for (const [file, idx] of [['/app/src/main/res/values/strings.xml', 1], ['/app/src/main/res/values-en/strings.xml', 2]]) {
  const p = root + file
  let st = fs.readFileSync(p, 'utf8')
  if (st.includes('name="browser_title"')) { console.log('  SKIP strings ' + file); continue }
  const add = KEYS.map((k) => '    <string name="' + k[0] + '">' + k[idx] + '</string>\n').join('')
  fs.writeFileSync(p, st.replace('</resources>', add + '</resources>'))
  console.log('  EDIT strings ' + file)
}
console.log('fix67 OK')
