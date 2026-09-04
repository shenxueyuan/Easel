import { useState, useMemo } from 'react';
import type { Page } from './Sidebar';
import {
  IconChat, IconFire, IconVideo, IconImage, IconMic, IconMusic,
  IconChart, IconText, IconCompass, IconLayout, IconPublish, IconAccounts,
} from './icons';

/** 使用场景分类 */
interface UseCase {
  id: string;
  title: string;
  icon: typeof IconChat;
  color: string;
  summary: string;
  scenarios: { name: string; howTo: string; flow: string; skills: string[] }[];
}

/** 全部使用场景数据 */
const USE_CASES: UseCase[] = [
  {
    id: 'ecommerce',
    title: '电商',
    icon: IconLayout,
    color: 'var(--layer-publish)',
    summary: '商品主图、详情页文案、产品视频、营销海报、数据报告、直播话术、多平台分发',
    scenarios: [
      {
        name: '商品主图/营销图生成',
        howTo: '在对话页输入「帮我生成一张 [商品名] 的主图，要求 [风格/场景]」',
        flow: 'LLM 理解需求 → ecom-details-image 制定视觉策略 → ai-image-gen 调用 DashScope Wanx 文生图 → 图片写入 outputs/ → UI 自动预览 → 可继续用 image-editing 加水印/裁剪，remove-bg 抠图换白底',
        skills: ['ecom-details-image', 'ai-image-gen', 'image-editing', 'remove-bg'],
      },
      {
        name: '商品详情页文案',
        howTo: '「帮我写 [商品名] 的电商详情页文案，卖点是 [核心卖点]」',
        flow: 'LLM 调用 copywriting → 套用 AIDA/PAS 等经典框架，落国内电商语境 → 输出标题→卖点→详情→CTA 结构化文案',
        skills: ['copywriting'],
      },
      {
        name: '产品介绍视频',
        howTo: '「做一个 15 秒的 [产品名] 展示短视频」',
        flow: 'auto-short-video 一键出片流水线 → 文案→AI 配图→TTS 配音→字幕→BGM→ffmpeg 合成 → 逐句配图 + Ken Burns 缩放 → 成品 MP4',
        skills: ['auto-short-video', 'ai-image-gen', 'tts-voiceover', 'auto-subtitle', 'audio-mix'],
      },
      {
        name: '电商海报',
        howTo: '「做一张 [活动名] 的竖版营销海报」',
        flow: 'poster-hero → 生成 1080×1920 竖版海报（大标题+核心卖点+可选二维码）→ HTML/CSS 渲染→截图→PNG',
        skills: ['poster-hero'],
      },
      {
        name: '商品对比卡',
        howTo: '「做一张 [产品A] vs [产品B] 的对比卡片」',
        flow: 'comparison-card → 生成 A vs B 可视化对比卡片，一张图说清差异',
        skills: ['comparison-card'],
      },
      {
        name: '销售数据报告',
        howTo: '「把这份 CSV 销售数据生成可视化报告」',
        flow: 'data-report → 读取 CSV/Excel/JSON → 生成 KPI 看板+图表+洞察 → 输出可视化报告页（HTML）',
        skills: ['data-report', 'chart-visualization'],
      },
      {
        name: '直播带货话术',
        howTo: '「帮我写一场 [品类] 直播的完整话术脚本」',
        flow: 'skill-livestream → 主题策划→流程编排→全场话术脚本，适配带货/知识/娱乐',
        skills: ['skill-livestream'],
      },
      {
        name: '多平台分发',
        howTo: '「把这条商品内容同时发到抖音、B站、小红书」',
        flow: 'skill-cross-platform-publish → 按各平台规范适配 → 逐平台委派发布 Skill → Playwright 浏览器自动化发布',
        skills: ['skill-cross-platform-publish', 'skill-douyin-upload', 'skill-bilibili-upload', 'skill-xhs-publisher'],
      },
    ],
  },
  {
    id: 'xhs',
    title: '小红书',
    icon: IconFire,
    color: 'var(--layer-produce)',
    summary: '种草笔记、知识卡片、热门选题、蹭热点、爆款分析、评论互动、发布',
    scenarios: [
      {
        name: '种草笔记（图文卡片组）',
        howTo: '「帮我写一条 [主题] 的小红书种草笔记」',
        flow: 'xhs-note-creator → 主题+素材生成图文卡片组 → card-xiaohongshu 渲染 1080×1440 竖版知识卡片 → HTML/CSS→截图→卡片组 PNG',
        skills: ['xhs-note-creator', 'card-xiaohongshu', 'card-design'],
      },
      {
        name: '热门选题发现',
        howTo: '「今天小红书上有什么热门话题？适合我的赛道吗？」',
        flow: 'skill-trending-topics → 抓取多平台实时热搜 → 按创作者赛道过滤 → 输出可操作的二创选题清单',
        skills: ['skill-trending-topics', 'skill-topic-evaluator'],
      },
      {
        name: '蹭热点方案',
        howTo: '「[某热点事件] 怎么蹭？结合我的账号定位给个方案」',
        flow: 'skill-trend-rider → 结合热点事件+创作者定位 → 输出具体蹭热点内容方案',
        skills: ['skill-trend-rider'],
      },
      {
        name: '爆款规律分析',
        howTo: '「分析一下 [某博主] 的小红书爆款规律」',
        flow: 'skill-xhs-analyzer (redbook) → 搜索笔记→读内容→分析创作者→提取爆款规律',
        skills: ['skill-xhs-analyzer'],
      },
      {
        name: '评论互动',
        howTo: '「帮我回复小红书上最新的评论，用我的画像语气」',
        flow: 'skill-xhs-comment-reply → 拉取评论→用符合画像语气的内容回复→用户确认后发布',
        skills: ['skill-xhs-comment-reply'],
      },
      {
        name: '发布到小红书',
        howTo: '「把这条笔记发布到小红书」',
        flow: 'skill-xhs-publisher → 用户确认后 → xhs_publish.py (Playwright) 完成图文/视频发布',
        skills: ['skill-xhs-publisher'],
      },
    ],
  },
  {
    id: 'douyin',
    title: '抖音/短视频',
    icon: IconVideo,
    color: 'var(--layer-discover)',
    summary: '短视频脚本、一键出片、卡点视频、相册视频、横竖互转、高光切片、AI 视频、配音字幕、发布',
    scenarios: [
      {
        name: '短视频脚本',
        howTo: '「帮我写一个 60 秒的 [主题] 短视频脚本」',
        flow: 'video-script → 根据目标时长自动适配模式 → 生成留存率优化的结构化脚本（Hook→正文→CTA）',
        skills: ['video-script'],
      },
      {
        name: '一键成品短视频',
        howTo: '「做一个关于 [主题] 的短视频，自动配图配音加字幕」',
        flow: 'auto-short-video 核心流水线 → 文案→AI 配图→TTS 配音→自动字幕→BGM→ffmpeg 合成 → 逐句配图+Ken Burns → 成品 MP4',
        skills: ['auto-short-video', 'ai-image-gen', 'tts-voiceover', 'auto-subtitle', 'audio-mix'],
      },
      {
        name: '音乐卡点视频',
        howTo: '「用这组图片做一个踩点视频，配上 [音乐风格] 的 BGM」',
        flow: 'beat-sync-video → 检测背景音乐节拍 → 图片/片段在节拍点切换 → 配推进/白闪特效 → ffmpeg 合成',
        skills: ['beat-sync-video'],
      },
      {
        name: '相册视频',
        howTo: '「把这组照片做成一个相册视频，带 Ken Burns 效果和字幕」',
        flow: 'slideshow-video → 图片→Ken Burns 缓慢缩放+图间转场+背景音乐+逐图字幕 → 自动适配平台画幅',
        skills: ['slideshow-video'],
      },
      {
        name: '横竖版互转',
        howTo: '「把这个横版视频转成 9:16 竖版，人脸居中」',
        flow: 'video-reframe → 智能转换画幅 → 模糊背景填充/焦点裁切/人脸居中裁切（OpenCV CascadeClassifier）',
        skills: ['video-reframe'],
      },
      {
        name: '长视频高光切片',
        howTo: '「从这个长视频里找出高光片段，切成短视频」',
        flow: 'video-highlights → 音频能量峰值检测/转录后内容判断挑金句段 → 切成多条短视频 → 可选转竖版+加字幕',
        skills: ['video-highlights', 'auto-subtitle'],
      },
      {
        name: 'AI 视频生成',
        howTo: '「用 AI 生成一段 [描述] 的视频」或「把这张图变成动态视频」',
        flow: 'ai-video-gen → 文生视频：先 AI 生图→再图生视频(Wan 2.7 I2V)；图生视频：直接图片驱动→Wan 2.7 I2V 异步生成 → MP4',
        skills: ['ai-video-gen', 'ai-image-gen'],
      },
      {
        name: '配音+字幕',
        howTo: '「给这个视频配音并加上字幕」',
        flow: 'tts-voiceover → CosyVoice V2 合成语音 → auto-subtitle → 语音识别成 SRT 字幕 → 可选烧录进视频',
        skills: ['tts-voiceover', 'auto-subtitle'],
      },
      {
        name: '发布到抖音',
        howTo: '「把这个视频发到抖音」',
        flow: 'skill-douyin-upload → 用户确认后 → douyin_publish.py (Playwright) 完成发布',
        skills: ['skill-douyin-upload'],
      },
    ],
  },
  {
    id: 'bilibili',
    title: 'B站',
    icon: IconVideo,
    color: 'var(--layer-plan)',
    summary: '中长视频脚本、章节目录、论文讲解、音频可视化、投稿',
    scenarios: [
      {
        name: '中长视频脚本+章节',
        howTo: '「帮我写一个 10 分钟的 [主题] B站视频脚本，带章节目录」',
        flow: 'video-script → 中长视频结构化脚本 → video-chapters → 自动生成章节划分和时间戳目录',
        skills: ['video-script', 'video-chapters'],
      },
      {
        name: '知识区论文讲解',
        howTo: '「把这篇论文讲成普通人爱看的视频」',
        flow: 'paper-explainer → 论文→通俗讲解中间产物→视频号视频或图文',
        skills: ['paper-explainer'],
      },
      {
        name: '音频可视化',
        howTo: '「把这段播客音频做成带波形动画的视频」',
        flow: 'audio-visualizer → 纯音频→动态波形/频谱视频+封面和标题 → 适合发到只收视频的平台',
        skills: ['audio-visualizer'],
      },
      {
        name: '发布到B站',
        howTo: '「把这个视频投到B站」',
        flow: 'skill-bilibili-upload → 包装 biliup CLI → 分区名映射+参数校验+上传',
        skills: ['skill-bilibili-upload'],
      },
    ],
  },
  {
    id: 'wechat',
    title: '微信公众号',
    icon: IconText,
    color: 'var(--layer-attribute)',
    summary: '长文撰写、排版导出、发布到草稿箱',
    scenarios: [
      {
        name: '长文撰写',
        howTo: '「帮我写一篇关于 [主题] 的公众号文章」',
        flow: 'skill-article-outline → 结构化长文大纲 → copywriting/post-formatter 套用框架写正文 → 输出 Markdown',
        skills: ['skill-article-outline', 'copywriting', 'post-formatter'],
      },
      {
        name: '排版导出',
        howTo: '「把这篇 Markdown 文章转成长图/PDF」',
        flow: 'doc-convert → Markdown→排版→HTML/可打印 PDF/长图 PNG',
        skills: ['doc-convert'],
      },
      {
        name: '发布到公众号',
        howTo: '「把这篇文章发到公众号草稿箱」',
        flow: 'skill-wechat-publisher → 搜索调研→撰写→配图→排版→AI 味自检→发布到草稿箱',
        skills: ['skill-wechat-publisher'],
      },
    ],
  },
  {
    id: 'zhihu',
    title: '知乎',
    icon: IconText,
    color: 'var(--layer-general)',
    summary: '问答内容创作、专栏文章、发布',
    scenarios: [
      {
        name: '问答内容创作',
        howTo: '「在知乎找几个热门问题，帮我写回答」',
        flow: 'skill-zhihu-answer → 搜索热门问题→检查可答性→调用制作层 Skill 写内容→Playwright 发布',
        skills: ['skill-zhihu-answer', 'skill-article-outline'],
      },
      {
        name: '发布到知乎',
        howTo: '「把这篇回答发到知乎」',
        flow: 'skill-zhihu-publisher → 基于通用浏览器发布框架 web_publisher.py (--platform zhihu)',
        skills: ['skill-zhihu-publisher'],
      },
    ],
  },
  {
    id: 'social',
    title: '微博/X/LinkedIn',
    icon: IconPublish,
    color: 'var(--layer-discover)',
    summary: '金句卡/数据卡、跨平台文案',
    scenarios: [
      {
        name: '金句卡/数据卡',
        howTo: '「做一张 [金句内容] 的横版分享卡」',
        flow: 'card-quote → 生成 16:9 横版金句卡/数据卡 → HTML/CSS→截图→PNG',
        skills: ['card-quote'],
      },
      {
        name: '跨平台文案',
        howTo: '「帮我写一条适合发微博/X/LinkedIn 的内容」',
        flow: 'social-content → 为各平台生成原生格式的钩子文案、正文、标签策略',
        skills: ['social-content'],
      },
    ],
  },
  {
    id: 'knowledge',
    title: '知识/教育',
    icon: IconChart,
    color: 'var(--layer-plan)',
    summary: '思维导图、信息图、数据图表、论文讲解',
    scenarios: [
      {
        name: '思维导图',
        howTo: '「把 [主题] 做成思维导图」',
        flow: 'mindmap → Markdown 大纲→可交互思维导图 HTML→可选导出 PNG',
        skills: ['mindmap'],
      },
      {
        name: '信息图',
        howTo: '「把 [数据/内容] 做成信息图」',
        flow: 'infographic → 数据/文字→可视化信息图（静态 AntV 或动画 GIF）→ 支持流程图/对比图/SWOT',
        skills: ['infographic'],
      },
      {
        name: '数据可视化图表',
        howTo: '「用 [数据] 生成一张柱状图/折线图/饼图」',
        flow: 'chart-visualization → 通过 AntV API 生成图表图片',
        skills: ['chart-visualization'],
      },
      {
        name: '论文讲解',
        howTo: '「把这篇论文讲成普通人/同行都爱看的内容」',
        flow: 'paper-explainer → 论文→通俗讲解→视频号视频或图文',
        skills: ['paper-explainer'],
      },
    ],
  },
  {
    id: 'brand',
    title: '品牌营销策略',
    icon: IconCompass,
    color: 'var(--layer-produce)',
    summary: '账号定位、品牌画像、内容策略、活动策划、KOL合作、竞品分析',
    scenarios: [
      {
        name: '账号定位',
        howTo: '「帮我分析我的账号该怎么定位」',
        flow: 'skill-positioning-analysis → 找差异化位置 → skill-audience-profiler → 定义目标受众和粉丝画像',
        skills: ['skill-positioning-analysis', 'skill-audience-profiler'],
      },
      {
        name: '品牌画像',
        howTo: '「帮我建立品牌画像/个人声音画像」',
        flow: 'skill-brand-onboarding → 结构化访谈+公开信息采集→完整 Profile → skill-voice-builder → 写作样本分析→个人声音画像',
        skills: ['skill-brand-onboarding', 'skill-voice-builder'],
      },
      {
        name: '内容策略+排期',
        howTo: '「帮我制定一个月的内容策略」',
        flow: 'skill-content-strategy → 完整内容策略文档 → skill-content-matrix → 选题矩阵 → skill-content-calendar → 一个月排期',
        skills: ['skill-content-strategy', 'skill-content-matrix', 'skill-content-calendar'],
      },
      {
        name: '活动策划',
        howTo: '「帮我策划一场 [主题] 营销活动」',
        flow: 'skill-campaign-planner → 目标→节奏→内容矩阵→玩法→资源→风险→复盘指标',
        skills: ['skill-campaign-planner'],
      },
      {
        name: 'KOL 合作提案',
        howTo: '「帮我做一个 KOL 合作提案」',
        flow: 'skill-collab-proposal → 查询 KOL 定价表→计算报价区间→预估 KPI→结构化提案',
        skills: ['skill-collab-proposal'],
      },
      {
        name: '竞品分析',
        howTo: '「分析一下 [竞品账号] 的内容策略」',
        flow: 'skill-competitor-analysis → 全维度内容拆解 → skill-content-gap-analysis → 找蓝海选题',
        skills: ['skill-competitor-analysis', 'skill-content-gap-analysis'],
      },
    ],
  },
  {
    id: 'livestream',
    title: '直播',
    icon: IconMic,
    color: 'var(--layer-publish)',
    summary: '直播方案策划、流程编排、全场话术脚本',
    scenarios: [
      {
        name: '直播方案',
        howTo: '「帮我策划一场 [主题] 直播」',
        flow: 'skill-livestream → 主题策划→流程编排→全场话术脚本 → 适配带货/知识/娱乐多场景',
        skills: ['skill-livestream'],
      },
    ],
  },
  {
    id: 'novel',
    title: '小说/长篇创作',
    icon: IconText,
    color: 'var(--layer-general)',
    summary: '一句灵感→世界观→大纲→逐章正文，长篇一致性维护',
    scenarios: [
      {
        name: '小说写作',
        howTo: '「根据 [一句灵感] 写一部小说」',
        flow: 'novel-writer → 一句灵感→世界观/人设→三级大纲→逐章正文 → 核心是长篇一致性维护',
        skills: ['novel-writer'],
      },
    ],
  },
  {
    id: 'analytics',
    title: '数据分析与复盘',
    icon: IconChart,
    color: 'var(--layer-attribute)',
    summary: '发布记录、表现分析、爆款公式、帖子评分、评论洞察、ROI、策略建议',
    scenarios: [
      {
        name: '发布记录',
        howTo: '「查看我的发布记录」',
        flow: 'skill-publish-log → 记录/查询/统计每次发布信息 → 复盘数据底座',
        skills: ['skill-publish-log'],
      },
      {
        name: '表现分析',
        howTo: '「分析上个月的内容表现」',
        flow: 'skill-publish-analytics → 时间/标签/类型/增长四维度分析 → skill-social-performance-review → 找有效模式与失败原因→复盘报告',
        skills: ['skill-publish-analytics', 'skill-social-performance-review'],
      },
      {
        name: '爆款公式提炼',
        howTo: '「从我的爆款内容里提炼可复制的公式」',
        flow: 'skill-content-postmortem → 拆解单条成败原因/从多条提炼爆款公式',
        skills: ['skill-content-postmortem'],
      },
      {
        name: '帖子评分',
        howTo: '「给这条帖子草稿打个分」',
        flow: 'skill-post-scorer → 基于历史表现数据→互动潜力评分卡',
        skills: ['skill-post-scorer'],
      },
      {
        name: '评论洞察',
        howTo: '「分析一下评论里的情感和需求」',
        flow: 'skill-comment-insights → 情感分布+高频词/短语+需求与吐槽挖掘',
        skills: ['skill-comment-insights'],
      },
      {
        name: 'ROI 计算',
        howTo: '「帮我计算这次投放的 ROI」',
        flow: 'roi-calculator → 根据投放数据→计算标准营销效果指标→对比行业基准→结构化报告',
        skills: ['roi-calculator'],
      },
      {
        name: '策略建议',
        howTo: '「基于我的数据，下一阶段该怎么优化内容策略？」',
        flow: 'skill-strategy-advisor → 基于现有内容数据与画像→策略优化建议',
        skills: ['skill-strategy-advisor'],
      },
    ],
  },
  {
    id: 'publish-ops',
    title: '发布与运营',
    icon: IconPublish,
    color: 'var(--layer-publish)',
    summary: '一稿多发、排期发布、发布通知、短链追踪、社区运营、质量把关',
    scenarios: [
      {
        name: '一稿多发',
        howTo: '「把这条内容同时发到多个平台」',
        flow: 'skill-cross-platform-publish → 按各平台规范适配 → skill-content-repurposing → 拆解为多平台原生素材 → 逐平台委派发布',
        skills: ['skill-cross-platform-publish', 'skill-content-repurposing'],
      },
      {
        name: '排期发布',
        howTo: '「帮我安排这周的内容发布排期」',
        flow: 'skill-publish-scheduler → 管理排期表（内容×平台×时间）→ 到点派发给各平台发布 Skill',
        skills: ['skill-publish-scheduler'],
      },
      {
        name: '发布通知',
        howTo: '「内容发布后推送到我的企业微信群」',
        flow: 'skill-publish-notify → 发布结果→推到团队 IM 群机器人或 webhook',
        skills: ['skill-publish-notify'],
      },
      {
        name: '短链追踪',
        howTo: '「给这个链接加 UTM 参数并缩短」',
        flow: 'skill-short-link → 拼接 UTM 追踪参数+缩短链接→追踪各平台引流效果',
        skills: ['skill-short-link'],
      },
      {
        name: '社区运营',
        howTo: '「帮我回复评论/从评论里挖选题」',
        flow: 'skill-community-ops → 三种模式：回复评论/从评论挖选题/负面事件分级响应',
        skills: ['skill-community-ops'],
      },
      {
        name: '质量把关',
        howTo: '「发布前帮我检查一下内容质量」',
        flow: 'skill-quality-gate → 合规风险+产物质量 → skill-risk-scanner → 原创度+版权风险 → skill-seo-quality → 搜索优化 → skill-publish-checklist → 逐项检查 → skill-persona-check → 人设一致性',
        skills: ['skill-quality-gate', 'skill-risk-scanner', 'skill-seo-quality', 'skill-publish-checklist', 'skill-persona-check'],
      },
    ],
  },
  {
    id: 'tools',
    title: '通用工具',
    icon: IconAccounts,
    color: 'var(--layer-general)',
    summary: '画像管理、模板库、素材管理、批量处理、账号诊断、文本/音频/图片处理、素材搜索',
    scenarios: [
      {
        name: '画像管理',
        howTo: '「创建/编辑/导出我的账号画像」',
        flow: 'skill-profile-builder → 首次引导生成画像 → skill-profile-manager → 全生命周期管理 → skill-my-account → 账号自查',
        skills: ['skill-profile-builder', 'skill-profile-manager', 'skill-my-account'],
      },
      {
        name: '模板库',
        howTo: '「把这个成功的内容保存成模板」',
        flow: 'template-library → 保存/复用/管理内容模板→把成功经验变成可复制结构',
        skills: ['template-library'],
      },
      {
        name: '素材管理',
        howTo: '「找一下之前生成的某个素材」',
        flow: 'asset-manager → outputs/ 产物的归档、标签、检索',
        skills: ['asset-manager'],
      },
      {
        name: '批量处理',
        howTo: '「把这个目录里的图片批量加水印/压缩/转格式」',
        flow: 'batch-process → 对一批图片/视频/音频统一套用同一操作',
        skills: ['batch-process'],
      },
      {
        name: '账号诊断',
        howTo: '「帮我诊断一下账号是不是被限流了」',
        flow: 'skill-account-diagnosis → 读取画像+近期数据→诊断垂直度/定位/限流信号→病因→证据→处方',
        skills: ['skill-account-diagnosis'],
      },
      {
        name: '文本处理',
        howTo: '「帮我把这段文字打磨一下/压缩到 200 字/改成幽默风格」',
        flow: 'text-polisher → 编辑提升+去 AI 感 → text-condenser → 压缩到指定字数 → style-transfer → 风格改写',
        skills: ['text-polisher', 'text-condenser', 'style-transfer'],
      },
      {
        name: '音频处理',
        howTo: '「帮我把这段录音降噪/剪裁/混音」',
        flow: 'audio-editing → 剪辑/转码/归一化/拼接 → audio-denoise → 三级降噪 → audio-mix → 旁白+BGM 混音自动闪避',
        skills: ['audio-editing', 'audio-denoise', 'audio-mix'],
      },
      {
        name: '图片处理',
        howTo: '「帮我把这张图片放大变清晰/抠图/加表情包文字」',
        flow: 'image-enhance → 放大+去噪+锐化 → remove-bg → AI 语义分割抠图 → meme-generator → 表情包生成',
        skills: ['image-enhance', 'remove-bg', 'meme-generator'],
      },
      {
        name: '素材搜索',
        howTo: '「帮我从网上找一些 [主题] 的配图素材」',
        flow: 'web-material-sourcing → 从公网搜索、验证并收集图片、图表、网页与开放资料',
        skills: ['web-material-sourcing'],
      },
    ],
  },
];

