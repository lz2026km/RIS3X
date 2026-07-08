/**
 * G005 放射RIS系统 v3.0.2 - HL7 v2.x 报告导出
 * 对标:HIS 集成 / IHE XDS
 *
 * HL7 ORU^R01 消息结构
 */
import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { Hl7Controller } from './hl7.controller'
import { Hl7Service } from './hl7.service'

@Module({
  imports: [PrismaModule],
  controllers: [Hl7Controller],
  providers: [Hl7Service],
})
export class Hl7Module {}
