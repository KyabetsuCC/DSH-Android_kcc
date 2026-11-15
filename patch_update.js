#!/usr/bin/env node
// 用法: node patch_update.js <UpdateManifest.kt> <app/build.gradle.kts> <owner/repo> <versionCode>
// 把 App 内检查更新指向自己的仓库 + 递增 versionCode（更新器比较 versionCode 才会提示升级）
const fs = require('fs');
const [mf, gradle, repo, vc] = process.argv.slice(2);
const die = (m) => { console.error('PATCH FAILED: ' + m); process.exit(1); };
if (!repo || !/^[^/\s]+\/[^/\s]+$/.test(repo)) die('bad repo: ' + repo);
if (!vc || !/^\d+$/.test(vc)) die('bad versionCode: ' + vc);
if (!mf || !fs.existsSync(mf)) die('missing UpdateManifest.kt');
let s = fs.readFileSync(mf, 'utf8');
const OFFICIAL = 'private const val REPO = "jackwener/DSH-Android"';
if (!s.includes(OFFICIAL)) {
  if (s.includes('private const val REPO = "' + repo + '"')) {
    console.log('REPO already ' + repo + ' (skip)');
  } else die('REPO const not found');
} else {
  s = s.split(OFFICIAL).join('private const val REPO = "' + repo + '"');
  fs.writeFileSync(mf, s);
  console.log('REPO -> ' + repo);
}
if (!gradle || !fs.existsSync(gradle)) die('missing build.gradle.kts');
let g = fs.readFileSync(gradle, 'utf8');
const VCLINE = 'versionCode = 29';
if (!g.includes(VCLINE)) {
  if (g.includes('versionCode = ' + vc)) {
    console.log('versionCode already ' + vc + ' (skip)');
  } else die('versionCode line not found');
} else {
  g = g.split(VCLINE).join('versionCode = ' + vc);
  fs.writeFileSync(gradle, g);
  console.log('versionCode -> ' + vc);
}
console.log('all checks passed');
