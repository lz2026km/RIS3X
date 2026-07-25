jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
  hashSync: jest.fn(),
}))

import { Test } from '@nestjs/testing'
import { AuthController } from '../src/auth/auth.controller'
import { AuthService } from '../src/auth/auth.service'

describe('AuthController', () => {
  let ctrl: AuthController
  let auth: jest.Mocked<AuthService>

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            login: jest.fn(),
            refresh: jest.fn(),
            verifyTotp: jest.fn(),
            setupTotp: jest.fn(),
            disableTotp: jest.fn(),
            me: jest.fn(),
            changePassword: jest.fn(),
          },
        },
      ],
    }).compile()
    ctrl = module.get(AuthController)
    auth = module.get(AuthService)
  })

  beforeEach(() => jest.clearAllMocks())

  it('login calls auth.login', async () => {
    auth.login.mockResolvedValue({ accessToken: 't', user: { id: 'u1', username: 'doc', role: 'DOCTOR', totpRequired: false } })
    const r = await ctrl.login({ username: 'doc', password: 'pass' }, { ip: '1.2.3.4' } as any)
    expect(auth.login).toHaveBeenCalledWith('doc', 'pass', '1.2.3.4')
    expect(r.success).toBe(true)
    expect(r.data.token).toBe('t')
    expect(r.data.userId).toBe('u1')
  })

  it('refresh calls auth.refresh', async () => {
    auth.refresh.mockResolvedValue({ accessToken: 't', user: { id: 'u1', username: 'doc', role: 'DOCTOR' } })
    const r = await ctrl.refresh({ user: { sub: 'u1', username: 'doc', role: 'DOCTOR' } } as any)
    expect(r.success).toBe(true)
    expect(r.data.token).toBe('t')
    expect(r.data.userId).toBe('u1')
  })

  it('verifyTotp calls auth.verifyTotp', async () => {
    auth.verifyTotp.mockResolvedValue({ accessToken: 't', user: { id: 'u1', username: 'doc', role: 'DOCTOR' } })
    const r = await ctrl.verifyTotp({ user: { sub: 'u1' } } as any, { token: '123456' })
    expect(auth.verifyTotp).toHaveBeenCalledWith('u1', '123456')
  })

  it('setupTotp calls auth.setupTotp', async () => {
    auth.setupTotp.mockResolvedValue({ secret: 's', qrCodeUrl: 'url' })
    const r = await ctrl.setupTotp({ user: { sub: 'u1' } } as any)
    expect(r.secret).toBe('s')
  })

  it('disableTotp calls auth.disableTotp', async () => {
    await ctrl.disableTotp({ user: { sub: 'u1' } } as any)
    expect(auth.disableTotp).toHaveBeenCalledWith('u1')
  })

  it('me calls auth.me', async () => {
    auth.me.mockResolvedValue({ id: 'u1', username: 'doc', role: 'DOCTOR', fullName: 'Dr', totpEnabled: false })
    const r = await ctrl.me({ user: { sub: 'u1' } } as any)
    expect(r.id).toBe('u1')
  })

  it('changePassword calls auth.changePassword', async () => {
    auth.changePassword.mockResolvedValue({ ok: true })
    const r = await ctrl.changePassword({ user: { sub: 'u1' } } as any, { oldPassword: 'old', newPassword: 'new' })
    expect(auth.changePassword).toHaveBeenCalledWith('u1', 'old', 'new')
    expect(r.ok).toBe(true)
  })
})
