import React, { useState, useMemo, useEffect } from "react";
import { message } from "antd";
import {
  AlertTriangle,
  Zap,
  Monitor,
  Clock,
  Move,
  Sparkles,
} from "lucide-react";
import { initialModalityDevices } from "../../data/initialData";
import type { RadiologyExam } from "../../types";
import { smartWorklistEngine } from "../../services/worklist/SmartWorklistEngine";
import type { PriorityScore as AIPriorityScore } from "../../types/workflow";
import { t } from "../../i18n/appI18n";
import { displayExamStatus, normalizeExamStatus } from "../../utils/statusMaps";

const STATUS_CONFIG: Record<
  string,
  { bg: string; color: string; label: string }
> = {
  SCHEDULED: {
    bg: "#3b82f622",
    color: "var(--color-primary-500)",
    label: t("worklistStatus.scheduled"),
  },
  ARRIVED: {
    bg: "#8b5cf622",
    color: "#7c3aed",
    label: t("worklistStatus.arrived"),
  },
  IN_PROGRESS: {
    bg: "#ec489922",
    color: "#db2777",
    label: t("worklistStatus.inProgress"),
  },
  COMPLETED: {
    bg: "#22c55e22",
    color: "#059669",
    label: t("worklistStatus.completed"),
  },
  CANCELLED: {
    bg: "#ef444422",
    color: "var(--color-error-500)",
    label: t("worklistStatus.cancelled"),
  },
  已登记: {
    bg: "#3b82f622",
    color: "var(--color-primary-500)",
    label: t("worklistStatus.scheduled"),
  },
  待检查: {
    bg: "#8b5cf622",
    color: "#7c3aed",
    label: t("worklistStatus.pending"),
  },
  检查中: {
    bg: "#ec489922",
    color: "#db2777",
    label: t("worklistStatus.inProgress"),
  },
  待报告: {
    bg: "#f59e0b22",
    color: "#ca8a04",
    label: t("worklistStatus.pendingReport"),
  },
  已报告: {
    bg: "#22c55e22",
    color: "#059669",
    label: t("worklistStatus.reported"),
  },
  已发布: {
    bg: "#22c55e22",
    color: "#047857",
    label: t("worklistStatus.published"),
  },
  已暂停: {
    bg: "#f59e0b22",
    color: "var(--color-warning-500)",
    label: t("worklistStatus.paused"),
  },
  质控退回: {
    bg: "#ef444422",
    color: "var(--color-error-500)",
    label: t("worklistStatus.qcReturned"),
  },
  // [v3.0.6.16-1] 后端 10 态看板配色 (颜色走语义令牌, hex 仅作 var() 回退)
  PAUSED: {
    bg: "var(--color-warning-bg, #fffbeb)",
    color: "var(--color-warning-600, #d97706)",
    label: t("worklistStatus.paused"),
  },
  IMAGE_READY: {
    bg: "var(--color-info-bg, #eff6ff)",
    color: "var(--color-primary-600, #2563eb)",
    label: t("worklistStatus.imageReady"),
  },
  QC_REJECT: {
    bg: "var(--color-error-bg, #fef2f2)",
    color: "var(--color-error-600, #dc2626)",
    label: t("worklistStatus.qcReturned"),
  },
  QC_PASS: {
    bg: "var(--color-success-bg, #ecfdf5)",
    color: "var(--color-success-600, #16a34a)",
    label: t("worklistStatus.qcPass"),
  },
  PENDING_REPORT: {
    bg: "var(--color-warning-bg, #fffbeb)",
    color: "var(--color-warning-600, #d97706)",
    label: t("worklistStatus.pendingReport"),
  },
};

const PRIORITY_CONFIG: Record<
  string,
  { bg: string; color: string; label: string }
> = {
  普通: {
    bg: "var(--bg-deep)",
    color: "var(--text-secondary)",
    label: t("worklistPriority.normal"),
  },
  紧急: {
    bg: "#f59e0b22",
    color: "var(--color-warning-500)",
    label: t("worklistPriority.urgent"),
  },
  危重: {
    bg: "#ef444422",
    color: "var(--color-error-500)",
    label: t("worklistPriority.critical"),
  },
  会诊: {
    bg: "#8b5cf622",
    color: "#7c3aed",
    label: t("worklistPriority.consult"),
  },
};

