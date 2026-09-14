# Easel 从原始基线完整重建规格书

> 本文档以原始 Git 基线为起点，按“产品目标 → 模块结构 → 功能对比 → 逐模块还原方案 → 横向约束与验收”的金字塔结构，说明 Easel 当前具备哪些模块、每个模块包含哪些功能、功能解决什么问题、相对原始版本修改了什么，以及如何从基线逐项重建。

---

# 第一篇：目标与结构

# 0. 文档基准

## 0.1 范围快照

| 项目 | 当前值 |
|---|---|
| 原始基线 | `7cfeca7465927277ae28c5eec471478e224e7017` |
| 基线日期 | 2026-09-02 |
| 当前目标提交 | `a5fa59bda26c8040bc8f070c1ee75087c09b6fab` |
| 当前目标日期 | 2026-09-12 |
| 改造范围 | `7cfeca7465927277ae28c5eec471478e224e7017..a5fa59bda26c8040bc8f070c1ee75087c09b6fab` |
| 提交数量 | 53 |
| 变更文件 | 137（新增 81、修改 56、删除 0） |
| 代码规模 | 新增 22,299 行、删除 1,081 行 |
| Web 路由 | 原始 50 个，当前 105 个 |
| Pydantic 模型 | 当前 28 个 |
| 核心测试 | `tests/test_core.py` 当前定义 75 个测试函数 |
| 工作树 | 梳理开始时干净；本次仅修改本规格书 |

## 0.2 变更阶段

| 阶段 | 范围 | 提交数 | 核心结果 |
|---|---|---:|---|
| 产品主线 | `7cfeca7..c2f2965` | 25 | 部署、Web、发布、媒体、TTS、BGM、数字人 |
| P0 补齐 | `c2f2965..b3900be` | 7 | MaaS、Skill 硬门、任务持久化、重试、测试与首版规格 |
| 工作流扩展 | `b3900be..04f4c92` | 12 | 素材复用、画像模板、行业热点、对标账号、会话同步 |
| 浏览器与稳定性 | `04f4c92..a5fa59b` | 9 | 跨平台搜索、反风控、登录态复用、增量保存、并发抓取 |

## 0.3 功能分类口径

| 类型 | 定义 |
|---|---|
| 老功能 | 基线已有完整入口，当前继续保留，核心用途没有本质变化 |
| 升级功能 | 基线已有页面、接口、命令或脚本，本轮增强能力、流程、稳定性或体验 |
| 新功能 | 基线不存在对应产品入口或后端能力，本轮从零增加 |
| 规划功能 | 已明确产品方向，但当前尚未形成完整可用入口 |

状态口径：

- **已实现**：代码、页面和数据契约已落地；
- **部分验证**：主链路已落地，但仍依赖真实账号、平台页面或付费 API；
- **规划中**：当前仅有模板、文档或通用底座，尚未产品化；
- **技术债**：当前能工作，但仍有依赖、持久化、架构或安全边界需要治理。

---

# 1. 产品目标

## 1.1 原始产品

原始 Easel 已具备 CLI、OpenClaw Skill、六维画像、基础 Web 对话、内容产物、账号登录、平台发布、热点、日历和选题等工具骨架，但用户仍需要理解脚本、模型、文件目录和平台差异，多个能力之间缺少可靠的业务闭环。

## 1.2 当前产品

当前 Easel/ElephBrain AI 的目标是本地优先的社媒内容工作台：

```text
安装与配置
→ 创建画像
→ 发现热点和对标内容
→ 收藏选题或拆解爆款
→ 对话生成内容
→ 复用历史素材
→ 管理声音、BGM 和数字人
→ 生成完整视频
→ 多平台发布
→ 恢复会话、媒体任务和发布任务
```

## 1.3 核心升级结论

| 类别 | 结论 |
|---|---|
| 保留的老能力 | CLI、Skill、画像文件、基础对话、内容库、账号登录、平台发布、热点、日历、选题和媒体脚本 |
| 主要升级方向 | 把工具入口升级为可诊断、可流式、可恢复、可配置、可预览、可确认和可持久化的工作流 |
| 主要新增能力 | 画像模板、行业热点、对标账号体系、浏览器搜索、Wechatsync、异步发布 Job、BGM/音色/数字人资产中心、完整视频状态机 |
| 最终产品能力 | 从“调用某个脚本”升级为“发现 → 制作 → 管理资产 → 发布”的完整内容生产闭环 |

---

# 2. 当前模块地图

## 2.1 模块清单

| 模块 | 模块名称 | 模块作用 | 当前状态 |
|---|---|---|---|
| M01 | 部署与运行 | 安装依赖、启动服务、切换模式、诊断环境 | 已实现 |
| M02 | Agent、Skill 与模型 | 统一能力执行、Skill 路由、Provider 配置和 MaaS 适配 | 已实现 |
| M03 | Web 工作台与产品引导 | 提供统一入口、导航、品牌、欢迎引导和使用指南 | 已实现 |
| M04 | 用户画像 | 管理六维画像、模板、新手建档和 AI 增强 | 已实现 |
| M05 | 对话与会话 | 处理流式生成、thinking、停止、恢复、并发和历史同步 | 已实现 |
| M06 | 内容库与素材 | 管理产物、预览媒体、上传附件和复用历史素材 | 已实现 |
| M07 | 内容发现与策划 | 热点、行业新闻、选题、日历和爆款拆解 | 已实现 |
| M08 | 对标账号 | 搜索账号、解析链接、维护账号池、抓取帖子和二创 | 已实现/部分验证 |
| M09 | 账号与平台集成 | 管理平台登录、公众号和 Wechatsync | 已实现/部分验证 |
| M10 | 媒体资产 | 管理音色、声音克隆、BGM 和数字人角色 | 已实现/部分验证 |
| M11 | 视频生成 | 把图片和文案生成带口播、字幕、BGM、数字人的成片 | 已实现/待真实 PoC |
| M12 | 发布中心 | 解析草稿、平台适配、异步发布、取消、恢复和重试 | 已实现/部分验证 |
| M13 | 质量、安全与文档 | 测试、路径安全、域名白名单、凭证保护和项目文档 | 已实现/持续改进 |
| M14 | 企业与电商领域化 | 在通用底座上建立企业、电商事实卡和专用生成器 | 规划中 |

## 2.2 模块依赖

```text
M01 部署与运行
  └── M02 Agent、Skill 与模型
        ├── M04 用户画像
        ├── M05 对话与会话
        ├── M07 内容发现与策划
        ├── M08 对标账号
        ├── M10 媒体资产
        └── M11 视频生成

M03 Web 工作台
  ├── 聚合 M04/M05/M06/M07/M08/M09/M10/M12
  └── 通过 FastAPI API 与 SSE 访问后端

M06 内容库与素材
  ├── 为 M05 对话提供附件
  ├── 为 M11 视频生成提供图片和音频
  └── 为 M12 发布提供正文与媒体

M07 热点与策划
  └── 选题进入 M05 对话或 M12 发布

M08 对标账号
  └── 对标帖子进入 M07 选题、爆款拆解或 M05 对话

M10 媒体资产
  └── 为 M11 提供 voice、BGM 和数字人

M11 视频生成
  └── 为 M12 视频平台发布提供成片

M13 质量与安全
  └── 横向约束全部模块
```

## 2.3 模块级功能对比总表

| 模块 | 原始基线 | 本轮修改 | 改完后的能力升级 |
|---|---|---|---|
| M01 部署与运行 | 有 setup、doctor、ping 和 gateway 命令 | 新增统一 start；扩展依赖安装、媒体检查和模式识别 | 从手工启动升级为一键安装、生命周期管理和可定位诊断 |
| M02 Agent/Skill/模型 | 有 CLI、Skill 和部分媒体脚本/注册表 | 扩充 Provider；强化 Skill 路由硬门；适配长上下文和大输出 | 从分散脚本配置升级为统一能力路由和模型治理 |
| M03 Web 工作台 | 有 React 页面、侧栏和基础页面切换 | 品牌统一、多页面导航、欢迎引导、使用指南 | 从功能页面集合升级为面向用户的产品工作台 |
| M04 用户画像 | 有六维画像、CRUD 和表单构建 | 增加 8 个模板、名称校验、基线秒级可用和异步增强 | 从空白建档升级为模板化、可立即使用的画像系统 |
| M05 对话与会话 | 有 chat stream、thinking、stop、last turn | 真流式、supervisor、事件重放、双层锁、自动续写、会话同步 | 长任务可观察、可停止、可恢复，并避免跨会话串流 |
| M06 内容库与素材 | 有 outputs 列表、读取、媒体访问、删除和上传 | 项目化目录树、富元数据、媒体预览、上传隔离、内容库选素材 | 从文件列表升级为可检索、可复用的内容资产库 |
| M07 内容发现与策划 | 有通用热点、日历、选题和拆解页面 | 扩平台热搜、行业热点、收藏和跨页面创作闭环 | 从孤立工具升级为“发现 → 选题 → 制作”的策划链路 |
| M08 对标账号 | 基线没有独立对标模块 | 新增统一模型、动态池、链接解析、搜索、浏览器登录和多源抓取 | 获得跨平台对标发现、监控、拆解和二创能力 |
| M09 账号与集成 | 有平台登录、短信、whoami 和退出 | 完善账号中心；新增公众号在线配置和 Wechatsync 管理 | 从平台登录接口升级为统一平台接入中心 |
| M10 媒体资产 | 有 TTS、声音克隆和媒体脚本 | 新增音色页、BGM 曲库、数字人角色和 EMO 任务 | voice、音乐和人物从临时参数升级为可管理资产 |
| M11 视频生成 | 有 slideshow、TTS、auto-short-video 等工具 | 增加确认门、脚本改写、字幕、BGM、数字人、指纹、manifest、自检 | 从脚本拼接升级为稳定、可审计的完整视频状态机 |
| M12 发布中心 | 有单平台发布和 PublishPage | 草稿解析、异步 Job、媒体依赖、取消、恢复、重试和 Wechatsync | 从单平台直接调用升级为可恢复的多平台任务中心 |
| M13 质量与安全 | 有少量校验和基础 gitignore | 扩测试、附件隔离、安全路径、代理白名单、脱敏和完整文档 | 从功能可运行升级为有边界、可验证、可重建 |
| M14 企业与电商 | 只有通用画像和内容工具 | 新增领域模板、方案和事实约束方向 | 已有通用底座，专用事实卡和生成器仍待产品化 |

