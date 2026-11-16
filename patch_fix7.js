const fs=require('fs'),path=require('path');
const root=process.argv[2]||'.';
const STREAM='app/src/main/java/io/github/jackwener/dsh/feature/conversation/Stream.kt';
const p=path.join(root,STREAM);
let s=fs.readFileSync(p,'utf8');
if(s.includes('import androidx.compose.foundation.layout.ime')){console.log('SKIP');process.exit(0);}
const lines=s.split('\n');
let last=-1;
lines.forEach((l,i)=>{if(/^import androidx\.compose\.foundation\.layout\./.test(l))last=i;});
if(last<0){console.log('NO ANCHOR');process.exit(1);}
lines.splice(last+1,0,'import androidx.compose.foundation.layout.getBottom','import androidx.compose.foundation.layout.ime');
fs.writeFileSync(p,lines.join('\n'));
console.log('PATCHED imports after line '+(last+1));
process.exit(0);
