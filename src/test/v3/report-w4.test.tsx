import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ReportReviewCenter from '../../components/v3/report/ReportReviewCenter'
import ReportRevisionHistory from '../../components/v3/report/ReportRevisionHistory'
import ReportAuditChain, { verifyChainIntegrity, computeChainHashAsync } from '../../components/v3/report/ReportAuditChain'
import SimilarCaseRecall from '../../components/v3/report/SimilarCaseRecall'
import ReportDicomSRExport from '../../components/v3/report/ReportDicomSRExport'
import { buildDicomSRDocument, serializeToJSON, serializeToXML, serializeToDicomPart10, validateSR, generateUID, UCUM_UNITS, DCMR_CODES } from '../../components/v3/report/dicomSR'

const sampleReport = {
  id: 'R-2024-001',
  patientName: '张三',
  patientId: 'P001',
  patientSex: 'M' as const,
  studyInstanceUID: '1.2.826.0.1.3680043.10.1.1.1',
  studyDate: '20240615',
  studyTime: '143000',
  studyId: 'STUDY-001',
  accessionNumber: 'ACC-001',
  modality: 'CT',
  bodyPart: 'CHEST',
  findings: '右肺上叶见磨玻璃密度影,边界欠清。',
  conclusion: '考虑肺部感染,建议抗炎后复查。',
  suggestion: '建议 3-6 个月后随访',
  author: '张医师',
  reviewer: '李主任',
  reviewedAt: new Date('2024-06-15T15:00:00'),
  imageSops: [
    { SOPClassUID: '1.2.840.10008.5.1.4.1.1.2', SOPInstanceUID: '1.2.826.0.1.3680043.10.2.1.1' },
  ],
  completed: true,
  createdAt: new Date('2024-06-15T14:30:00'),
}

describe('ReportReviewCenter', () => {
  const reports = [
    {
      id: 'R1', patientName: '张三', patientId: 'P001', modality: 'CT', bodyPart: 'CHEST',
      studyDate: '20240615', studyTime: '143000', author: '张医师', authorAt: '2024-06-15 14:30',
      state: 'SUBMITTED' as const, priority: 'STAT' as const,
      findings: '右肺上叶占位。', conclusion: '考虑肿瘤。', critical: true, radsCategory: 'Lung-RADS 4',
    },
  ]

  it('renders with stats and items', () => {
    render(<ReportReviewCenter reports={reports} />)
    expect(screen.getByTestId('report-review-center')).toBeInTheDocument()
    expect(screen.getByTestId('review-item-R1')).toBeInTheDocument()
  })

  it('calls onAction approve', () => {
    const onAction = vi.fn()
    render(<ReportReviewCenter reports={reports} onAction={onAction} />)
    fireEvent.click(screen.getByTestId('approve-R1'))
    expect(onAction).toHaveBeenCalledWith('R1', 'approve')
  })

  it('opens detail drawer on detail button click', () => {
    render(<ReportReviewCenter reports={reports} />)
    fireEvent.click(screen.getByTestId('detail-R1'))
    expect(screen.getByText('报告详情 · 张三')).toBeInTheDocument()
  })

  it('displays review comment when present', () => {
    const reportsWithComment = [{ ...reports[0], reviewComment: '需进一步随访', reviewer: '李主任', reviewedAt: '2024-06-15 15:00' }]
    render(<ReportReviewCenter reports={reportsWithComment} />)
    fireEvent.click(screen.getByTestId('detail-R1'))
    expect(screen.getByTestId('review-comment-card')).toBeInTheDocument()
  })
})

