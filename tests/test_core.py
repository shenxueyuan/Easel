"""Easel 整合层核心纯函数单测。

覆盖 CLI（skill.py 输入分类/SKILL 查找）+ Web 后端（app.py 文件类型/路径安全/画像生成/输出树）。
运行：pytest tests/ -q
"""
from __future__ import annotations

import sys
import asyncio
import io
import json
from pathlib import Path
from types import SimpleNamespace

import pytest

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))
sys.path.insert(0, str(PROJECT_ROOT / "web"))
sys.path.insert(0, str(PROJECT_ROOT / "skills" / "openclaw" / "paper-explainer" / "scripts"))
sys.path.insert(0, str(PROJECT_ROOT / "skills" / "shared" / "scripts"))

from easel.commands import skill as cli_skill  # noqa: E402
from easel import persona  # noqa: E402
import app as web  # noqa: E402
import paper_ingest  # noqa: E402
import render_slides  # noqa: E402
import tts  # noqa: E402
import browser_account_search  # noqa: E402
from model_registry import (configured_providers, env_aliases, provider_ids,
                            provider_required_env)  # noqa: E402
from persona_gate import classify as classify_persona_score  # noqa: E402


# ---- 媒体模型注册表：脚本与 Web 共用同一真相源 ----

def test_media_provider_registry_reaches_web():
    assert provider_ids("video") == tuple(
        provider["id"] for provider in web.SKILL_API_REQUIREMENTS["ai-video-gen"]["providers"])
    assert "agnes" in provider_ids("video")
    assert "gemini" in provider_ids("voice")
    assert "AGNES_API_KEY" in web._ENV_ALLOWLIST
    assert "GEMINI_API_KEY" in web._ENV_ALLOWLIST


def test_media_registry_separates_dashscope_model_names():
    video_fields = dict(provider_required_env("video")["dashscope"])
    music_fields = dict(provider_required_env("music")["dashscope"])
    assert "DASHSCOPE_VIDEO_MODEL" in video_fields
    assert "DASHSCOPE_MUSIC_MODEL" in music_fields
    assert env_aliases("video")["DASHSCOPE_VIDEO_MODEL"] == ("DASHSCOPE_MODEL",)


def test_configured_media_providers_lists_choices_without_keys():
    env = {
        "AGNES_API_KEY": "secret-agnes",
        "AGNES_MODEL": "agnes-video-2.5-flash",
        "VIDEO_API_KEY": "secret-openai",
        "VIDEO_BASE_URL": "https://example.invalid/v1",
        "VIDEO_MODEL": "video-model-b",
    }
    providers = configured_providers("video", env)
    assert [provider["id"] for provider in providers] == ["openai-compatible", "agnes"]
    serialized = json.dumps(providers)
    assert "secret-agnes" not in serialized and "secret-openai" not in serialized
    assert "agnes-video-2.5-flash" in serialized and "video-model-b" in serialized


def test_closed_tts_prefers_explicit_page_voice(monkeypatch):
    monkeypatch.setenv("VOICE_NARRATOR_VOICE_ID", "environment-default")
    assert tts._closed_voice_id("cosyvoice-v2-easel-custom") == "cosyvoice-v2-easel-custom"
    assert tts._closed_voice_id("longxiaochun_v2") == "longxiaochun_v2"


def test_closed_tts_detects_edge_voice():
    assert tts._is_edge_voice("zh-CN-YunyangNeural") is True
    assert tts._is_edge_voice("cosyvoice-v2-easel-custom") is False


def test_auto_tts_never_falls_back_to_edge(monkeypatch, tmp_path):
    args = SimpleNamespace(
        output=str(tmp_path / "voice.mp3"), format="mp3", subtitle=None,
        engine="auto", voice="page-default", rate=None, volume=None,
        pitch=None, proxy=None,
    )
    monkeypatch.setattr(tts, "_read_text", lambda _: "测试")
    monkeypatch.setattr(tts, "_closed_provider", lambda: "dashscope")
    monkeypatch.setattr(tts, "_run_closed", lambda *args: (_ for _ in ()).throw(tts.ClosedTTSError("failed")))
    with pytest.raises(SystemExit):
        tts.cmd_speak(args)


# ---- CLI: _resolve_input ----

