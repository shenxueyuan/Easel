import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  fetchBenchmarks, saveBenchmarks, addBenchmarkAccount, fetchRsshubConfig, saveRsshubConfig,
  refreshBenchmarks, fetchBenchmarkPosts, fetchBenchmarkStatus, createIdea,
  searchBenchmarks, fetchBenchmarkPool, addBenchmarkPoolAccount, resolveBenchmarkAccount,
  benchmarkAvatarUrl, fetchBrowserBenchmarkStatus, startBrowserBenchmarkSearch, startBrowserBenchmarkLogin,
  fetchBrowserBenchmarkJob,
} from '../lib/api';
import type { BenchmarkAccount, BenchmarkGroup, BenchmarkPost, BenchmarkSearchResult, BrowserPlatformStatus } from '../lib/api';
import type { Page } from './Sidebar';
import { renderMarkdown } from '../lib/sanitize';
import {
  IconTarget, IconPlus, IconTrash, IconRefresh, IconCheck, IconBookmark,
  IconEdit, IconChevron,
} from './icons';
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
  { key: 'kuaishou', label: '快手', route: 'https://www.kuaishou.com/profile/{id}', placeholder: '快手个人主页链接', example: 'https://www.kuaishou.com/profile/...' },
  { key: '36kr', label: '36氪', route: '/36kr/newsflashes', placeholder: 'RSSHub 路由', example: '/36kr/newsflashes' },
  { key: 'custom', label: '自定义', route: '', placeholder: '完整 RSS URL', example: 'https://blog.example.com/rss.xml' },
];

const BROWSER_SEARCH_PLATFORMS = [
  { key: 'bilibili', label: 'B站' },
  { key: 'xiaohongshu', label: '小红书' },
  { key: 'douyin', label: '抖音' },
  { key: 'weibo', label: '微博' },
  { key: 'zhihu', label: '知乎' },
  { key: 'toutiao', label: '头条' },
  { key: 'wechat', label: '公众号' },
  { key: 'kuaishou', label: '快手' },
];

