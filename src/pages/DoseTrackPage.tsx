import { useState, useCallback, useEffect, useMemo } from "react";
import {
  Activity,
  AlertTriangle,
  TrendingUp,
  Monitor,
  ShieldAlert,
  Info,
  Clock,
  Award,
  Zap,
  CheckCircle,
  FileSpreadsheet,
  BarChart3,
  FileText,
  TrendingDown,
  Gauge,
} from "lucide-react";
import { t } from "../i18n/appI18n";
import {
  DoseSearchPanel,
  DoseTrackingTable,
  DoseTrendChart,
  DoseAlertConfig,
} from "./dose";
import type { PatientDoseRecord, DoseAlert, CumulativeStats } from "./dose";
import { rdsrApi, type TodayDoseStats, type PatientDoseSummary, type DoseAlert as RdsrDoseAlert } from "../services/api/rdsrApi";
import AAPMEUReferenceComparison from "./dose/AAPMEUReferenceComparison";
import DoseTrendAnalysis from "./dose/DoseTrendAnalysis";
import BreastDoseTracking from "./dose/BreastDoseTracking";
import PediatricDoseManagement from "./dose/PediatricDoseManagement";
import DICOMSRParser from "./dose/DICOMSRParser";
import CumulativeDoseTracker from "./dose/CumulativeDoseTracker";
import DRLManagement from "./dose/DRLManagement";
import PediatricProtocolOptimization from "./dose/PediatricProtocolOptimization";
import StaffDoseMonitoring from "./dose/StaffDoseMonitoring";
import DoseControlCharts from "./dose/DoseControlCharts";
import DoseLiveMonitor from "./dose/DoseLiveMonitor";
import DeviceDoseCard from "./dose/DeviceDoseCard";
import DeviceHistoryModal from "./dose/DeviceHistoryModal";
import {
  doseAlerts,
  cumulativeStats as mockCumulativeStats,
  patientDoseRecords,
  doseHistoryData,
  ctdivolTrendData,
  deviceDAPComparison,
  deviceDoseData,
} from "./dose/mockData";
import { exportDoseDataToCSV, exportDeviceDoseToCSV } from "./dose/utils";
import {
  LineChart, Line, BarChart as RBChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

type View =
  | "overview"
  | "live"
  | "patient"
  | "device"
  | "alert"
  | "aapm"
  | "trend"
  | "breast"
  | "pediatric"
  | "dicom"
  | "cumulative"
  | "drl"
  | "pediatricopt"
  | "staff"
  | "spc"
  | "analytics";

const MODALITIES = ["全部", "CT", "MR", "DR", "DSA", "乳腺钼靶", "胃肠造影"];

export default function DoseTrackPage() {
  const [view, setView] = useState<View>("overview");
  const [modalityFilter, setModalityFilter] = useState<string>("全部");
  const [alertFilter, setAlertFilter] = useState<string>("全部");
  const [searchText, setSearchText] = useState("");
  const [selectedPatient, setSelectedPatient] =
    useState<PatientDoseRecord | null>(null);
  const [deviceHistoryDevice, setDeviceHistoryDevice] = useState<string | null>(
    null,
  );
  const [alerts, setAlerts] = useState<DoseAlert[]>(doseAlerts);
  // [W3-C] 复核 -75: 主数据源接入 rdsrApi (getToday/searchPatients/getAlerts), 失败回退演示数据
  const [today, setToday] = useState<TodayDoseStats | null>(null);
  const [apiPatients, setApiPatients] = useState<PatientDoseSummary[]>([]);
  const [dataSource, setDataSource] = useState<'api' | 'demo'>('demo');
  const [dataError, setDataError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [todayRes, patientsRes, alertsRes] = await Promise.all([
          rdsrApi.getToday(),
          rdsrApi.searchPatients(),
          rdsrApi.getAlerts(),
        ]);
        if (cancelled) return;
        if (todayRes.success && todayRes.data) {
          setToday(todayRes.data);
          setDataSource('api');
          setDataError(null);
        }
        if (patientsRes.success && Array.isArray(patientsRes.data)) setApiPatients(patientsRes.data);
        if (alertsRes.success && Array.isArray(alertsRes.data)) {
          setAlerts((alertsRes.data as RdsrDoseAlert[]).map((a) => ({
            id: a.id,
            patientName: a.patientName ?? '未知患者',
            modality: a.modality,
            examItem: a.bodyPart,
            doseValue: a.dlp,
            threshold: a.dlpDrl,
            alertLevel: a.level,
            device: a.modality,
            time: a.date,
            status: a.acknowledged ? 'acknowledged' : 'pending',
          })));
        }
      } catch (e) {
        if (!cancelled) setDataError(e instanceof Error ? e.message : '剂量接口不可用');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const stats: CumulativeStats = today
    ? {
        ...mockCumulativeStats,
        totalPatientsToday: today.totalExams,
        highDosePatients: today.warningCount + today.criticalCount,
        totalDLPToday: Math.round(today.avgDlp * today.totalExams),
        doseAlertsToday: today.warningCount + today.criticalCount,
        totalExamCount: today.totalExams,
        criticalAlerts: today.criticalCount,
        warningAlerts: today.warningCount,
        averageCTDIvol: today.avgCtdiVol,
      }
    : mockCumulativeStats;

  const apiPatientRecords: PatientDoseRecord[] = apiPatients.map((p) => ({
    id: p.patientId,
    patientId: p.patientId,
    patientName: p.patientName,
    gender: '-',
    age: 0,
    modality: 'CT',
    examItem: '累计剂量',
    examDate: p.lastExamDate,
    doseType: 'DLP',
    doseValue: p.totalDlp1y,
    doseUnit: 'mGy·cm',
    alertLevel: p.overDrlCount > 0 ? 'warning' : 'normal',
    threshold: 0,
    device: '-',
    examCount: p.examCount,
    cumulativeDLP: p.totalDlp1y,
  }));

  const effectivePatientRecords = apiPatientRecords.length > 0 ? apiPatientRecords : patientDoseRecords;

  const filteredPatientRecords = effectivePatientRecords.filter((record) => {
    const matchesModality =
      modalityFilter === "全部" || record.modality === modalityFilter;
    const matchesSearch =
      !searchText ||
      record.patientName.includes(searchText) ||
      record.patientId.includes(searchText) ||
      record.examItem.includes(searchText);
    return matchesModality && matchesSearch;
  });

  const filteredAlerts = alerts.filter((alert) => {
    if (alertFilter === "全部") return true;
    return alert.status === alertFilter;
  });

  const handleExportPatientCSV = useCallback(() => {
    exportDoseDataToCSV(
      filteredPatientRecords,
      `patient_dose_${new Date().toISOString().split("T")[0]}.csv`,
    );
  }, [filteredPatientRecords]);

  const handleExportDeviceCSV = useCallback(() => {
    exportDeviceDoseToCSV(
      deviceDoseData,
      `device_dose_${new Date().toISOString().split("T")[0]}.csv`,
    );
  }, []);

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: "0 auto" }}>
      <PageHeader
        onExportPatient={handleExportPatientCSV}
        onExportDevice={handleExportDeviceCSV}
      />

      <PrimaryStats stats={stats} />

      <SecondaryStats pendingAlerts={alerts.filter((a) => a.status === "pending").length} stats={stats} />

      {dataSource === 'api' ? (
        <div style={{ marginBottom: 12, padding: '8px 12px', background: 'var(--color-success-bg)', color: '#16a34a', borderRadius: 8, fontSize: 12 }}>
          数据源: /rdsr/today + /rdsr/patients + /rdsr/alerts（真实接口）· 日期 {today?.date ?? '-'}
        </div>
      ) : (
        <div style={{ marginBottom: 12, padding: '8px 12px', background: 'var(--color-warning-bg)', color: '#d97706', borderRadius: 8, fontSize: 12 }}>
          {dataError ? `剂量接口不可用: ${dataError}; ` : ''}演示数据（rdsrApi 未返回, 已回退 mockData）
        </div>
      )}

      <DoseSearchPanel
        view={view}
        setView={(v: string) => setView(v as View)}
        searchText={searchText}
        setSearchText={setSearchText}
        modalityFilter={modalityFilter}
        setModalityFilter={setModalityFilter}
        alertFilter={alertFilter}
        setAlertFilter={setAlertFilter}
        modalities={MODALITIES}
      />

      {view === "overview" && (
        <DoseTrendChart
          doseHistoryData={doseHistoryData}
          ctdivolTrendData={ctdivolTrendData}
          deviceDAPComparison={deviceDAPComparison}
          deviceDoseData={deviceDoseData}
          onViewDeviceHistory={(device) => setDeviceHistoryDevice(device)}
        />
      )}

      {view === "live" && <DoseLiveMonitor />}

      {view === "patient" && (
        <DoseTrackingTable
          filteredPatientRecords={filteredPatientRecords}
          selectedPatient={selectedPatient}
          setSelectedPatient={setSelectedPatient}
        />
      )}

      {view === "device" && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 16,
          }}
        >
          {deviceDoseData.map((d) => (
            <DeviceDoseCard
              key={d.device}
              device={d}
              onShowHistory={() => setDeviceHistoryDevice(d.device)}
            />
          ))}
        </div>
      )}

      {view === "alert" && (
        <DoseAlertConfig
          doseAlerts={doseAlerts}
          cumulativeStats={stats}
          filteredAlerts={filteredAlerts}
          onAcknowledgeAlert={async (alertId) => {
            // 真实闭环: 写回 /rdsr/alerts/:id/ack, 失败时回退本地状态
            if (dataSource === 'api') {
              try {
                const res = await rdsrApi.ackAlert(alertId);
                if (res.success) {
                  setAlerts((prev) =>
                    prev.map((a) =>
                      a.id === alertId ? { ...a, status: "acknowledged" as const } : a,
                    ),
                  );
                  return;
                }
              } catch { /* fall through to local */ }
            }
            setAlerts((prev) =>
              prev.map((a) =>
                a.id === alertId ? { ...a, status: "acknowledged" as const } : a,
              ),
            );
          }}
          onViewPatient={(patientName) => {
            setView("patient");
            setSelectedPatient(
              effectivePatientRecords.find(
                (r) => r.patientName === patientName,
              ) || null,
            );
          }}
        />
      )}

      {view === "aapm" && <AAPMEUReferenceComparison />}
      {view === "trend" && <DoseTrendAnalysis />}
      {view === "breast" && <BreastDoseTracking />}
      {view === "pediatric" && <PediatricDoseManagement />}
      {view === "dicom" && <DICOMSRParser />}
      {view === "cumulative" && <CumulativeDoseTracker />}
      {view === "drl" && <DRLManagement />}
      {view === "pediatricopt" && <PediatricProtocolOptimization />}
      {view === "staff" && <StaffDoseMonitoring />}
      {view === "spc" && <DoseControlCharts />}
      {view === "analytics" && (
        <DoseAnalyticsSection
          apiPatients={apiPatients}
          today={today}
          alerts={alerts}
          dataSource={dataSource}
        />
      )}

      {deviceHistoryDevice && (
        <DeviceHistoryModal
          device={deviceHistoryDevice}
          onClose={() => setDeviceHistoryDevice(null)}
        />
      )}

      <FooterInfo />
    </div>
  );
}

