/**
 * G005 RIS v3.0.6.11-100 Wave 3A (G-19) — 多模型适配层 (mock / deepseek / hunyuan)
 * - mock:    确定性模板生成 (复用 aiplatform/report-templates NLG 逻辑, 无随机)
 * - deepseek: 接口占位 (有 DEEPSEEK_API_KEY 时走 OpenAI 兼容 chat/completions,
 *             无 key / 请求失败 / 超时 → 回退 mock)
 * - hunyuan:  接口占位 (有 HUNYUAN_API_KEY 时调用, 否则回退 mock)
 */
import { Injectable } from '@nestjs/common'
import { buildReportDraft, serializeDraft, type ReportStyle } from '../../aiplatform/report-templates'

export type LlmProviderId = 'mock' | 'deepseek' | 'hunyuan'

export interface LlmProviderInfo {
  id: LlmProviderId
  name: string
  model: string
  kind: 'template' | 'llm'
  available: boolean
  apiKeyConfigured: boolean
  description: string
}

export interface AiChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LlmCompletionRequest {
  provider: LlmProviderId
  messages?: AiChatMessage[]
  system?: string
  user: string
  temperature?: number
  maxTokens?: number
}

export interface LlmCompletionResult {
  provider: LlmProviderId
  model: string
  text: string
  fallbackToMock: boolean
}

const PROVIDER_META: Record<LlmProviderId, { name: string; model: string; description: string }> = {
  mock: {
    name: '确定性模板引擎',
    model: 'mock-nlg-1.0',
    description: '本地模板 NLG: 确定性生成, 无网络依赖, 可用于演示/离线回退',
  },
  deepseek: {
    name: 'DeepSeek',
    model: 'deepseek-chat',
    description: 'DeepSeek-V3 通用大模型 (OpenAI 兼容接口, 需 DEEPSEEK_API_KEY)',
  },
  hunyuan: {
    name: '腾讯混元',
    model: 'hunyuan-turbo',
    description: '腾讯混元大模型 (需 HUNYUAN_API_KEY)',
  },
}

function envKey(id: LlmProviderId): string {
  return id === 'deepseek' ? 'DEEPSEEK_API_KEY' : 'HUNYUAN_API_KEY'
}

function baseUrlOf(id: LlmProviderId): string {
  if (id === 'deepseek') return process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com'
  return process.env.HUNYUAN_BASE_URL ?? 'https://api.hunyuan.cloud.tencent.com'
}

/** 从 user prompt 解析 mock 生成所需的结构化信息 (模板 NLG 复用现有逻辑) */
function parsePrompt(user: string): {
  modality: string
  bodyPart: string
  clinicalInfo: string
  findings: string
  style: ReportStyle
  ragSummary: string
} {
  const grab = (key: string) => {
    const m = user.match(new RegExp(`【${key}:(.+?)】`))
    return m ? m[1].trim() : ''
  }
  const rag = user.match(/【rag-summary】([\s\S]*?)【\/rag-summary】/)
  return {
    modality: grab('modality') || 'CT',
    bodyPart: grab('bodyPart') || '胸部',
    clinicalInfo: grab('clinicalInfo'),
    findings: grab('findings'),
    style: (grab('style') as ReportStyle) || 'standard',
    ragSummary: rag ? rag[1].trim() : '',
  }
}

/** mock 生成: 确定性模板 NLG (与既有 generateReportDraft 同源逻辑) */
function generateMockText(user: string): string {
  const p = parsePrompt(user)
  const built = buildReportDraft({
    modality: p.modality,
    bodyPart: p.bodyPart,
    clinicalInfo: p.clinicalInfo,
    findings: p.findings,
    style: p.style,
  })
  if (p.ragSummary) {
    built.sections.push({ heading: '与既往对比', content: p.ragSummary })
  }
  return serializeDraft(built.sections)
}

/** 远程 LLM 占位调用: OpenAI 兼容 chat/completions, 失败/超时抛错由上层回退 mock */
async function callRemoteChat(
  id: LlmProviderId,
  messages: AiChatMessage[],
  temperature: number,
): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)
  try {
    const res = await fetch(`${baseUrlOf(id)}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env[envKey(id)] ?? ''}`,
      },
      body: JSON.stringify({
        model: PROVIDER_META[id].model,
        messages,
        temperature,
        stream: false,
      }),
      signal: controller.signal,
    })
    if (!res.ok) throw new Error(`LLM ${id} HTTP ${res.status}`)
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] }
    const content = json?.choices?.[0]?.message?.content ?? ''
    if (!content.trim()) throw new Error(`LLM ${id} 空响应`)
    return content
  } finally {
    clearTimeout(timer)
  }
}

@Injectable()
export class LlmProviderService {
  /** GET /ai-draft/providers — 可用模型列表 (无 key 的接口模型标注 available=false) */
  listProviders(): LlmProviderInfo[] {
    return (Object.keys(PROVIDER_META) as LlmProviderId[]).map((id) => {
      const apiKeyConfigured = id !== 'mock' && Boolean(process.env[envKey(id)]?.trim())
      return {
        id,
        name: PROVIDER_META[id].name,
        model: PROVIDER_META[id].model,
        kind: id === 'mock' ? 'template' : 'llm',
        available: id === 'mock' || apiKeyConfigured,
        apiKeyConfigured,
        description: PROVIDER_META[id].description,
      }
    })
  }

  /** 统一补全入口: deepseek/hunyuan 无 key 或调用失败 → 回退 mock */
  async complete(req: LlmCompletionRequest): Promise<LlmCompletionResult> {
    const provider = req.provider
    const messages: AiChatMessage[] = [
      ...(req.system ? [{ role: 'system' as const, content: req.system }] : []),
      ...(req.messages ?? []),
      { role: 'user', content: req.user },
    ]
    const temperature = req.temperature ?? 0.3

    if (provider === 'mock' || !process.env[envKey(provider)]?.trim()) {
      return {
        provider,
        model: provider === 'mock' ? PROVIDER_META.mock.model : PROVIDER_META[provider].model,
        text: generateMockText(req.user),
        fallbackToMock: provider !== 'mock',
      }
    }

    try {
      const text = await callRemoteChat(provider, messages, temperature)
      return { provider, model: PROVIDER_META[provider].model, text, fallbackToMock: false }
    } catch {
      return {
        provider,
        model: PROVIDER_META[provider].model,
        text: generateMockText(req.user),
        fallbackToMock: true,
      }
    }
  }

  /** 校验 provider 是否可用 (不可用 → 调用方回退 mock) */
  isAvailable(provider: LlmProviderId): boolean {
    return provider === 'mock' || Boolean(process.env[envKey(provider)]?.trim())
  }
}

/** 供单元测试/服务构造默认值使用 (无 Nest DI 时) */
export const defaultLlmProviderService = new LlmProviderService()
