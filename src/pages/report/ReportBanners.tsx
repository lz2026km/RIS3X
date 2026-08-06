
import { useNavigate } from 'react-router-dom'
import { ClipboardCheck, History, Users } from 'lucide-react'
import { StatusBadge, REPORT_STATUS_ORDER } from '../../components/report'

export default function ReportBanners() {
  const navigate = useNavigate()

  return (
    <>
      <div style={{
        background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)', border: '1px solid #93c5fd',
        borderRadius: 10, padding: '10px 16px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{ fontSize: 18 }}>🆕</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#1e40af' }}>v1.0.1 报告全生命周期升级 · 6 态 → 14 态状态机</div>
          <div style={{ fontSize: 12, color: '#1e3a8a', marginTop: 2 }}>新增：待分配 / 已分配 / 终审中 / 签发中 / 已签发 / 修订中 / 已修订 / 已撤回 / 已归档 · 双审 + 修订链 + 时效监控 + 溯源 + 14 态徽标 + 状态时间线</div>
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', maxWidth: 600 }}>
          {REPORT_STATUS_ORDER.slice(0, 8).map(s => <StatusBadge key={s} status={s} size="sm" />)}
        </div>
      </div>

      <div style={{
        background: 'linear-gradient(135deg, #fef3c7 0%, #fce7f3 100%)', border: '1px solid #fbbf24',
        borderRadius: 10, padding: '10px 16px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{ fontSize: 18 }}>⚡</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#92400e' }}>v1.0.3 审核 + 修订 + 协同 三大子系统就绪</div>
          <div style={{ fontSize: 12, color: '#78350f', marginTop: 2 }}>双审（初+终）+ 修订链 Diff + 多人实时协同</div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => navigate('/report-review')} style={{ padding: '5px 10px', border: '1px solid #f59e0b', borderRadius: 4, background: '#fff', color: '#92400e', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
            <ClipboardCheck size={11} /> 审核工作台
          </button>
          <button onClick={() => navigate('/report-revisions')} style={{ padding: '5px 10px', border: '1px solid #7c3aed', borderRadius: 4, background: '#fff', color: '#5b21b6', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
            <History size={11} /> 修订管理
          </button>
          <button onClick={() => navigate('/collaboration')} style={{ padding: '5px 10px', border: '1px solid #3b82f6', borderRadius: 4, background: '#fff', color: '#1e40af', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Users size={11} /> 多人协同
          </button>
        </div>
      </div>
    </>
  )
}
