import { useState, useEffect, useCallback } from 'react';
import {
  fetchTrends, fetchIndustryTrends, fetchBenchmarkPosts, refreshBenchmarks, fetchBenchmarkStatus, createIdea,
} from '../lib/api';
import type { TrendGroup, TrendItem, BenchmarkGroup } from '../lib/api';
import type { Page } from './Sidebar';
import { IconFire, IconRefresh, IconBookmark, IconCheck, IconCompass, IconTarget, IconPlus } from './icons';

interface TrendsPageProps {
  onUseTopic: (title: string) => void;
  persona: string;
  onNavigate: (page: Page) => void;
  onBreakdown: (content: string) => void;
}

type Tab = 'hot' | 'industry' | 'benchmarks';

const ALL_PLATFORMS: { key: string; label: string }[] = [
  { key: 'weibo', label: '微博' },
  { key: 'douyin', label: '抖音' },
  { key: 'zhihu', label: '知乎' },
  { key: 'bilibili', label: 'B站' },
  { key: 'baidu', label: '百度' },
  { key: 'toutiao', label: '头条' },
];

const PLATFORM_LABELS: Record<string, string> = {
  wechat: '公众号', zhihu: '知乎', weibo: '微博', bilibili: 'B站',
  douyin: '抖音', xiaohongshu: '小红书', toutiao: '头条',
};

export default function TrendsPage({ onUseTopic, persona, onNavigate, onBreakdown }: TrendsPageProps) {
  const [tab, setTab] = useState<Tab>('hot');

  return (
    <div className="page-scroll trends-page">
      <div className="page-head">
        <div>
          <h1 className="page-title"><IconFire size={22} /> 热点雷达</h1>
          <p className="page-subtitle">
            多平台实时热搜 + 行业热点 + 对标账号动态，挑值得蹭的选题，一键交给 AI 做成你的内容。
          </p>
        </div>
      </div>

      {/* Tab 切换 */}
      <div className="trend-tabs">
        <button className={`tab-btn ${tab === 'hot' ? 'active' : ''}`} onClick={() => setTab('hot')}>
          <IconFire size={15} /> 通用热搜
        </button>
        <button className={`tab-btn ${tab === 'industry' ? 'active' : ''}`} onClick={() => setTab('industry')}>
          <IconCompass size={15} /> 行业热点
        </button>
        <button className={`tab-btn ${tab === 'benchmarks' ? 'active' : ''}`} onClick={() => setTab('benchmarks')}>
          <IconTarget size={15} /> 对标动态
        </button>
      </div>

      {tab === 'hot' && <HotTrendsTab onUseTopic={onUseTopic} />}
      {tab === 'industry' && <IndustryTab onUseTopic={onUseTopic} persona={persona} />}
      {tab === 'benchmarks' && <BenchmarksTab onUseTopic={onUseTopic} persona={persona} onNavigate={onNavigate} onBreakdown={onBreakdown} />}
    </div>
  );
}

