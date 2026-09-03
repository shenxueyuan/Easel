# Easel 技术架构与配置说明

## 一、技术架构

### 整体分层

```
┌─────────────────────────────────────────────────────────────────┐
│  用户入口层（三入口统一）                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                       │
│  │ easel cli│  │ easel web│  │easel skill│  ← argparse 子命令     │
│  │  chat    │  │  :7860   │  │  <name>   │                       │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘                       │
│       │             │             │                              │
│       └─────────────┼─────────────┘                              │
│                     ▼                                            │
│  easel/persona.py  ← 画像内联注入（三入口单一真相源）              │
│  easel/timeouts.py ← 超时常量（三入口单一真相源）                  │
└─────────────────────┬───────────────────────────────────────────┘
                      │ subprocess.run("openclaw --profile easel ...")
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│  OpenClaw Agent 层（隔离 profile: easel）                         │
│  ~/.openclaw-easel/  ← 配置（不影响本机 OpenClaw）                 │
│  ~/.openclaw/workspace-easel/  ← workspace（skills 同步目标）      │
│                                                                   │
│  Prompt Stack（四层组合）：                                        │
│  L1 SOUL.md     人格 + 能力总览（常驻 system prompt）              │
│  L2 AGENTS.md   分工规则 + 编排逻辑 + Plan Mode（常驻）            │
│  L3 CONTEXT.md  项目路径（sync.sh 生成，半静态）                   │
│  L4 SKILL.md    被触发时加载 + references/ 按需读取                │
│                                                                   │
│  Gateway（:18789）← agent 运行时，管理会话/工具/插件                │
└─────────────────────┬───────────────────────────────────────────┘
                      │ Agent 按 SKILL.md 调用脚本
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│  Skills 层（113 个原子能力）                                       │
│  skills/openclaw/<skill-name>/                                   │
│    ├── SKILL.md        执行流程（< 200 行）                        │
│    ├── references/     领域知识（按需加载，不常驻 prompt）           │
│    └── scripts/        可执行脚本（运行时调用，不进 prompt）         │
│                                                                   │
│  五层流水线：                                                      │
│  discover（发现）→ plan（策划）→ produce（制作）                   │
│                → publish（发布）→ attribute（归因）                │
│                                                                   │
│  skills/shared/  跨 SKILL 共享层                                   │
│    ├── scripts/   40+ Python 工具脚本（model_registry/ai_video...）│
│    ├── references/  通用方法论（hook 公式/配音 casting/文案框架）   │
│    └── *.md       热榜 API/评分维度/支柱节奏                       │
└─────────────────────┬───────────────────────────────────────────┘
                      │ 产物写入
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│  数据/产物层（文件系统，无数据库）                                  │
│  outputs/           内容项目与最终产物（按项目归档）                │
│    ├── _inbox/      用户上传附件（按会话 scope 隔离）               │
│    ├── _login/      平台登录态                                     │
│    ├── _publish/    异步发布状态/验证码                            │
│    ├── _sessions/   每会话最近一轮结果（SSE 断线取回）              │
│    └── <项目>/      真实内容产物                                   │
│  profiles/<name>/   账号画像（六维：定位/风格/受众/平台/偏好/记忆） │
│  assets/            品牌 + README 媒体 + 用户导入素材               │
└─────────────────────────────────────────────────────────────────┘
```

### Web 后端（`web/app.py`，单文件 FastAPI）

```
FastAPI + uvicorn + sse-starlette
├── /api/chat/stream      SSE 流式对话（tail openclaw raw stream jsonl）
├── /api/chat/last        断线取回最近一轮结果
├── /api/skills           技能库列表 + 配置 UI
├── /api/profiles         画像 CRUD
├── /api/accounts         平台账号登录态管理
├── /api/publish          多平台发布（小红书/抖音/快手/知乎/B站/视频号）
├── /api/calendar         内容日历
├── /api/materials        素材管理
├── /api/upload           附件上传（→ outputs/_inbox/<scope>/）
└── 静态文件              web/frontend/dist/（React 构建产物）
```

### Web 前端（`web/frontend/`，React 19 + Vite 8 + TypeScript 6）

