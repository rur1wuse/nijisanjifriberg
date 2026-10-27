# 彩虹社（にじさんじ）竞猜化 —— 改造计划 v4（已定稿）

> 状态：**规则全部确认，可以直接开工**。代码零改动。
> 目标：把「猜 CS Major 选手」改成「猜彩虹社 JP VTuber」，只保留 `fenlei.md` 里的字段。
> 品牌名：**虹一把**
> 下一步：执行 Step 1，产出 `docs/niji/data-review.md` 供人工逐条核对。

---

## 0. 已确认的决策

| 项 | 决定 |
|---|---|
| 种族 | 先留空，md 里留列给你填（**全员都会有，不用考虑缺失**） |
| 旧 CS 字段 | **全部删除** |
| 出道日 | 相同=绿；差 ≤1 年=黄；超出=**灰+箭头** |
| 身高 | 相同=绿；差 ≤5cm=黄；超出=灰+箭头 |
| 年龄 | 相同=绿；差 ≤5 岁=黄；超出=灰+箭头；**不详=紫** |
| 性别 | 相同=绿；不同=红；「不明」算独立取值 |
| 关系 | 有交集=绿；无=红（无黄） |
| 种族 | 相同=绿；不同=红（无黄） |
| 年龄类型 | 改 **string** |
| 缺失字段 | 留空给你填 |
| 多值字段 | **全部列出，留给你人工筛选** |
| 成员范围 | **只做 JP** |
| 外部玩家 API + 作弊分析 | **删除** |
| 新增爬取 | 性别 |
| **旧数据库** | **直接删 `./data/csgofriberg.sqlite3` 重建** |
| **解散组合** | **不做特殊处理，直接全部计入** |
| **历史对局** | **一起清空** |
| **多值比较** | 不自动选，**等你人工定值后再比较** |
| **难度** | **只留 `normal`**，删 `beginner` / `easy` |
| **品牌名** | **虹一把** |
| **查选手页** | 显示种族列 |
| **出道日精度** | **精确到日** |

> **Step 1 已完成**：`docs/niji/data-review.md` 172 人已全部人工核对完毕（性别/种族/多值均已定值）。
> 数据源：`scripts/niji/scrape.py` + `report.py` 可重跑，重跑不会覆盖人工值。

---

## 1. 需要新增 `gray` 和 `unknown`（紫）两个反馈等级

你要求「超出显示**灰**+箭头」「年龄不详显示**紫**」，但代码只有三档，且 `wrong` 在 CSS 里是**红色**：

```ts
// server/src/types.ts:32 + client/src/types.ts:1
export type FeedbackLevel = 'correct' | 'close' | 'wrong';
```
```css
/* client/src/styles/game.css:58 */
.game-table td.wrong { background: var(--wrong); ... }
```

改后应为：

```ts
export type FeedbackLevel = 'correct' | 'close' | 'wrong' | 'gray' | 'unknown';
```

| 属性 | 绿 / 黄 / 灰 / 紫 |
|---|---|
| 出道日、身高 | `correct` / `close` / `gray`+箭头 |
| 年龄 | `correct` / `close` / `gray`+箭头 / **`unknown`（紫，年龄不详时）** |
| 性别、关系、种族 | `correct` / `wrong`(红) |

**年龄不详的判定**：值为 `不明` / `不詳` / `不详` / `非公開` / `秘密` / `年齢不詳` → 猜中和被猜中双方任一方不详时，该格直接显示紫色，不做数值比较。已确认 **36 人**属于此类。

> 其余写法一律取字符串中第一个数值正常比较：`20代（按20算）`→20、`23歳？`→23（实测 136 人全部可解析）。
> **唯一带单位的是 `星導ショウ` 的 `142億歳`，必须按 14200000000 计算，不能截成 142。**

涉及文件：两个 `types.ts`、`gameService.ts`、`game.css`、`themes/light.css`、`themes/blast-foundation.css`、`GameRules` 三语文案。

---

## 2. 最终字段清单

| # | 页面显示 | 入库列 | 类型 | 比较 |
|---|---|---|---|---|
| 1 | 名字 | `nickname`（复用） | string unique | 命中即胜 |
| 2 | 性别 | `gender` | string | 相同绿 / 不同红 |
| 3 | 出道日 | `debut_date` | string `YYYY-MM-DD` | 相同绿 / ≤1年黄 / 超出灰+箭头 |
| 4 | 身高 | `height_cm` | **string**（保留原文多值） | 相同绿 / ≤5cm 黄 / 超出灰+箭头 |
| 5 | 年龄 | `age_text` | **string**（原 `age` 改名改类型） | 相同绿 / ≤5岁 黄 / 超出灰+箭头 / 不详紫 |
| 6 | 关系 | `collab_groups` | text(JSON 数组) | 有交集绿 / 无红 |
| 7 | 种族 | `race` | string | 相同绿 / 不同红 |

