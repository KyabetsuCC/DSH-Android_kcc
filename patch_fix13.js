const fs=require('fs'),path=require('path');
const root=process.argv[2]||'.';
const S='app/src/main/java/io/github/jackwener/dsh/feature/settings/SettingsScreen.kt';
const A=`    SettingsCard {
        SettingsRow(stringResource(R.string.set_permission)`;
const B=`    // Token usage: today at a glance, then the last 30 days as bars or as a heat map.
    SettingsCard {
        SettingsRow(stringResource(R.string.usage_title), stringResource(R.string.usage_desc), divider = false, stacked = true) {
            io.github.jackwener.dsh.feature.settings.UsageSection()
        }
    }
    SettingsCard {
        SettingsRow(stringResource(R.string.set_permission)`;
const STR={
 'app/src/main/res/values/strings.xml':['    <string name="usage_title">用量</string>\n    <string name="usage_desc">Token 用量、缓存命中率与最近 30 天趋势</string>\n'],
 'app/src/main/res/values-en/strings.xml':['    <string name="usage_title">Usage</string>\n    <string name="usage_desc">Tokens, cache hit rate and the last 30 days</string>\n'],
 'app/src/main/res/values-ru/strings.xml':['    <string name="usage_title">Расход</string>\n    <string name="usage_desc">Токены, попадания в кэш и последние 30 дней</string>\n'],
};
let bad=0;
const p=path.join(root,S);
let s=fs.readFileSync(p,'utf8');
if(!s.includes('UsageSection()')){
  if(s.split(A).length-1!==1){console.log('ANCHOR screen '+(s.split(A).length-1));bad++;}
  else { s=s.replace(A,B); fs.writeFileSync(p,s); }
}
for(const [f,[line]] of Object.entries(STR)){
  const q=path.join(root,f);
  if(!fs.existsSync(q)){console.log('MISSING '+f);bad++;continue;}
  let t=fs.readFileSync(q,'utf8');
  if(t.includes('name="usage_title"')){continue;}
  if(t.split('</resources>').length-1!==1){console.log('ANCHOR res '+f);bad++;continue;}
  t=t.replace('</resources>',line+'</resources>');
  fs.writeFileSync(q,t);
}
console.log(bad?'FAILED '+bad:'patch_fix13: all done');
process.exit(bad?1:0);
