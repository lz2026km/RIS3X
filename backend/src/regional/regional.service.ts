import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

// ── [G005-P1] 在用孤儿补齐: 医联体影像/报告页 DTO 种子数据 ──
// 说明: AccessApplication / ConsultationRequest / AccessRecord / Institution /
//       CrossInstitutionStudy / DocumentRegistryEntry / AuditTrailEntry /
//       RegionalConsultation / RegionalReportRecord / CriticalValueReport /
//       RemoteDiagnosis / CoSignRecord / RegionalInstitution 均无对应 Prisma 模型,
//       采用内存 seed(风格与 regionalHandlers.ts 一致), 标注 demo 级数据。

export interface AccessApplication {
  id: string; patientName: string; patientId: string; hospital: string; modality: string
  studyDate: string; reason: string; status: 'pending' | 'approved' | 'rejected'; applyDate: string
}

export interface ConsultationRequest {
  id: string; patientName: string; hospital: string; diagnosis: string
  priority: 'normal' | 'urgent' | 'critical'; status: 'open' | 'in-progress' | 'completed'
  createDate: string; expert?: string
}

export interface AccessRecord {
  id: string; patientName: string; patientId: string; studyType: string; hospital: string
  accessTime: string; accessor: string; purpose: string
}

export interface Institution {
  id: string; name: string; aeTitle: string; address: string; status: 'online' | 'offline' | 'busy'
}

export interface CrossInstitutionStudy {
  id: string; patientId: string; patientName: string; studyUid: string; studyDescription: string
  modality: string; institution: string; date: string; status: string
}

export interface DocumentRegistryEntry {
  id: string; patientId: string; patientName: string; studyUid: string; studyDescription: string
  modality: string; institution: string; date: string; status: string
}

export interface AuditTrailEntry {
  id: string; patientId: string; action: string; institution: string; user: string
  time: string; details: string
}

export interface RegionalConsultation {
  id: string; caseId: string; patientName: string; gender: string; age: number
  institution: string; modality: string; examItem: string; applyReason: string
  status: '待接诊' | '会诊中' | '已完成' | '已取消'; applyTime: string
  acceptTime?: string; completeTime?: string; applyDoctor: string; acceptDoctor?: string
  consultationOpinion?: string; priority: '普通' | '紧急' | '立即'
}

export interface RegionalReportRecord {
  id: string; reportId: string; institution: string; patientName: string; gender: string
  age: number; modality: string; examItem: string; reportTime: string; reportDoctor: string
  status: '待审核' | '已通过' | '有问题' | '已驳回'; qualityScore: number
  qualityIssues: string[]; reviewOpinion?: string; reviewDoctor?: string; reviewTime?: string
}

export interface CriticalValueReport {
  id: string; patientName: string; gender: string; age: number; institution: string
  modality: string; examItem: string; criticalFinding: string
  severity: '危急' | '高危' | '紧急'; reportedTime: string; reportedDoctor: string
  status: '待确认' | '已接收' | '处理中' | '已闭环'
  receiveTime?: string; receiveDoctor?: string; handleTime?: string
  handleDoctor?: string; closeTime?: string
}

export interface RemoteDiagnosis {
  id: string; caseId: string; patientName: string; gender: string; age: number
  examType: string; applyInstitution: string; remoteExpert: string; expertInstitution: string
  status: '待书写' | '书写中' | '待审核' | '已完成'; applyTime: string
  startTime?: string; completeTime?: string; reportContent?: string
  isOtherTyping?: boolean; otherTypingName?: string
}

export interface CoSignRecord {
  id: string; reportId: string; examType: string; patientName: string; gender: string
  age: number; participatingInstitutions: string[]
  status: '待签发' | '签发中' | '已完成'; createTime: string; completeTime?: string
  signatures: Array<{ institution: string; doctorName: string; signTime: string; certificateStatus: string; order: number }>
  versions: Array<{ version: string; modifyTime: string; modifyInstitution: string; modifyReason: string; modifier: string }>
}

export interface RegionalInstitution {
  id: string; institutionId: string; institutionName: string; modality: string
  examCount: number; positiveCount: number; positiveRate: number
  avgReportTime: number; qualifiedRate: number; period: string
}

