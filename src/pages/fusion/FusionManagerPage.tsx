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
      message.warning('请输入患者 ID')
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
      message.warning('序列加载失败，使用演示数据')
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
      message.warning('请选择固定序列和移动序列')
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
      message.warning('配准服务不可用，使用演示结果')
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
      message.warning('请先完成配准')
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
        message.success('融合渲染完成')
      }
    } catch {
      message.warning('融合渲染服务不可用')
    }
    setRendering(false)
  }

  return (
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }}>
        <Layers size={20} color="#2563eb" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>融合管理</span>
        <Tag color="blue">PET-CT / MR</Tag>
        <Tag color="purple">多模态融合</Tag>
      </Space>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space>
          <Input
            placeholder="输入患者 ID"
            value={patientId}
            onChange={e => setPatientId(e.target.value)}
            style={{ width: 200 }}
            onPressEnter={fetchSeries}
          />
          <Button type="primary" icon={<Search size={14} />} onClick={fetchSeries} loading={loading}>加载序列</Button>
        </Space>
      </Card>

      {series.length > 0 && (
        <>
          <Card size="small" title="可用序列" style={{ marginBottom: 16 }}>
            <Table
              dataSource={series}
              rowKey={(_, i) => `${i}`}
              pagination={false}
              size="small"
              columns={[
                {
                  title: '设备类型',
                  dataIndex: 'modality',
                  render: (m: string) => <Tag color={m === 'CT' ? 'blue' : m === 'PT' ? 'orange' : 'green'}>{m}</Tag>,
                },
                { title: '描述', dataIndex: 'seriesDescription' },
                { title: '实例数', dataIndex: 'instanceCount' },
              ]}
            />
          </Card>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Card size="small" title="序列选择">
              <Form layout="vertical" size="small">
                <Form.Item label="固定序列 (Fixed)">
                  <Select placeholder="选择固定序列" value={fixedSeries || undefined} onChange={setFixedSeries}>
                    {series.map((s, i) => (
                      <Select.Option key={i} value={`series-${i}`}>{s.modality} - {s.seriesDescription}</Select.Option>
                    ))}
                  </Select>
                </Form.Item>
                <Form.Item label="移动序列 (Moving)">
                  <Select placeholder="选择移动序列" value={movingSeries || undefined} onChange={setMovingSeries}>
                    {series.map((s, i) => (
                      <Select.Option key={i} value={`series-${i}`}>{s.modality} - {s.seriesDescription}</Select.Option>
                    ))}
                  </Select>
                </Form.Item>
                <Form.Item label="配准类型">
                  <Select value={transformType} onChange={(v: any) => setTransformType(v)}>
                    <Select.Option value="rigid">刚性配准 (Rigid)</Select.Option>
                    <Select.Option value="affine">仿射配准 (Affine)</Select.Option>
                    <Select.Option value="deformable">形变配准 (Deformable)</Select.Option>
                    <Select.Option value="nonlinear">非线性配准 (Nonlinear)</Select.Option>
                  </Select>
                </Form.Item>
                <Space>
                  <Button type="primary" icon={<Play size={14} />} onClick={handleRegister} loading={registering}>执行配准</Button>
                  <Button onClick={handleRender} loading={rendering}>融合渲染</Button>
                </Space>
              </Form>
            </Card>

            <Card size="small" title="融合控制">
              <Form layout="vertical" size="small">
                <Form.Item label={`融合透明度: ${alpha}%`}>
                  <Slider min={0} max={100} value={alpha} onChange={setAlpha} />
                </Form.Item>
              </Form>
              {renderResult && (
                <div>
                  <Tag color="green">渲染完成</Tag>
                  <span style={{ fontSize: 12, color: '#666', marginLeft: 8 }}>
                    {renderResult.width}x{renderResult.height} | Slice {renderResult.sliceIndex}
                  </span>
                </div>
              )}
            </Card>
          </div>

          {registrationResult && (
            <Card size="small" title="配准结果" style={{ marginTop: 16 }}>
              <Descriptions column={3} size="small" bordered>
                <Descriptions.Item label="配准 ID">{registrationResult.registrationId}</Descriptions.Item>
                <Descriptions.Item label="配准类型"><Tag color="blue">{registrationResult.transformType}</Tag></Descriptions.Item>
                <Descriptions.Item label="状态"><Tag color={registrationResult.status === 'completed' ? 'green' : 'blue'}>{({ completed: '已完成', running: '进行中', pending: '待处理', failed: '失败' } as Record<string, string>)[registrationResult.status] ?? registrationResult.status}</Tag></Descriptions.Item>
                <Descriptions.Item label="Dice 系数">
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
          <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description="请输入患者 ID 并加载序列" />
        </Card>
      )}
    </div>
  )
}

export default FusionManagerPage
