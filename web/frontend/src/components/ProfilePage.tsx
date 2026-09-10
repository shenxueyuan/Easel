import { useState, useEffect } from 'react';
import { fetchPersonaFiles, savePersonaFile, deletePersona, fetchBenchmarks, saveBenchmarks } from '../lib/api';
import type { PersonaFile, BenchmarkAccount } from '../lib/api';
import { renderMarkdown } from '../lib/sanitize';
import { IconTarget, IconPlus, IconTrash } from './icons';

interface ProfilePageProps {
  persona: string;
  onNewProfile: () => void;
  onDeleted: (name: string) => void;
}

type ProfileTab = 'dimensions' | 'benchmarks';

const DIM_META: Record<string, { label: string; icon: string }> = {
  'identity.md': { label: '身份定位', icon: '🪪' },
  'style.md': { label: '内容风格', icon: '🎨' },
  'audience.md': { label: '目标受众', icon: '👥' },
  'platforms.md': { label: '平台运营', icon: '📱' },
  'preferences.md': { label: '偏好与红线', icon: '⚖️' },
  'memory.md': { label: '经验沉淀', icon: '🧠' },
};

const BENCHMARK_PLATFORMS = [
  { key: 'wechat', label: '公众号' },
  { key: 'zhihu', label: '知乎' },
  { key: 'weibo', label: '微博' },
  { key: 'bilibili', label: 'B站' },
  { key: 'douyin', label: '抖音' },
  { key: 'xiaohongshu', label: '小红书' },
  { key: 'toutiao', label: '头条' },
];

export default function ProfilePage({ persona, onNewProfile, onDeleted }: ProfilePageProps) {
  const [tab, setTab] = useState<ProfileTab>('dimensions');
  const [files, setFiles] = useState<PersonaFile[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [savingFile, setSavingFile] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (!persona) { setFiles([]); return; }
    let ignore = false;
    setLoading(true);
    setError('');
    setEditing(false);
    fetchPersonaFiles(persona)
      .then((d) => {
        if (ignore) return;
        setFiles(d.files);
        setDrafts(Object.fromEntries(d.files.map((f) => [f.filename, f.content])));
      })
      .catch(() => { if (!ignore) setError('加载画像失败'); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [persona]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500); };

  const handleSave = async (filename: string) => {
    setSavingFile(filename);
    try {
      await savePersonaFile(persona, filename, drafts[filename] ?? '');
      setFiles((prev) => prev.map((f) => f.filename === filename ? { ...f, content: drafts[filename] ?? '' } : f));
      showToast(`已保存 ${DIM_META[filename]?.label || filename} ✓`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSavingFile('');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`确定删除画像「${persona}」吗？\n此操作不可恢复，将删除该画像的全部六维文件。`)) return;
    setDeleting(true);
    try {
      await deletePersona(persona);
      onDeleted(persona);
      showToast(`已删除画像「${persona}」`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : '删除失败');
    } finally {
      setDeleting(false);
    }
  };

  if (!persona) {
    return (
      <div className="profile-page">
        <h1 className="page-title">用户画像 Profile</h1>
        <div className="empty-state" style={{ height: '70%' }}>
          <div className="empty-icon">👤</div>
          <h3>还没有选择画像</h3>
          <p>画像沉淀你的定位、风格、受众与红线，生成内容会更贴合你的人设。</p>
          <button className="btn btn-primary" onClick={onNewProfile}>+ 新建画像</button>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <div className="profile-head">
        <div>
          <h1 className="page-title">{persona}</h1>
          <p className="page-subtitle">六个维度构成一个完整人设，可随时编辑保存。</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={`btn ${editing ? 'btn-primary' : ''}`} onClick={() => setEditing((v) => !v)}>
            {editing ? '完成编辑' : '✏️ 编辑资料'}
          </button>
          <button className="btn" style={{ color: 'var(--red)', borderColor: 'var(--red)' }}
            disabled={deleting} onClick={handleDelete}>
            {deleting ? '删除中…' : '🗑 删除画像'}
          </button>
        </div>
      </div>

      {/* Tab 切换 */}
      <div className="profile-tabs">
        <button className={`tab-btn ${tab === 'dimensions' ? 'active' : ''}`} onClick={() => setTab('dimensions')}>
          六维画像
        </button>
        <button className={`tab-btn ${tab === 'benchmarks' ? 'active' : ''}`} onClick={() => setTab('benchmarks')}>
          <IconTarget size={15} /> 对标配置
        </button>
      </div>

      {error && <div style={{ color: 'var(--red)', fontSize: 14, marginTop: 12 }}>{error}</div>}

      {tab === 'dimensions' && (
        loading ? (
          <div className="loading"><div className="spinner" />加载中…</div>
        ) : (
          files.map((f) => {
            const meta = DIM_META[f.filename] || { label: f.filename, icon: '📄' };
            const dirty = editing && (drafts[f.filename] ?? '') !== f.content;
            return (
              <div key={f.filename} className="profile-dim">
                <div className="profile-dim-head">
                  <div className="profile-dim-title">{meta.icon} {meta.label}</div>
                  {editing && (
                    <button className="btn btn-sm btn-primary" disabled={!dirty || savingFile === f.filename}
                      onClick={() => handleSave(f.filename)}>
                      {savingFile === f.filename ? '保存中…' : dirty ? '保存' : '已保存'}
                    </button>
                  )}
                </div>
                {editing ? (
                  <textarea
                    className="field"
                    style={{ minHeight: 150, fontFamily: "'SF Mono','Consolas',monospace", fontSize: 13 }}
                    value={drafts[f.filename] ?? ''}
                    onChange={(e) => setDrafts((p) => ({ ...p, [f.filename]: e.target.value }))}
                  />
                ) : (
                  <div className="card" style={{ padding: '14px 18px' }}>
                    <div className="profile-content"
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(f.content || '_（空）_') }} />
                  </div>
                )}
              </div>
            );
          })
        )
      )}

      {tab === 'benchmarks' && (
        <BenchmarksConfigTab persona={persona} showToast={showToast} />
      )}

      {toast && <div className="toast ok"><span className="toast-icon">✓</span>{toast}</div>}
    </div>
  );
}

