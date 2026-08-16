// [v3.0.6.11-60] Batch 3: 壳页面真实化 - MSW handlers
// 覆盖: /ai/fusion-workspace, /pacs-admin, /snomed, /terminology,
// [G005 Wave1B P1] 标注更新: pacs-admin (servers/storage-groups/associations/stats) 与
// /terminology/* 后端均已实现 (pacs-admin.module / terminology.module), 以下 handler 仅作 mock 兜底。
//       /clinical-pathways, /consent-education, /dental/ai-findings, /critical/value5step
import { http, HttpResponse, delay } from 'msw';
import { list, create, update, remove } from './store';

const API_BASE = typeof process !== 'undefined' && process.env.VITEST
  ? 'http://localhost:5173/api/v1'
  : (typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin + '/api/v1'
    : 'http://localhost:5173/api/v1');

const delayMs = (min = 50, max = 180) => Math.floor(Math.random() * (max - min) + min);

const ok = (data: unknown, meta?: Record<string, unknown>) =>
  meta ? { success: true, data, meta } : { success: true, data };

// ── 数据池 ──────────────────────────────────────────────────────────────────
const FUSION_STUDIES = [
  { id: 'FS-001', patient: '张伟', modalities: 'CBCT + OPG', fusionScore: 0.93, findings: 12, aiAlerts: 2, status: 'complete', date: '2026-07-18' },
  { id: 'FS-002', patient: '李娜', modalities: 'CBCT + 口扫', fusionScore: 0.88, findings: 8, aiAlerts: 1, status: 'complete', date: '2026-07-19' },
  { id: 'FS-003', patient: '王强', modalities: 'MR + CT', fusionScore: 0.81, findings: 5, aiAlerts: 0, status: 'pending', date: '2026-07-21' },
  { id: 'FS-004', patient: '赵敏', modalities: 'CBCT + 全景', fusionScore: 0.95, findings: 15, aiAlerts: 3, status: 'complete', date: '2026-07-23' },
  { id: 'FS-005', patient: '陈静', modalities: 'OPG + 口扫', fusionScore: 0.76, findings: 6, aiAlerts: 0, status: 'pending', date: '2026-07-25' },
];

const AI_INSIGHTS = [
  { id: 'AI-001', type: 'lesion', finding: '右下颌埋伏第三磨牙近中倾斜', confidence: 0.92, modality: 'CBCT', source: 'CariesNet-v3', actionable: true },
  { id: 'AI-002', type: 'measurement', finding: '36 牙位根尖周透亮影 4.2mm', confidence: 0.85, modality: 'CBCT', source: 'PeriapicalAI-v2', actionable: true },
  { id: 'AI-003', type: 'vessel', finding: '下牙槽神经管距根尖 2.8mm', confidence: 0.88, modality: 'CBCT', source: 'NerveTrace-v1', actionable: true },
  { id: 'AI-004', type: 'classification', finding: '牙周骨丧失 15% (轻度)', confidence: 0.79, modality: 'OPG', source: 'BoneLoss-v2', actionable: false },
  { id: 'AI-005', type: 'lesion', finding: '左上中切牙邻面早期龋', confidence: 0.68, modality: 'OPG', source: 'CariesNet-v3', actionable: false },
];

const PACS_SERVERS = [
  { id: 'PS-001', name: 'Primary PACS', hostname: 'pacs01.hospital.local', port: 11112, aeTitle: 'RIS_PRIMARY', status: 'online', lastHeartbeat: '2026-08-03T08:30:00', storageBytes: 512 * 1024 ** 3, studyCount: 125000, seriesCount: 310000 },
  { id: 'PS-002', name: 'Backup PACS', hostname: 'pacs02.hospital.local', port: 11112, aeTitle: 'RIS_BACKUP', status: 'online', lastHeartbeat: '2026-08-03T08:29:00', storageBytes: 480 * 1024 ** 3, studyCount: 121000, seriesCount: 302000 },
  { id: 'PS-003', name: 'Archive PACS', hostname: 'pacs03.hospital.local', port: 11112, aeTitle: 'RIS_ARCHIVE', status: 'offline', lastHeartbeat: '2026-07-30T22:00:00', storageBytes: 2048 * 1024 ** 3, studyCount: 500000, seriesCount: 1400000 },
];

const PACS_STORAGE = [
  { id: 'SG-001', name: 'Hot Storage', path: '/data/hot', totalBytes: 2 * 1024 ** 4, usedBytes: 1.5 * 1024 ** 4, studyCount: 260000, status: 'active' },
  { id: 'SG-002', name: 'Warm Storage', path: '/data/warm', totalBytes: 5 * 1024 ** 4, usedBytes: 3.2 * 1024 ** 4, studyCount: 510000, status: 'active' },
  { id: 'SG-003', name: 'Cold Archive', path: '/data/cold', totalBytes: 20 * 1024 ** 4, usedBytes: 12 * 1024 ** 4, studyCount: 1800000, status: 'active' },
];

const PACS_ASSOCIATIONS = [
  { id: 'PA-001', localAe: 'RIS_PRIMARY', remoteAe: 'CT_SCANNER_01', remoteHost: '192.168.10.21', remotePort: 104, status: 'connected', lastActivity: '2026-08-03T08:31:00', requestCount: 48210, errorCount: 12 },
  { id: 'PA-002', localAe: 'RIS_PRIMARY', remoteAe: 'MR_SCANNER_02', remoteHost: '192.168.10.32', remotePort: 104, status: 'connected', lastActivity: '2026-08-03T08:25:00', requestCount: 31055, errorCount: 3 },
  { id: 'PA-003', localAe: 'RIS_BACKUP', remoteAe: 'WORKSTATION_5', remoteHost: '192.168.20.15', remotePort: 104, status: 'disconnected', lastActivity: '2026-08-02T18:40:00', requestCount: 9870, errorCount: 41 },
];

const SNOMED_CONCEPTS = [
  { conceptId: '122750008', fsn: 'Periapical radiolucency (finding)', pt: 'Periapical radiolucency', semanticTag: 'finding', matchType: 'exact', confidence: 1.0 },
  { conceptId: '267890001', fsn: 'Disorder of tooth development (disorder)', pt: 'Disorder of tooth development', semanticTag: 'diagnosis', matchType: 'partial', confidence: 0.87 },
  { conceptId: '704307004', fsn: 'Carious lesion of tooth (disorder)', pt: 'Carious lesion of tooth', semanticTag: 'diagnosis', matchType: 'exact', confidence: 0.96 },
  { conceptId: '10837007', fsn: 'Impacted tooth (disorder)', pt: 'Impacted tooth', semanticTag: 'diagnosis', matchType: 'suggested', confidence: 0.62 },
];

