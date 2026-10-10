import { useState, useMemo, useEffect, useCallback } from 'react'
import { Clock, AlertTriangle, CheckCircle, Search, Download, Wallet } from 'lucide-react'
import { financeApi, type InvoiceDto } from '../../services/api/financeApi'
import { StateView } from '../../components/common/StateView'
import { DataTable } from '../../components/common/DataTable'
import { t } from '../../i18n/appI18n'

type AgingBucket = '0-30' | '31-60' | '61-90' | '90+'
type PayerFilter = 'all' | '医保(城镇职工)' | '医保(城乡居民)' | '商业保险' | '自费'

interface ReceivableItem {
  id: string
  patientName: string
  examItem: string
  examDate: string
  payer: string
  totalAmount: number
  paidAmount: number
  balance: number
  dueDate: string
  aging: AgingBucket
  status: 'current' | 'overdue' | 'paid' | 'write_off'
}

const PAYER_COLORS: Record<string, string> = {
  '医保(城镇职工)': '#3b82f6',
  '医保(城乡居民)': '#8b5cf6',
  '商业保险': '#059669',
  '自费': '#d97706',
  '公费/其他': '#6b7280',
}

// 回退演示数据: 仅当 financeApi 不可用时展示 (页面标注来源)
const MOCK_RECEIVABLES: ReceivableItem[] = [
  { id: 'ar-001', patientName: '张伟', examItem: 'CT增强(胸部)', examDate: '2026-04-15', payer: '医保(城镇职工)', totalAmount: 850, paidAmount: 595, balance: 255, dueDate: '2026-05-15', aging: '0-30', status: 'current' },
  { id: 'ar-002', patientName: '李娜', examItem: 'MRI平扫(头颅)', examDate: '2026-04-16', payer: '医保(城镇职工)', totalAmount: 780, paidAmount: 546, balance: 234, dueDate: '2026-05-16', aging: '0-30', status: 'current' },
  { id: 'ar-003', patientName: '王磊', examItem: '冠脉CTA', examDate: '2026-04-17', payer: '商业保险', totalAmount: 1500, paidAmount: 0, balance: 1500, dueDate: '2026-05-17', aging: '0-30', status: 'current' },
  { id: 'ar-004', patientName: '赵敏', examItem: 'DSA冠脉造影', examDate: '2026-03-18', payer: '医保(城乡居民)', totalAmount: 8500, paidAmount: 2000, balance: 6500, dueDate: '2026-04-17', aging: '31-60', status: 'overdue' },
  { id: 'ar-005', patientName: '周涛', examItem: 'MRI增强(腹部)', examDate: '2026-04-19', payer: '医保(城镇职工)', totalAmount: 1200, paidAmount: 0, balance: 1200, dueDate: '2026-05-19', aging: '0-30', status: 'current' },
  { id: 'ar-006', patientName: '吴静', examItem: 'CT平扫(头颅)', examDate: '2026-04-20', payer: '自费', totalAmount: 450, paidAmount: 450, balance: 0, dueDate: '2026-04-20', aging: '0-30', status: 'paid' },
  { id: 'ar-007', patientName: '郑强', examItem: 'DSA外周血管', examDate: '2026-03-01', payer: '商业保险', totalAmount: 6800, paidAmount: 1000, balance: 5800, dueDate: '2026-03-31', aging: '61-90', status: 'overdue' },
  { id: 'ar-008', patientName: '钱琳', examItem: '乳腺钼靶(双乳)', examDate: '2026-04-22', payer: '医保(城镇职工)', totalAmount: 280, paidAmount: 196, balance: 84, dueDate: '2026-05-22', aging: '0-30', status: 'current' },
  { id: 'ar-009', patientName: '孙鹏', examItem: '冠脉CTA', examDate: '2026-02-15', payer: '商业保险', totalAmount: 1500, paidAmount: 0, balance: 1500, dueDate: '2026-03-16', aging: '61-90', status: 'overdue' },
  { id: 'ar-010', patientName: '马超', examItem: 'CT增强(腹部)', examDate: '2026-04-24', payer: '医保(城镇职工)', totalAmount: 850, paidAmount: 0, balance: 850, dueDate: '2026-05-24', aging: '0-30', status: 'current' },
  { id: 'ar-011', patientName: '胡霞', examItem: 'MRI平扫(头颅)', examDate: '2026-01-10', payer: '医保(城乡居民)', totalAmount: 780, paidAmount: 0, balance: 780, dueDate: '2026-02-09', aging: '90+', status: 'overdue' },
  { id: 'ar-012', patientName: '林峰', examItem: 'CT低剂量肺筛查', examDate: '2026-04-26', payer: '自费', totalAmount: 320, paidAmount: 320, balance: 0, dueDate: '2026-04-26', aging: '0-30', status: 'paid' },
]