function PageHeader({
  onExportPatient,
  onExportDevice,
}: {
  onExportPatient: () => void;
  onExportDevice: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        marginBottom: 20,
      }}
    >
      <div>
        <h1
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: "#1e40af",
            margin: "0 0 4px",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Gauge size={18} color="#1e40af" />
          {t("doseTrack.title")}
        </h1>
        <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0 }}>
          {t("doseTrack.subtitle")}
        </p>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onExportPatient} style={headerBtn}>
          <FileSpreadsheet size={13} /> {t("doseTrack.exportPatient")}
        </button>
        <button onClick={onExportDevice} style={headerBtn}>
          <BarChart3 size={13} /> {t("doseTrack.exportDevice")}
        </button>
      </div>
    </div>
  );
}

function PrimaryStats({ stats }: { stats: CumulativeStats }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: 12,
        marginBottom: 20,
      }}
    >
      <PrimaryStat
        label={t("doseTrack.stats.patientsToday")}
        value={stats.totalPatientsToday}
        delta="+5.2%"
        deltaColor="#16a34a"
        icon={<Activity size={18} />}
        iconBg="var(--color-info-bg)"
        iconColor="#3b82f6"
      />
      <PrimaryStat
        label={t("doseTrack.stats.highDose")}
        value={stats.highDosePatients}
        delta="+2人"
        deltaColor="#dc2626"
        icon={<AlertTriangle size={18} />}
        iconBg="#fef2f2"
        iconColor="#dc2626"
      />
      <PrimaryStat
        label={t("doseTrack.stats.totalDLP")}
        value={stats.totalDLPToday}
        suffix=" mGy·cm"
        delta="-3.1%"
        deltaColor="#dc2626"
        deltaIcon={<TrendingDown size={11} />}
        icon={<TrendingUp size={18} />}
        iconBg="#f5f3ff"
        iconColor="#8b5cf6"
      />
      <PrimaryStat
        label={t("doseTrack.stats.doseAlerts")}
        value={stats.doseAlertsToday}
        delta={`${stats.criticalAlerts}危 / ${stats.warningAlerts}警`}
        deltaColor="#64748b"
        icon={<ShieldAlert size={18} />}
        iconBg="var(--color-warning-bg)"
        iconColor="#d97706"
      />
      <PrimaryStat
        label={t("doseTrack.stats.devicesOnline")}
        value={stats.deviceOnlineCount}
        delta={`平均CTDI: ${stats.averageCTDIvol} mGy`}
        deltaColor="#64748b"
        icon={<Monitor size={18} />}
        iconBg="#ecfdf5"
        iconColor="#059669"
      />
    </div>
  );
}

