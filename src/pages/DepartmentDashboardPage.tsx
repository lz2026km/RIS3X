// @deprecated [v3.0.6.11-104 Wave 5C] 已收敛至 DeptDashboardPage (/dept-dashboard); 旧路由 /department-dashboard redirect 兼容。文件保留供回滚参考。
import React, { useState, useEffect } from 'react';
// [v3.0.6.11-103 Wave 6] 仪表盘卡片化组件
import { KpiCard, KpiCardGrid, DashboardCard, ProgressRing, SkeletonKpi } from '../components/dashboard';
import { Users, FileCheck2, AlertTriangle, Clock3, Monitor, Cpu, Activity, Scan, Magnet, Camera, Radio, Syringe, Microscope, Atom } from 'lucide-react';
import { t } from '../i18n/appI18n';

const DEVICE_STATUS_I18N: Record<string, string> = { '运行中': 'deptDash.status.running', '空闲': 'deptDash.status.idle', '维护中': 'deptDash.status.maintenance' }
const DEVICE_TYPE_I18N: Record<string, string> = { 'X线': 'deptDash.type.xray', '超声': 'deptDash.type.ultrasound', '乳腺': 'deptDash.type.mammography' }
const EXAM_TYPE_I18N: Record<string, string> = { 'CT平扫': 'deptDash.exam.ctPlain', 'CT增强': 'deptDash.exam.ctContrast', 'MRI平扫': 'deptDash.exam.mriPlain', 'MRI增强': 'deptDash.exam.mriContrast', 'X线摄影': 'deptDash.exam.xray', '超声检查': 'deptDash.exam.ultrasound', 'DSA造影': 'deptDash.exam.dsa', 'MG': 'MG', 'PET-CT': 'PET-CT', 'SPECT-CT': 'SPECT-CT' }

// 放射科设备数据 - 扩充版
const devices = [
  { id: 'CT-001', name: 'SOMATOM Force', type: 'CT', status: '运行中', patients: 12, manufacturer: '西门子', room: 'CT1室', utilization: 92 },
  { id: 'CT-002', name: 'SOMATOM Drive', type: 'CT', status: '运行中', patients: 8, manufacturer: '西门子', room: 'CT2室', utilization: 78 },
  { id: 'CT-003', name: 'Revolution Apex', type: 'CT', status: '空闲', patients: 0, manufacturer: 'GE', room: 'CT3室', utilization: 45 },
  { id: 'MRI-001', name: 'Prisma 3T', type: 'MRI', status: '运行中', patients: 6, manufacturer: '西门子', room: 'MRI1室', utilization: 88 },
  { id: 'MRI-002', name: 'Signa Premier 3T', type: 'MRI', status: '运行中', patients: 5, manufacturer: 'GE', room: 'MRI2室', utilization: 82 },
  { id: 'MRI-003', name: 'MAGNETOM Vida 3T', type: 'MRI', status: '维护中', patients: 0, manufacturer: '西门子', room: 'MRI3室', utilization: 0 },
  { id: 'Xray-001', name: 'DigitalDiagnost', type: 'X线', status: '运行中', patients: 9, manufacturer: '飞利浦', room: 'X线1室', utilization: 95 },
  { id: 'Xray-002', name: 'Mobilett Mira Max', type: 'X线', status: '运行中', patients: 4, manufacturer: '西门子', room: 'X线2室(移动)', utilization: 68 },
  { id: 'Xray-003', name: 'DR-600', type: 'X线', status: '空闲', patients: 0, manufacturer: '岛津', room: 'X线3室', utilization: 52 },
  { id: 'US-001', name: 'Resona 7', type: '超声', status: '运行中', patients: 7, manufacturer: '迈瑞', room: '超声1室', utilization: 85 },
  { id: 'US-002', name: 'LOGIQ E20', type: '超声', status: '运行中', patients: 5, manufacturer: 'GE', room: '超声2室', utilization: 76 },
  { id: 'US-003', name: 'Aixplorer', type: '超声', status: '空闲', patients: 0, manufacturer: '声科', room: '超声3室', utilization: 40 },
  { id: 'DSA-001', name: 'Artis Q', type: 'DSA', status: '运行中', patients: 2, manufacturer: '西门子', room: '导管室1', utilization: 72 },
  { id: 'DSA-002', name: 'Azurion 7', type: 'DSA', status: '空闲', patients: 0, manufacturer: '飞利浦', room: '导管室2', utilization: 35 },
  { id: 'MG-001', name: 'Senographe Pristina', type: '乳腺', status: '运行中', patients: 3, manufacturer: 'GE', room: '乳腺室', utilization: 65 },
  { id: 'MG-002', name: 'Mammomat Revelation', type: '乳腺', status: '空闲', patients: 0, manufacturer: '西门子', room: '乳腺室2', utilization: 28 },
  { id: 'PETCT-001', name: 'Biograph Vision 600', type: 'PET-CT', status: '运行中', patients: 2, manufacturer: '西门子', room: '核医学科', utilization: 58 },
  { id: 'SPECT-001', name: 'Symbia Intevo Bold', type: 'SPECT-CT', status: '空闲', patients: 0, manufacturer: '西门子', room: '核医学科', utilization: 25 },
];