**删除**：`nationality`、`region`、`team`、`team_history`、`role`、`major_championships`、`major_appearances`、`is_active`。

---

## 3. 分步计划

### Step 1 —— 抓取 ✅ 已完成（人工核对完毕）

1. **1.1 名单**：`メンバーデータ一覧` → 仅 JP（实测该页共 312 人含 EN/VirtuaReal）。
2. **1.2 profile**：`name="profile"` 锚点后第一张表 → 抽 `性別` / `年齢` / `身長` / `デビュー日` / `誕生日`。
   - **原文照抄**：`不明`、`100歳以上`、`178cm（182cm/178cm）` 全部保留，不合并、不猜测。
   - 限速 2s + 429 退避 + 本地缓存（`docs/niji/.cache/`）。
3. **1.3 组合**：`コラボ一覧表` 10 个表 → `成员 → [组合]`。
   - 保留 `*5`/`*54` 脚注原样；
   - **不做任何自动剔除，也不区分解散组合**（已决策）。
4. **1.4 汇总** → **`docs/niji/data-review.md`**（人工核对主文件）
   - 列：`名字 | 性别 | 出道日 | 身高 | 年龄 | 组合数 | 种族 | 状态`
   - 组合明细单独放 `collabs.md`（有人 108 个组合，塞进主表无法阅读）；
   - 多值格：原样写入 + `状态` 标 `⚠️多值`，等人工定值；
   - 缺失格：留空 + `状态` 标 `❌缺`。

> 交付：`docs/niji/data-review.md`、`roster.md`、`collabs.md` + `scripts/niji/scrape.py`（可重跑、带缓存）。

---

### Step 2 —— 数据模型 ✅ 已完成

1. `schema.ts` + `db/ready.ts` `REQUIRED_COLUMNS` + `server/test/db/schema.test.ts` 三处同步。
2. 加列：`gender`、`debut_date`、`height_cm`、`age_text`、`collab_groups`、`race`；删 CS 列。
3. **旧库直接删** —— 无需写 drop 迁移，`ensureSchema` 会重建。注意同时清 `games` / `match_records` / `match_players` / `daily_challenges` / `daily_challenge_attempts`。
4. 加 `DATA_FORMAT=niji` 之类的标记？→ 不需要，删库后天然干净。

**实际结果**：

- `players` 最终列：`id / nickname / gender / debut_date / height_cm / age_text / collab_groups / race / is_enabled / created_at`
- 已删除：`nationality` `region` `team` `team_history` `role` `major_championships` `major_appearances` `is_active` `age`
- `seedPlayers.ts` 改为写新字段；`services/teamHistory.ts` 改名语义为 `normalizeCollabGroups` / `serializeCollabGroups`（上限 50 → **300**，因为椎名唯華有 108 个组合）
- `services/playerCache.ts` 搜索索引从 `nickname+team` 改为 `nickname+race`
- `pnpm migrate` 成功，**172 名选手入库**，`difficulty_levels` 仍为 `beginner/easy/normal`（Step 4 才收敛为 `normal`）
- 测试：`test/db/*` 全绿（schema 3 + seedPlayers 1 + ready 2）

**遗留**：`tsc --noEmit` 仍有 **85 个错误**，全部集中在 Step 3~6 待改的 10 个文件
（`gameService` 29、`socket/roomView` 14、`routes/admin` 9、`routes/stats` 8、`routes/players` 8、
`routes/dailyChallenge` 6、`routes/game` 6、`playerMutations` 3、`externalCheatAnalysis` 1、`playerChangeSubmissions` 1）。
这是预期状态：Step 2 只负责表结构，运行时代码在后续步骤收敛。

**环境注意**：
- 数据库实际落在 `server/data/csgofriberg.sqlite3`（不是根目录 `data/`），因为 `pnpm migrate` 在 server 包内执行。
- 本机 **Redis 未运行且无 Docker**，所以 `test/middleware/rateLimit`、`routes/*.integration`、`socket/*` 等需要 Redis 的套件会失败（`ECONNREFUSED 127.0.0.1:6379`），非代码问题。
- 本机 Node 为 **v24.12.0**，低于 `engines: >=26`，pnpm 会打印 WARN 但可运行。

---

### Step 3 —— 判定逻辑 ✅ 已完成

```
gender   : 相等 correct / 否则 wrong
debut    : 相等 correct / 差≤1年 close / 否则 gray + hint
height   : 相等 correct / 差≤5cm close / 否则 gray + hint
age      : 双方任一「不详」→ unknown(紫)
           否则 相等 correct / 差≤5岁 close / 否则 gray + hint
collab   : 交集非空 correct / 否则 wrong   （猜中目标时恒为 correct）
race     : 相等 correct / 否则 wrong
```

