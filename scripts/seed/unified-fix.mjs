// G005-RIS v3.0 统一数据修复器
// 生成全部关联数据,确保 100% 可追溯
// 使用方式: node scripts/seed/unified-fix.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

// ==================== 确定性 RNG ====================
function createRng(seed) { let s = seed; return function(){ s=(s*1664525+1013904223)&0xffffffff; return (s>>>0)/4294967296; }; }
function pick(arr, rng) { return arr[Math.floor(rng()*arr.length)]; }
function randInt(min, max, rng) { return Math.floor(rng()*(max-min+1))+min; }
function pad(n, len) { return String(n).padStart(len,'0'); }
function formatDate(d) { return `${d.getFullYear()}-${pad(d.getMonth()+1,2)}-${pad(d.getDate(),2)}`; }
function formatDateTime(d) { return formatDate(d)+'T'+pad(d.getHours(),2)+':'+pad(d.getMinutes(),2)+':'+pad(d.getSeconds(),2)+'.000Z'; }
function randomDate(start, end, rng) { return new Date(start.getTime()+rng()*(end.getTime()-start.getTime())); }

function pickWeighted(items, weights, rng) {
  const total = weights.reduce((a,b)=>a+b,0);
  let r = rng()*total;
  for(let i=0;i<items.length;i++){ r-=weights[i]; if(r<=0) return items[i]; }
  return items[items.length-1];
}

// ==================== 常量池 (与 master mock 一致) ====================
const SURNAMES = "王李张刘陈杨黄赵周吴徐孙朱马胡郭林何高梁郑罗宋谢唐韩曹许邓萧冯曾程蔡彭潘袁于董余苏叶吕魏蒋田杜丁沈姜范江傅钟卢汪戴崔任陆廖姚方金邱夏谭韦贾邹石熊孟秦阎薛侯雷白龙段郝孔邵史毛常万顾赖严覃武钱施".split("");
const GIVEN_M = "建国建军强伟杰磊洋凯宇浩然子轩志远鹏程凌霄致远梓豪鸿涛明远天宇文博志远子墨鸿轩俊熙景行翊辰玉成泽宇明哲嘉伟天佑云飞晨曦锦程昊阳睿哲文昊鸿远德昌永盛世昌锦华万鹏瑞祥".split("");
const GIVEN_F = "红梅丽娟芳娜静敏秀英霞平燕莹洁慧萍红玲晓梅雅婷佳怡思涵若曦梓萱一鸣婧怡欣怡雪梅美玲慧珊若兰静雯雨彤心怡若汐".split("");

function pickName(gender, rng) {
  const s = SURNAMES[Math.floor(rng()*SURNAMES.length)];
  const g = gender === '男' ? pick(GIVEN_M, rng) : pick(GIVEN_F, rng);
  return s + g;
}

// ==================== 1a: 加载 Master 患者数据 (P000001-P049700) ====================
const PATIENT_COUNT = 49700;
const PATIENTS = [];
const PATIENT_IDS = [];
for (let i = 0; i < PATIENT_COUNT; i++) {
  const id = `P${pad(i + 1, 6)}`;
  PATIENT_IDS.push(id);
  const gender = randInt(0, 1, Math.random) ? '男' : '女';
  PATIENTS.push({ id, name: pickName(gender, Math.random), gender, age: randInt(18, 85, Math.random) });
}
console.log(`[1a] 加载了 ${PATIENTS.length} 名 master 患者 (ID: ${PATIENTS[0].id}-${PATIENTS[PATIENTS.length-1].id})`);

// ==================== 加载设备 (45 台) ====================
const MODALITY_ORDER = ["CT","MR","DR","US","MG","DSA","PET-CT"];
const MODALITY_CN = { CT:'CT', MR:'MR', DR:'DR', US:'US', MG:'MG', DSA:'DSA', 'PET-CT':'PET-CT' };
const DEVICE_COUNTS = { CT:10, MR:8, DR:12, US:8, MG:3, DSA:2, 'PET-CT':2 };
const DEVICE_NAMES_BY_MOD = {
  CT: ['GE Revolution CT','Siemens SOMATOM Force','Philips IQon Spectral','Canon Aquilion ONE','联影 uCT 960+','Siemens SOMATOM Definition AS+','联影 uCT 860','Neusoft NeuViz 128','GE Optima CT660','Philips Incisive CT'],
  MR: ['Siemens MAGNETOM Vida','GE SIGNA Premier','Philips Ingenia Elition','Canon Vantage Galan','联影 uMR 890','Siemens MAGNETOM Lumina','GE SIGNA Architect','Philips Prodiva'],
  DR: ['GE Definium Tempo','Siemens Multix Fusion','Philips DigitalDiagnost C90','联影 uDR 780i','Neusoft NeuVision 460','Carestream DRX-Revolution','GE Definium DR','Siemens Ysio Max','联影 uDR 560','佳能 CXDI-70C','迈瑞 DigiEye 680','岛津 RADspeed Pro'],
  US: ['飞利浦 EPIQ Elite','GE LOGIQ E10','Siemens ACUSON Sequoia','迈瑞 Resona 7','联影 uUS 790','飞利浦 Affiniti 70','GE Vivid E95','Sonoscape P50'],
  MG: ['Hologic 3Dimensions','GE Senographe Pristina','Fujifilm AMULET Innovality'],
  DSA: ['Siemens Artis Q','Philips Azurion 7 M20'],
  'PET-CT': ['Siemens Biograph Vision 600','联影 uMI Panorama']
};
const DEVICES = [];
for (const mod of MODALITY_ORDER) {
  const count = DEVICE_COUNTS[mod];
  const names = DEVICE_NAMES_BY_MOD[mod];
  for (let i = 0; i < count; i++) {
    const id = `DEV-${mod}-${pad(i + 1, 3)}`;
    DEVICES.push({ id, modality: mod, name: names[i] || `${mod}设备${i+1}` });
  }
}
console.log(`[1a] 加载了 ${DEVICES.length} 台 master 设备 (ID: ${DEVICES[0].id}-${DEVICES[DEVICES.length-1].id})`);

