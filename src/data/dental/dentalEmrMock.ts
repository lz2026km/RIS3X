// [v3.0.6.8-94] Phase 4: 口腔 360° 患者视图 mock 数据
// 对标: 领健·牙医管家 患者档案
// [G005 dental-demo-fill] 20 名真实感患者 (P100001-P100020) + 跨表关联:
//   patientId ↔ chartId (dentalChartMock) ↔ studyId (dentalImagingMock) ↔ treatmentId (dentalTreatmentMock)
// 全部数据确定性生成 (mulberry32 + FNV-1a 种子), 无模块级 Math.random()。

import { mulberry32, hashSeed } from '../../utils/seededRandom';

export interface DentalPatient {
  id: string;
  name: string;
  gender: 'M' | 'F';
  age: number;
  phone: string;
  idCard: string;
  address: string;
  occupation: string;
  firstVisit: string;
  lastVisit: string;
  totalVisits: number;
  totalSpent: number;
  insuranceType: string;
  allergies: string[];
  systemicDisease: string[];
  medications: string[];
  dentist: string;
  tags: string[];
}

// ── 主患者池: 前 3 条与历史页面写死数据保持一致; P100004-P100006 与 ceph/aligner/sched mock 对齐 ──
export const MOCK_DENTAL_PATIENTS: DentalPatient[] = [
  {
    id: 'P100001', name: '张伟', gender: 'M', age: 35, phone: '13800138001', idCard: '110101199001011234',
    address: '北京市朝阳区建国路88号', occupation: '软件工程师',
    firstVisit: '2025-03-15', lastVisit: '2026-06-28', totalVisits: 12,
    totalSpent: 28500, insuranceType: '城镇职工',
    allergies: ['青霉素'], systemicDisease: ['高血压'], medications: ['氨氯地平'],
    dentist: '王医生', tags: ['VIP', '种植意向'],
  },
  {
    id: 'P100002', name: '李娜', gender: 'F', age: 28, phone: '13900139002', idCard: '110102199512051234',
    address: '北京市海淀区中关村大街1号', occupation: '教师',
    firstVisit: '2025-08-20', lastVisit: '2026-06-27', totalVisits: 8,
    totalSpent: 18600, insuranceType: '城镇职工',
    allergies: [], systemicDisease: [], medications: [],
    dentist: '李医生', tags: ['正畸'],
  },
  {
    id: 'P100003', name: '王芳', gender: 'F', age: 45, phone: '13700137003', idCard: '110103197812051234',
    address: '上海市浦东新区陆家嘴环路1000号', occupation: '银行经理',
    firstVisit: '2024-11-10', lastVisit: '2026-06-22', totalVisits: 15,
    totalSpent: 52000, insuranceType: '城镇职工',
    allergies: ['磺胺类'], systemicDisease: ['糖尿病'], medications: ['二甲双胍'],
    dentist: '张主任', tags: ['VIP', '种植完成', '定期复查'],
  },
  {
    id: 'P100004', name: '赵雪', gender: 'F', age: 28, phone: '13600136004', idCard: '110108199703124527',
    address: '北京市海淀区学院路38号院5号楼', occupation: '平面设计师',
    firstVisit: '2025-09-02', lastVisit: '2026-09-28', totalVisits: 9,
    totalSpent: 31200, insuranceType: '城乡居民',
    allergies: [], systemicDisease: [], medications: [],
    dentist: '赵医生', tags: ['正畸', '隐形矫治'],
  },
  {
    id: 'P100005', name: '刘阳', gender: 'M', age: 32, phone: '13500135005', idCard: '110105199309223315',
    address: '北京市朝阳区望京西路48号', occupation: '建筑师',
    firstVisit: '2025-05-18', lastVisit: '2026-09-22', totalVisits: 11,
    totalSpent: 36800, insuranceType: '城镇职工',
    allergies: [], systemicDisease: [], medications: [],
    dentist: '赵医生', tags: ['正畸', '复诊中'],
  },
  {
    id: 'P100006', name: '陈雨', gender: 'F', age: 26, phone: '18600186006', idCard: '110112199905182246',
    address: '北京市通州区新华大街15号', occupation: '新媒体运营',
    firstVisit: '2026-01-12', lastVisit: '2026-09-15', totalVisits: 5,
    totalSpent: 9800, insuranceType: '城乡居民',
    allergies: [], systemicDisease: [], medications: [],
    dentist: '李医生', tags: ['牙周维护'],
  },
  {
    id: 'P100007', name: '孙明', gender: 'M', age: 38, phone: '18700187007', idCard: '110106198708051513',
    address: '北京市丰台区南三环西路16号', occupation: '物流主管',
    firstVisit: '2025-06-25', lastVisit: '2026-08-30', totalVisits: 7,
    totalSpent: 14200, insuranceType: '城镇职工',
    allergies: ['利多卡因'], systemicDisease: [], medications: [],
    dentist: '王医生', tags: ['定期复查'],
  },
  {
    id: 'P100008', name: '周婷', gender: 'F', age: 30, phone: '18800188008', idCard: '110101199511233628',
    address: '北京市西城区金融大街7号', occupation: '会计',
    firstVisit: '2025-10-08', lastVisit: '2026-09-26', totalVisits: 6,
    totalSpent: 21500, insuranceType: '城镇职工',
    allergies: [], systemicDisease: [], medications: [],
    dentist: '王医生', tags: ['VIP', '美学修复'],
  },
  {
    id: 'P100009', name: '吴强', gender: 'M', age: 52, phone: '13910139009', idCard: '110107197306142719',
    address: '北京市石景山路12号院3单元', occupation: '个体经营',
    firstVisit: '2024-08-19', lastVisit: '2026-09-10', totalVisits: 18,
    totalSpent: 68400, insuranceType: '城镇职工',
    allergies: [], systemicDisease: ['高血压', '高血脂'], medications: ['缬沙坦', '阿托伐他汀'],
    dentist: '张主任', tags: ['VIP', '种植完成'],
  },
  {
    id: 'P100010', name: '郑丽', gender: 'F', age: 41, phone: '13811138010', idCard: '110102198404091825',
    address: '北京市朝阳区安慧里三区9号', occupation: '公务员',
    firstVisit: '2025-02-14', lastVisit: '2026-09-05', totalVisits: 10,
    totalSpent: 23600, insuranceType: '城镇职工',
    allergies: [], systemicDisease: ['糖尿病'], medications: ['二甲双胍'],
    dentist: '李医生', tags: ['牙周维护', '定期复查'],
  },
  {
    id: 'P100011', name: '何俊', gender: 'M', age: 9, phone: '13712137011', idCard: '110101201607034419',
    address: '北京市东城区东直门内大街5号楼', occupation: '小学生',
    firstVisit: '2026-03-06', lastVisit: '2026-09-19', totalVisits: 4,
    totalSpent: 2400, insuranceType: '城乡居民',
    allergies: [], systemicDisease: [], medications: [],
    dentist: '刘医生', tags: ['儿童', '窝沟封闭'],
  },
  {
    id: 'P100012', name: '高雅', gender: 'F', age: 24, phone: '13613136012', idCard: '110108200102273528',
    address: '北京市海淀区清华东路35号', occupation: '研究生',
    firstVisit: '2025-11-27', lastVisit: '2026-09-24', totalVisits: 8,
    totalSpent: 19800, insuranceType: '城乡居民',
    allergies: [], systemicDisease: [], medications: [],
    dentist: '赵医生', tags: ['正畸', '复诊中'],
  },
  {
    id: 'P100013', name: '马建国', gender: 'M', age: 66, phone: '13514135013', idCard: '110105195909185517',
    address: '北京市朝阳区团结湖路2号院', occupation: '退休工人',
    firstVisit: '2024-05-30', lastVisit: '2026-08-21', totalVisits: 21,
    totalSpent: 57300, insuranceType: '城镇职工',
    allergies: ['磺胺类'], systemicDisease: ['高血压', '冠心病'], medications: ['阿司匹林', '美托洛尔'],
    dentist: '张主任', tags: ['种植完成', '慢病管理'],
  },
  {
    id: 'P100014', name: '徐蕾', gender: 'F', age: 35, phone: '15815158014', idCard: '110114199006162348',
    address: '北京市昌平区回龙观东大街18号', occupation: '护士',
    firstVisit: '2025-07-09', lastVisit: '2026-09-12', totalVisits: 6,
    totalSpent: 11200, insuranceType: '城镇职工',
    allergies: [], systemicDisease: [], medications: [],
    dentist: '王医生', tags: ['定期复查'],
  },
  {
    id: 'P100015', name: '胡晓东', gender: 'M', age: 29, phone: '15916159015', idCard: '110113199608294112',
    address: '北京市顺义区府前西街3号', occupation: '厨师',
    firstVisit: '2026-06-18', lastVisit: '2026-09-03', totalVisits: 3,
    totalSpent: 6600, insuranceType: '无',
    allergies: [], systemicDisease: [], medications: [],
    dentist: '张主任', tags: ['阻生智齿', '急症'],
  },
  {
    id: 'P100016', name: '林悦', gender: 'F', age: 27, phone: '18617186016', idCard: '110105199807142924',
    address: '北京市朝阳区十里堡北里2号', occupation: '会计师',
    firstVisit: '2026-02-26', lastVisit: '2026-09-17', totalVisits: 5,
    totalSpent: 15400, insuranceType: '城镇职工',
    allergies: [], systemicDisease: [], medications: [],
    dentist: '张主任', tags: ['种植意向'],
  },
  {
    id: 'P100017', name: '罗志远', gender: 'M', age: 45, phone: '13318133017', idCard: '110102198005033316',
    address: '北京市西城区德外大街11号', occupation: '公务员',
    firstVisit: '2025-04-11', lastVisit: '2026-08-28', totalVisits: 9,
    totalSpent: 27900, insuranceType: '城镇职工',
    allergies: [], systemicDisease: ['高血压'], medications: ['氨氯地平'],
    dentist: '王医生', tags: ['修复', '嵌体'],
  },
  {
    id: 'P100018', name: '韩雪', gender: 'F', age: 33, phone: '15019150018', idCard: '110101199209214826',
    address: '北京市朝阳区三里屯路19号', occupation: '市场专员',
    firstVisit: '2025-12-05', lastVisit: '2026-09-29', totalVisits: 4,
    totalSpent: 12800, insuranceType: '商业保险',
    allergies: [], systemicDisease: [], medications: [],
    dentist: '王医生', tags: ['美白', '定期复查'],
  },
  {
    id: 'P100019', name: '曹磊', gender: 'M', age: 21, phone: '15120151019', idCard: '110108200405061817',
    address: '北京市海淀区成府路29号', occupation: '大学生',
    firstVisit: '2026-04-02', lastVisit: '2026-09-08', totalVisits: 5,
    totalSpent: 16200, insuranceType: '城乡居民',
    allergies: [], systemicDisease: [], medications: [],
    dentist: '赵医生', tags: ['正畸', '保持器'],
  },
  {
    id: 'P100020', name: '潘秀兰', gender: 'F', age: 68, phone: '15221152020', idCard: '110106195703092143',
    address: '北京市丰台区太平桥西里14号', occupation: '退休教师',
    firstVisit: '2024-09-23', lastVisit: '2026-08-14', totalVisits: 16,
    totalSpent: 41200, insuranceType: '城镇职工',
    allergies: ['青霉素'], systemicDisease: ['糖尿病', '骨质疏松'], medications: ['二甲双胍', '钙尔奇D'],
    dentist: '张主任', tags: ['活动义齿', '慢病管理'],
  },
];

