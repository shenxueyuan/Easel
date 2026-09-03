import { useState } from 'react';

interface WelcomeGuideProps {
  onClose: () => void;
  onStart: () => void;       // 点击「开始使用」→ 进入对话页
  onConfigProfile: () => void; // 点击「配置画像」→ 打开画像向导
}

const ONBOARDING_KEY = 'easel_welcome_seen';

export function shouldShowWelcome(): boolean {
  return !localStorage.getItem(ONBOARDING_KEY);
}

export function markWelcomeSeen() {
  localStorage.setItem(ONBOARDING_KEY, '1');
}

const SLIDES = [
  {
    icon: '🎨',
    title: '一站式内容创作',
    desc: '从热点发现 → 选题策划 → 内容制作 → 平台发布 → 数据复盘，113 个 AI 技能帮你搞定全流程。',
    points: ['小红书图文笔记 + 知识卡片', 'AI 视频 + 配音 + BGM', '多平台一键发布'],
  },
  {
    icon: '💬',
    title: '对话即创作',
    desc: '在对话框里描述你的需求，AI 会自动调用合适的技能完成任务。不需要记命令，说人话就行。',
    points: ['"帮我写一条小红书种草笔记"', '"把这段文案做成 3 张知识卡片"', '"生成一个 15 秒产品视频"'],
  },
  {
    icon: '🎯',
    title: '账号画像让内容更懂你',
    desc: '配置你的账号画像（方向、调性、受众），AI 生成的内容会更贴合你的风格和平台调性。',
    points: ['支持多人设切换', 'AI 自动分析社媒链接', '内容风格一致性保障'],
  },
  {
    icon: '📱',
    title: '多平台自动发布',
    desc: '扫码登录小红书/抖音/B站等平台后，可以直接在 Easel 里发布内容，自动校验标题和媒体。',
    points: ['小红书图文 + 视频发布', '评论自动回复（防风控）', '发布前 dry-run 预检'],
  },
];

export default function WelcomeGuide({ onClose, onStart, onConfigProfile }: WelcomeGuideProps) {
  const [step, setStep] = useState(0);
  const isLast = step === SLIDES.length - 1;
  const slide = SLIDES[step];

  const handleFinish = () => {
    markWelcomeSeen();
    onClose();
  };

  const handleStart = () => {
    markWelcomeSeen();
    onStart();
  };

  const handleConfig = () => {
    markWelcomeSeen();
    onConfigProfile();
  };

  const chip: React.CSSProperties = {
    padding: '6px 14px', borderRadius: 999, fontSize: 13,
    border: '1px solid var(--border)', background: 'var(--bg-elev)',
    color: 'var(--text)', display: 'inline-block', margin: '4px 6px 4px 0',
  };

  return (
    <div className="overlay" style={{ zIndex: 1000 }}>
      <div className="modal" style={{ width: 520, maxWidth: '100%' }}>
        {/* 关闭按钮 */}
        <button onClick={handleFinish}
          style={{ position: 'absolute', top: 12, right: 16, background: 'none',
            border: 'none', color: 'var(--text-secondary)', fontSize: 22, cursor: 'pointer' }}>×</button>

        {/* 进度点 */}
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', margin: '8px 0 20px' }}>
          {SLIDES.map((_, i) => (
            <div key={i} style={{
              width: 8, height: 8, borderRadius: '50%',
              background: i === step ? 'var(--accent-start)' : 'var(--border)',
              transition: 'background 0.2s',
            }} />
          ))}
        </div>

        {/* 内容 */}
        <div style={{ textAlign: 'center', padding: '0 20px' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>{slide.icon}</div>
          <h2 style={{ fontSize: 20, margin: '0 0 10px' }}>{slide.title}</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6, margin: '0 0 16px' }}>
            {slide.desc}
          </p>
          <div style={{ textAlign: 'left', maxWidth: 380, margin: '0 auto' }}>
            {slide.points.map((p, i) => (
              <div key={i} style={chip}>{p}</div>
            ))}
          </div>
        </div>

        {/* 底部按钮 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24, padding: '0 20px' }}>
          <button className="btn" onClick={handleFinish} style={{ fontSize: 13 }}>
            跳过
          </button>
          {isLast ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn" onClick={handleStart}>
                直接开始
              </button>
              <button className="btn btn-primary" onClick={handleConfig}>
                配置画像 →
              </button>
            </div>
          ) : (
            <button className="btn btn-primary" onClick={() => setStep(step + 1)}>
              下一步 →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
