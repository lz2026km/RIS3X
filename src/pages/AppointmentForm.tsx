import { Plus, X, Monitor, User, Stethoscope, Scan } from 'lucide-react'
import { initialModalityDevices, initialExamItems, initialUsers } from '../data/initialData'
import { FormField, FormSubmitBar } from '../components/common/FormField'
import { t } from '../i18n/appI18n'
// [v3.0.6.11-104 Wave 3D] 检查流程模板接入 (登记核对/妊娠询问等)
import WorkflowTemplatePanel from '../components/common/WorkflowTemplatePanel'

const primaryBlue = '#1e40af'
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
  timeSlots: string[]
}

export default function AppointmentForm(props: AppointmentFormProps) {
  const { showForm, setShowForm, formData, setFormData, validationError, formErrors, setFormErrors, setValidationError, handleSubmit, timeSlots } = props
  if (!showForm) return null

  const fieldError = (key: string) => formErrors[key]
  const borderColor = (key: string) => formErrors[key] ? '#dc2626' : borderGray
  const requiredSuffix = (label: string) => (label.endsWith('*') ? '*' : '')

  return (
    <div style={{ background: whiteBg, borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: `1px solid ${borderGray}`, overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', background: primaryBlue, color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 700 }}><Plus size={15} /> {t('w8.appointmentForm.newAppointment')}</div>
        <button onClick={() => { setShowForm(false); setFormErrors({}); setValidationError('') }} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={16} /></button>
      </div>
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {validationError && <div style={{ color: '#dc2626', fontSize: 12, padding: '8px 12px', background: 'var(--color-error-bg)', borderRadius: 6, border: '1px solid #fca5a5' }}>{validationError}</div>}
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: primaryBlue, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}><User size={12} />{t('w8.appointmentForm.patientInfo')}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              { key: 'patientName', label: `${t('w8.appointmentForm.patientName')}${requiredSuffix(t('w8.appointmentForm.patientName'))}*`, placeholder: t('w8.appointmentForm.patientNamePlaceholder') },
              { key: 'age', label: t('w8.appointmentForm.age'), placeholder: t('w8.appointmentForm.agePlaceholder'), type: 'number' },
              { key: 'gender', label: t('w8.appointmentForm.gender'), type: 'select', options: [t('w8.appointmentForm.male'), t('w8.appointmentForm.female')] },
              { key: 'phone', label: t('w8.appointmentForm.phone'), placeholder: t('w8.appointmentForm.phonePlaceholder') },
              { key: 'idCard', label: t('w8.appointmentForm.idCard'), placeholder: t('w8.appointmentForm.idCardPlaceholder') },
            ].map(field => (
              <FormField
                key={field.key}
                label={field.label.replace(/\*$/, '')}
                required={field.label.endsWith('*')}
                error={fieldError(field.key)}
              >
                {field.type === 'select' ? (
                  <select value={formData[field.key]} onChange={e => setFormData({ ...formData, [field.key]: e.target.value })} style={{ width: '100%', padding: '5px 8px', border: `1px solid ${borderGray}`, borderRadius: 6, fontSize: 12, outline: 'none', color: primaryBlue, background: whiteBg }}>
                    {field.options?.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input type={field.type || 'text'} placeholder={field.placeholder} value={formData[field.key] || ''} onChange={e => setFormData({ ...formData, [field.key]: e.target.value })} style={{ width: '100%', padding: '5px 8px', border: `1px solid ${borderColor(field.key)}`, borderRadius: 6, fontSize: 12, outline: 'none', color: primaryBlue }} />
                )}
              </FormField>
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: primaryBlue, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}><Scan size={12} />{t('w8.appointmentForm.examInfo')}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <FormField label={t('w8.appointmentForm.examType')} required={false}>
                <select value={formData.examType} onChange={e => setFormData({ ...formData, examType: e.target.value, examItemId: '', examItemName: '', bodyPart: '' })} style={{ width: '100%', padding: '5px 8px', border: `1px solid ${borderGray}`, borderRadius: 6, fontSize: 12, outline: 'none', color: primaryBlue, background: whiteBg }}>
                  {['CT', 'MR', 'DR', 'US', 'DX', 'XA'].map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </FormField>
            </div>
            <div>
              <FormField label={`${t('w8.appointmentForm.examItem')}*`} required error={fieldError('examItemId')}>
                <select value={formData.examItemId} onChange={e => { const item = initialExamItems.find((i: any) => i.id === e.target.value); setFormData({ ...formData, examItemId: e.target.value, examItemName: item?.name || '', bodyPart: item?.bodyPart || '' }) }} style={{ width: '100%', padding: '5px 8px', border: `1px solid ${borderColor('examItemId')}`, borderRadius: 6, fontSize: 12, outline: 'none', color: primaryBlue, background: whiteBg }}>
                  <option value="">{t('w8.appointmentForm.selectExamItem')}</option>
                  {initialExamItems.filter((i: any) => i.modality === formData.examType).map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </FormField>
            </div>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: primaryBlue, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}><Monitor size={12} />{t('w8.appointmentForm.timeDevice')}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              { key: 'examDate', label: `${t('w8.appointmentForm.examDate')}*`, type: 'date' },
              { key: 'examTime', label: `${t('w8.appointmentForm.timeSlot')}*`, type: 'select', options: timeSlots },
            ].map(field => (
              <FormField
                key={field.key}
                label={field.label.replace(/\*$/, '')}
                required={field.label.endsWith('*')}
                error={fieldError(field.key)}
              >
                {field.type === 'select' ? (
                  <select value={formData[field.key]} onChange={e => setFormData({ ...formData, [field.key]: e.target.value })} style={{ width: '100%', padding: '5px 8px', border: `1px solid ${borderColor(field.key)}`, borderRadius: 6, fontSize: 12, outline: 'none', color: primaryBlue, background: whiteBg }}>
                    {field.options?.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input type={field.type} value={formData[field.key] || ''} onChange={e => setFormData({ ...formData, [field.key]: e.target.value })} style={{ width: '100%', padding: '5px 8px', border: `1px solid ${borderColor(field.key)}`, borderRadius: 6, fontSize: 12, outline: 'none', color: primaryBlue }} />
                )}
              </FormField>
            ))}
            <div>
              <FormField label={`${t('w8.appointmentForm.device')}*`} required error={fieldError('deviceId')}>
                <select value={formData.deviceId} onChange={e => { const device = initialModalityDevices.find((d: any) => d.id === e.target.value); setFormData({ ...formData, deviceId: e.target.value, deviceName: device?.name || '', roomId: device?.id?.replace('DEV', 'ROOM')?.replace('-01', '-01') || '', roomName: device?.location || '' }) }} style={{ width: '100%', padding: '5px 8px', border: `1px solid ${borderColor('deviceId')}`, borderRadius: 6, fontSize: 12, outline: 'none', color: primaryBlue, background: whiteBg }}>
                  <option value="">{t('w8.appointmentForm.selectDevice')}</option>
                  {initialModalityDevices.filter((d: any) => d.modality === formData.examType && d.status !== '维护中').map((d: any) => <option key={d.id} value={d.id}>{d.name.split('（')[0]}</option>)}
                </select>
              </FormField>
            </div>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: primaryBlue, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}><Stethoscope size={12} />{t('w8.appointmentForm.clinicalInfo')}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <div style={{ fontSize: 12, color: textGray, marginBottom: 2 }}>{t('w8.appointmentForm.clinicalDiagnosis')}</div>
              <input placeholder={t('w8.appointmentForm.clinicalDiagnosis')} value={formData.clinicalDiagnosis || ''} onChange={e => setFormData({ ...formData, clinicalDiagnosis: e.target.value })} style={{ width: '100%', padding: '5px 8px', border: `1px solid ${borderGray}`, borderRadius: 6, fontSize: 12, outline: 'none', color: primaryBlue }} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: textGray, marginBottom: 2 }}>{t('w8.appointmentForm.referringDoctor')}</div>
              <select value={formData.referringDoctorId} onChange={e => { const u = initialUsers.find((u: any) => u.id === e.target.value); setFormData({ ...formData, referringDoctorId: e.target.value, referringDoctorName: u?.name || '' }) }} style={{ width: '100%', padding: '5px 8px', border: `1px solid ${borderGray}`, borderRadius: 6, fontSize: 12, outline: 'none', color: primaryBlue, background: whiteBg }}>
                <option value="">{t('w8.appointmentForm.selectDoctor')}</option>
                {initialUsers.filter((u: any) => u.role === 'doctor').map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: textGray, marginBottom: 2 }}>{t('w8.appointmentForm.notes')}</div>
          <textarea placeholder={t('w8.appointmentForm.notesPlaceholder')} value={formData.notes || ''} onChange={e => setFormData({ ...formData, notes: e.target.value })} rows={2} style={{ width: '100%', padding: '5px 8px', border: `1px solid ${borderGray}`, borderRadius: 6, fontSize: 12, outline: 'none', color: primaryBlue, fontFamily: 'inherit', resize: 'vertical' }} />
        </div>
        {/* [v3.0.6.11-104 Wave 3D] 检查流程模板 (登记核对/妊娠询问/摆位/质控) */}
        <WorkflowTemplatePanel modality={formData.examType} compact />
        <FormSubmitBar
          onCancel={() => { setShowForm(false); setFormErrors({}); setValidationError('') }}
          onSubmit={handleSubmit}
          submitText={t('w8.appointmentForm.create')}
        />
      </div>
    </div>
  )
}
