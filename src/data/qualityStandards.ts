// ============================================================
// G005 放射科RIS系统 v3.0.6.11-99 Wave 10C - 质控标准库
// 图像质量评分（5维度×5级）/ 报告质量标准 / 检查流程质控点
// ============================================================

// ============================================================
// 1. 图像质量评分标准（5 维度 × 5 级）
// ============================================================

export type QualityDimension =
  | '定位准确性' | '扫描技术参数' | '图像清晰度' | '对比度与噪声' | '伪影控制';

export type QualityScore = 1 | 2 | 3 | 4 | 5;

export interface QualityLevel {
  score: QualityScore;
  /** 等级名称 */
  levelName: string;
  description: string;
  /** 是否合格 */
  acceptable: boolean;
}

export interface QualityDimensionDef {
  dimension: QualityDimension;
  /** 权重（0-1，合计1） */
  weight: number;
  /** 各等级描述 */
  levels: QualityLevel[];
}

export const IMAGE_QUALITY_DIMENSIONS: QualityDimensionDef[] = [
  {
    dimension: '定位准确性',
    weight: 0.25,
    levels: [
      { score: 1, levelName: '差', description: '扫描范围严重偏离目标部位，主要结构缺失，无法诊断', acceptable: false },
      { score: 2, levelName: '较差', description: '部分目标结构超出扫描范围，需局部补扫', acceptable: false },
      { score: 3, levelName: '一般', description: '目标部位基本包含，边缘结构略有遗漏，不影响主要诊断', acceptable: true },
      { score: 4, levelName: '良好', description: '扫描范围准确完整，定位线符合标准', acceptable: true },
      { score: 5, levelName: '优秀', description: '范围精准覆盖病灶，双侧对称，与申请单完全一致', acceptable: true },
    ],
  },
  {
    dimension: '扫描技术参数',
    weight: 0.2,
    levels: [
      { score: 1, levelName: '差', description: 'kV/mA/层厚等参数严重错误，图像无法使用', acceptable: false },
      { score: 2, levelName: '较差', description: '参数设置明显不当（如儿童误用成人剂量）', acceptable: false },
      { score: 3, levelName: '一般', description: '参数基本符合协议，个别细节欠妥', acceptable: true },
      { score: 4, levelName: '良好', description: '参数符合标准协议，重建方案完整（骨窗/软组织窗）', acceptable: true },
      { score: 5, levelName: '优秀', description: '按协议执行并针对个体优化（BMI/心率），重建序列齐全', acceptable: true },
    ],
  },
  {
    dimension: '图像清晰度',
    weight: 0.2,
    levels: [
      { score: 1, levelName: '差', description: '图像严重模糊，解剖结构无法辨认', acceptable: false },
      { score: 2, levelName: '较差', description: '整体模糊或部分序列模糊，细小结构不可见', acceptable: false },
      { score: 3, levelName: '一般', description: '主要结构清楚，细小结构（微小钙化/细支气管）显示欠佳', acceptable: true },
      { score: 4, levelName: '良好', description: '解剖结构清晰，细小结构可辨', acceptable: true },
      { score: 5, levelName: '优秀', description: '极高清图像，微细结构锐利（薄层重建质量佳）', acceptable: true },
    ],
  },
  {
    dimension: '对比度与噪声',
    weight: 0.2,
    levels: [
      { score: 1, levelName: '差', description: '噪声过大或对比度严重不足，病灶与周围无法区分', acceptable: false },
      { score: 2, levelName: '较差', description: '噪声明显或增强效果差（峰值强化<20HU）', acceptable: false },
      { score: 3, levelName: '一般', description: '常规层面可诊断，低对比结构显示一般', acceptable: true },
      { score: 4, levelName: '良好', description: '噪声可接受，增强各期强化满意（峰值>40HU）', acceptable: true },
      { score: 5, levelName: '优秀', description: '噪声低、对比度佳，强化时相精准', acceptable: true },
    ],
  },
  {
    dimension: '伪影控制',
    weight: 0.15,
    levels: [
      { score: 1, levelName: '差', description: '伪影致关键区域无法评估，需重扫', acceptable: false },
      { score: 2, levelName: '较差', description: '明显伪影干扰诊断（运动/金属/呼吸伪影）', acceptable: false },
      { score: 3, levelName: '一般', description: '轻度伪影，不影响主要诊断', acceptable: true },
      { score: 4, levelName: '良好', description: '伪影轻微，对诊断无影响', acceptable: true },
      { score: 5, levelName: '优秀', description: '无可见伪影，图像干净', acceptable: true },
    ],
  },
];

