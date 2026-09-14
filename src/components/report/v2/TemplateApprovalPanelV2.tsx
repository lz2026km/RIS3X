/**
 * [G005 v3.0.6.11-101 Wave 6C] 模板审批流 V2 面板 (F7)
 * 能力: 模板列表 + 状态标签 + 提交审批/审批操作 (通过/驳回/发布) + 版本历史 + 审批记录
 * 状态机: 草稿 → 提交审批 → 审批中 → 通过/驳回 → 发布 (非法流转后端拒绝)
 * 数据源: templateApprovalApi (后端孤儿模块 + seed 回退)
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Card, Table, Tag, Space, Row, Col, Statistic, Button, Input, Select, Modal,
  message, Empty, Tooltip, Timeline, Segmented, Drawer,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  FileCheck2, History, RefreshCw, Search, Send, CheckCircle2, XCircle,
  Rocket, Bookmark, Eye, FileText, ClipboardCheck, Star, Pencil,
} from 'lucide-react'
import {
  templateApprovalApi,
  type ReportTemplateV2,
  type TemplateVersionV2,
  type TemplateApprovalRecordV2,
  type TemplateStateV2,
  type TemplateApprovalStatsV2,
} from '../../../services/api/templateApprovalApi'
import { t } from '../../../i18n/appI18n'

const { TextArea } = Input

const STATE_META: Record<TemplateStateV2, { color: string; label: string; bg: string }> = {
  draft: { color: '#64748b', label: t('templateApproval.state.draft'), bg: 'var(--bg-secondary, #f1f5f9)' },
  pending: { color: '#f59e0b', label: t('templateApproval.state.pending'), bg: 'var(--color-warning-bg)' },
  approved: { color: '#3b82f6', label: t('templateApproval.state.approved'), bg: 'var(--color-info-bg)' },
  rejected: { color: '#dc2626', label: t('templateApproval.state.rejected'), bg: 'var(--color-error-bg)' },
  published: { color: '#10b981', label: t('templateApproval.state.published'), bg: 'var(--color-success-bg)' },
}

const ACTION_LABEL: Record<string, string> = {
  submit: t('templateApproval.action.submit'),
  approve: t('templateApproval.action.approve'),
  reject: t('templateApproval.action.reject'),
  publish: t('templateApproval.action.publish'),
  rework: t('templateApproval.action.rework'),
}

const ACTION_COLOR: Record<string, string> = {
  submit: 'blue',
  approve: 'green',
  reject: 'red',
  publish: 'purple',
  rework: 'orange',
}

function formatDateTime(iso?: string): string {
  if (!iso) return '-'
  const d = new Date(iso)
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export interface TemplateApprovalPanelV2Props {
  compact?: boolean
  defaultTab?: string
}

const TemplateApprovalPanelV2: React.FC<TemplateApprovalPanelV2Props> = ({ compact = false, defaultTab = 'templates' }) => {
  const [tab, setTab] = useState(defaultTab)
  const [templates, setTemplates] = useState<ReportTemplateV2[]>([])
  const [stats, setStats] = useState<TemplateApprovalStatsV2 | null>(null)
  const [loading, setLoading] = useState(true)
  const [keyword, setKeyword] = useState('')
  const [stateFilter, setStateFilter] = useState<TemplateStateV2>()
  const [selectedId, setSelectedId] = useState<string>()
  const [versions, setVersions] = useState<TemplateVersionV2[]>([])
  const [approvals, setApprovals] = useState<TemplateApprovalRecordV2[]>([])
  const [historyOpen, setHistoryOpen] = useState(false)

  // 操作弹窗
  const [actionModal, setActionModal] = useState<{ template: ReportTemplateV2; kind: 'submit' | 'approve' | 'reject' | 'publish' | 'create' } | null>(null)
  const [actionComment, setActionComment] = useState('')
  const [actionName, setActionName] = useState('')
  const [actionCategory, setActionCategory] = useState('CT')
  const [actionBodyPart, setActionBodyPart] = useState('')
  const [actionContent, setActionContent] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [tplRes, s] = await Promise.allSettled([
        templateApprovalApi.listTemplates(),
        templateApprovalApi.stats(),
      ])
      if (tplRes.status === 'fulfilled' && tplRes.value.success) {
        setTemplates(tplRes.value.data ?? [])
        if (!selectedId && (tplRes.value.data ?? []).length > 0) setSelectedId(tplRes.value.data![0]!.id)
      }
      if (s.status === 'fulfilled' && s.value.success) setStats(s.value.data)
    } catch {
      message.error(t('templateApproval.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [selectedId])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  const loadDetail = useCallback(async (id: string) => {
    const [v, a] = await Promise.allSettled([
      templateApprovalApi.getVersions(id),
      templateApprovalApi.getApprovals(id),
    ])
    if (v.status === 'fulfilled' && v.value.success) setVersions(v.value.data ?? [])
    if (a.status === 'fulfilled' && a.value.success) setApprovals(a.value.data ?? [])
  }, [])

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId)
  }, [selectedId, loadDetail])

  const filtered = useMemo(() => {
    let list = templates
    if (stateFilter) list = list.filter((tpl) => tpl.state === stateFilter)
    if (keyword.trim()) {
      const q = keyword.trim().toLowerCase()
      list = list.filter((tpl) => tpl.name.toLowerCase().includes(q) || tpl.content.toLowerCase().includes(q))
    }
    return list
  }, [templates, stateFilter, keyword])

  const selected = useMemo(() => templates.find((tpl) => tpl.id === selectedId), [templates, selectedId])

  const columns: ColumnsType<ReportTemplateV2> = [
    { title: t('templateApproval.col.name'), dataIndex: 'name', width: 200, render: (v: string, row) => (
        <Space size={4}>
          <FileText size={13} color="#64748b" />
          <span>{v}</span>
          {row.favoriteCount > 0 && <Star size={12} color="#f59e0b" fill="#f59e0b" />}
        </Space>
      ) },
    { title: t('templateApproval.col.category'), dataIndex: 'category', width: 70, render: (v: string) => <Tag>{v}</Tag> },
    { title: t('templateApproval.col.modality'), dataIndex: 'modality', width: 60, render: (v?: string) => v ?? '-' },
    { title: t('templateApproval.col.bodyPart'), dataIndex: 'bodyPart', width: 80 },
    { title: t('templateApproval.col.version'), dataIndex: 'version', width: 60, render: (v: number) => <Tag color="blue">v{v}</Tag> },
    { title: t('templateApproval.col.state'), dataIndex: 'state', width: 90, render: (v: TemplateStateV2) => {
        const m = STATE_META[v]
        return <Tag color={m.color} style={{ fontWeight: 600 }}>{m.label}</Tag>
      } },
    { title: t('templateApproval.col.assignee'), width: 100, render: (_, row) => row.assignee ? (
        <Space size={4}>
          <ClipboardCheck size={12} color="#7c3aed" />
          <span>{row.assignee.approverName}</span>
        </Space>
      ) : '-' },
    { title: t('templateApproval.col.favorite'), dataIndex: 'favoriteCount', width: 60, align: 'center' as const },
    { title: t('templateApproval.col.usage'), dataIndex: 'usageCount', width: 60, align: 'center' as const },
    { title: t('templateApproval.col.action'), width: 230, fixed: 'right' as const, render: (_, row) => (
        <Space size={4} wrap>
          {row.state === 'draft' && (
            <Button size="small" type="primary" icon={<Send size={11} />} onClick={() => { setActionModal({ template: row, kind: 'submit' }); setActionComment('') }}>
              {t('templateApproval.action.submit')}
            </Button>
          )}
          {row.state === 'pending' && (
            <>
              <Button size="small" type="primary" icon={<CheckCircle2 size={11} />} onClick={() => { setActionModal({ template: row, kind: 'approve' }); setActionComment('') }}>
                {t('templateApproval.approve')}
              </Button>
              <Button size="small" danger icon={<XCircle size={11} />} onClick={() => { setActionModal({ template: row, kind: 'reject' }); setActionComment('') }}>
                {t('templateApproval.reject')}
              </Button>
            </>
          )}
          {row.state === 'approved' && (
            <Button size="small" type="primary" icon={<Rocket size={11} />} onClick={() => { setActionModal({ template: row, kind: 'publish' }); setActionComment('') }}>
              {t('templateApproval.action.publish')}
            </Button>
          )}
          <Tooltip title={t('templateApproval.versionHistoryTip')}>
            <Button size="small" icon={<History size={11} />} onClick={() => { setSelectedId(row.id); setHistoryOpen(true); void loadDetail(row.id) }} />
          </Tooltip>
          {row.state !== 'published' && (
            <Tooltip title={t('templateApproval.favoriteTip')}>
              <Button size="small" icon={<Bookmark size={11} />} onClick={async () => {
                const res = await templateApprovalApi.toggleFavorite(row.id, 'u-001')
                if (res.success) message.success(res.data?.favorite ? t('templateApproval.favorited') : t('templateApproval.unfavorited'))
                await loadAll()
              }} />
            </Tooltip>
          )}
        </Space>
      ) },
  ]

  const executeAction = async () => {
    if (!actionModal) return
    const { template, kind } = actionModal
    setSubmitting(true)
    try {
      let res
      if (kind === 'submit') res = await templateApprovalApi.submit(template.id, { submittedBy: '当前用户', comment: actionComment || undefined })
      if (kind === 'approve') res = await templateApprovalApi.approve(template.id, { approvedBy: '当前用户', comment: actionComment || undefined })
      if (kind === 'reject') {
        if (!actionComment.trim()) {
          message.warning(t('templateApproval.rejectReasonRequired'))
          setSubmitting(false)
          return
        }
        res = await templateApprovalApi.reject(template.id, { rejectedBy: '当前用户', reason: actionComment.trim() })
      }
      if (kind === 'publish') res = await templateApprovalApi.publish(template.id, { publishedBy: '当前用户', comment: actionComment || undefined })
      if (res && res.success) {
        message.success(t('templateApproval.actionSuccess', { action: ACTION_LABEL[kind], version: res.data?.version ?? '' }))
        setActionModal(null)
        await loadAll()
      } else {
        message.error(res?.error?.message ?? t('templateApproval.actionRejected'))
      }
    } catch {
      message.error(t('templateApproval.actionFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  const createTemplate = async () => {
    if (!actionName.trim()) {
      message.warning(t('templateApproval.nameRequired'))
      return
    }
    if (!actionContent.trim()) {
      message.warning(t('templateApproval.contentRequired'))
      return
    }
    setSubmitting(true)
    try {
      const res = await templateApprovalApi.createTemplate({
        name: actionName.trim(),
        category: actionCategory,
        bodyPart: actionBodyPart || '通用',
        content: actionContent.trim(),
        createdBy: '当前用户',
      })
      if (res.success) {
        message.success(t('templateApproval.draftCreated'))
        setActionModal(null)
        setActionName('')
        setActionContent('')
        await loadAll()
      } else {
        message.error(res.error?.message ?? t('templateApproval.createFailed'))
      }
    } finally {
      setSubmitting(false)
    }
  }

  const versionTimeline = useMemo(
    () => versions.map((v) => ({
      color: v.version === versions[0]?.version ? 'blue' : 'gray',
      children: (
        <div>
          <Space>
            <Tag color="blue">v{v.version}</Tag>
            <strong>{v.note}</strong>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>{v.changedBy} · {formatDateTime(v.at)}</span>
          </Space>
          <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>{v.content}</div>
        </div>
      ),
    })),
    [versions],
  )

  const approvalTimeline = useMemo(
    () => approvals.map((a) => ({
      color: ACTION_COLOR[a.action] ?? 'gray',
      children: (
        <div>
          <Space>
            <Tag color={ACTION_COLOR[a.action] ?? 'default'}>{ACTION_LABEL[a.action] ?? a.action}</Tag>
            <strong>{a.actorName}</strong>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>{formatDateTime(a.at)}</span>
          </Space>
          {a.comment && <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>{a.comment}</div>}
        </div>
      ),
    })),
    [approvals],
  )

  const headerItems = [
    { title: t('templateApproval.header.total'), value: stats?.total ?? '-', color: '#fff', prefix: <FileText size={14} /> },
    { title: t('templateApproval.state.pending'), value: stats?.pendingCount ?? '-', color: '#fcd34d', prefix: <ClipboardCheck size={14} /> },
    { title: t('templateApproval.state.published'), value: stats?.publishedCount ?? '-', color: '#bbf7d0', prefix: <Rocket size={14} /> },
    { title: t('templateApproval.header.totalVersions'), value: stats?.totalVersions ?? '-', color: '#fff', prefix: <History size={14} /> },
    ...(compact ? [] : [
      { title: t('templateApproval.header.avgApprovalHours'), value: stats?.avgApprovalHours ?? '-', color: '#fff', prefix: <FileCheck2 size={14} /> },
      { title: t('templateApproval.header.totalFavorites'), value: stats?.totalFavorites ?? '-', color: '#fde68a', prefix: <Star size={14} /> },
      { title: t('templateApproval.header.totalUsage'), value: stats?.totalUsage ?? '-', color: '#bbf7d0', prefix: <Eye size={14} /> },
    ]),
  ]

  return (
    <div data-testid="template-approval-panel-v2" role="region" aria-label={t('templateApproval.panelAria')}>
      <div style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #1e1b4b 100%)', color: '#fff', padding: '12px 16px', borderRadius: 8, marginBottom: 12 }}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <FileCheck2 size={18} />
            <strong style={{ fontSize: 16 }}>{t('templateApproval.title')}</strong>
            <Tag color="purple">Wave 6C · F7</Tag>
            <Tag color="cyan">{t('templateApproval.subtitle')}</Tag>
          </Space>
          <Space>
            <Button size="small" ghost type="dashed" icon={<Pencil size={12} />} onClick={() => { setActionModal({ template: {} as ReportTemplateV2, kind: 'create' }); setActionName(''); setActionCategory('CT'); setActionBodyPart(''); setActionContent('') }}>
              {t('templateApproval.newDraft')}
            </Button>
            <Tooltip title={t('templateApproval.refresh')}>
              <Button size="small" ghost icon={<RefreshCw size={12} />} onClick={() => void loadAll()}>
                {t('templateApproval.refresh')}
              </Button>
            </Tooltip>
          </Space>
        </Space>
        <Row gutter={12} style={{ marginTop: 12 }}>
          {headerItems.map((s) => (
            <Col span={compact ? 6 : 24 / headerItems.length} key={s.title}>
              <Statistic title={<span style={{ color: '#fff' }}>{s.title}</span>} value={s.value} styles={{ content: { color: s.color, fontSize: 18 } }} prefix={s.prefix} />
            </Col>
          ))}
        </Row>
      </div>

      <Segmented
        block value={tab}
        onChange={(v) => setTab(String(v))}
        options={[
          { label: t('templateApproval.tab.templates'), value: 'templates' },
          { label: t('templateApproval.tab.history'), value: 'history' },
        ]}
        style={{ marginBottom: 12 }}
      />

      {tab === 'templates' && (
        <Card size="small" title={<Space><ClipboardCheck size={14} color="#4f46e5" />{t('templateApproval.templateList')}</Space>} extra={<Tag color="blue">{t('templateApproval.countSuffix', { count: filtered.length })}</Tag>}>
          <Space wrap style={{ marginBottom: 12 }}>
            <Input allowClear prefix={<Search size={12} />} placeholder={t('templateApproval.searchPlaceholder')} style={{ width: 240 }} value={keyword} onChange={(e) => setKeyword(e.target.value)} />
            <Select
              allowClear placeholder={t('templateApproval.filterByState')} style={{ width: 140 }} value={stateFilter}
              onChange={(v) => setStateFilter(v)}
              options={(Object.keys(STATE_META) as TemplateStateV2[]).map((s) => ({ label: STATE_META[s].label, value: s }))}
            />
          </Space>
          <Table
            rowKey="id" size="small" loading={loading} dataSource={filtered} columns={columns}
            pagination={{ pageSize: 8, showSizeChanger: false, showTotal: (total) => t('templateApproval.showTotal', { count: total }) }}
            scroll={{ x: 'max-content' }}
            locale={{ emptyText: <Empty description={t('templateApproval.noTemplates')} /> }}
          />
        </Card>
      )}

      {tab === 'history' && (
        <Row gutter={12}>
          <Col span={10}>
            <Card size="small" title={<Space><History size={14} color="#4f46e5" />{t('templateApproval.selectTemplate')}</Space>}>
              <Table
                rowKey="id" size="small" loading={loading} dataSource={templates} columns={[
                  { title: t('templateApproval.col.name'), dataIndex: 'name', ellipsis: true },
                  { title: t('templateApproval.col.state'), dataIndex: 'state', width: 90, render: (v: TemplateStateV2) => <Tag color={STATE_META[v]?.color}>{STATE_META[v]?.label}</Tag> },
                  { title: t('templateApproval.col.version'), dataIndex: 'version', width: 70, render: (v: number) => `v${v}` },
                ]}
                pagination={{ pageSize: 6, showSizeChanger: false }}
                onRow={(record) => ({ onClick: () => { setSelectedId(record.id); void loadDetail(record.id) }, style: { cursor: 'pointer' } })}
                rowClassName={(record) => (record.id === selectedId ? 'ant-table-row-selected' : '')}
              />
            </Card>
          </Col>
          <Col span={14}>
            {!selected ? (
              <Card size="small"><Empty description={t('templateApproval.selectTemplateHint')} /></Card>
            ) : (
              <>
                <Card size="small" title={<Space><History size={14} color="#4f46e5" />{t('templateApproval.versionHistory', { name: selected.name })}</Space>} style={{ marginBottom: 12 }}>
                  <Space direction="vertical" size={4} style={{ width: '100%', maxHeight: 260, overflowY: 'auto' }}>
                    <Timeline items={versionTimeline} />
                  </Space>
                </Card>
                <Card size="small" title={<Space><ClipboardCheck size={14} color="#4f46e5" />{t('templateApproval.approvalRecords', { name: selected.name })}</Space>}>
                  <Space direction="vertical" size={4} style={{ width: '100%', maxHeight: 260, overflowY: 'auto' }}>
                    {approvalTimeline.length === 0 ? <Empty description={t('templateApproval.noApprovalRecords')} /> : <Timeline items={approvalTimeline} />}
                  </Space>
                </Card>
              </>
            )}
          </Col>
        </Row>
      )}

      <div style={{ fontSize: 12, color: '#94a3b8', padding: '8px 0' }}>
        {t('templateApproval.footer')}
      </div>

      <Drawer
        title={selected ? t('templateApproval.versionHistory', { name: selected.name }) : t('templateApproval.versionHistoryTitle')}
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        width={480}
      >
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          {versionTimeline.map((_, i) => (
            <div key={i} style={{ border: '1px solid var(--border-color, #e2e8f0)', borderRadius: 6, padding: 8 }}>
              <Space>
                <Tag color="blue">v{versions[i]?.version}</Tag>
                <strong>{versions[i]?.note}</strong>
                <span style={{ fontSize: 12, color: '#94a3b8' }}>{versions[i]?.changedBy} · {formatDateTime(versions[i]?.at)}</span>
              </Space>
              <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>{versions[i]?.content}</div>
            </div>
          ))}
          {versions.length === 0 && <Empty description={t('templateApproval.noVersions')} />}
        </Space>
      </Drawer>

      <Modal
        title={
          actionModal?.kind === 'create' ? t('templateApproval.modal.createTitle')
            : actionModal?.kind === 'submit' ? t('templateApproval.modal.submitTitle', { name: actionModal?.template.name })
            : actionModal?.kind === 'approve' ? t('templateApproval.modal.approveTitle', { name: actionModal?.template.name })
            : actionModal?.kind === 'reject' ? t('templateApproval.modal.rejectTitle', { name: actionModal?.template.name })
            : actionModal?.kind === 'publish' ? t('templateApproval.modal.publishTitle', { name: actionModal?.template.name })
            : t('templateApproval.modal.actionTitle')
        }
        open={!!actionModal}
        onCancel={() => setActionModal(null)}
        onOk={() => void (actionModal?.kind === 'create' ? createTemplate() : executeAction())}
        okText={actionModal?.kind === 'reject' ? t('templateApproval.confirmReject') : actionModal?.kind === 'create' ? t('templateApproval.create') : t('templateApproval.confirm')}
        cancelText={t('templateApproval.cancel')}
        confirmLoading={submitting}
      >
        {actionModal?.kind === 'create' ? (
          <Space direction="vertical" style={{ width: '100%' }} size={8}>
            <div>
              <div style={{ fontSize: 12, marginBottom: 4 }}>{t('templateApproval.form.name')}</div>
              <Input placeholder={t('templateApproval.form.namePlaceholder')} value={actionName} onChange={(e) => setActionName(e.target.value)} />
            </div>
            <Row gutter={8}>
              <Col span={12}>
                <div style={{ fontSize: 12, marginBottom: 4 }}>{t('templateApproval.form.category')}</div>
                <Select style={{ width: '100%' }} value={actionCategory} onChange={(v) => setActionCategory(v)} options={['CT', 'MR', 'DR', 'MG', 'US', 'PET'].map((c) => ({ label: c, value: c }))} />
              </Col>
              <Col span={12}>
                <div style={{ fontSize: 12, marginBottom: 4 }}>{t('templateApproval.form.bodyPart')}</div>
                <Input placeholder={t('templateApproval.form.bodyPartPlaceholder')} value={actionBodyPart} onChange={(e) => setActionBodyPart(e.target.value)} />
              </Col>
            </Row>
            <div>
              <div style={{ fontSize: 12, marginBottom: 4 }}>{t('templateApproval.form.content')}</div>
              <TextArea rows={4} placeholder={t('templateApproval.form.contentPlaceholder')} value={actionContent} onChange={(e) => setActionContent(e.target.value)} />
            </div>
          </Space>
        ) : (
          <Space direction="vertical" style={{ width: '100%' }}>
            <div style={{ fontSize: 13 }}>
              <Tag color={STATE_META[actionModal?.template.state as TemplateStateV2]?.color}>{STATE_META[actionModal?.template.state as TemplateStateV2]?.label}</Tag>
              v{actionModal?.template.version} · {actionModal?.template.category}/{actionModal?.template.bodyPart}
              {actionModal?.template.assignee && (
                <div style={{ marginTop: 4, fontSize: 12, color: '#64748b' }}>
                  {t('templateApproval.assigneeLabel')} {actionModal.template.assignee.approverName} ({actionModal.template.assignee.dept} · {actionModal.template.assignee.role})
                </div>
              )}
            </div>
            <div style={{ background: 'var(--bg-secondary, #f8fafc)', borderRadius: 6, padding: 8, fontSize: 12, color: '#475569', maxHeight: 120, overflowY: 'auto' }}>
              {actionModal?.template.content}
            </div>
            <div>
              <div style={{ fontSize: 12, marginBottom: 4 }}>
                {actionModal?.kind === 'reject' ? t('templateApproval.rejectReasonLabel') : t('templateApproval.commentLabel', { action: ACTION_LABEL[actionModal?.kind ?? ''] ?? t('templateApproval.comment') })}
              </div>
              <TextArea rows={3} placeholder={actionModal?.kind === 'reject' ? t('templateApproval.rejectReasonPlaceholder') : t('templateApproval.commentPlaceholder')} value={actionComment} onChange={(e) => setActionComment(e.target.value)} />
            </div>
          </Space>
        )}
      </Modal>
    </div>
  )
}

export default TemplateApprovalPanelV2
