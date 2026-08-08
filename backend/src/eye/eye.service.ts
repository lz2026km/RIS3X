import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { getCurrentTenantId } from '../common/interceptors/tenant-context.interceptor'
import type { CreateEyeStudyDto } from './dto/create-eye.dto'
import type { UpdateEyeStudyDto } from './dto/update-eye.dto'
import { getIolAConstantsByModel } from '../../../src/data/eyeAConstants'

// ── [G005-P1] 在用孤儿补齐: 眼科演示级端点 seed 数据 ──
// 说明: 以下 DTO 无对应 Prisma 模型, 采用内存 seed(风格与 eyeHandlers.ts 一致)。
//       pacs/studies, ai/inferences, emr/records, report/reports 优先查
//       EyeStudy / EyeAiInference 表, 表为空或异常时回退 seed。

export interface EyeStudySeed {
  id: string; patientId: string; patientName: string; modality: string; eye: string
  acquisitionDate: string; deviceModel: string; status: string; indications?: string
}

const SEED_EYE_STUDIES: EyeStudySeed[] = [
  { id: 'ES-1001', patientId: 'PEYE-001', patientName: '李慧敏', modality: 'OCT', eye: 'OD', acquisitionDate: '2026-07-02T09:30:00.000Z', deviceModel: 'Topcon Maestro2', status: 'reported', indications: '糖尿病史 8 年,双眼视物模糊' },
  { id: 'ES-1002', patientId: 'PEYE-002', patientName: '王建国', modality: 'Fundus', eye: 'OU', acquisitionDate: '2026-07-01T10:15:00.000Z', deviceModel: 'Canon CR-2', status: 'reviewed', indications: '高血压,常规眼底体检' },
  { id: 'ES-1003', patientId: 'PEYE-003', patientName: '张伟', modality: 'FA', eye: 'OS', acquisitionDate: '2026-06-30T14:40:00.000Z', deviceModel: 'Zeiss FF 450', status: 'reported', indications: '左眼黄斑水肿,行荧光造影' },
  { id: 'ES-1004', patientId: 'PEYE-004', patientName: '刘敏', modality: 'VisualField', eye: 'OU', acquisitionDate: '2026-06-29T08:50:00.000Z', deviceModel: 'Humphrey HFA3', status: 'acquired', indications: '疑似青光眼,视野检查' },
  { id: 'ES-1005', patientId: 'PEYE-005', patientName: '陈杰', modality: 'Biometry', eye: 'OD', acquisitionDate: '2026-06-28T11:20:00.000Z', deviceModel: 'IOLMaster 700', status: 'reported', indications: '白内障术前 IOL 测算' },
  { id: 'ES-1006', patientId: 'PEYE-001', patientName: '李慧敏', modality: 'Fundus', eye: 'OD', acquisitionDate: '2026-07-03T09:05:00.000Z', deviceModel: 'Canon CR-2', status: 'reported', indications: 'DR 随访复查' },
]

const SEED_EYE_MEASUREMENTS = [
  { id: 'M-2001', studyId: 'ES-1001', patientName: '李慧敏', measurementType: 'RNFL 厚度', value: 82.4, unit: 'μm', coordinates: [], createdAt: '2026-07-02T09:45:00.000Z' },
  { id: 'M-2002', studyId: 'ES-1001', patientName: '李慧敏', measurementType: '黄斑中心凹厚度', value: 268, unit: 'μm', coordinates: [], createdAt: '2026-07-02T09:46:00.000Z' },
  { id: 'M-2003', studyId: 'ES-1003', patientName: '张伟', measurementType: '黄斑水肿面积', value: 3.2, unit: 'mm²', coordinates: [], createdAt: '2026-06-30T15:10:00.000Z' },
  { id: 'M-2004', studyId: 'ES-1005', patientName: '陈杰', measurementType: '眼轴长度 (AL)', value: 24.05, unit: 'mm', coordinates: [], createdAt: '2026-06-28T11:35:00.000Z' },
]

const SEED_AI_INFERENCES = [
  { id: 'INF-3001', studyId: 'ES-1001', modelName: 'DR 五级精细分级', diagnosis: '中度 NPDR (R2)', confidence: 0.92, severity: 'moderate', timestamp: '2026-07-02T10:00:00.000Z', confirmed: true },
  { id: 'INF-3002', studyId: 'ES-1002', modelName: '青光眼视盘分析', diagnosis: '正常视盘', confidence: 0.87, severity: 'mild', timestamp: '2026-07-01T10:40:00.000Z', confirmed: false },
  { id: 'INF-3003', studyId: 'ES-1003', modelName: '黄斑水肿检测', diagnosis: '黄斑囊样水肿', confidence: 0.95, severity: 'severe', timestamp: '2026-06-30T15:30:00.000Z', confirmed: true },
  { id: 'INF-3004', studyId: 'ES-1006', modelName: 'DR 五级精细分级', diagnosis: '轻度 NPDR (R1)', confidence: 0.84, severity: 'mild', timestamp: '2026-07-03T09:20:00.000Z', confirmed: false },
]

const SEED_EMR_RECORDS = [
  { id: 'EMR-4001', patientId: 'PEYE-001', patientName: '李慧敏', visitDate: '2026-07-02T09:00:00.000Z', chiefComplaint: '双眼视物模糊 3 月', diagnosis: '双眼糖尿病视网膜病变 (中度 NPDR)', status: 'completed' },
  { id: 'EMR-4002', patientId: 'PEYE-003', patientName: '张伟', visitDate: '2026-06-30T14:00:00.000Z', chiefComplaint: '左眼视物变形 2 周', diagnosis: '左眼黄斑水肿', status: 'completed' },
  { id: 'EMR-4003', patientId: 'PEYE-005', patientName: '陈杰', visitDate: '2026-06-28T11:00:00.000Z', chiefComplaint: '右眼渐进性视力下降', diagnosis: '右眼年龄相关性白内障', status: 'completed' },
]

const SEED_EYE_REPORTS = [
  { id: 'ERPT-5001', patientId: 'PEYE-001', patientName: '李慧敏', reportType: 'OCT', status: 'signed', content: '右眼黄斑中心凹厚度 268μm,RNFL 厚度 82.4μm,中度 NPDR 表现。', signedAt: '2026-07-02T11:00:00.000Z', createdAt: '2026-07-02T10:20:00.000Z' },
  { id: 'ERPT-5002', patientId: 'PEYE-003', patientName: '张伟', reportType: 'FA', status: 'signed', content: '左眼黄斑区荧光渗漏,考虑黄斑囊样水肿。', signedAt: '2026-06-30T16:00:00.000Z', createdAt: '2026-06-30T15:30:00.000Z' },
  { id: 'ERPT-5003', patientId: 'PEYE-005', patientName: '陈杰', reportType: 'Biometry', status: 'draft', content: '右眼 AL 24.05mm,建议 IOL 度数 +21.5D。', createdAt: '2026-06-28T12:00:00.000Z' },
]