// ============================================================
// 2. 报告质量标准
// ============================================================

export type ReportQualityCategory =
  | '结构完整' | '术语规范' | '描述准确' | '诊断明确' | '及时性';

export interface ReportQualityItem {
  id: string;
  category: ReportQualityCategory;
  item: string;
  /** 质量标准要求 */
  standard: string;
  /** 评分点 */
  checkpoints: string[];
}

export const REPORT_QUALITY_STANDARDS: ReportQualityItem[] = [
  {
    id: 'RQ-01', category: '结构完整', item: '报告五要素齐全',
    standard: '患者信息、检查项目、技术参数、影像所见、诊断印象五要素完整',
    checkpoints: ['患者姓名/ID/年龄/性别与申请单一致', '检查方法、部位、对比剂情况完整', '所见段、印象段齐全'],
  },
  {
    id: 'RQ-02', category: '结构完整', item: '诊断印象分层明确',
    standard: '印象段需分层：主要诊断、次要发现、随访建议',
    checkpoints: ['主诊断放首位', '次要发现单列', '随访/复查建议明确'],
  },
  {
    id: 'RQ-03', category: '结构完整', item: '对比既往记录',
    standard: '有既往影像时应说明对比结果（有无变化）',
    checkpoints: ['标注对比时间', '描述病灶变化', '无既往资料时说明'],
  },
  {
    id: 'RQ-04', category: '术语规范', item: '规范术语使用',
    standard: '使用标准影像学术语（含RADS分级），避免口语化描述',
    checkpoints: ['使用标准解剖术语', 'RADS分类规范引用', '避免含糊表达（"好像""似乎"）'],
  },
  {
    id: 'RQ-05', category: '术语规范', item: '左右方位准确',
    standard: '左右、上下、前后方位描述准确且一致',
    checkpoints: ['方位词与图像一致', '多段重复时前后一致', '与临床信息交叉核对'],
  },
  {
    id: 'RQ-06', category: '术语规范', item: '测量规范',
    standard: '病灶需测量大小（三维径线）并标注单位',
    checkpoints: ['三维径线（mm）', '标注测量层面', '随访对比同一层面'],
  },
  {
    id: 'RQ-07', category: '描述准确', item: '所见与印象一致性',
    standard: '印象段结论须由所见段征象支持，不得出现前后矛盾',
    checkpoints: ['印象不超出现所见范围', '印象与所见相符', '不确定处注明依据'],
  },
  {
    id: 'RQ-08', category: '描述准确', item: '阴性结果完整描述',
    standard: '常规阴性结构应描述，避免漏报',
    checkpoints: ['常规部位阴性描述', '与检查目的相关结构全覆盖', '重要阴性（如无出血）明确'],
  },
  {
    id: 'RQ-09', category: '描述准确', item: '危急值报告记录',
    standard: '危急值（气胸、脑出血、主动脉夹层等）需记录电话通知时间及对象',
    checkpoints: ['危急值识别正确', '电话通知记录（时间/接听人）', '报告单标注危急值'],
  },
  {
    id: 'RQ-10', category: '诊断明确', item: '结论明确且可执行',
    standard: '印象段结论应明确诊断或给出合理鉴别诊断与建议',
    checkpoints: ['明确诊断给出', '不确定时给出鉴别', '给出下一步建议'],
  },
  {
    id: 'RQ-11', category: '诊断明确', item: '分级系统正确使用',
    standard: '肺结节用Lung-RADS、乳腺用BI-RADS、前列腺用PI-RADS等',
    checkpoints: ['分级系统选择正确', '分级依据充分', '随访建议与分级一致'],
  },
  {
    id: 'RQ-12', category: '及时性', item: '报告出具时限',
    standard: '急诊30分钟内、平诊2小时内、住院24小时内完成审核',
    checkpoints: ['急诊优先报告', '超时原因登记', '审核人签字'],
  },
  {
    id: 'RQ-13', category: '及时性', item: '审核与签署',
    standard: '住院医师报告须主治医师审核，急诊独立值班资格受限',
    checkpoints: ['双签制度', '审核修改留痕', '签名完整'],
  },
  {
    id: 'RQ-14', category: '结构完整', item: '申请单与报告闭环',
    standard: '报告需回应申请单的临床问题',
    checkpoints: ['临床问题针对性回答', '申请单信息核对', '异常结果随访'],
  },
];

