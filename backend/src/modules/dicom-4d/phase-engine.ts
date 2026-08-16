/**
 * [G005 v3.0.6.11-101 Wave 1B (G-07)] 4D 真实帧源 — 相位派生纯函数引擎
 *
 * 职责 (全部确定性, 无 IO / 无依赖, 便于 jest 单测):
 *   - cardiac 时相 0..19 (20 相), respiratory 时相 0..9 (10 相)
 *   - 按实例索引派生每帧相位 (相位沿周期等距分配, 支持周期偏移)
 *   - 相位分布统计 (20/10 个 bin, 含空 bin)
 *   - 电影渲染数据: 帧间插值参数 (帧率/每相帧数/插值帧数) + 心电 RR 间期曲线
 *   - 确定性 PRNG (mulberry32) 生成 RR 间期抖动 (模拟生理变异)
 */
import { hashString } from '../../common/utils/deterministic-hash'

export const CARDIAC_PHASE_COUNT = 20
export const RESPIRATORY_PHASE_COUNT = 10

export type GatingType = 'cardiac' | 'respiratory' | 'both'

export interface PhaseFrame {
  frameIndex: number
  cardiacPhase?: number
  respiratoryPhase?: number
}

export interface PhaseBin {
  phase: number
  count: number
}

export interface PhaseDistribution {
  gatingType: GatingType
  cardiac: PhaseBin[]
  respiratory: PhaseBin[]
  totalFrames: number
}

export interface EcgPoint {
  /** 相对周期起点的时间 (ms) */
  t: number
  /** RR 间期 (ms) */
  rr: number
}

export interface MovieRenderData {
  gatingType: GatingType
  frameRate: number
  cycleMs: number
  framesPerPhase: number
  /** 插值帧总数 (补齐非整数帧) */
  interpolatedFrames: number
  /** 插值模式: phase-bin = 按相位 bin 最近邻; linear = 帧间线性插值 */
  interpolationMode: 'phase-bin' | 'linear'
  bpm: number
  rrIntervals: number[]
  ecgWaveform: EcgPoint[]
  /** 每帧相位序列 (与帧流对齐) */
  phaseSequence: number[]
}

/** 确定性 gating 类型 (与既有 toSeries 同构: hash 分流) */
export function deriveGatingType(input: string): GatingType {
  const h = hashString(input)
  if (h % 5 === 0) return 'both'
  return h % 2 === 0 ? 'cardiac' : 'respiratory'
}

/**
 * 派生 cardiac 相位 (0..CARDIAC_PHASE_COUNT-1):
 * 实例索引按周期等距映射到 20 个时相 bin。
 */
export function deriveCardiacPhase(instanceIndex: number, total: number, cycleOffset = 0): number {
  const t = total > 0 ? instanceIndex / total : 0
  return (Math.floor(t * CARDIAC_PHASE_COUNT) + cycleOffset) % CARDIAC_PHASE_COUNT
}

/** 派生 respiratory 相位 (0..RESPIRATORY_PHASE_COUNT-1) */
export function deriveRespiratoryPhase(instanceIndex: number, total: number, cycleOffset = 0): number {
  const t = total > 0 ? instanceIndex / total : 0
  return (Math.floor(t * RESPIRATORY_PHASE_COUNT) + cycleOffset) % RESPIRATORY_PHASE_COUNT
}

/** 为 frameCount 个帧生成完整相位序列 (cards: 20 相 / resp: 10 相) */
export function phaseSequence(count: number, gating: GatingType): Array<{ cardiacPhase: number; respiratoryPhase: number }> {
  const seq: Array<{ cardiacPhase: number; respiratoryPhase: number }> = []
  for (let i = 0; i < count; i++) {
    seq.push({
      cardiacPhase: deriveCardiacPhase(i, count),
      respiratoryPhase: deriveRespiratoryPhase(i, count),
    })
  }
  return seq
}

/** 统计相位分布: 输出完整 20/10 个 bin (含 0 计数 bin), 确定性排序 */
export function buildPhaseDistribution(frames: PhaseFrame[], gating: GatingType): PhaseDistribution {
  const cardiac = Array.from({ length: CARDIAC_PHASE_COUNT }, (_, phase) => ({ phase, count: 0 }))
  const respiratory = Array.from({ length: RESPIRATORY_PHASE_COUNT }, (_, phase) => ({ phase, count: 0 }))
  for (const f of frames) {
    if (f.cardiacPhase !== undefined && f.cardiacPhase >= 0 && f.cardiacPhase < CARDIAC_PHASE_COUNT) {
      cardiac[f.cardiacPhase]!.count += 1
    }
    if (f.respiratoryPhase !== undefined && f.respiratoryPhase >= 0 && f.respiratoryPhase < RESPIRATORY_PHASE_COUNT) {
      respiratory[f.respiratoryPhase]!.count += 1
    }
  }
  return { gatingType: gating, cardiac, respiratory, totalFrames: frames.length }
}

