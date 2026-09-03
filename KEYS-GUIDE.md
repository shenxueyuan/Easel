# Easel 全部 Key 配置指南

> 每项都包含：用途、需要的环境变量、注册地址、获取步骤。
> **最小起步只需第一项（ANTHROPIC_API_KEY）**，其余按需配置。

---

## 一、必填：主 LLM（Agent 大脑）

Agent 的核心对话/编排能力，所有功能的基础。

### 方式 1：Anthropic 官方（默认推荐）

| 项 | 内容 |
|---|---|
| 环境变量 | `ANTHROPIC_API_KEY=sk-ant-...` |
| 模型变量 | `CLAUDE_MODEL=anthropic/claude-sonnet-4-6`（默认值，一般不用改） |
| 注册地址 | https://console.anthropic.com/ |
| API Key 页面 | https://platform.claude.com/settings/keys |
| 官方文档 | https://docs.anthropic.com/ |
| 定价 | https://www.anthropic.com/pricing |

**获取步骤**：
1. 前往 https://console.anthropic.com/ 注册账号（验证邮箱 + 手机号）
2. 登录后进入 Settings → API Keys
3. 点击 **Create Key**，命名后复制以 `sk-ant-` 开头的完整 Key（**只显示一次**）
4. 建议在控制台设置用量/成本预警

**填入 Easel**：
```bash
# .env
ANTHROPIC_API_KEY=sk-ant-你的真实Key
```
```bash
# 同步到 OpenClaw
openclaw --profile easel config set models.providers.anthropic.apiKey "sk-ant-你的真实Key"
```

> **国内无法直连？** 用方式 2/3/4 走兼容服务，或用第三方 Anthropic 中转。

---

### 方式 2：Anthropic 兼容 MaaS（第三方中转）

| 项 | 内容 |
|---|---|
| 环境变量 | `EASEL_LLM_API_KEY` + `EASEL_LLM_BASE_URL` + `EASEL_LLM_API_KEY_HEADER` |
| 可选 | `EASEL_LLM_ANTHROPIC_VERSION=2023-06-01` |
| 注册地址 | 取决于你用的第三方中转服务商 |

**获取步骤**：
1. 找一个 Anthropic 兼容的第三方 MaaS 服务商
2. 注册并获取 API Key、Base URL、鉴权头名
3. 填入 `.env`：
```bash
EASEL_LLM_API_KEY=你的Key
EASEL_LLM_BASE_URL=https://your-provider.example/v1
EASEL_LLM_API_KEY_HEADER=api-key
```

---

### 方式 3：OpenAI 兼容 MaaS（经本地适配器 :18791）

| 项 | 内容 |
|---|---|
| 环境变量 | `OPENAI_MAAS_API_KEY` + `OPENAI_MAAS_ENDPOINT` + `OPENAI_MAAS_MODEL` |
| 可选 | `OPENAI_MAAS_ADAPTER_PORT=18791` |
| 适配器 | `scripts/openai_maas_adapter.py`（setup.sh 自动配置） |

**获取步骤**：
1. 找一个 OpenAI 兼容的 LLM 服务商（如 OpenAI 官方、各类中转平台）
2. 注册获取 API Key 和 Endpoint
3. 填入 `.env`：
```bash
OPENAI_MAAS_API_KEY=sk-...
OPENAI_MAAS_ENDPOINT=https://api.openai.com/v1   # 或你的中转地址
OPENAI_MAAS_MODEL=gpt-4o
```

> **OpenAI 官方注册**：https://platform.openai.com/ → 注册 → API Keys → Create new secret key → 充值（最低 $5）

---

### 方式 4：Gemini 兼容 MaaS（经本地适配器 :18790）

| 项 | 内容 |
|---|---|
| 环境变量 | `GEMINI_MAAS_API_KEY` + `GEMINI_MAAS_ENDPOINT` + `GEMINI_MAAS_MODEL` |
| 可选 | `GEMINI_ADAPTER_PORT=18790`、`GEMINI_THINKING_LEVEL=HIGH` |
| 适配器 | `scripts/gemini_maas_adapter.py`（setup.sh 自动配置） |

**获取步骤**：
1. 前往 Google AI Studio：https://aistudio.google.com/
2. 登录 Google 账号，接受服务条款后自动创建默认项目和 API Key
3. 或手动：Dashboard → API Keys → Create API Key
4. 填入 `.env`：
```bash
GEMINI_MAAS_API_KEY=AIza...
GEMINI_MAAS_ENDPOINT=https://generativelanguage.googleapis.com/v1beta
GEMINI_MAAS_MODEL=gemini-3.1-pro-preview
```

---

## 二、可选：AI 视频生成

> 在 `.env` 中设 `VIDEO_PROVIDER=` 选择一个 provider，然后填对应 Key。
> 不配不影响聊天/策划/文案等文本功能。

### Provider 1：dashscope（阿里通义万相 Wan）⭐ 一个 Key 搞定视频+音乐+配音

| 项 | 内容 |
|---|---|
| 环境变量 | `DASHSCOPE_API_KEY` + `VIDEO_PROVIDER=dashscope` |
| 可选 | `DASHSCOPE_VIDEO_MODEL`、`DASHSCOPE_BASE_URL` |
| 注册地址 | https://bailian.console.aliyun.com/ |
| 密钥管理 | https://bailian.console.aliyun.com/?apiKey=1 |

**获取步骤**：
1. 前往 https://bailian.console.aliyun.com/ 登录阿里云账号（需实名认证）
2. 开通百炼服务（首次进入会提示开通）
3. 右上角选择地域（华北2-北京 / 新加坡 / 中国香港等）
4. 进入「API Key 管理」→ 点击「创建 API Key」
5. 选择归属账号和业务空间（默认业务空间可调用所有标准模型）
6. 复制完整 Key（**只显示一次**）

```bash
# .env
DASHSCOPE_API_KEY=sk-...
VIDEO_PROVIDER=dashscope
```

---

### Provider 2：ark（火山引擎 Seedance）

| 项 | 内容 |
|---|---|
| 环境变量 | `ARK_API_KEY` + `VIDEO_PROVIDER=ark` |
| 可选 | `ARK_MODEL`、`ARK_BASE_URL` |
| 别名 | `VOLCENGINE_API_KEY`、`VOLC_ARK_API_KEY` |
| 注册地址 | https://console.volcengine.com/ |
| 方舟平台 | https://console.volcengine.com/ark |

**获取步骤**：
1. 前往 https://console.volcengine.com/ 注册火山引擎账号（实名认证）
2. 进入「火山方舟」大模型服务平台
3. 创建应用，申请 API 调用权限
4. 在「API Key 管理」获取密钥
5. 视频模型需额外申请 Seedance 权限（审核 1-3 工作日）

