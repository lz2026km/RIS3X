// [G005 v3.0.6.11-101 Wave 6A F8] 水印签章 V2 — 类型定义
export type WatermarkPosition = 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'tile'

export interface TextWatermarkParams {
  content: string
  position: WatermarkPosition
  rotation: number
  opacity: number
  spacing: number
  fontSize: number
}

export interface ImageWatermarkParams {
  enabled: boolean
  logoKey: string
  logoName: string
  scale: number
  position: WatermarkPosition
  opacity: number
}

export interface WatermarkConfig {
  version: 2
  text: TextWatermarkParams
  image: ImageWatermarkParams
}

export interface WatermarkTile {
  x: number
  y: number
  rotation: number
}

export interface WatermarkPreview {
  source: 'database' | 'demo'
  generatedAt: string
  config: WatermarkConfig
  contentHash: string
  tamperCode: string
  tiles: WatermarkTile[]
}

export interface WatermarkVerifyInput {
  reportId?: string
  text: string
  config?: WatermarkConfig
  contentHash?: string
  tamperCode?: string
}

export interface WatermarkVerifyResult {
  valid: boolean
  contentHashOk: boolean
  tamperOk: boolean
  computedContentHash: string
  computedTamperCode: string
}

export const WATERMARK_POSITIONS: WatermarkPosition[] = ['center', 'top-left', 'top-right', 'bottom-left', 'bottom-right', 'tile']

export const DEFAULT_TEXT_WATERMARK: TextWatermarkParams = {
  content: 'G005 放射影像诊断报告 · 内部资料',
  position: 'tile',
  rotation: -30,
  opacity: 0.12,
  spacing: 160,
  fontSize: 16,
}

export const DEFAULT_IMAGE_WATERMARK: ImageWatermarkParams = {
  enabled: false,
  logoKey: 'hospital-logo',
  logoName: '示例医院 LOGO (概念数据)',
  scale: 0.25,
  position: 'bottom-right',
  opacity: 0.35,
}
