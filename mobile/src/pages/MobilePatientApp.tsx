import { useState, useCallback } from 'react'
import { Home, FileText, Bell, User, ChevronRight, Calendar, Clock, X, Phone, Shield, Eye, CheckCircle, LogIn } from 'lucide-react'
import OfflineIndicator from '../components/OfflineIndicator'

interface PatientReport {
  id: string
  examType: string
  examDate: string
  hospital: string
  doctor: string
  status: 'ready' | 'pending'
  hasImages: boolean
  findings?: string
  conclusion?: string
}

interface Appointment {
  id: string
  examType: string
  hospital: string
  date: string
  time: string
  status: 'scheduled' | 'completed' | 'cancelled'
}

const MOCK_REPORTS: PatientReport[] = [
  { id: 'R1', examType: '胸部CT平扫', examDate: '2026-06-01', hospital: '市人民医院', doctor: '李明', status: 'ready', hasImages: true, findings: '双肺野清晰，肺纹理走行自然。纵隔未见明显肿大淋巴结。', conclusion: '未见明显异常。' },
  { id: 'R2', examType: '颅脑MRI平扫', examDate: '2026-04-15', hospital: '市人民医院', doctor: '王芳', status: 'ready', hasImages: true, findings: '颅内未见明显异常信号影。脑室系统无扩张。', conclusion: '颅脑MRI平扫未见明显异常。' },
  { id: 'R3', examType: '腹部彩超', examDate: '2026-04-20', hospital: '市中医院', doctor: '刘伟', status: 'pending', hasImages: false },
]

const MOCK_APPOINTMENTS: Appointment[] = [
  { id: 'A1', examType: '腰椎MR平扫', hospital: '市人民医院', date: '2026-07-15', time: '09:30', status: 'scheduled' },
  { id: 'A2', examType: '胸部CT复查', hospital: '市人民医院', date: '2026-06-01', time: '08:00', status: 'completed' },
  { id: 'A3', examType: '膝关节DR', hospital: '市人民医院', date: '2026-05-10', time: '14:00', status: 'cancelled' },
]

const btnBase: React.CSSProperties = {
  minHeight: 44, minWidth: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
  border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 13,
  padding: '10px 16px', WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
}

