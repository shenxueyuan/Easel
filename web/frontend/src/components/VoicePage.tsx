import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  fetchVoices, cloneVoice, queryCloneStatus, deleteCloneVoice,
  setDefaultVoice as setDefaultVoiceApi,
  generateDigitalHuman, queryDigitalHumanStatus, mediaUrl,
} from '../lib/api';
import type { VoiceItem } from '../lib/api';
import { IconMic, IconVideo, IconTrash, IconRefresh } from './icons';

type Tab = 'voices' | 'digital-human';

export default function VoicePage() {
  const [tab, setTab] = useState<Tab>('voices');

  // ── 音色管理 ──
  const [voices, setVoices] = useState<VoiceItem[]>([]);
  const [defaultVoice, setDefaultVoice] = useState('longxiaochun_v2');
  const [msg, setMsg] = useState('');
  const [previewingId, setPreviewingId] = useState('');
  const previewRef = useRef<HTMLAudioElement | null>(null);
  // 筛选
  const [searchText, setSearchText] = useState('');
  const [filterScene, setFilterScene] = useState('');
  const [filterLanguage, setFilterLanguage] = useState('');

  // 克隆弹窗
  const [showClone, setShowClone] = useState(false);
  const [cloneName, setCloneName] = useState('');
  const [cloneFile, setCloneFile] = useState<File | null>(null);
  const [cloning, setCloning] = useState(false);
  const [cloneStatus, setCloneStatus] = useState('');
  const cloneFileRef = useRef<HTMLInputElement>(null);

  // ── 数字人管理 ──
  const [dhImageFile, setDhImageFile] = useState<File | null>(null);
  const [dhImagePreview, setDhImagePreview] = useState('');
  const [dhAudioFile, setDhAudioFile] = useState<File | null>(null);
  const [dhAudioName, setDhAudioName] = useState('');
  const [dhPos, setDhPos] = useState('bottom-right');
  const [dhStatus, setDhStatus] = useState('');
  const [dhVideoPath, setDhVideoPath] = useState('');
  const [dhBusy, setDhBusy] = useState(false);
  const dhPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dhImageInputRef = useRef<HTMLInputElement>(null);
  const dhAudioInputRef = useRef<HTMLInputElement>(null);

  const loadVoices = useCallback(() => {
    fetchVoices()
      .then((r) => { setVoices(r.voices); setDefaultVoice(r.default); })
      .catch((e) => setMsg(e instanceof Error ? e.message : '加载失败'));
  }, []);

  const loadMedia = useCallback(() => {
    // 数字人页面不再依赖内容库，保留接口兼容
  }, []);

  useEffect(() => {
    loadVoices();
    return () => { if (dhPollRef.current) clearInterval(dhPollRef.current); };
  }, [loadVoices]);

  // ── 音色预览 ──
  const previewVoice = (voiceId: string) => {
    if (previewingId === voiceId && previewRef.current) {
      previewRef.current.pause();
      setPreviewingId('');
      return;
    }
    if (previewRef.current) previewRef.current.pause();
    const audio = new Audio(`/api/voices/preview/${encodeURIComponent(voiceId)}`);
    audio.onended = () => setPreviewingId('');
    audio.onerror = () => { setMsg('试听生成失败'); setPreviewingId(''); };
    audio.play().catch(() => { setMsg('试听加载中，请稍候重试'); setPreviewingId(''); });
    previewRef.current = audio;
    setPreviewingId(voiceId);
  };

  // ── 声音克隆 ──
  const handleClone = async () => {
    if (!cloneName.trim() || !cloneFile) { setMsg('请填写名称并上传音频'); return; }
    setCloning(true); setCloneStatus('上传中…');
    try {
      const r = await cloneVoice(cloneFile, cloneName.trim());
      setCloneStatus(`克隆中…voice_id=${r.voice_id.slice(0, 20)}…`);
      // 轮询
      const poll = async () => {
        for (let i = 0; i < 20; i++) {
          await new Promise((res) => setTimeout(res, 3000));
          const s = await queryCloneStatus(r.voice_id);
          if (s.status === 'OK') {
            setCloneStatus('✅ 克隆成功');
            loadVoices();
            setTimeout(() => { setShowClone(false); setCloneName(''); setCloneFile(null); setCloneStatus(''); }, 1500);
            return;
          }
          if (s.status === 'error' || s.status === 'UNDEPLOYED') {
            setCloneStatus(`❌ 克隆失败: ${s.message || s.status}`);
            return;
          }
          setCloneStatus(`状态: ${s.status}…（${i + 1}/20）`);
        }
        setCloneStatus('⏳ 仍在部署中，稍后刷新');
      };
      poll();
    } catch (e) {
      setCloneStatus(`❌ ${e instanceof Error ? e.message : '克隆失败'}`);
    } finally { setCloning(false); }
  };

  const handleDeleteVoice = async (voiceId: string) => {
    if (!window.confirm('确定删除该克隆音色？')) return;
    try {
      await deleteCloneVoice(voiceId);
      setVoices((v) => v.filter((x) => x.voice_id !== voiceId));
      setMsg('已删除');
      setTimeout(() => setMsg(''), 2000);
    } catch { setMsg('删除失败'); }
  };

  // ── 设为默认音色 ──
  const handleSetDefault = async (voiceId: string) => {
    try {
      await setDefaultVoiceApi(voiceId);
      setDefaultVoice(voiceId);
      setMsg('✅ 已设为默认音色，视频生成将使用此音色');
      setTimeout(() => setMsg(''), 3000);
    } catch (e) {
      setMsg(`设置失败: ${e instanceof Error ? e.message : '未知错误'}`);
    }
  };

  // ── 数字人生成 ──
  const handleDigitalHuman = async () => {
    if (!dhImageFile) { setMsg('请上传人像照片'); return; }
    if (!dhAudioFile) { setMsg('请上传音频文件（数字人需要音频驱动）'); return; }
    setDhBusy(true); setDhStatus('提交中…'); setDhVideoPath('');
    try {
      const r = await generateDigitalHuman(dhImageFile, dhAudioFile, dhPos);
      setDhStatus(`任务已提交，等待 EMO 生成…（task_id=${r.task_id.slice(0, 12)}…）`);
      // 轮询
      let count = 0;
      dhPollRef.current = setInterval(async () => {
        count++;
        try {
          const s = await queryDigitalHumanStatus(r.task_key);
          if (s.status === 'SUCCEEDED' && s.video_path) {
            setDhStatus('✅ 数字人视频已生成');
            setDhVideoPath(s.video_path);
            setDhBusy(false);
            if (dhPollRef.current) clearInterval(dhPollRef.current);
          } else if (s.status === 'FAILED' || s.status === 'CANCELED' || s.status === 'error') {
            setDhStatus(`❌ 生成失败: ${s.message || s.status}`);
            setDhBusy(false);
            if (dhPollRef.current) clearInterval(dhPollRef.current);
          } else {
            setDhStatus(`状态: ${s.status}…（已等待 ${count * 15}s）`);
          }
        } catch {
          setDhStatus(`查询失败（${count * 15}s）`);
        }
        if (count > 40) {
          setDhStatus('⏳ 超时（>10min），任务仍在后台运行');
          setDhBusy(false);
          if (dhPollRef.current) clearInterval(dhPollRef.current);
        }
      }, 15000);
    } catch (e) {
      setDhStatus(`❌ ${e instanceof Error ? e.message : '提交失败'}`);
      setDhBusy(false);
    }
  };

  // 选择图片后生成预览
  const onPickImage = (file: File | null) => {
    setDhImageFile(file);
    if (file) {
      const reader = new FileReader();
      reader.onload = () => setDhImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setDhImagePreview('');
    }
  };

  const systemVoices = voices.filter((v) => v.type === 'system');
  const cloneVoices = voices.filter((v) => v.type === 'clone');

  // 筛选后的系统音色分组（useMemo 避免每次渲染重复计算）
  const systemVoiceGroups = useMemo(() => {
    const filtered = systemVoices.filter((v) => {
      if (filterScene && v.scene !== filterScene) return false;
      if (filterLanguage && v.language !== filterLanguage) return false;
      if (searchText) {
        const q = searchText.toLowerCase();
        if (!v.name.toLowerCase().includes(q) &&
            !(v.trait || '').toLowerCase().includes(q) &&
            !v.voice_id.toLowerCase().includes(q)) return false;
      }
      return true;
    });
    const groups: Record<string, VoiceItem[]> = {};
    for (const v of filtered) {
      const scene = v.scene || '其他';
      if (!groups[scene]) groups[scene] = [];
      groups[scene].push(v);
    }
    return { filtered, groups };
  }, [systemVoices, filterScene, filterLanguage, searchText]);

  return (
    <div className="page-scroll" style={{ padding: '24px 28px' }}>
      {/* 页头 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconMic size={20} /> 配音 & 数字人
          </h2>
          <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            管理口播音色（系统音色 + 克隆音色）和数字人形象 · 发布视频时在此选择
          </p>
        </div>
        <button className="btn" onClick={() => { loadVoices(); loadMedia(); }}>
          <IconRefresh size={14} /> 刷新
        </button>
      </div>

      {/* Tab 切换 */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)' }}>
        <button className={`btn btn-sm ${tab === 'voices' ? 'btn-primary' : 'btn-ghost'}`}
          style={{ borderRadius: '6px 6px 0 0', borderBottom: tab === 'voices' ? '2px solid var(--accent)' : 'none' }}
          onClick={() => setTab('voices')}>
          <IconMic size={14} /> 音色管理
        </button>
        <button className={`btn btn-sm ${tab === 'digital-human' ? 'btn-primary' : 'btn-ghost'}`}
          style={{ borderRadius: '6px 6px 0 0', borderBottom: tab === 'digital-human' ? '2px solid var(--accent)' : 'none' }}
          onClick={() => setTab('digital-human')}>
          <IconVideo size={14} /> 数字人管理
        </button>
      </div>

      {msg && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>{msg}</div>}

      {/* ── 音色管理 Tab ── */}
      {tab === 'voices' && (
        <>
          {/* 克隆入口 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              系统音色 {systemVoices.length} 个 · 克隆音色 {cloneVoices.length} 个 · 默认：{voices.find((v) => v.voice_id === defaultVoice)?.name || defaultVoice}
            </div>
            <button className="btn btn-primary" onClick={() => setShowClone((v) => !v)}>
              🎙 克隆声音
            </button>
          </div>

          {/* 筛选栏 */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
            <input className="input" style={{ maxWidth: 220 }} placeholder="🔍 搜索音色名称/特质/voice_id"
              value={searchText} onChange={(e) => setSearchText(e.target.value)} />
            <select className="input" style={{ maxWidth: 160 }} value={filterScene} onChange={(e) => setFilterScene(e.target.value)}>
              <option value="">全部场景</option>
              {[...new Set(systemVoices.map((v) => v.scene).filter(Boolean))].sort().map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select className="input" style={{ maxWidth: 160 }} value={filterLanguage} onChange={(e) => setFilterLanguage(e.target.value)}>
              <option value="">全部语言</option>
              {[...new Set(systemVoices.map((v) => v.language).filter(Boolean))].sort().map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
            {(searchText || filterScene || filterLanguage) && (
              <button className="btn btn-sm" onClick={() => { setSearchText(''); setFilterScene(''); setFilterLanguage(''); }}>
                清除筛选
              </button>
            )}
          </div>

          {/* 克隆弹窗 */}
          {showClone && (
            <div className="dash-section" style={{ marginBottom: 20, padding: 16, border: '1px solid var(--border)', borderRadius: 10 }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>🎙 声音克隆（百炼 CosyVoice，免费）</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
                上传 10-20 秒清晰人声音频（WAV/MP3/M4A，≤10MB），系统自动克隆声纹生成专属音色。
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <input className="input" style={{ maxWidth: 200 }} placeholder='音色名称（如"我的声音"）'
                  value={cloneName} onChange={(e) => setCloneName(e.target.value)} />
                <input ref={cloneFileRef} type="file" accept=".wav,.mp3,.m4a" style={{ display: 'none' }}
                  onChange={(e) => setCloneFile(e.target.files?.[0] || null)} />
                <button className="btn" onClick={() => cloneFileRef.current?.click()}>
                  {cloneFile ? cloneFile.name.slice(0, 20) : '选择音频'}
                </button>
                <button className="btn btn-primary" onClick={handleClone} disabled={cloning || !cloneName.trim() || !cloneFile}>
                  {cloning ? '克隆中…' : '开始克隆'}
                </button>
                <button className="btn" onClick={() => { setShowClone(false); setCloneStatus(''); setCloneName(''); setCloneFile(null); }}>取消</button>
              </div>
              {cloneStatus && <div style={{ marginTop: 10, fontSize: 13 }}>{cloneStatus}</div>}
            </div>
          )}

          {/* 特性说明 */}
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.7, padding: 10, background: 'var(--bg-hover)', borderRadius: 6, marginBottom: 16 }}>
            <strong>特性说明：</strong>
            <span style={{ marginLeft: 8, color: 'var(--text-secondary)' }}>SSML</span> = 语音合成标记语言（控制停顿、语速、发音等）；
            <span style={{ marginLeft: 8, color: 'var(--text-secondary)' }}>Instruct</span> = 自然语言指令控制情感/风格；
            <span style={{ marginLeft: 8, color: 'var(--text-secondary)' }}>时间戳</span> = 返回每个词的时间戳（用于字幕对齐）
          </div>

          {/* 克隆音色列表（置顶显示）*/}
          {cloneVoices.length > 0 && (
            <>
              <h3 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 8px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ padding: '2px 8px', background: 'var(--bg-hover)', borderRadius: 4 }}>克隆音色</span>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{cloneVoices.length} 个</span>
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 10, marginBottom: 20 }}>
                {cloneVoices.map((v) => (
                  <div key={v.voice_id} style={{
                    border: v.voice_id === defaultVoice
                      ? '2px solid var(--accent)'
                      : '1px solid var(--border)',
                    borderRadius: 8, padding: 12,
                    background: v.voice_id === defaultVoice ? 'rgba(99,102,241,0.06)' : 'var(--bg-card)',
                    boxShadow: v.voice_id === defaultVoice ? '0 0 0 3px rgba(99,102,241,0.15)' : 'none',
                    position: 'relative',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{v.name}</span>
                      {v.voice_id === defaultVoice && (
                        <span style={{ fontSize: 10, color: '#fff', padding: '1px 6px', background: 'var(--accent)', borderRadius: 3 }}>默认</span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'monospace', marginBottom: 4 }}>
                      voice: {v.voice_id.slice(0, 30)}…
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
                      {v.desc || '自定义克隆音色'}
                    </div>
                    <div style={{ marginBottom: 8 }}>
                      <span style={{
                        fontSize: 11, padding: '2px 8px', borderRadius: 4,
                        background: v.status === 'OK' ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)',
                        color: v.status === 'OK' ? '#22c55e' : '#f59e0b',
                      }}>
                        {v.status === 'OK' ? '✅ 可用' : v.status || '部署中'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-sm" onClick={() => previewVoice(v.voice_id)} disabled={v.status !== 'OK'}>
                        {previewingId === v.voice_id ? '⏫ 停止' : '▶ 试听'}
                      </button>
                      {v.voice_id !== defaultVoice && v.status === 'OK' && (
                        <button className="btn btn-sm btn-ghost" onClick={() => handleSetDefault(v.voice_id)} title="设为默认音色">
                          ★ 设为默认
                        </button>
                      )}
                      <button className="btn btn-sm btn-ghost" onClick={() => handleDeleteVoice(v.voice_id)} title="删除">
                        <IconTrash size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* 系统音色 - 按场景分组（应用筛选）*/}
          {systemVoiceGroups.filtered.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text-tertiary)', padding: 20, textAlign: 'center' }}>没有匹配的音色</div>
          ) : (
            Object.entries(systemVoiceGroups.groups).map(([scene, items]) => (
              <div key={scene} style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 8px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ padding: '2px 8px', background: 'var(--bg-hover)', borderRadius: 4 }}>{scene}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{items.length} 个</span>
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 10 }}>
                  {items.map((v) => (
                    <div key={v.voice_id} style={{
                      border: v.voice_id === defaultVoice
                        ? '2px solid var(--accent)'
                        : '1px solid var(--border)',
                      borderRadius: 8, padding: 12,
                      background: v.voice_id === defaultVoice ? 'rgba(99,102,241,0.06)' : 'var(--bg-card)',
                      boxShadow: v.voice_id === defaultVoice ? '0 0 0 3px rgba(99,102,241,0.15)' : 'none',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        <span style={{ fontWeight: 600, fontSize: 14 }}>{v.name}</span>
                        {v.voice_id === defaultVoice && (
                          <span style={{ fontSize: 10, color: '#fff', padding: '1px 6px', background: 'var(--accent)', borderRadius: 3 }}>默认</span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'monospace', marginBottom: 4 }}>
                        voice: {v.voice_id}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                        特质：{v.trait}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 8 }}>
                        语言：{v.language}
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
                        <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 3,
                          background: v.ssml === '支持' ? 'rgba(34,197,94,0.12)' : 'rgba(100,116,139,0.12)',
                          color: v.ssml === '支持' ? '#22c55e' : 'var(--text-tertiary)' }}>
                          SSML {v.ssml === '支持' ? '✓' : '✗'}
                        </span>
                        <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 3,
                          background: v.instruct === '支持' ? 'rgba(34,197,94,0.12)' : 'rgba(100,116,139,0.12)',
                          color: v.instruct === '支持' ? '#22c55e' : 'var(--text-tertiary)' }}>
                          Instruct {v.instruct === '支持' ? '✓' : '✗'}
                        </span>
                        <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 3,
                          background: v.timestamp === '支持' ? 'rgba(34,197,94,0.12)' : 'rgba(100,116,139,0.12)',
                          color: v.timestamp === '支持' ? '#22c55e' : 'var(--text-tertiary)' }}>
                          时间戳 {v.timestamp === '支持' ? '✓' : '✗'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-sm" onClick={() => previewVoice(v.voice_id)}>
                          {previewingId === v.voice_id ? '⏸ 停止' : '▶ 试听'}
                        </button>
                        {v.voice_id !== defaultVoice && (
                          <button className="btn btn-sm btn-ghost" onClick={() => handleSetDefault(v.voice_id)} title="设为默认音色">
                            ★ 设为默认
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </>
      )}

      {/* ── 数字人管理 Tab ── */}
      {tab === 'digital-human' && (
        <>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
            上传人像照片 + 音频 → 百炼 EMO 生成说话视频 · 0.08 元/秒，1800 秒免费额度
          </div>

          {/* 数字人生成表单 */}
          <div className="dash-section" style={{ padding: 16, border: '1px solid var(--border)', borderRadius: 10, marginBottom: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              {/* 图片上传 */}
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>人像照片（本地文件）</label>
                <input ref={dhImageInputRef} type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={(e) => onPickImage(e.target.files?.[0] || null)} />
                <button className="btn" style={{ width: '100%' }} onClick={() => dhImageInputRef.current?.click()}>
                  {dhImageFile ? dhImageFile.name.slice(0, 24) : '选择人像照片…'}
                </button>
                {dhImagePreview && (
                  <div style={{ marginTop: 8, textAlign: 'center' }}>
                    <img src={dhImagePreview} alt="人像预览" style={{
                      maxWidth: '100%', maxHeight: 200, borderRadius: 8, objectFit: 'cover',
                      border: '1px solid var(--border)',
                    }} />
                  </div>
                )}
              </div>
              {/* 音频上传 */}
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>音频文件（本地文件）</label>
                <input ref={dhAudioInputRef} type="file" accept="audio/*,.mp3,.wav,.m4a" style={{ display: 'none' }}
                  onChange={(e) => { setDhAudioFile(e.target.files?.[0] || null); setDhAudioName(e.target.files?.[0]?.name || ''); }} />
                <button className="btn" style={{ width: '100%' }} onClick={() => dhAudioInputRef.current?.click()}>
                  {dhAudioName ? dhAudioName.slice(0, 24) : '选择音频文件…'}
                </button>
                {dhAudioFile && (
                  <div style={{ marginTop: 8 }}>
                    <audio src={URL.createObjectURL(dhAudioFile)} controls style={{ width: '100%', height: 36 }} />
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              {/* 位置选择 */}
              <div style={{ flex: '0 0 160px' }}>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>叠加位置</label>
                <select className="input" style={{ width: '100%' }} value={dhPos} onChange={(e) => setDhPos(e.target.value)}>
                  <option value="bottom-right">右下角</option>
                  <option value="bottom-left">左下角</option>
                  <option value="top-right">右上角</option>
                  <option value="top-left">左上角</option>
                </select>
              </div>
              {/* 生成按钮 */}
              <div>
                <button className="btn btn-primary" onClick={handleDigitalHuman} disabled={dhBusy || !dhImageFile || !dhAudioFile}>
                  {dhBusy ? '生成中…' : '生成数字人'}
                </button>
              </div>
            </div>

            {/* 状态 */}
            {dhStatus && (
              <div style={{ marginTop: 12, fontSize: 13, padding: 10, borderRadius: 6,
                background: 'var(--bg-hover)', }}>
                {dhStatus}
              </div>
            )}

            {/* 生成结果预览 */}
            {dhVideoPath && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>🎬 数字人视频预览</div>
                <video src={mediaUrl(dhVideoPath)} controls autoPlay loop style={{ width: '100%', maxWidth: 480, borderRadius: 8, border: '1px solid var(--border)' }} />
                <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-tertiary)' }}>
                  视频路径：{dhVideoPath}
                </div>
              </div>
            )}
          </div>

          {/* 说明 */}
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.8, padding: 12, background: 'var(--bg-hover)', borderRadius: 8 }}>
            <strong>使用说明：</strong><br />
            1. 数字人基于百炼悦动人像 EMO，输入人像照片 + 音频生成说话视频<br />
            2. 人像照片要求：清晰正面照，五官端正，分辨率 ≥ 512×512，支持 JPG/PNG<br />
            3. 音频要求：清晰人声，10 秒以上，支持 MP3/WAV/M4A<br />
            4. 生成是异步任务，通常需要 1-3 分钟<br />
            5. 生成完成后可在上方预览，发布视频时会自动叠加到所选位置<br />
            6. 免费额度 1800 秒（约 90 条 20 秒视频），超出后 0.08 元/秒<br />
            7. 在发布中心选择数字人后，视频生成时会自动调用 EMO 并 overlay
          </div>
        </>
      )}
    </div>
  );
}
