/**
 * G005 放射RIS系统 v3.0.6.11-101 Wave 8A (report-search-v2) - 报告检索 V2 (自然语言 + 跨机构)
 *
 * 孤儿模块 (纯内存 + seed 回退, 无 DB 依赖, 可无 DB 启动):
 *   1. 检索: 关键词全文检索 + 结构化条件 (检查类型/时间范围/诊断关键词/医生) + 跨机构检索 (机构维度)
 *   2. 自然语言查询: 短语 → 条件解析 (确定性解析器, 无随机):
 *      - "近 3 个月肺结节阳性 CT 报告" → 时间范围 + 检查类型 + 诊断关键词 + 全文关键词
 *   3. 检索结果: 命中列表 (相关性排序, 0-100 确定性) + 高亮片段 (ranges 供前端 <mark>) + 聚合统计
 *
 * 端点:
 *   - POST /report-search-v2/search             结构化条件检索
 *   - POST /report-search-v2/natural-language    自然语言 → 条件 → 检索
 *   - GET  /report-search-v2/meta               下拉元数据 (模态/机构/医生/诊断关键词)
 *   - GET  /report-search-v2/stats              语料统计
 */
import { BadRequestException, Injectable } from '@nestjs/common'

// ================= 类型定义 =================

export interface SearchCondition {
  keyword?: string
  modality?: string
  dateFrom?: string
  dateTo?: string
  doctor?: string
  diagnosisKeyword?: string
  organization?: string
}

export interface HighlightRange {
  start: number
  end: number
}

export interface HighlightSnippet {
  field: string
  label: string
  text: string
  ranges: HighlightRange[]
}

export interface SearchHit {
  reportId: string
  patientId: string
  patientName: string
  examDate: string
  modality: string
  bodyPart: string
  doctorName: string
  organization: string
  conclusion: string
  isCritical: boolean
  relevance: number
  matchedKeywords: string[]
  snippets: HighlightSnippet[]
}

export interface ParsedCondition {
  key: string
  label: string
  value: string
}

export interface SearchAggregations {
  total: number
  byModality: Array<{ key: string; count: number }>
  byOrganization: Array<{ key: string; count: number }>
  byDoctor: Array<{ key: string; count: number }>
  byDiagnosis: Array<{ key: string; count: number }>
  dateRange: { from: string | null; to: string | null }
}

export interface SearchResult {
  items: SearchHit[]
  total: number
  aggregations: SearchAggregations
  source: string
}

export interface NaturalLanguageResult extends SearchResult {
  phrase: string
  conditions: SearchCondition
  parsed: ParsedCondition[]
}

export interface SearchMeta {
  modalities: string[]
  organizations: Array<{ name: string; count: number }>
  doctors: Array<{ name: string; count: number }>
  keywords: string[]
}

export interface SearchV2Stats {
  totalReports: number
  organizationCount: number
  byOrganization: Array<{ key: string; count: number }>
  byModality: Array<{ key: string; count: number }>
  criticalCount: number
  latestExamDate: string | null
  earliestExamDate: string | null
}

// ================= 常量与工具 =================

interface CorpusReport {
  id: string
  patientId: string
  patientName: string
  examDate: string
  modality: string
  bodyPart: string
  doctorId: string
  doctorName: string
  organization: string
  source: 'doctor' | 'ai'
  isCritical: boolean
  findings: string
  impression: string
  conclusion: string
  diagnosis: string
  recommendations: string
}

const MODALITY_ALIASES: Array<{ aliases: string[]; modality: string }> = [
  { aliases: ['ct'], modality: 'CT' },
  { aliases: ['mr', 'mri', '核磁', '磁共振'], modality: 'MR' },
  { aliases: ['dr', 'x线', 'x射线', '数字x线', '平片'], modality: 'DR' },
  { aliases: ['超声', 'b超', '彩超', 'us'], modality: 'US' },
  { aliases: ['mg', '钼靶', '乳腺钼靶'], modality: 'MG' },
  { aliases: ['pet', 'pet-ct', 'petct'], modality: 'PET-CT' },
  { aliases: ['dsa', '血管造影'], modality: 'DSA' },
]