const SEED_ACCESS_APPLICATIONS: AccessApplication[] = [
  { id: 'APP-202607-001', patientName: '张伟', patientId: 'P000023', hospital: '东华区第一医院', modality: 'CT', studyDate: '2026-07-06', reason: '肺癌术后复查,申请调阅外院基线片', status: 'pending', applyDate: '2026-07-08' },
  { id: 'APP-202607-002', patientName: '王芳', patientId: 'P000047', hospital: '西城区人民医院', modality: 'MRI', studyDate: '2026-07-05', reason: '腰椎间盘突出会诊,需要本院 MRI 原始图像', status: 'approved', applyDate: '2026-07-07' },
  { id: 'APP-202607-003', patientName: '李强', patientId: 'P000088', hospital: '高新区中心医院', modality: 'DR', studyDate: '2026-07-04', reason: '体检发现肺结节,调阅历史胸片对比', status: 'rejected', applyDate: '2026-07-06' },
  { id: 'APP-202607-004', patientName: '刘敏', patientId: 'P000112', hospital: '东华区第一医院', modality: 'US', studyDate: '2026-07-03', reason: '甲状腺结节随访,调阅既往超声报告', status: 'pending', applyDate: '2026-07-05' },
  { id: 'APP-202607-005', patientName: '陈杰', patientId: 'P000156', hospital: '南港区第二医院', modality: 'CT', studyDate: '2026-07-02', reason: '腹部增强 CT 双院区图像融合分析', status: 'approved', applyDate: '2026-07-04' },
]

const SEED_CONSULTATION_REQUESTS: ConsultationRequest[] = [
  { id: 'CSL-202607-001', patientName: '赵霞', hospital: '东华区第一医院', diagnosis: '颅内占位性质待定', priority: 'urgent', status: 'in-progress', createDate: '2026-07-08', expert: '王建华 主任医师' },
  { id: 'CSL-202607-002', patientName: '孙浩', hospital: '西城区人民医院', diagnosis: '胰腺占位', priority: 'critical', status: 'open', createDate: '2026-07-08' },
  { id: 'CSL-202607-003', patientName: '周婷', hospital: '高新区中心医院', diagnosis: '肺结节随访策略咨询', priority: 'normal', status: 'completed', createDate: '2026-07-06', expert: '张明远 主任医师' },
  { id: 'CSL-202607-004', patientName: '吴刚', hospital: '南港区第二医院', diagnosis: '膝关节韧带损伤', priority: 'normal', status: 'completed', createDate: '2026-07-05', expert: '李慧敏 副主任医师' },
]

const SEED_ACCESS_RECORDS: AccessRecord[] = [
  { id: 'ARC-001', patientName: '张伟', patientId: 'P000023', studyType: 'CT 胸部平扫', hospital: '东华区第一医院', accessTime: '2026-07-08 09:32', accessor: '王建华', purpose: '跨院调阅基线对比' },
  { id: 'ARC-002', patientName: '王芳', patientId: 'P000047', studyType: 'MRI 腰椎', hospital: '西城区人民医院', accessTime: '2026-07-08 10:15', accessor: '李慧敏', purpose: '远程会诊' },
  { id: 'ARC-003', patientName: '刘敏', patientId: 'P000112', studyType: 'US 甲状腺', hospital: '东华区第一医院', accessTime: '2026-07-07 14:03', accessor: '张明远', purpose: '随访对比' },
  { id: 'ARC-004', patientName: '陈杰', patientId: 'P000156', studyType: 'CT 腹部增强', hospital: '南港区第二医院', accessTime: '2026-07-07 16:48', accessor: '赵雪琴', purpose: '多院区融合分析' },
  { id: 'ARC-005', patientName: '周婷', patientId: 'P000199', studyType: 'DR 胸部', hospital: '高新区中心医院', accessTime: '2026-07-06 11:20', accessor: '王建华', purpose: '医保核查' },
]

const SEED_INSTITUTIONS: Institution[] = [
  { id: 'INST-001', name: '东华区第一医院', aeTitle: 'G005-DH01', address: '东华区解放路 88 号', status: 'online' },
  { id: 'INST-002', name: '西城区人民医院', aeTitle: 'G005-XC01', address: '西城区人民大道 210 号', status: 'online' },
  { id: 'INST-003', name: '高新区中心医院', aeTitle: 'G005-GX01', address: '高新区科园路 66 号', status: 'busy' },
  { id: 'INST-004', name: '南港区第二医院', aeTitle: 'G005-NG01', address: '南港区港城路 12 号', status: 'offline' },
]

