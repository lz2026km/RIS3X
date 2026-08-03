import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { LayoutDashboard, Stethoscope, Monitor, Activity, Smartphone } from 'lucide-react'
import MobileDoctorWorkstation from '../pages/MobileDoctorWorkstation'
import MobileNurseWorkstation from '../pages/MobileNurseWorkstation'
import MobileTechWorkstation from '../pages/MobileTechWorkstation'
import MobilePatientApp from '../pages/MobilePatientApp'
import OfflineIndicator from '../components/OfflineIndicator'

export interface NavTab {
  key: string
  path: string
  icon: React.ComponentType<{ size?: number | string; style?: React.CSSProperties }>
  label: string
  badge?: number
}

const TABS: NavTab[] = [
  { key: 'dashboard', path: '/', icon: LayoutDashboard, label: '首页' },
  { key: 'doctor', path: '/doctor', icon: Stethoscope, label: '医生' },
  { key: 'tech', path: '/tech', icon: Monitor, label: '技师' },
  { key: 'nurse', path: '/nurse', icon: Activity, label: '护士' },
  { key: 'patient', path: '/patient', icon: Smartphone, label: '患者' },
]

function HomeScreen() {
  return (
    <div style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>
      <LayoutDashboard size={48} style={{ margin: '40px auto 16px', display: 'block', opacity: 0.5 }} />
      <h2 style={{ color: '#1e3a5f', marginBottom: 8 }}>G005 RIS Mobile</h2>
      <p>请通过底部导航选择角色工作台</p>
      <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center' }}><OfflineIndicator /></div>
    </div>
  )
}

export default function AppNavigator() {
  const navigate = useNavigate()
  const location = useLocation()

  const currentTab = TABS.find(t => location.pathname === t.path)?.key || 'dashboard'

  return (
    <div style={{ maxWidth: 420, margin: '0 auto', background: '#f8fafc', minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: '-apple-system, sans-serif' }}>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <Routes>
          <Route path="/" element={<HomeScreen />} />
          <Route path="/doctor" element={<MobileDoctorWorkstation />} />
          <Route path="/tech" element={<MobileTechWorkstation />} />
          <Route path="/nurse" element={<MobileNurseWorkstation />} />
          <Route path="/patient" element={<MobilePatientApp />} />
        </Routes>
      </div>

      <div style={{ display: 'flex', background: '#fff', borderTop: '1px solid #e2e8f0', padding: '4px 0 6px', flexShrink: 0 }}>
        {TABS.map(tab => {
          const Icon = tab.icon
          const active = currentTab === tab.key
          return (
            <div
              key={tab.key}
              onClick={() => navigate(tab.path)}
              style={{ flex: 1, textAlign: 'center', padding: '4px 0', cursor: 'pointer', position: 'relative' }}
            >
              <Icon size={20} style={{ display: 'block', margin: '0 auto 2px', color: active ? '#1e3a5f' : '#94a3b8' }} />
              <div style={{ fontSize: 10, color: active ? '#1e3a5f' : '#94a3b8', fontWeight: active ? 700 : 400 }}>{tab.label}</div>
              {tab.badge && (
                <span style={{ position: 'absolute', top: 0, right: '50%', marginRight: -16, background: '#dc2626', color: '#fff', fontSize: 9, padding: '1px 5px', borderRadius: 8, fontWeight: 700 }}>
                  {tab.badge}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
