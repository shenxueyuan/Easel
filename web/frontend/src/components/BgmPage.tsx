import { useState, useRef, useEffect, useCallback } from 'react';
import { fetchBgmTracks, uploadBgm, updateBgmStyle, deleteBgm } from '../lib/api';
import type { BgmTrack } from '../lib/api';
import { IconMusic, IconTrash, IconRefresh } from './icons';

// 与后端 BGM_STYLES 对齐；接口返回的 styles 会覆盖此兜底
const FALLBACK_STYLES: Record<string, string> = {
  corporate: '企业宣传', ecom: '电商促销', viral: '热门卡点',
  light: '图文轻快', emotional: '情感叙事', tech: '科技数码', other: '其他',
};

export default function BgmPage() {
  const [tracks, setTracks] = useState<BgmTrack[]>([]);
  const [styles, setStyles] = useState<Record<string, string>>(FALLBACK_STYLES);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [filter, setFilter] = useState('');
  const [uploadStyle, setUploadStyle] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetchBgmTracks()
      .then((r) => { setTracks(r.tracks); if (r.styles) setStyles(r.styles); })
      .catch((e) => setMsg(e instanceof Error ? e.message : '加载失败'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleUpload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true); setMsg('');
    try {
      const r = await uploadBgm(file, uploadStyle);
      setMsg(`✓ 已加入曲库：${r.name}${uploadStyle ? `（${styles[uploadStyle] || uploadStyle}）` : ''}`);
      load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '上传失败');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleStyleChange = async (t: BgmTrack, style: string) => {
    try {
      await updateBgmStyle(t.name, style);
      setTracks((prev) => prev.map((x) => x.name === t.name ? { ...x, style } : x));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '风格更新失败');
    }
  };

  const handleDelete = async (t: BgmTrack) => {
    if (!window.confirm(`从曲库删除「${t.name}」？`)) return;
    try {
      await deleteBgm(t.name);
      setTracks((prev) => prev.filter((x) => x.name !== t.name));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '删除失败');
    }
  };

  const shown = filter ? tracks.filter((t) => (t.style || 'unmarked') === filter) : tracks;
  const counts = tracks.reduce<Record<string, number>>((acc, t) => {
    const k = t.style || 'unmarked';
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});

  // 风格对应的代表颜色（卡片顶部装饰条）
  const STYLE_COLORS: Record<string, string> = {
    corporate: '#3b82f6', ecom: '#f59e0b', viral: '#ef4444',
    light: '#22c55e', emotional: '#8b5cf6', tech: '#06b6d4', other: '#94a3b8',
  };

  return (
    <div style={{ paddingTop: 4 }}>
      {/* 页头 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconMusic size={20} /> BGM 曲库
          </h2>
          <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            图文合成视频时按风格自动选曲，同标题固定选同一首 · 上传至 <code>outputs/_shared/bgm/</code>
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input ref={fileRef} type="file" accept=".mp3,.wav,.m4a,.aac,.ogg,.flac"
            style={{ display: 'none' }} onChange={(e) => handleUpload(e.target.files?.[0])} />
          <select className="persona-select" style={{ fontSize: 12, padding: '5px 10px' }}
            value={uploadStyle} onChange={(e) => setUploadStyle(e.target.value)}>
            <option value="">不标风格</option>
            {Object.entries(styles).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <button className="btn btn-primary" disabled={busy} onClick={() => fileRef.current?.click()}>
            {busy ? '上传中…' : '+ 上传音频'}
          </button>
          <button className="btn" onClick={load}><IconRefresh size={14} /></button>
          {msg && <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{msg}</span>}
        </div>
      </div>

      {/* 风格筛选标签 */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        <button className={`chip ${filter === '' ? 'active' : ''}`} onClick={() => setFilter('')}>
          全部 <b>{tracks.length}</b>
        </button>
        {Object.entries(styles).map(([k, v]) => counts[k] ? (
          <button key={k} className={`chip ${filter === k ? 'active' : ''}`}
            onClick={() => setFilter(filter === k ? '' : k)}>
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
              background: STYLE_COLORS[k] || '#94a3b8', marginRight: 5 }} />
            {v} <b>{counts[k]}</b>
          </button>
        ) : null)}
        {counts['unmarked'] ? (
          <button className={`chip ${filter === 'unmarked' ? 'active' : ''}`}
            onClick={() => setFilter(filter === 'unmarked' ? '' : 'unmarked')}>
            未标记 <b>{counts['unmarked']}</b>
          </button>
        ) : null}
      </div>

      {/* 曲目网格 */}
      {loading ? <div className="dash-empty">加载中…</div> : shown.length === 0 ? (
        <div className="dash-empty" style={{ padding: 40 }}>
          {tracks.length === 0
            ? '曲库为空。上传音频文件，或在「对话」页用 ai-music 生成（产物自动入池）。'
            : '该风格下暂无曲目'}
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 16,
        }}>
          {shown.map((t) => {
            const color = STYLE_COLORS[t.style] || '#d1d5db';
            return (
              <div key={t.path} style={{
                border: '1px solid var(--border, #e5e7eb)', borderRadius: 10,
                overflow: 'hidden', background: 'var(--bg-card, #fff)',
                display: 'flex', flexDirection: 'column',
              }}>
                {/* 颜色条 */}
                <div style={{ height: 4, background: color }} />
                {/* 内容 */}
                <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {/* 曲名 + 信息 */}
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 13, overflow: 'hidden',
                      textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.path}>
                      {t.name.replace(/\.[^.]+$/, '')}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3, display: 'flex', gap: 8 }}>
                      <span>{t.source}</span>
                      <span>{(t.size / 1024 / 1024).toFixed(1)} MB</span>
                      {t.style && <span style={{ color }}>{styles[t.style] || t.style}</span>}
                    </div>
                  </div>
                  {/* 播放器 */}
                  <audio src={t.url} controls preload="metadata"
                    style={{ width: '100%', height: 32, borderRadius: 6 }} />
                  {/* 操作行 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <select className="persona-select" style={{ flex: 1, fontSize: 12, padding: '4px 8px' }}
                      value={t.style} onChange={(e) => handleStyleChange(t, e.target.value)}
                      title="风格标记">
                      <option value="">未标记</option>
                      {Object.entries(styles).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    {t.source === '曲库' && (
                      <button className="btn btn-sm btn-ghost" style={{ padding: '4px 8px' }}
                        title="删除" onClick={() => handleDelete(t)}><IconTrash size={14} /></button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
