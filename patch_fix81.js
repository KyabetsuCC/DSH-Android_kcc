const fs = require('fs')
const root = process.argv[2] || '.'
const R = root + '/app/src/main/res/values/themes.xml'
const S = root + '/app/src/main/java/io/github/jackwener/dsh/core/capability/BrowserSession.kt'
const M = root + '/app/src/main/java/io/github/jackwener/dsh/MainActivity.kt'
const B = root + '/app/src/main/java/io/github/jackwener/dsh/feature/browser/BrowserPage.kt'
const MARK = 'browser-dark'
const log = []

// ---------- 1) two WebView-only themes carrying isLightTheme ----------
let t = fs.readFileSync(R, 'utf8')
if (!t.includes(MARK)) {
  if (!t.includes('</resources>')) throw new Error('themes.xml anchor missing')
  const add = `    <!-- ${MARK}: a WebView takes prefers-color-scheme and isLightTheme from its own theme, not from Compose. -->
    <style name="Theme.Dsh.WebLight" parent="android:Theme.Material.Light.NoActionBar">
        <item name="android:isLightTheme">true</item>
        <item name="android:windowBackground">#FFFFFFFF</item>
    </style>
    <style name="Theme.Dsh.WebDark" parent="android:Theme.Material.NoActionBar">
        <item name="android:isLightTheme">false</item>
        <item name="android:windowBackground">#FF151517</item>
    </style>
`
  t = t.replace('</resources>', add + '</resources>')
  fs.writeFileSync(R, t, 'utf8')
  log.push('themes')
} else log.push('SKIP themes')

// ---------- 2) BrowserSession: dark-aware WebView ----------
let s = fs.readFileSync(S, 'utf8')
if (s.includes(MARK)) { console.log('SKIP BrowserSession (already patched)') }
else {
const impOld = "import android.content.Context\n"
if (!s.includes(impOld)) throw new Error('Context import missing')
s = s.replace(impOld, impOld +
  "import android.content.res.Configuration\n" +
  "import android.view.ContextThemeWrapper\n")
if (!s.includes("import io.github.jackwener.dsh.R\n")) {
  s = s.replace("import androidx.compose.runtime.setValue\n",
    "import androidx.compose.runtime.setValue\nimport io.github.jackwener.dsh.R\n")
}
log.push('imports')

const hooksEnd = `    fun hooks(started: () -> Unit, finished: () -> Unit) {
        onStarted = started
        onFinished = finished
    }
`
if (!s.includes(hooksEnd)) throw new Error('hooks anchor missing')
s = s.replace(hooksEnd, hooksEnd + `
    /** The app theme is dark: pages get dark colors and the view never flashes white. */
    var contentDark by mutableStateOf(false)
        private set

    /** ${MARK}: handed over from the Compose theme, because a WebView only reads the Android theme. */
    fun setDark(on: Boolean) {
        if (contentDark == on) return
        contentDark = on
        paint(if (on) DARK_BG else LIGHT_BG)
        for (w in views.values) {
            runCatching { w.setBackgroundColor(if (on) DARK_BG else LIGHT_BG) }
            runCatching { allowAutoDark(w) }
            runCatching { if (w.url != "about:blank") w.reload() }
        }
    }

    /** ${MARK}: WebView darkens sites without a dark stylesheet of their own; both APIs are reflection-only. */
    private fun allowAutoDark(w: WebView) {
        val done = runCatching {
            val m = w.settings.javaClass.getMethod("setAlgorithmicDarkeningAllowed", java.lang.Boolean.TYPE)
            m.invoke(w.settings, contentDark)
        }.isSuccess
        if (done) return
        runCatching {
            val m = w.settings.javaClass.getMethod("setForceDark", Integer.TYPE)
            val on = w.settings.javaClass.getField("FORCE_DARK_ON").getInt(null)
            val off = w.settings.javaClass.getField("FORCE_DARK_OFF").getInt(null)
            m.invoke(w.settings, if (contentDark) on else off)
        }
    }

    private fun paint(bg: Int) {
        runCatching { container?.setBackgroundColor(bg) }
    }

    /** A context whose configuration AND theme report the app's dark choice to the WebView. */
    private fun webContext(base: Context): Context {
        val cfg = Configuration(base.resources.configuration)
        cfg.uiMode = (cfg.uiMode and Configuration.UI_MODE_NIGHT_MASK.inv()) or
            if (contentDark) Configuration.UI_MODE_NIGHT_YES else Configuration.UI_MODE_NIGHT_NO
        return ContextThemeWrapper(
            base.createConfigurationContext(cfg),
            if (contentDark) R.style.Theme_Dsh_WebDark else R.style.Theme_Dsh_WebLight,
        )
    }
`)
log.push('state')

const makeOld = `        views[t.key]?.let { return it }
        val w = WebView(context)
`
if (!s.includes(makeOld)) throw new Error('WebView creation anchor missing')
s = s.replace(makeOld, `        views[t.key]?.let { return it }
        // ${MARK}: the theme decides prefers-color-scheme; the background kills the white flash.
        val w = WebView(webContext(context))
        w.setBackgroundColor(if (contentDark) DARK_BG else LIGHT_BG)
`)
log.push('webview')

const uaOld = `        w.settings.userAgentString = if (desktop) DESKTOP_UA else base
`
if (!s.includes(uaOld)) throw new Error('userAgent anchor missing')
s = s.replace(uaOld, uaOld + `        allowAutoDark(w)
`)
log.push('darkening')

// constants next to the other ones
const constOld = `    private const val RECEIPT_MS = 6_000L
`
if (!s.includes(constOld)) throw new Error('RECEIPT_MS anchor missing')
s = s.replace(constOld, constOld + `
    /** ${MARK}: the page and the frame behind it are painted so a load never flashes white. */
    private const val DARK_BG = 0xFF151517.toInt()
    private const val LIGHT_BG = 0xFFFFFFFF.toInt()
`)
log.push('consts')

// attach(): keep the frame behind the WebView painted too
const attachOld = `    fun attach(context: Context, parent: ViewGroup) {
        container = parent
`
if (!s.includes(attachOld)) throw new Error('attach anchor missing')
s = s.replace(attachOld, `    fun attach(context: Context, parent: ViewGroup) {
        container = parent
        paint(if (contentDark) DARK_BG else LIGHT_BG)
`)
log.push('attach')

fs.writeFileSync(S, s, 'utf8')
}

