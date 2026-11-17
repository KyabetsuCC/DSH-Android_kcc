// Ball v4: 8 more whale-girl reactions (drag / sleeping / build / carry / swim / music / conducting).
const fs = require('fs');
const arg = process.argv[2] || '.';
const NL = '\n';
const kt = arg.endsWith('.kt') ? arg : arg + '/app/src/main/java/io/github/jackwener/dsh/service/FloatingBallService.kt';
let s = fs.readFileSync(kt, 'utf8');
let bad = 0;
const Q = String.fromCharCode(34);

function sub1(a, b, tag) {
  if (s.includes(b)) { console.log('SKIP ' + tag); return; }
  if (!s.includes(a)) { console.log('ANCHOR ' + tag); bad++; return; }
  s = s.replace(a, b);
  console.log('EDIT ' + tag);
}

// 1. dragging shows the drag face
sub1(
  '                    if (!dragging && (abs(e.rawX - downX) >= 12 || abs(e.rawY - downY) >= 12)) { dragging = true; v.removeCallbacks(longPress); render() }',
  '                    if (!dragging && (abs(e.rawX - downX) >= 12 || abs(e.rawY - downY) >= 12)) { dragging = true; v.removeCallbacks(longPress); render() }' + NL +
  '                    if (dragging && !flashing) setBall(v, R.drawable.ball_drag)',
  'drag face');

// 2. cancel / up restore the state face
sub1(
  'MotionEvent.ACTION_CANCEL -> { v.removeCallbacks(longPress); dragging = false; placeCapsule(); render(); true }',
  'MotionEvent.ACTION_CANCEL -> { v.removeCallbacks(longPress); dragging = false; placeCapsule(); render(); restoreBall(); true }',
  'cancel restore');
sub1(
  '                    v.removeCallbacks(longPress)' + NL + '                    dragging = false' + NL,
  '                    v.removeCallbacks(longPress)' + NL + '                    dragging = false' + NL + '                    restoreBall()' + NL,
  'up restore');

// 3. sleep timer field
sub1('    private var interactIndex = 0', '    private var interactIndex = 0' + NL + '    private var sleepTask: Runnable? = null', 'sleep field');

// 4. helper methods before interact()
sub1(
  '    /** 单击：随机挠痒/戳一戳表情。 */',
  [
    '    /** Restores the face the current state wants (after a drag). */',
    '    private fun restoreBall() {',
    '        if (flashing) return',
    '        val v = view ?: return',
    '        setBall(v, ballRes)',
    '    }',
    '',
    '    /** Idle for a long time: the whale girl falls asleep. */',
    '    private fun scheduleSleep() {',
    '        val v = view ?: return',
    '        sleepTask?.let { v.removeCallbacks(it) }',
    '        val r = Runnable {',
    '            if (!flashing && !lastRunning && lastWaiting == null && view != null) setBall(v, R.drawable.ball_sleeping)',
    '        }',
    '        sleepTask = r',
    '        v.postDelayed(r, IDLE_SLEEP_MS)',
    '    }',
    '',
    '    /** 单击：随机挠痒/戳一戳表情。 */',
  ].join(NL),
  'helpers');

// 5. working faces rotate
sub1(
  '        ballRes = if (tool) R.drawable.ball_typing else R.drawable.ball_thinking',
  '        val spin = ((System.currentTimeMillis() / 8000L) % 3L).toInt()' + NL +
  '        ballRes = if (tool) WORK_TOOL[spin] else WORK_THINK[spin]',
  'working spin');

// 6. idle schedules the sleep
sub1('        scheduleIdleVariant()', '        scheduleIdleVariant()' + NL + '        scheduleSleep()', 'idle sleep');

// 7. stopIdle cancels the sleep
sub1(
  '        idleVariant?.let { view?.removeCallbacks(it) }; idleVariant = null' + NL + '        view?.alpha = 1f',
  '        idleVariant?.let { view?.removeCallbacks(it) }; idleVariant = null' + NL +
  '        sleepTask?.let { view?.removeCallbacks(it) }; sleepTask = null' + NL +
  '        view?.alpha = 1f',
  'stopIdle sleep');

// 8. wake cancels sleep and restores the face
sub1(
  '    private fun wakeBall() {' + NL + '        idleFade?.cancel(); idleFade = null' + NL + '        view?.alpha = 1f',
  '    private fun wakeBall() {' + NL + '        idleFade?.cancel(); idleFade = null' + NL +
  '        sleepTask?.let { view?.removeCallbacks(it) }; sleepTask = null' + NL +
  '        view?.alpha = 1f' + NL +
  '        if (!flashing && !lastRunning && lastWaiting == null) view?.let { setBall(it, ballRes) }',
  'wake sleep');

// 9. more idle faces and interactions
sub1(
  '            R.drawable.ball_look, R.drawable.ball_spout, R.drawable.ball_waking,',
  '            R.drawable.ball_look, R.drawable.ball_spout, R.drawable.ball_waking, R.drawable.ball_swim, R.drawable.ball_music,',
  'idle variants');
sub1(
  '            R.drawable.ball_hearts, R.drawable.ball_thumbs,',
  '            R.drawable.ball_hearts, R.drawable.ball_thumbs, R.drawable.ball_conducting, R.drawable.ball_swim,',
  'interact pool');

// 10. constants
sub1(
  '        private const val IDLE_VARIANT_MS = 16000L',
  [
    '        private const val IDLE_VARIANT_MS = 16000L',
    '        private const val IDLE_SLEEP_MS = 120000L',
    '        private val WORK_TOOL = intArrayOf(',
    '            R.drawable.ball_typing, R.drawable.ball_building, R.drawable.ball_carrying,',
    '        )',
    '        private val WORK_THINK = intArrayOf(',
    '            R.drawable.ball_thinking, R.drawable.ball_conducting, R.drawable.ball_music,',
    '        )',
  ].join(NL),
  'consts');

fs.writeFileSync(kt, s);
if (bad) process.exit(1);
console.log('ball v4 done (' + s.length + ' bytes)');