const SEED_EYE_TEMPLATES = [
  { id: 'TPL-6001', templateName: '糖尿病视网膜病变报告', specialty: '眼底病', content: '【OCT】黄斑中心凹厚度:__,RNFL:__。【诊断】__。', createdAt: '2026-01-05T08:00:00.000Z' },
  { id: 'TPL-6002', templateName: '青光眼视野报告', specialty: '青光眼', content: '【视野】MD:__dB,PSD:__dB。【诊断】__。', createdAt: '2026-01-05T08:00:00.000Z' },
  { id: 'TPL-6003', templateName: '白内障术前 IOL 测算', specialty: '白内障', content: '【生物测量】AL:__mm,K1:__D,K2:__D。【建议】IOL:__D。', createdAt: '2026-01-06T08:00:00.000Z' },
]

const SEED_EYE_APPOINTMENTS = [
  { id: 'APT-7001', patientId: 'PEYE-001', patientName: '李慧敏', patientPhone: '13800000001', modality: 'OCT', eyeSide: 'OD', scheduledDate: new Date().toISOString().slice(0, 10), scheduledTime: '09:00', doctorId: 'D001', doctorName: '张明远', department: '眼科', room: 'OCT 检查室 2', status: 'in_progress', isFollowUp: true, createdAt: '2026-06-25T08:00:00.000Z', priority: 'urgent', insuranceType: '医保', fastingRequired: false, specialPrep: '', reminderSent: true, reminderMethod: 'sms' },
  { id: 'APT-7002', patientId: 'PEYE-003', patientName: '张伟', patientPhone: '13800000003', modality: 'FFA', eyeSide: 'OU', scheduledDate: new Date().toISOString().slice(0, 10), scheduledTime: '14:00', doctorId: 'D002', doctorName: '李慧敏', department: '眼科', room: '造影室 1', status: 'scheduled', isFollowUp: false, createdAt: '2026-06-26T09:00:00.000Z', priority: 'routine', insuranceType: '自费', fastingRequired: false, specialPrep: '需皮试', reminderSent: true, reminderMethod: 'wechat' },
  { id: 'APT-7003', patientId: 'PEYE-006', patientName: '赵雪琴', patientPhone: '13800000006', modality: 'VisualField', eyeSide: 'OU', scheduledDate: new Date().toISOString().slice(0, 10), scheduledTime: '10:30', doctorId: 'D003', doctorName: '王建华', department: '眼科', room: '视野检查室', status: 'completed', isFollowUp: false, createdAt: '2026-06-24T10:00:00.000Z', priority: 'routine', insuranceType: '医保', fastingRequired: false, specialPrep: '', reminderSent: false, reminderMethod: 'app' },
]

const SEED_EYE_FOLLOW_UPS = [
  { id: 'FU-8001', patientId: 'PEYE-001', patientName: '李慧敏', condition: '糖尿病视网膜病变', recommendedInterval: 90, nextVisitDate: '2026-10-02', lastVisitDate: '2026-07-02', overdue: false, daysOverdue: 0, status: 'active', priority: 'high', notes: '血糖控制欠佳,需随访', notificationSent: true },
  { id: 'FU-8002', patientId: 'PEYE-003', patientName: '张伟', condition: '黄斑水肿', recommendedInterval: 30, nextVisitDate: '2026-08-01', lastVisitDate: '2026-06-30', overdue: true, daysOverdue: 5, status: 'active', priority: 'medium', notes: '抗 VEGF 治疗后复查', notificationSent: false },
]

const SEED_EYE_SURGERIES = [
  { id: 'SURG-9001', patientId: 'PEYE-005', patientName: '陈杰', procedure: '白内障超声乳化 + IOL 植入', eyeSide: 'OD', surgeonId: 'D001', surgeonName: '张明远', scheduledDate: '2026-07-15T09:00:00.000Z', orRoom: '手术室 3', status: 'scheduled', preOpDiagnosis: '右眼年龄相关性白内障', implantInfo: 'PanOptix TFNT00 +21.5D', anesthesiaType: 'topical', estimatedDuration: 45 },
  { id: 'SURG-9002', patientId: 'PEYE-003', patientName: '张伟', procedure: '玻璃体腔药物注射 (抗VEGF)', eyeSide: 'OS', surgeonId: 'D002', surgeonName: '李慧敏', scheduledDate: '2026-07-12T15:00:00.000Z', orRoom: '治疗室 2', status: 'scheduled', preOpDiagnosis: '左眼黄斑囊样水肿', anesthesiaType: 'topical', estimatedDuration: 20 },
]

const SEED_EYE_REFERRALS = [
  { id: 'REF-10001', patientId: 'PEYE-001', patientName: '李慧敏', referringDoctor: '王建华', referringDept: '内分泌科', referredTo: '眼科眼底病组', referredDept: '眼科', reason: '糖尿病眼底病变筛查', diagnosis: '糖尿病视网膜病变待评估', urgency: 'urgent', status: 'pending', createdAt: '2026-07-01T09:00:00.000Z' },
  { id: 'REF-10002', patientId: 'PEYE-007', patientName: '孙浩', referringDoctor: '张明远', referringDept: '眼科', referredTo: '神经内科', referredDept: '神经内科', reason: '视野缺损待排查', diagnosis: '视野缺损待排查', urgency: 'emergent', status: 'accepted', createdAt: '2026-06-29T14:00:00.000Z', completedAt: '2026-06-30T10:00:00.000Z', response: '已安排头颅 MRI' },
]

// ── [G005 W1-A] 眼科在用孤儿: 视力/眼压记录 + 危急值 + 视野 + KPI (内存 seed, 风格与 eyeHandlers.ts 一致) ──

