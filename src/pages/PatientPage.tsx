import { Card } from 'antd'
// v3.0.4 重构：拆分为子组件
// ============================================================
// G005 放射科RIS系统 - 患者管理 v1.0.0
// ============================================================
import { useState, useMemo, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { PageTemplate } from "../components/common/PageTemplate";
import { DataTable } from "../components/common/DataTable";
import { ActionButton } from "../components/common/ActionButton";
import { StatCard as CommonStatCard } from "../components/common/StatCard";
import { DashboardCard } from "../components/dashboard/DashboardCard";
import { TrendChart } from "../components/dashboard/TrendChart";
import { AppText } from "../components/common/AppText";
import { ErrorBanner, LoadingBanner } from "../components/feedback";
import { t } from '../i18n/appI18n';
import { Search, User, Phone, AlertCircle, X, Eye, Upload, Users, UserCheck, Clock, Activity, Heart, AlertTriangle, CheckCircle, TrendingUp, PieChart, Stethoscope, Shield, CreditCard, History, PlusCircle, UserPlus, Link, Target, Gauge, Percent, FileSearch, Layers3 } from 'lucide-react';
import { initialPatients, initialRadiologyExams } from "../data/initialData";
import { patientApi } from "../services/api";
import type { PatientImportRow, PatientOverviewDto, PatientAgeBucket } from "../services/api";
import type { Patient } from "../types";
import { useRBAC } from "../hooks/useRBAC";
import { useAuth } from "../hooks/useAuth";
import { PermissionGate } from "../components/common/PermissionGate";
import { FieldGate } from "../components/auth/FieldGate";
import {
  PatientSearchPanel,
  PatientTable,
  PatientDetailPanel,
  PatientCreateForm,
  RegistrationWizard,
} from "./patient";
import type {
  TabKey,
  GenderFilter,
  PatientTypeFilter,
  AdvancedFilters,
  PatientFormData,
  PMISearchResult,
  ToastInfo,
} from "./patient";
import { getPatientExams, findDuplicatePatients, searchPMIPatients, usePinyinSearch } from './patient';

// ==================== 子组件：统计卡片 (统一公共 StatCard) ====================
interface StatCardProps {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}

function StatCard({ label, value, icon, color, bgColor }: StatCardProps) {
  return (
    <CommonStatCard
      title={label}
      value={value}
      icon={icon}
      color={color}
      iconBg={bgColor}
      size="lg"
    />
  );
}

// ==================== 子组件：标签页按钮 ====================
interface TabButtonProps {
  tabKey: TabKey;
  label: string;
  icon: React.ReactNode;
  isActive: boolean;
  onClick: () => void;
  badge?: number | string;
}

function TabButton({ label, icon, isActive, onClick, badge }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 20px",
        border: "none",
        borderBottom: isActive ? "3px solid #1e40af" : "3px solid transparent",
        background: "none",
        cursor: "pointer",
        fontSize: 12,
        fontWeight: isActive ? 700 : 500,
        color: isActive ? "#1e40af" : "#64748b",
      }}
    >
      {icon}
      {label}
      {badge !== undefined && (
        <span
          style={{
            background: isActive ? "#1e40af" : "#e2e8f0",
            color: isActive ? "#fff" : "#64748b",
            borderRadius: 10,
            padding: "1px 6px",
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}
// ==================== 子组件：饼图 ====================
interface PieChartSimpleProps {
  data: { label: string; value: number; color: string }[];
  title: string;
}

function PieChartSimple({ data, title }: PieChartSimpleProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  return (
    <Card bordered={false}
      style={{
        background: "var(--bg-card)",
        borderRadius: 12,
        border: "1px solid var(--border-color)",
        padding: 20,
        boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
      }}
     styles={{ body: { padding: 0 } }}>
      <div
        style={{
          fontSize: 14,
          fontWeight: 700,
          color: "#1e40af",
          marginBottom: 16,
        }}
      >
        {title}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <div style={{ position: "relative", width: 120, height: 120 }}>
          <svg viewBox="0 0 100 100" style={{ transform: "rotate(-90deg)" }}>
            {data
              .reduce(
                (acc, d, _i) => {
                  const percent = total > 0 ? (d.value / total) * 100 : 0;
                  const prevPercent = acc.reduce(
                    (s, item) => s + (total > 0 ? item.percent : 0),
                    0,
                  );
                  acc.push({
                    ...d,
                    percent,
                    prevPercent,
                    dashArray: `${percent} ${100 - percent}`,
                  });
                  return acc;
                },
                [] as {
                  label: string;
                  value: number;
                  color: string;
                  percent: number;
                  prevPercent: number;
                  dashArray: string;
                }[],
              )
              .map((item, i) => {
                return (
                  <circle
                    key={i}
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke={item.color}
                    strokeWidth="12"
                    strokeDasharray={item.dashArray}
                    strokeDashoffset={100 - item.prevPercent}
                  />
                );
              })}
            <circle cx="50" cy="50" r="25" fill="#fff" />
          </svg>
        </div>
        <div style={{ flex: 1 }}>
          {data.map((d, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 3,
                  background: d.color,
                }}
              />
              <AppText size="xs" color="secondary" as="div" style={{ flex: 1 }}>
                {d.label}
              </AppText>
              <AppText size="xs" weight={700} as="div" style={{ color: "#1e40af" }}>
                {d.value}
              </AppText>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--text-secondary)",
                  width: 40,
                  textAlign: "right",
                }}
              >
                {total > 0 ? `${((d.value / total) * 100).toFixed(1)}%` : "0%"}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

// ==================== 子组件：柱状图 ====================
interface BarChartSimpleProps {
  data: { label: string; value: number; color: string }[];
  title: string;
  xLabel?: string;
}

function BarChartSimple({ data, title, xLabel }: BarChartSimpleProps) {
  const maxValue = Math.max(...data.map((d) => d.value), 1);
  return (
    <Card bordered={false}
      style={{
        background: "var(--bg-card)",
        borderRadius: 12,
        border: "1px solid var(--border-color)",
        padding: 20,
        boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
      }}
     styles={{ body: { padding: 0 } }}>
      <div
        style={{
          fontSize: 14,
          fontWeight: 700,
          color: "#1e40af",
          marginBottom: 16,
        }}
      >
        {title}
      </div>
      <div
        style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 140 }}
      >
        {data.map((d, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
            }}
          >
            <AppText size="xs" weight={700} as="div" style={{ color: "#1e40af" }}>
              {d.value}
            </AppText>
            <div
              style={{
                width: "100%",
                height: `${(d.value / maxValue) * 100}px`,
                background: d.color,
                borderRadius: "4px 4px 0 0",
                minHeight: 4,
              }}
            />
            <AppText size="xs" color="secondary" as="div" style={{ textAlign: "center" }}>
              {d.label}
            </AppText>
          </div>
        ))}
      </div>
      {xLabel && (
        <div
          style={{
            textAlign: "center",
            fontSize: 12,
            color: "var(--text-secondary)",
            marginTop: 8,
          }}
        >
          {xLabel}
        </div>
      )}
    </Card>
  );
}

