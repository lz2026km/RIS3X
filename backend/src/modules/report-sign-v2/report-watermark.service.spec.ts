// [G005 v3.0.6.11-101 Wave 6A F8] ReportWatermarkService spec
// 水印参数确定性 + 哈希校验 (篡改检测)
import { ReportWatermarkService } from './report-watermark.service'
import type { WatermarkConfig } from './report-watermark.types'

describe('ReportWatermarkService (F8 水印 V2)', () => {
  let service: ReportWatermarkService

  beforeEach(() => {
    service = new ReportWatermarkService()
  })

  const params: Partial<WatermarkConfig> = {
    text: { content: '内部资料', position: 'tile', rotation: -30, opacity: 0.15, spacing: 160, fontSize: 16 },
    image: { enabled: true, logoKey: 'hospital-logo', logoName: 'LOGO', scale: 0.25, position: 'bottom-right', opacity: 0.4 },
  }

  it('水印参数确定性: 相同参数 → 相同 contentHash/tamperCode/tiles', () => {
    const a = service.buildPreview({ reportId: 'RPT-WM-1', text: '双肺纹理清晰。', config: params })
    const b = service.buildPreview({ reportId: 'RPT-WM-1', text: '双肺纹理清晰。', config: params })
    expect(a.contentHash).toBe(b.contentHash)
    expect(a.tamperCode).toBe(b.tamperCode)
    expect(a.tiles).toEqual(b.tiles)
    expect(a.config.text.opacity).toBe(0.15)
  })

  it('参数归一化: 越界值被收敛 (opacity/rotation/spacing/fontSize)', () => {
    const out = service.buildPreview({
      config: {
        text: { content: 'x', position: 'tile', rotation: 999, opacity: 3, spacing: 1, fontSize: 200 },
      },
    })
    expect(out.config.text.rotation).toBe(180)
    expect(out.config.text.opacity).toBe(1)
    expect(out.config.text.spacing).toBe(40)
    expect(out.config.text.fontSize).toBe(48)
  })

  it('平铺水印: tile 模式生成 16 格, 单点模式生成 1 格', () => {
    const tile = service.buildPreview({ config: { text: { content: 'x', position: 'tile', rotation: 0, opacity: 0.1, spacing: 100, fontSize: 12 } } })
    expect(tile.tiles).toHaveLength(16)
    const center = service.buildPreview({ config: { text: { content: 'x', position: 'center', rotation: 0, opacity: 0.1, spacing: 100, fontSize: 12 } } })
    expect(center.tiles).toHaveLength(1)
  })

  it('哈希校验: 未篡改 valid, 篡改文本后 invalid', () => {
    const preview = service.buildPreview({ reportId: 'RPT-WM-2', text: '右肺上叶结节影。', config: params })
    const ok = service.verify({ reportId: 'RPT-WM-2', text: '右肺上叶结节影。', config: preview.config, contentHash: preview.contentHash, tamperCode: preview.tamperCode })
    expect(ok.valid).toBe(true)
    const tampered = service.verify({ reportId: 'RPT-WM-2', text: '右肺上叶结节影, 增大。', config: preview.config, contentHash: preview.contentHash, tamperCode: preview.tamperCode })
    expect(tampered.valid).toBe(false)
    expect(tampered.tamperOk).toBe(false)
    expect(tampered.contentHashOk).toBe(true)
  })

  it('哈希校验: 参数变化导致 contentHash 不匹配', () => {
    const preview = service.buildPreview({ reportId: 'RPT-WM-3', text: '报告内容', config: params })
    const changed = service.verify({
      reportId: 'RPT-WM-3',
      text: '报告内容',
      config: { ...preview.config, text: { ...preview.config.text, opacity: 0.5 } },
      contentHash: preview.contentHash,
      tamperCode: preview.tamperCode,
    })
    expect(changed.valid).toBe(false)
    expect(changed.contentHashOk).toBe(false)
  })

  it('getConfig 返回默认配置 (tile 平铺 + 概念 LOGO)', () => {
    const { data } = service.getConfig()
    expect(data.version).toBe(2)
    expect(data.text.position).toBe('tile')
    expect(data.image.logoName).toContain('LOGO')
  })
})