要点：
- `height_cm`/`age_text` 存字符串 → 比较时解析数值；
- **年龄不详关键词**：`不明` / `不詳` / `不详` / `非公開` / `秘密` / `年齢不詳`（共 **36 人**）→ `unknown`，紫色，不给箭头、不参与数值比较；
- **其余一律取字符串中第一个数值**参与比较（已决策）：
  - `20代（按20算）` → 20
  - `23歳？` → 23
  - `20.4歳` → 20.4
  - `777.00001歳` → 777.00001
  - 实测 **136 人**全部可解析，0 人无法解析；
- **数值解析必须先处理单位倍率**，再取数值。当前只有 `星導ショウ` 的 `142億歳` 命中：
  - `億` ×100,000,000 → `142億歳` = **14200000000**（不能截成 142）
  - 兼容 `万` ×10,000 / `千` ×1,000
  - 不处理单位会导致「比谁年龄大」的方向判定完全错误；
- 身高解析不出 → `gray` 不给箭头。

**实际结果**：

- 新增 `server/src/services/attributeParsing.ts`：`parseScaledNumber` / `parseAge` / `parseHeightCm` / `parseDateToDay` / `isUnknownAge`，以及阈值常量 `DEBUT_CLOSE_DAYS=365`、`HEIGHT_CLOSE_CM=5`、`AGE_CLOSE_YEARS=5`
- `FeedbackLevel` 扩为 5 档：`correct | close | wrong | gray | unknown`（server + client 两个 `types.ts`）
- `GuessFeedback.attributes` 改为 6 项：`gender / debutDate / height / age / collab / race`
- `gameService.ts` 29 个错误清零；`refreshGuessFeedback()` 保留签名，改为按当前玩家数据重算（管理员改数据后重放历史用）
- **修正一个边界情况**：`collab` 原先按「交集为空 = 红」，导致猜中一个没有任何组合的角色（語部紡）时该格仍是红 → 整行不会是全绿。现在猜中目标时该格恒为 `correct`
- 测试 `test/services/gameService.test.ts` 重写为 **21 个用例，全部通过**（含 `142億歳` 方向、紫格、组合交集、空组合猜中）

**遗留**：`tsc --noEmit` 仍有 **64 个错误**，分布：
`socket/roomView` 22、`routes/admin` 9、`routes/players` 8、`routes/stats` 8、
`routes/game` 6、`routes/dailyChallenge` 6、`playerMutations` 3、`externalCheatAnalysis` 1、`playerChangeSubmissions` 1。
`roomView` 从 14 涨到 22 是因为它消费新的 `GuessFeedback` 结构，属于 Step 4 范围。

---

### Step 4 —— UI + i18n ✅ 已完成

1. `GuessBoard.tsx` → 7 列（名字/性别/出道日/身高/年龄/关系/种族）。
2. 新增 `gray` + `unknown`(紫) 样式（`game.css` + `themes/light.css` + `themes/blast-foundation.css`）。
3. 删 `utils/playerRoles.ts`、`utils/playerGeography.ts`。
4. `resources.ts` 三语：`guess.columns.*`、`game.hint`（改成五色说明）、`player.*` 角色/国籍文案。
5. `Home.tsx`、`GameRules.tsx`、`client/index.html` title/description、品牌名改 **虹一把**。
6. **难度一档（只留 `normal`）** → 见 §4 的 10 处硬编码清单，必须全部同步改。
7. 同步 `socket/roomView.ts`（22 个类型错误，含 `answer` 结构）。

---

**实际结果**：

- `GuessBoard.tsx` 改为 7 列：名字 / 性别 / 出道日 / 身高 / 年龄 / 关系 / 种族；列宽重新分配（20/11/15/12/11/18/13%）；入行动画只到第 7 格
- `AnswerOverlay.PlayerInfoTable` 改为 6 行（性别/出道日/身高/年龄/关系/种族），删除 `playerRoles`、`playerGeography` 依赖
- 已删除 `client/src/utils/playerRoles.ts`、`client/src/utils/playerGeography.ts`、`client/test/utils/playerGeography.test.ts`
- `client/src/types.ts`：`PlayerInfo` 与 `roomResult/matchResult.answer` 统一为 7 字段
- 新增 `gray` / `unknown` 五档样式：
  - `tokens.css`：`--wrong` 改回红 `#cb3649`，新增 `--gray: #a89ba3`、`--unknown: #7c4dbe`
  - `blast-foundation.css`：`--wrong: #e2455e`、`--gray: #675563`、`--unknown: #a281ff`
  - `game.css`：`td.gray` / `td.unknown` / `.legend-gray` / `.legend-unknown`
  - `light.css`：`:not()` 排除列表与 hover 同步补上 gray/unknown
  - `home-multiplayer.css`：`.rule-feedback-unknown` 色块
