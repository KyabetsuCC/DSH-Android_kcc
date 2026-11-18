// 换行插在光标处（而不是永远追加到末尾）。
const fs = require('fs'), path = require('path');
const root = process.argv[2] || '.';
const P = path.join(root, 'app/src/main/java/io/github/jackwener/dsh/feature/conversation/Composer.kt');
let s = fs.readFileSync(P, 'utf8');
if (s.includes('fun insertNewline()')) { console.log('fix57 SKIP'); process.exit(0); }
let bad = 0;
const rep = (from, to, tag) => {
  if (!s.includes(from)) { console.log('MISS', tag); bad++; return; }
  s = s.replace(from, to); console.log('EDIT', tag);
};

// 1) ComposerState: add insertNewline()
rep(`    fun onEdit(v: TextFieldValue) { tv = v }`,
`    fun onEdit(v: TextFieldValue) { tv = v }

    /** Insert a line break at the caret (not at the end of the draft) and keep the caret after it. */
    fun insertNewline() {
        val t = tv.text
        val a = tv.selection.start
        val b = tv.selection.end
        tv = TextFieldValue(t.substring(0, a) + "\\n" + t.substring(b), TextRange(a + 1))
    }`, 'state-method');

// 2) plus-menu item
rep(`{ close(); state.text = state.text + "\\n" }`, `{ close(); state.insertNewline() }`, 'menu-item');

// 3) send-button long press
rep(`onNewline = { if (!running) state.text = state.text + "\\n" }`, `onNewline = { if (!running) state.insertNewline() }`, 'long-press');

if (bad) { console.log('fix57 FAILED', bad); process.exit(1); }
fs.writeFileSync(P, s);
console.log('fix57 done');