```bash
# .env
ARK_API_KEY=...
VIDEO_PROVIDER=ark
```

---

### Provider 3：kling（快手可灵）

| 项 | 内容 |
|---|---|
| 环境变量 | `KLING_ACCESS_KEY` + `KLING_SECRET_KEY` + `VIDEO_PROVIDER=kling` |
| 可选 | `KLING_BASE_URL` |
| 开放平台 | https://klingai.com/ |
| 文档 | https://klingai.com/document-api/ |

**获取步骤**：
1. 前往 https://klingai.com/ 注册账号
2. 进入开放平台，完成开发者认证（个人实名或企业认证）
3. 创建应用，选择「可灵 AI 视频生成」功能，提交申请（审核 1-3 工作日）
4. 审核通过后在「密钥管理」获取 Access Key 和 Secret Key

```bash
# .env
KLING_ACCESS_KEY=...
KLING_SECRET_KEY=...
VIDEO_PROVIDER=kling
```

---

### Provider 4：openai-compatible（OpenAI 兼容视频 API）

| 项 | 内容 |
|---|---|
| 环境变量 | `VIDEO_API_KEY` + `VIDEO_BASE_URL` + `VIDEO_PROVIDER=openai-compatible` |
| 可选 | `VIDEO_MODEL` |
| 别名 | `OPENAI_API_KEY`、`API_KEY`、`OPENAI_BASE_URL`、`BASE_URL` |

**获取步骤**：
1. 找一个提供 `/videos` 接口的 OpenAI 兼容视频服务
2. 注册获取 API Key 和 Base URL
3. 填入 `.env`：
```bash
VIDEO_API_KEY=sk-...
VIDEO_BASE_URL=https://your-video-api.example/v1
VIDEO_MODEL=your-video-model
VIDEO_PROVIDER=openai-compatible
```

---

### Provider 5：xhs-maas（小红书 MaaS）

| 项 | 内容 |
|---|---|
| 环境变量 | `XHS_MAAS_API_KEY` + `VIDEO_PROVIDER=xhs-maas` |
| 可选 | `XHS_MAAS_VIDEO_BASE`、`XHS_MAAS_T2V_MODEL`、`XHS_MAAS_I2V_MODEL`、`XHS_MAAS_RESOLUTION` |
| 适用 | 小红书内部团队 |

> 仅小红书内部可用，外部用户无法注册。

---

### Provider 6：agnes（Agnes Video）

| 项 | 内容 |
|---|---|
| 环境变量 | `AGNES_API_KEY` + `VIDEO_PROVIDER=agnes` |
| 可选 | `AGNES_BASE_URL`、`AGNES_POLL_BASE`、`AGNES_MODEL`、`AGNES_SIZE` |
| 默认模型 | `agnes-video-2.5-flash` |
| 注册地址 | https://www.agnes-ai.com/ |
| 文档 | https://www.agnes-ai.com/zh-Hans/docs/overview |
| Base URL | `https://apihub.agnes-ai.com/v1` |

**获取步骤**：
1. 前往 https://www.agnes-ai.com/ 注册账号
2. 登录控制台，进入 API Key 管理页面
3. 创建并复制 API Key
4. 填入 `.env`：
```bash
AGNES_API_KEY=...
VIDEO_PROVIDER=agnes
```

---

## 三、可选：AI 音乐 / BGM

> 在 `.env` 中设 `MUSIC_PROVIDER=` 选择一个 provider。

### Provider 1：dashscope（阿里 DashScope）⭐ 复用视频的同一个 Key

| 项 | 内容 |
|---|---|
| 环境变量 | `DASHSCOPE_API_KEY` + `MUSIC_PROVIDER=dashscope` |
| 可选 | `DASHSCOPE_MUSIC_MODEL`、`DASHSCOPE_BASE_URL` |
| 注册 | 同上方「阿里 DashScope」 |

```bash
# .env（如果已配视频的 DASHSCOPE_API_KEY，只需加一行）
MUSIC_PROVIDER=dashscope
```

---

### Provider 2：suno-compatible（Suno 类第三方 API）

| 项 | 内容 |
|---|---|
| 环境变量 | `MUSIC_API_KEY` + `MUSIC_BASE_URL` + `MUSIC_PROVIDER=suno-compatible` |
| 可选 | `MUSIC_MODEL` |
| 别名 | `SUNO_API_KEY`、`API_KEY`、`SUNO_BASE_URL`、`BASE_URL` |
| 第三方平台示例 | https://sunoapi.org/ |
| 密钥管理 | https://sunoapi.org/api-key |

**获取步骤**：
1. 前往 Suno 兼容 API 平台注册账号
2. 进入「API 密钥管理」页面
3. 点击「创建新 API 密钥」，获取 access_key
4. 填入 `.env`：
```bash
MUSIC_API_KEY=...
MUSIC_BASE_URL=https://api.sunoapi.org/api/v1
MUSIC_PROVIDER=suno-compatible
```

> Suno 官方本身不直接开放 API，这里用的是第三方兼容平台。

---

## 四、可选：云端配音 / TTS / 声音克隆

> 在 `.env` 中设 `VOICE_PROVIDER=` 选择一个 provider。

### Provider 1：dashscope（阿里 CosyVoice）⭐ 复用同一个 Key

| 项 | 内容 |
|---|---|
| 环境变量 | `DASHSCOPE_API_KEY` + `VOICE_PROVIDER=dashscope` |
| 可选 | `DASHSCOPE_TTS_MODEL`、`DASHSCOPE_BASE_URL`、`VOICE_NARRATOR_VOICE_ID` |
| 注册 | 同上方「阿里 DashScope」 |

```bash
# .env
VOICE_PROVIDER=dashscope
```

---

### Provider 2：minimax（MiniMax）

| 项 | 内容 |
|---|---|
| 环境变量 | `MINIMAX_API_KEY` + `MINIMAX_GROUP_ID` + `VOICE_PROVIDER=minimax` |
| 可选 | `MINIMAX_MODEL`、`MINIMAX_BASE_URL`、`VOICE_NARRATOR_VOICE_ID` |
| 注册地址 | https://platform.minimaxi.com/ |
| 文档 | https://platform.minimaxi.com/docs/guides/quickstart-preparation |

**获取步骤**：
1. 前往 https://platform.minimaxi.com/ 注册账号
2. 登录后进入「接口密钥」→「创建新的 API Key」
3. 在「账户管理」获取 Group ID
4. 填入 `.env`：
```bash
MINIMAX_API_KEY=...
MINIMAX_GROUP_ID=...
VOICE_PROVIDER=minimax
```

---

### Provider 3：fish-audio（Fish Audio）

