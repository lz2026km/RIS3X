// ===== Types =====
export interface EducationMaterial {
  id: string
  title: string
  category: 'pre_exam' | 'post_exam' | 'condition' | 'medication' | 'general'
  modality?: string
  bodyPart?: string
  contentType: 'text' | 'video' | 'pdf' | 'image'
  duration?: number
  content: string
  summary: string
  tags: string[]
  language: 'zh-CN' | 'en'
  createdAt: string
  updatedAt: string
}

export interface PatientEducationRecord {
  id: string
  patientId: string
  patientName: string
  materialId: string
  materialTitle: string
  assignedAt: string
  readAt?: string
  completed: boolean
  feedback?: string
}

export interface CommunicationTemplate {
  id: string
  name: string
  channel: 'sms' | 'wechat' | 'email' | 'app_push'
  title: string
  body: string
  variables: string[]
}

export interface IEducationService {
  getMaterials(category?: EducationMaterial['category']): Promise<EducationMaterial[]>
  getMaterial(id: string): Promise<EducationMaterial | null>
  assignMaterial(patientId: string, materialId: string): Promise<PatientEducationRecord>
  getPatientRecords(patientId: string): Promise<PatientEducationRecord[]>
  markAsRead(recordId: string): Promise<boolean>
  getTemplates(channel?: CommunicationTemplate['channel']): Promise<CommunicationTemplate[]>
  sendCommunication(patientId: string, templateId: string, variables: Record<string, string>): Promise<boolean>
}

// ===== Mock Data =====
const MOCK_MATERIALS: EducationMaterial[] = [
  { id: 'M001', title: 'CT检查注意事项', category: 'pre_exam', modality: 'CT', bodyPart: '胸部', contentType: 'text', content: 'CT检查前需去除金属物品...\n1. 检查前4小时禁食\n2. 如有造影剂过敏史请提前告知', summary: 'CT检查前的准备工作', tags: ['CT', '检查准备', '造影剂'], language: 'zh-CN', createdAt: '2025-01-01', updatedAt: '2025-01-01' },
  { id: 'M002', title: 'MRI检查安全须知', category: 'pre_exam', modality: 'MR', bodyPart: '颅脑', contentType: 'text', content: 'MRI检查安全须知：\n1. 去除所有金属物品\n2. 体内有金属植入物请提前告知\n3. 检查过程噪音较大，请勿紧张', summary: 'MRI检查安全性指导', tags: ['MRI', '安全', '金属植入物'], language: 'zh-CN', createdAt: '2025-01-01', updatedAt: '2025-01-15' },
  { id: 'M003', title: '造影剂使用说明', category: 'medication', contentType: 'text', content: '造影剂使用说明：\n1. 碘造影剂可能引起过敏反应\n2. 检查后多饮水促进排出\n3. 如有不适及时告知医护人员', summary: '造影剂相关知识', tags: ['造影剂', '过敏', '安全'], language: 'zh-CN', createdAt: '2025-01-10', updatedAt: '2025-02-01' },
  { id: 'M004', title: '检查报告解读指南', category: 'post_exam', contentType: 'text', content: '如何理解您的影像报告：\n1. 检查描述部分记录影像所见\n2. 诊断意见是医生的综合判断\n3. 如有疑问请咨询临床医生', summary: '帮助患者理解影像报告', tags: ['报告', '解读', '教育'], language: 'zh-CN', createdAt: '2025-01-05', updatedAt: '2025-01-20' },
]

const MOCK_RECORDS: PatientEducationRecord[] = [
  { id: 'R001', patientId: 'P001', patientName: '张三', materialId: 'M001', materialTitle: 'CT检查注意事项', assignedAt: '2025-04-28T10:00:00Z', readAt: '2025-04-28T10:30:00Z', completed: true },
  { id: 'R002', patientId: 'P001', patientName: '张三', materialId: 'M003', materialTitle: '造影剂使用说明', assignedAt: '2025-04-28T10:00:00Z', completed: false },
]

const MOCK_TEMPLATES: CommunicationTemplate[] = [
  { id: 'C001', name: '检查预约提醒', channel: 'sms', title: '检查预约提醒', body: '尊敬的{name}，您预约的{exam}检查将于{date} {time}进行，请准时到达。', variables: ['name', 'exam', 'date', 'time'] },
  { id: 'C002', name: '报告完成通知', channel: 'wechat', title: '报告完成通知', body: '您的{exam}检查报告已出具，医生：{doctor}，点击查看详情。', variables: ['exam', 'doctor'] },
  { id: 'C003', name: '健康教育推送', channel: 'app_push', title: '健康教育', body: '推荐您阅读：{material}，了解相关检查知识。', variables: ['material'] },
]

class MockEducationService implements IEducationService {
  async getMaterials(category?: EducationMaterial['category']): Promise<EducationMaterial[]> {
    return category ? MOCK_MATERIALS.filter(m => m.category === category) : MOCK_MATERIALS
  }

  async getMaterial(id: string): Promise<EducationMaterial | null> {
    return MOCK_MATERIALS.find(m => m.id === id) ?? null
  }

  async assignMaterial(patientId: string, materialId: string): Promise<PatientEducationRecord> {
    const material = MOCK_MATERIALS.find(m => m.id === materialId)
    const record: PatientEducationRecord = {
      id: `R${Date.now()}`, patientId, patientName: '患者', materialId,
      materialTitle: material?.title ?? '', assignedAt: new Date().toISOString(), completed: false,
    }
    MOCK_RECORDS.push(record)
    return record
  }

  async getPatientRecords(patientId: string): Promise<PatientEducationRecord[]> {
    return MOCK_RECORDS.filter(r => r.patientId === patientId)
  }

  async markAsRead(recordId: string): Promise<boolean> {
    const record = MOCK_RECORDS.find(r => r.id === recordId)
    if (record) { record.readAt = new Date().toISOString(); record.completed = true; return true }
    return false
  }

  async getTemplates(channel?: CommunicationTemplate['channel']): Promise<CommunicationTemplate[]> {
    return channel ? MOCK_TEMPLATES.filter(t => t.channel === channel) : MOCK_TEMPLATES
  }

  async sendCommunication(patientId: string, templateId: string, variables: Record<string, string>): Promise<boolean> {
    return true
  }
}

let _instance: IEducationService | null = null

export function getEducationService(): IEducationService {
  if (!_instance) _instance = new MockEducationService()
  return _instance
}
