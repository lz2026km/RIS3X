/**
 * G005 放射RIS系统 v3.0.6.11-101 - 模板库 V2 (Wave 7B, F13, 孤儿模块)
 *
 * 能力:
 *  1. 模板分类树: 检查类型(模态)/科室/用途 三轴分类树
 *  2. 标签体系 + 搜索 (关键词/标签/模态/科室/用途/部位)
 *  3. 模板推荐: 确定性评分 = 使用频率×40 + 时效衰减×30 + 分类匹配 (模态20/科室15/用途10/标签4/部位5)
 *  4. 使用统计: 使用次数/采纳率(使用/展示)/最近使用 + 收藏管理
 *  5. 模板复制 / 导入导出 (JSON 序列化)
 *
 * 孤儿模块模式 + seed 回退: 不注册进 app.module, spec 直接注入测试;
 * DB 可用时联动 auditLog, 不可用时纯内存 seed 仍可用 (内置 38 个放射模板)。
 */
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { currentTenantId } from '../../common/tenant/tenant-utils'

// ================= 类型 =================

export type TemplatePurposeV2 = 'STRUCTURED_REPORT' | 'FOLLOWUP' | 'URGENT' | 'CONTRAST' | 'PROCEDURE' | 'TECHNIQUE'
export type TemplateNodeTypeV2 = 'modality' | 'dept' | 'purpose'

export interface TemplateCategoryNodeV2 {
  key: string
  name: string
  nodeType: TemplateNodeTypeV2
  children?: TemplateCategoryNodeV2[]
}

export interface ReportTemplateLibraryItemV2 {
  id: string
  name: string
  modality: string
  dept: string
  purpose: TemplatePurposeV2
  bodyPart: string
  tags: string[]
  content: string
  isSystem: boolean
  sourceTemplateId?: string
  favoriteCount: number
  usageCount: number
  displayCount: number
  lastUsedAt?: string
  createdAt: string
  updatedAt: string
}

export interface TemplateUsageStatsV2 {
  templateId: string
  usageCount: number
  displayCount: number
  adoptionRate: number
  favoriteCount: number
  lastUsedAt?: string
  recentUsedDays: number
}

export interface TemplateRecommendationV2 {
  templateId: string
  score: number
  reason: string
  template: ReportTemplateLibraryItemV2
}

export interface TemplateSearchResultV2 {
  items: ReportTemplateLibraryItemV2[]
  total: number
}

export interface TemplateLibraryStatsV2 {
  total: number
  systemCount: number
  userCount: number
  totalUsage: number
  totalFavorites: number
  avgAdoptionRate: number
  byModality: Record<string, number>
  byDept: Record<string, number>
  byPurpose: Record<string, number>
}

export interface TemplateExportPayloadV2 {
  schemaVersion: number
  exportedAt: string
  templates: ReportTemplateLibraryItemV2[]
}

// ================= 常量 =================

export const PURPOSE_LABEL: Record<TemplatePurposeV2, string> = {
  STRUCTURED_REPORT: '常规报告',
  FOLLOWUP: '随访',
  URGENT: '危急',
  CONTRAST: '增强',
  PROCEDURE: '操作',
  TECHNIQUE: '技术',
}

const MODALITIES = ['CT', 'MR', 'DR', 'MG', 'US', 'DSA', 'PET', 'CR']
const DEPTS = ['放射科', '神经影像组', '乳腺影像组', '骨关节组', '腹部影像组', '心胸影像组', '介入放射科']
const PURPOSES: TemplatePurposeV2[] = ['STRUCTURED_REPORT', 'FOLLOWUP', 'URGENT', 'CONTRAST', 'PROCEDURE', 'TECHNIQUE']

// 确定性 seed 锚点: 所有相对时间都基于固定锚点, 保证推荐排序可复现
const SEED_ANCHOR_MS = new Date('2026-08-15T08:00:00.000Z').getTime()

// ================= 分类树 =================

function buildCategoryTree(): TemplateCategoryNodeV2[] {
  return [
    {
      key: 'modality', name: '检查类型', nodeType: 'modality',
      children: MODALITIES.map((m) => ({ key: `modality:${m}`, name: m, nodeType: 'modality' as const })),
    },
    {
      key: 'dept', name: '科室', nodeType: 'dept',
      children: DEPTS.map((d) => ({ key: `dept:${d}`, name: d, nodeType: 'dept' as const })),
    },
    {
      key: 'purpose', name: '用途', nodeType: 'purpose',
      children: PURPOSES.map((p) => ({ key: `purpose:${p}`, name: PURPOSE_LABEL[p], nodeType: 'purpose' as const })),
    },
  ]
}

// ================= Seed (38 个放射模板, 确定性) =================

interface SeedSpec {
  id: string
  name: string
  modality: string
  dept: string
  purpose: TemplatePurposeV2
  bodyPart: string
  tags: string[]
  content: string
  usageCount: number
  displayCount: number
  favoriteCount: number
  lastUsedDaysAgo: number
  createdDaysAgo: number
}

