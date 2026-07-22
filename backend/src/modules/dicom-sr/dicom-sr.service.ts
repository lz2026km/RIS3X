import { Injectable, NotFoundException } from '@nestjs/common'

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

export interface SrDocument {
  id: string
  reportId: string
  templateId: string
  tid: string
  content: string
  status: string
  generatedAt: string
  sopInstanceUID: string
}

@Injectable()
export class DicomSrService {
  private templates: TemplateInfo[] = [
    { id: 'tid1500', label: 'TID 1500 - 测量报告', labelEn: 'TID 1500 - Measurement Report', description: 'Imaging Measurement Report (DICOM PS 3.3 TID 1500)', tid: '1500' },
    { id: 'tid2000', label: 'TID 2000 - CAD SR', labelEn: 'TID 2000 - CAD Document SR', description: 'Computer-Aided Detection/Diagnosis SR (DICOM PS 3.3 TID 2000)', tid: '2000' },
  ]
  private documents: SrDocument[] = []

  getTemplates(): TemplateInfo[] {
    return this.templates
  }

  generate(dto: GenerateSrDto): SrDocument {
    const template = this.templates.find(t => t.id === dto.templateId)
    if (!template) throw new NotFoundException(`Template ${dto.templateId} not found`)

    const ts = Date.now()
    const sopInstanceUID = `1.2.840.10008.5.1.4.1.1.88.11.1.${ts}`

    let content: string
    if (dto.templateId === 'tid1500') {
      content = this.buildTid1500(dto, sopInstanceUID)
    } else {
      content = this.buildTid2000(dto, sopInstanceUID)
    }

    const doc: SrDocument = {
      id: `sr-${ts}`,
      reportId: dto.reportId,
      templateId: dto.templateId,
      tid: template.tid,
      content,
      status: 'GENERATED',
      generatedAt: new Date().toISOString(),
      sopInstanceUID,
    }
    this.documents.push(doc)
    return doc
  }

  findById(id: string): SrDocument | null {
    return this.documents.find(d => d.id === id) ?? null
  }

  private buildTid1500(dto: GenerateSrDto, sopUID: string): string {
    return this.buildDicomSr({
      templateId: 'TID 1500',
      templateLabel: 'Imaging Measurement Report',
      contentItems: [
        { name: '121060', label: 'History / 历史发现', value: dto.findings ?? '' },
        { name: '121073', label: 'Impression / 印象', value: dto.impression ?? '' },
        { name: '125007', label: 'Measurement Group / 测量组', value: '' },
        { name: '112040', label: 'Tracking Identifier / 追踪标识', value: dto.reportId },
      ],
      sopInstanceUID: sopUID,
    })
  }

  private buildTid2000(dto: GenerateSrDto, sopUID: string): string {
    return this.buildDicomSr({
      templateId: 'TID 2000',
      templateLabel: 'CAD Document SR',
      contentItems: [
        { name: '121071', label: 'CAD Finding / CAD 发现', value: dto.findings ?? '' },
        { name: '121073', label: 'Impressions / 印象', value: dto.impression ?? '' },
        { name: '121074', label: 'Recommendation / 建议', value: '' },
        { name: '121120', label: 'CAD Processing and Findings Summary / CAD 处理总结', value: '' },
      ],
      sopInstanceUID: sopUID,
    })
  }

  private buildDicomSr(opts: {
    templateId: string
    templateLabel: string
    contentItems: { name: string; label: string; value: string }[]
    sopInstanceUID: string
  }): string {
    const now = new Date()
    const studyDate = now.toISOString().slice(0, 10).replace(/-/g, '')
    const studyTime = now.toISOString().slice(11, 19).replace(/:/g, '')
    const studyUID = `1.2.840.10008.5.1.4.1.1.2.1.${Date.now()}`
    const seriesUID = `${sopUID}.99`

    const items = opts.contentItems
      .map((item, i) => {
        const relType = item.value ? 'CONTAINS' : 'CONTAINS'
        const val = item.value || '(empty)'
        return `  (0040A010) SQ (Content Item)
    (0040A040) CS = ${relType}
    (0040A043) SQ (Concept Name Code Sequence)
      (00080100) SH = DCM
      (00080102) SH = ${item.name}
      (00080104) LO = ${item.label}
    (0040A160) UT = ${val}`
      })
      .join('\n')

    return `# DICOM Structured Report
# DICOM Standard: PS 3.3-2024
# SOP Class: ${opts.templateLabel} (${opts.templateId})
# SOP Instance UID: ${opts.sopInstanceUID}
# Study Instance UID: ${studyUID}
# Series Instance UID: ${seriesUID}
# Study Date: ${studyDate}
# Study Time: ${studyTime}
# Report ID: ${this.documents.length + 1}
# Generated: ${now.toISOString()}
#
(00080005) CS = ISO_IR 100
(00080016) UI = 1.2.840.10008.5.1.4.1.1.88.11
(00080018) UI = ${opts.sopInstanceUID}
(00080020) DA = ${studyDate}
(00080030) TM = ${studyTime}
(00080060) CS = SR
(0020000D) UI = ${studyUID}
(0020000E) UI = ${seriesUID}
(0040A040) CS = VERIFIED
(0040A491) CS = COMPLETE
(0040A504) SQ (Template Identifier)
  (0040DB00) CS = ${opts.templateId}
  (0040DB01) LO = ${opts.templateLabel}
(0040A730) SQ (Content Sequence)
${items}
# ===== End of SR =====`
  }
}
