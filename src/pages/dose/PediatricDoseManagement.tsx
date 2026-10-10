import { useEffect, useState } from "react";
import { Baby, Info, User, AlertTriangle } from "lucide-react";
import { pediatricDoseRecords } from "./mockData";
import { getAlertBadge } from "./utils";
import { rdsrApi } from "../../services/api/rdsrApi";
import { DataTable } from "../../components/common";
import { LoadingBanner, ErrorBanner, AppEmpty } from "../../components/feedback";
import { t } from "../../i18n/appI18n";
import type { PediatricDoseRecord } from "./types";

// [W10-B] 儿科剂量: 优先取 /rdsr/pediatric, 端点不可用/返回空时回退内置演示数据。
export default function PediatricDoseManagement() {
  const [records, setRecords] = useState<PediatricDoseRecord[]>(pediatricDoseRecords);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await rdsrApi.getPediatric();
        if (!cancelled && res.success && Array.isArray(res.data) && res.data.length > 0) {
          setRecords(res.data);
          setLoadError(null);
        } else if (!cancelled) {
          setLoadError(t('w9.states.error'));
        }
      } catch {
        if (!cancelled) setLoadError(t('w9.states.error'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const totalPediatricExams = records.length;
  const ageGroups = {
    "0-5岁": records.filter((r: PediatricDoseRecord) => r.ageGroup === "0-5岁").length,
    "5-10岁": records.filter((r: PediatricDoseRecord) => r.ageGroup === "5-10岁").length,
    "10-15岁": records.filter((r: PediatricDoseRecord) => r.ageGroup === "10-15岁").length,
  };
  const avgReductionFactor =
    totalPediatricExams === 0
      ? 0
      : records.reduce(
          (s: number, r: PediatricDoseRecord) => s + r.doseReductionFactor,
          0,
        ) / totalPediatricExams;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 'var(--space-4, 16px)' }}>
      {loading && <LoadingBanner message={t('w9.states.loading')} />}
      {loadError && !loading && <ErrorBanner message={loadError} />}

      <div
        style={{
          padding: "8px 12px",
          background: "#fef3c7",
          color: "var(--color-warning-600)",
          borderRadius: 8,
          fontSize: 12,
          display: "flex",
          alignItems: "center",
          gap: 'var(--space-2, 8px)',
        }}
      >
        <AlertTriangle size={14} /> 演示数据：rdsrApi 无儿童专项端点（患者记录未含年龄分组），儿童剂量记录为本地模拟
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 'var(--space-3, 12px)',
        }}
      >
        <Stat label="儿童检查总量" value={totalPediatricExams} suffix="人次" color="var(--color-primary-800)" />
        <Stat label="0-5岁" value={ageGroups["0-5岁"]} suffix="幼儿" color="var(--color-error-600)" />
        <Stat label="5-10岁" value={ageGroups["5-10岁"]} suffix="儿童" color="var(--color-warning-600)" />
        <Stat label="10-15岁" value={ageGroups["10-15岁"]} suffix="青少年" color="var(--color-success-600)" />
        <Stat
          label="平均折扣系数"
          value={`${(avgReductionFactor * 100).toFixed(0)}%`}
          suffix="相对成人"
          color="var(--color-primary-800)"
        />
      </div>

      <ReductionFactorCards />

      {!loading && records.length === 0 ? (
        <AppEmpty variant="no-data" />
      ) : (
        <RecordsTable records={records} />
      )}

      <div
        style={{
          padding: "12px 16px",
          background: "#eff6ff",
          borderRadius: 8,
          border: "1px solid #bfdbfe",
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
        }}
      >
        <Info size={14} color="var(--color-primary-800)" style={{ marginTop: 2, flexShrink: 0 }} />
        <div style={{ fontSize: 12, color: "var(--color-primary-800)", lineHeight: 1.6 }}>
          <strong>儿童剂量管理要点：</strong>
          儿童患者对辐射更敏感，应根据年龄组选择适当的剂量折扣系数。
          系统会自动计算儿童患者相对于成人剂量的折扣值，确保辐射防护的最优化。
          AAPM和欧盟指南均建议对儿童CT检查实施年龄特异性剂量管理。
        </div>
      </div>
    </div>
  );
}

function ReductionFactorCards() {
  return (
    <div
      style={{
        background: "var(--bg-card)",
        borderRadius: 12,
        padding: 'var(--space-5, 20px)',
        border: "1px solid #e2e8f0",
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: "var(--color-primary-800)",
          marginBottom: 'var(--space-4, 16px)',
        }}
      >
        儿童CT剂量折扣系数参考
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 'var(--space-3, 12px)',
        }}
      >
        <ReductionCard age="0-5岁" factor="40%" formula="DLP = 成人 × 0.4" color="var(--color-error-600)" bg="#fef2f2" border="#fecaca" />
        <ReductionCard age="5-10岁" factor="60%" formula="DLP = 成人 × 0.6" color="var(--color-warning-600)" bg="#fffbeb" border="#fde68a" />
        <ReductionCard age="10-15岁" factor="70%" formula="DLP = 成人 × 0.7" color="var(--color-primary-800)" bg="#eff6ff" border="#bfdbfe" />
        <ReductionCard age="15岁以上" factor="100%" formula="DLP = 成人 × 1.0" color="var(--color-success-600)" bg="#f0fdf4" border="#bbf7d0" icon="user" />
      </div>
    </div>
  );
}

