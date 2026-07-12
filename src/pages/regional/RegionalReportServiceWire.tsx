import { message } from 'antd'
import React from 'react'

export const COLORS = {
  primary: '#1e40af',
  secondary: '#0891b2',
  success: '#16a34a',
  warning: '#d97706',
  danger: '#dc2626',
  bgGray: '#e8e8e8',
  cardWhite: '#ffffff',
  textDark: '#1f2937',
  textMuted: '#6b7280',
  border: '#d1d5db',
  pending: '#f59e0b',
  inProgress: '#3b82f6',
  completed: '#10b981',
}

export const styles = {
  pageContainer: { minHeight: '100vh', backgroundColor: COLORS.bgGray, fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif', fontSize: '14px', color: COLORS.textDark },
  header: { backgroundColor: COLORS.primary, color: 'white', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
  headerTitle: { display: 'flex', alignItems: 'center', gap: '12px', fontSize: '20px', fontWeight: 600 },
  headerSubtitle: { fontSize: '12px', opacity: 0.85, marginTop: '2px' },
  statsContainer: { display: 'flex', gap: '16px', padding: '20px 24px', flexWrap: 'wrap' as const },
  statCard: { backgroundColor: COLORS.cardWhite, borderRadius: '8px', padding: '16px 20px', minWidth: '180px', flex: 1, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb' },
  statLabel: { fontSize: '12px', color: COLORS.textMuted, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' },
  statValue: { fontSize: '24px', fontWeight: 700, color: COLORS.primary },
  statChange: { fontSize: '11px', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' },
  mainContent: { display: 'flex', gap: '16px', padding: '0 24px 20px', height: 'calc(100vh - 280px)', minHeight: '500px' },
  leftPanel: { width: '260px', backgroundColor: COLORS.cardWhite, borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column' as const, overflow: 'hidden' },
  panelHeader: { padding: '14px 16px', borderBottom: '1px solid #e5e7eb', fontWeight: 600, fontSize: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f9fafb' },
  panelBody: { flex: 1, overflowY: 'auto' as const, padding: '8px' },
  middlePanel: { flex: 1, backgroundColor: COLORS.cardWhite, borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column' as const, overflow: 'hidden' },
  rightPanel: { width: '320px', backgroundColor: COLORS.cardWhite, borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column' as const, overflow: 'hidden' },
  bottomPanel: { backgroundColor: COLORS.cardWhite, borderRadius: '8px', margin: '0 24px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb', overflow: 'hidden' },
  tabContainer: { display: 'flex', gap: '4px', padding: '12px 16px', borderBottom: '1px solid #e5e7eb', backgroundColor: '#f9fafb', flexWrap: 'wrap' as const },
  tab: { padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s', border: 'none', backgroundColor: 'transparent', color: COLORS.textMuted },
  tabActive: { backgroundColor: COLORS.primary, color: 'white' },
  listItem: { padding: '10px 12px', borderRadius: '6px', cursor: 'pointer', marginBottom: '4px', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: '10px' },
  listItemActive: { backgroundColor: '#eff6ff', borderLeft: `3px solid ${COLORS.primary}` },
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: '13px' },
  th: { padding: '10px 12px', textAlign: 'left' as const, backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb', fontWeight: 600, color: COLORS.textDark, whiteSpace: 'nowrap' as const },
  td: { padding: '10px 12px', borderBottom: '1px solid #e5e7eb' },
  button: { padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s', border: 'none' },
  buttonPrimary: { backgroundColor: COLORS.primary, color: 'white' },
  buttonSecondary: { backgroundColor: COLORS.secondary, color: 'white' },
  buttonOutline: { backgroundColor: 'transparent', border: `1px solid ${COLORS.primary}`, color: COLORS.primary },
  buttonDanger: { backgroundColor: COLORS.danger, color: 'white' },
  buttonGhost: { backgroundColor: 'transparent', color: COLORS.textMuted },
  statusTag: { padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' },
  input: { padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px', outline: 'none', transition: 'border-color 0.2s' },
  textarea: { padding: '10px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px', outline: 'none', resize: 'vertical' as const, minHeight: '80px', fontFamily: 'inherit' },
  modal: { position: 'fixed' as const, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modalContent: { backgroundColor: COLORS.cardWhite, borderRadius: '12px', width: '90%', maxWidth: '600px', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' },
  modalHeader: { padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 600, fontSize: '16px' },
  modalBody: { padding: '20px' },
  modalFooter: { padding: '16px 20px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: '10px' },
  formGroup: { marginBottom: '16px' },
  formLabel: { display: 'block', marginBottom: '6px', fontWeight: 500, fontSize: '13px', color: COLORS.textDark },
  badge: { padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 },
  pagination: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderTop: '1px solid #e5e7eb', backgroundColor: '#f9fafb' },
  emptyState: { padding: '40px 20px', textAlign: 'center' as const, color: COLORS.textMuted },
  timeline: { padding: '16px' },
  timelineItem: { display: 'flex', gap: '12px', marginBottom: '16px', position: 'relative' as const },
  timelineDot: { width: '10px', height: '10px', borderRadius: '50%', backgroundColor: COLORS.primary, marginTop: '4px', flexShrink: 0 },
  timelineLine: { position: 'absolute' as const, left: '4px', top: '16px', bottom: '-12px', width: '2px', backgroundColor: '#e5e7eb' },
  chartContainer: { padding: '16px', height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb', borderRadius: '8px', margin: '12px' },
  progressBar: { height: '8px', backgroundColor: '#e5e7eb', borderRadius: '4px', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: '4px', transition: 'width 0.3s' },
  searchBox: { display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', backgroundColor: '#f3f4f6', borderRadius: '6px', margin: '12px' },
}

export interface Institution {
  id: string; name: string; level: '三级' | '二级' | '一级'; type: '综合医院' | '专科医院' | '基层医疗'; reportCount: number; pendingCount: number; icon: string
}
export interface Consultation {
  id: string; caseId: string; patientName: string; gender: string; age: number; institution: string; modality: string; examItem: string; applyReason: string; status: '待接诊' | '会诊中' | '已完成' | '已取消'; applyTime: string; acceptTime?: string; completeTime?: string; applyDoctor: string; acceptDoctor?: string; consultationOpinion?: string; priority: '普通' | '紧急' | '立即'
}
export interface Report {
  id: string; reportId: string; institution: string; patientName: string; gender: string; age: number; modality: string; examItem: string; reportTime: string; reportDoctor: string; status: '待审核' | '已通过' | '有问题' | '已驳回'; qualityScore: number; qualityIssues: string[]; reviewOpinion?: string; reviewDoctor?: string; reviewTime?: string
}
export interface CriticalValueReport {
  id: string; patientName: string; gender: string; age: number; institution: string; modality: string; examItem: string; criticalFinding: string; severity: '危急' | '高危' | '紧急'; reportedTime: string; reportedDoctor: string; status: '待确认' | '已接收' | '处理中' | '已闭环'; receiveTime?: string; receiveDoctor?: string; handleTime?: string; handleDoctor?: string; closeTime?: string
}
export interface RemoteDiagnosis {
  id: string; caseId: string; patientName: string; gender: string; age: number; examType: string; applyInstitution: string; remoteExpert: string; expertInstitution: string; status: '待书写' | '书写中' | '待审核' | '已完成'; applyTime: string; startTime?: string; completeTime?: string; reportContent?: string; isOtherTyping?: boolean; otherTypingName?: string
}
export interface CoSignRecord {
  id: string; reportId: string; examType: string; patientName: string; gender: string; age: number; participatingInstitutions: string[]; status: '待签发' | '签发中' | '已完成'; createTime: string; completeTime?: string; signatures: Signature[]; versions: ReportVersion[]
}
export interface Signature { institution: string; doctorName: string; signTime: string; certificateStatus: '已认证' | '未认证' | '过期'; order: number }
export interface ReportVersion { version: string; modifyTime: string; modifyInstitution: string; modifyReason: string; modifier: string }
export interface StatData { label: string; value: number | string; change?: number; changeType?: 'up' | 'down'; icon: React.ReactNode; color: string }
export interface ShareRecord { id: string; reportId: string; patientName: string; institution: string; targetInstitution: string; sharedDate: string; sharedBy: string; status: 'active' | 'revoked'; consent: boolean; accessCount: number }
export interface SLARecord { siteName: string; assignedExams: number; completedExams: number; avgTAT: string; slaTarget: string; slaCompliance: number }

export const mockInstitutions: Institution[] = [
  { id: '1', name: '市中心医院', level: '三级', type: '综合医院', reportCount: 1256, pendingCount: 23, icon: 'hospital' },
  { id: '2', name: '医学院附属医院', level: '三级', type: '综合医院', reportCount: 1089, pendingCount: 18, icon: 'building' },
  { id: '3', name: '区人民医院', level: '二级', type: '综合医院', reportCount: 678, pendingCount: 12, icon: 'building2' },
  { id: '4', name: '妇幼保健院', level: '二级', type: '专科医院', reportCount: 456, pendingCount: 8, icon: 'clinic' },
  { id: '5', name: '社区服务中心', level: '一级', type: '基层医疗', reportCount: 234, pendingCount: 5, icon: 'clinic' },
]

export const mockConsultations: Consultation[] = [
  { id: 'C001', caseId: 'RC20260501001', patientName: '王建国', gender: '男', age: 58, institution: '市中心医院', modality: 'CT', examItem: '胸部增强CT', applyReason: '右肺占位性病变，需明确诊断', status: '待接诊', applyTime: '2026-05-02 08:30', applyDoctor: '李明', priority: '紧急' },
  { id: 'C002', caseId: 'RC20260501002', patientName: '张丽华', gender: '女', age: 45, institution: '区人民医院', modality: 'MRI', examItem: '颅脑MRI', applyReason: '头晕头痛待查', status: '会诊中', applyTime: '2026-05-02 09:15', acceptTime: '2026-05-02 09:30', applyDoctor: '王芳', acceptDoctor: '赵主任', priority: '普通' },
  { id: 'C003', caseId: 'RC20260501003', patientName: '陈志强', gender: '男', age: 67, institution: '医学院附属医院', modality: 'DR', examItem: '胸片', applyReason: '肺结核复查', status: '已完成', applyTime: '2026-05-01 14:20', acceptTime: '2026-05-01 14:35', completeTime: '2026-05-01 15:10', applyDoctor: '刘洋', acceptDoctor: '张主任', consultationOpinion: '右肺上叶见纤维索条影，结核灶稳定，建议定期复查', priority: '普通' },
  { id: 'C004', caseId: 'RC20260501004', patientName: '周小红', gender: '女', age: 34, institution: '妇幼保健院', modality: '超声', examItem: '产科彩超', applyReason: '孕24周大排畸', status: '已完成', applyTime: '2026-05-01 10:00', acceptTime: '2026-05-01 10:15', completeTime: '2026-05-01 11:30', applyDoctor: '孙颖', acceptDoctor: '李主任', consultationOpinion: '胎儿发育正常，羊水量正常，未见明显畸形', priority: '普通' },
  { id: 'C005', caseId: 'RC20260501005', patientName: '刘德华', gender: '男', age: 72, institution: '社区服务中心', modality: 'CT', examItem: '腹部CT', applyReason: '腹痛待查，疑似肠梗阻', status: '会诊中', applyTime: '2026-05-02 07:45', acceptTime: '2026-05-02 08:00', applyDoctor: '马超', acceptDoctor: '王主任', priority: '立即' },
]

export const mockReports: Report[] = [
  { id: 'R001', reportId: 'REP20260501001', institution: '区人民医院', patientName: '张三', gender: '男', age: 55, modality: 'CT', examItem: '胸部CT', reportTime: '2026-05-02 08:00', reportDoctor: '王医生', status: '待审核', qualityScore: 0, qualityIssues: [] },
  { id: 'R002', reportId: 'REP20260501002', institution: '妇幼保健院', patientName: '李四', gender: '女', age: 28, modality: '超声', examItem: '乳腺彩超', reportTime: '2026-05-02 09:30', reportDoctor: '赵医生', status: '有问题', qualityScore: 72, qualityIssues: ['描述欠详细', '诊断意见不明确'] },
  { id: 'R003', reportId: 'REP20260501003', institution: '社区服务中心', patientName: '周五', gender: '男', age: 62, modality: 'DR', examItem: '腰椎片', reportTime: '2026-05-01 16:00', reportDoctor: '孙医生', status: '已通过', qualityScore: 95, qualityIssues: [] },
  { id: 'R004', reportId: 'REP20260501004', institution: '区人民医院', patientName: '钱七', gender: '女', age: 41, modality: 'MRI', examItem: '膝关节MRI', reportTime: '2026-05-01 14:20', reportDoctor: '陈医生', status: '已驳回', qualityScore: 45, qualityIssues: ['报告格式不规范', '缺少测量数据', '影像描述与诊断不符'] },
  { id: 'R005', reportId: 'REP20260501005', institution: '医学院附属医院', patientName: '孙九', gender: '男', age: 73, modality: 'CT', examItem: '颅脑CT', reportTime: '2026-05-01 11:45', reportDoctor: '周医生', status: '待审核', qualityScore: 0, qualityIssues: [] },
]

export const mockCriticalValues: CriticalValueReport[] = [
  { id: 'CV001', patientName: '吴一', gender: '男', age: 65, institution: '市中心医院', modality: 'CT', examItem: '胸部CT', criticalFinding: '主动脉夹层', severity: '危急', reportedTime: '2026-05-02 08:00', reportedDoctor: '李主任', status: '已闭环', receiveTime: '2026-05-02 08:05', receiveDoctor: '张医生', handleTime: '2026-05-02 08:30', handleDoctor: '急诊科', closeTime: '2026-05-02 09:15' },
  { id: 'CV002', patientName: '郑二', gender: '女', age: 48, institution: '医学院附属医院', modality: 'CT', examItem: '腹部CT', criticalFinding: '肝占位性病变（疑似肝癌）', severity: '危急', reportedTime: '2026-05-02 09:30', reportedDoctor: '王主任', status: '处理中', receiveTime: '2026-05-02 09:35', receiveDoctor: '刘医生', handleTime: '2026-05-02 10:00', handleDoctor: '肿瘤科' },
  { id: 'CV003', patientName: '冯三', gender: '男', age: 52, institution: '区人民医院', modality: 'X光', examItem: '胸片', criticalFinding: '气胸（肺压缩约50%）', severity: '紧急', reportedTime: '2026-05-01 15:20', reportedDoctor: '孙医生', status: '已闭环', receiveTime: '2026-05-01 15:22', receiveDoctor: '赵医生', handleTime: '2026-05-01 15:45', handleDoctor: '胸外科', closeTime: '2026-05-01 16:30' },
  { id: 'CV004', patientName: '褚四', gender: '女', age: 38, institution: '妇幼保健院', modality: '超声', examItem: '妇产科彩超', criticalFinding: '宫外孕破裂待排', severity: '危急', reportedTime: '2026-05-01 11:00', reportedDoctor: '陈医生', status: '已闭环', receiveTime: '2026-05-01 11:03', receiveDoctor: '黄医生', handleTime: '2026-05-01 11:20', handleDoctor: '妇科', closeTime: '2026-05-01 12:00' },
  { id: 'CV005', patientName: '卫五', gender: '男', age: 71, institution: '社区服务中心', modality: '心电图', examItem: '常规心电图', criticalFinding: '急性心肌梗死', severity: '危急', reportedTime: '2026-05-01 08:30', reportedDoctor: '周医生', status: '已闭环', receiveTime: '2026-05-01 08:32', receiveDoctor: '吴医生', handleTime: '2026-05-01 08:45', handleDoctor: '心内科', closeTime: '2026-05-01 09:30' },
]

export const mockRemoteDiagnoses: RemoteDiagnosis[] = [
  { id: 'RD001', caseId: 'REM20260501001', patientName: '赵伟', gender: '男', age: 56, examType: '胸部CT', applyInstitution: '区人民医院', remoteExpert: '张主任', expertInstitution: '市中心医院', status: '待书写', applyTime: '2026-05-02 10:00' },
  { id: 'RD002', caseId: 'REM20260501002', patientName: '钱敏', gender: '女', age: 43, examType: '颅脑MRI', applyInstitution: '社区服务中心', remoteExpert: '李教授', expertInstitution: '医学院附属医院', status: '书写中', applyTime: '2026-05-02 09:00', startTime: '2026-05-02 09:15', isOtherTyping: true, otherTypingName: '李教授' },
  { id: 'RD003', caseId: 'REM20260501003', patientName: '孙强', gender: '男', age: 65, examType: '腹部CT', applyInstitution: '妇幼保健院', remoteExpert: '王主任', expertInstitution: '市中心医院', status: '待审核', applyTime: '2026-05-02 08:00', startTime: '2026-05-02 08:20', completeTime: '2026-05-02 08:45', reportContent: '肝右叶见约3.2cm低密度影，边界欠清，增强扫描见轻中度强化，建议进一步检查。' },
  { id: 'RD004', caseId: 'REM20260501004', patientName: '周莉', gender: '女', age: 38, examType: 'MG', applyInstitution: '区人民医院', remoteExpert: '陈专家', expertInstitution: '医学院附属医院', status: '已完成', applyTime: '2026-05-01 14:00', startTime: '2026-05-01 14:15', completeTime: '2026-05-01 15:00', reportContent: '双侧乳腺腺体致密，未见明确占位性病变，BI-RADS 1类。' },
  { id: 'RD005', caseId: 'REM20260501005', patientName: '吴涛', gender: '男', age: 72, examType: '胸片', applyInstitution: '社区服务中心', remoteExpert: '刘主任', expertInstitution: '市中心医院', status: '待书写', applyTime: '2026-05-02 11:30' },
  { id: 'RD006', caseId: 'REM20260501006', patientName: '郑华', gender: '女', age: 51, examType: '骨盆MRI', applyInstitution: '区人民医院', remoteExpert: '赵教授', expertInstitution: '医学院附属医院', status: '书写中', applyTime: '2026-05-02 08:45', startTime: '2026-05-02 09:00', isOtherTyping: false },
  { id: 'RD007', caseId: 'REM20260501007', patientName: '冯军', gender: '男', age: 48, examType: '颈部CT', applyInstitution: '妇幼保健院', remoteExpert: '孙主任', expertInstitution: '市中心医院', status: '待审核', applyTime: '2026-05-01 16:00', startTime: '2026-05-01 16:20', completeTime: '2026-05-01 16:50', reportContent: '甲状腺右叶见一枚约1.5cm结节，边界尚清，建议密切随访。' },
  { id: 'RD008', caseId: 'REM20260501008', patientName: '曹芳', gender: '女', age: 29, examType: '心脏彩超', applyInstitution: '社区服务中心', remoteExpert: '周主任', expertInstitution: '医学院附属医院', status: '已完成', applyTime: '2026-05-01 10:00', startTime: '2026-05-01 10:15', completeTime: '2026-05-01 11:00', reportContent: '心脏结构及功能未见明显异常，左室射血分数60%。' },
  { id: 'RD009', caseId: 'REM20260501009', patientName: '张磊', gender: '男', age: 61, examType: '胸部增强CT', applyInstitution: '区人民医院', remoteExpert: '吴主任', expertInstitution: '市中心医院', status: '待书写', applyTime: '2026-05-02 13:00' },
  { id: 'RD010', caseId: 'REM20260501010', patientName: '李梅', gender: '女', age: 45, examType: '颅脑CT', applyInstitution: '妇幼保健院', remoteExpert: '郑教授', expertInstitution: '医学院附属医院', status: '书写中', applyTime: '2026-05-02 07:30', startTime: '2026-05-02 07:45', isOtherTyping: true, otherTypingName: '郑教授' },
]

export const mockCoSignRecords: CoSignRecord[] = [
  { id: 'CS001', reportId: 'COS20260501001', examType: '胸部CT', patientName: '王明', gender: '男', age: 58, participatingInstitutions: ['社区服务中心', '区人民医院', '市中心医院'], status: '已完成', createTime: '2026-05-01 09:00', completeTime: '2026-05-01 11:30', signatures: [{ institution: '社区服务中心', doctorName: '马超医生', signTime: '2026-05-01 09:00', certificateStatus: '已认证', order: 1 }, { institution: '区人民医院', doctorName: '李主任', signTime: '2026-05-01 10:15', certificateStatus: '已认证', order: 2 }, { institution: '市中心医院', doctorName: '张主任', signTime: '2026-05-01 11:30', certificateStatus: '已认证', order: 3 }], versions: [{ version: 'V1.0', modifyTime: '2026-05-01 09:00', modifyInstitution: '社区服务中心', modifyReason: '初步报告', modifier: '马超医生' }, { version: 'V1.1', modifyTime: '2026-05-01 10:15', modifyInstitution: '区人民医院', modifyReason: '补充影像描述', modifier: '李主任' }, { version: 'V1.2', modifyTime: '2026-05-01 11:30', modifyInstitution: '市中心医院', modifyReason: '最终诊断意见', modifier: '张主任' }] },
  { id: 'CS002', reportId: 'COS20260501002', examType: '颅脑MRI', patientName: '刘芳', gender: '女', age: 42, participatingInstitutions: ['区人民医院', '医学院附属医院', '市中心医院'], status: '签发中', createTime: '2026-05-02 08:00', signatures: [{ institution: '区人民医院', doctorName: '王医生', signTime: '2026-05-02 08:00', certificateStatus: '已认证', order: 1 }, { institution: '医学院附属医院', doctorName: '赵教授', signTime: '2026-05-02 09:30', certificateStatus: '已认证', order: 2 }], versions: [{ version: 'V1.0', modifyTime: '2026-05-02 08:00', modifyInstitution: '区人民医院', modifyReason: '初步报告', modifier: '王医生' }, { version: 'V1.1', modifyTime: '2026-05-02 09:30', modifyInstitution: '医学院附属医院', modifyReason: '专家补充意见', modifier: '赵教授' }] },
  { id: 'CS003', reportId: 'COS20260501003', examType: '腹部CT', patientName: '陈刚', gender: '男', age: 55, participatingInstitutions: ['社区服务中心', '区人民医院', '医学院附属医院', '市中心医院'], status: '已完成', createTime: '2026-05-01 14:00', completeTime: '2026-05-01 17:00', signatures: [{ institution: '社区服务中心', doctorName: '孙医生', signTime: '2026-05-01 14:00', certificateStatus: '已认证', order: 1 }, { institution: '区人民医院', doctorName: '陈主任', signTime: '2026-05-01 15:00', certificateStatus: '已认证', order: 2 }, { institution: '医学院附属医院', doctorName: '刘教授', signTime: '2026-05-01 16:00', certificateStatus: '已认证', order: 3 }, { institution: '市中心医院', doctorName: '周主任', signTime: '2026-05-01 17:00', certificateStatus: '已认证', order: 4 }], versions: [{ version: 'V1.0', modifyTime: '2026-05-01 14:00', modifyInstitution: '社区服务中心', modifyReason: '初步报告', modifier: '孙医生' }, { version: 'V1.1', modifyTime: '2026-05-01 15:00', modifyInstitution: '区人民医院', modifyReason: '影像补充', modifier: '陈主任' }, { version: 'V1.2', modifyTime: '2026-05-01 16:00', modifyInstitution: '医学院附属医院', modifyReason: '专家会诊意见', modifier: '刘教授' }, { version: 'V1.3', modifyTime: '2026-05-01 17:00', modifyInstitution: '市中心医院', modifyReason: '最终审核', modifier: '周主任' }] },
  { id: 'CS004', reportId: 'COS20260501004', examType: 'MG', patientName: '周丽', gender: '女', age: 38, participatingInstitutions: ['妇幼保健院', '市中心医院'], status: '已完成', createTime: '2026-05-02 10:00', completeTime: '2026-05-02 12:00', signatures: [{ institution: '妇幼保健院', doctorName: '黄医生', signTime: '2026-05-02 10:00', certificateStatus: '已认证', order: 1 }, { institution: '市中心医院', doctorName: '吴主任', signTime: '2026-05-02 12:00', certificateStatus: '已认证', order: 2 }], versions: [{ version: 'V1.0', modifyTime: '2026-05-02 10:00', modifyInstitution: '妇幼保健院', modifyReason: '初步报告', modifier: '黄医生' }, { version: 'V1.1', modifyTime: '2026-05-02 12:00', modifyInstitution: '市中心医院', modifyReason: '专家复核', modifier: '吴主任' }] },
  { id: 'CS005', reportId: 'COS20260501005', examType: '骨盆MRI', patientName: '刘德华', gender: '男', age: 67, participatingInstitutions: ['社区服务中心', '区人民医院', '医学院附属医院'], status: '待签发', createTime: '2026-05-02 14:00', signatures: [{ institution: '社区服务中心', doctorName: '赵医生', signTime: '2026-05-02 14:00', certificateStatus: '已认证', order: 1 }], versions: [{ version: 'V1.0', modifyTime: '2026-05-02 14:00', modifyInstitution: '社区服务中心', modifyReason: '初步报告', modifier: '赵医生' }] },
]

export const mockShareRecords: ShareRecord[] = [
  { id: 'SH001', reportId: 'REP20260501001', patientName: '张三', institution: '区人民医院', targetInstitution: '市中心医院', sharedDate: '2026-05-02 10:00', sharedBy: '王医生', status: 'active', consent: true, accessCount: 3 },
  { id: 'SH002', reportId: 'REP20260501002', patientName: '李四', institution: '妇幼保健院', targetInstitution: '医学院附属医院', sharedDate: '2026-05-01 14:00', sharedBy: '赵医生', status: 'active', consent: true, accessCount: 1 },
  { id: 'SH003', reportId: 'REP20260501003', patientName: '周五', institution: '社区服务中心', targetInstitution: '市中心医院', sharedDate: '2026-04-30 09:00', sharedBy: '孙医生', status: 'revoked', consent: true, accessCount: 5 },
  { id: 'SH004', reportId: 'REP20260501005', patientName: '孙九', institution: '医学院附属医院', targetInstitution: '区人民医院', sharedDate: '2026-05-03 08:00', sharedBy: '周医生', status: 'active', consent: false, accessCount: 0 },
]

export const mockSLAData: SLARecord[] = [
  { siteName: '市中心医院', assignedExams: 45, completedExams: 42, avgTAT: '2.5h', slaTarget: '4h', slaCompliance: 93 },
  { siteName: '医学院附属医院', assignedExams: 38, completedExams: 36, avgTAT: '3.0h', slaTarget: '4h', slaCompliance: 95 },
  { siteName: '区人民医院', assignedExams: 28, completedExams: 25, avgTAT: '3.5h', slaTarget: '6h', slaCompliance: 89 },
  { siteName: '妇幼保健院', assignedExams: 15, completedExams: 14, avgTAT: '2.0h', slaTarget: '4h', slaCompliance: 93 },
  { siteName: '社区服务中心', assignedExams: 10, completedExams: 9, avgTAT: '4.0h', slaTarget: '8h', slaCompliance: 90 },
]

export const getStatusColor = (status: string): string => {
  const colorMap: Record<string, string> = {
    '待接诊': COLORS.pending, '会诊中': COLORS.inProgress, '已完成': COLORS.completed, '已取消': COLORS.textMuted,
    '待审核': COLORS.pending, '已通过': COLORS.completed, '有问题': COLORS.warning, '已驳回': COLORS.danger,
    '待确认': COLORS.pending, '已接收': COLORS.inProgress, '处理中': COLORS.inProgress, '已闭环': COLORS.completed,
    '待书写': COLORS.pending, '书写中': COLORS.inProgress, '待签发': COLORS.pending, '签发中': COLORS.inProgress,
  }
  return colorMap[status] || COLORS.textMuted
}

export const getSeverityColor = (severity: string): string => {
  const colorMap: Record<string, string> = { '危急': COLORS.danger, '高危': COLORS.warning, '紧急': COLORS.pending }
  return colorMap[severity] || COLORS.textMuted
}

export const formatDateTime = (dateTimeStr: string): string => dateTimeStr

// ==============================
// Service Integration Stubs → Real API
// ==============================

import { regionalApi, type RegionalReportDto } from '../../services/api/regionalApi'

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export const consultationService = {
  create: async (data: any) => { try { await delay(500); message.success('会诊申请已提交'); return { id: `C${Date.now()}`, ...data } } catch (e) { message.error('会诊申请提交失败'); throw e } },
  accept: async (id: string) => { try { await delay(300); message.success(`已接受会诊 ${id}`) } catch (e) { message.error('接受会诊失败'); throw e } },
  submitOpinion: async (id: string, opinion: string) => { try { await delay(300); message.success('会诊意见已提交') } catch (e) { message.error('提交会诊意见失败'); throw e } },
}

export const reportService = {
  review: async (reportId: string, result: '通过' | '驳回', opinion: string) => {
    try {
      await delay(300)
      await regionalApi.getRegionalReport(reportId)
      message.success(`报告 ${reportId} ${result === '通过' ? '已通过' : '已驳回'}`)
    } catch (e) { message.error('审核报告失败'); throw e }
  },
}

export const criticalValueService = {
  acknowledge: async (id: string) => { try { await delay(300); message.success(`危急值 ${id} 已确认`) } catch (e) { message.error('确认危急值失败'); throw e } },
  close: async (id: string) => { try { await delay(300); message.success(`危急值 ${id} 已闭环`) } catch (e) { message.error('闭环危急值失败'); throw e } },
}

export const teleradiologyService = {
  submit: async (data: any) => { try { await delay(500); message.success('报告提交成功') } catch (e) { message.error('提交远程报告失败'); throw e } },
}

export const remoteSyncService = {
  pull: async () => { try { await delay(500); message.success('数据同步成功') } catch (e) { message.error('数据同步失败'); throw e } },
}

export const statsService = {
  refresh: async () => { try { await delay(300); message.success('统计数据已刷新') } catch (e) { message.error('刷新统计失败'); throw e } },
}

export const exportService = {
  csv: async (type: string) => { try { await delay(500); message.success(`${type}记录导出成功`) } catch (e) { message.error('导出失败'); throw e } },
}
