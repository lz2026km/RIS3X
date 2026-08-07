import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import type { Prisma, ReportState } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { CriticalsService } from '../criticals/criticals.service'
import { BackupService } from '../modules/backup/backup.service'
import { SystemConfigService } from '../system-storage/system-config.service'

const ESCALATION_ACTOR = 'system-scheduler'

interface EscalatableReport {
  id: string
  tenantId: string
  state: string
  radiologistId: string | null
  reviewerId?: string | null
}

@Injectable()
export class ScheduleService {
  private readonly logger = new Logger(ScheduleService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly criticals: CriticalsService,
    private readonly backup: BackupService,
    private readonly systemConfig: SystemConfigService,
  ) {}

  /**
   * 报告 SLA 超时升级(4h 未完成): 状态 → ESCALATED + ReportRevision + 站内通知 + 审计
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async checkReportSlaEscalation(): Promise<void> {
    this.logger.log('Running report SLA escalation check')
    try {
      const cutoff = new Date(Date.now() - 4 * 60 * 60 * 1000)
      const overdue = await this.prisma.report.findMany({
        where: {
          state: { in: ['PENDING_ASSIGNMENT', 'ASSIGNED', 'WRITING'] },
          updatedAt: { lt: cutoff },
        },
        select: { id: true, tenantId: true, state: true, radiologistId: true, reviewerId: true },
      })
      for (const report of overdue) {
        await this.escalateReport(report, 'SLA 超时(4 小时)未完成报告', 'REPORT_SLA_TIMEOUT_4H', report.radiologistId)
        this.logger.warn(`SLA breach escalated: report ${report.id}`)
      }
      if (overdue.length > 0) this.logger.log(`Escalated ${overdue.length} SLA-overdue reports`)
    } catch (err) {
      this.logger.error(`Report SLA escalation check failed: ${(err as Error).message}`, (err as Error).stack)
    }
  }

  /**
   * 危急值未确认升级 cron (每分钟): 超时阈值读取 admin config critical_timeout_minutes,
   * 未配置回退 30 分钟。超时未确认: 调 criticals.escalate 写升级通知记录 + 状态 → ESCALATED + 审计
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async checkCriticalTimeout(): Promise<void> {
    this.logger.log('Running critical value timeout check')
    try {
      const timeoutMinutes = await this.systemConfig.getNumber('critical_timeout_minutes', 30)
      const cutoff = new Date(Date.now() - timeoutMinutes * 60 * 1000)
      const timedOut = await this.prisma.criticalValue.findMany({
        where: {
          ackedAt: null,
          state: { in: ['FOUND', 'NOTIFIED', 'VOICE_CALLED'] },
          createdAt: { lt: cutoff },
        },
        select: { id: true, tenantId: true, severity: true, description: true, createdAt: true },
      })
      const recipients = await this.loadEscalationRecipients()
      for (const c of timedOut) {
        const reason = `危急值(${c.severity})超过 ${timeoutMinutes} 分钟未确认，系统自动升级`
        if (recipients.length > 0) {
          await this.criticals.escalate({ criticalId: c.id, reason, newRecipients: recipients })
        } else {
          this.logger.warn(`No critical_escalation_recipients configured; critical ${c.id} escalated with state only`)
        }
        await this.prisma.criticalValue.update({ where: { id: c.id }, data: { state: 'ESCALATED' } })
        await this.prisma.auditLog
          .create({
            data: {
              tenantId: c.tenantId,
              action: 'CRITICAL_TIMEOUT_ESCALATED',
              resource: 'critical-value',
              resourceId: c.id,
              detail: {
                timeoutMinutes,
                severity: c.severity,
                createdAt: c.createdAt.toISOString(),
                recipients: recipients.map((r) => r.name),
              } as Prisma.InputJsonValue,
            },
          })
          .catch((err) => this.logger.warn(`audit log write failed: ${(err as Error).message}`))
        this.logger.warn(`Critical value ${c.id} not acknowledged within ${timeoutMinutes}min — ESCALATED`)
      }
      if (timedOut.length > 0) this.logger.log(`Escalated ${timedOut.length} critical values over ${timeoutMinutes}min`)
    } catch (err) {
      this.logger.error(`Critical value timeout check failed: ${(err as Error).message}`, (err as Error).stack)
    }
  }

  /**
   * 每日备份(02:00): 调 backup.service.createBackup(CONFIG), 写 BackupRecord + 文件
   */
  @Cron('0 2 * * *')
  async dailyDatabaseBackup(): Promise<void> {
    this.logger.log('Starting daily database backup (CONFIG)')
    try {
      const result = await this.backup.createBackup('CONFIG')
      this.logger.log(
        `Daily backup completed: ${result.filename} (${result.sizeBytes} bytes, ${result.recordCount} records, sha256=${result.checksum.slice(0, 12)}…)`,
      )
    } catch (err) {
      this.logger.error(`Daily backup FAILED: ${(err as Error).message}`, (err as Error).stack)
    }
  }

