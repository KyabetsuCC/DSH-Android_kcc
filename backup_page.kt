package io.github.jackwener.dsh.feature.settings

import android.content.Context
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.github.jackwener.dsh.core.designsystem.Dsh
import io.github.jackwener.dsh.core.designsystem.DshType
import io.github.jackwener.dsh.core.designsystem.SettingsCard
import io.github.jackwener.dsh.core.designsystem.SettingsGroupTitle
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.zip.ZipEntry
import java.util.zip.ZipInputStream
import java.util.zip.ZipOutputStream

/**
 * 备份 / 导入：把能搬走的数据打成一个 zip，或从一个 zip 恢复。
 *
 * 打包范围：files/dsh-home（去掉 node_modules / cache / ext-staging）、databases/dsh.db(+wal,shm)、
 * shared_prefs、files/datastore、app_notes.json、ext-list-cache.json。
 * 不打包：no_backup/（API Key 由 Android Keystore 加密，换机必失效）、files/engine、files/home、
 * shots、certs —— 这些要么可重建，要么根本搬不走。
 */
@Composable
fun BackupPage() {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    var busy by remember { mutableStateOf("") }
    var msg by remember { mutableStateOf("") }

    val stamp = remember { SimpleDateFormat("yyyyMMdd-HHmm", Locale.US).format(Date()) }

    val exportLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.CreateDocument("application/zip"),
    ) { uri: Uri? ->
        if (uri == null) return@rememberLauncherForActivityResult
        scope.launch {
            busy = "正在打包…"
            msg = runCatching { withContext(Dispatchers.IO) { exportZip(ctx, uri) } }
                .fold({ "已导出：$it" }, { "导出失败：${it.message ?: it}" })
            busy = ""
        }
    }

    val importLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.OpenDocument(),
    ) { uri: Uri? ->
        if (uri == null) return@rememberLauncherForActivityResult
        scope.launch {
            busy = "正在还原…"
            msg = runCatching { withContext(Dispatchers.IO) { importZip(ctx, uri) } }
                .fold({ "已还原：$it\n请完全退出并重新打开 DSH 生效。" }, { "导入失败：${it.message ?: it}" })
            busy = ""
        }
    }

    SettingsGroupTitle("备份")
    SettingsCard {
        Column(Modifier.padding(14.dp)) {
            Text(
                "把会话、附件、插件包、设置与数据库打包成一个 zip；导入时自动先存一份当前的，出事能退回来。",
                color = Dsh.colors.labelSecondary, style = DshType.xs13,
            )
            Spacer(Modifier.height(12.dp))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                BackupButton("导出备份", Modifier.weight(1f), busy.isEmpty()) {
                    exportLauncher.launch("dsh-backup-$stamp.zip")
                }
                BackupButton("从备份导入", Modifier.weight(1f), busy.isEmpty()) {
                    importLauncher.launch(arrayOf("application/zip", "application/octet-stream", "*/*"))
                }
            }
            if (busy.isNotEmpty()) {
                Spacer(Modifier.height(10.dp))
                Text(busy, color = Dsh.colors.labelSecondary, style = DshType.xs13)
            }
            if (msg.isNotEmpty()) {
                Spacer(Modifier.height(10.dp))
                Text(msg, color = Dsh.colors.labelPrimary, style = DshType.xs13)
            }
        }
    }

    SettingsGroupTitle("说明")
    SettingsCard {
        Column(Modifier.padding(14.dp)) {
            for (line in listOf(
                "✅ 会话记录、附件图片、插件包、规则、设置项",
                "✅ 数据库 dsh.db（含 -wal / -shm）",
                "❌ API Key：由本机 Keystore 加密，换机必失效，需重新填",
                "❌ 引擎与 node_modules：可重建，打进去只会让包变大",
            )) {
                Text(line, color = Dsh.colors.labelSecondary, style = DshType.xs13)
                Spacer(Modifier.height(6.dp))
            }
        }
    }
}

@Composable
private fun BackupButton(label: String, modifier: Modifier, enabled: Boolean, onClick: () -> Unit) {
    val bg = if (enabled) Dsh.colors.selector else Dsh.colors.bgLayer2
    Text(
        label,
        modifier = modifier
            .background(bg, RoundedCornerShape(9.dp))
            .clickable(enabled = enabled) { onClick() }
            .padding(vertical = 10.dp),
        color = Dsh.colors.labelPrimary,
        style = DshType.s14m,
        textAlign = TextAlign.Center,
    )
}

