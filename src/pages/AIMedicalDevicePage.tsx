// @ts-nocheck
import { Card } from 'antd'
import React, { useState, useMemo, useEffect } from 'react'
import { Search, X, Eye, ChevronLeft, ChevronRight, Cpu, AlertCircle, CheckCircle, Clock, RefreshCw, Activity } from 'lucide-react'
import { aiPlatformApi } from '../services/api/aiPlatformApi'

// [v3.0.6.11-75] W1-2: 设备列表接入真实 GET /ai-platform/medical-devices (后端 prisma Device 表)
const DEVICE_STATE_LABELS = {
  IDLE: '空闲',
  IN_USE: '使用中',
  MAINTENANCE: '维护中',
  BROKEN: '故障',
  OFFLINE: '离线',
}
const DEVICE_STATE_STYLES = {
  IDLE: { bg: '#22c55e22', color: '#166534' },
  IN_USE: { bg: '#3b82f622', color: '#1e40af' },
  MAINTENANCE: { bg: '#f59e0b22', color: '#92400e' },
  BROKEN: { bg: '#ef444422', color: '#991b1b' },
  OFFLINE: { bg: '#e2e8f0', color: 'var(--text-secondary)' },
}

const DeviceStateBadge = ({ state }) => {
  const s = DEVICE_STATE_STYLES[state] || DEVICE_STATE_STYLES.IDLE
  const label = DEVICE_STATE_LABELS[state] || state || '未知'
  const icons = { IDLE: <CheckCircle size={12} />, IN_USE: <Activity size={12} />, MAINTENANCE: <Clock size={12} />, BROKEN: <AlertCircle size={12} />, OFFLINE: <AlertCircle size={12} /> }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 12, fontSize: 12, fontWeight: 600, background: s.bg, color: s.color }}>
      {icons[state] || <CheckCircle size={12} />} {label}
    </span>
  )
}

// 模拟50+条AI医疗器械注册证数据
const generateAIMedicalDevices = () => {
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

  const devices = []
  const today = new Date()

  for (let i = 1; i <= 55; i++) {
    const regNum = `国械注${2020 + (i % 5)}${String(i).padStart(6, '0')}`
    const manufacturer = manufacturers[i % manufacturers.length]
    const deviceType = deviceTypes[i % deviceTypes.length]
    const model = models[i % models.length]

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
      expiryDate: expiryDate.toISOString().split('T')[0],
      status: status,
      category: i % 3 === 0 ? '三类' : '二类',
      applicationArea: ['放射科', '病理科', '超声科', '内科', '外科', '眼科'][i % 6],
      certifiedDate: new Date(2020 + (i % 4), i % 11, 15).toISOString().split('T')[0],
      certificateOrg: '国家药品监督管理局',
      softwareVersion: `v${2 + (i % 3)}.${i % 10}.${i % 20}`,
      aiAlgorithm: ['深度学习', '机器学习', '卷积神经网络', '迁移学习'][i % 4],
      accuracy: (85 + (i % 15)).toFixed(1) + '%',
      approvedIndications: `适用于${['肺部', '乳腺', '心血管', '颅脑', '眼底', '皮肤'][i % 6]}影像的辅助诊断`,
    })
  }
  return devices
}

const allDevices = generateAIMedicalDevices()