const SEED_CROSS_STUDIES: CrossInstitutionStudy[] = [
  { id: 'CS-001', patientId: 'P000023', patientName: '张伟', studyUid: '1.2.826.0.1.3680043.8.498.1001', studyDescription: 'CT 胸部平扫', modality: 'CT', institution: '东华区第一医院', date: '2025-03-12', status: 'COMPLETE' },
  { id: 'CS-002', patientId: 'P000023', patientName: '张伟', studyUid: '1.2.826.0.1.3680043.8.498.1002', studyDescription: 'CT 胸部增强', modality: 'CT', institution: '西城区人民医院', date: '2026-06-28', status: 'COMPLETE' },
  { id: 'CS-003', patientId: 'P000047', patientName: '王芳', studyUid: '1.2.826.0.1.3680043.8.498.1003', studyDescription: 'MRI 腰椎平扫', modality: 'MRI', institution: '西城区人民医院', date: '2026-05-20', status: 'COMPLETE' },
  { id: 'CS-004', patientId: 'P000088', patientName: '李强', studyUid: '1.2.826.0.1.3680043.8.498.1004', studyDescription: 'DR 胸部正位', modality: 'DR', institution: '高新区中心医院', date: '2026-04-02', status: 'COMPLETE' },
]

const SEED_DOCUMENT_REGISTRY: DocumentRegistryEntry[] = [
  { id: 'DOC-001', patientId: 'P000023', patientName: '张伟', studyUid: '1.2.826.0.1.3680043.8.498.1001', studyDescription: 'CT 胸部平扫', modality: 'CT', institution: '东华区第一医院', date: '2025-03-12', status: 'REGISTERED' },
  { id: 'DOC-002', patientId: 'P000047', patientName: '王芳', studyUid: '1.2.826.0.1.3680043.8.498.1003', studyDescription: 'MRI 腰椎平扫', modality: 'MRI', institution: '西城区人民医院', date: '2026-05-20', status: 'REGISTERED' },
  { id: 'DOC-003', patientId: 'P000156', patientName: '陈杰', studyUid: '1.2.826.0.1.3680043.8.498.1005', studyDescription: 'CT 腹部增强', modality: 'CT', institution: '南港区第二医院', date: '2026-07-02', status: 'SYNCED' },
  { id: 'DOC-004', patientId: 'P000199', patientName: '周婷', studyUid: '1.2.826.0.1.3680043.8.498.1006', studyDescription: 'DR 胸部正位', modality: 'DR', institution: '高新区中心医院', date: '2026-06-15', status: 'PENDING' },
]

const SEED_AUDIT_TRAIL: AuditTrailEntry[] = [
  { id: 'AUD-001', patientId: 'P000023', action: 'CROSS_QUERY', institution: '东华区第一医院', user: '王建华', time: '2026-07-08 09:32:11', details: '跨院检索: 患者 张伟, 检索条件 姓名+出生日期' },
  { id: 'AUD-002', patientId: 'P000047', action: 'PIX_QUERY', institution: '西城区人民医院', user: '李慧敏', time: '2026-07-08 10:15:42', details: 'PIX 患者标识映射: 内部ID P000047 → 外部 20260518003' },
  { id: 'AUD-003', patientId: 'P000112', action: 'DOCUMENT_RETRIEVE', institution: '东华区第一医院', user: '张明远', time: '2026-07-07 14:03:55', details: '调阅文档: DOC-001, 原始 DICOM 全部系列' },
  { id: 'AUD-004', patientId: 'P000156', action: 'CONSULT_INVITE', institution: '南港区第二医院', user: '赵雪琴', time: '2026-07-07 16:48:30', details: '发起远程会诊邀请: 腹部增强 CT 融合分析' },
  { id: 'AUD-005', patientId: 'P000199', action: 'CROSS_QUERY', institution: '高新区中心医院', user: '王建华', time: '2026-07-06 11:20:07', details: '跨院检索: 患者 周婷, 检索条件 门诊号 GX2026-0417' },
]