// ==================== 加载医生 (75 名, D001-D075) ====================
const DOCTOR_TITLES = ["主任医师","副主任医师","主治医师","住院医师","技师","护士","护师"];
const DOCTOR_NAMES = [
  "李明辉","王秀峰","张海涛","陈志远","刘文博","杨丽华","赵建国","黄晓明","周丽华","吴文博",
  "郑华","孙磊","唐磊","钱峰","冯刚","邓超","曹阳","彭湃","沈涛","姚远",
  "卢勇","姜涛","崔健","钟诚","谭飞","陆毅","汪洋","范伟","金鑫","石磊",
  "廖强","贾亮","夏冰","韦华","付强","方明","白玉","邹平","孟超","熊伟",
  "秦峰","邱明","江涛","尹哲","薛峰","闫军","段鹏","雷震","侯勇","龙飞",
  "史进","陶然","黎明","贺军","顾诚","毛宇","郝帅","龚翔","邵峰","万历",
  "钱程","严峻","覃勇","武斌","戴超","莫凡","孔令","向前","汤唯","张伟",
  "李娜","王芳","刘洋","陈丽","杨帆"
];
const DOCTORS = [];
for (let i = 0; i < 75; i++) {
  const id = `D${pad(i + 1, 3)}`;
  DOCTORS.push({ id, name: DOCTOR_NAMES[i] || `医生${i+1}` });
}
console.log(`[1a] 加载了 ${DOCTORS.length} 名 master 医生 (ID: ${DOCTORS[0].id}-${DOCTORS[DOCTORS.length-1].id})`);

// ==================== 1b: 生成 14,000 条检查 ====================
const EXAM_STATUSES = ['已发布', '已签发', '审核中', '书写中', '退回'];
const EXAM_STATUS_WEIGHTS = [0.60, 0.15, 0.10, 0.10, 0.05];
const MODALITY_WEIGHTS = { CT: 0.25, MR: 0.20, DR: 0.25, DSA: 0.05, MG: 0.05, 'PET-CT': 0.05, US: 0.10, 介入: 0.05 };
const MODALITY_LIST = Object.keys(MODALITY_WEIGHTS);
const MOD_WEIGHT_VALS = Object.values(MODALITY_WEIGHTS);
const BODY_PARTS = ["头部","颈部","胸部","心脏","腹部","盆腔","脊柱","骨关节","四肢","血管","软组织","全身","乳腺","甲状腺","泌尿","消化","呼吸","神经"];
const CLINICAL_DIAGNOSES = [
  '脑梗死后复查','腰痛待查','肺炎','外伤后检查','乳腺结节随访','头痛待查','腹部不适','咳嗽待查',
  '骨折复查','术前检查','高血压','糖尿病','冠心病','脑出血','肿瘤术后复查','肝占位性质待定',
  '肾囊肿','胆囊结石','前列腺增生','子宫肌瘤','甲状腺结节','鼻窦炎','中耳炎','体检发现',
  '胸痛','腹痛','关节痛','水肿待查','发热待查','贫血','泌尿系感染','慢阻肺','哮喘',
  '肺结节随访','淋巴结肿大','骨质疏松','椎间盘突出','坐骨神经痛','肩周炎','膝关节炎',
  '类风湿','痛风','脊柱侧弯','肾功能不全','胰腺炎','胆囊炎','阑尾炎','肠梗阻',
  '胃溃疡','肝硬化','肾结石','输尿管结石','膀胱肿瘤','前列腺炎','卵巢囊肿','盆腔炎',
  '乳腺增生','乳腺炎','甲状腺炎','甲亢','甲减','库欣综合征','肾上腺腺瘤',
];
const EXAM_ITEMS = [
  '头部CT平扫','胸部CT平扫','腹部CT平扫','盆腔CT平扫','冠脉CTA','头颈CTA','主动脉CTA',
  '胸部CT增强','腹部CT增强','头颅MR平扫','颈椎MR平扫','腰椎MR平扫','腹部MR平扫',
  '头颅MR增强','腹部MR增强','胸部DR正位','胸部DR正侧位','腹部立卧位平片','骨盆正位',
  '四肢关节正侧位','脊柱正侧位','腹部超声(肝胆胰脾)','泌尿系超声','心脏超声',
  '甲状腺超声','乳腺超声','乳腺钼靶','DSA脑血管造影','DSA冠脉造影','下肢静脉造影',
  'PET-CT全身显像','胸部低剂量CT(LDCT)','颈部CT平扫','鼻窦CT平扫','颞骨CT',
  '膝关节正侧位','踝关节正侧位','腕关节正侧位','髋关节正位',
];

const START_DATE = new Date('2024-01-01');
const END_DATE = new Date('2026-07-10');
const EXAM_COUNT = 14000;

