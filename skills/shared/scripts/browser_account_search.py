#!/usr/bin/env python3
from __future__ import annotations

import argparse
import fcntl
import json
import os
import re
import sys
import time
import urllib.parse
from contextlib import contextmanager
from pathlib import Path

PROFILE_ROOT = Path.home() / ".easel-browser-profiles"
LAUNCH_ARGS = [
    "--disable-blink-features=AutomationControlled",
    "--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu",
    "--no-first-run", "--no-default-browser-check", "--mute-audio",
]
PLATFORMS = {
    "xiaohongshu": {
        "name": "小红书", "profile": "XiaohongshuProfile",
        "search": "https://www.xiaohongshu.com/search_result?keyword={keyword}&source=web_search_result_notes&type=51",
        "home": "https://www.xiaohongshu.com/explore",
        "profile_re": r"xiaohongshu\.com/user/profile/([0-9a-zA-Z]+)",
        "post_re": r"xiaohongshu\.com/(?:explore|discovery/item)/([0-9a-zA-Z]+)",
        "post_selector": ".note-item a[href*='/explore/'], section a[href*='/explore/']",
        "rss": "/xiaohongshu/user/{id}/notes",
        "login_text": ["登录后查看搜索结果", "登录即可查看"],
    },
    "douyin": {
        "name": "抖音", "profile": "DouyinProfile",
        "search": "https://www.douyin.com/search/{keyword}?type=user",
        "home": "https://www.douyin.com",
        "profile_re": r"douyin\.com/user/([0-9a-zA-Z_-]+)",
        "post_re": r"douyin\.com/(?:video|note)/([0-9]+)",
        "post_selector": "[data-e2e='user-post-list'] a[href*='/video/'], [class*='user-post'] a[href*='/video/'], [class*='user-post'] a[href*='/note/']",
        "rss": "/douyin/user/{id}",
        "login_text": ["登录后即可搜索", "扫码登录", "登录后即可查看", "登录查看"],
    },
    "bilibili": {
        "name": "B站", "profile": "BilibiliProfile",
        "search": "https://search.bilibili.com/upuser?keyword={keyword}",
        "home": "https://www.bilibili.com",
        "profile_re": r"space\.bilibili\.com/([0-9]+)",
        "post_re": r"bilibili\.com/video/(BV[0-9a-zA-Z]+)",
        "post_selector": "a[href*='bilibili.com/video/']",
        "rss": "/bilibili/user/dynamic/{id}",
        "login_text": [],
    },
    "weibo": {
        "name": "微博", "profile": "WeiboProfile",
        "search": "https://s.weibo.com/user?q={keyword}",
        "home": "https://weibo.com",
        "profile_re": r"weibo\.com/u/([0-9]+)",
        "post_re": r"weibo\.com/[0-9a-zA-Z_-]+/([0-9a-zA-Z]+)",
        "post_selector": "article a[href]",
        "rss": "/weibo/user/{id}",
        "login_text": ["立即登录查看更多结果"],
    },
    "zhihu": {
        "name": "知乎", "profile": "ZhihuProfile",
        "search": "https://www.zhihu.com/search?type=people&q={keyword}",
        "home": "https://www.zhihu.com",
        "profile_re": r"zhihu\.com/(?:people|org)/([^/?#]+)",
        "post_re": r"(?:zhuanlan\.zhihu\.com/p/([0-9]+)|zhihu\.com/question/[0-9]+/answer/([0-9]+))",
        "post_selector": ".List-item a[href], main a[href]",
        "rss": "/zhihu/people/activities/{id}",
        "login_text": ["登录/注册", "请登录后查看"],
    },
    "toutiao": {
        "name": "头条", "profile": "ToutiaoProfile",
        "search": "https://so.toutiao.com/search/?dvpf=pc&keyword={keyword}&pd=user",
        "home": "https://www.toutiao.com",
        "profile_re": r"toutiao\.com/c/user/([^/?#]+)",
        "post_re": r"toutiao\.com/(?:article|video)/([0-9]+)",
        "post_selector": "main a[href], [class*='profile'] a[href]",
        "rss": "/toutiao/user/{id}",
        "login_text": [],
        "empty_text": ["未找到相关结果", "请尝试缩短关键词"],
    },
    "wechat": {
        "name": "公众号", "profile": "WechatProfile",
        "search": "https://weixin.sogou.com/weixin?type=2&query={keyword}",
        "home": "https://weixin.sogou.com",
        "profile_re": r"mp\.weixin\.qq\.com",
        "post_re": r"mp\.weixin\.qq\.com/s(?:/|\?)",
        "post_selector": "main a[href*='mp.weixin.qq.com/s']",
        "rss": "/wechat/mp/{id}",
        "login_text": ["请输入验证码", "登录", "暂无与", "相关的官方认证订阅号"],
        # 公众号搜索从文章结果中提取公众号名称
        "account_selector": ".news-list > li",
        "account_name_selector": ".all-time-y2",
        # 搜狗微信搜索需要微信扫码登录
        "login_btn_text": "登录",
        "login_frame_url_contains": "open.weixin.qq.com",
    },
    "kuaishou": {
        "name": "快手", "profile": "KuaishouProfile",
        "search": "https://www.kuaishou.com/search/author?searchKey={keyword}",
        "home": "https://www.kuaishou.com",
        "profile_re": r"kuaishou\.com/profile/([^/?#]+)",
        "post_re": r"kuaishou\.com/short-video/([^/?#]+)",
        "post_selector": "[class*='profile'] a[href*='/short-video/']",
        "rss": "https://www.kuaishou.com/profile/{id}",
        "login_text": ["登录即可享受", "立即登录", "登录后查看"],
        "blocked_text": ['"result":2', '"result":1'],
    },
    "36kr": {
        "name": "36氪", "profile": "Kr36Profile",
        "search": "https://36kr.com/search/articles/{keyword}",
        "home": "https://36kr.com",
        "profile_re": r"36kr\.com/user/([^/?#]+)",
        "post_re": r"36kr\.com/p/([0-9]+)",
        "post_selector": "main a[href*='/p/']",
        "rss": "/36kr/newsflashes",
        "login_text": [],
        "empty_text": ["暂无搜索结果", "没有找到相关"],
    },
}


