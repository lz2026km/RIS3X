import { useState, useEffect } from "react";
import type { CSSProperties } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Syringe,
  Play,
  Monitor,
  Settings,
  List,
  ShieldCheck,
  ShieldAlert,
  FlaskConical,
  Clock,
  Plus,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Button, Tag, message } from "antd";
import { getInjectionWorkstationService } from "../../services/contrast";
import type {
  InjectionProtocol,
  InjectionRecord,
  InjectorDeviceStatus,
} from "../../services/contrast";
// [v3.0.6.11-104 Wave 3B] 对比剂安全闭环: 注射指令经 POST /contrast/injection (前置核查门禁), 失败回退本地演示
import { contrastSafetyApi } from "../../services/api/contrastSafetyApi";
import type {
  PreInjectionCheckResult,
  ContrastObservation,
  ContrastAllergyTestRecord,
  ContrastAllergyResult,
  ExtravasationEvent,
} from "../../services/api/contrastSafetyApi";
import { t } from "../../i18n/appI18n";
import { uniqueId } from "../../utils/uniqueId";
// [v3.0.6.11-105 Wave 2C] 国标指标联动: RQI-ICME-05 对比剂外渗发生率
import { RqiIndicatorLink } from "../../components/qc/RqiIndicatorLink";
import ExtravasationHandleModal from "../../components/contrast/ExtravasationHandleModal";
import { AppSelectField } from "../../components/common/AppSelectField";
// [v3.0.6.11-104 Wave 3D] 临床资料接入: eGFR 30-59 警告 + 注射前安全核查 + 介入操作核查 (独立子组件, 避开 Wave 3B 区块)
import ContrastDataSections from "./ContrastDataSections";
import { patientApi } from "../../services/api/patientApi";
import { examApi } from "../../services/api/examApi";

const svc = getInjectionWorkstationService();

const DEFAULT_PATIENT_ID = "P-DEMO";
const DEFAULT_EGFR_THRESHOLD = 30;
const BLOCKER_CODES: string[] = [
  "NO_CONSENT",
  "ALLERGY_POSITIVE",
  "EGFR_BELOW_THRESHOLD",
  "EGFR_MISSING",
  "WEIGHT_MISSING",
  "PREGNANCY",
  "IMPLANT_RISK",
];

const panelStyle: CSSProperties = {
  background: "var(--bg-card, #161b22)",
  border: "1px solid var(--border-default, #30363d)",
  borderRadius: 8,
  padding: "var(--space-4, 16px)",
};
const inputStyle: CSSProperties = {
  width: "100%",
  padding: "6px 10px",
  borderRadius: 4,
  border: "1px solid var(--border-default, #30363d)",
  background: "var(--bg-primary, #0d1117)",
  color: "var(--text-primary, #f0f6fc)",
  fontSize: 12,
  marginTop: "var(--space-1, 4px)",
  boxSizing: "border-box",
};