def test_resolve_input_plain_text():
    assert cli_skill._resolve_input("普通文本") == "普通文本"


def test_resolve_input_long_text_no_crash():
    # 超过文件名长度上限的长文本不应崩溃（Path.is_file 会抛 OSError）
    long = "压缩测试" * 100
    assert cli_skill._resolve_input(long) == long


def test_resolve_input_image_path(tmp_path):
    p = tmp_path / "pic.png"
    p.write_bytes(b"\x89PNG\r\n")
    out = cli_skill._resolve_input(str(p))
    assert "请处理这个图片" in out and str(p) in out


def test_resolve_input_binary_media_path(tmp_path):
    # 音视频/二进制不能 read_text，应走"请处理这个文件"分支而非崩溃
    p = tmp_path / "clip.mp4"
    p.write_bytes(b"\x00\x01\x02\xff\xfe")
    out = cli_skill._resolve_input(str(p))
    assert "请处理这个文件" in out


def test_resolve_input_text_file(tmp_path):
    p = tmp_path / "note.txt"
    p.write_text("文件内容", encoding="utf-8")
    assert cli_skill._resolve_input(str(p)) == "文件内容"


def test_paper_fetch_copies_local_pdf_to_project_output(tmp_path):
    source = tmp_path / "uploaded.pdf"
    source.write_bytes(b"%PDF-local-paper")
    target = tmp_path / "project" / "assets" / "paper.pdf"

    returned = paper_ingest.fetch(str(source), str(target))

    assert Path(returned) == target.resolve()
    assert target.read_bytes() == source.read_bytes()


def test_paper_slide_plan_rejects_repeated_template_and_long_copy(tmp_path):
    plan = render_slides._sample_plan()
    plan["slides"] = [dict(plan["slides"][0]) for _ in range(3)]
    plan["slides"][0]["title"] = "过长标题" * 10

    problems = render_slides.validate_plan(tmp_path / "slide-plan.json", plan)

    assert any("title" in problem and "字符" in problem for problem in problems)
    assert any("连续超过两页" in problem for problem in problems)


def test_paper_slide_plan_accepts_arbitrary_style_transfer(tmp_path):
    plan = render_slides._sample_plan()
    plan["style"] = "雨夜都市超级英雄漫画"
    plan["base_style"] = "noir"
    plan["treatment"] = "comic"
    plan["theme"] = {
        "bg": "#10131a",
        "accent": "#f2c94c",
        "font": "sans",
        "radius": 4,
        "heading_weight": 900,
        "texture": "halftone",
    }

    assert render_slides.validate_plan(tmp_path / "slide-plan.json", plan) == []


def test_paper_slide_plan_requires_base_for_arbitrary_style(tmp_path):
    plan = render_slides._sample_plan()
    plan["style"] = "任意未预设风格"

    problems = render_slides.validate_plan(tmp_path / "slide-plan.json", plan)

    assert any("base_style" in problem for problem in problems)


def test_paper_slide_plan_supports_controlled_motifs(tmp_path):
    plan = render_slides._sample_plan()
    plan["motif"] = "brackets"
    plan["slides"][0]["motif"] = "index"

    assert render_slides.validate_plan(tmp_path / "slide-plan.json", plan) == []
    html = render_slides.build_html(tmp_path / "slide-plan.json", plan)
    assert "motif-index" in html
    assert "data-layout-box" in html


def test_paper_slide_plan_rejects_unknown_motif(tmp_path):
    plan = render_slides._sample_plan()
    plan["motif"] = "random-decoration"

    assert any("motif" in problem for problem in render_slides.validate_plan(
        tmp_path / "slide-plan.json", plan
    ))


@pytest.mark.parametrize("theme", [
    {"accent": "hotpink"},
    {"raw_css": "body { display: none; }"},
])
def test_paper_slide_plan_rejects_unsafe_theme(tmp_path, theme):
    plan = render_slides._sample_plan()
    plan["theme"] = theme

    assert render_slides.validate_plan(tmp_path / "slide-plan.json", plan)


def test_paper_slide_plan_rejects_low_contrast_body_colors(tmp_path):
    plan = render_slides._sample_plan()
    plan["theme"] = {"muted": "#eeeeee"}

    problems = render_slides.validate_plan(tmp_path / "slide-plan.json", plan)

    assert any("theme.muted" in problem and "4.5:1" in problem for problem in problems)


