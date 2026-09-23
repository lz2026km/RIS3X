/**
 * G005 RIS v3.0.5.1 - R3.DEFECT 缺陷库 Mock 数据
 */
import type {
  DefectCategory,
  DefectDetail,
  DefectAnalytics,
  DefectImportRecord,
  DefectTreeNode,
  DefectRemediation,
} from '../types/R3/R3.DEFECT';
import { QUALITY_DEFECTS, DEFECT_REMEDIATIONS } from './reportQualityMock';
import type { QualityDefect } from '../types/R3/R3.QUALITY';

const isoDaysAgo = (d: number) => new Date(Date.now() - d * 86400000).toISOString();

export const DEFECT_CATEGORIES: DefectCategory[] = [
  { code: 'DSC', name: '描述问题', nameEn: 'Description', description: '报告描述相关缺陷', descriptionEn: 'Description defects', color: '#3b82f6', icon: '📝', childCount: 6, totalCount: 415, level: 1, sortOrder: 1 },
  { code: 'TER', name: '术语问题', nameEn: 'Terminology', description: '医学术语使用问题', descriptionEn: 'Terminology issues', color: '#8b5cf6', icon: '📚', childCount: 4, totalCount: 285, level: 1, sortOrder: 2 },
  { code: 'FMT', name: '格式问题', nameEn: 'Format', description: '报告格式问题', descriptionEn: 'Format issues', color: '#f59e0b', icon: '📐', childCount: 4, totalCount: 466, level: 1, sortOrder: 3 },
  { code: 'LOG', name: '逻辑问题', nameEn: 'Logic', description: '报告中逻辑问题', descriptionEn: 'Logic issues', color: '#dc2626', icon: '🧠', childCount: 4, totalCount: 105, level: 1, sortOrder: 4 },
  { code: 'CRI', name: '危急值', nameEn: 'Critical', description: '危急值处理问题', descriptionEn: 'Critical value issues', color: '#7f1d1d', icon: '⚠️', childCount: 2, totalCount: 8, level: 1, sortOrder: 5 },
  { code: 'CMP', name: '完整性', nameEn: 'Completeness', description: '报告完整性问题', descriptionEn: 'Completeness issues', color: '#10b981', icon: '📋', childCount: 4, totalCount: 185, level: 1, sortOrder: 6 },
  { code: 'CON', name: '一致性', nameEn: 'Consistency', description: '图像报告一致性', descriptionEn: 'Image report consistency', color: '#0891b2', icon: '🔄', childCount: 1, totalCount: 12, level: 1, sortOrder: 7 },
  { code: 'IMG', name: '图像质量', nameEn: 'Image Quality', description: '图像质量相关', descriptionEn: 'Image quality issues', color: '#06b6d4', icon: '🖼️', childCount: 1, totalCount: 23, level: 1, sortOrder: 8 },
  { code: 'TIM', name: '时效', nameEn: 'Timeliness', description: '报告时效问题', descriptionEn: 'Timeliness issues', color: '#7c3aed', icon: '⏱️', childCount: 1, totalCount: 45, level: 1, sortOrder: 9 },
  { code: 'OTH', name: '其他', nameEn: 'Other', description: '其他缺陷', descriptionEn: 'Other defects', color: '#64748b', icon: '📦', childCount: 0, totalCount: 12, level: 1, sortOrder: 10 },
];

export const DEFECT_DETAILS: DefectDetail[] = QUALITY_DEFECTS.map((d: QualityDefect) => ({
  id: d.id, code: d.code, name: d.name, nameEn: d.nameEn ?? '', category: d.category, severity: d.severity,
  description: d.description, descriptionEn: d.descriptionEn, examples: d.examples, solution: d.solution, solutionEn: d.solutionEn,
  references: d.references ?? [], count: d.count, isActive: d.isActive, customDefect: d.customDefect,
  level: d.level, parentCode: d.parentId, tags: d.tags, triggerPattern: d.triggerPattern, exampleFix: d.exampleFix,
  createdBy: d.createdBy ?? 'system', createdAt: d.createdAt ?? isoDaysAgo(180), updatedAt: d.updatedAt ?? isoDaysAgo(30),
  sla: d.sla ?? 24, trainingRequired: d.trainingRequired ?? false, trainingMaterialUrl: undefined, pdcaStage: undefined,
}));

export const DEFECT_TREE: DefectTreeNode[] = DEFECT_CATEGORIES.map((cat) => ({
  key: cat.code, title: cat.name + ' (' + cat.code + ')', code: cat.code, level: 1, count: cat.totalCount, childCount: cat.childCount,
  children: DEFECT_DETAILS.filter((d) => d.category === cat.code && d.level === 2).map((d) => ({
    key: d.code, title: d.name + ' (' + d.code + ')', code: cat.code, level: 2, count: d.count, childCount: 0,
  })),
}));