export default function ContrastInjectionWorkstationPage() {
  const [searchParams] = useSearchParams();
  const [protocols, setProtocols] = useState<InjectionProtocol[]>([]);
  const [records, setRecords] = useState<InjectionRecord[]>([]);
  const [device, setDevice] = useState<InjectorDeviceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedProtocol, setSelectedProtocol] = useState<string>("");
  const [patientId, setPatientId] = useState(DEFAULT_PATIENT_ID);
  const [patientName, setPatientName] = useState("");
  const [examId, setExamId] = useState<string | null>(null);
  const [examModality, setExamModality] = useState<string | null>(null);
  const [patientLoading, setPatientLoading] = useState(true);
  const [weight, setWeight] = useState<number | null>(null);
  const [egfr, setEgfr] = useState<number | null>(null);
  const [implantHistory, setImplantHistory] = useState<string | null>(null);
  const [weightSource, setWeightSource] = useState<
    "patient" | "manual" | "missing"
  >("missing");
  const [egfrSource, setEgfrSource] = useState<
    "patient" | "manual" | "missing"
  >("missing");
  const [batchNo, setBatchNo] = useState("");
  const [route, setRoute] = useState<"IV" | "IA" | "PO">("IV");
  const [calculatedParams, setCalculatedParams] = useState<{
    volumeMl: number;
    flowRateMls: number;
    rationale: string;
  } | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [injecting, setInjecting] = useState(false);

  // [Wave 3B] 注射前核查
  const [consentSigned, setConsentSigned] = useState(false);
  const [pregnant, setPregnant] = useState(false);
  const [preCheck, setPreCheck] = useState<PreInjectionCheckResult | null>(
    null,
  );
  const [checking, setChecking] = useState(false);

  // [Wave 3B] 过敏试验
  const [allergyHistory, setAllergyHistory] = useState<
    ContrastAllergyTestRecord[]
  >([]);
  const [showAllergyForm, setShowAllergyForm] = useState(false);
  const [allergySubmitting, setAllergySubmitting] = useState(false);
  const [allergyForm, setAllergyForm] = useState<{
    contrastType: string;
    result: ContrastAllergyResult;
    testedBy: string;
    notes: string;
  }>({
    contrastType: "",
    result: "negative",
    testedBy: "current-user",
    notes: "",
  });

  // [Wave 3B] 注射后留观
  const [injectionDone, setInjectionDone] = useState(false);
  const [observation, setObservation] = useState<ContrastObservation | null>(
    null,
  );
  const [nowTick, setNowTick] = useState(Date.now());
  const [startingObs, setStartingObs] = useState(false);
  const [doctorRelease, setDoctorRelease] = useState(false);
  const [recordForm, setRecordForm] = useState({ symptoms: "", action: "" });
  const [extraOpenEvents, setExtraOpenEvents] = useState<ExtravasationEvent[]>(
    [],
  );
  const [extraOpenLoading, setExtraOpenLoading] = useState(false);
  const [extraHandleTarget, setExtraHandleTarget] =
    useState<ExtravasationEvent | null>(null);

  const selectedProto = protocols.find((p) => p.id === selectedProtocol);
  const allergyResult: ContrastAllergyResult =
    allergyHistory[0]?.result ?? "unknown";
  const canInject = preCheck?.passed === true;
  const isMrExam =
    String(examModality ?? "").toUpperCase() === "MR" ||
    (selectedProto?.defaultForModality ?? []).includes("MR");
  const hasImplantRisk = isMrExam && Boolean(implantHistory?.trim());
  const weightMissing = weight === null || weight <= 0;
  const egfrMissing = egfr === null;

  const blockerLabel = (code: string): string =>
    BLOCKER_CODES.includes(code) ? t(`contrastSafety.blocker.${code}`) : code;

  const buildLocalCheck = (): PreInjectionCheckResult => {
    const blockers: string[] = [];
    if (!consentSigned) blockers.push("NO_CONSENT");
    if (allergyResult === "positive") blockers.push("ALLERGY_POSITIVE");
    if (weightMissing) blockers.push("WEIGHT_MISSING");
    if (egfrMissing) blockers.push("EGFR_MISSING");
    else if ((egfr as number) < DEFAULT_EGFR_THRESHOLD)
      blockers.push("EGFR_BELOW_THRESHOLD");
    if (pregnant) blockers.push("PREGNANCY");
    if (hasImplantRisk) blockers.push("IMPLANT_RISK");
    return {
      passed: blockers.length === 0,
      blockers,
      checks: [
        {
          key: "consent",
          passed: consentSigned,
          detail: consentSigned
            ? t("contrastSafety.consentSigned")
            : t("contrastSafety.blocker.NO_CONSENT"),
        },
        {
          key: "allergy",
          passed: allergyResult !== "positive",
          detail: t(`contrastSafety.result.${allergyResult}`),
        },
        {
          key: "weight",
          passed: !weightMissing,
          detail: weightMissing
            ? t("contrastWs.weightMissing")
            : `${weight} kg${weightSource === "manual" ? ` · ${t("contrastWs.manualEntry")}` : ""}`,
        },
        {
          key: "egfr",
          passed: !egfrMissing && (egfr as number) >= DEFAULT_EGFR_THRESHOLD,
          detail: egfrMissing
            ? t("contrastWs.egfrMissing")
            : `eGFR ${egfr} mL/min/1.73m² (≥${DEFAULT_EGFR_THRESHOLD})`,
        },
        {
          key: "pregnancy",
          passed: !pregnant,
          detail: pregnant ? t("contrastSafety.pregnant") : "—",
        },
        {
          key: "implant",
          passed: !hasImplantRisk,
          detail: !isMrExam
            ? "—"
            : hasImplantRisk
              ? `${t("contrastWs.implantWarning")}: ${implantHistory}`
              : t("w6Workflow.timeout.implantNone"),
        },
      ],
      threshold: DEFAULT_EGFR_THRESHOLD,
      allergyResult,
      evaluatedAt: new Date().toISOString(),
    };
  };

  const mergeWithLocalCheck = (
    result: PreInjectionCheckResult | null,
  ): PreInjectionCheckResult => {
    const local = buildLocalCheck();
    if (!result) return local;
    const blockers = Array.from(
      new Set([...(result.blockers ?? []), ...local.blockers]),
    );
    const checks = local.checks.map(
      (item) => result.checks?.find((c) => c.key === item.key) ?? item,
    );
    return {
      ...result,
      passed: result.passed && local.passed,
      blockers,
      checks,
    };
  };

  const loadExtraOpenEvents = async () => {
    setExtraOpenLoading(true);
    try {
      const res = await contrastSafetyApi.listExtravasations({
        status: "open",
        pageSize: 50,
      });
      if (res.success && res.data) {
        setExtraOpenEvents(res.data.items ?? []);
      }
    } catch {
      /* 外渗接口不可用时面板保持空态 */
    } finally {
      setExtraOpenLoading(false);
    }
  };

  useEffect(() => {
    void loadExtraOpenEvents();
  }, []);

  useEffect(() => {
    const run = async () => {
      const [p, r, d] = await Promise.all([
        svc.getProtocols(),
        svc.getInjectionHistory(),
        svc.getDeviceStatus(),
      ]);
      setProtocols(p);
      setRecords(r);
      setDevice(d);
      setLoading(false);
    };
    void run();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const resolvePatient = async () => {
      setPatientLoading(true);
      const pidParam =
        searchParams.get("patientId") ?? searchParams.get("pid") ?? "";
      const eidParam =
        searchParams.get("examId") ?? searchParams.get("exam") ?? "";
      const nextExamId = eidParam || null;
      let resolvedPatientId = pidParam;
      let canFetchPatient = Boolean(pidParam);
      let modality: string | null = null;
      if (eidParam) {
        try {
          const examRes = await examApi.getById(eidParam);
          if (examRes.success && examRes.data) {
            resolvedPatientId = String(
              examRes.data.patientId ?? resolvedPatientId,
            );
            canFetchPatient = Boolean(resolvedPatientId);
            modality = examRes.data.modality
              ? String(examRes.data.modality)
              : null;
          }
        } catch {
          /* 检查接口不可用: 使用 URL 患者或演示患者 */
        }
      }
      if (!resolvedPatientId) {
        try {
          const listRes = await patientApi.list({ pageSize: 1 });
          const first = listRes.success ? listRes.data?.items?.[0] : null;
          if (first?.id) {
            resolvedPatientId = String(first.id);
            canFetchPatient = true;
          }
        } catch {
          /* 患者列表不可用: 不发起无效的单患者查询 */
        }
      }
      if (!resolvedPatientId) resolvedPatientId = DEFAULT_PATIENT_ID;
      if (cancelled) return;
      setExamId(nextExamId);
      setExamModality(modality);
      setPatientId(resolvedPatientId);
      if (!canFetchPatient) {
        setWeight(null);
        setWeightSource("missing");
        setEgfr(null);
        setEgfrSource("missing");
        setImplantHistory(null);
        setPatientLoading(false);
        return;
      }
      try {
        const res = await patientApi.getById(resolvedPatientId);
        if (cancelled) return;
        const p = res.success ? res.data : null;
        if (p) {
          setPatientName(String(p.name ?? ""));
          const nextWeight =
            typeof p.weight === "number" && Number.isFinite(p.weight)
              ? p.weight
              : null;
          const nextEgfr =
            typeof p.egfr === "number" && Number.isFinite(p.egfr)
              ? p.egfr
              : null;
          setWeight(nextWeight);
          setWeightSource(nextWeight === null ? "missing" : "patient");
          setEgfr(nextEgfr);
          setEgfrSource(nextEgfr === null ? "missing" : "patient");
          setImplantHistory(p.implantHistory ? String(p.implantHistory) : null);
        } else {
          setWeight(null);
          setWeightSource("missing");
          setEgfr(null);
          setEgfrSource("missing");
          setImplantHistory(null);
        }
      } catch {
        if (cancelled) return;
        setWeight(null);
        setWeightSource("missing");
        setEgfr(null);
        setEgfrSource("missing");
        setImplantHistory(null);
      } finally {
        if (!cancelled) setPatientLoading(false);
      }
    };
    void resolvePatient();
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  useEffect(() => {
    contrastSafetyApi
      .listAllergyTests(patientId)
      .then((res) => {
        if (res.success && Array.isArray(res.data?.items))
          setAllergyHistory(res.data.items);
      })
      .catch(() => {
        /* 后端不可用: 保留空历史 */
      });
  }, [patientId]);

  useEffect(() => {
    if (!observation || observation.status === "discharged") return;
    const timer = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [observation]);

  const liveRemaining =
    observation && observation.status !== "discharged"
      ? Math.max(
          0,
          Math.ceil((new Date(observation.endsAt).getTime() - nowTick) / 1000),
        )
      : 0;
  const liveCanDischarge = observation
    ? observation.status === "discharged" || liveRemaining === 0
    : false;
  const fmtClock = (sec: number) =>
    `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;

  const handlePreCheck = async () => {
    setChecking(true);
    try {
      const res = await contrastSafetyApi.preInjectionCheck({
        patientId,
        contrastType: selectedProto?.contrastName,
        consentSigned,
        egfr: egfr ?? undefined,
        pregnant,
      });
      setPreCheck(
        mergeWithLocalCheck(res.success && res.data ? res.data : null),
      );
    } catch {
      setPreCheck(buildLocalCheck());
    } finally {
      setChecking(false);
    }
  };

  const handleRecordAllergy = async () => {
    const contrastType =
      allergyForm.contrastType ||
      selectedProto?.contrastName ||
      t("contrastWs.defaultContrast");
    const payload = {
      patientId,
      contrastType,
      result: allergyForm.result,
      testedBy: allergyForm.testedBy || "current-user",
      notes: allergyForm.notes || undefined,
    };
    setAllergySubmitting(true);
    try {
      const res = await contrastSafetyApi.recordAllergyTest(payload);
      if (res.success && res.data) {
        setAllergyHistory((prev) => [res.data, ...prev]);
      } else {
        throw new Error(res.error?.message ?? "record failed");
      }
    } catch {
      setAllergyHistory((prev) => [
        {
          id: `local-${Date.now()}`,
          ...payload,
          testedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
      message.warning(t("contrastSafety.allergyRecorded") + " (本地演示)");
    }
    setAllergySubmitting(false);
    setShowAllergyForm(false);
    setPreCheck(null);
    message.success(t("contrastSafety.allergyRecorded"));
  };

  // [Wave 3B] 开始注射: 前置核查 → POST /contrast/injection; 失败回退本地演示
  const handleStartInjection = async () => {
    const proto = selectedProto;
    if (!proto) return;
    if (weight === null || egfr === null) {
      setPreCheck(buildLocalCheck());
      message.error(
        `${t("contrastSafety.injectionBlocked")}: ${weight === null ? t("contrastWs.weightMissing") : t("contrastWs.egfrMissing")}`,
      );
      return;
    }
    const check = mergeWithLocalCheck(preCheck);
    if (!check.passed) {
      setPreCheck(check);
      message.error(
        `${t("contrastSafety.injectionBlocked")}: ${check.blockers.map(blockerLabel).join("、")}`,
      );
      return;
    }
    if (!batchNo.trim()) {
      message.warning(t("contrastWs.batchNoMissing"));
    }
    setInjecting(true);
    try {
      const res = await contrastSafetyApi.inject({
        examId: examId ?? uniqueId("E"),
        patientId,
        patientName: patientName || t("contrastWs.demoPatient"),
        protocolId: proto.id,
        protocolName: proto.name,
        contrastType: proto.contrastName,
        batchNo: batchNo.trim() || t("contrastWs.notFilled"),
        route,
        totalVolumeMl: proto.totalVolumeMl,
        flowRateMls: proto.phases[0]?.flowRateMls ?? 3,
        operator: "current-user",
        weightKg: weight,
        weightSource: weightSource === "patient" ? "patient" : "manual",
        eGFR: egfr,
        egfrSource: egfrSource === "patient" ? "patient" : "manual",
        implantHistory: implantHistory ?? undefined,
        consentSigned,
        pregnant,
        adjustedVolumeMl: calculatedParams?.volumeMl ?? proto.totalVolumeMl,
      });
      if (res.success && res.data) {
        setPreCheck(res.data.preCheck);
        setInjectionDone(true);
        message.success(t("contrastSafety.injectSent"));
        return;
      }
      message.error(res.error?.message ?? t("contrastSafety.injectionBlocked"));
    } catch (e) {
      // 后端不可达: 基于本地核查回退演示 (本地核查已通过)
      try {
        await svc.startInjection(examId ?? uniqueId("E"), proto.id, {
          weightKg: weight,
          eGFR: egfr,
          adjustedVolumeMl: calculatedParams?.volumeMl ?? proto.totalVolumeMl,
        });
        setRecords(await svc.getInjectionHistory());
        setInjectionDone(true);
        message.warning(
          `后端不可用, 已回退本地演示: ${e instanceof Error ? e.message : "未知错误"}`,
        );
      } catch {
        message.error(t("contrastWs.injectionFailed"));
      }
    } finally {
      setInjecting(false);
    }
  };

  const handleCalculate = async () => {
    const proto = selectedProto;
    if (!proto) return;
    if (weight === null || egfr === null) {
      message.warning(
        weight === null
          ? t("contrastWs.weightMissing")
          : t("contrastWs.egfrMissing"),
      );
      return;
    }
    const params = await svc.calculateParameters(
      proto.contrastName,
      weight,
      egfr,
    );
    setCalculatedParams(params);
  };

  const handleStartObservation = async () => {
    setStartingObs(true);
    const payload = {
      patientId,
      examId: examId ?? uniqueId("E"),
      contrastType: selectedProto?.contrastName,
      operator: "current-user",
    };
    try {
      const res = await contrastSafetyApi.startObservation(payload);
      if (res.success && res.data) {
        setObservation(res.data);
        message.success(t("contrastSafety.observationStarted"));
        return;
      }
      throw new Error(res.error?.message ?? "start failed");
    } catch {
      const startedAt = new Date();
      const endsAt = new Date(startedAt.getTime() + 30 * 60_000);
      setObservation({
        id: `obs-local-${Date.now()}`,
        ...payload,
        startedAt: startedAt.toISOString(),
        durationMinutes: 30,
        endsAt: endsAt.toISOString(),
        status: "observing",
        records: [],
        doctorRelease: false,
        elapsedSeconds: 0,
        elapsedMinutes: 0,
        remainingSeconds: 1800,
        progressPercent: 0,
        canDischarge: false,
        createdAt: startedAt.toISOString(),
        updatedAt: startedAt.toISOString(),
      });
      message.warning(t("contrastSafety.observationStarted") + " (本地演示)");
    } finally {
      setStartingObs(false);
    }
  };

  const handleAddObservationRecord = async () => {
    if (!observation || !recordForm.symptoms.trim()) return;
    const payload = {
      symptoms: recordForm.symptoms.trim(),
      action: recordForm.action.trim(),
      recordedBy: "current-user",
    };
    try {
      const res = await contrastSafetyApi.addObservationRecord(
        observation.id,
        payload,
      );
      if (res.success && res.data) {
        setObservation(res.data);
      } else {
        throw new Error(res.error?.message ?? "record failed");
      }
    } catch {
      setObservation({
        ...observation,
        records: [
          ...observation.records,
          {
            at: new Date().toISOString(),
            symptoms: payload.symptoms,
            action: payload.action,
            recordedBy: "current-user",
          },
        ],
      });
    }
    setRecordForm({ symptoms: "", action: "" });
  };

  const handleDischarge = async () => {
    if (!observation) return;
    try {
      const res = await contrastSafetyApi.dischargeObservation(observation.id, {
        doctorRelease,
        dischargedBy: "current-user",
      });
      if (res.success && res.data) {
        setObservation(res.data);
        message.success(t("contrastSafety.observationDischarged"));
        return;
      }
      throw new Error(res.error?.message ?? "discharge failed");
    } catch {
      if (
        observation.status !== "discharged" &&
        liveRemaining > 0 &&
        !doctorRelease
      ) {
        message.error(t("contrastSafety.durationNotMet"));
        return;
      }
      setObservation({
        ...observation,
        status: "discharged",
        doctorRelease,
        dischargedAt: new Date().toISOString(),
        remainingSeconds: 0,
        canDischarge: true,
      });
      message.success(t("contrastSafety.observationDischarged"));
    }
  };

  if (loading) {
    return (
      <div
        style={{
          background: "var(--bg-primary, #0d1117)",
          color: "var(--text-primary, #f0f6fc)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 14,
        }}
      >
        {t("contrastWs.loading")}
      </div>
    );
  }

  return (
    <div
      style={{
        background: "var(--bg-primary, #0d1117)",
        color: "var(--text-primary, #f0f6fc)",
        fontSize: 14,
        fontFamily: '"Segoe UI",sans-serif',
      }}
    >
      <div
        style={{
          background: "linear-gradient(135deg,var(--color-info-600),#164e63)",
          padding: "16px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-3, 12px)",
          }}
        >
          <Syringe size={24} />
          <span style={{ fontSize: 20, fontWeight: 600 }}>
            {t("contrastWs.title")}
          </span>
        </div>
        <div
          style={{
            display: "flex",
            gap: "var(--space-2, 8px)",
            alignItems: "center",
          }}
        >
          {device && (
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                padding: "6px 12px",
                borderRadius: 6,
                background:
                  device.status === "online"
                    ? "#22c55e20"
                    : device.status === "offline"
                      ? "#ef444420"
                      : "#f59e0b20",
                color:
                  device.status === "online"
                    ? "var(--color-success-500)"
                    : device.status === "offline"
                      ? "var(--color-error-500)"
                      : "var(--color-warning-500)",
              }}
            >
              <Monitor size={14} />
              {device.deviceName}:{" "}
              {device.status === "online"
                ? t("contrastWs.device.online")
                : device.status === "offline"
                  ? t("contrastWs.device.offline")
                  : device.status === "busy"
                    ? t("contrastWs.device.busy")
                    : t("contrastWs.device.error")}
            </span>
          )}
          <button
            onClick={() => setShowHistory(!showHistory)}
            style={{
              padding: "8px 16px",
              borderRadius: 6,
              border: "1px solid rgba(255,255,255,0.3)",
              background: showHistory
                ? "rgba(255,255,255,0.25)"
                : "rgba(255,255,255,0.15)",
              color: "#fff",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
            }}
          >
            <List size={14} />
            {t("contrastWs.injectionHistory")}
          </button>
        </div>
      </div>

      {/* [v3.0.6.11-105 Wave 2C] 国标指标联动: RQI-ICME-05 对比剂外渗发生率 (深色主题) */}
      <div style={{ padding: "16px 24px 0" }}>
        <RqiIndicatorLink code="RQI-ICME-05" tone="dark" />
      </div>

      <div
        style={{
          padding: "20px 24px",
          display: "grid",
          gridTemplateColumns: showHistory ? "1fr 1fr" : "1fr",
          gap: "var(--space-5, 20px)",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-4, 16px)",
          }}
        >
          <div style={panelStyle}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                marginBottom: "var(--space-3, 12px)",
              }}
            >
              {t("contrastWs.selectProtocol")}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <AppSelectField
                value={selectedProtocol}
                onChange={(v) => {
                  setSelectedProtocol(String(v ?? ""));
                  setCalculatedParams(null);
                }}
                placeholder={t("contrastWs.selectProtocolPlaceholder")}
                options={protocols.map((p) => ({
                  value: p.id,
                  label: `${p.name} (${p.contrastName})`,
                }))}
                style={{
                  padding: "8px 12px",
                  borderRadius: 6,
                  border: "1px solid var(--border-default, #30363d)",
                  background: "var(--bg-primary, #0d1117)",
                  color: "var(--text-primary, #f0f6fc)",
                  fontSize: 12,
                }}
              />

              {selectedProtocol && (
                <>
                  {patientLoading ? (
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--text-muted, #8b949e)",
                        marginTop: "var(--space-2, 8px)",
                      }}
                    >
                      {t("contrastWs.patientDataLoading")}
                    </div>
                  ) : (
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--text-muted, #8b949e)",
                        marginTop: "var(--space-2, 8px)",
                      }}
                    >
                      {patientName || patientId} ·{" "}
                      {weight === null ? "—" : `${weight} kg`} · eGFR{" "}
                      {egfr === null ? "—" : egfr}
                    </div>
                  )}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 10,
                      marginTop: "var(--space-2, 8px)",
                    }}
                  >
                    <div>
                      <label
                        style={{
                          fontSize: 12,
                          color: "var(--text-muted, #8b949e)",
                          display: "flex",
                          alignItems: "center",
                          gap: "var(--space-2, 8px)",
                        }}
                      >
                        {t("contrastWs.weight")}
                        {weightSource === "manual" && (
                          <Tag color="orange">
                            {t("contrastWs.manualEntry")}
                          </Tag>
                        )}
                      </label>
                      <input
                        type="number"
                        value={weight ?? ""}
                        placeholder={t("contrastWs.needsManualEntry")}
                        onChange={(e) => {
                          const raw = e.target.value;
                          const next = raw === "" ? null : Number(raw);
                          setWeight(
                            next !== null && Number.isFinite(next)
                              ? next
                              : null,
                          );
                          setWeightSource(raw === "" ? "missing" : "manual");
                          setPreCheck(null);
                        }}
                        style={inputStyle}
                      />
                      {weight === null && !patientLoading && (
                        <div
                          style={{
                            fontSize: 11,
                            color: "var(--color-warning-500)",
                            marginTop: "var(--space-1, 4px)",
                          }}
                        >
                          {t("contrastWs.weightMissing")}
                        </div>
                      )}
                    </div>
                    <div>
                      <label
                        style={{
                          fontSize: 12,
                          color: "var(--text-muted, #8b949e)",
                          display: "flex",
                          alignItems: "center",
                          gap: "var(--space-2, 8px)",
                        }}
                      >
                        eGFR (mL/min)
                        {egfrSource === "manual" && (
                          <Tag color="orange">
                            {t("contrastWs.manualEntry")}
                          </Tag>
                        )}
                      </label>
                      <input
                        type="number"
                        value={egfr ?? ""}
                        placeholder={t("contrastWs.needsManualEntry")}
                        onChange={(e) => {
                          const raw = e.target.value;
                          const next = raw === "" ? null : Number(raw);
                          setEgfr(
                            next !== null && Number.isFinite(next)
                              ? next
                              : null,
                          );
                          setEgfrSource(raw === "" ? "missing" : "manual");
                          setPreCheck(null);
                        }}
                        style={inputStyle}
                      />
                      {egfr === null && !patientLoading && (
                        <div
                          style={{
                            fontSize: 11,
                            color: "var(--color-warning-500)",
                            marginTop: "var(--space-1, 4px)",
                          }}
                        >
                          {t("contrastWs.egfrMissing")}
                        </div>
                      )}
                    </div>
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 10,
                      marginTop: "var(--space-2, 8px)",
                    }}
                  >
                    <div>
                      <label
                        style={{
                          fontSize: 12,
                          color: "var(--text-muted, #8b949e)",
                        }}
                      >
                        {t("contrastWs.batchNo")}
                      </label>
                      <input
                        value={batchNo}
                        onChange={(e) => setBatchNo(e.target.value)}
                        placeholder={t("contrastWs.batchNoPlaceholder")}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label
                        style={{
                          fontSize: 12,
                          color: "var(--text-muted, #8b949e)",
                        }}
                      >
                        {t("contrastWs.route")}
                      </label>
                      <AppSelectField
                        value={route}
                        onChange={(v) =>
                          setRoute(String(v ?? "IV") as "IV" | "IA" | "PO")
                        }
                        style={inputStyle}
                        options={[
                          { value: "IV", label: t("contrastWs.route.IV") },
                          { value: "IA", label: t("contrastWs.route.IA") },
                          { value: "PO", label: t("contrastWs.route.PO") },
                        ]}
                      />
                    </div>
                  </div>
                  {implantHistory && (
                    <div
                      style={{
                        fontSize: 12,
                        color: isMrExam
                          ? "var(--color-error-500)"
                          : "var(--text-muted, #8b949e)",
                      }}
                    >
                      {t("contrastWs.implantWarning")}: {implantHistory}
                    </div>
                  )}
                </>
              )}

              <button
                onClick={handleCalculate}
                disabled={!selectedProtocol}
                style={{
                  padding: "8px 16px",
                  borderRadius: 6,
                  border: "none",
                  cursor: selectedProtocol ? "pointer" : "not-allowed",
                  background: selectedProtocol
                    ? "var(--color-info-600)"
                    : "var(--bg-secondary, #21262d)",
                  color: selectedProtocol ? "#fff" : "#484f58",
                  fontSize: 12,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                <Settings size={14} />
                {t("contrastWs.calculateParams")}
              </button>

              {calculatedParams && (
                <div
                  style={{
                    marginTop: "var(--space-2, 8px)",
                    padding: "var(--space-3, 12px)",
                    background: "var(--bg-primary, #0d1117)",
                    borderRadius: 6,
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "var(--color-success-500)",
                      marginBottom: "var(--space-2, 8px)",
                    }}
                  >
                    {t("contrastWs.calcResult")}
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr 1fr",
                      gap: "var(--space-2, 8px)",
                    }}
                  >
                    <div>
                      <span
                        style={{
                          color: "var(--text-muted, #8b949e)",
                          fontSize: 12,
                        }}
                      >
                        {t("contrastWs.volume")}
                      </span>
                      <div style={{ fontSize: 16, fontWeight: 600 }}>
                        {calculatedParams.volumeMl} mL
                      </div>
                    </div>
                    <div>
                      <span
                        style={{
                          color: "var(--text-muted, #8b949e)",
                          fontSize: 12,
                        }}
                      >
                        {t("contrastWs.flowRate")}
                      </span>
                      <div style={{ fontSize: 16, fontWeight: 600 }}>
                        {calculatedParams.flowRateMls} mL/s
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      marginTop: "var(--space-1, 4px)",
                      fontSize: 12,
                      color: "#6e7681",
                    }}
                  >
                    {calculatedParams.rationale}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* [Wave 3B] 注射前核查面板 */}
          <div
            style={{
              ...panelStyle,
              borderColor: preCheck
                ? preCheck.passed
                  ? "var(--color-success-500)"
                  : "var(--color-error-500)"
                : "var(--border-default, #30363d)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "var(--space-3, 12px)",
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-2, 8px)",
                }}
              >
                {preCheck?.passed ? (
                  <ShieldCheck size={16} color="var(--color-success-500)" />
                ) : (
                  <ShieldAlert
                    size={16}
                    color={
                      preCheck
                        ? "var(--color-error-500)"
                        : "var(--text-muted, #8b949e)"
                    }
                  />
                )}
                {t("contrastSafety.preCheck")}
              </div>
              <button
                onClick={() => void handlePreCheck()}
                disabled={checking}
                style={{
                  padding: "6px 14px",
                  borderRadius: 6,
                  border: "1px solid var(--color-info-600)",
                  background: "#0891b220",
                  color: "#22d3ee",
                  cursor: checking ? "wait" : "pointer",
                  fontSize: 12,
                }}
              >
                {checking
                  ? t("contrastSafety.checking")
                  : t("contrastSafety.check")}
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
                marginBottom: "var(--space-3, 12px)",
              }}
            >
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-2, 8px)",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={consentSigned}
                  onChange={(e) => {
                    setConsentSigned(e.target.checked);
                    setPreCheck(null);
                  }}
                />
                {t("contrastSafety.consentSigned")}
              </label>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-2, 8px)",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={pregnant}
                  onChange={(e) => {
                    setPregnant(e.target.checked);
                    setPreCheck(null);
                  }}
                />
                {t("contrastSafety.pregnant")}
              </label>
            </div>

            <div
              style={{
                fontSize: 12,
                color: "var(--text-muted, #8b949e)",
                marginBottom: "var(--space-2, 8px)",
              }}
            >
              {patientLoading
                ? t("contrastWs.patientDataLoading")
                : `${patientName || patientId} · ${weight === null ? "—" : `${weight} kg`} · eGFR ${egfr === null ? "—" : egfr}`}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "var(--space-2, 8px)",
              }}
            >
              {(
                [
                  { key: "consent", label: t("contrastSafety.consent") },
                  { key: "allergy", label: t("contrastSafety.allergy") },
                  { key: "weight", label: t("contrastSafety.weight") },
                  { key: "egfr", label: t("contrastSafety.egfr") },
                  { key: "pregnancy", label: t("contrastSafety.pregnancy") },
                  { key: "implant", label: t("contrastSafety.implant") },
                ] as const
              ).map((item) => {
                const check = preCheck?.checks?.find((c) => c.key === item.key);
                const localPassed =
                  item.key === "consent"
                    ? consentSigned
                    : item.key === "allergy"
                      ? allergyResult !== "positive"
                      : item.key === "weight"
                        ? !weightMissing
                        : item.key === "egfr"
                          ? !egfrMissing &&
                            (egfr as number) >= DEFAULT_EGFR_THRESHOLD
                          : item.key === "implant"
                            ? !hasImplantRisk
                            : !pregnant;
                const passed = check ? check.passed : localPassed;
                return (
                  <div
                    key={item.key}
                    style={{
                      padding: "8px 10px",
                      background: "var(--bg-primary, #0d1117)",
                      borderRadius: 6,
                      border: `1px solid ${passed ? "#22c55e40" : "#ef444440"}`,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: 12,
                        color: "var(--text-muted, #8b949e)",
                      }}
                    >
                      {passed ? (
                        <CheckCircle2
                          size={13}
                          color="var(--color-success-500)"
                        />
                      ) : (
                        <XCircle size={13} color="var(--color-error-500)" />
                      )}
                      {item.label}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: passed
                          ? "var(--color-success-500)"
                          : "var(--color-error-500)",
                        marginTop: "var(--space-1, 4px)",
                      }}
                    >
                      {check?.detail ?? "—"}
                    </div>
                  </div>
                );
              })}
            </div>

            {preCheck && !preCheck.passed && (
              <div
                style={{
                  marginTop: "var(--space-3, 12px)",
                  padding: "10px 12px",
                  background: "#ef444415",
                  border: "1px solid #ef444440",
                  borderRadius: 6,
                  fontSize: 12,
                  color: "#f87171",
                }}
              >
                <div
                  style={{
                    fontWeight: 600,
                    marginBottom: "var(--space-1, 4px)",
                  }}
                >
                  {t("contrastSafety.blocked")}
                </div>
                <div>{preCheck.blockers?.map(blockerLabel).join("、")}</div>
              </div>
            )}
            {preCheck?.passed && (
              <div
                style={{
                  marginTop: "var(--space-3, 12px)",
                  padding: "10px 12px",
                  background: "#22c55e15",
                  border: "1px solid #22c55e40",
                  borderRadius: 6,
                  fontSize: 12,
                  color: "var(--color-success-500)",
                  fontWeight: 600,
                }}
              >
                {t("contrastSafety.passed")}
              </div>
            )}
          </div>

          {/* [Wave 3B] 过敏试验记录 */}
          <div style={panelStyle}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "var(--space-3, 12px)",
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-2, 8px)",
                }}
              >
                <FlaskConical size={16} />
                {t("contrastSafety.allergyRecord")}
              </div>
              <button
                onClick={() => setShowAllergyForm(!showAllergyForm)}
                style={{
                  padding: "6px 14px",
                  borderRadius: 6,
                  border: "1px solid var(--border-default, #30363d)",
                  background: showAllergyForm
                    ? "var(--bg-secondary, #21262d)"
                    : "transparent",
                  color: "var(--text-primary, #f0f6fc)",
                  cursor: "pointer",
                  fontSize: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Plus size={13} />
                {t("contrastSafety.recordAllergy")}
              </button>
            </div>

            {showAllergyForm && (
              <div
                style={{
                  padding: "var(--space-3, 12px)",
                  background: "var(--bg-primary, #0d1117)",
                  borderRadius: 6,
                  marginBottom: "var(--space-3, 12px)",
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                }}
              >
                <div>
                  <label
                    style={{
                      fontSize: 12,
                      color: "var(--text-muted, #8b949e)",
                    }}
                  >
                    {t("contrastWs.contrastAgent")}
                  </label>
                  <input
                    value={allergyForm.contrastType}
                    onChange={(e) =>
                      setAllergyForm({
                        ...allergyForm,
                        contrastType: e.target.value,
                      })
                    }
                    placeholder={
                      selectedProto?.contrastName ??
                      t("contrastWs.defaultContrast")
                    }
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label
                    style={{
                      fontSize: 12,
                      color: "var(--text-muted, #8b949e)",
                    }}
                  >
                    {t("contrastWs.result")}
                  </label>
                  <AppSelectField
                    value={allergyForm.result}
                    onChange={(v) =>
                      setAllergyForm({
                        ...allergyForm,
                        result: String(v ?? "") as ContrastAllergyResult,
                      })
                    }
                    style={inputStyle}
                    options={[
                      {
                        value: "negative",
                        label: t("contrastSafety.result.negative"),
                      },
                      {
                        value: "positive",
                        label: t("contrastSafety.result.positive"),
                      },
                      {
                        value: "unknown",
                        label: t("contrastSafety.result.unknown"),
                      },
                    ]}
                  />
                </div>
                <div>
                  <label
                    style={{
                      fontSize: 12,
                      color: "var(--text-muted, #8b949e)",
                    }}
                  >
                    {t("contrastSafety.testedBy")}
                  </label>
                  <input
                    value={allergyForm.testedBy}
                    onChange={(e) =>
                      setAllergyForm({
                        ...allergyForm,
                        testedBy: e.target.value,
                      })
                    }
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label
                    style={{
                      fontSize: 12,
                      color: "var(--text-muted, #8b949e)",
                    }}
                  >
                    {t("contrastSafety.notes")}
                  </label>
                  <input
                    value={allergyForm.notes}
                    onChange={(e) =>
                      setAllergyForm({ ...allergyForm, notes: e.target.value })
                    }
                    style={inputStyle}
                  />
                </div>
                <div
                  style={{
                    gridColumn: "1 / -1",
                    display: "flex",
                    gap: "var(--space-2, 8px)",
                  }}
                >
                  <button
                    onClick={() => void handleRecordAllergy()}
                    disabled={allergySubmitting}
                    style={{
                      padding: "7px 16px",
                      borderRadius: 6,
                      border: "none",
                      background: "var(--color-info-600)",
                      color: "#fff",
                      cursor: allergySubmitting ? "wait" : "pointer",
                      fontSize: 12,
                    }}
                  >
                    {t("contrastSafety.submit")}
                  </button>
                  <button
                    onClick={() => setShowAllergyForm(false)}
                    style={{
                      padding: "7px 16px",
                      borderRadius: 6,
                      border: "1px solid var(--border-default, #30363d)",
                      background: "transparent",
                      color: "var(--text-muted, #8b949e)",
                      cursor: "pointer",
                      fontSize: 12,
                    }}
                  >
                    {t("contrastSafety.cancel")}
                  </button>
                </div>
              </div>
            )}

            <div
              style={{
                fontSize: 12,
                color: "var(--text-muted, #8b949e)",
                marginBottom: 6,
              }}
            >
              {t("contrastSafety.history")}
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                maxHeight: 160,
                overflowY: "auto",
              }}
            >
              {allergyHistory.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "6px 10px",
                    background: "var(--bg-primary, #0d1117)",
                    borderRadius: 4,
                    fontSize: 12,
                  }}
                >
                  <span>
                    {item.contrastType} · {item.testedBy}
                  </span>
                  <span
                    style={{
                      color:
                        item.result === "positive"
                          ? "var(--color-error-500)"
                          : item.result === "negative"
                            ? "var(--color-success-500)"
                            : "var(--color-warning-500)",
                    }}
                  >
                    {t(`contrastSafety.result.${item.result}`)}
                  </span>
                  <span style={{ color: "#6e7681" }}>
                    {new Date(item.testedAt).toLocaleString("zh-CN")}
                  </span>
                </div>
              ))}
              {allergyHistory.length === 0 && (
                <div style={{ color: "#6e7681", fontSize: 12 }}>
                  {t("contrastSafety.noHistory")}
                </div>
              )}
            </div>
          </div>

          {/* [Wave 3B] 注射后留观 */}
          <div style={panelStyle}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: "var(--space-2, 8px)",
                marginBottom: "var(--space-3, 12px)",
              }}
            >
              <Clock size={16} />
              {t("contrastSafety.observation")}
            </div>
            {!observation ? (
              <button
                onClick={() => void handleStartObservation()}
                disabled={!injectionDone || startingObs}
                style={{
                  padding: "8px 16px",
                  borderRadius: 6,
                  border: "none",
                  cursor: injectionDone ? "pointer" : "not-allowed",
                  background: injectionDone
                    ? "var(--color-info-600)"
                    : "var(--bg-secondary, #21262d)",
                  color: injectionDone ? "#fff" : "#484f58",
                  fontSize: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Clock size={14} />
                {startingObs ? "..." : t("contrastSafety.startObservation")}
              </button>
            ) : (
              <div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 10,
                  }}
                >
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 10 }}
                  >
                    <span
                      style={{
                        fontSize: 24,
                        fontWeight: 700,
                        fontVariantNumeric: "tabular-nums",
                        color:
                          observation.status === "discharged"
                            ? "var(--color-success-500)"
                            : liveRemaining === 0
                              ? "var(--color-warning-500)"
                              : "#22d3ee",
                      }}
                    >
                      {observation.status === "discharged"
                        ? t("contrastSafety.discharged")
                        : fmtClock(liveRemaining)}
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        color: "var(--text-muted, #8b949e)",
                      }}
                    >
                      {t("contrastSafety.remaining")}
                    </span>
                  </div>
                  <span style={{ fontSize: 12, color: "#6e7681" }}>
                    {observation.id}
                  </span>
                </div>
                <div
                  style={{
                    height: 6,
                    background: "var(--bg-primary, #0d1117)",
                    borderRadius: 3,
                    overflow: "hidden",
                    marginBottom: "var(--space-3, 12px)",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${observation.status === "discharged" ? 100 : Math.min(100, ((observation.durationMinutes * 60 - liveRemaining) / (observation.durationMinutes * 60)) * 100)}%`,
                      background: liveCanDischarge
                        ? "var(--color-success-500)"
                        : "var(--color-info-600)",
                      transition: "width 0.5s linear",
                    }}
                  />
                </div>

                <div
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted, #8b949e)",
                    marginBottom: 6,
                  }}
                >
                  {t("contrastSafety.records")}
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    marginBottom: 10,
                  }}
                >
                  {observation.records.map((rec, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: "6px 10px",
                        background: "var(--bg-primary, #0d1117)",
                        borderRadius: 4,
                        fontSize: 12,
                      }}
                    >
                      <span style={{ color: "#6e7681" }}>
                        {new Date(rec.at).toLocaleTimeString("zh-CN")}
                      </span>
                      <span style={{ marginLeft: "var(--space-2, 8px)" }}>
                        {rec.symptoms}
                      </span>
                      {rec.action && (
                        <span
                          style={{
                            marginLeft: "var(--space-2, 8px)",
                            color: "var(--text-muted, #8b949e)",
                          }}
                        >
                          [{rec.action}]
                        </span>
                      )}
                    </div>
                  ))}
                  {observation.records.length === 0 && (
                    <div style={{ color: "#6e7681", fontSize: 12 }}>
                      {t("contrastSafety.noRecords")}
                    </div>
                  )}
                </div>

                {observation.status !== "discharged" && (
                  <>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 10,
                      }}
                    >
                      <input
                        value={recordForm.symptoms}
                        onChange={(e) =>
                          setRecordForm({
                            ...recordForm,
                            symptoms: e.target.value,
                          })
                        }
                        placeholder={t("contrastSafety.symptoms")}
                        style={inputStyle}
                      />
                      <input
                        value={recordForm.action}
                        onChange={(e) =>
                          setRecordForm({
                            ...recordForm,
                            action: e.target.value,
                          })
                        }
                        placeholder={t("contrastSafety.action")}
                        style={inputStyle}
                      />
                    </div>
                    <button
                      onClick={() => void handleAddObservationRecord()}
                      disabled={!recordForm.symptoms.trim()}
                      style={{
                        marginTop: "var(--space-2, 8px)",
                        padding: "7px 14px",
                        borderRadius: 6,
                        border: "1px solid var(--border-default, #30363d)",
                        background: "transparent",
                        color: recordForm.symptoms.trim()
                          ? "var(--text-primary, #f0f6fc)"
                          : "#484f58",
                        cursor: recordForm.symptoms.trim()
                          ? "pointer"
                          : "not-allowed",
                        fontSize: 12,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <Plus size={13} />
                      {t("contrastSafety.addRecord")}
                    </button>

                    <div
                      style={{
                        marginTop: "var(--space-3, 12px)",
                        display: "flex",
                        alignItems: "center",
                        gap: "var(--space-3, 12px)",
                      }}
                    >
                      <label
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "var(--space-2, 8px)",
                          fontSize: 12,
                          cursor: "pointer",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={doctorRelease}
                          onChange={(e) => setDoctorRelease(e.target.checked)}
                        />
                        {t("contrastSafety.doctorRelease")}
                      </label>
                      <button
                        onClick={() => void handleDischarge()}
                        disabled={!liveCanDischarge && !doctorRelease}
                        style={{
                          padding: "8px 18px",
                          borderRadius: 6,
                          border: "none",
                          cursor:
                            liveCanDischarge || doctorRelease
                              ? "pointer"
                              : "not-allowed",
                          background:
                            liveCanDischarge || doctorRelease
                              ? "var(--color-success-500)"
                              : "var(--bg-secondary, #21262d)",
                          color:
                            liveCanDischarge || doctorRelease
                              ? "#fff"
                              : "#484f58",
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      >
                        {t("contrastSafety.discharge")}
                      </button>
                    </div>
                    {!liveCanDischarge && (
                      <div
                        style={{
                          marginTop: "var(--space-2, 8px)",
                          fontSize: 12,
                          color: "var(--color-warning-500)",
                        }}
                      >
                        {t("contrastSafety.durationNotMet")}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          <div style={panelStyle}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                marginBottom: "var(--space-3, 12px)",
              }}
            >
              {t("contrastWs.protocolDetail")}
            </div>
            {selectedProto ? (
              <div>
                <div
                  style={{
                    display: "flex",
                    gap: "var(--space-4, 16px)",
                    marginBottom: "var(--space-2, 8px)",
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      color: "var(--text-muted, #8b949e)",
                    }}
                  >
                    {t("contrastWs.totalVolume")}{" "}
                    <span style={{ color: "var(--text-primary, #f0f6fc)" }}>
                      {selectedProto.totalVolumeMl}mL
                    </span>
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      color: "var(--text-muted, #8b949e)",
                    }}
                  >
                    {t("contrastWs.concentration")}{" "}
                    <span style={{ color: "var(--text-primary, #f0f6fc)" }}>
                      {selectedProto.concentration}
                    </span>
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted, #8b949e)",
                    marginBottom: "var(--space-2, 8px)",
                  }}
                >
                  {t("contrastWs.phases")}
                </div>
                {selectedProto.phases.map((phase, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "6px 10px",
                      background: "var(--bg-primary, #0d1117)",
                      borderRadius: 4,
                      marginBottom: "var(--space-1, 4px)",
                      fontSize: 12,
                    }}
                  >
                    <span>
                      {phase.phase === "bolus"
                        ? t("contrastWs.phase.bolus")
                        : phase.phase === "chaser"
                          ? t("contrastWs.phase.chaser")
                          : phase.phase === "delay"
                            ? t("contrastWs.phase.delay")
                            : t("contrastWs.phase.fractional")}
                    </span>
                    <span>
                      {phase.volumeMl > 0
                        ? `${phase.volumeMl}mL @ ${phase.flowRateMls}mL/s`
                        : `延迟 ${phase.delaySec}s`}
                    </span>
                    <span style={{ color: "#6e7681" }}>
                      {phase.description}
                    </span>
                  </div>
                ))}
                {calculatedParams && (
                  <button
                    onClick={() => void handleStartInjection()}
                    disabled={injecting || !canInject}
                    title={
                      canInject ? "" : t("contrastSafety.injectionBlocked")
                    }
                    style={{
                      marginTop: "var(--space-3, 12px)",
                      width: "100%",
                      padding: "10px",
                      borderRadius: 6,
                      border: "none",
                      cursor: injecting
                        ? "wait"
                        : canInject
                          ? "pointer"
                          : "not-allowed",
                      background: canInject
                        ? "var(--color-success-500)"
                        : "var(--bg-secondary, #21262d)",
                      color: canInject ? "#fff" : "#484f58",
                      fontSize: 14,
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "var(--space-2, 8px)",
                    }}
                  >
                    <Play size={16} />
                    {injecting
                      ? t("contrastWs.commandSending")
                      : canInject
                        ? t("contrastWs.startInjection")
                        : t("contrastSafety.blocked")}
                  </button>
                )}
              </div>
            ) : (
              <div style={{ color: "#6e7681", fontSize: 12 }}>
                {t("contrastWs.selectFirst")}
              </div>
            )}
          </div>

          <div style={panelStyle}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: "var(--space-2, 8px)",
                marginBottom: "var(--space-3, 12px)",
              }}
            >
              <Syringe size={16} />
              {t("contrast.extravasation.events")}
              <Tag color="red">{extraOpenEvents.length}</Tag>
            </div>
            {extraOpenLoading ? (
              <div
                style={{ fontSize: 12, color: "var(--text-muted, #8b949e)" }}
              >
                {t("contrastWs.loading")}
              </div>
            ) : extraOpenEvents.length === 0 ? (
              <div
                style={{ fontSize: 12, color: "var(--text-muted, #8b949e)" }}
              >
                {t("contrast.extravasation.empty")}
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-2, 8px)",
                }}
              >
                {extraOpenEvents.map((e) => (
                  <div
                    key={e.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "var(--space-3, 12px)",
                      padding: "8px 10px",
                      background: "var(--bg-primary, #0d1117)",
                      borderRadius: 6,
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 12,
                          display: "flex",
                          alignItems: "center",
                          gap: "var(--space-2, 8px)",
                        }}
                      >
                        <span style={{ fontWeight: 600 }}>{e.patientId}</span>
                        <Tag color="red">{e.severity}</Tag>
                        <span style={{ color: "var(--text-muted, #8b949e)" }}>
                          {e.site} · {e.estimatedVolumeMl} mL
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: "var(--text-muted, #8b949e)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {e.management}
                      </div>
                    </div>
                    <Button
                      size="small"
                      type="primary"
                      onClick={() => setExtraHandleTarget(e)}
                    >
                      {t("contrast.extravasation.handle")}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <ExtravasationHandleModal
            event={extraHandleTarget}
            onClose={() => setExtraHandleTarget(null)}
            onSuccess={() => void loadExtraOpenEvents()}
          />

          {/* [v3.0.6.11-104 Wave 3D] 临床资料接入区块: eGFR 警告 + 安全核查清单 + 介入核查清单 */}
          <ContrastDataSections
            egfr={egfr ?? undefined}
            batchNo={batchNo}
            route={route}
          />
        </div>

        {showHistory && (
          <div
            style={{
              background: "var(--bg-card, #161b22)",
              border: "1px solid var(--border-default, #30363d)",
              borderRadius: 8,
              padding: "var(--space-4, 16px)",
              maxHeight: "80vh",
              overflowY: "auto",
            }}
          >
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                marginBottom: "var(--space-3, 12px)",
              }}
            >
              {t("contrastWs.injectionHistory")}
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-2, 8px)",
              }}
            >
              {records.map((r) => (
                <div
                  key={r.id}
                  style={{
                    padding: "10px 12px",
                    background: "var(--bg-primary, #0d1117)",
                    borderRadius: 6,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: "var(--space-1, 4px)",
                    }}
                  >
                    <span style={{ fontSize: 12 }}>{r.patientName}</span>
                    <span
                      style={{
                        fontSize: 12,
                        padding: "1px 6px",
                        borderRadius: 3,
                        background:
                          r.status === "completed"
                            ? "#22c55e20"
                            : r.status === "in_progress"
                              ? "#3b82f620"
                              : "#ef444420",
                        color:
                          r.status === "completed"
                            ? "var(--color-success-500)"
                            : r.status === "in_progress"
                              ? "var(--color-primary-500)"
                              : "var(--color-error-500)",
                      }}
                    >
                      {r.status === "completed"
                        ? t("contrastWs.recStatus.completed")
                        : r.status === "in_progress"
                          ? t("contrastWs.recStatus.inProgress")
                          : r.status === "cancelled"
                            ? t("contrastWs.recStatus.cancelled")
                            : t("contrastWs.recStatus.aborted")}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--text-muted, #8b949e)",
                    }}
                  >
                    {r.protocolName} | {r.totalVolumeMl}mL |{" "}
                    {new Date(r.startTime).toLocaleString("zh-CN")}
                  </div>
                </div>
              ))}
              {records.length === 0 && (
                <div style={{ color: "#6e7681", fontSize: 12 }}>
                  {t("contrastWs.noRecords")}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