def test_paper_slide_presets_meet_body_contrast_gate(tmp_path):
    for base_style in render_slides.BASE_STYLES:
        plan = render_slides._sample_plan()
        plan["style"] = base_style
        assert not [
            problem for problem in render_slides.validate_plan(tmp_path / "slide-plan.json", plan)
            if "对比度" in problem
        ], base_style


def test_paper_slide_uses_readable_semantic_color_for_bright_accent(tmp_path):
    plan = render_slides._sample_plan()
    plan["style"] = "任意柔和彩色风格"
    plan["base_style"] = "cute-anime"
    plan["theme"] = {"accent": "#ffb7cf"}

    html = render_slides.build_html(tmp_path / "slide-plan.json", plan)

    assert ".kicker{color:#25304b" in html
    assert "background:#ffb7cf;\ncolor:#25304b" in html


def test_paper_slide_rejects_underexplained_balanced_content(tmp_path):
    plan = render_slides._sample_plan()
    plan["slides"] = [{
        "type": "comparison",
        "title": "两条路线有什么区别？",
        "columns": [
            {"title": "路线 A", "body": "更快"},
            {"title": "路线 B", "body": "更稳"},
        ],
        "claim": "选择取决于实际目标。",
    }]

    problems = render_slides.validate_plan(tmp_path / "slide-plan.json", plan)

    assert sum("完整对比依据" in problem for problem in problems) == 2


def test_paper_slide_allows_explicit_visual_first_figure_page(tmp_path):
    figure = tmp_path / "figure.png"
    figure.write_bytes(b"placeholder")
    plan = render_slides._sample_plan()
    plan["slides"] = [{
        "type": "evidence",
        "density": "visual",
        "title": "先读这张关键图",
        "claim": "高亮区域就是论文报告的主要差异。",
        "figure": {"path": "figure.png", "caption": "Figure 2", "fit": "contain"},
    }]

    assert render_slides.validate_plan(tmp_path / "slide-plan.json", plan) == []


# ---- CLI: _find_skill ----

def test_find_skill_produce_resolves():
    assert cli_skill._find_skill("social-content") == "social-content"


def test_find_skill_openclaw_prefix_resolution():
    # 传裸名应能解析出带 skill- 前缀的技能
    assert cli_skill._find_skill("quality-gate") == "skill-quality-gate"


def test_find_skill_missing():
    assert cli_skill._find_skill("nonexistent-xyz-000") is None


# ---- Web: 文件类型判定 ----

@pytest.mark.parametrize("name,kind", [
    ("a.png", "image"), ("b.JPG", "image"),
    ("c.mp4", "video"), ("d.mp3", "audio"),
    ("e.md", "text"), ("f.html", "text"), ("g.json", "text"),
    ("h.bin", "binary"), ("i.zip", "binary"),
])
def test_file_kind(name, kind):
    assert web._file_kind(name) == kind


def test_upload_keeps_multiple_files_with_same_name(tmp_path, monkeypatch):
    from fastapi import UploadFile

    monkeypatch.setattr(web, "OUTPUTS_DIR", tmp_path)
    files = [
        UploadFile(filename="image.png", file=io.BytesIO(b"first")),
        UploadFile(filename="image.png", file=io.BytesIO(b"second")),
    ]

    result = asyncio.run(web.api_upload(files, sessionId="session-a"))

    assert [item["name"] for item in result["files"]] == ["image.png", "image (2).png"]
    saved = [tmp_path / item["path"] for item in result["files"]]
    assert [path.read_bytes() for path in saved] == [b"first", b"second"]


def test_uploads_are_scoped_to_the_owning_session(tmp_path, monkeypatch):
    from fastapi import HTTPException, UploadFile

    monkeypatch.setattr(web, "OUTPUTS_DIR", tmp_path)
    first = asyncio.run(web.api_upload(
        [UploadFile(filename="shared.png", file=io.BytesIO(b"session-a"))],
        sessionId="session-a",
    ))["files"][0]
    second = asyncio.run(web.api_upload(
        [UploadFile(filename="shared.png", file=io.BytesIO(b"session-b"))],
        sessionId="session-b",
    ))["files"][0]

    assert first["path"] != second["path"]
    assert first["path"].split("/")[1] == web._attachment_scope("session-a")
    assert second["path"].split("/")[1] == web._attachment_scope("session-b")

    owned = web.ChatRequest(
        message="处理这张图",
        sessionId="session-a",
        attachments=[first],
    )
    context = web._attachment_context(owned)
    assert f'outputs/{first["path"]}' in context
    assert second["path"] not in context

    with pytest.raises(HTTPException) as exc:
        web._attachment_context(web.ChatRequest(
            message="处理这张图",
            sessionId="session-b",
            attachments=[first],
        ))
    assert exc.value.status_code == 403


