# Easel Skills 索引

> 共 **113 个 Skill**，按功能和层级分为 6 大类、22 子类。
>
> Skill 是 Easel 的能力单元——每个 Skill 解决一个具体的内容创作问题，AI Agent 会根据对话自动调用。

---

## 目录

- [发现层（输入）](#discover-9)（9 个）
  - [热点与趋势](#热点与趋势)
  - [竞品与赛道](#竞品与赛道)
  - [资讯与素材](#资讯与素材)
- [策划层](#plan-16)（16 个）
  - [画像与定位](#画像与定位)
  - [选题与策略](#选题与策略)
- [制作层](#produce-51)（51 个）
  - [AI 生成（图/视频/音乐/语音）](#AI-生成图/视频/音乐/语音)
  - [小红书内容](#小红书内容)
  - [文案与文本](#文案与文本)
  - [视频制作与编辑](#视频制作与编辑)
  - [音频处理](#音频处理)
  - [图片与设计](#图片与设计)
  - [文档与知识](#文档与知识)
- [发布层](#publish-20)（20 个）
  - [平台发布](#平台发布)
  - [发布质量与安全](#发布质量与安全)
  - [发布运营](#发布运营)
- [分析层](#attribute-11)（11 个）
  - [数据分析与复盘](#数据分析与复盘)
- [通用层](#general-6)（6 个）
  - [画像与模板](#画像与模板)

---

## 能力分布

| 层级 | 中文名 | 数量 | 核心职责 |
|---|---|---|---|
| `discover` | 发现层（输入） | 9 | 抓热点、看竞品、找选题灵感 |
| `plan` | 策划层 | 16 | 定策略、做排期、建画像定位 |
| `produce` | 制作层 | 51 | AI 生成 + 剪辑 + 设计 + 文案 |
| `publish` | 发布层 | 20 | 多平台发布 + 质量检查 + 运营 |
| `attribute` | 分析层 | 11 | 数据追踪 + 复盘 + ROI |
| `general` | 通用层 | 6 | 画像管理 + 模板 + 素材 + 批量 |
| **合计** | | **113** | |

---

## 发现层（输入）（9 个）

### 热点与趋势

| Skill | 功能说明 |
|---|---|
| [`skill-trending-topics`](./skill-trending-topics/SKILL.md) | 抓取多平台实时热搜数据，筛选与创作者赛道相关的热点，输出可操作的二创选题。 |
| [`skill-trend-rider`](./skill-trend-rider/SKILL.md) | 给一个热点事件，结合创作者定位，输出具体的蹭热点内容方案。 |
| [`skill-algorithm-updates`](./skill-algorithm-updates/SKILL.md) | 聚合中文社媒平台的算法更新、推荐机制变化与流量规则调整，输出结构化简报。 |

### 竞品与赛道

| Skill | 功能说明 |
|---|---|
| [`skill-competitor-analysis`](./skill-competitor-analysis/SKILL.md) | 对同赛道竞品账号做全维度内容拆解：选题分布、发布节奏、爆款规律、格式偏好、互动模式，找出差异化机会，输出可落地的行动建议。 |
| [`skill-content-gap-analysis`](./skill-content-gap-analysis/SKILL.md) | 扫描目标赛道在社媒平台上的内容供给与用户需求，找出"需求旺但好内容少"的蓝海选题，输出带优先级的选题清单。 |
| [`skill-cross-platform-diff`](./skill-cross-platform-diff/SKILL.md) | 分析同一话题在不同中文社媒平台的呈现差异，输出平台适配策略。 |

### 资讯与素材

| Skill | 功能说明 |
|---|---|
| [`skill-rss-aggregator`](./skill-rss-aggregator/SKILL.md) | 把一批订阅源的最新更新聚合成摘要，用于每日选题与资讯追踪。走 `scripts/rss_digest.py` |
| [`skill-news-intelligence`](./skill-news-intelligence/SKILL.md) | 从中文行业媒体与垂类资讯源抓取深度内容，按创作者赛道过滤， |
| [`skill-event-calendar`](./skill-event-calendar/SKILL.md) | 查询未来 N 天的节日、纪念日、电商节点、行业事件，为创作者提供内容蹭点和提前准备的时间窗口。 |
| [`skill-ugc-discovery`](./skill-ugc-discovery/SKILL.md) | 搜索与创作者品牌/账号相关的用户生成内容，发现粉丝内容、测评、提及和社区讨论，输出可互动的 UGC 列表。 |

---

## 策划层（16 个）

### 画像与定位

| Skill | 功能说明 |
|---|---|
| [`skill-voice-builder`](./skill-voice-builder/SKILL.md) | 通过结构化访谈 + 写作样本分析，生成个人声音画像（about-me.md + voice.md），确保后续内容创作的品牌一致性。 |
| [`skill-positioning-analysis`](./skill-positioning-analysis/SKILL.md) | 找到"我和别人不一样、且用户需要"的位置。领域方法在 `references/positioning-frameworks.md`， |
| [`skill-audience-profiler`](./skill-audience-profiler/SKILL.md) | 你是受众研究和人群画像专家。当创作者需要定义目标受众、构建粉丝画像或做人群细分时，按此框架执行。 |
| [`skill-brand-onboarding`](./skill-brand-onboarding/SKILL.md) | 通过结构化访谈 + 公开信息采集，为创作者/品牌生成完整的 Easel 账号画像（Profile）。 |
| [`skill-account-diagnosis`](./skill-account-diagnosis/SKILL.md) | 账号诊断/起号体检：读取已完善的画像 Profile + 近期内容数据，诊断垂直度、定位清晰度、限流降权信号、流量池阶段，给出病因→证据→处方式的起号意见与发布建议。当用户说账号诊断/起号体检/... |

### 选题与策略

| Skill | 功能说明 |
|---|---|
| [`skill-topic-evaluator`](./skill-topic-evaluator/SKILL.md) | 用户给一个选题，多维度打分评估值不值得做，输出"做/不做/改方向"建议。 |
| [`skill-content-strategy`](./skill-content-strategy/SKILL.md) | 你是资深内容策略师。为社媒创作者制定完整的内容策略——从定位到落地原则，输出一份可执行的策略文档。 |
| [`skill-content-matrix`](./skill-content-matrix/SKILL.md) | 将用户的内容支柱与 8 种内容格式交叉，生成选题矩阵，每个单元格产出一个具体、可直接执行的选题标题。 |
| [`skill-content-calendar`](./skill-content-calendar/SKILL.md) | 你是一名社媒内容策划师。为创作者规划一个月的内容排期——每条选题足够具体，文案写手看了就能直接动笔；整体混搭足够策略性，让账号持续增长。 |
| [`skill-campaign-planner`](./skill-campaign-planner/SKILL.md) | 产出一份可落地的营销活动方案，覆盖目标→节奏→内容矩阵→玩法→资源→风险→复盘指标。 |
| [`skill-collab-proposal`](./skill-collab-proposal/SKILL.md) | 根据合作需求，查询 KOL 定价表计算报价区间，用平台系数公式预估 KPI，输出可直接发送给品牌方或合作方的结构化提案。 |
| [`skill-hook-generator`](./skill-hook-generator/SKILL.md) | 针对任意主题，生成 6 种经过验证的 Hook 变体，每条 Hook 为 2 行结构（开场 + 反转），用于社媒内容开头的注意力捕获。 |
| [`skill-article-outline`](./skill-article-outline/SKILL.md) | 基于搜索分析，生成结构化长文大纲（标题层级、段落字数、图表位置、FAQ），适用于微信公众号、知乎专栏、博客等平台。 |
| [`skill-carousel-planner`](./skill-carousel-planner/SKILL.md) | 规划多图笔记/轮播图的分页结构：封面 Hook、内容节奏、每页文案和视觉方向、CTA 设计，附互动潜力评分。 |
| [`skill-livestream`](./skill-livestream/SKILL.md) | 为直播生成完整方案，覆盖主题策划、流程编排、全场话术脚本，适配带货/知识/娱乐多场景。 |

---

## 制作层（51 个）

### AI 生成（图/视频/音乐/语音）

| Skill | 功能说明 |
|---|---|
| [`ai-image-gen`](./ai-image-gen/SKILL.md) | 通用 AI 生图：文生图 / 图生图 / 图像变体。当用户说 AI 生图、AI 画图、文生图、图生图、生成图片、生成配图、图像生成、AI 出图、AI 作图、换图、改图、图像编辑、给我画一张、生成... |
| [`ai-video-gen`](./ai-video-gen/SKILL.md) | AI 视频生成：文生视频 / 图生视频 / 数字人首帧驱动。通过可插拔 provider（通义万相 Wan / 火山 Seedance / 快手可灵 / OpenAI 兼容）异步生成视频，用户自... |
| [`ai-music`](./ai-music/SKILL.md) | AI 音乐 / BGM 生成：给短视频、社媒内容生成原创背景音乐 / 配乐 / 纯音乐。通过可插拔 provider（阿里 DashScope / Suno 类第三方 API）文生音乐，异步提交... |
| [`tts-voiceover`](./tts-voiceover/SKILL.md) | 文字转语音配音：把文案/脚本合成为 AI 语音口播、旁白、朗读音频。**配了 VOICE_PROVIDER 默认走闭源云 TTS（CosyVoice2 等，有情感、像真人），edge 仅无 ke... |
| [`voice-clone`](./voice-clone/SKILL.md) | 上传本人语音样本克隆专属音色，再用它合成口播、旁白或带货语音。当用户说“声音克隆、克隆/复刻我的声音、用我的声音配音、定制专属音色”时使用，需要用户自备云端 provider 凭证。使用公共现成... |

### 小红书内容

| Skill | 功能说明 |
|---|---|
| [`xhs-note-creator`](./xhs-note-creator/SKILL.md) | 把一个主题 + 可选素材，生成**图文卡片组**或**短视频分镜脚本**，按规范输出到 `outputs/`。 |
| [`card-xiaohongshu`](./card-xiaohongshu/SKILL.md) | 把已有卡片文案渲染为 1080×1440 小红书竖版知识卡片组，并按 card-design 选择视觉风格。当用户说“渲染/制作小红书卡片、知识卡、滑动卡片组”时使用。整套笔记策划与文案用 xh... |
| [`card-design`](./card-design/SKILL.md) | 这不是一个"生成器",而是一套**设计系统 + 硬规则**。所有"HTML/CSS → 截图"的卡片/海报 SKILL |
| [`card-quote`](./card-quote/SKILL.md) | 生成适合微博、知乎、公众号或 X/Twitter 分享的 16:9 横版金句卡和数据卡。当用户说“做金句卡、语录卡、数据卡、横版分享卡”时使用。小红书竖版知识卡用 card-xiaohongsh... |

### 文案与文本

| Skill | 功能说明 |
|---|---|
| [`copywriting`](./copywriting/SKILL.md) | 为国内营销场景撰写和优化高转化文案：种草、信息流广告、卖点提炼、活动促销、电商详情页、落地页。套经典框架，落国内语境。 |
| [`social-content`](./social-content/SKILL.md) | 跨平台通用/兜底的社媒内容生成器。为国内平台（小红书 / 抖音 / B站 / 微博 / 公众号 / 知乎）为主、出海平台（X、LinkedIn）为辅，生成原生格式的钩子文案、正文、标签策略和... |
| [`text-polisher`](./text-polisher/SKILL.md) | 两刀流打磨：系统化编辑提升质量 + 去 AI 感让文字像人写的。 |
| [`text-condenser`](./text-condenser/SKILL.md) | 把长文本压缩到指定字数，保留核心信息，适配不同平台的字数限制。 |
| [`style-transfer`](./style-transfer/SKILL.md) | 把文案从一种风格改写成另一种风格，保留核心语义，只改表达方式。 |
| [`post-formatter`](./post-formatter/SKILL.md) | 用 PAS / AIDA / BAB / STAR / SLAY 五大经典框架，把一个主题结构化成中文社媒长文帖子。 |
| [`novel-writer`](./novel-writer/SKILL.md) | 一句灵感 → 世界观/人设 → 三级大纲 → 逐章正文。核心是**长篇一致性**： |

### 视频制作与编辑

| Skill | 功能说明 |
|---|---|
| [`video-script`](./video-script/SKILL.md) | 根据目标时长自动适配短视频或中长视频模式，生成留存率优化的结构化脚本。 |
| [`video-strategy`](./video-strategy/SKILL.md) | 视频制作策略与工具选型。覆盖 AI 视频生成模型对比、程序化视频框架选择、视频脚本结构设计、制作流程规划。 |
| [`video-editing`](./video-editing/SKILL.md) | 用自然语言指令做通用视频处理。所有操作都调用共享脚本 |
| [`video-reframe`](./video-reframe/SKILL.md) | 智能转换视频画幅，支持 9:16/16:9/1:1、模糊背景填充、焦点裁切和人脸居中裁切。当用户说“横竖版互转、改成 9:16、转竖屏、去黑边、适配平台尺寸、人脸居中裁”时使用。通用简单裁切用 ... |
| [`video-highlights`](./video-highlights/SKILL.md) | 长视频 / 直播录像高光切片：从一条长视频里找出高光片段，切成多条独立短视频，可选转竖版 9:16 + 加字幕。找点两种方式——音频能量峰值（情绪高涨/欢呼/大声处）或转录后由内容判断挑金句段。... |
| [`video-chapters`](./video-chapters/SKILL.md) | 视频章节 / 时间戳目录：给中长视频自动生成章节划分和时间戳目录，用于 B站分P/YouTube 章节/视频描述区，方便观众跳转、提升完播。当用户说 视频章节、章节目录、时间戳、分章节、视频目录... |
| [`video-intro-outro`](./video-intro-outro/SKILL.md) | 视频片头 / 片尾：生成带标题、副标题、logo、关注引导的片头卡片和片尾卡片，并拼接到主视频（硬切或淡入淡出转场）。当用户说 片头、片尾、加片头片尾、开场卡片、结尾卡片、标题卡、关注引导页、订... |
| [`video-to-article`](./video-to-article/SKILL.md) | 把口播、讲座、直播或 Vlog 转录并改写成小红书笔记、公众号文章或知乎内容，同时抽帧配图。当用户说“视频转图文/文章/笔记、视频扒文案、口播转文章、视频内容复用”时使用。只生成字幕文件用 au... |
| [`clipify`](./clipify/SKILL.md) | Find the funniest moments in a video, cut them as standalone clips, optionally reformat 16:9 → 9:... |
| [`auto-short-video`](./auto-short-video/SKILL.md) | 一句话主题 → 成品短视频：自动串联 文案→配图/AI视频→配音→字幕→BGM→合成，把 Easel 制作层零件编排成一条'一键出片'流水线。**单条视频、口播/资讯向，画面默认逐句配图 + K... |
| [`short-drama`](./short-drama/SKILL.md) | **配置检查路径铁律**：整条流水线开始前先 `cd` 到 `AGENTS.md` 末尾给出的 Easel 项目根，确认 `.env` 与 `skills/shared/scripts/` ... |
| [`slideshow-video`](./slideshow-video/SKILL.md) | 图片相册 → 视频：把一组图片做成带 Ken Burns 缓慢缩放、图间转场、背景音乐和逐图字幕的视频，自动适配平台画幅（竖版/方形/横版）。当用户说 图片转视频、图片做成视频、相册视频、照片视... |
| [`beat-sync-video`](./beat-sync-video/SKILL.md) | 音乐卡点视频 / 踩点视频：检测背景音乐的节拍，让图片或片段在节拍点上切换，配推进/白闪特效，做出燃系'卡点'短视频。当用户说 卡点视频、踩点视频、音乐卡点、节奏卡点、按音乐切换、鼓点视频、踩节... |

### 音频处理

| Skill | 功能说明 |
|---|---|
| [`audio-editing`](./audio-editing/SKILL.md) | 通用音频处理：音频剪辑/裁剪、格式转码（mp3/wav/m4a/aac）、音量归一化、从视频提取音轨、多段拼接、淡入淡出、变速（保音高）。当用户说“剪音频”“裁一段”“转成 mp3”“调音量/响... |
| [`audio-denoise`](./audio-denoise/SKILL.md) | 清理录音中的背景噪声。降噪专项 SKILL——通过共享脚本 `skills/shared/scripts/audio_ops.py denoise` 封装 ffmpeg 降噪滤镜，提供三级方案（... |
| [`audio-mix`](./audio-mix/SKILL.md) | 音频混合 / 混音：把旁白口播 + 背景音乐 + 音效混成一轨，BGM 自动循环补足并可闪避（旁白说话时自动压低 BGM 保证人声清晰）。当用户说 混音、音频混合、旁白加背景音乐、配音加BGM、... |
| [`audio-visualizer`](./audio-visualizer/SKILL.md) | 音频可视化视频：把纯音频（播客片段、音乐、口播金句、电台）渲染成带动态波形/频谱的视频，配封面和标题，好发到抖音/B站/视频号等只收视频的平台。当用户说 音频可视化、音频转视频、播客做成视频、音... |
| [`auto-subtitle`](./auto-subtitle/SKILL.md) | 自动字幕 / 语音转字幕：把音频或视频里的语音识别成字幕文件（SRT/ASS/TXT/JSON），可选把字幕烧录进视频。当用户说自动字幕、语音转字幕、视频加字幕、上字幕、转录、听写、字幕文件、生... |
| [`subtitle-translate`](./subtitle-translate/SKILL.md) | 字幕翻译 / 双语字幕：把已有字幕（SRT/VTT/ASS）翻译成目标语言，生成双语（原文+译文）或纯译文字幕，并可软挂载 / 硬烧录进视频。当用户说 字幕翻译、翻译字幕、双语字幕、中英字幕、给... |
| [`multi-voice-dubbing`](./multi-voice-dubbing/SKILL.md) | 把「多人对话 / 多角色脚本」合成为**多声线音轨**——每个角色一个符合其人设的声音， |

### 图片与设计

| Skill | 功能说明 |
|---|---|
| [`image-editing`](./image-editing/SKILL.md) | 对**已有图片**做确定性处理：缩放/裁剪/补边/转格式/压缩/水印/圆角/拼接/缩略图。 |
| [`image-enhance`](./image-enhance/SKILL.md) | 图片增强 / 放大 / 变清晰：高质量放大（Lanczos 2x/4x）+ 去噪 + 锐化 + 自动对比度/饱和度，改善偏糊、偏暗、噪点多的图片。当用户说 图片放大、图片变清晰、提高清晰度、图片... |
| [`remove-bg`](./remove-bg/SKILL.md) | 图片去背景 / 抠图 / 换背景：用 AI 语义分割把主体从背景抠出，输出透明 PNG，或直接换成纯色（电商白底）/ 新场景背景。无需绿幕。当用户说 去背景、抠图、抠图换背景、去掉背景、透明背景... |
| [`green-screen`](./green-screen/SKILL.md) | 绿幕抠像 / 换背景 / 合成：把绿幕（或蓝幕/指定色）拍摄的前景人物抠出来，合成到新背景——图片、视频、纯色或前景自身模糊。当用户说 绿幕、抠像、抠图换背景、去绿幕、chromakey、绿幕合... |
| [`meme-generator`](./meme-generator/SKILL.md) | 表情包 / Meme 生成：给图片加经典上下大字（白字黑边）做梗图，或在图上/下加配文条做反应图（'当…的时候'格式）。中英文都支持，自动换行和字号自适应。当用户说 表情包、做表情包、meme、... |
| [`poster-hero`](./poster-hero/SKILL.md) | 生成 1080×1920 竖版营销海报，包含大标题、核心卖点和可选二维码，适合产品发布、活动宣传与朋友圈传播。当用户说“做竖版营销海报、活动宣传图、朋友圈海报、产品发布海报”时使用。横版金句卡用... |
| [`infographic`](./infographic/SKILL.md) | 将数据或文字内容转化为可视化信息图，支持静态（AntV）和动画 GIF 两种模式。当用户需要制作信息图、数据可视化、流程图、对比图、动画图表、GIF 图表、思维导图、SWOT 分析图时调用。本地... |
| [`chart-visualization`](./chart-visualization/SKILL.md) | 将数据可视化为图表。当用户需要生成柱状图、折线图、饼图、散点图、雷达图、桑基图、思维导图、流程图等图表时调用此技能，通过 curl 工具调用 AntV API 生成图表图片。产出静态图片 URL... |
| [`data-report`](./data-report/SKILL.md) | 把 CSV、Excel 或 JSON 数据生成包含 KPI、图表和洞察的完整可视化报告页。当用户说“数据报告、CSV/Excel 转报告、做 KPI 看板、生成可视化报告页”时使用。单张图表用 ... |
| [`comparison-card`](./comparison-card/SKILL.md) | 生成 A vs B 可视化对比卡片，一张截图说清楚差异，适合社媒分享。 |
| [`ecom-details-image`](./ecom-details-image/SKILL.md) | 当用户需要视觉策略、图片 Prompt、商品主图、营销图、社媒图、广告图、电商 PDP 视觉，或要求直接 AI 生图时，使用这个 Skill。 |

### 文档与知识

| Skill | 功能说明 |
|---|---|
| [`doc-convert`](./doc-convert/SKILL.md) | 把 Markdown 文稿排版并转换为 HTML、可打印 PDF 或长图 PNG。当用户说“Markdown/MD 转 HTML/PDF/图片、文章导出长图、MD 排版/渲染”时使用。仅处理 M... |
| [`mindmap`](./mindmap/SKILL.md) | 思维导图：把 Markdown 大纲（标题层级 + 列表）渲染成可交互思维导图 HTML，可选导出 PNG。适合知识结构、内容框架、SWOT、脑图梳理。当用户说 思维导图、脑图、mindmap、... |
| [`paper-explainer`](./paper-explainer/SKILL.md) | 把一篇论文讲成普通人/同行都爱看的视频号视频或图文。核心中间产物是一份 |
| [`web-material-sourcing`](./web-material-sourcing/SKILL.md) | 从公网搜索、验证并收集图片、图表、网页与开放资料，供 PPT、知识卡、小红书卡片或视频使用。当用户说“找素材”、“网上找图”、“给 PPT 配图”或需要外部参考资料时使用；不用于只检索项目内已有文件。 |

---

## 发布层（20 个）

### 平台发布

| Skill | 功能说明 |
|---|---|
| [`skill-xhs-publisher`](./skill-xhs-publisher/SKILL.md) | 你是"小红书发布助手"。目标是在用户确认后，调用 `xhs_publish.py` 完成**图文/视频发布**。 |
| [`skill-xhs-comment-reply`](./skill-xhs-comment-reply/SKILL.md) | 你是"小红书评论互动助手"。目标：把一条笔记下的评论拉出来，并在用户确认后，用**符合画像语气** |
| [`skill-douyin-upload`](./skill-douyin-upload/SKILL.md) | 在用户确认后，调用 `douyin_publish.py` 完成**视频/图文发布**。 |
| [`skill-bilibili-upload`](./skill-bilibili-upload/SKILL.md) | 包装成熟的 **biliup** CLI 做 B站投稿。走 `scripts/bili_upload.py`（分区名映射 + 参数校验 + |
| [`skill-kuaishou-upload`](./skill-kuaishou-upload/SKILL.md) | 基于通用浏览器发布框架 `../../shared/scripts/web_publisher.py`（`--platform kuaishou`）。 |
| [`skill-channels-upload`](./skill-channels-upload/SKILL.md) | 基于通用浏览器发布框架 `../../shared/scripts/web_publisher.py`（`--platform weixin-channels`）。 |
| [`skill-wechat-publisher`](./skill-wechat-publisher/SKILL.md) | 从素材输入到公众号草稿箱的完整自动化流程：用户只需提供话题或参考资料，skill 完成搜索调研、撰写、配图、排版、AI 味自检、发布。 |
| [`skill-zhihu-publisher`](./skill-zhihu-publisher/SKILL.md) | 基于通用浏览器发布框架 `../../shared/scripts/web_publisher.py`（`--platform zhihu`）。 |
| [`skill-zhihu-answer`](./skill-zhihu-answer/SKILL.md) | 在知乎问答帖子下发布原创回答：搜索热门问题 → 检查可答性 → 调用制作层 SKILL 写内容 → Playwright 发布。 |
| [`skill-cross-platform-publish`](./skill-cross-platform-publish/SKILL.md) | 一稿多发：按各平台规范适配同一份内容，再逐平台委派发布 SKILL。走 |
| [`skill-content-repurposing`](./skill-content-repurposing/SKILL.md) | 将一篇长内容拆解为多平台原生素材，根据各平台特性适配格式、长度与语气，实现「一次创作，全域分发」。 |

### 发布质量与安全

| Skill | 功能说明 |
|---|---|
| [`skill-quality-gate`](./skill-quality-gate/SKILL.md) | 一个 SKILL 完成两道把关：合规风险检测 + 产物质量审核。 |
| [`skill-risk-scanner`](./skill-risk-scanner/SKILL.md) | 基于 LLM 文本分析能力，评估内容的原创度风险和素材版权风险，输出定性风险报告与改进建议。 |
| [`skill-seo-quality`](./skill-seo-quality/SKILL.md) | 让内容能被平台搜索到、排得靠前。以国内内容平台的站内搜索机制为主体，网页/博客 web SEO 作为可选模式。 |
| [`skill-publish-checklist`](./skill-publish-checklist/SKILL.md) | 发布前的最后一道关卡，逐项检查内容是否齐全，防止漏标题、漏封面、漏标签等低级错误。 |
| [`skill-persona-check`](./skill-persona-check/SKILL.md) | 检查内容是否符合创作者人设和品牌调性，输出一致性评分与偏离诊断。 |

### 发布运营

| Skill | 功能说明 |
|---|---|
| [`skill-publish-scheduler`](./skill-publish-scheduler/SKILL.md) | 管理一张排期表（内容×平台×时间），到点把任务派发给各平台发布 SKILL。走 |
| [`skill-publish-notify`](./skill-publish-notify/SKILL.md) | 内容发布后把结果推到团队 IM 群机器人或任意 webhook。走 `scripts/notify.py`（纯标准库无依赖）。 |
| [`skill-short-link`](./skill-short-link/SKILL.md) | 给链接拼 UTM 追踪参数并缩短，追踪各平台引流效果。走 `scripts/shortlink.py`（纯标准库无依赖， |
| [`skill-community-ops`](./skill-community-ops/SKILL.md) | 发布后的运营层能力：回复评论、从评论挖选题、负面事件时分级响应。三种模式，命中哪个做哪个。 |

---

## 分析层（11 个）

### 数据分析与复盘

| Skill | 功能说明 |
|---|---|
| [`redbook`](./skill-xhs-analyzer/SKILL.md) | 用 `redbook` CLI 搜索笔记、读内容、分析创作者、提取爆款规律、研究选题。**OpenClaw 用户：** `clawhub install redbook` 或 `npm inst... |
| [`skill-publish-log`](./skill-publish-log/SKILL.md) | 记录、查询、统计每次社媒内容发布的信息，作为复盘和归因的数据底座。 |
| [`skill-publish-analytics`](./skill-publish-analytics/SKILL.md) | 读取 publish-log.json，从时间、标签、类型、增长四个维度分析内容表现，输出结构化归因报告。 |
| [`skill-social-performance-review`](./skill-social-performance-review/SKILL.md) | 分析上月社媒内容表现，找出有效模式与失败原因，输出客户可读的复盘报告和下月可执行建议。 |
| [`skill-content-postmortem`](./skill-content-postmortem/SKILL.md) | 拆解单条内容的成败原因，或从多条内容中提炼可复制的爆款公式。 |
| [`skill-post-scorer`](./skill-post-scorer/SKILL.md) | 对社媒帖子草稿进行互动潜力评分，基于历史表现数据输出结构化评分卡。 |
| [`skill-data-tracker`](./skill-data-tracker/SKILL.md) | 记录社媒指标快照、分析粉丝增长趋势、追踪内容生命周期，用时间序列数据驱动运营决策。 |
| [`skill-comment-insights`](./skill-comment-insights/SKILL.md) | 对评论做量化洞察：情感分布、高频词/短语、需求与吐槽挖掘。走 |
| [`skill-strategy-advisor`](./skill-strategy-advisor/SKILL.md) | 基于现有内容数据与画像，给出下一阶段的内容策略优化建议。 |
| [`roi-calculator`](./roi-calculator/SKILL.md) | 根据用户提供的投放数据，计算标准营销效果指标，对比行业基准，输出结构化分析报告。 |
| [`skill-content-calendar-log`](./skill-content-calendar-log/SKILL.md) | 记录发布 + 排期 + 平台活动到一条时间线，供规划读回。产物即 Web「内容日历」页所见。 |

---

## 通用层（6 个）

### 画像与模板

| Skill | 功能说明 |
|---|---|
| [`skill-profile-builder`](./skill-profile-builder/SKILL.md) | 首次使用引导：从社媒链接分析、从零生成账号画像 Profile。收集社媒链接+运营意图，分析已发内容与收藏喜好，生成 6 维 Profile。当用户说 创建画像/第一次用/帮我建个人设/分析我的... |
| [`skill-profile-manager`](./skill-profile-manager/SKILL.md) | 创建、编辑、记忆更新、导出、对比 — 画像的全生命周期管理 |
| [`skill-my-account`](./skill-my-account/SKILL.md) | 你是"账号自查助手"。当用户问的是**关于他自己账号或内容**的事（我是谁 / 登录了哪些号 / 粉丝多少 / |
| [`template-library`](./template-library/SKILL.md) | 保存、复用、管理内容模板 — 把成功经验变成可复制的结构 |
| [`asset-manager`](./asset-manager/SKILL.md) | outputs/ 产物的归档、标签、检索 — 让历史内容随时可查可复用 |
| [`batch-process`](./batch-process/SKILL.md) | 批量处理：对一个目录里的一批图片/视频/音频统一套用同一操作——批量压缩、加水印、转格式、缩放、转比例、音量归一化等。当用户说 批量处理、批量压缩、批量加水印、批量转格式、一批图片/视频、给这个... |

---

## 如何使用

### 在对话中使用（推荐）

直接在 Web UI 对话框用自然语言描述需求，AI 会自动匹配并调用对应的 Skill：

```
"帮我写一条小红书种草笔记"        → xhs-note-creator
"生成一张产品配图"                → ai-image-gen
"做一个 15 秒的产品展示视频"       → auto-short-video
"给视频配音"                      → tts-voiceover
"分析一下竞品的小红书爆款规律"     → redbook
"把这条笔记发布到小红书"          → skill-xhs-publisher
```

### 在技能库页面浏览

Web UI 左侧「技能库」页面可搜索和查看所有 Skill 的详细说明。

### 按工作流组合使用

Easel 的 Skill 按内容创作工作流分层编排：

```
发现热点 → 选题策划 → 内容制作 → 平台发布 → 数据复盘
  discover     plan       produce    publish    attribute
```

一条典型的小红书图文笔记工作流：

1. `skill-trending-topics` — 找热点
2. `skill-topic-evaluator` — 评估选题
3. `xhs-note-creator` — 生成文案 + 卡片
4. `skill-quality-gate` — 质量检查
5. `skill-xhs-publisher` — 发布到小红书
6. `skill-publish-analytics` — 分析表现
