// G005-RIS v3.0 危急值数据生成器
// 生成 300 条符合 CriticalValue 接口的全闭环危急值记录
// 输出到 stdout 或指定文件

// ============ 常量 ============

// 30+ 种危急值类型（卫健委目录）
const CRITICAL_TYPES = [
  { finding: '颅内血肿', details: '颅内见高密度血肿影，血肿量约XXml，占位效应明显', bodyPart: '头颅', modality: 'CT' },
  { finding: '脑疝形成', details: '脑组织移位，中线偏移>10mm，环池消失', bodyPart: '头颅', modality: 'CT' },
  { finding: '主动脉夹层', details: '主动脉内见撕裂内膜片，形成真假腔，累及范围XX', bodyPart: '胸部', modality: 'CT' },
  { finding: '肺栓塞', details: '肺动脉主干及分支见充盈缺损，栓塞累及XX段', bodyPart: '胸部', modality: 'CT' },
  { finding: '急性心肌梗死', details: '冠状动脉完全闭塞，心肌灌注缺损，肌钙蛋白升高', bodyPart: '心脏', modality: 'CT' },
  { finding: '张力性气胸', details: '右侧大量气胸，肺组织完全压缩，纵隔左移', bodyPart: '胸部', modality: 'DR' },
  { finding: '消化道穿孔', details: '膈下游离气体，腹腔内见游离气体影', bodyPart: '腹部', modality: 'CT' },
  { finding: '急性胰腺炎（重症）', details: '胰腺弥漫性肿大，胰周脂肪间隙模糊，可见渗出积液', bodyPart: '腹部', modality: 'CT' },
  { finding: '肝癌破裂', details: '肝内占位破裂伴腹腔内大量积血', bodyPart: '腹部', modality: 'CT' },
  { finding: '宫外孕破裂', details: '附件区混杂密度肿块，盆腔大量积血', bodyPart: '盆腔', modality: 'CT' },
  { finding: '肝脾破裂', details: '肝/脾实质内不规则高密度影，包膜下血肿，腹腔积血', bodyPart: '腹部', modality: 'CT' },
  { finding: '急性脑梗死（大面积）', details: '颅内大面积低密度灶，累及XX动脉供血区', bodyPart: '头颅', modality: 'CT' },
  { finding: '蛛网膜下腔出血', details: '蛛网膜下腔见高密度铸型，基底池受压', bodyPart: '头颅', modality: 'CT' },
  { finding: '硬膜下血肿（急性）', details: '颅板下新月形高密度影，占位效应显著', bodyPart: '头颅', modality: 'CT' },
  { finding: '硬膜外血肿（急性）', details: '颅板下梭形高密度影，中线移位', bodyPart: '头颅', modality: 'CT' },
  { finding: '脊髓压迫', details: '椎管内占位/骨折片压迫脊髓，马尾神经受压', bodyPart: '脊柱', modality: 'MR' },
  { finding: '心脏压塞', details: '心包大量积液伴右心室舒张期塌陷', bodyPart: '心脏', modality: 'CT' },
  { finding: '肠系膜上动脉栓塞', details: '肠系膜上动脉内见充盈缺损，肠壁缺血', bodyPart: '腹部', modality: 'CT' },
  { finding: '肠坏死', details: '肠壁气肿、肠系膜静脉气体、门静脉气体', bodyPart: '腹部', modality: 'CT' },
  { finding: '卵巢囊肿扭转', details: '盆腔囊性肿块伴蒂扭转，囊壁水肿增厚', bodyPart: '盆腔', modality: 'CT' },
  { finding: '睾丸扭转', details: '睾丸血流信号消失，精索扭转', bodyPart: '盆腔', modality: 'US' },
  { finding: '主动脉瘤破裂', details: '主动脉瘤破裂伴腹膜后血肿', bodyPart: '腹部', modality: 'CT' },
  { finding: '扁桃体周围脓肿', details: '咽旁间隙脓肿形成，气道受压狭窄', bodyPart: '颈部', modality: 'CT' },
  { finding: '眼眶爆裂性骨折', details: '眶壁骨折伴眼外肌嵌顿', bodyPart: '头颅', modality: 'CT' },
  { finding: '化脓性骨髓炎（急性）', details: '骨髓腔内异常信号，骨膜反应，周围软组织肿胀', bodyPart: '四肢', modality: 'MR' },
  { finding: '急性阑尾炎伴穿孔', details: '阑尾增粗>7mm，壁增厚，周围渗出，可见粪石', bodyPart: '腹部', modality: 'CT' },
  { finding: '肠套叠（儿童）', details: '肠管套叠征，呈同心圆/靶环征', bodyPart: '腹部', modality: 'CT' },
  { finding: '气管/支气管异物', details: '气道内见异物影伴阻塞性肺气肿', bodyPart: '胸部', modality: 'CT' },
  { finding: '急性肺动脉高压', details: '肺动脉主干增宽>30mm，右心增大', bodyPart: '胸部', modality: 'CT' },
  { finding: '股骨头缺血坏死', details: '股骨头内异常信号带，软骨下骨折', bodyPart: '四肢', modality: 'MR' },
  { finding: '肝脓肿', details: '肝内类圆形低密度灶伴环状强化，分隔强化', bodyPart: '腹部', modality: 'CT' },
  { finding: '急性化脓性胆管炎', details: '胆管壁增厚强化，管腔扩张，胆总管结石嵌顿', bodyPart: '腹部', modality: 'MR' },
  { finding: '气性坏疽', details: '肌肉组织内见气体密度影，筋膜水肿', bodyPart: '四肢', modality: 'CT' },
  { finding: '纵隔气肿', details: '纵隔内见气体影，伴皮下气肿', bodyPart: '胸部', modality: 'CT' },
];

