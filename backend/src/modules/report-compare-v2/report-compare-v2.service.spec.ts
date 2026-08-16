/**
 * G005 放射RIS系统 v3.0.6.11-101 Wave 8A (report-compare-v2) - 报告对比 V2 服务测试
 * 覆盖:
 *   1. 行级 diff 正确性: 构造 新增/删除/修改 场景 (LCS 算法)
 *   2. 相似度确定性: 同输入恒同输出; 相同文本 = 100; 完全不同 → 低分
 *   3. 关键字段对比: 诊断结论 / 随访建议 / 测量值 变化识别
 *   4. 对比入口: 按 id / 按原文 / 参数校验 / 未知 id 404
 *   5. 孤儿模块: 无 DB 构造即 seed 可用, 预设组合 + 统计确定性
 */
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { ReportCompareV2Service } from './report-compare-v2.service'

describe('ReportCompareV2Service (Wave 8A 报告对比 V2)', () => {
  describe('1. 行级 diff 正确性', () => {
    it('新增行: 新文追加一行 → 类型 added, 行号正确', () => {
      const svc = new ReportCompareV2Service()
      const res = svc.compare({ textA: '双肺纹理清晰。', textB: '双肺纹理清晰。\n右肺上叶见磨玻璃结节。' })
      const ops = res.lineDiffs
      expect(ops[0]!.type).toBe('same')
      expect(ops[1]!.type).toBe('added')
      expect(ops[1]!.line).toBe('右肺上叶见磨玻璃结节。')
      expect(ops[1]!.lineNoNew).toBe(2)
      expect(ops[1]!.original).toBeUndefined()
      expect(res.sectionDiffs[0]!.type).toBe('added')
    })

    it('删除行: 旧文一行在新文消失 → 类型 removed', () => {
      const svc = new ReportCompareV2Service()
      const res = svc.compare({ textA: '双肺纹理清晰。\n纵隔淋巴结增大。', textB: '双肺纹理清晰。' })
      const ops = res.lineDiffs
      expect(ops[0]!.type).toBe('same')
      expect(ops[1]!.type).toBe('removed')
      expect(ops[1]!.line).toBe('纵隔淋巴结增大。')
      expect(ops[1]!.lineNoOld).toBe(2)
      expect(ops[1]!.original).toBe('纵隔淋巴结增大。')
      expect(res.sectionDiffs[0]!.type).toBe('removed')
    })

    it('修改行: 等长替换 → 配对为 modified, 原文/新文分别保留', () => {
      const svc = new ReportCompareV2Service()
      const res = svc.compare({ textA: '结节大小 8mm。', textB: '结节大小 7mm。' })
      const ops = res.lineDiffs
      expect(ops[0]!.type).toBe('modified')
      expect(ops[0]!.original).toBe('结节大小 8mm。')
      expect(ops[0]!.line).toBe('结节大小 7mm。')
      expect(res.sectionDiffs[0]!.type).toBe('modified')
    })

    it('完全相同文本 → 全部 same, 段落类型 same', () => {
      const svc = new ReportCompareV2Service()
      const res = svc.compare({ textA: '双肺纹理清晰。\n余未见异常。', textB: '双肺纹理清晰。\n余未见异常。' })
      expect(res.lineDiffs.every((op) => op.type === 'same')).toBe(true)
      expect(res.sectionDiffs[0]!.type).toBe('same')
      expect(res.statistics.same).toBe(2)
      expect(res.statistics.modified + res.statistics.added + res.statistics.removed).toBe(0)
    })

    it('中间修改 + 尾部新增混合场景: 增/删/改 三类同时存在', () => {
      const svc = new ReportCompareV2Service()
      const res = svc.compare({
        textA: ['肺纹理增多。', '右下肺见条索影。', '心影不大。'].join('\n'),
        textB: ['肺纹理增多。', '右下肺见斑片影。', '心影不大。', '建议复查。'].join('\n'),
      })
      const types = res.lineDiffs.map((op) => op.type)
      expect(types[0]).toBe('same')
      expect(types[1]).toBe('modified')
      expect(types[2]).toBe('same')
      expect(types[3]).toBe('added')
      expect(res.statistics.modified).toBe(1)
      expect(res.statistics.added).toBe(1)
      expect(res.statistics.same).toBe(2)
    })
  })

  describe('2. 相似度评分确定性', () => {
    it('相同输入两次对比 → 相似度完全一致 (确定性)', () => {
      const svc = new ReportCompareV2Service()
      const a = svc.compare({ textA: '右肺上叶见 8mm 磨玻璃结节影。', textB: '右肺上叶见 7mm 磨玻璃结节影，边界欠清。' })
      const b = svc.compare({ textA: '右肺上叶见 8mm 磨玻璃结节影。', textB: '右肺上叶见 7mm 磨玻璃结节影，边界欠清。' })
      expect(a.statistics.similarity).toBe(b.statistics.similarity)
      expect(a.deterministic).toBe(true)
    })

    it('完全相同文本 → 相似度 100', () => {
      const svc = new ReportCompareV2Service()
      const res = svc.compare({ textA: '双肺纹理清晰，余未见明显异常。', textB: '双肺纹理清晰，余未见明显异常。' })
      expect(res.statistics.similarity).toBe(100)
    })

    it('完全不同文本 → 低分 (< 30), 与相同文本分数有明显差距', () => {
      const svc = new ReportCompareV2Service()
      const same = svc.compare({ textA: '双肺纹理清晰。', textB: '双肺纹理清晰。' })
      const diff = svc.compare({ textA: '双肺纹理清晰。', textB: '右膝内侧半月板后角撕裂，前交叉韧带断裂。' })
      expect(diff.statistics.similarity).toBeLessThan(30)
      expect(diff.statistics.similarity).toBeLessThan(same.statistics.similarity)
    })

    it('相似度范围 0-100', () => {
      const svc = new ReportCompareV2Service()
      for (const res of [
        svc.compare({ reportAId: 'RPC-HIS-001', reportBId: 'RPC-HIS-002' }),
        svc.compare({ reportAId: 'RPC-DR-001', reportBId: 'RPC-DR-002' }),
        svc.compare({ reportAId: 'RPC-DA-002', reportBId: 'RPC-DA-001' }),
        svc.compare({ textA: 'a', textB: 'b' }),
      ]) {
        expect(res.statistics.similarity).toBeGreaterThanOrEqual(0)
        expect(res.statistics.similarity).toBeLessThanOrEqual(100)
      }
    })
  })

  describe('3. 关键字段对比', () => {
    it('测量值变化 (8mm → 7mm) → measurement 字段 modified', () => {
      const svc = new ReportCompareV2Service()
      const res = svc.compare({ reportAId: 'RPC-HIS-001', reportBId: 'RPC-HIS-002', type: 'patient-history' })
      const measurement = res.keyFields.find((f) => f.field === 'measurement')!
      expect(measurement.equal).toBe(false)
      expect(measurement.change).toBe('modified')
      expect(measurement.original).toContain('8mm')
      expect(measurement.updated).toContain('7mm')
    })

    it('随访建议新增 → recommendation 字段 change=modified, 原文为空更新有值', () => {
      const svc = new ReportCompareV2Service()
      const res = svc.compare({ reportAId: 'RPC-HIS-001', reportBId: 'RPC-HIS-002' })
      const rec = res.keyFields.find((f) => f.field === 'recommendation')!
      expect(rec.equal).toBe(false)
      expect(rec.updated).toContain('增强检查')
    })

    it('完全相同段落 → 关键字段 equal=true, change=same', () => {
      const svc = new ReportCompareV2Service()
      const res = svc.compare({ textA: '双乳未见明确异常。', textB: '双乳未见明确异常。' })
      expect(res.keyFields[0]!.equal).toBe(true)
      expect(res.keyFields[0]!.change).toBe('same')
    })

    it('关键字段对比包含 诊断结论/印象/随访建议/测量值 四类', () => {
      const svc = new ReportCompareV2Service()
      const res = svc.compare({ reportAId: 'RPC-DA-002', reportBId: 'RPC-DA-001', type: 'doctor-ai' })
      const fields = res.keyFields.map((f) => f.field).sort()
      expect(fields).toEqual(['diagnosis', 'impression', 'measurement', 'recommendation'])
    })
  })

  describe('4. 对比入口与校验', () => {
    it('按 id 对比: 三类场景均返回完整结果 (段落/关键字段/统计)', () => {
      const svc = new ReportCompareV2Service()
      for (const [a, b] of [
        ['RPC-HIS-001', 'RPC-HIS-002'],
        ['RPC-DR-001', 'RPC-DR-002'],
        ['RPC-DA-002', 'RPC-DA-001'],
      ] as const) {
        const res = svc.compare({ reportAId: a, reportBId: b })
        expect(res.sectionDiffs.length).toBeGreaterThan(0)
        expect(res.keyFields.length).toBeGreaterThan(0)
        expect(res.statistics.similarity).toBeGreaterThanOrEqual(0)
        expect(res.statistics.sectionsCompared).toBe(res.sectionDiffs.length)
        expect(res.reportA.id).toBe(a)
        expect(res.reportB.id).toBe(b)
      }
    })

    it('同时提供 id 与原文 / 都不提供 → BadRequestException', () => {
      const svc = new ReportCompareV2Service()
      expect(() => svc.compare({})).toThrow(BadRequestException)
      expect(() => svc.compare({ reportAId: 'RPC-HIS-001' })).toThrow(BadRequestException)
      expect(() => svc.compare({ reportAId: 'RPC-HIS-001', reportBId: 'RPC-HIS-002', textA: 'x', textB: 'y' })).toThrow(BadRequestException)
    })

    it('未知报告 id → NotFoundException', () => {
      const svc = new ReportCompareV2Service()
      expect(() => svc.compare({ reportAId: 'RPC-NO-SUCH', reportBId: 'RPC-HIS-002' })).toThrow(NotFoundException)
    })

    it('差异详情含 段落/原文/新文/类型; 统计摘要含 相同/修改/新增/删除', () => {
      const svc = new ReportCompareV2Service()
      const res = svc.compare({ reportAId: 'RPC-DA-002', reportBId: 'RPC-DA-001', type: 'doctor-ai' })
      for (const item of res.sectionDiffs) {
        expect(typeof item.section).toBe('string')
        expect(typeof item.original).toBe('string')
        expect(typeof item.updated).toBe('string')
        expect(['same', 'modified', 'added', 'removed']).toContain(item.type)
      }
      const st = res.statistics
      expect(st.same + st.modified + st.added + st.removed).toBe(st.totalLines)
      expect(st.changeRate).toBeGreaterThanOrEqual(0)
      expect(st.changeRate).toBeLessThanOrEqual(100)
      expect(st.keyFieldChanges).toBeGreaterThan(0)
    })
  })

  describe('5. 孤儿模块: seed 回退 + 预设 + 统计', () => {
    it('无 DB 构造服务 → 报告目录 / 预设组合可用', () => {
      const svc = new ReportCompareV2Service()
      const reports = svc.listReports()
      expect(reports.length).toBeGreaterThanOrEqual(8)
      expect(reports.every((r) => r.id && r.patientName && r.examDate)).toBe(true)
      const presets = svc.listPresets()
      expect(presets.length).toBe(3)
      expect(presets.map((p) => p.type)).toEqual(['patient-history', 'dual-read', 'doctor-ai'])
    })

    it('三类预设组合均能完成对比且类型推断正确', () => {
      const svc = new ReportCompareV2Service()
      for (const preset of svc.listPresets()) {
        const res = svc.compare({ reportAId: preset.reportAId, reportBId: preset.reportBId })
        expect(res.type).toBe(preset.type)
      }
    })

    it('统计: 报告数 / 预设数 / 类型分布 / 平均相似度确定性', () => {
      const svc = new ReportCompareV2Service()
      const stats = svc.getStats()
      expect(stats.totalReports).toBe(svc.listReports().length)
      expect(stats.presetCount).toBe(3)
      expect(stats.byType['patient-history']).toBe(1)
      expect(stats.byType['dual-read']).toBe(1)
      expect(stats.byType['doctor-ai']).toBe(1)
      expect(stats.avgSimilarity).toBeGreaterThan(0)
      expect(stats.avgSimilarity).toBeLessThanOrEqual(100)
      const stats2 = svc.getStats()
      expect(stats2.avgSimilarity).toBe(stats.avgSimilarity)
    })
  })
})