// ============================================================
// 3. 检查流程质控点（登记/执行/影像/报告）
// ============================================================

export type WorkflowStage = '登记' | '执行' | '影像' | '报告' | '归档';

export interface QcCheckpoint {
  id: string;
  stage: WorkflowStage;
  item: string;
  /** 质控标准 */
  standard: string;
  /** 检查方式 */
  checkMethod: string;
  /** 责任角色 */
  responsible: string;
  /** 不合格处置 */
  onFailure: string;
}

export const WORKFLOW_QC_POINTS: QcCheckpoint[] = [
  // ---------- 登记环节 ----------
  { id: 'QC-R-01', stage: '登记', item: '申请单信息完整', standard: '患者身份、检查部位、临床诊断、检查目的齐全', checkMethod: '核对申请单与挂号信息', responsible: '登记员', onFailure: '退回临床补充' },
  { id: 'QC-R-02', stage: '登记', item: '身份核对', standard: '姓名+ID+出生日期双项核对', checkMethod: '询问+腕带/证件核对', responsible: '登记员', onFailure: '禁止检查，查明身份' },
  { id: 'QC-R-03', stage: '登记', item: '检查适应症审核', standard: '确认检查符合临床需要，无重复申请', checkMethod: '查询近期检查记录', responsible: '登记员/医师', onFailure: '与开单医师沟通确认' },
  { id: 'QC-R-04', stage: '登记', item: '禁忌症筛查', standard: '孕妇、对比剂禁忌、体内金属（MR）筛查', checkMethod: '问诊+筛查表', responsible: '登记员/技师', onFailure: '暂缓检查并报告医师' },
  { id: 'QC-R-05', stage: '登记', item: '知情同意（增强）', standard: '增强检查签署知情同意书', checkMethod: '检查签名及日期', responsible: '护士/医师', onFailure: '未签署禁止注射' },
  { id: 'QC-R-06', stage: '登记', item: '预约排程合理', standard: '按时段排程，急诊插队有优先级规则', checkMethod: '排程系统记录', responsible: '登记员', onFailure: '超时原因说明' },
  // ---------- 执行环节 ----------
  { id: 'QC-E-01', stage: '执行', item: '体位与定位', standard: '按协议标准体位，定位像符合解剖要求', checkMethod: '定位像核对', responsible: '技师', onFailure: '重扫定位像' },
  { id: 'QC-E-02', stage: '执行', item: '扫描协议选择', standard: '使用标准协议或个体化调整并记录', checkMethod: '协议核对+技师日志', responsible: '技师', onFailure: '按标准协议重新执行' },
  { id: 'QC-E-03', stage: '执行', item: '对比剂注射记录', standard: '对比剂种类/剂量/流速/注射时间记录完整', checkMethod: '检查记录单', responsible: '技师/护士', onFailure: '补录记录' },
  { id: 'QC-E-04', stage: '执行', item: '辐射防护', standard: '非检查部位铅衣防护；儿童/孕妇优先', checkMethod: '现场观察', responsible: '技师', onFailure: '纠正并记录' },
  { id: 'QC-E-05', stage: '执行', item: '患者沟通', standard: '告知检查流程、屏气指令，取得配合', checkMethod: '询问患者', responsible: '技师', onFailure: '强化沟通培训' },
  { id: 'QC-E-06', stage: '执行', item: '操作者资质', standard: '独立操作须持证上岗（大型设备上岗证）', checkMethod: '资质档案核对', responsible: '科主任', onFailure: '停止独立操作' },
  // ---------- 影像环节 ----------
  { id: 'QC-I-01', stage: '影像', item: '图像完整性', standard: '序列/期相齐全，符合申请要求', checkMethod: '图像清单核对', responsible: '技师/医师', onFailure: '补扫缺失序列' },
  { id: 'QC-I-02', stage: '影像', item: '图像质量初审', standard: '技师离机前初审：定位、伪影、呼吸伪影', checkMethod: '技师自查', responsible: '技师', onFailure: '立即重扫' },
  { id: 'QC-I-03', stage: '影像', item: '影像归档', standard: '图像按时归档PACS，DICOM完整性校验', checkMethod: 'PACS自动校验+人工抽查', responsible: '技师/信息员', onFailure: '重新传输' },
  { id: 'QC-I-04', stage: '影像', item: '危急征象识别', standard: '技师发现危急征象（大量气胸、脑出血等）即时上报医师', checkMethod: '危急值流程核查', responsible: '技师', onFailure: '按危急值处理流程执行' },
  { id: 'QC-I-05', stage: '影像', item: '剂量记录', standard: 'CT检查记录CTDIvol/DLP', checkMethod: '剂量报告核对', responsible: '技师', onFailure: '补录剂量数据' },
  // ---------- 报告环节 ----------
  { id: 'QC-P-01', stage: '报告', item: '报告时效', standard: '急诊30分钟、平诊2小时、住院24小时', checkMethod: '系统时限监控', responsible: '报告医师', onFailure: '超时原因登记上报' },
  { id: 'QC-P-02', stage: '报告', item: '双签审核', standard: '初级报告由上级医师审核签发', checkMethod: '审核记录', responsible: '审核医师', onFailure: '未审核不得签发' },
  { id: 'QC-P-03', stage: '报告', item: '报告与图像一致', standard: '报告描述病灶与图像所见相符', checkMethod: '抽样对比复核', responsible: '质控医师', onFailure: '退回修正' },
  { id: 'QC-P-04', stage: '报告', item: '危急值报告', standard: '发现危急值立即电话通知并记录', checkMethod: '危急值登记本+系统', responsible: '报告医师', onFailure: '按危急值制度处理' },
  { id: 'QC-P-05', stage: '报告', item: '报告退回率监控', standard: '月退回率<5%（描述与印象矛盾、漏项）', checkMethod: '质控统计', responsible: '质控组长', onFailure: '针对性培训' },
  // ---------- 归档环节 ----------
  { id: 'QC-A-01', stage: '归档', item: '报告发放', standard: '报告电子/纸质发放路径正确，患者可查询', checkMethod: '发放记录', responsible: '登记员', onFailure: '重发并注明' },
  { id: 'QC-A-02', stage: '归档', item: '胶片/光盘发放', standard: '按需打印，标签信息（姓名/ID/部位/日期）完整', checkMethod: '抽查', responsible: '登记员', onFailure: '重新打印' },
  { id: 'QC-A-03', stage: '归档', item: '资料保存期限', standard: '影像资料保存≥15年（X线片≥10年）', checkMethod: '归档系统核查', responsible: '信息员', onFailure: '备份补存' },
];