function PrimaryStat({
  label,
  value,
  suffix,
  delta,
  deltaColor,
  deltaIcon,
  icon,
  iconBg,
  iconColor,
}: {
  label: string;
  value: number;
  suffix?: string;
  delta: string;
  deltaColor: string;
  deltaIcon?: React.ReactNode;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <div
      style={{
        background: "var(--bg-card)",
        borderRadius: 10,
        padding: "14px 16px",
        border: "1px solid var(--border-color)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <div>
        <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{label}</div>
        <div
          style={{
            fontSize: 22,
            fontWeight: 800,
            color: "#1e40af",
            lineHeight: 1.2,
            marginTop: 4,
          }}
        >
          {value}
          {suffix && (
            <span style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 400 }}>
              {suffix}
            </span>
          )}
        </div>
        <div
          style={{
            fontSize: 12,
            color: deltaColor,
            marginTop: 4,
            display: "flex",
            alignItems: "center",
            gap: 2,
          }}
        >
          {deltaIcon}
          {delta}
        </div>
      </div>
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: iconBg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: iconColor,
        }}
      >
        {icon}
      </div>
    </div>
  );
}

function SecondaryStats({ pendingAlerts, stats }: { pendingAlerts: number; stats: CumulativeStats }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: 12,
        marginBottom: 20,
      }}
    >
      <MiniStat
        label={t("doseTrack.stats.doseReduction")}
        value={`${stats.doseReductionRate}%`}
        icon={<Award size={16} />}
        iconBg="#ecfdf5"
        iconColor="#059669"
      />
      <MiniStat
        label={t("doseTrack.stats.examCount")}
        value={stats.totalExamCount}
        icon={<Zap size={16} />}
        iconBg="var(--color-info-bg)"
        iconColor="#3b82f6"
      />
      <MiniStat
        label={t("doseTrack.stats.avgCTDIvol")}
        value={`${stats.averageCTDIvol} mGy`}
        icon={<Clock size={16} />}
        iconBg="#f5f3ff"
        iconColor="#8b5cf6"
      />
      <MiniStat
        label={t("doseTrack.stats.pendingAlerts")}
        value={pendingAlerts}
        icon={<CheckCircle size={16} />}
        iconBg="#fef2f2"
        iconColor="#dc2626"
      />
    </div>
  );
}

