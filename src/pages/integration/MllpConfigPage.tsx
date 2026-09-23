import React, { useState, useEffect, useCallback } from "react";
import { Card, Space, Tag, Button, Table, Switch, message, Statistic, Row, Col, Popconfirm, Modal, Input } from 'antd';
import {
  Server, Shield, Plus, Trash2, Activity, Wifi, Clock, Terminal,
} from "lucide-react";
import { api } from "../../services/api/client";
import { usePagination } from "../../hooks/usePagination";
import { ErrorBanner } from "../../components/feedback";
import dayjs from "dayjs";
import { t } from '../../i18n/appI18n';

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
  const { pageData: logPageData, pagination: logPagination } = usePagination(logs, 10);
  const [loading, setLoading] = useState({ status: false, logs: false });
  const [whitelistModalOpen, setWhitelistModalOpen] = useState(false);
  const [newCidr, setNewCidr] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    setLoading((p) => ({ ...p, status: true }));
    try {
      const res = await api.get<MllpStatus>("/hl7/mllp/status");
      if (res.success) { setStatus(res.data); setLoadError(null); }
      else setLoadError(t('w9.states.error'));
    } catch {
      setLoadError(t('w9.states.error'));
    } finally {
      setLoading((p) => ({ ...p, status: false }));
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    setLoading((p) => ({ ...p, logs: true }));
    try {
      const res = await api.get<ConnectionLogEntry[]>("/hl7/mllp/logs?limit=50");
      if (res.success) { setLogs(res.data); setLoadError(null); }
      else setLoadError(t('w9.states.error'));
    } catch {
      setLoadError(t('w9.states.error'));
    } finally {
      setLoading((p) => ({ ...p, logs: false }));
    }
  }, []);

  useEffect(() => { fetchStatus(); fetchLogs(); }, []);

  const handleToggleServer = async (start: boolean) => {
    const res = start ? await api.post("/hl7/mllp/start") : await api.post("/hl7/mllp/stop");
    if (res.success) {
      message.success(start ? t('mllp.listenerStarted') : t('mllp.listenerStopped'));
      fetchStatus();
    } else {
      message.error(t('mllp.opFailed'));
    }
  };

  const handleRemoveWhitelist = async (cidr: string) => {
    const res = await api.post("/hl7/mllp/whitelist/remove", { cidr });
    if (res.success) {
      message.success(t('mllp.whitelistRemoved'));
      fetchStatus();
    } else {
      message.error(t('mllp.removeFailed'));
    }
  };

  const handleAddWhitelist = async () => {
    const cidr = newCidr.trim();
    if (!cidr) {
      message.warning(t('mllp.enterCidr'));
      return;
    }
    const res = await api.post("/hl7/mllp/whitelist/add", { cidr });
    if (res.success) {
      message.success(t('mllp.whitelistAdded'));
      fetchStatus();
    } else {
      message.error(t('mllp.addFailed'));
    }
    setNewCidr("");
    setWhitelistModalOpen(false);
  };

  const handleToggleTls = async (enabled: boolean) => {
    const res = await api.post("/hl7/mllp/tls", { enabled });
    if (res.success) {
      message.success(enabled ? t('mllp.tlsEnabled') : t('mllp.tlsDisabled'));
      fetchStatus();
    } else {
      message.error(t('mllp.opFailed'));
    }
  };

  const whitelistColumns = [
    { title: "CIDR", dataIndex: "cidr", key: "cidr" },
    {
      title: t('mllp.colAction'),
      key: "action",
      width: 80,
      render: (_: unknown, record: { cidr: string }) => (
        <Popconfirm title={t('mllp.removeConfirm')} onConfirm={() => handleRemoveWhitelist(record.cidr)}>
          <Button size="small" danger icon={<Trash2 className="w-3 h-3" />} />
        </Popconfirm>
      ),
    },
  ];

  const logColumns = [
    { title: t('mllp.colTime'), dataIndex: "timestamp", key: "timestamp", render: (v: string) => dayjs(v).format("YYYY-MM-DD HH:mm:ss"), width: 170 },
    { title: t('mllp.colPeer'), dataIndex: "peer", key: "peer", width: 180 },
    {
      title: t('mllp.colEvent'),
      dataIndex: "event",
      key: "event",
      render: (v: string) => {
        const c: Record<string, string> = { connect: "green", disconnect: "orange", message: "blue", error: "red" };
        return <Tag color={c[v] || "default"}>{v}</Tag>;
      },
      width: 110,
    },
    { title: t('mllp.colDetail'), dataIndex: "detail", key: "detail" },
  ];

  return (
    <div className="p-4 space-y-3">
      {loadError && <ErrorBanner message={loadError} />}

      <Card size="small" className="shadow-sm">
        <div className="flex items-center justify-between">
          <Space>
            <Server className="w-5 h-5 text-cyan-600" />
            <div>
              <div className="text-base font-semibold">{t('mllp.title')}</div>
              <div className="text-xs text-slate-500">{t('mllp.subtitle')}</div>
            </div>
          </Space>
          <Space>
            <Tag color={status?.running ? "green" : "red"}>{status?.running ? t('mllp.statusRunning') : t('mllp.statusStopped')}</Tag>
            <Button size="small" icon={<Activity className="w-3 h-3" />} onClick={() => { fetchStatus(); fetchLogs(); }}>{t('mllp.refresh')}</Button>
          </Space>
        </div>
      </Card>

      <Row gutter={8}>
        <Col span={8}>
          <Card size="small" className="shadow-sm" title={<Space><Server className="w-4 h-4" /><span>{t('mllp.listenerStatus')}</span></Space>}>
            <Space orientation="vertical" className="w-full">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">{t('mllp.runState')}</span>
                <Switch
                  checked={status?.running ?? false}
                  onChange={(v) => handleToggleServer(v)}
                  checkedChildren={t('mllp.run')}
                  unCheckedChildren={t('mllp.stop')}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">{t('mllp.port')}</span>
                <Tag color="cyan">{status?.port ?? 2575}</Tag>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">TLS</span>
                <Switch
                  checked={status?.tlsEnabled ?? false}
                  onChange={handleToggleTls}
                  checkedChildren={t('mllp.enable')}
                  unCheckedChildren={t('mllp.disable')}
                  disabled={!status?.running}
                />
              </div>
              {status?.tlsEnabled && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">{t('mllp.tlsPort')}</span>
                  <Tag color="green">{status.tlsPort ?? status.port + 1}</Tag>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">{t('mllp.uptime')}</span>
                <span className="text-xs font-mono">{status ? `${Math.round(status.uptimeMs / 1000)}s` : "-"}</span>
              </div>
            </Space>
          </Card>
        </Col>

        <Col span={8}>
          <Card
            size="small"
            className="shadow-sm"
            title={<Space><Shield className="w-4 h-4" /><span>{t('mllp.whitelist')}</span></Space>}
            extra={
              <Button size="small" icon={<Plus className="w-3 h-3" />} onClick={() => setWhitelistModalOpen(true)}>{t('mllp.add')}</Button>
            }
          >
            <Table
              size="small"
              rowKey="cidr"
              scroll={{ x: 'max-content' }}
              dataSource={(status?.whitelist ?? []).map((c) => ({ cidr: c }))}
              columns={whitelistColumns}
              pagination={false}
              locale={{ emptyText: t('mllp.noWhitelist') }}
            />
          </Card>
        </Col>

        <Col span={8}>
          <Row gutter={[8, 8]}>
            <Col span={12}>
              <Card size="small">
                <Statistic title={t('mllp.totalConnections')} value={status?.totalConnections ?? 0} prefix={<Wifi className="w-3 h-3" />} styles={{ content: {  fontSize: 16  } }} />
              </Card>
            </Col>
            <Col span={12}>
              <Card size="small">
                <Statistic title={t('mllp.totalMessages')} value={status?.totalMessages ?? 0} prefix={<Terminal className="w-3 h-3" />} styles={{ content: {  fontSize: 16  } }} />
              </Card>
            </Col>
          </Row>
        </Col>
      </Row>

      <Card size="small" className="shadow-sm" title={<Space><Clock className="w-4 h-4" /><span>{t('mllp.recentLogs')}</span></Space>}>
        <Table
          size="small"
          rowKey="id"
          loading={loading.logs}
          dataSource={logPageData}
          columns={logColumns}
          scroll={{ x: "max-content" }}
          pagination={logPagination}
          locale={{ emptyText: t('mllp.noLogs') }}
        />
      </Card>

      <Modal
        title={t('mllp.addWhitelist')}
        open={whitelistModalOpen}
        onOk={() => void handleAddWhitelist()}
        onCancel={() => { setWhitelistModalOpen(false); setNewCidr(""); }}
        okText={t('mllp.add')}
        cancelText={t('mllp.cancel')}
        width={420}
      >
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>{t('mllp.cidrLabel')}</div>
          <Input
            value={newCidr}
            onChange={(e) => setNewCidr(e.target.value)}
            placeholder={t('mllp.cidrPlaceholder')}
            onPressEnter={() => void handleAddWhitelist()}
          />
        </div>
      </Modal>
    </div>
  );
};

export default MllpConfigPage;
