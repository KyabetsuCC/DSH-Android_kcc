#!/usr/bin/env node
// 用法: node patch_fix43.js [repoRoot]
// 关掉全 App 的过度滚动（回弹）动画：Compose 对望远镜/拉伸效果的 CompositionLocal 置 null。
const fs = require('fs');
const root = process.argv[2] || '.';
const f = root + '/app/src/main/java/io/github/jackwener/dsh/core/designsystem/Theme.kt';
let s = fs.readFileSync(f, 'utf8');
if (s.includes('LocalOverscrollFactory')) { console.log('SKIP overscroll'); process.exit(0); }
const from = '        LocalTextSelectionColors provides TextSelectionColors(colors.business, Color(0x663B82F6)),\n    ) {';
const to = '        LocalTextSelectionColors provides TextSelectionColors(colors.business, Color(0x663B82F6)),\n        // 关掉过度滚动（拉伸回弹）动画，避免滑动到底部时整屏被拉动。\n        androidx.compose.foundation.LocalOverscrollFactory provides null,\n    ) {';
if (!s.includes(from)) { console.error('PATCH FAILED: anchor theme'); process.exit(1); }
s = s.replace(from, to);
fs.writeFileSync(f, s);
console.log('EDIT overscroll off');