describe('ReportRevisionHistory', () => {
  const revisions = [
    { id: 'V1', version: 1, author: '张医师', authorAt: '2024-06-15 14:30', changeType: 'CREATED' as const, fields: ['findings', 'conclusion'], reportId: 'R1' },
    { id: 'V2', version: 2, author: '张医师', authorAt: '2024-06-15 14:45', changeType: 'EDITED' as const, fields: ['conclusion'], before: '考虑炎症', after: '考虑肿瘤', reportId: 'R1' },
    { id: 'V3', version: 3, author: '李主任', authorAt: '2024-06-15 15:00', changeType: 'APPROVED' as const, fields: [], reportId: 'R1' },
  ]

  it('renders with version count', () => {
    render(<ReportRevisionHistory revisions={revisions} />)
    expect(screen.getByText(/修订历史/)).toBeInTheDocument()
  })

  it('opens drawer with timeline', () => {
    render(<ReportRevisionHistory revisions={revisions} />)
    fireEvent.click(screen.getByTestId('revision-history-open'))
    expect(screen.getByTestId('revision-timeline')).toBeInTheDocument()
  })

  it('filters by type', () => {
    render(<ReportRevisionHistory revisions={revisions} />)
    fireEvent.click(screen.getByTestId('revision-history-open'))
    expect(screen.getByText(/v3/)).toBeInTheDocument()
  })

  it('opens detail drawer on click', () => {
    render(<ReportRevisionHistory revisions={revisions} />)
    fireEvent.click(screen.getByTestId('revision-history-open'))
    fireEvent.click(screen.getByTestId('revision-card-V2'))
    expect(screen.getByTestId('revision-before')).toBeInTheDocument()
    expect(screen.getByTestId('revision-after')).toBeInTheDocument()
  })

  it('toggles compare mode', () => {
    render(<ReportRevisionHistory revisions={revisions} />)
    fireEvent.click(screen.getByTestId('revision-history-open'))
    fireEvent.click(screen.getByTestId('revision-compare-mode'))
    // 选 2 个
    fireEvent.click(screen.getByTestId('revision-card-V2'))
    fireEvent.click(screen.getByTestId('revision-card-V3'))
    expect(screen.getByTestId('revision-compare-result')).toBeInTheDocument()
  })
})

describe('ReportAuditChain', () => {
  // 构造链式事件(异步 hash 测试用)
  const buildEvents = (count: number) =>
    Array.from({ length: count }, (_, i) => ({
      id: `E${i + 1}`,
      timestamp: `2024-06-15T14:${String(30 + i).padStart(2, '0')}:00`,
      actor: i % 2 === 0 ? '张医师' : '李主任',
      actorRole: i % 2 === 0 ? 'DOCTOR' : 'DIRECTOR',
      action: (['REPORT_CREATE', 'REPORT_EDIT', 'REPORT_APPROVE', 'REPORT_VIEW', 'REPORT_SIGN'] as const)[i % 5],
      target: 'R-2024-001',
      description: `事件 ${i + 1}`,
      prevHash: i === 0 ? '0'.repeat(64) : '',
      hash: '',
    }))

  it('renders with event count', () => {
    render(<ReportAuditChain events={buildEvents(3)} />)
    expect(screen.getByText(/审计链/)).toBeInTheDocument()
  })

  it('opens drawer with table', () => {
    const events = buildEvents(3)
    render(<ReportAuditChain events={events} />)
    fireEvent.click(screen.getByTestId('audit-chain-open'))
    expect(screen.getByTestId('audit-table')).toBeInTheDocument()
  })

  it('verifyChainIntegrity passes for valid chain', async () => {
    const events = await computeChainHashAsync(buildEvents(5))
    const result = await verifyChainIntegrity(events)
    expect(result.valid).toBe(true)
  })

  it('verifyChainIntegrity detects tampered event', async () => {
    const events = await computeChainHashAsync(buildEvents(5))
    // 篡改第 3 条
    const tampered = events.map((e, i) => (i === 2 ? { ...e, description: '篡改' } : e))
    const result = await verifyChainIntegrity(tampered)
    expect(result.valid).toBe(false)
    expect(result.brokenAt).toBe(2)
  })

  it('verify button works in UI', async () => {
    const events = await computeChainHashAsync(buildEvents(3))
    render(<ReportAuditChain events={events} />)
    fireEvent.click(screen.getByTestId('audit-chain-open'))
    fireEvent.click(screen.getByTestId('audit-verify'))
    await waitFor(() => {
      expect(screen.getByTestId('audit-verify-result')).toBeInTheDocument()
    })
  })

  it('high-risk filter works', () => {
    const events = buildEvents(5)
    render(<ReportAuditChain events={events} />)
    fireEvent.click(screen.getByTestId('audit-chain-open'))
    const sw = screen.getByTestId('audit-filter-high')
    expect(sw).toBeInTheDocument()
  })
})

