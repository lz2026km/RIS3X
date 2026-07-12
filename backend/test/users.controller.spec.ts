jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed'),
  compare: jest.fn().mockResolvedValue(true),
}))

import { Test } from '@nestjs/testing'
import { UsersController } from '../src/users/users.controller'
import { UsersService } from '../src/users/users.service'

describe('UsersController', () => {
  let ctrl: UsersController
  let svc: jest.Mocked<UsersService>

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: {
            list: jest.fn(),
            findById: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            getActivity: jest.fn(),
          },
        },
      ],
    }).compile()
    ctrl = module.get(UsersController)
    svc = module.get(UsersService)
  })

  beforeEach(() => jest.clearAllMocks())

  it('list delegates to service', async () => {
    svc.list.mockResolvedValue([{ id: 'u1', username: 'doc', fullName: 'Dr', role: 'DOCTOR' as const, department: null, active: true, createdAt: new Date() }] as any)
    const r = await ctrl.list('0', '10')
    expect(svc.list).toHaveBeenCalledWith(0, 10)
  })

  it('get delegates to service', async () => {
    svc.findById.mockResolvedValue({ id: 'u1', username: 'doc', passwordHash: '', fullName: 'Dr', role: 'DOCTOR' as const, department: null, active: true, tenantId: 't', totpSecret: null, totpEnabled: false, failedLoginAttempts: 0, lockedUntil: null, createdAt: new Date(), updatedAt: new Date() })
    const r = await ctrl.get('u1')
    expect(svc.findById).toHaveBeenCalledWith('u1')
  })

  it('create delegates to service', async () => {
    svc.create.mockResolvedValue({ id: 'u1', username: 'new', fullName: 'New', role: 'NURSE', department: null, tenantId: 't', passwordHash: '', active: true, totpSecret: null, totpEnabled: false, failedLoginAttempts: 0, lockedUntil: null, createdAt: new Date(), updatedAt: new Date() })
    const dto = { username: 'new', password: 'pass123', fullName: 'New', role: 'NURSE' as const }
    const r = await ctrl.create(dto)
    expect(svc.create).toHaveBeenCalled()
  })

  it('update delegates to service', async () => {
    svc.update.mockResolvedValue({ id: 'u1', username: 'doc', fullName: 'Updated', role: 'DOCTOR', department: null, active: false, tenantId: 't', passwordHash: '', totpSecret: null, totpEnabled: false, failedLoginAttempts: 0, lockedUntil: null, createdAt: new Date(), updatedAt: new Date() })
    const r = await ctrl.update('u1', { fullName: 'Updated', active: false })
    expect(svc.update).toHaveBeenCalledWith('u1', { fullName: 'Updated', active: false })
  })

  it('delete delegates to service', async () => {
    svc.delete.mockResolvedValue({ id: 'u1', username: 'doc', fullName: 'Dr', role: 'DOCTOR', department: null, active: false, tenantId: 't', passwordHash: '', totpSecret: null, totpEnabled: false, failedLoginAttempts: 0, lockedUntil: null, createdAt: new Date(), updatedAt: new Date() })
    const r = await ctrl.delete('u1')
    expect(svc.delete).toHaveBeenCalledWith('u1')
  })

  it('getActivity delegates to service', async () => {
    svc.getActivity.mockResolvedValue({ ops: [], loginLogs: [] })
    const r = await ctrl.getActivity('u1')
    expect(svc.getActivity).toHaveBeenCalledWith('u1')
  })
})