const TERM_MAPPINGS = [
  { id: 'TM-001', source: 'SNOMED:122750008', sourceSystem: 'SNOMED-CT', target: 'ICD-11:K08.8', targetSystem: 'ICD-11', mapType: 'equivalent', status: 'active', updatedAt: '2026-07-01' },
  { id: 'TM-002', source: 'LOINC:245-6', sourceSystem: 'LOINC', target: 'RIDICOM:RID110', targetSystem: 'RIDICOM', mapType: 'broader', status: 'active', updatedAt: '2026-07-03' },
  { id: 'TM-003', source: 'SNOMED:10837007', sourceSystem: 'SNOMED-CT', target: 'ICD-11:K01.1', targetSystem: 'ICD-11', mapType: 'equivalent', status: 'active', updatedAt: '2026-07-05' },
  { id: 'TM-004', source: 'SNOMED:704307004', sourceSystem: 'SNOMED-CT', target: 'ICD-11:K02.9', targetSystem: 'ICD-11', mapType: 'equivalent', status: 'draft', updatedAt: '2026-07-08' },
];

const TERM_SYSTEMS = [
  { system: 'SNOMED-CT', version: '2026-07-31 SNOMED Intl', concepts: 355000, status: 'online', lastSync: '2026-08-03T02:00:00' },
  { system: 'ICD-11', version: '2024-01', concepts: 17000, status: 'online', lastSync: '2026-08-03T02:10:00' },
  { system: 'LOINC', version: '2.77', concepts: 98000, status: 'online', lastSync: '2026-08-03T02:05:00' },
  { system: 'RIDICOM', version: '2026-A', concepts: 4200, status: 'degraded', lastSync: '2026-07-28T12:00:00' },
];

const PATHWAYS = [
  { id: 'PW-01', name: '白内障手术临床路径', dept: '眼科', phase: '术前评估', progress: 60, status: 'active', patients: 12, version: 'v3.2', updatedAt: '2026-07-20' },
  { id: 'PW-02', name: 'CBCT 引导种植路径', dept: '口腔外科', phase: '种植体植入', progress: 85, status: 'active', patients: 8, version: 'v2.1', updatedAt: '2026-07-22' },
  { id: 'PW-03', name: '卒中影像快速通道', dept: '放射科', phase: '图像采集', progress: 40, status: 'active', patients: 5, version: 'v4.0', updatedAt: '2026-07-18' },
  { id: 'PW-04', name: '正畸治疗计划路径', dept: '正畸科', phase: '诊断资料采集', progress: 25, status: 'paused', patients: 15, version: 'v1.8', updatedAt: '2026-06-30' },
];

const PATHWAY_PATIENTS = [
  { id: 'PP-001', patient: '张伟', pathway: '白内障手术 - OD', step: 3, totalSteps: 8, status: 'on-track', enteredAt: '2026-06-20', variance: null, steps: ['门诊评估', '术前检查', '眼科会诊', '术前宣教', '手术治疗', '术后观察', '出院随访', '复查'] },
  { id: 'PP-002', patient: '李娜', pathway: 'CBCT 引导种植 #36', step: 5, totalSteps: 7, status: 'on-track', enteredAt: '2026-06-18', variance: null, steps: ['初诊评估', 'CBCT 采集', '种植规划', '导板设计', '手术植入', '术后复查', '修复取模'] },
  { id: 'PP-003', patient: '王芳', pathway: '白内障手术 - OS', step: 2, totalSteps: 8, status: 'delayed', enteredAt: '2026-06-22', variance: '检验报告延迟 >24h', steps: ['门诊评估', '术前检查', '眼科会诊', '术前宣教', '手术治疗', '术后观察', '出院随访', '复查'] },
  { id: 'PP-004', patient: '刘强', pathway: '卒中影像快速通道', step: 2, totalSteps: 4, status: 'on-track', enteredAt: '2026-06-28', variance: null, steps: ['急诊分诊', '影像采集', 'AI 辅助诊断', '溶栓治疗'] },
];

const CONSENTS = [
  { id: 'C-001', patient: '张伟', type: 'CT 增强', procedure: '胸部 CT 增强扫描', signedAt: '2026-08-02 09:15', status: 'signed', witness: '李护士', createdAt: '2026-08-02' },
  { id: 'C-002', patient: '李娜', type: '手术', procedure: '右眼白内障手术', signedAt: null, status: 'pending', witness: null, createdAt: '2026-08-03' },
  { id: 'C-003', patient: '王芳', type: '麻醉', procedure: '全身麻醉', signedAt: '2026-08-01 14:00', status: 'signed', witness: '张医生', createdAt: '2026-08-01' },
  { id: 'C-004', patient: '刘强', type: '输血', procedure: '红细胞悬液 2U', signedAt: null, status: 'refused', witness: '王医生', createdAt: '2026-07-31' },
];

const EDUCATION_MATERIALS = [
  { id: 'M-001', title: 'CT 扫描须知', lang: 'zh-CN', category: 'Imaging', pages: 4, views: 142, format: 'PDF', content: 'CT 检查前需去除金属物品，检查前 4 小时禁食；如有造影剂过敏史请提前告知医生。', summary: 'CT 检查前准备', createdAt: '2026-05-01' },
  { id: 'M-002', title: '白内障手术准备', lang: 'zh-CN', category: 'Surgery', pages: 6, views: 89, format: 'PDF + Video', content: '手术前需完成全身检查评估，停用抗凝药物，术前 8 小时禁食。', summary: '白内障手术术前指导', createdAt: '2026-04-12' },
  { id: 'M-003', title: '造影剂安全', lang: 'zh-CN', category: 'Imaging', pages: 3, views: 234, format: 'PDF', content: '碘造影剂可能引起过敏反应；检查后 24 小时内饮水 ≥2000ml 促进排出。', summary: '造影剂使用与风险', createdAt: '2026-03-20' },
  { id: 'M-004', title: '种植牙术后护理', lang: 'en-US', category: 'Dental', pages: 5, views: 67, format: 'PDF', content: '术后 24 小时内冷敷，避免咀嚼硬物，保持口腔清洁。', summary: '种植术后护理要点', createdAt: '2026-02-15' },
  { id: 'M-005', title: '放疗定位宣教', lang: 'zh-CN', category: 'Treatment', pages: 8, views: 103, format: 'PDF + Video', content: '放疗定位需保持体位一致，定位标记线不可擦除。', summary: '放疗定位流程说明', createdAt: '2026-06-10' },
];