def test_attachment_context_rejects_tampered_reference(tmp_path, monkeypatch):
    from fastapi import HTTPException, UploadFile

    monkeypatch.setattr(web, "OUTPUTS_DIR", tmp_path)
    attachment = asyncio.run(web.api_upload(
        [UploadFile(filename="image.png", file=io.BytesIO(b"image"))],
        sessionId="session-a",
    ))["files"][0]
    attachment["id"] = "tampered"

    with pytest.raises(HTTPException) as exc:
        web._attachment_context(web.ChatRequest(
            message="处理",
            sessionId="session-a",
            attachments=[attachment],
        ))
    assert exc.value.status_code == 403


# ---- Web: 路径穿越防护 ----

def test_safe_output_path_blocks_traversal():
    from fastapi import HTTPException
    with pytest.raises(HTTPException):
        web._safe_output_path("../../etc/passwd")


def test_safe_output_path_blocks_absolute_escape():
    from fastapi import HTTPException
    with pytest.raises(HTTPException):
        web._safe_output_path("/etc/passwd")


# ---- Web: find_skill 与 CLI 一致 ----

def test_web_find_skill_matches_cli():
    assert web.find_skill("social-content") == "social-content"
    assert web.find_skill("quality-gate") == "skill-quality-gate"
    assert web.find_skill("nope-xyz") is None


def test_chat_route_is_registered_to_handler_not_request_model():
    route = next(
        route for route in web.app.routes
        if getattr(route, "path", None) == "/api/chat" and "POST" in getattr(route, "methods", set())
    )
    assert route.endpoint is web.api_chat


def test_agent_cli_uses_running_gateway(monkeypatch):
    monkeypatch.setattr(web, "check_gateway", lambda: True)
    assert web._agent_cli_prefix() == ["openclaw", "--profile", "easel", "agent"]


def test_agent_cli_uses_local_mode_without_gateway(monkeypatch):
    monkeypatch.setattr(web, "check_gateway", lambda: False)
    assert web._agent_cli_prefix()[-1] == "--local"


def test_image_proxy_only_allows_known_media_hosts():
    assert web._image_proxy_host_allowed("i1.hdslb.com")
    assert web._image_proxy_host_allowed("mmbiz.qpic.cn")
    assert not web._image_proxy_host_allowed("127.0.0.1")
    assert not web._image_proxy_host_allowed("hdslb.com.example.org")


def test_publish_job_route_does_not_match_native_platform_route():
    from starlette.routing import Match

    scope = {"type": "http", "path": "/api/publish/jobs", "method": "POST"}
    route = next(route for route in web.app.routes if route.matches(scope)[0] is Match.FULL)

    assert route.endpoint is web.api_create_publish_job


def test_video_bgm_uses_library_for_matching_and_generic_content(tmp_path, monkeypatch):
    track = tmp_path / "promo.mp3"
    track.write_bytes(b"audio")
    monkeypatch.setattr(web, "_bgm_tracks", lambda: [track])
    monkeypatch.setattr(web, "_bgm_meta", lambda: {"promo.mp3": {"style": "ecom"}})

    assert web._video_bgm("商品上新优惠", "限时促销") == track
    assert web._video_bgm("一篇普通文章", "没有匹配的内容类型") == track


def test_video_bgm_falls_back_to_related_style(tmp_path, monkeypatch):
    """主风格无曲目时按 BGM_FALLBACK 降级到相近风格，避免科技类内容静音。"""
    corp = tmp_path / "corp.mp3"
    corp.write_bytes(b"audio")
    monkeypatch.setattr(web, "_bgm_tracks", lambda: [corp])
    # 曲库只有 corporate，但内容是科技/AI → 应回退到 corporate
    monkeypatch.setattr(web, "_bgm_meta", lambda: {"corp.mp3": {"style": "corporate"}})
    assert web._video_bgm("GPT-6发布，AI时代来了", "人工智能") == corp


