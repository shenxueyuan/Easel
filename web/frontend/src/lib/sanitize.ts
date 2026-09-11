import { marked } from 'marked';
import DOMPurify from 'dompurify';

marked.setOptions({ breaks: true, gfm: true });

function normalizeTables(md: string): string {
  const lines = md.split('\n');
  for (let i = 0; i < lines.length - 1; i += 1) {
    const header = lines[i].trim();
    const next = lines[i + 1].trim();
    if (!header.includes('|') || header.replace(/\|/g, '').trim() === '') continue;
    const columns = header.replace(/^\||\|$/g, '').split('|').length;
    if (columns >= 2 && /^\|\s*\|$/.test(next)) {
      lines[i + 1] = `|${Array.from({ length: columns }, () => '---').join('|')}|`;
      const merged = (lines[i + 2] || '').trim().replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim());
      const separatorPrefix = merged.findIndex((cell) => !/^:?-{3,}:?$/.test(cell));
      if (separatorPrefix === columns - 1 && merged[separatorPrefix]?.startsWith('---')) {
        const row = [merged[separatorPrefix].replace(/^---/, '').trim(), ...merged.slice(separatorPrefix + 1)];
        const numbered = row[0].match(/^(\d+)\s+(.+)$/);
        if (numbered && row.length === columns - 1) row.splice(0, 1, numbered[1], numbered[2]);
        lines[i + 2] = `|${row.join('|')}|`;
      }
    }
  }
  return lines.join('\n');
}

/** 把 markdown 渲染成【已消毒】的 HTML。所有 dangerouslySetInnerHTML 都应走这里，防 XSS。 */
export function renderMarkdown(md: string): string {
  if (!md) return '';
  const raw = marked.parse(normalizeTables(md)) as string;
  const clean = DOMPurify.sanitize(raw, { ADD_ATTR: ['referrerpolicy'] });
  const template = document.createElement('template');
  template.innerHTML = clean;
  template.content.querySelectorAll('img').forEach((image) => {
    image.referrerPolicy = 'no-referrer';
    try {
      const source = new URL(image.src, window.location.origin);
      if (source.hostname === 'hdslb.com' || source.hostname.endsWith('.hdslb.com')) {
        image.src = `/api/image-proxy?url=${encodeURIComponent(source.href)}`;
      }
    } catch { return; }
  });
  return template.innerHTML;
}