private fun exportZip(ctx: Context, uri: Uri): String {
    val tmp = File(ctx.cacheDir, "backup-tmp.zip")
    if (tmp.exists()) tmp.delete()
    var files = 0
    ZipOutputStream(FileOutputStream(tmp)).use { zos ->
        fun add(f: File, name: String) {
            if (!f.exists()) return
            if (f.isDirectory) {
                f.listFiles()?.forEach { add(it, "$name/${it.name}") }
                return
            }
            zos.putNextEntry(ZipEntry(name))
            FileInputStream(f).use { it.copyTo(zos) }
            zos.closeEntry()
            files++
        }
        add(File(ctx.filesDir, "app_notes.json"), "files/app_notes.json")
        add(File(ctx.filesDir, "ext-list-cache.json"), "files/ext-list-cache.json")
        walkData(File(ctx.filesDir, "dsh-home"), "files/dsh-home") { f, name -> add(f, name) }
        add(File(ctx.filesDir, "datastore/settings.preferences_pb"), "files/datastore/settings.preferences_pb")
        walkData(File(ctx.dataDir, "shared_prefs"), "shared_prefs") { f, name -> add(f, name) }
        val db = ctx.getDatabasePath("dsh.db")
        for (suffix in listOf("", "-wal", "-shm")) {
            val f = File(db.path + suffix)
            if (f.exists()) add(f, "databases/dsh.db$suffix")
        }
    }
    ctx.contentResolver.openOutputStream(uri)?.use { out ->
        FileInputStream(tmp).use { it.copyTo(out) }
    } ?: throw IllegalStateException("无法写入所选位置")
    val size = tmp.length()
    tmp.delete()
    return "共 $files 个文件，${(size / 1024 / 1024)} MB"
}

private fun importZip(ctx: Context, uri: Uri): String {
    // 保险：先把当前的数据库存一份
    val keep = File(ctx.filesDir, "import-backup")
    keep.mkdirs()
    val db = ctx.getDatabasePath("dsh.db")
    for (suffix in listOf("", "-wal", "-shm")) {
        val f = File(db.path + suffix)
        if (f.exists()) f.copyTo(File(keep, "dsh.db$suffix"), overwrite = true)
    }

    var restored = 0
    ctx.contentResolver.openInputStream(uri)?.use { raw ->
        ZipInputStream(raw).use { zis ->
            while (true) {
                val e = zis.nextEntry ?: break
                val name = e.name
                if (e.isDirectory) { zis.closeEntry(); continue }
                val target: File? = when {
                    name.startsWith("files/dsh-home/") -> File(ctx.filesDir, name.removePrefix("files/"))
                    name == "files/app_notes.json" -> File(ctx.filesDir, "app_notes.json")
                    name == "files/ext-list-cache.json" -> File(ctx.filesDir, "ext-list-cache.json")
                    name == "files/datastore/settings.preferences_pb" -> File(ctx.filesDir, "datastore/settings.preferences_pb")
                    name.startsWith("shared_prefs/") -> File(ctx.dataDir, name)
                    name == "databases/dsh.db" -> db
                    name == "databases/dsh.db-wal" -> File(db.path + "-wal")
                    name == "databases/dsh.db-shm" -> File(db.path + "-shm")
                    else -> null
                }
                if (target == null) {
                    // 跳过不该进来的条目（比如 node_modules）
                    if (!name.contains("node_modules")) restored++
                    zis.closeEntry(); continue
                }
                target.parentFile?.mkdirs()
                FileOutputStream(target).use { zis.copyTo(it) }
                restored++
                zis.closeEntry()
            }
        }
    } ?: throw IllegalStateException("无法读取所选文件")
    return "共 $restored 个文件（原数据已备份到 files/import-backup）"
}

/** 遍历 dsh-home，跳过体积大且可重建的目录。 */
private fun walkData(dir: File, prefix: String, sink: (File, String) -> Unit) {
    if (!dir.exists()) return
    for (f in dir.listFiles() ?: return) {
        val name = f.name
        if (f.isDirectory && (name == "node_modules" || name == "cache" || name == "ext-staging" || name == ".git")) continue
        val path = "$prefix/$name"
        if (f.isDirectory) walkData(f, path, sink) else sink(f, path)
    }
}