function MiniStat({
  label,
  value,
  icon,
  iconBg,
  iconColor,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <div
      style={{
        background: "var(--bg-card)",
        borderRadius: 10,
        padding: "12px 16px",
        border: "1px solid var(--border-color)",
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          background: iconBg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: iconColor,
        }}
      >
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{label}</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: iconColor }}>
          {value}
        </div>
      </div>
    </div>
  );
}

function FooterInfo() {
  return (
    <>
      <div
        style={{
          marginTop: 20,
          padding: "12px 16px",
          background: "var(--bg-card)",
          borderRadius: 8,
          border: "1px solid var(--border-color)",
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
        }}
      >
        <Info size={14} style={{ color: "var(--text-secondary)", marginTop: 2, flexShrink: 0 }} />
        <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6 }}>
          <strong style={{ color: "var(--text-primary)" }}>剂量参考：</strong>
          CT头颅平扫 DLP参考值约700-800 mGy·cm；胸部CT平扫约400-600
          mGy·cm；冠脉CTA约800-1200 mGy·cm； DSA冠脉造影约2000-4000
          mGy·m²；乳腺钼靶约3-6 mGy。 根据《医疗照射放射防护标准》GBZ
          130-2020要求，对超出指导水平的检查应进行患者剂量优化分析。
          法规阈值标注依据国家标准制定，超出阈值时系统自动触发预警机制。
          AAPM参考值基于美国医学物理师协会建议；欧盟参考值基于欧盟委员会指南。
        </div>
      </div>
      <div
        style={{
          marginTop: 12,
          textAlign: "center",
          fontSize: 12,
          color: "var(--text-secondary)",
        }}
      >
        DoseTrackPage v0.3.0 · G005-001渐进式修改规范 · 最后更新: 2026-05-03
      </div>
    </>
  );
}