def test_video_fingerprint_changes_with_voice_bgm_and_digital_human(tmp_path, monkeypatch):
    monkeypatch.setattr(web, "OUTPUTS_DIR", tmp_path)
    monkeypatch.setattr(web, "LOCAL_OUTPUTS_DIR", tmp_path)
    image = tmp_path / "card.png"
    image.write_bytes(b"image")
    bgm = tmp_path / "bgm.mp3"
    bgm.write_bytes(b"audio")
    base = web.PublishJobRequest(title="标题", body="正文", media=[])
    first = web._video_generation_fingerprint(base, [image], "voice-a", "cosyvoice", bgm)
    changed_voice = web._video_generation_fingerprint(base, [image], "voice-b", "cosyvoice", bgm)
    with_dh = web.PublishJobRequest(title="标题", body="正文", media=[], digital_human="role-a")
    changed_dh = web._video_generation_fingerprint(with_dh, [image], "voice-a", "cosyvoice", bgm)
    assert len({first, changed_voice, changed_dh}) == 3


def test_tts_parser_rejects_edge_engine():
    with pytest.raises(SystemExit):
        tts.build_parser().parse_args([
            "speak", "--text", "测试", "--output", "voice.mp3",
            "--voice", "page-default", "--engine", "edge",
        ])


def test_voice_engine_uses_voice_provider(monkeypatch):
    monkeypatch.setattr(web, "_voices_meta", lambda: {"cloned-voice": {}})
    assert web._voice_engine("Cherry") == "qwen-tts"
    assert web._voice_engine("longxiaochun_v2") == "cosyvoice"
    assert web._voice_engine("cloned-voice") == "cosyvoice"
    assert web._voice_engine("missing") is None


def test_publish_job_rejects_invalid_digital_human_position():
    with pytest.raises(ValueError):
        web.PublishJobRequest(digital_human_pos="center")


def test_emo_tasks_persist_across_reload(tmp_path, monkeypatch):
    task_file = tmp_path / "digital-human" / "tasks.json"
    monkeypatch.setattr(web, "EMO_TASKS_FILE", task_file)
    tasks = {"task-a": {"task_id": "remote-a", "status": "PENDING"}}
    web._emo_tasks_save(tasks)
    assert web._emo_tasks_load() == tasks


def test_video_generation_requires_confirmation(tmp_path, monkeypatch):
    image = tmp_path / "card.png"
    image.write_bytes(b"image")
    monkeypatch.setattr(web, "_publish_media", lambda _: ([image], []))
    result = web._generate_publish_video("job", web.PublishJobRequest())
    assert result["verified"] is False
    assert "尚未确认" in result["message"]


def test_split_captions_distributes_sentences():
    body = "第一句。第二句。第三句。第四句。第五句。"
    caps = web._split_captions(body, 3)
    assert len(caps) == 3
    assert all(caps)  # 每段非空
    # 句子少于图片数：多余图片空 caption
    caps2 = web._split_captions("只有一句", 3)
    assert caps2 == ["只有一句", "", ""]


# ---- Web: 基线画像生成 ----

def test_write_baseline_profile(tmp_path, monkeypatch):
    monkeypatch.setattr(web, "PROFILES_DIR", tmp_path)
    web._write_baseline_profile("测试画像", {
        "name": "测试画像", "platforms": ["小红书", "抖音"],
        "direction": "平价护肤测评", "tone": "亲切日常",
        "avoid": "不接医疗功效", "links": {"小红书": "https://x"},
    })
    pd = tmp_path / "测试画像"
    names = {f.name for f in pd.iterdir()}
    assert names == {"identity.md", "style.md", "audience.md",
                     "platforms.md", "preferences.md", "memory.md"}
    assert "平价护肤测评" in (pd / "identity.md").read_text()
    assert "不接医疗功效" in (pd / "preferences.md").read_text()
    assert "小红书" in (pd / "platforms.md").read_text()


# ---- Web: _persona_prefix ----

