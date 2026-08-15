// ════════════════════════════════════════════════════════════════════════════
// [G005 v3.0.6.11-100 Wave 4A] 移动审批中心 (MobileApprovalPage)
//   - 统计卡: 待审 / 已审 / 委派中 / 逾期
//   - 待审批列表: 类型 Tag / 申请人 / 提交时间 / 截止时间 / 逾期红标
//     + 操作: 通过(comment) / 驳回 Modal(reason) / 委派 Modal(toUserId)
//   - 「已审批」Tab: 历史列表 (状态/备注/处理人/时间)
//   - 移动端适配: 响应式卡片布局 (桌面 2 列卡片, <768px 单列)
//   - API: mobileApprovalApi (/mobile-approval/pending|history|stats|approve|reject|delegate)
// ════════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useMemo, useState } from 'react'
import { PageContainer } from '../../components/common/PageContainer'
import { PageHeader } from '../../components/common/PageHeader'
import {
  Inbox, CheckCircle2, UserRoundCog, AlertTriangle, Check, X, Send, Clock,
  CalendarClock, Smartphone, Search, RefreshCw, FileCheck2, BadgeCheck, UserPlus2,
} from 'lucide-react'
import { Tabs, Tag, Button, Modal, Input, message, Empty, Spin, Alert, Select } from 'antd'
import {
  mobileApprovalApi,
  MobileApprovalItem,
  MobileApprovalStats,
  MobileApprovalType,
} from '../../services/api/mobileApprovalApi'

const TYPE_COLORS: Record<MobileApprovalType, string> = {
  报告签发: 'blue',
  报告发布: 'geekblue',
  危急值处置: 'red',
  费用审批: 'gold',
  请假审批: 'purple',
}

const TYPE_ICONS: Record<MobileApprovalType, React.ReactNode> = {
  报告签发: <FileCheck2 size={14} />,
  报告发布: <Send size={14} />,
  危急值处置: <AlertTriangle size={14} />,
  费用审批: <BadgeCheck size={14} />,
  请假审批: <CalendarClock size={14} />,
}

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: '待审批', color: '#3b82f6', bg: '#dbeafe' },
  approved: { label: '已通过', color: '#10b981', bg: '#d1fae5' },
  rejected: { label: '已驳回', color: '#ef4444', bg: '#ffe4e6' },
  delegated: { label: '委派中', color: '#f59e0b', bg: '#fef3c7' },
}

const DELEGATE_OPTIONS = [
  { label: '科主任 (D002)', value: 'D002' },
  { label: '质控组长 (D003)', value: 'D003' },
  { label: '值班医生 (D1005)', value: 'D1005' },
  { label: '王医生 (D1002)', value: 'D1002' },
  { label: '李医生 (D1001)', value: 'D1001' },
]

function useIsMobile(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < breakpoint)
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < breakpoint)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [breakpoint])
  return isMobile
}

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '-'
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function isOverdue(item: MobileApprovalItem): boolean {
  return (item.status === 'pending' || item.status === 'delegated') && new Date(item.dueAt) < new Date()
}

