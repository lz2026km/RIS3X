import React, { useState, useEffect, useCallback } from "react";
import {
  Card, Space, Tag, Button, Table, Input, Switch, message, Statistic, Row, Col, Tooltip, Popconfirm,
} from "antd";
import {
  Server, Shield, Plus, Trash2, Activity, Wifi, Clock, Terminal,
} from "lucide-react";
import { api } from "../../services/api/client";
import dayjs from "dayjs";

interface MllpStatus {
  running: boolean;
  port: number;
  tlsEnabled: boolean;
  tlsPort?: number;
  whitelist: string[];
  uptimeMs: number;
  totalConnections: number;
  totalMessages: number;
}

interface ConnectionLogEntry {
  id: number;
  peer: string;
  event: "connect" | "disconnect" | "message" | "error";
  timestamp: string;
  detail?: string;
}

export const MllpConfigPage: React.FC = () => {
  const [status, setStatus] = useState<MllpStatus | null>(null);
  const [logs, setLogs] = useState<ConnectionLogEntry[]>([]);
  const [loading, setLoading] = useState({ status: false, logs: false });

  const fetchStatus = useCallback(async () => {
    setLoading((p) => ({ ...p, status: true }));
    const res = await api.get<MllpStatus>("/hl7/mllp/status");
    if (res.success) setStatus(res.data);
    setLoading((p) => ({ ...p, status: false }));
  }, []);

  const fetchLogs = useCallback(async () => {
    setLoading((p) => ({ ...p, logs: true }));
    const res = await api.get<ConnectionLogEntry[]>("/hl7/mllp/logs?limit=50");
    if (res.success) setLogs(res.data);
    setLoading((p) => ({ ...p, logs: false }));
  }, []);

  useEffect(() => { fetchStatus(); fetchLogs(); }, []);

  const handleToggleServer = async (start: boolean) => {
    const res = start ? await api.post("/hl7/mllp/start") : await api.post("/hl7/mllp/stop");
    if (res.success) {
      message.success(start ? "MLLP 监听器已启动" : "MLLP 监听器已停止");
      fetchStatus();
    } else {
      message.error("操作失败");
    }
  };

  const handleRemoveWhitelist = async (cidr: string) => {
    const res = await api.post("/hl7/mllp/whitelist/remove", { cidr });
    if (res.success) {
      message.success("已移除白名单");
      fetchStatus();
    } else {
      message.error("移除失败");
    }
  };

  const handleAddWhitelist = async () => {
    const input = prompt("输入 CIDR (如 10.0.0.0/8):");
    if (!input) return;
    const res = await api.post("/hl7/mllp/whitelist/add", { cidr: input.trim() });
    if (res.success) {
      message.success("白名单已添加");
      fetchStatus();
    } else {
      message.error("添加失败");
    }
  };

  const handleToggleTls = async (enabled: boolean) => {
    const res = await api.post("/hl7/mllp/tls", { enabled });
    if (res.success) {
      message.success(enabled ? "TLS 已启用" : "TLS 已禁用");
      fetchStatus();
    } else {
      message.error("操作失败");
    }
  };

  const whitelistColumns = [
    { title: "CIDR", dataIndex: "cidr", key: "cidr" },
    {
      title: "操作",
      key: "action",
      width: 80,
      render: (_: unknown, record: { cidr: string }) => (
        <Popconfirm title="确认移除?" onConfirm={() => handleRemoveWhitelist(record.cidr)}>
          <Button size="small" danger icon={<Trash2 className="w-3 h-3" />} />
        </Popconfirm>
      ),
    },
  ];

  const logColumns = [
    { title: "时间", dataIndex: "timestamp", key: "timestamp", render: (v: string) => dayjs(v).format("YYYY-MM-DD HH:mm:ss"), width: 170 },
    { title: "对端", dataIndex: "peer", key: "peer", width: 180 },
    {
      title: "事件",
      dataIndex: "event",
      key: "event",
      render: (v: string) => {
        const c: Record<string, string> = { connect: "green", disconnect: "orange", message: "blue", error: "red" };
        return <Tag color={c[v] || "default"}>{v}</Tag>;
      },
      width: 110,
    },
    { title: "详情", dataIndex: "detail", key: "detail" },
  ];

  return (
    <div className="p-4 space-y-3">
      <Card size="small" className="shadow-sm">
        <div className="flex items-center justify-between">
          <Space>
            <Server className="w-5 h-5 text-cyan-600" />
            <div>
              <div className="text-base font-semibold">MLLP 配置</div>
              <div className="text-xs text-slate-500">HL7 v2.x MLLP 监听器 · TCP 端口 / TLS / IP 白名单</div>
            </div>
          </Space>
          <Space>
            <Tag color={status?.running ? "green" : "red"}>{status?.running ? "运行中" : "已停止"}</Tag>
            <Button size="small" icon={<Activity className="w-3 h-3" />} onClick={() => { fetchStatus(); fetchLogs(); }}>刷新</Button>
          </Space>
        </div>
      </Card>

      <Row gutter={8}>
        <Col span={8}>
          <Card size="small" className="shadow-sm" title={<Space><Server className="w-4 h-4" /><span>监听器状态</span></Space>}>
            <Space orientation="vertical" className="w-full">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">运行状态</span>
                <Switch
                  checked={status?.running ?? false}
                  onChange={(v) => handleToggleServer(v)}
                  checkedChildren="运行"
                  unCheckedChildren="停止"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">端口</span>
                <Tag color="cyan">{status?.port ?? 2575}</Tag>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">TLS</span>
                <Switch
                  checked={status?.tlsEnabled ?? false}
                  onChange={handleToggleTls}
                  checkedChildren="启用"
                  unCheckedChildren="禁用"
                  disabled={!status?.running}
                />
              </div>
              {status?.tlsEnabled && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">TLS 端口</span>
                  <Tag color="green">{status.tlsPort ?? status.port + 1}</Tag>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">运行时间</span>
                <span className="text-xs font-mono">{status ? `${Math.round(status.uptimeMs / 1000)}s` : "-"}</span>
              </div>
            </Space>
          </Card>
        </Col>

        <Col span={8}>
          <Card
            size="small"
            className="shadow-sm"
            title={<Space><Shield className="w-4 h-4" /><span>IP 白名单</span></Space>}
            extra={
              <Button size="small" icon={<Plus className="w-3 h-3" />} onClick={handleAddWhitelist}>添加</Button>
            }
          >
            <Table
              size="small"
              rowKey="cidr"
              dataSource={(status?.whitelist ?? []).map((c) => ({ cidr: c }))}
              columns={whitelistColumns}
              pagination={false}
              locale={{ emptyText: "暂无白名单" }}
            />
          </Card>
        </Col>

        <Col span={8}>
          <Row gutter={[8, 8]}>
            <Col span={12}>
              <Card size="small">
                <Statistic title="总连接" value={status?.totalConnections ?? 0} prefix={<Wifi className="w-3 h-3" />} styles={{ content: {  fontSize: 16  } }} />
              </Card>
            </Col>
            <Col span={12}>
              <Card size="small">
                <Statistic title="总消息" value={status?.totalMessages ?? 0} prefix={<Terminal className="w-3 h-3" />} styles={{ content: {  fontSize: 16  } }} />
              </Card>
            </Col>
          </Row>
        </Col>
      </Row>

      <Card size="small" className="shadow-sm" title={<Space><Clock className="w-4 h-4" /><span>最近连接日志</span></Space>}>
        <Table
          size="small"
          rowKey="id"
          loading={loading.logs}
          dataSource={logs}
          columns={logColumns}
          scroll={{ x: "max-content" }}
          pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 条` }}
          locale={{ emptyText: "暂无日志" }}
        />
      </Card>
    </div>
  );
};

export default MllpConfigPage;
