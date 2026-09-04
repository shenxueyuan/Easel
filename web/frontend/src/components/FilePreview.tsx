import { useState, useEffect, useCallback, useMemo } from 'react';
import { fetchOutputContent, fetchOutputs, mediaUrl } from '../lib/api';
import type { OutputNode } from '../lib/api';
import { renderMarkdown } from '../lib/sanitize';

/**
 * 从消息文本中提取 outputs/ 下的文件或目录相对路径。
 * 支持反引号包裹和裸路径；目录会在产物树中展开为可预览文件。
 */
function extractOutputPaths(text: string): { files: string[]; directories: string[] } {
  const files: string[] = [];
  const directories: string[] = [];
  const re = /`?outputs\/[^\s`)}\]]+/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const path = match[0]
      .replace(/^`?outputs\//, '')
      .replace(/[，。；;：:,]+$/, '')
      .replace(/\/$/, '');
    if (!path) continue;
    const target = /\.[a-z0-9]{1,8}$/i.test(path) ? files : directories;
    if (!target.includes(path)) target.push(path);
  }
  return { files, directories };
}

const EXT_KIND: Record<string, 'text' | 'image' | 'video' | 'audio' | 'html' | 'pdf' | 'binary'> = {
  '.md': 'text', '.markdown': 'text', '.txt': 'text', '.json': 'text',
  '.srt': 'text', '.vtt': 'text', '.csv': 'text', '.log': 'text',
  '.png': 'image', '.jpg': 'image', '.jpeg': 'image', '.webp': 'image', '.gif': 'image',
  '.mp4': 'video', '.webm': 'video', '.mov': 'video',
  '.mp3': 'audio', '.wav': 'audio', '.m4a': 'audio', '.aac': 'audio', '.flac': 'audio',
  '.html': 'html', '.htm': 'html',
  '.pdf': 'pdf',
};

function extOf(path: string): string {
  const i = path.lastIndexOf('.');
  return i >= 0 ? path.slice(i).toLowerCase() : '';
}

function kindOf(path: string): 'text' | 'image' | 'video' | 'audio' | 'html' | 'pdf' | 'binary' {
  return EXT_KIND[extOf(path)] || 'binary';
}

function fileName(path: string): string {
  const parts = path.split('/');
  return parts[parts.length - 1] || path;
}

function findNode(nodes: OutputNode[], path: string): OutputNode | undefined {
  for (const node of nodes) {
    if (node.path === path) return node;
    const found = node.children && findNode(node.children, path);
    if (found) return found;
  }
  return undefined;
}

function previewFiles(node: OutputNode): string[] {
  const collectFiles = (current: OutputNode): OutputNode[] => current.type === 'file'
    ? [current]
    : (current.children || []).flatMap(collectFiles);
  const direct = (node.children || []).filter((child) => child.type === 'file');
  const candidates = direct.length ? direct : collectFiles(node);
  return candidates
    .filter((child) => ['image', 'video', 'audio', 'html', 'pdf'].includes(kindOf(child.path)))
    .sort((a, b) => {
      const featured = (path: string) => /预览|总览|cover|final|成品/i.test(path) ? 0 : kindOf(path) === 'image' ? 1 : 2;
      return featured(a.path) - featured(b.path) || a.path.localeCompare(b.path, 'zh-CN', { numeric: true });
    })
    .slice(0, 12)
    .map((child) => child.path);
}

/** 单个文件预览卡片 */
function PreviewCard({ path, onQuote }: { path: string; onQuote?: (text: string) => void }) {
  const kind = kindOf(path);
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(['image', 'video', 'audio'].includes(kind));

  const load = useCallback(async () => {
    if (content !== null || loading) return;
    setLoading(true);
    setError('');
    try {
      if (kind === 'text') {
        const r = await fetchOutputContent(path);
        setContent(r.content);
        setExpanded(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [path, kind, content, loading]);

  // 文本/HTML 类自动加载
  useEffect(() => {
    if (kind === 'text') void load();
  }, [kind, load]);

  const icon = kind === 'image' ? '🖼️' : kind === 'video' ? '🎬' : kind === 'audio' ? '🎵'
    : kind === 'html' ? '📄' : kind === 'pdf' ? '📋' : kind === 'text' ? '📝' : '📦';

  const cardStyle: React.CSSProperties = {
    border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden',
    margin: 0, background: 'var(--bg-elev)', minWidth: 0,
  };
  const headStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
    cursor: 'pointer', userSelect: 'none', borderBottom: expanded ? '1px solid var(--border)' : 'none',
    fontSize: 13,
  };
  const nameStyle: React.CSSProperties = { flex: 1, fontWeight: 500, color: 'var(--text)' };
  const actionsStyle: React.CSSProperties = { display: 'flex', gap: 6 };

  return (
    <div style={cardStyle}>
      <div style={headStyle} onClick={() => setExpanded(!expanded)}>
        <span style={{ fontSize: 16 }}>{icon}</span>
        <span style={nameStyle}>{fileName(path)}</span>
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{kind}</span>
        <div style={actionsStyle}>
          <a href={mediaUrl(path)} target="_blank" rel="noreferrer"
            style={{ fontSize: 12, color: 'var(--accent-start)', textDecoration: 'none' }}
            onClick={(e) => e.stopPropagation()}>打开</a>
          {onQuote && kind === 'text' && content && (
            <button style={{ fontSize: 12, background: 'none', border: 'none',
              color: 'var(--accent-start)', cursor: 'pointer' }}
              onClick={(e) => { e.stopPropagation(); onQuote(content); }}>引用</button>
          )}
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            {expanded ? '▼' : '▶'}
          </span>
        </div>
      </div>
      {expanded && (
        <div style={{ padding: kind === 'text' ? '12px' : '0', maxHeight: 500, overflow: 'auto' }}>
          {kind === 'text' && loading && <div style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>加载中…</div>}
          {kind === 'text' && error && <div style={{ color: 'var(--red)', fontSize: 13 }}>{error}</div>}
          {kind === 'text' && content && (
            <div dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }} />
          )}
          {kind === 'image' && (
            <img src={mediaUrl(path)} alt={fileName(path)} style={{ width: '100%', maxHeight: 560, objectFit: 'contain', display: 'block', background: 'var(--surface)' }} />
          )}
          {kind === 'video' && (
            <video src={mediaUrl(path)} controls style={{ width: '100%' }} />
          )}
          {kind === 'audio' && (
            <audio src={mediaUrl(path)} controls style={{ width: '100%' }} />
          )}
          {kind === 'html' && (
            <iframe src={mediaUrl(path)} style={{ width: '100%', height: 400, border: 'none' }}
              title={fileName(path)} />
          )}
          {kind === 'pdf' && (
            <iframe src={mediaUrl(path)} style={{ width: '100%', height: 500, border: 'none' }}
              title={fileName(path)} />
          )}
          {kind === 'binary' && (
            <div style={{ padding: 12, color: 'var(--text-tertiary)', fontSize: 13 }}>
              二进制文件，<a href={mediaUrl(path)} target="_blank" rel="noreferrer">点击下载</a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface FilePreviewProps {
  messageContent: string;
  onQuote?: (text: string) => void;
}

/** 从消息内容中提取文件路径并渲染预览卡片 */
export default function FilePreview({ messageContent, onQuote }: FilePreviewProps) {
  const references = useMemo(() => extractOutputPaths(messageContent), [messageContent]);
  const [paths, setPaths] = useState(references.files);

  useEffect(() => {
    let cancelled = false;
    setPaths(references.files);
    if (!references.directories.length) return () => { cancelled = true; };
    void fetchOutputs().then((tree) => {
      if (cancelled) return;
      const discovered = references.directories.flatMap((directory) => {
        const node = findNode(tree, directory);
        return node ? previewFiles(node) : [];
      });
      setPaths([...new Set([...references.files, ...discovered])]);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [references]);

  if (paths.length === 0) return null;

  return (
    <div className="file-previews">
      {paths.map((p) => (
        <PreviewCard key={p} path={p} onQuote={onQuote} />
      ))}
    </div>
  );
}
