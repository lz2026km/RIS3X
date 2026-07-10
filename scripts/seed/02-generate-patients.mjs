// @ts-check
// 补充患者数据生成脚本 — 追加 34,700 名患者到 patientMasterMock.ts

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcFile = path.resolve(
  __dirname,
  "../../src/data/master/patientMasterMock.ts"
);
const startTime = Date.now();

let content = fs.readFileSync(srcFile, "utf-8");

// ---------- 防重复 ----------
if (content.includes("_EXTRA_PATIENTS")) {
  console.log("⚠️  Patients already appended. Skipping.");
  process.exit(0);
}

// ---------- 扩展数据池 ----------

const COMPLAINTS_EXTRA = [
  // 放射科
  "体检发现肺部小结节", "外伤后左膝疼痛1天", "车祸后头痛头晕2小时",
  "跌倒后右髋部疼痛活动受限", "腰背部疼痛伴活动受限1周", "颈部不适伴头晕3月",
  "肩关节疼痛抬举困难", "踝关节扭伤肿痛", "腕部外伤后疼痛",
  "体检发现肝占位", "体检发现肾囊肿",
  // 心内科
  "胸闷气促1周加重1天", "心悸伴头晕黑矇", "胸骨后压榨性疼痛2小时",
  "活动后气促伴乏力", "夜间阵发性呼吸困难", "双下肢水肿进行性加重",
  "心前区不适反复发作", "血压升高伴头痛恶心", "静息时胸痛",
  "心悸伴晕厥1次",
  // 神经内科
  "头痛头晕3天伴恶心", "突发口角歪斜1小时", "言语不清伴肢体无力2小时",
  "肢体麻木无力进行性加重", "眩晕伴恶心呕吐视物旋转", "记忆力减退半年加重1月",
  "面部麻木伴口角流涎", "行走不稳踩棉花感", "四肢抽搐伴意识丧失",
  "偏头痛反复发作10年",
  // 骨科
  "腰痛伴下肢放射痛1月", "膝关节肿痛活动受限", "颈肩部酸痛伴上肢麻木",
  "手腕部疼痛伴活动受限", "踝关节扭伤肿痛1天", "足跟部疼痛行走困难",
  "髋关节疼痛跛行", "骨折术后复查", "腰背痛伴晨僵",
  "全身多关节游走性疼痛",
  // 急诊科
  "急性腹痛剧烈", "车祸多发伤", "高处坠落伤意识模糊", "意识障碍进行性加深",
  "呼吸困难伴喘憋", "胸痛伴大汗淋漓", "呕血黑便1天",
  "药物中毒", "一氧化碳中毒", "电击伤", "烫伤面积约20%",
  "剧烈头痛伴呕吐", "抽搐持续状态",
  // 消化科
  "上腹部疼痛反复发作2年", "反酸烧心伴胸骨后不适", "恶心呕吐3天加重",
  "腹胀不适伴纳差", "大便性状改变伴便血", "吞咽困难进行性加重",
  "肝功能异常1月", "皮肤巩膜黄染1周", "腹部包块", "腹泻便秘交替",
  // 呼吸科
  "咳嗽咳痰伴发热3天", "喘息气促反复发作", "咳血痰1周",
  "胸痛伴发热咳嗽", "反复呼吸道感染", "呼吸困难伴紫绀",
  "长期咳嗽夜间加重", "过敏后咳嗽", "胸闷气喘活动后加重",
  // 肾内科
  "尿泡沫增多1月", "双下肢浮肿", "夜尿增多半年", "发现肌酐升高1周",
  "尿色加深", "少尿2天",
  // 内分泌科
  "发现血糖升高1月", "多饮多尿体重下降", "颈部增粗伴心悸",
  "手足增大1年", "皮肤色素沉着",
  // 血液科
  "反复发热1月", "皮肤瘀斑牙龈出血", "淋巴结肿大无痛",
  "乏力面色苍白半年",
  // 肿瘤科
  "发现肺结节1月", "乳腺肿块", "便血伴体重下降",
  "腹痛发现腹部包块",
  // 妇科
  "月经不规则半年", "白带异常伴异味", "停经后腹痛",
  "盆腔疼痛",
  // 眼科
  "视力下降渐进性", "眼痛伴头痛", "眼前黑影飘动",
  // 耳鼻喉科
  "耳闷耳鸣听力下降", "鼻塞流涕头痛", "咽痛发热",
  "声音嘶哑",
];

const DIAGNOSES_EXTRA = [
  // 呼吸系统
  "慢性阻塞性肺疾病", "支气管哮喘", "肺源性心脏病",
  "肺炎链球菌肺炎", "肺真菌病", "间质性肺病",
  // 心血管系统
  "病毒性心肌炎", "扩张型心肌病", "肥厚型心肌病",
  "心律失常-房颤", "心律失常-室早", "感染性心内膜炎",
  // 神经系统
  "短暂性脑缺血发作", "帕金森病", "阿尔茨海默病",
  "癫痫", "偏头痛", "三叉神经痛", "重症肌无力",
  // 骨科
  "腰椎管狭窄", "颈椎病", "肩周炎", "半月板损伤",
  "骨质疏松", "痛风性关节炎", "腘窝囊肿",
  // 消化系统
  "急性胰腺炎", "慢性胃炎", "消化性溃疡",
  "溃疡性结肠炎", "克罗恩病", "肠易激综合征",
  // 泌尿系统
  "肾盂肾炎", "慢性肾功能不全", "前列腺炎",
  "膀胱炎", "肾积水", "肾脏肿瘤",
  // 血液系统
  "缺铁性贫血", "巨幼细胞性贫血", "急性白血病",
  "淋巴瘤", "多发性骨髓瘤", "骨髓增生异常综合征",
  // 内分泌
  "甲状腺功能亢进", "糖尿病肾病", "糖尿病足",
  "甲状腺功能减退", "Cushing综合征", "醛固酮增多症",
  // 风湿免疫
  "类风湿关节炎", "强直性脊柱炎", "骨关节炎",
  "痛风", "皮肌炎", "硬皮病",
  // 眼科
  "白内障", "青光眼", "年龄相关性黄斑变性",
  "糖尿病视网膜病变",
  // 耳鼻喉科
  "慢性鼻窦炎", "扁桃体周围脓肿", "声带息肉",
  "梅尼埃病",
  // 肿瘤相关
  "食管癌", "胃癌", "肝癌", "胰腺癌",
  "结直肠癌", "肺癌", "乳腺癌", "前列腺癌",
  "膀胱癌", "甲状腺癌", "肾癌",
];

