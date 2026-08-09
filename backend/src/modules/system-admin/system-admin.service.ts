// [G005 Wave1B P1] 系统管理 (System Admin) — users/roles 只读列表
// 数据源: User 表派生 + 确定性 seed 回退 (不可改密码, 只读列表 + 角色)
import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

export interface SystemUser {
  id: string
  name: string
  role: string
  dept: string
  status: string
  lastLogin: string
}

export interface SystemRole {
  name: string
  permissions: string[]
  userCount: number
}

const SEED_USERS: SystemUser[] = [
  { id: 'U001', name: 'admin', role: 'ADMIN', dept: '信息科', status: '启用', lastLogin: '2026-08-08 18:30' },
  { id: 'U002', name: '张医生', role: 'DOCTOR', dept: '放射科', status: '启用', lastLogin: '2026-08-08 17:20' },
  { id: 'U003', name: '李医生', role: 'DOCTOR', dept: '放射科', status: '启用', lastLogin: '2026-08-08 16:45' },
  { id: 'U004', name: '王主任', role: 'DIRECTOR', dept: '放射科', status: '启用', lastLogin: '2026-08-08 15:10' },
  { id: 'U005', name: '赵技师', role: 'TECHNICIAN', dept: '影像技术组', status: '停用', lastLogin: '2026-07-30 09:00' },
]

const ROLE_PERMISSIONS: Record<string, string[]> = {
  ADMIN: ['全部权限', '系统配置', '用户管理', '数据导出'],
  DIRECTOR: ['报告审核', '质控管理', '统计报表', '危急值处置'],
  DOCTOR: ['报告书写', '报告修改', '相似病例', '远程会诊'],
  TECHNICIAN: ['检查登记', '检查执行', '图像上传', '质控记录'],
  NURSE: ['患者登记', '预约管理', '危急值接收'],
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: '管理员',
  DIRECTOR: '科室主任',
  DOCTOR: '医生',
  TECHNICIAN: '技师',
  NURSE: '护士',
}

function statusOf(active: boolean): string {
  return active ? '启用' : '停用'
}

@Injectable()
export class SystemAdminService {
  private readonly logger = new Logger(SystemAdminService.name)

  constructor(private readonly prisma: PrismaService) {}

  async listUsers(): Promise<SystemUser[]> {
    try {
      const rows = await this.prisma.user.findMany({
        orderBy: [{ active: 'desc' }, { createdAt: 'asc' }],
        take: 200,
        select: { id: true, username: true, fullName: true, role: true, department: true, active: true, updatedAt: true },
      })
      if (rows.length === 0) return SEED_USERS.map((u) => ({ ...u }))
      return rows.map((u) => ({
        id: u.id,
        name: u.fullName || u.username,
        role: u.role,
        dept: u.department ?? '未分配',
        status: statusOf(u.active),
        lastLogin: u.updatedAt.toISOString().slice(0, 16).replace('T', ' '),
      }))
    } catch (err) {
      this.logger.warn(`[SystemAdmin] users DB query failed, fallback to seed: ${(err as Error).message}`)
      return SEED_USERS.map((u) => ({ ...u }))
    }
  }

  async listRoles(): Promise<SystemRole[]> {
    const users = await this.listUsers()
    const byRole = new Map<string, number>()
    for (const u of users) byRole.set(u.role, (byRole.get(u.role) ?? 0) + 1)
    const roleOrder = ['ADMIN', 'DIRECTOR', 'DOCTOR', 'TECHNICIAN', 'NURSE']
    const known = new Set(roleOrder)
    const extra = Array.from(byRole.keys()).filter((r) => !known.has(r))
    return [...roleOrder, ...extra]
      .filter((r) => ROLE_PERMISSIONS[r] || byRole.has(r))
      .map((r) => ({
        name: r,
        permissions: ROLE_PERMISSIONS[r] ?? ['自定义权限'],
        userCount: byRole.get(r) ?? 0,
      }))
  }
}
