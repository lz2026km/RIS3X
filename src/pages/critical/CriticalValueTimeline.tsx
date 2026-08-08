import { AlertOctagon, PhoneIncoming, Activity, CheckCircle, AlertTriangle } from 'lucide-react'
import type { CriticalValue, ClosedLoopStage5 } from './types'

const stageConfig: Record<string, { bg: string; color: string; borderColor: string; icon: React.ComponentType }> = {
  '发出': { bg: '#fef2f2', color: '#dc2626', borderColor: '#dc2626', icon: AlertOctagon },
  '确认': { bg: '#eff6ff', color: '#2563eb', borderColor: '#2563eb', icon: PhoneIncoming },
  '处理': { bg: '#fffbeb', color: '#d97706', borderColor: '#d97706', icon: Activity },
  '完成': { bg: '#d1fae5', color: '#059669', borderColor: '#059669', icon: CheckCircle },
}

const stageColors: Record<string, { bg: string; color: string; borderColor: string; glowColor: string }> = {
  '发现': { bg: '#fef2f2', color: '#dc2626', borderColor: '#dc2626', glowColor: 'rgba(220,38,38,0.4)' },
  '电话通知': { bg: '#fff7ed', color: '#ea580c', borderColor: '#ea580c', glowColor: 'rgba(234,88,12,0.4)' },
  '临床确认': { bg: '#fef9c3', color: '#ca8a04', borderColor: '#ca8a04', glowColor: 'rgba(202,138,4,0.4)' },
  '临床回执': { bg: '#dcfce7', color: '#16a34a', borderColor: '#16a34a', glowColor: 'rgba(22,163,74,0.4)' },
  '闭环完成': { bg: '#dbeafe', color: '#2563eb', borderColor: '#2563eb', glowColor: 'rgba(37,99,235,0.4)' },
}

