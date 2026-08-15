// ============================================================
// G005 放射科RIS系统 v3.0.6.11-99 Wave 10E-2 - 质量指标库（质控 KPI）
// 40 个放射科质控指标：结构 / 过程 / 结果 三类（参照《放射诊疗质量控制规范》）
// 供质控看板、绩效统计与预警规则使用（与 qualityStandards / qualityScoring 互补）
// ============================================================

export type QICategory = '结构' | '过程' | '结果';

export interface QualityIndicator {
  /** 指标编码（QI-XXX） */
  code: string;
  /** 指标名称 */
  name: string;
  /** 指标类别（结构/过程/结果） */
  category: QICategory;
  /** 计算公式 */
  formula: string;
  /** 目标值 */
  target: string;
  /** 统计频率 */
  frequency: string;
  /** 责任人（科室岗位） */
  responsible: string;
  /** 告警阈值（低于/高于即触发预警） */
  threshold: string;
}

export const QUALITY_INDICATORS: QualityIndicator[] = [
  // ============================================================
  // 一、结构类指标（10 条）——设备、人员、制度等基础条件
  // ============================================================
  {
    code: 'QI-S01',
    name: '大型设备年检合格率',
    category: '结构',
    formula: '年检合格设备台数 / 在册大型设备台数 × 100%',
    target: '100%',
    frequency: '每年',
    responsible: '设备科 / 技师长',
    threshold: '<100% 立即停机整改',
  },
  {
    code: 'QI-S02',
    name: '设备日常质控执行率',
    category: '结构',
    formula: '实际执行质控次数 / 应执行质控次数 × 100%',
    target: '≥98%',
    frequency: '每月',
    responsible: '技师长',
    threshold: '<95% 触发预警',
  },
  {
    code: 'QI-S03',
    name: '放射工作人员持证上岗率',
    category: '结构',
    formula: '持有效上岗证人数 / 在岗放射工作人员数 × 100%',
    target: '100%',
    frequency: '每季度',
    responsible: '人事科 / 科主任',
    threshold: '<100% 禁止独立上岗',
  },
  {
    code: 'QI-S04',
    name: '个人剂量监测覆盖率',
    category: '结构',
    formula: '佩戴个人剂量计人数 / 应佩戴放射人员数 × 100%',
    target: '100%',
    frequency: '每季度',
    responsible: '辐射防护小组',
    threshold: '<100% 触发预警',
  },
  {
    code: 'QI-S05',
    name: '防护用品配置达标率',
    category: '结构',
    formula: '达标机房数 / 机房总数 × 100%',
    target: '≥95%',
    frequency: '每年',
    responsible: '辐射防护小组',
    threshold: '<90% 触发整改',
  },
  {
    code: 'QI-S06',
    name: '检查室环境指标达标率',
    category: '结构',
    formula: '温湿度/洁净度达标天数 / 考核天数 × 100%',
    target: '≥95%',
    frequency: '每月',
    responsible: '技师组长',
    threshold: '<90% 触发预警',
  },
  {
    code: 'QI-S07',
    name: '危重患者抢救设备完好率',
    category: '结构',
    formula: '功能完好抢救设备数 / 抢救设备总数 × 100%',
    target: '100%',
    frequency: '每周',
    responsible: '护理组长',
    threshold: '<100% 当日检修',
  },
  {
    code: 'QI-S08',
    name: '制度流程文件完整率',
    category: '结构',
    formula: '已发布执行文件数 / 应建立文件总数 × 100%',
    target: '100%',
    frequency: '每年',
    responsible: '质控专员',
    threshold: '<100% 限期补齐',
  },
  {
    code: 'QI-S09',
    name: '介入手术授权合格率',
    category: '结构',
    formula: '获授权术者人数 / 应授权介入医师数 × 100%',
    target: '100%',
    frequency: '每年',
    responsible: '医务科 / 介入组长',
    threshold: '<100% 禁止独立手术',
  },
  {
    code: 'QI-S10',
    name: '岗位培训完成率',
    category: '结构',
    formula: '完成年度培训人次 / 应培训人次 × 100%',
    target: '≥95%',
    frequency: '每年',
    responsible: '教学秘书',
    threshold: '<90% 触发预警',
  },
  // ============================================================
  // 二、过程类指标（18 条）——检查、报告、防护等流程执行质量
  // ============================================================
  {
    code: 'QI-P01',
    name: '检查申请单规范率',
    category: '过程',
    formula: '规范申请单数 / 申请单总数 × 100%',
    target: '≥98%',
    frequency: '每月',
    responsible: '预约登记组长',
    threshold: '<95% 触发预警',
  },
  {
    code: 'QI-P02',
    name: '急诊检查 30 分钟完成率',
    category: '过程',
    formula: '30 分钟内完成检查例数 / 急诊检查总例数 × 100%',
    target: '≥95%',
    frequency: '每月',
    responsible: '急诊技师组长',
    threshold: '<90% 触发预警',
  },
  {
    code: 'QI-P03',
    name: '平诊检查预约等候时间',
    category: '过程',
    formula: 'Σ(检查时间-预约时间) / 平诊检查总例数（中位数）',
    target: '≤48 小时',
    frequency: '每月',
    responsible: '预约登记组长',
    threshold: '>72 小时 触发预警',
  },
  {
    code: 'QI-P04',
    name: '检查部位与申请单符合率',
    category: '过程',
    formula: '部位符合例数 / 抽查总例数 × 100%',
    target: '≥99%',
    frequency: '每月',
    responsible: '审核技师',
    threshold: '<98% 触发预警',
  },
  {
    code: 'QI-P05',
    name: '扫描协议执行准确率',
    category: '过程',
    formula: '按协议执行例数 / 抽查总例数 × 100%',
    target: '≥98%',
    frequency: '每月',
    responsible: '技师长',
    threshold: '<95% 触发预警',
  },
  {
    code: 'QI-P06',
    name: '对比剂使用适应证符合率',
    category: '过程',
    formula: '符合适应证例数 / 增强检查总例数 × 100%',
    target: '≥98%',
    frequency: '每月',
    responsible: '值班医师',
    threshold: '<95% 触发预警',
  },
  {
    code: 'QI-P07',
    name: '对比剂不良反应上报率',
    category: '过程',
    formula: '实际上报例数 / 发生不良反应总例数 × 100%',
    target: '100%',
    frequency: '每月',
    responsible: '护理组长',
    threshold: '<100% 通报整改',
  },
  {
    code: 'QI-P08',
    name: '图像质量甲级片率',
    category: '过程',
    formula: '甲级片数 / 评价片总数 × 100%',
    target: '≥70%',
    frequency: '每月',
    responsible: '质控医师 / 技师长',
    threshold: '<60% 触发预警',
  },
  {
    code: 'QI-P09',
    name: '废片率',
    category: '过程',
    formula: '废片数 / 摄片总数 × 100%',
    target: '≤2%',
    frequency: '每月',
    responsible: '技师组长',
    threshold: '>3% 触发预警',
  },
  {
    code: 'QI-P10',
    name: '平诊报告 24 小时出具率',
    category: '过程',
    formula: '24 小时内出具报告例数 / 平诊报告总例数 × 100%',
    target: '≥95%',
    frequency: '每月',
    responsible: '报告组医师',
    threshold: '<90% 触发预警',
  },
  {
    code: 'QI-P11',
    name: '急诊报告 30 分钟出具率',
    category: '过程',
    formula: '30 分钟内出具报告例数 / 急诊报告总例数 × 100%',
    target: '≥95%',
    frequency: '每月',
    responsible: '急诊报告医师',
    threshold: '<90% 触发预警',
  },
  {
    code: 'QI-P12',
    name: '危急值报告及时率',
    category: '过程',
    formula: '规定时限内报告例数 / 危急值总例数 × 100%',
    target: '100%',
    frequency: '每月',
    responsible: '当班医师',
    threshold: '<100% 即查即改',
  },
  {
    code: 'QI-P13',
    name: '危急值报告记录完整率',
    category: '过程',
    formula: '记录完整例数 / 危急值总例数 × 100%',
    target: '≥98%',
    frequency: '每月',
    responsible: '当班医师',
    threshold: '<95% 触发预警',
  },
  {
    code: 'QI-P14',
    name: '报告审核率（双签名率）',
    category: '过程',
    formula: '双签名报告数 / 报告总例数 × 100%',
    target: '100%',
    frequency: '每月',
    responsible: '审核医师',
    threshold: '<100% 触发预警',
  },
  {
    code: 'QI-P15',
    name: '复查病例图像对比调阅率',
    category: '过程',
    formula: '调阅既往图像例数 / 复查总例数 × 100%',
    target: '≥90%',
    frequency: '每月',
    responsible: '报告医师',
    threshold: '<85% 触发预警',
  },
  {
    code: 'QI-P16',
    name: '患者防护用品佩戴率',
    category: '过程',
    formula: '规范佩戴防护用品例数 / 应佩戴例数 × 100%',
    target: '≥98%',
    frequency: '每月',
    responsible: '当班技师',
    threshold: '<95% 触发预警',
  },
  {
    code: 'QI-P17',
    name: '患者辐射剂量记录完整率',
    category: '过程',
    formula: '完整记录剂量例数 / 检查总例数 × 100%',
    target: '≥99%',
    frequency: '每月',
    responsible: '技师组长',
    threshold: '<98% 触发预警',
  },
  {
    code: 'QI-P18',
    name: '设备操作规范执行率（考核）',
    category: '过程',
    formula: '考核合格人次 / 考核总人次 × 100%',
    target: '≥98%',
    frequency: '每季度',
    responsible: '技师长',
    threshold: '<95% 需复训',
  },
  // ============================================================
  // 三、结果类指标（12 条）——诊断与服务的最终效果
  // ============================================================
  {
    code: 'QI-R01',
    name: '诊断与病理符合率',
    category: '结果',
    formula: '影像诊断与病理诊断符合例数 / 有病理对照总例数 × 100%',
    target: '≥90%',
    frequency: '每季度',
    responsible: '科主任',
    threshold: '<85% 触发专项分析',
  },
  {
    code: 'QI-R02',
    name: '影像诊断与手术符合率',
    category: '结果',
    formula: '与手术结果符合例数 / 有手术对照总例数 × 100%',
    target: '≥90%',
    frequency: '每季度',
    responsible: '科主任',
    threshold: '<85% 触发专项分析',
  },
  {
    code: 'QI-R03',
    name: '漏诊率（阳性病例）',
    category: '结果',
    formula: '漏诊阳性例数 / 应诊出阳性总例数 × 100%',
    target: '≤2%',
    frequency: '每季度',
    responsible: '质控医师',
    threshold: '>3% 触发预警',
  },
  {
    code: 'QI-R04',
    name: '误诊率',
    category: '结果',
    formula: '误诊例数 / 诊断总例数 × 100%',
    target: '≤1%',
    frequency: '每季度',
    responsible: '质控医师',
    threshold: '>2% 触发预警',
  },
  {
    code: 'QI-R05',
    name: '报告修改率（返修率）',
    category: '结果',
    formula: '被修改报告数 / 报告总例数 × 100%',
    target: '≤3%',
    frequency: '每月',
    responsible: '质控医师',
    threshold: '>5% 触发预警',
  },
  {
    code: 'QI-R06',
    name: '报告质量抽检评分达标率',
    category: '结果',
    formula: '抽检评分≥90 分报告数 / 抽检报告总数 × 100%',
    target: '≥90%',
    frequency: '每月',
    responsible: '质控小组',
    threshold: '<85% 触发预警',
  },
  {
    code: 'QI-R07',
    name: '患者投诉率',
    category: '结果',
    formula: '有效投诉例数 / 检查总例数 × 10000（每万例）',
    target: '≤1.5‰（万分之一点五）',
    frequency: '每月',
    responsible: '科主任',
    threshold: '>2‰ 触发预警',
  },
  {
    code: 'QI-R08',
    name: '患者满意度',
    category: '结果',
    formula: '满意及非常满意人次 / 调查总人次 × 100%',
    target: '≥95%',
    frequency: '每季度',
    responsible: '护士长',
    threshold: '<90% 触发整改',
  },
  {
    code: 'QI-R09',
    name: '检查取消率（因科室原因）',
    category: '结果',
    formula: '因科室原因取消例数 / 预约总例数 × 100%',
    target: '≤1%',
    frequency: '每月',
    responsible: '预约登记组长',
    threshold: '>2% 触发预警',
  },
  {
    code: 'QI-R10',
    name: '放射事件发生率',
    category: '结果',
    formula: '放射事件（事故/差错）发生起数',
    target: '0 起',
    frequency: '每月',
    responsible: '辐射防护小组',
    threshold: '>0 起 立即启动应急',
  },
  {
    code: 'QI-R11',
    name: '对比剂严重不良反应发生率',
    category: '结果',
    formula: '严重不良反应例数 / 增强检查总例数 × 10000',
    target: '≤1/万',
    frequency: '每季度',
    responsible: '护理组长',
    threshold: '>1/万 触发分析',
  },
  {
    code: 'QI-R12',
    name: '介入手术并发症发生率',
    category: '结果',
    formula: '并发症例数 / 介入手术总例数 × 100%',
    target: '≤5%',
    frequency: '每季度',
    responsible: '介入组长',
    threshold: '>8% 触发专项分析',
  },
];

