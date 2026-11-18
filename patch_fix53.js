// reorder: move the cost group below the drawer group (thin groups first)
const fs = require('fs');
const root = process.argv[2] || '.';
const P = root + '/app/src/main/java/io/github/jackwener/dsh/feature/settings/SettingsScreen.kt';
let src = fs.readFileSync(P, 'utf8');
const COST = '    SettingsGroupTitle(stringResource(R.string.set_cost_group))';
const DRAWER = '    SettingsGroupTitle(stringResource(R.string.set_drawer_group))';
if (src.indexOf(COST) < 0) { console.log('ANCHOR cost'); process.exit(1); }
if (src.indexOf(DRAWER) < 0) { console.log('ANCHOR drawer'); process.exit(1); }
if (src.indexOf(COST) > src.indexOf(DRAWER)) { console.log('SKIP order'); process.exit(0); }
const lines = src.split('\n');
const ci = lines.findIndex(l => l === COST);
// cost block = title + 5 lines (SettingsCard {, two SettingsRow lines, closing }, closing })
let block = lines.slice(ci, ci + 6);
if (block[5].trim() !== '}') { console.log('BAD cost block: ' + JSON.stringify(block)); process.exit(1); }
lines.splice(ci, 6);
const di = lines.findIndex(l => l === DRAWER);
let end = di + 1;
while (end < lines.length && lines[end] !== '    }') end++;
const at = end + 1;
lines.splice(at, 0, ...block);
fs.writeFileSync(P, lines.join('\n'));
const out = lines.join('\n');
const ok = out.indexOf(COST) > out.indexOf(DRAWER);
console.log(ok ? 'fix53 done' : 'fix53 FAILED');
process.exit(ok ? 0 : 1);
