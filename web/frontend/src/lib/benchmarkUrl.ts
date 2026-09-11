export interface ParsedProfile {
  platform: string;
  name: string;
  rss_url: string;
}

interface PlatformPattern {
  platform: string;
  regex: RegExp;
  route: (id: string) => string;
  label: (id: string) => string;
}

const PATTERNS: PlatformPattern[] = [
  {
    platform: 'xiaohongshu',
    regex: /(?:xiaohongshu\.com|xhslink\.com)\/user\/profile\/([^/?#]+)/,
    route: (id) => `/xiaohongshu/user/${id}/notes`,
    label: (id) => `小红书 ${id.slice(0, 8)}`,
  },
  {
    platform: 'bilibili',
    regex: /space\.bilibili\.com\/(\d+)/,
    route: (id) => `/bilibili/user/dynamic/${id}`,
    label: (id) => `UP ${id}`,
  },
  {
    platform: 'bilibili',
    regex: /m\.bilibili\.com\/space\/(\d+)/,
    route: (id) => `/bilibili/user/dynamic/${id}`,
    label: (id) => `UP ${id}`,
  },
  {
    platform: 'weibo',
    regex: /(?:weibo\.com\/u\/|m\.weibo\.cn\/u\/)([0-9a-zA-Z_]+)/,
    route: (id) => `/weibo/user/${id}`,
    label: (id) => `微博 ${id}`,
  },
  {
    platform: 'zhihu',
    regex: /zhihu\.com\/people\/([^/?#]+)/,
    route: (id) => `/zhihu/people/activities/${id}`,
    label: (id) => `知乎 ${id}`,
  },
  {
    platform: 'douyin',
    regex: /douyin\.com\/user\/([A-Za-z0-9_-]+)/,
    route: (id) => `/douyin/user/${id}`,
    label: (id) => `抖音 ${id.slice(0, 12)}`,
  },
  {
    platform: 'toutiao',
    regex: /toutiao\.com\/c\/user\/token\/([^/?#]+)/,
    route: (id) => `/toutiao/user/token/${id}`,
    label: (id) => `头条 ${id.slice(0, 12)}`,
  },
];

export function parseProfileUrl(url: string): ParsedProfile | null {
  for (const p of PATTERNS) {
    const match = url.match(p.regex);
    if (match?.[1]) {
      const id = decodeURIComponent(match[1]);
      return {
        platform: p.platform,
        name: p.label(id),
        rss_url: p.route(id),
      };
    }
  }
  return null;
}
