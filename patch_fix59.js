// 用法: node patch_fix59.js [repoRoot]
// 把自加的 5 个设置组（输入/侧栏/费用/外观/阅读）合并成一张卡，薄的行在前、厚的行在后。
const fs = require('fs'), path = require('path');
const root = process.argv[2] || '.';
const Q = String.fromCharCode(34);
let bad = 0;
function rd(f) { return fs.readFileSync(path.join(root, f), 'utf8'); }
function wr(f, s) { fs.writeFileSync(path.join(root, f), s); }

const SCREEN = 'app/src/main/java/io/github/jackwener/dsh/feature/settings/SettingsScreen.kt';
let sc = rd(SCREEN);
if (sc.includes('set_ui_group')) { console.log('SKIP settings merge'); }
else {
  const start = '    SettingsGroupTitle(stringResource(R.string.set_input_group))';
  const end = '    SettingsGroupTitle(stringResource(R.string.set_entry_points))';
  const i = sc.indexOf(start), j = sc.indexOf(end);
  if (i < 0 || j < 0 || j <= i) { console.log('ANCHOR settings merge ' + i + ' ' + j); bad++; }
  else {
    const block = [
      '    SettingsGroupTitle(stringResource(R.string.set_ui_group))',
      '    SettingsCard {',
      '        SettingsRow(stringResource(R.string.enter_to_send), stringResource(R.string.enter_to_send_desc), divider = true,',
      '            trailing = { DSwitch(s.enterToSend, { on -> vm.setEnterToSend(on) }) })',
      '        SettingsRow(stringResource(R.string.set_drawer_compact), stringResource(R.string.set_drawer_compact_desc), divider = true,',
      '            trailing = { DSwitch(s.compactDrawer, { on -> vm.setCompactDrawer(on) }) })',
      '        SettingsRow(stringResource(R.string.set_immersive), stringResource(R.string.set_immersive_desc), divider = true,',
      '            trailing = { DSwitch(s.immersive, { on -> vm.setImmersive(on) }) })',
      '        SettingsRow(stringResource(R.string.set_cost_currency), stringResource(R.string.set_cost_currency_desc), divider = true, stacked = true) {',
      '            Segmented(listOf("\$ USD", "¥ CNY"), if (s.currency == "CNY") 1 else 0, { k -> vm.setCurrency(if (k == 1) "CNY" else "USD") })',
      '        }',
      '        SettingsRow(stringResource(R.string.set_font_size), stringResource(R.string.set_font_size_desc), divider = true, stacked = true) {',
      '            Segmented(listOf(',
      '                stringResource(R.string.set_font_small),',
      '                stringResource(R.string.set_font_normal),',
      '                stringResource(R.string.set_font_large),',
      '                stringResource(R.string.set_font_xl),',
      '            ), s.fontScale, { k -> vm.setFontScale(k) }, compact = true)',
      '        }',
      '        SettingsRow(stringResource(R.string.set_chat_width), stringResource(R.string.set_chat_width_desc), divider = false, stacked = true) {',
      '            Segmented(listOf(',
      '                stringResource(R.string.set_width_narrow),',
      '                stringResource(R.string.set_width_normal),',
      '                stringResource(R.string.set_width_wide),',
      '            ), s.chatPadding, { k -> vm.setChatPadding(k) }, compact = true)',
      '        }',
      '    }',
      '',
    ].join('\n');
    sc = sc.slice(0, i) + block + sc.slice(j);
    wr(SCREEN, sc);
    console.log('EDIT settings merge');
  }
}

// ---- 文案 ----
const STR = [
  ['app/src/main/res/values/strings.xml', '界面'],
  ['app/src/main/res/values-en/strings.xml', 'Interface'],
  ['app/src/main/res/values-ru/strings.xml', 'Интерфейс'],
];
STR.forEach(function (pair) {
  const f = pair[0];
  let s = rd(f);
  if (s.includes('name=' + Q + 'set_ui_group' + Q)) { console.log('SKIP ' + f); return; }
  const add = '    <string name=' + Q + 'set_ui_group' + Q + '>' + pair[1] + '</string>\n';
  if (!s.includes('</resources>')) { console.log('ANCHOR resources ' + f); bad++; return; }
  s = s.replace('</resources>', add + '</resources>');
  wr(f, s);
});

console.log(bad === 0 ? 'fix59 OK' : ('fix59 BAD ' + bad));
process.exit(bad === 0 ? 0 : 1);
