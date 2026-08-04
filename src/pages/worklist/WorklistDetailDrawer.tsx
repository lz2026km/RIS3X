import { useState } from "react";
import {
  User,
  AlertTriangle,
  Zap,
  UserCog,
  Stethoscope,
  Image,
  Images,
  History,
  Clipboard,
  ClipboardList,
  Edit3,
  UserCheck,
  FileText,
  ArrowLeftRight,
  XCircle,
  Printer,
} from "lucide-react";
import {
  initialModalityDevices,
  initialExamRooms,
} from "../../data/initialData";
import type { RadiologyExam } from "../../types";
import { normalizeExamStatus } from "../../utils/statusMaps";
import { AppDrawer } from "../../components/common/AppDrawer";

const STATUS_CONFIG: Record<
  string,
  { bg: string; color: string; label: string }
> = {
  SCHEDULED: { bg: "#dbeafe", color: "#2563eb", label: "已登记" },
  ARRIVED: { bg: "#ede9fe", color: "#7c3aed", label: "已报到" },
  IN_PROGRESS: { bg: "#fce7f3", color: "#db2777", label: "检查中" },
  COMPLETED: { bg: "#d1fae5", color: "#059669", label: "已完成" },
  CANCELLED: { bg: "#fee2e2", color: "#ef4444", label: "已取消" },
  已登记: { bg: "#dbeafe", color: "#2563eb", label: "已登记" },
  待检查: { bg: "#ede9fe", color: "#7c3aed", label: "待检查" },
  检查中: { bg: "#fce7f3", color: "#db2777", label: "检查中" },
  待报告: { bg: "#fef9c3", color: "#ca8a04", label: "待报告" },
  已报告: { bg: "#d1fae5", color: "#059669", label: "已报告" },
  已发布: { bg: "#ecfdf5", color: "#047857", label: "已发布" },
  已暂停: { bg: "#fef3c7", color: "#f59e0b", label: "已暂停" },
  质控退回: { bg: "#fee2e2", color: "#ef4444", label: "质控退回" },
};

const PRIORITY_CONFIG: Record<
  string,
  { bg: string; color: string; label: string }
> = {
  普通: { bg: "#f1f5f9", color: "#64748b", label: "普通" },
  紧急: { bg: "#fef3c7", color: "#d97706", label: "紧急" },
  危重: { bg: "#fee2e2", color: "#dc2626", label: "危重" },
  会诊: { bg: "#ede9fe", color: "#7c3aed", label: "会诊" },
};

const getDeviceById = (deviceId: string) =>
  initialModalityDevices.find((d) => d.id === deviceId);
const getRoomById = (roomId: string) =>
  initialExamRooms.find((r) => r.id === roomId);

