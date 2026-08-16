import { NotFoundException, BadRequestException } from '@nestjs/common'
import { ResearchExportService } from './research-export.service'

const makePrisma = () => {
  const reject = jest.fn().mockRejectedValue(new Error('no db'))
  return {
    exam: { findMany: reject },
  } as never
}

describe('ResearchExportService', () => {
  describe('数据集构建 (确定性)', () => {
    it('buildDataset 按模态/病种/时间筛选并脱敏', async () => {
      const service = new ResearchExportService(makePrisma())
      const ds = await service.buildDataset({
        name: 'CT 肺结节队列',
        criteria: { modality: 'CT', disease: '结节', dateFrom: '2026-07-01', dateTo: '2026-07-31' },
      })
      expect(ds.id).toBeTruthy()
      expect(ds.recordCount).toBeGreaterThan(0)
      expect(ds.preview.length).toBeGreaterThan(0)
      expect(ds.preview[0].patientNameMasked).toContain('*')
    })

    it('空条件返回全部 seed 记录; 全部 modality 不过滤', async () => {
      const service = new ResearchExportService(makePrisma())
      const all = await service.buildDataset({ criteria: {} })
      expect(all.recordCount).toBe(6)
      const ct = await service.buildDataset({ criteria: { modality: '全部' } })
      expect(ct.recordCount).toBe(6)
    })

    it('按医生/结果筛选', async () => {
      const service = new ResearchExportService(makePrisma())
      const byDoctor = await service.buildDataset({ criteria: { doctor: '李明辉' } })
      expect(byDoctor.recordCount).toBeGreaterThan(0)
      expect(byDoctor.preview.every((r) => r.doctor === '李明辉')).toBe(true)
    })
  })

  describe('导出字段', () => {
    it('字段按组分类且默认选中集合非空', () => {
      const service = new ResearchExportService(makePrisma())
      const fields = service.listFields()
      expect(fields.length).toBeGreaterThan(0)
      expect(fields.some((f) => f.group === '患者')).toBe(true)
      expect(fields.some((f) => f.group === '影像')).toBe(true)
      expect(fields.some((f) => f.group === '测量')).toBe(true)
      expect(fields.filter((f) => f.selected).length).toBeGreaterThan(0)
    })
  })

  describe('导出任务', () => {
    it('createTask 生成任务 (格式/字段/记录数)', async () => {
      const service = new ResearchExportService(makePrisma())
      const ds = await service.buildDataset({ criteria: { modality: 'CT' } })
      const task = await service.createTask({
        name: '导出任务-1',
        datasetId: ds.id,
        format: 'CSV',
        fields: ['patientId', 'patientNameMasked', 'diagnosis'],
      })
      expect(task.id).toBeTruthy()
      expect(task.format).toBe('CSV')
      expect(task.fields).toEqual(['patientId', 'patientNameMasked', 'diagnosis'])
      expect(task.recordCount).toBe(ds.recordCount)
      expect(task.status).toBe('done')
    })

    it('三种格式均可创建 (CSV/JSON/EXCEL 概念)', async () => {
      const service = new ResearchExportService(makePrisma())
      const ds = await service.buildDataset({ criteria: {} })
      for (const format of ['CSV', 'JSON', 'EXCEL'] as const) {
        const task = await service.createTask({ name: `任务-${format}`, datasetId: ds.id, format, fields: [] })
        expect(task.format).toBe(format)
        expect(task.fields.length).toBeGreaterThan(0)
      }
    })

    it('空数据集创建任务 → BadRequestException', async () => {
      const service = new ResearchExportService(makePrisma())
      await expect(
        service.createTask({ name: '空集', datasetId: 'unknown-dataset', format: 'CSV', fields: [] }),
      ).rejects.toBeInstanceOf(BadRequestException)
    })

    it('任务历史包含 seed 回退 + 统计字段齐全', async () => {
      const service = new ResearchExportService(makePrisma())
      const tasks = service.listTasks()
      expect(tasks.length).toBeGreaterThan(0)
      const stats = await service.stats()
      expect(stats.totalTasks).toBeGreaterThan(0)
      expect(stats.byFormat.CSV + stats.byFormat.JSON + stats.byFormat.EXCEL).toBe(stats.totalTasks)
      expect(stats.last7Days.length).toBe(7)
    })

    it('getTaskContent 生成 CSV/JSON 内容 (概念)', async () => {
      const service = new ResearchExportService(makePrisma())
      const ds = await service.buildDataset({ criteria: {} })
      const task = await service.createTask({ name: '内容测试', datasetId: ds.id, format: 'JSON', fields: ['patientId', 'diagnosis'] })
      const content = await service.getTaskContent(task.id)
      expect(content.headers).toEqual(['patientId', 'diagnosis'])
      expect(content.rows.length).toBeGreaterThan(0)
      expect(content.content).toContain('"count"')
      const csvTask = await service.createTask({ name: 'CSV 测试', datasetId: ds.id, format: 'CSV', fields: ['patientId', 'diagnosis'] })
      const csv = await service.getTaskContent(csvTask.id)
      expect(csv.content.split('\n')[0]).toBe('patientId,diagnosis')
    })

    it('未知任务 → NotFoundException', async () => {
      const service = new ResearchExportService(makePrisma())
      await expect(service.getTask('unknown')).rejects.toBeInstanceOf(NotFoundException)
    })
  })
})
