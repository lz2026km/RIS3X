/**
 * G005 RIS v3.0.6.11-72 - mobile 模块鉴权回归测试 (SEC1)
 * 验证: 类级 @Public() 已移除; 仅 jscode2session (微信登录换 token) 保持 @Public;
 *       PHI 敏感端点 (critical-values / ack / reports/latest) 带 @Roles 限制。
 */
import { ROLES_KEY } from '../common/decorators/roles.decorator'
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator'
import { RolesGuard } from '../common/guards/roles.guard'
import { MobileController } from './mobile.controller'
import { MobileService } from './mobile.service'

const CLASS_PUBLIC = () => Reflect.getMetadata(IS_PUBLIC_KEY, MobileController)
const methodPublic = (name: string) => Reflect.getMetadata(IS_PUBLIC_KEY, (MobileController.prototype as never)[name])
const methodRoles = (name: string) => Reflect.getMetadata(ROLES_KEY, (MobileController.prototype as never)[name])

describe('MobileController (auth hardening)', () => {
  it('class-level @Public() is removed (global JwtAuthGuard applies by default)', () => {
    expect(CLASS_PUBLIC()).toBeUndefined()
  })

  it('jscode2session keeps @Public (WeChat login token exchange)', () => {
    expect(methodPublic('jscode2session')).toBe(true)
  })

  it.each(['todaySummary', 'worklist', 'criticalValues', 'ackCriticalValue', 'latestReports', 'registerDeviceToken'])(
    '%s is NOT public (requires JWT)',
    (method) => {
      expect(methodPublic(method)).toBeUndefined()
    },
  )

  it.each(['criticalValues', 'ackCriticalValue', 'latestReports'])(
    'sensitive PHI endpoint %s requires clinical roles',
    (method) => {
      expect(methodRoles(method)).toEqual(['DOCTOR', 'DIRECTOR', 'ADMIN', 'TECHNICIAN', 'NURSE'])
    },
  )

  it('non-sensitive endpoints carry no extra role restriction (any authenticated user)', () => {
    expect(methodRoles('todaySummary')).toBeUndefined()
    expect(methodRoles('worklist')).toBeUndefined()
    expect(methodRoles('registerDeviceToken')).toBeUndefined()
  })

  it('RolesGuard rejects unauthenticated requests on role-restricted endpoints', () => {
    const reflector = { getAllAndOverride: jest.fn((key: string) => (key === IS_PUBLIC_KEY ? undefined : ['DOCTOR', 'DIRECTOR', 'ADMIN', 'TECHNICIAN', 'NURSE'])) }
    const guard = new RolesGuard(reflector as never)
    const ctx = {
      getHandler: () => null,
      getClass: () => MobileController,
      switchToHttp: () => ({ getRequest: () => ({ user: undefined }) }),
    } as never
    expect(guard.canActivate(ctx)).toBe(false)
  })

  it('RolesGuard allows authenticated clinical roles on restricted endpoints', () => {
    const reflector = { getAllAndOverride: jest.fn((key: string) => (key === IS_PUBLIC_KEY ? undefined : ['DOCTOR', 'DIRECTOR', 'ADMIN', 'TECHNICIAN', 'NURSE'])) }
    const guard = new RolesGuard(reflector as never)
    const ctx = {
      getHandler: () => null,
      getClass: () => MobileController,
      switchToHttp: () => ({ getRequest: () => ({ user: { role: 'DOCTOR' } }) }),
    } as never
    expect(guard.canActivate(ctx)).toBe(true)
  })

  it('controller can be constructed standalone for DI-free tests', () => {
    const ctrl = new MobileController({} as MobileService)
    expect(ctrl).toBeDefined()
  })
})