- `GameRules.tsx`：新增紫色「年龄不详」反馈块，字段说明改为 7 个字段（性别/出道日/身高/年龄/关系/种族），移除赛区划分面板
- i18n 三语同步：`guess.columns.*`（7 列）、`player.*`（6 个新字段）、`rules.*`（五色 + 7 字段）、`home.*`、`search.*`、`difficulty.*`；品牌名改 **虹一把**（三语 `common.brand` + `client/index.html` title/description）
- 难度一档：`server/src/difficulties.ts`、`routes/game.ts`、`routes/leaderboard.ts`、`schema.ts` 三处默认值、`client/src/config/difficulties.ts`、`utils/difficulty.ts`、`SingleLobby`/`DailyLobby`/`Leaderboard`/`SingleGame` 全部收敛为 `normal`；删除 `recommended` 字段与推荐徽章
- `socket/roomView.ts`：`visibleGuess` 去掉 region 剥离；`hiddenGuess` 改 6 个新属性；`replayAnswer`/`answerView` 统一走 7 字段，`answerView` 复用 `replayAnswer`
- 顺带修好 Step 5/6 之前的编译阻塞：`AdminPlayers.tsx` / `PlayerEditForm.tsx` 改用新字段（管理员表单 & 列表）
- 测试：`client/test` 全部 29 个文件、**126 个用例通过**；`server/test/db` + `gameService` **27 个用例通过**

**遗留**：`tsc --noEmit` 仍有 **42 个错误**，全部属于 Step 5/6 范围：
`routes/admin` 9、`routes/players` 8、`routes/stats` 8、`routes/game` 6、`routes/dailyChallenge` 6、`playerMutations` 3、`externalCheatAnalysis` 1、`playerChangeSubmissions` 1。
（Step 4 的目标是把 `roomView` 的 22 个清零，已达成：64 → 42。）

### Step 5 —— 搜索与池 ✅ 已完成

1. `routes/players.ts` + `services/playerCache.ts` 字段白名单更新。
2. 「查选手」页字段跟着改（含种族列）。
3. 入池条件：全员。

**实际结果**：

- `routes/players.ts` 新增 `playerInfoView()`：把 `gender / debut_date / height_cm / age_text / collab_groups / race`
  映射成客户端 `PlayerInfo` 的驼峰形状（`debutDate / height / age / collab / race`），
  `collab_groups` 数组用 `、` 拼成纯文本（客户端按字符串渲染）。8 个 tsc 错误清零。
- **全员入池已实测**：`players` 172 总数 = 172 启用 = `normal` 池 172 = 可搜索 172，零遗漏。
  搜索索引本就是 `nickname\0race`，无需改动。
- `client/src/pages/Search.tsx` **无需改动** —— Step 4 已让它消费新契约（`debutDate/height/age/collab/race`），
  种族既作为标题副标也作为表格一行。
- **修复 Step 2 遗留的坏测试**：`test/services/playerCache.test.ts` 仍在插入已删除的
  `nationality/region/team/age/role/major_championships/major_appearances/is_active`，
  重写为写新列；`beginner` 用例改为 `normal`；新增「全员入池」与「nickname+race 可检索」两个用例（4 个全通过）。
- 新增 `test/routes/players.integration.test.ts`：断言返回新字段、且不泄露任何旧扁平字段
  （`nationality/region/team/role/majorChampionships/majorAppearances/isActive` 与蛇形原名），
  并断言 `suggest=1` 只返回 `id+nickname`。
- 新增 `client/test/pages/Search.test.tsx`：验证页面能把 6 项属性 + 种族全部渲染出来。
- **顺带清掉 `difficulty_levels` 残留**：`ensureSchema` 原来只 upsert 不删，库里仍留着
  `beginner/easy` 两行。新增 `whereNotIn(...).del()`，DB 现在只有 `normal`；
  `player_difficulties` 因外键 CASCADE 无孤儿行（仍 172 条全 `normal`）。

**验证**：server `tsc --noEmit` 从 **42 → 34** 个错误（`routes/players` 的 8 个清零，其余全属 Step 6）；
client `tsc --noEmit` **0 错误**；client 全量 **127/127 通过**（30 文件）；
相关 server 套件 **33/33 通过**。全量 server 仍有 47 个失败，全部是 Step 6 范畴
（`admin/stats/game/dailyChallenge/externalPlayers/playerChangeSubmissions` 用旧列，
`socket/*` 硬编码 `beginner`，`externalCheatAnalysis` 待删）——已用 stash 对照确认非本次改动引入。

---

### Step 6 —— 删除外部 API / 作弊分析 ✅ 已完成

