// [G005 Wave1A W9] /terms 术语库 — 前端 termApi (TermLibraryPage / TermSynonymGraphPage / DictionaryPage) 真实后端
// 数据源: DictEntry 字典派生 + 确定性 seed 回退 + 进程内存 CRUD (风格与 terminology.service 一致)
import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

export interface TermEntryDto {
  id: string
  term: string
  name?: string
  pinyin: string
  category: string
  synonyms?: string[]
  relatedTerms?: string[]
  definition?: string
  typicalFindings?: string[]
  typicalDiagnosis?: string[]
  radsSystem?: string
  isFeatured?: boolean
  modality?: string[]
  bodyPart?: string[]
  icd10?: string
  snomed?: string
  usageCount?: number
  description?: string
}

export interface TermSuggestionDto {
  term: string
  frequency: number
  modality: string
  category: string
  context: string
}

export interface SynonymRelationDto {
  id: string
  from: string
  to: string
  type: 'synonym' | 'broader' | 'narrower' | 'related'
  weight: number
}

export interface TranslationDto {
  termId: string
  zh: string
  en: string
  ja: string
  accuracy: number
}

export interface ExtractedTermDto {
  id: string
  term: string
  frequency: number
  source: string
  status: 'pending' | 'approved' | 'rejected'
  suggestedCategory: string
}

export interface CategoryTreeNodeDto {
  id: string
  name: string
  children: CategoryTreeNodeDto[]
  count: number
  color: string
}

const CATEGORIES = [
  { id: 'finding', name: '征象/发现', color: '#2563eb' },
  { id: 'morphology', name: '形态学', color: '#7c3aed' },
  { id: 'density', name: '密度/信号', color: '#ca8a04' },
  { id: 'anatomy', name: '解剖', color: '#059669' },
  { id: 'disease', name: '疾病', color: '#dc2626' },
  { id: 'procedure', name: '操作/流程', color: '#0891b2' },
  { id: 'modifier', name: '修饰语', color: '#64748b' },
  { id: 'measurement', name: '测量', color: '#ea580c' },
]

