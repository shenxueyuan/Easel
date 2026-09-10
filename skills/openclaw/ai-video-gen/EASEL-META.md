# Easel SKILL 元数据

| 字段 | 值 |
|------|-----|
| **SKILL 名称** | ai-video-gen |
| **所属层** | produce |
| **来源类型** | 自研 |
| **原始来源** | Easel 自研（`shared/scripts/ai_video.py`） |
| **参考项目** | 沉淀自 AIDC-AI/Pixelle-Video（多供应商视频生成统一配置：DashScope-Wan / ARK-Seedance / Kling）、LuoGen-AI/LuoGen-agent（数字人口播流程）；各 provider 依据其公开 REST API 文档实现 |
| **依赖** | Python 标准库（urllib/hmac/hashlib，无第三方）；用户自备各 provider 的 API key |
| **许可** | 待核实（参考项目 Apache-2.0 / GPL-3.0，本实现为自研封装） |

> 整理时间: 2026-08-26
> 用途: 来源溯源与致谢

## 说明

仅用于独立文生视频、图生视频和单张图片动态化，支持 DashScope / ARK / Kling / OpenAI-compatible / 小红书 MaaS / Agnes / SiliconFlow。异步提交→轮询→下载，统一声明原生音频与对白能力。完整口播视频必须路由到 auto-short-video；数字人必须使用管理页角色照片和实际口播音频调用专用接口，普通 I2V 不得冒充数字人。
