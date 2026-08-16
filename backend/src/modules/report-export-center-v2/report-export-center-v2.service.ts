/**
 * G005 放射RIS系统 v3.0.6.11-101 - 报告导出中心 V2 (Wave 7B, F15, 孤儿模块)
 *
 * 能力:
 *  1. 导出格式: PDF(概念)/DOCX(概念)/HTML/CSV/DICOM SR, 内容确定性生成, 均包含报告全文
 *  2. 导出任务: 创建(PENDING) → 处理(PROCESSING) → 完成(COMPLETED, 生成文件名/大小/内容) / 取消
 *  3. 批量导出 (报告 ID 列表) + 权限校验 (角色白名单, 批量需主任/管理员)
 *  4. 下载 (确定性内容) + 导出历史 + 统计
 *
 * 孤儿模块模式 + seed 回退: 不注册进 app.module, spec 直接注入测试;
 * DB 可用时联动 auditLog, 不可用时纯内存 seed 仍可用。
 */
import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { currentTenantId } from '../../common/tenant/tenant-utils'

// ================= 类型 =================

export type ExportFormatV2 = 'PDF' | 'DOCX' | 'HTML' | 'CSV' | 'DICOM_SR'
export type ExportTaskStateV2 = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELED'

export interface ReportRecordV2 {
  id: string
  title: string
  patientName: string
  patientId: string
  examType: string
  examDate: string
  department: string
  reportDoctor: string
  content: string
}

export interface ExportTaskV2 {
  id: string
  format: ExportFormatV2
  reportIds: string[]
  state: ExportTaskStateV2
  progress: number
  fileName?: string
  content?: string
  fileSize?: number
  mimeType?: string
  error?: string
  requestedBy: string
  requestedByRole: string
  createdAt: string
  updatedAt: string
  completedAt?: string
}

export interface ExportTaskSummaryV2 {
  id: string
  format: ExportFormatV2
  reportIds: string[]
  reportCount: number
  state: ExportTaskStateV2
  progress: number
  fileName?: string
  fileSize?: number
  requestedBy: string
  requestedByRole: string
  createdAt: string
  updatedAt: string
  completedAt?: string
  error?: string
}

export interface ExportDownloadV2 {
  taskId: string
  format: ExportFormatV2
  fileName: string
  mimeType: string
  content: string
  fileSize: number
  exportedAt: string
}

export interface ExportCenterStatsV2 {
  total: number
  completed: number
  active: number
  canceled: number
  byFormat: Record<string, number>
  totalExportedBytes: number
  totalReportsExported: number
}

// ================= 常量 =================

export const FORMAT_LABEL: Record<ExportFormatV2, string> = {
  PDF: 'PDF',
  DOCX: 'DOCX',
  HTML: 'HTML',
  CSV: 'CSV',
  DICOM_SR: 'DICOM SR',
}

const FORMAT_EXT: Record<ExportFormatV2, string> = {
  PDF: 'pdf',
  DOCX: 'docx',
  HTML: 'html',
  CSV: 'csv',
  DICOM_SR: 'sr.txt',
}

const FORMAT_MIME: Record<ExportFormatV2, string> = {
  PDF: 'application/pdf',
  DOCX: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  HTML: 'text/html; charset=utf-8',
  CSV: 'text/csv; charset=utf-8',
  DICOM_SR: 'text/plain; charset=utf-8',
}

// 可导出角色; 批量导出 (≥2 份报告) 需更高权限
const EXPORT_ROLES = ['DOCTOR', 'DIRECTOR', 'ADMIN', 'CHIEF']
const BATCH_ROLES = ['DIRECTOR', 'ADMIN']

// ================= Seed 报告注册表 (确定性) =================