export const DEFECT_ANALYTICS: DefectAnalytics = {
  stats: {
    totalDefects: DEFECT_DETAILS.length,
    byCategory: DEFECT_CATEGORIES.reduce((acc, c) => ({ ...acc, [c.code]: c.totalCount }), {} as Record<string, number>),
    bySeverity: { 'minor': 14, 'major': 11, 'critical': 4 },
    byStatus: { 'active': 26, 'deprecated': 2, 'draft': 1, 'reviewing': 1 },
    topDefects: [
      { code: 'FMT-001', name: 'CT值缺单位', count: 198, changeRate: -5.2, severity: 'minor' },
      { code: 'DSC-001', name: '描述过于简单', count: 156, changeRate: 2.1, severity: 'major' },
      { code: 'FMT-002', name: '尺寸格式不规范', count: 156, changeRate: -3.5, severity: 'minor' },
      { code: 'TER-001', name: '术语不规范', count: 134, changeRate: 1.2, severity: 'minor' },
      { code: 'DSC-002', name: '描述不清', count: 89, changeRate: 0.5, severity: 'major' },
    ],
    customCount: 3,
    retiredCount: 2,
    trainingLinked: 8,
    totalHitsThisMonth: 156,
    fixRate: 82.5,
    averageFixHours: 18.5,
  },
  trends: [
    { code: 'FMT-001', name: 'CT值缺单位', category: 'FMT', daily: Array.from({ length: 30 }, (_, i) => ({ date: isoDaysAgo(29 - i).slice(0, 10), count: Math.floor(Math.random() * 8) + 2, fixedCount: Math.floor(Math.random() * 6) + 1 })), total: 198, fixed: 165, changeRate: -5.2, trend: 'down' },
    { code: 'DSC-001', name: '描述过于简单', category: 'DSC', daily: Array.from({ length: 30 }, (_, i) => ({ date: isoDaysAgo(29 - i).slice(0, 10), count: Math.floor(Math.random() * 6) + 1, fixedCount: Math.floor(Math.random() * 5) })), total: 156, fixed: 132, changeRate: 2.1, trend: 'up' },
    { code: 'FMT-002', name: '尺寸格式不规范', category: 'FMT', daily: Array.from({ length: 30 }, (_, i) => ({ date: isoDaysAgo(29 - i).slice(0, 10), count: Math.floor(Math.random() * 7) + 1, fixedCount: Math.floor(Math.random() * 5) })), total: 156, fixed: 140, changeRate: -3.5, trend: 'down' },
    { code: 'TER-001', name: '术语不规范', category: 'TER', daily: Array.from({ length: 30 }, (_, i) => ({ date: isoDaysAgo(29 - i).slice(0, 10), count: Math.floor(Math.random() * 5) + 1, fixedCount: Math.floor(Math.random() * 4) })), total: 134, fixed: 110, changeRate: 1.2, trend: 'stable' },
  ],
  byDepartment: [
    { department: 'CT室', count: 487, avgScore: 89.5 },
    { department: 'MR室', count: 412, avgScore: 88.2 },
    { department: '乳腺中心', count: 156, avgScore: 90.1 },
    { department: '普放', count: 193, avgScore: 85.0 },
  ],
  byDoctor: [
    { doctorId: 'D004', doctorName: '陈晓东', count: 145, avgScore: 84.2 },
    { doctorId: 'D007', doctorName: '孙立人', count: 98, avgScore: 86.0 },
    { doctorId: 'D003', doctorName: '王建华', count: 87, avgScore: 88.3 },
    { doctorId: 'D005', doctorName: '刘文博', count: 65, avgScore: 90.5 },
    { doctorId: 'D002', doctorName: '李慧敏', count: 54, avgScore: 91.2 },
  ],
  byModality: [
    { modality: 'CT', count: 658, avgScore: 89.5 },
    { modality: 'MR', count: 412, avgScore: 88.2 },
    { modality: 'DR', count: 187, avgScore: 85.0 },
    { modality: 'US', count: 89, avgScore: 88.0 },
    { modality: 'MG', count: 32, avgScore: 92.0 },
  ],
  byBodyPart: [
    { bodyPart: '胸部', count: 412, avgScore: 89.0 },
    { bodyPart: '腹部', count: 387, avgScore: 88.5 },
    { bodyPart: '头颅', count: 245, avgScore: 87.5 },
    { bodyPart: '脊柱', count: 198, avgScore: 88.0 },
    { bodyPart: '盆腔', count: 87, avgScore: 90.0 },
  ],
  pcaCause: [
    { stage: 'plan', defects: [{ code: 'CMP-001', name: '缺检查所见', count: 34 }] },
    { stage: 'do', defects: [{ code: 'DSC-001', name: '描述过于简单', count: 156 }, { code: 'FMT-001', name: 'CT值缺单位', count: 198 }] },
    { stage: 'check', defects: [{ code: 'LOG-001', name: '阴阳矛盾', count: 12 }, { code: 'LOG-002', name: '左右混淆', count: 8 }] },
    { stage: 'act', defects: [{ code: 'CRI-001', name: '危急值未标识', count: 5 }] },
  ],
  caseLibrary: [
    { id: 'cl-001', type: 'good', title: '优秀模板：胸部CT肺结节', reportId: 'rpt-091', defectCodes: [], description: '完整结构化报告，包含 Lung-RADS 分类', tags: ['CT', '胸部', '优秀'] },
    { id: 'cl-002', type: 'bad', title: '反面案例：描述过于简单', reportId: 'rpt-048', defectCodes: ['DSC-001', 'CMP-001'], description: '仅3行描述，无具体征象', tags: ['CT', '反面', '完整'] },
    { id: 'cl-003', type: 'good', title: '优秀模板：脑梗死急诊', reportId: 'rpt-019', defectCodes: [], description: '危急值规范标识，双审完成', tags: ['CT', '危急值', '优秀'] },
    { id: 'cl-004', type: 'bad', title: '反面案例：左右混淆', reportId: 'rpt-022', defectCodes: ['LOG-002'], description: '左右侧描述与图像不符', tags: ['CT', '逻辑', '严重'] },
  ],
};

