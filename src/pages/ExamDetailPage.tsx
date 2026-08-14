// [v3.0.6.11-96 Wave 3A P1] 检查执行详情独立路由 /exam/:id
// 加载 examApi.getById (回退 worklistApi.getById) → ExamDetailView 渲染,
// 含状态流转 + 阅片/写报告跳转。仅跳转可达 (routeTable 注册, sidebarConfig 不加菜单)。
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Eye, FileText, RefreshCw, MonitorPlay } from "lucide-react";
import { message } from "antd";
import { ExamDetailView, toRadiologyExamFromDto } from "./worklist/ExamDetailView";
import { examApi } from "../services/api/examApi";
import { worklistApi, type WorklistItemDto } from "../services/api/worklistApi";
import { normalizeExamStatus } from "../utils/statusMaps";
import type { RadiologyExam } from "../types";
import type { ExamDto } from "../types/dto";

const toExamFromWorklist = (dto: WorklistItemDto): RadiologyExam => {
  return {
    id: dto.id,
    patientId: dto.patientId,
    patientName: dto.patientName,
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
    createdTime: dto.createdAt ?? "",
    updatedTime: dto.createdAt ?? "",
  };
};

export default function ExamDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [exam, setExam] = useState<RadiologyExam | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

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

  const handleStart = async (exam: RadiologyExam) => {
    const res = await worklistApi.start(exam.id);
    if (res.success) {
      message.success("检查已开始");
      void load();
    } else {
      message.error(res.error?.message ?? "开始检查失败");
    }
  };

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
        </div>
      )}
    </div>
  );
}