export const DENTAL_PATIENT_IDS: string[] = MOCK_DENTAL_PATIENTS.map(p => p.id);

const PATIENT_BY_ID: Record<string, DentalPatient> = Object.fromEntries(
  MOCK_DENTAL_PATIENTS.map(p => [p.id, p]),
);

export function getDentalPatient(id: string): DentalPatient | undefined {
  return PATIENT_BY_ID[id];
}

export function dentalPatientIndex(patientId: string): number {
  return MOCK_DENTAL_PATIENTS.findIndex(p => p.id === patientId);
}

// ── 跨表 ID 约定 (study / treatment 由 index 生成, 公式集中在此保证一致) ──
export const DENTAL_STUDIES_PER_PATIENT = 30; // 20 × 30 = 600 影像
export const DENTAL_TREATMENTS_PER_PATIENT = 5; // 20 × 5 = 100 治疗

export function dentalStudyIdFor(patientIdx: number, k: number): string {
  return 'STU' + String(100000 + patientIdx * DENTAL_STUDIES_PER_PATIENT + k);
}

export function dentalTreatmentIdFor(patientIdx: number, j: number): string {
  return 'TREAT' + String(100000 + patientIdx * DENTAL_TREATMENTS_PER_PATIENT + j);
}

// ── 确定性工具 (mulberry32, 每个实体独立种子 → 刷新后稳定) ──
const DAY_MS = 24 * 3600 * 1000;
const ANCHOR_MS = Date.parse('2026-10-01T00:00:00.000Z');

