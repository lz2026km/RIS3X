import { useState, useEffect } from 'react'
import type { CSSProperties } from 'react'
import { Syringe, Play, Monitor, Settings, List, ShieldCheck, ShieldAlert, FlaskConical, Clock, Plus, CheckCircle2, XCircle } from 'lucide-react'
import { message } from 'antd'
import { getInjectionWorkstationService } from '../../services/contrast'
import type { InjectionProtocol, InjectionRecord, InjectorDeviceStatus } from '../../services/contrast'
// [v3.0.6.11-104 Wave 3B] 对比剂安全闭环: 注射指令经 POST /contrast/injection (前置核查门禁), 失败回退本地演示
import { contrastSafetyApi } from '../../services/api/contrastSafetyApi'
import type {
  PreInjectionCheckResult,
  ContrastObservation,
  ContrastAllergyTestRecord,
  ContrastAllergyResult,
} from '../../services/api/contrastSafetyApi'
import { t } from '../../i18n/appI18n'
import { uniqueId } from '../../utils/uniqueId'
// [v3.0.6.11-105 Wave 2C] 国标指标联动: RQI-ICME-05 对比剂外渗发生率
import { RqiIndicatorLink } from '../../components/qc/RqiIndicatorLink'
// [v3.0.6.11-104 Wave 3D] 临床资料接入: eGFR 30-59 警告 + 注射前安全核查 + 介入操作核查 (独立子组件, 避开 Wave 3B 区块)
import ContrastDataSections from './ContrastDataSections'

const svc = getInjectionWorkstationService()

const PATIENT_ID = 'P-DEMO'
const DEFAULT_EGFR_THRESHOLD = 30
const BLOCKER_CODES = ['NO_CONSENT', 'ALLERGY_POSITIVE', 'EGFR_BELOW_THRESHOLD', 'PREGNANCY']

const panelStyle: CSSProperties = { background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 16 }
const inputStyle: CSSProperties = { width: '100%', padding: '6px 10px', borderRadius: 4, border: '1px solid #30363d', background: '#0d1117', color: '#f0f6fc', fontSize: 13, outline: 'none', marginTop: 4, boxSizing: 'border-box' }