/** 心电周期 (ms): CT 600-900 / MR 700-1000, 由系列确定性派生 */
export function deriveCardiacCycleMs(input: string, modality: string): number {
  const h = hashString(input)
  if (modality === 'MR') return 700 + (h % 300)
  return 600 + (h % 250)
}

/** 呼吸周期 (ms): 3-6s 确定性派生 */
export function deriveRespiratoryCycleMs(input: string): number {
  return 3000 + (hashString(`resp:${input}`) % 3000)
}

/** mulberry32 确定性 PRNG (与 denoise-processor 同构) */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * 生成 RR 间期序列 (ms): 基础心率 ± 确定性生理变异 (心率变异性 HRV),
 * 保证相邻间期连续 (随机游走), 均值回填到目标 bpm。
 */
export function rrIntervals(seed: string, cycleMs: number, beats: number): { rr: number[]; bpm: number } {
  const rand = mulberry32(hashString(`rr:${seed}`))
  const targetRr = cycleMs
  const hrv = Math.round(cycleMs * 0.06)
  const raw: number[] = []
  let acc = targetRr
  for (let i = 0; i < beats; i++) {
    acc = Math.max(targetRr - hrv, Math.min(targetRr + hrv, acc + (rand() - 0.5) * 2 * hrv))
    raw.push(Math.round(acc))
  }
  const mean = raw.reduce((s, v) => s + v, 0) / Math.max(1, raw.length)
  const scale = targetRr / mean
  const rr = raw.map((v) => Math.round(v * scale))
  const avgRr = rr.reduce((s, v) => s + v, 0) / Math.max(1, rr.length)
  return { rr, bpm: Math.round(60000 / avgRr) }
}

/** 心电 RR 间期曲线: 每 beat 一个采样点 (相对周期起点的累积时间) */
export function ecgCurve(rr: number[], cycleMs: number): EcgPoint[] {
  let acc = 0
  return rr.map((interval, i) => {
    const t = Math.round(acc * 100) / 100
    acc += interval
    const normalized = Math.min(1, (i + 1) / Math.max(1, rr.length))
    const rrNormalized = interval / cycleMs
    return { t, rr: Math.round(rrNormalized * cycleMs) }
  })
}

/** 电影渲染插值参数: 每相帧数 = ceil(帧数/相数), 插值帧 = 每相帧数 × 相数 - 帧数 */
export function interpolationParams(
  frameCount: number,
  frameRate: number,
  gating: GatingType,
): { framesPerPhase: number; interpolatedFrames: number; interpolationMode: 'phase-bin' | 'linear'; cycleMs: number } {
  const phaseCount = gating === 'cardiac' || gating === 'both' ? CARDIAC_PHASE_COUNT : RESPIRATORY_PHASE_COUNT
  const framesPerPhase = Math.max(1, Math.ceil(frameCount / phaseCount))
  const interpolatedFrames = Math.max(0, framesPerPhase * phaseCount - frameCount)
  return {
    framesPerPhase,
    interpolatedFrames,
    interpolationMode: interpolatedFrames > 0 ? 'linear' : 'phase-bin',
    cycleMs: 1000 / Math.max(1, frameRate),
  }
}

/** 组装完整电影渲染数据 (确定性) */
export function buildMovieRenderData(input: {
  seriesUid: string
  modality: string
  gatingType: GatingType
  frameCount: number
  frameRate: number
}): MovieRenderData {
  const { seriesUid, modality, gatingType, frameCount, frameRate } = input
  const cycleMs = deriveCardiacCycleMs(seriesUid, modality)
  const { framesPerPhase, interpolatedFrames, interpolationMode, cycleMs: frameIntervalMs } =
    interpolationParams(frameCount, frameRate, gatingType)
  const beats = Math.max(8, Math.min(64, frameCount))
  const { rr, bpm } = rrIntervals(seriesUid, cycleMs, beats)
  const seq = phaseSequence(frameCount, gatingType).map((p) => p.cardiacPhase)
  return {
    gatingType,
    frameRate,
    cycleMs: cycleMs || frameIntervalMs,
    framesPerPhase,
    interpolatedFrames,
    interpolationMode,
    bpm,
    rrIntervals: rr,
    ecgWaveform: ecgCurve(rr, cycleMs),
    phaseSequence: seq,
  }
}

/** 确定性 fps: 8-15 (与既有 toSeries 一致) */
export function deriveFrameRate(input: string): number {
  return 8 + (hashString(input) % 8)
}