const exams = [];
const examIds = [];
for (let i = 0; i < EXAM_COUNT; i++) {
  const rng = Math.random;
  const id = `RAD-EX-${pad(i + 1, 6)}`;
  examIds.push(id);
  const patient = pick(PATIENTS, rng);
  const device = pick(DEVICES, rng);
  const doctor = pick(DOCTORS, rng);
  const modality = pickWeighted(MODALITY_LIST, MOD_WEIGHT_VALS, rng);
  const bodyPart = pick(BODY_PARTS, rng);
  const examDate = randomDate(START_DATE, END_DATE, rng);
  const createdTime = new Date(examDate.getTime() - randInt(30, 180, rng)*60000);
  const status = pickWeighted(EXAM_STATUSES, EXAM_STATUS_WEIGHTS, rng);
  let completedAt = null;
  let publishedTime = null;
  if (status === '已发布' || status === '已签发') {
    completedAt = new Date(examDate.getTime() + randInt(10, 90, rng)*60000);
    publishedTime = new Date(completedAt.getTime() + randInt(30, 360, rng)*60000);
  }
  exams.push({
    id,
    patientId: patient.id,
    patientName: patient.name,
    gender: patient.gender,
    age: patient.age,
    patientType: pick(['门诊','住院','急诊','体检'], rng),
    modality,
    bodyPart,
    examItemName: pick(EXAM_ITEMS, rng),
    examDate: formatDate(examDate),
    examTime: pad(examDate.getHours(),2)+':'+pad(examDate.getMinutes(),2),
    status,
    priority: pickWeighted(['普通','紧急','危重'],[0.7,0.25,0.05], rng),
    deviceId: device.id,
    deviceName: device.name,
    radiologistId: doctor.id,
    radiologistName: doctor.name,
    clinicalDiagnosis: pick(CLINICAL_DIAGNOSES, rng),
    createdAt: formatDateTime(createdTime),
    updatedAt: formatDateTime(examDate),
    completedAt: completedAt ? formatDateTime(completedAt) : null,
    publishedTime: publishedTime ? formatDateTime(publishedTime) : null,
    scheduledAt: formatDateTime(new Date(examDate.getTime() - randInt(60, 1440, rng)*60000)),
  });
}
console.log(`[1b] 生成 ${exams.length} 条检查 (${examIds[0]}-${examIds[examIds.length-1]})`);

