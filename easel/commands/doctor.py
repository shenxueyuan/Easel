"""easel doctor — 检查完整部署环境是否就绪。"""
from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
PROFILE = "easel"
GREEN = "\033[0;32m"
RED = "\033[0;31m"
YELLOW = "\033[0;33m"
NC = "\033[0m"


def _check(label: str, ok: bool, detail: str = "") -> bool:
    status = f"{GREEN}OK{NC}" if ok else f"{RED}FAIL{NC}"
    print(f"  {label:<40s} {status}")
    if not ok and detail:
        print(f"    └─ {detail}")
    return ok


def _which(name: str) -> str | None:
    candidates = [Path(sys.executable).parent / name, Path("/opt/homebrew/opt/ffmpeg-full/bin") / name,
                  Path("/opt/homebrew/bin") / name]
    found = shutil.which(name)
    if found:
        candidates.append(Path(found))
    return next((str(path) for path in candidates if path.is_file()), None)


def _ffmpeg_filter(name: str) -> bool:
    ffmpeg = _which("ffmpeg")
    if not ffmpeg:
        return False
    try:
        result = subprocess.run([ffmpeg, "-hide_banner", "-filters"], capture_output=True,
                                text=True, timeout=20)
        return result.returncode == 0 and re.search(rf"\b{re.escape(name)}\b", result.stdout) is not None
    except (OSError, subprocess.SubprocessError):
        return False


def _node_dir() -> Path | None:
    candidates = [
        Path("/opt/homebrew/opt/node@22/bin"),
        Path("/opt/homebrew/bin"),
        Path("/usr/local/bin"),
    ]
    found = shutil.which("node")
    if found:
        candidates.append(Path(found).parent)
    for directory in candidates:
        node = directory / "node"
        if not node.is_file():
            continue
        try:
            version = subprocess.run([str(node), "--version"], capture_output=True, text=True,
                                     timeout=10, check=True).stdout.strip()
            match = re.match(r"v(\d+)\.(\d+)\.(\d+)", version)
            if not match:
                continue
            major, minor, patch = map(int, match.groups())
            if ((major == 22 and (minor, patch) >= (22, 3)) or
                    (major == 24 and minor >= 15) or major >= 25):
                return directory
        except (OSError, subprocess.SubprocessError):
            continue
    return None


def _command_env(node_dir: Path | None) -> dict[str, str]:
    env = os.environ.copy()
    if node_dir:
        env["PATH"] = f"{node_dir}{os.pathsep}{env.get('PATH', '')}"
    return env


def _read_env() -> dict[str, str]:
    values: dict[str, str] = {}
    env_file = PROJECT_ROOT / ".env"
    if not env_file.is_file():
        return values
    try:
        for raw in env_file.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            values[key.strip()] = value.strip().strip('"').strip("'")
    except OSError:
        return {}
    return values


def _set(values: dict[str, str], name: str) -> bool:
    value = values.get(name, "")
    return bool(value) and "REPLACE_ME" not in value


def _llm_configured(values: dict[str, str]) -> bool:
    return any((
        _set(values, "ANTHROPIC_API_KEY"),
        _set(values, "EASEL_LLM_API_KEY") and _set(values, "EASEL_LLM_BASE_URL"),
        all(_set(values, key) for key in ("OPENAI_MAAS_API_KEY", "OPENAI_MAAS_ENDPOINT", "OPENAI_MAAS_MODEL")),
        all(_set(values, key) for key in ("GEMINI_MAAS_API_KEY", "GEMINI_MAAS_ENDPOINT", "GEMINI_MAAS_MODEL")),
    ))


def _module_ok(module: str) -> bool:
    try:
        result = subprocess.run([sys.executable, "-c", f"import {module}"], capture_output=True,
                                text=True, timeout=30)
        return result.returncode == 0
    except (OSError, subprocess.SubprocessError):
        return False