def parse_num(value: str) -> int | None:
    text = str(value or "").strip().replace(",", "")
    match = re.search(r"([0-9]+(?:\.[0-9]+)?)\s*([万亿wWkK]?)", text)
    if not match:
        return None
    scale = {"": 1, "万": 10_000, "亿": 100_000_000, "w": 10_000,
             "W": 10_000, "k": 1_000, "K": 1_000}[match.group(2)]
    return int(float(match.group(1)) * scale)


def _profile_dir(platform: str) -> Path:
    return PROFILE_ROOT / PLATFORMS[platform]["profile"]


@contextmanager
def _profile_lock(platform: str):
    PROFILE_ROOT.mkdir(parents=True, exist_ok=True)
    lock_path = PROFILE_ROOT / f'.{PLATFORMS[platform]["profile"]}.lock'
    handle = lock_path.open('w')
    try:
        fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError as error:
        handle.close()
        raise RuntimeError(f'{PLATFORMS[platform]["name"]}浏览器正在被其他任务使用') from error
    try:
        yield
    finally:
        fcntl.flock(handle.fileno(), fcntl.LOCK_UN)
        handle.close()


_STEALTH_JS = """
Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
Object.defineProperty(navigator, 'languages', { get: () => ['zh-CN', 'zh', 'en-US', 'en'] });
Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
window.chrome = { runtime: {}, app: {}, csi: () => {}, loadTimes: () => {} };
const originalQuery = window.navigator.permissions && window.navigator.permissions.query;
if (originalQuery) {
    window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications'
            ? Promise.resolve({ state: Notification.permission })
            : originalQuery(parameters)
    );
}
"""


