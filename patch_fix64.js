// 用法: node patch_fix64.js [repoRoot]
// 启动画面：保持条件必须在第一帧之前设好（原来放在 setContent 里太晚，闪一下黑屏），
// 并且至少停留 SPLASH_MIN_MS，黑底 + 白鲸鱼图标才看得见。
const fs = require('fs'), path = require('path');
const root = process.argv[2] || '.';
let bad = 0;
const F = 'app/src/main/java/io/github/jackwener/dsh/MainActivity.kt';
const full = path.join(root, F);
let s = fs.readFileSync(full, 'utf8');
if (s.includes('splashHold')) console.log('SKIP splash hold');
else {
  // 1) 状态字段：跟着 pendingSession 一起
  const fA = '    private var pendingSession by mutableStateOf<String?>(null)\n';
  const fB = '    private var pendingSession by mutableStateOf<String?>(null)\n' +
    '    /** 启动画面是否还挂着：条件在第一帧之前就要读它。 */\n' +
    '    private var splashHold by mutableStateOf(true)\n';
  if (!s.includes(fA)) { console.log('ANCHOR splash field'); bad++; }
  else s = s.replace(fA, fB);

  // 2) installSplashScreen 之后立刻设条件
  const aA = '        val splash = installSplashScreen()\n';
  const aB = '        val splash = installSplashScreen()\n' +
    '        // 必须在第一帧之前设好：放到 setContent 里就晚了，会先闪一下空窗口。\n' +
    '        splash.setKeepOnScreenCondition { splashHold }\n';
  if (!s.includes(aA)) { console.log('ANCHOR splash install'); bad++; }
  else s = s.replace(aA, aB);

  // 3) 去掉 setContent 里那行旧条件
  const bA = '            // Until the theme is known and the first page chosen (home / onboarding).\n            splash.setKeepOnScreenCondition { theme == null || !navReady }\n';
  const bB = '            // 主题与首页就绪后，再让启动画面多停一会儿（黑底 + 白鲸鱼图标）。\n' +
    '            LaunchedEffect(theme, navReady) {\n' +
    '                if (theme != null && navReady) { kotlinx.coroutines.delay(SPLASH_MIN_MS); splashHold = false }\n' +
    '            }\n';
  if (!s.includes(bA)) { console.log('ANCHOR splash condition'); bad++; }
  else s = s.replace(bA, bB);

  // 4) 常量
  const c = '@AndroidEntryPoint\nclass MainActivity :';
  if (!s.includes(c)) { console.log('ANCHOR main class'); bad++; }
  else s = s.replace(c, '/** 启动画面最少显示时长（毫秒）。 */\nprivate const val SPLASH_MIN_MS = 700L\n\n' + c);

  fs.writeFileSync(full, s);
  console.log('EDIT splash hold');
}
console.log(bad === 0 ? 'fix64 OK' : ('fix64 BAD ' + bad));
process.exit(bad === 0 ? 0 : 1);