| 项 | 内容 |
|---|---|
| 环境变量 | `FISH_API_KEY` + `VOICE_PROVIDER=fish-audio` |
| 可选 | `FISH_BASE_URL`、`VOICE_NARRATOR_VOICE_ID` |
| 注册地址 | https://fish.audio/auth/signup |
| 控制台 | https://fish.audio/ |
| 文档 | https://docs.fish.audio/developer-guide/getting-started/quickstart |

**获取步骤**：
1. 前往 https://fish.audio/auth/signup 注册账号
2. 登录后进入 Dashboard → API Keys
3. 点击「Create New Key」，命名并复制 Key
4. 填入 `.env`：
```bash
FISH_API_KEY=...
VOICE_PROVIDER=fish-audio
```

---

### Provider 4：openai-compatible（OpenAI 兼容 TTS）

| 项 | 内容 |
|---|---|
| 环境变量 | `VOICE_API_KEY` + `VOICE_BASE_URL` + `VOICE_PROVIDER=openai-compatible` |
| 可选 | `VOICE_MODEL`、`VOICE_INSTRUCT_MODE`、`VOICE_INSTRUCT_DELIM`、`VOICE_NARRATOR_VOICE_ID` |
| 别名 | `OPENAI_API_KEY`、`API_KEY`、`OPENAI_BASE_URL`、`BASE_URL` |
| OpenAI 注册 | https://platform.openai.com/ |

**获取步骤**：
1. 在 OpenAI 或任意兼容 `/audio/speech` 接口的服务商注册
2. 获取 API Key 和 Base URL
3. 填入 `.env`：
```bash
VOICE_API_KEY=sk-...
VOICE_BASE_URL=https://api.openai.com/v1
VOICE_MODEL=tts-1
VOICE_PROVIDER=openai-compatible
```

---

### Provider 5：gemini（Google Gemini TTS）

| 项 | 内容 |
|---|---|
| 环境变量 | `GEMINI_API_KEY` + `VOICE_PROVIDER=gemini` |
| 可选 | `GEMINI_TTS_MODEL=gemini-2.5-flash-preview-tts`、`GEMINI_VOICE`、`GEMINI_BASE_URL`、`GEMINI_TTS_RATE` |
| 别名 | `GOOGLE_API_KEY`、`GOOGLE_GENAI_API_KEY` |
| 注册地址 | https://aistudio.google.com/ |

**获取步骤**：
1. 前往 https://aistudio.google.com/ 登录 Google 账号
2. 接受服务条款后自动创建默认项目和 API Key
3. 或手动：Dashboard → API Keys → Create API Key
4. 填入 `.env`：
```bash
GEMINI_API_KEY=AIza...
VOICE_PROVIDER=gemini
```

---

## 五、可选：AI 生图

> 无 provider 选择，统一用 OpenAI 兼容接口。

| 项 | 内容 |
|---|---|
| 环境变量 | `IMG_API_KEY` + `IMG_BASE_URL` + `IMG_MODEL` |
| 可选 | `IMG_API_KEY_HEADER`、`IMG_API_VERSION`、`IMG_NO_PROXY` |
| 别名 | `OPENAI_API_KEY`、`API_KEY`、`OPENAI_BASE_URL`、`BASE_URL` |
| OpenAI 注册 | https://platform.openai.com/ |

**获取步骤**：
1. 在 OpenAI 或任意兼容 `/images/generations` 接口的服务商注册
2. 获取 API Key 和 Base URL
3. 填入 `.env`：
```bash
IMG_API_KEY=sk-...
IMG_BASE_URL=https://api.openai.com/v1
IMG_MODEL=dall-e-3
```

---

## 六、其他环境变量（非 Key）

| 变量 | 作用 | 默认值 |
|---|---|---|
| `OPENCLAW_PORT` | Gateway 端口 | 18789 |
| `EASEL_PORT` | Web UI 端口 | 7860 |
| `EASEL_PROXY` | 外网代理（公司开发机用） | 无 |
| `EASEL_THINKING_LEVEL` | 思考档位（off/low/high） | low |
| `VIDEO_CAPABILITIES_JSON` | 视频模型能力覆盖 JSON | 无 |
| `VOICE_NARRATOR_VOICE_ID` | 默认旁白 voice-id | 无 |

---

## 七、浏览器发布（无需 Key）

在 Web 工作台「账号」页面直接登录目标平台即可。

支持平台：小红书、抖音、快手、知乎、B站、微信视频号。

需要安装可选依赖：
```bash
pip install -e ".[media]"
playwright install chromium
# 系统还需要 ffmpeg
```

---

## 八、Key 分类总览：必填 / 可选 / 几选一

### 必填（1 个，缺了完全不能用）

| Key | 用途 | 说明 |
|---|---|---|
| `ANTHROPIC_API_KEY` | Agent 大脑（LLM） | 所有对话/skill 执行的基础，无替代则系统无法运行 |

### 几选一（必填的 LLM，4 条路径任选其一）

| 路径 | 需要的 Key | 适合谁 |
|---|---|---|
| Anthropic 官方 | `ANTHROPIC_API_KEY` | 海外用户 / 有代理 / 追求最佳效果 |
| Anthropic 兼容 MaaS | `EASEL_LLM_API_KEY` + `BASE_URL` + `HEADER` | 国内中转 / 企业内网 |
| OpenAI 兼容 MaaS | `OPENAI_MAAS_API_KEY` + `ENDPOINT` + `MODEL` | 已有 OpenAI Key / 想用 GPT 系列 |
| Gemini 兼容 MaaS | `GEMINI_MAAS_API_KEY` + `ENDPOINT` + `MODEL` | 想用 Gemini / 有 Google 账号 |

> 以上 4 条**只需选 1 条**。默认推荐 Anthropic 官方。

### 可选——AI 视频（6 选 1，按 `VIDEO_PROVIDER` 切换）

| Provider | Key | 适合谁 |
|---|---|---|
| **dashscope** | `DASHSCOPE_API_KEY` | ⭐ 国内首选，性价比最高，一个 Key 搞定视频+音乐+配音 |
| ark | `ARK_API_KEY` | 字节生态用户，Seedance 质量好 |
| kling | `KLING_ACCESS_KEY` + `KLING_SECRET_KEY` | 追求 4K 高质量视频 |
| openai-compatible | `VIDEO_API_KEY` + `VIDEO_BASE_URL` | 已有 OpenAI 兼容视频服务 |
| xhs-maas | `XHS_MAAS_API_KEY` | 仅小红书内部 |
| agnes | `AGNES_API_KEY` | 海外用户，Agnes Video 2.5 |

### 可选——AI 音乐（2 选 1，按 `MUSIC_PROVIDER` 切换）