def _import_ego_cookies(context, platform: str) -> bool:
    """从 Ego Lite 浏览器导入登录态 Cookie 到 Playwright context。
    复用用户日常浏览器的登录态，无需重新扫码登录。"""
    import sqlite3
    import shutil
    import tempfile
    import hashlib
    import subprocess
    from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

    ego_profile = Path.home() / "Library" / "Application Support" / "Citro Labs" / "ego lite"
    cookie_file = ego_profile / "Default" / "Cookies"
    if not cookie_file.is_file():
        return False

    # 从 Keychain 获取 Ego Lite 的加密密钥
    try:
        key_passphrase = subprocess.check_output(
            ["security", "find-generic-password", "-w", "-s", "ego safe storage"],
            stderr=subprocess.DEVNULL,
        ).strip()
    except Exception:
        return False

    # PBKDF2 派生密钥
    derived_key = hashlib.pbkdf2_hmac("sha1", key_passphrase, b"saltysalt", 1003, 16)
    iv = b"\x20" * 16

    # 平台域名映射
    domain_map = {
        "xiaohongshu": "xiaohongshu.com",
        "douyin": "douyin.com",
        "bilibili": "bilibili.com",
        "weibo": "weibo.com",
        "zhihu": "zhihu.com",
        "toutiao": "toutiao.com",
        "kuaishou": "kuaishou.com",
        "wechat": "sogou.com",
    }
    target_domains = [domain_map.get(platform, "")]
    # 微博需要同时导入 weibo.cn 的 Cookie
    if platform == "weibo":
        target_domains.append("weibo.cn")
    target_domains = [d for d in target_domains if d]
    if not target_domains:
        return False

    # 复制 Cookie 数据库（避免锁定问题）
    tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
    tmp.close()
    try:
        shutil.copy2(cookie_file, tmp.name)
        conn = sqlite3.connect(tmp.name)
        cur = conn.cursor()
        # 查询所有匹配域名的 Cookie
        placeholders = " OR ".join(["host_key LIKE ?" for _ in target_domains])
        params = [f"%{d}%" for d in target_domains]
        cur.execute(
            f"SELECT host_key, name, encrypted_value, path, expires_utc, is_secure, is_httponly, samesite "
            f"FROM cookies WHERE {placeholders}",
            params,
        )
        rows = cur.fetchall()
        conn.close()
    except Exception:
        os.unlink(tmp.name)
        return False
    os.unlink(tmp.name)

    if not rows:
        return False

    # 解密并转换为 Playwright Cookie 格式
    cookies = []
    for host, name, enc_val, path, expires, secure, httponly, samesite in rows:
        try:
            if enc_val[:3] != b"v10":
                continue
            encrypted = enc_val[3:]
            cipher = Cipher(algorithms.AES(derived_key), modes.CBC(iv))
            decryptor = cipher.decryptor()
            decrypted = decryptor.update(encrypted) + decryptor.finalize()
            # 去 PKCS7 padding
            pad_len = decrypted[-1]
            if 1 <= pad_len <= 16:
                decrypted = decrypted[:-pad_len]
            # 跳过前 32 字节 SHA-256 前缀
            value = decrypted[32:].decode("utf-8", "replace")
            if not value:
                continue
            cookie = {
                "name": name,
                "value": value,
                "domain": host,
                "path": path or "/",
                "secure": bool(secure),
                "httpOnly": bool(httponly),
            }
            # expires_utc 是 Chrome 时间戳（微秒，从 1601-01-01 起）
            if expires and expires > 0:
                cookie["expires"] = expires / 1_000_000 - 11644473600
            # samesite: 0=None, 1=Lax, 2=Strict
            if samesite == 1:
                cookie["sameSite"] = "Lax"
            elif samesite == 2:
                cookie["sameSite"] = "Strict"
            cookies.append(cookie)
        except Exception:
            continue

    if not cookies:
        return False

    try:
        context.add_cookies(cookies)
        return True
    except Exception:
        return False


def _launch(playwright, platform: str, headed: bool):
    profile = _profile_dir(platform)
    profile.mkdir(parents=True, exist_ok=True)
    real_ua = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.6943.16 Safari/537.36"
    # 小红书、抖音、快手对 headless 模式有严格检测，必须用 headed 模式
    # 其他平台需要登录时也用 headed 模式，让用户能看到浏览器窗口登录
    needs_real_headed = platform in ("xiaohongshu", "douyin", "kuaishou")
    args = list(LAUNCH_ARGS)
    if not headed and not needs_real_headed:
        args.append("--headless=new")
    kwargs = {"headless": not headed and not needs_real_headed, "locale": "zh-CN", "args": args,
              "viewport": {"width": 1440, "height": 900},
              "user_agent": real_ua}
    proxy = os.environ.get("https_proxy") or os.environ.get("http_proxy") or os.environ.get("EASEL_PROXY")
    if proxy and platform != "xiaohongshu":
        kwargs["proxy"] = {"server": proxy}
    context = playwright.chromium.launch_persistent_context(str(profile), **kwargs)
    try:
        context.add_init_script(_STEALTH_JS)
    except Exception:
        pass
    # 从 Ego Lite 浏览器导入登录态 Cookie
    _import_ego_cookies(context, platform)
    return context


def _text(page) -> str:
    try:
        body = re.sub(r"\s+", " ", page.inner_text("body")).strip()
        title = ""
        try:
            title = page.title().strip()
        except Exception:
            pass
        return f"{title} {body}".strip()
    except Exception:
        return ""


def _goto(page, url: str) -> None:
    try:
        page.goto(url, wait_until="commit", timeout=30_000)
        try:
            page.wait_for_load_state("domcontentloaded", timeout=10_000)
        except Exception:
            pass
    except Exception:
        expected = urllib.parse.urlparse(url).hostname or ''
        current = urllib.parse.urlparse(page.url).hostname or ''
        if not current or not (current == expected or current.endswith('.' + expected) or expected.endswith('.' + current)):
            raise


