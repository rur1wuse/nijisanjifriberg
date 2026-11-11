import { db } from './knex';
import { ensureSchema } from './schema';
import {
  backfillEmptySeedPlayerAttributes,
  insertMissingSeedPlayers,
  normalizeStoredCollabGroups,
} from './seedPlayers';

// 手动执行:补充种子数据中数据库尚不存在的选手(按昵称去重)
async function run() {
  await ensureSchema();
  const inserted = await insertMissingSeedPlayers();
  const backfilled = await backfillEmptySeedPlayerAttributes();
  const cleaned = await normalizeStoredCollabGroups();
  console.log(
    `[seed] 新增 ${inserted} 名选手,回填 ${backfilled} 条空白属性,清理 ${cleaned} 名选手组合名脚注序号`
  );
  await db.destroy();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
