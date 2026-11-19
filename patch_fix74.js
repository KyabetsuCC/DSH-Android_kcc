// 0.1.19: show that the agent is driving the browser — breathing dot on the globe (conversation bar +
// sidebar entry) and an "AI is working" pill in the middle of the browser's bottom bar.
const fs = require('fs')
const root = process.argv[2] || '.'
const P = root + '/app/src/main/java/io/github/jackwener/dsh'
function edit(file, fn) {
  const p = P + file
  let s = fs.readFileSync(p, 'utf8')
  const before = s
  s = fn(s)
  if (s === before) { console.log('  ~ no change ' + file); return }
  fs.writeFileSync(p, s)
  console.log('  EDIT ' + file)
}
function must(s, from, to, tag) {
  if (!s.includes(from)) { console.log('ANCHOR ' + tag); process.exit(1) }
  return s.replace(from, to)
}

// 0) the breathing dot itself, next to StateDot / Spinner
edit('/core/designsystem/Primitives.kt', (s) => {
  if (s.includes('fun LiveDot(')) { console.log('  SKIP Primitives'); return s }
  const anchor = '/** Rotating arc, 1.5 s per turn (StateDot ongoing). */'
  return must(s, anchor, [
    '/**',
    ' * dsh LiveDot: the breathing blue dot that marks "the agent is working here right now".',
    ' * Fades between 35% and 100% every 1.6 s; static when the user asked for reduced motion.',
    ' */',
    '@Composable',
    'fun LiveDot(size: Dp = 7.dp, color: Color = Dsh.colors.business) {',
    '    val reduced = LocalReducedMotion.current',
    '    val pulse = if (reduced) 0.8f else rememberInfiniteTransition(label = "live")',
    '        .animateFloat(0.35f, 1f, infiniteRepeatable(tween(1600), RepeatMode.Reverse), label = "p").value',
    '    Box(Modifier.size(size), contentAlignment = Alignment.Center) {',
    '        Box(Modifier.size(size).clip(CircleShape).background(color.copy(alpha = pulse * 0.4f)))',
    '        Box(Modifier.size(size * 0.6f).clip(CircleShape).background(color.copy(alpha = pulse)))',
    '    }',
    '}',
    '',
    anchor,
  ].join('\n'), 'LiveDot')
})

// 1) CapabilityHub: every browser tool call marks the session busy (one place, covers all tools)
edit('/core/capability/CapabilityHub.kt', (s) => {
  if (s.includes('BrowserSession.agentBegin')) { console.log('  SKIP CapabilityHub'); return s }
  s = must(s,
    '        _live.update { it + (liveKey to LiveCall(sessionId, name, mainScreen, acts = tool.descriptor.risk != Risk.read)) }\n        val result = try {\n            withTimeoutOrNull(budgetMs) { run(tool, name, args, call) }?.also { experience.observe(sessionId, name, args, it) }\n        } finally {\n            _live.update { it - liveKey }\n        }',
    '        _live.update { it + (liveKey to LiveCall(sessionId, name, mainScreen, acts = tool.descriptor.risk != Risk.read)) }\n        // browser-live-dot: the user has to be able to see that the agent is driving the browser.\n        val browserCall = group == ToolGroup.Browser\n        if (browserCall) BrowserSession.agentBegin(name)\n        val result = try {\n            withTimeoutOrNull(budgetMs) { run(tool, name, args, call) }?.also { experience.observe(sessionId, name, args, it) }\n        } finally {\n            _live.update { it - liveKey }\n            if (browserCall) BrowserSession.agentEnd()\n        }',
    'invoke')
  return s
})

