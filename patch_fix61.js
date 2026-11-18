// 用法: node patch_fix61.js [repoRoot]
// 启动画面配色：蓝色底 -> 官方 dsh 的黑白（纯黑底 + 白色鲸鱼）。
const fs = require('fs'), path = require('path');
const root = process.argv[2] || '.';
let bad = 0;
function rd(f) { return fs.readFileSync(path.join(root, f), 'utf8'); }
function wr(f, s) { fs.writeFileSync(path.join(root, f), s); }

// 1) 启动图标底色（splash 背景 + 自适应图标底色）
const COLORS = 'app/src/main/res/values/colors.xml';
let c = rd(COLORS);
if (c.includes('#FF000000')) { console.log('SKIP launcher_bg'); }
else if (c.includes('#FF4176E6')) {
  c = c.replace('#FF4176E6', '#FF000000');
  wr(COLORS, c);
  console.log('EDIT launcher_bg -> black');
} else { console.log('ANCHOR launcher_bg'); bad++; }

// 2) 亮色主题的窗口底色也换成黑，避免启动时先闪一下白
const THEME = 'app/src/main/res/values/themes.xml';
let t = rd(THEME);
if (t.includes('@android:color/black')) { console.log('SKIP windowBackground'); }
else if (t.includes('<item name="android:windowBackground">@android:color/white</item>')) {
  t = t.replace('<item name="android:windowBackground">@android:color/white</item>',
    '<item name="android:windowBackground">@android:color/black</item>');
  wr(THEME, t);
  console.log('EDIT windowBackground -> black');
} else { console.log('ANCHOR windowBackground'); bad++; }

console.log(bad === 0 ? 'fix61 OK' : ('fix61 BAD ' + bad));
process.exit(bad === 0 ? 0 : 1);