  @Cron('0 0 1 * *')
  async archiveAuditLogs(): Promise<void> {
    this.logger.log('Archiving audit logs older than 12 months')
    try {
      const cutoff = new Date()
      cutoff.setFullYear(cutoff.getFullYear() - 1)
      const { count } = await this.prisma.auditLog.deleteMany({
        where: { createdAt: { lt: cutoff } },
      })
      this.logger.log(`Archived ${count} audit log entries`)
    } catch (err) {
      this.logger.error(`Audit log archive failed: ${(err as Error).message}`, (err as Error).stack)
    }
  }

  /**
   * 设备心跳(15min 无心跳): 在线设备 → OFFLINE + 审计
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async checkDeviceHeartbeat(): Promise<void> {
    this.logger.log('Running device status heartbeat check')
    try {
      const cutoff = new Date(Date.now() - 15 * 60 * 1000)
      const stale = await this.prisma.device.findMany({
        where: { state: { in: ['IDLE', 'IN_USE'] }, updatedAt: { lt: cutoff } },
        select: { id: true, tenantId: true, code: true, name: true, updatedAt: true },
      })
      for (const device of stale) {
        await this.prisma.device.update({ where: { id: device.id }, data: { state: 'OFFLINE' } })
        await this.prisma.auditLog
          .create({
            data: {
              tenantId: device.tenantId,
              action: 'DEVICE_HEARTBEAT_LOST',
              resource: 'device',
              resourceId: device.id,
              detail: {
                code: device.code,
                name: device.name,
                lastSeen: device.updatedAt.toISOString(),
                heartbeatTimeoutMin: 15,
              } as Prisma.InputJsonValue,
            },
          })
          .catch((err) => this.logger.warn(`audit log write failed: ${(err as Error).message}`))
        this.logger.warn(`Device ${device.code} (${device.name}) heartbeat lost — marked OFFLINE`)
      }
    } catch (err) {
      this.logger.error(`Device heartbeat check failed: ${(err as Error).message}`, (err as Error).stack)
    }
  }

  /**
   * 报告超时升级(2h 提交后未审): 状态 → ESCALATED + ReportRevision + 通知审核医师 + 审计
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async checkReportTimeoutEscalation(): Promise<void> {
    this.logger.log('Running report timeout escalation check')
    try {
      const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000)
      const timeoutReports = await this.prisma.report.findMany({
        where: {
          state: { in: ['SUBMITTED', 'INITIAL_REVIEW'] },
          updatedAt: { lt: cutoff },
        },
        select: { id: true, tenantId: true, state: true, radiologistId: true, reviewerId: true },
      })
      for (const report of timeoutReports) {
        const userId = report.reviewerId ?? report.radiologistId
        await this.escalateReport(report, '报告提交后 2 小时未完成审核，系统自动升级', 'REPORT_REVIEW_TIMEOUT_2H', userId)
        this.logger.warn(`Report ${report.id} timed out for escalation — ESCALATED`)
      }
      if (timeoutReports.length > 0) this.logger.log(`Escalated ${timeoutReports.length} review-timeout reports`)
    } catch (err) {
      this.logger.error(`Report timeout escalation check failed: ${(err as Error).message}`, (err as Error).stack)
    }
  }

  /**
   * 冷存储迁移(每周日 03:00): >12 个月 DICOM 记录 storagePath 加 cold:// 前缀标记
   * (简化实现: 状态标记 + 审计日志, 不动物理文件)
   */
  @Cron('0 3 * * 0')
  async migrateColdStorage(): Promise<void> {
    this.logger.log('Starting cold storage migration for studies > 12 months')
    try {
      const cutoff = new Date()
      cutoff.setFullYear(cutoff.getFullYear() - 1)
      const coldPrefix = 'cold://'
      const oldInstances = await this.prisma.dicomInstance.findMany({
        where: { createdAt: { lt: cutoff } },
        select: { id: true, tenantId: true, storagePath: true, studyInstanceUid: true },
      })
      const candidates = oldInstances.filter((i) => !(i.storagePath ?? '').startsWith(coldPrefix))
      for (const inst of candidates) {
        await this.prisma.dicomInstance.update({
          where: { id: inst.id },
          data: { storagePath: coldPrefix + (inst.storagePath ?? `dicom/${inst.id}`) },
        })
      }
      await this.prisma.auditLog
        .create({
          data: {
            tenantId: 'default',
            action: 'COLD_STORAGE_MIGRATED',
            resource: 'dicom-instance',
            detail: {
              eligible: oldInstances.length,
              migrated: candidates.length,
              cutoff: cutoff.toISOString(),
              mode: 'prefix-mark',
            } as Prisma.InputJsonValue,
          },
        })
        .catch((err) => this.logger.warn(`audit log write failed: ${(err as Error).message}`))
      this.logger.log(`Cold storage migration: ${candidates.length}/${oldInstances.length} instances marked cold (${coldPrefix})`)
    } catch (err) {
      this.logger.error(`Cold storage migration failed: ${(err as Error).message}`, (err as Error).stack)
    }
  }

