import React, { useState, useEffect, useCallback } from "react";
import {
  Card,
  Table,
  Button,
  Modal,
  Select,
  Input,
  Tag,
  Space,
  Statistic,
  Row,
  Col,
  message,
  Empty,
  Descriptions,
  Badge,
  Typography,
  Spin,
  Alert,
} from "antd";
import {
  Users,
  Plus,
  Trash2,
  Play,
  Search,
  Clock,
  BarChart3,
  Layers,
  GitBranch,
} from "lucide-react";
import { COHORT_CONFIGS } from "../../data/cohortConfigs";
import { olapApi } from "../../services/api";
import type { CohortFilter } from "../../types/analytics";

interface Condition {
  id: string;
  field: string;
  operator: string;
  value: string;
  group: string;
}

interface Cohort {
  id: string;
  name: string;
  conditionCount: number;
  size: number;
  createdAt: string;
  lastRun: string;
  status: "ready" | "running" | "completed" | "failed";
}

const fieldOptions = [
  { label: "检查部位", value: "bodyPart" },
  { label: "设备类型", value: "deviceType" },
  { label: "性别", value: "gender" },
  { label: "年龄", value: "age" },
  { label: "诊断编码", value: "diagnosisCode" },
  { label: "检查日期", value: "examDate" },
  { label: "报告医生", value: "reportDoctor" },
  { label: "质控结果", value: "qcResult" },
];

const operatorOptions = [
  { label: "等于", value: "eq" },
  { label: "不等于", value: "ne" },
  { label: "包含", value: "contains" },
  { label: "大于", value: "gt" },
  { label: "小于", value: "lt" },
  { label: "介于", value: "between" },
  { label: "为空", value: "isNull" },
  { label: "不为空", value: "isNotNull" },
];

const initialCohorts: Cohort[] = COHORT_CONFIGS.map((c, idx) => ({
  id: `C-${String(idx + 1).padStart(3, "0")}`,
  name: c.name,
  conditionCount: 3 + (idx % 4),
  size: c.size,
  createdAt: c.updatedAt,
  lastRun: c.updatedAt,
  status: idx === 4 ? "failed" : idx === 5 ? "running" : "completed",
}));

const statusConfig: Record<string, { color: string; label: string }> = {
  ready: { color: "default", label: "就绪" },
  running: { color: "processing", label: "运行中" },
  completed: { color: "success", label: "已完成" },
  failed: { color: "error", label: "失败" },
};

let condCounter = 3;

const MODALITY_BY_BODYPART: Record<string, string[]> = {
  胸部: ["CT", "DR"],
  腹部: ["CT", "MR", "US"],
  头部: ["CT", "MR"],
  颅脑: ["CT", "MR"],
  心脏: ["CT", "MR", "XA"],
  脊柱: ["MR", "CT", "DR"],
  乳腺: ["MG", "MR"],
  盆腔: ["CT", "MR", "US"],
};

// 将 CohortFilter 映射为 OLAP 查询过滤条件 (诊断/年龄组无法由 OLAP 维度表达时跳过)
function mapFilterToOlapFilters(
  filter: CohortFilter,
): Array<{ dimension: string; operator: string; value: unknown }> {
  const filters: Array<{
    dimension: string;
    operator: string;
    value: unknown;
  }> = [];
  if (filter.modality && filter.modality.length > 0) {
    filters.push({
      dimension: "modality",
      operator: "in",
      value: filter.modality,
    });
  }
  if (filter.bodyPart && filter.bodyPart.length > 0) {
    filters.push({
      dimension: "body_part",
      operator: "in",
      value: filter.bodyPart,
    });
  }
  if (filter.dateRange?.start && filter.dateRange?.end) {
    filters.push({
      dimension: "date",
      operator: "between",
      value: [filter.dateRange.start, filter.dateRange.end],
    });
  }
  return filters;
}

