package io.github.jackwener.dsh.core.capability

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Bitmap
import android.view.View
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue

/** One open tab: its own WebView, its own history, and the Compose state its strip entry shows. */
class BrowserTab internal constructor(val key: Long) {
    var address by mutableStateOf("")
    var pageTitle by mutableStateOf("")
    var loading by mutableStateOf(false)
    var progress by mutableIntStateOf(0)
    var canBack by mutableStateOf(false)
    var canForward by mutableStateOf(false)

    /** True while the start page (search field + shortcuts) is what this tab shows. */
    var home by mutableStateOf(true)
}

/**
 * The in-app browser: one session shared by the agent's browser tools and the on-screen page, so the
 * user can watch the agent work, sign in first, and open extra tabs for themselves. Cookie jars are the
 * WebView's own, so logins survive both the tools and the user.
 */
object BrowserSession {
    const val DESKTOP_UA =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) " +
            "Chrome/126.0.0.0 Safari/537.36"

    var desktop by mutableStateOf(false)
        private set

    val tabs = mutableStateListOf<BrowserTab>()

    var activeIndex by mutableIntStateOf(0)
        private set

    val active: BrowserTab? get() = tabs.getOrNull(activeIndex)

    private val views = HashMap<Long, WebView>()
    private var seq = 0L
    private var container: ViewGroup? = null
    private var mobileUa: String? = null

    private var onStarted: () -> Unit = {}
    private var onFinished: () -> Unit = {}

    fun hooks(started: () -> Unit, finished: () -> Unit) {
        onStarted = started
        onFinished = finished
    }

    /** True from the first browser call of a turn until that turn ends: the dot and the banner read this. */
    var agentBusy by mutableStateOf(false)
        private set

    /** The running browser tool, e.g. "browser_click"; empty while the agent thinks between calls. */
    var agentLabel by mutableStateOf("")
        private set

    /** Browser steps the agent took during the current turn. */
    var agentSteps by mutableIntStateOf(0)
        private set

    /** Steps of the turn that just ended, shown as a receipt until the page clears it. */
    var agentFinished by mutableIntStateOf(0)
        private set

    private var turnSteps = 0
    private var lastCallAt = 0L
    private val watchdog = android.os.Handler(android.os.Looper.getMainLooper())
    private val watchdogTask = Runnable {
        if (agentBusy && System.currentTimeMillis() - lastCallAt >= WATCHDOG_MS) agentTurnEnd()
    }
    private val receiptTask = Runnable { if (!agentBusy) agentReceiptDone() }

    /** An agent browser tool started: the dot lights up on the turn's first call and stays lit after it. */
    fun agentBegin(label: String) {
        if (!agentBusy) {
            turnSteps = 0
            agentFinished = 0
        }
        turnSteps += 1
        agentSteps = turnSteps
        agentLabel = label
        agentBusy = true
        lastCallAt = System.currentTimeMillis()
        watchdog.removeCallbacks(watchdogTask)
        watchdog.removeCallbacks(receiptTask)
    }

    /** The call finished: the dot stays lit, the same turn may call more browser tools. */
    fun agentEnd() {
        agentLabel = ""
        lastCallAt = System.currentTimeMillis()
        watchdog.removeCallbacks(watchdogTask)
        watchdog.postDelayed(watchdogTask, WATCHDOG_MS)
    }

    /** The turn is over: the dot goes out and the receipt keeps the step count for a moment. */
    fun agentTurnEnd() {
        watchdog.removeCallbacks(watchdogTask)
        if (!agentBusy) return
        agentBusy = false
        agentLabel = ""
        agentFinished = turnSteps
        watchdog.removeCallbacks(receiptTask)
        watchdog.postDelayed(receiptTask, RECEIPT_MS)
    }

    /** The receipt was shown for long enough: drop it. */
    fun agentReceiptDone() {
        watchdog.removeCallbacks(receiptTask)
        agentFinished = 0
        turnSteps = 0
    }

    /** Safety net when no turn-end event arrives (engine killed, crash): the dot must not stay on forever. */
    private const val WATCHDOG_MS = 600_000L

    private const val RECEIPT_MS = 6_000L

    /** Opens a tab (and makes it the active one). [url] null shows the start page. */
    fun newTab(context: Context, url: String? = null): BrowserTab {
        val t = BrowserTab(++seq)
        tabs.add(t)
        activeIndex = tabs.lastIndex
        val w = viewOf(context, t)
        container?.let { attachView(it) }
        if (!url.isNullOrBlank()) w.loadUrl(url)
        return t
    }

    fun select(index: Int) {
        if (index !in tabs.indices) return
        activeIndex = index
        container?.let { attachView(it) }
    }

    fun closeTab(index: Int) {
        val t = tabs.getOrNull(index) ?: return
        container?.let { p -> views[t.key]?.let { p.removeView(it) } }
        views.remove(t.key)?.let { w ->
            runCatching { w.stopLoading() }
            runCatching { w.destroy() }
        }
        tabs.removeAt(index)
        activeIndex = if (tabs.isEmpty()) 0 else activeIndex.coerceIn(0, tabs.lastIndex)
        container?.let { attachView(it) }
    }

    fun closeAll() {
        val p = container
        for (t in tabs.toList()) {
            p?.let { c -> views[t.key]?.let { c.removeView(it) } }
            views.remove(t.key)?.let { w ->
                runCatching { w.stopLoading() }
                runCatching { w.destroy() }
            }
        }
        tabs.clear()
        activeIndex = 0
    }

    /** The active tab's WebView — what the browser tools drive. */
    fun web(context: Context): WebView {
        val t = active ?: newTab(context)
        return views[t.key] ?: viewOf(context, t)
    }

    /** Hands the active tab to [parent] so the user sees it; the tools keep driving the same instance. */
    fun attach(context: Context, parent: ViewGroup) {
        container = parent
        val t = active ?: newTab(context)
        viewOf(context, t)
        attachView(parent)
    }

    fun detach() {
        container?.removeAllViews()
        container = null
    }

    fun back() { active?.let { views[it.key]?.goBack() } }
    fun forward() { active?.let { views[it.key]?.goForward() } }
    fun reload() { active?.let { views[it.key]?.reload() } }
    fun stop() { active?.let { views[it.key]?.stopLoading() } }

    fun url(): String {
        val t = active ?: return ""
        return views[t.key]?.url ?: t.address
    }

    /** Back to the start page, without loading anything over the network. */
    fun goHome() {
        val t = active ?: return
        views[t.key]?.let {
            runCatching { it.stopLoading() }
            runCatching { it.loadUrl("about:blank") }
        }
        t.home = true
        t.address = ""
        t.pageTitle = ""
        t.canBack = false
        t.canForward = false
    }

    fun setDesktop(context: Context, on: Boolean) {
        desktop = on
        val t = active ?: return
        val w = views[t.key] ?: return
        w.settings.userAgentString = if (on) DESKTOP_UA else (mobileUa ?: w.settings.userAgentString)
        w.reload()
    }

    /** Types a bare address into something loadable; anything else becomes a search. */
    fun normalize(text: String): String {
        val s = text.trim()
        if (s.isEmpty()) return "about:blank"
        if (s.startsWith("http://") || s.startsWith("https://") || s.startsWith("file:") ||
            s.startsWith("about:") || s.startsWith("data:")
        ) return s
        val looksLikeHost = s.contains('.') && !s.contains(' ') &&
            s.substringBefore('/').substringAfterLast('.').isNotEmpty()
        return if (looksLikeHost) "https://$s"
        else "https://www.bing.com/search?q=" + android.net.Uri.encode(s)
    }

    private fun attachView(parent: ViewGroup) {
        val t = active ?: return
        for (v in views.values) if (v.parent === parent) parent.removeView(v)
        val w = views[t.key] ?: return
        if (w.parent == null) {
            parent.addView(w, ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun viewOf(context: Context, t: BrowserTab): WebView {
        views[t.key]?.let { return it }
        val w = WebView(context)
        val base = w.settings.userAgentString.replace("; wv", "")
        mobileUa = mobileUa ?: base
        w.settings.javaScriptEnabled = true
        w.settings.domStorageEnabled = true
        w.settings.databaseEnabled = true
        w.settings.useWideViewPort = true
        w.settings.loadWithOverviewMode = true
        w.settings.cacheMode = WebSettings.LOAD_DEFAULT
        w.settings.userAgentString = if (desktop) DESKTOP_UA else base
        CookieManager.getInstance().apply {
            setAcceptCookie(true)
            setAcceptThirdPartyCookies(w, true)
        }
        w.webViewClient = object : WebViewClient() {
            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                t.loading = true
                t.progress = 0
                if (!url.isNullOrBlank() && url != "about:blank") {
                    t.address = url
                    t.home = false
                }
                runCatching { onStarted() }
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                t.loading = false
                val u = view?.url ?: url
                if (!u.isNullOrBlank() && u != "about:blank") t.address = u
                t.canBack = view?.canGoBack() == true
                t.canForward = view?.canGoForward() == true
                runCatching { CookieManager.getInstance().flush() }
                runCatching { onFinished() }
            }
        }
        w.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                t.progress = newProgress
                t.loading = newProgress < 100
            }

            override fun onReceivedTitle(view: WebView?, title: String?) {
                t.pageTitle = title ?: ""
            }
        }
        val m = context.resources.displayMetrics
        w.measure(
            View.MeasureSpec.makeMeasureSpec(m.widthPixels, View.MeasureSpec.EXACTLY),
            View.MeasureSpec.makeMeasureSpec(m.heightPixels, View.MeasureSpec.EXACTLY),
        )
        w.layout(0, 0, m.widthPixels, m.heightPixels)
        views[t.key] = w
        return w
    }
}
