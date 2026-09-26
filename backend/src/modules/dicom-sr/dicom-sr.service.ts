/**
 * G005 RIS v3.0.6.11-60 - DICOM SR 结构化报告服务
 * 全链路: 报告 → SR 文档(Prisma 持久化) → 查看 → HL7 ORU^R01 回传
 * 对标: TID 1500 Imaging Measurement Report / TID 2000 CAD Document SR (DICOM PS 3.3)
 */
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { Hl7Service, type ReportForHL7 } from '../../hl7/hl7.service'
import { SEED_SR_TEMPLATES, type SrMeasurementTemplate } from './seed-templates'

export interface TemplateInfo {
  id: string
  label: string
  labelEn: string
  description: string
  tid: string
}

export interface GenerateSrDto {
  reportId: string
  templateId: 'tid1500' | 'tid2000'
  findings?: string
  impression?: string
}

// [G005 Wave4A] G-14 AI 结果 → DICOM SR 封装
export interface AiSrFinding {
  label: string
  confidence?: number
  x?: number
  y?: number
  width?: number
  height?: number
  description?: string
}

export interface FromAiSrDto {
  studyId: string
  findings: AiSrFinding[]
  templateId?: 'tid1500' | 'tid2000'
  modelName?: string
  summary?: string
}

export type SrStatus = 'draft' | 'finalized' | 'pushed'

// [G005 Wave4B] G-01 Encapsulated PDF (DICOM PDF 封装, SOP Class 1.2.840.10008.5.1.4.1.1.104.1)
export interface EncapsulatePdfDto {
  reportId?: string
  studyId?: string
  pdfUrl?: string
  pdfBase64?: string
}

export interface EncapsulatedPdf {
  id: string
  reportId: string
  sopClassUid: string
  sopInstanceUid: string
  studyInstanceUid: string
  pdfEmbedded: string
  size: number
  generatedFrom: 'input' | 'url' | 'report-text'
  generatedAt: string
}

const PDF_SOP_CLASS_UID = '1.2.840.10008.5.1.4.1.1.104.1' // Encapsulated PDF Storage

export interface SrConceptName {
  code: string
  scheme: string
  meaning: string
}

export interface SrContentItem {
  relationshipType: string
  conceptName: SrConceptName
  valueType: 'TEXT' | 'CODE' | 'NUM' | 'DATE' | 'UIDREF'
  value?: string
  code?: SrConceptName
  children?: SrContentItem[]
}

export interface SrSection {
  conceptName: SrConceptName
  title: string
  items: SrContentItem[]
}

export interface SrContentTree {
  templateId: string
  templateLabel: string
  context: {
    patient: { name: string; id: string; birthDate: string; sex: string }
    study: { uid: string; date: string; time: string; description: string; accessionNumber: string; modality: string }
    report: { id: string; authorId: string; authorName: string; findings: string; impression: string; conclusion: string; recommendations: string; reportDate: string }
  }
  sections: SrSection[]
  codedEntries: SrConceptName[]
}

export interface SrDocumentDto {
  id: string
  reportId: string
  templateId: string
  tid: string
  status: SrStatus
  sopInstanceUid: string
  studyInstanceUid: string
  seriesInstanceUid: string
  sopClassUid: string
  patientName: string
  patientId: string
  modality: string
  title: string
  content: SrContentTree
  rawContent: string
  hl7ControlId?: string | null
  hl7Message?: string | null
  pushedAt?: string | null
  createdAt: string
  updatedAt: string
}

// [G005 Wave 8] DICOM SR → 报告回填: 测量摘要项
export interface SrMeasurementItem {
  name: string
  value: string
  unit: string
  source: 'measurement-group' | 'num-item' | 'text-parse' | 'fallback'
}

export interface SrToReportResult {
  srId: string
  reportId: string
  templateId: string
  paragraph: string
  measurements: SrMeasurementItem[]
}