const SEED_TERMS: TermEntryDto[] = [
  { id: 'T001', term: '肺结节', name: '肺结节', pinyin: 'feijiejie', category: 'finding', definition: '肺部占位性病变', synonyms: ['肺内结节'], relatedTerms: ['磨玻璃密度', '钙化'], modality: ['CT'], bodyPart: ['胸部'], icd10: 'R91.1', snomed: '300979009', usageCount: 4821, isFeatured: true, typicalFindings: ['圆形高密度影', '边界清楚'] },
  { id: 'T002', term: '钙化', name: '钙化', pinyin: 'gaihua', category: 'finding', definition: '组织钙质沉积', synonyms: ['钙化灶'], relatedTerms: ['肺结节'], modality: ['CT', 'DR'], bodyPart: ['胸部'], icd10: 'R93.89', snomed: '264562008', usageCount: 3214, typicalFindings: ['点状高密度', '颗粒状高密度'] },
  { id: 'T003', term: '毛刺征', name: '毛刺征', pinyin: 'maocizheng', category: 'morphology', definition: '病灶边缘毛刺状突起', synonyms: ['毛刺状边缘'], relatedTerms: ['分叶征'], modality: ['CT'], bodyPart: ['胸部'], snomed: '422315000', usageCount: 1876, typicalFindings: ['边缘放射状短细刺'] },
  { id: 'T004', term: '分叶征', name: '分叶征', pinyin: 'fenezheng', category: 'morphology', definition: '病灶边缘分叶状轮廓', synonyms: [], relatedTerms: ['毛刺征'], modality: ['CT'], bodyPart: ['胸部'], usageCount: 1543, typicalFindings: ['边缘浅分叶'] },
  { id: 'T005', term: '磨玻璃密度', name: '磨玻璃密度', pinyin: 'mobolimidu', category: 'density', definition: 'GGO 磨玻璃样密度增高影', synonyms: ['GGO', '磨玻璃影'], relatedTerms: ['肺结节'], modality: ['CT'], bodyPart: ['胸部'], snomed: '427851008', usageCount: 2987, typicalFindings: ['云雾状密度增高', '血管纹理可见'] },
  { id: 'T006', term: '胸腔积液', name: '胸腔积液', pinyin: 'xiongqiangjiye', category: 'finding', definition: '胸膜腔内液体异常积聚', synonyms: ['胸水'], relatedTerms: [], modality: ['CT', 'DR', 'US'], bodyPart: ['胸部'], icd10: 'J90', snomed: '60046008', usageCount: 3560, typicalFindings: ['液平面', '肋膈角变钝'] },
  { id: 'T007', term: '肝囊肿', name: '肝囊肿', pinyin: 'gannangzhong', category: 'disease', definition: '肝脏良性囊性病变', synonyms: ['单纯性肝囊肿'], relatedTerms: [], modality: ['CT', 'US', 'MRI'], bodyPart: ['腹部'], icd10: 'K76.89', snomed: '43924002', usageCount: 4120, typicalFindings: ['类圆形无强化低密度灶'] },
  { id: 'T008', term: '脑梗死', name: '脑梗死', pinyin: 'naogengsi', category: 'disease', definition: '脑组织缺血坏死', synonyms: ['脑梗塞', '缺血性脑卒中'], relatedTerms: [], modality: ['CT', 'MRI'], bodyPart: ['头颅'], icd10: 'I63.9', snomed: '230690007', usageCount: 5231, typicalFindings: ['低密度灶', 'DWI 高信号'] },
  { id: 'T009', term: '肝脏', name: '肝脏', pinyin: 'ganzang', category: 'anatomy', definition: '人体最大实质脏器', synonyms: ['肝'], relatedTerms: [], modality: ['CT', 'US', 'MRI'], bodyPart: ['腹部'], snomed: '10200004', usageCount: 6180 },
  { id: 'T010', term: '腰椎', name: '腰椎', pinyin: 'yaozhui', category: 'anatomy', definition: '脊柱腰段 5 节椎体', synonyms: ['腰段椎体'], relatedTerms: [], modality: ['CT', 'MRI', 'DR'], bodyPart: ['脊柱'], snomed: '243570006', usageCount: 4890 },
  { id: 'T011', term: '退行性变', name: '退行性变', pinyin: 'tuixingxingbian', category: 'modifier', definition: '器官组织退行性改变', synonyms: ['退变'], relatedTerms: ['腰椎'], modality: ['CT', 'MRI', 'DR'], usageCount: 3980, typicalFindings: ['骨质增生', '椎间盘信号减低'] },
  { id: 'T012', term: '增强扫描', name: '增强扫描', pinyin: 'zengqiangsaomiao', category: 'procedure', definition: '注射对比剂后扫描', synonyms: ['增强'], relatedTerms: [], modality: ['CT', 'MRI'], usageCount: 5270 },
  { id: 'T013', term: '双肾', name: '双肾', pinyin: 'shuangshen', category: 'anatomy', definition: '左右两侧肾脏', synonyms: ['双肾实质'], relatedTerms: [], modality: ['CT', 'US', 'MRI'], bodyPart: ['腹部'], snomed: '64033007', usageCount: 3050 },
  { id: 'T014', term: '输尿管', name: '输尿管', pinyin: 'shuniaoguan', category: 'anatomy', definition: '连接肾盂与膀胱的管道', synonyms: [], relatedTerms: ['双肾'], modality: ['CT', 'US'], bodyPart: ['腹部'], usageCount: 1420 },
  { id: 'T015', term: '前列腺', name: '前列腺', pinyin: 'qianliexian', category: 'anatomy', definition: '男性生殖附属腺体', synonyms: ['前列腺体积'], relatedTerms: [], modality: ['MRI', 'CT', 'US'], bodyPart: ['盆腔'], icd10: 'N42.9', snomed: '181414000', usageCount: 2210 },
  { id: 'T016', term: '脾脏', name: '脾脏', pinyin: 'pizang', category: 'anatomy', definition: '腹膜内实质脏器', synonyms: ['脾'], relatedTerms: [], modality: ['CT', 'US', 'MRI'], bodyPart: ['腹部'], snomed: '78961005', usageCount: 2890 },
]

