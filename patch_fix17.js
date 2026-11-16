// 修上游缺陷批次 2：图片消息只看得到「图片 ×N」→ 可点击看大图；单次图片上限 4 → 9。
// 用法 node patch_fix17.js [repoRoot]
const fs = require('fs')
const path = require('path')
const root = process.argv[2] || '.'
let bad = 0

function edit(rel, pairs) {
  const f = path.join(root, rel)
  let s = fs.readFileSync(f, 'utf8')
  for (const [from, to, tag] of pairs) {
    if (s.includes(to)) { console.log('SKIP ' + tag); continue }
    if (!s.includes(from)) { console.error('ANCHOR 0 ' + tag); bad++; continue }
    if (s.split(from).length > 2) { console.error('ANCHOR AMBIGUOUS ' + tag); bad++; continue }
    s = s.replace(from, to)
    console.log('OK ' + tag)
  }
  fs.writeFileSync(f, s)
}

const COMPOSER = 'app/src/main/java/io/github/jackwener/dsh/feature/conversation/Composer.kt'
const PROJ = 'app/src/main/java/io/github/jackwener/dsh/core/session/Projection.kt'
const STREAM = 'app/src/main/java/io/github/jackwener/dsh/feature/conversation/Stream.kt'

// 1) 单次图片上限 4 → 9
edit(COMPOSER, [
  ['const val MAX_IMAGES = 4', 'const val MAX_IMAGES = 9', 'MAX_IMAGES 4->9'],
])

// 2) 投影里带上图片的 attachmentId
edit(PROJ, [
  [
    'data class UserMsg(val seq: Long, val time: Long, val text: String, val images: Int, val files: Int)',
    'data class UserMsg(val seq: Long, val time: Long, val text: String, val images: Int, val files: Int, val imageIds: List<String> = emptyList())',
    'UserMsg.imageIds',
  ],
  [
    'private fun countOf(content: JsonElement?, type: String) = (content as? JsonArray)?.count { (it as? JsonObject)?.s("type") == type } ?: 0',
    'private fun countOf(content: JsonElement?, type: String) = (content as? JsonArray)?.count { (it as? JsonObject)?.s("type") == type } ?: 0\n'
      + '\n/** The sha256 ids (without the scheme prefix) of a message\'s image parts, in order. */\n'
      + 'private fun imageIdsOf(content: JsonElement?): List<String> = (content as? JsonArray)?.mapNotNull { part ->\n'
      + '    ((part as? JsonObject)?.o("attachment"))?.s("attachmentId")?.substringAfterLast(\':\')\n'
      + '} ?: emptyList()',
    'imageIdsOf helper',
  ],
  [
    'val msg = UserMsg(e.seq, e.time, textOf(content), countOf(content, "image"), countOf(content, "file"))',
    'val msg = UserMsg(e.seq, e.time, textOf(content), countOf(content, "image"), countOf(content, "file"), imageIdsOf(content))',
    'UserMsg build',
  ],
  [
    'err.retryText?.let { tb.user = UserMsg(e.seq, e.time, it, 0, 0) }',
    'err.retryText?.let { tb.user = UserMsg(e.seq, e.time, it, 0, 0, emptyList()) }',
    'UserMsg retry',
  ],
])

// 3) 气泡上的「图片 ×N」可点开大图
edit(STREAM, [
  [
    'if (u.images > 0) Tag(stringResource(R.string.images_n, u.images))',
    'if (u.images > 0) {\n'
      + '                    var viewer by remember(u.seq) { mutableStateOf(false) }\n'
      + '                    Tag(\n'
      + '                        stringResource(R.string.images_n, u.images),\n'
      + '                        modifier = Modifier.clickable(enabled = u.imageIds.isNotEmpty()) { viewer = true },\n'
      + '                    )\n'
      + '                    if (viewer) ImageViewer(u.imageIds) { viewer = false }\n'
      + '                }',
    'image chip clickable',
  ],
  [
    'import androidx.compose.runtime.Composable',
    'import androidx.compose.foundation.clickable\nimport androidx.compose.runtime.Composable',
    'clickable import',
  ],
])

if (bad !== 0) { console.error('patch_fix17: ' + bad + ' anchor(s) failed'); process.exit(1) }
console.log('patch_fix17: done')
