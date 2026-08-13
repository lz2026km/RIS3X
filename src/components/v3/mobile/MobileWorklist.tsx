import React, { useState, useMemo, useEffect } from 'react'
import { Card as ACard, Tag as ATag, Space as ASpace, Button as AButton, Empty as AEmpty, Badge as ABadge, Tabs as ATabs, Statistic as AStatistic, Row as ARow, Col as ACol, Input, List, Tag } from 'antd'
import { ChevronRight, WifiOff } from 'lucide-react'
import { offlineStorage, type OfflineWorklistItem } from '../../../services/pwa/offlineStorage'

export interface MobileWorklistItem {
  id: string
  patientName: string
  patientId: string
  modality: string
  bodyPart?: string
  studyDate: string
  studyTime: string
  state: 'PENDING' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'CRITICAL'
  priority: 'ROUTINE' | 'URGENT' | 'STAT'
  reportState?: string
  author?: string
  critical?: boolean
}

export interface MobileWorklistProps {
  items: MobileWorklistItem[]
  onSelect?: (id: string) => void
  onRefresh?: () => Promise<void>
  offline?: boolean
}

const STATE_META: Record<MobileWorklistItem['state'], { color: string; label: string }> = {
  PENDING: { color: 'default', label: '待写' },
  IN_REVIEW: { color: 'gold', label: '审核中' },
  APPROVED: { color: 'green', label: '已通过' },
  REJECTED: { color: 'red', label: '已退回' },
  CRITICAL: { color: 'magenta', label: '危急' },
}

const PRIORITY_META = {
  ROUTINE: { color: 'default', label: '常规' },
  URGENT: { color: 'orange', label: '加急' },
  STAT: { color: 'red', label: '急诊' },
} as const

export const MobileWorklist: React.FC<MobileWorklistProps> = ({ items, onSelect, onRefresh, offline }) => {
  const [tab, setTab] = useState<'all' | 'pending' | 'critical' | 'mine'>('all')
  const [search, setSearch] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    if (offline && items.length > 0) {
      const offlineItems: OfflineWorklistItem[] = items.map((i) => ({
        id: i.id, patientName: i.patientName, patientId: i.patientId,
        modality: i.modality, bodyPart: i.bodyPart, studyDate: i.studyDate,
        state: i.state, priority: i.priority, synced: false, updatedAt: Date.now(),
      }))
      void offlineStorage.saveWorklist(offlineItems)
    }
  }, [items, offline])

  const filtered = useMemo(() => {
    let result = items
    if (tab === 'pending') result = result.filter((i) => i.state === 'PENDING' || i.state === 'IN_REVIEW')
    else if (tab === 'critical') result = result.filter((i) => i.critical)
    else if (tab === 'mine') result = result.filter((i) => i.author === 'me')
    if (search) {
      const q = search.toLowerCase()
      result = result.filter((i) => i.patientName.toLowerCase().includes(q) || i.patientId.includes(q))
    }
    return result.sort((a, b) => {
      const order = { STAT: 0, URGENT: 1, ROUTINE: 2 }
      return order[a.priority] - order[b.priority]
    })
  }, [items, tab, search])

  const stats = useMemo(() => {
    return {
      pending: items.filter((i) => i.state === 'PENDING' || i.state === 'IN_REVIEW').length,
      critical: items.filter((i) => i.critical).length,
      completed: items.filter((i) => i.state === 'APPROVED').length,
    }
  }, [items])

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await onRefresh?.()
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <div data-testid="mobile-worklist" style={{ maxWidth: 480, margin: '0 auto', padding: 12, background: 'var(--bg-primary)', minHeight: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
      {offline && (
        <div style={{ textAlign: 'center', marginBottom: 8 }} data-testid="mob-offline-badge">
          <Tag icon={<WifiOff size={12} />} color="warning">离线模式</Tag>
        </div>
      )}
      <ARow gutter={8} style={{ marginBottom: 12 }}>
        <ACol span={8}><ACard size="small"><AStatistic title="待办" value={stats.pending} styles={{ content: {  fontSize: 18, color: '#3b82f6'  } }} /></ACard></ACol>
        <ACol span={8}><ACard size="small"><AStatistic title="危急" value={stats.critical} styles={{ content: {  fontSize: 18, color: '#dc2626'  } }} /></ACard></ACol>
        <ACol span={8}><ACard size="small"><AStatistic title="完成" value={stats.completed} styles={{ content: {  fontSize: 18, color: '#16a34a'  } }} /></ACard></ACol>
      </ARow>
      <Input placeholder="搜索患者" value={search} onChange={(e) => setSearch(e.target.value)} style={{ marginBottom: 8 }} data-testid="mob-search" allowClear />
      <ATabs activeKey={tab} onChange={(k) => setTab(k as any)}
        items={[
          { key: 'all', label: `全部 (${items.length})` },
          { key: 'pending', label: `待办 (${stats.pending})` },
          { key: 'critical', label: `危急 (${stats.critical})` },
          { key: 'mine', label: '我的' },
        ]}
      />
      <AButton onClick={handleRefresh} loading={refreshing} block style={{ marginBottom: 8 }} data-testid="mob-refresh">下拉刷新</AButton>
      {filtered.length === 0 ? <AEmpty description="无任务" /> : (
        <List dataSource={filtered} renderItem={(i) => {
          const s = STATE_META[i.state]; const p = PRIORITY_META[i.priority]
          return (
            <ACard size="small" hoverable onClick={() => onSelect?.(i.id)} data-testid={`mob-item-${i.id}`}
              style={{ marginBottom: 8, borderLeft: `3px solid ${i.critical ? '#dc2626' : p.color === 'red' ? '#dc2626' : '#3b82f6'}` }}>
              <ASpace size={4} wrap>
                <ATag color="blue">{i.modality}</ATag>
                {i.bodyPart && <ATag>{i.bodyPart}</ATag>}
                <ATag color={p.color}>{p.label}</ATag>
                <ATag color={s.color}>{s.label}</ATag>
                {i.critical && <ABadge count="危急" />}
              </ASpace>
              <div style={{ fontSize: 16, fontWeight: 600, marginTop: 4 }}>{i.patientName}</div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>{i.patientId} · {i.studyDate} {i.studyTime}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                <span style={{ fontSize: 12, color: '#94a3b8' }}>{i.author ?? '未分配'}</span>
                <ChevronRight size={14} color="#94a3b8" />
              </div>
            </ACard>
          )
        }} />
      )}
    </div>
  )
}

export default MobileWorklist