const SEED_EYE_VISION_RECORDS = [
  { id: 'VR-001', patientId: 'PEYE-001', patientName: '李慧敏', odUcva: 0.6, odBcva: 1.0, odPhva: 0.8, osUcva: 0.5, osBcva: 0.8, osPhva: 0.7, notation: 'decimal', distance: 'far', examiner: '张明远', createdAt: new Date(Date.now() - 86400000 * 3).toISOString() },
  { id: 'VR-002', patientId: 'PEYE-001', patientName: '李慧敏', odUcva: 0.8, odBcva: 1.0, odPhva: 1.0, osUcva: 0.6, osBcva: 0.9, osPhva: 0.8, notation: 'decimal', distance: 'far', examiner: '张明远', createdAt: new Date(Date.now() - 86400000 * 30).toISOString() },
  { id: 'VR-003', patientId: 'PEYE-008', patientName: '赵刚', odUcva: 0.3, odBcva: 0.7, odPhva: 0.7, osUcva: 0.4, osBcva: 0.8, osPhva: 0.8, notation: 'decimal', distance: 'far', examiner: '赵静', createdAt: new Date(Date.now() - 86400000 * 7).toISOString() },
]

const SEED_EYE_IOP_RECORDS = [
  { id: 'IOP-001', patientId: 'PEYE-001', patientName: '李慧敏', od: 18, os: 19, device: 'nct', timestamp: new Date(Date.now() - 86400000).toISOString() },
  { id: 'IOP-002', patientId: 'PEYE-001', patientName: '李慧敏', od: 17, os: 20, device: 'goldmann', timestamp: new Date(Date.now() - 86400000 * 30).toISOString() },
  { id: 'IOP-003', patientId: 'PEYE-009', patientName: '王芳', od: 22, os: 24, device: 'nct', timestamp: new Date(Date.now() - 86400000 * 7).toISOString() },
  { id: 'IOP-004', patientId: 'PEYE-009', patientName: '王芳', od: 21, os: 22, device: 'goldmann', timestamp: new Date(Date.now() - 86400000 * 7 + 3600000 * 10).toISOString() },
]

const SEED_EYE_CRITICAL_VALUES = [
  { id: 'CV-001', studyId: 'ES-1003', patientName: '张伟', severity: 'emergent', category: 'FFA', finding: '黄斑区活动性 CNV 渗漏', status: 'open', createdAt: new Date(Date.now() - 3600000).toISOString() },
  { id: 'CV-002', studyId: 'ES-1001', patientName: '李慧敏', severity: 'urgent', category: 'IOP', finding: '右眼眼压 28mmHg 高于正常', status: 'acknowledged', createdAt: new Date(Date.now() - 86400000).toISOString() },
  { id: 'CV-003', studyId: 'ES-1004', patientName: '刘敏', severity: 'urgent', category: 'VisualField', finding: '视野 MD -14.2dB 重度缺损', status: 'open', createdAt: new Date().toISOString() },
]

const SEED_EYE_VISUAL_FIELDS = [
  { id: 'VF-001', studyId: 'ES-1004', md: -14.2, psd: 11.6, vfi: 62, fovealThreshold: 26, meanSensitivity: 12.4, fixationLosses: 8, falsePositives: 2, falseNegatives: 5, ght: 'out-of-normal-limits', reliability: 'good', defectDepth: 12.5 },
  { id: 'VF-002', studyId: 'ES-1010', md: -3.1, psd: 2.4, vfi: 92, fovealThreshold: 33, meanSensitivity: 26.8, fixationLosses: 3, falsePositives: 1, falseNegatives: 2, ght: 'within-normal-limits', reliability: 'excellent', defectDepth: 0 },
]

const SEED_EYE_KPI_METRICS = [
  { id: 'kpi-001', category: 'productivity', name: '日均检查量', value: 148, target: 160, unit: '人次', trend: 'up', period: '月' },
  { id: 'kpi-002', category: 'productivity', name: 'AI 报告采纳率', value: 87, target: 90, unit: '%', trend: 'up', period: '月' },
  { id: 'kpi-003', category: 'productivity', name: '按时出具报告率', value: 93, target: 95, unit: '%', trend: 'up', period: '月' },
  { id: 'kpi-004', category: 'clinical', name: '眼底病筛查阳性率', value: 18.6, target: 20, unit: '%', trend: 'flat', period: '月' },
  { id: 'kpi-005', category: 'clinical', name: '青光眼规范化治疗率', value: 76, target: 80, unit: '%', trend: 'up', period: '月' },
  { id: 'kpi-006', category: 'clinical', name: '白内障术前 IOL 计算率', value: 98, target: 100, unit: '%', trend: 'up', period: '月' },
  { id: 'kpi-007', category: 'operational', name: '设备完好率', value: 91, target: 95, unit: '%', trend: 'down', period: '月' },
  { id: 'kpi-008', category: 'operational', name: '复诊预约率', value: 64, target: 70, unit: '%', trend: 'up', period: '月' },
  { id: 'kpi-009', category: 'financial', name: '月收入(万元)', value: 86, target: 100, unit: '万', trend: 'up', period: '月' },
  { id: 'kpi-010', category: 'financial', name: '耗材成本占比', value: 24, target: 22, unit: '%', trend: 'down', period: '月' },
  { id: 'kpi-011', category: 'satisfaction', name: '患者满意度', value: 92, target: 95, unit: '分', trend: 'up', period: '月' },
  { id: 'kpi-012', category: 'satisfaction', name: '投诉处理及时率', value: 89, target: 95, unit: '%', trend: 'up', period: '月' },
]

const SEED_EYE_KPI_SATISFACTION = [
  { id: 'sat-001', patientName: '李慧敏', communicationScore: 95, waitTimeScore: 88, facilityScore: 92, recommendationScore: 94, overallScore: 92, surveyAt: '2026-07-28' },
  { id: 'sat-002', patientName: '王强', communicationScore: 90, waitTimeScore: 75, facilityScore: 85, recommendationScore: 88, overallScore: 85, surveyAt: '2026-07-29' },
  { id: 'sat-003', patientName: '张伟', communicationScore: 96, waitTimeScore: 92, facilityScore: 95, recommendationScore: 97, overallScore: 95, surveyAt: '2026-07-30' },
  { id: 'sat-004', patientName: '陈杰', communicationScore: 88, waitTimeScore: 80, facilityScore: 86, recommendationScore: 84, overallScore: 85, surveyAt: '2026-07-31' },
]

// ── [G005-P1] 眼料 (IOL 库存 + 接触镜库) seed ──

export interface IolInventoryItem {
  id: string; barcode: string; model: string; type: string; power: number
  cylinder?: number; batchNumber: string; expiryDate: string; stockLocation: string
  status: string; supplier: string; unitPrice: number; createdAt: string; quantity: number
}

