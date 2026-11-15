#!/usr/bin/env node
// 用法: node patch_ball.js <FloatingBallService.kt> <app/build.gradle.kts>
// 环境变量: BALL_DP（悬浮球直径，默认 96）、TAG（版本名后缀，默认 kcc）
const fs = require('fs');
const NL = '\n';
const DP = process.env.BALL_DP || '96';
const TAG = process.env.TAG || 'kcc';

const [kt, gradle] = process.argv.slice(2);
const die = (m) => { console.error('PATCH FAILED: ' + m); process.exit(1); };
if (!kt || !fs.existsSync(kt)) die('missing kotlin file');
let s = fs.readFileSync(kt, 'utf8');

// ---- 1. 尺寸
const sizeOld = 'val size = (48 * resources.displayMetrics.density).toInt()';
if (!s.includes(sizeOld)) die('size line');
s = s.split(sizeOld).join(`val size = (${DP} * resources.displayMetrics.density).toInt()`);

// ---- 2. 关掉呼吸闪烁
const pulseOld = 'if (pulse == null) pulse = ObjectAnimator.ofFloat(v, View.ALPHA, 0.85f, 0.45f)';
if (!s.includes(pulseOld)) die('pulse line');
s = s.split(pulseOld).join('if (false) pulse = ObjectAnimator.ofFloat(v, View.ALPHA, 1f, 1f)');

// ---- 3. show() 三态图标（在改名之前，用原名精确匹配）
const showOld = '        v.setImageResource(when { waiting != null -> R.drawable.ic_ball_attention; running -> R.drawable.ic_ball_working; else -> R.drawable.ic_ball })' + NL;
if (!s.includes(showOld)) die('show() icon');
s = s.replace(showOld, [
  '        val res = when { waiting != null -> R.drawable.ball_attention; running -> R.drawable.ball_working; else -> R.drawable.ball_idle }',
  '        ballRes = res',
  '        setBall(v, res)',
  '',
].join(NL), 1);

// ---- 4. 初始图标
if (!s.includes('setImageResource(R.drawable.ic_ball)')) die('init icon');
s = s.replace('setImageResource(R.drawable.ic_ball)', 'setBall(this, R.drawable.ball_idle)', 1);

// ---- 5. 其余图标引用改名
s = s.replace(/R\.drawable\.ic_ball(?![_A-Za-z0-9])/g, 'R.drawable.ball_idle');

// ---- 6. 不透明（GIF 自带透明底）
s = s.split('alpha = 0.85f').join('alpha = 1f');

// ---- 7. imports
if (!s.includes('import android.graphics.ImageDecoder')) {
  const anchor = 'import android.graphics.PixelFormat' + NL;
  if (!s.includes(anchor)) die('PixelFormat import');
  s = s.replace(anchor, [
    'import android.graphics.ImageDecoder',
    'import android.graphics.drawable.AnimatedImageDrawable',
    'import android.graphics.drawable.Drawable',
    'import androidx.core.content.ContextCompat',
    anchor,
  ].join(NL), 1);
}

// ---- 8. 类尾追加辅助方法
const helper = [
  '',
  '    private val ballDrawables = HashMap<Int, Drawable>()',
  '    private var ballRes = R.drawable.ball_idle',
  '    private var ballFlash = 0',
  '',
  '    /** 静态图直接换 drawable；GIF 用 ImageDecoder 解成 AnimatedImageDrawable 才会动。 */',
  '    private fun setBall(v: ImageView, res: Int) {',
  '        var d = ballDrawables[res]',
  '        if (d == null) {',
  '            d = try {',
  '                ImageDecoder.decodeDrawable(ImageDecoder.createSource(resources, res))',
  '            } catch (e: Exception) {',
  '                ContextCompat.getDrawable(this, res)',
  '            }',
  '            if (d != null) ballDrawables[res] = d',
  '        }',
  '        if (d == null) return',
  '        v.setImageDrawable(d)',
  '        (d as? AnimatedImageDrawable)?.start()',
  '    }',
  '',
  '    /** 回合结束/出错时把球换成表情，几秒后回到当前状态。 */',
  '    private fun flashBall(res: Int, ms: Long) {',
  '        val v = view ?: return',
  '        val token = ++ballFlash',
  '        setBall(v, res)',
  '        v.postDelayed({ if (token == ballFlash) setBall(v, ballRes) }, ms)',
  '    }',
  '',
].join(NL);
const cut = s.trimEnd().lastIndexOf(NL + '}');
if (cut < 0) die('class end');
s = s.slice(0, cut) + NL + helper + s.slice(cut);

// ---- 9. 结束/失败闪表情
const endOld = ['        render()', '    }', '', '    private fun capsuleText('].join(NL);
if (!s.includes(endOld)) die('showCapsule end');
s = s.replace(endOld, [
  '        render()',
  '        if (status is CapsuleStatus.Ended) {',
  '            when (status.end) {',
  '                CapsuleStatus.End.Done -> flashBall(R.drawable.ball_happy, 2600)',
  '                CapsuleStatus.End.Failed -> flashBall(R.drawable.ball_error, 2600)',
  '                else -> Unit',
  '            }',
  '        }',
  '    }',
  '',
  '    private fun capsuleText(',
].join(NL), 1);

fs.writeFileSync(kt, s);
console.log('patched ' + kt + ' (' + s.length + ' bytes)');

// ---- 10. 版本名
if (gradle && fs.existsSync(gradle)) {
  let g = fs.readFileSync(gradle, 'utf8');
  if (g.includes('versionName = "0.3.11"')) {
    fs.writeFileSync(gradle, g.split('versionName = "0.3.11"').join(`versionName = "0.3.11-${TAG}"`));
    console.log('versionName -> 0.3.11-' + TAG);
  } else {
    console.log('WARN: versionName 未命中，保持原样');
  }
}