// ==================== 主组件 ====================
export default function PatientPage() {
  const { checkAccess } = useRBAC();
  const { user } = useAuth();
  // [W2-4] 深链支持: /patients/:id 自动打开患者详情 (供 360°/报告/预约等模块回链)
  const { id: routePatientId } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<TabKey>("list");
  const [toast, setToast] = useState<ToastInfo>({
    show: false,
    type: "success",
    message: "",
  });
  useEffect(() => {
    if (toast.show) {
      const t = setTimeout(
        () => setToast((v) => ({ ...v, show: false })),
        3000,
      );
      return () => clearTimeout(t);
    }
    return undefined;
  }, [toast.show]);

  const [search, setSearch] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>({
    gender: "全部",
    ageMin: "",
    ageMax: "",
    patientType: "全部",
    dateFrom: "",
    dateTo: "",
    modality: "全部",
    diagnosisCategory: "全部",
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [selectedPatientForEdit, setSelectedPatientForEdit] =
    useState<Patient | null>(null);
  const [pageSize, setPageSize] = useState(20);
  const [pmiSearchQuery, setPmiSearchQuery] = useState("");
  const [pmiSearchResults, setPmiSearchResults] = useState<PMISearchResult[]>(
    [],
  );
  const [pmiSearchFocused, setPmiSearchFocused] = useState(false);
  const [pmiSelectedResult, setPmiSelectedResult] =
    useState<PMISearchResult | null>(null);
  const [showPMIPanel, setShowPMIPanel] = useState(false);

  // [W4-A] 批量导入导出
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    imported: number;
    skipped: number;
    errors: { index: number; message: string }[];
  } | null>(null);

  const [formData, setFormData] = useState<PatientFormData>({
    name: "",
    gender: "男",
    age: "",
    idCard: "",
    phone: "",
    address: "",
    emergencyContact: "",
    emergencyPhone: "",
    patientType: "门诊",
    insuranceType: "",
    allergyHistory: "",
    medicalHistory: "",
    bedNumber: "",
    attendingDoctor: "",
  });
  const [formErrors, setFormErrors] = useState<
    Partial<Record<keyof PatientFormData, string>>
  >({});

  const [selectedPatientIds, setSelectedPatientIds] = useState<Set<string>>(
    new Set(),
  );
  const [showRegistrationWizard, setShowRegistrationWizard] = useState(false);

  const [patients, setPatients] = useState<Patient[]>([]);
  const [exams] = useState(initialRadiologyExams);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);

  const [dismissedDuplicateIds, setDismissedDuplicateIds] = useState<
    Set<string>
  >(new Set());
  const duplicatePatients = useMemo(
    () => findDuplicatePatients(patients),
    [patients],
  );
  const visibleDuplicates = useMemo(
    () =>
      duplicatePatients.filter(
        (d) =>
          !dismissedDuplicateIds.has(d.patients?.[0]?.id ?? '') &&
          !dismissedDuplicateIds.has(d.patients?.[1]?.id ?? ''),
      ),
    [duplicatePatients, dismissedDuplicateIds],
  );

  const [filterPresets, setFilterPresets] = useState<
    Array<{ name: string; filters: AdvancedFilters }>
  >(() => {
    try {
      return JSON.parse(localStorage.getItem("patient-filter-presets") || "[]");
    } catch {
      return [];
    }
  });
  const [savePresetName, setSavePresetName] = useState("");
  const [showSavePreset, setShowSavePreset] = useState(false);

  const applyPreset = useCallback(
    (preset: { name: string; filters: AdvancedFilters }) => {
      setAdvancedFilters(preset.filters);
      setShowAdvanced(true);
    },
    [],
  );

  const saveCurrentPreset = useCallback(() => {
    if (!savePresetName.trim()) return;
    const newPresets = [
      ...filterPresets,
      { name: savePresetName.trim(), filters: { ...advancedFilters } },
    ];
    setFilterPresets(newPresets);
    localStorage.setItem("patient-filter-presets", JSON.stringify(newPresets));
    setSavePresetName("");
    setShowSavePreset(false);
  }, [savePresetName, advancedFilters, filterPresets]);

  const deletePreset = useCallback(
    (index: number) => {
      const newPresets = filterPresets.filter((_, i) => i !== index);
      setFilterPresets(newPresets);
      localStorage.setItem(
        "patient-filter-presets",
        JSON.stringify(newPresets),
      );
    },
    [filterPresets],
  );

  const pinyinSearched = usePinyinSearch(patients, search);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setAccessDenied(false);
      const canRead = checkAccess({
        resource: { type: "patient" },
        action: "read",
        environment: { time: new Date(), location: user?.department },
      });
      if (!canRead) {
        if (!cancelled) {
          setAccessDenied(true);
          setLoading(false);
        }
        return;
      }
      const res = await patientApi.list({});
      if (cancelled) return;
      // [G005 P1] 列表双形状兼容: MSW 裸数组 / 后端 { items, total }
      const list = Array.isArray(res.data) ? res.data : (res.data?.items ?? []);
      if (res.success && Array.isArray(list) && list.length > 0) {
        setPatients(list as Patient[]);
        setLoadError(null);
      } else {
        setPatients(initialPatients as unknown as Patient[]);
        setLoadError(t('patientPage.apiUnavailable'));
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [checkAccess, user?.department]);

  // ============================================================
  // [v3.0.6.11-104 Wave 2B] 患者统计: overview + age-distribution (真实 API, 失败回退演示)
  // ============================================================
  const DEMO_PATIENT_OVERVIEW: PatientOverviewDto = {
    total: 326,
    todayNew: 7,
    monthlyNew: 58,
    active: 42,
    activeRate: 12.9,
    typeDistribution: { OUTPATIENT: 262, INPATIENT: 38, EMERGENCY: 14, PHYSICAL: 12 },
    genderDistribution: { MALE: 168, FEMALE: 158 },
  }
  const DEMO_AGE_DIST: PatientAgeBucket[] = [
    { bucket: '0-17', count: 14, male: 8, female: 6 },
    { bucket: '18-30', count: 42, male: 20, female: 22 },
    { bucket: '31-45', count: 78, male: 41, female: 37 },
    { bucket: '46-60', count: 95, male: 50, female: 45 },
    { bucket: '61-75', count: 72, male: 38, female: 34 },
    { bucket: '76+', count: 25, male: 11, female: 14 },
  ]
  const [patientOverview, setPatientOverview] = useState<PatientOverviewDto>(DEMO_PATIENT_OVERVIEW)
  const [ageDistribution, setAgeDistribution] = useState<PatientAgeBucket[]>(DEMO_AGE_DIST)
  const [statsSource, setStatsSource] = useState<'real' | 'demo'>('demo')
  const [statsLoading, setStatsLoading] = useState(false)
  const [statsError, setStatsError] = useState<string | null>(null)

  const loadPatientStats = useCallback(async () => {
    setStatsLoading(true)
    setStatsError(null)
    try {
      const [ovRes, ageRes] = await Promise.allSettled([
        patientApi.overview(),
        patientApi.ageDistribution(),
      ])
      let anyReal = false
      if (ovRes.status === 'fulfilled' && ovRes.value.success && ovRes.value.data) {
        setPatientOverview(ovRes.value.data)
        anyReal = true
      }
      if (ageRes.status === 'fulfilled' && ageRes.value.success && Array.isArray(ageRes.value.data?.items)) {
        setAgeDistribution(ageRes.value.data.items)
        anyReal = true
      }
      setStatsSource(anyReal ? 'real' : 'demo')
    } catch (e) {
      setStatsSource('demo')
      setStatsError((e as Error)?.message ?? t('patientPage.apiUnavailable'))
    } finally {
      setStatsLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { void loadPatientStats() }, [loadPatientStats]);

  // [W2-4] 深链: /patients/:id → 自动选中并打开详情
  useEffect(() => {
    if (!routePatientId) return;
    let cancelled = false;
    void (async () => {
      const res = await patientApi.getById(routePatientId);
      if (cancelled || !res.success || !res.data) return;
      const d = res.data as unknown as Record<string, unknown>;
      const pType = String(d.patientType ?? d.type ?? "门诊");
      setSelectedPatient({
        id: String(d.id ?? d.patientId ?? routePatientId),
        name: String(d.name ?? d.patientName ?? ""),
        gender: (String(d.gender ?? "男").includes("女") ? "女" : "男") as Patient["gender"],
        age: Number(d.age ?? 0),
        idCard: String(d.idCard ?? ""),
        phone: String(d.phone ?? ""),
        address: String(d.address ?? ""),
        emergencyContact: String(d.emergencyContact ?? ""),
        emergencyPhone: String(d.emergencyPhone ?? ""),
        patientType: (["门诊", "住院", "体检", "急诊"].includes(pType) ? pType : "门诊") as Patient["patientType"],
        allergyHistory: String(d.allergyHistory ?? "无"),
        medicalHistory: String(d.medicalHistory ?? ""),
        registrationDate: String((d.registeredAt ?? d.registrationDate ?? "").toString()).slice(0, 10),
        totalExamCount: Number(d.totalExamCount ?? 0),
        insuranceType: String(d.insuranceType ?? ""),
        bedNumber: String(d.bedNumber ?? ""),
        attendingDoctor: String(d.attendingDoctor ?? ""),
      });
      setActiveTab("detail");
    })();
    return () => {
      cancelled = true;
    };
  }, [routePatientId]);

  const resetAdvancedFilters = () => {
    setAdvancedFilters({
      gender: "全部",
      ageMin: "",
      ageMax: "",
      patientType: "全部",
      dateFrom: "",
      dateTo: "",
      modality: "全部",
      diagnosisCategory: "全部",
    });
  };

  // 筛选逻辑
  const filteredPatients = useMemo(() => {
    const source = search ? pinyinSearched : patients;
    return source.filter((p) => {
      if (
        advancedFilters.gender !== "全部" &&
        p.gender !== advancedFilters.gender
      )
        return false;
      if (advancedFilters.ageMin && p.age < parseInt(advancedFilters.ageMin))
        return false;
      if (advancedFilters.ageMax && p.age > parseInt(advancedFilters.ageMax))
        return false;
      if (
        advancedFilters.patientType !== "全部" &&
        p.patientType !== advancedFilters.patientType
      )
        return false;
      if (
        advancedFilters.dateFrom &&
        p.registrationDate < advancedFilters.dateFrom
      )
        return false;
      if (advancedFilters.dateTo && p.registrationDate > advancedFilters.dateTo)
        return false;
      if (advancedFilters.modality !== "全部") {
        const patientExams = getPatientExams(p.id, exams);
        const hasModality = patientExams.some(
          (e) => e.modality === advancedFilters.modality,
        );
        if (!hasModality) return false;
      }
      if (advancedFilters.diagnosisCategory !== "全部") {
        const patientExams = getPatientExams(p.id, exams);
        const hasDiag = patientExams.some((e) => {
          const diag = (e.clinicalDiagnosis || "").toLowerCase();
          const map: Record<string, string[]> = {
            呼吸系统: [
              "肺",
              "支气管",
              "气管",
              "胸膜",
              "咳嗽",
              "咳痰",
              "肺炎",
              "结核",
              "copd",
            ],
            消化系统: [
              "胃",
              "肠",
              "肝",
              "胆",
              "脾",
              "胰",
              "食管",
              "腹痛",
              "消化",
            ],
            骨骼肌肉: [
              "骨",
              "关节",
              "脊柱",
              "骨折",
              "腰",
              "颈",
              "肌肉",
              "韧带",
            ],
            神经系统: [
              "脑",
              "神经",
              "头",
              "中风",
              "癫痫",
              "帕金森",
              "阿尔茨海默",
            ],
            心血管: [
              "心",
              "血管",
              "冠脉",
              "冠脉cta",
              "高血压",
              "冠心病",
              "动脉",
            ],
            肿瘤: ["瘤", "癌", "恶性", "良性", "转移", "肿块", "占位", "结节"],
          };
          const keywords = map[advancedFilters.diagnosisCategory] || [];
          return keywords.some((k) => diag.includes(k));
        });
        if (!hasDiag) return false;
      }
      return true;
    });
  }, [search, advancedFilters, pinyinSearched, patients, exams]);

  // 分页
  const totalPages = Math.max(1, Math.ceil(filteredPatients.length / pageSize));
  const paginatedPatients = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredPatients.slice(start, start + pageSize);
  }, [filteredPatients, currentPage, pageSize]);

  // 统计
  const statistics = useMemo(() => {
    const totalPatients = patients.length;
    const inpatients = patients.filter((p) => p.patientType === "住院").length;
    const outpatients = patients.filter((p) => p.patientType === "门诊").length;
    const healthCheck = patients.filter((p) => p.patientType === "体检").length;
    const emergency = patients.filter((p) => p.patientType === "急诊").length;
    const males = patients.filter((p) => p.gender === "男").length;
    const females = patients.filter((p) => p.gender === "女").length;
    const withAllergy = patients.filter(
      (p) => p.allergyHistory && p.allergyHistory !== "无",
    ).length;
    const todayNew = 3;

    const ageGroups = [
      { label: "0-18", value: 0, color: "#3b82f6" },
      { label: "19-35", value: 0, color: "#8b5cf6" },
      { label: "36-50", value: 0, color: "#06b6d4" },
      { label: "51-65", value: 0, color: "#f59e0b" },
      { label: "65+", value: 0, color: "#ef4444" },
    ];
    patients.forEach((p) => {
      if (p.age <= 18) ageGroups[0]!.value++;
      else if (p.age <= 35) ageGroups[1]!.value++;
      else if (p.age <= 50) ageGroups[2]!.value++;
      else if (p.age <= 65) ageGroups[3]!.value++;
      else ageGroups[4]!.value++;
    });

    const typeDistribution = [
      { label: t("w9c.patient.typeOutpatient"), value: outpatients, color: "#3b82f6" },
      { label: t("w9c.patient.typeInpatient"), value: inpatients, color: "#8b5cf6" },
      { label: t("w9c.patient.typePhysical"), value: healthCheck, color: "#06b6d4" },
      { label: t("w9c.patient.typeEmergency"), value: emergency, color: "#f59e0b" },
    ];
    const genderDistribution = [
      { label: t("w9c.patient.genderMale"), value: males, color: "#3b82f6" },
      { label: t("w9c.patient.genderFemale"), value: females, color: "#ec4899" },
    ];
    const returnRate = (
      (patients.filter((p) => p.totalExamCount > 1).length / totalPatients) *
      100
    ).toFixed(1);

    const examFrequency: { label: string; value: number; color: string }[] = [];
    const freqMap: Record<number, number> = {};
    patients.forEach((p) => {
      const c = p.totalExamCount || 1;
      freqMap[c] = (freqMap[c] || 0) + 1;
    });
    const colors = ["#3b82f6", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b"];
    Object.keys(freqMap)
      .sort((a, b) => parseInt(a) - parseInt(b))
      .forEach((key, i) => {
        examFrequency.push({
          label: t("w9c.patient.examTimesLabel", { count: key }),
          value: freqMap[parseInt(key)]!,
          color: colors[i % colors.length]!,
        });
      });

    return {
      totalPatients,
      inpatients,
      outpatients,
      healthCheck,
      emergency,
      males,
      females,
      withAllergy,
      todayNew,
      ageGroups,
      typeDistribution,
      genderDistribution,
      returnRate,
      examFrequency,
    };
  }, [patients]);

  // 表单验证
  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof PatientFormData, string>> = {};
    if (!formData.name.trim()) errors.name = t('patientPage.errNameRequired');
    if (!formData.idCard.trim()) errors.idCard = t('patientPage.errIdCardRequired');
    else if (formData.idCard.length !== 18)
      errors.idCard = t('patientPage.errIdCardFormat');
    if (!formData.phone.trim()) errors.phone = t('patientPage.errPhoneRequired');
    else if (!/^1[3-9]\d{9}$/.test(formData.phone))
      errors.phone = t('patientPage.errPhoneFormat');
    if (!formData.emergencyContact.trim())
      errors.emergencyContact = t('patientPage.errContactNameRequired');
    if (!formData.emergencyPhone.trim())
      errors.emergencyPhone = t('patientPage.errContactPhoneRequired');
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSavePatient = () => {
    if (!validateForm()) return;
    setToast({ show: true, type: "success", message: t('patientPage.saveSuccess') });
    setActiveTab("list");
    setSelectedPatientForEdit(null);
  };

  const handleNewPatient = () => {
    setSelectedPatientForEdit(null);
    setFormData({
      name: "",
      gender: "男",
      age: "",
      idCard: "",
      phone: "",
      address: "",
      emergencyContact: "",
      emergencyPhone: "",
      patientType: "门诊",
      insuranceType: "",
      allergyHistory: "",
      medicalHistory: "",
      bedNumber: "",
      attendingDoctor: "",
    });
    setFormErrors({});
    setActiveTab("form");
  };

  const handleEditPatient = (patient: Patient) => {
    setSelectedPatientForEdit(patient);
    setFormData({
      name: patient.name,
      gender: patient.gender as GenderFilter,
      age: String(patient.age),
      idCard: patient.idCard,
      phone: patient.phone,
      address: patient.address,
      emergencyContact: patient.emergencyContact,
      emergencyPhone: patient.emergencyPhone,
      patientType: patient.patientType as PatientTypeFilter,
      insuranceType: patient.insuranceType || "",
      allergyHistory: patient.allergyHistory,
      medicalHistory: patient.medicalHistory,
      bedNumber: patient.bedNumber || "",
      attendingDoctor: patient.attendingDoctor || "",
    });
    setFormErrors({});
    setActiveTab("form");
  };

  const handleViewPatient = (patient: Patient) => {
    setSelectedPatient(patient);
    setActiveTab("detail");
  };

  // [Wave1B P2] 删除患者: patientApi.delete → 本地移除 + 刷新列表
  const handleDeletePatient = async (patient: Patient) => {
    try {
      const res = await patientApi.delete(patient.id);
      if (!res.success) throw new Error(res.error?.message ?? t('patientPage.deleteFailed'));
      setToast({ show: true, type: "success", message: t('patientPage.deleteSuccess', { name: patient.name }) });
      setPatients((prev) => prev.filter((p) => p.id !== patient.id));
      if (selectedPatient?.id === patient.id) {
        setSelectedPatient(null);
        setActiveTab("list");
      }
      void (async () => {
        const r = await patientApi.list({});
        const list = Array.isArray(r.data) ? r.data : (r.data?.items ?? []);
        if (r.success && Array.isArray(list) && list.length > 0) setPatients(list as Patient[]);
      })();
    } catch (e) {
      setToast({ show: true, type: "error", message: (e as Error)?.message ?? t('patientPage.deleteFailed') });
    }
  };

  const handleExport = async () => {
    // [W4-A] 优先走后端 CSV 导出, 失败时回退本地导出
    try {
      const res = await patientApi.exportPatients({});
      if (res.success && res.data?.content) {
        const blob = new Blob([res.data.content], {
          type: "text/csv;charset=utf-8",
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = res.data.filename || `患者列表_${new Date().toISOString().split("T")[0]}.csv`;
        link.click();
        URL.revokeObjectURL(url);
        setToast({ show: true, type: "success", message: t('patientPage.exportedCount', { count: res.data.count }) });
        return;
      }
      throw new Error(res.error?.message ?? t('patientPage.exportFailed'));
    } catch {
      const csvContent = [
        [
          t('patientPage.patientId'),
          t('patientPage.name'),
          t('patientPage.gender'),
          t('patientPage.age'),
          t('patientPage.idCard'),
          t('patientPage.phone'),
          t('patientPage.type'),
          t('patientPage.allergyHistory'),
          t('patientPage.registrationDate'),
          t('patientPage.cumulativeExam'),
        ].join(","),
        ...filteredPatients.map((p) =>
          [
            p.id,
            p.name,
            p.gender,
            p.age,
            p.idCard,
            p.phone,
            p.patientType,
            p.allergyHistory,
            p.registrationDate,
            p.totalExamCount,
          ].join(","),
        ),
      ].join("\n");
      const blob = new Blob(["\ufeff" + csvContent], {
        type: "text/csv;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `患者列表_${new Date().toISOString().split("T")[0]}.csv`;
      link.click();
      setToast({ show: true, type: "success", message: t('patientPage.exportedCountLocal', { count: filteredPatients.length }) });
    }
  };

  // [W4-A] 导入文本解析: JSON 数组 或 CSV (表头: 姓名/性别/年龄/身份证/电话/类型)
  const parseImportText = (text: string): PatientImportRow[] => {
    const trimmed = text.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("[")) {
      try {
        const arr = JSON.parse(trimmed);
        return Array.isArray(arr) ? (arr as PatientImportRow[]) : [];
      } catch {
        return [];
      }
    }
    const lines = trimmed.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return [];
    const header = lines[0]!.split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
    return lines.slice(1).map((line) => {
      const cells = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
      const row: Record<string, string> = {};
      header.forEach((h, i) => {
        row[h] = cells[i] ?? "";
      });
      return row as unknown as PatientImportRow;
    });
  };

  const handleImportFile = (file: File) => {
    void file.text().then((text) => setImportText(text));
  };

  const handleImportSubmit = async () => {
    const rows = parseImportText(importText);
    if (rows.length === 0) {
      setToast({ show: true, type: "error", message: t('patientPage.importNotParsed') });
      return;
    }
    setImporting(true);
    setImportResult(null);
    try {
      const res = await patientApi.importPatients(rows);
      if (res.success && res.data) {
        setImportResult(res.data);
        setToast({
          show: true,
          type: res.data.errors.length > 0 ? "info" : "success",
          message: `${t('patientPage.importComplete')} ${res.data.imported} / ${t('patientPage.importSkip')} ${res.data.skipped} / ${t('patientPage.importFail')} ${res.data.errors.length}`,
        });
      } else {
        setToast({ show: true, type: "error", message: res.error?.message ?? t('patientPage.importFail') });
      }
    } catch (e) {
      setToast({ show: true, type: "error", message: t('patientPage.importError') + ": " + ((e as Error)?.message ?? String(e)) });
    } finally {
      setImporting(false);
      void (async () => {
        const r = await patientApi.list({});
        const list = Array.isArray(r.data) ? r.data : (r.data?.items ?? []);
        if (r.success && Array.isArray(list) && list.length > 0) setPatients(list as Patient[]);
      })();
    }
  };

  // PMI 搜索处理
  const handlePMISearch = (query: string) => {
    setPmiSearchQuery(query);
    setPmiSearchResults(query.trim() ? searchPMIPatients(query) : []);
  };

  const handlePMISelectResult = (result: PMISearchResult) => {
    setPmiSelectedResult(result);
    const patient = patients.find((p) => p.id === result.patientId);
    if (patient) {
      setSelectedPatient(patient);
      setActiveTab("detail");
    }
    setPmiSearchQuery("");
    setPmiSearchResults([]);
    setPmiSearchFocused(false);
  };

  const handleClosePMIPanel = () => {
    setPmiSelectedResult(null);
    setShowPMIPanel(false);
  };

  // PMI搜索面板
  const renderPMISearchPanel = () => (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.4)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClosePMIPanel();
      }}
    >
      <div
        style={{
          background: "var(--bg-card)",
          borderRadius: 16,
          width: "100%",
          maxWidth: 900,
          maxHeight: "90vh",
          overflow: "hidden",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid var(--border-color)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "linear-gradient(135deg, #1e40af, #3b82f6)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Target size={24} color="#fff" />
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>
                {t('patientPage.pmiSearchTitle')}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "rgba(255,255,255,0.7)",
                  marginTop: 2,
                }}
              >
                {t('patientPage.pmiSearchSubtitle')}
              </div>
            </div>
          </div>
          <button
            onClick={handleClosePMIPanel}
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              border: "none",
              background: "rgba(255,255,255,0.2)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={18} color="#fff" />
          </button>
        </div>
        <div
          style={{
            padding: 20,
            borderBottom: "1px solid var(--border-color)",
            background: "var(--content-bg)",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 12,
              background: "var(--bg-card)",
              borderRadius: 10,
              border: "2px solid #1e40af",
              boxShadow: pmiSearchFocused ? "0 0 0 4px rgba(30,64,175,0.18)" : "none",
              transition: "box-shadow 0.15s",
              padding: "12px 16px",
            }}
          >
            <Search size={20} style={{ color: "#1e40af", flexShrink: 0 }} />
            <FieldGate field="patientName" permission="patient.view" resourceType="patient" mode="disable">
              <input
                value={pmiSearchQuery}
                onChange={(e) => handlePMISearch(e.target.value)}
                onFocus={() => setPmiSearchFocused(true)}
                onBlur={() => setPmiSearchFocused(false)}
                placeholder={t("patientPage.pmiSearchPlaceholder")}
                autoFocus
                style={{
                  flex: 1,
                  border: "none", fontSize: 14,
                  background: "transparent",
                }}
              />
            </FieldGate>
            {pmiSearchQuery && (
              <button
                onClick={() => {
                  setPmiSearchQuery("");
                  setPmiSearchResults([]);
                }}
                style={{
                  border: "none",
                  background: "var(--content-bg)",
                  borderRadius: 6,
                  padding: "4px 8px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <X size={14} color="var(--text-secondary)" />
              </button>
            )}
          </div>
          <div
            style={{
              fontSize: 12,
              color: "var(--text-secondary)",
              marginTop: 8,
              display: "flex",
              gap: 16,
            }}
          >
            <span>{t('patientPage.pmiSupportFuzzy')}</span>
            <span>·</span>
            <span>{t('patientPage.pmiFields')}</span>
            <span>·</span>
            <span>{t('patientPage.pmiShowConfidence')}</span>
          </div>
        </div>
        <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
          {pmiSearchResults.length === 0 && pmiSearchQuery && (
            <div style={{ textAlign: "center", padding: 40, color: "var(--text-secondary)" }}>
              <Search size={32} color="#cbd5e1" style={{ marginBottom: 8 }} />
              <div>{t('patientPage.pmiNoResult')}</div>
            </div>
          )}
          {pmiSearchResults.length === 0 && !pmiSearchQuery && (
            <div style={{ textAlign: "center", padding: 40, color: "var(--text-secondary)" }}>
              <FileSearch
                size={32}
                color="#cbd5e1"
                style={{ marginBottom: 8 }}
              />
              <div>{t('patientPage.pmiEmptyHint')}</div>
            </div>
          )}
          {pmiSearchResults.map((result) => (
            <div
              key={result.patientId}
              onClick={() => handlePMISelectResult(result)}
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border-color)",
                borderRadius: 10,
                padding: 16,
                marginBottom: 12,
                cursor: "pointer",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLDivElement).style.borderColor =
                  "#1e40af")
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLDivElement).style.borderColor =
                  "var(--border-color)")
              }
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    background:
                      result.gender === "男"
                        ? "linear-gradient(135deg, #1e40af, #3b82f6)"
                        : "linear-gradient(135deg, #be185d, #ec4899)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 18,
                    fontWeight: 700,
                    color: "#fff",
                    flexShrink: 0,
                  }}
                >
                  {result.name.slice(0, 1)}
                </div>
                <div style={{ flex: 1 }}>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <span
                      style={{
                        fontSize: 16,
                        fontWeight: 700,
                        color: "#1e40af",
                      }}
                    >
                      {result.name}
                    </span>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: 4,
                        fontSize: 12,
                        fontWeight: 600,
                        background:
                          result.gender === "男" ? "#dbeafe" : "#fce7f3",
                        color: result.gender === "男" ? "#1e40af" : "#be185d",
                      }}
                    >
                      {result.gender} · {result.age}{t('patientPage.ageUnit')}
                    </span>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: 4,
                        fontSize: 12,
                        fontWeight: 600,
                        background: "var(--content-bg)",
                        color: "var(--text-secondary)",
                      }}
                    >
                      {result.patientType}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                    {result.idCard} · {result.phone}
                  </div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div
                    style={{
                      fontSize: 30,
                      fontWeight: 700,
                      color:
                        result.confidence >= 90
                          ? "#16a34a"
                          : result.confidence >= 70
                            ? "#f59e0b"
                            : "#dc2626",
                    }}
                  >
                    {result.confidence}%
                  </div>
                  <AppText size="xs" color="secondary" as="div">{t('patientPage.matchConfidence')}</AppText>
                </div>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gap: 10,
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    padding: "8px 10px",
                    background: "var(--content-bg)",
                    borderRadius: 6,
                  }}
                >
                  <AppText size="xs" color="secondary" as="div" style={{ marginBottom: 2 }}>
                    {t('patientPage.pmiIndexId')}
                  </AppText>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#1e40af",
                      fontFamily: "monospace",
                    }}
                  >
                    {result.pmiId}
                  </div>
                </div>
                <div
                  style={{
                    padding: "8px 10px",
                    background: "var(--content-bg)",
                    borderRadius: 6,
                  }}
                >
                  <AppText size="xs" color="secondary" as="div" style={{ marginBottom: 2 }}>
                    {t('patientPage.insuranceType')}
                  </AppText>
                  <div
                    style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}
                  >
                    {result.insuranceType}
                  </div>
                </div>
                <div
                  style={{
                    padding: "8px 10px",
                    background: "var(--content-bg)",
                    borderRadius: 6,
                  }}
                >
                  <AppText size="xs" color="secondary" as="div" style={{ marginBottom: 2 }}>
                    {t('patientPage.cumulativeExam')}
                  </AppText>
                  <div
                    style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}
                  >
                    {result.examStats.totalExams} {t('patientPage.timesUnit')}
                  </div>
                </div>
                <div
                  style={{
                    padding: "8px 10px",
                    background: "var(--content-bg)",
                    borderRadius: 6,
                  }}
                >
                  <AppText size="xs" color="secondary" as="div" style={{ marginBottom: 2 }}>
                    {t('patientPage.positiveRate')}
                  </AppText>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color:
                        result.examStats.positiveRate > 30
                          ? "#dc2626"
                          : "#16a34a",
                    }}
                  >
                    {result.examStats.positiveRate}%
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    flex: 1,
                  }}
                >
                  <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    {t('patientPage.matchFields')}
                  </span>
                  {result.matchFields.map((f) => (
                    <span
                      key={f}
                      style={{
                        padding: "2px 6px",
                        borderRadius: 3,
                        fontSize: 12,
                        fontWeight: 600,
                        background: "var(--color-info-bg)",
                        color: "#2563eb",
                      }}
                    >
                      {f}
                    </span>
                  ))}
                </div>
                {result.hasMergeHistory && (
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <Link size={12} color="#f59e0b" />
                    <AppText size="xs" weight={600} color="warning" as="span">
                      {t('patientPage.hasMergeHistory')}
                    </AppText>
                  </div>
                )}
              </div>
              {result.hasMergeHistory && (
                <div
                  style={{
                    marginTop: 12,
                    padding: 12,
                    background: "var(--color-warning-bg)",
                    borderRadius: 8,
                    border: "1px solid #fde68a",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      marginBottom: 8,
                    }}
                  >
                    <History size={14} color="#f59e0b" />
                    <AppText size="xs" weight={700} as="span" style={{ color: "#92400e" }}>
                      {t('patientPage.patientMergeHistory')}
                    </AppText>
                  </div>
                  {result.mergeHistory.map((m, i) => (
                    <div
                      key={i}
                      style={{
                        fontSize: 12,
                        color: "#92400e",
                        marginBottom: 4,
                      }}
                    >
                      {m.mergedDate} · {m.reason}
                      {m.mergedFromId && (
                        <span style={{ marginLeft: 8 }}>
                          {t('patientPage.mergedFrom', { id: m.mergedFromId })}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // PMI患者基本信息卡片
  const renderPMIPatientCard = (result: PMISearchResult) => (
    <Card bordered={false}
      style={{
        background: "var(--bg-card)",
        borderRadius: 12,
        border: "1px solid var(--border-color)",
        padding: 20,
        boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
      }}
     styles={{ body: { padding: 0 } }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background:
                result.gender === "男"
                  ? "linear-gradient(135deg, #1e40af, #3b82f6)"
                  : "linear-gradient(135deg, #be185d, #ec4899)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20,
              fontWeight: 700,
              color: "#fff",
            }}
          >
            {result.name.slice(0, 1)}
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#1e40af" }}>
              {result.name}
            </div>
            <AppText size="xs" color="secondary" as="div" style={{ marginTop: 2 }}>
              {result.gender} · {result.age}{t('patientPage.ageUnit')} · {result.patientType}
            </AppText>
            <div
              style={{
                fontSize: 12,
                color: "var(--text-secondary)",
                marginTop: 2,
                fontFamily: "monospace",
              }}
            >
              {result.pmiId}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                fontSize: 30,
                fontWeight: 700,
                color:
                  result.confidence >= 90
                    ? "#16a34a"
                    : result.confidence >= 70
                      ? "#f59e0b"
                      : "#dc2626",
              }}
            >
              {result.confidence}%
            </div>
            <AppText size="xs" color="secondary" as="div">{t('patientPage.matchConfidence')}</AppText>
          </div>
          <button
            onClick={handleClosePMIPanel}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: "1px solid var(--border-color)",
              background: "var(--bg-card)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={16} color="var(--text-secondary)" />
          </button>
        </div>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div style={{ padding: 12, background: "var(--content-bg)", borderRadius: 8 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 4,
            }}
          >
            <CreditCard size={14} color="var(--text-secondary)" />
            <AppText size="xs" color="secondary" as="span">{t('patientPage.idCard')}</AppText>
          </div>
          <AppText size="xs" color="secondary" as="div" style={{ fontFamily: "monospace" }}>
            {result.idCard}
          </AppText>
        </div>
        <div style={{ padding: 12, background: "var(--content-bg)", borderRadius: 8 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 4,
            }}
          >
            <Phone size={14} color="var(--text-secondary)" />
            <AppText size="xs" color="secondary" as="span">{t('patientPage.phone')}</AppText>
          </div>
          <AppText size="xs" color="secondary" as="div">{result.phone}</AppText>
        </div>
        <div style={{ padding: 12, background: "var(--content-bg)", borderRadius: 8 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 4,
            }}
          >
            <Shield size={14} color="var(--text-secondary)" />
            <AppText size="xs" color="secondary" as="span">{t('patientPage.insuranceType')}</AppText>
          </div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            {result.insuranceType}
          </div>
        </div>
        <div style={{ padding: 12, background: "var(--content-bg)", borderRadius: 8 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 4,
            }}
          >
            <User size={14} color="var(--text-secondary)" />
            <AppText size="xs" color="secondary" as="span">{t('patientPage.visitType')}</AppText>
          </div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            {result.patientType}
          </div>
        </div>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 12,
        }}
      >
        <div
          style={{
            padding: 16,
            background: "var(--color-info-bg)",
            borderRadius: 10,
            textAlign: "center",
          }}
        >
          <Gauge size={24} color="#3b82f6" style={{ marginBottom: 8 }} />
          <div style={{ fontSize: 30, fontWeight: 700, color: "#1e40af" }}>
            {result.examStats.totalExams}
          </div>
          <AppText size="xs" color="secondary" as="div">{t('patientPage.totalExamTimes')}</AppText>
        </div>
        <div
          style={{
            padding: 16,
            background: "var(--color-success-bg)",
            borderRadius: 10,
            textAlign: "center",
          }}
        >
          <Percent size={24} color="#16a34a" style={{ marginBottom: 8 }} />
          <div
            style={{
              fontSize: 30,
              fontWeight: 700,
              color: result.examStats.positiveRate > 30 ? "#dc2626" : "#16a34a",
            }}
          >
            {result.examStats.positiveRate}%
          </div>
          <AppText size="xs" color="secondary" as="div">{t('patientPage.positiveRate')}</AppText>
        </div>
        <div
          style={{
            padding: 16,
            background: "var(--content-bg)",
            borderRadius: 10,
            textAlign: "center",
          }}
        >
          <Clock size={24} color="var(--text-secondary)" style={{ marginBottom: 8 }} />
          <div style={{ fontSize: 14, fontWeight: 700, color: "#1e40af" }}>
            {result.examStats.lastExamDate}
          </div>
          <AppText size="xs" color="secondary" as="div">{t('patientPage.lastExamDate')}</AppText>
        </div>
      </div>
      {result.hasMergeHistory && (
        <div
          style={{
            marginTop: 16,
            padding: 16,
            background: "var(--color-warning-bg)",
            borderRadius: 10,
            border: "1px solid #fde68a",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 12,
            }}
          >
            <History size={16} color="#f59e0b" />
            <span style={{ fontSize: 14, fontWeight: 700, color: "#92400e" }}>
              {t('patientPage.patientMergeHistory')}
            </span>
            <span
              style={{
                padding: "2px 8px",
                borderRadius: 10,
                fontSize: 12,
                fontWeight: 600,
                background: "#f59e0b",
                color: "#fff",
              }}
            >
              {result.mergeHistory.length} {t('patientPage.recordsCount')}
            </span>
          </div>
          {result.mergeHistory.map((m, i) => (
            <div
              key={i}
              style={{
                padding: "10px 12px",
                background: "var(--bg-card)",
                borderRadius: 6,
                marginBottom: 8,
                border: "1px solid #fde68a",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 4,
                }}
              >
                <span
                  style={{ fontSize: 12, fontWeight: 600, color: "#92400e" }}
                >
                  {m.mergedDate}
                </span>
                <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  {m.reason}
                </span>
              </div>
              <AppText size="xs" color="secondary" as="div">
                {m.mergedFromId && (
                  <span>
                    {t('patientPage.mergedFromPrefix')}{" "}
                    <span style={{ fontFamily: "monospace", fontWeight: 600 }}>
                      {m.mergedFromId}
                    </span>{" "}
                    {t('patientPage.mergedFromSuffix')}
                  </span>
                )}
                {m.mergedToId && m.mergedToId !== result.patientId && (
                  <span>
                    {" "}
                    {t('patientPage.mergedToPrefix')}{" "}
                    <span style={{ fontFamily: "monospace", fontWeight: 600 }}>
                      {m.mergedToId}
                    </span>
                  </span>
                )}
              </AppText>
            </div>
          ))}
        </div>
      )}
    </Card>
  );

  // ==================== 渲染：标签页4 - 患者分析 ====================
  const renderPatientAnalytics = () => (
    <>
      {/* [v3.0.6.11-104 Wave 2B] 患者总览 (GET /patients/overview) */}
      <div style={{ marginBottom: 16 }}>
        <DashboardCard
          title={`${t("patientPage.overviewCard")} · ${statsSource === 'real' ? t("examPage.sourceRealApi") : t("examPage.sourceLocal")}`}
          icon={<Users size={14} />}
          extra={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {statsLoading && <span style={{ fontSize: 12, color: '#d97706' }}>{t("examPage.syncing")}</span>}
              <ActionButton
                action="refresh"
                size="compact"
                onClick={() => void loadPatientStats()}
              >
                {t("examPage.refresh")}
              </ActionButton>
            </div>
          }
          loading={statsLoading}
          error={statsError}
          skeletonRows={2}
          testId="patient-overview-card"
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
            <StatCard label={t("patientPage.overviewTotal")} value={patientOverview.total} icon={<Users size={22} />} color="#1e40af" bgColor="#eff6ff" />
            <StatCard label={t("patientPage.overviewTodayNew")} value={patientOverview.todayNew} icon={<PlusCircle size={22} />} color="#16a34a" bgColor="#f0fdf4" />
            <StatCard label={t("patientPage.overviewMonthlyNew")} value={patientOverview.monthlyNew} icon={<TrendingUp size={22} />} color="#0ea5e9" bgColor="#f0f9ff" />
            <StatCard label={t("patientPage.overviewActive")} value={patientOverview.active} icon={<Activity size={22} />} color="#8b5cf6" bgColor="#f5f3ff" />
            <StatCard label={t("patientPage.overviewActiveRate")} value={`${patientOverview.activeRate}%`} icon={<Percent size={22} />} color="#f59e0b" bgColor="#fffbeb" />
          </div>
        </DashboardCard>
      </div>

      {/* [v3.0.6.11-104 Wave 2B] 年龄分布 (GET /patients/age-distribution) */}
      <div style={{ marginBottom: 16 }}>
        <DashboardCard title={t("patientPage.ageDistributionStat")} icon={<PieChart size={14} />} testId="patient-age-distribution-card">
          <TrendChart
            type="bar"
            data={ageDistribution.map((b) => ({ bucket: b.bucket, total: b.count, male: b.male, female: b.female }))}
            xKey="bucket"
            series={[
              { key: 'total', name: t("patientPage.overviewTotal"), color: '#2563eb' },
              { key: 'male', name: t("patientPage.ageMale"), color: '#0891b2' },
              { key: 'female', name: t("patientPage.ageFemale"), color: '#db2777' },
            ]}
            height={220}
            testId="patient-age-distribution-chart"
          />
        </DashboardCard>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 16,
          marginBottom: 16,
        }}
      >
        <StatCard
          label={t("patientPage.totalPatients")}
          value={statistics.totalPatients}
          icon={<Users size={24} />}
          color="#1e40af"
          bgColor="#eff6ff"
        />
        <StatCard
          label={t("patientPage.outpatientPatients")}
          value={statistics.outpatients}
          icon={<UserCheck size={24} />}
          color="#3b82f6"
          bgColor="#eff6ff"
        />
        <StatCard
          label={t("patientPage.inpatientPatients")}
          value={statistics.inpatients}
          icon={<Activity size={24} />}
          color="#8b5cf6"
          bgColor="#f5f3ff"
        />
        <StatCard
          label={t("patientPage.todayNew")}
          value={statistics.todayNew}
          icon={<PlusCircle size={24} />}
          color="#16a34a"
          bgColor="#f0fdf4"
        />
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 16,
          marginBottom: 16,
        }}
      >
        <StatCard
          label={t("patientPage.checkupPatients")}
          value={statistics.healthCheck}
          icon={<Heart size={24} />}
          color="#06b6d4"
          bgColor="#ecfeff"
        />
        <StatCard
          label={t("patientPage.emergencyPatients")}
          value={statistics.emergency}
          icon={<AlertCircle size={24} />}
          color="#f59e0b"
          bgColor="#fffbeb"
        />
        <StatCard
          label={t("patientPage.withAllergy")}
          value={statistics.withAllergy}
          icon={<AlertTriangle size={24} />}
          color="#dc2626"
          bgColor="#fef2f2"
        />
        <StatCard
          label={t("patientPage.returnRate")}
          value={`${statistics.returnRate}%`}
          icon={<TrendingUp size={24} />}
          color="#0ea5e9"
          bgColor="#f0f9ff"
        />
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: 16,
          marginBottom: 16,
        }}
      >
        <PieChartSimple
          data={statistics.typeDistribution}
          title={t("patientPage.patientTypeDistribution")}
        />
        <PieChartSimple data={statistics.genderDistribution} title={t("patientPage.genderDistribution")} />
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: 16,
          marginBottom: 16,
        }}
      >
        <BarChartSimple
          data={statistics.ageGroups}
          title={t("patientPage.ageDistribution")}
          xLabel={t("patientPage.ageGroup")}
        />
        <BarChartSimple
          data={statistics.examFrequency}
          title={t("patientPage.examFrequency")}
          xLabel={t("patientPage.examTimes")}
        />
      </div>
      <Card bordered={false}
        style={{
          background: "var(--bg-card)",
          borderRadius: 12,
          border: "1px solid var(--border-color)",
          padding: 20,
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        }}
       styles={{ body: { padding: 0 } }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: "#1e40af",
            marginBottom: 16,
          }}
        >
          {t('patientPage.patientDetail')} (
          <span style={{ fontWeight: 400, color: "var(--text-secondary)" }}>
            {t('patientPage.clickToViewDetail')}
          </span>
          )
        </div>
        <DataTable<Patient>
          rowKey="id"
          loading={loading}
          onRow={(p: Patient) => ({
            style: { cursor: "pointer" },
            onClick: () => {
              setSelectedPatient(p);
              setActiveTab("detail");
            },
          })}
          columns={[
            { title: t('patientPage.patientId'), dataIndex: 'id', key: 'id', width: 130, sorter: (a: Patient, b: Patient) => a.id.localeCompare(b.id), render: (v: string) => <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-secondary)' }}>{v}</span> },
            { title: t('patientPage.name'), dataIndex: 'name', key: 'name', sorter: (a: Patient, b: Patient) => a.name.localeCompare(b.name), render: (v: string, p: Patient) => (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%',
                  background: p.gender === "男" ? "#dbeafe" : "#fce7f3",
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700,
                  color: p.gender === "男" ? "#1e40af" : "#be185d",
                }}>{v.slice(0, 1)}</div>
                <span style={{ fontWeight: 600, color: "#1e40af" }}>{v}</span>
              </div>
            ) },
            { title: t('patientPage.gender'), dataIndex: 'gender', key: 'gender', width: 80, align: 'center', render: (v: string) => (<span style={{ padding: "2px 6px", borderRadius: 4, fontSize: 12, fontWeight: 600, background: v === "男" ? "#dbeafe" : "#fce7f3", color: v === "男" ? "#1e40af" : "#be185d" }}>{v}</span>) },
            { title: t('patientPage.age'), dataIndex: 'age', key: 'age', width: 80, align: 'center', sorter: (a: Patient, b: Patient) => (a.age || 0) - (b.age || 0), render: (v: number) => <span style={{ color: "var(--text-secondary)" }}>{v}{t('patientPage.ageUnit')}</span> },
            { title: t('patientPage.type'), dataIndex: 'patientType', key: 'patientType', width: 90, align: 'center', render: (v: string) => (<span style={{ padding: "2px 6px", borderRadius: 4, fontSize: 12, fontWeight: 600, background: "var(--content-bg)", color: "var(--text-secondary)" }}>{v}</span>) },
            { title: t('patientPage.allergyHistory'), dataIndex: 'allergyHistory', key: 'allergyHistory', render: (v: string) => (v && v !== "无" ? (<span style={{ color: "#dc2626", fontWeight: 600, fontSize: 12 }}>{v}</span>) : (<span style={{ color: "var(--text-secondary)", fontSize: 12 }}>{t('patientPage.noAllergy')}</span>)) },
            { title: t('patientPage.cumulativeExam'), dataIndex: 'totalExamCount', key: 'totalExamCount', width: 100, align: 'center', sorter: (a: Patient, b: Patient) => (a.totalExamCount || 0) - (b.totalExamCount || 0), render: (v: number) => <span style={{ fontWeight: 600, color: "#1e40af" }}>{v || 0}</span> },
            { title: t('patientPage.lastExam'), dataIndex: 'lastExamDate', key: 'lastExamDate', width: 110, align: 'center', render: (v: string) => <span style={{ color: "var(--text-secondary)", fontSize: 12 }}>{v || "-"}</span> },
            { title: t('patientPage.actions'), key: 'actions', width: 150, render: (_: unknown, p: Patient) => (
              <div style={{ display: 'flex', gap: 4 }}>
                <ActionButton
                  action="refresh"
                  size="compact"
                  aria-label={t('patientPage.viewPatientAria', { name: p.name })}
                  onClick={(e) => { e.stopPropagation(); handleViewPatient(p); }}
                >
                  {t('patientPage.detail')}
                </ActionButton>
                <ActionButton
                  action="edit"
                  size="compact"
                  aria-label={t('patientPage.editPatientAria', { name: p.name })}
                  onClick={(e) => { e.stopPropagation(); handleEditPatient(p); }}
                >
                  {t('patientPage.edit')}
                </ActionButton>
              </div>
            ) },
          ]}
          dataSource={patients}
        />
      </Card>
    </>
  );

  // ==================== 主渲染 ====================
  return (
    <PageTemplate background="slate" maxWidth="standard" showHeader={false} loading={loading} error={loadError} testId="patient-page">
      {accessDenied && (
        <div
          style={{
            padding: 24,
            marginBottom: 16,
            background: "var(--color-error-bg)",
            border: "1px solid #fca5a5",
            color: "#7f1d1d",
            borderRadius: 8,
            fontSize: 14,
          }}
        >
          {t('patientPage.accessDenied')}
        </div>
      )}
      {loading && <LoadingBanner message={t('w9.states.loading')} />}
      {loadError && !loading && <ErrorBanner message={loadError} />}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
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
            <Stethoscope size={22} color="#1e40af" />
            {t('patientPage.patientManagement')}
          </h1>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0 }}>
            {t('patientPage.patientSubtitle')}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <ActionButton
            action="refresh"
            size="compact"
            icon={<Target size={14} />}
            onClick={() => setShowPMIPanel(true)}
          >
            {t('patientPage.pmiSearch')}
          </ActionButton>
          <ActionButton
            action="import"
            size="compact"
            onClick={() => setShowImportModal(true)}
          >
            {t('patientPage.batchImport')}
          </ActionButton>
          <ActionButton
            action="export"
            size="compact"
            onClick={() => void handleExport()}
          >
            {t('patientPage.export')}
          </ActionButton>
          <ActionButton
            action="create"
            size="compact"
            icon={<Layers3 size={14} />}
            style={{ background: "#059669", borderColor: "#059669" }}
            onClick={() => setShowRegistrationWizard(true)}
          >
            {t('patientPage.registrationWizard')}
          </ActionButton>
          <PermissionGate permission="patient.create">
            <ActionButton
              action="create"
              size="compact"
              icon={<UserPlus size={14} />}
              onClick={handleNewPatient}
            >
              {t('patientPage.newPatient')}
            </ActionButton>
          </PermissionGate>
        </div>
      </div>

      {toast.show && (
        <div
          style={{
            position: "fixed",
            top: 20,
            right: 20,
            zIndex: 9999,
            padding: "12px 20px",
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 500,
            background:
              toast.type === "success"
                ? "#059669"
                : toast.type === "error"
                  ? "#dc2626"
                  : "#2563eb",
            color: "#fff",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            display: "flex",
            alignItems: "center",
            gap: 8,
            animation: "fadeIn 0.3s ease",
          }}
        >
          {toast.type === "success" && <CheckCircle size={16} />}
          {toast.type === "error" && <AlertCircle size={16} />}
          {toast.type === "info" && <AlertTriangle size={16} />}
          {toast.message}
        </div>
      )}

      {activeTab === "list" && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 12,
            marginBottom: 16,
          }}
        >
          <StatCard
            label={t("patientPage.totalPatients")}
            value={statistics.totalPatients}
            icon={<Users size={22} />}
            color="#1e40af"
            bgColor="#eff6ff"
          />
          <StatCard
            label={t("patientPage.inpatientPatients")}
            value={statistics.inpatients}
            icon={<Activity size={22} />}
            color="#8b5cf6"
            bgColor="#f5f3ff"
          />
          <StatCard
            label={t("patientPage.todayNew")}
            value={statistics.todayNew}
            icon={<PlusCircle size={22} />}
            color="#16a34a"
            bgColor="#f0fdf4"
          />
          <StatCard
            label={t("patientPage.withAllergy")}
            value={statistics.withAllergy}
            icon={<AlertTriangle size={22} />}
            color="#dc2626"
            bgColor="#fef2f2"
          />
        </div>
      )}

      <div
        style={{
          display: "flex",
          gap: 4,
          borderBottom: "1px solid var(--border-color)",
          marginBottom: 16,
          background: "var(--bg-card)",
          borderRadius: "12px 12px 0 0",
          padding: "0 8px",
        }}
      >
        <TabButton
          tabKey="list"
          label={t("patientPage.patientList")}
          icon={<Users size={16} />}
          isActive={activeTab === "list"}
          onClick={() => setActiveTab("list")}
          badge={filteredPatients.length}
        />
        <TabButton
          tabKey="detail"
          label={t("patientPage.patientDetailTab")}
          icon={<Eye size={16} />}
          isActive={activeTab === "detail"}
          onClick={() => setActiveTab("detail")}
          badge={selectedPatient ? 1 : undefined}
        />
        <TabButton
          tabKey="form"
          label={t("patientPage.newOrEdit")}
          icon={<UserPlus size={16} />}
          isActive={activeTab === "form"}
          onClick={handleNewPatient}
        />
        <TabButton
          tabKey="analytics"
          label={t("patientPage.patientAnalytics")}
          icon={<PieChart size={16} />}
          isActive={activeTab === "analytics"}
          onClick={() => setActiveTab("analytics")}
        />
      </div>

      {activeTab === "list" && (
        <PatientSearchPanel
          search={search}
          onSearchChange={(v) => {
            setSearch(v);
            setCurrentPage(1);
          }}
          showAdvanced={showAdvanced}
          onToggleAdvanced={() => setShowAdvanced(!showAdvanced)}
          advancedFilters={advancedFilters}
          onAdvancedFiltersChange={setAdvancedFilters}
          onResetAdvancedFilters={resetAdvancedFilters}
          filterPresets={filterPresets}
          onApplyPreset={applyPreset}
          onSavePreset={saveCurrentPreset}
          onDeletePreset={deletePreset}
          showSavePreset={showSavePreset}
          savePresetName={savePresetName}
          onSavePresetNameChange={setSavePresetName}
          onToggleSavePreset={() => setShowSavePreset(!showSavePreset)}
        />
      )}

      <div>
        {activeTab === "list" && (
          <PatientTable
            patients={patients}
            paginatedPatients={paginatedPatients}
            filteredPatientsLength={filteredPatients.length}
            selectedPatientIds={selectedPatientIds}
            onSelectionChange={setSelectedPatientIds}
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={(s) => {
              setPageSize(s);
              setCurrentPage(1);
            }}
            onViewPatient={handleViewPatient}
            onEditPatient={handleEditPatient}
            onDeletePatient={handleDeletePatient}
            exams={exams}
            visibleDuplicates={visibleDuplicates}
            onDismissAllDuplicates={() =>
              setDismissedDuplicateIds(new Set(patients.map((p) => p.id)))
            }
            selectedPatient={selectedPatient}
            onSelectPatient={setSelectedPatient}
            onToast={setToast}
          />
        )}
        {activeTab === "detail" && (
          <PatientDetailPanel
            selectedPatient={selectedPatient}
            onBack={() => {
              setActiveTab("list");
              setSelectedPatient(null);
            }}
            onEdit={handleEditPatient}
            exams={exams}
          />
        )}
        {activeTab === "form" && (
          <PatientCreateForm
            selectedPatientForEdit={selectedPatientForEdit}
            formData={formData}
            formErrors={formErrors}
            onFormDataChange={setFormData}
            onSave={handleSavePatient}
            onCancel={() => {
              setActiveTab("list");
              setSelectedPatientForEdit(null);
            }}
          />
        )}
        {activeTab === "analytics" && renderPatientAnalytics()}
      </div>

      <RegistrationWizard
        open={showRegistrationWizard}
        onClose={() => setShowRegistrationWizard(false)}
        onComplete={(data) => {
          const newPatient: Patient = {
            id: `P${String(patients.length + 1).padStart(3, "0")}`,
            name: data.name,
            gender: data.gender as Patient["gender"],
            age: parseInt(data.age) || 0,
            phone: data.phone,
            idCard: data.idCard,
            address: data.address,
            emergencyContact: data.emergencyContact,
            emergencyPhone: data.emergencyPhone,
            patientType: data.patientType as Patient["patientType"],
            allergyHistory: data.allergyHistory,
            medicalHistory: data.medicalHistory,
            registrationDate: new Date().toISOString().split("T")[0]!,
            totalExamCount: 0,
            insuranceType: data.insuranceType,
            bedNumber: data.bedNumber,
            attendingDoctor: data.attendingDoctor,
          };
          setPatients((prev) => [newPatient, ...prev]);
          setToast({
            show: true,
            type: "success",
            message: t('patientPage.registerSuccessName', { name: newPatient.name }),
          });
        }}
      />

      {showPMIPanel && renderPMISearchPanel()}
      {pmiSelectedResult && !showPMIPanel && (
        <div style={{ marginTop: 16 }}>
          {renderPMIPatientCard(pmiSelectedResult)}
        </div>
      )}

      {/* [W4-A] 批量导入 Modal */}
      {showImportModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.45)",
            zIndex: 1001,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowImportModal(false);
          }}
        >
          <div
            style={{
              background: "var(--bg-card)",
              borderRadius: 14,
              width: "100%",
              maxWidth: 680,
              maxHeight: "90vh",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
            }}
          >
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid var(--border-color)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "#1e40af",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Upload size={18} color="#fff" />
                <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>
                  {t('patientPage.batchImportTitle')}
                </span>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                style={{
                  background: "rgba(255,255,255,0.15)",
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  padding: 5,
                }}
              >
                <X size={16} />
              </button>
            </div>
            <div style={{ padding: 20, overflowY: "auto", flex: 1 }}>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--text-secondary)",
                  marginBottom: 10,
                  lineHeight: 1.8,
                }}
                dangerouslySetInnerHTML={{ __html: t('patientPage.importHint') }}
              />
              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder={'[\n  { "name": "张三", "gender": "男", "age": 45, "idCard": "110101199001011234", "phone": "13800138000", "type": "门诊" }\n]'}
                rows={8}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "10px 12px",
                  border: "1px solid var(--border-color)",
                  borderRadius: 8,
                  fontSize: 12,
                  fontFamily: "monospace",
                  resize: "vertical", }}
              />
              <div style={{ marginTop: 10 }}>
                <label
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "8px 14px",
                    borderRadius: 8,
                    border: "1px solid var(--border-color)",
                    background: "var(--content-bg)",
                    fontSize: 12,
                    color: "var(--text-secondary)",
                    cursor: "pointer",
                  }}
                >
                  <Upload size={13} />
                  {t('patientPage.uploadFile')}
                  <input
                    type="file"
                    accept=".csv,.json,text/csv,application/json"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleImportFile(f);
                    }}
                  />
                </label>
              </div>
              {importResult && (
                <div
                  style={{
                    marginTop: 12,
                    borderRadius: 8,
                    padding: "12px 14px",
                    border: "1px solid",
                    borderColor: importResult.errors.length > 0 ? "#fde68a" : "#bbf7d0",
                    background: importResult.errors.length > 0 ? "#fffbeb" : "#f0fdf4",
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 700, color: importResult.errors.length > 0 ? "#92400e" : "#166534" }}>
                    {t('patientPage.importComplete')}: {t('patientPage.success')} {importResult.imported} / {t('patientPage.importSkip')} {importResult.skipped} / {t('patientPage.importFail')} {importResult.errors.length}
                  </div>
                  {importResult.errors.length > 0 && (
                    <div style={{ marginTop: 6, maxHeight: 120, overflowY: "auto" }}>
                      {importResult.errors.map((err, i) => (
                        <div key={i} style={{ fontSize: 12, color: "#d97706" }}>
                          • {err.message}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div
              style={{
                padding: "12px 20px",
                borderTop: "1px solid var(--border-color)",
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
              }}
            >
              <ActionButton action="cancel" onClick={() => setShowImportModal(false)}>
                {t('patientPage.close')}
              </ActionButton>
              <ActionButton
                action="import"
                loading={importing}
                disabled={importing || !importText.trim()}
                onClick={() => void handleImportSubmit()}
              >
                {importing ? t('patientPage.importing') : t('patientPage.startImport')}
              </ActionButton>
            </div>
          </div>
        </div>
      )}
    </PageTemplate>
  );
}
