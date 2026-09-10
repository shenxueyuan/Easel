#!/usr/bin/env python3
"""benchmark_fetch.py — 对标账号内容抓取引擎（RSSHub 统一方案）。

所有平台通过 RSSHub 生成 RSS feed，本脚本只负责解析 RSS。
不再做平台特定的 HTML 抓取/搜索降级——那些逻辑不稳定且维护成本高。

RSSHub 路由示例：
  公众号    /wechat/mp/:id              （需 NEWRANK_COOKIE 或 feeddd id）
  微博      /weibo/user/:uid
  知乎      /zhihu/people/activities/:id
  B站       /bilibili/user/dynamic/:uid
  抖音      /douyin/user/:uid
  小红书    /xiaohongshu/user/:user_id/notes
  头条      /toutiao/user/:id
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


def fetch_account(persona: str, platform: str, name: str, rss_url: str,
                   rsshub_base: str = DEFAULT_RSSHUB) -> list[dict]:
    """通过 RSS feed 抓取单个对标账号的最新内容。"""
    if not rss_url:
        print(f"未配置 RSS 源: {platform}/{name}", file=sys.stderr)
        return []

    url = _resolve_url(rss_url, rsshub_base)
    print(f"抓取 RSS: {url}", file=sys.stderr)

    try:
        xml_text = _http_get(url, timeout=25)
    except Exception as e:
        print(f"RSS 请求失败: {e}", file=sys.stderr)
        # 保存空结果但记录错误
        account_dir = BENCHMARKS_DIR / persona / f"{platform}_{name}"
        account_dir.mkdir(parents=True, exist_ok=True)
        (account_dir / "posts.json").write_text("[]", encoding="utf-8")
        (account_dir / "meta.json").write_text(
            json.dumps({"platform": platform, "name": name, "rss_url": rss_url,
                        "resolved_url": url, "fetched_at": int(time.time()),
                        "error": str(e)}, ensure_ascii=False, indent=2),
            encoding="utf-8")
        return []

    posts = parse_rss(xml_text, platform, name)

    # 保存
    account_dir = BENCHMARKS_DIR / persona / f"{platform}_{name}"
    account_dir.mkdir(parents=True, exist_ok=True)
    (account_dir / "posts.json").write_text(
        json.dumps(posts, ensure_ascii=False, indent=2), encoding="utf-8")
    (account_dir / "meta.json").write_text(
        json.dumps({"platform": platform, "name": name, "rss_url": rss_url,
                     "resolved_url": url, "fetched_at": int(time.time())},
                    ensure_ascii=False, indent=2),
        encoding="utf-8")
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