def _wait_for_login(page, platform: str, cfg: dict, timeout: int = 600) -> str:
    """检测到需要登录/验证码时，保持浏览器打开等待用户处理，轮询状态。
    返回 'ready'（已登录/验证通过）、'blocked'（真正风控）或 'timeout'（超时）。"""
    # 公众号需要点击登录按钮弹出微信扫码
    if platform == "wechat" and cfg.get("login_btn_text"):
        try:
            page.evaluate(f"""() => {{
                const btn = [...document.querySelectorAll('a, button')].find(b => 
                    (b.innerText||'').trim() === {repr(cfg['login_btn_text'])});
                if (btn) btn.click();
            }}""")
            page.wait_for_timeout(2000)
        except Exception:
            pass
    deadline = time.time() + max(30, min(timeout, 600))
    while time.time() < deadline:
        text = _text(page)
        state = _page_state(platform, text, page.url, False)
        # 只有真正的 IP 风控才返回 blocked
        if state == "blocked":
            return "blocked"
        # login_required 表示需要用户操作（登录/验证码），继续等待
        # done 表示用户已处理完成
        if state != "login_required":
            return "ready"
        # 检查微信扫码 iframe 是否还在（登录成功后 iframe 会消失）
        if platform == "wechat" and cfg.get("login_frame_url_contains"):
            has_login_frame = any(cfg["login_frame_url_contains"] in f.url for f in page.frames)
            if not has_login_frame:
                # iframe 消失，可能登录成功
                page.wait_for_timeout(2000)
                text = _text(page)
                state = _page_state(platform, text, page.url, False)
                if state != "login_required":
                    return "ready"
        page.wait_for_timeout(2000)
    return "timeout"


def _login_required(platform: str, text: str) -> bool:
    return any(marker in text for marker in PLATFORMS[platform]["login_text"])


def _page_state(platform: str, text: str, url: str, has_results: bool) -> str:
    cfg = PLATFORMS[platform]
    # 真正的风控（无法手动处理）：IP 风险、antispider 页面
    if "antispider" in url or re.search(r"IP存在风险|环境异常", text):
        return "blocked"
    # 需要用户操作的页面：验证码中间页、登录页（用户可扫码/输入验证码/登录）
    if "website-login/error" in url or "error_code=" in url or re.search(r"验证码中间页|安全验证|访问频繁", text):
        return "login_required"
    for marker in cfg.get("blocked_text", []):
        if marker in text:
            return "blocked"
    if _login_required(platform, text) and not has_results:
        return "login_required"
    # 公众号搜索未登录时显示"暂无与...相关的官方认证订阅号"
    if platform == "wechat" and not has_results and "暂无" in text and "官方认证订阅号" in text:
        return "login_required"
    if not has_results:
        for marker in cfg.get("empty_text", []):
            if marker in text:
                return "done"
    return "done"


def _account_from_object(platform: str, value: dict) -> dict | None:
    candidates = {
        "xiaohongshu": (value.get("user_id") or value.get("userId"), value.get("nickname") or value.get("name")),
        "douyin": (value.get("sec_uid") or value.get("secUid"), value.get("nickname")),
        "bilibili": (value.get("mid"), value.get("uname") or value.get("name")),
        "weibo": (value.get("idstr") or value.get("id"), value.get("screen_name")),
        "zhihu": (value.get("url_token") or value.get("urlToken"), value.get("name")),
        "toutiao": (value.get("token") or value.get("user_token"), value.get("name") or value.get("screen_name")),
        "kuaishou": (value.get("user_id") or value.get("userId") or value.get("id"), value.get("user_name") or value.get("name")),
    }
    identifier, name = candidates.get(platform, (None, None))
    if identifier is None or not name:
        return None
    identifier = str(identifier).strip()
    if not identifier:
        return None
    avatar = value.get("avatar") or value.get("avatar_url") or value.get("avatarUrl") or value.get("upic") or ""
    if isinstance(avatar, dict):
        avatar = (avatar.get("url_list") or avatar.get("urlList") or [""])[0]
    followers = value.get("follower_count", value.get("followers_count", value.get("fans")))
    cfg = PLATFORMS[platform]
    profile_url = value.get("profile_url") or value.get("url") or ""
    if not isinstance(profile_url, str) or not profile_url.startswith("http"):
        profile_url = {
            "xiaohongshu": f"https://www.xiaohongshu.com/user/profile/{identifier}",
            "douyin": f"https://www.douyin.com/user/{identifier}",
            "bilibili": f"https://space.bilibili.com/{identifier}",
            "weibo": f"https://weibo.com/u/{identifier}",
            "zhihu": f"https://www.zhihu.com/people/{identifier}",
            "toutiao": f"https://www.toutiao.com/c/user/token/{identifier}/",
            "kuaishou": f"https://www.kuaishou.com/profile/{identifier}",
        }.get(platform, "")
    return {
        "id": f"{platform}:{identifier}", "platform": platform, "identifier": identifier,
        "name": re.sub(r"<[^>]+>", "", str(name)), "profile_url": profile_url,
        "rss_url": cfg["rss"].format(id=identifier) if cfg["rss"] else "",
        "avatar": str(avatar), "description": str(value.get("signature") or value.get("description") or value.get("usign") or ""),
        "followers": parse_num(str(followers)) if followers is not None else None,
        "source": f"{platform}_browser_network", "verified": True,
        "feed_status": "unknown", "last_verified_at": int(time.time()),
    }