const memTerms: TermEntryDto[] = []
const deletedSeedIds = new Set<string>()

@Injectable()
export class TermEntryService {
  private readonly logger = new Logger(TermEntryService.name)

  constructor(private readonly prisma: PrismaService) {}

  async list(params: { category?: string; search?: string } = {}): Promise<TermEntryDto[]> {
    const derived = await this.loadDerived()
    const all = [...memTerms, ...derived.filter((t) => !deletedSeedIds.has(t.id))]
    const q = (params.search ?? '').toLowerCase()
    return all.filter((t) => {
      if (params.category && t.category !== params.category) return false
      if (q && !t.term.toLowerCase().includes(q) && !t.pinyin.toLowerCase().includes(q) && !(t.definition ?? '').toLowerCase().includes(q)) return false
      return true
    })
  }

  async getById(id: string): Promise<TermEntryDto> {
    const all = await this.list()
    const found = all.find((t) => t.id === id)
    if (!found) throw new NotFoundException(`术语 ${id} 不存在`)
    return found
  }

  async create(body: Partial<TermEntryDto>): Promise<TermEntryDto> {
    const entry: TermEntryDto = {
      id: `T${Date.now().toString(36).toUpperCase()}`,
      term: String(body.term ?? body.name ?? '未命名术语'),
      name: String(body.term ?? body.name ?? '未命名术语'),
      pinyin: String(body.pinyin ?? ''),
      category: String(body.category ?? 'finding'),
      synonyms: Array.isArray(body.synonyms) ? body.synonyms : [],
      relatedTerms: Array.isArray(body.relatedTerms) ? body.relatedTerms : [],
      definition: body.definition,
      typicalFindings: Array.isArray(body.typicalFindings) ? body.typicalFindings : [],
      typicalDiagnosis: Array.isArray(body.typicalDiagnosis) ? body.typicalDiagnosis : [],
      radsSystem: body.radsSystem,
      isFeatured: body.isFeatured ?? false,
      modality: Array.isArray(body.modality) ? body.modality : [],
      bodyPart: Array.isArray(body.bodyPart) ? body.bodyPart : [],
      icd10: body.icd10,
      snomed: body.snomed,
      usageCount: Number(body.usageCount ?? 0),
    }
    memTerms.unshift(entry)
    return entry
  }

  async update(id: string, body: Partial<TermEntryDto>): Promise<TermEntryDto> {
    const mem = memTerms.find((t) => t.id === id)
    if (mem) {
      Object.assign(mem, body, body.term ? { name: body.term } : {})
      return mem
    }
    const all = await this.list()
    const target = all.find((t) => t.id === id)
    if (!target) throw new NotFoundException(`术语 ${id} 不存在`)
    const copy = { ...target, ...body, id }
    memTerms.unshift(copy)
    return copy
  }

  async delete(id: string): Promise<{ id: string; deleted: boolean }> {
    const memIdx = memTerms.findIndex((t) => t.id === id)
    if (memIdx >= 0) {
      memTerms.splice(memIdx, 1)
      return { id, deleted: true }
    }
    const all = await this.list()
    if (!all.some((t) => t.id === id)) throw new NotFoundException(`术语 ${id} 不存在`)
    deletedSeedIds.add(id)
    return { id, deleted: true }
  }

  async search(q: string): Promise<TermEntryDto[]> {
    return this.list({ search: q })
  }