/** 诊断关键词词典 (确定性解析器: 按词典顺序首个命中为 diagnosisKeyword) */
const DIAG_KEYWORDS = [
  '肺结节', '磨玻璃', '占位', '脑梗死', '出血', '骨折', '结石', '动脉瘤',
  '肺炎', '结核', '囊肿', '钙化', '纤维化', '胸腔积液', '气胸', '淋巴结',
  '斑片影', '条索影', '硬化', '肿瘤', '转移', '水肿', '阳性', '阴性',
]

const DATE_RE = /(\d{4})\s*年\s*(\d{1,2})?\s*月?/
const MONTHS_RE = /近\s*(\d+)\s*个?月/
const DAYS_RE = /近\s*(\d+)\s*天/
const WEEKS_RE = /近\s*(\d+)\s*周/
const YEARS_RE = /近\s*(\d+)\s*年/

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function addDays(d: Date, days: number): Date {
  const out = new Date(d.getTime())
  out.setDate(out.getDate() + days)
  return out
}

function addMonths(d: Date, months: number): Date {
  const out = new Date(d.getTime())
  const day = out.getDate()
  out.setMonth(out.getMonth() + months)
  if (out.getDate() !== day) out.setDate(0)
  return out
}

function lower(s: string): string {
  return (s ?? '').toLowerCase()
}

/** 语料全文池 (检索目标文本) */
function textPool(r: CorpusReport): string {
  return [r.findings, r.impression, r.conclusion, r.diagnosis, r.recommendations].join('\n')
}

/** 诊断词命中的权重上下文 (conclusion 权重最高) */
function diagnosisScore(r: CorpusReport, keyword: string): number {
  const kw = lower(keyword)
  let score = 0
  if (lower(r.conclusion).includes(kw) || lower(r.diagnosis).includes(kw)) score += 35
  if (lower(r.impression).includes(kw)) score += 20
  if (lower(r.findings).includes(kw)) score += 10
  return score
}

/** 关键词命中加权 (确定性): conclusion/diagnosis+15, impression+10, findings+8, recommendations+4, 重复×2 封顶 10 */
function keywordHitScore(r: CorpusReport, tokens: string[]): number {
  let score = 0
  for (const t of tokens) {
    const kw = lower(t)
    if (!kw) continue
    if (lower(r.conclusion).includes(kw) || lower(r.diagnosis).includes(kw)) score += 15
    if (lower(r.impression).includes(kw)) score += 10
    if (lower(r.findings).includes(kw)) score += 8
    if (lower(r.recommendations).includes(kw)) score += 4
    score += Math.min(10, 2 * (lower(r.conclusion).split(kw).length - 1))
  }
  return score
}

/** 时间新近度加分 (确定性, 无随机) */
function recencyScore(examDate: string, now: Date): number {
  if (!examDate) return 0
  const days = Math.floor((now.getTime() - new Date(`${examDate}T00:00:00`).getTime()) / 86400000)
  if (days <= 7) return 8
  if (days <= 30) return 5
  if (days <= 90) return 3
  if (days <= 365) return 1
  return 0
}

/**
 * 高亮片段: 在 field 文本中找每个 token 出现位置, 取 ±25 字窗口 (重叠合并),
 * 返回 { text, ranges } 供前端 <mark> 渲染。确定性 (按出现顺序扫描)。
 */
function buildSnippets(r: CorpusReport, tokens: string[], now: Date): HighlightSnippet[] {
  const fields: Array<{ key: string; label: string; text: string }> = [
    { key: 'conclusion', label: '诊断结论', text: r.conclusion },
    { key: 'impression', label: '印象', text: r.impression },
    { key: 'findings', label: '所见', text: r.findings },
  ]
  const snippets: HighlightSnippet[] = []
  void now
  for (const f of fields) {
    const text = f.text ?? ''
    if (!text) continue
    const hits: Array<{ start: number; end: number }> = []
    for (const t of tokens) {
      const kw = lower(t)
      if (!kw) continue
      let from = 0
      for (;;) {
        const idx = lower(text).indexOf(kw, from)
        if (idx < 0) break
        hits.push({ start: idx, end: idx + kw.length })
        from = idx + kw.length
        if (hits.length > 40) break
      }
    }
    if (hits.length === 0) continue
    hits.sort((a, b) => a.start - b.start)
    const windows: Array<{ start: number; end: number }> = []
    for (const h of hits) {
      const start = Math.max(0, h.start - 25)
      const end = Math.min(text.length, h.end + 25)
      const last = windows[windows.length - 1]
      if (last && start <= last.end) {
        last.end = Math.max(last.end, end)
      } else {
        windows.push({ start, end })
      }
    }
    for (const w of windows.slice(0, 3)) {
      const snippetText = text.slice(w.start, w.end)
      const ranges: HighlightRange[] = hits
        .filter((h) => h.start >= w.start && h.end <= w.end)
        .slice(0, 20)
        .map((h) => ({ start: h.start - w.start, end: h.end - w.start }))
      snippets.push({ field: f.key, label: f.label, text: snippetText, ranges })
    }
  }
  return snippets
}

