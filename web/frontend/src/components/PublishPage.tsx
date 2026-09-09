import { useState, useRef, useEffect, useCallback } from 'react';
import {
  createSchedule, executeSkill, runAgent, streamChat,
  fetchAccounts, fetchOutputs, mediaUrl,
  checkWechatsync, wechatsyncPing, fetchWechatsyncPlatforms,
  createPublishJob, getPublishJob, listPublishJobs, cancelPublishJob, submitPublishSms,
} from '../lib/api';
import type { AccountItem, OutputFile, PublishJob, PublishJobTask, WechatsyncPlatform } from '../lib/api';
import { loadPublishDraft, savePublishDraft } from '../lib/store';
import { renderMarkdown } from '../lib/sanitize';
import { IconPublish, IconCopy, IconCheck, IconCalendar, IconSkills, IconEdit, IconStop, IconTrash } from './icons';

interface PublishPageProps {
  persona: string;
}

// 平台列表须与后端 LOGIN_RUNNERS 对齐（有登录/发布链路的才列）——微博/公众号无 publisher，不列
const PLATFORMS: { key: string; label: string; titleLimit?: number; bodyLimit: number; hint: string }[] = [
  { key: 'xiaohongshu', label: '小红书', titleLimit: 20, bodyLimit: 1000, hint: '标题≤20，正文≤1000，重情绪+话题标签' },
  { key: 'douyin', label: '抖音', titleLimit: 30, bodyLimit: 5000, hint: '视频或图文（图片），标题≤30；正文按平台编辑器实际限制，前几字建议有钩子' },
  { key: 'kuaishou', label: '快手', titleLimit: 30, bodyLimit: 1000, hint: '视频或图片(图文)，标题≤30，需附媒体' },
  { key: 'weixin-channels', label: '视频号', bodyLimit: 1000, hint: '需附视频，短描述+话题标签，微信扫码登录' },
  { key: 'zhihu', label: '知乎', bodyLimit: 5000, hint: '长文/回答，讲清逻辑' },
  { key: 'bilibili', label: 'B站', titleLimit: 80, bodyLimit: 2000, hint: '需附视频，标题≤80、简介≤2000，默认投「知识」分区' },
];

// 能一键发布的平台（有后端 publisher）
const PUBLISHABLE = new Set(['xiaohongshu', 'douyin', 'kuaishou', 'weixin-channels', 'zhihu', 'bilibili']);
// 必须附带媒体的平台（无媒体发不了）
const MEDIA_REQUIRED = new Set(['xiaohongshu', 'douyin', 'kuaishou', 'weixin-channels', 'bilibili']);
// 只能发视频的平台（视频号/B站：图文链路未接入，必须视频；抖音图文已放开走 publish --images）
const VIDEO_ONLY = new Set(['weixin-channels', 'bilibili']);
const VIDEO_RE = /\.(mp4|mov|webm|mkv|avi|m4v|flv|ts)$/i;

// Wechatsync 平台（通过 Chrome 扩展同步为草稿）
const WECHATSYNC_PLATFORMS: { key: string; label: string }[] = [
  { key: 'toutiao', label: '头条' },
  { key: 'juejin', label: '掘金' },
  { key: 'csdn', label: 'CSDN' },
  { key: 'jianshu', label: '简书' },
  { key: 'weibo', label: '微博' },
  { key: 'segmentfault', label: 'SF' },
  { key: 'oschina', label: '开源中国' },
  { key: 'cnblogs', label: '博客园' },
  { key: '51cto', label: '51CTO' },
  { key: 'infoq', label: 'InfoQ' },
  { key: 'baijiahao', label: '百家号' },
  { key: 'sohu', label: '搜狐号' },
  { key: 'douban', label: '豆瓣' },
];
const LABEL2KEY = Object.fromEntries([...PLATFORMS, ...WECHATSYNC_PLATFORMS].map((p) => [p.label, p.key]));

function parseSections(text: string): Record<string, string> {
  const parts = text.split(/^\s*={2,}\s*(.+?)\s*={2,}\s*$/m);
  const map: Record<string, string> = {};
  for (let i = 1; i < parts.length; i += 2) map[parts[i].trim()] = (parts[i + 1] || '').trim();
  return map;
}

type PubState = { status: 'publishing' | 'submitted' | 'ok' | 'fail'; msg: string };