const TEMPLATE_SEED_SPECS: SeedSpec[] = [
  { id: 'tpl-001', name: '头颅CT平扫模板', modality: 'CT', dept: '放射科', purpose: 'STRUCTURED_REPORT', bodyPart: '头颅', tags: ['平扫', '脑实质', '常规'], usageCount: 186, displayCount: 310, favoriteCount: 24, lastUsedDaysAgo: 1, createdDaysAgo: 480,
    content: '头颅CT平扫: 脑实质内未见明确高密度或低密度灶, 灰白质分界清晰, 中线结构居中, 脑室系统大小形态正常, 各脑池未见异常, 颅骨未见明确骨折及骨质破坏。诊断意见: 头颅CT平扫未见明显异常。' },
  { id: 'tpl-002', name: '头颅CT增强模板', modality: 'CT', dept: '神经影像组', purpose: 'CONTRAST', bodyPart: '头颅', tags: ['增强', '占位', '脑膜'], usageCount: 96, displayCount: 180, favoriteCount: 12, lastUsedDaysAgo: 3, createdDaysAgo: 420,
    content: '头颅CT增强: 扫描范围内未见异常强化灶, 脑膜强化均匀, 脑实质强化未见异常, 双侧大脑半球对称。诊断意见: 头颅CT增强扫描未见明确异常强化。' },
  { id: 'tpl-003', name: '头颅CT灌注模板', modality: 'CT', dept: '神经影像组', purpose: 'STRUCTURED_REPORT', bodyPart: '头颅', tags: ['灌注', '脑缺血', 'CBF'], usageCount: 42, displayCount: 90, favoriteCount: 6, lastUsedDaysAgo: 9, createdDaysAgo: 360,
    content: '头颅CT灌注: 右侧大脑中动脉供血区 CBF/CBV 较对侧轻度减低, MTT/TTP 延长, 未见明确核心梗死区。诊断意见: 右侧大脑中动脉供血区灌注减低, 符合缺血性改变。' },
  { id: 'tpl-004', name: '胸部CT平扫模板', modality: 'CT', dept: '心胸影像组', purpose: 'STRUCTURED_REPORT', bodyPart: '胸部', tags: ['平扫', '肺', '常规'], usageCount: 245, displayCount: 420, favoriteCount: 31, lastUsedDaysAgo: 0, createdDaysAgo: 520,
    content: '胸部CT平扫: 双肺纹理清晰, 未见实变及肿块, 纵隔结构居中, 未见肿大淋巴结, 心影大小正常, 双侧胸腔未见积液, 胸廓诸骨未见骨质破坏。诊断意见: 胸部CT平扫未见明显异常。' },
  { id: 'tpl-005', name: '胸部CT低剂量肺癌筛查模板', modality: 'CT', dept: '心胸影像组', purpose: 'FOLLOWUP', bodyPart: '胸部', tags: ['低剂量', '筛查', '肺结节', '随访'], usageCount: 168, displayCount: 300, favoriteCount: 22, lastUsedDaysAgo: 2, createdDaysAgo: 380,
    content: '胸部CT低剂量筛查: 右肺上叶见磨玻璃结节影, 大小约0.8cm, 形态规则, 边界清晰, 余肺未见明确结节及实变。诊断意见: 右肺上叶磨玻璃结节 (Lung-RADS 3类), 建议6-12个月后复查。' },
  { id: 'tpl-006', name: '胸部CT增强模板', modality: 'CT', dept: '心胸影像组', purpose: 'CONTRAST', bodyPart: '胸部', tags: ['增强', '纵隔', '占位'], usageCount: 88, displayCount: 160, favoriteCount: 10, lastUsedDaysAgo: 5, createdDaysAgo: 350,
    content: '胸部CT增强: 前纵隔见软组织肿块影, 大小约4.2×3.1cm, 增强扫描轻度强化, 与心包分界欠清, 双肺未见明确转移灶。诊断意见: 前纵隔占位, 建议结合临床及病理进一步明确。' },
  { id: 'tpl-007', name: '腹部CT平扫模板', modality: 'CT', dept: '腹部影像组', purpose: 'STRUCTURED_REPORT', bodyPart: '腹部', tags: ['平扫', '肝胆胰脾', '常规'], usageCount: 152, displayCount: 270, favoriteCount: 18, lastUsedDaysAgo: 2, createdDaysAgo: 460,
    content: '腹部CT平扫: 肝脏形态大小正常, 密度均匀, 肝内外胆管未见扩张, 胆囊未见明确结石及增厚, 胰腺形态密度正常, 脾脏不大, 双肾大小形态正常, 未见结石及积水, 腹腔未见积液及游离气体。诊断意见: 腹部CT平扫未见明显异常。' },
  { id: 'tpl-008', name: '腹部CT增强三期模板', modality: 'CT', dept: '腹部影像组', purpose: 'CONTRAST', bodyPart: '腹部', tags: ['增强', '三期', '肝脏', '病灶'], usageCount: 79, displayCount: 150, favoriteCount: 9, lastUsedDaysAgo: 6, createdDaysAgo: 330,
    content: '腹部CT增强三期: 肝右叶见低密度病灶, 动脉期边缘结节样强化, 门脉期强化向中心填充, 延迟期呈稍高密度, 符合肝血管瘤表现。诊断意见: 肝右叶血管瘤, 建议定期随访。' },
  { id: 'tpl-009', name: '泌尿系CT平扫模板', modality: 'CT', dept: '腹部影像组', purpose: 'STRUCTURED_REPORT', bodyPart: '泌尿系', tags: ['平扫', '泌尿', '结石'], usageCount: 110, displayCount: 210, favoriteCount: 14, lastUsedDaysAgo: 4, createdDaysAgo: 400,
    content: '泌尿系CT平扫: 双肾大小形态正常, 左肾盂见类圆形高密度结石影, 大小约0.6cm, 左侧输尿管上段轻度扩张, 右肾及右侧输尿管未见明确结石及积水, 膀胱充盈良好, 壁未见增厚。诊断意见: 左肾结石伴左侧输尿管上段轻度扩张。' },
  { id: 'tpl-010', name: '腰椎CT平扫模板', modality: 'CT', dept: '骨关节组', purpose: 'STRUCTURED_REPORT', bodyPart: '腰椎', tags: ['平扫', '椎间盘', '椎管'], usageCount: 134, displayCount: 240, favoriteCount: 16, lastUsedDaysAgo: 3, createdDaysAgo: 440,
    content: '腰椎CT平扫: 腰椎生理曲度存在, L4/5、L5/S1椎间盘轻度膨出, 硬膜囊前缘轻度受压, 椎管无狭窄, 椎体骨质结构未见异常, 未见明确骨折及骨质破坏。诊断意见: L4/5、L5/S1椎间盘膨出, 建议结合临床症状。' },
  { id: 'tpl-011', name: '颈椎CT平扫模板', modality: 'CT', dept: '骨关节组', purpose: 'STRUCTURED_REPORT', bodyPart: '颈椎', tags: ['平扫', '颈椎', '骨质增生'], usageCount: 92, displayCount: 170, favoriteCount: 11, lastUsedDaysAgo: 7, createdDaysAgo: 410,
    content: '颈椎CT平扫: 颈椎曲度变直, C5/6、C6/7椎间盘轻度突出, 相应椎管前后径轻度变窄, 椎体边缘骨质增生, 未见明确骨折及脱位。诊断意见: 颈椎退行性改变伴C5/6、C6/7椎间盘突出。' },
  { id: 'tpl-012', name: '四肢关节CT模板', modality: 'CT', dept: '骨关节组', purpose: 'STRUCTURED_REPORT', bodyPart: '四肢', tags: ['关节', '骨折', '骨质'], usageCount: 65, displayCount: 130, favoriteCount: 7, lastUsedDaysAgo: 8, createdDaysAgo: 300,
    content: '右膝关节CT平扫: 股骨内侧髁见骨质断裂, 骨折线清晰, 无明显错位, 关节面平整, 关节间隙正常, 未见游离体。诊断意见: 右股骨内侧髁骨折, 无明显移位。' },
  { id: 'tpl-013', name: '头颅MR平扫模板', modality: 'MR', dept: '神经影像组', purpose: 'STRUCTURED_REPORT', bodyPart: '头颅', tags: ['平扫', '脑实质', 'T1WI'], usageCount: 178, displayCount: 320, favoriteCount: 26, lastUsedDaysAgo: 1, createdDaysAgo: 500,
    content: '头颅MR平扫: T1WI/T2WI脑实质信号未见异常, DWI未见弥散受限, 脑室系统大小形态正常, 中线结构居中, 脑沟脑裂无异常增宽, 小脑扁桃体位置正常。诊断意见: 头颅MR平扫未见明显异常。' },
  { id: 'tpl-014', name: '头颅MR增强模板', modality: 'MR', dept: '神经影像组', purpose: 'CONTRAST', bodyPart: '头颅', tags: ['增强', '肿瘤', '强化'], usageCount: 71, displayCount: 140, favoriteCount: 8, lastUsedDaysAgo: 6, createdDaysAgo: 340,
    content: '头颅MR增强: 左侧额叶见类圆形占位, T1WI低信号, T2WI高信号, 增强后明显强化, 周围水肿带明显, 占位效应致左侧脑室受压。诊断意见: 左侧额叶占位伴明显强化, 建议手术病理明确。' },
  { id: 'tpl-015', name: '颈椎MR平扫模板', modality: 'MR', dept: '骨关节组', purpose: 'STRUCTURED_REPORT', bodyPart: '颈椎', tags: ['平扫', '椎间盘', '脊髓'], usageCount: 104, displayCount: 190, favoriteCount: 13, lastUsedDaysAgo: 4, createdDaysAgo: 390,
    content: '颈椎MR平扫: 颈椎生理曲度变直, C5/6椎间盘突出, 压迫硬膜囊, 相应水平脊髓信号未见异常, 椎体及附件信号未见异常, 椎旁软组织未见异常。诊断意见: C5/6椎间盘突出, 脊髓未见明确压迫征象。' },
  { id: 'tpl-016', name: '腰椎MR平扫模板', modality: 'MR', dept: '骨关节组', purpose: 'STRUCTURED_REPORT', bodyPart: '腰椎', tags: ['平扫', '椎间盘', '神经根'], usageCount: 146, displayCount: 260, favoriteCount: 19, lastUsedDaysAgo: 2, createdDaysAgo: 450,
    content: '腰椎MR平扫: L4/5、L5/S1椎间盘突出, L5/S1水平右侧神经根受压, 椎管内未见占位, 马尾神经信号未见异常, 椎体骨髓信号未见异常。诊断意见: L4/5、L5/S1椎间盘突出伴右侧S1神经根受压。' },
  { id: 'tpl-017', name: '膝关节MR平扫模板', modality: 'MR', dept: '骨关节组', purpose: 'STRUCTURED_REPORT', bodyPart: '膝关节', tags: ['平扫', '半月板', '韧带'], usageCount: 121, displayCount: 230, favoriteCount: 15, lastUsedDaysAgo: 3, createdDaysAgo: 430,
    content: '右膝关节MR平扫: 内侧半月板后角见线状高信号, 达关节面, 符合半月板撕裂, 前交叉韧带形态信号未见异常, 关节腔少量积液, 骨髓信号未见异常。诊断意见: 右膝内侧半月板后角撕裂, 关节腔少量积液。' },
  { id: 'tpl-018', name: '肩关节MR平扫模板', modality: 'MR', dept: '骨关节组', purpose: 'STRUCTURED_REPORT', bodyPart: '肩关节', tags: ['平扫', '肩袖', '肌腱'], usageCount: 58, displayCount: 120, favoriteCount: 6, lastUsedDaysAgo: 10, createdDaysAgo: 280,
    content: '左肩关节MR平扫: 冈上肌腱止点处见部分撕裂, 肌腱内信号增高, 关节囊见少量积液, 肱骨头及关节盂未见异常信号。诊断意见: 左肩冈上肌腱部分撕裂, 肩关节少量积液。' },
  { id: 'tpl-019', name: '腹部MR平扫模板', modality: 'MR', dept: '腹部影像组', purpose: 'STRUCTURED_REPORT', bodyPart: '腹部', tags: ['平扫', '肝胆', '胰'], usageCount: 84, displayCount: 160, favoriteCount: 10, lastUsedDaysAgo: 5, createdDaysAgo: 370,
    content: '腹部MR平扫: 肝脏体积及信号未见异常, 肝内胆管未见扩张, 胆囊壁未见增厚, 胰腺实质信号未见异常, 胰管无扩张, 脾脏及双肾未见异常, 腹膜后未见肿大淋巴结。诊断意见: 腹部MR平扫未见明显异常。' },
  { id: 'tpl-020', name: '乳腺MR增强模板', modality: 'MR', dept: '乳腺影像组', purpose: 'CONTRAST', bodyPart: '乳腺', tags: ['增强', '乳腺', 'BI-RADS'], usageCount: 63, displayCount: 125, favoriteCount: 9, lastUsedDaysAgo: 7, createdDaysAgo: 320,
    content: '双乳MR增强: 左乳外上象限见不规则肿块, 大小约2.1×1.6cm, 增强后快速强化, 呈流出型曲线, DWI弥散受限, BI-RADS 4C类。诊断意见: 左乳外上象限占位, BI-RADS 4C类, 建议穿刺活检。' },
  { id: 'tpl-021', name: '胸部DR正侧位模板', modality: 'DR', dept: '心胸影像组', purpose: 'STRUCTURED_REPORT', bodyPart: '胸部', tags: ['正侧位', '肺', '常规'], usageCount: 232, displayCount: 400, favoriteCount: 28, lastUsedDaysAgo: 0, createdDaysAgo: 510,
    content: '胸部正侧位DR: 双肺纹理清晰, 肺野未见明确实变及肿块, 肺门影不大, 纵隔影无增宽, 心影大小形态正常, 双侧膈面光整, 肋膈角锐利, 胸廓诸骨未见异常。诊断意见: 胸部正侧位未见明显异常。' },
  { id: 'tpl-022', name: '腹部立卧位DR模板', modality: 'DR', dept: '腹部影像组', purpose: 'STRUCTURED_REPORT', bodyPart: '腹部', tags: ['立卧位', '急腹症', '肠梗阻'], usageCount: 76, displayCount: 145, favoriteCount: 8, lastUsedDaysAgo: 6, createdDaysAgo: 350,
    content: '腹部立卧位DR: 立位片示膈下未见游离气体, 中上腹见多个气液平面, 肠管扩张, 卧位片示小肠迂曲扩张。诊断意见: 小肠扩张伴气液平面, 符合肠梗阻征象, 建议结合临床。' },
  { id: 'tpl-023', name: '腰椎DR正侧位模板', modality: 'DR', dept: '骨关节组', purpose: 'STRUCTURED_REPORT', bodyPart: '腰椎', tags: ['正侧位', '腰椎', '退变'], usageCount: 118, displayCount: 220, favoriteCount: 14, lastUsedDaysAgo: 3, createdDaysAgo: 430,
    content: '腰椎正侧位DR: 腰椎生理曲度变直, 椎体边缘骨质增生, L5椎体轻度前滑, 各椎间隙未见明显变窄, 椎旁软组织未见异常。诊断意见: 腰椎退行性改变, L5椎体轻度滑脱。' },
  { id: 'tpl-024', name: '颈椎DR双斜位模板', modality: 'DR', dept: '骨关节组', purpose: 'STRUCTURED_REPORT', bodyPart: '颈椎', tags: ['双斜位', '颈椎', '椎间孔'], usageCount: 52, displayCount: 105, favoriteCount: 5, lastUsedDaysAgo: 11, createdDaysAgo: 290,
    content: '颈椎双斜位DR: 颈椎生理曲度变直, C5/6、C6/7椎间孔轻度变窄, 椎体边缘骨质增生, 未见明确骨折及脱位。诊断意见: 颈椎退变伴部分椎间孔轻度变窄。' },
  { id: 'tpl-025', name: '四肢DR平片模板', modality: 'DR', dept: '骨关节组', purpose: 'STRUCTURED_REPORT', bodyPart: '四肢', tags: ['平片', '骨折', '复查'], usageCount: 143, displayCount: 250, favoriteCount: 17, lastUsedDaysAgo: 2, createdDaysAgo: 440,
    content: '右桡骨远端正侧位DR: 桡骨远端骨折, 骨折线清晰, 对位对线良好, 未见明显移位及成角, 腕关节关系正常。诊断意见: 右桡骨远端骨折, 对位良好, 建议继续固定并定期复查。' },
  { id: 'tpl-026', name: '乳腺钼靶模板', modality: 'MG', dept: '乳腺影像组', purpose: 'STRUCTURED_REPORT', bodyPart: '乳腺', tags: ['钼靶', '乳腺', '常规'], usageCount: 98, displayCount: 185, favoriteCount: 12, lastUsedDaysAgo: 4, createdDaysAgo: 400,
    content: '双乳钼靶CC/MLO位: 双乳腺体呈致密型, 未见明确肿块、不对称致密及结构扭曲, 未见成簇钙化, 双侧腋窝未见肿大淋巴结, BI-RADS 1类。诊断意见: 双乳未见明确异常, BI-RADS 1类。' },
  { id: 'tpl-027', name: '乳腺钼靶BI-RADS随访模板', modality: 'MG', dept: '乳腺影像组', purpose: 'FOLLOWUP', bodyPart: '乳腺', tags: ['钼靶', 'BI-RADS', '钙化', '随访'], usageCount: 66, displayCount: 130, favoriteCount: 9, lastUsedDaysAgo: 6, createdDaysAgo: 330,
    content: '双乳钼靶复查: 右乳外上象限见成簇细小钙化, 范围较前无明显增大, 形态无变化, 余未见明确异常, 与2026年5月片对比无明显变化, BI-RADS 3类。诊断意见: 右乳成簇钙化, BI-RADS 3类, 建议6个月后复查。' },
  { id: 'tpl-028', name: '乳腺断层DBT模板', modality: 'MG', dept: '乳腺影像组', purpose: 'STRUCTURED_REPORT', bodyPart: '乳腺', tags: ['断层', 'DBT', '肿块'], usageCount: 47, displayCount: 95, favoriteCount: 6, lastUsedDaysAgo: 9, createdDaysAgo: 300,
    content: '双乳数字乳腺断层 (DBT): 左乳上方见不规则肿块影, 边界欠清, 断层各层显示清晰, 未见明确毛刺及钙化, BI-RADS 4A类。诊断意见: 左乳上方肿块, BI-RADS 4A类, 建议超声及穿刺活检。' },
  { id: 'tpl-029', name: '腹部超声模板', modality: 'US', dept: '腹部影像组', purpose: 'STRUCTURED_REPORT', bodyPart: '腹部', tags: ['超声', '肝胆胰脾', '常规'], usageCount: 137, displayCount: 255, favoriteCount: 15, lastUsedDaysAgo: 2, createdDaysAgo: 460,
    content: '腹部超声: 肝脏大小形态正常, 包膜光滑, 实质回声均匀, 肝内胆管无扩张, 胆囊大小正常, 壁光滑, 腔内未见异常回声, 胰腺形态回声正常, 脾脏不大, 双肾大小形态正常, 集合系统无分离。诊断意见: 腹部超声未见明显异常。' },
  { id: 'tpl-030', name: '甲状腺超声模板', modality: 'US', dept: '腹部影像组', purpose: 'STRUCTURED_REPORT', bodyPart: '甲状腺', tags: ['超声', '甲状腺', '结节'], usageCount: 89, displayCount: 175, favoriteCount: 11, lastUsedDaysAgo: 5, createdDaysAgo: 380,
    content: '甲状腺超声: 甲状腺形态大小正常, 峡部不厚, 右叶见低回声结节, 大小约0.9×0.7cm, 边界清晰, 形态规则, 内见少量血流信号, TI-RADS 3类, 左叶及峡部未见明确结节。诊断意见: 甲状腺右叶结节, TI-RADS 3类, 建议定期复查。' },
  { id: 'tpl-031', name: '心脏超声模板', modality: 'US', dept: '心胸影像组', purpose: 'STRUCTURED_REPORT', bodyPart: '心脏', tags: ['超声', '心脏', '射血分数'], usageCount: 73, displayCount: 140, favoriteCount: 8, lastUsedDaysAgo: 7, createdDaysAgo: 350,
    content: '经胸心脏超声: 左房内径轻度增大, 左室壁运动未见明确节段性减弱, 左室射血分数 (Simpson法) 58%, 各瓣膜形态活动未见异常, 未见明确反流, 心包未见积液。诊断意见: 左房轻度增大, 左室收缩功能正常。' },
  { id: 'tpl-032', name: '下肢动脉DSA操作模板', modality: 'DSA', dept: '介入放射科', purpose: 'PROCEDURE', bodyPart: '下肢', tags: ['DSA', '介入', '血管成形'], usageCount: 38, displayCount: 85, favoriteCount: 5, lastUsedDaysAgo: 12, createdDaysAgo: 260,
    content: '左下肢动脉DSA: 股动脉穿刺成功后造影示股浅动脉中段重度狭窄, 狭窄率约85%, 置入球囊行PTA并植入支架1枚, 术后造影示支架内血流通畅, 狭窄明显改善, 远端血管显影良好。诊断意见: 左股浅动脉PTA+支架成形术后血流通畅。' },
  { id: 'tpl-033', name: '冠脉CTA危急值模板', modality: 'CT', dept: '心胸影像组', purpose: 'URGENT', bodyPart: '心脏', tags: ['危急', '冠脉', 'CTA', '狭窄'], usageCount: 55, displayCount: 110, favoriteCount: 7, lastUsedDaysAgo: 8, createdDaysAgo: 310,
    content: '冠脉CTA: 左前降支近段见混合斑块, 管腔重度狭窄 (约85%), 右冠及回旋支见非钙化斑块, 管腔中度狭窄。危急值提示: 左前降支近段重度狭窄, 请立即联系临床医生, 建议急诊进一步评估。' },
  { id: 'tpl-034', name: '颅内出血危急值模板', modality: 'CT', dept: '神经影像组', purpose: 'URGENT', bodyPart: '头颅', tags: ['危急', '出血', '急诊'], usageCount: 61, displayCount: 120, favoriteCount: 8, lastUsedDaysAgo: 7, createdDaysAgo: 320,
    content: '头颅CT平扫: 右侧基底节区见大片高密度影, 大小约3.8×2.9cm, 周围可见低密度水肿带, 右侧脑室受压变形, 中线结构向对侧移位约0.6cm。危急值提示: 右侧基底节区脑出血并占位效应, 请立即通知临床急诊处理。' },
  { id: 'tpl-035', name: '肺栓塞危急值模板', modality: 'CT', dept: '心胸影像组', purpose: 'URGENT', bodyPart: '胸部', tags: ['危急', '肺栓塞', '肺动脉'], usageCount: 49, displayCount: 100, favoriteCount: 6, lastUsedDaysAgo: 10, createdDaysAgo: 300,
    content: '胸部CT肺动脉成像 (CTPA): 双侧肺动脉主干及左右肺动脉分支见多发充盈缺损, 右心室增大, 右心室/左心室比值约1.3, 双肺底见楔形高密度影。危急值提示: 双侧肺动脉栓塞伴右心负荷增加, 请立即联系临床并启动溶栓/抗凝流程。' },
  { id: 'tpl-036', name: '主动脉夹层危急值模板', modality: 'CT', dept: '心胸影像组', purpose: 'URGENT', bodyPart: '主动脉', tags: ['危急', '夹层', '主动脉'], usageCount: 44, displayCount: 92, favoriteCount: 5, lastUsedDaysAgo: 11, createdDaysAgo: 290,
    content: '主动脉CTA: 主动脉弓降部见内膜片, 真假腔显示清晰, 夹层累及降主动脉至腹主动脉, 真腔受压变窄, 升主动脉未见受累, 心包未见积液。危急值提示: Stanford B型主动脉夹层, 请立即联系临床, 控制血压心率并评估腔内治疗。' },
  { id: 'tpl-037', name: '骨折术后随访模板', modality: 'DR', dept: '骨关节组', purpose: 'FOLLOWUP', bodyPart: '四肢', tags: ['随访', '骨折', '内固定'], usageCount: 57, displayCount: 115, favoriteCount: 6, lastUsedDaysAgo: 8, createdDaysAgo: 270,
    content: '左胫腓骨骨折内固定术后复查DR: 钢板螺钉位置良好, 骨折线模糊, 可见骨痂生长, 对位对线良好, 未见内固定松动断裂。诊断意见: 左胫骨骨折内固定术后骨痂形成期, 愈合良好, 建议继续功能锻炼。' },
  { id: 'tpl-038', name: '术后腹部复查随访模板', modality: 'CT', dept: '腹部影像组', purpose: 'FOLLOWUP', bodyPart: '腹部', tags: ['随访', '术后', '肿瘤'], usageCount: 41, displayCount: 88, favoriteCount: 4, lastUsedDaysAgo: 12, createdDaysAgo: 250,
    content: '结肠癌术后随访腹部CT: 肝脏及腹膜后未见明确转移灶, 吻合口肠壁未见明显增厚, 腹腔未见积液及肿大淋巴结, 与2026年3月复查片对比未见新发病灶。诊断意见: 结肠癌术后改变, 未见明确复发及转移征象, 建议定期随访。' },
]

