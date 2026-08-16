import { useState, useEffect } from 'react'
import { auditApi, type AuditLogDto, type AuditStatsDto } from '../services/api/systemApi'
import { auditApi as auditAggApi, type AuditOverviewDto, type AuditUserActivityDto, type AuditTrendPoint, type AuditHighRiskDto, type AuditHighRiskActionDto } from '../services/api/auditApi'
import { Card, Tag, Statistic, Row, Col, Space, Select, Button, Tabs, Descriptions, Tooltip, message, Drawer, Spin, Progress, List } from 'antd'
import { ProTable, type ProColumn } from '../components/data/ProTable'
import { PageHeader } from '../components/common/PageHeader'
import { AuditOutlined, BarChartOutlined, ReloadOutlined, DownloadOutlined, FilterOutlined, UserOutlined, EyeOutlined, WarningOutlined, LineChartOutlined, SafetyCertificateOutlined } from '@ant-design/icons'
import { Search } from 'lucide-react'

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLogDto[]>([])
  const [stats, setStats] = useState<AuditStatsDto | null>(null)
  // [G005 Wave1A P0] 按操作类型分布 (后端 GET /audit/aggregation → byAction)
  const [byAction, setByAction] = useState<Record<string, number> | null>(null)
  const [loading, setLoading] = useState(false)
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

  const fetchLogs = async (requestedPage?: number) => {
    const targetPage = requestedPage ?? page
    setLoading(true)
    setPage(targetPage)
    try {
      const res = await auditApi.list({ ...params, page: targetPage, pageSize: 10 })
      if (res.success && res.data) {
        setLogs(res.data.items)
        setTotal(res.data.total)
      }
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
        message.error(res.error?.message ?? '加载审计详情失败')
        setDetailOpen(false)
      }
    } catch {
      message.error('加载审计详情失败')
      setDetailOpen(false)
    } finally {
      setDetailLoading(false)
    }
  }

  useEffect(() => { fetchLogs(1); fetchStats(); fetchExtended() }, [])

  const columns: ProColumn<AuditLogDto>[] = [
    { title: '时间', dataIndex: 'createdAt', key: 'createdAt', width: 180, sorter: (a, b) => a.createdAt.localeCompare(b.createdAt), defaultSortOrder: 'descend', render: (v) => new Date(String(v)).toLocaleString('zh-CN') },
    { title: '用户', dataIndex: 'userId', key: 'userId', width: 120, searchable: true, sorter: (a, b) => String(a.userId).localeCompare(String(b.userId)) },
    { title: '操作', dataIndex: 'action', key: 'action', width: 100, filters: ['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'EXPORT', 'PRINT'].map((value) => ({ text: value, value })), onFilter: (value, record) => record.action === value, render: (v) => {
      const colorMap: Record<string, string> = { CREATE: 'green', UPDATE: 'blue', DELETE: 'red', LOGIN: 'cyan', LOGOUT: 'default', EXPORT: 'orange', PRINT: 'purple' }
      return <Tag color={colorMap[String(v)] ?? 'default'}>{String(v)}</Tag>
    }},
    { title: '资源', dataIndex: 'resource', key: 'resource', width: 200, searchable: true, sorter: (a, b) => a.resource.localeCompare(b.resource) },
    { title: 'IP地址', dataIndex: 'ip', key: 'ip', width: 130, render: (v) => <Tooltip title={String(v ?? '-')}><span style={{ fontFamily: 'monospace', fontSize: 12 }}>{String(v ?? '-')}</span></Tooltip> },
    { title: '详情', dataIndex: 'details', key: 'details', ellipsis: true, render: (value) => String(value ?? '-') },
    { title: '操作', key: 'actions', width: 90, render: (_value, record) => (
      <Button size="small" type="link" icon={<EyeOutlined />} onClick={() => handleViewDetail(record.id)}>详情</Button>
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
      message.error((e as Error)?.message || '导出失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: 24 }}>
      <Card>
        <Space orientation="vertical" style={{ width: '100%' }}>
<Row justify="space-between" align="middle">
<PageHeader variant="flex" icon={<AuditOutlined />} title="审计日志" style={{ marginBottom: 0 }} />
            <Space>
              <Button icon={<DownloadOutlined />} onClick={handleExport}>导出</Button>
              <Button icon={<ReloadOutlined />} onClick={() => { fetchLogs(1); fetchStats(); fetchExtended() }}>刷新</Button>
            </Space>
          </Row>
          <Tabs items={[
            {
              key: 'overview',
              label: <span><BarChartOutlined /> 统计概览</span>,
              children: stats ? (
                <>
                  <Row gutter={16}>
                    <Col span={4}><Card size="small"><Statistic title="总日志数" value={stats.total} prefix={<AuditOutlined />} /></Card></Col>
                    <Col span={4}><Card size="small"><Statistic title="24h 内" value={stats.last24h} prefix={<BarChartOutlined />} /></Card></Col>
                    {/* [Wave 4B] 后端 GET /audit/overview 真实数据 */}
                    <Col span={4}><Card size="small"><Statistic title="今日操作" value={overview?.todayOperations ?? '-'} prefix={<LineChartOutlined />} /></Card></Col>
                    <Col span={4}><Card size="small"><Statistic title="活跃用户" value={overview?.activeUsers ?? '-'} prefix={<UserOutlined />} /></Card></Col>
                    <Col span={4}><Card size="small"><Statistic title="高危操作" value={overview?.highRiskCount ?? '-'} prefix={<WarningOutlined />} styles={{ content: { color: (overview?.highRiskCount ?? 0) > 0 ? '#fa8c16' : '#52c41a' } }} /></Card></Col>
                    <Col span={4}><Card size="small"><Statistic title="成功率" value={overview ? `${overview.successRate}%` : '-'} prefix={<SafetyCertificateOutlined />} styles={{ content: { color: (overview?.successRate ?? 0) >= 90 ? '#52c41a' : '#fa8c16' } }} /></Card></Col>
                    {overview?.seeded === true && (
                      <Col span={24} style={{ marginTop: 4 }}>
                        <Tag color="gold" style={{ fontSize: 11 }}>种子数据（后端不可用回退）</Tag>
                      </Col>
                    )}
                    {byAction && Object.keys(byAction).length > 0 && (
                      <Col span={24} style={{ marginTop: 12 }}>
                        <Card size="small" title="按操作类型分布 (Top)">
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
                    <Card size="small" title={<span><LineChartOutlined /> 近 30 日操作趋势</span>} style={{ marginTop: 12 }}>
                      <Row gutter={[8, 8]}>
                        {trend.slice(-14).map((p) => {
                          const max = Math.max(...trend.map((t) => t.total), 1)
                          return (
                            <Col key={p.date} span={Math.floor(24 / Math.min(trend.slice(-14).length, 14))}>
                              <div style={{ textAlign: 'center' }}>
                                <Tooltip title={`${p.label} 总操作 ${p.total} · 高危 ${p.highRisk} · 失败 ${p.failed}`}>
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
                      <Card size="small" title={<span><UserOutlined /> 用户活跃排行</span>}>
                        {userActivity.length === 0 ? (
                          <div style={{ color: '#999', fontSize: 12, textAlign: 'center', padding: 16 }}>暂无数据</div>
                        ) : (
                          <List
                            size="small"
                            dataSource={userActivity.slice(0, 10)}
                            renderItem={(u, i) => (
                              <List.Item>
                                <Space>
                                  <Tag color={i === 0 ? 'gold' : i < 3 ? 'blue' : 'default'}>{i + 1}</Tag>
                                  <b>{u.userName ?? u.userId}</b>
                                  <span style={{ fontSize: 12, color: '#999' }}>{u.count} 次</span>
                                  <Progress percent={u.successRate} size="small" style={{ width: 90 }} format={(p) => `${p}%`} />
                                </Space>
                                <span style={{ fontSize: 11, color: '#999' }}>最近 {new Date(u.lastActive).toLocaleString('zh-CN')}</span>
                              </List.Item>
                            )}
                          />
                        )}
                      </Card>
                    </Col>
                    {/* [Wave 4B] 高危操作清单 (GET /audit/high-risk) */}
                    <Col span={12}>
                      <Card size="small" title={<span><WarningOutlined /> 高危操作清单</span>} extra={highRisk ? <Tag color="red">共 {highRisk.total} 次</Tag> : null}>
                        {!highRisk || highRisk.actions.length === 0 ? (
                          <div style={{ color: '#999', fontSize: 12, textAlign: 'center', padding: 16 }}>暂无高危操作</div>
                        ) : (
                          <ProTable<AuditHighRiskActionDto>
                            dataSource={highRisk.actions.slice(0, 10)}
                            columns={[
                              { title: '操作', dataIndex: 'action', key: 'action', render: (v) => <Tag color="red" style={{ fontFamily: 'monospace' }}>{String(v)}</Tag> },
                              { title: '分类', dataIndex: 'patternZh', key: 'pattern', width: 90, render: (v) => <Tag>{String(v)}</Tag> },
                              { title: '次数', dataIndex: 'count', key: 'count', width: 70, sorter: (a, b) => a.count - b.count },
                              { title: '最近时间', dataIndex: 'lastAt', key: 'lastAt', width: 150, render: (v) => v ? new Date(String(v)).toLocaleString('zh-CN') : '-' },
                              { title: '涉及用户', dataIndex: 'recentUsers', key: 'users', render: (v) => Array.isArray(v) ? (v as string[]).slice(0, 3).join('、') : '-' },
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
              ) : <Card size="small"><Statistic title="加载中..." value="-" /></Card>,
            },
            {
              key: 'logs',
              label: <span><FilterOutlined /> 日志列表</span>,
              children: (
                <>
                  <Space style={{ marginBottom: 16 }}>
                    <Select allowClear placeholder="操作类型" style={{ width: 150 }} onChange={(v) => setParams((p) => ({ ...p, action: v }))} options={['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'EXPORT', 'PRINT'].map((a) => ({ value: a, label: a }))} />
                    <Select allowClear placeholder="资源类型" style={{ width: 150 }} onChange={(v) => setParams((p) => ({ ...p, resource: v }))} options={['patient', 'report', 'user', 'exam', 'dicom'].map((r) => ({ value: r, label: r }))} />
                    <Button type="primary" icon={<Search size={14} />} onClick={() => fetchLogs(1)}>查询</Button>
                  </Space>
                  <ProTable<AuditLogDto>
                    dataSource={logs}
                    columns={columns}
                    rowKey="id"
                    loading={loading}
                    showToolbar={false}
                    pagination={{ current: page, pageSize: 10, total, showTotal: (t) => `共 ${t} 条`, onChange: (nextPage) => fetchLogs(nextPage) }}
                    size="small"
                  />
                </>
              ),
            },
            {
              key: 'policy',
              label: <span><AuditOutlined /> 审计策略</span>,
              children: (
                <Card size="small">
                  <Descriptions bordered column={2}>
                    <Descriptions.Item label="日志保留期">365 天</Descriptions.Item>
                    <Descriptions.Item label="归档策略">自动归档到冷存储</Descriptions.Item>
                    <Descriptions.Item label="实时告警">异常登录检测</Descriptions.Item>
                    <Descriptions.Item label="日志加密">AES-256 加密存储</Descriptions.Item>
                  </Descriptions>
                </Card>
              ),
            },
          ]} />
        </Space>
      </Card>
      {/* [W2-C] 审计记录详情 Drawer */}
      <Drawer
        title={<Space><EyeOutlined /> 审计记录详情</Space>}
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
          <div style={{ textAlign: 'center', padding: 48 }}><Spin tip="加载中..." /></div>
        ) : detail ? (
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="记录 ID">{detail.id}</Descriptions.Item>
            <Descriptions.Item label="操作者">{detail.username ?? detail.userId}{detail.username && detail.username !== detail.userId ? ` (${detail.userId})` : ''}</Descriptions.Item>
            <Descriptions.Item label="角色">{detail.userRole ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="操作类型"><Tag>{detail.action}</Tag></Descriptions.Item>
            <Descriptions.Item label="资源">{detail.resource}</Descriptions.Item>
            <Descriptions.Item label="资源 ID">{detail.resourceId ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="请求详情">{Array.isArray(detail.details) ? (detail.details as string[]).join('；') : detail.details ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="响应状态">
              <Tag color={detail.status === 'SUCCESS' ? 'success' : detail.status === 'FAILURE' ? 'error' : detail.status === 'DENIED' ? 'warning' : 'default'}>
                {detail.status ?? '-'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="IP 地址"><span style={{ fontFamily: 'monospace' }}>{detail.ip ?? '-'}</span></Descriptions.Item>
            <Descriptions.Item label="User-Agent"><span style={{ fontSize: 12, wordBreak: 'break-all' }}>{detail.userAgent ?? '-'}</span></Descriptions.Item>
            <Descriptions.Item label="时间">{new Date(detail.createdAt).toLocaleString('zh-CN')}</Descriptions.Item>
          </Descriptions>
        ) : null}
      </Drawer>
    </div>
  )
}
