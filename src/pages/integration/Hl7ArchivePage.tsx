import React, { useState, useEffect, useCallback } from "react";
import {
  Card, Space, Tag, Button, Select, DatePicker, message,
} from "antd";
import { Archive, Filter, RotateCcw, Search, ChevronDown, ChevronRight, AlertCircle, CheckCircle, Clock, Send } from "lucide-react";
import { hl7Api } from "../../services/api/integrationApi";
import { usePagination } from "../../hooks/usePagination";
import { DataTable } from "../../components/common/DataTable";
import { ErrorBanner } from "../../components/feedback";
import dayjs from "dayjs";
import { t } from "../../i18n/appI18n";

const { RangePicker } = DatePicker;

interface Hl7ArchiveRecord {
  id: number;
  messageType: string;
  controlId: string;
  direction: "INBOUND" | "OUTBOUND" | "ACK";
  ackStatus: "SUCCESS" | "FAILED" | "PENDING";
  retryCount: number;
  rawMessage: string;
  createdAt: string;
}

export const Hl7ArchivePage: React.FC = () => {
  const [data, setData] = useState<Hl7ArchiveRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const { pageData, pagination } = usePagination(data, 10);

  const [filterType, setFilterType] = useState<string | undefined>();
  const [filterDirection, setFilterDirection] = useState<string | undefined>();
  const [filterAck, setFilterAck] = useState<string | undefined>();
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await hl7Api.getArchive({
        messageType: filterType,
        direction: filterDirection,
        ackStatus: filterAck,
        from: dateRange?.[0]?.toISOString(),
        to: dateRange?.[1]?.toISOString(),
      });
      if (res.success) { setData(res.data); setLoadError(null); }
      else setLoadError(t("w9.states.error"));
    } catch {
      setLoadError(t("w9.states.error"));
    } finally {
      setLoading(false);
    }
  }, [filterType, filterDirection, filterAck, dateRange]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleRetry = async (record: Hl7ArchiveRecord) => {
    const res = await hl7Api.retryBatch([record.id]);
    if (res.success) {
      message.success(t("hl7Archive.resendTriggered"));
      fetchData();
    } else {
      message.error(t("hl7Archive.resendFailed"));
    }
  };

  const columns = [
    {
      title: t("hl7Archive.colMessageType"),
      dataIndex: "messageType",
      key: "messageType",
      render: (v: string) => <Tag color="purple">{v}</Tag>,
      width: 140,
    },
    { title: t("hl7Archive.colControlId"), dataIndex: "controlId", key: "controlId", width: 180 },
    {
      title: t("hl7Archive.colDirection"),
      dataIndex: "direction",
      key: "direction",
      render: (v: string) => {
        const colorMap: Record<string, string> = { INBOUND: "blue", OUTBOUND: "orange", ACK: "green" };
        return <Tag color={colorMap[v] || "default"}>{v}</Tag>;
      },
      width: 110,
    },
    {
      title: t("hl7Archive.colAckStatus"),
      dataIndex: "ackStatus",
      key: "ackStatus",
      render: (v: string) => {
        const iconMap: Record<string, React.ReactNode> = {
          SUCCESS: <CheckCircle className="w-3 h-3" />,
          FAILED: <AlertCircle className="w-3 h-3" />,
          PENDING: <Clock className="w-3 h-3" />,
        };
        const colorMap: Record<string, string> = { SUCCESS: "green", FAILED: "red", PENDING: "orange" };
        return (
          <Space size={4}>
            {iconMap[v]}
            <Tag color={colorMap[v] || "default"}>{v}</Tag>
          </Space>
        );
      },
      width: 130,
    },
    { title: t("hl7Archive.colRetryCount"), dataIndex: "retryCount", key: "retryCount", width: 90 },
    {
      title: t("hl7Archive.colCreatedAt"),
      dataIndex: "createdAt",
      key: "createdAt",
      render: (v: string) => dayjs(v).format("YYYY-MM-DD HH:mm:ss"),
      width: 170,
    },
    {
      title: t("hl7Archive.colActions"),
      key: "action",
      width: 100,
      render: (_: unknown, record: Hl7ArchiveRecord) =>
        record.ackStatus === "FAILED" ? (
          <Button size="small" type="primary" danger icon={<Send className="w-3 h-3" />} onClick={() => handleRetry(record)}>
            {t("hl7Archive.manualResend")}
          </Button>
        ) : null,
    },
  ];

  return (
    <div className="p-4 space-y-3">
      <Card size="small" className="shadow-sm">
        <div className="flex items-center justify-between">
          <Space>
            <Archive className="w-5 h-5 text-purple-600" />
            <div>
              <div className="text-base font-semibold">{t("hl7Archive.title")}</div>
              <div className="text-xs text-slate-500">{t("hl7Archive.subtitle")}</div>
            </div>
          </Space>
          <Space>
            <Tag color="purple">{t("hl7Archive.archiveTag")}</Tag>
            <Button size="small" icon={<RotateCcw className="w-3 h-3" />} onClick={fetchData}>{t("hl7Archive.refresh")}</Button>
          </Space>
        </div>
      </Card>

      {loadError && !loading && <ErrorBanner message={loadError} />}

      <Card size="small" className="shadow-sm" title={<Space><Filter className="w-4 h-4" /><span>{t("hl7Archive.filter")}</span></Space>}>
        <Space wrap>
          <Select
            allowClear
            placeholder={t("hl7Archive.colMessageType")}
            value={filterType}
            onChange={setFilterType}
            style={{ width: 150 }}
            options={[
              { value: "ORU^R01", label: "ORU^R01" },
              { value: "ORM^O01", label: "ORM^O01" },
              { value: "DFT^P03", label: "DFT^P03" },
              { value: "ADT^A01", label: "ADT^A01" },
              { value: "ACK", label: "ACK" },
            ]}
          />
          <Select
            allowClear
            placeholder={t("hl7Archive.colDirection")}
            value={filterDirection}
            onChange={setFilterDirection}
            style={{ width: 140 }}
            options={[
              { value: "INBOUND", label: t("hl7Archive.inbound") },
              { value: "OUTBOUND", label: t("hl7Archive.outbound") },
              { value: "ACK", label: "ACK" },
            ]}
          />
          <Select
            allowClear
            placeholder={t("hl7Archive.colAckStatus")}
            value={filterAck}
            onChange={setFilterAck}
            style={{ width: 150 }}
            options={[
              { value: "SUCCESS", label: t("hl7Archive.success") },
              { value: "FAILED", label: t("hl7Archive.failed") },
              { value: "PENDING", label: t("hl7Archive.pending") },
            ]}
          />
          <RangePicker value={dateRange as any} onChange={(v) => setDateRange(v as any)} />
          <Button icon={<Search className="w-3 h-3" />} type="primary" onClick={fetchData}>{t("hl7Archive.query")}</Button>
        </Space>
      </Card>

      <DataTable
        rowKey="id"
        loading={loading}
        dataSource={pageData}
        columns={columns}
        emptyText={t("w9.states.empty")}
        scroll={{ x: "max-content" }}
        pagination={pagination}
        expandable={{
          expandedRowKeys: expandedId !== null ? [expandedId] : [],
          onExpand: (expanded, record) => setExpandedId(expanded ? record.id : null),
          expandedRowRender: (record) => (
            <pre className="bg-slate-900 text-slate-100 p-3 rounded text-xs font-mono overflow-auto max-h-64 whitespace-pre-wrap">
              {record.rawMessage}
            </pre>
          ),
          rowExpandable: () => true,
          expandIcon: ({ expanded, onExpand, record }) =>
            expanded ? (
              <ChevronDown className="w-4 h-4 cursor-pointer" onClick={(e) => onExpand(record, e as any)} />
            ) : (
              <ChevronRight className="w-4 h-4 cursor-pointer" onClick={(e) => onExpand(record, e as any)} />
            ),
        }}
      />
    </div>
  );
};

export default Hl7ArchivePage;
