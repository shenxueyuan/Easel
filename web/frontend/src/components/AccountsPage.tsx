import { useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchAccounts, startLogin, loginStatus, mediaUrl,
  accountWhoami, logoutAccount, submitLoginSms,
  fetchWechatMpConfig, saveWechatMpAccount, deleteWechatMpAccount,
  checkWechatsync, installWechatsyncCli, installWechatsyncSkill, saveWechatsyncToken,
  checkWechatsyncExtension, extensionAction,
} from '../lib/api';
import type {
  AccountItem, AccountWhoami,
  WechatMpConfig, WechatMpAccount, WechatsyncStatus, WechatsyncExtensionStatus,
} from '../lib/api';
import { getWhoamiCache, setWhoamiCache, verifyStale } from '../lib/whoami';

type QRState = {
  platform: string;
  name: string;
  state: string;       // starting | qr_ready | success | expired | error | unknown
  message: string;
  qr: string;          // outputs 相对路径
  qrTs?: number;       // 二维码文件 mtime，作 img 缓存键：码刷新一次就变，避免看到过期旧码
};

const STATE_LABEL: Record<string, string> = {
  starting: '启动中…',
  qr_ready: '请扫码',
  scanned: '扫码成功',
  sms_required: '需短信验证',
  verifying: '验证中…',
  success: '登录成功 ✅',
  expired: '二维码已过期',
  error: '登录出错',
  unknown: '等待中…',
};

/** 头像：有 URL 就显示图（加载失败退回首字），否则显示昵称/平台名首字。 */
function Avatar({ url, name }: { url?: string; name: string }) {
  const [broken, setBroken] = useState(false);
  const initial = (name || '?').trim().charAt(0);
  if (url && !broken) {
    return <img className="account-avatar" src={url} alt={name}
      referrerPolicy="no-referrer" onError={() => setBroken(true)} />;
  }
  return <div className="account-avatar account-avatar-fallback">{initial}</div>;
}

// 平台登录方式说明（卡片下方展示）
const PLATFORM_GUIDE: Record<string, { method: string; tip: string; contentType: string }> = {
  'xiaohongshu': {
    method: '手机小红书 App 扫码',
    tip: '需干净/家宽 IP，机房 IP 可能被拦。登录态持久化到本地，之后发布免登。',
    contentType: '图文 / 视频',
  },
  'douyin': {
    method: '手机抖音 App 扫码',
    tip: '发布时可能触发短信风控，页面会弹框让你输入验证码。建议用干净 IP。',
    contentType: '视频 / 图文',
  },
  'weixin-channels': {
    method: '手机微信扫码',
    tip: '用个人微信扫码登录视频号助手。与公众号是独立账号，不通用。',
    contentType: '视频（竖版 9:16）',
  },
  'zhihu': {
    method: '手机知乎 App 或微信扫码',
    tip: '支持专栏文章和问答回答两种发布模式。',
    contentType: '专栏文章 / 问答回答',
  },
  'bilibili': {
    method: 'B站 App 扫码',
    tip: '基于 biliup CLI，登录后 cookie 持久化。横版 16:9 为主。',
    contentType: '视频 / 图文',
  },
  'kuaishou': {
    method: '手机快手 App 扫码',
    tip: '快手发布 token 偏短命，可能需要比其他平台更勤地重新扫码。',
    contentType: '视频（竖版 9:16）',
  },
};

