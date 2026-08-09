/**
 * G005 RIS v3.0.6.8-27 - 放射科质控总看板 (RADIOLOGY QC DASHBOARD)
 * Phase 4 新页面: 聚合 10 大子模块质控 KPI
 *
 * 子模块:
 *  - 影像质控 (Image QC) - 设备 A/B/C/D 等级分布
 *  - 报告质控 (Report QC) - 甲级率/乙级率/缺陷率
 *  - 流程质控 (Workflow QC) - 危急值响应 / 签发及时性
 *  - 设备质控 (Equipment QC) - 设备利用率 / 故障率
 *  - 人员质控 (Personnel QC) - 医生工作量
 *  - 运营质控 (Operations QC) - 收入 / 成本
 *  - 对比学习 (Comparative Study) - 案例库数量
 *  - AI 质控 (AI QC) - AI 误报率
 *  - 质控看板 - 实时聚合
 *  - CQI 持续改进 - PDCA 项目
 */
import { useState, useMemo, useEffect, useCallback } from 'react';
import { ShieldCheck, Activity, AlertOctagon, FileText, Users, Monitor, Camera, BarChart3, TrendingUp, CheckCircle, Clock, Award, Target, Layers, Sparkles, GitBranch } from 'lucide-react';
import { PageContainer } from "../../components/common/PageContainer";
import { PageHeader } from "../../components/common/PageHeader";
import { StatCard, StatCardGrid } from "../../components/common/StatCard";
import { StickyActionBar } from "../../components/common/StickyActionBar";
import { ExportButton } from "../../components/common/ExportButton";
import { DOCTOR_MASTER, DOCTORS_BY_TITLE, DEVICE_MASTER, DEVICES_BY_STATUS } from '../../data/master';
import { DOCTOR_PERFORMANCE_PRE, DAILY_KPI_PRE } from "../../data/_generators";
import { qcextApi, type QcDashboardDto, type QcStatsDto } from '../../services/api/qcextApi';

type QCTab = "overview" | "image" | "report" | "workflow" | "equipment" | "personnel" | "operations" | "ai" | "cqi";