export default function MobileApprovalPage() {
  const isMobile = useIsMobile()
  const [activeTab, setActiveTab] = useState('pending')
  const [pending, setPending] = useState<MobileApprovalItem[]>([])
  const [history, setHistory] = useState<MobileApprovalItem[]>([])
  const [stats, setStats] = useState<MobileApprovalStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')

  // 通过 / 驳回 / 委派 弹窗状态
  const [acting, setActing] = useState<MobileApprovalItem | null>(null)
  const [modalKind, setModalKind] = useState<'approve' | 'reject' | 'delegate'>('approve')
  const [comment, setComment] = useState('')
  const [reason, setReason] = useState('')
  const [toUserId, setToUserId] = useState('D1005')
  const [submitting, setSubmitting] = useState(false)

  const loadAll = useCallback(async () => {
    setLoading(true)
    const [p, h, s] = await Promise.allSettled([
      mobileApprovalApi.listPending(),
      mobileApprovalApi.listHistory(),
      mobileApprovalApi.getStats(),
    ])
    if (p.status === 'fulfilled') setPending(p.value)
    if (h.status === 'fulfilled') setHistory(h.value)
    if (s.status === 'fulfilled') setStats(s.value)
    setLoading(false)
  }, [])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  const filteredPending = useMemo(() => {
    const kw = search.trim().toLowerCase()
    return pending.filter((i) => {
      if (typeFilter !== 'all' && i.type !== typeFilter) return false
      if (!kw) return true
      return (
        i.title.toLowerCase().includes(kw) ||
        i.applicant.toLowerCase().includes(kw) ||
        i.assignee.toLowerCase().includes(kw) ||
        i.type.includes(kw)
      )
    })
  }, [pending, search, typeFilter])

  const openAction = (item: MobileApprovalItem, kind: 'approve' | 'reject' | 'delegate') => {
    setActing(item)
    setModalKind(kind)
    setComment('')
    setReason('')
    setToUserId('D1005')
  }

  const handleSubmit = async () => {
    if (!acting) return
    setSubmitting(true)
    try {
      if (modalKind === 'approve') {
        await mobileApprovalApi.approve(acting.id, comment.trim() || undefined)
        message.success(`已通过「${acting.title}」`)
      } else if (modalKind === 'reject') {
        if (!reason.trim()) {
          message.warning('请填写驳回原因')
          setSubmitting(false)
          return
        }
        await mobileApprovalApi.reject(acting.id, reason.trim())
        message.success(`已驳回「${acting.title}」`)
      } else {
        await mobileApprovalApi.delegate(acting.id, toUserId.trim())
        message.success(`已委派「${acting.title}」给 ${toUserId}`)
      }
      setActing(null)
      void loadAll()
    } catch (e) {
      message.error((e as Error).message ?? '操作失败')
    } finally {
      setSubmitting(false)
    }
  }

  const statCards = useMemo(() => {
    const cards = [
      { key: 'pending', label: '待审批', value: stats?.pending ?? pending.filter((i) => i.status === 'pending').length, color: '#3b82f6', bg: '#dbeafe', icon: <Inbox size={18} /> },
      { key: 'approved', label: '已审批', value: stats ? stats.approved + stats.rejected : history.length, color: '#10b981', bg: '#d1fae5', icon: <CheckCircle2 size={18} /> },
      { key: 'delegated', label: '委派中', value: stats?.delegated ?? pending.filter((i) => i.status === 'delegated').length, color: '#f59e0b', bg: '#fef3c7', icon: <UserRoundCog size={18} /> },
      { key: 'overdue', label: '逾期', value: stats?.overdue ?? pending.filter(isOverdue).length, color: '#ef4444', bg: '#ffe4e6', icon: <AlertTriangle size={18} /> },
    ]
    return cards
  }, [stats, pending, history])

  const renderDetail = (item: MobileApprovalItem) => {
    const rows = Object.entries(item.detail ?? {})
    if (rows.length === 0) return null
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', marginTop: 6 }}>
        {rows.map(([k, v]) => (
          <span key={k} style={{ fontSize: 11, color: '#64748b' }}>
            <span style={{ color: '#94a3b8' }}>{k}:</span> {String(v ?? '-')}
          </span>
        ))}
      </div>
    )
  }

  const renderActions = (item: MobileApprovalItem) => (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      <Button size="small" type="primary" icon={<Check size={12} />} onClick={() => openAction(item, 'approve')}>通过</Button>
      <Button size="small" danger icon={<X size={12} />} onClick={() => openAction(item, 'reject')}>驳回</Button>
      <Button size="small" icon={<UserPlus2 size={12} />} onClick={() => openAction(item, 'delegate')}>委派</Button>
    </div>
  )

  const renderStatusTag = (item: MobileApprovalItem) => {
    const s = STATUS_LABELS[item.status] ?? STATUS_LABELS.pending!
    return (
      <Tag color="default" style={{ margin: 0, background: s.bg, color: s.color, borderColor: s.bg, fontWeight: 600, fontSize: 11 }}>
        {s.label}
        {item.status === 'delegated' && item.delegatedTo ? ` → ${item.delegatedTo}` : ''}
      </Tag>
    )
  }

  const renderCard = (item: MobileApprovalItem) => (
    <div
      key={item.id}
      style={{
        background: 'var(--bg-card)', borderRadius: 12, padding: 16,
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: isOverdue(item) ? '1px solid #fecaca' : '1px solid #e2e8f0',
        display: 'flex', flexDirection: 'column', gap: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <Tag color={TYPE_COLORS[item.type] ?? 'default'} icon={TYPE_ICONS[item.type]} style={{ margin: 0, flexShrink: 0 }}>{item.type}</Tag>
        {renderStatusTag(item)}
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b', lineHeight: 1.45 }}>{item.title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12, color: '#64748b' }}>
        <span>申请人: <b style={{ color: '#334155' }}>{item.applicant}</b></span>
        <span>提交: {fmtTime(item.submittedAt)} · 归属: {item.assignee}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Clock size={12} />截止: {fmtTime(item.dueAt)}
          {isOverdue(item) && (
            <span style={{ color: '#dc2626', fontWeight: 700, background: '#fee2e2', padding: '0 6px', borderRadius: 4, fontSize: 11 }}>已逾期</span>
          )}
        </span>
      </div>
      {renderDetail(item)}
      {item.status === 'delegated' && (
        <Alert type="warning" showIcon style={{ padding: '4px 10px', fontSize: 11 }} message={`已委派给 ${item.delegatedTo ?? '-'} 处理, 待受托人操作`} />
      )}
      <div style={{ marginTop: 'auto', paddingTop: 6 }}>{renderActions(item)}</div>
    </div>
  )

  const renderHistoryCard = (item: MobileApprovalItem) => (
    <div
      key={item.id}
      style={{
        background: 'var(--bg-card)', borderRadius: 12, padding: 16,
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0',
        display: 'flex', flexDirection: 'column', gap: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <Tag color={TYPE_COLORS[item.type] ?? 'default'} icon={TYPE_ICONS[item.type]} style={{ margin: 0 }}>{item.type}</Tag>
        {renderStatusTag(item)}
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b', lineHeight: 1.45 }}>{item.title}</div>
      <div style={{ fontSize: 12, color: '#64748b', display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span>申请人: <b style={{ color: '#334155' }}>{item.applicant}</b> · 提交: {fmtTime(item.submittedAt)}</span>
        <span>处理人: {item.processedBy ?? '-'} · 处理时间: {fmtTime(item.processedAt)}</span>
        {item.comment && (
          <span style={{ color: '#059669', background: '#ecfdf5', padding: '4px 8px', borderRadius: 6 }}>备注: {item.comment}</span>
        )}
        {item.reason && (
          <span style={{ color: '#dc2626', background: '#fef2f2', padding: '4px 8px', borderRadius: 6 }}>驳回原因: {item.reason}</span>
        )}
      </div>
      {renderDetail(item)}
    </div>
  )

  return (
    <PageContainer background="slate" maxWidth="wide">
      <PageHeader
        icon={<Smartphone size={20} color="#3b82f6" />}
        title="移动审批"
        subtitle="待办审批 · 报告签发 / 发布 / 危急值处置 / 费用 / 请假 — 支持通过 / 驳回 / 委派"
      />
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* 统计卡 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
          {statCards.map((card) => (
            <div key={card.key} style={{ background: 'var(--bg-card)', borderRadius: 10, padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: card.bg, color: card.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{card.icon}</div>
              <div>
                <div style={{ fontSize: 12, color: '#64748b' }}>{card.label}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: card.color }}>{card.value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* 类型分布 */}
        {stats && (
          <div style={{ background: 'var(--bg-card)', borderRadius: 10, padding: '12px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>待办分布:</span>
            {stats.byType.map((t) => (
              <Tag key={t.type} color={TYPE_COLORS[t.type] ?? 'default'} style={{ margin: 0 }}>{t.type} {t.count}</Tag>
            ))}
            <span style={{ marginLeft: 'auto', fontSize: 11, color: '#94a3b8' }}>数据源: mobile-approval (报告/危急值/费用/请假 派生 + seed)</span>
          </div>
        )}

        {/* Tabs 主区 */}
        <div style={{ background: 'var(--bg-card)', borderRadius: 10, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={[
              {
                key: 'pending',
                label: `待审批 (${pending.filter((i) => i.status === 'pending' || i.status === 'delegated').length})`,
                children: (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
                        <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', zIndex: 1 }} />
                        <Input
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          placeholder="检索标题 / 申请人 / 归属"
                          size="small"
                          style={{ paddingLeft: 30 }}
                        />
                      </div>
                      <Select
                        value={typeFilter}
                        onChange={setTypeFilter}
                        size="small"
                        style={{ width: 140 }}
                        options={[{ label: '全部类型', value: 'all' }, ...(Object.keys(TYPE_COLORS) as MobileApprovalType[]).map((t) => ({ label: t, value: t }))]}
                      />
                      <Button size="small" icon={<RefreshCw size={12} />} onClick={() => void loadAll()} loading={loading}>刷新</Button>
                    </div>
                    {loading && pending.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: 48 }}><Spin /></div>
                    ) : filteredPending.length === 0 ? (
                      <Empty description="暂无待审批事项" style={{ padding: 32 }} />
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(420px, 1fr))', gap: 12 }}>
                        {filteredPending.map(renderCard)}
                      </div>
                    )}
                  </div>
                ),
              },
              {
                key: 'history',
                label: `已审批 (${history.length})`,
                children: (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <Alert
                      type="info"
                      showIcon
                      style={{ padding: '6px 12px', fontSize: 12 }}
                      message={`共 ${history.length} 条处理记录: 通过 ${history.filter((i) => i.status === 'approved').length} · 驳回 ${history.filter((i) => i.status === 'rejected').length}`}
                    />
                    {loading && history.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: 48 }}><Spin /></div>
                    ) : history.length === 0 ? (
                      <Empty description="暂无已审批记录" style={{ padding: 32 }} />
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(420px, 1fr))', gap: 12 }}>
                        {history.map(renderHistoryCard)}
                      </div>
                    )}
                  </div>
                ),
              },
            ]}
          />
        </div>

        {/* 数据源徽标 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#64748b', padding: '0 4px' }}>
          <Tag color="blue" style={{ margin: 0 }}>数据源</Tag>
          <span>后端 /mobile-approval (内存 seed + 报告/危急值派生) · MSW 同步 mock · 逾期按截止时间自动红标</span>
        </div>
      </div>

      {/* 通过 / 驳回 / 委派 Modal */}
      <Modal
        title={acting ? `${modalKind === 'approve' ? '通过' : modalKind === 'reject' ? '驳回' : '委派'}: ${acting.title}` : ''}
        open={!!acting}
        onOk={() => void handleSubmit()}
        onCancel={() => setActing(null)}
        okText={modalKind === 'approve' ? '确认通过' : modalKind === 'reject' ? '确认驳回' : '确认委派'}
        cancelText="取消"
        confirmLoading={submitting}
        okButtonProps={modalKind === 'reject' ? { danger: true } : undefined}
        width={520}
      >
        {acting && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#475569' }}>
              <Tag color={TYPE_COLORS[acting.type] ?? 'default'} icon={TYPE_ICONS[acting.type]} style={{ margin: 0 }}>{acting.type}</Tag>
              <span>{acting.applicant} · 提交于 {fmtTime(acting.submittedAt)}</span>
            </div>
            {modalKind === 'approve' && (
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>审批意见 (可选)</div>
                <Input.TextArea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                  placeholder="如: 报告完整, 同意签发"
                  maxLength={500}
                  showCount
                />
              </div>
            )}
            {modalKind === 'reject' && (
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>驳回原因 <span style={{ color: '#dc2626' }}>*</span></div>
                <Input.TextArea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  placeholder="请说明驳回原因, 将回退给申请人"
                  maxLength={500}
                  showCount
                />
              </div>
            )}
            {modalKind === 'delegate' && (
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>委派给 <span style={{ color: '#dc2626' }}>*</span></div>
                <Select
                  value={toUserId}
                  onChange={setToUserId}
                  style={{ width: '100%' }}
                  options={DELEGATE_OPTIONS}
                  showSearch
                  optionFilterProp="label"
                />
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>委派后事项保留在待办列表, 标记为「委派中」, 由受托人处理</div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </PageContainer>
  )
}
