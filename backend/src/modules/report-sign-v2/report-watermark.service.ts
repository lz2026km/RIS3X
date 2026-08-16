// [G005 v3.0.6.11-101 Wave 6A F8] 报告水印 V2 服务 — 孤儿模块模式
// 文字水印 (内容/位置/旋转/透明度/重复间距) + 图像水印 (LOGO 概念数据) + 防篡改校验码 (报告哈希)
// 全部输出确定性: 同一参数 → 同一 contentHash/tamperCode
import { BadRequestException, Injectable } from '@nestjs/common'
import { createHash } from 'node:crypto'
import type {
  ImageWatermarkParams,
  TextWatermarkParams,
  WatermarkConfig,
  WatermarkPosition,
  WatermarkPreview,
  WatermarkTile,
  WatermarkVerifyInput,
  WatermarkVerifyResult,
} from './report-watermark.types'
import { DEFAULT_IMAGE_WATERMARK, DEFAULT_TEXT_WATERMARK, WATERMARK_POSITIONS } from './report-watermark.types'

const clamp = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v))

@Injectable()
export class ReportWatermarkService {
  private readonly baseConfig: WatermarkConfig = {
    version: 2,
    text: { ...DEFAULT_TEXT_WATERMARK },
    image: { ...DEFAULT_IMAGE_WATERMARK },
  }

  getConfig(): { source: 'database' | 'demo'; generatedAt: string; data: WatermarkConfig } {
    return { source: 'demo', generatedAt: new Date().toISOString(), data: this.normalizeConfig(this.baseConfig) }
  }

  // 参数归一化: 所有输入收敛到合法范围, 保证确定性
  normalizeConfig(input: Partial<WatermarkConfig>): WatermarkConfig {
    const text: TextWatermarkParams = {
      content: input.text?.content?.trim() ? String(input.text.content).slice(0, 80) : DEFAULT_TEXT_WATERMARK.content,
      position: WATERMARK_POSITIONS.includes(input.text?.position as WatermarkPosition) ? (input.text!.position as WatermarkPosition) : DEFAULT_TEXT_WATERMARK.position,
      rotation: clamp(Number(input.text?.rotation ?? DEFAULT_TEXT_WATERMARK.rotation), -180, 180),
      opacity: clamp(Number(input.text?.opacity ?? DEFAULT_TEXT_WATERMARK.opacity), 0.05, 1),
      spacing: clamp(Math.round(Number(input.text?.spacing ?? DEFAULT_TEXT_WATERMARK.spacing)), 40, 400),
      fontSize: clamp(Math.round(Number(input.text?.fontSize ?? DEFAULT_TEXT_WATERMARK.fontSize)), 8, 48),
    }
    const image: ImageWatermarkParams = {
      enabled: Boolean(input.image?.enabled ?? DEFAULT_IMAGE_WATERMARK.enabled),
      logoKey: String(input.image?.logoKey ?? DEFAULT_IMAGE_WATERMARK.logoKey).slice(0, 64),
      logoName: String(input.image?.logoName ?? DEFAULT_IMAGE_WATERMARK.logoName).slice(0, 80),
      scale: clamp(Number(input.image?.scale ?? DEFAULT_IMAGE_WATERMARK.scale), 0.05, 1),
      position: WATERMARK_POSITIONS.includes(input.image?.position as WatermarkPosition) ? (input.image!.position as WatermarkPosition) : DEFAULT_IMAGE_WATERMARK.position,
      opacity: clamp(Number(input.image?.opacity ?? DEFAULT_IMAGE_WATERMARK.opacity), 0.05, 1),
    }
    return { version: 2, text, image }
  }

  // 规范序列化 → 确定性哈希
  canonicalString(config: WatermarkConfig): string {
    return JSON.stringify({
      v: config.version,
      t: config.text,
      i: config.image,
    })
  }

  contentHashOf(config: WatermarkConfig): string {
    return createHash('sha256').update(this.canonicalString(config)).digest('hex')
  }

  // 防篡改校验码: 报告内容哈希 + 水印参数哈希 复合
  tamperCodeOf(config: WatermarkConfig, text: string, reportId?: string): string {
    const textHash = createHash('sha256').update(`${reportId ?? ''}|${text}`).digest('hex')
    return createHash('sha256').update(`${textHash}|${this.canonicalString(config)}|2`).digest('hex').slice(0, 16)
  }

  // 平铺水印格点 (确定性): tile 模式 4x4 网格, 其余位置单枚
  buildTiles(config: WatermarkConfig): WatermarkTile[] {
    if (config.text.position === 'tile') {
      const tiles: WatermarkTile[] = []
      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 4; col++) {
          tiles.push({ x: col * config.text.spacing, y: row * config.text.spacing, rotation: config.text.rotation })
        }
      }
      return tiles
    }
    return [{ x: 0, y: 0, rotation: config.text.rotation }]
  }

  buildPreview(input: Partial<{ reportId: string; text: string; config: Partial<WatermarkConfig> }>): WatermarkPreview {
    const config = this.normalizeConfig(input.config ?? {})
    const reportText = String(input.text ?? '')
    return {
      source: 'demo',
      generatedAt: new Date().toISOString(),
      config,
      contentHash: this.contentHashOf(config),
      tamperCode: this.tamperCodeOf(config, reportText, input.reportId),
      tiles: this.buildTiles(config),
    }
  }

  verify(input: WatermarkVerifyInput): WatermarkVerifyResult {
    const config = this.normalizeConfig(input.config ?? {})
    const computedContentHash = this.contentHashOf(config)
    const computedTamperCode = this.tamperCodeOf(config, input.text ?? '', input.reportId)
    const contentHashOk = !input.contentHash || input.contentHash === computedContentHash
    const tamperOk = !input.tamperCode || input.tamperCode === computedTamperCode
    return {
      valid: contentHashOk && tamperOk,
      contentHashOk,
      tamperOk,
      computedContentHash,
      computedTamperCode,
    }
  }

  // 通用报告哈希 (电子签名使用): 内容 + 校验盐 → 16 位 hex
  hashReportText(reportId: string, text: string): string {
    if (!reportId) throw new BadRequestException('reportId 不能为空')
    return createHash('sha256').update(`${reportId}|${text}|g005-seal-v2`).digest('hex').slice(0, 16)
  }
}
