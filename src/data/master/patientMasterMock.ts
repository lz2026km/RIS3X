// [v3.0.6.8-27] 患者主数据池
// 三甲医院 1 个月新增 1000-3000 患者, 累计 50,000+ 活跃档案
// 这里生成 15000 名患者覆盖本月就诊

export type Gender = "男" | "女";
export type PatientType = "门诊" | "急诊" | "住院" | "体检" | "外院转入";
export type BloodType = "A" | "B" | "AB" | "O" | "A+" | "B+" | "AB+" | "O+" | "未知";

export interface PatientMaster {
  id: string; // P000001-P015000
  name: string;
  gender: Gender;
  age: number;
  birthDate: string; // ISO
  idCard: string; // 18 位
  phone: string;
  bloodType: BloodType;
  type: PatientType;
  // 来源
  referringDepartment: string; // 转介科室
  referringDoctor: string; // 转介医生
  // 临床
  chiefComplaint: string; // 主诉
  clinicalDiagnosis: string; // 临床诊断
  icd10: string; // ICD-10
  // 检查
  modality: "CT" | "MR" | "DR" | "US" | "MG" | "DSA" | "PET-CT";
  bodyPart: string; // 检查部位
  examItem: string; // 检查项目
  // 时间
  registeredAt: string; // 建档时间
  examDate: string; // 检查日期
  // 状态
  status: "已建档" | "已检查" | "报告生成" | "已审核" | "已签发" | "已发布";
  priority: "急诊" | "加急" | "普通" | "体检";
  // 元
  isVIP: boolean;
  deceased: boolean;
  tags: string[]; // ['老年人', '孕妇', '儿童', '过敏体质', '植入物']
}

const SURNAMES = "王李张刘陈杨黄赵周吴徐孙朱马胡郭林何高梁郑罗宋谢唐韩曹许邓萧冯曾程蔡彭潘袁于董余苏叶吕魏蒋田杜丁沈姜范江傅钟卢汪戴崔任陆廖姚方金邱夏谭韦贾邹石熊孟秦阎薛侯雷白龙段郝孔邵史毛常万顾赖严覃武钱施".split("");
const GIVEN_M = "建国建军强伟杰磊洋凯宇浩然子轩志远鹏程凌霄致远梓豪鸿涛明远天宇文博志远子墨鸿轩俊熙景行翊辰玉成泽宇明哲嘉伟天佑云飞晨曦锦程昊阳睿哲文昊鸿远德昌永盛世昌锦华万鹏瑞祥".split("");
const GIVEN_F = "红梅丽娟芳娜静敏秀英霞平燕莹洁慧萍红玲晓梅雅婷佳怡思涵若曦梓萱一鸣婧怡欣怡雪梅美玲慧珊若兰静雯雨彤心怡若汐".split("");

function rng(): number {
  return Math.random();
}

function weightedRandom(weights: Record<string, number>): string {
  const r = rng();
  let cumulative = 0;
  for (const [key, weight] of Object.entries(weights)) {
    cumulative += weight;
    if (r < cumulative) return key;
  }
  return Object.keys(weights).at(-1)!;
}

function pickName(gender: Gender, r: () => number): string {
  const s = SURNAMES[Math.floor(r() * SURNAMES.length)]!;
  const g = gender === "男" ? GIVEN_M[Math.floor(r() * GIVEN_M.length)]! : GIVEN_F[Math.floor(r() * GIVEN_F.length)]!;
  return s + g;
}

const REGION_CODES = ["110101", "310101", "440301", "510101", "330101", "420101", "610101", "320101", "440101", "120101", "500101"];

function genIdCard(birthYear: number): string {
  const region = REGION_CODES[Math.floor(rng() * REGION_CODES.length)]!;
  const yy = birthYear.toString().padStart(4, "0");
  const { month: mm, day: dd } = genValidDate(birthYear);
  const seq = String(Math.floor(rng() * 1000)).padStart(3, "0");
  return `${region}${yy}${String(mm).padStart(2, "0")}${String(dd).padStart(2, "0")}${seq}`;
}