// 状态徽章组件
const StatusBadge = ({ status }) => {
  const styles = {
    valid: { bg: '#22c55e22', color: '#166534', icon: <CheckCircle size={12} /> },
    expiring: { bg: '#f59e0b22', color: '#92400e', icon: <Clock size={12} /> },
    expired: { bg: '#ef444422', color: '#991b1b', icon: <AlertCircle size={12} /> },
  }
  const labels = { valid: '有效', expiring: '即将过期', expired: '已过期' }
  const s = styles[status] || styles.valid
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
  const [selectedDevice, setSelectedDevice] = useState(null)
  const pageSize = 20

  // [v3.0.6.11-75] 真实设备数据: GET /ai-platform/medical-devices
  const [devices, setDevices] = useState([])
  const [deviceSearch, setDeviceSearch] = useState('')
  const [deviceStateFilter, setDeviceStateFilter] = useState('all')
  const [devicePage, setDevicePage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedRealDevice, setSelectedRealDevice] = useState(null)

  const loadDevices = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await aiPlatformApi.listMedicalDevices()
      if (!res.success) {
        setError(res.error?.message ?? '设备数据加载失败')
        return
      }
      const rows = Array.isArray(res.data) ? res.data : (res.data?.data ?? [])
      setDevices(rows)
    } catch (e) {
      setError((e as Error)?.message ?? '设备数据加载失败')
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

  const totalPages = Math.ceil(filteredDevices.length / pageSize)
  const paginatedDevices = filteredDevices.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const formatDate = (dateStr) => {
    const d = new Date(dateStr)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  const isExpiringSoon = (dateStr) => {
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

  const modalityColor = (mod) => {
    const map = { CT: '#3b82f6', MR: '#8b5cf6', DR: '#10b981', MG: '#ec4899', US: '#06b6d4', PET: '#f59e0b', DSA: '#ef4444', CBCT: '#f59e0b' }
    return map[mod] || '#64748b'
  }

  const formatIsoDate = (v) => {
    if (!v) return '—'
    const d = new Date(v)
    if (Number.isNaN(d.getTime())) return String(v).slice(0, 10)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-info-bg)' }}>
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
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#fff' }}>AI 医疗器械管理</h1>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>
                {activeTab === 'devices'
                  ? <>设备 {devices.length} 台 | 空闲 {devices.filter(d => d.state === 'IDLE').length} | 使用中 {devices.filter(d => d.state === 'IN_USE').length} | 维护/故障 {devices.filter(d => ['MAINTENANCE', 'BROKEN', 'OFFLINE'].includes(d.state)).length}</>
                  : <>共 {counts.all} 条注册证记录 | 有效 {counts.valid} | 即将过期 {counts.expiring} | 已过期 {counts.expired}</>}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {activeTab === 'devices' && (
              <button onClick={() => void loadDevices()} disabled={loading}
                style={{
                  padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.4)',
                  background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: 13, fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                }}>
                <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
                同步设备
              </button>
            )}
          </div>
        </div>
        {/* Tab 切换 */}
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          {[
            { key: 'devices', label: `设备列表 (${devices.length})` },
            { key: 'certs', label: `注册证管理 (${counts.all})` },
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
              <button onClick={() => { setError(''); void loadDevices() }} style={{ background: 'none', border: 'none', color: '#991b1b', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>重试</button>
            </div>
          )}

          {/* 搜索 + 状态筛选 */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ flex: '1 1 280px', position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input
                type="text" value={deviceSearch}
                onChange={e => { setDeviceSearch(e.target.value); setDevicePage(1) }}
                placeholder="按设备编码/名称/厂商搜索..."
                style={{
                  width: '100%', padding: '10px 12px 10px 40px', border: '1px solid #dbeafe',
                  borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box',
                }}
              />
              {deviceSearch && (
                <X size={14} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', cursor: 'pointer' }}
                  onClick={() => { setDeviceSearch(''); setDevicePage(1) }} />
              )}
            </div>
            <select
              value={deviceStateFilter}
              onChange={e => { setDeviceStateFilter(e.target.value); setDevicePage(1) }}
              style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #dbeafe', fontSize: 13, outline: 'none', cursor: 'pointer' }}
            >
              <option value="all">全部状态</option>
              {Object.entries(DEVICE_STATE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v} ({devices.filter(d => d.state === k).length})</option>
              ))}
            </select>
          </div>

          {/* 设备表格 */}
          <Card bordered={false} style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid #dbeafe', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }} styles={{ body: { padding: 0 } }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--color-info-bg)', borderBottom: '2px solid #dbeafe' }}>
                    {['设备编码', '设备名称', '模态', '厂商', '位置', '状态', '今日检查', '今日用时(min)', '注册时间', '操作'].map(h => (
                      <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#1e40af', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRealDevices.slice((devicePage - 1) * pageSize, devicePage * pageSize).map((device, idx) => (
                    <tr key={device.id || device.code} style={{ borderBottom: idx < filteredRealDevices.length - 1 ? '1px solid #f0f9ff' : 'none', transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--color-info-bg)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td style={{ padding: '12px 16px', fontSize: 13, fontFamily: 'monospace', color: '#1e40af', fontWeight: 600 }}>{device.code}</td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>{device.name}</td>
                      <td style={{ padding: '12px 16px' }}><span style={{ background: modalityColor(device.modality), color: '#fff', padding: '2px 8px', borderRadius: 4, fontWeight: 600, fontSize: 12 }}>{device.modality}</span></td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-secondary)' }}>{device.manufacturer || '—'}</td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-secondary)' }}>{device.location || '—'}</td>
                      <td style={{ padding: '12px 16px' }}><DeviceStateBadge state={device.state} /></td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-primary)', textAlign: 'right' }}>{device.todayExams ?? 0}</td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-primary)', textAlign: 'right' }}>{device.todayUsageMin ?? 0}</td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-secondary)' }}>{formatIsoDate(device.createdAt)}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <button onClick={() => setSelectedRealDevice(device)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3b82f6', padding: '4px 8px', borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600 }}>
                          <Eye size={14} /> 详情
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {loading && <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-secondary)' }}>设备数据同步中…</div>}
            {!loading && filteredRealDevices.length === 0 && (
              <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-secondary)' }}>
                暂无设备数据{error ? '（接口异常）' : ''}
              </div>
            )}

            {/* 分页 */}
            {filteredRealDevices.length > 0 && (
              <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #dbeafe', background: 'var(--color-info-bg)' }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  显示 {(devicePage - 1) * pageSize + 1} - {Math.min(devicePage * pageSize, filteredRealDevices.length)} 条，共 {filteredRealDevices.length} 台设备
                </span>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button onClick={() => setDevicePage(p => Math.max(1, p - 1))} disabled={devicePage === 1}
                    style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #dbeafe', background: 'var(--bg-card)', cursor: devicePage === 1 ? 'not-allowed' : 'pointer', opacity: devicePage === 1 ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-primary)' }}>
                    <ChevronLeft size={14} /> 上一页
                  </button>
                  <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600 }}>{devicePage} / {Math.max(1, Math.ceil(filteredRealDevices.length / pageSize))}</span>
                  <button onClick={() => setDevicePage(p => Math.min(Math.ceil(filteredRealDevices.length / pageSize), p + 1))} disabled={devicePage >= Math.ceil(filteredRealDevices.length / pageSize)}
                    style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #dbeafe', background: 'var(--bg-card)', cursor: devicePage >= Math.ceil(filteredRealDevices.length / pageSize) ? 'not-allowed' : 'pointer', opacity: devicePage >= Math.ceil(filteredRealDevices.length / pageSize) ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-primary)' }}>
                    下一页 <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
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
              placeholder="按设备名称/注册证编号/厂商搜索..."
              style={{
                width: '100%', padding: '10px 12px 10px 40px', border: '1px solid #dbeafe',
                borderRadius: 8, fontSize: 13, outline: 'none', transition: 'border-color 0.2s',
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
              { key: 'all', label: '全部', count: counts.all },
              { key: 'valid', label: '有效', count: counts.valid },
              { key: 'expiring', label: '即将过期', count: counts.expiring },
              { key: 'expired', label: '已过期', count: counts.expired },
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
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--color-info-bg)', borderBottom: '2px solid #dbeafe' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#1e40af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>注册证编号</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#1e40af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>设备名称</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#1e40af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>型号</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#1e40af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>生产商</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#1e40af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>有效期</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#1e40af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>状态</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#1e40af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {paginatedDevices.map((device, idx) => (
                <tr key={device.id} style={{ borderBottom: idx < paginatedDevices.length - 1 ? '1px solid #f0f9ff' : 'none', transition: 'background 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--color-info-bg)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '12px 16px', fontSize: 13, fontFamily: 'monospace', color: '#1e40af', fontWeight: 600 }}>{device.regNumber}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-primary)' }}>{device.deviceName}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-secondary)' }}>{device.model}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-secondary)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{device.manufacturer}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: isExpiringSoon(device.expiryDate) ? '#d97706' : '#374151', fontWeight: isExpiringSoon(device.expiryDate) ? 600 : 400 }}>
                    {formatDate(device.expiryDate)}
                  </td>
                  <td style={{ padding: '12px 16px' }}><StatusBadge status={device.status} /></td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <button onClick={() => setSelectedDevice(device)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3b82f6', padding: '4px 8px', borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--color-info-bg)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <Eye size={14} /> 详情
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* 分页 */}
          <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #dbeafe', background: 'var(--color-info-bg)' }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              显示 {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, filteredDevices.length)} 条，共 {filteredDevices.length} 条
            </span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #dbeafe', background: 'var(--bg-card)', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', opacity: currentPage === 1 ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-primary)' }}>
                <ChevronLeft size={14} /> 上一页
              </button>
              <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600 }}>{currentPage} / {totalPages}</span>
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #dbeafe', background: 'var(--bg-card)', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', opacity: currentPage === totalPages ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-primary)' }}>
                下一页 <ChevronRight size={14} />
              </button>
            </div>
          </div>
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
                <span style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>注册证详情</span>
              </div>
              <button onClick={() => setSelectedDevice(null)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 6, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <X size={16} color="#fff" />
              </button>
            </div>
            {/* 弹窗内容 */}
            <div style={{ padding: 24 }}>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>注册证编号</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#1e40af', fontFamily: 'monospace' }}>{selectedDevice.regNumber}</div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>设备名称</div>
                <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 600 }}>{selectedDevice.deviceName}</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>型号</div>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{selectedDevice.model}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>分类</div>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{selectedDevice.category}</div>
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>生产商</div>
                <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{selectedDevice.manufacturer}</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>发证日期</div>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{formatDate(selectedDevice.certifiedDate)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>有效期至</div>
                  <div style={{ fontSize: 13, color: isExpiringSoon(selectedDevice.expiryDate) ? '#d97706' : '#374151', fontWeight: isExpiringSoon(selectedDevice.expiryDate) ? 600 : 400 }}>{formatDate(selectedDevice.expiryDate)}</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>发证机构</div>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{selectedDevice.certificateOrg}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>应用科室</div>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{selectedDevice.applicationArea}</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>软件版本</div>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)', fontFamily: 'monospace' }}>{selectedDevice.softwareVersion}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>AI算法</div>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{selectedDevice.aiAlgorithm}</div>
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>诊断准确率</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#059669' }}>{selectedDevice.accuracy}</div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>审批适应症</div>
                <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{selectedDevice.approvedIndications}</div>
              </div>
              <div style={{ marginBottom: 0 }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>状态</div>
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
                <span style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>设备详情</span>
              </div>
              <button onClick={() => setSelectedRealDevice(null)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 6, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <X size={16} color="#fff" />
              </button>
            </div>
            <div style={{ padding: 24 }}>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>设备编码</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#1e40af', fontFamily: 'monospace' }}>{selectedRealDevice.code}</div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>设备名称</div>
                <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 600 }}>{selectedRealDevice.name}</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>模态</div>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 700 }}>{selectedRealDevice.modality}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>状态</div>
                  <DeviceStateBadge state={selectedRealDevice.state} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>厂商</div>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{selectedRealDevice.manufacturer || '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>位置</div>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{selectedRealDevice.location || '—'}</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>今日检查</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#059669' }}>{selectedRealDevice.todayExams ?? 0} 例</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>今日用时</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#059669' }}>{selectedRealDevice.todayUsageMin ?? 0} min</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>注册时间</div>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{formatIsoDate(selectedRealDevice.createdAt)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>最近更新</div>
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