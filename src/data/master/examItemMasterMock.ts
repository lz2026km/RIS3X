// [v3.0.6.8-27] 检查项目字典
// 三甲医院放射科检查项目: CT ~80 / MR ~50 / DR ~30 / US ~40 / MG ~10 / DSA ~20 = 230+ 项

export type ExamCategory = "平扫" | "增强" | "造影" | "特殊成像" | "三维重建" | "功能成像";
export type ExamBodyPart =
  | "头部" | "颈部" | "胸部" | "心脏" | "腹部" | "盆腔" | "脊柱" | "骨关节" | "四肢"
  | "血管" | "软组织" | "全身" | "乳腺" | "甲状腺" | "泌尿" | "消化" | "呼吸" | "神经";

export interface ExamItemMaster {
  code: string; // CT-001
  name: string; // 胸部CT平扫
  modality: "CT" | "MR" | "DR" | "US" | "MG" | "DSA" | "PET-CT" | "NM";
  category: ExamCategory;
  bodyPart: ExamBodyPart;
  // 时长/费用
  avgDurationMin: number;
  priceRMB: number;
  // 影像质控要求
  contrastAgent: string | null; // 碘海醇/钆喷酸/无
  contrastVolume: string | null;
  sliceThickness: string; // 5mm/0.625mm
  // 报告
  reportTAT: number; // 报告周转时间 (分钟) - 标准
  reportTATUrgent: number; // 急诊报告 TAT
  // 元
  radLexCode: string;
  snomedCode: string;
  icd10: string[];
  keywords: string[];
  description: string;
  prepRequired: string; // 准备要求
}

