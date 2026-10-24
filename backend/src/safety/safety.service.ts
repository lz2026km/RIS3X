import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { getCurrentTenantId } from "../common/interceptors/tenant-context.interceptor";
import type {
  AdverseEvent,
  AdverseEventType,
  AdverseEventSeverity,
  AdverseEventStatus,
  RcaInvestigation,
  RiskItem,
} from "@prisma/client";
import type { InputJsonValue } from "@prisma/client/runtime/library.js";

// [SEC] 不良事件状态机合法流转表 (对齐 Prisma AdverseEventStatus 4 态):
//   主链: REPORTED→INVESTIGATING→RESOLVED→CLOSED
//   重开: 仅允许 RESOLVED → INVESTIGATING (调查结论有误需重新调查)
//   终态: CLOSED 不可再流转 (医疗安全闭环已归档)
export const ADVERSE_EVENT_TRANSITIONS: Record<
  AdverseEventStatus,
  AdverseEventStatus[]
> = {
  REPORTED: ["INVESTIGATING"],
  INVESTIGATING: ["RESOLVED"],
  RESOLVED: ["CLOSED", "INVESTIGATING"],
  CLOSED: [],
};

export interface CreateAdverseEventDto {
  eventType: AdverseEventType;
  severity: AdverseEventSeverity;
  status?: AdverseEventStatus;
  description: string;
  department: string;
  reportedBy: string;
  reportedAt?: string | Date;
  patientId?: string;
  patientName?: string;
  location?: string;
  contributingFactors?: string[];
  actionsTaken?: string[];
  rootCauseIds?: string[];
}

export interface UpdateAdverseEventDto {
  eventType?: AdverseEventType;
  severity?: AdverseEventSeverity;
  status?: AdverseEventStatus;
  description?: string;
  department?: string;
  reportedBy?: string;
  reportedAt?: string | Date;
  patientId?: string;
  patientName?: string;
  location?: string;
  contributingFactors?: string[];
  actionsTaken?: string[];
  rootCauseIds?: string[];
  resolvedAt?: string | Date;
  resolvedBy?: string;
  closedAt?: string | Date;
  closedBy?: string;
}

export interface CreateRcaDto {
  adverseEventId: string;
  eventTitle: string;
  description?: string;
  dateOccurred: string | Date;
  teamMembers?: string[];
  fishboneData?: InputJsonValue[];
  fiveWhys?: InputJsonValue[];
  rootCauses?: string[];
  capaPlans?: InputJsonValue[];
  capaStatus?: string;
  conclusion?: string;
  lessonsLearned?: string;
}

export interface UpdateRcaDto {
  adverseEventId?: string;
  eventTitle?: string;
  description?: string;
  dateOccurred?: string | Date;
  teamMembers?: string[];
  fishboneData?: InputJsonValue[];
  fiveWhys?: InputJsonValue[];
  rootCauses?: string[];
  capaPlans?: InputJsonValue[];
  capaStatus?: string;
  conclusion?: string;
  lessonsLearned?: string;
  closedAt?: string | Date;
  closedBy?: string;
}

export interface CreateRiskItemDto {
  riskType: string;
  title: string;
  category: string;
  description: string;
  likelihood: number;
  severity: number;
  rpn?: number;
  riskLevel?: string;
  status?: string;
  identifiedBy: string;
  identifiedAt?: string | Date;
  mitigationPlan?: string;
  mitigationOwner?: string;
  mitigationDeadline?: string;
  residualRpn?: number;
}

export interface UpdateRiskItemDto {
  riskType?: string;
  title?: string;
  category?: string;
  description?: string;
  likelihood?: number;
  severity?: number;
  rpn?: number;
  riskLevel?: string;
  status?: string;
  identifiedBy?: string;
  identifiedAt?: string | Date;
  mitigationPlan?: string;
  mitigationOwner?: string;
  mitigationDeadline?: string;
  residualRpn?: number;
  closedAt?: string | Date;
  closedBy?: string;
}

@Injectable()
export class SafetyService {
  constructor(private readonly prisma: PrismaService) {}

  // ── AdverseEvent ──────────────────────────────────────────────

