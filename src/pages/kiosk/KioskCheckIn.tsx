import React, { useState, useEffect } from 'react'
import { getQueueService, type KioskCheckInResult } from '../../services/queue/QueueService'

// ===== Types =====
export interface KioskState {
  step: 'idle' | 'idInput' | 'confirm' | 'result'
  idCardLast4: string
  patientName: string
  examItem: string
  result: KioskCheckInResult | null
}

// ===== Mock Patients =====
const MOCK_PATIENTS = [
  { id: 'P001', name: '张三', idCard: '310101196805121234', exams: [{ id: 'E001', name: '胸部CT平扫' }] },
  { id: 'P002', name: '李四', idCard: '310101199003154567', exams: [{ id: 'E002', name: '颅脑MRI平扫' }] },
  { id: 'P003', name: '王五', idCard: '310101197512238901', exams: [{ id: 'E003', name: '腹部彩超' }] },
]

// ===== Styles =====
const s = {
  container: { minHeight: '100vh', background: '#0f172a', color: '#e2e8f0', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', fontFamily: '-apple-system, sans-serif' },
  card: { background: '#1e293b', borderRadius: 16, padding: 40, maxWidth: 480, width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' },
  title: { fontSize: 28, fontWeight: 700, textAlign: 'center' as const, marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#94a3b8', textAlign: 'center' as const, marginBottom: 32 },
  input: { width: '100%', padding: '14px 16px', fontSize: 18, background: '#0f172a', border: '1px solid #334155', borderRadius: 10, color: '#f8fafc', textAlign: 'center' as const, letterSpacing: 4, boxSizing: 'border-box' as const, outline: 'none' },
  btn: { width: '100%', padding: '14px', fontSize: 16, fontWeight: 600, border: 'none', borderRadius: 10, cursor: 'pointer', transition: 'all 0.2s' },
  label: { fontSize: 13, color: '#94a3b8', marginBottom: 8, display: 'block' },
  value: { fontSize: 16, color: '#f8fafc', fontWeight: 500 },
  row: { display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #334155' },
  badge: (isPrimary: boolean) => ({
    background: isPrimary ? '#1e40af' : '#334155', color: '#fff', padding: '4px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
  }),
  queueNumber: { fontSize: 48, fontWeight: 800, textAlign: 'center' as const, color: '#3b82f6', fontFamily: 'monospace', margin: '20px 0' },
}

// ===== Component =====
export default function KioskCheckIn() {
  const [step, setStep] = useState<KioskState['step']>('idle')
  const [idInput, setIdInput] = useState('')
  const [selectedPatient, setSelectedPatient] = useState<typeof MOCK_PATIENTS[0] | null>(null)
  const [result, setResult] = useState<KioskCheckInResult | null>(null)
  const [loading, setLoading] = useState(false)

  const handleIdSubmit = () => {
    const patient = MOCK_PATIENTS.find(p => p.idCard.endsWith(idInput))
    if (patient) {
      setSelectedPatient(patient)
      setStep('confirm')
    } else {
      message.warning('未找到匹配的患者，请确认身份证后4位')
    }
  }

  const handleConfirm = async () => {
    if (!selectedPatient) return
    setLoading(true)
    const svc = getQueueService()
    const res = await svc.checkIn({
      patientId: selectedPatient.id,
      examItemId: selectedPatient.exams[0].name,
      idCardLast4: idInput,
      checkInTime: new Date().toISOString(),
    })
    setResult(res)
    setStep('result')
    setLoading(false)
  }

  const handleReset = () => {
    setStep('idle')
    setIdInput('')
    setSelectedPatient(null)
    setResult(null)
  }

  return (
    <div style={s.container}>
      <div style={s.card}>
        {step === 'idle' && (
          <>
            <div style={s.title}>🏥 自助报到</div>
            <div style={s.subtitle}>请输入身份证号后4位进行报到</div>
            <div style={{ background: '#0f172a', borderRadius: 10, padding: 12, marginBottom: 20, border: '1px solid #334155' }}>
              <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>📋 今日就诊流程</div>
              <div style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.7 }}>
                1️⃣ 输入身份证后4位 &nbsp;→&nbsp; 2️⃣ 核对患者信息 &nbsp;→&nbsp; 3️⃣ 获取排队号码 &nbsp;→&nbsp; 4️⃣ 前往等候区
              </div>
            </div>
            <input style={s.input} placeholder="后4位" maxLength={4} value={idInput}
              onChange={e => /^\d{0,4}$/.test(e.target.value) && setIdInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && idInput.length === 4 && handleIdSubmit()} />
            <button style={{ ...s.btn, background: '#3b82f6', color: '#fff', marginTop: 24, opacity: idInput.length === 4 ? 1 : 0.5 }}
              disabled={idInput.length !== 4} onClick={handleIdSubmit}>确认报到</button>
            <div style={{ marginTop: 16, fontSize: 12, color: '#64748b', textAlign: 'center' }}>
              💡 如需帮助，请联系导诊台工作人员
            </div>
          </>
        )}

        {step === 'confirm' && selectedPatient && (
          <>
            <div style={s.title}>确认信息</div>
            <div style={s.subtitle}>请核对您的个人信息</div>
            <div style={{ margin: '24px 0' }}>
              <div style={s.row}><span style={s.label}>姓名</span><span style={s.value}>{selectedPatient.name}</span></div>
              <div style={s.row}><span style={s.label}>身份证</span><span style={s.value}>****{idInput}</span></div>
              <div style={s.row}><span style={s.label}>检查项目</span><span style={s.value}>{selectedPatient.exams[0].name}</span></div>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button style={{ ...s.btn, flex: 1, background: '#334155', color: '#94a3b8' }} onClick={handleReset}>返回</button>
              <button style={{ ...s.btn, flex: 2, background: '#3b82f6', color: '#fff', opacity: loading ? 0.7 : 1 }}
                disabled={loading} onClick={handleConfirm}>{loading ? '处理中...' : '确认报到'}</button>
            </div>
          </>
        )}

        {step === 'result' && result && (
          <>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 60, marginBottom: 8 }}>✅</div>
              <div style={s.title}>报到成功</div>
            </div>
            <div style={s.queueNumber}>{result.queueNumber}</div>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ color: '#94a3b8', fontSize: 13 }}>预计等待时间</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#f8fafc' }}>{result.estimatedWaitMinutes} 分钟</div>
            </div>
            <div style={{ textAlign: 'center', padding: 12, background: '#0f172a', borderRadius: 8, marginBottom: 20 }}>
              <span style={{ color: '#94a3b8', fontSize: 13 }}>请前往 </span>
              <span style={{ color: '#3b82f6', fontWeight: 700 }}>{result.roomName}</span>
              <span style={{ color: '#94a3b8', fontSize: 13 }}> 等候叫号</span>
            </div>
            <button style={{ ...s.btn, background: '#3b82f6', color: '#fff' }} onClick={handleReset}>完成</button>
          </>
        )}
      </div>
    </div>
  )
}
