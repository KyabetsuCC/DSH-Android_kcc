package io.github.jackwener.dsh.feature.browser

import android.content.Context
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.setValue
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

data class Bookmark(val label: String, val url: String)

private val DEFAULT_BOOKMARKS = listOf(
    Bookmark("百度", "https://www.baidu.com"),
    Bookmark("Bing", "https://www.bing.com"),
    Bookmark("DeepSeek", "https://chat.deepseek.com"),
    Bookmark("GitHub", "https://github.com"),
    Bookmark("知乎", "https://www.zhihu.com"),
    Bookmark("B站", "https://m.bilibili.com"),
    Bookmark("微博", "https://m.weibo.cn"),
    Bookmark("淘宝", "https://m.taobao.com"),
)

/**
 * The start page shortcuts. Editable on purpose: the user keeps here the sites they sign in to
 * themselves before handing the browser to the agent.
 */
object BookmarkStore {
    var version by mutableIntStateOf(0)
        private set

    private var cache: List<Bookmark>? = null

    private fun file(c: Context) = File(c.filesDir, "notes/bookmarks.json")

    private fun read(c: Context): List<Bookmark> {
        val f = file(c)
        if (!f.exists()) return DEFAULT_BOOKMARKS
        return runCatching {
            val a = JSONArray(f.readText())
            (0 until a.length()).mapNotNull { i ->
                val o = a.optJSONObject(i) ?: return@mapNotNull null
                val u = o.optString("url")
                if (u.isBlank()) null else Bookmark(o.optString("label").ifBlank { u }, u)
            }
        }.getOrDefault(DEFAULT_BOOKMARKS)
    }

    fun all(c: Context): List<Bookmark> {
        // Reading the counter is what makes composables recompose after add/remove.
        if (version < 0) return emptyList()
        return cache ?: read(c).also { cache = it }
    }

    fun add(c: Context, label: String, url: String) {
        val raw = url.trim()
        if (raw.isEmpty()) return
        val u = if (raw.startsWith("http://") || raw.startsWith("https://")) raw else "https://$raw"
        val list = all(c).toMutableList()
        val name = label.trim().ifBlank { u.removePrefix("https://").removePrefix("http://") }
        val at = list.indexOfFirst { it.url == u }
        if (at >= 0) list[at] = Bookmark(name, u) else list.add(Bookmark(name, u))
        save(c, list)
    }

    fun remove(c: Context, url: String) {
        save(c, all(c).filterNot { it.url == url })
    }

    fun reset(c: Context) {
        cache = null
        runCatching { file(c).delete() }
        version++
    }

    private fun save(c: Context, list: List<Bookmark>) {
        cache = list
        version++
        runCatching {
            val f = file(c)
            f.parentFile?.mkdirs()
            val a = JSONArray()
            for (b in list) a.put(JSONObject().put("label", b.label).put("url", b.url))
            f.writeText(a.toString())
        }
    }
}