const REPORT_SEED: ReportRecordV2[] = [
  {
    id: 'rep-001', title: '头颅CT平扫报告', patientName: '张伟', patientId: 'P20260701001',
    examType: 'CT', examDate: '2026-07-01', department: '放射科', reportDoctor: '李明',
    content: '检查所见: 头颅CT平扫示脑实质内未见明确高密度或低密度灶, 灰白质分界清晰, 中线结构居中, 脑室系统大小形态正常, 各脑池未见异常, 颅骨未见明确骨折及骨质破坏。诊断意见: 头颅CT平扫未见明显异常。',
  },
  {
    id: 'rep-002', title: '胸部CT平扫报告', patientName: '王芳', patientId: 'P20260703002',
    examType: 'CT', examDate: '2026-07-03', department: '心胸影像组', reportDoctor: '陈雅芝',
    content: '检查所见: 胸部CT平扫示双肺纹理清晰, 未见实变及肿块, 纵隔结构居中, 未见肿大淋巴结, 心影大小正常, 双侧胸腔未见积液。诊断意见: 胸部CT平扫未见明显异常。',
  },
  {
    id: 'rep-003', title: '腰椎MR平扫报告', patientName: '赵敏', patientId: 'P20260708003',
    examType: 'MR', examDate: '2026-07-08', department: '骨关节组', reportDoctor: '刘建国',
    content: '检查所见: 腰椎MR平扫示L4/5、L5/S1椎间盘突出, L5/S1水平右侧神经根受压, 椎管内未见占位, 马尾神经信号未见异常。诊断意见: L4/5、L5/S1椎间盘突出伴右侧S1神经根受压。',
  },
  {
    id: 'rep-004', title: '乳腺钼靶BI-RADS报告', patientName: '孙丽', patientId: 'P20260712004',
    examType: 'MG', examDate: '2026-07-12', department: '乳腺影像组', reportDoctor: '王浩',
    content: '检查所见: 双乳钼靶示右乳外上象限见成簇细小钙化, 形态规则, 余乳腺未见明确肿块及结构扭曲, 双侧腋窝未见肿大淋巴结。诊断意见: 右乳成簇钙化, BI-RADS 3类, 建议6个月后复查。',
  },
  {
    id: 'rep-005', title: '冠脉CTA报告(危急值)', patientName: '钱进', patientId: 'P20260715005',
    examType: 'CT', examDate: '2026-07-15', department: '心胸影像组', reportDoctor: '周婷',
    content: '检查所见: 冠脉CTA示左前降支近段混合斑块, 管腔重度狭窄约85%, 右冠见非钙化斑块, 管腔中度狭窄。危急值提示: 左前降支近段重度狭窄, 请立即联系临床。诊断意见: 冠状动脉粥样硬化, 左前降支近段重度狭窄。',
  },
  {
    id: 'rep-006', title: '腹部CT增强三期报告', patientName: '吴静', patientId: 'P20260720006',
    examType: 'CT', examDate: '2026-07-20', department: '腹部影像组', reportDoctor: '郑爽',
    content: '检查所见: 腹部CT增强三期示肝右叶低密度病灶, 动脉期边缘结节样强化, 门脉期强化向中心填充, 延迟期呈稍高密度, 符合肝血管瘤表现。诊断意见: 肝右叶血管瘤, 建议定期随访。',
  },
  {
    id: 'rep-007', title: '膝关节MR平扫报告', patientName: '周强', patientId: 'P20260725007',
    examType: 'MR', examDate: '2026-07-25', department: '骨关节组', reportDoctor: '冯斌',
    content: '检查所见: 右膝关节MR示内侧半月板后角线状高信号达关节面, 符合半月板撕裂, 前交叉韧带信号未见异常, 关节腔少量积液。诊断意见: 右膝内侧半月板后角撕裂, 关节腔少量积液。',
  },
  {
    id: 'rep-008', title: '颅内出血危急值报告', patientName: '郑国庆', patientId: 'P20260728008',
    examType: 'CT', examDate: '2026-07-28', department: '神经影像组', reportDoctor: '高翔',
    content: '检查所见: 头颅CT平扫示右侧基底节区大片高密度影约3.8×2.9cm, 周围水肿带明显, 右侧脑室受压变形, 中线结构向对侧移位约0.6cm。危急值提示: 右侧基底节区脑出血并占位效应。诊断意见: 右侧基底节区脑出血。',
  },
  {
    id: 'rep-009', title: '胸部DR正侧位报告', patientName: '林芳', patientId: 'P20260802009',
    examType: 'DR', examDate: '2026-08-02', department: '心胸影像组', reportDoctor: '马丽',
    content: '检查所见: 胸部正侧位DR示双肺纹理清晰, 肺野未见实变及肿块, 肺门影不大, 纵隔影无增宽, 心影大小形态正常, 双侧膈面光整, 肋膈角锐利。诊断意见: 胸部正侧位未见明显异常。',
  },
  {
    id: 'rep-010', title: '下肢动脉DSA操作报告', patientName: '黄志刚', patientId: 'P20260810010',
    examType: 'DSA', examDate: '2026-08-10', department: '介入放射科', reportDoctor: '徐磊',
    content: '操作记录: 股动脉穿刺成功后造影示左股浅动脉中段重度狭窄约85%, 行PTA并植入支架1枚, 术后造影示支架内血流通畅, 远端血管显影良好。诊断意见: 左股浅动脉PTA+支架成形术后血流通畅。',
  },
]