// ================= 内部工具 =================

function daysAgo(ms: number, days: number): string {
  return new Date(ms - days * 86400_000).toISOString()
}

function seedToItem(spec: SeedSpec): ReportTemplateLibraryItemV2 {
  return {
    id: spec.id,
    name: spec.name,
    modality: spec.modality,
    dept: spec.dept,
    purpose: spec.purpose,
    bodyPart: spec.bodyPart,
    tags: [...spec.tags],
    content: spec.content,
    isSystem: true,
    usageCount: spec.usageCount,
    displayCount: spec.displayCount,
    favoriteCount: spec.favoriteCount,
    lastUsedAt: daysAgo(SEED_ANCHOR_MS, spec.lastUsedDaysAgo),
    createdAt: daysAgo(SEED_ANCHOR_MS, spec.createdDaysAgo),
    updatedAt: daysAgo(SEED_ANCHOR_MS, Math.min(spec.lastUsedDaysAgo, spec.createdDaysAgo)),
  }
}

function cloneItem(t: ReportTemplateLibraryItemV2): ReportTemplateLibraryItemV2 {
  return { ...t, tags: [...t.tags] }
}

@Injectable()
export class TemplateLibraryV2Service {
  private readonly logger = new Logger(TemplateLibraryV2Service.name)

