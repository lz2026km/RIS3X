import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  Card, Row, Col, Select, InputNumber, Button, Tag, Statistic, Spin, message, Table, Empty, Slider, Space, Divider, Alert, Popconfirm, Modal,
} from 'antd'
import { Box, Activity, History, Scan, PenLine, Trash2 } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts'
import { volumeApi, type VolumeSeriesDto, type VolumeSegmentationDto } from '../../services/api/volumeApi'
import { segmentationApi, type SegmentationResultDto, type SegmentationTarget, type QuantifyResultDto, type SegmentationHistoryItemDto, type MaskSliceDto } from '../../services/api/segmentationApi'
import { invalidateApiCache } from '../../services/api/client'
import { decodeInt16Base64, applyWWL } from './volumeReal'

const MANUAL_COLORS = ['#ff4d4f', '#fa8c16', '#52c41a', '#1677ff', '#722ed1']

const TARGETS: Array<{ value: SegmentationTarget; label: string; color: string; preset: [number, number] }> = [
  { value: 'nodule', label: '结节 (区域生长/阈值)', color: '#ff4d4f', preset: [-100, 100] },
  { value: 'bone', label: '骨骼 (HU>300)', color: '#fa8c16', preset: [300, 3071] },
  { value: 'liver', label: '肝脏 (40~160 HU)', color: '#722ed1', preset: [40, 160] },
  { value: 'lung', label: '肺 (HU<-500)', color: '#52c41a', preset: [-1024, -500] },
]

const PLANES: Array<{ value: 'axial' | 'sagittal' | 'coronal'; label: string }> = [
  { value: 'axial', label: '轴位' },
  { value: 'sagittal', label: '矢状位' },
  { value: 'coronal', label: '冠状位' },
]

function unpackMask(b64: string, width: number, height: number): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(width * height)
  for (let i = 0; i < Math.min(bin.length, width * height * 2); i++) {
    const byte = bin.charCodeAt(i)
    for (let b = 0; b < 8; b++) {
      const idx = i * 8 + b
      if (idx < width * height && (byte & (0x80 >> b))) out[idx] = 1
    }
  }
  return out
}

/** 空像素数据时的占位灰度图 */
function blankImage(width: number, height: number): ImageData {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, width)
  canvas.height = Math.max(1, height)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('no 2d context')
  return ctx.createImageData(canvas.width, canvas.height)
}

const HISTOGRAM_COLORS = ['#1677ff', '#4096ff', '#69b1ff']

/** 中心切片: MPR 灰度 + 掩码红/绿叠加 */
const OverlayCanvas: React.FC<{
  jobId: string
  plane: 'axial' | 'sagittal' | 'coronal'
  index: number
  mask: MaskSliceDto | null
  color: string
  ww: number
  wl: number
}> = ({ jobId, plane, index, mask, color, ww, wl }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cacheRef = useRef<Map<string, ImageData>>(new Map())

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let cancelled = false

    const draw = (img: ImageData, maskData: Uint8Array | null, mw: number, mh: number) => {
      if (cancelled || !canvasRef.current) return
      const rect = canvas.getBoundingClientRect()
      const w = Math.max(1, rect.width)
      const h = Math.max(1, rect.height)
      canvas.width = w * devicePixelRatio
      canvas.height = h * devicePixelRatio
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0)
      ctx.clearRect(0, 0, w, h)
      const tmp = document.createElement('canvas')
      tmp.width = img.width
      tmp.height = img.height
      const tctx = tmp.getContext('2d')
      if (!tctx) return
      tctx.putImageData(img, 0, 0)
      if (maskData && maskData.length === mw * mh) {
        const ov = tctx.createImageData(mw, mh)
        const [r, g, b] = color === 'green' ? [82, 196, 26] : [255, 77, 79]
        for (let i = 0; i < mw * mh; i++) {
          if (maskData[i]) {
            ov.data[i * 4] = r
            ov.data[i * 4 + 1] = g
            ov.data[i * 4 + 2] = b
            ov.data[i * 4 + 3] = 255
          }
        }
        tctx.putImageData(ov, 0, 0)
      }
      ctx.imageSmoothingEnabled = false
      const scale = Math.min(w / img.width, h / img.height)
      ctx.drawImage(tmp, (w - img.width * scale) / 2, (h - img.height * scale) / 2, img.width * scale, img.height * scale)
    }

    const key = `${plane}:${index}:${ww}:${wl}`
    const cached = cacheRef.current.get(key)
    volumeApi.mprSlice(jobId, plane, index).then((res) => {
      if (!res.success || cancelled) return
      const pd = res.data.pixelData ?? {
        dataBase64: (res.data as { pixelDataBase64?: string }).pixelDataBase64 ?? '',
        bitsAllocated: 16,
        signed: true,
        width: res.data.dimensions?.width ?? 512,
        height: res.data.dimensions?.height ?? 512,
      }
      const img = cached ?? (pd.dataBase64
        ? applyWWL(decodeInt16Base64(pd.dataBase64), pd.width, pd.height, ww, wl)
        : blankImage(mask?.width ?? 512, mask?.height ?? 512))
      cacheRef.current.set(key, img)
      const maskData = mask && mask.dataBase64 ? unpackMask(mask.dataBase64, mask.width, mask.height) : null
      draw(img, maskData, mask?.width ?? 0, mask?.height ?? 0)
    })
    return () => { cancelled = true }
  }, [jobId, plane, index, mask, color, ww, wl])

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%', imageRendering: 'pixelated' }} />
}

