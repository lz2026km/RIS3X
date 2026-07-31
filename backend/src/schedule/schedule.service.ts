import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class ScheduleService {
  private readonly logger = new Logger(ScheduleService.name)

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async checkReportSlaEscalation(): Promise<void> {
    this.logger.log('Running report SLA escalation check')
    const overdue = await this.prisma.report.findMany({
      where: {
        state: { in: ['PENDING_ASSIGNMENT', 'ASSIGNED', 'WRITING'] },
        updatedAt: { lt: new Date(Date.now() - 4 * 60 * 60 * 1000) },
      },
    })
    for (const report of overdue) {
      this.logger.warn(`SLA breach: report ${report.id} overdue`)
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async checkCriticalTimeout(): Promise<void> {
    this.logger.log('Running critical value timeout check')
    const timedOut = await this.prisma.criticalValue.findMany({
      where: {
        ackedAt: null,
        createdAt: { lt: new Date(Date.now() - 30 * 60 * 1000) },
      },
    })
    for (const c of timedOut) {
      this.logger.warn(`Critical value ${c.id} not acknowledged within 30min`)
    }
  }

  @Cron('0 2 * * *')
  async dailyDatabaseBackup(): Promise<void> {
    this.logger.log('Starting daily database backup')
  }

  @Cron('0 0 1 * *')
  async archiveAuditLogs(): Promise<void> {
    this.logger.log('Archiving audit logs older than 12 months')
    const cutoff = new Date()
    cutoff.setFullYear(cutoff.getFullYear() - 1)
    const { count } = await this.prisma.auditLog.deleteMany({
      where: { createdAt: { lt: cutoff } },
    })
    this.logger.log(`Archived ${count} audit log entries`)
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async checkDeviceHeartbeat(): Promise<void> {
    this.logger.log('Running device status heartbeat check')
    const stale = await this.prisma.device.findMany({
      where: {
        state: { not: 'MAINTENANCE' },
        updatedAt: { lt: new Date(Date.now() - 15 * 60 * 1000) },
      },
    })
    for (const device of stale) {
      this.logger.warn(`Device ${device.code} (${device.name}) heartbeat lost`)
    }
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async checkReportTimeoutEscalation(): Promise<void> {
    this.logger.log('Running report timeout escalation check')
    const timeoutReports = await this.prisma.report.findMany({
      where: {
        state: { in: ['SUBMITTED', 'INITIAL_REVIEW'] as any },
        updatedAt: { lt: new Date(Date.now() - 2 * 60 * 60 * 1000) },
      },
    })
    for (const report of timeoutReports) {
      this.logger.warn(`Report ${report.id} timed out for escalation`)
    }
  }

  @Cron('0 3 * * 0')
  async migrateColdStorage(): Promise<void> {
    this.logger.log('Starting cold storage migration for studies > 12 months')
    const cutoff = new Date()
    cutoff.setFullYear(cutoff.getFullYear() - 1)
    const oldStudies = await this.prisma.exam.findMany({
      where: { createdAt: { lt: cutoff } },
      select: { id: true },
    })
    this.logger.log(`Found ${oldStudies.length} studies eligible for cold storage`)
  }
}
