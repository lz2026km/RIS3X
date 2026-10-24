import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  CreateCriticalRuleSchema,
  UpdateCriticalRuleSchema,
  AutoDetectCriticalSchema,
  CloseCriticalLoopSchema,
} from "./criticalext.schema";
import { currentTenantId } from "../common/tenant/tenant-utils";
// [SEC] 危急值状态机流转表与 criticals 模块共用 (闭环只允许从 RESOLVED 进入)
import { CRITICAL_TRANSITIONS } from "../criticals/criticals.service";
import { matchNationalDiagnosis } from "../criticals/national-critical";
import { z } from "zod";

type CreateCriticalRuleDto = z.infer<typeof CreateCriticalRuleSchema>;
type UpdateCriticalRuleDto = z.infer<typeof UpdateCriticalRuleSchema>;
type AutoDetectCriticalDto = z.infer<typeof AutoDetectCriticalSchema>;
type CloseCriticalLoopDto = z.infer<typeof CloseCriticalLoopSchema>;

// [W5] 危急值通知通道 (与 criticals.service.resolveDeliveryStatus 读的 critical_channel_<CHANNEL> 对齐)
const NOTIFY_CHANNELS: Array<{ channel: string; label: string }> = [
  { channel: "SYSTEM", label: "站内通知" },
  { channel: "SMS", label: "短信" },
  { channel: "PHONE", label: "电话" },
  { channel: "WECHAT", label: "微信" },
  { channel: "EMAIL", label: "邮件" },
];

export interface CriticalChannelDto {
  channel: string;
  label: string;
  enabled: boolean;
}

@Injectable()
export class CriticalExtService {
  constructor(private readonly prisma: PrismaService) {}

  // [G005 P1] 响应形状统一: 列表端点返回 { items, total }, 单实体端点返回实体,
  // 统计端点返回直接对象, 不再 { data: ... } 双包裹。
  async listCriticalRules() {
    const items = await this.prisma.systemConfig.findMany({
      where: { key: { startsWith: "critical_rule_" } },
    });
    return { items, total: items.length };
  }

  async createCriticalRule(body: CreateCriticalRuleDto) {
    return this.prisma.systemConfig.create({
      data: { key: `critical_rule_${Date.now()}`, value: body as any },
    });
  }

  async updateCriticalRule(id: string, body: UpdateCriticalRuleDto) {
    return this.prisma.systemConfig.update({
      where: { key: id },
      data: { value: body as any },
    });
  }

  async deleteCriticalRule(id: string) {
    await this.prisma.systemConfig.delete({ where: { key: id } });
    return { deleted: true };
  }

  async getCriticalStats() {
    const total = await this.prisma.criticalValue.count();
    const byState = await this.prisma.criticalValue.groupBy({
      by: ["state"],
      _count: { id: true },
    });
    const bySeverity = await this.prisma.criticalValue.groupBy({
      by: ["severity"],
      _count: { id: true },
    });
    return { total, byState, bySeverity };
  }

  async getCriticalSummary() {
    const items = await this.prisma.criticalValue.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return { items, total: items.length };
  }

  async getCriticalTimeline() {
    const items = await this.prisma.criticalValueNotification.findMany({
      orderBy: { triggeredAt: "desc" },
      take: 100,
    });
    return { items, total: items.length };
  }

  async listCriticalCenter() {
    const items = await this.prisma.criticalValue.findMany({
      orderBy: { createdAt: "desc" },
    });
    return { items, total: items.length };
  }

  async getCriticalCenterItem(id: string) {
    return this.prisma.criticalValue.findUnique({ where: { id } });
  }

  /**
   * [SEC] 危急值自动识别: 显式写必填列 (description/severity/patientId/tenantId),
   * 数据来自关联检查与报告内容, 不转发请求体未知字段 (原实现必失败且可越权写入)。
   */
  async autoDetectCritical(body: AutoDetectCriticalDto) {
    const tenantId = currentTenantId();
    const exam = await this.prisma.exam.findFirst({
      where: { id: body.examId, tenantId },
    });
    if (!exam) throw new NotFoundException(`Exam ${body.examId} not found`);
    const content = body.reportContent.trim();
    const matched = matchNationalDiagnosis(content);
    const description = matched
      ? `${matched.name} (${content.slice(0, 200)})`
      : content.slice(0, 500);
    const severity = matched ? "CRITICAL" : "HIGH";
    return this.prisma.criticalValue.create({
      data: {
        examId: exam.id,
        patientId: exam.patientId,
        description,
        severity: severity as any,
        method: "SYSTEM",
        state: "FOUND",
        tenantId,
      } as any,
    });
  }