def test_persona_prefix_generic_empty():
    assert web._persona_prefix(None) == ""
    assert web._persona_prefix("不存在的画像-xyz") == ""


def test_persona_prefix_scopes_memory_to_selected_profile(tmp_path, monkeypatch):
    monkeypatch.setattr(persona, "PROFILES_DIR", tmp_path)
    (tmp_path / "画像A").mkdir()

    prefix = persona.persona_prefix("画像A")

    assert "当前使用的画像是「画像A」" in prefix
    assert "profiles/画像A/memory.md" in prefix
    assert "不要使用工作区全局 MEMORY.md" in prefix


def test_persona_gate_low_score_warns_but_never_blocks_publish():
    assert classify_persona_score(100, 80, 50) == "pass"
    assert classify_persona_score(79, 80, 50) == "warn"
    assert classify_persona_score(0, 80, 50) == "warn"


def test_persona_skill_prioritizes_positioning_and_caps_cross_niche_scores():
    skill = (PROJECT_ROOT / "skills/openclaw/skill-persona-check/SKILL.md").read_text()
    assert "账号定位与内容赛道" in skill and "| 30% |" in skill
    assert "内容形式一致性" in skill and "目标受众匹配" in skill
    assert "总分最高 59" in skill
    assert "publish_allowed` 始终为 `true" in skill


# ---- Web: 输出树结构（相对路径 + kind）----

def test_output_tree_relative_paths(tmp_path, monkeypatch):
    monkeypatch.setattr(web, "OUTPUTS_DIR", tmp_path)
    sub = tmp_path / "主题A"
    sub.mkdir()
    (sub / "note.md").write_text("x", encoding="utf-8")
    (sub / "card.png").write_bytes(b"\x89PNG")
    tree = web.get_output_tree()
    grp = next(g for g in tree if g["name"] == "主题A")
    # 目录节点带递归 children（file 节点含 name/path/kind）
    paths = {f["path"] for f in grp["children"]}
    assert "主题A/note.md" in paths and "主题A/card.png" in paths
    kinds = {f["name"]: f["kind"] for f in grp["children"]}
    assert kinds["note.md"] == "text" and kinds["card.png"] == "image"


# ---- Web: SSE 断线恢复必须绑定到当前 turn ----

def test_last_turn_rejects_stale_turn(tmp_path, monkeypatch):
    monkeypatch.setattr(web, "SESSIONS_DIR", tmp_path)
    web._save_turn("web:session-a", "done", "上一轮回答", {"turn_id": "old-turn"})

    stale = asyncio.run(web.api_chat_last("session-a", "new-turn"))
    assert stale["status"] == "stale"
    assert stale["text"] == ""

    current = asyncio.run(web.api_chat_last("session-a", "old-turn"))
    assert current["status"] == "done"
    assert current["text"] == "上一轮回答"


def test_job_events_resume_after_event_id(tmp_path, monkeypatch):
    monkeypatch.setattr(web, "SESSIONS_DIR", tmp_path)
    path = web._job_event_file("turn-a")
    path.parent.mkdir(parents=True)
    events = [
        {"id": 1, "event": "token", "data": "前"},
        {"id": 2, "event": "activity", "data": "处理中"},
        {"id": 3, "event": "token", "data": "后"},
        {"id": 4, "event": "done", "data": {"sessionKey": "s"}},
    ]
    path.write_text("\n".join(json.dumps(e, ensure_ascii=False) for e in events) + "\n")

    resumed = web._read_job_events("turn-a", after=2)
    assert [event["id"] for event in resumed] == [3, 4]
    assert resumed[0]["data"] == "后"


def test_missing_job_stream_fails_promptly(tmp_path, monkeypatch):
    from fastapi import HTTPException

    monkeypatch.setattr(web, "SESSIONS_DIR", tmp_path)
    with pytest.raises(HTTPException) as exc:
        asyncio.run(web.api_chat_job_stream("missing-turn"))
    assert exc.value.status_code == 404


