const fs = require('fs');
const path = require('path');
const root = process.argv[2] || '.';
const STREAM = 'app/src/main/java/io/github/jackwener/dsh/feature/conversation/Stream.kt';
const anchor = `    LaunchedEffect(tailKey, live.sessionId) {
`;
const insert = `    // Opening the keyboard shrinks the chat; when the newest message is the one on screen keep it
    // visible (and never yank a reader who scrolled somewhere else up to the bottom).
    val imeBottom = androidx.compose.foundation.layout.WindowInsets.ime.getBottom(androidx.compose.ui.platform.LocalDensity.current)
    LaunchedEffect(imeBottom) {
        if (imeBottom <= 0 || !follow || listState.isScrollInProgress || lastIndex < 0) return@LaunchedEffect
        listState.scrollToItem(lastIndex, Int.MAX_VALUE / 2)
        androidx.compose.runtime.withFrameNanos { }
        if (follow && !listState.isScrollInProgress) listState.scrollToItem(lastIndex, Int.MAX_VALUE / 2)
    }
` + anchor;
const p = path.join(root, STREAM);
let bad = 0, changed = 0;
const src = fs.readFileSync(p, 'utf8');
if (src.includes('Opening the keyboard shrinks the chat')) console.log('SKIP    ' + STREAM);
else {
  const n = src.split(anchor).length - 1;
  if (n !== 1) { console.log('ANCHOR ' + n); bad++; }
  else { fs.writeFileSync(p, src.replace(anchor, insert)); console.log('PATCHED ' + STREAM); changed++; }
}
const s2 = fs.readFileSync(p, 'utf8');
const o=(s2.match(/\{/g)||[]).length, c=(s2.match(/\}/g)||[]).length;
console.log('braces '+o+'/'+c+(o===c?' ok':' MISMATCH')); if(o!==c) bad++;
console.log(`patch_fix6: ${changed} changed, ${bad} failed`);
process.exit(bad?1:0);
