
import { Plus, CheckCircle2 } from 'lucide-react'
import { PermissionGate } from '../../components/common/PermissionGate'
import { PRIMARY, WHITE } from './reportUtils'

export interface ReportPageHeaderProps {
  selectedIds: Set<string>
  allReports: { id: string; status: string }[]
  setReviewReport: (r: any) => void
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void
}

export default function ReportPageHeader({ selectedIds, allReports, setReviewReport, showToast }: ReportPageHeaderProps) {
  return (
    <div className="no-print" style={{ background: PRIMARY, padding: '20px 28px', marginBottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: WHITE, margin: '0 0 3px' }}>📋 放射报告管理</h1>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', margin: 0 }}>报告书写 · 审核发布 · 危急值通知 · 历史追溯</p>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <PermissionGate permission="report.approve">
          <button onClick={() => {
            if (selectedIds.size > 0) {
              const sel = allReports.find(r => selectedIds.has(r.id) && r.status === '待审核')
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
        <button onClick={async (evt) => {
          const btn = (evt?.target || evt?.currentTarget) as HTMLButtonElement
          const orig = btn.innerHTML
          btn.innerHTML = '⏳ 创建中...'
          btn.disabled = true
          await new Promise(r => setTimeout(r, 1500))
          const reports = JSON.parse(localStorage.getItem('g005_reports') || '[]')
          reports.push({ id: `R${Date.now()}`, createdAt: new Date().toISOString(), status: '待审核' })
          localStorage.setItem('g005_reports', JSON.stringify(reports))
          btn.innerHTML = '✅ 已创建'
          setTimeout(() => { btn.innerHTML = orig; btn.disabled = false }, 2000)
        }} style={{
          padding: '8px 16px', borderRadius: 8, border: 'none',
          background: 'rgba(255,255,255,0.15)', color: WHITE, fontSize: 12, fontWeight: 600,
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <Plus size={14} /> 新建报告
        </button>
      </div>
    </div>
  )
}
