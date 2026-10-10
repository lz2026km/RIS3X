// ============================================================
// G005 放射科RIS系统 - 通知中心页面 v1.0.0
// 统一管理所有系统通知，支持分类、筛选、设置
// ============================================================
import { useState, useMemo, useCallback, useEffect } from 'react'
import {
  Bell, BellRing, FileText, AlertTriangle, Settings, Calendar,
  MessageSquare, Check, CheckCheck, Trash2, Search, X,
  Clock, RefreshCw, Eye,
  AlertCircle, Zap,
  Mail, Smartphone, BarChart3, Send
} from 'lucide-react'
import { Switch } from 'antd'
import { notificationsApi } from '../services/api'
import type { NotificationDto, NotificationSubscriptionType } from '../services/api/notificationsApi'
import { realtime, type RealtimePayload } from '../services/realtime'
import { getCurrentUser } from '../utils/auth'
import { LoadingBanner, ErrorBanner } from '../components/feedback'
import { formatTime } from '../utils/date';
import { t } from '../i18n/appI18n'
import NotificationPreferencesSection from './NotificationPreferencesSection'

// ============================================================
// 常量定义
// ============================================================
const PRIMARY = 'var(--color-primary-800)'
const ACCENT = '#3182ce'
const SUCCESS = '#059669'
const WARNING = 'var(--color-warning-600)'
const DANGER = 'var(--color-error-600)'
const PURPLE = '#7c3aed'
const GRAY = 'var(--text-secondary, #475569)'
const BG = 'var(--bg-primary)'
const WHITE = 'var(--bg-card, #ffffff)'

const NOTIFICATION_TYPES = [
  { key: 'all', label: t('notification.typeAll'), icon: <Bell size={14} />, color: PRIMARY },
  { key: 'report_completed', label: t('notification.typeReport'), icon: <FileText size={14} />, color: 'var(--color-primary-500)' },
  { key: 'critical_value', label: t('notification.typeCritical'), icon: <AlertTriangle size={14} />, color: DANGER },
  // [v3.0.6.11-99 Wave10B] 新增筛选类型: 随访 / 质控
  { key: 'followup', label: t('notification.typeFollowup'), icon: <Calendar size={14} />, color: '#8b5cf6' },
  { key: 'quality', label: t('notification.typeQuality'), icon: <BarChart3 size={14} />, color: '#10b981' },
  { key: 'system', label: t('notification.typeSystem'), icon: <Settings size={14} />, color: 'var(--text-secondary)' },
  { key: 'appointment', label: t('notification.typeAppointment'), icon: <Calendar size={14} />, color: SUCCESS },
  { key: 'consultation', label: t('notification.typeConsultation'), icon: <MessageSquare size={14} />, color: PURPLE },
]

const PRIORITY_CONFIG = {
  high: { label: t('notification.priorityHigh'), color: DANGER, bg: '#ef444422' },
  normal: { label: t('notification.priorityNormal'), color: ACCENT, bg: '#3b82f622' },
  low: { label: t('notification.priorityLow'), color: GRAY, bg: 'var(--bg-deep)' },
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  report_completed: <FileText size={20} />,
  critical_value: <AlertTriangle size={20} />,
  followup: <Calendar size={20} />,
  quality: <BarChart3 size={20} />,
  system: <Settings size={20} />,
  appointment: <Calendar size={20} />,
  consultation: <MessageSquare size={20} />,
}

// ============================================================
// 类型定义
// ============================================================
interface SystemNotification {
  id: string
  type: 'report_completed' | 'critical_value' | 'followup' | 'quality' | 'system' | 'appointment' | 'consultation'
  title: string
  content: string
  recipientId: string
  recipientName: string
  status: 'read' | 'unread'
  priority: 'high' | 'normal' | 'low'
  sentAt: string
  readAt?: string
  relatedId?: string
  relatedType?: string
}

interface NotificationSettings {
  reportCompleted: boolean
  criticalValue: boolean
  systemNotify: boolean
  appointment: boolean
  consultation: boolean
  emailNotify: boolean
  smsNotify: boolean
  pushNotify: boolean
}

// ============================================================
// Phase 4b - 新增类型
// ============================================================

interface DeliveryStatus {
  notificationId: string
  sent: boolean
  delivered: boolean
  read: boolean
  sentAt: string | null
  deliveredAt: string | null
  readAt: string | null
  retryCount: number
  channel: 'in-app' | 'sms' | 'email'
}

interface NotificationRule {
  id: string
  name: string
  enabled: boolean
  eventType: 'critical_value' | 'report_ready' | 'schedule_change' | 'appointment' | 'system_alert'
  conditions: Array<{ field: string; operator: string; value: string }>
  actions: Array<{ channel: 'in-app' | 'sms' | 'email'; template: string }>
  priority: 'high' | 'normal' | 'low'
}

interface UserNotifyPreferences {
  quietHoursEnabled: boolean
  quietHoursStart: string
  quietHoursEnd: string
  digestMode: 'none' | 'daily' | 'weekly'
  digestTime: string
  channelPerEvent: Record<string, string[]>
}

// ============================================================
// 辅助函数
// ============================================================
function formatDateTime(dt: string): string {
  if (!dt) return '-'
  const d = new Date(dt)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}



function getRelativeTime(dt: string): string {
  const now = Date.now()
  const d = new Date(dt)
  const diff = now - d.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (minutes < 1) return t('time.justNow')
  if (minutes < 60) return `${minutes}分钟前`
  if (hours < 24) return `${hours}小时前`
  if (days < 7) return `${days}天前`
  return formatTime(dt)
}

// ============================================================
// Phase 4b - 模拟数据（配送状态、规则、偏好）
// ============================================================

function generateDeliveryStatuses(notifications: SystemNotification[]): DeliveryStatus[] {
  return notifications.slice(0, 50).map(n => ({
    notificationId: n.id,
    sent: true,
    delivered: true,
    read: n.status === 'read',
    sentAt: n.sentAt,
    deliveredAt: new Date(new Date(n.sentAt).getTime() + 60000).toISOString(),
    readAt: n.readAt || null,
    retryCount: 0,
    channel: n.priority === 'high' ? 'sms' : 'in-app',
  }))
}

const DEFAULT_RULES: NotificationRule[] = [
  {
    id: 'RULE-001', name: '危急值必达', enabled: true, eventType: 'critical_value', priority: 'high',
    conditions: [{ field: 'severity', operator: 'equals', value: 'critical' }],
    actions: [{ channel: 'in-app', template: '立即通知' }, { channel: 'sms', template: '短信通知' }, { channel: 'email', template: '邮件通知' }],
  },
  {
    id: 'RULE-002', name: '报告完成提醒', enabled: true, eventType: 'report_ready', priority: 'normal',
    conditions: [{ field: 'modality', operator: 'equals', value: 'CT' }],
    actions: [{ channel: 'in-app', template: '应用内通知' }],
  },
  {
    id: 'RULE-003', name: '排班变更通知', enabled: false, eventType: 'schedule_change', priority: 'normal',
    conditions: [{ field: 'changeType', operator: 'equals', value: 'swap' }],
    actions: [{ channel: 'in-app', template: '应用内通知' }, { channel: 'email', template: '邮件通知' }],
  },
]

const DEFAULT_USER_PREFERENCES: UserNotifyPreferences = {
  quietHoursEnabled: true,
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
  digestMode: 'none',
  digestTime: '08:00',
  channelPerEvent: {
    critical_value: ['in-app', 'sms', 'email'],
    report_ready: ['in-app'],
    schedule_change: ['in-app', 'email'],
    appointment: ['in-app', 'email'],
    system_alert: ['in-app'],
  },
}

// ============================================================
// 通知详情弹窗组件
// ============================================================
interface NotificationDetailModalProps {
  notification: SystemNotification | null
  onClose: () => void
  onMarkRead: (id: string) => void
}

