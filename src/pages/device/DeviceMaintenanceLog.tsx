import { useMemo, useState } from "react";
import { FileText, CalendarDays } from "lucide-react";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import { DataTable } from "../../components/common";
import { FilterBar } from "../../components/common/FilterBar";
import { C } from "./DeviceStatusBadge";

interface MaintRecord {
  id: string;
  deviceId: string;
  deviceName: string;
  date: string;
  type: string;
  engineer: string;
  cost: number;
  content: string;
  result: string;
  nextDate: string;
}

interface MaintPlan {
  id: string;
  deviceId: string;
  deviceName: string;
  planDate: string;
  type: string;
  content: string;
  estimatedCost: number | string;
  assignee: string;
}

export function MaintenanceHistoryTable({
  records,
}: {
  records: MaintRecord[];
}) {
  // [v3.0.6.16-6] 维保历史筛选 (关键词/时间范围/类型/人员)
  const [keyword, setKeyword] = useState("");
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [dateRange, setDateRange] = useState<
    [Dayjs | null, Dayjs | null] | null
  >(null);

  const filteredRecords = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return records.filter((r) => {
      const matchKw =
        !kw ||
        [r.deviceName, r.engineer, r.content].some((v) =>
          String(v ?? "")
            .toLowerCase()
            .includes(kw),
        );
      const matchType = !filterValues.type || r.type === filterValues.type;
      const matchEngineer =
        !filterValues.engineer || r.engineer === filterValues.engineer;
      let matchDate = true;
      if (dateRange && (dateRange[0] || dateRange[1])) {
        const d = dayjs(r.date);
        if (!d.isValid()) matchDate = false;
        else {
          if (dateRange[0] && d.isBefore(dateRange[0].startOf("day")))
            matchDate = false;
          if (dateRange[1] && d.isAfter(dateRange[1].endOf("day")))
            matchDate = false;
        }
      }
      return matchKw && matchType && matchEngineer && matchDate;
    });
  }, [records, keyword, filterValues, dateRange]);

  const historyTypeOptions = useMemo(
    () =>
      Array.from(new Set(records.map((r) => r.type)))
        .filter(Boolean)
        .map((v) => ({ value: v, label: v })),
    [records],
  );
  const engineerOptions = useMemo(
    () =>
      Array.from(new Set(records.map((r) => r.engineer)))
        .filter(Boolean)
        .map((v) => ({ value: v, label: v })),
    [records],
  );

  return (
    <div
      style={{
        background: C.white,
        borderRadius: 12,
        padding: "var(--space-4, 16px)",
        border: `1px solid ${C.border}`,
        marginBottom: 18,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 14,
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: C.primary,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <FileText size={14} style={{ color: C.accent }} /> 维保历史记录
        </div>
        <span style={{ fontSize: 12, color: C.textLight }}>
          共 {filteredRecords.length} 条记录
        </span>
      </div>
      <FilterBar
        searchPlaceholder="搜索设备/工程师/内容..."
        searchValue={keyword}
        onSearchChange={setKeyword}
        dateRange={{ value: dateRange, onChange: setDateRange }}
        filters={[
          { key: "type", label: "维保类型", options: historyTypeOptions },
          { key: "engineer", label: "工程师", options: engineerOptions },
        ]}
        filterValues={filterValues}
        onFilterChange={(k, v) =>
          setFilterValues((prev) => ({ ...prev, [k]: v }))
        }
        onReset={() => {
          setKeyword("");
          setFilterValues({});
          setDateRange(null);
        }}
      />
      <DataTable
        dataSource={filteredRecords}
        rowKey="id"
        pagination={false}
        columns={[
          {
            title: "设备名称",
            dataIndex: "deviceName",
            render: (v: string) => (
              <span style={{ fontWeight: 600, color: C.textDark }}>
                {v.split("（")[0]}
              </span>
            ),
          },
          {
            title: "维保日期",
            dataIndex: "date",
            align: "center",
            render: (v: string) => (
              <span style={{ color: C.textMid }}>{v}</span>
            ),
          },
          {
            title: "维保类型",
            dataIndex: "type",
            align: "center",
            render: (v: string) => (
              <span
                style={{
                  padding: "2px 8px",
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 700,
                  background:
                    v === "故障维修" ? `${C.danger}15` : `${C.accent}15`,
                  color: v === "故障维修" ? C.danger : C.accent,
                }}
              >
                {v}
              </span>
            ),
          },
          {
            title: "维保内容",
            dataIndex: "content",
            render: (v: string) => (
              <span style={{ color: C.textDark }}>{v}</span>
            ),
          },
          {
            title: "工程师",
            dataIndex: "engineer",
            align: "center",
            render: (v: string) => (
              <span style={{ color: C.textMid }}>{v}</span>
            ),
          },
          {
            title: "费用",
            dataIndex: "cost",
            align: "center",
            render: (v: number) => (
              <span style={{ fontWeight: 700, color: C.warning }}>
                ¥{v.toLocaleString()}
              </span>
            ),
          },
          {
            title: "结果",
            dataIndex: "result",
            align: "center",
            render: (v: string) => (
              <span
                style={{
                  padding: "2px 8px",
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 700,
                  background: `${C.success}15`,
                  color: C.success,
                }}
              >
                {v}
              </span>
            ),
          },
          {
            title: "下次日期",
            dataIndex: "nextDate",
            align: "center",
            render: (v: string) => (
              <span style={{ color: C.textMid }}>{v}</span>
            ),
          },
        ]}
      />
    </div>
  );
}

export function MaintenancePlanTable({
  plans,
  onAddPlan,
  onDeletePlan,
  onCompletePlan,
}: {
  plans: MaintPlan[];
  onAddPlan?: () => void;
  onDeletePlan?: (plan: MaintPlan) => void;
  onCompletePlan?: (plan: MaintPlan) => void;
}) {
  const hasActions = Boolean(onDeletePlan || onCompletePlan);
  // [v3.0.6.16-6] 保养计划筛选 (关键词/时间范围/类型/人员)
  const [keyword, setKeyword] = useState("");
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [dateRange, setDateRange] = useState<
    [Dayjs | null, Dayjs | null] | null
  >(null);

  const filteredPlans = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return plans.filter((p) => {
      const matchKw =
        !kw ||
        [p.deviceName, p.assignee, p.content].some((v) =>
          String(v ?? "")
            .toLowerCase()
            .includes(kw),
        );
      const matchType = !filterValues.type || p.type === filterValues.type;
      const matchAssignee =
        !filterValues.assignee || p.assignee === filterValues.assignee;
      let matchDate = true;
      if (dateRange && (dateRange[0] || dateRange[1])) {
        const d = dayjs(p.planDate);
        if (!d.isValid()) matchDate = false;
        else {
          if (dateRange[0] && d.isBefore(dateRange[0].startOf("day")))
            matchDate = false;
          if (dateRange[1] && d.isAfter(dateRange[1].endOf("day")))
            matchDate = false;
        }
      }
      return matchKw && matchType && matchAssignee && matchDate;
    });
  }, [plans, keyword, filterValues, dateRange]);

  const planTypeOptions = useMemo(
    () =>
      Array.from(new Set(plans.map((p) => p.type)))
        .filter(Boolean)
        .map((v) => ({ value: v, label: v })),
    [plans],
  );
  const assigneeOptions = useMemo(
    () =>
      Array.from(new Set(plans.map((p) => p.assignee)))
        .filter(Boolean)
        .map((v) => ({ value: v, label: v })),
    [plans],
  );

  return (
    <div
      style={{
        background: C.white,
        borderRadius: 12,
        padding: "var(--space-4, 16px)",
        border: `1px solid ${C.border}`,
        marginBottom: 18,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 14,
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: C.primary,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <CalendarDays size={14} style={{ color: C.warning }} />{" "}
          保养计划列表（季度/半年/年度）
        </div>
        {onAddPlan && (
          <button
            onClick={onAddPlan}
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              border: `1px solid ${C.accent}40`,
              background: `${C.accent}10`,
              color: C.accent,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "var(--space-1, 4px)",
            }}
          >
            + 添加计划
          </button>
        )}
      </div>
      <FilterBar
        searchPlaceholder="搜索设备/负责人/内容..."
        searchValue={keyword}
        onSearchChange={setKeyword}
        dateRange={{ value: dateRange, onChange: setDateRange }}
        filters={[
          { key: "type", label: "保养类型", options: planTypeOptions },
          { key: "assignee", label: "负责人", options: assigneeOptions },
        ]}
        filterValues={filterValues}
        onFilterChange={(k, v) =>
          setFilterValues((prev) => ({ ...prev, [k]: v }))
        }
        onReset={() => {
          setKeyword("");
          setFilterValues({});
          setDateRange(null);
        }}
        summary={`共 ${filteredPlans.length} 条`}
      />
      <DataTable
        dataSource={filteredPlans}
        rowKey="id"
        pagination={false}
        columns={[
          {
            title: "设备名称",
            dataIndex: "deviceName",
            render: (v: string) => (
              <span style={{ fontWeight: 600, color: C.textDark }}>
                {v.split("（")[0]}
              </span>
            ),
          },
          {
            title: "计划日期",
            dataIndex: "planDate",
            align: "center",
            render: (v: string) => {
              const daysLeft = Math.floor(
                (new Date(v).getTime() - Date.now()) / 86400000,
              );
              return (
                <span
                  style={{
                    color:
                      daysLeft <= 7
                        ? C.danger
                        : daysLeft <= 30
                          ? C.warning
                          : C.textMid,
                    fontWeight: daysLeft <= 30 ? 700 : 400,
                  }}
                >
                  {v}
                </span>
              );
            },
          },
          {
            title: "保养类型",
            dataIndex: "type",
            align: "center",
            render: (v: string) => (
              <span
                style={{
                  padding: "2px 8px",
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 700,
                  background:
                    v === "年度保养"
                      ? `${C.danger}15`
                      : v === "半年保养"
                        ? `${C.warning}15`
                        : `${C.accent}15`,
                  color:
                    v === "年度保养"
                      ? C.danger
                      : v === "半年保养"
                        ? C.warning
                        : C.accent,
                }}
              >
                {v}
              </span>
            ),
          },
          {
            title: "保养内容",
            dataIndex: "content",
            render: (v: string) => (
              <span style={{ color: C.textDark }}>{v}</span>
            ),
          },
          {
            title: "预计费用",
            dataIndex: "estimatedCost",
            align: "center",
            render: (v: number | string) => (
              <span style={{ fontWeight: 700, color: C.warning }}>
                ¥{Number(v).toLocaleString()}
              </span>
            ),
          },
          {
            title: "负责人",
            dataIndex: "assignee",
            align: "center",
            render: (v: string) => (
              <span style={{ color: C.textMid }}>{v}</span>
            ),
          },
          ...(hasActions
            ? [
                {
                  title: "操作",
                  key: "actions",
                  align: "center" as const,
                  render: (_: unknown, plan: MaintPlan) => (
                    <span>
                      {onCompletePlan && (
                        <button
                          onClick={() => onCompletePlan(plan)}
                          style={{
                            padding: "3px 10px",
                            borderRadius: 6,
                            border: "none",
                            background: `${C.success}15`,
                            color: C.success,
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: "pointer",
                            marginRight: 6,
                          }}
                        >
                          完成
                        </button>
                      )}
                      {onDeletePlan && (
                        <button
                          onClick={() => onDeletePlan(plan)}
                          style={{
                            padding: "3px 10px",
                            borderRadius: 6,
                            border: "none",
                            background: `${C.danger}15`,
                            color: C.danger,
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          删除
                        </button>
                      )}
                    </span>
                  ),
                },
              ]
            : []),
        ]}
      />
    </div>
  );
}
