import { useState, useEffect, useCallback } from 'react';
import {
  fetchBenchmarks, saveBenchmarks, fetchRsshubConfig, saveRsshubConfig,
  refreshBenchmarks, fetchBenchmarkPosts, fetchBenchmarkStatus, createIdea,
} from '../lib/api';
import type { BenchmarkAccount, BenchmarkGroup, BenchmarkPost } from '../lib/api';
import type { Page } from './Sidebar';
import { IconTarget, IconPlus, IconTrash, IconRefresh, IconCheck, IconBookmark } from './icons';

interface BenchmarkPageProps {
  persona: string;
  onNavigate: (page: Page) => void;
  onBreakdown: (content: string) => void;
  onUseTopic: (title: string) => void;
}

// 平台 + RSSHub 路由模板
const PLATFORM_TEMPLATES: { key: string; label: string; route: string; placeholder: string; example: string }[] = [
  { key: 'wechat', label: '公众号', route: '/wechat/mp/{id}', placeholder: '公众号 __biz 或 newrank id', example: 'MzI3MjQ4NzU2NA==' },
  { key: 'weibo', label: '微博', route: '/weibo/user/{uid}', placeholder: '微博用户 uid', example: '1195230310' },
  { key: 'zhihu', label: '知乎', route: '/zhihu/people/activities/{id}', placeholder: '知乎用户 id', example: 'di-ling-83' },
  { key: 'bilibili', label: 'B站', route: '/bilibili/user/dynamic/{uid}', placeholder: 'B站 UP 主 uid', example: '2267573' },
  { key: 'douyin', label: '抖音', route: '/douyin/user/{uid}', placeholder: '抖音用户 uid', example: 'MS4wLjABAAAA...' },
  { key: 'xiaohongshu', label: '小红书', route: '/xiaohongshu/user/{user_id}/notes', placeholder: '小红书 24 位 user_id', example: '593032945e87e77791e03696' },
  { key: 'toutiao', label: '头条', route: '/toutiao/user/{id}', placeholder: '头条用户 id', example: '' },
  { key: 'custom', label: '自定义', route: '', placeholder: '完整 RSS URL', example: 'https://blog.example.com/rss.xml' },
];

const PLATFORM_LABELS: Record<string, string> = Object.fromEntries(
  PLATFORM_TEMPLATES.map((p) => [p.key, p.label])
);