def _collect_accounts(platform: str, value, out: dict[str, dict]) -> None:
    if isinstance(value, dict):
        account = _account_from_object(platform, value)
        if account:
            out.setdefault(account["id"], account)
        for child in value.values():
            _collect_accounts(platform, child, out)
    elif isinstance(value, list):
        for child in value:
            _collect_accounts(platform, child, out)


def _dom_accounts(platform: str, page) -> list[dict]:
    cfg = PLATFORMS[platform]
    # 公众号搜索从文章结果中提取公众号名称（没有用户主页链接）
    if platform == "wechat" and cfg.get("account_selector"):
        items = page.eval_on_selector_all(cfg["account_selector"], """els => els.map(e => {
            const nameEl = e.querySelector(%SELECTOR%);
            const link = e.querySelector('a[href]');
            return { name: nameEl ? nameEl.innerText.trim() : '', text: (e.innerText||'').replace(/\\s+/g,' ').trim().slice(0,200), href: link ? link.href : '' };
        })""".replace("%SELECTOR%", repr(cfg["account_name_selector"])))
        out: dict[str, dict] = {}
        for item in items:
            name = item.get("name", "").strip()
            if not name or len(name) > 40:
                continue
            # 用公众号名称作为 ID（公众号没有公开的数字 ID）
            identifier = name
            account_id = f"wechat:{name}"
            if account_id in out:
                continue
            out[account_id] = {
                "id": account_id, "platform": "wechat", "identifier": identifier,
                "name": name, "profile_url": "",
                "rss_url": f"/wechat/mp/{name}",
                "avatar": "", "description": item.get("text", "")[:200],
                "followers": None, "source": "wechat_browser_dom",
                "verified": True, "feed_status": "unknown", "last_verified_at": int(time.time()),
            }
        return list(out.values())

    links = page.eval_on_selector_all("a[href]", """els => els.map(a => ({
      href: a.href, text: (a.innerText || a.textContent || '').replace(/\\s+/g, ' ').trim(),
      card: (a.closest('article, li, section, [class*=card], [class*=item], [class*=user]')?.innerText || '').replace(/\\s+/g, ' ').trim(),
      avatar: a.querySelector('img')?.src || a.closest('article, li, section, [class*=card], [class*=item], [class*=user]')?.querySelector('img')?.src || ''
    }))""")
    out: dict[str, dict] = {}
    regex = re.compile(cfg["profile_re"])
    for link in links:
        href = link.get("href", "")
        # 头条搜索结果是跳转链接，需要解析 url 参数获取实际用户链接
        if platform == "toutiao" and "sou.toutiao.com/search/jump" in href:
            try:
                parsed = urllib.parse.urlparse(href)
                params = urllib.parse.parse_qs(parsed.query)
                real_url = params.get("url", [""])[0]
                if real_url:
                    href = urllib.parse.unquote(real_url)
            except Exception:
                pass
        match = regex.search(href)
        if not match:
            continue
        identifier = urllib.parse.unquote(match.group(1))
        text = link.get("text", "").strip()
        card = link.get("card", "").strip()
        name = text.split("\n")[0].strip() if text else ""
        name = re.split(r"\s+[0-9.,]+\s*[万亿wWkK]?\s*(?:粉丝|关注者|关注|视频|文章|回答)", name)[0].strip()
        name = re.split(r"\s+(?:粉丝|关注者|关注|视频|文章|回答)[：:・·]", name)[0].strip()
        name = re.split(r"\s+(?:小红书号|抖音号|简介|认证)[：:]", name)[0].strip()
        name = re.sub(r"\s+\d+(?:天|小时|分钟)?前更新$", "", name).strip()
        if not name or len(name) > 80:
            parts = [part.strip() for part in card.split("\n") if part.strip()]
            name = parts[0] if parts else f'{cfg["name"]} {identifier[:12]}'
            name = re.split(r"\s+[0-9.,]+\s*[万亿wWkK]?\s*(?:粉丝|关注者|关注|视频|文章|回答)", name)[0].strip()
            name = re.split(r"\s+(?:粉丝|关注者|关注|视频|文章|回答)[：:]", name)[0].strip()
        # 优先匹配"粉丝・2.4万"格式，再匹配"4.6万粉丝"和"粉丝：4.6万"
        followers_match = re.search(r"粉丝[・·]\s*([0-9.,]+\s*[万亿wWkK]?)", card)
        if not followers_match:
            followers_match = re.search(r"([0-9.,]+\s*[万亿wWkK]?)\s*(?:粉丝|关注者)", card)
        if not followers_match:
            followers_match = re.search(r"(?:粉丝|关注者|粉丝数|关注)[：:]\s*([0-9.,]+\s*[万亿wWkK]?)", card)
        out.setdefault(f"{platform}:{identifier}", {
            "id": f"{platform}:{identifier}", "platform": platform, "identifier": identifier,
            "name": name[:80], "profile_url": href,
            "rss_url": cfg["rss"].format(id=identifier) if cfg["rss"] else "",
            "avatar": link.get("avatar", ""), "description": card[:300],
            "followers": parse_num(followers_match.group(1)) if followers_match else None,
            "source": f"{platform}_browser_dom", "verified": True,
            "feed_status": "unknown", "last_verified_at": int(time.time()),
        })
    return list(out.values())