  private readonly templates: ReportTemplateLibraryItemV2[] = TEMPLATE_SEED_SPECS.map(seedToItem)

  // userId → Set<templateId>
  private readonly favorites = new Map<string, Set<string>>()
  // userId → [{ templateId, usedAt }]
  private readonly usageLog = new Map<string, { templateId: string; usedAt: string }[]>()

  private readonly idCounter = { n: 1000 }

  constructor(private readonly prisma: PrismaService) {}

  // ================= 分类树 =================

  getCategoryTree(): TemplateCategoryNodeV2[] {
    return buildCategoryTree()
  }

  // ================= 模板列表 / 搜索 =================

  listTemplates(filter?: { modality?: string; dept?: string; purpose?: string; keyword?: string }): ReportTemplateLibraryItemV2[] {
    let list = this.templates
    if (filter?.modality) list = list.filter((t) => t.modality === filter.modality)
    if (filter?.dept) list = list.filter((t) => t.dept === filter.dept)
    if (filter?.purpose) list = list.filter((t) => t.purpose === filter.purpose)
    if (filter?.keyword?.trim()) {
      const q = filter.keyword.trim().toLowerCase()
      list = list.filter((t) =>
        t.name.toLowerCase().includes(q) ||
        t.content.toLowerCase().includes(q) ||
        t.tags.some((tag) => tag.toLowerCase().includes(q)),
      )
    }
    return list.map(cloneItem)
  }

