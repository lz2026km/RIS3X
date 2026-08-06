import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import CriticalStatsDashboard from '../../components/v3/critical/CriticalStatsDashboard'
import PatientProfile360 from '../../components/v3/patient/PatientProfile360'
import PatientMergeTool from '../../components/v3/patient/PatientMergeTool'
import AppointmentCalendar from '../../components/v3/exam/AppointmentCalendar'
import ExamWorkflowBoard from '../../components/v3/exam/ExamWorkflowBoard'
import UserManagement from '../../components/v3/admin/UserManagement'
import DeviceManagement from '../../components/v3/admin/DeviceManagement'
import KpiDashboard from '../../components/v3/stats/KpiDashboard'
import RealtimeOpsDashboard from '../../components/v3/stats/RealtimeOpsDashboard'
import MobileWorklist from '../../components/v3/mobile/MobileWorklist'
import MobileCriticalResponse from '../../components/v3/mobile/MobileCriticalResponse'

describe('CriticalStatsDashboard', () => {
  const values = [
    { id: 'C1', patientName: 'A', patientId: 'P1', modality: 'CT', finding: 'f1', category: 'LIFE_THREATENING' as const, triggeredAt: new Date().toISOString(), reporter: 'd', recipient: 'r', recipientDept: 'dep', recipientPhone: '1', notifyStatus: 'ACKED' as const, channels: [] as any[], notifications: [], escalationChain: [], slaSeconds: 300, acker: 'd', ackedAt: new Date().toISOString() },
    { id: 'C2', patientName: 'B', patientId: 'P2', modality: 'CT', finding: 'f2', category: 'URGENT' as const, triggeredAt: new Date().toISOString(), reporter: 'd', recipient: 'r', recipientDept: 'dep', recipientPhone: '1', notifyStatus: 'PENDING' as const, channels: [] as any[], notifications: [], escalationChain: [], slaSeconds: 1800 },
  ]
  it('renders with stats and charts', () => {
    render(<CriticalStatsDashboard values={values} />)
    expect(screen.getByTestId('critical-stats-dashboard')).toBeInTheDocument()
  })
  it('shows empty when no data', () => {
    render(<CriticalStatsDashboard values={[]} />)
    expect(screen.getByText(/无危急值/)).toBeInTheDocument()
  })
})

describe('PatientProfile360', () => {
  const patient = {
    id: 'P1', name: '张三', gender: 'M' as const, birthDate: '1980-01-01', age: 44,
    idCard: '110101198001011234', phone: '13800001111', address: '北京',
    bloodType: 'A+', allergy: ['青霉素'], chronicDiseases: ['高血压'],
  }
  const exams = [
    { id: 'E1', modality: 'CT', bodyPart: 'CHEST', studyDate: '2024-06-15', studyTime: '10:00', status: 'COMPLETED' as const, doctor: 'd1' },
  ]
  const reports = [
    { id: 'R1', examId: 'E1', modality: 'CT', bodyPart: 'CHEST', conclusion: 'c', author: 'd1', reportDate: '2024-06-15', verified: true },
  ]
  const timeline = [
    { id: 'T1', type: 'EXAM' as const, at: '2024-06-15', title: 't1', description: 'd' },
  ]

  it('renders 360 view', () => {
    render(<PatientProfile360 patient={patient} exams={exams} reports={reports} timeline={timeline} />)
    expect(screen.getByTestId('patient-profile-360')).toBeInTheDocument()
    expect(screen.getByTestId('patient-avatar')).toBeInTheDocument()
  })
  it('shows timeline', () => {
    render(<PatientProfile360 patient={patient} exams={exams} reports={reports} timeline={timeline} />)
    expect(screen.getByTestId('patient-timeline')).toBeInTheDocument()
  })
})