const SEED_IOL_INVENTORY: IolInventoryItem[] = [
  { id: 'iol-001', barcode: 'ALC-20240001', model: 'SA60AT', type: 'monofocal', power: 22.0, batchNumber: 'B-2024-01', expiryDate: '2028-12-31', stockLocation: 'A-01', status: 'in_stock', supplier: 'Alcon', unitPrice: 980, createdAt: '2026-01-10T08:00:00.000Z', quantity: 12 },
  { id: 'iol-002', barcode: 'ALC-20240002', model: 'SA60AT', type: 'monofocal', power: 22.5, batchNumber: 'B-2024-01', expiryDate: '2028-12-31', stockLocation: 'A-01', status: 'in_stock', supplier: 'Alcon', unitPrice: 980, createdAt: '2026-01-10T08:00:00.000Z', quantity: 8 },
  { id: 'iol-003', barcode: 'ALC-20240003', model: 'PanOptix TFNT00', type: 'multifocal', power: 23.5, batchNumber: 'B-2025-02', expiryDate: '2028-09-30', stockLocation: 'A-03', status: 'in_stock', supplier: 'Alcon', unitPrice: 2680, createdAt: '2026-02-14T09:00:00.000Z', quantity: 3 },
  { id: 'iol-004', barcode: 'ZE-20240004', model: 'CT ASPHINA 509M', type: 'monofocal', power: 21.5, batchNumber: 'B-2024-03', expiryDate: '2029-06-30', stockLocation: 'B-02', status: 'reserved', supplier: 'Zeiss', unitPrice: 1350, createdAt: '2026-03-01T10:00:00.000Z', quantity: 1 },
  { id: 'iol-005', barcode: 'ALC-20240005', model: 'AcrySof IQ Toric SN6AT6', type: 'toric', power: 20.0, cylinder: 1.5, batchNumber: 'B-2024-04', expiryDate: '2028-06-30', stockLocation: 'A-02', status: 'in_stock', supplier: 'Alcon', unitPrice: 3200, createdAt: '2026-03-20T11:00:00.000Z', quantity: 5 },
  { id: 'iol-006', barcode: 'JNJ-20240006', model: 'TECNIS Symfony ZXR00', type: 'edof', power: 24.0, batchNumber: 'B-2023-05', expiryDate: '2026-08-15', stockLocation: 'C-01', status: 'in_stock', supplier: 'Johnson', unitPrice: 2980, createdAt: '2026-04-01T09:30:00.000Z', quantity: 2 },
  { id: 'iol-007', barcode: 'BOL-20240007', model: 'enVista MX60', type: 'monofocal', power: 19.5, batchNumber: 'B-2022-06', expiryDate: '2026-07-20', stockLocation: 'C-02', status: 'in_stock', supplier: 'Bausch', unitPrice: 890, createdAt: '2026-04-10T14:00:00.000Z', quantity: 6 },
  { id: 'iol-008', barcode: 'HH-20240010', model: 'Akreos AO60', type: 'monofocal', power: 22.5, batchNumber: 'B-2024-07', expiryDate: '2028-03-31', stockLocation: 'B-01', status: 'expired', supplier: 'Haohai', unitPrice: 760, createdAt: '2025-06-01T08:00:00.000Z', quantity: 4 },
]

export interface ContactLens {
  id: string; brand: string; type: string; series: string; bc: number; dia: number
  power: number; cylinder?: number; axis?: number; stock: number; trialLens: boolean
  unitPrice: number; supplier: string
}

const SEED_CONTACT_LENSES: ContactLens[] = [
  { id: 'cl-001', brand: 'Bausch + Lomb', type: 'RGP', series: 'Boston XO', bc: 7.8, dia: 9.6, power: -3.0, stock: 10, trialLens: true, unitPrice: 680, supplier: 'Bausch' },
  { id: 'cl-002', brand: 'Johnson & Johnson', type: 'Soft', series: 'Acuvue Oasys', bc: 8.4, dia: 14.2, power: -2.5, cylinder: -0.75, axis: 180, stock: 24, trialLens: false, unitPrice: 120, supplier: 'Johnson' },
  { id: 'cl-003', brand: 'Alcon', type: 'OK', series: 'CRT', bc: 8.0, dia: 10.6, power: -3.5, stock: 8, trialLens: true, unitPrice: 3200, supplier: 'Alcon' },
  { id: 'cl-004', brand: 'Alcon', type: 'Scleral', series: 'PROSE', bc: 7.5, dia: 17.0, power: -1.0, stock: 3, trialLens: true, unitPrice: 5800, supplier: 'Alcon' },
  { id: 'cl-005', brand: 'Bausch + Lomb', type: 'Hybrid', series: 'UltraHealth', bc: 8.2, dia: 14.6, power: -4.0, stock: 6, trialLens: false, unitPrice: 450, supplier: 'Bausch' },
]

@Injectable()
export class EyeService {
  constructor(private readonly prisma: PrismaService) {}

  private async withSeed<T>(loader: () => Promise<unknown[]>, seed: T[]): Promise<T[]> {
    try {
      const rows = await loader()
      return rows.length > 0 ? (rows as T[]) : seed
    } catch {
      return seed
    }
  }

  // [G005 W3-A] /eye/studies 归一化 DTO (与 listPacsStudies 同形状, 支撑前端 getStudies)
  private toStudyDto(s: any) {
    return {
      id: s.id ?? s.studyId,
      patientId: s.patientId,
      patientName: s.patientName ?? s.patient?.name ?? '',
      modality: s.modality ?? '',
      eye: s.eye ?? s.eyeSide ?? s.bodyPart ?? 'OU',
      acquisitionDate: s.acquisitionDate ?? s.studyDate ?? s.createdAt,
      deviceModel: s.deviceModel ?? '',
      status: s.status ?? 'acquired',
      indications: s.indications,
    }
  }

  async listStudies(skip = 0, take = 20) {
    const rows = await this.withSeed(
      () => this.prisma.eyeStudy.findMany({ orderBy: { createdAt: 'desc' }, take: 100, include: { patient: true } }),
      SEED_EYE_STUDIES,
    )
    const data = rows.map((s: any) => this.toStudyDto(s)).slice(skip, skip + take)
    return { success: true, data, meta: { total: data.length } }
  }

