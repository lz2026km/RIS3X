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
import { notificationsApi } from '../services/api'
import type { NotificationDto } from '../services/api/notificationsApi'
import { realtime, type RealtimePayload } from '../services/realtime'
import { getCurrentUser } from '../utils/auth'
import { LoadingBanner, ErrorBanner } from '../components/feedback'
import { formatTime } from '../utils/date';

// ============================================================
// 常量定义
// ============================================================
const PRIMARY = '#1e40af'
const ACCENT = '#3182ce'
const SUCCESS = '#059669'
const WARNING = '#d97706'
const DANGER = '#dc2626'
const PURPLE = '#7c3aed'
const GRAY = '#64748b'
const BG = 'var(--bg-primary)'
const WHITE = '#ffffff'

const NOTIFICATION_TYPES = [
  { key: 'all', label: '全部', icon: <Bell size={14} />, color: PRIMARY },
  { key: 'report_completed', label: '报告', icon: <FileText size={14} />, color: '#3b82f6' },
  { key: 'critical_value', label: '危急值', icon: <AlertTriangle size={14} />, color: DANGER },
  { key: 'system', label: '系统', icon: <Settings size={14} />, color: 'var(--text-secondary)' },
  { key: 'appointment', label: '预约', icon: <Calendar size={14} />, color: SUCCESS },
  { key: 'consultation', label: '会诊', icon: <MessageSquare size={14} />, color: PURPLE },
]

const PRIORITY_CONFIG = {
  high: { label: '紧急', color: DANGER, bg: '#ef444422' },
  normal: { label: '普通', color: ACCENT, bg: '#3b82f622' },
  low: { label: '低', color: GRAY, bg: 'var(--bg-deep)' },
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  report_completed: <FileText size={20} />,
  critical_value: <AlertTriangle size={20} />,
  system: <Settings size={20} />,
  appointment: <Calendar size={20} />,
  consultation: <MessageSquare size={20} />,
}

// ============================================================
// 类型定义
// ============================================================
interface SystemNotification {
  id: string
  type: 'report_completed' | 'critical_value' | 'system' | 'appointment' | 'consultation'
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
  if (minutes < 1) return '刚刚'
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
  if (!notification) return null

