import { CreateTenantSchema, UpdateTenantFeaturesSchema, UpdateTenantProfileSchema, UpdateTenantStatusSchema } from './tenant.schema'

describe('tenant.schema 校验', () => {
  describe('UpdateTenantProfileSchema', () => {
    it('合法 payload 通过', () => {
      const ok = UpdateTenantProfileSchema.safeParse({ name: '测试医院', license: 'Enterprise', maxUsers: 200, maxStorageGb: 1024, config: { locale: 'zh-CN' } })
      expect(ok.success).toBe(true)
    })

    it('空 body 通过（全 optional）', () => {
      expect(UpdateTenantProfileSchema.safeParse({}).success).toBe(true)
    })

    it('name 超长 / 空串被拒', () => {
      expect(UpdateTenantProfileSchema.safeParse({ name: 'x'.repeat(101) }).success).toBe(false)
      expect(UpdateTenantProfileSchema.safeParse({ name: '' }).success).toBe(false)
    })

    it('maxUsers / maxStorageGb 越界被拒', () => {
      expect(UpdateTenantProfileSchema.safeParse({ maxUsers: 0 }).success).toBe(false)
      expect(UpdateTenantProfileSchema.safeParse({ maxUsers: 100001 }).success).toBe(false)
      expect(UpdateTenantProfileSchema.safeParse({ maxStorageGb: 0 }).success).toBe(false)
      expect(UpdateTenantProfileSchema.safeParse({ maxStorageGb: -5 }).success).toBe(false)
      expect(UpdateTenantProfileSchema.safeParse({ maxUsers: 1, maxStorageGb: 1 }).success).toBe(true)
    })

    it('config 必须为对象', () => {
      expect(UpdateTenantProfileSchema.safeParse({ config: 'nope' }).success).toBe(false)
      expect(UpdateTenantProfileSchema.safeParse({ config: { a: 1 } }).success).toBe(true)
    })
  })

  describe('UpdateTenantFeaturesSchema', () => {
    it('8 个开关字段合法时通过', () => {
      const ok = UpdateTenantFeaturesSchema.safeParse({
        aiOrchestration: false,
        biDashboard: true,
        doseManagement: true,
        vna: false,
        similarCases: true,
        environmentReport: true,
        mobileApp: false,
        teleRadiology: true,
      })
      expect(ok.success).toBe(true)
    })

    it('非 boolean 值被拒', () => {
      expect(UpdateTenantFeaturesSchema.safeParse({ vna: 'yes' }).success).toBe(false)
      expect(UpdateTenantFeaturesSchema.safeParse({ mobileApp: 1 }).success).toBe(false)
    })

    it('未知字段被剥离', () => {
      const result = UpdateTenantFeaturesSchema.safeParse({ aiOrchestrator: false } as unknown as Record<string, unknown>)
      expect(result.success).toBe(true)
      if (result.success) expect((result.data as Record<string, unknown>).aiOrchestrator).toBeUndefined()
      if (result.success) expect((result.data as Record<string, unknown>).aiOrchestration).toBeUndefined()
    })
  })

  describe('CreateTenantSchema', () => {
    it('合法 code（小写字母/数字/连字符）通过', () => {
      expect(CreateTenantSchema.safeParse({ code: 'demo-a', name: '演示租户' }).success).toBe(true)
      expect(CreateTenantSchema.safeParse({ code: 'a1-b2', name: 'x', maxUsers: 10, maxStorageGb: 256 }).success).toBe(true)
    })

    it('非法 code 被拒（大写/特殊字符/空/超长）', () => {
      expect(CreateTenantSchema.safeParse({ code: 'Bad_Code!', name: 'x' }).success).toBe(false)
      expect(CreateTenantSchema.safeParse({ code: 'UPPER', name: 'x' }).success).toBe(false)
      expect(CreateTenantSchema.safeParse({ code: '', name: 'x' }).success).toBe(false)
      expect(CreateTenantSchema.safeParse({ code: 'a'.repeat(51), name: 'x' }).success).toBe(false)
    })

    it('name 缺失 / 空 / 超长被拒', () => {
      expect(CreateTenantSchema.safeParse({ code: 'demo-a' }).success).toBe(false)
      expect(CreateTenantSchema.safeParse({ code: 'demo-a', name: '' }).success).toBe(false)
      expect(CreateTenantSchema.safeParse({ code: 'demo-a', name: 'x'.repeat(101) }).success).toBe(false)
    })

    it('maxUsers / maxStorageGb 越界被拒', () => {
      expect(CreateTenantSchema.safeParse({ code: 'demo-a', name: 'x', maxUsers: 0 }).success).toBe(false)
      expect(CreateTenantSchema.safeParse({ code: 'demo-a', name: 'x', maxUsers: 100001 }).success).toBe(false)
      expect(CreateTenantSchema.safeParse({ code: 'demo-a', name: 'x', maxStorageGb: 0 }).success).toBe(false)
    })
  })

  describe('UpdateTenantStatusSchema', () => {
    it('ACTIVE / DISABLED 通过', () => {
      expect(UpdateTenantStatusSchema.safeParse({ status: 'ACTIVE' }).success).toBe(true)
      expect(UpdateTenantStatusSchema.safeParse({ status: 'DISABLED' }).success).toBe(true)
    })

    it('其他 status 被拒', () => {
      expect(UpdateTenantStatusSchema.safeParse({ status: 'PAUSED' }).success).toBe(false)
      expect(UpdateTenantStatusSchema.safeParse({}).success).toBe(false)
      expect(UpdateTenantStatusSchema.safeParse({ status: 'active' }).success).toBe(false)
    })
  })
})