| Provider | Key | 适合谁 |
|---|---|---|
| **dashscope** | `DASHSCOPE_API_KEY` | ⭐ 复用视频的同一个 Key |
| suno-compatible | `MUSIC_API_KEY` + `MUSIC_BASE_URL` | 想用 Suno 系音乐生成 |

### 可选——云端配音/TTS（5 选 1，按 `VOICE_PROVIDER` 切换）

| Provider | Key | 适合谁 |
|---|---|---|
| **dashscope** | `DASHSCOPE_API_KEY` | ⭐ 复用同一个 Key，CosyVoice 中文效果好 |
| minimax | `MINIMAX_API_KEY` + `MINIMAX_GROUP_ID` | 追求高质量多角色配音 |
| fish-audio | `FISH_API_KEY` | 需要声音克隆 |
| openai-compatible | `VOICE_API_KEY` + `VOICE_BASE_URL` | 已有 OpenAI Key |
| gemini | `GEMINI_API_KEY` | 有 Google 账号，想免费试用 |

### 可选——AI 生图（无几选一，统一 OpenAI 兼容接口）

| Key | 适合谁 |
|---|---|
| `IMG_API_KEY` + `IMG_BASE_URL` + `IMG_MODEL` | 需要 AI 生图能力时配置 |

### 不需要 Key

| 能力 | 说明 |
|---|---|
| 浏览器发布 | Web「账号」页扫码登录目标平台即可 |
| 本地图片处理 | 去背景/增强/批处理（需 `pip install -e ".[media]"`） |
| 本地音视频处理 | 剪辑/转码/字幕（需 ffmpeg + `pip install -e ".[media]"`） |

---

## 九、最佳搭配方案

### 方案 A：最小起步（1 个 Key）

```
ANTHROPIC_API_KEY
```

**能做什么**：聊天、热点发现、选题策划、文案写作、小红书笔记策划、内容日历、发布编排、归因分析
**不能做**：AI 生视频/音乐/配音/生图（但可用本地工具处理已有素材）
**月成本**：按实际 token 用量，轻度使用约 $5-20

### 方案 B：国内性价比之王（2 个 Key）⭐ 推荐

```
ANTHROPIC_API_KEY       ← 大脑
DASHSCOPE_API_KEY       ← 视频 + 音乐 + 配音 三合一
```

**能做什么**：方案 A 全部 + AI 视频（通义万相）+ AI 音乐 + AI 配音（CosyVoice）
**不能做**：AI 生图（需另配 `IMG_API_KEY`）
**月成本**：轻度使用约 ¥50-150（LLM）+ ¥10-50（媒体生成）

### 方案 C：全能力覆盖（3 个 Key）

```
ANTHROPIC_API_KEY       ← 大脑
DASHSCOPE_API_KEY       ← 视频 + 音乐 + 配音
IMG_API_KEY             ← AI 生图（OpenAI DALL-E 或兼容服务）
```

**能做什么**：所有 AI 能力 + 所有文本/策划/发布/归因
**月成本**：轻度使用约 ¥50-150 + ¥10-50 + ¥5-30（生图）

### 方案 D：纯国内方案（无海外 Key）

```
EASEL_LLM_API_KEY       ← 国内 Anthropic 兼容中转（大脑）
DASHSCOPE_API_KEY       ← 视频 + 音乐 + 配音
IMG_API_KEY             ← 国内 OpenAI 兼容生图服务
```

**适合**：无法访问海外服务的国内环境
**月成本**：取决于中转服务商定价

### 方案 E：高质量视频专精

```
ANTHROPIC_API_KEY       ← 大脑
KLING_ACCESS_KEY + KLING_SECRET_KEY   ← 快手可灵 4K 视频
DASHSCOPE_API_KEY       ← 音乐 + 配音（可灵只做视频）
```

**适合**：对视频质量要求极高的场景
**月成本**：较高，可灵 4K 约 $0.42/秒

---

## 十、各平台费用详解

### 1. Anthropic Claude（主 LLM）

| 模型 | 输入（$/百万 token） | 输出（$/百万 token） | 说明 |
|---|---|---|---|
| Claude Sonnet 5 | $2.00（限时）→ $3.00 | $10.00→$15.00 | ⭐ 性价比首选，Easel 默认 |
| Claude Sonnet 4.6 | $3.00 | $15.00 | 当前 Easel 默认模型 |
| Claude Opus 5 | $5.00 | $25.00 | 最强能力，成本高 5 倍 |
| Claude Haiku 4.5 | $1.00 | $5.00 | 最便宜，适合高频轻量任务 |

**预估月费**：
- 轻度使用（每天几轮对话）：$5-20
- 中度使用（每天策划+创作几条内容）：$20-80
- 重度使用（全天候多账号运营）：$80-300+

> 注册地址：https://console.anthropic.com/

---

### 2. 阿里云 DashScope（视频+音乐+配音三合一）⭐

**一个 Key 三项能力，按量计费，失败不计费**

#### AI 视频（通义万相 Wan）

| 模型 | 分辨率 | 计费方式 |
|---|---|---|
| wan3.0-video | 480P/720P/1080P | 按生成秒数计费 |
| wan3.0-video-prime | 同上（高速版） | 按生成秒数计费 |

- 支持最长 30 秒，按成功生成的秒数计费
- 输入不计费，仅输出计费
- 有免费额度（开通后有限免费次数）
- 阿里云百炼新用户通常有免费试用额度

#### AI 配音（CosyVoice）

| 模型 | 计费方式 |
|---|---|
| cosyvoice-v3.5-plus | 按字符计费 |
| cosyvoice-v3.5-flash | 按字符计费（更便宜） |
| cosyvoice-v3-plus/flash | 按字符计费 |

- 创建音色免费（CosyVoice）
- 有免费额度（北京地域）

#### AI 音乐

- DashScope 音乐模型，按次或按时长计费
- 复用同一 `DASHSCOPE_API_KEY`

**预估月费**：
- 轻度（偶尔生视频/配音）：¥10-50
- 中度（每周几个视频）：¥50-200
- 重度（每天多个视频）：¥200-1000+

> 注册地址：https://bailian.console.aliyun.com/

---

### 3. 火山引擎 Seedance（视频）

| 模式 | 价格 | 说明 |
|---|---|---|
| 纯生成（无视频输入） | 46 元/百万 tokens | 约 **1 元/秒** |
| 视频编辑（含视频输入） | 28 元/百万 tokens | 约 **0.6 元/秒** |

- 15 秒视频约 30.888 万 tokens，纯生成约 15 元
- 包年包月可享 10%-30% 折扣

**预估月费**：生成 10 个 15 秒视频 ≈ ¥150

> 注册地址：https://console.volcengine.com/

---

### 4. 快手可灵 Kling（视频）

