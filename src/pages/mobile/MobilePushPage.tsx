import React, { useState, useEffect } from 'react'
import { message } from 'antd'
import { Bell, BellOff, Send, Trash2, Clock, CheckCircle, AlertTriangle, Filter } from 'lucide-react'
import { pushService } from '../../services/mobile/push/PushService'
import { mobileApi } from '../../services/api'
import type { PushPayload, PushSubscription } from '../../types/mobile'

interface PushNotificationItem {
  id: string
  title: string
  body: string
  tag: string
  topic?: string
  severity: 'info' | 'warning' | 'critical'
  read: boolean
  receivedAt: string
  data?: Record<string, unknown>
}

const SEVERITY_CONFIG: Record<string, { bg: string; color: string; borderColor: string; icon: React.ComponentType<{ size?: number | string; style?: React.CSSProperties }> }> = {
  info: { bg: '#dbeafe', color: '#2563eb', borderColor: '#93c5fd', icon: Bell },
  warning: { bg: '#fef3c7', color: '#d97706', borderColor: '#fcd34d', icon: AlertTriangle },
  critical: { bg: '#fee2e2', color: '#dc2626', borderColor: '#fca5a5', icon: AlertTriangle },
}

const DEFAULT_SEVERITY = { bg: '#dbeafe', color: '#2563eb', borderColor: '#93c5fd', icon: Bell }

const TOPIC_LABELS: Record<string, string> = {
  critical: '危急值',
  report: '报告',
  appointment: '预约',
  system: '系统',
}

/**
 * v3.0.6.11-75: Web Push 订阅成功后同步注册设备 token 到后端 /mobile/device-token
 * (PushService 已同步 /notifications/push-subscribe; 此处补 mobile 设备注册通道)
 */
async function registerDeviceToken(sub: PushSubscription): Promise<void> {
  try {
    const res = await mobileApi.registerDeviceToken({
      token: sub.endpoint,
      platform: sub.channel === 'fcm' ? 'android' : sub.channel === 'apns' ? 'ios' : 'web',
      deviceId: sub.deviceId || 'web-push',
      userId: sub.userId || 'demo-user',
    })
    if (!res.success) console.warn('[push] device-token registration failed', res.error)
  } catch (e) {
    console.warn('[push] device-token registration error', (e as Error)?.message)
  }
}

