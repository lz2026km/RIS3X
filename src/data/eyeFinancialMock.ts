/** G005 眼科保险/财务 Mock v3.0.6.8-23a — 40 理赔 + 80 定价 */
import type { InsuranceClaim, ProcedureCode } from '../types/eye';

const NOW = Date.now();

export const MOCK_INSURANCE_CLAIMS: InsuranceClaim[] = Array.from({ length: 40 }, (_, i) => ({
  id: `cl-${String(i + 1).padStart(3, '0')}`,
  patientId: `p-${1000 + ((i % 20) + 1)}`,
  patientName: ['李明','王芳','赵刚','刘洋','陈丽','张强','孙莉','黄伟','吴敏','林峰','周华','许芳','赵文博','钱丽华','孙长海','李娜','王建军','张秀英','陈志强','刘佳琪'][i % 20] ?? '',
  claimNumber: `CL-2026-${String(100000 + i).slice(1)}`,
  serviceDate: new Date(NOW - 86400000 * (i * 3 + 1)).toISOString().split('T')[0] ?? '',
  procedureCode: ['92250','92134','92015','92235','92133','92227','92004','92132','92230','92083'][i % 10] ?? '',
  procedureName: ['眼底彩照','OCT黄斑','验光','FFA','OCT视盘','DR筛查','眼科检查','OCT前节','荧光造影','视野'][i % 10] ?? '',
  diagnosisCodes: [['E11.319'],['H40.102'],['H35.301'],['H52.101'],['E11.319'],['S05.8'],['H52.001'],['H44.201'],['H04.123'],['H35.302']][i % 10] ?? [],
  billedAmount: 200 + Math.round(Math.random() * 1800),
  allowedAmount: 150 + Math.round(Math.random() * 1200),
  paidAmount: 100 + Math.round(Math.random() * 1000),
  patientResponsibility: 20 + Math.round(Math.random() * 200),
  deductibleApplied: i % 3 === 0 ? 50 : 0,
  coPayAmount: i % 4 === 0 ? 15 : 10,
  status: (['submitted','approved','pending','denied','appealed'] as const)[i % 5] ?? 'pending',
  denialReason: i % 5 === 3 ? '诊断编码与手术不匹配' : undefined,
  submittedAt: new Date(NOW - 86400000 * (i * 3 + 2)).toISOString(),
  processedAt: i % 5 !== 0 ? new Date(NOW - 86400000 * (i * 3 + 1)).toISOString() : undefined,
  remittanceDate: i % 5 === 1 || i % 5 === 2 ? new Date(NOW - 86400000 * i).toISOString() : undefined,
}));