const AI_FINDINGS = [
  { id: 'AF-001', patientName: '张伟', type: 'caries', toothNo: '16', finding: '16 牙合面中龋', confidence: 0.88, status: 'confirmed', createdAt: '2026-07-30T10:20:00' },
  { id: 'AF-002', patientName: '李娜', type: 'periapical', toothNo: '36', finding: '36 根尖周炎 (PI 2.5)', confidence: 0.82, status: 'pending', createdAt: '2026-07-31T14:05:00' },
  { id: 'AF-003', patientName: '王强', type: 'boneloss', toothNo: '37', finding: '下颌后牙区骨丧失 22%', confidence: 0.78, status: 'confirmed', createdAt: '2026-08-01T09:40:00' },
  { id: 'AF-004', patientName: '赵敏', type: 'rootcanal', toothNo: '46', finding: '46 根管 2 根已充填', confidence: 0.91, status: 'pending', createdAt: '2026-08-02T16:30:00' },
  { id: 'AF-005', patientName: '陈静', type: 'oral', toothNo: '-', finding: '左侧颊黏膜白斑待查', confidence: 0.72, status: 'confirmed', createdAt: '2026-08-03T08:15:00' },
];

const VALUE5STEP = [
  {
    id: 'CV5-001', patientName: '张明远', finding: '颅内出血', severity: '危急', currentStep: 1,
    steps: { discovered: { done: true, time: '2026-08-03 07:45', user: '自动检测' }, voiceCall: { done: false }, acknowledged: { done: false }, receipted: { done: false }, closed: { done: false } },
  },
  {
    id: 'CV5-002', patientName: '李静', finding: '主动脉夹层', severity: '危及生命', currentStep: 2,
    steps: { discovered: { done: true, time: '2026-08-03 08:02', user: '自动检测' }, voiceCall: { done: true, time: '2026-08-03 08:08', user: '值班医生', phone: '13800000001' }, acknowledged: { done: false }, receipted: { done: false }, closed: { done: false } },
  },
  {
    id: 'CV5-003', patientName: '王强', finding: '急性心肌梗死', severity: '危及生命', currentStep: 3,
    steps: { discovered: { done: true, time: '2026-08-03 07:20', user: '自动检测' }, voiceCall: { done: true, time: '2026-08-03 07:25', user: '值班医生', phone: '13800000002' }, acknowledged: { done: true, time: '2026-08-03 07:30', user: '心内科陈医生' }, receipted: { done: false }, closed: { done: false } },
  },
  {
    id: 'CV5-004', patientName: '赵敏', finding: '蛛网膜下腔出血', severity: '危急', currentStep: 5,
    steps: { discovered: { done: true, time: '2026-08-02 21:10', user: '自动检测' }, voiceCall: { done: true, time: '2026-08-02 21:16', user: '值班医生', phone: '13800000003' }, acknowledged: { done: true, time: '2026-08-02 21:22', user: '神经外科刘医生' }, receipted: { done: true, time: '2026-08-02 21:35', user: '神经外科刘医生', comment: '已收治，急诊手术' }, closed: { done: true, time: '2026-08-03 06:00', user: '系统' } },
  },
];

// [G005 Wave1A P0-1] pacs-admin 11 端点 (后端已实现, mock 兜底): nodes/storage/worklist/archives/logs/configs/routes
const PACS_NODES = [
  { id: 'NODE-01', name: 'GE Revolution CT', aeTitle: 'PACS-CT1', hostname: 'pacs-ct1.local', port: 11112, status: 'online', lastHeartbeat: '2026-08-08T08:30:00Z', modality: 'CT', location: 'CT检查室1', studyCount: 423 },
  { id: 'NODE-02', name: '西门子 SOMATOM Force', aeTitle: 'PACS-CT2', hostname: 'pacs-ct2.local', port: 11112, status: 'online', lastHeartbeat: '2026-08-08T08:28:00Z', modality: 'CT', location: 'CT检查室2', studyCount: 391 },
  { id: 'NODE-03', name: 'GE SIGNA 3.0T', aeTitle: 'PACS-MR1', hostname: 'pacs-mr1.local', port: 11112, status: 'online', lastHeartbeat: '2026-08-08T08:26:00Z', modality: 'MR', location: 'MR检查室', studyCount: 178 },
  { id: 'NODE-04', name: '飞利浦 Ingenia 1.5T', aeTitle: 'PACS-MR2', hostname: 'pacs-mr2.local', port: 11112, status: 'offline', lastHeartbeat: '2026-08-08T02:30:00Z', modality: 'MR', location: 'MR检查室2', studyCount: 165 },
  { id: 'NODE-05', name: '联影 uDR 数字化X线', aeTitle: 'PACS-DR1', hostname: 'pacs-dr1.local', port: 104, status: 'online', lastHeartbeat: '2026-08-08T08:31:00Z', modality: 'DR', location: 'DR检查室', studyCount: 512 },
  { id: 'NODE-06', name: '豪洛捷 Selenia Dimensions', aeTitle: 'PACS-MG1', hostname: 'pacs-mg1.local', port: 104, status: 'error', lastHeartbeat: '2026-08-08T07:10:00Z', modality: 'MG', location: '乳腺检查室', studyCount: 96 },
];

const PACS_WORKLIST = [
  { id: 'WL-001', accessionNumber: 'ACC20260808-011', patientId: 'P100001', patientName: '张伟', modality: 'CT', bodyPart: '胸部', state: 'COMPLETED', scheduledAt: '2026-08-08T08:00:00Z' },
  { id: 'WL-002', accessionNumber: 'ACC20260808-012', patientId: 'P100002', patientName: '李娜', modality: 'MR', bodyPart: '头颅', state: 'IN_PROGRESS', scheduledAt: '2026-08-08T08:15:00Z' },
  { id: 'WL-003', accessionNumber: 'ACC20260808-013', patientId: 'P100003', patientName: '王芳', modality: 'DR', bodyPart: '胸部', state: 'COMPLETED', scheduledAt: '2026-08-08T08:30:00Z' },
  { id: 'WL-004', accessionNumber: 'ACC20260808-014', patientId: 'P100004', patientName: '陈丽', modality: 'US', bodyPart: '腹部', state: 'SCHEDULED', scheduledAt: '2026-08-08T09:20:00Z' },
  { id: 'WL-005', accessionNumber: 'ACC20260808-015', patientId: 'P100005', patientName: '刘洋', modality: 'CT', bodyPart: '腹部增强', state: 'SCHEDULED', scheduledAt: '2026-08-08T09:45:00Z' },
];