// ================= 种子语料 (seed 回退) =================

const SEED_CORPUS: CorpusReport[] = [
  {
    id: 'RPS-000001',
    patientId: 'P-20001',
    patientName: '陈志强',
    examDate: '2026-08-10',
    modality: 'CT',
    bodyPart: '胸部',
    doctorId: 'D001',
    doctorName: '张海涛',
    organization: '中心医院',
    source: 'doctor',
    isCritical: false,
    findings: '双肺纹理清晰，右肺上叶见约 8mm 磨玻璃结节影，边界欠清。纵隔未见明显肿大淋巴结。',
    impression: '右肺上叶磨玻璃结节，考虑早期肺腺癌可能，建议随访。',
    conclusion: '右肺上叶磨玻璃结节（8mm），肺结节阳性，建议 3-6 个月随访复查。',
    diagnosis: '肺结节（磨玻璃）',
    recommendations: '3-6 个月后复查胸部 CT；如结节增大或实性成分增多，建议穿刺活检。',
  },
  {
    id: 'RPS-000002',
    patientId: 'P-20002',
    patientName: '林小燕',
    examDate: '2026-08-05',
    modality: 'CT',
    bodyPart: '胸部',
    doctorId: 'D001',
    doctorName: '张海涛',
    organization: '中心医院',
    source: 'doctor',
    isCritical: false,
    findings: '双肺野清晰，右肺中叶见约 5mm 实性小结节影，边界光整。双侧胸膜未见增厚。',
    impression: '右肺中叶实性小结节，良性可能大。',
    conclusion: '右肺中叶实性小结节（5mm），考虑良性病变，建议 12 个月随访。',
    diagnosis: '肺结节（实性）',
    recommendations: '12 个月后复查胸部 CT。',
  },
  {
    id: 'RPS-000003',
    patientId: 'P-20003',
    patientName: '刘国庆',
    examDate: '2026-07-28',
    modality: 'CT',
    bodyPart: '胸部',
    doctorId: 'D002',
    doctorName: '王秀峰',
    organization: '中心医院',
    source: 'doctor',
    isCritical: true,
    findings: '双肺散在斑片状高密度影，以左下肺为著，部分实变。纵隔淋巴结增大。',
    impression: '双肺感染性病变，考虑重症肺炎可能。',
    conclusion: '双肺多发斑片影伴实变，重症肺炎可能，建议急诊抗感染治疗并复查。',
    diagnosis: '肺炎（重症）',
    recommendations: '急诊住院抗感染治疗；48 小时后复查胸部 CT。',
  },
  {
    id: 'RPS-000004',
    patientId: 'P-20004',
    patientName: '赵玉芬',
    examDate: '2026-07-15',
    modality: 'MR',
    bodyPart: '头颅',
    doctorId: 'D003',
    doctorName: '李建国',
    organization: '中心医院',
    source: 'doctor',
    isCritical: false,
    findings: '右侧基底节区见斑片状长 T1 长 T2 信号影，边界欠清，DWI 未见明显弥散受限。',
    impression: '右侧基底节区陈旧性腔隙性脑梗死可能。',
    conclusion: '右侧基底节区异常信号，考虑陈旧性腔隙性脑梗死，脑梗死病史明确，建议控制血压并随访。',
    diagnosis: '脑梗死（陈旧性腔隙性）',
    recommendations: '控制血压、血脂；6 个月后复查头颅 MR。',
  },
  {
    id: 'RPS-000005',
    patientId: 'P-20005',
    patientName: '周文斌',
    examDate: '2026-08-12',
    modality: 'MR',
    bodyPart: '头颅',
    doctorId: 'D003',
    doctorName: '李建国',
    organization: '东城分院',
    source: 'doctor',
    isCritical: true,
    findings: '右侧大脑中动脉供血区见大片状长 T1 长 T2 信号影，DWI 高信号，ADC 低信号。',
    impression: '急性脑梗死，范围较大。',
    conclusion: '急性期大面积脑梗死，脑梗死阳性，建议神经内科急诊会诊。',
    diagnosis: '脑梗死（急性）',
    recommendations: '神经内科急诊收治；评估溶栓/取栓时机。',
  },
  {
    id: 'RPS-000006',
    patientId: 'P-20006',
    patientName: '吴敏',
    examDate: '2026-06-30',
    modality: 'DR',
    bodyPart: '胸部',
    doctorId: 'D001',
    doctorName: '张海涛',
    organization: '中心医院',
    source: 'doctor',
    isCritical: false,
    findings: '双肺野清晰，肺纹理走形自然。心影大小形态正常，双膈面光整，肋膈角锐利。',
    impression: '胸部正位片未见明显异常。',
    conclusion: '双肺未见活动性病变，胸部平片阴性。',
    diagnosis: '正常胸部平片',
    recommendations: '',
  },
  {
    id: 'RPS-000007',
    patientId: 'P-20007',
    patientName: '郑秀英',
    examDate: '2026-06-20',
    modality: 'CT',
    bodyPart: '腹部',
    doctorId: 'D002',
    doctorName: '王秀峰',
    organization: '城西分院',
    source: 'doctor',
    isCritical: false,
    findings: '肝脏形态大小未见异常，肝内未见明确占位性病变。胆囊内见多发强回声结石影，最大约 1.2cm。',
    impression: '胆囊多发结石。',
    conclusion: '胆囊多发结石（最大 1.2cm），建议普外科评估手术治疗。',
    diagnosis: '胆囊结石',
    recommendations: '普外科会诊；低脂饮食，避免饱餐后剧烈活动。',
  },
  {
    id: 'RPS-000008',
    patientId: 'P-20008',
    patientName: '孙立群',
    examDate: '2026-06-05',
    modality: 'CT',
    bodyPart: '胸部',
    doctorId: 'D004',
    doctorName: '陈海涛',
    organization: '附属医院',
    source: 'doctor',
    isCritical: false,
    findings: '左上肺见团块状软组织密度影，大小约 3.5×2.8cm，边缘分叶，邻近胸膜牵拉。',
    impression: '左上肺占位，考虑肺癌可能，建议增强及病理。',
    conclusion: '左上肺占位性病变，考虑周围型肺癌可能，建议增强 CT 及穿刺活检。',
    diagnosis: '肺部占位（肺癌可能）',
    recommendations: '增强 CT；穿刺活检明确病理；胸外科会诊。',
  },
  {
    id: 'RPS-000009',
    patientId: 'P-20009',
    patientName: '马晓东',
    examDate: '2026-05-22',
    modality: 'CT',
    bodyPart: '头颅',
    doctorId: 'D003',
    doctorName: '李建国',
    organization: '东城分院',
    source: 'doctor',
    isCritical: true,
    findings: '蛛网膜下腔及脑沟内见高密度影，脑室系统轻度扩大。',
    impression: '蛛网膜下腔出血。',
    conclusion: '蛛网膜下腔出血，出血量中等，建议神经外科急诊会诊并查动脉瘤。',
    diagnosis: '蛛网膜下腔出血',
    recommendations: '神经外科急诊；CTA 排查动脉瘤；绝对卧床。',
  },
  {
    id: 'RPS-000010',
    patientId: 'P-20010',
    patientName: '许文静',
    examDate: '2026-05-10',
    modality: 'MG',
    bodyPart: '双乳',
    doctorId: 'D005',
    doctorName: '赵丽华',
    organization: '城西分院',
    source: 'doctor',
    isCritical: false,
    findings: '双乳呈不均匀致密类，右乳外上象限见成簇状微小钙化灶，范围约 2.0cm。',
    impression: '右乳可疑钙化，BI-RADS 4A 类。',
    conclusion: '右乳外上象限成簇钙化，BI-RADS 4A 类，建议活检。',
    diagnosis: '乳腺钙化（BI-RADS 4A）',
    recommendations: '乳腺外科就诊；超声引导下穿刺活检。',
  },
  {
    id: 'RPS-000011',
    patientId: 'P-20011',
    patientName: '韩磊',
    examDate: '2026-04-18',
    modality: 'CT',
    bodyPart: '胸部',
    doctorId: 'D002',
    doctorName: '王秀峰',
    organization: '中心医院',
    source: 'ai',
    isCritical: false,
    findings: 'AI 自动识别: 左肺下叶见约 6mm 磨玻璃结节影，实性成分比例 <25%。',
    impression: '左肺下叶磨玻璃结节（AI 初筛）。',
    conclusion: '左肺下叶磨玻璃结节（6mm），建议医师复核确认。',
    diagnosis: '肺结节（磨玻璃）',
    recommendations: '医师复核；6 个月后复查。',
  },
  {
    id: 'RPS-000012',
    patientId: 'P-20012',
    patientName: '冯桂芳',
    examDate: '2026-03-25',
    modality: 'CT',
    bodyPart: '胸部',
    doctorId: 'D001',
    doctorName: '张海涛',
    organization: '中心医院',
    source: 'doctor',
    isCritical: false,
    findings: '双肺纹理稍增多，双下肺见网格状影及条索影，以胸膜下为著。',
    impression: '双下肺间质纤维化改变。',
    conclusion: '双肺间质纤维化改变（轻度），建议呼吸内科随访。',
    diagnosis: '肺纤维化',
    recommendations: '呼吸内科随访；肺功能检查。',
  },
  {
    id: 'RPS-000013',
    patientId: 'P-20013',
    patientName: '邱建国',
    examDate: '2026-02-14',
    modality: 'DR',
    bodyPart: '胸部',
    doctorId: 'D001',
    doctorName: '张海涛',
    organization: '东城分院',
    source: 'doctor',
    isCritical: false,
    findings: '右侧第 5 前肋见骨折线，局部骨痂形成，周围软组织稍肿胀。',
    impression: '右侧第 5 前肋骨折（愈合期）。',
    conclusion: '右侧第 5 前肋骨折，骨折线清晰，愈合良好。',
    diagnosis: '肋骨骨折',
    recommendations: '避免剧烈活动；1 个月后复查。',
  },
]

