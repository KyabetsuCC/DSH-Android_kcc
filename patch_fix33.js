// 0.0.39: backup page strings (localised).
const fs = require('fs');
const root = process.argv[2] || '.';
const Q = String.fromCharCode(34);
const T = {
  'values/strings.xml': [
    ['backup_group', '备份'], ['backup_export', '导出备份'], ['backup_import', '从备份导入'], ['backup_notes', '说明'],
    ['backup_intro', '把会话、附件、插件包、设置与数据库打包成一个 zip；导入时自动先存一份当前的，出事能退回来。'],
    ['backup_busy_pack', '正在打包…'], ['backup_busy_restore', '正在还原…'],
    ['backup_exported', '已导出：%1$s'], ['backup_export_failed', '导出失败：%1$s'],
    ['backup_restored', '已还原：%1$s。请完全退出并重新打开 DSH 生效。'], ['backup_import_failed', '导入失败：%1$s'],
    ['backup_note_ok', '✅ 会话记录、附件图片、插件包、规则、设置项'],
    ['backup_note_db', '✅ 数据库 dsh.db（含 -wal / -shm）'],
    ['backup_note_key', '❌ API Key：由本机 Keystore 加密，换机必失效，需重新填'],
    ['backup_note_engine', '❌ 引擎与 node_modules：可重建，打进去只会让包变大'],
    ['backup_err_write', '无法写入所选位置'], ['backup_err_read', '无法读取所选文件'],
    ['backup_done_export', '共 %1$d 个文件，%2$d MB'],
    ['backup_done_import', '共 %1$d 个文件（原数据已备份到 files/import-backup）'],
  ],
  'values-en/strings.xml': [
    ['backup_group', 'Backup'], ['backup_export', 'Export backup'], ['backup_import', 'Import from backup'], ['backup_notes', 'Notes'],
    ['backup_intro', 'Packs conversations, attachments, plugin packages, settings and the database into one zip. Importing saves a copy of the current data first, so you can always roll back.'],
    ['backup_busy_pack', 'Packing…'], ['backup_busy_restore', 'Restoring…'],
    ['backup_exported', 'Exported: %1$s'], ['backup_export_failed', 'Export failed: %1$s'],
    ['backup_restored', 'Restored: %1$s. Fully quit and reopen DSH for it to take effect.'], ['backup_import_failed', 'Import failed: %1$s'],
    ['backup_note_ok', '✅ Conversations, attachment images, plugin packages, rules, settings'],
    ['backup_note_db', '✅ Database dsh.db (with -wal / -shm)'],
    ['backup_note_key', '❌ API keys: encrypted with the device Keystore, useless on another phone — re-enter them'],
    ['backup_note_engine', '❌ Engine and node_modules: rebuildable, including them only bloats the zip'],
    ['backup_err_write', 'Cannot write to the chosen location'], ['backup_err_read', 'Cannot read the chosen file'],
    ['backup_done_export', '%1$d files, %2$d MB'],
    ['backup_done_import', '%1$d files restored (previous data kept in files/import-backup)'],
  ],
  'values-ru/strings.xml': [
    ['backup_group', 'Резервная копия'], ['backup_export', 'Экспорт'], ['backup_import', 'Импорт из копии'], ['backup_notes', 'Справка'],
    ['backup_intro', 'Упаковывает диалоги, вложения, пакеты плагинов, настройки и базу в один zip. Перед импортом текущие данные сохраняются, так что можно откатиться.'],
    ['backup_busy_pack', 'Упаковка…'], ['backup_busy_restore', 'Восстановление…'],
    ['backup_exported', 'Экспортировано: %1$s'], ['backup_export_failed', 'Ошибка экспорта: %1$s'],
    ['backup_restored', 'Восстановлено: %1$s. Полностью закройте и откройте DSH.'], ['backup_import_failed', 'Ошибка импорта: %1$s'],
    ['backup_note_ok', '✅ Диалоги, изображения-вложения, пакеты плагинов, правила, настройки'],
    ['backup_note_db', '✅ База dsh.db (с -wal / -shm)'],
    ['backup_note_key', '❌ API-ключи: шифруются Keystore устройства, на другом телефоне не работают — введите заново'],
    ['backup_note_engine', '❌ Движок и node_modules: пересобираются, в архиве только увеличивают размер'],
    ['backup_err_write', 'Не удалось записать в выбранное место'], ['backup_err_read', 'Не удалось прочитать выбранный файл'],
    ['backup_done_export', 'Файлов: %1$d, %2$d МБ'],
    ['backup_done_import', 'Восстановлено файлов: %1$d (прежние данные в files/import-backup)'],
  ],
};
let bad = 0;
for (const f of Object.keys(T)) {
  const p = root + '/app/src/main/res/' + f;
  let x = fs.readFileSync(p, 'utf8');
  const add = [];
  for (const [k, val] of T[f]) {
    if (x.includes('name=' + Q + k + Q)) continue;
    const esc = val.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\\/g, '\\\\').replace(/'/g, '\\' + Q);
    add.push('    <string name=' + Q + k + Q + '>' + esc + '</string>');
  }
  if (!add.length) { console.log('SKIP ' + f); continue; }
  x = x.replace('</resources>', add.join('\n') + '\n</resources>');
  fs.writeFileSync(p, x);
  console.log('EDIT ' + f + ' +' + add.length);
}
const h = fs.readFileSync(root + '/app/src/main/res/values-en/strings.xml', 'utf8');
if (!h.includes('backup_done_import')) { console.log('CHECK FAIL'); bad++; }
process.exit(bad ? 1 : 0);
