// 用法: node patch_fix64.js [repoRoot]
// 启动画面：不要停留，内容一就绪立刻放行（能进多快就多快）；
// 但条件必须在第一帧之前设好，否则会先闪一下空窗口（黑屏）。
const fs = require('fs'), path = require('path');
const root = process.argv[2] || '.';
let bad = 0;
const F = 'app/src/main/java/io/github/jackwener/dsh/MainActivity.kt';
const full = path.join(root, F);
let s = fs.readFileSync(full, 'utf8');
if (s.includes('splashHold')) console.log('SKIP splash hold');
else {
  const fA = '    private var pendingSession by mutableStateOf<String?>(null)\n';
  const fB = '    private var pendingSession by mutableStateOf<String?>(null)\n' +
    '    /** 启动画面是否还挂着：内容一就绪就放行，但条件要在第一帧之前设好。 */\n' +
    '    private var splashHold by mutableStateOf(true)\n';
  if (!s.includes(fA)) { console.log('ANCHOR splash field'); bad++; }
  else s = s.replace(fA, fB);

  const aA = '        val splash = installSplashScreen()\n';
  const aB = '        val splash = installSplashScreen()\n' +
    '        // 第一帧之前设好：放到 setContent 里就晚了，会先闪一下空窗口（黑屏）。\n' +
    '        splash.setKeepOnScreenCondition { splashHold }\n';
  if (!s.includes(aA)) { console.log('ANCHOR splash install'); bad++; }
  else s = s.replace(aA, aB);

  const bA = '            // Until the theme is known and the first page chosen (home / onboarding).\n            splash.setKeepOnScreenCondition { theme == null || !navReady }\n';
  const bB = '            // 主题与首页一就绪立刻放行，不做任何停留。\n' +
    '            LaunchedEffect(theme, navReady) { if (theme != null && navReady) splashHold = false }\n';
  if (!s.includes(bA)) { console.log('ANCHOR splash condition'); bad++; }
  else s = s.replace(bA, bB);

  fs.writeFileSync(full, s);
  console.log('EDIT splash hold');
}
console.log(bad === 0 ? 'fix64 OK' : ('fix64 BAD ' + bad));
process.exit(bad === 0 ? 0 : 1);
