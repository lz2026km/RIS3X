import { NotFoundException } from '@nestjs/common'
import { ImageAiService, AiScoreDto, AiScoreDtoV2 } from '../src/modules/qc/image-ai.service'

describe('ImageAiService', () => {
  let svc: ImageAiService

  const v1Dto: AiScoreDto = {
    instanceId: 'i1', modality: 'CT',
    motionArtifact: 4, metalArtifact: 2, ringArtifact: 3,
    exposureLow: 1, exposureNormal: 4, exposureOver: 1,
    positioningCorrect: 4, positioningMildRotation: 1, positioningSevereOffset: 0,
    overall: 85, operatorId: 'op1',
  }

  const v2Dto: AiScoreDtoV2 = {
    instanceId: 'i2', modality: 'CT',
    artifactScores: { motion: 4, metal: 3, ring: 2 },
    positioningScores: { setup: 4, rotation: 3, offset: 2 },
    exposure: { value: '正常', score: 4 },
    overall: 90, operatorId: 'op2',
  }

  beforeEach(() => {
    svc = new ImageAiService()
  })

  it('scoreV2 stores and getResultV2 finds by instanceId', async () => {
    const saved = await svc.scoreV2(v2Dto)
    expect(saved.id).toBeDefined()
    const found = await svc.getResultV2('i2')
    expect(found.instanceId).toBe('i2')
    expect(found.artifactScores.motion).toBe(4)
  })

  it('getResultV2 throws for unknown instance', async () => {
    await expect(svc.getResultV2('ghost')).rejects.toThrow(NotFoundException)
  })

  it('statsV2 filters and aggregates', async () => {
    await svc.scoreV2(v2Dto)
    await svc.scoreV2({ ...v2Dto, instanceId: 'i3', modality: 'MR', operatorId: 'op3' })
    const all = await svc.statsV2({})
    expect(all.totalScores).toBe(2)
    expect(all.avgArtifactMotion).toBe(4)
    const ct = await svc.statsV2({ modality: 'CT' })
    expect(ct.totalScores).toBe(1)
    const byOp = await svc.statsV2({ operatorId: 'op2' })
    expect(byOp.byOperator.op2).toBe(1)
    expect(byOp.byModality.CT).toBe(1)
  })

  it('statsV2 returns zeros when no items', async () => {
    const stats = await svc.statsV2({})
    expect(stats.totalScores).toBe(0)
    expect(stats.avgOverall).toBe(0)
  })

  it('score/getResult v1 legacy paths', async () => {
    const saved = await svc.score(v1Dto)
    expect(saved.id).toBeDefined()
    const byInstance = await svc.getResult('i1')
    expect(byInstance.overall).toBe(85)
    const byId = await svc.getResult(saved.id)
    expect(byId.instanceId).toBe('i1')
  })

  it('getResult throws when neither id nor instance found', async () => {
    await expect(svc.getResult('ghost')).rejects.toThrow(NotFoundException)
  })

  it('stats aggregates legacy scores with filters', async () => {
    await svc.score(v1Dto)
    await svc.score({ ...v1Dto, instanceId: 'i9', operatorId: 'op9' })
    const stats = await svc.stats({ dateFrom: '2020-01-01', dateTo: '2099-01-01' })
    expect(stats.totalScores).toBe(2)
    expect(stats.avgArtifact).toBeGreaterThan(0)
    expect(stats.byOperator.op1).toBe(1)
    const none = await svc.stats({ operatorId: 'nobody' })
    expect(none.totalScores).toBe(0)
  })
})
