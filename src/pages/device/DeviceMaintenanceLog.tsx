import { FileText, CalendarDays } from 'lucide-react'
import { DataTable } from '../../components/common'
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
        <div style={{ fontSize: 12, fontWeight: 700, color: C.primary, display: 'flex', alignItems: 'center', gap: 6 }}>
          <FileText size={14} style={{ color: C.accent }} /> 维保历史记录
        </div>
        <span style={{ fontSize: 12, color: C.textLight }}>共 {records.length} 条记录</span>
      </div>
      <DataTable
        dataSource={records}
        rowKey="id"
        pagination={false}
        columns={[
          { title: '设备名称', dataIndex: 'deviceName', render: (v: string) => <span style={{ fontWeight: 600, color: C.textDark }}>{v.split('（')[0]}</span> },
          { title: '维保日期', dataIndex: 'date', align: 'center', render: (v: string) => <span style={{ color: C.textMid }}>{v}</span> },
          {
            title: '维保类型', dataIndex: 'type', align: 'center',
            render: (v: string) => (
              <span style={{
                padding: '2px 8px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                background: v === '故障维修' ? `${C.danger}15` : `${C.accent}15`,
                color: v === '故障维修' ? C.danger : C.accent
              }}>{v}</span>
            ),
          },
          { title: '维保内容', dataIndex: 'content', render: (v: string) => <span style={{ color: C.textDark }}>{v}</span> },
          { title: '工程师', dataIndex: 'engineer', align: 'center', render: (v: string) => <span style={{ color: C.textMid }}>{v}</span> },
          { title: '费用', dataIndex: 'cost', align: 'center', render: (v: number) => <span style={{ fontWeight: 700, color: C.warning }}>¥{v.toLocaleString()}</span> },
          { title: '结果', dataIndex: 'result', align: 'center', render: (v: string) => <span style={{ padding: '2px 8px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: `${C.success}15`, color: C.success }}>{v}</span> },
          { title: '下次日期', dataIndex: 'nextDate', align: 'center', render: (v: string) => <span style={{ color: C.textMid }}>{v}</span> },
        ]}
      />
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
        <div style={{ fontSize: 12, fontWeight: 700, color: C.primary, display: 'flex', alignItems: 'center', gap: 6 }}>
          <CalendarDays size={14} style={{ color: C.warning }} /> 保养计划列表（季度/半年/年度）
        </div>
        {onAddPlan && (
          <button
            onClick={onAddPlan}
            style={{
              padding: '6px 14px', borderRadius: 8, border: `1px solid ${C.accent}40`,
              background: `${C.accent}10`, color: C.accent, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4
            }}
          >
            + 添加计划
          </button>
        )}
      </div>
      <DataTable
        dataSource={plans}
        rowKey="id"
        pagination={false}
        columns={[
          { title: '设备名称', dataIndex: 'deviceName', render: (v: string) => <span style={{ fontWeight: 600, color: C.textDark }}>{v.split('（')[0]}</span> },
          {
            title: '计划日期', dataIndex: 'planDate', align: 'center',
            render: (v: string) => {
              const daysLeft = Math.floor((new Date(v).getTime() - Date.now()) / 86400000)
              return <span style={{ color: daysLeft <= 7 ? C.danger : daysLeft <= 30 ? C.warning : C.textMid, fontWeight: daysLeft <= 30 ? 700 : 400 }}>{v}</span>
            },
          },
          {
            title: '保养类型', dataIndex: 'type', align: 'center',
            render: (v: string) => (
              <span style={{
                padding: '2px 8px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                background: v === '年度保养' ? `${C.danger}15` : v === '半年保养' ? `${C.warning}15` : `${C.accent}15`,
                color: v === '年度保养' ? C.danger : v === '半年保养' ? C.warning : C.accent
              }}>{v}</span>
            ),
          },
          { title: '保养内容', dataIndex: 'content', render: (v: string) => <span style={{ color: C.textDark }}>{v}</span> },
          { title: '预计费用', dataIndex: 'estimatedCost', align: 'center', render: (v: number | string) => <span style={{ fontWeight: 700, color: C.warning }}>¥{Number(v).toLocaleString()}</span> },
          { title: '负责人', dataIndex: 'assignee', align: 'center', render: (v: string) => <span style={{ color: C.textMid }}>{v}</span> },
          ...(hasActions ? [{
            title: '操作', key: 'actions', align: 'center' as const,
            render: (_: unknown, plan: MaintPlan) => (
              <span>
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
              </span>
            ),
          }] : []),
        ]}
      />
    </div>
  )
}