// 2) conversation title bar: dot on the globe's top-right corner
edit('/feature/conversation/HomeScreen.kt', (s) => {
  if (s.includes('browser-live-dot')) { console.log('  SKIP HomeScreen'); return s }
  s = must(s,
    'import androidx.compose.foundation.layout.padding',
    'import androidx.compose.foundation.layout.padding\nimport androidx.compose.foundation.layout.size',
    'hs size import')
  s = must(s,
    'import io.github.jackwener.dsh.core.designsystem.IconBtn',
    'import io.github.jackwener.dsh.core.designsystem.IconBtn\nimport io.github.jackwener.dsh.core.designsystem.LiveDot',
    'hs livedot import')
  s = must(s,
    '            // browser-globe-always: the user opens the browser as well, e.g. to sign in first.\n            IconBtn(R.drawable.dsw_globe_outline, { browserOpen = true }, size = 40.dp, iconSize = 18.dp, tint = c.labelSecondary,\n                contentDescription = stringResource(R.string.browser_title))',
    '            // browser-globe-always: the user opens the browser as well, e.g. to sign in first.\n            Box(Modifier.size(40.dp)) {\n                IconBtn(R.drawable.dsw_globe_outline, { browserOpen = true }, size = 40.dp, iconSize = 18.dp, tint = c.labelSecondary,\n                    contentDescription = stringResource(R.string.browser_title))\n                // browser-live-dot: breathing dot while an agent browser call runs.\n                if (BrowserSession.agentBusy) {\n                    Box(Modifier.align(Alignment.TopEnd).padding(top = 7.dp, end = 7.dp)) { LiveDot() }\n                }\n            }',
    'hs globe')
  return s
})

// 3) sidebar: dot to the right of the browser entry label (its own composable, so the three
//    existing PanelEntry call sites keep their trailing-lambda form and stay valid).
edit('/feature/conversation/SessionDrawer.kt', (s) => {
  if (s.includes('browser-live-dot')) { console.log('  SKIP SessionDrawer'); return s }
  s = must(s,
    'import io.github.jackwener.dsh.core.designsystem.IconBtn',
    'import io.github.jackwener.dsh.core.designsystem.IconBtn\nimport io.github.jackwener.dsh.core.designsystem.LiveDot',
    'sd livedot import')
  s = must(s,
    '        PanelEntry(R.drawable.dsw_globe_outline, stringResource(R.string.browser_title)) { browserOpen = true }',
    '        // browser-live-dot: same breathing dot as the conversation bar, so it is visible while the drawer is open.\n        PanelEntryLive(R.drawable.dsw_globe_outline, stringResource(R.string.browser_title), BrowserSession.agentBusy, { browserOpen = true })',
    'sd entry')
  s = must(s,
    'private fun PanelEntry(@DrawableRes icon: Int, label: String, onClick: () -> Unit) {\n    val c = Dsh.colors\n    Row(Modifier.fillMaxWidth().heightIn(min = 40.dp).pressable(onClick, Radius.md).padding(horizontal = 8.dp, vertical = 7.dp),\n        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {\n        DIcon(icon, size = 16.dp, tint = c.labelSecondary)\n        Text(label, style = DshType.s14, color = c.labelPrimary)\n    }\n}',
    'private fun PanelEntry(@DrawableRes icon: Int, label: String, onClick: () -> Unit) {\n    val c = Dsh.colors\n    Row(Modifier.fillMaxWidth().heightIn(min = 40.dp).pressable(onClick, Radius.md).padding(horizontal = 8.dp, vertical = 7.dp),\n        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {\n        DIcon(icon, size = 16.dp, tint = c.labelSecondary)\n        Text(label, style = DshType.s14, color = c.labelPrimary)\n    }\n}\n\n/** Same row as [PanelEntry] plus the breathing dot that marks an agent browser call. */\n@Composable\nprivate fun PanelEntryLive(@DrawableRes icon: Int, label: String, live: Boolean, onClick: () -> Unit) {\n    val c = Dsh.colors\n    Row(Modifier.fillMaxWidth().heightIn(min = 40.dp).pressable(onClick, Radius.md).padding(horizontal = 8.dp, vertical = 7.dp),\n        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {\n        DIcon(icon, size = 16.dp, tint = c.labelSecondary)\n        Text(label, style = DshType.s14, color = c.labelPrimary)\n        if (live) LiveDot()\n    }\n}',
    'sd panelentry')
  if (!s.includes('import io.github.jackwener.dsh.core.capability.BrowserSession')) {
    s = must(s,
      'import io.github.jackwener.dsh.feature.browser.BrowserPage',
      'import io.github.jackwener.dsh.core.capability.BrowserSession\nimport io.github.jackwener.dsh.feature.browser.BrowserPage',
      'sd session import')
  }
  return s
})

