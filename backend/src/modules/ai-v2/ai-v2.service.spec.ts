/**
 * G005 RIS v3.0.6.11-101 Wave 3C - AiV2Service 规格
 * 覆盖: 器官检出确定性 + 置信度范围, 评分规则边界, 挂片布局正确性
 */
import { AiV2Service } from './ai-v2.service'
import { findHangingRule, HANGING_RULES } from './hanging-rules'
import { scoreDraftText } from './draft-scoring'

describe('AiV2Service (modules/ai-v2)', () => {
  let service: AiV2Service

  beforeEach(() => {
    service = new AiV2Service()
  })

  // ── 多器官自动检出 ─────────────────────────────────────────────────────────
  describe('多器官自动检出', () => {
    it('同一输入两次分析结果完全一致 (确定性, 无随机; 忽略毫秒级时间戳)', () => {
      const a = service.analyzeOrgans({ studyId: 'ST-001', modality: 'CT', bodyPart: 'CHEST' })
      const b = service.analyzeOrgans({ studyId: 'ST-001', modality: 'CT', bodyPart: 'CHEST' })
      const { createdAt: _ca, ...restA } = a
      const { createdAt: _cb, ...restB } = b
      expect(restA).toEqual(restB)
      expect(a.id).toBe(b.id)
      expect(a.avgConfidence).toBe(b.avgConfidence)
      expect(a.organs).toEqual(b.organs)
    })

    it('不同 studyId 产生不同结果', () => {
      const a = service.analyzeOrgans({ studyId: 'ST-001', modality: 'CT', bodyPart: 'CHEST' })
      const b = service.analyzeOrgans({ studyId: 'ST-002', modality: 'CT', bodyPart: 'CHEST' })
      expect(a.id).not.toBe(b.id)
    })

    it('置信度恒在 (0, 0.99] 范围内且 > 0', () => {
      for (const studyId of ['A', 'B', 'C', 'D']) {
        const result = service.analyzeOrgans({ studyId, modality: 'CT', bodyPart: 'ABDOMEN' })
        expect(result.organs.length).toBeGreaterThan(0)
        for (const organ of result.organs) {
          expect(organ.confidence).toBeGreaterThan(0)
          expect(organ.confidence).toBeLessThanOrEqual(0.99)
          expect(organ.volumeMl).toBeGreaterThan(0)
        }
      }
    })

    it('边界框与掩码在图像范围内 (含像素统计输入)', () => {
      const result = service.analyzeOrgans({
        studyId: 'ST-X',
        modality: 'CT',
        bodyPart: 'CHEST',
        pixelStats: { mean: -620, stddev: 250, slices: 120, width: 512, height: 512 },
      })
      for (const organ of result.organs) {
        expect(organ.bbox.x).toBeGreaterThanOrEqual(0)
        expect(organ.bbox.y).toBeGreaterThanOrEqual(0)
        expect(organ.bbox.x + organ.bbox.width).toBeLessThanOrEqual(512)
        expect(organ.bbox.y + organ.bbox.height).toBeLessThanOrEqual(512)
        expect(organ.mask.cx).toBeGreaterThanOrEqual(0)
        expect(organ.mask.cx).toBeLessThanOrEqual(512)
        expect(organ.mask.cy).toBeGreaterThanOrEqual(0)
        expect(organ.mask.cy).toBeLessThanOrEqual(512)
      }
    })

    it('胸部 CT 中肺置信度高于心脏 (灰度窗拟合: 空气窗 vs 软组织窗)', () => {
      const result = service.analyzeOrgans({ studyId: 'ST-LUNG', modality: 'CT', bodyPart: 'CHEST' })
      const lung = result.organs.find((o) => o.code === 'lung')
      const heart = result.organs.find((o) => o.code === 'heart')
      expect(lung).toBeDefined()
      expect(heart).toBeDefined()
      expect(lung!.confidence).toBeGreaterThanOrEqual(0.5)
      expect(lung!.confidence).toBeGreaterThan(heart!.confidence)
      expect(lung!.status).toBe('detected')
    })

    it('腹部 CT 检出肝/肾/脾/胰/胆囊, 且器官列表按置信度降序', () => {
      const result = service.analyzeOrgans({ studyId: 'ST-ABD', modality: 'CT', bodyPart: 'ABDOMEN' })
      const codes = result.organs.map((o) => o.code)
      expect(codes).toContain('liver')
      expect(codes).toContain('kidney')
      expect(codes).toContain('spleen')
      expect(codes).toContain('pancreas')
      expect(codes).toContain('gallbladder')
      for (let i = 1; i < result.organs.length; i += 1) {
        expect(result.organs[i - 1]!.confidence).toBeGreaterThanOrEqual(result.organs[i]!.confidence)
      }
    })

    it('异常灰度输入 (纯噪声均值) 仍返回合法置信度下限', () => {
      const result = service.analyzeOrgans({
        studyId: 'ST-NOISE',
        modality: 'CT',
        bodyPart: 'CHEST',
        pixelStats: { mean: -5000, stddev: 0.1 },
      })
      for (const organ of result.organs) {
        expect(organ.confidence).toBeGreaterThanOrEqual(0.05)
        expect(organ.confidence).toBeLessThanOrEqual(0.99)
      }
    })

    it('一键生成报告段落: 包含器官数与体积信息, 同一结果两次生成一致', () => {
      const result = service.analyzeOrgans({ studyId: 'ST-RP', modality: 'CT', bodyPart: 'CHEST' })
      const p1 = service.generateReportParagraph(result)
      const p2 = service.generateReportParagraph(result)
      expect(p1.paragraph).toBe(p2.paragraph)
      expect(p1.paragraph).toContain('自动检出')
      expect(p1.paragraph).toContain(`${result.organsDetected} 个器官`)
      expect(p1.paragraph).toContain('mL')
    })
  })

  // ── 报告草稿评分 ───────────────────────────────────────────────────────────
  describe('报告草稿评分', () => {
    it('空草稿得 0 分并给出 error 级建议', () => {
      const result = service.scoreDraft({ draftText: '' })
      expect(result.score).toBe(0)
      expect(result.grade).toBe('差')
      expect(result.suggestions.some((s) => s.code === 'EMPTY_DRAFT' && s.level === 'error')).toBe(true)
    })

    it('完整规范草稿 (三段结构 + 带单位数值) 得分 >= 80', () => {
      const draft = [
        '【检查技术】CT 胸部平扫+增强扫描, 层厚 5mm。',
        '【影像所见】双肺纹理清晰, 未见明确异常密度影; 右上肺可见结节大小约 12mm×9mm, 边缘光整; 纵隔未见明显肿大淋巴结。',
        '【诊断意见】右上肺结节, 建议 3 个月后低剂量 CT 随访复查。',
      ].join('\n')
      const result = service.scoreDraft({ draftText: draft, modality: 'CT' })
      expect(result.score).toBeGreaterThanOrEqual(80)
      expect(result.dimensions.length).toBe(4)
      const structure = result.dimensions.find((d) => d.key === 'structure')
      expect(structure!.score).toBe(100)
    })

    it('数值缺少单位: 触发 UNIT_MISSING 警告且单位维度扣分', () => {
      const bad = '【影像所见】右上肺结节大小约 12, 边界尚清; 随访周期 3。'
      const good = '【影像所见】右上肺结节大小约 12mm, 边界尚清; 随访周期 3 个月。'
      const a = service.scoreDraft({ draftText: bad, modality: 'CT' })
      const b = service.scoreDraft({ draftText: good, modality: 'CT' })
      expect(a.suggestions.some((s) => s.code === 'UNIT_MISSING')).toBe(true)
      expect(b.suggestions.some((s) => s.code === 'UNIT_MISSING')).toBe(false)
      expect(a.dimensions.find((d) => d.key === 'units')!.score).toBeLessThan(b.dimensions.find((d) => d.key === 'units')!.score)
    })

    it('口语化术语扣分并给出术语建议', () => {
      const result = service.scoreDraft({ draftText: '胸部看着还可以, 肺上好像有点东西, 感觉差不多正常' })
      expect(result.suggestions.some((s) => s.code === 'INFORMAL_TERM')).toBe(true)
    })

    it('同一文本两次评分完全一致 (确定性; 忽略毫秒级时间戳)', () => {
      const draft = '【检查技术】CT 平扫。\n【影像所见】未见异常密度影。\n【诊断意见】未见异常。'
      const a = service.scoreDraft({ draftText: draft, modality: 'CT' })
      const b = service.scoreDraft({ draftText: draft, modality: 'CT' })
      const { scoredAt: _sa, ...restA } = a
      const { scoredAt: _sb, ...restB } = b
      expect(restA).toEqual(restB)
      expect(a.id).toBe(b.id)
      expect(a.score).toBe(b.score)
      expect(a.dimensions).toEqual(b.dimensions)
      expect(a.suggestions).toEqual(b.suggestions)
    })

    it('纯函数 scoreDraftText 边界: 分数恒在 0-100', () => {
      const texts = ['', 'x', '短文本', '【检查技术】CT\n【影像所见】未见异常\n【诊断意见】未见异常']
      for (const t of texts) {
        const { total } = scoreDraftText(t, 'CT')
        expect(total).toBeGreaterThanOrEqual(0)
        expect(total).toBeLessThanOrEqual(100)
      }
    })
  })

  // ── 智能挂片 ───────────────────────────────────────────────────────────────
  describe('智能挂片', () => {
    it('CT 胸部 → 2×2 肺窗+纵隔窗布局', () => {
      const rec = service.recommendHanging({ modality: 'CT', bodyPart: 'CHEST' })
      expect(rec.layoutId).toBe('hp-ct-chest')
      expect(rec.rows).toBe(2)
      expect(rec.cols).toBe(2)
      const labels = rec.cells.map((c) => c.label)
      expect(labels).toContain('轴位-肺窗')
      expect(labels).toContain('轴位-纵隔窗')
      const lungCell = rec.cells.find((c) => c.label === '轴位-肺窗')
      expect(lungCell!.windowWidth).toBe(1500)
      expect(lungCell!.windowCenter).toBe(-600)
      expect(rec.reasons.some((r) => r.includes('规则匹配'))).toBe(true)
    })

    it('MR 头部 → 2×3 T1/T2/FLAIR 多序列', () => {
      const rec = service.recommendHanging({ modality: 'MR', bodyPart: 'HEAD' })
      expect(rec.layoutId).toBe('hp-mr-head')
      expect(rec.rows).toBe(2)
      expect(rec.cols).toBe(3)
      expect(rec.cells.length).toBe(6)
      const keys = rec.cells.map((c) => c.seriesKey)
      expect(keys).toContain('T1')
      expect(keys).toContain('T2')
      expect(keys).toContain('FLAIR')
    })

    it('未知模态 → 兜底 1×1 单视野', () => {
      const rec = service.recommendHanging({ modality: 'XX', bodyPart: 'HEAD' })
      expect(rec.layoutId).toBe('hp-fallback')
      expect(rec.rows).toBe(1)
      expect(rec.cols).toBe(1)
      expect(rec.reasons.some((r) => r.includes('默认单视野'))).toBe(true)
    })

    it('序列描述匹配提升得分并记录 matchedSeries', () => {
      const rec = service.recommendHanging({
        modality: 'CT',
        bodyPart: 'CHEST',
        series: [
          { description: 'CHEST_1.0 B30f 肺窗', seriesNumber: 2 },
          { description: 'CHEST_1.0 B40f 纵隔窗', seriesNumber: 3 },
        ],
      })
      expect(rec.matchedSeries.length).toBeGreaterThanOrEqual(2)
    })

    it('规则表 findHangingRule: CT/CHEST 与 MR/HEAD 恒定命中, 大小写不敏感', () => {
      expect(findHangingRule('ct', 'chest').id).toBe('hp-ct-chest')
      expect(findHangingRule('MR', 'head').id).toBe('hp-mr-head')
      expect(findHangingRule('CT', 'CHEST').id).toBe('hp-ct-chest')
      expect(HANGING_RULES.length).toBeGreaterThanOrEqual(10)
    })

    it('应用布局: 生成应用记录并进入历史偏好 (同一医生二次推荐走 history)', () => {
      const rec = service.recommendHanging({ modality: 'CT', bodyPart: 'CHEST', doctorId: 'D1' })
      const applied = service.applyHanging({ examId: 'EX-1', layoutId: rec.layoutId, appliedBy: 'D1' })
      expect(applied.layoutName).toBe('CT 胸部 肺窗+纵隔窗')
      expect(service.listHangingApplications().some((a) => a.id === applied.id)).toBe(true)

      const rec2 = service.recommendHanging({ modality: 'CT', bodyPart: 'CHEST', doctorId: 'D1' })
      expect(rec2.source).toBe('history')
      expect(rec2.reasons.some((r) => r.includes('历史偏好'))).toBe(true)
    })

    it('历史偏好优先于规则表: 医生曾用 MR 头部布局, 同模态其他部位不受影响', () => {
      service.applyHanging({ examId: 'EX-2', layoutId: 'hp-mr-head', appliedBy: 'D2' })
      const head = service.recommendHanging({ modality: 'MR', bodyPart: 'HEAD', doctorId: 'D2' })
      expect(head.source).toBe('history')
      const spine = service.recommendHanging({ modality: 'MR', bodyPart: 'SPINE', doctorId: 'D2' })
      expect(spine.source).toBe('rule')
      expect(spine.layoutId).toBe('hp-mr-spine')
    })

    it('seed 回退: 初始化即有 seed 应用记录与检出结果 (孤儿模块离线可用)', () => {
      expect(service.listHangingApplications().length).toBeGreaterThanOrEqual(3)
      expect(service.listOrganResults().length).toBeGreaterThanOrEqual(2)
      expect(service.overview().smartHanging.applications).toBeGreaterThanOrEqual(3)
    })
  })
})