function rngOf(key: string) {
  return mulberry32(hashSeed(key));
}

function dateShift(baseMs: number, days: number): string {
  return new Date(baseMs + days * DAY_MS).toISOString().slice(0, 10);
}

function pickBy<T>(r: () => number, arr: readonly T[]): T {
  return arr[Math.floor(r() * arr.length)]!;
}

function intBy(r: () => number, min: number, max: number): number {
  return Math.floor(r() * (max - min + 1)) + min;
}

// ── 360° 视图子表 (全部 patientId 关联到上方 20 名患者) ──
export const MOCK_PATIENT_TREATMENT_HISTORY = [
  { id: 'TH-001', patientId: 'P100001', patientName: '张伟', date: '2026-06-28', type: 'Restorative', toothNo: 16, description: '树脂充填 MOD', dentist: '王医生', cost: 800, insurancePaid: 400, patientPaid: 400 },
  { id: 'TH-002', patientId: 'P100001', patientName: '张伟', date: '2026-06-25', type: 'Endodontic', toothNo: 36, description: '根管治疗 - 已完成', dentist: '王医生', cost: 2500, insurancePaid: 1200, patientPaid: 1300 },
  { id: 'TH-003', patientId: 'P100001', patientName: '张伟', date: '2026-06-20', type: 'Implant', toothNo: 36, description: '种植体植入 Straumann BLT 4.1x10', dentist: '张主任', cost: 12000, insurancePaid: 3000, patientPaid: 9000 },
  { id: 'TH-004', patientId: 'P100002', patientName: '李娜', date: '2026-06-15', type: 'Periodontal', toothNo: 0, description: '全口洁牙 + 牙周探查', dentist: '李医生', cost: 600, insurancePaid: 300, patientPaid: 300 },
  { id: 'TH-005', patientId: 'P100001', patientName: '张伟', date: '2026-06-10', type: 'Examination', toothNo: 0, description: '初诊检查 + CBCT', dentist: '王医生', cost: 1200, insurancePaid: 600, patientPaid: 600 },
  ...(() => {
    const TH_TEMPLATES = [
      { type: 'Restorative', toothNo: 16, description: '树脂充填 MOD (3M Z350)', cost: 800, ratio: 0.5 },
      { type: 'Restorative', toothNo: 26, description: '嵌体修复 E-max', cost: 3200, ratio: 0.3 },
      { type: 'Endodontic', toothNo: 36, description: '根管治疗 + 桩核', cost: 2800, ratio: 0.45 },
      { type: 'Endodontic', toothNo: 46, description: '显微根管治疗', cost: 3600, ratio: 0.4 },
      { type: 'Periodontal', toothNo: 0, description: '龈上洁治 + 龈下刮治 (半口)', cost: 1200, ratio: 0.5 },
      { type: 'Periodontal', toothNo: 0, description: '牙周翻瓣手术', cost: 4500, ratio: 0.4 },
      { type: 'Implant', toothNo: 36, description: '种植体植入 Osstem TS-III 4.5x10', cost: 9800, ratio: 0.25 },
      { type: 'Implant', toothNo: 46, description: '种植二期 + 基台', cost: 3500, ratio: 0.25 },
      { type: 'Orthodontic', toothNo: 0, description: '隐形矫治 (Invisalign 全程)', cost: 36000, ratio: 0.1 },
      { type: 'Orthodontic', toothNo: 0, description: '固定矫治复诊加力', cost: 600, ratio: 0.2 },
      { type: 'Extraction', toothNo: 38, description: '阻生智齿拔除 (近中低位)', cost: 1800, ratio: 0.35 },
      { type: 'Extraction', toothNo: 48, description: '智齿拔除 (简单)', cost: 800, ratio: 0.35 },
      { type: 'Surgery', toothNo: 36, description: '下颌骨囊肿摘除术', cost: 8600, ratio: 0.4 },
      { type: 'Pediatric', toothNo: 55, description: '乳牙窝沟封闭 (4颗)', cost: 480, ratio: 0.5 },
      { type: 'Pediatric', toothNo: 75, description: '乳牙充填 + 涂氟', cost: 360, ratio: 0.5 },
      { type: 'Examination', toothNo: 0, description: '复查 + 全景片', cost: 350, ratio: 0.5 },
    ] as const;
    const out: Array<{ id: string; patientId: string; patientName: string; date: string; type: string; toothNo: number; description: string; dentist: string; cost: number; insurancePaid: number; patientPaid: number }> = [];
    for (let i = 0; i < 55; i++) {
      const p = MOCK_DENTAL_PATIENTS[(i * 7 + 3) % MOCK_DENTAL_PATIENTS.length]!;
      const r = rngOf(`emr-th-${i}`);
      const t = pickBy(r, TH_TEMPLATES);
      const date = dateShift(ANCHOR_MS, -intBy(r, 12, 330));
      const insurancePaid = Math.round(t.cost * t.ratio);
      out.push({
        id: `TH-${String(6 + i).padStart(3, '0')}`,
        patientId: p.id,
        patientName: p.name,
        date,
        type: t.type,
        toothNo: t.toothNo,
        description: t.description,
        dentist: p.dentist,
        cost: t.cost,
        insurancePaid,
        patientPaid: t.cost - insurancePaid,
      });
    }
    return out;
  })(),
];

