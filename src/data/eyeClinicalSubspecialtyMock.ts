/** G005 眼科亚专科 Mock v3.0.6.8-23a */
import type { StrabismusExam, NeuroOphthalmicExam, OcularOncologyRecord, ContactLensFitting, LowVisionAssessment, SurgicalInstrument, SterilizationRecord } from '../types/eye';

const NOW = Date.now();

export const MOCK_STRABISMUS_EXAMS: StrabismusExam[] = [
  { id: 'st-001', patientId: 'p-1020', patientName: '刘佳琪', age: 6, eyeSide: 'OD', type: 'esotropia', pattern: 'constant', distanceDeviation: 25, nearDeviation: 30, acRatio: 5.2, stereoacuity: 200, worth4Dot: '4点/L', coverTest: 'CTT:OD注视时OS内斜25Δ', extraocularMovements: '双眼外转受限', cycloplegicRefraction: 'OD:+3.00DS, OS:+2.75DS', treatment: 'OD遮盖6h/day,等待手术', followUp: '3个月复查' },
  { id: 'st-002', patientId: 'p-1013', patientName: '赵文博', age: 8, eyeSide: 'OS', type: 'exotropia', pattern: 'intermittent', distanceDeviation: 18, nearDeviation: 22, acRatio: 4.0, stereoacuity: 100, worth4Dot: '4点/正常', coverTest: 'CTT:OS间歇性外斜18Δ', extraocularMovements: '正常', cycloplegicRefraction: 'OD:+1.50DS, OS:+1.75DS', treatment: '矫正远视,观察', followUp: '6个月复查' },
  { id: 'st-003', patientId: 'p-1007', patientName: '孙莉', age: 12, eyeSide: 'OU', type: 'exotropia', pattern: 'intermittent', distanceDeviation: 14, nearDeviation: 10, acRatio: 3.8, stereoacuity: 60, worth4Dot: '4点/正常', coverTest: 'CTT:OU间歇性外斜14Δ', extraocularMovements: '正常', cycloplegicRefraction: 'OD:+1.00DC×180, OS:+0.75DC×10', treatment: '训练融合功能', followUp: '1年复查' },
];

export const MOCK_NEURO_OPHTHALMIC_EXAMS: NeuroOphthalmicExam[] = [
  { id: 'no-001', patientId: 'p-1003', patientName: '赵刚', chiefComplaint: '右眼视力突然下降伴头痛', visualAcuityOd: '0.2', visualAcuityOs: '0.8', colorVisionOd: 4, colorVisionOs: 15, visualFieldDefect: '中心暗点(右)', pupillaryExam: 'RAPD(+右)', opticDiscAppearance: '右眼视盘轻微水肿', extraocularMotility: '正常', ptosis: false, proptosis: false, HertelExophthalmometry: { od: 16, os: 15, base: 100 }, imagingFindings: 'MRI示右侧视神经鞘轻度增厚', diagnosis: '视神经炎(右眼,待排MS)', management: '大剂量甲强龙冲击治疗', referredTo: '神经内科', examinedBy: '王建国', examinedAt: new Date(NOW - 86400000 * 5).toISOString() },
  { id: 'no-002', patientId: 'p-1015', patientName: '孙长海', chiefComplaint: '双眼复视(水平),向右看加重', visualAcuityOd: '0.6', visualAcuityOs: '0.5', colorVisionOd: 12, colorVisionOs: 11, visualFieldDefect: '无', pupillaryExam: '等大光反射正常', opticDiscAppearance: '正常', extraocularMotility: '右眼外展受限-2', ptosis: false, proptosis: false, HertelExophthalmometry: { od: 18, os: 17, base: 100 }, imagingFindings: 'CTA示颅内后交通动脉瘤(约5mm)', diagnosis: '第VI颅神经麻痹(右)继发于颅内动脉瘤', management: '急诊神经外科会诊', referredTo: '神经外科', examinedBy: '张明远', examinedAt: new Date(NOW - 86400000 * 14).toISOString() },
];