// ================= 服务 =================

@Injectable()
export class ReportSearchV2Service {
  private readonly corpus: CorpusReport[] = SEED_CORPUS

  /** 可注入时间源 (默认 Date.now) — 测试确定性时间用 */
  constructor(private readonly nowProvider: () => number = () => Date.now()) {}

  /**
   * 自然语言解析 (确定性解析器):
   *   - 时间: 近 N 天/周/月/年, 今年, YYYY年[M月]
   *   - 检查类型: 模态别名 (CT/MR/DR/US/MG/PET-CT/DSA)
   *   - 机构: 语料内机构名
   *   - 医生: 语料内医生名
   *   - 诊断关键词 + 全文关键词: DIAG_KEYWORDS 词典命中
   */
  parseNaturalLanguage(phrase: string): { conditions: SearchCondition; parsed: ParsedCondition[] } {
    const conditions: SearchCondition = {}
    const parsed: ParsedCondition[] = []
    const text = String(phrase ?? '').trim()
    if (!text) throw new BadRequestException('phrase 不能为空')
    const now = new Date(this.nowProvider())
    const today = dateKey(now)

    // ---- 时间范围 ----
    let m = MONTHS_RE.exec(text)
    if (m) {
      const from = dateKey(addMonths(now, -Number(m[1])))
      conditions.dateFrom = from
      conditions.dateTo = today
      parsed.push({ key: 'dateRange', label: '时间范围', value: `${from} ~ ${today} (近 ${m[1]} 个月)` })
    } else if ((m = DAYS_RE.exec(text))) {
      const from = dateKey(addDays(now, -Number(m[1])))
      conditions.dateFrom = from
      conditions.dateTo = today
      parsed.push({ key: 'dateRange', label: '时间范围', value: `${from} ~ ${today} (近 ${m[1]} 天)` })
    } else if ((m = WEEKS_RE.exec(text))) {
      const from = dateKey(addDays(now, -7 * Number(m[1])))
      conditions.dateFrom = from
      conditions.dateTo = today
      parsed.push({ key: 'dateRange', label: '时间范围', value: `${from} ~ ${today} (近 ${m[1]} 周)` })
    } else if ((m = YEARS_RE.exec(text))) {
      const from = dateKey(addMonths(now, -12 * Number(m[1])))
      conditions.dateFrom = from
      conditions.dateTo = today
      parsed.push({ key: 'dateRange', label: '时间范围', value: `${from} ~ ${today} (近 ${m[1]} 年)` })
    } else if (text.includes('今年')) {
      const from = `${now.getFullYear()}-01-01`
      conditions.dateFrom = from
      conditions.dateTo = today
      parsed.push({ key: 'dateRange', label: '时间范围', value: `${from} ~ ${today} (今年)` })
    } else if ((m = DATE_RE.exec(text))) {
      const year = Number(m[1])
      if (m[2]) {
        const month = Number(m[2])
        const from = `${year}-${pad(month)}-01`
        const to = `${year}-${pad(month)}-${pad(new Date(year, month, 0).getDate())}`
        conditions.dateFrom = from
        conditions.dateTo = to
        parsed.push({ key: 'dateRange', label: '时间范围', value: `${from} ~ ${to} (${year}年${month}月)` })
      } else {
        conditions.dateFrom = `${year}-01-01`
        conditions.dateTo = `${year}-12-31`
        parsed.push({ key: 'dateRange', label: '时间范围', value: `${year} 年` })
      }
    }

    // ---- 检查类型 (模态别名, 确定性: 按 MODALITY_ALIASES 顺序) ----
    for (const item of MODALITY_ALIASES) {
      if (item.aliases.some((alias) => lower(text).includes(lower(alias)))) {
        conditions.modality = item.modality
        parsed.push({ key: 'modality', label: '检查类型', value: item.modality })
        break
      }
    }

    // ---- 机构维度 (跨机构检索: 命中语料内机构名) ----
    const org = this.corpus.find((r) => text.includes(r.organization))
    if (org) {
      conditions.organization = org.organization
      parsed.push({ key: 'organization', label: '机构', value: org.organization })
    }

    // ---- 医生 ----
    const doctor = this.corpus.find((r) => text.includes(r.doctorName))
    if (doctor) {
      conditions.doctor = doctor.doctorName
      parsed.push({ key: 'doctor', label: '医生', value: doctor.doctorName })
    }

    // ---- 诊断关键词 + 全文关键词 (按词典顺序, 确定性) ----
    const matched: string[] = []
    for (const kw of DIAG_KEYWORDS) {
      if (text.includes(kw)) matched.push(kw)
    }
    if (matched.length > 0) {
      conditions.diagnosisKeyword = matched[0]!
      conditions.keyword = matched.join(' ')
      parsed.push({ key: 'diagnosisKeyword', label: '诊断关键词', value: matched.join(' / ') })
      parsed.push({ key: 'keyword', label: '全文关键词', value: matched.join(' ') })
    }

    return { conditions, parsed }
  }

