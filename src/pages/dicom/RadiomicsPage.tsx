import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { t as appT } from '../../i18n/appI18n'
import {
  Card,
  Button,
  Select,
  InputNumber,
  Space,
  Typography,
  message,
  Divider,
  Row,
  Col,
  Tag,
  Alert,
  Tabs,
} from "antd";
import { DownloadOutlined, RadarChartOutlined, PlusOutlined, DeleteOutlined, ExperimentOutlined } from '@ant-design/icons'
import { radiomicsApi, type RadiomicsFeature, type RadiomicsResult } from '../../services/api/radiomicsApi'

const { Title, Text } = Typography

type RoiType = 'rectangle' | 'ellipse' | 'polygon'

interface RoiEntry {
  key: string
  instanceId: string
  type: RoiType
  x: number
  y: number
  width: number
  height: number
}

const ROI_TYPE_OPTIONS: { value: RoiType; labelKey: string }[] = [
  { value: 'rectangle', labelKey: 'radiomics:rectangle' },
  { value: 'ellipse', labelKey: 'radiomics:ellipse' },
  { value: 'polygon', labelKey: 'radiomics:polygon' },
]

const CATEGORY_COLORS: Record<string, string> = {
  Shape: '#1890ff',
  FirstOrder: '#52c41a',
  GLCM: '#faad14',
  GLRLM: '#f5222d',
  GLSZM: '#722ed1',
  Wavelet: '#13c2c2',
}

const CATEGORY_LABEL_KEYS: Record<string, string> = {
  Shape: 'radiomics:shape',
  FirstOrder: 'radiomics:firstOrder',
  GLCM: 'radiomics:glcm',
  GLRLM: 'radiomics:glrlm',
  GLSZM: 'radiomics:glszm',
  Wavelet: 'radiomics:wavelet',
}

function csvEscape(val: string | number): string {
  const s = String(val)
  return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
}