def test_chat_stop_waits_for_process_and_supervisor_cleanup():
    class FakeProcess:
        def __init__(self):
            self.returncode = None
            self.terminated = False

        def poll(self):
            return self.returncode

        def terminate(self):
            self.terminated = True

        def wait(self, timeout=None):
            self.returncode = -15
            return self.returncode

    async def scenario():
        session_id = "stop-cleanup-test"
        proc = FakeProcess()
        web._RUNNING_CHAT[session_id] = proc

        async def finish_supervisor():
            while not proc.terminated:
                await asyncio.sleep(0)
            web._RUNNING_CHAT.pop(session_id, None)

        cleanup = asyncio.create_task(finish_supervisor())
        result = await web.api_chat_stop(web.StopRequest(sessionId=session_id))
        await cleanup
        web._STOPPED_CHAT.discard(session_id)
        return result, proc

    result, proc = asyncio.run(scenario())
    assert result == {"stopped": True}
    assert proc.terminated and proc.poll() == -15


def test_raw_stream_events_are_isolated_by_openclaw_session():
    own = json.dumps({
        "event": "assistant_text_stream", "evtType": "text_delta",
        "sessionId": "session-a", "runId": "run-a", "delta": "自己的回答",
    })
    foreign = json.dumps({
        "event": "assistant_thinking_stream", "evtType": "thinking_delta",
        "sessionId": "session-b", "runId": "run-b", "delta": "其他会话的思考",
    })

    assert web._raw_event_for_session(own, "session-a")["delta"] == "自己的回答"
    assert web._raw_event_for_session(foreign, "session-a") is None


def test_raw_stream_parser_keeps_legacy_events_without_session_id():
    legacy = json.dumps({
        "event": "assistant_text_stream", "evtType": "text_delta", "delta": "兼容旧事件",
    })
    assert web._raw_event_for_session(legacy, "session-a")["delta"] == "兼容旧事件"


def test_benchmark_account_normalizes_legacy_config():
    account = web._normalize_benchmark_account({
        "platform": "bilibili", "name": "影视飓风",
        "rss_url": "/bilibili/user/dynamic/946974",
    })
    assert account["id"] == "bilibili:946974"
    assert account["identifier"] == "946974"
    assert account["feed_status"] == "unknown"


def test_benchmark_accounts_are_deduplicated_by_platform_identifier():
    accounts = web._dedupe_benchmark_accounts([
        {"platform": "bilibili", "name": "旧名称", "rss_url": "/bilibili/user/dynamic/946974"},
        {"platform": "bilibili", "name": "影视飓风", "rss_url": "/bilibili/user/dynamic/946974",
         "followers": 100, "verified": True},
    ])
    assert len(accounts) == 1
    assert accounts[0]["name"] == "影视飓风"
    assert accounts[0]["followers"] == 100
    assert accounts[0]["verified"] is True


def test_benchmark_pool_initializes_and_persists(tmp_path, monkeypatch):
    monkeypatch.setattr(web, "OUTPUTS_DIR", tmp_path)
    monkeypatch.setattr(web, "BENCHMARK_POOL_FILE", tmp_path / "_benchmark_pool.json")
    accounts = web._load_benchmark_pool()
    assert any(item["id"] == "bilibili:946974" for item in accounts)
    saved = web._upsert_benchmark_pool({
        "platform": "bilibili", "identifier": "123", "name": "测试账号",
        "rss_url": "/bilibili/user/dynamic/123", "verified": True,
    })
    assert saved["id"] == "bilibili:123"
    assert any(item["id"] == "bilibili:123" for item in web._load_benchmark_pool())


def test_bilibili_search_provider_returns_normalized_accounts(monkeypatch):
    monkeypatch.setattr(web, "_bilibili_search_json", lambda *args, **kwargs: {
        "code": 0,
        "data": {"page": 1, "numPages": 2, "numResults": 21, "result": [{
            "type": "bili_user", "mid": 946974, "uname": "影视飓风",
            "fans": 100, "usign": "无限进步", "upic": "//example.com/avatar.jpg",
        }]},
    })
    result = web.BilibiliSearchProvider().search("影视", min_followers=50)
    assert result["pages"] == 2
    assert result["results"][0]["id"] == "bilibili:946974"
    assert result["results"][0]["verified"] is True