  /**
   * 结构化检索: 关键词全文 + 模态 + 时间范围 + 诊断关键词 + 医生 + 机构。
   * 排序: 相关性 desc → 检查日期 desc → 报告 id asc (确定性, 无随机)。
   */
  search(input: SearchCondition): SearchResult {
    const keyword = String(input.keyword ?? '').trim()
    const diagnosisKeyword = String(input.diagnosisKeyword ?? '').trim()
    const tokens = [...new Set([...(keyword.split(/\s+/).filter(Boolean)), ...(diagnosisKeyword ? [diagnosisKeyword] : [])])]
      .map((t) => t.toLowerCase())
    const now = new Date(this.nowProvider())
    const scored: Array<{ hit: SearchHit; score: number; examDate: string; reportId: string }> = []
    for (const r of this.corpus) {
      if (input.modality && r.modality !== input.modality) continue
      if (input.organization && r.organization !== input.organization) continue
      if (input.doctor && !r.doctorName.includes(input.doctor)) continue
      if (input.dateFrom && r.examDate < input.dateFrom) continue
      if (input.dateTo && r.examDate > input.dateTo) continue
      const pool = lower(textPool(r))
      if (tokens.length > 0 && !tokens.every((t) => pool.includes(t))) continue
      let score = 0
      if (diagnosisKeyword) score += diagnosisScore(r, diagnosisKeyword)
      score += keywordHitScore(r, tokens)
      if (input.modality) score += 8
      if (input.doctor) score += 8
      if (input.organization) score += 4
      score += recencyScore(r.examDate, now)
      score = Math.max(0, Math.min(100, Math.round(score)))
      scored.push({
        reportId: r.id,
        examDate: r.examDate,
        score,
        hit: {
          reportId: r.id,
          patientId: r.patientId,
          patientName: r.patientName,
          examDate: r.examDate,
          modality: r.modality,
          bodyPart: r.bodyPart,
          doctorName: r.doctorName,
          organization: r.organization,
          conclusion: r.conclusion,
          isCritical: r.isCritical,
          relevance: score,
          matchedKeywords: [...new Set(tokens.map((t) => t))],
          snippets: tokens.length > 0 ? buildSnippets(r, tokens, now) : [],
        },
      })
    }
    scored.sort((a, b) => b.score - a.score || b.examDate.localeCompare(a.examDate) || a.reportId.localeCompare(b.reportId))
    const items = scored.map((s) => s.hit)
    return {
      items,
      total: items.length,
      aggregations: this.buildAggregations(items),
      source: 'seed',
    }
  }

