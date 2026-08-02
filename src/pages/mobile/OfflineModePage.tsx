import React, { useState, useEffect, useCallback } from 'react'
import { Card, Space, Typography, Button, Tag, Switch, Progress, Statistic, Row, Col, Divider, message } from 'antd'
import { Wifi, WifiOff, CloudUpload, RefreshCw, Database, HardDrive, Trash2, AlertTriangle, CheckCircle } from 'lucide-react'
import { offlineSync } from '../../services/mobile/offline/OfflineSync'
import { indexedDbCache } from '../../services/mobile/offline/IndexedDbCache'
import { OfflineQueue } from '../../components/mobile/OfflineQueue'
import { ConflictResolver } from '../../components/mobile/ConflictResolver'
import { OfflineIndicator } from '../../components/mobile/OfflineIndicator'
import type { MobileCacheStats, NetworkConnectivity } from '../../types/mobile'

const { Text, Title } = Typography

export default function OfflineModePage() {
  const [connectivity, setConnectivity] = useState<NetworkConnectivity>('online')
  const [stats, setStats] = useState<MobileCacheStats | null>(null)
  const [queueCount, setQueueCount] = useState(0)
  const [showConflicts, setShowConflicts] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [offlineMode, setOfflineMode] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const s = await indexedDbCache.getStats()
      setStats(s)
      const q = await offlineSync.getQueueCount()
      setQueueCount(q)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 5000)
    const handleOnline = () => {
      setConnectivity('online')
      offlineSync.sync().catch((err) => { console.error('[F04]', err); })
    }
    const handleOffline = () => setConnectivity('offline')
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      clearInterval(interval)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [refresh])

  const handleSync = async () => {
    setSyncing(true)
    try {
      const result = await offlineSync.sync()
      void message.success(`同步完成: ${result.successCount} 成功, ${result.conflictCount} 冲突`)
      if (result.conflictCount > 0) setShowConflicts(true)
      await refresh()
    } catch {
      void message.error('同步失败')
    } finally {
      setSyncing(false)
    }
  }

  const handleClearCache = async () => {
    try {
      await indexedDbCache.clear()
      void message.success('缓存已清除')
      await refresh()
    } catch {
      void message.error('清除失败')
    }
  }

  const handleRequestPersist = async () => {
    const ok = await indexedDbCache.requestPersistentStorage()
    void message.info(ok ? '已请求持久化存储' : '持久化存储不可用')
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: 16, background: '#f8fafc', minHeight: '100vh', fontFamily: '-apple-system, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>离线模式</Title>
        <OfflineIndicator connectivity={connectivity} queueCount={queueCount} onSyncClick={handleSync} compact />
      </div>

      <Row gutter={8} style={{ marginBottom: 12 }}>
        <Col span={12}>
          <Card size="small">
            <Statistic title="队列" value={queueCount} prefix={<CloudUpload size={14} />} styles={{ content: {  fontSize: 18, color: '#3b82f6'  } }} />
          </Card>
        </Col>
        <Col span={12}>
          <Card size="small">
            <Statistic title="缓存" value={stats ? `${(stats.totalSizeBytes / 1024 / 1024).toFixed(1)}MB` : '-'}
              prefix={<HardDrive size={14} />} styles={{ content: {  fontSize: 18, color: '#16a34a'  } }} />
          </Card>
        </Col>
      </Row>

      <Card size="small" style={{ marginBottom: 12 }}>
        <Space orientation="vertical" style={{ width: '100%' }} size={8}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Space>
              {connectivity === 'online' ? <Wifi size={14} color="#16a34a" /> : <WifiOff size={14} color="#dc2626" />}
              <Text strong>网络状态</Text>
            </Space>
            <Tag color={connectivity === 'online' ? 'green' : 'red'}>{connectivity === 'online' ? '在线' : '离线'}</Tag>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Space>
              <Database size={14} />
              <Text style={{ fontSize: 12 }}>缓存条目</Text>
            </Space>
            <Text style={{ fontSize: 12 }}>{stats?.totalEntries ?? '-'}</Text>
          </div>
          {stats && (
            <Progress percent={Math.round(stats.usedRatio * 100)} size="small"
              status={stats.usedRatio > 0.8 ? 'exception' : 'active'} format={() => `${(stats.usedRatio * 100).toFixed(0)}%`} />
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 12, color: '#94a3b8' }}>命中率: {stats ? `${(stats.hitRatio * 100).toFixed(0)}%` : '-'}</Text>
            <Text style={{ fontSize: 12, color: '#94a3b8' }}>淘汰: {stats?.evictionCount ?? 0}</Text>
          </div>
        </Space>
      </Card>

      <Card size="small" style={{ marginBottom: 12 }}>
        <Space orientation="vertical" style={{ width: '100%' }} size={8}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text strong>离线模式</Text>
            <Switch checked={offlineMode} onChange={setOfflineMode} />
          </div>
          <Text type="secondary" style={{ fontSize: 12 }}>开启后优先使用本地缓存数据，仅在需要时联网同步</Text>
        </Space>
      </Card>

      <Button type="primary" block icon={<RefreshCw size={14} />} onClick={handleSync} loading={syncing}
        style={{ marginBottom: 12 }} disabled={queueCount === 0}>
        {syncing ? '同步中...' : `同步离线数据 (${queueCount})`}
      </Button>

      <OfflineQueue maxHeight={300} onSyncComplete={() => refresh()} />

      <Divider style={{ margin: '12px 0', fontSize: 12, color: '#94a3b8' }}>缓存管理</Divider>

      <Space style={{ width: '100%' }} size={8}>
        <Button icon={<HardDrive size={14} />} onClick={handleRequestPersist} size="small">请求持久化</Button>
        <Button icon={<Trash2 size={14} />} onClick={handleClearCache} size="small" danger>清除缓存</Button>
        <Button icon={<AlertTriangle size={14} />} onClick={() => setShowConflicts(true)} size="small">冲突管理</Button>
      </Space>

      {stats && (
        <Card size="small" style={{ marginTop: 12 }}>
          <Space orientation="vertical" style={{ width: '100%' }} size={4}>
            <Row gutter={8}>
              <Col span={8}><Text style={{ fontSize: 12, color: '#94a3b8' }}>配额</Text></Col>
              <Col span={8}><Text style={{ fontSize: 12, color: '#94a3b8' }}>已用</Text></Col>
              <Col span={8}><Text style={{ fontSize: 12, color: '#94a3b8' }}>可用</Text></Col>
            </Row>
            <Row gutter={8}>
              <Col span={8}><Text strong>{(stats.quotaBytes / 1024 / 1024).toFixed(0)} MB</Text></Col>
              <Col span={8}><Text strong>{(stats.totalSizeBytes / 1024 / 1024).toFixed(1)} MB</Text></Col>
              <Col span={8}><Text strong>{((stats.quotaBytes - stats.totalSizeBytes) / 1024 / 1024).toFixed(0)} MB</Text></Col>
            </Row>
          </Space>
        </Card>
      )}

      <ConflictResolver open={showConflicts} onClose={() => { setShowConflicts(false); refresh() }} onResolved={() => refresh()} />
    </div>
  )
}
