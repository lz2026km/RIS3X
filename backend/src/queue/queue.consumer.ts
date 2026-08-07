import { Processor, Process } from '@nestjs/bull'
import { Logger } from '@nestjs/common'
import type { Job } from 'bull'
import type { Prisma, ReportState } from '@prisma/client'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { PrismaService } from '../prisma/prisma.service'
import { Hl7Service, type ReportForHL7 } from '../hl7/hl7.service'
import { AiDiagnosisService } from '../modules/ai-diagnosis/ai-diagnosis.service'
import { SystemConfigService } from '../system-storage/system-config.service'
import { batchExportStore } from './batch-export.store'

export interface ReportExportJobData {
  reportId: string
  format: string
  userId: string
}

export interface BatchExportJobData {
  taskId: string
  ids: string[]
  format: string
  userId: string
}

export interface Hl7SendJobData {
  reportId: string
  destination: string
  payload: string
}

export interface AiInferenceJobData {
  studyId: string
  modality: string
  imageUrls: string[]
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const fmtDate = (d?: Date | string | null): string => (d ? new Date(d).toLocaleString('zh-CN', { hour12: false }) : '—')

const nowStamp = (): string => {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

function audit(
  prisma: PrismaService,
  logger: Logger,
  action: string,
  resource: string,
  resourceId: string | undefined,
  detail: Record<string, unknown>,
  tenantId: string,
): Promise<void> {
  return prisma.auditLog
    .create({ data: { action, resource, resourceId, detail: detail as Prisma.InputJsonValue, tenantId } })
    .then(() => undefined)
    .catch((err) => logger.warn(`audit log write failed: ${(err as Error).message}`))
}

/**
 * reportExport 真实化: 无 PDF 库 → 生成 A4 可打印 HTML 报告文件写入导出目录。
 * 浏览器打开后可直接打印为 PDF; 导出结果(路径/大小)写入 audit_log。
 * [v3.0.6.11-79] 页眉医院名 / 页脚 / 水印 读取 admin config (hospital_name / report_footer / pdf_watermark_text)
 */
@Processor('reportExport')
export class ReportExportConsumer {
  private readonly logger = new Logger(ReportExportConsumer.name)
  private readonly exportDir: string

  constructor(
    private readonly prisma: PrismaService,
    private readonly systemConfig: SystemConfigService,
  ) {
    this.exportDir = process.env['REPORT_EXPORT_DIR'] || path.resolve(process.cwd(), 'exports', 'reports')
  }

  @Process('export')
  async handleExport(job: Job<ReportExportJobData>): Promise<{ filePath: string; fileName: string; sizeBytes: number; format: string }> {
    const { reportId, format, userId } = job.data
    return this.exportOne(reportId, format, userId)
  }

  /**
   * [W4-B] 批量报告导出: 单份任务内循环复用 exportOne 逐份导出,
   * 进度/结果写 batchExportStore, 前端 GET /reports/batch-export/:taskId 轮询。
   */
  @Process('batchExport')
  async handleBatchExport(job: Job<BatchExportJobData>): Promise<{ taskId: string; total: number; done: number; failed: number }> {
    const { taskId, ids, format, userId } = job.data
    batchExportStore.update(taskId, { status: 'running', progress: 0 })
    let failed = 0
    for (let i = 0; i < ids.length; i++) {
      const reportId = ids[i]!
      try {
        const result = await this.exportOne(reportId, format, userId)
        batchExportStore.addDownload(taskId, {
          reportId,
          fileName: result.fileName,
          filePath: result.filePath,
          sizeBytes: result.sizeBytes,
          format: result.format,
          downloadUrl: `/reports/export-files/${encodeURIComponent(result.fileName)}`,
        })
      } catch (err) {
        failed++
        this.logger.warn(`batchExport ${taskId}: report ${reportId} failed: ${(err as Error).message}`)
      }
      batchExportStore.update(taskId, { progress: Math.round(((i + 1) / ids.length) * 100), failedCount: failed })
    }
    batchExportStore.update(taskId, { status: 'completed', progress: 100, failedCount: failed })
    this.logger.log(`Batch export ${taskId} completed: ${ids.length - failed}/${ids.length} exported`)
    return { taskId, total: ids.length, done: ids.length - failed, failed }
  }

  private async exportOne(
    reportId: string,
    format: string,
    userId: string,
  ): Promise<{ filePath: string; fileName: string; sizeBytes: number; format: string }> {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
      include: { patient: true, exam: true, radiologist: { select: { id: true, fullName: true } } },
    })
    if (!report) throw new Error(`Export failed: report ${reportId} not found`)

    const normalized = (format ?? 'html').toLowerCase()
    const [hospitalName, reportFooter, watermarkText] = await Promise.all([
      this.systemConfig.getString('hospital_name', 'G005 放射科信息管理系统'),
      this.systemConfig.getString('report_footer', '本报告仅供临床参考，请结合临床实际情况。'),
      this.systemConfig.getString('pdf_watermark_text', 'G005 RIS 内部资料'),
    ])
    const html = this.buildReportHtml(report as any, normalized, { hospitalName, reportFooter, watermarkText })
    await fs.mkdir(this.exportDir, { recursive: true })
    const fileName = `report-${reportId}-${nowStamp()}.html`
    const filePath = path.join(this.exportDir, fileName)
    await fs.writeFile(filePath, html, 'utf-8')
    const stat = await fs.stat(filePath)

    await audit(this.prisma, this.logger, 'EXPORT_COMPLETED', 'report-export', reportId, {
      reportId,
      requestedFormat: normalized,
      actualFormat: 'html',
      note: normalized === 'pdf' ? 'no pdf library installed; emitted print-ready HTML (browser print-to-PDF)' : undefined,
      filePath,
      sizeBytes: stat.size,
      generatedBy: userId ?? null,
    }, report.tenantId)

    this.logger.log(`Report ${reportId} exported as ${normalized} → ${filePath} (${stat.size} bytes)`)
    return { filePath, fileName, sizeBytes: stat.size, format: normalized }
  }

