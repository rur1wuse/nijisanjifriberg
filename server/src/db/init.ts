import { ensureSchema } from './schema';
import { normalizeStoredCollabGroups, seedPlayersIfEmpty } from './seedPlayers';

export { seedPlayersIfEmpty };

export async function initDb(): Promise<void> {
  await ensureSchema();
  const seeded = await seedPlayersIfEmpty();
  if (seeded) console.log(`[seed] 已导入 ${seeded} 名选手`);
  const cleaned = await normalizeStoredCollabGroups();
  if (cleaned) console.log(`[seed] 已清理 ${cleaned} 名选手组合名的脚注序号`);
}