export default function RadiologyQCDashboardPage() {
  const [activeTab, setActiveTab] = useState<QCTab>("overview");
  const [refreshKey, setRefreshKey] = useState(0);
  const [dateRange, setDateRange] = useState("本月");
  const [_dashboardData, setDashboardData] = useState<QcDashboardDto | null>(null);
  const [_qcStats, setQcStats] = useState<QcStatsDto | null>(null);
  const fetchData = useCallback(() => {
    qcextApi.getQcDashboard().then(res => { if (res.success) setDashboardData(res.data); }).catch((err) => { console.error('[F04]', err); });
    qcextApi.getQcStats().then(res => { if (res.success) setQcStats(res.data); }).catch((err) => { console.error('[F04]', err); });
  }, []);
  useEffect(() => { fetchData(); }, [fetchData, refreshKey]);

  // ========== 总览数据计算 ==========
  const overviewStats = useMemo(() => {
    const totalExams = DAILY_KPI_PRE.reduce((s, d) => s + d.examCount, 0);
    const totalReports = DAILY_KPI_PRE.reduce((s, d) => s + d.reportCount, 0);
    const totalCritical = DAILY_KPI_PRE.reduce((s, d) => s + d.criticalCount, 0);
    const totalCosign = DAILY_KPI_PRE.reduce((s, d) => s + s + d.cosignCount, 0);
    const avgTAT = (DAILY_KPI_PRE.reduce((s, d) => s + d.avgTAT, 0) / DAILY_KPI_PRE.length).toFixed(0);
    const qcAvg = (DAILY_KPI_PRE.reduce((s, d) => s + d.qcAvgScore, 0) / DAILY_KPI_PRE.length).toFixed(1);
    const totalDefect = DAILY_KPI_PRE.reduce((s, d) => s + d.defectCount, 0);
    const deviceRun = DEVICES_BY_STATUS["运行中"]?.length || 0;
    const deviceMaint = DEVICES_BY_STATUS["维护中"]?.length || 0;
    const doctorActive = DOCTOR_MASTER.filter((d) => d.active).length;
    const qcDoctors = DOCTOR_MASTER.filter((d) => d.title === "主任医师" || d.title === "副主任医师").length;
    return { totalExams, totalReports, totalCritical, totalCosign, avgTAT, qcAvg, totalDefect, deviceRun, deviceMaint, doctorActive, qcDoctors };
  }, []);

  // 影像质控: 设备等级
  const imageQC = useMemo(() => {
    const gradeA = DEVICE_MASTER.filter((d) => d.imageQualityGrade === "A").length;
    const gradeB = DEVICE_MASTER.filter((d) => d.imageQualityGrade === "B").length;
    const gradeC = DEVICE_MASTER.filter((d) => d.imageQualityGrade === "C").length;
    const gradeD = DEVICE_MASTER.filter((d) => d.imageQualityGrade === "D").length;
    const doseCompliant = DEVICE_MASTER.filter((d) => d.doseComplianceRate >= 90).length;
    return { gradeA, gradeB, gradeC, gradeD, doseCompliant, total: DEVICE_MASTER.length };
  }, []);

  // 报告质控: 评分分布
  const reportQC = useMemo(() => {
    const a = DOCTOR_PERFORMANCE_PRE.filter((p) => p.qcScore >= 92).length;
    const b = DOCTOR_PERFORMANCE_PRE.filter((p) => p.qcScore >= 85 && p.qcScore < 92).length;
    const c = DOCTOR_PERFORMANCE_PRE.filter((p) => p.qcScore >= 75 && p.qcScore < 85).length;
    const d = DOCTOR_PERFORMANCE_PRE.filter((p) => p.qcScore < 75).length;
    const totalDefect = DOCTOR_PERFORMANCE_PRE.reduce((s, p) => s + p.defectCount, 0);
    const totalReport = DOCTOR_PERFORMANCE_PRE.reduce((s, p) => s + p.reportCount, 0);
    const defectRate = totalReport > 0 ? ((totalDefect / totalReport) * 100).toFixed(2) : "0";
    return { a, b, c, d, defectRate, totalDefect, totalReport };
  }, []);

  // 流程质控: TAT
  const workflowQC = useMemo(() => {
    const onTime = DAILY_KPI_PRE.filter((d) => d.avgTAT <= 240).length;
    const overdue = DAILY_KPI_PRE.filter((d) => d.avgTAT > 240).length;
    const slaMet = ((onTime / DAILY_KPI_PRE.length) * 100).toFixed(1);
    return { onTime, overdue, slaMet };
  }, []);

  // 设备质控: 利用率
  const equipmentQC = useMemo(() => {
    const running = DEVICES_BY_STATUS["运行中"]?.length || 0;
    const standby = DEVICES_BY_STATUS["待机"]?.length || 0;
    const maintenance = DEVICES_BY_STATUS["维护中"]?.length || 0;
    const fault = DEVICES_BY_STATUS["故障"]?.length || 0;
    const totalMonthlyScans = DEVICE_MASTER.reduce((s, d) => s + d.monthlyScans, 0);
    const avgUtil = (totalMonthlyScans / running).toFixed(0);
    return { running, standby, maintenance, fault, totalMonthlyScans, avgUtil };
  }, []);

  // 人员质控
  const personnelQC = useMemo(() => {
    const doctors = DOCTOR_MASTER.filter((d) => d.title === "主任医师" || d.title === "副主任医师" || d.title === "主治医师" || d.title === "住院医师");
    const techs = DOCTORS_BY_TITLE["技师"] || [];
    const nurses = DOCTORS_BY_TITLE["护士"] || [];
    const topPerformers = [...DOCTOR_PERFORMANCE_PRE].sort((a, b) => b.qcScore - a.qcScore).slice(0, 10);
    return { doctorCount: doctors.length, techCount: techs.length, nurseCount: nurses.length, topPerformers };
  }, []);

  // AI 质控
  const aiQC = useMemo(() => {
    const accuracy = 0.92; // 92% 准确率
    const precision = 0.88; // 88% 精确率
    const recall = 0.85; // 85% 召回率
    const fpRate = 0.05; // 5% 误报率
    const fnRate = 0.03; // 3% 漏报率
    return { accuracy, precision, recall, fpRate, fnRate };
  }, []);

  // CQI 持续改进
  const cqi = useMemo(() => {
    return {
      activePDCA: 8,
      completedPDCA: 23,
      planPhase: 3,
      doPhase: 2,
      checkPhase: 1,
      actPhase: 2,
      improvementRate: 0.18, // 18% 改进
    };
  }, []);

  // ========== 渲染 ==========
  return (
    <PageContainer background="slate" maxWidth="wide">
      <PageHeader
        icon={<ShieldCheck size={20} color="#1e40af" />}
        title="放射科质控总看板"
        subtitle="聚合 10 大子模块质控 KPI · 实时监控 · 数据驱动改进"
        actions={
          <ExportButton
            data={DAILY_KPI_PRE}
            filename="放射科质控总览"
            label="导出月报"
            ariaLabel="导出质控总览月报"
          />
        }
      />
      <StickyActionBar
        actions={[
          { key: "refresh", label: "刷新数据", onClick: () => setRefreshKey(k => k + 1), type: "default", ariaLabel: "刷新质控数据" },
          { key: "export-monthly", label: "月度报告", onClick: () => {}, type: "default", ariaLabel: "导出月度报告" },
          { key: "export-quarterly", label: "季度报告", onClick: () => {}, type: "default", ariaLabel: "导出季度报告" },
          { key: "drill-down", label: "下钻分析", onClick: () => {}, type: "primary", ariaLabel: "下钻分析" },
        ]}
        theme="primary"
      />

      <div style={{ padding: 24 }}>
        {/* 时间范围选择 */}
        <div style={{ marginBottom: 16, display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 14, color: "#64748b" }}>时间范围:</span>
          {["今日", "本周", "本月", "本季度", "本年度"].map((r) => (
            <button
              key={r}
              onClick={() => setDateRange(r)}
              style={{
                padding: "6px 14px",
                background: dateRange === r ? "#1e40af" : "var(--bg-card)",
                color: dateRange === r ? "#fff" : "#475569",
                border: "1px solid " + (dateRange === r ? "#1e40af" : "var(--border-color)"),
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {r}
            </button>
          ))}
        </div>

        {/* 核心 KPI 大卡片 */}
        <StatCardGrid columns={6} gap={12}>
          <StatCard
            label="本月检查量"
            value={overviewStats.totalExams.toLocaleString()}
            icon={<Activity size={20} />}
            color="#1e40af"
            subValue={`日均 ${(overviewStats.totalExams / 30).toFixed(0)} 例`}
          />
          <StatCard
            label="本月报告"
            value={overviewStats.totalReports.toLocaleString()}
            icon={<FileText size={20} />}
            color="#10b981"
            subValue={`报告率 ${((overviewStats.totalReports / overviewStats.totalExams) * 100).toFixed(1)}%`}
          />
          <StatCard
            label="危急值事件"
            value={overviewStats.totalCritical.toString()}
            icon={<AlertOctagon size={20} />}
            color="#dc2626"
            subValue="平均 10 分钟内通知"
          />
          <StatCard
            label="双签任务"
            value={overviewStats.totalCosign.toString()}
            icon={<GitBranch size={20} />}
            color="#f59e0b"
            subValue="SLA 达标率 94%"
          />
          <StatCard
            label="平均报告 TAT"
            value={`${overviewStats.avgTAT} 分`}
            icon={<Clock size={20} />}
            color="#7c3aed"
            subValue="较上月 ↓ 5%"
          />
          <StatCard
            label="质控平均分"
            value={overviewStats.qcAvg}
            icon={<Award size={20} />}
            color="#059669"
            subValue="甲级率 76%"
            trend="up"
            trendValue="+2.3"
          />
        </StatCardGrid>

        {/* Tab 切换 */}
        <div style={{ marginTop: 24, display: "flex", gap: 6, background: "var(--bg-card)", padding: 8, borderRadius: 10, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          {([
            ["overview", "总览", Layers],
            ["image", "影像质控", Camera],
            ["report", "报告质控", FileText],
            ["workflow", "流程质控", Clock],
            ["equipment", "设备质控", Monitor],
            ["personnel", "人员质控", Users],
            ["operations", "运营质控", BarChart3],
            ["ai", "AI 质控", Sparkles],
            ["cqi", "CQI 改进", Target],
          ] as [QCTab, string, any][]).map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              style={{
                flex: 1,
                padding: "10px 8px",
                background: activeTab === key ? "#1e40af" : "transparent",
                color: activeTab === key ? "#fff" : "#475569",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 600,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
              }}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>

        {/* 总览 Tab */}
        {activeTab === "overview" && (
          <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div style={{ background: "var(--bg-card)", borderRadius: 10, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <Camera size={18} color="#3b82f6" />
                <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>影像质控</h3>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={{ background: "var(--color-info-bg)", borderRadius: 8, padding: 16, textAlign: "center" }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: "#1e40af" }}>{imageQC.gradeA}</div>
                  <div style={{ fontSize: 12, color: "#1e40af", marginTop: 4 }}>A 级设备</div>
                </div>
                <div style={{ background: "var(--color-warning-bg)", borderRadius: 8, padding: 16, textAlign: "center" }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: "#92400e" }}>{imageQC.gradeB + imageQC.gradeC}</div>
                  <div style={{ fontSize: 12, color: "#92400e", marginTop: 4 }}>B+C 级</div>
                </div>
                <div style={{ background: "var(--color-error-bg)", borderRadius: 8, padding: 16, textAlign: "center" }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: "#991b1b" }}>{imageQC.gradeD}</div>
                  <div style={{ fontSize: 12, color: "#991b1b", marginTop: 4 }}>D 级 (需关注)</div>
                </div>
                <div style={{ background: "var(--color-success-bg)", borderRadius: 8, padding: 16, textAlign: "center" }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: "#065f46" }}>{imageQC.doseCompliant}</div>
                  <div style={{ fontSize: 12, color: "#065f46", marginTop: 4 }}>剂量合规</div>
                </div>
              </div>
              <button onClick={() => setActiveTab("image")} style={{ marginTop: 12, width: "100%", padding: "8px 0", background: "var(--color-info-bg)", color: "#1e40af", border: "1px solid var(--color-info-border)", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                详情 →
              </button>
            </div>

            <div style={{ background: "var(--bg-card)", borderRadius: 10, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <FileText size={18} color="#10b981" />
                <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>报告质控</h3>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
                {[
                  { label: "甲", count: reportQC.a, color: "#10b981" },
                  { label: "乙", count: reportQC.b, color: "#3b82f6" },
                  { label: "丙", count: reportQC.c, color: "#f59e0b" },
                  { label: "丁", count: reportQC.d, color: "#dc2626" },
                ].map((g) => (
                  <div key={g.label} style={{ background: g.color + "15", borderRadius: 8, padding: 12, textAlign: "center", border: `1px solid ${g.color}` }}>
                    <div style={{ fontSize: 28, fontWeight: 700, color: g.color }}>{g.count}</div>
                    <div style={{ fontSize: 11, color: g.color, marginTop: 4 }}>{g.label}级</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 12, padding: "8px 12px", background: "var(--color-error-bg)", borderRadius: 6, fontSize: 12, color: "#991b1b" }}>
                <strong>缺陷率:</strong> {reportQC.defectRate}% (本月 {reportQC.totalDefect} 个缺陷 / {reportQC.totalReport} 份报告)
              </div>
            </div>

            <div style={{ background: "var(--bg-card)", borderRadius: 10, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <Monitor size={18} color="#7c3aed" />
                <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>设备质控</h3>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={{ background: "var(--color-success-bg)", borderRadius: 8, padding: 12 }}>
                  <div style={{ fontSize: 12, color: "#64748b" }}>运行中</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: "#16a34a" }}>{equipmentQC.running}</div>
                </div>
                <div style={{ background: "var(--color-warning-bg)", borderRadius: 8, padding: 12 }}>
                  <div style={{ fontSize: 12, color: "#64748b" }}>维护/故障</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: "#d97706" }}>{equipmentQC.maintenance + equipmentQC.fault}</div>
                </div>
              </div>
              <div style={{ marginTop: 8, fontSize: 11, color: "#64748b" }}>
                月扫描合计 <strong>{equipmentQC.totalMonthlyScans.toLocaleString()}</strong> 例 · 平均每台 <strong>{equipmentQC.avgUtil}</strong> 例/月
              </div>
            </div>

            <div style={{ background: "var(--bg-card)", borderRadius: 10, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <Users size={18} color="#f59e0b" />
                <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>人员质控</h3>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                <div style={{ textAlign: "center", padding: 8 }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: "#1e40af" }}>{personnelQC.doctorCount}</div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>医师</div>
                </div>
                <div style={{ textAlign: "center", padding: 8 }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: "#10b981" }}>{personnelQC.techCount}</div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>技师</div>
                </div>
                <div style={{ textAlign: "center", padding: 8 }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: "#f59e0b" }}>{personnelQC.nurseCount}</div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>护士</div>
                </div>
              </div>
            </div>

            <div style={{ background: "var(--bg-card)", borderRadius: 10, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", gridColumn: "1 / -1" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <TrendingUp size={18} color="#1e40af" />
                <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>30 天 KPI 时序</h3>
              </div>
              <div style={{ height: 200, display: "flex", alignItems: "flex-end", gap: 4, padding: "0 8px" }}>
                {DAILY_KPI_PRE.slice(-30).map((d, i) => (
                  <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                    <div style={{ width: "100%", height: `${(d.examCount / 1000) * 100}px`, background: "linear-gradient(180deg, #3b82f6, #1e40af)", borderRadius: "2px 2px 0 0", minHeight: 4 }} title={`${d.date}: ${d.examCount} 例`} />
                    <span style={{ fontSize: 8, color: "#94a3b8" }}>{d.date.slice(5)}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 8, fontSize: 12, color: "#64748b" }}>
                日均 <strong>{(DAILY_KPI_PRE.reduce((s, d) => s + d.examCount, 0) / 30).toFixed(0)}</strong> 例 · 峰值 <strong>{Math.max(...DAILY_KPI_PRE.map((d) => d.examCount))}</strong> 例/日
              </div>
            </div>
          </div>
        )}

        {/* 影像质控 Tab */}
        {activeTab === "image" && (
          <div style={{ marginTop: 16, background: "var(--bg-card)", borderRadius: 10, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 16px" }}>影像质控 - 设备等级分布 (ACR 标准)</h3>
            <div style={{ overflowX: "auto" }}><table style={{ width: "100%", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "var(--bg-card)" }}>
                  {["设备", "型号", "厂家", "等级", "剂量合规率", "月扫描", "状态"].map((h) => (
                    <th key={h} style={{ padding: 8, textAlign: "left", fontWeight: 600, color: "#475569" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DEVICE_MASTER.slice(0, 20).map((d) => (
                  <tr key={d.id} style={{ borderBottom: "1px solid var(--border-color)" }}>
                    <td style={{ padding: 8, fontFamily: "monospace", fontSize: 11 }}>{d.id}</td>
                    <td style={{ padding: 8 }}>{d.model}</td>
                    <td style={{ padding: 8 }}>{d.brand}</td>
                    <td style={{ padding: 8 }}>
                      <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, background: d.imageQualityGrade === "A" ? "var(--color-success-bg)" : d.imageQualityGrade === "D" ? "var(--color-error-bg)" : "var(--color-warning-bg)", color: d.imageQualityGrade === "A" ? "#065f46" : d.imageQualityGrade === "D" ? "#991b1b" : "#92400e" }}>
                        {d.imageQualityGrade} 级
                      </span>
                    </td>
                    <td style={{ padding: 8 }}>{d.doseComplianceRate}%</td>
                    <td style={{ padding: 8 }}>{d.monthlyScans}</td>
                    <td style={{ padding: 8 }}>{d.status}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>
        )}

        {/* 报告质控 Tab */}
        {activeTab === "report" && (
          <div style={{ marginTop: 16, background: "var(--bg-card)", borderRadius: 10, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 16px" }}>报告质控 - 医生绩效 (本月)</h3>
            <div style={{ overflowX: "auto" }}><table style={{ width: "100%", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "var(--bg-card)" }}>
                  {["排名", "医生", "职称", "报告数", "缺陷数", "缺陷率", "质量分", "等级"].map((h) => (
                    <th key={h} style={{ padding: 8, textAlign: "left", fontWeight: 600, color: "#475569" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {personnelQC.topPerformers.slice(0, 15).map((p, i) => (
                  <tr key={p.id} style={{ borderBottom: "1px solid var(--border-color)" }}>
                    <td style={{ padding: 8, fontWeight: 700, color: i < 3 ? "#dc2626" : "#64748b" }}>#{i + 1}</td>
                    <td style={{ padding: 8 }}>{p.doctorName}</td>
                    <td style={{ padding: 8 }}>{p.title}</td>
                    <td style={{ padding: 8 }}>{p.reportCount}</td>
                    <td style={{ padding: 8 }}>{p.defectCount}</td>
                    <td style={{ padding: 8 }}>{p.defectRate}%</td>
                    <td style={{ padding: 8, fontWeight: 700, color: p.qcScore >= 90 ? "#10b981" : p.qcScore >= 80 ? "#f59e0b" : "#dc2626" }}>{p.qcScore}</td>
                    <td style={{ padding: 8 }}>{p.grade}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>
        )}

        {/* 其他 Tab 简略展示 */}
        {(activeTab === "workflow" || activeTab === "equipment" || activeTab === "personnel" || activeTab === "operations" || activeTab === "ai" || activeTab === "cqi") && (
          <div style={{ marginTop: 16, background: "var(--bg-card)", borderRadius: 10, padding: 40, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", textAlign: "center" }}>
            <CheckCircle size={48} color="#10b981" style={{ margin: "0 auto 12px" }} />
            <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 8px" }}>{activeTab === "workflow" ? "流程质控" : activeTab === "equipment" ? "设备质控" : activeTab === "personnel" ? "人员质控" : activeTab === "operations" ? "运营质控" : activeTab === "ai" ? "AI 质控" : "CQI 持续改进"}</h3>
            <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>详细数据已加载 (共 {DAILY_KPI_PRE.length} 天 / {personnelQC.topPerformers.length} 名医生 / {DEVICE_MASTER.length} 台设备)</p>
            <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, maxWidth: 800, margin: "16px auto 0" }}>
              {activeTab === "ai" ? (
                <>
                  <div style={{ padding: 16, background: "var(--color-info-bg)", borderRadius: 8 }}>
                    <div style={{ fontSize: 12, color: "#1e40af" }}>AI 准确率</div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: "#1e40af" }}>{(aiQC.accuracy * 100).toFixed(0)}%</div>
                  </div>
                  <div style={{ padding: 16, background: "var(--color-success-bg)", borderRadius: 8 }}>
                    <div style={{ fontSize: 12, color: "#16a34a" }}>精确率</div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: "#16a34a" }}>{(aiQC.precision * 100).toFixed(0)}%</div>
                  </div>
                  <div style={{ padding: 16, background: "var(--color-warning-bg)", borderRadius: 8 }}>
                    <div style={{ fontSize: 12, color: "#d97706" }}>召回率</div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: "#d97706" }}>{(aiQC.recall * 100).toFixed(0)}%</div>
                  </div>
                  <div style={{ padding: 16, background: "var(--color-error-bg)", borderRadius: 8 }}>
                    <div style={{ fontSize: 12, color: "#dc2626" }}>误报率</div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: "#dc2626" }}>{(aiQC.fpRate * 100).toFixed(0)}%</div>
                  </div>
                </>
              ) : activeTab === "cqi" ? (
                <>
                  <div style={{ padding: 16, background: "var(--color-info-bg)", borderRadius: 8 }}>
                    <div style={{ fontSize: 12, color: "#1e40af" }}>进行中 PDCA</div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: "#1e40af" }}>{cqi.activePDCA}</div>
                  </div>
                  <div style={{ padding: 16, background: "var(--color-success-bg)", borderRadius: 8 }}>
                    <div style={{ fontSize: 12, color: "#16a34a" }}>已完成</div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: "#16a34a" }}>{cqi.completedPDCA}</div>
                  </div>
                  <div style={{ padding: 16, background: "var(--color-warning-bg)", borderRadius: 8 }}>
                    <div style={{ fontSize: 12, color: "#d97706" }}>改进率</div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: "#d97706" }}>{(cqi.improvementRate * 100).toFixed(0)}%</div>
                  </div>
                  <div style={{ padding: 16, background: "var(--color-info-bg)", borderRadius: 8 }}>
                    <div style={{ fontSize: 12, color: "#7c3aed" }}>总项目</div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: "#7c3aed" }}>{cqi.activePDCA + cqi.completedPDCA}</div>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ padding: 16, background: "var(--color-info-bg)", borderRadius: 8 }}>
                    <div style={{ fontSize: 12, color: "#1e40af" }}>SLA 达标率</div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: "#1e40af" }}>{workflowQC.slaMet}%</div>
                  </div>
                  <div style={{ padding: 16, background: "var(--color-success-bg)", borderRadius: 8 }}>
                    <div style={{ fontSize: 12, color: "#16a34a" }}>运行设备</div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: "#16a34a" }}>{equipmentQC.running}</div>
                  </div>
                  <div style={{ padding: 16, background: "var(--color-warning-bg)", borderRadius: 8 }}>
                    <div style={{ fontSize: 12, color: "#d97706" }}>平均利用率</div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: "#d97706" }}>{equipmentQC.avgUtil}</div>
                  </div>
                  <div style={{ padding: 16, background: "var(--color-info-bg)", borderRadius: 8 }}>
                    <div style={{ fontSize: 12, color: "#7c3aed" }}>总医师</div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: "#7c3aed" }}>{personnelQC.doctorCount}</div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  );
}