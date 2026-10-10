import React, { useState, useEffect } from 'react'
import { message } from 'antd'
import { Bell, BellOff, Send, Trash2, Clock, CheckCircle, AlertTriangle, Filter } from 'lucide-react'
import { pushService } from '../../services/mobile/push/PushService'
import { mobileApi, notificationsApi } from '../../services/api'
import type { PushPayload, PushSubscription } from '../../types/mobile'
import type { NotificationSubscriptionType } from '../../services/api/notificationsApi'
import { LoadingBanner } from '../../components/feedback'
import { t } from '../../i18n/appI18n'

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
  info: { bg: 'var(--color-info-bg)', color: 'var(--color-info)', borderColor: 'var(--color-info-border)', icon: Bell },
  warning: { bg: 'var(--color-warning-bg)', color: 'var(--color-warning)', borderColor: 'var(--color-warning-border)', icon: AlertTriangle },
  critical: { bg: 'var(--color-error-bg)', color: 'var(--color-error)', borderColor: 'var(--color-error-border)', icon: AlertTriangle },
}
const DEFAULT_SEVERITY = { bg: 'var(--color-info-bg)', color: 'var(--color-info)', borderColor: 'var(--color-info-border)', icon: Bell }

const topicLabel = (topic: string): string => ({
  critical: t('mobilePush.topicCritical'),
  report: t('mobilePush.topicReport'),
  appointment: t('mobilePush.topicAppointment'),
  system: t('mobilePush.topicSystem'),
}[topic] ?? t('mobilePush.topicSystem'))

// [v3.0.6.11-99 Wave7B] 推送订阅类型 (与通知中心订阅管理共享后端 GET/PUT /notifications/subscriptions)
const subscriptionOptions = (): Array<{ key: NotificationSubscriptionType; label: string }> => [
  { key: 'CRITICAL', label: t('mobilePush.subCritical') },
  { key: 'REPORT', label: t('mobilePush.subReport') },
  { key: 'FOLLOWUP', label: t('mobilePush.subFollowup') },
  { key: 'QUALITY', label: t('mobilePush.subQuality') },
  { key: 'SYSTEM', label: t('mobilePush.subSystem') },
]

const SUB_STORAGE_KEY = 'notify-subscription-types'