  search(query: {
    keyword?: string
    tags?: string[]
    modality?: string
    dept?: string
    purpose?: string
    bodyPart?: string
    page?: number
    pageSize?: number
  }): TemplateSearchResultV2 {
    let list = [...this.templates]
    const keyword = query.keyword?.trim()
    if (keyword) {
      const q = keyword.toLowerCase()
      list = list.filter((t) =>
        t.name.toLowerCase().includes(q) ||
        t.content.toLowerCase().includes(q) ||
        t.tags.some((tag) => tag.toLowerCase().includes(q)),
      )
    }
    if (query.tags?.length) list = list.filter((t) => query.tags!.some((tag) => t.tags.includes(tag)))
    if (query.modality) list = list.filter((t) => t.modality === query.modality)
    if (query.dept) list = list.filter((t) => t.dept === query.dept)
    if (query.purpose) list = list.filter((t) => t.purpose === query.purpose)
    if (query.bodyPart) list = list.filter((t) => t.bodyPart === query.bodyPart)
    const page = Math.max(1, query.page ?? 1)
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20))
    const total = list.length
    const items = list.slice((page - 1) * pageSize, page * pageSize).map(cloneItem)
    return { items, total }
  }

  getTemplate(id: string): ReportTemplateLibraryItemV2 {
    const t = this.templates.find((x) => x.id === id)
    if (!t) throw new NotFoundException(`模板 ${id} 不存在`)
    return cloneItem(t)
  }

  // ================= 推荐 (确定性评分) =================

  /**
   * 确定性评分: 频率 (usageCount/maxUsage × 40) + 时效 (最近使用 30×e^(-天数/30), 未使用 8)
   * + 分类匹配 (模态 50 / 科室 25 / 用途 15 / 标签重叠 5/个 / 部位 10)。
   * 分类匹配权重高于频率+时效上限 (70), 保证按检查类型/科室推荐时匹配模板优先。
   * 并列时按模板 id 升序, 保证任意调用排序一致。
   */
  recommend(query?: { modality?: string; dept?: string; purpose?: string; tags?: string[]; bodyPart?: string; limit?: number }): TemplateRecommendationV2[] {
    const limit = Math.min(Math.max(query?.limit ?? 6, 1), 20)
    const now = Date.now()
    const maxUsage = Math.max(1, ...this.templates.map((t) => t.usageCount))
    const scored: TemplateRecommendationV2[] = this.templates.map((t) => {
      const usageScore = (t.usageCount / maxUsage) * 40
      const recencyScore = t.lastUsedAt
        ? 30 * Math.exp(-Math.max(0, now - new Date(t.lastUsedAt).getTime()) / (30 * 86400_000))
        : 8
      let matchScore = 0
      const reasons: string[] = []
      if (query?.modality && t.modality === query.modality) {
        matchScore += 50
        reasons.push('模态匹配')
      }
      if (query?.dept && t.dept === query.dept) {
        matchScore += 25
        reasons.push('科室匹配')
      }
      if (query?.purpose && t.purpose === query.purpose) {
        matchScore += 15
        reasons.push('用途匹配')
      }
      if (query?.tags?.length) {
        const overlap = query.tags.filter((tag) => t.tags.includes(tag)).length
        if (overlap > 0) {
          matchScore += overlap * 5
          reasons.push(`标签匹配×${overlap}`)
        }
      }
      if (query?.bodyPart && t.bodyPart === query.bodyPart) {
        matchScore += 10
        reasons.push('部位匹配')
      }
      const score = Math.round((usageScore + recencyScore + matchScore) * 100) / 100
      return {
        templateId: t.id,
        score,
        reason: reasons.length ? reasons.join(' + ') : '通用推荐',
        template: cloneItem(t),
      }
    })
    scored.sort((a, b) => b.score - a.score || a.templateId.localeCompare(b.templateId))
    return scored.slice(0, limit)
  }

  // ================= 使用统计 / 收藏 =================

  recordUsage(id: string, usedBy?: string): ReportTemplateLibraryItemV2 {
    const t = this.templates.find((x) => x.id === id)
    if (!t) throw new NotFoundException(`模板 ${id} 不存在`)
    t.usageCount += 1
    t.lastUsedAt = new Date().toISOString()
    const user = usedBy || 'u-001'
    const log = this.usageLog.get(user) ?? []
    log.unshift({ templateId: id, usedAt: t.lastUsedAt })
    if (log.length > 100) log.length = 100
    this.usageLog.set(user, log)
    void this.persistUsage(id, usedBy)
    return cloneItem(t)
  }

  templateUsageStats(id: string): TemplateUsageStatsV2 {
    const t = this.templates.find((x) => x.id === id)
    if (!t) throw new NotFoundException(`模板 ${id} 不存在`)
    const recentUsedDays = t.lastUsedAt
      ? Math.max(0, Math.round((Date.now() - new Date(t.lastUsedAt).getTime()) / 86400_000))
      : -1
    return {
      templateId: t.id,
      usageCount: t.usageCount,
      displayCount: t.displayCount,
      adoptionRate: t.displayCount > 0 ? Math.round((t.usageCount / t.displayCount) * 1000) / 10 : 0,
      favoriteCount: t.favoriteCount,
      lastUsedAt: t.lastUsedAt,
      recentUsedDays,
    }
  }

  listUsageHistory(userId?: string): ReportTemplateLibraryItemV2[] {
    const user = userId || 'u-001'
    const log = this.usageLog.get(user) ?? []
    const seen = new Set<string>()
    const ordered: ReportTemplateLibraryItemV2[] = []
    for (const entry of log) {
      if (seen.has(entry.templateId)) continue
      seen.add(entry.templateId)
      const t = this.templates.find((x) => x.id === entry.templateId)
      if (t) ordered.push(cloneItem(t))
    }
    return ordered
  }

  toggleFavorite(id: string, userId?: string): { favorite: boolean; favoriteIds: string[] } {
    const t = this.templates.find((x) => x.id === id)
    if (!t) throw new NotFoundException(`模板 ${id} 不存在`)
    const user = userId || 'u-001'
    let set = this.favorites.get(user)
    if (!set) {
      set = new Set<string>()
      this.favorites.set(user, set)
    }
    if (set.has(id)) {
      set.delete(id)
      t.favoriteCount = Math.max(0, t.favoriteCount - 1)
      return { favorite: false, favoriteIds: Array.from(set) }
    }
    set.add(id)
    t.favoriteCount += 1
    return { favorite: true, favoriteIds: Array.from(set) }
  }

  listFavorites(userId?: string): ReportTemplateLibraryItemV2[] {
    const user = userId || 'u-001'
    const set = this.favorites.get(user) ?? new Set<string>()
    return this.templates.filter((t) => set.has(t.id)).map(cloneItem)
  }

  // ================= 复制 / 导入导出 (JSON 序列化) =================

  copyTemplate(id: string, copiedBy?: string): ReportTemplateLibraryItemV2 {
    const src = this.templates.find((x) => x.id === id)
    if (!src) throw new NotFoundException(`模板 ${id} 不存在`)
    const now = new Date().toISOString()
    const copy: ReportTemplateLibraryItemV2 = {
      id: `tpl-${String(this.idCounter.n++).padStart(4, '0')}`,
      name: `${src.name}（副本）`,
      modality: src.modality,
      dept: src.dept,
      purpose: src.purpose,
      bodyPart: src.bodyPart,
      tags: [...src.tags],
      content: src.content,
      isSystem: false,
      sourceTemplateId: src.id,
      favoriteCount: 0,
      usageCount: 0,
      displayCount: 0,
      createdAt: now,
      updatedAt: now,
    }
    this.templates.unshift(copy)
    void this.persistCreated(copy, copiedBy)
    return cloneItem(copy)
  }

  createTemplate(dto: {
    name: string
    modality?: string
    dept?: string
    purpose?: TemplatePurposeV2
    bodyPart?: string
    tags?: string[]
    content: string
    createdBy?: string
  }): ReportTemplateLibraryItemV2 {
    if (!dto.name?.trim()) throw new BadRequestException('模板名称不能为空')
    if (!dto.content?.trim()) throw new BadRequestException('模板内容不能为空')
    const now = new Date().toISOString()
    const item: ReportTemplateLibraryItemV2 = {
      id: `tpl-${String(this.idCounter.n++).padStart(4, '0')}`,
      name: dto.name.trim(),
      modality: dto.modality?.trim() || 'CT',
      dept: dto.dept?.trim() || '放射科',
      purpose: dto.purpose || 'STRUCTURED_REPORT',
      bodyPart: dto.bodyPart?.trim() || '通用',
      tags: [...(dto.tags ?? [])],
      content: dto.content.trim(),
      isSystem: false,
      favoriteCount: 0,
      usageCount: 0,
      displayCount: 0,
      createdAt: now,
      updatedAt: now,
    }
    this.templates.unshift(item)
    void this.persistCreated(item, dto.createdBy)
    return cloneItem(item)
  }

  exportTemplates(ids?: string[]): TemplateExportPayloadV2 {
    const list = ids?.length ? ids.map((id) => this.getTemplate(id)) : this.templates.map(cloneItem)
    return { schemaVersion: 1, exportedAt: new Date().toISOString(), templates: list }
  }

  /** 导入 JSON 序列化结果 (支持 { templates: [...] } 或裸数组), 返回成功导入数量 */
  importTemplates(json: string, importedBy?: string): { imported: number; ids: string[] } {
    let payload: unknown
    try {
      payload = JSON.parse(json)
    } catch {
      throw new BadRequestException('JSON 解析失败, 请检查导入文件格式')
    }
    const rawList = Array.isArray(payload)
      ? payload
      : payload && typeof payload === 'object' && Array.isArray((payload as { templates?: unknown }).templates)
        ? (payload as { templates: unknown[] }).templates
        : null
    if (!rawList) throw new BadRequestException('导入内容必须为模板数组或 { templates: [...] }')
    const imported: string[] = []
    for (const raw of rawList) {
      if (!raw || typeof raw !== 'object') continue
      const item = raw as Record<string, unknown>
      if (typeof item.name !== 'string' || !item.name.trim()) continue
      if (typeof item.content !== 'string' || !item.content.trim()) continue
      const now = new Date().toISOString()
      const created: ReportTemplateLibraryItemV2 = {
        id: `tpl-${String(this.idCounter.n++).padStart(4, '0')}`,
        name: (item.name as string).trim(),
        modality: typeof item.modality === 'string' ? item.modality : 'CT',
        dept: typeof item.dept === 'string' ? item.dept : '放射科',
        purpose: (typeof item.purpose === 'string' && PURPOSES.includes(item.purpose as TemplatePurposeV2) ? item.purpose : 'STRUCTURED_REPORT') as TemplatePurposeV2,
        bodyPart: typeof item.bodyPart === 'string' ? item.bodyPart : '通用',
        tags: Array.isArray(item.tags) ? item.tags.filter((t): t is string => typeof t === 'string').slice(0, 12) : [],
        content: (item.content as string).trim(),
        isSystem: false,
        sourceTemplateId: typeof item.id === 'string' ? item.id : undefined,
        favoriteCount: 0,
        usageCount: 0,
        displayCount: 0,
        createdAt: now,
        updatedAt: now,
      }
      this.templates.unshift(created)
      imported.push(created.id)
    }
    if (imported.length === 0) throw new BadRequestException('导入内容中无有效模板')
    void this.persistImport(imported, importedBy)
    return { imported: imported.length, ids: imported }
  }

  // ================= 统计 =================

  stats(): TemplateLibraryStatsV2 {
    const byModality: Record<string, number> = {}
    const byDept: Record<string, number> = {}
    const byPurpose: Record<string, number> = {}
    let totalUsage = 0
    let totalFavorites = 0
    let adoptionSum = 0
    for (const t of this.templates) {
      byModality[t.modality] = (byModality[t.modality] ?? 0) + 1
      byDept[t.dept] = (byDept[t.dept] ?? 0) + 1
      byPurpose[t.purpose] = (byPurpose[t.purpose] ?? 0) + 1
      totalUsage += t.usageCount
      totalFavorites += t.favoriteCount
      adoptionSum += t.displayCount > 0 ? t.usageCount / t.displayCount : 0
    }
    return {
      total: this.templates.length,
      systemCount: this.templates.filter((t) => t.isSystem).length,
      userCount: this.templates.filter((t) => !t.isSystem).length,
      totalUsage,
      totalFavorites,
      avgAdoptionRate: this.templates.length ? Math.round((adoptionSum / this.templates.length) * 1000) / 10 : 0,
      byModality,
      byDept,
      byPurpose,
    }
  }

  // ================= 内部 (DB 联动, 不可用时 seed 回退) =================

  private async persistCreated(t: ReportTemplateLibraryItemV2, by?: string): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          action: 'TEMPLATE_LIBRARY_V2_CREATE',
          resource: 'template-library-v2',
          resourceId: t.id,
          detail: { name: t.name, modality: t.modality, dept: t.dept, by: by ?? 'current-user' } as never,
          tenantId: currentTenantId(),
        },
      })
    } catch (err) {
      this.logger.debug(`[TemplateLibraryV2] persist skipped: ${(err as Error).message}`)
    }
  }

  private async persistUsage(id: string, usedBy?: string): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          action: 'TEMPLATE_LIBRARY_V2_USE',
          resource: 'template-library-v2',
          resourceId: id,
          detail: { usedBy: usedBy ?? 'u-001' } as never,
          tenantId: currentTenantId(),
        },
      })
    } catch (err) {
      this.logger.debug(`[TemplateLibraryV2] persist skipped: ${(err as Error).message}`)
    }
  }

  private async persistImport(ids: string[], by?: string): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          action: 'TEMPLATE_LIBRARY_V2_IMPORT',
          resource: 'template-library-v2',
          resourceId: ids.join(','),
          detail: { count: ids.length, by: by ?? 'current-user' } as never,
          tenantId: currentTenantId(),
        },
      })
    } catch (err) {
      this.logger.debug(`[TemplateLibraryV2] persist skipped: ${(err as Error).message}`)
    }
  }
}
