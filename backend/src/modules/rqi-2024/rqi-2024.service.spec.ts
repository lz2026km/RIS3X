/**
 * G005 放射RIS系统 v3.0.6.11-105 Wave 1A - 放射影像质控指标 (2024 年版) 服务测试
 * 覆盖:
 *   1. 7 条国标指标计算正确性 (构造分子/分母 → 断言比率与达标)
 *   2. IIA-01 CT / MRI 分列
 *   3. RCV-04 国标 13 类诊断过滤 + 10 分钟边界 (=10min 计入, >10min 不计, 记录不全不计)
 *   4. ICME-05 ×1000‰ 口径
 *   5. 目标值配置 PUT 后达标状态随之变化
 *   6. 确定性 (同输入同输出)
 *   7. dashboard / trend / detail / export 与孤儿模块 seed 回退
 */
import { BadRequestException } from '@nestjs/common'
import { Rqi2024Service, buildSeedDataset } from './rqi-2024.service'
import {
  buildIndicatorDetail,
  buildIndicatorTrend,
  computeIndicators,
  monthWindow,
  round,
} from './rqi-2024.indicator-engine'
import {
  CRITICAL_DIAGNOSES,
  DEFAULT_INDICATOR_CONFIG,
  type RqiCriticalEvent,
  type RqiExam,
  type RqiReport,
  type RqiSourceDataset,
} from './rqi-2024.types'

// ================= 构造数据 =================

function exam(partial: Partial<RqiExam> & { examId: string }): RqiExam {
  return {
    accessionNumber: partial.examId,
    patientId: 'P1',
    patientName: '测试患者',
    modality: 'CT',
    bodyPart: '',
    startedAt: '2026-08-05T08:00:00.000Z',
    isEmergency: false,
    isEnhancedCt: false,
    hasArtifact: false,
    contrastExtravasation: false,
    ...partial,
  }
}

function report(partial: Partial<RqiReport> & { reportId: string }): RqiReport {
  return {
    examId: 'EX',
    patientId: 'P1',
    patientName: '测试患者',
    modality: 'CT',
    bodyPart: '',
    isEmergency: false,
    examStartedAt: '2026-08-05T08:00:00.000Z',
    reportIssuedAt: '2026-08-05T09:00:00.000Z',
    hasRadiologistSignature: true,
    conclusionMatchesFindings: true,
    hasObviousError: false,
    ...partial,
  }
}

function critical(id: string, diagnosis: string, minutes: number, extra: Partial<RqiCriticalEvent> = {}): RqiCriticalEvent {
  const foundAt = '2026-08-05T08:00:00.000Z'
  const notifiedAt = new Date(new Date(foundAt).getTime() + minutes * 60000).toISOString()
  return {
    id,
    criticalId: id,
    patientId: 'P1',
    patientName: '测试患者',
    diagnosis,
    foundAt,
    notifiedAt,
    hasTimeRecord: true,
    hasContentRecord: true,
    hasSignerRecord: true,
    ...extra,
  }
}

