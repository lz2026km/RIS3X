/**
 * [G005 W12-PatientService] 满意度分析服务 (orphan module, DB-less-safe)
 *
 * 覆盖:
 *   - POST /satisfaction/surveys                创建问卷
 *   - GET  /satisfaction/surveys                问卷列表
 *   - GET  /satisfaction/surveys/:id            问卷详情
 *   - POST /satisfaction/surveys/:id/respond    提交答卷
 *   - GET  /satisfaction/responses              答卷列表
 *   - GET  /satisfaction/analytics              分析: NPS / 科室 / 模态 / 趋势 / 评语情感标签
 *
 * 分析维度: NPS (净推荐值) / 科室 / 检查模态 / 时间趋势 / 评语情感 (积极/中性/消极 + 标签)
 * 确定性: 种子数据固定, 情感判定基于关键词, 无随机。
 */
import { BadRequestException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

export type SurveyType = 'APPOINTMENT' | 'EXAM' | 'REPORT' | 'GENERAL'
export type SurveyStatus = 'OPEN' | 'CLOSED'
export type QuestionType = 'rating' | 'nps' | 'text'
export type Sentiment = 'positive' | 'neutral' | 'negative'

export interface SurveyQuestionDto {
  id: string
  text: string
  type: QuestionType
  max?: number
}

export interface SurveyDto {
  id: string
  title: string
  type: SurveyType
  department: string
  modality?: string
  questions: SurveyQuestionDto[]
  status: SurveyStatus
  createdAt: string
  updatedAt: string
}

export interface SurveyAnswerDto {
  questionId: string
  value: string | number
}

export interface SurveyResponseDto {
  id: string
  surveyId: string
  patientId?: string
  patientName?: string
  department: string
  modality?: string
  answers: SurveyAnswerDto[]
  rating: number
  npsScore: number
  comment: string
  sentiment: Sentiment
  tags: string[]
  submittedAt: string
}

const POSITIVE_WORDS = ['满意', '很好', '专业', '耐心', '周到', '高效', '清晰', '准时', '热情', '感谢', '不错', '快捷', '细致']
const NEGATIVE_WORDS = ['不满意', '差', '慢', '等待', '拥挤', '冷漠', '态度', '敷衍', '嘈杂', '脏', '乱', '错误', '延误', '收费高', '投诉']

const DEFAULT_QUESTIONS: SurveyQuestionDto[] = [
  { id: 'q1', text: '您对本次就诊服务整体满意吗?', type: 'rating', max: 5 },
  { id: 'q2', text: '您有多大可能向亲友推荐本院影像检查服务?', type: 'nps', max: 10 },
  { id: 'q3', text: '您的其他意见或建议', type: 'text' },
]

const DEPARTMENTS = ['放射科', 'CT室', 'MR室', '超声科']
const MODALITIES = ['CT', 'MR', 'DR', 'US', 'MG']

function hashNum(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

const SEED_COMMENTS: string[] = [
  '护士很耐心, 检查流程清晰, 非常满意。',
  '预约很方便, 报告出具很快, 感谢医生。',
  '候诊时间有点长, 希望改善叫号秩序。',
  '技师态度冷漠, 沟通不够细致。',
  '整体不错, 环境整洁安静。',
  '检查过程专业, 解释清楚, 值得推荐。',
  '等待太久, 体验一般。',
  '服务热情周到, 效率很高。',
  '报告结论清晰, 满意度高。',
  '收费偏高, 但服务尚可。',
  '预约提醒很及时, 减少了等待。',
  '设备先进, 成像清晰, 满意。',
]

const SEED_SCORES = [10, 9, 8, 7, 6, 10, 9, 5, 8, 9, 10, 7, 3, 9, 8, 10, 6, 9, 7, 8, 10, 4, 9, 8]

@Injectable()
export class SatisfactionService {
  private readonly logger = new Logger(SatisfactionService.name)
  private readonly surveys = new Map<string, SurveyDto>()
  private readonly responses = new Map<string, SurveyResponseDto>()
  private surveySeq = 0
  private responseSeq = 0

  constructor(@Optional() private readonly prisma?: PrismaService) {
    if (!prisma) this.logger.log('SatisfactionService: no Prisma injected (orphan mode, memory overlay + deterministic seed)')
    this.seed()
  }

  private seed(): void {
    const now = Date.now()
    for (const dept of DEPARTMENTS) {
      const tpl: SurveyDto = {
        id: `SV-${String(++this.surveySeq).padStart(4, '0')}`,
        title: `${dept}影像服务满意度调查`,
        type: 'EXAM',
        department: dept,
        questions: DEFAULT_QUESTIONS.map((q) => ({ ...q })),
        status: 'OPEN',
        createdAt: new Date(now - 180 * 86400_000).toISOString(),
        updatedAt: new Date(now - 180 * 86400_000).toISOString(),
      }
      this.surveys.set(tpl.id, tpl)
    }
    const surveyList = [...this.surveys.values()]
    for (let i = 0; i < SEED_COMMENTS.length; i++) {
      const survey = surveyList[i % surveyList.length]!
      const score = SEED_SCORES[i % SEED_SCORES.length]!
      const rating = Math.max(1, Math.min(5, Math.round(score / 2)))
      const comment = SEED_COMMENTS[i]!
      const daysAgo = i * 5
      const response: SurveyResponseDto = {
        id: `SR-${String(++this.responseSeq).padStart(5, '0')}`,
        surveyId: survey.id,
        patientId: `P10${String(1 + (i % 4)).padStart(4, '0')}`,
        patientName: ['张伟', '李娜', '王芳', '陈杰'][i % 4]!,
        department: survey.department,
        modality: MODALITIES[i % MODALITIES.length],
        answers: [
          { questionId: 'q1', value: rating },
          { questionId: 'q2', value: score },
          { questionId: 'q3', value: comment },
        ],
        rating,
        npsScore: score,
        comment,
        sentiment: this.classifySentiment(comment),
        tags: this.extractTags(comment),
        submittedAt: new Date(now - daysAgo * 86400_000).toISOString(),
      }
      this.responses.set(response.id, response)
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 情感
  // ──────────────────────────────────────────────────────────────────────────

  classifySentiment(comment: string): Sentiment {
    if (!comment) return 'neutral'
    const pos = POSITIVE_WORDS.filter((w) => comment.includes(w)).length
    const neg = NEGATIVE_WORDS.filter((w) => comment.includes(w)).length
    if (pos > neg) return 'positive'
    if (neg > pos) return 'negative'
    return 'neutral'
  }

  extractTags(comment: string): string[] {
    const tags: string[] = []
    if (/等待|候诊|排队|叫号/.test(comment)) tags.push('等待时间')
    if (/态度|沟通|耐心|热情|冷漠|细致/.test(comment)) tags.push('服务态度')
    if (/报告|结论|出具/.test(comment)) tags.push('报告质量')
    if (/预约|提醒/.test(comment)) tags.push('预约流程')
    if (/环境|整洁|安静|嘈杂/.test(comment)) tags.push('就诊环境')
    if (/收费|价格|费用/.test(comment)) tags.push('收费')
    if (/专业|技师|医生|成像|设备/.test(comment)) tags.push('专业水平')
    return tags
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 问卷
  // ──────────────────────────────────────────────────────────────────────────

  /** POST /satisfaction/surveys */
  createSurvey(body: {
    title: string
    type?: SurveyType
    department?: string
    modality?: string
    questions?: SurveyQuestionDto[]
    status?: SurveyStatus
  }): SurveyDto {
    if (!body.title?.trim()) throw new BadRequestException('问卷标题不能为空')
    const now = new Date().toISOString()
    const questions = body.questions && body.questions.length > 0 ? body.questions : DEFAULT_QUESTIONS.map((q) => ({ ...q }))
    for (const q of questions) {
      if (!q.id?.trim() || !q.text?.trim()) throw new BadRequestException('问卷题目 id 与 text 必填')
    }
    const survey: SurveyDto = {
      id: `SV-${String(++this.surveySeq).padStart(4, '0')}`,
      title: body.title,
      type: body.type ?? 'GENERAL',
      department: body.department ?? '放射科',
      modality: body.modality,
      questions: questions.map((q) => ({ ...q })),
      status: body.status ?? 'OPEN',
      createdAt: now,
      updatedAt: now,
    }
    this.surveys.set(survey.id, survey)
    return survey
  }

  /** GET /satisfaction/surveys */
  listSurveys(filter?: { department?: string; status?: SurveyStatus; type?: SurveyType }): { items: SurveyDto[]; total: number } {
    let items = [...this.surveys.values()]
    if (filter?.department) items = items.filter((s) => s.department === filter.department)
    if (filter?.status) items = items.filter((s) => s.status === filter.status)
    if (filter?.type) items = items.filter((s) => s.type === filter.type)
    return { items, total: items.length }
  }

  getSurvey(id: string): SurveyDto {
    const survey = this.surveys.get(id)
    if (!survey) throw new NotFoundException(`满意度问卷 ${id} 不存在`)
    return survey
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 答卷
  // ──────────────────────────────────────────────────────────────────────────

  /** GET /satisfaction/responses */
  listResponses(filter?: { surveyId?: string; department?: string; sentiment?: Sentiment }): { items: SurveyResponseDto[]; total: number } {
    let items = [...this.responses.values()]
    if (filter?.surveyId) items = items.filter((r) => r.surveyId === filter.surveyId)
    if (filter?.department) items = items.filter((r) => r.department === filter.department)
    if (filter?.sentiment) items = items.filter((r) => r.sentiment === filter.sentiment)
    items.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
    return { items, total: items.length }
  }

  /** POST /satisfaction/surveys/:id/respond */
  respond(surveyId: string, body: {
    patientId?: string
    patientName?: string
    answers?: SurveyAnswerDto[]
    rating?: number
    npsScore?: number
    comment?: string
  }): SurveyResponseDto {
    const survey = this.getSurvey(surveyId)
    if (survey.status === 'CLOSED') throw new BadRequestException('问卷已关闭')
    const answers = Array.isArray(body.answers) ? body.answers : []
    const ratingAnswer = answers.find((a) => a.questionId === 'q1')
    const npsAnswer = answers.find((a) => a.questionId === 'q2')
    const commentAnswer = answers.find((a) => a.questionId === 'q3')
    const rating = Number(body.rating ?? ratingAnswer?.value ?? 0)
    const npsScore = Number(body.npsScore ?? npsAnswer?.value ?? 0)
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) throw new BadRequestException('整体评分 rating 必须为 1-5')
    if (!Number.isFinite(npsScore) || npsScore < 0 || npsScore > 10) throw new BadRequestException('NPS 评分必须为 0-10')
    const comment = String(body.comment ?? commentAnswer?.value ?? '')
    const response: SurveyResponseDto = {
      id: `SR-${String(++this.responseSeq).padStart(5, '0')}`,
      surveyId,
      patientId: body.patientId,
      patientName: body.patientName,
      department: survey.department,
      modality: survey.modality,
      answers: answers.length > 0 ? answers : [
        { questionId: 'q1', value: rating },
        { questionId: 'q2', value: npsScore },
        { questionId: 'q3', value: comment },
      ],
      rating,
      npsScore,
      comment,
      sentiment: this.classifySentiment(comment),
      tags: this.extractTags(comment),
      submittedAt: new Date().toISOString(),
    }
    this.responses.set(response.id, response)
    return response
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 分析
  // ──────────────────────────────────────────────────────────────────────────

  private npsOf(scores: number[]): { nps: number; promoters: number; passives: number; detractors: number } {
    const promoters = scores.filter((s) => s >= 9).length
    const detractors = scores.filter((s) => s <= 6).length
    const passives = scores.length - promoters - detractors
    const nps = scores.length > 0 ? Math.round(((promoters - detractors) / scores.length) * 100) : 0
    return { nps, promoters, passives, detractors }
  }

  private avg(nums: number[]): number {
    if (nums.length === 0) return 0
    return Number((nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2))
  }

  /** GET /satisfaction/analytics */
  analytics(filter?: { department?: string; modality?: string }): {
    overall: {
      totalResponses: number
      avgRating: number
      avgNpsScore: number
      nps: number
      promoters: number
      passives: number
      detractors: number
      sentiment: Record<Sentiment, number>
      responseRate: number
    }
    byDepartment: Array<{ department: string; responses: number; avgRating: number; nps: number }>
    byModality: Array<{ modality: string; responses: number; avgRating: number; nps: number }>
    trend: Array<{ period: string; responses: number; avgRating: number; nps: number }>
    comments: Array<{ responseId: string; department: string; modality?: string; comment: string; sentiment: Sentiment; tags: string[]; submittedAt: string }>
  } {
    let items = [...this.responses.values()]
    if (filter?.department) items = items.filter((r) => r.department === filter.department)
    if (filter?.modality) items = items.filter((r) => r.modality === filter.modality)
    const all = items
    const scores = all.map((r) => r.npsScore)
    const ratings = all.map((r) => r.rating)
    const npsInfo = this.npsOf(scores)
    const sentiment: Record<Sentiment, number> = { positive: 0, neutral: 0, negative: 0 }
    for (const r of all) sentiment[r.sentiment] += 1

    const group = (keyFn: (r: SurveyResponseDto) => string) => {
      const map = new Map<string, SurveyResponseDto[]>()
      for (const r of all) {
        const k = keyFn(r)
        if (!map.has(k)) map.set(k, [])
        map.get(k)!.push(r)
      }
      return map
    }

    const byDepartment = [...group((r) => r.department).entries()].map(([department, list]) => ({
      department,
      responses: list.length,
      avgRating: this.avg(list.map((r) => r.rating)),
      nps: this.npsOf(list.map((r) => r.npsScore)).nps,
    })).sort((a, b) => b.nps - a.nps)

    const byModality = [...group((r) => r.modality ?? '未知').entries()].map(([modality, list]) => ({
      modality,
      responses: list.length,
      avgRating: this.avg(list.map((r) => r.rating)),
      nps: this.npsOf(list.map((r) => r.npsScore)).nps,
    })).sort((a, b) => b.responses - a.responses)

    const trend = [...group((r) => r.submittedAt.slice(0, 7)).entries()]
      .map(([period, list]) => ({
        period,
        responses: list.length,
        avgRating: this.avg(list.map((r) => r.rating)),
        nps: this.npsOf(list.map((r) => r.npsScore)).nps,
      }))
      .sort((a, b) => a.period.localeCompare(b.period))

    const comments = all
      .filter((r) => r.comment.trim().length > 0)
      .map((r) => ({ responseId: r.id, department: r.department, modality: r.modality, comment: r.comment, sentiment: r.sentiment, tags: r.tags, submittedAt: r.submittedAt }))

    const openSurveys = [...this.surveys.values()].filter((s) => s.status === 'OPEN').length
    const responseRate = openSurveys > 0 ? Number(((all.length / (openSurveys * 10)) * 100).toFixed(2)) : 0

    return {
      overall: {
        totalResponses: all.length,
        avgRating: this.avg(ratings),
        avgNpsScore: this.avg(scores),
        nps: npsInfo.nps,
        promoters: npsInfo.promoters,
        passives: npsInfo.passives,
        detractors: npsInfo.detractors,
        sentiment,
        responseRate: Math.min(100, responseRate),
      },
      byDepartment,
      byModality,
      trend,
      comments,
    }
  }

  /** 未使用的静态占位 (保持确定性哈希可用) */
  fingerprint(input: string): number {
    return hashNum(input)
  }
}