// ==================== 1c: 生成 9,000 份报告 ====================
const REPORT_STATES = ['已发布','已签发','初审中','终审中','修订中'];
const REPORT_WEIGHTS = [0.40, 0.20, 0.15, 0.15, 0.10];
const RADIOLOGY_FINDINGS = [
  '所见未见明确器质性病变。','双肺纹理清晰，未见实变或肿块。','肺内未见结节或占位性病变。',
  '心影大小正常，纵隔未见增宽。','肝内多发囊肿，最大约2.3cm。','胆囊壁光滑，未见结石。',
  '胰腺形态大小正常，未见占位。','双肾大小形态正常，未见结石或积水。','脊柱生理曲度存在，椎体骨质增生。',
  '关节间隙未见狭窄，骨质未见破坏。','脑实质未见异常密度/信号影。','脑室系统对称，中线结构居中。',
  '基底节区见腔隙性梗死灶。','双侧侧脑室旁白质见缺血性改变。','鞍区及桥小脑角区未见异常。',
  '右肺上叶见磨玻璃结节，直径约8mm。','左肺下叶见实性结节，直径约5mm。','右肺门淋巴结增大。',
  '左胸腔少量积液。','心包少量积液。','主动脉壁钙化。','冠状动脉钙化积分：Agatston 158。',
  '肝左叶见类圆形低密度灶，边界清楚。','肝右叶见多发低密度灶，增强后环形强化。',
  '胰腺头部见囊性病变。','双肾多发囊肿。','膀胱壁增厚。','前列腺体积增大。',
  '子宫体积增大，肌壁间见多发肌瘤。','卵巢见囊性病变。','乳腺外上象限见结节，BI-RADS 3类。',
  '甲状腺左叶见低回声结节，TI-RADS 4A类。','鼻窦黏膜增厚。','乳突气化不良。',
  '颈椎退行性改变。','腰椎间盘突出。','膝关节半月板损伤。','肩袖撕裂。',
  '骨质疏松改变。','骨折愈合中，见骨痂形成。','金属内固定在位，未见松动。',
];
const DIAGNOSES = [
  '所见未见明显异常。','轻度退行性改变。','符合慢性支气管炎改变。','肺结节，建议随访复查。',
  '考虑良性病变，建议定期复查。','恶性肿瘤可能，建议进一步检查。','急性炎症改变。',
  '骨折改变。','术后改变，未见明显异常。','符合腔隙性脑梗死改变。','脑白质疏松改变。',
  '符合肝硬化改变。','符合肾囊肿改变。','符合胆囊结石改变。','符合前列腺增生改变。',
  '符合子宫肌瘤改变。','BI-RADS 3类，建议短期随访。','TI-RADS 4A类，建议穿刺活检。',
  '符合腰椎间盘突出改变。','符合膝关节退行性改变。','骨转移可能，建议进一步检查。',
  '肺栓塞可能，建议临床紧急处理。','主动脉夹层，建议急诊手术。','气胸，建议临床处理。',
];
const REPORT_TEMPLATES = [
  { findings: '肺窗示双肺纹理清晰，未见实变、肿块或结节影。纵隔窗示纵隔无偏移，心影大小形态正常，大血管形态正常。骨窗示胸廓骨质结构完整，未见异常改变。', conclusion: '胸部CT平扫未见明显异常。' },
  { findings: '肝表面光滑，肝叶比例协调。肝左内叶见类圆形低密度灶，边界清楚，密度均匀，CT值约12HU，大小约2.3×1.8cm。增强后未见明显强化。肝内血管走行自然。', conclusion: '肝囊肿（良性病变），建议定期复查。' },
  { findings: '右侧基底节区见类圆形低密度灶，边界清楚，最大层面约1.5×1.2cm。左侧侧脑室前角旁见斑片状低密度灶。脑室系统对称，中线结构居中。', conclusion: '右侧基底节区腔隙性脑梗死；左侧侧脑室旁缺血性改变。' },
  { findings: '右肺上叶后段见磨玻璃密度结节，大小约0.8×0.6cm，边界欠清。左肺下叶见微小实性结节，直径约0.3cm。双肺门结构清晰，纵隔未见肿大淋巴结。', conclusion: '右肺上叶磨玻璃结节，Lung-RADS 3类，建议3-6个月复查。' },
  { findings: '腰椎生理曲度变直。L4/5、L5/S1椎间盘向后突出，硬膜囊受压。L4椎体见骨质增生。椎管未见明显狭窄。', conclusion: '腰椎退行性改变；L4/5、L5/S1椎间盘突出。' },
  { findings: '左膝关节间隙内侧变窄，内侧半月板见条状高信号达关节面。前交叉韧带形态信号未见异常。关节腔少量积液。', conclusion: '左膝内侧半月板撕裂；关节退行性改变。' },
  { findings: '右乳腺外上象限见高密度结节影，大小约1.5×1.2cm，边界不清，形态不规则，可见毛刺征。', conclusion: '右乳腺结节，BI-RADS 4B类，建议穿刺活检。' },
  { findings: '心影呈主动脉型增大。主动脉见弧形钙化。双肺门结构清晰。胸腔无积液。', conclusion: '主动脉硬化；心影增大，建议进一步检查。' },
  { findings: '胆囊体积增大，壁增厚约0.5cm，腔内见多发高密度影，最大约1.2cm。肝内外胆管未见扩张。', conclusion: '胆囊炎伴多发结石。' },
  { findings: '胰头区见囊性病变，大小约3.0×2.5cm，边界清楚，壁薄，内见分隔。增强后囊壁轻度强化。', conclusion: '胰头区囊性病变，IPMN可能，建议进一步检查。' },
  { findings: '双侧胸廓对称。双肺野清晰，肺纹理走行自然。肺门结构正常。心影大小正常。双侧肋膈角锐利。', conclusion: '胸部DR未见明显异常。' },
  { findings: '脑实质内未见明确异常密度影。脑室系统大小形态正常。中线结构居中。颅骨结构完整。', conclusion: '头颅CT平扫未见明显异常。' },
  { findings: '左肱骨外科颈骨折，断端无明显移位。周围软组织肿胀。', conclusion: '左肱骨外科颈骨折。' },
  { findings: '双肾大小形态正常，实质厚度正常。右肾中盏见强回声影，大小约0.6cm，伴声影。左肾未见结石。输尿管未见扩张。', conclusion: '右肾结石。' },
  { findings: '子宫前位，增大，肌壁间见多发低回声结节，最大位于后壁约4.5×3.8cm，边界清楚。内膜线居中，厚约0.8cm。', conclusion: '子宫肌瘤（多发）。' },
];

const REPORT_COUNT = 9000;
const reports = [];
for (let i = 0; i < REPORT_COUNT; i++) {
  const rng = Math.random;
  const exam = exams[i % exams.length];
  const id = `RPT-${pad(i + 1, 6)}`;
  const doctor = pick(DOCTORS, rng);
  const rngIdx = randInt(0, REPORT_TEMPLATES.length-1, rng);
  const tmpl = REPORT_TEMPLATES[rngIdx];
  const hasCritical = rng() < 0.6;
  const reportState = pickWeighted(REPORT_STATES, REPORT_WEIGHTS, rng);
  const createdAt = new Date(exam.createdAt ? new Date(exam.createdAt).getTime() + randInt(5, 120, rng)*60000 : randomDate(START_DATE, END_DATE, rng));
  let signedAt = null;
  if (reportState === '已发布' || reportState === '已签发') {
    signedAt = new Date(createdAt.getTime() + randInt(30, 480, rng)*60000);
  }
  const isPositive = rng() < 0.35;
  const report = {
    id,
    reportId: id,
    examId: exam.id,
    patientId: exam.patientId,
    patientName: exam.patientName,
    gender: exam.gender,
    age: exam.age,
    patientType: exam.patientType,
    modality: exam.modality,
    bodyPart: exam.bodyPart,
    examItemName: exam.examItemName,
    examDate: exam.examDate,
    deviceName: exam.deviceName,
    clinicalHistory: '患者因' + pick(CLINICAL_DIAGNOSES, rng) + '就诊',
    examFindings: pick(RADIOLOGY_FINDINGS, rng),
    diagnosis: pick(DIAGNOSES, rng),
    impression: tmpl.conclusion,
    findings: tmpl.findings,
    conclusion: tmpl.conclusion,
    recommendations: rng() < 0.3 ? `建议${randInt(1,6, rng)}个月后复查` : '',
    criticalFinding: hasCritical,
    criticalFindingDetails: hasCritical ? '报告提示高危阳性发现，建议临床紧急处理' : '',
    reportDoctorId: doctor.id,
    reportDoctorName: doctor.name,
    status: reportState,
    state: reportState,
    isPreliminary: false,
    isAddendum: false,
    createdTime: formatDateTime(createdAt),
    createdAt: formatDateTime(createdAt),
    updatedAt: signedAt ? formatDateTime(signedAt) : formatDateTime(createdAt),
    signedAt: signedAt ? formatDateTime(signedAt) : null,
    signedTime: signedAt ? formatDateTime(signedAt) : null,
    publishedTime: signedAt ? formatDateTime(signedAt) : null,
    publishedBy: signedAt ? doctor.name : null,
    qualityScore: randInt(60, 100, rng),
    auditorId: pick(DOCTORS, rng).id,
    auditorName: pick(DOCTORS, rng).name,
    approvedTime: signedAt ? formatDateTime(new Date(signedAt.getTime() + randInt(60, 360, rng)*60000)) : null,
  };
  reports.push(report);
}
console.log(`[1c] 生成 ${reports.length} 份报告`);