删除：
- `routes/externalPlayers.ts`、`services/externalCheatAnalysis.ts`、`services/playerChangeSubmissions.ts`、`services/apiTokens.ts`、`middleware/apiToken.ts`
- `index.ts` 的 `/api/external` 挂载 + `externalPlayerAuth`
- `routes/admin.ts` 的作弊分析 / API Token / 变更审核端点
- `components/admin/AdminApiTokens.tsx`、`AdminPlayerChanges.tsx`（+ 测试）
- `docs/cheat-analysis-api.md`、`README.md` 外部 API 章节
- 表：`api_tokens`、`player_change_submissions`、`player_change_items`

**实际结果**：

- 删除 5 个服务端源文件 + 3 个测试文件；`index.ts` 去掉 `externalPlayerAuth` 与 3 段 `/api/external` 挂载
- `admin.ts` 删除 8 个端点（`/reports/:id/analysis`、`/users/:id/analysis`、`/guests/:id/analysis`、
  `/player-change-submissions` 及其 review、`/api-tokens` GET/POST/DELETE）及其专属 schema/限流/导入
- `config.ts` 删除 `cheatAnalysis` 配置块与配套校验（`CHEAT_ANALYSIS_*` 三个环境变量）
- `schema.ts` 删除三张表定义与索引；对**已存在的库**补 `dropTableIfExists`，`migrate` 后三表已消失
- `db/ready.ts` 的 `REQUIRED_COLUMNS` 同步移除三项
- **客户端**：删除 `AdminApiTokens`、`AdminPlayerChanges`、`ExternalAnalysisPanel` 三个组件及测试；
  `Admin.tsx` 去掉两个 tab；`AdminReports` 去掉分析面板；`AdminUsers` 去掉“对局分析”tab
  （其 ban/限制匹配控件与“快捷管理”tab 重复，已确认冗余后删除）
- 三语文案清理：`apiTokens*` / `playerChanges*` / `analysis*` / `detailAnalysis` 共 45 处 key × 3 语言，
  外加 5 个 `ANALYSIS_*` 错误码
- `resources.ts` 剩余 key 三语结构保持一致；`.env.example`、`compose.yaml`、`AGENTS.md`、`README.md` 引用一并清除

**顺带修复（Step 2/4 遗留，不修则系统不可用）**：

- `services/playerMutations.ts` 仍用旧 CS 字段（`nationality/team/age/role/major_*`），
  意味着**管理后台的选手增删改完全不可用**。重写为 niji 字段（`gender/debut_date/height_cm/age_text/collab_groups/race`），
  `team_history` → `collab_groups`（走 `normalizeCollabGroups` / `serializeCollabGroups`），昵称上限 64 → 128
- `admin.ts` 的选手列表搜索条件与 export select 仍引用旧列 → 改为新列
- `game.ts` / `stats.ts` / `dailyChallenge.ts` 的 `answerView` 改为 6 属性新结构

**测试收敛**（原 47 个失败 → 全绿）：

- `socket/*`：`dbType` 由 `easy`/`beginner` 统一为 `normal`（66 + 2 处）；隐藏视图断言改为「6 属性均无 `value`」；
  `target-history:beginner:` / `matchmaking:*:easy` 等 Redis key 同步改名
- `game` / `leaderboard` / `stats` / `dailyChallenge` / `admin` 五个集成套件：
  测试数据从旧列迁移到新列，多难度递进断言改写为单难度（`entries` 6→2、`challenges` 3→1 等）
- `playerCache` / `players` / `Search` / `AdminUsers` / `AdminReports` 相关断言同步

**验证**：server `tsc --noEmit` **0 错误**（从 42 起）；client `tsc --noEmit` **0 错误**；
server 测试 **159/159 通过**（30 文件）；client 测试 **124/124 通过**（28 文件）；
`vite build` 成功；`tsc` 后 `dist` 中已无被删模块。

---

### Step 7 —— 种子数据落库 ✅ 已完成

种子文件已生成并在 Step 2 入库（172 人）。剩余：Step 3~6 改完后重跑 `pnpm migrate` + `pnpm test` 确认。

**实际结果**：

- **种子与 DB 逐字段比对一致**：172 条，`nickname/gender/debut_date/height_cm/age_text/race/is_enabled`
  全部相同，`collab_groups` 数组逐条相同；无重复昵称、无残缺记录。
  组合总数 **5025**，单人最多 **108**（与计划中椎名唯華的数据吻合）。
  校验脚本：`scripts/niji/verify-seeds.cjs`。
- **全新库从零 migrate 通过**：在独立临时 DB 上执行 `DB_URL=<tmp> tsx src/db/migrate.ts`，
  建出 **14/14** 张表、自动导入 172 人；`difficulty_levels` 仅 `normal`；
  `player_difficulties` 172 条全为 `normal`；Step 6 删除的三张表确认不再创建。
  校验脚本：`scripts/niji/verify-fresh-db.cjs`。