// 检查类型统计 - 扩充版
const examStats = [
  { type: 'CT平扫', total: 245, pending: 28, completed: 217, avgTime: 15 },
  { type: 'CT增强', total: 189, pending: 35, completed: 154, avgTime: 25 },
  { type: 'MRI平扫', total: 156, pending: 22, completed: 134, avgTime: 30 },
  { type: 'MRI增强', total: 128, pending: 18, completed: 110, avgTime: 45 },
  { type: 'X线摄影', total: 412, pending: 56, completed: 356, avgTime: 8 },
  { type: '超声检查', total: 298, pending: 32, completed: 266, avgTime: 20 },
  { type: 'DSA造影', total: 45, pending: 8, completed: 37, avgTime: 90 },
  { type: 'MG', total: 86, pending: 12, completed: 74, avgTime: 12 },
  { type: 'PET-CT', total: 28, pending: 5, completed: 23, avgTime: 60 },
  { type: 'SPECT-CT', total: 18, pending: 3, completed: 15, avgTime: 45 },
];

// 今日放射科统计数据
const todayStats = {
  totalPatients: 1605,
  completedToday: 1386,
  pendingReports: 219,
  avgWaitTime: '22分钟',
  activeDevices: 14,
  totalDevices: 18,
  criticalValue: 12,
  urgentConsult: 8,
};

// 时钟刷新 (仅展示当前时间, 数据本身为示例/接口获取)
const useRealtimeData = () => {
  const [time, setTime] = useState(() => new Date());
  
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') setTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);
  
  return time;
};

