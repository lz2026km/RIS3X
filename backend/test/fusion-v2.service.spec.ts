import { FusionV2Service } from '../src/modules/fusion-v2/fusion-v2.service'

describe('FusionV2Service', () => {
  let svc: FusionV2Service

  beforeEach(() => {
    svc = new FusionV2Service()
  })

  it('register returns per-transform-type metrics', async () => {
    const r = await svc.register({ fixedSeriesUid: 'F1', movingSeriesUid: 'M1', transformType: 'deformable' })
    expect(r.transformType).toBe('deformable')
    expect(r.metrics.dice).toBe(0.92)
    expect(r.matrix[3]).toEqual([0, 0, 0, 1])
    expect(r.processingTimeMs).toBeGreaterThanOrEqual(150)
  })

  it('register falls back to rigid for unknown type', async () => {
    const r = await svc.register({ fixedSeriesUid: 'F1', movingSeriesUid: 'M1', transformType: 'bogus' as any })
    expect(r.metrics.dice).toBe(0.82)
    expect(r.transformType).toBe('bogus')
  })

  it('render returns frame for each plane', async () => {
    for (const plane of ['axial', 'coronal', 'sagittal'] as const) {
      const r = await svc.render({ fixedSeriesUid: 'F1', movingSeriesUid: 'M1', plane, sliceIndex: 30, alpha: 0.6, windowWidth: 400, windowLevel: 40, fusionWindowWidth: 300, fusionWindowLevel: 60 })
      expect(r.frameId).toMatch(/^frame-v2-/)
      expect(r.plane).toBe(plane)
      expect(r.alpha).toBe(0.6)
      expect(r.width).toBe(512)
    }
  })

  it('getSeries returns known patient series', async () => {
    const r = await svc.getSeries('P003')
    expect(r.series).toHaveLength(2)
    expect(r.series[0].seriesDescription).toBe('Brain T1+C')
  })

  it('getSeries returns defaults for unknown patient', async () => {
    const r = await svc.getSeries('P999')
    expect(r.series[0].seriesDescription).toBe('Standard CT')
  })
})
