---
name: auto-short-video
description: "完整短视频与口播视频编排：需求/图文→脚本→画面→TTS→字幕→BGM→数字人→合成。当用户要求口播视频、一键生成视频、自动做短视频、主题生成视频、TTS+字幕+BGM、数字人+口播、重新生成完整视频、自动出片、动态视频或连贯视频时必须使用。支持快速版（默认，逐句配图 + Ken Burns）和动态版（每镜 I2V）。有剧情/角色/对白/反转/多集的短剧改用 short-drama；只写脚本用 video-script；只生成单个独立片段才用 ai-video-gen。"
layer: produce
---

# 一键短视频（端到端编排）

> 输入一个主题，自动产出一条短视频。本 SKILL 是**编排层**：把已有制作零件串成流水线——
> 文案(video-script) → 逐句配图(ai-image-gen)或片段(ai-video-gen) → 配音(tts-voiceover) →
> 字幕(auto-subtitle) → BGM(ai-music) → **合成(scripts/assemble.py)**。
> 沉淀自 Pixelle-Video / MoneyPrinterTurbo 的自动短视频引擎思路。

## 两种画面模式

| 模式 | 画面 | 耗时 | 适用 | API 需求 |
|------|------|------|------|----------|
| **快速版**（默认） | 逐句配图 + Ken Burns 缓动 | 快（17 图约 1-2 分钟） | 口播/资讯向，画面辅助 | 仅需图像 API |
| **动态版** | 每镜图生视频（I2V），画面连贯流动 | 慢（17 镜约 15-30 分钟） | 需要画面动起来的内容 | 需图像 + 视频 API |

用户说"动态版""连贯视频""画面要动""不要静态图"→ 走动态版；否则默认快速版。
**动态版不是短剧**——不建剧集圣经、不做角色一致性，只是把每镜的静态图驱动成 3-5 秒动态片段。

## 输入

- 主题 / 文案（必填）
- 可选：目标时长、风格、是否要配音/字幕/BGM、配图用 AI 生图还是用户素材
- 可选：画面模式（快速版/动态版），未指定则默认快速版
- **画幅确认硬门**：用户或上游任务未明确横版/竖版（或 16:9/9:16/具体分辨率）时，制作/付费调用前必须追问并等确认；不得从平台、Profile 或默认值静默推断，已明确则不重复问
- **制作要素确认硬门（TTS / 数字人 / BGM）**：画幅确认后、开始写脚本前，必须先向用户展示当前默认配置并等用户确认或修改，**不得静默用默认值直接开跑**。具体见下方「步骤 0：制作要素确认」。

## 输出

成品短视频写入 `outputs/主题名/final.mp4`；分镜图、配音、字幕和 storyboard 写入 `outputs/主题名/assets/`。

## 执行步骤（按需裁剪，缺 API key 的环节自动降级或询问）

> **⚠️ 硬性约束（不可违反）**：
> 1. **必须调用 `assemble.py` 合成成片**——禁止手写 ffmpeg 命令、禁止手写 build_video.sh 等脚本绕过合成器。
>    `assemble.py` 已封装 Ken Burns 运动、字幕烧录、音频混音、画幅补边等全部逻辑，手写 ffmpeg 必然遗漏。
> 2. **步骤 0-5 不可跳过**——每个步骤要么执行，要么明确降级（见下方降级表），不允许静默跳过。
> 3. **产物必须写入 `outputs/主题名/assets/`**——分镜图、配音、字幕、storyboard.json 都要留档，方便替换后重新合成。
> 4. **最终成片路径为 `outputs/主题名/final.mp4`**——不要输出到其他位置。

