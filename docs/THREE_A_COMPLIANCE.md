# 三甲评审达标检查报告

> 基于三级医院评审标准（2022版）放射科相关条款

## 1. 已满足的条款（20条）

| 条款编号 | 条款名称 | 当前状态 | 关联报表数 | 关键报表 |
|---------|---------|---------|-----------|---------|
| 2.3.5.1.1 | 提供检查量日/周/月/年报 | ✅ 已满足 | 13 | exam-volume-daily/weekly/monthly/yearly |
| 2.3.5.1.2 | 检查类型及部位分布分析 | ✅ 已满足 | 2 | modality-distribution, body-part-top20 |
| 2.3.5.1.3 | 患者人口学统计 | ✅ 已满足 | 2 | age-distribution, gender-distribution |
| 2.3.5.1.4 | 检查时段分析 | ✅ 已满足 | 2 | peak-hour-analysis, weekday-weekend-compare |
| 2.3.5.1.5 | 医生/科室/协议检查量 | ✅ 已满足 | 3 | exam-volume-by-doctor/dept/protocol |
| 2.3.5.2.1 | 设备使用率统计 | ✅ 已满足 | 1 | device-utilization |
| 2.3.5.2.2 | 设备故障率及停机分析 | ✅ 已满足 | 3 | device-failure-rate, device-downtime-rate, device-uptime-rate |
| 2.3.5.2.3 | 设备保养管理 | ✅ 已满足 | 2 | device-maintenance-due, device-daily-utilization-trend |
| 2.3.5.3.1 | 报告及时率统计 | ✅ 已满足 | 3 | report-timeliness, report-overtime, report-avg-turnaround |
| 2.3.5.3.2 | 报告质控评分 | ✅ 已满足 | 2 | qc-score-distribution, qc-issue-top10 |
| 2.3.5.3.3 | 报告返修率及修改次数 | ✅ 已满足 | 2 | rework-rate, report-modification-count |
| 2.3.5.3.4 | 审核通过率及阳性率 | ✅ 已满足 | 2 | review-pass-rate, positive-rate |
| 2.3.5.3.5 | 报告超时管理 | ✅ 已满足 | 2 | department-overtime-ranking, report-overtime |
| 2.3.5.4.1 | 危急值闭环管理 | ✅ 已满足 | 2 | critical-value-closure, critical-response-time-trend |
| 2.3.5.4.2 | 危急值科室分布及漏报 | ✅ 已满足 | 3 | critical-value-dept-dist, critical-miss-rate, critical-escalation-rate |
| 2.3.5.5.1 | 医生/技师工作量统计 | ✅ 已满足 | 2 | doctor-workload-top10, tech-workload |
| 2.3.5.5.2 | 收入成本及医保分析 | ✅ 已满足 | 4 | revenue-cost-analysis, insurance-type-dist, finance-arrears-rate, finance-insurance-reject |
| 2.3.5.7.1 | AI辅助诊断评估 | ✅ 已满足 | 6 | ai-accuracy-rate, ai-miss-rate, ai-adoption-rate, ai-vs-doctor-kappa, ai-vs-doctor-agreement, ai-false-positive-rate |
| 2.3.5.8.1 | 辐射剂量监测 | ✅ 已满足 | 3 | radiation-dose-stats, radiation-dose-over-limit, radiation-dose-by-modality |
| 2.3.5.10.1 | 患者服务指标 | ✅ 已满足 | 6 | patient-wait-time, appointment-cancel-rate, patient-source-dist, patient-followup-rate, patient-no-show-rate, mobile-usage |

## 2. 待实现的条款（5条）

| 条款编号 | 条款名称 | 当前状态 | 待办事项 | 责任模块 |
|---------|---------|---------|---------|---------|
| 2.3.5.1.6 | 急诊绿色通道检查量统计 | ⚠️ 部分实现 | 需增加急诊专用检查量统计报表，区分急诊与非急诊通道 | 日常统计 |
| 2.3.5.3.6 | 疑难病例讨论记录统计 | ⚠️ 部分实现 | 增加疑难病例讨论完成率、参与人次统计报表 | 报告质量 |
| 2.3.5.5.3 | 科室绩效考核综合看板 | ⚠️ 部分实现 | 整合工作量、质量、效率等多维度指标的绩效看板 | 绩效分析 |
| 2.3.5.9.1 | 对比剂使用规范管理 | ⚠️ 部分实现 | 增加对比剂适应证符合率、知情同意书签署率统计 | 综合质控 |
| 2.3.5.11.1 | 信息安全与灾备演练统计 | ⚠️ 部分实现 | 增加灾备演练记录、数据备份完整性检查报表 | 综合质控 |

## 3. 合规率统计

| 维度 | 数值 |
|------|------|
| 总报表数 | 70 |
| 覆盖三甲条款数 | 11 / 11（100%） |
| 三甲条款子项数 | 25 |
| 已满足子项 | 20（80.0%） |
| 部分实现子项 | 5（20.0%） |
| 未实现子项 | 0（0%） |
| 数据字段对齐率 | 100%（dataKeys 与 mock 返回字段已对齐） |
| Chart 类型正确率 | 100%（70/70 chartType 均在 Chart 组件支持范围内） |

## 4. 后续行动计划

1. **P0** —— 急诊绿色通道报表（exam-volume-emergency）：增加分诊来源维度的检查量统计
2. **P1** —— 疑难病例讨论统计（difficult-case-discussion）：对接科教模块数据
3. **P1** —— 绩效综合看板（performance-dashboard）：整合 workload + quality + revenue
4. **P2** —— 对比剂规范报表：增加适应证、知情同意书统计
5. **P2** —— 灾备演练报表：对接运维平台数据
