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
  { name: 'CT', value: 425000, color: '#3b82f6' },
  { name: 'MRI', value: 512000, color: '#22c55e' },
  { name: 'X-Ray', value: 258000, color: '#f59e0b' },
  { name: 'Mammo', value: 185000, color: '#ef4444' },
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

const STATUS_META: Record<string, { label: string; color: string }> = {
  PAID: { label: '已支付', color: '#22c55e' },
  UNPAID: { label: '未支付', color: '#f59e0b' },
  PENDING: { label: '待支付', color: '#f59e0b' },
  REFUNDED: { label: '已退款', color: '#ef4444' },
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

const fmtMoney = (v?: number) => `¥${(v ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
const fmtDate = (iso?: string) => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function DepartmentFinancePage() {
  const [tab, setTab] = useState<PageTab>('overview')
  const [period, setPeriod] = useState<Period>('monthly')
  const [_revenueData, setRevenueData] = useState<RevenueAnalysisDto | null>(null)
  const [_costData, setCostData] = useState<CostAccountingDto | null>(null)

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
      else setInvError(res.error?.message ?? '加载失败')
    } catch (e) {
      setInvError((e as Error)?.message ?? '加载失败')
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
      else setRepError(res.error?.message ?? '加载失败')
    } catch (e) {
      setRepError((e as Error)?.message ?? '加载失败')
    } finally {
      setRepLoading(false)
    }
  }, [])

  useEffect(() => { void loadReports() }, [loadReports])

  const invOf = (r: any) => ({
    id: r?.invoiceId ?? r?.id ?? '',
    patientName: r?.patientName ?? r?.patientId ?? '未知患者',
    examItem: r?.items?.[0]?.itemName ?? r?.examItem ?? r?.invoiceNumber ?? '检查费用',
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
        message.error(res.error?.message ?? '加载发票详情失败')
        setDetailOpen(false)
      }
    } catch (e) {
      message.error((e as Error)?.message ?? '加载发票详情失败')
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
      message.warning('请填写有效支付金额')
      return
    }
    setPaying(true)
    try {
      const res = await financeApi.payInvoice({ invoiceId: payInvoice.id, amount, method: payMethod })
      if (res.success) {
        message.success(`发票 ${payInvoice.id} 支付成功 ${fmtMoney(amount)}`)
        setPayOpen(false)
        setPayInvoice(null)
        void loadInvoices()
        if (detail && detail.id === payInvoice.id) setDetail(null)
      } else {
        message.error(res.error?.message ?? '支付失败')
      }
    } catch (e) {
      message.error((e as Error)?.message ?? '支付失败')
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

  const totalRev = MONTHLY_REVENUE.reduce((s, m) => s + m.revenue, 0)
  const totalCost = MONTHLY_REVENUE.reduce((s, m) => s + m.cost, 0)
  const totalProfit = MONTHLY_REVENUE.reduce((s, m) => s + m.profit, 0)
  const margin = ((totalProfit / totalRev) * 100).toFixed(1)

  const modalStyle = { container: { background: '#161b22', color: '#f0f6fc' }, header: { background: '#161b22', color: '#f0f6fc', borderBottom: '1px solid #30363d' }, footer: { borderTop: '1px solid #30363d' } }

  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', color: '#f0f6fc', fontSize: 14, fontFamily: '"Segoe UI",sans-serif' }}>
      <div style={{ background: 'linear-gradient(135deg,#1e40af,#1e3a8a)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><DollarSign size={24} /><span style={{ fontSize: 20, fontWeight: 600 }}>科室财务管理</span></div>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['monthly', 'quarterly', 'yearly'] as const).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              style={{ padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, background: period === p ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)', color: '#fff' }}>
              {p === 'monthly' ? '月度' : p === 'quarterly' ? '季度' : '年度'}
            </button>
          ))}
          <button onClick={() => { const csv = '科室,收入,支出,利润\n' + ['CT','MR','DR','DSA','MG'].join('\n') + '\n'; const blob = new Blob([csv], { type: 'text/csv' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `科室财务_${period}.csv`; a.click(); URL.revokeObjectURL(url); message.success('已导出 ' + a.download); }} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, background: 'rgba(255,255,255,0.15)', color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Download size={14} />导出
          </button>
        </div>
      </div>

      {/* Tab 切换 */}
      <div style={{ display: 'flex', gap: 4, padding: '0 24px', marginTop: 12 }}>
        {([
          { key: 'overview', label: '财务总览', icon: PieIcon },
          { key: 'invoices', label: '发票管理', icon: Receipt },
          { key: 'reports', label: '财务报告', icon: FileText },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ padding: '9px 18px', borderRadius: '6px 6px 0 0', border: 'none', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, background: tab === t.key ? '#161b22' : 'transparent', color: tab === t.key ? '#f0f6fc' : '#8b949e', borderTop: tab === t.key ? '2px solid #3b82f6' : '2px solid transparent', fontWeight: tab === t.key ? 600 : 400 }}>
            <t.icon size={14} />{t.label}
          </button>
        ))}
        <div style={{ flex: 1, borderBottom: '1px solid #21262d' }} />
      </div>

      {tab === 'overview' && (
        <div style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
            {[
              { title: '总收入', value: totalRev.toLocaleString(), unit: '¥', icon: TrendingUp, trend: 'up', color: '#22c55e' },
              { title: '总成本', value: totalCost.toLocaleString(), unit: '¥', icon: TrendingDown, trend: 'up', color: '#ef4444' },
              { title: '净利润', value: totalProfit.toLocaleString(), unit: '¥', icon: DollarSign, trend: 'up', color: '#3b82f6' },
              { title: '利润率', value: margin, unit: '%', icon: PieIcon, trend: 'up', color: '#8b5cf6' },
            ].map((k, i) => (
              <div key={i} style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: '16px 20px', flex: 1, minWidth: 180 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: '#8b949e' }}>{k.title}</span>
                  <k.icon size={20} style={{ color: k.color }} />
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#f0f6fc' }}>{k.unit}{k.value}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
            <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#f0f6fc', display: 'flex', alignItems: 'center', gap: 8 }}>
                <TrendingUp size={16} color="#3b82f6" />月度收支趋势
              </div>
              <ChartContainer height={260} state={MONTHLY_REVENUE.length === 0 ? 'empty' : 'ready'} emptyDescription="暂无收支趋势数据">
                <LineChart data={MONTHLY_REVENUE}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#8b949e' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#8b949e' }} tickFormatter={v => `¥${(v / 1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 4, fontSize: 12 }} formatter={(v: number) => [`¥${v.toLocaleString()}`, undefined]} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="revenue" stroke="#22c55e" strokeWidth={2} dot={false} name="收入" />
                  <Line type="monotone" dataKey="cost" stroke="#ef4444" strokeWidth={2} dot={false} name="成本" />
                  <Line type="monotone" dataKey="profit" stroke="#3b82f6" strokeWidth={2} dot={false} name="利润" />
                </LineChart>
              </ChartContainer>
            </div>

            <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#f0f6fc', display: 'flex', alignItems: 'center', gap: 8 }}>
                <BarChart3 size={16} color="#f59e0b" />各检查类型收入分布
              </div>
              <ChartContainer height={260} state={REVENUE_BY_MODALITY.length === 0 ? 'empty' : 'ready'} emptyDescription="暂无类型收入数据">
                <BarChart data={REVENUE_BY_MODALITY}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#8b949e' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#8b949e' }} tickFormatter={v => `¥${(v / 1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 4, fontSize: 12 }} formatter={(v: number) => [`¥${v.toLocaleString()}`, '收入']} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {REVENUE_BY_MODALITY.map((e, i) => (
                      <Cell key={i} fill={e.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#f0f6fc', display: 'flex', alignItems: 'center', gap: 8 }}>
                <PieIcon size={16} color="#8b5cf6" />成本构成
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                <ChartContainer height={180} style={{ width: 180, flexShrink: 0 }}>
                  <PieChart>
                    <Pie data={COST_BREAKDOWN} cx="50%" cy="50%" outerRadius={80} dataKey="amount" nameKey="category" label={({ percent }) => `${(percent).toFixed(0)}%`}>
                      {COST_BREAKDOWN.map((_e, i) => {
                        const colors = ['#ef4444', '#f59e0b', '#3b82f6', '#22c55e', '#8b5cf6']
                        return <Cell key={i} fill={colors[i]} />
                      })}
                    </Pie>
                    <Tooltip contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 4, fontSize: 12 }} formatter={(v: number) => [`¥${v.toLocaleString()}`, '金额']} />
                  </PieChart>
                </ChartContainer>
                <div style={{ flex: 1 }}>
                  {COST_BREAKDOWN.map((c, i) => {
                    const colors = ['#ef4444', '#f59e0b', '#3b82f6', '#22c55e', '#8b5cf6']
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 12 }}>
                        <span style={{ width: 10, height: 10, borderRadius: 2, background: colors[i], display: 'inline-block' }} />
                        <span style={{ color: '#8b949e', flex: 1 }}>{c.category}</span>
                        <span style={{ color: '#f0f6fc', fontWeight: 600 }}>{c.percent}%</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#f0f6fc', display: 'flex', alignItems: 'center', gap: 8 }}>
                <BarChart3 size={16} color="#22c55e" />支付类型构成
              </div>
              {INSURANCE_MIX.map((im, i) => (
                <div key={i} style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                    <span style={{ color: '#8b949e' }}>{im.type}</span>
                    <span style={{ color: '#f0f6fc' }}>{im.percent}%</span>
                  </div>
                  <div style={{ height: 8, background: '#21262d', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${im.percent}%`, background: i === 0 ? '#3b82f6' : i === 1 ? '#22c55e' : i === 2 ? '#f59e0b' : '#8b5cf6', borderRadius: 4 }} />
                  </div>
                  <div style={{ fontSize: 12, color: '#6e7681', marginTop: 2 }}>¥{im.amount.toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'invoices' && (
        <div style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600 }}>
              <Receipt size={16} color="#3b82f6" />发票列表
              <span style={{ fontSize: 12, color: '#6e7681', fontWeight: 400 }}>共 {invoices.length} 张</span>
            </div>
            <button onClick={() => void loadInvoices()} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #30363d', background: '#21262d', color: '#8b949e', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}><RefreshCw size={13} />刷新</button>
          </div>

          {invError && (
            <div style={{ padding: 12, borderRadius: 6, background: '#ef444420', border: '1px solid #ef4444', color: '#fca5a5', marginBottom: 16, fontSize: 13 }}>
              加载失败:{invError}
              <button onClick={() => void loadInvoices()} style={{ marginLeft: 12, padding: '2px 10px', borderRadius: 4, border: 'none', background: '#ef4444', color: '#fff', cursor: 'pointer', fontSize: 12 }}>重试</button>
            </div>
          )}

          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '130px 120px 1fr 110px 110px 90px 150px', gap: 8, padding: '12px 16px', borderBottom: '1px solid #21262d', background: '#0d1117', color: '#8b949e', fontSize: 12, fontWeight: 600 }}>
              <span>发票号</span>
              <span>患者</span>
              <span>项目</span>
              <span style={{ textAlign: 'right' }}>总额</span>
              <span style={{ textAlign: 'right' }}>已付</span>
              <span>状态</span>
              <span style={{ textAlign: 'right' }}>操作</span>
            </div>
            {invLoading ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#8b949e' }}>
                <Spin size="large" />
                <div style={{ marginTop: 12, fontSize: 13 }}>加载发票...</div>
              </div>
            ) : invoices.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#6e7681', fontSize: 13 }}>暂无发票数据</div>
            ) : (
              invoices.map((r, idx) => {
                const inv = invOf(r)
                const st = STATUS_META[inv.status] ?? { label: inv.status, color: '#8b949e' }
                return (
                  <div key={inv.id} style={{ display: 'grid', gridTemplateColumns: '130px 120px 1fr 110px 110px 90px 150px', gap: 8, padding: '12px 16px', borderBottom: '1px solid #21262d', alignItems: 'center', background: idx % 2 === 0 ? '#0d1117' : '#161b22' }}>
                    <span style={{ fontSize: 12, fontFamily: 'monospace', color: '#93c5fd' }}>{inv.id}</span>
                    <span style={{ fontSize: 13 }}>{inv.patientName}</span>
                    <div>
                      <div style={{ fontSize: 13 }}>{inv.examItem}</div>
                      <div style={{ fontSize: 11, color: '#6e7681' }}>{fmtDate(inv.issuedAt)}</div>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600, textAlign: 'right' }}>{fmtMoney(inv.totalAmount)}</span>
                    <span style={{ fontSize: 12, color: '#22c55e', textAlign: 'right' }}>{fmtMoney(inv.paidAmount)}</span>
                    <span style={{ padding: '2px 10px', borderRadius: 4, fontSize: 12, fontWeight: 600, background: `${st.color}20`, color: st.color, width: 'fit-content' }}>{st.label}</span>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button onClick={() => void handleShowDetail(inv.id)} style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid #30363d', background: 'transparent', color: '#8b949e', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}><Eye size={12} />详情</button>
                      {inv.status === 'UNPAID' || inv.status === 'PENDING' ? (
                        <button onClick={() => handlePay(inv)} style={{ padding: '4px 10px', borderRadius: 4, border: 'none', background: '#22c55e', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600 }}><CreditCard size={12} />支付</button>
                      ) : (
                        <span style={{ fontSize: 11, color: '#6e7681' }}>—</span>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* 发票详情 Modal */}
          <Modal
            open={detailOpen}
            title="发票详情"
            footer={<button onClick={() => setDetailOpen(false)} style={{ padding: '6px 18px', borderRadius: 6, border: '1px solid #30363d', background: 'transparent', color: '#8b949e', cursor: 'pointer', fontSize: 13 }}>关闭</button>}
            onCancel={() => setDetailOpen(false)}
            width={520}
            styles={modalStyle}
          >
            {detailLoading ? (
              <div style={{ padding: 40, textAlign: 'center' }}><Spin /></div>
            ) : detail ? (
              <div style={{ marginTop: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>{detail.patientName}</div>
                    <div style={{ fontSize: 12, color: '#8b949e', marginTop: 2 }}>发票号:{detail.id} · {fmtDate(detail.issuedAt)}</div>
                  </div>
                  <span style={{ padding: '2px 10px', borderRadius: 4, fontSize: 12, fontWeight: 600, background: `${(STATUS_META[detail.status]?.color ?? '#8b949e')}20`, color: STATUS_META[detail.status]?.color ?? '#8b949e', height: 'fit-content' }}>
                    {STATUS_META[detail.status]?.label ?? detail.status}
                  </span>
                </div>

                {Array.isArray(detail.items) && detail.items.length > 0 && (
                  <div style={{ marginBottom: 12, border: '1px solid #21262d', borderRadius: 6, overflow: 'hidden' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 90px 90px', gap: 8, padding: '8px 12px', background: '#0d1117', color: '#8b949e', fontSize: 11, fontWeight: 600 }}>
                      <span>项目</span><span>数量</span><span style={{ textAlign: 'right' }}>单价</span><span style={{ textAlign: 'right' }}>小计</span>
                    </div>
                    {detail.items.map((it: any, i: number) => (
                      <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 60px 90px 90px', gap: 8, padding: '8px 12px', borderTop: '1px solid #21262d', fontSize: 12 }}>
                        <span>{it.itemName ?? it.name}</span>
                        <span style={{ color: '#8b949e' }}>{it.quantity ?? 1}</span>
                        <span style={{ textAlign: 'right', color: '#8b949e' }}>¥{Number(it.unitPrice ?? 0).toLocaleString()}</span>
                        <span style={{ textAlign: 'right', fontWeight: 600 }}>¥{Number(it.totalPrice ?? it.unitPrice ?? 0).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#8b949e' }}>总额</span><span style={{ fontWeight: 700, fontSize: 15 }}>{fmtMoney(detail.totalAmount)}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#8b949e' }}>已支付</span><span style={{ color: '#22c55e' }}>{fmtMoney(detail.paidAmount)}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#8b949e' }}>医保报销</span><span style={{ color: '#3b82f6' }}>{fmtMoney(detail.insuranceCovered)}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#8b949e' }}>自费金额</span><span style={{ color: '#f59e0b' }}>{fmtMoney(detail.selfPayAmount)}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#8b949e' }}>开票时间</span><span>{fmtDate(detail.issuedAt)}</span></div>
                  {detail.paidAt && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#8b949e' }}>支付时间</span><span>{fmtDate(detail.paidAt)}</span></div>}
                </div>
              </div>
            ) : (
              <div style={{ padding: 24, textAlign: 'center', color: '#6e7681' }}>未找到发票详情</div>
            )}
          </Modal>

          {/* 支付 Modal */}
          <Modal
            open={payOpen}
            title="发票支付"
            okText="确认支付"
            cancelText="取消"
            confirmLoading={paying}
            onOk={() => void confirmPay()}
            onCancel={() => { setPayOpen(false); setPayInvoice(null) }}
            width={440}
            styles={modalStyle}
          >
            {payInvoice && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 13, marginBottom: 4 }}>
                  发票 <span style={{ color: '#93c5fd', fontFamily: 'monospace' }}>{payInvoice.id}</span> · {payInvoice.patientName}
                </div>
                <div style={{ fontSize: 12, color: '#8b949e', marginBottom: 16 }}>
                  {payInvoice.examItem} · 总额 {fmtMoney(payInvoice.totalAmount)} · 已付 {fmtMoney(payInvoice.paidAmount)}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <div style={{ fontSize: 12, color: '#8b949e', marginBottom: 6 }}>支付金额(元)</div>
                    <Input type="number" min={0} value={payAmount} onChange={e => setPayAmount(e.target.value)} />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: '#8b949e', marginBottom: 6 }}>支付方式</div>
                    <Select value={payMethod} onChange={setPayMethod} style={{ width: '100%' }}
                      options={[
                        { value: 'CASH', label: '现金' },
                        { value: 'CARD', label: '银行卡' },
                        { value: 'ALIPAY', label: '支付宝' },
                        { value: 'WECHAT', label: '微信' },
                        { value: 'INSURANCE', label: '医保结算' },
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600 }}>
              <FileText size={16} color="#3b82f6" />财务报告
              <span style={{ fontSize: 12, color: '#6e7681', fontWeight: 400 }}>getFinancialReports · 流水 {summary.total} 条</span>
            </div>
            <button onClick={() => void loadReports()} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #30363d', background: '#21262d', color: '#8b949e', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}><RefreshCw size={13} />刷新</button>
          </div>

          {repError && (
            <div style={{ padding: 12, borderRadius: 6, background: '#ef444420', border: '1px solid #ef4444', color: '#fca5a5', marginBottom: 16, fontSize: 13 }}>
              加载失败:{repError}
              <button onClick={() => void loadReports()} style={{ marginLeft: 12, padding: '2px 10px', borderRadius: 4, border: 'none', background: '#ef4444', color: '#fff', cursor: 'pointer', fontSize: 12 }}>重试</button>
            </div>
          )}

          {repLoading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#8b949e' }}>
              <Spin size="large" />
              <div style={{ marginTop: 12, fontSize: 13 }}>加载财务报告...</div>
            </div>
          ) : summary.total === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#6e7681', fontSize: 13 }}>暂无财务流水数据</div>
          ) : (
            <>
              {/* 汇总 KPI */}
              <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
                {[
                  { title: '流水总数', value: String(summary.total), color: '#3b82f6' },
                  { title: '应收总额', value: fmtMoney(summary.totalAmount), color: '#f59e0b' },
                  { title: '实收金额', value: fmtMoney(summary.paidAmount), color: '#22c55e' },
                  { title: '待收余额', value: fmtMoney(summary.balance), color: '#ef4444' },
                ].map((k, i) => (
                  <div key={i} style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: '14px 20px', flex: 1, minWidth: 160 }}>
                    <div style={{ fontSize: 12, color: '#8b949e', marginBottom: 6 }}>{k.title}</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: k.color }}>{k.value}</div>
                  </div>
                ))}
              </div>

              {/* 汇总表 */}
              <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 16, marginBottom: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#f0f6fc' }}>状态汇总表</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
                  {Object.entries(summary.byStatus).map(([st, count]) => {
                    const meta = STATUS_META[st] ?? { label: st, color: '#8b949e' }
                    return (
                      <div key={st} style={{ border: `1px solid ${meta.color}40`, borderRadius: 6, padding: '10px 14px', background: `${meta.color}10` }}>
                        <div style={{ fontSize: 12, color: meta.color }}>{meta.label} ({st})</div>
                        <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>{count}<span style={{ fontSize: 12, color: '#8b949e', fontWeight: 400, marginLeft: 4 }}>张</span></div>
                      </div>
                    )
                  })}
                  {Object.keys(summary.byStatus).length === 0 && (
                    <div style={{ color: '#6e7681', fontSize: 13 }}>暂无状态统计</div>
                  )}
                </div>
              </div>

              {/* 趋势 */}
              <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#f0f6fc', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <TrendingUp size={16} color="#22c55e" />月度收入/实收趋势
                </div>
                {trendData.length === 0 ? (
                  <div style={{ padding: 24, textAlign: 'center', color: '#6e7681', fontSize: 13 }}>暂无趋势数据</div>
                ) : (
                  <ChartContainer height={260}>
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
                      <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#8b949e' }} />
                      <YAxis tick={{ fontSize: 12, fill: '#8b949e' }} tickFormatter={v => `¥${(v / 1000).toFixed(0)}k`} />
                      <Tooltip contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 4, fontSize: 12 }} formatter={(v: number) => [`¥${v.toLocaleString()}`, undefined]} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Line type="monotone" dataKey="revenue" stroke="#f59e0b" strokeWidth={2} dot={false} name="应收" />
                      <Line type="monotone" dataKey="paid" stroke="#22c55e" strokeWidth={2} dot={false} name="实收" />
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
