export interface PoolAccount {
  platform: string;
  name: string;
  rss_url: string;
  category: string;
  tags: string[];
}

export const BENCHMARK_POOL: PoolAccount[] = [
  {
    platform: 'xiaohongshu',
    name: 'AI时间炼金师MetaX',
    rss_url: '/xiaohongshu/user/59f87643db2e602e550c9714/notes',
    category: 'AI',
    tags: ['AI', '小红书'],
  },
  {
    platform: 'bilibili',
    name: '影视飓风',
    rss_url: '/bilibili/user/dynamic/946974',
    category: '科技视频',
    tags: ['视频', 'B站', '科技'],
  },
  {
    platform: 'weibo',
    name: '36氪',
    rss_url: '/weibo/user/1750070171',
    category: '科技资讯',
    tags: ['创业', '科技', '资讯'],
  },
  {
    platform: 'zhihu',
    name: '王晋东',
    rss_url: '/zhihu/people/activities/jindongwang',
    category: 'AI',
    tags: ['AI', '学术', '知乎'],
  },
  {
    platform: 'douyin',
    name: '杜雨说AI',
    rss_url: '/douyin/user/MS4wLjABAAAALpAaN8biUOl9Z3VYzcKltEFdgvK5I2AeVD5bO8NC8IlysGEvUNZnw6A20jjuEpLd',
    category: 'AI',
    tags: ['AI', '短视频'],
  },
  {
    platform: 'toutiao',
    name: '赛文乔伊',
    rss_url: '/toutiao/user/token/MS4wLjABAAAA5z7a0VRwQxKYGNNShtjTD8vgAPVEC-lUzy294vSdAuw',
    category: '科技',
    tags: ['科技', '资讯'],
  },
  {
    platform: '36kr',
    name: '36氪快讯',
    rss_url: '/36kr/newsflashes',
    category: '创投资讯',
    tags: ['新闻', '创投'],
  },
  {
    platform: 'wechat',
    name: '机器之心',
    rss_url: 'https://wechat2rss.xlab.app/feed/51e92aad2728acdd1fda7314be32b16639353001.xml',
    category: 'AI',
    tags: ['AI', '公众号'],
  },
  {
    platform: 'custom',
    name: 'GitHub Blog',
    rss_url: 'https://github.blog/feed/',
    category: '开发者',
    tags: ['开源', 'GitHub'],
  },
  {
    platform: 'weibo',
    name: '雷军',
    rss_url: '/weibo/user/1892653244',
    category: '人物',
    tags: ['企业家', '小米'],
  },
  {
    platform: 'bilibili',
    name: '极客湾Geekerwan',
    rss_url: '/bilibili/user/dynamic/337312411',
    category: '数码评测',
    tags: ['评测', '数码', 'B站'],
  },
  {
    platform: 'xiaohongshu',
    name: '半佛仙人',
    rss_url: '/xiaohongshu/user/5c0b3e3b000000001001c6b5/notes',
    category: '商业观点',
    tags: ['商业', '观点', '小红书'],
  },
];
