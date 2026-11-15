// patch_fix2.js —— 上游缺陷第二批（#76-3 状态行 / #76-5 技能导入弹窗不能滚动）
// 用法: node patch_fix2.js [repoRoot]   幂等：已打过会 SKIP
const fs = require('fs'), path = require('path');
const root = process.argv[2] || '.';
let bad = 0, done = 0, skip = 0;

function edit(rel, label, from, to) {
  const p = path.join(root, rel);
  const src = fs.readFileSync(p, 'utf8');
  if (src.includes(to) && to !== from) { console.log('SKIP', label); skip++; return; }
  if (!src.includes(from)) { console.log('MISS', label); bad++; return; }
  fs.writeFileSync(p, src.replace(from, to));
  console.log('OK  ', label); done++;
}

// 1) 状态行：#76-3 —— 模型思考期间没有「正在运行的工具」，改成再退一层显示已完成的操作数
const STREAM = 'app/src/main/java/io/github/jackwener/dsh/feature/conversation/Stream.kt';
edit(STREAM, 'Stream: 状态行显示步骤数',
`            val tool = lastTurn?.takeIf { it.status == TurnStatus.Running }?.blocks?.lastOrNull { it is Block.Tool && it.state == ToolState.Running } as Block.Tool?
            if (tool != null) stringResource(R.string.deep_diving_activity, stringResource(ToolPresentation.info(tool.name).activity.live), Fmt.duration(context, now - start))
            else stringResource(R.string.deep_diving, Fmt.duration(context, now - start))`,
`            val turn = lastTurn?.takeIf { it.status == TurnStatus.Running }
            val tool = turn?.blocks?.lastOrNull { it is Block.Tool && it.state == ToolState.Running } as Block.Tool?
            val steps = turn?.blocks?.count { it is Block.Tool } ?: 0
            if (tool != null) stringResource(R.string.deep_diving_activity, stringResource(ToolPresentation.info(tool.name).activity.live), Fmt.duration(context, now - start))
            else if (steps > 0) stringResource(R.string.deep_diving_steps, steps, Fmt.duration(context, now - start))
            else stringResource(R.string.deep_diving, Fmt.duration(context, now - start))`);

// 2) 三套 strings 加 deep_diving_steps
const STR = {
  'app/src/main/res/values/strings.xml': ['已完成 %1$d 项操作，用时 %2$s ···', 'deep_diving_steps'],
  'app/src/main/res/values-en/strings.xml': ['%1$d steps done · %2$s ···', 'deep_diving_steps'],
  'app/src/main/res/values-ru/strings.xml': ['Выполнено шагов: %1$d · %2$s ···', 'deep_diving_steps'],
};
for (const [rel, [text]] of Object.entries(STR)) {
  const p = path.join(root, rel);
  const src = fs.readFileSync(p, 'utf8');
  if (src.includes('<string name="deep_diving_steps">')) { console.log('SKIP strings', rel); skip++; continue; }
  const m = src.match(/^([ \t]*)<string name="deep_diving_activity">.*?<\/string>$/m);
  if (!m) { console.log('MISS strings anchor', rel); bad++; continue; }
  const line = `${m[1]}<string name="deep_diving_steps">${text}</string>`;
  fs.writeFileSync(p, src.replace(m[0], m[0] + '\n' + line));
  console.log('OK   strings', rel); done++;
}

// 3) #76-5 技能导入弹窗：内容区加滚动（技能多时下面看不到、划不动）
const SKILLS = 'app/src/main/java/io/github/jackwener/dsh/feature/extensions/SkillsTab.kt';
edit(SKILLS, 'SkillsTab: 弹窗可滚动（开）',
`    }) {
        when {
            i.loading -> Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {`,
`    }) {
        // 技能多时弹窗内容会超出一屏且划不动（#76-5）：限高 + 滚动。
        Column(Modifier.heightIn(max = 460.dp).verticalScroll(rememberScrollState())) {
        when {
            i.loading -> Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {`);
edit(SKILLS, 'SkillsTab: 弹窗可滚动（合）',
`            }
        }
        i.error?.let { Text(ExtText.error(context, it), style = DshType.xs13, color = c.error) }`,
`            }
        }
        }
        i.error?.let { Text(ExtText.error(context, it), style = DshType.xs13, color = c.error) }`);
edit(SKILLS, 'SkillsTab: imports',
`import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding`,
`import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll`);

console.log(`\npatch_fix2: ${done} changed, ${skip} skipped, ${bad} failed`);
if (bad) process.exit(1);