export const MOCK_ONCOLOGY_RECORDS: OcularOncologyRecord[] = [
  { id: 'on-001', patientId: 'p-1015', patientName: '孙长海', tumorType: 'choroidal_nevus', eyeSide: 'OD', location: '颞上象限距中心凹3.5mm', sizeMm: { length: 4.2, width: 3.8, height: 1.1 }, pigmentation: '中度色素性', ultrasoundFeatures: '扁平隆起,中低回声', octFeatures: '脉络膜隆起,上覆正常视网膜', treatmentPlan: '每6个月复查OCT+超声', followUpInterval: '6个月', status: 'active_surveillance', oncologist: '王建国', lastReview: new Date(NOW - 86400000 * 30).toISOString() },
  { id: 'on-002', patientId: 'p-1018', patientName: '张秀英', tumorType: 'choroidal_hemangioma', eyeSide: 'OS', location: '黄斑中心凹颞侧1mm', sizeMm: { length: 5.5, width: 4.2, height: 2.8 }, pigmentation: '橙红色', ultrasoundFeatures: '圆顶状隆起,内回声均匀', octFeatures: '脉络膜圆顶状隆起,上覆浆液性脱离', treatmentPlan: 'TTT激光治疗', followUpInterval: '3个月', status: 'under_treatment', oncologist: '王建国', lastReview: new Date(NOW - 86400000 * 10).toISOString() },
];

export const MOCK_CONTACT_LENS_FITTINGS: ContactLensFitting[] = [
  { id: 'cl-001', patientId: 'p-1016', patientName: '李娜', eyeSide: 'OS', lensType: 'rgp', brand: 'Menicon Z', baseCurve: 7.65, diameter: 9.6, power: -3.5, material: '氟硅氧烷丙烯酸酯', waterContent: 0.5, dk: 163, replacementSchedule: '每年更换', wearingSchedule: '日戴10-12h', fittingDate: new Date(NOW - 86400000 * 60).toISOString(), fitAssessment: 'good', prescribedBy: '李梅' },
  { id: 'cl-002', patientId: 'p-1004', patientName: '刘洋', eyeSide: 'OD', lensType: 'soft', brand: 'Acuvue Oasys', baseCurve: 8.4, diameter: 14.0, power: -3.0, material: 'senofilcon A', waterContent: 38, dk: 103, replacementSchedule: '2周', wearingSchedule: '日戴8-10h', fittingDate: new Date(NOW - 86400000 * 90).toISOString(), fitAssessment: 'good', prescribedBy: '李梅' },
  { id: 'cl-003', patientId: 'p-1009', patientName: '吴敏', eyeSide: 'OU', lensType: 'toric', brand: 'Biofinity Toric', baseCurve: 8.6, diameter: 14.5, power: -2.75, cylinder: -1.25, axis: 180, material: 'comfilcon A', waterContent: 48, dk: 116, replacementSchedule: '每月', wearingSchedule: '日戴', fittingDate: new Date(NOW - 86400000 * 45).toISOString(), fitAssessment: 'acceptable', complications: ['偶有干涩'], prescribedBy: '李梅' },
  { id: 'cl-004', patientId: 'p-1008', patientName: '黄伟', eyeSide: 'OU', lensType: 'ortho_k', brand: 'Paragon CRT', baseCurve: 8.2, diameter: 10.5, power: -8.0, material: 'paflufcon D', waterContent: 0.5, dk: 100, replacementSchedule: '每年', wearingSchedule: '夜戴8h', fittingDate: new Date(NOW - 86400000 * 30).toISOString(), followUpDate: new Date(NOW + 86400000 * 14).toISOString(), fitAssessment: 'good', prescribedBy: '李梅' },
];

export const MOCK_LOW_VISION_ASSESSMENTS: LowVisionAssessment[] = [
  { id: 'lv-001', patientId: 'p-1010', patientName: '林峰', distanceVA: { od: '0.2', os: '0.5' }, nearVA: { od: '0.1', os: '0.3' }, contrastSensitivity: 1.2, visualFieldConstriction: false, centralScotoma: true, preferredRetinalLocus: '上方PRL', magnificationNeeded: 4, lightingAssessment: '需要高亮度', recommendedAids: ['手持放大镜×4','视频放大系统','滤光镜'], trainingPlan: 'PRL定位训练+辅具使用训练', assessedBy: '李梅', assessedAt: new Date(NOW - 86400000 * 15).toISOString() },
];

