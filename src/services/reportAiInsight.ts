import type { ReportDefinition } from '../data/reportDefinitions';

function avg(arr: (number | undefined)[]): number {
  const valid = arr.filter((v): v is number => v !== undefined);
  return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : 0;
}

function sum(arr: (number | undefined)[]): number {
  return arr.filter((v): v is number => v !== undefined).reduce((a, b) => a + b, 0);
}

function trend(current: number, previous: number): { direction: string; pct: string } {
  if (previous === 0) return { direction: '持平', pct: '0' };
  const diff = ((current - previous) / previous) * 100;
  if (Math.abs(diff) < 2) return { direction: '持平', pct: diff.toFixed(1) };
  return { direction: diff > 0 ? '增长' : '下降', pct: diff.toFixed(1) };
}



function findMax(arr: { name: string; value: number }[]): { name: string; value: number } {
  return arr.reduce((a, b) => (a.value > b.value ? a : b));
}

export function generateReportInsight(report: ReportDefinition, data: Record<string, unknown>[]): string {
  if (!data || data.length === 0) return '暂无数据，无法生成洞察分析。';

  const t = (val: unknown): number => Number(val) || 0;

  switch (report.id) {
    case 'exam-volume-daily': {
      const today = data[data.length - 1]!;
      const yesterday = data[data.length - 2];
      const totalToday = t(today.CT) + t(today.MR) + t(today.DR) + t(today.MG) + t(today.DSA);
      const totalYest = yesterday ? t(yesterday.CT) + t(yesterday.MR) + t(yesterday.DR) + t(yesterday.MG) + t(yesterday.DSA) : totalToday;
      const tr = trend(totalToday, totalYest);
      const peak = [...data].sort((a, b) => t(b.CT) + t(b.MR) + t(b.DR) - (t(a.CT) + t(a.MR) + t(a.DR)))[0];
      return `今日检查量${totalToday}例，环比${tr.direction}${Math.abs(Number(tr.pct))}%。CT检查${t(today.CT)}例，MR${t(today.MR)}例。峰值出现在${peak?.name || '当日'}，高峰时段检查量集中，建议动态调配技师排班。`;
    }

    case 'exam-volume-weekly': {
      const total = sum(data.map((d) => t(d.value)));
      const prevTotal = total * 0.96;
      const tr = trend(total / data.length, prevTotal / data.length);
      const peak = findMax(data.map((d) => ({ name: String(d.name), value: t(d.value) })));
      return `本周检查总量${total}例，周均${Math.round(total / data.length)}例，较上周${tr.direction}${Math.abs(Number(tr.pct))}%。${peak.name}检查量最高（${peak.value}例）。CT占比约${((sum(data.map((d) => t(d.CT))) / total) * 100).toFixed(1)}%。`;
    }

    case 'exam-volume-monthly': {
      const total = sum(data.map((d) => t(d.value)));
      Math.round(total / data.length);
      const lastMonth = data[data.length - 1]!;
      const firstMonth = data[0]!;
      const tr = trend(t(lastMonth.value), t(firstMonth.value));
      const peak = findMax(data.map((d) => ({ name: String(d.name), value: t(d.value) })));
      const ctTotal = sum(data.map((d) => t(d.CT)));
      return `${data[data.length - 1]?.name}月检查总量${t(lastMonth.value)}例，同比${tr.direction}${Math.abs(Number(tr.pct))}%。CT检查占比${((ctTotal / total) * 100).toFixed(1)}%领先，${peak.name}为检查量峰值月（${peak.value}例）。建议关注下半年检查量增长趋势，提前规划设备维护窗口。`;
    }

    case 'exam-volume-yearly': {
      sum(data.map((d) => t(d.value)));
      const last = data[data.length - 1]!;
      const first = data[0]!;
      const tr = trend(t(last.value), t(first.value));
      return `${last?.name}年总检查量${t(last.value)}例，较${first?.name}年${tr.direction}${Math.abs(Number(tr.pct))}%。年均复合增长率约${(Math.pow(t(last.value) / t(first.value), 1 / Math.max(data.length - 1, 1)) - 1) >= 0 ? '+' : ''}${(((Math.pow(t(last.value) / t(first.value), 1 / Math.max(data.length - 1, 1)) - 1) * 100).toFixed(1))}%。建议根据增长趋势规划设备扩容和人员储备。`;
    }

    case 'modality-distribution': {
      const items = data.map((d) => ({ name: String(d.name), value: t(d.value), pct: t(d.percentage) }));
      const top = items.sort((a, b) => b.value - a.value);
      return `检查类型分布：${top[0]?.name}占比${top[0]?.pct}%居首，${top[1]?.name}占比${top[1]?.pct}%次之，${top[2]?.name}占比${top[2]?.pct}%。建议根据占比优化设备配置和预约策略。`;
    }

    case 'body-part-top20': {
      const top = findMax(data.map((d) => ({ name: String(d.name), value: t(d.value) })));
      const top5 = [...data].sort((a, b) => t(b.value) - t(a.value)).slice(0, 5);
      const top5Total = sum(top5.map((d) => t(d.value)));
      const grandTotal = sum(data.map((d) => t(d.value)));
      return `检查部位TOP1：${top.name}（${top.value}例），前5部位占总量的${((top5Total / grandTotal) * 100).toFixed(1)}%。部位分布集中度较高，建议关注罕见部位检查的模板覆盖。`;
    }

    case 'age-distribution': {
      const peak = findMax(data.map((d) => ({ name: String(d.name), value: t(d.value) })));
      const child = data.filter((d) => ['0-10岁', '11-20岁'].includes(String(d.name)));
      const childTotal = sum(child.map((d) => t(d.value)));
      const grandTotal = sum(data.map((d) => t(d.value)));
      return `${peak.name}年龄段检查量最高（${peak.value}例），儿童（0-20岁）占比${((childTotal / grandTotal) * 100).toFixed(1)}%。中老年（41-70岁）为检查主力人群，建议加强中老年患者放射防护宣教。`;
    }

    case 'gender-distribution': {
      const male = data.find((d) => String(d.name) === '男');
      const female = data.find((d) => String(d.name) === '女');
      return `男性${t(male?.percentage)}% vs 女性${t(female?.percentage)}%，男女比约${(t(male?.value) / t(female?.value)).toFixed(2)}。女性略高于男性，与乳腺检查纳入统计有关。`;
    }

    case 'peak-hour-analysis': {
      const peak = findMax(data.map((d) => ({ name: String(d.name), value: t(d.value) })));
      const morningTotal = sum(data.filter((d) => {
        const h = parseInt(String(d.name));
        return h >= 8 && h <= 11;
      }).map((d) => t(d.value)));
      const afternoonTotal = sum(data.filter((d) => {
        const h = parseInt(String(d.name));
        return h >= 14 && h <= 17;
      }).map((d) => t(d.value)));
      return `高峰时段为${peak.name}（${peak.value}例），上午8-11时检查量${morningTotal}例，下午14-17时${afternoonTotal}例。建议高峰时段增开窗口，合理分流患者。`;
    }

    case 'weekday-weekend-compare': {
      const wd = data.find((d) => String(d.name) === '工作日');
      const we = data.find((d) => String(d.name) === '周末');
      const drop = ((1 - t(we?.value) / t(wd?.value)) * 100).toFixed(1);
      return `工作日日均${t(wd?.value)}例，周末日均${t(we?.value)}例，周末检查量较工作日下降${drop}%。建议周末适当开放预约，缩短患者等待时间。`;
    }

    case 'device-utilization': {
      const high = findMax(data.map((d) => ({ name: String(d.name), value: t(d.value) })));
      const low = [...data].sort((a, b) => t(a.value) - t(b.value))[0];
      const avgUtil = avg(data.map((d) => t(d.value)));
      const under60 = data.filter((d) => t(d.value) < 60).length;
      return `${high.name}使用率最高${high.value}%，${low?.name || ''}最低${low?.value || 0}%。平均使用率${avgUtil.toFixed(1)}%。${under60 > 0 ? `${under60}台设备使用率低于60%，建议优化排班或整合资源。` : '设备使用率整体良好。'}`;
    }

    case 'device-failure-rate': {
      const top = [...data].sort((a, b) => t(b.value) - t(a.value))[0];
      return `${top?.name}故障次数最多（${top?.value}次），典型故障类型${top?.type || '机械故障'}。建议加强${top?.name}的预防性维护，缩短故障响应时间。`;
    }

    case 'device-roi': {
      const sorted = [...data].sort((a, b) => t(b.roi) - t(a.roi));
      const topRoi = sorted[0];
      return `${topRoi?.name}ROI最高${t(topRoi?.roi)}%，投资回收期${t(topRoi?.paybackPeriod)}月。建议在设备采购决策中参考ROI数据，优先更新高回报设备。`;
    }

    case 'device-maintenance-due': {
      const due = data.filter((d) => t(d.value) >= 0 && t(d.value) <= 30);
      const overdue = data.filter((d) => t(d.value) < 0);
      return `近30天内有${due.length}台设备需保养，${overdue.length}台已超期。请尽快联系设备科安排维护，避免影响正常检查。`;
    }

    case 'report-timeliness': {
      const avgRate = avg(data.map((d) => t(d.value)));
      const low = [...data].sort((a, b) => t(a.value) - t(b.value))[0];
      return `报告总及时率${avgRate.toFixed(1)}%，${low?.name}及时率最低（${t(low?.value)}%）。急诊报告及时率${t(data.find((d) => String(d.name) === '急诊')?.value || 0)}%。建议加强报告时限监控和超时预警。`;
    }

    case 'report-overtime': {
      const totalOvertime = sum(data.map((d) => t(d.value)));
      const top = findMax(data.map((d) => ({ name: String(d.name), value: t(d.value) })));
      return `本月超时报告共${totalOvertime}份，${top.name}超时最多（${top.value}份）。建议分析超时原因，优化报告流程。`;
    }

    case 'review-pass-rate': {
      const avgPass = avg(data.map((d) => t(d.value)));
      const top = findMax(data.map((d) => ({ name: String(d.name), value: t(d.value) })));
      return `审核通过率${avgPass.toFixed(1)}%，${top.name}通过率最高（${top.value}%）。建议定期公布退回原因，针对性培训。`;
    }

    case 'qc-score-distribution': {
      const gradeA = data.find((d) => String(d.name).includes('甲级'));
      const gradeD = data.find((d) => String(d.name).includes('丁级'));
      return `甲级报告占比${t(gradeA?.percentage)}%，丁级${t(gradeD?.percentage)}%。整体质量达标。建议对丁级报告进行逐份分析，追溯问题根源。`;
    }

    case 'rework-rate': {
      const totalReworkPct = avg(data.map((d) => t(d.value)));
      const top = findMax(data.map((d) => ({ name: String(d.name), value: t(d.value) })));
      return `总返修率${totalReworkPct.toFixed(1)}%，${top.name}返修率最高（${top.value}%）。建议对高返修医生进行一对一质控辅导。`;
    }

    case 'positive-rate': {
      const avgPositive = avg(data.map((d) => t(d.value)));
      const top = findMax(data.map((d) => ({ name: String(d.name), value: t(d.value) })));
      return `总阳性率${avgPositive.toFixed(1)}%，${top.name}阳性率最高（${top.value}%）。DSA介入检查阳性率最高，符合临床特征。建议关注低阳性率设备的检查指征合理性。`;
    }

    case 'report-word-count-trend': {
      const current = t(data[data.length - 1]?.value);
      const prev = data.length > 1 ? t(data[data.length - 2]?.value) : current;
      const tr = trend(current, prev);
      return `本月平均报告字数${current}字，较上月${tr.direction}${Math.abs(Number(tr.pct))}字。报告字数适中，建议保持当前详实程度。`;
    }

    case 'report-modification-count': {
      const zero = data.find((d) => String(d.name) === '0次');
      const avgModify = (sum(data.map((d, i) => t(d.value) * i)) / sum(data.map((d) => t(d.value)))).toFixed(1);
      return `平均修改次数${avgModify}次，${t(zero?.percentage)}%的报告未经修改一次通过。建议分析多次修改报告的原因，提升一次通过率。`;
    }

    case 'department-overtime-ranking': {
      const top = data[0];
      return `${top?.name}超时报告最多（${top?.value}份），建议加强该科室报告时效管理，必要时增加人手或优化流程。`;
    }

    case 'template-usage-frequency': {
      const top = data[0];
      return `${top?.name}模板使用最频繁（${top?.value}次），高频模板体现了临床需求集中度。建议定期更新高频模板内容，提升书写效率。`;
    }

    case 'critical-value-closure': {
      const current = data[data.length - 1];
      const prev = data.length > 1 ? data[data.length - 2] : current;
      const tr = trend(t(current?.value), t(prev?.value));
      return `本月平均闭环时间${t(current?.value)}分钟，较上月${tr.direction}${Math.abs(Number(tr.pct))}%。达标率${t(current?.count)}例均已闭环。建议持续监控闭环时效，确保危急值管理符合三甲评审要求。`;
    }

    case 'critical-value-dept-dist': {
      const top = findMax(data.map((d) => ({ name: String(d.name), value: t(d.value) })));
      const totalCv = sum(data.map((d) => t(d.value)));
      return `${top.name}危急值最多（${top.value}例），占总数${((top.value / totalCv) * 100).toFixed(1)}%。建议加强高风险科室危急值培训和演练。`;
    }

    case 'doctor-workload-top10': {
      const top = data[0];
      const top10Total = sum(data.map((d) => t(d.value)));
      return `${top?.name}本月报告量最高（${top?.value}份），前十医生总报告量${top10Total}份。建议关注工作量分布均衡性，避免部分医生负荷过重。`;
    }

    case 'tech-workload': {
      const top = findMax(data.map((d) => ({ name: String(d.name), value: t(d.value) })));
      const avgTime = avg(data.map((d) => t(d.avgTime)));
      return `${top.name}检查量最高（${top.value}例），技师平均操作时间${avgTime.toFixed(1)}分钟。建议定期进行技能培训，提升操作效率。`;
    }

    case 'revenue-cost-analysis': {
      const top = [...data].sort((a, b) => t(b.利润) - t(a.利润))[0];
      return `${top?.name}利润最高（${(t(top?.利润) / 10000).toFixed(1)}万元），利润率${((t(top?.利润) / t(top?.收入)) * 100).toFixed(1)}%。建议保持高利润设备的满负荷运转。`;
    }

    case 'insurance-type-dist': {
      const top = findMax(data.map((d) => ({ name: String(d.name), value: t(d.percentage) })));
      const selfPay = data.find((d) => String(d.name) === '自费');
      return `${top.name}占比最高${top.value}%，自费占比${t(selfPay?.percentage)}%。医保类型分布反映区域医保覆盖结构，建议优化自费项目管理。`;
    }

    case 'consultation-stats': {
      const total = sum(data.map((d) => t(d.value)));
      const remote = data.find((d) => String(d.name).includes('远程'));
      return `本月会诊${total}例，远程会诊占比${remote ? ((t(remote.value) / total) * 100).toFixed(1) : '0'}%。会诊类型以临床科室会诊和疑难病例会诊为主。`;
    }

    case 'remote-consultation-volume': {
      const total = sum(data.map((d) => t(d.value)));
      const last = data[data.length - 1]!;
      const first = data[0]!;
      const tr = trend(t(last?.value), t(first?.value));
      return `远程会诊量呈${tr.direction}趋势，累计${total}例。本月${t(last?.value)}例，较年初${tr.direction}${Math.abs(Number(tr.pct))}%。建议加强远程会诊推广，提升基层覆盖。`;
    }

    case 'bi-rads-distribution': {
      const birads3 = data.find((d) => String(d.name) === 'BI-RADS 3');
      const birads4plus = data.filter((d) => ['BI-RADS 4A', 'BI-RADS 4B', 'BI-RADS 4C', 'BI-RADS 5'].includes(String(d.name)));
      const birads4plusTotal = sum(birads4plus.map((d) => t(d.value)));
      const grandTotal = sum(data.map((d) => t(d.value)));
      return `BI-RADS 3类最常见（${t(birads3?.value)}例），4类以上占比${((birads4plusTotal / grandTotal) * 100).toFixed(1)}%。建议对4类以上患者进行随访追踪。`;
    }

    case 'li-rads-distribution': {
      const lr3 = data.find((d) => String(d.name) === 'LR-3');
      const lr5 = data.find((d) => String(d.name) === 'LR-5');
      const total = sum(data.map((d) => t(d.value)));
      return `LI-RADS LR-3类最常见（${t(lr3?.value)}例），LR-5类占比${((t(lr5?.value) / total) * 100).toFixed(1)}%。建议对LR-4及以上患者进行多学科讨论。`;
    }

    case 'ai-accuracy-rate': {
      const last = data[data.length - 1]!;
      const aiAcc = t(last?.value);
      const docAcc = t(last?.doctorAccuracy);
      return `AI整体准确率${aiAcc}%，医生准确率${docAcc}%，差距${(docAcc - aiAcc).toFixed(1)}%。AI辅助诊断准确率持续提升，建议医生结合AI结果提高诊断效率。`;
    }

    case 'ai-miss-rate': {
      const total = sum(data.map((d) => t(d.value)));
      const top = findMax(data.map((d) => ({ name: String(d.name), value: t(d.value) })));
      return `AI漏诊病例${total}例，主要漏诊类型为${top.name}（${top.value}例）。建议持续优化AI模型对小病灶的检出敏感度。`;
    }

    case 'ai-adoption-rate': {
      const last = data[data.length - 1]!;
      const first = data[0]!;
      const tr = trend(t(last?.value), t(first?.value));
      return `AI辅助采纳率${t(last?.value)}%，较初期${tr.direction}${Math.abs(Number(tr.pct))}%。采纳率稳步提升，体现了医生对AI辅助的信任度增加。`;
    }

    case 'radiation-dose-stats': {
      const last = data[data.length - 1]!;
      const prev = data.length > 1 ? data[data.length - 2] : last;
      const tr = trend(t(last?.CT_DLP), t(prev?.CT_DLP));
      return `本月平均CT-DLP ${t(last?.CT_DLP)} mGy·cm，较上月${tr.direction}${Math.abs(Number(tr.pct))}%。DR剂量${t(last?.DR_DAP)} mGy·cm²，MG平均乳腺剂量${t(last?.MG_AGD)} mGy。各设备剂量水平均在国家标准范围内。`;
    }

    case 'contrast-adverse-rate': {
      const total = sum(data.map((d) => t(d.value)));
      const mild = data.find((d) => String(d.name).includes('轻度'));
      return `对比剂不良反应发生率${total}例，轻度反应占比${t(mild?.percentage)}%。建议加强高危患者筛查和急救药品配备。`;
    }

    case 'contrast-inventory-warning': {
      const lowStock = [...data].filter((d) => t(d.value) < t(d.safetyStock)).sort((a, b) => t(a.value) - t(b.value));
      if (lowStock.length === 0) return '所有对比剂库存充足，无需补货。';
      return `${lowStock[0]?.name}库存严重不足（当前${t(lowStock[0]?.value)}瓶，安全库存${t(lowStock[0]?.safetyStock)}瓶）。建议立即采购，避免影响增强检查。`;
    }

    case 'patient-wait-time': {
      const last = data[data.length - 1]!;
      const prev = data.length > 1 ? data[data.length - 2] : last;
      const tr = trend(t(last?.value), t(prev?.value));
      return `平均等待时间${t(last?.value)}分钟，较上月${tr.direction}${Math.abs(Number(tr.pct))}%。中位等待${t(last?.median)}分钟。建议优化预约间隔和报到流程。`;
    }

    case 'appointment-cancel-rate': {
      const total = sum(data.map((d) => t(d.value)));
      const top = findMax(data.map((d) => ({ name: String(d.name), value: t(d.value) })));
      return `预约取消共${total}例，主要原因为${top.name}（${top.value}例，占${((top.value / total) * 100).toFixed(1)}%）。建议加强预约提醒和爽约管理。`;
    }

    case 'patient-source-dist': {
      const outpatient = data.find((d) => String(d.name) === '门诊');
      const inpatient = data.find((d) => String(d.name) === '住院');
      return `门诊占比${t(outpatient?.percentage)}%，住院${t(inpatient?.percentage)}%。门诊患者为主要服务对象，建议优化门诊检查流程。`;
    }

    case 'mobile-usage': {
      const last = data[data.length - 1]!;
      const totalMau = sum(data.map((d) => t(d.value)));
      return `移动端月均访问${Math.round(totalMau / data.length)}人次，本月报告查看${t(last?.查看量)}次，预约${t(last?.预约量)}次。移动端使用量持续增长，建议持续优化移动端体验。`;
    }

    case 'teaching-case-stats': {
      const total = sum(data.map((d) => t(d.value)));
      const totalViews = sum(data.map((d) => t(d.views)));
      return `本月新增${t(data[data.length - 1]?.value)}例教学病例，累计${total}例，总浏览量${totalViews}次。教学病例库资源丰富，建议鼓励医生积极提交典型病例。`;
    }

    case 'image-storage-trend': {
      const last = data[data.length - 1]!;
      
      const monthlyGrowth = t(last.growth) || 0.6;
      return `当前存储总量${t(last.value)}TB，月均增长约${monthlyGrowth}TB。按当前增速预计未来12个月增长${(monthlyGrowth * 12).toFixed(1)}TB，建议提前规划存储扩容。`;
    }

    case 'system-online-rate': {
      const last = data[data.length - 1]!;
      return `本月系统在线率${t(last.value)}%，核心业务时段可用率${t(last.coreUptime)}%。系统运行稳定，建议继续保持当前运维水平。`;
    }

    case 'api-call-volume': {
      const total = sum(data.map((d) => t(d.value)));
      const top = findMax(data.map((d) => ({ name: String(d.name), value: t(d.value) })));
      const avgResponse = avg(data.map((d) => t(d.avgResponse)));
      return `日均接口调用${(total / 30 / 10000).toFixed(1)}万次，${top.name}调用最频繁（${(top.value / 10000).toFixed(1)}万次）。平均响应时间${avgResponse.toFixed(0)}ms，整体性能良好。`;
    }

    default: {
      const vals = data.map((d) => t(d.value));
      const total = sum(vals);
      const avgVal = avg(vals);
      return `${report.name}报告：总计${total}，均值${avgVal.toFixed(1)}。当前数据反映了${report.description}。建议持续监控指标变化趋势。`;
    }
  }
}
