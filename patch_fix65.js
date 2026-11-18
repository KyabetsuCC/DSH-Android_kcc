// 用法: node patch_fix65.js [repoRoot]
// 代码块右上角的复制键太小不好按：放大到 34dp 并加一层底色，整块可点。
const fs = require('fs'), path = require('path');
const root = process.argv[2] || '.';
let bad = 0;
const F = 'app/src/main/java/io/github/jackwener/dsh/core/designsystem/Content.kt';
const full = path.join(root, F);
let s = fs.readFileSync(full, 'utf8');
if (s.includes('codeCopyHit')) console.log('SKIP code copy size');
else {
  const a = '            Box(Modifier.align(Alignment.TopEnd).padding(2.dp)) {\n' +
    '                IconBtn(R.drawable.dsw_copy_outline, { copyText(ctx, model.content) }, size = 26.dp, iconSize = 12.dp,\n' +
    '                    tint = Dsh.colors.labelTertiary, contentDescription = stringResource(R.string.copy))\n' +
    '            }';
  const b = '            // codeCopyHit: 大一点的触摸目标，底色让它在深色代码块上也看得见。\n' +
    '            Box(Modifier.align(Alignment.TopEnd).padding(4.dp).clip(Radius.sm).background(Dsh.colors.bgLayer3)) {\n' +
    '                IconBtn(R.drawable.dsw_copy_outline, { copyText(ctx, model.content) }, size = 34.dp, iconSize = 16.dp,\n' +
    '                    tint = Dsh.colors.labelSecondary, contentDescription = stringResource(R.string.copy))\n' +
    '            }';
  if (!s.includes(a)) { console.log('ANCHOR code copy button'); bad++; }
  else s = s.replace(a, b);
  fs.writeFileSync(full, s);
  console.log('EDIT code copy size');
}
console.log(bad === 0 ? 'fix65 OK' : ('fix65 BAD ' + bad));
process.exit(bad === 0 ? 0 : 1);
