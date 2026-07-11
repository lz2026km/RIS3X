import type { OperationLog, ComplianceLevel, ComplianceAlert } from './types'
import { initialUsers } from '../../data/initialData'

export function formatDateTime(dt: string): string {
  if (!dt) return '-'
  const d = new Date(dt)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
}

export function formatDate(dt: string): string {
  if (!dt) return '-'
  return dt.slice(0, 10)
}

export function formatTime(dt: string): string {
  if (!dt) return '-'
  const d = new Date(dt)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
}

export function getRelativeTime(dt: string): string {
  const now = new Date('2026-05-01T18:00:00')
  const d = new Date(dt)
  const diff = now.getTime() - d.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  if (hours < 24) return `${hours}小时前`
  return `${days}天前`
}

export function checkCompliance(log: OperationLog, allLogs: OperationLog[]): { level: ComplianceLevel; alerts: ComplianceAlert[] } {
  const alerts: ComplianceAlert[] = []
  const hour = new Date(log.timestamp).getHours()

  if (hour >= 22 || hour < 6) {
    alerts.push({
      type: 'non_work_hours',
      level: 'critical',
      message: '非工作时间访问 (22:00-06:00)'
    })
  }

  if (log.department === '内科' && log.userName.includes('放射')) {
    alerts.push({
      type: 'cross_department',
      level: 'critical',
      message: '跨科室访问'
    })
  }

  if (log.action === '批量导出' || log.action === '导出数据') {
    const exportCount = allLogs.filter(l =>
      (l.action === '批量导出' || l.action === '导出数据') &&
      l.userName === log.userName &&
      l.timestamp.slice(0, 10) === log.timestamp.slice(0, 10)
    ).length
    if (exportCount > 3) {
      alerts.push({
        type: 'batch_export',
        level: 'warning',
        message: `当日第${exportCount}次导出操作`
      })
    }
  }

  if (log.patientId) {
    const patientAccessCount = allLogs.filter(l =>
      l.patientId === log.patientId &&
      l.userName === log.userName &&
      new Date(l.timestamp).getTime() > new Date(log.timestamp).getTime() - 3600000
    ).length
    if (patientAccessCount > 5) {
      alerts.push({
        type: 'high_frequency',
        level: 'warning',
        message: `1小时内访问该患者${patientAccessCount}次`
      })
    }
  }

  let level: ComplianceLevel = 'compliant'
  if (alerts.some(a => a.level === 'critical')) {
    level = 'critical'
  } else if (alerts.some(a => a.level === 'warning')) {
    level = 'warning'
  }

  return { level, alerts }
}