const SegmentationPage: React.FC = () => {
  const [series, setSeries] = useState<VolumeSeriesDto[]>([])
  const [selectedUid, setSelectedUid] = useState<string>()
  const [target, setTarget] = useState<SegmentationTarget>('nodule')
  const [thMin, setThMin] = useState<number | null>(-100)
  const [thMax, setThMax] = useState<number | null>(100)
  const [seed, setSeed] = useState<{ x: number | null; y: number | null; z: number | null }>({ x: null, y: null, z: null })
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<SegmentationResultDto | null>(null)
  const [quantify, setQuantify] = useState<QuantifyResultDto | null>(null)
  const [history, setHistory] = useState<SegmentationHistoryItemDto[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  // [W2-C] 手动标注管理 (create/list/delete)
  const [manualList, setManualList] = useState<VolumeSegmentationDto[]>([])
  const [manualLoading, setManualLoading] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState<{ label: string; color: string; voxelCount: number }>({
    label: '',
    color: MANUAL_COLORS[0]!,
    voxelCount: 1000,
  })
  const [plane, setPlane] = useState<'axial' | 'sagittal' | 'coronal'>('axial')
  const [ww, setWw] = useState(400)
  const [wl, setWl] = useState(40)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    volumeApi.series().then((res) => {
      if (res.success) setSeries(res.data)
    })
  }, [])

  const refreshHistory = useCallback((seriesUID: string) => {
    setHistoryLoading(true)
    segmentationApi.history(seriesUID).then((res) => {
      setHistory(res.success ? res.data : [])
      setHistoryLoading(false)
    }).catch(() => setHistoryLoading(false))
  }, [])

  // [W2-C] 手动标注列表
  const refreshManual = useCallback((seriesUID: string) => {
    setManualLoading(true)
    volumeApi.listSegmentations(seriesUID).then((res) => {
      setManualList(res.success && Array.isArray(res.data) ? res.data : [])
      setManualLoading(false)
    }).catch(() => { setManualLoading(false); setManualList([]) })
  }, [])

  // [W2-C] 参数化创建手动标注 (体素数 → voxelIndices 采样)
  const handleCreateManual = async () => {
    if (!selectedUid) { message.warning('请先选择检查序列'); return }
    const label = createForm.label.trim()
    if (!label) { message.warning('请输入标注名称'); return }
    const count = Math.max(0, Math.min(createForm.voxelCount, 200000))
    try {
      const res = await volumeApi.createSegmentation(selectedUid, {
        label,
        color: createForm.color,
        voxelIndices: Array.from({ length: count }, (_, i) => i),
      })
      if (res.success) {
        message.success(`手动标注已创建: ${label} (${count.toLocaleString()} 体素)`)
        setCreateOpen(false)
        setCreateForm({ label: '', color: MANUAL_COLORS[0]!, voxelCount: 1000 })
        invalidateApiCache(`/volume/${encodeURIComponent(selectedUid)}/segmentations`)
        refreshManual(selectedUid)
      } else {
        message.error(res.error?.message ?? '创建标注失败')
      }
    } catch {
      message.error('创建标注请求异常')
    }
  }

  // [W2-C] 删除手动标注 (二次确认)
  const handleDeleteManual = async (id: string) => {
    try {
      const res = await volumeApi.deleteSegmentation(id)
      if (res.success) {
        message.success('标注已删除')
        if (selectedUid) {
          invalidateApiCache(`/volume/${encodeURIComponent(selectedUid)}/segmentations`)
          refreshManual(selectedUid)
        }
      } else {
        message.error(res.error?.message ?? '删除失败')
      }
    } catch {
      message.error('删除标注请求异常')
    }
  }

  const handleTargetChange = (t: SegmentationTarget) => {
    setTarget(t)
    const preset = TARGETS.find((x) => x.value === t)?.preset
    if (preset) {
      setThMin(preset[0])
      setThMax(preset[1])
    }
    setSeed({ x: null, y: null, z: null })
  }

  const handleRun = useCallback(async () => {
    if (!selectedUid) { message.warning('请先选择检查序列'); return }
    setRunning(true)
    setError(null)
    setResult(null)
    setQuantify(null)
    try {
      const res = await segmentationApi.segment({
        seriesUID: selectedUid,
        target,
        ...(thMin !== null && thMin !== undefined ? { thresholdMin: thMin } : {}),
        ...(thMax !== null && thMax !== undefined ? { thresholdMax: thMax } : {}),
        ...(target === 'nodule' && seed.x !== null && seed.y !== null && seed.z !== null ? { seed: { x: seed.x, y: seed.y, z: seed.z } } : {}),
      })
      if (!res.success) {
        setError(res.error?.message || '分割失败')
        message.error(res.error?.message || '分割失败')
        return
      }
      const data = res.data
      setResult(data)
      message.success(`分割完成: ${data.voxelCount} 体素, ${data.volumeCm3.toFixed(2)} cm³ (${data.source === 'real' ? '真实 DICOM' : '合成'})`)
      if (data.voxelCount > 0) {
        const q = await segmentationApi.quantify(data.segId)
        if (q.success) setQuantify(q.data)
      }
      invalidateApiCache(`/volume/segmentations/${encodeURIComponent(selectedUid)}`)
      refreshHistory(selectedUid)
    } catch (e) {
      setError((e as Error).message)
      message.error('分割请求异常')
    } finally {
      setRunning(false)
    }
  }, [selectedUid, target, thMin, thMax, seed, refreshHistory])

  const handleApprove = useCallback(async (id: string) => {
    const res = await segmentationApi.approve(id)
    if (res.success) {
      message.success('已确认分割结果')
      if (selectedUid) {
        invalidateApiCache(`/volume/segmentations/${encodeURIComponent(selectedUid)}`)
        refreshHistory(selectedUid)
      }
    } else {
      message.error(res.error?.message || '确认失败')
    }
  }, [selectedUid, refreshHistory])

  const centerMask = result?.centerSlices.find((s) => s.plane === plane) ?? null
  const centerIndex = centerMask?.index ?? 0
  const overlayColor = target === 'lung' ? 'green' : 'red'

  const histogramData = (quantify?.bins ?? []).map((b, i) => ({
    key: `${b.rangeMin}~${b.rangeMax}`,
    label: b.rangeMin.toFixed(0),
    count: b.count,
    color: HISTOGRAM_COLORS[i % HISTOGRAM_COLORS.length]!,
  }))

  const historyColumns = [
    { title: '目标', dataIndex: 'target', key: 'target', width: 90,
      render: (t: string) => <Tag color={TARGETS.find((x) => x.value === t)?.color ?? '#999'}>{t}</Tag> },
    { title: '体积 cm³', dataIndex: 'volumeCm3', key: 'volumeCm3', width: 110, align: 'right' as const, render: (v: number) => v.toFixed(2) },
    { title: '平均 HU', dataIndex: 'meanHu', key: 'meanHu', width: 100, align: 'right' as const, render: (v: number) => v.toFixed(1) },
    { title: '最大 HU', dataIndex: 'maxHu', key: 'maxHu', width: 100, align: 'right' as const },
    { title: '体素数', dataIndex: 'voxelCount', key: 'voxelCount', width: 110, align: 'right' as const, render: (v: number) => v.toLocaleString() },
    { title: '来源', dataIndex: 'source', key: 'source', width: 90, render: (s: string) => (s === 'real' ? <Tag color="green">REAL</Tag> : <Tag>SYNTH</Tag>) },
    { title: '状态', dataIndex: 'approved', key: 'approved', width: 90, render: (a: boolean) => (a ? <Tag color="success">已确认</Tag> : <Tag>待确认</Tag>) },
    { title: '时间', dataIndex: 'createdAt', key: 'createdAt', width: 170, render: (t: string) => new Date(t).toLocaleString() },
    { title: '操作', key: 'action', width: 90, render: (_: unknown, row: SegmentationHistoryItemDto) => (
      <Button size="small" type="primary" ghost disabled={row.approved} onClick={() => handleApprove(row.id)}>确认</Button>
    ) },
  ]

  return (
    <div style={{ padding: 16, background: '#f0f2f5', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 12 }} wrap>
        <Scan size={20} color="#1677ff" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>3D 分割与定量</span>
        <Tag color="cyan">结节 / 骨 / 肝 / 肺</Tag>
        <Tag color="geekblue">对标 Siemens Lesion Quantification</Tag>
        {result && (
          <>
            <Tag color={result.source === 'real' ? 'green' : 'default'}>{result.source === 'real' ? 'REAL DICOM' : 'SYNTHETIC'}</Tag>
            <Tag>{result.voxelCount.toLocaleString()} vox</Tag>
          </>
        )}
      </Space>

      <Row gutter={12}>
        <Col span={5}>
          <Card size="small" title={<Space><Activity size={14} /><span>分割参数</span></Space>} style={{ marginBottom: 12 }}>
            <div style={{ marginBottom: 8, fontWeight: 500 }}>检查序列</div>
            <Select
              style={{ width: '100%', marginBottom: 8 }}
              placeholder="选择序列"
              value={selectedUid}
              onChange={(v) => { setSelectedUid(v); refreshHistory(v); refreshManual(v) }}
              options={series.map((s) => {
                const slices = s.slices ?? (s as { sliceCount?: number }).sliceCount ?? 0
                const instances = s.instanceCount ?? slices
                const uid = s.seriesInstanceUid ?? (s as { seriesUid?: string }).seriesUid ?? ''
                return {
                  value: uid,
                  label: `${s.modality} ${s.rows}×${s.columns}×${slices} (${instances})`,
                }
              })}
            />
            {series.find((s) => s.seriesInstanceUid === selectedUid) && (
              <Tag color="blue">{series.find((s) => s.seriesInstanceUid === selectedUid)!.modality}</Tag>
            )}
            <Divider style={{ margin: '12px 0' }} />
            <div style={{ marginBottom: 8, fontWeight: 500 }}>分割目标</div>
            <Select
              style={{ width: '100%', marginBottom: 8 }}
              value={target}
              onChange={handleTargetChange}
              options={TARGETS.map((t) => ({ value: t.value, label: t.label }))}
            />
            <div style={{ marginBottom: 8, fontWeight: 500 }}>HU 阈值</div>
            <Space>
              <InputNumber size="small" placeholder="最小" value={thMin} onChange={(v) => setThMin(v ?? null)} style={{ width: 90 }} />
              <span>~</span>
              <InputNumber size="small" placeholder="最大" value={thMax} onChange={(v) => setThMax(v ?? null)} style={{ width: 90 }} />
            </Space>
            {target === 'nodule' && (
              <>
                <div style={{ margin: '10px 0 8px', fontWeight: 500 }}>种子点 (区域生长, 可选)</div>
                <Space>
                  <InputNumber size="small" placeholder="X" value={seed.x} onChange={(v) => setSeed((s) => ({ ...s, x: v ?? null }))} style={{ width: 70 }} />
                  <InputNumber size="small" placeholder="Y" value={seed.y} onChange={(v) => setSeed((s) => ({ ...s, y: v ?? null }))} style={{ width: 70 }} />
                  <InputNumber size="small" placeholder="Z" value={seed.z} onChange={(v) => setSeed((s) => ({ ...s, z: v ?? null }))} style={{ width: 70 }} />
                </Space>
              </>
            )}
            <div style={{ marginTop: 14 }}>
              <Button type="primary" block loading={running} onClick={handleRun} icon={<Box size={14} />}>
                {running ? '分割中...' : '运行分割'}
              </Button>
            </div>
            {error && <Alert style={{ marginTop: 10 }} type="error" showIcon message={error} />}
          </Card>

          <Card size="small" title={<Space><History size={14} /><span>分割历史</span></Space>} styles={{ body: { padding: 8 } }}>
            <Spin spinning={historyLoading}>
              {history.length === 0 ? (
                <Empty description="暂无分割记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ) : (
                history.map((h) => (
                  <div key={h.id} style={{ padding: '6px 4px', borderBottom: '1px solid #f0f0f0', fontSize: 12 }}>
                    <Space size={6}>
                      <Tag color={TARGETS.find((x) => x.value === h.target)?.color ?? '#999'}>{h.target}</Tag>
                      {h.approved ? <Tag color="success">已确认</Tag> : <Tag>待确认</Tag>}
                    </Space>
                    <div style={{ color: '#666', marginTop: 2 }}>
                      {h.volumeCm3.toFixed(2)} cm³ · 均值 {h.meanHu.toFixed(1)} HU · {h.voxelCount.toLocaleString()} vox
                    </div>
                    <div style={{ color: '#999', fontSize: 11 }}>{new Date(h.createdAt).toLocaleString()}</div>
                  </div>
                ))
              )}
            </Spin>
          </Card>

          {/* [W2-C] 手动标注管理 (参数化创建 / 列表 / 删除) */}
          <Card
            size="small"
            title={<Space><PenLine size={14} /><span>手动标注</span></Space>}
            extra={<Button size="small" type="primary" onClick={() => { if (!selectedUid) { message.warning('请先选择检查序列'); return } setCreateOpen(true) }}>新建标注</Button>}
            style={{ marginTop: 12 }}
            styles={{ body: { padding: 8 } }}
          >
            <Spin spinning={manualLoading}>
              {manualList.length === 0 ? (
                <Empty description="暂无手动标注" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ) : (
                manualList.map((m) => (
                  <div key={m.id} style={{ padding: '6px 4px', borderBottom: '1px solid #f0f0f0', fontSize: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Space size={6}>
                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: m.color, display: 'inline-block' }} />
                        <span style={{ fontWeight: 500 }}>{m.label}</span>
                      </Space>
                      <Popconfirm
                        title="删除该标注?"
                        description={`将删除「${m.label}」(${m.voxelCount.toLocaleString()} 体素)`}
                        okText="删除"
                        cancelText="取消"
                        okButtonProps={{ danger: true }}
                        onConfirm={() => handleDeleteManual(m.id)}
                      >
                        <Button size="small" type="text" danger icon={<Trash2 size={12} />} />
                      </Popconfirm>
                    </div>
                    <div style={{ color: '#666', marginTop: 2 }}>
                      {m.voxelCount.toLocaleString()} vox · {m.volume.toFixed(4)} cm³
                    </div>
                    <div style={{ color: '#999', fontSize: 11 }}>{new Date(m.createdAt).toLocaleString()}</div>
                  </div>
                ))
              )}
            </Spin>
          </Card>

          {/* [W2-C] 新建手动标注 Modal */}
          <Modal
            title="新建手动标注"
            open={createOpen}
            onOk={handleCreateManual}
            onCancel={() => setCreateOpen(false)}
            okText="创建"
            cancelText="取消"
          >
            <div style={{ marginBottom: 12 }}>
              <div style={{ marginBottom: 4, fontWeight: 500 }}>标注名称</div>
              <Select
                style={{ width: '100%' }}
                placeholder="输入或选择标注名称"
                value={createForm.label || undefined}
                onChange={(v) => setCreateForm((f) => ({ ...f, label: v }))}
                options={['左肺上叶结节', '右肺下叶结节', '肝脏占位', '骨转移灶', '乳腺肿块'].map((l) => ({ value: l, label: l }))}
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ marginBottom: 4, fontWeight: 500 }}>标注颜色</div>
              <Space>
                {MANUAL_COLORS.map((c) => (
                  <span
                    key={c}
                    onClick={() => setCreateForm((f) => ({ ...f, color: c }))}
                    style={{
                      width: 22, height: 22, borderRadius: '50%', background: c, cursor: 'pointer', display: 'inline-block',
                      boxShadow: createForm.color === c ? `0 0 0 2px #fff, 0 0 0 4px ${c}` : 'none',
                    }}
                  />
                ))}
              </Space>
            </div>
            <div>
              <div style={{ marginBottom: 4, fontWeight: 500 }}>体素数 (估算)</div>
              <InputNumber min={0} max={200000} style={{ width: '100%' }} value={createForm.voxelCount} onChange={(v) => setCreateForm((f) => ({ ...f, voxelCount: v ?? 0 }))} />
              <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>约 {((createForm.voxelCount * 0.00245)).toFixed(2)} cm³ (0.7×0.7mm × 5mm 层厚估算)</div>
            </div>
          </Modal>
        </Col>

        <Col span={19}>
          {!result ? (
            <Card>
              <Empty
                description="选择检查序列与分割目标后运行分割; 支持结节(区域生长/阈值)、骨骼(HU>300)、肝脏(40~160 HU)、肺(HU<-500)"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            </Card>
          ) : (
            <>
              <Row gutter={12} style={{ marginBottom: 12 }}>
                <Col span={4}><Card size="small"><Statistic title="体积 (cm³)" value={result.volumeCm3} precision={2} suffix={result.voxelCount === 0 ? '(未检出)' : ''} /></Card></Col>
                <Col span={4}><Card size="small"><Statistic title="平均 HU (密度)" value={result.meanHu} precision={1} /></Card></Col>
                <Col span={4}><Card size="small"><Statistic title="最大 HU" value={result.maxHu} precision={0} /></Card></Col>
                <Col span={4}><Card size="small"><Statistic title="最小 HU" value={result.minHu} precision={0} /></Card></Col>
                <Col span={4}><Card size="small"><Statistic title="表面积 (cm²)" value={result.surfaceAreaCm2} precision={1} /></Card></Col>
                <Col span={4}><Card size="small"><Statistic title="体素数" value={result.voxelCount} /></Card></Col>
              </Row>
              <Row gutter={12} style={{ marginBottom: 12 }}>
                <Col span={14}>
                  <Card size="small" title={<Space><Scan size={14} /><span>中心切片 + 掩码叠加</span></Space>} extra={
                    <Space>
                      <Select size="small" value={plane} onChange={setPlane} style={{ width: 90 }}
                        options={PLANES.map((p) => ({ value: p.value, label: p.label }))} />
                      <span style={{ fontSize: 11, color: '#999' }}>切片 {centerIndex} / 中心 {result.bbox.x},{result.bbox.y},{result.bbox.z} w{result.bbox.w}h{result.bbox.h}d{result.bbox.d}</span>
                    </Space>
                  }>
                    <div style={{ height: 320, position: 'relative' }}>
                      {result.jobId ? (
                        <OverlayCanvas jobId={result.jobId} plane={plane} index={centerIndex} mask={centerMask} color={overlayColor} ww={ww} wl={wl} />
                      ) : <Empty description="合成模式无底层切片" />}
                    </div>
                    <Space style={{ marginTop: 6 }} size="large">
                      <span style={{ fontSize: 11 }}>WW <Slider style={{ width: 120, display: 'inline-block' }} min={1} max={4000} value={ww} onChange={setWw} /></span>
                      <span style={{ fontSize: 11 }}>WL <Slider style={{ width: 120, display: 'inline-block' }} min={-1000} max={3000} value={wl} onChange={setWl} /></span>
                      <Tag color={overlayColor === 'green' ? 'green' : 'red'}>{overlayColor === 'green' ? '肺' : '分割掩码'}叠加</Tag>
                    </Space>
                  </Card>
                </Col>
                <Col span={10}>
                  <Card size="small" title="HU 直方图 (分割掩码内)" extra={<Tag>{quantify?.binCount ?? '-'} 桶</Tag>} styles={{ body: { height: 380 } }}>
                    {histogramData.length === 0 ? (
                      <Empty description="无分割结果" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={histogramData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="label" fontSize={10} tickFormatter={(v: string) => v} />
                          <YAxis fontSize={10} />
                          <Tooltip />
                          <Bar dataKey="count" name="体素数" radius={[2, 2, 0, 0]}>
                            {histogramData.map((d) => <Cell key={d.key} fill={d.color} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </Card>
                </Col>
              </Row>
              <Card size="small" title={<Space><History size={14} /><span>分割历史 (RadiomicsFeature 落库)</span></Space>} styles={{ body: { padding: 8 } }}>
                <Table rowKey="id" size="small" loading={historyLoading} columns={historyColumns} dataSource={history}
                  pagination={false} scroll={{ x: 900 }} />
              </Card>
            </>
          )}
        </Col>
      </Row>
    </div>
  )
}

export default SegmentationPage
