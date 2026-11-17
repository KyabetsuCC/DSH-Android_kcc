package io.github.jackwener.dsh.feature.conversation

import android.content.Context
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.setValue
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

/** 会话文件夹（用户手动建的分类）。数据放在 SharedPreferences，避免动 Room schema。 */
data class SessionFolder(val id: String, val name: String)

object FolderStore {
    private const val PREF = "session_folders"
    private const val KEY_FOLDERS = "folders"
    private const val KEY_MAP = "map"

    /** 变更计数：Compose 读它即可在增删改后重组。 */
    var version by mutableIntStateOf(0)
        private set

    private fun prefs(c: Context) = c.applicationContext.getSharedPreferences(PREF, Context.MODE_PRIVATE)

    fun folders(c: Context): List<SessionFolder> {
        val raw = prefs(c).getString(KEY_FOLDERS, null) ?: return emptyList()
        return runCatching {
            val a = JSONArray(raw)
            (0 until a.length()).mapNotNull { i ->
                val o = a.optJSONObject(i) ?: return@mapNotNull null
                val id = o.optString("id").takeIf { it.isNotBlank() } ?: return@mapNotNull null
                SessionFolder(id, o.optString("name"))
            }
        }.getOrDefault(emptyList())
    }

    private fun saveFolders(c: Context, list: List<SessionFolder>) {
        val a = JSONArray()
        list.forEach { a.put(JSONObject().put("id", it.id).put("name", it.name)) }
        prefs(c).edit().putString(KEY_FOLDERS, a.toString()).apply()
        version++
    }

    fun addFolder(c: Context, name: String): SessionFolder {
        val f = SessionFolder(UUID.randomUUID().toString(), name.trim())
        saveFolders(c, folders(c) + f)
        return f
    }

    fun renameFolder(c: Context, id: String, name: String) =
        saveFolders(c, folders(c).map { if (it.id == id) it.copy(name = name.trim()) else it })

    /** 删文件夹时把里面的会话退回「未分组」。 */
    fun deleteFolder(c: Context, id: String) {
        saveFolders(c, folders(c).filterNot { it.id == id })
        val map = assignments(c).filterValues { it != id }
        saveMap(c, map)
    }

    fun assignments(c: Context): Map<String, String> {
        val raw = prefs(c).getString(KEY_MAP, null) ?: return emptyMap()
        return runCatching {
            val o = JSONObject(raw)
            o.keys().asSequence().associateWith { o.optString(it) }
        }.getOrDefault(emptyMap())
    }

    private fun saveMap(c: Context, map: Map<String, String>) {
        val o = JSONObject()
        map.forEach { (k, v) -> o.put(k, v) }
        prefs(c).edit().putString(KEY_MAP, o.toString()).apply()
        version++
    }

    /** folderId = null 表示移出文件夹。 */
    fun assign(c: Context, sessionId: String, folderId: String?) {
        val map = assignments(c).toMutableMap()
        if (folderId == null) map.remove(sessionId) else map[sessionId] = folderId
        saveMap(c, map)
    }
}
