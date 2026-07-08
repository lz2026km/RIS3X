import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class FhirService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Patient ────────────────────────────────────────────
  async readPatient(id: string) {
    const p = await this.prisma.patient.findUnique({ where: { id } })
    if (!p) throw new NotFoundException(`Patient ${id} not found`)
    return this.toFhirPatient(p)
  }

  async searchPatient(query: { name?: string; identifier?: string; birthdate?: string; _count?: string }) {
    const where: any = {}
    if (query.name) where.name = { contains: query.name, mode: 'insensitive' }
    if (query.identifier) where.idCard = query.identifier
    if (query.birthdate) where.birthDate = new Date(query.birthdate)
    const take = Number(query._count ?? 50)
    const patients = await this.prisma.patient.findMany({ where, take })
    return this.Bundle(patients.map((p) => this.toFhirPatient(p)))
  }

  async createPatient(body: any) {
    const p = await this.prisma.patient.create({
      data: {
        tenantId: body.tenantId ?? 'default',
        name: body.name ?? '',
        gender: body.gender?.toUpperCase() ?? 'OTHER',
        birthDate: body.birthDate ? new Date(body.birthDate) : null,
        idCard: body.identifier ?? null,
        phone: body.phone ?? null,
      },
    })
    return this.toFhirPatient(p)
  }

  async updatePatient(id: string, body: any) {
    const existing = await this.prisma.patient.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException(`Patient ${id} not found`)
    const p = await this.prisma.patient.update({
      where: { id },
      data: {
        name: body.name ?? existing.name,
        gender: body.gender?.toUpperCase() ?? existing.gender,
        birthDate: body.birthDate ? new Date(body.birthDate) : existing.birthDate,
        idCard: body.identifier ?? existing.idCard,
        phone: body.phone ?? existing.phone,
      },
    })
    return this.toFhirPatient(p)
  }

  async deletePatient(id: string) {
    await this.prisma.patient.delete({ where: { id } })
    return { resourceType: 'OperationOutcome', issue: [{ severity: 'information', code: 'deleted' }] }
  }

  // ── Observation ────────────────────────────────────────
  async readObservation(id: string) {
    const o = await this.prisma.report.findUnique({ where: { id } })
    if (!o) throw new NotFoundException(`Observation ${id} not found`)
    return this.toFhirObservation(o)
  }

  async searchObservation(query: { patient?: string; _count?: string }) {
    const where: any = {}
    if (query.patient) where.patientId = query.patient
    const take = Number(query._count ?? 50)
    const obs = await this.prisma.report.findMany({ where, take })
    return this.Bundle(obs.map((o) => this.toFhirObservation(o)))
  }

  // ── DiagnosticReport ───────────────────────────────────
  async readDiagnosticReport(id: string) {
    const r = await this.prisma.report.findUnique({ where: { id }, include: { patient: true } })
    if (!r) throw new NotFoundException(`DiagnosticReport ${id} not found`)
    return this.toFhirDiagnosticReport(r)
  }

  async searchDiagnosticReport(query: { patient?: string; status?: string; _count?: string }) {
    const where: any = {}
    if (query.patient) where.patientId = query.patient
    if (query.status) where.state = query.status
    const take = Number(query._count ?? 50)
    const reports = await this.prisma.report.findMany({ where, include: { patient: true }, take })
    return this.Bundle(reports.map((r) => this.toFhirDiagnosticReport(r)))
  }

  // ── ImagingStudy ───────────────────────────────────────
  async readImagingStudy(id: string) {
    const e = await this.prisma.exam.findUnique({ where: { id } })
    if (!e) throw new NotFoundException(`ImagingStudy ${id} not found`)
    return this.toFhirImagingStudy(e)
  }

  async searchImagingStudy(query: { patient?: string; modality?: string; _count?: string }) {
    const where: any = {}
    if (query.patient) where.patientId = query.patient
    if (query.modality) where.modality = query.modality
    const take = Number(query._count ?? 50)
    const exams = await this.prisma.exam.findMany({ where, take })
    return this.Bundle(exams.map((e) => this.toFhirImagingStudy(e)))
  }

  // ── FHIR Resource Builders ─────────────────────────────
  private toFhirPatient(p: any): Record<string, any> {
    return {
      resourceType: 'Patient',
      id: p.id,
      identifier: p.idCard ? [{ system: 'urn:oid:1.2.36.146.595.217.0.1', value: p.idCard }] : [],
      name: [{ family: p.name, given: [p.name] }],
      gender: p.gender?.toLowerCase(),
      birthDate: p.birthDate?.toISOString().split('T')[0],
      telecom: p.phone ? [{ system: 'phone', value: p.phone }] : [],
      meta: { lastUpdated: p.updatedAt?.toISOString() ?? p.createdAt.toISOString() },
    }
  }

  private toFhirObservation(o: any): Record<string, any> {
    return {
      resourceType: 'Observation',
      id: o.id,
      status: 'final',
      code: { coding: [{ system: 'http://loinc.org', code: '18782-3', display: 'Radiology study observation' }] },
      subject: { reference: `Patient/${o.patientId}` },
      valueString: o.findings?.substring(0, 200),
      meta: { lastUpdated: o.updatedAt?.toISOString() ?? o.createdAt.toISOString() },
    }
  }

  private toFhirDiagnosticReport(r: any): Record<string, any> {
    return {
      resourceType: 'DiagnosticReport',
      id: r.id,
      status: r.state === 'PUBLISHED' ? 'final' : 'preliminary',
      code: { coding: [{ system: 'http://loinc.org', code: '18782-3', display: 'Radiology Diagnostic report' }] },
      subject: { reference: `Patient/${r.patientId}` },
      result: [{ reference: `Observation/${r.id}` }],
      conclusion: r.conclusion,
      meta: { lastUpdated: r.updatedAt?.toISOString() ?? r.createdAt.toISOString() },
    }
  }

  private toFhirImagingStudy(e: any): Record<string, any> {
    return {
      resourceType: 'ImagingStudy',
      id: e.id,
      status: 'available',
      subject: { reference: `Patient/${e.patientId}` },
      modality: [{ coding: [{ system: 'http://dicom.nema.org/resources/ontology/DCM', code: e.modality }] }],
      started: e.startedAt?.toISOString(),
      numberOfSeries: 1,
      numberOfInstances: 1,
      meta: { lastUpdated: e.updatedAt?.toISOString() ?? e.createdAt.toISOString() },
    }
  }

  private Bundle(entries: Record<string, any>[]) {
    return {
      resourceType: 'Bundle',
      type: 'searchset',
      total: entries.length,
      entry: entries.map((e) => ({ resource: e, fullUrl: `https://fhir.local/${e.resourceType}/${e.id}` })),
    }
  }
}
