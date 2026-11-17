// 0.0.41: usage per day AND model, so a cost keeps the price of the model that spent it.
const fs = require('fs');
const root = process.argv[2] || '.';
const Q = String.fromCharCode(34);
let bad = 0;
const D = 'app/src/main/java/io/github/jackwener/dsh';

function edit(rel, fn) {
  const p = root + '/' + D + rel;
  const out = fn(fs.readFileSync(p, 'utf8'));
  if (typeof out !== 'string') { console.log('FN RETURNED ' + typeof out + ' for ' + rel); process.exit(1); }
  fs.writeFileSync(p, out);
}

// ---------- Database.kt
const DBK = '/core/data/Database.kt';
if (fs.readFileSync(root + '/' + D + DBK, 'utf8').includes('UsageModelEntity')) console.log('SKIP database');
else edit(DBK, (s) => {
  const rep = (a, b) => { if (!s.includes(a)) { console.log('MISS db ' + a.slice(0, 50)); bad++; return; } s = s.replace(a, b); };

  rep('@Dao\ninterface SessionDao {',
    ['@Entity(tableName = ' + Q + 'usage_model' + Q + ', primaryKeys = [' + Q + 'day' + Q + ', ' + Q + 'model' + Q + '])',
     'data class UsageModelEntity(val day: String, val model: String, val inputTokens: Long, val outputTokens: Long, val cachedTokens: Long)',
     '',
     '@Dao',
     'interface SessionDao {'].join('\n'));

  rep('    @Upsert suspend fun upsert(u: UsageEntity)\n}',
    ['    @Upsert suspend fun upsert(u: UsageEntity)',
     '}',
     '',
     '@Dao',
     'interface UsageModelDao {',
     '    @Query(' + Q + 'SELECT * FROM usage_model' + Q + ')',
     '    fun observe(): Flow<List<UsageModelEntity>>',
     '    @Query(' + Q + 'SELECT * FROM usage_model WHERE day = :day AND model = :model' + Q + ')',
     '    suspend fun get(day: String, model: String): UsageModelEntity?',
     '    @Upsert suspend fun upsert(u: UsageModelEntity)',
     '}'].join('\n'));

  rep('@Database(entities = [SessionEntity::class, EventEntity::class, RuleEntity::class, RuleRunEntity::class, UsageEntity::class], version = DB_VERSION)',
      '@Database(entities = [SessionEntity::class, EventEntity::class, RuleEntity::class, RuleRunEntity::class, UsageEntity::class, UsageModelEntity::class], version = DB_VERSION)');
  rep('    abstract fun usage(): UsageDao', '    abstract fun usage(): UsageDao\n    abstract fun usageModel(): UsageModelDao');

  rep('const val DB_VERSION = 5', 'const val DB_VERSION = 6');

  rep('    val ALL: Array<Migration> = arrayOf(M_2_3, M_3_4, M_4_5)',
    ['    /** v6: token usage per day and model, so a cost row keeps the price of the model that spent it. */',
     '    val SQL_5_6 = listOf(',
     '        ' + Q + 'CREATE TABLE IF NOT EXISTS `usage_model` (`day` TEXT NOT NULL, `model` TEXT NOT NULL, ' + Q + ' +',
     '            ' + Q + '`inputTokens` INTEGER NOT NULL, `outputTokens` INTEGER NOT NULL, `cachedTokens` INTEGER NOT NULL, ' + Q + ' +',
     '            ' + Q + 'PRIMARY KEY(`day`, `model`))' + Q + ',',
     '    )',
     '',
     '    val M_5_6 = object : Migration(5, 6) {',
     '        override fun migrate(db: SupportSQLiteDatabase) {',
     '            SQL_5_6.forEach(db::execSQL)',
     '            // Backfill from the events: every assistant message records the model that answered it.',
     '            runCatching {',
     '                db.execSQL(',
     '                    ' + Q + 'INSERT OR REPLACE INTO `usage_model`(`day`, `model`, `inputTokens`, `outputTokens`, `cachedTokens`) ' + Q + ' +',
     '                        ' + Q + 'SELECT date(`time` / 1000, ' + Q + 'unixepoch' + Q + ', ' + Q + 'localtime' + Q + '), ' + Q + ' +',
     '                        ' + Q + 'COALESCE(json_extract(`json`, ' + Q + '\\$.message.source.model' + Q + '), ' + Q + '?' + Q + '), ' + Q + ' +',
     '                        ' + Q + 'SUM(CAST(json_extract(`json`, ' + Q + '\\$.usage.inputTokens' + Q + ') AS INTEGER)), ' + Q + ' +',
     '                        ' + Q + 'SUM(CAST(json_extract(`json`, ' + Q + '\\$.usage.outputTokens' + Q + ') AS INTEGER)), ' + Q + ' +',
     '                        ' + Q + 'SUM(CAST(json_extract(`json`, ' + Q + '\\$.usage.cacheReadTokens' + Q + ') AS INTEGER)) ' + Q + ' +',
     '                        ' + Q + 'FROM `events` WHERE `type` = ' + Q + 'assistant/message' + Q + ' ' + Q + ' +',
     '                        ' + Q + 'AND json_extract(`json`, ' + Q + '\\$.usage' + Q + ') IS NOT NULL GROUP BY 1, 2' + Q + ',',
     '                )',
     '            }',
     '        }',
     '    }',
     '',
     '    val ALL: Array<Migration> = arrayOf(M_2_3, M_3_4, M_4_5, M_5_6)'].join('\n'));

  rep('    @Provides fun usage(db: DshDatabase) = db.usage()',
      '    @Provides fun usage(db: DshDatabase) = db.usage()\n    @Provides fun usageModel(db: DshDatabase) = db.usageModel()');
  console.log('EDIT database');
  return s;
});

