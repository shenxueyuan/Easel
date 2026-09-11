#!/usr/bin/env python3
"""benchmark_fetch.py — 对标账号内容抓取引擎（RSSHub 统一方案）。

优先通过 RSSHub 或标准 RSS 获取内容；当平台账号路由受反爬影响时，
使用 Playwright 读取公开账号页，确保手动刷新仍能获得可见内容。

RSSHub 路由示例：
  公众号    /wechat/mp/:id              （需 NEWRANK_COOKIE 或 feeddd id）
  微博      /weibo/user/:uid
  知乎      /zhihu/people/activities/:id
  B站       /bilibili/user/dynamic/:uid
  抖音      /douyin/user/:uid
  小红书    /xiaohongshu/user/:user_id/notes
  头条      /toutiao/user/token/:id
  36氪      /36kr/newsflashes
  虎嗅      /huxiu/article
  任意 RSS  直接填完整 URL

输出到 outputs/_benchmarks/<persona>/<platform>_<account>/posts.json

子命令：
  fetch  抓取单个对标账号最新内容（通过 RSS）
  list   列出已抓取的账号
"""
from __future__ import annotations

import argparse
import json
import os
import re
import ssl
import sys
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[3]
BENCHMARKS_DIR = PROJECT_ROOT / "outputs" / "_benchmarks"

