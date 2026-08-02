import React, { useState, useEffect, useCallback } from 'react'
import { Modal, Card, Space, Typography, Button, Radio, Tag, Divider, Empty, Spin, message } from 'antd'
import { AlertTriangle, CheckCircle, ArrowLeftRight, GitMerge, User, Clock } from 'lucide-react'
import type { MobileConflict, ConflictResolutionStrategy } from '../../types/mobile'
import { offlineSync } from '../../services/mobile/offline/OfflineSync'

const { Text } = Typography

interface ConflictResolverProps {
  open: boolean
  onClose: () => void
  onResolved?: (conflict: MobileConflict) => void
  resolver?: string
}

const STRATEGY_OPTIONS: { value: ConflictResolutionStrategy; label: string; desc: string }[] = [
  { value: 'local-wins', label: '保留本地', desc: '使用本地数据覆盖服务器' },
  { value: 'server-wins', label: '采用服务器', desc: '丢弃本地更改，使用服务器数据' },
  { value: 'timestamp-newest', label: '最新优先', desc: '按时间戳取最新的值' },
  { value: 'merge', label: '合并', desc: '尝试合并本地和服务器数据' },
  { value: 'manual', label: '手动选择', desc: '手动选择要保留的值' },
]

export const ConflictResolver: React.FC<ConflictResolverProps> = ({ open, onClose, onResolved, resolver = 'current-user' }) => {
  const [conflicts, setConflicts] = useState<MobileConflict[]>([])
  const [loading, setLoading] = useState(true)
  const [resolving, setResolving] = useState<string | null>(null)
  const [strategies, setStrategies] = useState<Record<string, ConflictResolutionStrategy>>({})
  const [manualValues, setManualValues] = useState<Record<string, 'local' | 'server'>>({})

  const loadConflicts = useCallback(async () => {
    setLoading(true)
    try {
      const list = await offlineSync.getConflicts()
      setConflicts(list)
      const defaults: Record<string, ConflictResolutionStrategy> = {}
      const manuals: Record<string, 'local' | 'server'> = {}
      for (const c of list) {
        defaults[c.id] = 'timestamp-newest'
        manuals[c.id] = 'local'
      }
      setStrategies(defaults)
      setManualValues(manuals)
    } catch {
      void message.error('加载冲突列表失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) loadConflicts()
  }, [open, loadConflicts])

  const handleResolve = async (conflictId: string) => {
    const strategy = strategies[conflictId] ?? 'timestamp-newest'
    setResolving(conflictId)
    try {
      const ok = await offlineSync.resolveConflict(conflictId, strategy, resolver)
      if (ok) {
        void message.success('冲突已解决')
        const resolved = conflicts.find(c => c.id === conflictId)
        if (resolved) onResolved?.(resolved)
        setConflicts(prev => prev.filter(c => c.id !== conflictId))
      } else {
        void message.error('冲突解决失败')
      }
    } catch {
      void message.error('冲突解决出错')
    } finally {
      setResolving(null)
    }
  }

  const handleResolveAll = async () => {
    for (const c of conflicts) {
      await handleResolve(c.id)
    }
  }

  const handleSelectValue = (conflictId: string, value: string | undefined, side: 'local' | 'server') => {
    setManualValues(prev => ({ ...prev, [conflictId]: side }))
  }

  return (
    <Modal
      title={<Space><AlertTriangle size={16} color="#faad14" /> 解决冲突 ({conflicts.length})</Space>}
      open={open}
      onCancel={onClose}
      footer={
        conflicts.length > 0 ? (
          <Space>
            <Button onClick={onClose}>关闭</Button>
            <Button type="primary" icon={<CheckCircle size={14} />} onClick={handleResolveAll}>全部解决</Button>
          </Space>
        ) : null
      }
      width={520}
      destroyOnHidden
    >
      {loading ? <Spin style={{ display: 'block', margin: '24px auto' }} /> : conflicts.length === 0 ? (
        <Empty description="无冲突" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <Space orientation="vertical" style={{ width: '100%', maxHeight: 480, overflowY: 'auto' }} size={12}>
          {conflicts.map(c => (
            <Card key={c.id} size="small" style={{ borderLeft: '3px solid #faad14' }}>
              <Space orientation="vertical" style={{ width: '100%' }} size={8}>
                <Space>
                  <Tag color="blue">{c.entityType}</Tag>
                  <Tag>{c.entityId}</Tag>
                  <Text code>{c.field}</Text>
                </Space>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <Card size="small" style={{ background: '#f0fdf4' }}>
                    <Text type="secondary" style={{ fontSize: 12 }}><User size={10} /> 本地 ({c.localUserId})</Text>
                    <div style={{ fontSize: 13, marginTop: 4, wordBreak: 'break-all' }}>
                      {typeof c.localValue === 'object' ? JSON.stringify(c.localValue) : String(c.localValue ?? '')}
                    </div>
                    <Text type="secondary" style={{ fontSize: 12 }}><Clock size={10} /> {new Date(c.localTimestamp).toLocaleString()}</Text>
                  </Card>
                  <Card size="small" style={{ background: '#fef2f2' }}>
                    <Text type="secondary" style={{ fontSize: 12 }}><User size={10} /> 服务器 ({c.serverUserId ?? 'unknown'})</Text>
                    <div style={{ fontSize: 13, marginTop: 4, wordBreak: 'break-all' }}>
                      {typeof c.serverValue === 'object' ? JSON.stringify(c.serverValue) : String(c.serverValue ?? '')}
                    </div>
                    <Text type="secondary" style={{ fontSize: 12 }}><Clock size={10} /> {new Date(c.serverTimestamp).toLocaleString()}</Text>
                  </Card>
                </div>

                {manualValues[c.id] !== undefined && (
                  <Radio.Group
                    value={manualValues[c.id]}
                    onChange={e => handleSelectValue(c.id, undefined, e.target.value)}
                    size="small"
                    options={[
                      { value: 'local', label: `本地: ${typeof c.localValue === 'object' ? JSON.stringify(c.localValue) : String(c.localValue ?? '')}` },
                      { value: 'server', label: `服务器: ${typeof c.serverValue === 'object' ? JSON.stringify(c.serverValue) : String(c.serverValue ?? '')}` },
                    ]}
                  />
                )}

                <Divider style={{ margin: '4px 0' }} />

                <Space>
                  <Text type="secondary" style={{ fontSize: 12 }}>策略:</Text>
                  <Radio.Group
                    value={strategies[c.id]}
                    onChange={e => setStrategies(prev => ({ ...prev, [c.id]: e.target.value }))}
                    size="small"
                    options={STRATEGY_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
                  />
                  <Button
                    size="small"
                    type="primary"
                    icon={<GitMerge size={12} />}
                    loading={resolving === c.id}
                    onClick={() => handleResolve(c.id)}
                  >
                    解决
                  </Button>
                </Space>
              </Space>
            </Card>
          ))}
        </Space>
      )}
    </Modal>
  )
}

export default ConflictResolver
