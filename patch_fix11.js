const fs=require('fs'),path=require('path');
const root=process.argv[2]||'.';
const F='app/src/main/java/io/github/jackwener/dsh/feature/conversation/Stream.kt';
const A1=`            if (follow && !listState.isScrollInProgress && lastIndex >= 0) listState.scrollToItem(lastIndex, Int.MAX_VALUE / 2)
`;
const B1=`            if (follow && !listState.isScrollInProgress && lastIndex >= 0) {
                val n = listState.layoutInfo.totalItemsCount
                if (n > 0) {
                    listState.scrollToItem(n - 1)
                    if (listState.canScrollForward) listState.scrollBy(100000f)
                }
            }
`;
const A2=`        kotlinx.coroutines.delay(150)
        if (!follow || listState.isScrollInProgress) return@LaunchedEffect
        listState.scrollToItem(lastIndex, Int.MAX_VALUE / 2)
`;
const B2=`        kotlinx.coroutines.delay(150)
        if (!follow || listState.isScrollInProgress) return@LaunchedEffect
        val n = listState.layoutInfo.totalItemsCount
        if (n > 0) {
            listState.scrollToItem(n - 1)
            if (listState.canScrollForward) listState.scrollBy(100000f)
        }
`;
const p=path.join(root,F);
let s=fs.readFileSync(p,'utf8');
if(s.includes('scrollToItem(n - 1)')){console.log('SKIP');process.exit(0);}
let bad=0;
for(const [a,b,tag] of [[A1,B1,'open'],[A2,B2,'tail']]){
  const n=s.split(a).length-1;
  if(n!==1){console.log('ANCHOR '+tag+' '+n);bad++;continue;}
  s=s.replace(a,b);
}
if(bad){process.exit(1);}
fs.writeFileSync(p,s);
const o=(s.match(/\{/g)||[]).length,c=(s.match(/\}/g)||[]).length;
console.log('PATCHED braces '+o+'/'+c+(o===c?' ok':' MISMATCH'));
process.exit(o===c?0:1);
