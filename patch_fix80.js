const fs = require('fs')
const P = '/data/user/0/kyabetsu.cc.dsh/cache/tmp/w95/ws/app/src/main/java/io/github/jackwener/dsh/core/capability/tools/BrowserTools.kt'
const MARK = 'browser-home-tool'
let s = fs.readFileSync(P, 'utf8')
if (s.includes(MARK)) { console.log('SKIP BrowserTools (home tool)'); process.exit(0) }
const log = []

// 1) import the start-page shortcuts
const impAnchor = "import io.github.jackwener.dsh.core.model.ToolGroup\n"
if (!s.includes(impAnchor)) throw new Error('import anchor missing')
s = s.replace(impAnchor, impAnchor + "import io.github.jackwener.dsh.feature.browser.BookmarkStore\n")
log.push('import')

// 2) browser_open: a shortcut label opens that bookmark
const openOld = `            override suspend fun invoke(args: JsonObject, call: CallContext): ToolResult {
                var url = args.reqStr("url")
                if (!url.contains("://")) url = "https://$url"`
const openNew = `            override suspend fun invoke(args: JsonObject, call: CallContext): ToolResult {
                var url = args.reqStr("url").trim()
                // ${MARK}: a saved shortcut name opens that bookmark.
                val mark = BookmarkStore.all(context).firstOrNull {
                    !url.contains("://") && !url.contains('.') && it.label.equals(url, ignoreCase = true)
                }
                if (mark != null) url = mark.url
                if (!url.contains("://")) url = "https://$url"`
if (!s.includes(openOld)) throw new Error('browser_open anchor missing')
s = s.replace(openOld, openNew)
log.push('browser_open')

// 3) browser_home tool, right after browser_back
const backEnd = `                val n = newNav()
                withContext(Dispatchers.Main) { view().goBack() }
                awaitLoad(n, 10_000)
                return ToolResult.text(read())
            }
        },
`
if (!s.includes(backEnd)) throw new Error('browser_back anchor missing')
const homeTool = backEnd + `        object : Tool("browser_home", ToolGroup.Browser, Risk.read, false,
            "Go back to the browser start page and list the user's saved shortcuts (label + URL). Open one with browser_open, using its label as the url.", {}) {
            override suspend fun invoke(args: JsonObject, call: CallContext): ToolResult = withContext(Dispatchers.Main) {
                // ${MARK}: the start page is app UI, so the page itself cannot show it — report the shortcuts.
                BrowserSession.goHome()
                val marks = BookmarkStore.all(context)
                ToolResult.text(
                    "Start page. Saved shortcuts:\\n" +
                        marks.joinToString("\\n") { "- " + it.label + "  " + it.url } +
                        "\\n\\nOpen one with browser_open and the label as the url."
                )
            }
        },
`
s = s.replace(backEnd, homeTool)
log.push('browser_home')

fs.writeFileSync(P, s)
console.log('EDIT ' + log.join(', '))
