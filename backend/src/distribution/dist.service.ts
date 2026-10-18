import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { currentTenantId } from "../common/tenant/tenant-utils";

export interface CreateDistTaskDto {
  reportId: string;
  channel: string;
  target?: string;
  recipient?: string;
}

/**
 * 报告分发任务服务 — 真实持久化 (Prisma DistTask)。
 *
 * 状态机: pending -> sending -> sent | failed
 *   - create: 入队 (pending)
 *   - retry:  failed/sent 均可重试 -> pending, retryCount += 1
 */
@Injectable()
export class DistService {
  constructor(private readonly prisma: PrismaService) {}

  async listTasks(params?: {
    status?: string;
    channel?: string;
    reportId?: string;
  }) {
    const where: Record<string, unknown> = { tenantId: currentTenantId() };
    if (params?.status) where["status"] = params.status;
    if (params?.channel) where["channel"] = params.channel;
    if (params?.reportId) where["reportId"] = params.reportId;
    const data = await this.prisma.distTask.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 500,
    });
    return { data, meta: { total: data.length } };
  }

  async getTask(id: string) {
    const item = await this.prisma.distTask.findFirst({
      where: { id, tenantId: currentTenantId() },
    });
    if (!item) throw new NotFoundException(`分发任务 ${id} 不存在`);
    return { data: item };
  }

  async createTask(body: CreateDistTaskDto) {
    const item = await this.prisma.distTask.create({
      data: {
        tenantId: currentTenantId(),
        reportId: body.reportId,
        channel: body.channel,
        target: body.target ?? "",
        recipient: body.recipient ?? null,
        status: "pending",
      },
    });
    return { data: item };
  }

  /**
   * 重试: 重置为 pending 并累加 retryCount。
   * 真实环境由投递 worker 消费 pending 任务; 此处只负责入队语义。
   */
  async retryTask(id: string) {
    const existing = await this.prisma.distTask.findFirst({
      where: { id, tenantId: currentTenantId() },
    });
    if (!existing) throw new NotFoundException(`分发任务 ${id} 不存在`);
    const item = await this.prisma.distTask.update({
      where: { id: existing.id },
      data: { status: "pending", error: null, retryCount: { increment: 1 } },
    });
    return { data: item };
  }

  /** 渠道列表 (从既有任务聚合, 附内置默认渠道) */
  async listChannels() {
    const grouped = await this.prisma.distTask.groupBy({
      by: ["channel"],
      where: { tenantId: currentTenantId() },
      _count: { _all: true },
    });
    const counts = new Map(grouped.map((g) => [g.channel, g._count._all]));
    const defaults = [
      { id: "print", name: "院内打印", type: "print" },
      { id: "sms", name: "短信推送", type: "sms" },
      { id: "email", name: "电子邮件", type: "email" },
      { id: "wechat", name: "微信推送", type: "wechat" },
      { id: "inApp", name: "站内信", type: "inApp" },
    ];
    return {
      data: defaults.map((c) => ({
        ...c,
        status: "active",
        taskCount: counts.get(c.id) ?? 0,
      })),
    };
  }
}
