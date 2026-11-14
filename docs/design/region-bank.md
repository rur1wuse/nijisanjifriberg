# 题库分部多选（JP / KR / ID）设计文档

状态：已实现（2026-11-14，提交见仓库历史；单人活动对局按题库分 key、排行榜不拆、`match_records.region_bank` 已加、管理端有分部列、日常挑战保持完整题库）。
范围：单人游戏 + 多人「创建房间」；多人随机匹配不改（仍为完整题库）。
术语：`ID` 指 NIJISANJI Indonesia 分部，不是「账号 ID」。

---

## 1. 需求

1. 单人游戏开始前、多人建房时可多选题库：`JP` / `KR` / `ID`。
2. 选中后，本局要猜的目标主播只从选中分部的成员里抽取。
3. 至少选一个；三个全选等价于当前行为（完整题库）。
4. 多人随机匹配保持完整题库，不提供题库选项。
5. 日常挑战（daily challenge）本次不改，仍为完整题库。
6. 分部归属已按 wikiwiki 官方名单确定（155 JP / 6 ID / 11 KR），见 §2.4；个案调整另行说明。

---

## 2. 现状（读代码得到的事实）

### 2.1 没有分部字段

`players` 表字段为：`nickname / name_zh / gender / debut_date / height_cm / age_text / race / collab_groups / difficulties / is_enabled`。
种子 `server/src/db/seeds/players.json` 共 172 条，字段同上，**没有任何分部/区域字段**，也没有可从姓名稳定推导的规则（KR/ID 成员在种子中使用日文/汉字写法，如 `イ・ロハ`、`ヤン・ナリ`）。

### 2.2 现在的「题库」= 难度

- `server/src/difficulties.ts` / `client/src/config/difficulties.ts`：目前只有 `normal` 一档。
- 选手与难度是多对多：`player_difficulties` 表；`playerCache.ts` 启动/失效时构建 `playersByDifficulty`。
- 抽目标：`pickCachedTarget(mode, excludedIds)` 从难度池随机；`pickTargetAvoidingRecent({ mode, identities, hardExcludedIds })` 在此之上叠加「同一身份 1 小时内最近抽过的目标尽量避开」（`server/src/services/targetSelection.ts`）。
- 因此「题库多选」是**新增一个正交维度**，不是新增难度：候选池 = 难度池 ∩ 选中分部集合。

### 2.3 三条会用到的调用链

| 场景 | 入口 | 目标抽取 | 活动状态 key |
| --- | --- | --- | --- |
| 单人 | `POST /api/game/start` body `{ mode }`（`routes/game.ts:114-163`） | `pickTargetAvoidingRecent({ mode, identities })` | `single:active:{identity}:{mode}`（`singleGameStore.ts:34`） |
| 多人建房 | socket `room:create`，payload 含 `dbType`（`socket/schemas.ts`、`handlers/room.ts`） | 每局开始时 `startRound` 用 `room.dbType`（`socket/roundLifecycle.ts:31`） | Redis 中的 `StoredRoom` |
| 随机匹配 | socket `match:start` → 建房（`handlers/matchmaking.ts`） | 同上，仍用房间的 `dbType` | 同上 |

前端：

- 单人：`pages/SingleLobby.tsx` 选难度 → `navigate('/single/{mode}')`；`pages/SingleGame.tsx` 读 `:mode` 并 `POST /game/start { mode }`；难度持久化在 `store/singleDifficulty.ts`（localStorage）。
- 多人：`pages/MultiLobby.tsx` 建房卡片 + 「更多设置」弹窗；选项写进 `store/multiLobbyPreferences.ts`（偏好 + 命名预设）；房间设置通过 `socket/roomView.ts` 下发给 `pages/MultiRoom.tsx` 展示。

### 2.4 种子里的 KR / ID 成员（已按 wikiwiki 官方名单核对完毕）

