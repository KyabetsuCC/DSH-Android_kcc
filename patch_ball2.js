#!/usr/bin/env node
// 用法: node patch_ball2.js <FloatingBallService.kt> <app/build.gradle.kts>
// 环境变量: BALL_DP（悬浮球直径，默认 64）、TAG（版本名后缀，默认 kcc）
const fs = require('fs');
const NL = '\n';
const DP = process.env.BALL_DP || '64';
const TAG = process.env.TAG || 'kcc';

const [kt, gradle] = process.argv.slice(2);
const die = (m) => { console.error('PATCH FAILED: ' + m); process.exit(1); };
if (!kt || !fs.existsSync(kt)) die('missing kotlin file');
let s = fs.readFileSync(kt, 'utf8');
const must = (frag, name) => { if (!s.includes(frag)) die(name + ' :: ' + frag.slice(0, 60)); };
const sub1 = (from, to, name) => { must(from, name); s = s.replace(from, to); };

// ---- 1. 尺寸 ----
sub1('val size = (48 * resources.displayMetrics.density).toInt()',
     'val size = (' + DP + ' * resources.displayMetrics.density).toInt()', 'size');

// ---- 2. 初始图标 + 不透明 ----
const initOld = [
  '        val v = ImageView(this).apply {',
  '            setImageResource(R.drawable.ic_ball)',
  '            alpha = 0.85f',
].join(NL);
sub1(initOld, [
  '        val v = ImageView(this).apply {',
  '            setBall(this, R.drawable.ball_idle)',
  '            alpha = 1f',
].join(NL), 'init icon');

// ---- 3. 单击=互动，双击=开本体 ----
sub1('        val singleTap = Runnable { open() }',
     '        val singleTap = Runnable { interact() }', 'singleTap');
sub1('if (e.eventTime - lastTap < doubleTapMs) { v.removeCallbacks(singleTap); lastTap = 0; sendScreen() }',
     'if (e.eventTime - lastTap < doubleTapMs) { v.removeCallbacks(singleTap); lastTap = 0; openApp() }', 'doubleTap');

// ---- 4. 按下时恢复不透明 ----
sub1('                    downX = e.rawX; downY = e.rawY; startX = lp.x; startY = lp.y' + NL,
     '                    downX = e.rawX; downY = e.rawY; startX = lp.x; startY = lp.y; wakeBall()' + NL, 'ACTION_DOWN');

// ---- 5. 全局可见（不再因本体在前台而隐藏） ----
sub1('        view?.visibility = when { inFront -> View.GONE; shooting -> View.INVISIBLE; else -> View.VISIBLE }',
     '        view?.visibility = if (shooting) View.INVISIBLE else View.VISIBLE', 'render ball');
sub1('        capsule?.visibility = if (statusOn && !inFront && !shooting && !dragging && capsuleSession != null) View.VISIBLE else View.GONE',
     '        capsule?.visibility = if (statusOn && !shooting && !dragging && capsuleSession != null) View.VISIBLE else View.GONE', 'render capsule');

// ---- 6. show() 整体重写（待机淡出 + GIF 状态） ----
const showStart = s.indexOf('    private fun show(waiting: String?, running: Boolean) {');
if (showStart < 0) die('show() start');
const showEnd = s.indexOf('    /** Captures the main screen', showStart);
if (showEnd < 0) die('show() end');
const newShow = [
  '    private fun show(waiting: String?, running: Boolean) {',
  '        val v = view ?: return',
  '        lastWaiting = waiting; lastRunning = running',
  '        ballRes = when { waiting != null -> R.drawable.ball_attention; running -> R.drawable.ball_working; else -> R.drawable.ball_idle }',
  '        if (!flashing) setBall(v, ballRes)',
  '        v.contentDescription = getString(when { waiting != null -> R.string.ball_needs_you; running -> R.string.ball_working; else -> R.string.app_name })',
  '        if (running || waiting != null) stopIdle() else startIdle()',
  '    }',
  '',
].join(NL);
s = s.slice(0, showStart) + newShow + s.slice(showEnd);

// ---- 7. 气泡缩小（字仍清晰） ----
sub1('            setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f)', '            setTextSize(TypedValue.COMPLEX_UNIT_SP, 12f)', 'capsule text size');
sub1('            setPadding(dp(12), 0, dp(12), 0)', '            setPadding(dp(9), 0, dp(9), 0)', 'capsule padding');
sub1('cornerRadius = dp(16).toFloat()', 'cornerRadius = dp(13).toFloat()', 'capsule corner');
sub1('WindowManager.LayoutParams.WRAP_CONTENT, dp(32), WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY',
     'WindowManager.LayoutParams.WRAP_CONTENT, dp(26), WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY', 'capsule height');
sub1('c.maxWidth = minOf(dp(240), w - ball.width - dp(32))',
     'c.maxWidth = minOf(dp(200), w - ball.width - dp(24))', 'capsule maxWidth');

// ---- 8. imports ----
if (!s.includes('import android.graphics.ImageDecoder')) {
  sub1('import android.graphics.PixelFormat' + NL, [
    'import android.graphics.ImageDecoder',
    'import android.graphics.drawable.AnimatedImageDrawable',
    'import android.graphics.drawable.Drawable',
    'import android.view.animation.DecelerateInterpolator',
    'import androidx.core.content.ContextCompat',
    'import android.graphics.PixelFormat',
  ].join(NL) + NL, 'imports');
}

