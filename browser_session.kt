package io.github.jackwener.dsh.core.capability

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Bitmap
import android.view.View
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue

/**
 * The one in-app WebView. The browser tools drive it headlessly, and the browser page shows the very
 * same instance, so the user watches exactly what the agent does and can take over at any moment.
 *
 * Cookies, DOM storage and the cache are persisted the normal WebView way, so a page the user signed
 * in to stays signed in for the agent as well.
 */
object BrowserSession {
    /** Live state the browser page renders. Written on the WebView (main) thread only. */
    var address by mutableStateOf("")
    var pageTitle by mutableStateOf("")
    var loading by mutableStateOf(false)
    var progress by mutableIntStateOf(0)
    var canBack by mutableStateOf(false)
    var canForward by mutableStateOf(false)
    var desktop by mutableStateOf(false)

    /** True while the blank start page (address bar + quick links) is what the user should see. */
    var home by mutableStateOf(true)

    private var webView: WebView? = null
    private var onStarted: () -> Unit = {}
    private var onFinished: () -> Unit = {}

    private const val DESKTOP_UA =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"

    /** The browser tools install their navigation wait here. */
    fun hooks(started: () -> Unit, finished: () -> Unit) {
        onStarted = started
        onFinished = finished
    }

    @SuppressLint("SetJavaScriptEnabled")
    fun web(context: Context): WebView = webView ?: WebView(context).apply {
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.userAgentString = settings.userAgentString.replace("; wv", "")
        val cm = CookieManager.getInstance()
        cm.setAcceptCookie(true)
        cm.setAcceptThirdPartyCookies(this, true)
        webViewClient = object : WebViewClient() {
            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                BrowserSession.loading = true
                BrowserSession.progress = 0
                BrowserSession.address = url ?: BrowserSession.address
                if (!url.isNullOrBlank() && url != "about:blank") BrowserSession.home = false
                runCatching { onStarted() }
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                BrowserSession.loading = false
                BrowserSession.address = view?.url ?: url ?: BrowserSession.address
                BrowserSession.canBack = view?.canGoBack() == true
                BrowserSession.canForward = view?.canGoForward() == true
                runCatching { CookieManager.getInstance().flush() }
                runCatching { onFinished() }
            }
        }
        webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                BrowserSession.progress = newProgress
                BrowserSession.loading = newProgress < 100
            }

            override fun onReceivedTitle(view: WebView?, title: String?) {
                BrowserSession.pageTitle = title ?: ""
            }
        }
        val m = context.resources.displayMetrics
        measure(
            View.MeasureSpec.makeMeasureSpec(m.widthPixels, View.MeasureSpec.EXACTLY),
            View.MeasureSpec.makeMeasureSpec(m.heightPixels, View.MeasureSpec.EXACTLY),
        )
        layout(0, 0, m.widthPixels, m.heightPixels)
    }.also { webView = it }

    /** Hands the WebView to [parent] so the user sees it; the tools keep driving the same instance. */
    fun attach(context: Context, parent: ViewGroup) {
        val w = web(context)
        if (w.parent === parent) return
        (w.parent as? ViewGroup)?.removeView(w)
        parent.removeAllViews()
        parent.addView(w, ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
    }

    /** Takes the WebView back out of the UI; the page stays alive for the tools. */
    fun detach() {
        val w = webView ?: return
        (w.parent as? ViewGroup)?.removeView(w)
    }

    /** Back to the blank start page with the quick links, without loading anything over the network. */
    fun goHome() {
        webView?.stopLoading()
        runCatching { webView?.loadUrl("about:blank") }
        BrowserSession.home = true
        BrowserSession.address = ""
        BrowserSession.pageTitle = ""
        BrowserSession.canBack = false
        BrowserSession.canForward = false
    }

    fun back() { webView?.goBack() }

    fun forward() { webView?.goForward() }

    fun reload() { webView?.reload() }

    fun stop() { webView?.stopLoading() }

    fun url(): String = webView?.url ?: address

    /** Turns the desktop site on or off for the next load. */
    fun setDesktop(context: Context, on: Boolean) {
        if (desktop == on) return
        desktop = on
        val w = web(context)
        val base = w.settings.userAgentString.removePrefix(DESKTOP_UA).replace("; wv", "")
        w.settings.userAgentString = if (on) DESKTOP_UA else if (base.isBlank()) DESKTOP_UA else base
        w.reload()
    }

    /** A user-typed address, made loadable: a bare host becomes https, anything else a search. */
    fun normalize(text: String): String {
        val s = text.trim()
        if (s.isEmpty()) return "about:blank"
        if (s.startsWith("http://") || s.startsWith("https://") || s.startsWith("file:") || s.startsWith("about:")) return s
        if (!s.contains(' ') && s.contains('.')) return "https://$s"
        return "https://www.bing.com/search?q=" + java.net.URLEncoder.encode(s, "UTF-8")
    }
}