export default function ContrastInjectionWorkstationPage() {
  const [protocols, setProtocols] = useState<InjectionProtocol[]>([])
  const [records, setRecords] = useState<InjectionRecord[]>([])
  const [device, setDevice] = useState<InjectorDeviceStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedProtocol, setSelectedProtocol] = useState<string>('')
  const [weight, setWeight] = useState(70)
  const [egfr, setEgfr] = useState(90)
  const [calculatedParams, setCalculatedParams] = useState<{ volumeMl: number; flowRateMls: number; rationale: string } | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [injecting, setInjecting] = useState(false)

  // [Wave 3B] 注射前核查
  const [consentSigned, setConsentSigned] = useState(false)
  const [pregnant, setPregnant] = useState(false)
  const [preCheck, setPreCheck] = useState<PreInjectionCheckResult | null>(null)
  const [checking, setChecking] = useState(false)

  // [Wave 3B] 过敏试验
  const [allergyHistory, setAllergyHistory] = useState<ContrastAllergyTestRecord[]>([])
  const [showAllergyForm, setShowAllergyForm] = useState(false)
  const [allergySubmitting, setAllergySubmitting] = useState(false)
  const [allergyForm, setAllergyForm] = useState<{ contrastType: string; result: ContrastAllergyResult; testedBy: string; notes: string }>({
    contrastType: '',
    result: 'negative',
    testedBy: 'current-user',
    notes: '',
  })

  // [Wave 3B] 注射后留观
  const [injectionDone, setInjectionDone] = useState(false)
  const [observation, setObservation] = useState<ContrastObservation | null>(null)
  const [nowTick, setNowTick] = useState(Date.now())
  const [startingObs, setStartingObs] = useState(false)
  const [doctorRelease, setDoctorRelease] = useState(false)
  const [recordForm, setRecordForm] = useState({ symptoms: '', action: '' })

  const selectedProto = protocols.find(p => p.id === selectedProtocol)
  const allergyResult: ContrastAllergyResult = allergyHistory[0]?.result ?? 'unknown'
  const canInject = preCheck?.passed === true

  const blockerLabel = (code: string): string =>
    BLOCKER_CODES.includes(code) ? t(`contrastSafety.blocker.${code}`) : code

  const buildLocalCheck = (): PreInjectionCheckResult => {
    const blockers: string[] = []
    if (!consentSigned) blockers.push('NO_CONSENT')
    if (allergyResult === 'positive') blockers.push('ALLERGY_POSITIVE')
    if (egfr < DEFAULT_EGFR_THRESHOLD) blockers.push('EGFR_BELOW_THRESHOLD')
    if (pregnant) blockers.push('PREGNANCY')
    return {
      passed: blockers.length === 0,
      blockers,
      checks: [
        { key: 'consent', passed: consentSigned, detail: consentSigned ? t('contrastSafety.consentSigned') : t('contrastSafety.blocker.NO_CONSENT') },
        { key: 'allergy', passed: allergyResult !== 'positive', detail: t(`contrastSafety.result.${allergyResult}`) },
        { key: 'egfr', passed: egfr >= DEFAULT_EGFR_THRESHOLD, detail: `eGFR ${egfr} mL/min/1.73m² (≥${DEFAULT_EGFR_THRESHOLD})` },
        { key: 'pregnancy', passed: !pregnant, detail: pregnant ? t('contrastSafety.pregnant') : '—' },
      ],
      threshold: DEFAULT_EGFR_THRESHOLD,
      allergyResult,
      evaluatedAt: new Date().toISOString(),
    }
  }

  useEffect(() => {
    const run = async () => {
      const [p, r, d] = await Promise.all([svc.getProtocols(), svc.getInjectionHistory(), svc.getDeviceStatus()])
      setProtocols(p)
      setRecords(r)
      setDevice(d)
      setLoading(false)
    }
    void run()
  }, [])

  useEffect(() => {
    contrastSafetyApi
      .listAllergyTests(PATIENT_ID)
      .then(res => { if (res.success && Array.isArray(res.data?.items)) setAllergyHistory(res.data.items) })
      .catch(() => { /* 后端不可用: 保留空历史 */ })
  }, [])

  useEffect(() => {
    if (!observation || observation.status === 'discharged') return
    const timer = window.setInterval(() => setNowTick(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [observation])

  const liveRemaining = observation && observation.status !== 'discharged'
    ? Math.max(0, Math.ceil((new Date(observation.endsAt).getTime() - nowTick) / 1000))
    : 0
  const liveCanDischarge = observation ? observation.status === 'discharged' || liveRemaining === 0 : false
  const fmtClock = (sec: number) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`

  const handlePreCheck = async () => {
    setChecking(true)
    try {
      const res = await contrastSafetyApi.preInjectionCheck({
        patientId: PATIENT_ID,
        contrastType: selectedProto?.contrastName,
        consentSigned,
        egfr,
        pregnant,
      })
      setPreCheck(res.success && res.data ? res.data : buildLocalCheck())
    } catch {
      setPreCheck(buildLocalCheck())
    } finally {
      setChecking(false)
    }
  }

  const handleRecordAllergy = async () => {
    const contrastType = allergyForm.contrastType || selectedProto?.contrastName || t('contrastWs.defaultContrast')
    const payload = {
      patientId: PATIENT_ID,
      contrastType,
      result: allergyForm.result,
      testedBy: allergyForm.testedBy || 'current-user',
      notes: allergyForm.notes || undefined,
    }
    setAllergySubmitting(true)
    try {
      const res = await contrastSafetyApi.recordAllergyTest(payload)
      if (res.success && res.data) {
        setAllergyHistory(prev => [res.data, ...prev])
      } else {
        throw new Error(res.error?.message ?? 'record failed')
      }
    } catch {
      setAllergyHistory(prev => [
        { id: `local-${Date.now()}`, ...payload, testedAt: new Date().toISOString(), createdAt: new Date().toISOString() },
        ...prev,
      ])
      message.warning(t('contrastSafety.allergyRecorded') + ' (本地演示)')
    }
    setAllergySubmitting(false)
    setShowAllergyForm(false)
    setPreCheck(null)
    message.success(t('contrastSafety.allergyRecorded'))
  }

  // [Wave 3B] 开始注射: 前置核查 → POST /contrast/injection; 失败回退本地演示
  const handleStartInjection = async () => {
    const proto = selectedProto
    if (!proto) return
    const check = preCheck ?? buildLocalCheck()
    if (!check.passed) {
      setPreCheck(check)
      message.error(`${t('contrastSafety.injectionBlocked')}: ${check.blockers.map(blockerLabel).join('、')}`)
      return
    }
    setInjecting(true)
    try {
      const res = await contrastSafetyApi.inject({
        examId: uniqueId('E'),
        patientId: PATIENT_ID,
        patientName: t('contrastWs.demoPatient'),
        protocolId: proto.id,
        protocolName: proto.name,
        contrastType: proto.contrastName,
        totalVolumeMl: proto.totalVolumeMl,
        flowRateMls: proto.phases[0]?.flowRateMls ?? 3,
        operator: 'current-user',
        weightKg: weight,
        eGFR: egfr,
        consentSigned,
        pregnant,
        adjustedVolumeMl: calculatedParams?.volumeMl ?? proto.totalVolumeMl,
      })
      if (res.success && res.data) {
        setPreCheck(res.data.preCheck)
        setInjectionDone(true)
        message.success(t('contrastSafety.injectSent'))
        return
      }
      message.error(res.error?.message ?? t('contrastSafety.injectionBlocked'))
    } catch (e) {
      // 后端不可达: 基于本地核查回退演示 (本地核查已通过)
      try {
        await svc.startInjection(uniqueId('E'), proto.id, { weightKg: weight, eGFR: egfr, adjustedVolumeMl: calculatedParams?.volumeMl ?? proto.totalVolumeMl })
        setRecords(await svc.getInjectionHistory())
        setInjectionDone(true)
        message.warning(`后端不可用, 已回退本地演示: ${e instanceof Error ? e.message : '未知错误'}`)
      } catch {
        message.error(t('contrastWs.injectionFailed'))
      }
    } finally {
      setInjecting(false)
    }
  }

  const handleCalculate = async () => {
    const proto = selectedProto
    if (!proto) return
    const params = await svc.calculateParameters(proto.contrastName, weight, egfr)
    setCalculatedParams(params)
  }

  const handleStartObservation = async () => {
    setStartingObs(true)
    const payload = {
      patientId: PATIENT_ID,
      examId: uniqueId('E'),
      contrastType: selectedProto?.contrastName,
      operator: 'current-user',
    }
    try {
      const res = await contrastSafetyApi.startObservation(payload)
      if (res.success && res.data) {
        setObservation(res.data)
        message.success(t('contrastSafety.observationStarted'))
        return
      }
      throw new Error(res.error?.message ?? 'start failed')
    } catch {
      const startedAt = new Date()
      const endsAt = new Date(startedAt.getTime() + 30 * 60_000)
      setObservation({
        id: `obs-local-${Date.now()}`,
        ...payload,
        startedAt: startedAt.toISOString(),
        durationMinutes: 30,
        endsAt: endsAt.toISOString(),
        status: 'observing',
        records: [],
        doctorRelease: false,
        elapsedSeconds: 0,
        elapsedMinutes: 0,
        remainingSeconds: 1800,
        progressPercent: 0,
        canDischarge: false,
        createdAt: startedAt.toISOString(),
        updatedAt: startedAt.toISOString(),
      })
      message.warning(t('contrastSafety.observationStarted') + ' (本地演示)')
    } finally {
      setStartingObs(false)
    }
  }

  const handleAddObservationRecord = async () => {
    if (!observation || !recordForm.symptoms.trim()) return
    const payload = { symptoms: recordForm.symptoms.trim(), action: recordForm.action.trim(), recordedBy: 'current-user' }
    try {
      const res = await contrastSafetyApi.addObservationRecord(observation.id, payload)
      if (res.success && res.data) {
        setObservation(res.data)
      } else {
        throw new Error(res.error?.message ?? 'record failed')
      }
    } catch {
      setObservation({
        ...observation,
        records: [...observation.records, { at: new Date().toISOString(), symptoms: payload.symptoms, action: payload.action, recordedBy: 'current-user' }],
      })
    }
    setRecordForm({ symptoms: '', action: '' })
  }

  const handleDischarge = async () => {
    if (!observation) return
    try {
      const res = await contrastSafetyApi.dischargeObservation(observation.id, { doctorRelease, dischargedBy: 'current-user' })
      if (res.success && res.data) {
        setObservation(res.data)
        message.success(t('contrastSafety.observationDischarged'))
        return
      }
      throw new Error(res.error?.message ?? 'discharge failed')
    } catch {
      if (observation.status !== 'discharged' && liveRemaining > 0 && !doctorRelease) {
        message.error(t('contrastSafety.durationNotMet'))
        return
      }
      setObservation({ ...observation, status: 'discharged', doctorRelease, dischargedAt: new Date().toISOString(), remainingSeconds: 0, canDischarge: true })
      message.success(t('contrastSafety.observationDischarged'))
    }
  }

  if (loading) {
    return <div style={{ minHeight: '100vh', background: '#0d1117', color: '#f0f6fc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>{t('contrastWs.loading')}</div>
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', color: '#f0f6fc', fontSize: 14, fontFamily: '"Segoe UI",sans-serif' }}>
      <div style={{ background: 'linear-gradient(135deg,#0891b2,#164e63)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Syringe size={24} /><span style={{ fontSize: 20, fontWeight: 600 }}>{t('contrastWs.title')}</span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {device && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '6px 12px', borderRadius: 6, background: device.status === 'online' ? '#22c55e20' : device.status === 'offline' ? '#ef444420' : '#f59e0b20', color: device.status === 'online' ? '#22c55e' : device.status === 'offline' ? '#ef4444' : '#f59e0b' }}>
              <Monitor size={14} />{device.deviceName}: {device.status === 'online' ? t('contrastWs.device.online') : device.status === 'offline' ? t('contrastWs.device.offline') : device.status === 'busy' ? t('contrastWs.device.busy') : t('contrastWs.device.error')}
            </span>
          )}
          <button onClick={() => setShowHistory(!showHistory)} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.3)', background: showHistory ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.15)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <List size={14} />{t('contrastWs.injectionHistory')}
          </button>
        </div>
      </div>

      {/* [v3.0.6.11-105 Wave 2C] 国标指标联动: RQI-ICME-05 对比剂外渗发生率 (深色主题) */}
      <div style={{ padding: '16px 24px 0' }}>
        <RqiIndicatorLink code="RQI-ICME-05" tone="dark" />
      </div>

      <div style={{ padding: '20px 24px', display: 'grid', gridTemplateColumns: showHistory ? '1fr 1fr' : '1fr', gap: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={panelStyle}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>{t('contrastWs.selectProtocol')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <select value={selectedProtocol} onChange={e => { setSelectedProtocol(e.target.value); setCalculatedParams(null) }} style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #30363d', background: '#0d1117', color: '#f0f6fc', fontSize: 13, outline: 'none' }}>
                <option value="">{t('contrastWs.selectProtocolPlaceholder')}</option>
                {protocols.map(p => <option key={p.id} value={p.id}>{p.name} ({p.contrastName})</option>)}
              </select>

              {selectedProtocol && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>
                  <div>
                    <label style={{ fontSize: 12, color: '#8b949e' }}>{t('contrastWs.weight')}</label>
                    <input type="number" value={weight} onChange={e => setWeight(Number(e.target.value))} style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: '#8b949e' }}>eGFR (mL/min)</label>
                    <input type="number" value={egfr} onChange={e => { setEgfr(Number(e.target.value)); setPreCheck(null) }} style={inputStyle} />
                  </div>
                </div>
              )}

              <button onClick={handleCalculate} disabled={!selectedProtocol} style={{ padding: '8px 16px', borderRadius: 6, border: 'none', cursor: selectedProtocol ? 'pointer' : 'not-allowed', background: selectedProtocol ? '#0891b2' : '#21262d', color: selectedProtocol ? '#fff' : '#484f58', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Settings size={14} />{t('contrastWs.calculateParams')}
              </button>

              {calculatedParams && (
                <div style={{ marginTop: 8, padding: 12, background: '#0d1117', borderRadius: 6 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#22c55e', marginBottom: 8 }}>{t('contrastWs.calcResult')}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                    <div><span style={{ color: '#8b949e', fontSize: 12 }}>{t('contrastWs.volume')}</span><div style={{ fontSize: 16, fontWeight: 600 }}>{calculatedParams.volumeMl} mL</div></div>
                    <div><span style={{ color: '#8b949e', fontSize: 12 }}>{t('contrastWs.flowRate')}</span><div style={{ fontSize: 16, fontWeight: 600 }}>{calculatedParams.flowRateMls} mL/s</div></div>
                  </div>
                  <div style={{ marginTop: 4, fontSize: 12, color: '#6e7681' }}>{calculatedParams.rationale}</div>
                </div>
              )}
            </div>
          </div>

          {/* [Wave 3B] 注射前核查面板 */}
          <div style={{ ...panelStyle, borderColor: preCheck ? (preCheck.passed ? '#22c55e' : '#ef4444') : '#30363d' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                {preCheck?.passed ? <ShieldCheck size={16} color="#22c55e" /> : <ShieldAlert size={16} color={preCheck ? '#ef4444' : '#8b949e'} />}
                {t('contrastSafety.preCheck')}
              </div>
              <button onClick={() => void handlePreCheck()} disabled={checking} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #0891b2', background: '#0891b220', color: '#22d3ee', cursor: checking ? 'wait' : 'pointer', fontSize: 12 }}>
                {checking ? t('contrastSafety.checking') : t('contrastSafety.check')}
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                <input type="checkbox" checked={consentSigned} onChange={e => { setConsentSigned(e.target.checked); setPreCheck(null) }} />
                {t('contrastSafety.consentSigned')}
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                <input type="checkbox" checked={pregnant} onChange={e => { setPregnant(e.target.checked); setPreCheck(null) }} />
                {t('contrastSafety.pregnant')}
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {([
                { key: 'consent', label: t('contrastSafety.consent') },
                { key: 'allergy', label: t('contrastSafety.allergy') },
                { key: 'egfr', label: t('contrastSafety.egfr') },
                { key: 'pregnancy', label: t('contrastSafety.pregnancy') },
              ] as const).map(item => {
                const check = preCheck?.checks.find(c => c.key === item.key)
                const localPassed =
                  item.key === 'consent' ? consentSigned :
                  item.key === 'allergy' ? allergyResult !== 'positive' :
                  item.key === 'egfr' ? egfr >= DEFAULT_EGFR_THRESHOLD : !pregnant
                const passed = check ? check.passed : localPassed
                return (
                  <div key={item.key} style={{ padding: '8px 10px', background: '#0d1117', borderRadius: 6, border: `1px solid ${passed ? '#22c55e40' : '#ef444440'}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#8b949e' }}>
                      {passed ? <CheckCircle2 size={13} color="#22c55e" /> : <XCircle size={13} color="#ef4444" />}
                      {item.label}
                    </div>
                    <div style={{ fontSize: 11, color: passed ? '#22c55e' : '#ef4444', marginTop: 4 }}>{check?.detail ?? '—'}</div>
                  </div>
                )
              })}
            </div>

            {preCheck && !preCheck.passed && (
              <div style={{ marginTop: 12, padding: '10px 12px', background: '#ef444415', border: '1px solid #ef444440', borderRadius: 6, fontSize: 12, color: '#f87171' }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{t('contrastSafety.blocked')}</div>
                <div>{preCheck.blockers.map(blockerLabel).join('、')}</div>
              </div>
            )}
            {preCheck?.passed && (
              <div style={{ marginTop: 12, padding: '10px 12px', background: '#22c55e15', border: '1px solid #22c55e40', borderRadius: 6, fontSize: 12, color: '#22c55e', fontWeight: 600 }}>
                {t('contrastSafety.passed')}
              </div>
            )}
          </div>

          {/* [Wave 3B] 过敏试验记录 */}
          <div style={panelStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                <FlaskConical size={16} />{t('contrastSafety.allergyRecord')}
              </div>
              <button onClick={() => setShowAllergyForm(!showAllergyForm)} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #30363d', background: showAllergyForm ? '#21262d' : 'transparent', color: '#f0f6fc', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Plus size={13} />{t('contrastSafety.recordAllergy')}
              </button>
            </div>

            {showAllergyForm && (
              <div style={{ padding: 12, background: '#0d1117', borderRadius: 6, marginBottom: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, color: '#8b949e' }}>{t('contrastWs.contrastAgent')}</label>
                  <input value={allergyForm.contrastType} onChange={e => setAllergyForm({ ...allergyForm, contrastType: e.target.value })} placeholder={selectedProto?.contrastName ?? t('contrastWs.defaultContrast')} style={inputStyle} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: '#8b949e' }}>{t('contrastWs.result')}</label>
                  <select value={allergyForm.result} onChange={e => setAllergyForm({ ...allergyForm, result: e.target.value as ContrastAllergyResult })} style={inputStyle}>
                    <option value="negative">{t('contrastSafety.result.negative')}</option>
                    <option value="positive">{t('contrastSafety.result.positive')}</option>
                    <option value="unknown">{t('contrastSafety.result.unknown')}</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, color: '#8b949e' }}>{t('contrastSafety.testedBy')}</label>
                  <input value={allergyForm.testedBy} onChange={e => setAllergyForm({ ...allergyForm, testedBy: e.target.value })} style={inputStyle} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: '#8b949e' }}>{t('contrastSafety.notes')}</label>
                  <input value={allergyForm.notes} onChange={e => setAllergyForm({ ...allergyForm, notes: e.target.value })} style={inputStyle} />
                </div>
                <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8 }}>
                  <button onClick={() => void handleRecordAllergy()} disabled={allergySubmitting} style={{ padding: '7px 16px', borderRadius: 6, border: 'none', background: '#0891b2', color: '#fff', cursor: allergySubmitting ? 'wait' : 'pointer', fontSize: 12 }}>{t('contrastSafety.submit')}</button>
                  <button onClick={() => setShowAllergyForm(false)} style={{ padding: '7px 16px', borderRadius: 6, border: '1px solid #30363d', background: 'transparent', color: '#8b949e', cursor: 'pointer', fontSize: 12 }}>{t('contrastSafety.cancel')}</button>
                </div>
              </div>
            )}

            <div style={{ fontSize: 12, color: '#8b949e', marginBottom: 6 }}>{t('contrastSafety.history')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 160, overflowY: 'auto' }}>
              {allergyHistory.map(item => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: '#0d1117', borderRadius: 4, fontSize: 12 }}>
                  <span>{item.contrastType} · {item.testedBy}</span>
                  <span style={{ color: item.result === 'positive' ? '#ef4444' : item.result === 'negative' ? '#22c55e' : '#f59e0b' }}>{t(`contrastSafety.result.${item.result}`)}</span>
                  <span style={{ color: '#6e7681' }}>{new Date(item.testedAt).toLocaleString('zh-CN')}</span>
                </div>
              ))}
              {allergyHistory.length === 0 && <div style={{ color: '#6e7681', fontSize: 12 }}>{t('contrastSafety.noHistory')}</div>}
            </div>
          </div>

          {/* [Wave 3B] 注射后留观 */}
          <div style={panelStyle}>
            <div style={{ fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Clock size={16} />{t('contrastSafety.observation')}
            </div>
            {!observation ? (
              <button onClick={() => void handleStartObservation()} disabled={!injectionDone || startingObs} style={{ padding: '8px 16px', borderRadius: 6, border: 'none', cursor: injectionDone ? 'pointer' : 'not-allowed', background: injectionDone ? '#0891b2' : '#21262d', color: injectionDone ? '#fff' : '#484f58', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Clock size={14} />{startingObs ? '...' : t('contrastSafety.startObservation')}
              </button>
            ) : (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 24, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: observation.status === 'discharged' ? '#22c55e' : liveRemaining === 0 ? '#f59e0b' : '#22d3ee' }}>
                      {observation.status === 'discharged' ? t('contrastSafety.discharged') : fmtClock(liveRemaining)}
                    </span>
                    <span style={{ fontSize: 12, color: '#8b949e' }}>{t('contrastSafety.remaining')}</span>
                  </div>
                  <span style={{ fontSize: 12, color: '#6e7681' }}>{observation.id}</span>
                </div>
                <div style={{ height: 6, background: '#0d1117', borderRadius: 3, overflow: 'hidden', marginBottom: 12 }}>
                  <div style={{ height: '100%', width: `${observation.status === 'discharged' ? 100 : Math.min(100, ((observation.durationMinutes * 60 - liveRemaining) / (observation.durationMinutes * 60)) * 100)}%`, background: liveCanDischarge ? '#22c55e' : '#0891b2', transition: 'width 0.5s linear' }} />
                </div>

                <div style={{ fontSize: 12, color: '#8b949e', marginBottom: 6 }}>{t('contrastSafety.records')}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                  {observation.records.map((rec, idx) => (
                    <div key={idx} style={{ padding: '6px 10px', background: '#0d1117', borderRadius: 4, fontSize: 12 }}>
                      <span style={{ color: '#6e7681' }}>{new Date(rec.at).toLocaleTimeString('zh-CN')}</span>
                      <span style={{ marginLeft: 8 }}>{rec.symptoms}</span>
                      {rec.action && <span style={{ marginLeft: 8, color: '#8b949e' }}>[{rec.action}]</span>}
                    </div>
                  ))}
                  {observation.records.length === 0 && <div style={{ color: '#6e7681', fontSize: 12 }}>{t('contrastSafety.noRecords')}</div>}
                </div>

                {observation.status !== 'discharged' && (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <input value={recordForm.symptoms} onChange={e => setRecordForm({ ...recordForm, symptoms: e.target.value })} placeholder={t('contrastSafety.symptoms')} style={inputStyle} />
                      <input value={recordForm.action} onChange={e => setRecordForm({ ...recordForm, action: e.target.value })} placeholder={t('contrastSafety.action')} style={inputStyle} />
                    </div>
                    <button onClick={() => void handleAddObservationRecord()} disabled={!recordForm.symptoms.trim()} style={{ marginTop: 8, padding: '7px 14px', borderRadius: 6, border: '1px solid #30363d', background: 'transparent', color: recordForm.symptoms.trim() ? '#f0f6fc' : '#484f58', cursor: recordForm.symptoms.trim() ? 'pointer' : 'not-allowed', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Plus size={13} />{t('contrastSafety.addRecord')}
                    </button>

                    <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                        <input type="checkbox" checked={doctorRelease} onChange={e => setDoctorRelease(e.target.checked)} />
                        {t('contrastSafety.doctorRelease')}
                      </label>
                      <button onClick={() => void handleDischarge()} disabled={!liveCanDischarge && !doctorRelease} style={{ padding: '8px 18px', borderRadius: 6, border: 'none', cursor: (liveCanDischarge || doctorRelease) ? 'pointer' : 'not-allowed', background: (liveCanDischarge || doctorRelease) ? '#22c55e' : '#21262d', color: (liveCanDischarge || doctorRelease) ? '#fff' : '#484f58', fontSize: 13, fontWeight: 600 }}>
                        {t('contrastSafety.discharge')}
                      </button>
                    </div>
                    {!liveCanDischarge && (
                      <div style={{ marginTop: 8, fontSize: 12, color: '#f59e0b' }}>{t('contrastSafety.durationNotMet')}</div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          <div style={panelStyle}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>{t('contrastWs.protocolDetail')}</div>
            {selectedProto ? (
              <div>
                <div style={{ display: 'flex', gap: 16, marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: '#8b949e' }}>{t('contrastWs.totalVolume')} <span style={{ color: '#f0f6fc' }}>{selectedProto.totalVolumeMl}mL</span></span>
                  <span style={{ fontSize: 12, color: '#8b949e' }}>{t('contrastWs.concentration')} <span style={{ color: '#f0f6fc' }}>{selectedProto.concentration}</span></span>
                </div>
                <div style={{ fontSize: 12, color: '#8b949e', marginBottom: 8 }}>{t('contrastWs.phases')}</div>
                {selectedProto.phases.map((phase, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: '#0d1117', borderRadius: 4, marginBottom: 4, fontSize: 12 }}>
                    <span>{phase.phase === 'bolus' ? t('contrastWs.phase.bolus') : phase.phase === 'chaser' ? t('contrastWs.phase.chaser') : phase.phase === 'delay' ? t('contrastWs.phase.delay') : t('contrastWs.phase.fractional')}</span>
                    <span>{phase.volumeMl > 0 ? `${phase.volumeMl}mL @ ${phase.flowRateMls}mL/s` : `延迟 ${phase.delaySec}s`}</span>
                    <span style={{ color: '#6e7681' }}>{phase.description}</span>
                  </div>
                ))}
                {calculatedParams && (
                  <button onClick={() => void handleStartInjection()} disabled={injecting || !canInject} title={canInject ? '' : t('contrastSafety.injectionBlocked')} style={{ marginTop: 12, width: '100%', padding: '10px', borderRadius: 6, border: 'none', cursor: injecting ? 'wait' : canInject ? 'pointer' : 'not-allowed', background: canInject ? '#22c55e' : '#21262d', color: canInject ? '#fff' : '#484f58', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <Play size={16} />{injecting ? t('contrastWs.commandSending') : canInject ? t('contrastWs.startInjection') : t('contrastSafety.blocked')}
                  </button>
                )}
              </div>
            ) : <div style={{ color: '#6e7681', fontSize: 13 }}>{t('contrastWs.selectFirst')}</div>}
          </div>

          {/* [v3.0.6.11-104 Wave 3D] 临床资料接入区块: eGFR 警告 + 安全核查清单 + 介入核查清单 */}
          <ContrastDataSections egfr={egfr} />
        </div>

        {showHistory && (
          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 16, maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>{t('contrastWs.injectionHistory')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {records.map(r => (
                <div key={r.id} style={{ padding: '10px 12px', background: '#0d1117', borderRadius: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 13 }}>{r.patientName}</span>
                     <span style={{ fontSize: 12, padding: '1px 6px', borderRadius: 3, background: r.status === 'completed' ? '#22c55e20' : r.status === 'in_progress' ? '#3b82f620' : '#ef444420', color: r.status === 'completed' ? '#22c55e' : r.status === 'in_progress' ? '#3b82f6' : '#ef4444' }}>
                      {r.status === 'completed' ? t('contrastWs.recStatus.completed') : r.status === 'in_progress' ? t('contrastWs.recStatus.inProgress') : r.status === 'cancelled' ? t('contrastWs.recStatus.cancelled') : t('contrastWs.recStatus.aborted')}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: '#8b949e' }}>{r.protocolName} | {r.totalVolumeMl}mL | {new Date(r.startTime).toLocaleString('zh-CN')}</div>
                </div>
              ))}
              {records.length === 0 && <div style={{ color: '#6e7681', fontSize: 13 }}>{t('contrastWs.noRecords')}</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
