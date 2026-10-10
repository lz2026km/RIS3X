import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { ShieldX, ScanLine, ArrowLeft, Home } from 'lucide-react';
import { t } from '../i18n/appI18n';
import { ActionButton } from '../components/common/ActionButton';
import { Typography } from 'antd';

const { Title } = Typography

export default function ForbiddenPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(ellipse at 30% 20%, #1e3a5f 0%, #0f172a 60%)', color: '#e2e8f0', padding: 'var(--space-6, 24px)' }}>
      <div style={{
        background: 'rgba(30, 41, 59, 0.92)', backdropFilter: 'blur(8px)',
        padding: 'var(--space-12, 48px)', borderRadius: 16, width: 460, textAlign: 'center',
        boxShadow: '0 24px 64px rgba(0,0,0,0.45)', border: '1px solid #334155',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-4, 16px)', marginBottom: 'var(--space-4, 16px)' }}>
          <div style={{
            width: 72, height: 72, borderRadius: 18,
            background: 'linear-gradient(135deg, var(--color-error-500) 0%, #7f1d1d 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(239,68,68,0.35)',
          }}>
            <ScanLine size={36} color="#fff" />
          </div>
          <div style={{ fontSize: 64, fontWeight: 800, color: '#f87171', lineHeight: 1, letterSpacing: '-0.02em' }}>
            {t('w8.forbidden.code')}
          </div>
        </div>
        <Title level={4} style={{ margin: '0 0 8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2, 8px)' }}>
          <ShieldX size={20} color="#f87171" />{t('w8.forbidden.title')}
        </Title>
        <p style={{ marginTop: 'var(--space-2, 8px)', marginBottom: 6, fontSize: 12, color: '#94a3b8', lineHeight: 1.7 }}>
          {user
            ? t('w8.forbidden.hintLogged', { name: user.name, role: user.role })
            : t('w8.forbidden.hintGuest')}
        </p>
        <p style={{ margin: '0 0 24px', fontSize: 12, color: '#64748b', lineHeight: 1.6 }}>
          {t('w8.forbidden.needPermission')}
        </p>
        <div style={{ display: 'flex', gap: 'var(--space-3, 12px)', justifyContent: 'center' }}>
          <ActionButton action="cancel" onClick={() => navigate(-1)} icon={<ArrowLeft size={16} />}>
            {t('w8.forbidden.back')}
          </ActionButton>
          <ActionButton action="create" onClick={() => navigate('/')} icon={<Home size={16} />}>
            {t('w8.forbidden.home')}
          </ActionButton>
        </div>
      </div>
    </div>
  );
}