const SEVERITIES = ['危及生命', '危急', '高危', '紧急', '警告'];
const SEVERITY_WEIGHTS = [0.05, 0.25, 0.40, 0.20, 0.10];

const NOTIFICATION_METHODS = ['电话', '短信', '微信', '钉钉'];
const NOTIFICATION_WEIGHTS = [0.50, 0.25, 0.15, 0.10];

const DISCOVERY_METHODS = ['AI自动检测', '医生人工发现', '技师发现'];
const DISCOVERY_WEIGHTS = [0.40, 0.40, 0.20];

const STATUSES = ['closed_loop', 'notified', 'acknowledged', 'resolving', 'escalated', 'overdue'];

const PATIENT_TYPES = ['门诊', '住院', '急诊', '体检'];
const GENDERS = ['男', '女'];

const DOCTOR_NAMES = [
  '张明远', '李文博', '王志强', '陈晓峰', '刘晓燕',
  '赵志刚', '孙丽华', '周建国', '吴晓明', '郑雅文',
  '王建国', '李秀英', '张建国', '刘文博', '陈雅芝',
  '杨丽华', '赵建国', '黄晓明', '周丽华', '吴文博',
  '徐志强', '孙丽萍', '马建华', '朱晓燕', '胡志明',
  '林丽华', '何建国', '高晓峰', '罗志强', '梁丽华',
];

const PATIENT_NAMES = [
  '张志刚', '李秀英', '王建国', '刘文博', '陈雅芝',
  '杨丽华', '赵建国', '黄晓明', '周丽华', '吴文博',
  '徐志强', '孙丽萍', '马建华', '朱晓燕', '胡志明',
  '林丽华', '何建国', '高晓峰', '罗志强', '梁丽华',
  '王芳', '赵刚', '陈丽', '刘洋', '周敏',
  '吴强', '郑秀兰', '冯建国', '褚丽华', '魏志强',
];

const EXAM_ITEMS = [
  '头颅CT平扫', '胸部CT平扫', '腹部CT平扫+增强', '盆腔CT平扫',
  '头颅MR平扫', '颈椎MR平扫', '腰椎MR平扫', '四肢DR',
  '胸部DR', '腹部DR', '急诊头颅CT', '急诊胸部CT',
  '急诊腹部CT', '急诊全身CT', '冠脉CTA', '主动脉CTA',
  '肺动脉CTA', '颅脑CTA', '颈椎CT', '腰椎CT',
];

const DEVICE_NAMES = [
  'GE Revolution CT', 'Siemens Force CT', 'Canon Aquilion ONE',
  'Siemens Skyra 3T', 'GE Signa Architect 3T', 'Philips Ingenia 3T',
  'Siemens Multix DR', 'GE Definium DR', 'Philips DigitalDiagnost DR',
];

// ============ 辅助函数 ============

function pick(arr, weights) {
  if (!weights) return arr[Math.floor(Math.random() * arr.length)];
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < arr.length; i++) {
    r -= weights[i];
    if (r <= 0) return arr[i];
  }
  return arr[arr.length - 1];
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pad(n, len = 3) {
  return String(n).padStart(len, '0');
}

function isoTime(offsetMin) {
  return new Date(Date.now() + offsetMin * 60000).toISOString();
}

