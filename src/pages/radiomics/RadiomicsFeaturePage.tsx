import { radiomicsApi, type RadiomicsFeature, type RadiomicsResult } from '../../services/api/radiomicsApi'
import {
  Card,
  Button,
  Space,
  Tag,
  Form,
  Input,
  Select,
  message,
  Empty,
} from "antd";
import { Activity, Search, RefreshCw, Download, BarChart3 } from 'lucide-react'
import { Inbox } from 'lucide-react'
import { useState } from 'react'
import { t } from '../../i18n/appI18n'
import { DataTable, PageContainer } from "../../components/common"

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
      message.warning(t('radiomics.enterInstanceId'))
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
      message.warning(t('radiomics.loadFailedDemo'))
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
      message.warning(t('radiomics.enterInstanceId'))
      return
    }
    const coords = roiCoords.split(',').map(Number)
    if (coords.length < 4 || coords.some(isNaN)) {
      message.warning(t('radiomics.roiCoordInvalid'))
      return
    }
    setExtracting(true)
    try {
      const res = await radiomicsApi.extract(instanceId.trim(), {
        type: roiType,
        coordinates: coords,
      })
      if (res.success) {
        message.success(t('radiomics.extractDone'))
        fetchFeatures()
      }
    } catch {
      message.warning(t('radiomics.extractUnavailable'))
    }
    setExtracting(false)
  }

  const handleCompare = async () => {
    const ids = compareIds.split(',').map(s => s.trim()).filter(Boolean)
    if (ids.length < 2) {
      message.warning(t('radiomics.compareMinIds'))
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
      message.warning(t('radiomics.compareUnavailable'))
    }
    setComparing(false)
  }

  const groupedFeatures = features.reduce<Record<string, RadiomicsFeature[]>>((acc, f) => {
    if (!acc[f.category]) acc[f.category] = []
    acc[f.category]!.push(f)
    return acc
  }, {})

  const featureColumns = [
    { title: t('radiomics.colCategory'), dataIndex: 'category', key: 'category', render: (c: string) => <Tag color="blue">{c}</Tag> },
    { title: t('radiomics.colName'), dataIndex: 'name', key: 'name' },
    { title: t('radiomics.colValue'), dataIndex: 'value', key: 'value', render: (v: number) => typeof v === 'number' ? v.toFixed(4) : v },
    { title: t('radiomics.colUnit'), dataIndex: 'unit', key: 'unit', render: (u: string) => u || '-' },
  ]

  return (
    <PageContainer padding={24}>
      <Space style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <BarChart3 size={20} color="var(--color-primary-600)" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>{t('radiomics.title')}</span>
        <Tag color="blue">{t('radiomics.tag')}</Tag>
      </Space>

      <Card size="small" style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <Space wrap>
          <Input
            placeholder={t('radiomics.instanceIdPlaceholder')}
            value={instanceId}
            onChange={e => setInstanceId(e.target.value)}
            style={{ width: 200 }}
            onPressEnter={fetchFeatures}
          />
          <Button type="primary" icon={<Search size={14} />} onClick={fetchFeatures} loading={loading}>{t('radiomics.loadFeatures')}</Button>
          <Button icon={<RefreshCw size={14} />} onClick={() => { setInstanceId(''); setFeatures([]); setCompareResults([]) }}>{t('radiomics.clear')}</Button>
        </Space>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4, 16px)', marginBottom: 'var(--space-4, 16px)' }}>
        <Card size="small" title={t('radiomics.roiExtract')}>
          <Form layout="inline" size="small">
            <Form.Item label={t('radiomics.roiType')}>
              <Select value={roiType} onChange={(v: any) => setRoiType(v)} style={{ width: 120 }}>
                <Select.Option value="rectangle">{t('radiomics.roiRectangle')}</Select.Option>
                <Select.Option value="ellipse">{t('radiomics.roiEllipse')}</Select.Option>
                <Select.Option value="polygon">{t('radiomics.roiPolygon')}</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item label={t('radiomics.coordinates')}>
              <Input
                placeholder="x,y,width,height"
                value={roiCoords}
                onChange={e => setRoiCoords(e.target.value)}
                style={{ width: 160 }}
              />
            </Form.Item>
            <Form.Item>
              <Button type="primary" icon={<Activity size={14} />} onClick={handleExtract} loading={extracting}>{t('radiomics.extract')}</Button>
            </Form.Item>
          </Form>
        </Card>

        <Card size="small" title={t('radiomics.compareTitle')}>
          <Space>
            <Input
              placeholder={t('radiomics.compareIdsPlaceholder')}
              value={compareIds}
              onChange={e => setCompareIds(e.target.value)}
              style={{ width: 280 }}
            />
            <Button icon={<BarChart3 size={14} />} onClick={handleCompare} loading={comparing}>{t('radiomics.compare')}</Button>
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
          message.success(t('radiomics.exportedCsv'))
        }}>{t('radiomics.exportCsv')}</Button>}>
          {Object.entries(groupedFeatures).map(([category, feats]) => (
            <div key={category} style={{ marginBottom: 'var(--space-4, 16px)' }}>
              <div style={{ fontWeight: 600, marginBottom: 'var(--space-2, 8px)', fontSize: 12, color: 'var(--color-primary-600)' }}>{category}</div>
              <DataTable dataSource={feats} columns={featureColumns} rowKey="name" pagination={false} scroll={{ x: 'max-content' }} />
            </div>
          ))}
        </Card>
      )}

      {compareResults.length > 0 && (
        <Card size="small" title={t('radiomics.compareResults')} style={{ marginTop: 'var(--space-4, 16px)' }}>
          <DataTable
            dataSource={compareResults}
            rowKey="instanceId"
            pagination={false}
            scroll={{ x: 'max-content' }}
            columns={[
              { title: t('radiomics.colInstanceId'), dataIndex: 'instanceId', key: 'instanceId' },
              { title: t('radiomics.colFeatureCount'), key: 'count', render: (_: any, r: RadiomicsResult) => r.features?.length || 0 },
              { title: t('radiomics.colVolume'), key: 'volume', render: (_: any, r: RadiomicsResult) => r.features?.find(f => f.name === 'Volume')?.value?.toFixed(2) || '-' },
            ]}
          />
        </Card>
      )}

      {features.length === 0 && compareResults.length === 0 && !loading && (
        <Card>
          <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t('radiomics.emptyHint')} />
        </Card>
      )}
    </PageContainer>
  )
}

export default RadiomicsFeaturePage
