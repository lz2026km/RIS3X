import type { KpiDefinition } from '../types/analytics';

export const ANALYTICS_KPIS: KpiDefinition[] = [
  { id: 'kpi-001', code: 'KPI-001', name: '报告总数', category: 'volume', format: 'number', unit: '份', description: '选定周期内已发布的报告总数', formula: 'COUNT(reports WHERE status=\'published\' AND published_at BETWEEN @start AND @end)', higherIsBetter: true, target: 2000, warning: 500, source: '报告表', tags: ['报告', '总览'], refreshSec: 300 },
  { id: 'kpi-002', code: 'KPI-002', name: '日均报告数', category: 'volume', format: 'number', unit: '份', description: '日均发布报告数量', formula: 'KPI-001 / DATEDIFF(day, @start, @end)', higherIsBetter: true, target: 70, warning: 30, source: '报告表', tags: ['报告', '效率'], refreshSec: 600 },
  { id: 'kpi-003', code: 'KPI-003', name: '检查登记数', category: 'volume', format: 'number', unit: '次', description: '选定周期内检查登记总数', formula: 'COUNT(exams WHERE registered_at BETWEEN @start AND @end)', higherIsBetter: true, source: '检查表', tags: ['检查', '总览'], refreshSec: 300 },
  { id: 'kpi-004', code: 'KPI-004', name: '待报告数', category: 'volume', format: 'number', unit: '份', description: '已检查但尚未出具报告的例数', formula: 'COUNT(exams WHERE status=\'examined\' AND report_id IS NULL)', higherIsBetter: false, target: 50, warning: 100, source: '检查表', tags: ['报告', '积压'], refreshSec: 60 },
  { id: 'kpi-005', code: 'KPI-005', name: '检查类型分布', category: 'volume', format: 'number', unit: '份', description: '按检查类型(CT/MR/DR等)分布的报告数', formula: 'COUNT(reports) GROUP BY modality WHERE published_at BETWEEN @start AND @end', higherIsBetter: true, source: '报告表', tags: ['报告', '分布'], refreshSec: 600 },

  { id: 'kpi-010', code: 'KPI-010', name: '平均签发时长', category: 'timeliness', format: 'minutes', unit: '分钟', description: '从检查完成到报告签发的平均时间', formula: 'AVG(TIMESTAMPDIFF(minute, exam.completed_at, report.signed_at))', higherIsBetter: false, target: 30, warning: 60, source: '报告表', tags: ['时效', '签发'], refreshSec: 300 },
  { id: 'kpi-011', code: 'KPI-011', name: '急诊平均签发', category: 'timeliness', format: 'minutes', unit: '分钟', description: '急诊检查平均签发时长', formula: 'AVG(TIMESTAMPDIFF(minute, exam.completed_at, report.signed_at)) WHERE exam.priority=\'STAT\'', higherIsBetter: false, target: 15, warning: 30, source: '报告表', tags: ['时效', '急诊'], refreshSec: 300 },
  { id: 'kpi-012', code: 'KPI-012', name: '及时签发率', category: 'timeliness', format: 'percent', unit: '%', description: '在规定时间内签发的报告占比', formula: 'SUM(CASE WHEN signed_at - completed_at <= sla_minutes THEN 1 ELSE 0 END) * 1.0 / COUNT(*)', higherIsBetter: true, target: 90, warning: 75, source: '报告表', tags: ['时效', 'SLA'], refreshSec: 600 },
  { id: 'kpi-013', code: 'KPI-013', name: '超时报告数', category: 'timeliness', format: 'number', unit: '份', description: '超出SLA未签发的报告数', formula: 'COUNT(reports WHERE signed_at - completed_at > sla_minutes OR (status<>\'signed\' AND NOW()-completed_at > sla_minutes))', higherIsBetter: false, target: 10, warning: 30, source: '报告表', tags: ['时效', '超时'], refreshSec: 300 },
  { id: 'kpi-014', code: 'KPI-014', name: '报告书写时长', category: 'timeliness', format: 'minutes', unit: '分钟', description: '平均报告书写耗时', formula: 'AVG(TIMESTAMPDIFF(minute, draft.created_at, draft.finalized_at))', higherIsBetter: false, target: 20, warning: 45, source: '报告表', tags: ['时效', '书写'], refreshSec: 600 },

  { id: 'kpi-020', code: 'KPI-020', name: '甲级报告率', category: 'quality', format: 'percent', unit: '%', description: '质控评级为甲级的报告占比', formula: 'SUM(CASE WHEN qc.grade=\'A\' THEN 1 ELSE 0 END) * 100.0 / COUNT(qc.id)', higherIsBetter: true, target: 85, warning: 60, source: '质控表', tags: ['质量', '甲级'], refreshSec: 600 },
  { id: 'kpi-021', code: 'KPI-021', name: '平均质量分', category: 'quality', format: 'score', unit: '分', description: '所有报告的平均质量评分', formula: 'AVG(qc.score)', higherIsBetter: true, target: 90, warning: 75, source: '质控表', tags: ['质量', '评分'], refreshSec: 600 },
  { id: 'kpi-022', code: 'KPI-022', name: '缺陷报告数', category: 'quality', format: 'number', unit: '份', description: '存在缺陷的报告总数', formula: 'COUNT(reports WHERE qc.defect_flag=1)', higherIsBetter: false, target: 20, warning: 50, source: '质控表', tags: ['质量', '缺陷'], refreshSec: 600 },
  { id: 'kpi-023', code: 'KPI-023', name: '诊断符合率', category: 'quality', format: 'percent', unit: '%', description: '影像诊断与病理/临床最终诊断的符合率', formula: 'SUM(CASE WHEN final_diagnosis MATCHES imaging_diagnosis THEN 1 ELSE 0 END) * 100.0 / COUNT(*)', higherIsBetter: true, target: 95, warning: 85, source: '质控表', tags: ['质量', '诊断'], refreshSec: 86400 },

  { id: 'kpi-030', code: 'KPI-030', name: '危急值及时率', category: 'safety', format: 'percent', unit: '%', description: '危急值在规定时间内通知到临床的比例', formula: 'SUM(CASE WHEN notified_at - critical_at <= 30 MINUTE THEN 1 ELSE 0 END) * 100.0 / COUNT(critical_value.id)', higherIsBetter: true, target: 100, warning: 90, source: '危急值表', tags: ['安全', '危急值'], refreshSec: 300 },
  { id: 'kpi-031', code: 'KPI-031', name: '危急值例数', category: 'safety', format: 'number', unit: '例', description: '选定周期内危急值报告数', formula: 'COUNT(critical_value WHERE created_at BETWEEN @start AND @end)', higherIsBetter: false, target: 30, warning: 50, source: '危急值表', tags: ['安全', '危急值'], refreshSec: 300 },
  { id: 'kpi-032', code: 'KPI-032', name: '不良事件数', category: 'safety', format: 'number', unit: '件', description: '报告相关不良事件数量', formula: 'COUNT(adverse_events WHERE occurred_at BETWEEN @start AND @end)', higherIsBetter: false, target: 3, warning: 10, source: '不良事件表', tags: ['安全', '不良事件'], refreshSec: 3600 },
  { id: 'kpi-033', code: 'KPI-033', name: '对比剂不良反应率', category: 'safety', format: 'percent', unit: '%', description: '对比剂注射后不良反应发生率', formula: 'COUNT(adverse_events WHERE type=\'contrast\') * 100.0 / COUNT(exams WHERE contrast_used=1)', higherIsBetter: false, target: 1, warning: 3, source: '检查表', tags: ['安全', '对比剂'], refreshSec: 86400 },

  { id: 'kpi-040', code: 'KPI-040', name: '设备利用率', category: 'utilization', format: 'percent', unit: '%', description: '设备实际使用时间占可用时间的比例', formula: 'SUM(actual_scan_minutes) * 100.0 / SUM(available_minutes)', higherIsBetter: true, target: 85, warning: 60, source: '设备表', tags: ['设备', '利用率'], refreshSec: 600 },
  { id: 'kpi-041', code: 'KPI-041', name: '单台日均检查量', category: 'utilization', format: 'number', unit: '例', description: '每台设备日均完成的检查数量', formula: 'COUNT(exams) / COUNT(DISTINCT device_id) / DATEDIFF(day, @start, @end)', higherIsBetter: true, target: 25, warning: 10, source: '检查表', tags: ['设备', '效率'], refreshSec: 3600 },
  { id: 'kpi-042', code: 'KPI-042', name: '检查室周转时间', category: 'utilization', format: 'minutes', unit: '分钟', description: '相邻检查之间的平均间隔时间', formula: 'AVG(TIMESTAMPDIFF(minute, prev_exam.ended_at, next_exam.started_at))', higherIsBetter: false, target: 10, warning: 20, source: '检查表', tags: ['设备', '周转'], refreshSec: 600 },
  { id: 'kpi-043', code: 'KPI-043', name: '设备故障率', category: 'utilization', format: 'percent', unit: '%', description: '设备当月故障停机占比', formula: 'SUM(downtime_minutes) * 100.0 / (COUNT(device) * 30 * 24 * 60)', higherIsBetter: false, target: 2, warning: 5, source: '设备表', tags: ['设备', '故障'], refreshSec: 86400 },

  { id: 'kpi-050', code: 'KPI-050', name: 'AI辅助率', category: 'efficiency', format: 'percent', unit: '%', description: '使用AI辅助书写的报告占比', formula: 'SUM(CASE WHEN ai_assist_flag=1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*)', higherIsBetter: true, target: 70, warning: 40, source: '报告表', tags: ['AI', '采纳'], refreshSec: 600 },
  { id: 'kpi-051', code: 'KPI-051', name: 'AI采纳率', category: 'efficiency', format: 'percent', unit: '%', description: 'AI建议被医生采纳的比例', formula: 'SUM(ai_adopted) * 100.0 / SUM(ai_suggested) WHERE ai_suggested > 0', higherIsBetter: true, target: 80, warning: 50, source: 'AI日志', tags: ['AI', '采纳'], refreshSec: 600 },
  { id: 'kpi-052', code: 'KPI-052', name: '语音使用率', category: 'efficiency', format: 'percent', unit: '%', description: '使用语音录入的报告占比', formula: 'SUM(CASE WHEN input_method=\'voice\' THEN 1 ELSE 0 END) * 100.0 / COUNT(*)', higherIsBetter: true, target: 50, warning: 20, source: '报告表', tags: ['效率', '语音'], refreshSec: 3600 },
  { id: 'kpi-053', code: 'KPI-053', name: '书写效率提升', category: 'efficiency', format: 'percent', unit: '%', description: '使用AI/语音后的书写效率提升', formula: '(baseline_avg_minutes - ai_voice_avg_minutes) * 100.0 / baseline_avg_minutes', higherIsBetter: true, target: 30, warning: 10, source: '报告表', tags: ['效率', 'AI'], refreshSec: 86400 },

  { id: 'kpi-060', code: 'KPI-060', name: '科室收入', category: 'finance', format: 'currency', unit: '元', description: '选定周期内的科室总收入', formula: 'SUM(invoice.amount) WHERE department=\'radiology\' AND settled_at BETWEEN @start AND @end', higherIsBetter: true, source: '财务表', tags: ['财务', '收入'], refreshSec: 3600 },
  { id: 'kpi-061', code: 'KPI-061', name: '医保收入占比', category: 'finance', format: 'percent', unit: '%', description: '医保结算收入占总收入的比例', formula: 'SUM(CASE WHEN pay_type=\'insurance\' THEN amount ELSE 0 END) * 100.0 / SUM(amount)', higherIsBetter: true, target: 60, warning: 40, source: '财务表', tags: ['财务', '医保'], refreshSec: 86400 },
  { id: 'kpi-062', code: 'KPI-062', name: '自费收入占比', category: 'finance', format: 'percent', unit: '%', description: '自费收入占总收入比例', formula: 'SUM(CASE WHEN pay_type=\'self_pay\' THEN amount ELSE 0 END) * 100.0 / SUM(amount)', higherIsBetter: false, target: 30, warning: 50, source: '财务表', tags: ['财务', '自费'], refreshSec: 86400 },

  { id: 'kpi-070', code: 'KPI-070', name: '科室满意度', category: 'satisfaction', format: 'score', unit: '分', description: '临床科室对放射科的满意度评分', formula: 'AVG(survey.score) WHERE survey.target=\'radiology_dept\'', higherIsBetter: true, target: 95, warning: 80, source: '满意度调查', tags: ['满意度', '临床'], refreshSec: 86400 },
  { id: 'kpi-071', code: 'KPI-071', name: '患者满意度', category: 'satisfaction', format: 'score', unit: '分', description: '患者对检查服务的满意度评分', formula: 'AVG(survey.score) WHERE survey.target=\'patient_experience\'', higherIsBetter: true, target: 90, warning: 75, source: '满意度调查', tags: ['满意度', '患者'], refreshSec: 86400 },
  { id: 'kpi-072', code: 'KPI-072', name: '临床投诉数', category: 'satisfaction', format: 'number', unit: '件', description: '临床科室投诉事项数', formula: 'COUNT(complaints WHERE source=\'clinical_dept\' AND created_at BETWEEN @start AND @end)', higherIsBetter: false, target: 2, warning: 5, source: '投诉表', tags: ['满意度', '投诉'], refreshSec: 3600 },

  { id: 'kpi-080', code: 'KPI-080', name: '区块链存证数', category: 'experience', format: 'number', unit: '份', description: '已上链存证的报告数', formula: 'COUNT(reports WHERE blockchain_tx_hash IS NOT NULL)', higherIsBetter: true, target: 500, warning: 100, source: '区块链表', tags: ['区块链', '存证'], refreshSec: 600 },
  { id: 'kpi-081', code: 'KPI-081', name: '电子胶片率', category: 'experience', format: 'percent', unit: '%', description: '采用电子胶片替代胶片的比例', formula: 'SUM(CASE WHEN film_type=\'digital\' THEN 1 ELSE 0 END) * 100.0 / COUNT(*)', higherIsBetter: true, target: 90, warning: 70, source: '检查表', tags: ['绿色', '胶片'], refreshSec: 3600 },
  { id: 'kpi-082', code: 'KPI-082', name: '无纸化率', category: 'experience', format: 'percent', unit: '%', description: '无纸化签发的报告比例', formula: 'SUM(CASE WHEN sign_method=\'e_sign\' THEN 1 ELSE 0 END) * 100.0 / COUNT(*)', higherIsBetter: true, target: 95, warning: 80, source: '报告表', tags: ['绿色', '无纸化'], refreshSec: 3600 },
  { id: 'kpi-083', code: 'KPI-083', name: '报告线上查看率', category: 'experience', format: 'percent', unit: '%', description: '患者/临床通过线上查看报告的比例', formula: 'COUNT(access_log WHERE channel=\'online\') * 100.0 / COUNT(access_log)', higherIsBetter: true, target: 80, warning: 50, source: '访问日志', tags: ['体验', '线上'], refreshSec: 3600 },
];

export const KPI_CATEGORY_LABELS: Record<string, string> = {
  volume: '数量指标',
  timeliness: '时效指标',
  quality: '质量指标',
  safety: '安全指标',
  efficiency: '效率指标',
  finance: '财务指标',
  utilization: '利用率',
  satisfaction: '满意度',
  experience: '体验指标',
};

export const KPI_DEFAULTS: Record<string, number | string> = {
  kpiCategory: 'volume',
  kpiFormat: 'number',
  refreshInterval: 300,
};