  /** 自然语言 → 条件 → 检索 (短语/条件/命中 一体返回) */
  naturalLanguage(phrase: string): NaturalLanguageResult {
    const { conditions, parsed } = this.parseNaturalLanguage(phrase)
    const result = this.search(conditions)
    return {
      ...result,
      phrase: String(phrase ?? '').trim(),
      conditions,
      parsed,
    }
  }

  /** GET /report-search-v2/meta — 下拉元数据 (模态/机构/医生/诊断关键词) */
  getMeta(): SearchMeta {
    const orgCount = new Map<string, number>()
    const doctorCount = new Map<string, number>()
    for (const r of this.corpus) {
      orgCount.set(r.organization, (orgCount.get(r.organization) ?? 0) + 1)
      doctorCount.set(r.doctorName, (doctorCount.get(r.doctorName) ?? 0) + 1)
    }
    return {
      modalities: [...new Set(this.corpus.map((r) => r.modality))].sort(),
      organizations: [...orgCount.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
      doctors: [...doctorCount.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
      keywords: [...DIAG_KEYWORDS],
    }
  }

  /** GET /report-search-v2/stats — 语料统计 (机构/模态分布) */
  getStats(): SearchV2Stats {
    const dates = this.corpus.map((r) => r.examDate).filter(Boolean).sort()
    const byOrganization = this.aggregate(this.corpus.map((r) => r.organization))
    const byModality = this.aggregate(this.corpus.map((r) => r.modality))
    return {
      totalReports: this.corpus.length,
      organizationCount: byOrganization.length,
      byOrganization,
      byModality,
      criticalCount: this.corpus.filter((r) => r.isCritical).length,
      latestExamDate: dates.length > 0 ? dates[dates.length - 1]! : null,
      earliestExamDate: dates.length > 0 ? dates[0]! : null,
    }
  }

  // ================= 内部 =================

  private buildAggregations(items: SearchHit[]): SearchAggregations {
    const byDiagnosis = new Map<string, number>()
    for (const item of items) {
      const text = lower(item.conclusion)
      for (const kw of DIAG_KEYWORDS) {
        if (text.includes(lower(kw))) byDiagnosis.set(kw, (byDiagnosis.get(kw) ?? 0) + 1)
      }
    }
    return {
      total: items.length,
      byModality: this.aggregate(items.map((i) => i.modality)),
      byOrganization: this.aggregate(items.map((i) => i.organization)),
      byDoctor: this.aggregate(items.map((i) => i.doctorName)),
      byDiagnosis: [...byDiagnosis.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, 6)
        .map(([key, count]) => ({ key, count })),
      dateRange: {
        from: items.length > 0 ? items.map((i) => i.examDate).filter(Boolean).sort()[0] ?? null : null,
        to: items.length > 0 ? items.map((i) => i.examDate).filter(Boolean).sort().reverse()[0] ?? null : null,
      },
    }
  }

  private aggregate(values: string[]): Array<{ key: string; count: number }> {
    const map = new Map<string, number>()
    for (const v of values) map.set(v, (map.get(v) ?? 0) + 1)
    return [...map.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count)
  }
}