- **migrate 幂等**：连续执行 3 次均返回 0，数据保持 172 条不重复、难度层级不漂移。
- 生产库（`server/data/csgofriberg.sqlite3`）最终状态与全新库一致。
- 全量测试：server **159/159**（30 文件）、client **124/124**（28 文件）全绿。

---

### Step 8 —— 验证 ✅ 已完成

`pnpm test`（需 Redis）→ `pnpm build` → 手动过单人/每日/多人 → 三语无漏 key。

**实际结果**：

- **`pnpm build` 全链路通过**：PoW WASM 命中缓存跳过 Rust → client `tsc -b` + vite（1977 模块）→ server `tsc`。
  `client/dist` 与 `server/dist` 均生成；在 `dist` 中搜索 `requestExternalCheatAnalysis` / `externalPlayerAuth` /
  `listApiTokens` / `revokeApiToken` **无残留**，Step 6 删除的模块确认不再打包。
- **三语漏 key 检查（发现并修复真实缺陷）**：新增 `scripts/niji/check-i18n-keys.ts`，
  导入真实的 `resources` 模块展开成扁平 key 集合逐语比对。
  首次运行即报出 **en 缺 10 / 多 6、ja 缺 21 / 多 24**：
  - `en` 的规则块仍用旧 key 名（`teamTitle`/`regionTitle`/`majorTitle`），内容却已是 niji 语义 →
    改名为 `gender/debut/height/collab/race`；顺带修正 “Historical team, same region” 的黄色说明
  - `ja` 的规则块**整块仍是 CS:GO 内容**（“プロ選手”、“Major データ”、整段 `regions` 地理分区）→
    按 zh 语义整体重写；删除 `easyHint`、多余的 `search.age`
  - 三语 `importPlaceholder` 示例仍是 `s1mple/NAVI/role:AWPer` → 换成真实 niji 记录
  - 首页 `hero-kicker` 仍是 `CS MAJOR // PLAYER GUESSING` → `NIJISANJI // MEMBER GUESSING`
  - 最终 **三语各 834 key，完全一致，零空字符串**
- **生产服务器验证**：`node server/dist/index.js` 启动后 `/api/health` 返回 `redis: up`；
  SPA 根路径 200 且 title 正确；`/assets/*` 按设计 404。
  ⚠️ 需设置 `CORS_ORIGINS` 包含实际访问 Origin（默认仅 `http://localhost:5173`），否则 PoW 接口 403。
- **API 级冒烟（21/21）**：新增 `scripts/niji/smoke-e2e.cjs`，自行解 PoW 后覆盖
  单人开局/猜词/放弃、查选手、每日 overview/开局/答题、排行榜。
  关键断言：`feedback.attributes` 恰为 6 项；`answer` 含 6 个 niji 字段且**不含任何旧字段**；
  每日 overview **恰好 1 档**；每日排行榜在未完成时正确返回 `409 DAILY_CHALLENGE_INCOMPLETE`。
- **浏览器 UI（23/23）**：新增 `scripts/niji/ui-verify.cjs`（CDP 驱动 headless Chrome）。覆盖
  首页标语、**zh/en/ja 三语规则弹窗**（均无原始 i18n key 泄漏、均含性别/种族）、
  查选手 **7 行信息表**（性别/出道日/身高/年龄/关系/种族/所属难度）、单人页、每日页、排行榜，
  并断言全程无 console 错误。
- **多人模式**：Socket.IO 链路不适合 HTTP 冒烟，由 `test/socket/socket.integration.test.ts`
  的 **46 个集成测试**覆盖（建房/准备/开始/猜词/重连/掉线判负/重赛/接力/2v2/观战/战绩持久化），全部通过。
- **全量测试**：server **159/159**（30 文件）、client **124/124**（28 文件）；两侧 `tsc --noEmit` 均 0 错误。

**顺带修正**：`DailyLobby` 标题在只剩一档后仍叫「选择每日挑战难度」，改为「每日挑战」+ 新副标题（三语同步）。

---

## 4. 「只留 normal」的连锁改动（已查清，共 10 处硬编码）

`Difficulty` 只有 `normal` 一档，但 `beginner` / `easy` 被**硬编码**在以下位置，删 key 必须同步改，否则会静默失效：

