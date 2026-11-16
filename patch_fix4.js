const fs = require('fs');
const path = require('path');
const root = process.argv[2] || '.';
const STREAM = 'app/src/main/java/io/github/jackwener/dsh/feature/conversation/Stream.kt';
const from = `    LaunchedEffect(tailKey, live.sessionId) {
        if (!follow || listState.isScrollInProgress || lastIndex < 0) return@LaunchedEffect
        listState.scrollToItem(lastIndex, Int.MAX_VALUE / 2)
        androidx.compose.runtime.withFrameNanos { }
        if (follow && !listState.isScrollInProgress) listState.scrollToItem(lastIndex, Int.MAX_VALUE / 2)
    }
`;
const to = `    LaunchedEffect(tailKey, live.sessionId) {
        if (!follow || lastIndex < 0) return@LaunchedEffect
        // Pin more than once: the list re-applies its saved position after the first frame and the
        // blocks above finish laying out later (code, tables, images), which left opening a
        // conversation two or three messages short of the newest one (#76-4).
        repeat(3) { i ->
            if (listState.isScrollInProgress) return@LaunchedEffect
            listState.scrollToItem(lastIndex, Int.MAX_VALUE / 2)
            kotlinx.coroutines.delay(if (i == 0) 16L else 96L)
        }
    }
`;
const p = path.join(root, STREAM);
let bad = 0, changed = 0;
const src = fs.readFileSync(p, 'utf8');
if (src.includes('repeat(3) { i ->')) console.log('SKIP    ' + STREAM);
else {
  const n = src.split(from).length - 1;
  if (n !== 1) { console.log('ANCHOR  ' + STREAM + ' (' + n + ' matches)'); bad++; }
  else { fs.writeFileSync(p, src.replace(from, to)); console.log('PATCHED ' + STREAM); changed++; }
}
const s2 = fs.readFileSync(p, 'utf8');
const o = (s2.match(/\{/g) || []).length, c = (s2.match(/\}/g) || []).length;
console.log('Stream.kt braces ' + o + '/' + c + (o === c ? ' ok' : ' MISMATCH'));
if (o !== c) bad++;
console.log(`patch_fix4: ${changed} changed, ${bad} failed`);
process.exit(bad ? 1 : 0);