| 分辨率 | 价格（$/秒） | 说明 |
|---|---|---|
| 720P 标准模式 | $0.0756 | 基础文生视频 |
| 1080P 专业模式 | $0.1008 | 高清 |
| 4K 超高清 | $0.48213 | 广播级 |
| 720P 有声 | $0.1134 | 含原生音频 |
| 1080P 有声 | $0.1512 | 含原生音频 |

- 试用套餐 $9.80 起（100 单位）
- 生产套餐 $700 起（5000 单位）
- 单次生成 3-15 秒

**预估月费**：10 个 5 秒 720P 视频 ≈ $3.78（约 ¥27）

> 注册地址：https://klingai.com/

---

### 5. MiniMax（配音）

| 模型 | 价格 | 说明 |
|---|---|---|
| speech-2.8-turbo | ¥2/万字符 | 标准质量 |
| speech-2.8-hd | ¥3.5/万字符 | 高质量 |
| 音色快速复刻 | ¥1.5/个 | 声音克隆 |
| 音色设计 | ¥3/个 | 自定义音色 |

**预估月费**：配音 1 万字符 ≈ ¥2-3.5

> 注册地址：https://platform.minimaxi.com/

---

### 6. Fish Audio（配音/声音克隆）

| 模型 | 价格 | 说明 |
|---|---|---|
| s2.1-pro | $15/百万 UTF-8 字节 | 高质量 |
| s2.1-pro-free | $0 | 免费版（有限制） |

- 1 百万 UTF-8 字节 ≈ 18 万英文单词 ≈ 12 小时语音
- 按量付费，无订阅费

**预估月费**：轻度使用约 $1-5

> 注册地址：https://fish.audio/auth/signup

---

### 7. Google Gemini（配音/LLM）

| 能力 | 免费额度 | 付费价格 |
|---|---|---|
| Gemini API（LLM） | 有（有限） | 输入 $1.50/百万 token，输出 $7.50/百万 token |
| Gemini TTS | 有（有限） | 约 $0.0315/分钟（音频输出） |

- **有免费额度**，适合试用
- QPM 限制：Flash TTS 150 次/分钟，Pro TTS 125 次/分钟

**预估月费**：轻度使用可走免费额度，超出后约 $1-10

> 注册地址：https://aistudio.google.com/

---

### 8. OpenAI（生图/配音/LLM）

#### AI 生图

| 模型 | 质量 | 价格（$/张） |
|---|---|---|
| GPT Image 1 | 低 | $0.011 |
| GPT Image 1 | 中 | $0.042 |
| GPT Image 1 | 高 | $0.167 |
| GPT Image 1 Mini | 低 | $0.005 |
| DALL-E 3 | 标准 | $0.04 |
| DALL-E 3 | 高清 | $0.08 |

#### TTS 配音

| 模型 | 价格 |
|---|---|
| TTS | $15/百万字符 |
| TTS HD | $30/百万字符 |
| gpt-4o-mini-tts | $0.015/分钟 |

**预估月费**：生图 100 张 ≈ $1-17（看质量），配音轻度约 $1-5

> 注册地址：https://platform.openai.com/

---

### 9. Suno 兼容（音乐）

| 模型 | 价格（$/首） |
|---|---|
| suno-v5 | $0.12 |
| suno-v5.5 | $0.12 |
| suno-v4.5 | $0.118 |

- 每次调用生成 2 首曲目
- 失败不计费

**预估月费**：生成 10 首音乐 ≈ $1.2

> 第三方平台示例：https://sunoapi.org/

---

### 10. Agnes Video（视频）

| 模型 | 价格 |
|---|---|
| agnes-video-2.5 | 720P 约 $0.025/秒 |

- 支持文生视频/图生视频/关键帧动画
- 单次 4-12 秒

**预估月费**：10 个 5 秒视频 ≈ $1.25

> 注册地址：https://www.agnes-ai.com/

---

## 十一、费用对比速查表

| 能力 | 最便宜方案 | 中等方案 | 高质量方案 |
|---|---|---|---|
| **LLM 大脑** | Gemini 免费额度 / Haiku $1/$5 | Sonnet $3/$15 ⭐ | Opus $5/$25 |
| **AI 视频** | DashScope（有免费额度）⭐ | Seedance ¥1/秒 | 可灵 4K $0.48/秒 |
| **AI 音乐** | DashScope ⭐ | Suno $0.12/首 | — |
| **AI 配音** | Gemini 免费额度 | DashScope CosyVoice ⭐ | MiniMax HD ¥3.5/万字 |
| **AI 生图** | GPT Image 1 Mini $0.005/张 | DALL-E 3 $0.04/张 | GPT Image 1 高 $0.167/张 |

### 典型月费估算（轻度使用）

| 方案 | Key 数 | 月费估算 |
|---|---|---|
| 最小起步（仅聊天/文案） | 1 | $5-20（约 ¥35-140） |
| 国内性价比（+视频/音乐/配音） | 2 ⭐ | ¥50-200 |
| 全能力（+生图） | 3 | ¥60-230 |
| 高质量视频专精 | 3-4 | ¥200-500+ |

> ⭐ = 推荐方案。实际费用取决于使用频率和生成内容量。

---

## 十二、视频生成效果与价格排名

### 1. 效果排名（综合真实度/物理/运镜/音画）

| 排名 | 模型 | 效果特点 | 最擅长 | 短板 |
|---|---|---|---|---|
| 🥇 1 | **Sora 2**（OpenAI） | 真实度断档领先，物理逻辑最强 | 看起来像实拍、物体运动、自然现象 | 成功率下降（40+ 条未必出 1 条），不支持人像参考锁定，**API 2026-09-24 关闭** |
| 🥈 2 | **Seedance 2.0**（字节） | 导演思维，分镜调度最强，中文提示词友好 | 精确运镜控制、中文电商/服装、声画一体 | 细节稳定性一般，表情容易过猛，需抽卡 |
| 🥉 3 | **Kling 3.0**（快手） | 人物肢体动作和物理互动极致，中文剧情首选 | 复杂人物动作、日常物理互动、4K 输出 | 抽象/西方文化提示词理解偏差 |
| 4 | **Wan 3.0**（阿里通义万相） | 电影感强，多机位多分镜一次生成 | 品牌片、叙事片、企业定制、开源可私有部署 | 学习成本高，出片慢，不适合快速带货 |
| 5 | **Agnes Video 2.5** | OpenAI 兼容接口，720P，默认带原生音频 | 海外用户、轻量场景 | 质量中等，分辨率仅 720P |
| 6 | **xhs-maas**（小红书内部） | 小红书内网 MaaS | 仅小红书内部团队 | 外部不可用 |

> Google Veo 3.1 效果也很好（出单率最高、参考图锁定强），但 Easel 目前未集成。