---

# 3. 按模块划分的功能目录

> 本章是上层结构索引。每项功能的还原步骤和技术细节见第二篇对应模块。

## 3.1 M01：部署与运行

| 功能 | 类型 | 功能作用 | 修改重点 | 能力升级 |
|---|---|---|---|---|
| 安装脚本 | 升级 | 安装 Easel 及运行依赖 | 补齐 Node、Python、OpenClaw、媒体依赖、Chromium、字体和前端构建 | 环境可重复初始化 |
| 统一启动 | 新功能 | 管理所有本地服务生命周期 | 新增 start/stop/restart/status/logs 和 Gateway 开关 | 用户无需分别管理进程 |
| Doctor | 升级 | 发现环境和配置问题 | 增加 FFmpeg、字体、浏览器、Skill、Provider 检查 | 从“能否运行”升级为“问题可定位” |
| Ping/状态 | 升级 | 判断当前运行模式和连接状态 | 适配 Local/Gateway | 状态展示与实际模式一致 |

## 3.2 M02：Agent、Skill 与模型

| 功能 | 类型 | 功能作用 | 修改重点 | 能力升级 |
|---|---|---|---|---|
| CLI/Skill 执行 | 老功能 | 执行内容、媒体、分析和发布能力 | 保留 CLI、`/api/skill` 和 OpenClaw Skill | 继续作为统一执行层 |
| Skill 浏览与配置 | 升级 | 在 Web 查看 Skill 并配置所需 Provider | 保留技能列表/详情，接入统一注册表和脱敏配置状态 | 用户可知道每个 Skill 缺少什么配置 |
| Skill 索引与同步 | 升级 | 将技能同步到 OpenClaw 并可发现 | 增加索引、元数据和同步规则 | Skill 可诊断、可路由 |
| Skill 路由硬门 | 升级 | 防止 Agent 选择错误媒体能力 | 明确 TTS、BGM、数字人、视频使用边界 | 避免错误降级和错误收费调用 |
| 模型注册表 | 升级 | 统一 Provider、环境变量和配置状态 | 扩充 image/video/music/voice Provider | Web、doctor、脚本共享单一配置源 |
| MaaS Adapter | 升级 | 连接 OpenAI 兼容模型 | 代理、长上下文、更大 max_tokens | 减少 8192 输出截断和模式差异 |

## 3.3 M03：Web 工作台与产品引导

| 功能 | 类型 | 功能作用 | 修改重点 | 能力升级 |
|---|---|---|---|---|
| 页面工作台 | 升级 | 聚合所有业务页面 | 多页面打开、关闭和状态恢复 | 可持续多任务操作 |
| 品牌统一 | 新功能 | 统一产品识别 | ElephBrain 名称、图标和文案 | 页面视觉和定位一致 |
| 欢迎引导 | 新功能 | 指导首次用户完成配置 | 推荐配置顺序和首次入口 | 降低上手门槛 |
| 使用指南 | 新功能 | 以业务场景解释能力 | 新增页面和场景文档 | 用户按目标而非 Skill 名称使用产品 |
| 导航重组 | 升级 | 按工作流组织页面 | 对标独立、BGM 并入配音、使用场景改使用指南 | 信息架构更接近运营流程 |

## 3.4 M04：用户画像

| 功能 | 类型 | 功能作用 | 修改重点 | 能力升级 |
|---|---|---|---|---|
| 六维画像 | 老功能 | 保存身份、风格、受众、平台、偏好和经验 | 保留 Markdown 文件模型 | Agent 和用户可直接读写 |
| 画像 CRUD | 老功能 | 查看、编辑、删除画像 | 保留原 API 和页面 | 维持文件式管理 |
| 画像构建 | 升级 | 把用户表单转为六维画像 | 基线先写、AI 后台增强、失败不阻塞 | 创建后立即可用 |
| 画像模板 | 新功能 | 快速创建特定业务人设 | 新增 8 个预设模板 | 企业、电商、资讯等场景可快速开始 |
| 模板与表单合并 | 新功能 | 在模板基础上保留用户个性信息 | 用户输入追加到对应维度，不覆盖模板主体 | 兼顾标准化和个性化 |

## 3.5 M05：对话与会话

| 功能 | 类型 | 功能作用 | 修改重点 | 能力升级 |
|---|---|---|---|---|
| 流式对话 | 升级 | 实时展示 Agent 输出 | raw stream 转 SSE token/thinking/activity | 长任务进度可见 |
| Supervisor | 升级 | 让任务生命周期独立于浏览器连接 | 后台任务、结果落盘 | 断线不杀任务 |
| 事件重放 | 升级 | 恢复断开期间的消息 | turn 事件文件和 after cursor | 重连不丢输出 |
| 显式停止 | 升级 | 用户主动终止生成 | 终止子进程后再清理锁 | 停止状态可靠 |
| 会话并发隔离 | 升级 | 防止同会话并发冲突 | asyncio 锁、flock、session ID 过滤、BroadcastChannel | 多窗口不串流、不抢占 |
| 自动续写 | 新功能 | 修复异常截断和只输出计划 | 判断 stop reason、流终态和计划尾部后恢复 | 减少“生成中断” |
| 后端会话同步 | 新功能 | 找回不在 localStorage 中的会话 | 新增 `/api/sessions` | 跨浏览器可见已落盘历史 |
| 对话诊断 | 新功能 | 排查模型和流异常 | 写 `chat-stream.jsonl` | 问题可追踪 |

## 3.6 M06：内容库与素材

| 功能 | 类型 | 功能作用 | 修改重点 | 能力升级 |
|---|---|---|---|---|
| 产物读写 | 老功能 | 列出、读取、访问和删除 outputs 文件 | 保留原有 API | 继续作为内容存储底座 |
| 项目化目录树 | 升级 | 按项目和目录展示产物 | 递归树、文件数、mtime、`.easel.json` | 从文件列表升级为项目视图 |
| 多媒体预览 | 升级 | 直接查看文本、图片、音频和视频 | 新增 FilePreview 和消息媒体渲染 | 无需离开 Web 查文件 |
| 上传隔离 | 升级 | 安全接收本轮附件 | session/batch 隔离、所有权校验、同名文件并存 | 防串会话和覆盖 |
| 内容库素材选择 | 新功能 | 在新对话中复用已有产物 | 新增 OutputPicker 搜索、筛选和多选 | 历史素材无需重新上传 |
| 删除保护 | 升级 | 防止误删系统状态 | 保护 `_` 系统目录和安全路径 | 内容操作不破坏运行数据 |

## 3.7 M07：内容发现与策划

| 功能 | 类型 | 功能作用 | 修改重点 | 能力升级 |
|---|---|---|---|---|
| 通用热点 | 升级 | 获取多平台热搜 | 扩至 6 个平台、主备源和缓存 | 热点覆盖与稳定性提升 |
| 行业热点 | 新功能 | 按画像筛选垂直新闻 | AI/IT/综合新闻源和 qwen-plus 过滤 | 从泛热点升级为画像相关选题 |
| 运营数据分析 | 老功能 | 读取支持平台和账号运营数据 | 保留 analytics 平台列表与数据接口 | 继续为工作台和运营判断提供数据 |
| 选题库 | 老功能/升级 | 保存和管理待创作主题 | 接入热点和对标收藏 | 成为发现与制作的中间层 |
| 内容日历 | 老功能 | 管理发布排期和事件 | 保留 CRUD 与节奏建议 | 继续承担计划管理 |
| 爆款拆解 | 升级 | 分析热点或对标内容结构 | 支持跨页面带入来源上下文 | 拆解结果可直接用于二创 |
| 一键做内容 | 新功能 | 将热点直接发送到对话 | 页面跳转并预填主题 | 缩短发现到创作路径 |

## 3.8 M08：对标账号

| 功能 | 类型 | 功能作用 | 修改重点 | 能力升级 |
|---|---|---|---|---|
| 独立对标页面 | 新功能 | 配置账号并浏览动态 | 三栏信息流、平台/账号筛选、详情 | 对标监控成为独立业务模块 |
| 统一账号模型 | 新功能 | 标准化多平台账号 | 稳定 ID、主页、RSS、头像、粉丝、来源、验证状态 | 跨来源去重和合并 |
| 动态账号池 | 新功能 | 保存推荐和用户发现账号 | 种子初始化、验证、upsert、搜索和分页 | 账号池可持续增长 |
| 链接识别 | 新功能 | 从主页或分享文本识别账号 | 8 类平台和公众号 `__biz` | 无需手填账号 ID/RSS 路由 |
| B站 API 搜索 | 新功能 | 在线发现 UP 主 | 分页、粉丝阈值、缓存、浏览器降级 | 匿名环境也能搜索真实账号 |
| 浏览器账号搜索 | 新功能 | 搜索无稳定公开 API 的平台 | 网络响应优先、DOM 降级、持久化 Profile | 跨平台账号发现 |
| 浏览器登录 Job | 新功能 | 等待扫码、验证码或登录 | 有头浏览器、异步状态、同平台互斥 | 人工登录可纳入流程 |
| Ego Lite Cookie 导入 | 新功能 | 复用用户现有浏览器登录态 | macOS Cookie 解密和目标域名注入 | 减少重复扫码 |
| 多源帖子抓取 | 新功能 | 抓取对标账号公开内容 | 浏览器、Folo、RSSHub、标准 RSS、公开页降级 | 单一来源失败仍可继续 |
| 并发刷新 | 新功能 | 刷新多个账号 | 同平台串行、跨平台并发 | 提升批量刷新速度 |
| 收藏/拆解/二创 | 新功能 | 把帖子转为后续工作 | 收藏 Idea、爆款拆解、带上下文做内容 | 打通对标到创作闭环 |

