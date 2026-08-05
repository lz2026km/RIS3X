import { useState, useCallback } from 'react'
import { Search, CheckCircle, AlertCircle, UserCheck, Clock, X, Check } from 'lucide-react'
import OfflineIndicator from '../components/OfflineIndicator'
import { useNavigate } from 'react-router-dom'

interface CriticalValue {
  id: string
  patientName: string
  examItem: string
  value: string
  threshold: string
  reportedAt: string
  status: 'unread' | 'signed'
  reportedBy: string
}

interface ConfirmItem {
  id: string
  patientName: string
  gender: string
  age: number
  modality: string
  examItem: string
  type: 'arrival' | 'departure'
  time: string
  status: 'pending' | 'confirmed'
}

const MOCK_CRITICAL: CriticalValue[] = [
  { id: 'C1', patientName: '陈国强', examItem: '冠脉CTA', value: '肌钙蛋白 15.2ng/mL', threshold: '>0.04ng/mL', reportedAt: '2026-06-15 06:45', status: 'unread', reportedBy: '检验科' },
  { id: 'C2', patientName: '张志刚', examItem: '胸部CT平扫', value: '主动脉直径 48mm', threshold: '<40mm', reportedAt: '2026-06-15 09:15', status: 'unread', reportedBy: 'AI辅助诊断' },
  { id: 'C3', patientName: '赵雪梅', examItem: '乳腺钼靶', value: 'BI-RADS 4C', threshold: '建议穿刺', reportedAt: '2026-06-14 11:00', status: 'signed', reportedBy: '李明医生' },
]

const MOCK_CONFIRMS: ConfirmItem[] = [
  { id: 'A1', patientName: '张伟', gender: '男', age: 42, modality: 'CT', examItem: '腹部CT增强', type: 'arrival', time: '09:00', status: 'pending' },
  { id: 'A2', patientName: '李芳', gender: '女', age: 35, modality: 'CT', examItem: '胸部CT平扫', type: 'arrival', time: '09:15', status: 'confirmed' },
  { id: 'A3', patientName: '王建国', gender: '男', age: 68, modality: 'MR', examItem: '头颅MR平扫', type: 'departure', time: '09:30', status: 'pending' },
  { id: 'A4', patientName: '赵雪梅', gender: '女', age: 55, modality: '乳腺钼靶', examItem: '乳腺钼靶', type: 'departure', time: '08:30', status: 'confirmed' },
]

const btnBase: React.CSSProperties = {
  minHeight: 44, minWidth: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
  border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 13,
  padding: '10px 16px', WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
}

