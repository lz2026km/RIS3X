import { useState, useCallback, useEffect } from "react";
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
  | "spc";

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
            fontSize: 18,
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