export default function MobilePushPage() {
  const [notifications, setNotifications] = useState<PushNotificationItem[]>([])
  const [filterTopic, setFilterTopic] = useState<string>('all')
  const [filterSeverity, _setFilterSeverity] = useState<string>('all')
  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushPermission, setPushPermission] = useState(pushService.permission)
  const [showTestPanel, setShowTestPanel] = useState(false)
  const [testTitle, setTestTitle] = useState('测试推送通知')
  const [testBody, setTestBody] = useState('这是一条测试推送消息')

  useEffect(() => {
    setPushPermission(pushService.permission)
    setPushEnabled(pushService.permission === 'granted')
    // Phase 1.5: 注册 PWA SW(推送事件监听), build 模式生效
    void pushService.init().then((ok) => {
      if (ok && pushService.permission === 'granted') {
        void pushService.getSubscription().then((sub) => {
          if (!sub) {
            void pushService.subscribe('', 'demo-user', 'web', ['critical', 'report', 'appointment', 'system'])
              .then((newSub) => { if (newSub) void registerDeviceToken(newSub) })
          }
        })
      }
    })
  }, [])

  useEffect(() => {
    // 监听 SW 推送消息 → 同步到应用内列表
    const unsub = pushService.on({
      onNotification: (payload) => {
        setNotifications((prev) => {
          const item: PushNotificationItem = {
            id: `PN-${payload.tag || Date.now()}`,
            title: payload.title,
            body: payload.body,
            tag: payload.tag || '',
            topic: payload.topic || 'critical',
            severity: (payload.severity as PushNotificationItem['severity']) || 'info',
            read: false,
            receivedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
            data: payload.data as Record<string, unknown> | undefined,
          }
          return [item, ...prev]
        })
      },
    })
    return unsub
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch('/api/v1/mobile/push-notifications').then(r => r.json())
        if (!cancelled && res.data && Array.isArray(res.data)) {
          setNotifications(res.data.map((n: any) => ({
            id: n.id || `PN${Date.now()}`,
            title: n.title || '通知',
            body: n.body || '',
            tag: n.tag || '',
            topic: n.topic || 'system',
            severity: n.severity || 'info',
            read: n.read || false,
            receivedAt: n.receivedAt || new Date().toLocaleString('zh-CN'),
            data: n.data,
          })))
        }
      } catch { /* keep empty */ }
    })()
    return () => { cancelled = true }
  }, [])

  const filtered = notifications.filter((n) => {
    if (filterTopic !== 'all' && n.topic !== filterTopic) return false
    if (filterSeverity !== 'all' && n.severity !== filterSeverity) return false
    return true
  })

  const unreadCount = notifications.filter((n) => !n.read).length

  const handleEnablePush = async () => {
    const perm = await pushService.requestPermission()
    setPushPermission(perm)
    setPushEnabled(perm === 'granted')
    if (perm === 'granted') {
      // Phase 1.5: 真实 Web Push 订阅 (VAPID + 后端同步)
      const sub = await pushService.subscribe('', 'demo-user', 'web', ['critical', 'report', 'appointment', 'system'])
      if (sub) {
        void registerDeviceToken(sub)
        message.success('推送通知已开启 (Web Push)')
      } else {
        message.warning('订阅失败: 浏览器或后端推送通道不可用')
      }
    } else if (perm === 'denied') {
      message.warning('推送通知被拒绝，请在系统设置中允许通知')
    } else {
      message.info('浏览器不支持推送通知')
    }
  }

  const handleMarkRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n))
  }

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    message.success('已全部标记为已读')
  }

  const handleDelete = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
    message.success('已删除')
  }

  const handleClearAll = () => {
    setNotifications([])
    message.success('已清空所有通知')
  }

  const handleTestPush = async () => {
    const payload: PushPayload = {
      title: testTitle,
      body: testBody,
      tag: `test-${Date.now()}`,
      topic: 'critical',
      data: { type: 'test' },
    }
    await pushService.simulatePushFromServer(payload)
    const newItem: PushNotificationItem = {
      id: `PN-TEST-${Date.now()}`,
      title: payload.title,
      body: payload.body,
      tag: payload.tag,
      topic: 'critical',
      severity: 'info',
      read: false,
      receivedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
    }
    setNotifications((prev) => [newItem, ...prev])
    message.success('测试推送已发送')
  }

  const containerStyle: React.CSSProperties = {
    maxWidth: 480, margin: '0 auto', padding: 16,
    background: '#f8fafc', minHeight: '100vh',
    fontFamily: '-apple-system, sans-serif',
  }

  const headerStyle: React.CSSProperties = {
    background: 'linear-gradient(135deg, #1e40af, #2563eb)',
    borderRadius: 12, padding: 16, marginBottom: 16, color: '#fff',
  }

  const cardStyle: React.CSSProperties = {
    background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0',
    marginBottom: 8, overflow: 'hidden',
  }

  const btnBase: React.CSSProperties = {
    minHeight: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
    border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer',
    fontSize: 13, padding: '8px 14px',
  }

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>移动端推送管理</div>
            <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>推送通知配置 · 历史记录 · 测试</div>
          </div>
          <div style={{
            width: 44, height: 44, borderRadius: 10,
            background: pushEnabled ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {pushEnabled ? <Bell size={22} color="#34d399" /> : <BellOff size={22} color="#f87171" />}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {[
            { value: unreadCount, label: '未读', bg: 'rgba(255,255,255,0.15)' },
            { value: notifications.length, label: '总计', bg: 'rgba(255,255,255,0.15)' },
            { value: notifications.filter(n => n.severity === 'critical').length, label: '危急', bg: 'rgba(239,68,68,0.3)' },
          ].map((s) => (
            <div key={s.label} style={{ background: s.bg, borderRadius: 8, padding: '8px 4px', textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800 }}>{s.value}</div>
              <div style={{ fontSize: 11, opacity: 0.8 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ ...cardStyle, padding: 12 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleEnablePush}
            disabled={pushEnabled}
            style={{
              ...btnBase, flex: 1, gap: 6,
              background: pushEnabled ? '#d1fae5' : '#1e40af',
              color: pushEnabled ? '#059669' : '#fff',
              opacity: pushEnabled ? 0.7 : 1,
              cursor: pushEnabled ? 'not-allowed' : 'pointer',
            }}
          >
            {pushEnabled ? <CheckCircle size={14} /> : <Bell size={14} />}
            {pushEnabled ? '已开启' : '开启推送'}
          </button>
          <button onClick={() => setShowTestPanel(!showTestPanel)} style={{ ...btnBase, background: '#f1f5f9', color: '#64748b', gap: 6 }}>
            <Send size={14} />测试推送
          </button>
        </div>
        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 8 }}>
          推送状态: <span style={{ color: pushPermission === 'granted' ? '#059669' : '#dc2626', fontWeight: 600 }}>
            {pushPermission === 'granted' ? '已授权' : pushPermission === 'denied' ? '已拒绝' : pushPermission === 'unsupported' ? '不支持' : '未授权'}
          </span>
          <span style={{ marginLeft: 8 }}>渠道: <span style={{ fontWeight: 600 }}>{pushService.supported ? 'Web Push' : 'N/A'}</span></span>
        </div>
      </div>

      {showTestPanel && (
        <div style={{ ...cardStyle, padding: 12, border: '1px solid #bfdbfe', background: '#eff6ff' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1e40af', marginBottom: 10 }}>推送测试面板</div>
          <div style={{ marginBottom: 8 }}>
            <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 4 }}>标题</label>
            <input
              value={testTitle}
              onChange={(e) => setTestTitle(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ marginBottom: 8 }}>
            <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 4 }}>内容</label>
            <textarea
              value={testBody}
              onChange={(e) => setTestBody(e.target.value)}
              rows={2}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 13, outline: 'none', resize: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <button onClick={handleTestPush} style={{ ...btnBase, width: '100%', background: '#2563eb', color: '#fff', gap: 6 }}>
            <Send size={14} />发送测试推送
          </button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Filter size={12} color="#64748b" />
          <span style={{ fontSize: 12, color: '#64748b' }}>分类:</span>
        </div>
        {['all', 'critical', 'report', 'appointment', 'system'].map((topic) => (
          <button
            key={topic}
            onClick={() => setFilterTopic(topic)}
            style={{
              padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer',
              background: filterTopic === topic ? '#1e40af' : '#f1f5f9',
              color: filterTopic === topic ? '#fff' : '#64748b',
            }}
          >
            {topic === 'all' ? '全部' : TOPIC_LABELS[topic] || topic}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: '#64748b' }}>
          共 <span style={{ fontWeight: 700, color: '#1e40af' }}>{filtered.length}</span> 条通知
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={handleMarkAllRead} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: 11, cursor: 'pointer' }}>
            <CheckCircle size={11} style={{ marginRight: 3 }} />全部已读
          </button>
          <button onClick={handleClearAll} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #fca5a5', background: '#fff', color: '#dc2626', fontSize: 11, cursor: 'pointer' }}>
            <Trash2 size={11} style={{ marginRight: 3 }} />清空
          </button>
        </div>
      </div>

      {filtered.map((n) => {
        const cfg = SEVERITY_CONFIG[n.severity] ?? DEFAULT_SEVERITY
        const SeverityIcon = cfg.icon
        return (
          <div
            key={n.id}
            onClick={() => handleMarkRead(n.id)}
            style={{
              ...cardStyle,
              padding: 12, cursor: 'pointer',
              borderLeft: `4px solid ${cfg.borderColor}`,
              background: n.read ? '#fff' : '#fafbff',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 8, background: cfg.bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <SeverityIcon size={16} style={{ color: cfg.color }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{n.title}</span>
                  {!n.read && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#dc2626' }} />}
                  <span style={{
                    padding: '1px 6px', borderRadius: 8, fontSize: 10, fontWeight: 600,
                    background: cfg.bg, color: cfg.color,
                  }}>
                    {TOPIC_LABELS[n.topic || 'system'] || '系统'}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>{n.body}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>
                    <Clock size={10} style={{ marginRight: 2 }} />
                    {n.receivedAt}
                  </span>
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(n.id) }}
                style={{ padding: 4, border: 'none', background: 'transparent', cursor: 'pointer', color: '#cbd5e1' }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        )
      })}

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
          <BellOff size={32} style={{ marginBottom: 8, opacity: 0.5 }} />
          <div style={{ fontSize: 14 }}>暂无推送通知</div>
        </div>
      )}

      <div style={{ marginTop: 16, padding: 12, background: '#f1f5f9', borderRadius: 8 }}>
        <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.8 }}>
          <strong>推送配置说明</strong><br />
          - 危急值通知: 实时推送危急检查结果，需立即处理<br />
          - 报告完成: 报告审核完成后推送给申请医生<br />
          - 预约提醒: 检查预约前30分钟推送提醒<br />
          - 系统公告: 系统维护和更新通知
        </div>
      </div>
    </div>
  )
}