// ── 对标配置 Tab ──────────────────────────────────────────────
function BenchmarksConfigTab({ persona, showToast }: { persona: string; showToast: (msg: string) => void }) {
  const [accounts, setAccounts] = useState<BenchmarkAccount[]>([]);
  const [keywords, setKeywords] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchBenchmarks(persona)
      .then((d) => { setAccounts(d.accounts || []); setKeywords(d.keywords || ''); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [persona]);

  const addAccount = () => {
    setAccounts((prev) => [...prev, { platform: 'wechat', name: '', url: '' }]);
  };

  const removeAccount = (idx: number) => {
    setAccounts((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateAccount = (idx: number, field: keyof BenchmarkAccount, value: string) => {
    setAccounts((prev) => prev.map((a, i) => i === idx ? { ...a, [field]: value } : a));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveBenchmarks(persona, accounts.filter((a) => a.name.trim()), keywords);
      showToast('对标配置已保存 ✓');
    } catch (e) {
      showToast(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="loading"><div className="spinner" />加载中…</div>;
  }

  return (
    <div className="benchmarks-config">
      <div className="benchmarks-section">
        <h3 className="benchmarks-section-title">行业关键词</h3>
        <p className="benchmarks-section-desc">用于行业热点过滤，多个关键词用逗号分隔。如：AI开源, 大模型, LLM</p>
        <input className="field" value={keywords} placeholder="AI开源, 大模型, LLM, Hugging Face"
          onChange={(e) => setKeywords(e.target.value)} />
      </div>

      <div className="benchmarks-section">
        <div className="benchmarks-section-head">
          <h3 className="benchmarks-section-title">对标账号</h3>
          <button className="btn btn-sm btn-primary" onClick={addAccount}>
            <IconPlus size={14} /> 添加账号
          </button>
        </div>
        <p className="benchmarks-section-desc">配置要监控的对标账号，支持多平台多账号。抓取后在热点雷达的「对标动态」Tab 查看。</p>

        {accounts.length === 0 && (
          <div className="empty-state" style={{ height: '200px' }}>
            <div className="empty-icon"><IconTarget size={32} /></div>
            <p>还没有添加对标账号</p>
            <button className="btn btn-primary" onClick={addAccount}>
              <IconPlus size={15} /> 添加第一个对标账号
            </button>
          </div>
        )}

        <div className="benchmarks-list">
          {accounts.map((acc, idx) => (
            <div key={idx} className="benchmark-row">
              <select className="field benchmark-platform" value={acc.platform}
                onChange={(e) => updateAccount(idx, 'platform', e.target.value)}>
                {BENCHMARK_PLATFORMS.map((p) => (
                  <option key={p.key} value={p.key}>{p.label}</option>
                ))}
              </select>
              <input className="field benchmark-name" value={acc.name} placeholder="账号名称"
                onChange={(e) => updateAccount(idx, 'name', e.target.value)} />
              <input className="field benchmark-url" value={acc.url} placeholder="主页链接（可选）"
                onChange={(e) => updateAccount(idx, 'url', e.target.value)} />
              <button className="btn btn-sm" style={{ color: 'var(--red)', borderColor: 'var(--red)' }}
                onClick={() => removeAccount(idx)} title="删除">
                <IconTrash size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {accounts.length > 0 && (
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? '保存中…' : '保存对标配置'}
        </button>
      )}
    </div>
  );
}
