/**
 * [G005 W9-QC] 规范化缺陷库服务 (defect-library): 分类/缺陷项 CRUD + 聚合
 * 孤儿模块: 内存 + seed, 可无 DB 启动。
 */
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { DEFECT_CATEGORIES, DEFECT_ITEMS } from './defect-library.data'
import type { DefectAggregation, DefectCategory, DefectItem, DefectSeverity } from './defect-library.types'

const SEVERITIES: DefectSeverity[] = ['low', 'medium', 'high', 'critical']

@Injectable()
export class DefectLibraryService {
  private categories: DefectCategory[] = DEFECT_CATEGORIES.map((c) => ({ ...c }))
  private items: DefectItem[] = DEFECT_ITEMS.map((i) => ({ ...i }))
  private seq = 100

  private nextId(prefix: string): string {
    this.seq += 1
    return `${prefix}-${this.seq}`
  }

  listCategories(): DefectCategory[] {
    return this.categories.map((c) => ({ ...c }))
  }

  createCategory(input: { code: string; name: string; nameEn?: string; description?: string }): DefectCategory {
    const code = (input.code ?? '').trim().toUpperCase()
    if (!code) throw new BadRequestException('code 不能为空')
    if (!input.name?.trim()) throw new BadRequestException('name 不能为空')
    if (this.categories.some((c) => c.code === code)) throw new BadRequestException(`分类编码 ${code} 已存在`)
    const category: DefectCategory = { id: this.nextId('dc'), code, name: input.name.trim(), nameEn: input.nameEn, description: input.description?.trim() ?? '' }
    this.categories.push(category)
    return { ...category }
  }

  listItems(filter: { categoryCode?: string; severity?: DefectSeverity; keyword?: string } = {}): DefectItem[] {
    let rows = this.items
    if (filter.categoryCode) rows = rows.filter((i) => i.categoryCode === filter.categoryCode)
    if (filter.severity) rows = rows.filter((i) => i.severity === filter.severity)
    if (filter.keyword?.trim()) {
      const kw = filter.keyword.trim().toLowerCase()
      rows = rows.filter((i) => i.code.toLowerCase().includes(kw) || i.name.toLowerCase().includes(kw) || i.description.toLowerCase().includes(kw))
    }
    return rows.map((i) => ({ ...i }))
  }

  getItem(id: string): DefectItem {
    const item = this.items.find((i) => i.id === id || i.code === id)
    if (!item) throw new NotFoundException(`缺陷项 ${id} 不存在`)
    return { ...item }
  }

  createItem(input: Omit<DefectItem, 'id'>): DefectItem {
    if (!input.code?.trim()) throw new BadRequestException('code 不能为空')
    if (!input.name?.trim()) throw new BadRequestException('name 不能为空')
    if (!this.categories.some((c) => c.code === input.categoryCode)) throw new BadRequestException(`分类 ${input.categoryCode} 不存在`)
    if (!SEVERITIES.includes(input.severity)) throw new BadRequestException('severity 不合法')
    if (this.items.some((i) => i.code === input.code.trim().toUpperCase())) throw new BadRequestException(`缺陷编码 ${input.code} 已存在`)
    const item: DefectItem = { ...input, id: this.nextId('di'), code: input.code.trim().toUpperCase(), name: input.name.trim() }
    this.items.push(item)
    return { ...item }
  }

  updateItem(id: string, patch: Partial<Omit<DefectItem, 'id' | 'code'>>): DefectItem {
    const item = this.items.find((i) => i.id === id || i.code === id)
    if (!item) throw new NotFoundException(`缺陷项 ${id} 不存在`)
    if (patch.categoryCode && !this.categories.some((c) => c.code === patch.categoryCode)) throw new BadRequestException('分类不存在')
    if (patch.severity && !SEVERITIES.includes(patch.severity)) throw new BadRequestException('severity 不合法')
    Object.assign(item, patch)
    return { ...item }
  }

  deleteItem(id: string): { id: string; deleted: true } {
    const item = this.items.find((i) => i.id === id || i.code === id)
    if (!item) throw new NotFoundException(`缺陷项 ${id} 不存在`)
    this.items = this.items.filter((i) => i.id !== item.id)
    return { id: item.id, deleted: true }
  }

  aggregation(): DefectAggregation {
    const byCategory = this.categories.map((c) => ({
      categoryCode: c.code,
      categoryName: c.name,
      count: this.items.filter((i) => i.categoryCode === c.code).length,
    }))
    const bySeverity = SEVERITIES.map((severity) => ({ severity, count: this.items.filter((i) => i.severity === severity).length }))
    const byCategorySeverity: DefectAggregation['byCategorySeverity'] = []
    for (const c of this.categories) {
      for (const severity of SEVERITIES) {
        const count = this.items.filter((i) => i.categoryCode === c.code && i.severity === severity).length
        if (count > 0) byCategorySeverity.push({ categoryCode: c.code, severity, count })
      }
    }
    return { total: this.items.length, byCategory, bySeverity, byCategorySeverity }
  }
}
