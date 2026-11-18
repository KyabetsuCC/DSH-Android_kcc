// 用法: node patch_fix60.js [repoRoot]
// 「界面」卡重排：有开关的行在上面，纯选项的行在下面；字号与宽度并成一横排。
const fs = require('fs'), path = require('path');
const root = process.argv[2] || '.';
let bad = 0;
function rd(f) { return fs.readFileSync(path.join(root, f), 'utf8'); }
function wr(f, s) { fs.writeFileSync(path.join(root, f), s); }

const SCREEN = 'app/src/main/java/io/github/jackwener/dsh/feature/settings/SettingsScreen.kt';
let sc = rd(SCREEN);
if (sc.includes('// ui-card-paired')) { console.log('SKIP settings layout'); }
else {
  const start = '    SettingsGroupTitle(stringResource(R.string.set_ui_group))';
  const end = '    SettingsGroupTitle(stringResource(R.string.set_entry_points))';
  const i = sc.indexOf(start), j = sc.indexOf(end);
  if (i < 0 || j < 0 || j <= i) { console.log('ANCHOR settings layout'); bad++; }
  else {
    const block = [
      '    SettingsGroupTitle(stringResource(R.string.set_ui_group))',
      '    SettingsCard {',
      '        // ui-card-paired',
      '        SettingsRow(stringResource(R.string.enter_to_send), stringResource(R.string.enter_to_send_desc), divider = true,',
      '            trailing = { DSwitch(s.enterToSend, { on -> vm.setEnterToSend(on) }) })',
      '        SettingsRow(stringResource(R.string.set_drawer_compact), stringResource(R.string.set_drawer_compact_desc), divider = true,',
      '            trailing = { DSwitch(s.compactDrawer, { on -> vm.setCompactDrawer(on) }) })',
      '        SettingsRow(stringResource(R.string.set_immersive), stringResource(R.string.set_immersive_desc), divider = true,',
      '            trailing = { DSwitch(s.immersive, { on -> vm.setImmersive(on) }) })',
      '        SettingsRow(stringResource(R.string.set_cost_currency), stringResource(R.string.set_cost_currency_desc), divider = true, stacked = true) {',
      '            Segmented(listOf("$ USD", "¥ CNY"), if (s.currency == "CNY") 1 else 0, { k -> vm.setCurrency(if (k == 1) "CNY" else "USD") })',
      '        }',
      '        Row(',
      '            Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),',
      '            horizontalArrangement = Arrangement.spacedBy(12.dp),',
      '        ) {',
      '            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {',
      '                Text(stringResource(R.string.set_font_size), style = DshType.s14, color = Dsh.colors.labelPrimary)',
      '                Segmented(listOf(',
      '                    stringResource(R.string.set_font_small),',
      '                    stringResource(R.string.set_font_normal),',
      '                    stringResource(R.string.set_font_large),',
      '                    stringResource(R.string.set_font_xl),',
      '                ), s.fontScale, { k -> vm.setFontScale(k) }, compact = true)',
      '            }',
      '            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {',
      '                Text(stringResource(R.string.set_chat_width), style = DshType.s14, color = Dsh.colors.labelPrimary)',
      '                Segmented(listOf(',
      '                    stringResource(R.string.set_width_narrow),',
      '                    stringResource(R.string.set_width_normal),',
      '                    stringResource(R.string.set_width_wide),',
      '                ), s.chatPadding, { k -> vm.setChatPadding(k) }, compact = true)',
      '            }',
      '        }',
      '    }',
      '',
    ].join('\n');
    sc = sc.slice(0, i) + block + sc.slice(j);
    if (!sc.includes('import androidx.compose.foundation.layout.padding\n')) {
      sc = sc.replace('import androidx.compose.foundation.layout.imePadding\n',
        'import androidx.compose.foundation.layout.imePadding\nimport androidx.compose.foundation.layout.padding\n');
    }
    wr(SCREEN, sc);
    console.log('EDIT settings layout');
  }
}
console.log(bad === 0 ? 'fix60 OK' : ('fix60 BAD ' + bad));
process.exit(bad === 0 ? 0 : 1);
