import { http, HttpResponse, delay } from 'msw';
import { list } from './store';

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

    // 从 kpiHistory 聚合查询
    const allKpis = list<any>('kpiHistory');
    const rows: Record<string, unknown>[] = [];
    if (allKpis.length > 0) {
      const grouped = new Map<string, Record<string, unknown>>();
      allKpis.forEach((kpi: any) => {
        const date = kpi.date ? kpi.date.substring(0, 7) : 'unknown'; // YYYY-MM
        const key = date;
        if (!grouped.has(key)) {
          const row: Record<string, unknown> = { date };
          dims.forEach(d => { if (d !== 'date') row[d] = null; });
          measures.forEach(m => { row[m] = 0; });
          grouped.set(key, row);
        }
        const row = grouped.get(key)!;
        measures.forEach(m => {
          if (m === 'exam_count' && kpi.value !== undefined) {
            row[m] = (row[m] as number || 0) + kpi.value;
          } else if (m === 'exam_revenue') {
            row[m] = (row[m] as number || 0) + Math.round((kpi.value || 0) * 2500);
          }
        });
      });
      rows.push(...Array.from(grouped.values()).slice(0, 60));
    } else {
      // fallback
      const fallbackRow: Record<string, unknown> = { date: new Date().toISOString().substring(0, 7) };
      dims.forEach(d => { if (d !== 'date') fallbackRow[d] = null; });
      measures.forEach(m => { fallbackRow[m] = 0; });
      rows.push(fallbackRow);
    }

    return HttpResponse.json({
      columns,
      rows,
      total: rows.length,
      generatedAt: new Date().toISOString(),
      query: body,
    });
  }),
];