## 3.9 M09：账号与平台集成

| 功能 | 类型 | 功能作用 | 修改重点 | 能力升级 |
|---|---|---|---|---|
| 平台账号中心 | 升级 | 管理登录状态和操作入口 | 状态原因、二维码、短信、whoami、退出、说明 | 平台差异集中呈现 |
| 微信公众号配置 | 新功能 | 管理公众号发布参数 | 多账号、默认账号、作者、主题、Secret 脱敏 | 公众号无需手工改配置文件 |
| Wechatsync 扩展 | 新功能 | 准备浏览器同步能力 | 下载/解压和手动加载指引 | 扩展配置可视化 |
| Wechatsync Token/CLI/Skill | 新功能 | 管理同步运行条件 | Token、连接检测、CLI 和 Skill 安装 | 一稿多发环境可在线检查 |
| Wechatsync 平台查询 | 新功能 | 查看可同步平台和状态 | 查询扩展端平台 | 发布前可确认可用性 |

## 3.10 M10：媒体资产

| 功能 | 类型 | 功能作用 | 修改重点 | 能力升级 |
|---|---|---|---|---|
| TTS | 升级 | 将口播稿转为语音 | CosyVoice/Qwen-TTS、页面 voice、逐句字幕、禁止 Edge 降级 | 语音质量和失败边界明确 |
| 声音克隆 | 升级 | 创建用户专属音色 | 多 Provider、上传、部署轮询、试听、删除 | 从脚本升级为长期声音资产 |
| 音色管理页 | 新功能 | 查看系统/克隆音色并设置默认 | 筛选、试听、默认音色和引擎 | 页面选择真实进入生成链路 |
| BGM 曲库 | 新功能 | 管理视频背景音乐 | 上传、试听、风格、删除、稳定自动选曲 | 普通视频复用可控音乐资产 |
| 数字人角色库 | 新功能 | 保存用户真实角色照片 | 角色 CRUD、预览和持久化 | 人物形象可重复使用 |
| EMO 任务 | 新功能 | 由角色照片和本轮音频生成口播人物 | 文件上传、任务轮询、状态落盘 | 数字人生成可恢复、可追踪 |
| 配音/音乐/数字人统一页 | 新功能 | 集中管理视频资产 | VoicePage 多 Tab，BGM 并入 | 制作参数不再散落 |

## 3.11 M11：视频生成

| 功能 | 类型 | 功能作用 | 修改重点 | 能力升级 |
|---|---|---|---|---|
| 媒体工具复用 | 老功能 | 提供 slideshow、字幕、混音、转码等底层能力 | 继续复用共享脚本和 assemble | 避免重复造轮子 |
| 配置确认门 | 新功能 | 生成前确认收费参数 | `generation_confirmed` | 防误触付费调用 |
| 口播脚本 | 升级 | 将正文改写为适合口播的文本 | qwen-plus 改写并保留事实 | 文案更适合语音表达 |
| 配音和字幕 | 升级 | 生成语音与同步字幕 | 页面 voice、闭源 TTS、逐句 SRT | 声音配置可控且字幕同步 |
| BGM 合成 | 新功能 | 从公共曲库选音乐并混音 | 内容分类、稳定哈希选曲、回退链 | 可重复、可解释选曲 |
| 数字人叠加 | 新功能 | 将 EMO 人物叠加到主视频 | 角色照片 + 本轮音频 + 位置 | 生成真实角色口播画面 |
| Fingerprint | 新功能 | 判断配置是否发生变化 | 正文、媒体、voice、BGM、角色、位置入指纹 | 配置变化不会误复用旧视频 |
| Manifest | 新功能 | 记录视频状态和产物 | completed 状态、中间文件、配置和错误 | 生成过程可审计 |
| 强制重建 | 新功能 | 忽略已有缓存重新生成 | `force_regenerate` | 用户可明确刷新成片 |
| 成片自检 | 新功能 | 验证最终视频真实可用 | ffprobe 检查音频轨和视频轨 | 不交付空壳或损坏文件 |

## 3.12 M12：发布中心

| 功能 | 类型 | 功能作用 | 修改重点 | 能力升级 |
|---|---|---|---|---|
| 单平台原生发布 | 升级 | 发布到各原生平台 | 路由明确为 `/native/`、状态、短信和错误反馈 | 平台发布状态更清晰 |
| 发布页面 | 升级 | 确认正文、媒体和平台 | 平台定制正文、生成配置、任务列表 | 从表单升级为发布工作台 |
| 草稿解析 | 新功能 | 从上下文和内容库找到最合适草稿 | `/api/publish/draft/resolve` | 减少重复复制和选择 |
| 异步发布 Job | 新功能 | 后台执行长发布任务 | 创建、查询、列表、取消和落盘 | 页面刷新后可恢复 |
| 视频依赖调度 | 新功能 | 让视频平台等待视频生成 | media task 与平台 task 协调 | 图文平台和视频平台可并行处理 |
| 媒体快照 | 新功能 | 固定每个平台启动时使用的原始媒体 | 在线程启动前完成图片/视频快照 | 消除生成视频覆盖图文媒体的竞态 |
| 失败重试 | 新功能 | 保留原制作配置再次执行 | 保留正文、平台正文、media、voice、BGM、数字人和确认标记 | 重试结果与原任务一致 |
| Wechatsync 发布 | 新功能 | 同步到多个内容平台草稿 | 按平台创建任务并区分 submitted/verified | 一稿多发进入统一 Job |

## 3.13 M13：质量、安全与文档

| 功能 | 类型 | 功能作用 | 修改重点 | 能力升级 |
|---|---|---|---|---|
| 核心测试 | 升级 | 验证关键业务边界 | 扩展到 Provider、会话、发布、视频、对标和安全 | 回归范围显著扩大 |
| 安全路径 | 升级 | 防止目录穿越和越权附件 | 安全路径解析、session 所有权和系统目录保护 | 文件 API 边界明确 |
| 域名代理白名单 | 新功能 | 安全代理外部图片和头像 | 协议、域名、类型和大小限制 | 在可展示外部资源时降低 SSRF 风险 |
| 凭证保护 | 升级 | 避免密钥和登录态泄露 | `.gitignore`、Secret 脱敏、Cookie 不进响应 | 本地凭证边界明确 |
| 文档体系 | 新功能 | 支撑安装、配置、使用和重建 | 架构、Key、使用指南、场景、视频标准、技术方案 | 项目具备可交接和可重建依据 |
| Skill 校验 | 升级 | 验证 Skill 元数据和命令 | 索引、规范和命令检查 | Skill 变更可静态验收 |

## 3.14 M14：企业与电商领域化

| 功能 | 类型 | 功能作用 | 当前进展 | 尚缺能力 |
|---|---|---|---|---|
| 领域画像模板 | 新功能 | 快速建立企业/电商账号定位 | 已有企业品牌、新媒体、企业服务、电商种草、主播模板 | 需继续连接结构化业务数据 |
| 企业事实卡 | 规划功能 | 约束客户、案例、资质和业务事实 | 有方案和事实原则 | 缺数据模型、页面和生成校验 |
| 商品事实卡 | 规划功能 | 约束 SPU/SKU、价格、库存、功效、参数和售后 | 有方案和事实原则 | 缺数据模型、店铺接入和版本管理 |
| 专用视频生成器 | 规划功能 | 提供企业信任型和电商转化型视频流程 | 通用视频底座已具备 | 缺独立页面、领域模板和质量评分 |
| 批量视频工厂 | 规划功能 | 批量生成平台和人群变体 | 尚未实现 | 缺任务编排、预算和质量门 |

---

# 第二篇：逐模块重建方案与技术细节

# 4. M01：部署与运行

## 4.1 模块目标

让新环境可以安装、启动、检查和关闭 Easel，不要求用户理解每个子进程的命令。

## 4.2 功能还原顺序

1. 保留 `pyproject.toml` 的核心依赖和 media 可选依赖；
2. 扩展 `setup.sh` 完成环境检查、虚拟环境、OpenClaw、Playwright 和前端构建；
3. 新建 `start.sh`，统一 Web、Adapter、Gateway 生命周期；
4. 扩展 `doctor.py`；
5. 修改 `ping.py` 区分 Local/Gateway；
6. 更新 `.env.example` 和使用文档。

## 4.3 安装脚本技术细节

`setup.sh` 应按依赖顺序执行：

```text
检查系统工具
→ 创建 .venv
→ pip install -e . 或 .[media]
→ 检查/安装 OpenClaw
→ 初始化 Easel profile
→ openclaw/sync.sh 同步工作区和 Skills
→ playwright install chromium
→ 检查 FFmpeg 和字体
→ 安装前端依赖并构建
→ 输出配置 Key 和启动方式
```

安装必须可重复运行；已有环境不得被无条件破坏。

## 4.4 启动脚本技术细节

支持：

```text
start | stop | restart | status | logs
```

要求：

- Local 模式默认资源占用较低；
- `EASEL_GATEWAY=1` 时启动 Gateway；
- PID 和日志可查询；
- stop 只终止 Easel 管理的进程；
- status 区分 Web、Adapter 和 Gateway；
- 重复 start 不产生重复服务。

## 4.5 Doctor 检查项

| 分类 | 检查内容 |
|---|---|
| 运行时 | Python、Node、OpenClaw |
| 媒体 | FFmpeg、ffprobe、关键滤镜、中文字体 |
| 浏览器 | Playwright、Chromium |
| 前端 | 构建目录和资源 |
| Agent | profile、workspace、Skill 同步 |
| Provider | LLM、图片、视频、音乐和语音配置 |

## 4.6 验收

- 干净环境可完成核心安装；
- start/status/stop 生命周期正常；
- Local/Gateway 状态正确；
- doctor 能指出缺失项和建议；
- 不在输出中泄露完整 Key。