function loadLocalSubTypes(): string[] {
  try {
    const raw = localStorage.getItem(SUB_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as string[]
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch { /* ignore */ }
  return ['CRITICAL', 'REPORT', 'FOLLOWUP', 'QUALITY', 'SYSTEM']
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
  const [testTitle, setTestTitle] = useState(t('mobilePush.testTitleDefault'))
  const [testBody, setTestBody] = useState(t('mobilePush.testBodyDefault'))
  // [v3.0.6.11-99 Wave7B] 推送订阅类型: 后端 /notifications/subscriptions + localStorage 持久化
  const [subTypes, setSubTypes] = useState<string[]>(loadLocalSubTypes)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      const res = await notificationsApi.getSubscriptions('demo-user')
      if (res.success && res.data?.types?.length) {
        setSubTypes(res.data.types)
        localStorage.setItem(SUB_STORAGE_KEY, JSON.stringify(res.data.types))
      }
    })()
  }, [])

  const toggleSubType = (t: NotificationSubscriptionType) => {
    const next = subTypes.includes(t)
      ? t === 'CRITICAL' ? subTypes : subTypes.filter(x => x !== t)
      : [...subTypes, t]
    const finalTypes = next.length > 0 ? next : ['CRITICAL', 'REPORT', 'FOLLOWUP', 'QUALITY', 'SYSTEM']
    setSubTypes(finalTypes)
    localStorage.setItem(SUB_STORAGE_KEY, JSON.stringify(finalTypes))
    void notificationsApi.updateSubscriptions('demo-user', finalTypes as NotificationSubscriptionType[]).then(res => {
      if (!res.success) console.warn('[push] subscription update failed', res.error?.message)
    })
  }

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
      setLoading(true)
      try {
        const res = await fetch('/api/v1/mobile/push-notifications').then(r => r.json())
        if (!cancelled && res.data && Array.isArray(res.data)) {
          setNotifications(res.data.map((n: any) => ({
            id: n.id || `PN${Date.now()}`,
        title: n.title || t('mobilePush.notification'),
            body: n.body || '',
            tag: n.tag || '',
            topic: n.topic || 'system',
            severity: n.severity || 'info',
            read: n.read || false,
            receivedAt: n.receivedAt || new Date().toLocaleString('zh-CN'),
            data: n.data,
          })))
        }
      } catch { /* keep empty */ } finally {
        if (!cancelled) setLoading(false)
      }
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
        message.success(t('mobilePush.pushEnabled'))
      } else {
        message.warning(t('mobilePush.subscribeFailed'))
      }
    } else if (perm === 'denied') {
      message.warning(t('mobilePush.pushDenied'))
    } else {
      message.info(t('mobilePush.pushUnsupported'))
    }
  }

  const handleMarkRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n))
  }

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    message.success(t('mobilePush.allMarkedRead'))
  }

  const handleDelete = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
    message.success(t('mobilePush.deleted'))
  }

  const handleClearAll = () => {
    setNotifications([])
    message.success(t('mobilePush.allCleared'))
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
    message.success(t('mobilePush.testPushSent'))
  }

  const containerStyle: React.CSSProperties = {
    maxWidth: 480, margin: '0 auto', padding: 16,
    background: 'var(--bg-primary)', fontFamily: '-apple-system, sans-serif',
  }

  const headerStyle: React.CSSProperties = {
    background: 'linear-gradient(135deg, #1e40af, #2563eb)',
    borderRadius: 12, padding: 16, marginBottom: 16, color: '#fff',
  }

  const cardStyle: React.CSSProperties = {
    background: 'var(--bg-card)', borderRadius: 10, border: '1px solid var(--border-color)',
    marginBottom: 8, overflow: 'hidden',
  }

  const btnBase: React.CSSProperties = {
    minHeight: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
    border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer',
    fontSize: 12, padding: '8px 14px',
  }

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{t('mobilePush.title')}</div>
            <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>{t('mobilePush.subtitle')}</div>
            {/* [v3.0.6.11-88 Round10] /mobile/push-notifications 后端未实现, MSW 演示数据 */}
            <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>{t('mobilePush.dataSource')}</div>
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
            { value: unreadCount, label: t('mobilePush.labelUnread'), bg: 'rgba(255,255,255,0.15)' },
            { value: notifications.length, label: t('mobilePush.labelTotal'), bg: 'rgba(255,255,255,0.15)' },
            { value: notifications.filter(n => n.severity === 'critical').length, label: t('mobilePush.labelCritical'), bg: 'rgba(239,68,68,0.3)' },
          ].map((s) => (
            <div key={s.label} style={{ background: s.bg, borderRadius: 8, padding: '8px 4px', textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800 }}>{s.value}</div>
              <div style={{ fontSize: 11, opacity: 0.8 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {loading && <LoadingBanner message={t('w9.states.loading')} />}

      <div style={{ ...cardStyle, padding: 12 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleEnablePush}
            disabled={pushEnabled}
            style={{
              ...btnBase, flex: 1, gap: 6,
              background: pushEnabled ? 'var(--color-success-bg)' : '#1e40af',
              color: pushEnabled ? 'var(--color-success)' : '#fff',
              opacity: pushEnabled ? 0.7 : 1,
              cursor: pushEnabled ? 'not-allowed' : 'pointer',
            }}
          >
            {pushEnabled ? <CheckCircle size={14} /> : <Bell size={14} />}
            {pushEnabled ? t('mobilePush.enabled') : t('mobilePush.enablePush')}
          </button>
          <button onClick={() => setShowTestPanel(!showTestPanel)} style={{ ...btnBase, background: 'var(--bg-card)', color: '#64748b', gap: 6 }}>
            <Send size={14} />{t('mobilePush.testPush')}
          </button>
        </div>
        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 8 }}>
          {t('mobilePush.pushStatus')} <span style={{ color: pushPermission === 'granted' ? '#059669' : '#dc2626', fontWeight: 600 }}>
            {pushPermission === 'granted' ? t('mobilePush.authorized') : pushPermission === 'denied' ? t('mobilePush.denied') : pushPermission === 'unsupported' ? t('mobilePush.unsupported') : t('mobilePush.unauthorized')}
          </span>
          <span style={{ marginLeft: 8 }}>{t('mobilePush.channel')} <span style={{ fontWeight: 600 }}>{pushService.supported ? t('mobilePush.browserPush') : 'N/A'}</span></span>
        </div>
      </div>

      {showTestPanel && (
        <div style={{ ...cardStyle, padding: 12, border: '1px solid var(--color-info-border)', background: 'var(--color-info-bg)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#1e40af', marginBottom: 10 }}>{t('mobilePush.testPanel')}</div>
          <div style={{ marginBottom: 8 }}>
            <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 4 }}>{t('mobilePush.formTitle')}</label>
            <input
              value={testTitle}
              onChange={(e) => setTestTitle(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border-color)', fontSize: 12, boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ marginBottom: 8 }}>
            <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 4 }}>{t('mobilePush.formBody')}</label>
            <textarea
              value={testBody}
              onChange={(e) => setTestBody(e.target.value)}
              rows={2}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border-color)', fontSize: 12, resize: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <button onClick={handleTestPush} style={{ ...btnBase, width: '100%', background: '#2563eb', color: '#fff', gap: 6 }}>
            <Send size={14} />{t('mobilePush.sendTestPush')}
          </button>
        </div>
      )}

      {/* [v3.0.6.11-99 Wave7B] 推送订阅类型: 危急值/报告完成/随访提醒/质控通知/系统公告 */}
      <div style={{ ...cardStyle, padding: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#1e40af', marginBottom: 8 }}>{t('mobilePush.subscriptionTypes')}</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {subscriptionOptions().map(opt => {
            const checked = subTypes.includes(opt.key)
            return (
              <button
                key={opt.key}
                onClick={() => toggleSubType(opt.key)}
                style={{
                  padding: '5px 12px', borderRadius: 14, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
                  background: checked ? (opt.key === 'CRITICAL' ? '#dc2626' : '#1e40af') : 'var(--bg-card)',
                  color: checked ? '#fff' : '#64748b',
                  opacity: opt.key === 'CRITICAL' && !checked ? 0.5 : 1,
                }}
              >
                {checked ? '' : ''}{opt.label}
              </button>
            )
          })}
        </div>
        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 8 }}>
          {t('mobilePush.subscriptionHint')}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Filter size={12} color="#64748b" />
          <span style={{ fontSize: 12, color: '#64748b' }}>{t('mobilePush.category')}</span>
        </div>
        {['all', 'critical', 'report', 'appointment', 'system'].map((topic) => (
          <button
            key={topic}
            onClick={() => setFilterTopic(topic)}
            style={{
              padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer',
              background: filterTopic === topic ? '#1e40af' : 'var(--bg-card)',
              color: filterTopic === topic ? '#fff' : '#64748b',
            }}
          >
            {topic === 'all' ? t('mobilePush.filterAll') : topicLabel(topic)}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: '#64748b' }}>
          {t('mobilePush.totalPrefix')} <span style={{ fontWeight: 700, color: '#1e40af' }}>{filtered.length}</span> {t('mobilePush.totalSuffix')}
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={handleMarkAllRead} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: '#64748b', fontSize: 11, cursor: 'pointer' }}>
            <CheckCircle size={11} style={{ marginRight: 3 }} />{t('mobilePush.markAllRead')}
          </button>
          <button onClick={handleClearAll} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--color-error-border)', background: 'var(--bg-card)', color: '#dc2626', fontSize: 11, cursor: 'pointer' }}>
            <Trash2 size={11} style={{ marginRight: 3 }} />{t('mobilePush.clear')}
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
              background: n.read ? 'var(--bg-card)' : 'var(--color-info-bg)',
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
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{n.title}</span>
                  {!n.read && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#dc2626' }} />}
                  <span style={{
                    padding: '1px 6px', borderRadius: 8, fontSize: 10, fontWeight: 600,
                    background: cfg.bg, color: cfg.color,
                  }}>
                    {topicLabel(n.topic || 'system')}
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
          <div style={{ fontSize: 14 }}>{t('mobilePush.noNotifications')}</div>
        </div>
      )}

      <div style={{ marginTop: 16, padding: 12, background: 'var(--bg-card)', borderRadius: 8 }}>
        <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.8 }}>
          <strong>{t('mobilePush.configTitle')}</strong><br />
          {t('mobilePush.configLine1')}<br />
          {t('mobilePush.configLine2')}<br />
          {t('mobilePush.configLine3')}<br />
          {t('mobilePush.configLine4')}
        </div>
      </div>
    </div>
  )
}
