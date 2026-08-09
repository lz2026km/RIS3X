import { radiomicsApi, type RadiomicsFeature, type RadiomicsResult } from '../../services/api/radiomicsApi'
import { Card, Table, Button, Space, Tag, Form, Input, Select, message, Empty } from 'antd'
import { Activity, Search, RefreshCw, Download, BarChart3 } from 'lucide-react'
import { Inbox } from 'lucide-react'
import { useState } from 'react'

export const RadiomicsFeaturePage: React.FC = () => {
  const [instanceId, setInstanceId] = useState('')
  const [features, setFeatures] = useState<RadiomicsFeature[]>([])
  const [loading, setLoading] = useState(false)
  const [roiType, setRoiType] = useState<'rectangle' | 'ellipse' | 'polygon'>('rectangle')
  const [roiCoords, setRoiCoords] = useState('10,10,100,100')
  const [extracting, setExtracting] = useState(false)
  const [compareIds, setCompareIds] = useState('')
  const [compareResults, setCompareResults] = useState<RadiomicsResult[]>([])
  const [comparing, setComparing] = useState(false)

  const fetchFeatures = async () => {
    if (!instanceId.trim()) {
      message.warning('请输入实例 ID')
      return
    }
    setLoading(true)
    try {
      const res = await radiomicsApi.getFeatures(instanceId.trim())
      if (res.success && res.data) {
        const result = typeof res.data === 'object' && 'features' in res.data ? res.data as unknown as RadiomicsResult : null
        if (result) setFeatures(result.features)
      }
    } catch {
      message.warning('特征加载失败，使用演示数据')
      setFeatures([
        { category: 'Shape', name: 'Volume', value: 1234.5, unit: 'mm³' },
        { category: 'Shape', name: 'Surface Area', value: 567.8, unit: 'mm²' },
        { category: 'Shape', name: 'Sphericity', value: 0.87, unit: '' },
        { category: 'First Order', name: 'Mean', value: 45.2, unit: 'HU' },
        { category: 'First Order', name: 'Std Dev', value: 12.3, unit: 'HU' },
        { category: 'GLCM', name: 'Contrast', value: 234.5, unit: '' },
        { category: 'GLCM', name: 'Energy', value: 0.012, unit: '' },
        { category: 'GLCM', name: 'Entropy', value: 5.67, unit: '' },
        { category: 'GLRLM', name: 'SRE', value: 0.45, unit: '' },
        { category: 'GLRLM', name: 'LRE', value: 1.23, unit: '' },
      ])
    }
    setLoading(false)
  }

  const handleExtract = async () => {
    if (!instanceId.trim()) {
      message.warning('请输入实例 ID')
      return
    }
    const coords = roiCoords.split(',').map(Number)
    if (coords.length < 4 || coords.some(isNaN)) {
      message.warning('ROI 坐标格式错误，应为: x,y,width,height')
      return
    }
    setExtracting(true)
    try {
      const res = await radiomicsApi.extract(instanceId.trim(), {
        type: roiType,
        coordinates: coords,
      })
      if (res.success) {
        message.success('特征提取完成')
        fetchFeatures()
      }
    } catch {
      message.warning('特征提取服务不可用')
    }
    setExtracting(false)
  }

  const handleCompare = async () => {
    const ids = compareIds.split(',').map(s => s.trim()).filter(Boolean)
    if (ids.length < 2) {
      message.warning('请输入至少 2 个实例 ID (逗号分隔)')
      return
    }
    setComparing(true)
    try {
      const res = await radiomicsApi.compare({
        instanceIds: ids,
        rois: ids.map(id => ({
          instanceId: id,
          type: 'rectangle' as const,
          coordinates: [10, 10, 100, 100],
        })),
      })
      if (res.success && res.data) {
        setCompareResults(Array.isArray(res.data) ? res.data : [])
        message.success(`比较完成: ${ids.length} 个实例`)
      }
    } catch {
      message.warning('比较服务不可用')
    }
    setComparing(false)
  }

  const groupedFeatures = features.reduce<Record<string, RadiomicsFeature[]>>((acc, f) => {
    if (!acc[f.category]) acc[f.category] = []
    acc[f.category].push(f)
    return acc
  }, {})

  const featureColumns = [
    { title: '分类', dataIndex: 'category', key: 'category', render: (c: string) => <Tag color="blue">{c}</Tag> },
    { title: '特征名称', dataIndex: 'name', key: 'name' },
    { title: '值', dataIndex: 'value', key: 'value', render: (v: number) => typeof v === 'number' ? v.toFixed(4) : v },
    { title: '单位', dataIndex: 'unit', key: 'unit', render: (u: string) => u || '-' },
  ]

  return (
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }}>
        <BarChart3 size={20} color="#2563eb" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>影像组学特征提取</span>
        <Tag color="blue">影像组学</Tag>
      </Space>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input
            placeholder="实例 ID"
            value={instanceId}
            onChange={e => setInstanceId(e.target.value)}
            style={{ width: 200 }}
            onPressEnter={fetchFeatures}
          />
          <Button type="primary" icon={<Search size={14} />} onClick={fetchFeatures} loading={loading}>加载特征</Button>
          <Button icon={<RefreshCw size={14} />} onClick={() => { setInstanceId(''); setFeatures([]); setCompareResults([]) }}>清空</Button>
        </Space>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <Card size="small" title="ROI 特征提取">
          <Form layout="inline" size="small">
            <Form.Item label="ROI 类型">
              <Select value={roiType} onChange={(v: any) => setRoiType(v)} style={{ width: 120 }}>
                <Select.Option value="rectangle">矩形</Select.Option>
                <Select.Option value="ellipse">椭圆</Select.Option>
                <Select.Option value="polygon">多边形</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item label="坐标">
              <Input
                placeholder="x,y,width,height"
                value={roiCoords}
                onChange={e => setRoiCoords(e.target.value)}
                style={{ width: 160 }}
              />
            </Form.Item>
            <Form.Item>
              <Button type="primary" icon={<Activity size={14} />} onClick={handleExtract} loading={extracting}>提取</Button>
            </Form.Item>
          </Form>
        </Card>

        <Card size="small" title="多实例比较">
          <Space>
            <Input
              placeholder="实例 ID (逗号分隔)"
              value={compareIds}
              onChange={e => setCompareIds(e.target.value)}
              style={{ width: 280 }}
            />
            <Button icon={<BarChart3 size={14} />} onClick={handleCompare} loading={comparing}>比较</Button>
          </Space>
        </Card>
      </div>

      {features.length > 0 && (
        <Card size="small" title={`特征结果 (${features.length})`} extra={<Button icon={<Download size={14} />} onClick={() => {
          const csv = ['Category,Name,Value,Unit', ...features.map(f => `${f.category},${f.name},${f.value},${f.unit}`)].join('\n')
          const blob = new Blob([csv], { type: 'text/csv' })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `radiomics_${instanceId || 'features'}.csv`
          a.click()
          message.success('已导出 CSV')
        }}>导出 CSV</Button>}>
          {Object.entries(groupedFeatures).map(([category, feats]) => (
            <div key={category} style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13, color: '#2563eb' }}>{category}</div>
              <Table dataSource={feats} columns={featureColumns} rowKey="name" pagination={false} size="small" scroll={{ x: 'max-content' }} />
            </div>
          ))}
        </Card>
      )}

      {compareResults.length > 0 && (
        <Card size="small" title="比较结果" style={{ marginTop: 16 }}>
          <Table
            dataSource={compareResults}
            rowKey="instanceId"
            size="small"
            pagination={false}
            scroll={{ x: 'max-content' }}
            columns={[
              { title: '实例 ID', dataIndex: 'instanceId', key: 'instanceId' },
              { title: '特征数', key: 'count', render: (_: any, r: RadiomicsResult) => r.features?.length || 0 },
              { title: '体积', key: 'volume', render: (_: any, r: RadiomicsResult) => r.features?.find(f => f.name === 'Volume')?.value?.toFixed(2) || '-' },
            ]}
          />
        </Card>
      )}

      {features.length === 0 && compareResults.length === 0 && !loading && (
        <Card>
          <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description="请输入实例 ID 并加载特征" />
        </Card>
      )}
    </div>
  )
}

export default RadiomicsFeaturePage
