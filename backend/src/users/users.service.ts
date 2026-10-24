import { Injectable, NotFoundException } from "@nestjs/common";
import { hash } from "bcrypt";
import { randomBytes } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { currentTenantId } from "../common/tenant/tenant-utils";
import { MAX_PAGE_SIZE } from "../common/dto/pagination.dto";

const publicUserSelect = {
  id: true,
  tenantId: true,
  username: true,
  fullName: true,
  role: true,
  department: true,
  active: true,
  totpEnabled: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  list(skip = 0, take = 20) {
    const safeSkip = Number.isFinite(skip) && skip > 0 ? Math.trunc(skip) : 0;
    const safeTake =
      Number.isFinite(take) && take > 0
        ? Math.min(Math.trunc(take), MAX_PAGE_SIZE)
        : 20;
    return this.prisma.user.findMany({
      where: { tenantId: currentTenantId() },
      skip: safeSkip,
      take: safeTake,
      select: {
        id: true,
        username: true,
        fullName: true,
        role: true,
        department: true,
        active: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async findById(id: string) {
    const u = await this.prisma.user.findFirst({
      where: { id, tenantId: currentTenantId() },
      select: {
        id: true,
        username: true,
        fullName: true,
        role: true,
        department: true,
        active: true,
        createdAt: true,
        updatedAt: true,
        tenantId: true,
        totpEnabled: true,
      },
    });
    if (!u) throw new NotFoundException(`User ${id} not found`);
    return u;
  }

  async create(input: {
    username: string;
    password: string;
    fullName: string;
    role: string;
    department?: string;
  }) {
    const passwordHash = await hash(input.password, 10);
    return this.prisma.user.create({
      data: {
        username: input.username,
        passwordHash,
        fullName: input.fullName,
        role: input.role as any,
        department: input.department,
        tenantId: currentTenantId(),
      },
      select: publicUserSelect,
    });
  }

  async update(
    id: string,
    data: {
      fullName?: string;
      role?: string;
      department?: string;
      active?: boolean;
    },
  ) {
    const tenantId = currentTenantId();
    const existing = await this.prisma.user.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException(`User ${id} not found`);
    return this.prisma.user.update({
      where: { id, tenantId },
      data: data as any,
      select: publicUserSelect,
    });
  }

  async delete(id: string) {
    const tenantId = currentTenantId();
    const existing = await this.prisma.user.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException(`User ${id} not found`);
    return this.prisma.user.update({
      where: { id, tenantId },
      data: { active: false },
      select: publicUserSelect,
    });
  }

  // [G005 Wave2A P1] 重置密码: 内存生成一次性临时密码, 持久化其哈希并仅返回明文一次
  async resetPassword(id: string) {
    const tenantId = currentTenantId();
    const existing = await this.prisma.user.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException(`User ${id} not found`);
    const temporaryPassword = `${randomBytes(6).toString("base64url")}A1!`;
    const passwordHash = await hash(temporaryPassword, 10);
    await this.prisma.user.update({
      where: { id, tenantId },
      data: { passwordHash },
    });
    return { id, username: existing.username, temporaryPassword };
  }

  async getActivity(userId: string) {
    const tenantId = currentTenantId();
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
    });
    if (!user) throw new NotFoundException(`User ${userId} not found`);
    const [ops, loginLogs] = await Promise.all([
      this.prisma.worklistOp.findMany({
        where: { actorId: userId, tenantId },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      this.prisma.loginLog.findMany({
        where: { userId, tenantId },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    ]);
    return { ops, loginLogs };
  }
}
