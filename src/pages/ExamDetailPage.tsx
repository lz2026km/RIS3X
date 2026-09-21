// [v3.0.6.11-96 Wave 3A P1] 检查执行详情独立路由 /exam/:id
// 加载 examApi.getById (回退 worklistApi.getById) → ExamDetailView 渲染,
// 含状态流转 + 阅片/写报告跳转。仅跳转可达 (routeTable 注册, sidebarConfig 不加菜单)。
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Eye, FileText, RefreshCw, MonitorPlay, History, MessageSquare, Send } from "lucide-react";
import { message } from "antd";
import { ExamDetailView, toRadiologyExamFromDto } from "./worklist/ExamDetailView";
import TimeoutVerifyModal from "../components/worklist/TimeoutVerifyModal";
import { examApi, type ExamTimelineDto } from "../services/api/examApi";
import { DashboardCard } from "../components/dashboard/DashboardCard";
import { EmptyState } from "../components/common/EmptyState";
import { t } from "../i18n/appI18n";
import { worklistApi, type WorklistItemDto } from "../services/api/worklistApi";
import { normalizeExamStatus } from "../utils/statusMaps";
import type { RadiologyExam } from "../types";
import type { ExamDto } from "../types/dto";

const toExamFromWorklist = (dto: WorklistItemDto): RadiologyExam => {
  return {
    id: dto.id,
    patientId: dto.patientId,
    patientName: dto.patientName ?? dto.patient?.name ?? "未知患者",
    gender: (dto.gender ?? dto.patient?.gender ?? "其他") as RadiologyExam["gender"],
    age: dto.age ?? 0,
    patientType: "门诊" as RadiologyExam["patientType"],
    examItemId: dto.examCode ?? "",
    examItemName: dto.examName ?? "检查",
    modality: (dto.modality ?? "CT") as RadiologyExam["modality"],
    bodyPart: (dto.bodyPart ?? "") as RadiologyExam["bodyPart"],
    examDate: (dto.scheduledAt ?? "").slice(0, 10),
    priority: (dto.priority ?? "普通") as RadiologyExam["priority"],
    deviceId: dto.device?.id ?? undefined,
    deviceName: dto.deviceName ?? dto.device?.name ?? undefined,
    status: normalizeExamStatus(dto.state ?? dto.status) as RadiologyExam["status"],
    imagesAcquired: 0,
    accessionNumber: dto.accessionNumber ?? dto.accessionNo ?? "",
    // [W6] Time-Out 门禁状态透出
    timeoutVerified: dto.timeoutVerified === undefined ? undefined : Boolean(dto.timeoutVerified),
    retakeStatus: (dto.retakeStatus ?? null) as RadiologyExam["retakeStatus"],
    // [v3.0.6.11-98 Wave3B P2] worklist patient.birthDate 透出 (无 phone/weight → 页面 `--`)
    patientBirthDate: dto.patient?.birthDate ? String(dto.patient.birthDate).slice(0, 10) : undefined,
    createdTime: dto.createdAt ?? "",
    updatedTime: dto.createdAt ?? "",
  };
};

// [v3.0.6.11-104 Wave 2B] 检查时间线事件配色
const TIMELINE_COLOR: Record<string, string> = {
  register: '#64748b',
  scheduled: '#3b82f6',
  checkin: '#0891b2',
  start: '#f59e0b',
  pause: '#d97706',
  complete: '#16a34a',
  retake: '#dc2626',
  'qc-rating': '#7c3aed',
  notes: '#2563eb',
  report: '#059669',
  op: '#94a3b8',
}