export default function MobileNurseWorkstation() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<'critical' | 'confirm'>('critical')
  const [search, setSearch] = useState('')
  const [signModal, setSignModal] = useState<CriticalValue | null>(null)
  const [signature, setSignature] = useState('')
  const [confirmModal, setConfirmModal] = useState<ConfirmItem | null>(null)

  const unreadCount = MOCK_CRITICAL.filter(c => c.status === 'unread').length

  const filteredCritical = MOCK_CRITICAL.filter(c =>
    !search || c.patientName.includes(search) || c.examItem.includes(search)
  )

  const filteredConfirms = MOCK_CONFIRMS.filter(c =>
    !search || c.patientName.includes(search) || c.examItem.includes(search)
  )

  const handleSign = useCallback((val: CriticalValue) => {
    setSignModal(val)
    setSignature('')
  }, [])

  const confirmSign = useCallback(() => {
    if (!signature.trim()) return
    setSignModal(null)
    setSignature('')
  }, [signature])

  const handleConfirm = useCallback((item: ConfirmItem) => {
    setConfirmModal(item)
  }, [])

  const doConfirm = useCallback(() => {
    setConfirmModal(null)
  }, [])

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>护士移动工作站</div>
            <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>放射科 · 护理工作台</div>
          </div>
          <OfflineIndicator compact />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 12 }}>
          {[
            { value: unreadCount, label: '未签收', bg: '#fee2e2', color: '#dc2626' },
            { value: MOCK_CONFIRMS.filter(c => c.status === 'pending').length, label: '待确认', bg: '#fef3c7', color: '#d97706' },
            { value: MOCK_CONFIRMS.filter(c => c.status === 'confirmed').length, label: '已确认', bg: '#d1fae5', color: '#059669' },
          ].map(s => (
            <div key={s.label} style={{ background: s.bg, borderRadius: 8, padding: '8px 4px', textAlign: 'center', position: 'relative' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>{s.label}</div>
              {s.label === '未签收' && unreadCount > 0 && (
                <span style={{ position: 'absolute', top: -4, right: -4, background: '#dc2626', color: '#fff', fontSize: 10, padding: '2px 6px', borderRadius: 10, fontWeight: 700 }}>
                  {unreadCount}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div style={searchBarStyle}>
        <Search size={16} color="#94a3b8" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索患者..."
          style={{ border: 'none', outline: 'none', fontSize: 14, color: '#334155', width: '100%', background: 'transparent' }} />
      </div>

      <div style={{ display: 'flex', margin: '0 16px', gap: 4 }}>
        {[
          { key: 'critical' as const, icon: AlertCircle, label: '危急值', badge: unreadCount },
          { key: 'confirm' as const, icon: UserCheck, label: '检查确认' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ flex: 1, padding: '10px 0', textAlign: 'center', fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none', background: 'transparent', color: tab === t.key ? '#7c3aed' : '#94a3b8', borderBottom: tab === t.key ? '2px solid #7c3aed' : '2px solid transparent', position: 'relative' }}>
            <t.icon size={14} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
            {t.label}
            {t.badge && t.badge > 0 && (
              <span style={{ position: 'absolute', top: 2, right: '30%', background: '#dc2626', color: '#fff', fontSize: 9, padding: '1px 5px', borderRadius: 8, fontWeight: 700 }}>
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '8px 0' }}>
        {tab === 'critical' ? (
          filteredCritical.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8', fontSize: 14 }}>无危急值</div>
          ) : (
            filteredCritical.map(item => (
              <div key={item.id} style={listItemStyle}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: item.status === 'unread' ? '#fee2e2' : '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {item.status === 'unread' ? <AlertCircle size={18} color="#dc2626" /> : <CheckCircle size={18} color="#059669" />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>{item.patientName}</span>
                    {item.status === 'unread' && <span style={{ background: '#dc2626', color: '#fff', fontSize: 10, padding: '1px 5px', borderRadius: 8, fontWeight: 700 }}>新</span>}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{item.examItem}</div>
                  <div style={{ fontSize: 12, color: '#dc2626', marginTop: 2, fontWeight: 600 }}>{item.value}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>{item.reportedAt} · {item.reportedBy}</div>
                </div>
                {item.status === 'unread' && (
                  <button onClick={() => handleSign(item)} style={{ ...btnBase, background: '#7c3aed', color: '#fff', padding: '8px 12px', fontSize: 12 }}>
                    签收
                  </button>
                )}
              </div>
            ))
          )
        ) : (
          filteredConfirms.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8', fontSize: 14 }}>无待确认记录</div>
          ) : (
            filteredConfirms.map(item => (
              <div key={item.id} style={listItemStyle}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: item.type === 'arrival' ? '#dbeafe' : '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {item.type === 'arrival' ? <Clock size={18} color="#2563eb" /> : <Check size={18} color="#d97706" />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>{item.patientName}</span>
                    <span style={{ padding: '1px 6px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: item.type === 'arrival' ? '#dbeafe' : '#fef3c7', color: item.type === 'arrival' ? '#2563eb' : '#d97706' }}>
                      {item.type === 'arrival' ? '到达' : '离开'}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{item.gender}/{item.age}岁 · {item.modality}</div>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 1 }}>{item.examItem} · {item.time}</div>
                </div>
                {item.status === 'pending' && (
                  <button onClick={() => handleConfirm(item)} style={{ ...btnBase, background: item.type === 'arrival' ? '#2563eb' : '#d97706', color: '#fff', padding: '8px 12px', fontSize: 12 }}>
                    确认
                  </button>
                )}
                {item.status === 'confirmed' && (
                  <span style={{ fontSize: 12, color: '#059669', fontWeight: 600 }}>✓ 已确认</span>
                )}
              </div>
            ))
          )
        )}
      </div>

      <div style={{ display: 'flex', background: '#fff', borderTop: '1px solid #e2e8f0', padding: '4px 0 6px', flexShrink: 0 }}>
        {[
          { key: 'home', icon: 'Home', label: '首页', path: '/' },
          { key: 'critical', icon: 'Bell', label: '危急值' },
          { key: 'confirm', icon: 'UserCheck', label: '确认' },
          { key: 'profile', icon: 'User', label: '个人', path: '/profile' },
        ].map(tabItem => {
          const isActive = (tabItem.key === 'critical' && tab === 'critical') || (tabItem.key === 'confirm' && tab === 'confirm') || (tabItem.key === 'home') || (tabItem.key === 'profile')
          return (
            <button key={tabItem.key} onClick={() => {
              if (tabItem.path) navigate(tabItem.path)
              else if (tabItem.key === 'critical' || tabItem.key === 'confirm') setTab(tabItem.key as 'critical' | 'confirm')
            }}
              style={{ flex: 1, textAlign: 'center', padding: '6px 0', cursor: 'pointer', border: 'none', background: 'transparent', position: 'relative', WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}>
              <span style={{ fontSize: 22, display: 'block', margin: '0 auto 2px', color: isActive ? '#7c3aed' : '#94a3b8' }}>
                {tabItem.key === 'home' ? '🏠' : tabItem.key === 'critical' ? '🔔' : tabItem.key === 'confirm' ? '✅' : '👤'}
              </span>
              <span style={{ fontSize: 10, color: isActive ? '#7c3aed' : '#94a3b8', fontWeight: isActive ? 700 : 400 }}>{tabItem.label}</span>
            </button>
          )
        })}
      </div>

      {signModal && (
        <div style={modalOverlay} onClick={() => setSignModal(null)}>
          <div style={modalContent} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#1e293b' }}>危急值签收确认</div>
              <button onClick={() => setSignModal(null)} style={{ ...btnBase, background: 'transparent', padding: 4, minWidth: 32, minHeight: 32 }}>
                <X size={18} color="#94a3b8" />
              </button>
            </div>
            <div style={{ background: '#fee2e2', borderRadius: 8, padding: 12, marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#dc2626' }}>{signModal.patientName} · {signModal.examItem}</div>
              <div style={{ fontSize: 13, color: '#dc2626', marginTop: 4 }}>⚠ {signModal.value}</div>
              <div style={{ fontSize: 12, color: '#9b1c1c', marginTop: 2 }}>阈值: {signModal.threshold}</div>
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 8 }}>签名确认</div>
            <input value={signature} onChange={e => setSignature(e.target.value)} placeholder="输入您的姓名"
              style={{ width: '100%', padding: '12px 14px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
            <button onClick={confirmSign} disabled={!signature.trim()}
              style={{ ...btnBase, background: signature.trim() ? '#7c3aed' : '#d1d5db', color: '#fff', width: '100%', marginTop: 16, gap: 6 }}>
              <Check size={16} /> 确认签收
            </button>
          </div>
        </div>
      )}

      {confirmModal && (
        <div style={modalOverlay} onClick={() => setConfirmModal(null)}>
          <div style={modalContent} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', marginBottom: 12 }}>
              患者{confirmModal.type === 'arrival' ? '到达' : '离开'}确认
            </div>
            <div style={{ background: '#f8fafc', borderRadius: 8, padding: 12, marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>{confirmModal.patientName}</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{confirmModal.gender}/{confirmModal.age}岁 · {confirmModal.modality}</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{confirmModal.examItem} · {confirmModal.time}</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setConfirmModal(null)} style={{ ...btnBase, flex: 1, background: '#f1f5f9', color: '#64748b' }}>取消</button>
              <button onClick={doConfirm} style={{ ...btnBase, flex: 1, background: confirmModal.type === 'arrival' ? '#2563eb' : '#d97706', color: '#fff' }}>
                <Check size={16} /> 确认{confirmModal.type === 'arrival' ? '到达' : '离开'}
              </button>
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
  background: 'linear-gradient(135deg, #7c3aed, #a855f7)', color: '#fff', padding: '16px 16px 12px',
}

const searchBarStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, background: '#fff', borderRadius: 10,
  padding: '12px 14px', margin: '12px 16px 4px', border: '1px solid #e2e8f0',
}

const listItemStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: '#fff',
  borderBottom: '1px solid #f1f5f9', minHeight: 44,
}

const modalOverlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex',
  alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 24,
}

const modalContent: React.CSSProperties = {
  background: '#fff', borderRadius: 16, padding: 24, maxWidth: 360, width: '100%',
  boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
}
