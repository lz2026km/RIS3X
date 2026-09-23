// [v3.0.6.8-27] 放射科医生主数据池
// TODO: 后续需补充 口腔科 和 眼科 医生数据
// 三甲医院放射科: 主任 4 / 副主任 8 / 主治 15 / 住院 13 / 技师 25 / 护士 10 = 75 人
// 跨质控所有页面共用

export type DoctorTitle =
  | "主任医师"
  | "副主任医师"
  | "主治医师"
  | "住院医师"
  | "技师"
  | "护士"
  | "护师";

export type Subspecialty =
  | "神经放射"
  | "胸部放射"
  | "腹部放射"
  | "骨肌放射"
  | "心血管放射"
  | "乳腺放射"
  | "介入放射"
  | "核医学"
  | "超声诊断"
  | "儿放"
  | "急诊放射"
  | "口腔颌面放射"
  | "CT"
  | "MR"
  | "普放";

export interface DoctorMaster {
  id: string;
  name: string;
  title: DoctorTitle;
  subspecialty: Subspecialty;
  department: "放射科" | "CT室" | "MR室" | "介入科" | "核医学科" | "超声科";
  yearsOfExperience: number;
  certifications: string[]; // CA 证书编号
  schedule: "周一三五上午" | "周二四上午" | "周一三五下午" | "全天" | "弹性" | "夜班";
  // 工作量 (月度)
  monthlyExamCount: number;
  monthlyReportCount: number;
  monthlyCriticalValueCount: number;
  monthlyCosignCount: number;
  // 质控 (年度)
  annualQCScore: number; // 0-100
  defectRate: number; // 缺陷率
  timelyRate: number; // 及时率
  // 元数据
  joinedAt: string; // ISO date
  avatar: string; // 头像 emoji 或 URL
  signature: string; // 电子签名 base64
  active: boolean;
}

// 真实姓名库 (常见姓氏 + 名字)
const SURNAMES = "王李张刘陈杨黄赵周吴徐孙朱马胡郭林何高梁郑罗宋谢唐韩曹许邓萧冯曾程蔡彭潘袁于董余苏叶吕魏蒋田杜丁沈姜范江傅钟卢汪戴崔任陆廖姚方金邱夏谭韦贾邹石熊孟秦阎薛侯雷白龙段郝孔邵史毛常万顾赖严覃武钱施".split("");
const GIVEN_NAMES = "建国建军红梅小明华强伟杰磊洋艳丽娟芳娜静敏秀英霞平刚毅俊凯宇浩然子轩思源志远鹏程凌霄致远梓萱若曦思涵一鸣鸿涛明远天宇文博志远子墨鸿轩俊熙景行翊辰梓豪玉成泽宇明哲嘉伟天佑云飞晨曦锦程昊阳睿哲思齐文昊鸿远德昌永盛世昌锦华万鹏瑞祥".split("");

function pickName(rng: () => number): string {
  const s = SURNAMES[Math.floor(rng() * SURNAMES.length)]!;
  const g = GIVEN_NAMES[Math.floor(rng() * GIVEN_NAMES.length)]!;
  return s + g;
}

// 简单 LCG 随机数 (保证可重复)
let _seed = 0x12345;
function seededRandom(): number {
  _seed = (_seed * 1103515245 + 12345) & 0x7fffffff;
  return _seed / 0x7fffffff;
}

// 复位的随机数, 每次重新生成时用
function resetSeed() {
  _seed = 0x12345;
}

// 排班生成
function pickSchedule(title: DoctorTitle): DoctorMaster["schedule"] {
  if (title === "主任医师") return "周二四上午";
  if (title === "副主任医师") return "周一三五上午";
  if (title === "主治医师") return "周一三五下午";
  if (title === "住院医师") return "弹性";
  if (title === "技师") return "全天";
  if (title === "护师") return "全天";
  return "弹性";
}

