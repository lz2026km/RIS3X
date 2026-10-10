import { AppDrawer } from "../../components/common/AppDrawer";
import { initialUsers } from "../../data/initialData";
import type { RadiologyExam } from "../../types";
import { Printer } from "lucide-react";

// ============================================================
// 申请单 (Requisition) Drawer — 患者/检查/临床信息/申请医生
// 打印: 打开独立打印窗口 (隐藏页面其余内容)
// ============================================================

const getDoctorName = (id?: string): string => {
  if (!id) return "-";
  const found = initialUsers.find(u => u.id === id);
  return found?.name ?? id;
};

function buildRequisitionHtml(exam: RadiologyExam): string {
  const rows: Array<[string, string]> = [
    ["患者姓名", exam.patientName],
    ["患者ID", exam.patientId],
    ["性别", exam.gender],
    ["年龄", `${exam.age}岁`],
    ["患者类型", exam.patientType],
    ["检查项目", exam.examItemName],
    ["检查部位", exam.bodyPart],
    ["设备类型", exam.modality],
    ["检查日期", exam.examDate],
    ["检查时间", exam.examTime || "-"],
    ["检查号", exam.accessionNumber || "-"],
    ["优先级", exam.priority],
    ["申请医生", exam.referringDoctorName || getDoctorName(exam.referringDoctorId)],
    ["申请科室", exam.referringDoctorDept || "-"],
    ["临床诊断", exam.clinicalDiagnosis || "-"],
    ["病史摘要", exam.clinicalHistory || "-"],
    ["检查指征", exam.examIndications || "-"],
  ];
  const bodyRows = rows
    .map(([label, value]) => `
      <tr>
        <td class="label">${label}</td>
        <td>${String(value ?? '-').replace(/[<>&]/g, (c: string) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c] ?? c)}</td>
      </tr>`)
    .join("");
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<title>放射检查申请单 - ${exam.accessionNumber || exam.id}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: "Microsoft YaHei", SimSun, sans-serif; color: #1e293b; padding: 32px; }
  .header { text-align: center; border-bottom: 2px solid #1e40af; padding-bottom: 12px; margin-bottom: 20px; }
  .header h1 { font-size: 22px; color: #1e40af; letter-spacing: 6px; }
  .header .meta { font-size: 12px; color: #64748b; margin-top: 6px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  td { border: 1px solid #cbd5e1; padding: 8px 10px; }
  td.label { width: 130px; background: #f1f5f9; color: #475569; font-weight: 600; }
  .footer { margin-top: 32px; display: flex; justify-content: space-between; font-size: 12px; color: #64748b; }
  .footer .sign { text-align: center; width: 200px; }
  .footer .sign .line { margin-top: 36px; border-top: 1px solid #94a3b8; padding-top: 4px; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
  <div class="header">
    <h1>放射科检查申请单</h1>
    <div class="meta">G005 放射科RIS系统 · 申请单号: ${exam.accessionNumber || exam.id}</div>
  </div>
  <table>
    ${bodyRows}
  </table>
  <div class="footer">
    <div class="sign"><div>申请医师签名</div><div class="line">${exam.referringDoctorName || getDoctorName(exam.referringDoctorId)}</div></div>
    <div class="sign"><div>申请日期</div><div class="line">${exam.examDate || '-'}</div></div>
    <div class="sign"><div>放射科确认</div><div class="line"></div></div>
  </div>
</body>
</html>`;
}

function handlePrint(exam: RadiologyExam) {
  const win = window.open("", "_blank", "width=820,height=900");
  if (!win) return;
  win.document.write(buildRequisitionHtml(exam));
  win.document.close();
  win.focus();
  win.print();
}

export interface RequisitionDrawerProps {
  exam: RadiologyExam | null;
  onClose: () => void;
}

export function RequisitionDrawer({ exam, onClose }: RequisitionDrawerProps) {
  if (!exam) return null;
  return (
    <AppDrawer
      open={!!exam}
      onClose={onClose}
      placement="right"
      width={560}
      title="检查申请单"
      footer={
        <>
          <button
            onClick={onClose}
            style={{
              padding: "8px 16px",
              border: "1px solid var(--border-color)",
              borderRadius: 8,
              background: "var(--bg-card)",
              fontSize: 12,
              fontWeight: 600,
              color: "var(--text-secondary)",
              cursor: "pointer",
            }}
          >
            关闭
          </button>
          <button
            onClick={() => handlePrint(exam)}
            style={{
              padding: "8px 16px",
              border: "none",
              borderRadius: 8,
              background: "#1e40af",
              fontSize: 12,
              fontWeight: 600,
              color: "#fff",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Printer size={12} />
            打印申请单
          </button>
        </>
      }
    >
      <div style={{ border: "1px solid var(--border-color)", borderRadius: 10, overflow: "hidden" }}>
        <div style={{ textAlign: "center", padding: "14px 16px", background: "var(--bg-card)", borderBottom: "1px solid var(--border-color)" }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#1e40af", letterSpacing: 4 }}>放射科检查申请单</div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
            申请单号: {exam.accessionNumber || exam.id}
          </div>
        </div>
        {[
          ["患者姓名", exam.patientName],
          ["患者ID", exam.patientId],
          ["性别 / 年龄", `${exam.gender} / ${exam.age}岁`],
          ["患者类型", exam.patientType],
        ].map(([label, value]) => (
          <div key={label} style={{ display: "flex", borderBottom: "1px solid var(--border-light)" }}>
            <div style={{ width: 130, padding: "10px 12px", background: "var(--bg-card)", fontSize: 12, color: "var(--text-secondary)", fontWeight: 600, flexShrink: 0 }}>{label}</div>
            <div style={{ padding: "10px 12px", fontSize: 12, color: "var(--text-primary)" }}>{String(value ?? "-")}</div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 12, fontWeight: 700, color: "#1e40af", margin: "20px 0 10px" }}>检查信息</div>
      <div style={{ border: "1px solid var(--border-color)", borderRadius: 10, overflow: "hidden" }}>
        {[
          ["检查项目", exam.examItemName],
          ["检查部位", `${exam.modality} · ${exam.bodyPart}`],
          ["检查日期", exam.examDate],
          ["检查时间", exam.examTime || "-"],
          ["优先级", exam.priority],
        ].map(([label, value]) => (
          <div key={label} style={{ display: "flex", borderBottom: "1px solid var(--border-light)" }}>
            <div style={{ width: 130, padding: "10px 12px", background: "var(--bg-card)", fontSize: 12, color: "var(--text-secondary)", fontWeight: 600, flexShrink: 0 }}>{label}</div>
            <div style={{ padding: "10px 12px", fontSize: 12, color: "var(--text-primary)" }}>{String(value ?? "-")}</div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 12, fontWeight: 700, color: "#1e40af", margin: "20px 0 10px" }}>临床信息</div>
      <div style={{ border: "1px solid var(--border-color)", borderRadius: 10, overflow: "hidden" }}>
        {[
          ["申请医生", exam.referringDoctorName || getDoctorName(exam.referringDoctorId)],
          ["申请科室", exam.referringDoctorDept || "-"],
          ["临床诊断", exam.clinicalDiagnosis || "-"],
          ["病史摘要", exam.clinicalHistory || "-"],
          ["检查指征", exam.examIndications || "-"],
        ].map(([label, value]) => (
          <div key={label} style={{ display: "flex", borderBottom: "1px solid var(--border-light)" }}>
            <div style={{ width: 130, padding: "10px 12px", background: "var(--bg-card)", fontSize: 12, color: "var(--text-secondary)", fontWeight: 600, flexShrink: 0 }}>{label}</div>
            <div style={{ padding: "10px 12px", fontSize: 12, color: "var(--text-primary)" }}>{String(value ?? "-")}</div>
          </div>
        ))}
      </div>
    </AppDrawer>
  );
}

export default RequisitionDrawer;