// ==================== 1d: 生成 500 条危急值 ====================
const SEVERITIES = ['危及生命','危急','高危','紧急','警告'];
const SEV_WEIGHTS = [0.05, 0.25, 0.40, 0.20, 0.10];
const CV_STATES = ['closed_loop','notified','acknowledged','escalated','overdue'];
const CV_STATE_COUNTS = [200, 75, 75, 75, 75];
const NOTIFICATION_METHODS = ['电话','短信','系统弹窗','微信推送','PDA推送'];
const DEPARTMENTS = ['心血管内科','呼吸内科','神经内科','急诊科','重症医学科','肿瘤科','骨科','普外科','神经外科'];
const CRITICAL_FINDINGS = [
  '颅内血肿','主动脉夹层','肺栓塞','急性心梗','张力性气胸','腹腔内出血','肝破裂','脾破裂',
  '主动脉瘤破裂','急性脑梗死','脑疝形成','蛛网膜下腔出血','硬膜下血肿','硬膜外血肿',
  '大范围肺栓塞','急性心包填塞','纵隔气肿','食管破裂','胃肠道穿孔','急性胰腺坏死',
  '化脓性胆管炎','肝脓肿','肾破裂','膀胱破裂','血气胸','大量血胸','肺挫裂伤',
  '心肌梗死','室壁瘤','主动脉穿透性溃疡','肠系膜上动脉栓塞','下肢深静脉血栓',
];
const FINDING_DETAILS = [
  '颅内见高密度血肿，占位效应明显，中线结构偏移>1cm。','主动脉内膜片影，真假腔形成，累及升主动脉。',
  '肺动脉主干及分支内见充盈缺损，肺窗见栓塞区。','冠状动脉左前降支完全闭塞，心肌灌注缺损。',
  '胸腔大量气体，肺组织压缩>80%，纵隔向对侧移位。','腹腔内见大量游离液体，实质脏器破裂出血。',
  '肝实质见不规则低密度区，边缘不清。','脾脏形态不完整，脾周见血肿。',
  '主动脉瘤样扩张，最大径>6cm，壁见溃疡形成。','大脑中动脉供血区见大面积低密度梗死灶。',
  '颅内压增高征象，脑沟消失，脑室受压。','蛛网膜下腔见高密度铸型。',
  '颅骨内板下见梭形高密度影。','颅骨内板下见新月形高密度影。',
  '双侧肺动脉分支广泛栓塞。','心包腔见大量液体，心脏受压变小。',
];
const PROCESSING_MEASURES = [
  '建立静脉通道','急诊手术准备','转入ICU','给予溶栓治疗','急诊介入治疗',
  '心电监护','低流量吸氧','紧急配血','血气分析','深静脉置管',
  '急诊CAG检查','急诊外科会诊','气管插管','机械通气','血液透析',
];
const PROCESSING_RESULTS = [
  '患者已接受治疗，病情稳定','已转至ICU继续治疗','急诊手术后转入病房观察',
  '溶栓治疗后症状改善','介入治疗后血流恢复','患者病情稳定，继续监测',
  '已采取对症治疗，症状缓解','转至专科进一步治疗',
];