function pickPatient() {
  const idx = randInt(1, 30);
  return `RAD-P${pad(idx)}`;
}

function pickPhone() {
  const prefix = ['138', '139', '150', '151', '152', '186', '187', '188'];
  return pick(prefix) + Array.from({ length: 8 }, () => randInt(0, 9)).join('');
}

// ============ 主生成函数 ============

function generateCriticalValues() {
  const records = [];
  const baseTime = -30 * 24 * 60; // 过去30天（分钟）

  // 统计状态分布
  const statusGroups = {
    // 200条闭环
    closed_loop: { start: 0, end: 199, count: 200 },
    // 60条处理中: notified/acknowledged/resolving 各约20
    notified: { start: 200, end: 219, count: 20 },
    acknowledged: { start: 220, end: 239, count: 20 },
    resolving: { start: 240, end: 259, count: 20 },
    // 20条升级链
    escalated: { start: 260, end: 279, count: 20 },
    // 20条超时
    overdue: { start: 280, end: 299, count: 20 },
  };

  for (let i = 0; i < 300; i++) {
    // 确定状态
    let status;
    if (i <= 199) status = 'closed_loop';
    else if (i <= 219) status = 'notified';
    else if (i <= 239) status = 'acknowledged';
    else if (i <= 259) status = 'resolving';
    else if (i <= 279) status = 'escalated';
    else status = 'overdue';

    // 选取危急值类型
    const criticalType = pick(CRITICAL_TYPES);

    // 严重度
    const severity = status === 'overdue'
      ? pick(['危及生命', '危急', '高危'])
      : pick(SEVERITIES, SEVERITY_WEIGHTS);

    // 时间分布
    const discoverOffset = baseTime + Math.random() * 30 * 24 * 60;
    const reportedTime = new Date(Date.now() + discoverOffset * 60000).toISOString();

    // 根据状态设置时间线
    let notifiedTime, ackTime, resolvingTime, resolvedTime, closedTime;
    let escalationLevel = 0;
    let processingDuration;

    const notifyDelay = randInt(1, 10);
    const ackDelay = randInt(1, 15);
    const resolveDelay = randInt(5, 60);
    const closedDelay = randInt(10, 120);

    if (status === 'closed_loop') {
      // 闭环时间分布: <5min 30%, 5-15min 40%, 15-30min 20%, >30min 10%
      const r = Math.random();
      let totalDuration;
      if (r < 0.30) totalDuration = randInt(1, 5);
      else if (r < 0.70) totalDuration = randInt(5, 15);
      else if (r < 0.90) totalDuration = randInt(15, 30);
      else totalDuration = randInt(30, 120);

      const base = new Date(reportedTime).getTime();
      const notifyOffset = Math.min(randInt(1, 3), totalDuration);
      const ackOffset = Math.min(notifyOffset + randInt(1, 5), totalDuration);
      const resolveOffset = Math.min(ackOffset + randInt(2, 10), totalDuration);

      notifiedTime = new Date(base + notifyOffset * 60000).toISOString();
      ackTime = new Date(base + ackOffset * 60000).toISOString();
      resolvingTime = new Date(base + resolveOffset * 60000).toISOString();
      resolvedTime = new Date(base + totalDuration * 60000 * 0.7).toISOString();
      closedTime = new Date(base + totalDuration * 60000).toISOString();
      processingDuration = `${totalDuration}分钟`;
    } else if (status === 'notified') {
      const base = new Date(reportedTime).getTime();
      notifiedTime = new Date(base + notifyDelay * 60000).toISOString();
      processingDuration = `${notifyDelay}分钟`;
    } else if (status === 'acknowledged') {
      const base = new Date(reportedTime).getTime();
      notifiedTime = new Date(base + notifyDelay * 60000).toISOString();
      ackTime = new Date(base + (notifyDelay + ackDelay) * 60000).toISOString();
      processingDuration = `${notifyDelay + ackDelay}分钟`;
    } else if (status === 'resolving') {
      const base = new Date(reportedTime).getTime();
      notifiedTime = new Date(base + notifyDelay * 60000).toISOString();
      ackTime = new Date(base + (notifyDelay + ackDelay) * 60000).toISOString();
      resolvingTime = new Date(base + (notifyDelay + ackDelay + resolveDelay) * 60000).toISOString();
      processingDuration = `${notifyDelay + ackDelay + resolveDelay}分钟`;
    } else if (status === 'escalated') {
      const base = new Date(reportedTime).getTime();
      escalationLevel = randInt(1, 3);
      notifiedTime = new Date(base + notifyDelay * 60000).toISOString();
      ackTime = new Date(base + (notifyDelay + ackDelay) * 60000).toISOString();
      processingDuration = `${notifyDelay + ackDelay}分钟`;
    } else if (status === 'overdue') {
      // 超时：>30min 未闭环
      const base = new Date(reportedTime).getTime();
      notifiedTime = new Date(base + randInt(5, 15) * 60000).toISOString();
      ackTime = new Date(base + randInt(15, 30) * 60000).toISOString();
      processingDuration = `${randInt(30, 180)}+分钟`;
    }

    // 通知方式
    const notificationMethod = pick(NOTIFICATION_METHODS, NOTIFICATION_WEIGHTS);

    // 发现方式
    const discoveryMethod = pick(DISCOVERY_METHODS, DISCOVERY_WEIGHTS);

    // 医生/患者信息
    const patientIdx = randInt(0, 29);
    const patientId = `RAD-P${pad(patientIdx + 1)}`;
    const patientName = PATIENT_NAMES[patientIdx];
    const gender = pick(GENDERS);
    const age = randInt(18, 85);
    const patientType = pick(PATIENT_TYPES);
    const examItem = pick(EXAM_ITEMS);
    const deviceName = pick(DEVICE_NAMES);
    const reportedBy = `D${pad(randInt(1, 50))}`;
    const reportedByName = pick(DOCTOR_NAMES);
    const receivingDoctorId = `D${pad(randInt(51, 80))}`;
    const receivingDoctorName = pick(DOCTOR_NAMES);

    // 构建时间线
    const timeline = [];
    timeline.push({ time: reportedTime, event: `发现${severity}级危急值：${criticalType.finding}`, user: reportedByName, detail: discoveryMethod === 'AI自动检测' ? 'AI辅助诊断系统自动检测' : '医生人工阅片发现' });

    if (notifiedTime) {
      timeline.push({ time: notifiedTime, event: `已通过${notificationMethod}通知临床`, user: reportedByName, detail: `接收医生：${receivingDoctorName}` });
    }
    if (ackTime) {
      timeline.push({ time: ackTime, event: '临床医生已接收确认', user: receivingDoctorName, detail: '' });
    }
    if (resolvingTime) {
      timeline.push({ time: resolvingTime, event: '处理中', user: receivingDoctorName, detail: status === 'resolved' || status === 'closed_loop' ? '已采取临床处理措施' : '' });
    }
    if (resolvedTime) {
      timeline.push({ time: resolvedTime, event: '危急值已处理', user: receivingDoctorName, detail: '患者病情已得到控制' });
    }
    if (closedTime) {
      timeline.push({ time: closedTime, event: '危急值闭环归档', user: reportedByName, detail: `全程处理时长${processingDuration}` });
    }
    if (status === 'escalated') {
      timeline.push({ time: new Date(new Date(reportedTime).getTime() + 30 * 60000).toISOString(), event: `已升级至${escalationLevel}级处理`, user: pick(DOCTOR_NAMES), detail: `升级至${['科室主任', '医务科', '院领导'][escalationLevel - 1]}` });
    }
    if (status === 'overdue') {
      timeline.push({ time: new Date(Date.now() - randInt(5, 60) * 60000).toISOString(), event: '⚠ 超时未闭环', user: '系统自动', detail: '已超出规定处理时限' });
    }

    // 测量值
    const resultValue = severity === '危及生命' || severity === '危急' ? String(randInt(50, 200)) : String(randInt(10, 500));
    const resultUnit = criticalType.modality === 'CT' ? 'HU' : 'mm';
    const criticalRange = severity === '危及生命' ? '>50HU' : severity === '危急' ? '>30HU' : '>15HU';

    // 处理措施
    const measures = [
      '通知临床医生紧急处理', '立即给予吸氧监护', '建立静脉通道',
      '双人复核确认', '报告科室主任', '申请急诊手术',
      '转入ICU监护', '给予溶栓治疗', '紧急联系家属',
      '启动多学科会诊',
    ];

    const record = {
      id: `CVE-${pad(i + 1, 5)}`,
      reportId: `RPT-${pad(randInt(1000, 9999))}`,
      examId: `EX-${pad(randInt(10000, 99999))}`,
      patientId,
      patientName,
      gender,
      age,
      patientType,
      phone: pickPhone(),
      contactPerson: pick(DOCTOR_NAMES),
      modality: criticalType.modality,
      examItemName: examItem,
      bodyPart: criticalType.bodyPart,
      criticalFinding: criticalType.finding,
      findingDetails: criticalType.details,
      severity,
      resultValue,
      resultUnit,
      normalRange: '<10',
      criticalRange,
      exceedRatio: `+${randInt(50, 500)}%`,
      reportedBy,
      reportedByName,
      reportedTime,
      receivingDoctorId,
      receivingDoctorName,
      receivingTime: notifiedTime || undefined,
      receivingDepartment: '急诊科',
      notificationMethod,
      acknowledged: !!ackTime,
      acknowledgedBy: ackTime ? receivingDoctorName : undefined,
      acknowledgedTime: ackTime || undefined,
      status,
      processingDoctor: receivingDoctorId,
      processingDoctorName: receivingDoctorName,
      processingTime: resolvingTime || undefined,
      processingDepartment: '临床科室',
      processingMeasure: pick(measures),
      processingResult: status === 'closed_loop' || status === 'resolved' ? '患者已接受治疗，病情稳定' : '处理进行中',
      processingDuration,
      followUpNotes: status === 'closed_loop' ? '建议48小时内复查' : '待进一步处理',
      examDoctor: reportedBy,
      examDoctorName: reportedByName,
      examTime: reportedTime,
      deviceName,
      accessionNumber: `ACC-${pad(randInt(10000, 99999))}`,
      timeline,
      documents: status === 'closed_loop' ? [
        { id: `doc-${pad(i + 1)}-1`, name: '危急值处理记录.pdf', type: 'application/pdf', uploadTime: closedTime || new Date().toISOString() }
      ] : [],
      transferredToFollowUp: status === 'closed_loop' && Math.random() > 0.5,
      followUpId: status === 'closed_loop' && Math.random() > 0.5 ? `FU-${pad(randInt(1, 100))}` : undefined,
      followUpDate: status === 'closed_loop' && Math.random() > 0.5 ? new Date(Date.now() + randInt(1, 14) * 86400000).toISOString() : undefined,
    };

    records.push(record);
  }

  return records;
}

