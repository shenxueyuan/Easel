# ElephBrain AI 使用场景指南

> 从热点发现到内容发布，一站式 AI 社媒内容创作平台。
> 本文档罗列系统当前支持的所有内容生成能力与使用场景，帮助快速了解「这个系统能帮我做哪些事」。

---

## 目录

- [整体架构](#整体架构)
- [一、电商场景](#一电商场景)
- [二、小红书热门内容](#二小红书热门内容)
- [三、抖音/短视频](#三抖音短视频)
- [四、B站中长视频](#四b站中长视频)
- [五、微信公众号](#五微信公众号)
- [六、知乎问答](#六知乎问答)
- [七、微博/X/LinkedIn](#七微博xlinkedin)
- [八、知识/教育](#八知识教育)
- [九、品牌营销策略](#九品牌营销策略)
- [十、直播](#十直播)
- [十一、小说/长篇创作](#十一小说长篇创作)
- [十二、数据分析与复盘](#十二数据分析与复盘)
- [十三、发布与运营](#十三发布与运营)
- [十四、通用工具](#十四通用工具)
- [典型工作流](#典型工作流)
- [当前限制](#当前限制)

---

## 整体架构

系统按内容创作工作流分为 **6 层 / 113 个 Skill**：

```
发现热点 → 选题策划 → 内容制作 → 平台发布 → 数据复盘 → 通用工具
discover    plan      produce    publish    attribute   general
 (9个)      (16个)     (51个)     (20个)      (11个)      (6个)
```

**运行逻辑**：用户在对话框用自然语言描述需求 → LLM（DeepSeek V4）理解意图 → 自动匹配并调用对应 Skill → Skill 调用底层媒体模型（生图/生视频/TTS/音乐）或共享脚本（ffmpeg/OpenCV/Playwright）→ 产物写入 `outputs/` 目录 → UI 自动预览。

**底层媒体能力**（已接入阿里百炼/DashScope）：

| 能力 | 当前模型 | 状态 |
|---|---|---|
| LLM 文本 | DeepSeek V4 Flash 0731（支持深度思考切换） | 可用 |
| AI 生图 | Wanx 2.1 T2I Turbo | 可用 |
| AI 视频 | Wan 2.7 I2V（图生视频） | 可用 |
| TTS 配音 | CosyVoice V2 | 可用 |
| AI 音乐 | Fun-Music Preview | 待审批 |
| Web 搜索 | Parallel Free | 可用 |
| 浏览器自动化 | Playwright Chromium | 可用 |

---

## 一、电商场景

### 1.1 商品主图/营销图生成

**使用方法**：在对话页输入「帮我生成一张 [商品名] 的主图，要求 [风格/场景]」

**背后流程**：
1. LLM 理解需求 → 调用 `ecom-details-image` Skill 制定视觉策略
2. 调用 `ai-image-gen` Skill → DashScope Wanx 2.1 文生图
3. 生成图片写入 `outputs/` → UI 自动预览
4. 可继续用 `image-editing` 加水印/裁剪/转格式，`remove-bg` 抠图换白底

**涉及 Skill**：`ecom-details-image`、`ai-image-gen`、`image-editing`、`remove-bg`

### 1.2 商品详情页文案

**使用方法**：「帮我写 [商品名] 的电商详情页文案，卖点是 [核心卖点]」

**背后流程**：
1. LLM 调用 `copywriting` Skill
2. 套用经典营销框架（AIDA/PAS 等），落国内电商语境
3. 输出结构化文案：标题 → 卖点 → 详情 → CTA

**涉及 Skill**：`copywriting`

### 1.3 产品介绍视频

**使用方法**：「做一个 15 秒的 [产品名] 展示短视频」

**背后流程**：
1. LLM 调用 `auto-short-video` Skill（一键出片流水线）
2. 自动拆解：文案 → 配图（AI 生图）→ 配音（CosyVoice TTS）→ 字幕 → BGM → 合成
3. 逐句配图 + Ken Burns 缓慢缩放效果
4. ffmpeg 合成最终视频 → 写入 `outputs/` → UI 预览

**涉及 Skill**：`auto-short-video`、`ai-image-gen`、`tts-voiceover`、`auto-subtitle`、`audio-mix`

### 1.4 电商海报

**使用方法**：「做一张 [活动名] 的竖版营销海报」

**背后流程**：
1. LLM 调用 `poster-hero` Skill
2. 生成 1080×1920 竖版海报（大标题 + 核心卖点 + 可选二维码）
3. HTML/CSS 渲染 → 截图 → 输出 PNG

**涉及 Skill**：`poster-hero`

### 1.5 商品对比卡

**使用方法**：「做一张 [产品A] vs [产品B] 的对比卡片」

**背后流程**：
1. LLM 调用 `comparison-card` Skill
2. 生成 A vs B 可视化对比卡片，一张图说清差异
3. 适合社媒分享

**涉及 Skill**：`comparison-card`

### 1.6 销售数据报告

**使用方法**：「把这份 CSV 销售数据生成可视化报告」

**背后流程**：
1. LLM 调用 `data-report` Skill
2. 读取 CSV/Excel/JSON → 生成 KPI 看板 + 图表 + 洞察
3. 输出完整可视化报告页（HTML）

**涉及 Skill**：`data-report`、`chart-visualization`

### 1.7 直播带货话术

**使用方法**：「帮我写一场 [品类] 直播的完整话术脚本」

**背后流程**：
1. LLM 调用 `skill-livestream` Skill
2. 生成：主题策划 → 流程编排 → 全场话术脚本
3. 适配带货/知识/娱乐多场景

**涉及 Skill**：`skill-livestream`

### 1.8 多平台分发

**使用方法**：「把这条商品内容同时发到抖音、B站、小红书」

**背后流程**：
1. LLM 调用 `skill-cross-platform-publish` Skill
2. 按各平台规范适配同一份内容（格式/长度/标签）
3. 逐平台委派发布 Skill → Playwright 浏览器自动化发布

**涉及 Skill**：`skill-cross-platform-publish`、`skill-douyin-upload`、`skill-bilibili-upload`、`skill-xhs-publisher`

---

## 二、小红书热门内容

### 2.1 种草笔记（图文卡片组）

**使用方法**：「帮我写一条 [主题] 的小红书种草笔记」

**背后流程**：
1. LLM 调用 `xhs-note-creator` Skill
2. 主题 + 可选素材 → 生成图文卡片组或短视频分镜脚本
3. 调用 `card-xiaohongshu` 渲染 1080×1440 竖版知识卡片
4. HTML/CSS → 截图 → 输出卡片组 PNG

**涉及 Skill**：`xhs-note-creator`、`card-xiaohongshu`、`card-design`

### 2.2 热门选题发现

**使用方法**：「今天小红书上有什么热门话题？适合我的赛道吗？」

**背后流程**：
1. LLM 调用 `skill-trending-topics` Skill
2. 抓取多平台实时热搜数据 → 按创作者赛道过滤
3. 输出可操作的二创选题清单

**涉及 Skill**：`skill-trending-topics`、`skill-topic-evaluator`

### 2.3 蹭热点方案

**使用方法**：「[某热点事件] 怎么蹭？结合我的账号定位给个方案」

**背后流程**：
1. LLM 调用 `skill-trend-rider` Skill
2. 结合热点事件 + 创作者定位 → 输出具体蹭热点内容方案

**涉及 Skill**：`skill-trend-rider`

### 2.4 爆款规律分析

**使用方法**：「分析一下 [某博主] 的小红书爆款规律」

**背后流程**：
1. LLM 调用 `redbook`（skill-xhs-analyzer）Skill
2. 搜索笔记 → 读内容 → 分析创作者 → 提取爆款规律

**涉及 Skill**：`skill-xhs-analyzer`

### 2.5 评论互动

**使用方法**：「帮我回复小红书上最新的评论，用我的画像语气」

**背后流程**：
1. LLM 调用 `skill-xhs-comment-reply` Skill
2. 拉取评论 → 用符合画像语气的内容回复
3. 用户确认后发布

**涉及 Skill**：`skill-xhs-comment-reply`

### 2.6 发布到小红书

**使用方法**：「把这条笔记发布到小红书」

**背后流程**：
1. LLM 调用 `skill-xhs-publisher` Skill
2. 用户确认后 → `xhs_publish.py`（Playwright 浏览器自动化）完成图文/视频发布

**涉及 Skill**：`skill-xhs-publisher`

---

## 三、抖音/短视频

### 3.1 短视频脚本

**使用方法**：「帮我写一个 60 秒的 [主题] 短视频脚本」

**背后流程**：
1. LLM 调用 `video-script` Skill
2. 根据目标时长自动适配短视频/中长视频模式
3. 生成留存率优化的结构化脚本（Hook → 正文 → CTA）

**涉及 Skill**：`video-script`

### 3.2 一键成品短视频

**使用方法**：「做一个关于 [主题] 的短视频，自动配图配音加字幕」

**背后流程**：
1. LLM 调用 `auto-short-video` Skill（核心流水线）
2. 自动串联：文案 → AI 配图 → TTS 配音 → 自动字幕 → BGM → ffmpeg 合成
3. 画面默认逐句配图 + Ken Burns 缓慢缩放
4. 输出成品 MP4 → UI 预览

**涉及 Skill**：`auto-short-video`、`ai-image-gen`、`tts-voiceover`、`auto-subtitle`、`audio-mix`

### 3.3 音乐卡点视频

**使用方法**：「用这组图片做一个踩点视频，配上 [音乐风格] 的 BGM」

**背后流程**：
1. LLM 调用 `beat-sync-video` Skill
2. 检测背景音乐节拍 → 图片/片段在节拍点切换
3. 配推进/白闪特效 → ffmpeg 合成

**涉及 Skill**：`beat-sync-video`

### 3.4 相册视频

**使用方法**：「把这组照片做成一个相册视频，带 Ken Burns 效果和字幕」

**背后流程**：
1. LLM 调用 `slideshow-video` Skill
2. 图片 → Ken Burns 缓慢缩放 + 图间转场 + 背景音乐 + 逐图字幕
3. 自动适配平台画幅（竖版/方形/横版）

**涉及 Skill**：`slideshow-video`

### 3.5 横竖版互转

**使用方法**：「把这个横版视频转成 9:16 竖版，人脸居中」

**背后流程**：
1. LLM 调用 `video-reframe` Skill
2. 智能转换画幅 → 模糊背景填充 / 焦点裁切 / 人脸居中裁切（OpenCV CascadeClassifier）

**涉及 Skill**：`video-reframe`

### 3.6 长视频高光切片

**使用方法**：「从这个长视频里找出高光片段，切成短视频」

**背后流程**：
1. LLM 调用 `video-highlights` Skill
2. 音频能量峰值检测 / 转录后内容判断挑金句段
3. 切成多条独立短视频 → 可选转竖版 9:16 + 加字幕

**涉及 Skill**：`video-highlights`、`auto-subtitle`

### 3.7 AI 视频生成（文生视频/图生视频）

**使用方法**：「用 AI 生成一段 [描述] 的视频」或「把这张图变成动态视频」

**背后流程**：
1. LLM 调用 `ai-video-gen` Skill
2. 文生视频：先 AI 生图 → 再图生视频（Wan 2.7 I2V）
3. 图生视频：直接用图片驱动 → Wan 2.7 I2V 异步生成
4. 生成 MP4 → 写入 `outputs/` → UI 预览

**涉及 Skill**：`ai-video-gen`、`ai-image-gen`

### 3.8 配音+字幕

**使用方法**：「给这个视频配音并加上字幕」

**背后流程**：
1. LLM 调用 `tts-voiceover` Skill → CosyVoice V2 合成语音
2. 调用 `auto-subtitle` Skill → 语音识别成 SRT 字幕
3. 可选烧录字幕进视频

**涉及 Skill**：`tts-voiceover`、`auto-subtitle`

### 3.9 发布到抖音

**使用方法**：「把这个视频发到抖音」

**背后流程**：
1. LLM 调用 `skill-douyin-upload` Skill
2. 用户确认后 → `douyin_publish.py`（Playwright）完成发布

**涉及 Skill**：`skill-douyin-upload`

---

## 四、B站中长视频

### 4.1 中长视频脚本+章节

**使用方法**：「帮我写一个 10 分钟的 [主题] B站视频脚本，带章节目录」

**背后流程**：
1. LLM 调用 `video-script` Skill → 生成中长视频结构化脚本
2. 调用 `video-chapters` Skill → 自动生成章节划分和时间戳目录
3. 适用于 B站分P / 视频描述区

**涉及 Skill**：`video-script`、`video-chapters`

### 4.2 知识区论文讲解

**使用方法**：「把这篇论文讲成普通人爱看的视频」

**背后流程**：
1. LLM 调用 `paper-explainer` Skill
2. 论文 → 通俗讲解中间产物 → 视频号视频或图文

**涉及 Skill**：`paper-explainer`

### 4.3 音频可视化

**使用方法**：「把这段播客音频做成带波形动画的视频」

**背后流程**：
1. LLM 调用 `audio-visualizer` Skill
2. 纯音频 → 动态波形/频谱视频 + 封面和标题
3. 适合发到只收视频的平台

**涉及 Skill**：`audio-visualizer`

### 4.4 发布到B站

**使用方法**：「把这个视频投到B站」

**背后流程**：
1. LLM 调用 `skill-bilibili-upload` Skill
2. 包装 biliup CLI → 分区名映射 + 参数校验 + 上传

**涉及 Skill**：`skill-bilibili-upload`

---

## 五、微信公众号

### 5.1 长文撰写

**使用方法**：「帮我写一篇关于 [主题] 的公众号文章」

**背后流程**：
1. LLM 调用 `skill-article-outline` Skill → 生成结构化长文大纲
2. 调用 `copywriting` 或 `post-formatter` Skill → 套用框架写正文
3. 输出 Markdown 文稿

**涉及 Skill**：`skill-article-outline`、`copywriting`、`post-formatter`

### 5.2 排版导出

**使用方法**：「把这篇 Markdown 文章转成长图/PDF」

**背后流程**：
1. LLM 调用 `doc-convert` Skill
2. Markdown → 排版 → HTML / 可打印 PDF / 长图 PNG

**涉及 Skill**：`doc-convert`

### 5.3 发布到公众号

**使用方法**：「把这篇文章发到公众号草稿箱」

**背后流程**：
1. LLM 调用 `skill-wechat-publisher` Skill
2. 搜索调研 → 撰写 → 配图 → 排版 → AI 味自检 → 发布到草稿箱

**涉及 Skill**：`skill-wechat-publisher`

---

## 六、知乎问答

### 6.1 问答内容创作

**使用方法**：「在知乎找几个热门问题，帮我写回答」

**背后流程**：
1. LLM 调用 `skill-zhihu-answer` Skill
2. 搜索热门问题 → 检查可答性 → 调用制作层 Skill 写内容 → Playwright 发布

**涉及 Skill**：`skill-zhihu-answer`、`skill-article-outline`

### 6.2 发布到知乎

**使用方法**：「把这篇回答发到知乎」

**背后流程**：
1. LLM 调用 `skill-zhihu-publisher` Skill
2. 基于通用浏览器发布框架 `web_publisher.py`（`--platform zhihu`）

**涉及 Skill**：`skill-zhihu-publisher`

---

## 七、微博/X/LinkedIn

### 7.1 金句卡/数据卡

**使用方法**：「做一张 [金句内容] 的横版分享卡」

**背后流程**：
1. LLM 调用 `card-quote` Skill
2. 生成 16:9 横版金句卡/数据卡 → HTML/CSS → 截图 → PNG

**涉及 Skill**：`card-quote`

### 7.2 跨平台文案

**使用方法**：「帮我写一条适合发微博/X/LinkedIn 的内容」

**背后流程**：
1. LLM 调用 `social-content` Skill
2. 为各平台生成原生格式的钩子文案、正文、标签策略

**涉及 Skill**：`social-content`

---

## 八、知识/教育

### 8.1 思维导图

**使用方法**：「把 [主题] 做成思维导图」

**背后流程**：
1. LLM 调用 `mindmap` Skill
2. Markdown 大纲（标题层级 + 列表）→ 可交互思维导图 HTML → 可选导出 PNG

**涉及 Skill**：`mindmap`

### 8.2 信息图

**使用方法**：「把 [数据/内容] 做成信息图」

**背后流程**：
1. LLM 调用 `infographic` Skill
2. 数据/文字 → 可视化信息图（静态 AntV 或动画 GIF）
3. 支持流程图、对比图、SWOT 分析图

**涉及 Skill**：`infographic`

### 8.3 数据可视化图表

**使用方法**：「用 [数据] 生成一张柱状图/折线图/饼图」

**背后流程**：
1. LLM 调用 `chart-visualization` Skill
2. 通过 AntV API 生成图表图片

**涉及 Skill**：`chart-visualization`

### 8.4 论文讲解

**使用方法**：「把这篇论文讲成普通人/同行都爱看的内容」

**背后流程**：
1. LLM 调用 `paper-explainer` Skill
2. 论文 → 通俗讲解 → 视频号视频或图文

**涉及 Skill**：`paper-explainer`

---

## 九、品牌营销策略

### 9.1 账号定位

**使用方法**：「帮我分析我的账号该怎么定位」

**背后流程**：
1. LLM 调用 `skill-positioning-analysis` Skill → 找差异化位置
2. 调用 `skill-audience-profiler` Skill → 定义目标受众和粉丝画像

**涉及 Skill**：`skill-positioning-analysis`、`skill-audience-profiler`

### 9.2 品牌画像

**使用方法**：「帮我建立品牌画像/个人声音画像」

**背后流程**：
1. LLM 调用 `skill-brand-onboarding` Skill → 结构化访谈 + 公开信息采集 → 完整 Profile
2. 调用 `skill-voice-builder` Skill → 写作样本分析 → 个人声音画像

**涉及 Skill**：`skill-brand-onboarding`、`skill-voice-builder`

### 9.3 内容策略

**使用方法**：「帮我制定一个月的内容策略」

**背后流程**：
1. LLM 调用 `skill-content-strategy` Skill → 完整内容策略文档
2. 调用 `skill-content-matrix` Skill → 内容支柱 × 8 种格式 → 选题矩阵
3. 调用 `skill-content-calendar` Skill → 一个月内容排期

**涉及 Skill**：`skill-content-strategy`、`skill-content-matrix`、`skill-content-calendar`

### 9.4 活动策划

**使用方法**：「帮我策划一场 [主题] 营销活动」

**背后流程**：
1. LLM 调用 `skill-campaign-planner` Skill
2. 目标 → 节奏 → 内容矩阵 → 玩法 → 资源 → 风险 → 复盘指标

**涉及 Skill**：`skill-campaign-planner`

### 9.5 KOL 合作提案

**使用方法**：「帮我做一个 KOL 合作提案」

**背后流程**：
1. LLM 调用 `skill-collab-proposal` Skill
2. 查询 KOL 定价表 → 计算报价区间 → 预估 KPI → 结构化提案

**涉及 Skill**：`skill-collab-proposal`

### 9.6 竞品分析

**使用方法**：「分析一下 [竞品账号] 的内容策略」

**背后流程**：
1. LLM 调用 `skill-competitor-analysis` Skill → 全维度内容拆解
2. 调用 `skill-content-gap-analysis` Skill → 找蓝海选题

**涉及 Skill**：`skill-competitor-analysis`、`skill-content-gap-analysis`

---

## 十、直播

### 10.1 直播方案

**使用方法**：「帮我策划一场 [主题] 直播」

**背后流程**：
1. LLM 调用 `skill-livestream` Skill
2. 主题策划 → 流程编排 → 全场话术脚本
3. 适配带货/知识/娱乐多场景

**涉及 Skill**：`skill-livestream`

---

## 十一、小说/长篇创作

### 11.1 小说写作

**使用方法**：「根据 [一句灵感] 写一部小说」

**背后流程**：
1. LLM 调用 `novel-writer` Skill
2. 一句灵感 → 世界观/人设 → 三级大纲 → 逐章正文
3. 核心是长篇一致性维护

**涉及 Skill**：`novel-writer`

---

## 十二、数据分析与复盘

### 12.1 发布记录

**使用方法**：「查看我的发布记录」

**背后流程**：
1. LLM 调用 `skill-publish-log` Skill
2. 记录/查询/统计每次发布信息 → 复盘数据底座

**涉及 Skill**：`skill-publish-log`

### 12.2 表现分析

**使用方法**：「分析上个月的内容表现」

**背后流程**：
1. LLM 调用 `skill-publish-analytics` Skill → 时间/标签/类型/增长四维度分析
2. 调用 `skill-social-performance-review` Skill → 找有效模式与失败原因 → 复盘报告

**涉及 Skill**：`skill-publish-analytics`、`skill-social-performance-review`

### 12.3 爆款公式提炼

**使用方法**：「从我的爆款内容里提炼可复制的公式」

**背后流程**：
1. LLM 调用 `skill-content-postmortem` Skill
2. 拆解单条成败原因 / 从多条提炼爆款公式

**涉及 Skill**：`skill-content-postmortem`

### 12.4 帖子评分

**使用方法**：「给这条帖子草稿打个分」

**背后流程**：
1. LLM 调用 `skill-post-scorer` Skill
2. 基于历史表现数据 → 互动潜力评分卡

**涉及 Skill**：`skill-post-scorer`

### 12.5 评论洞察

**使用方法**：「分析一下评论里的情感和需求」

**背后流程**：
1. LLM 调用 `skill-comment-insights` Skill
2. 情感分布 + 高频词/短语 + 需求与吐槽挖掘

**涉及 Skill**：`skill-comment-insights`

### 12.6 ROI 计算

**使用方法**：「帮我计算这次投放的 ROI」

**背后流程**：
1. LLM 调用 `roi-calculator` Skill
2. 根据投放数据 → 计算标准营销效果指标 → 对比行业基准 → 结构化报告

**涉及 Skill**：`roi-calculator`

### 12.7 策略建议

**使用方法**：「基于我的数据，下一阶段该怎么优化内容策略？」

**背后流程**：
1. LLM 调用 `skill-strategy-advisor` Skill
2. 基于现有内容数据与画像 → 策略优化建议

**涉及 Skill**：`skill-strategy-advisor`

---

## 十三、发布与运营

### 13.1 一稿多发

**使用方法**：「把这条内容同时发到多个平台」

**背后流程**：
1. LLM 调用 `skill-cross-platform-publish` Skill → 按各平台规范适配
2. 调用 `skill-content-repurposing` Skill → 一篇长内容拆解为多平台原生素材
3. 逐平台委派发布 Skill

**涉及 Skill**：`skill-cross-platform-publish`、`skill-content-repurposing`

### 13.2 排期发布

**使用方法**：「帮我安排这周的内容发布排期」

**背后流程**：
1. LLM 调用 `skill-publish-scheduler` Skill
2. 管理排期表（内容×平台×时间）→ 到点派发给各平台发布 Skill

**涉及 Skill**：`skill-publish-scheduler`

### 13.3 发布通知

**使用方法**：「内容发布后推送到我的企业微信群」

**背后流程**：
1. LLM 调用 `skill-publish-notify` Skill
2. 发布结果 → 推到团队 IM 群机器人或 webhook

**涉及 Skill**：`skill-publish-notify`

### 13.4 短链追踪

**使用方法**：「给这个链接加 UTM 参数并缩短」

**背后流程**：
1. LLM 调用 `skill-short-link` Skill
2. 拼接 UTM 追踪参数 + 缩短链接 → 追踪各平台引流效果

**涉及 Skill**：`skill-short-link`

### 13.5 社区运营

**使用方法**：「帮我回复评论 / 从评论里挖选题」

**背后流程**：
1. LLM 调用 `skill-community-ops` Skill
2. 三种模式：回复评论 / 从评论挖选题 / 负面事件分级响应

**涉及 Skill**：`skill-community-ops`

### 13.6 质量把关

**使用方法**：「发布前帮我检查一下内容质量」

**背后流程**：
1. LLM 调用 `skill-quality-gate` Skill → 合规风险检测 + 产物质量审核
2. 调用 `skill-risk-scanner` Skill → 原创度风险 + 素材版权风险评估
3. 调用 `skill-seo-quality` Skill → 搜索可发现性优化
4. 调用 `skill-publish-checklist` Skill → 逐项检查防漏
5. 调用 `skill-persona-check` Skill → 人设一致性检查

**涉及 Skill**：`skill-quality-gate`、`skill-risk-scanner`、`skill-seo-quality`、`skill-publish-checklist`、`skill-persona-check`

---

## 十四、通用工具

### 14.1 画像管理

**使用方法**：「创建/编辑/导出我的账号画像」

**背后流程**：
1. `skill-profile-builder` → 首次使用引导，从社媒链接生成画像
2. `skill-profile-manager` → 创建/编辑/记忆更新/导出/对比
3. `skill-my-account` → 账号自查（我是谁/登录了哪些号/粉丝多少）

**涉及 Skill**：`skill-profile-builder`、`skill-profile-manager`、`skill-my-account`

### 14.2 模板库

**使用方法**：「把这个成功的内容保存成模板」

**背后流程**：
1. LLM 调用 `template-library` Skill
2. 保存/复用/管理内容模板 → 把成功经验变成可复制结构

**涉及 Skill**：`template-library`

### 14.3 素材管理

**使用方法**：「找一下之前生成的某个素材」

**背后流程**：
1. LLM 调用 `asset-manager` Skill
2. `outputs/` 产物的归档、标签、检索

**涉及 Skill**：`asset-manager`

### 14.4 批量处理

**使用方法**：「把这个目录里的图片批量加水印/压缩/转格式」

**背后流程**：
1. LLM 调用 `batch-process` Skill
2. 对一批图片/视频/音频统一套用同一操作

**涉及 Skill**：`batch-process`

### 14.5 账号诊断

**使用方法**：「帮我诊断一下账号是不是被限流了」

**背后流程**：
1. LLM 调用 `skill-account-diagnosis` Skill
2. 读取画像 Profile + 近期内容数据 → 诊断垂直度/定位清晰度/限流降权信号
3. 输出病因 → 证据 → 处方式起号意见

**涉及 Skill**：`skill-account-diagnosis`

### 14.6 文本处理工具

**使用方法**：「帮我把这段文字打磨一下/压缩到 200 字/改成幽默风格」

**背后流程**：
1. `text-polisher` → 系统化编辑提升质量 + 去 AI 感
2. `text-condenser` → 长文本压缩到指定字数
3. `style-transfer` → 风格改写（保留语义）

**涉及 Skill**：`text-polisher`、`text-condenser`、`style-transfer`

### 14.7 音频处理工具

**使用方法**：「帮我把这段录音降噪/剪裁/混音」

**背后流程**：
1. `audio-editing` → 剪辑/转码/归一化/拼接/淡入淡出/变速
2. `audio-denoise` → 三级降噪方案（ffmpeg 降噪滤镜）
3. `audio-mix` → 旁白 + BGM + 音效混音，自动闪避

**涉及 Skill**：`audio-editing`、`audio-denoise`、`audio-mix`

### 14.8 图片处理工具

**使用方法**：「帮我把这张图片放大变清晰/抠图/加表情包文字」

**背后流程**：
1. `image-enhance` → 高质量放大 + 去噪 + 锐化
2. `remove-bg` → AI 语义分割抠图
3. `meme-generator` → 表情包/Meme 生成

**涉及 Skill**：`image-enhance`、`remove-bg`、`meme-generator`

### 14.9 素材搜索

**使用方法**：「帮我从网上找一些 [主题] 的配图素材」

**背后流程**：
1. LLM 调用 `web-material-sourcing` Skill
2. 从公网搜索、验证并收集图片、图表、网页与开放资料

**涉及 Skill**：`web-material-sourcing`

---

## 典型工作流

### 小红书图文笔记工作流

```
1. skill-trending-topics    → 找热点
2. skill-topic-evaluator    → 评估选题
3. xhs-note-creator         → 生成文案 + 卡片
4. skill-quality-gate       → 质量检查
5. skill-xhs-publisher      → 发布到小红书
6. skill-publish-analytics  → 分析表现
```

### 短视频一键出片工作流

```
1. video-script             → 生成脚本
2. ai-image-gen             → AI 配图
3. tts-voiceover            → TTS 配音
4. auto-subtitle            → 自动字幕
5. audio-mix                → 混音加 BGM
6. ffmpeg 合成              → 成品视频
```

### 跨平台分发工作流

```
1. copywriting              → 写核心文案
2. skill-content-repurposing → 拆解为多平台原生素材
3. skill-cross-platform-publish → 逐平台适配并发布
4. skill-publish-notify     → 推送发布结果到 IM
5. skill-publish-analytics  → 数据复盘
```

---

## 当前限制

| 限制项 | 说明 | 临时方案 |
|---|---|---|
| AI 音乐（Fun-Music） | 在等百炼审批，期间无法生成原创 BGM | 用 `audio-mix` 配合外部 BGM 文件 |
| AI 视频生成 | 当前为图生视频（I2V），连贯长视频需逐镜头生成再拼接 | 用 `auto-short-video` 流水线逐句配图 |
| 社媒平台发布 | 依赖浏览器登录态，需先在 Playwright Chromium 里登录对应平台 | 在「账号」页登录各平台 |
| 深度思考模式 | `off`（非深度）和 `high`（深度）可切换，深度模式 token 消耗更大 | 对话框切换思考模式 |

---

> **提示**：所有功能都可通过对话页自然语言触发，AI 会自动匹配并调用对应的 Skill。也可以在「技能库」页面浏览所有 113 个 Skill 的详细说明。