```
React 19 + react-dom
├── App.tsx             主应用
├── components/         UI 组件
├── lib/api.ts          API 客户端
├── styles/             样式
└── marked + dompurify  Markdown 渲染 + XSS 防护
```

### 关键设计模式

| 模式 | 实现 | 作用 |
|---|---|---|
| **三入口统一** | `easel/persona.py` + `easel/timeouts.py` | CLI/Web/skill 三个入口共用画像注入和超时逻辑，行为一致 |
| **画像内联注入** | `persona_prefix()` | 不写全局 USER.md（避免并发竞态），每条消息前缀「我当前使用的画像是 X」 |
| **每轮行为提醒** | `TURN_REMINDER` | 抗长对话指令衰减，每轮末尾重申「先查技能库」 |
| **SKILL 三层加载** | metadata → instructions → resources | frontmatter 常驻路由，SKILL.md 触发时加载，references 按需读取，控制 token |
| **Profile 隔离** | `--profile easel` + `~/.openclaw-easel/` | 不影响用户本机 OpenClaw 配置 |
| **会话自愈** | `session_heal.py` | 每轮清洗无签名 thinking 块，防回放失效 |
| **SSE 真流式** | `OPENCLAW_RAW_STREAM=1` + tail jsonl | 绕过 openclaw CLI stdout 缓冲，逐 token 推送 |
| **产物项目化** | `outputs/<项目>/` | 内容/素材/中间文件/元数据按项目归档 |

---

## 二、可复用的通用技术架构

基于这套模式开发其他项目时，核心可复用的架构骨架：

```
your-project/
├── pyproject.toml          Python CLI + FastAPI 后端
├── setup.sh                一键安装（Node + OpenClaw + pip + 前端构建 + gateway）
├── .env.example            配置模板
│
├── your_cli/               ← CLI 层（argparse 子命令）
│   ├── cli.py              main() + 子命令分发
│   ├── persona.py          ★ 画像/上下文注入（三入口单一真相源）
│   ├── timeouts.py         ★ 超时常量（三入口单一真相源）
│   └── commands/
│       ├── chat.py         交互对话
│       ├── web.py          启动 Web UI
│       ├── skill.py        运行单个能力
│       ├── doctor.py       环境检查
│       └── ping.py         连通性测试
│
├── web/                    ← Web 层
│   ├── app.py              FastAPI 后端（SSE 流式 + REST API）
│   └── frontend/           React + Vite + TypeScript
│       └── dist/           构建产物（FastAPI 直接 serve）
│
├── skills/                 ★ 能力层（核心可复用模式）
│   ├── openclaw/           原子能力（每个一个目录）
│   │   └── <skill>/
│   │       ├── SKILL.md    执行流程（< 200 行）
│   │       ├── references/ 领域知识（按需加载）
│   │       └── scripts/    可执行脚本
│   └── shared/             跨 SKILL 共享
│       ├── scripts/        公共工具脚本
│       └── references/     公共方法论
│
├── openclaw/               ← OpenClaw 集成层
│   ├── workspace/
│   │   ├── AGENTS.md       ★ 分工规则 + 编排逻辑（常驻 system prompt）
│   │   ├── SOUL.md         ★ 人格定义（常驻）
│   │   └── CONTEXT.md      sync.sh 自动生成
│   └── sync.sh             ★ 同步 skills + workspace 到隔离 profile
│
├── profiles/               ← 用户/账号画像（六维 .md 文件）
├── outputs/                ← 产物（按项目归档）
├── assets/                 ← 静态资源
└── scripts/                ← 运维脚本（gateway 管理/适配器/校验）
```

**复用要点**：

1. **OpenClaw 作为 Agent 运行时**——你只写 SKILL.md（流程）+ scripts（工具），Agent 编排由 OpenClaw 完成
2. **SKILL 三层加载机制**——metadata 路由 / instructions 触发 / resources 按需，token 高效
3. **Prompt Stack 四层**——SOUL（人格）+ AGENTS（规则）+ CONTEXT（路径）+ SKILL（按需）
4. **三入口统一**——CLI/Web/skill 共用 persona + timeouts，避免逻辑分裂
5. **文件系统即数据库**——产物/画像/会话全落文件，无 DB 依赖，简单可移植

---

## 三、需要配置的 Key 说明

### 必填（最小可用配置）