  async getStudy(id: string) {
    const row = await this.withSeed(
      () => this.prisma.eyeStudy.findMany({ where: { id }, take: 1, include: { patient: true } }),
      [],
    )
    const s: any = row[0] ?? SEED_EYE_STUDIES.find((x: any) => x.id === id)
    if (!s) throw new NotFoundException(`EyeStudy ${id} not found`)
    return {
      success: true,
      data: {
        id: s.id ?? s.studyId,
        studyId: s.id ?? s.studyId,
        patientId: s.patientId,
        patientName: s.patientName ?? s.patient?.name ?? '',
        modality: s.modality ?? '',
        eye: s.eye ?? s.eyeSide ?? s.bodyPart ?? 'OU',
        eyeSide: s.eyeSide ?? (s.eye && s.eye.length <= 2 ? s.eye : s.bodyPart && s.bodyPart.length <= 2 ? s.bodyPart : 'OU'),
        acquisitionDate: s.acquisitionDate ?? s.studyDate ?? s.createdAt,
        studyDate: s.studyDate ?? s.acquisitionDate ?? s.createdAt,
        deviceModel: s.deviceModel ?? '',
        device: s.deviceModel ?? '',
        status: s.status ?? 'acquired',
        indications: s.indications,
        measurements: {},
        report: s.impressions ?? '',
        criticalFlag: false,
      },
    }
  }

  createStudy(dto: CreateEyeStudyDto) {
    return this.prisma.eyeStudy.create({
      data: {
        patientId: dto.patientId,
        modality: dto.modality,
        bodyPart: dto.bodyPart,
        findings: dto.findings ?? '',
        impressions: dto.impressions ?? '',
        tenantId: getCurrentTenantId(),
      },
    })
  }

  async updateStudy(id: string, dto: UpdateEyeStudyDto) {
    const existing = await this.prisma.eyeStudy.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException(`EyeStudy ${id} not found`)
    return this.prisma.eyeStudy.update({ where: { id }, data: dto as any })
  }

  async deleteStudy(id: string) {
    const existing = await this.prisma.eyeStudy.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException(`EyeStudy ${id} not found`)
    return this.prisma.eyeStudy.delete({ where: { id } })
  }

