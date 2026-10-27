<div align="center">

# 虹一把 (nijisanjifriberg)

**彩虹社（Nijisanji JP）VTuber 猜测游戏 —— 类 Wordle 玩法 + 实时多人对战**

[![CI and Docker](https://github.com/shnlfriberg/nijisanjifriberg/actions/workflows/docker.yml/badge.svg)](https://github.com/shnlfriberg/nijisanjifriberg/actions/workflows/docker.yml)
[![License: AGPL-3.0](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)](LICENSE)
[![Node.js ≥ 26](https://img.shields.io/badge/node-%E2%89%A526-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![pnpm workspaces](https://img.shields.io/badge/pnpm-workspaces-F69220?logo=pnpm&logoColor=white)](https://pnpm.io/)

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![React 18](https://img.shields.io/badge/React_18-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?logo=express&logoColor=white)
![Socket.IO](https://img.shields.io/badge/Socket.IO-010101?logo=socketdotio&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-FF4438?logo=redis&logoColor=white)

[玩法](#玩法) · [快速开始](#快速开始) · [配置](#配置) · [常用脚本](#常用脚本) · [部署](#docker-生产部署) · [选手数据](#选手数据) · [开发约定](#开发约定)

</div>

---

## 玩法

系统从 172 名彩虹社 JP 成员中随机选一位作为答案。每次输入选手昵称，系统按 **性别 / 出道日 / 身高 / 年龄 / 关系 / 种族** 六个属性逐项对比：

| 反馈 | 含义 |
| --- | --- |
| 🟩 **绿色** | 该属性与答案完全一致 |
| 🟨 **黄色** | 接近：出道日相差 ≤1 年 / 身高相差 ≤5cm / 年龄相差 ≤5 岁 |
| ⬜ **灰色** | 差距超出「接近」范围，并用 ↑↓ 箭头指示答案更高或更低 |
| 🟪 **紫色** | 任一方年龄不详，不做数值比较 |

**关系** 字段在有共同组合（如「JK組」「さんばか」）时显示绿色，完全无交集显示红色；猜中目标时该格恒为绿色。
**名字** 猜对即获胜。

8 次机会内猜出目标选手即获胜。

## 快速开始

**环境要求**

- Node.js **≥ 26**
- pnpm **11.13.1**（已固定在 `packageManager`）
- Redis（本地开发可降级为内存模式，但部分测试需要真实 Redis）
- Rust 工具链 **可选** —— 仅在修改 `pow-wasm/src/lib.rs` 需要重编 WASM 时安装

```bash
pnpm install
cp .env.example .env      # 可选，所有变量都有默认值
pnpm migrate              # 首次必须执行：建表 + 导入 172 名选手
pnpm dev                  # server: 3000，client: 5173
```

打开 http://localhost:5173 即可游玩。Vite 会代理 `/api` 与 `/socket.io` 到 3000 端口。

### 创建管理员

公开注册的账号都是普通用户。管理员需显式创建或重置：

```bash
ADMIN_USERNAME=admin ADMIN_PASSWORD='至少12位强密码' pnpm create-admin
```

管理员登录后可访问 `/admin`，支持选手增删改、JSON 批量导入/导出、公告管理、举报处理、用户与访客管理。

### 用 Docker 跑本地依赖

如果本机没有 Redis，用容器起一个即可：

```bash
docker run -d --name redis -p 6379:6379 --restart unless-stopped redis:7-alpine
```

## 配置

所有配置都通过环境变量注入，默认值见 `.env.example`。常用项：

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PORT` | `3000` | 服务端口 |
| `DB_CLIENT` | `sqlite` | `sqlite` \| `pg` |
| `DB_URL` | `./data/nijisanjifriberg.sqlite3` | SQLite 为文件路径；PG 为连接串 |
| `REDIS_URL` | `redis://127.0.0.1:6379` | Redis 地址 |
| `REDIS_PREFIX` | `nijisanjifriberg:` | Redis key 前缀，多实例共享需一致 |
| `REDIS_REQUIRED` | `false` | 设为 `true` 时 Redis 故障则拒绝启动 |
| `CORS_ORIGINS` | `localhost:5173` 等 | 允许的前端来源，逗号分隔 |
| `JWT_SECRET` | 空 | 生产环境必须 ≥32 字节随机串 |
| `POW_DIFFICULTY` | `17` | 普通请求的 PoW 难度（16–24 bit） |
| `POW_REGISTER_DIFFICULTY` | `19` | 注册的 PoW 难度，必须高于上一项 |
| `EMAIL_SMTP_*` | 空 | 可选，配置后启用邮箱验证 |
| `GEETEST_CAPTCHA_ID` / `GEETEST_PRIVATE_KEY` | 空 | 生产环境必填 |

> **注意**：直接用 IP/端口访问生产服务器时，务必把该 Origin 加入 `CORS_ORIGINS`，否则 PoW 接口会返回 403，前端表现为点击无反应。

### 切换 PostgreSQL

```env
DB_CLIENT=pg
DB_URL=postgres://user:pass@localhost:5432/nijisanjifriberg
```

生产环境（`NODE_ENV=production`）会强制校验：PostgreSQL、≥32 字节 `JWT_SECRET`、`REDIS_REQUIRED=true`、GeeTest 配置齐全。

## 常用脚本

| 命令 | 说明 |
| --- | --- |
| `pnpm dev` | 同时启动前后端开发服务 |
| `pnpm build` | 构建 PoW WASM + 前端 + 后端编译 |
| `pnpm start` | 生产模式启动（server 托管 `client/dist`） |
| `pnpm test` | 先跑 server 再跑 client |
| `pnpm test:client` | 只跑前端测试 |
| `pnpm migrate` | 初始化/更新数据库结构并导入种子选手 |
| `pnpm seed` | 补充缺失的种子选手 |
| `pnpm create-admin` | 显式创建或重置管理员 |
| `pnpm loadtest` | HTTP 缓存接口与多人建房负载测试 |

跑单个测试：

```bash
pnpm --filter server test -- test/routes/game.integration.test.ts
pnpm --filter client test -- test/pages/Home.test.tsx
```

### 数据校验脚本

`scripts/niji/` 下有几个可接 CI 的校验脚本（在 `server/` 目录下执行）：

```bash
cd server
node ../scripts/niji/verify-seeds.cjs                              # 种子文件与 DB 逐字段比对
node ../scripts/niji/verify-fresh-db.cjs ./data/nijisanjifriberg.sqlite3  # 表结构与数据完整性
node ../scripts/niji/smoke-e2e.cjs                                 # HTTP 端到端（自带 PoW 求解）
node ../scripts/niji/ui-verify.cjs                                 # 浏览器 UI（CDP 驱动）
../server/node_modules/.bin/tsx ../scripts/niji/check-i18n-keys.ts  # 三语 key 一致性
```

## Docker 生产部署

生产镜像为 PostgreSQL 专用的精简构建（distroless 运行时，不含 Rust、pnpm、TypeScript、Vite、源码与测试）。GitHub Actions 自动执行测试、编译、构建 `linux/amd64` 镜像并发布到 GHCR。

Compose 部署、自动迁移、管理员创建、更新与回滚见 [`deploy/README.md`](deploy/README.md)。

```bash
docker compose up -d          # 首次会自动跑 migrate
```

## 选手数据

选手数据集为 172 名彩虹社 JP 成员，内置于 `server/src/db/seeds/players.json`，字段：

| 字段 | 说明 |
| --- | --- |
| `nickname` | 名字（唯一） |
| `gender` | 性别 |
| `debut_date` | 出道日 `YYYY-MM-DD` |
| `height_cm` | 身高（保留原文，如 `151cm`、`178cm（182cm/178cm）`） |
| `age_text` | 年龄（保留原文，如 `16歳`、`不明`、`142億歳`） |
| `collab_groups` | 参与过的组合数组（最多 300 项） |
| `race` | 种族 |

身高与年龄**保留原始字符串**，比较时由 `server/src/services/attributeParsing.ts` 解析数值，自动处理 `億`/`万`/`千` 倍率与「不详」关键字。

抓取与复核工具在 `scripts/niji/`（`scrape.py` / `report.py` / `build_seeds.py`），产物在 `docs/niji/`。

## 开发约定

- **UI 文案**：所有用户可见文字必须在 `client/src/i18n/resources.ts` 中维护，中/英/日三语同步。三语 key 集合必须完全一致，可用上面的 `check-i18n-keys.ts` 校验。
- **错误码**：后端只返回机器可读的 `{ code: '...' }`，前端在 `errors.*` 中翻译。新增错误码需在三种语言的同一区域同时添加。
- **写操作需 PoW**：浏览器端由 `client/src/api/client.ts` 的 axios 拦截器自动完成，遇到 `POW_REQUIRED` / `AUTH_EXPIRED` 会自动重试。
- **数据库结构变更**：需同步修改 `server/src/db/schema.ts`、`server/src/db/ready.ts` 的 `REQUIRED_COLUMNS`，以及 `server/test/db/schema.test.ts` 三处。
- **难度**：目前只有 `normal` 一档，定义在 `server/src/difficulties.ts` 与 `client/src/config/difficulties.ts`，两端需保持一致。
- **测试**：server 集成测试使用真实 SQLite 文件且刻意串行（`--no-file-parallelism`），不要加并行参数。
- 提交 PR 前请运行 `pnpm test` 与 `pnpm build`。

## 项目结构

```
server/src
├── config.ts              # 环境配置与生产校验
├── difficulties.ts        # 难度定义（仅 normal）
├── db/                    # Knex、建表、种子数据、就绪检查
├── middleware/            # 认证、Zod 校验、限流、PoW、错误处理
├── routes/                # auth / players / game / dailyChallenge / stats / leaderboard / announcements / admin / pow
├── services/              # 判定、属性解析、选手缓存、房间状态、战绩队列等
└── socket/                # 多人房间系统
client/src
├── api/                   # axios 封装、socket 单例、玩家列表缓存
├── store/                 # auth / theme / guest 等轻量状态
├── i18n/                  # 中 / 英 / 日 文案与错误码翻译
├── components/            # Page / GuessBoard / GuessInputBar / DataTable / admin/*
└── pages/                 # Home / SingleGame / MultiLobby / MultiRoom / Stats / ...
```

## 版权与许可证

本项目是 **csgofriberg** 的衍生版本，同样以 **GNU Affero 通用公共许可证第 3 版（AGPL-3.0）** 发布。

| | 版权 |
| --- | --- |
| 原始作品：[csgofriberg](https://github.com/shnlfriberg/csgofriberg) | Copyright (C) 2026 星海 (Xinhai) &lt;62863922+xinhai-ai@users.noreply.github.com&gt; |
| 修改版本：nijisanjifriberg | Copyright (C) 2026 星海 (Xinhai) &lt;62863922+xinhai-ai@users.noreply.github.com&gt; |

- 完整许可证原文：[`LICENSE`](LICENSE)（AGPL-3.0，请勿修改许可证正文）
- 修改说明与衍生关系：[`NOTICE`](NOTICE)
- 版权归属、修改文件标注方式与 AGPL 合规说明：[`COPYRIGHT.md`](COPYRIGHT.md)

**为什么必须沿用 AGPL-3.0**：原始项目即为 AGPL-3.0，任何衍生作品都必须以相同许可证发布，不能改为其他许可证。

**相对原始作品的改动**（详见 [`NOTICE`](NOTICE)）：玩法从 CS:GO/CS2 Major 选手猜测改为彩虹社 JP 成员猜测、属性字段整体替换、难度收敛为单一档位、移除外部 API / API Token / 作弊分析 / 选手变更审核子系统、项目更名为 nijisanjifriberg。

**第 13 条（网络服务）义务**：AGPL 要求通过网络与程序交互的用户能够获得其对应源码。**部署实例的运营者必须向用户提供所使用的确切版本源码**，例如在应用中提供指向对应 commit 的源码链接。

**修改文件标注**：依据 AGPL 第 5 条，所有相对原始作品有改动的源文件均在文件头标注了修改日期与原始版权信息；为本次修改新建的文件则标注作者与许可证。

## 贡献

欢迎提交 issue 与 pull request。提交即表示你同意以 GNU AGPL-3.0 授权你的贡献。

