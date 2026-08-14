import { FileText, CalendarDays } from 'lucide-react'
import { C } from './DeviceStatusBadge'

interface MaintRecord {
  id: string
  deviceId: string
  deviceName: string
  date: string
  type: string
  engineer: string
  cost: number
  content: string
  result: string
  nextDate: string
}

interface MaintPlan {
  id: string
  deviceId: string
  deviceName: string
  planDate: string
  type: string
  content: string
  estimatedCost: number | string
  assignee: string
}

export function MaintenanceHistoryTable({ records }: { records: MaintRecord[] }) {
  return (
    <div style={{ background: C.white, borderRadius: 12, padding: 16, border: `1px solid ${C.border}`, marginBottom: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.primary, display: 'flex', alignItems: 'center', gap: 6 }}>
          <FileText size={14} style={{ color: C.accent }} /> 维保历史记录
        </div>
        <span style={{ fontSize: 12, color: C.textLight }}>共 {records.length} 条记录</span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: 'var(--bg-primary)', borderBottom: `2px solid ${C.border}` }}>
              {['设备名称', '维保日期', '维保类型', '维保内容', '工程师', '费用', '结果', '下次日期'].map(h => (
                <th key={h} style={{ padding: '9px 10px', textAlign: 'center', fontWeight: 700, color: C.primary, fontSize: 12 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {records.map((record, i) => (
              <tr key={record.id} style={{ borderBottom: `1px solid ${C.border}`, background: i % 2 === 0 ? C.white : '#fafbfc' }}>
                <td style={{ padding: '9px 10px', fontWeight: 600, color: C.textDark }}>{record.deviceName.split('（')[0]}</td>
                <td style={{ padding: '9px 10px', textAlign: 'center', color: C.textMid }}>{record.date}</td>
                <td style={{ padding: '9px 10px', textAlign: 'center' }}>
                  <span style={{
                    padding: '2px 8px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                    background: record.type === '故障维修' ? `${C.danger}15` : `${C.accent}15`,
                    color: record.type === '故障维修' ? C.danger : C.accent
                  }}>{record.type}</span>
                </td>
                <td style={{ padding: '9px 10px', color: C.textDark, maxWidth: 200 }}>{record.content}</td>
                <td style={{ padding: '9px 10px', textAlign: 'center', color: C.textMid }}>{record.engineer}</td>
                <td style={{ padding: '9px 10px', textAlign: 'center', fontWeight: 700, color: C.warning }}>¥{record.cost.toLocaleString()}</td>
                <td style={{ padding: '9px 10px', textAlign: 'center' }}>
                  <span style={{ padding: '2px 8px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: `${C.success}15`, color: C.success }}>{record.result}</span>
                </td>
                <td style={{ padding: '9px 10px', textAlign: 'center', color: C.textMid }}>{record.nextDate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function MaintenancePlanTable({ plans, onAddPlan, onDeletePlan, onCompletePlan }: {
  plans: MaintPlan[]
  onAddPlan?: () => void
  onDeletePlan?: (plan: MaintPlan) => void
  onCompletePlan?: (plan: MaintPlan) => void
}) {
  const hasActions = Boolean(onDeletePlan || onCompletePlan)
  return (
    <div style={{ background: C.white, borderRadius: 12, padding: 16, border: `1px solid ${C.border}`, marginBottom: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.primary, display: 'flex', alignItems: 'center', gap: 6 }}>
          <CalendarDays size={14} style={{ color: C.warning }} /> 保养计划列表（季度/半年/年度）
        </div>
        {onAddPlan && (
          <button
            onClick={onAddPlan}
            style={{
              padding: '6px 14px', borderRadius: 8, border: `1px solid ${C.accent}40`,
              background: `${C.accent}10`, color: C.accent, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4
            }}
          >
            + 添加计划
          </button>
        )}
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: 'var(--bg-primary)', borderBottom: `2px solid ${C.border}` }}>
              {['设备名称', '计划日期', '保养类型', '保养内容', '预计费用', '负责人', ...(hasActions ? ['操作'] : [])].map(h => (
                <th key={h} style={{ padding: '9px 10px', textAlign: 'center', fontWeight: 700, color: C.primary, fontSize: 12 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {plans.map((plan, i) => {
              const daysLeft = Math.floor((new Date(plan.planDate).getTime() - Date.now()) / 86400000)
              return (
                <tr key={plan.id} style={{ borderBottom: `1px solid ${C.border}`, background: i % 2 === 0 ? C.white : '#fafbfc' }}>
                  <td style={{ padding: '9px 10px', fontWeight: 600, color: C.textDark }}>{plan.deviceName.split('（')[0]}</td>
                  <td style={{ padding: '9px 10px', textAlign: 'center', color: daysLeft <= 7 ? C.danger : daysLeft <= 30 ? C.warning : C.textMid, fontWeight: daysLeft <= 30 ? 700 : 400 }}>{plan.planDate}</td>
                  <td style={{ padding: '9px 10px', textAlign: 'center' }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                      background: plan.type === '年度保养' ? `${C.danger}15` : plan.type === '半年保养' ? `${C.warning}15` : `${C.accent}15`,
                      color: plan.type === '年度保养' ? C.danger : plan.type === '半年保养' ? C.warning : C.accent
                    }}>{plan.type}</span>
                  </td>
                  <td style={{ padding: '9px 10px', color: C.textDark }}>{plan.content}</td>
                  <td style={{ padding: '9px 10px', textAlign: 'center', fontWeight: 700, color: C.warning }}>¥{Number(plan.estimatedCost).toLocaleString()}</td>
                  <td style={{ padding: '9px 10px', textAlign: 'center', color: C.textMid }}>{plan.assignee}</td>
                  {hasActions && (
                    <td style={{ padding: '9px 10px', textAlign: 'center' }}>
                      {onCompletePlan && (
                        <button onClick={() => onCompletePlan(plan)} style={{
                          padding: '3px 10px', borderRadius: 6, border: 'none', background: `${C.success}15`,
                          color: C.success, fontSize: 12, fontWeight: 600, cursor: 'pointer', marginRight: 6
                        }}>完成</button>
                      )}
                      {onDeletePlan && (
                        <button onClick={() => onDeletePlan(plan)} style={{
                          padding: '3px 10px', borderRadius: 6, border: 'none', background: `${C.danger}15`,
                          color: C.danger, fontSize: 12, fontWeight: 600, cursor: 'pointer'
                        }}>删除</button>
                      )}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