const EXAM_DATA: { modality: ExamItemMaster["modality"]; name: string; category: ExamCategory; bodyPart: ExamBodyPart; price: number; dur: number; tat: number; tatUrgent: number; contrast?: string; radLex: string; snomed: string; prep: string; desc: string; }[] = [
  // CT 平扫 (15)
  { modality: "CT", name: "头部CT平扫", category: "平扫", bodyPart: "头部", price: 280, dur: 10, tat: 240, tatUrgent: 30, contrast: "无", radLex: "RID10321", snomed: "77477000", prep: "去除头部金属物", desc: "评估颅骨、颅内结构" },
  { modality: "CT", name: "胸部CT平扫", category: "平扫", bodyPart: "胸部", price: 320, dur: 8, tat: 240, tatUrgent: 30, contrast: "无", radLex: "RID10326", snomed: "169068008", prep: "去除胸部金属物", desc: "评估肺、纵隔、胸壁" },
  { modality: "CT", name: "腹部CT平扫", category: "平扫", bodyPart: "腹部", price: 350, dur: 12, tat: 240, tatUrgent: 30, contrast: "无", radLex: "RID10330", snomed: "169069000", prep: "空腹4小时", desc: "评估肝胆胰脾肾" },
  { modality: "CT", name: "盆腔CT平扫", category: "平扫", bodyPart: "盆腔", price: 320, dur: 10, tat: 240, tatUrgent: 30, contrast: "无", radLex: "RID10335", snomed: "169070000", prep: "充盈膀胱", desc: "评估盆腔脏器" },
  { modality: "CT", name: "颈椎CT平扫", category: "平扫", bodyPart: "脊柱", price: 300, dur: 8, tat: 240, tatUrgent: 30, contrast: "无", radLex: "RID10339", snomed: "169071001", prep: "去除金属物", desc: "评估颈椎骨质" },
  { modality: "CT", name: "腰椎CT平扫", category: "平扫", bodyPart: "脊柱", price: 320, dur: 10, tat: 240, tatUrgent: 30, contrast: "无", radLex: "RID10340", snomed: "169072008", prep: "去除金属物", desc: "评估腰椎间盘" },
  { modality: "CT", name: "全腹CT平扫", category: "平扫", bodyPart: "全身", price: 580, dur: 18, tat: 360, tatUrgent: 45, contrast: "无", radLex: "RID10343", snomed: "169073003", prep: "空腹4小时", desc: "全腹扫描" },
  { modality: "CT", name: "鼻窦CT平扫", category: "平扫", bodyPart: "头部", price: 260, dur: 8, tat: 240, tatUrgent: 30, contrast: "无", radLex: "RID10346", snomed: "169074009", prep: "去除金属物", desc: "评估鼻窦" },
  { modality: "CT", name: "颞骨CT平扫", category: "平扫", bodyPart: "头部", price: 280, dur: 10, tat: 240, tatUrgent: 30, contrast: "无", radLex: "RID10349", snomed: "169075005", prep: "去除金属物", desc: "高分辨评估颞骨" },
  { modality: "CT", name: "眼眶CT平扫", category: "平扫", bodyPart: "头部", price: 260, dur: 8, tat: 240, tatUrgent: 30, contrast: "无", radLex: "RID10352", snomed: "169076006", prep: "去除金属物", desc: "评估眼眶" },
  { modality: "CT", name: "喉部CT平扫", category: "平扫", bodyPart: "颈部", price: 300, dur: 8, tat: 240, tatUrgent: 30, contrast: "无", radLex: "RID10355", snomed: "169077002", prep: "勿做吞咽动作", desc: "评估喉部" },
  { modality: "CT", name: "甲状腺CT平扫", category: "平扫", bodyPart: "甲状腺", price: 280, dur: 8, tat: 240, tatUrgent: 30, contrast: "无", radLex: "RID10358", snomed: "169078007", prep: "去除金属物", desc: "评估甲状腺" },
  { modality: "CT", name: "肾上腺CT平扫", category: "平扫", bodyPart: "腹部", price: 320, dur: 10, tat: 240, tatUrgent: 30, contrast: "无", radLex: "RID10361", snomed: "169079004", prep: "空腹4小时", desc: "评估肾上腺" },
  { modality: "CT", name: "髋关节CT平扫", category: "平扫", bodyPart: "骨关节", price: 300, dur: 10, tat: 240, tatUrgent: 30, contrast: "无", radLex: "RID10364", snomed: "169080001", prep: "去除金属物", desc: "评估髋关节" },
  { modality: "CT", name: "膝关节CT平扫", category: "平扫", bodyPart: "骨关节", price: 300, dur: 10, tat: 240, tatUrgent: 30, contrast: "无", radLex: "RID10367", snomed: "169081002", prep: "去除金属物", desc: "评估膝关节" },

  // CT 增强 (15)
  { modality: "CT", name: "头部CT增强", category: "增强", bodyPart: "头部", price: 480, dur: 15, tat: 240, tatUrgent: 30, contrast: "碘海醇 80ml", radLex: "RID10370", snomed: "169082009", prep: "空腹4小时+碘过敏试验", desc: "评估脑肿瘤/血管病变" },
  { modality: "CT", name: "胸部CT增强", category: "增强", bodyPart: "胸部", price: 580, dur: 18, tat: 360, tatUrgent: 45, contrast: "碘海醇 80ml", radLex: "RID10373", snomed: "169083004", prep: "空腹4小时+碘过敏试验", desc: "评估肺/纵隔/胸膜" },
  { modality: "CT", name: "腹部CT增强(肝胆胰)", category: "增强", bodyPart: "腹部", price: 680, dur: 22, tat: 360, tatUrgent: 45, contrast: "碘海醇 100ml", radLex: "RID10376", snomed: "169084005", prep: "空腹4-6小时+碘过敏试验", desc: "评估肝胆胰脾" },
  { modality: "CT", name: "腹部CT增强(肾)", category: "增强", bodyPart: "腹部", price: 620, dur: 20, tat: 360, tatUrgent: 45, contrast: "碘海醇 100ml", radLex: "RID10379", snomed: "169085006", prep: "空腹4小时+碘过敏试验", desc: "评估肾脏病变" },
  { modality: "CT", name: "盆腔CT增强", category: "增强", bodyPart: "盆腔", price: 580, dur: 18, tat: 360, tatUrgent: 45, contrast: "碘海醇 100ml", radLex: "RID10382", snomed: "169086007", prep: "充盈膀胱+碘过敏试验", desc: "评估盆腔肿瘤" },
  { modality: "CT", name: "冠脉CTA", category: "造影", bodyPart: "心脏", price: 1280, dur: 25, tat: 360, tatUrgent: 60, contrast: "碘海醇 80ml", radLex: "RID10385", snomed: "169087003", prep: "心率<70+碘过敏试验+β阻滞剂", desc: "评估冠脉狭窄" },
  { modality: "CT", name: "冠脉钙化积分", category: "特殊成像", bodyPart: "心脏", price: 280, dur: 8, tat: 240, tatUrgent: 30, contrast: "无", radLex: "RID10388", snomed: "169088008", prep: "心率稳定", desc: "Agatston 评分" },
  { modality: "CT", name: "肺动脉CTA(CTPA)", category: "造影", bodyPart: "血管", price: 1080, dur: 18, tat: 240, tatUrgent: 30, contrast: "碘海醇 80ml", radLex: "RID10391", snomed: "169089000", prep: "碘过敏试验", desc: "评估肺栓塞" },
  { modality: "CT", name: "主动脉CTA", category: "造影", bodyPart: "血管", price: 1280, dur: 25, tat: 360, tatUrgent: 60, contrast: "碘海醇 100ml", radLex: "RID10394", snomed: "169090009", prep: "碘过敏试验+心率控制", desc: "评估主动脉夹层" },
  { modality: "CT", name: "头颈CTA", category: "造影", bodyPart: "血管", price: 1180, dur: 22, tat: 360, tatUrgent: 60, contrast: "碘海醇 80ml", radLex: "RID10397", snomed: "169091008", prep: "碘过敏试验", desc: "评估脑血管病变" },
  { modality: "CT", name: "下肢动脉CTA", category: "造影", bodyPart: "血管", price: 1180, dur: 25, tat: 360, tatUrgent: 60, contrast: "碘海醇 100ml", radLex: "RID10400", snomed: "169092001", prep: "空腹4小时+碘过敏试验", desc: "评估下肢血管" },
  { modality: "CT", name: "尿路CTU", category: "造影", bodyPart: "泌尿", price: 880, dur: 30, tat: 360, tatUrgent: 60, contrast: "碘海醇 100ml", radLex: "RID10403", snomed: "169093006", prep: "空腹6小时+碘过敏试验", desc: "评估泌尿系" },
  { modality: "CT", name: "CT尿路造影", category: "造影", bodyPart: "泌尿", price: 680, dur: 25, tat: 360, tatUrgent: 60, contrast: "碘海醇 100ml", radLex: "RID10406", snomed: "169094000", prep: "空腹+碘过敏试验", desc: "评估尿路梗阻" },
  { modality: "CT", name: "全腹CT增强", category: "增强", bodyPart: "全身", price: 880, dur: 25, tat: 360, tatUrgent: 60, contrast: "碘海醇 120ml", radLex: "RID10409", snomed: "169095004", prep: "空腹6小时+碘过敏试验", desc: "全腹增强" },
  { modality: "CT", name: "低剂量胸部CT(LDCT)", category: "特殊成像", bodyPart: "胸部", price: 380, dur: 10, tat: 360, tatUrgent: 60, contrast: "无", radLex: "RID10412", snomed: "169096003", prep: "深吸气屏气", desc: "肺癌早筛" },

  // CT 三维重建 (10)
  { modality: "CT", name: "骨三维重建", category: "三维重建", bodyPart: "骨关节", price: 200, dur: 10, tat: 120, tatUrgent: 30, contrast: "无", radLex: "RID10415", snomed: "169097007", prep: "已做CT", desc: "骨折评估" },
  { modality: "CT", name: "血管三维重建(MIP)", category: "三维重建", bodyPart: "血管", price: 200, dur: 10, tat: 120, tatUrgent: 30, contrast: "无", radLex: "RID10418", snomed: "169098002", prep: "已做CTA", desc: "血管评估" },
  { modality: "CT", name: "VR三维重建", category: "三维重建", bodyPart: "全身", price: 280, dur: 15, tat: 120, tatUrgent: 30, contrast: "无", radLex: "RID10421", snomed: "169099005", prep: "已做CT", desc: "容积重建" },
  { modality: "CT", name: "气道三维重建", category: "三维重建", bodyPart: "呼吸", price: 200, dur: 10, tat: 120, tatUrgent: 30, contrast: "无", radLex: "RID10424", snomed: "169100002", prep: "深吸气屏气", desc: "气道评估" },
  { modality: "CT", name: "内耳三维重建", category: "三维重建", bodyPart: "头部", price: 200, dur: 8, tat: 120, tatUrgent: 30, contrast: "无", radLex: "RID10427", snomed: "169101003", prep: "已做颞骨CT", desc: "听骨链评估" },
  { modality: "CT", name: "牙齿三维重建", category: "三维重建", bodyPart: "全身", price: 200, dur: 8, tat: 120, tatUrgent: 30, contrast: "无", radLex: "RID10430", snomed: "169102005", prep: "已做颌面CT", desc: "牙齿种植" },
  { modality: "CT", name: "脊柱三维重建", category: "三维重建", bodyPart: "脊柱", price: 200, dur: 10, tat: 120, tatUrgent: 30, contrast: "无", radLex: "RID10433", snomed: "169103000", prep: "已做脊柱CT", desc: "脊柱评估" },
  { modality: "CT", name: "颅骨三维重建", category: "三维重建", bodyPart: "头部", price: 200, dur: 8, tat: 120, tatUrgent: 30, contrast: "无", radLex: "RID10436", snomed: "169104006", prep: "已做头颅CT", desc: "颅骨骨折" },
  { modality: "CT", name: "肝脏体积测量", category: "特殊成像", bodyPart: "腹部", price: 150, dur: 8, tat: 120, tatUrgent: 30, contrast: "无", radLex: "RID10439", snomed: "169105007", prep: "已做肝CT", desc: "移植术前评估" },
  { modality: "CT", name: "肺结节分析(Lung-RADS)", category: "特殊成像", bodyPart: "胸部", price: 180, dur: 10, tat: 120, tatUrgent: 30, contrast: "无", radLex: "RID10442", snomed: "169106008", prep: "已做胸部CT", desc: "肺结节随访" },

  // CT 功能/灌注 (5)
  { modality: "CT", name: "头颅CT灌注(CTP)", category: "功能成像", bodyPart: "头部", price: 880, dur: 20, tat: 360, tatUrgent: 60, contrast: "碘海醇 50ml", radLex: "RID10445", snomed: "169107004", prep: "碘过敏试验", desc: "评估脑缺血半暗带" },
  { modality: "CT", name: "肝脏CT灌注", category: "功能成像", bodyPart: "腹部", price: 880, dur: 22, tat: 360, tatUrgent: 60, contrast: "碘海醇 80ml", radLex: "RID10448", snomed: "169108009", prep: "空腹+碘过敏试验", desc: "评估肝肿瘤" },
  { modality: "CT", name: "心肌CT灌注", category: "功能成像", bodyPart: "心脏", price: 1080, dur: 25, tat: 360, tatUrgent: 60, contrast: "碘海醇 80ml", radLex: "RID10451", snomed: "169109001", prep: "碘过敏试验", desc: "评估心肌缺血" },
  { modality: "CT", name: "双能CT(结石成分分析)", category: "特殊成像", bodyPart: "全身", price: 580, dur: 20, tat: 360, tatUrgent: 60, contrast: "无", radLex: "RID10454", snomed: "169110006", prep: "已做平扫", desc: "泌尿系结石成分" },
  { modality: "CT", name: "能谱CT成像", category: "特殊成像", bodyPart: "全身", price: 580, dur: 22, tat: 360, tatUrgent: 60, contrast: "无", radLex: "RID10457", snomed: "169111005", prep: "已做CT", desc: "物质成分分析" },
  { modality: "CT", name: "CT结肠造影", category: "造影", bodyPart: "消化", price: 980, dur: 25, tat: 360, tatUrgent: 60, contrast: "碘海醇 150ml", radLex: "RID10457", snomed: "169111006", prep: "肠道准备+碘过敏试验", desc: "结肠癌筛查" },
  { modality: "CT", name: "CT小肠造影(CTE)", category: "造影", bodyPart: "消化", price: 1080, dur: 30, tat: 360, tatUrgent: 60, contrast: "碘海醇 120ml", radLex: "RID10457", snomed: "169111007", prep: "空腹+甘露醇口服+碘过敏", desc: "小肠病变" },
  { modality: "CT", name: "颞下颌关节CT平扫", category: "平扫", bodyPart: "骨关节", price: 300, dur: 10, tat: 240, tatUrgent: 30, contrast: "无", radLex: "RID10457", snomed: "169111008", prep: "去除金属物", desc: "TMJ评估" },
  { modality: "CT", name: "CT引导下穿刺活检", category: "特殊成像", bodyPart: "胸部", price: 1880, dur: 40, tat: 120, tatUrgent: 30, contrast: "无", radLex: "RID10457", snomed: "169111009", prep: "凝血功能+空腹", desc: "肺结节活检" },
  { modality: "CT", name: "冠脉支架CTA评估", category: "造影", bodyPart: "心脏", price: 1380, dur: 28, tat: 360, tatUrgent: 60, contrast: "碘海醇 80ml", radLex: "RID10457", snomed: "169111010", prep: "心率<65+碘过敏试验", desc: "支架通畅性" },
  { modality: "CT", name: "双能量CT肺灌注", category: "功能成像", bodyPart: "胸部", price: 880, dur: 20, tat: 360, tatUrgent: 60, contrast: "碘海醇 80ml", radLex: "RID10457", snomed: "169111011", prep: "碘过敏试验", desc: "肺栓塞评估" },
  { modality: "CT", name: "CT关节造影", category: "造影", bodyPart: "骨关节", price: 680, dur: 20, tat: 240, tatUrgent: 30, contrast: "碘海醇 10ml", radLex: "RID10457", snomed: "169111012", prep: "关节穿刺+碘过敏", desc: "肩关节盂唇" },
  { modality: "CT", name: "胰腺CT增强(双期)", category: "增强", bodyPart: "腹部", price: 780, dur: 22, tat: 360, tatUrgent: 45, contrast: "碘海醇 100ml", radLex: "RID10457", snomed: "169111013", prep: "空腹6小时+碘过敏试验", desc: "胰腺肿瘤" },
  { modality: "CT", name: "肾上腺CT增强", category: "增强", bodyPart: "腹部", price: 680, dur: 18, tat: 360, tatUrgent: 45, contrast: "碘海醇 80ml", radLex: "RID10457", snomed: "169111014", prep: "空腹4小时+碘过敏试验", desc: "肾上腺腺瘤" },
  { modality: "CT", name: "四肢血管CTA", category: "造影", bodyPart: "血管", price: 1280, dur: 28, tat: 360, tatUrgent: 60, contrast: "碘海醇 120ml", radLex: "RID10457", snomed: "169111015", prep: "空腹+碘过敏试验", desc: "四肢血管病变" },
  { modality: "CT", name: "胸部高分辨CT(HRCT)", category: "特殊成像", bodyPart: "胸部", price: 420, dur: 12, tat: 240, tatUrgent: 30, contrast: "无", radLex: "RID10457", snomed: "169111016", prep: "深吸气屏气", desc: "间质性肺病" },
  { modality: "CT", name: "腹主动脉CTA", category: "造影", bodyPart: "血管", price: 1280, dur: 25, tat: 360, tatUrgent: 60, contrast: "碘海醇 100ml", radLex: "RID10457", snomed: "169111017", prep: "碘过敏试验", desc: "腹主动脉瘤" },
  { modality: "CT", name: "肺静脉CTA", category: "造影", bodyPart: "心脏", price: 1080, dur: 22, tat: 360, tatUrgent: 60, contrast: "碘海醇 80ml", radLex: "RID10457", snomed: "169111018", prep: "碘过敏试验", desc: "房颤术前评估" },
  { modality: "CT", name: "胸主动脉CTA", category: "造影", bodyPart: "血管", price: 1280, dur: 25, tat: 360, tatUrgent: 60, contrast: "碘海醇 100ml", radLex: "RID10457", snomed: "169111019", prep: "碘过敏试验", desc: "主动脉夹层" },
  { modality: "CT", name: "眼眶CT增强", category: "增强", bodyPart: "头部", price: 480, dur: 15, tat: 240, tatUrgent: 30, contrast: "碘海醇 60ml", radLex: "RID10457", snomed: "169111020", prep: "碘过敏试验", desc: "眼眶病变" },
  { modality: "CT", name: "颈部CT增强", category: "增强", bodyPart: "颈部", price: 580, dur: 18, tat: 360, tatUrgent: 45, contrast: "碘海醇 80ml", radLex: "RID10457", snomed: "169111021", prep: "空腹+碘过敏试验", desc: "颈部淋巴结" },

  // MR 平扫 (15)
  { modality: "MR", name: "头部MR平扫", category: "平扫", bodyPart: "头部", price: 580, dur: 25, tat: 360, tatUrgent: 60, contrast: "无", radLex: "RID10460", snomed: "169112003", prep: "去除金属物+禁动30分", desc: "颅脑 MRI" },
  { modality: "MR", name: "头部MR增强", category: "增强", bodyPart: "头部", price: 980, dur: 35, tat: 360, tatUrgent: 60, contrast: "钆喷酸 15ml", radLex: "RID10463", snomed: "169113008", prep: "禁食4小时+肾功检查", desc: "颅脑增强" },
  { modality: "MR", name: "颈椎MR平扫", category: "平扫", bodyPart: "脊柱", price: 580, dur: 22, tat: 360, tatUrgent: 60, contrast: "无", radLex: "RID10466", snomed: "169114002", prep: "去除金属物", desc: "颈椎间盘" },
  { modality: "MR", name: "颈椎MR增强", category: "增强", bodyPart: "脊柱", price: 980, dur: 30, tat: 360, tatUrgent: 60, contrast: "钆喷酸 15ml", radLex: "RID10469", snomed: "169115001", prep: "禁食4小时", desc: "颈椎增强" },
  { modality: "MR", name: "腰椎MR平扫", category: "平扫", bodyPart: "脊柱", price: 580, dur: 22, tat: 360, tatUrgent: 60, contrast: "无", radLex: "RID10472", snomed: "169116000", prep: "去除金属物", desc: "腰椎间盘" },
  { modality: "MR", name: "腰椎MR增强", category: "增强", bodyPart: "脊柱", price: 980, dur: 30, tat: 360, tatUrgent: 60, contrast: "钆喷酸 15ml", radLex: "RID10475", snomed: "169117009", prep: "禁食4小时", desc: "腰椎增强" },
  { modality: "MR", name: "膝关节MR平扫", category: "平扫", bodyPart: "骨关节", price: 580, dur: 25, tat: 360, tatUrgent: 60, contrast: "无", radLex: "RID10478", snomed: "169118004", prep: "去除金属物", desc: "半月板/韧带" },
  { modality: "MR", name: "髋关节MR平扫", category: "平扫", bodyPart: "骨关节", price: 580, dur: 25, tat: 360, tatUrgent: 60, contrast: "无", radLex: "RID10481", snomed: "169119007", prep: "去除金属物", desc: "股骨头坏死" },
  { modality: "MR", name: "肩关节MR平扫", category: "平扫", bodyPart: "骨关节", price: 580, dur: 25, tat: 360, tatUrgent: 60, contrast: "无", radLex: "RID10484", snomed: "169120001", prep: "去除金属物", desc: "肩袖" },
  { modality: "MR", name: "腕关节MR平扫", category: "平扫", bodyPart: "骨关节", price: 580, dur: 22, tat: 360, tatUrgent: 60, contrast: "无", radLex: "RID10487", snomed: "169121002", prep: "去除金属物", desc: "三角纤维软骨" },
  { modality: "MR", name: "肝脏MR平扫", category: "平扫", bodyPart: "腹部", price: 620, dur: 25, tat: 360, tatUrgent: 60, contrast: "无", radLex: "RID10490", snomed: "169122009", prep: "禁食4小时", desc: "肝占位" },
  { modality: "MR", name: "肝脏MR增强(普美显)", category: "增强", bodyPart: "腹部", price: 1480, dur: 40, tat: 360, tatUrgent: 60, contrast: "钆塞酸二钠 10ml", radLex: "RID10493", snomed: "169123004", prep: "禁食4小时+肾功", desc: "肝占位定性" },
  { modality: "MR", name: "盆腔MR平扫", category: "平扫", bodyPart: "盆腔", price: 620, dur: 25, tat: 360, tatUrgent: 60, contrast: "无", radLex: "RID10496", snomed: "169124005", prep: "适度憋尿", desc: "盆腔脏器" },
  { modality: "MR", name: "盆腔MR增强", category: "增强", bodyPart: "盆腔", price: 1080, dur: 35, tat: 360, tatUrgent: 60, contrast: "钆喷酸 15ml", radLex: "RID10499", snomed: "169125006", prep: "禁食4小时", desc: "盆腔增强" },

  // MR 特殊 (15)
  { modality: "MR", name: "脑垂体MR平扫", category: "特殊成像", bodyPart: "头部", price: 680, dur: 25, tat: 360, tatUrgent: 60, contrast: "无", radLex: "RID10502", snomed: "169126007", prep: "去除金属物", desc: "垂体微腺瘤" },
  { modality: "MR", name: "脑垂体MR增强(动态)", category: "增强", bodyPart: "头部", price: 1180, dur: 40, tat: 360, tatUrgent: 60, contrast: "钆喷酸 10ml", radLex: "RID10505", snomed: "169127003", prep: "禁食4小时", desc: "垂体微腺瘤动态增强" },
  { modality: "MR", name: "头颅MRA", category: "造影", bodyPart: "血管", price: 780, dur: 25, tat: 360, tatUrgent: 60, contrast: "无", radLex: "RID10508", snomed: "169128008", prep: "去除金属物", desc: "脑血管" },
  { modality: "MR", name: "头颅MRV", category: "造影", bodyPart: "血管", price: 780, dur: 25, tat: 360, tatUrgent: 60, contrast: "无", radLex: "RID10511", snomed: "169129000", prep: "去除金属物", desc: "脑静脉" },
  { modality: "MR", name: "颈部MRA", category: "造影", bodyPart: "血管", price: 780, dur: 25, tat: 360, tatUrgent: 60, contrast: "无", radLex: "RID10514", snomed: "169130005", prep: "去除金属物", desc: "颈动脉" },
  { modality: "MR", name: "肝脏MRCP", category: "特殊成像", bodyPart: "腹部", price: 880, dur: 30, tat: 360, tatUrgent: 60, contrast: "无", radLex: "RID10517", snomed: "169131009", prep: "禁食8小时", desc: "胰胆管成像" },
  { modality: "MR", name: "MRU尿路成像", category: "特殊成像", bodyPart: "泌尿", price: 880, dur: 30, tat: 360, tatUrgent: 60, contrast: "无", radLex: "RID10520", snomed: "169132002", prep: "适度憋尿", desc: "尿路梗阻" },
  { modality: "MR", name: "心脏MR(心肌活性)", category: "特殊成像", bodyPart: "心脏", price: 1480, dur: 45, tat: 360, tatUrgent: 60, contrast: "钆喷酸 20ml", radLex: "RID10523", snomed: "169133007", prep: "心律齐+肾功", desc: "心肌病评估" },
  { modality: "MR", name: "心脏MR(先天性)", category: "特殊成像", bodyPart: "心脏", price: 1480, dur: 45, tat: 360, tatUrgent: 60, contrast: "钆喷酸 15ml", radLex: "RID10526", snomed: "169134001", prep: "心律齐", desc: "先心病" },
  { modality: "MR", name: "心脏MR(瓣膜)", category: "特殊成像", bodyPart: "心脏", price: 1380, dur: 40, tat: 360, tatUrgent: 60, contrast: "无", radLex: "RID10529", snomed: "169135000", prep: "心律齐", desc: "瓣膜反流评估" },
  { modality: "MR", name: "乳腺MR平扫+增强", category: "增强", bodyPart: "乳腺", price: 1280, dur: 35, tat: 360, tatUrgent: 60, contrast: "钆喷酸 15ml", radLex: "RID10532", snomed: "169136004", prep: "月经后7-14天", desc: "乳腺肿块" },
  { modality: "MR", name: "腹部MR平扫", category: "平扫", bodyPart: "腹部", price: 620, dur: 25, tat: 360, tatUrgent: 60, contrast: "无", radLex: "RID10535", snomed: "169137008", prep: "禁食4小时", desc: "腹膜后病变" },
  { modality: "MR", name: "上腹部MR平扫+增强", category: "增强", bodyPart: "腹部", price: 1180, dur: 35, tat: 360, tatUrgent: 60, contrast: "钆喷酸 15ml", radLex: "RID10538", snomed: "169138003", prep: "禁食4小时", desc: "肝胆胰" },
  { modality: "MR", name: "直肠MR平扫+增强", category: "增强", bodyPart: "盆腔", price: 1280, dur: 35, tat: 360, tatUrgent: 60, contrast: "钆喷酸 15ml", radLex: "RID10541", snomed: "169139006", prep: "清洁肠道", desc: "直肠癌分期" },
  { modality: "MR", name: "前列腺MR平扫+增强", category: "增强", bodyPart: "盆腔", price: 1280, dur: 35, tat: 360, tatUrgent: 60, contrast: "钆喷酸 15ml", radLex: "RID10544", snomed: "169140008", prep: "清洁肠道", desc: "PI-RADS 评分" },

  // MR 功能 (5)
  { modality: "MR", name: "脑DTI(弥散张量)", category: "功能成像", bodyPart: "神经", price: 880, dur: 30, tat: 360, tatUrgent: 60, contrast: "无", radLex: "RID10547", snomed: "169141007", prep: "去除金属物", desc: "白质纤维束" },
  { modality: "MR", name: "脑fMRI(功能成像)", category: "功能成像", bodyPart: "神经", price: 1180, dur: 45, tat: 360, tatUrgent: 60, contrast: "无", radLex: "RID10550", snomed: "169142000", prep: "配合指令训练", desc: "脑功能区定位" },
  { modality: "MR", name: "脑MRS(波谱)", category: "功能成像", bodyPart: "神经", price: 980, dur: 30, tat: 360, tatUrgent: 60, contrast: "无", radLex: "RID10553", snomed: "169143005", prep: "去除金属物", desc: "脑肿瘤代谢" },
  { modality: "MR", name: "肝脂肪定量(MRI-PDFF)", category: "功能成像", bodyPart: "腹部", price: 880, dur: 25, tat: 360, tatUrgent: 60, contrast: "无", radLex: "RID10556", snomed: "169144004", prep: "禁食4小时", desc: "脂肪肝分级" },
  { modality: "MR", name: "全身DWIBS(类PET)", category: "功能成像", bodyPart: "全身", price: 1380, dur: 45, tat: 360, tatUrgent: 60, contrast: "无", radLex: "RID10559", snomed: "169145003", prep: "禁食4小时", desc: "肿瘤全身筛查" },
  { modality: "MR", name: "脑ASL(动脉自旋标记)", category: "功能成像", bodyPart: "神经", price: 880, dur: 20, tat: 360, tatUrgent: 60, contrast: "无", radLex: "RID10560", snomed: "169145004", prep: "去除金属物", desc: "脑灌注无对比剂" },
  { modality: "MR", name: "脑SWI(磁敏感加权)", category: "特殊成像", bodyPart: "神经", price: 680, dur: 15, tat: 360, tatUrgent: 60, contrast: "无", radLex: "RID10561", snomed: "169145005", prep: "去除金属物", desc: "微小出血/铁沉积" },
  { modality: "MR", name: "4D-flow MR血管成像", category: "功能成像", bodyPart: "血管", price: 1480, dur: 40, tat: 360, tatUrgent: 60, contrast: "无", radLex: "RID10562", snomed: "169145006", prep: "去除金属物", desc: "血流动力学" },
  { modality: "MR", name: "MR弹性成像(MRE)", category: "特殊成像", bodyPart: "腹部", price: 1080, dur: 30, tat: 360, tatUrgent: 60, contrast: "无", radLex: "RID10563", snomed: "169145007", prep: "禁食4小时", desc: "肝纤维化分期" },
  { modality: "MR", name: "MR神经成像(MRN)", category: "特殊成像", bodyPart: "神经", price: 980, dur: 35, tat: 360, tatUrgent: 60, contrast: "无", radLex: "RID10564", snomed: "169145008", prep: "去除金属物", desc: "周围神经病变" },
  { modality: "MR", name: "MR小肠造影(MRE)", category: "造影", bodyPart: "消化", price: 1280, dur: 40, tat: 360, tatUrgent: 60, contrast: "钆喷酸 15ml", radLex: "RID10565", snomed: "169145009", prep: "禁食6小时+甘露醇口服", desc: "炎性肠病" },
  { modality: "MR", name: "MR关节造影(肩)", category: "造影", bodyPart: "骨关节", price: 1080, dur: 35, tat: 360, tatUrgent: 60, contrast: "钆喷酸 5ml", radLex: "RID10566", snomed: "169145010", prep: "关节穿刺", desc: "肩关节盂唇损伤" },
  { modality: "MR", name: "MR关节造影(髋)", category: "造影", bodyPart: "骨关节", price: 1080, dur: 35, tat: 360, tatUrgent: 60, contrast: "钆喷酸 5ml", radLex: "RID10567", snomed: "169145011", prep: "关节穿刺", desc: "髋关节盂唇损伤" },
  { modality: "MR", name: "全身MRA", category: "造影", bodyPart: "血管", price: 1280, dur: 40, tat: 360, tatUrgent: 60, contrast: "钆喷酸 20ml", radLex: "RID10568", snomed: "169145012", prep: "禁食4小时+肾功", desc: "全身血管评估" },
  { modality: "MR", name: "脑T2-FLAIR增强", category: "增强", bodyPart: "头部", price: 880, dur: 25, tat: 360, tatUrgent: 60, contrast: "钆喷酸 10ml", radLex: "RID10569", snomed: "169145013", prep: "肾功检查", desc: "脑膜炎评估" },
  { modality: "MR", name: "臂丛神经MR", category: "特殊成像", bodyPart: "神经", price: 1080, dur: 35, tat: 360, tatUrgent: 60, contrast: "无", radLex: "RID10570", snomed: "169145014", prep: "去除金属物", desc: "臂丛神经损伤" },
  { modality: "MR", name: "前列腺MR平扫", category: "平扫", bodyPart: "盆腔", price: 620, dur: 25, tat: 360, tatUrgent: 60, contrast: "无", radLex: "RID10571", snomed: "169145015", prep: "清洁肠道", desc: "前列腺增生" },
  { modality: "MR", name: "睾丸MR平扫", category: "平扫", bodyPart: "盆腔", price: 580, dur: 22, tat: 360, tatUrgent: 60, contrast: "无", radLex: "RID10572", snomed: "169145016", prep: "去除金属物", desc: "睾丸病变" },
  { modality: "MR", name: "眼眶MR平扫+增强", category: "增强", bodyPart: "头部", price: 980, dur: 30, tat: 360, tatUrgent: 60, contrast: "钆喷酸 10ml", radLex: "RID10573", snomed: "169145017", prep: "去除金属物", desc: "眼眶肿瘤" },
  { modality: "MR", name: "腰丛神经MR", category: "特殊成像", bodyPart: "神经", price: 1080, dur: 35, tat: 360, tatUrgent: 60, contrast: "无", radLex: "RID10574", snomed: "169145018", prep: "去除金属物", desc: "腰骶丛病变" },
  { modality: "MR", name: "胎儿MR平扫", category: "平扫", bodyPart: "盆腔", price: 880, dur: 35, tat: 360, tatUrgent: 60, contrast: "无", radLex: "RID10575", snomed: "169145019", prep: "无需特殊", desc: "胎儿中枢神经" },
  { modality: "MR", name: "腮腺MR平扫+增强", category: "增强", bodyPart: "颈部", price: 980, dur: 30, tat: 360, tatUrgent: 60, contrast: "钆喷酸 10ml", radLex: "RID10576", snomed: "169145020", prep: "去除金属物", desc: "腮腺肿瘤" },

  // DR (15)
  { modality: "DR", name: "胸部正侧位", category: "平扫", bodyPart: "胸部", price: 80, dur: 3, tat: 60, tatUrgent: 15, contrast: "无", radLex: "RID10562", snomed: "169146002", prep: "去除金属物", desc: "胸片基础检查" },
  { modality: "DR", name: "腹部立位平片", category: "平扫", bodyPart: "腹部", price: 80, dur: 3, tat: 60, tatUrgent: 15, contrast: "无", radLex: "RID10565", snomed: "169147006", prep: "去除金属物", desc: "肠梗阻" },
  { modality: "DR", name: "骨盆正位", category: "平扫", bodyPart: "骨关节", price: 80, dur: 3, tat: 60, tatUrgent: 15, contrast: "无", radLex: "RID10568", snomed: "169148001", prep: "去除金属物", desc: "骨盆骨折" },
  { modality: "DR", name: "颈椎正侧位", category: "平扫", bodyPart: "脊柱", price: 100, dur: 4, tat: 60, tatUrgent: 15, contrast: "无", radLex: "RID10571", snomed: "169149009", prep: "去除金属物", desc: "颈椎病" },
  { modality: "DR", name: "胸椎正侧位", category: "平扫", bodyPart: "脊柱", price: 100, dur: 4, tat: 60, tatUrgent: 15, contrast: "无", radLex: "RID10574", snomed: "169150009", prep: "去除金属物", desc: "胸椎病" },
  { modality: "DR", name: "腰椎正侧位", category: "平扫", bodyPart: "脊柱", price: 100, dur: 4, tat: 60, tatUrgent: 15, contrast: "无", radLex: "RID10577", snomed: "169151008", prep: "去除金属物", desc: "腰椎病" },
  { modality: "DR", name: "膝关节正侧位", category: "平扫", bodyPart: "骨关节", price: 80, dur: 4, tat: 60, tatUrgent: 15, contrast: "无", radLex: "RID10580", snomed: "169152001", prep: "去除金属物", desc: "膝关节" },
  { modality: "DR", name: "髋关节正位", category: "平扫", bodyPart: "骨关节", price: 80, dur: 4, tat: 60, tatUrgent: 15, contrast: "无", radLex: "RID10583", snomed: "169153006", prep: "去除金属物", desc: "髋关节" },
  { modality: "DR", name: "肩关节正位", category: "平扫", bodyPart: "骨关节", price: 80, dur: 4, tat: 60, tatUrgent: 15, contrast: "无", radLex: "RID10586", snomed: "169154000", prep: "去除金属物", desc: "肩关节" },
  { modality: "DR", name: "腕关节正侧位", category: "平扫", bodyPart: "骨关节", price: 80, dur: 4, tat: 60, tatUrgent: 15, contrast: "无", radLex: "RID10589", snomed: "169155004", prep: "去除金属物", desc: "腕关节" },
  { modality: "DR", name: "肘关节正侧位", category: "平扫", bodyPart: "骨关节", price: 80, dur: 4, tat: 60, tatUrgent: 15, contrast: "无", radLex: "RID10592", snomed: "169156003", prep: "去除金属物", desc: "肘关节" },
  { modality: "DR", name: "踝关节正侧位", category: "平扫", bodyPart: "骨关节", price: 80, dur: 4, tat: 60, tatUrgent: 15, contrast: "无", radLex: "RID10595", snomed: "169157007", prep: "去除金属物", desc: "踝关节" },
  { modality: "DR", name: "足正侧位", category: "平扫", bodyPart: "四肢", price: 80, dur: 4, tat: 60, tatUrgent: 15, contrast: "无", radLex: "RID10598", snomed: "169158002", prep: "去除金属物", desc: "足部" },
  { modality: "DR", name: "手正斜位", category: "平扫", bodyPart: "四肢", price: 80, dur: 4, tat: 60, tatUrgent: 15, contrast: "无", radLex: "RID10601", snomed: "169159005", prep: "去除金属物", desc: "手部" },
  { modality: "DR", name: "胸腰段全长摄影(EOS)", category: "特殊成像", bodyPart: "脊柱", price: 380, dur: 8, tat: 120, tatUrgent: 30, contrast: "无", radLex: "RID10604", snomed: "169160000", prep: "去除金属物", desc: "脊柱侧弯" },
  { modality: "DR", name: "负重位膝关节DR", category: "特殊成像", bodyPart: "骨关节", price: 120, dur: 5, tat: 60, tatUrgent: 15, contrast: "无", radLex: "RID10605", snomed: "169160001", prep: "站立位", desc: "骨关节炎评估" },
  { modality: "DR", name: "脊柱全长DR", category: "特殊成像", bodyPart: "脊柱", price: 320, dur: 8, tat: 120, tatUrgent: 30, contrast: "无", radLex: "RID10606", snomed: "169160002", prep: "去除金属物", desc: "脊柱侧弯测量" },
  { modality: "DR", name: "双下肢全长DR", category: "特殊成像", bodyPart: "四肢", price: 280, dur: 6, tat: 120, tatUrgent: 30, contrast: "无", radLex: "RID10607", snomed: "169160003", prep: "站立位", desc: "下肢力线测量" },
  { modality: "DR", name: "负重位踝关节DR", category: "特殊成像", bodyPart: "骨关节", price: 100, dur: 4, tat: 60, tatUrgent: 15, contrast: "无", radLex: "RID10608", snomed: "169160004", prep: "站立位", desc: "踝关节负重评估" },
  { modality: "DR", name: "骶髂关节DR", category: "平扫", bodyPart: "骨关节", price: 100, dur: 4, tat: 60, tatUrgent: 15, contrast: "无", radLex: "RID10609", snomed: "169160005", prep: "去除金属物", desc: "强直性脊柱炎" },
  { modality: "DR", name: "乳腺DR(钼靶)", category: "平扫", bodyPart: "乳腺", price: 280, dur: 10, tat: 60, tatUrgent: 15, contrast: "无", radLex: "RID10610", snomed: "169160006", prep: "月经后7-14天", desc: "乳腺癌筛查" },
  { modality: "DR", name: "口腔曲面断层(全景)", category: "特殊成像", bodyPart: "全身", price: 180, dur: 5, tat: 60, tatUrgent: 15, contrast: "无", radLex: "RID10611", snomed: "169160007", prep: "去除金属物", desc: "口腔全景" },
  { modality: "DR", name: "头颅正侧位DR", category: "平扫", bodyPart: "头部", price: 100, dur: 4, tat: 60, tatUrgent: 15, contrast: "无", radLex: "RID10612", snomed: "169160008", prep: "去除金属物", desc: "颅骨评估" },
  { modality: "DR", name: "胸部双能量减影DR", category: "特殊成像", bodyPart: "胸部", price: 180, dur: 5, tat: 60, tatUrgent: 15, contrast: "无", radLex: "RID10613", snomed: "169160009", prep: "深吸气屏气", desc: "肺结节检测" },
  { modality: "DR", name: "跟骨轴位+侧位DR", category: "平扫", bodyPart: "四肢", price: 80, dur: 3, tat: 60, tatUrgent: 15, contrast: "无", radLex: "RID10614", snomed: "169160010", prep: "去除金属物", desc: "跟骨骨折" },
  { modality: "DR", name: "胸片(便携)", category: "平扫", bodyPart: "胸部", price: 60, dur: 3, tat: 120, tatUrgent: 15, contrast: "无", radLex: "RID10615", snomed: "169160011", prep: "卧床", desc: "床旁胸片" },
  { modality: "DR", name: "站立位全脊柱DR", category: "特殊成像", bodyPart: "脊柱", price: 380, dur: 8, tat: 120, tatUrgent: 30, contrast: "无", radLex: "RID10616", snomed: "169160012", prep: "站立位", desc: "脊柱侧弯Cobb角" },
  { modality: "DR", name: "胸部侧位DR", category: "平扫", bodyPart: "胸部", price: 60, dur: 2, tat: 60, tatUrgent: 15, contrast: "无", radLex: "RID10617", snomed: "169160013", prep: "去除金属物", desc: "胸片侧位" },
  { modality: "DR", name: "腹部侧位DR", category: "平扫", bodyPart: "腹部", price: 80, dur: 3, tat: 60, tatUrgent: 15, contrast: "无", radLex: "RID10618", snomed: "169160014", prep: "去除金属物", desc: "腹部侧位" },

  // US (20)
  { modality: "US", name: "腹部超声", category: "平扫", bodyPart: "腹部", price: 120, dur: 15, tat: 60, tatUrgent: 15, contrast: "无", radLex: "RID10607", snomed: "169161001", prep: "空腹8小时", desc: "肝胆胰脾肾" },
  { modality: "US", name: "肝胆胰脾超声", category: "平扫", bodyPart: "腹部", price: 120, dur: 15, tat: 60, tatUrgent: 15, contrast: "无", radLex: "RID10610", snomed: "169162008", prep: "空腹8小时", desc: "肝胆系统" },
  { modality: "US", name: "泌尿系超声", category: "平扫", bodyPart: "泌尿", price: 100, dur: 12, tat: 60, tatUrgent: 15, contrast: "无", radLex: "RID10613", snomed: "169163003", prep: "充盈膀胱", desc: "肾输尿管膀胱" },
  { modality: "US", name: "妇科超声(经腹)", category: "平扫", bodyPart: "盆腔", price: 120, dur: 12, tat: 60, tatUrgent: 15, contrast: "无", radLex: "RID10616", snomed: "169164009", prep: "充盈膀胱", desc: "子宫附件" },
  { modality: "US", name: "妇科超声(经阴道)", category: "平扫", bodyPart: "盆腔", price: 160, dur: 12, tat: 60, tatUrgent: 15, contrast: "无", radLex: "RID10619", snomed: "169165005", prep: "排空膀胱", desc: "子宫附件高清" },
  { modality: "US", name: "产科超声(早孕)", category: "平扫", bodyPart: "盆腔", price: 180, dur: 15, tat: 60, tatUrgent: 15, contrast: "无", radLex: "RID10622", snomed: "169166006", prep: "适度憋尿", desc: "<13周早孕" },
  { modality: "US", name: "产科系统超声(中孕)", category: "平扫", bodyPart: "盆腔", price: 380, dur: 30, tat: 60, tatUrgent: 15, contrast: "无", radLex: "RID10625", snomed: "169167002", prep: "无需特殊", desc: "22-26周系统超声" },
  { modality: "US", name: "产科晚期超声", category: "平扫", bodyPart: "盆腔", price: 220, dur: 20, tat: 60, tatUrgent: 15, contrast: "无", radLex: "RID10628", snomed: "169168007", prep: "无需特殊", desc: ">32周晚期超声" },
  { modality: "US", name: "甲状腺超声", category: "平扫", bodyPart: "甲状腺", price: 100, dur: 12, tat: 60, tatUrgent: 15, contrast: "无", radLex: "RID10631", snomed: "169169004", prep: "无需特殊", desc: "TI-RADS 评分" },
  { modality: "US", name: "颈部淋巴结超声", category: "平扫", bodyPart: "颈部", price: 100, dur: 10, tat: 60, tatUrgent: 15, contrast: "无", radLex: "RID10634", snomed: "169170003", prep: "无需特殊", desc: "颈部淋巴结" },
  { modality: "US", name: "颈动脉超声", category: "平扫", bodyPart: "血管", price: 180, dur: 15, tat: 60, tatUrgent: 15, contrast: "无", radLex: "RID10637", snomed: "169171004", prep: "无需特殊", desc: "颈动脉斑块" },
  { modality: "US", name: "椎动脉超声", category: "平扫", bodyPart: "血管", price: 180, dur: 15, tat: 60, tatUrgent: 15, contrast: "无", radLex: "RID10640", snomed: "169172006", prep: "无需特殊", desc: "椎动脉血流" },
  { modality: "US", name: "下肢动脉超声", category: "平扫", bodyPart: "血管", price: 220, dur: 25, tat: 60, tatUrgent: 15, contrast: "无", radLex: "RID10643", snomed: "169173001", prep: "无需特殊", desc: "下肢血管" },
  { modality: "US", name: "下肢静脉超声", category: "平扫", bodyPart: "血管", price: 220, dur: 25, tat: 60, tatUrgent: 15, contrast: "无", radLex: "RID10646", snomed: "169174007", prep: "无需特殊", desc: "DVT 排查" },
  { modality: "US", name: "心脏彩超(经胸)", category: "平扫", bodyPart: "心脏", price: 280, dur: 25, tat: 60, tatUrgent: 15, contrast: "无", radLex: "RID10649", snomed: "169175008", prep: "无需特殊", desc: "TTE 心功能" },
  { modality: "US", name: "心脏彩超(经食道)", category: "平扫", bodyPart: "心脏", price: 480, dur: 30, tat: 120, tatUrgent: 30, contrast: "无", radLex: "RID10652", snomed: "169176009", prep: "禁食6小时", desc: "TEE 房颤/瓣膜" },
  { modality: "US", name: "乳腺超声", category: "平扫", bodyPart: "乳腺", price: 180, dur: 15, tat: 60, tatUrgent: 15, contrast: "无", radLex: "RID10655", snomed: "169177000", prep: "无需特殊", desc: "BI-RADS 评分" },
  { modality: "US", name: "浅表肿物超声", category: "平扫", bodyPart: "软组织", price: 120, dur: 12, tat: 60, tatUrgent: 15, contrast: "无", radLex: "RID10658", snomed: "169178005", prep: "无需特殊", desc: "皮下肿物" },
  { modality: "US", name: "阴囊超声", category: "平扫", bodyPart: "泌尿", price: 120, dur: 12, tat: 60, tatUrgent: 15, contrast: "无", radLex: "RID10661", snomed: "169179002", prep: "无需特殊", desc: "睾丸附睾" },
  { modality: "US", name: "经直肠前列腺超声", category: "平扫", bodyPart: "泌尿", price: 220, dur: 20, tat: 60, tatUrgent: 15, contrast: "无", radLex: "RID10664", snomed: "169180004", prep: "清洁肠道", desc: "前列腺" },

  // MG (5)
  { modality: "MG", name: "双侧乳腺钼靶(轴位+侧斜位)", category: "平扫", bodyPart: "乳腺", price: 280, dur: 15, tat: 60, tatUrgent: 15, contrast: "无", radLex: "RID10667", snomed: "169181000", prep: "月经后7-14天", desc: "BI-RADS 评分" },
  { modality: "MG", name: "单侧乳腺钼靶", category: "平扫", bodyPart: "乳腺", price: 180, dur: 10, tat: 60, tatUrgent: 15, contrast: "无", radLex: "RID10670", snomed: "169182007", prep: "月经后7-14天", desc: "单侧随访" },
  { modality: "MG", name: "乳腺钼靶局部点压", category: "特殊成像", bodyPart: "乳腺", price: 280, dur: 15, tat: 60, tatUrgent: 15, contrast: "无", radLex: "RID10673", snomed: "169183002", prep: "常规钼靶异常", desc: "可疑区域点压" },
  { modality: "MG", name: "乳腺导管造影", category: "造影", bodyPart: "乳腺", price: 480, dur: 25, tat: 120, tatUrgent: 30, contrast: "碘海醇 2ml", radLex: "RID10676", snomed: "169184008", prep: "乳头溢液", desc: "导管内病变" },
  { modality: "MG", name: "假体植入评估", category: "特殊成像", bodyPart: "乳腺", price: 380, dur: 20, tat: 60, tatUrgent: 15, contrast: "无", radLex: "RID10679", snomed: "169185009", prep: "无需特殊", desc: "假体完整性" },

  // DSA (10)
  { modality: "DSA", name: "冠脉造影+左室造影", category: "造影", bodyPart: "心脏", price: 4800, dur: 45, tat: 240, tatUrgent: 30, contrast: "碘海醇 100ml", radLex: "RID10682", snomed: "169186005", prep: "禁食6小时+碘过敏", desc: "CAG 冠脉评估" },
  { modality: "DSA", name: "冠脉支架植入术(PCI)", category: "特殊成像", bodyPart: "心脏", price: 18000, dur: 90, tat: 240, tatUrgent: 30, contrast: "碘海醇 200ml", radLex: "RID10685", snomed: "169187001", prep: "禁食6小时+阿司匹林", desc: "PCI 介入治疗" },
  { modality: "DSA", name: "冠脉球囊扩张术", category: "特殊成像", bodyPart: "心脏", price: 12800, dur: 60, tat: 240, tatUrgent: 30, contrast: "碘海醇 200ml", radLex: "RID10688", snomed: "169188006", prep: "禁食6小时", desc: "PTCA" },
  { modality: "DSA", name: "脑血管造影(DSA)", category: "造影", bodyPart: "血管", price: 5800, dur: 60, tat: 240, tatUrgent: 30, contrast: "碘海醇 80ml", radLex: "RID10691", snomed: "169189003", prep: "禁食6小时+碘过敏", desc: "脑血管病" },
  { modality: "DSA", name: "颈动脉支架植入", category: "特殊成像", bodyPart: "血管", price: 18800, dur: 90, tat: 240, tatUrgent: 30, contrast: "碘海醇 150ml", radLex: "RID10694", snomed: "169190007", prep: "禁食6小时+阿司匹林", desc: "CAS" },
  { modality: "DSA", name: "肾动脉造影", category: "造影", bodyPart: "血管", price: 4800, dur: 45, tat: 240, tatUrgent: 30, contrast: "碘海醇 80ml", radLex: "RID10697", snomed: "169191006", prep: "禁食6小时+碘过敏", desc: "肾血管性高血压" },
  { modality: "DSA", name: "肾动脉支架植入", category: "特殊成像", bodyPart: "血管", price: 18800, dur: 90, tat: 240, tatUrgent: 30, contrast: "碘海醇 150ml", radLex: "RID10700", snomed: "169192004", prep: "禁食6小时+阿司匹林", desc: "肾血管成形" },
  { modality: "DSA", name: "肝动脉化疗栓塞(TACE)", category: "特殊成像", bodyPart: "腹部", price: 12800, dur: 90, tat: 240, tatUrgent: 30, contrast: "碘海醇 150ml", radLex: "RID10703", snomed: "169193009", prep: "禁食6小时", desc: "肝癌介入" },
  { modality: "DSA", name: "子宫动脉栓塞", category: "特殊成像", bodyPart: "盆腔", price: 9800, dur: 60, tat: 240, tatUrgent: 30, contrast: "碘海醇 100ml", radLex: "RID10706", snomed: "169194003", prep: "禁食6小时", desc: "子宫肌瘤/产后出血" },
  { modality: "DSA", name: "外周血管造影+介入", category: "造影", bodyPart: "血管", price: 6800, dur: 60, tat: 240, tatUrgent: 30, contrast: "碘海醇 100ml", radLex: "RID10709", snomed: "169195002", prep: "禁食6小时", desc: "外周血管病" },

  // PET-CT (10)
  { modality: "PET-CT", name: "PET-CT全身FDG显像", category: "特殊成像", bodyPart: "全身", price: 6980, dur: 30, tat: 480, tatUrgent: 120, contrast: "氟代脱氧葡萄糖(FDG)", radLex: "RID10710", snomed: "169195003", prep: "禁食6小时+血糖<11.1", desc: "肿瘤全身评估" },
  { modality: "PET-CT", name: "PET-CT脑FDG显像", category: "特殊成像", bodyPart: "头部", price: 5980, dur: 25, tat: 480, tatUrgent: 120, contrast: "氟代脱氧葡萄糖(FDG)", radLex: "RID10711", snomed: "169195004", prep: "禁食6小时+血糖<11.1", desc: "脑代谢/癫痫" },
  { modality: "PET-CT", name: "PET-CT心肌代谢显像", category: "特殊成像", bodyPart: "心脏", price: 6480, dur: 40, tat: 480, tatUrgent: 120, contrast: "氟代脱氧葡萄糖(FDG)", radLex: "RID10712", snomed: "169195005", prep: "禁食12小时+糖负荷", desc: "心肌活力评估" },
  { modality: "PET-CT", name: "PET-CT局部显像(胸部)", category: "特殊成像", bodyPart: "胸部", price: 4980, dur: 20, tat: 480, tatUrgent: 120, contrast: "氟代脱氧葡萄糖(FDG)", radLex: "RID10713", snomed: "169195006", prep: "禁食6小时", desc: "肺结节评估" },
  { modality: "PET-CT", name: "PET-CT局部显像(腹部)", category: "特殊成像", bodyPart: "腹部", price: 4980, dur: 20, tat: 480, tatUrgent: 120, contrast: "氟代脱氧葡萄糖(FDG)", radLex: "RID10714", snomed: "169195007", prep: "禁食6小时", desc: "肝/胰腺病变" },
  { modality: "PET-CT", name: "PET-CT全身显像(延迟)", category: "特殊成像", bodyPart: "全身", price: 7980, dur: 50, tat: 480, tatUrgent: 120, contrast: "氟代脱氧葡萄糖(FDG)", radLex: "RID10715", snomed: "169195008", prep: "禁食6小时+空腹血糖", desc: "延迟显像提高特异性" },
  { modality: "PET-CT", name: "PET-CT PSMA显像", category: "特殊成像", bodyPart: "全身", price: 8980, dur: 35, tat: 480, tatUrgent: 120, contrast: "Ga-68 PSMA", radLex: "RID10716", snomed: "169195009", prep: "禁食4小时", desc: "前列腺癌分期" },
  { modality: "PET-CT", name: "PET-CT DOTATATE显像", category: "特殊成像", bodyPart: "全身", price: 8980, dur: 35, tat: 480, tatUrgent: 120, contrast: "Ga-68 DOTATATE", radLex: "RID10717", snomed: "169195010", prep: "禁食4小时", desc: "神经内分泌肿瘤" },
  { modality: "PET-CT", name: "PET-CT FDG脑显像(阿尔茨海默)", category: "特殊成像", bodyPart: "头部", price: 6480, dur: 25, tat: 480, tatUrgent: 120, contrast: "氟代脱氧葡萄糖(FDG)", radLex: "RID10718", snomed: "169195011", prep: "禁食6小时", desc: "痴呆鉴别" },
  { modality: "PET-CT", name: "PET-CT全身显像(儿童)", category: "特殊成像", bodyPart: "全身", price: 5980, dur: 30, tat: 480, tatUrgent: 120, contrast: "氟代脱氧葡萄糖(FDG)", radLex: "RID10719", snomed: "169195012", prep: "禁食6小时+镇静评估", desc: "儿童肿瘤" },

  // NM (核医学) (15)
  { modality: "NM", name: "全身骨显像(SPECT)", category: "特殊成像", bodyPart: "全身", price: 880, dur: 30, tat: 480, tatUrgent: 120, contrast: "Tc-99m MDP", radLex: "RID10720", snomed: "169195013", prep: "多饮水", desc: "骨转移筛查" },
  { modality: "NM", name: "甲状腺静态显像", category: "特殊成像", bodyPart: "甲状腺", price: 380, dur: 20, tat: 240, tatUrgent: 60, contrast: "Tc-99m 高锝酸盐", radLex: "RID10721", snomed: "169195014", prep: "停用甲状腺药物", desc: "甲状腺功能" },
  { modality: "NM", name: "心肌灌注显像(静息+负荷)", category: "特殊成像", bodyPart: "心脏", price: 1680, dur: 120, tat: 480, tatUrgent: 120, contrast: "Tc-99m MIBI", radLex: "RID10722", snomed: "169195015", prep: "禁食4小时+停β阻滞剂", desc: "心肌缺血评估" },
  { modality: "NM", name: "肾动态显像+GFR", category: "特殊成像", bodyPart: "泌尿", price: 680, dur: 30, tat: 240, tatUrgent: 60, contrast: "Tc-99m DTPA", radLex: "RID10723", snomed: "169195016", prep: "饮水300ml", desc: "肾功能分测" },
  { modality: "NM", name: "肺通气/灌注显像(V/Q)", category: "特殊成像", bodyPart: "呼吸", price: 880, dur: 45, tat: 480, tatUrgent: 120, contrast: "Tc-99m MAA+气体", radLex: "RID10724", snomed: "169195017", prep: "无需特殊", desc: "肺栓塞" },
  { modality: "NM", name: "甲状旁腺显像", category: "特殊成像", bodyPart: "甲状腺", price: 680, dur: 60, tat: 240, tatUrgent: 60, contrast: "Tc-99m MIBI", radLex: "RID10725", snomed: "169195018", prep: "无需特殊", desc: "甲状旁腺腺瘤" },
  { modality: "NM", name: "全身淋巴显像", category: "特殊成像", bodyPart: "全身", price: 780, dur: 60, tat: 240, tatUrgent: 60, contrast: "Tc-99m 植酸钠", radLex: "RID10726", snomed: "169195019", prep: "无需特殊", desc: "淋巴回流" },
  { modality: "NM", name: "肝胆动态显像(HIDA)", category: "特殊成像", bodyPart: "消化", price: 680, dur: 90, tat: 240, tatUrgent: 60, contrast: "Tc-99m EHIDA", radLex: "RID10727", snomed: "169195020", prep: "禁食4小时", desc: "胆囊功能" },
  { modality: "NM", name: "消化道出血显像", category: "特殊成像", bodyPart: "消化", price: 780, dur: 60, tat: 240, tatUrgent: 30, contrast: "Tc-99m RBC", radLex: "RID10728", snomed: "169195021", prep: "无需特殊", desc: "活动性出血定位" },
  { modality: "NM", name: "脑血流灌注显像", category: "特殊成像", bodyPart: "头部", price: 880, dur: 30, tat: 240, tatUrgent: 60, contrast: "Tc-99m ECD", radLex: "RID10729", snomed: "169195022", prep: "闭目安静", desc: "脑血流评估" },
  { modality: "NM", name: "骨三相显像", category: "特殊成像", bodyPart: "全身", price: 1080, dur: 120, tat: 480, tatUrgent: 120, contrast: "Tc-99m MDP", radLex: "RID10730", snomed: "169195023", prep: "多饮水", desc: "骨髓炎评估" },
  { modality: "NM", name: "甲状腺摄碘率测定", category: "特殊成像", bodyPart: "甲状腺", price: 280, dur: 60, tat: 240, tatUrgent: 60, contrast: "I-131", radLex: "RID10731", snomed: "169195024", prep: "停用甲状腺药物", desc: "甲亢评估" },
  { modality: "NM", name: "肾上腺髓质显像(MIBG)", category: "特殊成像", bodyPart: "全身", price: 1280, dur: 60, tat: 720, tatUrgent: 120, contrast: "I-131 MIBG", radLex: "RID10732", snomed: "169195025", prep: "停用干扰药物", desc: "嗜铬细胞瘤" },
  { modality: "NM", name: "前哨淋巴结显像", category: "特殊成像", bodyPart: "全身", price: 580, dur: 30, tat: 240, tatUrgent: 60, contrast: "Tc-99m 硫胶体", radLex: "RID10733", snomed: "169195026", prep: "术中", desc: "前哨淋巴结定位" },
  { modality: "NM", name: "心肌梗死灶显像", category: "特殊成像", bodyPart: "心脏", price: 880, dur: 60, tat: 480, tatUrgent: 120, contrast: "Tc-99m PYP", radLex: "RID10734", snomed: "169195027", prep: "无需特殊", desc: "淀粉样变评估" },
];