const criticalValues = [];
const EXAM_SAMPLE = [];
for (let i = 0; i < 500; i++) {
  const exam = exams[i < exams.length ? i : randInt(0, exams.length-1, Math.random)];
  EXAM_SAMPLE.push(exam);
}
for (let i = 0; i < 500; i++) {
  const rng = Math.random;
  const id = `CVE-${pad(i + 1, 5)}`;
  const exam = EXAM_SAMPLE[i];
  const doctor = pick(DOCTORS, rng);
  const receivingDoc = pick(DOCTORS, rng);
  const severity = pickWeighted(SEVERITIES, SEV_WEIGHTS, rng);
  const statusIndex = CV_STATES.findIndex((_, si) => i < CV_STATE_COUNTS.slice(0, si+1).reduce((a,b)=>a+b,0));
  const state = CV_STATES[statusIndex >= 0 ? statusIndex : 0];
  const reportedTime = randomDate(new Date('2025-01-01'), END_DATE, rng);
  const examTime = exam.completedAt ? new Date(exam.completedAt) : reportedTime;
  const createdTime = exam.createdAt ? new Date(exam.createdAt) : new Date(examTime.getTime() - randInt(30, 120, rng)*60000);
  const finding = pick(CRITICAL_FINDINGS, rng);
  const detail = pick(FINDING_DETAILS, rng);
  const timeline = [];
  timeline.push({ time: formatDateTime(examTime), event: '检查完成', user: exam.radiologistName || doctor.name, detail: '影像采集完成' });
  timeline.push({ time: formatDateTime(reportedTime), event: `发现${severity}级危急值：${finding}`, user: doctor.name, detail: detail.substring(0,30)+'...' });
  timeline.push({ time: formatDateTime(new Date(reportedTime.getTime()+60000)), event: `已通过${pick(NOTIFICATION_METHODS, rng)}通知临床`, user: doctor.name, detail: `接收医生：${receivingDoc.name}` });
  timeline.push({ time: formatDateTime(new Date(reportedTime.getTime()+180000)), event: '临床医生已接收确认', user: receivingDoc.name, detail: '' });
  if (state === 'closed_loop' || state === 'acknowledged') {
    timeline.push({ time: formatDateTime(new Date(reportedTime.getTime()+600000)), event: '危急值已处理', user: receivingDoc.name, detail: '患者病情已得到控制' });
    timeline.push({ time: formatDateTime(new Date(reportedTime.getTime()+900000)), event: '危急值闭环归档', user: doctor.name, detail: '全程处理完成' });
  }
  const cv = {
    id,
    reportId: reports.find(r => r.examId === exam.id)?.id || `RPT-${pad(randInt(1,9000, rng), 6)}`,
    examId: exam.id,
    patientId: exam.patientId,
    patientName: exam.patientName,
    gender: exam.gender,
    age: exam.age,
    patientType: exam.patientType || '门诊',
    phone: `138${pad(randInt(0,99999999, rng), 8)}`,
    contactPerson: pick(SURNAMES, rng)+'家属',
    modality: exam.modality,
    examItemName: exam.examItemName,
    bodyPart: exam.bodyPart,
    criticalFinding: finding,
    findingDetails: detail,
    severity,
    resultValue: String(randInt(50, 500, rng)),
    resultUnit: severity === '危及生命' ? 'mm' : 'HU',
    normalRange: '<10',
    criticalRange: severity === '危及生命' ? '>50mm' : '>30HU',
    exceedRatio: '+'+String(randInt(100, 500, rng))+'%',
    reportedBy: doctor.id,
    reportedByName: doctor.name,
    reportedTime: formatDateTime(reportedTime),
    receivingDoctorId: receivingDoc.id,
    receivingDoctorName: receivingDoc.name,
    receivingTime: formatDateTime(new Date(reportedTime.getTime()+60000)),
    receivingDepartment: pick(DEPARTMENTS, rng),
    notificationMethod: pick(NOTIFICATION_METHODS, rng),
    acknowledged: state !== 'notified' && state !== 'overdue',
    acknowledgedBy: state !== 'notified' && state !== 'overdue' ? receivingDoc.name : undefined,
    acknowledgedTime: state !== 'notified' && state !== 'overdue' ? formatDateTime(new Date(reportedTime.getTime()+180000)) : undefined,
    status: state,
    state,
    processingDoctor: state === 'closed_loop' || state === 'acknowledged' ? receivingDoc.id : undefined,
    processingDoctorName: state === 'closed_loop' || state === 'acknowledged' ? receivingDoc.name : undefined,
    processingTime: state === 'closed_loop' || state === 'acknowledged' ? formatDateTime(new Date(reportedTime.getTime()+600000)) : undefined,
    processingDepartment: state === 'closed_loop' || state === 'acknowledged' ? '临床科室' : undefined,
    processingMeasure: pick(PROCESSING_MEASURES, rng),
    processingResult: pick(PROCESSING_RESULTS, rng),
    processingDuration: '12分钟',
    followUpNotes: severity === '危及生命' || severity === '危急' ? '建议24小时内复查' : '建议48小时内复查',
    examDoctor: doctor.id,
    examDoctorName: doctor.name,
    examTime: formatDateTime(examTime),
    deviceName: exam.deviceName,
    accessionNumber: `ACC-${randInt(10000,99999, rng)}`,
    timeline,
  };
  criticalValues.push(cv);
}
console.log(`[1d] 生成 ${criticalValues.length} 条危急值`);