const SEED_REGIONAL_CONSULTATIONS: RegionalConsultation[] = [
  { id: 'RC-202607-001', caseId: 'CASE-20260701', patientName: '赵霞', gender: '女', age: 56, institution: '东华区第一医院', modality: 'MRI', examItem: '头颅 MRI 增强', applyReason: '颅内占位性质待定,申请院级专家会诊', status: '会诊中', applyTime: '2026-07-08 08:30', acceptTime: '2026-07-08 09:10', applyDoctor: '刘敏', acceptDoctor: '王建华', priority: '紧急' },
  { id: 'RC-202607-002', caseId: 'CASE-20260702', patientName: '孙浩', gender: '男', age: 61, institution: '西城区人民医院', modality: 'CT', examItem: '腹部增强 CT', applyReason: '胰腺占位,申请多学科会诊', status: '待接诊', applyTime: '2026-07-08 09:45', applyDoctor: '陈杰', priority: '立即' },
  { id: 'RC-202607-003', caseId: 'CASE-20260703', patientName: '周婷', gender: '女', age: 43, institution: '高新区中心医院', modality: 'CT', examItem: '胸部高分辨率 CT', applyReason: '肺结节随访策略', status: '已完成', applyTime: '2026-07-06 14:20', acceptTime: '2026-07-06 15:00', completeTime: '2026-07-07 10:30', applyDoctor: '吴刚', acceptDoctor: '张明远', consultationOpinion: '建议 6 个月后复查,结节无明显变化', priority: '普通' },
  { id: 'RC-202607-004', caseId: 'CASE-20260704', patientName: '吴刚', gender: '男', age: 38, institution: '南港区第二医院', modality: 'MRI', examItem: '膝关节 MRI', applyReason: '前交叉韧带损伤程度评估', status: '已完成', applyTime: '2026-07-05 11:00', acceptTime: '2026-07-05 11:40', completeTime: '2026-07-05 16:20', applyDoctor: '孙浩', acceptDoctor: '李慧敏', consultationOpinion: 'ACL 完全撕裂,建议关节镜手术', priority: '普通' },
]

const SEED_REPORT_RECORDS: RegionalReportRecord[] = [
  { id: 'RR-001', reportId: 'RP20260708001', institution: '东华区第一医院', patientName: '张伟', gender: '男', age: 58, modality: 'CT', examItem: '胸部平扫', reportTime: '2026-07-08 09:20', reportDoctor: '刘敏', status: '待审核', qualityScore: 92, qualityIssues: [] },
  { id: 'RR-002', reportId: 'RP20260707005', institution: '西城区人民医院', patientName: '王芳', gender: '女', age: 45, modality: 'MRI', examItem: '腰椎平扫', reportTime: '2026-07-07 15:40', reportDoctor: '陈杰', status: '已通过', qualityScore: 96, qualityIssues: [], reviewOpinion: '诊断明确,描述规范', reviewDoctor: '王建华', reviewTime: '2026-07-07 17:02' },
  { id: 'RR-003', reportId: 'RP20260706002', institution: '高新区中心医院', patientName: '李强', gender: '男', age: 52, modality: 'DR', examItem: '胸部正位', reportTime: '2026-07-06 10:12', reportDoctor: '孙浩', status: '有问题', qualityScore: 71, qualityIssues: ['影像位置描述不全', '未提及心影形态'], reviewOpinion: '请补充心影及肋膈角描述', reviewDoctor: '李慧敏', reviewTime: '2026-07-06 11:30' },
  { id: 'RR-004', reportId: 'RP20260705003', institution: '南港区第二医院', patientName: '刘敏', gender: '女', age: 49, modality: 'US', examItem: '甲状腺彩超', reportTime: '2026-07-05 16:05', reportDoctor: '赵雪琴', status: '已驳回', qualityScore: 58, qualityIssues: ['未记录甲状腺体积测量', '结论与描述不一致'], reviewOpinion: '结论与描述矛盾,请修改后重提', reviewDoctor: '张明远', reviewTime: '2026-07-05 17:20' },
]