// ---------- 3) MainActivity: keep it in sync with the Compose theme ----------
let m = fs.readFileSync(M, 'utf8')
if (!m.includes(MARK)) {
  const old = `                LaunchedEffect(c.isDark) { account.darkTheme = c.isDark }`
  if (!m.includes(old)) throw new Error('theme effect anchor missing')
  m = m.replace(old, `                // ${MARK}: the browser page is a plain WebView, so the flag has to be handed over.
                LaunchedEffect(c.isDark) {
                    account.darkTheme = c.isDark
                    io.github.jackwener.dsh.core.capability.BrowserSession.setDark(c.isDark)
                }`)
  fs.writeFileSync(M, m, 'utf8')
  log.push('activity')
} else log.push('SKIP activity')

// ---------- 4) BrowserPage: paint the AndroidView frame as well ----------
let b = fs.readFileSync(B, 'utf8')
if (!b.includes(MARK)) {
  const old = `                    factory = { c -> FrameLayout(c).also { BrowserSession.attach(c, it) } },`
  if (!b.includes(old)) throw new Error('AndroidView factory anchor missing')
  b = b.replace(old, `                    factory = { c ->
                        // ${MARK}: the frame shows through while the first paint is pending.
                        FrameLayout(c).also {
                            it.setBackgroundColor(
                                if (BrowserSession.contentDark) 0xFF151517.toInt() else 0xFFFFFFFF.toInt(),
                            )
                            BrowserSession.attach(c, it)
                        }
                    },`)
  fs.writeFileSync(B, b, 'utf8')
  log.push('page')
} else log.push('SKIP page')

console.log(log.join(' / '))