---

# 5. M02：Agent、Skill 与模型

## 5.1 模块目标

为对话、内容、媒体和发布提供统一执行层，使 Web 和 CLI 使用相同 Skill、Provider 和配置规则。

## 5.2 还原步骤

1. 保留 `easel/commands/skill.py` 和 `/api/skill`；
2. 恢复 `openclaw/sync.sh` 的同步逻辑；
3. 恢复 `skills/openclaw/INDEX.md` 和 Skill 元数据；
4. 扩展 `model_registry.py`；
5. 让 Web 和 doctor 读取同一注册表；
6. 修改 `ai_image.py`、`ai_video.py`、`ai_music.py`、`tts.py`、`voice_clone.py` 使用统一 Provider；
7. 修改 MaaS Adapter 的上下文和输出参数；
8. 在 `openclaw/workspace/AGENTS.md` 和相关 Skill 中加入媒体硬门。

## 5.3 Skill 浏览与配置

接口：

```text
GET  /api/skills
GET  /api/skill/{name}
POST /api/skill
POST /api/env
```

功能要求：

- 技能列表返回名称、描述、层级和是否需要 API；
- 技能详情返回 SKILL 正文和 Provider 配置规格；
- 配置状态从模型注册表计算，不在前端硬编码；
- `/api/env` 只允许写注册表声明的环境变量；
- Secret 返回脱敏值，普通设置可返回明文；
- 保存后重新计算各 Skill 是否可用。

## 5.4 Provider 注册表

| 分组 | Provider |
|---|---|
| image | OpenAI compatible、apimart、内部 MaaS |
| video | DashScope、ARK、Kling、OpenAI compatible、SiliconFlow、xhs-maas、Agnes |
| music | DashScope、Suno compatible |
| voice | DashScope/CosyVoice、Qwen-TTS、MiniMax、Fish Audio、OpenAI compatible、Gemini |

选择顺序：

```text
CLI 显式 provider
→ *_PROVIDER 环境变量
→ 仅一个有效 Provider 时自动选择
→ 多个有效 Provider 时要求明确指定
→ 无有效 Provider 时列出缺失配置并失败
```

注册表必须：

- 定义环境变量、标签、必填项、别名和可选值；
- 识别 `replace_me`、`your-api-key`、`xxx` 等占位符；
- 返回配置状态时只返回脱敏值；
- 不在脚本中重复维护 Provider 清单。

## 5.5 Skill 路由硬门

| 场景 | 正确能力 | 禁止行为 |
|---|---|---|
| 普通 TTS | 页面 voice 对应闭源引擎 | 自动降级 Edge |
| 普通 BGM | 公共曲库 | 未经请求调用 AI 音乐 |
| 原创音乐 | `ai-music` | 将其混同公共曲库 |
| 数字人口播 | 已保存角色 + 本轮音频 + EMO | 随机人物图、生图角色、Wan 替代 EMO |
| 完整成片 | 视频状态机 | 只返回某个中间文件 |

## 5.6 MaaS Adapter

- 接收 OpenAI 兼容请求；
- 统一模型地址、鉴权和代理；
- 注入更大的 `max_tokens`，避免 OpenClaw 默认 8192 截断；
- 支持长上下文目标；
- 为 Local 和 Gateway 提供一致调用入口。

真实上下文和输出上限仍以实际 Provider 为准。

## 5.7 验收

- CLI 与 Web 能定位同一个 Skill；
- Provider 配置状态一致；
- 多 Provider 时不静默选择错误模型；
- 占位符不被视为有效 Key；
- 媒体硬门在 Agent 指令和代码路径中同时存在。

---

# 6. M03：Web 工作台与产品引导

## 6.1 模块目标

把分散功能包装成可理解、可导航、可持续操作的产品界面。

## 6.2 当前页面

```text
工作台
对话
使用指南
热点雷达
对标配置
选题库
内容日历
发布中心
爆款拆解
技能库
内容库
配音 & 数字人
账号
画像
```

## 6.3 还原步骤

1. 在 `App.tsx` 注册全部页面；
2. 在 `Sidebar.tsx` 按运营工作流分组导航；
3. 实现打开页面列表、关闭和活动页恢复；
4. 替换品牌名称、图标和页面文案；
5. 新增 `WelcomeGuide.tsx`；
6. 新增 `UseCasesPage.tsx`；
7. 将 BGM 并入 `VoicePage.tsx`；
8. 将对标设置从画像拆为 `BenchmarkPage.tsx`；
9. 更新 `index.css` 和错误边界。

## 6.4 页面状态

- 当前页面写入 `easel_active_page`；
- 已打开页面写入 `easel_open_pages`；
- 首次引导状态写入 `easel_onboarding_seen`；
- 兼容旧 onboarding key 并迁移；
- 页面切换不能中断 App 层持有的对话流。

## 6.5 信息架构原则

```text
发现：热点、行业、对标
策划：选题、日历、拆解
制作：对话、内容库、配音、BGM、数字人
发布：账号、发布中心
配置：画像、技能、模型
```

## 6.6 验收

- 所有页面从侧栏可达；
- 刷新后恢复当前页和打开页；
- 页面切换不丢对话流；
- 首次用户能理解配置顺序；
- 使用指南按业务目标而非脚本名称组织。

---

# 7. M04：用户画像

## 7.1 模块目标

把用户定位、表达风格、目标受众、平台策略、偏好红线和历史经验持续提供给 Agent、热点筛选和对标配置。

## 7.2 六维文件

```text
profiles/<persona>/
├── identity.md
├── style.md
├── audience.md
├── platforms.md
├── preferences.md
└── memory.md
```

## 7.3 画像 API

| 方法 | 路径 | 作用 |
|---|---|---|
| GET | `/api/personas` | 列出画像 |
| GET | `/api/persona/{name}` | 返回聚合内容 |
| GET | `/api/persona/{name}/files` | 返回六维原文 |
| PUT | `/api/persona/{name}/file` | 原子保存单个维度 |
| DELETE | `/api/persona/{name}` | 删除画像 |
| GET | `/api/profile-templates` | 返回模板摘要 |
| POST | `/api/profile/build` | 写基线并启动增强 |
| GET | `/api/profile/build/status/{name}` | 查询增强状态 |

## 7.4 模板体系

| 模板目录 | 用途 |
|---|---|
| `digital-anchor` | 数字人口播 |
| `ecom-host` | 电商带货主播 |
| `ecom-seed` | 电商种草 |
| `enterprise-brand` | 企业品牌 |
| `enterprise-newmedia` | 企业新媒体 |
| `enterprise-service` | 企业服务获客 |
| `industry-news` | 行业资讯 |
| `knowledge-blogger` | 知识博主 |

每个模板包含 `template.json` 和六维 Markdown。

## 7.5 创建状态机

```text
校验画像名
→ 可选复制模板六维文件
→ 将表单内容写入或追加到对应维度
→ 画像立即可用
→ 状态写为 running
→ 后台调用 profile-builder Agent
→ done：增强完成
→ failed：保留基线画像并记录失败
```

名称校验：

- 去除首尾空格；
- 禁止空名；
- 禁止 `/` 和反斜杠；
- 禁止以 `.`、`_` 开头；
- 已存在返回 409。

## 7.6 模板合并规则

- 模板先复制；
- 用户方向、优势、目标和形式追加到 `identity.md`；
- 用户语气追加到 `style.md`；
- 平台和主页追加到 `platforms.md`；
- 红线追加到 `preferences.md`；
- 对标偏好追加到 `memory.md`；
- 不覆盖模板主体。

## 7.7 验收

- 空白和模板两种方式都能创建；
- 创建接口立即返回，不等待长 Agent；
- AI 增强失败时基线仍可使用；
- 六维文件可继续手工编辑；
- 非法名称不会逃逸 profiles 目录。

---

# 8. M05：对话与会话

## 8.1 模块目标

确保长对话任务可实时观察、断线后可恢复、同会话不会并发冲突，并在异常截断时尽量自动续写。

## 8.2 请求模型

`ChatRequest` 主要字段：

```text
message
persona
sessionId
turnId
thinking: off | high
attachments[]: id, name, path
```

## 8.3 真流式实现

OpenClaw CLI 最终 stdout 可能整段缓冲，因此后端为每轮创建独立 raw-stream JSONL：

```text
OPENCLAW_RAW_STREAM=1
OPENCLAW_RAW_STREAM_PATH=<turn 临时文件>
```

事件映射：

| OpenClaw 事件 | SSE 事件 | 前端用途 |
|---|---|---|
| `assistant_text_stream/text_delta` | `token` | 增量正文 |
| `assistant_thinking_stream/thinking_delta` | `thinking` | 思考区 |
| 模型 fetch/工具阶段 | `activity` | 进度提示 |
| 正常或异常终态 | `done/error` | 收尾和恢复 |

## 8.4 Supervisor 与连接解耦

```text
POST /api/chat/stream
→ 创建后台 supervisor
→ 声明 turn 为 running
→ 创建事件文件和 raw stream
→ 获取会话锁
→ 启动 OpenClaw 子进程
→ tail raw stream 并写 SSE 事件
→ 浏览器断开时 supervisor 继续
→ 最终结果写 outputs/_sessions
→ 释放进程、跨进程锁和进程内锁
```

`_BG_TASKS` 持有后台任务强引用，避免连接结束后被回收。

## 8.5 事件重放

| 接口 | 作用 |
|---|---|
| `/api/chat/jobs/{turn_id}/stream?after=N` | 从事件 N 后继续重放和 tail |
| `/api/chat/last/{session_id}?turn_id=...` | 获取最近一轮完整快照 |
| `/api/sessions` | 枚举后端完成会话 |

规则：

- 事件文件不存在立即 404；
- 每 10 秒可发送 ping 保持代理连接；
- last turn 校验 `turn_id`，旧轮返回 stale；
- 客户端收到 done 后清理 pending turn。

## 8.6 会话锁

