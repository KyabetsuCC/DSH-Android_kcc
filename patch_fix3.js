const fs = require('fs');
const path = require('path');
const root = process.argv[2] || '.';
const K = 'app/src/main/java/io/github/jackwener/dsh/';
const STREAM = K + 'feature/conversation/Stream.kt';
const PROJ = K + 'core/session/Projection.kt';
const edits = [];

// #76-2: never pin the tail while a finger is on the list (it cancelled the drag -> "UI frozen").
edits.push([STREAM,
`    LaunchedEffect(listState.isScrollInProgress) { if (listState.isScrollInProgress) follow = atBottom }
    LaunchedEffect(atBottom) { if (atBottom) follow = true }
`,
`    // A pin mid-gesture cancels the drag and the conversation feels frozen (#76-2); following
    // resumes by itself once the list comes to rest at the bottom.
    LaunchedEffect(listState.isScrollInProgress) {
        if (listState.isScrollInProgress) follow = false else if (!listState.canScrollForward) follow = true
    }
    LaunchedEffect(atBottom) { if (atBottom) follow = true }
`]);

// #76-4: pin once, then once more after layout (markdown / code / images above grow and push the
// newest block off screen), and never while a drag is in progress.
edits.push([STREAM,
`    LaunchedEffect(tailKey, live.sessionId) { if (follow && lastIndex >= 0) listState.scrollToItem(lastIndex, Int.MAX_VALUE / 2) }
`,
`    LaunchedEffect(tailKey, live.sessionId) {
        if (!follow || listState.isScrollInProgress || lastIndex < 0) return@LaunchedEffect
        listState.scrollToItem(lastIndex, Int.MAX_VALUE / 2)
        androidx.compose.runtime.withFrameNanos { }
        if (follow && !listState.isScrollInProgress) listState.scrollToItem(lastIndex, Int.MAX_VALUE / 2)
    }
`]);

// The todo dock is the running turn's; an older list sat above the composer forever.
edits.push([PROJ,
`fun todoDockMode(todos: List<TodoItem>?, writtenThisTurn: Boolean): TodoDockMode = when {
    todos.isNullOrEmpty() -> TodoDockMode.Hidden
    todos.any { it.status != "completed" } -> TodoDockMode.Open
    writtenThisTurn -> TodoDockMode.AllDone
    else -> TodoDockMode.Hidden
}
`,
`fun todoDockMode(todos: List<TodoItem>?, writtenThisTurn: Boolean): TodoDockMode = when {
    // The dock belongs to the turn that wrote the list: an older one used to keep showing open
    // items above the composer through every later turn, looking like work that never progresses.
    todos.isNullOrEmpty() -> TodoDockMode.Hidden
    !writtenThisTurn -> TodoDockMode.Hidden
    todos.any { it.status != "completed" } -> TodoDockMode.Open
    else -> TodoDockMode.AllDone
}
`]);

let changed = 0, skipped = 0, bad = 0;
for (const [rel, from, to] of edits) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) { console.log('MISSING ' + rel); bad++; continue; }
  const src = fs.readFileSync(p, 'utf8');
  if (src.includes(to.split('\n')[1])) { console.log('SKIP    ' + rel); skipped++; continue; }
  const n = src.split(from).length - 1;
  if (n !== 1) { console.log('ANCHOR  ' + rel + ' (' + n + ' matches)'); bad++; continue; }
  fs.writeFileSync(p, src.replace(from, to));
  console.log('PATCHED ' + rel); changed++;
}
// sanity: brace balance of the two files
for (const rel of [STREAM, PROJ]) {
  const s = fs.readFileSync(path.join(root, rel), 'utf8');
  const o = (s.match(/\{/g) || []).length, c = (s.match(/\}/g) || []).length;
  console.log(rel.split('/').pop() + ' braces ' + o + '/' + c + (o === c ? ' ok' : ' MISMATCH'));
  if (o !== c) bad++;
}
console.log(`patch_fix3: ${changed} changed, ${skipped} skipped, ${bad} failed`);
process.exit(bad ? 1 : 0);
