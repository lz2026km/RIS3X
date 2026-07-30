// ============================================================
// G005 放射科RIS系统 - 通知中心页面 v1.0.0
// 统一管理所有系统通知，支持分类、筛选、设置
// ============================================================
import { useState, useMemo, useCallback, useEffect } from 'react'
import {
  Bell, BellRing, FileText, AlertTriangle, Settings, Calendar,
  MessageSquare, Check, CheckCheck, Trash2, Search, X,
  Clock, User, ChevronRight, Filter, RefreshCw, Eye,
  AlertCircle, Info, Zap, FilterX, Volume2, VolumeX,
  Mail, Smartphone, Monitor,   EyeOff, BarChart3
} from 'lucide-react'
import { initialUsers } from '../data/initialData'
import { userApi, notificationApi } from '../services/api'
import type { NotificationDto } from '../services/api'
import { LoadingBanner, ErrorBanner } from '../components/feedback'

// ============================================================
// 常量定义
// ============================================================
const PRIMARY = '#1e3a5f'
const PRIMARY_LIGHT = '#2c5282'
const ACCENT = '#3182ce'
const SUCCESS = '#059669'
const WARNING = '#d97706'
const DANGER = '#dc2626'
const PURPLE = '#7c3aed'
const GRAY = '#64748b'
const BG = '#f8fafc'
const WHITE = '#ffffff'

const NOTIFICATION_TYPES = [
  { key: 'all', label: '全部', icon: <Bell size={14} />, color: PRIMARY },
  { key: 'report_completed', label: '报告', icon: <FileText size={14} />, color: '#3b82f6' },
  { key: 'critical_value', label: '危急值', icon: <AlertTriangle size={14} />, color: DANGER },
  { key: 'system', label: '系统', icon: <Settings size={14} />, color: '#6b7280' },
  { key: 'appointment', label: '预约', icon: <Calendar size={14} />, color: SUCCESS },
  { key: 'consultation', label: '会诊', icon: <MessageSquare size={14} />, color: PURPLE },
]

