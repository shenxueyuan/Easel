---
name: tts-voiceover
description: "文字转语音配音：使用 Easel 页面当前配置的 CosyVoice/Qwen-TTS 默认音色，把文案或脚本合成为口播、旁白和朗读音频，并同步输出 SRT。自动模式禁止降级到 edge-tts；云 TTS 失败时停止并报告。当用户说配音、文字转语音、TTS、口播语音、旁白、朗读或生成语音时使用。"
layer: produce
---

# 文字转语音配音（TTS Voiceover）

> **配置检查路径铁律**：先 `cd` 到 `AGENTS.md` 末尾给出的 Easel 项目根，确认当前目录有 `.env` 和 `skills/shared/scripts/`。云 TTS 配置只能用项目根的 `model_registry.py configured --group voice --env-file .env` 和 `voice_clone.py check ... --env-file .env` 判断；不得在 workspace 跑 `./shared/scripts/...`，也不得用 `env` / `printenv` 推断 Key/URL 缺失。

把文案 / 脚本合成为 AI 语音（口播、旁白、朗读）。先查询 `http://127.0.0.1:7860/api/voices`，以接口返回的 `engine` 和 `default` 为唯一默认值。共享脚本 `skills/shared/scripts/tts.py speak` 的自动模式只调用闭源云 TTS，失败即停止，禁止降级到 edge-tts。显式音色必须通过 `--voice` 传入，不能由 Profile、环境默认或脚本内置音色覆盖页面选择。

## 输入

| 字段 | 必填 | 说明 |
|------|------|------|
| text / file | 是 | 待配音的文本，或文本文件路径（长文本推荐 --file） |
| voice | 是 | 使用 `/api/voices` 的 `default`，或用户本轮明确选择的音色 ID |
| rate/volume/pitch | 否 | 语速 / 音量 / 音调微调 |
| output | 否 | 默认 `outputs/主题名/{name}.mp3` |

## 输出

- 配音音频文件（mp3，可选 wav/m4a），放入 `outputs/主题名/`
- 可选同步输出 SRT 字幕（`--subtitle`），供视频烧字幕用
- 打印实际执行的闭源 TTS provider、输出文件时长、大小和音色 ID

## 前置：页面配置

```bash
curl -s http://127.0.0.1:7860/api/voices | jq '{engine, default, defaultVoice:(.voices[] | select(.voice_id == $d))}' --arg d "$(curl -s http://127.0.0.1:7860/api/voices | jq -r .default)"
```

接口不可用、默认音色不存在或状态不是 `OK` 时停止，不得自行换音色。

## 执行步骤

脚本路径（相对项目根）：`skills/shared/scripts/tts.py`。每个子命令支持 `-h`。

### 0. 查询并确认页面音色

先运行页面配置查询，展示当前引擎、默认音色名称和 ID。口播视频由 `auto-short-video` 步骤 0 统一等待用户确认。

### 1. 合成配音 speak

```bash
python skills/shared/scripts/tts.py speak --file script.txt \
  -o outputs/主题名/narration.mp3 --engine closed \
  --voice <页面默认或用户确认的音色ID> \
  --subtitle outputs/主题名/narration.srt
```

必须显式传 `--engine closed` 和已确认的 `--voice`。不得传 `zh-CN-*Neural`，不得使用 `--engine edge`。

参数：`--rate +10%`（语速）、`--volume +20%`（音量）、`--pitch +2Hz`（音调）。

### 2. 后处理（可选，复用已有共享脚本）

配音出来后按需接下游脚本，无需在本 SKILL 重造能力：

```bash
# ① 配音 + BGM 混音（原声 1.0 / BGM 0.3）→ 用 audio_ops concat / video_ops bgm
python skills/shared/scripts/video_ops.py bgm -i vo.mp3 -o vo_bgm.mp3 \
  --music bgm.mp3 --voice-volume 1.0 --music-volume 0.3

# ② 配音音量归一化到社媒响度（-14 LUFS）
python skills/shared/scripts/audio_ops.py normalize vo.mp3 -o vo_norm.mp3

# ③ 把配音作为旁白加到视频
python skills/shared/scripts/video_ops.py bgm -i clip.mp4 -o clip_vo.mp4 \
  --music vo.mp3 --voice-volume 0.4 --music-volume 1.0
```

## 规则

1. **绝不覆盖原始素材** — 只写新文件到 `outputs/主题名/`。
2. **长文本走 --file** — 避免命令行过长 / 换行转义问题。
3. **页面配置唯一可信** — TTS 引擎和默认音色只取 `/api/voices`。
4. **禁止 Edge 降级** — 闭源 TTS 失败即停止；不得使用任何 `zh-CN-*Neural` 音色生成口播。
5. **不重造能力** — 混音/归一化/加视频旁白复用 audio_ops.py / video_ops.py。

## Profile 感知

Profile 只能影响语速、情绪和表达风格，不能覆盖页面默认音色。
