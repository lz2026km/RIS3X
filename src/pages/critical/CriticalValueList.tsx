import { useMemo } from 'react'
import {
  Search, X, Calendar, Settings, Filter, CheckCircle, Send, Edit3, Eye, Phone,
  CheckSquare, Square, Bell, Clock, AlertTriangle, ArrowUpRight, ShieldAlert,
} from 'lucide-react'
import type { CriticalValue } from './types'
import { STATUS_CONFIG, SEVERITY_CONFIG, PRIMARY_COLOR, CN_STATUS_TO_STORE } from './types'
// v3.0.6.11: 导入 criticalStore 导出的 MACHINE_STATE_TO_STORE,
// 把状态机 state value (found/notified/acknowledged/...) 映射到 store status,
// 让 critical map 在 UI 层真正被消费。
import { MACHINE_STATE_TO_STORE, useCriticalStore } from '../../store/criticalStore'

const MODALITY_LIST = ['全部', 'CT', 'MR', 'DR', 'DSA', '超声']
// v3.0.6.11: STATUS_LIST 改为 criticalStore 英文状态 key + 中文 label,
// 与 store 中的 pending/notified/acknowledged/resolving/resolved/escalated/cancelled/closed_loop/overdue 对齐。
const STATUS_LIST = ['全部', 'pending', 'resolving', 'resolved', 'overdue']
const STATUS_LABEL: Record<string, string> = {
  pending: '待处理',
  notified: '已通知',
  acknowledged: '已接收',
  resolving: '处理中',
  resolved: '已处理',
  closed_loop: '已闭环',
  escalated: '已升级',
  cancelled: '已取消',
  overdue: '超时',
}
const SEVERITY_LIST = ['全部', '危及生命', '危急', '高危', '紧急', '警告']
const TIME_RANGE_LIST = ['全部', '30分钟内', '1小时内', '2小时内', '超时']

interface FilterBarProps {
  search: string
  setSearch: (v: string) => void
  statusFilter: string
  setStatusFilter: (v: string) => void
  modalityFilter: string
  setModalityFilter: (v: string) => void
  severityFilter: string
  setSeverityFilter: (v: string) => void
  timeRangeFilter: string
  setTimeRangeFilter: (v: string) => void
  dateRange: string
  setDateRange: (v: string) => void
  onBatchNotify: () => void
  onBatchProcess: () => void
  selectedCount: number
  onOpenSettings: () => void
}

const filterBtnStyle = (isActive: boolean): React.CSSProperties => ({
  padding: '6px 14px', borderRadius: 8, border: `1px solid ${isActive ? '#1e3a5f' : '#e2e8f0'}`,
  background: isActive ? '#1e3a5f' : '#fff', color: isActive ? '#fff' : '#64748b',
  fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
})