export default function PublishPage({ persona }: PublishPageProps) {
  const draft0 = loadPublishDraft();
  const [title, setTitle] = useState(draft0.title);
  const [body, setBody] = useState(draft0.body);
  const [platforms, setPlatforms] = useState<string[]>(draft0.platforms);
  const [overrides, setOverrides] = useState<Record<string, string>>(draft0.overrides);
  const [tags, setTags] = useState(draft0.tags || '');
  const [draftSource, setDraftSource] = useState(draft0.source);
  const [editing, setEditing] = useState<string | null>(null);
  const [copied, setCopied] = useState('');
  const [toast, setToast] = useState('');
  const [adapting, setAdapting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState('');
  const adaptCtl = useRef<AbortController | null>(null);

  // 发布相关
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [mediaFiles, setMediaFiles] = useState<OutputFile[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<string[]>(draft0.media || []);
  const [previewMedia, setPreviewMedia] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [pub, setPub] = useState<Record<string, PubState>>({});
  const [wsSyncPlatforms, setWsSyncPlatforms] = useState<string[]>([]);
  const [wsPlatforms, setWsPlatforms] = useState<WechatsyncPlatform[]>([]);
  const [wsReady, setWsReady] = useState(false);
  const [wsSyncing, setWsSyncing] = useState(false);
  const [extConnected, setExtConnected] = useState<boolean | null>(null);   // null=未知
  const [extMessage, setExtMessage] = useState('');
  const [extPinging, setExtPinging] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // 预检缓存：按内容指纹缓存，内容没变就不重复请求 AI
  const precheckHashRef = useRef('');
  const [precheckStale, setPrecheckStale] = useState(false);
  const stopRef = useRef(false);   // 停止发布标志（旧同步模式用）

  // 异步发布 Job
  const [activeJob, setActiveJob] = useState<PublishJob | null>(null);
  const [jobHistory, setJobHistory] = useState<PublishJob[]>([]);
  const [publishSmsCode, setPublishSmsCode] = useState('');
  const [publishSmsBusy, setPublishSmsBusy] = useState(false);
  const jobPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 草稿持久化：任何改动即写 localStorage，切页/刷新回来都在
  useEffect(() => {
    savePublishDraft({ title, body, platforms, overrides, tags, media: selectedMedia, source: draftSource });
  }, [title, body, platforms, overrides, tags, selectedMedia, draftSource]);

  // 内容变化时标记预检已过期
  useEffect(() => {
    const hash = `${title}||${body}`;
    if (precheckHashRef.current && precheckHashRef.current !== hash) setPrecheckStale(true);
  }, [title, body]);

  // 从 Job tasks 同步到 pub 状态（供平台卡片和进度面板渲染）
  const syncJobToPub = useCallback((job: PublishJob) => {
    const next: Record<string, PubState> = {};
    for (const t of job.tasks) {
      if (t.type === 'wechatsync') {
        const existing = next['wechatsync'];
        const status: PubState['status'] = t.status === 'verified' || t.status === 'ok' ? 'ok'
          : t.status === 'submitted' ? 'submitted'
            : ['fail', 'timeout', 'cancelled', 'skipped'].includes(t.status) ? 'fail' : 'publishing';
        if (!existing || status === 'fail' || (status === 'submitted' && existing.status === 'publishing') || status === 'ok') {
          next['wechatsync'] = { status, msg: `${t.label}: ${t.message}` };
        }
      } else {
        const status: PubState['status'] = t.status === 'verified' || t.status === 'ok' ? 'ok'
          : ['fail', 'timeout', 'cancelled', 'skipped'].includes(t.status) ? 'fail' : 'publishing';
        next[t.platform] = { status, msg: t.message };
      }
    }
    setPub(next);
  }, []);

  // 停止 Job 轮询
  const stopJobPoll = useCallback(() => {
    if (jobPollRef.current) { clearInterval(jobPollRef.current); jobPollRef.current = null; }
  }, []);

  // 开始轮询 Job 状态
  const startJobPoll = useCallback((jobId: string) => {
    stopJobPoll();
    jobPollRef.current = setInterval(async () => {
      try {
        const job = await getPublishJob(jobId);
        setActiveJob(job);
        syncJobToPub(job);
        if (job.status === 'done' || job.status === 'cancelled') {
          stopJobPoll();
          setPublishing(false);
          setWsSyncing(false);
          void listPublishJobs().then(setJobHistory).catch(() => {});
          showToast(job.status === 'cancelled' ? '发布已停止' : '发布流程结束，见各平台状态');
        }
      } catch { /* 单次失败忽略 */ }
    }, 2000);
  }, [stopJobPoll, syncJobToPub]);

  // 页面加载时检查是否有运行中的 Job（刷新恢复）
  useEffect(() => {
    listPublishJobs().then((jobs) => {
      setJobHistory(jobs);
      const running = jobs.find((j) => j.status === 'running' || j.status === 'cancelling');
      const latest = running || jobs[0];
      if (latest) {
        setActiveJob(latest);
        syncJobToPub(latest);
      }
      if (running) {
        setPublishing(true);
        if (running.tasks.some((t) => t.type === 'wechatsync' && ['connecting', 'publishing'].includes(t.status))) setWsSyncing(true);
        startJobPoll(running.id);
      }
    }).catch(() => { /* 忽略 */ });
    return () => stopJobPoll();
  }, [startJobPoll, stopJobPoll, syncJobToPub]);

  useEffect(() => () => adaptCtl.current?.abort(), []);   // 离开页面中止流

  // 登录态 + 可选媒体列表 + Wechatsync 状态
  useEffect(() => {
    fetchAccounts().then(setAccounts).catch(() => { /* 忽略 */ });
    checkWechatsync().then((s) => {
      setWsReady(s.ready);
      setExtConnected(s.extension_connected ?? null);
      if (s.extension_connected) fetchWechatsyncPlatforms().then((r) => setWsPlatforms(r.platforms)).catch(() => {});
    }).catch(() => { /* 忽略 */ });
    fetchOutputs().then((roots) => {
      const files: OutputFile[] = [];
      const walk = (n: OutputFile) => {
        if (n.type === 'file') { if (n.kind === 'image' || n.kind === 'video') files.push(n); return; }
        for (const c of n.children || []) walk(c);
      };
      roots.forEach(walk);
      files.sort((a, b) => (b.mtime || 0) - (a.mtime || 0));
      setMediaFiles(files);
    }).catch(() => { /* 忽略 */ });
  }, []);

  const loginOf = (key: string) => accounts.find((a) => a.platform === key)?.loggedIn ?? false;
  const availableWs = wsPlatforms.length > 0
    ? wsPlatforms.map((p) => ({ key: p.id, label: p.name, loggedIn: p.loggedIn, username: p.username }))
    : WECHATSYNC_PLATFORMS.map((p) => ({ ...p, loggedIn: null, username: '' }));

  const toggle = (k: string) => {
    setPlatforms((prev) => prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]);
    setWsSyncPlatforms((prev) => prev.filter((x) => x !== k));
  };
  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2800); };

  const effective = (k: string) => overrides[k] ?? body;
  const empty = !title.trim() && !body.trim();
  const isVideoPath = (p: string) => /\.(mp4|mov|flv|mkv|avi|webm|m4v|wmv|ts|mpe?g)$/i.test(p);
  const toggleMedia = (path: string) =>
    setSelectedMedia((prev) => {
      if (prev.includes(path)) return prev.filter((x) => x !== path);
      // 通用规则：图片和视频不能同时；视频一次只发一个
      if (isVideoPath(path)) {
        if (prev.length && !prev.every(isVideoPath)) { showToast('图片和视频不能同时发布，请先取消已选图片'); return prev; }
        return [path]; // 视频单选
      }
      if (prev.some(isVideoPath)) { showToast('图片和视频不能同时发布，请先取消已选视频'); return prev; }
      return [...prev, path]; // 图片可多选（图文）
    });

  // A. 智能一稿多改（流式：逐字改写，直接流进每个平台卡片）
  const adapt = () => {
    if (empty || (platforms.length === 0 && wsSyncPlatforms.length === 0) || adapting) return;
    const sel = [...PLATFORMS.filter((p) => platforms.includes(p.key)),
      ...availableWs.filter((p) => wsSyncPlatforms.includes(p.key))];
    const prompt =
      `请执行 /skill-content-repurposing：把下面这条内容改编到这些平台：${sel.map((p) => p.label).join('、')}。` +
      `务必参考该 SKILL 的 platform-specs 与改写配方，贴合各平台原生格式、语气与字数。\n` +
      `【硬性要求】输出各平台“可直接复制发布的纯文本正文”，禁止任何 Markdown 语法：不要 **加粗**、# 标题、---、表格、代码块、编号列表符号；` +
      `小红书可用 emoji 和 #话题标签，按平台习惯自然分行即可。\n` +
      `严格只按下面格式输出、每个平台之间用分隔线，不要任何额外说明：\n` +
      sel.map((p) => `===${p.label}===\n<该平台纯文本正文>`).join('\n') +
      `\n\n原始内容：\n标题：${title}\n正文：${body}`;

    setAdapting(true);
    let acc = '';
    const base = { ...overrides };
    adaptCtl.current = streamChat(
      prompt, persona, `adapt-${Date.now()}`,
      (chunk) => {                       // 逐字：实时解析并流进对应平台卡片
        acc += chunk;
        const map = parseSections(acc);
        const next = { ...base };
        for (const [label, text] of Object.entries(map)) {
          const key = LABEL2KEY[label];
          if (key && (platforms.includes(key) || wsSyncPlatforms.includes(key))) next[key] = text;
        }
        setOverrides(next);
      },
      () => {                            // 完成
        const hit = Object.keys(parseSections(acc)).length;
        setAdapting(false);
        showToast(hit ? `已生成 ${hit} 个平台版本` : '未能解析，可重试');
      },
      () => { setAdapting(false); showToast('改写失败，请重试'); },
    );
  };
  const stopAdapt = () => { adaptCtl.current?.abort(); setAdapting(false); };

  const performPrecheck = async () => {
    const prompt =
      `你是社媒发布审核助手。针对下面这条待发内容做两项检查，用简洁中文分点输出：\n` +
      `1. **合规风险**：是否含极限词/医疗功效/敏感或违规表述，列出问题词+替换建议；无则写"未见明显风险"。\n` +
      `2. **标题/钩子**：给标题打 1-10 分，并给 1-2 个更好的备选。\n` +
      `最后一行给「✅可发 / ⚠️建议修改」结论。\n\n待检内容：\n标题：${title}\n正文：${body}`;
    const content = `待发布内容：\n标题：${title}\n正文：${body}`;
    const [general, personaResult] = await Promise.all([
      runAgent(prompt),
      persona ? executeSkill('persona-check', content, persona) : Promise.resolve(null),
    ]);
    return `${general.response}\n\n---\n\n## 人设一致性\n\n${personaResult?.response || '未选择画像，已跳过人设一致性检查。'}`;
  };

  // C. 发布前一键预检
  const check = async () => {
    if (empty) return;
    setChecking(true); setCheckResult('');
    try {
      const result = await performPrecheck();
      setCheckResult(result);
      precheckHashRef.current = `${title}||${body}`;
      setPrecheckStale(false);
    } catch (e) {
      setCheckResult(e instanceof Error ? e.message : '预检失败');
    } finally { setChecking(false); }
  };

  // D. 一键发布（Job 模式：创建异步 Job → 轮询状态 → 页面刷新可恢复）
  const publishAll = async () => {
    if (empty || publishing || checking) return;
    const allNative = PLATFORMS.filter((p) => platforms.includes(p.key) && PUBLISHABLE.has(p.key));
    const wsTargets = availableWs.filter((p) => wsSyncPlatforms.includes(p.key));

    // 分类原生平台：可发布 / 将跳过（未登录/媒体不匹配）
    const canPublish: typeof allNative = [];
    const skipReasons: { label: string; reason: string }[] = [];
    for (const t of allNative) {
      if (!loginOf(t.key)) { skipReasons.push({ label: t.label, reason: '未登录' }); continue; }
      if (MEDIA_REQUIRED.has(t.key) && selectedMedia.length === 0) { skipReasons.push({ label: t.label, reason: '需附带媒体' }); continue; }
      if (VIDEO_ONLY.has(t.key) && !selectedMedia.some((p) => VIDEO_RE.test(p)) && selectedMedia.some((p) => !VIDEO_RE.test(p))) {
        canPublish.push(t);
        continue;
      }
      if (VIDEO_ONLY.has(t.key) && !selectedMedia.some((p) => VIDEO_RE.test(p))) { skipReasons.push({ label: t.label, reason: '需提供图片或视频' }); continue; }
      canPublish.push(t);
    }
    if (canPublish.length === 0 && wsTargets.length === 0) {
      showToast('没有可发布的平台（全部未登录或媒体不匹配）');
      return;
    }

    // 预检：按内容指纹缓存，内容没变就复用，不重复请求 AI
    const contentHash = `${title}||${body}`;
    if (precheckHashRef.current !== contentHash || !checkResult) {
      setChecking(true);
      try {
        setCheckResult(await performPrecheck());
        precheckHashRef.current = contentHash;
        setPrecheckStale(false);
      } catch (e) {
        setCheckResult(`预检失败：${e instanceof Error ? e.message : '未知错误'}\n\n预检仅用于提醒，不会阻止你继续发布。`);
      } finally {
        setChecking(false);
      }
    }

    // 确认弹窗：只列可发布平台 + 跳过摘要
    const publishLabels = [...canPublish.map((t) => VIDEO_ONLY.has(t.key) && !selectedMedia.some((p) => VIDEO_RE.test(p))
      ? `${t.label}(自动生成视频)` : t.label), ...wsTargets.map((t) => `${t.label}(草稿)`)];
    const skipLine = skipReasons.length > 0
      ? `\n\n将跳过：${skipReasons.map((s) => `${s.label}（${s.reason}）`).join('、')}`
      : '';
    const okToSend = window.confirm(
      `发布前预检结果已显示在页面中。人设评分只做提醒，不会阻止发布。\n\n` +
      `即将发布到：${publishLabels.join('、')}。\n` +
      `原生平台会直接发布，Wechatsync 平台逐个同步为草稿（需在各平台后台二次确认）。确定继续？${skipLine}`);
    if (!okToSend) return;

    // 创建异步 Job
    setPublishing(true);
    if (wsTargets.length > 0) setWsSyncing(true);
    try {
      const job = await createPublishJob({
        title,
        body,
        tags,
        media: selectedMedia,
        platform_contents: overrides,
        native_platforms: canPublish.map((t) => t.key),
        wechatsync_platforms: wsTargets.map((t) => t.key),
      });
      setActiveJob(job);
      syncJobToPub(job);
      startJobPoll(job.id);
    } catch (e) {
      setPublishing(false);
      setWsSyncing(false);
      showToast(e instanceof Error ? e.message : '创建发布任务失败');
    }
  };

  const stopPublish = () => {
    if (activeJob) {
      cancelPublishJob(activeJob.id).catch(() => { /* 忽略 */ });
      showToast('正在停止发布…');
    } else {
      stopRef.current = true;
    }
  };

  const publishSmsTask = activeJob?.tasks.find((task) => task.type === 'native' && task.status === 'sms_required');
  const submitPublishSmsCode = async () => {
    if (!publishSmsTask || publishSmsCode.length < 4 || publishSmsBusy) return;
    setPublishSmsBusy(true);
    try {
      await submitPublishSms(publishSmsTask.platform, publishSmsCode);
      setPublishSmsCode('');
      setActiveJob((job) => job ? {
        ...job,
        tasks: job.tasks.map((task) => task === publishSmsTask
          ? { ...task, status: 'verifying', message: '验证码已提交，正在验证…' }
          : task),
      } : job);
    } catch (e) {
      showToast(e instanceof Error ? e.message : '验证码提交失败');
    } finally {
      setPublishSmsBusy(false);
    }
  };

  // 重试失败平台：用相同内容创建新 Job，只包含失败的 native + wechatsync 平台
  const retryFailed = async () => {
    if (!activeJob || publishing) return;
    const failedNative = activeJob.tasks.filter((t) => t.status === 'fail' && t.type === 'native').map((t) => t.platform);
    const failedWs = activeJob.tasks.filter((t) => t.status === 'fail' && t.type === 'wechatsync').map((t) => t.platform);
    if (failedNative.length === 0 && failedWs.length === 0) { showToast('没有失败平台可重试'); return; }
    setPublishing(true);
    if (failedWs.length > 0) setWsSyncing(true);
    try {
      const job = await createPublishJob({
        title, body, tags, media: selectedMedia, platform_contents: overrides,
        native_platforms: failedNative, wechatsync_platforms: failedWs,
      });
      setActiveJob(job);
      syncJobToPub(job);
      startJobPoll(job.id);
      showToast(`正在重试 ${failedNative.length + failedWs.length} 个失败平台…`);
    } catch (e) {
      setPublishing(false);
      setWsSyncing(false);
      showToast(e instanceof Error ? e.message : '重试失败');
    }
  };

  const retryTask = async (task: PublishJobTask) => {
    if (publishing || task.type === 'media') return;
    setPublishing(true);
    if (task.type === 'wechatsync') setWsSyncing(true);
    try {
      const job = await createPublishJob({
        title, body, tags, media: selectedMedia, platform_contents: overrides,
        native_platforms: task.type === 'native' ? [task.platform] : [],
        wechatsync_platforms: task.type === 'wechatsync' ? [task.platform] : [],
      });
      setActiveJob(job);
      setJobHistory((items) => [job, ...items.filter((item) => item.id !== job.id)]);
      syncJobToPub(job);
      startJobPoll(job.id);
    } catch (e) {
      setPublishing(false);
      setWsSyncing(false);
      showToast(e instanceof Error ? e.message : '重试失败');
    }
  };

  // 检测扩展连接（起短命 CLI 进程，~8-15s）
  const pingExtension = async () => {
    setExtPinging(true);
    try {
      const r = await wechatsyncPing();
      setExtConnected(r.connected && r.authenticated);
      setExtMessage(r.message);
      if (r.connected && r.authenticated) fetchWechatsyncPlatforms().then((data) => setWsPlatforms(data.platforms)).catch((error) => setExtMessage(error instanceof Error ? error.message : '平台列表读取失败'));
      showToast(r.message);
    } catch (e) {
      setExtConnected(false);
      showToast(e instanceof Error ? e.message : '检测失败');
    } finally {
      setExtPinging(false);
    }
  };

  // 异步发布轮询（抖音）：Job 模式下由后端处理，此函数保留供未来 SMS 支持使用
  // const pollAsyncPublish = ...

  const copyFor = (key: string) => {
    const text = (title ? title + '\n\n' : '') + effective(key);
    navigator.clipboard?.writeText(text);
    setCopied(key); setTimeout(() => setCopied(''), 1400);
  };
  const addToCalendar = async (key: string) => {
    if (empty) return;
    const d = new Date();
    await createSchedule({
      title: title.trim() || effective(key).slice(0, 20), date: d.toISOString().slice(0, 10),
      platform: PLATFORMS.find((p) => p.key === key)?.label || '', time: '', status: 'draft', note: effective(key),
    });
    showToast('已存为草稿并加入今天的日历');
  };

  const canPublish = platforms.some((k) => PUBLISHABLE.has(k)) || (wsReady && wsSyncPlatforms.length > 0);
  const hasMedia = selectedMedia.length > 0;
  const hasVideo = selectedMedia.some((path) => VIDEO_RE.test(path));
  const publishPlan = [
    ...PLATFORMS.filter((p) => platforms.includes(p.key)).map((p) => {
      if (!loginOf(p.key)) return { label: p.label, state: 'blocked', detail: '未登录，无法执行发布' };
      if (MEDIA_REQUIRED.has(p.key) && !hasMedia) return { label: p.label, state: 'blocked', detail: '未选择媒体' };
      if (VIDEO_ONLY.has(p.key) && !hasVideo) return { label: p.label, state: hasMedia ? 'ready' : 'blocked', detail: hasMedia ? '将先生成 9:16 视频版，再发布' : '需图片或视频' };
      return { label: p.label, state: 'ready', detail: hasVideo && !VIDEO_ONLY.has(p.key) ? '将使用视频发布' : '将使用图文内容发布' };
    }),
    ...availableWs.filter((p) => wsSyncPlatforms.includes(p.key)).map((p) => ({
      label: `${p.label}（草稿）`, state: wsReady && extConnected !== false ? 'ready' : 'blocked',
      detail: !wsReady ? '未配置 Wechatsync' : extConnected === false ? '扩展未连接' : '将同步图文草稿，需平台后台确认',
    })),
  ];

  return (
    <div className="publish-page">
      <div className="publish-editor">
        <h1 className="page-title"><IconPublish size={21} /> 发布中心</h1>
        <p className="page-subtitle">一次编辑 → AI 一键改写成各平台版本 → 预检 → 附媒体 → 一键真发布。</p>
        {draftSource && (
          <div className="publish-source-note">
            已从结构化发布包载入标题、正文、标签和 {selectedMedia.length} 个媒体文件：{draftSource}
          </div>
        )}

        <label className="field-label">标题</label>
        <input className="field" value={title} placeholder="标题（部分平台需要）"
          onChange={(e) => setTitle(e.target.value)} />
        <label className="field-label">正文（母版）</label>
        <textarea className="field" style={{ minHeight: 180 }} value={body}
          placeholder="写下你的内容，右侧按各平台规则实时预览；点「一键适配」让 AI 分平台改写…"
          onChange={(e) => setBody(e.target.value)} />

        <label className="field-label">话题标签 <span style={{ color: 'var(--text-secondary)', fontWeight: 400, fontSize: 12 }}>（逗号分隔，如「AI,职场,干货」；小红书会用 # 联想真正绑定话题）</span></label>
        <input className="field" value={tags} placeholder="AI,职场,干货"
          onChange={(e) => setTags(e.target.value)} />

        <label className="field-label">发布平台
          <span style={{ color: 'var(--text-secondary)', fontWeight: 400, fontSize: 12 }}>
            （带 🔒 的未登录，仅用于预览/改写，一键发布会自动跳过）
          </span>
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {PLATFORMS.map((p) => {
            const logged = loginOf(p.key);
            const imageToVideo = VIDEO_ONLY.has(p.key) && selectedMedia.length > 0 && !selectedMedia.some((path) => VIDEO_RE.test(path));
            const noMedia = MEDIA_REQUIRED.has(p.key) && selectedMedia.length === 0;
            const mode = imageToVideo ? '将自动转视频' : noMedia ? '需媒体' : VIDEO_ONLY.has(p.key) ? '视频发布' : '图文发布';
            return (
              <button key={p.key}
                className={`chip ${platforms.includes(p.key) ? 'active' : ''} ${logged ? '' : 'chip-noauth'}`}
                title={`${logged ? `${p.label}已登录` : `${p.label}未登录，请到「账号」页扫码登录后再发布`} · ${mode}`}
                onClick={() => toggle(p.key)}>
                {!logged && <span className="chip-lock">🔒</span>}{p.label}<small style={{ marginLeft: 3, opacity: .75 }}>{imageToVideo ? '· 转视频' : noMedia ? '· 需媒体' : ''}</small>
              </button>
            );
          })}
        </div>

        {/* Wechatsync 多平台同步（草稿模式） */}
        <label className="field-label" style={{ marginTop: 10, fontSize: 12, color: 'var(--text-secondary)' }}>
          Wechatsync 同步平台（同步为草稿，需在各平台后台二次发布）
          {!wsReady && <span style={{ color: 'var(--amber)', marginLeft: 6 }}>⚠ 未配置（去账号页配置）</span>}
          <button className="btn btn-sm" type="button" style={{ marginLeft: 8, fontSize: 11, padding: '2px 8px' }}
            onClick={() => window.open('/publish-sync-preview', '_blank', 'noopener,noreferrer')}>打开插件同步预览</button>
        </label>
        {wsReady && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, marginBottom: 6, fontSize: 12 }}>
            <span style={{
              color: extConnected === true ? 'var(--green)' : extConnected === false ? 'var(--red)' : 'var(--text-tertiary)',
            }}>
              {extConnected === true ? '🟢 扩展已连接' : extConnected === false ? '🔴 扩展未连接' : '⚪ 扩展连接未知'}
            </span>
            <button className="btn btn-sm" style={{ fontSize: 11, padding: '2px 8px' }}
              disabled={extPinging} onClick={pingExtension}>
              {extPinging ? '检测中…(8-15s)' : '检测扩展连接'}
            </button>
            {extConnected === false && (
              <span style={{ color: 'var(--amber)', fontSize: 11 }}>
                {extMessage || '请打开 Chrome → 确保扩展已加载 → 扩展设置里开启 MCP 连接'}
              </span>
            )}
          </div>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {availableWs.map((p) => (
            <button key={p.key}
              className={`chip ${wsSyncPlatforms.includes(p.key) ? 'active' : ''}`}
              disabled={!wsReady || p.loggedIn === false}
              title={p.loggedIn === false ? `${p.label}未登录` : p.username ? `${p.label} · ${p.username}` : p.label}
              style={{ opacity: wsReady && p.loggedIn !== false ? 1 : 0.5, fontSize: 12 }}
              onClick={() => {
                setWsSyncPlatforms((prev) => prev.includes(p.key) ? prev.filter((k) => k !== p.key) : [...prev, p.key]);
                if (PUBLISHABLE.has(p.key)) setPlatforms((prev) => prev.filter((k) => k !== p.key));
              }}>
              {p.loggedIn === false ? '🔒 ' : ''}{p.label}{p.username ? ` · ${p.username}` : ''}
            </button>
          ))}
        </div>

        <label className="field-label" style={{ marginTop: 14 }}>
          媒体附件 {selectedMedia.length > 0 && <span className="pv-badge">{selectedMedia.length} 个</span>}
          <span style={{ color: 'var(--text-secondary)', fontWeight: 400, fontSize: 12 }}>（小红书/抖音/快手/微信视频号/B站必需，从内容库选；抖音、视频号、B站须为视频）</span>
        </label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="btn btn-sm" onClick={() => setShowPicker((v) => !v)}>
            <IconSkills size={13} /> {showPicker ? '收起' : '选择媒体'}
          </button>
          {selectedMedia.map((path) => (
            <div key={path} className="media-chip" onClick={() => setPreviewMedia(path)} title="点击查看大图">
              {!isVideoPath(path)
                ? <img src={mediaUrl(path)} alt={path.split('/').pop() || '媒体预览'} /> : <span className="media-vid">🎬</span>}
              <button className="media-x" type="button" title="移除图片"
                onClick={(e) => { e.stopPropagation(); toggleMedia(path); }}>×</button>
            </div>
          ))}
        </div>
        {showPicker && (
          <div className="media-grid">
            {mediaFiles.length === 0 && <div className="dash-empty">内容库暂无图片/视频</div>}
            {mediaFiles.slice(0, 40).map((f) => (
              <div key={f.path}
                className={`media-cell ${selectedMedia.includes(f.path) ? 'sel' : ''}`}
                onClick={() => toggleMedia(f.path)} title={f.path}>
                {f.kind === 'image'
                  ? <img src={mediaUrl(f.path)} alt={f.name} loading="lazy" />
                  : <span className="media-vid">🎬<br />{f.name.slice(0, 12)}</span>}
                {selectedMedia.includes(f.path) && <span className="media-check">✓</span>}
              </div>
            ))}
          </div>
        )}

        <div className="publish-actions">
          {adapting ? (
            <button className="btn btn-sm" onClick={stopAdapt}><IconStop size={13} /> 停止生成</button>
          ) : (
            <button className="btn btn-sm btn-primary" disabled={empty || (platforms.length === 0 && wsSyncPlatforms.length === 0)} onClick={adapt}>
              <IconSkills size={14} /> 一键适配各平台
            </button>
          )}
          <button className="btn btn-sm" disabled={empty || checking || adapting} onClick={check}>
            <IconCheck size={14} /> {checking ? '预检中…' : '发布前预检'}
            {precheckStale && checkResult && !checking && <span style={{ color: 'var(--amber)', marginLeft: 4 }}>·内容已变</span>}
          </button>
          <button className="btn btn-sm" disabled={empty} onClick={() => addToCalendar(platforms[0] || 'xiaohongshu')}>
            <IconCalendar size={14} /> 存草稿并排期
          </button>
          <button className="btn btn-sm btn-primary" disabled={empty || publishing || checking || wsSyncing || !canPublish}
            title={canPublish ? '发布到已选平台（原生平台直接发布，Wechatsync 同步为草稿）' : '请至少选择一个可发布平台'}
            onClick={publishAll}>
            <IconPublish size={14} /> {checking ? '发布前预检中…' : publishing ? '发布中…' : '一键发布'}
          </button>
          {publishing && (
            <button className="btn btn-sm btn-ghost" onClick={stopPublish}>
              <IconStop size={13} /> 停止发布
            </button>
          )}
          <button className="btn btn-sm btn-ghost" disabled={empty || adapting}
            onClick={() => { setTitle(''); setBody(''); setTags(''); setSelectedMedia([]); setDraftSource(undefined); setOverrides({}); setCheckResult(''); setPub({}); showToast('已清空'); }}>
            <IconTrash size={13} /> 清空
          </button>
        </div>
        {adapting && <div className="adapt-hint"><span className="live-pulse" />AI 正在逐字改写各平台版本…可随时停止。</div>}
        <p className="publish-saved-note">草稿已自动保存，切换页面/刷新回来内容都在。右侧浅色文字是内容规格，不是发布结果；实际执行结果以“发布执行状态”面板为准。</p>
        <div className="panel pub-progress-panel" style={{ marginTop: 14 }}>
          <div className="panel-title">发布执行状态 {activeJob ? `· ${activeJob.status === 'running' ? '执行中' : activeJob.status === 'done' ? '已结束' : '已取消'}` : '· 尚未开始'}</div>
          {publishPlan.length === 0 ? <div className="dash-empty">请先选择至少一个发布或同步平台</div> : (
            <div className="pub-progress-grid">
              {publishPlan.map((item) => (
                <div key={item.label} className={`pub-progress-item ${item.state}`}>
                  <span className="pub-progress-icon">{item.state === 'ready' ? '🟦' : '⛔'}</span>
                  <span className="pub-progress-label">{item.label}</span>
                  <span className="pub-progress-msg">{item.state === 'ready' ? `待执行：${item.detail}` : `已阻塞：${item.detail}`}</span>
                </div>
              ))}
            </div>
          )}
          {!activeJob && <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-tertiary)' }}>点击“一键发布”并在确认框确认后，才会创建发布任务；未出现任务 ID 即表示尚未向任何平台提交。</div>}
        </div>
        {checkResult && (
          <div className="panel" style={{ marginTop: 14 }}>
            <div className="panel-title"><IconCheck size={14} /> 发布前预检</div>
            <div className="skill-body-md" dangerouslySetInnerHTML={{ __html: renderMarkdown(checkResult) }} />
          </div>
        )}

        {/* 发布任务进度面板：有 Job 或 pub 状态时显示 */}
        {(activeJob || Object.keys(pub).length > 0) && (() => {
          // 优先从 activeJob.tasks 渲染（有逐平台 wechatsync 详情 + 耗时）
          const tasks = activeJob?.tasks || [];
          const fmtElapsed = (s: number | null, f: number | null) => {
            if (!s) return '';
            const end = f || Math.floor(Date.now() / 1000);
            const sec = end - s;
            if (sec < 60) return `${sec}s`;
            return `${Math.floor(sec / 60)}m${sec % 60}s`;
          };
          const entries: { label: string; status: string; msg: string; elapsed: string; task?: PublishJobTask }[] = tasks.length > 0
            ? tasks.map((t) => ({
                label: t.type === 'wechatsync' ? `${t.label}(草稿)` : t.label,
                status: t.status,
                msg: t.message,
                elapsed: fmtElapsed(t.started_at, t.finished_at),
                task: t,
              }))
            : Object.entries(pub).map(([k, s]) => ({
                label: k === 'wechatsync' ? 'Wechatsync' : PLATFORMS.find((p) => p.key === k)?.label || k,
                status: s.status, msg: s.msg, elapsed: '',
              }));
          const done = entries.filter((e) => ['ok', 'verified', 'submitted', 'fail', 'timeout', 'cancelled', 'skipped'].includes(e.status)).length;
          const inProg = entries.filter((e) => ['preparing', 'connecting', 'publishing', 'sms_required', 'verifying'].includes(e.status)).length;
          const failed = entries.filter((e) => ['fail', 'timeout'].includes(e.status));
          const jobDone = activeJob && (activeJob.status === 'done' || activeJob.status === 'cancelled');
          return (
            <div className="panel pub-progress-panel" style={{ marginTop: 14 }}>
              <div className="panel-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>实际任务结果 {done}/{entries.length} 已结束 {inProg > 0 && `· ${inProg} 进行中`}</span>
                {publishing && <span className="live-pulse" style={{ marginLeft: 8 }} />}
              </div>
              <div className="pub-progress-grid">
                {entries.map((e, i) => (
                  <div key={i} className={`pub-progress-item ${e.status}`}>
                    <span className="pub-progress-icon">
                      {e.status === 'ok' || e.status === 'verified' ? '✅' : e.status === 'submitted' ? '📨'
                        : ['fail', 'timeout'].includes(e.status) ? '⚠️' : ['skipped', 'cancelled'].includes(e.status) ? '⏭️' : '⏳'}
                    </span>
                    <span className="pub-progress-label">{e.label}</span>
                    <span className="pub-progress-msg">{e.msg}</span>
                    {e.elapsed && <span className="pub-progress-time">{e.elapsed}</span>}
                    {e.task?.draft_url && <a className="pv-copy" href={e.task.draft_url} target="_blank" rel="noreferrer">打开草稿</a>}
                    {e.task && ['fail', 'timeout'].includes(e.status) && <button className="pv-copy" onClick={() => retryTask(e.task!)}>重试</button>}
                    {e.task && (e.task.stdout || e.task.stderr) && <details className="pub-progress-detail"><summary>详情</summary><pre>{e.task.stderr || e.task.stdout}</pre></details>}
                  </div>
                ))}
              </div>
              {jobDone && failed.length > 0 && (
                <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                  <button className="btn btn-sm" onClick={retryFailed}>重试失败平台（{failed.length}）</button>
                </div>
              )}
            </div>
          );
        })()}
        {jobHistory.length > 0 && (
          <div className="panel" style={{ marginTop: 12 }}>
            <div className="panel-title">最近发布任务</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
              {jobHistory.slice(0, 8).map((job) => (
                <button key={job.id} className={`btn btn-sm ${activeJob?.id === job.id ? 'btn-primary' : ''}`}
                  onClick={() => { setActiveJob(job); syncJobToPub(job); }}>
                  {new Date(job.created_at * 1000).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })} · {job.title || '未命名'}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="publish-previews">
        {platforms.length === 0 && <div className="dash-empty">选择至少一个平台查看预览</div>}
        {PLATFORMS.filter((p) => platforms.includes(p.key)).map((p) => {
          const text = effective(p.key);
          const over = text.length > p.bodyLimit;
          const titleOver = p.titleLimit != null && title.length > p.titleLimit;
          const isEdit = editing === p.key;
          const ps = pub[p.key];
          const publishable = PUBLISHABLE.has(p.key);
          const logged = loginOf(p.key);
          return (
            <div key={p.key} className={`card pv-card pv-${p.key} ${publishable && !logged ? 'pv-card-noauth' : ''}`}>
              <div className="pv-head">
                <span className="pv-plat">
                  {p.label}
                  {overrides[p.key] != null && <span className="pv-badge">AI 版</span>}
                  {publishable && (logged
                    ? <span className="pv-badge pv-badge-ok">已登录</span>
                    : <span className="pv-badge pv-badge-warn" title="一键发布会自动跳过该平台">🔒 未登录</span>)}
                </span>
                <span className={`pv-count ${over ? 'over' : ''}`}>{text.length}/{p.bodyLimit}</span>
              </div>
              <div className="pv-body">
                {p.titleLimit != null && (
                  <div className={`pv-title ${titleOver ? 'over' : ''}`}>{title || <span className="pv-ph">标题…</span>}</div>
                )}
                {isEdit
                  ? <textarea className="field" style={{ minHeight: 120 }} value={text} autoFocus
                      onChange={(e) => setOverrides((o) => ({ ...o, [p.key]: e.target.value }))} />
                  : <div className="pv-text">{text || <span className="pv-ph">正文预览…</span>}{adapting && overrides[p.key] != null && <span className="streaming-cursor" />}</div>}
              </div>
              {ps && (
                <div className={`pv-pubstate ${ps.status}`}>
                  {ps.status === 'publishing' && <span className="live-pulse" />}
                  {ps.status === 'ok' ? '✅ ' : ps.status === 'submitted' ? '📨 ' : ps.status === 'fail' ? '⚠️ ' : ''}{ps.msg}
                </div>
              )}
              <div className="pv-foot">
                <span className="pv-hint">{p.hint}{over ? ' · 已超字数' : ''}</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="pv-copy" onClick={() => setEditing(isEdit ? null : p.key)}>
                    <IconEdit size={13} />{isEdit ? '完成' : '编辑'}
                  </button>
                  <button className="pv-copy" onClick={() => copyFor(p.key)}>
                    {copied === p.key ? <IconCheck size={13} /> : <IconCopy size={13} />}{copied === p.key ? '已复制' : '复制'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {/* Wechatsync 状态卡片：选了同步平台或有同步状态时显示 */}
        {(wsSyncPlatforms.length > 0 || pub['wechatsync']) && (() => {
          const wsPs = pub['wechatsync'];
          const wsLabels = availableWs.filter((p) => wsSyncPlatforms.includes(p.key)).map((p) => p.label);
          return (
            <div className="card pv-card pv-wechatsync">
              <div className="pv-head">
                <span className="pv-plat">
                  Wechatsync 同步
                  <span className="pv-badge">草稿模式</span>
                  {wsReady
                    ? <span className="pv-badge pv-badge-ok">已配置</span>
                    : <span className="pv-badge">未配置</span>}
                </span>
              </div>
              <div className="pv-body">
                <div className="pv-text" style={{ fontSize: 13 }}>
                  {wsLabels.length > 0
                    ? `已选：${wsLabels.join('、')}`
                    : '未选择同步平台'}
                </div>
              </div>
              {wsPs && (
                <div className={`pv-pubstate ${wsPs.status}`}>
                  {wsPs.status === 'publishing' && <span className="live-pulse" />}
                  {wsPs.status === 'ok' ? '✅ ' : wsPs.status === 'fail' ? '⚠️ ' : ''}{wsPs.msg}
                </div>
              )}
              <div className="pv-foot">
                <span className="pv-hint">同步为草稿，需在各平台后台二次发布</span>
              </div>
            </div>
          );
        })()}
      </div>

      {previewMedia && (
        <div className="overlay media-lightbox" onClick={() => setPreviewMedia(null)}>
          <div className="media-lightbox-content" onClick={(e) => e.stopPropagation()}>
            <button className="media-lightbox-close" type="button" onClick={() => setPreviewMedia(null)} aria-label="关闭预览">×</button>
            {isVideoPath(previewMedia)
              ? <video src={mediaUrl(previewMedia)} controls autoPlay />
              : <img src={mediaUrl(previewMedia)} alt={previewMedia.split('/').pop() || '大图预览'} />}
            <div className="media-lightbox-name">{previewMedia}</div>
          </div>
        </div>
      )}

      {publishSmsTask && (
        <div className="overlay">
          <div className="modal" style={{ maxWidth: 380 }}>
            <h3 style={{ margin: '0 0 4px' }}>发布验证 · {publishSmsTask.label}</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              {publishSmsTask.message || '平台要求短信验证，请输入收到的验证码。'}
            </p>
            <input inputMode="numeric" autoFocus placeholder="请输入手机收到的验证码" value={publishSmsCode}
              onChange={(e) => setPublishSmsCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
              onKeyDown={(e) => { if (e.key === 'Enter') void submitPublishSmsCode(); }}
              style={{ width: '100%', boxSizing: 'border-box', textAlign: 'center', letterSpacing: 6, fontSize: 20,
                padding: '10px 12px', margin: '4px 0 10px', border: '1px solid var(--border)', borderRadius: 8 }} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-sm btn-ghost" disabled={publishSmsBusy} onClick={stopPublish}>取消发布</button>
              <button className="btn btn-sm btn-primary" disabled={publishSmsBusy || publishSmsCode.length < 4}
                onClick={() => void submitPublishSmsCode()}>
                {publishSmsBusy ? '提交中…' : '提交验证码'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast ok"><span className="toast-icon">✓</span>{toast}</div>}
    </div>
  );
}