| 层级 | 技术 | 作用 |
|---|---|---|
| 当前 Web 进程 | `asyncio.Lock` | 串行同一 session 请求 |
| 跨进程 | `fcntl.flock` | 防两个 Web/Gateway 进程写同一历史 |
| raw stream | OpenClaw session ID 过滤 | 忽略其他会话事件 |
| 浏览器标签 | `BroadcastChannel` | 新标签发现会话占用后创建新会话 |

只有子进程退出后才能释放锁。

## 8.7 异常检测和自动恢复

判定信号：

- 子进程返回码异常；
- stop reason 为 `max_tokens`、`length`、`model_length`、`tool_use`；
- 有 token 但最后事件不是 `assistant_message_end`；
- 文本停在冒号；
- Gateway raw stream 为空且文本尾部只描述“接下来、先做、再执行”等计划。

恢复流程：

```text
发现异常
→ 展示“正在自动恢复”
→ 将原请求和已有部分正文传入直接对话降级
→ 追加续写结果
→ 若仍失败，展示真实 stop reason 和继续建议
```

用户主动停止时不得触发自动续写。

## 8.8 诊断落盘

`outputs/_debug/chat-stream.jsonl` 记录：

- session；
- return code；
- stop reason；
- 最后 raw event；
- 是否出现 message end；
- fetch、token、thinking 数量；
- 是否忽略外部会话事件；
- 是否自动恢复；
- text/stdout 尾部。

## 8.9 前端会话恢复

- localStorage 保存会话列表；
- sessionStorage 保存当前标签所属会话和 pending turn；
- App 挂载时从 `/api/sessions` 合并后端会话；
- 同标签刷新复用原会话；
- 新标签探测冲突后新建会话；
- 流状态由 App 持有，切页面不卸载。

## 8.10 验收

- token、thinking 不重复、不串会话；
- 断线不终止后台任务；
- 重连可按事件游标恢复；
- 失效 turn 不无限心跳；
- 用户停止后进程和锁均清理；
- 正常完成不显示“生成中断”；
- 异常截断能续写或给出真实原因；
- 后端历史可合并到前端。

---

# 9. M06：内容库与素材

## 9.1 模块目标

将输出文件变为可浏览、可预览、可删除、可复用的内容资产，而不是要求用户直接操作文件系统。

## 9.2 数据模型

`OutputNode`：

```text
name
type: dir | file
path
mtime
kind: text | image | video | audio | binary
size
children[]
fileCount
meta
```

顶层项目可从 `.easel.json` 读取：

```text
title, summary, platform, kind, status, tags,
cover, deliverables, deliverablePaths
```

## 9.3 API

| 方法 | 路径 | 作用 |
|---|---|---|
| GET | `/api/outputs` | 递归产物树 |
| GET | `/api/output/{path}` | 文本内容或二进制标记 |
| GET | `/api/media/{path}` | 原样输出媒体 |
| DELETE | `/api/output/{path}` | 删除普通产物 |
| POST | `/api/upload` | 上传到当前 session inbox |

## 9.4 上传隔离

```text
浏览器提交 files + sessionId
→ 服务端创建 session/batch 目录
→ 同名文件生成独立文件名
→ 返回 id/name/path
→ ChatRequest 再次提交引用
→ 服务端验证路径属于该 session
```

不得只相信前端传入的 path。

## 9.5 多媒体预览

`FilePreview.tsx`：

- 文本/Markdown 渲染；
- 图片展示；
- 音频播放；
- 视频播放；
- 二进制下载；
- 目录切换。

`MessageBubble.tsx` 同时识别消息中的媒体路径并提供直接预览。

## 9.6 OutputPicker

功能：

- 读取产物树；
- 进入目录和面包屑导航；
- 递归搜索文件名；
- 按图片、视频、音频筛选；
- 多选文件；
- 转换为与上传附件一致的 `UploadedFile`；
- 回填聊天附件列表。

## 9.7 安全边界

- 所有路径经过 `_safe_output_path`；
- 拒绝绝对路径和 `..` 穿越；
- 删除时保护系统 `_` 目录；
- 上传引用绑定 session；
- 媒体响应只访问 outputs 范围内文件。

## 9.8 验收

- 深层目录可展开；
- 文本、图片、音频和视频可预览；
- 同名上传不覆盖；
- 跨 session 伪造附件被拒绝；
- 内容库素材可直接进入聊天；
- 系统状态目录不能从普通内容库删除。

---

# 10. M07：内容发现与策划

## 10.1 模块目标

帮助用户从泛热点、行业新闻和对标内容中发现主题，沉淀为选题并进入拆解、制作和排期。

## 10.2 通用热点

平台：微博、抖音、知乎、B站、百度、头条。

```text
前端选择平台
→ GET /api/trends
→ 后端查 5 分钟缓存
→ 请求主数据源
→ 主源失败请求备源
→ 返回各平台榜单
→ 收藏选题或做内容
```

## 10.3 行业热点

数据源：`ai-news`、`it-news`、`60s`。

关键词来源：

1. `profiles/<persona>/benchmarks.md`；
2. 无该文件时从 `audience.md` 提取；
3. 无关键词时不过滤。

过滤：

- 有 `DASHSCOPE_API_KEY` 时调用 `qwen-plus`；
- 请求返回相关标题索引；
- LLM 失败时返回未过滤结果，不阻断页面。

接口：`GET /api/trends/industry?persona=...&limit=...`。

## 10.4 选题库

| 方法 | 路径 | 作用 |
|---|---|---|
| GET/POST | `/api/ideas` | 列表和创建 |
| PUT/DELETE | `/api/ideas/{id}` | 更新和删除 |

热点和对标帖子可写入：

```text
title, note, source, status, created
```

## 10.5 内容日历

| 方法 | 路径 | 作用 |
|---|---|---|
| GET/POST | `/api/schedule` | 列表和创建 |
| PUT/DELETE | `/api/schedule/{id}` | 更新和删除 |
| GET | `/api/schedule/context` | 发布节奏和断更建议 |

排期既可表示普通内容，也可表示节日、电商活动和平台事件。

## 10.6 运营数据分析

接口：

```text
GET /api/analytics/platforms
GET /api/analytics/{platform}
```

该功能保留原始基线的数据分析入口，用于：

- 返回当前支持读取运营数据的平台；
- 调用相应平台脚本读取公开或已授权的账号数据；
- 为工作台、复盘和后续选题提供参考；
- 平台未登录、无数据或抓取失败时返回明确状态，不伪造统计结果。

## 10.7 爆款拆解和做内容

- 热点标题可直接预填对话；
- 对标帖子将正文/摘要作为来源上下文；
- “拆解”进入 BreakdownPage；
- “做内容”进入 ChatPage；
- “收藏”进入 IdeasPage。

## 10.8 验收

- 主数据源失败可使用备源或缓存；
- 行业过滤失败不导致空页面；
- 收藏不会重复创建同一前端操作；
- 热点、对标、选题、拆解和聊天之间可跳转；
- 排期数据可持久化；
- 运营数据不可用时返回真实状态，不生成虚假统计。

---

# 11. M08：对标账号

## 11.1 模块目标

建立“发现账号 → 验证账号 → 加入画像 → 抓取动态 → 收藏/拆解/二创 → 沉淀账号池”的跨平台闭环。

## 11.2 统一账号模型

```json
{
  "id": "platform:stable_identifier",
  "platform": "bilibili",
  "identifier": "946974",
  "name": "账号名称",
  "profile_url": "https://...",
  "rss_url": "/bilibili/user/dynamic/946974",
  "avatar": "https://...",
  "description": "简介",
  "followers": 100000,
  "category": "科技视频",
  "tags": ["科技", "视频"],
  "source": "browser_network",
  "verified": true,
  "feed_status": "healthy",
  "last_verified_at": 0
}
```

去重使用平台稳定 ID，不使用昵称、临时 token 或短期签名。

## 11.3 对标页面

`BenchmarkPage.tsx`：

```text
左栏：平台和账号
中栏：帖子信息流
右栏：帖子详情和操作
设置：在线搜索 / 粘贴链接 / 推荐账号池 / RSSHub
```

支持：

- 平台和账号筛选；
- 搜索分页和粉丝阈值；
- 账号来源显示；
- 按平台分组；
- 收藏、拆解和做内容；
- 手动刷新和状态轮询。

## 11.4 画像对标配置

文件：`outputs/_benchmarks/<persona>/config.json`。

保存：

```text
accounts[]
keywords
```

整体保存接口用于设置页；`/api/benchmarks/add` 用于增量添加单个账号，禁止搜索添加覆盖其他平台账号。

## 11.5 动态账号池

文件：`outputs/_benchmark_pool.json`。

规则：

- 不存在时由内置种子初始化；
- 查询支持 keyword、platform、page、limit 和 followers 排序；
- 账号验证后 upsert；
- 相同稳定 ID 合并非空字段；
- 已验证的画像账号自动进入池；
- 前端 `benchmarkPool.ts` 仍有兼容静态种子，后续应删除重复来源。

## 11.6 链接识别

支持：

- 小红书主页和短链；
- 抖音主页和短链；
- B站空间和 b23 短链；
- 微博主页；
- 知乎个人/机构；
- 头条主页；
- 快手主页；
- 公众号文章中的 `__biz`。

安全流程：

```text
从分享文本提取 URL
→ 校验 http/https
→ 校验受信域名
→ 若为短链，使用自定义 redirect handler
→ 每次跳转继续校验域名
→ 提取稳定 ID
→ 生成 profile_url 和 rss_url
→ 尝试验证 Feed
```

## 11.7 B站 API 搜索

- 调用公开用户搜索 API；
- 解析 MID、昵称、头像、签名和粉丝；
- 支持分页、粉丝阈值和排序；
- 缓存 10 分钟；
- API 失败后调用浏览器脚本降级。

## 11.8 浏览器搜索脚本

`skills/shared/scripts/browser_account_search.py`：

```text
search    按关键词搜索账号
profile   读取主页和公开帖子
login     打开登录页等待用户
platforms 输出平台能力
```

