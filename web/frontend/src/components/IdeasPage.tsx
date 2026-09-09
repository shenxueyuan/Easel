import { useState, useEffect, useCallback, useMemo } from 'react';
import { fetchIdeas, createIdea, updateIdea, deleteIdea, createSchedule } from '../lib/api';
import type { Idea, IdeaInput } from '../lib/api';
import { renderMarkdown } from '../lib/sanitize';
import { IconIdea, IconEdit, IconTrash, IconChat, IconCalendar, IconChevron } from './icons';

interface IdeasPageProps {
  onUseTopic: (title: string) => void;
}

const COLUMNS: { key: string; label: string; color: string }[] = [
  { key: 'pending', label: '待做', color: 'var(--text-tertiary)' },
  { key: 'doing', label: '进行中', color: 'var(--layer-attribute)' },
  { key: 'done', label: '已完成', color: 'var(--layer-publish)' },
];
const NEXT: Record<string, string> = { pending: 'doing', doing: 'done', done: 'pending' };
const EMPTY: IdeaInput = { title: '', note: '', source: '', status: 'pending' };

export default function IdeasPage({ onUseTopic }: IdeasPageProps) {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [form, setForm] = useState<IdeaInput | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<Idea | null>(null);
  const [toast, setToast] = useState('');

  const load = useCallback(() => { fetchIdeas().then(setIdeas).catch(() => {}); }, []);
  useEffect(() => { load(); }, [load]);

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2200); };
  const byStatus = useMemo(() => {
    const g: Record<string, Idea[]> = { pending: [], doing: [], done: [] };
    for (const it of ideas) (g[it.status] || g.pending).push(it);
    return g;
  }, [ideas]);

  const closeDetail = () => { setViewing(null); setForm(null); setEditId(null); };
  const openNew = () => { setViewing(null); setEditId(null); setForm({ ...EMPTY }); };
  const openView = (it: Idea) => { setForm(null); setEditId(null); setViewing(it); };
  const openEdit = (it: Idea) => {
    setViewing(it);
    setEditId(it.id);
    setForm({ title: it.title, note: it.note, source: it.source, status: it.status });
  };
  const save = async () => {
    if (!form || !form.title.trim()) return;
    if (editId) await updateIdea(editId, form); else await createIdea(form);
    closeDetail();
    load();
  };
  const advance = async (it: Idea) => { await updateIdea(it.id, { ...it, status: NEXT[it.status] }); load(); };
  const remove = async (it: Idea) => {
    if (!window.confirm(`确定删除选题「${it.title}」？`)) return;
    await deleteIdea(it.id);
    if (viewing?.id === it.id) closeDetail();
    load();
  };
  const schedule = async (it: Idea) => {
    const d = new Date();
    await createSchedule({ title: it.title, date: d.toISOString().slice(0, 10), platform: '', time: '', status: 'idea', note: it.note });
    showToast('已加入日历（今天）');
  };

  if (form) {
    return (
      <div className="page-scroll idea-detail-page">
        <div className="idea-detail-head">
          <button className="btn btn-sm" onClick={closeDetail}>← 返回选题库</button>
          <div className="idea-detail-head-actions">
            <button className="btn btn-sm" onClick={closeDetail}>取消</button>
            <button className="btn btn-sm btn-primary" onClick={save} disabled={!form.title.trim()}>保存选题</button>
          </div>
        </div>
        <div className="idea-editor-shell">
          <div className="idea-editor-title-row">
            <div>
              <span className="idea-detail-kicker">{editId ? '编辑选题' : '新建选题'}</span>
              <h1 className="idea-detail-page-title">{editId ? '完善选题内容' : '记录一个新灵感'}</h1>
            </div>
          </div>
          <label className="field-label">选题 *</label>
          <textarea className="field idea-title-input" value={form.title} autoFocus placeholder="想做的内容 / 角度"
            onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <div className="idea-editor-meta">
            <div>
              <label className="field-label">来源</label>
              <input className="field" value={form.source} placeholder="如：微博热搜 / 灵感"
                onChange={(e) => setForm({ ...form, source: e.target.value })} />
            </div>
            <div>
              <label className="field-label">状态</label>
              <div className="idea-status-picker">
                {COLUMNS.map((c) => (
                  <button key={c.key} className={`chip ${form.status === c.key ? 'active' : ''}`}
                    onClick={() => setForm({ ...form, status: c.key })}>{c.label}</button>
                ))}
              </div>
            </div>
          </div>
          <label className="field-label">备注 / 角度 / 拆解内容</label>
          <textarea className="field idea-note-editor" value={form.note}
            placeholder="记录完整思路、内容结构、数据依据、可复用模板……支持 Markdown"
            onChange={(e) => setForm({ ...form, note: e.target.value })} />
          <div className="idea-editor-bottom">
            <span>内容会完整保存，可随时回来继续编辑。</span>
            <div className="idea-detail-head-actions">
              <button className="btn btn-sm" onClick={closeDetail}>取消</button>
              <button className="btn btn-sm btn-primary" onClick={save} disabled={!form.title.trim()}>保存选题</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (viewing) {
    const status = COLUMNS.find((c) => c.key === viewing.status);
    return (
      <div className="page-scroll idea-detail-page">
        <div className="idea-detail-head">
          <button className="btn btn-sm" onClick={closeDetail}>← 返回选题库</button>
          <div className="idea-detail-head-actions">
            <button className="btn btn-sm" onClick={() => schedule(viewing)}><IconCalendar size={14} /> 排期</button>
            <button className="btn btn-sm" onClick={() => onUseTopic(viewing.title)}><IconChat size={14} /> 做内容</button>
            <button className="btn btn-sm btn-primary" onClick={() => openEdit(viewing)}><IconEdit size={14} /> 编辑</button>
          </div>
        </div>
        <article className="idea-view-shell">
          <span className="idea-detail-kicker">选题详情</span>
          <h1 className="idea-view-title">{viewing.title}</h1>
          <div className="idea-view-meta">
            <span className="badge"><span className="kanban-dot" style={{ background: status?.color }} />{status?.label || '待做'}</span>
            {viewing.source && <span className="badge">来源：{viewing.source}</span>}
          </div>
          <div className="idea-view-divider" />
          {viewing.note ? (
            <div className="markdown-body idea-view-content" dangerouslySetInnerHTML={{ __html: renderMarkdown(viewing.note) }} />
          ) : (
            <div className="idea-view-empty">还没有备注或拆解内容，点击「编辑」补充。</div>
          )}
          <div className="idea-view-footer">
            <button className="btn btn-sm btn-ghost" onClick={() => remove(viewing)}><IconTrash size={14} /> 删除选题</button>
            <button className="btn btn-sm btn-primary" onClick={() => openEdit(viewing)}><IconEdit size={14} /> 编辑完整内容</button>
          </div>
        </article>
        {toast && <div className="toast ok"><span className="toast-icon">✓</span>{toast}</div>}
      </div>
    );
  }

  return (
    <div className="page-scroll ideas-page">
      <div className="page-head">
        <div>
          <h1 className="page-title"><IconIdea size={21} /> 选题库</h1>
          <p className="page-subtitle">攒住每一个灵感——点击卡片进入大页面查看完整内容，或继续编辑和推进。</p>
        </div>
        <button className="btn btn-sm btn-primary" onClick={openNew}>+ 新建选题</button>
      </div>

      <div className="kanban">
        {COLUMNS.map((col) => (
          <div key={col.key} className="kanban-col">
            <div className="kanban-col-head">
              <span className="kanban-dot" style={{ background: col.color }} />
              {col.label}<span className="kanban-count">{byStatus[col.key].length}</span>
            </div>
            <div className="kanban-list">
              {byStatus[col.key].length === 0 && <div className="kanban-empty">拖点选题进来吧</div>}
              {byStatus[col.key].map((it) => (
                <div key={it.id} className="card idea-card idea-card-clickable" role="button" tabIndex={0}
                  onClick={() => openView(it)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openView(it); }}>
                  <div className="idea-card-actions">
                    <button className="session-act" title="编辑" onClick={(e) => { e.stopPropagation(); openEdit(it); }}><IconEdit size={13} /></button>
                    <button className="session-act danger" title="删除" onClick={(e) => { e.stopPropagation(); remove(it); }}><IconTrash size={13} /></button>
                  </div>
                  <div className="idea-title">{it.title}</div>
                  {it.source && <span className="badge" style={{ marginTop: 6 }}>{it.source}</span>}
                  {it.note && <div className="idea-note">{it.note}</div>}
                  <div className="idea-foot">
                    <button className="idea-act" onClick={(e) => { e.stopPropagation(); onUseTopic(it.title); }}><IconChat size={13} /> 做内容</button>
                    <button className="idea-act" onClick={(e) => { e.stopPropagation(); schedule(it); }}><IconCalendar size={13} /> 排期</button>
                    <button className="idea-act next" onClick={(e) => { e.stopPropagation(); advance(it); }} title="推进状态">
                      {COLUMNS.find((c) => c.key === NEXT[it.status])?.label} <IconChevron size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {toast && <div className="toast ok"><span className="toast-icon">✓</span>{toast}</div>}
    </div>
  );
}