const generateHistoryExams = (patientId: string): RadiologyExam[] => {
  const patientHistory: Record<string, RadiologyExam[]> = {
    "RAD-P001": [
      {
        id: "HIST001",
        patientId: "RAD-P001",
        patientName: "张志刚",
        gender: "男",
        age: 62,
        patientType: "住院",
        examItemId: "EI-CT-002",
        examItemName: "胸部CT平扫",
        modality: "CT",
        bodyPart: "胸部",
        examDate: "2026-04-15",
        examTime: "10:00",
        priority: "普通",
        clinicalDiagnosis: "肺炎复查",
        clinicalHistory: "咳嗽咳痰1周",
        examIndications: "评估炎症吸收情况",
        technologistId: "R005",
        technologistName: "刘建国",
        deviceId: "DEV-CT-01",
        deviceName: "CT-1",
        roomId: "ROOM-CT1",
        roomName: "CT室1",
        status: "已发布",
        accessionNumber: "20260415001",
        imagesAcquired: 128,
        createdTime: "2026-04-15 09:00",
        updatedTime: "2026-04-15 10:00",
      } as RadiologyExam,
      {
        id: "HIST002",
        patientId: "RAD-P001",
        patientName: "张志刚",
        gender: "男",
        age: 62,
        patientType: "住院",
        examItemId: "EI-CT-006",
        examItemName: "冠脉CTA",
        modality: "CT",
        bodyPart: "心脏",
        examDate: "2026-03-20",
        examTime: "14:00",
        priority: "紧急",
        clinicalDiagnosis: "冠心病筛查",
        clinicalHistory: "胸闷不适",
        examIndications: "评估冠脉情况",
        technologistId: "R005",
        technologistName: "刘建国",
        deviceId: "DEV-CT-01",
        deviceName: "CT-1",
        roomId: "ROOM-CT1",
        roomName: "CT室1",
        status: "已发布",
        accessionNumber: "20260320001",
        imagesAcquired: 256,
        createdTime: "2026-03-20 13:00",
        updatedTime: "2026-03-20 14:00",
      } as RadiologyExam,
    ],
    "RAD-P002": [
      {
        id: "HIST003",
        patientId: "RAD-P002",
        patientName: "李秀英",
        gender: "女",
        age: 55,
        patientType: "门诊",
        examItemId: "EI-MR-001",
        examItemName: "头颅MR平扫",
        modality: "MR",
        bodyPart: "头颅",
        examDate: "2026-02-10",
        examTime: "09:00",
        priority: "普通",
        clinicalDiagnosis: "头痛复查",
        clinicalHistory: "头痛缓解",
        examIndications: "评估治疗效果",
        technologistId: "R005",
        technologistName: "刘建国",
        deviceId: "DEV-MR-01",
        deviceName: "MR-1",
        roomId: "ROOM-MR1",
        roomName: "MR室1",
        status: "已发布",
        accessionNumber: "20260210001",
        imagesAcquired: 1200,
        createdTime: "2026-02-10 08:00",
        updatedTime: "2026-02-10 09:00",
      } as RadiologyExam,
    ],
  };
  return patientHistory[patientId] || [];
};

// ============================================================
// DetailDrawer
// ============================================================
export interface DetailDrawerProps {
  exam: RadiologyExam | null;
  onClose: () => void;
  onEditInfo?: (exam: RadiologyExam) => void;
  onAssignDevice?: (exam: RadiologyExam) => void;
  onWriteReport?: (exam: RadiologyExam) => void;
  onStartExam?: (exam: RadiologyExam) => void;
  onCancelExam?: (exam: RadiologyExam) => void;
}