const PACS_ARCHIVES = [
  { id: 'ARC-001', studyId: 'STU20260728-050', patientName: '张三', modality: 'CT', archivedAt: '2026-08-01T09:00:00Z', sizeBytes: 460 * 1024 ** 2, status: 'archived' },
  { id: 'ARC-002', studyId: 'STU20260728-051', patientName: '李四', modality: 'MR', archivedAt: '2026-08-01T10:30:00Z', sizeBytes: 890 * 1024 ** 2, status: 'restored' },
  { id: 'ARC-003', studyId: 'STU20260729-011', patientName: '王五', modality: 'DX', archivedAt: '2026-08-02T08:15:00Z', sizeBytes: 32 * 1024 ** 2, status: 'archived' },
  { id: 'ARC-004', studyId: 'STU20260729-012', patientName: '赵六', modality: 'US', archivedAt: '2026-08-02T14:40:00Z', sizeBytes: 210 * 1024 ** 2, status: 'archived' },
  { id: 'ARC-005', studyId: 'STU20260730-020', patientName: '钱七', modality: 'CT', archivedAt: '2026-08-03T11:20:00Z', sizeBytes: 520 * 1024 ** 2, status: 'restoring' },
];

const PACS_LOGS = [
  { id: 'LOG-001', time: '2026-08-08T08:30:00Z', level: 'INFO', source: 'DICOM', message: 'SCU 连接建立 (GE Revolution CT → PACS-NODE-01)' },
  { id: 'LOG-002', time: '2026-08-08T08:32:11Z', level: 'INFO', source: 'DICOM', message: 'C-STORE 完成 1/1 实例, 耗时 1.2s' },
  { id: 'LOG-003', time: '2026-08-08T08:35:47Z', level: 'WARN', source: 'STORAGE', message: '在线存储使用率超过 75%' },
  { id: 'LOG-004', time: '2026-08-08T07:58:03Z', level: 'ERROR', source: 'ROUTING', message: '转发失败: 目标 AE DICOM-PRINTER-2 无响应 (超时 30s)' },
  { id: 'LOG-005', time: '2026-08-08T07:45:00Z', level: 'INFO', source: 'AUDIT', message: '管理员触发全量存储校验' },
];

const PACS_CONFIGS = [
  { key: 'ae_title', value: 'G005RIS_PACS', description: 'PACS AE Title', category: 'DICOM' },
  { key: 'port', value: '104', description: 'DICOM 监听端口', category: 'DICOM' },
  { key: 'max_retry', value: '3', description: '转发最大重试次数', category: 'ROUTING' },
  { key: 'retention_days', value: '730', description: '在线存储保留天数', category: 'STORAGE' },
  { key: 'auto_migrate', value: 'true', description: '到期自动迁移至近线', category: 'STORAGE' },
  { key: 'wado_port', value: '8080', description: 'WADO 服务端口', category: 'WEB' },
];

const PACS_ROUTES = [
  { id: 'RT-001', name: 'CT 影像转发', sourceAe: 'G005RIS_PACS', targetAe: 'VNA_ARCHIVE', targetHost: 'vna-01.local', targetPort: 11112, protocol: 'DICOM', enabled: true },
  { id: 'RT-002', name: '胶片打印路由', sourceAe: 'G005RIS_PACS', targetAe: 'DICOM_PRINTER', targetHost: 'printer-01.local', targetPort: 104, protocol: 'DICOM', enabled: true },
  { id: 'RT-003', name: '远程会诊转发', sourceAe: 'G005RIS_PACS', targetAe: 'REMOTE_SITE', targetHost: 'remote.example.com', targetPort: 11112, protocol: 'DICOM', enabled: false },
];

// [G005 Wave1A P1-1] kiosk settings/messages/stats (kiosk.controller 已实现, mock 兜底)
const memPacsConfigs: any[] = [];

const KIOSK_SETTINGS = [
  { key: 'kiosk_enabled', value: 'true', description: '自助签到机启用' },
  { key: 'checkin_grace_minutes', value: '30', description: '报到宽限期(分钟)' },
  { key: 'default_wait_minutes', value: '15', description: '默认预计等待(分钟)' },
  { key: 'announcement', value: '请携带检查申请单, 提前 15 分钟报到', description: '屏幕公告' },
];

const KIOSK_MESSAGES = [
  { id: 'MSG-001', title: 'MR 检查室检修', content: 'MR-1室 今日 14:00-16:00 设备维护, 相关检查顺延', level: 'warning', active: true, updatedAt: '2026-08-08T08:00:00Z' },
  { id: 'MSG-002', title: '签到提示', content: '请使用就诊卡或身份证后 4 位进行签到', level: 'info', active: true, updatedAt: '2026-08-01T08:00:00Z' },
];

