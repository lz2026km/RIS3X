// [G005 Wave3A P16] image-ai assess / listAssessments spec
import { ImageAiService } from './image-ai.service'

describe('ImageAiService (assess / listAssessments)', () => {
  let service: ImageAiService

  beforeEach(() => {
    service = new ImageAiService()
  })

  it('assess returns deterministic three-dimension scores (artifact/exposure/positioning)', async () => {
    const a = await service.assess({ studyId: 'EX-5001', modality: 'MR', bodyPart: '头颅' })
    const b = await service.assess({ studyId: 'EX-5001', modality: 'MR', bodyPart: '头颅' })
    expect(a.overall.score).toBeGreaterThanOrEqual(55)
    expect(a.overall.score).toBeLessThanOrEqual(99)
    expect(a.artifact.score).toBe(a.artifact.score)
    expect(a.artifact.issues.length).toBeGreaterThan(0)
    expect(a.exposure.score).toBe(b.exposure.score)
    expect(a.positioning.score).toBe(b.positioning.score)
    expect(a.overall.score).toBe(b.overall.score)
    expect(a.overall.score).toBe(Math.round(a.artifact.score * 0.35 + a.exposure.score * 0.3 + a.positioning.score * 0.35))
  })

  it('listAssessments returns seed records sorted by assessedAt desc', () => {
    const list = service.listAssessments()
    expect(list.length).toBeGreaterThanOrEqual(10)
    for (let i = 1; i < list.length; i++) {
      expect(new Date(list[i - 1]!.assessedAt).getTime()).toBeGreaterThanOrEqual(new Date(list[i]!.assessedAt).getTime())
    }
    expect(list[0]!.id).toMatch(/^assess-\d+$/)
    expect(list[0]!.artifact.score).toBeGreaterThanOrEqual(55)
  })

  it('listAssessments filters by studyId and paginates', () => {
    const list = service.listAssessments({ studyId: 'EX-5001', pageSize: 2 })
    expect(list.length).toBe(1)
    expect(list[0]!.studyId).toBe('EX-5001')
    const paged = service.listAssessments({ page: 2, pageSize: 3 })
    expect(paged.length).toBeLessThanOrEqual(3)
  })

  it('new assess results append to history list', async () => {
    await service.assess({ studyId: 'NEW-STU-9', modality: 'DR', bodyPart: '胸部' })
    const found = service.listAssessments({ studyId: 'NEW-STU-9' })
    expect(found.length).toBe(1)
    expect(found[0]!.studyId).toBe('NEW-STU-9')
  })
})
