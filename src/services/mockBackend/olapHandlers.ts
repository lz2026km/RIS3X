import { http, HttpResponse, delay } from 'msw';

const METADATA = {
  metrics: [
    { id: 'exam_count', name: '检查量', dimension: 'exam', aggregation: 'count', format: 'number', description: '检查总人次' },
    { id: 'exam_revenue', name: '检查收入', dimension: 'exam', aggregation: 'sum', format: 'currency', unit: '元', description: '检查总收入金额' },
    { id: 'exam_cost', name: '检查成本', dimension: 'exam', aggregation: 'sum', format: 'currency', unit: '元', description: '检查总成本' },
    { id: 'avg_exam_time', name: '平均检查时长', dimension: 'exam', aggregation: 'avg', format: 'duration', unit: 'min', description: '平均每项检查耗时' },
    { id: 'avg_report_time', name: '平均报告时长', dimension: 'report', aggregation: 'avg', format: 'duration', unit: 'min', description: '报告从创建到审核平均时长' },
    { id: 'report_count', name: '报告量', dimension: 'report', aggregation: 'count', format: 'number', description: '报告总数' },
    { id: 'quality_score_avg', name: '平均质控评分', dimension: 'quality', aggregation: 'avg', format: 'decimal', unit: '分', description: '质控平均得分' },
    { id: 'critical_count', name: '危急值数量', dimension: 'critical', aggregation: 'count', format: 'number', description: '危急值报告数' },
    { id: 'device_usage_rate', name: '设备使用率', dimension: 'device', aggregation: 'avg', format: 'percent', description: '设备平均使用率' },
    { id: 'appointment_count', name: '预约量', dimension: 'appointment', aggregation: 'count', format: 'number', description: '预约总人次' },
    { id: 'positive_rate', name: '阳性检出率', dimension: 'exam', aggregation: 'avg', format: 'percent', description: '阳性发现检出比例' },
    { id: 'report_timely_rate', name: '报告及时率', dimension: 'report', aggregation: 'avg', format: 'percent', description: '规定时间内完成报告比例' },
    { id: 'patient_satisfaction', name: '患者满意度', dimension: 'survey', aggregation: 'avg', format: 'decimal', unit: '分', description: '患者满意度平均分' },
  ],
  dimensions: [
    { id: 'date', name: '日期', type: 'date', description: '检查日期' },
    { id: 'modality', name: '检查类型', type: 'categorical', description: '设备模态 (CT/MR/DR/MG/DSA)' },
    { id: 'device', name: '设备', type: 'categorical', description: '检查设备名称' },
    { id: 'doctor', name: '医生', type: 'categorical', description: '报告医生/审核医生' },
    { id: 'department', name: '科室', type: 'categorical', description: '申请科室/检查科室' },
    { id: 'body_part', name: '检查部位', type: 'categorical', description: '检查身体部位' },
    { id: 'age_group', name: '年龄分组', type: 'categorical', description: '患者年龄段' },
    { id: 'gender', name: '性别', type: 'categorical', description: '患者性别' },
    { id: 'patient_type', name: '患者类型', type: 'categorical', description: '门诊/住院/急诊/体检' },
    { id: 'report_state', name: '报告状态', type: 'categorical', description: '报告当前状态' },
  ],
};

const MOCK_ROWS = [
  { date: '2026-01', modality: 'CT', exam_count: 2450, exam_revenue: 3675000 },
  { date: '2026-02', modality: 'CT', exam_count: 2280, exam_revenue: 3420000 },
  { date: '2026-03', modality: 'CT', exam_count: 2650, exam_revenue: 3975000 },
  { date: '2026-04', modality: 'CT', exam_count: 2520, exam_revenue: 3780000 },
  { date: '2026-05', modality: 'CT', exam_count: 2780, exam_revenue: 4170000 },
  { date: '2026-06', modality: 'CT', exam_count: 2890, exam_revenue: 4335000 },
  { date: '2026-01', modality: 'MR', exam_count: 1580, exam_revenue: 3160000 },
  { date: '2026-02', modality: 'MR', exam_count: 1420, exam_revenue: 2840000 },
  { date: '2026-03', modality: 'MR', exam_count: 1680, exam_revenue: 3360000 },
  { date: '2026-04', modality: 'MR', exam_count: 1720, exam_revenue: 3440000 },
  { date: '2026-05', modality: 'MR', exam_count: 1850, exam_revenue: 3700000 },
  { date: '2026-06', modality: 'MR', exam_count: 1920, exam_revenue: 3840000 },
  { date: '2026-01', modality: 'DR', exam_count: 4200, exam_revenue: 1680000 },
  { date: '2026-02', modality: 'DR', exam_count: 3850, exam_revenue: 1540000 },
  { date: '2026-03', modality: 'DR', exam_count: 4450, exam_revenue: 1780000 },
  { date: '2026-04', modality: 'DR', exam_count: 4380, exam_revenue: 1752000 },
  { date: '2026-05', modality: 'DR', exam_count: 4620, exam_revenue: 1848000 },
  { date: '2026-06', modality: 'DR', exam_count: 4800, exam_revenue: 1920000 },
  { date: '2026-01', modality: 'MG', exam_count: 380, exam_revenue: 456000 },
  { date: '2026-02', modality: 'MG', exam_count: 350, exam_revenue: 420000 },
  { date: '2026-03', modality: 'MG', exam_count: 420, exam_revenue: 504000 },
  { date: '2026-04', modality: 'MG', exam_count: 400, exam_revenue: 480000 },
  { date: '2026-05', modality: 'MG', exam_count: 440, exam_revenue: 528000 },
  { date: '2026-06', modality: 'MG', exam_count: 460, exam_revenue: 552000 },
];

export const olapHandlers = [
  http.get('/api/v1/olap/metadata', async () => {
    await delay(80);
    return HttpResponse.json(METADATA);
  }),

  http.post('/api/v1/olap/query', async ({ request }) => {
    await delay(100);
    const body = await request.json() as any;
    const dims: string[] = body?.dimensions || [];
    const measures: string[] = body?.measures || [];

    const columns = [
      ...dims.map((d: string) => {
        const found = METADATA.dimensions.find((dd) => dd.id === d);
        return { key: d, name: found?.name || d, type: 'dimension' };
      }),
      ...measures.map((m: string) => {
        const found = METADATA.metrics.find((mm) => mm.id === m);
        return { key: m, name: found?.name || m, type: 'measure' };
      }),
    ];

    const rows = MOCK_ROWS.map((row) => {
      const out: Record<string, unknown> = {};
      dims.forEach((d) => { out[d] = row[d] ?? null; });
      measures.forEach((m) => { out[m] = (row as any)[m] ?? null; });
      return out;
    });

    return HttpResponse.json({
      columns,
      rows,
      total: rows.length,
      generatedAt: new Date().toISOString(),
      query: body,
    });
  }),
];