const SEED_CRITICAL_VALUES: CriticalValueReport[] = [
  { id: 'CV-001', patientName: '孙浩', gender: '男', age: 61, institution: '西城区人民医院', modality: 'CT', examItem: '腹部增强 CT', criticalFinding: '胰头区可见 4.2×3.5cm 肿块,考虑恶性占位可能', severity: '危急', reportedTime: '2026-07-08 09:50', reportedDoctor: '陈杰', status: '待确认' },
  { id: 'CV-002', patientName: '赵霞', gender: '女', age: 56, institution: '东华区第一医院', modality: 'MRI', examItem: '头颅 MRI 增强', criticalFinding: '右侧基底节区可见急性脑出血灶', severity: '危急', reportedTime: '2026-07-08 08:35', reportedDoctor: '刘敏', status: '已接收', receiveTime: '2026-07-08 08:47', receiveDoctor: '值班医生' },
  { id: 'CV-003', patientName: '周婷', gender: '女', age: 43, institution: '高新区中心医院', modality: 'CT', examItem: '胸部 HRCT', criticalFinding: '双肺弥漫性磨玻璃影,考虑重症肺炎可能', severity: '高危', reportedTime: '2026-07-06 15:10', reportedDoctor: '吴刚', status: '处理中', receiveTime: '2026-07-06 15:22', receiveDoctor: '呼吸科会诊', handleTime: '2026-07-06 16:00', handleDoctor: '张明远' },
  { id: 'CV-004', patientName: '陈杰', gender: '男', age: 66, institution: '南港区第二医院', modality: 'CT', examItem: '头颅平扫', criticalFinding: '左侧大脑中动脉密度增高,急性缺血性卒中征象', severity: '危急', reportedTime: '2026-07-05 08:20', reportedDoctor: '赵雪琴', status: '已闭环', receiveTime: '2026-07-05 08:30', receiveDoctor: '神经内科', handleTime: '2026-07-05 09:15', handleDoctor: '介入科', closeTime: '2026-07-05 14:00' },
]

const SEED_REMOTE_DIAGNOSES: RemoteDiagnosis[] = [
  { id: 'RD-001', caseId: 'CASE-20260701', patientName: '赵霞', gender: '女', age: 56, examType: '头颅 MRI', applyInstitution: '东华区第一医院', remoteExpert: '王建华', expertInstitution: '市中心医院', status: '书写中', applyTime: '2026-07-08 08:30', startTime: '2026-07-08 09:10' },
  { id: 'RD-002', caseId: 'CASE-20260702', patientName: '孙浩', gender: '男', age: 61, examType: '腹部增强 CT', applyInstitution: '西城区人民医院', remoteExpert: '张明远', expertInstitution: '市肿瘤医院', status: '待书写', applyTime: '2026-07-08 09:45' },
  { id: 'RD-003', caseId: 'CASE-20260703', patientName: '周婷', gender: '女', age: 43, examType: '胸部 HRCT', applyInstitution: '高新区中心医院', remoteExpert: '李慧敏', expertInstitution: '市中心医院', status: '待审核', applyTime: '2026-07-06 14:20', startTime: '2026-07-06 15:00', completeTime: '2026-07-07 09:30', reportContent: '双肺多发磨玻璃影,右肺上叶 6mm 结节,建议 6 个月复查。' },
  { id: 'RD-004', caseId: 'CASE-20260704', patientName: '吴刚', gender: '男', age: 38, examType: '膝关节 MRI', applyInstitution: '南港区第二医院', remoteExpert: '赵雪琴', expertInstitution: '市骨科医院', status: '已完成', applyTime: '2026-07-05 11:00', startTime: '2026-07-05 11:40', completeTime: '2026-07-05 16:20', reportContent: '前交叉韧带完全撕裂,内侧半月板后角损伤,建议手术。' },
]