function NotificationDetailModal({ notification, onClose, onMarkRead }: NotificationDetailModalProps) {
  // [W1-107] Hook 必须早于提前 return, 否则 notification 由 null 变为有值时 Hook 数量不一致导致崩溃
  const [showJumpModal, setShowJumpModal] = useState(false)

  if (!notification) return null

  const typeConfig = NOTIFICATION_TYPES.find(t => t.key === notification.type) || NOTIFICATION_TYPES[0]!
  const priorityConfig = PRIORITY_CONFIG[notification.priority]

  const handleRelatedAction = () => {
    if (notification.status === 'unread') {
      onMarkRead(notification.id)
    }
    setShowJumpModal(true)
  }
  const handleCloseJumpModal = () => setShowJumpModal(false)

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', zIndex: 1000,
    }} onClick={onClose}>
      <div style={{
        background: 'var(--bg-card)', borderRadius: 12, width: '90%', maxWidth: 600,
        maxHeight: '80vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }} onClick={e => e.stopPropagation()}>
        {/* 头部 */}
        <div style={{
          background: typeConfig.color, padding: '16px 20px', borderRadius: '12px 12px 0 0',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ color: WHITE, fontSize: 18, fontWeight: 700 }}>{typeConfig.icon}</div>
            <div>
              <div style={{ color: WHITE, fontSize: 16, fontWeight: 600 }}>{notification.title}</div>
              <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>
                {notification.recipientName} · {formatDateTime(notification.sentAt)}
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 6,
            padding: '6px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center',
          }}>
            <X size={18} color={WHITE} />
          </button>
        </div>

        {/* 内容 */}
        <div style={{ padding: 'var(--space-5, 20px)' }}>
          {/* 标签 */}
          <div style={{ display: 'flex', gap: 'var(--space-2, 8px)', marginBottom: 'var(--space-4, 16px)' }}>
            <span style={{
              background: `${typeConfig.color}20`, color: typeConfig.color,
              padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
            }}>
              {typeConfig.label}
            </span>
            {/* [v3.0.6.11-99] Wave 5B-C: 报表订阅推送 */}
            {notification.title.includes('报表已生成') && (
              <span style={{
                background: '#05966920', color: '#059669',
                padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
              }}>
                {t('notification.reportGenerated')}
              </span>
            )}
            <span style={{
              background: priorityConfig.bg, color: priorityConfig.color,
              padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
            }}>
              {priorityConfig.label}
            </span>
            {notification.status === 'unread' && (
              <span style={{
                background: DANGER, color: WHITE,
                padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
              }}>
                {t('notification.unread')}
              </span>
            )}
          </div>

          {/* 内容 */}
          <div style={{
            background: 'var(--content-bg)', padding: 'var(--space-4, 16px)', borderRadius: 10,
            border: '1px solid var(--border-color)', marginBottom: 'var(--space-4, 16px)',
          }}>
            <pre style={{
              margin: 0, fontSize: 14, color: 'var(--text-secondary)',
              lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              fontFamily: 'inherit',
            }}>
              {notification.content}
            </pre>
          </div>

          {/* 元信息 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-3, 12px)', marginBottom: 'var(--space-4, 16px)' }}>
            <div style={{ background: 'var(--content-bg)', padding: 10, borderRadius: 8, border: '1px solid var(--border-color)' }}>
              <div style={{ color: GRAY, fontSize: 12, marginBottom: 2 }}>{t('notification.id')}</div>
              <div style={{ color: PRIMARY, fontSize: 12, fontWeight: 600 }}>{notification.id}</div>
            </div>
            <div style={{ background: 'var(--content-bg)', padding: 10, borderRadius: 8, border: '1px solid var(--border-color)' }}>
              <div style={{ color: GRAY, fontSize: 12, marginBottom: 2 }}>{t('notification.recipient')}</div>
              <div style={{ color: PRIMARY, fontSize: 12, fontWeight: 600 }}>{notification.recipientName}</div>
            </div>
            <div style={{ background: 'var(--content-bg)', padding: 10, borderRadius: 8, border: '1px solid var(--border-color)' }}>
              <div style={{ color: GRAY, fontSize: 12, marginBottom: 2 }}>{t('notification.sentTime')}</div>
              <div style={{ color: PRIMARY, fontSize: 12, fontWeight: 600 }}>{formatDateTime(notification.sentAt)}</div>
            </div>
            {notification.readAt && (
              <div style={{ background: 'var(--content-bg)', padding: 10, borderRadius: 8, border: '1px solid var(--border-color)' }}>
                <div style={{ color: GRAY, fontSize: 12, marginBottom: 2 }}>{t('notification.readTime')}</div>
                <div style={{ color: PRIMARY, fontSize: 12, fontWeight: 600 }}>{formatDateTime(notification.readAt)}</div>
              </div>
            )}
          </div>

          {/* 相关操作 */}
          {notification.relatedId && (
            <div style={{
              background: `${ACCENT}10`, padding: 'var(--space-3, 12px)', borderRadius: 8,
              border: `1px solid ${ACCENT}30`, marginBottom: 'var(--space-4, 16px)',
            }}>
              <div style={{ fontSize: 12, color: GRAY, marginBottom: 6 }}>{t('notification.relatedInfo')}</div>
              <div style={{ fontSize: 12, color: PRIMARY, marginBottom: 'var(--space-2, 8px)' }}>
                类型: {notification.relatedType} | ID: {notification.relatedId}
              </div>
              <button
                onClick={handleRelatedAction}
                style={{
                  padding: '6px 14px', borderRadius: 6, border: 'none',
                  background: ACCENT, color: WHITE, fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <Eye size={14} />
                {t('notification.viewDetail')}
              </button>
            </div>
          )}
        </div>

        {/* 底部 */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between' }}>
          <button
            onClick={() => {
              onMarkRead(notification.id)
              onClose()
            }}
            style={{
              padding: '8px 16px', borderRadius: 6, border: '1px solid var(--border-color)',
              background: 'var(--bg-card)', color: GRAY, fontSize: 12, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <CheckCheck size={14} />
            {t('notification.markRead')}
          </button>
          <button onClick={onClose} style={{
            padding: '8px 20px', borderRadius: 6, border: 'none',
            background: PRIMARY, color: WHITE, fontSize: 12, cursor: 'pointer',
          }}>
            {t('notification.close')}
          </button>
        </div>
      </div>
      {showJumpModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 10000,
        }} onClick={handleCloseJumpModal}>
          <div style={{
            background: 'var(--bg-card)', borderRadius: 12, width: '90%', maxWidth: 400,
            padding: 'var(--space-6, 24px)', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', textAlign: 'center',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-primary-800)', marginBottom: 'var(--space-2, 8px)' }}>
              跳转到{notification.relatedType}详情
            </div>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 'var(--space-4, 16px)' }}>
              ID: {notification.relatedId}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('notification.jumpHint')}</div>
            <button onClick={handleCloseJumpModal} style={{
              marginTop: 'var(--space-5, 20px)', padding: '10px 24px', background: 'var(--color-primary-800)', color: '#fff',
              border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14,
            }}>{t('notification.confirm')}</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// 通知卡片组件
// ============================================================
interface NotificationCardProps {
  notification: SystemNotification
  onView: () => void
  onMarkRead: () => void
  onDelete: () => void
  isSelected: boolean
}

function NotificationCard({ notification, onView, onMarkRead, onDelete, isSelected }: NotificationCardProps) {
  const typeConfig = NOTIFICATION_TYPES.find(t => t.key === notification.type) || NOTIFICATION_TYPES[0]!
    const isUnread = notification.status === 'unread'

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onView}
      onKeyDown={e => { if (e.target !== e.currentTarget) return; if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onView() } }}
      style={{
        background: isSelected ? 'var(--color-info-bg)' : isUnread ? 'var(--bg-primary)' : 'var(--bg-card)',
        border: `1px solid ${isSelected ? ACCENT : isUnread ? '#bfdbfe' : 'var(--border-default, rgba(0,0,0,0.12))'}`,
        borderLeft: `4px solid ${typeConfig.color}`,
        borderRadius: 10, padding: 14, cursor: 'pointer',
        transition: 'all 0.15s', position: 'relative',
        boxShadow: isUnread ? '0 1px 3px rgba(0,0,0,0.05)' : 'none',
      }}
      onMouseEnter={e => {
        if (!isSelected) {
          e.currentTarget.style.borderColor = typeConfig.color + '60'
          e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)'
        }
      }}
      onMouseLeave={e => {
        if (!isSelected) {
          e.currentTarget.style.borderColor = isUnread ? '#bfdbfe' : 'var(--border-default, rgba(0,0,0,0.12))'
          e.currentTarget.style.boxShadow = isUnread ? '0 1px 3px rgba(0,0,0,0.05)' : 'none'
        }
      }}
    >
      {/* 未读标记 */}
      {isUnread && (
        <div style={{
          position: 'absolute', top: 14, right: 14,
          width: 8, height: 8, borderRadius: '50%', background: DANGER,
        }} />
      )}

      {/* 头部 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-2, 8px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: `${typeConfig.color}20`, color: typeConfig.color,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {TYPE_ICONS[notification.type]}
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: isUnread ? 700 : 600, color: PRIMARY }}>
              {notification.title}
            </div>
            <div style={{ fontSize: 12, color: GRAY, marginTop: 2 }}>
              {notification.recipientName}
            </div>
          </div>
        </div>
        <div style={{ fontSize: 12, color: GRAY }}>{getRelativeTime(notification.sentAt)}</div>
      </div>

      {/* 内容摘要 */}
      <div style={{
        fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5,
        overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box',
        WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', marginBottom: 10,
      }}>
        {notification.content}
      </div>

      {/* 标签 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <span style={{
            background: `${typeConfig.color}15`, color: typeConfig.color,
            padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 500,
          }}>
            {typeConfig.label}
          </span>
          {/* [v3.0.6.11-99] Wave 5B-C: 报表订阅推送 — 「报表已生成」通知类型 */}
          {notification.title.includes('报表已生成') && (
            <span style={{
              background: '#05966920', color: '#059669',
              padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600,
            }}>
              {t('notification.reportGenerated')}
            </span>
          )}
          {notification.priority === 'high' && (
            <span style={{
              background: DANGER, color: WHITE,
              padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600,
            }}>
              {t('notification.priorityHigh')}
            </span>
          )}
        </div>

        {/* 操作按钮 */}
        <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
          {isUnread && (
            <button
              onClick={onMarkRead}
              style={{
                padding: '4px 8px', borderRadius: 4, border: '1px solid var(--border-color)',
                background: 'var(--bg-card)', color: ACCENT, fontSize: 12, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)',
              }}
              title={t('notification.markRead')}
            >
              <Check size={14} />
            </button>
          )}
          <button
            onClick={onDelete}
            style={{
              padding: '4px 8px', borderRadius: 4, border: '1px solid #fee2e2',
              background: 'var(--bg-card)', color: DANGER, fontSize: 12, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)',
            }}
            title={t('notification.delete')}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// 通知设置面板组件
// ============================================================
interface SettingsPanelProps {
  settings: NotificationSettings
  onUpdate: (key: keyof NotificationSettings, value: boolean) => void
}