function ReductionCard({
  age,
  factor,
  formula,
  color,
  bg,
  border,
  icon,
}: {
  age: string;
  factor: string;
  formula: string;
  color: string;
  bg: string;
  border: string;
  icon?: "user";
}) {
  return (
    <div
      style={{
        padding: 'var(--space-4, 16px)',
        background: bg,
        borderRadius: 8,
        textAlign: "center",
        border: `1px solid ${border}`,
      }}
    >
      {icon === "user" ? (
        <User size={24} color={color} style={{ marginBottom: 'var(--space-2, 8px)' }} />
      ) : (
        <Baby size={24} color={color} style={{ marginBottom: 'var(--space-2, 8px)' }} />
      )}
      <div style={{ fontSize: 14, fontWeight: 700, color }}>{age}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color, marginTop: 'var(--space-1, 4px)' }}>{factor}</div>
      <div style={{ fontSize: 12, color: "#64748b", marginTop: 'var(--space-1, 4px)' }}>{formula}</div>
    </div>
  );
}

function RecordsTable({ records }: { records: PediatricDoseRecord[] }) {
  return (
    <div
      style={{
        background: "var(--bg-card)",
        borderRadius: 12,
        padding: 'var(--space-5, 20px)',
        border: "1px solid #e2e8f0",
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: "var(--color-primary-800)",
          marginBottom: 'var(--space-4, 16px)',
        }}
      >
        儿童CT检查记录
      </div>
      <div style={{ overflowX: "auto" }}>
        <DataTable
          rowKey="id"
          dataSource={records}
          showPagination={false}
          showExport={false}
          showDensity={false}
          columns={[
            { title: "患者姓名", dataIndex: "patientName", key: "patientName", align: "center", render: (v: string) => <span style={{ fontWeight: 600, color: "var(--color-primary-800)" }}>{v}</span> },
            { title: "年龄", dataIndex: "age", key: "age", align: "center", render: (v: number) => <span style={{ color: "#334155" }}>{v}</span> },
            {
              title: "年龄组", dataIndex: "ageGroup", key: "ageGroup", align: "center",
              render: (v: string) => {
                const ageGroupColor = v === "0-5岁" ? "var(--color-error-600)" : v === "5-10岁" ? "var(--color-warning-600)" : "var(--color-primary-800)";
                const ageGroupBg = v === "0-5岁" ? "#fef2f2" : v === "5-10岁" ? "#fffbeb" : "#eff6ff";
                return <span style={{ padding: "2px 8px", background: ageGroupBg, color: ageGroupColor, borderRadius: 4, fontSize: 12, fontWeight: 600 }}>{v}</span>;
              },
            },
            { title: "性别", dataIndex: "gender", key: "gender", align: "center", render: (v: string) => <span style={{ color: "#334155" }}>{v}</span> },
            { title: "检查日期", dataIndex: "examDate", key: "examDate", align: "center", render: (v: string) => <span style={{ color: "#64748b" }}>{v}</span> },
            { title: "设备", dataIndex: "device", key: "device", align: "center", render: (v: string) => <span style={{ color: "#334155" }}>{v}</span> },
            { title: "检查项目", dataIndex: "examItem", key: "examItem", align: "center", render: (v: string) => <span style={{ color: "#334155" }}>{v}</span> },
            { title: "剂量值", dataIndex: "doseValue", key: "doseValue", align: "center", render: (v: number) => <span style={{ fontWeight: 700, color: "var(--color-primary-800)" }}>{v}</span> },
            {
              title: "折扣系数", dataIndex: "doseReductionFactor", key: "doseReductionFactor", align: "center",
              render: (v: number) => <span style={{ padding: "2px 8px", background: "#eff6ff", color: "var(--color-primary-800)", borderRadius: 4, fontSize: 12, fontWeight: 600 }}>×{v.toFixed(1)}</span>,
            },
            {
              title: "预警级别", dataIndex: "alertLevel", key: "alertLevel", align: "center",
              render: (v: PediatricDoseRecord["alertLevel"]) => {
                const badge = getAlertBadge(v);
                return <span style={{ padding: "2px 8px", background: badge.bg, color: badge.color, borderRadius: 4, fontSize: 12, fontWeight: 700 }}>{badge.label}级</span>;
              },
            },
          ]}
        />
      </div>
    </div>
  );
}

const Stat = ({
  label,
  value,
  suffix,
  color,
}: {
  label: string;
  value: string | number;
  suffix: string;
  color: string;
}) => (
  <div
    style={{
      background: "var(--bg-card)",
      borderRadius: 10,
      padding: "14px 16px",
      border: "1px solid #e2e8f0",
      textAlign: "center",
    }}
  >
    <div style={{ fontSize: 12, color: "#64748b" }}>{label}</div>
    <div style={{ fontSize: 24, fontWeight: 800, color, marginTop: 'var(--space-1, 4px)' }}>{value}</div>
    <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>{suffix}</div>
  </div>
);