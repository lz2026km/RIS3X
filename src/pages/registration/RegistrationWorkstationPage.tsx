import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Card, Row, Col, Input, Button, Select, Table, Descriptions, Checkbox, InputNumber,
  Tag, Space, message, Alert, Divider, Typography, Empty, List,
} from 'antd'
import {
  ScanLine, UserCheck, CreditCard, ShieldAlert, Siren, ClipboardCheck, FileSignature, RefreshCw,
} from 'lucide-react'
import { t } from '../../i18n/appI18n'
import { StatCard, StatCardGrid, PageContainer } from '../../components/common'
import {
  registrationApi,
  type ScanResultDto, type PrepItemDto, type PrepConfirmResultDto,
  type ConsentRecordDto, type ChargeDto,
} from '../../services/api/registrationApi'
import { triageApi, type TriageScoreResult, type VitalSigns } from '../../services/api/triageApi'
import type { ClinicalProfileDto, RegistrationPatientDto } from '../../types/dto'

const { Text, Title } = Typography

type ChargeItem = ChargeDto['items'][number]

const DEFAULT_PREP: PrepItemDto[] = [
  { key: 'identity', label: '患者身份双标识核对 (姓名 + 证件号)', required: true, checked: false },
  { key: 'order', label: '申请单与检查项目核对', required: true, checked: false },
  { key: 'consent', label: '知情同意已签署', required: true, checked: false },
  { key: 'allergy', label: '过敏史 / 对比剂禁忌评估', required: true, checked: false },
  { key: 'pregnancy', label: '育龄女性妊娠状态确认', required: true, checked: false },
  { key: 'renal', label: '肾功能 (eGFR) 评估', required: false, checked: false },
  { key: 'isolation', label: '隔离 / 感染防护确认', required: false, checked: false },
  { key: 'prep', label: '检查前准备 (禁食/肠道准备/金属物品)', required: false, checked: false },
  { key: 'barcode', label: '条码 / 腕带打印', required: false, checked: false },
]

const NURSES = [
  { value: 'N001', label: t('w6Reg.triage.nurseA') },
  { value: 'N002', label: t('w6Reg.triage.nurseB') },
  { value: 'N003', label: t('w6Reg.triage.nurseC') },
]

const idTypeLabel: Record<string, string> = {
  ID_CARD: 'w6Reg.identity.idCard',
  PASSPORT: 'w6Reg.identity.passport',
  OFFICER_CARD: 'w6Reg.identity.officerCard',
  BIRTH_CERT: 'w6Reg.identity.birthCert',
  OTHER: 'w6Reg.identity.other',
}

const isolationLabel: Record<string, string> = {
  NONE: 'w6Reg.safety.isolation.none',
  CONTACT: 'w6Reg.safety.isolation.contact',
  DROPLET: 'w6Reg.safety.isolation.droplet',
  AIRBORNE: 'w6Reg.safety.isolation.airborne',
  PROTECTIVE: 'w6Reg.safety.isolation.protective',
}

const pregLabel: Record<string, string> = {
  NONE: 'w6Reg.safety.preg.none',
  PREGNANT: 'w6Reg.safety.preg.pregnant',
  UNKNOWN: 'w6Reg.safety.preg.unknown',
  NOT_APPLICABLE: 'w6Reg.safety.preg.notApplicable',
  POSTPARTUM: 'w6Reg.safety.preg.postpartum',
}

const chargeStatusLabel: Record<string, string> = {
  UNPAID: 'w6Reg.charge.unpaid',
  PARTIAL: 'w6Reg.charge.partial',
  PAID: 'w6Reg.charge.paidStatus',
}

export function esiLabel(level?: number): string {
  if (!level) return '-'
  return t(`w6Reg.triage.esi${level}`)
}