/** 底层媒体能力 */
const MEDIA_CAPS = [
  { label: 'LLM 文本', model: 'DeepSeek V4 Flash 0731', status: '可用', icon: IconText, color: 'var(--layer-plan)' },
  { label: 'AI 生图', model: 'Wanx 2.1 T2I Turbo', status: '可用', icon: IconImage, color: 'var(--layer-produce)' },
  { label: 'AI 视频', model: 'Wan 2.7 I2V', status: '可用', icon: IconVideo, color: 'var(--layer-discover)' },
  { label: 'TTS 配音', model: 'CosyVoice V2', status: '可用', icon: IconMic, color: 'var(--layer-publish)' },
  { label: 'AI 音乐', model: 'Fun-Music Preview', status: '待审批', icon: IconMusic, color: 'var(--layer-attribute)' },
  { label: 'Web 搜索', model: 'Parallel Free', status: '可用', icon: IconCompass, color: 'var(--layer-general)' },
];

/** 典型工作流 */
const WORKFLOWS = [
  {
    title: '小红书图文笔记',
    steps: ['skill-trending-topics 找热点', 'skill-topic-evaluator 评估选题', 'xhs-note-creator 生成文案+卡片', 'skill-quality-gate 质量检查', 'skill-xhs-publisher 发布', 'skill-publish-analytics 分析表现'],
  },
  {
    title: '短视频一键出片',
    steps: ['video-script 生成脚本', 'ai-image-gen AI 配图', 'tts-voiceover TTS 配音', 'auto-subtitle 自动字幕', 'audio-mix 混音加 BGM', 'ffmpeg 合成成品视频'],
  },
  {
    title: '跨平台分发',
    steps: ['copywriting 写核心文案', 'skill-content-repurposing 拆解多平台素材', 'skill-cross-platform-publish 逐平台发布', 'skill-publish-notify 推送结果', 'skill-publish-analytics 数据复盘'],
  },
];

