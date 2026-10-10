/**
 * G005 RIS v3.0.6.11-101 Wave 6A F8 - 报告水印签章 V2 (/report-v2/watermark)
 * 水印预览 (参数滑块: 透明度/旋转/间距/字号) + 图像水印 (医院 LOGO 概念) + 防篡改校验码
 * 电子签名: 申请/审批/驳回/撤销 + 签署记录时间线
 * 数据源: reportSignV2Api (后端 /report-sign-v2 或演示回退)
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Droplets,
  CheckCircle2,
  XCircle,
  Undo2,
  FileSignature,
  Database,
  ShieldCheck,
  Lock,
  History,
  Stamp,
} from 'lucide-react'
import {
  Button,
  Tag,
  Space,
  Modal,
  Form,
  Input,
  Select,
  Slider,
  Switch,
  message,
  Empty,
  Card,
  Tabs,
  Timeline,
  Drawer,
  InputNumber,
  Alert,
} from "antd";
import type { ColumnsType } from 'antd/es/table'
import { PageContainer } from '../../components/common/PageContainer'
import { PageHeader } from '../../components/common/PageHeader'
import { ErrorBanner } from '../../components/feedback'
import { StatCard, StatCardGrid } from '../../components/common/StatCard'
import { t } from '../../i18n/appI18n'
import { toneToAntd } from '../../theme/statusTokens'
import {
  reportSignV2Api,
  WATERMARK_POSITION_LABELS,
  SIGN_KIND_LABELS,
  SIGN_STATUS_LABELS,
  SIGNER_OPTIONS,
  SIGN_REPORT_OPTIONS,
  type WatermarkConfig,
  type WatermarkPreview,
  type WatermarkVerifyResult,
  type SignRequest,
  type SignStats,
  type SignKind,
  type SignStatus,
  type WatermarkPosition,
} from '../../services/api/reportSignV2Api'

const POSITION_OPTIONS = Object.entries(WATERMARK_POSITION_LABELS).map(([value, label]) => ({ value, label }))
const STATUS_COLORS: Record<string, string> = { pending: toneToAntd('pending'), approved: toneToAntd('approved'), rejected: toneToAntd('rejected'), cancelled: toneToAntd('cancelled') }
const KIND_COLORS: Record<string, string> = { doctor: 'blue', reviewer: 'purple', 'co-signer': 'magenta' }

const ACTOR = { id: 'u-001', name: '张主任' }

const REPORT_TEXT = `放射影像诊断报告
姓名: 王某   性别: 女   年龄: 52 岁   检查号: RPT-1001
检查项目: 胸部 CT 平扫增强
影像所见: 双侧胸廓对称。右肺上叶见一直径约 5mm 磨玻璃结节影, 边缘清晰。左肺下叶见少许纤维条索影。
诊断结论: 右肺上叶磨玻璃结节, 考虑炎性结节可能性大。
结论: 右肺上叶磨玻璃结节, 建议定期复查。
报告医生: 李医生    审核医生: 张主任`

const fmtTime = (s?: string) => (s ? s.replace('T', ' ').slice(0, 19) : '-')

const DEFAULT_PREVIEW_STYLE: React.CSSProperties = {
  position: 'absolute',
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
  fontWeight: 600,
  letterSpacing: 2,
}

export default function ReportWatermarkPage() {
  const [source, setSource] = useState<'database' | 'demo' | 'offline'>('demo')
  const [config, setConfig] = useState<WatermarkConfig>({
    version: 2,
    text: { content: 'G005 放射影像诊断报告 · 内部资料', position: 'tile', rotation: -30, opacity: 0.12, spacing: 160, fontSize: 16 },
    image: { enabled: false, logoKey: 'hospital-logo', logoName: '示例医院 LOGO (概念数据)', scale: 0.25, position: 'bottom-right', opacity: 0.35 },
  })
  const [preview, setPreview] = useState<WatermarkPreview | null>(null)
  const [verifyText, setVerifyText] = useState('')
  const [verifyInput, setVerifyInput] = useState('')
  const [verifyResult, setVerifyResult] = useState<WatermarkVerifyResult | null>(null)

  // 签署
  const [signs, setSigns] = useState<SignRequest[]>([])
  const [signStats, setSignStats] = useState<SignStats | null>(null)
  const [signLoading, setSignLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [applyOpen, setApplyOpen] = useState(false)
  const [applyForm] = Form.useForm()
  const [rejecting, setRejecting] = useState<SignRequest | null>(null)
  const [rejectForm] = Form.useForm()
  const [actingId, setActingId] = useState('')
  const [modalSaving, setModalSaving] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [detail, setDetail] = useState<SignRequest | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const loadConfig = useCallback(async () => {
    const res = await reportSignV2Api.getWatermarkConfig().catch(() => null)
    if (res?.success && res.data?.data) {
      setConfig(res.data.data)
      setSource(res.data.source)
      setLoadError(null)
    } else {
      setSource('offline')
      setLoadError(t('w9.states.error'))
    }
  }, [])

  const loadSigns = useCallback(async () => {
    setSignLoading(true)
    const [listRes, statsRes] = await Promise.all([
      reportSignV2Api.listSigns().catch(() => null),
      reportSignV2Api.getSignStats().catch(() => null),
    ])
    if (listRes?.success && listRes.data?.data) {
      setSigns(listRes.data.data)
      setSource(listRes.data.source)
    } else {
      setLoadError(t('w9.states.error'))
      message.warning(t('reportWatermark.signRecordsLoadFailed'))
    }
    if (statsRes?.success && statsRes.data?.data) setSignStats(statsRes.data.data)
    setSignLoading(false)
  }, [])

  useEffect(() => {
    void loadConfig()
    void loadSigns()
  }, [loadConfig, loadSigns])

  const refreshPreview = useCallback(async () => {
    const res = await reportSignV2Api
      .previewWatermark({ reportId: 'RPT-1001', text: REPORT_TEXT, config })
      .catch(() => null)
    if (res?.success && res.data) setPreview(res.data)
  }, [config])

  useEffect(() => {
    void refreshPreview()
  }, [refreshPreview])

  const runVerify = async () => {
    setVerifying(true)
    try {
      const res = await reportSignV2Api
        .verifyWatermark({
          reportId: 'RPT-1001',
          text: verifyText,
          config,
          contentHash: preview?.contentHash,
          tamperCode: verifyInput || preview?.tamperCode,
        })
        .catch(() => null)
      if (res?.success && res.data) {
        setVerifyResult(res.data)
        message[res.data.valid ? 'success' : 'error'](res.data.valid ? t('reportWatermark.verifyMsg') : t('reportWatermark.verifyMsgFail'))
      }
    } finally {
      setVerifying(false)
    }
  }

  const openApply = () => {
    applyForm.resetFields()
    applyForm.setFieldsValue({ reportId: 'RPT-1001', kind: 'co-signer', signerId: 'u-001', applicantId: ACTOR.id })
    setApplyOpen(true)
  }

  const submitApply = async () => {
    setModalSaving(true)
    try {
      const values = await applyForm.validateFields()
      const res = await reportSignV2Api
        .applySign({
          reportId: values.reportId,
          reportTitle: SIGN_REPORT_OPTIONS.find((o) => o.value === values.reportId)?.label.split(' ')[1],
          kind: values.kind as SignKind,
          signerId: values.signerId,
          applicantId: values.applicantId,
          reason: values.reason,
          reportText: REPORT_TEXT,
        })
        .catch(() => null)
      if (res?.success) {
        message.success(t('reportWatermark.applySubmitted', { id: res.data.id, hash: res.data.reportHash }))
        setApplyOpen(false)
        void loadSigns()
      } else {
        message.error(t('reportWatermark.applyFailed'))
      }
    } finally {
      setModalSaving(false)
    }
  }

  const doApprove = async (sign: SignRequest) => {
    setActingId(sign.id)
    try {
      const res = await reportSignV2Api.approveSign(sign.id, { note: '同意', actorId: ACTOR.id }).catch(() => null)
      if (res?.success) {
        message.success(t('reportWatermark.approvedSigned', { name: res.data.signedByName }))
        void loadSigns()
      } else message.error(t('reportWatermark.approveFailed'))
    } finally {
      setActingId('')
    }
  }

  const doReject = async () => {
    if (!rejecting) return
    setModalSaving(true)
    try {
      const values = await rejectForm.validateFields()
      const res = await reportSignV2Api.rejectSign(rejecting.id, { reason: values.reason, actorId: ACTOR.id }).catch(() => null)
      if (res?.success) {
        message.success(t('reportWatermark.rejected'))
        setRejecting(null)
        void loadSigns()
      } else message.error(t('reportWatermark.rejectFailed'))
    } finally {
      setModalSaving(false)
    }
  }

  const doCancel = async (sign: SignRequest) => {
    setActingId(sign.id)
    try {
      const res = await reportSignV2Api.cancelSign(sign.id, { reason: '申请撤销', actorId: ACTOR.id }).catch(() => null)
      if (res?.success) {
        message.success(t('reportWatermark.cancelled'))
        void loadSigns()
      } else message.error(t('reportWatermark.cancelFailed'))
    } finally {
      setActingId('')
    }
  }

  const openDetail = async (sign: SignRequest) => {
    const res = await reportSignV2Api.getSign(sign.id).catch(() => null)
    if (res?.success && res.data) {
      setDetail(res.data)
      setDetailOpen(true)
    } else message.error(t('reportWatermark.detailLoadFailed'))
  }

  // 平铺水印渲染: 基于 preview.tiles + 容器宽高
  const watermarkLayer = useMemo(() => {
    if (!preview) return null
    const t = config.text
    const tiles = preview.tiles
    return tiles.map((tile, i) => (
      <span
        key={`t-${i}`}
        style={{
          ...DEFAULT_PREVIEW_STYLE,
          left: tile.x,
          top: tile.y,
          transform: `translate(-50%, -50%) rotate(${tile.rotation}deg)`,
          fontSize: t.fontSize,
          color: `rgba(30, 41, 59, ${t.opacity})`,
        }}
      >
        {t.content}
      </span>
    ))
  }, [preview, config.text])

  const logoLayer = useMemo(() => {
    const img = config.image
    if (!img.enabled) return null
    const posMap: Record<WatermarkPosition, React.CSSProperties> = {
      center: { left: '50%', top: '50%' },
      'top-left': { left: '4%', top: '4%' },
      'top-right': { right: '4%', top: '4%' },
      'bottom-left': { left: '4%', bottom: '4%' },
      'bottom-right': { right: '4%', bottom: '4%' },
      tile: { left: '50%', top: '50%' },
    }
    return (
      <div
        style={{
          ...posMap[img.position],
          position: 'absolute',
          width: 120,
          height: 120,
          opacity: img.opacity,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: 16,
            border: '2px dashed #6366f1',
            background: 'linear-gradient(135deg, rgba(99,102,241,.25), rgba(168,85,247,.25))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#4f46e5',
            fontSize: 11,
            textAlign: 'center',
            padding: 'var(--space-1, 4px)',
          }}
        >
          {img.logoName}
        </div>
      </div>
    )
  }, [config.image])

  const signColumns: ColumnsType<SignRequest> = [
    { title: t('reportWatermark.thApplyId'), dataIndex: 'id', width: 90, render: (id: string) => <Tag>{id}</Tag> },
    { title: t('reportWatermark.thReport'), dataIndex: 'reportTitle', width: 170 },
    {
      title: t('reportWatermark.thType'),
      dataIndex: 'kind',
      width: 110,
      render: (k: SignKind) => <Tag color={KIND_COLORS[k]}>{SIGN_KIND_LABELS[k]}</Tag>,
    },
    { title: t('reportWatermark.thApplicant'), dataIndex: 'applicantName', width: 90 },
    { title: t('reportWatermark.thSigner'), dataIndex: 'signerName', width: 90 },
    {
      title: t('reportWatermark.thStatus'),
      dataIndex: 'status',
      width: 90,
      render: (s: SignStatus) => <Tag color={STATUS_COLORS[s]}>{SIGN_STATUS_LABELS[s]}</Tag>,
    },
    { title: t('reportWatermark.thHash'), dataIndex: 'reportHash', width: 130, render: (h: string) => <code>{h}</code> },
    { title: t('reportWatermark.thSignedAt'), dataIndex: 'signedAt', width: 150, render: fmtTime },
    {
      title: t('reportWatermark.thActions'),
      key: 'action',
      width: 180,
      render: (_, sign) => (
        <Space size={4}>
          <Button size="small" onClick={() => void openDetail(sign)}>
            {t('reportWatermark.record')}
          </Button>
          {sign.status === 'pending' && (
            <>
              <Button size="small" type="primary" icon={<CheckCircle2 size={13} />} loading={actingId === sign.id} disabled={actingId === sign.id} onClick={() => void doApprove(sign)}>
                {t('reportWatermark.approve')}
              </Button>
              <Button size="small" danger icon={<XCircle size={13} />} onClick={() => setRejecting(sign)}>
                {t('reportWatermark.reject')}
              </Button>
              <Button size="small" icon={<Undo2 size={13} />} loading={actingId === sign.id} disabled={actingId === sign.id} onClick={() => void doCancel(sign)}>
                {t('reportWatermark.cancel')}
              </Button>
            </>
          )}
        </Space>
      ),
    },
  ]

  const statsCards = useMemo(
    () => [
      { label: t('reportWatermark.kpiTotal'), value: signStats?.total ?? 0, icon: <FileSignature size={18} />, color: 'var(--color-primary-500)' },
      { label: t('reportWatermark.kpiPending'), value: signStats?.pending ?? 0, icon: <History size={18} />, color: 'var(--color-warning-500)' },
      { label: t('reportWatermark.kpiSigned'), value: signStats?.approved ?? 0, icon: <CheckCircle2 size={18} />, color: '#10b981' },
      { label: t('reportWatermark.kpiToday'), value: signStats?.signedToday ?? 0, icon: <Stamp size={18} />, color: '#8b5cf6' },
    ],
    [signStats],
  )

  return (
    <PageContainer>
      <PageHeader
        title={t('reportWatermark.title')}
        subtitle={t('reportWatermark.subtitle')}
        icon={<Droplets size={22} />}
        variant="flex"
        actions={
          <Space>
            <Tag color={source === 'database' ? 'green' : source === 'demo' ? 'blue' : 'red'} icon={<Database size={12} />}>
              {source === 'database' ? t('common.api.database') : source === 'demo' ? t('common.api.demoSeed') : t('common.api.offline')}
            </Tag>
            <Button icon={<FileSignature size={14} />} type="primary" onClick={openApply}>
              {t('reportWatermark.applySign')}
            </Button>
          </Space>
        }
      />

      {loadError && <ErrorBanner message={loadError} onRetry={() => { void loadConfig(); void loadSigns(); }} retryLabel={t('w9.states.retry')} />}

      <Tabs
        defaultActiveKey="watermark"
        items={[
          {
            key: 'watermark',
            label: t('reportWatermark.tabWatermark'),
            children: (
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <Card size="small" title={t('reportWatermark.previewTitle')} extra={<Tag color="purple">{t('reportWatermark.algTag', { version: config.version })}</Tag>}>
                  <div
                    style={{
                      position: 'relative',
                      height: 360,
                      overflow: 'hidden',
                      borderRadius: 8,
                      border: '1px solid var(--border-color, #e5e7eb)',
                      background: 'linear-gradient(180deg, #ffffff, #f3f4f6)',
                      padding: 'var(--space-4, 16px)',
                    }}
                  >
                    <div style={{ whiteSpace: 'pre-wrap', fontSize: 12, color: '#1f2937', lineHeight: 1.9, maxWidth: 620 }}>
                      {REPORT_TEXT}
                    </div>
                    {watermarkLayer}
                    {logoLayer}
                  </div>
                  <div style={{ marginTop: 'var(--space-2, 8px)', display: 'flex', gap: 'var(--space-4, 16px)', flexWrap: 'wrap' }}>
                    <Space>
                      <Lock size={14} color="#10b981" />
                      <span style={{ fontSize: 12, color: '#666' }}>{t('reportWatermark.tamperCode')}</span>
                      <code style={{ fontSize: 12 }}>{preview?.tamperCode ?? '-'}</code>
                    </Space>
                    <Space>
                      <ShieldCheck size={14} color="var(--color-primary-500)" />
                      <span style={{ fontSize: 12, color: '#666' }}>{t('reportWatermark.paramHash')}</span>
                      <code style={{ fontSize: 12 }}>{(preview?.contentHash ?? '').slice(0, 16)}...</code>
                    </Space>
                  </div>
                </Card>

                <Space size={12} align="start" style={{ width: '100%' }} wrap>
                  <Card size="small" title={t('reportWatermark.textParams')} style={{ width: 460 }}>
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <div>
                        <div style={{ fontSize: 12, color: '#888' }}>{t('reportWatermark.content')}</div>
                        <Input
                          value={config.text.content}
                          onChange={(e) => setConfig((prev) => ({ ...prev, text: { ...prev.text, content: e.target.value } }))}
                        />
                      </div>
                      <div>
                        <div style={{ fontSize: 12, color: '#888' }}>{t('reportWatermark.position')}</div>
                        <Select
                          style={{ width: '100%' }}
                          value={config.text.position}
                          options={POSITION_OPTIONS}
                          onChange={(v) => setConfig((prev) => ({ ...prev, text: { ...prev.text, position: v } }))}
                        />
                      </div>
                      <div>
                        <div style={{ fontSize: 12, color: '#888' }}>{t('reportWatermark.rotation', { value: config.text.rotation })}</div>
                        <Slider min={-180} max={180} value={config.text.rotation} onChange={(v) => setConfig((prev) => ({ ...prev, text: { ...prev.text, rotation: v } }))} />
                      </div>
                      <div>
                        <div style={{ fontSize: 12, color: '#888' }}>{t('reportWatermark.opacity', { value: Math.round(config.text.opacity * 100) })}</div>
                        <Slider min={5} max={100} value={Math.round(config.text.opacity * 100)} onChange={(v) => setConfig((prev) => ({ ...prev, text: { ...prev.text, opacity: v / 100 } }))} />
                      </div>
                      <div>
                        <div style={{ fontSize: 12, color: '#888' }}>{t('reportWatermark.spacing', { value: config.text.spacing })}</div>
                        <Slider min={40} max={400} value={config.text.spacing} onChange={(v) => setConfig((prev) => ({ ...prev, text: { ...prev.text, spacing: v } }))} />
                      </div>
                      <div>
                        <div style={{ fontSize: 12, color: '#888' }}>{t('reportWatermark.fontSize', { value: config.text.fontSize })}</div>
                        <Slider min={8} max={48} value={config.text.fontSize} onChange={(v) => setConfig((prev) => ({ ...prev, text: { ...prev.text, fontSize: v } }))} />
                      </div>
                    </Space>
                  </Card>

                  <Card size="small" title={t('reportWatermark.imageParams')} style={{ width: 380 }}>
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Space>
                        <Switch checked={config.image.enabled} onChange={(v) => setConfig((prev) => ({ ...prev, image: { ...prev.image, enabled: v } }))} />
                        <span>{t('reportWatermark.enableImage')}</span>
                      </Space>
                      <div>
                        <div style={{ fontSize: 12, color: '#888' }}>{t('reportWatermark.logoResource')}</div>
                        <Input value={config.image.logoKey} onChange={(e) => setConfig((prev) => ({ ...prev, image: { ...prev.image, logoKey: e.target.value } }))} />
                      </div>
                      <div>
                        <div style={{ fontSize: 12, color: '#888' }}>{t('reportWatermark.position')}</div>
                        <Select
                          style={{ width: '100%' }}
                          value={config.image.position}
                          options={POSITION_OPTIONS}
                          onChange={(v) => setConfig((prev) => ({ ...prev, image: { ...prev.image, position: v } }))}
                        />
                      </div>
                      <div>
                        <div style={{ fontSize: 12, color: '#888' }}>{t('reportWatermark.scale', { value: Math.round(config.image.scale * 100) })}</div>
                        <Slider min={5} max={100} value={Math.round(config.image.scale * 100)} onChange={(v) => setConfig((prev) => ({ ...prev, image: { ...prev.image, scale: v / 100 } }))} />
                      </div>
                      <div>
                        <div style={{ fontSize: 12, color: '#888' }}>{t('reportWatermark.opacity', { value: Math.round(config.image.opacity * 100) })}</div>
                        <Slider min={5} max={100} value={Math.round(config.image.opacity * 100)} onChange={(v) => setConfig((prev) => ({ ...prev, image: { ...prev.image, opacity: v / 100 } }))} />
                      </div>
                      <InputNumber size="small" value={config.image.scale} min={0.05} max={1} step={0.05} style={{ display: 'none' }} />
                    </Space>
                  </Card>
                </Space>

                <Card size="small" title={t('reportWatermark.verifyTitle')}>
                  <Space direction="vertical" size={8} style={{ width: '100%' }}>
                    <Space wrap>
                      <Input
                        style={{ width: 380 }}
                        placeholder={t('reportWatermark.verifyPlaceholder')}
                        value={verifyText}
                        onChange={(e) => setVerifyText(e.target.value)}
                      />
                      <Input style={{ width: 200 }} placeholder={t('reportWatermark.codePlaceholder')} value={verifyInput} onChange={(e) => setVerifyInput(e.target.value)} />
                      <Button icon={<ShieldCheck size={14} />} loading={verifying} disabled={verifying} onClick={() => void runVerify()}>
                        {t('reportWatermark.verifyHash')}
                      </Button>
                    </Space>
                    {verifyResult && (
                      <Alert
                        type={verifyResult.valid ? 'success' : 'error'}
                        message={
                          verifyResult.valid
                            ? t('reportWatermark.verifyOk')
                            : t('reportWatermark.verifyFail', { content: verifyResult.tamperOk ? '' : t('reportWatermark.tamperedContent'), params: verifyResult.contentHashOk ? '' : t('reportWatermark.tamperedParams') })
                        }
                        description={t('reportWatermark.verifyDesc', { code: verifyResult.computedTamperCode, hash: verifyResult.computedContentHash.slice(0, 16) })}
                        showIcon
                      />
                    )}
                  </Space>
                </Card>
              </Space>
            ),
          },
          {
            key: 'sign',
            label: t('reportWatermark.tabSign', { count: signStats?.pending ?? 0 }),
            children: (
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <StatCardGrid gap={12}>
                  {statsCards.map((s, i) => (
                    <StatCard key={i} title={s.label} value={s.value} icon={s.icon} color={s.color} />
                  ))}
                </StatCardGrid>
                <Card
                  size="small"
                  title={t('reportWatermark.signTitle')}
                  extra={
                    <Button size="small" type="primary" icon={<FileSignature size={13} />} onClick={openApply}>
                      {t('reportWatermark.newApply')}
                    </Button>
                  }
                >
                  <DataTable rowKey="id" loading={signLoading} columns={signColumns} dataSource={signs} pagination={{ pageSize: 6 }} scroll={{ x: 1000 }} />
                </Card>
              </Space>
            ),
          },
        ]}
      />

      {/* 签名申请 */}
        <Modal title={t('reportWatermark.applyModalTitle')} open={applyOpen} onCancel={() => setApplyOpen(false)} onOk={() => void submitApply()} confirmLoading={modalSaving}>
        <Form form={applyForm} layout="vertical">
          <Form.Item name="reportId" label={t('reportWatermark.fldReport')} rules={[{ required: true }]}>
            <Select options={SIGN_REPORT_OPTIONS} />
          </Form.Item>
          <Form.Item name="kind" label={t('reportWatermark.fldKind')} rules={[{ required: true }]}>
            <Select options={Object.entries(SIGN_KIND_LABELS).map(([value, label]) => ({ value, label }))} />
          </Form.Item>
          <Form.Item name="signerId" label={t('reportWatermark.fldSigner')} rules={[{ required: true }]}>
            <Select options={SIGNER_OPTIONS} />
          </Form.Item>
          <Form.Item name="applicantId" label={t('reportWatermark.fldApplicant')} style={{ display: 'none' }}>
            <Input />
          </Form.Item>
          <Form.Item name="reason" label={t('reportWatermark.fldReason')}>
            <Input.TextArea rows={2} placeholder={t('reportWatermark.reasonPlaceholder')} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 驳回 */}
        <Modal title={t('reportWatermark.rejectModalTitle', { id: rejecting?.id ?? '' })} open={!!rejecting} onCancel={() => setRejecting(null)} onOk={() => void doReject()} confirmLoading={modalSaving}>
        <Form form={rejectForm} layout="vertical">
          <Form.Item name="reason" label={t('reportWatermark.fldRejectReason')} rules={[{ required: true, message: t('reportWatermark.rejectReasonRequired') }]}>
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 签署记录时间线 */}
      <Drawer title={t('reportWatermark.signDetailTitle', { id: detail?.id ?? '', status: detail ? SIGN_STATUS_LABELS[detail.status] : '' })} width={420} open={detailOpen} onClose={() => setDetailOpen(false)}>
        {detail && (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Alert
              type={detail.status === 'approved' ? 'success' : 'info'}
              message={t('reportWatermark.reportSignerInfo', { report: detail.reportTitle, signer: detail.signerName })}
              description={t('reportWatermark.hashSignedInfo', { hash: detail.reportHash, time: fmtTime(detail.signedAt) })}
              showIcon
            />
            <Timeline
              items={[...detail.records]
                .sort((a, b) => a.at.localeCompare(b.at))
                .map((rec) => ({
                  color: rec.action === 'approve' || rec.action === 'sign' ? 'green' : rec.action === 'reject' ? 'red' : 'blue',
                  children: (
                    <div>
                      <div style={{ fontWeight: 600 }}>
                        {rec.action === 'apply' && t('reportWatermark.tlApply')}
                        {rec.action === 'approve' && t('reportWatermark.tlApprove')}
                        {rec.action === 'sign' && t('reportWatermark.tlSign')}
                        {rec.action === 'reject' && t('reportWatermark.tlReject')}
                        {rec.action === 'cancel' && t('reportWatermark.tlCancel')}
                        <span style={{ fontWeight: 400, color: '#666', marginLeft: 'var(--space-2, 8px)' }}>{rec.actorName}</span>
                      </div>
                      <div style={{ fontSize: 12, color: '#888' }}>{rec.note}</div>
                      <div style={{ fontSize: 12, color: '#aaa' }}>{fmtTime(rec.at)}</div>
                    </div>
                  ),
                }))}
            />
            {detail.rejectReason && (
              <Alert type="error" message={t('reportWatermark.rejectReason', { reason: detail.rejectReason })} showIcon />
            )}
            {detail.approveNote && <Alert type="success" message={t('reportWatermark.approveNote', { note: detail.approveNote })} showIcon />}
          </Space>
        )}
        {!detail && <Empty description={t('reportWatermark.noRecords')} />}
      </Drawer>
    </PageContainer>
  )
}

import { DataTable } from "../../components/common";