const fs = require('fs');
const path = require('path');
const root = process.argv[2] || '.';
const STREAM = 'app/src/main/java/io/github/jackwener/dsh/feature/conversation/Stream.kt';
const from = `        repeat(3) { i ->
            if (listState.isScrollInProgress) return@LaunchedEffect
            listState.scrollToItem(lastIndex, Int.MAX_VALUE / 2)
            kotlinx.coroutines.delay(if (i == 0) 16L else 96L)
        }
`;
const to = `        // A session whose tail holds code, tables or images is still growing seconds after it
        // opens, so keep pinning on a widening schedule and stop the moment the user touches it.
        for (wait in listOf(16L, 80L, 200L, 450L, 900L)) {
            if (listState.isScrollInProgress) return@LaunchedEffect
            listState.scrollToItem(lastIndex, Int.MAX_VALUE / 2)
            kotlinx.coroutines.delay(wait)
        }
`;
const p = path.join(root, STREAM);
let bad = 0, changed = 0;
const src = fs.readFileSync(p, 'utf8');
if (src.includes('widening schedule')) console.log('SKIP    ' + STREAM);
else {
  const n = src.split(from).length - 1;
  if (n !== 1) { console.log('ANCHOR  ' + STREAM + ' (' + n + ')'); bad++; }
  else { fs.writeFileSync(p, src.replace(from, to)); console.log('PATCHED ' + STREAM); changed++; }
}
const s2 = fs.readFileSync(p, 'utf8');
const o=(s2.match(/\{/g)||[]).length, c=(s2.match(/\}/g)||[]).length;
console.log('braces '+o+'/'+c+(o===c?' ok':' MISMATCH')); if(o!==c) bad++;
console.log(`patch_fix5: ${changed} changed, ${bad} failed`);
process.exit(bad?1:0);