// ---------- SessionStore.kt
const SS = '/core/session/SessionStore.kt';
if (fs.readFileSync(root + '/' + D + SS, 'utf8').includes('usageModel.upsert')) console.log('SKIP store');
else edit(SS, (s) => {
  const rep = (a, b) => { if (!s.includes(a)) { console.log('MISS store ' + a.slice(0, 50)); bad++; return; } s = s.replace(a, b); };
  rep('    private val usage: UsageDao,', '    private val usage: UsageDao,\n    private val usageModel: UsageModelDao,');
  rep('import io.github.jackwener.dsh.core.data.UsageEntity',
      'import io.github.jackwener.dsh.core.data.UsageEntity\nimport io.github.jackwener.dsh.core.data.UsageModelDao\nimport io.github.jackwener.dsh.core.data.UsageModelEntity');
  rep('        usage.upsert(cur.copy(inputTokens = cur.inputTokens + u.input, outputTokens = cur.outputTokens + u.output, cachedTokens = cur.cachedTokens + u.cacheRead))',
    ['        usage.upsert(cur.copy(inputTokens = cur.inputTokens + u.input, outputTokens = cur.outputTokens + u.output, cachedTokens = cur.cachedTokens + u.cacheRead))',
     '        // Same numbers per model: a cost row keeps the price of the model that spent the tokens.',
     '        val model = data.o(' + Q + 'message' + Q + ')?.o(' + Q + 'source' + Q + ')?.s(' + Q + 'model' + Q + ') ?: Pricing.model ?: return',
     '        val m = usageModel.get(day, model) ?: UsageModelEntity(day, model, 0, 0, 0)',
     '        usageModel.upsert(m.copy(inputTokens = m.inputTokens + u.input, outputTokens = m.outputTokens + u.output, cachedTokens = m.cachedTokens + u.cacheRead))'].join('\n'));
  console.log('EDIT store');
  return s;
});

// ---------- Projection.kt
const PJ = '/core/session/Projection.kt';
if (fs.readFileSync(root + '/' + D + PJ, 'utf8').includes('val model: String? = null,')) console.log('SKIP projection');
else edit(PJ, (s) => {
  const rep = (a, b) => { if (!s.includes(a)) { console.log('MISS proj ' + a.slice(0, 50)); bad++; return; } s = s.replace(a, b); };
  rep('    /** This turn\'s own todo list (dsh\'s todos are turn-scoped); null when it wrote none. */\n    val todos: List<TodoItem>? = null,',
      '    /** This turn\'s own todo list (dsh\'s todos are turn-scoped); null when it wrote none. */\n    val todos: List<TodoItem>? = null,\n    /** The model that answered it (its own price row), null on turns logged before the engine named one. */\n    val model: String? = null,');
  rep('        var usage = Usage()', '        var usage = Usage()\n        var model: String? = null');
  rep('Turn(key, number, user, blocks.toList(), start, end, status, error, usage, outcome, todos)',
      'Turn(key, number, user, blocks.toList(), start, end, status, error, usage, outcome, todos, model)');
  rep('                    Usage.of(d.o(' + Q + 'usage' + Q + '))?.let { u -> t.usage += u; total += u; if (u.input > 0) context = u.input }',
      '                    d.o(' + Q + 'message' + Q + ')?.o(' + Q + 'source' + Q + ')?.s(' + Q + 'model' + Q + ')?.let { t.model = it }\n                    Usage.of(d.o(' + Q + 'usage' + Q + '))?.let { u -> t.usage += u; total += u; if (u.input > 0) context = u.input }');
  console.log('EDIT projection');
  return s;
});

// ---------- Stream.kt: price the turn with its own model
const ST = '/feature/conversation/Stream.kt';
if (fs.readFileSync(root + '/' + D + ST, 'utf8').includes('turn.model')) console.log('SKIP stream');
else edit(ST, (s) => {
  const a = 'Pricing.cost(turn.usage)';
  if (!s.includes(a)) { console.log('MISS stream'); bad++; }
  else { s = s.replace(a, 'Pricing.cost(turn.usage, turn.model)'); console.log('EDIT stream'); }
  return s;
});

process.exit(bad ? 1 : 0);