// ── 通用热搜 Tab ──────────────────────────────────────────────
function HotTrendsTab({ onUseTopic }: { onUseTopic: (title: string) => void }) {
  const [selected, setSelected] = useState<string[]>(['weibo', 'douyin', 'zhihu']);
  const [groups, setGroups] = useState<TrendGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [updated, setUpdated] = useState(0);
  const [saved, setSaved] = useState<Set<string>>(new Set());

  const save = async (title: string, source: string) => {
    if (saved.has(title)) return;
    try {
      await createIdea({ title, source: `${source}热搜`, status: 'pending' });
      setSaved((prev) => new Set(prev).add(title));
    } catch { /* ignore */ }
  };

  const load = useCallback((pfs: string[]) => {
    if (pfs.length === 0) { setGroups([]); return; }
    setLoading(true);
    setError('');
    fetchTrends(pfs.join(','), 15)
      .then((d) => { setGroups(d.trends); setUpdated(d.updated); })
      .catch(() => setError('热点拉取失败——请确认已配置外网代理（EASEL_PROXY）。'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(selected); }, [load, selected]);

  const toggle = (k: string) =>
    setSelected((prev) => prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]);

  return (
    <>
      <div className="trend-toolbar">
        <div className="trend-platforms">
          {ALL_PLATFORMS.map((p) => (
            <button key={p.key} className={`chip ${selected.includes(p.key) ? 'active' : ''}`}
              onClick={() => toggle(p.key)}>{p.label}</button>
          ))}
        </div>
        <button className="btn btn-sm" onClick={() => load(selected)} disabled={loading}>
          <IconRefresh size={14} /> {loading ? '刷新中…' : '刷新'}
        </button>
      </div>

      {updated > 0 && <div className="trend-updated">{new Date(updated * 1000).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} 更新</div>}

      {error && <div className="notice-error">{error}</div>}

      <div className="trend-grid">
        {groups.map((g) => (
          <div key={g.platform} className="card trend-col">
            <div className="trend-col-head">{g.label}<span className="trend-count">{g.items.length}</span></div>
            <div className="trend-list">
              {g.items.length === 0 && !loading && <div className="trend-empty">暂无数据</div>}
              {g.items.map((it, i) => (
                <div key={i} className="trend-item">
                  <span className={`trend-rank ${i < 3 ? 'top' : ''}`}>{i + 1}</span>
                  <div className="trend-main">
                    <a className="trend-title" href={it.url || undefined} target="_blank" rel="noreferrer"
                      title={it.title}>{it.title}</a>
                    {it.hot && <span className="trend-hot">{it.hot}</span>}
                  </div>
                  <button className="trend-save" title={saved.has(it.title) ? '已收藏到选题库' : '收藏到选题库'}
                    onClick={() => save(it.title, g.label)}>
                    {saved.has(it.title) ? <IconCheck size={14} /> : <IconBookmark size={14} />}
                  </button>
                  <button className="trend-use" title="做成内容"
                    onClick={() => onUseTopic(it.title)}>做内容</button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// ── 行业热点 Tab ──────────────────────────────────────────────
function IndustryTab({ onUseTopic, persona }: { onUseTopic: (title: string) => void; persona: string }) {
  const [items, setItems] = useState<TrendItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [keywords, setKeywords] = useState('');
  const [updated, setUpdated] = useState(0);
  const [saved, setSaved] = useState<Set<string>>(new Set());

  const save = async (title: string) => {
    if (saved.has(title)) return;
    try {
      await createIdea({ title, source: '行业热点', status: 'pending' });
      setSaved((prev) => new Set(prev).add(title));
    } catch { /* ignore */ }
  };

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    fetchIndustryTrends(persona, 30)
      .then((d) => { setItems(d.industry); setKeywords(d.keywords); setUpdated(d.updated); })
      .catch(() => setError('行业热点拉取失败——请确认已配置外网代理。'))
      .finally(() => setLoading(false));
  }, [persona]);

  useEffect(() => { load(); }, [load]);

  return (
    <>
      <div className="trend-toolbar">
        <div className="trend-keywords">
          {keywords ? (
            <span>画像关键词：<strong>{keywords}</strong></span>
          ) : (
            <span style={{ color: 'var(--text-tertiary)' }}>未配置画像关键词，显示全部行业新闻（建议在画像对标配置中设置关键词）</span>
          )}
        </div>
        <button className="btn btn-sm" onClick={load} disabled={loading}>
          <IconRefresh size={14} /> {loading ? '刷新中…' : '刷新'}
        </button>
      </div>

      {updated > 0 && <div className="trend-updated">{new Date(updated * 1000).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} 更新</div>}

      {error && <div className="notice-error">{error}</div>}

      <div className="card trend-col" style={{ maxWidth: 'none' }}>
        <div className="trend-col-head">行业热点<span className="trend-count">{items.length}</span></div>
        <div className="trend-list">
          {items.length === 0 && !loading && <div className="trend-empty">暂无数据</div>}
          {items.map((it, i) => (
            <div key={i} className="trend-item">
              <span className={`trend-rank ${i < 3 ? 'top' : ''}`}>{i + 1}</span>
              <div className="trend-main">
                <a className="trend-title" href={it.url || undefined} target="_blank" rel="noreferrer"
                  title={it.title}>{it.title}</a>
                {it.hot && <span className="trend-hot">{it.hot}</span>}
              </div>
              <button className="trend-save" title={saved.has(it.title) ? '已收藏' : '收藏到选题库'}
                onClick={() => save(it.title)}>
                {saved.has(it.title) ? <IconCheck size={14} /> : <IconBookmark size={14} />}
              </button>
              <button className="trend-use" title="做成内容"
                onClick={() => onUseTopic(it.title)}>做内容</button>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ── 对标动态 Tab ──────────────────────────────────────────────
function BenchmarksTab({ onUseTopic, persona, onNavigate, onBreakdown }: { onUseTopic: (title: string) => void; persona: string; onNavigate: (page: Page) => void; onBreakdown: (content: string) => void }) {
  const [groups, setGroups] = useState<BenchmarkGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [lastFetch, setLastFetch] = useState(0);
  const [saved, setSaved] = useState<Set<string>>(new Set());

  const save = async (title: string, account: string) => {
    if (saved.has(title)) return;
    try {
      await createIdea({ title, source: `对标:${account}`, status: 'pending' });
      setSaved((prev) => new Set(prev).add(title));
    } catch { /* ignore */ }
  };

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    fetchBenchmarkPosts(persona)
      .then((d) => { setGroups(d.groups); setLastFetch(d.last_fetch); })
      .catch(() => setError('加载对标内容失败'))
      .finally(() => setLoading(false));
  }, [persona]);

  useEffect(() => { load(); }, [load]);

  const handleRefresh = async () => {
    setRefreshing(true);
    setError('');
    try {
      await refreshBenchmarks(persona);
      // 轮询状态
      const poll = async () => {
        try {
          const st = await fetchBenchmarkStatus(persona);
          if (st.state === 'done' || st.state === 'failed' || st.state === 'unknown') {
            setRefreshing(false);
            load();
            return;
          }
        } catch { /* ignore */ }
        setTimeout(poll, 3000);
      };
      setTimeout(poll, 3000);
    } catch (e) {
      setRefreshing(false);
      setError(e instanceof Error ? e.message : '刷新失败');
    }
  };

  const hasConfig = groups.length > 0;

  return (
    <>
      <div className="trend-toolbar">
        <div className="trend-keywords">
          {lastFetch > 0 ? (
            <span>上次抓取：{new Date(lastFetch * 1000).toLocaleString('zh-CN')}</span>
          ) : (
            <span style={{ color: 'var(--text-tertiary)' }}>尚未抓取</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-sm" onClick={() => onNavigate('benchmarks')} title="配置对标账号">
            <IconTarget size={14} /> 配置对标
          </button>
          <button className="btn btn-sm btn-primary" onClick={handleRefresh} disabled={refreshing || !persona}>
            <IconRefresh size={14} /> {refreshing ? '抓取中…' : '抓取最新'}
          </button>
        </div>
      </div>

      {!persona && (
        <div className="notice-error">请先选择画像（画像决定对标账号配置）</div>
      )}
      {persona && !hasConfig && !loading && (
        <div className="empty-state" style={{ height: '50%' }}>
          <div className="empty-icon"><IconTarget size={40} /></div>
          <h3>未配置对标账号</h3>
          <p>在画像页配置对标账号后，这里会展示他们的最新内容。</p>
          <button className="btn btn-primary" onClick={() => onNavigate('benchmarks')}>
            <IconPlus size={15} /> 去配置
          </button>
        </div>
      )}

      {error && <div className="notice-error">{error}</div>}

      <div className="trend-grid">
        {groups.map((g, gi) => (
          <div key={gi} className="card trend-col">
            <div className="trend-col-head">
              {PLATFORM_LABELS[g.platform] || g.platform} · {g.account}
              <span className="trend-count">{g.posts.length}</span>
            </div>
            <div className="trend-list">
              {g.posts.length === 0 && <div className="trend-empty">暂无内容</div>}
              {g.posts.map((p, i) => (
                <div key={i} className="trend-item">
                  <span className={`trend-rank ${i < 3 ? 'top' : ''}`}>{i + 1}</span>
                  <div className="trend-main">
                    <a className="trend-title" href={p.url || undefined} target="_blank" rel="noreferrer"
                      title={p.title}>{p.title}</a>
                    {p.hot && <span className="trend-hot">{p.hot}</span>}
                    {p.snippet && <div className="trend-snippet">{p.snippet}</div>}
                  </div>
                  <button className="trend-save" title={saved.has(p.title) ? '已收藏' : '收藏到选题库'}
                    onClick={() => save(p.title, g.account)}>
                    {saved.has(p.title) ? <IconCheck size={14} /> : <IconBookmark size={14} />}
                  </button>
                  <button className="trend-use" title="一键拆解"
                    onClick={() => onBreakdown(p.title)}>拆解</button>
                  <button className="trend-use" title="做成内容"
                    onClick={() => onUseTopic(p.title)}>做内容</button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