0. **制作要素确认（TTS / 数字人 / BGM）**——**画幅确认后必须执行，不得跳过**：

   画幅确认后、开始写脚本前，先查询 Easel 后端拿当前配置，整理成一张表给用户确认。**先给默认、再给可选项，让用户一句话就能确认或修改。**

   **查询命令**（Web 服务在 `http://127.0.0.1:7860`）：
   ```bash
   curl -s http://127.0.0.1:7860/api/voices | jq '{engine, default, voices}'
   curl -s http://127.0.0.1:7860/api/digital-human/characters | jq .
   curl -s http://127.0.0.1:7860/api/bgm | jq .
   ```

   查询只读且免费。接口失败时停止并报告，禁止绕过页面配置自行选择音色、生成虚拟人物或生成 BGM。

   **展示格式**（一次性给用户看，让用户确认或修改）：
   ```
   🎬 制作要素确认（确认后开始制作，可逐项修改）

   ▸ 画幅：1080×1920 竖版
   ▸ TTS 引擎：CosyVoice
   ▸ 口播音色：longxiaochun（龙小纯·温柔女声）← 默认
     可选：longwan（龙婉）/ longcheng（龙诚）/ 克隆音色…
   ▸ 数字人：子菁（角色 ID：9a52f5c16ecb）← 请求明确包含数字人且当前只有一个角色时的默认
     已配置角色：必须按接口真实结果罗列，并显示角色名、ID 和图片预览地址
     可选：回复其他角色 ID 修改，或回复"不添加"
   ▸ BGM：从现有曲库选择一首匹配主题的曲目 ← 请求明确包含 BGM 时的免费默认
     曲库可选：必须按接口真实结果罗列
     只有用户明确选择"AI 生成"并确认模型、次数和费用后，才能调用音乐生成

   回复"确认"开始制作，或告诉我改哪一项。
   ```

   **规则**：
   - TTS 默认值只能取 `/api/voices` 返回的 `default`，不得使用 SKILL、Profile、环境变量或脚本内置默认覆盖页面配置
   - 请求明确包含“数字人”且只有一个已配置角色 → 默认选该角色；有多个角色 → 罗列后让用户选择；没有角色 → 停止数字人步骤并提示先到管理页创建
   - 请求明确包含“BGM” → 默认复用现有曲库，不得自动生成付费音乐
   - 用户只说"确认"/"开始"/"可以" → 全部用上面展示的默认值
   - 用户说"都行你定" → 用默认值，但要**复述一遍最终选择**让用户知道
   - 用户明确要求重新生成，也只代表确认“要这些要素”，不代表确认具体音色、角色、BGM 和付费模型
   - **不得跳过此步骤直接开跑**；没有拿到本轮确认，不得执行任何 TTS、数字人、AI 生图、AI 视频或 AI 音乐调用
   - 确认后先写 `outputs/主题名/assets/generation_manifest.json`，记录最终 TTS 引擎/音色、数字人角色 ID/照片路径、BGM 路径、付费调用模型和最大调用次数，再开始制作
   - 确认前只允许并行执行上述 3 个只读 API 查询，然后立即展示确认表；禁止搜索历史会话、读取旧 avatar 产物或反复调用模型分析
   - “重新生成”必须从当前页面配置重新解析，历史成片只可作为画面/脚本参考，不得复用未在本轮确认表中列出的 TTS、BGM、数字人或付费素材
   - 确认后优先调用 Easel 后端确定性编排链路一次完成；禁止用多轮 `sessions_search/sessions_history` 和反复模型思考代替状态机。口播脚本模型最多 1 次，失败使用确定性切分

1. **写脚本分镜**：用 [video-script](../video-script/SKILL.md) 把主题写成口播文案，拆成 N 句（每句一个分镜），每句配一个画面描述。

2. **生成画面**——**不可跳过，没有画面就不是视频而是纯文字卡片**：

   **快速版（默认）**：每个分镜一张图
   - 有图像 API key → [ai-image-gen](../ai-image-gen/SKILL.md) 逐句 text2img（按已确认画幅）
   - 用户自带素材 → 用 [image-editing](../image-editing/SKILL.md) `pad` 到已确认画幅
   - 都没有 → **必须用 [card-design](../card-design/SKILL.md) 或 [poster-hero](../poster-hero/SKILL.md) 生成卡片图**，不能直接用 ffmpeg drawtext 在纯色背景上画字。卡片图至少要有设计感（渐变背景、排版、图标），不是纯色 + 文字。

   **动态版**：每个分镜先生图，再图生视频（I2V）
   - 先按快速版生成每镜关键帧图（text2img）
   - 再用 [ai-video-gen](../ai-video-gen/SKILL.md) `image2video` 把每张关键帧驱动成 3-5 秒动态片段
   - storyboard 里每镜用 `"video"` 字段而非 `"image"` 字段
   - 缺视频 API key → 降级回快速版（Ken Burns 缓动），并告知用户"无视频 API，降级为 Ken Burns 模式"
   - 动态版耗时较长（17 镜 × 每镜 30-60 秒生成），开始前必须告知用户预计耗时

3. **配音**：[tts-voiceover](../tts-voiceover/SKILL.md) 把文案合成口播（同时出 SRT）。**只能使用步骤 0 用户确认的页面 TTS 引擎和音色**。口播视频禁止使用或降级到 edge-tts；闭源 TTS 失败时立即停止，保留错误并修复配置，未经用户确认不得换音色或引擎。

4. **字幕**：用 TTS 附带的 SRT，或对配音跑 [auto-subtitle](../auto-subtitle/SKILL.md)；也可让 assemble 用各分镜 caption 自动生成。

5. **BGM**：**使用步骤 0 用户确认的 BGM 选择**——不要自行选默认值跳过。用户选了曲库曲目 → 引用该文件；用户选了"AI 生成" → 用 [ai-music](../ai-music/SKILL.md) 生成；用户选了"不添加" → 跳过并在交付说明里告知"无 BGM"。可选。