export const FilterBar = ({
  search, setSearch, statusFilter, setStatusFilter, modalityFilter, setModalityFilter,
  severityFilter, setSeverityFilter, timeRangeFilter, setTimeRangeFilter,
  dateRange, setDateRange, onBatchNotify, onBatchProcess, selectedCount, onOpenSettings,
}: FilterBarProps) => (
  <div style={{ background: '#fff', borderRadius: 12, padding: '14px 20px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', marginBottom: 16 }}>
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, background: '#f8fafc', borderRadius: 8, padding: '8px 14px', border: '1px solid #e2e8f0' }}>
        <Search size={16} style={{ color: '#94a3b8' }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索患者姓名/检查号/危急值ID..." style={{ border: 'none', outline: 'none', fontSize: 13, width: '100%', background: 'transparent' }} />
        {search && <X size={14} style={{ color: '#94a3b8', cursor: 'pointer' }} onClick={() => setSearch('')} />}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Calendar size={14} style={{ color: '#64748b' }} />
        <input type="date" value={dateRange} onChange={e => setDateRange(e.target.value)} style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: '6px 10px', fontSize: 12, color: '#334155', outline: 'none' }} />
      </div>
      <button onClick={onOpenSettings} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
        <Settings size={14} />
        规则设置
      </button>
    </div>
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginRight: 8 }}>
        <Filter size={14} style={{ color: '#64748b' }} />
        <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>状态:</span>
      </div>
      {STATUS_LIST.map(s => (
        <button key={s} onClick={() => setStatusFilter(s)} style={filterBtnStyle(statusFilter === s)}>
          {STATUS_LABEL[s] ?? s}
        </button>
      ))}
    </div>
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>设备:</span>
        {MODALITY_LIST.map(m => (
          <button key={m} onClick={() => setModalityFilter(m)} style={filterBtnStyle(modalityFilter === m)}>{m}</button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>紧急:</span>
        {SEVERITY_LIST.map(s => (
          <button key={s} onClick={() => setSeverityFilter(s)} style={filterBtnStyle(severityFilter === s)}>{s}</button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>时限:</span>
        {TIME_RANGE_LIST.map(t => (
          <button key={t} onClick={() => setTimeRangeFilter(t)} style={filterBtnStyle(timeRangeFilter === t)}>{t}</button>
        ))}
      </div>
    </div>
    {selectedCount > 0 && (
      <div style={{ display: 'flex', gap: 10, marginTop: 12, paddingTop: 12, borderTop: '1px solid #f1f5f9' }}>
        <span style={{ fontSize: 12, color: '#1e3a5f', fontWeight: 700 }}>已选中 {selectedCount} 项</span>
        <button onClick={onBatchNotify} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, border: '1px solid #d97706', background: '#fffbeb', color: '#d97706', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          <Send size={13} />批量发送通知
        </button>
        <button onClick={onBatchProcess} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, border: '1px solid #059669', background: '#d1fae5', color: '#059669', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          <CheckCircle size={13} />批量标记处理
        </button>
      </div>
    )}
  </div>
)

interface CriticalValueRowProps {
  cv: CriticalValue
  isSelected: boolean
  onSelect: () => void
  onProcess: () => void
  onViewDetail: () => void
  onContactClinical: () => void
  onTransferToFollowUp: () => void
}

const CriticalValueRow = ({ cv, isSelected, onSelect, onProcess, onViewDetail, onContactClinical, onTransferToFollowUp }: CriticalValueRowProps) => {
  const statusCfg = STATUS_CONFIG[cv.status] || STATUS_CONFIG['pending']
  const severityCfg = SEVERITY_CONFIG[cv.severity] || SEVERITY_CONFIG['高危']
  const StatusIcon = statusCfg.icon || Bell

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '40px 100px 90px 130px 60px 140px 100px 90px 120px 80px 90px 100px 60px',
      alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #f1f5f9',
      background: isSelected ? '#eff6ff' : '#fff',
      borderLeft: `4px solid ${severityCfg.borderColor}`, transition: 'background 0.15s',
    }}
    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#f8fafc' }}
    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = '#fff' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div onClick={onSelect} style={{ cursor: 'pointer', color: isSelected ? '#1e3a5f' : '#cbd5e1' }}>
          {isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
        </div>
      </div>
      <div style={{ fontSize: 12, color: '#64748b', fontFamily: 'monospace' }}>{cv.id}</div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1e3a5f' }}>{cv.patientName}</div>
        <div style={{ fontSize: 12, color: '#94a3b8' }}>{cv.gender}·{cv.age}岁</div>
      </div>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>{cv.examItemName}</div>
        <div style={{ fontSize: 12, color: '#94a3b8' }}>{cv.modality}</div>
      </div>
      <div style={{ fontSize: 12, color: '#64748b' }}>{cv.deviceName?.split('（')[0] || cv.modality}</div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#dc2626' }}>{cv.resultValue} {cv.resultUnit}</div>
        <div style={{ fontSize: 12, color: '#94a3b8' }}>危急: {cv.criticalRange}</div>
      </div>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>{cv.reportedByName}</div>
        <div style={{ fontSize: 12, color: '#94a3b8' }}>{(cv.reportedTime || '').split(' ')[1] || cv.reportedTime}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <StatusIcon size={14} style={{ color: statusCfg.color }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: statusCfg.color, background: statusCfg.bg, padding: '2px 10px', borderRadius: 10 }}>{statusCfg.label}</span>
      </div>
      <div style={{ fontSize: 12, color: '#64748b' }}>{cv.processingTime ? (cv.processingTime || '').split(' ')[1] || cv.processingTime : '-'}</div>
      <div style={{ fontSize: 12, color: '#64748b' }}>{cv.processingDuration || '-'}</div>
      <div style={{ display: 'flex', gap: 6 }}>
        {(cv.status === '待处理' || cv.status === 'pending' || cv.status === 'notified' || cv.status === 'acknowledged') && (
          <button onClick={onProcess} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #059669', background: '#d1fae5', color: '#059669', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Edit3 size={11} />处理
          </button>
        )}
        <button onClick={onViewDetail} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #1e3a5f', background: '#fff', color: '#1e3a5f', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Eye size={11} />详情
        </button>
        <button onClick={onContactClinical} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #d97706', background: '#fff', color: '#d97706', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Phone size={11} />联系
        </button>
      </div>
      <div>
        {cv.transferredToFollowUp ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 10, fontSize: 12, fontWeight: 700, background: '#d1fae5', color: '#059669', border: '1px solid #a7f3d0' }}>
            <CheckCircle size={11} />已转随访
          </span>
        ) : (
          <button onClick={onTransferToFollowUp} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #7c3aed', background: '#f5f3ff', color: '#7c3aed', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }} title="转随访">
            <ArrowUpRight size={12} />
          </button>
        )}
      </div>
      <div />
    </div>
  )
}