### 2. 价格排名（从便宜到贵，按每秒计费）

| 排名 | 模型 | 价格 | 说明 |
|---|---|---|---|
| 🏆 1 | **Wan 3.0**（阿里） | **有免费额度**，按秒计费（具体单价见阿里云百炼控制台） | ⭐ 最便宜，失败不计费，新用户有免费试用 |
| 🥈 2 | **Agnes 2.5** | **$0.025/秒**（720P） | 海外便宜选项 |
| 🥉 3 | **Seedance 2.0** | **≈¥1/秒**（纯生成），≈¥0.6/秒（视频编辑） | 包年包月再打 7-9 折 |
| 4 | **Kling 3.0** | $0.076/秒（720P），$0.10/秒（1080P），$0.48/秒（4K） | 4K 贵 5 倍，但有试用套餐 $9.8 起 |
| 5 | **Sora 2** | $0.10/秒（720P），$0.30/秒（Pro 720P），$0.70/秒（Pro 1080P） | ⚠️ **API 2026-09-24 关闭**，Batch 半价 |
| — | **xhs-maas** | 内部定价 | 外部不可用 |

### 3. 性价比排名（效果 ÷ 价格）

| 排名 | 模型 | 性价比理由 |
|---|---|---|
| 🥇 1 | **Wan 3.0**（阿里）⭐ | 有免费额度 + 电影感质量 + 一个 Key 搞定视频/音乐/配音，国内直连无需代理 |
| 🥈 2 | **Seedance 2.0** | ¥1/秒买到导演级分镜调度，中文提示词最友好，电商/带货首选 |
| 🥉 3 | **Kling 3.0** | $0.076/秒买 4K 级人物动作，批量创作成本可控，试用 $9.8 起步低 |
| 4 | **Agnes 2.5** | $0.025/秒便宜但质量中等，海外用户备选 |
| 5 | **Sora 2** | 效果最好但太贵 + 成功率低（抽卡成本高）+ **即将关闭** |

### 4. 按场景推荐

| 你的场景 | 推荐模型 | 理由 |
|---|---|---|
| **国内社媒运营（小红书/抖音）** | Wan 3.0 ⭐ | 有免费额度、国内直连、一个 Key 三合一、电影感够用 |
| **电商/服装带货** | Seedance 2.0 | 中文提示词最友好、运镜控制精确、声画一体 |
| **人物动作/剧情短视频** | Kling 3.0 | 肢体动作和物理互动最强、4K 输出、中文剧情首选 |
| **追求最高真实度** | Sora 2 | 真实度天花板——但 **API 2026-09-24 关闭**，不建议新接入 |
| **海外用户/轻量需求** | Agnes 2.5 | 便宜、OpenAI 兼容接口、默认带音频 |
| **企业定制/私有部署** | Wan 3.0 | 开源可私有化部署、品牌元素植入、数据安全 |

### 5. Easel 中的配置方式

```bash
# .env 中选一个 VIDEO_PROVIDER

# 方案 1：阿里万相（推荐，性价比最高）
VIDEO_PROVIDER=dashscope
DASHSCOPE_API_KEY=sk-...

# 方案 2：火山 Seedance（电商带货首选）
VIDEO_PROVIDER=ark
ARK_API_KEY=...

# 方案 3：快手可灵（人物动作/4K）
VIDEO_PROVIDER=kling
KLING_ACCESS_KEY=...
KLING_SECRET_KEY=...

# 方案 4：Agnes（海外轻量）
VIDEO_PROVIDER=agnes
AGNES_API_KEY=...
```

> **一句话总结**：国内用户选 **Wan 3.0（阿里）**——有免费额度、质量够用、一个 Key 搞定三项能力；追求极致效果选 **Seedance 2.0** 或 **Kling 3.0**；**别选 Sora 2**（即将关闭）。

---

## 十三、最简注册方案：2 个账号全覆盖

不想注册 5-8 个平台？用聚合平台 + 阿里百炼，**只注册 2 个账号**就能覆盖 LLM + 视频 + 音乐 + 配音 + 生图 全部能力。

### 方案对比

| 方案 | 注册账号数 | 覆盖能力 | 月费 | 适合 |
|---|---|---|---|---|
| 全部直连官方 | 5-8 个 | 全部 | 最便宜 | 不怕麻烦的人 |
| OpenRouter + DashScope | 2 个 | LLM + 视频 + 音乐 + 配音 | ¥50-200 | 海外用户 |
| **硅基流动 + DashScope** ⭐⭐ | **2 个** | LLM + 生图 + 视频 + 音乐 + 配音 | ¥30-150 | **国内用户首选** |
| 硅基流动一个 Key | 1 个 | LLM + 生图 + TTS（视频待测） | ¥10-80 | 极简起步 |

> **国内用户最省事推荐**：硅基流动 + 阿里百炼，2 个账号全覆盖，国内直连无需代理。

---

### 账号 1：硅基流动 SiliconFlow（LLM + AI 生图 + TTS）

#### 注册步骤

1. **访问官网**
   - 中国站：https://siliconflow.cn/（国内用户首选，手机号注册）
   - 全球站：https://siliconflow.com/（国际用户）

2. **注册账号**
   - 点击右上角「注册」
   - 输入手机号 + 短信验证码（或 Google/GitHub OAuth 登录）
   - 设置密码（8-20 位，建议大小写字母+数字+特殊符号）
   - 勾选《用户协议》提交

3. **完成实名认证**（重要，解锁全部免费模型）
   - 登录后进入「账号设置」>「实名认证」
   - 提交身份证或护照信息
   - 认证通常即时完成

4. **领取新用户赠金**
   - 中国站新用户赠 ¥16
   - 全球站新用户赠 $1
   - 注册时确认活动仍在展示

5. **创建 API Key**
   - 进入控制台左侧「API 密钥」
   - 点击「新建 API 密钥」，填写描述名（如 `easel-llm`）
   - 复制生成的 `sk-xxxx` 格式密钥（**只显示一次，立即保存**）

#### 能力与价格

| 能力 | 模型示例 | 价格 | 说明 |
|---|---|---|---|
| **LLM 对话** | DeepSeek-V3 | ¥1-2/百万 token | 比 OpenAI 低 80% |
| | Qwen3.5-72B | ¥2-4/百万 token | 中文生成质量最优 |
| | DeepSeek-R1 | ¥4-8/百万 token | 深度推理 |
| | Qwen2.5-7B（免费） | ¥0 | 9B 以下永久免费 |
| **AI 生图** | FLUX.1-schnell | $0.0014/张 | 最便宜 |
| | Z-Image-Turbo | $0.005/张 | 性价比之选 |
| | FLUX.2 [pro] | $0.03/张 | 高质量 |
| | Qwen-Image | $0.02/张 | 中文友好 |
| **TTS 配音** | 硅基流动 TTS | 按字符计费 | OpenAI 兼容接口 |