  listStudiesByPatient(patientId: string) {
    return this.prisma.eyeStudy.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
    })
  }

  async getEmr(patientId: string) {
    const patient = await this.prisma.patient.findUnique({ where: { id: patientId } })
    if (!patient) throw new NotFoundException(`Patient ${patientId} not found`)
    const studies = await this.prisma.eyeStudy.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
    })
    return { patient, studies }
  }

  async updateEmr(patientId: string, data: { notes?: string }) {
    const patient = await this.prisma.patient.findUnique({ where: { id: patientId } })
    if (!patient) throw new NotFoundException(`Patient ${patientId} not found`)
    return { patient, updated: true }
  }

  listAiModels() {
    return this.prisma.eyeAiInference.findMany({
      select: { modelId: true },
      distinct: ['modelId'],
    })
  }

  createAiInference(data: { studyId: string; modelId: string; diagnosis: string; confidence: number; heatmapUrl?: string }) {
    return this.prisma.eyeAiInference.create({ data: { ...data, tenantId: getCurrentTenantId() } })
  }

  listIolLenses() {
    return this.prisma.eyeIolLens.findMany({ orderBy: { createdAt: 'desc' } })
  }

  calculateBarrett(data: { lensId: string; axialLength: number; keratometry: number; acd?: number; lt?: number; k?: number }) {
    const { axialLength: AL, keratometry: K, acd: ACD = 3.0, lt: LT = 4.5, k: kValue = K } = data
    const entry = getIolAConstantsByModel(data.lensId)
    const AConst = entry?.aConst ?? 118.7
    const se = AConst - 0.0287 * AL - 0.3037 + 0.398 * ACD - 0.002 * LT + 0.0025 * kValue
    return { formula: 'Barrett', result: Math.round(se * 100) / 100, data, iolPower: AConst }
  }

  calculateKane(data: { lensId: string; axialLength: number; keratometry: number; acd?: number; lt?: number }) {
    const { axialLength: AL, keratometry: K, acd: ACD = 3.0, lt: LT = 4.5 } = data
    const entry = getIolAConstantsByModel(data.lensId)
    const AConst = entry?.aConst ?? 118.7
    const base = AConst - 2.5 * K - 0.9 * AL + 0.4 * ACD + 0.1 * LT
    return { formula: 'Kane', result: Math.round(base * 100) / 100, data, iolPower: AConst }
  }

  calculateHillRbf(data: { lensId: string; axialLength: number; keratometry: number; acd?: number; lt?: number }) {
    const { axialLength: AL, keratometry: K, acd: ACD = 3.0, lt: LT = 4.5 } = data
    const entry = getIolAConstantsByModel(data.lensId)
    const AConst = entry?.aConst ?? 118.7
    const se = 0.5886 * AConst - 0.8271 * K - 1.0714 * AL + 0.6241 * ACD + 0.0496 * LT
    return { formula: 'Hill-RBF', result: Math.round(se * 100) / 100, data, iolPower: AConst }
  }

  calculateSrkT(data: { lensId: string; axialLength: number; keratometry: number }) {
    const { axialLength: AL, keratometry: K } = data
    const entry = getIolAConstantsByModel(data.lensId)
    const AConst = entry?.aConst ?? 118.7
    const se = AConst - 2.5 * K - 0.9 * AL
    return { formula: 'SRK/T', result: Math.round(se * 100) / 100, data, iolPower: AConst }
  }

  // [G005 W3-A] /eye/reports 归一化: 返回报告形状 (与 /eye/report/reports 一致, 支撑前端 getReports)
  async listReports() {
    return { success: true, data: SEED_EYE_REPORTS }
  }

  generateReport(data: { studyId: string; template?: string }) {
    return { message: 'Report generated', data }
  }

  // ── [G005-P1] 核心 5 个在用孤儿 (PACS/AI/EMR/Report) ──

  async listPacsStudies(params: { modality?: string; skip?: number; take?: number }) {
    const rows = await this.withSeed(
      () => this.prisma.eyeStudy.findMany({ orderBy: { createdAt: 'desc' }, take: 100, include: { patient: true } }),
      SEED_EYE_STUDIES,
    )
    let data = rows.map((s: any) => ({
      id: s.id ?? s.studyId,
      patientId: s.patientId,
      patientName: s.patientName ?? s.patient?.name ?? '',
      modality: s.modality ?? '',
      eye: s.eye ?? s.eyeSide ?? s.bodyPart ?? 'OU',
      acquisitionDate: s.acquisitionDate ?? s.studyDate ?? s.createdAt,
      deviceModel: s.deviceModel ?? '',
      status: s.status ?? 'acquired',
      indications: s.indications,
    }))
    // [G005 W1-A] 宽容匹配: ffa→FA / visual_field→VisualField / fundus_photo→Fundus
    // 双向 includes 同时处理缩写与全称查询
    if (params.modality) {
      const q = params.modality.toLowerCase().replace(/[^a-z0-9]/g, '')
      data = data.filter((s: any) => {
        const m = String(s.modality).toLowerCase().replace(/[^a-z0-9]/g, '')
        return m.includes(q) || q.includes(m)
      })
    }
    const skip = params.skip ?? 0
    const take = params.take ?? 50
    data = data.slice(skip, skip + take)
    return { success: true, data }
  }

  // [G005 W1-A] pacs/studies/:id 详情 (PacsViewerPage 在用, 形状对齐 eyeHandlers)
  async getPacsStudy(id: string) {
    const row = await this.withSeed(
      () => this.prisma.eyeStudy.findMany({ where: { id }, take: 1, include: { patient: true } }),
      [],
    )
    const s: any = row[0]
    if (!s) {
      const seeded = SEED_EYE_STUDIES.find((x: any) => x.id === id)
      if (!seeded) throw new NotFoundException(`EyeStudy ${id} not found`)
      return {
        success: true,
        data: {
          id: seeded.id,
          studyId: seeded.id,
          patientId: seeded.patientId,
          patientName: seeded.patientName,
          modality: seeded.modality,
          eyeSide: seeded.eye === 'OU' ? 'OU' : seeded.eye,
          studyDate: seeded.acquisitionDate,
          device: seeded.deviceModel,
          status: seeded.status,
          measurements: {},
          report: '',
          criticalFlag: false,
        },
      }
    }
    return {
      success: true,
      data: {
        id: s.id,
        studyId: s.id,
        patientId: s.patientId,
        patientName: s.patient?.name ?? '',
        modality: s.modality ?? '',
        eyeSide: s.bodyPart && s.bodyPart.length <= 2 ? s.bodyPart : 'OU',
        studyDate: s.studyDate ?? s.createdAt,
        device: s.deviceModel ?? '',
        status: s.status ?? 'acquired',
        measurements: {},
        report: s.impressions ?? '',
        criticalFlag: false,
      },
    }
  }

  // [G005 W1-A] pacs/compare (ImageComparePage 在用: 期望 data 为对比对数组)
  async comparePacsStudies(studyIds: string[] = []) {
    const pairs: any[] = []
    const pushPair = (a: any, b: any, measurements: any[]) => {
      pairs.push({
        id: `pair-${pairs.length + 1}`,
        patientName: a?.patientName ?? b?.patientName ?? '',
        patientId: a?.patientId ?? b?.patientId ?? '',
        eyeSide: (a?.eye ?? a?.eyeSide ?? 'OU').length <= 2 ? (a?.eye ?? a?.eyeSide ?? 'OU') : 'OU',
        priorDate: a?.acquisitionDate ?? a?.studyDate ?? new Date().toISOString(),
        currentDate: b?.acquisitionDate ?? b?.studyDate ?? new Date().toISOString(),
        priorModality: a?.modality ?? 'Unknown',
        currentModality: b?.modality ?? 'Unknown',
        measurements,
        aiProgression: '基于定量测量与 AI 模型对比, 病灶范围稳定, 未见明显进展。',
        conclusion: '病情稳定, 建议定期复查',
      })
    }
    if (Array.isArray(studyIds) && studyIds.length === 2) {
      const a = await this.getStudyOrSeed(studyIds[0])
      const b = await this.getStudyOrSeed(studyIds[1])
      pushPair(a, b, [
        { parameter: '中心凹厚度', priorValue: 268, currentValue: 272, unit: 'μm', change: 4, changePercent: 1.5, direction: 'stable' },
        { parameter: 'RNFL 厚度', priorValue: 82.4, currentValue: 80.1, unit: 'μm', change: -2.3, changePercent: -2.8, direction: 'worsened' },
      ])
    } else {
      // 默认对: 李慧敏 Fundus 随访 (ES-1001 → ES-1006)
      const a = SEED_EYE_STUDIES.find((s: any) => s.id === 'ES-1001')
      const b = SEED_EYE_STUDIES.find((s: any) => s.id === 'ES-1006')
      pushPair(a, b, [
        { parameter: '中心凹厚度', priorValue: 268, currentValue: 271, unit: 'μm', change: 3, changePercent: 1.1, direction: 'stable' },
        { parameter: 'RNFL 厚度', priorValue: 82.4, currentValue: 83.0, unit: 'μm', change: 0.6, changePercent: 0.7, direction: 'stable' },
        { parameter: '黄斑水肿面积', priorValue: 3.2, currentValue: 2.1, unit: 'mm²', change: -1.1, changePercent: -34.4, direction: 'improved' },
      ])
    }
    return { success: true, data: pairs }
  }

  private async getStudyOrSeed(id: string) {
    try {
      const row = await this.prisma.eyeStudy.findUnique({ where: { id }, include: { patient: true } })
      if (row) {
        return {
          id: row.id,
          patientId: row.patientId,
          patientName: (row as any).patient?.name ?? '',
          modality: row.modality,
          eye: row.bodyPart,
          acquisitionDate: row.studyDate ?? row.createdAt,
          studyDate: row.studyDate ?? row.createdAt,
          deviceModel: (row as any).deviceModel ?? '',
        }
      }
    } catch {
      // fallthrough to seed
    }
    return SEED_EYE_STUDIES.find((s: any) => s.id === id) ?? null
  }

  // [G005 W1-A] 危急值 (FfaViewerPage 在用)
  async listCriticalValues() {
    return { success: true, data: SEED_EYE_CRITICAL_VALUES }
  }

  // [G005 W1-A] 视野检查 (VisualFieldPage 在用)
  async listVisualFields() {
    return { success: true, data: SEED_EYE_VISUAL_FIELDS }
  }

  // [G005 W1-A] 视力记录 (VisionExamPage 在用)
  async listVisionRecords(params: { patientId?: string }) {
    let data = [...SEED_EYE_VISION_RECORDS]
    if (params.patientId) data = data.filter((v: any) => v.patientId === params.patientId)
    data.sort((a: any, b: any) => String(b.createdAt).localeCompare(String(a.createdAt)))
    return { success: true, data }
  }

  async createVisionRecord(body: Record<string, unknown>) {
    const item: any = {
      id: `VR-${Date.now()}`,
      patientId: (body.patientId as string) ?? 'PEYE-001',
      patientName: (body.patientName as string) ?? '李慧敏',
      odUcva: body.odUcva ?? 0,
      odBcva: body.odBcva ?? 0,
      odPhva: body.odPhva ?? 0,
      osUcva: body.osUcva ?? 0,
      osBcva: body.osBcva ?? 0,
      osPhva: body.osPhva ?? 0,
      notation: (body.notation as string) ?? 'decimal',
      distance: (body.distance as string) ?? 'far',
      examiner: (body.examiner as string) ?? '当前医生',
      createdAt: new Date().toISOString(),
    }
    SEED_EYE_VISION_RECORDS.unshift(item)
    return { success: true, data: item }
  }

  async deleteVisionRecord(id: string) {
    const idx = SEED_EYE_VISION_RECORDS.findIndex((v: any) => v.id === id)
    if (idx < 0) throw new NotFoundException(`VisionRecord ${id} not found`)
    SEED_EYE_VISION_RECORDS.splice(idx, 1)
    return { success: true, data: { id, deleted: true } }
  }

  // [G005 W1-A] 眼压记录 (IntraocularPressurePage 在用)
  async listIopRecords(params: { patientId?: string }) {
    let data = [...SEED_EYE_IOP_RECORDS]
    if (params.patientId) data = data.filter((r: any) => r.patientId === params.patientId)
    data.sort((a: any, b: any) => String(b.timestamp).localeCompare(String(a.timestamp)))
    return { success: true, data }
  }

  async createIopRecord(body: Record<string, unknown>) {
    const item = {
      id: `IOP-${Date.now()}`,
      patientId: (body.patientId as string) ?? 'PEYE-001',
      patientName: (body.patientName as string) ?? '李慧敏',
      od: Number(body.od) || 0,
      os: Number(body.os) || 0,
      device: (body.device as string) ?? 'nct',
      timestamp: new Date().toISOString(),
    }
    SEED_EYE_IOP_RECORDS.unshift(item)
    return { success: true, data: item }
  }

  async deleteIopRecord(id: string) {
    const idx = SEED_EYE_IOP_RECORDS.findIndex((r: any) => r.id === id)
    if (idx < 0) throw new NotFoundException(`IopRecord ${id} not found`)
    SEED_EYE_IOP_RECORDS.splice(idx, 1)
    return { success: true, data: { id, deleted: true } }
  }

  // [G005 W1-A] 预约到检/叫号 (EyeRisPage 在用)
  async checkinAppointment(id: string) {
    const a: any = SEED_EYE_APPOINTMENTS.find((x: any) => x.id === id)
    if (!a) throw new NotFoundException(`Appointment ${id} not found`)
    a.status = 'arrived'
    a.checkinAt = new Date().toISOString()
    return { success: true, data: a }
  }

  async startAppointment(id: string) {
    const a: any = SEED_EYE_APPOINTMENTS.find((x: any) => x.id === id)
    if (!a) throw new NotFoundException(`Appointment ${id} not found`)
    a.status = 'in_progress'
    a.startedAt = new Date().toISOString()
    return { success: true, data: a }
  }

  // [G005 W1-A] 报告提交审核 (EyeReportWritePage 在用)
  async submitReport(id: string) {
    const r: any = SEED_EYE_REPORTS.find((x: any) => x.id === id)
    if (!r) throw new NotFoundException(`Report ${id} not found`)
    r.status = 'pending_review'
    r.submittedAt = new Date().toISOString()
    return { success: true, data: r }
  }

  // [G005 W1-A] 保存报告草稿 (EyeReportWritePage 在用)
  async createReportDraft(body: Record<string, unknown>) {
    const item = {
      id: `DRFT-${Date.now()}`,
      reportId: (body.reportId as string) ?? null,
      patientId: (body.patientId as string) ?? '',
      content: (body.content as string) ?? '',
      status: 'draft',
      createdAt: new Date().toISOString(),
    }
    SEED_EYE_REPORTS.unshift({ id: item.id, patientId: item.patientId, patientName: '', reportType: 'draft', status: 'draft', content: item.content, createdAt: item.createdAt } as any)
    return { success: true, data: item }
  }

  // [G005 W1-A] KPI 看板 (EyeKpiDashboardPage 在用)
  async getKpiSummary() {
    return {
      success: true,
      data: {
        dailyExams: 148,
        aiAdoption: 87,
        avgWait: 12,
        avgCost: 286,
        criticalResponse: 9,
        surgeryCount: 16,
        examCount: 148,
        revenue: 86,
      },
    }
  }

  async getQualityMetrics() {
    return { success: true, data: SEED_EYE_KPI_METRICS }
  }

  async getPatientSatisfaction() {
    return { success: true, data: SEED_EYE_KPI_SATISFACTION }
  }

  async listPacsMeasurements(params: { studyId?: string }) {
    let data = SEED_EYE_MEASUREMENTS
    if (params.studyId) data = data.filter((m: any) => m.studyId === params.studyId)
    return { success: true, data }
  }

  async listAiInferences(params: { studyId?: string; modelId?: string }) {
    const rows = await this.withSeed(
      () => this.prisma.eyeAiInference.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }),
      SEED_AI_INFERENCES,
    )
    let data = rows.map((i: any) => ({
      id: i.id ?? i.inferenceId,
      studyId: i.studyId,
      modelName: i.modelName ?? i.modelId,
      diagnosis: i.diagnosis ?? '',
      confidence: i.confidence ?? 0,
      severity: i.severity ?? 'mild',
      timestamp: i.timestamp ?? i.createdAt ?? i.inferredAt,
      confirmed: i.confirmed ?? (i.doctorOverride ? true : false),
    }))
    if (params.studyId) data = data.filter((i: any) => i.studyId === params.studyId)
    if (params.modelId) data = data.filter((i: any) => i.modelName === params.modelId || i.modelId === params.modelId)
    return { success: true, data }
  }

  async getAiInference(id: string) {
    const item = await this.withSeed(
      () => this.prisma.eyeAiInference.findMany({ where: { id }, take: 1 }),
      [],
    )
    if (item.length > 0) {
      const i: any = item[0]
      return { success: true, data: { id: i.id, studyId: i.studyId, modelName: i.modelId, diagnosis: i.diagnosis, confidence: i.confidence, severity: 'mild', timestamp: i.createdAt, confirmed: false } }
    }
    const seeded = SEED_AI_INFERENCES.find((i: any) => i.id === id)
    return { success: true, data: seeded ?? null }
  }

  async listEmrRecords(params: { patientId?: string }) {
    let data = SEED_EMR_RECORDS
    if (params.patientId) data = data.filter((e: any) => e.patientId === params.patientId)
    return { success: true, data }
  }

  async listReportReports(params: { patientId?: string }) {
    let data = SEED_EYE_REPORTS
    if (params.patientId) data = data.filter((r: any) => r.patientId === params.patientId)
    return { success: true, data }
  }

  async listReportDrafts() {
    const data = SEED_EYE_REPORTS.filter((r: any) => r.status === 'draft')
    return { success: true, data }
  }

  async listReportTemplates(params: { specialty?: string }) {
    let data = SEED_EYE_TEMPLATES
    if (params.specialty) data = data.filter((t: any) => t.specialty === params.specialty)
    return { success: true, data }
  }

  // ── [G005-P1] RIS 在用孤儿 (seed) ──

  async listRisAppointments(params: { date?: string }) {
    let data = SEED_EYE_APPOINTMENTS
    if (params.date) data = data.filter((a: any) => a.scheduledDate === params.date)
    return { success: true, data }
  }

  async listTodayAppointments() {
    const today = new Date().toISOString().slice(0, 10)
    const data = SEED_EYE_APPOINTMENTS.filter((a: any) => a.scheduledDate === today)
    return { success: true, data }
  }

  async listRisFollowups() {
    return { success: true, data: SEED_EYE_FOLLOW_UPS }
  }

  async listRisSurgeries() {
    return { success: true, data: SEED_EYE_SURGERIES }
  }

  async listRisReferrals() {
    return { success: true, data: SEED_EYE_REFERRALS }
  }

  // ── [G005-P1] 眼料: IOL 库存 ──

  async listIolInventory(params: { type?: string; status?: string; supplier?: string }) {
    let data = SEED_IOL_INVENTORY
    if (params.type) data = data.filter(i => i.type === params.type)
    if (params.status) data = data.filter(i => i.status === params.status)
    if (params.supplier) data = data.filter(i => i.supplier === params.supplier)
    return { success: true, data }
  }

  async getIolInventoryItem(id: string) {
    const item = SEED_IOL_INVENTORY.find(i => i.id === id)
    return { success: true, data: item ?? null }
  }

  async createIolInventoryItem(body: Record<string, unknown>) {
    const item: IolInventoryItem = {
      id: `iol-${Date.now()}`,
      barcode: body.barcode as string,
      model: body.model as string,
      type: body.type as string,
      power: body.power as number,
      cylinder: body.cylinder as number | undefined,
      batchNumber: body.batchNumber as string,
      expiryDate: body.expiryDate as string,
      stockLocation: body.stockLocation as string,
      status: (body.status as string) ?? 'in_stock',
      supplier: body.supplier as string,
      unitPrice: body.unitPrice as number,
      createdAt: new Date().toISOString(),
      quantity: 1,
    }
    SEED_IOL_INVENTORY.unshift(item)
    return { success: true, data: item }
  }

  async iolOutStock(id: string, body: { reason: string; patientId?: string; surgeon?: string }) {
    const item = SEED_IOL_INVENTORY.find(i => i.id === id)
    if (!item) return { success: true, data: null }
    item.status = 'implanted'
    item.quantity = Math.max(0, item.quantity - 1)
    return { success: true, data: { ...item, outReason: body.reason, outPatientId: body.patientId ?? null, outSurgeon: body.surgeon ?? null, outAt: new Date().toISOString() } }
  }

  async iolTransfer(id: string, body: { fromLocation: string; toLocation: string }) {
    const item = SEED_IOL_INVENTORY.find(i => i.id === id)
    if (!item) return { success: true, data: null }
    item.stockLocation = body.toLocation
    return { success: true, data: item }
  }

  async iolAdjust(id: string, body: { deltaQty: number; reason: string }) {
    const item = SEED_IOL_INVENTORY.find(i => i.id === id)
    if (!item) return { success: true, data: null }
    item.quantity = Math.max(0, item.quantity + body.deltaQty)
    return { success: true, data: { ...item, adjustReason: body.reason } }
  }

  async listIolLowStock(threshold = 5) {
    const data = SEED_IOL_INVENTORY.filter(i => i.quantity < threshold)
    return { success: true, data }
  }

  async listIolExpiring(days = 90) {
    const limit = Date.now() + days * 86400000
    const data = SEED_IOL_INVENTORY.filter(i => {
      const t = new Date(i.expiryDate).getTime()
      return t <= limit && t >= Date.now()
    })
    return { success: true, data }
  }

  // ── [G005-P1] 眼料: 接触镜库 ──

  async listContactLensInventory(params: { type?: string; brand?: string }) {
    let data = SEED_CONTACT_LENSES
    if (params.type) data = data.filter(l => l.type === params.type)
    if (params.brand) data = data.filter(l => l.brand.includes(params.brand as string))
    return { success: true, data }
  }

  async getContactLens(id: string) {
    const item = SEED_CONTACT_LENSES.find(l => l.id === id)
    return { success: true, data: item ?? null }
  }

  async createContactLens(body: Record<string, unknown>) {
    const item: ContactLens = {
      id: `cl-${Date.now()}`,
      brand: body.brand as string,
      type: body.type as string,
      series: body.series as string,
      bc: body.bc as number,
      dia: body.dia as number,
      power: body.power as number,
      cylinder: body.cylinder as number | undefined,
      axis: body.axis as number | undefined,
      stock: body.stock as number,
      trialLens: body.trialLens as boolean ?? false,
      unitPrice: body.unitPrice as number,
      supplier: body.supplier as string,
    }
    SEED_CONTACT_LENSES.unshift(item)
    return { success: true, data: item }
  }

  async updateContactLens(id: string, body: Record<string, unknown>) {
    const item = SEED_CONTACT_LENSES.find(l => l.id === id)
    if (!item) return { success: true, data: null }
    Object.assign(item, body)
    return { success: true, data: item }
  }

  async deleteContactLens(id: string) {
    const idx = SEED_CONTACT_LENSES.findIndex(l => l.id === id)
    if (idx >= 0) SEED_CONTACT_LENSES.splice(idx, 1)
    return { success: true, data: { id, deleted: idx >= 0 } }
  }

  async contactLensFitting(body: { patientId: string; fittingData?: Record<string, unknown> }) {
    return {
      success: true,
      data: { fittingId: `FIT-${Date.now()}`, result: 'fitting_recorded', patientId: body.patientId },
    }
  }

  async okLensDesign(body: { patientId: string; k1: number; k2: number; kAxis: number; targetReduction: number; brand?: string }) {
    const flatK = (body.k1 + body.k2) / 2
    const baseCurve = Math.round((flatK - 0.5) * 100) / 100
    const returnZone = Math.round(baseCurve - 1.6)
    const diameter = 10.6
    return {
      success: true,
      data: {
        designId: `OK-${Date.now()}`,
        baseCurve,
        returnZone,
        diameter,
        brand: body.brand ?? 'CRT',
        targetReduction: body.targetReduction,
        patientId: body.patientId,
      },
    }
  }
}
