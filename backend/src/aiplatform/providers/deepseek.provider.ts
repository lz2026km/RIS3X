import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { AiChatRequest, AiProvider, AiProviderInfo } from './provider'

interface DeepSeekChatResponse {
  choices?: Array<{ message?: { content?: string } }>
  error?: { message?: string }
}

@Injectable()
export class DeepSeekProvider implements AiProvider {
  private readonly logger = new Logger(DeepSeekProvider.name)
  private readonly apiKey: string | undefined
  private readonly baseUrl: string
  private readonly model: string

  readonly info: AiProviderInfo

  constructor(configService?: ConfigService) {
    const cfg = configService ?? null
    this.apiKey = (cfg?.get<string>('DEEPSEEK_API_KEY') ?? process.env['DEEPSEEK_API_KEY']) || undefined
    this.baseUrl =
      (cfg?.get<string>('DEEPSEEK_BASE_URL') ?? process.env['DEEPSEEK_BASE_URL']) ||
      'https://api.deepseek.com/v1'
    this.model =
      (cfg?.get<string>('DEEPSEEK_MODEL') ?? process.env['DEEPSEEK_MODEL']) || 'deepseek-chat'
    this.info = {
      id: 'deepseek',
      name: 'DeepSeek',
      available: Boolean(this.apiKey),
    }
  }

  async chat(req: AiChatRequest): Promise<string> {
    if (!this.apiKey) {
      throw new Error('DEEPSEEK_API_KEY is not configured')
    }
    const url = `${this.baseUrl.replace(/\/$/, '')}/chat/completions`
    const body = {
      model: this.model,
      messages: req.messages,
      temperature: req.temperature ?? 0.3,
      max_tokens: req.maxTokens ?? 1024,
      stream: false,
    }
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    })
    if (!resp.ok) {
      const text = await resp.text()
      this.logger.error(`DeepSeek API error ${resp.status}: ${text}`)
      throw new Error(`DeepSeek API ${resp.status}: ${text}`)
    }
    const data = (await resp.json()) as DeepSeekChatResponse
    const content = data.choices?.[0]?.message?.content
    if (!content) {
      throw new Error(data.error?.message ?? 'DeepSeek response has no content')
    }
    return content
  }
}