export const MOCK_PATIENT_APPOINTMENTS = [
  { id: 'APT-001', patientId: 'P100001', patientName: '张伟', date: '2026-07-05', time: '09:00', type: '复诊', toothNo: '16', description: '充填后复查', dentist: '王医生', chair: '1号椅', status: 'scheduled' },
  { id: 'APT-002', patientId: 'P100001', patientName: '张伟', date: '2026-07-12', time: '14:30', type: '复诊', toothNo: '36', description: '种植二期手术', dentist: '张主任', chair: '1号椅', status: 'scheduled' },
  { id: 'APT-003', patientId: 'P100002', patientName: '李娜', date: '2026-06-28', time: '10:00', type: '治疗', toothNo: '26', description: '根管治疗复诊', dentist: '王医生', chair: '2号椅', status: 'completed' },
  ...(() => {
    const TYPES = ['初诊', '复诊', '治疗', '复查', '洁牙', '种植', '正畸', '修复'] as const;
    const CHAIRS = ['1号椅', '2号椅', '3号椅', '4号椅', '5号椅'] as const;
    const out: Array<{ id: string; patientId: string; patientName: string; date: string; time: string; type: string; toothNo: string; description: string; dentist: string; chair: string; status: string }> = [];
    for (let i = 0; i < 21; i++) {
      const p = MOCK_DENTAL_PATIENTS[(i * 5 + 1) % MOCK_DENTAL_PATIENTS.length]!;
      const r = rngOf(`emr-apt-${i}`);
      const type = pickBy(r, TYPES);
      out.push({
        id: `APT-${String(4 + i).padStart(3, '0')}`,
        patientId: p.id,
        patientName: p.name,
        date: dateShift(ANCHOR_MS, intBy(r, 1, 45)),
        time: pickBy(r, ['09:00', '09:30', '10:00', '10:30', '14:00', '14:30', '15:30', '16:00'] as const),
        type,
        toothNo: String(pickBy(r, [16, 26, 36, 46, 11, 21, 38, 48])),
        description: `${type} - ${p.name} 复诊安排`,
        dentist: p.dentist,
        chair: pickBy(r, CHAIRS),
        status: pickBy(r, ['scheduled', 'scheduled', 'scheduled', 'completed'] as const),
      });
    }
    return out;
  })(),
];