const RegistrationWorkstationPage: React.FC = () => {
  const [scanCode, setScanCode] = useState('')
  const [scanType, setScanType] = useState<string | undefined>(undefined)
  const [scanResult, setScanResult] = useState<ScanResultDto | null>(null)
  const [scanning, setScanning] = useState(false)

  const [patient, setPatient] = useState<RegistrationPatientDto | null>(null)
  const [profile, setProfile] = useState<ClinicalProfileDto | null>(null)
  const [vitals, setVitals] = useState<VitalSigns>({})
  const [prepItems, setPrepItems] = useState<PrepItemDto[]>(DEFAULT_PREP)
  const [prepResult, setPrepResult] = useState<PrepConfirmResultDto | null>(null)
  const [prepSaving, setPrepSaving] = useState(false)

  const [consentType, setConsentType] = useState('registration')
  const [consentProcedure, setConsentProcedure] = useState('影像检查登记')
  const [consentSignedBy, setConsentSignedBy] = useState('')
  const [consentWitness, setConsentWitness] = useState('')
  const [consentAgreed, setConsentAgreed] = useState(true)
  const [consentList, setConsentList] = useState<ConsentRecordDto[]>([])

  const [charge, setCharge] = useState<ChargeDto | null>(null)
  const [payMethod, setPayMethod] = useState('CASH')
  const [paying, setPaying] = useState(false)

  const [nurseId, setNurseId] = useState<string | undefined>(undefined)
  const [triageResult, setTriageResult] = useState<TriageScoreResult | null>(null)
  const [triaging, setTriaging] = useState(false)

  const visitId = patient ? `V-${patient.patientId}` : ''
  const examId = patient ? `EXAM-REG-${patient.patientId}` : ''

  const selectPatient = useCallback(async (p: RegistrationPatientDto) => {
    setPatient(p)
    setVitals({ ...p.vitals })
    setPrepItems(DEFAULT_PREP.map((i) => ({ ...i })))
    setPrepResult(null)
    setConsentList([])
    setTriageResult(null)
    const visit = `V-${p.patientId}`
    try {
      const res = await registrationApi.getClinicalProfile(p.patientId)
      if (res.success && res.data) {
        setProfile(res.data)
        setVitals({ ...res.data.vitals })
      }
    } catch {
      setProfile(null)
    }
    try {
      const res = await registrationApi.getCharge(visit)
      if (res.success && res.data) setCharge(res.data)
    } catch {
      setCharge(null)
    }
  }, [])

  const doScan = useCallback(async (code?: string) => {
    const q = (code ?? scanCode).trim()
    if (!q) {
      message.warning(t('w6Reg.scan.placeholder'))
      return
    }
    setScanning(true)
    try {
      const res = await registrationApi.scan(q, scanType)
      if (res.success && res.data) {
        setScanResult(res.data)
        if (res.data.matched) {
          await selectPatient(res.data.matched)
          message.success(`${t('w6Reg.scan.matcher')}: ${res.data.matched.name}`)
        } else {
          message.info(t('w6Reg.scan.noMatch'))
        }
      } else {
        message.error(res.error?.message ?? t('w6Reg.loadFailed'))
      }
    } catch {
      message.error(t('w6Reg.loadFailed'))
    } finally {
      setScanning(false)
    }
  }, [scanCode, scanType, selectPatient])

  // 默认载入演示患者, 保证页面首屏即有内容 (确定性)
  useEffect(() => {
    doScan('110101196803120011')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const togglePrep = (key: string, checked: boolean) => {
    setPrepItems((items) => items.map((i) => (i.key === key ? { ...i, checked } : i)))
  }

  const submitPrep = async () => {
    if (!patient) return
    setPrepSaving(true)
    try {
      const res = await registrationApi.prepConfirm(visitId, { items: prepItems })
      if (res.success && res.data) {
        setPrepResult(res.data)
        if (res.data.allRequiredChecked) message.success(t('w6Reg.prep.success'))
        else message.warning(t('w6Reg.prep.pending'))
      } else {
        message.error(res.error?.message ?? t('w6Reg.saveFailed'))
      }
    } catch {
      message.error(t('w6Reg.saveFailed'))
    } finally {
      setPrepSaving(false)
    }
  }

  const submitConsent = async () => {
    if (!patient) return
    try {
      const res = await registrationApi.consent(visitId, {
        patientId: patient.patientId,
        consentType,
        procedure: consentProcedure,
        agreed: consentAgreed,
        signedBy: consentSignedBy || patient.name,
        witnessName: consentWitness || undefined,
      })
      if (res.success && res.data) {
        setConsentList((l) => [...l, res.data])
        message.success(t('w6Reg.consent.success'))
      } else {
        message.error(res.error?.message ?? t('w6Reg.saveFailed'))
      }
    } catch {
      message.error(t('w6Reg.saveFailed'))
    }
  }

  const pay = async () => {
    if (!patient || !charge) return
    setPaying(true)
    try {
      const res = await registrationApi.pay(visitId, { amount: charge.balance, method: payMethod })
      if (res.success && res.data) {
        setCharge(res.data)
        message.success(t('w6Reg.charge.success'))
      } else {
        message.error(res.error?.message ?? t('w6Reg.saveFailed'))
      }
    } catch {
      message.error(t('w6Reg.saveFailed'))
    } finally {
      setPaying(false)
    }
  }

  const suggestEsi = useCallback(async (): Promise<TriageScoreResult | null> => {
    if (!patient) return null
    const res = await triageApi.reTriage({
      examId,
      patientId: patient.patientId,
      patientName: patient.name,
      examType: 'CT',
      vitals,
    })
    if (res.success && res.data) {
      setTriageResult(res.data)
      return res.data
    }
    return null
  }, [patient, examId, vitals])

  const submitTriage = async () => {
    if (!patient) return
    setTriaging(true)
    try {
      const result = await suggestEsi()
      if (nurseId) {
        const nurse = NURSES.find((n) => n.value === nurseId)
        await triageApi.assignNurse(examId, nurseId, nurse?.label)
      }
      if (result) message.success(t('w6Reg.triage.success'))
      else message.error(t('w6Reg.loadFailed'))
    } catch {
      message.error(t('w6Reg.loadFailed'))
    } finally {
      setTriaging(false)
    }
  }

  const esiColor = (esi?: number) => (esi === 1 ? '#cf1322' : esi === 2 ? '#fa541c' : esi === 3 ? '#fa8c16' : esi === 4 ? '#1677ff' : '#52c41a')

  const allergyRisk = (profile?.structuredAllergyCodes?.length ?? 0) > 0
  const egfrValue = profile?.renalFunction?.egfr
  const renalHighRisk = typeof egfrValue === 'number' && egfrValue < 30
  const renalCaution = typeof egfrValue === 'number' && egfrValue >= 30 && egfrValue < 60
  const pregnancyAlert = profile?.pregnancyStatus === 'PREGNANT'

  const chargeColumns = useMemo(() => [
    { title: t('w6Reg.charge.item'), dataIndex: 'name', key: 'name' },
    { title: t('w6Reg.charge.category'), dataIndex: 'category', key: 'category' },
    { title: t('w6Reg.charge.price'), dataIndex: 'unitPrice', key: 'unitPrice', render: (v: number) => `¥${v}` },
    { title: t('w6Reg.charge.qty'), dataIndex: 'quantity', key: 'quantity' },
    { title: t('w6Reg.charge.amount'), dataIndex: 'amount', key: 'amount', render: (v: number) => `¥${v}` },
    { title: t('w6Reg.charge.insurance'), dataIndex: 'insuranceEligible', key: 'insuranceEligible', render: (v: boolean) => (v ? <Tag color="green">{t('w6Reg.yes')}</Tag> : <Tag>{t('w6Reg.no')}</Tag>) },
  ], [])

  const vitalsFields: Array<{ key: keyof VitalSigns; label: string; min: number; max: number }> = [
    { key: 'systolicBp', label: t('w6Reg.safety.bp'), min: 0, max: 400 },
    { key: 'heartRate', label: t('w6Reg.safety.hr'), min: 0, max: 400 },
    { key: 'temperature', label: t('w6Reg.safety.temp'), min: 25, max: 45 },
    { key: 'spo2', label: t('w6Reg.safety.spo2'), min: 0, max: 100 },
    { key: 'respiratoryRate', label: t('w6Reg.safety.rr'), min: 0, max: 80 },
  ]

  return (
    <PageContainer padding={24} data-testid="registration-page">
      <Card style={{ marginBottom: 16 }}>
        <Space align="center" style={{ marginBottom: 4 }}>
          <ClipboardCheck size={24} color="#1e40af" />
          <Title level={4} style={{ margin: 0 }}>{t('w6Reg.title')}</Title>
          <Tag color="blue">G005 W6</Tag>
        </Space>
        <div><Text type="secondary">{t('w6Reg.subtitle')}</Text></div>
        <Space size={[8, 8]} wrap style={{ marginTop: 8 }}>
          <Tag>{t('w6Reg.step.search')}</Tag>
          <Tag>{t('w6Reg.step.identity')}</Tag>
          <Tag>{t('w6Reg.step.prep')}</Tag>
          <Tag>{t('w6Reg.step.consent')}</Tag>
          <Tag>{t('w6Reg.step.safety')}</Tag>
          <Tag>{t('w6Reg.step.charge')}</Tag>
          <Tag>{t('w6Reg.step.triage')}</Tag>
        </Space>
      </Card>

      <Row gutter={16}>
        <Col xs={24} lg={8}>
          <Card
            title={<Space><ScanLine size={16} />{t('w6Reg.scan.title')}</Space>}
            style={{ marginBottom: 16 }}
          >
            <Text type="secondary" style={{ fontSize: 12 }}>{t('w6Reg.scan.subtitle')}</Text>
            <Input
              style={{ marginTop: 8 }}
              placeholder={t('w6Reg.scan.placeholder')}
              value={scanCode}
              onChange={(e) => setScanCode(e.target.value)}
              onPressEnter={() => doScan()}
              allowClear
              data-testid="registration-scan-input"
            />
            <Space style={{ marginTop: 8, width: '100%' }} wrap>
              <Select
                placeholder={t('w6Reg.scan.type')}
                value={scanType}
                onChange={setScanType}
                allowClear
                style={{ width: 120 }}
                options={[
                  { value: 'BARCODE', label: '条码' },
                  { value: 'QR', label: '二维码' },
                  { value: 'ID_CARD', label: t('w6Reg.identity.idCard') },
                  { value: 'EMPI', label: 'EMPI' },
                  { value: 'PHONE', label: t('w6Reg.identity.phone') },
                ]}
              />
              <Button type="primary" icon={<ScanLine size={14} />} loading={scanning} onClick={() => doScan()} data-testid="registration-scan-btn">
                {t('w6Reg.scan.button')}
              </Button>
            </Space>
            <div style={{ marginTop: 6 }}><Text type="secondary" style={{ fontSize: 12 }}>{t('w6Reg.scan.hint')}</Text></div>

            {scanResult && (
              <>
                <Divider style={{ margin: '12px 0' }} />
                <Space size={4} wrap>
                  <Tag color={scanResult.source === 'db' ? 'green' : 'gold'}>{scanResult.source === 'db' ? t('w6Reg.scan.sourceDb') : t('w6Reg.scan.sourceSeed')}</Tag>
                  <Tag>{t('w6Reg.scan.type')}: {scanResult.type}</Tag>
                </Space>
                <div style={{ marginTop: 8 }}>
                  <Text strong>{t('w6Reg.scan.candidates')} ({scanResult.candidates.length})</Text>
                  {scanResult.candidates.length === 0 ? (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('w6Reg.scan.noMatch')} />
                  ) : (
                    <List
                      size="small"
                      dataSource={scanResult.candidates}
                      renderItem={(p) => (
                        <List.Item
                          actions={[<Button key="s" size="small" type="link" onClick={() => selectPatient(p)}>{t('w6Reg.scan.select')}</Button>]}
                        >
                          <List.Item.Meta
                            title={<Text strong>{p.name}</Text>}
                            description={`${p.empiId} · ${p.idType === 'ID_CARD' ? t('w6Reg.identity.idCard') : p.idType} · ${p.documentNo}`}
                          />
                        </List.Item>
                      )}
                    />
                  )}
                </div>
              </>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={16}>
          {!patient ? (
            <Card><Empty description={t('w6Reg.identity.empty')} /></Card>
          ) : (
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              {/* 身份卡 */}
              <Card title={<Space><UserCheck size={16} />{t('w6Reg.identity.title')}</Space>} extra={<Tag color="blue">{visitId}</Tag>}>
                <Descriptions column={3} size="small" bordered>
                  <Descriptions.Item label={t('w6Reg.identity.name')}>{patient.name}</Descriptions.Item>
                  <Descriptions.Item label={t('w6Reg.identity.gender')}>{patient.gender === 'MALE' ? '男' : patient.gender === 'FEMALE' ? '女' : t('w6Reg.unknown')}</Descriptions.Item>
                  <Descriptions.Item label={t('w6Reg.identity.age')}>{patient.age}</Descriptions.Item>
                  <Descriptions.Item label={t('w6Reg.identity.idType')}>{t(idTypeLabel[patient.idType] ?? patient.idType)}</Descriptions.Item>
                  <Descriptions.Item label={t('w6Reg.identity.documentNo')}>{patient.documentNo}</Descriptions.Item>
                  <Descriptions.Item label={t('w6Reg.identity.empiId')}><Tag color="purple">{patient.empiId}</Tag></Descriptions.Item>
                  <Descriptions.Item label={t('w6Reg.identity.insuranceNo')}>{patient.insuranceNo ?? '-'}</Descriptions.Item>
                  <Descriptions.Item label={t('w6Reg.identity.phone')}>{patient.phone ?? '-'}</Descriptions.Item>
                  <Descriptions.Item label={t('w6Reg.safety.isolation')}>
                    <Tag color={patient.isolationFlag === 'NONE' ? 'default' : 'red'}>{t(isolationLabel[patient.isolationFlag] ?? patient.isolationFlag)}</Tag>
                  </Descriptions.Item>
                </Descriptions>
              </Card>

              <Row gutter={16}>
                {/* 准备项 */}
                <Col span={12}>
                  <Card
                    title={<Space><ClipboardCheck size={16} />{t('w6Reg.prep.title')}</Space>}
                    extra={<Text type="secondary" style={{ fontSize: 12 }}>{t('w6Reg.prep.subtitle')}</Text>}
                  >
                    <Space direction="vertical" size={4} style={{ width: '100%' }}>
                      {prepItems.map((item) => (
                        <Checkbox
                          key={item.key}
                          checked={item.checked}
                          onChange={(e) => togglePrep(item.key, e.target.checked)}
                          data-testid={`prep-${item.key}`}
                        >
                          <span>{item.label}</span>
                          <Tag style={{ marginLeft: 8 }} color={item.required ? 'red' : 'default'}>
                            {item.required ? t('w6Reg.prep.required') : t('w6Reg.prep.optional')}
                          </Tag>
                        </Checkbox>
                      ))}
                    </Space>
                    <Divider style={{ margin: '12px 0' }} />
                    <Space>
                      <Button type="primary" loading={prepSaving} onClick={submitPrep} data-testid="prep-confirm-btn">
                        {t('w6Reg.prep.confirm')}
                      </Button>
                      {prepResult && (
                        prepResult.allRequiredChecked
                          ? <Tag color="green">{t('w6Reg.prep.allRequired')}</Tag>
                          : <Tag color="orange">{t('w6Reg.prep.pending')} ({prepResult.pendingKeys.length})</Tag>
                      )}
                    </Space>
                  </Card>
                </Col>

                {/* 知情同意 */}
                <Col span={12}>
                  <Card title={<Space><FileSignature size={16} />{t('w6Reg.consent.title')}</Space>}>
                    <Space direction="vertical" size={8} style={{ width: '100%' }}>
                      <div>
                        <Text style={{ fontSize: 12 }}>{t('w6Reg.consent.type')}</Text>
                        <Select
                          style={{ width: '100%' }}
                          value={consentType}
                          onChange={setConsentType}
                          options={[
                            { value: 'registration', label: t('w6Reg.consent.registration') },
                            { value: 'contrast', label: t('w6Reg.consent.contrast') },
                            { value: 'mri', label: t('w6Reg.consent.mri') },
                          ]}
                        />
                      </div>
                      <div>
                        <Text style={{ fontSize: 12 }}>{t('w6Reg.consent.procedure')}</Text>
                        <Input value={consentProcedure} onChange={(e) => setConsentProcedure(e.target.value)} />
                      </div>
                      <Row gutter={8}>
                        <Col span={12}>
                          <Text style={{ fontSize: 12 }}>{t('w6Reg.consent.signedBy')}</Text>
                          <Input value={consentSignedBy} onChange={(e) => setConsentSignedBy(e.target.value)} placeholder={patient.name} />
                        </Col>
                        <Col span={12}>
                          <Text style={{ fontSize: 12 }}>{t('w6Reg.consent.witness')}</Text>
                          <Input value={consentWitness} onChange={(e) => setConsentWitness(e.target.value)} />
                        </Col>
                      </Row>
                      <Checkbox checked={consentAgreed} onChange={(e) => setConsentAgreed(e.target.checked)}>{t('w6Reg.consent.agreed')}</Checkbox>
                      <Button type="primary" onClick={submitConsent} data-testid="consent-submit-btn">{t('w6Reg.consent.submit')}</Button>
                      {consentList.length > 0 && (
                        <List
                          size="small"
                          header={<Text style={{ fontSize: 12 }}>{t('w6Reg.consent.list')}</Text>}
                          dataSource={consentList}
                          renderItem={(c) => (
                            <List.Item>
                              <Tag color={c.status === 'signed' ? 'green' : 'red'}>{c.status === 'signed' ? t('w6Reg.consent.signed') : t('w6Reg.consent.refused')}</Tag>
                              <Text style={{ fontSize: 12 }}>{c.procedure}</Text>
                            </List.Item>
                          )}
                        />
                      )}
                    </Space>
                  </Card>
                </Col>
              </Row>

              {/* 对比剂安全 */}
              <Card title={<Space><ShieldAlert size={16} />{t('w6Reg.safety.title')}</Space>}>
                <Row gutter={16}>
                  <Col span={8}>
                    <Descriptions column={1} size="small">
                      <Descriptions.Item label={t('w6Reg.safety.allergy')}>
                        {allergyRisk
                          ? profile!.structuredAllergyCodes.map((a) => (
                              <Tag color="red" key={a.code}>{a.display} ({a.code})</Tag>
                            ))
                          : <Tag color="green">{t('w6Reg.safety.noAllergy')}</Tag>}
                      </Descriptions.Item>
                      <Descriptions.Item label={t('w6Reg.safety.pregnancy')}>
                        <Tag color={pregnancyAlert ? 'red' : 'default'}>{t(pregLabel[profile?.pregnancyStatus ?? 'UNKNOWN'] ?? 'w6Reg.safety.preg.unknown')}</Tag>
                      </Descriptions.Item>
                      <Descriptions.Item label={t('w6Reg.safety.isolation')}>
                        <Tag color={(profile?.isolationFlag ?? 'NONE') === 'NONE' ? 'default' : 'orange'}>
                          {t(isolationLabel[profile?.isolationFlag ?? 'NONE'] ?? 'w6Reg.safety.isolation.none')}
                        </Tag>
                      </Descriptions.Item>
                    </Descriptions>
                  </Col>
                  <Col span={8}>
                    <Space direction="vertical" size={2}>
                      <StatCard title={t('w6Reg.safety.egfr')} value={egfrValue ?? '-'} suffix="mL/min" size="sm" variant="compact" bordered={false} color={renalHighRisk ? 'error' : renalCaution ? 'warning' : 'success'} />
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {t('w6Reg.safety.creatinine')}: {profile?.renalFunction?.creatinine ?? '-'} μm ol/L · {t('w6Reg.safety.egfrSource')}: {profile?.renalFunction?.egfrSource ?? '-'}
                      </Text>
                    </Space>
                  </Col>
                  <Col span={8}>
                    <Space size={4} wrap>
                      <Tag>{t('patientForm.heightCm')}: {profile?.heightCm ?? '-'}</Tag>
                      <Tag>{t('patientForm.weightKg')}: {profile?.weightKg ?? '-'}</Tag>
                      <Tag color="blue">BMI: {profile?.bmi ?? '-'}</Tag>
                    </Space>
                  </Col>
                </Row>
                {renalHighRisk && <Alert style={{ marginTop: 8 }} type="error" showIcon message={t('w6Reg.safety.highRisk')} />}
                {!renalHighRisk && renalCaution && <Alert style={{ marginTop: 8 }} type="warning" showIcon message={t('w6Reg.safety.renalCaution')} />}
                {pregnancyAlert && <Alert style={{ marginTop: 8 }} type="warning" showIcon message={t('w6Reg.safety.pregnancyAlert')} />}
                {allergyRisk && <Alert style={{ marginTop: 8 }} type="error" showIcon message={t('w6Reg.safety.allergyAlert')} />}
              </Card>

              {/* 缴费 */}
              <Card
                title={<Space><CreditCard size={16} />{t('w6Reg.charge.title')}</Space>}
                extra={charge ? (
                  <Space>
                    <Text type="secondary">{charge.visitNumber}</Text>
                    <Tag color={charge.status === 'PAID' ? 'green' : charge.status === 'PARTIAL' ? 'gold' : 'red'}>
                      {t(chargeStatusLabel[charge.status] ?? charge.status)}
                    </Tag>
                  </Space>
                ) : null}
              >
                {charge ? (
                  <>
                    <Table
                      size="small"
                      rowKey="code"
                      dataSource={charge.items as ChargeItem[]}
                      columns={chargeColumns}
                      pagination={false}
                    />
                    <StatCardGrid minWidth={150} gap={16} style={{ marginTop: 12 }}>
                      <StatCard title={t('w6Reg.charge.total')} value={charge.totalAmount} prefix="¥" size="sm" />
                      <StatCard title={t('w6Reg.charge.insurance')} value={charge.insuranceAmount} prefix="¥" size="sm" />
                      <StatCard title={t('w6Reg.charge.selfPay')} value={charge.selfPayAmount} prefix="¥" size="sm" />
                      <StatCard title={t('w6Reg.charge.paid')} value={charge.paidAmount} prefix="¥" size="sm" color="success" />
                      <StatCard title={t('w6Reg.charge.balance')} value={charge.balance} prefix="¥" size="sm" color={charge.balance > 0 ? 'error' : 'success'} />
                    </StatCardGrid>
                    <Space style={{ marginTop: 12 }}>
                      <Select
                        value={payMethod}
                        onChange={setPayMethod}
                        style={{ width: 140 }}
                        options={[
                          { value: 'CASH', label: t('w6Reg.charge.cash') },
                          { value: 'CARD', label: t('w6Reg.charge.card') },
                          { value: 'INSURANCE', label: t('w6Reg.charge.insurancePay') },
                          { value: 'WECHAT', label: t('w6Reg.charge.wechat') },
                        ]}
                      />
                      <Button type="primary" loading={paying} disabled={charge.balance <= 0} onClick={pay} data-testid="charge-pay-btn">
                        {t('w6Reg.charge.pay')} ¥{charge.balance}
                      </Button>
                    </Space>
                  </>
                ) : <Empty description={t('w6Reg.charge.empty')} />}
              </Card>

              {/* 分诊 */}
              <Card
                title={<Space><Siren size={16} />{t('w6Reg.triage.title')}</Space>}
                extra={<Text type="secondary" style={{ fontSize: 12 }}>{t('w6Reg.triage.subtitle')}</Text>}
              >
                <Row gutter={16}>
                  <Col span={12}>
                    <Text strong>{t('w6Reg.safety.vitals')}</Text>
                    <Row gutter={[8, 8]} style={{ marginTop: 8 }}>
                      {vitalsFields.map((f) => (
                        <Col span={12} key={f.key}>
                          <Text style={{ fontSize: 12 }}>{f.label}</Text>
                          <InputNumber
                            style={{ width: '100%' }}
                            min={f.min}
                            max={f.max}
                            value={vitals[f.key] as number | undefined}
                            onChange={(v) => setVitals((prev) => ({ ...prev, [f.key]: v ?? undefined }))}
                          />
                        </Col>
                      ))}
                    </Row>
                    <Space style={{ marginTop: 12 }}>
                      <Select
                        style={{ width: 180 }}
                        placeholder={t('w6Reg.triage.selectNurse')}
                        value={nurseId}
                        onChange={setNurseId}
                        allowClear
                        options={NURSES}
                        data-testid="triage-nurse-select"
                      />
                      <Button onClick={async () => { const r = await suggestEsi(); if (r) message.info(esiLabel(r.esiLevel)) }} data-testid="triage-esi-btn">
                        {t('w6Reg.triage.esi')}
                      </Button>
                      <Button type="primary" icon={<Siren size={14} />} loading={triaging} onClick={submitTriage} data-testid="triage-submit-btn">
                        {t('w6Reg.triage.submit')}
                      </Button>
                    </Space>
                  </Col>
                  <Col span={12}>
                    {triageResult ? (
                      <Space direction="vertical" size={8} style={{ width: '100%' }}>
                        <Space>
                          <Text strong>{t('w6Reg.triage.esi')}:</Text>
                          <Tag color={esiColor(triageResult.esiLevel)}>{esiLabel(triageResult.esiLevel)}</Tag>
                          {triageResult.reTriageRecommended && <Tag color="red">{t('w6Reg.triage.reTriageRequired')}</Tag>}
                        </Space>
                        <Space>
                          <Text>{t('w6Reg.triage.score')}: <Tag>{triageResult.score}</Tag></Text>
                          <Text>{t('w6Reg.triage.queuePriority')}: <Tag color="volcano">{triageResult.queuePriority ?? '-'}</Tag></Text>
                        </Space>
                        {triageResult.vitalsBreaches && triageResult.vitalsBreaches.length > 0 && (
                          <Alert type="warning" showIcon message={t('w6Reg.triage.breach')} description={triageResult.vitalsBreaches.join('；')} />
                        )}
                        {triageResult.reTriageAt && <Text type="secondary" style={{ fontSize: 12 }}>{t('w6Reg.triage.reTriageAt')}: {new Date(triageResult.reTriageAt).toLocaleString()}</Text>}
                        {nurseId && <Text type="secondary">{t('w6Reg.triage.nurse')}: {NURSES.find((n) => n.value === nurseId)?.label}</Text>}
                        <Text type="secondary" style={{ fontSize: 12 }}>{t('w6Reg.triage.autoSuggested')}</Text>
                      </Space>
                    ) : (
                      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('w6Reg.triage.autoSuggested')} />
                    )}
                  </Col>
                </Row>
              </Card>

              <div style={{ textAlign: 'right' }}>
                <Button icon={<RefreshCw size={14} />} onClick={() => patient && selectPatient(patient)}>{t('w6Reg.refresh')}</Button>
              </div>
            </Space>
          )}
        </Col>
      </Row>
    </PageContainer>
  )
}

export default RegistrationWorkstationPage