| # | 文件:行 | 现状 | 改成 |
|---|---|---|---|
| 1 | `server/src/difficulties.ts:2-3` | `beginner` / `easy` 定义 | **删除这两行**，只留 `normal` |
| 2 | `client/src/config/difficulties.ts:9-10` | 同上 + `recommended: true` | 删两行；`recommended` 字段无意义 → 一并删 |
| 3 | `server/src/routes/game.ts:116` | `.default('beginner')` | **`.default('normal')`** ⚠️ 不改会导致开局 400 |
| 4 | `server/src/routes/leaderboard.ts:17` | `.default('beginner')` | `.default('normal')` |
| 5 | `server/src/db/schema.ts:146` | `mode` 默认 `'easy'` | `'normal'` |
| 6 | `server/src/db/schema.ts:246,270` | `db_type` 默认 `'easy'` | `'normal'` |
| 7 | `client/src/pages/SingleGame.tsx:23` | `mode = 'beginner'` | `'normal'` |
| 8 | `client/src/pages/Leaderboard.tsx:34` | fallback `'beginner'` | `'normal'` |
| 9 | `client/src/pages/MultiLobby.tsx:89,261` | 已有 `?? 'normal'` 兜底 | 删除多档选择 UI，固定 `normal` |
| 10 | `client/src/i18n/resources.ts:286-302` | `beginner`/`easy` 文案 | 删多余 key，保留 `normal` |

不动的：
- `server/src/seedPlayers.ts:25` 的 `['normal']` 兜底 —— 正确。
- `difficulties` 的 sortOrder 机制 —— 保留，一档也能用。

**首页 UI**：「简单版 / 完整版」两个按钮合并为单个「开始游戏」，直接进 `/single/normal`。

**每日挑战**：`difficulty_key` 现为 `beginner/easy/normal` 三条 → 只留 `normal` 一条，`/daily/:mode` 固定 `normal`。

---

## 5. 其余待你确认的小点（可选，不答我就按推荐做）

| # | 问题 | 默认做法 |
|---|---|---|
| P1 | 首页副标题写什么？ | 「彩虹社 VTuber 竞猜」 |
| P2 | 种族「不明」怎么算？你说都会有，所以不处理 | 按普通字符串比较 |
| P3 | 出道日只有年月没有日怎么办？ | 已定「精确到日」；若 wiki 仅到月，记 `YYYY-MM-01` 并在 md 里标 ⚠️ 供你补 |

---

## 6. 已知风险（执行时注意）

1. **`answer` 结构在三处重复**：`client/src/types.ts` 的 `RoomState.roundResult.answer` / `matchResult.answer` 是手写结构，`server/src/socket/roomView.ts` 也在组装 → 改字段必须同步三处。
2. **i18n 文件是超长行**：`resources.ts` 每语言把 `errors` 压成几行超长行，需用支持 UTF-8 的编辑工具，禁止靠 PowerShell 输出判断内容（本机终端会乱码）。
3. **抓取限速**：目标站 429 敏感，实测 7 页后触发。脚本必须带退避和缓存，中断可续。
4. **`コラボ一覧表` 脏数据**：组合名含 `*N` 脚注、`解散` 字样、`(コーラス)` 等后缀。脚注已清洗，`解散GIG` 等名字保持原样且**照常计入关系判定**。
5. **`AGENTS.md` 在 `.gitignore` 第 17 行** —— 若想让协作规则入库需先改 gitignore。

---

## 7. 进度总览（每次收工更新）

**最后更新**：Step 4 完成

| Step | 内容 | 状态 |
|---|---|---|
| 1 | 抓取数据 + 人工核对 | ✅ 完成 |
| 2 | 数据模型（表结构） | ✅ 完成 |
| 3 | 判定逻辑 | ✅ 完成 |
| 4 | UI + i18n + 难度一档 | ✅ 完成 |
| 5 | 搜索与池 | ⬜ 未开始 |
| 6 | 删除外部 API / 作弊分析 | ⬜ 未开始 |
| 7 | 种子落库 | 🟡 已入库，待最终确认 |
| 8 | 全量验证 | ⬜ 未开始 |

### 已完成的具体产出

**Step 1**
- `scripts/niji/scrape.py` — 抓取（限速 2s + 429 退避 + 缓存，可重跑）
- `scripts/niji/report.py` — 生成核对表，重跑不覆盖人工值
- `scripts/niji/build_seeds.py` — 由核对表生成 `players.json`
- `docs/niji/data-review.md` — 172 人，性别/种族/多值已全部人工核对完毕
- `docs/niji/collabs.md`、`docs/niji/roster.md`
- 数据源：wikiwiki プロフィール + ja.wikipedia 活動開始日 + コラボ一覧表

**Step 2**
- `players` 新列：`gender / debut_date / height_cm / age_text / collab_groups / race`
- 删除 9 个 CS 列；`db/ready.ts`、`schema.test.ts`、`seedPlayers.test.ts` 同步
- `teamHistory.ts` → `normalizeCollabGroups`（上限 50 → 300）
- `playerCache.ts` 搜索索引改 `nickname + race`
- `pnpm migrate` 成功，172 人入库
- 数据库实际位置：**`server/data/csgofriberg.sqlite3`**（`AGENTS.md` 已修正）

