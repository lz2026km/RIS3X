import { useState, useEffect } from 'react'
import { Syringe, Play, Monitor, Settings, List } from 'lucide-react'
import { message } from 'antd'
import { getInjectionWorkstationService } from '../../services/contrast'
import type { InjectionProtocol, InjectionRecord, InjectorDeviceStatus } from '../../services/contrast'
// [W1-B] 注射指令接真实后端 POST /device-mgmt/contrast/injection (失败回退本地演示 startInjection)
import { deviceMgmtApi } from '../../services/api/deviceMgmtApi'

const svc = getInjectionWorkstationService()

export default function ContrastInjectionWorkstationPage() {
  const [protocols, setProtocols] = useState<InjectionProtocol[]>([])
  const [records, setRecords] = useState<InjectionRecord[]>([])
  const [device, setDevice] = useState<InjectorDeviceStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedProtocol, setSelectedProtocol] = useState<string>('')
  const [weight, setWeight] = useState(70)
  const [egfr, setEgfr] = useState(90)
  const [calculatedParams, setCalculatedParams] = useState<{ volumeMl: number; flowRateMls: number; rationale: string } | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [injecting, setInjecting] = useState(false)

  // [W1-B] 开始注射: 优先 POST /device-mgmt/contrast/injection (真实指令), 失败回退本地演示
  const handleStartInjection = async () => {
    const proto = protocols.find(p => p.id === selectedProtocol)
    if (!proto) return
    setInjecting(true)
    try {
      const res = await deviceMgmtApi.sendInjectionCommand({
        examId: `E-${Date.now().toString().slice(-8)}`,
        patientId: 'P-DEMO',
        patientName: '演示患者',
        protocolId: proto.id,
        protocolName: proto.name,
        contrastType: proto.contrastName,
        totalVolumeMl: proto.totalVolumeMl,
        flowRateMls: proto.phases[0]?.flowRateMls ?? 3,
        operator: 'current-user',
        weightKg: weight,
        eGFR: egfr,
        adjustedVolumeMl: calculatedParams?.volumeMl ?? proto.totalVolumeMl,
      })
      if (res.success) {
        message.success('注射指令已发送至设备 (POST /device-mgmt/contrast/injection)')
      } else {
        throw new Error(res.error?.message ?? '指令下发失败')
      }
    } catch (e) {
      // 演示回退: 本地服务记录一条进行中注射
      try {
        await svc.startInjection(`E-${Date.now().toString().slice(-8)}`, proto.id, { weightKg: weight, eGFR: egfr, adjustedVolumeMl: calculatedParams?.volumeMl ?? proto.totalVolumeMl })
        setRecords(await svc.getInjectionHistory())
        message.warning(`后端不可用, 已回退本地演示: ${e instanceof Error ? e.message : '未知错误'}`)
      } catch {
        message.error('注射指令发送失败')
      }
    } finally {
      setInjecting(false)
    }
  }

  useEffect(() => {
    const run = async () => {
      const [p, r, d] = await Promise.all([svc.getProtocols(), svc.getInjectionHistory(), svc.getDeviceStatus()])
      setProtocols(p)
      setRecords(r)
      setDevice(d)
      setLoading(false)
    }
    void run()
  }, [])

  const handleCalculate = async () => {
    const proto = protocols.find(p => p.id === selectedProtocol)
    if (!proto) return
    const params = await svc.calculateParameters(proto.contrastName, weight, egfr)
    setCalculatedParams(params)
  }

  if (loading) {
    return <div style={{ minHeight: '100vh', background: '#0d1117', color: '#f0f6fc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>加载中...</div>
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', color: '#f0f6fc', fontSize: 14, fontFamily: '"Segoe UI",sans-serif' }}>
      <div style={{ background: 'linear-gradient(135deg,#0891b2,#164e63)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Syringe size={24} /><span style={{ fontSize: 20, fontWeight: 600 }}>对比剂注射工作站</span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {device && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '6px 12px', borderRadius: 6, background: device.status === 'online' ? '#22c55e20' : device.status === 'offline' ? '#ef444420' : '#f59e0b20', color: device.status === 'online' ? '#22c55e' : device.status === 'offline' ? '#ef4444' : '#f59e0b' }}>
              <Monitor size={14} />{device.deviceName}: {device.status === 'online' ? '在线' : device.status === 'offline' ? '离线' : device.status === 'busy' ? '忙碌' : '错误'}
            </span>
          )}
          <button onClick={() => setShowHistory(!showHistory)} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.3)', background: showHistory ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.15)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <List size={14} />注射历史
          </button>
        </div>
      </div>

      <div style={{ padding: '20px 24px', display: 'grid', gridTemplateColumns: showHistory ? '1fr 1fr' : '1fr', gap: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>注射方案选择</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <select value={selectedProtocol} onChange={e => { setSelectedProtocol(e.target.value); setCalculatedParams(null) }} style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #30363d', background: '#0d1117', color: '#f0f6fc', fontSize: 13, outline: 'none' }}>
                <option value="">-- 选择方案 --</option>
                {protocols.map(p => <option key={p.id} value={p.id}>{p.name} ({p.contrastName})</option>)}
              </select>

              {selectedProtocol && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>
                  <div>
                    <label style={{ fontSize: 12, color: '#8b949e' }}>体重 (kg)</label>
                    <input type="number" value={weight} onChange={e => setWeight(Number(e.target.value))} style={{ width: '100%', padding: '6px 10px', borderRadius: 4, border: '1px solid #30363d', background: '#0d1117', color: '#f0f6fc', fontSize: 13, outline: 'none', marginTop: 4, boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: '#8b949e' }}>eGFR (mL/min)</label>
                    <input type="number" value={egfr} onChange={e => setEgfr(Number(e.target.value))} style={{ width: '100%', padding: '6px 10px', borderRadius: 4, border: '1px solid #30363d', background: '#0d1117', color: '#f0f6fc', fontSize: 13, outline: 'none', marginTop: 4, boxSizing: 'border-box' }} />
                  </div>
                </div>
              )}

              <button onClick={handleCalculate} disabled={!selectedProtocol} style={{ padding: '8px 16px', borderRadius: 6, border: 'none', cursor: selectedProtocol ? 'pointer' : 'not-allowed', background: selectedProtocol ? '#0891b2' : '#21262d', color: selectedProtocol ? '#fff' : '#484f58', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Settings size={14} />计算注射参数
              </button>

              {calculatedParams && (
                <div style={{ marginTop: 8, padding: 12, background: '#0d1117', borderRadius: 6 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#22c55e', marginBottom: 8 }}>计算结果</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                    <div><span style={{ color: '#8b949e', fontSize: 12 }}>注射量</span><div style={{ fontSize: 16, fontWeight: 600 }}>{calculatedParams.volumeMl} mL</div></div>
                    <div><span style={{ color: '#8b949e', fontSize: 12 }}>流率</span><div style={{ fontSize: 16, fontWeight: 600 }}>{calculatedParams.flowRateMls} mL/s</div></div>
                  </div>
                  <div style={{ marginTop: 4, fontSize: 12, color: '#6e7681' }}>{calculatedParams.rationale}</div>
                </div>
              )}
            </div>
          </div>

          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>方案详情</div>
            {selectedProtocol ? (
              <div>
                {protocols.filter(p => p.id === selectedProtocol).map(proto => (
                  <div key={proto.id}>
                    <div style={{ display: 'flex', gap: 16, marginBottom: 8 }}>
                      <span style={{ fontSize: 12, color: '#8b949e' }}>总量: <span style={{ color: '#f0f6fc' }}>{proto.totalVolumeMl}mL</span></span>
                      <span style={{ fontSize: 12, color: '#8b949e' }}>浓度: <span style={{ color: '#f0f6fc' }}>{proto.concentration}</span></span>
                    </div>
                    <div style={{ fontSize: 12, color: '#8b949e', marginBottom: 8 }}>注射时相:</div>
                    {proto.phases.map((phase, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: '#0d1117', borderRadius: 4, marginBottom: 4, fontSize: 12 }}>
                        <span>{phase.phase === 'bolus' ? '团注' : phase.phase === 'chaser' ? '冲洗' : phase.phase === 'delay' ? '延迟' : '分次'}</span>
                        <span>{phase.volumeMl > 0 ? `${phase.volumeMl}mL @ ${phase.flowRateMls}mL/s` : `延迟 ${phase.delaySec}s`}</span>
                        <span style={{ color: '#6e7681' }}>{phase.description}</span>
                      </div>
                    ))}
                    {calculatedParams && (
                      <button onClick={() => void handleStartInjection()} disabled={injecting} style={{ marginTop: 12, width: '100%', padding: '10px', borderRadius: 6, border: 'none', cursor: injecting ? 'wait' : 'pointer', background: '#22c55e', color: '#fff', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                        <Play size={16} />{injecting ? '指令发送中...' : '开始注射'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : <div style={{ color: '#6e7681', fontSize: 13 }}>请先选择方案</div>}
          </div>
        </div>

        {showHistory && (
          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 16, maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>注射历史</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {records.map(r => (
                <div key={r.id} style={{ padding: '10px 12px', background: '#0d1117', borderRadius: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 13 }}>{r.patientName}</span>
                     <span style={{ fontSize: 12, padding: '1px 6px', borderRadius: 3, background: r.status === 'completed' ? '#22c55e20' : r.status === 'in_progress' ? '#3b82f620' : '#ef444420', color: r.status === 'completed' ? '#22c55e' : r.status === 'in_progress' ? '#3b82f6' : '#ef4444' }}>
                      {r.status === 'completed' ? '完成' : r.status === 'in_progress' ? '进行中' : r.status === 'cancelled' ? '取消' : '中断'}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: '#8b949e' }}>{r.protocolName} | {r.totalVolumeMl}mL | {new Date(r.startTime).toLocaleString('zh-CN')}</div>
                </div>
              ))}
              {records.length === 0 && <div style={{ color: '#6e7681', fontSize: 13 }}>暂无记录</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
