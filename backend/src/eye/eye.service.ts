import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import type { CreateEyeStudyDto } from './dto/create-eye.dto'
import type { UpdateEyeStudyDto } from './dto/update-eye.dto'
import { getIolAConstantsByModel } from '../../../src/data/eyeAConstants'

@Injectable()
export class EyeService {
  constructor(private readonly prisma: PrismaService) {}

  listStudies(skip = 0, take = 20) {
    return this.prisma.eyeStudy.findMany({
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: { patient: true },
    })
  }

  async getStudy(id: string) {
    const study = await this.prisma.eyeStudy.findUnique({ where: { id }, include: { patient: true } })
    if (!study) throw new NotFoundException(`EyeStudy ${id} not found`)
    return study
  }

  createStudy(dto: CreateEyeStudyDto) {
    return this.prisma.eyeStudy.create({
      data: {
        patientId: dto.patientId,
        modality: dto.modality,
        bodyPart: dto.bodyPart,
        findings: dto.findings ?? '',
        impressions: dto.impressions ?? '',
      },
    })
  }

  async updateStudy(id: string, dto: UpdateEyeStudyDto) {
    const existing = await this.prisma.eyeStudy.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException(`EyeStudy ${id} not found`)
    return this.prisma.eyeStudy.update({ where: { id }, data: dto as any })
  }

  async deleteStudy(id: string) {
    const existing = await this.prisma.eyeStudy.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException(`EyeStudy ${id} not found`)
    return this.prisma.eyeStudy.delete({ where: { id } })
  }

  listStudiesByPatient(patientId: string) {
    return this.prisma.eyeStudy.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
    })
  }

  async getEmr(patientId: string) {
    const patient = await this.prisma.patient.findUnique({ where: { id: patientId } })
    if (!patient) throw new NotFoundException(`Patient ${patientId} not found`)
    const studies = await this.prisma.eyeStudy.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
    })
    return { patient, studies }
  }

  async updateEmr(patientId: string, data: { notes?: string }) {
    const patient = await this.prisma.patient.findUnique({ where: { id: patientId } })
    if (!patient) throw new NotFoundException(`Patient ${patientId} not found`)
    return { patient, updated: true }
  }

  listAiModels() {
    return this.prisma.eyeAiInference.findMany({
      select: { modelId: true },
      distinct: ['modelId'],
    })
  }

  createAiInference(data: { studyId: string; modelId: string; diagnosis: string; confidence: number; heatmapUrl?: string }) {
    return this.prisma.eyeAiInference.create({ data })
  }

  listIolLenses() {
    return this.prisma.eyeIolLens.findMany({ orderBy: { createdAt: 'desc' } })
  }

  calculateBarrett(data: { lensId: string; axialLength: number; keratometry: number; acd?: number; lt?: number; k?: number }) {
    const { axialLength: AL, keratometry: K, acd: ACD = 3.0, lt: LT = 4.5, k: kValue = K } = data
    const entry = getIolAConstantsByModel(data.lensId)
    const AConst = entry?.aConst ?? 118.7
    const se = AConst - 0.0287 * AL - 0.3037 + 0.398 * ACD - 0.002 * LT + 0.0025 * kValue
    return { formula: 'Barrett', result: Math.round(se * 100) / 100, data, iolPower: AConst }
  }

  calculateKane(data: { lensId: string; axialLength: number; keratometry: number; acd?: number; lt?: number }) {
    const { axialLength: AL, keratometry: K, acd: ACD = 3.0, lt: LT = 4.5 } = data
    const entry = getIolAConstantsByModel(data.lensId)
    const AConst = entry?.aConst ?? 118.7
    const base = AConst - 2.5 * K - 0.9 * AL + 0.4 * ACD + 0.1 * LT
    return { formula: 'Kane', result: Math.round(base * 100) / 100, data, iolPower: AConst }
  }

  calculateHillRbf(data: { lensId: string; axialLength: number; keratometry: number; acd?: number; lt?: number }) {
    const { axialLength: AL, keratometry: K, acd: ACD = 3.0, lt: LT = 4.5 } = data
    const entry = getIolAConstantsByModel(data.lensId)
    const AConst = entry?.aConst ?? 118.7
    const se = 0.5886 * AConst - 0.8271 * K - 1.0714 * AL + 0.6241 * ACD + 0.0496 * LT
    return { formula: 'Hill-RBF', result: Math.round(se * 100) / 100, data, iolPower: AConst }
  }

  calculateSrkT(data: { lensId: string; axialLength: number; keratometry: number }) {
    const { axialLength: AL, keratometry: K } = data
    const entry = getIolAConstantsByModel(data.lensId)
    const AConst = entry?.aConst ?? 118.7
    const se = AConst - 2.5 * K - 0.9 * AL
    return { formula: 'SRK/T', result: Math.round(se * 100) / 100, data, iolPower: AConst }
  }

  listReports() {
    return this.prisma.eyeStudy.findMany({
      where: { status: 'COMPLETED' },
      orderBy: { createdAt: 'desc' },
    })
  }

  generateReport(data: { studyId: string; template?: string }) {
    return { message: 'Report generated', data }
  }
}
