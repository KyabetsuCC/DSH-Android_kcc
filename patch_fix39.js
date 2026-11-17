// 0.0.45: usage_model v7 (total input, not just the uncached part).
const fs = require('fs');
const root = process.argv[2] || '.';
const D = '/app/src/main/java/io/github/jackwener/dsh';
let bad = 0;

const DB = root + '/' + D + '/core/data/Database.kt';
let s = fs.readFileSync(DB, 'utf8');
if (s.includes('M_6_7')) console.log('SKIP database');
else {
  const ins = fs.readFileSync(root + '/mig67.txt', 'utf8');
  const rep = (a, b) => { if (!s.includes(a)) { console.log('MISS ' + a.slice(0, 50)); bad++; return; } s = s.replace(a, b); };
  rep('const val DB_VERSION = 6', 'const val DB_VERSION = 7');
  rep('    val ALL: Array<Migration> = arrayOf(M_2_3, M_3_4, M_4_5, M_5_6)',
      ins + '    val ALL: Array<Migration> = arrayOf(M_2_3, M_3_4, M_4_5, M_5_6, M_6_7)');
  fs.writeFileSync(DB, s);
  console.log('EDIT database');
}
process.exit(bad ? 1 : 0);