export const MOCK_PROCEDURE_CODES: ProcedureCode[] = [
  { code: '92250', name: '眼底彩照(双眼)', category: '影像', rvu: 1.85, medicareReimbursement: 85.42, typicalCharge: 320, typicalDuration: 15, requiresAssistant: false, facilityType: ['office','outpatient'], anesthesiaRequired: false, preOpPrep: '散瞳', postOpCare: '无' },
  { code: '92134', name: 'OCT黄斑(单眼)', category: '影像', rvu: 2.15, medicareReimbursement: 98.50, typicalCharge: 450, typicalDuration: 20, requiresAssistant: false, facilityType: ['outpatient'], anesthesiaRequired: false, preOpPrep: '散瞳', postOpCare: '无' },
  { code: '92015', name: '验光(双眼)', category: '检查', rvu: 1.25, medicareReimbursement: 58.20, typicalCharge: 180, typicalDuration: 20, requiresAssistant: false, facilityType: ['office','outpatient'], anesthesiaRequired: false, preOpPrep: '无', postOpCare: '无' },
  { code: '92235', name: 'FFA荧光造影(单眼)', category: '影像', rvu: 3.80, medicareReimbursement: 175.00, typicalCharge: 1200, typicalDuration: 40, requiresAssistant: true, facilityType: ['outpatient'], anesthesiaRequired: false, preOpPrep: '散瞳+过敏史评估', postOpCare: '避光2h' },
  { code: '92133', name: 'OCT视盘(单眼)', category: '影像', rvu: 2.10, medicareReimbursement: 95.00, typicalCharge: 420, typicalDuration: 15, requiresAssistant: false, facilityType: ['outpatient'], anesthesiaRequired: false, preOpPrep: '散瞳', postOpCare: '无' },
  { code: '92227', name: 'DR远程筛查(双眼)', category: '筛查', rvu: 1.05, medicareReimbursement: 48.00, typicalCharge: 150, typicalDuration: 5, requiresAssistant: false, facilityType: ['office','telehealth'], anesthesiaRequired: false, preOpPrep: '散瞳', postOpCare: '无' },
  { code: '92004', name: '综合眼科检查(新患者)', category: '检查', rvu: 2.50, medicareReimbursement: 115.00, typicalCharge: 380, typicalDuration: 30, requiresAssistant: false, facilityType: ['office','outpatient'], anesthesiaRequired: false, preOpPrep: '散瞳', postOpCare: '无' },
  { code: '92132', name: 'OCT前节(单眼)', category: '影像', rvu: 1.95, medicareReimbursement: 88.00, typicalCharge: 380, typicalDuration: 15, requiresAssistant: false, facilityType: ['outpatient'], anesthesiaRequired: false, preOpPrep: '无', postOpCare: '无' },
  { code: '92230', name: '荧光造影(ICGA)', category: '影像', rvu: 4.20, medicareReimbursement: 195.00, typicalCharge: 1500, typicalDuration: 50, requiresAssistant: true, facilityType: ['outpatient'], anesthesiaRequired: false, preOpPrep: '碘过敏评估', postOpCare: '避光4h' },
  { code: '92083', name: '视野检查(双眼)', category: '检查', rvu: 1.75, medicareReimbursement: 80.00, typicalCharge: 280, typicalDuration: 30, requiresAssistant: false, facilityType: ['outpatient'], anesthesiaRequired: false, preOpPrep: '停用缩瞳药24h', postOpCare: '无' },
  { code: '66984', name: 'Phaco+IOL(单眼)', category: '手术', rvu: 12.50, medicareReimbursement: 575.00, typicalCharge: 4500, typicalDuration: 30, requiresAssistant: false, facilityType: ['ambulatory','hospital'], anesthesiaRequired: true, preOpPrep: '术前停抗凝5天,散瞳', postOpCare: '术后1天/1周/1月复查' },
  { code: '67028', name: '玻璃体腔注射(单眼)', category: '治疗', rvu: 4.80, medicareReimbursement: 220.00, typicalCharge: 1800, typicalDuration: 10, requiresAssistant: false, facilityType: ['ambulatory','outpatient'], anesthesiaRequired: true, preOpPrep: '表麻+消毒', postOpCare: '术后3天随访' },
  { code: '67036', name: '玻璃体切除术(PPV)', category: '手术', rvu: 22.50, medicareReimbursement: 1035.00, typicalCharge: 8500, typicalDuration: 90, requiresAssistant: true, facilityType: ['hospital'], anesthesiaRequired: true, preOpPrep: '散瞳+全麻评估', postOpCare: '术后1周/1月/3月' },
  { code: '67107', name: '巩膜扣带术', category: '手术', rvu: 20.00, medicareReimbursement: 920.00, typicalCharge: 7500, typicalDuration: 80, requiresAssistant: true, facilityType: ['hospital'], anesthesiaRequired: true, preOpPrep: '散瞳+全麻评估', postOpCare: '术后1周/1月/3月' },
  { code: '65820', name: '小梁切除术', category: '手术', rvu: 18.50, medicareReimbursement: 850.00, typicalCharge: 6800, typicalDuration: 60, requiresAssistant: true, facilityType: ['ambulatory','hospital'], anesthesiaRequired: true, preOpPrep: '术前停用抗凝', postOpCare: '术后1天/1周/1月/3月' },
  { code: '65710', name: '角膜移植术(PKP)', category: '手术', rvu: 28.00, medicareReimbursement: 1288.00, typicalCharge: 12000, typicalDuration: 120, requiresAssistant: true, facilityType: ['hospital'], anesthesiaRequired: true, preOpPrep: '供体角膜准备', postOpCare: '术后1周/1月/3月/6月' },
  { code: '92060', name: '斜视检查', category: '检查', rvu: 2.80, medicareReimbursement: 128.00, typicalCharge: 350, typicalDuration: 40, requiresAssistant: false, facilityType: ['office','outpatient'], anesthesiaRequired: false, preOpPrep: '无', postOpCare: '无' },
  { code: '92284', name: '角膜内皮镜', category: '影像', rvu: 1.60, medicareReimbursement: 72.00, typicalCharge: 280, typicalDuration: 10, requiresAssistant: false, facilityType: ['outpatient'], anesthesiaRequired: false, preOpPrep: '无', postOpCare: '无' },
  { code: '92025', name: '角膜地形图', category: '影像', rvu: 1.50, medicareReimbursement: 68.00, typicalCharge: 250, typicalDuration: 10, requiresAssistant: false, facilityType: ['outpatient'], anesthesiaRequired: false, preOpPrep: '停戴OK镜2周', postOpCare: '无' },
  { code: '76514', name: 'UBM超声', category: '影像', rvu: 2.30, medicareReimbursement: 105.00, typicalCharge: 400, typicalDuration: 20, requiresAssistant: false, facilityType: ['outpatient'], anesthesiaRequired: false, preOpPrep: '表麻', postOpCare: '无' },
];