# 默认 RSSHub 实例（用户可在配置中覆盖）
DEFAULT_RSSHUB = os.environ.get("RSSHUB_URL", "http://localhost:1200")

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/rss+xml, application/xml, text/xml, application/atom+xml, */*",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
}


def _http_get(url: str, timeout: int = 20) -> str:
    """HTTP GET 返回文本。对 HTTPS 放宽证书校验（抓取公开 RSS）。"""
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=timeout, context=ctx) as r:
        return r.read().decode("utf-8", "replace")


def _http_get_page(url: str, timeout: int = 25) -> str:
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    headers = {**HEADERS, "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"}
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=timeout, context=ctx) as response:
        return response.read().decode("utf-8", "replace")


def _resolve_url(rss_url: str, rsshub_base: str) -> str:
    """解析 RSS URL：
    - 以 http 开头 → 直接用
    - 以 / 开头 → 拼接 RSSHub 实例地址
    - 其他 → 当作 RSSHub 完整路由拼接
    """
    if rss_url.startswith("http://") or rss_url.startswith("https://"):
        return rss_url
    base = rsshub_base.rstrip("/")
    if rss_url.startswith("/"):
        return base + rss_url
    return base + "/" + rss_url


def _strip_html(html: str) -> str:
    """简单去 HTML 标签，保留纯文本摘要。"""
    text = re.sub(r"<[^>]+>", "", html)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:300]


def parse_rss(xml_text: str, platform: str, account: str) -> list[dict]:
    """解析 RSS/Atom XML，返回标准化帖子列表。

    每条帖子字段：
      title, url, summary, content, published_at, source, confidence
    """
    posts: list[dict] = []
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError as e:
        print(f"RSS 解析失败: {e}", file=sys.stderr)
        return []

    # RSS 2.0: <rss><channel><item>
    # Atom: <feed><entry>
    ns = {
        "content": "http://purl.org/rss/1.0/modules/content/",
        "atom": "http://www.w3.org/2005/Atom",
        "dc": "http://purl.org/dc/elements/1.1/",
        "media": "http://search.yahoo.com/mrss/",
    }

    # 尝试 RSS 2.0
    items = root.findall(".//item")
    if not items:
        # 尝试 Atom
        items = root.findall(".//atom:entry", ns)

    for item in items:
        def _text(tag: str, default: str = "") -> str:
            el = item.find(tag)
            return el.text.strip() if el is not None and el.text else default

        def _text_ns(tag: str, ns_uri: str, default: str = "") -> str:
            el = item.find(tag, {"": ns_uri})
            return el.text.strip() if el is not None and el.text else default

        title = _text("title") or _text_ns("title", ns["atom"])
        link = _text("link")
        if not link:
            link_el = item.find("link")
            if link_el is not None:
                link = link_el.get("href", "") or link_el.text or ""
        # Atom link
        if not link:
            link_el = item.find("atom:link", ns)
            if link_el is not None:
                link = link_el.get("href", "")

        desc = _text("description")
        content = _text_ns("encoded", ns["content"]) or desc
        summary = _strip_html(desc) if desc else ""

        pub = _text("pubDate") or _text_ns("published", ns["atom"]) or _text_ns("date", ns["dc"])
        # 解析时间戳
        published_at = ""
        if pub:
            try:
                from email.utils import parsedate_to_datetime
                published_at = str(int(parsedate_to_datetime(pub).timestamp()))
            except Exception:
                try:
                    published_at = str(int(time.mktime(time.strptime(pub[:25], "%a, %d %b %Y %H:%M:%S"))))
                except Exception:
                    published_at = pub

        if title:
            posts.append({
                "title": title,
                "url": link,
                "summary": summary,
                "content": content[:5000] if content else "",
                "published_at": published_at,
                "hot": "",
                "snippet": summary[:120],
                "source": f"RSS: {platform}/{account}",
                "confidence": "high",
            })
    return posts[:30]


def _fetch_folo_cache(platform: str, account: str, rss_url: str) -> list[dict]:
    if platform not in {"xiaohongshu", "bilibili"} or not rss_url.startswith("/"):
        return []
    feed_url = "rsshub://" + rss_url.lstrip("/")
    endpoint = "https://api.folo.is/feeds?" + urllib.parse.urlencode({"url": feed_url})
    try:
        payload = json.loads(_http_get(endpoint, timeout=35))
    except Exception as error:
        print(f"Folo 缓存读取失败: {error}", file=sys.stderr)
        return []
    posts = []
    for entry in payload.get("data", {}).get("entries", []):
        title = (entry.get("title") or "").strip()
        if not title:
            continue
        content = entry.get("content") or entry.get("description") or entry.get("summary") or title
        published = entry.get("publishedAt") or ""
        posts.append({
            "title": title,
            "url": entry.get("url") or "",
            "summary": _strip_html(entry.get("description") or entry.get("summary") or ""),
            "content": content[:5000],
            "published_at": published,
            "hot": "",
            "snippet": _strip_html(entry.get("description") or "")[:120],
            "source": f"Folo 缓存: {platform}/{account}",
            "confidence": "medium",
        })
    return posts[:30]


NATIVE_SOURCES = {
    "weibo": (r"/weibo/user/([^/?]+)", "https://m.weibo.cn/u/{id}", 'a[href*="/status/"]'),
    "zhihu": (r"/zhihu/people/(?:activities/)?([^/?]+)", "https://www.zhihu.com/people/{id}", 'a[href*="/p/"], a[href*="/question/"]'),
    "bilibili": (r"/bilibili/user/(?:dynamic|video)/([^/?]+)", "https://space.bilibili.com/{id}/upload/video", 'a[href*="/video/"]'),
    "douyin": (r"/douyin/user/([^/?]+)", "https://www.douyin.com/user/{id}", 'a[href*="/video/"]'),
    "xiaohongshu": (r"/xiaohongshu/user/([^/?]+)", "https://www.xiaohongshu.com/user/profile/{id}", 'a[href*="/explore/"]'),
    "toutiao": (r"/toutiao/user/(?:token/)?([^/?]+)", "https://www.toutiao.com/c/user/token/{id}/", 'a[href*="/article/"], a[href*="/video/"]'),
}


class _PublicLinkParser(HTMLParser):
    def __init__(self, path_marker: str):
        super().__init__()
        self.path_marker = path_marker
        self.links: list[dict] = []
        self.current: dict | None = None
        self.depth = 0
        self.ignored = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in {"script", "style"}:
            self.ignored += 1
        if self.ignored:
            return
        values = dict(attrs)
        href = values.get("href") or ""
        if tag == "a" and self.path_marker in href and self.current is None:
            self.current = {"url": urllib.parse.urljoin("https://www.xiaohongshu.com", href), "text": []}
            self.depth = 1
        elif self.current:
            self.depth += 1

    def handle_endtag(self, tag: str) -> None:
        if tag in {"script", "style"} and self.ignored:
            self.ignored -= 1
            return
        if not self.current:
            return
        self.depth -= 1
        if self.depth == 0:
            text = re.sub(r"\s+", " ", " ".join(self.current["text"])).strip()
            if text:
                self.links.append({"title": text, "text": text, "url": self.current["url"]})
            self.current = None

    def handle_data(self, data: str) -> None:
        if self.current and not self.ignored:
            self.current["text"].append(data)


def _fetch_xiaohongshu_html(page_url: str) -> list[dict]:
    try:
        html = _http_get_page(page_url, timeout=25)
        state_match = re.search(r"window\.__INITIAL_STATE__\s*=\s*(\{.*?\})\s*</script>", html, re.S)
        if state_match:
            state = json.loads(re.sub(r"\bundefined\b", "null", state_match.group(1)))
            items = []

            def collect(value) -> None:
                if isinstance(value, dict):
                    note_id = value.get("noteId") or value.get("note_id")
                    title = value.get("displayTitle") or value.get("title")
                    if note_id and title:
                        items.append({
                            "title": str(title),
                            "text": str(value.get("desc") or title),
                            "url": f"https://www.xiaohongshu.com/explore/{note_id}",
                        })
                    for child in value.values():
                        collect(child)
                elif isinstance(value, list):
                    for child in value:
                        collect(child)

            collect(state)
            if items:
                return items
        parser = _PublicLinkParser("xsec_source=pc_user")
        parser.feed(html)
        return parser.links
    except Exception as error:
        print(f"小红书公开页解析失败: {error}", file=sys.stderr)
        return []


def _fetch_public_page(platform: str, account: str, rss_url: str) -> list[dict]:
    source = NATIVE_SOURCES.get(platform)
    if not source:
        return []
    pattern, homepage, selector = source
    match = re.search(pattern, rss_url)
    if not match:
        return []
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("Playwright 未安装，跳过公开页降级", file=sys.stderr)
        return []

    page_url = homepage.format(id=match.group(1))
    print(f"降级抓取公开页: {page_url}", file=sys.stderr)
    try:
        if platform == "xiaohongshu":
            raw_items = _fetch_xiaohongshu_html(page_url)
        else:
            api_items: list[dict] = []
            with sync_playwright() as playwright:
                browser = playwright.chromium.launch(headless=True)
                page = browser.new_page(user_agent=HEADERS["User-Agent"], locale="zh-CN")

                def capture_response(response) -> None:
                    if (platform != "douyin" or "/aweme/post/" not in response.url
                            or match.group(1) not in response.url):
                        return
                    try:
                        payload = response.json()
                        for aweme in payload.get("aweme_list", []):
                            author = aweme.get("author", {}).get("nickname", "")
                            if author and account.lower() not in author.lower() and author.lower() not in account.lower():
                                continue
                            description = aweme.get("desc", "").strip()
                            aweme_id = aweme.get("aweme_id", "")
                            if description and aweme_id:
                                api_items.append({
                                    "title": description,
                                    "text": description,
                                    "url": f"https://www.douyin.com/video/{aweme_id}",
                                    "published_at": str(aweme.get("create_time", "")),
                                })
                    except Exception:
                        pass

                page.on("response", capture_response)
                page.goto(page_url, wait_until="domcontentloaded", timeout=45_000)
                page.wait_for_timeout(7_000)
                raw_items = api_items if platform == "douyin" else page.locator(selector).evaluate_all("""
                    (links) => links.slice(0, 80).map((link) => {
                        const wrapper = link.closest('article, section, li, [class*=card], [class*=item]') || link.parentElement;
                        const text = (wrapper?.innerText || link.innerText || '').replace(/\\s+/g, ' ').trim();
                        const title = link.getAttribute('title') || link.getAttribute('aria-label') || link.innerText?.trim() || text;
                        return { title, url: link.href, text };
                    })
                """)
                browser.close()
    except Exception as error:
        print(f"公开页抓取失败: {error}", file=sys.stderr)
        return []

    posts = []
    seen = set()
    for item in raw_items:
        url = item.get("url", "").split("?")[0]
        title = re.sub(r"\s+", " ", item.get("title", "")).strip()
        text = re.sub(r"\s+", " ", item.get("text", "")).strip()
        if len(title) < 4 or len(title) > 180:
            title = text[:180]
        dedupe_key = title if platform == "xiaohongshu" else url
        if not title or len(title) < 4 or dedupe_key in seen:
            continue
        seen.add(dedupe_key)
        summary = text if text != title and len(text) >= 20 else ""
        posts.append({
            "title": title[:180],
            "url": url,
            "summary": summary[:600],
            "content": summary[:5000] or title[:180],
            "published_at": item.get("published_at") or str(int(time.time())),
            "hot": "",
            "snippet": summary[:120],
            "source": f"公开页: {platform}/{account}",
            "confidence": "medium",
        })
    return posts[:30]


def fetch_account(persona: str, platform: str, name: str, rss_url: str,
                   rsshub_base: str = DEFAULT_RSSHUB) -> list[dict]:
    """通过 RSS feed 抓取单个对标账号的最新内容。"""
    if not rss_url:
        print(f"未配置 RSS 源: {platform}/{name}", file=sys.stderr)
        return []

    url = _resolve_url(rss_url, rsshub_base)
    print(f"抓取 RSS: {url}", file=sys.stderr)

    error = ""
    try:
        xml_text = _http_get(url, timeout=45)
        posts = parse_rss(xml_text, platform, name)
    except Exception as exc:
        error = str(exc)
        print(f"RSS 请求失败: {exc}", file=sys.stderr)
        posts = []

    source_type = "rss"
    if not posts:
        posts = _fetch_folo_cache(platform, name, rss_url)
        source_type = "folo_cache" if posts else "failed"
    if not posts:
        posts = _fetch_public_page(platform, name, rss_url)
        source_type = "public_page" if posts else "failed"

    # 保存
    account_dir = BENCHMARKS_DIR / persona / f"{platform}_{name}"
    account_dir.mkdir(parents=True, exist_ok=True)
    posts_file = account_dir / "posts.json"
    if not posts and posts_file.is_file():
        try:
            posts = json.loads(posts_file.read_text(encoding="utf-8"))
            if posts:
                source_type = "stale_cache"
        except Exception:
            pass
    (account_dir / "posts.json").write_text(
        json.dumps(posts, ensure_ascii=False, indent=2), encoding="utf-8")
    meta = {"platform": platform, "name": name, "rss_url": rss_url,
            "resolved_url": url, "fetched_at": int(time.time()), "source_type": source_type}
    if error and not posts:
        meta["error"] = error
    (account_dir / "meta.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    return posts


def cmd_fetch(args) -> int:
    posts = fetch_account(args.persona, args.platform, args.name, args.rss_url, args.rsshub)
    print(json.dumps({"account": args.name, "platform": args.platform,
                       "posts_count": len(posts)}, ensure_ascii=False))
    return 0


def cmd_list(args) -> int:
    bd = BENCHMARKS_DIR / args.persona
    if not bd.is_dir():
        print(json.dumps({"accounts": []}, ensure_ascii=False))
        return 0
    accounts = []
    for d in sorted(bd.iterdir()):
        if not d.is_dir() or d.name.startswith('_'):
            continue
        meta_file = d / "meta.json"
        if meta_file.is_file():
            try:
                accounts.append(json.loads(meta_file.read_text(encoding="utf-8")))
            except Exception:
                pass
    print(json.dumps({"accounts": accounts}, ensure_ascii=False, indent=2))
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="对标账号 RSS 抓取")
    sub = parser.add_subparsers(dest="cmd")

    p_fetch = sub.add_parser("fetch", help="抓取单个对标账号（通过 RSS）")
    p_fetch.add_argument("--persona", required=True)
    p_fetch.add_argument("--platform", required=True)
    p_fetch.add_argument("--name", required=True)
    p_fetch.add_argument("--rss-url", required=True, help="RSS 源 URL 或 RSSHub 路由")
    p_fetch.add_argument("--rsshub", default=DEFAULT_RSSHUB, help="RSSHub 实例地址")
    p_fetch.set_defaults(func=cmd_fetch)

    p_list = sub.add_parser("list", help="列出已抓取账号")
    p_list.add_argument("--persona", required=True)
    p_list.set_defaults(func=cmd_list)

    args = parser.parse_args()
    if not args.cmd:
        parser.print_help()
        return 1
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
