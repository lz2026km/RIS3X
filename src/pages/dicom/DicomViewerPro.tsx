// [v3.0.6.11-54] Phase 2: DICOM Viewer Pro 独立页面 (真实 QIDO 检查/序列选择)
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Select, Space, Tag, Button, Spin, Alert, Empty, Row, Col, Typography, Segmented,
} from 'antd'
import { MonitorPlay, RefreshCw, Layers, User, CalendarDays } from 'lucide-react'
import DicomViewerProComponent from '../../components/dicom/DicomViewerPro'
import ViewerSelector from '../../components/common/ViewerSelector'
import { dicomWebApi, type DicomWebStudy, type DicomWebSeries } from '../../services/api/dicomApi'

const { Text } = Typography

const MODALITY_OPTIONS = [
  { label: '全部', value: 'ALL' },
  { label: 'CT', value: 'CT' },
  { label: 'MR', value: 'MR' },
  { label: 'DR', value: 'DR' },
  { label: 'CBCT', value: 'CBCT' },
  { label: 'MG', value: 'MG' },
]

const DicomViewerProPage: React.FC = () => {
  const [studies, setStudies] = useState<DicomWebStudy[]>([])
  const [seriesList, setSeriesList] = useState<DicomWebSeries[]>([])
  const [studyUid, setStudyUid] = useState<string>()
  const [seriesUid, setSeriesUid] = useState<string>()
  const [modality, setModality] = useState('ALL')
  const [loading, setLoading] = useState(true)
  const [loadingSeries, setLoadingSeries] = useState(false)
  const [error, setError] = useState('')
  const frameCount = 30

  const loadStudies = useCallback(async (mod = modality) => {
    setLoading(true)
    setError('')
    try {
      const res = await dicomWebApi.searchStudies(
        mod === 'ALL' ? { limit: 50 } : { Modality: mod, limit: 50 },
      )
      if (res.success) {
        setStudies(res.data ?? [])
        const first = (res.data ?? [])[0]
        if (first) {
          setStudyUid(first.studyInstanceUID)
        } else {
          setStudyUid(undefined)
          setSeriesList([])
        }
      } else {
        setError(res.error?.message ?? '检查列表加载失败')
      }
    } catch (e) {
      setError((e as Error)?.message ?? '检查列表加载失败')
    } finally {
      setLoading(false)
    }
  }, [modality])

  useEffect(() => {
    void loadStudies()
  }, [loadStudies])

  const loadSeries = useCallback(async (uid: string) => {
    setLoadingSeries(true)
    try {
      const res = await dicomWebApi.searchSeries(uid)
      if (res.success) {
        const series = res.data ?? []
        setSeriesList(series)
        const first = series[0]
        if (first) setSeriesUid(first.seriesInstanceUID)
        else setSeriesUid(undefined)
      }
    } catch {
      setSeriesList([])
      setSeriesUid(undefined)
    } finally {
      setLoadingSeries(false)
    }
  }, [])

  useEffect(() => {
    if (studyUid) void loadSeries(studyUid)
    else {
      setSeriesList([])
      setSeriesUid(undefined)
    }
  }, [studyUid, loadSeries])

  const selectedStudy = useMemo(
    () => studies.find((s) => s.studyInstanceUID === studyUid),
    [studies, studyUid],
  )
  const selectedSeries = useMemo(
    () => seriesList.find((s) => s.seriesInstanceUID === seriesUid),
    [seriesList, seriesUid],
  )

  const viewerHeight = typeof window !== 'undefined' ? window.innerHeight - 210 : 600

  return (
    <div style={{ minHeight: '100vh', background: '#0b1220' }}>
      <ViewerSelector current="pro" />
      <div style={{ padding: '8px 16px', background: '#101a30', borderBottom: '1px solid #1e2b45' }}>
        <Row gutter={[12, 8]} align="middle">
          <Col flex="auto">
            <Space size={12} wrap>
              <MonitorPlay size={18} color="#3b82f6" />
              <Text strong style={{ color: '#e2e8f0', fontSize: 15 }}>DICOM Viewer Pro</Text>
              <Segmented
                size="small"
                options={MODALITY_OPTIONS}
                value={modality}
                onChange={(v) => { setModality(String(v)); void loadStudies(String(v)) }}
              />
              <Select
                size="small"
                style={{ minWidth: 260 }}
                placeholder="选择检查 (Study)"
                loading={loading}
                value={studyUid}
                onChange={(v) => setStudyUid(v)}
                options={studies.map((s) => ({
                  value: s.studyInstanceUID,
                  label: `${s.studyDescription} | ${s.patientName} (${s.patientID})`,
                }))}
              />
              <Select
                size="small"
                style={{ minWidth: 200 }}
                placeholder="选择序列 (Series)"
                loading={loadingSeries}
                value={seriesUid}
                onChange={(v) => setSeriesUid(v)}
                options={seriesList.map((s) => ({
                  value: s.seriesInstanceUID,
                  label: `#${s.seriesNumber} ${s.seriesDescription} (${s.numberOfSeriesRelatedInstances}帧)`,
                }))}
              />
              <Button
                size="small"
                icon={<RefreshCw size={12} />}
                onClick={() => void loadStudies()}
                loading={loading}
              >
                刷新
              </Button>
            </Space>
          </Col>
          <Col>
            {selectedStudy && (
              <Space size={8} wrap>
                <Tag icon={<User size={10} />} style={{ color: '#93c5fd' }}>
                  {selectedStudy.patientName} · {selectedStudy.patientID}
                </Tag>
                <Tag icon={<CalendarDays size={10} />} style={{ color: '#93c5fd' }}>
                  {selectedStudy.studyDate}
                </Tag>
                <Tag icon={<Layers size={10} />} style={{ color: '#93c5fd' }}>
                  {selectedStudy.modalitiesInStudy.join('/')} · {selectedStudy.numberOfStudyRelatedSeries} 序列
                </Tag>
              </Space>
            )}
          </Col>
        </Row>
      </div>

      {error && (
        <Alert
          type="error"
          showIcon
          style={{ margin: 12 }}
          message={error}
          action={<Button size="small" onClick={() => void loadStudies()}>重试</Button>}
        />
      )}

      <div style={{ padding: 8 }}>
        <Spin spinning={loading && studies.length === 0}>
          {studies.length === 0 && !loading ? (
            <Empty description="暂无检查数据" style={{ padding: 60, color: '#64748b' }} />
          ) : (
            <DicomViewerProComponent
              height={viewerHeight}
              showThumbnails
              modality={selectedStudy?.modalitiesInStudy[0] ?? 'CT'}
              key={`${studyUid}-${seriesUid ?? 'all'}`}
            />
          )}
        </Spin>
      </div>

      {selectedSeries && (
        <div style={{ padding: '4px 16px 10px', color: '#64748b', fontSize: 12 }}>
          当前序列: {selectedSeries.seriesDescription} · 实例数 {selectedSeries.numberOfSeriesRelatedInstances} ·
          层厚 {selectedSeries.sliceThickness ?? '-'}mm · 帧数 {frameCount}
        </div>
      )}
    </div>
  )
}

export default DicomViewerProPage