const SEED_CO_SIGN_RECORDS: CoSignRecord[] = [
  {
    id: 'CSG-001', reportId: 'RP20260701001', examType: 'CT 腹部增强', patientName: '陈杰', gender: '男', age: 66,
    participatingInstitutions: ['东华区第一医院', '南港区第二医院'], status: '签发中', createTime: '2026-07-01 10:00', completeTime: '2026-07-02 15:30',
    signatures: [
      { institution: '东华区第一医院', doctorName: '张明远', signTime: '2026-07-01 10:20', certificateStatus: '有效', order: 1 },
      { institution: '南港区第二医院', doctorName: '赵雪琴', signTime: '2026-07-02 15:30', certificateStatus: '有效', order: 2 },
    ],
    versions: [
      { version: 'v1.0', modifyTime: '2026-07-01 10:00', modifyInstitution: '东华区第一医院', modifyReason: '初始版本', modifier: '张明远' },
      { version: 'v1.1', modifyTime: '2026-07-02 14:10', modifyInstitution: '南港区第二医院', modifyReason: '补充增强期相描述', modifier: '赵雪琴' },
    ],
  },
  {
    id: 'CSG-002', reportId: 'RP20260705002', examType: 'MRI 头颅增强', patientName: '赵霞', gender: '女', age: 56,
    participatingInstitutions: ['东华区第一医院', '市中心医院'], status: '待签发', createTime: '2026-07-05 09:00',
    signatures: [],
    versions: [{ version: 'v1.0', modifyTime: '2026-07-05 09:00', modifyInstitution: '东华区第一医院', modifyReason: '初始版本', modifier: '刘敏' }],
  },
]

const SEED_REGIONAL_INSTITUTIONS: RegionalInstitution[] = [
  { id: 'RI-001', institutionId: 'INST-001', institutionName: '东华区第一医院', modality: 'CT', examCount: 1284, positiveCount: 389, positiveRate: 30.3, avgReportTime: 1.8, qualifiedRate: 96.2, period: '2026-06' },
  { id: 'RI-002', institutionId: 'INST-002', institutionName: '西城区人民医院', modality: 'MRI', examCount: 856, positiveCount: 302, positiveRate: 35.3, avgReportTime: 2.4, qualifiedRate: 94.8, period: '2026-06' },
  { id: 'RI-003', institutionId: 'INST-003', institutionName: '高新区中心医院', modality: 'DR', examCount: 1932, positiveCount: 412, positiveRate: 21.3, avgReportTime: 1.2, qualifiedRate: 97.5, period: '2026-06' },
  { id: 'RI-004', institutionId: 'INST-004', institutionName: '南港区第二医院', modality: 'US', examCount: 1021, positiveCount: 356, positiveRate: 34.9, avgReportTime: 1.5, qualifiedRate: 93.1, period: '2026-06' },
  { id: 'RI-005', institutionId: 'INST-001', institutionName: '东华区第一医院', modality: 'MRI', examCount: 645, positiveCount: 221, positiveRate: 34.3, avgReportTime: 2.1, qualifiedRate: 95.4, period: '2026-06' },
]

@Injectable()
export class RegionalService {
  constructor(private readonly prisma: PrismaService) {}

  // ── 原有用例 (Prisma) ──

  async listRegionalImaging() {
    const data = await this.prisma.exam.findMany({ orderBy: { createdAt: 'desc' }, take: 100 })
    return { data }
  }

  async getRegionalImaging(id: string) {
    const data = await this.prisma.exam.findUnique({ where: { id } })
    return { data: data ? [data] : [] }
  }

  async listRegionalReports() {
    const data = await this.prisma.report.findMany({ orderBy: { createdAt: 'desc' }, take: 100 })
    return { data }
  }

  async getRegionalReport(id: string) {
    const data = await this.prisma.report.findUnique({ where: { id } })
    return { data: data ? [data] : [] }
  }

  async getDepartmentSchedule() {
    const data = await this.prisma.appointment.findMany({ orderBy: { scheduledAt: 'asc' }, take: 50 })
    return { data }
  }

  async updateSchedule(id: string, body: Record<string, unknown>) {
    const data = await this.prisma.appointment.update({ where: { id }, data: body })
    return { data: [data] }
  }

  async listDepartments() {
    const data = await this.prisma.user.findMany({ select: { department: true }, distinct: ['department'] })
    return { data: data.filter(d => d.department) }
  }

  async listMedicalAlliance() {
    const data = await this.prisma.systemConfig.findMany({ where: { key: { startsWith: 'medical_alliance_' } } })
    return { data }
  }

  async getFhirStatus() {
    const data = await this.prisma.systemConfig.findMany({ where: { key: { startsWith: 'fhir_' } } })
    return { data }
  }

