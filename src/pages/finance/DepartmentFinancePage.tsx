// [W1-5] 科室财务管理 — 新增: 发票管理(详情Modal+支付) / 财务报告(汇总表+趋势)
import { useState, useEffect, useCallback } from 'react'
import { Modal, Input, Select, message, Spin } from 'antd'
import { financeApi, type RevenueAnalysisDto, type CostAccountingDto } from '../../services/api/financeApi'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, PieChart, Pie, Cell,
} from 'recharts'
import { DollarSign, TrendingUp, TrendingDown, PieChart as PieIcon, BarChart3, Download, FileText, Receipt, RefreshCw, Eye, CreditCard } from 'lucide-react'
import { ChartContainer } from '../../components/charts'
import { DataTable } from '../../components/common/DataTable'
import { StatusTag } from '../../components/common/StatusTag'
import { statusTone } from '../../theme/statusTokens'
import FinanceAnalyticsSection from './FinanceAnalyticsSection'
import { t } from '../../i18n/appI18n'

type Period = 'monthly' | 'quarterly' | 'yearly'
type PageTab = 'overview' | 'invoices' | 'reports'

const MONTHLY_REVENUE = [
  { month: '1月', revenue: 328000, cost: 195000, profit: 133000 },
  { month: '2月', revenue: 298000, cost: 182000, profit: 116000 },
  { month: '3月', revenue: 356000, cost: 210000, profit: 146000 },
  { month: '4月', revenue: 342000, cost: 205000, profit: 137000 },
  { month: '5月', revenue: 385000, cost: 220000, profit: 165000 },
  { month: '6月', revenue: 372000, cost: 218000, profit: 154000 },
]

const REVENUE_BY_MODALITY = [
  { name: 'CT', value: 425000, color: 'var(--color-primary-500)' },
  { name: 'MRI', value: 512000, color: 'var(--color-success-500)' },
  { name: 'X-Ray', value: 258000, color: 'var(--color-warning-500)' },
  { name: 'Mammo', value: 185000, color: 'var(--color-error-500)' },
  { name: 'Ultrasound', value: 156000, color: '#8b5cf6' },
  { name: '其他', value: 89000, color: '#6e7681' },
]

const COST_BREAKDOWN = [
  { category: '人力成本', amount: 420000, percent: 38 },
  { category: '设备折旧', amount: 280000, percent: 25 },
  { category: '耗材', amount: 185000, percent: 17 },
  { category: '维护保养', amount: 120000, percent: 11 },
  { category: '其他', amount: 98000, percent: 9 },
]

const INSURANCE_MIX = [
  { type: '城镇职工医保', amount: 685000, percent: 48 },
  { type: '城镇居民医保', amount: 312000, percent: 22 },
  { type: '自费', amount: 256000, percent: 18 },
  { type: '商业保险', amount: 172000, percent: 12 },
]

// [UI] status colors unified via @/theme/statusTokens (single source)
const STATUS_META: Record<string, { label: string; tone: string }> = {
  PAID: { label: t('deptFinance.statusPaid'), tone: 'success' },
  UNPAID: { label: t('deptFinance.statusUnpaid'), tone: 'warning' },
  PENDING: { label: t('deptFinance.statusPending'), tone: 'warning' },
  REFUNDED: { label: t('deptFinance.statusRefunded'), tone: 'critical' },
}

const statusMeta = (status: unknown) => {
  const key = String(status ?? '')
  const meta = STATUS_META[key]
  return meta ?? { label: key, tone: key }
}

// ===== 发票/报告响应形状归一化 (MSW 裸数组 / Nest { items } / { data: [...] }) =====
function normalizeList(res: { success: boolean; data: unknown }): any[] {
  if (!res.success) return []
  const d = res.data as any
  if (Array.isArray(d)) return d as any[]
  if (d && Array.isArray(d.items)) return d.items as any[]
  if (d && Array.isArray(d.data)) return d.data as any[]
  return []
}

const fmtMoney = (v?: number) => `¥${(Number.isFinite(v) ? (v as number) : 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`

