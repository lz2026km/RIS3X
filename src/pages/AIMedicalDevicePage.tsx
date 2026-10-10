import { Card, Select } from 'antd'
import type { TableColumnsType } from 'antd'
import { useState, useMemo, useEffect } from 'react'
import type { ReactNode } from 'react'
import { Search, X, Eye, Cpu, AlertCircle, CheckCircle, Clock, Activity } from 'lucide-react'
import { DataTable } from '../components/common/DataTable'
import { ActionButton } from '../components/common/ActionButton'
import { aiPlatformApi } from '../services/api/aiPlatformApi'
import type { AiPlatformMedicalDevice } from '../services/api/aiPlatformApi'
import { t } from '../i18n/appI18n'

// [v3.0.6.11-75] W1-2: 设备列表接入真实 GET /ai-platform/medical-devices (后端 prisma Device 表)
const DEVICE_STATE_LABELS: Record<string, string> = {
  IDLE: '空闲',
  IN_USE: '使用中',
  MAINTENANCE: '维护中',
  BROKEN: '故障',
  OFFLINE: '离线',
}
const DEVICE_STATE_STYLES: Record<string, { bg: string; color: string }> = {
  IDLE: { bg: '#22c55e22', color: '#166534' },
  IN_USE: { bg: '#3b82f622', color: '#1e40af' },
  MAINTENANCE: { bg: '#f59e0b22', color: '#92400e' },
  BROKEN: { bg: '#ef444422', color: '#991b1b' },
  OFFLINE: { bg: '#e2e8f0', color: 'var(--text-secondary)' },
}

const DeviceStateBadge = ({ state }: { state: string }) => {
  const s = DEVICE_STATE_STYLES[state] || DEVICE_STATE_STYLES.IDLE!
  const label = DEVICE_STATE_LABELS[state] || state || t('aiMedicalDevice.unknown')
  const icons: Record<string, ReactNode> = { IDLE: <CheckCircle size={12} />, IN_USE: <Activity size={12} />, MAINTENANCE: <Clock size={12} />, BROKEN: <AlertCircle size={12} />, OFFLINE: <AlertCircle size={12} /> }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 12, fontSize: 12, fontWeight: 600, background: s.bg, color: s.color }}>
      {icons[state] || <CheckCircle size={12} />} {label}
    </span>
  )
}

// 模拟50+条AI医疗器械注册证数据
interface AICertDevice {
  id: number
  regNumber: string
  deviceName: string
  model: string
  manufacturer: string
  expiryDate: string
  status: string
  category: string
  applicationArea: string
  certifiedDate: string
  certificateOrg: string
  softwareVersion: string
  aiAlgorithm: string
  accuracy: string
  approvedIndications: string
}

