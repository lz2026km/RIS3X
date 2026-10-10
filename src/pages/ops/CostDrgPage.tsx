/**
 * [G005 W11-DeviceOps] 运营成本 / DRG 页
 * 真实成本核算 (直接/间接) + 收入成本对比 + DRG 分组绩效 + 定时 BI 报表
 * 数据源: /device-ops/cost/* + /device-ops/drg/* + /device-ops/scheduled-reports
 */
import { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Col,
  Input,
  message,
  Row,
  Space,
  Tabs,
  Tag,
  Typography,
} from "antd";
import { BarChart, Bar, CartesianGrid, Tooltip as RTooltip, XAxis, YAxis } from 'recharts'
import { BarChart3, DollarSign, FileText, RefreshCw, TrendingUp } from 'lucide-react'
import { ChartContainer, chartDefaults } from '../../components/charts'
import { DataTable, ExportButton, StatCard, StatCardGrid } from "../../components/common"
import { deviceOpsApi } from '../../services/api/deviceOpsApi'
import type { CostByExamRow, CostSummary, DrgGroups, ReportDefinition, ReportInstance } from '../../services/api/deviceOpsApi'
import { t } from '../../i18n/appI18n'

const { Text } = Typography
const fmtMoney = (v?: number) => (typeof v === 'number' ? `¥${v.toLocaleString()}` : t('w11Device.dash'))
const fmtDate = (v?: string) => (v ? String(v).replace('T', ' ').slice(0, 16) : t('w11Device.dash'))
const FREQ_LABEL: Record<string, string> = {
  daily: 'w11Device.report.freqDaily', weekly: 'w11Device.report.freqWeekly',
  monthly: 'w11Device.report.freqMonthly', manual: 'w11Device.report.freqManual',
}

