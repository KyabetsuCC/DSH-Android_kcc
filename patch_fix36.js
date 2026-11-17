// 0.0.41: token usage per day and model (usage_model, DB v6), so money keeps the price of the
// model that spent it; the chat bubbles price each turn with its own model.
const fs = require('fs');
const root = process.argv[2] || '.';
const D = '/app/src/main/java/io/github/jackwener/dsh';
let bad = 0;

function edit(rel, fn) {
  const p = root + '/' + D + rel;
  const s = fs.readFileSync(p, 'utf8');
  const out = fn(s);
  fs.writeFileSync(p, out);
}

// ---------- core/data/Database.kt
const DB = '/core/data/Database.kt';
if (fs.readFileSync(root + '/' + D + DB, 'utf8').includes('usage_model')) console.log('SKIP database');
else edit(DB, (s) => {
  const ins = fs.readFileSync(root + '/mig56.txt', 'utf8');
  const rep = (a, b) => { if (!s.includes(a)) { console.log('MISS db ' + a.slice(0, 50)); bad++; return; } s = s.replace(a, b); };
  rep('data class UsageEntity(@PrimaryKey val day: String, val inputTokens: Long, val outputTokens: Long, val cachedTokens: Long)',
      'data class UsageEntity(@PrimaryKey val day: String, val inputTokens: Long, val outputTokens: Long, val cachedTokens: Long)\n\n' +
      '@Entity(tableName = "usage_model", primaryKeys = ["day", "model"])\n' +
      'data class UsageModelEntity(val day: String, val model: String, val inputTokens: Long, val outputTokens: Long, val cachedTokens: Long)');
  rep('@Database(entities = [SessionEntity::class, EventEntity::class, RuleEntity::class, RuleRunEntity::class, UsageEntity::class], version = DB_VERSION)',
      '@Dao\ninterface UsageModelDao {\n' +
      '    @Query("SELECT * FROM usage_model")\n' +
      '    fun observe(): Flow<List<UsageModelEntity>>\n' +
      '    @Query("SELECT * FROM usage_model WHERE day = :day AND model = :model")\n' +
      '    suspend fun get(day: String, model: String): UsageModelEntity?\n' +
      '    @Upsert suspend fun upsert(u: UsageModelEntity)\n' +
      '}\n\n' +
      '@Database(entities = [SessionEntity::class, EventEntity::class, RuleEntity::class, RuleRunEntity::class, UsageEntity::class, UsageModelEntity::class], version = DB_VERSION)');
  rep('    abstract fun usage(): UsageDao', '    abstract fun usage(): UsageDao\n    abstract fun usageModel(): UsageModelDao');
  rep('const val DB_VERSION = 5', 'const val DB_VERSION = 6');
  rep('    val ALL: Array<Migration> = arrayOf(M_2_3, M_3_4, M_4_5)',
      ins + '    val ALL: Array<Migration> = arrayOf(M_2_3, M_3_4, M_4_5, M_5_6)');
  rep('    @Provides fun usage(db: DshDatabase) = db.usage()',
      '    @Provides fun usage(db: DshDatabase) = db.usage()\n    @Provides fun usageModel(db: DshDatabase) = db.usageModel()');
  console.log('EDIT database');
  return s;
});

// ---------- core/session/SessionStore.kt
const SS = '/core/session/SessionStore.kt';
if (fs.readFileSync(root + '/' + D + SS, 'utf8').includes('usageModel.upsert')) console.log('SKIP store');
else edit(SS, (s) => {
  const rep = (a, b) => { if (!s.includes(a)) { console.log('MISS store ' + a.slice(0, 50)); bad++; return; } s = s.replace(a, b); };
  rep('    private val usage: UsageDao,', '    private val usage: UsageDao,\n    private val usageModel: UsageModelDao,');
  rep('import io.github.jackwener.dsh.core.data.UsageEntity',
      'import io.github.jackwener.dsh.core.data.UsageEntity\nimport io.github.jackwener.dsh.core.data.UsageModelDao\nimport io.github.jackwener.dsh.core.data.UsageModelEntity');
  const anchor = '        usage.upsert(cur.copy(inputTokens = cur.inputTokens + u.input, outputTokens = cur.outputTokens + u.output, cachedTokens = cur.cachedTokens + u.cacheRead))';
  rep(anchor, anchor + [
    '',
    '        // The model that answered, so this day keeps its price after the user switches models.',
    '        val model = data.o("message")?.o("source")?.s("model") ?: Pricing.model ?: return',
    '        val m = usageModel.get(day, model) ?: UsageModelEntity(day, model, 0L, 0L, 0L)',
    '        usageModel.upsert(m.copy(inputTokens = m.inputTokens + u.input, outputTokens = m.outputTokens + u.output, cachedTokens = m.cachedTokens + u.cacheRead))',
  ].join('\n'));
  console.log('EDIT store');
  return s;
});

// ---------- core/session/Projection.kt
const PJ = '/core/session/Projection.kt';
if (fs.readFileSync(root + '/' + D + PJ, 'utf8').includes('var model: String? = null')) console.log('SKIP projection');
else edit(PJ, (s) => {
  const rep = (a, b) => { if (!s.includes(a)) { console.log('MISS projection ' + a.slice(0, 50)); bad++; return; } s = s.replace(a, b); };
  rep('    val todos: List<TodoItem>? = null,\n) {\n    val todoCounts',
      '    val todos: List<TodoItem>? = null,\n    /** The model that answered this turn; its tokens keep that model\'s price. */\n    val model: String? = null,\n) {\n    val todoCounts');
  rep('        var usage = Usage()', '        var usage = Usage()\n        var model: String? = null');
  rep('fun build() = Turn(key, number, user, blocks.toList(), start, end, status, error, usage, outcome, todos)',
      'fun build() = Turn(key, number, user, blocks.toList(), start, end, status, error, usage, outcome, todos, model)');
  rep('                    Usage.of(d.o("usage"))?.let { u -> t.usage += u; total += u; if (u.input > 0) context = u.input }',
      '                    Usage.of(d.o("usage"))?.let { u -> t.usage += u; total += u; if (u.input > 0) context = u.input }\n' +
      '                    d.o("message")?.o("source")?.s("model")?.let { t.model = it }');
  console.log('EDIT projection');
  return s;
});

// ---------- feature/conversation/Stream.kt
const ST = '/feature/conversation/Stream.kt';
if (fs.readFileSync(root + '/' + D + ST, 'utf8').includes('Pricing.cost(turn.usage, turn.model)')) console.log('SKIP stream');
else edit(ST, (s) => {
  if (!s.includes('Pricing.cost(turn.usage)')) { console.log('MISS stream'); bad++; return s; }
  console.log('EDIT stream');
  return s.replace('Pricing.cost(turn.usage)', 'Pricing.cost(turn.usage, turn.model)');
});

process.exit(bad ? 1 : 0);