function genPhone(): string {
  const prefix = ["138", "139", "136", "137", "135", "158", "159", "188", "187", "186", "152", "151", "130", "131", "132", "133", "189", "185", "156", "166", "176", "177", "178", "198", "199"][Math.floor(rng() * 25)]!;
  return prefix + String(Math.floor(rng() * 100000000)).padStart(8, "0");
}

function genValidDate(year: number): { month: number; day: number } {
  const month = Math.floor(rng() * 12) + 1;
  const maxDays = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]!;
  if (month === 2 && year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) {
    return { month, day: Math.floor(rng() * 29) + 1 };
  }
  return { month, day: Math.floor(rng() * maxDays) + 1 };
}

const REFERRING_DEPTS = [
  "心血管内科", "呼吸内科", "消化内科", "神经内科", "内分泌科", "肾内科", "风湿免疫科",
  "普通外科", "心胸外科", "神经外科", "骨科", "泌尿外科", "肝胆外科", "甲乳外科",
  "妇产科", "儿科", "急诊科", "重症医学科", "肿瘤科", "血液科", "感染科",
  "皮肤科", "眼科", "耳鼻喉科", "口腔科", "中医科", "康复科", "麻醉科",
];

const COMPLAINTS = [
  "胸痛 3 天", "持续性头痛伴恶心呕吐", "咳嗽咳痰 1 周", "右上腹疼痛", "腰痛伴下肢麻木",
  "间歇性跛行", "突发意识障碍", "呕血 2 小时", "黑便 1 周", "黄疸 5 天",
  "发热 3 天伴呼吸困难", "活动后心悸气促", "血尿 1 周", "尿频尿急尿痛", "关节肿痛",
  "皮疹瘙痒 3 天", "腹胀纳差 2 周", "消瘦 3 月", "体检发现肺结节", "体检发现肝占位",
  "车祸外伤", "高处坠落伤", "工伤", "随访", "定期复查", "健康体检", "备孕检查",

  "体检发现肺部小结节",
  "外伤后左膝疼痛1天",
  "车祸后头痛头晕2小时",
  "跌倒后右髋部疼痛活动受限",
  "腰背部疼痛伴活动受限1周",
  "颈部不适伴头晕3月",
  "肩关节疼痛抬举困难",
  "踝关节扭伤肿痛",
  "腕部外伤后疼痛",
  "体检发现肝占位",
  "体检发现肾囊肿",
  "胸闷气促1周加重1天",
  "心悸伴头晕黑矇",
  "胸骨后压榨性疼痛2小时",
  "活动后气促伴乏力",
  "夜间阵发性呼吸困难",
  "双下肢水肿进行性加重",
  "心前区不适反复发作",
  "血压升高伴头痛恶心",
  "静息时胸痛",
  "心悸伴晕厥1次",
  "头痛头晕3天伴恶心",
  "突发口角歪斜1小时",
  "言语不清伴肢体无力2小时",
  "肢体麻木无力进行性加重",
  "眩晕伴恶心呕吐视物旋转",
  "记忆力减退半年加重1月",
  "面部麻木伴口角流涎",
  "行走不稳踩棉花感",
  "四肢抽搐伴意识丧失",
  "偏头痛反复发作10年",
  "腰痛伴下肢放射痛1月",
  "膝关节肿痛活动受限",
  "颈肩部酸痛伴上肢麻木",
  "手腕部疼痛伴活动受限",
  "踝关节扭伤肿痛1天",
  "足跟部疼痛行走困难",
  "髋关节疼痛跛行",
  "骨折术后复查",
  "腰背痛伴晨僵",
  "全身多关节游走性疼痛",
  "急性腹痛剧烈",
  "车祸多发伤",
  "高处坠落伤意识模糊",
  "意识障碍进行性加深",
  "呼吸困难伴喘憋",
  "胸痛伴大汗淋漓",
  "呕血黑便1天",
  "药物中毒",
  "一氧化碳中毒",
  "电击伤",
  "烫伤面积约20%",
  "剧烈头痛伴呕吐",
  "抽搐持续状态",
  "上腹部疼痛反复发作2年",
  "反酸烧心伴胸骨后不适",
  "恶心呕吐3天加重",
  "腹胀不适伴纳差",
  "大便性状改变伴便血",
  "吞咽困难进行性加重",
  "肝功能异常1月",
  "皮肤巩膜黄染1周",
  "腹部包块",
  "腹泻便秘交替",
  "咳嗽咳痰伴发热3天",
  "喘息气促反复发作",
  "咳血痰1周",
  "胸痛伴发热咳嗽",
  "反复呼吸道感染",
  "呼吸困难伴紫绀",
  "长期咳嗽夜间加重",
  "过敏后咳嗽",
  "胸闷气喘活动后加重",
  "尿泡沫增多1月",
  "双下肢浮肿",
  "夜尿增多半年",
  "发现肌酐升高1周",
  "尿色加深",
  "少尿2天",
  "发现血糖升高1月",
  "多饮多尿体重下降",
  "颈部增粗伴心悸",
  "手足增大1年",
  "皮肤色素沉着",
  "反复发热1月",
  "皮肤瘀斑牙龈出血",
  "淋巴结肿大无痛",
  "乏力面色苍白半年",
  "发现肺结节1月",
  "乳腺肿块",
  "便血伴体重下降",
  "腹痛发现腹部包块",
  "月经不规则半年",
  "白带异常伴异味",
  "停经后腹痛",
  "盆腔疼痛",
  "视力下降渐进性",
  "眼痛伴头痛",
  "眼前黑影飘动",
  "耳闷耳鸣听力下降",
  "鼻塞流涕头痛",
  "咽痛发热",
  "声音嘶哑",
];

