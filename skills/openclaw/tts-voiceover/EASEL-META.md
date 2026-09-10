# Easel SKILL 元数据

| 字段 | 值 |
|------|-----|
| **SKILL 名称** | tts-voiceover |
| **所属层** | produce |
| **来源类型** | 自研 |
| **原始来源** | Easel 自研；封装 `tts.py` 与 `voice_clone.py`，调用页面配置的 CosyVoice / Qwen-TTS 闭源音色并用 FFmpeg 拼接、探测时长 |
| **参考项目** | 阿里云百炼 CosyVoice / Qwen-TTS；FFmpeg（音频拼接、转码、时长探测） |
| **许可** | 本实现自研；云 TTS 服务遵循对应供应商条款；FFmpeg 为 LGPL/GPL |

> 整理时间: 2026-07-23
> 用途: 来源溯源与致谢
