const fs=require('fs'),path=require('path');
const root=process.argv[2]||'.';
const STREAM='app/src/main/java/io/github/jackwener/dsh/feature/conversation/Stream.kt';
const p=path.join(root,STREAM);
let s=fs.readFileSync(p,'utf8');
const block=`    // Opening the keyboard shrinks the chat; when the newest message is the one on screen keep it
    // visible (and never yank a reader who scrolled somewhere else up to the bottom).
    val imeBottom = androidx.compose.foundation.layout.WindowInsets.ime.getBottom(androidx.compose.ui.platform.LocalDensity.current)
    LaunchedEffect(imeBottom) {
        if (imeBottom <= 0 || !follow || listState.isScrollInProgress || lastIndex < 0) return@LaunchedEffect
        listState.scrollToItem(lastIndex, Int.MAX_VALUE / 2)
        androidx.compose.runtime.withFrameNanos { }
        if (follow && !listState.isScrollInProgress) listState.scrollToItem(lastIndex, Int.MAX_VALUE / 2)
    }
`;
let n=0;
if(s.includes(block)){ s=s.replace(block,''); n++; }
s=s.split('\n').filter(l=>l!=='import androidx.compose.foundation.layout.ime'&&l!=='import androidx.compose.foundation.layout.getBottom').join('\n');
fs.writeFileSync(p,s);
const o=(s.match(/\{/g)||[]).length,c=(s.match(/\}/g)||[]).length;
console.log('reverted block='+n+' braces '+o+'/'+c+(o===c?' ok':' MISMATCH'));
process.exit(o===c&&n===1?0:1);
