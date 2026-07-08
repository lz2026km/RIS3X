import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import type { UserRole } from '@/types';

const DEMO_USERS: { label: string; role: UserRole; name: string }[] = [
  { label: '管理员 (admin)', role: '管理员', name: '系统管理员' },
  { label: '科主任 (director)', role: '主任', name: '张主任' },
  { label: '医生 (doctor)', role: '医生', name: '李医生' },
  { label: '技师 (technician)', role: '技师', name: '王技师' },
  { label: '护士 (nurse)', role: '护士', name: '赵护士' },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, user } = useAuth();
  const [selectedRole, setSelectedRole] = useState<UserRole>('管理员');
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('123');
  const [error, setError] = useState<string | null>(null);

  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/';

  useEffect(() => {
    if (isAuthenticated) navigate(from, { replace: true });
  }, [isAuthenticated, navigate, from]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('请输入用户名和密码');
      return;
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
      return;
    }
    setError(null);
    navigate(from, { replace: true });
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', color: '#e2e8f0' }}>
      <form onSubmit={handleLogin} style={{ background: '#1e293b', padding: 32, borderRadius: 12, width: 380, boxShadow: '0 12px 32px rgba(0,0,0,0.4)' }}>
        <h1 style={{ margin: 0, fontSize: 22, color: '#f8fafc' }}>RIS 登录</h1>
        <p style={{ marginTop: 6, marginBottom: 24, fontSize: 12, color: '#64748b' }}>
          演示模式：选择角色并提交后，将以该角色身份进入系统。
        </p>
        {user && (
          <div style={{ marginBottom: 12, padding: 10, background: '#0f172a', border: '1px solid #475569', borderRadius: 6, fontSize: 12 }}>
            当前已登录：<strong>{user.name}</strong>（{user.role}）
          </div>
        )}
        <label style={{ display: 'block', fontSize: 12, color: '#cbd5e1', marginBottom: 6 }}>角色</label>
        <select
          value={selectedRole}
          onChange={(e) => setSelectedRole(e.target.value as UserRole)}
          style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #475569', background: '#0f172a', color: '#f1f5f9', fontSize: 13, marginBottom: 14 }}
        >
          {DEMO_USERS.map((d) => (
            <option key={d.role} value={d.role}>{d.label}</option>
          ))}
        </select>
        <label style={{ display: 'block', fontSize: 12, color: '#cbd5e1', marginBottom: 6 }}>用户名</label>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #475569', background: '#0f172a', color: '#f1f5f9', fontSize: 13, marginBottom: 14, boxSizing: 'border-box' }}
        />
        <label style={{ display: 'block', fontSize: 12, color: '#cbd5e1', marginBottom: 6 }}>密码</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #475569', background: '#0f172a', color: '#f1f5f9', fontSize: 13, marginBottom: 14, boxSizing: 'border-box' }}
        />
        {error && (
          <div style={{ marginBottom: 12, padding: 8, background: '#7f1d1d', color: '#fee2e2', borderRadius: 6, fontSize: 12 }}>{error}</div>
        )}
        <button
          type="submit"
          style={{ width: '100%', padding: 12, borderRadius: 6, border: 'none', background: '#3b82f6', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
        >
          登录（演示）
        </button>
        <div style={{ marginTop: 16, fontSize: 12, color: '#64748b', lineHeight: 1.6 }}>
          演示账号：任意用户名 + 任意密码即可登录。生产环境需对接真实认证服务。
        </div>
      </form>
    </div>
  );
}
