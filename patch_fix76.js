// 0.1.21: stable element references in the agent browser.
//  - read keeps the data-dsh-id it already gave an element, so ids survive re-reads and scrolling
//    (they only restart after a navigation, which loads a fresh document)
//  - click/type accept match="visible text" as a fallback when an id went stale
//  - click reports when an overlay covered the element, instead of silently doing nothing
const fs = require('fs')
const root = process.argv[2] || '.'
const P = root + '/app/src/main/java/io/github/jackwener/dsh/core/capability/tools/BrowserTools.kt'
let s = fs.readFileSync(P, 'utf8')
const before = s

if (s.includes('browser-stable-ref')) {
  console.log('  SKIP BrowserTools')
  console.log('fix76 OK')
  process.exit(0)
}

// ---- 1) READ_JS: reuse existing ids, never renumber an element that already has one -------------
const oldRead = /        val READ_JS = """[\s\S]*?""".trimIndent\(\)/
if (!oldRead.test(s)) { console.log('ANCHOR READ_JS'); process.exit(1) }
const newRead = [
  '        val READ_JS = """',
  '(()=>{const out=[];',
  '// browser-stable-ref: an element keeps the id it was given, so ids survive re-reads and scrolling.',
  'const sel=\'a[href],button,input:not([type=hidden]),textarea,select,[role=button],[role=link],[onclick],[contenteditable=true]\';',
  'const els=[...document.querySelectorAll(sel)];',
  'let next=0;',
  'els.forEach(e=>{const v=e.getAttribute(\'data-dsh-id\');if(v!==null){const k=parseInt(v,10);if(!isNaN(k)&&k>=next)next=k+1;}});',
  'els.forEach(e=>{const r=e.getBoundingClientRect();if(r.width<2||r.height<2)return;',
  ' if(e.getAttribute(\'data-dsh-id\')===null)e.setAttribute(\'data-dsh-id\',next++);',
  ' const id=e.getAttribute(\'data-dsh-id\');',
  ' const t=(e.innerText||e.value||e.placeholder||e.getAttribute(\'aria-label\')||e.title||e.alt||\'\').trim().replace(/\\s+/g,\' \').slice(0,80);',
  ' out.push(\'[\'+id+\'] \'+e.tagName.toLowerCase()+(e.type?\':\'+e.type:\'\')+\' "\'+t+\'"\'+(e.href?\' → \'+e.href.slice(0,120):\'\'));});',
  'const text=(document.body?document.body.innerText:\'\').replace(/\\n{3,}/g,\'\\n\\n\').slice(0,6000);',
  'return \'URL: \'+location.href+\'\\nTitle: \'+document.title+\'\\n\\n\'+text+\'\\n\\n--- interactive ---\\n\'+out.slice(0,150).join(\'\\n\');})()',
  '""".trimIndent()',
].join('\n')
s = s.replace(oldRead, newRead)

// ---- 2) browser_click / browser_type: id or match=, plus overlay detection ----------------------
const startMark = '        object : Tool("browser_click"'
const endMark = '        object : Tool("browser_scroll"'
const a = s.indexOf(startMark)
const b = s.indexOf(endMark)
if (a < 0 || b < 0 || b <= a) { console.log('ANCHOR tools'); process.exit(1) }