// ---- 9. 类尾辅助方法 ----
const helper = [
  '',
  '    private val ballDrawables = HashMap<Int, Drawable>()',
  '    private var ballRes = R.drawable.ball_idle',
  '    private var lastWaiting: String? = null',
  '    private var lastRunning = false',
  '    private var flashing = false',
  '    private var flashToken = 0',
  '    private var idleFade: ObjectAnimator? = null',
  '    private var idleVariant: Runnable? = null',
  '    private var interactIndex = 0',
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
  '    /** 临时播放一个表情，几秒后回到当前状态。 */',
  '    private fun flashBall(res: Int, ms: Long) {',
  '        val v = view ?: return',
  '        flashing = true',
  '        val token = ++flashToken',
  '        setBall(v, res)',
  '        v.postDelayed({',
  '            if (token == flashToken) {',
  '                flashing = false',
  '                setBall(v, ballRes)',
  '                if (!lastRunning && lastWaiting == null) startIdle()',
  '            }',
  '        }, ms)',
  '    }',
  '',
  '    /** 单击：随机挠痒/戳一戳表情。 */',
  '    private fun interact() {',
  '        val v = view ?: return',
  '        wakeBall()',
  '        stopIdle()',
  '        flashBall(INTERACT[interactIndex++ % INTERACT.size], 1800L)',
  '    }',
  '',
  '    /** 双击：直接打开 DSH 本体（有正在看的会话就进那个会话）。 */',
  '    private fun openApp() {',
  '        wakeBall()',
  '        ActivityStarts.start(this, Intent(this, MainActivity::class.java).apply {',
  '            capsuleSession?.let { putExtra(MainActivity.EXTRA_SESSION, it) }',
  '        })',
  '    }',
  '',
  '    private fun wakeBall() {',
  '        idleFade?.cancel(); idleFade = null',
  '        view?.alpha = 1f',
  '    }',
  '',
  '    /** 待机：先保持不透明几秒，再慢慢淡到 IDLE_ALPHA。 */',
  '    private fun startIdle() {',
  '        val v = view ?: return',
  '        if (idleFade != null) return',
  '        idleFade = ObjectAnimator.ofFloat(v, View.ALPHA, v.alpha, IDLE_ALPHA).apply {',
  '            duration = IDLE_FADE_MS; startDelay = IDLE_DELAY_MS; interpolator = DecelerateInterpolator(); start()',
  '        }',
  '        scheduleIdleVariant()',
  '    }',
  '',
  '    private fun stopIdle() {',
  '        idleFade?.cancel(); idleFade = null',
  '        idleVariant?.let { view?.removeCallbacks(it) }; idleVariant = null',
  '        view?.alpha = 1f',
  '    }',
  '',
  '    /** 待机久了偶尔换个小动作（看一眼 / 喷水 / 刚醒），看起来是活的。 */',
  '    private fun scheduleIdleVariant() {',
  '        val v = view ?: return',
  '        idleVariant?.let { v.removeCallbacks(it) }',
  '        val r = Runnable {',
  '            if (!flashing && !lastRunning && lastWaiting == null && view != null) {',
  '                flashBall(IDLE_VARIANTS[(interactIndex++).mod(IDLE_VARIANTS.size)], 1600L)',
  '            }',
  '            scheduleIdleVariant()',
  '        }',
  '        idleVariant = r',
  '        v.postDelayed(r, IDLE_VARIANT_MS)',
  '    }',
  '',
].join(NL);
const cut = s.trimEnd().lastIndexOf(NL + '}');
if (cut < 0) die('class end');
s = s.slice(0, cut) + NL + helper + s.slice(cut);

// ---- 10. companion 常量 ----
sub1('        private const val SHOT_HIDE_MS = 120L', [
  '        private const val SHOT_HIDE_MS = 120L',
  '        private const val IDLE_ALPHA = 0.55f',
  '        private const val IDLE_DELAY_MS = 6000L',
  '        private const val IDLE_FADE_MS = 4000L',
  '        private const val IDLE_VARIANT_MS = 16000L',
  '        private val INTERACT = intArrayOf(',
  '            R.drawable.ball_tickle, R.drawable.ball_poke_l, R.drawable.ball_poke_r,',
  '            R.drawable.ball_hearts, R.drawable.ball_thumbs,',
  '        )',
  '        private val IDLE_VARIANTS = intArrayOf(',
  '            R.drawable.ball_look, R.drawable.ball_spout, R.drawable.ball_waking,',
  '        )',
].join(NL), 'companion consts');

// ---- 11. 结束/失败闪表情 ----
const endOld = ['        render()', '    }', '', '    private fun capsuleText('].join(NL);
sub1(endOld, [
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
].join(NL), 'showCapsule end');

fs.writeFileSync(kt, s);
console.log('patched ' + kt + ' (' + s.length + ' bytes)');

// ---- 12. 版本名 ----
if (gradle && fs.existsSync(gradle)) {
  let g = fs.readFileSync(gradle, 'utf8');
  if (g.includes('versionName = "0.3.11"')) {
    fs.writeFileSync(gradle, g.split('versionName = "0.3.11"').join('versionName = "0.3.11-' + TAG + '"'));
    console.log('versionName -> 0.3.11-' + TAG);
  } else {
    console.log('WARN: versionName 未命中，保持原样');
  }
}
