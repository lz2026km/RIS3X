import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { getCurrentTenantId } from '../../common/interceptors/tenant-context.interceptor'
import * as crypto from 'crypto'
import * as fs from 'fs/promises'
import * as path from 'path'

@Injectable()
export class BackupService {
  private readonly backupDir: string

  constructor(private readonly prisma: PrismaService) {
    this.backupDir = process.env['BACKUP_DIR'] || '/data/backups'
  }

  async createBackup(type: string, userId?: string) {
    let data: any
    switch (type) {
      case 'CONFIG':
        data = await this.prisma.systemConfig.findMany()
        break
      case 'AUDIT':
        data = await this.prisma.auditLog.findMany({ take: 10000 })
        break
      case 'COMPLIANCE':
        data = {
          config: await this.prisma.systemConfig.findMany(),
          auditCount: await this.prisma.auditLog.count(),
          loginLogCount: await this.prisma.loginLog.count(),
          exportApprovals: await this.prisma.exportApproval.findMany({ take: 1000 }),
        }
        break
      case 'FULL':
      default:
        data = {
          users: await this.prisma.user.findMany({
            select: {
              id: true,
              username: true,
              fullName: true,
              role: true,
              departmentId: true,
              tenantId: true,
              isActive: true,
              createdAt: true,
              updatedAt: true,
            },
          }),
          patients: await this.prisma.patient.findMany({ take: 5000 }),
          config: await this.prisma.systemConfig.findMany(),
          auditCount: await this.prisma.auditLog.count(),
        }
        break
    }

    const json = JSON.stringify(data, null, 2)
    const checksum = crypto.createHash('sha256').update(json).digest('hex')
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `backup-${type.toLowerCase()}-${timestamp}.json`
    const filepath = path.join(this.backupDir, filename)

    await fs.mkdir(this.backupDir, { recursive: true })
    await fs.writeFile(filepath, json, 'utf-8')

    const record = await this.prisma.backupRecord.create({
      data: {
        type,
        status: 'COMPLETED',
        sizeBytes: Buffer.byteLength(json),
        checksum,
        createdBy: userId,
        filePath: filepath,
        tenantId: getCurrentTenantId(),
      },
    })

    return { id: record.id, type, sizeBytes: Buffer.byteLength(json), checksum, filename, recordCount: Array.isArray(data) ? data.length : Object.keys(data).length }
  }

  async listBackups(query: { page?: number; pageSize?: number; type?: string }) {
    const page = query.page || 1
    const pageSize = query.pageSize || 20
    const where: any = {}
    if (query.type) where.type = query.type

    const [items, total] = await Promise.all([
      this.prisma.backupRecord.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.backupRecord.count({ where }),
    ])
    return { items, total, page, pageSize }
  }

  async getBackupById(id: string) {
    const record = await this.prisma.backupRecord.findUnique({ where: { id } })
    if (!record) throw new NotFoundException('Backup not found')
    return record
  }

  async restoreBackup(id: string) {
    const record = await this.getBackupById(id)
    const filepath = record.filePath
    if (!filepath) throw new NotFoundException('Backup file not found on disk')

    const content = await fs.readFile(filepath, 'utf-8')
    const data = JSON.parse(content)

    const actualChecksum = crypto.createHash('sha256').update(content).digest('hex')
    if (record.checksum && actualChecksum !== record.checksum) {
      throw new BadRequestException('Backup file integrity check failed: checksum mismatch')
    }

    if (data.config) {
      for (const cfg of data.config) {
        await this.prisma.systemConfig.upsert({
          where: { key: cfg.key },
          update: { value: cfg.value },
          create: { key: cfg.key, value: cfg.value },
        })
      }
    }
    if (data.users) {
      for (const user of data.users) {
        const { password, passwordHash, ...safeUser } = user as any
        await this.prisma.user.upsert({
          where: { id: safeUser.id },
          update: safeUser,
          create: safeUser,
        })
      }
    }
    if (data.patients) {
      for (const patient of data.patients) {
        await this.prisma.patient.upsert({
          where: { id: patient.id },
          update: patient,
          create: patient,
        })
      }
    }

    return { restored: id, recordCount: Object.keys(data).length }
  }

  async getBackupFilePath(id: string) {
    const record = await this.getBackupById(id)
    if (!record.filePath) throw new NotFoundException('Backup file not found on disk')
    return record
  }
}
