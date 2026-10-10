
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, CheckCircle2 } from 'lucide-react'
import { Typography } from 'antd'
import { PermissionGate } from '../../components/common/PermissionGate'
import { toEnState } from '../../components/report/statusMeta'
import { reportApi } from '../../services/api/reportApi'
import { PRIMARY, WHITE } from './reportUtils'

export interface ReportPageHeaderProps {
  selectedIds: Set<string>
  allReports: { id: string; status: string }[]
  setReviewReport: (r: any) => void
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void
}

export default function ReportPageHeader({ selectedIds, allReports, setReviewReport, showToast }: ReportPageHeaderProps) {
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)

  // [v3.0.6.11-99 Wave8A P1] 新建报告真实化: reportApi.create → 跳转书写页 (替代 localStorage 假记录)
  const handleCreateReport = async () => {
    setCreating(true)
    try {
      const res = await reportApi.create({
        patientName: '新患者',
        modality: 'CT',
        bodyPart: '胸部',
        status: 'PENDING_ASSIGNMENT',
        state: 'PENDING_ASSIGNMENT',
      })
      if (res.success && res.data) {
        showToast(`报告 ${res.data.id} 已创建，进入书写页`, 'success')
        navigate(`/reports/v3-write?reportId=${encodeURIComponent(res.data.id)}`)
      } else {
        showToast(res.error?.message ?? '创建报告失败', 'error')
      }
    } catch {
      showToast('创建报告失败，请稍后重试', 'error')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="no-print" style={{ background: PRIMARY, padding: '20px 28px', marginBottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div>
        <Typography.Title level={4} style={{ margin: '0 0 3px' }}>放射报告管理</Typography.Title>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', margin: 0 }}>报告书写 · 审核发布 · 危急值通知 · 历史追溯</p>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <PermissionGate permission="report.approve">
          <button onClick={() => {
            if (selectedIds.size > 0) {
              const sel = allReports.find(r => selectedIds.has(r.id) && ['SUBMITTED', 'INITIAL_REVIEW'].includes(toEnState(r.status)))
              if (sel) setReviewReport(sel)
              else showToast('请先选择待审核状态的报告', 'error')
            } else { showToast('请先在列表中选择报告', 'error') }
          }} style={{
            padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.3)',
            background: 'rgba(255,255,255,0.1)', color: WHITE, fontSize: 12, fontWeight: 600,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <CheckCircle2 size={14} /> 批量审核
          </button>
        </PermissionGate>
        <button onClick={() => void handleCreateReport()} disabled={creating} style={{
          padding: '8px 16px', borderRadius: 8, border: 'none',
          background: 'rgba(255,255,255,0.15)', color: WHITE, fontSize: 12, fontWeight: 600,
          cursor: creating ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <Plus size={14} /> {creating ? '创建中...' : '新建报告'}
        </button>
      </div>
    </div>
  )
}