const PRIORITY_CONFIG = {
  high: { label: '紧急', color: DANGER, bg: '#fef2f2' },
  normal: { label: '普通', color: ACCENT, bg: '#eff6ff' },
  low: { label: '低', color: GRAY, bg: '#f8fafc' },
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

function formatTime(dt: string): string {
  if (!dt) return '-'
  const d = new Date(dt)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function getRelativeTime(dt: string): string {
  const now = new Date('2026-05-01T18:00:00')
  const d = new Date(dt)
  const diff = now.getTime() - d.getTime()
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
// 生成模拟通知数据（200条）
// ============================================================
function generateMockNotifications(): SystemNotification[] {
  const users = initialUsers.filter(u => u.role === 'radiologist' || u.role === 'technologist')
  
  const templates = {
    report_completed: [
      { title: '报告已完成', content: '患者张志刚的冠脉CTA报告已完成，正在等待审核。' },
      { title: '报告已发布', content: '患者李秀英的头颅MR平扫报告已审核通过并发布。' },
      { title: '报告已归档', content: '患者王建国的胸部DR正侧位报告已完成归档。' },
    ],
    critical_value: [
      { title: '危急值通知', content: '患者赵晓敏的头颅CT平扫发现左侧额颞顶部硬膜下血肿，中线右偏约8mm，请立即处理！' },
      { title: '危急值已接收', content: '患者周玉芬的腹部CT增强发现肝右叶占位，疑似恶性肿瘤，临床已接收危急值通知。' },
      { title: '危急值已确认', content: '患者孙伟的腰椎MR平扫发现L4/5椎间盘向左后方突出，神经根受压，已电话通知临床。' },
    ],
    system: [
      { title: '系统更新提示', content: 'RIS系统将于今晚22:00-23:00进行例行维护，届时部分功能可能暂时无法使用。' },
      { title: '数据备份完成', content: '系统已完成今日数据备份，备份文件已同步至灾备中心。' },
      { title: '权限变更通知', content: '您的报告审核权限已更新，现在可以审核CT类报告。' },
    ],
    appointment: [
      { title: '预约提醒', content: '患者吴婷的乳腺钼靶检查将于明日上午10:00开始，请提前做好准备。' },
      { title: '预约变更', content: '患者郑丽的胸部CT平扫预约时间已从14:00调整至15:00。' },
      { title: '新预约申请', content: '心内科申请了患者钱伟明的冠脉CTA检查，预约时间为明日上午。' },
    ],
    consultation: [
      { title: '会诊请求', content: '神经内科提交了一例疑难病例会诊请求，请尽快查看并回复。' },
      { title: '会诊已回复', content: '您申请的MDT会诊已有心内科回复，建议行CAG+PCI治疗。' },
      { title: '远程会诊待处理', content: '有一例远程会诊申请需要您处理，请登录查看详情。' },
    ],
  }

  const types: SystemNotification['type'][] = ['report_completed', 'critical_value', 'system', 'appointment', 'consultation']
  const priorities: SystemNotification['priority'][] = ['high', 'normal', 'low']

  const notifications: SystemNotification[] = []
  const baseTime = new Date('2026-05-01T08:00:00')

  for (let i = 0; i < 200; i++) {
    const type = types[Math.floor(Math.random() * types.length)]
    const typeTemplates = templates[type]
    const template = typeTemplates[Math.floor(Math.random() * typeTemplates.length)]
    const user = users[Math.floor(Math.random() * users.length)]
    const hoursOffset = Math.floor(i / 2) + Math.random() * 0.3
    const sentAt = new Date(baseTime.getTime() - hoursOffset * 3600000).toISOString()
    const isRead = Math.random() > 0.3
    const priority = type === 'critical_value' ? 'high' : priorities[Math.floor(Math.random() * priorities.length)]

    notifications.push({
      id: `NOTIF${String(i + 1).padStart(5, '0')}`,
      type,
      title: template.title,
      content: template.content,
      recipientId: user.id,
      recipientName: user.name,
      status: isRead ? 'read' : 'unread',
      priority,
      sentAt,
      readAt: isRead ? new Date(new Date(sentAt).getTime() + Math.random() * 3600000).toISOString() : undefined,
      relatedId: `REL-${String(Math.floor(Math.random() * 1000)).padStart(4, '0')}`,
      relatedType: type === 'report_completed' ? 'report' : type === 'critical_value' ? 'exam' : type === 'appointment' ? 'exam' : type === 'consultation' ? 'consultation' : 'system',
    })
  }

  return notifications.sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime())
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
    deliveredAt: new Date(new Date(n.sentAt).getTime() + Math.random() * 60000).toISOString(),
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

  const typeConfig = NOTIFICATION_TYPES.find(t => t.key === notification.type) || NOTIFICATION_TYPES[0]
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
        background: WHITE, borderRadius: 12, width: '90%', maxWidth: 600,
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
            background: '#f8fafc', padding: 16, borderRadius: 10,
            border: '1px solid #e2e8f0', marginBottom: 16,
          }}>
            <pre style={{
              margin: 0, fontSize: 14, color: '#334155',
              lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              fontFamily: 'inherit',
            }}>
              {notification.content}
            </pre>
          </div>

          {/* 元信息 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 16 }}>
            <div style={{ background: '#f8fafc', padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <div style={{ color: GRAY, fontSize: 12, marginBottom: 2 }}>通知ID</div>
              <div style={{ color: PRIMARY, fontSize: 12, fontWeight: 600 }}>{notification.id}</div>
            </div>
            <div style={{ background: '#f8fafc', padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <div style={{ color: GRAY, fontSize: 12, marginBottom: 2 }}>接收人</div>
              <div style={{ color: PRIMARY, fontSize: 12, fontWeight: 600 }}>{notification.recipientName}</div>
            </div>
            <div style={{ background: '#f8fafc', padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <div style={{ color: GRAY, fontSize: 12, marginBottom: 2 }}>发送时间</div>
              <div style={{ color: PRIMARY, fontSize: 12, fontWeight: 600 }}>{formatDateTime(notification.sentAt)}</div>
            </div>
            {notification.readAt && (
              <div style={{ background: '#f8fafc', padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }}>
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
        <div style={{ padding: '12px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between' }}>
          <button
            onClick={() => {
              onMarkRead(notification.id)
              onClose()
            }}
            style={{
              padding: '8px 16px', borderRadius: 6, border: '1px solid #e2e8f0',
              background: WHITE, color: GRAY, fontSize: 13, cursor: 'pointer',
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
            background: '#fff', borderRadius: 12, width: '90%', maxWidth: 400,
            padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.3)', textAlign: 'center',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#1e3a5f', marginBottom: 8 }}>
              跳转到{notification.relatedType}详情
            </div>
            <div style={{ fontSize: 14, color: '#64748b', marginBottom: 16 }}>
              ID: {notification.relatedId}
            </div>
            <div style={{ fontSize: 13, color: '#94a3b8' }}>即将跳转到相关页面查看详情</div>
            <button onClick={handleCloseJumpModal} style={{
              marginTop: 20, padding: '10px 24px', background: '#1e3a5f', color: '#fff',
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
  const typeConfig = NOTIFICATION_TYPES.find(t => t.key === notification.type) || NOTIFICATION_TYPES[0]
  const priorityConfig = PRIORITY_CONFIG[notification.priority]
  const isUnread = notification.status === 'unread'

  return (
    <div
      onClick={onView}
      style={{
        background: isSelected ? '#eff6ff' : isUnread ? '#f8fafc' : WHITE,
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
        fontSize: 13, color: '#475569', lineHeight: 1.5,
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
                padding: '4px 8px', borderRadius: 4, border: '1px solid #e2e8f0',
                background: WHITE, color: ACCENT, fontSize: 12, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 4,
              }}
              title="标记已读"
            >
              <Check size={12} />
            </button>
          )}
          <button
            onClick={onDelete}
            style={{
              padding: '4px 8px', borderRadius: 4, border: '1px solid #fee2e2',
              background: WHITE, color: DANGER, fontSize: 12, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4,
            }}
            title="删除"
          >
            <Trash2 size={12} />
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
        width: 18, height: 18, borderRadius: '50%', background: WHITE,
        position: 'absolute', top: 2, transition: 'left 0.2s',
        left: checked ? 20 : 2, boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }} />
    </div>
  )

  const SectionTitle = ({ children }: { children: React.ReactNode }) => (
    <div style={{
      fontSize: 13, fontWeight: 700, color: PRIMARY, marginBottom: 12,
      paddingBottom: 8, borderBottom: '1px solid #e2e8f0',
    }}>
      {children}
    </div>
  )

  const SettingRow = ({ label, checked, onChange, icon }: { label: string; checked: boolean; onChange: (v: boolean) => void; icon: React.ReactNode }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ color: GRAY }}>{icon}</div>
        <span style={{ fontSize: 13, color: '#334155' }}>{label}</span>
      </div>
      <ToggleSwitch checked={checked} onChange={onChange} />
    </div>
  )

  return (
    <div style={{
      background: WHITE, borderRadius: 10, border: '1px solid #e2e8f0',
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

      <div style={{ marginTop: 16, padding: 12, background: '#fffbeb', borderRadius: 8, border: '1px solid #fcd34d' }}>
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
  stats: { unread: number; total: number; byType: Record<string, number> }
}

function StatsPanel({ notifications, stats }: StatsPanelProps) {
  // 今日统计
  const todayStats = useMemo(() => {
    const today = '2026-05-01'
    const todayNotifs = notifications.filter(n => n.sentAt.startsWith(today))
    return {
      total: todayNotifs.length,
      read: todayNotifs.filter(n => n.status === 'read').length,
      unread: todayNotifs.filter(n => n.status === 'unread').length,
      critical: todayNotifs.filter(n => n.type === 'critical_value' && n.status === 'unread').length,
    }
  }, [notifications])

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
      background: WHITE, borderRadius: 10, border: '1px solid #e2e8f0',
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
          <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, textAlign: 'center', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: PRIMARY }}>{todayStats.total}</div>
            <div style={{ fontSize: 12, color: GRAY }}>今日总数</div>
          </div>
          <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, textAlign: 'center', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: SUCCESS }}>{todayStats.read}</div>
            <div style={{ fontSize: 12, color: GRAY }}>已读</div>
          </div>
          <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, textAlign: 'center', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: DANGER }}>{todayStats.unread}</div>
            <div style={{ fontSize: 12, color: GRAY }}>未读</div>
          </div>
          <div style={{ background: '#fef2f2', padding: 12, borderRadius: 8, textAlign: 'center', border: '1px solid #fecaca' }}>
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
                <span style={{ fontSize: 12, color: '#334155' }}>{type.label}</span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {type.unread > 0 && (
                  <span style={{ fontSize: 12, color: DANGER, fontWeight: 600 }}>{type.unread}未读</span>
                )}
                <span style={{ fontSize: 12, color: GRAY }}>{type.count}条</span>
              </div>
            </div>
            <div style={{ background: '#f1f5f9', height: 6, borderRadius: 3, overflow: 'hidden' }}>
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
      background: WHITE, borderRadius: 10, border: '1px solid #e2e8f0',
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
            const typeConfig = NOTIFICATION_TYPES.find(t => t.key === n.type) || NOTIFICATION_TYPES[0]
            return (
              <div
                key={n.id}
                onClick={() => onViewNotification(n)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px',
                  background: '#f8fafc', borderRadius: 6, marginBottom: 4, cursor: 'pointer',
                  border: '1px solid transparent',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = typeConfig.color + '40'
                  e.currentTarget.style.background = typeConfig.color + '08'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'transparent'
                  e.currentTarget.style.background = '#f8fafc'
                }}
              >
                <span style={{ color: typeConfig.color }}>{typeConfig.icon}</span>
                <span style={{ flex: 1, fontSize: 12, color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
    if (!delivery.sent) return { label: '发送中', color: '#6b7280', bg: '#f3f4f6' }
    if (!delivery.delivered) return { label: '发送失败', color: '#dc2626', bg: '#fee2e2' }
    if (delivery.read) return { label: '已阅读', color: '#059669', bg: '#d1fae5' }
    return { label: '已送达', color: '#3b82f6', bg: '#dbeafe' }
  }
  const s = getStatus()
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
      <span style={{ padding: '2px 8px', borderRadius: 4, background: s.bg, color: s.color, fontWeight: 500 }}>{s.label}</span>
      {delivery.retryCount > 0 && <span style={{ color: '#d97706' }}>重试{delivery.retryCount}次</span>}
      <span style={{ color: '#94a3b8' }}>{delivery.channel === 'in-app' ? '应用内' : delivery.channel === 'sms' ? '短信' : '邮件'}</span>
    </div>
  )
}

// ============================================================
// Phase 4b - 规则引擎面板
// ============================================================
function RulesEnginePanel({ rules, onToggle, onDelete }: { rules: NotificationRule[]; onToggle: (id: string) => void; onDelete: (id: string) => void }) {
  const EVENT_LABELS: Record<string, string> = { critical_value: '危急值', report_ready: '报告完成', schedule_change: '排班变更', appointment: '预约', system_alert: '系统告警' }
  return (
    <div style={{ background: WHITE, borderRadius: 10, border: '1px solid #e2e8f0', padding: 16, marginBottom: 16 }}>
      <div style={{ fontWeight: 700, color: PRIMARY, marginBottom: 16, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Zap size={16} />
        通知规则引擎
      </div>
      {rules.map(rule => (
        <div key={rule.id} style={{ padding: '12px 0', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>{rule.name}</span>
              <span style={{ padding: '1px 6px', borderRadius: 4, fontSize: 12, background: rule.priority === 'high' ? '#fef2f2' : '#f8fafc', color: rule.priority === 'high' ? '#dc2626' : '#64748b' }}>
                {rule.priority === 'high' ? '高优先级' : '普通'}
              </span>
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
              事件: {EVENT_LABELS[rule.eventType] || rule.eventType} · 渠道: {rule.actions.map(a => a.channel === 'in-app' ? '应用内' : a.channel === 'sms' ? '短信' : '邮件').join(', ')}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div onClick={() => onToggle(rule.id)} style={{ width: 36, height: 20, borderRadius: 10, background: rule.enabled ? ACCENT : '#e2e8f0', position: 'relative', cursor: 'pointer' }}>
              <div style={{ width: 16, height: 16, borderRadius: '50%', background: WHITE, position: 'absolute', top: 2, left: rule.enabled ? 18 : 2, boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
            </div>
            <button onClick={() => onDelete(rule.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><Trash2 size={14} /></button>
          </div>
        </div>
      ))}
      <div style={{ marginTop: 12, padding: 12, background: '#f8fafc', borderRadius: 6, fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>
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
    <div style={{ background: WHITE, borderRadius: 10, border: '1px solid #e2e8f0', padding: 16 }}>
      <div style={{ fontWeight: 700, color: PRIMARY, marginBottom: 16, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Settings size={16} />
        用户偏好
      </div>
      {/* 免打扰 */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8, fontWeight: 600 }}>免打扰时段</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div onClick={() => onUpdate({ ...preferences, quietHoursEnabled: !preferences.quietHoursEnabled })}
            style={{ width: 36, height: 20, borderRadius: 10, background: preferences.quietHoursEnabled ? ACCENT : '#e2e8f0', position: 'relative', cursor: 'pointer' }}>
            <div style={{ width: 16, height: 16, borderRadius: '50%', background: WHITE, position: 'absolute', top: 2, left: preferences.quietHoursEnabled ? 18 : 2, boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
          </div>
          <span style={{ fontSize: 13, color: '#334155' }}>启用免打扰</span>
        </div>
        {preferences.quietHoursEnabled && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="time" value={preferences.quietHoursStart} onChange={e => onUpdate({ ...preferences, quietHoursStart: e.target.value })}
              style={{ padding: '4px 8px', border: '1px solid #e2e8f0', borderRadius: 4, fontSize: 12 }} />
            <span style={{ color: '#94a3b8' }}>至</span>
            <input type="time" value={preferences.quietHoursEnd} onChange={e => onUpdate({ ...preferences, quietHoursEnd: e.target.value })}
              style={{ padding: '4px 8px', border: '1px solid #e2e8f0', borderRadius: 4, fontSize: 12 }} />
          </div>
        )}
      </div>
      {/* 摘要模式 */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8, fontWeight: 600 }}>摘要模式</div>
        <select value={preferences.digestMode} onChange={e => onUpdate({ ...preferences, digestMode: e.target.value as any })}
          style={{ width: '100%', padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 4, fontSize: 12 }}>
          <option value="none">关闭</option>
          <option value="daily">每日摘要</option>
          <option value="weekly">每周摘要</option>
        </select>
        {preferences.digestMode !== 'none' && (
          <div style={{ marginTop: 8 }}>
            <span style={{ fontSize: 12, color: '#64748b' }}>发送时间：</span>
            <input type="time" value={preferences.digestTime} onChange={e => onUpdate({ ...preferences, digestTime: e.target.value })}
              style={{ padding: '4px 8px', border: '1px solid #e2e8f0', borderRadius: 4, fontSize: 12 }} />
          </div>
        )}
      </div>
      <div style={{ padding: 8, background: '#fffbeb', borderRadius: 6, border: '1px solid #fcd34d', fontSize: 12, color: '#92400e' }}>
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