// ==================== 1e: 生成 5,000 条财务记录 ====================
const CHARGE_ITEMS = [
  { code: 'SCN001', name: 'CT平扫(头部)', price: 280 }, { code: 'SCN002', name: 'CT平扫(胸部)', price: 320 },
  { code: 'SCN003', name: 'CT平扫(腹部)', price: 350 }, { code: 'SCN004', name: 'CT增强(头部)', price: 480 },
  { code: 'SCN005', name: 'CT增强(胸部)', price: 580 }, { code: 'SCN006', name: 'CT增强(腹部)', price: 680 },
  { code: 'SCN007', name: '冠脉CTA', price: 1280 }, { code: 'SCN008', name: '头颈CTA', price: 1180 },
  { code: 'SCN009', name: '主动脉CTA', price: 1280 }, { code: 'SCN010', name: 'CTPA(肺栓塞)', price: 1080 },
  { code: 'SCN011', name: 'MR平扫(头部)', price: 560 }, { code: 'SCN012', name: 'MR平扫(颈椎)', price: 560 },
  { code: 'SCN013', name: 'MR平扫(腰椎)', price: 560 }, { code: 'SCN014', name: 'MR增强(头部)', price: 760 },
  { code: 'SCN015', name: 'MR增强(腹部)', price: 860 }, { code: 'SCN016', name: 'MR关节造影', price: 800 },
  { code: 'SCN017', name: 'MR波谱分析(MRS)', price: 600 }, { code: 'SCN018', name: 'MR弥散张量成像(DTI)', price: 800 },
  { code: 'SCN019', name: 'MR灌注成像(PWI)', price: 900 }, { code: 'SCN020', name: 'MR功能成像(fMRI)', price: 1200 },
  { code: 'SCN021', name: 'DR胸部正位', price: 80 }, { code: 'SCN022', name: 'DR胸部正侧位', price: 120 },
  { code: 'SCN023', name: 'DR腹部立卧位', price: 100 }, { code: 'SCN024', name: 'DR脊柱正侧位', price: 160 },
  { code: 'SCN025', name: 'DR四肢关节', price: 100 }, { code: 'SCN026', name: 'DR骨盆正位', price: 100 },
  { code: 'SCN027', name: 'DR颈椎正侧位', price: 120 }, { code: 'SCN028', name: 'DR腰椎正侧位', price: 120 },
  { code: 'SCN029', name: '超声(腹部全套)', price: 280 }, { code: 'SCN030', name: '超声(心脏)', price: 350 },
  { code: 'SCN031', name: '超声(甲状腺)', price: 180 }, { code: 'SCN032', name: '超声(乳腺)', price: 200 },
  { code: 'SCN033', name: '超声(泌尿系)', price: 220 }, { code: 'SCN034', name: '超声(血管)', price: 300 },
  { code: 'SCN035', name: '乳腺钼靶', price: 200 }, { code: 'SCN036', name: '乳腺钼靶(三维断层)', price: 380 },
  { code: 'SCN037', name: 'DSA脑血管造影', price: 3500 }, { code: 'SCN038', name: 'DSA冠脉造影', price: 4000 },
  { code: 'SCN039', name: 'DSA介入治疗(栓塞)', price: 5000 }, { code: 'SCN040', name: 'DSA介入治疗(灌注化疗)', price: 4500 },
  { code: 'SCN041', name: 'PET-CT全身显像', price: 7500 }, { code: 'SCN042', name: 'PET-CT局部显像', price: 4500 },
  { code: 'SCN043', name: '低剂量CT(LDCT)', price: 380 }, { code: 'SCN044', name: 'CT三维重建', price: 200 },
  { code: 'SCN045', name: 'CT引导下穿刺定位', price: 600 }, { code: 'SCN046', name: 'CT引导下介入治疗', price: 1500 },
  { code: 'SCN047', name: '肺结节分析', price: 180 }, { code: 'SCN048', name: '肝体积测量', price: 150 },
  { code: 'SCN049', name: '骨密度测定(DXA)', price: 120 }, { code: 'SCN050', name: '数字断层融合', price: 250 },
  { code: 'SCN051', name: '上消化道造影', price: 280 }, { code: 'SCN052', name: '钡灌肠', price: 320 },
  { code: 'SCN053', name: '静脉肾盂造影(IVP)', price: 350 }, { code: 'SCN054', name: 'T管造影', price: 280 },
  { code: 'SCN055', name: '瘘管/窦道造影', price: 200 }, { code: 'SCN056', name: '关节造影', price: 300 },
  { code: 'INJ001', name: '碘海醇注射液(300mgI/ml 100ml)', price: 285 },
  { code: 'INJ002', name: '碘普罗胺注射液(370mgI/ml 100ml)', price: 358 },
  { code: 'INJ003', name: '碘佛醇注射液(320mgI/ml 100ml)', price: 298 },
  { code: 'INJ004', name: '钆喷酸葡胺注射液(10ml)', price: 268 },
  { code: 'INJ005', name: '钆双胺注射液(10ml)', price: 312 },
  { code: 'INJ006', name: '钆特酸葡胺注射液(10ml)', price: 358 },
  { code: 'INJ007', name: '注射用六氟化硫微泡', price: 485 },
  { code: 'INJ008', name: '注射用全氟丙烷人血白蛋白微球', price: 650 },
  { code: 'MAT001', name: '一次性使用无菌注射器(5ml)', price: 1.5 },
  { code: 'MAT002', name: '一次性使用无菌注射器(10ml)', price: 2.0 },
  { code: 'MAT003', name: '一次性使用无菌注射器(20ml)', price: 2.5 },
  { code: 'MAT004', name: '一次性高压注射器针筒', price: 85 },
  { code: 'MAT005', name: 'DR胶片(14×17英寸)', price: 15 },
  { code: 'MAT006', name: '医用打印胶片', price: 8 },
  { code: 'MAT007', name: '医用防护口罩', price: 3.5 },
  { code: 'MAT008', name: '一次性手术衣', price: 12 },
  { code: 'MAT009', name: '无菌手套(7.5号)', price: 4.5 },
  { code: 'MAT010', name: '消毒纱布块', price: 0.8 },
  { code: 'SVC001', name: '急诊绿色通道费', price: 50 },
  { code: 'SVC002', name: '加急报告费', price: 30 },
  { code: 'SVC003', name: '会诊费(院内)', price: 100 },
  { code: 'SVC004', name: '远程会诊费', price: 300 },
  { code: 'SVC005', name: '影像光盘刻录', price: 20 },
  { code: 'SVC006', name: '影像邮寄费', price: 15 },
  { code: 'SVC007', name: '加床费', price: 80 },
];
const SITE_IDS = ['S001', 'S002', 'S003'];

