import { useState, useEffect } from 'react'
import { getFinanceService, type PatientBill, type PaymentRecord, type InsuranceClaim } from '../../services/finance/FinanceService'
import { financeApi, type InvoiceDto, type ChargeItemDto } from '../../services/api/financeApi'
import { Card } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { LoadingBanner, ErrorBanner } from '../../components/feedback'
import { DataTable } from '../../components/common/DataTable'
import { t } from '../../i18n/appI18n'

// [W1-B] 开票 Modal (POST /finance/invoices)
const modalOverlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }
const modalCard: React.CSSProperties = { background: 'var(--bg-card)', borderRadius: 12, padding: 24, width: 480, maxHeight: '85vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }

// ===== Styles =====
const s = {
  container: { maxWidth: 1000, margin: '0 auto', padding: 24, fontFamily: '-apple-system, sans-serif' },
  card: { background: 'var(--bg-card)', borderRadius: 12, padding: 24, marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', border: '1px solid var(--border-color)' },
  title: { fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0, marginBottom: 16 },
  statGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 },
  statCard: { background: 'var(--bg-card)', borderRadius: 8, padding: 16, textAlign: 'center' as const },
  statValue: { fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' },
  statLabel: { fontSize: 12, color: '#64748b', marginTop: 4 },
  badge: (status: string) => ({
    padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600,
    background: status === 'paid' ? 'var(--color-success-bg)' : status === 'partial' ? 'var(--color-warning-bg)' : status === 'pending' ? 'var(--color-info-bg)' : status === 'refunded' ? 'var(--color-error-bg)' : 'rgba(124,58,237,0.12)',
    color: status === 'paid' ? 'var(--color-success)' : status === 'partial' ? 'var(--color-warning)' : status === 'pending' ? 'var(--color-info)' : status === 'refunded' ? 'var(--color-error)' : '#7c3aed',
  }),
  btn: { padding: '6px 14px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'var(--color-primary-800)', color: '#fff' },
  btnSmall: { padding: '4px 10px', borderRadius: 4, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer' },
  select: { padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border-color)', fontSize: 12, background: 'var(--bg-card)',},
  tab: (active: boolean) => ({
    flex: 1, padding: '10px 0', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
    background: active ? 'var(--bg-card)' : 'transparent', color: active ? 'var(--color-primary-800)' : '#64748b',
    boxShadow: active ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
  }),
  label: { fontSize: 12, color: '#64748b', marginBottom: 2 },
  value: { fontSize: 12, color: 'var(--text-primary)', fontWeight: 500 },
  row: { display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-color)' },
}

const statusLabel = (status: string): string => ({
  pending: t('patientFinance.statusPending'), partial: t('patientFinance.statusPartial'), paid: t('patientFinance.statusPaid'), refunded: t('patientFinance.statusRefunded'), waived: t('patientFinance.statusWaived'),
}[status] ?? status)

const methodLabel = (method: string): string => ({
  cash: t('patientFinance.methodCash'), card: t('patientFinance.methodCard'), wechat: t('patientFinance.methodWechat'), alipay: t('patientFinance.methodAlipay'), insurance: t('patientFinance.methodInsurance'), bank_transfer: t('patientFinance.methodBankTransfer'),
}[method] ?? method)

const claimStatusLabel = (status: string): string => ({
  submitted: t('patientFinance.claimSubmitted'), approved: t('patientFinance.claimApproved'), rejected: t('patientFinance.claimRejected'), paid: t('patientFinance.claimPaid'),
}[status] ?? status)

// ===== Component =====
export default function PatientFinancePage() {
  const [activeTab, setActiveTab] = useState<'bills' | 'payments' | 'claims'>('bills')
  const [bills, setBills] = useState<PatientBill[]>([])
  const [allPayments, setAllPayments] = useState<PaymentRecord[]>([])
  const [claims, setClaims] = useState<InsuranceClaim[]>([])
  const [selectedBill, setSelectedBill] = useState<PatientBill | null>(null)
  const [billPayments, setBillPayments] = useState<PaymentRecord[]>([])
  const [payMethod, setPayMethod] = useState<PaymentRecord['method']>('wechat')

  const svc = getFinanceService()
  const [invoices, setInvoices] = useState<InvoiceDto[]>([])

  // [W1-B] 开票: financeApi.createInvoice (POST /finance/invoices)
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)
  const [chargeItems, setChargeItems] = useState<ChargeItemDto[]>([])
  const [invPatientId, setInvPatientId] = useState('')
  const [invItemIds, setInvItemIds] = useState<string[]>([])
  const [invDiscount, setInvDiscount] = useState(0)
  const [invSaving, setInvSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const [b, c] = await Promise.all([svc.getBills('P001'), svc.getInsuranceClaims('P001')])
        if (cancelled) return
        setBills(b)
        setClaims(c)
        // [G005 W1-Controls P1-8] 汇总各账单缴费流水 → 缴费记录渲染
        try {
          const paymentLists = await Promise.all(b.map((bill) => svc.getPayments(bill.id)))
          if (!cancelled) setAllPayments(paymentLists.flat())
        } catch { if (!cancelled) setAllPayments([]) }
        setLoadError(null)
      } catch {
        if (!cancelled) setLoadError(t('w9.states.error'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    financeApi.listInvoices().then(res => { if (res.success) setInvoices(res.data); }).catch((err) => { console.error('[F04]', err); })
    financeApi.listChargeItems().then(res => { if (res.success) setChargeItems(res.data ?? []) }).catch(() => { /* 收费项目不可用不阻断 */ })
    return () => { cancelled = true }
  }, [])

  const handleCreateInvoice = async () => {
    if (!invPatientId.trim()) { alert(t('patientFinance.patientIdRequired')); return }
    if (invItemIds.length === 0) { alert(t('patientFinance.chargeItemRequired')); return }
    setInvSaving(true)
    try {
      const res = await financeApi.createInvoice({
        patientId: invPatientId.trim(),
        chargeItemIds: invItemIds,
        discount: invDiscount > 0 ? invDiscount : undefined,
      })
      if (res.success) {
        alert(t('patientFinance.invoiceCreated', { id: res.data.id, amount: res.data.totalAmount }))
        setShowInvoiceModal(false)
        setInvPatientId(''); setInvItemIds([]); setInvDiscount(0)
      } else {
        alert(res.error?.message ?? t('patientFinance.invoiceFailed'))
      }
    } catch (e) {
      alert((e as Error)?.message ?? t('patientFinance.invoiceFailed'))
    } finally {
      setInvSaving(false)
    }
  }

  const handleSelectBill = async (bill: PatientBill) => {
    setSelectedBill(bill)
    const p = await svc.getPayments(bill.id)
    setBillPayments(p)
  }

  const handlePay = async (billId: string) => {
    const bill = bills.find(b => b.id === billId)
    if (!bill) return
    await svc.makePayment(billId, bill.balance, payMethod)
    const updated = await svc.getBills('P001')
    setBills(updated)
    if (selectedBill?.id === billId) {
      const updatedBill = updated.find(b => b.id === billId)
      if (updatedBill) setSelectedBill(updatedBill)
      const ps = await svc.getPayments(billId)
      setBillPayments(ps)
    }
  }

  const totalBilled = bills.reduce((s, b) => s + b.totalAmount, 0)
  const totalPaid = bills.reduce((s, b) => s + b.paidAmount, 0)
  const totalBalance = bills.reduce((s, b) => s + b.balance, 0)
  const pendingCount = bills.filter(b => b.status !== 'paid').length

  const billColumns: ColumnsType<PatientBill> = [
    {
      title: t('w3tables.col.examItem'), dataIndex: 'examItem', key: 'examItem',
      render: (_: unknown, b) => (
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{b.examItem}</div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>{b.examDate} · {b.id}</div>
        </div>
      ),
    },
    {
      title: t('w3tables.col.amount'), dataIndex: 'totalAmount', key: 'totalAmount', width: 120, align: 'right',
      render: (v: number) => <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>¥{v}</span>,
    },
    {
      title: t('w3tables.col.status'), dataIndex: 'status', key: 'status', width: 110,
      render: (v: string) => <span style={s.badge(v)}>{statusLabel(v)}</span>,
    },
    {
      title: t('w3tables.col.action'), key: 'action', width: 100,
      render: (_: unknown, b) => (
        <button style={{ ...s.btnSmall, background: 'var(--color-info-bg)', color: 'var(--color-primary-800)' }}
          onClick={(e) => { e.stopPropagation(); void handleSelectBill(b) }}>{t('w3tables.action.detail')}</button>
      ),
    },
  ]

  // [G005 W1-Controls P1-8] 缴费流水 (PaymentRecord) / 发票 (InvoiceDto)
  const paymentRecordColumns: ColumnsType<PaymentRecord> = [
    { title: t('w3tables.col.examItem'), key: 'billId', render: (_: unknown, p) => <div><div style={{ fontSize: 12, fontWeight: 600 }}>{p.transactionId}</div><div style={{ fontSize: 11, color: '#94a3b8' }}>{p.billId}</div></div> },
    { title: t('patientFinance.payMethod'), key: 'method', width: 110, render: (_: unknown, p) => methodLabel(p.method) },
    { title: t('w1Controls.patientFinance.colAmount'), dataIndex: 'amount', key: 'amount', width: 120, align: 'right', render: (v: number) => <span style={{ fontWeight: 600, color: '#059669' }}>¥{v}</span> },
    { title: t('w1Controls.patientFinance.colIssuedAt'), dataIndex: 'paidAt', key: 'paidAt', width: 170, render: (v: string) => new Date(v).toLocaleString() },
    { title: t('w1Controls.patientFinance.colStatus'), dataIndex: 'status', key: 'status', width: 100, render: (v: string) => <span style={s.badge(v === 'success' ? 'paid' : v)}>{v}</span> },
  ]

  const invoiceColumns: ColumnsType<InvoiceDto> = [
    { title: t('w1Controls.patientFinance.colInvoice'), dataIndex: 'id', key: 'id', render: (v: string) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</span> },
    { title: t('w1Controls.patientFinance.colPatient'), key: 'patient', render: (_: unknown, r) => <div><div style={{ fontSize: 12 }}>{r.patientName ?? r.patientId}</div><div style={{ fontSize: 11, color: '#94a3b8' }}>{r.examItem}</div></div> },
    { title: t('w1Controls.patientFinance.colAmount'), dataIndex: 'totalAmount', key: 'totalAmount', width: 120, align: 'right', render: (v: number) => <span style={{ fontWeight: 600 }}>¥{v}</span> },
    { title: t('w1Controls.patientFinance.colBalance'), dataIndex: 'balance', key: 'balance', width: 110, align: 'right', render: (v: number) => <span style={{ color: v > 0 ? 'var(--color-error-600)' : '#059669' }}>¥{v}</span> },
    { title: t('w1Controls.patientFinance.colIssuedAt'), dataIndex: 'createdAt', key: 'createdAt', width: 170, render: (v: string) => v ? new Date(v).toLocaleString() : '-' },
    { title: t('w1Controls.patientFinance.colStatus'), dataIndex: 'status', key: 'status', width: 100, render: (v: string) => <span style={s.badge(String(v).toLowerCase())}>{v}</span> },
  ]

  const claimColumns: ColumnsType<InsuranceClaim> = [    {
      title: t('w3tables.col.insuranceType'), dataIndex: 'insuranceType', key: 'insuranceType',
      render: (_: unknown, c) => (
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{c.insuranceType}</div>
          {c.rejectReason && <div style={{ fontSize: 12, color: 'var(--color-error-600)', marginTop: 2 }}>{t('patientFinance.rejectReason')}{c.rejectReason}</div>}
        </div>
      ),
    },
    {
      title: t('w3tables.col.claimAmounts'), key: 'claimAmounts',
      render: (_: unknown, c) => <span>{t('patientFinance.claimAmounts', { claim: c.claimAmount, approved: c.approvedAmount })}</span>,
    },
    { title: t('w3tables.col.submittedAt'), dataIndex: 'submittedAt', key: 'submittedAt', width: 150 },
    {
      title: t('w3tables.col.status'), dataIndex: 'status', key: 'status', width: 110,
      render: (v: string) => <span style={s.badge(v)}>{claimStatusLabel(v)}</span>,
    },
  ]

  return (
    <div style={s.container}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={s.title}>{t('patientFinance.title')}</h2>
        <button style={{ ...s.btn, padding: '8px 16px' }} onClick={() => setShowInvoiceModal(true)}>{t('patientFinance.createInvoice')}</button>
      </div>

      {loading && <LoadingBanner message={t('w9.states.loading')} />}
      {loadError && !loading && <ErrorBanner message={loadError} />}

      {/* Stats */}
      <div style={s.statGrid}>
        <div style={s.statCard}><div style={s.statValue}>¥{totalBilled.toLocaleString()}</div><div style={s.statLabel}>{t('patientFinance.totalBilled')}</div></div>
        <div style={s.statCard}><div style={{ ...s.statValue, color: '#059669' }}>¥{totalPaid.toLocaleString()}</div><div style={s.statLabel}>{t('patientFinance.totalPaid')}</div></div>
        <div style={s.statCard}><div style={{ ...s.statValue, color: 'var(--color-error-600)' }}>¥{totalBalance.toLocaleString()}</div><div style={s.statLabel}>{t('patientFinance.totalPending')}</div></div>
        <div style={s.statCard}><div style={s.statValue}>{pendingCount}</div><div style={s.statLabel}>{t('patientFinance.unsettled')}</div></div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--bg-card)', padding: 4, borderRadius: 10 }}>
        {(['bills', 'payments', 'claims'] as const).map(tab => (
          <button key={tab} style={s.tab(activeTab === tab)} onClick={() => setActiveTab(tab)}>
            {tab === 'bills' ? t('patientFinance.tabBills') : tab === 'payments' ? t('patientFinance.tabPayments') : t('patientFinance.tabClaims')}
          </button>
        ))}
      </div>

      {/* Bills Tab */}
      {activeTab === 'bills' && (
        <Card bordered={false} style={s.card} styles={{ body: { padding: 0 } }}>
          {selectedBill ? (
            <div>
              <button style={{ ...s.btn, background: '#64748b', marginBottom: 16 }} onClick={() => { setSelectedBill(null); setBillPayments([]) }}>{t('patientFinance.backToBills')}</button>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{selectedBill.examItem}</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>{selectedBill.examDate} · {t('patientFinance.billNo')}{selectedBill.id}</div>
              <span style={s.badge(selectedBill.status)}>{statusLabel(selectedBill.status)}</span>

              <div style={{ margin: '16px 0' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>{t('patientFinance.chargeDetails')}</div>
                {selectedBill.items.map(item => (
                  <div key={item.id} style={s.row}>
                    <div>
                      <div style={s.value}>{item.name}</div>
                      <div style={{ fontSize: 12, color: '#94a3b8' }}>x{item.quantity} @ ¥{item.unitPrice}</div>
                    </div>
                    <div style={{ fontWeight: 600 }}>¥{item.amount}</div>
                  </div>
                ))}
                <div style={{ ...s.row, borderTop: '2px solid #e2e8f0', fontWeight: 700, fontSize: 14 }}>
                  <span>{t('patientFinance.total')}</span><span>¥{selectedBill.totalAmount}</span>
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={s.row}><span style={s.label}>{t('patientFinance.insuranceCovered')}</span><span style={{ color: '#059669', fontWeight: 600 }}>¥{selectedBill.insuranceCovered}</span></div>
                <div style={s.row}><span style={s.label}>{t('patientFinance.selfPay')}</span><span style={{ color: 'var(--color-error-600)', fontWeight: 600 }}>¥{selectedBill.selfPayAmount}</span></div>
                {selectedBill.status === 'partial' || selectedBill.status === 'pending' ? (
                  <div style={s.row}><span style={s.label}>{t('patientFinance.pendingPayment')}</span><span style={{ color: 'var(--color-error-600)', fontWeight: 700, fontSize: 16 }}>¥{selectedBill.balance}</span></div>
                ) : null}
              </div>

              {selectedBill.status !== 'paid' && selectedBill.balance > 0 && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <select style={s.select} value={payMethod} onChange={e => setPayMethod(e.target.value as PaymentRecord['method'])}>
                    {(['wechat', 'alipay', 'card', 'cash'] as const).map(m => <option key={m} value={m}>{methodLabel(m)}</option>)}
                  </select>
                  <button style={s.btn} onClick={() => handlePay(selectedBill.id)}>{t('patientFinance.pay')} ¥{selectedBill.balance}</button>
                </div>
              )}

              {billPayments.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>{t('patientFinance.paymentHistory')}</div>
                  {billPayments.map(p => (
                    <div key={p.id} style={s.row}>
                      <div>
                        <div style={s.value}>{methodLabel(p.method)} · {p.transactionId}</div>
                        <div style={{ fontSize: 12, color: '#94a3b8' }}>{new Date(p.paidAt).toLocaleString()}</div>
                      </div>
                      <div style={{ fontWeight: 600, color: '#059669' }}>+¥{p.amount}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              <h3 style={{ ...s.title, fontSize: 16, padding: '0 16px', paddingTop: 16 }}>{t('patientFinance.billList')}</h3>
              <DataTable<PatientBill>
                columns={billColumns}
                dataSource={bills}
                rowKey="id"
                loading={loading}
                emptyText={t('w3tables.empty')}
                onRow={(b) => ({ onClick: () => void handleSelectBill(b), style: { cursor: 'pointer' } })}
                scroll={{ x: 'max-content' }}
              />
            </>
          )}
        </Card>
      )}

      {/* Payments Tab */}
      {activeTab === 'payments' && (
        <Card bordered={false} style={s.card} styles={{ body: { padding: 0 } }}>
          {/* [G005 W1-Controls P1-8] 缴费流水 (真实 PaymentRecord) */}
          <h3 style={{ ...s.title, fontSize: 16, padding: '0 16px', paddingTop: 16 }}>{t('w1Controls.patientFinance.paymentsMadeTitle')}</h3>
          <DataTable<PaymentRecord>
            columns={paymentRecordColumns}
            dataSource={allPayments}
            rowKey="id"
            emptyText={t('patientFinance.noPaymentRecords')}
            scroll={{ x: 'max-content' }}
          />
          {/* [G005 W1-Controls P1-8] 发票记录 (financeApi.listInvoices) */}
          <h3 style={{ ...s.title, fontSize: 16, padding: '0 16px', paddingTop: 16, marginTop: 12 }}>{t('w1Controls.patientFinance.invoicesTitle')}</h3>
          <DataTable<InvoiceDto>
            columns={invoiceColumns}
            dataSource={invoices}
            rowKey="id"
            emptyText={t('w1Controls.patientFinance.noInvoices')}
            scroll={{ x: 'max-content' }}
          />
        </Card>
      )}

      {/* Claims Tab */}
      {activeTab === 'claims' && (
        <Card bordered={false} style={s.card} styles={{ body: { padding: 0 } }}>
          <h3 style={{ ...s.title, fontSize: 16, padding: '0 16px', paddingTop: 16 }}>{t('patientFinance.tabClaims')}</h3>
          <DataTable<InsuranceClaim>
            columns={claimColumns}
            dataSource={claims}
            rowKey="id"
            emptyText={t('w3tables.empty')}
            scroll={{ x: 'max-content' }}
          />
        </Card>
      )}

      {/* [W1-B] 开票 Modal */}
      {showInvoiceModal && (
        <div style={modalOverlay} onClick={() => setShowInvoiceModal(false)}>
          <div style={modalCard} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>{t('patientFinance.issueInvoice')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={s.label}>{t('patientFinance.patientIdLabel')}</div>
                <input value={invPatientId} onChange={e => setInvPatientId(e.target.value)} placeholder={t('patientFinance.patientIdPlaceholder')}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 12, boxSizing: 'border-box',}} />
              </div>
              <div>
                <div style={s.label}>{t('patientFinance.chargeItemsLabel')}</div>
                <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 6, padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {chargeItems.length === 0 && <div style={{ fontSize: 12, color: '#94a3b8' }}>{t('patientFinance.noChargeItems')}</div>}
                  {chargeItems.map(item => (
                    <label key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
                      <input type="checkbox" checked={invItemIds.includes(item.id)}
                        onChange={e => setInvItemIds(prev => e.target.checked ? [...prev, item.id] : prev.filter(x => x !== item.id))} />
                      <span>{item.name}</span>
                      <span style={{ marginLeft: 'auto', color: '#059669', fontWeight: 600 }}>¥{item.unitPrice}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <div style={s.label}>{t('patientFinance.discountAmount')}</div>
                <input type="number" min={0} value={invDiscount} onChange={e => setInvDiscount(Number(e.target.value))}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 12, boxSizing: 'border-box',}} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                <button style={{ ...s.btn, background: '#64748b' }} onClick={() => setShowInvoiceModal(false)}>{t('patientFinance.cancel')}</button>
                <button style={s.btn} disabled={invSaving} onClick={() => void handleCreateInvoice()}>{invSaving ? t('patientFinance.invoicing') : t('patientFinance.confirmInvoice')}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