export default function MobilePatientApp() {
  const [loggedIn, setLoggedIn] = useState(false)
  const [phone, setPhone] = useState('138****5678')
  const [code, setCode] = useState('')
  const [activeTab, setActiveTab] = useState<'home' | 'reports' | 'appointments' | 'profile'>('home')
  const [selectedReport, setSelectedReport] = useState<PatientReport | null>(null)
  const [cancelConfirm, setCancelConfirm] = useState<string | null>(null)

  const handleLogin = useCallback(() => {
    if (phone.length >= 11 && code.length >= 4) {
      setLoggedIn(true)
    }
  }, [phone, code])

  const handleCancelAppointment = useCallback((id: string) => {
    setCancelConfirm(id)
  }, [])

  const confirmCancel = useCallback(() => {
    setCancelConfirm(null)
  }, [])

  if (!loggedIn) {
    return (
      <div style={containerStyle}>
        <div style={{ padding: '60px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🏥</div>
          <h2 style={{ color: '#1e3a5f', marginBottom: 8 }}>患者服务平台</h2>
          <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 32 }}>登录查看检查报告和预约管理</p>

          <div style={{ textAlign: 'left', marginBottom: 16 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6, display: 'block' }}>手机号</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #e2e8f0', borderRadius: 10, padding: '0 12px', background: '#fff' }}>
              <Phone size={16} color="#94a3b8" />
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="请输入手机号" maxLength={11}
                style={{ border: 'none', outline: 'none', fontSize: 14, color: '#334155', width: '100%', padding: '12px 0', background: 'transparent' }} />
            </div>
          </div>

          <div style={{ textAlign: 'left', marginBottom: 24 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6, display: 'block' }}>验证码</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #e2e8f0', borderRadius: 10, padding: '0 12px', background: '#fff', flex: 1 }}>
                <Shield size={16} color="#94a3b8" />
                <input value={code} onChange={e => setCode(e.target.value)} placeholder="输入验证码" maxLength={6}
                  style={{ border: 'none', outline: 'none', fontSize: 14, color: '#334155', width: '100%', padding: '12px 0', background: 'transparent' }} />
              </div>
              <button style={{ ...btnBase, background: '#f1f5f9', color: '#3b82f6', fontSize: 12, padding: '12px', whiteSpace: 'nowrap' }}>获取验证码</button>
            </div>
          </div>

          <button onClick={handleLogin} style={{ ...btnBase, background: 'linear-gradient(135deg, #1e40af, #3b82f6)', color: '#fff', width: '100%', gap: 6, fontSize: 15 }}>
            <LogIn size={18} /> 登录
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>患者端</div>
          <OfflineIndicator compact />
        </div>
        <div style={{ display: 'flex', marginTop: 4 }}>
          {(['home', 'reports', 'appointments', 'profile'] as const).map(t => (
            <button key={t} onClick={() => setActiveTab(t)}
              style={{ flex: 1, padding: '8px 0', textAlign: 'center', fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none', background: 'transparent', color: activeTab === t ? '#fff' : 'rgba(255,255,255,0.6)', borderBottom: activeTab === t ? '2px solid #fff' : '2px solid transparent' }}>
              {t === 'home' ? '首页' : t === 'reports' ? '报告' : t === 'appointments' ? '预约' : '我的'}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {activeTab === 'home' && (
          <>
            <div style={{ ...cardStyle, background: 'linear-gradient(135deg, #eff6ff, #dbeafe)', border: 'none' }}>
              <div style={{ fontSize: 12, color: '#1e40af', fontWeight: 600 }}>欢迎回来</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#1e3a5f', margin: '4px 0' }}>张三</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>您有 {MOCK_REPORTS.filter(r => r.status === 'ready').length} 份新报告可查看</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
              {[
                { icon: <FileText size={22} />, label: '我的报告', tab: 'reports' as const, color: '#3b82f6' },
                { icon: <Calendar size={22} />, label: '预约管理', tab: 'appointments' as const, color: '#059669' },
                { icon: <Bell size={22} />, label: '消息中心', tab: 'profile' as const, color: '#d97706' },
              ].map(action => (
                <button key={action.label} onClick={() => setActiveTab(action.tab)}
                  style={{ ...btnBase, flexDirection: 'column', background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '14px 8px', gap: 6 }}>
                  <span style={{ color: action.color }}>{action.icon}</span>
                  <span style={{ fontSize: 12, color: '#64748b' }}>{action.label}</span>
                </button>
              ))}
            </div>

            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>最近报告</div>
                <button onClick={() => setActiveTab('reports')} style={{ ...btnBase, background: 'transparent', fontSize: 12, color: '#3b82f6', padding: 4 }}>查看全部 →</button>
              </div>
              {MOCK_REPORTS.slice(0, 2).map(r => (
                <div key={r.id} style={timelineItemStyle} onClick={() => { setSelectedReport(r); setActiveTab('reports') }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: r.status === 'ready' ? '#059669' : '#d97706', flexShrink: 0, marginTop: 4 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{r.examType}</div>
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>{r.examDate}</div>
                  </div>
                  <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600, background: r.status === 'ready' ? '#dcfce7' : '#fef9c3', color: r.status === 'ready' ? '#166534' : '#854d0e' }}>
                    {r.status === 'ready' ? '已出报告' : '待出具'}
                  </span>
                </div>
              ))}
            </div>

            <div style={cardStyle}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', marginBottom: 12 }}>临近预约</div>
              {MOCK_APPOINTMENTS.filter(a => a.status === 'scheduled').slice(0, 1).map(a => (
                <div key={a.id} style={timelineItemStyle}>
                  <Calendar size={16} color="#3b82f6" style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{a.examType}</div>
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>{a.date} {a.time} · {a.hospital}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {activeTab === 'reports' && (
          <div style={cardStyle}>
            {selectedReport ? (
              <div>
                <button onClick={() => setSelectedReport(null)} style={{ ...btnBase, background: 'transparent', fontSize: 12, color: '#3b82f6', padding: 0, marginBottom: 12 }}>
                  ← 返回列表
                </button>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>{selectedReport.examType}</div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>{selectedReport.examDate} · {selectedReport.hospital} · {selectedReport.doctor}</div>
                {selectedReport.findings && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 4 }}>检查所见</div>
                    <div style={{ padding: 12, background: '#f8fafc', borderRadius: 8, fontSize: 13, color: '#475569', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{selectedReport.findings}</div>
                  </div>
                )}
                {selectedReport.conclusion && (
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 4 }}>诊断意见</div>
                    <div style={{ padding: 12, background: '#f0fdf4', borderRadius: 8, fontSize: 13, color: '#166534', lineHeight: 1.6 }}>{selectedReport.conclusion}</div>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                  <button style={{ ...btnBase, flex: 1, background: '#3b82f6', color: '#fff', gap: 4 }}>
                    <Eye size={16} /> 查看影像
                  </button>
                  <button style={{ ...btnBase, flex: 1, background: '#f1f5f9', color: '#334155', gap: 4 }}>
                    <FileText size={16} /> 下载PDF
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', marginBottom: 12 }}>我的检查报告</div>
                {MOCK_REPORTS.map(r => (
                  <div key={r.id} style={timelineItemStyle} onClick={() => setSelectedReport(r)}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: r.status === 'ready' ? '#d1fae5' : '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {r.status === 'ready' ? <CheckCircle size={18} color="#059669" /> : <Clock size={18} color="#d97706" />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{r.examType}</div>
                      <div style={{ fontSize: 12, color: '#94a3b8' }}>{r.examDate} · {r.hospital}</div>
                    </div>
                    <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600, background: r.status === 'ready' ? '#dcfce7' : '#fef9c3', color: r.status === 'ready' ? '#166534' : '#854d0e' }}>
                      {r.status === 'ready' ? '已出报告' : '待出具'}
                    </span>
                    <ChevronRight size={14} color="#cbd5e1" />
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {activeTab === 'appointments' && (
          <div style={cardStyle}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', marginBottom: 12 }}>预约管理</div>
            {MOCK_APPOINTMENTS.map(a => (
              <div key={a.id} style={{ ...timelineItemStyle, flexWrap: 'wrap' }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: a.status === 'scheduled' ? '#dbeafe' : a.status === 'completed' ? '#d1fae5' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {a.status === 'scheduled' ? <Calendar size={18} color="#2563eb" /> : a.status === 'completed' ? <CheckCircle size={18} color="#059669" /> : <X size={18} color="#94a3b8" />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{a.examType}</div>
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>{a.date} {a.time} · {a.hospital}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600, background: a.status === 'scheduled' ? '#dbeafe' : a.status === 'completed' ? '#d1fae5' : '#f1f5f9', color: a.status === 'scheduled' ? '#2563eb' : a.status === 'completed' ? '#059669' : '#94a3b8' }}>
                    {a.status === 'scheduled' ? '已预约' : a.status === 'completed' ? '已完成' : '已取消'}
                  </span>
                  {a.status === 'scheduled' && (
                    <button onClick={() => handleCancelAppointment(a.id)} style={{ ...btnBase, background: '#fee2e2', color: '#dc2626', padding: '6px 10px', fontSize: 11 }}>
                      取消
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'profile' && (
          <>
            <div style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>👤</div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#1e293b' }}>张三</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>{phone}</div>
                </div>
              </div>
              <div style={{ padding: '8px 12px', background: '#f0fdf4', borderRadius: 8, fontSize: 12, color: '#166534', display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircle size={14} color="#059669" /> 已实名认证
              </div>
            </div>
            <div style={cardStyle}>
              {[
                { icon: Shield, label: '账户安全' },
                { icon: Bell, label: '消息通知' },
                { icon: Clock, label: '就诊记录' },
              ].map((item, i) => {
                const Icon = item.icon
                return (
                  <div key={item.label} style={{ display: 'flex', alignItems: 'center', padding: '12px 0', borderBottom: i < 2 ? '1px solid #f1f5f9' : 'none', cursor: 'pointer' }}>
                    <Icon size={18} color="#64748b" style={{ marginRight: 12 }} />
                    <span style={{ fontSize: 14, color: '#334155', flex: 1 }}>{item.label}</span>
                    <ChevronRight size={16} color="#cbd5e1" />
                  </div>
                )
              })}
            </div>
            <button onClick={() => setLoggedIn(false)} style={{ ...btnBase, background: '#fee2e2', color: '#dc2626', width: '100%', marginTop: 8 }}>
              退出登录
            </button>
          </>
        )}
      </div>

      <div style={{ display: 'flex', background: '#fff', borderTop: '1px solid #e2e8f0', padding: '4px 0 6px', flexShrink: 0 }}>
        {[
          { key: 'home' as const, icon: Home, label: '首页' },
          { key: 'reports' as const, icon: FileText, label: '报告' },
          { key: 'appointments' as const, icon: Calendar, label: '预约' },
          { key: 'profile' as const, icon: User, label: '我的' },
        ].map(navItem => {
          const Icon = navItem.icon
          return (
            <button key={navItem.key} onClick={() => setActiveTab(navItem.key)}
              style={{ flex: 1, textAlign: 'center', padding: '6px 0', cursor: 'pointer', border: 'none', background: 'transparent', WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}>
              <Icon size={22} style={{ display: 'block', margin: '0 auto 2px', color: activeTab === navItem.key ? '#1e40af' : '#94a3b8' }} />
              <span style={{ fontSize: 10, color: activeTab === navItem.key ? '#1e40af' : '#94a3b8', fontWeight: activeTab === navItem.key ? 700 : 400 }}>{navItem.label}</span>
            </button>
          )
        })}
      </div>

      {cancelConfirm && (
        <div style={modalOverlay} onClick={() => setCancelConfirm(null)}>
          <div style={modalContent} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>确认取消预约？</div>
            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>取消后该预约将释放给其他患者</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setCancelConfirm(null)} style={{ ...btnBase, flex: 1, background: '#f1f5f9', color: '#64748b' }}>暂不取消</button>
              <button onClick={confirmCancel} style={{ ...btnBase, flex: 1, background: '#dc2626', color: '#fff' }}>确认取消</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const containerStyle: React.CSSProperties = {
  maxWidth: 420, margin: '0 auto', background: '#f8fafc', minHeight: '100vh',
  display: 'flex', flexDirection: 'column', fontFamily: '-apple-system, sans-serif',
}

const headerStyle: React.CSSProperties = {
  background: 'linear-gradient(135deg, #1e40af, #3b82f6)', color: '#fff', padding: '16px 16px 8px',
}

const cardStyle: React.CSSProperties = {
  background: '#fff', borderRadius: 12, padding: 16, marginBottom: 12,
  border: '1px solid #e2e8f0',
}

const timelineItemStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0',
  borderBottom: '1px solid #f1f5f9', cursor: 'pointer', minHeight: 44,
}

const modalOverlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex',
  alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 24,
}

const modalContent: React.CSSProperties = {
  background: '#fff', borderRadius: 16, padding: 24, maxWidth: 340, width: '100%',
  boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
}
