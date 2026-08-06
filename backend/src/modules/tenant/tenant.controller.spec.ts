import { ROLES_KEY } from '../../common/decorators/roles.decorator'
import { TenantController } from './tenant.controller'

const rolesOf = (handler: (...args: any[]) => any): string[] | undefined => Reflect.getMetadata(ROLES_KEY, handler)

describe('TenantController role control', () => {
  it('PUT /tenant/profile requires ADMIN', () => {
    expect(rolesOf(TenantController.prototype.updateProfile)).toEqual(['ADMIN'])
  })

  it('PUT /tenant/features requires ADMIN', () => {
    expect(rolesOf(TenantController.prototype.updateFeatures)).toEqual(['ADMIN'])
  })

  it('platform management endpoints require ADMIN', () => {
    expect(rolesOf(TenantController.prototype.list)).toEqual(['ADMIN'])
    expect(rolesOf(TenantController.prototype.create)).toEqual(['ADMIN'])
    expect(rolesOf(TenantController.prototype.setStatus)).toEqual(['ADMIN'])
  })

  it('read endpoints stay open to any authenticated user', () => {
    for (const h of [
      TenantController.prototype.current,
      TenantController.prototype.usage,
      TenantController.prototype.features,
    ]) {
      expect(rolesOf(h)).toBeUndefined()
    }
  })
})