  // [G005-P0] 闭环统一终态: CLOSED_LOOP + closedAt/closedBy (与 PATCH /criticals/:id 一致)
  // [SEC] 闭环走危急值状态机 (仅允许 RESOLVED → CLOSED_LOOP); 闭环人由服务端从 JWT 推导
  async closeCriticalLoop(body: CloseCriticalLoopDto, actorId?: string) {
    const { criticalId, resolvedAt } = body;
    const tenantId = currentTenantId();
    const existing = await this.prisma.criticalValue.findFirst({
      where: { id: criticalId, tenantId },
    });
    if (!existing)
      throw new NotFoundException(`CriticalValue ${criticalId} not found`);
    const from = String(existing.state ?? "");
    const allowed =
      (CRITICAL_TRANSITIONS as Record<string, string[]>)[from] ?? [];
    if (!allowed.includes("CLOSED_LOOP")) {
      throw new BadRequestException(
        `INVALID_TRANSITION: CriticalValue ${criticalId} ${from} → CLOSED_LOOP 不允许 (非法跳转; 合法流转: ${from} → ${allowed.length > 0 ? allowed.join("/") : "无 (终态)"})`,
      );
    }
    const now = resolvedAt ? new Date(resolvedAt) : new Date();
    const resolvedBy = actorId?.trim() || "unknown";
    return this.prisma.criticalValue.update({
      where: { id: criticalId, tenantId },
      data: {
        state: "CLOSED_LOOP",
        closedBy: resolvedBy,
        closedAt: now,
        resolvedBy,
        resolvedAt: now,
      } as any,
    });
  }

  async getReceiverPortal() {
    const items = await this.prisma.criticalValueNotification.findMany({
      where: { status: "PENDING" },
      orderBy: { triggeredAt: "desc" },
    });
    return { items, total: items.length };
  }

  // [G005-P0] 危急值随访记录 (与 MSW criticalExtHandlers /follow-up-records 对齐)
  async getFollowUpRecords() {
    const items = await this.prisma.criticalValueNotification.findMany({
      orderBy: { triggeredAt: "desc" },
      take: 100,
    });
    return { items, total: items.length };
  }

  // [W5] GET /critical-ext/channels: 读 critical_channel_<CHANNEL> 开关 (未配置默认启用)
  async getChannels(): Promise<{ items: CriticalChannelDto[]; total: number }> {
    const rows = await this.prisma.systemConfig.findMany({
      where: { key: { startsWith: "critical_channel_" } },
    });
    const enabledByChannel = new Map<string, boolean>();
    for (const row of rows) {
      const channel = row.key.replace(/^critical_channel_/, "");
      const value = (row.value ?? {}) as { enabled?: unknown };
      enabledByChannel.set(channel, Boolean(value.enabled));
    }
    const items = NOTIFY_CHANNELS.map(({ channel, label }) => ({
      channel,
      label,
      enabled: enabledByChannel.get(channel) ?? true,
    }));
    return { items, total: items.length };
  }

  // [W5] PUT /critical-ext/channels: 写 critical_channel_<CHANNEL>, 供 criticals.service 判定投递结果
  async saveChannels(
    channels: Array<{ channel: string; enabled: boolean }>,
  ): Promise<{ items: CriticalChannelDto[]; total: number }> {
    for (const { channel, enabled } of channels) {
      await this.prisma.systemConfig.upsert({
        where: { key: `critical_channel_${channel}` },
        update: { value: { enabled } as any },
        create: {
          key: `critical_channel_${channel}`,
          value: { enabled } as any,
        },
      });
    }
    return this.getChannels();
  }
}