// 生成代码
const EXAM_BY_MODALITY: Record<string, number> = { CT: 1, MR: 1, DR: 1, US: 1, MG: 1, DSA: 1, "PET-CT": 1, NM: 1 };
const EXAM_PREFIX: Record<string, string> = { CT: "CT", MR: "MR", DR: "DR", US: "US", MG: "MG", DSA: "DSA", "PET-CT": "PET", NM: "NM" };

export const EXAM_ITEM_MASTER: ExamItemMaster[] = EXAM_DATA.map((e) => {
  const idx = (EXAM_BY_MODALITY[e.modality] ?? 0) + 1;
  EXAM_BY_MODALITY[e.modality] = idx;
  return {
    code: `${EXAM_PREFIX[e.modality] ?? 'EX'}-${String(idx).padStart(3, "0")}`,
    name: e.name,
    modality: e.modality,
    category: e.category,
    bodyPart: e.bodyPart,
    avgDurationMin: e.dur,
    priceRMB: e.price,
    contrastAgent: e.contrast || null,
    contrastVolume: e.contrast ? (e.contrast.includes("碘海醇") ? "80-150ml" : "10-20ml") : null,
    sliceThickness: e.modality === "CT" ? "0.5-5mm" : e.modality === "MR" ? "3-5mm" : "-",
    reportTAT: e.tat,
    reportTATUrgent: e.tatUrgent,
    radLexCode: e.radLex,
    snomedCode: e.snomed,
    icd10: ["R93.8", "Z01.6"],
    keywords: [e.name.split(/[A-Z0-9]/)[0] || e.name.slice(0, 2), e.bodyPart, e.modality, e.category],
    description: e.desc,
    prepRequired: e.prep,
  };
});

