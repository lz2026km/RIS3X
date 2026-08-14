import { ExamController } from './exam.controller'
import { ROLES_KEY } from '../../common/decorators/roles.decorator'

// [v3.0.6.11-95 Wave1B] GET /exams 角色放开: 读操作放开 TECHNICIAN/DOCTOR/NURSE, 写操作保留 ADMIN/DIRECTOR
describe('ExamController roles', () => {
  const classRoles = Reflect.getMetadata(ROLES_KEY, ExamController) as string[] | undefined
  const methodRoles = (method: string) => Reflect.getMetadata(ROLES_KEY, (ExamController.prototype as never)[method]) as string[] | undefined

  it('class-level GET 列表/详情开放 TECHNICIAN/DOCTOR/NURSE', () => {
    expect(classRoles).toEqual(['ADMIN', 'DIRECTOR', 'DOCTOR', 'TECHNICIAN', 'NURSE'])
  })

  it('GET 端点继承放开角色 (list/export/get)', () => {
    expect(methodRoles('list')).toBeUndefined()
    expect(methodRoles('exportCsv')).toBeUndefined()
    expect(methodRoles('get')).toBeUndefined()
  })

  it('写操作保留 ADMIN/DIRECTOR (create/update/delete/import/merge/split)', () => {
    expect(methodRoles('create')).toEqual(['ADMIN', 'DIRECTOR'])
    expect(methodRoles('update')).toEqual(['ADMIN', 'DIRECTOR'])
    expect(methodRoles('delete')).toEqual(['ADMIN', 'DIRECTOR'])
    expect(methodRoles('importMany')).toEqual(['ADMIN', 'DIRECTOR'])
    expect(methodRoles('merge')).toEqual(['ADMIN', 'DIRECTOR'])
    expect(methodRoles('split')).toEqual(['ADMIN', 'DIRECTOR'])
  })
})