export default function CostDrgPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [costSummary, setCostSummary] = useState<CostSummary | null>(null)
  const [byExam, setByExam] = useState<CostByExamRow[]>([])
  const [drg, setDrg] = useState<DrgGroups | null>(null)
  const [defs, setDefs] = useState<ReportDefinition[]>([])
  const [instances, setInstances] = useState<ReportInstance[]>([])
  const [diag, setDiag] = useState('I21.0')
  const [diagResult, setDiagResult] = useState<{ code: string; name: string; mdc: string; weight: number; payment: number } | null>(null)

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError('')
    const [cost, exam, drgRes, rd, ri] = await Promise.allSettled([
      deviceOpsApi.getCostSummary(), deviceOpsApi.getCostByExam(), deviceOpsApi.listDrg(),
      deviceOpsApi.listReportDefinitions(), deviceOpsApi.listReportInstances(),
    ])
    let any = false
    if (cost.status === 'fulfilled' && cost.value.success) { setCostSummary(cost.value.data ?? null); any = true }
    if (exam.status === 'fulfilled' && exam.value.success) { setByExam(exam.value.data?.items ?? []); any = true }
    if (drgRes.status === 'fulfilled' && drgRes.value.success) { setDrg(drgRes.value.data ?? null); any = true }
    if (rd.status === 'fulfilled' && rd.value.success) { setDefs(rd.value.data?.items ?? []); any = true }
    if (ri.status === 'fulfilled' && ri.value.success) { setInstances(ri.value.data?.items ?? []); any = true }
    if (!any) setError(t('w11Device.loadFailed'))
    setLoading(false)
  }, [])

  useEffect(() => { void loadAll() }, [loadAll])

  const handleRun = async (def: ReportDefinition) => {
    const res = await deviceOpsApi.runReportDefinition(def.id, 'manual')
    if (res.success) {
      message.success(t('w11Device.report.generated'))
      void loadAll()
    } else {
      message.error(res.error?.message ?? t('w11Device.loadFailed'))
    }
  }

  const handleGroup = async () => {
    const res = await deviceOpsApi.groupDiagnosis(diag, drg?.baseRate ?? 12000)
    if (res.success) setDiagResult(res.data ?? null)
    else message.error(res.error?.message ?? t('w11Device.loadFailed'))
  }

  const breakdown = costSummary?.breakdownTotals
  const breakdownData = breakdown ? [
    { name: t('w11Device.cost.consumables'), value: breakdown.consumables },
    { name: t('w11Device.cost.contrast'), value: breakdown.contrast },
    { name: t('w11Device.cost.labor'), value: breakdown.labor },
    { name: t('w11Device.cost.depreciation'), value: breakdown.depreciation },
    { name: t('w11Device.cost.overhead'), value: breakdown.overhead },
  ] : []

  const overviewTab = (
    <>
      <StatCardGrid minWidth={200} gap={16} style={{ marginBottom: 16 }}>
        <StatCard title={t('w11Device.cost.totalRevenue')} value={costSummary?.totalRevenue ?? 0} prefix="¥" color="primary" loading={loading} />
        <StatCard title={t('w11Device.cost.totalCost')} value={costSummary?.totalCost ?? 0} prefix="¥" color="warning" loading={loading} />
        <StatCard title={t('w11Device.cost.totalMargin')} value={costSummary?.margin.margin ?? 0} prefix="¥" color="success" loading={loading} />
        <StatCard title={t('w11Device.cost.marginPct')} value={costSummary?.margin.marginPct ?? 0} suffix="%" loading={loading} />
      </StatCardGrid>
      <Row gutter={16}>
        <Col span={12}>
          <Card size="small" title={t('w11Device.cost.byModality')}>
            <DataTable
              rowKey="modality" loading={loading} pagination={false}
              dataSource={costSummary?.byModality ?? []}
              columns={[
                { title: t('w11Device.cost.modality'), dataIndex: 'modality', key: 'modality', width: 90 },
                { title: t('w11Device.cost.volume'), dataIndex: 'volume', key: 'volume', width: 100, render: (v: number) => v.toLocaleString() },
                { title: t('w11Device.cost.revenue'), dataIndex: 'revenue', key: 'revenue', render: fmtMoney },
                { title: t('w11Device.cost.cost'), dataIndex: 'cost', key: 'cost', render: fmtMoney },
                { title: t('w11Device.cost.marginPct'), dataIndex: 'marginPct', key: 'marginPct', width: 90, render: (v: number) => <Tag color={v >= 0 ? 'green' : 'red'}>{v}%</Tag> },
              ]}
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card size="small" title={t('w11Device.cost.breakdown')}>
            {breakdownData.length > 0 ? (
              <ChartContainer type="bar" height={300}>
                <BarChart data={breakdownData} layout="vertical" margin={chartDefaults.margin}>
                  <CartesianGrid {...chartDefaults.grid} />
                  <XAxis type="number" {...chartDefaults.axis} />
                  <YAxis type="category" dataKey="name" width={80} {...chartDefaults.axis} />
                  <RTooltip {...chartDefaults.tooltip} formatter={(v) => fmtMoney(Number(v))} />
                  <Bar dataKey="value" name={t('w11Device.cost.cost')} fill="var(--color-primary-600)" />
                </BarChart>
              </ChartContainer>
            ) : <Text type="secondary">{t('w11Device.noData')}</Text>}
          </Card>
        </Col>
      </Row>
    </>
  )

  const byExamTab = (
    <Card size="small" title={t('w11Device.cost.byExam')}>
      <DataTable
        rowKey="examItem" loading={loading} scroll={{ x: 'max-content' }} pagination={{ pageSize: 10, showSizeChanger: false }}
        dataSource={byExam}
        columns={[
          { title: t('w11Device.cost.examItem'), dataIndex: 'examItem', key: 'examItem', ellipsis: true },
          { title: t('w11Device.cost.modality'), dataIndex: 'modality', key: 'modality', width: 90 },
          { title: t('w11Device.cost.volume'), dataIndex: 'volume', key: 'volume', width: 90, render: (v: number) => v.toLocaleString() },
          { title: t('w11Device.cost.unitPrice'), dataIndex: 'unitPrice', key: 'unitPrice', width: 90, render: fmtMoney },
          { title: t('w11Device.cost.unitCost'), dataIndex: 'unitCost', key: 'unitCost', width: 90, render: fmtMoney },
          { title: t('w11Device.cost.revenue'), dataIndex: 'totalRevenue', key: 'totalRevenue', width: 120, render: fmtMoney },
          { title: t('w11Device.cost.margin'), dataIndex: 'margin', key: 'margin', width: 120, render: (v: number) => <span style={{ color: v >= 0 ? 'var(--color-success-600)' : 'var(--color-error-600)' }}>{fmtMoney(v)}</span> },
          { title: t('w11Device.cost.marginPct'), dataIndex: 'marginPct', key: 'marginPct', width: 90, render: (v: number) => `${v}%` },
        ]}
      />
    </Card>
  )

  const drgTab = (
    <>
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space>
          <Text>{t('w11Device.drg.groupLookup')}:</Text>
          <Input value={diag} onChange={(e) => setDiag(e.target.value)} placeholder={t('w11Device.drg.diagPlaceholder')} style={{ width: 240 }} />
          <Button type="primary" onClick={() => void handleGroup()}>{t('w11Device.drg.groupBtn')}</Button>
          {diagResult && <Tag color="blue">{diagResult.code} · {diagResult.name} · {t('w11Device.drg.weight')} {diagResult.weight} · {fmtMoney(diagResult.payment)}</Tag>}
        </Space>
      </Card>
      <StatCardGrid minWidth={200} gap={16} style={{ marginBottom: 16 }}>
        <StatCard title={t('w11Device.drg.title')} value={drg?.totals.cases ?? 0} suffix="例" loading={loading} />
        <StatCard title={t('w11Device.drg.totalWeight')} value={drg?.totals.totalWeight ?? 0} loading={loading} />
        <StatCard title={t('w11Device.cost.revenue')} value={drg?.totals.revenue ?? 0} prefix="¥" color="primary" loading={loading} />
        <StatCard title={t('w11Device.cost.totalMargin')} value={drg?.totals.margin.margin ?? 0} prefix="¥" color="success" loading={loading} />
      </StatCardGrid>
      <Card size="small" title={t('w11Device.drg.title')} extra={<Text type="secondary">{t('w11Device.drg.baseRate')}: ¥{drg?.baseRate ?? 0}</Text>}>
        <DataTable
          rowKey="drgCode" loading={loading} scroll={{ x: 'max-content' }} pagination={false}
          dataSource={drg?.items ?? []}
          columns={[
            { title: t('w11Device.drg.code'), dataIndex: 'drgCode', key: 'code', width: 90 },
            { title: t('w11Device.drg.name'), dataIndex: 'name', key: 'name', ellipsis: true },
            { title: t('w11Device.drg.mdc'), dataIndex: 'mdc', key: 'mdc', width: 100 },
            { title: t('w11Device.drg.weight'), dataIndex: 'weight', key: 'weight', width: 80 },
            { title: t('w11Device.drg.cases'), dataIndex: 'cases', key: 'cases', width: 80 },
            { title: t('w11Device.drg.totalWeight'), dataIndex: 'totalWeight', key: 'tw', width: 110, render: (v: number) => v.toLocaleString() },
            { title: t('w11Device.drg.payment'), dataIndex: 'payment', key: 'payment', width: 130, render: fmtMoney },
            { title: t('w11Device.cost.margin'), dataIndex: 'margin', key: 'margin', width: 130, render: (v: number) => <span style={{ color: v >= 0 ? 'var(--color-success-600)' : 'var(--color-error-600)' }}>{fmtMoney(v)}</span> },
            { title: t('w11Device.cost.marginPct'), dataIndex: 'marginPct', key: 'marginPct', width: 100, render: (v: number) => `${v}%` },
          ]}
        />
      </Card>
    </>
  )

  const reportsTab = (
    <>
      <Card size="small" title={<Space><FileText size={14} />{t('w11Device.report.title')}</Space>} style={{ marginBottom: 16 }}>
        <DataTable
          rowKey="id" loading={loading} scroll={{ x: 'max-content' }} pagination={false}
          dataSource={defs}
          columns={[
            { title: t('w11Device.report.name'), dataIndex: 'name', key: 'name', ellipsis: true },
            { title: t('w11Device.report.frequency'), dataIndex: 'frequency', key: 'frequency', width: 90, render: (v: string) => <Tag>{t(FREQ_LABEL[v] ?? v)}</Tag> },
            { title: t('w11Device.report.timeOfDay'), dataIndex: 'timeOfDay', key: 'timeOfDay', width: 90 },
            { title: t('w11Device.report.recipients'), dataIndex: 'recipients', key: 'recipients', render: (v: string[]) => (v ?? []).join('、') || t('w11Device.dash') },
            { title: t('w11Device.report.format'), dataIndex: 'format', key: 'format', width: 80, render: (v: string) => <Tag color="blue">{String(v).toUpperCase()}</Tag> },
            { title: t('w11Device.report.enabled'), dataIndex: 'enabled', key: 'enabled', width: 80, render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? '●' : '○'}</Tag> },
            { title: t('w11Device.report.lastRun'), dataIndex: 'lastRunAt', key: 'lastRunAt', width: 150, render: fmtDate },
            { title: t('w11Device.report.nextRun'), dataIndex: 'nextRunAt', key: 'nextRunAt', width: 150, render: (v: string | null) => v ? fmtDate(v) : t('w11Device.report.freqManual') },
            { title: t('w11Device.wo.actions'), key: 'actions', width: 110, render: (_: unknown, r: ReportDefinition) => <Button size="small" type="link" onClick={() => void handleRun(r)}>{t('w11Device.report.runNow')}</Button> },
          ]}
        />
      </Card>
      <Card size="small" title={t('w11Device.report.instances')}>
        <DataTable
          rowKey="id" loading={loading} scroll={{ x: 'max-content' }} pagination={{ pageSize: 8, showSizeChanger: false }}
          dataSource={instances}
          columns={[
            { title: 'ID', dataIndex: 'id', key: 'id', width: 100 },
            { title: t('w11Device.report.name'), dataIndex: 'definitionName', key: 'definitionName', ellipsis: true },
            { title: t('w11Device.report.status'), dataIndex: 'status', key: 'status', width: 90, render: (v: string) => <Tag color={v === 'success' ? 'green' : v === 'failed' ? 'red' : 'blue'}>{t(v === 'success' ? 'w11Device.report.statusSuccess' : v === 'failed' ? 'w11Device.report.statusFailed' : 'w11Device.report.statusRunning')}</Tag> },
            { title: t('w11Device.report.rowCount'), dataIndex: 'rowCount', key: 'rowCount', width: 80 },
            { title: t('w11Device.report.size'), dataIndex: 'sizeKb', key: 'size', width: 90, render: (v: number) => `${v} KB` },
            { title: t('w11Device.report.frequency'), dataIndex: 'format', key: 'format', width: 80, render: (v: string) => String(v).toUpperCase() },
            { title: t('w11Device.report.deliveryLog'), dataIndex: 'deliveryLog', key: 'deliveryLog', render: (log: ReportInstance['deliveryLog']) => (log ?? []).map((l) => <Tag key={l.recipient} color={l.status === 'sent' ? 'green' : 'red'} style={{ marginBottom: 2 }}>{l.recipient}</Tag>) },
            { title: t('w11Device.report.lastRun'), dataIndex: 'generatedAt', key: 'generatedAt', width: 150, render: fmtDate },
          ]}
        />
      </Card>
    </>
  )

  return (
    <div style={{ padding: 24, background: 'var(--bg-card)', minHeight: 'calc(100vh - 56px)' }}>
      <Card style={{ background: 'linear-gradient(135deg,#7c3aed 0%,var(--color-primary-600) 100%)', color: '#fff', border: 'none', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space size={16}>
            <BarChart3 size={34} color="#fff" />
            <div>
              <div style={{ fontSize: 20, fontWeight: 800 }}>{t('costDrg.title')}</div>
              <div style={{ fontSize: 12, opacity: 0.9, marginTop: 4 }}>{t('costDrg.subtitle')}</div>
            </div>
          </Space>
          <Space>
            <Button icon={<RefreshCw size={14} />} loading={loading} onClick={() => void loadAll()}>{t('w11Device.refresh')}</Button>
            <ExportButton data={() => costSummary?.byModality ?? []} filename="cost-drg" label={t('w11Device.export')} size="small" formats={['csv', 'json']} />
          </Space>
        </div>
      </Card>

      {error && <Alert type="warning" showIcon message={error} style={{ marginBottom: 12 }} action={<Button size="small" onClick={() => void loadAll()}>{t('w11Device.retry')}</Button>} />}

      <Card>
        <Tabs
          items={[
            { key: 'overview', label: <><TrendingUp size={14} /> {t('costDrg.tabOverview')}</>, children: overviewTab },
            { key: 'byExam', label: <><DollarSign size={14} /> {t('costDrg.tabByExam')}</>, children: byExamTab },
            { key: 'drg', label: <><BarChart3 size={14} /> {t('costDrg.tabDrg')}</>, children: drgTab },
            { key: 'reports', label: <><FileText size={14} /> {t('costDrg.tabReports')}</>, children: reportsTab },
          ]}
        />
      </Card>
    </div>
  )
}