export default function ExamDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [exam, setExam] = useState<RadiologyExam | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  // [W6] 检查前核对 (Time-Out) 门禁
  const [timeoutExam, setTimeoutExam] = useState<RadiologyExam | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setLoadError(null);
    const examRes = await examApi.getById(id).catch(() => null);
    if (examRes?.success && examRes.data) {
      setExam(toRadiologyExamFromDto(examRes.data as ExamDto & Record<string, unknown>));
    } else {
      const wlRes = await worklistApi.getById(id).catch(() => null);
      if (wlRes?.success && wlRes.data) {
        setExam(toExamFromWorklist(wlRes.data));
      } else {
        setExam(null);
        setLoadError("检查详情加载失败，请确认检查是否存在");
      }
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  // [v3.0.6.11-104 Wave 2B] 检查时间线 + 技师备注
  const [timeline, setTimeline] = useState<ExamTimelineDto | null>(null);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineError, setTimelineError] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  const loadTimeline = useCallback(async () => {
    if (!id) return;
    setTimelineLoading(true);
    setTimelineError(null);
    try {
      const res = await examApi.timeline(id);
      if (res.success && res.data) {
        setTimeline(res.data);
      } else {
        setTimeline(null);
        setTimelineError(res.error?.message ?? t("examPage.timelineEmpty"));
      }
    } catch (e) {
      setTimeline(null);
      setTimelineError((e as Error)?.message ?? t("examPage.timelineEmpty"));
    } finally {
      setTimelineLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadTimeline();
  }, [loadTimeline]);

  const handleSaveNotes = async () => {
    if (!id) return;
    if (!noteText.trim()) {
      message.warning(t("examPage.notesRequired"));
      return;
    }
    setSavingNote(true);
    try {
      const res = await examApi.saveNotes(id, noteText.trim());
      if (res.success) {
        message.success(t("examPage.notesSaved"));
        setNoteText("");
        void loadTimeline();
      } else {
        message.error(res.error?.message ?? t("examPage.notesSaveFailed"));
      }
    } catch (e) {
      message.error((e as Error)?.message ?? t("examPage.notesSaveFailed"));
    } finally {
      setSavingNote(false);
    }
  };

  const handleStart = async (exam: RadiologyExam) => {
    // [W6] 检查前核对 (Time-Out) 门禁: 未核对时先弹窗, 完成后才放行
    if (exam.timeoutVerified === false) {
      setTimeoutExam(exam);
      return;
    }
    const res = await worklistApi.start(exam.id);
    if (res.success) {
      message.success("检查已开始");
      void load();
    } else if ((res.error?.message ?? "").includes("TIMEOUT_NOT_VERIFIED")) {
      setTimeoutExam(exam);
    } else {
      message.error(res.error?.message ?? "开始检查失败");
    }
  };

  // [W6] Time-Out 核对通过 → 以已核对状态开始检查
  const handleTimeoutVerified = useCallback(() => {
    const target = timeoutExam;
    setTimeoutExam(null);
    if (!target) return;
    void (async () => {
      const res = await worklistApi.start(target.id);
      if (res.success) {
        message.success("检查已开始");
        void load();
      } else {
        message.error(res.error?.message ?? "开始检查失败");
      }
    })();
  }, [timeoutExam, load]);

  const handleCancel = async (exam: RadiologyExam) => {
    const res = await worklistApi.cancel(exam.id, "独立详情页取消");
    if (res.success) {
      message.success("检查已取消");
      void load();
    } else {
      message.error(res.error?.message ?? "取消检查失败");
    }
  };

  const goWorklist = (hint: string) => {
    message.info(hint);
    navigate("/worklist");
  };

  return (
    <div
      data-testid="exam-detail-page"
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "var(--bg-card)",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      {/* 页头 */}
      <div
        style={{
          padding: "10px 20px",
          borderBottom: "1px solid var(--border-color)",
          display: "flex",
          alignItems: "center",
          gap: 12,
          background: "linear-gradient(135deg, #1e40af 0%, #2563eb 100%)",
        }}
      >
        <button
          onClick={() => navigate(-1)}
          title="返回"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "6px 12px",
            border: "1px solid rgba(255,255,255,0.4)",
            borderRadius: 8,
            background: "rgba(255,255,255,0.12)",
            color: "#fff",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <ArrowLeft size={14} /> 返回
        </button>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>
          检查执行详情
        </div>
        <div
          style={{
            fontSize: 12,
            fontFamily: "monospace",
            color: "rgba(255,255,255,0.85)",
          }}
        >
          {exam?.accessionNumber ?? id}
        </div>
        <div style={{ flex: 1 }} />
        <button
          onClick={() =>
            navigate(`/dicom-viewer?studyUid=${encodeURIComponent(exam?.accessionNumber || id || "")}&examId=${id}`)
          }
          disabled={!exam}
          title="阅片"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "6px 12px",
            border: "1px solid rgba(255,255,255,0.4)",
            borderRadius: 8,
            background: "rgba(255,255,255,0.12)",
            color: "#fff",
            fontSize: 13,
            fontWeight: 600,
            cursor: exam ? "pointer" : "not-allowed",
            opacity: exam ? 1 : 0.5,
          }}
        >
          <Eye size={14} /> 阅片
        </button>
        <button
          onClick={() =>
            exam &&
            navigate(`/reports/v3-write?examId=${encodeURIComponent(exam.id)}&patientId=${encodeURIComponent(exam.patientId)}`)
          }
          disabled={!exam}
          title="写报告"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "6px 12px",
            border: "1px solid rgba(255,255,255,0.4)",
            borderRadius: 8,
            background: "rgba(255,255,255,0.12)",
            color: "#fff",
            fontSize: 13,
            fontWeight: 600,
            cursor: exam ? "pointer" : "not-allowed",
            opacity: exam ? 1 : 0.5,
          }}
        >
          <FileText size={14} /> 写报告
        </button>
      </div>

      {/* 加载 / 错误 / 主体 */}
      {loading ? (
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            color: "var(--text-secondary)",
            fontSize: 13,
          }}
        >
          <MonitorPlay size={18} /> 正在加载检查详情...
        </div>
      ) : loadError || !exam ? (
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            color: "#dc2626",
            fontSize: 13,
          }}
        >
          <div>{loadError ?? "检查详情不可用"}</div>
          <button
            onClick={() => void load()}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "6px 14px",
              border: "1px solid var(--border-color)",
              borderRadius: 8,
              background: "var(--bg-card)",
              color: "var(--text-secondary)",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            <RefreshCw size={12} /> 重试
          </button>
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          <ExamDetailView
            exam={exam}
            onStatusChanged={() => void load()}
            onStatusSuccess={() => void load()}
            onEditInfo={() => goWorklist("请前往工作台修改患者信息")}
            onAssignDevice={() => goWorklist("请前往工作台分配设备")}
            onAssignDoctor={() => goWorklist("请前往工作台分配医生")}
            onViewRequisition={() => goWorklist("请前往工作台查看申请单")}
            onWriteReport={(exam) =>
              navigate(`/reports/v3-write?examId=${encodeURIComponent(exam.id)}&patientId=${encodeURIComponent(exam.patientId)}`)
            }
            onStartExam={(exam) => void handleStart(exam)}
            onCancelExam={(exam) => void handleCancel(exam)}
          />

          {/* [v3.0.6.11-104 Wave 2B] 检查时间线 */}
          <div style={{ marginTop: 16 }}>
            <DashboardCard
              title={t("examPage.timelineTitle")}
              icon={<History size={14} />}
              loading={timelineLoading}
              error={timeline ? null : timelineError}
              onRetry={() => void loadTimeline()}
              skeletonRows={5}
              testId="exam-timeline-card"
            >
              {!timeline || timeline.events.length === 0 ? (
                <EmptyState type="nodata" description={t("examPage.timelineEmpty")} style={{ padding: 24 }} />
              ) : (
                <>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 12 }}>
                    {t("examPage.timelineEvents", { count: timeline.totalEvents })}
                  </div>
                  <div style={{ position: "relative", paddingLeft: 20 }}>
                    <div style={{ position: "absolute", left: 5, top: 4, bottom: 4, width: 2, background: "var(--border-color)" }} />
                    {timeline.events.map((ev, i) => {
                      const color = TIMELINE_COLOR[ev.type] ?? "#3b82f6"
                      return (
                        <div key={`${ev.type}-${i}`} style={{ position: "relative", paddingBottom: 14 }}>
                          <div style={{ position: "absolute", left: -20, top: 3, width: 10, height: 10, borderRadius: "50%", background: color, boxShadow: `0 0 0 3px ${color}22` }} />
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{ev.label}</span>
                            {ev.actor && <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{ev.actor}</span>}
                            <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-muted, #94a3b8)", fontFamily: "monospace" }}>
                              {String(ev.timestamp).slice(0, 16).replace("T", " ")}
                            </span>
                          </div>
                          {ev.note && <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>{ev.note}</div>}
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </DashboardCard>
          </div>

          {/* [v3.0.6.11-104 Wave 2B] 技师备注编辑 (POST /exams/:id/notes) */}
          <div style={{ marginTop: 16 }}>
            <DashboardCard title={t("examPage.techNotesTitle")} icon={<MessageSquare size={14} />} testId="exam-notes-card">
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder={t("examPage.techNotesPlaceholder")}
                rows={3}
                maxLength={2000}
                style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--border-color)", borderRadius: 6, fontSize: 12, resize: "vertical", outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
              />
              <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
                <button
                  onClick={() => void handleSaveNotes()}
                  disabled={savingNote}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 6, border: "none", background: "#1e40af", color: "#fff", fontSize: 13, fontWeight: 600, cursor: savingNote ? "not-allowed" : "pointer", opacity: savingNote ? 0.6 : 1 }}
                >
                  <Send size={13} /> {savingNote ? t("examPage.savingNotes") : t("examPage.saveNotes")}
                </button>
              </div>
            </DashboardCard>
          </div>
        </div>
      )}

      {/* [W6] 检查前核对 (Time-Out) 门禁弹窗 */}
      <TimeoutVerifyModal
        open={timeoutExam !== null}
        examId={timeoutExam?.id ?? null}
        onCancel={() => setTimeoutExam(null)}
        onVerified={handleTimeoutVerified}
      />
    </div>
  );
}