function synthesizeFilterFromConditions(conds: Condition[]): CohortFilter {
  const modalitySet = new Set<string>();
  const bodyPartSet = new Set<string>();
  const diagnosisSet = new Set<string>();
  let ageMin: number | undefined;
  let ageMax: number | undefined;
  for (const c of conds) {
    const v = c.value?.trim();
    if (!v) continue;
    if (c.field === "bodyPart") {
      bodyPartSet.add(v);
      MODALITY_BY_BODYPART[v]?.forEach((m) => modalitySet.add(m));
    } else if (c.field === "deviceType") {
      modalitySet.add(v.toUpperCase());
    } else if (c.field === "diagnosisCode") {
      diagnosisSet.add(v);
    } else if (c.field === "age") {
      const num = Number(v);
      if (!Number.isNaN(num)) {
        if (c.operator === "gt" || c.operator === "ge")
          ageMin = Math.max(ageMin ?? 0, num);
        else if (c.operator === "lt" || c.operator === "le")
          ageMax = Math.min(ageMax ?? 120, num);
        else if (c.operator === "eq") {
          ageMin = num;
          ageMax = num;
        }
      }
    }
  }
  const filter: CohortFilter = {};
  if (modalitySet.size > 0) filter.modality = Array.from(modalitySet);
  if (bodyPartSet.size > 0) filter.bodyPart = Array.from(bodyPartSet);
  if (diagnosisSet.size > 0) filter.diagnosis = Array.from(diagnosisSet);
  if (ageMin !== undefined) filter.ageMin = ageMin;
  if (ageMax !== undefined) filter.ageMax = ageMax;
  return filter;
}

function sumExamCount(data: unknown): number {
  if (!data) return 0;
  const rows = (data as { rows?: Array<Record<string, unknown>> }).rows ?? [];
  return rows.reduce((s, r) => s + (Number(r.exam_count) || 0), 0);
}

