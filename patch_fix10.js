const fs=require('fs'),path=require('path');
const root=process.argv[2]||'.';
const F='app/src/main/java/io/github/jackwener/dsh/feature/conversation/Stream.kt';
const from=`    // New content while the reader is already at the bottom: one pin per change, and never while a
    // finger is on the list - pinning during an overscroll pull froze the whole conversation (#76-2).
    LaunchedEffect(tailKey) {
        if (!follow || listState.isScrollInProgress || lastIndex < 0) return@LaunchedEffect
        listState.scrollToItem(lastIndex, Int.MAX_VALUE / 2)
    }
`;
const to=`    // New content while the reader is already at the bottom: pin once, but only after the burst of
    // streamed events settles and only if no finger is on the list - pinning straight into an
    // overscroll (the stretch at the end of the list) froze the whole conversation (#76-2).
    LaunchedEffect(tailKey) {
        if (!follow || listState.isScrollInProgress || lastIndex < 0) return@LaunchedEffect
        kotlinx.coroutines.delay(150)
        if (!follow || listState.isScrollInProgress) return@LaunchedEffect
        listState.scrollToItem(lastIndex, Int.MAX_VALUE / 2)
    }
`;
const p=path.join(root,F);
let s=fs.readFileSync(p,'utf8');
if(s.includes('pin once, but only after the burst')){console.log('SKIP');process.exit(0);}
if(s.split(from).length-1!==1){console.log('ANCHOR '+(s.split(from).length-1));process.exit(1);}
s=s.replace(from,to); fs.writeFileSync(p,s);
const o=(s.match(/\{/g)||[]).length,c=(s.match(/\}/g)||[]).length;
console.log('PATCHED braces '+o+'/'+c+(o===c?' ok':' MISMATCH'));
process.exit(o===c?0:1);
