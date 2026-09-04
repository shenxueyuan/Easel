---
name: auto-short-video
description: "一句话主题 → 成品短视频：自动串联 文案→配图/AI视频→配音→字幕→BGM→合成，把 Easel 制作层零件编排成一条'一键出片'流水线。**支持两种画面模式：快速版（默认，逐句配图 + Ken Burns 缓动）和动态版（每镜图生视频 I2V，画面连贯流动）。**当用户说 一键生成视频、自动做短视频、主题生成视频、帮我做条视频、口播视频一条龙、自动出片、短视频一键生成、动态视频、连贯视频 时使用。**有剧情/角色/对白/反转/多集的短剧改用 short-drama（每镜强制图生视频、角色一致性、台词喂模型）；只写脚本用 video-script；只生成单个片段用 ai-video-gen。**"
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

## 输出

成品短视频写入 `outputs/主题名/final.mp4`；分镜图、配音、字幕和 storyboard 写入 `outputs/主题名/assets/`。

## 执行步骤（按需裁剪，缺 API key 的环节自动降级或询问）

> **⚠️ 硬性约束（不可违反）**：
> 1. **必须调用 `assemble.py` 合成成片**——禁止手写 ffmpeg 命令、禁止手写 build_video.sh 等脚本绕过合成器。
>    `assemble.py` 已封装 Ken Burns 运动、字幕烧录、音频混音、画幅补边等全部逻辑，手写 ffmpeg 必然遗漏。
> 2. **步骤 1-5 不可跳过**——每个步骤要么执行，要么明确降级（见下方降级表），不允许静默跳过。
> 3. **产物必须写入 `outputs/主题名/assets/`**——分镜图、配音、字幕、storyboard.json 都要留档，方便替换后重新合成。
> 4. **最终成片路径为 `outputs/主题名/final.mp4`**——不要输出到其他位置。

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

3. **配音**：[tts-voiceover](../tts-voiceover/SKILL.md) 把文案合成口播（同时出 SRT）。**配了 `VOICE_PROVIDER` 默认走闭源好嗓子**（有情感、像真人），没 key 才退 edge（机械）——想要口播不"生硬"务必配闭源 key。不需要配音才跳过。

4. **字幕**：用 TTS 附带的 SRT，或对配音跑 [auto-subtitle](../auto-subtitle/SKILL.md)；也可让 assemble 用各分镜 caption 自动生成。

5. **BGM**：[ai-music](../ai-music/SKILL.md) 生成，或用用户提供的音乐。可选。

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

7. **交付**：产出 final.mp4，附一句制作说明（用了哪些环节、哪些降级了）。

## 降级表（缺资源时的正确降级方式）

| 缺失资源 | 错误降级（禁止） | 正确降级（必须） |
|---|---|---|
| 图像 API key | 用 ffmpeg drawtext 在纯色背景画字 | 用 card-design/poster-hero 生成设计感卡片图 |
| TTS API key | 跳过配音且不告知 | 用 edge TTS 兜底（机械但有声），或明确告知用户"无配音" |
| 音乐 API key | 跳过 BGM | 跳过 BGM 但在交付说明里告知"无 BGM" |
| 视频 API key（动态版） | 用静态图冒充动态且不告知 | 降级回快速版（Ken Burns 缓动），明确告知用户"无视频 API，降级为 Ken Burns 模式" |

> **核心原则**：降级不等于跳过。每个环节要么正常执行、要么用替代方案执行、要么明确告知用户"该环节缺失"——不允许静默跳过。

## 编排原则

- **零件可缺但不可跳过**：缺图像/视频/TTS API key 的环节按降级表处理，不阻断整体，并如实告知用户降级了什么。**跳过 = 失败**。
- **必须用 assemble.py 合成**：这是硬性约束。`assemble.py` 封装了 Ken Burns、字幕烧录、音频混音、画幅补边等全部逻辑。手写 ffmpeg 命令或 shell 脚本绕过合成器是不允许的——会导致视频缺少字幕、音频、运动效果等关键元素。
- **先出 Plan**：涉及多个付费 API（生图/生视频/生乐）时，先向用户说明将调用哪些、大致耗时/花费，确认后再跑。
- **中间产物留档**：分镜图、配音、字幕和 storyboard 都写进 `outputs/主题名/assets/`，方便单独替换后重新合成。

## Profile 感知

- 有 Profile：从 `style.md` 取调性/视觉风格贯穿文案与配图 prompt；`platforms.md` 只用于给出画幅/时长建议，画幅仍须确认；`preferences.md` 红线过滤。
- 无 Profile：先确认横版/竖版，再用通用口播风格。