| Key | 作用 | 说明 |
|---|---|---|
| `ANTHROPIC_API_KEY` | **主 LLM**（Claude） | Agent 的核心大脑，所有对话/skill 执行都靠它。填 `sk-ant-...` |
| `CLAUDE_MODEL` | 主 LLM 模型名 | OpenClaw provider/model 格式，默认 `anthropic/claude-sonnet-4-6` |

> **替代方案**（三选一，不填 Anthropic 官方 Key 时）：
> - `EASEL_LLM_API_KEY` + `EASEL_LLM_BASE_URL` + `EASEL_LLM_API_KEY_HEADER`：走 Anthropic 兼容的第三方 MaaS
> - `OPENAI_MAAS_API_KEY` + `OPENAI_MAAS_ENDPOINT` + `OPENAI_MAAS_MODEL`：走 OpenAI 兼容服务（经本地适配器 `:18791`）
> - `GEMINI_MAAS_API_KEY` + `GEMINI_MAAS_ENDPOINT` + `GEMINI_MAAS_MODEL`：走 Gemini 兼容服务（经本地适配器 `:18790`）

### 可选——按需配置（不配不影响聊天/策划/文本创作）

#### AI 视频（`VIDEO_PROVIDER=` 选其一）

| Provider | 名称 | 需要的 Key |
|---|---|---|
| dashscope | 阿里通义万相 Wan | `DASHSCOPE_API_KEY` |
| ark | 火山引擎 Seedance | `ARK_API_KEY` |
| kling | 快手可灵 | `KLING_ACCESS_KEY` + `KLING_SECRET_KEY` |
| openai-compatible | OpenAI 兼容 | `VIDEO_API_KEY` + `VIDEO_BASE_URL` + `VIDEO_MODEL` |
| xhs-maas | 小红书 MaaS | `XHS_MAAS_API_KEY` |
| agnes | Agnes Video | `AGNES_API_KEY` |

#### AI 音乐（`MUSIC_PROVIDER=` 选其一）

| Provider | 名称 | 需要的 Key |
|---|---|---|
| dashscope | 阿里 DashScope | `DASHSCOPE_API_KEY` |
| suno-compatible | Suno 类 | `MUSIC_API_KEY` + `MUSIC_BASE_URL` |

#### 云端配音/TTS（`VOICE_PROVIDER=` 选其一）

| Provider | 名称 | 需要的 Key |
|---|---|---|
| dashscope | 阿里 CosyVoice | `DASHSCOPE_API_KEY` |
| minimax | MiniMax | `MINIMAX_API_KEY` + `MINIMAX_GROUP_ID` |
| fish-audio | Fish Audio | `FISH_API_KEY` |
| openai-compatible | OpenAI 兼容 | `VOICE_API_KEY` + `VOICE_BASE_URL` + `VOICE_MODEL` |
| gemini | Google Gemini TTS | `GEMINI_API_KEY` |

#### AI 生图

| 需要的 Key | 说明 |
|---|---|
| `IMG_API_KEY` + `IMG_BASE_URL` + `IMG_MODEL` | OpenAI 兼容生图 API |

#### 浏览器发布

无需 Key，在 Web「账号」页登录目标平台。需要安装可选依赖：
```bash
pip install -e ".[media]"
playwright install chromium
```

### 其他环境变量

| Key | 作用 | 默认 |
|---|---|---|
| `OPENCLAW_PORT` | Gateway 端口 | 18789 |
| `EASEL_PROXY` | 外网代理（公司开发机用） | 无 |
| `EASEL_THINKING_LEVEL` | 思考档位（off/low/high） | low |
| `EASEL_PORT` | Web UI 端口 | 7860 |

### 最小行动

只需在 `.env` 里填一个 Key 即可跑起：

```bash
# 编辑 .env
ANTHROPIC_API_KEY=sk-ant-你的真实Key
```

填完后同步到 OpenClaw：
```bash
openclaw --profile easel config set models.providers.anthropic.apiKey "sk-ant-你的真实Key"
```

媒体能力（视频/音乐/配音/生图）全部按需配置，不配的话聊天、策划、文案创作、小红书笔记等文本类功能完全不受影响。多个媒体能力可以复用同一个 `DASHSCOPE_API_KEY`（阿里云一站式）。
