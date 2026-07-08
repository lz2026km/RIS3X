import { DeepSeekClient, createDeepSeekFromEnv } from '../../deepseek'
import { buildReportGenerationPrompt, buildQualityCheckPrompt } from '../../deepseekPrompts'
import type {
  AiCompletionRequest,
  AiCompletionResponse,
  AiStreamChunk,
  ReportGenerationInput,
  ReportGenerationOutput,
  ReportReviewInput,
  ReportReviewOutput,
  QualityScoringInput,
  QualityScoringOutput,
} from '../interfaces/types'
import type { IReportGenerationProvider } from '../interfaces/IReportGenerationProvider'
import type { IReportReviewProvider } from '../interfaces/IReportReviewProvider'
import type { IQualityScoringProvider } from '../interfaces/IQualityScoringProvider'

export class DeepSeekProvider implements IReportGenerationProvider, IReportReviewProvider, IQualityScoringProvider {
  readonly name = 'deepseek'
  private client: DeepSeekClient

  constructor(client?: DeepSeekClient) {
    this.client = client ?? createDeepSeekFromEnv()
  }

  async complete(request: AiCompletionRequest): Promise<AiCompletionResponse> {
    try {
      const messages = request.messages.map((m) => ({ role: m.role as 'system' | 'user' | 'assistant', content: m.content }))
      const resp = await this.client.completion({
        messages,
        model: request.model,
        max_tokens: request.maxTokens,
        temperature: request.temperature,
        stream: false,
      })
      return {
        id: resp.id,
        content: resp.choices[0]?.message?.content?.toString() ?? '',
        finishReason: resp.choices[0]?.finish_reason === 'stop' ? 'stop' : 'length',
        usage: resp.usage ? { promptTokens: resp.usage.prompt_tokens, completionTokens: resp.usage.completion_tokens } : undefined,
      }
    } catch {
      return { id: '', content: '', finishReason: 'error', usage: undefined }
    }
  }

  async *completeStream(request: AiCompletionRequest): AsyncGenerator<AiStreamChunk, void, void> {
    try {
      const messages = request.messages.map((m) => ({ role: m.role as 'system' | 'user' | 'assistant', content: m.content }))
      const stream = this.client.stream({
        messages,
        model: request.model,
        max_tokens: request.maxTokens,
        temperature: request.temperature,
        stream: true,
      })
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content ?? ''
        if (content) {
          yield { id: chunk.id, content, finishReason: chunk.choices[0]?.finish_reason as 'stop' | 'length' | null }
        }
      }
    } catch {
      yield { id: '', content: '', finishReason: 'error' }
    }
  }

  async generateReport(input: ReportGenerationInput): Promise<ReportGenerationOutput> {
    try {
      const ctx = {
        modality: input.modality as any,
        bodyPart: input.bodyPart,
        clinicalHistory: input.context?.clinicalHistory,
        patientAge: input.context?.patientAge,
        patientSex: input.context?.patientSex as any,
        priorStudies: input.context?.priorStudies,
        technique: input.context?.technique,
        comparisonFindings: input.context?.comparisonFindings,
        indication: input.findings,
      }
      const messages = buildReportGenerationPrompt(ctx)
      const reqMessages = messages.map((m) => ({ role: m.role, content: typeof m.content === 'string' ? m.content : '' }))
      const resp = await this.complete({ messages: reqMessages })
      const sections = resp.content.split(/## /).filter(Boolean).map((s) => {
        const idx = s.indexOf('\n')
        return { heading: idx > 0 ? s.slice(0, idx).trim() : '', content: idx > 0 ? s.slice(idx + 1).trim() : s.trim() }
      })
      return {
        reportText: resp.content,
        sections,
        confidence: 0.9,
      }
    } catch {
      return { reportText: '', sections: [], confidence: 0 }
    }
  }

  async *generateReportStream(input: ReportGenerationInput): AsyncGenerator<AiStreamChunk, ReportGenerationOutput, void> {
    try {
      const ctx = {
        modality: input.modality as any,
        bodyPart: input.bodyPart,
        clinicalHistory: input.context?.clinicalHistory,
        patientAge: input.context?.patientAge,
        patientSex: input.context?.patientSex as any,
      }
      const messages = buildReportGenerationPrompt(ctx)
      const reqMessages = messages.map((m) => ({ role: m.role, content: typeof m.content === 'string' ? m.content : '' }))
      let fullText = ''
      for await (const chunk of this.completeStream({ messages: reqMessages, stream: true })) {
        fullText += chunk.content
        yield chunk
      }
      const sections = fullText.split(/## /).filter(Boolean).map((s) => {
        const idx = s.indexOf('\n')
        return { heading: idx > 0 ? s.slice(0, idx).trim() : '', content: idx > 0 ? s.slice(idx + 1).trim() : s.trim() }
      })
      return {
        reportText: fullText,
        sections,
        confidence: 0.9,
      }
    } catch {
      yield { id: '', content: '', finishReason: 'error' }
      return { reportText: '', sections: [], confidence: 0 }
    }
  }

  async reviewReport(input: ReportReviewInput): Promise<ReportReviewOutput> {
    try {
      const prompt = `请审查以下放射报告的质量，找出问题并按严重程度分类。
 所见: ${input.findings}
 结论: ${input.conclusion}
 报告全文: ${input.reportText}

 请输出 JSON: { "issues": [{ "id": string, "severity": "error"|"warning"|"info", "category": "omission"|"conflict"|"format"|"terminology"|"completeness", "field": string, "message": string, "suggestion"?: string }], "summary": string, "overallScore": number }`
      const resp = await this.complete({ messages: [{ role: 'user', content: prompt }], temperature: 0.2 })
      try {
        const parsed = JSON.parse(resp.content) as ReportReviewOutput
        return parsed
      } catch {
        return { issues: [], summary: '解析 AI 响应失败', overallScore: 0 }
      }
    } catch (err) {
      return { issues: [], summary: 'DeepSeek 审查服务调用失败', overallScore: 0 }
    }
  }

  async scoreReport(input: QualityScoringInput): Promise<QualityScoringOutput> {
    try {
      const ctx = {
        modality: 'CT' as const,
        bodyPart: 'general',
        clinicalHistory: undefined,
        patientAge: undefined,
        patientSex: undefined,
      }
      const messages = buildQualityCheckPrompt(input.reportText || `${input.findings}\n${input.conclusion}`, ctx)
      const reqMessages = messages.map((m) => ({ role: m.role, content: typeof m.content === 'string' ? m.content : '' }))
      const resp = await this.complete({ messages: reqMessages, temperature: 0.2 })
      try {
        const parsed = JSON.parse(resp.content) as QualityScoringOutput
        return {
          ...parsed,
          evaluatedAt: new Date().toISOString(),
        }
      } catch {
        return {
          totalScore: 0,
          grade: 'F',
          dimensions: [],
          suggestions: ['AI 评分解析失败'],
          evaluatedAt: new Date().toISOString(),
        }
      }
    } catch (err) {
      return {
        totalScore: 0,
        grade: 'F',
        dimensions: [],
        suggestions: ['DeepSeek 评分服务调用失败'],
        evaluatedAt: new Date().toISOString(),
      }
    }
  }
}