function craftDataset(): RqiSourceDataset {
  const exams: RqiExam[] = [
    exam({ examId: 'E-CT1', modality: 'CT', isEnhancedCt: true, hasArtifact: true, contrastExtravasation: true }),
    exam({ examId: 'E-CT2', modality: 'CT', isEnhancedCt: true }),
    exam({ examId: 'E-CT3', modality: 'CT', isEnhancedCt: true }),
    exam({ examId: 'E-CT4', modality: 'CT', isEnhancedCt: true }),
    exam({ examId: 'E-MR1', modality: 'MR', hasArtifact: true }),
    exam({ examId: 'E-MR2', modality: 'MR' }),
    exam({ examId: 'E-DR1', modality: 'DR' }),
    exam({ examId: 'E-MG1', modality: 'MG' }),
  ]

  const emergencyReports: RqiReport[] = [
    report({ reportId: 'ER1', modality: 'DR', isEmergency: true, examStartedAt: '2026-08-06T08:00:00.000Z', reportIssuedAt: '2026-08-06T09:00:00.000Z' }),
    report({ reportId: 'ER2', modality: 'DR', isEmergency: true, examStartedAt: '2026-08-06T08:00:00.000Z', reportIssuedAt: '2026-08-06T09:59:00.000Z' }),
    report({ reportId: 'ER3', modality: 'CT', isEmergency: true, examStartedAt: '2026-08-06T08:00:00.000Z', reportIssuedAt: '2026-08-06T10:00:00.000Z' }),
    report({ reportId: 'ER4', modality: 'DR', isEmergency: true, examStartedAt: '2026-08-06T08:00:00.000Z', reportIssuedAt: '2026-08-06T10:01:00.000Z' }),
  ]

  const reports: RqiReport[] = [
    ...emergencyReports,
    report({ reportId: 'NR1' }),
    report({ reportId: 'NR2' }),
    report({ reportId: 'NR3' }),
    report({ reportId: 'NR-ERR', hasObviousError: true, errorNote: '残留模板文字' }),
    report({ reportId: 'NR-SIG', hasRadiologistSignature: false }),
    report({ reportId: 'P1', modality: 'MR', bodyPart: '前列腺', isProstateMr: true, radsCategory: 'PI-RADS 3' }),
    report({ reportId: 'P2', modality: 'MR', bodyPart: '前列腺', isProstateMr: true, radsCategory: 'PI-RADS 4' }),
    report({ reportId: 'P3', modality: 'MR', bodyPart: '前列腺', isProstateMr: true, radsCategory: '' }),
    report({ reportId: 'M1', modality: 'MG', isMammoTarget: true, radsCategory: 'BI-RADS 2' }),
    report({ reportId: 'M2', modality: 'MG', isMammoTarget: true, radsCategory: 'BI-RADS 4' }),
  ]

  const criticalEvents: RqiCriticalEvent[] = CRITICAL_DIAGNOSES.map((cat, i) => critical(`C-${i + 1}`, cat, i < 10 ? 5 : 15))
  criticalEvents.push(critical('C-X', '慢性支气管炎', 5))

  return { exams, reports, criticalEvents, generatedAt: '2026-08-05T00:00:00.000Z', source: 'seed' }
}

const W = monthWindow('2026-08')