interface SrRow {
  id: string
  reportId: string
  templateId: string
  tid: string
  content: unknown
  rawContent: string
  status: string
  sopInstanceUid: string
  studyInstanceUid: string
  seriesInstanceUid: string
  sopClassUid: string
  hl7ControlId: string | null
  hl7Message: string | null
  pushedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

const SR_SOP_CLASS = {
  tid1500: '1.2.840.10008.5.1.4.1.1.88.33', // Enhanced SR - Comprehensive
  tid2000: '1.2.840.10008.5.1.4.1.1.88.22', // Enhanced SR - CAD
} as const

const SR_UID_ROOT = '1.2.840.10008.5.1.4.1.1.88.11.1'

// SNOMED CT 编码映射(常见放射所见,匹配不到回退 Clinical finding)
const SNOMED_MAP: { keyword: string; code: string; meaning: string }[] = [
  { keyword: '未见明显异常', code: '17621005', meaning: 'Normal (finding)' },
  { keyword: '未见异常', code: '17621005', meaning: 'Normal (finding)' },
  { keyword: '气胸', code: '36118008', meaning: 'Pneumothorax (disorder)' },
  { keyword: '骨折', code: '125605004', meaning: 'Fracture of bone (disorder)' },
  { keyword: '水肿', code: '79654002', meaning: 'Edema (finding)' },
  { keyword: '积液', code: '79654002', meaning: 'Edema (finding)' },
  { keyword: '钙化', code: '44039008', meaning: 'Calcification (morphologic abnormality)' },
  { keyword: '结节', code: '269256004', meaning: 'Nodule (morphologic abnormality)' },
  { keyword: '肿块', code: '4147007', meaning: 'Mass (morphologic abnormality)' },
  { keyword: '占位', code: '4147007', meaning: 'Mass (morphologic abnormality)' },
  { keyword: '动脉瘤', code: '12250007', meaning: 'Aneurysm (morphologic abnormality)' },
  { keyword: '狭窄', code: '72089006', meaning: 'Stenosis (morphologic abnormality)' },
]

const DCM_CONCEPT = (code: string, meaning: string): SrConceptName => ({ code, scheme: 'DCM', meaning })

const CONTENT_TITLES: Record<string, { title: string; conceptName: SrConceptName }> = {
  history: { title: '检查所见 / Findings', conceptName: DCM_CONCEPT('121071', 'Finding') },
  impression: { title: '结论 / Impression', conceptName: DCM_CONCEPT('121073', 'Impression') },
  recommendation: { title: '建议 / Recommendation', conceptName: DCM_CONCEPT('121074', 'Recommendation') },
  measurement: { title: '测量组 / Measurement Group', conceptName: DCM_CONCEPT('125007', 'Measurement Group') },
  cadSummary: { title: 'CAD 总结 / CAD Processing and Findings Summary', conceptName: DCM_CONCEPT('121120', 'CAD Processing and Findings Summary') },
}

function toSnomed(text: string): SrConceptName[] {
  const found: SrConceptName[] = []
  for (const entry of SNOMED_MAP) {
    if (text.includes(entry.keyword)) {
      found.push({ code: entry.code, scheme: 'SCT', meaning: entry.meaning })
    }
  }
  if (found.length === 0) {
    found.push({ code: '404684003', scheme: 'SCT', meaning: 'Clinical finding (finding)' })
  }
  return found
}

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return ''
  return new Date(d).toISOString().slice(0, 10).replace(/-/g, '')
}

function fmtTime(d: Date | string | null | undefined): string {
  if (!d) return ''
  return new Date(d).toISOString().slice(11, 19).replace(/:/g, '')
}

function templateIdLabel(templateId: GenerateSrDto['templateId']): string {
  return templateId === 'tid1500' ? 'TID 1500' : 'TID 2000'
}

@Injectable()
export class DicomSrService {
  private readonly logger = new Logger(DicomSrService.name)

  /** 单调递增序号, 避免同毫秒 ID 冲突 */
  private seq = 0

  // [G005 Wave4B] G-01 Encapsulated PDF 元数据对象 (内存)
  private readonly encapsulatedPdfs = new Map<string, EncapsulatedPdf>()

  private templates: TemplateInfo[] = [
    { id: 'tid1500', label: 'TID 1500 - 测量报告', labelEn: 'TID 1500 - Measurement Report', description: 'Imaging Measurement Report (DICOM PS 3.3 TID 1500)', tid: '1500' },
    { id: 'tid2000', label: 'TID 2000 - CAD SR', labelEn: 'TID 2000 - CAD Document SR', description: 'Computer-Aided Detection/Diagnosis SR (DICOM PS 3.3 TID 2000)', tid: '2000' },
  ]

  constructor(
    private readonly prisma: PrismaService,
    private readonly hl7: Hl7Service,
  ) {}

  getTemplates(): TemplateInfo[] {
    return this.templates
  }

  // ── [G005 Wave 10A] 测量模板库 (TID 1500/2000, 20 个完整模板 seed) ─────────
  /** GET /dicom-sr/measurement-templates — 测量模板列表 (可按 modality/bodyPart 过滤) */
  getMeasurementTemplates(filter?: { modality?: string; bodyPart?: string; category?: string }): SrMeasurementTemplate[] {
    let out = [...SEED_SR_TEMPLATES]
    if (filter?.modality) out = out.filter((t) => t.modality === filter.modality)
    if (filter?.bodyPart) out = out.filter((t) => t.bodyPart === filter.bodyPart)
    if (filter?.category) out = out.filter((t) => t.category === filter.category)
    return out
  }

  /** GET /dicom-sr/measurement-templates/:id — 模板详情 (含全部测量项) */
  getMeasurementTemplate(id: string): SrMeasurementTemplate {
    const tpl = SEED_SR_TEMPLATES.find((t) => t.id === id)
    if (!tpl) throw new NotFoundException(`测量模板不存在: ${id}`)
    return tpl
  }