function makeDoctor(
  idx: number,
  title: DoctorTitle,
  subspecialty: Subspecialty,
  yearsRange: [number, number]
): DoctorMaster {
  resetSeed();
  const id = `D${(idx + 1).toString().padStart(3, "0")}`;
  const name = pickName(seededRandom);
  const years = yearsRange[0] + Math.floor(seededRandom() * (yearsRange[1] - yearsRange[0]));
  // CA 证书编号
  const cert = `CFCA-${(100000 + idx * 137).toString(36).toUpperCase()}-${(2020 + Math.floor(seededRandom() * 6))}`;
  // 工作量 (按职称)
  let monthlyExam = 0, monthlyReport = 0, monthlyCV = 0, monthlyCS = 0;
  if (title === "主任医师") {
    monthlyExam = 280 + Math.floor(seededRandom() * 80);
    monthlyReport = 260 + Math.floor(seededRandom() * 80);
    monthlyCV = 18 + Math.floor(seededRandom() * 8);
    monthlyCS = 32 + Math.floor(seededRandom() * 16);
  } else if (title === "副主任医师") {
    monthlyExam = 380 + Math.floor(seededRandom() * 100);
    monthlyReport = 360 + Math.floor(seededRandom() * 100);
    monthlyCV = 24 + Math.floor(seededRandom() * 10);
    monthlyCS = 56 + Math.floor(seededRandom() * 24);
  } else if (title === "主治医师") {
    monthlyExam = 520 + Math.floor(seededRandom() * 120);
    monthlyReport = 500 + Math.floor(seededRandom() * 120);
    monthlyCV = 32 + Math.floor(seededRandom() * 12);
    monthlyCS = 88 + Math.floor(seededRandom() * 30);
  } else if (title === "住院医师") {
    monthlyExam = 380 + Math.floor(seededRandom() * 100);
    monthlyReport = 360 + Math.floor(seededRandom() * 100);
    monthlyCV = 18 + Math.floor(seededRandom() * 10);
    monthlyCS = 60 + Math.floor(seededRandom() * 20);
  } else if (title === "技师") {
    monthlyExam = 720 + Math.floor(seededRandom() * 180);
    monthlyReport = 0;
    monthlyCV = 0;
    monthlyCS = 0;
  } else {
    monthlyExam = 200 + Math.floor(seededRandom() * 80);
    monthlyReport = 0;
    monthlyCV = 0;
    monthlyCS = 0;
  }
  // 质控分 (0-100)
  const qcBase = title === "主任医师" ? 92 : title === "副主任医师" ? 90 : title === "主治医师" ? 87 : title === "住院医师" ? 82 : title === "技师" ? 85 : 84;
  const annualQCScore = qcBase + Math.floor(seededRandom() * 8);
  const defectRate = (0.3 + seededRandom() * 2.5).toFixed(1) + "%";
  const timelyRate = (88 + seededRandom() * 12).toFixed(1) + "%";

  return {
    id,
    name,
    title,
    subspecialty,
    department: title === "技师" ? "CT室" : title === "护师" || title === "护士" ? "放射科" : "放射科",
    yearsOfExperience: years,
    certifications: years >= 3 ? [cert] : years >= 1 ? [cert, "内部-GCP-2024"] : ["实习-2024"],
    schedule: pickSchedule(title),
    monthlyExamCount: monthlyExam,
    monthlyReportCount: monthlyReport,
    monthlyCriticalValueCount: monthlyCV,
    monthlyCosignCount: monthlyCS,
    annualQCScore,
    defectRate: defectRate as unknown as number, // type hack
    timelyRate: timelyRate as unknown as number,
    joinedAt: `${2026 - years}-${String(Math.floor(seededRandom() * 12) + 1).padStart(2, "0")}-${String(Math.floor(seededRandom() * 28) + 1).padStart(2, "0")}`,
    avatar: ["👨‍⚕️", "👩‍⚕️", "🧑‍⚕️", "👨‍🔬", "👩‍🔬"][Math.floor(seededRandom() * 5)]!,
    signature: `sign_${id}_${Math.floor(seededRandom() * 1e6).toString(36)}`,
    active: seededRandom() > 0.05,
  };
}