  async getIheStatus() {
    const data = await this.prisma.systemConfig.findMany({ where: { key: { startsWith: 'ihe_' } } })
    return { data }
  }

  async getMllpStatus() {
    const data = await this.prisma.systemConfig.findMany({ where: { key: { startsWith: 'mllp_' } } })
    return { data }
  }

  // ── [G005-P1] 医联体影像页在用孤儿 (seed) ──

  async listAccessApplications() {
    return { success: true, data: SEED_ACCESS_APPLICATIONS }
  }

  async createAccessApplication(body: Partial<AccessApplication>) {
    const item: AccessApplication = {
      id: `APP-${Date.now()}`,
      patientName: body.patientName ?? '',
      patientId: body.patientId ?? '',
      hospital: body.hospital ?? '',
      modality: body.modality ?? 'CT',
      studyDate: body.studyDate ?? new Date().toISOString().slice(0, 10),
      reason: body.reason ?? '',
      status: 'pending',
      applyDate: new Date().toISOString().slice(0, 10),
    }
    SEED_ACCESS_APPLICATIONS.unshift(item)
    return { success: true, data: item }
  }

  async approveAccessApplication(id: string) {
    const item = SEED_ACCESS_APPLICATIONS.find(a => a.id === id)
    if (item) item.status = 'approved'
    return { success: true, data: item ?? null }
  }

  async rejectAccessApplication(id: string) {
    const item = SEED_ACCESS_APPLICATIONS.find(a => a.id === id)
    if (item) item.status = 'rejected'
    return { success: true, data: item ?? null }
  }

  async listConsultationRequests() {
    return { success: true, data: SEED_CONSULTATION_REQUESTS }
  }

  async createConsultationRequest(body: Partial<ConsultationRequest>) {
    const item: ConsultationRequest = {
      id: `CSL-${Date.now()}`,
      patientName: body.patientName ?? '',
      hospital: body.hospital ?? '',
      diagnosis: body.diagnosis ?? '',
      priority: body.priority ?? 'normal',
      status: 'open',
      createDate: new Date().toISOString().slice(0, 10),
    }
    SEED_CONSULTATION_REQUESTS.unshift(item)
    return { success: true, data: item }
  }

  async listAccessRecords() {
    return { success: true, data: SEED_ACCESS_RECORDS }
  }

  async listInstitutions() {
    return { success: true, data: SEED_INSTITUTIONS }
  }

  async crossInstitutionQuery(query: { institutionId?: string; queryType?: string; queryValue?: string }) {
    const value = (query.queryValue ?? '').toLowerCase()
    const institution = query.institutionId ?? ''
    const data = SEED_CROSS_STUDIES.filter(s =>
      (!institution || s.institution === SEED_INSTITUTIONS.find(i => i.id === institution)?.name) &&
      (!value || s.patientName.toLowerCase().includes(value) || s.patientId.toLowerCase().includes(value) || s.studyDescription.toLowerCase().includes(value)),
    )
    return { success: true, data }
  }

  async listDocumentRegistry() {
    return { success: true, data: SEED_DOCUMENT_REGISTRY }
  }

  async pixQuery(patientId: string) {
    const local = SEED_CROSS_STUDIES.find(s => s.patientId === patientId)?.studyUid ?? patientId
    const remote = `PIX-EXT-${patientId.replace(/[^0-9]/g, '').slice(0, 6) || '000001'}`
    return { success: true, data: { local, remote } }
  }

  async listAuditTrail() {
    return { success: true, data: SEED_AUDIT_TRAIL }
  }

  // ── [G005-P1] 医联体报告页在用孤儿 (seed) ──

  async listRegionalInstitutions() {
    return { success: true, data: SEED_REGIONAL_INSTITUTIONS }
  }

  async listConsultations() {
    return { success: true, data: SEED_REGIONAL_CONSULTATIONS }
  }

  async listReportRecords() {
    return { success: true, data: SEED_REPORT_RECORDS }
  }

  async listCriticalValues() {
    return { success: true, data: SEED_CRITICAL_VALUES }
  }

  async listRemoteDiagnoses() {
    return { success: true, data: SEED_REMOTE_DIAGNOSES }
  }

  async listCoSignRecords() {
    return { success: true, data: SEED_CO_SIGN_RECORDS }
  }
}