const generateAIMedicalDevices = (): AICertDevice[] => {
  const manufacturers = [
    '上海联影医疗科技有限公司', '北京推想医疗科技股份有限公司', '深圳腾讯医疗健康科技有限公司',
    '杭州阿里云计算有限公司', '科大讯飞股份有限公司', '华为技术有限公司',
    '北京昆仑万维科技股份有限公司', '四川大学华西医院', '北京医渡云科技有限公司',
    '平安智慧城市科技股份有限公司', '百度在线网络技术有限公司', '字节跳动科技有限公司'
  ]

  const deviceTypes = [
    'AI辅助诊断系统', '影像AI分析软件', '智能医学影像诊断系统', 'AI眼底病变检测软件',
    'AI肺结节辅助检测系统', '智能病理分析系统', 'AI心血管影像分析软件', '智能骨折检测系统',
    'AI乳腺钼靶分析系统', '智能皮肤病变检测系统', 'AI颅脑影像分析系统', '智能超声诊断辅助系统',
    'AI消化内镜辅助系统', '智能医学影像质控系统', 'AI医学影像增强处理系统'
  ]

  const models = [
    'UNIQ-2024-Pro', 'THINKING-AI-V3', 'Tencent-Health-AI', 'Ali-Cloud-Medical',
    'iFLYTEK-Med-2', 'Huawei-Med AI-5', 'Kunlun-Diagnosis-V2', 'WestChina-AI-2023',
    'YiduCloud-Med-1', 'PingAn-Smart-Med', 'Baidu-Medical-AI', 'ByteDance-MedTech',
    'SmartScan-Pro', 'ImageAI-Ultra', 'MedVision-Plus', 'AI-Reader-V4', 'Radiology-AI-X'
  ]

  const devices: AICertDevice[] = []
  const today = new Date()

  for (let i = 1; i <= 55; i++) {
    const regNum = `国械注${2020 + (i % 5)}${String(i).padStart(6, '0')}`
    const manufacturer = manufacturers[i % manufacturers.length]!
    const deviceType = deviceTypes[i % deviceTypes.length]!
    const model = models[i % models.length]!

    // 随机生成有效期：部分已过期、部分即将过期、部分有效
    let expiryDate
    let status
    const monthsOffset = (i % 12) - 5
    if (monthsOffset < -2) {
      expiryDate = new Date(today.getFullYear() - 1, (i % 11), (i % 28) + 1)
      status = 'expired'
    } else if (monthsOffset < 2) {
      expiryDate = new Date(today.getFullYear(), today.getMonth() + monthsOffset, (i % 28) + 1)
      status = 'expiring'
    } else {
      expiryDate = new Date(today.getFullYear() + (i % 3), (i % 11), (i % 28) + 1)
      status = 'valid'
    }

    devices.push({
      id: i,
      regNumber: regNum,
      deviceName: deviceType,
      model: model,
      manufacturer: manufacturer,
      expiryDate: expiryDate.toISOString().split('T')[0]!,
      status: status,
      category: i % 3 === 0 ? '三类' : '二类',
      applicationArea: ['放射科', '病理科', '超声科', '内科', '外科', '眼科'][i % 6]!,
      certifiedDate: new Date(2020 + (i % 4), i % 11, 15).toISOString().split('T')[0]!,
      certificateOrg: '国家药品监督管理局',
      softwareVersion: `v${2 + (i % 3)}.${i % 10}.${i % 20}`,
      aiAlgorithm: ['深度学习', '机器学习', '卷积神经网络', '迁移学习'][i % 4]!,
      accuracy: (85 + (i % 15)).toFixed(1) + '%',
      approvedIndications: `适用于${['肺部', '乳腺', '心血管', '颅脑', '眼底', '皮肤'][i % 6]!}影像的辅助诊断`,
    })
  }
  return devices
}

const allDevices = generateAIMedicalDevices()

// 状态徽章组件
const StatusBadge = ({ status }: { status: string }) => {
  const styles: Record<string, { bg: string; color: string; icon: ReactNode }> = {
    valid: { bg: '#22c55e22', color: '#166534', icon: <CheckCircle size={12} /> },
    expiring: { bg: '#f59e0b22', color: '#92400e', icon: <Clock size={12} /> },
    expired: { bg: '#ef444422', color: '#991b1b', icon: <AlertCircle size={12} /> },
  }
  const labels: Record<string, string> = { valid: '有效', expiring: '即将过期', expired: '已过期' }
  const s = styles[status] || styles.valid!
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 12, fontSize: 12, fontWeight: 600, background: s.bg, color: s.color }}>
      {s.icon} {labels[status]}
    </span>
  )
}

