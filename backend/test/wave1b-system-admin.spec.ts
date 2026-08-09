/**
 * [G005 Wave1B P1] System Admin 模块 spec — User 表派生 (只读列表 + 角色)
 */
import { SystemAdminService } from '../src/modules/system-admin/system-admin.service'

function failingPrisma(): any {
  return new Proxy(
    {},
    {
      get: () => () => {
        throw new Error('no db (verification stub)')
      },
    },
  )
}

describe('Wave1B System Admin', () => {
  it('users: DB 失败时回退确定性 seed', async () => {
    const svc = new SystemAdminService(failingPrisma())
    const users = await svc.listUsers()
    expect(users.length).toBeGreaterThan(0)
    expect(users.every((u) => u.id && u.name && u.role && u.status)).toBe(true)
  })

  it('users: DB 有用户时派生 (active → 启用/停用)', async () => {
    const prisma: any = {
      user: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'U1', username: 'zhang', fullName: '张医生', role: 'DOCTOR', department: '放射科', active: true, updatedAt: new Date() },
          { id: 'U2', username: 'li', fullName: '李技师', role: 'TECHNICIAN', department: null, active: false, updatedAt: new Date() },
        ]),
      },
    }
    const svc = new SystemAdminService(prisma)
    const users = await svc.listUsers()
    expect(users).toHaveLength(2)
    expect(users[0]!.name).toBe('张医生')
    expect(users[0]!.status).toBe('启用')
    expect(users[1]!.status).toBe('停用')
    expect(users[1]!.dept).toBe('未分配')
  })

  it('roles: 用户数聚合 + 权限映射', async () => {
    const svc = new SystemAdminService(failingPrisma())
    const roles = await svc.listRoles()
    const admin = roles.find((r) => r.name === 'ADMIN')
    expect(admin?.permissions.length).toBeGreaterThan(0)
    expect(roles.some((r) => r.userCount > 0)).toBe(true)
  })
})