export const MOCK_PATIENT_RECALLS = [
  { id: 'REC-001', patientId: 'P100001', patientName: '张伟', date: '2026-08-28', type: '复查', description: '种植术后 2 月复查', status: 'pending', method: 'SMS', sent: false },
  { id: 'REC-002', patientId: 'P100002', patientName: '李娜', date: '2026-09-15', type: '洁牙', description: '常规洁牙提醒', status: 'pending', method: 'WeChat', sent: false },
  ...(() => {
    const TYPES = [
      { type: '复查', description: '根管治疗后 6 月复查' },
      { type: '洁牙', description: '半年常规洁牙提醒' },
      { type: '正畸', description: '正畸复诊提醒 (加力)' },
      { type: '种植', description: '种植体年度复查 + 全景片' },
      { type: '牙周', description: '牙周维护期探查' },
    ] as const;
    const out: Array<{ id: string; patientId: string; patientName: string; date: string; type: string; description: string; status: string; method: string; sent: boolean }> = [];
    for (let i = 0; i < 12; i++) {
      const p = MOCK_DENTAL_PATIENTS[(i * 9 + 2) % MOCK_DENTAL_PATIENTS.length]!;
      const r = rngOf(`emr-rec-${i}`);
      const t = pickBy(r, TYPES);
      out.push({
        id: `REC-${String(3 + i).padStart(3, '0')}`,
        patientId: p.id,
        patientName: p.name,
        date: dateShift(ANCHOR_MS, intBy(r, 7, 120)),
        type: t.type,
        description: `${p.name}: ${t.description}`,
        status: pickBy(r, ['pending', 'pending', 'sent'] as const),
        method: pickBy(r, ['SMS', 'WeChat', 'Phone'] as const),
        sent: r() > 0.5,
      });
    }
    return out;
  })(),
];