function exportCsv(results: RadiomicsResult[]): void {
  const header = ['InstanceId', 'Category', 'Name', 'Value', 'Unit']
  const rows = results.flatMap(r => r.features.map(f => [r.instanceId, f.category, f.name, f.value, f.unit].map(csvEscape).join(',')))
  const csv = [header.join(','), ...rows].join('\n')
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `radiomics_${Date.now()}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function buildRadarDataset(results: RadiomicsResult[]): { categories: string[]; datasets: { name: string; data: number[] }[] } {
  if (!results.length) return { categories: [], datasets: [] }
  const nameSet = new Set<string>()
  results.forEach(r => r.features.forEach(f => nameSet.add(`${f.category}_${f.name}`)))
  const categories = Array.from(nameSet)
  const datasets = results.map(r => ({
    name: r.instanceId,
    data: categories.map(cat => {
      const [category, name] = cat.split('_')
      const feat = r.features.find(f => f.category === category && f.name === name)
      return feat ? feat.value : 0
    }),
  }))
  return { categories, datasets }
}

export default function RadiomicsPage() {
  const { t } = useTranslation()
  const [rois, setRois] = useState<RoiEntry[]>([
    { key: '1', instanceId: '', type: 'rectangle', x: 0, y: 0, width: 50, height: 50 },
  ])
  const [results, setResults] = useState<RadiomicsResult[]>([])
  const [extracting, setExtracting] = useState(false)
  const [compareMode, setCompareMode] = useState(false)

  const addRoi = useCallback(() => {
    setRois(prev => [...prev, { key: String(Date.now()), instanceId: '', type: 'rectangle', x: 0, y: 0, width: 50, height: 50 }])
  }, [])

  const removeRoi = useCallback((key: string) => {
    setRois(prev => prev.filter(r => r.key !== key))
  }, [])

  const updateRoi = useCallback((key: string, field: keyof RoiEntry, value: string | number) => {
    setRois(prev => prev.map(r => (r.key === key ? { ...r, [field]: value } : r)))
  }, [])

  const handleExtract = useCallback(async () => {
    setExtracting(true)
    try {
      const promises = rois.map(roi => {
        const coordinates = roi.type === 'polygon'
          ? [roi.x, roi.y, roi.x + roi.width, roi.y, roi.x + roi.width / 2, roi.y + roi.height]
          : [roi.x, roi.y, roi.width, roi.height]
        return radiomicsApi.extract(roi.instanceId, { type: roi.type, coordinates })
      })
      const responses = await Promise.all(promises)
      // [G005 P1] 双形状兼容: 后端直接返回 RadiomicsResult / 旧 { data } 包裹
      const extracted = responses.map(r => (r.data as { data?: unknown })?.data ?? r.data)
      setResults(extracted as RadiomicsResult[])
      message.success(t('radiomics:extractSuccess'))
    } catch {
      message.error(t('radiomics:extractError'))
    } finally {
      setExtracting(false)
    }
  }, [rois, t])

  const handleCompare = useCallback(async () => {
    if (results.length < 2) {
      message.warning(appT('w9d.radiomics.needTwoRoi'))
      return
    }
    setCompareMode(true)
  }, [results])

  const handleExportCsv = useCallback(() => {
    if (!results.length) return
    exportCsv(results)
    message.success(t('radiomics:exportSuccess'))
  }, [results, t])

  const featureColumns = [
    { title: t('radiomics:category'), dataIndex: 'category', key: 'category',
      render: (cat: string) => <Tag color={CATEGORY_COLORS[cat] || '#999'}>{t(CATEGORY_LABEL_KEYS[cat] || cat)}</Tag> },
    { title: t('radiomics:name'), dataIndex: 'name', key: 'name' },
    { title: t('radiomics:value'), dataIndex: 'value', key: 'value', align: 'right' as const,
      render: (v: number) => v.toFixed(2) },
    { title: t('radiomics:unit'), dataIndex: 'unit', key: 'unit' },
  ]

  const allFeatures = results.flatMap(r => r.features)
  const radarData = buildRadarDataset(results)
  const radarConfig = compareMode && radarData.categories.length > 0 ? {
    radar: { indicator: radarData.categories.map(name => ({ name, max: Math.max(...radarData.datasets.flatMap(d => d.data)) * 1.2 })) },
    series: radarData.datasets.map(ds => ({
      type: 'radar' as const,
      data: ds.data,
      name: ds.name,
      areaStyle: { opacity: 0.1 },
      lineStyle: { width: 2 },
    })),
    tooltip: { trigger: 'item' as const },
    legend: { data: radarData.datasets.map(d => d.name) },
  } : null

  return (
    <div style={{ padding: 24 }}>
      <Title level={3}><ExperimentOutlined /> {t('radiomics:pageTitle')}</Title>
      <Text type="secondary">{t('radiomics:subtitle')}</Text>
      <Divider />

      <Row gutter={16}>
        <Col span={12}>
          <Card title={t('radiomics:selectInstance')} size="small">
            {rois.map((roi, idx) => (
              <Space key={roi.key} orientation="vertical" style={{ width: '100%', marginBottom: 16 }}>
                <Space>
                  <Text strong>ROI #{idx + 1}</Text>
                  {rois.length > 1 && (
                    <Button type="link" danger icon={<DeleteOutlined />} onClick={() => removeRoi(roi.key)} size="small">
                      {t('radiomics:removeRoi')}
                    </Button>
                  )}
                </Space>
                <Space wrap>
                  <Select
                    placeholder={t('radiomics:instanceId')}
                    value={roi.instanceId || undefined}
                    onChange={v => updateRoi(roi.key, 'instanceId', v)}
                    style={{ width: 180 }}
                    options={[
                      { value: 'STU001-SER001-INS001', label: 'CT Chest #1' },
                      { value: 'STU001-SER001-INS002', label: 'CT Chest #2' },
                      { value: 'STU002-SER001-INS001', label: 'MR Brain #1' },
                    ]}
                  />
                  <Select
                    value={roi.type}
                    onChange={v => updateRoi(roi.key, 'type', v)}
                    style={{ width: 120 }}
                    options={ROI_TYPE_OPTIONS.map(o => ({ value: o.value, label: t(o.labelKey) }))}
                  />
                </Space>
                <Space wrap>
                  <InputNumber addonBefore="X" value={roi.x} onChange={v => updateRoi(roi.key, 'x', v ?? 0)} style={{ width: 100 }} />
                  <InputNumber addonBefore="Y" value={roi.y} onChange={v => updateRoi(roi.key, 'y', v ?? 0)} style={{ width: 100 }} />
                  <InputNumber addonBefore="W" value={roi.width} onChange={v => updateRoi(roi.key, 'width', v ?? 0)} style={{ width: 100 }} />
                  <InputNumber addonBefore="H" value={roi.height} onChange={v => updateRoi(roi.key, 'height', v ?? 0)} style={{ width: 100 }} />
                </Space>
              </Space>
            ))}
            <Button type="dashed" icon={<PlusOutlined />} onClick={addRoi} block>
              {t('radiomics:addRoi')}
            </Button>
            <Divider />
            <Button type="primary" icon={<ExperimentOutlined />} loading={extracting} onClick={handleExtract} block>
              {extracting ? t('radiomics:extracting') : t('radiomics:extract')}
            </Button>
          </Card>
        </Col>

        <Col span={12}>
          <Card title={t('radiomics:featureTable')} size="small" extra={
            <Space>
              {results.length >= 2 && (
                <Button icon={<RadarChartOutlined />} onClick={handleCompare}>{t('radiomics:compare')}</Button>
              )}
              <Button icon={<DownloadOutlined />} disabled={!results.length} onClick={handleExportCsv}>
                {t('radiomics:exportCsv')}
              </Button>
            </Space>
          }>
            {allFeatures.length > 0 ? (
              <DataTable<RadiomicsFeature>
                dataSource={allFeatures}
                columns={featureColumns}
                rowKey={r => `${r.category}_${r.name}`}
                pagination={false}
                scroll={{ x: 'max-content', y: 360 }}
              />
            ) : (
              <Alert title={t('radiomics:noData')} type="info" showIcon />
            )}
          </Card>
        </Col>
      </Row>

      {compareMode && radarConfig && (
        <Card title={t('radiomics:compareTitle')} style={{ marginTop: 16 }}>
          <Tabs items={[
            {
              key: 'radar',
              label: t('radiomics:compareTitle'),
              children: <RadarChart config={radarConfig} />,
            },
            ...results.map(r => ({
              key: r.instanceId,
              label: `${t('radiomics:featureTable')} - ${r.instanceId}`,
              children: (
                <DataTable<RadiomicsFeature>
                  dataSource={r.features}
                  columns={featureColumns}
                  rowKey={f => `${f.category}_${f.name}`}
                  pagination={false}
                  scroll={{ x: 'max-content' }}
                />
              ),
            })),
          ]} />
        </Card>
      )}
    </div>
  )
}

function RadarChart({ config }: { config: any }) {
  const colors = ['#1890ff', '#52c41a', '#faad14', '#f5222d', '#722ed1', '#13c2c2']
  const { radar, series } = config
  if (!radar?.indicator?.length) return <div style={{ height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>{appT('w9d.radiomics.noData')}</div>
  const cx = 200, cy = 200, r = 160, levels = 5
  const n = radar.indicator.length
  const angleStep = (2 * Math.PI) / n
  const maxVal = Math.max(...series.flatMap((s: any) => s.data)) * 1.2

  const getPoint = (i: number, value: number) => {
    const angle = -Math.PI / 2 + i * angleStep
    const radius = (value / maxVal) * r
    return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) }
  }

  const polygon = (vals: number[], color: string, opacity: number) => {
    const pts = vals.map((v, i) => getPoint(i, v))
    const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + 'Z'
    return <path key={color} d={path} fill={color} fillOpacity={opacity} stroke={color} strokeWidth={2} />
  }

  return (
    <svg viewBox="0 0 400 400" style={{ width: '100%', height: 400 }}>
      {Array.from({ length: levels }, (_, li) => {
        const levelR = ((li + 1) / levels) * r
        const pts = Array.from({ length: n }, (_, i) => {
          const angle = -Math.PI / 2 + i * angleStep
          return `${cx + levelR * Math.cos(angle)},${cy + levelR * Math.sin(angle)}`
        }).join(' ')
        return <polygon key={li} points={pts} fill="none" stroke="#e8e8e8" strokeWidth={1} />
      })}
      {Array.from({ length: n }, (_, i) => {
        const p = getPoint(i, maxVal)
        return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#e8e8e8" strokeWidth={1} />
      })}
      {radar.indicator.map((ind: any, i: number) => {
        const p = getPoint(i, maxVal)
        const labelAngle = -Math.PI / 2 + i * angleStep
        const dx = labelAngle > Math.PI / 2 || labelAngle < -Math.PI / 2 ? -1 : 1
        return (
          <text key={i} x={p.x + dx * 8} y={p.y + 4} textAnchor={dx > 0 ? 'start' : 'end'} fontSize={10} fill="#666">
            {ind.name}
          </text>
        )
      })}
      {series.map((s: any, si: number) => polygon(s.data, colors[si % colors.length] ?? '#1890ff', 0.15))}
      {series.map((s: any, si: number) => s.data.map((v: number, i: number) => {
        const p = getPoint(i, v)
        return <circle key={`${si}-${i}`} cx={p.x} cy={p.y} r={3} fill={colors[si % colors.length]} />
      }))}
      {series.map((s: any, si: number) => (
        <text key={`lbl-${si}`} x={10} y={20 + si * 20} fill={colors[si % colors.length]} fontSize={12} fontWeight="bold">
          {s.name}
        </text>
      ))}
    </svg>
  )
}

import { DataTable } from "../../components/common";