来源：<https://wikiwiki.jp/nijisanji/公式ライバー> 的 `NIJISANJI ID出身`（`#nijisanji_id`）与 `NIJISANJI KR出身`（`#nijisanji_kr`）两节，只取「#### メンバー」下的在籍成员（不含「#### 元メンバー」）。
页面自报：全 172 名 = 日本出道 155 + ID 出身 6 + KR 出身 11；与我方种子的 172 条**逐条匹配后数量与名单完全一致**（17 条命中，0 条缺失，其余 155 条记为 JP）。

| 分部 | 种子昵称 | name_zh | 出道日 |
| --- | --- | --- | --- |
| ID | Hana Macchia | Hana Macchia | 2019-09-13 |
| ID | Rai Galilei | Rai Galilei | 2019-12-18 |
| ID | Layla Alstroemeria | Layla Alstroemeria | 2020-03-13 |
| ID | Etna Crimson | Etna Crimson | 2020-08-07 |
| ID | Nagisa Arcinia | Nagisa Arcinia | 2020-11-11 |
| ID | Derem Kado | Derem Kado | 2020-11-11 |
| KR | ミン・スゥーハ | Min Suha | 2020-01-23 |
| KR | ガオン | Gaon | 2020-01-25 |
| KR | ソ・ナギ | So Nagi | 2020-05-22 |
| KR | 明楽レイ | Akira Ray | 2020-07-31 |
| KR | イ・ロハ | Lee Roha | 2020-07-31 |
| KR | ヤン・ナリ | Yang Nari | 2020-10-09 |
| KR | リュ・ハリ | Ryu Hari | 2020-10-09 |
| KR | オ・ジユ | Oh Jiyu | 2020-10-09 |
| KR | セフィナ | Seffyna | 2021-04-30 |
| KR | ハ・ユン | Ha Yun | 2021-08-25 |
| KR | ナ・セラ | Na Sera | 2021-08-25 |

完整 172 条映射（含 `jp` 的 155 条）见 `docs/design/region-classification.json`，可直接作为种子 `region` 字段的来源。README 里「172 名 JP 成员」的表述与数据不符，需要一并修正。


---

## 3. 方案

### 3.1 数据模型

- `players` 新增列 `region`：`varchar(2)`，取值 `jp | kr | id`，NOT NULL，默认 `'jp'`。
  - 迁移用默认值兜底（存量行先落 `jp`），随后由分类回填脚本按名单修正。
  - 一人一个分部。跨分部/转籍个案（如 KR→EN）按你给的名单取一个值；若确实需要「多分部」再评估改建关联表。
- 三处必改（仓库约定）：`server/src/db/schema.ts`（`hasColumn` 守卫加列）、`server/src/db/ready.ts` 的 `REQUIRED_COLUMNS.players`、`server/test/db/schema.test.ts`。
- 种子：`players.json` 每条加 `region`；`seedPlayers.ts` 的 `SeedPlayer` 接口与插入逻辑带上它。
- 生产存量库：`migrate` 只在 players 表为空时导种子，**不会**更新已存在的 172 行。新增一次性脚本 `server/src/db/applyPlayerRegions.ts`，沿用 `applyCollabGroups.ts` 的先例：
  - 默认 dry-run，输出将要改动的选手与 `旧值 -> 新值`；
  - `--apply` 才写库，只改 `region` 一列，幂等；
  - 写库后调用 `invalidatePlayerCache()`。
  - 部署后由 DSH 执行：dry-run → 核对输出 → `--apply`。

### 3.2 区域常量与校验（单一来源）

- 新增 `server/src/regions.ts`：`REGION_KEYS = ['jp','kr','id'] as const`、`ALL_REGIONS`、`normalizeRegions(input?: unknown)`。
- 规则：
  - **缺省 / `undefined` → 全选**（旧客户端、随机匹配、旧房间快照都走这条，行为与今天一致）；
  - 去重、按 `jp, kr, id` 固定顺序规范化；
  - 含非法值 → `INVALID_REGION`（400）；
  - **显式空数组 → `REGION_REQUIRED`（400）**，防止误传空集合导致空池。
