// 改包名做共存版：node patch_id.js <NEW_ID> [APP_NAME]
const fs = require('fs');
const NEW_ID = process.argv[2];
const APP_NAME = process.argv[3] || 'DSH';
const OLD_ID = 'io.github.jackwener.dsh';
if (!NEW_ID || NEW_ID === OLD_ID) { console.log('skip: same id'); process.exit(0); }

const files = {
  gradle: 'app/build.gradle.kts',
  manifest: 'app/src/main/AndroidManifest.xml',
  quick: 'app/src/main/java/io/github/jackwener/dsh/feature/quick/QuickActivity.kt',
  strings: 'app/src/main/res/values/strings.xml',
};

// 1. applicationId
let g = fs.readFileSync(files.gradle, 'utf8');
const g0 = g;
g = g.replace(/applicationId\s*=\s*"io\.github\.jackwener\.dsh"/, 'applicationId = "' + NEW_ID + '"');
if (g === g0 && !g.includes('applicationId = "' + NEW_ID + '"')) {
  console.error('FAIL: applicationId not patched'); process.exit(1);
}
fs.writeFileSync(files.gradle, g);
console.log('applicationId ->', NEW_ID);

// 2. manifest: taskAffinity + RUN_TASK action
let m = fs.readFileSync(files.manifest, 'utf8');
const m0 = m;
m = m.split(OLD_ID + '.quick').join(NEW_ID + '.quick');
m = m.split(OLD_ID + '.RUN_TASK').join(NEW_ID + '.RUN_TASK');
if (m === m0 && !m.includes(NEW_ID + '.quick')) {
  console.error('FAIL: manifest not patched'); process.exit(1);
}
fs.writeFileSync(files.manifest, m);
console.log('manifest taskAffinity/RUN_TASK ->', NEW_ID);

// 3. QuickActivity const
let q = fs.readFileSync(files.quick, 'utf8');
const q0 = q;
q = q.split('"' + OLD_ID + '.RUN_TASK"').join('"' + NEW_ID + '.RUN_TASK"');
if (q === q0 && !q.includes('"' + NEW_ID + '.RUN_TASK"')) {
  console.error('FAIL: QuickActivity const not patched'); process.exit(1);
}
fs.writeFileSync(files.quick, q);
console.log('ACTION_RUN_TASK ->', NEW_ID + '.RUN_TASK');

// 4. app_name（桌面显示名；原本就叫 DSH 时允许无变化）
let s = fs.readFileSync(files.strings, 'utf8');
if (s.includes('<string name="app_name">' + APP_NAME + '</string>')) {
  console.log('app_name already', APP_NAME);
} else {
  const s0 = s;
  s = s.replace(/<string name="app_name">[^<]*<\/string>/, '<string name="app_name">' + APP_NAME + '</string>');
  if (s === s0) { console.error('FAIL: app_name not patched'); process.exit(1); }
  fs.writeFileSync(files.strings, s);
  console.log('app_name ->', APP_NAME);
}

// 5. 自检
const checks = [
  [files.gradle, 'applicationId = "' + NEW_ID + '"'],
  [files.manifest, NEW_ID + '.quick'],
  [files.manifest, NEW_ID + '.RUN_TASK'],
  [files.quick, '"' + NEW_ID + '.RUN_TASK"'],
  [files.strings, '>' + APP_NAME + '</string>'],
];
for (const [f, needle] of checks) {
  if (!fs.readFileSync(f, 'utf8').includes(needle)) {
    console.error('CHECK FAIL', f, needle); process.exit(1);
  }
}
console.log('all checks passed');
