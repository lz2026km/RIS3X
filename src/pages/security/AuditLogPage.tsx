import { useState, useMemo } from "react";
import {
  Card, DatePicker, Select, Input, Button, Space, Tag, Badge,
  message, Typography, Tooltip, Statistic, Row, Col,
} from "antd";
import { ProTable, type ProColumn } from "../../components/data/ProTable";
import {
  Shield, Search, Download, FileJson, FileText, AlertTriangle,
  CheckCircle, XCircle, Clock, Filter, Calendar,
} from "lucide-react";
import type { AuditLogEntry, AuditCategory, AuditSeverity } from "../../types/security";
import { auditLogger } from "../../services/security";
import { MOCK_AUDIT_EVENTS } from "../../data/securityMock";

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const severityColor: Record<AuditSeverity, string> = {
  debug: "default", info: "blue", notice: "cyan", warning: "orange",
  error: "red", critical: "volcano", alert: "magenta", emergency: "purple",
};

export default function AuditLogPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<AuditCategory | "">("");
  const [severity, setSeverity] = useState<AuditSeverity | "">("");
  const [dateRange, setDateRange] = useState<[string, string] | null>(null);

  const events = useMemo(() => {
    auditLogger.importEntries(MOCK_AUDIT_EVENTS);
    const filters: Parameters<typeof auditLogger.query>[0] = {};
    if (category) filters.category = category as AuditCategory;
    if (severity) filters.severity = severity as AuditSeverity;
    if (dateRange) { filters.startDate = dateRange[0]; filters.endDate = dateRange[1]; }
    return auditLogger.query(filters);
  }, [category, severity, dateRange]);

  const filtered = useMemo(() => {
    if (!search) return events;
    const q = search.toLowerCase();
    return events.filter((e) =>
      e.actor.userName.toLowerCase().includes(q) ||
      e.action.toLowerCase().includes(q) ||
      e.target.id.toLowerCase().includes(q) ||
      e.source.ipAddress.includes(q)
    );
  }, [events, search]);

  const stats = auditLogger.stats();

  const handleExportJson = () => {
    try {
      const blob = new Blob([auditLogger.export("json")], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `audit-${Date.now()}.json`; a.click();
      URL.revokeObjectURL(url);
      message.success("JSON 导出成功");
    } catch { message.error("导出失败"); }
  };

  const handleExportCsv = () => {
    try {
      const blob = new Blob([auditLogger.export("csv")], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `audit-${Date.now()}.csv`; a.click();
      URL.revokeObjectURL(url);
      message.success("CSV 导出成功");
    } catch { message.error("导出失败"); }
  };

  const columns = [
    {
      title: "时间", dataIndex: "timestamp", key: "timestamp", width: 160,
      render: (v: string) => new Date(v).toLocaleString(),
    },
    {
      title: "操作人", dataIndex: "actor", key: "actor", width: 120,
      render: (a: AuditLogEntry["actor"]) => (
        <Tooltip title={`${a.role}${a.department ? ` / ${a.department}` : ""}`}>
          <Text strong>{a.userName}</Text>
        </Tooltip>
      ),
    },
    { title: "动作", dataIndex: "action", key: "action", width: 160, render: (v: string) => <Text code>{v}</Text> },
    {
      title: "资源", dataIndex: "target", key: "target", width: 140,
      render: (t: AuditLogEntry["target"]) => (
        <Tooltip title={t.name ?? ""}>
          <Tag>{t.type}</Tag>:<Text type="secondary">{t.id}</Text>
        </Tooltip>
      ),
    },
    { title: "分类", dataIndex: "category", key: "category", width: 100, render: (v: AuditCategory) => <Tag>{v}</Tag> },
    {
      title: "严重度", dataIndex: "severity", key: "severity", width: 80,
      render: (v: AuditSeverity) => <Tag color={severityColor[v]}>{v}</Tag>,
    },
    {
      title: "结果", dataIndex: "outcome", key: "outcome", width: 80,
      render: (v: string) =>
        v === "success" ? <CheckCircle size={14} color="green" /> :
        v === "failure" ? <XCircle size={14} color="red" /> :
        <AlertTriangle size={14} color="orange" />,
    },
    {
      title: "风险分", dataIndex: "riskScore", key: "riskScore", width: 70,
      render: (v: number) => (
        <Badge
          count={v}
          style={{
            backgroundColor: v >= 70 ? "#f5222d" : v >= 40 ? "#fa8c16" : "#52c41a",
            fontSize: 11,
          }}
        />
      ),
    },
    {
      title: "IP 地址", dataIndex: "source", key: "source", width: 130,
      render: (s: AuditLogEntry["source"]) => <Text type="secondary" style={{ fontSize: 12 }}>{s.ipAddress}</Text>,
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Title level={3} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <Shield size={22} /> 审计日志
      </Title>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card size="small"><Statistic title="总事件" value={stats.total} prefix={<Clock size={14} />} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="分类数" value={Object.keys(stats.byCategory).length} prefix={<Filter size={14} />} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="平均风险" value={stats.avgRiskScore} suffix="/100" /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="严重事件" value={stats.bySeverity.critical ?? 0} prefix={<AlertTriangle size={14} color="red" />} /></Card></Col>
      </Row>

      <Card
        style={{ marginBottom: 16, borderRadius: 8 }}
        bodyStyle={{ padding: "16px 24px" }}
      >
        <Space wrap style={{ width: "100%" }}>
          <Input
            prefix={<Search size={14} />}
            placeholder="搜索操作人/动作/资源/IP..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 260 }}
            allowClear
          />
          <Select
            placeholder="分类"
            allowClear
            style={{ width: 120 }}
            value={category || undefined}
            onChange={(v) => setCategory(v ?? "")}
          >
            {(["auth", "authorization", "data_access", "data_change", "system", "security", "compliance", "phi", "admin"] as AuditCategory[]).map((c) => (
              <Select.Option key={c} value={c}>{c}</Select.Option>
            ))}
          </Select>
          <Select
            placeholder="严重度"
            allowClear
            style={{ width: 110 }}
            value={severity || undefined}
            onChange={(v) => setSeverity(v ?? "")}
          >
            {(["debug", "info", "notice", "warning", "error", "critical"] as AuditSeverity[]).map((s) => (
              <Select.Option key={s} value={s}>{s}</Select.Option>
            ))}
          </Select>
          <RangePicker
            onChange={(_, dateStrings) =>
              setDateRange(dateStrings[0] && dateStrings[1] ? [dateStrings[0], dateStrings[1]] : null)
            }
          />
          <Text type="secondary" style={{ marginLeft: "auto" }}>
            <Calendar size={12} style={{ marginRight: 4 }} />共 {filtered.length} 条
          </Text>
          <Button icon={<FileJson size={14} />} onClick={handleExportJson}>JSON</Button>
          <Button icon={<FileText size={14} />} onClick={handleExportCsv}>CSV</Button>
          <Button icon={<Download size={14} />} onClick={() => { handleExportCsv(); }}>导出</Button>
        </Space>
      </Card>

      <Card style={{ borderRadius: 8 }} bodyStyle={{ padding: 0 }}>
        <ProTable<AuditLogEntry>
          dataSource={filtered}
          columns={columns as ProColumn<AuditLogEntry>[]}
          rowKey="id"
          showToolbar={false}
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
          scroll={{ x: 1100 }}
          size="small"
        />
      </Card>
    </div>
  );
}