export function DetailDrawer({
  exam,
  onClose,
  onEditInfo,
  onAssignDevice,
  onWriteReport,
  onStartExam,
  onCancelExam,
}: DetailDrawerProps) {
  const [activeTab, setActiveTab] = useState<
    "info" | "images" | "history" | "log"
  >("info");

  if (!exam) return null;

  const device = getDeviceById(exam.deviceId ?? "");
  const room = getRoomById(exam.roomId ?? "");
  const historyExams = generateHistoryExams(exam.patientId);

  const sc = STATUS_CONFIG[exam.status] || {
    bg: "#f1f5f9",
    color: "#64748b",
    label: exam.status,
  };
  const pc = PRIORITY_CONFIG[exam.priority] || PRIORITY_CONFIG["普通"]!;

  const examLogs = [
    {
      time: exam.createdTime || exam.examDate + " 08:00",
      event: "检查登记",
      operator: "系统",
      status: "登记",
    },
    {
      time: exam.examDate + " 08:30",
      event: "分配设备",
      operator: "护士长 赵雪梅",
      status: "分配",
    },
    exam.examTime
      ? {
          time: exam.examDate + " " + exam.examTime,
          event: "开始检查",
          operator: exam.technologistName || "技师",
          status: "检查",
        }
      : null,
    exam.imagesAcquired > 0
      ? {
          time:
            exam.examDate +
            " " +
            (parseInt(exam.examTime?.split(":")[0] || "0") + 1) +
            ":00",
          event: `图像采集完成（${exam.imagesAcquired}幅）`,
          operator: exam.technologistName || "技师",
          status: "采集",
        }
      : null,
    normalizeExamStatus(exam.status) === "COMPLETED"
      ? {
          time:
            exam.examDate +
            " " +
            (parseInt(exam.examTime?.split(":")[0] || "0") + 2) +
            ":00",
          event: "报告书写",
          operator: "报告医生",
          status: "报告",
        }
      : null,
  ].filter(Boolean) as {
    time: string;
    event: string;
    operator: string;
    status: string;
  }[];

  const DrawerTab = ({
    label,
    tabKey,
    icon,
  }: {
    label: string;
    tabKey: typeof activeTab;
    icon: React.ReactNode;
  }) => (
    <button
      onClick={() => setActiveTab(tabKey)}
      style={{
        padding: "8px 14px",
        border: "none",
        background: activeTab === tabKey ? "#1e3a5f" : "transparent",
        color: activeTab === tabKey ? "#fff" : "#64748b",
        fontSize: 12,
        fontWeight: 600,
        cursor: "pointer",
        borderRadius: 6,
        display: "flex",
        alignItems: "center",
        gap: 6,
        transition: "all 0.15s",
      }}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <AppDrawer
      open={!!exam}
      onClose={onClose}
      placement="right"
      width={500}
      title={
        <div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>检查详情</div>
          <div
            style={{
              fontSize: 12,
              fontFamily: "monospace",
              opacity: 0.8,
              marginTop: 2,
            }}
          >
            {exam.accessionNumber}
          </div>
        </div>
      }
      headerStyle={{
        background: "linear-gradient(135deg, #1e3a5f 0%, #2d4a6f 100%)",
        color: "#fff",
        borderBottom: "none",
      }}
    >
      <div
        style={{
          padding: "16px 20px",
          borderBottom: "1px solid #f1f5f9",
          background: "#f8fafc",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: "#1e3a5f",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              {exam.patientName}
              {exam.priority === "危重" && (
                <AlertTriangle size={18} style={{ color: "#dc2626" }} />
              )}
              {exam.priority === "紧急" && (
                <Zap size={18} style={{ color: "#d97706" }} />
              )}
            </div>
            <div
              style={{
                display: "flex",
                gap: 8,
                marginTop: 8,
                flexWrap: "wrap",
              }}
            >
              <span
                style={{
                  padding: "3px 10px",
                  background: "#f1f5f9",
                  color: "#64748b",
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 500,
                }}
              >
                {exam.gender} / {exam.age}岁
              </span>
              <span
                style={{
                  padding: "3px 10px",
                  background:
                    exam.patientType === "急诊"
                      ? "#fee2e2"
                      : exam.patientType === "住院"
                        ? "#dbeafe"
                        : "#f1f5f9",
                  color:
                    exam.patientType === "急诊"
                      ? "#dc2626"
                      : exam.patientType === "住院"
                        ? "#2563eb"
                        : "#64748b",
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {exam.patientType}
              </span>
              <span
                style={{
                  ...pc,
                  padding: "3px 10px",
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {pc.label}
              </span>
              <span
                style={{
                  ...sc,
                  padding: "3px 10px",
                  borderRadius: 12,
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {sc.label}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          padding: "12px 20px",
          borderBottom: "1px solid #e2e8f0",
          display: "flex",
          gap: 8,
          background: "#fff",
        }}
      >
        <DrawerTab label="基本信息" tabKey="info" icon={<User size={12} />} />
        <DrawerTab
          label="影像信息"
          tabKey="images"
          icon={<Images size={12} />}
        />
        <DrawerTab
          label="历史检查"
          tabKey="history"
          icon={<History size={12} />}
        />
        <DrawerTab
          label="操作日志"
          tabKey="log"
          icon={<Clipboard size={12} />}
        />
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
        {activeTab === "info" && (
          <div>
            <div style={{ marginBottom: 20 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#1e3a5f",
                  marginBottom: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <UserCog size={14} />
                患者信息
              </div>
              <div
                style={{
                  background: "#f8fafc",
                  borderRadius: 10,
                  padding: 14,
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                }}
              >
                {[
                  ["患者ID", exam.patientId],
                  ["姓名", exam.patientName],
                  ["性别", exam.gender],
                  ["年龄", exam.age + "岁"],
                  ["患者类型", exam.patientType],
                  ["联系电话", "138****8001"],
                  ["出生日期", "1964-02-15"],
                  ["体重", "65kg"],
                ].map(([label, value]) => (
                  <div key={label}>
                    <div
                      style={{
                        fontSize: 12,
                        color: "#94a3b8",
                        marginBottom: 2,
                      }}
                    >
                      {label}
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        color: "#334155",
                        fontWeight: 500,
                      }}
                    >
                      {value}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#1e3a5f",
                  marginBottom: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Stethoscope size={14} />
                检查信息
              </div>
              <div
                style={{ background: "#f8fafc", borderRadius: 10, padding: 14 }}
              >
                {[
                  ["检查项目", exam.examItemName],
                  ["检查设备", device?.name || "-"],
                  ["检查室", room?.name || "-"],
                  ["检查日期", exam.examDate],
                  ["检查时间", exam.examTime || "-"],
                  ["设备类型", exam.modality],
                  ["检查部位", exam.bodyPart],
                  ["申请医生", "李明辉 主任医师"],
                  ["临床诊断", exam.clinicalDiagnosis || "-"],
                  ["病史摘要", exam.clinicalHistory || "-"],
                  ["检查指征", exam.examIndications || "-"],
                ].map(([label, value], idx, arr) => (
                  <div
                    key={label}
                    style={{
                      padding: "8px 0",
                      borderBottom:
                        idx < arr.length - 1 ? "1px solid #e2e8f0" : "none",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        color: "#94a3b8",
                        marginBottom: 2,
                      }}
                    >
                      {label}
                    </div>
                    <div style={{ fontSize: 13, color: "#334155" }}>
                      {value}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "images" && (
          <div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "#1e3a5f",
                marginBottom: 12,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Images size={14} />
              已采集图像
            </div>
            <div
              style={{
                background: "#f8fafc",
                borderRadius: 10,
                padding: 20,
                textAlign: "center",
              }}
            >
              <div
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 12,
                  background: "#e2e8f0",
                  margin: "0 auto 16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Image size={32} style={{ color: "#94a3b8" }} />
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#1e3a5f" }}>
                {exam.imagesAcquired}
              </div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                幅图像
              </div>
              <div
                style={{
                  marginTop: 16,
                  padding: "8px 12px",
                  background: "#fff",
                  borderRadius: 6,
                  fontSize: 12,
                  color: "#64748b",
                  border: "1px dashed #cbd5e1",
                }}
              >
                点击"查看图像"按钮打开图像查看器
              </div>
            </div>
          </div>
        )}

        {activeTab === "history" && (
          <div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "#1e3a5f",
                marginBottom: 12,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <History size={14} />
              历史检查记录
            </div>
            {historyExams.length > 0 ? (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 10 }}
              >
                {historyExams.map((hist) => {
                  const histSc = STATUS_CONFIG[hist.status] || {
                    bg: "#f1f5f9",
                    color: "#64748b",
                    label: hist.status,
                  };
                  return (
                    <div
                      key={hist.id}
                      style={{
                        background: "#f8fafc",
                        borderRadius: 10,
                        padding: 12,
                        border: "1px solid #e2e8f0",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          marginBottom: 8,
                        }}
                      >
                        <div
                          style={{
                            fontWeight: 600,
                            color: "#334155",
                            fontSize: 12,
                          }}
                        >
                          {hist.examItemName}
                        </div>
                        <span
                          style={{
                            ...histSc,
                            padding: "2px 8px",
                            borderRadius: 8,
                            fontSize: 12,
                            fontWeight: 600,
                          }}
                        >
                          {histSc.label}
                        </span>
                      </div>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: 6,
                          fontSize: 12,
                          color: "#64748b",
                        }}
                      >
                        <span>{hist.examDate}</span>
                        <span>{hist.modality}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div
                style={{
                  background: "#f8fafc",
                  borderRadius: 10,
                  padding: 40,
                  textAlign: "center",
                  color: "#94a3b8",
                }}
              >
                <History
                  size={32}
                  style={{ margin: "0 auto 12px", opacity: 0.4 }}
                />
                <div style={{ fontSize: 12 }}>暂无历史检查记录</div>
              </div>
            )}
          </div>
        )}

        {activeTab === "log" && (
          <div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "#1e3a5f",
                marginBottom: 12,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <ClipboardList size={14} />
              操作日志
            </div>
            <div style={{ position: "relative" }}>
              <div
                style={{
                  position: "absolute",
                  left: 11,
                  top: 0,
                  bottom: 0,
                  width: 2,
                  background: "#e2e8f0",
                }}
              />
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {examLogs.map((log, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      gap: 16,
                      paddingBottom: idx < examLogs.length - 1 ? 20 : 0,
                      position: "relative",
                    }}
                  >
                    <div
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: "50%",
                        background: "#1e3a5f",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#fff",
                        fontSize: 12,
                        fontWeight: 700,
                        flexShrink: 0,
                        zIndex: 1,
                      }}
                    >
                      {idx + 1}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          background: "#f8fafc",
                          borderRadius: 8,
                          padding: "10px 14px",
                          border: "1px solid #e2e8f0",
                        }}
                      >
                        <div
                          style={{
                            fontWeight: 600,
                            color: "#334155",
                            fontSize: 12,
                            marginBottom: 4,
                          }}
                        >
                          {log.event}
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            color: "#64748b",
                            display: "flex",
                            justifyContent: "space-between",
                          }}
                        >
                          <span>{log.operator}</span>
                          <span style={{ fontFamily: "monospace" }}>
                            {log.time}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div
        style={{
          padding: 16,
          borderTop: "1px solid #e2e8f0",
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 10,
          background: "#f8fafc",
        }}
      >
        <button
          onClick={() => onEditInfo?.(exam)}
          style={{
            padding: "10px 16px",
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            color: "#334155",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          <Edit3 size={12} />
          修改信息
        </button>
        <button
          onClick={() => onAssignDevice?.(exam)}
          style={{
            padding: "10px 16px",
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            color: "#334155",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          <UserCheck size={12} />
          分配设备
        </button>
        <button
          onClick={() => onWriteReport?.(exam)}
          style={{
            padding: "10px 16px",
            background: normalizeExamStatus(exam.status) === "COMPLETED" ? "#1e3a5f" : "#e2e8f0",
            border: "none",
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            color: normalizeExamStatus(exam.status) === "COMPLETED" ? "#fff" : "#94a3b8",
            cursor: normalizeExamStatus(exam.status) === "COMPLETED" ? "pointer" : "not-allowed",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          <FileText size={12} />
          {normalizeExamStatus(exam.status) === "COMPLETED" ? "书写报告" : "查看报告"}
        </button>
        <button
          onClick={() => onStartExam?.(exam)}
          style={{
            padding: "10px 16px",
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            color: "#334155",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          <ArrowLeftRight size={12} />
          开始检查
        </button>
        <button
          onClick={() => onCancelExam?.(exam)}
          style={{
            padding: "10px 16px",
            background: "#fff",
            border: "1px solid #fee2e2",
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            color: "#dc2626",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          <XCircle size={12} />
          取消检查
        </button>
        <button
          style={{
            padding: "10px 16px",
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            color: "#334155",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          <Printer size={12} />
          打印条码
        </button>
      </div>
    </AppDrawer>
  );
}
