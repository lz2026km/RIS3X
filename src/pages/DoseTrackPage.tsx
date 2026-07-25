import { useState, useCallback } from "react";
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
} from "lucide-react";
import { t } from "../i18n/appI18n";
import {
  DoseSearchPanel,
  DoseTrackingTable,
  DoseTrendChart,
  DoseAlertConfig,
} from "./dose";
import type { PatientDoseRecord, DoseAlert } from "./dose";
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
import DeviceDoseCard from "./dose/DeviceDoseCard";
import DeviceHistoryModal from "./dose/DeviceHistoryModal";
import {
  doseAlerts,
  cumulativeStats,
  patientDoseRecords,
  doseHistoryData,
  ctdivolTrendData,
  deviceDAPComparison,
  deviceDoseData,
} from "./dose/mockData";
import { exportDoseDataToCSV, exportDeviceDoseToCSV } from "./dose/utils";

type View =
  | "overview"
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

  const filteredPatientRecords = patientDoseRecords.filter((record) => {
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

      <PrimaryStats />

      <SecondaryStats pendingAlerts={alerts.filter((a) => a.status === "pending").length} />

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
          cumulativeStats={cumulativeStats}
          filteredAlerts={filteredAlerts}
          onAcknowledgeAlert={(alertId) => {
            setAlerts((prev) =>
              prev.map((a) =>
                a.id === alertId ? { ...a, status: "acknowledged" as const } : a,
              ),
            );
          }}
          onViewPatient={(patientName) => {
            setView("patient");
            setSelectedPatient(
              patientDoseRecords.find(
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
            color: "#1e3a5f",
            margin: "0 0 4px",
          }}
        >
          {t("doseTrack.title")}
        </h1>
        <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>
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

function PrimaryStats() {
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
        value={cumulativeStats.totalPatientsToday}
        delta="+5.2%"
        deltaColor="#16a34a"
        icon={<Activity size={18} />}
        iconBg="#eff6ff"
        iconColor="#3b82f6"
      />
      <PrimaryStat
        label={t("doseTrack.stats.highDose")}
        value={cumulativeStats.highDosePatients}
        delta="+2人"
        deltaColor="#dc2626"
        icon={<AlertTriangle size={18} />}
        iconBg="#fef2f2"
        iconColor="#dc2626"
      />
      <PrimaryStat
        label={t("doseTrack.stats.totalDLP")}
        value={cumulativeStats.totalDLPToday}
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
        value={cumulativeStats.doseAlertsToday}
        delta={`${cumulativeStats.criticalAlerts}危 / ${cumulativeStats.warningAlerts}警`}
        deltaColor="#64748b"
        icon={<ShieldAlert size={18} />}
        iconBg="#fffbeb"
        iconColor="#d97706"
      />
      <PrimaryStat
        label={t("doseTrack.stats.devicesOnline")}
        value={cumulativeStats.deviceOnlineCount}
        delta={`平均CTDI: ${cumulativeStats.averageCTDIvol} mGy`}
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
        background: "#fff",
        borderRadius: 10,
        padding: "14px 16px",
        border: "1px solid #e2e8f0",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <div>
        <div style={{ fontSize: 12, color: "#64748b" }}>{label}</div>
        <div
          style={{
            fontSize: 22,
            fontWeight: 800,
            color: "#1e3a5f",
            lineHeight: 1.2,
            marginTop: 4,
          }}
        >
          {value}
          {suffix && (
            <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 400 }}>
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

function SecondaryStats({ pendingAlerts }: { pendingAlerts: number }) {
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
        value={`${cumulativeStats.doseReductionRate}%`}
        icon={<Award size={16} />}
        iconBg="#ecfdf5"
        iconColor="#059669"
      />
      <MiniStat
        label={t("doseTrack.stats.examCount")}
        value={cumulativeStats.totalExamCount}
        icon={<Zap size={16} />}
        iconBg="#eff6ff"
        iconColor="#3b82f6"
      />
      <MiniStat
        label={t("doseTrack.stats.avgCTDIvol")}
        value={`${cumulativeStats.averageCTDIvol} mGy`}
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
        background: "#fff",
        borderRadius: 10,
        padding: "12px 16px",
        border: "1px solid #e2e8f0",
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
        <div style={{ fontSize: 12, color: "#64748b" }}>{label}</div>
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
          background: "#f8fafc",
          borderRadius: 8,
          border: "1px solid #e2e8f0",
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
        }}
      >
        <Info size={14} style={{ color: "#64748b", marginTop: 2, flexShrink: 0 }} />
        <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.6 }}>
          <strong style={{ color: "#334155" }}>剂量参考：</strong>
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
          color: "#94a3b8",
        }}
      >
        DoseTrackPage v0.3.0 · G005-001渐进式修改规范 · 最后更新: 2026-05-03
      </div>
    </>
  );
}

const headerBtn: React.CSSProperties = {
  padding: "6px 14px",
  background: "#fff",
  color: "#334155",
  border: "1px solid #e2e8f0",
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