import { Plus, X, Monitor, User, Stethoscope, Scan } from 'lucide-react'
import { initialModalityDevices, initialExamItems, initialUsers } from '../data/initialData'

const primaryBlue = '#1e40af'
const textGray = '#64748b'
const borderGray = '#cbd5e1'
const whiteBg = '#ffffff'

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

  return (
    <div style={{ background: whiteBg, borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: `1px solid ${borderGray}`, overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', background: primaryBlue, color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 700 }}><Plus size={15} /> 新建预约</div>
        <button onClick={() => { setShowForm(false); setFormErrors({}); setValidationError('') }} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={16} /></button>
      </div>
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {validationError && <div style={{ color: '#dc2626', fontSize: 12, padding: '8px 12px', background: '#fee2e2', borderRadius: 6, border: '1px solid #fca5a5' }}>{validationError}</div>}
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: primaryBlue, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}><User size={12} />患者信息</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[{ key: 'patientName', label: '姓名*', placeholder: '输入患者姓名' }, { key: 'age', label: '年龄', placeholder: '如: 45', type: 'number' }, { key: 'gender', label: '性别', type: 'select', options: ['男', '女'] }, { key: 'phone', label: '手机号', placeholder: '11位手机号' }, { key: 'idCard', label: '身份证', placeholder: '18位身份证号' }].map(field => (
              <div key={field.key}>
                <div style={{ fontSize: 12, color: textGray, marginBottom: 2 }}>{field.label}</div>
                {field.type === 'select' ? (
                  <select value={formData[field.key]} onChange={e => setFormData({ ...formData, [field.key]: e.target.value })} style={{ width: '100%', padding: '5px 8px', border: `1px solid ${borderGray}`, borderRadius: 6, fontSize: 12, outline: 'none', color: primaryBlue, background: whiteBg }}>
                    {field.options?.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input type={field.type || 'text'} placeholder={field.placeholder} value={formData[field.key] || ''} onChange={e => setFormData({ ...formData, [field.key]: e.target.value })} style={{ width: '100%', padding: '5px 8px', border: `1px solid ${borderColor(field.key)}`, borderRadius: 6, fontSize: 12, outline: 'none', color: primaryBlue }} />
                )}
                {fieldError(field.key) && <div style={{ fontSize: 12, color: '#dc2626', marginTop: 2 }}>{fieldError(field.key)}</div>}
              </div>
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: primaryBlue, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}><Scan size={12} />检查项目</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <div style={{ fontSize: 12, color: textGray, marginBottom: 2 }}>检查类型</div>
              <select value={formData.examType} onChange={e => setFormData({ ...formData, examType: e.target.value, examItemId: '', examItemName: '', bodyPart: '' })} style={{ width: '100%', padding: '5px 8px', border: `1px solid ${borderGray}`, borderRadius: 6, fontSize: 12, outline: 'none', color: primaryBlue, background: whiteBg }}>
                {['CT', 'MR', 'DR', 'US', 'DX', 'XA'].map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 12, color: textGray, marginBottom: 2 }}>检查项目*</div>
              <select value={formData.examItemId} onChange={e => { const item = initialExamItems.find((i: any) => i.id === e.target.value); setFormData({ ...formData, examItemId: e.target.value, examItemName: item?.name || '', bodyPart: item?.bodyPart || '' }) }} style={{ width: '100%', padding: '5px 8px', border: `1px solid ${borderColor('examItemId')}`, borderRadius: 6, fontSize: 12, outline: 'none', color: primaryBlue, background: whiteBg }}>
                <option value="">选择项目</option>
                {initialExamItems.filter((i: any) => i.modality === formData.examType).map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: primaryBlue, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}><Monitor size={12} />预约时间与设备</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[{ key: 'examDate', label: '检查日期*', type: 'date' }, { key: 'examTime', label: '时段*', type: 'select', options: timeSlots }].map(field => (
              <div key={field.key}>
                <div style={{ fontSize: 12, color: textGray, marginBottom: 2 }}>{field.label}</div>
                {field.type === 'select' ? (
                  <select value={formData[field.key]} onChange={e => setFormData({ ...formData, [field.key]: e.target.value })} style={{ width: '100%', padding: '5px 8px', border: `1px solid ${borderColor(field.key)}`, borderRadius: 6, fontSize: 12, outline: 'none', color: primaryBlue, background: whiteBg }}>
                    {field.options?.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input type={field.type} value={formData[field.key] || ''} onChange={e => setFormData({ ...formData, [field.key]: e.target.value })} style={{ width: '100%', padding: '5px 8px', border: `1px solid ${borderColor(field.key)}`, borderRadius: 6, fontSize: 12, outline: 'none', color: primaryBlue }} />
                )}
              </div>
            ))}
            <div>
              <div style={{ fontSize: 12, color: textGray, marginBottom: 2 }}>设备*</div>
              <select value={formData.deviceId} onChange={e => { const device = initialModalityDevices.find((d: any) => d.id === e.target.value); setFormData({ ...formData, deviceId: e.target.value, deviceName: device?.name || '', roomId: device?.id?.replace('DEV', 'ROOM')?.replace('-01', '-01') || '', roomName: device?.location || '' }) }} style={{ width: '100%', padding: '5px 8px', border: `1px solid ${borderColor('deviceId')}`, borderRadius: 6, fontSize: 12, outline: 'none', color: primaryBlue, background: whiteBg }}>
                <option value="">选择设备</option>
                {initialModalityDevices.filter((d: any) => d.modality === formData.examType && d.status !== '维护中').map((d: any) => <option key={d.id} value={d.id}>{d.name.split('（')[0]}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: primaryBlue, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}><Stethoscope size={12} />临床信息</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <div style={{ fontSize: 12, color: textGray, marginBottom: 2 }}>临床诊断</div>
              <input placeholder="输入临床诊断" value={formData.clinicalDiagnosis || ''} onChange={e => setFormData({ ...formData, clinicalDiagnosis: e.target.value })} style={{ width: '100%', padding: '5px 8px', border: `1px solid ${borderGray}`, borderRadius: 6, fontSize: 12, outline: 'none', color: primaryBlue }} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: textGray, marginBottom: 2 }}>开单医生</div>
              <select value={formData.referringDoctorId} onChange={e => { const u = initialUsers.find((u: any) => u.id === e.target.value); setFormData({ ...formData, referringDoctorId: e.target.value, referringDoctorName: u?.name || '' }) }} style={{ width: '100%', padding: '5px 8px', border: `1px solid ${borderGray}`, borderRadius: 6, fontSize: 12, outline: 'none', color: primaryBlue, background: whiteBg }}>
                <option value="">选择医生</option>
                {initialUsers.filter((u: any) => u.role === 'doctor').map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: textGray, marginBottom: 2 }}>备注</div>
          <textarea placeholder="添加备注信息（可选）" value={formData.notes || ''} onChange={e => setFormData({ ...formData, notes: e.target.value })} rows={2} style={{ width: '100%', padding: '5px 8px', border: `1px solid ${borderGray}`, borderRadius: 6, fontSize: 12, outline: 'none', color: primaryBlue, fontFamily: 'inherit', resize: 'vertical' }} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => { setShowForm(false); setFormErrors({}); setValidationError('') }} style={{ flex: 1, padding: '8px', background: '#f1f5f9', color: textGray, border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>取消</button>
          <button onClick={handleSubmit} style={{ flex: 1, padding: '8px', background: primaryBlue, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}><Plus size={14} />创建预约</button>
        </div>
      </div>
    </div>
  )
}