- 客户端新增 `client/src/config/regions.ts`，与难度一样「两端保持同步」。
- `server/src/types.ts` 的 `Player` 加 `region`；`playerCache.ts` 增加 `regionOf` 映射，以及「按难度 + 区域集合过滤候选池」的函数（172 条数据按需过滤即可；如需也可预缓存 7 种非空组合）。

### 3.3 单人

- 接口：`POST /api/game/start` body 增加 `regions?: ('jp'|'kr'|'id')[]`。
  - 校验 → `pickTargetAvoidingRecent({ mode, regions, identities })`；
  - 过滤后池为空 → 400 `REGION_POOL_EMPTY`（新错误码，三语同步）。
- 活动对局 key（**需要你拍板**）：
  - **方案 A（推荐）**：key 带上区域指纹 `single:active:{identity}:{mode}:{regions.join('-')}`。切题库就开新局，不会把上一题库的目标续给你；代价是发版瞬间在途对局（30 分钟 TTL）失效一次。
  - **方案 B**：沿用 `{identity}:{mode}`。零迁移，但用户改了题库仍会续到旧目标（响应里回传该局真实 `regions` 只能缓解困惑）。
- 前端：
  - `SingleLobby` 在难度卡片下方增加三枚多选开关（JP/KR/ID，默认全选，至少一个；归零时开始按钮禁用并提示）。
  - 选择持久化 `localStorage: nijisanjifriberg.single-regions`；跳转 `/single/{mode}?regions=jp,kr`（可分享、刷新不丢）。
  - `SingleGame` 读取 query（非法/缺省回落全选），随 `/game/start` 发送；页面显示当前题库。

### 3.4 多人建房

- `roomCreatePayloadSchema` 增加 `regions: z.array(z.enum(['jp','kr','id'])).min(1).max(3).optional()`（缺省 → 全选）。
- `StoredRoom` 增加 `regions: RegionKey[]`；`normalizeRoom` 对旧 Redis 快照补 `ALL_REGIONS`（滚动更新期间老房间不炸）。
- `startRound`：`pickTargetAvoidingRecent({ mode: room.dbType, regions: room.regions, ... })`；池空走现有 `EMPTY_PLAYER_POOL` 失败路径（房主看到开局失败提示）。
- `roomView` 下发 `regions`；客户端 `RoomState` 加字段，`MultiRoom` 房间设置里加一行「题库：JP / KR」。
- `MultiLobby`：
  - 三枚多选放在「更多设置」里（主卡片保留难度/模式/人数，避免卡片过长），默认全选；
  - 写进 `MultiLobbyPreferences` 与 `MultiLobbyPreset`（含旧 localStorage 数据的兼容：缺字段视为全选）；
  - `room:create` 载荷带 `regions`。
- 随机匹配：`handlers/matchmaking.ts` 建房时**显式写 `regions: ALL_REGIONS`**，匹配页不出现题库选项。这条会写成注释 + 测试锁定。
- 重赛/再来一局沿用房房间的 `regions`。

### 3.5 小题库的边界

KR/ID 池很小（个位数量级）。现有 `pickTargetAvoidingRecent` 在「最近目标排除」后仍保留最少候选（`min(5, max(1, ceil(pool*0.2)))`），池小会自然退化为允许重复，不会抽空。多人 BO5/接力就可能抽到重复目标——这是可接受行为，不做特殊处理。

---

## 4. 交互与文案

- 控件：三个可独立切换的开关/chip，附「全选」快捷；零选时禁用开始/建房并给出提示。
- 新增 i18n（zh/en/ja 同区块添加）：
  - `regions.label`（题库）、`regions.jp` / `regions.kr` / `regions.id`、`regions.all`（全选）、`regions.hint`（可多选，至少一项）；
  - `multi.regionsSummary`（房间设置里的一行）；
  - `errors.INVALID_REGION`、`errors.REGION_REQUIRED`、`errors.REGION_POOL_EMPTY`。
- 后端只回 `{ code }`，前端 `errors.*` 翻译（现有约定）。

---

## 5. 统计 / 排行（本次不拆榜，但记录数据）