export default function BenchmarkPage({ persona, onNavigate, onBreakdown, onUseTopic }: BenchmarkPageProps) {
  const [accounts, setAccounts] = useState<BenchmarkAccount[]>([]);
  const [keywords, setKeywords] = useState('');
  const [rsshubUrl, setRsshubUrl] = useState('http://localhost:1200');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  // 抓取状态
  const [groups, setGroups] = useState<BenchmarkGroup[]>([]);
  const [lastFetch, setLastFetch] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState('');
  const [saved, setSaved] = useState<Set<string>>(new Set());

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500); };

  // 加载配置
  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchRsshubConfig().then((d) => setRsshubUrl(d.rsshub_url || 'http://localhost:1200')).catch(() => {}),
      persona ? fetchBenchmarks(persona).then((d) => {
        setAccounts(d.accounts || []);
        setKeywords(d.keywords || '');
      }).catch(() => {}) : Promise.resolve(),
    ]).finally(() => setLoading(false));
  }, [persona]);

  // 加载已抓取帖子
  const loadPosts = useCallback(() => {
    if (!persona) { setGroups([]); return; }
    fetchBenchmarkPosts(persona)
      .then((d) => { setGroups(d.groups); setLastFetch(d.last_fetch); })
      .catch(() => {});
  }, [persona]);

  useEffect(() => { loadPosts(); }, [loadPosts]);

  // ── 配置操作 ──
  const addAccount = () => {
    setAccounts((prev) => [...prev, { platform: 'weibo', name: '', rss_url: '' }]);
  };

  // 预设示例：各平台热门技术账号
  const loadExamples = () => {
    setAccounts([
      { platform: '36kr', name: '36氪快讯', rss_url: '/36kr/newsflashes' },
      { platform: 'zhihu', name: '知乎日报', rss_url: '/zhihu/daily' },
      { platform: 'custom', name: 'GitHub Blog', rss_url: 'https://github.blog/feed/' },
      { platform: 'custom', name: 'OpenAI Blog', rss_url: 'https://openai.com/blog/rss.xml' },
      { platform: 'weibo', name: '36氪微博', rss_url: '/weibo/user/1750070171' },
      { platform: 'bilibili', name: '影视飓风', rss_url: '/bilibili/user/dynamic/2267573' },
    ]);
    setKeywords('AI, 大模型, LLM, 开源, Hugging Face');
  };

  const removeAccount = (idx: number) => {
    setAccounts((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateAccount = (idx: number, field: keyof BenchmarkAccount, value: string) => {
    setAccounts((prev) => prev.map((a, i) => i === idx ? { ...a, [field]: value } : a));
  };

  // 平台切换时自动填充 RSS 路由模板
  const onPlatformChange = (idx: number, platform: string) => {
    const tpl = PLATFORM_TEMPLATES.find((p) => p.key === platform);
    if (tpl && tpl.route) {
      setAccounts((prev) => prev.map((a, i) =>
        i === idx ? { ...a, platform, rss_url: tpl.route } : a
      ));
    } else {
      updateAccount(idx, 'platform', platform);
    }
  };

  const handleSave = async () => {
    if (!persona) { showToast('请先选择画像'); return; }
    setSaving(true);
    try {
      await saveRsshubConfig(rsshubUrl);
      await saveBenchmarks(persona, accounts.filter((a) => a.name.trim() && a.rss_url.trim()), keywords);
      showToast('对标配置已保存 ✓');
    } catch (e) {
      showToast(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  // ── 抓取 ──
  const handleRefresh = async () => {
    if (!persona) { showToast('请先选择画像'); return; }
    if (accounts.filter((a) => a.name.trim() && a.rss_url.trim()).length === 0) {
      showToast('请先添加对标账号'); return;
    }
    setRefreshing(true);
    setRefreshError('');
    try {
      await refreshBenchmarks(persona);
      const poll = async () => {
        try {
          const st = await fetchBenchmarkStatus(persona);
          if (st.state === 'done' || st.state === 'failed' || st.state === 'unknown') {
            setRefreshing(false);
            loadPosts();
            if (st.state === 'failed') setRefreshError(st.log);
            return;
          }
        } catch { /* ignore */ }
        setTimeout(poll, 3000);
      };
      setTimeout(poll, 3000);
    } catch (e) {
      setRefreshing(false);
      setRefreshError(e instanceof Error ? e.message : '刷新失败');
    }
  };

  const savePost = async (title: string, account: string) => {
    if (saved.has(title)) return;
    try {
      await createIdea({ title, source: `对标:${account}`, status: 'pending' });
      setSaved((prev) => new Set(prev).add(title));
    } catch { /* ignore */ }
  };

  if (!persona) {
    return (
      <div className="page-scroll">
        <h1 className="page-title"><IconTarget size={22} /> 对标配置</h1>
        <div className="empty-state" style={{ height: '60%' }}>
          <div className="empty-icon"><IconTarget size={40} /></div>
          <h3>请先选择画像</h3>
          <p>对标配置按画像隔离，每个画像对应一套对标账号。</p>
          <button className="btn btn-primary" onClick={() => onNavigate('profile')}>去选择画像</button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-scroll benchmarks-page">
      <div className="page-head">
        <div>
          <h1 className="page-title"><IconTarget size={22} /> 对标配置</h1>
          <p className="page-subtitle">
            配置 RSSHub 实例和对标账号，抓取多平台最新内容，支持一键拆解和二创。
          </p>
        </div>
      </div>

      {/* ── 全局 RSSHub 设置 ── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="benchmarks-section-head" style={{ marginBottom: 8 }}>
          <h3 className="benchmarks-section-title">RSSHub 实例</h3>
        </div>
        <p className="benchmarks-section-desc" style={{ marginBottom: 8 }}>
          RSSHub 是开源 RSS 生成器，覆盖微博/知乎/B站/抖音/小红书/头条等平台。
          需本地 Docker 部署：<code>docker run -d --name rsshub -p 1200:1200 diygod/rsshub</code>
        </p>
        <input className="field" value={rsshubUrl} placeholder="http://localhost:1200"
          onChange={(e) => setRsshubUrl(e.target.value)} />
      </div>

      {/* ── 行业关键词 ── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 className="benchmarks-section-title" style={{ marginBottom: 8 }}>行业关键词</h3>
        <p className="benchmarks-section-desc" style={{ marginBottom: 8 }}>
          用于热点雷达「行业热点」Tab 过滤，多个关键词用逗号分隔。
        </p>
        <input className="field" value={keywords} placeholder="AI开源, 大模型, LLM, Hugging Face"
          onChange={(e) => setKeywords(e.target.value)} />
      </div>

      {/* ── 对标账号列表 ── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="benchmarks-section-head">
          <h3 className="benchmarks-section-title">对标账号</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-sm" onClick={loadExamples} title="加载各平台热门技术账号示例">
              加载示例
            </button>
            <button className="btn btn-sm btn-primary" onClick={addAccount}>
              <IconPlus size={14} /> 添加账号
            </button>
          </div>
        </div>
        <p className="benchmarks-section-desc" style={{ marginTop: 8 }}>
          选择平台后自动填充 RSSHub 路由模板，填入账号 ID 即可。
          公众号需配置 NEWRANK_COOKIE；微博/B站/抖音可能需要 Cookie。
        </p>

        {loading ? (
          <div className="loading"><div className="spinner" />加载中…</div>
        ) : accounts.length === 0 ? (
          <div className="empty-state" style={{ height: '200px' }}>
            <div className="empty-icon"><IconTarget size={32} /></div>
            <p>还没有添加对标账号</p>
            <button className="btn btn-primary" onClick={addAccount}>
              <IconPlus size={15} /> 添加第一个对标账号
            </button>
          </div>
        ) : (
          <div className="benchmarks-list">
            {accounts.map((acc, idx) => {
              const tpl = PLATFORM_TEMPLATES.find((p) => p.key === acc.platform);
              return (
                <div key={idx} className="benchmark-row">
                  <select className="field benchmark-platform" value={acc.platform}
                    onChange={(e) => onPlatformChange(idx, e.target.value)}>
                    {PLATFORM_TEMPLATES.map((p) => (
                      <option key={p.key} value={p.key}>{p.label}</option>
                    ))}
                  </select>
                  <input className="field benchmark-name" value={acc.name} placeholder="账号名称"
                    onChange={(e) => updateAccount(idx, 'name', e.target.value)} />
                  <input className="field benchmark-url" value={acc.rss_url}
                    placeholder={tpl?.placeholder || 'RSS URL 或 RSSHub 路由'}
                    title={tpl ? `示例: ${tpl.route.replace('{id}', tpl.example)}` : ''}
                    onChange={(e) => updateAccount(idx, 'rss_url', e.target.value)} />
                  <button className="btn btn-sm" style={{ color: 'var(--red)', borderColor: 'var(--red)' }}
                    onClick={() => removeAccount(idx)} title="删除">
                    <IconTrash size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── 保存 + 抓取 ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? '保存中…' : '保存配置'}
        </button>
        <button className="btn" onClick={handleRefresh} disabled={refreshing}>
          <IconRefresh size={15} /> {refreshing ? '抓取中…' : '抓取最新内容'}
        </button>
        <button className="btn" onClick={() => onNavigate('trends')}>
          去热点雷达查看 →
        </button>
      </div>

      {refreshError && <div className="notice-error">{refreshError}</div>}

      {/* ── 已抓取内容预览 ── */}
      {groups.length > 0 && (
        <div>
          <h3 className="benchmarks-section-title" style={{ marginBottom: 12 }}>
            已抓取内容 {lastFetch > 0 && (
              <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-tertiary)' }}>
                · {new Date(lastFetch * 1000).toLocaleString('zh-CN')}
              </span>
            )}
          </h3>
          <div className="trend-grid">
            {groups.map((g, gi) => (
              <div key={gi} className="card trend-col">
                <div className="trend-col-head">
                  {PLATFORM_LABELS[g.platform] || g.platform} · {g.account}
                  <span className="trend-count">{g.posts.length}</span>
                </div>
                <div className="trend-list">
                  {g.posts.map((p, i) => (
                    <BenchmarkPostItem key={i} post={p} account={g.account}
                      saved={saved} onSave={savePost}
                      onBreakdown={onBreakdown} onUseTopic={onUseTopic} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {toast && <div className="toast ok"><span className="toast-icon">✓</span>{toast}</div>}
    </div>
  );
}

function BenchmarkPostItem({ post, account, saved, onSave, onBreakdown, onUseTopic }: {
  post: BenchmarkPost;
  account: string;
  saved: Set<string>;
  onSave: (title: string, account: string) => void;
  onBreakdown: (content: string) => void;
  onUseTopic: (title: string) => void;
}) {
  return (
    <div className="trend-item">
      <div className="trend-main">
        <a className="trend-title" href={post.url || undefined} target="_blank" rel="noreferrer"
          title={post.title}>{post.title}</a>
        {post.snippet && <div className="trend-snippet">{post.snippet}</div>}
      </div>
      <button className="trend-save" title={saved.has(post.title) ? '已收藏' : '收藏到选题库'}
        onClick={() => onSave(post.title, account)}>
        {saved.has(post.title) ? <IconCheck size={14} /> : <IconBookmark size={14} />}
      </button>
      <button className="trend-use" title="一键拆解"
        onClick={() => onBreakdown(post.title)}>拆解</button>
      <button className="trend-use" title="做成内容"
        onClick={() => onUseTopic(post.title)}>做内容</button>
    </div>
  );
}
