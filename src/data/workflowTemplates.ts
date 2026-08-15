/**
 * 检查流程模板库（Workflow Templates）
 * 供技师工作站、检查执行、流程培训参考
 */
export interface ExamWorkflowTemplate {
  code: string
  name: string
  modality: string
  bodyPart: string
  phases: {
    name: string
    steps: string[]
    checkpoints?: string[]
    durationMin: number
    responsible: string
  }[]
  qualityChecks: string[]
  commonErrors: string[]
  estimatedTotalMin: number
}

export const EXAM_WORKFLOW_TEMPLATES: ExamWorkflowTemplate[] = [
  {
    code: 'WFT-001',
    name: '头颅 CT 平扫流程',
    modality: 'CT',
    bodyPart: '颅脑',
    phases: [
      { name: '登记核对', steps: ['核对申请单/患者信息', '确认检查部位', '妊娠询问', '签署知情（必要时）'], durationMin: 5, responsible: '登记员' },
      { name: '摆位', steps: ['患者仰卧头先进', '头架固定，下颌内收', '外耳道连线与扫描基线平行', '定位像定位'], durationMin: 5, responsible: '技师' },
      { name: '扫描', steps: ['基线：眶耳线', '范围：颅顶至颅底', '层厚 5mm（后颅窝 3-5mm）', '参数：120kV/250-350mAs', '图像重建：软组织+骨算法'], durationMin: 10, responsible: '技师' },
      { name: '图像质控', steps: ['评估对称性/伪影', '确认颅底完整', '必要时补扫'], durationMin: 3, responsible: '技师' },
      { name: '报告', steps: ['影像归档', '医生书写报告', '审核发布'], durationMin: 30, responsible: '医生' },
    ],
    qualityChecks: ['对称性良好', '无运动伪影', '颅底结构完整', '窗宽窗位适宜'],
    commonErrors: ['头部倾斜导致不对称', '患者移动产生伪影', '扫描范围不足'],
    estimatedTotalMin: 53,
  },
  {
    code: 'WFT-002',
    name: '胸部 CT 增强流程',
    modality: 'CT',
    bodyPart: '胸部',
    phases: [
      { name: '登记核对', steps: ['核对申请单', '评估肾功能/过敏史', '禁食确认', '知情同意'], durationMin: 5, responsible: '登记员/护士' },
      { name: '静脉通路', steps: ['评估静脉', '留置 20G 留置针', '碘过敏试验（必要时）'], durationMin: 5, responsible: '护士' },
      { name: '摆位扫描', steps: ['仰卧头先进', '双臂上举', '定位像', '平扫定位病灶', '增强扫描（60-80ml，3ml/s，延迟 30-35s 动脉期/60-70s 静脉期）'], durationMin: 15, responsible: '技师' },
      { name: '图像质控', steps: ['评估增强时相', '确认病灶覆盖', '重建薄层'], durationMin: 3, responsible: '技师' },
      { name: '留观', steps: ['观察 30 分钟', '多饮水'], durationMin: 30, responsible: '护士' },
      { name: '报告', steps: ['书写报告', '审核发布'], durationMin: 40, responsible: '医生' },
    ],
    qualityChecks: ['动脉期肺动脉/主动脉强化', '无呼吸运动伪影', '对比剂无外渗'],
    commonErrors: ['注射时机不准', '呼吸指令不一致', '对比剂外渗'],
    estimatedTotalMin: 98,
  },
  {
    code: 'WFT-003',
    name: '腰椎 MRI 平扫流程',
    modality: 'MR',
    bodyPart: '腰椎',
    phases: [
      { name: '登记核对', steps: ['核对申请单', '体内植入物筛查', '幽闭恐惧评估', '禁食确认（增强时）'], durationMin: 5, responsible: '登记员' },
      { name: '摆位', steps: ['仰卧头先进', '腰垫支撑', '脊柱线圈', '定位：骶1-胸12'], durationMin: 5, responsible: '技师' },
      { name: '扫描序列', steps: ['矢状位 T1/T2', '矢状位 STIR', '轴位 T2（椎间盘层面）', '轴位 T1', '必要时增强'], durationMin: 25, responsible: '技师' },
      { name: '图像质控', steps: ['评估椎体覆盖', '确认序列完整', '伪影评估'], durationMin: 3, responsible: '技师' },
      { name: '报告', steps: ['书写报告', '审核发布'], durationMin: 30, responsible: '医生' },
    ],
    qualityChecks: ['矢状位覆盖胸12-骶1', '椎间盘层面轴位准确', '无运动伪影'],
    commonErrors: ['定位偏移漏椎体', '患者移动', '呼吸伪影（腹部）'],
    estimatedTotalMin: 68,
  },
  {
    code: 'WFT-004',
    name: '乳腺钼靶检查流程',
    modality: 'MG',
    bodyPart: '乳腺',
    phases: [
      { name: '登记核对', steps: ['核对申请单', '月经周期确认', '妊娠排除'], durationMin: 5, responsible: '登记员' },
      { name: '投照', steps: ['头尾位（CC）', '内外斜位（MLO）', '加压固定', '必要时追加点压/放大'], durationMin: 15, responsible: '技师' },
      { name: '图像质控', steps: ['评估乳腺组织覆盖', '确认乳头切线位', '无运动模糊'], durationMin: 3, responsible: '技师' },
      { name: '报告', steps: ['BI-RADS 分类', '书写报告', '审核发布'], durationMin: 20, responsible: '医生' },
    ],
    qualityChecks: ['乳腺组织完整显示', '乳头位于切线位', '曝光适当'],
    commonErrors: ['加压不足', '患者移动', '腋尾显示不全'],
    estimatedTotalMin: 43,
  },
  {
    code: 'WFT-005',
    name: '腹部超声检查流程',
    modality: '超声',
    bodyPart: '腹部',
    phases: [
      { name: '登记核对', steps: ['核对申请单', '空腹确认（8 小时）', '憋尿评估（必要时）'], durationMin: 5, responsible: '登记员' },
      { name: '扫查', steps: ['肝脏（左/右叶/门静脉）', '胆囊（充盈/壁/结石）', '胰腺（头体尾）', '脾脏', '双肾', '腹主动脉/下腔静脉'], durationMin: 20, responsible: '超声医生' },
      { name: '图像记录', steps: ['标准切面留存', '测量记录', '彩色多普勒（必要时）'], durationMin: 5, responsible: '超声医生' },
      { name: '报告', steps: ['即时书写报告', '打印'], durationMin: 10, responsible: '超声医生' },
    ],
    qualityChecks: ['胆囊充盈良好', '胰腺显示完整', '双肾测量准确'],
    commonErrors: ['未空腹（胆囊显示差）', '肠道气体干扰（胰腺）'],
    estimatedTotalMin: 40,
  },
  {
    code: 'WFT-006',
    name: 'PET-CT 全身检查流程',
    modality: 'PET-CT',
    bodyPart: '全身',
    phases: [
      { name: '预约准备', steps: ['禁食 4-6 小时', '血糖检测（<11.1）', '停用影响代谢药物', '多饮水'], durationMin: 15, responsible: '护士' },
      { name: '注射', steps: ['血糖确认', '18F-FDG 注射', '记录剂量/时间', '休息 45-60 分钟'], durationMin: 60, responsible: '护士/技师' },
      { name: '扫描', steps: ['排空膀胱', '仰卧定位', 'CT 定位像', '低剂量 CT（衰减校正）', 'PET 采集（6-7 床位）', '必要时延迟显像'], durationMin: 30, responsible: '技师' },
      { name: '图像处理', steps: ['重建', '融合', 'SUV 计算', '必要时追加延迟显像'], durationMin: 20, responsible: '技师' },
      { name: '报告', steps: ['PET/CT 融合阅片', 'SUVmax 测量', '书写报告', '审核发布'], durationMin: 60, responsible: '医生' },
    ],
    qualityChecks: ['血糖达标', '示踪剂摄取分布正常', '膀胱排空', '无运动伪影'],
    commonErrors: ['高血糖（摄取降低）', '寒冷刺激棕色脂肪', '膀胱放射性浓聚干扰'],
    estimatedTotalMin: 185,
  },
  {
    code: 'WFT-007',
    name: '骨密度（DXA）检查流程',
    modality: 'DXA',
    bodyPart: '腰椎/髋部',
    phases: [
      { name: '登记核对', steps: ['核对申请单', '停钙剂 24h 确认', '近期钡餐/核素排除'], durationMin: 5, responsible: '登记员' },
      { name: '测量', steps: ['腰椎 L1-L4 扫描', '股骨颈/全髋扫描', '必要时前臂'], durationMin: 10, responsible: '技师' },
      { name: '质控', steps: ['体模质控（每日）', '定位评估', 'T 值计算'], durationMin: 3, responsible: '技师' },
      { name: '报告', steps: ['T 值/骨量分类', '书写报告', '审核'], durationMin: 10, responsible: '医生' },
    ],
    qualityChecks: ['体模 QC 通过', '腰椎定位准确', '无椎体骨折干扰评估'],
    commonErrors: ['定位偏移', '植入物干扰', '钙剂未停'],
    estimatedTotalMin: 28,
  },
  {
    code: 'WFT-008',
    name: '上消化道钡餐流程',
    modality: 'DR',
    bodyPart: '食管/胃/十二指肠',
    phases: [
      { name: '登记核对', steps: ['核对申请单', '禁食 8-12h 确认', '肠梗阻排除'], durationMin: 5, responsible: '登记员' },
      { name: '检查', steps: ['硫酸钡调配', '站立位食管吞钡', '黏膜相', '充盈相', '加压相', '双对比相（产气粉）', '卧位观察', '十二指肠球部'], durationMin: 25, responsible: '医生/技师' },
      { name: '图像记录', steps: ['各体位标准影像', '测量记录'], durationMin: 5, responsible: '技师' },
      { name: '报告', steps: ['书写报告', '审核发布'], durationMin: 15, responsible: '医生' },
    ],
    qualityChecks: ['食管全程显示', '胃窦充盈良好', '双对比效果佳'],
    commonErrors: ['钡剂浓度不当', '患者未空腹', '蠕动过快'],
    estimatedTotalMin: 50,
  },
  {
    code: 'WFT-009',
    name: '冠脉 CTA 流程',
    modality: 'CT',
    bodyPart: '冠状动脉',
    phases: [
      { name: '登记核对', steps: ['核对申请单', '心率控制（<70bpm，必要时 β 阻滞剂）', '肾功能评估', '知情同意'], durationMin: 10, responsible: '护士/医生' },
      { name: '准备', steps: ['静脉通路（18G）', '硝酸甘油含服（无禁忌）', '屏气训练'], durationMin: 10, responsible: '护士' },
      { name: '扫描', steps: ['定位像', '钙化积分扫描', 'Bolus tracking 触发', '冠状动脉扫描（心电门控）', '必要时延迟'], durationMin: 15, responsible: '技师' },
      { name: '重建', steps: ['最佳时相选择', '冠脉树重建', '多平面/曲面重建', '狭窄评估'], durationMin: 20, responsible: '技师/医生' },
      { name: '报告', steps: ['CAD-RADS 分类', '书写报告', '审核发布'], durationMin: 30, responsible: '医生' },
    ],
    qualityChecks: ['心率稳定', '冠脉显示良好', '无呼吸运动伪影', '碘对比剂浓度适宜'],
    commonErrors: ['心率过快（图像模糊）', '屏气不一致', '对比剂时相不佳'],
    estimatedTotalMin: 85,
  },
  {
    code: 'WFT-010',
    name: '颈椎 MRI 检查流程',
    modality: 'MR',
    bodyPart: '颈椎',
    phases: [
      { name: '登记核对', steps: ['核对申请单', '植入物筛查', '幽闭评估'], durationMin: 5, responsible: '登记员' },
      { name: '摆位', steps: ['仰卧头先进', '颈线圈', '定位：枕骨-胸1'], durationMin: 5, responsible: '技师' },
      { name: '扫描序列', steps: ['矢状位 T1/T2', '矢状位 STIR', '轴位 T2（间盘层面）', '轴位 T1', '必要时增强'], durationMin: 20, responsible: '技师' },
      { name: '质控', steps: ['覆盖评估', '序列完整', '伪影评估'], durationMin: 3, responsible: '技师' },
      { name: '报告', steps: ['书写报告', '审核发布'], durationMin: 25, responsible: '医生' },
    ],
    qualityChecks: ['颈椎全程覆盖', '吞咽动作控制', '间盘层面轴位'],
    commonErrors: ['吞咽伪影', '定位偏移', '患者移动'],
    estimatedTotalMin: 58,
  },
  {
    code: 'WFT-011',
    name: '下肢静脉超声流程',
    modality: '超声',
    bodyPart: '下肢静脉',
    phases: [
      { name: '登记核对', steps: ['核对申请单', 'DVT 症状评估'], durationMin: 5, responsible: '登记员' },
      { name: '扫查', steps: ['股总静脉（横切加压）', '股浅/深静脉', '腘静脉', '小腿静脉（必要时）', '彩色多普勒', '频谱评估'], durationMin: 20, responsible: '超声医生' },
      { name: '图像记录', steps: ['标准切面', '加压前后对比', '血栓记录'], durationMin: 5, responsible: '超声医生' },
      { name: '报告', steps: ['书写报告', '审核'], durationMin: 10, responsible: '超声医生' },
    ],
    qualityChecks: ['全程加压检查', '彩色血流显示', '血栓位置明确'],
    commonErrors: ['加压不充分', '未扫小腿静脉'],
    estimatedTotalMin: 40,
  },
  {
    code: 'WFT-012',
    name: '全身骨显像（SPECT）流程',
    modality: 'SPECT',
    bodyPart: '全身骨骼',
    phases: [
      { name: '注射', steps: ['99mTc-MDP 注射（740-1110 MBq）', '记录剂量', '多饮水'], durationMin: 10, responsible: '护士/技师' },
      { name: '等待', steps: ['注射后等待 2-4 小时', '多饮水促排泄', '排空膀胱'], durationMin: 180, responsible: '患者/护士' },
      { name: '采集', steps: ['排空膀胱', '全身前后位扫描', '必要时 SPECT/CT 断层（可疑部位）'], durationMin: 20, responsible: '技师' },
      { name: '处理', steps: ['图像融合', '定量分析（必要时）'], durationMin: 10, responsible: '技师' },
      { name: '报告', steps: ['书写报告', '审核发布'], durationMin: 30, responsible: '医生' },
    ],
    qualityChecks: ['全身图像完整', '膀胱排空', '对称性评估'],
    commonErrors: ['膀胱放射性干扰', '患者移动', '注射外渗'],
    estimatedTotalMin: 250,
  },
  {
    code: 'WFT-013',
    name: '小肠 CT 造影流程',
    modality: 'CT',
    bodyPart: '小肠',
    phases: [
      { name: '肠道准备', steps: ['低渣饮食 1 天', '禁食 6 小时', '口服甘露醇/水 1500-2000ml（分次）'], durationMin: 60, responsible: '护士' },
      { name: '扫描', steps: ['静脉通路', '口服对比剂完成', '增强扫描（动脉/静脉/延迟）'], durationMin: 20, responsible: '技师' },
      { name: '重建', steps: ['MPR/CPR 重建', '小肠分段评估'], durationMin: 10, responsible: '技师/医生' },
      { name: '报告', steps: ['书写报告', '审核发布'], durationMin: 30, responsible: '医生' },
    ],
    qualityChecks: ['小肠充盈良好', '肠壁显示清晰', '无运动伪影'],
    commonErrors: ['口服量不足', '肠蠕动过快', '对比剂时相'],
    estimatedTotalMin: 120,
  },
  {
    code: 'WFT-014',
    name: '乳腺 MRI 动态增强流程',
    modality: 'MR',
    bodyPart: '乳腺',
    phases: [
      { name: '登记核对', steps: ['核对申请单', '月经周期（7-14 天最佳）', '植入物/幽闭筛查', '肾功能（增强）'], durationMin: 5, responsible: '登记员' },
      { name: '摆位', steps: ['俯卧乳腺线圈', '乳腺自然下垂', '定位'], durationMin: 5, responsible: '技师' },
      { name: '扫描', steps: ['平扫序列（T1/T2/STIR）', 'DWI', '动态增强（注射前 1 次+注射后 5-6 次，每期 60-90s）'], durationMin: 30, responsible: '技师' },
      { name: '处理', steps: ['减影', '时间信号曲线', '3D 重建'], durationMin: 10, responsible: '技师' },
      { name: '报告', steps: ['BI-RADS MRI 分类', '书写报告', '审核发布'], durationMin: 30, responsible: '医生' },
    ],
    qualityChecks: ['双侧对称', '曲线类型明确', '病灶强化显示'],
    commonErrors: ['呼吸运动伪影', '注射时机不准', '月经周期不佳'],
    estimatedTotalMin: 80,
  },
  {
    code: 'WFT-015',
    name: '脑血管 MRA 流程',
    modality: 'MR',
    bodyPart: '脑血管',
    phases: [
      { name: '登记核对', steps: ['核对申请单', '植入物筛查'], durationMin: 5, responsible: '登记员' },
      { name: '摆位', steps: ['仰卧头先进', '头线圈', '定位：Willis 环'], durationMin: 5, responsible: '技师' },
      { name: '扫描', steps: ['3D-TOF MRA', 'MIP 重建', '必要时增强 MRA', '颈动脉 MRA（必要时）'], durationMin: 15, responsible: '技师' },
      { name: '质控', steps: ['Willis 环显示', '远端血管显示'], durationMin: 3, responsible: '技师' },
      { name: '报告', steps: ['动脉瘤/狭窄评估', '书写报告', '审核'], durationMin: 20, responsible: '医生' },
    ],
    qualityChecks: ['Willis 环完整', '无运动伪影'],
    commonErrors: ['患者移动', '饱和带设置不当'],
    estimatedTotalMin: 48,
  },
]

export function findWorkflowsByModality(modality: string): ExamWorkflowTemplate[] {
  return EXAM_WORKFLOW_TEMPLATES.filter((w) => w.modality === modality)
}

export function findWorkflowByCode(code: string): ExamWorkflowTemplate | undefined {
  return EXAM_WORKFLOW_TEMPLATES.find((w) => w.code === code)
}

export function searchWorkflowTemplates(keyword: string): ExamWorkflowTemplate[] {
  const k = keyword.trim().toLowerCase()
  if (!k) return EXAM_WORKFLOW_TEMPLATES
  return EXAM_WORKFLOW_TEMPLATES.filter(
    (w) =>
      w.name.toLowerCase().includes(k) ||
      w.bodyPart.includes(k) ||
      w.modality.toLowerCase().includes(k) ||
      w.code.toLowerCase().includes(k),
  )
}

export const WORKFLOW_MODALITY_STATS: { modality: string; count: number }[] = [
  'CT',
  'MR',
  'DR',
  'MG',
  '超声',
  'PET-CT',
  'DXA',
  'SPECT',
].map((m) => ({
  modality: m,
  count: EXAM_WORKFLOW_TEMPLATES.filter((w) => w.modality === m).length,
}))