const ICD10_EXTRA = [
  // 呼吸
  "J44.901", "J45.901", "I27.901", "J13.001", "J15.901",
  "J84.101", "J43.901",
  // 心血管
  "I40.901", "I42.901", "I42.201", "I49.901", "I49.301",
  "I33.001", "I48.901", "I11.901",
  // 神经
  "G45.901", "G20.001", "G30.901", "G40.901",
  "G43.901", "G50.001", "G70.001",
  // 骨科
  "M48.001", "M47.201", "M75.001", "S83.201",
  "M81.901", "M10.001", "M71.201",
  // 消化
  "K85.901", "K29.501", "K25.901", "K51.901",
  "K50.901", "K58.901",
  // 泌尿
  "N10.001", "N18.901", "N41.001", "N30.001",
  "N13.001", "C64.001",
  // 血液
  "D50.901", "D51.901", "C91.001", "C82.901",
  "C90.001", "D46.901",
  // 内分泌
  "E05.901", "E11.201", "E11.501", "E12.901",
  "E03.901", "E24.901", "E26.001",
  // 风湿免疫
  "M06.901", "M46.001", "M17.901", "M10.901",
  "M33.101", "M34.901",
  // 眼科
  "H25.901", "H40.901", "H35.301", "E11.301",
  // 耳鼻喉
  "J32.901", "J36.001", "J38.101", "H81.001",
  // 肿瘤
  "C15.901", "C16.901", "C22.001", "C25.901",
  "C18.901", "C34.901", "C50.901", "C61.001",
  "C67.901", "C73.001", "C64.001",
];

// ---------- 写入扩展数据 ----------
const insertBefore = (haystack, needle, insertion) => {
  const pos = haystack.indexOf(needle);
  if (pos === -1) throw new Error(`Cannot find "${needle}"`);
  return (
    haystack.slice(0, pos) +
    insertion +
    haystack.slice(pos)
  );
};

// 扩展 COMPLAINTS
let pos = content.indexOf("];", content.indexOf("const COMPLAINTS"));
content =
  content.slice(0, pos) +
  "\n" +
  COMPLAINTS_EXTRA.map((c) => `  "${c}",`).join("\n") +
  "\n" +
  content.slice(pos);

// 扩展 DIAGNOSES
pos = content.indexOf("];", content.indexOf("const DIAGNOSES"));
content =
  content.slice(0, pos) +
  "\n" +
  DIAGNOSES_EXTRA.map((d) => `  "${d}",`).join("\n") +
  "\n" +
  content.slice(pos);

// 扩展 ICD10
pos = content.indexOf("];", content.indexOf("const ICD10"));
content =
  content.slice(0, pos) +
  "\n" +
  ICD10_EXTRA.map((i) => `  "${i}",`).join("\n") +
  "\n" +
  content.slice(pos);

// ---------- 替换 PATIENT_MASTER 为追加版本 ----------
const OLD_PM_LINE = `export const PATIENT_MASTER: PatientMaster[] = Array.from({ length: 15000 }, (_, i) => makePatient(i));`;
const NEW_PM_LINES = [
  `// 基础 15,000 名患者（保持向后兼容）`,
  `const _BASE_PATIENTS: PatientMaster[] = Array.from({ length: 15000 }, (_, i) => makePatient(i));`,
  `// 补充 34,700 名患者 —— 由 scripts/seed/02-generate-patients.mjs 生成`,
  `const _EXTRA_PATIENTS: PatientMaster[] = Array.from({ length: 34700 }, (_, i) => makePatient(15000 + i));`,
  `export const PATIENT_MASTER: PatientMaster[] = [..._BASE_PATIENTS, ..._EXTRA_PATIENTS];`,
].join("\n");

if (!content.includes(OLD_PM_LINE)) {
  console.error("ERROR: Could not find PATIENT_MASTER line to replace.");
  process.exit(1);
}
content = content.replace(OLD_PM_LINE, NEW_PM_LINES);

// ---------- 写回 ----------
fs.writeFileSync(srcFile, content, "utf-8");

const elapsed = Date.now() - startTime;
const stats = fs.statSync(srcFile);
const newLineCount = content.split("\n").length;

console.log("=".repeat(50));
console.log(`✅  Generated 34,700 supplementary patients`);
console.log(`📁  Output file: src/data/master/patientMasterMock.ts`);
console.log(`📏  File size: ${(stats.size / 1024).toFixed(1)} KB`);
console.log(`📄  Lines: ${newLineCount}`);
console.log(`⏱️   Running time: ${elapsed}ms`);
console.log("=".repeat(50));