> ⚠️ 硅基流动的视频生成接口是 `/video/submit`（自有格式），不是 OpenAI `/videos` 兼容格式，Easel 的 `openai-compatible` video provider 可能无法直接对接，需测试验证。

#### Easel 配置

```bash
# LLM 大脑
OPENAI_MAAS_API_KEY=sk-你的硅基流动Key
OPENAI_MAAS_ENDPOINT=https://api.siliconflow.cn/v1
OPENAI_MAAS_MODEL=deepseek-ai/DeepSeek-V3

# AI 生图（同一个 Key）
IMG_API_KEY=sk-同一个Key
IMG_BASE_URL=https://api.siliconflow.cn/v1
IMG_MODEL=black-forest-labs/FLUX.1-schnell

# TTS 配音（同一个 Key）
VOICE_PROVIDER=openai-compatible
VOICE_API_KEY=sk-同一个Key
VOICE_BASE_URL=https://api.siliconflow.cn/v1
```

> 想换 LLM 模型只改 `OPENAI_MAAS_MODEL`，比如 `qwen/Qwen3.5-72B`、`deepseek-ai/DeepSeek-R1`，Key 不用换。

---

### 账号 2：阿里云百炼 DashScope（视频 + 音乐 + 配音）

#### 注册步骤

1. **访问阿里云百炼**
   - 控制台：https://bailian.console.aliyun.com/
   - 用阿里云账号登录（没有就注册一个，需实名认证）

2. **开通百炼服务**
   - 首次进入会提示开通，点击同意即可
   - 开通免费，按量计费

3. **选择地域**
   - 右上角选择地域
   - 推荐：华北2-北京（功能最全，CosyVoice 仅北京地域）
   - 海外用户：新加坡 / 中国香港

4. **创建 API Key**
   - 进入「API Key 管理」
   - 点击「创建 API Key」
   - 选择归属账号和业务空间（默认业务空间可调用所有标准模型）
   - 复制完整 Key（**只显示一次**）

#### 能力与价格

| 能力 | 模型 | 计费方式 | 说明 |
|---|---|---|---|
| **AI 视频** | wan3.0-video | 按生成秒数 | 有免费额度，失败不计费 |
| | wan3.0-video-prime | 按生成秒数 | 高速版 |
| **AI 音乐** | DashScope 音乐模型 | 按次/时长 | 复用同一 Key |
| **AI 配音** | cosyvoice-v3.5-plus | 按字符 | 高质量 |
| | cosyvoice-v3.5-flash | 按字符 | 更便宜 |
| | cosyvoice-v3-plus/flash | 按字符 | 标准版 |
| **AI 生图** | 通义万相生图 | 按张 | 也可复用此 Key |

#### Easel 配置

```bash
# 媒体三合一
DASHSCOPE_API_KEY=sk-你的阿里云Key
VIDEO_PROVIDER=dashscope
MUSIC_PROVIDER=dashscope
VOICE_PROVIDER=dashscope
```

> 一个 `DASHSCOPE_API_KEY` 同时覆盖视频、音乐、配音三项能力。

---

### 完整 .env 配置模板（2 个 Key 全覆盖）

```dotenv
# ═══════════════════════════════════════════════
# Easel 最简配置：硅基流动 + 阿里百炼（2 个 Key 全覆盖）
# ═══════════════════════════════════════════════

# ── 账号 1：硅基流动（LLM + 生图 + TTS）──
# 注册：https://siliconflow.cn/
OPENAI_MAAS_API_KEY=sk-你的硅基流动Key
OPENAI_MAAS_ENDPOINT=https://api.siliconflow.cn/v1
OPENAI_MAAS_MODEL=deepseek-ai/DeepSeek-V3

IMG_API_KEY=sk-同一个硅基流动Key
IMG_BASE_URL=https://api.siliconflow.cn/v1
IMG_MODEL=black-forest-labs/FLUX.1-schnell

# ── 账号 2：阿里云百炼（视频 + 音乐 + 配音）──
# 注册：https://bailian.console.aliyun.com/
DASHSCOPE_API_KEY=sk-你的阿里云Key
VIDEO_PROVIDER=dashscope
MUSIC_PROVIDER=dashscope
VOICE_PROVIDER=dashscope

# ── 其他（可选）──
# EASEL_THINKING_LEVEL=low
# EASEL_PORT=7860
# OPENCLAW_PORT=18789
```

---

### 月费估算（轻度使用）

| 能力 | 硅基流动 | 阿里百炼 | 合计 |
|---|---|---|---|
| LLM 对话（每天几轮） | ¥10-30 | — | ¥10-30 |
| AI 生图（每周几张） | ¥1-5 | — | ¥1-5 |
| AI 视频（每周 1-2 个） | — | ¥10-50 | ¥10-50 |
| AI 音乐（偶尔） | — | ¥5-20 | ¥5-20 |
| AI 配音（偶尔） | — | ¥2-10 | ¥2-10 |
| **合计** | **¥11-35** | **¥17-80** | **¥30-150/月** |

> 新用户有赠金（硅基流动 ¥16 + 阿里百炼免费额度），首月基本免费。

---

### 如果想用 Claude 做 LLM 大脑

把硅基流动换成 OpenRouter，其他不变：

```bash
# 账号 1 改为 OpenRouter（用 Claude/GPT/Gemini）
# 注册：https://openrouter.ai/（Google/GitHub OAuth 一键登录）
OPENAI_MAAS_API_KEY=sk-or-v1-你的OpenRouter Key
OPENAI_MAAS_ENDPOINT=https://openrouter.ai/api/v1
OPENAI_MAAS_MODEL=anthropic/claude-sonnet-4.6

# 想换模型只改这一行：
# OPENAI_MAAS_MODEL=openai/gpt-5.1
# OPENAI_MAAS_MODEL=google/gemini-3.1-pro
# OPENAI_MAAS_MODEL=deepseek-ai/deepseek-v3

# 账号 2 不变（阿里百炼）
DASHSCOPE_API_KEY=sk-你的阿里云Key
VIDEO_PROVIDER=dashscope
MUSIC_PROVIDER=dashscope
VOICE_PROVIDER=dashscope

# 生图用阿里通义万相（同一个 DashScope Key，不用再注册硅基流动）
IMG_API_KEY=sk-同一个阿里云Key
IMG_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
IMG_MODEL=wanx-v1
```

> OpenRouter 最低充值 $5，价格与上游官方一致，仅收 5% 充值手续费。国内需代理访问。

---

## 十四、LLM 大模型实测评测（2026-09-03）

### 评测条件