平台：小红书、抖音、B站、微博、知乎、头条、公众号、快手、36氪。前端账号搜索主要展示前八个平台；36氪更适合作为内容源。

实现原则：

- 平台独立持久化 Profile；
- 同平台使用 `fcntl.flock`；
- 优先捕获页面已签名网络响应；
- DOM 稳定 href/语义选择器降级；
- 不自行构造动态签名；
- 小红书、抖音、快手使用有头模式；
- 登录或验证码时保持浏览器打开；
- 真实 IP/环境风险才返回 blocked。

## 11.9 浏览器 Job

| 方法 | 路径 | 作用 |
|---|---|---|
| GET | `/api/benchmarks/browser/status` | 查询 Profile 是否存在 |
| POST | `/api/benchmarks/browser/login` | 启动登录 Job |
| POST | `/api/benchmarks/browser/search` | 启动搜索 Job |
| POST | `/api/benchmarks/browser/profile` | 启动主页 Job |
| GET | `/api/benchmarks/browser/jobs/{id}` | 查询状态 |

状态：

```text
pending → running → done | login_required | blocked | failed
```

限制：

- 同平台只允许一个 pending/running Job；
- 搜索最多返回 50 个账号；
- 主页最多返回 100 条帖子；
- 搜索最长约 11 分钟；
- Profile URL 必须匹配所选平台；
- Job 当前仅存内存，服务重启后丢失。

## 11.10 Ego Lite Cookie 导入

macOS 当前实现：

```text
读取 Ego Lite Default/Cookies 副本
→ 从 Keychain 读取 ego safe storage
→ PBKDF2 派生密钥
→ AES-CBC 解密 v10 Cookie
→ 仅筛选目标平台域名
→ 转为 Playwright Cookie
→ 注入平台上下文
```

边界：

- Cookie 不进入 API、账号池和 Git；
- 仅适配当前 macOS/Ego Lite 路径和数据库格式；
- 依赖 `cryptography`，当前 `pyproject.toml` 尚未声明；
- 失败时静默回到普通持久化 Profile；
- 后续应增加用户开关和可见状态。

## 11.11 帖子抓取引擎

`benchmark_fetch.py` 优先级：

```text
prefer-browser 的社交平台
→ browser profile 抓取
→ Folo 缓存（部分平台）
→ RSSHub 或标准 RSS
→ 平台公开页 Playwright/HTML 降级
```

落盘：

```text
outputs/_benchmarks/<persona>/<platform>_<account>/
├── posts.json
└── meta.json

outputs/_benchmarks/<persona>/
├── config.json
├── last_fetch.json
└── _status.json
```

刷新并发：

- 同平台账号串行，避免 Profile 锁冲突；
- 不同平台最多 6 组并发；
- 前端只展示仍在当前画像配置中的账号。

## 11.12 对标 API

```text
GET/POST /api/rsshub/config
GET/POST /api/benchmarks
POST     /api/benchmarks/add
GET      /api/benchmarks/posts
POST     /api/benchmarks/refresh
GET      /api/benchmarks/status
GET/POST /api/benchmarks/pool
GET      /api/benchmarks/avatar
GET      /api/benchmarks/search
POST     /api/benchmarks/resolve
GET/POST /api/benchmarks/browser/*
```

## 11.13 验收

- 增量添加不覆盖其他账号；
- 相同稳定 ID 去重；
- B站 API 失败可降级；
- 跨平台 URL 被拒绝；
- 非白名单跳转和头像被拒绝；
- 同平台浏览器并发返回 409；
- 验证码页面保持打开；
- 已登录 Profile 可复用；
- 浏览器失败后仍有 RSS/Folo/公开页链路；
- 账号可收藏、拆解和进入创作。

---

# 12. M09：账号与平台集成

## 12.1 模块目标

集中管理平台登录状态、公众号参数和 Wechatsync 运行条件，为发布中心提供可用平台清单。

## 12.2 平台账号

基础接口：

```text
GET  /api/accounts
POST /api/login/{platform}
GET  /api/login/{platform}/status
POST /api/login/{platform}/sms
GET  /api/accounts/{platform}/whoami
POST /api/logout/{platform}
```

账号页显示：

- 平台名称和发布后端；
- 是否支持；
- 登录状态、失败原因和更新时间；
- 二维码、短信或终端操作；
- whoami 昵称和头像；
- 退出操作；
- 平台登录方式说明。

## 12.3 微信公众号

接口：

```text
GET    /api/wechat-mp/config
POST   /api/wechat-mp/config
DELETE /api/wechat-mp/config/{key}
```

配置字段：

```text
key, name, app_id, app_secret, author, theme, set_default
```

要求：

- 支持多公众号；
- 支持默认账号；
- Secret 返回时脱敏；
- 空 Secret 更新不得覆盖已有 Secret；
- 配置文件不得进入 Git。

## 12.4 Wechatsync

配置顺序：

```text
下载或解压扩展
→ 用户手动加载 Chrome 扩展
→ 保存 Token
→ ping 扩展
→ 安装/检查 CLI
→ 安装/检查 Skill
→ 查询可同步平台
```

接口：

```text
GET  /api/wechatsync/check
POST /api/wechatsync/ping
GET  /api/wechatsync/platforms
POST /api/wechatsync/cli
POST /api/wechatsync/skill
GET  /api/wechatsync/extension
POST /api/wechatsync/extension
POST /api/wechatsync/token
POST /api/wechatsync/sync
```

## 12.5 验收

- 登录状态与 whoami 真实结果一致；
- 二维码过期、短信和登录失败有明确状态；
- 公众号 Secret 不回显；
- Wechatsync 缺扩展、Token 或 CLI 时可定位；
- 不把“命令提交成功”直接等同“平台草稿已验证”。

---

# 13. M10：媒体资产

## 13.1 模块目标

把视频所需的声音、音乐和人物从临时参数变为可管理、可试听、可复用和可追踪的资产。

## 13.2 音色与 TTS

接口：

```text
GET  /api/voices
POST /api/voices/default
POST /api/voices/engine
GET  /api/voices/preview/{voice_id}
POST /api/voices/clone
GET  /api/voices/clone/status/{voice_id}
DELETE /api/voices/clone/{voice_id}
```

规则：

- 页面显式 voice 优先；
- 无显式 voice 时读取当前引擎默认音色；
- 根据 voice ID 分发 CosyVoice 或 Qwen-TTS；
- 自动视频链路拒绝 Edge voice；
- TTS 失败立即停止；
- 支持逐句音频和 SRT 时间轴。

数据：`outputs/_shared/voices/`。

## 13.3 声音克隆

```text
上传样本
→ 校验格式和大小
→ 调用 Provider 创建/部署 voice
→ 保存元数据和预览
→ 轮询状态
→ 成功后进入音色列表
```

删除时同时清理本地元数据；远端是否删除取决于 Provider 能力。

## 13.4 BGM 曲库

接口：

```text
GET    /api/bgm
POST   /api/bgm
PATCH  /api/bgm/{name}
DELETE /api/bgm/{name}
```

数据：

```text
outputs/_shared/bgm/
├── <track>.mp3
└── _meta.json
```

自动选曲：

1. 根据标题和正文识别电商、科技、企业、情绪、热点、轻快等风格；
2. 先选主风格；
3. 按预设回退链查相关风格；
4. 仍无结果时查全曲库；
5. 使用内容哈希稳定选择同一首。

普通 BGM 不调用 AI 音乐；只有明确“原创音乐”需求才使用 `ai-music`。

## 13.5 数字人角色

接口：

```text
GET    /api/digital-human/characters
POST   /api/digital-human/characters
DELETE /api/digital-human/characters/{id}
GET    /api/digital-human/characters/{id}/image
```

数据：`outputs/_shared/digital-human/characters/`。

角色必须来自用户上传的真实照片，不得从普通媒体库随机选择，也不得使用生图模型伪造。

## 13.6 EMO 任务

```text
角色照片 + 本轮口播音频
→ DashScope Files 上传并取得可访问 URL
→ EMO 人脸检测
→ 创建任务
→ 保存 task_id
→ 轮询状态
→ 下载数字人视频
→ 写 tasks.json
```

接口：

```text
POST /api/digital-human/generate
GET  /api/digital-human/status/{task_key}
```

任务文件：`outputs/_shared/digital-human/tasks.json`，服务重启后可继续查询。

## 13.7 验收

- 页面默认音色真实进入 TTS；
- Edge voice 被拒绝；
- 克隆音色可创建、查询、试听和删除；
- BGM 只从公共曲库自动选择；
- 数字人只使用指定角色和本轮音频；
- EMO 状态可在重启后读取；
- 失败不伪装为成功资产。

---

# 14. M11：视频生成

## 14.1 模块目标

把正文和图片稳定转换为可发布的完整口播视频，并确保配置可确认、过程可恢复、结果可校验。

## 14.2 请求字段

`PublishJobRequest` 中与视频相关的字段：

```text
title
body
tags
media[]
voice
bgm
digital_human
digital_human_pos
generation_confirmed
force_regenerate
```

数字人位置：

```text
bottom-right | bottom-left | top-right | top-left
```

## 14.3 完整状态机

```text
校验图片和正文
→ 检查 generation_confirmed
→ 解析 voice、BGM、数字人和位置
→ 计算 fingerprint
→ 检查 completed manifest 和 MP4
→ 可复用则返回缓存
→ qwen-plus 改写口播稿
→ 分段生成 TTS
→ 生成 SRT
→ 准备 storyboard
→ assemble 合成基础视频
→ 可选生成 EMO 数字人
→ overlay 到指定位置
→ ffprobe 自检
→ 原子写 completed manifest
→ 返回最终 MP4
```

## 14.4 生成确认门

`generation_confirmed=false` 时不得调用收费媒体服务。确认项至少包括：

- 画幅和目标时长；
- voice；
- BGM；
- 数字人角色和位置；
- 是否强制重建；
- 可能发生的第三方费用。