export default function AIMedicalDevicePage() {
  const [activeTab, setActiveTab] = useState('devices')
  const [searchText, setSearchText] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedDevice, setSelectedDevice] = useState<AICertDevice | null>(null)
  const pageSize = 20

  // [v3.0.6.11-75] 真实设备数据: GET /ai-platform/medical-devices
  const [devices, setDevices] = useState<AiPlatformMedicalDevice[]>([])
  const [deviceSearch, setDeviceSearch] = useState('')
  const [deviceStateFilter, setDeviceStateFilter] = useState('all')
  const [devicePage, setDevicePage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedRealDevice, setSelectedRealDevice] = useState<AiPlatformMedicalDevice | null>(null)

  const loadDevices = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await aiPlatformApi.listMedicalDevices()
      if (!res.success) {
        setError(res.error?.message ?? t('aiMedicalDevice.errLoad'))
        return
      }
      const rows = Array.isArray(res.data) ? res.data : (res.data?.data ?? [])
      setDevices(rows as AiPlatformMedicalDevice[])
    } catch (e) {
      setError((e as Error)?.message ?? t('aiMedicalDevice.errLoad'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadDevices()
  }, [])

  const filteredDevices = useMemo(() => {
    return allDevices.filter(d => {
      const matchSearch = !searchText || 
        d.deviceName.includes(searchText) || 
        d.regNumber.includes(searchText) || 
        d.manufacturer.includes(searchText)
      const matchStatus = statusFilter === 'all' || d.status === statusFilter
      return matchSearch && matchStatus
    })
  }, [searchText, statusFilter])

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  const isExpiringSoon = (dateStr: string) => {
    const d = new Date(dateStr)
    const today = new Date()
    const diffDays = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    return diffDays > 0 && diffDays <= 90
  }

  const counts = useMemo(() => ({
    all: allDevices.length,
    valid: allDevices.filter(d => d.status === 'valid').length,
    expiring: allDevices.filter(d => d.status === 'expiring').length,
    expired: allDevices.filter(d => d.status === 'expired').length,
  }), [])

  const filteredRealDevices = useMemo(() => {
    return devices.filter(d => {
      const matchSearch = !deviceSearch ||
        String(d.code || '').toLowerCase().includes(deviceSearch.toLowerCase()) ||
        String(d.name || '').toLowerCase().includes(deviceSearch.toLowerCase()) ||
        String(d.manufacturer || '').toLowerCase().includes(deviceSearch.toLowerCase())
      const matchState = deviceStateFilter === 'all' || d.state === deviceStateFilter
      return matchSearch && matchState
    })
  }, [devices, deviceSearch, deviceStateFilter])

  const modalityColor = (mod: string) => {
    const map: Record<string, string> = { CT: '#3b82f6', MR: '#8b5cf6', DR: '#10b981', MG: '#ec4899', US: '#06b6d4', PET: '#f59e0b', DSA: '#ef4444', CBCT: '#f59e0b' }
    return map[mod] || '#64748b'
  }

  const formatIsoDate = (v: string | number | Date | null | undefined) => {
    if (!v) return '—'
    const d = new Date(v)
    if (Number.isNaN(d.getTime())) return String(v).slice(0, 10)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  const deviceColumns: TableColumnsType<any> = [
    { title: t('aiMedicalDevice.colDeviceCode'), dataIndex: 'code', key: 'code', render: (v) => <span style={{ fontFamily: 'monospace', color: '#1e40af', fontWeight: 600 }}>{v}</span> },
    { title: t('aiMedicalDevice.colDeviceName'), dataIndex: 'name', key: 'name', render: (v) => <span style={{ fontWeight: 600 }}>{v}</span> },
    { title: t('aiMedicalDevice.colModality'), dataIndex: 'modality', key: 'modality', render: (v) => <span style={{ background: modalityColor(v), color: '#fff', padding: '2px 8px', borderRadius: 4, fontWeight: 600, fontSize: 12 }}>{v}</span> },
    { title: t('aiMedicalDevice.colManufacturer'), dataIndex: 'manufacturer', key: 'manufacturer', render: (v) => v || '—' },
    { title: t('aiMedicalDevice.colLocation'), dataIndex: 'location', key: 'location', render: (v) => v || '—' },
    { title: t('aiMedicalDevice.colStatus'), dataIndex: 'state', key: 'state', render: (v) => <DeviceStateBadge state={v} /> },
    { title: t('aiMedicalDevice.colTodayExams'), dataIndex: 'todayExams', key: 'todayExams', align: 'right', render: (v) => v ?? 0 },
    { title: t('aiMedicalDevice.colTodayUsage'), dataIndex: 'todayUsageMin', key: 'todayUsageMin', align: 'right', render: (v) => v ?? 0 },
    { title: t('aiMedicalDevice.colRegisteredAt'), dataIndex: 'createdAt', key: 'createdAt', render: (v) => formatIsoDate(v) },
    {
      title: t('aiMedicalDevice.colAction'), key: 'action', align: 'center',
      render: (_, device) => (
        <button onClick={() => setSelectedRealDevice(device)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3b82f6', padding: '4px 8px', borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600 }}>
          <Eye size={14} /> {t('aiMedicalDevice.detail')}
        </button>
      ),
    },
  ]

  const certColumns: TableColumnsType<AICertDevice> = [
    { title: t('aiMedicalDevice.colCertNo'), dataIndex: 'regNumber', key: 'regNumber', render: (v) => <span style={{ fontFamily: 'monospace', color: '#1e40af', fontWeight: 600 }}>{v}</span> },
    { title: t('aiMedicalDevice.colDeviceName'), dataIndex: 'deviceName', key: 'deviceName' },
    { title: t('aiMedicalDevice.colModel'), dataIndex: 'model', key: 'model' },
    { title: t('aiMedicalDevice.colManufacturer'), dataIndex: 'manufacturer', key: 'manufacturer', ellipsis: true },
    { title: t('aiMedicalDevice.colExpiry'), dataIndex: 'expiryDate', key: 'expiryDate', render: (v) => <span style={{ color: isExpiringSoon(v) ? '#d97706' : undefined, fontWeight: isExpiringSoon(v) ? 600 : 400 }}>{formatDate(v)}</span> },
    { title: t('aiMedicalDevice.colStatus'), dataIndex: 'status', key: 'status', render: (v) => <StatusBadge status={v} /> },
    {
      title: t('aiMedicalDevice.colAction'), key: 'action', align: 'center',
      render: (_, device) => (
        <button onClick={() => setSelectedDevice(device)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3b82f6', padding: '4px 8px', borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600 }}>
          <Eye size={14} /> {t('aiMedicalDevice.detail')}
        </button>
      ),
    },
  ]

  return (
    <div style={{ background: 'var(--color-info-bg)' }}>
      {/* 蓝色渐变卡片头部 */}
      <div style={{
        background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 50%, #60a5fa 100%)',
        padding: '24px 32px',
        borderBottom: '1px solid #dbeafe',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 48, height: 48, background: 'rgba(255,255,255,0.2)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Cpu size={24} color="#fff" />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#fff' }}>{t('aiMedicalDevice.title')}</h1>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>
                {activeTab === 'devices'
                  ? <>{t('aiMedicalDevice.devicesSummaryPrefix')} {devices.length} {t('aiMedicalDevice.unitsUnit')} | {t('aiMedicalDevice.idleLabel')} {devices.filter(d => d.state === 'IDLE').length} | {t('aiMedicalDevice.inUseLabel')} {devices.filter(d => d.state === 'IN_USE').length} | {t('aiMedicalDevice.maintenanceFaultLabel')} {devices.filter(d => ['MAINTENANCE', 'BROKEN', 'OFFLINE'].includes(d.state)).length}</>
                  : <>{t('aiMedicalDevice.certsSummaryPrefix')} {counts.all} {t('aiMedicalDevice.certsCountUnit')} | {t('aiMedicalDevice.validLabel')} {counts.valid} | {t('aiMedicalDevice.expiringLabel')} {counts.expiring} | {t('aiMedicalDevice.expiredLabel')} {counts.expired}</>}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {activeTab === 'devices' && (
              <ActionButton action="refresh" loading={loading} onClick={() => void loadDevices()}>
                {t('aiMedicalDevice.syncDevices')}
              </ActionButton>
            )}
          </div>
        </div>
        {/* Tab 切换 */}
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          {[
            { key: 'devices', label: `${t('aiMedicalDevice.tabDevices')} (${devices.length})` },
            { key: 'certs', label: `${t('aiMedicalDevice.tabCerts')} (${counts.all})` },
          ].map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                background: activeTab === tab.key ? '#fff' : 'rgba(255,255,255,0.15)',
                color: activeTab === tab.key ? '#1e40af' : '#fff',
                transition: 'all 0.2s',
              }}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'devices' && (
        <div style={{ padding: '20px 32px' }}>
          {error && (
            <div style={{
              padding: '10px 14px', borderRadius: 8, background: 'var(--color-error-bg)', color: '#991b1b', fontSize: 12, marginBottom: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span>{error}</span>
              <button onClick={() => { setError(''); void loadDevices() }} style={{ background: 'none', border: 'none', color: '#991b1b', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>{t('aiMedicalDevice.retry')}</button>
            </div>
          )}

          {/* 搜索 + 状态筛选 */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ flex: '1 1 280px', position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input
                type="text" value={deviceSearch}
                onChange={e => { setDeviceSearch(e.target.value); setDevicePage(1) }}
                placeholder={t('aiMedicalDevice.deviceSearchPlaceholder')}
                style={{
                  width: '100%', padding: '10px 12px 10px 40px', border: '1px solid #dbeafe',
                  borderRadius: 8, fontSize: 13, boxSizing: 'border-box',
                }}
              />
              {deviceSearch && (
                <X size={14} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', cursor: 'pointer' }}
                  onClick={() => { setDeviceSearch(''); setDevicePage(1) }} />
              )}
            </div>
            <Select
              value={deviceStateFilter}
              onChange={v => { setDeviceStateFilter(v); setDevicePage(1) }}
              style={{ minWidth: 160 }}
              options={[
                { value: 'all', label: t('aiMedicalDevice.allStatus') },
                ...Object.entries(DEVICE_STATE_LABELS).map(([k, v]) => ({
                  value: k,
                  label: `${v} (${devices.filter(d => d.state === k).length})`,
                })),
              ]}
            />
          </div>

          {/* 设备表格 */}
          <Card bordered={false} style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid #dbeafe', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }} styles={{ body: { padding: 0 } }}>
            <DataTable
              rowKey={(r) => r.id || r.code}
              columns={deviceColumns}
              dataSource={filteredRealDevices}
              loading={loading}
              pageSize={pageSize}
              emptyText={`${t('aiMedicalDevice.noDeviceData')}${error ? t('aiMedicalDevice.apiErrorSuffix') : ''}`}
              pagination={{ current: devicePage, pageSize, onChange: (p) => setDevicePage(p) }}
            />
          </Card>
        </div>
      )}

      {activeTab === 'certs' && (
        <>
      {/* 搜索和筛选区域 */}
      <div style={{ padding: '20px 32px', background: 'var(--bg-card)', borderBottom: '1px solid #dbeafe' }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* 搜索框 */}
          <div style={{ flex: '1 1 300px', position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            <input
              type="text"
              value={searchText}
              onChange={e => { setSearchText(e.target.value); setCurrentPage(1) }}
              placeholder={t('aiMedicalDevice.certSearchPlaceholder')}
              style={{
                width: '100%', padding: '10px 12px 10px 40px', border: '1px solid #dbeafe',
                borderRadius: 8, fontSize: 13, transition: 'border-color 0.2s',
                boxSizing: 'border-box'
              }}
              onFocus={e => e.target.style.borderColor = '#3b82f6'}
              onBlur={e => e.target.style.borderColor = '#dbeafe'}
            />
            {searchText && (
              <X size={14} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', cursor: 'pointer' }}
                onClick={() => { setSearchText(''); setCurrentPage(1) }} />
            )}
          </div>

          {/* 状态筛选按钮 */}
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { key: 'all', label: t('aiMedicalDevice.filterAll'), count: counts.all },
              { key: 'valid', label: t('aiMedicalDevice.filterValid'), count: counts.valid },
              { key: 'expiring', label: t('aiMedicalDevice.filterExpiring'), count: counts.expiring },
              { key: 'expired', label: t('aiMedicalDevice.filterExpired'), count: counts.expired },
            ].map(btn => (
              <button
                key={btn.key}
                onClick={() => { setStatusFilter(btn.key); setCurrentPage(1) }}
                style={{
                  padding: '8px 16px', borderRadius: 8, border: '1px solid',
                  borderColor: statusFilter === btn.key ? '#3b82f6' : '#dbeafe',
                  background: statusFilter === btn.key ? '#eff6ff' : '#fff',
                  color: statusFilter === btn.key ? '#1e40af' : '#64748b',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                {btn.label} <span style={{ opacity: 0.7 }}>({btn.count})</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 表格区域 */}
      <div style={{ padding: '20px 32px' }}>
        <Card bordered={false} style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid #dbeafe', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }} styles={{ body: { padding: 0 } }}>
          <DataTable
            rowKey="id"
            columns={certColumns}
            dataSource={filteredDevices}
            pageSize={pageSize}
            pagination={{ current: currentPage, pageSize, onChange: (p) => setCurrentPage(p) }}
          />
        </Card>
      </div>

      {/* 详情弹窗 */}
      {selectedDevice && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={() => setSelectedDevice(null)}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 16, width: 560, maxHeight: '80vh', overflow: 'auto', boxShadow: '0 25px 50px rgba(0,0,0,0.25)' }}
            onClick={e => e.stopPropagation()}>
            {/* 弹窗头部 */}
            <div style={{ padding: '20px 24px', background: 'linear-gradient(135deg, #1e40af, #3b82f6)', borderRadius: '16px 16px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Cpu size={20} color="#fff" />
                <span style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>{t('aiMedicalDevice.certDetail')}</span>
              </div>
              <ActionButton action="cancel" variant="text" style={{ color: '#fff' }} onClick={() => setSelectedDevice(null)} />
            </div>
            {/* 弹窗内容 */}
            <div style={{ padding: 24 }}>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{t('aiMedicalDevice.colCertNo')}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#1e40af', fontFamily: 'monospace' }}>{selectedDevice.regNumber}</div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{t('aiMedicalDevice.colDeviceName')}</div>
                <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 600 }}>{selectedDevice.deviceName}</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{t('aiMedicalDevice.colModel')}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{selectedDevice.model}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{t('aiMedicalDevice.category')}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{selectedDevice.category}</div>
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{t('aiMedicalDevice.colManufacturer')}</div>
                <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{selectedDevice.manufacturer}</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{t('aiMedicalDevice.certifiedDate')}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{formatDate(selectedDevice.certifiedDate)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{t('aiMedicalDevice.expiryTo')}</div>
                  <div style={{ fontSize: 13, color: isExpiringSoon(selectedDevice.expiryDate) ? '#d97706' : 'var(--text-primary)', fontWeight: isExpiringSoon(selectedDevice.expiryDate) ? 600 : 400 }}>{formatDate(selectedDevice.expiryDate)}</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{t('aiMedicalDevice.certOrg')}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{selectedDevice.certificateOrg}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{t('aiMedicalDevice.applicationDept')}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{selectedDevice.applicationArea}</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{t('aiMedicalDevice.softwareVersion')}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: 'monospace' }}>{selectedDevice.softwareVersion}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{t('aiMedicalDevice.aiAlgorithm')}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{selectedDevice.aiAlgorithm}</div>
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{t('aiMedicalDevice.diagnosticAccuracy')}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#059669' }}>{selectedDevice.accuracy}</div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{t('aiMedicalDevice.approvedIndications')}</div>
                <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{selectedDevice.approvedIndications}</div>
              </div>
              <div style={{ marginBottom: 0 }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{t('aiMedicalDevice.colStatus')}</div>
                <StatusBadge status={selectedDevice.status} />
              </div>
            </div>
          </div>
        </div>
      )}
        </>
      )}

      {/* 真实设备详情弹窗 */}
      {selectedRealDevice && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={() => setSelectedRealDevice(null)}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 16, width: 560, maxHeight: '80vh', overflow: 'auto', boxShadow: '0 25px 50px rgba(0,0,0,0.25)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ padding: '20px 24px', background: 'linear-gradient(135deg, #1e40af, #3b82f6)', borderRadius: '16px 16px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Cpu size={20} color="#fff" />
                <span style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>{t('aiMedicalDevice.deviceDetail')}</span>
              </div>
              <ActionButton action="cancel" variant="text" style={{ color: '#fff' }} onClick={() => setSelectedRealDevice(null)} />
            </div>
            <div style={{ padding: 24 }}>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{t('aiMedicalDevice.colDeviceCode')}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#1e40af', fontFamily: 'monospace' }}>{selectedRealDevice.code}</div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{t('aiMedicalDevice.colDeviceName')}</div>
                <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 600 }}>{selectedRealDevice.name}</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{t('aiMedicalDevice.colModality')}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 700 }}>{selectedRealDevice.modality}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{t('aiMedicalDevice.colStatus')}</div>
                  <DeviceStateBadge state={selectedRealDevice.state} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{t('aiMedicalDevice.colManufacturer')}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{selectedRealDevice.manufacturer || '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{t('aiMedicalDevice.colLocation')}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{selectedRealDevice.location || '—'}</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{t('aiMedicalDevice.colTodayExams')}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#059669' }}>{selectedRealDevice.todayExams ?? 0} {t('aiMedicalDevice.casesUnit')}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{t('aiMedicalDevice.todayUsage')}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#059669' }}>{selectedRealDevice.todayUsageMin ?? 0} min</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{t('aiMedicalDevice.colRegisteredAt')}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{formatIsoDate(selectedRealDevice.createdAt)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{t('aiMedicalDevice.lastUpdated')}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{formatIsoDate(selectedRealDevice.updatedAt)}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}