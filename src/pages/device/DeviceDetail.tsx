import {
  Activity, X, Settings, Camera, QrCode, Clock, TrendingUp, Heart, Gauge, Wrench,
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import { ChartContainer, chartDefaults } from '../../components/charts'
import { C } from './DeviceStatusBadge'
import { t } from '../../i18n/appI18n'

interface DeviceDetailData {
  id: string
  name: string
  manufacturer: string
  model: string
  modality: string
  status: string
  utilization: number
  avgExamTime: number
  maxExamTime: number
  minExamTime: number
  uptime: number
  mtbf: number
  healthScore: number
  totalRuntime: string
  faultCount: number
  maintCount: number
  acquisitionYear?: number
  serialNumber?: string
  purchaseDate?: string
  warrantyExpiry?: string
  purchasePrice?: number
  installationDate?: string
  installationLocation?: string
  assetCode?: string
  [key: string]: unknown
}

interface MaintRecord {
  id: string
  deviceId: string
  date: string
  content: string
  engineer: string
  cost: number
  result: string
}

interface DeviceStatsData {
  dates: string[]
  deviceUsageMap: Record<string, number[]>
}

interface ExamRoom {
  deviceId?: string
  name: string
  todaysBookings: number
  currentPatient?: string
}

// [G005 Wave1A P1-2] apiStats: deviceApi.getStats 真实统计 (检查量/使用率)
export function DeviceDetailPanel({ device, onClose, maintRecords, deviceStatsData, examRooms, extInfo, apiStats }: {
  device: DeviceDetailData
  onClose: () => void
  maintRecords: MaintRecord[]
  deviceStatsData: DeviceStatsData
  examRooms: ExamRoom[]
  extInfo: DeviceDetailData
  apiStats?: { todayExams: number; totalExams: number; usageMinutes: number } | null
}) {
  const room = examRooms.find(r => r.deviceId === device.id)

  const timelineHours = Array.from({ length: 25 }, (_, i) => {
    const busy = i >= 8 && i <= 12 || i >= 14 && i <= 17
    return { hour: i, busy: busy && Math.random() > 0.2, examCount: busy ? Math.floor(Math.random() * 4) : 0 }
  })

  const usageDates: string[] = deviceStatsData.dates
  const usageMap: Record<string, number[]> = deviceStatsData.deviceUsageMap
  const device7d: Array<{ date: string; count: number }> = []
  for (let i = 0; i < usageDates.length; i++) {
    device7d.push({ date: usageDates[i] ?? '', count: usageMap[device.id]?.[i] ?? 0 })
  }

  `DEVICE:${device.id}|${device.name}|${device.modality}|${extInfo.serialNumber || device.id}`;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
    }}>
      <div style={{
        background: C.white, borderRadius: 16, width: '100%', maxWidth: 900,
        maxHeight: '90vh', overflow: 'auto',
        boxShadow: '0 20px 60px rgba(30,58,95,0.25)'
      }}>
        <div style={{
          padding: '18px 24px', background: C.primary, color: '#fff',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          borderRadius: '16px 16px 0 0',
          position: 'sticky', top: 0, zIndex: 10
        }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Activity size={16} />
              {device.name}
            </div>
            <div style={{ fontSize: 12.5, opacity: 0.8, marginTop: 2 }}>
              {device.manufacturer} · {device.model} · {device.modality}
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8,
            padding: 8, cursor: 'pointer', color: '#fff', display: 'flex'
          }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: 24 }}>
          <div style={{
            background: 'var(--bg-card)', borderRadius: 12, padding: 18,
            border: `1px solid ${C.border}`, marginBottom: 20
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.primary, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Settings size={13} /> {t('deviceDetail.basicInfo')}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
              {[
                ['deviceDetail.deviceId', device.id],
                ['deviceDetail.deviceModel', device.model],
                ['deviceDetail.manufacturer', device.manufacturer],
                ['deviceDetail.deviceType', device.modality],
                ['deviceDetail.examRoom', room?.name || '-'],
                ['deviceDetail.installLocation', extInfo.installationLocation || '-'],
                ['deviceDetail.acquisitionYear', device.acquisitionYear ? `${device.acquisitionYear}年` : '-'],
                ['deviceDetail.currentStatus', device.status],
                ['deviceDetail.serialNumber', extInfo.serialNumber || '-'],
                ['deviceDetail.purchaseDate', extInfo.purchaseDate || '-'],
                ['deviceDetail.warrantyExpiry', extInfo.warrantyExpiry || '-'],
                ['deviceDetail.assetCode', extInfo.assetCode || '-'],
              ].map(([label, val]) => (
                <div key={label} style={{ background: C.white, borderRadius: 8, padding: '8px 12px', border: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 12, color: C.textLight }}>{t(label ?? '')}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.textDark, marginTop: 2 }}>{val}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, marginBottom: 20 }}>
            <div style={{
              background: 'var(--bg-card)', borderRadius: 12, padding: 18,
              border: `1px solid ${C.border}`
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.primary, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Camera size={13} /> {t('deviceDetail.devicePhoto')}
              </div>
              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                <div style={{
                  width: 180, height: 135,
                  background: `linear-gradient(135deg, ${C.primaryLighter} 0%, ${C.border} 100%)`,
                  borderRadius: 10, border: `2px dashed ${C.border}`,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  gap: 8, flexShrink: 0
                }}>
                  <Camera size={32} style={{ color: C.textLight }} />
                  <span style={{ fontSize: 12, color: C.textLight, textAlign: 'center' }}>{t('deviceDetail.photoPlaceholder')}</span>
                  <span style={{ fontSize: 12, color: C.textLight }}>{t('deviceDetail.clickToUpload')}</span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: C.textMid, marginBottom: 6 }}>{t('deviceDetail.deviceNameLabel')}{device.name}</div>
                  <div style={{ fontSize: 12, color: C.textMid, marginBottom: 6 }}>{t('deviceDetail.lastUpdatedLabel')}{extInfo.purchaseDate}</div>
                  <div style={{ fontSize: 12, color: C.textMid, marginBottom: 8 }}>{t('deviceDetail.photoStatusLabel')}{t('deviceDetail.pendingUpload')}</div>
                  <button style={{
                    padding: '6px 14px', borderRadius: 8, border: `1px solid ${C.accent}40`,
                    background: `${C.accent}10`, color: C.accent, fontSize: 12.5, fontWeight: 600, cursor: 'pointer'
                  }} onClick={async () => {
                    const btn = document.activeElement as HTMLButtonElement;
                    const originalText = btn.innerHTML;
                    btn.innerHTML = `${t('deviceDetail.uploading')}`;
                    btn.disabled = true;
                    await new Promise(r => setTimeout(r, 1500));
                    const photos = (() => { try { return JSON.parse(localStorage.getItem('g005_device_photos') || '[]') } catch { return [] } })();
                    photos.push({ deviceId: device.id, timestamp: new Date().toISOString() });
                    localStorage.setItem('g005_device_photos', JSON.stringify(photos));
                    btn.innerHTML = `${t('deviceDetail.uploaded')}`;
                    btn.style.color = C.success;
                    setTimeout(() => { btn.innerHTML = originalText; btn.disabled = false; btn.style.color = ''; }, 2000);
                  }}>
                    {t('deviceDetail.uploadPhoto')}
                  </button>
                </div>
              </div>
            </div>

            <div style={{
              background: 'var(--bg-card)', borderRadius: 12, padding: 18,
              border: `1px solid ${C.border}`, minWidth: 200
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.primary, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <QrCode size={13} /> {t('deviceDetail.qrBarcode')}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 120, height: 120,
                  background: C.white, borderRadius: 10, border: `1px solid ${C.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <QrCode size={48} style={{ color: C.primary }} />
                    <div style={{ fontSize: 8, color: C.textLight, marginTop: 2 }}>{t('deviceDetail.qrCode')}</div>
                  </div>
                </div>
                <div style={{
                  background: C.white, borderRadius: 8, padding: '8px 12px',
                  border: `1px solid ${C.border}`, width: '100%', textAlign: 'center'
                }}>
                  <div style={{
                    fontFamily: 'monospace', fontSize: 12, fontWeight: 700,
                    color: C.textDark, letterSpacing: 2, marginBottom: 2
                  }}>
                    {device.id.replace('DEV-', '')}
                  </div>
                  <div style={{ height: 2, background: `${C.textDark}`, margin: '2px 4px', borderRadius: 1 }} />
                  <div style={{ fontSize: 12, color: C.textLight, marginTop: 2 }}>{t('deviceDetail.barcode')}</div>
                </div>
                <div style={{ fontSize: 12, color: C.textLight, textAlign: 'center' }}>
                  {t('deviceDetail.scanForDetails')}
                </div>
              </div>
            </div>
          </div>

          <div style={{
            background: 'var(--bg-card)', borderRadius: 12, padding: 18,
            border: `1px solid ${C.border}`, marginBottom: 20
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.primary, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Activity size={13} /> {t('deviceDetail.realtimeStats')}
            </div>
            {apiStats ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                {[
                  { label: 'deviceDetail.todayExams', value: `${apiStats.todayExams} 例`, color: C.accent },
                  { label: 'deviceDetail.totalExams', value: `${apiStats.totalExams} 例`, color: C.primary },
                  { label: 'deviceDetail.todayUsageDuration', value: `${apiStats.usageMinutes} 分钟`, color: C.warning },
                  { label: 'deviceDetail.usageRate8h', value: `${Math.min(100, Math.round(apiStats.usageMinutes / 480 * 100))}%`, color: C.success },
                ].map(item => (
                  <div key={item.label} style={{
                    background: C.white, borderRadius: 10, padding: '12px 14px',
                    border: `1px solid ${C.border}`, textAlign: 'center'
                  }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: item.color }}>{item.value}</div>
                    <div style={{ fontSize: 12.5, color: C.textLight, marginTop: 3 }}>{t(item.label)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: 12, color: C.textLight, fontSize: 12 }}>
                {t('deviceDetail.loadingStats')}
              </div>
            )}
          </div>

          <div style={{
            background: 'var(--bg-card)', borderRadius: 12, padding: 18,
            border: `1px solid ${C.border}`, marginBottom: 20
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.primary, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Clock size={13} /> {t('deviceDetail.todayTimeline')}
            </div>
            <div style={{ display: 'flex', gap: 2, height: 60, alignItems: 'flex-end' }}>
              {timelineHours.map((th, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                  <div style={{
                    width: '100%', borderRadius: '2px 2px 0 0',
                    background: th.busy ? C.success : '#e2e8f0',
                    height: `${Math.max(4, th.examCount * 15)}px`,
                    transition: 'height 0.3s',
                  }} />
                  {i % 4 === 0 && (
                    <span style={{ fontSize: 8, color: C.textLight }}>{th.hour}</span>
                  )}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12.5, color: C.textMid }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: C.success }} /> {t('deviceDetail.inUse')}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12.5, color: C.textMid }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: '#e2e8f0' }} /> {t('deviceDetail.idle')}
              </span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
            <div style={{
              background: 'var(--bg-card)', borderRadius: 12, padding: 18,
              border: `1px solid ${C.border}`
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.primary, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <TrendingUp size={13} /> {t('deviceDetail.trend7d')}
              </div>
              <ChartContainer type="area" height={180}>
                <AreaChart data={device7d} margin={chartDefaults.margin}>
                  <CartesianGrid {...chartDefaults.grid} />
                  <XAxis dataKey="date" {...chartDefaults.axis} />
                  <YAxis {...chartDefaults.axis} />
                  <Tooltip {...chartDefaults.tooltip} contentStyle={{ borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 12 }} />
                  <Area type="monotone" dataKey="count" stroke={C.accent} fill={`${C.accent}22`} strokeWidth={2} />
                </AreaChart>
              </ChartContainer>
            </div>

            <div style={{
              background: 'var(--bg-card)', borderRadius: 12, padding: 18,
              border: `1px solid ${C.border}`
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.primary, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Heart size={13} /> {t('deviceDetail.healthScore')}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
                <div style={{ position: 'relative', width: 90, height: 90 }}>
                  <svg viewBox="0 0 36 36" style={{ width: 90, height: 90 }}>
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e2e8f0" strokeWidth="3.2" />
                    <circle
                      cx="18" cy="18" r="15.9" fill="none"
                      stroke={device.healthScore > 80 ? C.success : device.healthScore > 60 ? C.warning : C.danger}
                      strokeWidth="3.2"
                      strokeDasharray={`${device.healthScore} 100`}
                      strokeLinecap="round"
                      transform="rotate(-90 18 18)"
                    />
                  </svg>
                  <div style={{
                    position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center'
                  }}>
                    <span style={{ fontSize: 18, fontWeight: 800, color: C.textDark }}>{device.healthScore}</span>
                    <span style={{ fontSize: 8, color: C.textLight }}>{t('deviceDetail.healthScoreShort')}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10, fontSize: 12, color: C.textMid }}>
                  <span>{t('deviceDetail.runtimeLabel')}{device.totalRuntime}</span>
                </div>
                <div style={{ display: 'flex', gap: 10, fontSize: 12, color: C.textMid }}>
                  <span>{t('deviceDetail.faultCountLabel', { count: device.faultCount })}</span>
                  <span>{t('deviceDetail.maintCountLabel', { count: device.maintCount })}</span>
                </div>
              </div>
            </div>
          </div>

          <div style={{
            background: 'var(--bg-card)', borderRadius: 12, padding: 18,
            border: `1px solid ${C.border}`, marginBottom: 20
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.primary, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Clock size={13} /> {t('deviceDetail.lifecycle')}
            </div>
            <div style={{ position: 'relative', paddingLeft: 20 }}>
              <div style={{ position: 'absolute', left: 8, top: 0, bottom: 0, width: 2, background: C.border, borderRadius: 1 }} />
              {[
                { date: extInfo.purchaseDate || '2021-01', title: 'deviceDetail.event.procurement', desc: `采购金额 ¥${(extInfo.purchasePrice || 5000000).toLocaleString()}`, color: C.accent },
                { date: extInfo.installationDate || '2021-03', title: 'deviceDetail.event.installation', desc: `安装位置：${extInfo.installationLocation || '放射科'}`, color: C.info },
                { date: '2021-06', title: 'deviceDetail.event.commissioning', desc: 'deviceDetail.event.commissioningDesc', color: C.success },
                { date: extInfo.warrantyExpiry || '2026-01', title: 'deviceDetail.event.warrantyExpiry', desc: 'deviceDetail.event.warrantyExpiryDesc', color: C.warning },
                { date: new Date(Date.now() + 365 * 3 * 86400000).toISOString().slice(0, 10), title: 'deviceDetail.event.retirement', desc: 'deviceDetail.event.retirementDesc', color: C.danger },
              ].map((event, i) => (
                <div key={i} style={{ display: 'flex', gap: 14, marginBottom: 16, position: 'relative' }}>
                  <div style={{
                    position: 'absolute', left: -16, top: 3, width: 12, height: 12, borderRadius: '50%',
                    background: event.color, border: `2px solid ${C.white}`, zIndex: 1
                  }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: C.textDark }}>{t(event.title)}</span>
                      <span style={{ fontSize: 12.5, color: C.textLight }}>{event.date}</span>
                    </div>
                    <div style={{ fontSize: 12, color: C.textMid }}>{t(event.desc)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{
            background: 'var(--bg-card)', borderRadius: 12, padding: 18,
            border: `1px solid ${C.border}`, marginBottom: 20
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.primary, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Gauge size={13} /> {t('deviceDetail.performanceMetrics')}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {[
                { label: 'deviceDetail.avgExamTime', value: `${device.avgExamTime} 分钟`, color: C.accent },
                { label: 'deviceDetail.maxExamTime', value: `${device.maxExamTime} 分钟`, color: C.warning },
                { label: 'deviceDetail.minExamTime', value: `${device.minExamTime} 分钟`, color: C.success },
              ].map(item => (
                <div key={item.label} style={{
                  background: C.white, borderRadius: 10, padding: '12px 14px',
                  border: `1px solid ${C.border}`, textAlign: 'center'
                }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: item.color }}>{item.value}</div>
                  <div style={{ fontSize: 12.5, color: C.textLight, marginTop: 3 }}>{item.label}</div>
                </div>
              ))}
              <div style={{
                background: C.white, borderRadius: 10, padding: '12px 14px',
                border: `1px solid ${C.border}`, textAlign: 'center'
              }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: C.primary }}>{device.utilization}%</div>
                <div style={{ fontSize: 12.5, color: C.textLight, marginTop: 3 }}>设备利用率</div>
              </div>
              <div style={{
                background: C.white, borderRadius: 10, padding: '12px 14px',
                border: `1px solid ${C.border}`, textAlign: 'center'
              }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: C.primary }}>{device.uptime}%</div>
                <div style={{ fontSize: 12.5, color: C.textLight, marginTop: 3 }}>开机率</div>
              </div>
              <div style={{
                background: C.white, borderRadius: 10, padding: '12px 14px',
                border: `1px solid ${C.border}`, textAlign: 'center'
              }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: C.primary }}>{device.mtbf} 天</div>
                <div style={{ fontSize: 12.5, color: C.textLight, marginTop: 3 }}>MTBF（故障间隔）</div>
              </div>
            </div>
          </div>

          <div style={{
            background: 'var(--bg-card)', borderRadius: 12, padding: 18,
            border: `1px solid ${C.border}`
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.primary, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Wrench size={13} /> {t('deviceDetail.maintHistory')}
            </div>
            {maintRecords.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {maintRecords.map(record => (
                  <div key={record.id} style={{
                    background: C.white, borderRadius: 8, padding: '10px 14px',
                    border: `1px solid ${C.border}`, display: 'grid',
                    gridTemplateColumns: '100px 1fr 80px 80px 60px', gap: 10, alignItems: 'center'
                  }}>
                    <div style={{ fontSize: 12, color: C.textMid }}>{record.date}</div>
                    <div style={{ fontSize: 12, color: C.textDark, fontWeight: 600 }}>{record.content}</div>
                    <div style={{ fontSize: 12.5, color: C.textMid }}>{record.engineer}</div>
                    <div style={{ fontSize: 12.5, color: C.warning, fontWeight: 700 }}>¥{record.cost.toLocaleString()}</div>
                    <div style={{ fontSize: 12.5, color: C.success, fontWeight: 700 }}>{record.result}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: 20, color: C.textLight, fontSize: 12 }}>
              {t('deviceDetail.noMaintRecords')}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