// ============================================================
// 主页面组件
// ============================================================
export default function NotificationCenter() {
  const mockNotifications = useMemo(() => generateMockNotifications(), [])

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      const res = await userApi.list()
      if (cancelled) return
      if (!res.success) {
        setLoadError('API 不可用，使用本地数据')
      }
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [])

  const [apiNotifications, setApiNotifications] = useState<SystemNotification[]>([])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const res = await notificationApi.getHistory('current', 200)
      if (cancelled) return
      if (res.success && res.data) {
        setApiNotifications(res.data.map((n: NotificationDto) => ({
          id: n.id,
          type: mapNotificationType(n.type),
          title: n.title,
          content: n.content,
          recipientId: n.userId,
          recipientName: n.userId,
          status: n.isRead ? 'read' : 'unread',
          priority: mapSeverityToPriority(n.severity),
          sentAt: n.createdAt,
          readAt: undefined,
          relatedId: n.targetId,
          relatedType: n.type.toLowerCase(),
        })))
      }
    })()
    return () => { cancelled = true }
  }, [])

  const allNotifications = useMemo(
    () => apiNotifications.length > 0 ? apiNotifications : mockNotifications,
    [apiNotifications, mockNotifications],
  )

  const [activeTab, setActiveTab] = useState('all')
  const [searchText, setSearchText] = useState('')
  const [selectedNotification, setSelectedNotification] = useState<SystemNotification | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [notifications, setNotifications] = useState<SystemNotification[]>([])

  useEffect(() => {
    if (allNotifications.length > 0 && notifications.length === 0) {
      setNotifications(allNotifications)
    }
  }, [allNotifications])

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
  const [deliveryStatuses, setDeliveryStatuses] = useState<DeliveryStatus[]>(() => generateDeliveryStatuses(allNotifications))
  const [showDeliveryTracking, setShowDeliveryTracking] = useState(false)

  // Phase 4b - 规则引擎
  const [rules, setRules] = useState<NotificationRule[]>(DEFAULT_RULES)

  // Phase 4b - 用户偏好
  const [userPreferences, setUserPreferences] = useState<UserNotifyPreferences>(DEFAULT_USER_PREFERENCES)
  const [showPreferences, setShowPreferences] = useState(false)

  // Phase 4b - WebSocket 模拟
  const [wsConnected, setWsConnected] = useState(false)
  const [pollingInterval, setPollingInterval] = useState<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    setWsConnected(true)
    const interval = setInterval(() => {
      const newNotif = generateMockNotifications()[0]
      setNotifications(prev => {
        if (prev.some(n => n.id === newNotif.id)) return prev
        const updated = [newNotif, ...prev]
        try {
          const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
          const osc = audioCtx.createOscillator()
          const gain = audioCtx.createGain()
          osc.connect(gain)
          gain.connect(audioCtx.destination)
          osc.frequency.value = 880
          gain.gain.setValueAtTime(0.3, audioCtx.currentTime)
          gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3)
          osc.start(audioCtx.currentTime)
          osc.stop(audioCtx.currentTime + 0.3)
        } catch (e) { console.warn('[F03] Error:', (e as Error)?.message); }
        return updated
      })
    }, 15000)
    setPollingInterval(interval)
    return () => { clearInterval(interval); setWsConnected(false) }
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

  // 统计
  const stats = useMemo(() => {
    const unread = notifications.filter(n => n.status === 'unread').length
    const byType = NOTIFICATION_TYPES.reduce((acc, type) => {
      if (type.key === 'all') return acc
      acc[type.key] = notifications.filter(n => n.type === type.key && n.status === 'unread').length
      return acc
    }, {} as Record<string, number>)
    return { unread, byType, total: notifications.length }
  }, [notifications])

  // 标记已读
  const handleMarkRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n =>
      n.id === id ? { ...n, status: 'read' as const, readAt: new Date().toISOString() } : n
    ))
    void notificationApi.markRead(id)
  }, [])

  // 一键已读
  const handleMarkAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({
      ...n,
      status: 'read' as const,
      readAt: n.readAt || new Date().toISOString(),
    })))
  }, [])

  // 删除通知
  const handleDelete = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
    if (selectedNotification?.id === id) {
      setSelectedNotification(null)
    }
  }, [selectedNotification])

  // 批量删除已读
  const handleClearRead = useCallback(() => {
    setNotifications(prev => prev.filter(n => n.status === 'unread'))
  }, [])

  // 设置更新
  const handleSettingUpdate = useCallback((key: keyof NotificationSettings, value: boolean) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }, [])

  // 样式
  const tabBtnStyle = (key: string) => ({
    padding: '8px 14px', borderRadius: 8, border: 'none',
    background: activeTab === key ? PRIMARY : 'transparent',
    color: activeTab === key ? WHITE : GRAY,
    fontSize: 13, fontWeight: 600, cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s',
  })

  return (
    <div data-testid="notification-center-page" style={{ minHeight: '100vh', background: BG, display: 'flex' }}>
      {loading && <LoadingBanner message="正在从 API 加载通知数据..." />}
      {loadError && !loading && <ErrorBanner message={loadError} />}
      {/* 左侧边栏 */}
      <div style={{
        width: 260, background: WHITE, borderRight: '1px solid #e2e8f0',
        display: 'flex', flexDirection: 'column', height: '100vh', position: 'sticky', top: 0,
      }}>
        {/* 标题 */}
        <div style={{ padding: '16px', borderBottom: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10, background: `${PRIMARY}15`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Bell size={22} color={PRIMARY} />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: PRIMARY }}>通知中心</div>
              <div style={{ fontSize: 12, color: GRAY }}>Notification Center</div>
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
                  color: activeTab === type.key ? type.color : '#334155',
                  fontSize: 13, fontWeight: activeTab === type.key ? 600 : 500,
                  cursor: 'pointer', display: 'flex', alignItems: 'center',
                  justifyContent: 'space-between', marginBottom: 4, transition: 'all 0.15s',
                }}
                onMouseEnter={e => {
                  if (activeTab !== type.key) {
                    e.currentTarget.style.background = '#f1f5f9'
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
        <div style={{ marginTop: 'auto', padding: 12, borderTop: '1px solid #e2e8f0' }}>
          {/* WebSocket状态 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', marginBottom: 8, borderRadius: 6, background: wsConnected ? '#d1fae5' : '#fee2e2' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: wsConnected ? '#059669' : '#dc2626' }} />
            <span style={{ fontSize: 12, color: wsConnected ? '#059669' : '#dc2626', fontWeight: 500 }}>
              {wsConnected ? '实时连接中' : '已断开'}
            </span>
            {!showDeliveryTracking && (
              <button onClick={() => setShowDeliveryTracking(true)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
                <Eye size={12} color={GRAY} />
              </button>
            )}
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
          background: WHITE, borderBottom: '1px solid #e2e8f0', padding: '14px 20px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, background: '#f8fafc',
              padding: '6px 14px', borderRadius: 8, border: '1px solid #e2e8f0',
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
            <button
              onClick={() => setShowDeliveryTracking(!showDeliveryTracking)}
              style={{
                padding: '6px 12px', borderRadius: 6, border: `1px solid ${showDeliveryTracking ? ACCENT : '#e2e8f0'}`,
                background: showDeliveryTracking ? `${ACCENT}15` : WHITE, color: showDeliveryTracking ? ACCENT : GRAY,
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
                background: showSettings ? `${ACCENT}15` : WHITE, color: showSettings ? ACCENT : GRAY,
                fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              <Zap size={14} />
              规则引擎
            </button>
            <button
              onClick={() => setNotifications(allNotifications)}
              style={{
                padding: '6px 12px', borderRadius: 6, border: '1px solid #e2e8f0',
                background: WHITE, color: GRAY, fontSize: 12, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              <RefreshCw size={14} />
              重置
            </button>
          </div>
        </div>

        {/* 主内容区 */}
        <div style={{ display: 'flex', flex: 1 }}>
          {/* 通知列表 */}
          <div style={{ flex: 1, padding: 16, overflowY: 'auto' }}>
            {/* 统计面板 */}
            <StatsPanel notifications={notifications} stats={stats} />
            
            {/* 历史动态 */}
            {!showSettings && <HistoryPanel notifications={notifications} onViewNotification={(n) => { setSelectedNotification(n); setShowDetailModal(true) }} />}

            {filteredNotifications.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: '60px 20px', background: WHITE,
                borderRadius: 10, border: '1px solid #e2e8f0',
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
                        <div style={{ marginTop: 2, padding: '2px 14px 6px', background: '#f8fafc', borderRadius: '0 0 8px 8px', border: '1px solid #e2e8f0', borderTop: 'none' }}>
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
              width: 340, background: BG, borderLeft: '1px solid #e2e8f0',
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
                  <div style={{ background: WHITE, borderRadius: 10, border: '1px solid #e2e8f0', padding: 16, marginBottom: 16 }}>
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
                        <div key={s.label} style={{ textAlign: 'center', padding: 12, background: '#f8fafc', borderRadius: 8 }}>
                          <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
                          <div style={{ fontSize: 12, color: GRAY }}>{s.label}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ maxHeight: 300, overflow: 'auto' }}>
                      {deliveryStatuses.filter(d => !d.read).slice(0, 10).map(d => {
                        const notif = notifications.find(n => n.id === d.notificationId)
                        return (
                          <div key={d.notificationId} style={{ padding: '8px 0', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                            <div>
                              <div style={{ color: '#334155', fontWeight: 500 }}>{notif?.title || d.notificationId}</div>
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
    </div>
  )
}