- 排行榜与个人战绩口径**不变**：`games.mode` / `match_records.db_type` 仍是难度，不引入区域维度，避免同一难度下因题库不同产生口径分裂。
- 但会记录题库，便于以后做分布统计：
  - `games` 加 `region_bank`（nullable text，如 `jp,kr`）；
  - `match_records` 加同名列，或把 `regions` 留在房间快照/回放里（二选一，见 §9 问题 4）。
  - 旧行 NULL。
- 「按题库分榜」是另一项改造（缓存 key、路由参数、前端筛选），建议下一期。

---

## 6. 影响面清单（预计改动文件）

服务端：
`regions.ts`（新）、`types.ts`、`db/schema.ts`、`db/ready.ts`、`db/seeds/players.json`、`db/seedPlayers.ts`、`db/applyPlayerRegions.ts`（新）、`services/playerCache.ts`、`services/targetSelection.ts`、`routes/game.ts`、`socket/schemas.ts`、`socket/handlers/room.ts`、`socket/handlers/matchmaking.ts`、`socket/roundLifecycle.ts`、`socket/roomView.ts`、`services/roomStore.ts`、`routes/admin.ts` + `services/playerMutations.ts`（region 校验与导入）、`test/**`。

客户端：
`config/regions.ts`（新）、`pages/SingleLobby.tsx`、`pages/SingleGame.tsx`、`store/singleDifficulty.ts`（或新增 regions store）、`pages/MultiLobby.tsx`、`store/multiLobbyPreferences.ts`、`pages/MultiRoom.tsx`、`types.ts`、`i18n/resources.ts`、`styles/*`、`test/**`。

管理端（最小改动）：选手编辑表单加「分部」下拉；批量导入允许 `region`（缺省 `jp`，导入结果里报告默认填了几条）；列表加「分部」列（可选筛选，问题 5）。

---

## 7. 测试计划

- 单测：
  - `normalizeRegions`：缺省/去重/顺序/非法值/显式空数组；
  - 候选池过滤：只出选中分部；
  - 池空 → `REGION_POOL_EMPTY`。
- 服务端集成：
  - `POST /game/start` 带 `regions:['kr']` → 返回目标必为 KR；不传 → 全量；`[]` → 400；
  - socket 建房 `regions:['kr']` → 每局目标为 KR；
  - 随机匹配建房 → 房间 `regions` 为全选；
  - 旧房间快照（无 `regions`）归一为全选。
- 客户端：
  - `SingleLobby` 多选、持久化、零选禁用；
  - `MultiLobby` 载荷与预设、旧预设缺字段兼容；
  - `MultiRoom` 显示题库。
- 现有测试会因 `players` 增加 `region` 而需要更新 fixture（`schema.test`、socket 集成、admin 相关测试、`verify-fresh-db` 等）。

---

## 8. 上线顺序与回滚

1. 数据先行：你给 172 人分部（或我校正候选表）→ 写入 seeds；
2. 代码合并 → CI 构建镜像 → DSH 滚动更新（本次有加列，`migrate` 会执行 `ALTER TABLE`）→ DSH 执行 `applyPlayerRegions` dry-run → `--apply`；
3. 冒烟：单人分别选 JP / KR / ID 各开一局、建房选 KR、随机匹配仍全量、旧房间能继续；
4. 回滚：`region` 列对旧代码无害（旧代码不引用该列，SELECT * 也兼容），镜像回退即可，不需要删列。

---

## 9. 需要你确认的问题

1. **分部名单**：已按 §2.4 的官方名单落地（见 `docs/design/region-classification.json`）。如有跨分部/转籍个案需要改归属，直接点名即可。
2. **单人活动对局 key**：方案 A（按题库分开，推荐）还是方案 B（沿用难度 key）？
3. **排行榜**：本次保持不分榜（推荐），确认？
4. **多人题库记录**：`match_records` 加列，还是只留在房间快照/回放里（推荐前者，便于统计）？
5. **管理端**：选手列表是否需要「分部」列 + 筛选（推荐列；筛选可选）？
6. **日常挑战**：确认保持完整题库不变。