describe('Rqi2024Service (Wave 1A 放射影像质控指标 2024 版)', () => {
  describe('1. 7 条国标指标计算正确性', () => {
    it('分子/分母/比率/达标 与手工口径一致', () => {
      const dataset = craftDataset()
      const results = computeIndicators(dataset, DEFAULT_INDICATOR_CONFIG, W)
      const byCode = new Map(results.map((r) => [r.code, r]))

      expect(results).toHaveLength(7)

      const iia = byCode.get('RQI-IIA-01')!
      expect([iia.numerator, iia.denominator, iia.rate, iia.status]).toEqual([2, 6, 33.33, 'fail'])
      expect(iia.unit).toBe('%')

      const rrc = byCode.get('RQI-RRC-02')!
      expect([rrc.numerator, rrc.denominator, rrc.rate]).toEqual([3, 4, 75])
      expect(rrc.status).toBe('fail')

      const rws = byCode.get('RQI-RWS-03')!
      expect([rws.numerator, rws.denominator, rws.rate]).toEqual([12, 14, 85.71])
      expect(rws.status).toBe('fail')

      const rcv = byCode.get('RQI-RCV-04')!
      expect([rcv.numerator, rcv.denominator, rcv.rate]).toEqual([10, 13, 76.92])
      expect(rcv.status).toBe('fail')

      const icme = byCode.get('RQI-ICME-05')!
      expect([icme.numerator, icme.denominator, icme.rate]).toEqual([1, 4, 250])
      expect(icme.status).toBe('fail')

      const pirads = byCode.get('RQI-RCR-06')!
      expect([pirads.numerator, pirads.denominator, pirads.rate]).toEqual([2, 3, 66.67])

      const birads = byCode.get('RQI-RCR-07')!
      expect([birads.numerator, birads.denominator, birads.rate, birads.status]).toEqual([2, 2, 100, 'pass'])

      for (const r of results) {
        expect(r.rate).toBe(round((r.numerator / r.denominator) * (r.unit === '‰' ? 1000 : 100), 2))
      }
    })

    it('目标值未定义时分母为 0 → 比率 0 且不崩溃', () => {
      const empty: RqiSourceDataset = { exams: [], reports: [], criticalEvents: [], generatedAt: W.dateFrom, source: 'seed' }
      const results = computeIndicators(empty, DEFAULT_INDICATOR_CONFIG, W)
      expect(results).toHaveLength(7)
      results.forEach((r) => {
        expect(r.denominator).toBe(0)
        expect(r.rate).toBe(0)
      })
    })
  })

  describe('2. IIA-01 CT / MRI 分列', () => {
    it('byDimension 分别输出 CT / MRI 分子分母比率', () => {
      const dataset = craftDataset()
      const iia = computeIndicators(dataset, DEFAULT_INDICATOR_CONFIG, W).find((r) => r.code === 'RQI-IIA-01')!
      expect(iia.byDimension).toHaveLength(2)
      const ct = iia.byDimension!.find((d) => d.dimension === 'CT')!
      const mri = iia.byDimension!.find((d) => d.dimension === 'MRI')!
      expect([ct.numerator, ct.denominator, ct.rate]).toEqual([1, 4, 25])
      expect([mri.numerator, mri.denominator, mri.rate]).toEqual([1, 2, 50])
      expect(iia.numerator).toBe(ct.numerator + mri.numerator)
      expect(iia.denominator).toBe(ct.denominator + mri.denominator)
      expect(iia.byDimension!.map((d) => d.dimension)).toEqual(['CT', 'MRI'])
    })
  })

  describe('3. RCV-04 13 类诊断过滤 + 10 分钟边界', () => {
    it('仅统计国标 13 类诊断, =10min 计入, >10min 不计, 记录不全不计', () => {
      const events: RqiCriticalEvent[] = [
        critical('B1', '急性脑出血', 10),
        critical('B2', '急性脑出血', 11),
        critical('B3', '急性脑出血', 5, { hasSignerRecord: false }),
        critical('B4', '急性脑出血', 10, { hasTimeRecord: false }),
        critical('B5', '慢性支气管炎', 1),
      ]
      const dataset: RqiSourceDataset = { exams: [], reports: [], criticalEvents: events, generatedAt: W.dateFrom, source: 'seed' }
      const rcv = computeIndicators(dataset, DEFAULT_INDICATOR_CONFIG, W).find((r) => r.code === 'RQI-RCV-04')!
      expect(rcv.denominator).toBe(4)
      expect(rcv.numerator).toBe(1)
      expect(rcv.rate).toBe(25)
    })

    it('13 类诊断各命中一次', () => {
      expect(CRITICAL_DIAGNOSES).toHaveLength(13)
      const nodes = CRITICAL_DIAGNOSES.map((d, i) => critical(`D${i}`, d, 1))
      const dataset: RqiSourceDataset = { exams: [], reports: [], criticalEvents: nodes, generatedAt: W.dateFrom, source: 'seed' }
      const rcv = computeIndicators(dataset, DEFAULT_INDICATOR_CONFIG, W).find((r) => r.code === 'RQI-RCV-04')!
      expect(rcv.denominator).toBe(13)
      expect(rcv.numerator).toBe(13)
      expect(rcv.rate).toBe(100)
    })
  })

  describe('4. ICME-05 ×1000‰ 口径', () => {
    it('外渗率以千分率计: 1/1000 → 1‰ (而非 0.1)', () => {
      const exams: RqiExam[] = Array.from({ length: 1000 }, (_, i) =>
        exam({ examId: `EC-${i}`, modality: 'CT', isEnhancedCt: true, contrastExtravasation: i === 0 }),
      )
      const dataset: RqiSourceDataset = { exams, reports: [], criticalEvents: [], generatedAt: W.dateFrom, source: 'seed' }
      const icme = computeIndicators(dataset, DEFAULT_INDICATOR_CONFIG, W).find((r) => r.code === 'RQI-ICME-05')!
      expect(icme.unit).toBe('‰')
      expect(icme.numerator).toBe(1)
      expect(icme.denominator).toBe(1000)
      expect(icme.rate).toBe(1)
      expect(icme.rate).toBe(round((1 / 1000) * 1000, 2))
      // 非增强 CT 不计入分母
      const plain: RqiSourceDataset = {
        exams: [exam({ examId: 'EC-P', modality: 'CT', isEnhancedCt: false, contrastExtravasation: true })],
        reports: [],
        criticalEvents: [],
        generatedAt: W.dateFrom,
        source: 'seed',
      }
      const none = computeIndicators(plain, DEFAULT_INDICATOR_CONFIG, W).find((r) => r.code === 'RQI-ICME-05')!
      expect(none.denominator).toBe(0)
      expect(none.rate).toBe(0)
    })
  })

  describe('5. 目标值配置 PUT 后达标状态随之变化', () => {
    it('调高 RWS-03 门槛 → 由达标转为不达标', async () => {
      const service = new Rqi2024Service()
      const before = await service.getIndicators()
      const beforeRws = before.indicators.find((r) => r.code === 'RQI-RWS-03')!
      service.updateConfig([{ code: 'RQI-RWS-03', target: 0 }])
      const relaxed = await service.getIndicators()
      const relaxedRws = relaxed.indicators.find((r) => r.code === 'RQI-RWS-03')!
      expect(relaxedRws.target).toBe(0)
      expect(relaxedRws.status).toBe('pass')
      expect(beforeRws.status).not.toBe('pass')

      service.updateConfig([{ code: 'RQI-RWS-03', target: 100 }])
      const strict = await service.getIndicators()
      expect(strict.indicators.find((r) => r.code === 'RQI-RWS-03')!.status).toBe('fail')
    })

    it('GET /config 返回默认 7 项; PUT 后 source=override 且内存持久化', () => {
      const service = new Rqi2024Service()
      const defaults = service.getConfig()
      expect(defaults.source).toBe('default')
      expect(defaults.items).toHaveLength(7)
      expect(defaults.items.find((c) => c.code === 'RQI-RCV-04')!.target).toBe(100)
      service.updateConfig([{ code: 'RQI-RCV-04', target: 90, warnMargin: 10 }])
      const updated = service.getConfig()
      expect(updated.source).toBe('override')
      expect(updated.updatedAt).toBeTruthy()
      expect(updated.items.find((c) => c.code === 'RQI-RCV-04')!.target).toBe(90)
      expect(updated.items.find((c) => c.code === 'RQI-RCV-04')!.warnMargin).toBe(10)
      // 下一次读取仍保留
      expect(service.getConfig().items.find((c) => c.code === 'RQI-RCV-04')!.target).toBe(90)
    })

    it('未知指标编码 → BadRequestException', () => {
      const service = new Rqi2024Service()
      expect(() => service.updateConfig([{ code: 'RQI-XXX-99' as never, target: 1 }])).toThrow(BadRequestException)
    })
  })

  describe('6. 确定性 (同输入同输出)', () => {
    it('引擎两次计算结果完全一致', () => {
      const a = computeIndicators(craftDataset(), DEFAULT_INDICATOR_CONFIG, W)
      const b = computeIndicators(craftDataset(), DEFAULT_INDICATOR_CONFIG, W)
      expect(a).toEqual(b)
    })

    it('服务两次 dashboard/indicators 结果一致 (seed 回退)', async () => {
      const service = new Rqi2024Service()
      const a = await service.getIndicators()
      const b = await service.getIndicators()
      expect(a.indicators).toEqual(b.indicators)
      const d1 = await service.getDashboard()
      const d2 = await service.getDashboard()
      expect(d1.indicators).toEqual(d2.indicators)
      expect(d1.mom).toEqual(d2.mom)
    })
  })

  describe('7. 孤儿模块 seed 回退与其它端点', () => {
    it('无 Prisma 时 seed 数据集 7 指标分母均 > 0', async () => {
      const service = new Rqi2024Service()
      const res = await service.getIndicators()
      expect(res.source).toBe('seed')
      expect(res.indicators).toHaveLength(7)
      res.indicators.forEach((r) => expect(r.denominator).toBeGreaterThan(0))
      const seed = buildSeedDataset()
      expect(seed.exams.length).toBeGreaterThan(0)
      expect(seed.reports.length).toBeGreaterThan(0)
      expect(seed.criticalEvents.length).toBeGreaterThan(0)
    })

    it('dashboard: 达标数/达标率/环比 结构正确', async () => {
      const service = new Rqi2024Service()
      const dash = await service.getDashboard()
      expect(dash.total).toBe(7)
      expect(dash.passCount + dash.warnCount + dash.failCount).toBe(7)
      expect(dash.passRate).toBe(round((dash.passCount / 7) * 100, 1))
      expect(dash.mom).toHaveLength(7)
      expect(dash.indicators.map((i) => i.code)).toEqual(DEFAULT_INDICATOR_CONFIG.map((c) => c.code))
    })

    it('trend: 月度升序, 月份格式 YYYY-MM, 与明细口径一致', async () => {
      const service = new Rqi2024Service()
      const trend = await service.getTrend('RQI-IIA-01', 12)
      expect(trend.points.length).toBeGreaterThan(0)
      const months = trend.points.map((p) => p.month)
      expect(months).toEqual([...months].sort())
      trend.points.forEach((p) => {
        expect(p.month).toMatch(/^\d{4}-\d{2}$/)
        expect(p.rate).toBe(round((p.numerator / p.denominator) * 100, 2))
      })
      const enginePoints = buildIndicatorTrend('RQI-IIA-01', buildSeedDataset(), DEFAULT_INDICATOR_CONFIG, 12)
      expect(trend.points).toEqual(enginePoints)
    })

    it('detail: 分子 id 为分母 id 子集, 每条明细在分母内', () => {
      const detail = buildIndicatorDetail('RQI-IIA-01', craftDataset(), DEFAULT_INDICATOR_CONFIG, W)
      expect(detail.indicator.numerator).toBe(2)
      expect(detail.numeratorIds).toEqual(['E-CT1', 'E-MR1'])
      expect(detail.denominatorIds).toHaveLength(6)
      detail.numeratorIds.forEach((id) => expect(detail.denominatorIds).toContain(id))
      detail.items.forEach((i) => {
        expect(i.inDenominator).toBe(true)
        expect(i.kind).toBe('exam')
      })
    })

    it('getDetail 未知编码 → BadRequestException', async () => {
      const service = new Rqi2024Service()
      await expect(service.getDetail('RQI-UNKNOWN')).rejects.toBeInstanceOf(BadRequestException)
    })

    it('export: CSV 含表头与 7 行, JSON 可解析', async () => {
      const service = new Rqi2024Service()
      const csv = await service.export({ format: 'csv' })
      expect(csv.format).toBe('csv')
      expect(csv.filename).toMatch(/^rqi-2024-.*\.csv$/)
      expect(csv.content.startsWith('\ufeff')).toBe(true)
      const rows = csv.content.replace('\ufeff', '').split('\n')
      expect(rows[0]).toContain('指标编码')
      expect(rows).toHaveLength(8)
      const json = await service.export({ format: 'json' })
      const parsed = JSON.parse(json.content) as { indicators: unknown[] }
      expect(parsed.indicators).toHaveLength(7)
      expect(json.filename).toMatch(/\.json$/)
    })

    it('export: period 过滤生效 (无记录月份分母为 0)', async () => {
      const service = new Rqi2024Service()
      const res = await service.export({ format: 'json', dateFrom: '2026-08-01', dateTo: '2026-08-14' })
      const parsed = JSON.parse(res.content) as { indicators: Array<{ denominator: number }> }
      expect(parsed.indicators).toHaveLength(7)
      parsed.indicators.forEach((i) => expect(i.denominator).toBeGreaterThan(0))
    })
  })
})
