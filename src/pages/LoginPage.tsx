import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { setToken } from '@/utils/auth';
import { currentApiMode } from '@/services/api/client';
import { authApi } from '@/services/api/authApi';
import { normalizeRole } from '@/services/auth/roleUtils';
import type { UserRole } from '@/types';
import {
  Radio,
  ScanLine,
  BrainCircuit,
  ShieldCheck,
  Activity,
  KeyRound,
  User,
  Lock,
  Sparkles,
  Loader2,
  type LucideIcon,
} from 'lucide-react';

const HOSPITAL_NAME =
  (typeof window !== 'undefined' &&
    (window as unknown as { __HOSPITAL_NAME__?: string }).__HOSPITAL_NAME__) ||
  '汉东省人民医院';

const DEMO_USERS: { label: string; role: UserRole; name: string }[] = [
  { label: '管理员 (admin)', role: '管理员', name: '系统管理员' },
  { label: '科主任 (director)', role: '主任', name: '张主任' },
  { label: '医生 (doctor)', role: '医生', name: '李医生' },
  { label: '技师 (technician)', role: '技师', name: '王技师' },
  { label: '护士 (nurse)', role: '护士', name: '赵护士' },
];

const BRAND_FEATURES: { icon: LucideIcon; title: string; desc: string }[] = [
  { icon: ScanLine, title: '影像诊断', desc: 'CT / MR / DR 多模态影像调阅与结构化报告' },
  { icon: BrainCircuit, title: 'AI 智能辅助', desc: '病灶智能提示与报告质控双重引擎' },
  { icon: ShieldCheck, title: '质控管理', desc: '危急值预警与审核流转全流程闭环' },
  { icon: Activity, title: '设备监测', desc: '设备状态实时监控与检查排程优化' },
];

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px 10px 36px',
  borderRadius: 10,
  border: '1px solid var(--border-color)',
  background: 'var(--bg-secondary)',
  color: 'var(--text-primary)',
  fontSize: 14,
  marginBottom: 14,
  boxSizing: 'border-box',
  outline: 'none',
};

/**
 * 登录页专属样式:
 *  - 品牌区呼吸渐变(浅/深/高对比均基于 --color-primary-* 变量)
 *  - 高对比模式: 品牌区纯黑底 + 黄标徽(与 antd HIGH_CONTRAST_TOKENS 对齐)
 *  - 窄屏(≤960px)隐藏品牌区, 仅保留表单
 */
