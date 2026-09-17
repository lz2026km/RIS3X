// 患者自助服务 (SelfServicePortal) 命名空间字典
// 格式: export default { zh: { 'key': '中文' }, en: { 'key': 'English' } }
// 说明: 分命名空间字典, 由 appI18n.ts 通过 import.meta.glob 自动合并。
// 嵌套键使用完整点分键名, 不使用嵌套对象。
export default {
  zh: {
    'selfService.booking.booked': '预约成功',
    'selfService.home.examRecordsSuffix': '条',
    'selfService.home.pendingAppointmentsSuffix': '项',
    'selfService.home.reportsSuffix': '份',
    'selfService.reports.col.examItem': '检查项目',
    'selfService.reports.col.bodyPart': '检查部位',
    'selfService.reports.col.examDate': '检查日期',
    'selfService.reports.col.status': '状态',
    'selfService.reports.col.signedAt': '签发时间',
    'selfService.reports.col.actions': '操作',
  },
  en: {
    'selfService.booking.booked': 'Appointment booked successfully',
    'selfService.home.examRecordsSuffix': 'records',
    'selfService.home.pendingAppointmentsSuffix': 'pending',
    'selfService.home.reportsSuffix': 'reports',
    'selfService.reports.col.examItem': 'Exam Item',
    'selfService.reports.col.bodyPart': 'Body Part',
    'selfService.reports.col.examDate': 'Exam Date',
    'selfService.reports.col.status': 'Status',
    'selfService.reports.col.signedAt': 'Signed At',
    'selfService.reports.col.actions': 'Actions',
  },
}
