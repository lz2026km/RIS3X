// @ts-nocheck
import React, { useState, useEffect } from 'react';

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

// 24小时分时数据
const hourlyData = [
  { hour: '0', ct: 0, mri: 0, xray: 0, us: 0, dsa: 0 },
  { hour: '1', ct: 0, mri: 0, xray: 0, us: 0, dsa: 0 },
  { hour: '2', ct: 0, mri: 0, xray: 0, us: 0, dsa: 0 },
  { hour: '3', ct: 0, mri: 0, xray: 0, us: 0, dsa: 0 },
  { hour: '4', ct: 1, mri: 0, xray: 2, us: 0, dsa: 0 },
  { hour: '5', ct: 3, mri: 1, xray: 5, us: 2, dsa: 0 },
  { hour: '6', ct: 8, mri: 3, xray: 12, us: 5, dsa: 0 },
  { hour: '7', ct: 15, mri: 8, xray: 22, us: 10, dsa: 0 },
  { hour: '8', ct: 28, mri: 18, xray: 38, us: 18, dsa: 2 },
  { hour: '9', ct: 42, mri: 28, xray: 52, us: 25, dsa: 5 },
  { hour: '10', ct: 55, mri: 35, xray: 62, us: 30, dsa: 8 },
  { hour: '11', ct: 58, mri: 38, xray: 65, us: 32, dsa: 9 },
  { hour: '12', ct: 35, mri: 20, xray: 40, us: 22, dsa: 3 },
  { hour: '13', ct: 45, mri: 28, xray: 55, us: 28, dsa: 5 },
  { hour: '14', ct: 52, mri: 32, xray: 58, us: 30, dsa: 8 },
  { hour: '15', ct: 56, mri: 35, xray: 60, us: 32, dsa: 9 },
  { hour: '16', ct: 48, mri: 30, xray: 52, us: 28, dsa: 7 },
  { hour: '17', ct: 38, mri: 22, xray: 42, us: 22, dsa: 4 },
  { hour: '18', ct: 25, mri: 15, xray: 30, us: 15, dsa: 2 },
  { hour: '19', ct: 15, mri: 8, xray: 20, us: 10, dsa: 1 },
  { hour: '20', ct: 8, mri: 4, xray: 12, us: 6, dsa: 0 },
  { hour: '21', ct: 4, mri: 2, xray: 6, us: 3, dsa: 0 },
  { hour: '22', ct: 2, mri: 1, xray: 3, us: 1, dsa: 0 },
  { hour: '23', ct: 0, mri: 0, xray: 1, us: 0, dsa: 0 },
];

// 医生工作量数据
const doctorWorkload = [
  { name: '李明辉', title: '主任医师', ct: 68, mri: 52, xray: 35, reports: 145, critical: 8, accuracy: 98.5 },
  { name: '王建军', title: '主任医师', ct: 72, mri: 48, xray: 28, reports: 138, critical: 12, accuracy: 97.8 },
  { name: '张丽华', title: '副主任医师', ct: 65, mri: 55, xray: 32, reports: 142, critical: 9, accuracy: 98.2 },
  { name: '陈晓东', title: '主治医师', ct: 78, mri: 42, xray: 45, reports: 155, critical: 6, accuracy: 96.5 },
  { name: '刘芳', title: '主治医师', ct: 62, mri: 50, xray: 38, reports: 140, critical: 7, accuracy: 97.2 },
  { name: '孙伟', title: '主治医师', ct: 58, mri: 45, xray: 30, reports: 128, critical: 5, accuracy: 96.8 },
  { name: '赵强', title: '住院医师', ct: 52, mri: 38, xray: 42, reports: 118, critical: 3, accuracy: 94.5 },
  { name: '周敏', title: '住院医师', ct: 48, mri: 35, xray: 40, reports: 112, critical: 4, accuracy: 93.8 },
  { name: '吴昊', title: '住院医师', ct: 45, mri: 32, xray: 38, reports: 105, critical: 2, accuracy: 93.2 },
  { name: '郑杰', title: '住院医师', ct: 42, mri: 30, xray: 35, reports: 98, critical: 3, accuracy: 92.8 },
];

