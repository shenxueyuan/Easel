#!/usr/bin/env python3
"""tts.py — 页面配置驱动的闭源文字转语音封装。

通过 voice_clone.py 调用 Easel 页面确认的 CosyVoice/Qwen-TTS 音色，按句合成并生成
SRT；失败立即退出，禁止降级到 edge-tts。音频拼接、转码和时长探测依赖 ffmpeg/ffprobe。

用法示例：
    tts.py speak --text "配音测试，你好" -o out.mp3 --voice <voice-id>
    tts.py speak --file script.txt -o out.mp3 --voice <voice-id> --subtitle out.srt
    tts.py --selftest
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

# ── 基础设施 ────────────────────────────────────────────────────────
def _die(msg: str, code: int = 1) -> "NoReturn":  # type: ignore[valid-type]
    print(f"ERROR: {msg}", file=sys.stderr)
    sys.exit(code)


def _has_ffmpeg() -> bool:
    return shutil.which("ffmpeg") is not None


def _probe_duration(path: Path) -> float:
    """ffprobe 取时长（秒）；无 ffprobe 或失败返回 -1。"""
    if shutil.which("ffprobe") is None:
        return -1.0
    cmd = [
        "ffprobe", "-v", "quiet", "-print_format", "json",
        "-show_format", str(path),
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        return -1.0
    try:
        return float(json.loads(proc.stdout).get("format", {}).get("duration", 0) or 0)
    except (json.JSONDecodeError, ValueError):
        return -1.0


def _read_text(args) -> str:
    if args.file:
        p = Path(args.file).expanduser()
        if not p.is_file():
            _die(f"文本文件不存在: {p}", code=2)
        text = p.read_text(encoding="utf-8")
    else:
        text = args.text or ""
    text = text.strip()
    if not text:
        _die("待合成文本为空（--text 或 --file 至少给一个非空内容）", code=2)
    return text


def _transcode(src: Path, dst: Path, fmt: str) -> None:
    """用 ffmpeg 把 mp3 转成目标格式（wav/m4a）。"""
    if not _has_ffmpeg():
        _die(f"--format {fmt} 需要 ffmpeg 转码，但未找到 ffmpeg。", code=3)
    cmd = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
           "-i", str(src), str(dst)]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        _die(f"ffmpeg 转码失败:\n{proc.stderr.strip()}", code=4)


# ── 闭源口播 ──────────────────────────────────────────────────────

class ClosedTTSError(Exception):
    """闭源 TTS 合成失败。"""


def _closed_provider() -> str | None:
    p = (os.environ.get("VOICE_PROVIDER") or "").strip()
    return p or None


def _is_edge_voice(voice: str | None) -> bool:
    return bool(voice and voice.startswith("zh-") and voice.endswith("Neural"))


def _closed_voice_id(voice: str | None) -> str | None:
    """闭源音色 id：显式传入的页面音色优先，再读取环境默认。"""
    if voice:
        return voice
    vid = (os.environ.get("VOICE_NARRATOR_VOICE_ID") or "").strip()
    if vid:
        return vid
    if _closed_provider() == "openai-compatible":
        model = (os.environ.get("VOICE_MODEL") or "").strip() or "FunAudioLLM/CosyVoice2-0.5B"
        return f"{model}:alex"
    return None


def _split_sentences(text: str) -> list[str]:
    """按中英文句末标点/换行切句（用于逐句闭源合成 + 生成分句 SRT）。"""
    import re
    parts = re.split(r"(?<=[。！？!?；;\n])", text)
    return [s.strip() for s in parts if s and s.strip()]


def _srt_ts(sec: float) -> str:
    if sec < 0:
        sec = 0.0
    ms = int(round(sec * 1000))
    h, ms = divmod(ms, 3600000)
    m, ms = divmod(ms, 60000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def _concat_mp3(parts: list[Path], out: Path) -> None:
    """拼接多个 mp3 到 out。单个直接复制；多个用 ffmpeg concat。"""
    if len(parts) == 1:
        shutil.copyfile(parts[0], out)
        return
    if not _has_ffmpeg():
        _die("闭源逐句合成后需 ffmpeg 拼接，但未找到 ffmpeg。", code=3)
    with tempfile.TemporaryDirectory() as d:
        lst = Path(d) / "list.txt"
        lst.write_text("".join(f"file '{p.resolve()}'\n" for p in parts), encoding="utf-8")
        cmd = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
               "-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", str(out)]
        proc = subprocess.run(cmd, capture_output=True, text=True)
        if proc.returncode != 0:  # -c copy 偶尔因编码不一致失败 → 重编码兜底
            cmd = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
                   "-f", "concat", "-safe", "0", "-i", str(lst), "-c:a", "libmp3lame", str(out)]
            proc = subprocess.run(cmd, capture_output=True, text=True)
            if proc.returncode != 0:
                _die(f"ffmpeg 拼接失败:\n{proc.stderr.strip()}", code=4)


def _run_closed(text: str, out: Path, fmt: str, subtitle: Path | None, voice: str | None) -> None:
    """闭源云 TTS 口播：按句 voice_clone 合成 → 拼接 → 按各句真实时长写分句 SRT。失败抛 ClosedTTSError。"""
    provider = _closed_provider()
    if not provider:
        raise ClosedTTSError("未配置 VOICE_PROVIDER")
    vc = Path(__file__).resolve().parent / "voice_clone.py"
    if _is_edge_voice(voice):
        raise ClosedTTSError(f"禁止使用 Edge 音色: {voice}")
    vid = _closed_voice_id(voice)
    sents = _split_sentences(text) or [text.strip()]
    with tempfile.TemporaryDirectory() as d:
        parts: list[Path] = []
        for i, s in enumerate(sents):
            pm = Path(d) / f"p{i:03d}.mp3"
            cmd = [sys.executable, str(vc), "clone", "--provider", provider,
                   "--text", s, "-o", str(pm)]
            if vid:
                cmd += ["--voice-id", vid]
            r = subprocess.run(cmd, capture_output=True, text=True)
            if r.returncode != 0 or not pm.is_file() or pm.stat().st_size == 0:
                raise ClosedTTSError((r.stderr or r.stdout or "voice_clone 无输出").strip()[-300:])
            parts.append(pm)
        target_mp3 = out if fmt == "mp3" else Path(d) / "joined.mp3"
        _concat_mp3(parts, target_mp3)
        if subtitle:
            lines_srt, t = [], 0.0
            for i, (s, pm) in enumerate(zip(sents, parts), 1):
                dur = _probe_duration(pm)
                if dur <= 0:  # 无 ffprobe → 按字数粗估（中文约 4.5 字/秒）
                    dur = max(1.0, len(s) / 4.5)
                lines_srt.append(f"{i}\n{_srt_ts(t)} --> {_srt_ts(t + dur)}\n{s}\n")
                t += dur
            subtitle.write_text("\n".join(lines_srt), encoding="utf-8")
        if fmt != "mp3":
            _transcode(target_mp3, out, fmt)


# ── 子命令 ──────────────────────────────────────────────────────────
def cmd_speak(args) -> int:
    text = _read_text(args)
    out = Path(args.output).expanduser().resolve()
    out.parent.mkdir(parents=True, exist_ok=True)

    fmt = args.format
    if fmt == "auto":
        fmt = out.suffix.lstrip(".").lower() or "mp3"
    if fmt not in ("mp3", "wav", "m4a"):
        _die(f"不支持的输出格式: {fmt}（支持 mp3/wav/m4a）", code=2)

    subtitle = Path(args.subtitle).expanduser().resolve() if args.subtitle else None
    if subtitle:
        subtitle.parent.mkdir(parents=True, exist_ok=True)

    if not _closed_provider():
        _die("未配置闭源 TTS provider；禁止降级到 edge-tts。", code=4)
    try:
        _run_closed(text, out, fmt, subtitle, args.voice)
        dur = _probe_duration(out)
        dur_str = f"{dur:.1f}s" if dur >= 0 else "时长未知(无 ffprobe)"
        print(f"✅ {out}  ({out.stat().st_size/1024:.0f} KB, {dur_str}, 闭源 {_closed_provider()})")
        if subtitle:
            print(f"✅ 字幕 {subtitle}")
        return 0
    except ClosedTTSError as e:
        _die(f"闭源配音失败：{e}\n禁止降级到 edge-tts，请修复音色或 provider 配置后重试。", code=4)


def cmd_voices(_args) -> int:
    print("音色以 Easel /api/voices 返回结果为准；请在配音与数字人页面查看、试听并设置默认音色。")
    return 0


def cmd_selftest(_args=None) -> int:
    if _split_sentences("第一句。第二句！") != ["第一句。", "第二句！"]:
        _die("selftest 失败：分句异常", code=1)
    if _srt_ts(61.234) != "00:01:01,234":
        _die("selftest 失败：SRT 时间戳异常", code=1)
    print("[PASS] selftest 通过：闭源 TTS 前置处理正常，未发起网络请求")
    return 0


# ── argparse ────────────────────────────────────────────────────────
def build_parser() -> argparse.ArgumentParser:
    ap = argparse.ArgumentParser(
        prog="tts.py",
        description="文字转语音（TTS）配音：仅使用页面确认的闭源 TTS 音色",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    ap.add_argument("--selftest", action="store_true",
                    help="离线检查分句与字幕时间戳，不发起网络请求")
    sub = ap.add_subparsers(dest="cmd", metavar="<子命令>")

    p = sub.add_parser("speak", help="合成语音：--text/--file → --output")
    g = p.add_mutually_exclusive_group(required=True)
    g.add_argument("-t", "--text", help="要合成的文本")
    g.add_argument("-f", "--file", help="从文本文件读取内容（长文本推荐）")
    p.add_argument("-o", "--output", required=True,
                   help="输出音频路径（扩展名决定格式，默认 mp3）")
    p.add_argument("-v", "--voice", required=True,
                   help="Easel 页面默认或用户本轮确认的闭源 voice-id")
    p.add_argument("--engine", choices=["auto", "closed"], default="closed",
                   help="仅闭源 TTS，失败不降级")
    p.add_argument("--rate", help="语速，如 +10%% / -20%%")
    p.add_argument("--volume", help="音量，如 +20%% / -10%%")
    p.add_argument("--pitch", help="音调，如 +2Hz / -5Hz")
    p.add_argument("--subtitle", help="同时输出 SRT 字幕到此路径")
    p.add_argument("--format", choices=["auto", "mp3", "wav", "m4a"],
                   default="auto",
                   help="输出格式（默认按扩展名；wav/m4a 需 ffmpeg 转码）")
    p.add_argument("--proxy", help="外网代理（默认读 https_proxy/http_proxy 环境变量）")
    p.set_defaults(func=cmd_speak)

    p = sub.add_parser("voices", help="提示从 Easel 页面/API 查询音色")
    p.set_defaults(func=cmd_voices)

    return ap


def main(argv: list[str] | None = None) -> int:
    # 加载项目 .env 中的闭源 TTS provider 配置。
    try:
        import ai_video
        ai_video.load_env_file(ai_video.find_default_env_file())
    except Exception:  # noqa: BLE001
        pass
    ap = build_parser()
    args = ap.parse_args(argv)
    if args.selftest:
        return cmd_selftest()
    if not getattr(args, "cmd", None):
        ap.print_help()
        return 0
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
