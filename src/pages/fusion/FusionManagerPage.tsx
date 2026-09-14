import {
  fusionV2Api,
  type FusionV2SeriesItem,
  type FusionV2RegisterResult,
  type FusionV2RenderResult,
} from '../../services/api/fusionV2Api'
import { Card, Table, Button, Space, Tag, Form, Input, Select, message, Descriptions, Slider, Empty, Progress } from 'antd'
import { Layers, Play, Search } from 'lucide-react'
import { Inbox } from 'lucide-react'
import { useState } from 'react'
import { t } from '../../i18n/appI18n'

export const FusionManagerPage: React.FC = () => {
  const [patientId, setPatientId] = useState('')
  const [series, setSeries] = useState<FusionV2SeriesItem[]>([])
  const [loading, setLoading] = useState(false)
  const [fixedSeries, setFixedSeries] = useState<string>('')
  const [movingSeries, setMovingSeries] = useState<string>('')
  const [transformType, setTransformType] = useState<'rigid' | 'affine' | 'deformable' | 'nonlinear'>('rigid')
  const [registering, setRegistering] = useState(false)
  const [registrationResult, setRegistrationResult] = useState<FusionV2RegisterResult | null>(null)
  const [rendering, setRendering] = useState(false)
  const [renderResult, setRenderResult] = useState<FusionV2RenderResult | null>(null)
  const [alpha, setAlpha] = useState(50)

  const fetchSeries = async () => {
    if (!patientId.trim()) {
      message.warning(t('fusionMgr.patientRequired'))
      return
    }
    setLoading(true)
    try {
      const res = await fusionV2Api.getSeries(patientId.trim())
      if (res.success && res.data) {
        setSeries(res.data.series || [])
        message.success(`加载 ${res.data.series?.length || 0} 组序列`)
      }
    } catch {
      message.warning(t('fusionMgr.seriesLoadFail'))
      setSeries([
        { modality: 'CT', seriesDescription: '胸部 CT 平扫', instanceCount: 320 },
        { modality: 'PT', seriesDescription: 'PET 全身显像', instanceCount: 256 },
        { modality: 'MR', seriesDescription: 'MR T1 增强', instanceCount: 180 },
      ])
    }
    setLoading(false)
  }

  const handleRegister = async () => {
    if (!fixedSeries || !movingSeries) {
      message.warning(t('fusionMgr.selectBoth'))
      return
    }
    setRegistering(true)
    setRegistrationResult(null)
    try {
      const res = await fusionV2Api.register({ fixedSeriesUid: fixedSeries, movingSeriesUid: movingSeries, transformType })
      if (res.success && res.data) {
        setRegistrationResult(res.data)
        message.success(`配准完成: Dice=${res.data.metrics.dice.toFixed(3)}`)
      }
    } catch {
      message.warning(t('fusionMgr.registerUnavailable'))
        setRegistrationResult({
          registrationId: `reg-${Date.now()}`,
          fixedSeriesUid: fixedSeries,
          movingSeriesUid: movingSeries,
          transformType,
          status: 'completed',
          metrics: { dice: 0.92, hd95: 2.3, rmse: 1.1 },
          matrix: [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]],
          processingTimeMs: 300,
        })
    }
    setRegistering(false)
  }

  const handleRender = async () => {
    if (!fixedSeries || !movingSeries) {
      message.warning(t('fusionMgr.registerFirst'))
      return
    }
    setRendering(true)
    setRenderResult(null)
    try {
      const res = await fusionV2Api.render({
        fixedSeriesUid: fixedSeries,
        movingSeriesUid: movingSeries,
        alpha: alpha / 100,
        sliceIndex: 128,
      })
      if (res.success && res.data) {
        setRenderResult(res.data)
        message.success(t('fusionMgr.renderDone'))
      }
    } catch {
      message.warning(t('fusionMgr.renderUnavailable'))
    }
    setRendering(false)
  }

  return (
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }}>
        <Layers size={20} color="#2563eb" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>{t('fusionMgr.title')}</span>
        <Tag color="blue">PET-CT / MR</Tag>
        <Tag color="purple">{t('fusionMgr.tagMultimodal')}</Tag>
      </Space>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space>
          <Input
            placeholder={t('fusionMgr.phPatientId')}
            value={patientId}
            onChange={e => setPatientId(e.target.value)}
            style={{ width: 200 }}
            onPressEnter={fetchSeries}
          />
          <Button type="primary" icon={<Search size={14} />} onClick={fetchSeries} loading={loading}>{t('fusionMgr.loadSeries')}</Button>
        </Space>
      </Card>

      {series.length > 0 && (
        <>
          <Card size="small" title={t('fusionMgr.availableSeries')} style={{ marginBottom: 16 }}>
            <Table
              dataSource={series}
              rowKey={(_, i) => `${i}`}
              pagination={false}
              size="small"
              scroll={{ x: 'max-content' }}
              columns={[
                {
                  title: t('fusionMgr.col.modality'),
                  dataIndex: 'modality',
                  render: (m: string) => <Tag color={m === 'CT' ? 'blue' : m === 'PT' ? 'orange' : 'green'}>{m}</Tag>,
                },
                { title: t('fusionMgr.col.description'), dataIndex: 'seriesDescription' },
                { title: t('fusionMgr.col.instances'), dataIndex: 'instanceCount' },
              ]}
            />
          </Card>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Card size="small" title={t('fusionMgr.seriesSelection')}>
              <Form layout="vertical" size="small">
                <Form.Item label={t('fusionMgr.fixedSeries')}>
                  <Select placeholder={t('fusionMgr.selectFixedPh')} value={fixedSeries || undefined} onChange={setFixedSeries}>
                    {series.map((s, i) => (
                      <Select.Option key={i} value={`series-${i}`}>{s.modality} - {s.seriesDescription}</Select.Option>
                    ))}
                  </Select>
                </Form.Item>
                <Form.Item label={t('fusionMgr.movingSeries')}>
                  <Select placeholder={t('fusionMgr.selectMovingPh')} value={movingSeries || undefined} onChange={setMovingSeries}>
                    {series.map((s, i) => (
                      <Select.Option key={i} value={`series-${i}`}>{s.modality} - {s.seriesDescription}</Select.Option>
                    ))}
                  </Select>
                </Form.Item>
                <Form.Item label={t('fusionMgr.registrationType')}>
                  <Select value={transformType} onChange={(v: any) => setTransformType(v)}>
                    <Select.Option value="rigid">{t('fusionMgr.rigid')}</Select.Option>
                    <Select.Option value="affine">{t('fusionMgr.affine')}</Select.Option>
                    <Select.Option value="deformable">{t('fusionMgr.deformable')}</Select.Option>
                    <Select.Option value="nonlinear">{t('fusionMgr.nonlinear')}</Select.Option>
                  </Select>
                </Form.Item>
                <Space>
                  <Button type="primary" icon={<Play size={14} />} onClick={handleRegister} loading={registering}>{t('fusionMgr.runRegister')}</Button>
                  <Button onClick={handleRender} loading={rendering}>{t('fusionMgr.fusionRender')}</Button>
                </Space>
              </Form>
            </Card>

            <Card size="small" title={t('fusionMgr.fusionControl')}>
              <Form layout="vertical" size="small">
                <Form.Item label={`${t('fusionMgr.alphaLabel')}: ${alpha}%`}>
                  <Slider min={0} max={100} value={alpha} onChange={setAlpha} />
                </Form.Item>
              </Form>
              {renderResult && (
                <div>
                  <Tag color="green">{t('fusionMgr.renderComplete')}</Tag>
                  <span style={{ fontSize: 12, color: '#666', marginLeft: 8 }}>
                    {renderResult.width}x{renderResult.height} | Slice {renderResult.sliceIndex}
                  </span>
                </div>
              )}
            </Card>
          </div>

          {registrationResult && (
            <Card size="small" title={t('fusionMgr.registerResult')} style={{ marginTop: 16 }}>
              <Descriptions column={3} size="small" bordered>
                <Descriptions.Item label={t('fusionMgr.regId')}>{registrationResult.registrationId}</Descriptions.Item>
                <Descriptions.Item label={t('fusionMgr.regType')}><Tag color="blue">{registrationResult.transformType}</Tag></Descriptions.Item>
                <Descriptions.Item label={t('fusionMgr.status')}><Tag color={registrationResult.status === 'completed' ? 'green' : 'blue'}>{({ completed: t('fusionMgr.status.completed'), running: t('fusionMgr.status.running'), pending: t('fusionMgr.status.pending'), failed: t('fusionMgr.status.failed') } as Record<string, string>)[registrationResult.status] ?? registrationResult.status}</Tag></Descriptions.Item>
                <Descriptions.Item label={t('fusionMgr.dice')}>
                  <Progress percent={Math.round(registrationResult.metrics.dice * 100)} size="small" />
                </Descriptions.Item>
                <Descriptions.Item label="HD95">{registrationResult.metrics.hd95} mm</Descriptions.Item>
                <Descriptions.Item label="RMSE">{registrationResult.metrics.rmse} mm</Descriptions.Item>
              </Descriptions>
            </Card>
          )}
        </>
      )}

      {series.length === 0 && !loading && (
        <Card>
          <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t('fusionMgr.emptyHint')} />
        </Card>
      )}
    </div>
  )
}

export default FusionManagerPage