export const ClosedLoopTracker = ({ cv }: { cv: CriticalValue }) => {
  const stages: ClosedLoopStage5[] = [
    {
      key: '发出', label: '危急值发出', time: cv.reportedTime, user: cv.reportedByName,
      measure: cv.findingDetails?.substring(0, 30) + '...', done: !!cv.reportedTime, active: true,
    },
    {
      key: '确认', label: '临床确认', time: cv.acknowledgedTime, user: cv.acknowledgedBy,
      measure: cv.notificationMethod || '系统通知', done: !!cv.acknowledgedTime,
      active: !!cv.reportedTime && !cv.acknowledgedTime,
    },
    {
      key: '处理', label: '处理中', time: cv.processingTime, user: cv.processingDoctorName,
      measure: cv.processingResult || '处理中', done: cv.status === '已处理',
      active: !!cv.acknowledgedTime && cv.status === '处理中',
    },
    {
      key: '完成', label: '闭环完成', time: cv.status === '已处理' ? cv.processingTime : undefined,
      user: cv.processingDoctorName, measure: cv.processingResult || '处理完成', done: cv.status === '已处理',
      active: cv.status === '已处理',
    },
  ]

  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#1e40af', marginBottom: 16 }}>
        闭环状态追踪
      </div>
      <div style={{ display: 'flex', alignItems: 'stretch', gap: 0, marginBottom: 16 }}>
        {stages.map((stage, idx) => {
          const cfg = stageConfig[stage.key]
          const StageIcon = cfg.icon
          const isLast = idx === stages.length - 1
          return (
            <div key={stage.key} style={{ display: 'flex', flex: 1, alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: '50%',
                  background: stage.done ? cfg.bg : '#f8fafc',
                  border: `3px solid ${stage.done ? cfg.borderColor : '#e2e8f0'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
                }}>
                  <StageIcon size={20} style={{ color: stage.done ? cfg.color : '#94a3b8' }} />
                  {stage.active && (
                    <div style={{
                      position: 'absolute', top: -2, right: -2, width: 14, height: 14, borderRadius: '50%',
                      background: '#d97706', border: '2px solid #fff', animation: 'pulse 1.5s infinite',
                    }} />
                  )}
                </div>
                <div style={{ marginTop: 8, fontSize: 12, fontWeight: 700, color: stage.done ? cfg.color : '#94a3b8' }}>
                  {stage.label}
                </div>
                {stage.time && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{stage.time.split(' ')[1] || stage.time}</div>}
                {stage.user && <div style={{ fontSize: 12, color: '#64748b', marginTop: 1 }}>{stage.user}</div>}
              </div>
              {!isLast && (
                <div style={{
                  flex: '0 0 32px', height: 3,
                  background: stages[idx + 1].done ? cfg.borderColor : '#e2e8f0',
                  marginTop: -20, transition: 'background 0.3s',
                }} />
              )}
            </div>
          )
        })}
      </div>
      <div style={{ background: '#f8fafc', borderRadius: 8, padding: 12, border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', gap: 16 }}>
          {[
            { label: '总耗时', value: cv.processingDuration || '进行中', color: '#1e40af' },
            { label: '确认耗时', value: cv.acknowledgedTime && cv.reportedTime
              ? (() => { const t1 = new Date(cv.reportedTime).getTime(); const t2 = new Date(cv.acknowledgedTime).getTime(); const mins = Math.round((t2 - t1) / 60000); return mins < 60 ? `${mins}分钟` : `${Math.floor(mins / 60)}小时${mins % 60}分钟` })()
              : '待确认', color: '#2563eb' },
            { label: '处理耗时', value: cv.processingTime && cv.acknowledgedTime
              ? (() => { const t1 = new Date(cv.acknowledgedTime).getTime(); const t2 = new Date(cv.processingTime).getTime(); const mins = Math.round((t2 - t1) / 60000); return mins < 60 ? `${mins}分钟` : `${Math.floor(mins / 60)}小时${mins % 60}分钟` })()
              : '进行中', color: '#d97706' },
          ].map(item => (
            <div key={item.label} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>{item.label}</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: item.color }}>{item.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export const ClosedLoopTracker5Nodes = ({ cv }: { cv: CriticalValue }) => {
  const getCurrentStageIndex = (): number => {
    if (!cv.reportedTime) return -1
    if (cv.transferredToFollowUp) return 4
    if (cv.status === '已处理' || cv.status === 'resolved') return 4
    if (cv.confirmedBy || cv.confirmedAt) return 3
    if (cv.acknowledgedBy || cv.acknowledgedTime) return 2
    if (cv.voiceCalledAt || cv.voiceCalledBy) return 1
    if (cv.receivingTime || cv.receivingDoctorName) return 1
    return 0
  }

  const currentStageIndex = getCurrentStageIndex()

  const stages: ClosedLoopStage5[] = [
    { key: '发现', label: '🔴 发现', time: cv.reportedTime, user: cv.reportedByName, measure: cv.findingDetails?.substring(0, 20) + '...', done: !!cv.reportedTime, active: currentStageIndex === 0 },
    { key: '电话通知', label: '🟠 电话通知', time: cv.voiceCalledAt || cv.receivingTime, user: cv.voiceCalledBy || cv.receivingDoctorName, measure: '电话通知临床', done: !!(cv.voiceCalledAt || cv.receivingTime), active: currentStageIndex === 1 },
    { key: '临床确认', label: '🟡 临床确认', time: cv.acknowledgedTime, user: cv.acknowledgedBy, measure: '临床已确认', done: !!(cv.acknowledgedBy || cv.acknowledgedTime), active: currentStageIndex === 2 },
    { key: '临床回执', label: '🟢 临床回执', time: cv.confirmedAt, user: cv.confirmedBy, measure: cv.confirmedComment?.substring(0, 20) || '已签字回传', done: !!(cv.confirmedBy || cv.confirmedAt), active: currentStageIndex === 3 },
    { key: '闭环完成', label: '🔵 闭环完成', time: cv.transferredToFollowUp ? cv.followUpDate : undefined, user: cv.transferredToFollowUp ? '系统' : undefined, measure: cv.transferredToFollowUp ? `随访编号：${cv.followUpId}` : (cv.status === '已处理' || cv.status === 'resolved' ? '已闭环' : '处理中'), done: !!(cv.transferredToFollowUp || cv.status === '已处理' || cv.status === 'resolved'), active: currentStageIndex === 4 },
  ]

  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#1e40af', marginBottom: 16 }}>
        5节点闭环追踪
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, marginBottom: 16 }}>
        {stages.map((stage, idx) => {
          const cfg = stageColors[stage.key]
          const isLast = idx === stages.length - 1
          const isDone = stage.done
          const isActive = stage.active
          return (
            <div key={stage.key} style={{ display: 'flex', flex: 1, alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                <div style={{
                  width: 56, height: 56, borderRadius: '50%',
                  background: isDone ? cfg.bg : '#f8fafc',
                  border: `3px solid ${isDone ? cfg.borderColor : '#e2e8f0'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
                  boxShadow: isActive ? `0 0 0 4px ${cfg.glowColor}, 0 0 20px ${cfg.glowColor}` : (isDone ? `0 0 10px ${cfg.glowColor}` : 'none'),
                  transition: 'all 0.3s ease',
                }}>
                  {isDone && !isActive && (
                    <div style={{ position: 'absolute', top: -4, right: -4, width: 20, height: 20, borderRadius: '50%', background: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #fff' }}>
                      <CheckCircle size={12} style={{ color: '#fff' }} />
                    </div>
                  )}
                  {isActive && (
                    <div style={{ position: 'absolute', top: -2, right: -2, width: 16, height: 16, borderRadius: '50%', background: '#f59e0b', border: '3px solid #fff', animation: 'pulse 1.5s infinite' }} />
                  )}
                  <span style={{ fontSize: 20 }}>
                    {stage.key === '发现' ? '🔴' : stage.key === '电话通知' ? '🟠' : stage.key === '临床确认' ? '🟡' : stage.key === '临床回执' ? '🟢' : '🔵'}
                  </span>
                </div>
                <div style={{ marginTop: 8, fontSize: 12, fontWeight: 700, color: isDone ? cfg.color : '#94a3b8', textAlign: 'center', whiteSpace: 'nowrap' }}>
                  {stage.key}
                </div>
                {stage.time && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2, textAlign: 'center' }}>{stage.time.split(' ')[1] || stage.time}</div>}
                {stage.user && <div style={{ fontSize: 12, color: '#64748b', marginTop: 1, textAlign: 'center' }}>{stage.user}</div>}
                {stage.measure && (
                  <div style={{ fontSize: 12, color: isDone ? '#64748b' : '#cbd5e1', marginTop: 4, textAlign: 'center', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={stage.measure}>
                    {stage.measure}
                  </div>
                )}
                {stage.key === '已归档' && cv.transferredToFollowUp && (
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#059669', marginTop: 4, textAlign: 'center', background: '#d1fae5', padding: '2px 8px', borderRadius: 10, border: '1px solid #a7f3d0' }}>
                    {cv.followUpId}
                  </div>
                )}
              </div>
              {!isLast && (
                <div style={{ flex: '0 0 24px', height: 3, background: stages[idx + 1].done ? cfg.borderColor : '#e2e8f0', marginTop: -20, transition: 'background 0.3s', marginLeft: -4, marginRight: -4 }} />
              )}
            </div>
          )
        })}
      </div>
      <div style={{
        background: currentStageIndex === 4 ? '#d1fae5' : (currentStageIndex >= 0 ? '#eff6ff' : '#fef2f2'),
        borderRadius: 8, padding: 10,
        border: `1px solid ${currentStageIndex === 4 ? '#a7f3d0' : (currentStageIndex >= 0 ? '#bfdbfe' : '#fecaca')}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {currentStageIndex === 4 ? <CheckCircle size={16} style={{ color: '#059669' }} /> : currentStageIndex >= 0 ? <Activity size={16} style={{ color: '#2563eb' }} /> : <AlertTriangle size={16} style={{ color: '#dc2626' }} />}
          <span style={{ fontSize: 12, fontWeight: 600, color: currentStageIndex === 4 ? '#059669' : (currentStageIndex >= 0 ? '#2563eb' : '#dc2626') }}>
            {currentStageIndex === 4 ? `已归档 - 随访编号：${cv.followUpId}` : currentStageIndex >= 0 ? `当前阶段：${stages[currentStageIndex].key}` : '未开始'}
          </span>
        </div>
        <div style={{ fontSize: 12, color: '#94a3b8' }}>
          {cv.transferredToFollowUp ? `随访日期：${cv.followUpDate}` : `总耗时：${cv.processingDuration || '进行中'}`}
        </div>
      </div>
    </div>
  )
}