function SettingsPanel({ settings, onUpdate }: SettingsPanelProps) {
  const ToggleSwitch = ({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) => (
    <Switch size="small" checked={checked} onChange={onChange} />
  )

  const SectionTitle = ({ children }: { children: React.ReactNode }) => (
    <div style={{
      fontSize: 12, fontWeight: 700, color: PRIMARY, marginBottom: 'var(--space-3, 12px)',
      paddingBottom: 'var(--space-2, 8px)', borderBottom: '1px solid var(--border-color)',
    }}>
      {children}
    </div>
  )

  const SettingRow = ({ label, checked, onChange, icon }: { label: string; checked: boolean; onChange: (v: boolean) => void; icon: React.ReactNode }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ color: GRAY }}>{icon}</div>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</span>
      </div>
      <ToggleSwitch checked={checked} onChange={onChange} />
    </div>
  )

  return (
    <div style={{
      background: 'var(--bg-card)', borderRadius: 10, border: '1px solid var(--border-color)',
      padding: 'var(--space-4, 16px)',
    }}>
      <div style={{ fontWeight: 700, color: PRIMARY, marginBottom: 'var(--space-4, 16px)', fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Settings size={16} />
        {t('notification.settings')}
      </div>

      <SectionTitle>{t('notification.settingsTypes')}</SectionTitle>
      <SettingRow
        label={t('notification.settingReport')}
        checked={settings.reportCompleted}
        onChange={v => onUpdate('reportCompleted', v)}
        icon={<FileText size={16} />}
      />
      <SettingRow
        label={t('notification.settingCritical')}
        checked={settings.criticalValue}
        onChange={v => onUpdate('criticalValue', v)}
        icon={<AlertTriangle size={16} />}
      />
      <SettingRow
        label={t('notification.settingSystem')}
        checked={settings.systemNotify}
        onChange={v => onUpdate('systemNotify', v)}
        icon={<Settings size={16} />}
      />
      <SettingRow
        label={t('notification.settingAppointment')}
        checked={settings.appointment}
        onChange={v => onUpdate('appointment', v)}
        icon={<Calendar size={16} />}
      />
      <SettingRow
        label={t('notification.settingConsultation')}
        checked={settings.consultation}
        onChange={v => onUpdate('consultation', v)}
        icon={<MessageSquare size={16} />}
      />

      <SectionTitle>{t('notification.settingsChannels')}</SectionTitle>
      <SettingRow
        label={t('notification.settingEmail')}
        checked={settings.emailNotify}
        onChange={v => onUpdate('emailNotify', v)}
        icon={<Mail size={16} />}
      />
      <SettingRow
        label={t('notification.settingSms')}
        checked={settings.smsNotify}
        onChange={v => onUpdate('smsNotify', v)}
        icon={<Smartphone size={16} />}
      />
      <SettingRow
        label={t('notification.settingPush')}
        checked={settings.pushNotify}
        onChange={v => onUpdate('pushNotify', v)}
        icon={<BellRing size={16} />}
      />

      <div style={{ marginTop: 'var(--space-4, 16px)', padding: 'var(--space-3, 12px)', background: 'var(--color-warning-bg)', borderRadius: 8, border: '1px solid #fcd34d' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2, 8px)' }}>
          <AlertCircle size={16} color={WARNING} style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: 12, color: '#92400e', lineHeight: 1.5 }}>
            {t('notification.settingsTip')}
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// 通知统计面板组件
// ============================================================
interface StatsPanelProps {
  notifications: SystemNotification[]
  apiStats?: { total: number; unread: number; today: number; critical: number } | null
}

function StatsPanel({ notifications, apiStats }: StatsPanelProps) {
  // 统计卡 (优先后端 stats 端点: 未读/今日/总数)
  const todayStats = useMemo(() => {
    if (apiStats) {
      return {
        total: apiStats.total,
        today: apiStats.today,
        unread: apiStats.unread,
        critical: apiStats.critical,
      }
    }
    const today = new Date().toISOString().slice(0, 10)
    const todayNotifs = notifications.filter(n => n.sentAt.startsWith(today))
    return {
      total: notifications.length,
      today: todayNotifs.length,
      unread: notifications.filter(n => n.status === 'unread').length,
      critical: notifications.filter(n => n.type === 'critical_value' && n.status === 'unread').length,
    }
  }, [notifications, apiStats])

  // [v3.0.6.11-99 Wave10B] 本周趋势 (按真实通知 sentAt 聚合, 无数据回退静态)
  const weekTrend = useMemo(() => {
    const byDay: Record<string, { count: number; unread: number }> = {}
    const now = new Date()
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      byDay[key] = { count: 0, unread: 0 }
    }
    notifications.forEach(n => {
      const day = String(n.sentAt || '').slice(0, 10)
      if (!byDay[day]) return
      byDay[day]!.count += 1
      if (n.status === 'unread') byDay[day]!.unread += 1
    })
    const labels = [t('notification.weekMon'), t('notification.weekTue'), t('notification.weekWed'), t('notification.weekThu'), t('notification.weekFri'), t('notification.weekSat'), t('notification.weekSun')]
    const rows = Object.entries(byDay).map(([day, v], i) => ({
      day: labels[i % 7] ?? day.slice(5),
      count: v.count,
      unread: v.unread,
    }))
    return rows
  }, [notifications])

  // [v3.0.6.11-99 Wave10B] 7 日合计 / 日均 (统计趋势增强)
  const weekSummary = useMemo(() => {
    const total = weekTrend.reduce((s, d) => s + d.count, 0)
    const unread = weekTrend.reduce((s, d) => s + d.unread, 0)
    return { total, unread, avg: Math.round(total / Math.max(1, weekTrend.length)) }
  }, [weekTrend])

  // 类型分布
  const typeDistribution = NOTIFICATION_TYPES.filter(t => t.key !== 'all').map(type => ({
    ...type,
    count: notifications.filter(n => n.type === type.key).length,
    unread: notifications.filter(n => n.type === type.key && n.status === 'unread').length,
  }))

  const maxCount = Math.max(...typeDistribution.map(t => t.count), 1)

  return (
    <div style={{
      background: 'var(--bg-card)', borderRadius: 10, border: '1px solid var(--border-color)',
      padding: 'var(--space-4, 16px)', marginBottom: 'var(--space-4, 16px)',
    }}>
      <div style={{ fontWeight: 700, color: PRIMARY, marginBottom: 'var(--space-4, 16px)', fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
        <BarChart3 size={16} />
        {t('notification.stats')}
      </div>

      {/* 今日概览 */}
      <div style={{ marginBottom: 'var(--space-5, 20px)' }}>
        <div style={{ fontSize: 12, color: GRAY, marginBottom: 'var(--space-2, 8px)' }}>{t('notification.todayOverview')}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          <div style={{ background: 'var(--content-bg)', padding: 'var(--space-3, 12px)', borderRadius: 8, textAlign: 'center', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: PRIMARY }}>{todayStats.total}</div>
            <div style={{ fontSize: 12, color: GRAY }}>{t('notification.todayTotal')}</div>
          </div>
          <div style={{ background: 'var(--content-bg)', padding: 'var(--space-3, 12px)', borderRadius: 8, textAlign: 'center', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: SUCCESS }}>{todayStats.total - todayStats.unread}</div>
            <div style={{ fontSize: 12, color: GRAY }}>{t('notification.read')}</div>
          </div>
          <div style={{ background: 'var(--content-bg)', padding: 'var(--space-3, 12px)', borderRadius: 8, textAlign: 'center', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: DANGER }}>{todayStats.unread}</div>
            <div style={{ fontSize: 12, color: GRAY }}>{t('notification.unread')}</div>
          </div>
          <div style={{ background: 'var(--color-error-bg)', padding: 'var(--space-3, 12px)', borderRadius: 8, textAlign: 'center', border: '1px solid #fecaca' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: DANGER }}>{todayStats.critical}</div>
            <div style={{ fontSize: 12, color: GRAY }}>{t('notification.typeCritical')}</div>
          </div>
        </div>
      </div>

      {/* 本周趋势 */}
      <div style={{ marginBottom: 'var(--space-5, 20px)' }}>
        <div style={{ fontSize: 12, color: GRAY, marginBottom: 'var(--space-2, 8px)', display: 'flex', justifyContent: 'space-between' }}>
          <span>近 7 日趋势 (今日 {todayStats.today} 条 · 7 日共 {weekSummary.total} 条 · 日均 {weekSummary.avg})</span>
          <span style={{ color: DANGER }}>{weekSummary.unread} 条未读</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 80 }}>
          {weekTrend.map((day, i) => {
            const maxCount = Math.max(...weekTrend.map(d => d.count), 1)
            const todayIdx = weekTrend.length - 1
            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-1, 4px)' }}>
                <div style={{
                  width: '100%', background: i === todayIdx ? ACCENT : 'var(--border-default, rgba(0,0,0,0.12))',
                  borderRadius: 4, height: `${(day.count / maxCount) * 62}px`,
                  transition: 'height 0.3s', position: 'relative',
                }} title={`${day.day}: ${day.count} 条 (${day.unread} 未读)`}>
                  {day.unread > 0 && (
                    <div style={{
                      position: 'absolute', top: -3, right: -3, width: 6, height: 6,
                      borderRadius: '50%', background: DANGER,
                    }} />
                  )}
                </div>
                <span style={{ fontSize: 12, color: GRAY }}>{day.day}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* 类型分布 */}
      <div>
        <div style={{ fontSize: 12, color: GRAY, marginBottom: 'var(--space-2, 8px)' }}>{t('notification.typeDistribution')}</div>
        {typeDistribution.map(type => (
          <div key={type.key} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-1, 4px)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: type.color }}>{type.icon}</span>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{type.label}</span>
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-2, 8px)' }}>
                {type.unread > 0 && (
                  <span style={{ fontSize: 12, color: DANGER, fontWeight: 600 }}>{type.unread}未读</span>
                )}
                <span style={{ fontSize: 12, color: GRAY }}>{type.count}条</span>
              </div>
            </div>
            <div style={{ background: 'var(--content-bg)', height: 6, borderRadius: 3, overflow: 'hidden' }}>
              <div style={{
                width: `${(type.count / maxCount) * 100}%`,
                height: '100%',
                background: type.color,
                borderRadius: 3,
                transition: 'width 0.3s',
              }} />
            </div>
          </div>
        ))}
      </div>

      {/* [v3.0.6.11-99 Wave10B] 类型环形占比 + 阅读率 */}
      <div style={{ marginTop: 'var(--space-5, 20px)', paddingTop: 'var(--space-4, 16px)', borderTop: '1px solid var(--border-color)' }}>
        <div style={{ fontSize: 12, color: GRAY, marginBottom: 10 }}>{t('notification.ratioRead')}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div style={{ position: 'relative', width: 104, height: 104, flexShrink: 0 }}>
            <svg viewBox="0 0 100 100" width={104} height={104}>
              {(() => {
                const total = Math.max(1, notifications.length)
                const colors = ['var(--color-primary-500)', 'var(--color-error-600)', '#8b5cf6', '#10b981', '#64748b', '#059669', '#7c3aed']
                let acc = 0
                const R = 40
                const C = 2 * Math.PI * R
                return typeDistribution.filter(t => t.count > 0).map((t, i) => {
                  const frac = t.count / total
                  const dash = frac * C
                  const offset = -acc * C
                  acc += frac
                  return (
                    <circle
                      key={t.key}
                      cx="50" cy="50" r={R}
                      fill="none"
                      stroke={colors[i % colors.length]}
                      strokeWidth="10"
                      strokeDasharray={`${dash} ${C - dash}`}
                      strokeDashoffset={offset}
                      transform="rotate(-90 50 50)"
                    >
                      <title>{`${t.label}: ${t.count} 条`}</title>
                    </circle>
                  )
                })
              })()}
              <text x="50" y="47" textAnchor="middle" fontSize="14" fontWeight="700" fill={PRIMARY}>
                {notifications.length}
              </text>
              <text x="50" y="60" textAnchor="middle" fontSize="7" fill="#94a3b8">{t('notification.allNotifications')}</text>
            </svg>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--space-2, 8px)' }}>
            {typeDistribution.filter(t => t.count > 0).slice(0, 6).map((t, i) => {
              const colors = ['var(--color-primary-500)', 'var(--color-error-600)', '#8b5cf6', '#10b981', '#64748b', '#059669']
              const pct = notifications.length > 0 ? Math.round((t.count / notifications.length) * 1000) / 10 : 0
              return (
                <div key={t.key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: colors[i % colors.length], flexShrink: 0 }} />
                  <span style={{ color: 'var(--text-secondary)', flex: 1 }}>{t.label}</span>
                  <span style={{ color: GRAY }}>{pct}%</span>
                </div>
              )
            })}
          </div>
        </div>
        {/* 阅读率 */}
        <div style={{ marginTop: 'var(--space-3, 12px)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: GRAY, marginBottom: 'var(--space-1, 4px)' }}>
            <span>已读 {todayStats.total - todayStats.unread} / 未读 {todayStats.unread}</span>
            <span style={{ color: SUCCESS, fontWeight: 600 }}>
              阅读率 {todayStats.total > 0 ? Math.round(((todayStats.total - todayStats.unread) / todayStats.total) * 100) : 100}%
            </span>
          </div>
          <div style={{ background: 'var(--content-bg)', height: 8, borderRadius: 4, overflow: 'hidden', display: 'flex' }}>
            <div style={{
              width: `${todayStats.total > 0 ? ((todayStats.total - todayStats.unread) / todayStats.total) * 100 : 100}%`,
              height: '100%', background: SUCCESS,
            }} />
            <div style={{
              width: `${todayStats.total > 0 ? (todayStats.unread / todayStats.total) * 100 : 0}%`,
              height: '100%', background: DANGER,
            }} />
          </div>
          <div style={{ display: 'flex', gap: 14, marginTop: 'var(--space-1, 4px)', fontSize: 10, color: GRAY }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1, 4px)' }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: SUCCESS }} /> {t('notification.read')}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1, 4px)' }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: DANGER }} /> {t('notification.unread')}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// 通知历史记录组件