## 14.5 Fingerprint

指纹至少覆盖：

- 标题和正文；
- 图片路径、顺序和文件状态；
- voice；
- BGM；
- 数字人角色；
- 数字人位置；
- 关键生成参数。

任何影响结果的配置变化都必须产生新指纹。

## 14.6 Manifest 与目录

```text
outputs/_generated_videos/
├── <fingerprint>.mp4
├── <fingerprint>.manifest.json
└── <fingerprint>_assets/
    ├── narration.txt
    ├── narration.wav
    ├── captions.srt
    ├── storyboard.json
    ├── base.mp4
    └── digital-human.mp4
```

只有最终 MP4 存在、manifest 状态为 completed 且通过自检时才允许缓存复用。`force_regenerate=true` 必须跳过缓存。

## 14.7 口播和字幕

- 使用 `qwen-plus` 将正文改写为自然口播；
- 不得新增无法从输入确认的事实；
- TTS 使用页面 voice；
- 按句生成或切分，记录每句时长；
- 生成同步 SRT；
- TTS 或字幕失败时停止。

## 14.8 Assemble

`skills/openclaw/auto-short-video/scripts/assemble.py`：

- 按 storyboard 组织图片；
- 生成目标画幅；
- 合并旁白；
- 烧录或叠加字幕；
- 混入 BGM；
- 输出基础 MP4；
- FFmpeg 失败时返回非零并保留日志。

## 14.9 数字人 Overlay

```text
角色照片 + narration.wav
→ EMO 视频
→ 按 digital_human_pos 计算位置
→ FFmpeg overlay
→ 输出最终视频
```

选择数字人后，EMO 失败必须使完整成片失败，不能静默回退普通视频。

## 14.10 自检

使用 ffprobe 验证：

- 文件存在且非空；
- 有视频轨；
- 有音频轨；
- 可读取时长；
- 输出路径位于允许目录。

## 14.11 失败边界

| 环节 | 失败处理 |
|---|---|
| 未确认配置 | 不调用媒体服务，返回需确认 |
| voice 无效 | 失败并提示选择音色 |
| TTS | 停止 |
| 字幕 | 停止 |
| BGM 无曲目 | 明确无 BGM 或停止，不调用 AI 音乐冒充 |
| assemble | 停止并保留中间产物 |
| 数字人 | 已选择时停止 |
| ffprobe | 停止，不写 completed |
| manifest | 不允许缓存复用 |

## 14.12 验收

- 未确认时第三方媒体调用为 0；
- voice/BGM/角色/位置/正文/图片变化会改变指纹；
- force regenerate 跳过缓存；
- completed manifest 缺失时不复用；
- 成片具有音视频轨；
- 中间产物保留；
- 必选环节失败不返回伪成功。

---

# 15. M12：发布中心

## 15.1 模块目标

将长时间、多平台、可能依赖视频生成和验证码的发布动作建模为可恢复后台任务。

## 15.2 发布请求

```text
title, body, tags
media[]
platform_contents{}
native_platforms[]
wechatsync_platforms[]
voice, bgm
digital_human, digital_human_pos
generation_confirmed
force_regenerate
```

## 15.3 草稿解析

`POST /api/publish/draft/resolve`：

- 接收会话上下文、session ID 和起始时间；
- 从对话结果和内容库中寻找正文与媒体；
- 返回最合适的发布草稿；
- 前端允许用户继续修改。

## 15.4 Job 模型

```json
{
  "id": "job_xxx",
  "status": "running",
  "request": {},
  "tasks": [
    {
      "platform": "douyin",
      "type": "media|native|wechatsync",
      "status": "pending|publishing|verified|submitted|skipped|fail|timeout",
      "message": "",
      "verified": false
    }
  ]
}
```

## 15.5 创建和调度

```text
校验至少一个平台
→ 快照原始 images/videos
→ 判断是否需要视频生成
→ 创建 media/native/wechatsync tasks
→ 未登录或缺媒体的平台标记 skipped
→ Job 落盘
→ 后台线程执行
→ 图文平台使用原始媒体
→ 视频平台等待 media task
→ 持续更新任务状态
```

## 15.6 媒体竞态

必须先计算：

```text
images, videos, req_videos, needs_video_gen
```

再启动媒体线程。任何视频生成结果都不能反向修改图文平台已经快照的媒体集合。

## 15.7 原生发布

```text
GET  /api/publish/{platform}/status
POST /api/publish/{platform}/sms
POST /api/publish/native/{platform}
```

不同平台可使用小红书、抖音、B站或通用 Web publisher。

## 15.8 Wechatsync 发布

每个平台单独一个 task。返回状态必须区分：

- `verified`：已从输出确认平台草稿；
- `submitted`：扩展已接收但未确认草稿；
- `timeout`：超过 120 秒；
- `fail`：命令失败。

## 15.9 持久化和恢复

```text
outputs/_publish/jobs/<job_id>.json
```

接口：

```text
POST /api/publish/jobs
GET  /api/publish/jobs
GET  /api/publish/jobs/{job_id}
POST /api/publish/jobs/{job_id}/cancel
```

页面刷新后读取最近 Job；取消设置 flag，后台在下一安全检查点停止。

## 15.10 重试不变量

失败重试必须复制：

- 标题、正文、标签；
- 平台定制正文；
- 原始媒体；
- voice；
- BGM；
- 数字人角色；
- 数字人位置；
- generation confirmed；
- force regenerate 策略。

## 15.11 验收

- 创建 Job 立即返回；
- 页面刷新可恢复；
- 图文平台不误用新生成视频；
- 视频平台等待生成完成；
- 取消能进入明确终态；
- 重试保留全部配置；
- 未登录和缺媒体平台明确 skipped；
- submitted 不被当作 verified。

---

# 16. M13：质量、安全与文档

## 16.1 模块目标

保证重建后的系统不仅“有功能”，还具备可验证、安全边界、诊断能力和交接依据。

## 16.2 测试覆盖

`tests/test_core.py` 当前覆盖：

| 分类 | 核心用例 |
|---|---|
| Provider | 注册表到 Web、模型名分离、配置状态 |
| TTS | 页面 voice、Edge 拒绝、失败不降级、引擎识别 |
| 输入与上传 | 文本/文件解析、同名上传、session 隔离、篡改引用 |
| 路径安全 | 目录穿越、绝对路径逃逸 |
| Agent | Skill 解析、Local/Gateway 命令 |
| 对话 | stale turn、事件恢复、失效流、停止清理、跨会话事件隔离 |
| 发布视频 | BGM、fingerprint、确认门、数字人位置、EMO 持久化、字幕 |
| 画像 | 基线写入、画像前缀和约束 |
| 对标 | 标准化、去重、账号池、B站搜索、浏览器降级、链接和域名安全 |
| 浏览器 | 平台路径、网络映射、页面状态、同平台并发 |

## 16.3 文件和附件安全

- outputs 路径必须 resolve 后仍位于根目录；
- 绝对路径和 `..` 被拒绝；
- 上传附件绑定 session；
- 系统 `_` 目录受删除保护；
- 临时文件和用户产物不进入 Git。

## 16.4 外部资源代理

图片和头像代理要求：

- HTTPS 或明确允许的协议；
- host 属于白名单或其子域；
- 响应 Content-Type 为图片；
- 限制响应体大小；
- 设置合理缓存；
- 不允许任意 URL 转发。

## 16.5 凭证保护

`.gitignore` 忽略：

- `.env*`；
- outputs 实际内容；
- 本地画像；
- Cookie 和公众号配置；
- 浏览器 Profile；
- 登录态、日志和临时文件；
- Wechatsync 扩展解压目录。

API 返回 Secret 时必须脱敏；Cookie 和 Token 不写入普通业务 JSON。

## 16.6 文档体系

| 文档 | 作用 |
|---|---|
| `ARCHITECTURE.md` | 系统架构 |
| `KEYS-GUIDE.md` | Key 和 Provider 配置 |
| `USAGE-GUIDE.md` | 用户操作 |
| `docs/USE-CASES.md` | 业务场景 |
| `docs/视频生成流程标准.md` | 视频硬门和流程 |
| `docs/跨平台对标账号浏览器搜索技术方案.md` | 平台路径、浏览器原则和实测 |
| 本文档 | 从基线完整重建的总规格 |

## 16.7 验证命令

```bash
.venv/bin/pytest tests/ -q
.venv/bin/python skills/shared/scripts/tts.py --selftest
.venv/bin/python scripts/validate_skills.py
.venv/bin/python scripts/validate_skill_commands.py
cd web/frontend && npm run build
```

本文档整理任务不执行上述测试，也不执行 Gradle 编译；结果以实际运行输出为准。

---

# 17. M14：企业与电商领域化

## 17.1 模块目标

在通用内容和视频底座上，构建事实受控、结构稳定、可批量生产的企业和电商生成器。

## 17.2 已有底座

- 企业品牌、企业新媒体、企业服务、电商种草和电商主播画像模板；
- 通用对话、内容库、音色、BGM、数字人和视频状态机；
- 行业热点和对标账号；
- 多平台发布。

## 17.3 待重建功能

### 企业事实卡

```text
企业名称
品牌定位
产品/服务
目标客户
可公开客户案例
资质与证据
禁用表述
联系方式和 CTA
```

### 商品事实卡

```text
SPU/SKU
价格与活动
库存
材质/规格
功效证据
适用人群
售后
平台合规限制
```

### 专用生成器

- 企业信任型口播；
- 企业服务获客视频；
- 商品种草；
- 带货口播；
- 商品详情；
- 平台和人群变体。

## 17.4 事实原则

- 不虚构客户、案例、资质和业务数字；
- 不虚构价格、库存、功效、材质、参数和售后；
- 生成前锁定事实卡版本；
- 脚本中的事实必须能回溯到字段；
- 批量生成必须有预算、质量和审核门。

## 17.5 当前状态

本模块目前为规划中：画像模板和通用底座已实现，但事实卡、专用页面、领域模板评分和批量任务尚未完整落地。