const AGING_BUCKETS: { key: AgingBucket; label: string; color: string }[] = [
  { key: '0-30', label: 'ar.aging.0_30', color: '#22c55e' },
  { key: '31-60', label: 'ar.aging.31_60', color: '#f59e0b' },
  { key: '61-90', label: 'ar.aging.61_90', color: '#fb923c' },
  { key: '90+', label: 'ar.aging.90plus', color: '#ef4444' },
]

const DAY_MS = 86400000

// financeApi.listInvoices → 应收条目 (过滤已结清, 按检查日期推算账龄)
const toReceivable = (inv: InvoiceDto): ReceivableItem => {
  const examDate = inv.examDate || (inv.createdAt ?? '').slice(0, 10) || ''
  const base = examDate ? new Date(examDate).getTime() : Date.now()
  const days = Math.max(0, Math.floor((Date.now() - base) / DAY_MS))
  const aging: AgingBucket = days <= 30 ? '0-30' : days <= 60 ? '31-60' : days <= 90 ? '61-90' : '90+'
  const due = new Date(base + 30 * DAY_MS)
  const payer = inv.insuranceCovered > 0 ? '医保(城镇职工)' : '自费'
  const settled = inv.balance <= 0
  return {
    id: inv.id,
    patientName: inv.patientName,
    examItem: inv.examItem,
    examDate,
    payer,
    totalAmount: inv.totalAmount,
    paidAmount: inv.paidAmount,
    balance: inv.balance,
    dueDate: due.toISOString().slice(0, 10),
    aging,
    status: settled ? 'paid' : aging === '0-30' ? 'current' : 'overdue',
  }
}