const DIAGNOSES = [
  "冠心病", "高血压性心脏病", "急性心肌梗死", "心绞痛", "心力衰竭",
  "肺炎", "肺结节", "肺占位", "肺癌", "肺栓塞", "气胸", "胸腔积液",
  "脑梗死", "脑出血", "脑肿瘤", "脑外伤", "脑动脉瘤",
  "肝炎", "肝硬化", "肝癌", "胆囊炎", "胆结石", "胰腺炎", "胰腺肿瘤",
  "胃炎", "胃溃疡", "胃癌", "肠梗阻", "阑尾炎", "结直肠癌",
  "骨折", "椎间盘突出", "骨肿瘤", "关节炎", "韧带损伤",
  "尿路结石", "前列腺增生", "膀胱癌", "肾癌", "肾囊肿",
  "乳腺增生", "乳腺结节", "乳腺癌",
  "妊娠状态", "子宫肌瘤", "卵巢囊肿", "宫颈癌", "异位妊娠",
  "外伤", "肿瘤待查", "发热待查", "胸痛待查", "腹痛待查", "黄疸待查", "咯血待查",

  "慢性阻塞性肺疾病",
  "支气管哮喘",
  "肺源性心脏病",
  "肺炎链球菌肺炎",
  "肺真菌病",
  "间质性肺病",
  "病毒性心肌炎",
  "扩张型心肌病",
  "肥厚型心肌病",
  "心律失常-房颤",
  "心律失常-室早",
  "感染性心内膜炎",
  "短暂性脑缺血发作",
  "帕金森病",
  "阿尔茨海默病",
  "癫痫",
  "偏头痛",
  "三叉神经痛",
  "重症肌无力",
  "腰椎管狭窄",
  "颈椎病",
  "肩周炎",
  "半月板损伤",
  "骨质疏松",
  "痛风性关节炎",
  "腘窝囊肿",
  "急性胰腺炎",
  "慢性胃炎",
  "消化性溃疡",
  "溃疡性结肠炎",
  "克罗恩病",
  "肠易激综合征",
  "肾盂肾炎",
  "慢性肾功能不全",
  "前列腺炎",
  "膀胱炎",
  "肾积水",
  "肾脏肿瘤",
  "缺铁性贫血",
  "巨幼细胞性贫血",
  "急性白血病",
  "淋巴瘤",
  "多发性骨髓瘤",
  "骨髓增生异常综合征",
  "甲状腺功能亢进",
  "糖尿病肾病",
  "糖尿病足",
  "甲状腺功能减退",
  "Cushing综合征",
  "醛固酮增多症",
  "类风湿关节炎",
  "强直性脊柱炎",
  "骨关节炎",
  "痛风",
  "皮肌炎",
  "硬皮病",
  "白内障",
  "青光眼",
  "年龄相关性黄斑变性",
  "糖尿病视网膜病变",
  "慢性鼻窦炎",
  "扁桃体周围脓肿",
  "声带息肉",
  "梅尼埃病",
  "食管癌",
  "胃癌",
  "肝癌",
  "胰腺癌",
  "结直肠癌",
  "肺癌",
  "乳腺癌",
  "前列腺癌",
  "膀胱癌",
  "甲状腺癌",
  "肾癌",
];

