import { useState, useEffect } from 'react'
import { getFinanceService, type PatientBill, type PaymentRecord, type InsuranceClaim } from '../../services/finance/FinanceService'
import { financeApi, type InvoiceDto, type ChargeItemDto } from '../../services/api/financeApi'
import { Card } from 'antd'

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
  btn: { padding: '6px 14px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: '#1e40af', color: '#fff' },
  btnSmall: { padding: '4px 10px', borderRadius: 4, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer' },
  select: { padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border-color)', fontSize: 12, background: 'var(--bg-card)', outline: 'none' },
  tab: (active: boolean) => ({
    flex: 1, padding: '10px 0', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
    background: active ? 'var(--bg-card)' : 'transparent', color: active ? '#1e40af' : '#64748b',
    boxShadow: active ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
  }),
  label: { fontSize: 12, color: '#64748b', marginBottom: 2 },
  value: { fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 },
  row: { display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-color)' },
}

const STATUS_LABELS: Record<string, string> = {
  pending: '待支付', partial: '部分支付', paid: '已支付', refunded: '已退款', waived: '已减免',
}

const METHOD_LABELS: Record<string, string> = {
  cash: '现金', card: '银行卡', wechat: '微信', alipay: '支付宝', insurance: '医保', bank_transfer: '银行转账',
}

const CLAIM_STATUS: Record<string, string> = {
  submitted: '已提交', approved: '已核准', rejected: '已拒绝', paid: '已赔付',
}

// ===== Component =====
export default function PatientFinancePage() {
  const [activeTab, setActiveTab] = useState<'bills' | 'payments' | 'claims'>('bills')
  const [bills, setBills] = useState<PatientBill[]>([])
  const [_payments, _setPayments] = useState<PaymentRecord[]>([])
  const [claims, setClaims] = useState<InsuranceClaim[]>([])
  const [selectedBill, setSelectedBill] = useState<PatientBill | null>(null)
  const [billPayments, setBillPayments] = useState<PaymentRecord[]>([])
  const [payMethod, setPayMethod] = useState<PaymentRecord['method']>('wechat')

  const svc = getFinanceService()
  const [_invoices, setInvoices] = useState<InvoiceDto[]>([])

  // [W1-B] 开票: financeApi.createInvoice (POST /finance/invoices)
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)
  const [chargeItems, setChargeItems] = useState<ChargeItemDto[]>([])
  const [invPatientId, setInvPatientId] = useState('')
  const [invItemIds, setInvItemIds] = useState<string[]>([])
  const [invDiscount, setInvDiscount] = useState(0)
  const [invSaving, setInvSaving] = useState(false)

  useEffect(() => {
    svc.getBills('P001').then(setBills)
    svc.getInsuranceClaims('P001').then(setClaims)
    financeApi.listInvoices().then(res => { if (res.success) setInvoices(res.data); }).catch((err) => { console.error('[F04]', err); })
    financeApi.listChargeItems().then(res => { if (res.success) setChargeItems(res.data ?? []) }).catch(() => { /* 收费项目不可用不阻断 */ })
  }, [])

  const handleCreateInvoice = async () => {
    if (!invPatientId.trim()) { alert('请填写患者ID'); return }
    if (invItemIds.length === 0) { alert('请至少选择一项收费项目'); return }
    setInvSaving(true)
    try {
      const res = await financeApi.createInvoice({
        patientId: invPatientId.trim(),
        chargeItemIds: invItemIds,
        discount: invDiscount > 0 ? invDiscount : undefined,
      })
      if (res.success) {
        alert(`发票已开具: ${res.data.id} (¥${res.data.totalAmount})`)
        setShowInvoiceModal(false)
        setInvPatientId(''); setInvItemIds([]); setInvDiscount(0)
      } else {
        alert(res.error?.message ?? '开票失败')
      }
    } catch (e) {
      alert((e as Error)?.message ?? '开票失败')
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

  return (
    <div style={s.container}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={s.title}>患者财务</h2>
        <button style={{ ...s.btn, padding: '8px 16px' }} onClick={() => setShowInvoiceModal(true)}>开票</button>
      </div>

      {/* Stats */}
      <div style={s.statGrid}>
        <div style={s.statCard}><div style={s.statValue}>¥{totalBilled.toLocaleString()}</div><div style={s.statLabel}>总费用</div></div>
        <div style={s.statCard}><div style={{ ...s.statValue, color: '#059669' }}>¥{totalPaid.toLocaleString()}</div><div style={s.statLabel}>已支付</div></div>
        <div style={s.statCard}><div style={{ ...s.statValue, color: '#dc2626' }}>¥{totalBalance.toLocaleString()}</div><div style={s.statLabel}>待支付</div></div>
        <div style={s.statCard}><div style={s.statValue}>{pendingCount}</div><div style={s.statLabel}>未结账单</div></div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--bg-card)', padding: 4, borderRadius: 10 }}>
        {(['bills', 'payments', 'claims'] as const).map(tab => (
          <button key={tab} style={s.tab(activeTab === tab)} onClick={() => setActiveTab(tab)}>
            {tab === 'bills' ? '账单' : tab === 'payments' ? '缴费记录' : '医保理赔'}
          </button>
        ))}
      </div>

      {/* Bills Tab */}
      {activeTab === 'bills' && (
        <Card bordered={false} style={s.card} styles={{ body: { padding: 0 } }}>
          {selectedBill ? (
            <div>
              <button style={{ ...s.btn, background: '#64748b', marginBottom: 16 }} onClick={() => { setSelectedBill(null); setBillPayments([]) }}>← 返回账单列表</button>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{selectedBill.examItem}</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>{selectedBill.examDate} · 编号：{selectedBill.id}</div>
              <span style={s.badge(selectedBill.status)}>{STATUS_LABELS[selectedBill.status]}</span>

              <div style={{ margin: '16px 0' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>费用明细</div>
                {selectedBill.items.map(item => (
                  <div key={item.id} style={s.row}>
                    <div>
                      <div style={s.value}>{item.name}</div>
                      <div style={{ fontSize: 12, color: '#94a3b8' }}>x{item.quantity} @ ¥{item.unitPrice}</div>
                    </div>
                    <div style={{ fontWeight: 600 }}>¥{item.amount}</div>
                  </div>
                ))}
                <div style={{ ...s.row, borderTop: '2px solid #e2e8f0', fontWeight: 700, fontSize: 15 }}>
                  <span>合计</span><span>¥{selectedBill.totalAmount}</span>
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={s.row}><span style={s.label}>医保报销</span><span style={{ color: '#059669', fontWeight: 600 }}>¥{selectedBill.insuranceCovered}</span></div>
                <div style={s.row}><span style={s.label}>自费金额</span><span style={{ color: '#dc2626', fontWeight: 600 }}>¥{selectedBill.selfPayAmount}</span></div>
                {selectedBill.status === 'partial' || selectedBill.status === 'pending' ? (
                  <div style={s.row}><span style={s.label}>待支付</span><span style={{ color: '#dc2626', fontWeight: 700, fontSize: 16 }}>¥{selectedBill.balance}</span></div>
                ) : null}
              </div>

              {selectedBill.status !== 'paid' && selectedBill.balance > 0 && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <select style={s.select} value={payMethod} onChange={e => setPayMethod(e.target.value as PaymentRecord['method'])}>
                    {(['wechat', 'alipay', 'card', 'cash'] as const).map(m => <option key={m} value={m}>{METHOD_LABELS[m]}</option>)}
                  </select>
                  <button style={s.btn} onClick={() => handlePay(selectedBill.id)}>支付 ¥{selectedBill.balance}</button>
                </div>
              )}

              {billPayments.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>缴费记录</div>
                  {billPayments.map(p => (
                    <div key={p.id} style={s.row}>
                      <div>
                        <div style={s.value}>{METHOD_LABELS[p.method]} · {p.transactionId}</div>
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
              <h3 style={{ ...s.title, fontSize: 16 }}>账单列表</h3>
              {bills.map(b => (
                <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}
                  onClick={() => handleSelectBill(b)}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{b.examItem}</div>
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>{b.examDate} · {b.id}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>¥{b.totalAmount}</div>
                    <span style={s.badge(b.status)}>{STATUS_LABELS[b.status]}</span>
                  </div>
                </div>
              ))}
            </>
          )}
        </Card>
      )}

      {/* Payments Tab */}
      {activeTab === 'payments' && (
        <Card bordered={false} style={s.card} styles={{ body: { padding: 0 } }}>
          <h3 style={{ ...s.title, fontSize: 16 }}>缴费记录</h3>
          {bills.length === 0 ? <div style={{ fontSize: 13, color: '#94a3b8', textAlign: 'center', padding: 24 }}>暂无缴费用记录</div> :
            bills.filter(b => b.paidAmount > 0).map(b => (
              <div key={b.id} style={{ padding: '12px 0', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{b.examItem}</div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>已付 ¥{b.paidAmount} / 总计 ¥{b.totalAmount}</div>
              </div>
            ))
          }
        </Card>
      )}

      {/* Claims Tab */}
      {activeTab === 'claims' && (
        <Card bordered={false} style={s.card} styles={{ body: { padding: 0 } }}>
          <h3 style={{ ...s.title, fontSize: 16 }}>医保理赔</h3>
          {claims.map(c => (
            <div key={c.id} style={{ padding: '14px 0', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{c.insuranceType}</div>
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>理赔金额：¥{c.claimAmount} · 核准：¥{c.approvedAmount}</div>
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>提交：{c.submittedAt}</div>
                </div>
                <span style={s.badge(c.status)}>{CLAIM_STATUS[c.status]}</span>
              </div>
              {c.rejectReason && <div style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>拒绝原因：{c.rejectReason}</div>}
            </div>
          ))}
        </Card>
      )}

      {/* [W1-B] 开票 Modal */}
      {showInvoiceModal && (
        <div style={modalOverlay} onClick={() => setShowInvoiceModal(false)}>
          <div style={modalCard} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>开具发票</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={s.label}>患者ID *</div>
                <input value={invPatientId} onChange={e => setInvPatientId(e.target.value)} placeholder="如 P100006"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 13, boxSizing: 'border-box', outline: 'none' }} />
              </div>
              <div>
                <div style={s.label}>收费项目 *</div>
                <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 6, padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {chargeItems.length === 0 && <div style={{ fontSize: 12, color: '#94a3b8' }}>暂无收费项目</div>}
                  {chargeItems.map(item => (
                    <label key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                      <input type="checkbox" checked={invItemIds.includes(item.id)}
                        onChange={e => setInvItemIds(prev => e.target.checked ? [...prev, item.id] : prev.filter(x => x !== item.id))} />
                      <span>{item.name}</span>
                      <span style={{ marginLeft: 'auto', color: '#059669', fontWeight: 600 }}>¥{item.unitPrice}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <div style={s.label}>优惠金额 (元)</div>
                <input type="number" min={0} value={invDiscount} onChange={e => setInvDiscount(Number(e.target.value))}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 13, boxSizing: 'border-box', outline: 'none' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                <button style={{ ...s.btn, background: '#64748b' }} onClick={() => setShowInvoiceModal(false)}>取消</button>
                <button style={s.btn} disabled={invSaving} onClick={() => void handleCreateInvoice()}>{invSaving ? '开票中...' : '确认开票'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
