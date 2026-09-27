/**
 * [G005 W12-PatientService] 微信服务号 / 小程序后端服务 (orphan module, DB-less-safe)
 *
 * 覆盖:
 *   - POST /wechat/oauth/callback     授权码 code → openid (确定性桩)
 *   - POST /wechat/bind               微信身份 ↔ 患者身份绑定 (openid/手机号/身份证/EMPI)
 *   - GET  /wechat/subscribe/config   服务号订阅/模板配置
 *   - POST /wechat/menu               自定义菜单保存
 *   - GET  /wechat/menu               自定义菜单读取
 *   - GET  /wechat/user/:openid       微信用户档案
 *   - POST /wechat/push               文本/图文客服消息推送
 *   - POST /wechat/template/send      模板消息发送
 *   - GET  /wechat/logs               发送日志
 *   - POST /wechat/logs/archive       日志归档
 *
 * 无 DB 可启动: 内存 overlay + 确定性派生 (同一输入恒同输出), 不依赖随机数。
 */
import { BadRequestException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

export type WechatChannel = 'SERVICE_ACCOUNT' | 'MINI_PROGRAM'
export type WechatLogType = 'OAUTH' | 'BIND' | 'PUSH' | 'TEMPLATE' | 'MENU'
export type WechatLogStatus = 'SENT' | 'FAILED' | 'ARCHIVED'

export interface WechatUserDto {
  openid: string
  unionid: string
  nickname: string
  avatarUrl: string
  gender: 'MALE' | 'FEMALE' | 'UNKNOWN'
  channel: WechatChannel
  phone?: string
  boundPatientId?: string
  boundEmpiId?: string
  boundPatientName?: string
  boundAt?: string
  subscribed: boolean
  source: 'db' | 'memory' | 'seed'
  createdAt: string
  updatedAt: string
}

export interface WechatSendLogDto {
  id: string
  type: WechatLogType
  channel: WechatChannel
  openid: string
  title: string
  content: string
  status: WechatLogStatus
  attempts: number
  error?: string
  createdAt: string
  archivedAt?: string
}

export interface WechatMenuButton {
  name: string
  type: 'click' | 'view' | 'miniprogram' | 'parent'
  key?: string
  url?: string
  appId?: string
  pagePath?: string
  sub_button?: WechatMenuButton[]
}

export interface WechatMenuDto {
  menuId: string
  channel: WechatChannel
  buttons: WechatMenuButton[]
  publishedAt: string
  version: number
}

export interface SubscribeConfigDto {
  nickname: string
  serviceAccount: string
  miniProgramAppId: string
  subscribeTemplates: Array<{ templateId: string; title: string; scene: string; enabled: boolean }>
  subscribedEvents: Array<{ event: string; label: string; enabled: boolean }>
  welcomeMessage: string
}

export const DEFAULT_SUBSCRIBE_CONFIG: SubscribeConfigDto = {
  nickname: 'G005 智慧影像服务',
  serviceAccount: 'gh_g005_ris',
  miniProgramAppId: 'wx0000000000000001',
  subscribeTemplates: [
    { templateId: 'TPL-APPT-REMIND', title: '预约提醒', scene: 'appointment_reminder', enabled: true },
    { templateId: 'TPL-REPORT-READY', title: '报告出具通知', scene: 'report_ready', enabled: true },
    { templateId: 'TPL-CRITICAL-CALL', title: '危急值提醒', scene: 'critical_alert', enabled: true },
    { templateId: 'TPL-QUEUE-CALL', title: '排队叫号提醒', scene: 'queue_call', enabled: true },
    { templateId: 'TPL-PAY-RESULT', title: '缴费结果通知', scene: 'payment_result', enabled: true },
  ],
  subscribedEvents: [
    { event: 'appointment_reminder', label: '检查前提醒', enabled: true },
    { event: 'report_ready', label: '报告可查看', enabled: true },
    { event: 'critical_alert', label: '危急值通知', enabled: true },
    { event: 'queue_call', label: '叫号/入队', enabled: true },
    { event: 'satisfaction_survey', label: '满意度调查', enabled: false },
  ],
  welcomeMessage: '欢迎使用 G005 智慧影像服务。绑定就诊人后可查询报告、预约检查与自助登记。',
}

export interface WechatPatientSeed {
  patientId: string
  name: string
  phone: string
  documentNo: string
  empiId: string
}

const PATIENT_SEED: WechatPatientSeed[] = [
  { patientId: 'P100001', name: '张伟', phone: '13800001001', documentNo: '110101196803120011', empiId: 'EMPI-000001' },
  { patientId: 'P100002', name: '李娜', phone: '13800001002', documentNo: '110101199211050028', empiId: 'EMPI-000002' },
  { patientId: 'P100003', name: '王芳', phone: '13800001003', documentNo: 'E12345678', empiId: 'EMPI-000003' },
  { patientId: 'P100004', name: '陈杰', phone: '13800001004', documentNo: '110101198601300037', empiId: 'EMPI-000004' },
]

const DEFAULT_MENU: WechatMenuButton[] = [
  {
    name: '就诊服务',
    type: 'parent',
    sub_button: [
      { name: '预约检查', type: 'click', key: 'APPOINTMENT' },
      { name: '自助登记', type: 'click', key: 'SELF_CHECKIN' },
      { name: '排队叫号', type: 'click', key: 'QUEUE_CALL' },
    ],
  },
  { name: '报告查询', type: 'view', url: 'https://ris.g005.example.com/portal/reports' },
  {
    name: '我的',
    type: 'parent',
    sub_button: [
      { name: '绑定就诊人', type: 'click', key: 'BIND_PATIENT' },
      { name: '缴费记录', type: 'click', key: 'PAYMENT_ORDERS' },
      { name: '满意度评价', type: 'click', key: 'SATISFACTION' },
    ],
  },
]

function hashNum(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function hexFrom(input: string, len: number): string {
  let h = hashNum(input)
  let out = ''
  while (out.length < len) {
    out += (h >>> 0).toString(16).padStart(8, '0')
    h = Math.imul(h ^ (h >>> 13), 16777619) >>> 0
  }
  return out.slice(0, len)
}

@Injectable()
export class WechatService {
  private readonly logger = new Logger(WechatService.name)
  private readonly users = new Map<string, WechatUserDto>()
  private readonly logs: WechatSendLogDto[] = []
  private menu: WechatMenuDto = {
    menuId: 'MENU-DEFAULT',
    channel: 'SERVICE_ACCOUNT',
    buttons: DEFAULT_MENU,
    publishedAt: '2026-01-01T00:00:00.000Z',
    version: 1,
  }
  private seq = 0
  private menuVersion = 1

  constructor(@Optional() private readonly prisma?: PrismaService) {
    if (!prisma) this.logger.log('WechatService: no Prisma injected (orphan mode, memory overlay + deterministic stub)')
  }

  private nextId(prefix: string): string {
    return `${prefix}-${String(++this.seq).padStart(6, '0')}`
  }

  private recordLog(input: {
    type: WechatLogType
    channel: WechatChannel
    openid: string
    title: string
    content: string
    status: WechatLogStatus
    error?: string
  }): WechatSendLogDto {
    const log: WechatSendLogDto = {
      id: this.nextId('WXLOG'),
      attempts: 1,
      createdAt: new Date().toISOString(),
      ...input,
    }
    this.logs.unshift(log)
    return log
  }

  private matchPatient(input: { patientId?: string; phone?: string; idCard?: string; empiId?: string }): WechatPatientSeed | null {
    const pid = input.patientId?.trim()
    const phone = input.phone?.trim()
    const idCard = input.idCard?.trim()
    const empi = input.empiId?.trim()
    return (
      PATIENT_SEED.find((p) =>
        (pid && p.patientId === pid) ||
        (phone && p.phone === phone) ||
        (idCard && p.documentNo === idCard) ||
        (empi && p.empiId === empi),
      ) ?? null
    )
  }

  // ──────────────────────────────────────────────────────────────────────────
  // OAuth: code → openid
  // ──────────────────────────────────────────────────────────────────────────

  /** POST /wechat/oauth/callback — 授权码换取 openid (确定性桩) */
  oauthCallback(body: { code?: string; channel?: WechatChannel; state?: string }): {
    openid: string
    unionid: string
    sessionKeyHint: string
    isNew: boolean
    user: WechatUserDto
  } {
    const code = body.code?.trim()
    if (!code) throw new BadRequestException('授权 code 不能为空')
    const channel: WechatChannel = body.channel ?? 'MINI_PROGRAM'
    const openid = `o${hexFrom(`openid:${code}:${channel}`, 27)}`
    const unionid = `u${hexFrom(`unionid:${code}`, 27)}`
    const isNew = !this.users.has(openid)
    let user = this.users.get(openid)
    if (!user) {
      const seed = PATIENT_SEED[hashNum(openid) % PATIENT_SEED.length]!
      user = {
        openid,
        unionid,
        nickname: `微信用户${hexFrom(openid, 4)}`,
        avatarUrl: 'https://mmsns.qpic.cn/default/avatar.png',
        gender: 'UNKNOWN',
        channel,
        phone: seed.phone,
        subscribed: true,
        source: 'memory',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      this.users.set(openid, user)
    }
    this.recordLog({
      type: 'OAUTH',
      channel,
      openid,
      title: '微信授权登录',
      content: `code=${code.slice(0, 8)}... 换取 openid 成功`,
      status: 'SENT',
    })
    return { openid, unionid, sessionKeyHint: hexFrom(`session:${code}`, 16), isNew, user }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 绑定
  // ──────────────────────────────────────────────────────────────────────────

  /** POST /wechat/bind — 微信身份与患者身份绑定 */
  bind(body: {
    openid?: string
    patientId?: string
    phone?: string
    idCard?: string
    empiId?: string
    name?: string
  }): { bound: boolean; openid: string; patient: WechatPatientSeed | null; user: WechatUserDto } {
    const openid = body.openid?.trim()
    if (!openid) throw new BadRequestException('openid 不能为空')
    const patient = this.matchPatient(body)
    if (!patient) {
      this.recordLog({
        type: 'BIND',
        channel: 'MINI_PROGRAM',
        openid,
        title: '绑定就诊人失败',
        content: '未匹配到患者档案 (身份证/手机号/EMPI)',
        status: 'FAILED',
        error: 'PATIENT_NOT_FOUND',
      })
      throw new NotFoundException('未匹配到患者档案, 请核对身份证号/手机号/EMPI')
    }
    const existing = this.users.get(openid)
    const now = new Date().toISOString()
    const user: WechatUserDto = {
      openid,
      unionid: existing?.unionid ?? `u${hexFrom(`unionid:${openid}`, 27)}`,
      nickname: body.name ?? existing?.nickname ?? `微信用户${hexFrom(openid, 4)}`,
      avatarUrl: existing?.avatarUrl ?? 'https://mmsns.qpic.cn/default/avatar.png',
      gender: existing?.gender ?? 'UNKNOWN',
      channel: existing?.channel ?? 'MINI_PROGRAM',
      phone: patient.phone,
      boundPatientId: patient.patientId,
      boundEmpiId: patient.empiId,
      boundPatientName: patient.name,
      boundAt: now,
      subscribed: existing?.subscribed ?? true,
      source: 'memory',
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    }
    this.users.set(openid, user)
    this.recordLog({
      type: 'BIND',
      channel: user.channel,
      openid,
      title: '绑定就诊人成功',
      content: `${patient.name} (${patient.patientId} / ${patient.empiId})`,
      status: 'SENT',
    })
    return { bound: true, openid, patient, user }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 订阅配置 / 菜单
  // ──────────────────────────────────────────────────────────────────────────

  /** GET /wechat/subscribe/config */
  getSubscribeConfig(): SubscribeConfigDto {
    return { ...DEFAULT_SUBSCRIBE_CONFIG }
  }

  /** POST /wechat/menu — 保存自定义菜单 (最多 3 个一级, 每个最多 5 个二级) */
  saveMenu(body: { buttons?: WechatMenuButton[]; channel?: WechatChannel }): WechatMenuDto {
    const buttons = Array.isArray(body.buttons) ? body.buttons : DEFAULT_MENU
    if (buttons.length === 0 || buttons.length > 3) {
      throw new BadRequestException('自定义菜单一级按钮数量必须为 1-3 个')
    }
    for (const b of buttons) {
      if (!b.name?.trim()) throw new BadRequestException('菜单名称不能为空')
      if (b.sub_button && b.sub_button.length > 5) {
        throw new BadRequestException(`菜单「${b.name}」二级按钮不能超过 5 个`)
      }
    }
    const now = new Date().toISOString()
    this.menuVersion += 1
    this.menu = {
      menuId: `MENU-${String(this.menuVersion).padStart(4, '0')}`,
      channel: body.channel ?? 'SERVICE_ACCOUNT',
      buttons,
      publishedAt: now,
      version: this.menuVersion,
    }
    this.recordLog({
      type: 'MENU',
      channel: this.menu.channel,
      openid: '-',
      title: '发布自定义菜单',
      content: `${buttons.length} 个一级菜单, 版本 v${this.menuVersion}`,
      status: 'SENT',
    })
    return this.menu
  }

  /** GET /wechat/menu */
  getMenu(): WechatMenuDto {
    return this.menu
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 用户
  // ──────────────────────────────────────────────────────────────────────────

  /** GET /wechat/user/:openid */
  getUser(openid: string): WechatUserDto {
    const user = this.users.get(openid)
    if (!user) throw new NotFoundException(`微信用户 ${openid} 不存在`)
    return user
  }

  listUsers(): WechatUserDto[] {
    return [...this.users.values()]
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 消息推送 / 模板消息
  // ──────────────────────────────────────────────────────────────────────────

  private canDeliver(openid: string): boolean {
    if (!openid || openid === '-') return false
    return /^(o|u)[0-9a-f]{8,}$/.test(openid)
  }

  /** POST /wechat/push — 客服消息推送 (文本/图文) */
  push(body: { openid?: string; title?: string; content?: string; channel?: WechatChannel }): WechatSendLogDto {
    const openid = body.openid?.trim() ?? ''
    const content = body.content?.trim()
    if (!content) throw new BadRequestException('推送内容不能为空')
    const deliverable = this.canDeliver(openid)
    return this.recordLog({
      type: 'PUSH',
      channel: body.channel ?? 'SERVICE_ACCOUNT',
      openid: openid || '-',
      title: body.title?.trim() || '服务通知',
      content,
      status: deliverable ? 'SENT' : 'FAILED',
      error: deliverable ? undefined : 'INVALID_OPENID',
    })
  }

  /** POST /wechat/template/send — 模板消息发送 */
  sendTemplate(body: {
    openid?: string
    templateId?: string
    data?: Record<string, string | number>
    url?: string
  }): WechatSendLogDto {
    const openid = body.openid?.trim() ?? ''
    const templateId = body.templateId?.trim()
    if (!templateId) throw new BadRequestException('templateId 不能为空')
    const tpl = DEFAULT_SUBSCRIBE_CONFIG.subscribeTemplates.find((t) => t.templateId === templateId)
    if (!tpl) throw new NotFoundException(`模板 ${templateId} 不存在`)
    const rendered = Object.entries(body.data ?? {})
      .map(([k, v]) => `${k}: ${v}`)
      .join(' / ')
    const deliverable = this.canDeliver(openid)
    return this.recordLog({
      type: 'TEMPLATE',
      channel: 'SERVICE_ACCOUNT',
      openid: openid || '-',
      title: tpl.title,
      content: rendered ? `${rendered}${body.url ? ` → ${body.url}` : ''}` : tpl.scene,
      status: deliverable ? 'SENT' : 'FAILED',
      error: deliverable ? undefined : 'INVALID_OPENID',
    })
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 日志 / 归档
  // ──────────────────────────────────────────────────────────────────────────

  /** GET /wechat/logs */
  listLogs(filter?: { openid?: string; type?: WechatLogType; status?: WechatLogStatus }): { items: WechatSendLogDto[]; total: number } {
    let items = this.logs
    if (filter?.openid) items = items.filter((l) => l.openid === filter.openid)
    if (filter?.type) items = items.filter((l) => l.type === filter.type)
    if (filter?.status) items = items.filter((l) => l.status === filter.status)
    return { items, total: items.length }
  }

  /** POST /wechat/logs/archive — 归档已发送日志 */
  archiveLogs(body?: { before?: string }): { archived: number; total: number } {
    const before = body?.before ? new Date(body.before).getTime() : Date.now()
    let archived = 0
    for (const log of this.logs) {
      if (log.status === 'SENT' && new Date(log.createdAt).getTime() <= before) {
        log.status = 'ARCHIVED'
        log.archivedAt = new Date().toISOString()
        archived += 1
      }
    }
    if (archived > 0) {
      this.recordLog({
        type: 'PUSH',
        channel: 'SERVICE_ACCOUNT',
        openid: '-',
        title: '日志归档',
        content: `归档 ${archived} 条发送日志`,
        status: 'SENT',
      })
    }
    return { archived, total: this.logs.length }
  }
}
