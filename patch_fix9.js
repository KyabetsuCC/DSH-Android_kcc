const fs=require('fs'),path=require('path');
const root=process.argv[2]||'.';
const STREAM='app/src/main/java/io/github/jackwener/dsh/feature/conversation/Stream.kt';
const from=`    LaunchedEffect(tailKey, live.sessionId) {
        if (!follow || lastIndex < 0) return@LaunchedEffect
        // A session whose tail holds code, tables or images is still growing seconds after it
        // opens, so keep pinning on a widening schedule and stop the moment the user touches it.
        for (wait in listOf(16L, 80L, 200L, 450L, 900L)) {
            if (listState.isScrollInProgress) return@LaunchedEffect
            listState.scrollToItem(lastIndex, Int.MAX_VALUE / 2)
            kotlinx.coroutines.delay(wait)
        }
    }
`;
const to=`    // Opening a conversation: the tail may still be laying out (code, tables, images) for about a
    // second, so pin on a widening schedule - but only when the conversation opens, never again for
    // every streamed event.
    LaunchedEffect(live.sessionId) {
        for (wait in listOf(16L, 80L, 200L, 450L, 900L)) {
            if (follow && !listState.isScrollInProgress && lastIndex >= 0) listState.scrollToItem(lastIndex, Int.MAX_VALUE / 2)
            kotlinx.coroutines.delay(wait)
        }
    }
    // New content while the reader is already at the bottom: one pin per change, never while a finger
    // is on the list (pinning during an overscroll pull froze the conversation, #76-2).
    LaunchedEffect(tailKey) {
        if (!follow || listState.isScrollInProgress || lastIndex < 0) return@LaunchedEffect
        listState.scrollToItem(lastIndex, Int.MAX_VALUE / 2)
    }
`;
const p=path.join(root,STREAM);
let s=fs.readFileSync(p,'utf8');
if(s.includes('never again for')){console.log('SKIP');process.exit(0);}
const n=s.split(from).length-1;
if(n!==1){console.log('ANCHOR '+n);process.exit(1);}
s=s.replace(from,to);
fs.writeFileSync(p,s);
const o=(s.match(/\{/g)||[]).length,c=(s.match(/\}/g)||[]).length;
console.log('PATCHED braces '+o+'/'+c+(o===c?' ok':' MISMATCH'));
process.exit(o===c?0:1);