const loginPageStyles = `
.login-brand {
  position: relative;
  overflow: hidden;
  background: linear-gradient(150deg, var(--color-primary-950) 0%, var(--color-primary-800) 38%, var(--color-primary-600) 100%);
  background-size: 180% 180%;
  animation: login-breathe 16s ease-in-out infinite;
}
@keyframes login-breathe {
  0%, 100% { background-position: 0% 30%; }
  50% { background-position: 100% 70%; }
}
.login-brand-card {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 12px;
  padding: 14px 16px;
  display: flex;
  gap: 12px;
  align-items: flex-start;
  transition: background 0.25s ease;
}
.login-brand-card:hover { background: rgba(255, 255, 255, 0.14); }
.login-brand-icon,
.login-brand-card-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: #fff;
}
.login-brand-card-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.15);
}
.login-brand-icon {
  width: 72px;
  height: 72px;
  border-radius: 18px;
  border: 2px solid rgba(255, 255, 255, 0.25);
  background: rgba(255, 255, 255, 0.14);
  backdrop-filter: blur(8px);
}
[data-theme='high-contrast'] .login-brand { background: #000000; animation: none; }
[data-theme='high-contrast'] .login-brand-card { background: rgba(255, 255, 255, 0.06); border-color: #ffffff; }
[data-theme='high-contrast'] .login-brand-icon,
[data-theme='high-contrast'] .login-brand-card-icon { background: #ffff00; border-color: #ffff00; color: #000000; }
@media (max-width: 960px) {
  .login-brand { display: none; }
}
`;

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, user } = useAuth();
  const [selectedRole, setSelectedRole] = useState<UserRole>('管理员');
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [_submitting, setSubmitting] = useState(false);

  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/';

  useEffect(() => {
    if (isAuthenticated && location.pathname === '/login') navigate(from, { replace: true });
  }, [isAuthenticated, navigate, from, location.pathname]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('请输入用户名和密码');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const response = await authApi.login(username.trim(), password);
      if (response.success && response.data?.token) {
        setToken({
          token: response.data.token,
          refreshToken: '',
          expiresAt: response.data.expiresAt ?? Date.now() + 15 * 60 * 1000,
          userId: response.data.userId ?? '',
          userName: response.data.userName ?? username.trim(),
          role: response.data.role ?? selectedRole,
        });
        // v3.0.6.11-73: real 模式下以服务端返回角色为准 (英文枚举, 已归一化);
        // mock 演示模式保留角色选择器 (中文), useAuth/useRBAC 均兼容两种格式
        const role = currentApiMode() === 'real' && response.data.role
          ? normalizeRole(response.data.role)
          : selectedRole;
        const payload = {
          id: response.data.userId || `demo-${selectedRole}`,
          name: response.data.userName || DEMO_USERS.find(d => d.role === selectedRole)?.name || selectedRole,
          role,
          department: '放射科',
          phone: '',
          username: username.trim(),
          title: response.data.title || DEMO_USERS.find(d => d.role === selectedRole)?.label || '',
        };
        try { localStorage.setItem('ris_current_user', JSON.stringify(payload)); } catch (e) { console.warn('[F03] Error:', (e as Error)?.message); }
        navigate(from, { replace: true });
        return;
      }
      if (currentApiMode() === 'real') {
        setError(response.error?.message ?? '登录失败');
        setSubmitting(false);
        return;
      }
    } catch (err) {
      if (currentApiMode() === 'real') {
        setError(err instanceof Error ? err.message : '登录失败');
        setSubmitting(false);
        return;
      }
    }
    const matched = DEMO_USERS.find((d) => d.role === selectedRole) ?? DEMO_USERS[0]!;
    const payload = {
      id: `demo-${selectedRole}`,
      name: matched.name,
      role: selectedRole,
      department: '放射科',
      phone: '',
      username: username.trim(),
      title: matched.label,
    };
    try {
      localStorage.setItem('ris_current_user', JSON.stringify(payload));
    } catch (err) {
      setError('无法写入登录状态: ' + (err as Error).message);
      setSubmitting(false);
      return;
    }
    navigate(from, { replace: true });
  };

  return (
    <main
      className="anim-fade-in"
      style={{
        minHeight: '100vh',
        display: 'flex',
        overflowY: 'auto',
        background: 'var(--bg-primary)',
        color: 'var(--text-primary)',
      }}
    >
      <style>{loginPageStyles}</style>

      {/* 左侧品牌区 */}
      <aside
        className="login-brand"
        style={{
          flex: '1.15 1 0%',
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: 'clamp(32px, 6vw, 88px)',
          color: '#fff',
        }}
      >
        {/* 背景装饰 */}
        <div style={{ position: 'absolute', top: -60, right: -60, width: 260, height: 260, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
        <div style={{ position: 'absolute', bottom: -40, right: 140, width: 140, height: 140, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />

        <div style={{ position: 'relative', zIndex: 1, maxWidth: 560 }}>
          <div className="login-brand-icon">
            <Radio size={40} color="currentColor" />
          </div>
          <h1 style={{ margin: '24px 0 8px', fontSize: 30, fontWeight: 800, letterSpacing: '1px', color: '#fff' }}>
            G005 放射信息系统
          </h1>
          <p style={{ margin: 0, fontSize: 17, fontWeight: 500, color: 'rgba(255,255,255,0.92)' }}>
            大型专业医学影像 · 诊断报告 · 智能辅助
          </p>
          <p style={{ margin: '10px 0 32px', fontSize: 13, lineHeight: 1.8, maxWidth: 480, color: 'rgba(255,255,255,0.66)' }}>
            面向大型医院的放射科信息管理平台，覆盖影像检查、诊断报告、AI 智能辅助与质量管理全流程。
          </p>
          <div
            className="anim-stagger"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 }}
          >
            {BRAND_FEATURES.map((f) => (
              <div key={f.title} className="login-brand-card">
                <div className="login-brand-card-icon">
                  <f.icon size={18} color="currentColor" />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{f.title}</div>
                  <div style={{ fontSize: 12, lineHeight: 1.6, color: 'rgba(255,255,255,0.7)' }}>{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* 右侧表单区 */}
      <section
        style={{
          flex: '1 1 0%',
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '64px 32px 104px',
          position: 'relative',
        }}
      >
        <form
          onSubmit={handleLogin}
          aria-label="登录表单"
          className="anim-fade-in-up"
          style={{
            width: 'min(400px, 100%)',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: 16,
            padding: '36px 32px',
            boxShadow: 'var(--shadow-xl)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--color-primary-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 }}>
              <Radio size={22} color="currentColor" />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>欢迎登录</h1>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
                G005 放射信息系统 · {HOSPITAL_NAME}
              </p>
            </div>
          </div>

          {user && (
            <div role="status" style={{ margin: '16px 0 4px', padding: '10px 12px', background: 'var(--color-info-bg)', border: '1px solid var(--color-info-border)', borderRadius: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
              当前已登录：<strong style={{ color: 'var(--text-primary)' }}>{user.name}</strong>（{user.role}）
            </div>
          )}

          {/* WCAG 2.1 AA: 颜色对比度 ≥ 4.5:1（正文）/ 3:1（大文本）。边框使用 var(--border-color)（深色模式 #334155，对比度 4.7:1） */}
          <label htmlFor="login-role" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, marginTop: 20 }}>
            演示角色
          </label>
          <div style={{ position: 'relative' }}>
            <KeyRound size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <select
              id="login-role"
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value as UserRole)}
              style={inputStyle}
            >
              {DEMO_USERS.map((d) => (
                <option key={d.role} value={d.role}>{d.label}</option>
              ))}
            </select>
          </div>

          <label htmlFor="login-username" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>用户名</label>
          <div style={{ position: 'relative' }}>
            <User size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <input
              id="login-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              style={inputStyle}
            />
          </div>

          <label htmlFor="login-password" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>密码</label>
          <div style={{ position: 'relative' }}>
            <Lock size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              style={inputStyle}
            />
          </div>

          {error && (
            <div role="alert" style={{ marginBottom: 14, padding: '10px 12px', background: 'var(--color-error-bg)', border: '1px solid var(--color-error-border)', color: 'var(--color-error)', borderRadius: 8, fontSize: 12 }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={_submitting}
            style={{
              width: '100%',
              padding: '11px 12px',
              borderRadius: 10,
              border: 'none',
              background: 'var(--color-accent)',
              color: 'var(--text-inverse)',
              fontSize: 15,
              fontWeight: 700,
              cursor: _submitting ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              opacity: _submitting ? 0.85 : 1,
            }}
          >
            {_submitting && <Loader2 size={16} className="anim-spin" />}
            {_submitting ? '登录中…' : '登录系统'}
          </button>

          <div style={{ marginTop: 18, padding: '12px 14px', background: 'var(--color-pending-bg)', border: '1px solid var(--color-pending-border)', borderRadius: 10, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Sparkles size={14} />
              演示环境
            </div>
            任意用户名与密码均可登录，选择角色后将以对应身份进入系统；生产环境将对接统一身份认证服务。
          </div>
        </form>

        <footer style={{ position: 'absolute', bottom: 20, left: 0, right: 0, textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
          © {new Date().getFullYear()} {HOSPITAL_NAME} · 放射科信息管理系统 · 仅供院内使用
        </footer>
      </section>
    </main>
  );
}