// 预警信息
const alerts = [
  { level: 'warning', device: 'MRI-003', msg: 'MRI3室 正在维护中，预计今日18:00恢复' },
  { level: 'info', device: 'MG-002', msg: '乳腺室2 设备利用率较低(28%)，建议优化排班' },
  { level: 'critical', device: 'CT-001', msg: 'CT1室 今日检查量已超80人次，候诊时间延长' },
  { level: 'warning', device: 'DSA-002', msg: '导管室2 今日无预约，可协调临时使用' },
  { level: 'info', device: 'PETCT-001', msg: '核医学科 PET-CT 上午时段已约满' },
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

// 模拟实时数据更新
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
    switch (type) {
      case 'CT': return '🩻';
      case 'MRI': return '🧲';
      case 'X线': return '📷';
      case '超声': return '📡';
      case 'DSA': return '💉';
      default: return '🔬';
    }
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

  if (loading) return <div role="status" data-testid="dept-loading" style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>加载中...</div>;
  if (error) return <div role="alert" data-testid="dept-error" style={{ padding: 40, textAlign: 'center', color: '#dc2626' }}>{error}</div>;
  if (!dataAvailable) {
    return (
      <div data-testid="dept-empty" style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
        <div style={{ fontSize: 14, marginBottom: 12 }}>暂无科室数据</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>请等待数据同步或检查设备状态</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* 头部 */}
      <div style={styles.header}>
        <div style={styles.headerTitle}>放射科实时看板</div>
        <div style={styles.headerSubtitle}>
          科室: 放射科 (RIS) | v0.7.0 | {currentTime.toLocaleString('zh-CN')}
        </div>
      </div>

      {/* 统计卡片 */}
      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <div style={styles.statValue}>{todayStats.totalPatients}</div>
          <div style={styles.statLabel}>今日接诊总数</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statValue}>{todayStats.completedToday}</div>
          <div style={styles.statLabel}>已完成检查</div>
        </div>
        <div style={styles.statCard}>
          <div style={{...styles.statValue, color: '#ef4444'}}>{todayStats.pendingReports}</div>
          <div style={styles.statLabel}>待撰写报告</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statValue}>{todayStats.avgWaitTime}</div>
          <div style={styles.statLabel}>平均候检时间</div>
        </div>
        <div style={styles.statCard}>
          <div style={{...styles.statValue, color: '#22c55e'}}>{todayStats.activeDevices}/{todayStats.totalDevices}</div>
          <div style={styles.statLabel}>设备运行状态</div>
        </div>
      </div>

      {/* 双栏布局 */}
      <div style={styles.sectionGrid}>
        {/* 设备状态 */}
        <div style={styles.card}>
          <div style={styles.cardTitle}>设备状态监控</div>
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
                    <div style={styles.deviceType}>{device.type} | {device.id}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {device.patients > 0 && (
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {device.patients}人检查中
                    </span>
                  )}
                  <span style={{
                    ...styles.statusBadge,
                    backgroundColor: statusColor.bg,
                    color: statusColor.text,
                  }}>
                    {device.status}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* 检查类型统计 */}
        <div style={styles.card}>
          <div style={styles.cardTitle}>各类型检查统计</div>
          {examStats.map((exam) => {
            const completionRate = (exam.completed / exam.total * 100).toFixed(0);
            return (
              <div key={exam.type} style={styles.examTypeRow}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '20px' }}>{getExamIcon(exam.type)}</span>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-primary)' }}>
                      {exam.type}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      待检 {exam.pending} | 已完成 {exam.completed}
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
        </div>
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
        放射科信息系统 (RIS) v0.7.0 | 实时数据更新 | 如有异常请联系: 放射科信息中心 ☎ 8001
      </div>
    </div>
  );
};

export default DepartmentDashboardPage;