const ICD10 = [
  "I20.901", "I21.401", "I50.001", "I10.05", "J18.901", "J98.402", "C34.901", "I26.901",
  "I63.901", "I61.901", "C71.901", "S06.901", "I67.101",
  "K76.001", "K74.001", "C22.901", "K81.001", "K80.501", "K85.901", "C25.901",
  "K29.701", "K25.901", "C16.901", "K56.701", "K35.801", "C18.901",
  "S72.001", "M51.202", "C41.901", "M19.901", "S83.501",
  "N20.001", "N40.001", "C67.901", "C64.001", "N28.001",
  "N60.201", "N63.001", "C50.901",
  "Z34.901", "D25.901", "N83.201", "C53.901", "O00.901",
  "T14.001", "R69.001", "R50.901", "R07.401", "R10.401", "R17.001", "R04.201", "Z00.001",

  "J44.901",
  "J45.901",
  "I27.901",
  "J13.001",
  "J15.901",
  "J84.101",
  "J43.901",
  "I40.901",
  "I42.901",
  "I42.201",
  "I49.901",
  "I49.301",
  "I33.001",
  "I48.901",
  "I11.901",
  "G45.901",
  "G20.001",
  "G30.901",
  "G40.901",
  "G43.901",
  "G50.001",
  "G70.001",
  "M48.001",
  "M47.201",
  "M75.001",
  "S83.201",
  "M81.901",
  "M10.001",
  "M71.201",
  "K85.901",
  "K29.501",
  "K25.901",
  "K51.901",
  "K50.901",
  "K58.901",
  "N10.001",
  "N18.901",
  "N41.001",
  "N30.001",
  "N13.001",
  "C64.001",
  "D50.901",
  "D51.901",
  "C91.001",
  "C82.901",
  "C90.001",
  "D46.901",
  "E05.901",
  "E11.201",
  "E11.501",
  "E12.901",
  "E03.901",
  "E24.901",
  "E26.001",
  "M06.901",
  "M46.001",
  "M17.901",
  "M10.901",
  "M33.101",
  "M34.901",
  "H25.901",
  "H40.901",
  "H35.301",
  "E11.301",
  "J32.901",
  "J36.001",
  "J38.101",
  "H81.001",
  "C15.901",
  "C16.901",
  "C22.001",
  "C25.901",
  "C18.901",
  "C34.901",
  "C50.901",
  "C61.001",
  "C67.901",
  "C73.001",
  "C64.001",
];

