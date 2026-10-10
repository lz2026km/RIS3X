/**
 * [G005 W12-PatientService] 患者服务平台
 * Tabs: 微信绑定/推送日志 · 支付订单/退款 · 短信/模板消息 · 满意度分析 · 自助登记
 * 数据源: /wechat/* /payment/* /notification-channel/* /satisfaction/* /self-registration/*
 *         (后端内存模块; MSW 确定性兜底)
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Input,
  InputNumber,
  List,
  message,
  Modal,
  Row,
  Select,
  Space,
  Tabs,
  Tag,
  Typography,
} from "antd";
import { RefreshCw } from 'lucide-react'
import { t } from '../../i18n/appI18n'
import { DataTable, PageContainer, StatCard, StatCardGrid } from "../../components/common"
import {
  wechatApi, paymentApi, notificationChannelApi, satisfactionApi, selfRegistrationApi,
} from '../../services/api/w12PatientApi'
import type {
  DeliveryLogDto, NotificationTemplateDto, NotificationStatsDto, PaymentMethod, PaymentOrderDto,
  PaymentStatsDto, ReconciliationRowDto, SatisfactionAnalyticsDto, SelfCheckInResultDto,
  SelfIdentifyResultDto, SelfPatientDto, SelfQueueNumberDto, SelfQuestionnaireDto, SelfStatusDto,
  SurveyDto, WechatSendLogDto, WechatSubscribeConfigDto, WechatUserDto,
} from '../../services/api/w12PatientApi'

const { Text } = Typography

const fmtTime = (v?: string) => (v ? String(v).replace('T', ' ').slice(0, 16) : t('w12Patient.dash'))
const fmtMoney = (v?: number) => (typeof v === 'number' ? `¥${v.toLocaleString()}` : t('w12Patient.dash'))
const splitList = (v: string) => v.split(/[,，、\s]+/).map((s) => s.trim()).filter(Boolean)

const PAY_METHODS: PaymentMethod[] = ['WECHAT', 'ALIPAY', 'INSURANCE', 'CASH', 'MIXED']
const PAY_ITEM_TYPES: PaymentOrderDto['itemType'][] = ['REGISTRATION', 'APPOINTMENT', 'EXAM', 'REPORT']
const PAY_STATUS_COLOR: Record<string, string> = { CREATED: 'gold', PAID: 'green', REFUNDED: 'default', PARTIAL_REFUND: 'orange', CLOSED: 'default', FAILED: 'red' }
const WX_LOG_COLOR: Record<string, string> = { SENT: 'green', FAILED: 'red', ARCHIVED: 'default' }
const NC_STATUS_COLOR: Record<string, string> = { SENT: 'green', FAILED: 'red', PENDING: 'gold', RETRYING: 'blue' }
const SENTIMENT_COLOR: Record<string, string> = { positive: 'green', neutral: 'default', negative: 'red' }
const RISK_COLOR: Record<string, string> = { LOW: 'green', MEDIUM: 'orange', HIGH: 'red' }
const CHECKIN_COLOR: Record<string, string> = { CHECKED_IN: 'green', ALREADY_CHECKED_IN: 'blue', BLOCKED: 'red' }

type WxBindMethod = 'idCard' | 'phone' | 'empi'

export default function PatientServiceCenterPage() {
  const [tab, setTab] = useState('wechat')
  const [loading, setLoading] = useState(true)
  const [source, setSource] = useState<'api' | 'demo'>('api')

  // ── 微信 ──
  const [wxCode, setWxCode] = useState('DEMO-CODE-001')
  const [wxOpenid, setWxOpenid] = useState('')
  const [wxUser, setWxUser] = useState<WechatUserDto | null>(null)
  const [wxConfig, setWxConfig] = useState<WechatSubscribeConfigDto | null>(null)
  const [wxLogs, setWxLogs] = useState<WechatSendLogDto[]>([])
  const [wxBindMethod, setWxBindMethod] = useState<WxBindMethod>('phone')
  const [wxBindValue, setWxBindValue] = useState('13800001001')
  const [wxPushContent, setWxPushContent] = useState('您的检查报告已出具, 请查看。')
  const [wxBusy, setWxBusy] = useState(false)
  // [G005 W4B] 已绑定关注者列表 (GET /wechat/users)
  const [wxUsers, setWxUsers] = useState<WechatUserDto[]>([])
  const [wxUsersLoading, setWxUsersLoading] = useState(false)
  const [wxUsersError, setWxUsersError] = useState('')

  // ── 支付 ──
  const [orders, setOrders] = useState<PaymentOrderDto[]>([])
  const [payStats, setPayStats] = useState<PaymentStatsDto | null>(null)
  const [reconcile, setReconcile] = useState<ReconciliationRowDto[]>([])
  const [payPatientId, setPayPatientId] = useState('P100001')
  const [payItemType, setPayItemType] = useState<PaymentOrderDto['itemType']>('EXAM')
  const [payAmount, setPayAmount] = useState<number | null>(580)
  const [payMethod, setPayMethod] = useState<PaymentMethod>('WECHAT')
  const [refundOrder, setRefundOrder] = useState<PaymentOrderDto | null>(null)
  const [refundAmount, setRefundAmount] = useState<number | null>(null)
  const [payBusy, setPayBusy] = useState(false)

  // ── 通知 ──
  const [ncTemplates, setNcTemplates] = useState<NotificationTemplateDto[]>([])
  const [ncLogs, setNcLogs] = useState<DeliveryLogDto[]>([])
  const [ncStats, setNcStats] = useState<NotificationStatsDto | null>(null)
  const [ncTemplateCode, setNcTemplateCode] = useState('APPOINTMENT_REMINDER')
  const [ncRecipient, setNcRecipient] = useState('13800001001')
  const [ncVarsText, setNcVarsText] = useState('{"patientName":"张伟","modality":"CT","scheduledAt":"2026-09-01 09:00","deviceName":"CT-01"}')
  const [ncBusy, setNcBusy] = useState(false)

  // ── 满意度 ──
  const [satAnalytics, setSatAnalytics] = useState<SatisfactionAnalyticsDto | null>(null)
  const [satSurveys, setSatSurveys] = useState<SurveyDto[]>([])
  const [satTitle, setSatTitle] = useState('CT 室服务满意度调查')
  const [satRespond, setSatRespond] = useState<SurveyDto | null>(null)
  const [satRating, setSatRating] = useState(5)
  const [satNps, setSatNps] = useState(9)
  const [satComment, setSatComment] = useState('服务专业, 检查很快。')
  const [satBusy, setSatBusy] = useState(false)

  // ── 自助登记 ──
  const [srIdCard, setSrIdCard] = useState('110101196803120011')
  const [srPhone, setSrPhone] = useState('13800001001')
  const [srEmpi, setSrEmpi] = useState('')
  const [srName, setSrName] = useState('')
  const [srResult, setSrResult] = useState<SelfIdentifyResultDto | null>(null)
  const [srSelected, setSrSelected] = useState<SelfPatientDto | null>(null)
  const [srCheckIn, setSrCheckIn] = useState<SelfCheckInResultDto | null>(null)
  const [srQuestionnaire, setSrQuestionnaire] = useState<SelfQuestionnaireDto | null>(null)
  const [srStatus, setSrStatus] = useState<SelfStatusDto | null>(null)
  const [srQueue, setSrQueue] = useState<SelfQueueNumberDto | null>(null)
  const [srAllergies, setSrAllergies] = useState('碘对比剂')
  const [srPregnant, setSrPregnant] = useState(false)
  const [srFasting, setSrFasting] = useState(true)
  const [srImplants, setSrImplants] = useState('')
  const [srClaustrophobia, setSrClaustrophobia] = useState(false)
  const [srSignature, setSrSignature] = useState('张伟')
  const [srModality, setSrModality] = useState('CT')
  const [srPriority, setSrPriority] = useState<'NORMAL' | 'URGENT' | 'EMERGENCY'>('NORMAL')
  const [srBusy, setSrBusy] = useState(false)

  const loadWechatUsers = useCallback(async () => {
    setWxUsersLoading(true)
    setWxUsersError('')
    try {
      const res = await wechatApi.listUsers()
      if (res.success && res.data) setWxUsers(res.data.items ?? [])
      else setWxUsersError(res.error?.message ?? t('w4b.wx.loadFailed'))
    } catch {
      setWxUsersError(t('w4b.wx.loadFailed'))
    } finally {
      setWxUsersLoading(false)
    }
  }, [])

  const loadWechat = useCallback(async () => {
    const [cfg, logs] = await Promise.allSettled([
      wechatApi.getSubscribeConfig(),
      wechatApi.listLogs(),
    ])
    if (cfg.status === 'fulfilled' && cfg.value.success && cfg.value.data) setWxConfig(cfg.value.data)
    if (logs.status === 'fulfilled' && logs.value.success && logs.value.data) setWxLogs(logs.value.data.items ?? [])
    void loadWechatUsers()
    return [cfg, logs].some((r) => r.status === 'fulfilled' && r.value.success)
  }, [loadWechatUsers])

  const loadPayment = useCallback(async () => {
    const [list, stats, rec] = await Promise.allSettled([
      paymentApi.listOrders(),
      paymentApi.stats(),
      paymentApi.reconciliation(),
    ])
    if (list.status === 'fulfilled' && list.value.success && list.value.data) setOrders(list.value.data.items ?? [])
    if (stats.status === 'fulfilled' && stats.value.success && stats.value.data) setPayStats(stats.value.data)
    if (rec.status === 'fulfilled' && rec.value.success && rec.value.data) setReconcile(rec.value.data.rows ?? [])
    return [list, stats, rec].some((r) => r.status === 'fulfilled' && r.value.success)
  }, [])

  const loadNotification = useCallback(async () => {
    const [tpl, logs, stats] = await Promise.allSettled([
      notificationChannelApi.listTemplates(),
      notificationChannelApi.listLogs(),
      notificationChannelApi.stats(),
    ])
    if (tpl.status === 'fulfilled' && tpl.value.success && tpl.value.data) setNcTemplates(tpl.value.data.items ?? [])
    if (logs.status === 'fulfilled' && logs.value.success && logs.value.data) setNcLogs(logs.value.data.items ?? [])
    if (stats.status === 'fulfilled' && stats.value.success && stats.value.data) setNcStats(stats.value.data)
    return [tpl, logs, stats].some((r) => r.status === 'fulfilled' && r.value.success)
  }, [])

  const loadSatisfaction = useCallback(async () => {
    const [an, sv] = await Promise.allSettled([
      satisfactionApi.analytics(),
      satisfactionApi.listSurveys(),
    ])
    if (an.status === 'fulfilled' && an.value.success && an.value.data) setSatAnalytics(an.value.data)
    if (sv.status === 'fulfilled' && sv.value.success && sv.value.data) setSatSurveys(sv.value.data.items ?? [])
    return [an, sv].some((r) => r.status === 'fulfilled' && r.value.success)
  }, [])

  const loadAll = useCallback(async () => {
    setLoading(true)
    const results = await Promise.all([loadWechat(), loadPayment(), loadNotification(), loadSatisfaction()])
    setSource(results.some(Boolean) ? 'api' : 'demo')
    setLoading(false)
  }, [loadWechat, loadPayment, loadNotification, loadSatisfaction])

  useEffect(() => { void loadAll() }, [loadAll])

  // ── 微信动作 ──
  const doOauth = async () => {
    if (!wxCode.trim()) { message.warning(t('w12Patient.wechat.oauthCode')); return }
    setWxBusy(true)
    try {
      const res = await wechatApi.oauthCallback({ code: wxCode.trim() })
      if (res.success && res.data) {
        setWxOpenid(res.data.openid)
        setWxUser(res.data.user)
        message.success(t('w12Patient.wechat.oauthDone'))
        await loadWechat()
      } else message.error(res.error?.message ?? t('w12Patient.loadFailed'))
    } finally { setWxBusy(false) }
  }

  const doBind = async () => {
    if (!wxOpenid) { message.warning(t('w12Patient.wechat.needOauth')); return }
    setWxBusy(true)
    try {
      const payload = wxBindMethod === 'idCard' ? { idCard: wxBindValue } : wxBindMethod === 'phone' ? { phone: wxBindValue } : { empiId: wxBindValue }
      const res = await wechatApi.bind({ openid: wxOpenid, ...payload })
      if (res.success && res.data) {
        setWxUser(res.data.user)
        message.success(t('w12Patient.wechat.bindSuccess'))
        await loadWechat()
      } else message.error(t('w12Patient.wechat.bindFailed'))
    } finally { setWxBusy(false) }
  }

  const doPush = async () => {
    if (!wxOpenid) { message.warning(t('w12Patient.wechat.needOauth')); return }
    setWxBusy(true)
    try {
      const res = await wechatApi.push({ openid: wxOpenid, content: wxPushContent })
      if (res.success) { message.success(t('w12Patient.wechat.pushSent')); await loadWechat() }
      else message.error(res.error?.message ?? t('w12Patient.loadFailed'))
    } finally { setWxBusy(false) }
  }

  const doArchive = async () => {
    setWxBusy(true)
    try {
      const res = await wechatApi.archiveLogs()
      if (res.success && res.data) { message.success(t('w12Patient.wechat.archived', { count: res.data.archived })); await loadWechat() }
    } finally { setWxBusy(false) }
  }

  // ── 支付动作 ──
  const doCreateOrder = async () => {
    setPayBusy(true)
    try {
      const res = await paymentApi.createOrder({ patientId: payPatientId, itemType: payItemType, amount: payAmount ?? undefined, method: payMethod })
      if (res.success) { message.success(t('w12Patient.payment.created')); await loadPayment() }
      else message.error(res.error?.message ?? t('w12Patient.payment.createFailed'))
    } finally { setPayBusy(false) }
  }

  const doPay = async (order: PaymentOrderDto) => {
    setPayBusy(true)
    try {
      const res = await paymentApi.pay(order.id)
      if (res.success) { message.success(t('w12Patient.payment.paySuccess')); await loadPayment() }
      else message.error(res.error?.message ?? t('w12Patient.loadFailed'))
    } finally { setPayBusy(false) }
  }

  const doNotify = async (order: PaymentOrderDto) => {
    setPayBusy(true)
    try {
      const res = await paymentApi.notify({ orderNo: order.orderNo, method: order.method, result: 'SUCCESS' })
      if (res.success) { message.success(t('w12Patient.payment.notifyDone')); await loadPayment() }
      else message.error(res.error?.message ?? t('w12Patient.loadFailed'))
    } finally { setPayBusy(false) }
  }

  const doRefund = async () => {
    if (!refundOrder) return
    setPayBusy(true)
    try {
      const res = await paymentApi.refund(refundOrder.id, { amount: refundAmount ?? undefined, reason: t('w12Patient.payment.refundReason') })
      if (res.success) { message.success(t('w12Patient.payment.refundSuccess')); setRefundOrder(null); setRefundAmount(null); await loadPayment() }
      else message.error(res.error?.message ?? t('w12Patient.loadFailed'))
    } finally { setPayBusy(false) }
  }

  const doClose = async (order: PaymentOrderDto) => {
    setPayBusy(true)
    try {
      const res = await paymentApi.close(order.id)
      if (res.success) { message.success(t('w12Patient.payment.closeSuccess')); await loadPayment() }
      else message.error(res.error?.message ?? t('w12Patient.loadFailed'))
    } finally { setPayBusy(false) }
  }

  // ── 通知动作 ──
  const doSend = async (code?: string) => {
    setNcBusy(true)
    try {
      let vars: Record<string, string | number> = {}
      try { vars = JSON.parse(ncVarsText) as Record<string, string | number> } catch { vars = {} }
      const res = await notificationChannelApi.send({ templateCode: code ?? ncTemplateCode, recipient: ncRecipient, variables: vars })
      if (res.success && res.data?.status === 'SENT') message.success(t('w12Patient.nc.sendSuccess'))
      else message.warning(res.data?.lastError ?? res.error?.message ?? t('w12Patient.nc.sendFailed'))
      await loadNotification()
    } finally { setNcBusy(false) }
  }

  const doRetry = async (log: DeliveryLogDto) => {
    setNcBusy(true)
    try {
      const res = await notificationChannelApi.retry(log.id)
      if (res.success) message.success(t('w12Patient.nc.retrySuccess'))
      else message.error(res.error?.message ?? t('w12Patient.loadFailed'))
      await loadNotification()
    } finally { setNcBusy(false) }
  }

  // ── 满意度动作 ──
  const doCreateSurvey = async () => {
    setSatBusy(true)
    try {
      const res = await satisfactionApi.createSurvey({ title: satTitle, department: '放射科', type: 'EXAM' })
      if (res.success) { message.success(t('w12Patient.sat.created')); await loadSatisfaction() }
      else message.error(res.error?.message ?? t('w12Patient.sat.createFailed'))
    } finally { setSatBusy(false) }
  }

  const doRespond = async () => {
    if (!satRespond) return
    setSatBusy(true)
    try {
      const res = await satisfactionApi.respond(satRespond.id, { rating: satRating, npsScore: satNps, comment: satComment, patientName: '张伟' })
      if (res.success) { message.success(t('w12Patient.sat.respondSuccess')); setSatRespond(null); await loadSatisfaction() }
      else message.error(res.error?.message ?? t('w12Patient.loadFailed'))
    } finally { setSatBusy(false) }
  }

  // ── 自助登记动作 ──
  const doIdentify = async () => {
    setSrBusy(true)
    try {
      const res = await selfRegistrationApi.identify({ idCard: srIdCard || undefined, phone: srPhone || undefined, empiId: srEmpi || undefined, name: srName || undefined })
      if (res.success && res.data) {
        setSrResult(res.data)
        setSrSelected(res.data.matched)
        if (!res.data.matched) message.warning(t('w12Patient.sr.identifyFailed'))
        else await refreshSrStatus(res.data.matched.patientId)
      } else message.error(res.error?.message ?? t('w12Patient.loadFailed'))
    } finally { setSrBusy(false) }
  }

  const refreshSrStatus = async (patientId: string) => {
    const res = await selfRegistrationApi.status(patientId)
    if (res.success && res.data) setSrStatus(res.data)
  }

  const doCheckIn = async () => {
    if (!srSelected) return
    setSrBusy(true)
    try {
      const res = await selfRegistrationApi.checkIn({ patientId: srSelected.patientId })
      if (res.success && res.data) { setSrCheckIn(res.data); await refreshSrStatus(srSelected.patientId) }
      else message.error(res.error?.message ?? t('w12Patient.loadFailed'))
    } finally { setSrBusy(false) }
  }

  const doQuestionnaire = async () => {
    if (!srSelected) return
    setSrBusy(true)
    try {
      const res = await selfRegistrationApi.submitQuestionnaire({
        patientId: srSelected.patientId,
        allergies: splitList(srAllergies),
        pregnant: srPregnant,
        fastingConfirmed: srFasting,
        implants: splitList(srImplants),
        claustrophobia: srClaustrophobia,
      })
      if (res.success && res.data) { setSrQuestionnaire(res.data); message.success(t('w12Patient.sr.questionnaireDone')); await refreshSrStatus(srSelected.patientId) }
      else message.error(res.error?.message ?? t('w12Patient.loadFailed'))
    } finally { setSrBusy(false) }
  }

  const doConsent = async () => {
    if (!srSelected) return
    setSrBusy(true)
    try {
      const res = await selfRegistrationApi.signConsent({ patientId: srSelected.patientId, signature: srSignature })
      if (res.success) { message.success(t('w12Patient.sr.consentDone')); await refreshSrStatus(srSelected.patientId) }
      else message.error(res.error?.message ?? t('w12Patient.loadFailed'))
    } finally { setSrBusy(false) }
  }

  const doQueue = async () => {
    if (!srSelected) return
    setSrBusy(true)
    try {
      const res = await selfRegistrationApi.issueQueueNumber({ patientId: srSelected.patientId, modality: srModality, priority: srPriority })
      if (res.success && res.data) { setSrQueue(res.data); message.success(t('w12Patient.sr.issued')); await refreshSrStatus(srSelected.patientId) }
      else message.error(res.error?.message ?? t('w12Patient.loadFailed'))
    } finally { setSrBusy(false) }
  }

  const satNpsLevel = (nps: number) => (nps >= 50 ? 'green' : nps >= 0 ? 'blue' : 'red')

  const wechatTab = useMemo(() => (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={12}>
        <Card size="small" title={t('w12Patient.wechat.oauthTitle')} style={{ marginBottom: 16 }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Space.Compact style={{ width: '100%' }}>
              <Input value={wxCode} onChange={(e) => setWxCode(e.target.value)} placeholder={t('w12Patient.wechat.oauthCode')} />
              <Button type="primary" loading={wxBusy} onClick={() => void doOauth()}>{t('w12Patient.wechat.oauth')}</Button>
            </Space.Compact>
            {wxOpenid && (
              <Descriptions size="small" column={1} bordered>
                <Descriptions.Item label={t('w12Patient.wechat.openid')}><Text code>{wxOpenid}</Text></Descriptions.Item>
                <Descriptions.Item label={t('w12Patient.wechat.nickname')}>{wxUser?.nickname ?? t('w12Patient.dash')}</Descriptions.Item>
                <Descriptions.Item label={t('w12Patient.wechat.boundPatient')}>
                  {wxUser?.boundPatientName ? `${wxUser.boundPatientName} (${wxUser.boundPatientId})` : <Tag>{t('w12Patient.wechat.unbound')}</Tag>}
                </Descriptions.Item>
              </Descriptions>
            )}
          </Space>
        </Card>

        <Card size="small" title={t('w12Patient.wechat.bindTitle')} style={{ marginBottom: 16 }}>
          <Space wrap>
            <Select value={wxBindMethod} style={{ width: 130 }} onChange={(v) => setWxBindMethod(v)}
              options={[
                { value: 'idCard', label: t('w12Patient.wechat.bindByIdCard') },
                { value: 'phone', label: t('w12Patient.wechat.bindByPhone') },
                { value: 'empi', label: t('w12Patient.wechat.bindByEmpi') },
              ]} />
            <Input value={wxBindValue} style={{ width: 220 }} onChange={(e) => setWxBindValue(e.target.value)} placeholder={t('w12Patient.wechat.bindValue')} />
            <Button onClick={() => void doBind()} loading={wxBusy}>{t('w12Patient.wechat.bind')}</Button>
          </Space>
        </Card>

        <Card size="small" title={t('w12Patient.wechat.pushTitle')}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Input.TextArea rows={2} value={wxPushContent} onChange={(e) => setWxPushContent(e.target.value)} />
            <Space>
              <Button type="primary" onClick={() => void doPush()} loading={wxBusy}>{t('w12Patient.wechat.push')}</Button>
              <Button onClick={() => void doArchive()} loading={wxBusy}>{t('w12Patient.wechat.archive')}</Button>
            </Space>
          </Space>
        </Card>
      </Col>

      <Col xs={24} lg={12}>
        <Card size="small" title={t('w12Patient.wechat.subscribe')} style={{ marginBottom: 16 }}>
          <DataTable rowKey="templateId" pagination={false} dataSource={wxConfig?.subscribeTemplates ?? []}
            locale={{ emptyText: <Empty description={t('w12Patient.empty')} /> }}
            columns={[
              { title: t('w12Patient.wechat.templateId'), dataIndex: 'templateId' },
              { title: t('w12Patient.wechat.templateTitle'), dataIndex: 'title' },
              { title: t('w12Patient.wechat.templateScene'), dataIndex: 'scene' },
              { title: t('w12Patient.status'), dataIndex: 'enabled', render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? t('w12Patient.sr.done') : t('w12Patient.dash')}</Tag> },
            ]} />
        </Card>

        <Card size="small" title={`${t('w12Patient.wechat.logs')} (${wxLogs.length})`} style={{ marginBottom: 16 }}>
          <DataTable rowKey="id" pagination={{ pageSize: 8, showSizeChanger: false }} dataSource={wxLogs}
            locale={{ emptyText: <Empty description={t('w12Patient.empty')} /> }}
            columns={[
              { title: t('w12Patient.wechat.logType'), dataIndex: 'type', width: 90, render: (v: string) => <Tag>{t(`w12Patient.wechat.logType.${v}`)}</Tag> },
              { title: t('w12Patient.wechat.logContent'), dataIndex: 'content', ellipsis: true },
              { title: t('w12Patient.wechat.logStatus'), dataIndex: 'status', width: 90, render: (v: string) => <Tag color={WX_LOG_COLOR[v]}>{t(`w12Patient.wechat.logStatus.${v}`)}</Tag> },
              { title: t('w12Patient.createdAt'), dataIndex: 'createdAt', width: 140, render: fmtTime },
            ]} />
        </Card>

        {/* [G005 W4B] 已绑定微信用户 (GET /wechat/users) */}
        <Card
          size="small"
          title={`${t('w4b.wx.usersTitle', { count: wxUsers.length })}`}
          extra={<Button size="small" icon={<RefreshCw size={12} />} loading={wxUsersLoading} onClick={() => void loadWechatUsers()}>{t('w4b.wx.refresh')}</Button>}
        >
          {wxUsersError && <Alert type="warning" showIcon message={wxUsersError} style={{ marginBottom: 8 }} />}
          <DataTable rowKey="openid" loading={wxUsersLoading} pagination={{ pageSize: 8, showSizeChanger: false }} dataSource={wxUsers}
            locale={{ emptyText: <Empty description={t('w4b.wx.empty')} /> }}
            columns={[
              { title: t('w4b.wx.thNickname'), dataIndex: 'nickname', width: 110 },
              { title: t('w4b.wx.thOpenid'), dataIndex: 'openid', width: 150, ellipsis: true },
              { title: t('w4b.wx.thChannel'), dataIndex: 'channel', width: 120, render: (v: string) => <Tag>{v}</Tag> },
              { title: t('w4b.wx.thBound'), width: 140, render: (_: unknown, r: WechatUserDto) => r.boundPatientName ? `${r.boundPatientName} (${r.boundPatientId})` : <Tag>{t('w4b.wx.no')}</Tag> },
              { title: t('w4b.wx.thSubscribed'), dataIndex: 'subscribed', width: 80, render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? t('w4b.wx.yes') : t('w4b.wx.no')}</Tag> },
              { title: t('w4b.wx.thCreatedAt'), dataIndex: 'createdAt', width: 140, render: fmtTime },
            ]} />
        </Card>
      </Col>
    </Row>
  ), [wxCode, wxOpenid, wxUser, wxBindMethod, wxBindValue, wxPushContent, wxBusy, wxConfig, wxLogs, wxUsers, wxUsersLoading, wxUsersError, loadWechatUsers])

  const paymentTab = useMemo(() => (
    <div>
      <StatCardGrid minWidth={200} gap={16} style={{ marginBottom: 16 }}>
        <StatCard title={t('w12Patient.payment.totalOrders')} value={payStats?.totalOrders ?? 0} />
        <StatCard title={t('w12Patient.payment.paidAmount')} value={payStats?.paidAmount ?? 0} prefix="¥" />
        <StatCard title={t('w12Patient.payment.netAmount')} value={payStats?.netAmount ?? 0} prefix="¥" />
        <StatCard title={t('w12Patient.payment.refundRate')} value={payStats?.refundRate ?? 0} suffix="%" />
      </StatCardGrid>

      <Card size="small" title={t('w12Patient.payment.createTitle')} style={{ marginBottom: 16 }}>
        <Space wrap>
          <Select value={payPatientId} style={{ width: 130 }} onChange={setPayPatientId}
            options={['P100001', 'P100002', 'P100003', 'P100004'].map((id) => ({ value: id, label: id }))} />
          <Select value={payItemType} style={{ width: 150 }} onChange={(v) => setPayItemType(v)}
            options={PAY_ITEM_TYPES.map((v) => ({ value: v, label: t(`w12Patient.payment.itemType.${v}`) }))} />
          <InputNumber value={payAmount} min={1} style={{ width: 140 }} onChange={setPayAmount} placeholder={t('w12Patient.payment.amount')} />
          <Select value={payMethod} style={{ width: 150 }} onChange={(v) => setPayMethod(v)}
            options={PAY_METHODS.map((v) => ({ value: v, label: t(`w12Patient.payment.method.${v}`) }))} />
          <Button type="primary" loading={payBusy} onClick={() => void doCreateOrder()}>{t('w12Patient.payment.create')}</Button>
        </Space>
      </Card>

      <Card size="small" title={t('w12Patient.payment.orders')} style={{ marginBottom: 16 }}>
        <DataTable rowKey="id" pagination={{ pageSize: 8, showSizeChanger: false }} dataSource={orders}
          locale={{ emptyText: <Empty description={t('w12Patient.empty')} /> }}
          columns={[
            { title: t('w12Patient.payment.orderNo'), dataIndex: 'orderNo', width: 150 },
            { title: t('w12Patient.payment.patient'), dataIndex: 'patientName', width: 90, render: (v: string, r: PaymentOrderDto) => `${v ?? t('w12Patient.dash')} (${r.patientId})` },
            { title: t('w12Patient.payment.itemType'), dataIndex: 'itemType', width: 100, render: (v: string) => t(`w12Patient.payment.itemType.${v}`) },
            { title: t('w12Patient.payment.amount'), dataIndex: 'amount', width: 100, render: fmtMoney },
            { title: t('w12Patient.payment.method'), dataIndex: 'method', width: 100, render: (v: string) => t(`w12Patient.payment.method.${v}`) },
            { title: t('w12Patient.payment.status'), dataIndex: 'status', width: 110, render: (v: string) => <Tag color={PAY_STATUS_COLOR[v]}>{t(`w12Patient.payment.status.${v}`)}</Tag> },
            {
              title: t('w12Patient.actions'), key: 'actions', width: 230,
              render: (_: unknown, r: PaymentOrderDto) => (
                <Space size={4}>
                  {r.status === 'CREATED' && <Button size="small" type="link" onClick={() => void doPay(r)}>{t('w12Patient.payment.pay')}</Button>}
                  {r.status === 'CREATED' && <Button size="small" type="link" onClick={() => void doNotify(r)}>{t('w12Patient.payment.notify')}</Button>}
                  {(r.status === 'PAID' || r.status === 'PARTIAL_REFUND') && <Button size="small" type="link" danger onClick={() => { setRefundOrder(r); setRefundAmount(r.paidAmount - r.refundedAmount) }}>{t('w12Patient.payment.refund')}</Button>}
                  {r.status === 'CREATED' && <Button size="small" type="link" onClick={() => void doClose(r)}>{t('w12Patient.payment.close')}</Button>}
                </Space>
              ),
            },
          ]} />
      </Card>

      <Card size="small" title={t('w12Patient.payment.reconcile')}>
        <DataTable rowKey="orderNo" pagination={{ pageSize: 6, showSizeChanger: false }} dataSource={reconcile}
          locale={{ emptyText: <Empty description={t('w12Patient.empty')} /> }}
          columns={[
            { title: t('w12Patient.payment.orderNo'), dataIndex: 'orderNo', width: 150 },
            { title: t('w12Patient.payment.method'), dataIndex: 'method', render: (v: string) => t(`w12Patient.payment.method.${v}`) },
            { title: t('w12Patient.payment.amount'), dataIndex: 'amount', render: fmtMoney },
            { title: t('w12Patient.payment.paid'), dataIndex: 'paidAmount', render: fmtMoney },
            { title: t('w12Patient.payment.refunded'), dataIndex: 'refundedAmount', render: fmtMoney },
            { title: t('w12Patient.payment.netAmount'), dataIndex: 'netAmount', render: fmtMoney },
            { title: t('w12Patient.payment.settleDate'), dataIndex: 'settleDate' },
            { title: t('w12Patient.payment.reconciled'), dataIndex: 'reconciled', render: (v: boolean) => <Tag color={v ? 'green' : 'red'}>{v ? t('w12Patient.payment.reconciled') : t('w12Patient.dash')}</Tag> },
          ]} />
      </Card>

      <Modal title={t('w12Patient.payment.refund')} open={!!refundOrder} onCancel={() => setRefundOrder(null)} onOk={() => void doRefund()} confirmLoading={payBusy}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text>{refundOrder?.orderNo}</Text>
          <InputNumber value={refundAmount} min={1} style={{ width: '100%' }} onChange={setRefundAmount} placeholder={t('w12Patient.payment.refundAmount')} />
        </Space>
      </Modal>
    </div>
  ), [payStats, payPatientId, payItemType, payAmount, payMethod, payBusy, orders, reconcile, refundOrder, refundAmount])

  const notificationTab = useMemo(() => (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={10}>
        <Card size="small" title={t('w12Patient.nc.sendTitle')} style={{ marginBottom: 16 }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Select value={ncTemplateCode} style={{ width: '100%' }} onChange={setNcTemplateCode}
              options={ncTemplates.filter((x) => x.status === 'active').map((x) => ({ value: x.code, label: `${x.name} (${t(`w12Patient.nc.channel.${x.channel}`)})` }))} />
            <Input value={ncRecipient} onChange={(e) => setNcRecipient(e.target.value)} addonBefore={t('w12Patient.nc.recipient')} />
            <Input.TextArea rows={3} value={ncVarsText} onChange={(e) => setNcVarsText(e.target.value)} placeholder={t('w12Patient.nc.variables')} />
            <Space>
              <Button type="primary" loading={ncBusy} onClick={() => void doSend()}>{t('w12Patient.nc.send')}</Button>
            </Space>
            <Text type="secondary" style={{ fontSize: 12 }}>{t('w12Patient.nc.quickNotify')}</Text>
            <Space wrap>
              <Button size="small" onClick={() => void doSend('APPOINTMENT_REMINDER')}>APPOINTMENT_REMINDER</Button>
              <Button size="small" onClick={() => void doSend('REPORT_READY')}>REPORT_READY</Button>
              <Button size="small" onClick={() => void doSend('CRITICAL_ALERT')}>CRITICAL_ALERT</Button>
            </Space>
          </Space>
        </Card>
        <Card size="small" title={t('w12Patient.nc.stats')}>
          <StatCardGrid minWidth={120} gap={8}>
            <StatCard title={t('w12Patient.nc.total')} value={ncStats?.total ?? 0} />
            <StatCard title={t('w12Patient.nc.templateCount')} value={ncStats?.templateCount ?? 0} />
            <StatCard title={t('w12Patient.nc.successRate')} value={ncStats?.successRate ?? 0} suffix="%" />
          </StatCardGrid>
        </Card>
      </Col>
      <Col xs={24} lg={14}>
        <Card size="small" title={t('w12Patient.nc.templates')} style={{ marginBottom: 16 }}>
          <DataTable rowKey="id" pagination={false} dataSource={ncTemplates}
            locale={{ emptyText: <Empty description={t('w12Patient.empty')} /> }}
            columns={[
              { title: t('w12Patient.nc.templateCode'), dataIndex: 'code', width: 180 },
              { title: t('w12Patient.nc.templateName'), dataIndex: 'name' },
              { title: t('w12Patient.nc.channel'), dataIndex: 'channel', width: 120, render: (v: string) => <Tag>{t(`w12Patient.nc.channel.${v}`)}</Tag> },
              { title: t('w12Patient.nc.variables'), dataIndex: 'variables', render: (v: string[]) => (v ?? []).map((x) => <Tag key={x}>{x}</Tag>) },
            ]} />
        </Card>
        <Card size="small" title={`${t('w12Patient.nc.logs')} (${ncLogs.length})`}>
          <DataTable rowKey="id" pagination={{ pageSize: 6, showSizeChanger: false }} dataSource={ncLogs}
            locale={{ emptyText: <Empty description={t('w12Patient.empty')} /> }}
            columns={[
              { title: t('w12Patient.nc.templateName'), dataIndex: 'templateName', width: 130 },
              { title: t('w12Patient.nc.channel'), dataIndex: 'channel', width: 110, render: (v: string) => t(`w12Patient.nc.channel.${v}`) },
              { title: t('w12Patient.nc.recipient'), dataIndex: 'recipient', width: 120 },
              { title: t('w12Patient.nc.status'), dataIndex: 'status', width: 90, render: (v: string) => <Tag color={NC_STATUS_COLOR[v]}>{t(`w12Patient.nc.status.${v}`)}</Tag> },
              { title: t('w12Patient.nc.attempts'), dataIndex: 'attempts', width: 80 },
              {
                title: t('w12Patient.actions'), key: 'actions', width: 90,
                render: (_: unknown, r: DeliveryLogDto) => r.status !== 'SENT' ? <Button size="small" type="link" onClick={() => void doRetry(r)}>{t('w12Patient.nc.retry')}</Button> : null,
              },
            ]} />
        </Card>
      </Col>
    </Row>
  ), [ncTemplates, ncLogs, ncStats, ncTemplateCode, ncRecipient, ncVarsText, ncBusy])

  const satisfactionTab = useMemo(() => (
    <div>
      <StatCardGrid minWidth={200} gap={16} style={{ marginBottom: 16 }}>
        <StatCard title={t('w12Patient.sat.nps')} value={satAnalytics?.overall.nps ?? 0} color={satNpsLevel(satAnalytics?.overall.nps ?? 0)} />
        <StatCard title={t('w12Patient.sat.avgRating')} value={satAnalytics?.overall.avgRating ?? 0} suffix="/5" />
        <StatCard title={t('w12Patient.sat.totalResponses')} value={satAnalytics?.overall.totalResponses ?? 0} />
        <StatCard title={t('w12Patient.sat.responseRate')} value={satAnalytics?.overall.responseRate ?? 0} suffix="%" />
      </StatCardGrid>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={8}><Card size="small" title={t('w12Patient.sat.byDepartment')}>
          <DataTable rowKey="department" pagination={false} dataSource={satAnalytics?.byDepartment ?? []}
            columns={[
              { title: t('w12Patient.sat.department'), dataIndex: 'department' },
              { title: t('w12Patient.sat.responses'), dataIndex: 'responses', width: 80 },
              { title: t('w12Patient.sat.nps'), dataIndex: 'nps', width: 80, render: (v: number) => <Tag color={satNpsLevel(v)}>{v}</Tag> },
            ]} /></Card></Col>
        <Col xs={24} lg={8}><Card size="small" title={t('w12Patient.sat.byModality')}>
          <DataTable rowKey="modality" pagination={false} dataSource={satAnalytics?.byModality ?? []}
            columns={[
              { title: t('w12Patient.sat.modality'), dataIndex: 'modality' },
              { title: t('w12Patient.sat.responses'), dataIndex: 'responses', width: 80 },
              { title: t('w12Patient.sat.nps'), dataIndex: 'nps', width: 80, render: (v: number) => <Tag color={satNpsLevel(v)}>{v}</Tag> },
            ]} /></Card></Col>
        <Col xs={24} lg={8}><Card size="small" title={t('w12Patient.sat.trend')}>
          <DataTable rowKey="period" pagination={false} dataSource={satAnalytics?.trend ?? []}
            columns={[
              { title: t('w12Patient.sat.period'), dataIndex: 'period' },
              { title: t('w12Patient.sat.avgRating'), dataIndex: 'avgRating', width: 90 },
              { title: t('w12Patient.sat.nps'), dataIndex: 'nps', width: 80, render: (v: number) => <Tag color={satNpsLevel(v)}>{v}</Tag> },
            ]} /></Card></Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}><Card size="small" title={t('w12Patient.sat.comments')}>
          <List size="small" dataSource={(satAnalytics?.comments ?? []).slice(0, 12)}
            locale={{ emptyText: <Empty description={t('w12Patient.empty')} /> }}
            renderItem={(c) => (
              <List.Item>
                <Space direction="vertical" size={2} style={{ width: '100%' }}>
                  <Space wrap>
                    <Tag color={SENTIMENT_COLOR[c.sentiment]}>{t(`w12Patient.sat.sentiment.${c.sentiment}`)}</Tag>
                    <Tag>{c.department}</Tag>
                    {c.modality && <Tag>{c.modality}</Tag>}
                    {(c.tags ?? []).map((x) => <Tag key={x} color="blue">{x}</Tag>)}
                  </Space>
                  <Text>{c.comment}</Text>
                </Space>
              </List.Item>
            )} /></Card></Col>
        <Col xs={24} lg={12}><Card size="small" title={t('w12Patient.sat.surveys')}
          extra={<Space><Input value={satTitle} style={{ width: 200 }} onChange={(e) => setSatTitle(e.target.value)} /><Button loading={satBusy} onClick={() => void doCreateSurvey()}>{t('w12Patient.sat.newSurvey')}</Button></Space>}>
          <DataTable rowKey="id" pagination={{ pageSize: 6, showSizeChanger: false }} dataSource={satSurveys}
            locale={{ emptyText: <Empty description={t('w12Patient.empty')} /> }}
            columns={[
              { title: t('w12Patient.sat.surveyTitle'), dataIndex: 'title', ellipsis: true },
              { title: t('w12Patient.sat.department'), dataIndex: 'department', width: 90 },
              { title: t('w12Patient.status'), dataIndex: 'status', width: 90, render: (v: string) => <Tag color={v === 'OPEN' ? 'green' : 'default'}>{v}</Tag> },
              { title: t('w12Patient.actions'), key: 'actions', width: 110, render: (_: unknown, r: SurveyDto) => <Button size="small" type="link" onClick={() => setSatRespond(r)}>{t('w12Patient.sat.respond')}</Button> },
            ]} /></Card></Col>
      </Row>

      <Modal title={t('w12Patient.sat.respond')} open={!!satRespond} onCancel={() => setSatRespond(null)} onOk={() => void doRespond()} confirmLoading={satBusy}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text>{satRespond?.title}</Text>
          <Space><Text>{t('w12Patient.sat.rating')}</Text><InputNumber min={1} max={5} value={satRating} onChange={(v) => setSatRating(v ?? 5)} /></Space>
          <Space><Text>{t('w12Patient.sat.npsScore')}</Text><InputNumber min={0} max={10} value={satNps} onChange={(v) => setSatNps(v ?? 9)} /></Space>
          <Input.TextArea rows={3} value={satComment} onChange={(e) => setSatComment(e.target.value)} placeholder={t('w12Patient.sat.comment')} />
        </Space>
      </Modal>
    </div>
  ), [satAnalytics, satSurveys, satTitle, satRespond, satRating, satNps, satComment, satBusy])

  const selfRegTab = useMemo(() => (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={10}>
        <Card size="small" title={t('w12Patient.sr.identify')} style={{ marginBottom: 16 }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Input value={srIdCard} onChange={(e) => setSrIdCard(e.target.value)} addonBefore={t('w12Patient.sr.idCard')} />
            <Input value={srPhone} onChange={(e) => setSrPhone(e.target.value)} addonBefore={t('w12Patient.sr.phone')} />
            <Input value={srEmpi} onChange={(e) => setSrEmpi(e.target.value)} addonBefore={t('w12Patient.sr.empi')} />
            <Input value={srName} onChange={(e) => setSrName(e.target.value)} addonBefore={t('w12Patient.sr.name')} />
            <Button type="primary" loading={srBusy} onClick={() => void doIdentify()}>{t('w12Patient.sr.identifyBtn')}</Button>
          </Space>
        </Card>

        {srResult && !srResult.matched && (
          <Card size="small" title={t('w12Patient.sr.candidates')} style={{ marginBottom: 16 }}>
            <List size="small" dataSource={srResult.candidates.slice(0, 6)}
              renderItem={(p) => (
                <List.Item actions={[<Button key="s" size="small" type="link" onClick={() => { setSrSelected(p); void refreshSrStatus(p.patientId) }}>{t('w12Patient.sr.select')}</Button>]}>
                  <Text>{p.name} · {p.patientId} · {p.phone}</Text>
                </List.Item>
              )} />
          </Card>
        )}

        {srSelected && (
          <Card size="small" title={t('w12Patient.sr.matched')} style={{ marginBottom: 16 }}>
            <Descriptions size="small" column={1} bordered>
              <Descriptions.Item label={t('w12Patient.sr.name')}>{srSelected.name}</Descriptions.Item>
              <Descriptions.Item label={t('w12Patient.patientId')}>{srSelected.patientId}</Descriptions.Item>
              <Descriptions.Item label={t('w12Patient.sr.empi')}>{srSelected.empiId}</Descriptions.Item>
              <Descriptions.Item label={t('w12Patient.sr.phone')}>{srSelected.phone}</Descriptions.Item>
            </Descriptions>
          </Card>
        )}

        {srStatus && (
          <Card size="small" title={t('w12Patient.sr.status')} style={{ marginBottom: 16 }}>
            <Space wrap>
              <Tag color={srStatus.checkedIn ? 'green' : 'default'}>{srStatus.checkedIn ? t('w12Patient.sr.checkedIn') : t('w12Patient.sr.notCheckedIn')}</Tag>
              <Tag color={srStatus.questionnaireDone ? 'green' : 'default'}>{t('w12Patient.sr.questionnaireStatus')}: {srStatus.questionnaireDone ? t('w12Patient.sr.done') : t('w12Patient.sr.pending')}</Tag>
              <Tag color={srStatus.consentSigned ? 'green' : 'default'}>{t('w12Patient.sr.consentStatus')}: {srStatus.consentSigned ? t('w12Patient.sr.done') : t('w12Patient.sr.pending')}</Tag>
              {srStatus.queue && <Tag color="blue">{srStatus.queue.ticket} · {t('w12Patient.sr.room')} {srStatus.queue.room}</Tag>}
            </Space>
          </Card>
        )}

        <Card size="small" title={t('w12Patient.sr.checkIn')}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Button loading={srBusy} disabled={!srSelected} onClick={() => void doCheckIn()}>{t('w12Patient.sr.checkInBtn')}</Button>
            {srCheckIn && (
              <Alert type={srCheckIn.status === 'BLOCKED' ? 'warning' : 'success'} showIcon
                message={<Space><Tag color={CHECKIN_COLOR[srCheckIn.status]}>{t(`w12Patient.sr.checkIn.${srCheckIn.status}`)}</Tag><Text>{t('w12Patient.sr.booth')}: {srCheckIn.booth}</Text></Space>}
                description={srCheckIn.blockers.length > 0 ? `${t('w12Patient.sr.blockers')}: ${srCheckIn.blockers.join('、')}` : undefined} />
            )}
          </Space>
        </Card>
      </Col>

      <Col xs={24} lg={14}>
        <Card size="small" title={t('w12Patient.sr.questionnaire')} style={{ marginBottom: 16 }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Input value={srAllergies} onChange={(e) => setSrAllergies(e.target.value)} addonBefore={t('w12Patient.sr.allergies')} />
            <Input value={srImplants} onChange={(e) => setSrImplants(e.target.value)} addonBefore={t('w12Patient.sr.implants')} />
            <Space wrap>
              <Select value={srPregnant ? 'yes' : 'no'} style={{ width: 160 }} onChange={(v) => setSrPregnant(v === 'yes')}
                options={[{ value: 'no', label: `${t('w12Patient.sr.pregnant')}: ${t('w12Patient.sr.pending')}` }, { value: 'yes', label: `${t('w12Patient.sr.pregnant')}: ${t('w12Patient.sr.done')}` }]} />
              <Select value={srFasting ? 'yes' : 'no'} style={{ width: 220 }} onChange={(v) => setSrFasting(v === 'yes')}
                options={[{ value: 'yes', label: `${t('w12Patient.sr.fasting')}: ${t('w12Patient.sr.done')}` }, { value: 'no', label: `${t('w12Patient.sr.fasting')}: ${t('w12Patient.sr.pending')}` }]} />
              <Select value={srClaustrophobia ? 'yes' : 'no'} style={{ width: 180 }} onChange={(v) => setSrClaustrophobia(v === 'yes')}
                options={[{ value: 'no', label: `${t('w12Patient.sr.claustrophobia')}: ${t('w12Patient.sr.pending')}` }, { value: 'yes', label: `${t('w12Patient.sr.claustrophobia')}: ${t('w12Patient.sr.done')}` }]} />
            </Space>
            <Button loading={srBusy} disabled={!srSelected} onClick={() => void doQuestionnaire()}>{t('w12Patient.sr.submitQuestionnaire')}</Button>
            {srQuestionnaire && (
              <Alert type={srQuestionnaire.riskLevel === 'HIGH' ? 'error' : srQuestionnaire.riskLevel === 'MEDIUM' ? 'warning' : 'success'} showIcon
                message={<Space><Tag color={RISK_COLOR[srQuestionnaire.riskLevel]}>{t('w12Patient.sr.riskLevel')}: {t(`w12Patient.sr.risk.${srQuestionnaire.riskLevel}`)}</Tag></Space>}
                description={<div>{srQuestionnaire.riskNotes.map((n) => <div key={n}>{n}</div>)}<div style={{ marginTop: 6 }}>{t('w12Patient.sr.prepItems')}: {srQuestionnaire.prepItems.map((p) => p.label).join('；')}</div></div>} />
            )}
          </Space>
        </Card>

        <Card size="small" title={t('w12Patient.sr.consent')} style={{ marginBottom: 16 }}>
          <Space wrap>
            <Input value={srSignature} style={{ width: 180 }} onChange={(e) => setSrSignature(e.target.value)} addonBefore={t('w12Patient.sr.signature')} />
            <Button loading={srBusy} disabled={!srSelected} onClick={() => void doConsent()}>{t('w12Patient.sr.sign')}</Button>
          </Space>
        </Card>

        <Card size="small" title={t('w12Patient.sr.queueNumber')}>
          <Space wrap style={{ marginBottom: 12 }}>
            <Select value={srModality} style={{ width: 110 }} onChange={setSrModality} options={['CT', 'MR', 'DR', 'US', 'MG'].map((v) => ({ value: v, label: v }))} />
            <Select value={srPriority} style={{ width: 130 }} onChange={setSrPriority}
              options={(['NORMAL', 'URGENT', 'EMERGENCY'] as const).map((v) => ({ value: v, label: t(`w12Patient.sr.priority.${v}`) }))} />
            <Button type="primary" loading={srBusy} disabled={!srSelected} onClick={() => void doQueue()}>{t('w12Patient.sr.queueBtn')}</Button>
          </Space>
          {srQueue && (
            <Descriptions size="small" column={2} bordered>
              <Descriptions.Item label={t('w12Patient.sr.ticket')}><Text strong>{srQueue.ticket}</Text></Descriptions.Item>
              <Descriptions.Item label={t('w12Patient.sr.position')}>{srQueue.position}</Descriptions.Item>
              <Descriptions.Item label={t('w12Patient.sr.room')}>{srQueue.room}</Descriptions.Item>
              <Descriptions.Item label={t('w12Patient.sr.waitMinutes')}>{srQueue.estimatedWaitMinutes}</Descriptions.Item>
            </Descriptions>
          )}
        </Card>
      </Col>
    </Row>
  ), [srIdCard, srPhone, srEmpi, srName, srResult, srSelected, srCheckIn, srQuestionnaire, srStatus, srQueue, srAllergies, srPregnant, srFasting, srImplants, srClaustrophobia, srSignature, srModality, srPriority, srBusy])

  return (
    <PageContainer padding={24}>
      <Space style={{ marginBottom: 16 }} wrap>
        <span style={{ fontSize: 18, fontWeight: 600 }}>{t('w12Patient.title')}</span>
        <Tag color="cyan">W12</Tag>
        <Tag color={source === 'api' ? 'green' : 'orange'}>{source === 'api' ? t('w12Patient.sourceApi') : t('w12Patient.sourceDemo')}</Tag>
        <Button icon={<RefreshCw size={14} />} loading={loading} onClick={() => void loadAll()}>{t('w12Patient.refresh')}</Button>
      </Space>
      <div style={{ marginBottom: 16, color: 'var(--text-secondary)', fontSize: 13 }}>{t('w12Patient.subtitle')}</div>

      <Tabs activeKey={tab} onChange={setTab} items={[
        { key: 'wechat', label: t('w12Patient.tab.wechat'), children: wechatTab },
        { key: 'payment', label: t('w12Patient.tab.payment'), children: paymentTab },
        { key: 'notification', label: t('w12Patient.tab.notification'), children: notificationTab },
        { key: 'satisfaction', label: t('w12Patient.tab.satisfaction'), children: satisfactionTab },
        { key: 'selfReg', label: t('w12Patient.tab.selfReg'), children: selfRegTab },
      ]} />
    </PageContainer>
  )
}