export const MOCK_SURGICAL_INSTRUMENTS: SurgicalInstrument[] = [
  { id: 'si-001', name: '超声乳化手柄(Alcon Centurion)', category: 'phaco', manufacturer: 'Alcon', model: 'Centurion', serialNumber: 'PH-2025-001', purchaseDate: '2025-01-15', lastServiceDate: '2026-05-10', nextServiceDate: '2026-08-10', sterilizationCycles: 128, maxCycles: 500, status: 'sterile', location: '手术室3-柜A-1' },
  { id: 'si-002', name: '玻璃体切割头(Constellation 25G)', category: 'vitrectomy', manufacturer: 'Alcon', model: 'Constellation', serialNumber: 'VT-2024-015', purchaseDate: '2024-06-20', lastServiceDate: '2026-04-15', nextServiceDate: '2026-07-15', sterilizationCycles: 85, maxCycles: 300, status: 'in_use', location: '手术室3-柜B-2' },
  { id: 'si-003', name: '手术显微镜(Zeiss OPMI Lumera)', category: 'general', manufacturer: 'Zeiss', model: 'OPMI Lumera T', serialNumber: 'MI-2023-008', purchaseDate: '2023-09-01', lastServiceDate: '2026-03-20', nextServiceDate: '2026-09-20', sterilizationCycles: 0, maxCycles: 0, status: 'in_use', location: '手术室3' },
  { id: 'si-004', name: '角膜地形图仪(Medmont E300)', category: 'refractive', manufacturer: 'Medmont', model: 'E300', serialNumber: 'TO-2025-003', purchaseDate: '2025-03-10', lastServiceDate: '2026-03-10', nextServiceDate: '2026-09-10', sterilizationCycles: 0, maxCycles: 0, status: 'in_use', location: '检查室-1' },
  { id: 'si-005', name: '眼压计(Goldmann AT 900)', category: 'general', manufacturer: 'Haag-Streit', model: 'AT 900', serialNumber: 'IP-2023-012', purchaseDate: '2023-12-01', lastServiceDate: '2026-02-28', nextServiceDate: '2026-08-28', sterilizationCycles: 0, maxCycles: 0, status: 'in_use', location: '检查室-2' },
  { id: 'si-006', name: '激光光凝机(Nidek GYC-1000)', category: 'glaucoma', manufacturer: 'Nidek', model: 'GYC-1000', serialNumber: 'LA-2024-005', purchaseDate: '2024-08-15', lastServiceDate: '2026-01-10', nextServiceDate: '2026-07-10', sterilizationCycles: 0, maxCycles: 0, status: 'needs_sterilization', location: '治疗室' },
  { id: 'si-007', name: '裂隙灯显微镜(Topcon SL-D4)', category: 'general', manufacturer: 'Topcon', model: 'SL-D4', serialNumber: 'SL-2024-022', purchaseDate: '2024-04-01', lastServiceDate: '2026-04-01', nextServiceDate: '2026-10-01', sterilizationCycles: 0, maxCycles: 0, status: 'in_use', location: '门诊-3' },
  { id: 'si-008', name: '全自动视野计(Humphrey HFA3)', category: 'general', manufacturer: 'Zeiss', model: 'HFA3 740i', serialNumber: 'VF-2024-010', purchaseDate: '2024-07-01', lastServiceDate: '2026-05-05', nextServiceDate: '2026-11-05', sterilizationCycles: 0, maxCycles: 0, status: 'in_repair', location: '视功能室', notes: '固视监测异常-已报修' },
];

export const MOCK_STERILIZATION_RECORDS: SterilizationRecord[] = Array.from({ length: 30 }, (_, i) => ({
  id: `stz-${String(i + 1).padStart(3, '0')}`,
  instrumentId: i % 2 === 0 ? 'si-001' : 'si-002',
  instrumentName: i % 2 === 0 ? '超声乳化手柄' : '玻璃体切割头',
  cycleNumber: i + 1,
  method: i % 3 === 0 ? 'ethylene_oxide' : 'autoclave',
  date: new Date(NOW - 86400000 * (60 - i * 3)).toISOString().split('T')[0]!,
  operator: ['护士A','护士B','护士C'][i % 3]!,
  temperature: i % 3 === 0 ? 55 : i % 2 === 0 ? 134 : 121,
  duration: i % 3 === 0 ? 360 : 15,
  biologicalIndicator: i % 5 !== 4,
  chemicalIndicator: i % 6 !== 5,
  result: i % 5 === 4 ? 'failed' : i % 12 === 5 ? 'failed' : 'passed',
  notes: i % 5 === 4 ? '生物指示剂阳性-重新灭菌' : undefined,
}));
