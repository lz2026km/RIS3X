import { useState, useMemo, useEffect, useCallback } from "react";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Filter,
  Search,
  X,
  ShieldAlert,
} from "lucide-react";
import {
  Table,
  Tabs,
  Tag,
  Button,
  Select,
  DatePicker,
  Space,
  message,
  Card,
  Badge,
  Spin,
  Alert,
  Input,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { cdsApi } from "../../services/api/cdsApi";
import type { CdsAlertDto } from "../../services/api/cdsApi";
import { getCurrentUser } from "../../utils/auth";

const SEVERITY_TABS = [
  { key: "ALL", label: "全部" },
  { key: "HIGH", label: "高危", color: "#ef4444" },
  { key: "MEDIUM", label: "中危", color: "#f59e0b" },
  { key: "LOW", label: "低危", color: "#3b82f6" },
];

const ALERT_TYPES = [
  "全部",
  "危急值",
  "药物交互",
  "剂量预警",
  "过敏预警",
  "适宜性",
  "临床路径",
  "知识库",
];

const SEVERITY_COLORS: Record<string, string> = {
  HIGH: "#ef4444",
  MEDIUM: "#f59e0b",
  LOW: "#3b82f6",
};
const SEVERITY_LABELS: Record<string, string> = {
  HIGH: "高危",
  MEDIUM: "中危",
  LOW: "低危",
};

export default function AlertCenterPage() {
  const [tab, setTab] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("全部");
  const [dateRange, setDateRange] = useState<
    [dayjs.Dayjs | null, dayjs.Dayjs | null] | null
  >(null);
  const [searchText, setSearchText] = useState("");
  const [alerts, setAlerts] = useState<CdsAlertDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await cdsApi.listAlerts();
      if (res.success) {
        setAlerts(res.data ?? []);
      } else {
        setError(res.error?.message ?? "加载失败");
        setAlerts([]);
      }
    } catch (e) {
      setError((e as Error)?.message ?? "加载失败");
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    let items = alerts;
    if (tab !== "ALL") items = items.filter((a) => a.severity === tab);
    if (typeFilter !== "全部")
      items = items.filter((a) => a.type === typeFilter);
    if (dateRange?.[0] && dateRange?.[1]) {
      const start = dateRange[0].format("YYYY-MM-DD");
      const end = dateRange[1].format("YYYY-MM-DD");
      items = items.filter((a) => a.time >= start && a.time <= end + " 23:59");
    }
    if (searchText) {
      const q = searchText.toLowerCase();
      items = items.filter(
        (a) =>
          a.patientName.toLowerCase().includes(q) ||
          a.message.toLowerCase().includes(q) ||
          a.type.toLowerCase().includes(q),
      );
    }
    return items;
  }, [tab, typeFilter, dateRange, searchText, alerts]);

  const handleAcknowledge = async (id: string) => {
    const user = getCurrentUser();
    const res = await cdsApi.acknowledgeAlert(id, {
      ackedBy: user?.name ?? user?.id ?? "system",
      note: "frontend acknowledge",
    });
    if (res.success) {
      setAlerts((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: "acknowledged" } : a)),
      );
      message.success("已确认告警");
    } else {
      message.error(res.error?.message ?? "确认失败");
    }
  };

  const handleDismiss = (id: string) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: "dismissed" } : a)),
    );
    message.success("已忽略告警");
  };

  const columns: ColumnsType<CdsAlertDto> = [
    {
      title: "严重程度",
      dataIndex: "severity",
      key: "severity",
      width: 90,
      render: (s: string) => (
        <Tag color={SEVERITY_COLORS[s]} icon={<AlertTriangle size={12} />}>
          {SEVERITY_LABELS[s]}
        </Tag>
      ),
    },
    { title: "患者", dataIndex: "patientName", key: "patientName", width: 100 },
    { title: "告警类型", dataIndex: "type", key: "type", width: 110 },
    { title: "消息", dataIndex: "message", key: "message", ellipsis: true },
    { title: "时间", dataIndex: "time", key: "time", width: 160 },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 100,
      render: (s: string) => {
        const map: Record<string, { color: string; label: string }> = {
          active: { color: "red", label: "待处理" },
          acknowledged: { color: "orange", label: "已确认" },
          dismissed: { color: "default", label: "已忽略" },
        };
        return <Tag color={map[s]?.color}>{map[s]?.label}</Tag>;
      },
    },
    {
      title: "操作",
      key: "action",
      width: 160,
      render: (_, record) => (
        <Space size="small">
          {record.status === "active" && (
            <Button
              size="small"
              type="primary"
              icon={<CheckCircle2 size={12} />}
              onClick={() => void handleAcknowledge(record.id)}
            >
              确认
            </Button>
          )}
          {record.status !== "dismissed" && (
            <Button
              size="small"
              icon={<X size={12} />}
              onClick={() => handleDismiss(record.id)}
            >
              忽略
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const counts = useMemo(
    () => ({
      HIGH: alerts.filter((a) => a.severity === "HIGH" && a.status === "active")
        .length,
      MEDIUM: alerts.filter(
        (a) => a.severity === "MEDIUM" && a.status === "active",
      ).length,
      LOW: alerts.filter((a) => a.severity === "LOW" && a.status === "active")
        .length,
      ALL: alerts.filter((a) => a.status === "active").length,
    }),
    [alerts],
  );

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontSize: 14 }}>
      <header
        style={{
          background: "linear-gradient(135deg,#dc2626 0%,#ef4444 100%)",
          color: "#fff",
          padding: "14px 24px",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <Bell size={20} />
        <div>
          <div style={{ fontSize: 16, fontWeight: 800 }}>告警中心</div>
          <div style={{ fontSize: 12, opacity: 0.85 }}>
            CDS 实时告警 · 分级处理 · 闭环管理
          </div>
        </div>
      </header>
      <div style={{ padding: 16 }}>
        <Card
          variant="borderless"
          style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              marginBottom: 16,
              flexWrap: "wrap",
            }}
          >
            <Tabs
              activeKey={tab}
              onChange={setTab}
              style={{ marginBottom: 0 }}
              items={SEVERITY_TABS.map((t) => ({
                key: t.key,
                label: (
                  <Badge count={counts[t.key]} size="small" offset={[6, -4]}>
                    <span
                      style={{ display: "flex", alignItems: "center", gap: 4 }}
                    >
                      {t.key !== "ALL" && (
                        <ShieldAlert size={14} style={{ color: t.color }} />
                      )}
                      {t.label}
                    </span>
                  </Badge>
                ),
              }))}
            />
            <div
              style={{
                marginLeft: "auto",
                display: "flex",
                gap: 8,
                alignItems: "center",
              }}
            >
              <Select
                value={typeFilter}
                onChange={setTypeFilter}
                style={{ width: 130 }}
                options={ALERT_TYPES.map((t) => ({ value: t, label: t }))}
              />
              <DatePicker.RangePicker
                onChange={(dates) =>
                  setDateRange(
                    dates as [dayjs.Dayjs | null, dayjs.Dayjs | null] | null,
                  )
                }
                style={{ width: 240 }}
              />
              <Input
                placeholder="搜索患者/消息..."
                prefix={<Search size={14} />}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                style={{ width: 200 }}
                allowClear
              />
              <Button
                icon={<Filter size={14} />}
                loading={loading}
                onClick={() => void load()}
              >
                刷新
              </Button>
            </div>
          </div>
          {error && (
            <Alert
              type="error"
              showIcon
              style={{ marginBottom: 16 }}
              title={error}
              action={
                <Button size="small" onClick={() => void load()}>
                  重试
                </Button>
              }
            />
          )}
          <Spin spinning={loading}>
            <Table
              columns={columns}
              dataSource={filtered}
              rowKey="id"
              pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 条告警` }}
              size="middle"
            />
          </Spin>
        </Card>
      </div>
    </div>
  );
}
