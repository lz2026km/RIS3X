import { useMemo } from 'react'
import type { OperationLog } from './types'
import { ACCENT, GRAY, WHITE, PRIMARY, ACTION_COLORS, ACTION_ICONS, SOURCE_COLORS, SOURCE_ICONS, PAGE_SIZES } from './constants'
import { formatDate, formatTime } from './utils'
import { Eye, ChevronRight, User, Monitor } from 'lucide-react'

// ============================================================
// TimelineView
// ============================================================
function TimelineView({ logs, onViewDetail }: { logs: OperationLog[]; onViewDetail: (log: OperationLog) => void }) {
  const groupedLogs = useMemo(() => {
    const groups: Record<string, OperationLog[]> = {}
    logs.forEach(log => {
      const date = formatDate(log.timestamp)
      if (!groups[date]) groups[date] = []
      groups[date].push(log)
    })
    return Object.entries(groups).sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
  }, [logs])

  return (
    <div style={{ position: 'relative' }}>
      {groupedLogs.map(([date, dayLogs], _groupIndex) => (
        <div key={date} style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16, marginLeft: 40 }}>
            <div style={{
              background: PRIMARY, color: WHITE, padding: '4px 12px', borderRadius: 20,
              fontSize: 12, fontWeight: 600, boxShadow: '0 2px 6px rgba(30,58,95,0.3)',
            }}>
              {date}
            </div>
            <div style={{ flex: 1, height: 1, background: '#e2e8f0', marginLeft: 12 }} />
          </div>

          <div style={{ marginLeft: 40 }}>
            {dayLogs.map((log, index) => {
              const isLast = index === dayLogs.length - 1
              return (
                <div key={log.id} style={{ display: 'flex', position: 'relative', paddingBottom: isLast ? 0 : 16 }}>
                  <div style={{
                    position: 'absolute', left: -32, top: 8,
                    width: 12, height: 12, borderRadius: '50%',
                    background: ACTION_COLORS[log.action] || ACCENT,
                    border: '2px solid #e2e8f0', boxShadow: '0 0 0 3px #e2e8f0',
                    zIndex: 1,
                  }} />
                  {!isLast && (
                    <div style={{
                      position: 'absolute', left: -27, top: 20,
                      width: 2, height: 'calc(100% - 12px)',
                      background: '#e2e8f0',
                    }} />
                  )}

                  <div style={{
                    flex: 1, background: WHITE, border: '1px solid #e2e8f0',
                    borderRadius: 10, padding: 14, marginLeft: 16,
                    cursor: 'pointer', transition: 'all 0.2s',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  }}
                    onMouseEnter={e => {
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'
                      e.currentTarget.style.borderColor = ACCENT
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)'
                      e.currentTarget.style.borderColor = '#e2e8f0'
                    }}
                    onClick={() => onViewDetail(log)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          background: `${ACTION_COLORS[log.action] || ACCENT}20`,
                          color: ACTION_COLORS[log.action] || ACCENT,
                          padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600,
                          display: 'flex', alignItems: 'center', gap: 4,
                        }}>
                          {ACTION_ICONS[log.action]}
                          {log.action}
                        </span>
                        <span style={{ fontSize: 12, color: GRAY }}>{log.module}</span>
                      </div>
                      <span style={{ fontSize: 12, color: GRAY }}>{formatTime(log.timestamp)}</span>
                    </div>

                    <div style={{ fontSize: 13, color: PRIMARY, marginBottom: 6 }}>
                      {log.targetDesc}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontSize: 12, color: GRAY, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <User size={11} />
                          {log.userName}
                        </span>
                        <span style={{ fontSize: 12, color: GRAY, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Monitor size={11} />
                          {log.ipAddress}
                        </span>
                      </div>
                      <span style={{ fontSize: 12, color: ACCENT, display: 'flex', alignItems: 'center', gap: 2 }}>
                        查看详情 <ChevronRight size={11} />
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ============================================================
// Pagination
// ============================================================
function Pagination({
  currentPage, totalPages, pageSize, total,
  onPageChange, onPageSizeChange,
}: {
  currentPage: number
  totalPages: number
  pageSize: number
  total: number
  onPageChange: (p: number) => void
  onPageSizeChange: (s: number) => void
}) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '12px 16px', borderTop: '1px solid #e2e8f0',
    }}>
      <div style={{ fontSize: 12, color: GRAY }}>
        显示 {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, total)} 条，共 {total} 条
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, color: GRAY }}>每页</span>
          <select
            value={pageSize}
            onChange={e => onPageSizeChange(Number(e.target.value))}
            style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #e2e8f0', fontSize: 12 }}
          >
            {PAGE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <span style={{ fontSize: 12, color: GRAY }}>条</span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            style={{
              padding: '4px 10px', borderRadius: 4, border: '1px solid #e2e8f0',
              background: WHITE, color: currentPage === 1 ? '#cbd5e1' : PRIMARY,
              fontSize: 12, cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
            }}
          >
            上一页
          </button>
          <button
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            style={{
              padding: '4px 10px', borderRadius: 4, border: '1px solid #e2e8f0',
              background: WHITE, color: currentPage === totalPages ? '#cbd5e1' : PRIMARY,
              fontSize: 12, cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
            }}
          >
            下一页
          </button>
        </div>
        <span style={{ fontSize: 12, color: GRAY }}>
          第 {currentPage} / {totalPages} 页
        </span>
      </div>
    </div>
  )
}

// ============================================================
// LogTable
// ============================================================
interface LogTableProps {
  logs: OperationLog[]
  currentPage: number
  totalPages: number
  pageSize: number
  total: number
  onPageChange: (p: number) => void
  onPageSizeChange: (s: number) => void
  onViewDetail: (log: OperationLog) => void
}

function TableView({ logs, onViewDetail }: { logs: OperationLog[]; onViewDetail: (log: OperationLog) => void }) {
  return (
    <>
      <div style={{
        display: 'grid', gridTemplateColumns: '160px 80px 90px 90px 100px 1fr 90px 100px',
        padding: '10px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0',
        fontSize: 12, fontWeight: 600, color: GRAY,
      }}>
        <div>时间</div>
        <div>用户</div>
        <div>操作类型</div>
        <div>模块</div>
        <div>来源</div>
        <div>操作详情</div>
        <div>IP地址</div>
        <div style={{ textAlign: 'center' }}>操作</div>
      </div>

      {logs.map(log => (
        <div
          key={log.id}
          style={{
            display: 'grid', gridTemplateColumns: '160px 80px 90px 90px 100px 1fr 90px 100px',
            padding: '12px 16px', borderBottom: '1px solid #f1f5f9',
            fontSize: 12, alignItems: 'center',
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <div style={{ color: PRIMARY, fontWeight: 500 }}>
            <div>{formatDate(log.timestamp)}</div>
            <div style={{ color: GRAY, fontSize: 12 }}>{formatTime(log.timestamp)}</div>
          </div>
          <div style={{ color: PRIMARY }}>{log.userName}</div>
          <div>
            <span style={{
              background: `${ACTION_COLORS[log.action] || ACCENT}20`,
              color: ACTION_COLORS[log.action] || ACCENT,
              padding: '2px 6px', borderRadius: 4, fontSize: 12, fontWeight: 600,
              display: 'inline-flex', alignItems: 'center', gap: 3,
            }}>
              {ACTION_ICONS[log.action]}
              {log.action}
            </span>
          </div>
          <div style={{ color: GRAY, fontSize: 12 }}>{log.module}</div>
          <div>
            <span style={{
              background: `${SOURCE_COLORS[log.source] || GRAY}15`,
              color: SOURCE_COLORS[log.source] || GRAY,
              padding: '2px 6px', borderRadius: 4, fontSize: 12,
              display: 'inline-flex', alignItems: 'center', gap: 3,
            }}>
              {SOURCE_ICONS[log.source]}
              {log.source}
            </span>
          </div>
          <div style={{ color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.targetDesc}>
            {log.targetDesc}
          </div>
          <div style={{ color: GRAY }}>{log.ipAddress}</div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
            <button
              onClick={() => onViewDetail(log)}
              style={{
                padding: '4px 8px', borderRadius: 4, border: '1px solid #e2e8f0',
                background: WHITE, color: ACCENT, fontSize: 12, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              <Eye size={12} />
              详情
            </button>
          </div>
        </div>
      ))}
    </>
  )
}

export default function LogTable({
  logs, currentPage, totalPages, pageSize, total,
  onPageChange, onPageSizeChange, onViewDetail,
}: LogTableProps) {
  return (
    <div style={{
      background: WHITE, borderRadius: 10, border: '1px solid #e2e8f0',
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    }}>
      <TableView logs={logs} onViewDetail={onViewDetail} />
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        pageSize={pageSize}
        total={total}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />
    </div>
  )
}

export { TimelineView, Pagination }
