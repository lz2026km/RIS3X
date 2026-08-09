import { Injectable, NotFoundException } from '@nestjs/common'

// ============================================================
// [G005 Wave1A] Consent Education — 知情同意/宣教模块 (进程内存 + 确定性 seed)
// 覆盖: records CRUD + sign + education-materials 内容库
// 路径双轨: /consent-education/records(新) 与 /consent-education/consents(前端现有) 指向同一存储
// ============================================================

export interface ConsentRecord {
  id: string
  patient: string
  type: string
  procedure: string
  signedAt: string | null
  status: 'signed' | 'pending' | 'refused'
  witness: string | null
  signedBy?: string
  createdAt: string
}

export interface EducationMaterialDto {
  id: string
  title: string
  lang: string
  category: string
  pages: number
  views: number
  format: string
  content?: string
  summary?: string
  createdAt: string
}

const SEED_CONSENTS: ConsentRecord[] = [
  { id: 'C-001', patient: '张三', type: '增强检查知情同意', procedure: '胸部增强CT扫描 (含对比剂注射)', signedAt: '2026-08-05T09:30:00Z', status: 'signed', witness: '王护士', signedBy: '李医生', createdAt: '2026-08-05' },
  { id: 'C-002', patient: '李四', type: '介入操作知情同意', procedure: 'CT 引导下经皮肺穿刺活检', signedAt: '2026-08-06T14:10:00Z', status: 'signed', witness: '张护士', signedBy: '赵医生', createdAt: '2026-08-06' },
  { id: 'C-003', patient: '王五', type: 'MRI 检查知情同意', procedure: '颅脑MRI平扫 (含幽闭恐惧症告知)', signedAt: null, status: 'pending', witness: null, createdAt: '2026-08-08' },
  { id: 'C-004', patient: '陈丽', type: '增强检查知情同意', procedure: '腹部增强CT扫描', signedAt: null, status: 'refused', witness: null, signedBy: '刘医生', createdAt: '2026-08-07' },
]

const SEED_MATERIALS: EducationMaterialDto[] = [
  { id: 'M-001', title: 'CT 增强检查须知', lang: 'zh-CN', category: '增强检查', pages: 2, views: 1280, format: 'PDF', summary: '对比剂过敏风险与注意事项', content: '检查前禁食 4 小时; 有碘对比剂过敏史请提前告知医生…', createdAt: '2026-05-01' },
  { id: 'M-002', title: 'MRI 检查安全须知', lang: 'zh-CN', category: '核磁共振', pages: 3, views: 960, format: 'PDF', summary: '体内植入物筛查与幽闭恐惧症告知', content: '检查前请移除金属物品; 装有心脏起搏器者禁止进入扫描间…', createdAt: '2026-05-03' },
  { id: 'M-003', title: 'CT 引导下穿刺活检介绍', lang: 'zh-CN', category: '介入', pages: 4, views: 340, format: 'PDF', summary: '穿刺流程与风险', createdAt: '2026-06-10' },
  { id: 'M-004', title: 'Radiology Contrast Safety', lang: 'en', category: 'Contrast', pages: 2, views: 120, format: 'PDF', summary: 'English contrast safety guidance', createdAt: '2026-06-15' },
]

const memConsents: ConsentRecord[] = []
const memMaterials: EducationMaterialDto[] = []

function nowIso(): string {
  return new Date().toISOString()
}

@Injectable()
export class ConsentEducationService {
  // ===== Records (consents 别名同存储) =====
  listConsents(): ConsentRecord[] {
    return [...memConsents, ...SEED_CONSENTS.filter((c) => !memConsents.some((m) => m.id === c.id))]
  }

  getConsent(id: string): ConsentRecord {
    const found = this.listConsents().find((c) => c.id === id)
    if (!found) throw new NotFoundException(`知情同意记录 ${id} 不存在`)
    return found
  }

  createConsent(data: { patient?: string; type?: string; procedure?: string }): ConsentRecord {
    const record: ConsentRecord = {
      id: `C-${Date.now().toString(36)}`,
      patient: data.patient?.trim() || '新患者',
      type: data.type || 'General',
      procedure: data.procedure || '标准诊疗流程',
      signedAt: null,
      status: 'pending',
      witness: null,
      createdAt: nowIso().slice(0, 10),
    }
    memConsents.unshift(record)
    return record
  }

  updateConsent(id: string, data: Partial<ConsentRecord>): ConsentRecord {
    const mem = memConsents.find((c) => c.id === id)
    if (mem) {
      Object.assign(mem, data)
      return mem
    }
    const seed = SEED_CONSENTS.find((c) => c.id === id)
    if (seed) {
      Object.assign(seed, data)
      return seed
    }
    throw new NotFoundException(`知情同意记录 ${id} 不存在`)
  }

  // POST /records/:id/sign — 签署知情同意
  signConsent(id: string, signer?: string): ConsentRecord {
    const record = this.getConsent(id)
    record.status = 'signed'
    record.signedAt = nowIso()
    record.signedBy = signer || '当前用户'
    record.witness = record.witness ?? '护士站'
    return record
  }

  // ===== Education Materials (materials 别名同存储) =====
  listMaterials(): EducationMaterialDto[] {
    return [...memMaterials, ...SEED_MATERIALS.filter((m) => !memMaterials.some((x) => x.id === m.id))]
  }

  getMaterial(id: string): EducationMaterialDto {
    const found = this.listMaterials().find((m) => m.id === id)
    if (!found) throw new NotFoundException(`宣教材料 ${id} 不存在`)
    return found
  }

  createMaterial(data: Partial<EducationMaterialDto>): EducationMaterialDto {
    const material: EducationMaterialDto = {
      id: `M-${Date.now().toString(36)}`,
      title: data.title?.trim() || '未命名宣教材料',
      lang: data.lang ?? 'zh-CN',
      category: data.category ?? 'General',
      pages: data.pages ?? 1,
      views: 0,
      format: data.format ?? 'PDF',
      content: data.content,
      summary: data.summary,
      createdAt: nowIso().slice(0, 10),
    }
    memMaterials.unshift(material)
    return material
  }

  updateMaterial(id: string, data: Partial<EducationMaterialDto>): EducationMaterialDto {
    const material = this.getMaterial(id)
    Object.assign(material, data)
    return material
  }
}