def _openclaw_value(env: dict[str, str], path: str) -> object | None:
    try:
        result = subprocess.run(["openclaw", "--profile", PROFILE, "config", "get", path],
                                capture_output=True, text=True, timeout=30, env=env)
        if result.returncode != 0:
            return None
        return json.loads(result.stdout)
    except (OSError, subprocess.SubprocessError, json.JSONDecodeError):
        return None


def _plugin_loaded(env: dict[str, str], plugin: str) -> bool:
    try:
        result = subprocess.run(["openclaw", "--profile", PROFILE, "plugins", "inspect", plugin],
                                capture_output=True, text=True, timeout=30, env=env)
        return result.returncode == 0 and "Status: loaded" in result.stdout
    except (OSError, subprocess.SubprocessError):
        return False


def _playwright_ok() -> bool:
    code = (
        "from playwright.sync_api import sync_playwright; "
        "p=sync_playwright().start(); b=p.chromium.launch(headless=True); b.close(); p.stop()"
    )
    try:
        return subprocess.run([sys.executable, "-c", code], capture_output=True,
                              text=True, timeout=45).returncode == 0
    except (OSError, subprocess.SubprocessError):
        return False


def _provider_configured(values: dict[str, str], group: str) -> bool:
    if group == "image":
        return all(_set(values, key) for key in ("IMG_API_KEY", "IMG_BASE_URL", "IMG_MODEL"))
    provider = values.get(f"{group.upper()}_PROVIDER", "").strip()
    requirements = {
        "video": {
            "dashscope": ("DASHSCOPE_API_KEY",), "siliconflow": ("SILICONFLOW_API_KEY",),
            "ark": ("ARK_API_KEY",), "kling": ("KLING_ACCESS_KEY", "KLING_SECRET_KEY"),
            "agnes": ("AGNES_API_KEY",), "openai-compatible": ("VIDEO_API_KEY", "VIDEO_BASE_URL"),
        },
        "music": {
            "dashscope": ("DASHSCOPE_API_KEY",),
            "suno-compatible": ("MUSIC_API_KEY", "MUSIC_BASE_URL"),
        },
        "voice": {
            "dashscope": ("DASHSCOPE_API_KEY",), "minimax": ("MINIMAX_API_KEY", "MINIMAX_GROUP_ID"),
            "fish-audio": ("FISH_API_KEY",), "openai-compatible": ("VOICE_API_KEY", "VOICE_BASE_URL"),
            "gemini": ("GEMINI_API_KEY",),
        },
    }
    required = requirements.get(group, {}).get(provider)
    return bool(required) and all(_set(values, key) for key in required)