interface CriticalValueListProps {
  filtered: CriticalValue[]
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  onToggleSelectAll: () => void
  onProcess: (cv: CriticalValue) => void
  onViewDetail: (cv: CriticalValue) => void
  onContactClinical: (cv: CriticalValue) => void
  onTransferToFollowUp: (cv: CriticalValue) => void
  criticalValues: CriticalValue[]
}

export const CriticalValueList = ({
  filtered, selectedIds, onToggleSelect, onToggleSelectAll,
  onProcess, onViewDetail, onContactClinical, onTransferToFollowUp, criticalValues,
}: CriticalValueListProps) => {
  const allSelected = filtered.length > 0 && selectedIds.size === filtered.length

  // v3.0.6.11: 从 criticalStore 的 actor pool 读取实时 machine state value,
  // 用 MACHINE_STATE_TO_STORE 映射到 store status,使 map 在 UI 中真正被消费。
  const actors = useCriticalStore((s) => s.actors)
  const machineStatusCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const actor of actors.values()) {
      const snap = actor.getSnapshot()
      const v = snap.value as string
      const storeStatus = MACHINE_STATE_TO_STORE[v] ?? 'pending'
      counts[storeStatus] = (counts[storeStatus] ?? 0) + 1
    }
    return counts
  }, [actors])

  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
      <div style={{ padding: '10px 16px', fontSize: 12, fontWeight: 700, color: '#64748b', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center' }}>
        <div style={{ width: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={onToggleSelectAll} style={{ cursor: 'pointer', color: allSelected ? '#1e40af' : '#cbd5e1' }}>
            {allSelected ? <CheckSquare size={16} /> : <Square size={16} />}
          </div>
        </div>
        <div style={{ width: 100 }}>危急值ID</div>
        <div style={{ width: 90 }}>患者姓名</div>
        <div style={{ width: 130 }}>检查项目</div>
        <div style={{ width: 60 }}>设备</div>
        <div style={{ width: 140 }}>检查结果</div>
        <div style={{ width: 90 }}>上报医生</div>
        <div style={{ width: 80 }}>状态</div>
        <div style={{ width: 90 }}>处理时间</div>
        <div style={{ width: 90 }}>处理耗时</div>
        <div style={{ flex: 1 }}>操作</div>
        <div style={{ width: 60 }}>转随访</div>
        <div style={{ width: 60 }} />
      </div>

      {filtered.length > 0 ? (
        filtered.map(cv => (
          <CriticalValueRow
            key={cv.id}
            cv={cv}
            isSelected={selectedIds.has(cv.id)}
            onSelect={() => onToggleSelect(cv.id)}
            onProcess={() => onProcess(cv)}
            onViewDetail={() => onViewDetail(cv)}
            onContactClinical={() => onContactClinical(cv)}
            onTransferToFollowUp={() => onTransferToFollowUp(cv)}
          />
        ))
      ) : (
        <div style={{ padding: '48px 24px', textAlign: 'center' }}>
          <ShieldAlert size={40} style={{ color: '#cbd5e1', marginBottom: 12 }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: '#94a3b8' }}>暂无危急值记录</div>
          <div style={{ fontSize: 12, color: '#cbd5e1', marginTop: 4 }}>根据筛选条件未找到匹配的危急值</div>
        </div>
      )}

      <div style={{ padding: '12px 16px', borderTop: '1px solid #f1f5f9', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 12, color: '#64748b' }}>
          共 <span style={{ fontWeight: 700, color: '#1e40af' }}>{filtered.length}</span> 条记录，
          已选中 <span style={{ fontWeight: 700, color: '#1e40af' }}>{selectedIds.size}</span> 项
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {/* v3.0.6.11: STATUS_CONFIG 中英文键(pending/...)优先显示 machine-derived counts */}
          {Object.entries(STATUS_CONFIG).filter(([key]) => !CN_STATUS_TO_STORE[key] && key !== '待处理' && key !== '处理中' && key !== '已处理' && key !== '超时').map(([key, cfg]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.color }} />
              <span style={{ fontSize: 12, color: '#64748b' }}>
                {STATUS_LABEL[key] ?? key}: {machineStatusCounts[key] ?? criticalValues.filter(c => c.status === key).length}
              </span>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#7c3aed' }} />
            <span style={{ fontSize: 12, color: '#64748b' }}>已转随访: {criticalValues.filter(c => c.transferredToFollowUp).length}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