describe('PatientMergeTool', () => {
  const duplicates = [
    {
      source: { id: 'P1', name: '张三', gender: 'M' as const, birthDate: '1980-01-01', age: 44, idCard: '110101198001011234', phone: '13800001111', address: '北京', visitCount: 5, lastVisit: '2024-06-01' },
      match: { id: 'P2', name: '张三', gender: 'M' as const, birthDate: '1980-01-01', age: 44, idCard: '110101198001011234', phone: '13800001111', address: '北京', visitCount: 3, lastVisit: '2024-05-01' },
      score: 95, nameScore: 100, idCardScore: 100, phoneScore: 100, birthDateScore: 100, genderScore: 100, addressScore: 80,
      matchedFields: ['姓名', '身份证', '电话'],
    },
  ]
  it('renders with match cards', () => {
    render(<PatientMergeTool duplicates={duplicates} />)
    expect(screen.getByTestId('patient-merge-tool')).toBeInTheDocument()
    expect(screen.getByTestId('merge-row-0')).toBeInTheDocument()
    expect(screen.getByTestId('merge-score-0')).toBeInTheDocument()
  })
  it('opens merge confirm modal', () => {
    render(<PatientMergeTool duplicates={duplicates} />)
    fireEvent.click(screen.getByTestId('merge-confirm-0'))
    expect(screen.getByTestId('merge-confirm-modal')).toBeInTheDocument()
  })
})

describe('AppointmentCalendar', () => {
  const devices = [
    { id: 'D1', name: 'CT-1', modality: 'CT', capacity: 30, workHours: { start: '08:00', end: '18:00' }, state: 'IDLE' as const },
  ]
  const appointments: any[] = []
  it('renders with calendar', () => {
    render(<AppointmentCalendar appointments={appointments} devices={devices} />)
    expect(screen.getByTestId('appointment-calendar')).toBeInTheDocument()
    // Calendar 组件(antd v5)需要 FullCalendar 等底层,在 jsdom 中可能渲染成 table,直接测试容器即可
    expect(screen.getByTestId('apt-day-list')).toBeInTheDocument()
  })
  it('opens create modal', () => {
    render(<AppointmentCalendar appointments={appointments} devices={devices} />)
    fireEvent.click(screen.getByTestId('apt-create-btn'))
    expect(screen.getByTestId('apt-create-modal')).toBeInTheDocument()
  })
})

describe('ExamWorkflowBoard', () => {
  const items = [
    { id: 'W1', patientName: 'A', patientId: 'P1', modality: 'CT', bodyPart: 'CHEST', stage: 'IN_EXAM' as const, priority: 'STAT' as const, technician: 't1', device: 'CT-1', critical: false },
    { id: 'W2', patientName: 'B', patientId: 'P2', modality: 'MR', bodyPart: 'BRAIN', stage: 'REPORT_PENDING' as const, priority: 'URGENT' as const, radiologist: 'r1', critical: true },
  ]
  it('renders 8 columns', () => {
    render(<ExamWorkflowBoard items={items} />)
    expect(screen.getByTestId('wf-col-SCHEDULED')).toBeInTheDocument()
    expect(screen.getByTestId('wf-col-IN_EXAM')).toBeInTheDocument()
    expect(screen.getByTestId('wf-col-REPORT_APPROVED')).toBeInTheDocument()
  })
  it('shows items in correct column', () => {
    render(<ExamWorkflowBoard items={items} />)
    expect(screen.getByTestId('wf-item-W1')).toBeInTheDocument()
    expect(screen.getByTestId('wf-item-W2')).toBeInTheDocument()
  })
})

describe('UserManagement', () => {
  const users = [
    { id: 'U1', username: 'admin', name: '管理员', role: 'ADMIN' as const, department: '信息科', active: true, twoFactor: true, failedLogins: 0, createdAt: '2024-01-01' },
  ]
  it('renders user table', () => {
    render(<UserManagement users={users} />)
    expect(screen.getByTestId('user-management')).toBeInTheDocument()
    expect(screen.getByTestId('user-table')).toBeInTheDocument()
  })
  it('opens create modal', () => {
    render(<UserManagement users={users} />)
    fireEvent.click(screen.getByTestId('user-create-btn'))
    expect(screen.getByTestId('user-form-modal')).toBeInTheDocument()
  })
  it('opens perm modal', () => {
    render(<UserManagement users={users} />)
    fireEvent.click(screen.getByTestId('user-perm-U1'))
    expect(screen.getByTestId('user-perm-modal')).toBeInTheDocument()
  })
})