export default function AccountsReceivablePage() {
  const [items, setItems] = useState<ReceivableItem[]>(MOCK_RECEIVABLES)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [usingFallback, setUsingFallback] = useState(false)
  const [payerFilter, setPayerFilter] = useState<PayerFilter>('all')
  const [searchText, setSearchText] = useState('')

  const fetchReceivables = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await financeApi.listInvoices()
      if (!res.success) throw new Error((res.error as { message?: string })?.message || t('ar.invoiceLoadFailed'))
      const list = (Array.isArray(res.data) ? res.data : []).map(toReceivable)
      if (list.length > 0) {
        setItems(list)
        setUsingFallback(false)
      } else {
        setItems(MOCK_RECEIVABLES)
        setUsingFallback(true)
      }
    } catch (e) {
      setError((e as Error)?.message || t('ar.loadFailed'))
      setItems(MOCK_RECEIVABLES)
      setUsingFallback(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchReceivables() }, [fetchReceivables])

  const filteredItems = useMemo(() => {
    let list = items.filter(i => i.status !== 'paid')
    if (payerFilter !== 'all') list = list.filter(i => i.payer === payerFilter)
    if (searchText) {
      const q = searchText.toLowerCase()
      list = list.filter(i => i.patientName.toLowerCase().includes(q) || i.examItem.toLowerCase().includes(q))
    }
    return list
  }, [items, payerFilter, searchText])

  const summary = useMemo(() => {
    const total = items.reduce((s, i) => s + i.balance, 0)
    const byAging = AGING_BUCKETS.map(b => ({
      ...b,
      amount: items.filter(i => i.aging === b.key).reduce((s, i) => s + i.balance, 0),
      count: items.filter(i => i.aging === b.key).length,
    }))
    const byPayer = Object.keys(PAYER_COLORS).map(p => ({
      payer: p,
      amount: items.filter(i => i.payer === p).reduce((s, i) => s + i.balance, 0),
    }))
    const overdue = items.filter(i => i.status === 'overdue').reduce((s, i) => s + i.balance, 0)
    return { total, byAging, byPayer, overdue }
  }, [items])

  const arColumns = [
    { title: t('ar.colPatient'), dataIndex: 'patientName', key: 'patientName' },
    {
      title: t('ar.colExamItem'), key: 'examItem',
      render: (_: unknown, r: ReceivableItem) => (
        <div>
          <div>{r.examItem}</div>
          <div style={{ fontSize: 12, color: '#6e7681' }}>{r.examDate}</div>
        </div>
      ),
    },
    {
      title: t('ar.colPayer'), dataIndex: 'payer', key: 'payer',
      render: (v: string) => <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 12, background: `${PAYER_COLORS[v] || '#6b7280'}20`, color: PAYER_COLORS[v] || '#6b7280' }}>{v}</span>,
    },
    { title: t('ar.colTotal'), dataIndex: 'totalAmount', key: 'totalAmount', align: 'right' as const, render: (v: number) => `¥${v.toLocaleString()}` },
    { title: t('ar.colPaid'), dataIndex: 'paidAmount', key: 'paidAmount', align: 'right' as const, render: (v: number) => <span style={{ color: '#22c55e' }}>¥{v.toLocaleString()}</span> },
    { title: t('ar.colBalance'), dataIndex: 'balance', key: 'balance', align: 'right' as const, render: (v: number) => <strong style={{ color: v > 0 ? '#f59e0b' : '#22c55e' }}>¥{v.toLocaleString()}</strong> },
    {
      title: t('ar.colAging'), dataIndex: 'aging', key: 'aging', align: 'center' as const,
      render: (v: string) => {
        const color = v === '0-30' ? '#22c55e' : v === '31-60' ? '#f59e0b' : v === '61-90' ? '#fb923c' : '#ef4444'
        return <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 12, background: `${color}20`, color }}>{v}</span>
      },
    },
    {
      title: t('ar.colStatus'), dataIndex: 'status', key: 'status',
      render: (v: ReceivableItem['status']) => (
        <span style={{ fontSize: 12, color: v === 'current' ? '#22c55e' : v === 'overdue' ? '#ef4444' : '#6e7681', display: 'flex', alignItems: 'center', gap: 4 }}>
          {v === 'current' ? <Clock size={12} /> : v === 'overdue' ? <AlertTriangle size={12} /> : <CheckCircle size={12} />}
          {v === 'current' ? t('ar.status.current') : v === 'overdue' ? t('ar.status.overdue') : t('ar.status.writeoff')}
        </span>
      ),
    },
  ]

  // [G005 Wave1B] 真实导出: 用已加载的应收账款数据 (financeApi.listInvoices) 生成 CSV, 无数据时禁用
  const handleExportCsv = () => {
    if (items.length === 0) return
    const esc = (v: unknown) => {
      const s = String(v ?? '')
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const lines: string[] = [t('w9e.ar.csvHeader')]
    for (const i of items) {
      lines.push([i.id, i.patientName, i.examItem, i.examDate, i.payer, i.totalAmount, i.paidAmount, i.balance, i.dueDate, i.aging, i.status].map(esc).join(','))
    }
    const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${t('w9e.ar.exportFileName')}_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ background: 'var(--bg-primary, #0d1117)', color: 'var(--text-primary, #f0f6fc)', fontSize: 14, fontFamily: '"Segoe UI",sans-serif' }}>
      <div style={{ background: 'linear-gradient(135deg,#1e40af,#1e3a8a)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><Wallet size={24} /><span style={{ fontSize: 20, fontWeight: 700 }}>{t('ar.title')}</span></div>
        <button onClick={handleExportCsv} disabled={items.length === 0} title={items.length === 0 ? t('ar.exportDisabled') : t('ar.exportHint')} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.15)', color: '#fff', cursor: items.length === 0 ? 'not-allowed' : 'pointer', opacity: items.length === 0 ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}><Download size={14} />{t('ar.exportReport')}</button>
      </div>

      <div style={{ padding: '12px 24px 0', display: 'flex', gap: 12, alignItems: 'center' }}>
        {loading && <span style={{ fontSize: 12, color: 'var(--text-muted, #8b949e)' }}>{t('ar.loading')}</span>}
        {error && (
          <span style={{ fontSize: 12, color: '#f85149' }}>
            {error} {t('ar.fallbackSuffix')}
            <button onClick={fetchReceivables} style={{ marginLeft: 8, padding: '4px 10px', borderRadius: 4, border: '1px solid var(--border-default, #30363d)', background: 'var(--bg-secondary, #21262d)', color: 'var(--text-primary, #f0f6fc)', cursor: 'pointer', fontSize: 12 }}>{t('ar.retry')}</button>
          </span>
        )}
        {!error && usingFallback && <span style={{ fontSize: 12, color: '#d29922' }}>{t('ar.fallbackSource')}</span>}
        {!error && !usingFallback && !loading && <span style={{ fontSize: 12, color: '#22c55e' }}>{t('ar.realSource')}</span>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, padding: '20px 24px' }}>
        <div style={{ background: 'var(--bg-card, #161b22)', border: '1px solid var(--border-default, #30363d)', borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted, #8b949e)', marginBottom: 6 }}>{t('ar.totalReceivable')}</div>
          <div style={{ fontSize: 30, fontWeight: 700, color: 'var(--color-primary-500, #3b82f6)' }}>¥{summary.total.toLocaleString()}</div>
        </div>
        <div style={{ background: 'var(--bg-card, #161b22)', border: '1px solid var(--border-default, #30363d)', borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted, #8b949e)', marginBottom: 6 }}>{t('ar.overdueAmount')}</div>
          <div style={{ fontSize: 30, fontWeight: 700, color: 'var(--color-error-500, #ef4444)' }}>¥{summary.overdue.toLocaleString()}</div>
        </div>
        {summary.byAging.map(b => (
          <div key={b.key} style={{ background: 'var(--bg-card, #161b22)', border: '1px solid var(--border-default, #30363d)', borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted, #8b949e)', marginBottom: 6 }}>{t(b.label)}</div>
            <div style={{ fontSize: 30, fontWeight: 700, color: b.color }}>¥{b.amount.toLocaleString()}</div>
            <div style={{ fontSize: 12, color: '#6e7681', marginTop: 2 }}>{t('ar.countUnit', { count: b.count })}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: '0 24px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: 10, top: 10, color: '#6e7681' }} />
              <input type="text" placeholder={t('ar.searchPlaceholder')} value={searchText} onChange={e => setSearchText(e.target.value)} style={{ padding: '8px 12px 8px 34px', borderRadius: 6, border: '1px solid var(--border-default, #30363d)', background: 'var(--bg-card, #161b22)', color: 'var(--text-primary, #f0f6fc)', fontSize: 12, width: 240,}} />
            </div>
            <select value={payerFilter} onChange={e => setPayerFilter(e.target.value as PayerFilter)} style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border-default, #30363d)', background: 'var(--bg-card, #161b22)', color: 'var(--text-primary, #f0f6fc)', fontSize: 12,}}>
              <option value="all">{t('ar.allPayers')}</option>
              <option value="医保(城镇职工)">{t('w9e.ar.payerEmployee')}</option>
              <option value="医保(城乡居民)">{t('w9e.ar.payerResident')}</option>
              <option value="商业保险">{t('w9e.ar.payerCommercial')}</option>
              <option value="自费">{t('w9e.ar.payerSelf')}</option>
            </select>
          </div>
          <span style={{ fontSize: 12, color: '#6e7681' }}>{t('ar.totalCount', { count: filteredItems.length })}</span>
        </div>

        <StateView empty={!loading && !error && filteredItems.length === 0} emptyDescription={t('w2d.empty')}>
        <div style={{ background: 'var(--bg-card, #161b22)', border: '1px solid var(--border-default, #30363d)', borderRadius: 8, overflow: 'hidden' }}>
          <DataTable dataSource={filteredItems} rowKey="id" columns={arColumns} pagination={{ pageSize: 10, showSizeChanger: false }} emptyText={t('w1tables.noData')} />
        </div>
        </StateView>
      </div>
    </div>
  )
}
