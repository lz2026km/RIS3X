import { useState, useEffect } from 'react'
import { auditApi, type AuditLogDto, type AuditStatsDto } from '../services/api/systemApi'
import { auditApi as auditAggApi, type AuditOverviewDto, type AuditUserActivityDto, type AuditTrendPoint, type AuditHighRiskDto, type AuditHighRiskActionDto } from '../services/api/auditApi'
import { auditChainApi, type AuditChainVerificationDto, type RetentionPolicyDto } from '../services/api/w13SecurityApi'
import type { ColdArchiveResultDto } from '../services/api/w13SecurityApi'
import { Card, Tag, Statistic, Row, Col, Space, Select, Button, Tabs, Descriptions, Tooltip, message, Drawer, Spin, Progress, List, Alert, Checkbox } from 'antd'
import { ProTable, type ProColumn } from '../components/data/ProTable'
import { PageHeader } from '../components/common/PageHeader'
import { Search, ClipboardList, BarChart3, RefreshCw, Download, Filter, User, Eye, AlertTriangle, LineChart, ShieldCheck, CheckCircle2, XCircle } from 'lucide-react'
import { t } from '../i18n/appI18n'
import { ErrorBanner } from '../components/feedback'

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLogDto[]>([])
  const [stats, setStats] = useState<AuditStatsDto | null>(null)
  // [G005 Wave1A P0] 按操作类型分布 (后端 GET /audit/aggregation → byAction)
  const [byAction, setByAction] = useState<Record<string, number> | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [params, setParams] = useState<{ action?: string; resource?: string; userId?: string }>({})
  // [W2-C] 审计详情 Drawer
  const [detail, setDetail] = useState<AuditLogDto | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  // [Wave 4B] 扩展端点: overview / user-activity / action-trend / high-risk
  const [overview, setOverview] = useState<AuditOverviewDto | null>(null)
  const [userActivity, setUserActivity] = useState<AuditUserActivityDto[]>([])
  const [trend, setTrend] = useState<AuditTrendPoint[]>([])
  const [highRisk, setHighRisk] = useState<AuditHighRiskDto | null>(null)
  // [G005 W13-Security] 审计链端到端校验
  const [chain, setChain] = useState<AuditChainVerificationDto | null>(null)
  const [chainRetention, setChainRetention] = useState<RetentionPolicyDto | null>(null)
  const [chainLoading, setChainLoading] = useState(false)
  // [G005 W4A] 审计链与留存 (后端 /audit/verify-chain | /audit/retention-policy | /audit/cold-archive)
  const [orphanChain, setOrphanChain] = useState<AuditChainVerificationDto | null>(null)
  const [orphanRetention, setOrphanRetention] = useState<RetentionPolicyDto | null>(null)
  const [orphanArchive, setOrphanArchive] = useState<ColdArchiveResultDto | null>(null)
  const [orphanBusy, setOrphanBusy] = useState(false)
  const [orphanTamper, setOrphanTamper] = useState(false)

  const fetchLogs = async (requestedPage?: number) => {
    const targetPage = requestedPage ?? page
    setLoading(true)
    setPage(targetPage)
    try {
      const res = await auditApi.list({ ...params, page: targetPage, pageSize: 10 })
      if (res.success && res.data) {
        setLogs(res.data.items)
        setTotal(res.data.total)
        setLoadError(null)
      } else {
        setLoadError(res.error?.message ?? t('w9.states.error'))
      }
    } catch {
      setLoadError(t('w9.states.error'))
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    const res = await auditApi.stats()
    if (res.success) setStats(res.data)
    // [G005 Wave1A P0] 按操作类型分布 (聚合端点, 失败静默回退)
    try {
      const agg = await auditAggApi.getAggregation()
      if (agg.success && agg.data?.byAction) setByAction(agg.data.byAction)
    } catch { /* 回退: 不展示分布 */ }
  }

  // [Wave 4B] 审计总览/用户活跃/操作趋势/高危操作 (后端 /audit/overview|user-activity|action-trend|high-risk)
  const fetchExtended = async () => {
    try {
      const ov = await auditAggApi.getOverview()
      if (ov.success && ov.data) setOverview(ov.data)
    } catch { /* 回退: 不展示 */ }
    try {
      const ua = await auditAggApi.getUserActivity(10)
      if (ua.success && Array.isArray(ua.data)) setUserActivity(ua.data)
    } catch { /* 回退: 不展示 */ }
    try {
      const tr = await auditAggApi.getActionTrend(30)
      if (tr.success && Array.isArray(tr.data)) setTrend(tr.data)
    } catch { /* 回退: 不展示 */ }
    try {
      const hr = await auditAggApi.getHighRisk()
      if (hr.success && hr.data) setHighRisk(hr.data)
    } catch { /* 回退: 不展示 */ }
  }

  // [G005 W13-Security] 审计链校验 + 留存策略
  const fetchChain = async () => {
    setChainLoading(true)
    try {
      const [v, r] = await Promise.all([auditChainApi.verify(), auditChainApi.retention()])
      if (v.success && v.data) setChain(v.data)
      if (r.success && r.data) setChainRetention(r.data)
    } catch { /* 回退: 不展示链校验 */ } finally {
      setChainLoading(false)
    }
  }

  // [G005 W4A] 审计链校验 + 留存策略 (后端 /audit/*)
  const fetchOrphanChain = async (tamper: boolean = orphanTamper) => {
    setOrphanBusy(true)
    try {
      const [v, r] = await Promise.all([
        auditAggApi.verifyChain(tamper),
        auditAggApi.getRetentionPolicy(),
      ])
      if (v.success && v.data) setOrphanChain(v.data)
      if (r.success && r.data) setOrphanRetention(r.data)
    } catch { /* 回退: 不展示 */ } finally {
      setOrphanBusy(false)
    }
  }

  // [G005 W4A] 审计冷归档
  const handleColdArchive = async () => {
    setOrphanBusy(true)
    try {
      const res = await auditAggApi.coldArchive({ executedBy: 'admin' })
      if (res.success && res.data) {
        setOrphanArchive(res.data)
        message.success(t('w4a.audit.archived', { count: res.data.archivedCount }))
      } else {
        message.error(res.error?.message ?? t('w9.states.error'))
      }
    } catch {
      message.error(t('w9.states.error'))
    } finally {
      setOrphanBusy(false)
    }
  }

  // [W2-C] 审计记录详情: 操作者/资源/请求/响应/时间
  const handleViewDetail = async (id: string) => {
    setDetailOpen(true)
    setDetailLoading(true)
    setDetail(null)
    try {
      const res = await auditApi.getById(id)
      if (res.success && res.data) {
        setDetail(res.data)
      } else {
        message.error(res.error?.message ?? t('auditPage.loadDetailFailed'))
        setDetailOpen(false)
      }
    } catch {
      message.error(t('auditPage.loadDetailFailed'))
      setDetailOpen(false)
    } finally {
      setDetailLoading(false)
    }
  }

  useEffect(() => { fetchLogs(1); fetchStats(); fetchExtended(); fetchChain(); fetchOrphanChain() }, [])

  const columns: ProColumn<AuditLogDto>[] = [
    { title: t('auditPage.colTime'), dataIndex: 'createdAt', key: 'createdAt', width: 180, sorter: (a, b) => a.createdAt.localeCompare(b.createdAt), defaultSortOrder: 'descend', render: (v) => new Date(String(v)).toLocaleString('zh-CN') },
    { title: t('auditPage.colUser'), dataIndex: 'userId', key: 'userId', width: 120, searchable: true, sorter: (a, b) => String(a.userId).localeCompare(String(b.userId)) },
    { title: t('auditPage.colAction'), dataIndex: 'action', key: 'action', width: 100, filters: ['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'EXPORT', 'PRINT'].map((value) => ({ text: value, value })), onFilter: (value, record) => record.action === value, render: (v) => {
      const colorMap: Record<string, string> = { CREATE: 'green', UPDATE: 'blue', DELETE: 'red', LOGIN: 'cyan', LOGOUT: 'default', EXPORT: 'orange', PRINT: 'purple' }
      return <Tag color={colorMap[String(v)] ?? 'default'}>{String(v)}</Tag>
    }},
    { title: t('auditPage.colResource'), dataIndex: 'resource', key: 'resource', width: 200, searchable: true, sorter: (a, b) => a.resource.localeCompare(b.resource) },
    { title: t('auditPage.colIp'), dataIndex: 'ip', key: 'ip', width: 130, render: (v) => <Tooltip title={String(v ?? '-')}><span style={{ fontFamily: 'monospace', fontSize: 12 }}>{String(v ?? '-')}</span></Tooltip> },
    { title: t('auditPage.colDetails'), dataIndex: 'details', key: 'details', ellipsis: true, render: (value) => String(value ?? '-') },
    { title: t('auditPage.colActions'), key: 'actions', width: 90, render: (_value, record) => (
      <Button size="small" type="link" icon={<Eye />} onClick={() => handleViewDetail(record.id)}>{t('auditPage.viewDetail')}</Button>
    ) },
  ]

  const handleExport = async () => {
    setLoading(true)
    try {
      const blob = await auditApi.exportCsv({ ...params, startDate: undefined, endDate: undefined })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
      message.success(`审计日志已导出 (${logs.length}+ 条)`)
    } catch (e) {
      message.error((e as Error)?.message || t('auditPage.exportFailed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: 24 }}>
      <Card>
        <Space orientation="vertical" style={{ width: '100%' }}>
{loadError && !loading && <ErrorBanner message={loadError} />}
<Row justify="space-between" align="middle">
<PageHeader variant="flex" icon={<ClipboardList />} title={t('auditPage.title')} style={{ marginBottom: 0 }} />
            <Space>
              <Button icon={<Download />} onClick={handleExport}>{t('auditPage.export')}</Button>
              <Button icon={<RefreshCw />} onClick={() => { fetchLogs(1); fetchStats(); fetchExtended(); fetchChain(); fetchOrphanChain() }}>{t('auditPage.refresh')}</Button>
            </Space>
          </Row>
          <Tabs items={[
            {
              key: 'overview',
              label: <span><BarChart3 /> {t('auditPage.tabOverview')}</span>,
              children: stats ? (
                <>
                  <Row gutter={16}>
                    <Col span={4}><Card size="small"><Statistic title={t('auditPage.statTotalLogs')} value={stats.total} prefix={<ClipboardList />} /></Card></Col>
                    <Col span={4}><Card size="small"><Statistic title={t('auditPage.statLast24h')} value={stats.last24h} prefix={<BarChart3 />} /></Card></Col>
                    {/* [Wave 4B] 后端 GET /audit/overview 真实数据 */}
                    <Col span={4}><Card size="small"><Statistic title={t('auditPage.statTodayOps')} value={overview?.todayOperations ?? '-'} prefix={<LineChart />} /></Card></Col>
                    <Col span={4}><Card size="small"><Statistic title={t('auditPage.statActiveUsers')} value={overview?.activeUsers ?? '-'} prefix={<User />} /></Card></Col>
                    <Col span={4}><Card size="small"><Statistic title={t('auditPage.statHighRisk')} value={overview?.highRiskCount ?? '-'} prefix={<AlertTriangle />} styles={{ content: { color: (overview?.highRiskCount ?? 0) > 0 ? '#fa8c16' : '#52c41a' } }} /></Card></Col>
                    <Col span={4}><Card size="small"><Statistic title={t('auditPage.statSuccessRate')} value={overview ? `${overview.successRate}%` : '-'} prefix={<ShieldCheck />} styles={{ content: { color: (overview?.successRate ?? 0) >= 90 ? '#52c41a' : '#fa8c16' } }} /></Card></Col>
                    {overview?.seeded === true && (
                      <Col span={24} style={{ marginTop: 4 }}>
                        <Tag color="gold" style={{ fontSize: 11 }}>{t('auditPage.seededTag')}</Tag>
                      </Col>
                    )}
                    {byAction && Object.keys(byAction).length > 0 && (
                      <Col span={24} style={{ marginTop: 12 }}>
                        <Card size="small" title={t('auditPage.byActionTitle')}>
                          <Space wrap size={[8, 8]}>
                            {Object.entries(byAction)
                              .sort((a, b) => b[1] - a[1])
                              .slice(0, 8)
                              .map(([action, count]) => (
                                <Tag key={action} color={action === 'LOGIN' || action === 'EXPORT' || action === 'PRINT' ? 'blue' : 'default'} style={{ fontSize: 12, padding: '2px 10px' }}>
                                  {action}: <b>{count}</b>
                                </Tag>
                              ))}
                          </Space>
                        </Card>
                      </Col>
                    )}
                  </Row>
                  {/* [Wave 4B] 近 30 日操作趋势 (GET /audit/action-trend) */}
                  {trend.length > 0 && (
                    <Card size="small" title={<span><LineChart /> {t('auditPage.trendTitle')}</span>} style={{ marginTop: 12 }}>
                      <Row gutter={[8, 8]}>
                        {trend.slice(-14).map((p) => {
                          const max = Math.max(...trend.map((t) => t.total), 1)
                          return (
                            <Col key={p.date} span={Math.floor(24 / Math.min(trend.slice(-14).length, 14))}>
                              <div style={{ textAlign: 'center' }}>
                                <Tooltip title={t('auditPage.trendTooltip', { label: p.label, total: p.total, highRisk: p.highRisk, failed: p.failed })}>
                                  <div>
                                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>{p.label}</div>
                                    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', height: 64 }}>
                                      <div style={{ width: 14, height: `${Math.max((p.total / max) * 100, 3)}%`, minHeight: 3, background: p.failed > 0 ? '#fa8c16' : '#1677ff', borderRadius: 3 }} />
                                    </div>
                                    <div style={{ fontSize: 10, color: '#999' }}>{p.total}</div>
                                  </div>
                                </Tooltip>
                              </div>
                            </Col>
                          )
                        })}
                      </Row>
                    </Card>
                  )}
                  <Row gutter={16} style={{ marginTop: 12 }}>
                    {/* [Wave 4B] 用户活跃排行 (GET /audit/user-activity) */}
                    <Col span={12}>
                      <Card size="small" title={<span><User /> {t('auditPage.userActivityTitle')}</span>}>
                        {userActivity.length === 0 ? (
                          <div style={{ color: '#999', fontSize: 12, textAlign: 'center', padding: 16 }}>{t('auditPage.noData')}</div>
                        ) : (
                          <List
                            size="small"
                            dataSource={userActivity.slice(0, 10)}
                            renderItem={(u, i) => (
                              <List.Item>
                                <Space>
                                  <Tag color={i === 0 ? 'gold' : i < 3 ? 'blue' : 'default'}>{i + 1}</Tag>
                                  <b>{u.userName ?? u.userId}</b>
                                  <span style={{ fontSize: 12, color: '#999' }}>{t('auditPage.timesSuffix', { count: u.count })}</span>
                                  <Progress percent={u.successRate} size="small" style={{ width: 90 }} format={(p) => `${p}%`} />
                                </Space>
                                <span style={{ fontSize: 11, color: '#999' }}>{t('auditPage.lastActive', { time: new Date(u.lastActive).toLocaleString('zh-CN') })}</span>
                              </List.Item>
                            )}
                          />
                        )}
                      </Card>
                    </Col>
                    {/* [Wave 4B] 高危操作清单 (GET /audit/high-risk) */}
                    <Col span={12}>
                      <Card size="small" title={<span><AlertTriangle /> {t('auditPage.highRiskTitle')}</span>} extra={highRisk ? <Tag color="red">{t('auditPage.totalTimes', { total: highRisk.total })}</Tag> : null}>
                        {!highRisk || highRisk.actions.length === 0 ? (
                          <div style={{ color: '#999', fontSize: 12, textAlign: 'center', padding: 16 }}>{t('auditPage.noHighRisk')}</div>
                        ) : (
                          <ProTable<AuditHighRiskActionDto>
                            dataSource={highRisk.actions.slice(0, 10)}
                            columns={[
                              { title: t('auditPage.colAction'), dataIndex: 'action', key: 'action', render: (v) => <Tag color="red" style={{ fontFamily: 'monospace' }}>{String(v)}</Tag> },
                              { title: t('auditPage.colCategory'), dataIndex: 'patternZh', key: 'pattern', width: 90, render: (v) => <Tag>{String(v)}</Tag> },
                              { title: t('auditPage.colCount'), dataIndex: 'count', key: 'count', width: 70, sorter: (a, b) => a.count - b.count },
                              { title: t('auditPage.colLastAt'), dataIndex: 'lastAt', key: 'lastAt', width: 150, render: (v) => v ? new Date(String(v)).toLocaleString('zh-CN') : '-' },
                              { title: t('auditPage.colUsers'), dataIndex: 'recentUsers', key: 'users', render: (v) => Array.isArray(v) ? (v as string[]).slice(0, 3).join('、') : '-' },
                            ]}
                            rowKey="action"
                            pagination={false}
                            size="small"
                            showToolbar={false}
                          />
                        )}
                      </Card>
                    </Col>
                  </Row>
                </>
              ) : <Card size="small"><Statistic title={t('auditPage.loading')} value="-" /></Card>,
            },
            {
              key: 'logs',
              label: <span><Filter /> {t('auditPage.tabLogs')}</span>,
              children: (
                <>
                  <Space style={{ marginBottom: 16 }}>
                    <Select allowClear placeholder={t('auditPage.filterAction')} style={{ width: 150 }} onChange={(v) => setParams((p) => ({ ...p, action: v }))} options={['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'EXPORT', 'PRINT'].map((a) => ({ value: a, label: a }))} />
                    <Select allowClear placeholder={t('auditPage.filterResource')} style={{ width: 150 }} onChange={(v) => setParams((p) => ({ ...p, resource: v }))} options={['patient', 'report', 'user', 'exam', 'dicom'].map((r) => ({ value: r, label: r }))} />
                    <Button type="primary" icon={<Search size={14} />} onClick={() => fetchLogs(1)}>{t('auditPage.query')}</Button>
                  </Space>
                  <ProTable<AuditLogDto>
                    dataSource={logs}
                    columns={columns}
                    rowKey="id"
                    loading={loading}
                    showToolbar={false}
                    pagination={{ current: page, pageSize: 10, total, showTotal: (total) => t('auditPage.totalItems', { total }), onChange: (nextPage) => fetchLogs(nextPage) }}
                    size="small"
                  />
                </>
              ),
            },
            {
              key: 'chain',
              label: <span><ShieldCheck /> {t('w13Sec.ac.title')}</span>,
              children: (
                <Card size="small" extra={<Button size="small" type="primary" icon={<RefreshCw />} loading={chainLoading} onClick={() => void fetchChain()}>{t('w13Sec.ac.verify')}</Button>}>
                  {chain ? (
                    <>
                      <Alert
                        type={chain.verified ? 'success' : 'error'}
                        showIcon
                        message={chain.verified ? t('w13Sec.ac.verified') : t('w13Sec.ac.broken', { index: chain.brokenAt ?? 0 })}
                        description={chain.reason ?? undefined}
                      />
                      <Row gutter={16} style={{ marginTop: 12 }}>
                        <Col span={6}><Statistic title={t('w13Sec.ac.blocks')} value={chain.totalBlocks} prefix={<ShieldCheck />} /></Col>
                        <Col span={6}><Statistic title={t('w13Sec.ac.checked')} value={chain.checkedBlocks} /></Col>
                        <Col span={6}><Statistic title={t('w13Sec.ac.source')} value={t(`w13Sec.ac.source.${chain.source}`)} /></Col>
                        <Col span={6}><Card size="small"><div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('w13Sec.ac.headHash')}</div><Tooltip title={chain.headHash}><span style={{ fontFamily: 'monospace', fontSize: 11 }}>{chain.headHash.slice(0, 20)}…</span></Tooltip></Card></Col>
                      </Row>
                      {chainRetention && (
                        <Descriptions bordered size="small" column={3} style={{ marginTop: 12 }}>
                          <Descriptions.Item label={t('w13Sec.ac.retentionMonths')}>{chainRetention.retentionMonths}</Descriptions.Item>
                          <Descriptions.Item label={t('w13Sec.ac.retentionDays')}>{chainRetention.retentionDays}</Descriptions.Item>
                          <Descriptions.Item label={t('w13Sec.ac.archiveLocation')}><span style={{ fontFamily: 'monospace', fontSize: 11 }}>{chainRetention.archiveLocation}</span></Descriptions.Item>
                          <Descriptions.Item label={t('w13Sec.ac.encrypted')}>{chainRetention.encrypted ? <CheckCircle2 size={14} color="#16a34a" /> : <XCircle size={14} color="#dc2626" />}</Descriptions.Item>
                          <Descriptions.Item label={t('w13Sec.ac.immutable')}>{chainRetention.immutable ? <CheckCircle2 size={14} color="#16a34a" /> : <XCircle size={14} color="#dc2626" />}</Descriptions.Item>
                          <Descriptions.Item label={t('w13Sec.ac.lastArchive')}>{chainRetention.lastArchiveAt?.slice(0, 19).replace('T', ' ') ?? '-'}</Descriptions.Item>
                        </Descriptions>
                      )}
                    </>
                  ) : (
                    <div style={{ textAlign: 'center', padding: 24 }}><Spin tip={t('auditPage.loading')} /></div>
                  )}
                </Card>
              ),
            },
            {
              key: 'chainRetention',
              label: <span><ShieldCheck /> {t('w4a.audit.tab')}</span>,
              children: (
                <Card
                  size="small"
                  extra={
                    <Space>
                      <Checkbox
                        checked={orphanTamper}
                        onChange={(e) => { const v = e.target.checked; setOrphanTamper(v); void fetchOrphanChain(v) }}
                      >
                        {t('w4a.audit.simulateBroken')}
                      </Checkbox>
                      <Button size="small" icon={<RefreshCw />} loading={orphanBusy} onClick={() => void fetchOrphanChain()}>{t('w4a.audit.verify')}</Button>
                      <Button size="small" type="primary" loading={orphanBusy} onClick={() => void handleColdArchive()}>{t('w4a.audit.coldArchive')}</Button>
                    </Space>
                  }
                >
                  {orphanChain ? (
                    <>
                      <Alert
                        type={orphanChain.verified ? 'success' : 'error'}
                        showIcon
                        message={orphanChain.verified ? t('w4a.audit.verified') : t('w4a.audit.broken', { index: orphanChain.brokenAt ?? 0 })}
                        description={orphanChain.reason ?? undefined}
                      />
                      <Row gutter={16} style={{ marginTop: 12 }}>
                        <Col span={6}><Statistic title={t('w4a.audit.blocks')} value={orphanChain.totalBlocks} prefix={<ShieldCheck />} /></Col>
                        <Col span={6}><Statistic title={t('w4a.audit.checked')} value={orphanChain.checkedBlocks} /></Col>
                        <Col span={6}><Statistic title={t('w4a.audit.source')} value={orphanChain.source === 'database' ? t('w4a.audit.sourceDatabase') : t('w4a.audit.sourceSeed')} /></Col>
                        <Col span={6}><Card size="small"><div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('w4a.audit.headHash')}</div><Tooltip title={orphanChain.headHash}><span style={{ fontFamily: 'monospace', fontSize: 11 }}>{orphanChain.headHash.slice(0, 20)}…</span></Tooltip></Card></Col>
                      </Row>
                      {orphanRetention && (
                        <Descriptions title={t('w4a.audit.retention')} bordered size="small" column={3} style={{ marginTop: 12 }}>
                          <Descriptions.Item label={t('w4a.audit.retentionMonths')}>{orphanRetention.retentionMonths}</Descriptions.Item>
                          <Descriptions.Item label={t('w4a.audit.retentionDays')}>{orphanRetention.retentionDays}</Descriptions.Item>
                          <Descriptions.Item label={t('w4a.audit.archiveLocation')}><span style={{ fontFamily: 'monospace', fontSize: 11 }}>{orphanRetention.archiveLocation}</span></Descriptions.Item>
                          <Descriptions.Item label={t('w4a.audit.encrypted')}>{orphanRetention.encrypted ? <CheckCircle2 size={14} color="#16a34a" /> : <XCircle size={14} color="#dc2626" />}</Descriptions.Item>
                          <Descriptions.Item label={t('w4a.audit.immutable')}>{orphanRetention.immutable ? <CheckCircle2 size={14} color="#16a34a" /> : <XCircle size={14} color="#dc2626" />}</Descriptions.Item>
                          <Descriptions.Item label={t('w4a.audit.lastArchive')}>{orphanRetention.lastArchiveAt?.slice(0, 19).replace('T', ' ') ?? '-'}</Descriptions.Item>
                          <Descriptions.Item label={t('w4a.audit.note')} span={3}>{orphanRetention.note}</Descriptions.Item>
                        </Descriptions>
                      )}
                      {orphanArchive && (
                        <Card size="small" title={t('w4a.audit.coldArchive')} style={{ marginTop: 12 }}>
                          <Descriptions bordered size="small" column={3}>
                            <Descriptions.Item label={t('w4a.audit.archiveId')}><span style={{ fontFamily: 'monospace' }}>{orphanArchive.archiveId}</span></Descriptions.Item>
                            <Descriptions.Item label={t('w4a.audit.archived', { count: orphanArchive.archivedCount })}>{orphanArchive.archivedCount}</Descriptions.Item>
                            <Descriptions.Item label={t('w4a.audit.archiveLocation')}><span style={{ fontFamily: 'monospace', fontSize: 11 }}>{orphanArchive.location}</span></Descriptions.Item>
                            <Descriptions.Item label={t('w4a.audit.checksum')} span={3}><span style={{ fontFamily: 'monospace', fontSize: 11, wordBreak: 'break-all' }}>{orphanArchive.checksum}</span></Descriptions.Item>
                          </Descriptions>
                        </Card>
                      )}
                    </>
                  ) : (
                    <div style={{ textAlign: 'center', padding: 24 }}><Spin tip={t('auditPage.loading')} /></div>
                  )}
                </Card>
              ),
            },
            {
              key: 'policy',
              label: <span><ClipboardList /> {t('auditPage.tabPolicy')}</span>,
              children: (
                <Card size="small">
                  <Descriptions bordered column={2}>
                    <Descriptions.Item label={t('auditPage.policyLogRetention')}>{t('auditPage.policyLogRetentionValue')}</Descriptions.Item>
                    <Descriptions.Item label={t('auditPage.policyArchive')}>{t('auditPage.policyArchiveValue')}</Descriptions.Item>
                    <Descriptions.Item label={t('auditPage.policyRealtimeAlert')}>{t('auditPage.policyRealtimeAlertValue')}</Descriptions.Item>
                    <Descriptions.Item label={t('auditPage.policyEncryption')}>{t('auditPage.policyEncryptionValue')}</Descriptions.Item>
                  </Descriptions>
                </Card>
              ),
            },
          ]} />
        </Space>
      </Card>
      {/* [W2-C] 审计记录详情 Drawer */}
      <Drawer
        title={<Space><Eye /> {t('auditPage.detailTitle')}</Space>}
        width={520}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        footer={detail && (
          <Space>
            <Tag color={detail.status === 'SUCCESS' ? 'success' : detail.status === 'FAILURE' ? 'error' : detail.status === 'DENIED' ? 'warning' : 'default'}>
              {detail.status ?? 'SUCCESS'}
            </Tag>
            <Tag>{detail.action}</Tag>
            <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{new Date(detail.createdAt).toLocaleString('zh-CN')}</span>
          </Space>
        )}
      >
        {detailLoading ? (
          <div style={{ textAlign: 'center', padding: 48 }}><Spin tip={t('auditPage.loading')} /></div>
        ) : detail ? (
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label={t('auditPage.detailRecordId')}>{detail.id}</Descriptions.Item>
            <Descriptions.Item label={t('auditPage.detailOperator')}>{detail.username ?? detail.userId}{detail.username && detail.username !== detail.userId ? ` (${detail.userId})` : ''}</Descriptions.Item>
            <Descriptions.Item label={t('auditPage.detailRole')}>{detail.userRole ?? '-'}</Descriptions.Item>
            <Descriptions.Item label={t('auditPage.detailActionType')}><Tag>{detail.action}</Tag></Descriptions.Item>
            <Descriptions.Item label={t('auditPage.detailResource')}>{detail.resource}</Descriptions.Item>
            <Descriptions.Item label={t('auditPage.detailResourceId')}>{detail.resourceId ?? '-'}</Descriptions.Item>
            <Descriptions.Item label={t('auditPage.detailRequestDetails')}>{Array.isArray(detail.details) ? (detail.details as string[]).join('；') : detail.details ?? '-'}</Descriptions.Item>
            <Descriptions.Item label={t('auditPage.detailResponseStatus')}>
              <Tag color={detail.status === 'SUCCESS' ? 'success' : detail.status === 'FAILURE' ? 'error' : detail.status === 'DENIED' ? 'warning' : 'default'}>
                {detail.status ?? '-'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label={t('auditPage.detailIp')}><span style={{ fontFamily: 'monospace' }}>{detail.ip ?? '-'}</span></Descriptions.Item>
            <Descriptions.Item label="User-Agent"><span style={{ fontSize: 12, wordBreak: 'break-all' }}>{detail.userAgent ?? '-'}</span></Descriptions.Item>
            <Descriptions.Item label={t('auditPage.detailTime')}>{new Date(detail.createdAt).toLocaleString('zh-CN')}</Descriptions.Item>
          </Descriptions>
        ) : null}
      </Drawer>
    </div>
  )
}