def search(platform: str, keyword: str, limit: int, headed: bool) -> dict:
    from playwright.sync_api import sync_playwright
    cfg = PLATFORMS[platform]
    captured: dict[str, dict] = {}
    with _profile_lock(platform), sync_playwright() as playwright:
        context = _launch(playwright, platform, headed)
        page = context.pages[0] if context.pages else context.new_page()
        def on_response(response):
            try:
                if "json" not in (response.headers.get("content-type", "")):
                    return
                _collect_accounts(platform, response.json(), captured)
            except Exception:
                pass
        page.on("response", on_response)
        try:
            url = cfg["search"].format(keyword=urllib.parse.quote(keyword))
            # 需要登录的平台先访问首页建立 session，避免直接访问搜索页触发风控
            if platform in ("xiaohongshu", "douyin", "kuaishou", "wechat"):
                try:
                    _goto(page, cfg.get("home", ""))
                    page.wait_for_timeout(2000)
                except Exception:
                    pass
            try:
                _goto(page, url)
            except Exception:
                text = _text(page)
                state = _page_state(platform, text, page.url, False)
                return {"platform": platform, "keyword": keyword,
                        "state": state if state != "done" else "blocked",
                        "results": [], "page_url": page.url, "captured": 0,
                        "warning": f'{cfg["name"]}页面加载超时，可能受到网络或平台限制'}
            page.wait_for_timeout(3500)
            # 移除登录弹窗/遮罩，让搜索结果可见
            try:
                page.evaluate("""() => {
                    document.querySelectorAll('.reds-modal, [class*="login-modal"], [class*="modal"], [class*="mask"], [class*="overlay"]').forEach(m => m.remove());
                }""")
                page.wait_for_timeout(1500)
            except Exception:
                pass
            # 小红书搜索页默认是"全部"分类，需要点击"用户"Tab 才能搜索用户
            if platform == "xiaohongshu":
                try:
                    clicked = page.evaluate("""() => {
                        const tabs = [...document.querySelectorAll('div.channel')];
                        const userTab = tabs.find(t => t.innerText.trim() === '用户');
                        if (userTab) { userTab.click(); return true; }
                        return false;
                    }""")
                    if clicked:
                        page.wait_for_timeout(4000)
                        # 清空点击 Tab 前捕获的笔记搜索结果
                        captured.clear()
                except Exception:
                    pass
            text = _text(page)
            results = list(captured.values())
            dom = _dom_accounts(platform, page)
            known = {item["id"] for item in results}
            results.extend(item for item in dom if item["id"] not in known)
            # 过滤当前登录用户（小红书用户搜索结果中会包含"我"）
            results = [r for r in results if r["name"] != "我"]
            state = _page_state(platform, text, page.url, bool(results))
            # 检测到需要登录时，保持浏览器打开等待用户登录，登录后自动重新搜索
            if state == "login_required":
                login_result = _wait_for_login(page, platform, cfg, timeout=600)
                if login_result == "ready":
                    # 登录成功，重新导航到搜索页
                    captured.clear()
                    if platform == "xiaohongshu":
                        try:
                            _goto(page, cfg.get("home", "https://www.xiaohongshu.com/explore"))
                            page.wait_for_timeout(1500)
                        except Exception:
                            pass
                    # 公众号登录成功后改用 type=1（公众号搜索）获取更准确的结果
                    if platform == "wechat":
                        url = f"https://weixin.sogou.com/weixin?type=1&query={urllib.parse.quote(keyword)}"
                    _goto(page, url)
                    page.wait_for_timeout(3500)
                    if platform == "xiaohongshu":
                        try:
                            page.evaluate("""() => {
                                document.querySelectorAll('.reds-modal, [class*="login-modal"], [class*="modal"], [class*="mask"], [class*="overlay"]').forEach(m => m.remove());
                            }""")
                            page.wait_for_timeout(1500)
                            clicked = page.evaluate("""() => {
                                const tabs = [...document.querySelectorAll('div.channel')];
                                const userTab = tabs.find(t => t.innerText.trim() === '用户');
                                if (userTab) { userTab.click(); return true; }
                                return false;
                            }""")
                            if clicked:
                                page.wait_for_timeout(4000)
                                captured.clear()
                        except Exception:
                            pass
                    text = _text(page)
                    results = list(captured.values())
                    dom = _dom_accounts(platform, page)
                    known = {item["id"] for item in results}
                    results.extend(item for item in dom if item["id"] not in known)
                    results = [r for r in results if r["name"] != "我"]
                    state = _page_state(platform, text, page.url, bool(results))
                elif login_result == "blocked":
                    return {"platform": platform, "keyword": keyword,
                            "state": "blocked", "results": [], "page_url": page.url, "captured": 0,
                            "warning": f'{cfg["name"]}平台检测到网络风险，请更换网络后重试'}
                else:
                    return {"platform": platform, "keyword": keyword,
                            "state": "login_required", "results": [], "page_url": page.url, "captured": 0,
                            "warning": f'{cfg["name"]}登录超时，请重新尝试'}
            # 滚动加载更多结果（最多 3 次滚动，每次等待 2 秒）
            if state == "done" and len(results) < limit:
                for _ in range(3):
                    prev_count = len(results)
                    page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                    page.wait_for_timeout(2000)
                    new_dom = _dom_accounts(platform, page)
                    known = {item["id"] for item in results}
                    results.extend(item for item in new_dom if item["id"] not in known)
                    if len(results) == prev_count:
                        break
            return {"platform": platform, "keyword": keyword,
                    "state": state,
                    "results": results[:max(1, min(limit, 50))], "page_url": page.url, "captured": len(captured)}
        finally:
            context.close()


