// 分诊管理 (TriagePage) 命名空间字典
// 注意: 使用完整点分键名; zh 与 en 一一对应
// 格式: export default { zh: { 'key': '中文' }, en: { 'key': 'English' } }
export default {
  zh: {
    // ---- 加载 / 提示 ----
    'triage.loadError': '加载待分诊列表失败',
    'triage.assignError': '分诊指派失败',
    'triage.confirmSuccess': '分诊确认成功',
    'triage.confirmError': '分诊确认失败',
    'triage.updateError': '更新分诊信息失败',
    'triage.assignedTo': '已分配给',
    // ---- 表格列 ----
    'triage.patientName': '患者姓名',
    'triage.examType': '检查类型',
    'triage.level': '分诊级别',
    'triage.status': '状态',
    'triage.doctor': '指派医生',
    'triage.actions': '操作',
    // ---- 状态 ----
    'triage.pending': '待处理',
    'triage.assigned': '已指派',
    'triage.completed': '已完成',
    // ---- 操作 ----
    'triage.adjust': '调整',
    'triage.confirm': '确认',
    'triage.adjustTitle': '调整分诊信息',
    // ---- 统计 ----
    'triage.totalPending': '待分诊总数',
    'triage.critical': '危急',
    'triage.urgent': '紧急',
    'triage.unassigned': '未指派',
  },
  en: {
    // ---- Loading / Prompts ----
    'triage.loadError': 'Failed to load the pending triage list',
    'triage.assignError': 'Failed to assign triage',
    'triage.confirmSuccess': 'Triage confirmed',
    'triage.confirmError': 'Failed to confirm triage',
    'triage.updateError': 'Failed to update triage information',
    'triage.assignedTo': 'Assigned to',
    // ---- Table columns ----
    'triage.patientName': 'Patient Name',
    'triage.examType': 'Exam Type',
    'triage.level': 'Triage Level',
    'triage.status': 'Status',
    'triage.doctor': 'Assigned Doctor',
    'triage.actions': 'Actions',
    // ---- Status ----
    'triage.pending': 'Pending',
    'triage.assigned': 'Assigned',
    'triage.completed': 'Completed',
    // ---- Actions ----
    'triage.adjust': 'Adjust',
    'triage.confirm': 'Confirm',
    'triage.adjustTitle': 'Adjust Triage Information',
    // ---- Statistics ----
    'triage.totalPending': 'Total Pending',
    'triage.critical': 'Critical',
    'triage.urgent': 'Urgent',
    'triage.unassigned': 'Unassigned',
  },
}
