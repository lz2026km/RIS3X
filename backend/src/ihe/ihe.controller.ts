/**
 * G005 放射RIS系统 v3.0.6.11-7 - IHE 集成层 REST 端点
 * 端点:
 *   GET    /ihe/status                                当前域 / 指标 / 支持交易
 *   GET    /ihe/affinity-domain                       读取当前 Affinity Domain
 *   PUT    /ihe/affinity-domain                       更新 Affinity Domain
 *   DELETE /ihe/affinity-domain                       重置为默认
 *   POST   /ihe/pix/feed                              ITI-8 PIX Feed
 *   POST   /ihe/pix/query                             ITI-9 PIX Query
 *   POST   /ihe/pix/update-notification               ITI-10 PIX Update Notification
 *   POST   /ihe/pdq/query                             ITI-21 PDQ Query
 *   POST   /ihe/pam/message                           ITI-30 / ITI-31 PAM (ADT)
 *   GET    /ihe/pam/messages                          PAM 消息审计
 *
 *   GET    /ihe/mock/register-document?patientId=...  兼容既有 iheService mock 接口
 *   GET    /ihe/mock/documents?patientId=...
 *   GET    /ihe/mock/pdq?patientId=...&assigningAuthority=...
 *   POST   /ihe/mock/cross-reference
 */

import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common'
import { Roles } from '../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe'
import {
  AffinityDomainSchema,
  PamMessageSchema,
  PamQuerySchema,
  PdqQuerySchema,
  PixFeedSchema,
  PixQuerySchema,
} from './dto'
import type {
  AffinityDomainDto,
  PamMessageDto,
  PamQueryDto,
  PdqQueryDto,
  PixFeedDto,
  PixQueryDto,
} from './dto'
import { IheService } from './ihe.service'
import { z } from 'zod'

const CrossReferenceSchema = z.object({ localId: z.string().min(1), remoteDomain: z.string().min(1) })

@ApiTags('ihe')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR')
@Controller('ihe')
export class IheController {
  constructor(private readonly service: IheService) {}

  @Get('status')
  async status() {
    return this.service.getStatus()
  }

  @Get('affinity-domain')
  async getAffinityDomain() {
    return this.service.getAffinityDomain()
  }

  @Put('affinity-domain')
  async setAffinityDomain(@Body(new ZodValidationPipe(AffinityDomainSchema)) body: AffinityDomainDto) {
    return this.service.setAffinityDomain(body)
  }

  @Delete('affinity-domain')
  async resetAffinityDomain() {
    return this.service.resetAffinityDomain()
  }

  @Post('pix/feed')
  async pixFeed(@Body(new ZodValidationPipe(PixFeedSchema)) body: PixFeedDto) {
    return this.service.pixFeed(body)
  }

  @Post('pix/query')
  async pixQuery(@Body(new ZodValidationPipe(PixQuerySchema)) body: PixQueryDto) {
    const results = await this.service.pixQuery(body)
    return {
      transaction: 'ITI-9',
      count: results.length,
      patientId: body.patientId,
      sourceDomain: body.sourceDomain,
      results,
    }
  }

  @Post('pix/update-notification')
  async pixUpdateNotification(@Body(new ZodValidationPipe(PixFeedSchema)) body: PixFeedDto) {
    return {
      transaction: 'ITI-10',
      ...(await this.service.pixUpdateNotification(body)),
    }
  }

  @Post('pdq/query')
  async pdqQuery(@Body(new ZodValidationPipe(PdqQuerySchema)) body: PdqQueryDto) {
    const results = await this.service.pdqQuery(body)
    return {
      transaction: 'ITI-21/ITI-22',
      count: results.length,
      ...(body.limit !== undefined ? { limit: body.limit } : {}),
      results,
    }
  }

  @Post('pam/message')
  async pamMessage(@Body(new ZodValidationPipe(PamMessageSchema)) body: PamMessageDto) {
    return {
      transaction: body.messageType.startsWith('ADT^A01') || body.messageType.startsWith('ADT^A04') || body.messageType.startsWith('ADT^A05')
        ? 'ITI-30'
        : 'ITI-31',
      ...(await this.service.sendPamMessage(body)),
    }
  }

  @Get('pam/visit')
  async getVisit(
    @Query('patientId') patientId: string,
    @Query('visitNumber') visitNumber?: string,
  ) {
    if (!patientId) return { error: 'patientId required' }
    const full = await this.service.getVisitDetail(patientId, visitNumber)
    if (!full) return { error: 'visit not found' }
    return full
  }

  @Get('pam/visit-detail')
  async getVisitDetailRoute(
    @Query('patientId') patientId: string,
    @Query('visitNumber') visitNumber: string,
  ) {
    if (!patientId || !visitNumber) return { error: 'patientId and visitNumber required' }
    const full = await this.service.getVisitDetail(patientId, visitNumber)
    if (!full) return { error: 'visit not found' }
    return full
  }

  @Get('pam/messages')
  async pamMessages(
    @Query('limit') limit?: string,
    @Query('messageType') messageType?: string,
    @Query('patientId') patientId?: string,
  ) {
    const query = PamQuerySchema.parse({
      limit: limit ? Number(limit) : undefined,
      messageType,
      patientId,
    })
    return this.service.listPamMessages(query)
  }

  @Get('mock/register-document')
  async mockRegister(@Query('patientId') patientId: string, @Query('repository') repository = 'xds-local') {
    if (!patientId) return { error: 'patientId required' }
    const docId = await this.service.registerDocumentStub({ patientId }, repository)
    return { documentId: docId, patientId, repository }
  }

  @Get('mock/documents')
  async mockDocuments(@Query('patientId') patientId: string, @Query('domain') domain = 'xds-local') {
    if (!patientId) return { error: 'patientId required', documents: [] }
    const docs = await this.service.queryDocumentsStub(patientId, domain)
    return { patientId, domain, documents: docs }
  }

  @Get('mock/pdq')
  async mockPdq(
    @Query('patientId') patientId: string,
    @Query('assigningAuthority') assigningAuthority = '1.2.840.113556.1.8000.2554.1.300',
  ) {
    if (!patientId) return { error: 'patientId required' }
    const r = await this.service.pdqQueryStub(patientId, assigningAuthority)
    return r ?? { found: false, patientId, assigningAuthority }
  }

  @Post('mock/cross-reference')
  async mockCrossReference(@Body(new ZodValidationPipe(CrossReferenceSchema)) body: { localId: string; remoteDomain: string }) {
    if (!body?.localId || !body?.remoteDomain) {
      return { error: 'localId & remoteDomain required' }
    }
    const remoteId = await this.service.crossReferencePatientStub(body.localId, body.remoteDomain)
    return { localId: body.localId, remoteDomain: body.remoteDomain, remoteId }
  }
}
