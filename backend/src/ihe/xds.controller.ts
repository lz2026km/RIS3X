/**
 * G005 放射RIS系统 v3.0.6.13 - IHE XDS.b / XCA / XDR REST 端点
 *   POST /ihe/xds/provide     ITI-41 ProvideAndRegisterDocumentSet-b
 *   POST /ihe/xds/retrieve    ITI-43 RetrieveDocumentSet
 *   POST /ihe/xds/query       ITI-18 RegistryStoredQuery
 *   GET  /ihe/xds/documents   registry 列表 (演示/管理)
 *   GET  /ihe/xds/stats       统计
 *   POST /ihe/xca/query       ITI-38 CrossGatewayQuery (多社区)
 *   POST /ihe/xca/retrieve    ITI-39 CrossGatewayRetrieve
 *   POST /ihe/xdr/provide     ITI-41 Direct (XDR 点对点)
 */
import { Body, Controller, Get, NotFoundException, Param, Post, Query } from '@nestjs/common'
import { Roles } from '../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe'
import {
  XcaQuerySchema,
  XcaRetrieveSchema,
  XdsProvideSchema,
  XdsQuerySchema,
  XdsRetrieveSchema,
} from './dto'
import type {
  XcaQueryDto,
  XcaRetrieveDto,
  XdsProvideDto,
  XdsQueryDto,
  XdsRetrieveDto,
} from './dto'
import { XdsService } from './xds.service'

@ApiTags('ihe-xds')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'TECHNICIAN')
@Controller('ihe')
export class XdsController {
  constructor(private readonly service: XdsService) {}

  @Post('xds/provide')
  provide(@Body(new ZodValidationPipe(XdsProvideSchema)) body: XdsProvideDto) {
    return this.service.provideAndRegister(body, 'repository')
  }

  @Post('xds/retrieve')
  retrieve(@Body(new ZodValidationPipe(XdsRetrieveSchema)) body: XdsRetrieveDto) {
    return this.service.retrieveDocumentSet(body)
  }

  @Post('xds/query')
  query(@Body(new ZodValidationPipe(XdsQuerySchema)) body: XdsQueryDto) {
    return this.service.registryStoredQuery(body)
  }

  @Get('xds/documents')
  documents(
    @Query('patientId') patientId?: string,
    @Query('classCode') classCode?: string,
    @Query('formatCode') formatCode?: string,
    @Query('homeCommunityId') homeCommunityId?: string,
    @Query('limit') limit?: string,
  ) {
    const query: XdsQueryDto = {
      patientId,
      classCode,
      formatCode,
      homeCommunityId,
      limit: limit ? Number(limit) : undefined,
    }
    return this.service.registryStoredQuery(query)
  }

  @Get('xds/documents/:uniqueId')
  document(@Param('uniqueId') uniqueId: string) {
    const doc = this.service.getDocument(uniqueId)
    if (!doc) throw new NotFoundException(`Document ${uniqueId} not found`)
    return doc
  }

  @Get('xds/stats')
  stats() {
    return {
      transaction: 'ITI-18',
      communities: this.service.listCommunities(),
      stats: this.service.getStats(),
    }
  }

  @Post('xca/query')
  crossGatewayQuery(@Body(new ZodValidationPipe(XcaQuerySchema)) body: XcaQueryDto) {
    return this.service.crossGatewayQuery(body)
  }

  @Post('xca/retrieve')
  crossGatewayRetrieve(@Body(new ZodValidationPipe(XcaRetrieveSchema)) body: XcaRetrieveDto) {
    return this.service.crossGatewayRetrieve(body)
  }

  @Post('xdr/provide')
  provideDirect(@Body(new ZodValidationPipe(XdsProvideSchema)) body: XdsProvideDto) {
    return this.service.provideAndRegisterDirect(body)
  }
}