def profile(platform: str, url: str, limit: int, headed: bool) -> dict:
    from playwright.sync_api import sync_playwright
    cfg = PLATFORMS[platform]
    captured: dict[str, dict] = {}
    with _profile_lock(platform), sync_playwright() as playwright:
        context = _launch(playwright, platform, headed)
        page = context.pages[0] if context.pages else context.new_page()
        def on_response(response):
            try:
                if "json" in response.headers.get("content-type", ""):
                    _collect_accounts(platform, response.json(), captured)
            except Exception:
                pass
        page.on("response", on_response)
        try:
            _goto(page, url)
            page.wait_for_timeout(3500)
            text = _text(page)
            match = re.search(cfg["profile_re"], page.url)
            identifier = urllib.parse.unquote(match.group(1)) if match else ""
            accounts = list(captured.values()) or _dom_accounts(platform, page)
            account = next((item for item in accounts if item["identifier"] == identifier), accounts[0] if accounts else None)
            if not account and identifier:
                account = {"id": f"{platform}:{identifier}", "platform": platform, "identifier": identifier,
                           "name": page.title().split(' - ')[0].split('的')[0], "profile_url": page.url,
                           "rss_url": cfg["rss"].format(id=identifier) if cfg["rss"] else "",
                           "source": f"{platform}_browser_dom", "verified": True, "feed_status": "unknown"}
            links = page.eval_on_selector_all(cfg.get("post_selector", "a[href]"), "els => els.map(a => ({href:a.href,title:(a.innerText||a.textContent||'').replace(/\\s+/g,' ').trim()}))")
            post_re = re.compile(cfg["post_re"])
            posts, seen = [], set()
            for link in links:
                found = post_re.search(link.get("href", ""))
                if not found:
                    continue
                post_id = next((group for group in found.groups() if group), found.group(0))
                if post_id in seen:
                    continue
                seen.add(post_id)
                posts.append({"platform": platform, "account_id": account.get("id", "") if account else "",
                              "post_id": post_id, "title": link.get("title", "")[:200], "url": link["href"],
                              "source": "browser_dom"})
                if len(posts) >= max(1, min(limit, 100)):
                    break
            return {"platform": platform, "state": _page_state(platform, text, page.url, bool(posts)),
                    "account": account, "posts": posts, "page_url": page.url, "page_text": text[:1200]}
        finally:
            context.close()


