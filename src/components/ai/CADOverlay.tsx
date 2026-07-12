import React, { useEffect, useState } from 'react'
import { Card, Space, Switch, Tag, Empty, List, Button } from 'antd'
import { Eye, EyeOff, Thermometer, Crosshair } from 'lucide-react'

interface CadDetection {
  type: 'nodule' | 'calcification'
  x: number
  y: number
  width: number
  height: number
  confidence: number
  size: number
}

interface CadResult {
  instanceId: string
  findings: CadDetection[]
  heatmapUrl: string | null
  detectedAt: string
}

const TYPE_COLORS: Record<string, string> = {
  nodule: '#ff4444',
  calcification: '#ffaa00',
}

const TYPE_LABELS: Record<string, string> = {
  nodule: '肺结节',
  calcification: '钙化点',
}

const heatmapGradient = (confidence: number): string => {
  if (confidence >= 0.9) return 'rgba(255, 0, 0, 0.5)'
  if (confidence >= 0.75) return 'rgba(255, 165, 0, 0.4)'
  return 'rgba(255, 255, 0, 0.3)'
}

interface CADOverlayProps {
  instanceId: string
  width?: number
  height?: number
}

export const CADOverlay: React.FC<CADOverlayProps> = ({
  instanceId,
  width = 512,
  height = 512,
}) => {
  const [result, setResult] = useState<CadResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [showBoxes, setShowBoxes] = useState(true)
  const [showHeatmap, setShowHeatmap] = useState(true)

  const detect = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/ai/cad/detect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instanceId }),
      })
      const data: CadResult = await res.json()
      setResult(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void detect()
  }, [instanceId])

  const findings = result?.findings ?? []

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 12 }}>
      <Card
        size="small"
        title={
          <Space>
            <Crosshair size={14} />
            <span>AI 阅片助手 V2</span>
            {result && <Tag color="blue">{findings.length} 处</Tag>}
          </Space>
        }
        extra={
          <Space>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>标注</span>
            <Switch
              size="small"
              checked={showBoxes}
              onChange={setShowBoxes}
              checkedChildren={<Eye size={12} />}
              unCheckedChildren={<EyeOff size={12} />}
            />
            <span style={{ fontSize: 12, color: '#94a3b8' }}>热力图</span>
            <Switch
              size="small"
              checked={showHeatmap}
              onChange={setShowHeatmap}
              checkedChildren={<Thermometer size={12} />}
              unCheckedChildren={<EyeOff size={12} />}
            />
            <Button size="small" onClick={detect} loading={loading}>
              重新检测
            </Button>
          </Space>
        }
        styles={{ body: { padding: 0, background: '#020617' } }}
      >
        <div
          style={{
            position: 'relative',
            width,
            height,
            background:
              'repeating-linear-gradient(45deg, #0f172a, #0f172a 8px, #1e293b 8px, #1e293b 16px)',
            overflow: 'hidden',
          }}
        >
          {showHeatmap &&
            findings.map((f, i) => (
              <div
                key={`hm-${i}`}
                style={{
                  position: 'absolute',
                  left: f.x - f.width / 2,
                  top: f.y - f.height / 2,
                  width: f.width * 2.5,
                  height: f.height * 2.5,
                  borderRadius: '50%',
                  background: `radial-gradient(circle, ${heatmapGradient(f.confidence)} 0%, transparent 70%)`,
                  pointerEvents: 'none',
                }}
              />
            ))}
          {findings.map((f, i) => (
            <div
              key={`box-${i}`}
              style={{
                position: 'absolute',
                left: f.x,
                top: f.y,
                width: f.width,
                height: f.height,
                border: showBoxes ? `2px solid ${TYPE_COLORS[f.type]}` : 'none',
                borderRadius: 2,
                cursor: 'pointer',
                background: showBoxes ? 'rgba(255,255,255,0.05)' : 'transparent',
              }}
              title={`${TYPE_LABELS[f.type]} (${(f.confidence * 100).toFixed(0)}%)`}
            >
              {showBoxes && (
                <div
                  style={{
                    position: 'absolute',
                    top: -20,
                    left: 0,
                    background: TYPE_COLORS[f.type],
                    color: '#fff',
                    padding: '1px 6px',
                    borderRadius: 3,
                    fontSize: 11,
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    lineHeight: '18px',
                  }}
                >
                  {TYPE_LABELS[f.type]} {(f.confidence * 100).toFixed(0)}%
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      <div>
        <Card size="small" title="图例" style={{ marginBottom: 12 }}>
          <Space direction="vertical" style={{ width: '100%' }} size={4}>
            {['nodule', 'calcification'].map((t) => (
              <div
                key={t}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 13,
                }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    width: 12,
                    height: 12,
                    background: TYPE_COLORS[t],
                    borderRadius: 2,
                  }}
                />
                <span>{TYPE_LABELS[t]}</span>
              </div>
            ))}
          </Space>
          <div style={{ marginTop: 8, fontSize: 12, color: '#94a3b8' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 12, height: 12, borderRadius: '50%', background: 'rgba(255,0,0,0.5)' }} />
              ≥ 90% 高置信
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 12, height: 12, borderRadius: '50%', background: 'rgba(255,165,0,0.4)' }} />
              75-89% 中置信
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 12, height: 12, borderRadius: '50%', background: 'rgba(255,255,0,0.3)' }} />
              {'<'} 75% 低置信
            </div>
          </div>
        </Card>

        <Card
          size="small"
          title={`检测结果 (${findings.length})`}
          styles={{ body: { maxHeight: 300, overflow: 'auto' } }}
        >
          {findings.length === 0 ? (
            <Empty description="无检测结果" />
          ) : (
            <List
              size="small"
              dataSource={findings}
              renderItem={(f, i) => (
                <List.Item key={i} style={{ padding: '6px 4px' }}>
                  <div style={{ width: '100%' }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: 12,
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>
                        <span
                          style={{
                            display: 'inline-block',
                            width: 8,
                            height: 8,
                            background: TYPE_COLORS[f.type],
                            borderRadius: 2,
                            marginRight: 6,
                          }}
                        />
                        {TYPE_LABELS[f.type]}
                      </span>
                      <span style={{ color: '#3b82f6' }}>
                        {(f.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>
                      大小: {f.size}mm | 位置: ({f.x}, {f.y})
                    </div>
                  </div>
                </List.Item>
              )}
            />
          )}
        </Card>
      </div>
    </div>
  )
}

export default CADOverlay
