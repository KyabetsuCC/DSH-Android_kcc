// 用法: node patch_fix64.js [repoRoot]
// 启动画面至少停留一小会儿，让黑底 + 白鲸鱼图标看得见（原来主题一就绪就立刻进首页）。
const fs = require('fs'), path = require('path');
const root = process.argv[2] || '.';
let bad = 0;
const F = 'app/src/main/java/io/github/jackwener/dsh/MainActivity.kt';
const full = path.join(root, F);
let s = fs.readFileSync(full, 'utf8');
if (s.includes('splashMinDone')) console.log('SKIP splash minimum');
else {
  const a = '            // Until the theme is known and the first page chosen (home / onboarding).\n            splash.setKeepOnScreenCondition { theme == null || !navReady }\n';
  const b = '            // 启动画面至少停留 SPLASH_MIN_MS，黑底 + 白鲸鱼图标才看得见（否则主题一就绪就立刻进首页）。\n' +
    '            var splashMinDone by remember { mutableStateOf(false) }\n' +
    '            LaunchedEffect(Unit) { kotlinx.coroutines.delay(SPLASH_MIN_MS); splashMinDone = true }\n' +
    '            // Until the theme is known and the first page chosen (home / onboarding).\n' +
    '            splash.setKeepOnScreenCondition { theme == null || !navReady || !splashMinDone }\n';
  if (!s.includes(a)) { console.log('ANCHOR splash condition'); bad++; }
  else s = s.replace(a, b);

  // 常量放在 companion object 之外的文件末尾之前：找一个稳定的插入点（类的最后一个 } 前不好定位，改用 top-level private const）
  const c = 'class MainActivity :';
  if (!s.includes(c)) { console.log('ANCHOR main class'); bad++; }
  else s = s.replace(c, '/** 启动画面最少显示时长（毫秒）。 */\nprivate const val SPLASH_MIN_MS = 700L\n\n' + c);

  fs.writeFileSync(full, s);
  console.log('EDIT splash minimum');
}
console.log(bad === 0 ? 'fix64 OK' : ('fix64 BAD ' + bad));
process.exit(bad === 0 ? 0 : 1);
