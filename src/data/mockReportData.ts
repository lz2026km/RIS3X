function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number, decimals = 1): number {
  const val = Math.random() * (max - min) + min;
  return parseFloat(val.toFixed(decimals));
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const modalities = ['CT', 'MR', 'DR', 'MG', 'DSA', 'CR', 'NM'];
const doctors = ['李明', '王芳', '赵强', '孙磊', '周琳', '陈静', '刘洋', '张伟', '杨帆', '吴涛'];
const techs = ['张技师', '王技师', '李技师', '刘技师', '陈技师', '赵技师'];
const depts = ['急诊科', '神经内科', '呼吸内科', '骨科', '普外科', '心内科', '肿瘤科', '妇产科', '儿科', '泌尿外科'];

function generateTimeSeries(days: number, base: number, variance: number, prefix = 'day'): { name: string; value: number }[] {
  return Array.from({ length: days }, (_, i) => ({
    name: prefix ? `${prefix}${i + 1}` : `${i + 1}日`,
    value: Math.max(0, base + randomInt(-variance, variance)),
  }));
}

function daysFromDateRange(dateRange?: [string, string]): number {
  if (!dateRange || !dateRange[0] || !dateRange[1]) return 30;
  const start = new Date(dateRange[0]);
  const end = new Date(dateRange[1]);
  const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(1, diff);
}

export function generateMockReportData(reportId: string, dateRange?: [string, string]): Record<string, unknown>[] {
  const days = daysFromDateRange(dateRange);

  switch (reportId) {
    case 'exam-volume-daily':
      return generateTimeSeries(days, 580, 120, '').map((d) => ({
        ...d,
        CT: randomInt(150, 300),
        MR: randomInt(80, 180),
        DR: randomInt(200, 400),
        MG: randomInt(20, 50),
        DSA: randomInt(8, 20),
      }));

    case 'exam-volume-weekly':
      return Array.from({ length: Math.min(days, 12) }, (_, i) => ({
        name: `第${i + 1}周`,
        value: randomInt(3800, 5200),
        CT: randomInt(1500, 2200),
        MR: randomInt(900, 1400),
        DR: randomInt(2500, 3500),
      }));

    case 'exam-volume-monthly':
      return Array.from({ length: Math.min(days, 12) }, (_, i) => ({
        name: `${i + 1}月`,
        value: randomInt(15000, 22000),
        CT: randomInt(4000, 6500),
        MR: randomInt(2500, 4000),
        DR: randomInt(7000, 10000),
        MG: randomInt(600, 1200),
        DSA: randomInt(200, 500),
      }));

    case 'exam-volume-yearly':
      return Array.from({ length: Math.min(days, 5) }, (_, i) => ({
        name: `${2022 + i}`,
        value: randomInt(180000, 260000),
        CT: randomInt(50000, 75000),
        MR: randomInt(30000, 48000),
        DR: randomInt(85000, 120000),
        growth: randomFloat(-2, 15, 1),
      }));

    case 'modality-distribution':
      return [
        { name: 'CT', value: 5280, percentage: 32.5 },
        { name: 'MR', value: 3120, percentage: 19.2 },
        { name: 'DR', value: 6420, percentage: 39.5 },
        { name: 'MG', value: 820, percentage: 5.0 },
        { name: 'DSA', value: 360, percentage: 2.2 },
        { name: '其他', value: 260, percentage: 1.6 },
      ];

    case 'body-part-top20':
      return [
        { name: '头颅CT', value: 1250 },
        { name: '胸部CT', value: 1180 },
        { name: '腹部CT', value: 950 },
        { name: '颈椎MR', value: 720 },
        { name: '腰椎MR', value: 680 },
        { name: '膝关节MR', value: 560 },
        { name: '胸部DR', value: 540 },
        { name: '骨盆CT', value: 480 },
        { name: '肩关节MR', value: 420 },
        { name: '腕关节DR', value: 390 },
        { name: '踝关节DR', value: 370 },
        { name: '脊柱DR', value: 350 },
        { name: '乳腺MG', value: 330 },
        { name: '腹部彩超', value: 310 },
        { name: '甲状腺彩超', value: 290 },
        { name: '心脏彩超', value: 270 },
        { name: '颈部血管彩超', value: 250 },
        { name: '四肢血管彩超', value: 230 },
        { name: '前列腺MR', value: 210 },
        { name: '鼻窦CT', value: 190 },
      ];

    case 'age-distribution':
      return [
        { name: '0-10岁', value: 320 },
        { name: '11-20岁', value: 580 },
        { name: '21-30岁', value: 1250 },
        { name: '31-40岁', value: 1680 },
        { name: '41-50岁', value: 2150 },
        { name: '51-60岁', value: 2480 },
        { name: '61-70岁', value: 1950 },
        { name: '71-80岁', value: 1280 },
        { name: '80岁以上', value: 510 },
      ];

    case 'gender-distribution':
      return [
        { name: '男', value: 5860, percentage: 48.8 },
        { name: '女', value: 6140, percentage: 51.2 },
      ];

    case 'peak-hour-analysis':
      return Array.from({ length: 24 }, (_, i) => ({
        name: `${i}时`,
        value: i >= 8 && i <= 11 ? randomInt(80, 150) : i >= 14 && i <= 17 ? randomInt(60, 120) : randomInt(2, 30),
      }));

    case 'weekday-weekend-compare':
      return [
        { name: '工作日', value: randomInt(600, 750), CT: randomInt(180, 260), MR: randomInt(100, 160), DR: randomInt(250, 350) },
        { name: '周末', value: randomInt(280, 420), CT: randomInt(80, 140), MR: randomInt(50, 90), DR: randomInt(120, 200) },
      ];

    case 'device-utilization':
      return [
        { name: 'CT-1', value: 92 },
        { name: 'CT-2', value: 78 },
        { name: 'MR-1', value: 88 },
        { name: 'MR-2', value: 65 },
        { name: 'DR-1', value: 85 },
        { name: 'DR-2', value: 72 },
        { name: 'DSA', value: 58 },
        { name: 'MG', value: 82 },
        { name: 'CR', value: 45 },
        { name: 'NM', value: 52 },
      ];

    case 'device-failure-rate':
      return [
        { name: 'CT-1', value: 3, failureRate: 1.2, type: '球管故障' },
        { name: 'CT-2', value: 5, failureRate: 2.1, type: '探测器故障' },
        { name: 'MR-1', value: 2, failureRate: 0.8, type: '冷头故障' },
        { name: 'MR-2', value: 4, failureRate: 1.6, type: '射频故障' },
        { name: 'DR-1', value: 1, failureRate: 0.4, type: '平板故障' },
        { name: 'DR-2', value: 2, failureRate: 0.8, type: '机械故障' },
        { name: 'DSA', value: 1, failureRate: 0.6, type: '软件故障' },
        { name: 'MG', value: 2, failureRate: 0.9, type: '压迫板故障' },
      ];

    case 'device-roi':
      return [
        { name: 'CT-1', 收入: 580, 成本: 220, 净利润: 360, roi: 23.5, paybackPeriod: 42 },
        { name: 'CT-2', 收入: 420, 成本: 180, 净利润: 240, roi: 18.2, paybackPeriod: 48 },
        { name: 'MR-1', 收入: 720, 成本: 310, 净利润: 410, roi: 19.8, paybackPeriod: 45 },
        { name: 'MR-2', 收入: 380, 成本: 240, 净利润: 140, roi: 9.5, paybackPeriod: 60 },
        { name: 'DR-1', 收入: 280, 成本: 80, 净利润: 200, roi: 35.0, paybackPeriod: 28 },
        { name: 'DR-2', 收入: 220, 成本: 75, 净利润: 145, roi: 30.2, paybackPeriod: 32 },
        { name: 'DSA', 收入: 450, 成本: 190, 净利润: 260, roi: 16.5, paybackPeriod: 50 },
        { name: 'MG', 收入: 180, 成本: 60, 净利润: 120, roi: 28.0, paybackPeriod: 36 },
      ].map((d) => ({ ...d, 收入: d.收入 * 10000, 成本: d.成本 * 10000, 净利润: d.净利润 * 10000 }));

    case 'device-maintenance-due':
      return Array.from({ length: 10 }, (_, i) => ({
        name: `${pick(modalities)}-${i + 1}`,
        value: randomInt(-15, 60),
        保养类型: pick(['季度保养', '半年保养', '年度保养', '球管更换', '校准']),
      }));

    case 'report-timeliness':
      return [
        { name: 'CT', value: 96.5 },
        { name: 'MR', value: 93.2 },
        { name: 'DR', value: 98.1 },
        { name: 'MG', value: 95.0 },
        { name: 'DSA', value: 97.8 },
        { name: '急诊', value: 99.2 },
        { name: '住院', value: 94.5 },
        { name: '门诊', value: 97.0 },
      ];

    case 'report-overtime':
      return [
        { name: 'CT', value: 45, overtimeRate: 2.8 },
        { name: 'MR', value: 68, overtimeRate: 4.2 },
        { name: 'DR', value: 22, overtimeRate: 1.5 },
        { name: 'MG', value: 12, overtimeRate: 3.0 },
        { name: 'DSA', value: 8, overtimeRate: 2.0 },
      ];

    case 'review-pass-rate':
      return modalities.map((m) => ({
        name: m,
        value: randomFloat(88, 99, 1),
        rejectRate: randomFloat(1, 12, 1),
      }));

    case 'qc-score-distribution':
      return [
        { name: '甲级(≥95分)', value: 1680, percentage: 72.4 },
        { name: '乙级(85-94分)', value: 480, percentage: 20.7 },
        { name: '丙级(70-84分)', value: 120, percentage: 5.2 },
        { name: '丁级(<70分)', value: 40, percentage: 1.7 },
      ];

    case 'rework-rate':
      return doctors.map((d) => ({
        name: d,
        value: randomFloat(1.0, 8.5, 1),
        reworkCount: randomInt(2, 25),
      }));

    case 'positive-rate':
      return [
        { name: 'CT', value: 68.5, positiveCount: 3610 },
        { name: 'MR', value: 72.3, positiveCount: 2256 },
        { name: 'DR', value: 45.2, positiveCount: 2900 },
        { name: 'MG', value: 35.8, positiveCount: 294 },
        { name: 'DSA', value: 82.5, positiveCount: 297 },
      ];

    case 'report-word-count-trend':
      return Array.from({ length: Math.min(days, 12) }, (_, i) => ({
        name: `${i + 1}月`,
        value: randomInt(180, 350),
        findings: randomInt(80, 180),
        impression: randomInt(40, 100),
      }));

    case 'report-modification-count':
      return [
        { name: '0次', value: 1560, percentage: 38.2 },
        { name: '1次', value: 1280, percentage: 31.4 },
        { name: '2次', value: 720, percentage: 17.6 },
        { name: '3次', value: 340, percentage: 8.3 },
        { name: '4次及以上', value: 180, percentage: 4.5 },
      ];

    case 'department-overtime-ranking':
      return depts.map((d) => ({ name: d, value: randomInt(3, 85) })).sort((a, b) => b.value - a.value);

    case 'template-usage-frequency':
      return [
        { name: '头颅CT平扫模板', value: 580 },
        { name: '胸部CT平扫模板', value: 520 },
        { name: '腹部CT增强模板', value: 480 },
        { name: '腰椎MR平扫模板', value: 350 },
        { name: '膝关节MR平扫模板', value: 320 },
        { name: '颈椎MR平扫模板', value: 290 },
        { name: '胸部DR正位模板', value: 450 },
        { name: '骨盆CT平扫模板', value: 210 },
        { name: '乳腺MG模板', value: 180 },
        { name: '肩关节MR平扫模板', value: 160 },
      ];

    case 'critical-value-closure':
      return Array.from({ length: Math.min(days, 12) }, (_, i) => ({
        name: `${i + 1}月`,
        value: randomInt(12, 45),
        median: randomInt(8, 30),
        max: randomInt(60, 180),
        count: randomInt(20, 80),
      }));

    case 'critical-value-dept-dist':
      return depts.slice(0, 8).map((d) => ({
        name: d,
        value: randomInt(5, 60),
      }));

    case 'doctor-workload-top10':
      return doctors.map((d, i) => ({
        name: d,
        value: randomInt(150 - i * 10, 280 - i * 8),
        reviewCount: randomInt(80, 200),
      })).sort((a, b) => b.value - a.value);

    case 'tech-workload':
      return techs.map((t) => ({
        name: t,
        value: randomInt(180, 420),
        avgTime: randomFloat(8, 25, 1),
      }));

    case 'revenue-cost-analysis':
      return [
        { name: 'CT', 收入: 5800000, 成本: 2200000, 利润: 3600000 },
        { name: 'MR', 收入: 7200000, 成本: 3100000, 利润: 4100000 },
        { name: 'DR', 收入: 2800000, 成本: 800000, 利润: 2000000 },
        { name: 'MG', 收入: 1800000, 成本: 600000, 利润: 1200000 },
        { name: 'DSA', 收入: 4500000, 成本: 1900000, 利润: 2600000 },
      ];

    case 'insurance-type-dist':
      return [
        { name: '城镇职工医保', value: 4520, percentage: 37.7 },
        { name: '城镇居民医保', value: 3210, percentage: 26.8 },
        { name: '新农合', value: 1850, percentage: 15.4 },
        { name: '自费', value: 1420, percentage: 11.8 },
        { name: '商业保险', value: 680, percentage: 5.7 },
        { name: '其他', value: 320, percentage: 2.6 },
      ];

    case 'consultation-stats':
      return [
        { name: '疑难病例会诊', value: 156 },
        { name: '远程影像会诊', value: 89 },
        { name: '术中冰冻会诊', value: 45 },
        { name: '临床科室会诊', value: 234 },
        { name: '多学科会诊MDT', value: 68 },
      ];

    case 'remote-consultation-volume':
      return Array.from({ length: Math.min(days, 12) }, (_, i) => ({
        name: `${i + 1}月`,
        value: randomInt(30, 120),
      }));

    case 'bi-rads-distribution':
      return [
        { name: 'BI-RADS 0', value: 45 },
        { name: 'BI-RADS 1', value: 120 },
        { name: 'BI-RADS 2', value: 280 },
        { name: 'BI-RADS 3', value: 420 },
        { name: 'BI-RADS 4A', value: 180 },
        { name: 'BI-RADS 4B', value: 95 },
        { name: 'BI-RADS 4C', value: 55 },
        { name: 'BI-RADS 5', value: 35 },
        { name: 'BI-RADS 6', value: 15 },
      ];

    case 'li-rads-distribution':
      return [
        { name: 'LR-1', value: 85 },
        { name: 'LR-2', value: 120 },
        { name: 'LR-3', value: 160 },
        { name: 'LR-4', value: 90 },
        { name: 'LR-5', value: 55 },
        { name: 'LR-M', value: 25 },
        { name: 'LR-TIV', value: 15 },
      ];

    case 'ai-accuracy-rate':
      return Array.from({ length: Math.min(days, 12) }, (_, i) => ({
        name: `${i + 1}月`,
        value: randomFloat(85, 96, 1),
        doctorAccuracy: randomFloat(92, 98, 1),
      }));

    case 'ai-miss-rate':
      return [
        { name: '肺结节<5mm', value: 38 },
        { name: '微小骨折', value: 25 },
        { name: '早期肿瘤', value: 18 },
        { name: '血管变异', value: 12 },
        { name: '炎症早期', value: 15 },
        { name: '其他', value: 22 },
      ];

    case 'ai-adoption-rate':
      return Array.from({ length: Math.min(days, 12) }, (_, i) => ({
        name: `${i + 1}月`,
        value: randomFloat(42, 78, 1),
      }));

    case 'radiation-dose-stats':
      return Array.from({ length: Math.min(days, 12) }, (_, i) => ({
        name: `${i + 1}月`,
        CT_DLP: randomInt(38000, 52000),
        CT_CTDI: randomFloat(8, 16, 1),
        DR_DAP: randomInt(800, 1500),
        MG_AGD: randomFloat(1.2, 2.8, 2),
      }));

    case 'contrast-adverse-rate':
      return [
        { name: '轻度反应', value: 28, percentage: 70.0 },
        { name: '中度反应', value: 8, percentage: 20.0 },
        { name: '重度反应', value: 2, percentage: 5.0 },
        { name: '迟发型反应', value: 2, percentage: 5.0 },
      ];

    case 'contrast-inventory-warning':
      return [
        { name: '碘海醇(350mgI/ml)', value: 120, safetyStock: 200 },
        { name: '碘帕醇(370mgI/ml)', value: 85, safetyStock: 150 },
        { name: '钆喷酸葡胺', value: 45, safetyStock: 80 },
        { name: '钆塞酸二钠', value: 28, safetyStock: 40 },
        { name: '碘克沙醇(320mgI/ml)', value: 65, safetyStock: 100 },
        { name: '碘佛醇(320mgI/ml)', value: 180, safetyStock: 120 },
      ];

    case 'patient-wait-time':
      return Array.from({ length: Math.min(days, 12) }, (_, i) => ({
        name: `${i + 1}月`,
        value: randomInt(18, 45),
        median: randomInt(12, 32),
        max: randomInt(60, 180),
      }));

    case 'appointment-cancel-rate':
      return [
        { name: '患者原因-自行取消', value: 320 },
        { name: '患者原因-未到诊', value: 180 },
        { name: '医生原因-停诊', value: 65 },
        { name: '设备原因-故障', value: 28 },
        { name: '其他原因', value: 45 },
      ];

    case 'patient-source-dist':
      return [
        { name: '门诊', value: 6850, percentage: 57.1 },
        { name: '住院', value: 3210, percentage: 26.8 },
        { name: '急诊', value: 1280, percentage: 10.7 },
        { name: '体检', value: 650, percentage: 5.4 },
      ];

    case 'mobile-usage':
      return Array.from({ length: Math.min(days, 12) }, (_, i) => ({
        name: `${i + 1}月`,
        value: randomInt(1200, 3500),
        预约量: randomInt(300, 900),
        查看量: randomInt(800, 2500),
      }));

    case 'teaching-case-stats':
      return Array.from({ length: Math.min(days, 12) }, (_, i) => ({
        name: `${i + 1}月`,
        value: randomInt(8, 35),
        views: randomInt(50, 300),
      }));

    case 'image-storage-trend':
      return Array.from({ length: Math.min(days, 12) }, (_, i) => ({
        name: `${i + 1}月`,
        value: randomFloat(12.5 + i * 0.5, 18 + i * 0.6, 1),
        growth: randomFloat(0.4, 0.9, 2),
      }));

    case 'system-online-rate':
      return Array.from({ length: Math.min(days, 12) }, (_, i) => ({
        name: `${i + 1}月`,
        value: randomFloat(99.2, 100, 2),
        coreUptime: randomFloat(99.5, 100, 2),
      }));

    case 'api-call-volume':
      return [
        { name: '检查查询API', value: 258000, avgResponse: 45 },
        { name: '报告查询API', value: 185000, avgResponse: 52 },
        { name: '影像查询API', value: 320000, avgResponse: 120 },
        { name: '患者信息API', value: 156000, avgResponse: 38 },
        { name: '预约API', value: 42000, avgResponse: 65 },
        { name: '危急值API', value: 8500, avgResponse: 28 },
        { name: '工作量统计API', value: 32000, avgResponse: 180 },
        { name: '数据上报API', value: 12000, avgResponse: 350 },
      ];

    // ── 新增 20+ 报表 mock 数据 ──
    case 'exam-volume-by-doctor':
      return doctors.map((d, i) => ({
        name: d,
        value: randomInt(200 - i * 12, 350 - i * 10),
      })).sort((a, b) => b.value - a.value);

    case 'exam-volume-by-dept':
      return depts.map((d) => ({
        name: d,
        value: randomInt(200, 1800),
      })).sort((a, b) => b.value - a.value);

    case 'exam-volume-by-protocol':
      return [
        { name: '头颅CT平扫', value: 1250 },
        { name: '胸部CT平扫', value: 1180 },
        { name: '腹部CT增强', value: 950 },
        { name: '腰椎MR平扫', value: 720 },
        { name: '颈椎MR平扫', value: 680 },
        { name: '胸部DR正位', value: 540 },
        { name: '膝关节MR平扫', value: 520 },
        { name: '骨盆CT平扫', value: 480 },
        { name: '腹部彩超', value: 420 },
        { name: '乳腺MG', value: 330 },
      ];

    case 'device-uptime-rate':
      return Array.from({ length: Math.min(days, 12) }, (_, i) => ({
        name: `${i + 1}月`,
        value: randomFloat(85, 100, 1),
        CT: randomFloat(88, 100, 1),
        MR: randomFloat(85, 99, 1),
        DR: randomFloat(90, 100, 1),
      }));

    case 'device-downtime-rate':
      return [
        { name: '计划内维护', value: 45, percentage: 32.1 },
        { name: '软件故障', value: 35, percentage: 25.0 },
        { name: '硬件故障', value: 28, percentage: 20.0 },
        { name: '网络故障', value: 18, percentage: 12.9 },
        { name: '其他原因', value: 14, percentage: 10.0 },
      ];

    case 'device-daily-utilization-trend':
      return generateTimeSeries(days, 72, 15, '').map((d) => ({
        ...d,
        'CT-1': randomInt(65, 98),
        'MR-1': randomInt(55, 92),
        'DR-1': randomInt(60, 95),
      }));

    case 'qc-issue-top10':
      return [
        { name: '诊断描述不完整', value: 42 },
        { name: '结论与描述不符', value: 35 },
        { name: '错别字/标点错误', value: 28 },
        { name: '未使用规范术语', value: 22 },
        { name: '漏报阳性征象', value: 18 },
        { name: '排版格式不符', value: 15 },
        { name: '患者信息错误', value: 12 },
        { name: '签名不规范', value: 10 },
        { name: '超时未提交', value: 8 },
        { name: '图像与报告不符', value: 6 },
      ];

    case 'qc-issue-by-doctor':
      return doctors.map((d) => ({
        name: d,
        value: randomInt(0, 15),
      })).sort((a, b) => b.value - a.value);

    case 'critical-escalation-rate':
      return Array.from({ length: Math.min(days, 12) }, (_, i) => ({
        name: `${i + 1}月`,
        value: randomFloat(2, 15, 1),
      }));

    case 'critical-miss-rate':
      return [
        { name: '系统未识别', value: 35, percentage: 38.9 },
        { name: '医生未确认', value: 25, percentage: 27.8 },
        { name: '通知失败', value: 18, percentage: 20.0 },
        { name: '交接遗漏', value: 12, percentage: 13.3 },
      ];

    case 'critical-response-time-trend':
      return Array.from({ length: Math.min(days, 12) }, (_, i) => ({
        name: `${i + 1}月`,
        value: randomInt(5, 30),
      }));

    case 'ai-vs-doctor-kappa':
      return Array.from({ length: Math.min(days, 12) }, (_, i) => ({
        name: `${i + 1}月`,
        value: randomFloat(0.6, 0.92, 2),
        CT: randomFloat(0.7, 0.95, 2),
        MR: randomFloat(0.65, 0.9, 2),
        DR: randomFloat(0.55, 0.85, 2),
      }));

    case 'ai-vs-doctor-agreement':
      return [
        { name: 'CT', value: randomFloat(82, 96, 1) },
        { name: 'MR', value: randomFloat(78, 93, 1) },
        { name: 'DR', value: randomFloat(75, 90, 1) },
        { name: 'MG', value: randomFloat(72, 88, 1) },
      ];

    case 'ai-false-positive-rate':
      return Array.from({ length: Math.min(days, 12) }, (_, i) => ({
        name: `${i + 1}月`,
        value: randomFloat(3, 18, 1),
      }));

    case 'radiation-dose-over-limit':
      return [
        { name: 'CT-1', value: randomFloat(0.5, 5.0, 1) },
        { name: 'CT-2', value: randomFloat(1.0, 6.5, 1) },
        { name: 'DSA', value: randomFloat(0.5, 3.0, 1) },
        { name: 'DR-1', value: randomFloat(0.1, 1.5, 1) },
        { name: 'MG', value: randomFloat(0.3, 2.0, 1) },
      ];

    case 'radiation-dose-by-modality':
      return [
        { name: 'CT', value: randomFloat(380, 520, 1) },
        { name: 'DSA', value: randomFloat(250, 400, 1) },
        { name: 'DR', value: randomFloat(0.5, 2.0, 2) },
        { name: 'MG', value: randomFloat(1.5, 3.0, 2) },
      ];

    case 'patient-followup-rate':
      return Array.from({ length: Math.min(days, 12) }, (_, i) => ({
        name: `${i + 1}月`,
        value: randomFloat(15, 40, 1),
      }));

    case 'patient-no-show-rate':
      return depts.map((d) => ({
        name: d,
        value: randomFloat(1, 15, 1),
      })).sort((a, b) => b.value - a.value);

    case 'finance-arrears-rate':
      return [
        { name: '1000元以下', value: 120, percentage: 32.4 },
        { name: '1000-5000元', value: 85, percentage: 23.0 },
        { name: '5000-10000元', value: 45, percentage: 12.2 },
        { name: '10000-50000元', value: 28, percentage: 7.6 },
        { name: '50000元以上', value: 12, percentage: 3.2 },
        { name: '医保拒付待处理', value: 80, percentage: 21.6 },
      ];

    case 'finance-insurance-reject':
      return [
        { name: '诊断与项目不符', value: 356000, percentage: 35.6 },
        { name: '重复收费', value: 185000, percentage: 18.5 },
        { name: '无指征检查', value: 145000, percentage: 14.5 },
        { name: '超量开单', value: 120000, percentage: 12.0 },
        { name: '材料费超标', value: 98000, percentage: 9.8 },
        { name: '其他原因', value: 96000, percentage: 9.6 },
      ];

    case 'contrast-usage-trend':
      return Array.from({ length: Math.min(days, 12) }, (_, i) => ({
        name: `${i + 1}月`,
        value: randomInt(200, 500),
        碘海醇: randomInt(80, 200),
        碘帕醇: randomInt(60, 150),
        钆喷酸葡胺: randomInt(30, 80),
      }));

    case 'report-avg-turnaround':
      return Array.from({ length: Math.min(days, 12) }, (_, i) => ({
        name: `${i + 1}月`,
        value: randomFloat(2, 12, 1),
        emergency: randomFloat(0.5, 3, 1),
      }));

    default:
      return generateTimeSeries(days, 500, 100, '');
  }
}
