// @ts-nocheck
import { Briefcase, Download, Plus } from "lucide-react";
import { PageHeader } from "../../components/common";

const C = { primary: "#1e40af", white: "#ffffff", border: "#d1d5db" };

export default function DepartmentHeader({ onExport, onAdd }) {
  return (
    <PageHeader
      title="影像科室管理"
      icon={<Briefcase style={{ width: 24, height: 24, color: C.primary }} />}
      actions={
        <>
          <button onClick={onExport} style={{ padding: "8px 16px", background: C.white, border: `1px solid ${C.border}`, borderRadius: 6, cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
            <Download style={{ width: 14, height: 14 }} /> 导出报表
          </button>
          <button onClick={onAdd} style={{ padding: "8px 16px", background: C.primary, color: C.white, border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
            <Plus style={{ width: 14, height: 14 }} /> 添加人员
          </button>
        </>
      }
    />
  );
}
