// 0.1.20: browser tools answer faster — the fixed waits between steps were tuned for headless use and
// dominated the wall time of a multi-step browsing turn.
const fs = require('fs')
const root = process.argv[2] || '.'
const P = root + '/app/src/main/java/io/github/jackwener/dsh'
const p = P + '/core/capability/tools/BrowserTools.kt'
let s = fs.readFileSync(p, 'utf8')
const before = s
if (s.includes('browser-speed')) {
  console.log('  SKIP BrowserTools')
} else {
  const pairs = [
    ['        delay(600)\n        return ok', '        // browser-speed: shorter settle waits; the page fires its own load callbacks anyway.\n        delay(260)\n        return ok'],
    ['                withTimeoutOrNull(4_000) { n.done.await() }\n                delay(800)', '                withTimeoutOrNull(4_000) { n.done.await() }\n                delay(360)'],
    ['                if (submit) withTimeoutOrNull(6_000) { n.done.await() }\n                delay(700)', '                if (submit) withTimeoutOrNull(6_000) { n.done.await() }\n                delay(320)'],
    ['                })\n                delay(500)', '                })\n                delay(220)'],
  ]
  for (const [from, to] of pairs) {
    if (!s.includes(from)) { console.log('ANCHOR ' + JSON.stringify(from.slice(0, 40))); process.exit(1) }
    s = s.replace(from, to)
  }
  fs.writeFileSync(p, s)
  console.log('  EDIT BrowserTools')
}
console.log('fix75 OK')