  /** GET /dicom-sr/measurement-templates/categories — 模板分类统计 */
  getMeasurementTemplateCategories(): Array<{ category: string; count: number; modalities: string[] }> {
    const map = new Map<string, { count: number; modalities: Set<string> }>()
    for (const t of SEED_SR_TEMPLATES) {
      const entry = map.get(t.category) ?? { count: 0, modalities: new Set<string>() }
      entry.count += 1
      entry.modalities.add(t.modality)
      map.set(t.category, entry)
    }
    return Array.from(map.entries()).map(([category, v]) => ({ category, count: v.count, modalities: [...v.modalities] }))
  }

  async list(): Promise<SrDocumentDto[]> {
    const rows = await this.prisma.srDocument.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
    })
    return rows.map((r) => this.toDto(r))
  }

  async findById(id: string): Promise<SrDocumentDto | null> {
    const row = await this.prisma.srDocument.findUnique({ where: { id } })
    return row ? this.toDto(row) : null
  }

  async findByReportId(reportId: string): Promise<SrDocumentDto | null> {
    const row = await this.prisma.srDocument.findFirst({
      where: { reportId },
      orderBy: { updatedAt: 'desc' },
    })
    return row ? this.toDto(row) : null
  }

  /**
   * [G005 Wave 8] POST /dicom-sr/to-report — DICOM SR 测量值回填到报告。
   * 解析 SR 内容树 (TID1500 测量组 code 125007 / TID2000 NUM 项 / 文本数值+单位),
   * 生成测量摘要段落文本供前端插入书写页编辑器。
   * 返回 { paragraph, measurements[] } — 不落库, 由前端预览后经 insertHtml 通道写入。
   */
  async toReport(dto: { srId: string; reportId: string }): Promise<SrToReportResult> {
    const doc = await this.findById(dto.srId)
    if (!doc) throw new NotFoundException(`SR document ${dto.srId} not found`)
    const report = await this.prisma.report.findUnique({ where: { id: dto.reportId } })
    if (!report) throw new NotFoundException(`Report ${dto.reportId} not found`)
    const measurements = this.extractMeasurements(doc)
    this.logger.log(`SR ${dto.srId} → report ${dto.reportId}: ${measurements.length} measurements extracted`)
    return {
      srId: doc.id,
      reportId: dto.reportId,
      templateId: doc.templateId,
      paragraph: this.buildMeasurementParagraph(doc, measurements),
      measurements,
    }
  }

  /** 解析 SR 内容树中的测量项 (TID1500 测量组 code 125007 / NUM 项 / 文本数值+单位) */
  private extractMeasurements(doc: SrDocumentDto): SrMeasurementItem[] {
    const out: SrMeasurementItem[] = []
    const tree = doc.content
    if (!tree?.sections?.length) return out
    const walk = (item: SrContentItem, sectionTitle: string): void => {
      const meaning = item.conceptName?.meaning ?? ''
      const label = meaning || sectionTitle || '测量项'
      if (item.valueType === 'NUM' && item.value !== undefined && item.value !== '') {
        const m = item.value.match(/^(-?\d+(?:\.\d+)?)\s*(mm²|cm²|mm2|cm2|mL|ml|HU|mm|cm|µm|um|°|%)?/i)
        out.push({
          name: label,
          value: m ? m[1]! : String(item.value),
          unit: m?.[2] ?? '',
          source: 'num-item',
        })
      } else if (item.valueType === 'TEXT' && item.value) {
        const textRegex = /(-?\d+(?:\.\d+)?)\s*(mm|cm|mL|ml|HU|°|mm²|cm²|mL\/s|mm\/s)\b/gi
        const textMatches = Array.from(item.value.matchAll(textRegex))
        for (const m of textMatches) {
          out.push({
            name: meaning === 'Finding' || meaning === 'Text' ? sectionTitle || '测量项' : meaning || sectionTitle || '测量项',
            value: m[1]!,
            unit: m[2]!,
            source: 'text-parse',
          })
        }
      }
      item.children?.forEach((c) => walk(c, sectionTitle))
    }
    for (const section of tree.sections) {
      const isMeasurementGroup =
        section.conceptName?.code === '125007' || /测量|measurement/i.test(section.title ?? '')
      if (isMeasurementGroup) {
        for (const item of section.items ?? []) {
          if (item.valueType === 'NUM' && item.value) {
            const m = item.value.match(/^(-?\d+(?:\.\d+)?)\s*(mm²|cm²|mm2|cm2|mL|ml|HU|mm|cm|µm|um|°|%)?/i)
            out.push({
              name: item.conceptName?.meaning ?? section.title,
              value: m ? m[1]! : String(item.value),
              unit: m?.[2] ?? '',
              source: 'measurement-group',
            })
          } else {
            walk(item, section.title)
          }
        }
      } else {
        for (const item of section.items ?? []) walk(item, section.title)
      }
    }
    // 去重 (同名称同值同单位)
    const seen = new Set<string>()
    return out.filter((m) => {
      const key = `${m.name}|${m.value}|${m.unit}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }

  /** 生成测量摘要段落文本 (前端预览 + insertHtml 插入) */
  private buildMeasurementParagraph(doc: SrDocumentDto, measurements: SrMeasurementItem[]): string {
    const header = `【DICOM SR 测量摘要】(${doc.templateId ?? doc.tid ?? 'SR'} · ${doc.id})`
    if (measurements.length === 0) {
      return `${header}\nSR 文档未包含结构化测量项 (TID 1500 测量组 / TID 2000 NUM 项), 可在书写页手动补充。`
    }
    const lines = measurements.map((m) => {
      const unit = m.unit ? ` ${m.unit}` : ''
      const tag = m.source === 'fallback' ? '' : ''
      return `- ${m.name}: ${m.value}${unit}${tag}`
    })
    return [header, ...lines].join('\n')
  }

  /**
   * 从报告生成 DICOM SR 文档(真实 TID 1500/2000 内容树 + SNOMED 编码条目)
   * 同一报告同一模板重复生成时更新原文档(避免堆积)
   */
  async generate(dto: GenerateSrDto): Promise<SrDocumentDto> {
    const template = this.templates.find((t) => t.id === dto.templateId)
    if (!template) throw new NotFoundException(`Template ${dto.templateId} not found`)

    const report = await this.prisma.report.findUnique({
      where: { id: dto.reportId },
      include: {
        patient: true,
        exam: true,
        radiologist: { select: { id: true, fullName: true } },
        DicomInstance: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    })
    if (!report) throw new NotFoundException(`Report ${dto.reportId} not found`)

    const ts = Date.now()
    const existing = await this.prisma.srDocument.findFirst({
      where: { reportId: dto.reportId, templateId: dto.templateId },
    })

    const prevInstance = report.DicomInstance[0]
    const studyUID = prevInstance?.studyInstanceUid ?? `1.2.840.10008.5.1.4.1.1.2.1.${ts}`
    const seriesUID = prevInstance?.seriesInstanceUid ?? `${studyUID}.SR.1`
    const sopUID = existing?.sopInstanceUid ?? `${SR_UID_ROOT}.${ts}`

    const findings = dto.findings ?? report.findings ?? ''
    const impression = dto.impression ?? (report.impression || report.conclusion) ?? ''

    const content = this.buildContentTree(report, dto.templateId, template.labelEn, findings, impression, {
      studyUID,
      seriesUID,
      sopUID,
    })
    const rawContent = this.buildDicomSrText(content, sopUID)

    const data = {
      tenantId: 'default',
      reportId: dto.reportId,
      templateId: dto.templateId,
      tid: template.tid,
      content: content as object,
      rawContent,
      status: 'draft' as const,
      sopInstanceUid: sopUID,
      studyInstanceUid: studyUID,
      seriesInstanceUid: seriesUID,
      sopClassUid: SR_SOP_CLASS[dto.templateId],
      hl7ControlId: null,
      hl7Message: null,
      pushedAt: null,
    }

    const row = existing
      ? await this.prisma.srDocument.update({ where: { id: existing.id }, data })
      : await this.prisma.srDocument.create({ data })

    this.logger.log(`SR document ${row.id} generated for report ${dto.reportId} (${dto.templateId})`)
    return this.toDto(row)
  }

  /**
   * [G005 Wave4A] G-14 AI 结果 → DICOM SR 封装 (TID 2000 CAD SR 默认)
   * 输入 { studyId, findings: AiFinding[] } → 解析检查/患者上下文, 复用 SR 内容树+文本生成逻辑入库
   * 检查下存在报告则复用报告生成; 无报告时创建最小报告承载 SR 文档 (reportId FK)
   */
  async fromAi(dto: FromAiSrDto): Promise<SrDocumentDto> {
    const templateId = dto.templateId ?? 'tid2000'
    const template = this.templates.find((t) => t.id === templateId)
    if (!template) throw new NotFoundException(`Template ${templateId} not found`)

    const exam = await this.prisma.exam.findUnique({
      where: { id: dto.studyId },
      include: { patient: true },
    })
    if (!exam) throw new NotFoundException(`Exam ${dto.studyId} not found (AI SR 封装)`)

    const findingsText = this.buildAiFindingsText(dto.findings, dto.summary)
    let report = await this.prisma.report.findFirst({ where: { examId: dto.studyId } })
    if (!report) {
      report = await this.prisma.report.create({
        data: {
          tenantId: exam.tenantId,
          patientId: exam.patientId,
          examId: exam.id,
          findings: findingsText,
          impression: dto.summary ?? '',
          conclusion: dto.summary ?? '',
        },
      })
    }

    const ts = Date.now()
    const existing = await this.prisma.srDocument.findFirst({
      where: { reportId: report.id, templateId },
    })
    const studyUID = `1.2.840.10008.5.1.4.1.1.2.1.${ts}`
    const seriesUID = `${studyUID}.SR.1`
    const sopUID = existing?.sopInstanceUid ?? `${SR_UID_ROOT}.${ts}`

    const content = this.buildAiContentTree(exam, template, dto, findingsText, report.id, {
      studyUID,
      seriesUID,
      sopUID,
    })
    const rawContent = this.buildDicomSrText(content, sopUID)

    const data = {
      tenantId: 'default',
      reportId: report.id,
      templateId,
      tid: template.tid,
      content: content as object,
      rawContent,
      status: 'draft' as const,
      sopInstanceUid: sopUID,
      studyInstanceUid: studyUID,
      seriesInstanceUid: seriesUID,
      sopClassUid: SR_SOP_CLASS[templateId],
      hl7ControlId: null,
      hl7Message: null,
      pushedAt: null,
    }

    const row = existing
      ? await this.prisma.srDocument.update({ where: { id: existing.id }, data })
      : await this.prisma.srDocument.create({ data })

    this.logger.log(`SR document ${row.id} created from AI results for exam ${dto.studyId} (${templateId})`)
    return this.toDto(row)
  }

  private buildAiFindingsText(findings: AiSrFinding[], summary?: string): string {
    const lines = findings.map((f) => {
      const conf = f.confidence !== undefined ? ` (置信度 ${Math.round(f.confidence * 100)}%)` : ''
      const loc =
        f.x !== undefined && f.y !== undefined
          ? ` @(${Math.round(f.x * 100)},${Math.round(f.y * 100)})${f.width !== undefined && f.height !== undefined ? ` ${Math.round(f.width * 100)}×${Math.round(f.height * 100)}px` : ''}`
          : ''
      return `${f.label}${conf}${loc}${f.description ? `: ${f.description}` : ''}`
    })
    if (summary) lines.push(`AI 总结: ${summary}`)
    return lines.join('\n')
  }

  /** AI 结果内容树: findings + TID 2000 CAD 汇总段 (逐发现条目 + SNOMED 编码) */
  private buildAiContentTree(
    exam: {
      tenantId: string
      accessionNumber: string
      modality: string
      bodyPart: string
      startedAt?: Date | null
      patient?: { name: string; idCard?: string | null; birthDate?: Date | null; gender?: string } | null
    },
    template: TemplateInfo,
    dto: FromAiSrDto,
    findingsText: string,
    reportId: string,
    uids: { studyUID: string; seriesUID: string; sopUID: string },
  ): SrContentTree {
    const patient = exam.patient
    const genderMap: Record<string, string> = { MALE: 'M', FEMALE: 'F', OTHER: 'O' }
    const textItem = (code: string, meaning: string, value: string): SrContentItem => ({
      relationshipType: 'CONTAINS',
      conceptName: DCM_CONCEPT(code, meaning),
      valueType: 'TEXT',
      value: value || '(empty)',
    })
    const codedItem = (c: SrConceptName, value: string): SrContentItem => ({
      relationshipType: 'CONTAINS',
      conceptName: DCM_CONCEPT('121071', 'Finding'),
      valueType: 'CODE',
      value,
      code: c,
    })

    const sections: SrSection[] = []
    if (findingsText) {
      sections.push({
        ...CONTENT_TITLES.history,
        items: [textItem('121071', 'Finding', findingsText), ...toSnomed(findingsText).map((c) => codedItem(c, c.meaning))],
      })
    }
    // TID 2000 CAD Processing and Findings Summary: 逐条 AI 检出
    const cadItems: SrContentItem[] = dto.findings.map((f) => {
      const conf = f.confidence !== undefined ? `, 置信度 ${Math.round(f.confidence * 100)}%` : ''
      const coord = f.x !== undefined && f.y !== undefined ? `, 坐标(${Math.round(f.x * 100)},${Math.round(f.y * 100)})` : ''
      return textItem('121071', 'Finding', `${f.label}${conf}${coord}`)
    })
    sections.push({ ...CONTENT_TITLES.cadSummary, items: cadItems })
    if (dto.summary) {
      sections.push({ ...CONTENT_TITLES.impression, items: [textItem('121073', 'Impression', dto.summary)] })
    }

    const report = {
      id: reportId,
      authorId: 'AI-ENGINE',
      authorName: dto.modelName ?? 'AI Engine',
      findings: findingsText,
      impression: dto.summary ?? '',
      conclusion: dto.summary ?? '',
      recommendations: '',
      reportDate: fmtDate(new Date()),
    }

    return {
      templateId: templateIdLabel(dto.templateId ?? 'tid2000'),
      templateLabel: template.labelEn,
      context: {
        patient: {
          name: patient?.name ?? '',
          id: patient?.idCard ?? '',
          birthDate: patient?.birthDate ? fmtDate(patient.birthDate) : '',
          sex: patient?.gender ? (genderMap[patient.gender] ?? 'O') : 'O',
        },
        study: {
          uid: uids.studyUID,
          date: exam.startedAt ? fmtDate(exam.startedAt) : fmtDate(new Date()),
          time: exam.startedAt ? fmtTime(exam.startedAt) : fmtTime(new Date()),
          description: exam.bodyPart ?? '',
          accessionNumber: exam.accessionNumber ?? '',
          modality: exam.modality ?? 'SR',
        },
        report,
      },
      sections,
      codedEntries: toSnomed(findingsText),
    }
  }

  /**
   * [G005 Wave4B] G-01 DICOM PDF 封装 (Encapsulated PDF Storage)
   * 输入 { reportId 或 studyId, pdfUrl 或 pdfBase64 } → 元数据对象
   * 无 PDF 输入时从 Report 内容生成 PDF 文本流兜底 (base64)
   */
  async encapsulatePdf(dto: EncapsulatePdfDto): Promise<EncapsulatedPdf> {
    let reportId = dto.reportId
    let studyUid = ''
    let patientName = ''

    if (!reportId && dto.studyId) {
      const exam = await this.prisma.exam.findUnique({
        where: { id: dto.studyId },
        include: { patient: { select: { name: true } }, reports: { select: { id: true }, orderBy: { updatedAt: 'desc' as const }, take: 1 } },
      })
      if (!exam) throw new NotFoundException(`Exam ${dto.studyId} not found (PDF 封装)`)
      studyUid = `1.2.840.10008.5.1.4.1.1.2.1.${dto.studyId}`
      patientName = exam.patient?.name ?? ''
      reportId = exam.reports[0]?.id
    }

    const report = reportId
      ? await this.prisma.report.findUnique({
          where: { id: reportId },
          include: { patient: { select: { name: true } }, exam: { select: { accessionNumber: true } } },
        })
      : null
    if (reportId && !report) throw new NotFoundException(`Report ${reportId} not found (PDF 封装)`)
    reportId = report?.id ?? reportId ?? `pdf-${Date.now()}-${++this.seq}`
    studyUid = studyUid || (report?.exam?.accessionNumber ? `1.2.840.10008.5.1.4.1.1.2.1.${report.exam.accessionNumber}` : `1.2.840.10008.5.1.4.1.1.2.1.${Date.now()}.${++this.seq}`)
    patientName = patientName || (report?.patient?.name ?? '')

    let pdfEmbedded = ''
    let generatedFrom: EncapsulatedPdf['generatedFrom'] = 'input'
    if (dto.pdfBase64 && dto.pdfBase64.trim()) {
      pdfEmbedded = dto.pdfBase64.trim()
      generatedFrom = 'input'
    } else if (dto.pdfUrl && dto.pdfUrl.trim()) {
      pdfEmbedded = `url:${dto.pdfUrl.trim()}`
      generatedFrom = 'url'
    } else {
      // 兜底: 从报告内容生成 PDF 文本流
      const text = [
        '%PDF-1.4 Encapsulated PDF Stream (generated by G005 RIS)',
        `Report: ${reportId}`,
        `Patient: ${patientName}`,
        `Study UID: ${studyUid}`,
        `Findings: ${report?.findings ?? ''}`,
        `Impression: ${report?.impression ?? ''}`,
        `Conclusion: ${report?.conclusion ?? ''}`,
        `Generated At: ${new Date().toISOString()}`,
      ].join('\n')
      pdfEmbedded = Buffer.from(text, 'utf-8').toString('base64')
      generatedFrom = 'report-text'
    }

    const doc: EncapsulatedPdf = {
      id: `pdf-${Date.now().toString(36)}-${this.encapsulatedPdfs.size + 1}-${++this.seq}`,
      reportId,
      sopClassUid: PDF_SOP_CLASS_UID,
      sopInstanceUid: `1.2.840.10008.5.1.4.1.1.104.1.${Date.now()}.${++this.seq}`,
      studyInstanceUid: studyUid,
      pdfEmbedded,
      size: pdfEmbedded.length,
      generatedFrom,
      generatedAt: new Date().toISOString(),
    }
    this.encapsulatedPdfs.set(doc.id, doc)
    this.logger.log(`Encapsulated PDF ${doc.id} created for report ${reportId} (${generatedFrom})`)
    return doc
  }

  findEncapsulated(id: string): EncapsulatedPdf {
    const doc = this.encapsulatedPdfs.get(id)
    if (!doc) throw new NotFoundException(`Encapsulated PDF ${id} not found`)
    return doc
  }

  async finalize(id: string): Promise<SrDocumentDto> {
    const row = await this.prisma.srDocument.findUnique({ where: { id } })
    if (!row) throw new NotFoundException(`SR document ${id} not found`)
    if (row.status === 'pushed') {
      throw new BadRequestException('SR document already pushed to HIS, cannot finalize after push')
    }
    const updated = await this.prisma.srDocument.update({
      where: { id },
      data: { status: 'finalized' },
    })
    return this.toDto(updated)
  }

  /** SR 内容组装 HL7 ORU^R01(内容转 OBX 段)并推送,标记 PUSHED */
  async pushOru(id: string): Promise<{ document: SrDocumentDto; oru: { message: string; controlId: string; pushed: boolean; ackStatus: string } }> {
    const row = await this.prisma.srDocument.findUnique({ where: { id } })
    if (!row) throw new NotFoundException(`SR document ${id} not found`)

    const tree = row.content as unknown as SrContentTree
    const findings = tree.sections.find((s) => s.conceptName.code === '121071')?.items.map((i) => i.value ?? '').filter(Boolean).join('\n')
      ?? tree.context.report.findings
    const conclusion = tree.context.report.conclusion || tree.context.report.impression

    const oruInput: ReportForHL7 = {
      accessionNumber: tree.context.study.accessionNumber,
      patientName: tree.context.patient.name,
      patientId: tree.context.patient.id,
      patientSex: (tree.context.patient.sex === 'M' || tree.context.patient.sex === 'F' || tree.context.patient.sex === 'O') ? tree.context.patient.sex : 'O',
      patientBirthDate: tree.context.patient.birthDate || undefined,
      modality: tree.context.study.modality,
      studyDate: tree.context.study.date || '',
      studyTime: tree.context.study.time || '',
      findings: findings ?? '',
      conclusion: conclusion ?? '',
      authorName: tree.context.report.authorName,
      authorId: tree.context.report.authorId,
      reportId: row.reportId,
    }

    const result = await this.hl7.buildAndPushOru(oruInput)

    const updated = await this.prisma.srDocument.update({
      where: { id },
      data: {
        status: 'pushed',
        hl7ControlId: result.controlId,
        hl7Message: result.message,
        pushedAt: new Date(),
      },
    })
    this.logger.log(`SR document ${id} pushed ORU^R01 controlId=${result.controlId} pushed=${result.pushed}`)
    return { document: this.toDto(updated), oru: result }
  }

  // ─────────────────────── 内容树构建 ───────────────────────

  private buildContentTree(
    report: {
      id: string
      findings: string
      impression: string
      conclusion: string
      recommendations: string
      createdAt: Date
      patient?: { name: string; idCard?: string | null; birthDate?: Date | null; gender?: string } | null
      exam?: { accessionNumber?: string; modality?: string; bodyPart?: string; startedAt?: Date | null } | null
      radiologist?: { id?: string; fullName?: string } | null
    },
    templateId: GenerateSrDto['templateId'],
    templateLabel: string,
    findings: string,
    impression: string,
    uids: { studyUID: string; seriesUID: string; sopUID: string },
  ): SrContentTree {
    const patient = report.patient
    const exam = report.exam
    const genderMap: Record<string, string> = { MALE: 'M', FEMALE: 'F', OTHER: 'O' }

    const textItem = (code: string, meaning: string, value: string, rel = 'CONTAINS'): SrContentItem => ({
      relationshipType: rel,
      conceptName: DCM_CONCEPT(code, meaning),
      valueType: 'TEXT',
      value: value || '(empty)',
    })
    const codedItem = (c: SrConceptName, value: string): SrContentItem => ({
      relationshipType: 'CONTAINS',
      conceptName: DCM_CONCEPT('121071', 'Finding'),
      valueType: 'CODE',
      value,
      code: c,
    })

    const sections: SrSection[] = []
    if (findings) {
      const snomed = toSnomed(findings)
      const findingItems: SrContentItem[] = [textItem('121071', 'Finding', findings)]
      if (snomed.length > 0) {
        findingItems.push(...snomed.map((c) => codedItem(c, c.meaning)))
      }
      sections.push({ ...CONTENT_TITLES.history, items: findingItems })
    }
    if (impression) {
      const snomed = toSnomed(impression)
      const impressionItems: SrContentItem[] = [textItem('121073', 'Impression', impression)]
      if (snomed.length > 0) {
        impressionItems.push(...snomed.map((c) => codedItem(c, c.meaning)))
      }
      sections.push({ ...CONTENT_TITLES.impression, items: impressionItems })
    }
    if (report.recommendations) {
      sections.push({
        ...CONTENT_TITLES.recommendation,
        items: [textItem('121074', 'Recommendation', report.recommendations)],
      })
    }

    const codedEntries = toSnomed(`${findings}\n${impression}`)

    return {
      templateId: templateId === 'tid1500' ? 'TID 1500' : 'TID 2000',
      templateLabel,
      context: {
        patient: {
          name: patient?.name ?? '',
          id: patient?.idCard ?? '',
          birthDate: patient?.birthDate ? fmtDate(patient.birthDate) : '',
          sex: patient?.gender ? (genderMap[patient.gender] ?? 'O') : 'O',
        },
        study: {
          uid: uids.studyUID,
          date: exam?.startedAt ? fmtDate(exam.startedAt) : fmtDate(new Date()),
          time: exam?.startedAt ? fmtTime(exam.startedAt) : fmtTime(new Date()),
          description: exam?.bodyPart ?? '',
          accessionNumber: exam?.accessionNumber ?? '',
          modality: exam?.modality ?? 'SR',
        },
        report: {
          id: report.id,
          authorId: report.radiologist?.id ?? '',
          authorName: report.radiologist?.fullName ?? '',
          findings: report.findings ?? '',
          impression: report.impression ?? '',
          conclusion: report.conclusion ?? '',
          recommendations: report.recommendations ?? '',
          reportDate: fmtDate(report.createdAt),
        },
      },
      sections,
      codedEntries,
    }
  }

  /** 生成 DICOM SR 文本文件(DCMTK 可解析的 Part10 风格 dataset) */
  private buildDicomSrText(content: SrContentTree, sopUID: string): string {
    const now = new Date()
    const studyDate = content.context.study.date || fmtDate(now)
    const studyTime = content.context.study.time || fmtTime(now)
    const sopClassUid = content.templateId === 'TID 1500' ? SR_SOP_CLASS.tid1500 : SR_SOP_CLASS.tid2000

    const lines: string[] = [
      '# DICOM Structured Report',
      `# DICOM Standard: PS 3.3-2024 (TID ${content.templateId === 'TID 1500' ? '1500' : '2000'})`,
      `# SOP Class: ${content.templateLabel} (${content.templateId})`,
      `# SOP Instance UID: ${sopUID}`,
      `# Study Instance UID: ${content.context.study.uid}`,
      `# Series Instance UID: ${content.context.study.uid}.SR.1`,
      `# Study Date: ${studyDate}`,
      `# Study Time: ${studyTime}`,
      `# Patient: ${content.context.patient.name} (${content.context.patient.id})`,
      `# Accession: ${content.context.study.accessionNumber}`,
      `# Report ID: ${content.context.report.id}`,
      `# Generated: ${now.toISOString()}`,
      '#',
      '(00080005) CS = ISO_IR 100',
      `(00080016) UI = ${sopClassUid}`,
      `(00080018) UI = ${sopUID}`,
      `(00080020) DA = ${studyDate}`,
      `(00080030) TM = ${studyTime}`,
      `(00080050) SH = ${content.context.study.accessionNumber}`,
      `(0008103E) LO = ${content.context.study.description || 'Structured Report'}`,
      '(00080060) CS = SR',
      `(00100010) PN = ${content.context.patient.name}`,
      `(00100020) LO = ${content.context.patient.id}`,
      content.context.patient.birthDate ? `(00100030) DA = ${content.context.patient.birthDate}` : '',
      `(00100040) CS = ${content.context.patient.sex}`,
      `(0020000D) UI = ${content.context.study.uid}`,
      `(0020000E) UI = ${content.context.study.uid}.SR.1`,
      '(0040A040) CS = VERIFIED',
      '(0040A491) CS = COMPLETE',
      `(0040A504) SQ (Template Identifier)`,
      `  (0040DB00) CS = ${content.templateId}`,
      `  (0040DB01) LO = ${content.templateLabel}`,
      '(0040A730) SQ (Content Sequence)',
    ]

    for (const section of content.sections) {
      lines.push(`  (0040A010) SQ (Content Item)`, `    (0040A040) CS = CONTAINS`, `    (0040A043) SQ (Concept Name Code Sequence)`)
      lines.push(`      (00080100) SH = ${section.conceptName.code}`)
      lines.push(`      (00080102) SH = ${section.conceptName.scheme}`)
      lines.push(`      (00080104) LO = ${section.conceptName.meaning}`)
      lines.push(`    (0040A730) SQ (Content Sequence)`)
      for (const item of section.items) {
        lines.push(`      (0040A010) SQ (Content Item)`, `        (0040A040) CS = ${item.relationshipType}`, `        (0040A043) SQ (Concept Name Code Sequence)`)
        lines.push(`          (00080100) SH = ${item.conceptName.code}`)
        lines.push(`          (00080102) SH = ${item.conceptName.scheme}`)
        lines.push(`          (00080104) LO = ${item.conceptName.meaning}`)
        if (item.valueType === 'CODE' && item.code) {
          lines.push(`        (0040A168) SQ (Concept Code Sequence)`)
          lines.push(`          (00080100) SH = ${item.code.code}`)
          lines.push(`          (00080102) SH = ${item.code.scheme}`)
          lines.push(`          (00080104) LO = ${item.code.meaning}`)
          lines.push(`        (0040A160) UT = ${item.value ?? ''}`)
        } else {
          lines.push(`        (0040A160) UT = ${item.value ?? ''}`)
        }
      }
    }

    lines.push('# ===== End of SR =====')
    return lines.filter((l, i) => !(i > 0 && l === '')).join('\n')
  }

  private toDto(row: SrRow): SrDocumentDto {
    const tree = row.content as unknown as SrContentTree
    return {
      id: row.id,
      reportId: row.reportId,
      templateId: row.templateId,
      tid: row.tid,
      status: (row.status as SrStatus) ?? 'draft',
      sopInstanceUid: row.sopInstanceUid,
      studyInstanceUid: row.studyInstanceUid,
      seriesInstanceUid: row.seriesInstanceUid,
      sopClassUid: row.sopClassUid,
      patientName: tree?.context?.patient?.name ?? '',
      patientId: tree?.context?.patient?.id ?? '',
      modality: tree?.context?.study?.modality ?? '',
      title: `${tree?.templateLabel ?? row.templateId} / ${tree?.context?.report?.impression?.slice(0, 24) ?? ''}`,
      content: tree,
      rawContent: row.rawContent,
      hl7ControlId: row.hl7ControlId,
      hl7Message: row.hl7Message,
      pushedAt: row.pushedAt ? row.pushedAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }
  }
}
