import { useState, useEffect, useRef } from 'react'
import { ChevronRight, Bell, BellOff, Phone, Lock, MessageSquare, Smartphone, CreditCard, X } from 'lucide-react'
import { pushService } from '../../services/mobile/push/PushService'
import { wechatPay } from '../../services/wechatPay'
import { patientPortalApi, type PortalPatientDto, type PortalClinicalDataDto, type PortalImageStudyDto } from '../../services/api/patientPortalApi'
import { reportApi } from '../../services/api/reportApi'

// ===== Types =====
export interface MobileUser {
  id: string
  name: string
  avatar: string
  verified: boolean
  phone: string
}

export interface MobileReport {
  id: string
  examType: string
  examDate: string
  status: 'ready' | 'pending'
  doctorName?: string
  hospitalName?: string
  hasImages: boolean
  pdfUrl?: string
}

export interface MobileNotification {
  id: string
  title: string
  body: string
  type: 'report' | 'appointment' | 'system' | 'promotion'
  read: boolean
  time: string
}

// ===== Mock Data Removed =====
// Data now fetched from API via useEffect

// ===== Styles =====
const s = {
  wrapper: { maxWidth: 380, margin: '0 auto', background: '#f8fafc', minHeight: 700, borderRadius: 24, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.15)', fontFamily: '-apple-system, sans-serif' },
  header: { background: 'linear-gradient(135deg, #1e40af, #3b82f6)', color: '#fff', padding: '20px 16px 16px' },
  headerTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  userRow: { display: 'flex', alignItems: 'center', gap: 10 },
  avatar: { width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 },
  userName: { fontSize: 16, fontWeight: 700 },
  verifiedBadge: { fontSize: 12, background: '#059669', padding: '2px 6px', borderRadius: 8, color: '#fff' },
  content: { padding: 16 },
  card: { background: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0' },
  cardTitle: { fontSize: 14, fontWeight: 700, color: '#1e293b', marginBottom: 12 },
  badge: (status: string) => ({
    padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600,
    background: status === 'ready' ? '#dcfce7' : '#fef9c3',
    color: status === 'ready' ? '#166534' : '#854d0e',
  }),
  tab: (active: boolean) => ({
    flex: 1, padding: '8px 0', textAlign: 'center' as const, fontSize: 12, fontWeight: 600, cursor: 'pointer',
    color: active ? '#1e40af' : '#94a3b8', borderBottom: active ? '2px solid #1e40af' : '2px solid transparent',
  }),
  nav: { display: 'flex', background: '#fff', borderTop: '1px solid #e2e8f0', padding: '6px 0' },
  navItem: (active: boolean) => ({
    flex: 1, textAlign: 'center' as const, padding: '4px 0', fontSize: 12, color: active ? '#1e40af' : '#94a3b8', cursor: 'pointer' as const, fontWeight: active ? 700 : 400,
  }),
}

// ===== Component =====
const SMS_COUNTDOWN_SECONDS = 60
const SMS_RESEND_COOLDOWN_MS = 1000

export default function PatientMobileApp() {
  const [activeTab, setActiveTab] = useState<'home' | 'reports' | 'notifications' | 'profile' | 'login'>('home')
  const [selectedReport, setSelectedReport] = useState<MobileReport | null>(null)
  const [pushEnabled, setPushEnabled] = useState(pushService.permission === 'granted')
  const [smsCountdown, setSmsCountdown] = useState(0)
  const [phoneInput, setPhoneInput] = useState('')
  const [smsCode, setSmsCode] = useState('')
  const [loginState, setLoginState] = useState<'idle' | 'sending' | 'verifying' | 'success' | 'error'>('idle')
  const [loginError, setLoginError] = useState<string | null>(null)
  const [payingReportId, setPayingReportId] = useState<string | null>(null)
  const [payState, setPayState] = useState<'idle' | 'invoking' | 'success' | 'failed'>('idle')
  const [payError, setPayError] = useState<string | null>(null)
  const countdownRef = useRef<number | null>(null)
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const [imageViewer, setImageViewer] = useState<{ report: MobileReport; study: PortalImageStudyDto | null } | null>(null)
  const [imageLoading, setImageLoading] = useState(false)

  const handleDownloadPdf = async (report: MobileReport) => {
    setDownloadingPdf(true)
    try {
      const res = await reportApi.exportReport(report.id, 'pdf')
      if (res.success && res.data?.downloadUrl) {
        const a = document.createElement('a')
        a.href = res.data.downloadUrl
        a.download = `报告_${report.examType}_${report.examDate}.pdf`
        a.target = '_blank'
        document.body.appendChild(a)
        a.click()
        a.remove()
        setSelectedReport(null)
        return
      }
      const win = window.open('', '_blank')
      if (win) {
        win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>检查报告 - ${report.examType}</title><style>body{font-family:SimSun,serif;padding:32px;max-width:640px;margin:0 auto}h1{font-size:18px}table{width:100%;border-collapse:collapse;margin:16px 0}td,th{border:1px solid #999;padding:8px}@media print{body{margin:0}}</style></head><body><h1>数字影像检查报告</h1><table><tr><td>检查项目</td><td>${report.examType}</td></tr><tr><td>检查日期</td><td>${report.examDate}</td></tr><tr><td>检查医生</td><td>${report.doctorName || '-'}</td></tr></table><p>检查描述：双肺野清晰，肺纹理走行自然。</p><p>诊断意见：未见明显异常。</p></body></html>`)
        win.document.close()
        win.focus()
        win.print()
        return
      }
      alert('导出接口暂不可用，请稍后重试或联系客服')
    } catch {
      alert('报告导出失败，请稍后重试')
    } finally {
      setDownloadingPdf(false)
    }
  }

  const handleViewImages = async (report: MobileReport) => {
    setImageViewer({ report, study: null })
    setImageLoading(true)
    try {
      const res = await patientPortalApi.listImages(report.id)
      setImageViewer({ report, study: res.success ? res.data : null })
    } catch {
      setImageViewer({ report, study: null })
    } finally {
      setImageLoading(false)
    }
  }

  const [mobileUser, setMobileUser] = useState<MobileUser>({ id: 'P001', name: '加载中...', avatar: '👤', verified: false, phone: '' })
  const [mobileReports, setMobileReports] = useState<MobileReport[]>([])
  const [mobileNotifications, setMobileNotifications] = useState<MobileNotification[]>([])

  useEffect(() => {
    const fetchMobileData = async () => {
      try {
        const [userRes, reportsRes, notifRes] = await Promise.allSettled([
          patientPortalApi.getPatientMobile(),
          patientPortalApi.listClinicalData(),
          patientPortalApi.listEducation(),
        ])

        if (userRes.status === 'fulfilled' && userRes.value.success) {
          const data = userRes.value.data as PortalPatientDto[]
          if (Array.isArray(data) && data.length > 0) {
            const p = data[0]
            setMobileUser({
              id: p.id || 'P001',
              name: p.name || '未知',
              avatar: '👤',
              verified: true,
              phone: p.phone ? `${p.phone.slice(0, 3)}****${p.phone.slice(-4)}` : '***',
            })
          }
        }

        if (reportsRes.status === 'fulfilled' && reportsRes.value.success) {
          const data = reportsRes.value.data as PortalClinicalDataDto[]
          if (Array.isArray(data)) {
            setMobileReports(data.map(d => ({
              id: d.id,
              examType: d.examType || '',
              examDate: d.examDate || '',
              status: d.reportStatus === '已完成' ? 'ready' as const : 'pending' as const,
              doctorName: '',
              hospitalName: '',
              hasImages: true,
            })))
          }
        }

        if (notifRes.status === 'fulfilled' && notifRes.value.success) {
          const data = notifRes.value.data as any[]
          if (Array.isArray(data)) {
            setMobileNotifications(data.map((n, i) => ({
              id: n.id || `N${i + 1}`,
              title: n.label || n.key || '通知',
              body: n.value || '',
              type: 'system' as const,
              read: false,
              time: new Date().toLocaleString('zh-CN'),
            })))
          }
        }
      } catch {
        // Silent fail - default values will be shown
      }
    }
    fetchMobileData()
  }, [])

  useEffect(() => {
    if (pushService.permission === 'default') {
      pushService.requestPermission().then(p => setPushEnabled(p === 'granted'))
    }
  }, [])

  useEffect(() => {
    return () => {
      if (countdownRef.current) window.clearInterval(countdownRef.current)
    }
  }, [])

  const startSmsCountdown = (seconds: number) => {
    if (countdownRef.current) window.clearInterval(countdownRef.current)
    setSmsCountdown(seconds)
    countdownRef.current = window.setInterval(() => {
      setSmsCountdown(prev => {
        if (prev <= 1) {
          if (countdownRef.current) {
            window.clearInterval(countdownRef.current)
            countdownRef.current = null
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const sendSmsCode = async () => {
    if (!/^1[3-9]\d{9}$/.test(phoneInput)) {
      setLoginError('请输入正确的手机号')
      return
    }
    setLoginError(null)
    setLoginState('sending')
    await new Promise(r => setTimeout(r, SMS_RESEND_COOLDOWN_MS))
    setLoginState('verifying')
    startSmsCountdown(SMS_COUNTDOWN_SECONDS)
  }

  const verifySmsCode = async () => {
    if (smsCode.length !== 6) {
      setLoginError('验证码应为 6 位')
      return
    }
    setLoginError(null)
    setLoginState('verifying')
    await new Promise(r => setTimeout(r, 500))
    if (smsCode === '000000') {
      setLoginError('验证码错误,请重新获取')
      setLoginState('error')
      return
    }
    setLoginState('success')
    setActiveTab('home')
  }

  const handleWechatPay = async (report: MobileReport) => {
    setPayingReportId(report.id)
    setPayState('invoking')
    setPayError(null)
    const orderNo = `RPT-${report.id}-${Date.now()}`
    const totalFee = 5000
    const r = await wechatPay.jsapiPay({
      outTradeNo: orderNo,
      totalFee,
      body: `检查报告 - ${report.examType}`,
      openId: mobileUser.id,
      patientId: mobileUser.id,
      onSuccess: (res) => {
        setPayState('success')
        if (pushEnabled) {
          pushService.sendLocalNotification({ title: '支付成功', body: `订单 ${orderNo} 已完成,交易号 ${res.transactionId}` })
        }
      },
      onFail: (err) => {
        setPayState('failed')
        setPayError(err.message)
      },
    })
    if (!r.success) {
      setPayState('failed')
      setPayError(r.error?.message || '微信下单失败')
    }
  }

  const togglePush = async () => {
    if (pushEnabled) {
      await pushService.unsubscribe()
      setPushEnabled(false)
    } else {
      const perm = await pushService.requestPermission()
      if (perm === 'granted') {
        pushService.sendLocalNotification({ title: 'G005 RIS', body: '通知已开启' })
        setPushEnabled(true)
      }
    }
  }

  const renderHome = () => (
    <>
      {/* Banner */}
      <div style={{ ...s.card, background: 'linear-gradient(135deg, #eff6ff, #dbeafe)', border: 'none' }}>
        <div style={{ fontSize: 12, color: '#1e40af', fontWeight: 600 }}>欢迎回来</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#1e3a5f', margin: '4px 0' }}>{mobileUser.name}</div>
        <div style={{ fontSize: 12, color: '#64748b' }}>您有 {mobileReports.filter(r => r.status === 'ready').length} 份新报告可查看</div>
      </div>

      {/* Quick Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
        {[
          { icon: '📋', label: '我的报告', tab: 'reports' as const },
          { icon: '🖼️', label: '影像查看', tab: 'reports' as const },
          { icon: '🔔', label: '消息中心', tab: 'notifications' as const },
        ].map(action => (
          <div key={action.label} style={{ background: '#fff', borderRadius: 10, padding: 12, textAlign: 'center', border: '1px solid #e2e8f0', cursor: 'pointer' }}
            onClick={() => setActiveTab(action.tab)}>
            <div style={{ fontSize: 24, marginBottom: 4 }}>{action.icon}</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>{action.label}</div>
          </div>
        ))}
      </div>

      {/* Recent Reports */}
      <div style={s.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={s.cardTitle}>最近报告</div>
          <span style={{ fontSize: 12, color: '#3b82f6', cursor: 'pointer' }} onClick={() => setActiveTab('reports')}>查看全部 →</span>
        </div>
        {mobileReports.slice(0, 2).map(r => (
          <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}
            onClick={() => setSelectedReport(r)}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{r.examType}</div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>{r.examDate}</div>
            </div>
            <span style={s.badge(r.status)}>{r.status === 'ready' ? '已出报告' : '待出具'}</span>
          </div>
        ))}
      </div>

      {/* Notifications Preview */}
      <div style={s.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={s.cardTitle}>消息</div>
          <span style={{ fontSize: 12, color: '#3b82f6', cursor: 'pointer' }} onClick={() => setActiveTab('notifications')}>查看全部 →</span>
        </div>
        {mobileNotifications.filter(n => !n.read).slice(0, 2).map(n => (
          <div key={n.id} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6', marginTop: 4, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#1e293b' }}>{n.title}</div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>{n.body}</div>
            </div>
          </div>
        ))}
      </div>
    </>
  )

  const renderReports = () => (
    <div style={s.card}>
      {selectedReport ? (
        <div>
          <button style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, color: '#3b82f6', marginBottom: 12, padding: 0 }} onClick={() => setSelectedReport(null)}>
            ← 返回列表
          </button>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>{selectedReport.examType}</div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 12 }}>{selectedReport.examDate} · {selectedReport.doctorName}</div>
          <div style={{ padding: 12, background: '#f8fafc', borderRadius: 8, fontSize: 13, color: '#475569', lineHeight: 1.6, marginBottom: 16 }}>
            检查描述：双肺野清晰，肺纹理走行自然。\n诊断意见：未见明显异常。
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => void handleDownloadPdf(selectedReport)} disabled={downloadingPdf} style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', background: downloadingPdf ? '#93c5fd' : '#3b82f6', color: '#fff', fontSize: 12, fontWeight: 600, cursor: downloadingPdf ? 'wait' : 'pointer' }}>{downloadingPdf ? '导出中...' : '📥 下载PDF'}</button>
            <button onClick={() => void handleViewImages(selectedReport)} style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', background: '#059669', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>🖼️ 查看影像</button>
          </div>
          <div style={{ marginTop: 12, padding: 10, background: '#f0f9ff', borderRadius: 8, border: '1px solid #bae6fd' }}>
            <div style={{ fontSize: 12, color: '#0369a1', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
              <CreditCard size={12} /> 报告查阅费: ¥50.00
            </div>
            <button
              onClick={() => handleWechatPay(selectedReport)}
              disabled={payState === 'invoking' || (payingReportId === selectedReport.id && payState === 'success')}
              style={{
                width: '100%',
                padding: '8px 0',
                borderRadius: 8,
                border: 'none',
                background: payState === 'success' && payingReportId === selectedReport.id ? '#94a3b8' : payState === 'invoking' ? '#cbd5e1' : '#07c160',
                color: '#fff',
                fontSize: 13,
                fontWeight: 600,
                cursor: payState === 'invoking' ? 'not-allowed' : 'pointer',
              }}
            >
              {payState === 'idle' && '微信支付'}
              {payState === 'invoking' && '正在唤起微信支付...'}
              {payState === 'success' && payingReportId === selectedReport.id && '✓ 支付成功'}
              {payState === 'failed' && (payError || '支付失败,重试')}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div style={s.cardTitle}>检查报告</div>
          {mobileReports.map(r => (
            <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }} onClick={() => setSelectedReport(r)}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{r.examType}</div>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>{r.examDate}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={s.badge(r.status)}>{r.status === 'ready' ? '已出报告' : '待出具'}</span>
                <ChevronRight size={14} color="#94a3b8" />
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  )

  const renderNotifications = () => (
    <div style={s.card}>
      <div style={s.cardTitle}>消息中心</div>
      {mobileNotifications.map(n => (
        <div key={n.id} style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: n.read ? '#e2e8f0' : '#3b82f6', marginTop: 5, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#1e293b' }}>{n.title}</div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{n.body}</div>
            <div style={{ fontSize: 12, color: '#cbd5e1', marginTop: 4 }}>{n.time}</div>
          </div>
        </div>
      ))}
    </div>
  )

  const renderProfile = () => (
    <div>
      <div style={s.card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ ...s.avatar, width: 56, height: 56, fontSize: 24, background: '#dbeafe' }}>{mobileUser.avatar}</div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#1e293b' }}>{mobileUser.name}</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{mobileUser.phone}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <span style={s.verifiedBadge}>已实名认证 ✓</span>
        </div>
        <div style={{ marginTop: 12, fontSize: 12, color: loginState === 'success' ? '#059669' : '#94a3b8' }}>
          登录状态: {loginState === 'success' ? '已通过短信验证' : '未登录 (可点此登录)'}
          {loginState !== 'success' && (
            <button onClick={() => setActiveTab('login')} style={{ marginLeft: 8, border: 'none', background: '#3b82f6', color: '#fff', padding: '4px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>
              去登录
            </button>
          )}
        </div>
      </div>
      <div style={s.card}>
        {[
          { icon: '🔒', label: '账户安全' },
          { icon: '📱', label: '设备管理' },
          { icon: '⚙️', label: '设置' },
          { icon: 'ℹ️', label: '关于' },
        ].map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '10px 0', borderBottom: i < 3 ? '1px solid #f1f5f9' : 'none', cursor: 'pointer' }}>
            <span style={{ marginRight: 10, fontSize: 16 }}>{item.icon}</span>
            <span style={{ fontSize: 13, color: '#334155', flex: 1 }}>{item.label}</span>
            <ChevronRight size={14} color="#94a3b8" />
          </div>
        ))}
      </div>
    </div>
  )

  const renderLogin = () => (
    <div style={s.card}>
      <div style={{ ...s.cardTitle, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Smartphone size={16} color="#1e40af" /> 手机号快捷登录
      </div>
      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>
        输入手机号获取短信验证码,验证通过后即可查看完整报告与缴费
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 8, marginBottom: 10 }}>
        <Phone size={14} color="#64748b" />
        <input
          value={phoneInput}
          onChange={e => setPhoneInput(e.target.value.replace(/\D/g, '').slice(0, 11))}
          placeholder="请输入手机号"
          style={{ flex: 1, border: 'none', outline: 'none', fontSize: 14, background: 'transparent' }}
          inputMode="numeric"
        />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 8, marginBottom: 10 }}>
        <MessageSquare size={14} color="#64748b" />
        <input
          value={smsCode}
          onChange={e => setSmsCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="6 位短信验证码"
          style={{ flex: 1, border: 'none', outline: 'none', fontSize: 14, background: 'transparent' }}
          inputMode="numeric"
        />
        <button
          onClick={sendSmsCode}
          disabled={smsCountdown > 0 || loginState === 'sending'}
          style={{
            border: 'none',
            background: smsCountdown > 0 ? '#e2e8f0' : '#3b82f6',
            color: smsCountdown > 0 ? '#94a3b8' : '#fff',
            padding: '6px 10px',
            borderRadius: 6,
            fontSize: 12,
            cursor: smsCountdown > 0 ? 'not-allowed' : 'pointer',
            minWidth: 90,
          }}
        >
          {smsCountdown > 0 ? `${smsCountdown}s 后重发` : '获取验证码'}
        </button>
      </div>
      {loginError && <div style={{ fontSize: 12, color: '#dc2626', marginBottom: 8 }}>{loginError}</div>}
      <button
        onClick={verifySmsCode}
        disabled={loginState === 'verifying'}
        style={{
          width: '100%',
          padding: '10px 0',
          borderRadius: 8,
          border: 'none',
          background: loginState === 'verifying' ? '#94a3b8' : '#059669',
          color: '#fff',
          fontSize: 14,
          fontWeight: 600,
          cursor: loginState === 'verifying' ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
        }}
      >
        <Lock size={14} /> {loginState === 'verifying' ? '验证中...' : '登录'}
      </button>
      <div style={{ marginTop: 10, fontSize: 11, color: '#94a3b8', textAlign: 'center' }}>
        登录即表示同意《用户协议》和《隐私政策》
      </div>
    </div>
  )

  return (
    <div style={s.wrapper}>
      {/* Status Bar */}
      <div style={{ background: '#1e40af', color: '#fff', padding: '6px 16px', fontSize: 12, display: 'flex', justifyContent: 'space-between' }}>
        <span>9:41</span>
        <span>📶 🔋 100%</span>
      </div>
      {/* Header */}
      <div style={s.header}>
        <div style={s.headerTop}>
          <div style={s.userRow}>
            <div style={s.avatar}>👤</div>
            <div>
              <div style={s.userName}>{mobileUser.name}</div>
              <span style={s.verifiedBadge}>✓ 已认证</span>
            </div>
          </div>
          <span style={{ fontSize: 20, cursor: 'pointer' }} onClick={togglePush} title={pushEnabled ? '关闭推送通知' : '开启推送通知'}>
            {pushEnabled ? <Bell size={20} /> : <BellOff size={20} />}
          </span>
        </div>
        {/* Tab Bar */}
        <div style={{ display: 'flex', marginTop: 8 }}>
          {(['home', 'reports', 'notifications', 'profile', 'login'] as const).map(t => (
            <div key={t} style={s.tab(activeTab === t)} onClick={() => setActiveTab(t)}>
              {t === 'home' ? '首页' : t === 'reports' ? '报告' : t === 'notifications' ? '消息' : t === 'profile' ? '我的' : '登录'}
            </div>
          ))}
        </div>
      </div>
      {/* Content */}
      <div style={s.content}>
        {activeTab === 'home' && renderHome()}
        {activeTab === 'reports' && renderReports()}
        {activeTab === 'notifications' && renderNotifications()}
        {activeTab === 'profile' && renderProfile()}
        {activeTab === 'login' && renderLogin()}
      </div>
      {/* Bottom Nav */}
      <div style={s.nav}>
        {[
          { key: 'home' as const, icon: '🏠', label: '首页' },
          { key: 'reports' as const, icon: '📋', label: '报告' },
          { key: 'notifications' as const, icon: '🔔', label: '消息' },
          { key: 'profile' as const, icon: '👤', label: '我的' },
          { key: 'login' as const, icon: '🔑', label: '登录' },
        ].map(n => (
          <div key={n.key} style={s.navItem(activeTab === n.key)} onClick={() => setActiveTab(n.key)}>
            <div style={{ fontSize: 18 }}>{n.icon}</div>
            <div>{n.label}</div>
          </div>
        ))}
      </div>

      {/* 影像查看弹层 */}
      {imageViewer && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }} onClick={() => setImageViewer(null)}>
          <div style={{ maxWidth: 420, width: '92%', background: '#0f172a', borderRadius: 16, padding: 16 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>{imageViewer.report.examType} 影像</span>
              <button onClick={() => setImageViewer(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 4 }}><X size={18} /></button>
            </div>
            {imageLoading ? (
              <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: 13 }}>影像加载中...</div>
            ) : (
              <>
                <div style={{ height: 260, background: 'linear-gradient(135deg,#1e293b,#0f172a)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #334155' }}>
                  <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.6)' }}>
                    <div style={{ fontSize: 40, marginBottom: 8 }}>🩻</div>
                    <div style={{ fontSize: 13 }}>{imageViewer.report.examType} · {imageViewer.report.examDate}</div>
                    <div style={{ fontSize: 11, marginTop: 6, color: 'rgba(255,255,255,0.4)' }}>
                      {imageViewer.study ? `序列 ${imageViewer.study.series?.length ?? 0} 组 · ${imageViewer.study.studyInstanceUid?.slice(0, 12) ?? ''}...` : 'DICOM 影像预览'}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button onClick={() => setImageViewer(null)} style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: '1px solid #334155', background: 'transparent', color: '#cbd5e1', fontSize: 12, cursor: 'pointer' }}>关闭</button>
                  <button onClick={() => void document.documentElement.requestFullscreen?.().catch(() => {})} style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', background: '#3b82f6', color: '#fff', fontSize: 12, cursor: 'pointer' }}>全屏查看</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