  private async escalateReport(
    report: EscalatableReport,
    reason: string,
    actionCode: string,
    notifyUserId: string | null | undefined,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.report.update({ where: { id: report.id }, data: { state: 'ESCALATED' } })
      await tx.reportRevision.create({
        data: {
          reportId: report.id,
          actorId: ESCALATION_ACTOR,
          fromState: report.state as ReportState,
          toState: 'ESCALATED',
          reason: `${actionCode}: ${reason}`,
          tenantId: report.tenantId,
        },
      })
      if (notifyUserId) {
        await tx.notification.create({
          data: {
            tenantId: report.tenantId,
            userId: notifyUserId,
            type: 'REPORT_ESCALATION',
            severity: 'WARNING',
            title: '报告已自动升级',
            content: `报告 ${report.id} ${reason}，请尽快处理`,
            link: `/reports/${report.id}`,
            targetId: report.id,
          },
        })
      }
      await tx.auditLog.create({
        data: {
          tenantId: report.tenantId,
          action: actionCode,
          resource: 'report',
          resourceId: report.id,
          detail: { reason, fromState: report.state, actor: ESCALATION_ACTOR } as Prisma.InputJsonValue,
        },
      })
    })
  }

  private async loadEscalationRecipients(): Promise<{ name: string; dept: string; phone: string }[]> {
    try {
      const cfg = await this.prisma.systemConfig.findUnique({ where: { key: 'critical_escalation_recipients' } })
      const raw = cfg?.value as { name: string; dept: string; phone: string }[] | undefined
      if (Array.isArray(raw) && raw.length > 0) return raw
    } catch {
      // systemConfig 不可用 → 无配置接收人
    }
    return []
  }
}