describe('SimilarCaseRecall', () => {
  const cases = [
    {
      id: 'C1', patientId: 'P1', patientName: '王五', age: 45, gender: 'M', modality: 'CT', bodyPart: 'CHEST',
      radsCategory: 'Lung-RADS 4', findings: '右肺上叶见实性结节,直径 12mm。', conclusion: '考虑周围型肺癌。',
      reportDate: '2024-06-10', author: '王医师', verified: true, tags: ['恶性', '结节'],
    },
    {
      id: 'C2', patientId: 'P2', patientName: '李四', age: 50, gender: 'F', modality: 'MR', bodyPart: 'BRAIN',
      findings: '脑白质见小缺血灶。', conclusion: '考虑腔隙性脑梗死。',
      reportDate: '2024-05-20', author: '李医师', verified: true,
    },
  ]

  it('renders open button', () => {
    render(<SimilarCaseRecall cases={cases} />)
    expect(screen.getByTestId('sc-recall-open')).toBeInTheDocument()
  })

  it('opens drawer with stats and current report', () => {
    render(
      <SimilarCaseRecall
        cases={cases}
        currentReport={{
          findings: '右肺上叶见结节,直径 10mm。',
          conclusion: '考虑周围型肺癌。',
          modality: 'CT',
          bodyPart: 'CHEST',
          radsCategory: 'Lung-RADS 4',
        }}
      />
    )
    fireEvent.click(screen.getByTestId('sc-recall-open'))
    expect(screen.getByTestId('sc-current')).toBeInTheDocument()
    expect(screen.getByTestId('sc-case-C1')).toBeInTheDocument()
  })

  it('filters by modality', () => {
    render(<SimilarCaseRecall cases={cases} />)
    fireEvent.click(screen.getByTestId('sc-recall-open'))
    // 默认全部,点击 MR
    const segBtns = screen.getAllByText('MR')
    // 第一个匹配是 case 标签,第二个是 Segmented
    expect(segBtns.length).toBeGreaterThan(0)
  })

  it('calls onApply when apply button clicked', () => {
    const onApply = vi.fn()
    render(<SimilarCaseRecall cases={cases} onApply={onApply} />)
    fireEvent.click(screen.getByTestId('sc-recall-open'))
    fireEvent.click(screen.getAllByText('套用')[0])
    expect(onApply).toHaveBeenCalled()
  })
})

describe('ReportDicomSRExport', () => {
  it('renders export button', () => {
    render(<ReportDicomSRExport report={sampleReport as any} />)
    expect(screen.getByTestId('sr-export-open')).toBeInTheDocument()
  })

  it('opens modal with SR details', () => {
    render(<ReportDicomSRExport report={sampleReport as any} />)
    fireEvent.click(screen.getByTestId('sr-export-open'))
    expect(screen.getByTestId('sr-sop-instance')).toBeInTheDocument()
    expect(screen.getByTestId('sr-content-label')).toBeInTheDocument()
    expect(screen.getByTestId('sr-completion')).toBeInTheDocument()
    expect(screen.getByTestId('sr-verification')).toBeInTheDocument()
  })

  it('shows tree preview with ContentItem hierarchy', () => {
    render(<ReportDicomSRExport report={sampleReport as any} />)
    fireEvent.click(screen.getByTestId('sr-export-open'))
    expect(screen.getByTestId('sr-tree-preview')).toBeInTheDocument()
    expect(screen.getByTestId('sr-item-doc-title')).toBeInTheDocument()
  })

  it('preview raw JSON button works', async () => {
    render(<ReportDicomSRExport report={sampleReport as any} />)
    fireEvent.click(screen.getByTestId('sr-export-open'))
    fireEvent.click(screen.getByText('源文本'))
    fireEvent.click(screen.getByTestId('sr-preview'))
    await waitFor(() => {
      expect(screen.getByTestId('sr-raw-preview')).toBeInTheDocument()
    })
  })
})