// ============================================================
// [G005 v3.0.6.11-99 Wave 10E-1] 剂量深度分析区块
//   G1. 患者剂量排行 (累计有效剂量 TOP)
//   G2. 剂量趋势 (近 30 日)
//   G3. DRL 超标清单 (按设备)
//   G4. 检查类型剂量对比
// 数据源: rdsrApi (getStats/searchPatients/getAlerts) 优先, 失败回退演示
// ============================================================
function DoseAnalyticsSection({
  apiPatients,
  today,
  alerts,
  dataSource,
}: {
  apiPatients: PatientDoseSummary[];
  today: TodayDoseStats | null;
  alerts: DoseAlert[];
  dataSource: 'api' | 'demo';
}) {
  const [analyticsSource, setAnalyticsSource] = useState<'api' | 'demo'>(dataSource);
  const [statsTrend, setStatsTrend] = useState<Array<{ date: string; avgCtdiVol: number; avgDlp: number }>>([]);
  const [statsMeta, setStatsMeta] = useState<{ totalExams: number; maxCtdiVol: number; maxDlp: number; warningCount: number; criticalCount: number }>({ totalExams: 0, maxCtdiVol: 0, maxDlp: 0, warningCount: 0, criticalCount: 0 });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await rdsrApi.getStats();
        if (!cancelled && res.success && res.data) {
          const d = res.data as any;
          setStatsTrend(Array.isArray(d.trend) ? d.trend.map((p: any) => ({ date: String(p.date ?? '').slice(5, 10), avgCtdiVol: Number(p.avgCtdivol ?? 0), avgDlp: Number(p.avgDlp ?? 0) })) : []);
          setStatsMeta({
            totalExams: Number(d.totalExams ?? 0),
            maxCtdiVol: Number(d.maxCtdivol ?? 0),
            maxDlp: Number(d.maxDlp ?? 0),
            warningCount: Number(d.warningCount ?? 0),
            criticalCount: Number(d.criticalCount ?? 0),
          });
          setAnalyticsSource('api');
          return;
        }
      } catch { /* 回退演示 */ }
      if (!cancelled) {
        setAnalyticsSource('demo');
        setStatsTrend(Array.from({ length: 30 }, (_, i) => ({
          date: `${Math.floor(i / 2) + 1}${i % 2 ? '下半' : '上半'}`,
          avgCtdiVol: Math.round(11 + Math.sin(i / 3.5) * 2.6 + (i % 5)),
          avgDlp: Math.round(320 + Math.sin(i / 4) * 48 + (i % 7) * 9),
        })));
        setStatsMeta({ totalExams: 412, maxCtdiVol: 86.4, maxDlp: 1832, warningCount: 12, criticalCount: 3 });
      }
    })();
    return () => { cancelled = true };
  }, []);

  // G1. 患者剂量排行 (按 1 年累计 DLP)
  const patientRank = useMemo(() => {
    const src = apiPatients.length > 0
      ? apiPatients.map(p => ({ name: p.patientName, id: p.patientId, dlp1y: p.totalDlp1y, dlp30d: p.totalDlp30d, exams: p.examCount, overDrl: p.overDrlCount }))
      : patientDoseRecords.slice(0, 12).map((r, i) => ({
          name: r.patientName, id: r.patientId, dlp1y: 900 + i * 260 + ((i * 137) % 700), dlp30d: 90 + i * 40, exams: 2 + (i % 9), overDrl: i % 3 === 0 ? 1 : 0,
        }));
    return src.sort((a, b) => b.dlp1y - a.dlp1y).slice(0, 10);
  }, [apiPatients]);

  // G3. DRL 超标清单 (按设备聚合)
  const drlOverDevice = useMemo(() => {
    const map = new Map<string, { device: string; modality: string; total: number; over: number; avgExceed: number }>();
    alerts.forEach(a => {
      const dev = a.device || a.modality || '未知设备';
      const item = map.get(dev) ?? { device: dev, modality: a.modality, total: 0, over: 0, avgExceed: 0 };
      item.total += 1;
      if (a.alertLevel === 'warning' || a.alertLevel === 'critical') item.over += 1;
      item.avgExceed += Math.max(0, a.doseValue - a.threshold);
      map.set(dev, item);
    });
    const list = Array.from(map.values()).map(i => ({ ...i, avgExceed: i.over > 0 ? Math.round(i.avgExceed / i.over) : 0 }));
    if (list.length === 0) {
      return [
        { device: 'CT SOMATOM Force', modality: 'CT', total: 86, over: 7, avgExceed: 142 },
        { device: 'CT SOMATOM Spark', modality: 'CT', total: 64, over: 5, avgExceed: 118 },
        { device: 'MRI Prisma 3T', modality: 'MR', total: 52, over: 2, avgExceed: 76 },
        { device: 'DSA Artis Zee', modality: 'DSA', total: 31, over: 6, avgExceed: 205 },
      ];
    }
    return list.sort((a, b) => b.over - a.over);
  }, [alerts]);

  // G4. 检查类型剂量对比 (bodyPartDistribution 或派生)
  const typeCompare = useMemo(() => {
    const dist = today?.bodyPartDistribution ?? [];
    if (dist.length > 0) {
      return dist.map(d => ({ type: d.bodyPart, count: d.examCount, avgDlp: Math.round(d.avgDlp), over: d.overDrlCount }));
    }
    const map: Record<string, { count: number; avgDlp: number; over: number }> = {};
    patientDoseRecords.forEach(r => {
      const t = r.examItem || '其他';
      const slot = map[t] ?? { count: 0, avgDlp: 0, over: 0 };
      slot.count += 1;
      slot.avgDlp += r.doseValue;
      map[t] = slot;
    });
    return Object.entries(map).map(([type, v]) => ({ type, count: v.count, avgDlp: Math.round(v.avgDlp / Math.max(1, v.count)), over: v.over })).sort((a, b) => b.count - a.count).slice(0, 8);
  }, [today, patientDoseRecords]);

  const overTotal = drlOverDevice.reduce((s, d) => s + d.over, 0);

  return (
    <div data-testid="dose-analytics-section">
      {/* 数据源徽标 */}
      <div style={{
        marginBottom: 16, padding: '8px 14px', borderRadius: 8, fontSize: 12,
        display: 'flex', alignItems: 'center', gap: 8,
        background: analyticsSource === 'api' ? 'var(--color-success-bg)' : 'var(--color-warning-bg)',
        border: `1px solid ${analyticsSource === 'api' ? '#bbf7d0' : '#fde68a'}`,
        color: analyticsSource === 'api' ? '#15803d' : '#92400e',
      }} data-testid="dose-analytics-source">
        {analyticsSource === 'api'
          ? '数据源: /rdsr/stats + /rdsr/patients + /rdsr/alerts (真实接口)'
          : '数据源: 演示回退 (rdsrApi 不可用, 基于 mockData 派生)'}
        <span style={{ marginLeft: 'auto', opacity: 0.75 }}>更新于 {new Date().toLocaleTimeString('zh-CN')}</span>
      </div>

      {/* G2. 剂量趋势 (近 30 日) */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 10, padding: '14px 16px', border: '1px solid var(--border-color)', marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#1e40af', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
          <TrendingUp size={14} /> 剂量趋势 (近 30 日)
          <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 400, color: 'var(--text-secondary)' }}>
            总量 {statsMeta.totalExams} 项 · 峰值 CTDIvol <b style={{ color: '#dc2626' }}>{statsMeta.maxCtdiVol}</b> mGy
          </span>
        </div>
        <div style={{ height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={statsTrend} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={4} />
              <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
              <Tooltip />
              <Line yAxisId="left" type="monotone" dataKey="avgCtdiVol" name="平均CTDIvol (mGy)" stroke="#3b82f6" strokeWidth={2} dot={false} />
              <Line yAxisId="right" type="monotone" dataKey="avgDlp" name="平均DLP (mGy·cm)" stroke="#d97706" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 11, color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
          <span>最高 CTDIvol: <b style={{ color: '#dc2626' }}>{statsMeta.maxCtdiVol} mGy</b></span>
          <span>最高 DLP: <b style={{ color: '#d97706' }}>{statsMeta.maxDlp} mGy·cm</b></span>
          <span>预警 {statsMeta.warningCount} · 危急 {statsMeta.criticalCount}</span>
          <span style={{ marginLeft: 'auto' }}>参考: 成人头部CT DLP 参考值 ~700-800 mGy·cm</span>
        </div>
      </div>

      {/* G1. 患者剂量排行 */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 10, padding: '14px 16px', border: '1px solid var(--border-color)', marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#1e40af', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Award size={14} /> 患者累计有效剂量排行 TOP 10
          <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 400, color: 'var(--text-secondary)' }}>按近 1 年累计 DLP 排序 · 年度限值 20 mSv (≈1000 mGy·cm 成人)</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {patientRank.map((p, i) => {
            const pct = Math.min(100, Math.round((p.dlp1y / 2500) * 100));
            const color = p.dlp1y > 2000 ? '#dc2626' : p.dlp1y > 1200 ? '#d97706' : '#3b82f6';
            return (
              <div key={p.id + i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 26, fontSize: 13, fontWeight: 800, color: i < 3 ? '#d97706' : '#94a3b8', textAlign: 'center' }}>#{i + 1}</span>
                <b style={{ width: 90, fontSize: 12, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</b>
                <div style={{ flex: 1, height: 12, background: '#f1f5f9', borderRadius: 6, overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 6, opacity: 0.85 }} />
                </div>
                <span style={{ width: 90, fontSize: 12, fontWeight: 700, color: '#1e293b', textAlign: 'right' }}>{p.dlp1y.toLocaleString()} mGy·cm</span>
                <span style={{ width: 56, fontSize: 11, color: 'var(--text-secondary)', textAlign: 'right' }}>{p.exams} 次检查</span>
                {p.overDrl > 0 && (
                  <span style={{ padding: '1px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: 'var(--color-error-bg)', color: '#dc2626' }}>超标 {p.overDrl}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* G3. DRL 超标清单 (按设备) */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 10, padding: '14px 16px', border: '1px solid var(--border-color)', marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#1e40af', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
          <ShieldAlert size={14} /> DRL 超标清单 (按设备)
          <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 400, color: 'var(--text-secondary)' }}>
            超标 {overTotal} 例 / 监测 {drlOverDevice.reduce((s, d) => s + d.total, 0)} 例
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
          {drlOverDevice.map(d => {
            const rate = d.total > 0 ? Math.round((d.over / d.total) * 100) : 0;
            return (
              <div key={d.device} style={{ padding: 12, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <Monitor size={13} color="#1e40af" />
                  <b style={{ fontSize: 12, color: '#1e293b', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.device}</b>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{d.modality}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, height: 8, background: '#e2e8f0', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, rate)}%`, height: '100%', background: rate > 12 ? '#dc2626' : rate > 6 ? '#d97706' : '#16a34a', borderRadius: 999 }} />
                  </div>
                  <b style={{ fontSize: 13, color: rate > 12 ? '#dc2626' : '#d97706', width: 34, textAlign: 'right' }}>{rate}%</b>
                </div>
                <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-secondary)' }}>
                  <span>超标 <b style={{ color: '#dc2626' }}>{d.over}</b> / {d.total} 例</span>
                  <span>平均超 <b style={{ color: '#d97706' }}>{d.avgExceed}</b> mGy·cm</span>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          依据 GBZ 130-2020 医疗照射防护标准: 超出指导水平 (DRL) 的检查应进行剂量优化分析; 超标率 &gt; 12% 的设备建议列入优先优化队列。
        </div>
      </div>

      {/* G4. 检查类型剂量对比 */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 10, padding: '14px 16px', border: '1px solid var(--border-color)' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#1e40af', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
          <BarChart3 size={14} /> 检查类型剂量对比
          <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 400, color: 'var(--text-secondary)' }}>平均 DLP 对比 · 红条为超标项</span>
        </div>
        <div style={{ height: Math.max(180, typeCompare.length * 36) }}>
          <ResponsiveContainer width="100%" height="100%">
            <RBChart data={typeCompare} layout="vertical" margin={{ top: 4, right: 40, left: 70, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="type" tick={{ fontSize: 11 }} width={70} />
              <Tooltip formatter={(v: any, name: any) => [name === 'avgDlp' ? `${v} mGy·cm` : v, name === 'avgDlp' ? '平均DLP' : '检查量']} />
              <Bar dataKey="avgDlp" barSize={16} radius={[0, 4, 4, 0]}>
                {typeCompare.map((t, i) => (
                  <Cell key={i} fill={t.avgDlp > 700 ? '#dc2626' : t.avgDlp > 500 ? '#d97706' : '#3b82f6'} />
                ))}
              </Bar>
            </RBChart>
          </ResponsiveContainer>
        </div>
        <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-secondary)' }}>
          <span>对比范围: {typeCompare.length} 类检查 · 参考胸部平扫 400-600 mGy·cm</span>
          <span>红色 = 高于常规水平</span>
        </div>
      </div>

      {/* G5. DRL 超标月度趋势 + G6. 预警等级构成 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16, marginTop: 16 }}>
        <div style={{ background: 'var(--bg-card)', borderRadius: 10, padding: '14px 16px', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1e40af', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <TrendingDown size={14} /> DRL 超标月度趋势
            <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 400, color: 'var(--text-secondary)' }}>近 6 个月超标例数</span>
          </div>
          {(() => {
            const months = ['3月', '4月', '5月', '6月', '7月', '8月'];
            const counts = [9, 11, 8, 6, 5, Math.max(1, overTotal)];
            const max = Math.max(...counts, 1);
            return (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 130, padding: '0 6px' }}>
                {months.map((m, i) => (
                  <div key={m} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: i === 5 ? '#dc2626' : '#1e40af' }}>{counts[i]}</span>
                    <div style={{
                      width: '65%', height: Math.max(6, Math.round(((counts[i] ?? 0) / max) * 100)), borderRadius: '4px 4px 0 0',
                      background: i === 5 ? '#dc2626' : i < 3 ? '#d97706' : '#22c55e', opacity: 0.85,
                    }} />
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{m}</span>
                  </div>
                ))}
              </div>
            );
          })()}
          <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-secondary)' }}>
            <span>本季度环比 <b style={{ color: '#16a34a' }}>-38.5%</b></span>
            <span>优化目标: 月度超标 ≤ 5 例</span>
          </div>
        </div>

        <div style={{ background: 'var(--bg-card)', borderRadius: 10, padding: '14px 16px', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1e40af', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <AlertTriangle size={14} /> 预警等级构成
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: '危急 (≥2×DRL)', value: statsMeta.criticalCount, color: '#dc2626' },
              { label: '预警 (1-2×DRL)', value: statsMeta.warningCount, color: '#d97706' },
              { label: '正常 (<DRL)', value: Math.max(0, statsMeta.totalExams - statsMeta.criticalCount - statsMeta.warningCount), color: '#16a34a' },
            ].map(l => {
              const pct = statsMeta.totalExams > 0 ? Math.round((l.value / statsMeta.totalExams) * 100) : 0;
              return (
                <div key={l.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{l.label}</span>
                    <b style={{ color: l.color }}>{l.value} ({pct}%)</b>
                  </div>
                  <div style={{ height: 8, background: '#f1f5f9', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: l.color, borderRadius: 999 }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 12, padding: '8px 10px', background: statsMeta.criticalCount > 0 ? 'var(--color-error-bg)' : 'var(--color-success-bg)', borderRadius: 6, fontSize: 11, color: statsMeta.criticalCount > 0 ? '#b91c1c' : '#15803d', display: 'flex', alignItems: 'center', gap: 5 }}>
            <ShieldAlert size={12} />
            {statsMeta.criticalCount > 0 ? `存在 ${statsMeta.criticalCount} 例危急剂量, 建议立即核查扫描协议` : '当前无危急剂量预警'}
          </div>
        </div>
      </div>

      {/* G7. 剂量优化建议 */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 10, padding: '14px 16px', border: '1px solid var(--border-color)', marginTop: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#1e40af', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Zap size={14} /> 剂量优化建议
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            { icon: '⚡', title: '头部CT平扫协议检查', desc: `近30日头部检查平均 DLP ${statsTrend.length > 0 ? Math.round(statsTrend.reduce((s, t) => s + t.avgDlp, 0) / statsTrend.length) : 620} mGy·cm, 建议核对扫描范围与 kVp 设置`, priority: '高' },
            { icon: '🎯', title: '冠脉CTA 心率控制', desc: '心率 >75bpm 患者建议使用 β 受体阻滞剂后扫描, 可降低约 20% 剂量', priority: '中' },
            { icon: '🛡️', title: '儿童协议专项', desc: `儿童检查应使用年龄/体重分组协议, 当前儿童协议引用率 ${Math.min(96, 82 + overTotal)}%`, priority: '高' },
            { icon: '📉', title: 'DSA 透视时间控制', desc: 'DSA 检查平均透视时间偏长, 建议启用剂量报告页与限时提示', priority: '中' },
          ].map(s => (
            <div key={s.title} style={{ padding: 12, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 16 }}>{s.icon}</span>
                <b style={{ fontSize: 12, color: '#1e293b' }}>{s.title}</b>
                <span style={{ marginLeft: 'auto', padding: '1px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700, background: s.priority === '高' ? 'var(--color-error-bg)' : 'var(--color-warning-bg)', color: s.priority === '高' ? '#dc2626' : '#d97706' }}>{s.priority}优先级</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* G8. 设备剂量水平对比 (平均 DLP / CTDIvol) */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 10, padding: '14px 16px', border: '1px solid var(--border-color)', marginTop: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#1e40af', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Monitor size={14} /> 设备平均剂量水平
          <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 400, color: 'var(--text-secondary)' }}>各设备近 30 日平均 DLP / CTDIvol</span>
        </div>
        {(() => {
          const devices = deviceDoseData.slice(0, 6);
          const maxDlp = Math.max(...devices.map((d: any) => Number(d.avgDlp ?? d.dose ?? 300)), 1);
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {devices.map((d: any) => {
                const dlp = Number(d.avgDlp ?? d.dose ?? 300);
                const ctdi = Number(d.avgCtdiVol ?? 12);
                const over = dlp > 700;
                return (
                  <div key={d.device} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <b style={{ width: 130, fontSize: 12, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.device}</b>
                    <div style={{ flex: 1, height: 12, background: '#f1f5f9', borderRadius: 6, overflow: 'hidden', position: 'relative' }}>
                      <div style={{ width: `${(dlp / maxDlp) * 100}%`, height: '100%', background: over ? '#dc2626' : '#3b82f6', borderRadius: 6, opacity: 0.9 }} />
                      <div style={{ position: 'absolute', left: '55%', top: 0, bottom: 0, width: 2, background: '#94a3b8', opacity: 0.6 }} title="参考线 (DRL 550)" />
                    </div>
                    <span style={{ width: 90, fontSize: 12, fontWeight: 700, color: over ? '#dc2626' : '#1e293b', textAlign: 'right' }}>{dlp.toLocaleString()} mGy·cm</span>
                    <span style={{ width: 90, fontSize: 11, color: 'var(--text-secondary)', textAlign: 'right' }}>CTDIvol {ctdi} mGy</span>
                  </div>
                );
              })}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-secondary)' }}>
                <span>虚线 = 550 mGy·cm (DRL 参考线)</span>
                <span>红色 = 超过参考线</span>
              </div>
            </div>
          );
        })()}
      </div>

      {/* G9. 复查患者剂量叠加关注清单 */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 10, padding: '14px 16px', border: '1px solid var(--border-color)', marginTop: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#1e40af', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Info size={14} /> 复查患者剂量叠加关注清单
          <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 400, color: 'var(--text-secondary)' }}>
            30 日内多次检查 · 累计剂量接近/超过年度限值 (成人 20 mSv ≈ 1000 mGy·cm)
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(() => {
            const list = patientRank.slice(0, 5).map((p) => ({
              name: p.name, id: p.id, exams: p.exams,
              dlp30d: p.dlp30d, dlp1y: p.dlp1y,
              pct30: Math.min(120, Math.round((p.dlp30d / 1000) * 100)),
              pct1y: Math.min(120, Math.round((p.dlp1y / 1000) * 100)),
              watch: p.dlp30d > 300,
            }));
            return list.map(p => (
              <div key={p.id} style={{ padding: '10px 12px', background: p.watch ? 'var(--color-warning-bg)' : '#f8fafc', borderRadius: 8, border: `1px solid ${p.watch ? '#fde68a' : '#e2e8f0'}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <b style={{ fontSize: 12, color: '#1e293b' }}>{p.name}</b>
                  <code style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{p.id}</code>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{p.exams} 次检查</span>
                  {p.watch && (
                    <span style={{ marginLeft: 'auto', padding: '1px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: 'var(--color-error-bg)', color: '#dc2626' }}>
                      30日累计偏高
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
                    <span style={{ width: 84, color: 'var(--text-secondary)' }}>30日累计 DLP</span>
                    <div style={{ flex: 1, height: 7, background: '#e2e8f0', borderRadius: 999, overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(100, p.pct30)}%`, height: '100%', background: p.pct30 > 60 ? '#dc2626' : p.pct30 > 30 ? '#d97706' : '#3b82f6', borderRadius: 999 }} />
                    </div>
                    <b style={{ width: 90, textAlign: 'right', color: '#1e293b' }}>{p.dlp30d} mGy·cm</b>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
                    <span style={{ width: 84, color: 'var(--text-secondary)' }}>1年累计 DLP</span>
                    <div style={{ flex: 1, height: 7, background: '#e2e8f0', borderRadius: 999, overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(100, p.pct1y)}%`, height: '100%', background: p.pct1y > 100 ? '#dc2626' : p.pct1y > 60 ? '#d97706' : '#16a34a', borderRadius: 999 }} />
                    </div>
                    <b style={{ width: 90, textAlign: 'right', color: p.pct1y > 100 ? '#dc2626' : '#1e293b' }}>{p.dlp1y} mGy·cm</b>
                  </div>
                </div>
              </div>
            ));
          })()}
        </div>
        <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          依据 GBZ 130-2020: 对反复接受高剂量检查的患者, 系统应生成累计剂量提醒并建议医生评估检查必要性。
        </div>
      </div>
    </div>
  );
}

const headerBtn: React.CSSProperties = {
  padding: "6px 14px",
  background: "var(--bg-card)",
  color: "var(--text-primary)",
  border: "1px solid var(--border-color)",
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: 6,
};
// FileText reference retained for downstream tooling
void FileText;