---

# 第三篇：横向还原清单

# 18. API 全局分类

`web/app.py` 当前注册 105 个 HTTP 路由。

## 18.1 静态与状态

```text
/
/onepage
/publish-sync-preview
/assets/{path:path}
/static/{path:path}
/api/image-proxy
/api/status
```

## 18.2 画像与 Skill

```text
/api/personas
/api/persona/{name}
/api/persona/{name}/files
/api/persona/{name}/file
/api/profile-templates
/api/profile/build
/api/profile/build/status/{name}
/api/skills
/api/skill/{name}
/api/skill
/api/env
```

## 18.3 对话与内容库

```text
/api/chat/stream
/api/chat/jobs/{turn_id}/stream
/api/chat/last/{session_id}
/api/chat/stop
/api/chat
/api/sessions
/api/session/{session_key}
/api/outputs
/api/output/{path:path}
/api/media/{path:path}
/api/upload
```

## 18.4 账号和集成

```text
/api/accounts
/api/login/{platform}
/api/login/{platform}/status
/api/login/{platform}/sms
/api/accounts/{platform}/whoami
/api/logout/{platform}
/api/wechat-mp/config
/api/wechat-mp/config/{key}
/api/wechatsync/check
/api/wechatsync/ping
/api/wechatsync/platforms
/api/wechatsync/cli
/api/wechatsync/skill
/api/wechatsync/extension
/api/wechatsync/token
/api/wechatsync/sync
```

## 18.5 发布、BGM、音色和数字人

```text
/api/publish/draft/resolve
/api/publish/{platform}/status
/api/publish/{platform}/sms
/api/publish/native/{platform}
/api/publish/jobs
/api/publish/jobs/{job_id}
/api/publish/jobs/{job_id}/cancel
/api/bgm
/api/bgm/{name}
/api/voices
/api/voices/default
/api/voices/engine
/api/voices/preview/{voice_id}
/api/voices/clone
/api/voices/clone/status/{voice_id}
/api/voices/clone/{voice_id}
/api/digital-human/characters
/api/digital-human/characters/{id}
/api/digital-human/characters/{id}/image
/api/digital-human/generate
/api/digital-human/status/{task_key}
```

## 18.6 热点、对标、排期和选题

```text
/api/trends
/api/trends/industry
/api/rsshub/config
/api/benchmarks
/api/benchmarks/add
/api/benchmarks/posts
/api/benchmarks/refresh
/api/benchmarks/status
/api/benchmarks/pool
/api/benchmarks/avatar
/api/benchmarks/search
/api/benchmarks/resolve
/api/benchmarks/browser/status
/api/benchmarks/browser/login
/api/benchmarks/browser/search
/api/benchmarks/browser/profile
/api/benchmarks/browser/jobs/{job_id}
/api/schedule
/api/schedule/{id}
/api/schedule/context
/api/ideas
/api/ideas/{id}
```

## 18.7 数据分析

```text
/api/analytics/platforms
/api/analytics/{platform}
```

---

# 19. 数据目录

```text
profiles/
├── _template/
├── _templates/
│   └── <8 个模板>/
└── <persona>/
    ├── identity.md
    ├── style.md
    ├── audience.md
    ├── platforms.md
    ├── preferences.md
    └── memory.md

outputs/
├── _generated_videos/
├── _shared/
│   ├── bgm/
│   ├── voices/
│   └── digital-human/
│       ├── characters/
│       └── tasks.json
├── _publish/jobs/
├── _sessions/
├── _inbox/
├── _login/
├── _profile_build/
├── _debug/
├── _benchmarks/<persona>/
├── _benchmark_pool.json
├── _rsshub.json
├── _schedule.json
├── _ideas.json
└── <业务项目>/

~/.easel-browser-profiles/
└── <PlatformProfile>/
```

原则：

- `profiles/_templates` 可入库；
- 用户画像、outputs、浏览器 Profile 和登录态不入库；
- `_` 系统目录不作为普通内容项目展示；
- 需要跨重启恢复的任务必须落盘；
- 临时文件使用原子替换写最终状态。

---

# 20. 主要文件到模块映射

| 文件 | 所属模块 | 作用 |
|---|---|---|
| `setup.sh`、`start.sh` | M01 | 安装和生命周期 |
| `easel/commands/doctor.py`、`ping.py` | M01 | 诊断和状态 |
| `openclaw/sync.sh`、`openclaw/workspace/AGENTS.md` | M02 | 同步和路由硬门 |
| `scripts/openai_maas_adapter.py` | M02 | MaaS 适配 |
| `skills/shared/scripts/model_registry.py` | M02 | Provider 注册表 |
| `web/frontend/src/App.tsx`、`Sidebar.tsx` | M03/M05 | 页面和会话生命周期 |
| `WelcomeGuide.tsx`、`UseCasesPage.tsx` | M03 | 引导和指南 |
| `OnboardingWizard.tsx`、`ProfilePage.tsx` | M04 | 画像创建和管理 |
| `web/app.py` chat 区域 | M05 | 流式、恢复、锁和诊断 |
| `FilePreview.tsx`、`OutputPicker.tsx` | M06 | 预览和素材复用 |
| `TrendsPage.tsx`、`IdeasPage.tsx`、`BreakdownPage.tsx` | M07 | 发现和策划 |
| `BenchmarkPage.tsx` | M08 | 对标工作台 |
| `benchmark_fetch.py`、`browser_account_search.py` | M08 | 对标抓取和浏览器搜索 |
| `benchmarkUrl.ts`、`benchmarkPool.ts` | M08 | 链接识别和兼容种子 |
| `AccountsPage.tsx` | M09 | 平台账号和集成 |
| `VoicePage.tsx`、`BgmPage.tsx` | M10 | 媒体资产页 |
| `tts.py`、`voice_clone.py` | M10/M11 | 配音和克隆 |
| `ai_image.py`、`ai_video.py`、`ai_music.py` | M02/M11 | 媒体 Provider |
| `auto-short-video/scripts/assemble.py` | M11 | 视频合成 |
| `PublishPage.tsx`、发布脚本 | M12 | 发布工作台和平台执行 |
| `tests/test_core.py` | M13 | 核心回归 |
| `ARCHITECTURE.md`、`KEYS-GUIDE.md`、`USAGE-GUIDE.md`、`docs/` | M13/M14 | 架构、配置、场景和领域方案 |

---

# 21. 从基线重建的总顺序

| 阶段 | 重建模块 | 完成标志 |
|---|---|---|
| 1 | M01 部署与运行 | 可安装、启动、停止和诊断 |
| 2 | M02 Agent/Skill/模型 | CLI/Web 可执行 Skill，Provider 配置一致 |
| 3 | M03 Web 工作台 | 所有页面可达，导航和状态可恢复 |
| 4 | M04 用户画像 | 空白/模板画像可创建并立即使用 |
| 5 | M05 对话与会话 | 流式、停止、断线恢复和并发隔离通过 |
| 6 | M06 内容库 | 产物可预览、上传隔离、历史素材可复用 |
| 7 | M07 内容发现 | 热点、行业、选题、日历和拆解形成闭环 |
| 8 | M08 对标账号 | 搜索、解析、账号池、抓取和二创可用 |
| 9 | M09 平台集成 | 平台账号、公众号和 Wechatsync 可配置 |
| 10 | M10 媒体资产 | voice、BGM、数字人可管理 |
| 11 | M11 视频生成 | 完整成片有确认门、manifest 和自检 |
| 12 | M12 发布中心 | 异步 Job 可恢复、取消和重试 |
| 13 | M13 质量安全 | 测试、白名单、凭证和文档边界通过 |
| 14 | M14 企业电商 | 在通用底座上实现事实卡和专用生成器 |

---

# 22. 当前技术债

## 22.1 P0

1. `browser_account_search.py` 使用 `cryptography`，但可选依赖尚未声明；
2. Ego Lite Cookie 导入缺用户开关和可见状态；
3. 浏览器搜索 Job 只存在内存，服务重启后无法恢复；
4. 真实平台登录、搜索、媒体生成和发布仍需回归矩阵；
5. 需要复核生产部署下的 CORS 和服务暴露范围。

## 22.2 P1

1. `web/app.py` 超过 6,000 行，应按模块拆分 router/service/store；
2. 后台线程和 subprocess 应统一为 Job 抽象；
3. 前后端对标种子应合并为后端单一来源；
4. 对标浏览器 Profile 与发布 Profile 应统一归属和锁；
5. benchmark 平台逻辑应抽象统一 Provider；
6. 前端应按页面代码分割。

## 22.3 P2

1. 对标帖子增量游标、历史去重和趋势分析；
2. 企业与商品事实卡；
3. 领域脚本模板和质量评分；
4. 批量视频变体和预算控制；
5. 审批、法务、品牌资产和归因。

---

# 23. 最终完成定义

从原始基线重建到当前目标，必须满足：

- 14 个模块边界清晰，每项功能具有明确的主归属；
- 53 个提交和 137 个文件的主要修改均映射到模块；
- 用户可安装、启动、诊断并进入 Web；
- Skill 和 Provider 使用统一配置源；
- 画像可从空白或 8 个模板创建；
- 对话支持流式、停止、恢复、并发隔离和后端会话同步；
- 内容库可预览并可作为新对话素材；
- 热点、行业、对标、选题、拆解和制作形成闭环；
- 对标账号支持搜索、链接识别、动态池、增量保存和多源抓取；
- 平台账号、公众号和 Wechatsync 可集中配置；
- voice、BGM 和数字人是可管理资产；
- 视频生成有确认门、fingerprint、manifest、中间产物和 ffprobe 自检；
- 发布 Job 可恢复、取消和重试；
- 必选环节失败不伪装成功；
- 路径、附件、代理域名和凭证有明确安全边界；
- 已实现、部分验证、规划中和技术债不混写；
- 自动测试、Skill 校验、前端构建和真实平台 PoC 由执行者按本规格复验。