// ============================================================
interface HistoryPanelProps {
  notifications: SystemNotification[]
  onViewNotification: (n: SystemNotification) => void
}

function HistoryPanel({ notifications, onViewNotification }: HistoryPanelProps) {
  // 按小时分组
  const hourGroups = useMemo(() => {
    const groups: Record<string, SystemNotification[]> = {}
    notifications.slice(0, 50).forEach(n => {
      const hour = new Date(n.sentAt).getHours()
      const key = `${String(hour).padStart(2, '0')}:00`
      if (!groups[key]) groups[key] = []
      groups[key].push(n)
    })
    return Object.entries(groups).sort(([a], [b]) => Number(b.split(':')[0]) - Number(a.split(':')[0]))
  }, [notifications])

  return (
    <div style={{
      background: 'var(--bg-card)', borderRadius: 10, border: '1px solid var(--border-color)',
      padding: 'var(--space-4, 16px)',
    }}>
      <div style={{ fontWeight: 700, color: PRIMARY, marginBottom: 'var(--space-3, 12px)', fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Clock size={16} />
        {t('notification.latestActivity')}
      </div>
      {hourGroups.slice(0, 6).map(([hour, hourNotifs]) => (
        <div key={hour} style={{ marginBottom: 'var(--space-3, 12px)' }}>
          <div style={{ fontSize: 12, color: GRAY, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Clock size={10} />
            {hour} ({hourNotifs.length}条)
          </div>
          {hourNotifs.slice(0, 3).map(n => {
            const typeConfig = NOTIFICATION_TYPES.find(t => t.key === n.type) || NOTIFICATION_TYPES[0]!
            return (
              <div
                key={n.id}
                role="button"
                tabIndex={0}
                onClick={() => onViewNotification(n)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onViewNotification(n) } }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)', padding: '6px 8px',
                  background: 'var(--content-bg)', borderRadius: 6, marginBottom: 'var(--space-1, 4px)', cursor: 'pointer',
                  border: '1px solid transparent',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = typeConfig.color + '40'
                  e.currentTarget.style.background = typeConfig.color + '08'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'transparent'
                  e.currentTarget.style.background = 'var(--bg-hover)'
                }}
              >
                <span style={{ color: typeConfig.color }}>{typeConfig.icon}</span>
                <span style={{ flex: 1, fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {n.title}
                </span>
                {n.status === 'unread' && (
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: DANGER, flexShrink: 0 }} />
                )}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

// ============================================================
// Phase 4b - 配送状态组件
// ============================================================
function DeliveryStatusBadge({ delivery }: { delivery: DeliveryStatus }) {
  const getStatus = () => {
    if (!delivery.sent) return { label: t('notification.sending'), color: 'var(--text-secondary)', bg: 'var(--bg-deep)' }
    if (!delivery.delivered) return { label: t('notification.sendFailed'), color: 'var(--color-error-500)', bg: '#ef444422' }
    if (delivery.read) return { label: t('notification.readDone'), color: '#059669', bg: '#22c55e22' }
    return { label: t('notification.delivered'), color: 'var(--color-primary-500)', bg: '#3b82f622' }
  }
  const s = getStatus()
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
      <span style={{ padding: '2px 8px', borderRadius: 4, background: s.bg, color: s.color, fontWeight: 500 }}>{s.label}</span>
      {delivery.retryCount > 0 && <span style={{ color: 'var(--color-warning-600)' }}>重试{delivery.retryCount}次</span>}
      <span style={{ color: 'var(--text-secondary)' }}>{delivery.channel === 'in-app' ? t('notification.channelInApp') : delivery.channel === 'sms' ? t('notification.channelSms') : t('notification.channelEmail')}</span>
    </div>
  )
}

// ============================================================
// Phase 4b - 规则引擎面板
// ============================================================
function RulesEnginePanel({ rules, onToggle, onDelete }: { rules: NotificationRule[]; onToggle: (id: string) => void; onDelete: (id: string) => void }) {
  const EVENT_LABELS: Record<string, string> = { critical_value: t('notification.typeCritical'), report_ready: t('notification.eventReport'), schedule_change: t('notification.eventSchedule'), appointment: t('notification.typeAppointment'), system_alert: t('notification.eventSystemAlert') }
  return (
    <div style={{ background: 'var(--bg-card)', borderRadius: 10, border: '1px solid var(--border-color)', padding: 'var(--space-4, 16px)', marginBottom: 'var(--space-4, 16px)' }}>
      <div style={{ fontWeight: 700, color: PRIMARY, marginBottom: 'var(--space-4, 16px)', fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Zap size={16} />
        {t('notification.ruleEngine')}
      </div>
      {rules.map(rule => (
        <div key={rule.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>{rule.name}</span>
              <span style={{ padding: '1px 6px', borderRadius: 4, fontSize: 12, background: rule.priority === 'high' ? 'var(--color-error-bg)' : 'var(--bg-card)', color: rule.priority === 'high' ? 'var(--color-error-600)' : 'var(--text-secondary, #475569)' }}>
                {rule.priority === 'high' ? t('notification.priorityHighLabel') : t('notification.priorityNormal')}
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 'var(--space-1, 4px)' }}>
              事件: {EVENT_LABELS[rule.eventType] || rule.eventType} · 渠道: {rule.actions.map(a => a.channel === 'in-app' ? '应用内' : a.channel === 'sms' ? '短信' : '邮件').join(', ')}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)' }}>
            <Switch size="small" checked={rule.enabled} onChange={() => onToggle(rule.id)} />
            <button onClick={() => onDelete(rule.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><Trash2 size={14} /></button>
          </div>
        </div>
      ))}
      <div style={{ marginTop: 'var(--space-3, 12px)', padding: 'var(--space-3, 12px)', background: 'var(--content-bg)', borderRadius: 6, fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center' }}>
        {t('notification.ruleEngineHint')}
      </div>
    </div>
  )
}

// ============================================================
// Phase 4b - 用户偏好设置
// ============================================================
function PreferencesPanel({ preferences, onUpdate }: { preferences: UserNotifyPreferences; onUpdate: (p: UserNotifyPreferences) => void }) {
  return (
    <div style={{ background: 'var(--bg-card)', borderRadius: 10, border: '1px solid var(--border-color)', padding: 'var(--space-4, 16px)' }}>
      <div style={{ fontWeight: 700, color: PRIMARY, marginBottom: 'var(--space-4, 16px)', fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Settings size={16} />
        {t('notification.preferences')}
      </div>
      {/* 免打扰 */}
      <div style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 'var(--space-2, 8px)', fontWeight: 600 }}>{t('notification.quietHours')}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)', marginBottom: 'var(--space-2, 8px)' }}>
          <div
            role="button"
            tabIndex={0}
            aria-label={t('notification.enableQuietHours')}
            onClick={() => onUpdate({ ...preferences, quietHoursEnabled: !preferences.quietHoursEnabled })}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onUpdate({ ...preferences, quietHoursEnabled: !preferences.quietHoursEnabled }) } }}
            style={{ width: 36, height: 20, borderRadius: 10, background: preferences.quietHoursEnabled ? ACCENT : 'var(--border-default, rgba(0,0,0,0.12))', position: 'relative', cursor: 'pointer' }}>
            <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'var(--bg-card)', position: 'absolute', top: 2, left: preferences.quietHoursEnabled ? 18 : 2, boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('notification.enableQuietHours')}</span>
        </div>
        {preferences.quietHoursEnabled && (
          <div style={{ display: 'flex', gap: 'var(--space-2, 8px)', alignItems: 'center' }}>
            <input type="time" value={preferences.quietHoursStart} onChange={e => onUpdate({ ...preferences, quietHoursStart: e.target.value })}
              style={{ padding: '4px 8px', border: '1px solid var(--border-color)', borderRadius: 4, fontSize: 12 }} />
            <span style={{ color: 'var(--text-secondary)' }}>{t('notification.to')}</span>
            <input type="time" value={preferences.quietHoursEnd} onChange={e => onUpdate({ ...preferences, quietHoursEnd: e.target.value })}
              style={{ padding: '4px 8px', border: '1px solid var(--border-color)', borderRadius: 4, fontSize: 12 }} />
          </div>
        )}
      </div>
      {/* 摘要模式 */}
      <div style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 'var(--space-2, 8px)', fontWeight: 600 }}>{t('notification.digestMode')}</div>
        <select value={preferences.digestMode} onChange={e => onUpdate({ ...preferences, digestMode: e.target.value as any })}
          style={{ width: '100%', padding: '6px 10px', border: '1px solid var(--border-color)', borderRadius: 4, fontSize: 12 }}>
          <option value="none">{t('notification.digestOff')}</option>
          <option value="daily">{t('notification.digestDaily')}</option>
          <option value="weekly">{t('notification.digestWeekly')}</option>
        </select>
        {preferences.digestMode !== 'none' && (
          <div style={{ marginTop: 'var(--space-2, 8px)' }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('notification.sendTime')}</span>
            <input type="time" value={preferences.digestTime} onChange={e => onUpdate({ ...preferences, digestTime: e.target.value })}
              style={{ padding: '4px 8px', border: '1px solid var(--border-color)', borderRadius: 4, fontSize: 12 }} />
          </div>
        )}
      </div>
      <div style={{ padding: 'var(--space-2, 8px)', background: 'var(--color-warning-bg)', borderRadius: 6, border: '1px solid #fcd34d', fontSize: 12, color: '#92400e' }}>
        {t('notification.autoSaveHint')}
      </div>
    </div>
  )
}

// ============================================================
// [v3.0.6.11-99 Wave7B] 站内信/推送订阅管理
// 订阅类型开关: 危急值/报告完成/随访提醒/质控通知/系统公告
// 后端 GET/PUT /notifications/subscriptions/:userId, 失败回退 localStorage
// ============================================================
const SUBSCRIPTION_DEFS: Array<{ key: NotificationSubscriptionType; label: string; desc: string; icon: React.ReactNode }> = [
  { key: 'CRITICAL', label: t('notification.settingCritical'), desc: t('notification.subCriticalDesc'), icon: <AlertTriangle size={16} /> },
  { key: 'REPORT', label: t('notification.eventReport'), desc: t('notification.subReportDesc'), icon: <FileText size={16} /> },
  { key: 'FOLLOWUP', label: t('notification.subFollowup'), desc: t('notification.subFollowupDesc'), icon: <Calendar size={16} /> },
  { key: 'QUALITY', label: t('notification.subQuality'), desc: t('notification.subQualityDesc'), icon: <BarChart3 size={16} /> },
  { key: 'SYSTEM', label: t('notification.subSystem'), desc: t('notification.subSystemDesc'), icon: <Settings size={16} /> },
]

const DEFAULT_SUBSCRIPTION_TYPES: NotificationSubscriptionType[] = ['CRITICAL', 'REPORT', 'FOLLOWUP', 'QUALITY', 'SYSTEM']

const SUBSCRIPTION_STORAGE_KEY = 'notify-subscription-types'

function loadLocalSubscriptions(): NotificationSubscriptionType[] {
  try {
    const raw = localStorage.getItem(SUBSCRIPTION_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as string[]
      if (Array.isArray(parsed) && parsed.length > 0) {
        const allowed = new Set(DEFAULT_SUBSCRIPTION_TYPES)
        const valid = parsed.filter((t): t is NotificationSubscriptionType => allowed.has(t as NotificationSubscriptionType))
        if (valid.length > 0) return valid
      }
    }
  } catch { /* ignore */ }
  return [...DEFAULT_SUBSCRIPTION_TYPES]
}

function SubscriptionPanel({
  types,
  onToggle,
  saving,
}: {
  types: NotificationSubscriptionType[]
  onToggle: (t: NotificationSubscriptionType) => void
  saving?: boolean
}) {
  return (
    <div style={{
      background: 'var(--bg-card)', borderRadius: 10, border: '1px solid var(--border-color)',
      padding: 'var(--space-4, 16px)', marginTop: 'var(--space-3, 12px)',
    }}>
      <div style={{ fontWeight: 700, color: PRIMARY, marginBottom: 'var(--space-4, 16px)', fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
        <BellRing size={16} />
        {t('notification.subscriptions')}
        {saving && <span style={{ fontSize: 11, color: GRAY, fontWeight: 400 }}>{t('notification.saving')}</span>}
      </div>
      <div style={{ fontSize: 12, color: GRAY, marginBottom: 'var(--space-3, 12px)' }}>{t('notification.subscriptionHint')}</div>
      {SUBSCRIPTION_DEFS.map(def => {
        const checked = types.includes(def.key)
        return (
          <div key={def.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ color: checked ? def.key === 'CRITICAL' ? DANGER : ACCENT : GRAY }}>{def.icon}</div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{def.label}</div>
                <div style={{ fontSize: 11, color: GRAY }}>{def.desc}</div>
              </div>
            </div>
            <div
              role="button"
              tabIndex={0}
              aria-label={def.label}
              onClick={() => onToggle(def.key)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(def.key) } }}
              style={{
                width: 40, height: 22, borderRadius: 11, cursor: 'pointer',
                background: checked ? (def.key === 'CRITICAL' ? DANGER : ACCENT) : 'var(--border-default, rgba(0,0,0,0.12))', position: 'relative',
                transition: 'background 0.2s', flexShrink: 0,
              }}
            >
              <div style={{
                width: 18, height: 18, borderRadius: '50%', background: 'var(--bg-card)',
                position: 'absolute', top: 2, transition: 'left 0.2s',
                left: checked ? 20 : 2, boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }} />
            </div>
          </div>
        )
      })}
      <div style={{ marginTop: 'var(--space-3, 12px)', padding: 'var(--space-2, 8px)', background: 'var(--content-bg)', borderRadius: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
        {t('notification.subscriptionSyncHint')}
      </div>
    </div>
  )
}

// ============================================================
// 后端类型映射
// ============================================================
function mapNotificationType(type: string): SystemNotification['type'] {
  switch (type) {
    case 'REPORT': return 'report_completed'
    case 'CRITICAL': return 'critical_value'
    // [v3.0.6.11-99 Wave10B] 后端订阅类型 FOLLOWUP / QUALITY → 页面筛选类型
    case 'FOLLOWUP': return 'followup'
    case 'QUALITY': return 'quality'
    case 'SYSTEM': return 'system'
    case 'APPOINTMENT': return 'appointment'
    case 'TASK': return 'consultation'
    default: return 'system'
  }
}

function mapSeverityToPriority(severity?: string): 'high' | 'normal' | 'low' {
  switch (severity) {
    case 'CRITICAL':
    case 'ERROR': return 'high'
    case 'WARN': return 'normal'
    default: return 'low'
  }
}

// Web Push: base64url → Uint8Array (applicationServerKey)
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

// ============================================================
// 主页面组件
// ============================================================
export default function NotificationCenter() {
  const currentUser = useMemo(() => getCurrentUser(), [])
  const userId = currentUser?.id ?? 'current'
  const isAdmin = useMemo(() => {
    const inMemRole = currentUser?.role
    if (inMemRole === 'ADMIN' || inMemRole === '管理员') return true
    try {
      const stored = JSON.parse(localStorage.getItem('ris_current_user') ?? 'null') as { role?: string } | null
      return stored?.role === 'ADMIN' || stored?.role === '管理员'
    } catch {
      return false
    }
  }, [currentUser])

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [notifications, setNotifications] = useState<SystemNotification[]>([])
  const [apiStats, setApiStats] = useState<{ total: number; unread: number; today: number; critical: number } | null>(null)

  const mapDto = useCallback((n: NotificationDto): SystemNotification => ({
    id: n.id,
    type: mapNotificationType(n.type),
    title: n.title,
    content: n.content,
    recipientId: n.userId,
    recipientName: n.userId,
    status: n.read ? 'read' : 'unread',
    priority: mapSeverityToPriority(n.severity),
    sentAt: n.createdAt,
    readAt: n.readAt,
    relatedId: n.targetId,
    relatedType: n.type.toLowerCase(),
  }), [])

  const loadData = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    const [historyRes, statsRes] = await Promise.all([
      notificationsApi.getHistory(userId, 200),
      notificationsApi.getStats(userId),
    ])
    if (!historyRes.success) {
      setLoadError(historyRes.error?.message ?? t('notification.loadError'))
      setLoading(false)
      return
    }
    const items = (historyRes.data ?? []).map(mapDto)
    setNotifications(items)
    if (statsRes.success && statsRes.data) {
      setApiStats({
        total: statsRes.data.total,
        unread: statsRes.data.unread,
        today: statsRes.data.today,
        critical: statsRes.data.critical,
      })
    }
    setLoading(false)
  }, [userId, mapDto])

  useEffect(() => {
    void loadData()
  }, [loadData])

  // [W4-2] 实时推送: 收到 notify 事件立即刷新列表 (替代 30s 轮询)
  // 后端不可达时自动降级为轮询兜底
  const [realtimeConnected, setRealtimeConnected] = useState(false)
  useEffect(() => {
    realtime.connect()
    const offConnect = realtime.subscribe('connect', () => setRealtimeConnected(true))
    const offDisconnect = realtime.subscribe('disconnect', () => setRealtimeConnected(false))
    const offNotify = realtime.subscribe('notify', (payload: RealtimePayload) => {
      if (payload?.type === 'notification' || payload?.type === 'CRITICAL' || payload?.type === 'REPORT') {
        void loadData()
      }
    })
    return () => {
      offConnect()
      offDisconnect()
      offNotify()
    }
  }, [loadData])

  // 实时轮询刷新 (30s) - 仅作为实时推送不可用时的兜底
  useEffect(() => {
    if (realtimeConnected) return
    const iv = setInterval(() => {
      void (async () => {
        const res = await notificationsApi.getHistory(userId, 200)
        if (res.success) setNotifications(res.data?.map(mapDto) ?? [])
      })()
    }, 30000)
    return () => clearInterval(iv)
  }, [userId, mapDto, realtimeConnected])

  const [activeTab, setActiveTab] = useState('all')
  const [searchText, setSearchText] = useState('')
  const [selectedNotification, setSelectedNotification] = useState<SystemNotification | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)

  // [v3.0.6.11-99 Wave10B] 已读/未读筛选 + 分组视图
  const [readFilter, setReadFilter] = useState<'all' | 'unread' | 'read'>('all')
  const [groupByRead, setGroupByRead] = useState(false)

  const [settings, setSettings] = useState<NotificationSettings>({
    reportCompleted: true,
    criticalValue: true,
    systemNotify: true,
    appointment: true,
    consultation: true,
    emailNotify: false,
    smsNotify: false,
    pushNotify: true,
  })

  // Phase 4b - 配送追踪
  const [deliveryStatuses, setDeliveryStatuses] = useState<DeliveryStatus[]>([])
  const [showDeliveryTracking, setShowDeliveryTracking] = useState(false)

  useEffect(() => {
    setDeliveryStatuses(generateDeliveryStatuses(notifications))
  }, [notifications])

  // Phase 4b - 规则引擎
  const [rules, setRules] = useState<NotificationRule[]>(DEFAULT_RULES)

  // Phase 4b - 用户偏好
  const [userPreferences, setUserPreferences] = useState<UserNotifyPreferences>(DEFAULT_USER_PREFERENCES)
  const [showPreferences, setShowPreferences] = useState(false)

  // Web Push 管理
  const [vapidPublicKey, setVapidPublicKey] = useState<string | null>(null)
  const [pushSubscribed, setPushSubscribed] = useState(false)
  const [pushBusy, setPushBusy] = useState(false)

  // [v3.0.6.11-99 Wave7B] 订阅管理: 后端 GET/PUT /notifications/subscriptions/:userId + localStorage 兜底
  const [subscriptionTypes, setSubscriptionTypes] = useState<NotificationSubscriptionType[]>(loadLocalSubscriptions)
  const [subSaving, setSubSaving] = useState(false)

  useEffect(() => {
    void (async () => {
      const res = await notificationsApi.getSubscriptions(userId)
      if (res.success && res.data?.types && res.data.types.length > 0) {
        setSubscriptionTypes(res.data.types)
        localStorage.setItem(SUBSCRIPTION_STORAGE_KEY, JSON.stringify(res.data.types))
      }
    })()
  }, [userId])

  const handleSubscriptionToggle = useCallback((t: NotificationSubscriptionType) => {
    setSubSaving(true)
    // 危急值通知始终保持开启 (业务硬性要求, 与设置面板既有提示一致)
    const next = subscriptionTypes.includes(t)
      ? t === 'CRITICAL' ? subscriptionTypes : subscriptionTypes.filter(x => x !== t)
      : [...subscriptionTypes, t]
    const finalTypes = next.length > 0 ? next : [...DEFAULT_SUBSCRIPTION_TYPES]
    setSubscriptionTypes(finalTypes)
    localStorage.setItem(SUBSCRIPTION_STORAGE_KEY, JSON.stringify(finalTypes))
    void notificationsApi.updateSubscriptions(userId, finalTypes).then(res => {
      if (!res.success) setLoadError(`订阅保存失败: ${res.error?.message ?? '未知错误'}（已保存于本地）`)
    }).finally(() => setSubSaving(false))
  }, [userId, subscriptionTypes])

  useEffect(() => {
    void (async () => {
      const res = await notificationsApi.getVapidPublicKey()
      if (res.success && res.data?.publicKey) setVapidPublicKey(res.data.publicKey)
    })()
  }, [])

  // 筛选后的通知
  const filteredNotifications = useMemo(() => {
    return notifications.filter(n => {
      if (activeTab !== 'all' && n.type !== activeTab) return false
      // [v3.0.6.11-99 Wave10B] 已读/未读筛选
      if (readFilter === 'unread' && n.status !== 'unread') return false
      if (readFilter === 'read' && n.status !== 'read') return false
      if (searchText) {
        const search = searchText.toLowerCase()
        if (
          !n.title.toLowerCase().includes(search) &&
          !n.content.toLowerCase().includes(search) &&
          !n.recipientName.toLowerCase().includes(search)
        ) {
          return false
        }
      }
      return true
    })
  }, [notifications, activeTab, searchText, readFilter])

  // 统计 (优先 API stats: 未读/今日/总数)
  const stats = useMemo(() => {
    const unread = apiStats?.unread ?? notifications.filter(n => n.status === 'unread').length
    const total = apiStats?.total ?? notifications.length
    const byType = NOTIFICATION_TYPES.reduce((acc, type) => {
      if (type.key === 'all') return acc
      acc[type.key] = notifications.filter(n => n.type === type.key && n.status === 'unread').length
      return acc
    }, {} as Record<string, number>)
    return { unread, byType, total }
  }, [notifications, apiStats])

  // 标记已读
  const handleMarkRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n =>
      n.id === id ? { ...n, status: 'read' as const, readAt: new Date().toISOString() } : n
    ))
    void notificationsApi.markRead(id).then(res => {
      if (res.success) {
        setApiStats(prev => prev ? { ...prev, unread: Math.max(0, prev.unread - 1) } : prev)
      }
    })
  }, [])

  // 一键已读
  const handleMarkAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({
      ...n,
      status: 'read' as const,
      readAt: n.readAt || new Date().toISOString(),
    })))
    void notificationsApi.markAllRead(userId).then(res => {
      if (res.success) {
        setApiStats(prev => prev ? { ...prev, unread: 0 } : prev)
      }
    })
  }, [userId])

  // 删除通知
  const handleDelete = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
    if (selectedNotification?.id === id) {
      setSelectedNotification(null)
    }
    void notificationsApi.delete(id)
  }, [selectedNotification])

  // 批量删除已读
  const handleClearRead = useCallback(() => {
    const readIds = notifications.filter(n => n.status === 'read').map(n => n.id)
    setNotifications(prev => prev.filter(n => n.status === 'unread'))
    for (const id of readIds) {
      void notificationsApi.delete(id)
    }
  }, [notifications])

  // Web Push: 订阅
  const handlePushSubscribe = useCallback(async () => {
    if (!vapidPublicKey) {
      setLoadError(t('notification.vapidUnavailable'))
      return
    }
    setPushBusy(true)
    try {
      if (!('Notification' in window)) {
        setLoadError(t('notification.webNotificationUnsupported'))
        return
      }
      let permission = Notification.permission
      if (permission === 'default') {
        permission = await Notification.requestPermission()
      }
      if (permission !== 'granted') {
        setLoadError(t('notification.permissionDenied'))
        return
      }
      const reg = await navigator.serviceWorker?.register('/sw.js')
      const sub = await reg?.pushManager?.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      })
      if (!sub) {
        setLoadError(t('notification.pushSubscribeFailed'))
        return
      }
      const res = await notificationsApi.pushSubscribe({
        userId,
        endpoint: sub.endpoint,
        keys: {
          p256dh: btoa(String.fromCharCode(...new Uint8Array(sub.getKey('p256dh')!))),
          auth: btoa(String.fromCharCode(...new Uint8Array(sub.getKey('auth')!))),
        },
      })
      if (res.success) {
        setPushSubscribed(true)
        setLoadError(null)
      } else {
        setLoadError(res.error?.message ?? t('notification.subscribeSaveFailed'))
      }
    } catch (e) {
      setLoadError('浏览器推送订阅失败: ' + ((e as Error)?.message ?? '未知错误'))
    } finally {
      setPushBusy(false)
    }
  }, [vapidPublicKey, userId])

  // Web Push: 退订
  const handlePushUnsubscribe = useCallback(async () => {
    setPushBusy(true)
    try {
      const reg = await navigator.serviceWorker?.getRegistration('/sw.js')
      const sub = await reg?.pushManager?.getSubscription()
      if (sub) {
        const endpoint = sub.endpoint
        await sub.unsubscribe()
        await notificationsApi.pushUnsubscribe(endpoint)
      }
      setPushSubscribed(false)
    } catch (e) {
      setLoadError('退订失败: ' + ((e as Error)?.message ?? '未知错误'))
    } finally {
      setPushBusy(false)
    }
  }, [])

  // Web Push: 发送测试 (仅 ADMIN)
  const handlePushSend = useCallback(async () => {
    setPushBusy(true)
    const res = await notificationsApi.sendPush({
      userId,
      title: t('notification.pushTestTitle'),
      content: '这是一条来自通知中心的测试推送 ' + new Date().toLocaleTimeString(),
      tag: 'g005-test',
    })
    setPushBusy(false)
    if (res.success && res.data?.success) {
      setLoadError(null)
    } else {
      setLoadError(`发送失败: ${res.data?.reason ?? res.error?.message ?? '未知原因'}`)
    }
  }, [userId])

  // [W1-B] 广播通知: notificationsApi.broadcast (POST /notifications/broadcast)
  const [showBroadcast, setShowBroadcast] = useState(false)
  const [bcForm, setBcForm] = useState({ type: 'SYSTEM' as NotificationDto['type'], severity: 'INFO' as NotificationDto['severity'], title: '', content: '', userIds: '' })
  const [bcSaving, setBcSaving] = useState(false)

  const handleBroadcast = async () => {
    if (!bcForm.title.trim() || !bcForm.content.trim()) { setLoadError(t('notification.fillTitleContent')); return }
    setBcSaving(true)
    setLoadError(null)
    try {
      const userIds = bcForm.userIds.split(/[,，\s]+/).filter(Boolean)
      const res = await notificationsApi.broadcast({
        userIds: userIds.length > 0 ? userIds : ['current'],
        type: bcForm.type,
        severity: bcForm.severity,
        title: bcForm.title.trim(),
        content: bcForm.content.trim(),
      })
      if (res.success) {
        setLoadError(null)
        setShowBroadcast(false)
        setBcForm({ type: 'SYSTEM', severity: 'INFO', title: '', content: '', userIds: '' })
        void loadData()
      } else {
        setLoadError(res.error?.message ?? t('notification.broadcastFailed'))
      }
    } catch (e) {
      setLoadError('广播发送失败: ' + ((e as Error)?.message ?? '未知错误'))
    } finally {
      setBcSaving(false)
    }
  }

  // 设置更新
  const handleSettingUpdate = useCallback((key: keyof NotificationSettings, value: boolean) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }, [])

  return (
    <div data-testid="notification-center-page" style={{ background: BG, display: 'flex' }}>
      {loading && <LoadingBanner message={t('notification.loading')} />}
      {loadError && !loading && <ErrorBanner message={loadError} />}
      {/* 左侧边栏 */}
      <div style={{
        width: 260, background: 'var(--bg-card)', borderRight: '1px solid var(--border-color)',
        display: 'flex', flexDirection: 'column', height: '100vh', position: 'sticky', top: 0,
      }}>
        {/* 标题 */}
        <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 'var(--space-3, 12px)' }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10, background: `${PRIMARY}15`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Bell size={22} color={PRIMARY} />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: PRIMARY }}>{t('notification.center')}</div>
              <div style={{ fontSize: 12, color: GRAY }}>{t('notification.center')}</div>
            </div>
          </div>

          {/* 未读数醒目显示 */}
          <div style={{
            background: stats.unread > 0 ? DANGER : SUCCESS,
            color: WHITE, padding: '8px 12px', borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            boxShadow: stats.unread > 0 ? '0 2px 8px rgba(220,38,38,0.3)' : 'none',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {stats.unread > 0 ? <BellRing size={16} /> : <Check size={16} />}
              <span style={{ fontSize: 12, fontWeight: 600 }}>
                {stats.unread > 0 ? `${stats.unread} 条未读` : t('notification.noUnread')}
              </span>
            </div>
            {stats.unread > 0 && (
              <button
                onClick={handleMarkAllRead}
                style={{
                  background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 4,
                  padding: '3px 8px', color: WHITE, fontSize: 12, cursor: 'pointer',
                }}
              >
                {t('notification.markAllRead')}
              </button>
            )}
          </div>
        </div>

        {/* 分类标签 */}
        <div style={{ padding: 'var(--space-3, 12px)' }}>
          {NOTIFICATION_TYPES.map(type => {
            const count = type.key === 'all' ? stats.total : stats.byType[type.key] || 0
            return (
              <button
                key={type.key}
                onClick={() => setActiveTab(type.key)}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 8, border: 'none',
                  background: activeTab === type.key ? `${type.color}15` : 'transparent',
                  color: activeTab === type.key ? type.color : 'var(--text-secondary)',
                  fontSize: 12, fontWeight: activeTab === type.key ? 600 : 500,
                  cursor: 'pointer', display: 'flex', alignItems: 'center',
                  justifyContent: 'space-between', marginBottom: 'var(--space-1, 4px)', transition: 'all 0.15s',
                }}
                onMouseEnter={e => {
                  if (activeTab !== type.key) {
                    e.currentTarget.style.background = 'var(--bg-hover)'
                  }
                }}
                onMouseLeave={e => {
                  if (activeTab !== type.key) {
                    e.currentTarget.style.background = 'transparent'
                  }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)' }}>
                  <span style={{ color: type.color }}>{type.icon}</span>
                  <span>{type.label}</span>
                </div>
                {count > 0 && (
                  <span style={{
                    background: type.key === activeTab ? type.color : 'var(--border-default, rgba(0,0,0,0.12))',
                    color: type.key === activeTab ? WHITE : GRAY,
                    padding: '1px 8px', borderRadius: 10, fontSize: 12, fontWeight: 600,
                    minWidth: 20, textAlign: 'center',
                  }}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* 底部设置入口 */}
        <div style={{ marginTop: 'auto', padding: 'var(--space-3, 12px)', borderTop: '1px solid var(--border-color)' }}>
          {/* 实时推送状态 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', marginBottom: 'var(--space-2, 8px)', borderRadius: 6, background: realtimeConnected ? '#d1fae5' : '#fef3c7' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: realtimeConnected ? '#059669' : 'var(--color-warning-600)' }} />
            <span style={{ fontSize: 12, color: realtimeConnected ? '#059669' : '#b45309', fontWeight: 500 }}>
              {realtimeConnected ? t('notification.realtimeConnected') : t('notification.pollingFallback')}
            </span>
            <button onClick={() => void loadData()} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', padding: 2 }} title={t('notification.refresh')}>
              <RefreshCw size={14} color={GRAY} />
            </button>
            {!showDeliveryTracking && (
              <button onClick={() => setShowDeliveryTracking(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
                <Eye size={14} color={GRAY} />
              </button>
            )}
          </div>

          {/* Web Push 管理 */}
          <div style={{ padding: '8px 12px', marginBottom: 'var(--space-2, 8px)', borderRadius: 6, background: 'var(--content-bg)', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: PRIMARY, marginBottom: 'var(--space-2, 8px)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <BellRing size={14} />
              {t('notification.pushManagement')}
            </div>
            <div style={{ fontSize: 11, color: GRAY, marginBottom: 'var(--space-2, 8px)', wordBreak: 'break-all' }}>
              {vapidPublicKey ? `VAPID: ${vapidPublicKey.slice(0, 24)}…` : t('notification.vapidLoading')}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {pushSubscribed ? (
                <button onClick={() => void handlePushUnsubscribe()} disabled={pushBusy}
                  style={{ flex: 1, padding: '5px 8px', borderRadius: 4, border: '1px solid #fecaca', background: 'var(--bg-card)', color: DANGER, fontSize: 12, cursor: 'pointer' }}>
                  {t('notification.unsubscribePush')}
                </button>
              ) : (
                <button onClick={() => void handlePushSubscribe()} disabled={pushBusy || !vapidPublicKey}
                  style={{ flex: 1, padding: '5px 8px', borderRadius: 4, border: 'none', background: ACCENT, color: WHITE, fontSize: 12, cursor: 'pointer' }}>
                  {t('notification.subscribePush')}
                </button>
              )}
              {isAdmin && (
                <button onClick={() => void handlePushSend()} disabled={pushBusy}
                  style={{ flex: 1, padding: '5px 8px', borderRadius: 4, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: PRIMARY, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-1, 4px)' }}>
                  <Send size={14} />
                  {t('notification.testSend')}
                </button>
              )}
            </div>
          </div>

          <button
            onClick={() => { setShowSettings(!showSettings); setShowPreferences(false) }}
            style={{
              width: '100%', padding: '10px 12px', borderRadius: 8, border: 'none',
              background: showSettings ? `${PRIMARY}15` : 'transparent',
              color: showSettings ? PRIMARY : '#334155',
              fontSize: 12, fontWeight: 500, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)', transition: 'all 0.15s',
            }}
          >
            <Settings size={16} />
            {t('notification.settings')}
          </button>
          <button
            onClick={() => { setShowPreferences(!showPreferences); setShowSettings(false) }}
            style={{
              width: '100%', marginTop: 'var(--space-1, 4px)', padding: '10px 12px', borderRadius: 8, border: 'none',
              background: showPreferences ? `${PRIMARY}15` : 'transparent',
              color: showPreferences ? PRIMARY : '#334155',
              fontSize: 12, fontWeight: 500, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)', transition: 'all 0.15s',
            }}
          >
            <Bell size={16} />
            {t('notification.preferences')}
          </button>
          {stats.total > 0 && (
            <button
              onClick={handleClearRead}
              style={{
                width: '100%', marginTop: 6, padding: '8px 12px', borderRadius: 8,
                border: '1px solid #fee2e2', background: 'transparent',
                color: DANGER, fontSize: 12, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <Trash2 size={14} />
              {t('notification.clearRead')}
            </button>
          )}
        </div>
      </div>

      {/* 右侧内容 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* 顶部栏 */}
        <div style={{
          background: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)', padding: '14px 20px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3, 12px)' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, background: 'var(--content-bg)',
              padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border-color)',
            }}>
              <Search size={14} color={GRAY} />
              <input
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                placeholder={t('notification.searchPlaceholder')}
                style={{ border: 'none', fontSize: 12, background: 'transparent', width: 200 }}
              />
              {searchText && (
                <button onClick={() => setSearchText('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  <X size={14} color={GRAY} />
                </button>
              )}
            </div>
            {searchText && (
              <span style={{ fontSize: 12, color: GRAY }}>
                找到 {filteredNotifications.length} 条结果
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            {isAdmin && (
              <button
                onClick={() => setShowBroadcast(true)}
                style={{
                  padding: '6px 12px', borderRadius: 6, border: `1px solid ${showBroadcast ? SUCCESS : 'var(--border-default, rgba(0,0,0,0.12))'}`,
                  background: showBroadcast ? `${SUCCESS}15` : 'var(--bg-card)', color: showBroadcast ? SUCCESS : GRAY,
                  fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)',
                }}
              >
                <Send size={14} />
                {t('notification.broadcast')}
              </button>
            )}
            <button
              onClick={() => setShowDeliveryTracking(!showDeliveryTracking)}
              style={{
                padding: '6px 12px', borderRadius: 6, border: `1px solid ${showDeliveryTracking ? ACCENT : 'var(--border-default, rgba(0,0,0,0.12))'}`,
                background: showDeliveryTracking ? `${ACCENT}15` : 'var(--bg-card)', color: showDeliveryTracking ? ACCENT : GRAY,
                fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)',
              }}
            >
              <BarChart3 size={14} />
              {t('notification.deliveryTracking')}
            </button>
            <button
              onClick={() => { setShowDeliveryTracking(false); setShowPreferences(false); setShowSettings(!showSettings) }}
              style={{
                padding: '6px 12px', borderRadius: 6, border: `1px solid ${showSettings ? ACCENT : 'var(--border-default, rgba(0,0,0,0.12))'}`,
                background: showSettings ? `${ACCENT}15` : 'var(--bg-card)', color: showSettings ? ACCENT : GRAY,
                fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)',
              }}
            >
              <Zap size={14} />
              {t('notification.ruleEngine')}
            </button>
            <button
              onClick={() => void loadData()}
              style={{
                padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border-color)',
                background: 'var(--bg-card)', color: GRAY, fontSize: 12, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)',
              }}
            >
              <RefreshCw size={14} />
              {t('notification.refresh')}
            </button>
          </div>
        </div>

        {/* 主内容区 */}
        <div style={{ display: 'flex', flex: 1 }}>
          {/* 通知列表 */}
          <div style={{ flex: 1, padding: 'var(--space-4, 16px)', overflowY: 'auto' }}>
            {/* 统计面板 */}
            <StatsPanel notifications={notifications} apiStats={apiStats} />

            {/* [v3.0.6.11-99 Wave10B] 已读/未读筛选 + 分组视图工具栏 */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)', marginBottom: 'var(--space-3, 12px)', flexWrap: 'wrap',
              padding: '8px 12px', background: 'var(--bg-card)', borderRadius: 10,
              border: '1px solid var(--border-color)',
            }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: GRAY }}>{t('notification.readStatus')}</span>
              {([
                ['all', t('notification.typeAll'), notifications.length],
                ['unread', t('notification.unread'), notifications.filter(n => n.status === 'unread').length],
                ['read', t('notification.read'), notifications.filter(n => n.status === 'read').length],
              ] as Array<[typeof readFilter, string, number]>).map(([key, label, count]) => (
                <button
                  key={key}
                  onClick={() => setReadFilter(key)}
                  style={{
                    padding: '4px 12px', borderRadius: 999, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                    background: readFilter === key ? (key === 'unread' ? DANGER : key === 'read' ? SUCCESS : ACCENT) : 'var(--content-bg)',
                    color: readFilter === key ? WHITE : GRAY,
                    border: `1px solid ${readFilter === key ? 'transparent' : 'var(--border-color)'}`,
                  }}
                >
                  {label} {count}
                </button>
              ))}
              <div style={{ width: 1, height: 20, background: 'var(--border-color)' }} />
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={groupByRead}
                  onChange={e => setGroupByRead(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                {t('notification.groupByRead')}
              </label>
              {groupByRead && (
                <span style={{ fontSize: 11, color: 'var(--text-muted, #94a3b8)', marginLeft: 'auto' }}>
                  未读 {filteredNotifications.filter(n => n.status === 'unread').length} · 已读 {filteredNotifications.filter(n => n.status === 'read').length}
                </span>
              )}
            </div>

            {/* 历史动态 */}
            {!showSettings && <HistoryPanel notifications={notifications} onViewNotification={(n) => { setSelectedNotification(n); setShowDetailModal(true) }} />}

            {filteredNotifications.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: '60px 20px', background: 'var(--bg-card)',
                borderRadius: 10, border: '1px solid var(--border-color)',
              }}>
                <Bell size={48} color="var(--border-default, rgba(0,0,0,0.12))" style={{ marginBottom: 'var(--space-3, 12px)' }} />
                <div style={{ fontSize: 14, color: GRAY }}>{t('notification.noNotifications')}</div>
              </div>
            ) : groupByRead ? (
              /* [v3.0.6.11-99 Wave10B] 已读/未读分组视图 */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4, 16px)' }}>
                {([
                  ['unread', t('notification.groupUnread'), DANGER],
                  ['read', t('notification.groupRead'), SUCCESS],
                ] as Array<['unread' | 'read', string, string]>).map(([key, label, color]) => {
                  const items = filteredNotifications.filter(n => n.status === key)
                  if (items.length === 0) return null
                  return (
                    <div key={key}>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)', marginBottom: 10,
                        fontSize: 12, fontWeight: 700, color,
                      }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                        {label}
                        <span style={{
                          fontSize: 11, fontWeight: 600, padding: '1px 8px', borderRadius: 999,
                          background: `${color}1a`, color,
                        }}>
                          {items.length}
                        </span>
                        {key === 'unread' && items.length > 0 && (
                          <button
                            onClick={handleMarkAllRead}
                            style={{
                              marginLeft: 'auto', fontSize: 11, padding: '3px 10px', cursor: 'pointer',
                              border: '1px solid var(--border-color)', borderRadius: 6,
                              background: 'var(--bg-card)', color: ACCENT,
                              display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)',
                            }}
                          >
                            <CheckCheck size={12} /> {t('notification.allRead')}
                          </button>
                        )}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 'var(--space-3, 12px)' }}>
                        {items.map(notification => {
                          const delivery = deliveryStatuses.find(d => d.notificationId === notification.id)
                          return (
                            <div key={notification.id}>
                              <NotificationCard
                                notification={notification}
                                isSelected={selectedNotification?.id === notification.id}
                                onView={() => {
                                  setSelectedNotification(notification)
                                  setShowDetailModal(true)
                                }}
                                onMarkRead={() => handleMarkRead(notification.id)}
                                onDelete={() => handleDelete(notification.id)}
                              />
                              {showDeliveryTracking && delivery && (
                                <div style={{ marginTop: 2, padding: '2px 14px 6px', background: 'var(--content-bg)', borderRadius: '0 0 8px 8px', border: '1px solid var(--border-color)', borderTop: 'none' }}>
                                  <DeliveryStatusBadge delivery={delivery} />
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 'var(--space-3, 12px)' }}>
                {filteredNotifications.map(notification => {
                  const delivery = deliveryStatuses.find(d => d.notificationId === notification.id)
                  return (
                    <div key={notification.id}>
                      <NotificationCard
                        notification={notification}
                        isSelected={selectedNotification?.id === notification.id}
                        onView={() => {
                          setSelectedNotification(notification)
                          setShowDetailModal(true)
                        }}
                        onMarkRead={() => handleMarkRead(notification.id)}
                        onDelete={() => handleDelete(notification.id)}
                      />
                      {showDeliveryTracking && delivery && (
                        <div style={{ marginTop: 2, padding: '2px 14px 6px', background: 'var(--content-bg)', borderRadius: '0 0 8px 8px', border: '1px solid var(--border-color)', borderTop: 'none' }}>
                          <DeliveryStatusBadge delivery={delivery} />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* 设置/规则/偏好侧栏 */}
          {(showSettings || showDeliveryTracking || showPreferences) && (
            <div style={{
              width: 340, background: BG, borderLeft: '1px solid var(--border-color)',
              padding: 'var(--space-4, 16px)', overflowY: 'auto',
            }}>
              {showSettings && (
                <div>
                  <SettingsPanel settings={settings} onUpdate={handleSettingUpdate} />
                  <SubscriptionPanel types={subscriptionTypes} onToggle={handleSubscriptionToggle} saving={subSaving} />
                  <div style={{ marginTop: 'var(--space-3, 12px)' }}>
                    <RulesEnginePanel rules={rules} onToggle={(id) => setRules(prev => prev.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r))}
                      onDelete={(id) => setRules(prev => prev.filter(r => r.id !== id))} />
                  </div>
                </div>
              )}
              {showDeliveryTracking && (
                <div>
                  <div style={{ background: 'var(--bg-card)', borderRadius: 10, border: '1px solid var(--border-color)', padding: 'var(--space-4, 16px)', marginBottom: 'var(--space-4, 16px)' }}>
                    <div style={{ fontWeight: 700, color: PRIMARY, marginBottom: 'var(--space-4, 16px)', fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <BarChart3 size={16} />
                      {t('notification.deliveryTracking')}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-2, 8px)', marginBottom: 'var(--space-4, 16px)' }}>
                      {[
                        { label: t('notification.sent'), value: deliveryStatuses.filter(d => d.sent).length, color: ACCENT },
                        { label: t('notification.delivered'), value: deliveryStatuses.filter(d => d.delivered).length, color: SUCCESS },
                        { label: t('notification.readDone'), value: deliveryStatuses.filter(d => d.read).length, color: '#059669' },
                      ].map(s => (
                        <div key={s.label} style={{ textAlign: 'center', padding: 'var(--space-3, 12px)', background: 'var(--content-bg)', borderRadius: 8 }}>
                          <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
                          <div style={{ fontSize: 12, color: GRAY }}>{s.label}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ maxHeight: 300, overflow: 'auto' }}>
                      {deliveryStatuses.filter(d => !d.read).slice(0, 10).map(d => {
                        const notif = notifications.find(n => n.id === d.notificationId)
                        return (
                          <div key={d.notificationId} style={{ padding: '8px 0', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                            <div>
                              <div style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{notif?.title || d.notificationId}</div>
                              <DeliveryStatusBadge delivery={d} />
                            </div>
                            {!d.delivered && (
                              <button onClick={() => setDeliveryStatuses(prev => prev.map(x => x.notificationId === d.notificationId ? { ...x, retryCount: x.retryCount + 1, delivered: true } : x))}
                                style={{ padding: '3px 8px', background: ACCENT, color: WHITE, border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>
                                {t('notification.retry')}
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
              {showPreferences && <PreferencesPanel preferences={userPreferences} onUpdate={setUserPreferences} />}
              {showPreferences && (
                <div style={{ marginTop: 'var(--space-4, 16px)' }}>
                  <NotificationPreferencesSection />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 通知详情弹窗 */}
      {showDetailModal && selectedNotification && (
        <NotificationDetailModal
          notification={selectedNotification}
          onClose={() => setShowDetailModal(false)}
          onMarkRead={handleMarkRead}
        />
      )}

      {/* [W1-B] 广播通知弹窗: POST /notifications/broadcast */}
      {showBroadcast && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowBroadcast(false)}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 'var(--space-6, 24px)', width: 480, maxHeight: '85vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4, 16px)' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: PRIMARY }}>{t('notification.broadcast')}</div>
              <button onClick={() => setShowBroadcast(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: GRAY, padding: 'var(--space-1, 4px)' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3, 12px)' }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 'var(--space-1, 4px)', display: 'block' }}>{t('notification.bcTitle')} *</label>
                <input value={bcForm.title} onChange={e => setBcForm({ ...bcForm, title: e.target.value })} placeholder={t('notification.bcTitlePlaceholder')}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: 12, boxSizing: 'border-box',}} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 'var(--space-1, 4px)', display: 'block' }}>{t('notification.bcContent')} *</label>
                <textarea rows={3} value={bcForm.content} onChange={e => setBcForm({ ...bcForm, content: e.target.value })} placeholder={t('notification.bcContentPlaceholder')}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: 12, boxSizing: 'border-box', resize: 'vertical' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 'var(--space-1, 4px)', display: 'block' }}>{t('notification.bcType')}</label>
                  <select value={bcForm.type} onChange={e => setBcForm({ ...bcForm, type: e.target.value as NotificationDto['type'] })}
                    style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: 12, background: 'var(--bg-card)',}}>
                    {['CRITICAL', 'REPORT', 'TASK', 'SYSTEM', 'APPOINTMENT'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 'var(--space-1, 4px)', display: 'block' }}>{t('notification.bcSeverity')}</label>
                  <select value={bcForm.severity ?? 'INFO'} onChange={e => setBcForm({ ...bcForm, severity: e.target.value as NotificationDto['severity'] })}
                    style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: 12, background: 'var(--bg-card)',}}>
                    {['INFO', 'WARN', 'ERROR', 'CRITICAL'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 'var(--space-1, 4px)', display: 'block' }}>{t('notification.bcUsers')}</label>
                <input value={bcForm.userIds} onChange={e => setBcForm({ ...bcForm, userIds: e.target.value })} placeholder={t('notification.bcUsersPlaceholder')}
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: 12, boxSizing: 'border-box',}} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 'var(--space-2, 8px)' }}>
                <button onClick={() => setShowBroadcast(false)} style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: GRAY, fontSize: 12, cursor: 'pointer' }}>{t('notification.cancel')}</button>
                <button onClick={() => void handleBroadcast()} disabled={bcSaving} style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: SUCCESS, color: WHITE, fontSize: 12, fontWeight: 600, cursor: bcSaving ? 'wait' : 'pointer' }}>{bcSaving ? t('notification.sendingBroadcast') : t('notification.sendBroadcast')}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
