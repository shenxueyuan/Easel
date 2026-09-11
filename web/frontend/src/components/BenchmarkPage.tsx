import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  fetchBenchmarks, saveBenchmarks, fetchRsshubConfig, saveRsshubConfig,
  refreshBenchmarks, fetchBenchmarkPosts, fetchBenchmarkStatus, createIdea,
} from '../lib/api';
import type { BenchmarkAccount, BenchmarkGroup, BenchmarkPost } from '../lib/api';
import type { Page } from './Sidebar';
import { renderMarkdown } from '../lib/sanitize';
import {
  IconTarget, IconPlus, IconTrash, IconRefresh, IconCheck, IconBookmark,
  IconEdit, IconChevron,
} from './icons';
import { BENCHMARK_POOL, type PoolAccount } from '../lib/benchmarkPool';
import { parseProfileUrl } from '../lib/benchmarkUrl';

interface BenchmarkPageProps {
  persona: string;
  onNavigate: (page: Page) => void;
  onBreakdown: (content: string) => void;
  onUseTopic: (title: string, sourceContext?: string) => void;
}

interface FeedPost {
  group: BenchmarkGroup;
  post: BenchmarkPost;
  key: string;
}

// 平台 + RSSHub 路由模板
const PLATFORM_TEMPLATES: { key: string; label: string; route: string; placeholder: string; example: string }[] = [
  { key: 'wechat', label: '公众号', route: '/wechat/mp/{id}', placeholder: '公众号 __biz 或 newrank id', example: 'MzI3MjQ4NzU2NA==' },
  { key: 'weibo', label: '微博', route: '/weibo/user/{uid}', placeholder: '微博用户 uid', example: '1195230310' },
  { key: 'zhihu', label: '知乎', route: '/zhihu/people/activities/{id}', placeholder: '知乎用户 id', example: 'di-ling-83' },
  { key: 'bilibili', label: 'B站', route: '/bilibili/user/dynamic/{uid}', placeholder: 'B站 UP 主 uid', example: '2267573' },
  { key: 'douyin', label: '抖音', route: '/douyin/user/{uid}', placeholder: '抖音用户 uid', example: 'MS4wLjABAAAA...' },
  { key: 'xiaohongshu', label: '小红书', route: '/xiaohongshu/user/{user_id}/notes', placeholder: '小红书 24 位 user_id', example: '593032945e87e77791e03696' },
  { key: 'toutiao', label: '头条', route: '/toutiao/user/token/{id}', placeholder: '头条用户 token', example: 'MS4wLjABAAAA...' },
  { key: '36kr', label: '36氪', route: '/36kr/newsflashes', placeholder: 'RSSHub 路由', example: '/36kr/newsflashes' },
  { key: 'custom', label: '自定义', route: '', placeholder: '完整 RSS URL', example: 'https://blog.example.com/rss.xml' },
];

const PLATFORM_LABELS: Record<string, string> = Object.fromEntries(
  PLATFORM_TEMPLATES.map((platform) => [platform.key, platform.label])
);

function platformLabel(platform: string): string {
  return PLATFORM_LABELS[platform] || platform;
}

function platformMark(platform: string): string {
  return platformLabel(platform).slice(0, 1).toUpperCase();
}