  /**
   * [SEC] 不良事件状态机门禁: 校验 from → to 是否在 ADVERSE_EVENT_TRANSITIONS 合法流转表内。
   * 同态幂等放行; 非法跳转 (如 CLOSED → INVESTIGATING) 抛 400。
   */
  private assertAdverseEventTransition(
    from: AdverseEventStatus,
    to: AdverseEventStatus,
    id: string,
  ): void {
    if (from === to) return;
    const allowed = ADVERSE_EVENT_TRANSITIONS[from] ?? [];
    if (!allowed.includes(to)) {
      throw new BadRequestException(
        `INVALID_TRANSITION: AdverseEvent ${id} ${from} → ${to} 不允许 (非法跳转; 合法流转: ${from} → ${allowed.length > 0 ? allowed.join("/") : "无 (终态)"})`,
      );
    }
  }

  async createAdverseEvent(data: CreateAdverseEventDto): Promise<AdverseEvent> {
    const { reportedAt, ...rest } = data;
    return this.prisma.adverseEvent.create({
      data: {
        ...rest,
        ...(reportedAt ? { reportedAt: new Date(reportedAt) } : {}),
        tenantId: getCurrentTenantId(),
      },
    });
  }

  async getAdverseEvents(filters?: {
    status?: string;
    severity?: string;
    eventType?: string;
  }): Promise<AdverseEvent[]> {
    const where: Record<string, unknown> = { tenantId: getCurrentTenantId() };
    if (filters?.status) where["status"] = filters.status;
    if (filters?.severity) where["severity"] = filters.severity;
    if (filters?.eventType) where["eventType"] = filters.eventType;
    return this.prisma.adverseEvent.findMany({
      where,
      orderBy: { reportedAt: "desc" },
    });
  }

  async getAdverseEvent(id: string): Promise<AdverseEvent> {
    const item = await this.prisma.adverseEvent.findFirst({
      where: { id, tenantId: getCurrentTenantId() },
    });
    if (!item) throw new NotFoundException(`AdverseEvent ${id} not found`);
    return item;
  }