const MODALITIES: PatientMaster["modality"][] = ["CT", "MR", "DR", "US", "MG", "DSA", "PET-CT"];
const BODY_PARTS: Record<PatientMaster["modality"], string[]> = {
  "CT": ["胸部", "腹部", "头部", "盆腔", "冠脉", "颈椎", "腰椎", "全腹", "泌尿系", "冠脉+头颈", "肺动脉"],
  "MR": ["头部", "脊柱", "膝关节", "肝脏", "盆腔", "乳腺", "脑垂体", "颈椎", "腰椎", "肩关节", "心脏"],
  "DR": ["胸部正侧位", "腹部立位", "骨盆正位", "颈椎正侧位", "腰椎正侧位", "膝关节正侧位", "腕关节正侧位", "髋关节正位", "胸椎正侧位"],
  "US": ["腹部", "心脏", "甲状腺", "颈动脉", "下肢血管", "妇科", "产科", "泌尿系", "乳腺", "浅表"],
  "MG": ["双侧乳腺轴位+侧斜位", "单侧乳腺", "假体植入评估"],
  "DSA": ["冠脉造影", "脑血管造影", "肾动脉造影", "下肢动脉造影", "介入栓塞"],
  "PET-CT": ["全身", "胸部", "腹部", "脑部", "心脏"],
};

const EXAM_ITEM: Record<PatientMaster["modality"], string[]> = {
  "CT": ["胸部CT平扫", "胸部CT增强", "腹部CT平扫", "腹部CT增强", "头部CT平扫", "头部CT增强", "冠脉CTA", "冠脉钙化积分", "CT肺动脉造影", "CT尿路造影", "全腹CT增强", "低剂量胸部CT", "冠脉+头颈CTA"],
  "MR": ["头部MR平扫", "头部MR增强", "颈椎MR", "腰椎MR", "膝关节MR", "肝脏MR增强", "盆腔MR", "乳腺MR", "脑垂体MR", "心脏MR"],
  "DR": ["胸部正侧位", "腹部立位平片", "骨盆正位", "颈椎正侧位", "腰椎正侧位", "膝关节正侧位", "腕关节正侧位"],
  "US": ["腹部超声", "心脏彩超", "甲状腺彩超", "颈动脉超声", "下肢血管超声", "妇科超声", "产科超声", "泌尿系超声", "乳腺超声"],
  "MG": ["双侧乳腺钼靶", "单侧乳腺钼靶"],
  "DSA": ["冠脉造影", "脑血管造影", "下肢动脉造影", "肾动脉造影", "肝动脉化疗栓塞"],
  "PET-CT": ["PET-CT全身显像", "PET-CT胸部显像", "PET-CT脑显像", "PET-CT心脏显像", "PET-CT局部显像"],
};

const TAGS = [
  ["老年人", "高血压", "糖尿病", "冠心病史"],
  ["孕妇", "产后42天", "哺乳期"],
  ["儿童", "婴幼儿", "学龄前"],
  ["过敏体质", "青霉素过敏", "造影剂过敏"],
  ["金属植入物", "心脏起搏器", "假体", "冠脉支架"],
  ["术后随访", "化疗后", "放疗后"],
  ["VIP", "外宾", "外院转入"],
  [],
];