// [v3.0.6.16-1] 合法流转表, 与 backend/src/modules/worklist/worklist.service.ts EXAM_TRANSITIONS 一致
const EXAM_TRANSITIONS: Record<string, string[]> = {
  SCHEDULED: ["ARRIVED", "CANCELLED"],
  ARRIVED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "PAUSED", "CANCELLED", "IMAGE_READY"],
  PAUSED: ["IN_PROGRESS", "CANCELLED"],
  COMPLETED: ["IMAGE_READY"],
  CANCELLED: [],
  IMAGE_READY: ["QC_REJECT", "QC_PASS", "PENDING_REPORT"],
  QC_REJECT: ["IN_PROGRESS", "PENDING_REPORT"],
  QC_PASS: ["PENDING_REPORT", "IMAGE_READY", "QC_REJECT"],
  PENDING_REPORT: ["IMAGE_READY", "QC_REJECT"],
};

const KANBAN_COLUMNS = [
  "SCHEDULED",
  "ARRIVED",
  "IN_PROGRESS",
  "COMPLETED",
  "IMAGE_READY",
  "QC_REJECT",
  "QC_PASS",
  "PENDING_REPORT",
  "CANCELLED",
];

const KANBAN_COLUMN_STATUS: Record<string, string> = {
  PAUSED: "IN_PROGRESS",
};

const getDeviceById = (deviceId: string) =>
  initialModalityDevices.find((d) => d.id === deviceId);

interface SLAInfo {
  elapsedMinutes: number;
  status: "normal" | "warning" | "critical";
  color: string;
  label: string;
}

const getSLAInfo = (createdTime: string): SLAInfo => {
  try {
    const created = new Date(createdTime).getTime();
    const now = Date.now();
    const elapsedMinutes = Math.floor((now - created) / 60000);
    if (elapsedMinutes > 60)
      return {
        elapsedMinutes,
        status: "critical",
        color: "var(--color-error-600)",
        label: ">60min",
      };
    if (elapsedMinutes > 30)
      return {
        elapsedMinutes,
        status: "warning",
        color: "var(--color-warning-600)",
        label: "30-60min",
      };
    return {
      elapsedMinutes,
      status: "normal",
      color: "#059669",
      label: "<30min",
    };
  } catch {
    return {
      elapsedMinutes: 0,
      status: "normal",
      color: "#059669",
      label: "<30min",
    };
  }
};

interface PriorityScore {
  level: "低" | "普通" | "紧急" | "危重";
  score: number;
  color: string;
  bg: string;
}

const calculatePriority = (exam: RadiologyExam): PriorityScore => {
  const ageScore =
    exam.age >= 70 ? 30 : exam.age >= 60 ? 20 : exam.age >= 50 ? 10 : 0;
  let waitScore = 0;
  try {
    const created = new Date(exam.createdTime).getTime();
    const now = Date.now();
    const waitMinutes = (now - created) / 60000;
    waitScore =
      waitMinutes > 120 ? 25 : waitMinutes > 60 ? 15 : waitMinutes > 30 ? 8 : 0;
  } catch {
    /* ignore */
  }
  const typeScore =
    exam.patientType === "急诊" ? 25 : exam.patientType === "住院" ? 15 : 5;
  const partScore =
    exam.bodyPart === "头颅" ||
    exam.bodyPart === "心脏" ||
    exam.bodyPart === "血管"
      ? 20
      : 10;
  const totalScore = ageScore + waitScore + typeScore + partScore;
  if (totalScore >= 70)
    return {
      level: "危重",
      score: totalScore,
      color: "var(--color-error-500)",
      bg: "#ef444422",
    };
  if (totalScore >= 45)
    return {
      level: "紧急",
      score: totalScore,
      color: "var(--color-warning-500)",
      bg: "#f59e0b22",
    };
  if (totalScore >= 25)
    return {
      level: "普通",
      score: totalScore,
      color: "var(--text-secondary)",
      bg: "var(--bg-deep)",
    };
  return { level: "低", score: totalScore, color: "#059669", bg: "#22c55e22" };
};

interface KanbanCardProps {
  exam: RadiologyExam;
  isDragging: boolean;
  draggedExamId: string | null;
  onDragStart: (e: React.DragEvent, exam: RadiologyExam) => void;
  onDragEnd: () => void;
  onRowClick: (exam: RadiologyExam) => void;
  smartScore: AIPriorityScore | undefined;
}

