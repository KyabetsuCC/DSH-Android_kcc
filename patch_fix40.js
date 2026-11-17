// 0.0.46: stop only the current session (engine `session/cancel`).
const fs = require('fs');
const root = process.argv[2] || '.';
const SS = root + '/app/src/main/java/io/github/jackwener/dsh/core/session/SessionStore.kt';
const CVM = root + '/app/src/main/java/io/github/jackwener/dsh/feature/conversation/ConversationViewModel.kt';
let bad = 0;

let s = fs.readFileSync(SS, 'utf8');
if (s.includes('fun stop(sessionId: String)')) console.log('SKIP store');
else {
  const old = '    /** Stops every run (the SDK has no per-session cancel, so this stops the engine process). */\n'
    + '    suspend fun stop() = stopEngine()';
  if (!s.includes(old)) { console.log('ANCHOR store'); bad++; }
  else {
    s = s.replace(old, [
      '    /**',
      '     * Cancels one running turn. The engine has a per-session cancel (`session/cancel`, service',
      '     * sessionController), so the process and every other session keep running.',
      '     */',
      '    suspend fun stop(sessionId: String) {',
      '        val sdk = engine.sdkIfReady()',
      '        if (sdk == null) { stopEngine(); return }',
      '        runCatching { sdk.request("session/cancel", buildJsonObject { put("sessionId", sessionId) }) }',
      '        dao.setRunning(sessionId, false)',
      '        autoContinued.remove(sessionId)',
      '        appendLocal(sessionId, "app/stopped", JsonObject(emptyMap()))',
      '        mutate(sessionId) { it.idle() }',
      '    }',
    ].join('\n'));
    fs.writeFileSync(SS, s);
    console.log('EDIT store');
  }
}

let v = fs.readFileSync(CVM, 'utf8');
const before = 'fun stop() = viewModelScope.launch { store.stop() }';
if (!v.includes(before)) console.log('SKIP viewmodel');
else { v = v.replace(before, 'fun stop() = viewModelScope.launch { store.stop(id) }'); fs.writeFileSync(CVM, v); console.log('EDIT viewmodel'); }

process.exit(bad ? 1 : 0);
