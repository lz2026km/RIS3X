/**
 * [G005 v3.0.6.11-101 Wave 1B (G-10)] 推理后端抽象: ONNX → WASM → Mock 三级回退
 *
 * 设计:
 *   - onnxruntime-node 未安装/加载失败 → 尝试 onnxruntime-web (WASM) → 仍失败 → 确定性 Mock 后端
 *   - 动态 import + try/catch, 不引入硬依赖, 测试与无网环境可运行
 *   - Mock 后端为确定性 "残差抑制" 算子, 保证结果可复现 (同输入同输出)
 */
import { hashString } from '../common/utils/deterministic-hash'

export type InferenceBackendKind = 'onnx' | 'wasm' | 'mock'

export interface InferenceBackend {
  kind: InferenceBackendKind
  /** 具体运行时名称 (如 onnxruntime-node / onnxruntime-web / deterministic-mock) */
  provider: string
  /**
   * 单张灰度图推理: 输入 [1,1,H,W] float32 归一化到 [0,1], 输出同形状。
   * 无真实模型文件时由 mock 实现完成确定性残差抑制。
   */
  run(input: Float32Array, shape: number[]): Promise<{ output: Float32Array; latencyMs: number }>
  dispose(): void
}

export interface BackendResolution {
  backend: InferenceBackend
  /** 回退原因链 (onnx 加载失败信息等), 用于审计/前端展示 */
  fallbackReason?: string
}

interface OnnxLikeSession {
  inputNames: string[]
  outputNames: string[]
  run(inputs: Record<string, unknown>): Promise<Record<string, unknown>>
  release?(): Promise<void>
}

interface OnnxLikeInferenceSession {
  create(modelPath: string, sessionOptions?: Record<string, unknown>): Promise<OnnxLikeSession>
}

interface OnnxLikeModule {
  InferenceSession: OnnxLikeInferenceSession
}

async function loadOnnxModule(moduleName: string): Promise<OnnxLikeModule | null> {
  try {
    const mod = (await import(moduleName)) as unknown as OnnxLikeModule
    if (mod && typeof mod.InferenceSession === 'object' && 'create' in mod.InferenceSession) return mod
    return null
  } catch {
    return null
  }
}

/**
 * 尝试解析真实推理后端。
 * 仅当存在模型文件 (.onnx) 且运行时可加载时才走 onnx/wasm,
 * 否则回退 mock (保证端点永远可用)。
 */
export async function resolveInferenceBackend(modelPath?: string | null): Promise<BackendResolution> {
  const path = modelPath?.trim()
  let reason: string | undefined

  if (path) {
    const onnxMod = await loadOnnxModule('onnxruntime-node')
    if (onnxMod) {
      try {
        const session = await onnxMod.InferenceSession.create(path, { executionProviders: ['cpu'] })
        if (session && session.inputNames.length > 0) {
          return {
            backend: new OnnxRuntimeBackend(session, 'onnx', 'onnxruntime-node'),
          }
        }
      } catch (error) {
        reason = `onnx runtime load failed: ${error instanceof Error ? error.message : 'unknown'}`
      }
    }

    const wasmMod = await loadOnnxModule('onnxruntime-web')
    if (wasmMod) {
      try {
        const session = await wasmMod.InferenceSession.create(path, { executionProviders: ['wasm'] })
        if (session && session.inputNames.length > 0) {
          return {
            backend: new OnnxRuntimeBackend(session, 'wasm', 'onnxruntime-web'),
            fallbackReason: reason,
          }
        }
      } catch (error) {
        reason = `${reason ?? ''}; wasm load failed: ${error instanceof Error ? error.message : 'unknown'}`
      }
    }
  }

  return { backend: createMockBackend(path ?? 'default'), fallbackReason: reason }
}

class OnnxRuntimeBackend implements InferenceBackend {
  constructor(
    private readonly session: OnnxLikeSession,
    public readonly kind: 'onnx' | 'wasm',
    public readonly provider: string,
  ) {}

  async run(input: Float32Array, shape: number[]): Promise<{ output: Float32Array; latencyMs: number }> {
    const started = Date.now()
    const tensor = { dims: shape, data: input, type: 'float32' }
    const feeds: Record<string, unknown> = {}
    feeds[this.session.inputNames[0]!] = tensor
    const outputs = await this.session.run(feeds)
    const raw = outputs[this.session.outputNames[0]!]
    const out =
      raw && typeof raw === 'object' && 'data' in raw
        ? (raw as { data: ArrayLike<number> }).data
        : input
    return { output: Float32Array.from(out as ArrayLike<number>), latencyMs: Date.now() - started }
  }

  dispose(): void {
    void this.session.release?.()
  }
}

/**
 * 确定性 Mock 推理后端: 无真实模型时的 "DL 模型接口" 兜底。
 * 算子 = 局部平滑 (邻域均值混合) + 残差软抑制: 平滑小幅度噪声, 保留大幅结构边缘。
 */
export function createMockBackend(modelId: string): InferenceBackend {
  const h = hashString(modelId)
  const threshold = 0.02 + ((h % 10) / 10) * 0.03 // 0.02-0.05 确定性残差阈值
  const scale = 0.75 + ((h >> 4) % 5) * 0.05 // 0.75-0.95 确定性保留系数
  const w0 = 0.55 + ((h >> 6) % 3) * 0.05 // 0.55-0.65 中心权重 (平滑强度)
  const provider = `deterministic-mock(${modelId || 'unet'})`

  return {
    kind: 'mock',
    provider,
    async run(input: Float32Array, _shape: number[]): Promise<{ output: Float32Array; latencyMs: number }> {
      const started = Date.now()
      const len = input.length
      const output = new Float32Array(len)
      const w1 = (1 - w0) / 2
      for (let i = 0; i < len; i++) {
        const v = input[i]!
        const left = i > 0 ? input[i - 1]! : v
        const right = i < len - 1 ? input[i + 1]! : v
        const local = w0 * v + w1 * (left + right)
        const residual = v - local
        if (Math.abs(residual) < threshold) output[i] = local + residual * scale
        else output[i] = local + residual
      }
      const latencyMs = 8 + (h % 17)
      return { output, latencyMs }
    },
    dispose(): void {
      // 无资源
    },
  }
}

/** 快捷: 同步返回 mock 后端 (测试/无模型场景) */
export function mockBackend(modelId = 'unet'): InferenceBackend {
  return createMockBackend(modelId)
}
