/**
 * G005 放射RIS系统 - 骨科影像分析 (ortho-specialty) 服务 (孤儿模块)
 *
 * 覆盖前端 orthoSpecialtyApi 的 2 个端点 (此前后端缺失):
 *   - GET  /ortho-specialty/studies
 *   - POST /ortho-specialty/studies
 *
 * 无 DB 依赖: 纯内存种子 + 新建记录落内存, 可无 DB 启动。
 */
import { Injectable } from '@nestjs/common'

export interface OrthoStudy {
  id: string
  name: string
  age: number
  gender: string
  joint: string
  modality: string
  klGrade: string
  oaScore: number
  fracture: boolean
  date: string
}

@Injectable()
export class OrthoSpecialtyService {
  private readonly studies: OrthoStudy[] = [
    { id: 'OX001', name: '张伟', age: 65, gender: 'M', joint: 'knee', modality: 'XR', klGrade: 'III', oaScore: 7.5, fracture: false, date: '2026-07-15' },
    { id: 'OX002', name: '李芳', age: 52, gender: 'F', joint: 'hip', modality: 'XR', klGrade: 'II', oaScore: 4.2, fracture: false, date: '2026-07-14' },
    { id: 'OX003', name: '王明', age: 70, gender: 'M', joint: 'lumbar', modality: 'MRI', klGrade: 'IV', oaScore: 9.1, fracture: true, date: '2026-07-13' },
    { id: 'OX004', name: '赵丽', age: 34, gender: 'F', joint: 'knee', modality: 'MRI', klGrade: '0', oaScore: 0, fracture: false, date: '2026-07-12' },
    { id: 'OX005', name: '陈浩', age: 58, gender: 'M', joint: 'shoulder', modality: 'CT', klGrade: 'I', oaScore: 2.0, fracture: true, date: '2026-07-11' },
  ]

  /** GET /ortho-specialty/studies */
  listStudies() {
    return { success: true, data: this.studies }
  }

  /** POST /ortho-specialty/studies */
  createStudy(body: Partial<OrthoStudy>) {
    const seq = this.studies.length + 1
    const item: OrthoStudy = {
      id: body.id ?? `OX${String(seq).padStart(3, '0')}`,
      name: body.name ?? '未命名',
      age: Number(body.age ?? 0),
      gender: body.gender ?? 'U',
      joint: body.joint ?? 'knee',
      modality: body.modality ?? 'XR',
      klGrade: body.klGrade ?? '0',
      oaScore: Number(body.oaScore ?? 0),
      fracture: Boolean(body.fracture ?? false),
      date: body.date ?? new Date().toISOString().slice(0, 10),
    }
    this.studies.unshift(item)
    return { success: true, data: item }
  }
}
