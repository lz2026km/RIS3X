import { RdsrService } from '../src/modules/rdsr/rdsr.service'

describe('RdsrService', () => {
  let svc: RdsrService
  let originalRandom: () => number

  beforeEach(() => {
    svc = new RdsrService()
    originalRandom = Math.random
  })

  afterEach(() => {
    Math.random = originalRandom
  })

  describe('parse', () => {
    it('parses with defaults when no request data is given', async () => {
      const r = await svc.parse({})
      expect(r.modality).toBe('CT')
      expect(r.bodyPart).toBe('胸部')
      expect(r.id).toBeTruthy()
      expect(r.studyInstanceUid).toMatch(/^1\.2\.840\./)
      expect(r.alertLevel).toBeDefined()
      expect(r.examDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })

    it('uses dicomJson body part and explicit modality', async () => {
      const r = await svc.parse({ dicomJson: { BodyPartExamined: '腹部' }, modality: 'MR' })
      expect(r.bodyPart).toBe('腹部')
      expect(r.modality).toBe('MR')
    })

    it('flags warning when dose exceeds DRL', async () => {
      Math.random = () => 0.2
      const r = await svc.parse({ modality: 'CT', dicomJson: { BodyPartExamined: '胸部' } })
      expect(r.ctdivol).toBeGreaterThan(15)
      expect(r.ctdivol).toBeLessThanOrEqual(15 * 1.5)
      expect(r.alertLevel).toBe('warning')
    })

    it('flags critical when dose far exceeds DRL', async () => {
      Math.random = () => 1
      const r = await svc.parse({ modality: 'CT', dicomJson: { BodyPartExamined: '胸部' } })
      expect(r.ctdivol).toBeGreaterThan(15 * 1.5)
      expect(r.alertLevel).toBe('critical')
    })

    it('keeps normal when dose is below DRL', async () => {
      Math.random = () => 0
      const r = await svc.parse({ modality: 'CT', dicomJson: { BodyPartExamined: '胸部' } })
      expect(r.ctdivol).toBeLessThanOrEqual(15)
      expect(r.alertLevel).toBe('normal')
    })
  })

  describe('getDrls', () => {
    it('returns all national DRLs', async () => {
      const data = await svc.getDrls()
      expect(data.length).toBeGreaterThanOrEqual(5)
    })

    it('filters by modality and body part', async () => {
      const data = await svc.getDrls('CT', '头部')
      expect(data).toHaveLength(1)
      expect(data[0].ctdivolDrl).toBe(60)
    })

    it('returns empty when filter matches nothing', async () => {
      const data = await svc.getDrls('MR')
      expect(data).toHaveLength(0)
    })
  })

  describe('getStats', () => {
    it('returns zeros when nothing parsed', async () => {
      const s = await svc.getStats()
      expect(s).toEqual({ totalExams: 0, avgCtdivol: 0, avgDlp: 0, maxCtdivol: 0, maxDlp: 0, warningCount: 0, criticalCount: 0, trend: [] })
    })

    it('computes aggregates, filters and trend from parsed exams', async () => {
      const a = await svc.parse({ modality: 'CT', dicomJson: { BodyPartExamined: '胸部' } })
      const b = await svc.parse({ modality: 'CT', dicomJson: { BodyPartExamined: '头部' } })
      const all = await svc.getStats()
      expect(all.totalExams).toBe(2)
      expect(all.avgCtdivol).toBeGreaterThan(0)
      expect(all.avgDlp).toBeGreaterThan(0)
      expect(all.maxCtdivol).toBeGreaterThanOrEqual(Math.max(a.ctdivol, b.ctdivol))
      expect(all.trend.length).toBeGreaterThanOrEqual(1)
      expect(all.trend[0].date).toBe(a.examDate)
      expect(all.trend[0].avgCtdivol).toBeGreaterThan(0)

      const filtered = await svc.getStats(a.examDate, a.examDate, 'CT')
      expect(filtered.totalExams).toBe(2)

      const onlyMr = await svc.getStats(undefined, undefined, 'MR')
      expect(onlyMr.totalExams).toBe(0)
    })
  })

  describe('setDrl', () => {
    it('updates an existing DRL threshold and merges into the list', async () => {
      const updated = await svc.setDrl({ bodyPart: '胸部', ctdivolDrl: 20, dlpDrl: 600, source: 'custom' })
      const chest = updated.filter((d) => d.bodyPart === '胸部')
      expect(chest).toHaveLength(1)
      expect(chest[0].ctdivolDrl).toBe(20)
      expect(chest[0].dlpDrl).toBe(600)
      expect(chest[0].source).toBe('custom')
      expect(updated.length).toBeGreaterThanOrEqual(5)
    })

    it('adds a new custom DRL row for unknown body part', async () => {
      const updated = await svc.setDrl({ bodyPart: '颈部', ctdivolDrl: 30, dlpDrl: 900 })
      const neck = updated.find((d) => d.bodyPart === '颈部')
      expect(neck).toBeDefined()
      expect(neck!.modality).toBe('CT')
      expect(neck!.dlpDrl).toBe(900)
    })

    it('uses the customized threshold when evaluating parse alerts', async () => {
      await svc.setDrl({ bodyPart: '胸部', ctdivolDrl: 100, dlpDrl: 5000 })
      Math.random = () => 0.2
      const r = await svc.parse({ modality: 'CT', dicomJson: { BodyPartExamined: '胸部' } })
      expect(r.ctdivol).toBe(18)
      expect(r.alertLevel).toBe('normal')
    })
  })

  describe('getTodayStats', () => {
    it('returns zeros when nothing parsed today', async () => {
      const s = await svc.getTodayStats()
      expect(s.totalExams).toBe(0)
      expect(s.avgDlp).toBe(0)
      expect(s.bodyPartDistribution).toEqual([])
      expect(s.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })

    it('aggregates today exams and body part distribution', async () => {
      await svc.parse({ modality: 'CT', dicomJson: { BodyPartExamined: '胸部' } })
      await svc.parse({ modality: 'CT', dicomJson: { BodyPartExamined: '胸部' } })
      await svc.parse({ modality: 'CT', dicomJson: { BodyPartExamined: '腹部' } })
      const s = await svc.getTodayStats()
      expect(s.totalExams).toBe(3)
      expect(s.avgDlp).toBeGreaterThan(0)
      const chest = s.bodyPartDistribution.find((b) => b.bodyPart === '胸部')
      expect(chest).toBeDefined()
      expect(chest!.examCount).toBe(2)
      expect(chest!.avgDlp).toBeGreaterThan(0)
    })
  })

  describe('patient cumulative dose', () => {
    it('throws when the patient has no records', async () => {
      await expect(svc.getPatientCumulative('P-MISSING')).rejects.toThrow()
    })

    it('aggregates 30d/1y DLP and monthly trend for a patient', async () => {
      const a = await svc.parse({ patientId: 'P001', patientName: '张三', modality: 'CT', dicomJson: { BodyPartExamined: '胸部' } })
      const b = await svc.parse({ patientId: 'P001', patientName: '张三', modality: 'CT', dicomJson: { BodyPartExamined: '头部' } })
      await svc.parse({ patientId: 'P002', patientName: '李四', modality: 'CT', dicomJson: { BodyPartExamined: '腹部' } })
      const c = await svc.getPatientCumulative('P001')
      expect(c.patientName).toBe('张三')
      expect(c.totalExams).toBe(2)
      expect(c.totalDlp30d).toBeGreaterThan(0)
      expect(c.totalDlp1y).toBeCloseTo(a.dlp + b.dlp, 1)
      expect(c.annualLimit).toBe(5000)
      expect(c.monthlyTrend.length).toBe(12)
      expect(c.monthlyTrend[11].totalDlp).toBeCloseTo(a.dlp + b.dlp, 1)
      expect(c.exams).toHaveLength(2)
      expect(c.exams[0].studyInstanceUid).toMatch(/^1\.2\.840\./)
    })

    it('splits the trend across months when exam date is old', async () => {
      const old = new Date()
      old.setDate(old.getDate() - 150)
      const oldDate = old.toISOString().slice(0, 10)
      await svc.parse({ patientId: 'P003', patientName: '王五', modality: 'CT', examDate: oldDate, dicomJson: { BodyPartExamined: '胸部' } })
      const c = await svc.getPatientCumulative('P003')
      expect(c.totalDlp30d).toBe(0)
      expect(c.totalDlp1y).toBeGreaterThan(0)
      expect(c.monthlyTrend.filter((m) => m.totalDlp > 0)).toHaveLength(1)
    })
  })

  describe('searchPatients', () => {
    it('returns grouped summaries and filters by keyword', async () => {
      await svc.parse({ patientId: 'P001', patientName: '张三', modality: 'CT', dicomJson: { BodyPartExamined: '胸部' } })
      await svc.parse({ patientId: 'P001', patientName: '张三', modality: 'CT', dicomJson: { BodyPartExamined: '头部' } })
      await svc.parse({ patientId: 'P002', patientName: '李四', modality: 'CT', dicomJson: { BodyPartExamined: '腹部' } })
      const all = await svc.searchPatients()
      expect(all).toHaveLength(2)
      const zhang = all.find((s) => s.patientId === 'P001')
      expect(zhang).toBeDefined()
      expect(zhang!.examCount).toBeGreaterThanOrEqual(2)
      expect(zhang!.totalDlp1y).toBeGreaterThan(0)
      const matched = await svc.searchPatients('张三')
      expect(matched).toHaveLength(1)
      expect(matched[0].patientId).toBe('P001')
      const none = await svc.searchPatients('不存在')
      expect(none).toHaveLength(0)
    })
  })

  describe('alerts', () => {
    it('lists only warning/critical records and supports ack', async () => {
      Math.random = () => 1
      const critical = await svc.parse({ patientId: 'P003', patientName: '高剂量', modality: 'CT', dicomJson: { BodyPartExamined: '胸部' } })
      Math.random = () => 0.2
      const warning = await svc.parse({ patientId: 'P003', patientName: '高剂量', modality: 'CT', dicomJson: { BodyPartExamined: '胸部' } })
      expect(critical.alertLevel).toBe('critical')
      expect(warning.alertLevel).toBe('warning')

      const alerts = await svc.getAlerts()
      expect(alerts.length).toBeGreaterThanOrEqual(2)
      const target = alerts.find((a) => a.id === critical.id)
      expect(target).toBeDefined()
      expect(target!.level).toBe('critical')
      expect(target!.acknowledged).toBe(false)
      expect(target!.ctdivolDrl).toBe(15)
      expect(target!.dlpDrl).toBe(500)

      const acked = await svc.ackAlert(critical.id)
      expect(acked.acknowledged).toBe(true)
      expect(acked.ackedAt).toBeDefined()

      const pending = await svc.getAlerts('pending')
      expect(pending.find((a) => a.id === critical.id)).toBeUndefined()
      const acknowledged = await svc.getAlerts('acknowledged')
      expect(acknowledged.find((a) => a.id === critical.id)).toBeDefined()
    })

    it('ack is idempotent', async () => {
      Math.random = () => 1
      const r = await svc.parse({ patientId: 'P004', patientName: '李四', modality: 'CT', dicomJson: { BodyPartExamined: '胸部' } })
      await svc.ackAlert(r.id)
      const again = await svc.ackAlert(r.id)
      expect(again.acknowledged).toBe(true)
    })

    it('throws when acking an unknown alert', async () => {
      await expect(svc.ackAlert('missing-id')).rejects.toThrow()
    })
  })

  describe('Dose SR parsing', () => {
    it('extracts CTDIvol/DLP/SSDE from DICOM JSON tags', async () => {
      const r = await svc.parse({
        modality: 'CT',
        dicomJson: {
          BodyPartExamined: '腹部',
          PatientID: 'P900',
          PatientName: '结构化患者',
          StudyInstanceUID: '1.2.840.12345',
          StudyDate: '2026-07-01',
          CTDIvol: '42.5',
          DLP: '1234.5',
          SSDE: '38.2',
        },
      })
      expect(r.bodyPart).toBe('腹部')
      expect(r.patientId).toBe('P900')
      expect(r.ctdivol).toBe(42.5)
      expect(r.dlp).toBe(1234.5)
      expect(r.ssde).toBe(38.2)
      expect(r.examDate).toBe('2026-07-01')
      expect(r.studyInstanceUid).toBe('1.2.840.12345')
    })

    it('extracts dose values from SR ContentSequence items', async () => {
      const r = await svc.parse({
        modality: 'CT',
        dicomJson: {
          BodyPartExamined: '头部',
          ContentSequence: [
            {
              ConceptNameCodeSequence: [{ CodeValue: '113840', CodeMeaning: 'CTDIvol' }],
              MeasuredValueSequence: [{ NumericValue: '52.0' }],
            },
            {
              ConceptNameCodeSequence: [{ CodeValue: '113855', CodeMeaning: 'DLP' }],
              NumericValue: '880.5',
            },
            {
              ConceptNameCodeSequence: [{ CodeValue: '113844', CodeMeaning: 'SSDE' }],
              MeasuredValueSequence: [{ NumericValue: '45.1' }],
            },
          ],
        },
      })
      expect(r.ctdivol).toBe(52)
      expect(r.dlp).toBe(880.5)
      expect(r.ssde).toBe(45.1)
      expect(r.alertLevel).toBe('normal')
    })

    it('falls back to random values when dose fields are absent', async () => {
      Math.random = () => 0.5
      const r = await svc.parse({ modality: 'CT', dicomJson: { BodyPartExamined: '腰椎' } })
      expect(r.ctdivol).toBe(30)
      expect(r.dlp).toBe(600)
    })
  })
})
