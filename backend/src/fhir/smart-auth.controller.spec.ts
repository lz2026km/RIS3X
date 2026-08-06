import { ROLES_KEY } from '../common/decorators/roles.decorator'
import { SmartAuthController } from './smart-auth.controller'

const rolesOf = (handler: (...args: any[]) => any): string[] | undefined => Reflect.getMetadata(ROLES_KEY, handler)

describe('SmartAuthController role control', () => {
  it('GET auth/authorize requires clinical roles', () => {
    expect(rolesOf(SmartAuthController.prototype.authorize)).toEqual(['DOCTOR', 'DIRECTOR', 'ADMIN'])
  })

  it('token / introspect / revoke / well-known stay open to any authenticated user', () => {
    for (const h of [
      SmartAuthController.prototype.wellKnownSmart,
      SmartAuthController.prototype.token,
      SmartAuthController.prototype.revoke,
      SmartAuthController.prototype.introspect,
    ]) {
      expect(rolesOf(h)).toBeUndefined()
    }
  })
})
