import { useState, useEffect, useCallback } from 'react';
import { fetchOutputContent, mediaUrl } from '../lib/api';
import { renderMarkdown } from '../lib/sanitize';

/**
 * 从消息文本中提取 outputs/ 相对路径。
 * 匹配模式：
 *   - `outputs/xxx/yyy.md`（反引号包裹）
 *   - outputs/xxx/yyy.md（裸路径）
 *   - outputs\\xxx\\yyy.md（Windows 风格，少见）
 */
function extractFilePaths(text: string): string[] {
  const paths: string[] = [];
  // 匹配 `outputs/...` 反引号路径
  const backtickRe = /`outputs\/[^\s`)]+\.\w+/g;
  // 匹配裸 outputs/...路径
  const bareRe = /\boutputs\/[^\s`)]+\.\w+/g;

  for (const re of [backtickRe, bareRe]) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const p = m[0].replace(/^`/, '').replace(/^outputs\//, '');
      if (!paths.includes(p)) paths.push(p);
    }
  }
  return paths;
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

/** 单个文件预览卡片 */
function PreviewCard({ path, onQuote }: { path: string; onQuote?: (text: string) => void }) {
  const kind = kindOf(path);
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(false);

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
    margin: '8px 0', background: 'var(--bg-elev)',
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
            <img src={mediaUrl(path)} alt={fileName(path)} style={{ maxWidth: '100%', display: 'block' }} />
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
  const paths = extractFilePaths(messageContent);
  if (paths.length === 0) return null;

  return (
    <div className="file-previews">
      {paths.map((p) => (
        <PreviewCard key={p} path={p} onQuote={onQuote} />
      ))}
    </div>
  );
}
