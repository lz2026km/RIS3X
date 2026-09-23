/** G005 眼科排班 Mock v3.0.6.8-23a — 8 医生 × 30 天 */
import type { DoctorSchedule, NotificationTemplate } from '../types/eye';

const NOW = Date.now();
const DOCTORS = [
  { id: 'D001', name: '张明远', dept: '眼底病科' },
  { id: 'D003', name: '赵静', dept: '糖尿病眼病科' },
  { id: 'D004', name: '王建国', dept: '眼底病科' },
  { id: 'D005', name: '李梅', dept: '视光中心' },
  { id: 'D006', name: '刘医生', dept: '眼眶病科' },
  { id: 'D007', name: '陈医生', dept: '白内障科' },
  { id: 'D008', name: '孙医生', dept: '青光眼科' },
  { id: 'D009', name: '周医生', dept: '小儿眼科' },
];

export const MOCK_DOCTOR_SCHEDULES: DoctorSchedule[] = [];
for (let d = 0; d < DOCTORS.length; d++) {
  const doc = DOCTORS[d]!;
  for (let day = 0; day < 30; day++) {
    const date = new Date(NOW + 86400000 * day);
    const dow = date.getDay();
    if (dow === 0 || dow === 6) continue; // skip weekends
    const isMorning = day % 2 === 0;
    MOCK_DOCTOR_SCHEDULES.push({
      id: `sch-${doc.id}-${date.toISOString().split('T')[0]}-${isMorning ? 'AM' : 'PM'}`,
      doctorId: doc.id,
      doctorName: doc.name,
      date: date.toISOString().split('T')[0]!,
      startTime: isMorning ? '08:00' : '13:00',
      endTime: isMorning ? '12:00' : '17:00',
      type: day % 7 === 3 ? 'surgery' : day % 10 === 0 ? 'teaching' : day % 15 === 7 ? 'consultation' : 'clinic',
      location: doc.dept === '视光中心' ? '3F诊区' : '2F诊区',
      maxPatients: isMorning ? 20 : 15,
      bookedPatients: Math.round((isMorning ? 20 : 15) * (0.6 + Math.random() * 0.35)),
    });
  }
}

export const MOCK_NOTIFICATION_TEMPLATES: NotificationTemplate[] = [
  { id: 'nt-001', name: '预约确认', channel: 'sms', trigger: 'appointment_created', subject: '【眼科普诊】预约确认', body: '尊敬的患者{patientName},您已成功预约{date}日{time}在{dept}的检查,请携带医保卡及病历。地址:{address}。退订回N', variables: ['patientName','date','time','dept','address'], enabled: true },
  { id: 'nt-002', name: '预约提醒(前1天)', channel: 'sms', trigger: 'appointment_reminder_1d', subject: '【眼科普诊】就诊提醒', body: '尊敬的患者{patientName},您预约明天{time}在{dept}的{examType},请按时就诊。如需改约请致电{phone}。退订回N', variables: ['patientName','time','dept','examType','phone'], enabled: true },
  { id: 'nt-003', name: '结果通知', channel: 'email', trigger: 'report_published', subject: '您的眼科检查结果已发布', body: '尊敬的{patientName},您的{examType}检查结果已发布。请登录患者门户查看详情。', variables: ['patientName','examType'], enabled: true },
  { id: 'nt-004', name: '危急值通知(医生)', channel: 'phone', trigger: 'critical_value', subject: '【紧急】危急值通知', body: '患者{patientName}的{examType}检查发现危急值:{criticalValue},请立即处理。', variables: ['patientName','examType','criticalValue'], enabled: true },
  { id: 'nt-005', name: '随访提醒', channel: 'sms', trigger: 'follow_up_reminder', subject: '【眼科普诊】随访提醒', body: '尊敬的患者{patientName},您的{condition}需在{date}前复查,请预约就诊。退订回N', variables: ['patientName','condition','date'], enabled: true },
  { id: 'nt-006', name: '满意度调查', channel: 'sms', trigger: 'visit_completed', subject: '【眼科普诊】满意度调查', body: '尊敬的{patientName},感谢您在{dept}就诊。请点击链接完成满意度调查,帮助我们改进服务。', variables: ['patientName','dept'], enabled: true },
  { id: 'nt-007', name: '处方提醒(取药)', channel: 'sms', trigger: 'prescription_created', subject: '【眼科药房】处方提醒', body: '尊敬的患者{patientName},您的处方:{drugName}已开立,请在7日内到药房取药。退订回N', variables: ['patientName','drugName'], enabled: true },
  { id: 'nt-008', name: '未到诊提醒', channel: 'phone', trigger: 'no_show', subject: '【眼科】未到诊通知', body: '尊敬的患者{patientName},您预约今日{time}未到诊,如需重新预约请致电{phone}。', variables: ['patientName','time','phone'], enabled: true },
];