const DepartmentDashboardPage: React.FC = () => {
  const currentTime = useRealtimeData();
  const [loading] = useState(false);
  const [error] = useState<string | null>(null);
  // [G005 Wave4A P1] KPI 真实化: statsApi.getDaily/getWorkload 优先, 失败回退 todayStats (演示徽标)
  const [kpi, setKpi] = useState({ ...todayStats });
  const [dataMode, setDataMode] = useState<'real' | 'demo'>('demo');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { statsApi } = await import('../services/api/statsApi');
        const [daily, workload] = await Promise.all([statsApi.getDaily(), statsApi.getWorkload()]);
        if (cancelled) return;
        if (daily.success && daily.data && workload.success && Array.isArray(workload.data) && workload.data.length > 0) {
          setKpi(prev => ({
            ...prev,
            totalPatients: daily.data.examCount ?? prev.totalPatients,
            completedToday: daily.data.reportCount ?? prev.completedToday,
            pendingReports: daily.data.defectCount ?? prev.pendingReports,
            activeDevices: workload.data.length > 0 ? workload.data.length : prev.activeDevices,
          }));
          setDataMode('real');
        }
      } catch { /* 保持演示数据 */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const dataAvailable = devices.length > 0;

  // 样式定义
  const styles = {
    container: {
      minHeight: '100vh',
      backgroundColor: 'var(--bg-card)',
      padding: '24px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    },
    header: {
      backgroundColor: 'var(--bg-card)',
      borderRadius: '12px',
      padding: '24px',
      marginBottom: '24px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    },
    headerTitle: {
      fontSize: '24px',
      fontWeight: '600',
      color: 'var(--text-primary)',
      marginBottom: '8px',
    },
    headerSubtitle: {
      fontSize: '14px',
      color: 'var(--text-secondary)',
    },
    statsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
      gap: '16px',
      marginBottom: '24px',
    },
    statCard: {
      backgroundColor: 'var(--bg-card)',
      borderRadius: '12px',
      padding: '20px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    },
    statValue: {
      fontSize: '32px',
      fontWeight: '700',
      color: 'var(--text-primary)',
      marginBottom: '4px',
    },
    statLabel: {
      fontSize: '14px',
      color: 'var(--text-secondary)',
    },
    sectionGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: '24px',
      marginBottom: '24px',
    },
    card: {
      backgroundColor: 'var(--bg-card)',
      borderRadius: '12px',
      padding: '24px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    },
    cardTitle: {
      fontSize: '18px',
      fontWeight: '600',
      color: 'var(--text-primary)',
      marginBottom: '16px',
    },
    deviceItem: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '12px 0',
      borderBottom: '1px solid var(--border-color)',
    },
    deviceInfo: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
    },
    deviceIcon: {
      width: '40px',
      height: '40px',
      borderRadius: '8px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '20px',
    },
    deviceName: {
      fontSize: '14px',
      fontWeight: '500',
      color: 'var(--text-primary)',
    },
    deviceType: {
      fontSize: '12px',
      color: 'var(--text-secondary)',
    },
    statusBadge: {
      padding: '4px 12px',
      borderRadius: '20px',
      fontSize: '12px',
      fontWeight: '500',
    },
    examTypeRow: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '12px 0',
      borderBottom: '1px solid var(--border-color)',
    },
    progressBar: {
      height: '8px',
      backgroundColor: '#e2e8f0',
      borderRadius: '4px',
      overflow: 'hidden',
      marginTop: '8px',
    },
    progressFill: {
      height: '100%',
      borderRadius: '4px',
      transition: 'width 0.3s ease',
    },
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case '运行中': return { bg: '#22c55e22', text: '#166534' };
      case '空闲': return { bg: '#f59e0b22', text: '#92400e' };
      case '维护中': return { bg: '#ef444422', text: '#991b1b' };
      default: return { bg: 'var(--bg-deep)', text: '#475569' };
    }
  };

  const getExamIcon = (type: string) => {
    const Ico = type.startsWith('CT') ? Scan
      : type.startsWith('MRI') || type.startsWith('MR') ? Magnet
      : type.startsWith('X线') ? Camera
      : type.startsWith('超声') ? Radio
      : type.startsWith('DSA') ? Syringe
      : type.startsWith('PET') || type.startsWith('SPECT') ? Atom
      : Microscope;
    return <Ico size={18} />;
  };

  const getExamColor = (type: string) => {
    switch (type) {
      case 'CT': return '#3b82f6';
      case 'MRI': return '#8b5cf6';
      case 'X线': return '#06b6d4';
      case '超声': return '#10b981';
      case 'DSA': return '#f59e0b';
      default: return '#64748b';
    }
  };

  if (loading) {
    // [v3.0.6.11-103 Wave 6] 骨架屏加载态
    return (
      <div role="status" data-testid="dept-loading" style={{ padding: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
          {Array.from({ length: 5 }, (_, i) => <SkeletonKpi key={i} />)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ height: 320, borderRadius: 12, background: 'var(--skeleton-bg, #e2e8f0)', animation: 'pulse 1.5s ease-in-out infinite' }} />
          <div style={{ height: 320, borderRadius: 12, background: 'var(--skeleton-bg, #e2e8f0)', animation: 'pulse 1.5s ease-in-out infinite' }} />
        </div>
      </div>
    );
  }
  if (error) return <div role="alert" data-testid="dept-error" style={{ padding: 40, textAlign: 'center', color: '#dc2626' }}>{error}</div>;
  if (!dataAvailable) {
    return (
      <div data-testid="dept-empty" style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
        <div style={{ fontSize: 14, marginBottom: 12 }}>{t('deptDash.noData')}</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('deptDash.noDataHint')}</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* 头部 */}
      <div style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={styles.headerTitle}>{t('deptDash.title')}</div>
          {/* [G005 Wave4A P1] 数据源徽标 */}
          <span style={{
            fontSize: 12, fontWeight: 600, padding: '2px 10px', borderRadius: 10,
            background: dataMode === 'real' ? 'var(--color-success-bg)' : 'var(--color-warning-bg)',
            color: dataMode === 'real' ? '#15803d' : '#92400e',
          }}>
            {dataMode === 'real' ? t('deptDash.realData') : t('deptDash.demoData')}
          </span>
        </div>
        <div style={styles.headerSubtitle}>
          {t('deptDash.subtitle', { time: currentTime.toLocaleString('zh-CN') })}
          {dataMode === 'demo' && <span style={{ marginLeft: 8 }}>{t('deptDash.demoNote')}</span>}
        </div>
      </div>

      {/* 统计卡片 (v3.0.6.11-103 Wave 6: KpiCard 卡片化) */}
      <KpiCardGrid minWidth={230} style={{ marginBottom: 24 }}>
        <KpiCard title={t('deptDash.kpiTotalPatients')} value={kpi.totalPatients} icon={<Users size={20} />} color="primary" />
        <KpiCard title={t('deptDash.kpiCompleted')} value={kpi.completedToday} icon={<FileCheck2 size={20} />} color="success" />
        <KpiCard title={t('deptDash.kpiPendingReports')} value={kpi.pendingReports} icon={<AlertTriangle size={20} />} color="error" />
        <KpiCard title={t('deptDash.kpiAvgWait')} value={kpi.avgWaitTime} icon={<Clock3 size={20} />} color="warning" />
        <KpiCard title={t('deptDash.kpiDeviceStatus')} value={`${kpi.activeDevices}/${kpi.totalDevices}`} suffix={t('deptDash.unitDevices')} icon={<Monitor size={20} />} color="info" />
      </KpiCardGrid>

      {/* 双栏布局 */}
      <div style={styles.sectionGrid}>
        {/* 设备状态 */}
        <DashboardCard
          title={t('deptDash.deviceMonitor')}
          icon={<Cpu size={14} />}
          extra={
            <ProgressRing
              percent={Math.round((kpi.activeDevices / Math.max(kpi.totalDevices, 1)) * 100)}
              size={52}
              strokeWidth={6}
              subLabel={t('deptDash.runningRate')}
            />
          }
        >
          {devices.map((device) => {
            const statusColor = getStatusColor(device.status);
            return (
              <div key={device.id} style={styles.deviceItem}>
                <div style={styles.deviceInfo}>
                  <div style={{
                    ...styles.deviceIcon,
                    backgroundColor: getExamColor(device.type) + '20',
                  }}>
                    {getExamIcon(device.type)}
                  </div>
                  <div>
                    <div style={styles.deviceName}>{device.name}</div>
                    <div style={styles.deviceType}>{t(DEVICE_TYPE_I18N[device.type] ?? device.type)} | {device.id}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {device.patients > 0 && (
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {t('deptDash.patientsInExam', { count: device.patients })}
                    </span>
                  )}
                  <span style={{
                    ...styles.statusBadge,
                    backgroundColor: statusColor.bg,
                    color: statusColor.text,
                  }}>
                    {t(DEVICE_STATUS_I18N[device.status] ?? device.status)}
                  </span>
                </div>
              </div>
            );
          })}
        </DashboardCard>

        {/* 检查类型统计 */}
        <DashboardCard title={t('deptDash.examStats')} icon={<Activity size={14} />}>
          {examStats.map((exam) => {
            const completionRate = (exam.completed / exam.total * 100).toFixed(0);
            return (
              <div key={exam.type} style={styles.examTypeRow}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '20px' }}>{getExamIcon(exam.type)}</span>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-primary)' }}>
                      {t(EXAM_TYPE_I18N[exam.type] ?? exam.type)}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {t('deptDash.examProgress', { pending: exam.pending, completed: exam.completed })}
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '18px', fontWeight: '600', color: getExamColor(exam.type) }}>
                    {completionRate}%
                  </div>
                  <div style={styles.progressBar}>
                    <div style={{
                      ...styles.progressFill,
                      width: `${completionRate}%`,
                      backgroundColor: getExamColor(exam.type),
                    }} />
                  </div>
                </div>
              </div>
            );
          })}
        </DashboardCard>
      </div>

      {/* 底部提示 */}
      <div style={{
        backgroundColor: 'var(--bg-card)',
        borderRadius: '12px',
        padding: '16px 24px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        textAlign: 'center',
        color: 'var(--text-secondary)',
        fontSize: '13px',
      }}>
        {t('deptDash.footer')}
      </div>
    </div>
  );
};

export default DepartmentDashboardPage;
