/** G005 眼科分级量表 Mock v3.0.6.8-23a — 11 套 */
import type { GradingScaleDefinition } from "../types/eye";

interface GradingScaleDefinitionV2 {
  id: string;
  name: string;
  abbreviation: string;
  levels: number;
  usedFor: string;
  source: string;
  isActive: boolean;
  lastUpdated: string;
}

const NOW = Date.now();

export const MOCK_GRADING_SCALES: (GradingScaleDefinition | GradingScaleDefinitionV2)[] = [
  {
    id: "gs-001",
    name: "DR国际分级",
    fullName: "糖尿病视网膜病变国际临床分级",
    category: "糖尿病视网膜病变",
    description: "基于眼底彩照的DR国际5级分类",
    options: [
      { grade: "0", value: 0, label: "无DR", description: "无视网膜病变可见" },
      {
        grade: "1",
        value: 1,
        label: "轻度NPDR",
        description: "仅微动脉瘤,无其他DR特征",
      },
      {
        grade: "2",
        value: 2,
        label: "中度NPDR",
        description: "微动脉瘤+出血/渗出/棉絮斑,未达重度",
      },
      {
        grade: "3",
        value: 3,
        label: "重度NPDR",
        description: "4-2-1规则:4象限出血/>2象限静脉串珠/≥1象限IRMA",
      },
      {
        grade: "4",
        value: 4,
        label: "增殖期DR(PDR)",
        description: "可见NVE/NVD/玻璃体积血/纤维增生",
      },
    ],
  },
  {
    id: "gs-002",
    name: "LOCS III",
    fullName: "Lens Opacities Classification System III",
    category: "白内障",
    description: "晶体混浊分级系统III",
    options: [
      {
        grade: "NO0-NO1",
        value: 0.5,
        label: "核透明/轻度",
        description: "核透明或极轻度硬化",
      },
      {
        grade: "NO2",
        value: 2,
        label: "核轻度混浊",
        description: "核轻度黄色混浊",
      },
      {
        grade: "NO3",
        value: 3,
        label: "核中轻度",
        description: "核黄色混浊加重",
      },
      { grade: "NO4", value: 4, label: "核中度", description: "核黄褐色混浊" },
      { grade: "NO5", value: 5, label: "核中重度", description: "核深黄褐色" },
      { grade: "NO6", value: 6, label: "核重度", description: "核棕褐色/黑色" },
      {
        grade: "C1-C2",
        value: 1.5,
        label: "皮质轻度",
        description: "皮质楔形混浊<2mm",
      },
      {
        grade: "C3-C4",
        value: 3.5,
        label: "皮质中度",
        description: "皮质混浊2-4mm",
      },
      { grade: "C5", value: 5, label: "皮质重度", description: "皮质混浊>4mm" },
      {
        grade: "P1-P2",
        value: 1.5,
        label: "后囊下轻度",
        description: "后囊下混浊<2mm",
      },
      {
        grade: "P3-P4",
        value: 3.5,
        label: "后囊下中度",
        description: "后囊下混浊2-4mm",
      },
      {
        grade: "P5",
        value: 5,
        label: "后囊下重度",
        description: "后囊下混浊>4mm",
      },
    ],
  },
  {
    id: "gs-003",
    name: "ISNT 规则",
    fullName: "Inferior > Superior > Nasal > Temporal Rim Width Rule",
    category: "青光眼",
    description: "盘沿宽度评估规则:下>上>鼻>颞",
    options: [
      {
        grade: "normal",
        value: 0,
        label: "正常(符合ISNT)",
        description: "盘沿宽度:下极>上极>鼻侧>颞侧",
      },
      {
        grade: "borderline",
        value: 1,
        label: "可疑(ISNT偏差)",
        description: "部分象限不符合ISNT规则",
      },
      {
        grade: "abnormal",
        value: 2,
        label: "异常(ISNT违反)",
        description: "完全违反ISNT规则,盘沿显著变薄",
      },
    ],
  },
  {
    id: "gs-004",
    name: "Kellogg 干眼分级",
    fullName: "Kellogg Dry Eye Grading System",
    category: "干眼",
    description: "综合干眼评估分级",
    options: [
      {
        grade: "0",
        value: 0,
        label: "正常",
        description: "TBUT>10s,角膜染色阴性,睑板腺正常",
      },
      {
        grade: "1",
        value: 1,
        label: "轻度干眼",
        description: "TBUT 5-10s,少量角膜下方点状染色,部分睑板腺缺失",
      },
      {
        grade: "2",
        value: 2,
        label: "中度干眼",
        description: "TBUT 2-5s,角膜弥漫点状染色,睑板腺显著缺失",
      },
      {
        grade: "3",
        value: 3,
        label: "重度干眼",
        description: "TBUT<2s,角膜大片融合染色,睑板腺严重萎缩",
      },
    ],
  },
  {
    id: "gs-005",
    name: "ETDRS 黄斑水肿分级",
    fullName: "Early Treatment Diabetic Retinopathy Study Macular Edema Grade",
    category: "黄斑水肿",
    description: "基于OCT的ETDRS 9区黄斑水肿分级",
    options: [
      {
        grade: "0",
        value: 0,
        label: "无DME",
        description: "黄斑区无明显增厚或渗出",
      },
      {
        grade: "1",
        value: 1,
        label: "轻度DME",
        description: "黄斑中心凹外增厚或硬性渗出",
      },
      {
        grade: "2",
        value: 2,
        label: "中度DME",
        description: "黄斑中心凹附近增厚或渗出,未累及中心凹",
      },
      {
        grade: "3",
        value: 3,
        label: "重度DME(CSME)",
        description: "中心凹增厚或500μm内伴有渗漏",
      },
    ],
  },
  { id: "gs-101", name: "DR 国际临床分级", abbreviation: "ICDR", levels: 5, usedFor: "糖尿病视网膜病变", source: "AAO 2017", isActive: true, lastUpdated: new Date(NOW - 86400000 * 90).toISOString() },
  { id: "gs-102", name: "AMD 分级 (干湿性)", abbreviation: "AMD-Type", levels: 3, usedFor: "年龄相关性黄斑变性", source: "AAO 2020", isActive: true, lastUpdated: new Date(NOW - 86400000 * 60).toISOString() },
  { id: "gs-103", name: "Hodapp-Anderson 视野分期", abbreviation: "H-A", levels: 5, usedFor: "青光眼视野缺损", source: "Anderson 1995", isActive: true, lastUpdated: new Date(NOW - 86400000 * 120).toISOString() },
  { id: "gs-104", name: "LOCS III 晶体浑浊分级", abbreviation: "LOCS-III", levels: 7, usedFor: "白内障分级", source: "Chylack 1993", isActive: true, lastUpdated: new Date(NOW - 86400000 * 180).toISOString() },
  { id: "gs-105", name: "Tbut 干眼分级", abbreviation: "TBUT", levels: 4, usedFor: "干眼泪膜稳定性", source: "DEWS II 2017", isActive: true, lastUpdated: new Date(NOW - 86400000 * 30).toISOString() },
  { id: "gs-106", name: "Amsler 网格 视野缺损", abbreviation: "Amsler", levels: 3, usedFor: "黄斑病变筛查", source: "Amsler 1947", isActive: true, lastUpdated: new Date(NOW - 86400000 * 200).toISOString() },

];