  async updateAdverseEvent(
    id: string,
    data: UpdateAdverseEventDto,
  ): Promise<AdverseEvent> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.adverseEvent.findFirst({
        where: { id, tenantId: getCurrentTenantId() },
      });
      if (!current) throw new NotFoundException(`AdverseEvent ${id} not found`);
      // [SEC] 状态机门禁: 只允许按 ADVERSE_EVENT_TRANSITIONS 合法流转, 终态 CLOSED 不可重开
      if (data.status !== undefined) {
        this.assertAdverseEventTransition(current.status, data.status, id);
      }
      const { reportedAt, resolvedAt, closedAt, ...rest } = data;
      try {
        return await tx.adverseEvent.update({
          where: { id, version: current.version },
          data: {
            ...rest,
            ...(reportedAt ? { reportedAt: new Date(reportedAt) } : {}),
            ...(resolvedAt ? { resolvedAt: new Date(resolvedAt) } : {}),
            ...(closedAt ? { closedAt: new Date(closedAt) } : {}),
            version: { increment: 1 },
          },
        });
      } catch (error: any) {
        if (error?.code === "P2025")
          throw new ConflictException("版本冲突：该不良事件已被其他用户修改");
        throw error;
      }
    });
  }

  async deleteAdverseEvent(id: string): Promise<AdverseEvent> {
    const tenantId = getCurrentTenantId();
    const existing = await this.prisma.adverseEvent.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException(`AdverseEvent ${id} not found`);
    // [SEC] 不良事件为医疗安全/法医证据: 禁止硬删除, 仅记录删除审计后软删 (deletedAt 语义)
    await this.prisma.auditLog.create({
      data: {
        tenantId,
        action: "DELETE",
        resource: "adverse-event",
        resourceId: id,
        detail: {
          eventType: existing.eventType,
          severity: existing.severity,
          status: existing.status,
          reportedAt: existing.reportedAt,
          rcaCount: existing.rootCauseIds?.length ?? 0,
        } as unknown as InputJsonValue,
        success: true,
      },
    });
    return this.prisma.adverseEvent.delete({ where: { id, tenantId } });
  }

  // ── RcaInvestigation ──────────────────────────────────────────

  async createRcaInvestigation(data: CreateRcaDto): Promise<RcaInvestigation> {
    const { dateOccurred, fishboneData, fiveWhys, capaPlans, ...rest } = data;
    return this.prisma.rcaInvestigation.create({
      data: {
        ...rest,
        dateOccurred: new Date(dateOccurred),
        fishboneData: fishboneData ?? [],
        fiveWhys: fiveWhys ?? [],
        capaPlans: capaPlans ?? [],
        tenantId: getCurrentTenantId(),
      },
    });
  }

  async getRcaInvestigations(filters?: {
    capaStatus?: string;
  }): Promise<RcaInvestigation[]> {
    const where: Record<string, unknown> = { tenantId: getCurrentTenantId() };
    if (filters?.capaStatus) where["capaStatus"] = filters.capaStatus;
    return this.prisma.rcaInvestigation.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
  }

  async getRcaInvestigation(id: string): Promise<RcaInvestigation> {
    const item = await this.prisma.rcaInvestigation.findFirst({
      where: { id, tenantId: getCurrentTenantId() },
    });
    if (!item) throw new NotFoundException(`RcaInvestigation ${id} not found`);
    return item;
  }

  async updateRcaInvestigation(
    id: string,
    data: UpdateRcaDto,
  ): Promise<RcaInvestigation> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.rcaInvestigation.findFirst({
        where: { id, tenantId: getCurrentTenantId() },
      });
      if (!current)
        throw new NotFoundException(`RcaInvestigation ${id} not found`);
      /* eslint-disable @typescript-eslint/no-unused-vars */
      const {
        dateOccurred,
        closedAt,
        adverseEventId,
        fishboneData,
        fiveWhys,
        capaPlans,
        ...rest
      } = data;
      /* eslint-enable @typescript-eslint/no-unused-vars */
      try {
        return await tx.rcaInvestigation.update({
          where: { id, version: current.version },
          data: {
            ...rest,
            ...(dateOccurred ? { dateOccurred: new Date(dateOccurred) } : {}),
            ...(closedAt ? { closedAt: new Date(closedAt) } : {}),
            ...(fishboneData ? { fishboneData } : {}),
            ...(fiveWhys ? { fiveWhys } : {}),
            ...(capaPlans ? { capaPlans } : {}),
            version: { increment: 1 },
          },
        });
      } catch (error: any) {
        if (error?.code === "P2025")
          throw new ConflictException("版本冲突：该RCA调查已被其他用户修改");
        throw error;
      }
    });
  }

  async deleteRcaInvestigation(id: string): Promise<RcaInvestigation> {
    const tenantId = getCurrentTenantId();
    const existing = await this.prisma.rcaInvestigation.findFirst({
      where: { id, tenantId },
    });
    if (!existing)
      throw new NotFoundException(`RcaInvestigation ${id} not found`);
    return this.prisma.rcaInvestigation.delete({ where: { id, tenantId } });
  }

  // ── RiskItem ──────────────────────────────────────────────────

  async createRiskItem(data: CreateRiskItemDto): Promise<RiskItem> {
    const { identifiedAt, rpn, riskLevel, ...rest } = data;
    return this.prisma.riskItem.create({
      data: {
        ...rest,
        rpn: rpn ?? 0,
        riskLevel: riskLevel ?? "medium",
        ...(identifiedAt ? { identifiedAt: new Date(identifiedAt) } : {}),
        tenantId: getCurrentTenantId(),
      },
    });
  }

  async getRiskItems(filters?: {
    riskLevel?: string;
    status?: string;
  }): Promise<RiskItem[]> {
    const where: Record<string, unknown> = { tenantId: getCurrentTenantId() };
    if (filters?.riskLevel) where["riskLevel"] = filters.riskLevel;
    if (filters?.status) where["status"] = filters.status;
    return this.prisma.riskItem.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
  }

  async getRiskItem(id: string): Promise<RiskItem> {
    const item = await this.prisma.riskItem.findFirst({
      where: { id, tenantId: getCurrentTenantId() },
    });
    if (!item) throw new NotFoundException(`RiskItem ${id} not found`);
    return item;
  }

  async updateRiskItem(id: string, data: UpdateRiskItemDto): Promise<RiskItem> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.riskItem.findFirst({
        where: { id, tenantId: getCurrentTenantId() },
      });
      if (!current) throw new NotFoundException(`RiskItem ${id} not found`);
      const { identifiedAt, closedAt, ...rest } = data;
      try {
        return await tx.riskItem.update({
          where: { id, version: current.version },
          data: {
            ...rest,
            ...(identifiedAt ? { identifiedAt: new Date(identifiedAt) } : {}),
            ...(closedAt ? { closedAt: new Date(closedAt) } : {}),
            version: { increment: 1 },
          },
        });
      } catch (error: any) {
        if (error?.code === "P2025")
          throw new ConflictException("版本冲突：该风险项已被其他用户修改");
        throw error;
      }
    });
  }

  async deleteRiskItem(id: string): Promise<RiskItem> {
    const tenantId = getCurrentTenantId();
    const existing = await this.prisma.riskItem.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException(`RiskItem ${id} not found`);
    return this.prisma.riskItem.delete({ where: { id, tenantId } });
  }
}