// ============ 执行与输出 ============

const start = performance.now();
const data = generateCriticalValues();
const elapsed = ((performance.now() - start) / 1000).toFixed(3);

import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const outputFile = resolve(__dirname, '../../src/data/generatedCriticalValues.ts');

const output = `// G005-RIS v3.0 危急值数据生成器
// 生成时间: ${new Date().toISOString()}
// 记录数: ${data.length}
// 命令: node scripts/seed/03-generate-critical-values.mjs

import type { CriticalValue } from '../pages/critical/types';

export const GENERATED_CRITICAL_VALUES: CriticalValue[] = ${JSON.stringify(data, null, 2)};
`;

import { writeFileSync } from 'node:fs';
writeFileSync(outputFile, output, 'utf-8');
console.log(`\n✓ 文件已写入: ${outputFile}`);
console.log(`  ${data.length} 条危急值记录`);
console.log(`  运行时间: ${elapsed}s`);

// 输出统计信息到 stderr
console.error(`\n=== 生成统计 ===`);
console.error(`总记录数: ${data.length}`);
console.error(`运行时间: ${elapsed}s`);

// 状态分布
const statusCount = {};
data.forEach(r => { statusCount[r.status] = (statusCount[r.status] || 0) + 1; });
console.error(`\n状态分布:`);
Object.entries(statusCount).sort().forEach(([k, v]) => console.error(`  ${k}: ${v}`));

// 严重度分布
const sevCount = {};
data.forEach(r => { sevCount[r.severity] = (sevCount[r.severity] || 0) + 1; });
console.error(`\n严重度分布:`);
Object.entries(sevCount).sort((a, b) => a[1] - b[1]).forEach(([k, v]) => console.error(`  ${k}: ${v} (${(v/data.length*100).toFixed(1)}%)`));

// 通知方式分布
const notCount = {};
data.forEach(r => { notCount[r.notificationMethod] = (notCount[r.notificationMethod] || 0) + 1; });
console.error(`\n通知方式分布:`);
Object.entries(notCount).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.error(`  ${k}: ${v} (${(v/data.length*100).toFixed(1)}%)`));

// 危急值类型去重统计
const findingCount = {};
data.forEach(r => { findingCount[r.criticalFinding] = (findingCount[r.criticalFinding] || 0) + 1; });
console.error(`\n危急值类型数: ${Object.keys(findingCount).length}`);
console.error(`\n=== 生成完毕 ===`);