interface UseCasesPageProps {
  onNavigate: (page: Page) => void;
  onUseTopic?: (title: string) => void;
}

export default function UseCasesPage({ onNavigate }: UseCasesPageProps) {
  const [activeId, setActiveId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCases = useMemo(() => {
    if (!searchQuery.trim()) return USE_CASES;
    const q = searchQuery.toLowerCase();
    return USE_CASES.map((uc) => ({
      ...uc,
      scenarios: uc.scenarios.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.howTo.toLowerCase().includes(q) ||
          s.flow.toLowerCase().includes(q) ||
          s.skills.some((sk) => sk.toLowerCase().includes(q)),
      ),
    })).filter((uc) => uc.scenarios.length > 0 || uc.title.toLowerCase().includes(q) || uc.summary.toLowerCase().includes(q));
  }, [searchQuery]);

  const totalScenarios = USE_CASES.reduce((sum, uc) => sum + uc.scenarios.length, 0);

  return (
    <div className="page-scroll usecases-page">
      {/* Hero */}
      <div className="usecases-hero">
        <h1 className="page-title">使用场景指南</h1>
        <p className="page-subtitle">
          {USE_CASES.length} 大场景 · {totalScenarios} 个具体用法 · 113 个 Skill
          <br />
          从热点发现到内容发布，一站式 AI 社媒内容创作。在对话框用自然语言描述需求，AI 会自动匹配并调用对应 Skill。
        </p>
        <div className="usecases-search">
          <input
            type="text"
            placeholder="搜索场景、用法、Skill 名称…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* 底层媒体能力 */}
      <div className="usecases-media">
        <h2 className="usecases-section-title">底层媒体能力</h2>
        <div className="usecases-media-grid">
          {MEDIA_CAPS.map((cap) => (
            <div key={cap.label} className="usecases-media-card">
              <span className="usecases-media-icon" style={{ color: cap.color }}>
                <cap.icon size={20} />
              </span>
              <div className="usecases-media-info">
                <div className="usecases-media-label">{cap.label}</div>
                <div className="usecases-media-model">{cap.model}</div>
              </div>
              <span className={`usecases-media-status ${cap.status === '可用' ? 'ok' : 'pending'}`}>
                {cap.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 架构概览 */}
      <div className="usecases-arch">
        <h2 className="usecases-section-title">系统架构</h2>
        <div className="usecases-arch-flow">
          {[
            { label: '发现热点', sub: 'discover · 9个', color: 'var(--layer-discover)' },
            { label: '选题策划', sub: 'plan · 16个', color: 'var(--layer-plan)' },
            { label: '内容制作', sub: 'produce · 51个', color: 'var(--layer-produce)' },
            { label: '平台发布', sub: 'publish · 20个', color: 'var(--layer-publish)' },
            { label: '数据复盘', sub: 'attribute · 11个', color: 'var(--layer-attribute)' },
            { label: '通用工具', sub: 'general · 6个', color: 'var(--layer-general)' },
          ].map((step, i) => (
            <div key={step.label} className="usecases-arch-step">
              <div className="usecases-arch-node" style={{ borderColor: step.color }}>
                <span className="usecases-arch-label" style={{ color: step.color }}>{step.label}</span>
                <span className="usecases-arch-sub">{step.sub}</span>
              </div>
              {i < 5 && <span className="usecases-arch-arrow">→</span>}
            </div>
          ))}
        </div>
        <p className="usecases-arch-note">
          运行逻辑：用户在对话框用自然语言描述需求 → LLM（DeepSeek V4）理解意图 → 自动匹配并调用对应 Skill → Skill 调用底层媒体模型或共享脚本 → 产物写入 outputs/ → UI 自动预览
        </p>
      </div>

      {/* 使用场景列表 */}
      <div className="usecases-list">
        <h2 className="usecases-section-title">使用场景</h2>
        {filteredCases.length === 0 && (
          <div className="usecases-empty">没有找到匹配的场景，换个关键词试试？</div>
        )}
        {filteredCases.map((uc) => {
          const isActive = activeId === uc.id;
          return (
            <div key={uc.id} className="usecases-category" id={`uc-${uc.id}`}>
              <button
                className={`usecases-category-header ${isActive ? 'expanded' : ''}`}
                onClick={() => setActiveId(isActive ? '' : uc.id)}
              >
                <span className="usecases-category-icon" style={{ color: uc.color }}>
                  <uc.icon size={20} />
                </span>
                <span className="usecases-category-title">{uc.title}</span>
                <span className="usecases-category-count">{uc.scenarios.length} 个用法</span>
                <span className="usecases-category-summary">{uc.summary}</span>
                <span className={`usecases-chevron ${isActive ? 'open' : ''}`}>▾</span>
              </button>
              {isActive && (
                <div className="usecases-scenarios">
                  {uc.scenarios.map((s, i) => (
                    <div key={i} className="usecases-scenario">
                      <div className="usecases-scenario-header">
                        <span className="usecases-scenario-name">{s.name}</span>
                      </div>
                      <div className="usecases-scenario-body">
                        <div className="usecases-field">
                          <span className="usecases-field-label">使用方法</span>
                          <span className="usecases-field-value usecases-howto">{s.howTo}</span>
                        </div>
                        <div className="usecases-field">
                          <span className="usecases-field-label">背后流程</span>
                          <span className="usecases-field-value usecases-flow">{s.flow}</span>
                        </div>
                        <div className="usecases-field">
                          <span className="usecases-field-label">涉及 Skill</span>
                          <div className="usecases-skills">
                            {s.skills.map((sk) => (
                              <span key={sk} className="usecases-skill-tag">{sk}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 典型工作流 */}
      <div className="usecases-workflows">
        <h2 className="usecases-section-title">典型工作流</h2>
        <div className="usecases-workflow-grid">
          {WORKFLOWS.map((wf) => (
            <div key={wf.title} className="usecases-workflow">
              <div className="usecases-workflow-title">{wf.title}</div>
              <div className="usecases-workflow-steps">
                {wf.steps.map((step, i) => (
                  <div key={i} className="usecases-workflow-step">
                    <span className="usecases-workflow-num">{i + 1}</span>
                    <span className="usecases-workflow-text">{step}</span>
                    {i < wf.steps.length - 1 && <span className="usecases-workflow-arrow">↓</span>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 当前限制 */}
      <div className="usecases-limits">
        <h2 className="usecases-section-title">当前限制</h2>
        <div className="usecases-limits-grid">
          <div className="usecases-limit">
            <span className="usecases-limit-item">AI 音乐（Fun-Music）</span>
            <span className="usecases-limit-desc">在等百炼审批，期间无法生成原创 BGM</span>
            <span className="usecases-limit-fix">用 audio-mix 配合外部 BGM 文件</span>
          </div>
          <div className="usecases-limit">
            <span className="usecases-limit-item">AI 视频生成</span>
            <span className="usecases-limit-desc">当前为图生视频（I2V），连贯长视频需逐镜头生成再拼接</span>
            <span className="usecases-limit-fix">用 auto-short-video 流水线逐句配图</span>
          </div>
          <div className="usecases-limit">
            <span className="usecases-limit-item">社媒平台发布</span>
            <span className="usecases-limit-desc">依赖浏览器登录态，需先在 Playwright Chromium 里登录</span>
            <span className="usecases-limit-fix">在「账号」页登录各平台</span>
          </div>
          <div className="usecases-limit">
            <span className="usecases-limit-item">深度思考模式</span>
            <span className="usecases-limit-desc">off（非深度）和 high（深度）可切换，深度模式 token 消耗更大</span>
            <span className="usecases-limit-fix">对话框切换思考模式</span>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="usecases-cta">
        <p>所有功能都可通过对话页自然语言触发，AI 会自动匹配并调用对应的 Skill。</p>
        <div className="usecases-cta-btns">
          <button className="btn btn-primary" onClick={() => onNavigate('chat')}>
            开始对话
          </button>
          <button className="btn" onClick={() => onNavigate('skills')}>
            浏览技能库
          </button>
        </div>
      </div>
    </div>
  );
}
