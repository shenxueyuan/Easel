import { useState, useEffect, useMemo, useCallback } from 'react';
import { fetchOutputs, mediaUrl } from '../lib/api';
import type { OutputNode, UploadedFile } from '../lib/api';
import { IconOutputs, IconImage, IconVideo, IconMusic, IconFile, IconFolder, IconRefresh, IconSearch } from './icons';

const FILTERS: { key: string; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'image', label: '图片' },
  { key: 'video', label: '视频' },
  { key: 'audio', label: '音频' },
];

function kindIcon(kind: string | undefined, size = 28) {
  if (kind === 'video') return <IconVideo size={size} />;
  if (kind === 'audio') return <IconMusic size={size} />;
  if (kind === 'image') return <IconImage size={size} />;
  return <IconFile size={size} />;
}

/** 按名称路径解析到当前目录的 children */
function resolvePath(roots: OutputNode[], names: string[]): OutputNode[] {
  let nodes = roots;
  for (const nm of names) {
    const found = nodes.find((n) => n.type === 'dir' && n.name === nm);
    if (!found) return nodes;
    nodes = found.children || [];
  }
  return nodes;
}

/** 递归收集所有文件节点 */
function collectFiles(nodes: OutputNode[]): OutputNode[] {
  const files: OutputNode[] = [];
  for (const n of nodes) {
    if (n.type === 'file') files.push(n);
    else if (n.children) files.push(...collectFiles(n.children));
  }
  return files;
}

interface OutputPickerProps {
  onConfirm: (files: UploadedFile[]) => void;
  onClose: () => void;
}

export default function OutputPicker({ onConfirm, onClose }: OutputPickerProps) {
  const [roots, setRoots] = useState<OutputNode[]>([]);
  const [stack, setStack] = useState<string[]>([]);
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetchOutputs().then(setRoots).catch(() => {}).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const currentNodes = useMemo(() => resolvePath(roots, stack), [roots, stack]);
  const dirs = useMemo(
    () => currentNodes.filter((n) => n.type === 'dir').sort((a, b) => (b.mtime || 0) - (a.mtime || 0)),
    [currentNodes]);
  const files = useMemo(() => {
    const fs = currentNodes.filter((n) => n.type === 'file').sort((a, b) => (b.mtime || 0) - (a.mtime || 0));
    return filter === 'all' ? fs : fs.filter((f) => f.kind === filter);
  }, [currentNodes, filter]);

  // 搜索模式：跨所有项目递归搜索文件名
  const searchResults = useMemo(() => {
    if (!search.trim()) return null;
    const all = collectFiles(roots);
    const q = search.toLowerCase();
    const matched = all.filter((f) => f.name.toLowerCase().includes(q));
    return filter === 'all' ? matched : matched.filter((f) => f.kind === filter);
  }, [roots, search, filter]);

  const enterDir = (name: string) => { setStack((s) => [...s, name]); setFilter('all'); };
  const goTo = (depth: number) => { setStack((s) => s.slice(0, depth)); setFilter('all'); };

  const toggleSelect = (f: OutputNode) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(f.path)) next.delete(f.path);
      else next.add(f.path);
      return next;
    });
  };

  const handleConfirm = () => {
    const all = collectFiles(roots);
    const files = all.filter((f) => selected.has(f.path));
    const uploaded: UploadedFile[] = files.map((f) => ({
      id: f.path,
      name: f.name,
      path: f.path,
    }));
    onConfirm(uploaded);
  };

  const renderFileItem = (f: OutputNode) => {
    const isSel = selected.has(f.path);
    return (
      <div key={f.path} className={`picker-item ${isSel ? 'selected' : ''}`} onClick={() => toggleSelect(f)}>
        <div className="picker-item-thumb">
          {f.kind === 'image' ? (
            <img src={mediaUrl(f.path)} alt="" loading="lazy" />
          ) : (
            <div className="picker-item-ph">{kindIcon(f.kind, 24)}</div>
          )}
        </div>
        <div className="picker-item-info">
          <div className="picker-item-name" title={f.name}>{f.name}</div>
          <div className="picker-item-path" title={f.path}>{f.path}</div>
        </div>
        <div className={`picker-item-check ${isSel ? 'on' : ''}`}>{isSel ? '✓' : ''}</div>
      </div>
    );
  };

  const showFiles = searchResults !== null ? searchResults : files;
  const showDirs = searchResults !== null ? [] : dirs;

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" style={{ width: 720, maxWidth: '95vw', maxHeight: '80vh', display: 'flex', flexDirection: 'column', padding: 0 }}
        onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconOutputs size={18} />
            <span style={{ fontWeight: 600, fontSize: 15 }}>从内容库选择素材</span>
            {selected.size > 0 && <span className="badge">{selected.size} 已选</span>}
          </div>
          <button className="icon-btn" onClick={onClose}>×</button>
        </div>

        {/* Search + filter */}
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1 1 200px' }}>
            <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center' }}>
              <IconSearch size={14} />
            </span>
            <input className="input" style={{ width: '100%', paddingLeft: 28 }} placeholder="搜索文件名…"
              value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          {!search && FILTERS.map((f) => (
            <button key={f.key} className={`chip ${filter === f.key ? 'active' : ''}`}
              onClick={() => setFilter(f.key)}>{f.label}</button>
          ))}
          <button className="btn btn-sm" onClick={load} title="刷新"><IconRefresh size={13} /></button>
        </div>

        {/* Breadcrumb */}
        {!search && stack.length > 0 && (
          <div style={{ padding: '8px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, flexWrap: 'wrap' }}>
            <span className="crumb" style={{ cursor: 'pointer', color: 'var(--accent)' }} onClick={() => goTo(0)}>全部项目</span>
            {stack.map((name, i) => (
              <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ color: 'var(--text-tertiary)' }}>/</span>
                {i === stack.length - 1
                  ? <span style={{ color: 'var(--text-secondary)' }}>{name}</span>
                  : <span className="crumb" style={{ cursor: 'pointer', color: 'var(--accent)' }} onClick={() => goTo(i + 1)}>{name}</span>}
              </span>
            ))}
          </div>
        )}

        {/* Body */}
        <div style={{ flex: 1, overflow: 'auto', padding: '12px 20px' }}>
          {loading ? (
            <div className="loading" style={{ padding: 40 }}><div className="spinner" />加载中…</div>
          ) : showDirs.length === 0 && showFiles.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)' }}>
              {search ? '没有匹配的文件' : '此目录下没有文件'}
            </div>
          ) : (
            <>
              {/* Directories */}
              {showDirs.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, marginBottom: 16 }}>
                  {showDirs.map((d) => (
                    <div key={d.path} className="picker-dir" onClick={() => enterDir(d.name)}>
                      <IconFolder size={28} />
                      <div className="picker-dir-name" title={d.name}>{d.name}</div>
                      <div className="picker-dir-count">{d.fileCount ?? 0} 文件</div>
                    </div>
                  ))}
                </div>
              )}
              {/* Files */}
              {showFiles.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
                  {showFiles.map(renderFileItem)}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            {selected.size > 0 ? `已选 ${selected.size} 个文件` : '点击文件选择/取消'}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={onClose}>取消</button>
            <button className="btn btn-primary" onClick={handleConfirm} disabled={selected.size === 0}>
              添加 {selected.size > 0 ? `${selected.size} 个` : ''}素材
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