**Step 3**
- 新增 `services/attributeParsing.ts`（含 `億`/`万`/`千` 单位倍率）
- `FeedbackLevel` 扩为 `correct | close | wrong | gray | unknown`
- `GuessFeedback.attributes` 改为 `gender / debutDate / height / age / collab / race`
- `gameService.ts` 类型错误清零；21 个测试用例全过
- 修复：猜中无组合角色（語部紡）时 `collab` 格仍为红 → 改为猜中恒 `correct`

### 当前已知状态

- `pnpm --filter client test` → **126/126 通过**（29 个测试文件）
- `pnpm --filter server test -- test/db test/services/gameService.test.ts` → **27/27 通过**
- `pnpm --filter client exec tsc --noEmit` → **0 错误**
- `pnpm --filter client exec vite build` → **成功**（1980 modules）
- `pnpm --filter server exec tsc --noEmit` → 仍有 **42 个错误**，全部属于 Step 5/6 范围：
  `routes/admin` 9、`routes/players` 8、`routes/stats` 8、`routes/game` 6、
  `routes/dailyChallenge` 6、`playerMutations` 3、
  `externalCheatAnalysis` 1、`playerChangeSubmissions` 1

  → **因此现在服务端 `pnpm build` / `pnpm start` 仍会失败**，这是预期中间态。

### 环境阻塞：Redis / Docker（已重新核实）

Step 8 的 `routes/*.integration`、`socket/*`、`roomStore`、`playerCache` 等套件**必须有 Redis**。

**本机现状（2026-10-27 核实）**：
- Redis 未运行（`127.0.0.1:6379` 拒绝连接），无 memurai/redis 服务
- `docker` 命令**不存在**——Docker Desktop 上次安装已回滚，安装目录为空
- `wsl --version` → WSL 3.0.1.0（包已存在），但 `wsl --list --verbose` → **无任何发行版**
- `get-WindowsOptionalFeature` 需要管理员；当前进程 **非管理员**
- 上次安装日志确认原因（`AppData\Local\Docker\install-log.txt`）：
  `Required Windows features are not enabled: VirtualMachinePlatform` +
  `A per-user installation cannot enable it, because that requires administrator privileges.`
- **安装包已被清理**：`%TEMP%\DockerDesktopInstallers\` 不存在，
  `%LOCALAPPDATA%\Programs\DockerDesktop\` 为空目录，`E:\Docker\` 为空
- 磁盘：C 剩 **17.3 GB**，E 剩 **96.4 GB**

**结论**：写入 `VirtualMachinePlatform` 需要**管理员权限 + 重启**，当前会话无法代劳，也无法重新下载 591 MB 安装包。

**需用户手动执行（一次性）**：

1. 以管理员身份打开 PowerShell，启用虚拟化平台：
   ```powershell
   dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart
   dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
   ```
2. **重启电脑**
3. 重启后下载并安装到 E 盘（需先下载安装器）：
   ```powershell
   curl.exe -L -o "$env:TEMP\DockerDesktopInstaller.exe" https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe
   & "$env:TEMP\DockerDesktopInstaller.exe" install --user --accept-license --installation-dir=E:\Docker\DockerDesktop
   ```
4. 装好后还需把 WSL2 磁盘从 C 盘迁到 E 盘（默认在 `%LOCALAPPDATA%\Docker\wsl`，C 盘仅剩 17 GB）3）
5. 最后启动 Redis：`docker run -d --name redis -p 6379:6379 redis:7-alpine`

**其他环境注意**：
- 本机 Node 为 **v24.12.0**，低于 `engines: >=26`，pnpm 会打印 WARN 但可运行
- 全量测试命令：`pnpm test`（server 先跑，且刻意串行）

---

## 8. 下一步

**从 Step 5 继续**（不依赖 Redis/Docker，可立即开工）：

Step 5 —— 搜索与池：

1. `server/src/routes/players.ts`（八个字段错误）→ 改为 `gender / debut_date / height_cm / age_text / collab_groups / race / difficulties / is_enabled` 白名单
2. `services/playerCache.ts` 搜索索引已改 `nickname + race`，需确认池内全员可检索
3. 「查选手」页字段跟着改（含种族列）——`Search.tsx` 已走新字段，只差后端响应
4. 入池条件：全员（不再按难度过滤）

Step 6 —— 删除外部 API / 作弊分析：`routes/admin.ts`、`routes/stats.ts`、`routes/game.ts`、
`routes/dailyChallenge.ts`、`playerMutations.ts`、`externalCheatAnalysis.ts`、`playerChangeSubmissions.ts` 的 42 个错误一并收尾。

Docker/WSL2 与 Step 8 的 Redis 测试等用户完成上面的管理员步骤后再处理，不阻塞 Step 5~7。