export const DEFECT_IMPORT_RECORDS: DefectImportRecord[] = [
  { id: 'di-001', filename: 'defect_library_2026Q2.json', format: 'json', totalRows: 45, successCount: 43, failedCount: 2, importedBy: 'D001', importedAt: isoDaysAgo(30), status: 'partial', errorLog: '2 行格式错误' },
  { id: 'di-002', filename: 'new_defects_2026_06.xlsx', format: 'excel', totalRows: 12, successCount: 12, failedCount: 0, importedBy: 'D006', importedAt: isoDaysAgo(15), status: 'success' },
  { id: 'di-003', filename: 'legacy_defects.yaml', format: 'yaml', totalRows: 28, successCount: 28, failedCount: 0, importedBy: 'D001', importedAt: isoDaysAgo(60), status: 'success' },
];

export const DEFECT_REMEDIATION_RECORDS: DefectRemediation[] = DEFECT_REMEDIATIONS;

// [v3.0.6.8-27] 扩充案例库 + 缺陷详情 4→30+
import { PATIENT_MASTER } from './master/patientMasterMock';
import { DOCTOR_MASTER } from './master/doctorMasterMock';

export const CASE_LIBRARY_FULL = [
  {
    id: 'case-gen-001',
    title: '肝硬化合并肝癌典型病例',
    patientName: PATIENT_MASTER[0]!.name,
    diagnosis: '肝硬化合并肝细胞癌',
    modality: 'CT' as const,
    bodyPart: '腹部',
    keyImages: ['case-001-img-1.png', 'case-001-img-2.png'],
    teachingPoints: [
      '肝硬化背景上出现快进快出强化结节',
      '动脉期高密度，门脉期/延迟期廓清',
      'AFP 升高辅助诊断',
    ],
    preventionMeasures: ['定期复查 AFP + 影像', '对高危人群每 6 月筛查'],
    outcome: '术后随访 1 年, 无复发',
    createdBy: DOCTOR_MASTER[0]!.name,
    createdAt: '2026-05-15T10:00:00Z',
  },
  {
    id: 'case-gen-002',
    title: '急性脑梗死 DWI 高信号典型',
    patientName: PATIENT_MASTER[1]!.name,
    diagnosis: '急性脑梗死 (右侧大脑中动脉供血区)',
    modality: 'MR' as const,
    bodyPart: '头部',
    keyImages: ['case-002-img-1.png'],
    teachingPoints: [
      'DWI 高信号, ADC 低信号',
      'FLAIR 可能阴性 (超急性期)',
      'MRA 显示血管闭塞',
    ],
    preventionMeasures: ['识别 DWI/FLAIR 不匹配', '溶栓时间窗评估'],
    outcome: '急诊溶栓, 预后良好',
    createdBy: DOCTOR_MASTER[1]!.name,
    createdAt: '2026-05-20T14:00:00Z',
  },
  {
    id: 'case-gen-003',
    title: '肺栓塞 CTA 典型表现',
    patientName: PATIENT_MASTER[2]!.name,
    diagnosis: '双侧肺动脉栓塞',
    modality: 'CT' as const,
    bodyPart: '胸部',
    keyImages: ['case-003-img-1.png'],
    teachingPoints: [
      '肺动脉内充盈缺损',
      '马赛克灌注',
      '楔形梗死灶',
    ],
    preventionMeasures: ['高危患者预防抗凝', 'D-二聚体筛查'],
    outcome: '溶栓后好转',
    createdBy: DOCTOR_MASTER[2]!.name,
    createdAt: '2026-04-10T09:00:00Z',
  },
  {
    id: 'case-gen-004',
    title: '主动脉夹层 Stanford A 型',
    patientName: PATIENT_MASTER[3]!.name,
    diagnosis: '主动脉夹层 (Stanford A)',
    modality: 'CT' as const,
    bodyPart: '胸部',
    keyImages: ['case-004-img-1.png'],
    teachingPoints: [
      '内膜片征',
      '真假腔',
      '累及升主动脉 (Stanford A)',
    ],
    preventionMeasures: ['高血压控制', '马凡综合征筛查'],
    outcome: '急诊手术, 成功',
    createdBy: DOCTOR_MASTER[3]!.name,
    createdAt: '2026-03-25T16:00:00Z',
  },
  {
    id: 'case-gen-005',
    title: '乳腺癌 BI-RADS 5 类',
    patientName: PATIENT_MASTER[4]!.name,
    diagnosis: '右侧乳腺癌 (BI-RADS 5)',
    modality: 'MG' as const,
    bodyPart: '乳腺',
    keyImages: ['case-005-img-1.png'],
    teachingPoints: [
      '毛刺状肿块',
      '微小钙化簇',
      '皮肤增厚',
    ],
    preventionMeasures: ['40+ 妇女年度筛查', '高危人群 MRI 补充'],
    outcome: '改良根治术, 化疗中',
    createdBy: DOCTOR_MASTER[4]!.name,
    createdAt: '2026-04-30T11:00:00Z',
  },
];

