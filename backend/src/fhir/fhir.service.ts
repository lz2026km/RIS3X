import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { QueueService } from '../queue/queue.service'
import { NotificationsGateway } from '../notifications/notifications.gateway'
import { randomUUID, createHmac } from 'crypto'
import { setTimeout } from 'timers/promises'

@Injectable()
export class FhirService implements OnModuleInit {
  private subscriptions: Map<string, { endpoint: string; criteria: any; channel: any }> = new Map()

  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
    private readonly gateway: NotificationsGateway,
  ) {}

  async onModuleInit() {
    await this.reloadSubscriptions()
  }

  private async reloadSubscriptions() {
    const subs = await this.prisma.fhirResource.findMany({
      where: { resourceType: 'Subscription' },
    })
    this.subscriptions.clear()
    for (const s of subs) {
      const content = s.content as any
      if (content?.status === 'active' && content?.channel?.type) {
        this.subscriptions.set(s.id, {
          endpoint: content.channel.endpoint,
          criteria: content.criteria,
          channel: content.channel,
        })
      }
    }
  }

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
    const resource = this.toFhirPatient(p)
    await this.storeResource(resource)
    await this.notifySubscriptions('Patient', resource)
    return resource
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

  // ── FHIR $everything ───────────────────────────────────
  async patientEverything(id: string) {
    const patient = await this.prisma.patient.findUnique({ where: { id } })
    if (!patient) throw new NotFoundException(`Patient ${id} not found`)
    const reports = await this.prisma.report.findMany({ where: { patientId: id } })
    const exams = await this.prisma.exam.findMany({ where: { patientId: id } })
    return this.Bundle([
      this.toFhirPatient(patient),
      ...reports.map((r) => this.toFhirDiagnosticReport(r)),
      ...exams.map((e) => this.toFhirImagingStudy(e)),
    ])
  }

  // ── FHIR $export (Bulk Data Export) ────────────────────
  private exportJobs = new Map<string, { status: 'running' | 'completed'; output: any }>()

  async bulkExport(_outputFormat?: string, _since?: string, _type?: string) {
    const jobId = randomUUID()
    this.exportJobs.set(jobId, { status: 'running', output: null })
    setTimeout(0).then(() => {
      this.prisma.patient.findMany().then((patients) =>
        this.prisma.report.findMany().then((reports) =>
          this.prisma.exam.findMany().then((exams) => {
            const bundle = this.Bundle([
              ...patients.map((p) => this.toFhirPatient(p)),
              ...reports.map((r) => this.toFhirDiagnosticReport(r)),
              ...exams.map((e) => this.toFhirImagingStudy(e)),
            ])
            this.exportJobs.set(jobId, { status: 'completed', output: bundle })
          }),
        ),
      )
    })
    return { jobId }
  }

  async bulkExportStatus(jobId: string) {
    const job = this.exportJobs.get(jobId)
    if (!job) throw new NotFoundException(`Export job ${jobId} not found`)
    if (job.status === 'running') {
      return { status: 'running' }
    }
    return job.output
  }

  // ── FHIR Subscription ──────────────────────────────────
  async createSubscription(body: any) {
    const id = body.id ?? randomUUID()
    const resource = {
      resourceType: 'Subscription',
      id,
      status: body.status ?? 'active',
      criteria: body.criteria,
      channel: body.channel,
      ...body,
    }
    await this.prisma.fhirResource.upsert({
      where: { id },
      create: {
        id,
        tenantId: 'default',
        resourceType: 'Subscription',
        content: resource as any,
      },
      update: { content: resource as any, versionId: { increment: 1 } },
    })
    await this.reloadSubscriptions()
    return resource
  }

  async deleteSubscription(id: string) {
    await this.prisma.fhirResource.delete({ where: { id } }).catch(() => {})
    this.subscriptions.delete(id)
    return { resourceType: 'OperationOutcome', issue: [{ severity: 'information', code: 'deleted' }] }
  }

  async getSubscription(id: string) {
    const s = await this.prisma.fhirResource.findUnique({ where: { id } })
    if (!s) throw new NotFoundException(`Subscription ${id} not found`)
    return s.content
  }

  async searchSubscription() {
    const subs = await this.prisma.fhirResource.findMany({
      where: { resourceType: 'Subscription' },
    })
    return this.Bundle(subs.map((s) => s.content as any))
  }

  private hmacSecret(): string {
    return process.env['FHIR_SUBSCRIPTION_HMAC_SECRET'] ?? 'g005-default-hmac-secret'
  }

  private signPayload(payload: string): string {
    return createHmac('sha256', this.hmacSecret()).update(payload).digest('hex')
  }

  private async notifySubscriptions(resourceType: string, resource: any) {
    const now = new Date().toISOString()
    for (const [id, sub] of this.subscriptions) {
      if (!sub.criteria || sub.criteria.includes(resourceType)) {
        const payload = JSON.stringify({
          resourceType: 'Bundle',
          type: 'notification',
          entry: [{ resource }],
        })
        const signature = this.signPayload(payload)
        const channelType = sub.channel?.type ?? 'rest-hook'

        let deliveryOk = false
        try {
          if (channelType === 'rest-hook' && sub.endpoint) {
            const res = await fetch(sub.endpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/fhir+json',
                'X-Subscription-Signature': signature,
              },
              body: payload,
            })
            deliveryOk = res.ok
            if (!deliveryOk) throw new Error(`HTTP ${res.status}`)
          } else if (channelType === 'email' && sub.endpoint) {
            await this.queue.addHl7Send({ reportId: id, destination: sub.endpoint, payload }).catch(() => {})
            deliveryOk = true
          } else if (channelType === 'sms' && sub.endpoint) {
            await this.queue.addHl7Send({ reportId: id, destination: sub.endpoint, payload }).catch(() => {})
            deliveryOk = true
          } else if (channelType === 'websocket') {
            this.gateway.push('*', { type: 'fhir:notification', payload: JSON.parse(payload) })
            deliveryOk = true
          }
        } catch {
          await this.queue.addHl7Send({ reportId: id, destination: sub.endpoint ?? '', payload }).catch(() => {})
        }

        await this.prisma.fhirResource.update({
          where: { id },
          data: {
            content: {
              ...(sub.channel ? { channel: sub.channel } : {}),
              criteria: sub.criteria,
              status: 'active',
              _delivery: {
                lastDeliveryStatus: deliveryOk ? 'success' : 'failed',
                lastDeliveryAt: now,
              },
            },
          },
        }).catch(() => {})
      }
    }
  }

  private async storeResource(resource: any) {
    const patientId = resource.resourceType === 'Patient'
      ? resource.id
      : resource.subject?.reference?.replace('Patient/', '')
    await this.prisma.fhirResource.upsert({
      where: { id: resource.id },
      create: {
        id: resource.id,
        tenantId: 'default',
        resourceType: resource.resourceType,
        content: resource as any,
        patientId,
      },
      update: {
        content: resource as any,
        versionId: { increment: 1 },
        patientId,
      },
    })
  }

  async readFhirResource(resourceType: string, id: string) {
    const r = await this.prisma.fhirResource.findUnique({ where: { id } })
    if (!r || r.resourceType !== resourceType) throw new NotFoundException(`${resourceType} ${id} not found`)
    return r.content
  }

  async searchFhirResource(resourceType: string, query: Record<string, string>) {
    const where: any = { resourceType }
    if (query.patient) where.patientId = query.patient
    const resources = await this.prisma.fhirResource.findMany({ where })
    return this.Bundle(resources.map((r) => r.content as any))
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
      valueString: o.findings,
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
