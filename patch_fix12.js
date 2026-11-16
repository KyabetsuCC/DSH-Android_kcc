const fs=require('fs'),path=require('path');
const root=process.argv[2]||'.';
const F='app/src/main/java/io/github/jackwener/dsh/feature/conversation/Stream.kt';
const IMP='import androidx.compose.foundation.gestures.scrollBy';
const p=path.join(root,F);
const lines=fs.readFileSync(p,'utf8').split('\n');
if(lines.includes(IMP)){console.log('SKIP');process.exit(0);}
let at=-1;
for(let i=0;i<lines.length;i++){ if(lines[i].startsWith('import androidx.compose.foundation.')) at=i; }
if(at<0){console.log('ANCHOR 0');process.exit(1);}
lines.splice(at+1,0,IMP);
fs.writeFileSync(p,lines.join('\n'));
console.log('PATCHED import after line '+(at+1));