export const MOCK_PATIENT_CONSENTS = [
  { id: 'CON-001', patientId: 'P100001', patientName: '张伟', date: '2026-06-20', type: '种植手术同意书', signed: true, signedBy: '张伟', witness: '王医生' },
  { id: 'CON-002', patientId: 'P100001', patientName: '张伟', date: '2026-05-15', type: 'CBCT 检查知情同意', signed: true, signedBy: '张伟', witness: '技师赵' },
  { id: 'CON-003', patientId: 'P100003', patientName: '王芳', date: '2026-06-25', type: '根管治疗同意书', signed: false, signedBy: '', witness: '' },
  ...(() => {
    const TYPES = [
      '拔牙手术同意书', '牙周治疗同意书', '正畸治疗知情同意', '修复治疗同意书',
      '麻醉知情同意书', '隐形矫治知情同意', '种植修复知情同意', '儿童治疗监护人同意书',
    ] as const;
    const out: Array<{ id: string; patientId: string; patientName: string; date: string; type: string; signed: boolean; signedBy: string; witness: string }> = [];
    for (let i = 0; i < 12; i++) {
      const p = MOCK_DENTAL_PATIENTS[(i * 3 + 5) % MOCK_DENTAL_PATIENTS.length]!;
      const r = rngOf(`emr-con-${i}`);
      const signed = r() > 0.2;
      out.push({
        id: `CON-${String(4 + i).padStart(3, '0')}`,
        patientId: p.id,
        patientName: p.name,
        date: dateShift(ANCHOR_MS, -intBy(r, 10, 300)),
        type: pickBy(r, TYPES),
        signed,
        signedBy: signed ? p.name : '',
        witness: pickBy(r, ['王医生', '李医生', '张主任', '赵医生', '刘医生']),
      });
    }
    return out;
  })(),
];

