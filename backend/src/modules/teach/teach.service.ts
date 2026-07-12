import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { getCurrentTenantId } from '../../common/interceptors/tenant-context.interceptor'

@Injectable()
export class TeachService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: { title: string; patientId?: string; examId?: string; reportId?: string; userId?: string }) {
    return this.prisma.teachLecture.create({
      data: {
        title: data.title,
        patientId: data.patientId,
        examId: data.examId,
        reportId: data.reportId,
        createdBy: data.userId,
        tenantId: getCurrentTenantId(),
      },
    })
  }

  async uploadBlob(id: string, blob: Buffer, sequence: number) {
    const lecture = await this.prisma.teachLecture.findUnique({ where: { id } })
    if (!lecture) throw new NotFoundException('Lecture not found')

    const blobDir = process.env['TEACH_BLOB_DIR'] || '/data/teach'
    const fs = await import('fs/promises')
    const path = await import('path')
    await fs.mkdir(blobDir, { recursive: true })
    const filename = `${id}-${String(sequence).padStart(5, '0')}.webm`
    await fs.writeFile(path.join(blobDir, filename), blob)

    await this.prisma.teachLectureBlob.create({
      data: {
        lectureId: id,
        sequence,
        filename,
        sizeBytes: blob.length,
        tenantId: getCurrentTenantId(),
      },
    })

    return { sequence, filename, sizeBytes: blob.length }
  }

  async findById(id: string) {
    const lecture = await this.prisma.teachLecture.findUnique({
      where: { id },
      include: { blobs: { orderBy: { sequence: 'asc' } } },
    })
    if (!lecture) throw new NotFoundException('Lecture not found')
    return lecture
  }

  async findAll(query: { page?: number; pageSize?: number; search?: string }) {
    const page = query.page || 1
    const pageSize = query.pageSize || 20
    const where: any = {}
    if (query.search) {
      where.title = { contains: query.search, mode: 'insensitive' }
    }
    const [items, total] = await Promise.all([
      this.prisma.teachLecture.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { _count: { select: { blobs: true } } },
      }),
      this.prisma.teachLecture.count({ where }),
    ])
    return { items, total, page, pageSize }
  }

  async delete(id: string) {
    const lecture = await this.prisma.teachLecture.findUnique({ where: { id } })
    if (!lecture) throw new NotFoundException('Lecture not found')

    const fs = await import('fs/promises')
    const path = await import('path')
    const blobDir = process.env['TEACH_BLOB_DIR'] || '/data/teach'
    const blobs = await this.prisma.teachLectureBlob.findMany({ where: { lectureId: id } })
    for (const b of blobs) {
      try { await fs.unlink(path.join(blobDir, b.filename)) } catch {}
    }
    await this.prisma.teachLectureBlob.deleteMany({ where: { lectureId: id } })
    await this.prisma.teachLecture.delete({ where: { id } })
    return { deleted: id }
  }
}