function formatPublished(value?: string): string {
  if (!value) return '时间未知';
  const numeric = Number(value);
  const date = Number.isFinite(numeric) && numeric > 0
    ? new Date(numeric * 1000)
    : new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', {
    month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function articleContent(post: BenchmarkPost): string {
  return post.content || post.summary || post.snippet || post.title;
}

export default function BenchmarkPage({ persona, onNavigate, onBreakdown, onUseTopic }: BenchmarkPageProps) {
  const [accounts, setAccounts] = useState<BenchmarkAccount[]>([]);
  const [keywords, setKeywords] = useState('');
  const [rsshubUrl, setRsshubUrl] = useState('http://localhost:1200');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [groups, setGroups] = useState<BenchmarkGroup[]>([]);
  const [lastFetch, setLastFetch] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState('');
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [view, setView] = useState<'feed' | 'settings'>('feed');
  const [selectedPlatform, setSelectedPlatform] = useState('all');
  const [selectedAccount, setSelectedAccount] = useState('');
  const [selectedPostKey, setSelectedPostKey] = useState('');
  const [poolQuery, setPoolQuery] = useState('');
  const [poolPlatform, setPoolPlatform] = useState('all');

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2500);
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchRsshubConfig().then((data) => setRsshubUrl(data.rsshub_url || 'http://localhost:1200')).catch(() => {}),
      persona ? fetchBenchmarks(persona).then((data) => {
        setAccounts(data.accounts || []);
        setKeywords(data.keywords || '');
      }).catch(() => {}) : Promise.resolve(),
    ]).finally(() => setLoading(false));
  }, [persona]);

  const loadPosts = useCallback(() => {
    if (!persona) {
      setGroups([]);
      return;
    }
    fetchBenchmarkPosts(persona)
      .then((data) => {
        setGroups(data.groups);
        setLastFetch(data.last_fetch);
      })
      .catch(() => {});
  }, [persona]);

  useEffect(() => { loadPosts(); }, [loadPosts]);

  const platforms = useMemo(() => {
    const keys = Array.from(new Set([
      ...accounts.map((account) => account.platform),
      ...groups.map((group) => group.platform),
    ])).filter(Boolean);
    return keys.map((key) => ({
      key,
      label: platformLabel(key),
      count: groups.filter((group) => group.platform === key).reduce((sum, group) => sum + group.posts.length, 0),
    }));
  }, [accounts, groups]);

  const visibleGroups = useMemo(() => groups.filter((group) => {
    if (selectedAccount) return `${group.platform}:${group.account}` === selectedAccount;
    return selectedPlatform === 'all' || group.platform === selectedPlatform;
  }), [groups, selectedAccount, selectedPlatform]);

  const feedPosts = useMemo<FeedPost[]>(() => visibleGroups.flatMap((group) => group.posts.map((post, index) => ({
    group,
    post,
    key: `${group.platform}:${group.account}:${post.url || post.title}:${index}`,
  }))), [visibleGroups]);

  const selectedFeedPost = feedPosts.find((item) => item.key === selectedPostKey) || feedPosts[0];

  const filteredPool = useMemo(() => {
    const q = poolQuery.trim().toLowerCase();
    return BENCHMARK_POOL.filter((item) => {
      if (poolPlatform !== 'all' && item.platform !== poolPlatform) return false;
      if (!q) return true;
      const text = `${item.name} ${item.category} ${item.tags.join(' ')} ${item.platform}`.toLowerCase();
      return text.includes(q);
    });
  }, [poolQuery, poolPlatform]);

  useEffect(() => {
    if (feedPosts.length && !feedPosts.some((item) => item.key === selectedPostKey)) {
      setSelectedPostKey(feedPosts[0].key);
    }
    if (!feedPosts.length) setSelectedPostKey('');
  }, [feedPosts, selectedPostKey]);

  const selectPlatform = (platform: string) => {
    setSelectedPlatform(platform);
    setSelectedAccount('');
  };

  const selectAccount = (group: BenchmarkGroup) => {
    setSelectedPlatform(group.platform);
    setSelectedAccount(`${group.platform}:${group.account}`);
  };

  const addAccount = () => {
    setAccounts((current) => [...current, { platform: 'weibo', name: '', rss_url: '' }]);
  };

  const addFromPool = (item: PoolAccount) => {
    setAccounts((current) => [...current, { platform: item.platform, name: item.name, rss_url: item.rss_url }]);
    showToast(`已添加 ${item.name}`);
  };

  const loadExamples = () => {
    setAccounts([
      { platform: 'wechat', name: '机器之心', rss_url: 'https://wechat2rss.xlab.app/feed/51e92aad2728acdd1fda7314be32b16639353001.xml' },
      { platform: 'weibo', name: '36氪', rss_url: 'https://rsshub.pseudoyu.com/weibo/user/1750070171' },
      { platform: 'zhihu', name: '王晋东', rss_url: 'https://rsshub.top/zhihu/people/activities/jindongwang' },
      { platform: 'bilibili', name: '影视飓风', rss_url: 'https://rss.peachyjoy.top/bilibili/user/video/946974' },
      { platform: 'xiaohongshu', name: 'AI时间炼金师MetaX', rss_url: '/xiaohongshu/user/59f87643db2e602e550c9714/notes' },
      { platform: 'douyin', name: '杜雨说AI', rss_url: '/douyin/user/MS4wLjABAAAALpAaN8biUOl9Z3VYzcKltEFdgvK5I2AeVD5bO8NC8IlysGEvUNZnw6A20jjuEpLd' },
      { platform: 'toutiao', name: '赛文乔伊', rss_url: '/toutiao/user/token/MS4wLjABAAAA5z7a0VRwQxKYGNNShtjTD8vgAPVEC-lUzy294vSdAuw' },
      { platform: '36kr', name: '36氪快讯', rss_url: 'https://rsshub.pseudoyu.com/36kr/newsflashes' },
      { platform: 'custom', name: 'GitHub Blog', rss_url: 'https://github.blog/feed/' },
    ]);
    setKeywords('AI, 大模型, LLM, 开源, Hugging Face');
  };

  const removeAccount = (index: number) => {
    setAccounts((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const updateAccount = (index: number, field: keyof BenchmarkAccount, value: string) => {
    setAccounts((current) => current.map((account, itemIndex) => {
      if (itemIndex !== index) return account;
      if (field === 'rss_url' && value.startsWith('http')) {
        const parsed = parseProfileUrl(value);
        if (parsed) {
          return { ...account, platform: parsed.platform, name: account.name || parsed.name, rss_url: parsed.rss_url };
        }
      }
      return { ...account, [field]: value };
    }));
  };

  const onPlatformChange = (index: number, platform: string) => {
    const template = PLATFORM_TEMPLATES.find((item) => item.key === platform);
    setAccounts((current) => current.map((account, itemIndex) => itemIndex === index
      ? { ...account, platform, rss_url: template?.route || '' }
      : account));
  };

  const handleSave = async () => {
    if (!persona) {
      showToast('请先选择画像');
      return;
    }
    setSaving(true);
    try {
      await saveRsshubConfig(rsshubUrl);
      await saveBenchmarks(persona, accounts.filter((account) => account.name.trim() && account.rss_url.trim()), keywords);
      showToast('对标配置已保存');
      setView('feed');
    } catch (error) {
      showToast(error instanceof Error ? error.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleRefresh = async () => {
    if (!persona) {
      showToast('请先选择画像');
      return;
    }
    if (!accounts.some((account) => account.name.trim() && account.rss_url.trim())) {
      showToast('请先添加对标账号');
      setView('settings');
      return;
    }
    setRefreshing(true);
    setRefreshError('');
    try {
      await refreshBenchmarks(persona);
      const poll = async () => {
        try {
          const status = await fetchBenchmarkStatus(persona);
          if (['done', 'failed', 'unknown'].includes(status.state)) {
            setRefreshing(false);
            loadPosts();
            if (status.state === 'failed') setRefreshError(status.log);
            return;
          }
        } catch { /* ignore */ }
        window.setTimeout(poll, 3000);
      };
      window.setTimeout(poll, 3000);
    } catch (error) {
      setRefreshing(false);
      setRefreshError(error instanceof Error ? error.message : '刷新失败');
    }
  };

  const savePost = async (item: FeedPost) => {
    if (saved.has(item.key)) return;
    try {
      await createIdea({ title: item.post.title, source: `对标:${item.group.account}`, status: 'pending' });
      setSaved((current) => new Set(current).add(item.key));
      showToast('已收藏到选题库');
    } catch (error) {
      showToast(error instanceof Error ? error.message : '收藏失败');
    }
  };

  if (!persona) {
    return (
      <div className="page-scroll">
        <h1 className="page-title"><IconTarget size={22} /> 对标账号</h1>
        <div className="empty-state" style={{ height: '60%' }}>
          <div className="empty-icon"><IconTarget size={40} /></div>
          <h3>请先选择画像</h3>
          <p>每个画像拥有独立的对标账号和行业信息流。</p>
          <button className="btn btn-primary" onClick={() => onNavigate('profile')}>去选择画像</button>
        </div>
      </div>
    );
  }

  if (view === 'settings') {
    return (
      <div className="page-scroll benchmark-settings-page">
        <div className="page-head">
          <div>
            <button className="benchmark-back" onClick={() => setView('feed')}><IconChevron size={14} /> 返回信息流</button>
            <h1 className="page-title">对标账号设置</h1>
            <p className="page-subtitle">配置 RSSHub、行业关键词和需要持续关注的账号。</p>
          </div>
        </div>

        <div className="benchmark-settings-content">
          <section className="card benchmark-settings-card">
            <h3 className="benchmarks-section-title">RSSHub 实例</h3>
            <p className="benchmarks-section-desc">RSSHub 负责把各平台账号转换为统一信息源。</p>
            <input className="field" value={rsshubUrl} placeholder="http://localhost:1200"
              onChange={(event) => setRsshubUrl(event.target.value)} />
          </section>

          <section className="card benchmark-settings-card">
            <h3 className="benchmarks-section-title">行业关键词</h3>
            <p className="benchmarks-section-desc">用于热点过滤，多个关键词用逗号分隔。</p>
            <input className="field" value={keywords} placeholder="AI开源, 大模型, LLM, Hugging Face"
              onChange={(event) => setKeywords(event.target.value)} />
          </section>

          <section className="card benchmark-settings-card">
            <div className="benchmarks-section-head">
              <h3 className="benchmarks-section-title">对标账号</h3>
              <div className="benchmark-settings-actions">
                <button className="btn btn-sm" onClick={loadExamples}>加载示例</button>
                <button className="btn btn-sm btn-primary" onClick={addAccount}><IconPlus size={14} /> 添加账号</button>
              </div>
            </div>
            <p className="benchmarks-section-desc">选择平台后填写 RSSHub 路由、完整 RSS 地址，或直接粘贴平台主页链接自动识别。</p>

            {loading ? (
              <div className="loading"><div className="spinner" />加载中…</div>
            ) : accounts.length === 0 ? (
              <div className="benchmark-config-empty">
                <p>还没有配置对标账号</p>
                <button className="btn btn-primary" onClick={addAccount}><IconPlus size={15} /> 添加账号</button>
              </div>
            ) : (
              <div className="benchmarks-list">
                {accounts.map((account, index) => {
                  const template = PLATFORM_TEMPLATES.find((item) => item.key === account.platform);
                  return (
                    <div key={`${account.platform}-${index}`} className="benchmark-row">
                      <select className="field benchmark-platform" value={account.platform}
                        onChange={(event) => onPlatformChange(index, event.target.value)}>
                        {PLATFORM_TEMPLATES.map((platform) => (
                          <option key={platform.key} value={platform.key}>{platform.label}</option>
                        ))}
                      </select>
                      <input className="field benchmark-name" value={account.name} placeholder="账号名称"
                        onChange={(event) => updateAccount(index, 'name', event.target.value)} />
                      <input className="field benchmark-url" value={account.rss_url}
                        placeholder={template?.placeholder || 'RSS URL 或 RSSHub 路由'}
                        onChange={(event) => updateAccount(index, 'rss_url', event.target.value)} />
                      <button className="btn btn-sm benchmark-delete" onClick={() => removeAccount(index)} title="删除">
                        <IconTrash size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="card benchmark-settings-card">
            <div className="benchmarks-section-head">
              <h3 className="benchmarks-section-title">推荐账号池</h3>
              <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>点击即可加入当前画像</span>
            </div>
            <p className="benchmarks-section-desc">按领域或平台筛选，一键添加热门对标账号。</p>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <input
                className="field"
                style={{ flex: 1 }}
                value={poolQuery}
                onChange={(event) => setPoolQuery(event.target.value)}
                placeholder="搜索账号、标签、领域…"
              />
              <select
                className="field benchmark-platform"
                value={poolPlatform}
                onChange={(event) => setPoolPlatform(event.target.value)}
              >
                <option value="all">全部平台</option>
                {PLATFORM_TEMPLATES.map((platform) => (
                  <option key={platform.key} value={platform.key}>{platform.label}</option>
                ))}
              </select>
            </div>
            {filteredPool.length === 0 ? (
              <p className="benchmarks-section-desc">没有匹配的推荐账号。</p>
            ) : (
              <div className="benchmarks-list" style={{ maxHeight: 320, overflowY: 'auto' }}>
                {filteredPool.map((item, index) => (
                  <div key={`${item.platform}-${item.name}-${index}`} className="benchmark-row">
                    <span className="benchmark-platform" style={{ fontSize: 13 }}>{platformLabel(item.platform)}</span>
                    <span className="benchmark-name" style={{ fontSize: 13 }}>{item.name}</span>
                    <span className="benchmark-url" style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{item.category} · {item.tags.join(' / ')}</span>
                    <button className="btn btn-sm btn-primary" onClick={() => addFromPool(item)}>添加</button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className="benchmark-settings-footer">
            <button className="btn" onClick={() => setView('feed')}>取消</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? '保存中…' : '保存并返回信息流'}
            </button>
          </div>
        </div>
        {toast && <div className="toast ok"><span className="toast-icon">✓</span>{toast}</div>}
      </div>
    );
  }

  return (
    <div className="benchmark-reader">
      <aside className="benchmark-source-pane">
        <div className="benchmark-brand-row">
          <div className="benchmark-brand"><IconTarget size={18} /><span>对标账号</span></div>
          <button className="benchmark-icon-button" onClick={() => setView('settings')} title="对标账号设置">
            <IconEdit size={16} />
          </button>
        </div>

        <button className={`benchmark-nav-item ${selectedPlatform === 'all' && !selectedAccount ? 'active' : ''}`}
          onClick={() => selectPlatform('all')}>
          <span className="benchmark-nav-dot all"><IconTarget size={13} /></span>
          <span>全部文章</span>
          <b>{groups.reduce((sum, group) => sum + group.posts.length, 0)}</b>
        </button>

        <div className="benchmark-nav-title">平台</div>
        <div className="benchmark-platform-list">
          {platforms.map((platform) => (
            <div key={platform.key}>
              <button className={`benchmark-nav-item ${selectedPlatform === platform.key && !selectedAccount ? 'active' : ''}`}
                onClick={() => selectPlatform(platform.key)}>
                <span className={`benchmark-nav-dot platform-${platform.key}`}>{platformMark(platform.key)}</span>
                <span>{platform.label}</span>
                <b>{platform.count}</b>
              </button>
              {selectedPlatform === platform.key && groups.filter((group) => group.platform === platform.key).map((group) => (
                <button key={`${group.platform}:${group.account}`}
                  className={`benchmark-account-item ${selectedAccount === `${group.platform}:${group.account}` ? 'active' : ''}`}
                  onClick={() => selectAccount(group)}>
                  <span>{group.account}</span><b>{group.posts.length}</b>
                </button>
              ))}
            </div>
          ))}
        </div>

        <div className="benchmark-source-footer">
          <button className="btn btn-sm" onClick={handleRefresh} disabled={refreshing}>
            <IconRefresh size={14} /> {refreshing ? '刷新中…' : '刷新信息流'}
          </button>
          {lastFetch > 0 && <span>更新于 {formatPublished(String(lastFetch))}</span>}
        </div>
      </aside>

      <section className="benchmark-feed-pane">
        <header className="benchmark-feed-header">
          <div>
            <h2>{selectedAccount ? selectedAccount.split(':').slice(1).join(':') : selectedPlatform === 'all' ? '全部文章' : platformLabel(selectedPlatform)}</h2>
            <span>{feedPosts.length} 篇内容</span>
          </div>
          <button className="benchmark-icon-button" onClick={handleRefresh} disabled={refreshing} title="刷新">
            <IconRefresh size={16} />
          </button>
        </header>

        {refreshError && <div className="benchmark-inline-error">{refreshError}</div>}
        {loading ? (
          <div className="loading"><div className="spinner" />加载中…</div>
        ) : feedPosts.length === 0 ? (
          <div className="benchmark-feed-empty">
            <IconTarget size={34} />
            <h3>暂无文章</h3>
            <p>请先在设置中添加账号，然后刷新信息流。</p>
            <button className="btn btn-primary" onClick={() => setView('settings')}>配置对标账号</button>
          </div>
        ) : (
          <div className="benchmark-feed-list">
            {feedPosts.map((item) => (
              <button key={item.key} className={`benchmark-feed-item ${selectedFeedPost?.key === item.key ? 'active' : ''}`}
                onClick={() => setSelectedPostKey(item.key)}>
                <div className="benchmark-feed-meta">
                  <span className={`benchmark-feed-source platform-${item.group.platform}`}>{platformMark(item.group.platform)}</span>
                  <span>{item.group.account}</span>
                  <time>{formatPublished(item.post.published_at)}</time>
                </div>
                <h3>{item.post.title}</h3>
                <p>{item.post.summary || item.post.snippet || '打开查看文章内容'}</p>
              </button>
            ))}
          </div>
        )}
      </section>

      <main className="benchmark-article-pane">
        {selectedFeedPost ? (
          <article className="benchmark-article">
            <header className="benchmark-article-header">
              <div className="benchmark-article-kicker">
                <span className={`benchmark-feed-source platform-${selectedFeedPost.group.platform}`}>
                  {platformMark(selectedFeedPost.group.platform)}
                </span>
                <span>{platformLabel(selectedFeedPost.group.platform)} · {selectedFeedPost.group.account}</span>
                <time>{formatPublished(selectedFeedPost.post.published_at)}</time>
              </div>
              <h1>{selectedFeedPost.post.title}</h1>
              <div className="benchmark-article-actions">
                <button className="btn btn-sm" onClick={() => savePost(selectedFeedPost)}>
                  {saved.has(selectedFeedPost.key) ? <IconCheck size={14} /> : <IconBookmark size={14} />}
                  {saved.has(selectedFeedPost.key) ? '已收藏' : '收藏'}
                </button>
                <button className="btn btn-sm" onClick={() => onBreakdown(articleContent(selectedFeedPost.post))}>拆解文章</button>
                <button className="btn btn-sm btn-primary" onClick={() => onUseTopic(
                  selectedFeedPost.post.title,
                  `来源平台：${platformLabel(selectedFeedPost.group.platform)}\n来源账号：${selectedFeedPost.group.account}\n原文链接：${selectedFeedPost.post.url || '无'}\n\n${articleContent(selectedFeedPost.post)}`,
                )}>基于此创作</button>
                {selectedFeedPost.post.url && (
                  <a className="btn btn-sm" href={selectedFeedPost.post.url} target="_blank" rel="noreferrer">查看原文</a>
                )}
              </div>
            </header>

            {selectedFeedPost.post.summary && selectedFeedPost.post.summary !== selectedFeedPost.post.content && (
              <div className="benchmark-article-summary">
                <strong>内容摘要</strong>
                <p>{selectedFeedPost.post.summary}</p>
              </div>
            )}

            <div className="benchmark-article-body"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(articleContent(selectedFeedPost.post)) }} />
          </article>
        ) : (
          <div className="benchmark-article-empty">
            <IconTarget size={44} />
            <h2>选择一篇文章开始阅读</h2>
            <p>右侧将展示完整正文，并可直接收藏、拆解或二次创作。</p>
          </div>
        )}
      </main>

      {toast && <div className="toast ok"><span className="toast-icon">✓</span>{toast}</div>}
    </div>
  );
}