6. **合成成片**——**必须调用 assemble.py，禁止手写 ffmpeg**：
   把上面的素材写成 storyboard JSON，调合成器：
   ```bash
   python skills/openclaw/auto-short-video/scripts/assemble.py assemble \
     --storyboard outputs/主题名/assets/storyboard.json \
     -o outputs/主题名/final.mp4
   ```
   storyboard 结构（图/片二选一，narration/bgm/subtitle 可选，缺 duration 时按配音均分）：
   ```json
   {
     "size": "<已确认尺寸，如1080x1920或1920x1080>",
     "image_motion": "ken-burns",
     "shots": [
       {"image": "outputs/主题名/assets/shot1.png", "duration": 3, "caption": "第一句", "motion": "static"},
       {"video": "outputs/主题名/assets/clip2.mp4", "caption": "第二句"}
     ],
     "narration": "outputs/主题名/assets/voice.mp3",
     "bgm": "outputs/主题名/assets/bgm.mp3",
     "subtitle": "outputs/主题名/assets/voice.srt"
   }
   ```
   `image_motion` 设整条图片默认运动，单镜 `motion` 可覆写：照片用 `ken-burns`，含文字的 slide/图表/界面必须用
   `static`（等比缩放 + 补边，不裁切、不平移）。
   合成器自动做：按 `image_motion` 生成静帧或 Ken Burns、补边到画幅、拼接、配音+BGM 混音（BGM 自动压低）、烧录字幕。

7. **数字人 overlay（可选）**：**使用步骤 0 用户确认的数字人角色**。必须将角色 ID 作为 `character_id`、将本次步骤 3 产出的实际口播音频作为 `audio` 提交到 Easel 后端 `/api/digital-human/generate`（百炼 EMO），等待任务完成后再 overlay。禁止调用 `ai_image.py` 新生成人物，禁止调用普通 `ai_video.py image2video`，禁止复用历史 avatar 图片/视频；这些都不是真正的角色数字人。用户选了"不添加"才可跳过。

8. **交付**：产出 final.mp4，附一句制作说明（用了哪些环节、哪些降级了、最终用的 TTS/数字人/BGM 是什么）。

## 降级表（缺资源时的正确降级方式）

| 缺失资源 | 错误降级（禁止） | 正确降级（必须） |
|---|---|---|
| 图像 API key | 用 ffmpeg drawtext 在纯色背景画字 | 用 card-design/poster-hero 生成设计感卡片图 |
| TTS API key / 页面默认音色失败 | 静默改用 edge-tts 或其他音色 | 停止制作，报告原始错误；修复页面音色/provider 后再继续 |
| 音乐 API key | 自动调用付费音乐模型 | 从现有 BGM 曲库选择；用户明确要求 AI 生成并确认费用时才调用 |
| 视频 API key（动态版） | 用静态图冒充动态且不告知 | 降级回快速版（Ken Burns 缓动），明确告知用户"无视频 API，降级为 Ken Burns 模式" |

> **核心原则**：降级不等于跳过。每个环节要么正常执行、要么用替代方案执行、要么明确告知用户"该环节缺失"——不允许静默跳过。

## 编排原则

- **零件可缺但不可跳过**：缺图像/视频/TTS API key 的环节按降级表处理，不阻断整体，并如实告知用户降级了什么。**跳过 = 失败**。
- **必须用 assemble.py 合成**：这是硬性约束。`assemble.py` 封装了 Ken Burns、字幕烧录、音频混音、画幅补边等全部逻辑。手写 ffmpeg 命令或 shell 脚本绕过合成器是不允许的——会导致视频缺少字幕、音频、运动效果等关键元素。
- **先出 Plan**：涉及多个付费 API（生图/生视频/生乐）时，先向用户说明将调用哪些、大致耗时/花费，确认后再跑。
- **制作要素必须先确认**：TTS 音色、数字人角色、BGM 是用户可感知的核心体验，**不得静默用默认值**。步骤 0 必须先查询后端、展示当前配置和可选项、等用户确认后再开始。即使用户说"自动出片"或"重新生成"，也要先展示配置再开跑。
- **付费调用逐项限额**：确认表必须列出每个付费 provider/model、预计次数和费用范围；未确认的模型调用次数必须为 0。已确认后也不得超出 `generation_manifest.json` 的次数，失败重试会产生费用时必须重新询问。
- **中间产物留档**：分镜图、配音、字幕和 storyboard 都写进 `outputs/主题名/assets/`，方便单独替换后重新合成。

## Profile 感知

- 有 Profile：从 `style.md` 取调性/视觉风格贯穿文案与配图 prompt；`platforms.md` 只用于给出画幅/时长建议，画幅仍须确认；`preferences.md` 红线过滤。
- 无 Profile：先确认横版/竖版，再用通用口播风格。
