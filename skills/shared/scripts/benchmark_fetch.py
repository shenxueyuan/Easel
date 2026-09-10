#!/usr/bin/env python3
"""benchmark_fetch.py — 对标账号内容抓取引擎。

混合策略：
  - 公众号/知乎/微博：web_fetch 公开页面（相对宽松）
  - 小红书/B站/抖音：web_search 降级（反爬强，不直接 fetch）

输出到 outputs/_benchmarks/<persona>/<platform>_<account>/posts.json

子命令：
  fetch  抓取单个对标账号最新内容
  list   列出已抓取的账号
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[3]
BENCHMARKS_DIR = PROJECT_ROOT / "outputs" / "_benchmarks"

# 各平台抓取策略
PLATFORM_STRATEGIES: dict[str, dict] = {
    "wechat": {
        "name": "公众号",
        "method": "search",  # 公众号文章通过搜狗微信搜索
        "search_url": "https://weixin.sogou.com/weixin?type=2&query={query}",
        "fetch_url": "",  # 文章页可直接 fetch
    },
    "zhihu": {
        "name": "知乎",
        "method": "fetch",  # 知乎用户主页相对宽松
        "homepage": "https://www.zhihu.com/people/{account}/posts",
    },
    "weibo": {
        "name": "微博",
        "method": "fetch",
        "homepage": "https://weibo.com/u/{account}",
    },
    "bilibili": {
        "name": "B站",
        "method": "search",  # B站反爬强，不直接 fetch
        "search_url": "https://search.bilibili.com/all?keyword={query}",
    },
    "douyin": {
        "name": "抖音",
        "method": "search",
        "search_url": "https://www.douyin.com/search/{query}",
    },
    "xiaohongshu": {
        "name": "小红书",
        "method": "search",
        "search_url": "https://www.xiaohongshu.com/search_result?keyword={query}",
    },
    "toutiao": {
        "name": "头条",
        "method": "search",
        "search_url": "https://so.toutiao.com/search?keyword={query}",
    },
}

# 通用 HTTP 请求
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
}


def _http_get(url: str, timeout: int = 15) -> str:
    """HTTP GET 返回 HTML 文本。"""
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8", "replace")


def _http_get_json(url: str, timeout: int = 10) -> dict:
    req = urllib.request.Request(url, headers={**HEADERS, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8", "replace"))


def _proxy_env() -> dict:
    """读取代理环境变量。"""
    env = {}
    proxy = os.environ.get("EASEL_PROXY") or os.environ.get("HTTP_PROXY") or os.environ.get("HTTPS_PROXY")
    if proxy:
        env["HTTP_PROXY"] = proxy
        env["HTTPS_PROXY"] = proxy
    return env


def _extract_posts_from_html(html: str, platform: str, account: str) -> list[dict]:
    """从 HTML 中提取帖子列表（通用正则提取，各平台结构不同）。"""
    posts = []
    # 通用提取：找标题链接和文本
    # 公众号文章链接
    if platform == "wechat":
        for m in re.finditer(r'href="(https?://mp\.weixin\.qq\.com/s[^"]*)"[^>]*>([^<]{4,80})', html):
            url = m.group(1).replace("&", "&")
            title = m.group(2).strip()
            if title and url not in [p["url"] for p in posts]:
                posts.append({"title": title, "url": url, "hot": "", "snippet": ""})
    # 知乎文章
    elif platform == "zhihu":
        for m in re.finditer(r'href="/p/(\d+)"[^>]*>([^<]{4,80})', html):
            url = f"https://zhuanlan.zhihu.com/p/{m.group(1)}"
            title = m.group(2).strip()
            if title and url not in [p["url"] for p in posts]:
                posts.append({"title": title, "url": url, "hot": "", "snippet": ""})
        for m in re.finditer(r'href="/question/\d+/answer/\d+"[^>]*>([^<]{4,80})', html):
            url = f"https://www.zhihu.com{m.group(0).split('"')[1]}"
            title = m.group(1).strip()
            if title and url not in [p["url"] for p in posts]:
                posts.append({"title": title, "url": url, "hot": "", "snippet": ""})
    # 微博
    elif platform == "weibo":
        for m in re.finditer(r'<a[^>]*href="(/\d+/[^"]*)"[^>]*>([^<]{4,120})', html):
            url = f"https://weibo.com{m.group(1)}"
            title = m.group(2).strip()[:80]
            if title and url not in [p["url"] for p in posts]:
                posts.append({"title": title, "url": url, "hot": "", "snippet": ""})
    # 通用：提取所有带标题的链接
    if not posts:
        for m in re.finditer(r'<a[^>]*href="(https?://[^"]*)"[^>]*title="([^"]{4,80})"', html):
            url = m.group(1)
            title = m.group(2).strip()
            if title and url not in [p["url"] for p in posts] and len(title) > 4:
                posts.append({"title": title, "url": url, "hot": "", "snippet": ""})
    return posts[:20]


def _search_account(platform: str, account: str) -> list[dict]:
    """通过搜索引擎搜索账号相关内容（降级方案）。"""
    strategies = PLATFORM_STRATEGIES.get(platform)
    if not strategies or strategies["method"] != "search":
        return []
    query = urllib.parse.quote(f"{account} {strategies['name']}")
    # 用 60s API 的搜索能力或直接 fetch 搜索页
    search_url = strategies.get("search_url", "").format(query=query, account=account)
    if not search_url:
        return []
    try:
        html = _http_get(search_url)
        posts = _extract_posts_from_html(html, platform, account)
        if posts:
            return posts
    except Exception:
        pass
    # 降级：用 web_search API（如果有）
    try:
        search_api = f"https://60s.viki.moe/v2/search?q={query}"
        data = _http_get_json(search_api)
        items = data.get("data", [])
        if isinstance(items, list):
            return [{"title": it.get("title", ""), "url": it.get("url", ""),
                     "hot": str(it.get("hot", "")), "snippet": it.get("snippet", "")}
                    for it in items[:15] if it.get("title")]
    except Exception:
        pass
    return []


def _fetch_account_homepage(platform: str, account: str, url: str) -> list[dict]:
    """直接抓取账号主页。"""
    strategies = PLATFORM_STRATEGIES.get(platform)
    if not strategies or strategies["method"] != "fetch":
        return []
    homepage = url or strategies.get("homepage", "").format(account=account)
    if not homepage:
        return []
    try:
        html = _http_get(homepage)
        return _extract_posts_from_html(html, platform, account)
    except Exception:
        return []


def fetch_account(persona: str, platform: str, name: str, url: str = "") -> list[dict]:
    """抓取单个对标账号的最新内容。返回帖子列表。"""
    strategies = PLATFORM_STRATEGIES.get(platform)
    if not strategies:
        print(f"不支持的平台: {platform}", file=sys.stderr)
        return []

    # 按策略抓取
    if strategies["method"] == "fetch":
        posts = _fetch_account_homepage(platform, name, url)
        if not posts:
            # 降级为搜索
            posts = _search_account(platform, name)
    else:
        posts = _search_account(platform, name)

    # 保存
    account_dir = BENCHMARKS_DIR / persona / f"{platform}_{name}"
    account_dir.mkdir(parents=True, exist_ok=True)
    (account_dir / "posts.json").write_text(
        json.dumps(posts, ensure_ascii=False, indent=2), encoding="utf-8")
    (account_dir / "meta.json").write_text(
        json.dumps({"platform": platform, "name": name, "url": url,
                     "fetched_at": int(time.time())}, ensure_ascii=False, indent=2),
        encoding="utf-8")
    return posts


def cmd_fetch(args) -> int:
    posts = fetch_account(args.persona, args.platform, args.name, args.url)
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
    parser = argparse.ArgumentParser(description="对标账号内容抓取")
    sub = parser.add_subparsers(dest="cmd")

    p_fetch = sub.add_parser("fetch", help="抓取单个对标账号")
    p_fetch.add_argument("--persona", required=True)
    p_fetch.add_argument("--platform", required=True)
    p_fetch.add_argument("--name", required=True)
    p_fetch.add_argument("--url", default="")
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