export const MOCK_PATIENT_PRESCRIPTIONS = [
  { id: 'RX-001', patientId: 'P100001', patientName: '张伟', date: '2026-06-20', drug: '阿莫西林胶囊 0.5g', dosage: '一次一粒 一日三次', days: 7, dentist: '王医生', note: '种植术后抗感染' },
  { id: 'RX-002', patientId: 'P100001', patientName: '张伟', date: '2026-06-20', drug: '布洛芬缓释胶囊 0.3g', dosage: '必要时服用', days: 3, dentist: '王医生', note: '止痛' },
  { id: 'RX-003', patientId: 'P100002', patientName: '李娜', date: '2026-06-15', drug: '复方氯己定漱口水', dosage: '一日两次 含漱', days: 14, dentist: '李医生', note: '牙周护理' },
  ...(() => {
    const POOL = [
      { drug: '甲硝唑片 0.2g', dosage: '一次一片 一日三次', days: 7, note: '厌氧菌感染' },
      { drug: '头孢克洛缓释片 0.375g', dosage: '一日一次', days: 6, note: '术后抗感染' },
      { drug: '布洛芬缓释胶囊 0.3g', dosage: '必要时服用', days: 3, note: '止痛' },
      { drug: '复方氯己定漱口水', dosage: '一日两次 含漱', days: 14, note: '牙周护理' },
      { drug: '对乙酰氨基酚片 0.5g', dosage: '必要时服用', days: 3, note: '镇痛' },
      { drug: '钙尔奇D 600mg', dosage: '一日一次', days: 30, note: '骨质疏松辅助' },
    ] as const;
    const out: Array<{ id: string; patientId: string; patientName: string; date: string; drug: string; dosage: string; days: number; dentist: string; note: string }> = [];
    for (let i = 0; i < 14; i++) {
      const p = MOCK_DENTAL_PATIENTS[(i * 11 + 4) % MOCK_DENTAL_PATIENTS.length]!;
      const r = rngOf(`emr-rx-${i}`);
      const d = pickBy(r, POOL);
      out.push({
        id: `RX-${String(4 + i).padStart(3, '0')}`,
        patientId: p.id,
        patientName: p.name,
        date: dateShift(ANCHOR_MS, -intBy(r, 5, 200)),
        drug: d.drug,
        dosage: d.dosage,
        days: d.days,
        dentist: p.dentist,
        note: d.note,
      });
    }
    return out;
  })(),
];

export const MOCK_PATIENT_BILLING = [
  { id: 'BILL-001', patientId: 'P100001', patientName: '张伟', date: '2026-06-28', items: [{ name: '树脂充填 MOD', qty: 1, price: 800 }], total: 800, insurance: 400, selfPay: 400, status: 'paid' },
  { id: 'BILL-002', patientId: 'P100001', patientName: '张伟', date: '2026-06-20', items: [{ name: '种植体 Straumann BLT', qty: 1, price: 8000 }, { name: '种植手术费', qty: 1, price: 4000 }], total: 12000, insurance: 3000, selfPay: 9000, status: 'partial' },
  { id: 'BILL-003', patientId: 'P100001', patientName: '张伟', date: '2026-06-25', items: [{ name: '根管治疗', qty: 1, price: 2500 }], total: 2500, insurance: 1200, selfPay: 1300, status: 'pending' },
  ...(() => {
    const ITEM_POOL = [
      [{ name: '龈上洁治', qty: 1, price: 300 }],
      [{ name: '树脂充填', qty: 1, price: 800 }],
      [{ name: '根管治疗', qty: 1, price: 2800 }],
      [{ name: '阻生齿拔除', qty: 1, price: 1800 }],
      [{ name: '全瓷冠', qty: 1, price: 4500 }],
      [{ name: '种植体 + 基台', qty: 1, price: 9800 }, { name: '种植手术费', qty: 1, price: 3000 }],
      [{ name: '隐形矫治 (全程)', qty: 1, price: 36000 }],
      [{ name: '全景片', qty: 1, price: 150 }],
      [{ name: 'CBCT 单颌', qty: 1, price: 450 }],
    ] as const;
    const out: Array<{ id: string; patientId: string; patientName: string; date: string; items: ReadonlyArray<{ name: string; qty: number; price: number }>; total: number; insurance: number; selfPay: number; status: string }> = [];
    for (let i = 0; i < 17; i++) {
      const p = MOCK_DENTAL_PATIENTS[(i * 6 + 8) % MOCK_DENTAL_PATIENTS.length]!;
      const r = rngOf(`emr-bill-${i}`);
      const items = pickBy(r, ITEM_POOL);
      const total = items.reduce((s, it) => s + it.price * it.qty, 0);
      const insurance = Math.round(total * pickBy(r, [0.2, 0.3, 0.4, 0.5]));
      out.push({
        id: `BILL-${String(4 + i).padStart(3, '0')}`,
        patientId: p.id,
        patientName: p.name,
        date: dateShift(ANCHOR_MS, -intBy(r, 3, 240)),
        items: items.map(it => ({ ...it })),
        total,
        insurance,
        selfPay: total - insurance,
        status: pickBy(r, ['paid', 'paid', 'partial', 'pending'] as const),
      });
    }
    return out;
  })(),
];