// ============================================================
// 4. 综合评分与统计函数
// ============================================================

export interface ImageQualityScoreInput {
  dimension: QualityDimension;
  score: QualityScore;
}

/** 计算图像质量加权总分（0-100） */
export function calcImageQualityTotal(scores: ImageQualityScoreInput[]): number {
  let total = 0;
  for (const def of IMAGE_QUALITY_DIMENSIONS) {
    const s = scores.find((x) => x.dimension === def.dimension);
    if (s) {
      total += (s.score / 5) * def.weight * 100;
    }
  }
  return Math.round(total);
}

/** 判定整体是否合格（任一维度<3即不合格） */
export function isImageQualityPass(scores: ImageQualityScoreInput[]): boolean {
  return scores.every((s) => s.score >= 3);
}

/** 获取某维度评分等级说明 */
export function getQualityLevel(
  dimension: QualityDimension,
  score: QualityScore,
): QualityLevel | undefined {
  const def = IMAGE_QUALITY_DIMENSIONS.find((d) => d.dimension === dimension);
  return def?.levels.find((l) => l.score === score);
}

/** 按环节获取质控点 */
export function getQcPointsByStage(stage: WorkflowStage): QcCheckpoint[] {
  return WORKFLOW_QC_POINTS.filter((p) => p.stage === stage);
}

/** 按类别获取报告质控标准 */
export function getReportQualityByCategory(
  category: ReportQualityCategory,
): ReportQualityItem[] {
  return REPORT_QUALITY_STANDARDS.filter((r) => r.category === category);
}

export const QUALITY_STANDARDS = {
  imageDimensions: IMAGE_QUALITY_DIMENSIONS,
  report: REPORT_QUALITY_STANDARDS,
  workflow: WORKFLOW_QC_POINTS,
};