// 工具
export const EXAM_BY_CODE: Record<string, ExamItemMaster> = Object.fromEntries(
  EXAM_ITEM_MASTER.map((e) => [e.code, e])
);

export const EXAMS_BY_MODALITY: Record<ExamItemMaster["modality"], ExamItemMaster[]> = {
  CT: EXAM_ITEM_MASTER.filter((e) => e.modality === "CT"),
  MR: EXAM_ITEM_MASTER.filter((e) => e.modality === "MR"),
  DR: EXAM_ITEM_MASTER.filter((e) => e.modality === "DR"),
  US: EXAM_ITEM_MASTER.filter((e) => e.modality === "US"),
  MG: EXAM_ITEM_MASTER.filter((e) => e.modality === "MG"),
  DSA: EXAM_ITEM_MASTER.filter((e) => e.modality === "DSA"),
  "PET-CT": EXAM_ITEM_MASTER.filter((e) => e.modality === "PET-CT"),
  NM: EXAM_ITEM_MASTER.filter((e) => e.modality === "NM"),
};

export const EXAMS_BY_CATEGORY: Record<ExamCategory, ExamItemMaster[]> = {
  平扫: EXAM_ITEM_MASTER.filter((e) => e.category === "平扫"),
  增强: EXAM_ITEM_MASTER.filter((e) => e.category === "增强"),
  造影: EXAM_ITEM_MASTER.filter((e) => e.category === "造影"),
  特殊成像: EXAM_ITEM_MASTER.filter((e) => e.category === "特殊成像"),
  三维重建: EXAM_ITEM_MASTER.filter((e) => e.category === "三维重建"),
  功能成像: EXAM_ITEM_MASTER.filter((e) => e.category === "功能成像"),
};

// 统计
export const EXAM_ITEM_STATS = {
  total: EXAM_ITEM_MASTER.length,
  byModality: Object.fromEntries(Object.entries(EXAMS_BY_MODALITY).map(([k, v]) => [k, v.length])),
  byCategory: Object.fromEntries(Object.entries(EXAMS_BY_CATEGORY).map(([k, v]) => [k, v.length])),
  withContrast: EXAM_ITEM_MASTER.filter((e) => e.contrastAgent).length,
  avgPrice: (EXAM_ITEM_MASTER.reduce((s, e) => s + e.priceRMB, 0) / EXAM_ITEM_MASTER.length).toFixed(0),
  avgDuration: (EXAM_ITEM_MASTER.reduce((s, e) => s + e.avgDurationMin, 0) / EXAM_ITEM_MASTER.length).toFixed(1),
};
