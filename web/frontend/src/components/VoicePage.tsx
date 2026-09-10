import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  fetchVoices, cloneVoice, queryCloneStatus, deleteCloneVoice,
  setDefaultVoice as setDefaultVoiceApi, setTtsEngine,
  generateDigitalHuman, queryDigitalHumanStatus, mediaUrl,
  fetchDhCharacters, createDhCharacter, deleteDhCharacter,
} from '../lib/api';
import type { VoiceItem, DhCharacter } from '../lib/api';
import { IconMic, IconVideo, IconTrash, IconRefresh } from './icons';

type Tab = 'voices' | 'digital-human';
type TtsEngine = 'cosyvoice' | 'qwen-tts';

export default function VoicePage() {
  const [tab, setTab] = useState<Tab>('voices');

  // ── 音色管理 ──
  const [voices, setVoices] = useState<VoiceItem[]>([]);
  const [defaultVoice, setDefaultVoice] = useState('longxiaochun_v2');
  const [ttsEngine, setTtsEngineState] = useState<TtsEngine>('cosyvoice');
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
  const [dhCharacters, setDhCharacters] = useState<DhCharacter[]>([]);
  const [selectedCharId, setSelectedCharId] = useState('');  // 选中的角色 ID
  const [showAddChar, setShowAddChar] = useState(false);
  const [newCharName, setNewCharName] = useState('');
  const [newCharDesc, setNewCharDesc] = useState('');
  const [newCharFile, setNewCharFile] = useState<File | null>(null);
  const [newCharPreview, setNewCharPreview] = useState('');
  const [charBusy, setCharBusy] = useState(false);
  const newCharFileRef = useRef<HTMLInputElement>(null);

  const [dhAudioFile, setDhAudioFile] = useState<File | null>(null);
  const [dhAudioName, setDhAudioName] = useState('');
  const [dhPos, setDhPos] = useState('bottom-right');
  const [dhStyleLevel, setDhStyleLevel] = useState<'normal' | 'calm' | 'active'>('normal');
  const [dhStatus, setDhStatus] = useState('');
  const [dhVideoPath, setDhVideoPath] = useState('');
  const [dhBusy, setDhBusy] = useState(false);
  const dhPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dhAudioInputRef = useRef<HTMLInputElement>(null);

  const loadVoices = useCallback(() => {
    fetchVoices()
      .then((r) => {
        setVoices(r.voices);
        setDefaultVoice(r.default);
        if (r.engine === 'qwen-tts' || r.engine === 'cosyvoice') {
          setTtsEngineState(r.engine as TtsEngine);
        }
      })
      .catch((e) => setMsg(e instanceof Error ? e.message : '加载失败'));
  }, []);

  const loadMedia = useCallback(() => {
    // 数字人页面不再依赖内容库，保留接口兼容
  }, []);

  const loadDhCharacters = useCallback(() => {
    fetchDhCharacters()
      .then((r) => setDhCharacters(r.characters))
      .catch(() => setDhCharacters([]));
  }, []);

  useEffect(() => {
    loadVoices();
    loadDhCharacters();
    return () => { if (dhPollRef.current) clearInterval(dhPollRef.current); };
  }, [loadVoices, loadDhCharacters]);

  // ── 数字人角色 CRUD ──
  const handleCreateChar = async () => {
    if (!newCharName.trim() || !newCharFile) { setMsg('请填写名称并上传照片'); return; }
    setCharBusy(true);
    try {
      await createDhCharacter(newCharName.trim(), newCharFile, newCharDesc.trim());
      setMsg('✅ 角色创建成功');
      setShowAddChar(false); setNewCharName(''); setNewCharDesc(''); setNewCharFile(null); setNewCharPreview('');
      loadDhCharacters();
      setTimeout(() => setMsg(''), 2000);
    } catch (e) {
      setMsg(`创建失败: ${e instanceof Error ? e.message : '未知错误'}`);
    } finally { setCharBusy(false); }
  };

  const handleDeleteChar = async (id: string, name: string) => {
    if (!window.confirm(`确定删除数字人角色「${name}」？`)) return;
    try {
      await deleteDhCharacter(id);
      setDhCharacters((cs) => cs.filter((c) => c.id !== id));
      if (selectedCharId === id) setSelectedCharId('');
      setMsg('已删除');
      setTimeout(() => setMsg(''), 2000);
    } catch { setMsg('删除失败'); }
  };

  const onPickCharPhoto = (file: File | null) => {
    setNewCharFile(file);
    if (file) {
      const reader = new FileReader();
      reader.onload = () => setNewCharPreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setNewCharPreview('');
    }
  };

  // ── 切换 TTS 引擎 ──
  const handleSwitchEngine = async (engine: TtsEngine) => {
    if (engine === ttsEngine) return;
    try {
      setMsg(`切换 TTS 引擎到 ${engine === 'qwen-tts' ? 'Qwen-TTS' : 'CosyVoice'}…`);
      const r = await setTtsEngine(engine);
      setTtsEngineState(engine);
      setDefaultVoice(r.default);
      // 清空筛选 + 预览缓存（不同引擎音色不同）
      setSearchText(''); setFilterScene(''); setFilterLanguage('');
      setPreviewingId('');
      if (previewRef.current) { previewRef.current.pause(); previewRef.current = null; }
      setMsg(`✅ 已切换到 ${engine === 'qwen-tts' ? 'Qwen-TTS（千问3）' : 'CosyVoice'}，默认音色：${r.default}`);
      loadVoices();
      setTimeout(() => setMsg(''), 3000);
    } catch (e) {
      setMsg(`切换失败: ${e instanceof Error ? e.message : '未知错误'}`);
    }
  };

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
    if (!selectedCharId) { setMsg('请先选择一个数字人角色'); return; }
    if (!dhAudioFile) { setMsg('请上传音频文件（数字人需要音频驱动）'); return; }
    setDhBusy(true); setDhStatus('提交中…'); setDhVideoPath('');
    try {
      const r = await generateDigitalHuman(null, dhAudioFile, dhPos, dhStyleLevel, selectedCharId);
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

  const systemVoices = voices.filter((v) => v.type === 'system' || v.type === 'qwen-tts');
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
          {/* TTS 引擎选择 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, padding: 12, background: 'var(--bg-hover)', borderRadius: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>TTS 引擎：</span>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
              <input type="radio" name="tts-engine" checked={ttsEngine === 'cosyvoice'} onChange={() => handleSwitchEngine('cosyvoice')} />
              <span>CosyVoice-v2</span>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>（106 音色，支持时间戳/SSML）</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
              <input type="radio" name="tts-engine" checked={ttsEngine === 'qwen-tts'} onChange={() => handleSwitchEngine('qwen-tts')} />
              <span>Qwen-TTS（千问3）</span>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>（效果更自然，支持指令控制）</span>
            </label>
          </div>

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
            {ttsEngine === 'qwen-tts' ? (
              <>
                <strong>Qwen-TTS（千问3-TTS）：</strong>
                <span style={{ marginLeft: 8, color: 'var(--text-secondary)' }}>基于千问3大模型，音色更自然有情感</span>；
                <span style={{ marginLeft: 8, color: 'var(--text-secondary)' }}>指令控制</span> = 通过 instructions 参数控制语速/情感/风格；
                <span style={{ marginLeft: 8, color: 'var(--text-tertiary)' }}>不支持 SSML/时间戳，字幕按句切分</span>
              </>
            ) : (
              <>
                <strong>特性说明：</strong>
                <span style={{ marginLeft: 8, color: 'var(--text-secondary)' }}>SSML</span> = 语音合成标记语言（控制停顿、语速、发音等）；
                <span style={{ marginLeft: 8, color: 'var(--text-secondary)' }}>Instruct</span> = 自然语言指令控制情感/风格；
                <span style={{ marginLeft: 8, color: 'var(--text-secondary)' }}>时间戳</span> = 返回每个词的时间戳（用于字幕对齐）
              </>
            )}
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
                      {/* CosyVoice 系统音色显示 SSML/Instruct/时间戳 标签；Qwen-TTS 无此字段 */}
                      {v.ssml && (
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
                      )}
                      {/* Qwen-TTS 音色显示性别标签 */}
                      {v.gender && (
                        <div style={{ marginBottom: 8 }}>
                          <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 3,
                            background: v.gender === '女' ? 'rgba(236,72,153,0.12)' : 'rgba(59,130,246,0.12)',
                            color: v.gender === '女' ? '#ec4899' : '#3b82f6' }}>
                            {v.gender}
                          </span>
                        </div>
                      )}
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
          {/* 角色管理区 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              数字人角色 {dhCharacters.length} 个 · 先创建角色（上传人像照片），生成时复用角色照片 + 实际音频
            </div>
            <button className="btn btn-primary" onClick={() => setShowAddChar((v) => !v)}>
              + 创建角色
            </button>
          </div>

          {/* 创建角色表单 */}
          {showAddChar && (
            <div className="dash-section" style={{ marginBottom: 20, padding: 16, border: '1px solid var(--border)', borderRadius: 10 }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>创建数字人角色</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
                上传清晰正面人像照片（JPG/PNG，≥ 512×512），照片将作为数字人形象反复使用。
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <input className="input" style={{ maxWidth: 200 }} placeholder='角色名称（如"主播小美"）'
                  value={newCharName} onChange={(e) => setNewCharName(e.target.value)} />
                <input className="input" style={{ maxWidth: 200 }} placeholder='描述（可选，如"知性女声主播"）'
                  value={newCharDesc} onChange={(e) => setNewCharDesc(e.target.value)} />
                <input ref={newCharFileRef} type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={(e) => onPickCharPhoto(e.target.files?.[0] || null)} />
                <button className="btn" onClick={() => newCharFileRef.current?.click()}>
                  {newCharFile ? newCharFile.name.slice(0, 20) : '选择人像照片'}
                </button>
                <button className="btn btn-primary" onClick={handleCreateChar} disabled={charBusy || !newCharName.trim() || !newCharFile}>
                  {charBusy ? '创建中…' : '保存角色'}
                </button>
                <button className="btn" onClick={() => { setShowAddChar(false); setNewCharName(''); setNewCharDesc(''); setNewCharFile(null); setNewCharPreview(''); }}>取消</button>
              </div>
              {newCharPreview && (
                <div style={{ marginTop: 10, textAlign: 'center' }}>
                  <img src={newCharPreview} alt="预览" style={{ maxWidth: 200, maxHeight: 200, borderRadius: 8, objectFit: 'cover', border: '1px solid var(--border)' }} />
                </div>
              )}
            </div>
          )}

          {/* 角色列表 */}
          {dhCharacters.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text-tertiary)', padding: 20, textAlign: 'center', marginBottom: 20 }}>
              还没有数字人角色，点击「创建角色」添加
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 20 }}>
              {dhCharacters.map((c) => (
                <div key={c.id} style={{
                  border: selectedCharId === c.id ? '2px solid var(--accent)' : '1px solid var(--border)',
                  borderRadius: 10, padding: 12, cursor: 'pointer',
                  background: selectedCharId === c.id ? 'rgba(99,102,241,0.06)' : 'var(--bg-card)',
                  boxShadow: selectedCharId === c.id ? '0 0 0 3px rgba(99,102,241,0.15)' : 'none',
                  position: 'relative',
                }} onClick={() => setSelectedCharId(c.id)}>
                  <div style={{ textAlign: 'center', marginBottom: 8 }}>
                    <img src={c.image_url} alt={c.name} style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 6 }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{c.name}</span>
                    {selectedCharId === c.id && (
                      <span style={{ fontSize: 10, color: '#fff', padding: '1px 6px', background: 'var(--accent)', borderRadius: 3 }}>已选</span>
                    )}
                  </div>
                  {c.desc && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}>{c.desc}</div>}
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{c.created_at}</div>
                  <button className="btn btn-sm btn-ghost" style={{ position: 'absolute', top: 8, right: 8, padding: '2px 6px' }}
                    onClick={(e) => { e.stopPropagation(); handleDeleteChar(c.id, c.name); }}>
                    <IconTrash size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* 生成区：选中角色 + 上传音频 */}
          <div className="dash-section" style={{ padding: 16, border: '1px solid var(--border)', borderRadius: 10, marginBottom: 20 }}>
            <div style={{ fontWeight: 600, marginBottom: 12 }}>生成数字人视频</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
              {selectedCharId
                ? `已选角色：${dhCharacters.find((c) => c.id === selectedCharId)?.name || ''} · 上传音频即可生成`
                : '请先在上方选择一个角色'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16, marginBottom: 16 }}>
              {/* 音频上传 */}
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>音频文件（驱动数字人说话）</label>
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
              {/* 动作风格强度 */}
              <div style={{ flex: '0 0 160px' }}>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>动作风格</label>
                <select className="input" style={{ width: '100%' }} value={dhStyleLevel} onChange={(e) => setDhStyleLevel(e.target.value as 'normal' | 'calm' | 'active')}>
                  <option value="normal">适中（默认）</option>
                  <option value="calm">平静</option>
                  <option value="active">活泼</option>
                </select>
              </div>
              {/* 生成按钮 */}
              <div>
                <button className="btn btn-primary" onClick={handleDigitalHuman} disabled={dhBusy || !selectedCharId || !dhAudioFile}>
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
            1. 先创建数字人角色（上传人像照片），照片可反复使用<br />
            2. 生成时选择角色 + 上传音频，百炼 EMO 根据照片和音频生成说话视频<br />
            3. 人像照片要求：清晰正面照，五官端正，分辨率 ≥ 512×512，支持 JPG/PNG<br />
            4. 音频要求：清晰人声，≤ 60 秒，支持 MP3/WAV<br />
            5. 动作风格：适中（normal）= 默认；平静（calm）= 动作幅度小；活泼（active）= 动作幅度大<br />
            6. 生成是异步任务，通常需要 1-3 分钟<br />
            7. 在发布中心选择数字人角色后，视频生成时自动用口播音频驱动 EMO 并 overlay
          </div>
        </>
      )}
    </div>
  );
}
