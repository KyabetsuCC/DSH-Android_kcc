#!/usr/bin/env node
// 用法: node patch_ball3.js <FloatingBallService.kt> <app/build.gradle.kts>
// 环境变量: BALL_DP（悬浮球直径，默认 43）、TAG（版本名后缀，默认 kcc）
// v3: 43dp、气泡再缩、思考中(04)/敲代码(05) GIF 跟随胶囊状态、全局可见、待机淡化、单击互动
const fs = require('fs');
const NL = '\n';
const DP = process.env.BALL_DP || '43';
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

// ---- 2. 初始图标：待机 GIF + 不透明 ----
sub1([
  '        val v = ImageView(this).apply {',
  '            setImageResource(R.drawable.ic_ball)',
  '            alpha = 0.85f',
].join(NL), [
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

// ---- 6. show() 重写：只管「需要你」和「待机」，思考/敲代码交给胶囊流 ----
const showStart = s.indexOf('    private fun show(waiting: String?, running: Boolean) {');
if (showStart < 0) die('show() start');
const showEnd = s.indexOf('    /** Captures the main screen', showStart);
if (showEnd < 0) die('show() end');
const newShow = [
  '    private fun show(waiting: String?, running: Boolean) {',
  '        val v = view ?: return',
  '        lastWaiting = waiting',
  '        when {',
  '            waiting != null -> {',
  '                lastRunning = false',
  '                ballRes = R.drawable.ball_attention',
  '                if (!flashing) setBall(v, ballRes)',
  '                v.contentDescription = getString(R.string.ball_needs_you)',
  '                stopIdle()',
  '            }',
  '            running -> Unit // 思考中/敲代码的表情由胶囊状态驱动（见 showCapsule）',
  '            else -> {',
  '                ballIdle()',
  '                v.contentDescription = getString(R.string.app_name)',
  '            }',
  '        }',
  '    }',
  '',
].join(NL);
s = s.slice(0, showStart) + newShow + s.slice(showEnd);

// ---- 6.5 showCapsule 开头：胶囊状态 → 球表情（放在 capsule 判空之前，statusOn 关了也要跟） ----
sub1([
  '    private fun showCapsule(sessionId: String?, status: CapsuleStatus?, app: String?) {',
  '        val c = capsule ?: return',
].join(NL), [
  '    private fun showCapsule(sessionId: String?, status: CapsuleStatus?, app: String?) {',
  '        when (status) {',
  '            is CapsuleStatus.NeedsYou -> ballNeeds()',
  '            is CapsuleStatus.Working -> ballWorking(status.step != null)',
  '            null -> ballIdle()',
  '            else -> Unit',
  '        }',
  '        val c = capsule ?: return',
].join(NL), 'showCapsule wiring');

// ---- 7. 气泡再缩（字仍清晰） ----
sub1('            setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f)', '            setTextSize(TypedValue.COMPLEX_UNIT_SP, 11f)', 'capsule text size');
sub1('            setPadding(dp(12), 0, dp(12), 0)', '            setPadding(dp(7), 0, dp(7), 0)', 'capsule padding');
sub1('cornerRadius = dp(16).toFloat()', 'cornerRadius = dp(11).toFloat()', 'capsule corner');
sub1('WindowManager.LayoutParams.WRAP_CONTENT, dp(32), WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY',
     'WindowManager.LayoutParams.WRAP_CONTENT, dp(22), WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY', 'capsule height');
sub1('c.maxWidth = minOf(dp(240), w - ball.width - dp(32))',
     'c.maxWidth = minOf(dp(160), w - ball.width - dp(20))', 'capsule maxWidth');

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
  '    /** 需要用户处理（授权/提问）：提醒表情。 */',
  '    private fun ballNeeds() {',
  '        val v = view ?: return',
  '        lastWaiting = "y"; lastRunning = false',
  '        ballRes = R.drawable.ball_attention',
  '        if (!flashing) setBall(v, ballRes)',
  '        stopIdle()',
  '    }',
  '',
  '    /** 胶囊状态驱动：模型思考中（无工具）/ 跑工具（敲代码）。 */',
  '    private fun ballWorking(tool: Boolean) {',
  '        val v = view ?: return',
  '        lastWaiting = null; lastRunning = true',
  '        ballRes = if (tool) R.drawable.ball_typing else R.drawable.ball_thinking',
  '        if (!flashing) setBall(v, ballRes)',
  '        stopIdle()',
  '    }',
  '',
  '    private fun ballIdle() {',
  '        val v = view ?: return',
  '        lastWaiting = null; lastRunning = false',
  '        ballRes = R.drawable.ball_idle',
  '        if (!flashing) setBall(v, ballRes)',
  '        startIdle()',
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
sub1(['        render()', '    }', '', '    private fun capsuleText('].join(NL), [
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

console.log("all done");
