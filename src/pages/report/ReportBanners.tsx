
import { useNavigate } from 'react-router-dom'
import { ClipboardCheck, History, Users } from 'lucide-react'
import { StatusBadge, REPORT_STATUS_ORDER } from '../../components/report'

export default function ReportBanners() {
  const navigate = useNavigate()

  return (
    <>
      <div style={{
        background: 'linear-gradient(135deg, var(--color-info-bg) 0%, rgba(96,165,250,0.12) 100%)', border: '1px solid var(--color-info-border)',
        borderRadius: 10, padding: '10px 16px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{ fontSize: 18 }}>🆕</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-info)' }}>v1.0.1 报告全生命周期升级 · 6 态 → 14 态状态机</div>
          <div style={{ fontSize: 12, color: 'var(--color-info)', marginTop: 2 }}>新增：待分配 / 已分配 / 终审中 / 签发中 / 已签发 / 修订中 / 已修订 / 已撤回 / 已归档 · 双审 + 修订链 + 时效监控 + 溯源 + 14 态徽标 + 状态时间线</div>
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', maxWidth: 600 }}>
          {REPORT_STATUS_ORDER.slice(0, 8).map(s => <StatusBadge key={s} status={s} size="sm" />)}
        </div>
      </div>

      <div style={{
        background: 'linear-gradient(135deg, var(--color-warning-bg) 0%, rgba(244,114,182,0.12) 100%)', border: '1px solid #fbbf24',
        borderRadius: 10, padding: '10px 16px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{ fontSize: 18 }}>⚡</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-warning)' }}>v1.0.3 审核 + 修订 + 协同 三大子系统就绪</div>
          <div style={{ fontSize: 12, color: 'var(--color-warning)', marginTop: 2 }}>双审（初+终）+ 修订链 Diff + 多人实时协同</div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => navigate('/report-review')} style={{ padding: '5px 10px', border: '1px solid #f59e0b', borderRadius: 4, background: 'var(--bg-card)', color: 'var(--color-warning)', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
            <ClipboardCheck size={11} /> 审核工作台
          </button>
          <button onClick={() => navigate('/report-revisions')} style={{ padding: '5px 10px', border: '1px solid #7c3aed', borderRadius: 4, background: 'var(--bg-card)', color: '#7c3aed', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
            <History size={11} /> 修订管理
          </button>
          <button onClick={() => navigate('/collaboration')} style={{ padding: '5px 10px', border: '1px solid #3b82f6', borderRadius: 4, background: 'var(--bg-card)', color: 'var(--color-info)', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Users size={11} /> 多人协同
          </button>
        </div>
      </div>
    </>
  )
}