// 4) browser page: the pill in the middle of the bottom bar
edit('/feature/browser/BrowserPage.kt', (s) => {
  if (s.includes('browser-agent-pill')) { console.log('  SKIP BrowserPage'); return s }

  s = must(s,
    'import io.github.jackwener.dsh.core.designsystem.IconBtn',
    'import io.github.jackwener.dsh.core.designsystem.IconBtn\nimport io.github.jackwener.dsh.core.designsystem.LiveDot',
    'bp livedot import')
  s = must(s,
    '                Spacer(Modifier.weight(1f))\n                Box(\n                    Modifier.size(36.dp).clip(Radius.sm).pressable({ tabsOpen = true }, Radius.sm),',
    '                Box(Modifier.weight(1f), contentAlignment = Alignment.Center) { AgentPill() }\n                Box(\n                    Modifier.size(36.dp).clip(Radius.sm).pressable({ tabsOpen = true }, Radius.sm),',
    'bp pill slot')
  s = must(s,
    '@Composable\nfun BrowserPage(onClose: () -> Unit) {',
    [
      '/** browser-agent-pill: what the agent is doing right now, in the empty middle of the bottom bar. */',
      '@Composable',
      'private fun AgentPill() {',
      '    val c = Dsh.colors',
      '    val busy = BrowserSession.agentBusy',
      '    val steps = BrowserSession.agentSteps',
      '    val done = BrowserSession.agentFinished',
      '    if (!busy && done <= 0) return',
      '    Row(',
      '        Modifier.clip(Radius.xl)',
      '            .background(if (busy) c.business.copy(alpha = 0.16f) else c.success.copy(alpha = 0.16f))',
      '            .padding(start = 9.dp, end = 11.dp, top = 4.dp, bottom = 4.dp),',
      '        verticalAlignment = Alignment.CenterVertically,',
      '        horizontalArrangement = Arrangement.spacedBy(6.dp),',
      '    ) {',
      '        if (busy) {',
      '            LiveDot()',
      '            Text(stringResource(R.string.browser_agent_busy, steps), style = DshType.xs13, color = c.business, maxLines = 1)',
      '        } else {',
      '            Box(Modifier.size(7.dp).clip(CircleShape).background(c.success))',
      '            Text(stringResource(R.string.browser_agent_done, done), style = DshType.xs13, color = c.success, maxLines = 1)',
      '        }',
      '    }',
      '}',
      '',
      '@Composable',
      'fun BrowserPage(onClose: () -> Unit) {',
    ].join('\n'), 'bp pill')
  return s
})


// 4b) the turn is over: session.status idle ends the whole browser burst, not each single call
edit('/core/session/SessionStore.kt', (s) => {
  if (s.includes('browser-live-dot-turn')) { console.log('  SKIP SessionStore'); return s }
  s = must(s,
    'import io.github.jackwener.dsh.core.capability.CapabilityHub',
    'import io.github.jackwener.dsh.core.capability.BrowserSession\nimport io.github.jackwener.dsh.core.capability.CapabilityHub',
    'ss browser import')
  s = must(s,
    '                if (!running) onTurnFinished(sessionId)',
    '                // browser-live-dot-turn: the dot marks the whole turn that drives the browser.\n                if (!running) BrowserSession.agentTurnEnd()\n                if (!running) onTurnFinished(sessionId)',
    'ss turn end')
  return s
})

// 5) strings
const KEYS = [
  ['browser_agent_busy', 'AI 正在操作 · 第 %1$d 步', 'AI is working · step %1$d'],
  ['browser_agent_done', 'AI 操作完成 · 共 %1$d 步', 'AI finished · %1$d steps'],
]
for (const [file, idx] of [['/app/src/main/res/values/strings.xml', 1], ['/app/src/main/res/values-en/strings.xml', 2]]) {
  const p = root + file
  let s = fs.readFileSync(p, 'utf8')
  if (s.includes('name="' + KEYS[0][0] + '"')) { console.log('  SKIP ' + file); continue }
  const add = KEYS.map((k) => '    <string name="' + k[0] + '">' + k[idx] + '</string>').join('\n') + '\n'
  s = s.replace('</resources>', add + '</resources>')
  fs.writeFileSync(p, s)
  console.log('  EDIT ' + file)
}
console.log('fix74 OK')