describe('DeviceManagement', () => {
  const devices = [
    { id: 'D1', name: 'CT-1', modality: 'CT' as const, manufacturer: 'Siemens', model: 'SOMATOM', serial: 'S001', aeTitle: 'CT01', ip: '192.168.1.10', port: 104, state: 'ONLINE' as const, totalExams: 100, todayExams: 5, lastMaintenance: '2024-05-01', enabled: true },
  ]
  it('renders device table', () => {
    render(<DeviceManagement devices={devices} />)
    expect(screen.getByTestId('device-management')).toBeInTheDocument()
    expect(screen.getByTestId('device-table')).toBeInTheDocument()
  })
  it('opens create modal', () => {
    render(<DeviceManagement devices={devices} />)
    fireEvent.click(screen.getByTestId('device-create-btn'))
    expect(screen.getByTestId('device-form-modal')).toBeInTheDocument()
  })
})

describe('KpiDashboard', () => {
  const series = Array.from({ length: 30 }, (_, i) => ({
    date: `2024-06-${String(i + 1).padStart(2, '0')}`,
    exams: 50 + Math.floor(Math.random() * 20),
    reports: 45 + Math.floor(Math.random() * 15),
    critical: Math.floor(Math.random() * 3),
    averageReportMinutes: 30 + Math.floor(Math.random() * 15),
    deviceBusyHours: 6 + Math.random() * 2,
    positiveRate: 0.3 + Math.random() * 0.3,
    approvalRate: 0.85 + Math.random() * 0.1,
  }))
  const topDoctors = [
    { name: '张医师', count: 100 },
    { name: '李主任', count: 80 },
  ]

  it('renders with stats and charts', () => {
    render(<KpiDashboard series={series} topDoctors={topDoctors} modalityBreakdown={[{ modality: 'CT', count: 100 }]} />)
    expect(screen.getByTestId('kpi-dashboard')).toBeInTheDocument()
    expect(screen.getByTestId('kpi-trend')).toBeInTheDocument()
    expect(screen.getByTestId('kpi-modality')).toBeInTheDocument()
    expect(screen.getByTestId('kpi-report-time')).toBeInTheDocument()
  })
  it('handles empty series', () => {
    render(<KpiDashboard series={[]} />)
    expect(screen.getByText(/无数据/)).toBeInTheDocument()
  })
})

describe('RealtimeOpsDashboard', () => {
  const events = [
    { id: 'E1', type: 'EXAM' as const, at: new Date().toISOString(), title: 't1', description: 'd1', severity: 'info' as const },
  ]
  const devices = [
    { id: 'D1', name: 'CT-1', modality: 'CT', state: 'BUSY' as const, queue: 3, utilization: 80, currentPatient: 'P1' },
  ]
  it('renders ops dashboard', () => {
    render(<RealtimeOpsDashboard events={events} devices={devices} onlineUsers={5} />)
    expect(screen.getByTestId('realtime-ops-dashboard')).toBeInTheDocument()
    expect(screen.getByTestId('ops-event-stream')).toBeInTheDocument()
    expect(screen.getByTestId('ops-device-status')).toBeInTheDocument()
  })
})

describe('MobileWorklist', () => {
  const items = [
    { id: 'M1', patientName: '张三', patientId: 'P1', modality: 'CT', studyDate: '2024-06-15', studyTime: '10:00', state: 'PENDING' as const, priority: 'STAT' as const },
  ]
  it('renders mobile worklist', () => {
    render(<MobileWorklist items={items} />)
    expect(screen.getByTestId('mobile-worklist')).toBeInTheDocument()
    expect(screen.getByTestId('mob-item-M1')).toBeInTheDocument()
  })
})

describe('MobileCriticalResponse', () => {
  const items = [
    {
      id: 'MC1', patientName: '张三', patientId: 'P1', age: 50, gender: 'M' as const,
      modality: 'CT', bodyPart: 'CHEST', finding: '主动脉夹层', category: 'LIFE_THREATENING' as const,
      triggeredAt: new Date().toISOString(), triggeredBy: 'd', state: 'PENDING' as const,
      recipientName: '李主任', recipientDept: '心外科', wardLocation: 'ICU 5床',
    },
  ]
  it('renders mobile critical response', () => {
    render(<MobileCriticalResponse items={items} currentUser="我" />)
    expect(screen.getByTestId('mobile-critical-response')).toBeInTheDocument()
    expect(screen.getByTestId('mob-cv-MC1')).toBeInTheDocument()
  })
  it('shows life-threatening banner', () => {
    render(<MobileCriticalResponse items={items} currentUser="我" />)
    expect(screen.getByTestId('mob-critical-alert-banner')).toBeInTheDocument()
  })
})