def login(platform: str, wait: int) -> dict:
    from playwright.sync_api import sync_playwright
    cfg = PLATFORMS[platform]
    with _profile_lock(platform), sync_playwright() as playwright:
        context = _launch(playwright, platform, True)
        page = context.pages[0] if context.pages else context.new_page()
        try:
            # 先访问首页建立 session，再导航到搜索页
            if platform in ("xiaohongshu", "douyin", "kuaishou", "wechat"):
                try:
                    _goto(page, cfg.get("home", ""))
                    page.wait_for_timeout(2000)
                except Exception:
                    pass
            login_url = cfg["search"].format(keyword=urllib.parse.quote("测试"))
            # 公众号用 type=1 搜索检测登录态
            if platform == "wechat":
                login_url = "https://weixin.sogou.com/weixin?type=1&query=测试"
            _goto(page, login_url)
            page.wait_for_timeout(1500)
            # 公众号需要点击登录按钮弹出微信扫码
            if platform == "wechat" and cfg.get("login_btn_text"):
                try:
                    page.evaluate(f"""() => {{
                        const btn = [...document.querySelectorAll('a, button')].find(b => 
                            (b.innerText||'').trim() === {repr(cfg['login_btn_text'])});
                        if (btn) btn.click();
                    }}""")
                    page.wait_for_timeout(2000)
                except Exception:
                    pass
            deadline = time.time() + max(30, min(wait, 600))
            while time.time() < deadline:
                text = _text(page)
                state = _page_state(platform, text, page.url, False)
                if state == "blocked":
                    return {"platform": platform, "state": "blocked", "page_url": page.url}
                if state != "login_required":
                    # 登录成功，等待 Cookie 写入磁盘
                    # 抖音等平台的登录态 Cookie 是 session 级别的，
                    # 需要等待浏览器将其持久化到 Profile
                    page.wait_for_timeout(3000)
                    # 访问首页确认登录态已生效
                    try:
                        _goto(page, cfg.get("home", ""))
                        page.wait_for_timeout(2000)
                        # 再次确认登录状态
                        text2 = _text(page)
                        state2 = _page_state(platform, text2, page.url, False)
                        if state2 == "login_required":
                            # 首页仍显示未登录，继续等待
                            page.wait_for_timeout(3000)
                    except Exception:
                        pass
                    return {"platform": platform, "state": "ready", "page_url": page.url}
                page.wait_for_timeout(1000)
            return {"platform": platform, "state": "login_required", "page_url": page.url}
        finally:
            context.close()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=["search", "profile", "login", "platforms"])
    parser.add_argument("--platform", choices=sorted(PLATFORMS))
    parser.add_argument("--keyword", default="")
    parser.add_argument("--url", default="")
    parser.add_argument("--limit", type=int, default=20)
    parser.add_argument("--headed", action="store_true")
    parser.add_argument("--wait", type=int, default=180)
    args = parser.parse_args()
    if args.action == "platforms":
        result = {"platforms": [{"key": key, "name": cfg["name"], "search_url": cfg["search"],
                                  "profile_pattern": cfg["profile_re"]} for key, cfg in PLATFORMS.items()]}
    elif not args.platform:
        parser.error("--platform is required")
    elif args.action == "search":
        if not args.keyword.strip():
            parser.error("--keyword is required")
        result = search(args.platform, args.keyword.strip(), args.limit, args.headed)
    elif args.action == "profile":
        if not args.url.startswith(("http://", "https://")):
            parser.error("--url is required")
        result = profile(args.platform, args.url, args.limit, args.headed)
    else:
        result = login(args.platform, args.wait)
    print(json.dumps(result, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as error:
        print(json.dumps({"state": "failed", "error": str(error)}, ensure_ascii=False))
        sys.exit(1)