function makePatient(idx: number): PatientMaster {
  const id = `P${(idx + 1).toString().padStart(6, "0")}`;
  const gender: Gender = rng() < 0.52 ? "男" : "女";
  // 年龄分布: 0-18 (10%) 18-40 (30%) 40-60 (35%) 60-90 (25%)
  const ageRoll = rng();
  let age: number;
  if (ageRoll < 0.10) age = Math.floor(rng() * 18);
  else if (ageRoll < 0.40) age = 18 + Math.floor(rng() * 22);
  else if (ageRoll < 0.75) age = 40 + Math.floor(rng() * 20);
  else age = 60 + Math.floor(rng() * 30);
  const name = pickName(gender, rng);
  const birthYear = 2026 - age;
  const bloodType: BloodType = ["A", "B", "AB", "O", "A+", "B+", "AB+", "O+"][Math.floor(rng() * 8)]! as BloodType;
  // 患者类型分布
  const typeRoll = rng();
  let type: PatientType;
  if (typeRoll < 0.45) type = "门诊";
  else if (typeRoll < 0.65) type = "住院";
  else if (typeRoll < 0.80) type = "急诊";
  else if (typeRoll < 0.95) type = "体检";
  else type = "外院转入";
  const priority: PatientMaster["priority"] = type === "急诊" ? (rng() < 0.3 ? "急诊" : "加急") : type === "住院" ? (rng() < 0.1 ? "加急" : "普通") : type === "体检" ? "体检" : (rng() < 0.05 ? "加急" : "普通");
  // 检查模态
  const modality = weightedRandom({ CT: 0.35, DR: 0.30, MR: 0.15, US: 0.15, MG: 0.03, DSA: 0.015, "PET-CT": 0.005 }) as PatientMaster["modality"];
  const bodyParts = BODY_PARTS[modality];
  const bodyPart = bodyParts[Math.floor(rng() * bodyParts.length)]!;
  const examItems = EXAM_ITEM[modality];
  const examItem = examItems[Math.floor(rng() * examItems.length)]!;
  // 时间 (本月)
  const day = Math.floor(rng() * 23) + 1; // 6月1-23
  const hour = Math.floor(rng() * 24);
  const minute = Math.floor(rng() * 60);
  const registeredAt = `2026-06-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;
  // 检查日期 (通常注册后 0-3 天)
  const examDay = Math.min(23, day + Math.floor(rng() * 4));
  const examDate = `2026-06-${String(examDay).padStart(2, "0")}T${String(Math.floor(rng() * 24)).padStart(2, "0")}:00:00`;
  const status: PatientMaster["status"] = examDay < 22 ? "已签发" : examDay < 23 ? "已审核" : examDay === 23 ? (rng() < 0.5 ? "已检查" : "报告生成") : "已建档";
  const referringDepartment = REFERRING_DEPTS[Math.floor(rng() * REFERRING_DEPTS.length)]!;
  const referringDoctor = `医师-${Math.floor(rng() * 60) + 1}`;
  const chiefComplaint = COMPLAINTS[Math.floor(rng() * COMPLAINTS.length)]!;
  const clinicalDiagnosis = DIAGNOSES[Math.floor(rng() * DIAGNOSES.length)]!;
  const icd10 = ICD10[Math.floor(rng() * ICD10.length)]!;
  const tagRoll = rng();
  let tagIdx = 7;
  if (tagRoll < 0.10) tagIdx = 0; // 老年+慢病
  else if (tagRoll < 0.20) tagIdx = 1; // 孕产
  else if (tagRoll < 0.28) tagIdx = 2; // 儿童
  else if (tagRoll < 0.36) tagIdx = 3; // 过敏
  else if (tagRoll < 0.50) tagIdx = 4; // 植入物
  else if (tagRoll < 0.60) tagIdx = 5; // 术后
  else if (tagRoll < 0.65) tagIdx = 6; // VIP
  const isVIP = tagIdx === 6 || rng() < 0.02;
  const deceased = rng() < 0.01;

  return {
    id,
    name,
    gender,
    age,
    birthDate: (() => { const d = genValidDate(birthYear); return `${birthYear}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`; })(),
    idCard: genIdCard(birthYear),
    phone: genPhone(),
    bloodType,
    type,
    referringDepartment,
    referringDoctor,
    chiefComplaint,
    clinicalDiagnosis,
    icd10,
    modality,
    bodyPart,
    examItem,
    registeredAt,
    examDate,
    status,
    priority,
    isVIP,
    deceased,
    tags: TAGS[tagIdx]!,
  };
}

// 基础 15,000 名患者（保持向后兼容）
const _BASE_PATIENTS: PatientMaster[] = Array.from({ length: 15000 }, (_, i) => makePatient(i));
// 补充 34,700 名患者 —— 由 scripts/seed/02-generate-patients.mjs 生成
const _EXTRA_PATIENTS: PatientMaster[] = Array.from({ length: 34700 }, (_, i) => makePatient(15000 + i));
export const PATIENT_MASTER: PatientMaster[] = [..._BASE_PATIENTS, ..._EXTRA_PATIENTS];

// 工具
export const PATIENT_BY_ID: Record<string, PatientMaster> = Object.fromEntries(PATIENT_MASTER.map((p) => [p.id, p]));

// 按状态分组
export const PATIENTS_BY_STATUS: Record<PatientMaster["status"], PatientMaster[]> = {
  已建档: PATIENT_MASTER.filter((p) => p.status === "已建档"),
  已检查: PATIENT_MASTER.filter((p) => p.status === "已检查"),
  报告生成: PATIENT_MASTER.filter((p) => p.status === "报告生成"),
  已审核: PATIENT_MASTER.filter((p) => p.status === "已审核"),
  已签发: PATIENT_MASTER.filter((p) => p.status === "已签发"),
  已发布: PATIENT_MASTER.filter((p) => p.status === "已发布"),
};

// 按模态分组
export const PATIENTS_BY_MODALITY: Record<PatientMaster["modality"], PatientMaster[]> = {
  CT: PATIENT_MASTER.filter((p) => p.modality === "CT"),
  MR: PATIENT_MASTER.filter((p) => p.modality === "MR"),
  DR: PATIENT_MASTER.filter((p) => p.modality === "DR"),
  US: PATIENT_MASTER.filter((p) => p.modality === "US"),
  MG: PATIENT_MASTER.filter((p) => p.modality === "MG"),
  DSA: PATIENT_MASTER.filter((p) => p.modality === "DSA"),
  "PET-CT": PATIENT_MASTER.filter((p) => p.modality === "PET-CT"),
};

// 按优先级分组
export const PATIENTS_BY_PRIORITY: Record<PatientMaster["priority"], PatientMaster[]> = {
  急诊: PATIENT_MASTER.filter((p) => p.priority === "急诊"),
  加急: PATIENT_MASTER.filter((p) => p.priority === "加急"),
  普通: PATIENT_MASTER.filter((p) => p.priority === "普通"),
  体检: PATIENT_MASTER.filter((p) => p.priority === "体检"),
};

// 工具: 按 id 范围取
export function pickPatients(start: number, end: number): PatientMaster[] {
  return PATIENT_MASTER.slice(start, end);
}

// 工具: 按模态随机取
export function pickByModality(modality: PatientMaster["modality"], n: number): PatientMaster[] {
  const pool = PATIENTS_BY_MODALITY[modality];
  if (pool.length <= n) return pool;
  return pool.sort(() => Math.random() - 0.5).slice(0, n);
}

// 统计
export const PATIENT_STATS = {
  total: PATIENT_MASTER.length,
  byModality: Object.fromEntries(MODALITIES.map((m) => [m, PATIENTS_BY_MODALITY[m].length])),
  byStatus: Object.fromEntries(Object.entries(PATIENTS_BY_STATUS).map(([k, v]) => [k, v.length])),
  byPriority: Object.fromEntries(Object.entries(PATIENTS_BY_PRIORITY).map(([k, v]) => [k, v.length])),
  vipCount: PATIENT_MASTER.filter((p) => p.isVIP).length,
  avgAge: (PATIENT_MASTER.reduce((s, p) => s + p.age, 0) / PATIENT_MASTER.length).toFixed(1),
  genderRatio: {
    男: PATIENT_MASTER.filter((p) => p.gender === "男").length,
    女: PATIENT_MASTER.filter((p) => p.gender === "女").length,
  },
};
