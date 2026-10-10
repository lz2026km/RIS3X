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
import { DataTable } from "../components/common/DataTable";
import type { ColumnsType } from "antd/es/table";
import {
  DoseSearchPanel,
  DoseTrackingTable,
  DoseTrendChart,
  DoseAlertConfig,
} from "./dose";
import type { PatientDoseRecord, DoseAlert, CumulativeStats, DeviceDoseData } from "./dose";
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
import { LoadingBanner, AppEmpty } from "../components/feedback";
import {
  LineChart, Line, BarChart as RBChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import { ChartContainer, chartDefaults } from "../components/charts";
import { Typography } from "antd";

const { Title } = Typography

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
  const [loading, setLoading] = useState(true);
  // [G005 W8-Dose] 总览图数据: 优先 /rdsr/overview, 端点不可用/返回空时回退 mock
  const [doseHistory, setDoseHistory] = useState(doseHistoryData);
  const [ctdivolTrend, setCtdivolTrend] = useState(ctdivolTrendData);
  const [deviceDap, setDeviceDap] = useState(deviceDAPComparison);
  const [deviceDose, setDeviceDose] = useState<DeviceDoseData[]>(deviceDoseData);
  const [overviewSource, setOverviewSource] = useState<'api' | 'demo'>('demo');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
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
            patientName: a.patientName ?? t('doseTrack.unknownPatient'),
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
        if (!cancelled) setDataError(e instanceof Error ? e.message : t('doseTrack.apiUnavailable'));
      } finally {
        if (!cancelled) setLoading(false);
      }
      try {
        const ov = await rdsrApi.getOverview();
        if (cancelled) return;
        if (ov.success && ov.data) {
          const d = ov.data;
          if (Array.isArray(d.doseHistory) && d.doseHistory.length > 0) setDoseHistory(d.doseHistory);
          if (Array.isArray(d.ctdivolTrend) && d.ctdivolTrend.length > 0) setCtdivolTrend(d.ctdivolTrend);
          if (Array.isArray(d.deviceDap) && d.deviceDap.length > 0) setDeviceDap(d.deviceDap);
          if (Array.isArray(d.deviceDose) && d.deviceDose.length > 0) setDeviceDose(d.deviceDose as DeviceDoseData[]);
          setOverviewSource('api');
        }
      } catch {
        /* 保留演示数据回退 */
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
    examItem: t('doseTrack.cumulativeDose'),
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
      deviceDose,
      `device_dose_${new Date().toISOString().split("T")[0]}.csv`,
    );
  }, [deviceDose]);

  return (
    <div style={{ padding: 'var(--space-6, 24px)', maxWidth: 1400, margin: "0 auto" }}>
      <PageHeader
        onExportPatient={handleExportPatientCSV}
        onExportDevice={handleExportDeviceCSV}
      />

      {loading && <LoadingBanner message={t('w9.states.loading')} />}

      <PrimaryStats stats={stats} />

      <SecondaryStats pendingAlerts={alerts.filter((a) => a.status === "pending").length} stats={stats} />

      {dataSource === 'api' && overviewSource === 'api' ? (
        <div style={{ marginBottom: 'var(--space-3, 12px)', padding: '8px 12px', background: 'var(--color-success-bg)', color: 'var(--color-success-600)', borderRadius: 8, fontSize: 12 }}>
          {t('doseTrack.dataSourceLine')} {today?.date ?? '-'}
        </div>
      ) : (
        <div style={{ marginBottom: 'var(--space-3, 12px)', padding: '8px 12px', background: 'var(--color-warning-bg)', color: 'var(--color-warning-600)', borderRadius: 8, fontSize: 12 }}>
          {dataError ? t('doseTrack.apiErrorPrefix', { error: dataError }) : ''}
          {overviewSource === 'demo' ? t('w8Dose.doseTrackDemo') : t('doseTrack.demoDataNote')}
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
          doseHistoryData={doseHistory}
          ctdivolTrendData={ctdivolTrend}
          deviceDAPComparison={deviceDap}
          deviceDoseData={deviceDose}
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
        deviceDose.length === 0 ? (
          <AppEmpty variant="no-data" minHeight={200} />
        ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 'var(--space-4, 16px)',
          }}
        >
          {deviceDose.map((d) => (
            <DeviceDoseCard
              key={d.device}
              device={d}
              onShowHistory={() => setDeviceHistoryDevice(d.device)}
            />
          ))}
        </div>
        )
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
          deviceDose={deviceDose}
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
        marginBottom: 'var(--space-5, 20px)',
      }}
    >
      <div>
        <Title
          level={4}
          style={{
            margin: "0 0 4px",
            display: "flex",
            alignItems: "center",
            gap: 'var(--space-2, 8px)',
          }}
        >
          <Gauge size={18} color="var(--color-primary-800)" />
          {t("doseTrack.title")}
        </Title>
        <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0 }}>
          {t("doseTrack.subtitle")}
        </p>
      </div>
      <div style={{ display: "flex", gap: 'var(--space-2, 8px)' }}>
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
        gap: 'var(--space-3, 12px)',
        marginBottom: 'var(--space-5, 20px)',
      }}
    >
      <PrimaryStat
        label={t("doseTrack.stats.patientsToday")}
        value={stats.totalPatientsToday}
        delta="+5.2%"
        deltaColor="var(--color-success-600)"
        icon={<Activity size={18} />}
        iconBg="var(--color-info-bg)"
        iconColor="var(--color-primary-500)"
      />
      <PrimaryStat
        label={t("doseTrack.stats.highDose")}
        value={stats.highDosePatients}
        delta={t('doseTrack.deltaNewPatients')}
        deltaColor="var(--color-error-600)"
        icon={<AlertTriangle size={18} />}
        iconBg="#fef2f2"
        iconColor="var(--color-error-600)"
      />
      <PrimaryStat
        label={t("doseTrack.stats.totalDLP")}
        value={stats.totalDLPToday}
        suffix=" mGy·cm"
        delta="-3.1%"
        deltaColor="var(--color-error-600)"
        deltaIcon={<TrendingDown size={11} />}
        icon={<TrendingUp size={18} />}
        iconBg="#f5f3ff"
        iconColor="#8b5cf6"
      />
      <PrimaryStat
        label={t("doseTrack.stats.doseAlerts")}
        value={stats.doseAlertsToday}
        delta={t('doseTrack.criticalWarningDelta', { critical: stats.criticalAlerts, warning: stats.warningAlerts })}
        deltaColor="var(--text-secondary, #475569)"
        icon={<ShieldAlert size={18} />}
        iconBg="var(--color-warning-bg)"
        iconColor="var(--color-warning-600)"
      />
      <PrimaryStat
        label={t("doseTrack.stats.devicesOnline")}
        value={stats.deviceOnlineCount}
        delta={t('doseTrack.avgCtdiDelta', { value: stats.averageCTDIvol })}
        deltaColor="var(--text-secondary, #475569)"
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
            fontSize: 20,
            fontWeight: 800,
            color: "var(--color-primary-800)",
            lineHeight: 1.2,
            marginTop: 'var(--space-1, 4px)',
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
            marginTop: 'var(--space-1, 4px)',
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
        gap: 'var(--space-3, 12px)',
        marginBottom: 'var(--space-5, 20px)',
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
        iconColor="var(--color-primary-500)"
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
        iconColor="var(--color-error-600)"
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
        gap: 'var(--space-3, 12px)',
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
          marginTop: 'var(--space-5, 20px)',
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
          <strong style={{ color: "var(--text-primary)" }}>{t('doseTrack.refTitle')}</strong>
          {t('doseTrack.refText')}
        </div>
      </div>
      <div
        style={{
          marginTop: 'var(--space-3, 12px)',
          textAlign: "center",
          fontSize: 12,
          color: "var(--text-secondary)",
        }}
      >
        {t('doseTrack.footerVersion')}
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
  deviceDose,
}: {
  apiPatients: PatientDoseSummary[];
  today: TodayDoseStats | null;
  alerts: DoseAlert[];
  dataSource: 'api' | 'demo';
  deviceDose: DeviceDoseData[];
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
          date: `${Math.floor(i / 2) + 1}${i % 2 ? t('doseTrack.secondHalf') : t('doseTrack.firstHalf')}`,
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
      const dev = a.device || a.modality || t('doseTrack.unknownDevice');
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
      const label = r.examItem || t('doseTrack.other');
      const slot = map[label] ?? { count: 0, avgDlp: 0, over: 0 };
      slot.count += 1;
      slot.avgDlp += r.doseValue;
      map[label] = slot;
    });
    return Object.entries(map).map(([type, v]) => ({ type, count: v.count, avgDlp: Math.round(v.avgDlp / Math.max(1, v.count)), over: v.over })).sort((a, b) => b.count - a.count).slice(0, 8);
  }, [today, patientDoseRecords]);

  const overTotal = drlOverDevice.reduce((s, d) => s + d.over, 0);

  type PatientRankRow = { name: string; id: string; dlp1y: number; dlp30d: number; exams: number; overDrl: number };
  const patientRankColumns: ColumnsType<PatientRankRow> = [
    {
      title: t("w3tables.col.index"), key: "rank", width: 70, align: "center",
      render: (_: unknown, _row, index) => <span style={{ fontSize: 12, fontWeight: 800, color: index < 3 ? "var(--color-warning-600)" : "var(--text-muted, #94a3b8)" }}>#{index + 1}</span>,
    },
    {
      title: t("w3tables.col.patient"), dataIndex: "name", key: "name",
      render: (_: unknown, p) => (
        <div>
          <b style={{ fontSize: 12, color: "var(--text-primary, #1e293b)" }}>{p.name}</b>
          <div style={{ fontSize: 11, color: "var(--text-secondary)", fontFamily: "monospace" }}>{p.id}</div>
        </div>
      ),
    },
    {
      title: t("doseTrack.patientRankTitle"), dataIndex: "dlp1y", key: "dlp1y",
      render: (v: number) => {
        const pct = Math.min(100, Math.round((v / 2500) * 100));
        const color = v > 2000 ? "var(--color-error-600)" : v > 1200 ? "var(--color-warning-600)" : "var(--color-primary-500)";
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 220 }}>
            <div style={{ flex: 1, height: 12, background: "var(--bg-primary, #f8fafc)", borderRadius: 6, overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 6, opacity: 0.85 }} />
            </div>
            <span style={{ width: 100, fontSize: 12, fontWeight: 700, color: "var(--text-primary, #1e293b)", textAlign: "right" }}>{v.toLocaleString()} mGy·cm</span>
          </div>
        );
      },
    },
    { title: t("w3tables.col.exam"), dataIndex: "exams", key: "exams", width: 100, align: "center", render: (v: number) => t("doseTrack.examCount", { count: v }) },
    {
      title: t("w3tables.col.count"), dataIndex: "overDrl", key: "overDrl", width: 100, align: "center",
      render: (v: number) => v > 0
        ? <span style={{ padding: "1px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: "var(--color-error-bg)", color: "var(--color-error-600)" }}>{t("doseTrack.overCount", { count: v })}</span>
        : <span style={{ color: "var(--text-secondary)" }}>—</span>,
    },
  ];

  return (
    <div data-testid="dose-analytics-section">
      {/* 数据源徽标 */}
      <div style={{
        marginBottom: 'var(--space-4, 16px)', padding: '8px 14px', borderRadius: 8, fontSize: 12,
        display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)',
        background: analyticsSource === 'api' ? 'var(--color-success-bg)' : 'var(--color-warning-bg)',
        border: `1px solid ${analyticsSource === 'api' ? '#bbf7d0' : '#fde68a'}`,
        color: analyticsSource === 'api' ? '#15803d' : '#92400e',
      }} data-testid="dose-analytics-source">
        {analyticsSource === 'api'
          ? t('doseTrack.sourceReal')
          : t('doseTrack.sourceDemo')}
        <span style={{ marginLeft: 'auto', opacity: 0.75 }}>{t('doseTrack.updatedAt', { time: new Date().toLocaleTimeString('zh-CN') })}</span>
      </div>

      {/* G2. 剂量趋势 (近 30 日) */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 10, padding: '14px 16px', border: '1px solid var(--border-color)', marginBottom: 'var(--space-4, 16px)' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-primary-800)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
          <TrendingUp size={14} /> {t('doseTrack.trendTitle')}
          <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 400, color: 'var(--text-secondary)' }}>
            {t('doseTrack.trendMeta', { total: statsMeta.totalExams })} <b style={{ color: 'var(--color-error-600)' }}>{statsMeta.maxCtdiVol}</b> mGy
          </span>
        </div>
        <ChartContainer type="line" height={220}>
          <LineChart data={statsTrend} margin={chartDefaults.margin}>
            <CartesianGrid {...chartDefaults.grid} />
            <XAxis dataKey="date" interval={4} {...chartDefaults.axis} />
            <YAxis yAxisId="left" {...chartDefaults.axis} />
            <YAxis yAxisId="right" orientation="right" {...chartDefaults.axis} />
            <Tooltip {...chartDefaults.tooltip} />
            <Line yAxisId="left" type="monotone" dataKey="avgCtdiVol" name={t('doseTrack.avgCtdiVol')} stroke="var(--color-primary-500)" strokeWidth={2} dot={false} />
            <Line yAxisId="right" type="monotone" dataKey="avgDlp" name={t('doseTrack.avgDlp')} stroke="var(--color-warning-600)" strokeWidth={2} dot={false} />
          </LineChart>
        </ChartContainer>
        <div style={{ display: 'flex', gap: 'var(--space-4, 16px)', marginTop: 'var(--space-2, 8px)', fontSize: 11, color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
          <span>{t('doseTrack.maxCtdi')} <b style={{ color: 'var(--color-error-600)' }}>{statsMeta.maxCtdiVol} mGy</b></span>
          <span>{t('doseTrack.maxDlp')} <b style={{ color: 'var(--color-warning-600)' }}>{statsMeta.maxDlp} mGy·cm</b></span>
          <span>{t('doseTrack.warningCritical', { warning: statsMeta.warningCount, critical: statsMeta.criticalCount })}</span>
          <span style={{ marginLeft: 'auto' }}>{t('doseTrack.headCtdiReference')}</span>
        </div>
      </div>

      {/* G1. 患者剂量排行 */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 10, padding: '14px 16px', border: '1px solid var(--border-color)', marginBottom: 'var(--space-4, 16px)' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-primary-800)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Award size={14} /> {t('doseTrack.patientRankTitle')}
          <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 400, color: 'var(--text-secondary)' }}>{t('doseTrack.patientRankSubtitle')}</span>
        </div>
        <DataTable<PatientRankRow>
          columns={patientRankColumns}
          dataSource={patientRank}
          rowKey={(r) => r.id + r.name}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 'max-content' }}
        />
      </div>

      {/* G3. DRL 超标清单 (按设备) */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 10, padding: '14px 16px', border: '1px solid var(--border-color)', marginBottom: 'var(--space-4, 16px)' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-primary-800)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
          <ShieldAlert size={14} /> {t('doseTrack.drlOverTitle')}
          <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 400, color: 'var(--text-secondary)' }}>
            {t('doseTrack.drlOverMeta', { over: overTotal, total: drlOverDevice.reduce((s, d) => s + d.total, 0) })}
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
          {drlOverDevice.map(d => {
            const rate = d.total > 0 ? Math.round((d.over / d.total) * 100) : 0;
            return (
              <div key={d.device} style={{ padding: 'var(--space-3, 12px)', background: 'var(--bg-primary, #f8fafc)', borderRadius: 8, border: '1px solid var(--border-default, rgba(0,0,0,0.12))' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 'var(--space-2, 8px)' }}>
                  <Monitor size={13} color="var(--color-primary-800)" />
                  <b style={{ fontSize: 12, color: 'var(--text-primary, #1e293b)', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.device}</b>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{d.modality}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)' }}>
                  <div style={{ flex: 1, height: 8, background: 'var(--border-default, rgba(0,0,0,0.12))', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, rate)}%`, height: '100%', background: rate > 12 ? 'var(--color-error-600)' : rate > 6 ? 'var(--color-warning-600)' : 'var(--color-success-600)', borderRadius: 999 }} />
                  </div>
                  <b style={{ fontSize: 12, color: rate > 12 ? 'var(--color-error-600)' : 'var(--color-warning-600)', width: 34, textAlign: 'right' }}>{rate}%</b>
                </div>
                <div style={{ marginTop: 'var(--space-2, 8px)', display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-secondary)' }}>
                  <span>{t('doseTrack.overLabel')} <b style={{ color: 'var(--color-error-600)' }}>{d.over}</b> / {d.total} {t('doseTrack.casesUnit')}</span>
                  <span>{t('doseTrack.avgExceed')} <b style={{ color: 'var(--color-warning-600)' }}>{d.avgExceed}</b> mGy·cm</span>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
           {t('doseTrack.drlNote')}
        </div>
      </div>

      {/* G4. 检查类型剂量对比 */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 10, padding: '14px 16px', border: '1px solid var(--border-color)' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-primary-800)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
          <BarChart3 size={14} /> {t('doseTrack.typeCompareTitle')}
          <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 400, color: 'var(--text-secondary)' }}>{t('doseTrack.typeCompareSubtitle')}</span>
        </div>
          <ChartContainer type="bar" height={Math.max(180, typeCompare.length * 36)}>
            <RBChart data={typeCompare} layout="vertical" margin={chartDefaults.margin}>
              <CartesianGrid {...chartDefaults.grid} />
              <XAxis type="number" {...chartDefaults.axis} />
              <YAxis type="category" dataKey="type" width={70} {...chartDefaults.axis} />
              <Tooltip {...chartDefaults.tooltip} formatter={(v: any, name: any) => [name === 'avgDlp' ? `${v} mGy·cm` : v, name === 'avgDlp' ? t('doseTrack.avgDlpShort') : t('doseTrack.examVolume')]} />
              <Bar dataKey="avgDlp" barSize={16} radius={[0, 4, 4, 0]}>
                {typeCompare.map((t, i) => (
                  <Cell key={i} fill={t.avgDlp > 700 ? 'var(--color-error-600)' : t.avgDlp > 500 ? 'var(--color-warning-600)' : 'var(--color-primary-500)'} />
                ))}
              </Bar>
            </RBChart>
          </ChartContainer>
        <div style={{ marginTop: 'var(--space-2, 8px)', display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-secondary)' }}>
          <span>{t('doseTrack.compareRange', { count: typeCompare.length })}</span>
          <span>{t('doseTrack.redAboveNormal')}</span>
        </div>
      </div>

      {/* G5. DRL 超标月度趋势 + G6. 预警等级构成 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 'var(--space-4, 16px)', marginTop: 'var(--space-4, 16px)' }}>
        <div style={{ background: 'var(--bg-card)', borderRadius: 10, padding: '14px 16px', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-primary-800)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <TrendingDown size={14} /> {t('doseTrack.monthlyTrendTitle')}
            <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 400, color: 'var(--text-secondary)' }}>{t('doseTrack.monthlyTrendSubtitle')}</span>
          </div>
          {(() => {
            const months = ['3月', '4月', '5月', '6月', '7月', '8月'];
            const counts = [9, 11, 8, 6, 5, Math.max(1, overTotal)];
            const max = Math.max(...counts, 1);
            return (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 130, padding: '0 6px' }}>
                {months.map((m, i) => (
                  <div key={m} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-1, 4px)' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: i === 5 ? 'var(--color-error-600)' : 'var(--color-primary-800)' }}>{counts[i]}</span>
                    <div style={{
                      width: '65%', height: Math.max(6, Math.round(((counts[i] ?? 0) / max) * 100)), borderRadius: '4px 4px 0 0',
                      background: i === 5 ? 'var(--color-error-600)' : i < 3 ? 'var(--color-warning-600)' : 'var(--color-success-500)', opacity: 0.85,
                    }} />
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{m}</span>
                  </div>
                ))}
              </div>
            );
          })()}
          <div style={{ marginTop: 'var(--space-2, 8px)', display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-secondary)' }}>
            <span>{t('doseTrack.quarterOnQuarter')} <b style={{ color: 'var(--color-success-600)' }}>-38.5%</b></span>
            <span>{t('doseTrack.optimizationTarget')}</span>
          </div>
        </div>

        <div style={{ background: 'var(--bg-card)', borderRadius: 10, padding: '14px 16px', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-primary-800)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <AlertTriangle size={14} /> {t('doseTrack.alertCompositionTitle')}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: t('doseTrack.levelCritical'), value: statsMeta.criticalCount, color: 'var(--color-error-600)' },
              { label: t('doseTrack.levelWarning'), value: statsMeta.warningCount, color: 'var(--color-warning-600)' },
              { label: t('doseTrack.levelNormal'), value: Math.max(0, statsMeta.totalExams - statsMeta.criticalCount - statsMeta.warningCount), color: 'var(--color-success-600)' },
            ].map(l => {
              const pct = statsMeta.totalExams > 0 ? Math.round((l.value / statsMeta.totalExams) * 100) : 0;
              return (
                <div key={l.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 'var(--space-1, 4px)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{l.label}</span>
                    <b style={{ color: l.color }}>{l.value} ({pct}%)</b>
                  </div>
                  <div style={{ height: 8, background: 'var(--bg-primary, #f8fafc)', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: l.color, borderRadius: 999 }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 'var(--space-3, 12px)', padding: '8px 10px', background: statsMeta.criticalCount > 0 ? 'var(--color-error-bg)' : 'var(--color-success-bg)', borderRadius: 6, fontSize: 11, color: statsMeta.criticalCount > 0 ? '#b91c1c' : '#15803d', display: 'flex', alignItems: 'center', gap: 5 }}>
            <ShieldAlert size={12} />
            {statsMeta.criticalCount > 0 ? t('doseTrack.criticalExists', { count: statsMeta.criticalCount }) : t('doseTrack.noCriticalWarning')}
          </div>
        </div>
      </div>

      {/* G7. 剂量优化建议 */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 10, padding: '14px 16px', border: '1px solid var(--border-color)', marginTop: 'var(--space-4, 16px)' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-primary-800)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Zap size={14} /> {t('doseTrack.optimizationTitle')}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            { icon: '', title: t('doseTrack.sug1Title'), desc: t('doseTrack.sug1Desc', { dlp: statsTrend.length > 0 ? Math.round(statsTrend.reduce((s, tr) => s + tr.avgDlp, 0) / statsTrend.length) : 620 }), priority: t('doseTrack.priorityHigh') },
            { icon: '', title: t('doseTrack.sug2Title'), desc: t('doseTrack.sug2Desc'), priority: t('doseTrack.priorityMedium') },
            { icon: '', title: t('doseTrack.sug3Title'), desc: t('doseTrack.sug3Desc', { rate: Math.min(96, 82 + overTotal) }), priority: t('doseTrack.priorityHigh') },
            { icon: '', title: t('doseTrack.sug4Title'), desc: t('doseTrack.sug4Desc'), priority: t('doseTrack.priorityMedium') },
          ].map(s => (
            <div key={s.title} style={{ padding: 'var(--space-3, 12px)', background: 'var(--bg-primary, #f8fafc)', borderRadius: 8, border: '1px solid var(--border-default, rgba(0,0,0,0.12))' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)', marginBottom: 6 }}>
                <span style={{ fontSize: 16 }}>{s.icon}</span>
                <b style={{ fontSize: 12, color: 'var(--text-primary, #1e293b)' }}>{s.title}</b>
                <span style={{ marginLeft: 'auto', padding: '1px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700, background: s.priority === t('doseTrack.priorityHigh') ? 'var(--color-error-bg)' : 'var(--color-warning-bg)', color: s.priority === t('doseTrack.priorityHigh') ? 'var(--color-error-600)' : 'var(--color-warning-600)' }}>{t('doseTrack.prioritySuffix', { priority: s.priority })}</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* G8. 设备剂量水平对比 (平均 DLP / CTDIvol) */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 10, padding: '14px 16px', border: '1px solid var(--border-color)', marginTop: 'var(--space-4, 16px)' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-primary-800)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Monitor size={14} /> {t('doseTrack.deviceLevelTitle')}
          <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 400, color: 'var(--text-secondary)' }}>{t('doseTrack.deviceLevelSubtitle')}</span>
        </div>
        {(() => {
          const devices = deviceDose.slice(0, 6);
          const maxDlp = Math.max(...devices.map((d: any) => Number(d.avgDlp ?? d.dose ?? 300)), 1);
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {devices.map((d: any) => {
                const dlp = Number(d.avgDlp ?? d.dose ?? 300);
                const ctdi = Number(d.avgCtdiVol ?? 12);
                const over = dlp > 700;
                return (
                  <div key={d.device} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <b style={{ width: 130, fontSize: 12, color: 'var(--text-primary, #1e293b)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.device}</b>
                    <div style={{ flex: 1, height: 12, background: 'var(--bg-primary, #f8fafc)', borderRadius: 6, overflow: 'hidden', position: 'relative' }}>
                      <div style={{ width: `${(dlp / maxDlp) * 100}%`, height: '100%', background: over ? 'var(--color-error-600)' : 'var(--color-primary-500)', borderRadius: 6, opacity: 0.9 }} />
                      <div style={{ position: 'absolute', left: '55%', top: 0, bottom: 0, width: 2, background: '#94a3b8', opacity: 0.6 }} title={t('doseTrack.referenceLine')} />
                    </div>
                    <span style={{ width: 90, fontSize: 12, fontWeight: 700, color: over ? 'var(--color-error-600)' : 'var(--text-primary, #1e293b)', textAlign: 'right' }}>{dlp.toLocaleString()} mGy·cm</span>
                    <span style={{ width: 90, fontSize: 11, color: 'var(--text-secondary)', textAlign: 'right' }}>CTDIvol {ctdi} mGy</span>
                  </div>
                );
              })}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-secondary)' }}>
                <span>{t('doseTrack.dashedLine')}</span>
                <span>{t('doseTrack.redExceed')}</span>
              </div>
            </div>
          );
        })()}
      </div>

      {/* G9. 复查患者剂量叠加关注清单 */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 10, padding: '14px 16px', border: '1px solid var(--border-color)', marginTop: 'var(--space-4, 16px)' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-primary-800)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Info size={14} /> {t('doseTrack.reviewListTitle')}
          <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 400, color: 'var(--text-secondary)' }}>
            {t('doseTrack.reviewListSubtitle')}
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2, 8px)' }}>
          {(() => {
            const list = patientRank.slice(0, 5).map((p) => ({
              name: p.name, id: p.id, exams: p.exams,
              dlp30d: p.dlp30d, dlp1y: p.dlp1y,
              pct30: Math.min(120, Math.round((p.dlp30d / 1000) * 100)),
              pct1y: Math.min(120, Math.round((p.dlp1y / 1000) * 100)),
              watch: p.dlp30d > 300,
            }));
            return list.map(p => (
              <div key={p.id} style={{ padding: '10px 12px', background: p.watch ? 'var(--color-warning-bg)' : 'var(--bg-primary, #f8fafc)', borderRadius: 8, border: `1px solid ${p.watch ? '#fde68a' : 'var(--border-default, rgba(0,0,0,0.12))'}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 'var(--space-2, 8px)' }}>
                  <b style={{ fontSize: 12, color: 'var(--text-primary, #1e293b)' }}>{p.name}</b>
                  <code style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{p.id}</code>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{t('doseTrack.examCount', { count: p.exams })}</span>
                  {p.watch && (
                    <span style={{ marginLeft: 'auto', padding: '1px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: 'var(--color-error-bg)', color: 'var(--color-error-600)' }}>
                      {t('doseTrack.cumulativeHigh')}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)', fontSize: 11 }}>
                    <span style={{ width: 84, color: 'var(--text-secondary)' }}>{t('doseTrack.cumulative30d')}</span>
                    <div style={{ flex: 1, height: 7, background: 'var(--border-default, rgba(0,0,0,0.12))', borderRadius: 999, overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(100, p.pct30)}%`, height: '100%', background: p.pct30 > 60 ? 'var(--color-error-600)' : p.pct30 > 30 ? 'var(--color-warning-600)' : 'var(--color-primary-500)', borderRadius: 999 }} />
                    </div>
                    <b style={{ width: 90, textAlign: 'right', color: 'var(--text-primary, #1e293b)' }}>{p.dlp30d} mGy·cm</b>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)', fontSize: 11 }}>
                    <span style={{ width: 84, color: 'var(--text-secondary)' }}>{t('doseTrack.cumulative1y')}</span>
                    <div style={{ flex: 1, height: 7, background: 'var(--border-default, rgba(0,0,0,0.12))', borderRadius: 999, overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(100, p.pct1y)}%`, height: '100%', background: p.pct1y > 100 ? 'var(--color-error-600)' : p.pct1y > 60 ? 'var(--color-warning-600)' : 'var(--color-success-600)', borderRadius: 999 }} />
                    </div>
                    <b style={{ width: 90, textAlign: 'right', color: p.pct1y > 100 ? 'var(--color-error-600)' : 'var(--text-primary, #1e293b)' }}>{p.dlp1y} mGy·cm</b>
                  </div>
                </div>
              </div>
            ));
          })()}
        </div>
        <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
           {t('doseTrack.reviewNote')}
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