export default function CohortPage() {
  const [cohorts, setCohorts] = useState<Cohort[]>(initialCohorts);
  const [conditions, setConditions] = useState<Condition[]>([
    { id: "c1", field: "bodyPart", operator: "eq", value: "胸部", group: "A" },
    {
      id: "c2",
      field: "diagnosisCode",
      operator: "contains",
      value: "C78.0",
      group: "A",
    },
    { id: "c3", field: "age", operator: "gt", value: "50", group: "B" },
  ]);
  const [groupId, setGroupId] = useState<"AND" | "OR">("AND");
  const [cohortName, setCohortName] = useState("");
  const [resultOpen, setResultOpen] = useState(false);
  const [resultData, setResultData] = useState<{
    cohort: Cohort;
    count: number;
    summary: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  // 使用真实 OLAP 查询刷新各预设队列规模
  const refreshSizes = useCallback(async () => {
    setRefreshing(true);
    setError("");
    try {
      const updated = await Promise.all(
        initialCohorts.map(async (c) => {
          const config = COHORT_CONFIGS.find((x) => x.name === c.name);
          if (!config) return c;
          const filters = mapFilterToOlapFilters(config.filter);
          if (filters.length === 0) return c;
          const res = await olapApi.query({
            dimensions: ["modality"],
            measures: ["exam_count"],
            filters,
          });
          if (res.success) {
            const count = sumExamCount(res.data);
            return { ...c, size: count > 0 ? count : c.size };
          }
          return c;
        }),
      );
      setCohorts(updated);
    } catch (e) {
      setError((e as Error)?.message ?? "队列规模刷新失败");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      await refreshSizes();
      setLoading(false);
    })();
  }, [refreshSizes]);

  const addCondition = (group: string) => {
    condCounter++;
    setConditions((prev) => [
      ...prev,
      {
        id: `c${condCounter}`,
        field: "bodyPart",
        operator: "eq",
        value: "",
        group,
      },
    ]);
  };

  const removeCondition = (id: string) => {
    setConditions((prev) => prev.filter((c) => c.id !== id));
  };

  const updateCondition = (id: string, key: keyof Condition, value: string) => {
    setConditions((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [key]: value } : c)),
    );
  };

  const groupA = conditions.filter((c) => c.group === "A");
  const groupB = conditions.filter((c) => c.group === "B");

  const groupLogic = groupA.length > 0 && groupB.length > 0 ? groupId : null;

  const handleRunAnalysis = async () => {
    if (!cohortName.trim()) {
      message.warning("请输入队列名称");
      return;
    }
    setRunning(true);
    try {
      const synthesizedFilter = synthesizeFilterFromConditions(conditions);
      const filters = mapFilterToOlapFilters(synthesizedFilter);
      const res = await olapApi.query({
        dimensions: ["modality"],
        measures: ["exam_count"],
        filters: filters.length > 0 ? filters : undefined,
      });
      if (!res.success) {
        message.error(res.error?.message ?? "队列分析失败");
        return;
      }
      const count = sumExamCount(res.data);
      const newCohort: Cohort = {
        id: `C-${String(cohorts.length + 1).padStart(3, "0")}`,
        name: cohortName,
        conditionCount: conditions.length,
        size: count,
        createdAt: new Date().toISOString().split("T")[0],
        lastRun: new Date().toISOString().split("T")[0],
        status: "completed",
      };
      setCohorts((prev) => [newCohort, ...prev]);
      setResultData({
        cohort: newCohort,
        count,
        summary: `根据 ${conditions.length} 个条件，OLAP 实时查询共匹配 ${count} 条检查记录。其中A组 ${groupA.length} 个条件${groupB.length ? `，B组 ${groupB.length} 个条件` : ""}。`,
      });
      setResultOpen(true);
      message.success(`队列分析完成，共 ${count} 条记录`);
      setCohortName("");
    } catch (e) {
      message.error((e as Error)?.message ?? "队列分析失败");
    } finally {
      setRunning(false);
    }
  };

  const columns = [
    {
      title: "队列名称",
      dataIndex: "name",
      key: "name",
      render: (n: string, r: Cohort) => (
        <Space>
          <Layers size={16} style={{ color: "#7c3aed" }} />
          <a
            onClick={() => {
              setResultData({
                cohort: r,
                count: r.size,
                summary: `${r.name} 共 ${r.size} 条记录，基于 ${r.conditionCount} 个筛选条件`,
              });
              setResultOpen(true);
            }}
            style={{ fontWeight: 600 }}
          >
            {n}
          </a>
        </Space>
      ),
    },
    {
      title: "条件数",
      dataIndex: "conditionCount",
      key: "conditionCount",
      width: 80,
    },
    {
      title: "队列规模",
      dataIndex: "size",
      key: "size",
      render: (s: number) => s.toLocaleString(),
      width: 100,
    },
    { title: "创建时间", dataIndex: "createdAt", key: "createdAt", width: 110 },
    { title: "上次运行", dataIndex: "lastRun", key: "lastRun", width: 110 },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 100,
      render: (s: string) => (
        <Tag color={statusConfig[s]?.color}>{statusConfig[s]?.label || s}</Tag>
      ),
    },
  ];

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <Space>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: "linear-gradient(135deg, #7c3aed, #a855f7)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Users size={22} color="#fff" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
              患者队列分析
            </h2>
            <span style={{ color: "#94a3b8", fontSize: 13 }}>
              基于 OLAP 实时数据构建和筛查患者队列
            </span>
          </div>
        </Space>
        <Space>
          <Button
            icon={<Clock size={14} />}
            loading={refreshing}
            onClick={() => void refreshSizes()}
          >
            刷新规模
          </Button>
          <Badge
            count={cohorts.length}
            style={{ backgroundColor: "#7c3aed" }}
          />
        </Space>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={10}>
          <Card
            title={
              <Space>
                <GitBranch size={16} /> 队列构建器
              </Space>
            }
            variant="borderless"
            style={{ borderRadius: 12 }}
            extra={
              <Input
                placeholder="队列名称"
                value={cohortName}
                onChange={(e) => setCohortName(e.target.value)}
                style={{ width: 160 }}
                prefix={<Search size={14} />}
              />
            }
          >
            {groupA.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                {groupB.length > 0 && (
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#7c3aed",
                      marginBottom: 6,
                    }}
                  >
                    A组条件
                  </div>
                )}
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 6 }}
                >
                  {groupA.map((c) => (
                    <Space key={c.id} style={{ display: "flex" }}>
                      <Select
                        value={c.field}
                        onChange={(v) => updateCondition(c.id, "field", v)}
                        style={{ width: 120 }}
                        size="small"
                        options={fieldOptions}
                      />
                      <Select
                        value={c.operator}
                        onChange={(v) => updateCondition(c.id, "operator", v)}
                        style={{ width: 100 }}
                        size="small"
                        options={operatorOptions}
                      />
                      <Input
                        value={c.value}
                        onChange={(e) =>
                          updateCondition(c.id, "value", e.target.value)
                        }
                        placeholder="值"
                        size="small"
                        style={{ width: 120 }}
                      />
                      <Button
                        type="text"
                        size="small"
                        danger
                        icon={<Trash2 size={14} />}
                        onClick={() => removeCondition(c.id)}
                      />
                    </Space>
                  ))}
                </div>
                <Button
                  type="dashed"
                  size="small"
                  icon={<Plus size={14} />}
                  onClick={() => addCondition("A")}
                  style={{ marginTop: 6, width: "100%" }}
                >
                  添加条件
                </Button>
              </div>
            )}

            {groupA.length > 0 && groupB.length > 0 && (
              <div style={{ textAlign: "center", margin: "8px 0" }}>
                <Select
                  value={groupId}
                  onChange={setGroupId}
                  style={{ width: 80 }}
                  size="small"
                  options={[
                    { label: "AND", value: "AND" },
                    { label: "OR", value: "OR" },
                  ]}
                />
              </div>
            )}

            {groupB.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#7c3aed",
                    marginBottom: 6,
                  }}
                >
                  B组条件
                </div>
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 6 }}
                >
                  {groupB.map((c) => (
                    <Space key={c.id} style={{ display: "flex" }}>
                      <Select
                        value={c.field}
                        onChange={(v) => updateCondition(c.id, "field", v)}
                        style={{ width: 120 }}
                        size="small"
                        options={fieldOptions}
                      />
                      <Select
                        value={c.operator}
                        onChange={(v) => updateCondition(c.id, "operator", v)}
                        style={{ width: 100 }}
                        size="small"
                        options={operatorOptions}
                      />
                      <Input
                        value={c.value}
                        onChange={(e) =>
                          updateCondition(c.id, "value", e.target.value)
                        }
                        placeholder="值"
                        size="small"
                        style={{ width: 120 }}
                      />
                      <Button
                        type="text"
                        size="small"
                        danger
                        icon={<Trash2 size={14} />}
                        onClick={() => removeCondition(c.id)}
                      />
                    </Space>
                  ))}
                </div>
                <Button
                  type="dashed"
                  size="small"
                  icon={<Plus size={14} />}
                  onClick={() => addCondition("B")}
                  style={{ marginTop: 6, width: "100%" }}
                >
                  添加条件
                </Button>
              </div>
            )}

            {groupA.length === 0 && groupB.length === 0 && (
              <div style={{ textAlign: "center", padding: 16 }}>
                <Button
                  type="dashed"
                  icon={<Plus size={14} />}
                  onClick={() => addCondition("A")}
                >
                  添加第一个条件
                </Button>
              </div>
            )}

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginTop: 12,
              }}
            >
              <Button
                type="primary"
                icon={<Play size={14} />}
                onClick={() => void handleRunAnalysis()}
                loading={running}
                style={{ background: "#7c3aed", borderColor: "#7c3aed" }}
              >
                运行分析
              </Button>
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={14}>
          <Card
            title={
              <Space>
                <BarChart3 size={16} /> 队列列表
              </Space>
            }
            variant="borderless"
            style={{ borderRadius: 12 }}
          >
            {error && (
              <Alert
                type="error"
                showIcon
                style={{ marginBottom: 12 }}
                title={error}
                action={
                  <Button size="small" onClick={() => void refreshSizes()}>
                    重试
                  </Button>
                }
              />
            )}
            <Spin spinning={loading}>
              <Table
                dataSource={cohorts}
                columns={columns}
                rowKey="id"
                pagination={{
                  pageSize: 10,
                  showTotal: (t) => `共 ${t} 个队列`,
                }}
                size="small"
                locale={{ emptyText: <Empty description="暂无队列" /> }}
              />
            </Spin>
          </Card>
        </Col>
      </Row>

      <Modal
        title={
          <Space>
            <BarChart3 size={16} /> 分析结果 - {resultData?.cohort.name}
          </Space>
        }
        open={resultOpen}
        onCancel={() => setResultOpen(false)}
        footer={<Button onClick={() => setResultOpen(false)}>关闭</Button>}
        width={600}
      >
        {resultData && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Row gutter={16}>
              <Col span={8}>
                <Card size="small">
                  <Statistic
                    title="匹配记录"
                    value={resultData.count}
                    suffix="条"
                    styles={{ content: {  color: "#7c3aed"  } }}
                  />
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small">
                  <Statistic
                    title="筛选条件"
                    value={conditions.length}
                    suffix="个"
                  />
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small">
                  <Statistic title="分组逻辑" value={groupLogic || "单一"} />
                </Card>
              </Col>
            </Row>
            <Card size="small" title="结果摘要">
              <Typography.Paragraph>{resultData.summary}</Typography.Paragraph>
            </Card>
            <Descriptions column={1} bordered size="small" title="条件明细">
              {conditions.map((c, i) => (
                <Descriptions.Item
                  key={c.id}
                  label={`条件${i + 1} (${c.group}组)`}
                >
                  {fieldOptions.find((f) => f.value === c.field)?.label ||
                    c.field}{" "}
                  {operatorOptions.find((o) => o.value === c.operator)?.label ||
                    c.operator}{" "}
                  {c.value}
                </Descriptions.Item>
              ))}
            </Descriptions>
          </div>
        )}
      </Modal>
    </div>
  );
}