// ============================================================
// 工具函数
// ============================================================

/** 按指标类别筛选（filter by category: 结构/过程/结果） */
export function filterIndicatorsByCategory(category: QICategory): QualityIndicator[] {
  return QUALITY_INDICATORS.filter((q) => q.category === category);
}

/** 按关键词检索指标（编码/名称/责任人，search by keyword） */
export function searchQualityIndicators(keyword: string): QualityIndicator[] {
  const kw = keyword.trim().toLowerCase();
  if (!kw) return QUALITY_INDICATORS;
  return QUALITY_INDICATORS.filter(
    (q) =>
      q.code.toLowerCase().includes(kw) ||
      q.name.toLowerCase().includes(kw) ||
      q.responsible.toLowerCase().includes(kw) ||
      q.formula.toLowerCase().includes(kw),
  );
}

/** 各类别指标统计（for quality dashboard overview） */
export function getIndicatorCategoryStats(): Array<{ category: QICategory; count: number; averageTarget: string }> {
  const categories: QICategory[] = ['结构', '过程', '结果'];
  return categories.map((category) => {
    const items = QUALITY_INDICATORS.filter((q) => q.category === category);
    const thresholdCount = items.filter((q) => q.threshold !== '0 起').length;
    return {
      category,
      count: items.length,
      averageTarget: `${items.length > 0 ? (thresholdCount / Math.max(items.length, 1)) * 100 : 0}% 达标线执行`,
    };
  });
}