// ================= 确定性内容生成 =================

function csvField(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

function formatTimestamp(iso: string): string {
  return iso.replace('T', ' ').replace('Z', ' UTC').slice(0, 23)
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function generateCsv(reports: ReportRecordV2[], exportedAt: string): string {
  const header = ['报告ID', '报告标题', '患者姓名', '患者ID', '检查类型', '检查日期', '报告医生', '报告科室', '报告全文']
  const rows = [header.map((h) => csvField(h)).join(',')]
  for (const r of reports) {
    rows.push([r.id, r.title, r.patientName, r.patientId, r.examType, r.examDate, r.reportDoctor, r.department, r.content].map(csvField).join(','))
  }
  return rows.join('\r\n') + `\r\n# 导出时间: ${formatTimestamp(exportedAt)} · 报告数: ${reports.length} (报告导出中心 V2)\r\n`
}

function generateHtml(reports: ReportRecordV2[], exportedAt: string): string {
  const sections = reports.map((r) => `
    <section class="report">
      <h2>${escapeHtml(r.title)}</h2>
      <table class="meta">
        <tr><td>报告ID</td><td>${escapeHtml(r.id)}</td><td>患者</td><td>${escapeHtml(r.patientName)} (${escapeHtml(r.patientId)})</td></tr>
        <tr><td>检查类型</td><td>${escapeHtml(r.examType)}</td><td>检查日期</td><td>${escapeHtml(r.examDate)}</td></tr>
        <tr><td>报告医生</td><td>${escapeHtml(r.reportDoctor)}</td><td>科室</td><td>${escapeHtml(r.department)}</td></tr>
      </table>
      <pre class="body">${escapeHtml(r.content)}</pre>
    </section>`).join('')
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="utf-8"><title>放射报告导出 (${reports.length} 份)</title>
<style>
  body{font-family:'Microsoft YaHei',sans-serif;margin:24px;color:#1e293b}
  h1{font-size:20px;border-bottom:2px solid #4f46e5;padding-bottom:8px}
  .report{margin-bottom:24px;page-break-after:always}
  .report h2{font-size:16px;color:#4f46e5}
  table.meta{width:100%;border-collapse:collapse;margin:8px 0;font-size:13px}
  table.meta td{border:1px solid #e2e8f0;padding:6px 8px}
  pre.body{white-space:pre-wrap;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:12px;font-family:inherit;font-size:14px;line-height:1.7}
  .footer{font-size:12px;color:#94a3b8;text-align:center;margin-top:24px}
</style></head>
<body>
<h1>放射报告导出 (报告导出中心 V2 · HTML)</h1>
${sections}
<div class="footer">导出时间: ${escapeHtml(formatTimestamp(exportedAt))} · 报告数: ${reports.length} · 由 G005 RIS 报告导出中心 V2 生成</div>
</body>
</html>`
}

function generatePdfConcept(reports: ReportRecordV2[], exportedAt: string): string {
  const lines: string[] = [
    'PDF (v2 概念导出 · 占位文本)',
    '============================================================',
    `导出时间: ${formatTimestamp(exportedAt)}    报告数: ${reports.length}`,
    '说明: 本输出为 PDF 格式的概念实现, 正式版本将渲染为真实 PDF 版面。',
    '============================================================',
  ]
  for (const r of reports) {
    lines.push('', `【${r.title}】`, `报告ID: ${r.id}  患者: ${r.patientName}(${r.patientId})  检查: ${r.examType} ${r.examDate}`,
      `报告医生: ${r.reportDoctor}  科室: ${r.department}`, '------------------------------------------------------------', r.content)
  }
  return lines.join('\n')
}

function generateDocxConcept(reports: ReportRecordV2[], exportedAt: string): string {
  const lines: string[] = [
    'DOCX (v2 概念导出 · WordprocessingML 占位)',
    '============================================================',
    `导出时间: ${formatTimestamp(exportedAt)}    报告数: ${reports.length}`,
    '说明: 本输出为 DOCX 格式的概念实现, 正式版本将生成包含样式与分页的真实 .docx 文档。',
    '============================================================',
  ]
  for (const r of reports) {
    lines.push('', `标题: ${r.title}`, `患者: ${r.patientName}(${r.patientId})  检查类型: ${r.examType}  检查日期: ${r.examDate}`,
      `报告医生: ${r.reportDoctor}  科室: ${r.department}`, '------------------------------------------------------------', `[正文] ${r.content}`)
  }
  return lines.join('\n')
}

function generateDicomSr(reports: ReportRecordV2[], exportedAt: string): string {
  const lines: string[] = [
    'DICOM SR (v2 概念导出)',
    '==================================================================',
    '(0008,0005) SpecificCharacterSet  = ISO_IR 192',
    '(0008,0016) SOPClassUID          = 1.2.840.10008.5.1.4.1.1.88.22 (Enhanced SR)',
    `(0008,0023) ContentDate          = ${exportedAt.slice(0, 10)}`,
    `(0008,0033) ContentTime          = ${exportedAt.slice(11, 19)}`,
    '说明: 本输出为 DICOM SR 概念实现, 正式版本将生成结构化报告对象并存储至 PACS。',
    '==================================================================',
  ]
  let seq = 1
  for (const r of reports) {
    lines.push('', `ContentSequence (${seq}): CONTAINER - 放射报告`, '  - 观察对象: ',
      `    PatientName: ${r.patientName} (${r.patientId})`,
      `    StudyDescription: ${r.title}`,
      `    Modality: ${r.examType}   StudyDate: ${r.examDate}`,
      `    PerformingPhysician: ${r.reportDoctor}   Department: ${r.department}`,
      '  - 报告内容 (报告全文):',
      `    (${seq}.1) TEXT - ${r.content}`,
      `    (${seq}.2) TEXT - 诊断意见: ${r.content.slice(r.content.lastIndexOf('诊断意见'))}`)
    seq += 1
  }
  return lines.join('\n')
}

function generateContent(format: ExportFormatV2, reports: ReportRecordV2[], exportedAt: string): string {
  switch (format) {
    case 'CSV': return generateCsv(reports, exportedAt)
    case 'HTML': return generateHtml(reports, exportedAt)
    case 'PDF': return generatePdfConcept(reports, exportedAt)
    case 'DOCX': return generateDocxConcept(reports, exportedAt)
    case 'DICOM_SR': return generateDicomSr(reports, exportedAt)
  }
}

// ================= 服务 =================

@Injectable()
export class ReportExportCenterV2Service {
  private readonly logger = new Logger(ReportExportCenterV2Service.name)

  private readonly reports: ReportRecordV2[] = REPORT_SEED.map((r) => ({ ...r }))

  private readonly tasks: ExportTaskV2[] = []

  private readonly idCounter = { n: 1000 }

  constructor(private readonly prisma: PrismaService) {}

  // ================= 报告注册表 =================

  listReports(filter?: { examType?: string; keyword?: string }): ReportRecordV2[] {
    let list = this.reports
    if (filter?.examType) list = list.filter((r) => r.examType === filter.examType)
    if (filter?.keyword?.trim()) {
      const q = filter.keyword.trim().toLowerCase()
      list = list.filter((r) => r.title.toLowerCase().includes(q) || r.patientName.toLowerCase().includes(q))
    }
    return list.map((r) => ({ ...r }))
  }

  getReport(id: string): ReportRecordV2 {
    const r = this.reports.find((x) => x.id === id)
    if (!r) throw new NotFoundException(`报告 ${id} 不存在`)
    return { ...r }
  }

  // ================= 导出任务: 创建 / 流转 / 下载 =================

  /** 权限校验: 角色白名单 + 批量 (≥2 份) 需主任/管理员 */
  private assertPermission(reportIds: string[], role: string): void {
    if (!EXPORT_ROLES.includes(role)) {
      throw new ForbiddenException(`当前角色 (${role}) 无权导出报告, 仅 ${EXPORT_ROLES.join('/')} 可导出`)
    }
    if (reportIds.length > 1 && !BATCH_ROLES.includes(role)) {
      throw new ForbiddenException(`批量导出 (${reportIds.length} 份) 需要 ${BATCH_ROLES.join('/')} 权限, 当前角色 ${role} 仅可单份导出`)
    }
  }

  private resolveReports(reportIds: string[]): ReportRecordV2[] {
    if (!reportIds.length) throw new BadRequestException('至少选择一个报告')
    const missing = reportIds.filter((id) => !this.reports.some((r) => r.id === id))
    if (missing.length) throw new BadRequestException(`报告不存在: ${missing.join(', ')}`)
    return reportIds.map((id) => this.reports.find((r) => r.id === id)!)
  }

  createTask(dto: {
    format: ExportFormatV2
    reportIds: string[]
    requestedBy: string
    requestedByRole: string
  }): ExportTaskV2 {
    this.resolveReports(dto.reportIds)
    this.assertPermission(dto.reportIds, dto.requestedByRole)
    const now = new Date().toISOString()
    const task: ExportTaskV2 = {
      id: `exp-${String(this.idCounter.n++).padStart(4, '0')}`,
      format: dto.format,
      reportIds: [...dto.reportIds],
      state: 'PENDING',
      progress: 0,
      requestedBy: dto.requestedBy,
      requestedByRole: dto.requestedByRole,
      createdAt: now,
      updatedAt: now,
    }
    this.tasks.unshift(task)
    void this.persistAudit(task.id, 'CREATE', dto.format, dto.reportIds.length)
    return this.cloneTask(task)
  }

  processTask(id: string): ExportTaskV2 {
    const task = this.tasks.find((t) => t.id === id)
    if (!task) throw new NotFoundException(`导出任务 ${id} 不存在`)
    if (task.state === 'COMPLETED') return this.cloneTask(task)
    if (task.state === 'CANCELED') throw new BadRequestException('任务已取消, 无法继续处理')
    if (task.state === 'FAILED') throw new BadRequestException('任务已失败, 请重新创建')
    task.state = 'PROCESSING'
    task.progress = 45
    task.updatedAt = new Date().toISOString()
    const reports = this.resolveReports(task.reportIds)
    task.content = generateContent(task.format, reports, task.updatedAt)
    task.fileSize = Buffer.byteLength(task.content, 'utf8')
    task.fileName = `report-export-${task.format.toLowerCase().replace('_', '-')}-${task.id}.${FORMAT_EXT[task.format]}`
    task.mimeType = FORMAT_MIME[task.format]
    task.state = 'COMPLETED'
    task.progress = 100
    task.completedAt = new Date().toISOString()
    task.updatedAt = task.completedAt
    void this.persistAudit(task.id, 'COMPLETE', task.format, reports.length)
    return this.cloneTask(task)
  }

  /** 创建 + 立即处理 (批量导出端点使用) */
  createAndProcess(dto: {
    format: ExportFormatV2
    reportIds: string[]
    requestedBy: string
    requestedByRole: string
  }): ExportTaskV2 {
    const created = this.createTask(dto)
    return this.processTask(created.id)
  }

  cancelTask(id: string): ExportTaskV2 {
    const task = this.tasks.find((t) => t.id === id)
    if (!task) throw new NotFoundException(`导出任务 ${id} 不存在`)
    if (task.state === 'COMPLETED') throw new BadRequestException('任务已完成, 无法取消')
    if (task.state === 'CANCELED') throw new BadRequestException('任务已取消')
    task.state = 'CANCELED'
    task.progress = -1
    task.updatedAt = new Date().toISOString()
    void this.persistAudit(task.id, 'CANCEL', task.format, task.reportIds.length)
    return this.cloneTask(task)
  }

  getTask(id: string): ExportTaskV2 {
    const task = this.tasks.find((t) => t.id === id)
    if (!task) throw new NotFoundException(`导出任务 ${id} 不存在`)
    return this.cloneTask(task)
  }

  listTasks(query: { state?: ExportTaskStateV2; page?: number; pageSize?: number }): { items: ExportTaskSummaryV2[]; total: number; page: number; pageSize: number } {
    const page = Math.max(1, query.page ?? 1)
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20))
    let list = this.tasks
    if (query.state) list = list.filter((t) => t.state === query.state)
    const total = list.length
    return {
      items: list.slice((page - 1) * pageSize, page * pageSize).map((t) => this.toSummary(t)),
      total,
      page,
      pageSize,
    }
  }

  /** 导出历史: 全部已结束任务 (完成/取消/失败) */
  history(): ExportTaskSummaryV2[] {
    return this.tasks
      .filter((t) => t.state === 'COMPLETED' || t.state === 'CANCELED' || t.state === 'FAILED')
      .map((t) => this.toSummary(t))
  }

  download(id: string): ExportDownloadV2 {
    const task = this.tasks.find((t) => t.id === id)
    if (!task) throw new NotFoundException(`导出任务 ${id} 不存在`)
    if (task.state !== 'COMPLETED') throw new BadRequestException(`任务未完成 (当前状态: ${task.state}), 无法下载`)
    return {
      taskId: task.id,
      format: task.format,
      fileName: task.fileName ?? `export-${task.id}.txt`,
      mimeType: task.mimeType ?? 'text/plain',
      content: task.content ?? '',
      fileSize: task.fileSize ?? 0,
      exportedAt: task.completedAt ?? task.updatedAt,
    }
  }

  // ================= 统计 =================

  stats(): ExportCenterStatsV2 {
    const byFormat: Record<string, number> = {}
    let totalBytes = 0
    let totalReports = 0
    for (const t of this.tasks) {
      byFormat[t.format] = (byFormat[t.format] ?? 0) + 1
      if (t.state === 'COMPLETED' && t.fileSize) totalBytes += t.fileSize
      if (t.state === 'COMPLETED') totalReports += t.reportIds.length
    }
    return {
      total: this.tasks.length,
      completed: this.tasks.filter((t) => t.state === 'COMPLETED').length,
      active: this.tasks.filter((t) => t.state === 'PENDING' || t.state === 'PROCESSING').length,
      canceled: this.tasks.filter((t) => t.state === 'CANCELED').length,
      byFormat,
      totalExportedBytes: totalBytes,
      totalReportsExported: totalReports,
    }
  }

  // ================= 内部 =================

  private toSummary(t: ExportTaskV2): ExportTaskSummaryV2 {
    return {
      id: t.id,
      format: t.format,
      reportIds: [...t.reportIds],
      reportCount: t.reportIds.length,
      state: t.state,
      progress: t.progress,
      fileName: t.fileName,
      fileSize: t.fileSize,
      requestedBy: t.requestedBy,
      requestedByRole: t.requestedByRole,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      completedAt: t.completedAt,
      error: t.error,
    }
  }

  private cloneTask(t: ExportTaskV2): ExportTaskV2 {
    return { ...t, reportIds: [...t.reportIds] }
  }

  private async persistAudit(taskId: string, action: string, format: ExportFormatV2, reportCount: number): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          action: `REPORT_EXPORT_V2_${action}`,
          resource: 'report-export-center-v2',
          resourceId: taskId,
          detail: { format, reportCount } as never,
          tenantId: currentTenantId(),
        },
      })
    } catch (err) {
      this.logger.debug(`[ReportExportCenterV2] persist skipped: ${(err as Error).message}`)
    }
  }
}