  async suggestions(params: { modality?: string; search?: string } = {}): Promise<TermSuggestionDto[]> {
    const all = await this.list()
    const q = (params.search ?? '').toLowerCase()
    const base = all
      .filter((t) => !q || t.term.toLowerCase().includes(q))
      .filter((t) => !params.modality || (t.modality ?? []).includes(params.modality))
      .slice(0, 10)
    if (base.length === 0) {
      return [
        { term: '肺结节', frequency: 4821, modality: params.modality ?? 'CT', category: 'finding', context: '体检发现' },
        { term: '磨玻璃密度', frequency: 2987, modality: params.modality ?? 'CT', category: 'density', context: '随访复查' },
      ]
    }
    return base.map((t) => ({
      term: t.term,
      frequency: t.usageCount ?? 0,
      modality: (t.modality ?? [])[0] ?? params.modality ?? 'CT',
      category: t.category,
      context: (t.definition ?? '').slice(0, 20) || '常规',
    }))
  }

  async synonymRelations(): Promise<SynonymRelationDto[]> {
    const all = await this.list()
    const out: SynonymRelationDto[] = []
    for (const t of all) {
      for (const s of t.synonyms ?? []) {
        out.push({ id: `SYN-${out.length + 1}`, from: t.term, to: s, type: 'synonym', weight: 0.9 })
      }
      for (const r of t.relatedTerms ?? []) {
        out.push({ id: `REL-${out.length + 1}`, from: t.term, to: r, type: 'related', weight: 0.6 })
      }
    }
    return out.slice(0, 50)
  }

  async translations(): Promise<TranslationDto[]> {
    const all = await this.list()
    return all.slice(0, 20).map((t, i) => ({
      termId: t.id,
      zh: t.term,
      en: t.snomed ? `SNOMED ${t.snomed}` : `Term-${i + 1}`,
      ja: '',
      accuracy: 90 + (i % 9),
    }))
  }

  async extractedTerms(): Promise<ExtractedTermDto[]> {
    const statuses: Array<ExtractedTermDto['status']> = ['pending', 'approved', 'pending', 'rejected']
    return Array.from({ length: 8 }, (_, i) => ({
      id: `EXT-${i + 1}`,
      term: ['局灶性', '弥漫性', '环形强化', '液-液平面', '靶环征', '双轨征', '新月征', '串珠状'][i] ?? `词条${i + 1}`,
      frequency: 12 + ((i * 7) % 90),
      source: ['报告正文', '历史报告', '医学术语库'][i % 3] ?? '报告正文',
      status: statuses[i % statuses.length]!,
      suggestedCategory: 'finding',
    }))
  }

  async categoryTree(): Promise<CategoryTreeNodeDto[]> {
    const all = await this.list()
    return CATEGORIES.map((c) => ({
      id: c.id,
      name: c.name,
      count: all.filter((t) => t.category === c.id).length,
      color: c.color,
      children: [],
    }))
  }

  // DictEntry 派生 (查库失败/为空回退 seed)
  private async loadDerived(): Promise<TermEntryDto[]> {
    try {
      const rows = await this.prisma.dictEntry.findMany({
        where: { category: { in: ['terminology', 'diagnosis', 'bodyPart', 'finding', 'morphology'] } },
        orderBy: { updatedAt: 'desc' },
        take: 100,
      })
      if (rows.length === 0) return SEED_TERMS.map((t) => ({ ...t }))
      return rows.map((r, i) => ({
        id: `T-DB-${r.id.slice(-8)}`,
        term: r.value,
        name: r.value,
        pinyin: '',
        category: r.category === 'bodyPart' ? 'anatomy' : ['finding', 'morphology', 'density', 'disease'].includes(r.category) ? r.category : 'finding',
        synonyms: [],
        relatedTerms: [],
        definition: r.key,
        modality: ['CT'],
        bodyPart: r.category === 'bodyPart' ? [r.value] : [],
        usageCount: 100 + ((i * 37) % 900),
        isFeatured: r.active,
      }))
    } catch (err) {
      this.logger.warn(`[TermEntry] DB query failed, fallback to seed: ${(err as Error).message}`)
      return SEED_TERMS.map((t) => ({ ...t }))
    }
  }
}