export function generateMockOperationLogs(): OperationLog[] {
  const users = initialUsers.filter(u => u.role === 'radiologist' || u.role === 'technologist' || u.role === 'admin')
  const actions = ['修改报告', '审核通过', '审核驳回', '登录', '登出', '导出数据', '修改设置', '批量审核', '打印报告', '数据导入', '系统维护']
  const modules = ['报告管理', '检查管理', '患者管理', '设备管理', '系统设置', '统计报表', '预约管理']
  const devices = ['Chrome/120.0', 'Firefox/119.0', 'Edge/120.0', 'Safari/17.0', 'Chrome Mobile/120.0']
  const ips = ['192.168.1.100', '192.168.1.101', '192.168.1.102', '10.0.0.50', '172.16.0.25', '127.0.0.1']
  const sources = ['Web端', '移动端', 'API接口', '系统自动']

  const reportIds = Array.from({ length: 50 }, (_, i) => `RAD-RPT${String(i + 1).padStart(3, '0')}`)
  const patientNames = ['张志刚', '李秀英', '王建国', '赵晓敏', '周玉芬', '孙伟', '吴婷', '郑丽', '钱伟明', '陈丽华']
  const patientIds = ['P001', 'P002', 'P003', 'P004', 'P005', 'P006', 'P007', 'P008', 'P009', 'P010']
  const departments = ['放射科', '内科', '外科', '骨科', '神经科']
  const examItems = ['头颅CT平扫', '胸部CT平扫', '腹部CT平扫+增强', '头颅MR平扫', '腰椎MR平扫', '胸部DR正侧位', '冠脉CTA', 'MG']

  const logs: OperationLog[] = []
  const baseTime = new Date('2026-05-01T08:00:00')

  for (let i = 0; i < 1060; i++) {
    const user = users[Math.floor(Math.random() * users.length)]
    const action = actions[Math.floor(Math.random() * actions.length)]
    const module = action === '登录' || action === '登出' || action === '系统维护' ? '系统设置' : modules[Math.floor(Math.random() * modules.length)]
    const hoursOffset = Math.floor(i / 3) + Math.random() * 0.5
    const timestamp = new Date(baseTime.getTime() + hoursOffset * 3600000).toISOString()

    let targetDesc = ''
    let targetId = ''
    let beforeData = ''
    let afterData = ''
    let duration = Math.floor(Math.random() * 300) + 1
    const patientId = patientIds[Math.floor(Math.random() * patientIds.length)]
    const department = departments[Math.floor(Math.random() * departments.length)]

    if (action === '修改报告') {
      targetId = reportIds[Math.floor(Math.random() * reportIds.length)]
      const patientName = patientNames[Math.floor(Math.random() * patientNames.length)]
      const examItem = examItems[Math.floor(Math.random() * examItems.length)]
      targetDesc = `${patientName}的${examItem}报告`
      beforeData = `印象：左肺下叶见约1.2cm结节影，边缘毛糙。建议定期随访。\n诊断意见：左肺下叶结节，LU-RADS 3类。`
      afterData = `印象：左肺下叶见约1.3cm结节影，边缘毛糙伴少许索条影。较前片略增大。\n诊断意见：左肺下叶结节，LU-RADS 4A类，建议进一步检查。`
      duration = Math.floor(Math.random() * 600) + 30
    } else if (action === '审核通过') {
      targetId = reportIds[Math.floor(Math.random() * reportIds.length)]
      const patientName = patientNames[Math.floor(Math.random() * patientNames.length)]
      const examItem = examItems[Math.floor(Math.random() * examItems.length)]
      targetDesc = `${patientName}的${examItem}报告`
      duration = Math.floor(Math.random() * 120) + 5
    } else if (action === '审核驳回') {
      targetId = reportIds[Math.floor(Math.random() * reportIds.length)]
      const patientName = patientNames[Math.floor(Math.random() * patientNames.length)]
      const examItem = examItems[Math.floor(Math.random() * examItems.length)]
      targetDesc = `${patientName}的${examItem}报告`
      beforeData = `报告描述不完整，请补充诊断依据。`
      duration = Math.floor(Math.random() * 60) + 10
    } else if (action === '登录') {
      targetDesc = `${user.name}登录系统`
      targetId = user.id
      duration = Math.floor(Math.random() * 10) + 1
    } else if (action === '登出') {
      targetDesc = `${user.name}退出系统`
      targetId = user.id
      duration = Math.floor(Math.random() * 5) + 1
    } else if (action === '导出数据') {
      targetId = `EXPORT-${String(i).padStart(5, '0')}`
      targetDesc = `导出报告统计数据（2026年4月）`
      beforeData = `导出范围：2026-04-01 至 2026-04-30\n导出内容：CT/MR/DR全部报告`
      afterData = `导出文件：report_stats_2026_04.xlsx\n导出记录数：2456条`
      duration = Math.floor(Math.random() * 120) + 60
    } else if (action === '修改设置') {
      targetId = `SETTINGS-${String(i % 5 + 1).padStart(2, '0')}`
      const settingNames = ['危急值通知规则', '报告审核流程', '预约超时设置', '系统参数配置', '用户权限设置']
      targetDesc = settingNames[i % 5]
      beforeData = `危急值提醒时间间隔：5分钟\n短信通知：开启\n邮件通知：开启`
      afterData = `危急值提醒时间间隔：3分钟\n短信通知：开启\n邮件通知：关闭`
      duration = Math.floor(Math.random() * 180) + 20
    } else if (action === '批量审核') {
      targetId = `BATCH-${String(i).padStart(5, '0')}`
      const count = Math.floor(Math.random() * 20) + 5
      targetDesc = `批量审核${count}份报告`
      duration = Math.floor(Math.random() * 300) + count * 10
    } else if (action === '打印报告') {
      targetId = reportIds[Math.floor(Math.random() * reportIds.length)]
      const patientName = patientNames[Math.floor(Math.random() * patientNames.length)]
      const examItem = examItems[Math.floor(Math.random() * examItems.length)]
      targetDesc = `打印${patientName}的${examItem}报告`
      duration = Math.floor(Math.random() * 30) + 5
    } else if (action === '数据导入') {
      targetId = `IMPORT-${String(i).padStart(5, '0')}`
      targetDesc = `导入患者检查数据`
      beforeData = `导入文件：patient_data_2026_04.csv\n预计导入记录数：500条`
      afterData = `成功导入：498条\n失败：2条\n耗时：45秒`
      duration = Math.floor(Math.random() * 600) + 30
    } else if (action === '系统维护') {
      targetId = `MAINT-${String(i % 8 + 1).padStart(2, '0')}`
      const maintNames = ['数据库备份', '缓存清理', '日志归档', '索引重建', '系统健康检查', '安全扫描', '性能优化', '服务重启']
      targetDesc = maintNames[i % 8]
      duration = Math.floor(Math.random() * 3600) + 60
    }

    logs.push({
      id: `LOG${String(i + 1).padStart(6, '0')}`,
      userId: user.id,
      userName: user.name,
      action,
      module,
      targetId,
      targetDesc,
      beforeData,
      afterData,
      timestamp,
      ipAddress: ips[Math.floor(Math.random() * ips.length)],
      device: devices[Math.floor(Math.random() * devices.length)],
      source: sources[Math.floor(Math.random() * sources.length)],
      duration,
      patientId,
      department,
    })
  }

  const hipaaLogs: OperationLog[] = []
  const hipaaActions = [
    { action: '查看报告', category: 'view' },
    { action: '查看影像', category: 'view' },
    { action: '查看患者信息', category: 'view' },
    { action: '修改报告', category: 'modify' },
    { action: '修改患者信息', category: 'modify' },
    { action: '打印报告', category: 'print' },
    { action: '打印胶片', category: 'print' },
    { action: '导出数据', category: 'export' },
    { action: '批量导出', category: 'export' },
    { action: '删除报告', category: 'delete' },
    { action: '删除影像', category: 'delete' },
  ]

  const hipaaUsers = [
    { name: '李明辉', department: '放射科' },
    { name: '王晓燕', department: '放射科' },
    { name: '张志强', department: '内科' },
    { name: '赵雅琪', department: '放射科' },
    { name: '周伟民', department: '外科' },
  ]

  for (let i = 0; i < 50; i++) {
    const user = hipaaUsers[Math.floor(Math.random() * hipaaUsers.length)]
    const actionInfo = hipaaActions[Math.floor(Math.random() * hipaaActions.length)]
    const patientName = patientNames[Math.floor(Math.random() * patientNames.length)]
    const patientId = patientIds[Math.floor(Math.random() * patientIds.length)]
    const reportId = reportIds[Math.floor(Math.random() * reportIds.length)]

    let hoursOffset = Math.random()
    let timestamp: Date
    if (i % 8 === 0) {
      timestamp = new Date(baseTime.getTime() + (Math.floor(i / 8) * 3600000) + (22 + Math.random() * 4) * 3600000)
    } else if (i % 10 === 0) {
      timestamp = new Date(baseTime.getTime() + (Math.floor(i / 10) * 3600000) + Math.random() * 3 * 3600000)
    } else {
      timestamp = new Date(baseTime.getTime() + (Math.floor(i / 2) + Math.random() * 0.5) * 3600000)
    }

    let targetDesc = ''
    let targetId = ''

    if (actionInfo.action.includes('报告')) {
      targetId = reportId
      targetDesc = `${patientName}的${examItems[Math.floor(Math.random() * examItems.length)]}报告`
    } else if (actionInfo.action.includes('影像')) {
      targetId = `IMG-${String(Math.floor(Math.random() * 1000)).padStart(4, '0')}`
      targetDesc = `${patientName}的影像检查`
    } else if (actionInfo.action.includes('患者')) {
      targetId = patientId
      targetDesc = `${patientName}的患者信息`
    }

    const log: OperationLog = {
      id: `HIPAALOG${String(i + 1).padStart(4, '0')}`,
      userId: `USR${String(Math.floor(Math.random() * 20) + 1).padStart(3, '0')}`,
      userName: user.name,
      action: actionInfo.action,
      module: '报告管理',
      targetId,
      targetDesc,
      timestamp: timestamp.toISOString(),
      ipAddress: ips[Math.floor(Math.random() * ips.length)],
      device: devices[Math.floor(Math.random() * devices.length)],
      source: 'Web端',
      patientId,
      department: user.department,
    }

    const compliance = checkCompliance(log, [...logs, ...hipaaLogs])
    log.complianceLevel = compliance.level
    log.complianceAlerts = compliance.alerts

    hipaaLogs.push(log)
  }

  return [...logs, ...hipaaLogs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
}