const KanbanCard = React.memo(function KanbanCard({
  exam,
  isDragging,
  onDragStart,
  onDragEnd,
  onRowClick,
  smartScore,
}: KanbanCardProps) {
  const device = getDeviceById(exam.deviceId ?? "");
  const pc = PRIORITY_CONFIG[exam.priority] || PRIORITY_CONFIG["普通"]!;

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, exam)}
      onDragEnd={onDragEnd}
      onClick={() => onRowClick(exam)}
      style={{
        background: "var(--bg-card)",
        borderRadius: 8,
        padding: "10px 12px",
        marginBottom: "var(--space-2, 8px)",
        cursor: "move",
        border: "1px solid var(--border-color)",
        boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
        opacity: isDragging ? 0.5 : 1,
        transition: "all 0.15s",
      }}
      onMouseEnter={(e) => {
        if (!isDragging) {
          e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.1)";
          e.currentTarget.style.transform = "translateY(-1px)";
        }
      }}
      onMouseLeave={(e) => {
        if (!isDragging) {
          e.currentTarget.style.boxShadow = "0 1px 2px rgba(0,0,0,0.05)";
          e.currentTarget.style.transform = "translateY(0)";
        }
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 6,
        }}
      >
        <div
          style={{
            fontWeight: 600,
            color: "var(--color-primary-800)",
            fontSize: 12,
            display: "flex",
            alignItems: "center",
            gap: "var(--space-1, 4px)",
          }}
        >
          {exam.patientName}
          {exam.priority === "危重" && (
            <AlertTriangle
              size={10}
              style={{ color: "var(--color-error-600)" }}
            />
          )}
          {exam.priority === "紧急" && (
            <Zap size={10} style={{ color: "var(--color-warning-600)" }} />
          )}
        </div>
        <Move size={12} style={{ color: "#cbd5e1", flexShrink: 0 }} />
      </div>

      <div
        style={{
          fontSize: 12,
          color: "var(--text-secondary)",
          marginBottom: 6,
        }}
      >
        {exam.examItemName}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-2, 8px)",
          fontSize: 12,
          color: "var(--text-secondary)",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
          <Monitor size={10} />
          {device?.name?.split("（")[0] || "-"}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
          <Clock size={10} />
          {exam.examTime || "-"}
        </span>
      </div>

      <div
        style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}
      >
        {(() => {
          const sla = getSLAInfo(exam.createdTime);
          const autoPri = calculatePriority(exam);
          const smart = smartScore;
          const smartLevel = smart ? smart.level : null;
          const smartColor =
            smartLevel === "critical"
              ? "var(--color-error-600)"
              : smartLevel === "urgent"
                ? "var(--color-warning-600)"
                : smartLevel === "normal"
                  ? "#475569"
                  : "#059669";
          const smartBg =
            smartLevel === "critical"
              ? "var(--color-error-bg)"
              : smartLevel === "urgent"
                ? "var(--color-warning-bg)"
                : smartLevel === "normal"
                  ? "var(--bg-deep)"
                  : "var(--color-success-bg)";
          const smartLabel =
            smartLevel === "critical"
              ? t("worklistPriority.critical")
              : smartLevel === "urgent"
                ? t("worklistPriority.urgent")
                : smartLevel === "normal"
                  ? t("worklistPriority.normal")
                  : t("worklistPriority.low");
          return (
            <>
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                  fontSize: 12,
                  fontWeight: 600,
                  color: sla.color,
                }}
              >
                <div
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: "50%",
                    background: sla.color,
                  }}
                />
                {sla.elapsedMinutes}m
              </span>
              <span
                style={{
                  fontSize: 10,
                  padding: "1px 4px",
                  borderRadius: 2,
                  background: autoPri.bg,
                  color: autoPri.color,
                  fontWeight: 600,
                }}
              >
                {autoPri.level}
              </span>
              {smart && (
                <span
                  title={`AI 评分 ${smart.score.toFixed(1)} / 100 · ${smart.reasons.join("; ")}`}
                  data-testid="smart-priority-badge"
                  style={{
                    fontSize: 10,
                    padding: "1px 4px",
                    borderRadius: 2,
                    background: smartBg,
                    color: smartColor,
                    fontWeight: 600,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 2,
                  }}
                >
                  <Sparkles size={8} /> AI {smartLabel} {smart.score.toFixed(0)}
                </span>
              )}
            </>
          );
        })()}
      </div>

      <div
        style={{
          height: 2,
          borderRadius: 1,
          background: pc.color,
          marginTop: "var(--space-2, 8px)",
        }}
      />
    </div>
  );
});

// ============================================================
// KanbanView
// ============================================================
interface KanbanViewProps {
  exams: RadiologyExam[];
  onRowClick: (exam: RadiologyExam) => void;
  onStatusChange?: (exam: RadiologyExam, targetStatus: string) => void;
}

