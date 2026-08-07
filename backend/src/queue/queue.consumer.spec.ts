/**
 * G005 RIS v3.0.6.11-79 - reportExport 消费者 spec
 * 断言 admin config 值影响导出 HTML 输出: hospital_name(页眉) / report_footer(页脚) / pdf_watermark_text(水印)
 */
import { ReportExportConsumer } from './queue.consumer'

jest.mock('node:fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
  stat: jest.fn().mockResolvedValue({ size: 1024 }),
}))

const fsMock = jest.requireMock('node:fs/promises') as {
  writeFile: jest.Mock
}

const makeReport = () => ({
  id: 'R-1',
  tenantId: 'default',
  state: 'PUBLISHED',
  isCritical: true,
  findings: '右肺上叶斑片影',
  diagnosis: '右上肺炎症',
  impression: '',
  recommendations: '',
  conclusion: '炎症可能',
  signedAt: new Date('2026-08-01T08:00:00Z'),
  publishedAt: new Date('2026-08-01T08:00:00Z'),
  createdAt: new Date('2026-08-01T07:00:00Z'),
  updatedAt: new Date('2026-08-01T08:00:00Z'),
  patient: { id: 'P1', name: '张明远', gender: 'MALE', birthDate: new Date('1990-01-01') },
  exam: { id: 'EX-1', accessionNumber: 'ACC-001', modality: 'CT', bodyPart: '胸部', startedAt: new Date('2026-08-01T06:30:00Z') },
  radiologist: { id: 'U1', fullName: '李医生' },
})

const makeSystemConfig = (values: Record<string, unknown> = {}) => ({
  getString: jest.fn(async (key: string, fallback: string) => {
    const v = values[key]
    // 空串/缺失 → 回退; 显式配置空串表示"关掉水印"
    if (v === '') return ''
    return typeof v === 'string' && v.trim().length > 0 ? v : fallback
  }),
  getNumber: jest.fn(async (_key: string, fb: number) => fb),
  get: jest.fn(),
  invalidate: jest.fn(),
}) as never

const makePrisma = (overrides: Record<string, unknown> = {}) => ({
  report: { findUnique: jest.fn().mockResolvedValue(makeReport()) },
  auditLog: { create: jest.fn().mockResolvedValue({}) },
  ...overrides,
})

const makeConsumer = (prisma: unknown, systemConfig: unknown) =>
  new ReportExportConsumer(prisma as never, systemConfig as never)

describe('ReportExportConsumer (reportExport 消费者)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders hospital_name into the report header', async () => {
    const consumer = makeConsumer(makePrisma(), makeSystemConfig({ hospital_name: '协和医院' }))
    await consumer.handleExport({ data: { reportId: 'R-1', format: 'html', userId: 'U1' } } as never)

    const html = fsMock.writeFile.mock.calls[0]![1] as string
    expect(html).toContain('<h1>协和医院 影像诊断报告</h1>')
    expect(html).not.toContain('G005 放射科信息管理系统 影像诊断报告')
  })

  it('falls back to the default hospital name when config absent', async () => {
    const consumer = makeConsumer(makePrisma(), makeSystemConfig({}))
    await consumer.handleExport({ data: { reportId: 'R-1', format: 'html', userId: 'U1' } } as never)

    const html = fsMock.writeFile.mock.calls[0]![1] as string
    expect(html).toContain('<h1>G005 放射科信息管理系统 影像诊断报告</h1>')
  })

  it('appends report_footer into the export footer', async () => {
    const consumer = makeConsumer(makePrisma(), makeSystemConfig({ report_footer: '内部审核材料，禁止外传' }))
    await consumer.handleExport({ data: { reportId: 'R-1', format: 'html', userId: 'U1' } } as never)

    const html = fsMock.writeFile.mock.calls[0]![1] as string
    expect(html).toContain('<div class="footer">内部审核材料，禁止外传')
  })

  it('renders pdf_watermark_text as a fixed watermark overlay', async () => {
    const consumer = makeConsumer(makePrisma(), makeSystemConfig({ pdf_watermark_text: '机密-内部资料' }))
    await consumer.handleExport({ data: { reportId: 'R-1', format: 'pdf', userId: 'U1' } } as never)

    const html = fsMock.writeFile.mock.calls[0]![1] as string
    expect(html).toContain('<div class="watermark">机密-内部资料</div>')
    expect(html).toContain('.watermark { position: fixed;')
    // 水印非空时内容层 z-index 抬高, 保证水印在底层
    expect(html).toContain('.report-body { position: relative; z-index: 1; }')
  })

  it('omits watermark markup when watermark text is empty', async () => {
    const consumer = makeConsumer(makePrisma(), makeSystemConfig({ pdf_watermark_text: '' }))
    await consumer.handleExport({ data: { reportId: 'R-1', format: 'html', userId: 'U1' } } as never)

    const html = fsMock.writeFile.mock.calls[0]![1] as string
    expect(html).not.toContain('class="watermark"')
  })
})