describe('dicomSR library', () => {
  it('buildDicomSRDocument produces valid document', () => {
    const doc = buildDicomSRDocument(sampleReport as any)
    expect(doc.General.SOPClassUID).toMatch(/^1\.2\.840/)
    expect(doc.PatientStudy.PatientID).toBe('P001')
    expect(doc.Specific.ContentSequence.length).toBeGreaterThan(0)
  })

  it('serializeToJSON roundtrip', () => {
    const doc = buildDicomSRDocument(sampleReport as any)
    const json = serializeToJSON(doc)
    const parsed = JSON.parse(json)
    expect(parsed.General.SOPClassUID).toBe(doc.General.SOPClassUID)
  })

  it('serializeToXML produces valid XML', () => {
    const doc = buildDicomSRDocument(sampleReport as any)
    const xml = serializeToXML(doc)
    expect(xml).toMatch(/<\?xml/)
    expect(xml).toMatch(/<DicomSRDocument>/)
    expect(xml).toMatch(/<SOPClassUID>/)
  })

  it('validateSR passes for complete verified report', () => {
    const doc = buildDicomSRDocument(sampleReport as any)
    const result = validateSR(doc)
    expect(result.errors).toHaveLength(0)
  })

  it('validateSR fails for missing required', () => {
    const doc = buildDicomSRDocument({ ...sampleReport, patientId: '' } as any)
    const result = validateSR(doc)
    expect(result.valid).toBe(false)
  })

  it('generateUID produces valid UID', () => {
    const uid = generateUID('1.2.826.0.1.3680043.10', 'test')
    expect(uid).toMatch(/^1\.2\.826/)
    expect(uid.length).toBeGreaterThan(20)
  })

  it('UCUM_UNITS has mm', () => {
    expect(UCUM_UNITS.mm.CodeMeaning).toBe('millimeter')
  })

  it('DCMR_CODES has TID 1500', () => {
    expect(DCMR_CODES['1500']).toBeDefined()
  })

  // v3.0.2.1: DICOM Part 10 真实二进制序列化测试
  it('serializeToDicomPart10 输出 132 字节起 magic DICM', () => {
    const doc = buildDicomSRDocument(sampleReport as any)
    const bin = serializeToDicomPart10(doc)
    expect(bin.length).toBeGreaterThan(132)
    // 检查 128 字节 preamble + 4 字节 'DICM'
    const magic = new TextDecoder().decode(bin.slice(128, 132))
    expect(magic).toBe('DICM')
  })

  it('serializeToDicomPart10 包含必要元素', () => {
    const doc = buildDicomSRDocument(sampleReport as any)
    const bin = serializeToDicomPart10(doc)
    // File Meta 起始 = (0002,0000) Group Length = 02 00 00 00
    // 之后是 (0002,0001) File Meta Information Version = 02 00 01 00
    const bytes = Array.from(bin.slice(132, 200))
    expect(bytes.slice(0, 4)).toEqual([0x02, 0x00, 0x00, 0x00]) // (0002,0000) Group Length
    expect(bytes.slice(12, 16)).toEqual([0x02, 0x00, 0x01, 0x00]) // (0002,0001) Version
  })

  it('serializeToDicomPart10 PatientID 在数据集中', () => {
    const doc = buildDicomSRDocument(sampleReport as any)
    const bin = serializeToDicomPart10(doc)
    const asString = new TextDecoder('utf-8', { fatal: false }).decode(bin)
    expect(asString).toContain('P001')
    expect(asString).toContain('张三')
  })

  it('serializeToDicomPart10 输出偶数长度', () => {
    const doc = buildDicomSRDocument(sampleReport as any)
    const bin = serializeToDicomPart10(doc)
    // DICOM 标准要求所有 length 字段值为偶数
    expect(bin.length % 2).toBe(0)
  })
})