function DemoBadge() {
  return (
    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'var(--color-warning-bg, #fffbeb)', color: 'var(--color-warning-600)', border: '1px solid var(--color-warning-300, #fcd34d)', fontWeight: 600 }}>
      {t('deptFinance.demoData')}
    </span>
  )
}
const fmtDate = (iso?: string) => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function DepartmentFinancePage() {
  const [tab, setTab] = useState<PageTab>('overview')
  const [period, setPeriod] = useState<Period>('monthly')
  const [revenueData, setRevenueData] = useState<RevenueAnalysisDto | null>(null)
  const [costData, setCostData] = useState<CostAccountingDto | null>(null)

  // 发票
  const [invoices, setInvoices] = useState<any[]>([])
  const [invLoading, setInvLoading] = useState(true)
  const [invError, setInvError] = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detail, setDetail] = useState<any | null>(null)
  const [payOpen, setPayOpen] = useState(false)
  const [payInvoice, setPayInvoice] = useState<any | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const [payMethod, setPayMethod] = useState('CASH')
  const [paying, setPaying] = useState(false)

  // 财务报告
  const [reports, setReports] = useState<any[]>([])
  const [repLoading, setRepLoading] = useState(true)
  const [repError, setRepError] = useState<string | null>(null)

  useEffect(() => {
    financeApi.getRevenueAnalysis().then(res => { if (res.success) setRevenueData(res.data); }).catch((err) => { console.error('[F04]', err); })
    financeApi.getCostAccounting().then(res => { if (res.success) setCostData(res.data); }).catch((err) => { console.error('[F04]', err); })
  }, [period])

  const loadInvoices = useCallback(async () => {
    setInvLoading(true)
    setInvError(null)
    try {
      const res = await financeApi.listInvoices()
      if (res.success) setInvoices(normalizeList(res))
      else setInvError(res.error?.message ?? t('deptFinance.loadFailed'))
    } catch (e) {
      setInvError((e as Error)?.message ?? t('deptFinance.loadFailed'))
    } finally {
      setInvLoading(false)
    }
  }, [])

  useEffect(() => { void loadInvoices() }, [loadInvoices])

  const loadReports = useCallback(async () => {
    setRepLoading(true)
    setRepError(null)
    try {
      const res = await financeApi.getFinancialReports()
      if (res.success) setReports(normalizeList(res))
      else setRepError(res.error?.message ?? t('deptFinance.loadFailed'))
    } catch (e) {
      setRepError((e as Error)?.message ?? t('deptFinance.loadFailed'))
    } finally {
      setRepLoading(false)
    }
  }, [])

  useEffect(() => { void loadReports() }, [loadReports])

  const invOf = (r: any) => ({
    id: r?.invoiceId ?? r?.id ?? '',
    patientName: r?.patientName ?? r?.patientId ?? t('deptFinance.unknownPatient'),
    examItem: r?.items?.[0]?.itemName ?? r?.examItem ?? r?.invoiceNumber ?? t('deptFinance.examFee'),
    totalAmount: Number(r?.totalAmount ?? 0),
    paidAmount: Number(r?.paidAmount ?? (r?.status === 'PAID' ? r?.totalAmount : 0) ?? 0),
    insuranceCovered: Number(r?.insurancePaid ?? r?.insuranceCovered ?? 0),
    selfPayAmount: Number(r?.selfPaid ?? r?.selfPayAmount ?? r?.totalAmount ?? 0),
    status: String(r?.status ?? 'PENDING'),
    issuedAt: r?.issuedAt ?? r?.createdAt ?? r?.paidAt,
    paidAt: r?.paidAt,
    items: Array.isArray(r?.items) ? r.items : [],
  })

  const handleShowDetail = async (id: string) => {
    setDetailOpen(true)
    setDetailLoading(true)
    setDetail(null)
    try {
      const res = await financeApi.getInvoice(id)
      if (res.success) {
        const d = (res.data as any)
        const raw = Array.isArray(d) ? d[0] : Array.isArray(d?.data) ? d.data[0] : Array.isArray(d?.items) ? d.items[0] : d
        setDetail(invOf(raw))
      } else {
        message.error(res.error?.message ?? t('deptFinance.loadInvoiceDetailFailed'))
        setDetailOpen(false)
      }
    } catch (e) {
      message.error((e as Error)?.message ?? t('deptFinance.loadInvoiceDetailFailed'))
      setDetailOpen(false)
    } finally {
      setDetailLoading(false)
    }
  }

  const handlePay = (inv: any) => {
    setPayInvoice(inv)
    const balance = Math.max(0, inv.totalAmount - inv.paidAmount)
    setPayAmount(String(balance))
    setPayMethod('CASH')
    setPayOpen(true)
  }

  const confirmPay = async () => {
    const amount = Number(payAmount)
    if (!payInvoice || Number.isNaN(amount) || amount <= 0) {
      message.warning(t('deptFinance.validAmountRequired'))
      return
    }
    setPaying(true)
    try {
      const res = await financeApi.payInvoice({ invoiceId: payInvoice.id, amount, method: payMethod })
      if (res.success) {
        message.success(`${t('deptFinance.invoice')} ${payInvoice.id} ${t('deptFinance.paySuccess')} ${fmtMoney(amount)}`)
        setPayOpen(false)
        setPayInvoice(null)
        void loadInvoices()
        if (detail && detail.id === payInvoice.id) setDetail(null)
      } else {
        message.error(res.error?.message ?? t('deptFinance.payFailed'))
      }
    } catch (e) {
      message.error((e as Error)?.message ?? t('deptFinance.payFailed'))
    } finally {
      setPaying(false)
    }
  }

  // 财务报告: 汇总表 + 月度趋势 (响应为发票流水, 按状态/月份聚合)
  const reportSummary = useCallback(() => {
    const total = reports.length
    const totalAmount = reports.reduce((s, r) => s + Number(r?.totalAmount ?? 0), 0)
    const paidAmount = reports.reduce((s, r) => s + Number(r?.paidAmount ?? (r?.status === 'PAID' ? r?.totalAmount : 0) ?? 0), 0)
    const byStatus: Record<string, number> = {}
    const byMonth: Record<string, { revenue: number; paid: number; count: number }> = {}
    for (const r of reports) {
      const st = String(r?.status ?? 'PENDING')
      byStatus[st] = (byStatus[st] ?? 0) + 1
      const key = fmtDate(r?.issuedAt ?? r?.createdAt ?? r?.paidAt).slice(0, 7)
      if (key !== '—') {
        const e = (byMonth[key] ??= { revenue: 0, paid: 0, count: 0 })
        e.revenue += Number(r?.totalAmount ?? 0)
        e.paid += Number(r?.paidAmount ?? (r?.status === 'PAID' ? r?.totalAmount : 0) ?? 0)
        e.count += 1
      }
    }
    return { total, totalAmount, paidAmount, balance: totalAmount - paidAmount, byStatus, byMonth }
  }, [reports])

  const summary = reportSummary()
  const trendData = Object.entries(summary.byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({ month, revenue: v.revenue, paid: v.paid }))

  // [G005 W1-Controls P1-6] 单一数据源: API 存在则用 API, 否则回退演示并加徽标
  const apiRevenue = revenueData
  const hasApiRevenue = !!revenueData && Number.isFinite(revenueData.totalRevenue)
  const hasApiCost = !!costData && Number.isFinite(costData.total)
  const apiCostItems = costData
    ? [
        { label: t('w1Controls.deptFinance.labor'), value: Number(costData.laborCost) || 0, color: 'var(--color-error-500)' },
        { label: t('w1Controls.deptFinance.equipment'), value: Number(costData.equipmentDepreciation) || 0, color: 'var(--color-warning-500)' },
        { label: t('w1Controls.deptFinance.material'), value: Number(costData.materialCost) || 0, color: 'var(--color-primary-500)' },
        { label: t('w1Controls.deptFinance.maintenance'), value: Number(costData.maintenanceCost) || 0, color: 'var(--color-success-500)' },
        { label: t('w1Controls.deptFinance.other'), value: Number(costData.otherCost) || 0, color: '#8b5cf6' },
      ]
    : []
  const apiCostParts = apiCostItems.reduce((s, c) => s + (Number.isFinite(c.value) ? c.value : 0), 0)
  const apiCostTotal = hasApiCost && (costData?.total ?? 0) > 0 ? (costData as CostAccountingDto).total : apiCostParts

  const demoRev = MONTHLY_REVENUE.reduce((s, m) => s + m.revenue, 0)
  const demoCost = MONTHLY_REVENUE.reduce((s, m) => s + m.cost, 0)
  const demoProfit = MONTHLY_REVENUE.reduce((s, m) => s + m.profit, 0)
  const totalRev = hasApiRevenue ? revenueData!.totalRevenue : demoRev
  const totalCost = hasApiCost && (costData?.total ?? 0) > 0 ? (costData as CostAccountingDto).total : (hasApiRevenue ? revenueData!.totalCost : demoCost)
  const totalProfit = hasApiRevenue ? revenueData!.totalProfit : demoProfit
  const margin = totalRev > 0 ? ((totalProfit / totalRev) * 100).toFixed(1) : '0.0'

  // 月度趋势 / 模态收入 / 成本构成: 优先 API, 否则演示
  const monthlyTrendData = revenueData?.monthly && revenueData.monthly.length > 0
    ? revenueData.monthly.map(m => ({ month: m.month, revenue: m.revenue, cost: m.cost, profit: m.profit }))
    : MONTHLY_REVENUE
  const monthlyTrendIsDemo = !(revenueData?.monthly && revenueData.monthly.length > 0)
  const modalityBarData = hasApiRevenue && revenueData!.byModality.length > 0
    ? revenueData!.byModality.map((m, i) => ({ name: m.modality, value: m.revenue, color: ['var(--color-primary-500)', 'var(--color-success-500)', 'var(--color-warning-500)', 'var(--color-error-500)', '#8b5cf6', '#6e7681'][i % 6] }))
    : REVENUE_BY_MODALITY
  const modalityIsDemo = !(hasApiRevenue && revenueData!.byModality.length > 0)
  const costPieData = hasApiCost
    ? apiCostItems.map(c => ({ category: c.label, amount: c.value, color: c.color }))
    : COST_BREAKDOWN.map((c, i) => ({ category: c.category, amount: c.amount, color: ['var(--color-error-500)', 'var(--color-warning-500)', 'var(--color-primary-500)', 'var(--color-success-500)', '#8b5cf6'][i % 5] }))
  const costPieIsDemo = !hasApiCost

  const invoiceColumns = [
    { title: t('deptFinance.colInvoiceNo'), dataIndex: 'id', key: 'id', render: (v: string) => <span style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--color-primary-300)' }}>{v}</span> },
    {
      title: t('deptFinance.colPatient'), key: 'patientName',
      render: (_: unknown, r: any) => invOf(r).patientName,
    },
    {
      title: t('deptFinance.colItem'), key: 'examItem',
      render: (_: unknown, r: any) => {
        const inv = invOf(r)
        return (
          <div>
            <div>{inv.examItem}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{fmtDate(inv.issuedAt)}</div>
          </div>
        )
      },
    },
    { title: t('deptFinance.colTotal'), key: 'totalAmount', align: 'right' as const, render: (_: unknown, r: any) => <strong>{fmtMoney(invOf(r).totalAmount)}</strong> },
    { title: t('deptFinance.colPaid'), key: 'paidAmount', align: 'right' as const, render: (_: unknown, r: any) => <span style={{ color: 'var(--color-success)' }}>{fmtMoney(invOf(r).paidAmount)}</span> },
    {
      title: t('deptFinance.colStatus'), key: 'status',
      render: (_: unknown, r: any) => {
        const inv = invOf(r)
        const st = statusMeta(inv.status)
        return <StatusTag status={st.tone} size="md">{st.label}</StatusTag>
      },
    },
    {
      title: t('deptFinance.colActions'), key: 'actions', align: 'right' as const,
      render: (_: unknown, r: any) => {
        const inv = invOf(r)
        return (
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <button onClick={() => void handleShowDetail(inv.id)} style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)', fontSize: 12 }}><Eye size={12} />{t('deptFinance.detail')}</button>
            {inv.status === 'UNPAID' || inv.status === 'PENDING' ? (
              <button onClick={() => handlePay(inv)} style={{ padding: '4px 10px', borderRadius: 4, border: 'none', background: 'var(--color-success)', color: 'var(--text-inverse)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)', fontSize: 12, fontWeight: 600 }}><CreditCard size={12} />{t('deptFinance.pay')}</button>
            ) : (
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>—</span>
            )}
          </div>
        )
      },
    },
  ]

  const modalStyle = { container: { background: 'var(--bg-card)', color: 'var(--text-primary)' }, header: { background: 'var(--bg-card)', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-default)' }, footer: { borderTop: '1px solid var(--border-default)' } }

  // [G005 2B] 导出真实化: 用已加载 financeApi 数据 (发票/财务流水) 生成 CSV, 空数据禁用+提示
  const exportRows = reports.length > 0 ? reports : invoices
  const handleExport = () => {
    if (exportRows.length === 0) {
      message.warning(t('deptFinance.noDataToExport'))
      return
    }
    const header = '发票号,患者,项目,总额,已付,状态,开票日期'
    const body = exportRows.map(r => {
      const inv = invOf(r)
      return [inv.id, `"${String(inv.patientName).replace(/"/g, '""')}"`, `"${String(inv.examItem).replace(/"/g, '""')}"`, inv.totalAmount, inv.paidAmount, inv.status, fmtDate(inv.issuedAt)].join(',')
    }).join('\n')
    const csv = '\ufeff' + header + '\n' + body
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `科室财务_${period}.csv`
    a.click()
    URL.revokeObjectURL(url)
    message.success(`${t('deptFinance.exported')} ${exportRows.length} ${t('deptFinance.records')}`)
  }

  return (
    <div style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: 14, fontFamily: '"Segoe UI",sans-serif' }}>
      <div style={{ background: 'linear-gradient(135deg,var(--color-primary-800),var(--color-primary-900))', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3, 12px)' }}><DollarSign size={24} /><span style={{ fontSize: 20, fontWeight: 600 }}>{t('deptFinance.title')}</span></div>
        <div style={{ display: 'flex', gap: 'var(--space-2, 8px)' }}>
          {(['monthly', 'quarterly', 'yearly'] as const).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              style={{ padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, background: period === p ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)', color: 'var(--text-inverse)' }}>
              {p === 'monthly' ? t('deptFinance.periodMonthly') : p === 'quarterly' ? t('deptFinance.periodQuarterly') : t('deptFinance.periodYearly')}
            </button>
          ))}
          <button onClick={handleExport} disabled={exportRows.length === 0} title={exportRows.length === 0 ? t('deptFinance.noDataCannotExport') : `${t('deptFinance.export')} ${exportRows.length} ${t('deptFinance.records')}`} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', cursor: exportRows.length === 0 ? 'not-allowed' : 'pointer', fontSize: 12, background: exportRows.length === 0 ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.15)', color: exportRows.length === 0 ? 'rgba(255,255,255,0.45)' : 'var(--text-inverse)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Download size={14} />{t('deptFinance.export')}
          </button>
        </div>
      </div>

      {/* Tab 切换 */}
      <div style={{ display: 'flex', gap: 'var(--space-1, 4px)', padding: '0 24px', marginTop: 'var(--space-3, 12px)' }}>
        {([
          { key: 'overview', label: t('deptFinance.tabOverview'), icon: PieIcon },
          { key: 'invoices', label: t('deptFinance.tabInvoices'), icon: Receipt },
          { key: 'reports', label: t('deptFinance.tabReports'), icon: FileText },
        ] as const).map(tabItem => (
          <button key={tabItem.key} onClick={() => setTab(tabItem.key)}
            style={{ padding: '9px 18px', borderRadius: '6px 6px 0 0', border: 'none', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, background: tab === tabItem.key ? 'var(--bg-card)' : 'transparent', color: tab === tabItem.key ? 'var(--text-primary)' : 'var(--text-secondary)', borderTop: tab === tabItem.key ? '2px solid var(--color-primary)' : '2px solid transparent', fontWeight: tab === tabItem.key ? 600 : 400 }}>
            <tabItem.icon size={14} />{tabItem.label}
          </button>
        ))}
        <div style={{ flex: 1, borderBottom: '1px solid var(--border-default)' }} />
      </div>

      {tab === 'overview' && (
        <div style={{ padding: '20px 24px' }}>
          <FinanceAnalyticsSection />
          <div style={{ display: 'flex', gap: 'var(--space-4, 16px)', marginBottom: 'var(--space-6, 24px)', flexWrap: 'wrap' }}>
            {[
              { title: t('deptFinance.totalRevenue'), value: totalRev.toLocaleString(), unit: '¥', icon: TrendingUp, trend: 'up', color: 'var(--color-success)' },
              { title: t('deptFinance.totalCost'), value: totalCost.toLocaleString(), unit: '¥', icon: TrendingDown, trend: 'up', color: 'var(--color-error)' },
              { title: t('deptFinance.netProfit'), value: totalProfit.toLocaleString(), unit: '¥', icon: DollarSign, trend: 'up', color: 'var(--color-primary)' },
              { title: t('deptFinance.profitMargin'), value: margin, unit: '%', icon: PieIcon, trend: 'up', color: 'var(--color-modality-mr)' },
            ].map((k, i) => (
              <div key={i} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 8, padding: '16px 20px', flex: 1, minWidth: 180 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-2, 8px)' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{k.title}</span>
                  <k.icon size={20} style={{ color: k.color }} />
                </div>
                <div style={{ fontSize: 30, fontWeight: 700, color: 'var(--text-primary)' }}>{k.unit}{k.value}</div>
              </div>
            ))}
          </div>

          {/* [G005 W1-Controls P1-6] 真实接口数据 (revenue-analysis / cost-accounting) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)', marginBottom: 'var(--space-3, 12px)' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('w1Controls.deptFinance.apiSource')}</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>· {t('w1Controls.deptFinance.periodLabel')}: {apiRevenue?.period ?? costData?.period ?? period}</span>
            {!hasApiRevenue && !hasApiCost && <DemoBadge />}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4, 16px)', marginBottom: 'var(--space-6, 24px)' }}>
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 8, padding: 'var(--space-4, 16px)' }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 'var(--space-3, 12px)', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)' }}>
                <TrendingUp size={16} color="var(--color-success)" />{t('w1Controls.deptFinance.revenueProfit')}
              </div>
              {apiRevenue ? (
                <>
                  <div style={{ display: 'flex', gap: 'var(--space-4, 16px)', marginBottom: 'var(--space-3, 12px)', flexWrap: 'wrap' }}>
                    <div><div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{t('w1Controls.deptFinance.revenue')}</div><div style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-success)' }}>{fmtMoney(apiRevenue.totalRevenue)}</div></div>
                    <div><div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{t('w1Controls.deptFinance.cost')}</div><div style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-error)' }}>{fmtMoney(apiRevenue.totalCost)}</div></div>
                    <div><div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{t('w1Controls.deptFinance.profit')}</div><div style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-primary)' }}>{fmtMoney(apiRevenue.totalProfit)}</div></div>
                    <div><div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{t('deptFinance.profitMargin')}</div><div style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-modality-mr)' }}>{apiRevenue.profitMargin}%</div></div>
                  </div>
                  {apiRevenue.byModality.length > 0 && (
                    <ChartContainer height={200}>
                      <BarChart data={apiRevenue.byModality}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
                        <XAxis dataKey="modality" tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} />
                        <YAxis tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} tickFormatter={v => `¥${(v / 1000).toFixed(0)}k`} />
                        <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 4, fontSize: 12 }} formatter={(v: number) => [`¥${v.toLocaleString()}`, t('w1Controls.deptFinance.revenue')]} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Bar dataKey="revenue" fill="var(--color-success-500)" radius={[4, 4, 0, 0]} name={t('w1Controls.deptFinance.revenue')} />
                        <Bar dataKey="cost" fill="var(--color-error-500)" radius={[4, 4, 0, 0]} name={t('w1Controls.deptFinance.cost')} />
                      </BarChart>
                    </ChartContainer>
                  )}
                </>
              ) : (
                <div style={{ padding: 'var(--space-5, 20px)', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>{t('w1Controls.deptFinance.noApiData')}</div>
              )}
            </div>

            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 8, padding: 'var(--space-4, 16px)' }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 'var(--space-3, 12px)', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)' }}>
                <PieIcon size={16} color="var(--color-error)" />{t('w1Controls.deptFinance.costByItem')}
              </div>
              {costData ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-5, 20px)' }}>
                    <ChartContainer type="pie" height={160} style={{ width: 200, flexShrink: 0 }}>
                      <PieChart>
                        <Pie data={apiCostItems} cx="50%" cy="50%" outerRadius={70} dataKey="value" nameKey="label">
                          {apiCostItems.map((e, i) => <Cell key={i} fill={e.color} />)}
                        </Pie>
                        <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 4, fontSize: 12 }} formatter={(v: number) => [`¥${v.toLocaleString()}`, t('deptFinance.amount')]} />
                      </PieChart>
                    </ChartContainer>
                    <div style={{ flex: 1 }}>
                      {apiCostItems.map((c) => (
                        <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)', marginBottom: 'var(--space-2, 8px)', fontSize: 12 }}>
                          <span style={{ width: 10, height: 10, borderRadius: 2, background: c.color, display: 'inline-block' }} />
                          <span style={{ color: 'var(--text-secondary)', flex: 1 }}>{c.label}</span>
                          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{fmtMoney(c.value)}</span>
                        </div>
                      ))}
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-default)', paddingTop: 6, marginTop: 'var(--space-1, 4px)', fontSize: 12, fontWeight: 700 }}>
                        <span style={{ color: 'var(--text-secondary)' }}>{t('w1Controls.deptFinance.costTotal')}</span>
                        <span>{fmtMoney(apiCostTotal)}</span>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ padding: 'var(--space-5, 20px)', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>{t('w1Controls.deptFinance.noApiData')}</div>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4, 16px)', marginBottom: 'var(--space-6, 24px)' }}>
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 8, padding: 'var(--space-4, 16px)' }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 'var(--space-3, 12px)', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)' }}>
                <TrendingUp size={16} color="var(--color-primary)" />{t('deptFinance.monthlyTrend')}
                {monthlyTrendIsDemo && <DemoBadge />}
              </div>
              <ChartContainer height={260} state={monthlyTrendData.length === 0 ? 'empty' : 'ready'} emptyDescription={t('deptFinance.noTrendData')}>
                <LineChart data={monthlyTrendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} />
                  <YAxis tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} tickFormatter={v => `¥${(v / 1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 4, fontSize: 12 }} formatter={(v: number) => [`¥${v.toLocaleString()}`, undefined]} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="revenue" stroke="var(--color-success-500)" strokeWidth={2} dot={false} name={t('deptFinance.revenue')} />
                  <Line type="monotone" dataKey="cost" stroke="var(--color-error-500)" strokeWidth={2} dot={false} name={t('deptFinance.cost')} />
                  <Line type="monotone" dataKey="profit" stroke="var(--color-primary-500)" strokeWidth={2} dot={false} name={t('deptFinance.profit')} />
                </LineChart>
              </ChartContainer>
            </div>

            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 8, padding: 'var(--space-4, 16px)' }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 'var(--space-3, 12px)', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)' }}>
                <BarChart3 size={16} color="var(--color-warning)" />{t('deptFinance.revenueByModality')}
                {modalityIsDemo && <DemoBadge />}
              </div>
              <ChartContainer height={260} state={modalityBarData.length === 0 ? 'empty' : 'ready'} emptyDescription={t('deptFinance.noModalityData')}>
                <BarChart data={modalityBarData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} />
                  <YAxis tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} tickFormatter={v => `¥${(v / 1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 4, fontSize: 12 }} formatter={(v: number) => [`¥${v.toLocaleString()}`, t('deptFinance.revenue')]} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {modalityBarData.map((e, i) => (
                      <Cell key={i} fill={e.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4, 16px)' }}>
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 8, padding: 'var(--space-4, 16px)' }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 'var(--space-3, 12px)', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)' }}>
                <PieIcon size={16} color="var(--color-modality-mr)" />{t('deptFinance.costStructure')}
                {costPieIsDemo && <DemoBadge />}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-6, 24px)' }}>
                <ChartContainer type="pie" height={180} style={{ width: 220, flexShrink: 0 }}>
                  <PieChart>
                    <Pie data={costPieData} cx="50%" cy="50%" outerRadius={58} dataKey="amount" nameKey="category" labelLine={false} label={({ percent }) => `${((percent ?? 0) * 100).toFixed(0)}%`}>
                      {costPieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 4, fontSize: 12 }} formatter={(v: number) => [`¥${v.toLocaleString()}`, t('deptFinance.amount')]} />
                  </PieChart>
                </ChartContainer>
                <div style={{ flex: 1 }}>
                  {costPieData.map((c, i) => {
                    const pct = apiCostTotal > 0 ? (c.amount / apiCostTotal) * 100 : 0
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)', marginBottom: 'var(--space-2, 8px)', fontSize: 12 }}>
                        <span style={{ width: 10, height: 10, borderRadius: 2, background: c.color, display: 'inline-block' }} />
                        <span style={{ color: 'var(--text-secondary)', flex: 1 }}>{c.category}</span>
                        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{pct.toFixed(0)}%</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 8, padding: 'var(--space-4, 16px)' }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 'var(--space-3, 12px)', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)' }}>
                <BarChart3 size={16} color="var(--color-success)" />{t('deptFinance.paymentMix')}
                <DemoBadge />
              </div>
              {INSURANCE_MIX.map((im, i) => (
                <div key={i} style={{ marginBottom: 'var(--space-4, 16px)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 'var(--space-1, 4px)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{im.type}</span>
                    <span style={{ color: 'var(--text-primary)' }}>{im.percent}%</span>
                  </div>
                  <div style={{ height: 8, background: 'var(--bg-secondary,#f8fafc)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${im.percent}%`, background: i === 0 ? 'var(--color-primary-500)' : i === 1 ? 'var(--color-success-500)' : i === 2 ? 'var(--color-warning-500)' : '#8b5cf6', borderRadius: 4 }} />
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>¥{im.amount.toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'invoices' && (
        <div style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4, 16px)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)', fontSize: 14, fontWeight: 600 }}>
              <Receipt size={16} color="var(--color-primary)" />{t('deptFinance.invoiceList')}
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400 }}>{t('deptFinance.totalCount')} {invoices.length} {t('deptFinance.units')}</span>
            </div>
            <button onClick={() => void loadInvoices()} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid var(--border-default)', background: 'var(--bg-secondary,#f8fafc)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}><RefreshCw size={13} />{t('deptFinance.refresh')}</button>
          </div>

          {invError && (
            <div style={{ padding: 'var(--space-3, 12px)', borderRadius: 6, background: 'color-mix(in srgb, var(--color-error) 14%, transparent)', border: '1px solid var(--color-error)', color: 'var(--color-error)', marginBottom: 'var(--space-4, 16px)', fontSize: 12 }}>
              {t('deptFinance.loadFailed')}:{invError}
              <button onClick={() => void loadInvoices()} style={{ marginLeft: 'var(--space-3, 12px)', padding: '2px 10px', borderRadius: 4, border: 'none', background: 'var(--color-error)', color: 'var(--text-inverse)', cursor: 'pointer', fontSize: 12 }}>{t('deptFinance.retry')}</button>
            </div>
          )}

          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 8, overflow: 'hidden' }}>
            <DataTable dataSource={invoices} rowKey={(r: any) => invOf(r).id} columns={invoiceColumns} loading={invLoading} pagination={{ pageSize: 10, showSizeChanger: false }} emptyText={t('deptFinance.noInvoices')} />
          </div>

          {/* 发票详情 Modal */}
          <Modal
            open={detailOpen}
            title={t('deptFinance.invoiceDetail')}
            footer={<button onClick={() => setDetailOpen(false)} style={{ padding: '6px 18px', borderRadius: 6, border: '1px solid var(--border-default)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12 }}>{t('deptFinance.close')}</button>}
            onCancel={() => setDetailOpen(false)}
            width={560}
            styles={modalStyle}
          >
            {detailLoading ? (
              <div style={{ padding: 'var(--space-10, 40px)', textAlign: 'center' }}><Spin /></div>
            ) : detail ? (
              <div style={{ marginTop: 'var(--space-2, 8px)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-3, 12px)' }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>{detail.patientName}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{t('deptFinance.invoiceNo')}:{detail.id} · {fmtDate(detail.issuedAt)}</div>
                  </div>
                  <StatusTag status={statusMeta(detail.status).tone} size="md" style={{ height: 'fit-content' }}>
                    {statusMeta(detail.status).label}
                  </StatusTag>
                </div>

                {Array.isArray(detail.items) && detail.items.length > 0 && (
                  <div style={{ marginBottom: 'var(--space-3, 12px)', border: '1px solid var(--border-default)', borderRadius: 6, overflow: 'hidden' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 90px 90px', gap: 'var(--space-2, 8px)', padding: '8px 12px', background: 'var(--bg-primary)', color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600 }}>
                      <span>{t('deptFinance.colItem')}</span><span>{t('deptFinance.quantity')}</span><span style={{ textAlign: 'right' }}>{t('deptFinance.unitPrice')}</span><span style={{ textAlign: 'right' }}>{t('deptFinance.subtotal')}</span>
                    </div>
                    {detail.items.map((it: any, i: number) => (
                      <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 60px 90px 90px', gap: 'var(--space-2, 8px)', padding: '8px 12px', borderTop: '1px solid var(--border-default)', fontSize: 12 }}>
                        <span>{it.itemName ?? it.name}</span>
                        <span style={{ color: 'var(--text-secondary)' }}>{it.quantity ?? 1}</span>
                        <span style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>¥{Number(it.unitPrice ?? 0).toLocaleString()}</span>
                        <span style={{ textAlign: 'right', fontWeight: 600 }}>¥{Number(it.totalPrice ?? it.unitPrice ?? 0).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>{t('deptFinance.colTotal')}</span><span style={{ fontWeight: 700, fontSize: 14 }}>{fmtMoney(detail.totalAmount)}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>{t('deptFinance.paidAmount')}</span><span style={{ color: 'var(--color-success)' }}>{fmtMoney(detail.paidAmount)}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>{t('deptFinance.insuranceCover')}</span><span style={{ color: 'var(--color-primary)' }}>{fmtMoney(detail.insuranceCovered)}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>{t('deptFinance.selfPayAmount')}</span><span style={{ color: 'var(--color-warning)' }}>{fmtMoney(detail.selfPayAmount)}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>{t('deptFinance.issueTime')}</span><span>{fmtDate(detail.issuedAt)}</span></div>
                  {detail.paidAt && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>{t('deptFinance.payTime')}</span><span>{fmtDate(detail.paidAt)}</span></div>}
                </div>
              </div>
            ) : (
              <div style={{ padding: 'var(--space-6, 24px)', textAlign: 'center', color: 'var(--text-muted)' }}>{t('deptFinance.invoiceDetailNotFound')}</div>
            )}
          </Modal>

          {/* 支付 Modal */}
          <Modal
            open={payOpen}
            title={t('deptFinance.invoicePay')}
            okText={t('deptFinance.confirmPay')}
            cancelText={t('deptFinance.cancel')}
            confirmLoading={paying}
            onOk={() => void confirmPay()}
            onCancel={() => { setPayOpen(false); setPayInvoice(null) }}
            width={420}
            styles={modalStyle}
          >
            {payInvoice && (
              <div style={{ marginTop: 'var(--space-2, 8px)' }}>
                <div style={{ fontSize: 12, marginBottom: 'var(--space-1, 4px)' }}>
                  {t('deptFinance.invoice')} <span style={{ color: 'var(--color-primary-300)', fontFamily: 'monospace' }}>{payInvoice.id}</span> · {payInvoice.patientName}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 'var(--space-4, 16px)' }}>
                  {payInvoice.examItem} · {t('deptFinance.colTotal')} {fmtMoney(payInvoice.totalAmount)} · {t('deptFinance.colPaid')} {fmtMoney(payInvoice.paidAmount)}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>{t('deptFinance.payAmount')}</div>
                    <Input type="number" min={0} value={payAmount} onChange={e => setPayAmount(e.target.value)} />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>{t('deptFinance.payMethod')}</div>
                    <Select value={payMethod} onChange={setPayMethod} style={{ width: '100%' }}
                      options={[
                        { value: 'CASH', label: t('deptFinance.methodCash') },
                        { value: 'CARD', label: t('deptFinance.methodCard') },
                        { value: 'ALIPAY', label: t('deptFinance.methodAlipay') },
                        { value: 'WECHAT', label: t('deptFinance.methodWechat') },
                        { value: 'INSURANCE', label: t('deptFinance.methodInsurance') },
                      ]} />
                  </div>
                </div>
              </div>
            )}
          </Modal>
        </div>
      )}

      {tab === 'reports' && (
        <div style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4, 16px)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)', fontSize: 14, fontWeight: 600 }}>
              <FileText size={16} color="var(--color-primary)" />{t('deptFinance.tabReports')}
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400 }}>getFinancialReports · {t('deptFinance.flowRecords')} {summary.total} {t('deptFinance.records')}</span>
            </div>
            <button onClick={() => void loadReports()} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid var(--border-default)', background: 'var(--bg-secondary,#f8fafc)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}><RefreshCw size={13} />{t('deptFinance.refresh')}</button>
          </div>

          {repError && (
            <div style={{ padding: 'var(--space-3, 12px)', borderRadius: 6, background: 'color-mix(in srgb, var(--color-error) 14%, transparent)', border: '1px solid var(--color-error)', color: 'var(--color-error)', marginBottom: 'var(--space-4, 16px)', fontSize: 12 }}>
              {t('deptFinance.loadFailed')}:{repError}
              <button onClick={() => void loadReports()} style={{ marginLeft: 'var(--space-3, 12px)', padding: '2px 10px', borderRadius: 4, border: 'none', background: 'var(--color-error)', color: 'var(--text-inverse)', cursor: 'pointer', fontSize: 12 }}>{t('deptFinance.retry')}</button>
            </div>
          )}

          {repLoading ? (
            <div style={{ padding: 'var(--space-10, 40px)', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <Spin size="large" />
              <div style={{ marginTop: 'var(--space-3, 12px)', fontSize: 12 }}>{t('deptFinance.loadingReports')}</div>
            </div>
          ) : summary.total === 0 ? (
            <div style={{ padding: 'var(--space-10, 40px)', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>{t('deptFinance.noReportsData')}</div>
          ) : (
            <>
              {/* 汇总 KPI */}
              <div style={{ display: 'flex', gap: 'var(--space-4, 16px)', marginBottom: 'var(--space-5, 20px)', flexWrap: 'wrap' }}>
                {[
                  { title: t('deptFinance.statTotalRecords'), value: String(summary.total), color: 'var(--color-primary)' },
                  { title: t('deptFinance.statTotalReceivable'), value: fmtMoney(summary.totalAmount), color: 'var(--color-warning)' },
                  { title: t('deptFinance.statPaid'), value: fmtMoney(summary.paidAmount), color: 'var(--color-success)' },
                  { title: t('deptFinance.statBalance'), value: fmtMoney(summary.balance), color: 'var(--color-error)' },
                ].map((k, i) => (
                  <div key={i} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 8, padding: '14px 20px', flex: 1, minWidth: 160 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>{k.title}</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: k.color }}>{k.value}</div>
                  </div>
                ))}
              </div>

              {/* 汇总表 */}
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 8, padding: 'var(--space-4, 16px)', marginBottom: 'var(--space-5, 20px)' }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 'var(--space-3, 12px)', color: 'var(--text-primary)' }}>{t('deptFinance.statusSummary')}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 'var(--space-3, 12px)' }}>
                  {Object.entries(summary.byStatus).map(([st, count]) => {
                    const meta = statusMeta(st)
                    const tone = statusTone(meta.tone)
                    return (
                      <div key={st} style={{ border: `1px solid ${tone.border}`, borderRadius: 6, padding: '10px 14px', background: tone.bg }}>
                        <div style={{ fontSize: 12, color: tone.color }}>{meta.label} ({st})</div>
                        <div style={{ fontSize: 20, fontWeight: 700, marginTop: 'var(--space-1, 4px)' }}>{count}<span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 400, marginLeft: 'var(--space-1, 4px)' }}>{t('deptFinance.units')}</span></div>
                      </div>
                    )
                  })}
                  {Object.keys(summary.byStatus).length === 0 && (
                    <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{t('deptFinance.noStatusStats')}</div>
                  )}
                </div>
              </div>

              {/* 趋势 */}
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 8, padding: 'var(--space-4, 16px)' }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 'var(--space-3, 12px)', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)' }}>
                  <TrendingUp size={16} color="var(--color-success)" />{t('deptFinance.monthlyRevenueTrend')}
                </div>
                {trendData.length === 0 ? (
                  <div style={{ padding: 'var(--space-6, 24px)', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>{t('deptFinance.noTrendData')}</div>
                ) : (
                  <ChartContainer height={260}>
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
                      <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} />
                      <YAxis tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} tickFormatter={v => `¥${(v / 1000).toFixed(0)}k`} />
                      <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 4, fontSize: 12 }} formatter={(v: number) => [`¥${v.toLocaleString()}`, undefined]} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Line type="monotone" dataKey="revenue" stroke="var(--color-warning-500)" strokeWidth={2} dot={false} name={t('deptFinance.receivable')} />
                      <Line type="monotone" dataKey="paid" stroke="var(--color-success-500)" strokeWidth={2} dot={false} name={t('deptFinance.received')} />
                    </LineChart>
                  </ChartContainer>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
