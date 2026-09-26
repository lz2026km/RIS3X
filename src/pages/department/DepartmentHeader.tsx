import { Briefcase, Download, Plus } from "lucide-react";
import { PageHeader } from "../../components/common";
import { t } from "../../i18n/appI18n";

const C = { primary: "#1e40af", white: "#ffffff", border: "#d1d5db" };

interface DepartmentHeaderProps {
  onExport: () => void;
  onAdd: () => void;
}

export default function DepartmentHeader({ onExport, onAdd }: DepartmentHeaderProps) {
  return (
    <PageHeader
      title={t('w9e.departmentHeader.title')}
      icon={<Briefcase style={{ width: 24, height: 24, color: C.primary }} />}
      actions={
        <>
          <button onClick={onExport} style={{ padding: "8px 16px", background: C.white, border: `1px solid ${C.border}`, borderRadius: 6, cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
            <Download style={{ width: 14, height: 14 }} /> {t('w9e.departmentHeader.exportReport')}
          </button>
          <button onClick={onAdd} style={{ padding: "8px 16px", background: C.primary, color: C.white, border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
            <Plus style={{ width: 14, height: 14 }} /> {t('w9e.departmentHeader.addStaff')}
          </button>
        </>
      }
    />
  );
}