// ── Handlers ────────────────────────────────────────────────────────────────
export const shellBatch3Handlers = [
  // ========== AI Fusion Workspace ==========
  http.get(`${API_BASE}/ai/fusion-workspace/studies`, async () => {
    await delay(delayMs());
    return HttpResponse.json(ok(FUSION_STUDIES));
  }),
  http.get(`${API_BASE}/ai/fusion-workspace/insights`, async () => {
    await delay(delayMs());
    return HttpResponse.json(ok(AI_INSIGHTS));
  }),
  http.post(`${API_BASE}/ai/fusion-workspace/run`, async ({ request }) => {
    await delay(delayMs(200, 500));
    const body = (await request.json()) as { studyId?: string };
    const source = FUSION_STUDIES.find((s) => s.id === body?.studyId) ?? FUSION_STUDIES[0];
    return HttpResponse.json(ok({
      id: `FS-${Date.now()}`,
      patient: source?.patient ?? '新病例',
      modalities: 'CBCT + OPG',
      fusionScore: Math.round((0.8 + Math.random() * 0.15) * 100) / 100,
      findings: 5 + Math.floor(Math.random() * 10),
      aiAlerts: Math.floor(Math.random() * 3),
      status: 'complete',
      date: new Date().toISOString().slice(0, 10),
    }), { status: 201 });
  }),

  // ========== PACS Admin ==========
  http.get(`${API_BASE}/pacs-admin/servers`, async () => {
    await delay(delayMs());
    let items: any[] = [];
    try { items = list<any>('pacs_servers'); } catch {}
    const combined = [...items, ...PACS_SERVERS.filter((s) => !items.some((i) => i.id === s.id))];
    return HttpResponse.json(ok(combined));
  }),
  http.post(`${API_BASE}/pacs-admin/servers`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    const item = { id: `PS-${Date.now()}`, status: 'online', lastHeartbeat: new Date().toISOString(), storageBytes: 0, studyCount: 0, seriesCount: 0, ...body };
    try { create('pacs_servers', item); } catch {}
    return HttpResponse.json(ok(item), { status: 201 });
  }),
  http.put(`${API_BASE}/pacs-admin/servers/:id`, async ({ params, request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    const merged = { id: params.id, ...body };
    try { update('pacs_servers', params.id as string, merged); } catch {}
    return HttpResponse.json(ok(merged));
  }),
  http.delete(`${API_BASE}/pacs-admin/servers/:id`, async ({ params }) => {
    await delay(delayMs());
    try { remove('pacs_servers', params.id as string); } catch {}
    return HttpResponse.json({ success: true, data: {} });
  }),
  http.post(`${API_BASE}/pacs-admin/servers/:id/test`, async ({ params }) => {
    await delay(delayMs(300, 800));
    return HttpResponse.json(ok({ success: true, latencyMs: 8 + Math.floor(Math.random() * 60), serverId: params.id }));
  }),
  http.get(`${API_BASE}/pacs-admin/storage-groups`, async () => {
    await delay(delayMs());
    let items: any[] = [];
    try { items = list<any>('pacs_storage'); } catch {}
    const combined = [...items, ...PACS_STORAGE.filter((s) => !items.some((i) => i.id === s.id))];
    return HttpResponse.json(ok(combined));
  }),
  http.post(`${API_BASE}/pacs-admin/storage-groups`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    const item = { id: `SG-${Date.now()}`, usedBytes: 0, studyCount: 0, status: 'active', ...body };
    try { create('pacs_storage', item); } catch {}
    return HttpResponse.json(ok(item), { status: 201 });
  }),
  http.delete(`${API_BASE}/pacs-admin/storage-groups/:id`, async ({ params }) => {
    await delay(delayMs());
    try { remove('pacs_storage', params.id as string); } catch {}
    return HttpResponse.json({ success: true, data: {} });
  }),
  http.get(`${API_BASE}/pacs-admin/associations`, async () => {
    await delay(delayMs());
    return HttpResponse.json(ok(PACS_ASSOCIATIONS));
  }),
  http.get(`${API_BASE}/pacs-admin/stats`, async () => {
    await delay(delayMs());
    const online = PACS_SERVERS.filter((s) => s.status === 'online').length;
    const usedStorage = PACS_STORAGE.reduce((s, g) => s + g.usedBytes, 0);
    const totalStorage = PACS_STORAGE.reduce((s, g) => s + g.totalBytes, 0);
    return HttpResponse.json(ok({
      totalServers: PACS_SERVERS.length,
      onlineServers: online,
      totalStorageBytes: totalStorage,
      usedStorageBytes: usedStorage,
      totalStudies: PACS_SERVERS.reduce((s, x) => s + x.studyCount, 0),
      totalAssociations: PACS_ASSOCIATIONS.length,
      activeAssociations: PACS_ASSOCIATIONS.filter((a) => a.status === 'connected').length,
      dailyTransferBytes: 86 * 1024 ** 3,
    }));
  }),

  // ========== PACS Admin [G005 Wave1A P0-1] nodes/storage/worklist/archives/logs/configs/routes ==========
  http.get(`${API_BASE}/pacs-admin/nodes`, async () => {
    await delay(delayMs());
    return HttpResponse.json(ok(PACS_NODES));
  }),
  http.post(`${API_BASE}/pacs-admin/nodes/:id/test`, async ({ params }) => {
    await delay(delayMs(300, 800));
    return HttpResponse.json(ok({ success: true, latencyMs: 8 + Math.floor(Math.random() * 60), serverId: params.id }));
  }),
  http.post(`${API_BASE}/pacs-admin/nodes/:id/sync`, async ({ params }) => {
    await delay(delayMs(300, 800));
    return HttpResponse.json(ok({ ok: true, syncedStudies: 8 + Math.floor(Math.random() * 12), durationMs: 1800 + Math.floor(Math.random() * 900), serverId: params.id }));
  }),
  http.get(`${API_BASE}/pacs-admin/storage`, async () => {
    await delay(delayMs());
    return HttpResponse.json(ok(PACS_STORAGE));
  }),
  http.post(`${API_BASE}/pacs-admin/storage/cleanup`, async () => {
    await delay(delayMs(400, 900));
    return HttpResponse.json(ok({ ok: true, freedBytes: (150 + new Date().getDate() * 13) * 1024 ** 3, deletedCount: 30 + new Date().getDate(), durationMs: 2400 }));
  }),
  http.get(`${API_BASE}/pacs-admin/worklist-entries`, async () => {
    await delay(delayMs());
    return HttpResponse.json(ok(PACS_WORKLIST));
  }),
  http.get(`${API_BASE}/pacs-admin/archives`, async () => {
    await delay(delayMs());
    return HttpResponse.json(ok(PACS_ARCHIVES));
  }),
  http.get(`${API_BASE}/pacs-admin/logs`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 50, 1), 500);
    return HttpResponse.json(ok(PACS_LOGS.slice(0, limit)));
  }),
  http.get(`${API_BASE}/pacs-admin/configs`, async () => {
    await delay(delayMs());
    return HttpResponse.json(ok([...memPacsConfigs, ...PACS_CONFIGS.filter((c) => !memPacsConfigs.some((i) => i.key === c.key))]));
  }),
  http.post(`${API_BASE}/pacs-admin/configs/:key`, async ({ params, request }) => {
    await delay(delayMs());
    const body = (await request.json()) as { value?: string; description?: string };
    const key = params.key as string;
    const seed = PACS_CONFIGS.find((c) => c.key === key);
    const item = { key, value: body?.value ?? '', description: body?.description ?? seed?.description ?? '', category: seed?.category ?? 'CUSTOM' };
    const idx = memPacsConfigs.findIndex((c) => c.key === key);
    if (idx >= 0) memPacsConfigs[idx] = item; else memPacsConfigs.push(item);
    return HttpResponse.json(ok(item));
  }),
  http.get(`${API_BASE}/pacs-admin/routes`, async () => {
    await delay(delayMs());
    return HttpResponse.json(ok(PACS_ROUTES));
  }),

  // ========== Kiosk [G005 Wave1A P1-1] settings/messages/stats ==========
  http.get(`${API_BASE}/kiosk/settings`, async () => {
    await delay(delayMs());
    return HttpResponse.json(ok(KIOSK_SETTINGS));
  }),
  http.get(`${API_BASE}/kiosk/messages`, async () => {
    await delay(delayMs());
    return HttpResponse.json(ok(KIOSK_MESSAGES));
  }),
  http.get(`${API_BASE}/kiosk/stats`, async () => {
    await delay(delayMs());
    return HttpResponse.json(ok({ todayCount: 128, waitingCount: 14, avgWaitMinutes: 16, activeRooms: 5 }));
  }),

  // ========== SNOMED ==========
  http.get(`${API_BASE}/snomed/search`, async ({ request }) => {
    await delay(delayMs());
    const url = new URL(request.url);
    const q = (url.searchParams.get('q') ?? '').toLowerCase();
    const results = q
      ? SNOMED_CONCEPTS.filter((c) =>
          c.pt.toLowerCase().includes(q) || c.fsn.toLowerCase().includes(q) || c.conceptId.includes(q))
      : [];
    return HttpResponse.json(ok(results));
  }),
  http.post(`${API_BASE}/snomed/encode`, async ({ request }) => {
    await delay(delayMs(150, 350));
    const body = (await request.json()) as { text?: string };
    const text = body?.text ?? '';
    const codes = SNOMED_CONCEPTS.filter((c) =>
      text ? c.pt.toLowerCase().includes(text.toLowerCase()) || text.toLowerCase().includes(c.pt.slice(0, 6).toLowerCase()) : false,
    ).slice(0, 3);
    return HttpResponse.json(ok({ text, codes }));
  }),

  // [v3.0.6.11-103 Wave 17] 自动编码: 报告文本 → 诊断词 → SNOMED + ICD-10 (确定性规则)
  http.post(`${API_BASE}/snomed/auto-encode`, async ({ request }) => {
    await delay(delayMs(200, 400));
    const body = (await request.json()) as { text?: string };
    const text = String(body?.text ?? '').trim();
    if (!text) return HttpResponse.json(ok({ text, terms: [], total: 0, confirmed: 0 }));

    const AUTO_DICT: Array<{ keyword: string; snomed: string[]; icd10: string[] }> = [
      { keyword: '磨玻璃', snomed: ['427283000'], icd10: ['R91.1'] },
      { keyword: '结节', snomed: ['30092000'], icd10: ['R91.1'] },
      { keyword: '毛刺征', snomed: ['45321009'], icd10: ['R91.8'] },
      { keyword: '钙化', snomed: ['473840003'], icd10: ['R91.8'] },
      { keyword: '胸腔积液', snomed: ['79619009'], icd10: ['J90'] },
      { keyword: '肺气肿', snomed: ['87433001'], icd10: ['J43.9'] },
      { keyword: '肺炎', snomed: ['233604007'], icd10: ['J18.9'] },
      { keyword: '肝硬化', snomed: ['19943007'], icd10: ['K74.6'] },
      { keyword: '肝囊肿', snomed: ['40845000'], icd10: ['K76.89'] },
      { keyword: '骨折', snomed: ['125605004'], icd10: ['T14.2'] },
      { keyword: '脑梗死', snomed: ['432504006'], icd10: ['I63.9'] },
      { keyword: '水肿', snomed: ['79654002'], icd10: ['R60.9'] },
      { keyword: '肿瘤', snomed: ['363346000'], icd10: ['C80.1'] },
    ];
    const SNOMED_PT: Record<string, { pt: string; fsn: string; tag: string }> = {
      '427283000': { pt: 'Ground glass opacity', fsn: 'Ground glass opacity (morphologic abnormality)', tag: 'morphologic abnormality' },
      '30092000': { pt: 'Nodule', fsn: 'Nodule (morphologic abnormality)', tag: 'morphologic abnormality' },
      '45321009': { pt: 'Spiculated lesion', fsn: 'Spiculated lesion (morphologic abnormality)', tag: 'morphologic abnormality' },
      '473840003': { pt: 'Calcification', fsn: 'Calcification (morphologic abnormality)', tag: 'morphologic abnormality' },
      '79619009': { pt: 'Pleural effusion', fsn: 'Pleural effusion (disorder)', tag: 'disorder' },
      '87433001': { pt: 'Pulmonary emphysema', fsn: 'Pulmonary emphysema (disorder)', tag: 'disorder' },
      '233604007': { pt: 'Pneumonia', fsn: 'Pneumonia (disorder)', tag: 'disorder' },
      '19943007': { pt: 'Cirrhosis of liver', fsn: 'Cirrhosis of liver (disorder)', tag: 'disorder' },
      '40845000': { pt: 'Cyst of liver', fsn: 'Cyst of liver (disorder)', tag: 'disorder' },
      '125605004': { pt: 'Fracture of bone', fsn: 'Fracture of bone (disorder)', tag: 'disorder' },
      '432504006': { pt: 'Cerebral infarction', fsn: 'Infarction of brain (disorder)', tag: 'disorder' },
      '79654002': { pt: 'Edema', fsn: 'Edema (finding)', tag: 'finding' },
      '363346000': { pt: 'Malignant neoplasm', fsn: 'Malignant neoplastic disease (disorder)', tag: 'disorder' },
    };
    const ICD10_TITLE: Record<string, string> = {
      'R91.1': '肺部结节影像学发现', 'R91.8': '肺其他影像学异常发现', 'J90': '胸腔积液',
      'J43.9': '肺气肿,未特指', 'J18.9': '肺炎,病原体未特指', 'K74.6': '其他及未特指的肝硬化',
      'K76.89': '其他特指的肝脏疾病', 'T14.2': '身体未特指部位的骨折', 'I63.9': '脑梗死,未特指',
      'R60.9': '水肿,未特指', 'C80.1': '恶性肿瘤,未特指部位',
    };
    const terms: any[] = [];
    const seenSpans = new Set<string>();
    const ordered = [...AUTO_DICT].sort((a, b) => b.keyword.length - a.keyword.length);
    for (const item of ordered) {
      let from = 0;
      while (true) {
        const idx = text.indexOf(item.keyword, from);
        if (idx === -1) break;
        const spanKey = `${idx}-${idx + item.keyword.length}`;
        const overlap = Array.from(seenSpans).some((k) => {
          const [s, e] = k.split('-').map(Number);
          return idx < (e as number) && idx + item.keyword.length > (s as number);
        });
        if (!overlap) {
          seenSpans.add(spanKey);
          const base = item.keyword.length >= 3 ? 0.92 : 0.8;
          terms.push({
            keyword: item.keyword,
            matched: true,
            sourcePhrase: item.keyword,
            start: idx,
            end: idx + item.keyword.length,
            section: idx < text.indexOf('【印象】') || text.indexOf('【印象】') === -1 ? 'findings' : 'impression',
            snomed: item.snomed.map((id) => ({
              conceptId: id,
              pt: SNOMED_PT[id]?.pt ?? id,
              fsn: SNOMED_PT[id]?.fsn ?? id,
              semanticTag: SNOMED_PT[id]?.tag ?? 'disorder',
              matchType: 'exact',
              confidence: base,
            })),
            icd10: item.icd10.map((code) => ({
              code,
              title: ICD10_TITLE[code] ?? code,
              matchType: 'exact',
              confidence: base,
            })),
            confidence: base,
          });
        }
        from = idx + item.keyword.length;
      }
    }
    terms.sort((a, b) => a.start - b.start);
    return HttpResponse.json(ok({ text, terms, total: terms.length, confirmed: terms.filter((t) => t.confidence >= 0.9).length }));
  }),

  // ========== Terminology ==========
  http.get(`${API_BASE}/terminology/mappings`, async () => {
    await delay(delayMs());
    let items: any[] = [];
    try { items = list<any>('term_mappings'); } catch {}
    const combined = [...items, ...TERM_MAPPINGS.filter((m) => !items.some((i) => i.id === m.id))];
    return HttpResponse.json(ok(combined));
  }),
  http.post(`${API_BASE}/terminology/mappings`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    const item = { id: `TM-${Date.now()}`, status: 'draft', updatedAt: new Date().toISOString().slice(0, 10), ...body };
    try { create('term_mappings', item); } catch {}
    return HttpResponse.json(ok(item), { status: 201 });
  }),
  http.delete(`${API_BASE}/terminology/mappings/:id`, async ({ params }) => {
    await delay(delayMs());
    try { remove('term_mappings', params.id as string); } catch {}
    return HttpResponse.json({ success: true, data: {} });
  }),
  http.get(`${API_BASE}/terminology/systems`, async () => {
    await delay(delayMs());
    return HttpResponse.json(ok(TERM_SYSTEMS));
  }),
  http.get(`${API_BASE}/terminology/stats`, async () => {
    await delay(delayMs());
    return HttpResponse.json(ok({
      totalConcepts: TERM_SYSTEMS.reduce((s, x) => s + x.concepts, 0),
      totalMappings: TERM_MAPPINGS.length,
      systems: TERM_SYSTEMS.length,
      activeMappings: TERM_MAPPINGS.filter((m) => m.status === 'active').length,
      onlineSystems: TERM_SYSTEMS.filter((s) => s.status === 'online').length,
    }));
  }),

  // ========== Clinical Pathways ==========
  http.get(`${API_BASE}/clinical-pathways`, async () => {
    await delay(delayMs());
    return HttpResponse.json(ok(PATHWAYS));
  }),
  http.get(`${API_BASE}/clinical-pathways/stats`, async () => {
    await delay(delayMs());
    return HttpResponse.json(ok({
      active: PATHWAYS.filter((p) => p.status === 'active').length,
      paused: PATHWAYS.filter((p) => p.status === 'paused').length,
      totalPatients: PATHWAY_PATIENTS.length,
      onTrack: PATHWAY_PATIENTS.filter((p) => p.status === 'on-track').length,
      delayed: PATHWAY_PATIENTS.filter((p) => p.status === 'delayed').length,
    }));
  }),
  http.get(`${API_BASE}/clinical-pathways/patients`, async () => {
    await delay(delayMs());
    return HttpResponse.json(ok(PATHWAY_PATIENTS));
  }),
  http.get(`${API_BASE}/clinical-pathways/:id/steps`, async ({ params }) => {
    await delay(delayMs());
    const p = PATHWAY_PATIENTS.find((x) => x.id === params.id) ?? PATHWAY_PATIENTS[0];
    return HttpResponse.json(ok(p?.steps ?? []));
  }),
  // [G005 W2-B] 患者路径追踪: 推进阶段 / 退出路径 (前端操作列真实化)
  http.post(`${API_BASE}/clinical-pathways/patients/:id/advance`, async ({ params }) => {
    await delay(delayMs());
    const p = PATHWAY_PATIENTS.find((x) => x.id === params.id);
    if (!p) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: '患者未在路径内' } }, { status: 404 });
    if (p.step < p.totalSteps) {
      p.step += 1;
      if (p.step >= p.totalSteps) p.status = 'completed';
    }
    return HttpResponse.json(ok(p));
  }),
  http.post(`${API_BASE}/clinical-pathways/patients/:id/exit`, async ({ params }) => {
    await delay(delayMs());
    const idx = PATHWAY_PATIENTS.findIndex((x) => x.id === params.id);
    if (idx < 0) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: '患者未在路径内' } }, { status: 404 });
    PATHWAY_PATIENTS.splice(idx, 1);
    return HttpResponse.json(ok({ deleted: true }));
  }),
  http.post(`${API_BASE}/clinical-pathways/:id/toggle`, async ({ params, request }) => {
    await delay(delayMs());
    const body = (await request.json()) as { status?: string };
    const target = PATHWAYS.find((p) => p.id === params.id);
    const status = body?.status ?? (target?.status === 'active' ? 'paused' : 'active');
    return HttpResponse.json(ok({ id: params.id, status }));
  }),
  http.post(`${API_BASE}/clinical-pathways/enroll`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    const item = {
      id: `PP-${Date.now()}`,
      patient: body?.patientName ?? '新患者',
      pathway: body?.pathwayName ?? '未指定路径',
      step: 1,
      totalSteps: 8,
      status: 'on-track',
      enteredAt: new Date().toISOString().slice(0, 10),
      variance: null,
      steps: ['门诊评估', '术前检查', '会诊', '宣教', '治疗', '观察', '随访', '复查'],
    };
    return HttpResponse.json(ok(item), { status: 201 });
  }),

  // ========== Consent Education ==========
  http.get(`${API_BASE}/consent-education/consents`, async () => {
    await delay(delayMs());
    let items: any[] = [];
    try { items = list<any>('consents'); } catch {}
    const combined = [...items, ...CONSENTS.filter((c) => !items.some((i) => i.id === c.id))];
    return HttpResponse.json(ok(combined));
  }),
  http.post(`${API_BASE}/consent-education/consents`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    const item = {
      id: `C-${Date.now()}`,
      patient: body?.patient ?? '新患者',
      type: body?.type ?? 'General',
      procedure: body?.procedure ?? '标准诊疗流程',
      signedAt: null,
      status: 'pending',
      witness: null,
      createdAt: new Date().toISOString().slice(0, 10),
    };
    try { create('consents', item); } catch {}
    return HttpResponse.json(ok(item), { status: 201 });
  }),
  http.patch(`${API_BASE}/consent-education/consents/:id`, async ({ params, request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    let items: any[] = [];
    try { items = list<any>('consents'); } catch {}
    const existing = items.find((i) => i.id === params.id) ?? CONSENTS.find((i) => i.id === params.id) ?? { id: params.id };
    const updated = { ...existing, ...body };
    try { update('consents', params.id as string, updated); } catch {}
    return HttpResponse.json(ok(updated));
  }),
  http.get(`${API_BASE}/consent-education/materials`, async () => {
    await delay(delayMs());
    return HttpResponse.json(ok(EDUCATION_MATERIALS));
  }),
  http.post(`${API_BASE}/consent-education/materials`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    const item = {
      id: `M-${Date.now()}`,
      lang: body?.lang ?? 'zh-CN',
      category: body?.category ?? 'General',
      pages: body?.pages ?? 1,
      views: 0,
      format: body?.format ?? 'PDF',
      createdAt: new Date().toISOString().slice(0, 10),
      ...body,
    };
    return HttpResponse.json(ok(item), { status: 201 });
  }),

  // [v3.0.6.11-88 Round10] 新路径 /records* + /education-materials* (与后端 consent-education.controller 对齐, 同存储)
  http.get(`${API_BASE}/consent-education/records`, async () => {
    await delay(delayMs());
    let items: any[] = [];
    try { items = list<any>('consents'); } catch {}
    const combined = [...items, ...CONSENTS.filter((c) => !items.some((i) => i.id === c.id))];
    return HttpResponse.json(ok(combined));
  }),
  http.post(`${API_BASE}/consent-education/records`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    const item = {
      id: `C-${Date.now()}`,
      patient: body?.patient ?? '新患者',
      type: body?.type ?? 'General',
      procedure: body?.procedure ?? '标准诊疗流程',
      signedAt: null,
      status: 'pending',
      witness: null,
      createdAt: new Date().toISOString().slice(0, 10),
    };
    try { create('consents', item); } catch {}
    return HttpResponse.json(ok(item), { status: 201 });
  }),
  http.get(`${API_BASE}/consent-education/records/:id`, async ({ params }) => {
    await delay(delayMs());
    let items: any[] = [];
    try { items = list<any>('consents'); } catch {}
    const found = items.find((i) => i.id === params.id) ?? CONSENTS.find((i) => i.id === params.id);
    if (!found) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: '记录不存在' } }, { status: 404 });
    return HttpResponse.json(ok(found));
  }),
  http.patch(`${API_BASE}/consent-education/records/:id`, async ({ params, request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    let items: any[] = [];
    try { items = list<any>('consents'); } catch {}
    const existing = items.find((i) => i.id === params.id) ?? CONSENTS.find((i) => i.id === params.id) ?? { id: params.id };
    const updated = { ...existing, ...body };
    try { update('consents', params.id as string, updated); } catch {}
    return HttpResponse.json(ok(updated));
  }),
  http.post(`${API_BASE}/consent-education/records/:id/sign`, async ({ params, request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    let items: any[] = [];
    try { items = list<any>('consents'); } catch {}
    const existing = items.find((i) => i.id === params.id) ?? CONSENTS.find((i) => i.id === params.id) ?? { id: params.id };
    const updated = { ...existing, status: 'signed', signedAt: new Date().toLocaleString('zh-CN', { hour12: false }), signedBy: body?.signer ?? '当前用户', witness: existing.witness ?? '护士站' };
    try { update('consents', params.id as string, updated); } catch {}
    return HttpResponse.json(ok(updated));
  }),
  http.get(`${API_BASE}/consent-education/education-materials`, async () => {
    await delay(delayMs());
    return HttpResponse.json(ok(EDUCATION_MATERIALS));
  }),
  http.get(`${API_BASE}/consent-education/education-materials/:id`, async ({ params }) => {
    await delay(delayMs());
    const found = EDUCATION_MATERIALS.find((m) => m.id === params.id);
    if (!found) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: '材料不存在' } }, { status: 404 });
    return HttpResponse.json(ok(found));
  }),
  http.post(`${API_BASE}/consent-education/education-materials`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    const item = {
      id: `M-${Date.now()}`,
      lang: body?.lang ?? 'zh-CN',
      category: body?.category ?? 'General',
      pages: body?.pages ?? 1,
      views: 0,
      format: body?.format ?? 'PDF',
      createdAt: new Date().toISOString().slice(0, 10),
      ...body,
    };
    return HttpResponse.json(ok(item), { status: 201 });
  }),
  http.patch(`${API_BASE}/consent-education/education-materials/:id`, async ({ params, request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    const existing = EDUCATION_MATERIALS.find((m) => m.id === params.id) ?? { id: params.id };
    return HttpResponse.json(ok({ ...existing, ...body }));
  }),

  // ========== Dental AI findings ==========
  http.get(`${API_BASE}/dental/ai-findings`, async () => {
    await delay(delayMs());
    let items: any[] = [];
    try { items = list<any>('dental_ai_findings'); } catch {}
    const combined = [...items, ...AI_FINDINGS.filter((f) => !items.some((i) => i.id === f.id))];
    return HttpResponse.json(ok(combined));
  }),
  http.post(`${API_BASE}/dental/ai-findings`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    const item = { id: `AF-${Date.now()}`, status: 'pending', createdAt: new Date().toISOString(), ...body };
    try { create('dental_ai_findings', item); } catch {}
    return HttpResponse.json(ok(item), { status: 201 });
  }),

  // ========== Critical value 5-step workflow ==========
  http.get(`${API_BASE}/critical/value5step/list`, async () => {
    await delay(delayMs());
    let items: any[] = [];
    try { items = list<any>('value5step'); } catch {}
    const combined = [...items, ...VALUE5STEP.filter((v) => !items.some((i) => i.id === v.id))];
    return HttpResponse.json(ok(combined));
  }),
  http.patch(`${API_BASE}/critical/value5step/:id`, async ({ params, request }) => {
    await delay(delayMs());
    const body = (await request.json()) as any;
    let items: any[] = [];
    try { items = list<any>('value5step'); } catch {}
    const existing = items.find((i) => i.id === params.id) ?? VALUE5STEP.find((i) => i.id === params.id) ?? { id: params.id, steps: {} };
    const updated = { ...existing, ...body };
    try { update('value5step', params.id as string, updated); } catch {}
    return HttpResponse.json(ok(updated));
  }),
];
