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

const { TextArea } = Input

const STATE_META: Record<TemplateStateV2, { color: string; label: string; bg: string }> = {
  draft: { color: '#64748b', label: '草稿', bg: 'var(--bg-secondary, #f1f5f9)' },
  pending: { color: '#f59e0b', label: '审批中', bg: 'var(--color-warning-bg)' },
  approved: { color: '#3b82f6', label: '已通过', bg: 'var(--color-info-bg)' },
  rejected: { color: '#dc2626', label: '已驳回', bg: 'var(--color-error-bg)' },
  published: { color: '#10b981', label: '已发布', bg: 'var(--color-success-bg)' },
}

const ACTION_LABEL: Record<string, string> = {
  submit: '提交审批',
  approve: '审批通过',
  reject: '驳回',
  publish: '发布',
  rework: '退回草稿',
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
      const [t, s] = await Promise.allSettled([
        templateApprovalApi.listTemplates(),
        templateApprovalApi.stats(),
      ])
      if (t.status === 'fulfilled' && t.value.success) {
        setTemplates(t.value.data ?? [])
        if (!selectedId && (t.value.data ?? []).length > 0) setSelectedId(t.value.data![0]!.id)
      }
      if (s.status === 'fulfilled' && s.value.success) setStats(s.value.data)
    } catch {
      message.error('加载模板数据失败')
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
    if (stateFilter) list = list.filter((t) => t.state === stateFilter)
    if (keyword.trim()) {
      const q = keyword.trim().toLowerCase()
      list = list.filter((t) => t.name.toLowerCase().includes(q) || t.content.toLowerCase().includes(q))
    }
    return list
  }, [templates, stateFilter, keyword])

  const selected = useMemo(() => templates.find((t) => t.id === selectedId), [templates, selectedId])

  const columns: ColumnsType<ReportTemplateV2> = [
    { title: '模板名称', dataIndex: 'name', width: 200, render: (v: string, t) => (
        <Space size={4}>
          <FileText size={13} color="#64748b" />
          <span>{v}</span>
          {t.favoriteCount > 0 && <Star size={12} color="#f59e0b" fill="#f59e0b" />}
        </Space>
      ) },
    { title: '类别', dataIndex: 'category', width: 70, render: (v: string) => <Tag>{v}</Tag> },
    { title: '模态', dataIndex: 'modality', width: 60, render: (v?: string) => v ?? '-' },
    { title: '部位', dataIndex: 'bodyPart', width: 80 },
    { title: '版本', dataIndex: 'version', width: 60, render: (v: number) => <Tag color="blue">v{v}</Tag> },
    { title: '状态', dataIndex: 'state', width: 90, render: (v: TemplateStateV2) => {
        const m = STATE_META[v]
        return <Tag color={m.color} style={{ fontWeight: 600 }}>{m.label}</Tag>
      } },
    { title: '审批人', width: 100, render: (_, t) => t.assignee ? (
        <Space size={4}>
          <ClipboardCheck size={12} color="#7c3aed" />
          <span>{t.assignee.approverName}</span>
        </Space>
      ) : '-' },
    { title: '收藏', dataIndex: 'favoriteCount', width: 60, align: 'center' as const },
    { title: '使用', dataIndex: 'usageCount', width: 60, align: 'center' as const },
    { title: '操作', width: 230, fixed: 'right' as const, render: (_, t) => (
        <Space size={4} wrap>
          {t.state === 'draft' && (
            <Button size="small" type="primary" icon={<Send size={11} />} onClick={() => { setActionModal({ template: t, kind: 'submit' }); setActionComment('') }}>
              提交审批
            </Button>
          )}
          {t.state === 'pending' && (
            <>
              <Button size="small" type="primary" icon={<CheckCircle2 size={11} />} onClick={() => { setActionModal({ template: t, kind: 'approve' }); setActionComment('') }}>
                通过
              </Button>
              <Button size="small" danger icon={<XCircle size={11} />} onClick={() => { setActionModal({ template: t, kind: 'reject' }); setActionComment('') }}>
                驳回
              </Button>
            </>
          )}
          {t.state === 'approved' && (
            <Button size="small" type="primary" icon={<Rocket size={11} />} onClick={() => { setActionModal({ template: t, kind: 'publish' }); setActionComment('') }}>
              发布
            </Button>
          )}
          <Tooltip title="版本历史">
            <Button size="small" icon={<History size={11} />} onClick={() => { setSelectedId(t.id); setHistoryOpen(true); void loadDetail(t.id) }} />
          </Tooltip>
          {t.state !== 'published' && (
            <Tooltip title="收藏">
              <Button size="small" icon={<Bookmark size={11} />} onClick={async () => {
                const res = await templateApprovalApi.toggleFavorite(t.id, 'u-001')
                if (res.success) message.success(res.data?.favorite ? '已收藏' : '已取消收藏')
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
          message.warning('请填写驳回原因')
          setSubmitting(false)
          return
        }
        res = await templateApprovalApi.reject(template.id, { rejectedBy: '当前用户', reason: actionComment.trim() })
      }
      if (kind === 'publish') res = await templateApprovalApi.publish(template.id, { publishedBy: '当前用户', comment: actionComment || undefined })
      if (res && res.success) {
        message.success(`${ACTION_LABEL[kind]}成功 (v${res.data?.version ?? ''})`)
        setActionModal(null)
        await loadAll()
      } else {
        message.error(res?.error?.message ?? '操作失败 (状态机拒绝非法流转)')
      }
    } catch {
      message.error('操作失败')
    } finally {
      setSubmitting(false)
    }
  }

  const createTemplate = async () => {
    if (!actionName.trim()) {
      message.warning('请填写模板名称')
      return
    }
    if (!actionContent.trim()) {
      message.warning('请填写模板内容')
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
        message.success(`已创建草稿模板 (v1)`)
        setActionModal(null)
        setActionName('')
        setActionContent('')
        await loadAll()
      } else {
        message.error(res.error?.message ?? '创建失败')
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
    { title: '模板总数', value: stats?.total ?? '-', color: '#fff', prefix: <FileText size={14} /> },
    { title: '审批中', value: stats?.pendingCount ?? '-', color: '#fcd34d', prefix: <ClipboardCheck size={14} /> },
    { title: '已发布', value: stats?.publishedCount ?? '-', color: '#bbf7d0', prefix: <Rocket size={14} /> },
    { title: '总版本数', value: stats?.totalVersions ?? '-', color: '#fff', prefix: <History size={14} /> },
    ...(compact ? [] : [
      { title: '平均审批(h)', value: stats?.avgApprovalHours ?? '-', color: '#fff', prefix: <FileCheck2 size={14} /> },
      { title: '总收藏', value: stats?.totalFavorites ?? '-', color: '#fde68a', prefix: <Star size={14} /> },
      { title: '总使用', value: stats?.totalUsage ?? '-', color: '#bbf7d0', prefix: <Eye size={14} /> },
    ]),
  ]

  return (
    <div data-testid="template-approval-panel-v2" role="region" aria-label="模板审批流 V2 面板">
      <div style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #1e1b4b 100%)', color: '#fff', padding: '12px 16px', borderRadius: 8, marginBottom: 12 }}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <FileCheck2 size={18} />
            <strong style={{ fontSize: 16 }}>模板审批流 V2</strong>
            <Tag color="purple">Wave 6C · F7</Tag>
            <Tag color="cyan">状态机 + 版本管理</Tag>
          </Space>
          <Space>
            <Button size="small" ghost type="dashed" icon={<Pencil size={12} />} onClick={() => { setActionModal({ template: {} as ReportTemplateV2, kind: 'create' }); setActionName(''); setActionCategory('CT'); setActionBodyPart(''); setActionContent('') }}>
              新建草稿
            </Button>
            <Tooltip title="刷新">
              <Button size="small" ghost icon={<RefreshCw size={12} />} onClick={() => void loadAll()}>
                刷新
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
          { label: '模板列表', value: 'templates' },
          { label: '版本与审批历史', value: 'history' },
        ]}
        style={{ marginBottom: 12 }}
      />

      {tab === 'templates' && (
        <Card size="small" title={<Space><ClipboardCheck size={14} color="#4f46e5" />模板列表</Space>} extra={<Tag color="blue">{filtered.length} 个</Tag>}>
          <Space wrap style={{ marginBottom: 12 }}>
            <Input allowClear prefix={<Search size={12} />} placeholder="搜索模板名称/内容" style={{ width: 240 }} value={keyword} onChange={(e) => setKeyword(e.target.value)} />
            <Select
              allowClear placeholder="按状态过滤" style={{ width: 140 }} value={stateFilter}
              onChange={(v) => setStateFilter(v)}
              options={(Object.keys(STATE_META) as TemplateStateV2[]).map((s) => ({ label: STATE_META[s].label, value: s }))}
            />
          </Space>
          <Table
            rowKey="id" size="small" loading={loading} dataSource={filtered} columns={columns}
            pagination={{ pageSize: 8, showSizeChanger: false, showTotal: (t) => `共 ${t} 个模板` }}
            scroll={{ x: 'max-content' }}
            locale={{ emptyText: <Empty description="暂无模板" /> }}
          />
        </Card>
      )}

      {tab === 'history' && (
        <Row gutter={12}>
          <Col span={10}>
            <Card size="small" title={<Space><History size={14} color="#4f46e5" />选择模板</Space>}>
              <Table
                rowKey="id" size="small" loading={loading} dataSource={templates} columns={[
                  { title: '名称', dataIndex: 'name', ellipsis: true },
                  { title: '状态', dataIndex: 'state', width: 90, render: (v: TemplateStateV2) => <Tag color={STATE_META[v]?.color}>{STATE_META[v]?.label}</Tag> },
                  { title: '版本', dataIndex: 'version', width: 70, render: (v: number) => `v${v}` },
                ]}
                pagination={{ pageSize: 6, showSizeChanger: false }}
                onRow={(record) => ({ onClick: () => { setSelectedId(record.id); void loadDetail(record.id) }, style: { cursor: 'pointer' } })}
                rowClassName={(record) => (record.id === selectedId ? 'ant-table-row-selected' : '')}
              />
            </Card>
          </Col>
          <Col span={14}>
            {!selected ? (
              <Card size="small"><Empty description="请选择模板" /></Card>
            ) : (
              <>
                <Card size="small" title={<Space><History size={14} color="#4f46e5" />版本历史 ({selected.name})</Space>} style={{ marginBottom: 12 }}>
                  <Space direction="vertical" size={4} style={{ width: '100%', maxHeight: 260, overflowY: 'auto' }}>
                    <Timeline items={versionTimeline} />
                  </Space>
                </Card>
                <Card size="small" title={<Space><ClipboardCheck size={14} color="#4f46e5" />审批记录 ({selected.name})</Space>}>
                  <Space direction="vertical" size={4} style={{ width: '100%', maxHeight: 260, overflowY: 'auto' }}>
                    {approvalTimeline.length === 0 ? <Empty description="暂无审批记录" /> : <Timeline items={approvalTimeline} />}
                  </Space>
                </Card>
              </>
            )}
          </Col>
        </Row>
      )}

      <div style={{ fontSize: 12, color: '#94a3b8', padding: '8px 0' }}>
        状态机: 草稿 → 提交审批 → 审批中 → 通过/驳回 → 发布 · 每次修改自动生成新版本 · 非法流转由后端拒绝
      </div>

      <Drawer
        title={selected ? `版本历史: ${selected.name}` : '版本历史'}
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
          {versions.length === 0 && <Empty description="暂无版本记录" />}
        </Space>
      </Drawer>

      <Modal
        title={
          actionModal?.kind === 'create' ? '新建草稿模板'
            : actionModal?.kind === 'submit' ? `提交审批: ${actionModal?.template.name}`
            : actionModal?.kind === 'approve' ? `审批通过: ${actionModal?.template.name}`
            : actionModal?.kind === 'reject' ? `驳回: ${actionModal?.template.name}`
            : actionModal?.kind === 'publish' ? `发布: ${actionModal?.template.name}`
            : '操作'
        }
        open={!!actionModal}
        onCancel={() => setActionModal(null)}
        onOk={() => void (actionModal?.kind === 'create' ? createTemplate() : executeAction())}
        okText={actionModal?.kind === 'reject' ? '确认驳回' : actionModal?.kind === 'create' ? '创建' : '确认'}
        cancelText="取消"
        confirmLoading={submitting}
      >
        {actionModal?.kind === 'create' ? (
          <Space direction="vertical" style={{ width: '100%' }} size={8}>
            <div>
              <div style={{ fontSize: 12, marginBottom: 4 }}>模板名称</div>
              <Input placeholder="如: 头颅CT平扫报告模板" value={actionName} onChange={(e) => setActionName(e.target.value)} />
            </div>
            <Row gutter={8}>
              <Col span={12}>
                <div style={{ fontSize: 12, marginBottom: 4 }}>类别</div>
                <Select style={{ width: '100%' }} value={actionCategory} onChange={(v) => setActionCategory(v)} options={['CT', 'MR', 'DR', 'MG', 'US', 'PET'].map((c) => ({ label: c, value: c }))} />
              </Col>
              <Col span={12}>
                <div style={{ fontSize: 12, marginBottom: 4 }}>检查部位</div>
                <Input placeholder="如: 胸部" value={actionBodyPart} onChange={(e) => setActionBodyPart(e.target.value)} />
              </Col>
            </Row>
            <div>
              <div style={{ fontSize: 12, marginBottom: 4 }}>模板内容</div>
              <TextArea rows={4} placeholder="填写模板正文" value={actionContent} onChange={(e) => setActionContent(e.target.value)} />
            </div>
          </Space>
        ) : (
          <Space direction="vertical" style={{ width: '100%' }}>
            <div style={{ fontSize: 13 }}>
              <Tag color={STATE_META[actionModal?.template.state as TemplateStateV2]?.color}>{STATE_META[actionModal?.template.state as TemplateStateV2]?.label}</Tag>
              v{actionModal?.template.version} · {actionModal?.template.category}/{actionModal?.template.bodyPart}
              {actionModal?.template.assignee && (
                <div style={{ marginTop: 4, fontSize: 12, color: '#64748b' }}>
                  审批人: {actionModal.template.assignee.approverName} ({actionModal.template.assignee.dept} · {actionModal.template.assignee.role})
                </div>
              )}
            </div>
            <div style={{ background: 'var(--bg-secondary, #f8fafc)', borderRadius: 6, padding: 8, fontSize: 12, color: '#475569', maxHeight: 120, overflowY: 'auto' }}>
              {actionModal?.template.content}
            </div>
            <div>
              <div style={{ fontSize: 12, marginBottom: 4 }}>
                {actionModal?.kind === 'reject' ? '驳回原因 (必填)' : `${ACTION_LABEL[actionModal?.kind ?? ''] ?? '意见'} (可选)`}
              </div>
              <TextArea rows={3} placeholder={actionModal?.kind === 'reject' ? '填写驳回原因' : '填写审批意见'} value={actionComment} onChange={(e) => setActionComment(e.target.value)} />
            </div>
          </Space>
        )}
      </Modal>
    </div>
  )
}

export default TemplateApprovalPanelV2
