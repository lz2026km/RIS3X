import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../prisma/prisma.service'
import type { AiChatRequest, AiProvider, AiProviderInfo } from './provider'

@Injectable()
export class TemplateProvider implements AiProvider {
  readonly info: AiProviderInfo = { id: 'template', name: 'ReportTemplate', available: true }

  constructor(private readonly prisma: PrismaService) {}

  async chat(req: AiChatRequest): Promise<string> {
    const user = req.messages.find((m) => m.role === 'user')?.content ?? ''
    const ctx = this.extractContext(user)
    const templates = await this.prisma.reportTemplate.findMany({
      where: ctx.bodyPart || ctx.modality
        ? {
            OR: [
              ctx.bodyPart ? { bodyPart: { contains: ctx.bodyPart } } : undefined,
              ctx.modality ? { category: { contains: ctx.modality } } : undefined,
            ].filter(Boolean) as any,
          }
        : undefined,
      orderBy: { updatedAt: 'desc' },
      take: 1,
    })
    if (templates.length > 0) {
      const tpl = templates[0]
      const filled = tpl.body
        .replace(/{{\s*bodyPart\s*}}/g, ctx.bodyPart ?? tpl.bodyPart)
        .replace(/{{\s*modality\s*}}/g, ctx.modality ?? 'CT')
        .replace(/{{\s*findings\s*}}/g, ctx.findings ?? '无明显异常')
        .replace(/{{\s*clinicalHistory\s*}}/g, ctx.clinicalHistory ?? '不详')
      return filled
    }
    return [
      `检查技术：${ctx.modality ?? 'CT'} 平扫+增强扫描`,
      `影像所见：${ctx.findings ?? `${ctx.bodyPart ?? '检查部位'} 未见明确异常`}`,
      `影像诊断：${ctx.impression ?? '未见明确异常，建议随访'}`,
      '建议：定期随访，必要时进一步检查。',
    ].join('\n')
  }

  private extractContext(text: string): { modality?: string; bodyPart?: string; findings?: string; impression?: string; clinicalHistory?: string } {
    const ctx: Record<string, string> = {}
    const lines = text.split(/\n|;/).map((l) => l.trim()).filter(Boolean)
    for (const line of lines) {
      const m = line.match(/^([^:=：]+)[:：=]\s*(.*)$/)
      if (m) ctx[m[1].trim()] = m[2].trim()
    }
    return {
      modality: ctx['modality'] ?? ctx['检查类型'],
      bodyPart: ctx['bodyPart'] ?? ctx['检查部位'],
      findings: ctx['findings'] ?? ctx['所见'],
      impression: ctx['impression'] ?? ctx['诊断'],
      clinicalHistory: ctx['clinicalHistory'] ?? ctx['病史'],
    }
  }
}