def cmd_doctor(_args) -> int:
    print("ElephBrain AI — 完整环境检查\n")
    all_ok = True
    values = _read_env()
    node_dir = _node_dir()
    command_env = _command_env(node_dir)
    expected_venv = PROJECT_ROOT / ".venv"

    print("基础运行环境")
    all_ok &= _check("项目虚拟环境 .venv", expected_venv in Path(sys.executable).parents,
                     "请运行 bash setup.sh，并使用 .venv/bin/easel doctor")
    all_ok &= _check("Python >= 3.10", sys.version_info >= (3, 10), sys.version.split()[0])
    all_ok &= _check("兼容 Node.js", node_dir is not None,
                     "需要 Node.js 22.22.3+、24.15+ 或 25.9+")
    all_ok &= _check("OpenClaw", shutil.which("openclaw") is not None, "请运行 bash setup.sh")
    all_ok &= _check("ffmpeg", _which("ffmpeg") is not None, "请安装 ffmpeg")
    all_ok &= _check("ffprobe", _which("ffprobe") is not None, "请安装 ffmpeg")
    all_ok &= _check("ffmpeg drawtext", _ffmpeg_filter("drawtext"), "当前 ffmpeg 缺少文字渲染滤镜")
    all_ok &= _check("ffmpeg xfade", _ffmpeg_filter("xfade"), "当前 ffmpeg 缺少视频转场滤镜")

    print("\nPython 完整功能依赖")
    modules = {
        "Web 后端": "fastapi", "文件上传": "multipart", "SSE": "sse_starlette", "图片处理": "PIL",
        "NumPy": "numpy", "OpenCV": "cv2", "数据处理": "pandas",
        "图表": "matplotlib", "音频分析": "librosa", "自动字幕": "faster_whisper",
        "Edge TTS": "edge_tts", "浏览器自动化": "playwright", "图片去背景": "rembg",
        "ONNX Runtime": "onnxruntime", "中文分词": "jieba", "情感分析": "snownlp",
        "Markdown": "markdown",
    }
    for label, module in modules.items():
        all_ok &= _check(label, _module_ok(module), f"缺少或损坏 Python 模块：{module}")
    all_ok &= _check("Playwright Chromium", _playwright_ok(), "运行 .venv/bin/playwright install chromium")
    all_ok &= _check("B站上传 biliup", _which("biliup") is not None, "媒体依赖未完整安装")
    fonts = [
        Path("/System/Library/Fonts/Hiragino Sans GB.ttc"),
        Path("/System/Library/Fonts/STHeiti Medium.ttc"),
        Path("/System/Library/Fonts/Supplemental/Arial Unicode.ttf"),
        Path("/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"),
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
    ]
    all_ok &= _check("可用字体", any(path.is_file() for path in fonts), "未找到可用于媒体渲染的字体")

    print("\n模型与网络工具")
    all_ok &= _check("主 LLM 配置", _llm_configured(values), "请配置一种 LLM 认证通道")
    all_ok &= _check("AI 生图配置", _provider_configured(values, "image"), "IMG 配置不完整")
    all_ok &= _check("AI 视频配置", _provider_configured(values, "video"), "VIDEO Provider 配置不完整")
    all_ok &= _check("云端 TTS 配置", _provider_configured(values, "voice"), "VOICE Provider 配置不完整")
    all_ok &= _check("AI 音乐配置", _provider_configured(values, "music"), "MUSIC Provider 配置不完整")
    search = _openclaw_value(command_env, "tools.web.search")
    all_ok &= _check("Web Search", isinstance(search, dict) and search.get("enabled") is True and bool(search.get("provider")),
                     "请运行 bash setup.sh 配置搜索 Provider")
    all_ok &= _check("Parallel Search 插件", _plugin_loaded(command_env, "parallel"), "Parallel 插件未加载")
    memory = _openclaw_value(command_env, "memory.search")
    all_ok &= _check("全局 Memory Search 已隔离", isinstance(memory, dict) and memory.get("enabled") is False,
                     "Easel 应关闭 OpenClaw 全局记忆，避免画像串扰和 Embedding 告警")

    print("\n项目产物与技能")
    skills_dir = Path.home() / f".openclaw-{PROFILE}" / "workspace" / "skills"
    all_ok &= _check("Skills 已同步", skills_dir.is_dir() and any(skills_dir.iterdir()), "运行 bash openclaw/sync.sh")
    all_ok &= _check("Web 前端已构建", (PROJECT_ROOT / "web/frontend/dist/index.html").is_file(), "运行 bash setup.sh")
    all_ok &= _check("43 个共享工具脚本", len(list((PROJECT_ROOT / "skills/shared/scripts").glob("*.py"))) >= 43)
    all_ok &= _check("113 个 OpenClaw Skills", len(list((PROJECT_ROOT / "skills/openclaw").glob("*/SKILL.md"))) >= 113)

    print()
    if all_ok:
        print(f"{GREEN}✓ 全部工具与功能依赖已安装{NC}")
    else:
        print(f"{YELLOW}⚠ 部署不完整{NC} — 请运行 bash setup.sh 修复后重试")
    print("  外部状态仍需单独确认：模型余额/权限、fun-music 审批、社媒平台登录态。")
    return 0 if all_ok else 1