- **测试 Prompt**：为一款「保温杯」写一条小红书种草笔记（标题+正文200字+5个话题标签）
- **平台**：硅基流动 SiliconFlow
- **temperature**：0.7
- **max_tokens**：800
- **评测维度**：内容质量、小红书语感、速度、价格

### 参评模型与价格

| 模型 | 厂商 | 参数规模 | 价格（$/M tokens） | 上下文 |
|---|---|---|---|---|
| `deepseek-ai/DeepSeek-V4-Pro` | DeepSeek | 旗舰 | $1.50 / $3.14 | 1049K |
| `deepseek-ai/DeepSeek-V4-Flash` | DeepSeek | 轻量 | $0.13 / $0.28 | 1049K |
| `deepseek-ai/DeepSeek-V3` | DeepSeek | 上一代 | ~$0.27 / ~$0.42 | 164K |
| `deepseek-ai/DeepSeek-R1` | DeepSeek | 推理模型 | 较贵 | — |
| `Qwen/Qwen3.5-397B-A17B` | 阿里 | 397B MoE | $0.26 / $2.08 | 262K |
| `Qwen/Qwen3.5-122B-A10B` | 阿里 | 122B MoE | $0.26 / $2.08 | 262K |
| `zai-org/GLM-5.2` | 智谱 | 旗舰 | $1.30 / $4.09 | 1049K |
| `MiniMaxAI/MiniMax-M2.5` | MiniMax | — | $0.30 / $1.20 | 197K |
| `moonshotai/Kimi-K3` | 月之暗面 | 旗舰 | $3.00 / $15.00 | 1049K |

> 价格来自硅基流动定价页（https://www.siliconflow.com/zh/pricing），Input/Output 分别计价，以官方实时页面为准。

### 评测结果

| 模型 | 速度 | Token 数 | 内容质量 | 小红书语感 | 综合评分 |
|---|---|---|---|---|---|
| **DeepSeek-V4-Pro** | 35s | 1694 | ⭐⭐⭐⭐⭐ 卖点最具体（316不锈钢、智能显温） | ⭐⭐⭐⭐ | 🥇 9/10 |
| **GLM-5.2** | 21s | 1386 | ⭐⭐⭐⭐⭐ "母婴级内胆""狠狠拿捏" | ⭐⭐⭐⭐⭐ 最地道 | 🥈 8.5/10 |
| **Qwen3.5-397B** | 21s | 1996 | ⭐⭐⭐⭐ 有吸管口设计细节 | ⭐⭐⭐⭐ | 🥉 8/10 |
| **DeepSeek-R1** | 57s ❌ | 1056 | ⭐⭐⭐ 内容啰嗦 | ⭐⭐⭐ | 6/10 |
| **Qwen3.5-122B** | 14s | 876 | ❌ 返回空（thinking 模式） | — | 不推荐 |

### 各模型生成内容对比

#### DeepSeek-V4-Pro（🥇 综合最优）

> **标题**：✨挖到宝了！这个保温杯颜值保温双在线
>
> **正文**：姐妹们！最近挖到的这个保温杯真的绝了😭 之前买的不是漏水就是不保温，但它完全不会！316不锈钢内胆，早上倒的热水到下班还烫嘴，保温效果巨牛👍 颜值也没话说，奶fufu的配色随手一拍就是ins风～杯盖还有智能温度显示，再也不用担心烫舌头啦！
>
> **亮点**：卖点最具体（316不锈钢、智能显温），结构清晰

#### GLM-5.2（🥈 小红书语感最佳）

> **标题**：✨拒绝凉水！被问爆的神仙保温杯太绝了
>
> **正文**：姐妹们，最近降温了，手里必须有个能随时喝热水的杯子呀！被我新入手的这款神仙保温杯狠狠拿捏了🤏。奶呼呼的配色太戳我了，带去办公室同事都在要链接！它用的是316母婴级内胆，泡茶、装咖啡都不留味。
>
> **亮点**：用词最地道（"狠狠拿捏""奶呼呼""太戳我了"），小红书网感最强

#### Qwen3.5-397B（🥉 性价比之选）

> **标题**：挖到宝了！这只保温杯锁温太绝了🔥
>
> **正文**：姐妹们！最近挖到一只超可爱的保温杯，必须按头安利！😍 颜值真的绝绝子，奶油色系拿在手里质感满满。最重要的是锁温效果太牛了，早上装的热水，下午喝还是烫嘴的！
>
> **亮点**：速度快（21秒），内容质量好，价格便宜

### 按用途推荐

| 用途 | 推荐模型 | 理由 |
|---|---|---|
| **Agent 大脑（综合）** ⭐ | `deepseek-ai/DeepSeek-V4-Pro` | 综合能力最强、指令遵循好、工具调用稳定 |
| **小红书文案/创意写作** | `zai-org/GLM-5.2` | 小红书语感最地道，"奶呼呼""狠狠拿捏"等用词最自然 |
| **性价比/快速出稿** | `Qwen/Qwen3.5-397B-A17B` | 21秒速度快，内容质量好，价格 $0.26/$2.08 |
| **极致便宜** | `deepseek-ai/DeepSeek-V4-Flash` | $0.13/$0.28，适合大批量调用 |
| **深度推理** | `deepseek-ai/DeepSeek-R1` | 推理强但太慢（57秒），不适合创意写作 |

### 切换方法

只需改 `.env` 中 `OPENAI_MAAS_MODEL` 一行，无需换 Key：

```bash
# Agent 大脑首选（当前配置）
OPENAI_MAAS_MODEL=deepseek-ai/DeepSeek-V4-Pro

# 切到小红书语感最佳
OPENAI_MAAS_MODEL=zai-org/GLM-5.2

# 切到性价比之选
OPENAI_MAAS_MODEL=Qwen/Qwen3.5-397B-A17B

# 切到极致便宜
OPENAI_MAAS_MODEL=deepseek-ai/DeepSeek-V4-Flash
```

> 改完后运行 `bash setup.sh` 同步到 OpenClaw。

### 阿里百炼 LLM 对比（备选方案）

如果想切到阿里百炼做 LLM，改 `.env` 注释/取消注释对应组即可：

| 模型 | 说明 | 适合 |
|---|---|---|
| `qwen3.8-max` | 2.4万亿参数旗舰 | 综合最强 |
| `deepseek-v4-pro` | DeepSeek 旗舰 | 推理优秀 |
| `kimi-k3` | 长上下文 | 长文档处理 |
| `qwen3.7-max` | 次旗舰 | 性价比好 |

> 阿里百炼的 LLM 走 OpenAI 兼容端点，切换时需同时改 `OPENAI_MAAS_ENDPOINT` 和 `OPENAI_MAAS_API_KEY`。