const tools = [
  '        object : Tool("browser_click", ToolGroup.Browser, Risk.write, false,',
  '            "Click an element by its [id] from browser_read; match= clicks the element whose visible text matches instead, which is what to use when the page changed after the read.", {',
  '                int("id", "Element id from browser_read")',
  '                string("match", "Visible text of the element (fallback when the id is stale)")',
  '            }) {',
  '            override suspend fun invoke(args: JsonObject, call: CallContext): ToolResult {',
  '                val id = args.int("id")',
  '                val match = args.str("match")?.trim().orEmpty()',
  '                if (id == null && match.isEmpty()) throw InvalidArgsException("id or match")',
  '                val want = Json.encodeToString(JsonPrimitive.serializer(), JsonPrimitive(match))',
  '                val n = newNav()',
  '                val r = js("""(()=>{const id=${if (id != null) id.toString() else "null"};const want=$want;',
  '                    let e=null;',
  '                    if(id!==null)e=document.querySelector(\'[data-dsh-id="\'+id+\'"]\');',
  '                    if(!e&&want){const sel=\'a[href],button,input,textarea,select,[role=button],[role=link],[onclick],[contenteditable=true]\';',
  '                      const list=[...document.querySelectorAll(sel)];',
  '                      const txt=x=>(x.innerText||x.value||x.getAttribute(\'aria-label\')||x.title||\'\').trim().replace(/\\s+/g,\' \');',
  '                      e=list.find(x=>txt(x)===want)||list.find(x=>txt(x).toLowerCase().includes(want.toLowerCase()));}',
  '                    if(!e)return \'missing\';',
  '                    e.scrollIntoView({block:\'center\'});',
  '                    const q=e.getBoundingClientRect();',
  '                    const top=document.elementFromPoint(q.left+q.width/2,q.top+q.height/2);',
  '                    const covered=top&&top!==e&&!e.contains(top)&&!top.contains(e);',
  '                    e.click();',
  '                    return covered?\'covered\':\'ok\'})()""")',
  '                val what = id?.toString() ?: "\\"$match\\""',
  '                if (r == "missing") throw InvalidArgsException("No element $what; call browser_read")',
  '                withTimeoutOrNull(4_000) { n.done.await() }',
  '                delay(360)',
  '                val note = if (r == "covered")',
  '                    "(something was covering that element, so the click may have been swallowed; read the page and close the overlay first)\\n"',
  '                else ""',
  '                return ToolResult.text(note + "Clicked $what.\\n" + read())',
  '            }',
  '        },',
  '        object : Tool("browser_type", ToolGroup.Browser, Risk.write, false,',
  '            "Type into an input by [id] (or match= its placeholder/label). submit=true presses Enter / submits the form.", {',
  '                int("id", "Element id from browser_read")',
  '                string("match", "Placeholder or label of the field (fallback when the id is stale)")',
  '                string("text", "Text", required = true)',
  '                bool("submit", "Press Enter / submit the form afterwards")',
  '            }) {',
  '            override suspend fun invoke(args: JsonObject, call: CallContext): ToolResult {',
  '                val id = args.int("id")',
  '                val match = args.str("match")?.trim().orEmpty()',
  '                if (id == null && match.isEmpty()) throw InvalidArgsException("id or match")',
  '                val text = Json.encodeToString(JsonPrimitive.serializer(), JsonPrimitive(args.reqStr("text")))',
  '                val want = Json.encodeToString(JsonPrimitive.serializer(), JsonPrimitive(match))',
  '                val submit = args.bool("submit") == true',
  '                val n = newNav()',
  '                val r = js("""(()=>{const id=${if (id != null) id.toString() else "null"};const want=$want;',
  '                    let e=null;',
  '                    if(id!==null)e=document.querySelector(\'[data-dsh-id="\'+id+\'"]\');',
  '                    if(!e&&want){const sel=\'input:not([type=hidden]),textarea,[contenteditable=true]\';',
  '                      const list=[...document.querySelectorAll(sel)];',
  '                      const txt=x=>(x.placeholder||x.getAttribute(\'aria-label\')||x.title||\'\').trim();',
  '                      e=list.find(x=>txt(x)===want)||list.find(x=>txt(x).toLowerCase().includes(want.toLowerCase()));}',
  '                    if(!e)return \'missing\';',
  '                    e.scrollIntoView({block:\'center\'});e.focus();',
  '                    if(e.isContentEditable){document.execCommand(\'selectAll\',false,null);document.execCommand(\'insertText\',false,$text);}',
  '                    else if(!(\'value\' in e))return \'not_editable\';',
  '                    else{const d=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(e),\'value\');d&&d.set?d.set.call(e,$text):(e.value=$text);',
  '                    e.dispatchEvent(new Event(\'input\',{bubbles:true}));e.dispatchEvent(new Event(\'change\',{bubbles:true}));}',
  '                    if($submit){e.dispatchEvent(new KeyboardEvent(\'keydown\',{key:\'Enter\',keyCode:13,bubbles:true}));if(e.form)e.form.requestSubmit?e.form.requestSubmit():e.form.submit();}',
  '                    return \'ok\'})()""")',
  '                val what = id?.toString() ?: "\\"$match\\""',
  '                if (r == "missing") throw InvalidArgsException("No element $what; call browser_read")',
  '                if (r == "not_editable") throw InvalidArgsException("Element $what is not a text field; pick an input/textarea from browser_read")',
  '                if (r != "ok") return ToolResult.error("failed", "Typing failed in the page: $r")',
  '                if (submit) withTimeoutOrNull(6_000) { n.done.await() }',
  '                delay(320)',
  '                return ToolResult.text("Typed into $what.\\n" + read())',
  '            }',
  '        },',
  '',
].join('\n')
s = s.slice(0, a) + tools + s.slice(b)

// ---- 3) browser_read description: say the ids are stable now -----------------------------------
s = s.replace(
  'object : Tool("browser_read", ToolGroup.Browser, Risk.read, false, "Re-read the current page (text + interactive elements).", {',
  'object : Tool("browser_read", ToolGroup.Browser, Risk.read, false, "Re-read the current page (text + interactive elements). Element ids stay the same across reads until the page navigates.", {'
)

fs.writeFileSync(P, s)
const open = (s.match(/\{/g) || []).length
const close = (s.match(/\}/g) || []).length
console.log('  EDIT BrowserTools  braces ' + open + '/' + close + '  bytes ' + s.length)
console.log('fix76 OK')