  private buildReportHtml(r: {
    id: string
    tenantId: string
    state: string
    isCritical: boolean
    findings: string
    diagnosis: string
    impression: string
    recommendations: string
    conclusion: string
    signedAt: Date | null
    publishedAt: Date | null
    createdAt: Date
    updatedAt: Date
    patient?: { id: string; name: string; gender: string; birthDate?: Date | null } | null
    exam?: { id: string; accessionNumber: string; modality: string; bodyPart: string; startedAt?: Date | null } | null
    radiologist?: { id: string; fullName?: string } | null
  }, format: string, opts: { hospitalName: string; reportFooter: string; watermarkText: string }): string {
    const patient = r.patient ?? null
    const exam = r.exam ?? null
    const genderLabel: Record<string, string> = { MALE: '男', FEMALE: '女', OTHER: '其他' }
    const criticalBadge = r.isCritical ? '<span style="color:#b91c1c;font-weight:bold;">危急</span>' : '否'
    const watermarkText = opts.watermarkText.trim()
    const sections: Array<[string, string]> = [
      ['影像所见', r.findings],
      ['诊断意见', r.diagnosis],
      ['印象', r.impression],
      ['结论', r.conclusion],
      ['建议', r.recommendations],
    ]
    const sectionHtml = sections
      .filter(([, text]) => text && text.trim().length > 0)
      .map(
        ([heading, text]) =>
          `<h2 class="section">${escapeHtml(heading)}</h2><div class="content">${escapeHtml(text)}</div>`,
      )
      .join('\n')

    return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8"/>
<title>影像诊断报告 - ${escapeHtml(exam?.accessionNumber ?? r.id)}</title>
<style>
  @page { size: A4; margin: 18mm 16mm; }
  body { font-family: "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", sans-serif; color: #1f2937; font-size: 13px; line-height: 1.7; margin: 0; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f766e; padding-bottom: 10px; margin-bottom: 14px; }
  .header h1 { font-size: 20px; margin: 0 0 4px; color: #0f766e; }
  .meta { font-size: 11px; color: #6b7280; text-align: right; }
  table.info { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
  table.info td { border: 1px solid #d1d5db; padding: 5px 8px; font-size: 12px; }
  table.info td.label { background: #f3f4f6; width: 110px; color: #374151; white-space: nowrap; }
  h2.section { font-size: 14px; color: #0f766e; border-left: 4px solid #0f766e; padding-left: 8px; margin: 16px 0 8px; }
  .content { white-space: pre-wrap; word-break: break-all; }
  .signature { margin-top: 28px; display: flex; justify-content: space-between; font-size: 12px; color: #374151; }
  .footer { margin-top: 30px; border-top: 1px dashed #9ca3af; padding-top: 8px; font-size: 10px; color: #9ca3af; text-align: center; }
  ${watermarkText ? '.watermark { position: fixed; top: 38%; left: 0; width: 100%; text-align: center; font-size: 44px; color: rgba(148,163,184,0.16); transform: rotate(-28deg); pointer-events: none; z-index: 0; white-space: nowrap; letter-spacing: 6px; }\n  .report-body { position: relative; z-index: 1; }' : ''}
</style>
</head>
<body>
${watermarkText ? `<div class="watermark">${escapeHtml(watermarkText)}</div>` : ''}
<div class="report-body">
<header class="header">
  <div>
    <h1>${escapeHtml(opts.hospitalName)} 影像诊断报告</h1>
    <div class="meta">报告单号: ${escapeHtml(r.id)} &nbsp;|&nbsp; 报告状态: ${escapeHtml(r.state)} &nbsp;|&nbsp; 危急: ${criticalBadge}</div>
  </div>
  <div class="meta">生成时间: ${fmtDate(new Date())}<br/>导出格式: ${escapeHtml(format)}</div>
</header>
<table class="info">
  <tr>
    <td class="label">患者姓名</td><td>${escapeHtml(patient?.name ?? '—')}</td>
    <td class="label">性别</td><td>${escapeHtml(genderLabel[patient?.gender ?? ''] ?? '—')}</td>
  </tr>
  <tr>
    <td class="label">病历号</td><td>${escapeHtml(patient?.id ?? '—')}</td>
    <td class="label">出生日期</td><td>${escapeHtml(fmtDate(patient?.birthDate))}</td>
  </tr>
  <tr>
    <td class="label">检查号</td><td>${escapeHtml(exam?.accessionNumber ?? '—')}</td>
    <td class="label">检查设备</td><td>${escapeHtml(exam?.modality ?? '—')}</td>
  </tr>
  <tr>
    <td class="label">检查部位</td><td>${escapeHtml(exam?.bodyPart ?? '—')}</td>
    <td class="label">检查时间</td><td>${escapeHtml(fmtDate(exam?.startedAt))}</td>
  </tr>
</table>
${sectionHtml}
<div class="signature">
  <span>报告医师: ${escapeHtml(r.radiologist?.fullName ?? r.radiologist?.id ?? '—')}</span>
  <span>报告时间: ${escapeHtml(fmtDate(r.signedAt ?? r.publishedAt))}</span>
</div>
<div class="footer">${escapeHtml(opts.reportFooter)}<br/>由 ${escapeHtml(opts.hospitalName)} 自动导出(HTML), 共 ${sectionHtml ? sections.filter(([, t]) => t && t.trim()).length : 0} 个内容章节 · 生成于 ${fmtDate(new Date())}</div>
</div>
</body>
</html>
`
  }
}

/**
 * hl7Send 真实化: 通过 hl7.service MLLP 发送 ORU^R01。
 * - payload 为合法 HL7(MSH 开头)时直接发送, 否则按 reportId 从库组装 ORU 后发送
 * - 目标 = destination(host[:port] / URL) 或 HL7_PUSH_HOST 兜底
 * - 发送失败抛错 → Bull attempts/backoff 自动重试队列
 */
@Processor('hl7Send')
export class Hl7SendConsumer {
  private readonly logger = new Logger(Hl7SendConsumer.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly hl7: Hl7Service,
  ) {}

  @Process('send')
  async handleSend(job: Job<Hl7SendJobData>): Promise<{ reportId: string; destination: string; controlId: string; ackStatus: string }> {
    const { reportId, destination, payload } = job.data
    const { host, port } = this.resolveTarget(destination)

    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
      include: { patient: true, exam: true },
    })
    if (!report) throw new Error(`HL7 send: report ${reportId} not found`)

    let message: string
    if (payload && payload.trim().startsWith('MSH|')) {
      message = payload.trim()
    } else {
      if (!report.exam) throw new Error(`HL7 send: report ${reportId} has no exam linkage; cannot build ORU`)
      const exam = report.exam
      const patient = report.patient
      const oru: ReportForHL7 = {
        accessionNumber: exam.accessionNumber,
        patientName: patient?.name ?? '',
        patientId: report.patientId,
        patientSex: patient?.gender === 'MALE' ? 'M' : patient?.gender === 'FEMALE' ? 'F' : 'O',
        patientBirthDate: patient?.birthDate ? patient.birthDate.toISOString().split('T')[0] : undefined,
        modality: exam.modality,
        studyDate: exam.startedAt ? exam.startedAt.toISOString().split('T')[0] : '',
        studyTime: exam.startedAt ? exam.startedAt.toISOString().split('T')[1]?.split('.')[0] ?? '' : '',
        findings: report.findings,
        conclusion: report.conclusion,
        authorName: '',
        authorId: report.radiologistId ?? '',
        reportId: report.id,
      }
      message = await this.hl7.buildORU(oru)
    }

    const ack = await this.hl7.sendMllpMessage(host, port, message)
    const ackCode = ack.split('\r').find((s) => s.startsWith('MSA'))?.split('|')[1] ?? 'AA'
    const controlId = message.split('\r')[0]?.split('|')[9] ?? `G005-${reportId}`

    await audit(this.prisma, this.logger, 'HL7_SEND_COMPLETED', 'report', reportId, {
      reportId,
      destination: `${host}:${port}`,
      messageType: 'ORU^R01',
      ackStatus: ackCode,
      controlId,
    }, report.tenantId)

    this.logger.log(`HL7 ORU^R01 pushed for report ${reportId} → ${host}:${port}, ack=${ackCode}`)
    return { reportId, destination: `${host}:${port}`, controlId, ackStatus: ackCode }
  }

  private resolveTarget(destination: string): { host: string; port: number } {
    const fallbackHost = process.env['HL7_PUSH_HOST'] ?? ''
    const fallbackPort = Number(process.env['HL7_PUSH_PORT'] ?? 2575)
    let hostPart = (destination ?? '').trim()
    if (!hostPart) {
      if (!fallbackHost) throw new Error('HL7 send: empty destination and HL7_PUSH_HOST not configured')
      return { host: fallbackHost, port: fallbackPort }
    }
    if (hostPart.includes('://')) hostPart = hostPart.slice(hostPart.indexOf('://') + 3)
    const slashIdx = hostPart.indexOf('/')
    if (slashIdx !== -1) hostPart = hostPart.slice(0, slashIdx)
    const colonIdx = hostPart.lastIndexOf(':')
    if (colonIdx !== -1 && /^\d+$/.test(hostPart.slice(colonIdx + 1))) {
      return { host: hostPart.slice(0, colonIdx) || fallbackHost, port: Number(hostPart.slice(colonIdx + 1)) }
    }
    return { host: hostPart, port: fallbackPort }
  }
}

/**
 * aiInference 真实化: 按 modality 调用 ai-diagnosis 确定性推理, 结果写 AiJob。
 * AiJob 生命周期: QUEUED → RUNNING(startedAt) → COMPLETED(result)/FAILED(error)
 */
@Processor('aiInference')
export class AiInferenceConsumer {
  private readonly logger = new Logger(AiInferenceConsumer.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly cad: AiDiagnosisService,
  ) {}

  @Process('infer')
  async handleInfer(job: Job<AiInferenceJobData>): Promise<{ jobId: string; studyId: string; status: string }> {
    const { studyId, modality } = job.data
    const exam = await this.prisma.exam.findUnique({ where: { id: studyId } }).catch(() => null)
    const modelId = await this.resolveModelId(exam?.modality ?? modality ?? 'CT')

    const aiJob = await this.prisma.aiJob.create({
      data: { modelId, examId: exam?.id ?? null, status: 'QUEUED', trigger: 'QUEUE' },
    })

    try {
      await this.prisma.aiJob.update({ where: { id: aiJob.id }, data: { status: 'RUNNING', startedAt: new Date() } })
      const result = await this.runInference(studyId, exam?.modality ?? modality ?? 'CT')
      await this.prisma.aiJob.update({
        where: { id: aiJob.id },
        data: { status: 'COMPLETED', completedAt: new Date(), result: result as unknown as Prisma.InputJsonValue },
      })
      await audit(this.prisma, this.logger, 'AI_INFERENCE_COMPLETED', 'ai-job', aiJob.id, {
        studyId,
        modelId,
        status: 'COMPLETED',
      }, 'default')
      this.logger.log(`AI inference completed: study ${studyId} → AiJob ${aiJob.id}`)
      return { jobId: aiJob.id, studyId, status: 'COMPLETED' }
    } catch (err) {
      const message = (err as Error).message
      await this.prisma.aiJob
        .update({ where: { id: aiJob.id }, data: { status: 'FAILED', completedAt: new Date(), error: message } })
        .catch((e) => this.logger.warn(`AiJob ${aiJob.id} failure write-back failed: ${(e as Error).message}`))
      await audit(this.prisma, this.logger, 'AI_INFERENCE_FAILED', 'ai-job', aiJob.id, {
        studyId,
        modelId,
        error: message,
      }, 'default')
      throw err
    }
  }

  private async runInference(studyId: string, modality: string): Promise<unknown> {
    const m = (modality ?? '').toUpperCase()
    if (m === 'MG' || m === 'US' || m === 'FFDM') return (await this.cad.analyzeBreastCad(studyId)).data
    if (m === 'DR' || m === 'CR' || m === 'DX' || m === 'RF') return (await this.cad.analyzeFractureCad(studyId)).data
    if (m === 'MR' || m === 'CMR') return (await this.cad.analyzeCardiacAi(studyId)).data
    return (await this.cad.analyzeLungCad(studyId)).data
  }

  private async resolveModelId(modality: string): Promise<string> {
    const keyword = this.modelKeyword(modality)
    const models = await this.prisma.aiModel.findMany({ where: { status: 'DEPLOYED' } })
    const matched = models.find((m) => `${m.name} ${m.category ?? ''}`.toLowerCase().includes(keyword))
    if (matched) return matched.id
    if (models.length > 0) return models[0]!.id
    const created = await this.prisma.aiModel.create({
      data: {
        name: `InlineCAD-${modality || 'CT'}`,
        version: 'g005-inline-1.0.0',
        vendor: 'G005 RIS',
        category: modality ?? 'CT',
        status: 'DEPLOYED',
      },
    })
    return created.id
  }

  private modelKeyword(modality: string): string {
    const m = (modality ?? '').toUpperCase()
    if (m === 'MG' || m === 'US' || m === 'FFDM') return 'breast'
    if (m === 'DR' || m === 'CR' || m === 'DX' || m === 'RF') return 'fracture'
    if (m === 'MR' || m === 'CMR') return 'cardiac'
    return 'lung'
  }
}