def test_bilibili_search_falls_back_to_browser(monkeypatch):
    provider = web._BENCHMARK_SEARCH_PROVIDERS["bilibili"]
    monkeypatch.setattr(provider, "search", lambda *args: (_ for _ in ()).throw(RuntimeError("412")))
    monkeypatch.setattr(web, "_search_bilibili_browser_fallback", lambda *args: {
        "results": [{"id": "bilibili:1", "platform": "bilibili", "identifier": "1",
                     "name": "浏览器结果", "rss_url": "/bilibili/user/dynamic/1"}],
        "page": 1, "pages": 1, "total": 1, "fallback": "browser",
    })
    result = asyncio.run(web.api_benchmarks_search("fallback-test", "bilibili", 1, 20, "relevance", 0))
    assert result["fallback"] == "browser"
    assert result["results"][0]["name"] == "浏览器结果"


def test_browser_account_search_platforms_have_executable_paths():
    expected = {"xiaohongshu", "douyin", "bilibili", "weibo", "zhihu",
                "toutiao", "wechat", "kuaishou", "36kr"}
    assert expected == set(browser_account_search.PLATFORMS)
    for config in browser_account_search.PLATFORMS.values():
        assert "{keyword}" in config["search"]
        assert config["profile_re"] and config["post_re"]


def test_browser_account_network_mapping_uses_stable_platform_id():
    account = browser_account_search._account_from_object("douyin", {
        "sec_uid": "stable-sec-uid", "nickname": "测试账号",
        "follower_count": 12000, "signature": "简介",
    })
    assert account["id"] == "douyin:stable-sec-uid"
    assert account["rss_url"] == "/douyin/user/stable-sec-uid"
    assert account["followers"] == 12000


def test_browser_account_network_mapping_rejects_empty_identifier():
    assert browser_account_search._account_from_object(
        "bilibili", {"mid": "", "uname": "无效账号"}) is None


def test_browser_benchmark_profile_rejects_cross_platform_url():
    from fastapi import HTTPException

    request = web.BrowserBenchmarkProfileRequest(
        platform="douyin", url="https://www.xiaohongshu.com/user/profile/test")
    with pytest.raises(HTTPException) as exc:
        asyncio.run(web.api_benchmarks_browser_profile(request))
    assert exc.value.status_code == 400


def test_benchmark_resolve_extracts_profile_from_share_text():
    account = web._resolve_benchmark_input(
        "复制打开主页 https://space.bilibili.com/946974?from=share 看更多内容")
    assert account["id"] == "bilibili:946974"
    assert account["rss_url"] == "/bilibili/user/dynamic/946974"
    assert account["source"] == "link_resolve"


def test_benchmark_resolve_rejects_untrusted_host():
    with pytest.raises(ValueError):
        web._resolve_benchmark_input("https://127.0.0.1/internal")


def test_benchmark_resolve_extracts_wechat_biz_without_network():
    account = web._resolve_benchmark_input(
        "https://mp.weixin.qq.com/s?__biz=MzI3MjQ4NzU2NA%3D%3D&mid=1")
    assert account["id"] == "wechat:MzI3MjQ4NzU2NA=="
    assert account["rss_url"] == "/wechat/mp/MzI3MjQ4NzU2NA=="


def test_benchmark_avatar_proxy_rejects_untrusted_hosts():
    with pytest.raises(ValueError):
        web._fetch_benchmark_avatar("https://127.0.0.1/private.png")


def test_browser_goto_accepts_timeout_after_navigation_committed():
    class Page:
        url = "https://www.xiaohongshu.com/search_result?keyword=test"

        def goto(self, *args, **kwargs):
            raise TimeoutError("domcontentloaded timeout")

    browser_account_search._goto(Page(), "https://www.xiaohongshu.com/search_result?keyword=test")


def test_browser_page_state_reports_platform_risk():
    state = browser_account_search._page_state(
        "xiaohongshu", "IP存在风险", "https://www.xiaohongshu.com/website-login/error?error_code=300012", False)
    assert state == "blocked"


def test_browser_jobs_reject_same_platform_concurrency():
    from fastapi import HTTPException

    web._BROWSER_BENCHMARK_JOBS["active-test"] = {
        "id": "active-test", "platform": "xiaohongshu", "action": "login", "state": "running",
    }
    try:
        with pytest.raises(HTTPException) as exc:
            web._start_browser_benchmark_job(["search", "--platform", "xiaohongshu", "--keyword", "test"])
        assert exc.value.status_code == 409
    finally:
        web._BROWSER_BENCHMARK_JOBS.pop("active-test", None)