  const typeConfig = NOTIFICATION_TYPES.find(t => t.key === notification.type) || NOTIFICATION_TYPES[0]!
  const priorityConfig = PRIORITY_CONFIG[notification.priority]
    const [showJumpModal, setShowJumpModal] = useState(false)

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
        <div style={{ padding: 20 }}>
          {/* 标签 */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <span style={{
              background: `${typeConfig.color}20`, color: typeConfig.color,
              padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
            }}>
              {typeConfig.label}
            </span>
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
                未读
              </span>
            )}
          </div>

          {/* 内容 */}
          <div style={{
            background: 'var(--content-bg)', padding: 16, borderRadius: 10,
            border: '1px solid var(--border-color)', marginBottom: 16,
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 16 }}>
            <div style={{ background: 'var(--content-bg)', padding: 10, borderRadius: 8, border: '1px solid var(--border-color)' }}>
              <div style={{ color: GRAY, fontSize: 12, marginBottom: 2 }}>通知ID</div>
              <div style={{ color: PRIMARY, fontSize: 12, fontWeight: 600 }}>{notification.id}</div>
            </div>
            <div style={{ background: 'var(--content-bg)', padding: 10, borderRadius: 8, border: '1px solid var(--border-color)' }}>
              <div style={{ color: GRAY, fontSize: 12, marginBottom: 2 }}>接收人</div>
              <div style={{ color: PRIMARY, fontSize: 12, fontWeight: 600 }}>{notification.recipientName}</div>
            </div>
            <div style={{ background: 'var(--content-bg)', padding: 10, borderRadius: 8, border: '1px solid var(--border-color)' }}>
              <div style={{ color: GRAY, fontSize: 12, marginBottom: 2 }}>发送时间</div>
              <div style={{ color: PRIMARY, fontSize: 12, fontWeight: 600 }}>{formatDateTime(notification.sentAt)}</div>
            </div>
            {notification.readAt && (
              <div style={{ background: 'var(--content-bg)', padding: 10, borderRadius: 8, border: '1px solid var(--border-color)' }}>
                <div style={{ color: GRAY, fontSize: 12, marginBottom: 2 }}>阅读时间</div>
                <div style={{ color: PRIMARY, fontSize: 12, fontWeight: 600 }}>{formatDateTime(notification.readAt)}</div>
              </div>
            )}
          </div>

          {/* 相关操作 */}
          {notification.relatedId && (
            <div style={{
              background: `${ACCENT}10`, padding: 12, borderRadius: 8,
              border: `1px solid ${ACCENT}30`, marginBottom: 16,
            }}>
              <div style={{ fontSize: 12, color: GRAY, marginBottom: 6 }}>相关信息</div>
              <div style={{ fontSize: 13, color: PRIMARY, marginBottom: 8 }}>
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
                查看详情
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
              background: 'var(--bg-card)', color: GRAY, fontSize: 13, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <CheckCheck size={14} />
            标记已读
          </button>
          <button onClick={onClose} style={{
            padding: '8px 20px', borderRadius: 6, border: 'none',
            background: PRIMARY, color: WHITE, fontSize: 13, cursor: 'pointer',
          }}>
            关闭
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
            padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.3)', textAlign: 'center',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#1e40af', marginBottom: 8 }}>
              跳转到{notification.relatedType}详情
            </div>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16 }}>
              ID: {notification.relatedId}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>即将跳转到相关页面查看详情</div>
            <button onClick={handleCloseJumpModal} style={{
              marginTop: 20, padding: '10px 24px', background: '#1e40af', color: '#fff',
              border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14,
            }}>确定</button>
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
      onClick={onView}
      style={{
        background: isSelected ? 'var(--color-info-bg)' : isUnread ? 'var(--bg-primary)' : 'var(--bg-card)',
        border: `1px solid ${isSelected ? ACCENT : isUnread ? '#bfdbfe' : '#e2e8f0'}`,
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
          e.currentTarget.style.borderColor = isUnread ? '#bfdbfe' : '#e2e8f0'
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
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
        fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5,
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
          {notification.priority === 'high' && (
            <span style={{
              background: DANGER, color: WHITE,
              padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600,
            }}>
              紧急
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
                display: 'flex', alignItems: 'center', gap: 4,
              }}
              title="标记已读"
            >
              <Check size={14} />
            </button>
          )}
          <button
            onClick={onDelete}
            style={{
              padding: '4px 8px', borderRadius: 4, border: '1px solid #fee2e2',
              background: 'var(--bg-card)', color: DANGER, fontSize: 12, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4,
            }}
            title="删除"
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
    <div
      onClick={() => onChange(!checked)}
      style={{
        width: 40, height: 22, borderRadius: 11, cursor: 'pointer',
        background: checked ? ACCENT : '#e2e8f0', position: 'relative',
        transition: 'background 0.2s',
      }}
    >
      <div style={{
        width: 18, height: 18, borderRadius: '50%', background: 'var(--bg-card)',
        position: 'absolute', top: 2, transition: 'left 0.2s',
        left: checked ? 20 : 2, boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }} />
    </div>
  )

  const SectionTitle = ({ children }: { children: React.ReactNode }) => (
    <div style={{
      fontSize: 13, fontWeight: 700, color: PRIMARY, marginBottom: 12,
      paddingBottom: 8, borderBottom: '1px solid var(--border-color)',
    }}>
      {children}
    </div>
  )

  const SettingRow = ({ label, checked, onChange, icon }: { label: string; checked: boolean; onChange: (v: boolean) => void; icon: React.ReactNode }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ color: GRAY }}>{icon}</div>
        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{label}</span>
      </div>
      <ToggleSwitch checked={checked} onChange={onChange} />
    </div>
  )

  return (
    <div style={{
      background: 'var(--bg-card)', borderRadius: 10, border: '1px solid var(--border-color)',
      padding: 16,
    }}>
      <div style={{ fontWeight: 700, color: PRIMARY, marginBottom: 16, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Settings size={16} />
        通知设置
      </div>

      <SectionTitle>通知类型</SectionTitle>
      <SettingRow
        label="报告完成通知"
        checked={settings.reportCompleted}
        onChange={v => onUpdate('reportCompleted', v)}
        icon={<FileText size={16} />}
      />
      <SettingRow
        label="危急值通知"
        checked={settings.criticalValue}
        onChange={v => onUpdate('criticalValue', v)}
        icon={<AlertTriangle size={16} />}
      />
      <SettingRow
        label="系统通知"
        checked={settings.systemNotify}
        onChange={v => onUpdate('systemNotify', v)}
        icon={<Settings size={16} />}
      />
      <SettingRow
        label="预约提醒"
        checked={settings.appointment}
        onChange={v => onUpdate('appointment', v)}
        icon={<Calendar size={16} />}
      />
      <SettingRow
        label="会诊消息"
        checked={settings.consultation}
        onChange={v => onUpdate('consultation', v)}
        icon={<MessageSquare size={16} />}
      />

      <SectionTitle>接收方式</SectionTitle>
      <SettingRow
        label="邮件通知"
        checked={settings.emailNotify}
        onChange={v => onUpdate('emailNotify', v)}
        icon={<Mail size={16} />}
      />
      <SettingRow
        label="短信通知"
        checked={settings.smsNotify}
        onChange={v => onUpdate('smsNotify', v)}
        icon={<Smartphone size={16} />}
      />
      <SettingRow
        label="推送通知"
        checked={settings.pushNotify}
        onChange={v => onUpdate('pushNotify', v)}
        icon={<BellRing size={16} />}
      />

      <div style={{ marginTop: 16, padding: 12, background: 'var(--color-warning-bg)', borderRadius: 8, border: '1px solid #fcd34d' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <AlertCircle size={16} color={WARNING} style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: 12, color: '#92400e', lineHeight: 1.5 }}>
            温馨提示：危急值通知不受以上设置影响，始终保持开启状态。设置变更将在5分钟内生效。
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

  // 本周趋势（模拟）
  const weekTrend = [
    { day: '周一', count: 42, unread: 8 },
    { day: '周二', count: 38, unread: 5 },
    { day: '周三', count: 45, unread: 12 },
    { day: '周四', count: 52, unread: 15 },
    { day: '周五', count: 48, unread: 10 },
    { day: '周六', count: 20, unread: 3 },
    { day: '周日', count: 15, unread: 2 },
  ]

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
      padding: 16, marginBottom: 16,
    }}>
      <div style={{ fontWeight: 700, color: PRIMARY, marginBottom: 16, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
        <BarChart3 size={16} />
        通知统计
      </div>

      {/* 今日概览 */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: GRAY, marginBottom: 8 }}>今日概览</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          <div style={{ background: 'var(--content-bg)', padding: 12, borderRadius: 8, textAlign: 'center', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: PRIMARY }}>{todayStats.total}</div>
            <div style={{ fontSize: 12, color: GRAY }}>今日总数</div>
          </div>
          <div style={{ background: 'var(--content-bg)', padding: 12, borderRadius: 8, textAlign: 'center', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: SUCCESS }}>{todayStats.total - todayStats.unread}</div>
            <div style={{ fontSize: 12, color: GRAY }}>已读</div>
          </div>
          <div style={{ background: 'var(--content-bg)', padding: 12, borderRadius: 8, textAlign: 'center', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: DANGER }}>{todayStats.unread}</div>
            <div style={{ fontSize: 12, color: GRAY }}>未读</div>
          </div>
          <div style={{ background: 'var(--color-error-bg)', padding: 12, borderRadius: 8, textAlign: 'center', border: '1px solid #fecaca' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: DANGER }}>{todayStats.critical}</div>
            <div style={{ fontSize: 12, color: GRAY }}>危急值</div>
          </div>
        </div>
      </div>

      {/* 本周趋势 */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: GRAY, marginBottom: 8 }}>本周趋势</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 80 }}>
          {weekTrend.map((day, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{
                width: '100%', background: i === 4 ? ACCENT : '#e2e8f0',
                borderRadius: 4, height: `${(day.count / 60) * 70}px`,
                transition: 'height 0.3s',
              }} />
              <span style={{ fontSize: 12, color: GRAY }}>{day.day}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 类型分布 */}
      <div>
        <div style={{ fontSize: 12, color: GRAY, marginBottom: 8 }}>类型分布</div>
        {typeDistribution.map(type => (
          <div key={type.key} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: type.color }}>{type.icon}</span>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{type.label}</span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
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
      padding: 16,
    }}>
      <div style={{ fontWeight: 700, color: PRIMARY, marginBottom: 12, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Clock size={16} />
        最新动态
      </div>
      {hourGroups.slice(0, 6).map(([hour, hourNotifs]) => (
        <div key={hour} style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: GRAY, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Clock size={10} />
            {hour} ({hourNotifs.length}条)
          </div>
          {hourNotifs.slice(0, 3).map(n => {
            const typeConfig = NOTIFICATION_TYPES.find(t => t.key === n.type) || NOTIFICATION_TYPES[0]!
            return (
              <div
                key={n.id}
                onClick={() => onViewNotification(n)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px',
                  background: 'var(--content-bg)', borderRadius: 6, marginBottom: 4, cursor: 'pointer',
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
    if (!delivery.sent) return { label: '发送中', color: 'var(--text-secondary)', bg: 'var(--bg-deep)' }
    if (!delivery.delivered) return { label: '发送失败', color: '#ef4444', bg: '#ef444422' }
    if (delivery.read) return { label: '已阅读', color: '#059669', bg: '#22c55e22' }
    return { label: '已送达', color: '#3b82f6', bg: '#3b82f622' }
  }
  const s = getStatus()
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
      <span style={{ padding: '2px 8px', borderRadius: 4, background: s.bg, color: s.color, fontWeight: 500 }}>{s.label}</span>
      {delivery.retryCount > 0 && <span style={{ color: '#d97706' }}>重试{delivery.retryCount}次</span>}
      <span style={{ color: 'var(--text-secondary)' }}>{delivery.channel === 'in-app' ? '应用内' : delivery.channel === 'sms' ? '短信' : '邮件'}</span>
    </div>
  )
}

// ============================================================
// Phase 4b - 规则引擎面板
// ============================================================
function RulesEnginePanel({ rules, onToggle, onDelete }: { rules: NotificationRule[]; onToggle: (id: string) => void; onDelete: (id: string) => void }) {
  const EVENT_LABELS: Record<string, string> = { critical_value: '危急值', report_ready: '报告完成', schedule_change: '排班变更', appointment: '预约', system_alert: '系统告警' }
  return (
    <div style={{ background: 'var(--bg-card)', borderRadius: 10, border: '1px solid var(--border-color)', padding: 16, marginBottom: 16 }}>
      <div style={{ fontWeight: 700, color: PRIMARY, marginBottom: 16, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Zap size={16} />
        通知规则引擎
      </div>
      {rules.map(rule => (
        <div key={rule.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>{rule.name}</span>
              <span style={{ padding: '1px 6px', borderRadius: 4, fontSize: 12, background: rule.priority === 'high' ? 'var(--color-error-bg)' : 'var(--bg-card)', color: rule.priority === 'high' ? '#dc2626' : '#64748b' }}>
                {rule.priority === 'high' ? '高优先级' : '普通'}
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
              事件: {EVENT_LABELS[rule.eventType] || rule.eventType} · 渠道: {rule.actions.map(a => a.channel === 'in-app' ? '应用内' : a.channel === 'sms' ? '短信' : '邮件').join(', ')}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div onClick={() => onToggle(rule.id)} style={{ width: 36, height: 20, borderRadius: 10, background: rule.enabled ? ACCENT : '#e2e8f0', position: 'relative', cursor: 'pointer' }}>
              <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'var(--bg-card)', position: 'absolute', top: 2, left: rule.enabled ? 18 : 2, boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
            </div>
            <button onClick={() => onDelete(rule.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><Trash2 size={14} /></button>
          </div>
        </div>
      ))}
      <div style={{ marginTop: 12, padding: 12, background: 'var(--content-bg)', borderRadius: 6, fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center' }}>
        规则引擎根据事件类型和条件自动匹配通知渠道
      </div>
    </div>
  )
}

// ============================================================
// Phase 4b - 用户偏好设置
// ============================================================
function PreferencesPanel({ preferences, onUpdate }: { preferences: UserNotifyPreferences; onUpdate: (p: UserNotifyPreferences) => void }) {
  return (
    <div style={{ background: 'var(--bg-card)', borderRadius: 10, border: '1px solid var(--border-color)', padding: 16 }}>
      <div style={{ fontWeight: 700, color: PRIMARY, marginBottom: 16, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Settings size={16} />
        用户偏好
      </div>
      {/* 免打扰 */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, fontWeight: 600 }}>免打扰时段</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div onClick={() => onUpdate({ ...preferences, quietHoursEnabled: !preferences.quietHoursEnabled })}
            style={{ width: 36, height: 20, borderRadius: 10, background: preferences.quietHoursEnabled ? ACCENT : '#e2e8f0', position: 'relative', cursor: 'pointer' }}>
            <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'var(--bg-card)', position: 'absolute', top: 2, left: preferences.quietHoursEnabled ? 18 : 2, boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
          </div>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>启用免打扰</span>
        </div>
        {preferences.quietHoursEnabled && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="time" value={preferences.quietHoursStart} onChange={e => onUpdate({ ...preferences, quietHoursStart: e.target.value })}
              style={{ padding: '4px 8px', border: '1px solid var(--border-color)', borderRadius: 4, fontSize: 12 }} />
            <span style={{ color: 'var(--text-secondary)' }}>至</span>
            <input type="time" value={preferences.quietHoursEnd} onChange={e => onUpdate({ ...preferences, quietHoursEnd: e.target.value })}
              style={{ padding: '4px 8px', border: '1px solid var(--border-color)', borderRadius: 4, fontSize: 12 }} />
          </div>
        )}
      </div>
      {/* 摘要模式 */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, fontWeight: 600 }}>摘要模式</div>
        <select value={preferences.digestMode} onChange={e => onUpdate({ ...preferences, digestMode: e.target.value as any })}
          style={{ width: '100%', padding: '6px 10px', border: '1px solid var(--border-color)', borderRadius: 4, fontSize: 12 }}>
          <option value="none">关闭</option>
          <option value="daily">每日摘要</option>
          <option value="weekly">每周摘要</option>
        </select>
        {preferences.digestMode !== 'none' && (
          <div style={{ marginTop: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>发送时间：</span>
            <input type="time" value={preferences.digestTime} onChange={e => onUpdate({ ...preferences, digestTime: e.target.value })}
              style={{ padding: '4px 8px', border: '1px solid var(--border-color)', borderRadius: 4, fontSize: 12 }} />
          </div>
        )}
      </div>
      <div style={{ padding: 8, background: 'var(--color-warning-bg)', borderRadius: 6, border: '1px solid #fcd34d', fontSize: 12, color: '#92400e' }}>
        变更将自动保存，5分钟内生效
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
      setLoadError(historyRes.error?.message ?? 'API 不可用，通知数据加载失败')
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
  }, [notifications, activeTab, searchText])

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
      setLoadError('VAPID 公钥不可用（后端未配置）')
      return
    }
    setPushBusy(true)
    try {
      if (!('Notification' in window)) {
        setLoadError('当前浏览器不支持 Web Notification')
        return
      }
      let permission = Notification.permission
      if (permission === 'default') {
        permission = await Notification.requestPermission()
      }
      if (permission !== 'granted') {
        setLoadError('通知权限被拒绝，无法订阅浏览器推送')
        return
      }
      const reg = await navigator.serviceWorker?.register('/sw.js')
      const sub = await reg?.pushManager?.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      })
      if (!sub) {
        setLoadError('PushManager 订阅失败（浏览器或协议不支持）')
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
        setLoadError(res.error?.message ?? '订阅保存失败')
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
      title: '浏览器推送测试',
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
    if (!bcForm.title.trim() || !bcForm.content.trim()) { setLoadError('请填写标题和内容'); return }
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
        setLoadError(res.error?.message ?? '广播发送失败')
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
    <div data-testid="notification-center-page" style={{ minHeight: '100vh', background: BG, display: 'flex' }}>
      {loading && <LoadingBanner message="正在从 API 加载通知数据..." />}
      {loadError && !loading && <ErrorBanner message={loadError} />}
      {/* 左侧边栏 */}
      <div style={{
        width: 260, background: 'var(--bg-card)', borderRight: '1px solid var(--border-color)',
        display: 'flex', flexDirection: 'column', height: '100vh', position: 'sticky', top: 0,
      }}>
        {/* 标题 */}
        <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10, background: `${PRIMARY}15`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Bell size={22} color={PRIMARY} />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: PRIMARY }}>通知中心</div>
              <div style={{ fontSize: 12, color: GRAY }}>通知中心</div>
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
              <span style={{ fontSize: 13, fontWeight: 600 }}>
                {stats.unread > 0 ? `${stats.unread} 条未读` : '暂无未读'}
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
                一键已读
              </button>
            )}
          </div>
        </div>

        {/* 分类标签 */}
        <div style={{ padding: 12 }}>
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
                  fontSize: 13, fontWeight: activeTab === type.key ? 600 : 500,
                  cursor: 'pointer', display: 'flex', alignItems: 'center',
                  justifyContent: 'space-between', marginBottom: 4, transition: 'all 0.15s',
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: type.color }}>{type.icon}</span>
                  <span>{type.label}</span>
                </div>
                {count > 0 && (
                  <span style={{
                    background: type.key === activeTab ? type.color : '#e2e8f0',
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
        <div style={{ marginTop: 'auto', padding: 12, borderTop: '1px solid var(--border-color)' }}>
          {/* 实时推送状态 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', marginBottom: 8, borderRadius: 6, background: realtimeConnected ? '#d1fae5' : '#fef3c7' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: realtimeConnected ? '#059669' : '#d97706' }} />
            <span style={{ fontSize: 12, color: realtimeConnected ? '#059669' : '#b45309', fontWeight: 500 }}>
              {realtimeConnected ? '实时推送已连接' : '轮询兜底中 (30s)'}
            </span>
            <button onClick={() => void loadData()} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', padding: 2 }} title="刷新">
              <RefreshCw size={14} color={GRAY} />
            </button>
            {!showDeliveryTracking && (
              <button onClick={() => setShowDeliveryTracking(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
                <Eye size={14} color={GRAY} />
              </button>
            )}
          </div>

          {/* Web Push 管理 */}
          <div style={{ padding: '8px 12px', marginBottom: 8, borderRadius: 6, background: 'var(--content-bg)', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: PRIMARY, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <BellRing size={14} />
              浏览器推送管理
            </div>
            <div style={{ fontSize: 11, color: GRAY, marginBottom: 8, wordBreak: 'break-all' }}>
              {vapidPublicKey ? `VAPID: ${vapidPublicKey.slice(0, 24)}…` : 'VAPID 公钥获取中…'}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {pushSubscribed ? (
                <button onClick={() => void handlePushUnsubscribe()} disabled={pushBusy}
                  style={{ flex: 1, padding: '5px 8px', borderRadius: 4, border: '1px solid #fecaca', background: 'var(--bg-card)', color: DANGER, fontSize: 12, cursor: 'pointer' }}>
                  退订推送
                </button>
              ) : (
                <button onClick={() => void handlePushSubscribe()} disabled={pushBusy || !vapidPublicKey}
                  style={{ flex: 1, padding: '5px 8px', borderRadius: 4, border: 'none', background: ACCENT, color: WHITE, fontSize: 12, cursor: 'pointer' }}>
                  订阅推送
                </button>
              )}
              {isAdmin && (
                <button onClick={() => void handlePushSend()} disabled={pushBusy}
                  style={{ flex: 1, padding: '5px 8px', borderRadius: 4, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: PRIMARY, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                  <Send size={14} />
                  测试发送
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
              fontSize: 13, fontWeight: 500, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.15s',
            }}
          >
            <Settings size={16} />
            通知设置
          </button>
          <button
            onClick={() => { setShowPreferences(!showPreferences); setShowSettings(false) }}
            style={{
              width: '100%', marginTop: 4, padding: '10px 12px', borderRadius: 8, border: 'none',
              background: showPreferences ? `${PRIMARY}15` : 'transparent',
              color: showPreferences ? PRIMARY : '#334155',
              fontSize: 13, fontWeight: 500, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.15s',
            }}
          >
            <Bell size={16} />
            用户偏好
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
              清理已读通知
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, background: 'var(--content-bg)',
              padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border-color)',
            }}>
              <Search size={14} color={GRAY} />
              <input
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                placeholder="搜索通知标题、内容..."
                style={{ border: 'none', outline: 'none', fontSize: 13, background: 'transparent', width: 200 }}
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
                  padding: '6px 12px', borderRadius: 6, border: `1px solid ${showBroadcast ? SUCCESS : '#e2e8f0'}`,
                  background: showBroadcast ? `${SUCCESS}15` : 'var(--bg-card)', color: showBroadcast ? SUCCESS : GRAY,
                  fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                }}
              >
                <Send size={14} />
                广播通知
              </button>
            )}
            <button
              onClick={() => setShowDeliveryTracking(!showDeliveryTracking)}
              style={{
                padding: '6px 12px', borderRadius: 6, border: `1px solid ${showDeliveryTracking ? ACCENT : '#e2e8f0'}`,
                background: showDeliveryTracking ? `${ACCENT}15` : 'var(--bg-card)', color: showDeliveryTracking ? ACCENT : GRAY,
                fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              <BarChart3 size={14} />
              配送追踪
            </button>
            <button
              onClick={() => { setShowDeliveryTracking(false); setShowPreferences(false); setShowSettings(!showSettings) }}
              style={{
                padding: '6px 12px', borderRadius: 6, border: `1px solid ${showSettings ? ACCENT : '#e2e8f0'}`,
                background: showSettings ? `${ACCENT}15` : 'var(--bg-card)', color: showSettings ? ACCENT : GRAY,
                fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              <Zap size={14} />
              规则引擎
            </button>
            <button
              onClick={() => void loadData()}
              style={{
                padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border-color)',
                background: 'var(--bg-card)', color: GRAY, fontSize: 12, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              <RefreshCw size={14} />
              刷新
            </button>
          </div>
        </div>

        {/* 主内容区 */}
        <div style={{ display: 'flex', flex: 1 }}>
          {/* 通知列表 */}
          <div style={{ flex: 1, padding: 16, overflowY: 'auto' }}>
            {/* 统计面板 */}
            <StatsPanel notifications={notifications} apiStats={apiStats} />
            
            {/* 历史动态 */}
            {!showSettings && <HistoryPanel notifications={notifications} onViewNotification={(n) => { setSelectedNotification(n); setShowDetailModal(true) }} />}

            {filteredNotifications.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: '60px 20px', background: 'var(--bg-card)',
                borderRadius: 10, border: '1px solid var(--border-color)',
              }}>
                <Bell size={48} color="#e2e8f0" style={{ marginBottom: 12 }} />
                <div style={{ fontSize: 14, color: GRAY }}>暂无通知</div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 12 }}>
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
              padding: 16, overflowY: 'auto',
            }}>
              {showSettings && (
                <div>
                  <SettingsPanel settings={settings} onUpdate={handleSettingUpdate} />
                  <div style={{ marginTop: 12 }}>
                    <RulesEnginePanel rules={rules} onToggle={(id) => setRules(prev => prev.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r))}
                      onDelete={(id) => setRules(prev => prev.filter(r => r.id !== id))} />
                  </div>
                </div>
              )}
              {showDeliveryTracking && (
                <div>
                  <div style={{ background: 'var(--bg-card)', borderRadius: 10, border: '1px solid var(--border-color)', padding: 16, marginBottom: 16 }}>
                    <div style={{ fontWeight: 700, color: PRIMARY, marginBottom: 16, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <BarChart3 size={16} />
                      配送追踪
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
                      {[
                        { label: '已发送', value: deliveryStatuses.filter(d => d.sent).length, color: ACCENT },
                        { label: '已送达', value: deliveryStatuses.filter(d => d.delivered).length, color: SUCCESS },
                        { label: '已阅读', value: deliveryStatuses.filter(d => d.read).length, color: '#059669' },
                      ].map(s => (
                        <div key={s.label} style={{ textAlign: 'center', padding: 12, background: 'var(--content-bg)', borderRadius: 8 }}>
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
                                重试
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
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 24, width: 480, maxHeight: '85vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: PRIMARY }}>广播通知</div>
              <button onClick={() => setShowBroadcast(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: GRAY, padding: 4 }}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>标题 *</label>
                <input value={bcForm.title} onChange={e => setBcForm({ ...bcForm, title: e.target.value })} placeholder="通知标题"
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: 13, boxSizing: 'border-box', outline: 'none' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>内容 *</label>
                <textarea rows={3} value={bcForm.content} onChange={e => setBcForm({ ...bcForm, content: e.target.value })} placeholder="通知内容"
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: 13, boxSizing: 'border-box', outline: 'none', resize: 'vertical' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>类型</label>
                  <select value={bcForm.type} onChange={e => setBcForm({ ...bcForm, type: e.target.value as NotificationDto['type'] })}
                    style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: 13, background: 'var(--bg-card)', outline: 'none' }}>
                    {['CRITICAL', 'REPORT', 'TASK', 'SYSTEM', 'APPOINTMENT'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>严重级别</label>
                  <select value={bcForm.severity ?? 'INFO'} onChange={e => setBcForm({ ...bcForm, severity: e.target.value as NotificationDto['severity'] })}
                    style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: 13, background: 'var(--bg-card)', outline: 'none' }}>
                    {['INFO', 'WARN', 'ERROR', 'CRITICAL'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>接收用户ID (逗号分隔, 留空=全部)</label>
                <input value={bcForm.userIds} onChange={e => setBcForm({ ...bcForm, userIds: e.target.value })} placeholder="如 admin,doctor01 (留空广播全部)"
                  style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: 13, boxSizing: 'border-box', outline: 'none' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button onClick={() => setShowBroadcast(false)} style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: GRAY, fontSize: 13, cursor: 'pointer' }}>取消</button>
                <button onClick={() => void handleBroadcast()} disabled={bcSaving} style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: SUCCESS, color: WHITE, fontSize: 13, fontWeight: 600, cursor: bcSaving ? 'wait' : 'pointer' }}>{bcSaving ? '发送中...' : '发送广播'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