// 公众号走 API 模式，不在 LOGIN_RUNNERS 里，单独说明
const WECHAT_MP_GUIDE = {
  method: 'API 密钥（AppID + AppSecret）',
  tip: '在「公众号后台 → 开发 → 基本配置」获取，填入 wechat-publisher.yaml。需把本机 IP 加到公众号 IP 白名单。',
  contentType: '图文文章',
  configPath: 'skills/openclaw/skill-wechat-publisher/wechat-publisher.yaml',
};

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [err, setErr] = useState('');
  const [qr, setQr] = useState<QRState | null>(null);
  const [qrNonce, setQrNonce] = useState(0);   // 每次登录 +1，稳定缓存 key，避免每次轮询 img 闪烁
  const [terminalMsg, setTerminalMsg] = useState('');
  const [busy, setBusy] = useState('');
  const [logoutBusy, setLogoutBusy] = useState('');
  const [smsCode, setSmsCode] = useState('');
  const [smsBusy, setSmsBusy] = useState(false);
  const [smsErr, setSmsErr] = useState('');
  const [showGuide, setShowGuide] = useState(false);   // 一稿多发配置指南折叠
  // whoami 结果缓存到 localStorage：打开页面秒显示昵称/头像，不必每次都起浏览器校验
  const [whoami, setWhoami] = useState<Record<string, AccountWhoami | 'loading'>>(() => getWhoamiCache());
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const aliveRef = useRef(true);
  const qrPlatformRef = useRef('');   // 当前登录中的平台，供 submitSms 稳定引用

  useEffect(() => {
    aliveRef.current = true;
    return () => { aliveRef.current = false; };
  }, []);

  // 真校验某平台登录态 + 拉昵称/头像（后端起浏览器，数秒）；手动「校验账号」或登录成功后调
  const runWhoami = useCallback((platform: string) => {
    setWhoami((w) => ({ ...w, [platform]: 'loading' }));
    accountWhoami(platform)
      .then((r) => { if (aliveRef.current) { setWhoami((w) => ({ ...w, [platform]: r })); setWhoamiCache(platform, r); } })
      .catch(() => {
        if (aliveRef.current) setWhoami((w) => { const n = { ...w }; delete n[platform]; return n; });
      });
  }, []);

  // 打开页面：拉「快」状态（读 status.json，不起浏览器），随后后台自愈——对缓存缺失/过期的
  // 浏览器平台逐个真校验（whoami），结果到了刷新 UI，并令陈旧的假阴性缓存被真值覆盖。
  const load = useCallback(() => {
    setErr('');
    fetchAccounts()
      .then((list) => {
        if (!aliveRef.current) return;
        setAccounts(list);
        const targets = list
          .filter((a) => a.supported && a.backend !== 'biliup')
          .map((a) => a.platform);
        verifyStale(targets, {
          alive: () => aliveRef.current,
          onUpdate: (platform, r) => setWhoami((w) => ({ ...w, [platform]: r })),
        });
      })
      .catch(() => setErr('加载账号状态失败'));
  }, []);

  useEffect(() => { load(); }, [load]);

  const stopPoll = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  useEffect(() => () => stopPoll(), [stopPoll]);

  const closeQr = useCallback(() => {
    stopPoll();
    setQr(null);
    setSmsCode(''); setSmsErr(''); setSmsBusy(false);
    load();
  }, [stopPoll, load]);

  const submitSms = useCallback(async () => {
    const code = smsCode.replace(/\D/g, '');
    if (code.length < 4) { setSmsErr('请输入手机收到的验证码'); return; }
    setSmsBusy(true); setSmsErr('');
    try {
      await submitLoginSms(qrPlatformRef.current, code);
      setSmsCode('');
      // 乐观切到「验证中」转圈：后端读走码→verifying；成功→success，失败→退回 sms_required 带错误
      setQr((prev) => prev && ({ ...prev, state: 'verifying', message: '正在验证验证码…' }));
      // 不停轮询：runner 读走验证码填码提交后，state 会转 success / 或退回 sms_required 重试
    } catch (e) {
      setSmsErr(e instanceof Error ? e.message : '提交验证码失败');
    } finally {
      setSmsBusy(false);
    }
  }, [smsCode]);

  const handleLogin = useCallback(async (a: AccountItem) => {
    if (!a.supported) return;
    setTerminalMsg('');
    setBusy(a.platform);
    setSmsCode(''); setSmsErr('');
    qrPlatformRef.current = a.platform;
    setQrNonce((n) => n + 1);
    try {
      const res = await startLogin(a.platform);
      if (res.mode === 'terminal') {
        setTerminalMsg(res.message || '请在终端登录');
        return;
      }
      setQr({ platform: a.platform, name: a.name, state: res.state || 'starting',
              message: res.message || '', qr: res.qr || '' });   // qrTs 由随后的轮询填入
      stopPoll();
      pollRef.current = setInterval(async () => {
        try {
          const s = await loginStatus(a.platform);
          setQr((prev) => prev && ({ ...prev, state: s.state, message: s.message, qr: s.qr, qrTs: s.qrTs }));
          if (['success', 'expired', 'error'].includes(s.state)) {
            stopPoll();
            if (s.state === 'success') runWhoami(a.platform);   // 登录成功即拉账号信息
          }
        } catch { /* 忽略单次轮询失败 */ }
      }, 2000);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '启动登录失败');
    } finally {
      setBusy('');
    }
  }, [stopPoll, runWhoami]);

  const handleLogout = useCallback(async (a: AccountItem) => {
    if (!window.confirm(`确定退出「${a.name}」的登录？登录态将被清除，下次发布需重新扫码。`)) return;
    setLogoutBusy(a.platform);
    try {
      await logoutAccount(a.platform);
      setWhoami((w) => { const n = { ...w }; delete n[a.platform]; return n; });
      setWhoamiCache(a.platform, null);
      load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : '退出登录失败');
    } finally {
      setLogoutBusy('');
    }
  }, [load]);

  // 卡片真实登录态：whoami 权威（已返回则以它为准，自愈假阳性），否则用后端 last-known
  const effLoggedIn = (a: AccountItem): boolean => {
    const w = whoami[a.platform];
    if (w && w !== 'loading') return w.loggedIn;
    return a.loggedIn;
  };

  const badge = (a: AccountItem) => {
    if (!a.supported) return <span className="badge">待重写</span>;
    if (whoami[a.platform] === 'loading') return <span className="badge">校验中…</span>;
    if (effLoggedIn(a)) return <span className="badge badge-ok">✓ 已登录</span>;
    return <span className="badge">未登录</span>;
  };

  return (
    <div className="accounts-page">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h1 className="page-title">账号登录 Accounts</h1>
          <p className="page-subtitle">
            用手机 App 扫码登录，登录态本地持久化，之后发布免登。<br />
            ⚠️ 平台可能对机房/代理 IP 判风险导致二维码弹不出，需干净/家宽 IP，或在正常网络登录后拷贝登录态目录。
          </p>
        </div>
        <button className="btn btn-sm" onClick={load}>⟳ 刷新</button>
      </div>

      {/* 一稿多发配置指南 */}
      <div className="card" style={{ marginTop: 14, padding: 0, overflow: 'hidden' }}>
        <button
          onClick={() => setShowGuide((v) => !v)}
          style={{
            width: '100%', padding: '12px 16px', border: 'none', background: 'none',
            textAlign: 'left', cursor: 'pointer', fontSize: 14, fontWeight: 600,
            color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8,
          }}>
          <span style={{ color: 'var(--accent-start)', fontSize: 16 }}>{showGuide ? '▾' : '▸'}</span>
          一稿多发配置指南
          <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 400 }}>
            登录各平台后即可一稿多发
          </span>
        </button>
        {showGuide && (
          <div style={{ padding: '0 16px 16px', fontSize: 13, lineHeight: 1.7, color: 'var(--text-secondary)' }}>
            <h4 style={{ margin: '8px 0 4px', fontSize: 13, color: 'var(--text)' }}>支持的平台（7 个原生 + 1 个 API）</h4>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginTop: 8 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--text-tertiary)' }}>
                  <th style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)' }}>平台</th>
                  <th style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)' }}>登录方式</th>
                  <th style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)' }}>内容类型</th>
                  <th style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)' }}>登录入口</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(PLATFORM_GUIDE).map(([pf, g]) => (
                  <tr key={pf}>
                    <td style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)' }}>
                      {pf === 'xiaohongshu' ? '小红书' : pf === 'douyin' ? '抖音' : pf === 'weixin-channels' ? '微信视频号' : pf === 'zhihu' ? '知乎' : pf === 'bilibili' ? 'B站' : pf === 'kuaishou' ? '快手' : pf}
                    </td>
                    <td style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)' }}>{g.method}</td>
                    <td style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)' }}>{g.contentType}</td>
                    <td style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)' }}>本页扫码登录</td>
                  </tr>
                ))}
                <tr>
                  <td style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)' }}>微信公众号</td>
                  <td style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)' }}>{WECHAT_MP_GUIDE.method}</td>
                  <td style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)' }}>{WECHAT_MP_GUIDE.contentType}</td>
                  <td style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)', fontSize: 11, color: 'var(--text-tertiary)' }}>
                    配置文件<br /><code>{WECHAT_MP_GUIDE.configPath}</code>
                  </td>
                </tr>
              </tbody>
            </table>

            <h4 style={{ margin: '16px 0 4px', fontSize: 13, color: 'var(--text)' }}>操作步骤</h4>
            <ol style={{ margin: 0, paddingLeft: 20 }}>
              <li><b>逐平台登录</b>：在下方账号卡片点「登录」，用手机 App 扫码。公众号需编辑 YAML 配置文件。</li>
              <li><b>确认登录态</b>：卡片显示「✓ 已登录」即可。快手 token 易过期，可能需重扫。</li>
              <li><b>一稿多发</b>：在「对话」页说「把这份内容发到小红书、抖音、B站」，系统自动适配各平台格式并逐平台发布。</li>
              <li><b>发布前确认</b>：每次发布前系统会展示标题、简介、媒体，确认后才执行。</li>
            </ol>

            <h4 style={{ margin: '16px 0 4px', fontSize: 13, color: 'var(--text)' }}>注意事项</h4>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              <li>视频号与公众号是<b>独立账号</b>，不通用。视频号用微信扫码，公众号用 API 密钥。</li>
              <li>各平台内容格式不同（竖版/横版、字数限制、话题标签数量），系统会自动适配。</li>
              <li>自动化发布有风控风险，建议优先用测试号、小流量验证。</li>
              <li>登录态存储在 <code>~/.easel-browser-profiles/</code>，属敏感信息，不外泄。</li>
            </ul>
          </div>
        )}
      </div>

      {err && <div style={{ color: 'var(--red)', fontSize: 13, marginTop: 12 }}>{err}</div>}
      {terminalMsg && (
        <div className="card" style={{ padding: 13, fontSize: 13, marginTop: 14 }}>{terminalMsg}</div>
      )}

      <div className="accounts-grid">
        {accounts.map((a) => {
          const w = whoami[a.platform];
          const info = w && w !== 'loading' ? w : null;
          const logged = effLoggedIn(a);
          return (
            <div key={a.platform} className="card account-card" style={{ opacity: a.supported ? 1 : 0.6 }}>
              <div className="account-card-head">
                <span className="account-card-name">{a.name}</span>
                {badge(a)}
              </div>

              {logged && info && (
                <div className="account-identity">
                  <Avatar url={info.avatar} name={info.name || a.name} />
                  <span className="account-nick">{info.name || '（已登录）'}</span>
                </div>
              )}
              {!logged && (
                <div className="account-card-note">{a.note ? a.note : `后端：${a.backend}`}</div>
              )}

              {/* 登录方式说明 */}
              {PLATFORM_GUIDE[a.platform] && (
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6, lineHeight: 1.5 }}>
                  <div>登录方式：{PLATFORM_GUIDE[a.platform].method}</div>
                  <div>内容类型：{PLATFORM_GUIDE[a.platform].contentType}</div>
                  {!logged && (
                    <div style={{ marginTop: 2, color: 'var(--text-tertiary)' }}>
                      {PLATFORM_GUIDE[a.platform].tip}
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
                {logged ? (
                  <>
                    <button className="btn btn-sm" style={{ flex: 1 }}
                      disabled={busy === a.platform || w === 'loading'}
                      onClick={() => runWhoami(a.platform)}>
                      {w === 'loading' ? '校验中…' : '校验账号'}
                    </button>
                    <button className="btn btn-sm btn-ghost" style={{ flex: 1 }}
                      disabled={logoutBusy === a.platform}
                      onClick={() => handleLogout(a)}>
                      {logoutBusy === a.platform ? '退出中…' : '退出登录'}
                    </button>
                  </>
                ) : (
                  <button
                    className={`btn btn-block ${a.supported ? 'btn-primary' : ''}`}
                    disabled={!a.supported || busy === a.platform}
                    onClick={() => handleLogin(a)}>
                    {busy === a.platform ? '启动中…' : '登录'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 微信公众号：在线配置 */}
      <WechatMpConfigSection />

      {/* Wechatsync：在线自检 + 安装 + Token 配置 */}
      <WechatsyncSection />

      {qr && (
        <div className="overlay" onClick={closeQr}>
          <div className="modal" style={{ width: 360, maxWidth: '100%', textAlign: 'center' }}
            onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 4px' }}>登录 {qr.name}</h3>
            <div style={{ fontSize: 13, marginBottom: 14,
              color: qr.state === 'success' ? 'var(--green)'
                : ['error', 'expired'].includes(qr.state) ? 'var(--red)' : 'var(--text-secondary)' }}>
              {STATE_LABEL[qr.state] || qr.state}{qr.message ? ` — ${qr.message}` : ''}
            </div>
            {qr.state === 'sms_required' ? (
              <div style={{ padding: '6px 4px 2px' }}>
                <div style={{ fontSize: 13, marginBottom: 10,
                  color: /错误|过期|失败|重新|未找到|未完成|不正确|失效/.test(qr.message || '')
                    ? 'var(--red)' : 'var(--text-secondary)' }}>
                  {qr.message || '平台风控要求短信验证，验证码已发到你手机，请输入：'}
                </div>
                <input
                  value={smsCode}
                  onChange={(e) => setSmsCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  onKeyDown={(e) => { if (e.key === 'Enter') submitSms(); }}
                  placeholder="短信验证码" inputMode="numeric" autoFocus
                  style={{ width: '100%', boxSizing: 'border-box', textAlign: 'center',
                    letterSpacing: 6, fontSize: 20, padding: '10px 12px',
                    border: '1px solid var(--border)', borderRadius: 8 }} />
                {smsErr && <div style={{ color: 'var(--red)', fontSize: 12, marginTop: 6 }}>{smsErr}</div>}
                <button className="btn btn-primary btn-block" style={{ marginTop: 12 }}
                  disabled={smsBusy} onClick={submitSms}>
                  {smsBusy ? '提交中…' : '提交验证码'}
                </button>
              </div>
            ) : qr.state === 'qr_ready' && qr.qr ? (
              <img className="qr-img" src={`${mediaUrl(qr.qr)}?v=${qr.qrTs || qrNonce}`} alt="登录二维码" />
            ) : qr.state === 'scanned' ? (
              <div className="loading" style={{ padding: 40 }}><div className="spinner" />扫码成功，正在跳转验证…（首次可能等十几秒）</div>
            ) : qr.state === 'verifying' ? (
              <div className="loading" style={{ padding: 40 }}><div className="spinner" />正在验证验证码，登录中…</div>
            ) : qr.state === 'success' ? (
              <div style={{ fontSize: 48, padding: 40 }}>✅</div>
            ) : ['error', 'expired'].includes(qr.state) ? (
              <div style={{ fontSize: 13, color: 'var(--red)', padding: 30 }}>
                {qr.message || '登录失败'}<br />可关闭后重试（或换干净 IP）。
              </div>
            ) : (
              <div className="loading" style={{ padding: 40 }}><div className="spinner" />准备二维码…</div>
            )}
            <div style={{ marginTop: 16 }}>
              <button className="btn" onClick={closeQr}>{qr.state === 'success' ? '完成' : '关闭'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// ============================================================
// 微信公众号在线配置组件
// ============================================================

function WechatMpConfigSection() {
  const [config, setConfig] = useState<WechatMpConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<WechatMpAccount | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ key: '', name: '', app_id: '', app_secret: '', author: '', theme: 'refined-blue', set_default: true });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    fetchWechatMpConfig()
      .then((c) => { setConfig(c); setLoading(false); })
      .catch(() => { setConfig(null); setLoading(false); });
  }, []);

  useEffect(() => { load(); }, [load]);

  const startEdit = (acc: WechatMpAccount) => {
    setEditing(acc);
    setForm({ key: acc.key, name: acc.name, app_id: acc.app_id, app_secret: '', author: acc.author, theme: acc.theme || 'refined-blue', set_default: acc.is_default });
    setShowForm(true);
    setMsg('');
  };

  const startAdd = () => {
    setEditing(null);
    setForm({ key: '', name: '', app_id: '', app_secret: '', author: '', theme: 'refined-blue', set_default: true });
    setShowForm(true);
    setMsg('');
  };

  const handleSave = async () => {
    if (!form.key.trim()) { setMsg('账号 key 不能为空'); return; }
    if (!form.app_id.trim()) { setMsg('AppID 不能为空'); return; }
    if (!editing && !form.app_secret.trim()) { setMsg('AppSecret 不能为空（新增时必填）'); return; }
    setSaving(true); setMsg('');
    try {
      await saveWechatMpAccount(form);
      setShowForm(false);
      load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (key: string) => {
    if (!window.confirm(`确定删除公众号账号「${key}」？`)) return;
    try {
      await deleteWechatMpAccount(key);
      load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '删除失败');
    }
  };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '24px 0 10px' }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: 'var(--text)' }}>
          微信公众号配置
        </h2>
        <button className="btn btn-sm btn-primary" onClick={startAdd}>+ 新增账号</button>
      </div>

      {loading && <div className="card" style={{ padding: 14, fontSize: 13, color: 'var(--text-tertiary)' }}>加载中…</div>}

      {config && config.accounts.length === 0 && !loading && (
        <div className="card" style={{ padding: 14, fontSize: 13, color: 'var(--text-secondary)' }}>
          尚未配置公众号账号。点击「新增账号」填入 AppID 和 AppSecret 即可。
          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-tertiary)' }}>
            获取方式：mp.weixin.qq.com → 设置 → 开发 → 基本配置 → 获取 AppID/AppSecret<br />
            需把本机 IP 加入公众号 IP 白名单。
          </div>
        </div>
      )}

      <div className="accounts-grid">
        {config?.accounts.map((acc) => (
          <div key={acc.key} className="card account-card">
            <div className="account-card-head">
              <span className="account-card-name">{acc.name || acc.key}</span>
              {acc.is_default && <span className="badge badge-ok">默认</span>}
              {!acc.is_default && <span className="badge">{acc.key}</span>}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6, lineHeight: 1.6 }}>
              <div>AppID：<code>{acc.app_id || '未配置'}</code></div>
              <div>AppSecret：{acc.app_secret_configured ? <span style={{ color: 'var(--green)' }}>{acc.app_secret_masked} ✓</span> : <span style={{ color: 'var(--red)' }}>未配置</span>}</div>
              <div>作者：{acc.author || '—'}</div>
              <div>主题：{acc.theme || '—'}</div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
              <button className="btn btn-sm" style={{ flex: 1 }} onClick={() => startEdit(acc)}>编辑</button>
              <button className="btn btn-sm btn-ghost" style={{ flex: 1 }} onClick={() => handleDelete(acc.key)}>删除</button>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="overlay" onClick={() => setShowForm(false)}>
          <div className="modal" style={{ width: 440, maxWidth: '100%' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 12px' }}>{editing ? '编辑公众号账号' : '新增公众号账号'}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                账号 Key（英文标识，如 main / tech）
                <input value={form.key} disabled={!!editing}
                  onChange={(e) => setForm({ ...form, key: e.target.value.replace(/[^a-zA-Z0-9_-]/g, '') })}
                  placeholder="main" style={inputStyle} />
              </label>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                账号名称
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="我的主公众号" style={inputStyle} />
              </label>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                AppID
                <input value={form.app_id} onChange={(e) => setForm({ ...form, app_id: e.target.value })}
                  placeholder="wx1234567890abcdef" style={inputStyle} />
              </label>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                AppSecret{editing && <span style={{ color: 'var(--text-tertiary)' }}>（留空=不修改）</span>}
                <input value={form.app_secret} type="password"
                  onChange={(e) => setForm({ ...form, app_secret: e.target.value })}
                  placeholder={editing ? '••••••（不修改留空）' : 'your_app_secret'} style={inputStyle} />
              </label>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                作者名
                <input value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })}
                  placeholder="飞哥" style={inputStyle} />
              </label>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                排版主题
                <select value={form.theme} onChange={(e) => setForm({ ...form, theme: e.target.value })} style={inputStyle}>
                  {['refined-blue', 'minimal-mono', 'warm-handdrawn', 'infographic-warm', 'infographic-blue', 'marker-lime', 'hand-drawn-blue'].map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </label>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="checkbox" checked={form.set_default}
                  onChange={(e) => setForm({ ...form, set_default: e.target.checked })} />
                设为默认账号
              </label>
              {msg && <div style={{ color: 'var(--red)', fontSize: 12 }}>{msg}</div>}
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button className="btn btn-primary" style={{ flex: 1 }} disabled={saving} onClick={handleSave}>
                  {saving ? '保存中…' : '保存'}
                </button>
                <button className="btn" onClick={() => setShowForm(false)}>取消</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const inputStyle: React.CSSProperties = {
  display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 4,
  padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6,
  fontSize: 13, background: 'var(--surface)',
};


// ============================================================
// Wechatsync 在线配置组件
// ============================================================

function WechatsyncSection() {
  const [status, setStatus] = useState<WechatsyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [cliBusy, setCliBusy] = useState(false);
  const [skillBusy, setSkillBusy] = useState(false);
  const [extStatus, setExtStatus] = useState<WechatsyncExtensionStatus | null>(null);
  const [extBusy, setExtBusy] = useState('');
  const [tokenInput, setTokenInput] = useState('');
  const [tokenSaving, setTokenSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([checkWechatsync(), checkWechatsyncExtension()])
      .then(([s, e]) => { setStatus(s); setExtStatus(e); setLoading(false); })
      .catch(() => { setStatus(null); setExtStatus(null); setLoading(false); });
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleInstallCli = async () => {
    setCliBusy(true); setMsg('');
    try {
      const r = await installWechatsyncCli('install');
      if (r.ok) {
        setMsg('✓ @wechatsync/cli 安装成功');
        load();
      } else {
        setMsg(`✗ 安装失败：${r.stderr || r.stdout || '未知错误'}`);
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '安装失败');
    } finally {
      setCliBusy(false);
    }
  };

  const handleInstallSkill = async () => {
    setSkillBusy(true); setMsg('');
    try {
      const r = await installWechatsyncSkill();
      if (r.ok) {
        setMsg('✓ Wechatsync 技能安装成功');
        load();
      } else {
        setMsg(`✗ 技能安装失败：${r.stderr || r.stdout || '未知错误'}`);
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '技能安装失败');
    } finally {
      setSkillBusy(false);
    }
  };

  const handleExtAction = async (action: 'unzip' | 'launch' | 'download') => {
    setExtBusy(action); setMsg('');
    try {
      const r = await extensionAction(action);
      if (r.ok) {
        setMsg(`✓ ${r.message}`);
        load();
      } else {
        setMsg(`✗ ${r.message}`);
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '操作失败');
    } finally {
      setExtBusy('');
    }
  };

  const handleSaveToken = async () => {
    if (!tokenInput.trim()) { setMsg('Token 不能为空'); return; }
    setTokenSaving(true); setMsg('');
    try {
      await saveWechatsyncToken(tokenInput.trim());
      setTokenInput('');
      setMsg('✓ Token 保存成功');
      load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '保存失败');
    } finally {
      setTokenSaving(false);
    }
  };

  return (
    <>
      <h2 style={{ fontSize: 15, fontWeight: 600, margin: '24px 0 10px', color: 'var(--text)' }}>
        Wechatsync 多平台同步
      </h2>
      <div className="card" style={{ padding: 16, fontSize: 13, lineHeight: 1.6 }}>
        <p style={{ margin: '0 0 10px', color: 'var(--text-secondary)' }}>
          通过 Wechatsync 同步图文到头条、掘金、CSDN 等 13 个平台（均存为草稿）。
          按以下 3 步操作，完成后即可在对话页说「同步到头条」来使用。
        </p>

        {/* 支持平台标签 */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '10px 0' }}>
          {['头条', '掘金', 'CSDN', '简书', 'SegmentFault', '开源中国', '博客园', '51CTO', 'InfoQ', '微博', '豆瓣', '百家号', '搜狐号'].map((p) => (
            <span key={p} className="badge" style={{ fontSize: 11 }}>{p}</span>
          ))}
        </div>

        {loading && <div style={{ color: 'var(--text-tertiary)' }}>检查中…</div>}

        {status && (
          <div style={{ marginTop: 12 }}>
            {/* 步骤 1：安装 Chrome 扩展（一键解压 + 启动 Chrome 加载） */}
            <div style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 16 }}>{extStatus?.unzipped ? '✅' : '🧩'}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>
                    步骤 1：安装 Chrome 扩展
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                    {extStatus?.unzipped
                      ? '扩展已解压就绪 — 点击「启动 Chrome 加载」'
                      : '项目已预置扩展包，一键解压后启动 Chrome 自动加载'}
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 8, padding: '10px 12px', background: 'var(--surface)', borderRadius: 6, fontSize: 12, lineHeight: 1.7 }}>
                <div style={{ color: 'var(--text-secondary)' }}>
                  扩展包已预置在项目 <code>assets/extensions/</code> 目录，无需去应用商店下载。<br />
                  ① 点击「解压扩展」解压到本地<br />
                  ② 点击「启动 Chrome」自动加载扩展<br />
                  ③ Chrome 打开后右上角出现 Wechatsync 图标即安装成功
                </div>
                {extStatus && !extStatus.chrome_found && (
                  <div style={{ marginTop: 6, color: 'var(--red)', fontSize: 11 }}>
                    ⚠ 未检测到 Chrome 浏览器，请先安装 Chrome 或 Edge。
                    也可手动从{' '}
                    <a href="https://chrome.google.com/webstore/detail/hchobocdmclopcbnibdnoafilagadion" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-start)' }}>
                      Chrome 应用商店
                    </a>{' '}
                    安装。
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                {extStatus && !extStatus.unzipped && (
                  <button className="btn btn-sm btn-primary" disabled={!!extBusy}
                    onClick={() => handleExtAction('unzip')}>
                    {extBusy === 'unzip' ? '解压中…' : '解压扩展'}
                  </button>
                )}
                {extStatus?.unzipped && (
                  <button className="btn btn-sm btn-primary" disabled={!!extBusy || !extStatus.chrome_found}
                    onClick={() => handleExtAction('launch')}>
                    {extBusy === 'launch' ? '启动中…' : '启动 Chrome 加载'}
                  </button>
                )}
                {extStatus && !extStatus.zip_exists && (
                  <button className="btn btn-sm" disabled={!!extBusy}
                    onClick={() => handleExtAction('download')}>
                    {extBusy === 'download' ? '下载中…' : '下载扩展包'}
                  </button>
                )}
                <a href="https://chrome.google.com/webstore/detail/hchobocdmclopcbnibdnoafilagadion"
                  target="_blank" rel="noreferrer"
                  style={{ fontSize: 11, color: 'var(--accent-start)', alignSelf: 'center' }}>
                  或从应用商店安装 →
                </a>
              </div>
            </div>

            {/* 步骤 2：在扩展里登录平台 + 获取 Token */}
            <div style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 16 }}>{status.token_configured ? '✅' : '⬜'}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>
                    步骤 2：登录平台 + 获取 MCP Token
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                    {status.token_configured
                      ? `已配置：${status.token_masked}`
                      : 'Token 从 Chrome 扩展里生成，不是自己编的'}
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 8, padding: '10px 12px', background: 'var(--surface)', borderRadius: 6, fontSize: 12, lineHeight: 1.7 }}>
                <div style={{ fontWeight: 600, marginBottom: 4, color: 'var(--text)' }}>操作方法：</div>
                <div style={{ color: 'var(--text-secondary)' }}>
                  ① 点击浏览器右上角 Wechatsync 图标<br />
                  ② 在扩展里登录你要同步的平台（头条/掘金/CSDN 等）<br />
                  ③ 进入扩展「设置」→ 找到「MCP 连接」→ 开启<br />
                  ④ 点击「生成 Token」，复制这串字符<br />
                  ⑤ 粘贴到下方输入框，点「保存 Token」
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, padding: '8px 0 0' }}>
                <input
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder="粘贴从 Chrome 扩展复制的 MCP Token"
                  style={{ flex: 1, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }}
                />
                <button className="btn btn-sm btn-primary" disabled={tokenSaving || !tokenInput.trim()} onClick={handleSaveToken}>
                  {tokenSaving ? '保存中…' : '保存 Token'}
                </button>
              </div>
            </div>

            {/* 步骤 3：安装 CLI（后端命令行工具） */}
            <div style={{ padding: '12px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 16 }}>{status.cli_installed ? '✅' : '⬜'}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>
                    步骤 3：安装命令行工具 CLI
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                    {status.cli_installed
                      ? `已安装：${status.cli_path}${status.cli_version ? ` (${status.cli_version})` : ''}`
                      : '这是后端执行同步用的命令行工具，不是浏览器插件'}
                  </div>
                </div>
                {!status.cli_installed && (
                  <button className="btn btn-sm btn-primary" disabled={cliBusy} onClick={handleInstallCli}>
                    {cliBusy ? '安装中…' : '一键安装'}
                  </button>
                )}
              </div>
              {!status.cli_installed && (
                <div style={{ marginTop: 8, padding: '10px 12px', background: 'var(--surface)', borderRadius: 6, fontSize: 12, lineHeight: 1.7, color: 'var(--text-secondary)' }}>
                  点击「一键安装」即可，后端自动执行 <code>npm install -g @wechatsync/cli</code>。
                  安装后此步骤显示 ✅。
                </div>
              )}
            </div>

            {/* 步骤 4：安装 OpenClaw 技能（让 AI 能直接调用） */}
            <div style={{ padding: '12px 0', borderTop: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 16 }}>{status.skill_installed ? '✅' : '⬜'}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>
                    步骤 4：安装 OpenClaw 技能（让 AI 直接调用）
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                    {status.skill_installed
                      ? '已安装 — AI 可直接用「同步到头条」等指令操作'
                      : '安装后 AI 能自动调用 wechatsync，无需手动敲命令'}
                  </div>
                </div>
                {!status.skill_installed && (
                  <button className="btn btn-sm btn-primary" disabled={skillBusy} onClick={handleInstallSkill}>
                    {skillBusy ? '安装中…' : '一键安装'}
                  </button>
                )}
              </div>
              {!status.skill_installed && (
                <div style={{ marginTop: 8, padding: '10px 12px', background: 'var(--surface)', borderRadius: 6, fontSize: 12, lineHeight: 1.7, color: 'var(--text-secondary)' }}>
                  安装后 AI 能识别「同步到头条/掘金/CSDN」等指令，自动调用 wechatsync CLI 执行同步。
                  支持 27+ 平台，比手动操作更方便。
                </div>
              )}
            </div>

            {/* 整体状态 */}
            <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 6,
              background: status.ready ? 'rgba(34,197,94,0.08)' : 'rgba(245,158,11,0.08)',
              fontSize: 12,
              color: status.ready ? 'var(--green)' : 'var(--text-secondary)' }}>
              {status.ready
                ? '✓ Wechatsync 环境就绪！可在对话页说「同步到头条、掘金」来使用。'
                : '⚠ 尚未就绪 — 按顺序完成上述 3 步后即可使用。'}
            </div>
          </div>
        )}

        {msg && <div style={{ marginTop: 10, fontSize: 12, color: msg.startsWith('✓') ? 'var(--green)' : 'var(--red)' }}>{msg}</div>}
      </div>
    </>
  );
}