// 扩充鱼骨图节点 (4 阶段 × 5-8 缺陷)
export const FISHBONE_NODES = [
  // 人 (Man)
  { id: 'fb-1-1', category: '人' as const, cause: '诊断经验不足', frequency: 12, examples: ['住院医师初写报告', '罕见病漏诊'] },
  { id: 'fb-1-2', category: '人' as const, cause: '疲劳/注意力不集中', frequency: 18, examples: ['夜班漏看微小病灶', 'CT 值写错'] },
  { id: 'fb-1-3', category: '人' as const, cause: '培训不足', frequency: 9, examples: ['新员工不熟悉模板', '亚专业不熟'] },
  { id: 'fb-1-4', category: '人' as const, cause: '责任心不强', frequency: 6, examples: ['报告超时', '签名不规范'] },
  // 机 (Machine)
  { id: 'fb-2-1', category: '机' as const, cause: '图像质量不达标', frequency: 8, examples: ['DR 曝光不足', 'MR 伪影'] },
  { id: 'fb-2-2', category: '机' as const, cause: '设备老化', frequency: 5, examples: ['球管老化致 CT 值漂移', '探测器噪声'] },
  { id: 'fb-2-3', category: '机' as const, cause: 'PACS 显示异常', frequency: 3, examples: ['窗宽窗位错误', '图像丢失'] },
  // 料 (Material)
  { id: 'fb-3-1', category: '料' as const, cause: '临床信息不全', frequency: 15, examples: ['主诉缺失', '既往史不详'] },
  { id: 'fb-3-2', category: '料' as const, cause: '检查协议不当', frequency: 4, examples: ['未增强', '扫描范围不足'] },
  { id: 'fb-3-3', category: '料' as const, cause: '对比剂使用错误', frequency: 2, examples: ['剂量不足', '注射速率过快'] },
  // 法 (Method)
  { id: 'fb-4-1', category: '法' as const, cause: '模板/规范不完善', frequency: 7, examples: ['模板字段缺失', '术语不统一'] },
  { id: 'fb-4-2', category: '法' as const, cause: '流程不合理', frequency: 5, examples: ['审核流于形式', '危急值延迟'] },
  { id: 'fb-4-3', category: '法' as const, cause: '缺乏审核机制', frequency: 4, examples: ['无 AI 预审', '无同行评审'] },
  // 环 (Environment)
  { id: 'fb-5-1', category: '环' as const, cause: '工作量大', frequency: 20, examples: ['日均报告 50+', '高峰时段拥挤'] },
  { id: 'fb-5-2', category: '环' as const, cause: '系统不稳定', frequency: 8, examples: ['PACS 卡顿', 'RIS 慢'] },
  { id: 'fb-5-3', category: '环' as const, cause: '急诊/夜班多', frequency: 11, examples: ['夜间急诊集中', '值班疲劳'] },
];

export default {
  DEFECT_CATEGORIES,
  DEFECT_DETAILS,
  DEFECT_TREE,
  DEFECT_ANALYTICS,
  DEFECT_IMPORT_RECORDS,
  DEFECT_REMEDIATION_RECORDS,
  CASE_LIBRARY_FULL,
  FISHBONE_NODES,
};