// 亚专业分布
const SUB_BY_TITLE: Record<DoctorTitle, Subspecialty[]> = {
  "主任医师": ["神经放射", "胸部放射", "腹部放射", "骨肌放射", "心血管放射", "乳腺放射", "介入放射", "核医学", "超声诊断", "儿放", "急诊放射", "口腔颌面放射"],
  "副主任医师": ["神经放射", "胸部放射", "腹部放射", "骨肌放射", "心血管放射", "乳腺放射", "介入放射", "核医学", "超声诊断", "儿放", "急诊放射", "CT", "MR"],
  "主治医师": ["神经放射", "胸部放射", "腹部放射", "骨肌放射", "心血管放射", "乳腺放射", "介入放射", "核医学", "超声诊断", "儿放", "急诊放射", "CT", "MR", "普放"],
  "住院医师": ["CT", "MR", "普放", "超声诊断", "急诊放射"],
  "技师": ["CT", "MR", "普放", "乳腺放射"],
  "护士": ["CT", "MR", "介入放射"],
  "护师": ["CT", "MR", "介入放射"],
};

function nextSub(title: DoctorTitle, idx: number): Subspecialty {
  const list = SUB_BY_TITLE[title];
  return list[idx % list.length]!;
}

// 4 主任 / 8 副主任 / 15 主治 / 13 住院 / 25 技师 / 10 护士 = 75
export const DOCTOR_MASTER: DoctorMaster[] = [];

// 主任 4
for (let i = 0; i < 4; i++) {
  DOCTOR_MASTER.push(makeDoctor(i, "主任医师", nextSub("主任医师", i), [22, 35]));
}
// 副主任 8
for (let i = 0; i < 8; i++) {
  DOCTOR_MASTER.push(makeDoctor(4 + i, "副主任医师", nextSub("副主任医师", i), [12, 22]));
}
// 主治 15
for (let i = 0; i < 15; i++) {
  DOCTOR_MASTER.push(makeDoctor(12 + i, "主治医师", nextSub("主治医师", i), [5, 12]));
}
// 住院 13
for (let i = 0; i < 13; i++) {
  DOCTOR_MASTER.push(makeDoctor(27 + i, "住院医师", nextSub("住院医师", i), [1, 5]));
}
// 技师 25
for (let i = 0; i < 25; i++) {
  DOCTOR_MASTER.push(makeDoctor(40 + i, "技师", nextSub("技师", i), [1, 20]));
}
// 护士 10
for (let i = 0; i < 10; i++) {
  DOCTOR_MASTER.push(makeDoctor(65 + i, "护士", nextSub("护士", i), [1, 25]));
}

// 工具: 按 ID 查
export const DOCTOR_BY_ID: Record<string, DoctorMaster> = Object.fromEntries(
  DOCTOR_MASTER.map((d) => [d.id, d])
);

// 工具: 按职称分组
export const DOCTORS_BY_TITLE: Record<DoctorTitle, DoctorMaster[]> = {
  主任医师: DOCTOR_MASTER.filter((d) => d.title === "主任医师"),
  副主任医师: DOCTOR_MASTER.filter((d) => d.title === "副主任医师"),
  主治医师: DOCTOR_MASTER.filter((d) => d.title === "主治医师"),
  住院医师: DOCTOR_MASTER.filter((d) => d.title === "住院医师"),
  技师: DOCTOR_MASTER.filter((d) => d.title === "技师"),
  护士: DOCTOR_MASTER.filter((d) => d.title === "护士"),
  护师: DOCTOR_MASTER.filter((d) => d.title === "护师"),
};

// 工具: 随机取 N 个医生
export function pickDoctors(title: DoctorTitle | "all", n: number): DoctorMaster[] {
  const pool = title === "all" ? DOCTOR_MASTER : DOCTORS_BY_TITLE[title] || [];
  if (pool.length <= n) return pool;
  const shuffled = [...pool].sort(() => seededRandom() - 0.5);
  return shuffled.slice(0, n);
}

// 导出统计
export const DOCTOR_STATS = {
  total: DOCTOR_MASTER.length,
  byTitle: {
    主任医师: 4,
    副主任医师: 8,
    主治医师: 15,
    住院医师: 13,
    技师: 25,
    护士: 10,
  },
  activeCount: DOCTOR_MASTER.filter((d) => d.active).length,
  avgExperience: (DOCTOR_MASTER.reduce((s, d) => s + d.yearsOfExperience, 0) / DOCTOR_MASTER.length).toFixed(1),
};
