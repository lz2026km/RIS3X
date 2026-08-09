import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

export default function ForbiddenPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', color: '#e2e8f0' }}>
      <div style={{ background: '#1e293b', padding: 32, borderRadius: 12, width: 420, textAlign: 'center', boxShadow: '0 12px 32px rgba(0,0,0,0.4)' }}>
        <div style={{ fontSize: 56, fontWeight: 800, color: '#ef4444', marginBottom: 8 }}>403</div>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#f8fafc' }}>无访问权限</h1>
        <p style={{ marginTop: 8, marginBottom: 20, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          {user
            ? `当前用户 ${user.name}（${user.role}）无权访问该页面。`
            : '请先登录后再访问该页面。'}
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button
            onClick={() => navigate(-1)}
            style={{ padding: '10px 18px', borderRadius: 6, border: '1px solid #334155', background: 'transparent', color: '#cbd5e1', fontSize: 13, cursor: 'pointer' }}
          >
            返回上一页
          </button>
          <button
            onClick={() => navigate('/')}
            style={{ padding: '10px 18px', borderRadius: 6, border: 'none', background: '#3b82f6', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            返回首页
          </button>
        </div>
      </div>
    </div>
  );
}
