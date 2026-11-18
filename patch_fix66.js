// 用法: node patch_fix66.js [repoRoot]
// 屏幕工具语义化：screen_query（按文字/特征找元素，只回匹配项）+ screen_collect（翻页收集去重）。
const fs = require('fs'), path = require('path');
const root = process.argv[2] || '.';
let bad = 0;
const F = 'app/src/main/java/io/github/jackwener/dsh/core/capability/tools/ScreenTools.kt';
const full = path.join(root, F);
let s = fs.readFileSync(full, 'utf8');
if (s.includes('screen_collect')) console.log('SKIP screen tools');
else {
  // 1) 两个工具：插在 hand_to_user 之前
  const anchorTool = '        object : Tool("hand_to_user", ToolGroup.Screen, Risk.read, false,';
  const tools = [
    '        object : ScreenTool("screen_query", Risk.read, true,',
    '            "Find elements instead of reading the whole screen: returns only the elements whose text matches and/or that have a trait. " +',
    '                "Use it when you know what you are looking for (a button, a search box, a list row); the ids it returns work with screen_tap/screen_type. " +',
    '                "Far cheaper than screen_read on a busy screen.", {',
    '                string("text", "Substring of the element text or description (case-insensitive)")',
    '                string("role", "Only elements with this trait", enum = listOf("click", "edit", "scroll", "checked", "unchecked", "wheel", "disabled"))',
    '                int("limit", "Max matches (default 12, max 40)")',
    '            }) {',
    '            override suspend fun run(args: JsonObject, call: CallContext, t: ScreenTarget): ToolResult {',
    '                val text = args.str("text")?.trim()?.takeIf { it.isNotEmpty() }',
    '                val role = args.str("role")',
    '                if (text == null && role == null) throw InvalidArgsException("Give text and/or role")',
    '                val limit = (args.int("limit") ?: 12).coerceIn(1, 40)',
    '                val r = read(call, t.displayId)',
    '                val total = r.frame.elements.count { !it.system }',
    '                val matches = r.frame.elements.withIndex().filter { (_, e) ->',
    '                    !e.system &&',
    '                        (text == null || (e.text ?: "").contains(text, ignoreCase = true) || (e.desc ?: "").contains(text, ignoreCase = true)) &&',
    '                        (role == null || e.flags.contains(role))',
    '                }.take(limit)',
    '                if (matches.isEmpty()) {',
    '                    val what = listOfNotNull(text?.let { "\\"" + it + "\\"" }, role).joinToString(" + ")',
    '                    return ToolResult.text("No element matches " + what + " on the " + where(t) + " (" + total + " elements). " +',
    '                        "Try a shorter word, another trait, or screen_read for the whole screen.")',
    '                        .withOutcome(null, r.frame.fingerprint)',
    '                }',
    '                val body = matches.joinToString("\\n") { (i, e) -> "  " + e.line(r.frame.ids[i]) }',
    '                return ToolResult.text(matches.size.toString() + " of " + total + " element(s) on the " + where(t) + " — these ids work with screen_tap:\\n" + body)',
    '                    .withOutcome(null, r.frame.fingerprint)',
    '            }',
    '        },',
    '        object : ScreenTool("screen_collect", Risk.write, true,',
    '            "Scroll through a list and collect what it shows, page by page, without repeating: after each scroll only the items not seen yet are kept, " +',
    '                "and it stops when a scroll brings nothing new. Use it for a long chat, a feed or a product list instead of scrolling and reading by hand. " +',
    '                "Returns the collected labels in the order they appeared.", {',
    '                string("direction", "Scroll direction", enum = listOf("down", "up"))',
    '                int("pages", "How many scrolls to try (default 5, max 20)")',
    '                int("items", "Stop after this many items (default 200, max 1000)")',
    '            }) {',
    '            override suspend fun run(args: JsonObject, call: CallContext, t: ScreenTarget): ToolResult {',
    '                val d = t.displayId',
    '                val dir = args.str("direction") ?: "down"',
    '                val maxPages = (args.int("pages") ?: 5).coerceIn(1, 20)',
    '                val maxItems = (args.int("items") ?: 200).coerceIn(10, 1000)',
    '                val seen = LinkedHashSet<String>()',
    '                val got = ArrayList<String>()',
    '                fun take(f: Frame): Int {',
    '                    var added = 0',
    '                    f.elements.filterNot { it.system }.mapNotNull { it.label }.filter { it.isNotBlank() }.forEach {',
    '                        if (seen.add(it)) { got += it; added++ }',
    '                    }',
    '                    return added',
    '                }',
    '                val first = read(call, d)',
    '                take(first.frame)',
    '                var last = first.frame',
    '                var fingerprint = first.frame.fingerprint',
    '                var pages = 0',
    '                var why = "tried " + maxPages + " scroll(s)"',
    '                while (pages < maxPages) {',
    '                    if (got.size >= maxItems) { why = "reached the item limit"; break }',
    '                    scrollOnce(d, dir)',
    '                    settle()',
    '                    val r = read(call, d)',
    '                    pages++',
    '                    last = r.frame',
    '                    if (r.frame.fingerprint == fingerprint) { why = "the list stopped moving (this is the end)"; break }',
    '                    fingerprint = r.frame.fingerprint',
    '                    if (take(r.frame) == 0) { why = "no new items after " + pages + " scroll(s)"; break }',
    '                }',
    '                val list = if (got.isEmpty()) "(nothing readable on this screen)" else got.withIndex().joinToString("\\n") { (i, v) -> (i + 1).toString() + ". " + v }',
    '                return ToolResult.text("Collected " + got.size + " item(s) in " + pages + " scroll(s) — " + why + ".\\n" + list)',
    '                    .withOutcome(null, last.fingerprint)',
    '            }',
    '        },',
    '',
  ].join('\n');
  if (!s.includes(anchorTool)) { console.log('ANCHOR hand_to_user'); bad++; }
  else s = s.replace(anchorTool, tools + anchorTool);

  // 2) scrollOnce 辅助：插在 JsonObject.only 之前
  const anchorHelper = '    private fun JsonObject.only(vararg keys: String)';
  const helper = [
    '    /** One scroll of the current screen: an on-screen scrollable node if there is one, else a swipe in the middle. */',
    '    private suspend fun scrollOnce(d: Int, dir: String) {',
    '        val snap = svc().snapshot(d)',
    '        val i = snap.elements.indexOfFirst { it.flags.contains("scroll") && !it.system }',
    '        val node = snap.nodes.getOrNull(i)',
    '        if (node != null && node.isScrollable) {',
    '            val action = if (dir == "up") AccessibilityNodeInfo.ACTION_SCROLL_BACKWARD else AccessibilityNodeInfo.ACTION_SCROLL_FORWARD',
    '            if (node.performAction(action)) return',
    '        }',
    '        val m = metrics(d)',
    '        val cx = m.widthPixels / 2f; val cy = m.heightPixels / 2f',
    '        val dy = m.heightPixels * 0.3f',
    '        if (dir == "up") svc().swipe(cx, cy - dy, cx, cy + dy, 350, d) else svc().swipe(cx, cy + dy, cx, cy - dy, 350, d)',
    '    }',
    '',
  ].join('\n');
  if (!s.includes(anchorHelper)) { console.log('ANCHOR only helper'); bad++; }
  else s = s.replace(anchorHelper, helper + anchorHelper);

  fs.writeFileSync(full, s);
  console.log('EDIT screen tools');
}
console.log(bad === 0 ? 'fix66 OK' : ('fix66 BAD ' + bad));
process.exit(bad === 0 ? 0 : 1);