const INVOICE_COUNT = 5000;
const invoices = [];
for (let i = 0; i < INVOICE_COUNT; i++) {
  const rng = Math.random;
  const invoiceId = `INV-${pad(i + 1, 6)}`;
  const patient = pick(PATIENTS, rng);
  const status = pickWeighted(['PAID','UNPAID','REFUNDED'], [0.80, 0.15, 0.05], rng);
  const itemCount = randInt(1, 6, rng);
  const items = [];
  for (let j = 0; j < itemCount; j++) {
    const chargeItem = pick(CHARGE_ITEMS, rng);
    const qty = randInt(1, 3, rng);
    items.push({
      itemCode: chargeItem.code,
      itemName: chargeItem.name,
      quantity: qty,
      unitPrice: chargeItem.price,
      totalPrice: qty * chargeItem.price,
    });
  }
  const totalAmount = Math.round(items.reduce((s, it) => s + it.totalPrice, 0) * 100) / 100;
  const insuranceRatio = 0.5 + rng() * 0.3;
  const insurancePaid = Math.round(totalAmount * insuranceRatio * 100) / 100;
  const selfPaid = Math.round((totalAmount - insurancePaid) * 100) / 100;
  const issuedAt = randomDate(START_DATE, END_DATE, rng);
  const record = {
    invoiceId,
    patientId: patient.id,
    patientName: patient.name,
    siteId: pick(SITE_IDS, rng),
    items,
    totalAmount,
    insurancePaid,
    selfPaid,
    status,
    issuedAt: formatDateTime(issuedAt),
    paidAt: status === 'PAID' ? formatDateTime(new Date(issuedAt.getTime() + randInt(1, 30, rng)*86400000)) : undefined,
  };
  invoices.push(record);
}
console.log(`[1e] 生成 ${invoices.length} 条财务记录`);

// ==================== 1f: 输出文件 ====================
const PUBLIC_DIR = path.join(ROOT, 'public/data');
const DATA_DIR = path.join(ROOT, 'src/data');
if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR, { recursive: true });

fs.writeFileSync(path.join(PUBLIC_DIR, 'unified-exams.json'), JSON.stringify(exams));
console.log('[1f] 输出 public/data/unified-exams.json');

fs.writeFileSync(path.join(PUBLIC_DIR, 'unified-reports.json'), JSON.stringify(reports));
console.log('[1f] 输出 public/data/unified-reports.json');

// 危急值 TS 文件
const cvTsContent = `// G005-RIS v3.0 统一危急值数据
// 生成时间: ${new Date().toISOString()}
// 记录数: ${criticalValues.length}
import type { CriticalValue } from '../pages/critical/types';
export const UNIFIED_CRITICAL_VALUES: CriticalValue[] = ${JSON.stringify(criticalValues, null, 2)};
`;
fs.writeFileSync(path.join(DATA_DIR, 'unifiedCriticalValues.ts'), cvTsContent);
console.log('[1f] 输出 src/data/unifiedCriticalValues.ts');

// 财务 TS 文件
const financeTsContent = `// G005-RIS v3.0 统一财务数据
// 生成时间: ${new Date().toISOString()}
// 记录数: ${invoices.length}
import type { InvoiceRecord } from './financeMock';
export const UNIFIED_INVOICES: InvoiceRecord[] = ${JSON.stringify(invoices, null, 2)};
`;
fs.writeFileSync(path.join(DATA_DIR, 'unifiedFinanceMock.ts'), financeTsContent);
console.log('[1f] 输出 src/data/unifiedFinanceMock.ts');

// ==================== 1g: 关联性验证 ====================
console.log('\n========== 关联性验证 ==========');
const patientMasterSet = new Set(PATIENT_IDS);
const examIdSet = new Set(examIds);
const reportExamMap = new Map();
reports.forEach(r => reportExamMap.set(r.examId, r));

let examPatientOk = 0;
for (const e of exams) { if (patientMasterSet.has(e.patientId)) examPatientOk++; }
console.log(`exam.patientId → patient master: ${examPatientOk}/${exams.length} 匹配 (${(examPatientOk/exams.length*100).toFixed(0)}%)`);

let reportExamOk = 0;
for (const r of reports) { if (examIdSet.has(r.examId)) reportExamOk++; }
console.log(`report.examId → exam: ${reportExamOk}/${reports.length} 匹配 (${(reportExamOk/reports.length*100).toFixed(0)}%)`);

let reportPatientOk = 0;
for (const r of reports) { if (patientMasterSet.has(r.patientId)) reportPatientOk++; }
console.log(`report.patientId → patient master: ${reportPatientOk}/${reports.length} 匹配 (${(reportPatientOk/reports.length*100).toFixed(0)}%)`);

let cvExamOk = 0;
for (const cv of criticalValues) { if (examIdSet.has(cv.examId)) cvExamOk++; }
console.log(`critical.examId → exam: ${cvExamOk}/${criticalValues.length} 匹配 (${(cvExamOk/criticalValues.length*100).toFixed(0)}%)`);

let invPatientOk = 0;
for (const inv of invoices) { if (patientMasterSet.has(inv.patientId)) invPatientOk++; }
console.log(`invoice.patientId → patient master: ${invPatientOk}/${invoices.length} 匹配 (${(invPatientOk/invoices.length*100).toFixed(0)}%)`);

console.log('\n✅ 统一数据生成完成！');
console.log(`   检查: ${exams.length} 条`);
console.log(`   报告: ${reports.length} 条`);
console.log(`   危急值: ${criticalValues.length} 条`);
console.log(`   财务: ${invoices.length} 条`);