const PLATFORM_LABELS: Record<string, string> = Object.fromEntries(
  [...PLATFORM_TEMPLATES, ...BROWSER_SEARCH_PLATFORMS].map((platform) => [platform.key, platform.label])
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

function accountKey(account: BenchmarkAccount): string {
  return account.id || `${account.platform}:${account.identifier || account.rss_url}`;
}

function mergeAccounts(...groups: BenchmarkAccount[][]): BenchmarkAccount[] {
  const merged = new Map<string, BenchmarkAccount>();
  groups.flat().forEach((account) => merged.set(accountKey(account), { ...merged.get(accountKey(account)), ...account }));
  return [...merged.values()];
}

function accountSource(source?: string): string {
  if (!source) return '账号池';
  if (source.includes('browser_network')) return '平台数据';
  if (source.includes('browser_dom')) return '网页识别';
  if (source.includes('search')) return '在线搜索';
  if (source.includes('resolve')) return '链接识别';
  if (source === 'builtin') return '精选推荐';
  return '账号池';
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
  const [poolAccounts, setPoolAccounts] = useState<BenchmarkAccount[]>([]);
  const [addMode, setAddMode] = useState<'search' | 'link' | 'pool'>('search');
  const [poolQuery, setPoolQuery] = useState('');
  const [poolPlatform, setPoolPlatform] = useState('all');
  const [newLink, setNewLink] = useState('');
  const [resolvingLink, setResolvingLink] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchPlatform, setSearchPlatform] = useState('bilibili');
  const [browserStatuses, setBrowserStatuses] = useState<BrowserPlatformStatus[]>([]);
  const [browserLoginLoading, setBrowserLoginLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [searchResults, setSearchResults] = useState<BenchmarkSearchResult[]>([]);
  const [topSearchOpen, setTopSearchOpen] = useState(false);
  const [addingAccountKey, setAddingAccountKey] = useState('');
  const [searchPage, setSearchPage] = useState(1);
  const [searchPages, setSearchPages] = useState(1);
  const [minFollowers, setMinFollowers] = useState(0);

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
      fetchBenchmarkPool().then((data) => setPoolAccounts(data.accounts || [])).catch(() => {}),
      fetchBrowserBenchmarkStatus().then((data) => setBrowserStatuses(data.platforms || [])).catch(() => {}),
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
    return poolAccounts.filter((item) => {
      if (poolPlatform !== 'all' && item.platform !== poolPlatform) return false;
      if (!q) return true;
      const text = `${item.name} ${item.category || ''} ${(item.tags || []).join(' ')} ${item.platform}`.toLowerCase();
      return text.includes(q);
    });
  }, [poolAccounts, poolQuery, poolPlatform]);

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

  const appendAccount = (item: BenchmarkAccount) => {
    if (accounts.some((account) => accountKey(account) === accountKey(item))) {
      showToast('该账号已在当前画像中');
      return;
    }
    setAccounts((current) => [...current, item]);
    showToast(`已添加 ${item.name}`);
  };

  const addFromPool = (item: BenchmarkAccount) => appendAccount(item);

  const waitBrowserJob = async (jobId: string) => {
    // 搜索可能需要等待用户登录，最多等待 11 分钟（330 次 × 2 秒）
    for (let attempt = 0; attempt < 330; attempt += 1) {
      const job = await fetchBrowserBenchmarkJob(jobId);
      if (!['pending', 'running'].includes(job.state)) return job;
      await new Promise((resolve) => window.setTimeout(resolve, 2000));
    }
    throw new Error('浏览器任务等待超时');
  };

  const addSearchResult = async (item: BenchmarkSearchResult) => {
    const key = accountKey(item);
    if (addingAccountKey) return;
    setAddingAccountKey(key);
    try {
      const poolData = await addBenchmarkPoolAccount(item);
      const data = await addBenchmarkAccount(persona, poolData.account);
      setAccounts(data.accounts || []);
      if (!data.added) {
        showToast('该账号已在当前画像中');
      } else {
        showToast(`已添加 ${data.account.name}`);
      }
      setPoolAccounts((current) => current.some((account) => accountKey(account) === accountKey(data.account))
        ? current.map((account) => accountKey(account) === accountKey(data.account) ? data.account : account)
        : [...current, data.account]);
    } catch (error) {
      showToast(error instanceof Error ? error.message : '账号验证和保存失败');
    } finally {
      setAddingAccountKey('');
    }
  };

  const handleNewLink = async () => {
    const input = newLink.trim();
    if (!input) return;
    setResolvingLink(true);
    try {
      const data = await resolveBenchmarkAccount(input);
      appendAccount(data.account);
      setNewLink('');
    } catch (error) {
      const parsed = parseProfileUrl(input);
      if (parsed) {
        appendAccount({ ...parsed, source: 'link_resolve', verified: false, feed_status: 'unknown' });
        setNewLink('');
      } else {
        showToast(error instanceof Error ? error.message : '无法识别该链接');
      }
    } finally {
      setResolvingLink(false);
    }
  };

  const handleSearch = async (page = 1) => {
    if (!searchKeyword.trim() || browserLoginLoading || searchLoading) return;
    setSearchLoading(true);
    setSearchError('');
    const query = searchKeyword.trim().toLowerCase();
    const localResults = poolAccounts.filter((item) => item.platform === searchPlatform && [
      item.name, item.description || '', item.category || '', ...(item.tags || []),
    ].join(' ').toLowerCase().includes(query));
    setSearchResults(localResults);
    try {
      if (searchPlatform === 'bilibili') {
        const data = await searchBenchmarks(searchKeyword.trim(), 'bilibili', page, minFollowers);
        const results = mergeAccounts(localResults, data.results);
        setSearchResults(results);
        setSearchPage(data.page);
        setSearchPages(data.pages);
        if (!results.length) showToast('未找到相关账号');
      } else {
        const started = await startBrowserBenchmarkSearch(searchPlatform, searchKeyword.trim());
        const job = await waitBrowserJob(started.id);
        if (job.state === 'failed') throw new Error(job.error || '浏览器搜索失败');
        if (job.state === 'login_required') {
          setSearchResults(localResults);
          setSearchError(localResults.length ? '已显示账号池结果；连接平台登录后可搜索更多账号' : '该平台需要先登录浏览器');
        } else if (job.state === 'blocked') {
          setSearchResults(localResults);
          setSearchError('平台检测到当前网络或浏览器环境存在风险，请稍后重试或更换可靠网络');
        } else {
          const results = mergeAccounts(localResults, job.result?.results || []);
          setSearchResults(results);
          setSearchPage(1);
          setSearchPages(1);
          if (!results.length) showToast('未找到相关账号');
        }
      }
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : '搜索失败');
    } finally {
      setSearchLoading(false);
    }
  };

  const openTopSearch = () => {
    setTopSearchOpen(true);
    void handleSearch(1);
  };

  const handleBrowserLogin = async () => {
    if (browserLoginLoading || searchLoading) return;
    setBrowserLoginLoading(true);
    try {
      showToast(`正在打开${platformLabel(searchPlatform)}登录窗口`);
      const started = await startBrowserBenchmarkLogin(searchPlatform);
      const job = await waitBrowserJob(started.id);
      if (job.state === 'failed') throw new Error(job.error || '登录任务失败');
      const status = await fetchBrowserBenchmarkStatus();
      setBrowserStatuses(status.platforms || []);
      showToast(job.state === 'ready' ? '浏览器登录已就绪'
        : job.state === 'blocked' ? '平台检测到网络或浏览器环境风险，请稍后重试'
        : '登录尚未完成，请重试');
    } catch (error) {
      showToast(error instanceof Error ? error.message : '登录失败');
    } finally {
      setBrowserLoginLoading(false);
    }
  };

  const loadExamples = () => {
    setAccounts(poolAccounts.slice(0, 9));
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
          return { ...account, id: undefined, identifier: undefined, platform: parsed.platform,
            name: account.name || parsed.name, rss_url: parsed.rss_url, verified: false, feed_status: 'unknown' };
        }
      }
      return { ...account, [field]: value, ...(field === 'rss_url' ? {
        id: undefined, identifier: undefined, verified: false, feed_status: 'unknown',
      } : {}) };
    }));
  };

  const onPlatformChange = (index: number, platform: string) => {
    const template = PLATFORM_TEMPLATES.find((item) => item.key === platform);
    setAccounts((current) => current.map((account, itemIndex) => itemIndex === index
      ? { ...account, id: undefined, identifier: undefined, platform, rss_url: template?.route || '',
        verified: false, feed_status: 'unknown' }
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
            <p className="benchmarks-section-desc">这里展示已选择的账号；可在下方通过在线搜索、链接识别或推荐账号池添加。</p>

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

          <section className="card benchmark-settings-card benchmark-discover-card">
            <div className="benchmarks-section-head">
              <div>
                <h3 className="benchmarks-section-title">发现并添加对标账号</h3>
                <p className="benchmarks-section-desc">参考 Folo 的订阅发现方式，通过关键词、主页链接或账号池快速添加。</p>
              </div>
              <span className="benchmark-discover-count">已选择 {accounts.length} 个</span>
            </div>
            <div className="benchmark-discover-tabs">
              {([['search', '在线搜索'], ['link', '粘贴链接'], ['pool', '推荐账号']] as const).map(([key, label]) => (
                <button key={key} className={addMode === key ? 'active' : ''} onClick={() => setAddMode(key)}>{label}</button>
              ))}
            </div>

            {addMode === 'search' && (
              <div className="benchmark-discover-panel">
                <div className="benchmark-discover-toolbar">
                  <select className="field benchmark-platform" value={searchPlatform}
                    onChange={(event) => { setSearchPlatform(event.target.value); setSearchResults([]); setSearchError(''); }}>
                    {BROWSER_SEARCH_PLATFORMS.map((platform) => (
                      <option key={platform.key} value={platform.key}>{platform.label}</option>
                    ))}
                  </select>
                  <input className="field benchmark-discover-input" value={searchKeyword}
                    onChange={(event) => setSearchKeyword(event.target.value)}
                    onKeyDown={(event) => event.key === 'Enter' && handleSearch()}
                    placeholder={`搜索${platformLabel(searchPlatform)}的账号、作者或机构`} />
                  {searchPlatform === 'bilibili' && (
                    <select className="field benchmark-platform" value={minFollowers}
                      onChange={(event) => setMinFollowers(Number(event.target.value))}>
                      <option value={0}>不限粉丝</option>
                      <option value={10000}>1 万以上</option>
                      <option value={100000}>10 万以上</option>
                      <option value={1000000}>100 万以上</option>
                    </select>
                  )}
                  {searchPlatform !== 'bilibili' && (
                    <button className="btn" onClick={handleBrowserLogin} disabled={searchLoading || browserLoginLoading}>
                      {browserLoginLoading ? '等待登录…' : browserStatuses.some((item) => item.platform === searchPlatform && item.profile_exists) ? '重新登录' : '连接平台'}
                    </button>
                  )}
                  <button className="btn btn-primary" onClick={() => handleSearch(1)}
                    disabled={searchLoading || browserLoginLoading || !searchKeyword.trim()}>
                    {searchLoading ? '正在搜索…如需登录请在弹出的浏览器中操作' : '搜索'}
                  </button>
                </div>
                <div className="benchmark-discover-hint">优先匹配本地账号池，再从平台 API 或已登录浏览器补充结果。</div>
                {searchError && <div className="benchmark-discover-error">{searchError}</div>}
                {searchResults.length > 0 ? (
                  <div className="benchmark-discover-results">
                    {searchResults.map((item) => {
                      const exists = accounts.some((account) => accountKey(account) === accountKey(item));
                      return (
                        <div key={`search-${accountKey(item)}`} className="benchmark-discover-item">
                          <div className={`benchmark-discover-avatar platform-${item.platform}`}>
                            {item.avatar ? <img src={benchmarkAvatarUrl(item.avatar)} alt="" /> : platformMark(item.platform)}
                          </div>
                          <div className="benchmark-discover-info">
                            <div className="benchmark-discover-name">
                              <strong>{item.name}</strong>
                              <span>{platformLabel(item.platform)}</span>
                              {item.verified && <span className="verified">已验证</span>}
                            </div>
                            <p>{item.description || item.category || '暂无账号简介'}</p>
                            <div className="benchmark-discover-meta">
                              <span>{item.followers == null ? '粉丝未知' : `${item.followers.toLocaleString('zh-CN')} 粉丝`}</span>
                              <span>{accountSource(item.source)}</span>
                              {item.profile_url && <a href={item.profile_url} target="_blank" rel="noreferrer">查看主页</a>}
                            </div>
                          </div>
                          <button className="btn btn-sm btn-primary" disabled={exists || Boolean(addingAccountKey)} onClick={() => addSearchResult(item)}>
                            {exists ? '已添加' : addingAccountKey === accountKey(item) ? '验证中…' : '添加'}
                          </button>
                        </div>
                      );
                    })}
                    {searchPages > 1 && (
                      <div className="benchmark-discover-pagination">
                        <button className="btn btn-sm" disabled={searchLoading || searchPage <= 1}
                          onClick={() => handleSearch(searchPage - 1)}>上一页</button>
                        <span>{searchPage} / {searchPages}</span>
                        <button className="btn btn-sm" disabled={searchLoading || searchPage >= searchPages}
                          onClick={() => handleSearch(searchPage + 1)}>下一页</button>
                      </div>
                    )}
                  </div>
                ) : !searchLoading && searchKeyword && !searchError ? (
                  <div className="benchmark-discover-empty">没有找到匹配账号，可尝试更换关键词或粘贴主页链接。</div>
                ) : null}
              </div>
            )}

            {addMode === 'link' && (
              <div className="benchmark-discover-panel">
                <div className="benchmark-link-box">
                  <textarea className="field" value={newLink} onChange={(event) => setNewLink(event.target.value)}
                    placeholder="粘贴账号主页、公众号文章链接，或包含链接的整段分享文案…" />
                  <button className="btn btn-primary" onClick={handleNewLink} disabled={resolvingLink || !newLink.trim()}>
                    {resolvingLink ? '正在识别…' : '识别并添加'}
                  </button>
                </div>
                <div className="benchmark-discover-hint">支持小红书、抖音、B站、微博、知乎、头条、快手主页和公众号文章；短链接会自动跟随跳转。</div>
              </div>
            )}

            {addMode === 'pool' && (
              <div className="benchmark-discover-panel">
                <div className="benchmark-discover-toolbar">
                  <input className="field benchmark-discover-input" value={poolQuery}
                    onChange={(event) => setPoolQuery(event.target.value)} placeholder="搜索账号、标签或领域" />
                  <select className="field benchmark-platform" value={poolPlatform}
                    onChange={(event) => setPoolPlatform(event.target.value)}>
                    <option value="all">全部平台</option>
                    {PLATFORM_TEMPLATES.map((platform) => (
                      <option key={platform.key} value={platform.key}>{platform.label}</option>
                    ))}
                  </select>
                </div>
                {filteredPool.length === 0 ? (
                  <div className="benchmark-discover-empty">没有匹配的推荐账号。</div>
                ) : (
                  <div className="benchmark-discover-results">
                    {filteredPool.map((item) => {
                      const exists = accounts.some((account) => accountKey(account) === accountKey(item));
                      return (
                        <div key={`pool-${accountKey(item)}`} className="benchmark-discover-item">
                          <div className={`benchmark-discover-avatar platform-${item.platform}`}>
                            {item.avatar ? <img src={benchmarkAvatarUrl(item.avatar)} alt="" /> : platformMark(item.platform)}
                          </div>
                          <div className="benchmark-discover-info">
                            <div className="benchmark-discover-name"><strong>{item.name}</strong><span>{platformLabel(item.platform)}</span></div>
                            <p>{item.description || item.category || '暂无账号简介'}</p>
                            <div className="benchmark-discover-meta">
                              <span>{item.tags?.length ? item.tags.join(' · ') : '未添加标签'}</span>
                              <span>{accountSource(item.source)}</span>
                            </div>
                          </div>
                          <button className="btn btn-sm btn-primary" disabled={exists} onClick={() => addFromPool(item)}>
                            {exists ? '已添加' : '添加'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
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
    <div className="benchmark-page-shell">
      <div className="benchmark-top-search">
        <select value={searchPlatform} onChange={(event) => setSearchPlatform(event.target.value)}>
          {BROWSER_SEARCH_PLATFORMS.map((platform) => (
            <option key={platform.key} value={platform.key}>{platform.label}</option>
          ))}
        </select>
        <input value={searchKeyword} onChange={(event) => setSearchKeyword(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && openTopSearch()}
          placeholder="搜索对标账号、作者或机构…" />
        <button className="btn btn-primary" onClick={openTopSearch}
          disabled={searchLoading || browserLoginLoading || !searchKeyword.trim()}>{searchLoading ? '搜索中…' : '搜索账号'}</button>
        <button className="btn" onClick={() => { setAddMode('link'); setView('settings'); }}>粘贴链接</button>
      </div>
      {topSearchOpen && (
        <div className="benchmark-top-results">
          <div className="benchmark-top-results-head">
            <strong>{searchLoading ? '正在搜索账号…' : `找到 ${searchResults.length} 个账号`}</strong>
            <button onClick={() => setTopSearchOpen(false)} aria-label="关闭搜索结果">×</button>
          </div>
          {searchError && <div className="benchmark-discover-error">{searchError}</div>}
          {!searchLoading && searchResults.length === 0 && !searchError && (
            <div className="benchmark-discover-empty">没有找到匹配账号，请更换关键词或使用主页链接添加。</div>
          )}
          {searchResults.length > 0 && (
            <div className="benchmark-top-results-list">
              {searchResults.map((item) => {
                const exists = accounts.some((account) => accountKey(account) === accountKey(item));
                return (
                  <div key={`top-${accountKey(item)}`} className="benchmark-discover-item">
                    <div className={`benchmark-discover-avatar platform-${item.platform}`}>
                      {item.avatar ? <img src={benchmarkAvatarUrl(item.avatar)} alt="" /> : platformMark(item.platform)}
                    </div>
                    <div className="benchmark-discover-info">
                      <div className="benchmark-discover-name">
                        <strong>{item.name}</strong><span>{platformLabel(item.platform)}</span>
                        {item.verified && <span className="verified">已验证</span>}
                      </div>
                      <p>{item.description || '暂无账号简介'}</p>
                      <div className="benchmark-discover-meta">
                        <span>{item.followers == null ? '粉丝未知' : `${item.followers.toLocaleString('zh-CN')} 粉丝`}</span>
                        <span>{accountSource(item.source)}</span>
                        {item.profile_url && <a href={item.profile_url} target="_blank" rel="noreferrer">查看主页</a>}
                      </div>
                    </div>
                    <button className="btn btn-sm btn-primary" disabled={exists || Boolean(addingAccountKey)}
                      onClick={() => addSearchResult(item)}>
                      {exists ? '已添加' : addingAccountKey === accountKey(item) ? '验证中…' : '添加'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
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
      </div>

      {toast && <div className="toast ok"><span className="toast-icon">✓</span>{toast}</div>}
    </div>
  );
}