export function KanbanView({
  exams,
  onRowClick,
  onStatusChange,
}: KanbanViewProps) {
  const [draggedExam, setDraggedExam] = useState<RadiologyExam | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [examStatuses, setExamStatuses] = useState<Record<string, string>>(
    () => {
      const map: Record<string, string> = {};
      exams.forEach((e) => {
        map[e.id] = normalizeExamStatus(e.status);
      });
      return map;
    },
  );

  useEffect(() => {
    setExamStatuses(() => {
      const next: Record<string, string> = {};
      exams.forEach((e) => {
        next[e.id] = normalizeExamStatus(e.status);
      });
      return next;
    });
  }, [exams]);

  const smartScores = useMemo(() => {
    const map = new Map<string, AIPriorityScore>();
    smartWorklistEngine.scoreMany(exams).forEach((s) => map.set(s.studyId, s));
    return map;
  }, [exams]);

  const getColumnExams = (status: string) =>
    exams.filter((e) => {
      const current = normalizeExamStatus(examStatuses[e.id] ?? e.status);
      return (KANBAN_COLUMN_STATUS[current] ?? current) === status;
    });

  const canDropTo = (targetStatus: string) => {
    if (!draggedExam) return true;
    const from = normalizeExamStatus(
      examStatuses[draggedExam.id] ?? draggedExam.status,
    );
    if (from === targetStatus) return true;
    return (EXAM_TRANSITIONS[from] ?? []).includes(targetStatus);
  };

  const handleDragStart = (e: React.DragEvent, exam: RadiologyExam) => {
    setDraggedExam(exam);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, status: string) => {
    e.preventDefault();
    setDragOverColumn(status);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = (e: React.DragEvent, targetStatus: string) => {
    e.preventDefault();
    const exam = draggedExam;
    setDraggedExam(null);
    setDragOverColumn(null);
    if (!exam) return;
    const from = normalizeExamStatus(examStatuses[exam.id] ?? exam.status);
    if (from === targetStatus) return;
    if (!(EXAM_TRANSITIONS[from] ?? []).includes(targetStatus)) {
      message.warning(
        t("worklist.kanbanInvalidTransition", {
          from: displayExamStatus(from),
          to: displayExamStatus(targetStatus),
        }),
      );
      return;
    }
    setExamStatuses((prev) => ({ ...prev, [exam.id]: targetStatus }));
    onStatusChange?.(exam, targetStatus);
  };

  const handleDragEnd = () => {
    setDraggedExam(null);
    setDragOverColumn(null);
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${KANBAN_COLUMNS.length}, minmax(200px, 1fr))`,
        gap: "var(--space-3, 12px)",
        overflowX: "auto",
        paddingBottom: "var(--space-2, 8px)",
      }}
    >
      {KANBAN_COLUMNS.map((status) => {
        const columnExams = getColumnExams(status);
        const sc = STATUS_CONFIG[status] || {
          bg: "var(--bg-deep)",
          color: "var(--text-secondary)",
          label: status,
        };
        const isOver = dragOverColumn === status;
        const isInvalidTarget = !!draggedExam && !canDropTo(status);

        return (
          <div
            key={status}
            onDragOver={(e) => handleDragOver(e, status)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, status)}
            style={{
              background: isInvalidTarget
                ? "var(--color-error-bg, #fef2f2)"
                : isOver
                  ? "var(--color-info-bg)"
                  : "var(--bg-card)",
              borderRadius: 10,
              padding: "var(--space-3, 12px)",
              minHeight: 400,
              transition: "background 0.15s",
              opacity: isInvalidTarget ? 0.55 : 1,
              border: isInvalidTarget
                ? "2px dashed var(--color-error-500)"
                : isOver
                  ? "2px dashed var(--color-primary-800)"
                  : "2px dashed transparent",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "var(--space-3, 12px)",
                padding: "8px 10px",
                background: "var(--bg-card)",
                borderRadius: 8,
                border: "1px solid var(--border-color)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-2, 8px)",
                }}
              >
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: sc.color,
                  }}
                />
                <span
                  style={{
                    fontWeight: 600,
                    color: "var(--text-primary)",
                    fontSize: 12,
                  }}
                >
                  {sc.label}
                </span>
              </div>
              <div
                style={{
                  background: sc.bg,
                  color: sc.color,
                  padding: "2px 8px",
                  borderRadius: 10,
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {columnExams.length}
              </div>
            </div>

            <div style={{ minHeight: 100 }}>
              {columnExams.slice(0, 20).map((exam) => (
                <KanbanCard
                  key={exam.id}
                  exam={exam}
                  isDragging={draggedExam?.id === exam.id}
                  draggedExamId={draggedExam?.id ?? null}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  onRowClick={onRowClick}
                  smartScore={smartScores.get(exam.id)}
                />
              ))}
              {columnExams.length > 20 && (
                <div
                  style={{
                    textAlign: "center",
                    color: "var(--text-muted, #94a3b8)",
                    fontSize: 11,
                    padding: "8px 0",
                  }}
                >
                  {t("worklistKanban.remaining", {
                    count: columnExams.length - 20,
                  })}
                </div>
              )}
              {columnExams.length === 0 && (
                <div
                  style={{
                    textAlign: "center",
                    color: "#cbd5e1",
                    fontSize: 12,
                    padding: "20px 0",
                  }}
                >
                  {t("worklistKanban.noRecords")}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
