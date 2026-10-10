import { useEffect, useState } from 'react'
import { Checkbox } from 'antd'
import { Plus, X, Monitor, User, Scan, ShieldCheck, CreditCard, ClipboardCheck, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { initialModalityDevices, initialExamItems, initialUsers } from '../data/initialData'
import { FormField } from '../components/common/FormField'
import { t } from '../i18n/appI18n'
import WorkflowTemplatePanel from '../components/common/WorkflowTemplatePanel'
// [W5] 预约向导: 资源/冲突引擎接入
import { appointmentApi, type RoomDto, type TechnicianDto, type AppointmentConflictDto } from '../services/api'

const primaryBlue = 'var(--color-primary-800)'
const textGray = '#64748b'
const borderGray = '#cbd5e1'
const whiteBg = 'var(--bg-card)'

interface AppointmentFormProps {
  showForm: boolean
  setShowForm: (v: boolean) => void
  formData: any
  setFormData: (v: any) => void
  validationError: string
  formErrors: Record<string, string>
  setFormErrors: (v: Record<string, string>) => void
  setValidationError: (v: string) => void
  handleSubmit: () => void
  submitting?: boolean
  timeSlots: string[]
}

const STEP_KEYS = ['w5Appt.step1', 'w5Appt.step2', 'w5Appt.step3', 'w5Appt.step4', 'w5Appt.step5'] as const
const STEP_ICONS = [User, Scan, ShieldCheck, CreditCard, ClipboardCheck]

const inputStyle = (border: string): React.CSSProperties => ({
  width: '100%',
  padding: '5px 8px',
  border: `1px solid ${border}`,
  borderRadius: 6,
  fontSize: 12, color: primaryBlue,
  background: whiteBg,
  fontFamily: 'inherit',
})

export default function AppointmentForm(props: AppointmentFormProps) {
  const { showForm, setShowForm, formData, setFormData, validationError, formErrors, setFormErrors, setValidationError, handleSubmit, submitting = false, timeSlots } = props
  const [step, setStep] = useState(0)
  const [rooms, setRooms] = useState<RoomDto[]>([])
  const [technicians, setTechnicians] = useState<TechnicianDto[]>([])
  const [conflicts, setConflicts] = useState<AppointmentConflictDto[]>([])
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    if (!showForm) return
    let cancelled = false
    void (async () => {
      try {
        const [r, tech] = await Promise.all([appointmentApi.getRooms(), appointmentApi.getTechnicians()])
        if (cancelled) return
        if (r.success && Array.isArray(r.data)) setRooms(r.data)
        if (tech.success && Array.isArray(tech.data)) setTechnicians(tech.data)
      } catch { /* demo 回退: 无接口时用设备派生机房 */ }
    })()
    return () => { cancelled = true }
  }, [showForm])

  if (!showForm) return null

  const fieldError = (key: string) => formErrors[key]
  const bc = (key: string) => (formErrors[key] ? 'var(--color-error-600)' : borderGray)
  const set = (patch: Record<string, unknown>) => setFormData({ ...formData, ...patch })

  const close = () => { setShowForm(false); setFormErrors({}); setValidationError(''); setStep(0); setConflicts([]) }

  const stepValid = (s: number): string[] => {
    const errs: string[] = []
    if (s === 0) {
      if (!String(formData.patientName || '').trim()) errs.push(t('w8.appointmentForm.patientName'))
      if (formData.phone && !/^1[3-9]\d{9}$/.test(formData.phone)) errs.push(t('w8.appointmentForm.phone'))
      if (formData.idCard && formData.idCard.length !== 18) errs.push(t('w8.appointmentForm.idCard'))
    }
    if (s === 1) {
      if (!formData.examItemId) errs.push(t('w8.appointmentForm.examItem'))
      if (!formData.deviceId) errs.push(t('w8.appointmentForm.device'))
    }
    return errs
  }

  const next = () => {
    const errs = stepValid(step)
    if (errs.length > 0) { setValidationError(`${t('apptPage.errRequired')}: ${errs.join('、')}`); return }
    setValidationError('')
    setStep((v) => Math.min(v + 1, STEP_KEYS.length - 1))
  }
  const prev = () => { setValidationError(''); setStep((v) => Math.max(v - 1, 0)) }

  const runConflictCheck = async () => {
    setChecking(true)
    try {
      const device = initialModalityDevices.find((d) => d.id === formData.deviceId)
      const startAt = new Date(`${formData.examDate}T${formData.examTime || '08:00'}:00`)
      const endAt = new Date(startAt.getTime() + (Number(formData.durationMin) || 30) * 60000)
      const res = await appointmentApi.checkConflicts({
        patientName: formData.patientName,
        patientId: 'preview',
        modality: formData.examType,
        bodyPart: formData.bodyPart || undefined,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        deviceId: formData.deviceId,
        deviceName: formData.deviceName || device?.name || '',
        roomId: formData.roomId || undefined,
        technicianId: formData.technicianId || undefined,
      } as any)
      if (res.success && res.data) setConflicts(res.data.conflicts || [])
      else setConflicts([])
    } catch {
      setConflicts([])
    } finally {
      setChecking(false)
    }
  }

  const fieldMeta: Array<{ key: string; label: string; placeholder?: string; type?: string }> = [
    { key: 'patientName', label: `${t('w8.appointmentForm.patientName')}*`, placeholder: t('w8.appointmentForm.patientNamePlaceholder') },
    { key: 'age', label: t('w8.appointmentForm.age'), placeholder: t('w8.appointmentForm.agePlaceholder'), type: 'number' },
    { key: 'gender', label: t('w8.appointmentForm.gender'), type: 'select' },
    { key: 'phone', label: t('w8.appointmentForm.phone'), placeholder: t('w8.appointmentForm.phonePlaceholder') },
    { key: 'idCard', label: t('w8.appointmentForm.idCard'), placeholder: t('w8.appointmentForm.idCardPlaceholder') },
  ]

  const StepIcon = STEP_ICONS[step]!

  return (
    <div data-testid="appointment-wizard" style={{ background: whiteBg, borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: `1px solid ${borderGray}`, overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', background: primaryBlue, color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 700 }}><Plus size={15} /> {t('w5Appt.wizardTitle')}</div>
        <button aria-label="关闭" onClick={close} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={16} /></button>
      </div>

      {/* 步骤指示器 */}
      <div style={{ display: 'flex', padding: '10px 12px', gap: 'var(--space-1, 4px)', borderBottom: `1px solid ${borderGray}`, overflowX: 'auto' }}>
        {STEP_KEYS.map((k, i) => (
          <button
            key={k}
            onClick={() => { if (i < step) setStep(i) }}
            style={{
              flex: 1, minWidth: 72, padding: '6px 4px', border: 'none', borderRadius: 6, cursor: i <= step ? 'pointer' : 'default',
              background: i === step ? primaryBlue : i < step ? '#dbeafe' : 'var(--bg-deep)',
              color: i === step ? '#fff' : i < step ? primaryBlue : textGray, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
            }}
          >
            {i + 1}. {t(k)}
          </button>
        ))}
      </div>

      <div style={{ padding: 'var(--space-4, 16px)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3, 12px)' }}>
        {validationError && <div style={{ color: 'var(--color-error-600)', fontSize: 12, padding: '8px 12px', background: 'var(--color-error-bg)', borderRadius: 6, border: '1px solid #fca5a5' }}>{validationError}</div>}

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: textGray }}>
          <StepIcon size={13} /> {t('w5Appt.stepOf', { current: step + 1, total: STEP_KEYS.length })}
        </div>

        {/* ===== Step 1: 患者与身份 ===== */}
        {step === 0 && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: primaryBlue, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)' }}><User size={12} />{t('w8.appointmentForm.patientInfo')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2, 8px)' }}>
              {fieldMeta.map((field) => (
                <FormField key={field.key} label={field.label.replace(/\*$/, '')} required={field.label.endsWith('*')} error={fieldError(field.key)}>
                  {field.type === 'select' ? (
                    <select value={formData[field.key]} onChange={(e) => set({ [field.key]: e.target.value })} style={inputStyle(borderGray)}>
                      {[t('w8.appointmentForm.male'), t('w8.appointmentForm.female')].map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input type={field.type || 'text'} placeholder={field.placeholder} value={formData[field.key] || ''} onChange={(e) => set({ [field.key]: e.target.value })} style={inputStyle(bc(field.key))} />
                  )}
                </FormField>
              ))}
            </div>
            <div style={{ marginTop: 'var(--space-2, 8px)' }}>
              <FormField label={t('w5Appt.clinicalIndication')}>
                <input value={formData.clinicalIndication || ''} onChange={(e) => set({ clinicalIndication: e.target.value })} style={inputStyle(borderGray)} />
              </FormField>
            </div>
          </div>
        )}

        {/* ===== Step 2: 检查与资源 ===== */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: primaryBlue, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)' }}><Scan size={12} />{t('w8.appointmentForm.examInfo')}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2, 8px)' }}>
                <FormField label={t('w8.appointmentForm.examType')} required={false}>
                  <select value={formData.examType} onChange={(e) => set({ examType: e.target.value, examItemId: '', examItemName: '', bodyPart: '', deviceId: '', deviceName: '' })} style={inputStyle(borderGray)}>
                    {['CT', 'MR', 'DR', 'US', 'DX', 'XA'].map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </FormField>
                <FormField label={`${t('w8.appointmentForm.examItem')}*`} required error={fieldError('examItemId')}>
                  <select value={formData.examItemId} onChange={(e) => { const item = initialExamItems.find((i: any) => i.id === e.target.value); set({ examItemId: e.target.value, examItemName: item?.name || '', bodyPart: item?.bodyPart || '', prepInstruction: item?.preparationNotes || formData.prepInstruction || '' }) }} style={inputStyle(bc('examItemId'))}>
                    <option value="">{t('w8.appointmentForm.selectExamItem')}</option>
                    {initialExamItems.filter((i: any) => i.modality === formData.examType).map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </FormField>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: primaryBlue, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)' }}><Monitor size={12} />{t('w8.appointmentForm.timeDevice')}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2, 8px)' }}>
                <FormField label={`${t('w8.appointmentForm.examDate')}*`} required error={fieldError('examDate')}>
                  <input type="date" value={formData.examDate || ''} onChange={(e) => set({ examDate: e.target.value })} style={inputStyle(bc('examDate'))} />
                </FormField>
                <FormField label={`${t('w8.appointmentForm.timeSlot')}*`} required error={fieldError('examTime')}>
                  <select value={formData.examTime} onChange={(e) => set({ examTime: e.target.value })} style={inputStyle(bc('examTime'))}>
                    {timeSlots.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </FormField>
                <FormField label={`${t('w8.appointmentForm.device')}*`} required error={fieldError('deviceId')}>
                  <select value={formData.deviceId} onChange={(e) => { const device = initialModalityDevices.find((d: any) => d.id === e.target.value); set({ deviceId: e.target.value, deviceName: device?.name || '' }) }} style={inputStyle(bc('deviceId'))}>
                    <option value="">{t('w8.appointmentForm.selectDevice')}</option>
                    {initialModalityDevices.filter((d: any) => d.modality === formData.examType && d.status !== '维护中').map((d: any) => <option key={d.id} value={d.id}>{d.name.split('（')[0]}</option>)}
                  </select>
                </FormField>
                <FormField label={t('w5Appt.room')} required={false}>
                  <select value={formData.roomId || ''} onChange={(e) => { const r = rooms.find((x) => x.id === e.target.value); set({ roomId: e.target.value, roomName: r?.name || '' }) }} style={inputStyle(borderGray)}>
                    <option value="">{t('w5Appt.selectRoom')}</option>
                    {rooms.filter((r) => r.modality === formData.examType).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </FormField>
                <FormField label={t('w5Appt.technician')} required={false}>
                  <select value={formData.technicianId || ''} onChange={(e) => { const tech = technicians.find((x) => x.id === e.target.value); set({ technicianId: e.target.value, technicianName: tech?.name || '' }) }} style={inputStyle(borderGray)}>
                    <option value="">{t('w5Appt.selectTechnician')}</option>
                    {technicians.filter((tech) => tech.modality === formData.examType).map((tech) => <option key={tech.id} value={tech.id}>{tech.name} ({tech.shiftStart}-{tech.shiftEnd})</option>)}
                  </select>
                </FormField>
                <FormField label={t('w5Appt.duration')} required={false}>
                  <input type="number" value={formData.durationMin ?? 30} onChange={(e) => set({ durationMin: Number(e.target.value) })} style={inputStyle(borderGray)} />
                </FormField>
                <FormField label={t('w5Appt.buffer')} required={false}>
                  <input type="number" value={formData.bufferMin ?? 0} onChange={(e) => set({ bufferMin: Number(e.target.value) })} style={inputStyle(borderGray)} />
                </FormField>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2, 8px)' }}>
              <div>
                <div style={{ fontSize: 12, color: textGray, marginBottom: 2 }}>{t('w8.appointmentForm.referringDoctor')}</div>
                <select value={formData.referringDoctorId} onChange={(e) => { const u = initialUsers.find((u: any) => u.id === e.target.value); set({ referringDoctorId: e.target.value, referringDoctorName: u?.name || '' }) }} style={inputStyle(borderGray)}>
                  <option value="">{t('w8.appointmentForm.selectDoctor')}</option>
                  {initialUsers.filter((u: any) => u.role === 'doctor').map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 12, color: textGray, marginBottom: 2 }}>{t('w8.appointmentForm.clinicalDiagnosis')}</div>
                <input value={formData.clinicalDiagnosis || ''} onChange={(e) => set({ clinicalDiagnosis: e.target.value })} style={inputStyle(borderGray)} />
              </div>
            </div>
          </div>
        )}

        {/* ===== Step 3: 安全与准备 ===== */}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: primaryBlue, display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)' }}><ShieldCheck size={12} />{t('w5Appt.step3')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2, 8px)' }}>
              <FormField label={t('w5Appt.allergy')}>
                <input placeholder={t('w5Appt.allergyPlaceholder')} value={formData.allergyHistory || ''} onChange={(e) => set({ allergyHistory: e.target.value })} style={inputStyle(borderGray)} />
              </FormField>
              <FormField label={t('w5Appt.renalFunction')}>
                <select value={formData.renalFunction || t('w5Appt.renalNormal')} onChange={(e) => set({ renalFunction: e.target.value })} style={inputStyle(borderGray)}>
                  {[t('w5Appt.renalNormal'), t('w5Appt.renalMild'), t('w5Appt.renalSevere')].map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </FormField>
              <FormField label={t('w5Appt.weight')}>
                <input type="number" value={formData.weightKg ?? ''} onChange={(e) => set({ weightKg: e.target.value === '' ? undefined : Number(e.target.value) })} style={inputStyle(borderGray)} />
              </FormField>
              <FormField label={t('w5Appt.height')}>
                <input type="number" value={formData.heightCm ?? ''} onChange={(e) => set({ heightCm: e.target.value === '' ? undefined : Number(e.target.value) })} style={inputStyle(borderGray)} />
              </FormField>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-4, 16px)', flexWrap: 'wrap', fontSize: 12, color: primaryBlue }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Checkbox checked={!!formData.pregnant} onChange={(e) => set({ pregnant: e.target.checked })} /> {t('w5Appt.pregnant')}
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Checkbox checked={!!formData.contrastAgent} onChange={(e) => set({ contrastAgent: e.target.checked })} /> {t('w5Appt.contrastAgent')}
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Checkbox checked={!!formData.consentRequired} onChange={(e) => set({ consentRequired: e.target.checked })} /> {t('w5Appt.consentRequired')}
              </label>
            </div>
            <FormField label={t('w5Appt.prepInstruction')}>
              <textarea rows={2} value={formData.prepInstruction || ''} onChange={(e) => set({ prepInstruction: e.target.value })} style={{ ...inputStyle(borderGray), resize: 'vertical' }} />
            </FormField>
            <WorkflowTemplatePanel modality={formData.examType} compact />
          </div>
        )}

        {/* ===== Step 4: 医保与费用 ===== */}
        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: primaryBlue, display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)' }}><CreditCard size={12} />{t('w5Appt.step4')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2, 8px)' }}>
              <FormField label={t('w5Appt.insuranceType')}>
                <select value={formData.insuranceType || t('w5Appt.insuranceBasic')} onChange={(e) => set({ insuranceType: e.target.value })} style={inputStyle(borderGray)}>
                  {[t('w5Appt.insuranceSelfPay'), t('w5Appt.insuranceBasic'), t('w5Appt.insuranceResident'), t('w5Appt.insuranceCommercial')].map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </FormField>
              <FormField label={t('w5Appt.insurancePreAuthNo')}>
                <input value={formData.insurancePreAuthNo || ''} onChange={(e) => set({ insurancePreAuthNo: e.target.value })} style={inputStyle(borderGray)} />
              </FormField>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: formData.greenChannel ? 'var(--color-error-600)' : primaryBlue, fontWeight: 700 }}>
              <Checkbox checked={!!formData.greenChannel} onChange={(e) => set({ greenChannel: e.target.checked, priority: e.target.checked ? 'critical' : formData.priority })} /> {t('w5Appt.greenChannel')}
            </label>
            <div style={{ fontSize: 11, color: textGray }}>{t('w5Appt.greenChannelHint')}</div>
            <FormField label={t('w8.appointmentForm.notes')}>
              <textarea rows={2} value={formData.notes || ''} onChange={(e) => set({ notes: e.target.value })} style={{ ...inputStyle(borderGray), resize: 'vertical' }} />
            </FormField>
          </div>
        )}

        {/* ===== Step 5: 确认 ===== */}
        {step === 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: primaryBlue, display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)' }}><ClipboardCheck size={12} />{t('w5Appt.reviewSection')}</div>
            <div style={{ fontSize: 11, color: textGray }}>{t('w5Appt.confirmHint')}</div>
            <div data-testid="wizard-summary" style={{ border: `1px solid ${borderGray}`, borderRadius: 8, overflow: 'hidden' }}>
              {[
                [t('w8.appointmentForm.patientName'), formData.patientName],
                [t('w8.appointmentForm.gender'), formData.gender],
                [t('w8.appointmentForm.age'), formData.age],
                [t('w8.appointmentForm.phone'), formData.phone],
                [t('w8.appointmentForm.examItem'), formData.examItemName || '-'],
                [t('w5Appt.room'), formData.roomName || '-'],
                [t('w5Appt.technician'), formData.technicianName || '-'],
                [t('w8.appointmentForm.examDate'), `${formData.examDate} ${formData.examTime}`],
                [t('w5Appt.duration'), `${formData.durationMin ?? 30} min`],
                [t('w5Appt.insuranceType'), formData.insuranceType || '-'],
                [t('w5Appt.greenChannel'), formData.greenChannel ? t('w5Appt.priorityCritical') : '-'],
              ].map(([label, value], i) => (
                <div key={String(label)} style={{ display: 'flex', fontSize: 12, borderTop: i === 0 ? 'none' : `1px solid ${borderGray}` }}>
                  <div style={{ width: 110, padding: '6px 10px', color: textGray, background: 'var(--bg-deep)' }}>{label}</div>
                  <div style={{ flex: 1, padding: '6px 10px', color: primaryBlue, fontWeight: 600 }}>{String(value ?? '-')}</div>
                </div>
              ))}
            </div>
            <div>
              <button onClick={runConflictCheck} disabled={checking} style={{ padding: '5px 12px', borderRadius: 6, border: `1px solid ${primaryBlue}`, background: whiteBg, color: primaryBlue, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                {checking ? '...' : t('w5Appt.conflictTitle')}
              </button>
              {conflicts.length === 0 ? (
                <span style={{ marginLeft: 10, fontSize: 12, color: '#059669' }}>{t('w5Appt.conflictNone')}</span>
              ) : (
                <div style={{ marginTop: 'var(--space-2, 8px)', display: 'flex', flexDirection: 'column', gap: 'var(--space-1, 4px)' }}>
                  {conflicts.map((c, i) => (
                    <div key={`${c.type}-${i}`} style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, background: c.severity === 'ERROR' ? 'var(--color-error-bg)' : 'var(--color-warning-bg)', color: c.severity === 'ERROR' ? 'var(--color-error-600)' : '#92400e', border: `1px solid ${c.severity === 'ERROR' ? '#fca5a5' : 'var(--color-warning-border)'}` }}>
                      [{t(`w5Appt.conflictType.${c.type}`)}] {c.message}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 底部操作 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-2, 8px)', borderTop: `1px solid ${borderGray}`, paddingTop: 10 }}>
          <button onClick={step === 0 ? close : prev} style={{ padding: '6px 14px', borderRadius: 6, border: `1px solid ${borderGray}`, background: whiteBg, color: textGray, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)' }}>
            {step === 0 ? t('w5Appt.cancel') : (<><ChevronLeft size={13} />{t('w5Appt.prev')}</>)}
          </button>
          {step < STEP_KEYS.length - 1 ? (
            <button onClick={next} style={{ padding: '6px 16px', borderRadius: 6, border: 'none', background: primaryBlue, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)' }}>
              {t('w5Appt.next')} <ChevronRight size={13} />
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={submitting} style={{ padding: '6px 16px', borderRadius: 6, border: 'none', background: 'var(--color-warning-600)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: submitting ? 'wait' : 'pointer', opacity: submitting ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)' }}>
              {submitting && <Loader2 size={13} />}
              {t('w5Appt.submit')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
