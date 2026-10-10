import React, { useEffect, useState, useCallback } from "react";
import {
  Button,
  Tag,
  Modal,
  Select,
  message,
  Row,
  Col,
  Space,
  Descriptions,
  InputNumber,
  Alert,
} from "antd";
import { Clock, AlertTriangle, Siren, UserCheck } from "lucide-react";
import { api } from "../../services/api/client";
import { DataTable, PageContainer, StatCard, StatCardGrid } from "../../components/common";
import { t } from "../../i18n/appI18n";
import { usePagination } from "../../hooks/usePagination";

// [G005 W6] ESI 五级标签
const esiLabel = (level?: number): string => (level ? t(`w6Reg.triage.esi${level}`) : "-");

interface TriageItem {
  id: string;
  examId: string;
  patientId: string;
  patientName: string;
  examType: string;
  score: number;
  level: string;
  status: "PENDING" | "ASSIGNED" | "COMPLETED";
  assignedDoctor?: string;
  createdAt: string;
  // [G005 W6] ESI 五级 + 队列优先级 + 复评
  esiLevel?: number;
  queuePriority?: string;
  reTriageRecommended?: boolean;
  reTriageAt?: string;
  nurseName?: string;
}

interface VitalInput {
  systolicBp?: number;
  diastolicBp?: number;
  heartRate?: number;
  temperature?: number;
  spo2?: number;
  respiratoryRate?: number;
}

const levelColor: Record<string, string> = {
  CRITICAL: "red",
  URGENT: "orange",
  SEMI_URGENT: "gold",
  ROUTINE: "green",
};

const levelLabel: Record<string, string> = {
  CRITICAL: "triage.levelCritical",
  URGENT: "triage.levelUrgent",
  SEMI_URGENT: "triage.levelSemiUrgent",
  ROUTINE: "triage.levelRoutine",
};

const TriagePage: React.FC = () => {
  const [items, setItems] = useState<TriageItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<TriageItem | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [newDoctor, setNewDoctor] = useState("");
  const [newStatus, setNewStatus] = useState<string>("");
  // [G005 W6] 复评 (vitals + ESI)
  const [reTriageItem, setReTriageItem] = useState<TriageItem | null>(null);
  const [vitals, setVitals] = useState<VitalInput>({});
  const [reTriageInfo, setReTriageInfo] = useState<{ esiLevel?: number; queuePriority?: string; breaches: string[] } | null>(null);
  const [reTriaging, setReTriaging] = useState(false);
  // [W3-C] 受控分页: 待分诊列表
  const listPagination = usePagination(items, 10);

  const fetchPending = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<TriageItem[]>("/triage/pending");
      setItems(res.data ?? []);
    } catch {
      message.error(t("triage.loadError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  const handleAssign = async (item: TriageItem) => {
    try {
      const res = await api.post<{ assignedDoctor: string }>("/triage/assign", {
        examId: item.examId,
        patientId: item.patientId,
        patientName: item.patientName,
        examType: item.examType,
      });
      message.success(`${t("triage.assignedTo")} ${res.data.assignedDoctor}`);
      fetchPending();
    } catch {
      message.error(t("triage.assignError"));
    }
  };

  const handleConfirm = async (item: TriageItem) => {
    try {
      await api.put(`/triage/${item.id}`, { status: "COMPLETED" });
      message.success(t("triage.confirmSuccess"));
      fetchPending();
    } catch {
      message.error(t("triage.confirmError"));
    }
  };

  const handleManualUpdate = async () => {
    if (!selectedItem) return;
    try {
      await api.put(`/triage/${selectedItem.id}`, {
        assignedDoctor: newDoctor || undefined,
        status: newStatus || undefined,
      });
      message.success(t("triage.updateSuccess"));
      setModalOpen(false);
      fetchPending();
    } catch {
      message.error(t("triage.updateError"));
    }
  };

  // [G005 W6] 复评: 采集生命体征 → 重算 ESI / 队列优先级
  const handleReTriage = async () => {
    if (!reTriageItem) return;
    setReTriaging(true);
    try {
      const res = await api.post<{
        esiLevel?: number;
        queuePriority?: string;
        vitalsBreaches?: string[];
        reTriageAt?: string;
        reTriageRecommended?: boolean;
      }>("/triage/re-triage", {
        examId: reTriageItem.examId,
        patientId: reTriageItem.patientId,
        patientName: reTriageItem.patientName,
        examType: reTriageItem.examType,
        vitals,
      });
      const d = res.data;
      setReTriageInfo({ esiLevel: d.esiLevel, queuePriority: d.queuePriority, breaches: d.vitalsBreaches ?? [] });
      setItems((list) =>
        list.map((i) =>
          i.id === reTriageItem.id
            ? { ...i, esiLevel: d.esiLevel, queuePriority: d.queuePriority, reTriageRecommended: !!d.reTriageRecommended, reTriageAt: d.reTriageAt }
            : i,
        ),
      );
      message.success(t("w6Reg.triage.success"));
    } catch {
      message.error(t("w6Reg.loadFailed"));
    } finally {
      setReTriaging(false);
    }
  };

  const scoreColor = (score: number) => {
    if (score >= 16) return "red";
    if (score >= 11) return "orange";
    if (score >= 6) return "gold";
    return "green";
  };

  const levelToEsi = (lvl: string) => (lvl === "CRITICAL" ? 2 : lvl === "URGENT" ? 3 : lvl === "SEMI_URGENT" ? 4 : 5);
  const esiColor = (esi?: number) => (esi === 1 ? "red" : esi === 2 ? "volcano" : esi === 3 ? "orange" : esi === 4 ? "blue" : "green");

  const columns = [
    {
      title: t("triage.patientName"),
      dataIndex: "patientName",
      key: "patientName",
    },
    {
      title: t("triage.examType"),
      dataIndex: "examType",
      key: "examType",
    },
    {
      title: t("triage.score"),
      dataIndex: "score",
      key: "score",
      sorter: (a: TriageItem, b: TriageItem) => b.score - a.score,
      render: (s: number) => <Tag color={scoreColor(s)}>{s}</Tag>,
    },
    {
      title: t("triage.level"),
      dataIndex: "level",
      key: "level",
      render: (lvl: string) => (
        <Tag color={levelColor[lvl] ?? "default"}>
          {t(levelLabel[lvl] ?? lvl)}
        </Tag>
      ),
    },
    {
      // [G005 W6] ESI 五级 (缺失时由 level 推导)
      title: t("w6Reg.triage.esi"),
      dataIndex: "esiLevel",
      key: "esiLevel",
      render: (_: unknown, r: TriageItem) => {
        const esi = r.esiLevel ?? levelToEsi(r.level);
        return (
          <Space size={4}>
            <Tag color={esiColor(esi)}>{esiLabel(esi)}</Tag>
            {r.reTriageRecommended && <Tag color="red">{t("w6Reg.triage.reTriage")}</Tag>}
          </Space>
        );
      },
    },
    {
      // [G005 W6] 队列优先级
      title: t("w6Reg.triage.queuePriority"),
      dataIndex: "queuePriority",
      key: "queuePriority",
      render: (p: string | undefined) => (
        <Tag color={p === "危重" ? "red" : p === "紧急" ? "orange" : "default"}>{p ?? "-"}</Tag>
      ),
    },
    {
      title: t("triage.status"),
      dataIndex: "status",
      key: "status",
      render: (s: string) => (
        <Tag>{s === "ASSIGNED" ? t("triage.assigned") : s === "COMPLETED" ? t("triage.completed") : t("triage.pending")}</Tag>
      ),
    },
    {
      title: t("triage.doctor"),
      dataIndex: "assignedDoctor",
      key: "assignedDoctor",
      render: (d: string | undefined) => d ?? "-",
    },
    {
      title: t("triage.actions"),
      key: "actions",
      render: (_: unknown, record: TriageItem) => (
        <Space>
          {record.status === "PENDING" && (
            <Button size="small" type="primary" onClick={() => handleAssign(record)}>
              {t("triage.assign")}
            </Button>
          )}
          <Button size="small" onClick={() => { setSelectedItem(record); setNewDoctor(record.assignedDoctor ?? ""); setNewStatus(record.status); setModalOpen(true); }}>
            {t("triage.adjust")}
          </Button>
          <Button size="small" onClick={() => { setReTriageItem(record); setVitals({}); setReTriageInfo(null); }} data-testid={`re-triage-${record.id}`}>
            {t("w6Reg.triage.reTriage")}
          </Button>
          {record.status !== "COMPLETED" && (
            <Button size="small" type="default" onClick={() => handleConfirm(record)}>
              {t("triage.confirm")}
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const criticalCount = items.filter(i => i.level === "CRITICAL").length;
  const urgentCount = items.filter(i => i.level === "URGENT").length;
  const pendingCount = items.filter(i => i.status === "PENDING").length;

  return (
    <PageContainer padding={24} data-testid="triage-worklist-page">
      <StatCardGrid minWidth={200} gap={16} style={{ marginBottom: 'var(--space-6, 24px)' }}>
        <StatCard title={t("triage.totalPending")} value={items.length} icon={<Clock size={18} />} color="primary" />
        <StatCard title={t("triage.critical")} value={criticalCount} icon={<Siren size={18} />} color="error" />
        <StatCard title={t("triage.urgent")} value={urgentCount} icon={<AlertTriangle size={18} />} color="warning" />
        <StatCard title={t("triage.unassigned")} value={pendingCount} icon={<UserCheck size={18} />} color="info" />
      </StatCardGrid>

      <DataTable
        dataSource={listPagination.pageData}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={listPagination.pagination}
      scroll={{ x: 'max-content' }}
      />

      <Modal
        title={t("triage.adjustTitle")}
        open={modalOpen}
        onOk={handleManualUpdate}
        onCancel={() => setModalOpen(false)}
      >
        {selectedItem && (
          <Descriptions column={1} size="small" style={{ marginBottom: 'var(--space-4, 16px)' }}>
            <Descriptions.Item label={t("triage.patientName")}>{selectedItem.patientName}</Descriptions.Item>
            <Descriptions.Item label={t("triage.examType")}>{selectedItem.examType}</Descriptions.Item>
            <Descriptions.Item label={t("triage.score")}>
              <Tag color={scoreColor(selectedItem.score)}>{selectedItem.score}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label={t("triage.level")}>
              <Tag color={levelColor[selectedItem.level]}>{t(levelLabel[selectedItem.level] ?? selectedItem.level)}</Tag>
            </Descriptions.Item>
          </Descriptions>
        )}
        <div style={{ marginBottom: 'var(--space-3, 12px)' }}>
          <div style={{ marginBottom: 'var(--space-1, 4px)' }}>{t("triage.doctor")}</div>
          <Select
            style={{ width: "100%" }}
            value={newDoctor}
            onChange={setNewDoctor}
            allowClear
            options={[
              { value: "张主任", label: "张主任" },
              { value: "李主任", label: "李主任" },
              { value: "王主任", label: "王主任" },
              { value: "陈医生", label: "陈医生" },
              { value: "赵医生", label: "赵医生" },
              { value: "周医生", label: "周医生" },
              { value: "吴医生", label: "吴医生" },
            ]}
          />
        </div>
        <div>
          <div style={{ marginBottom: 'var(--space-1, 4px)' }}>{t("triage.status")}</div>
          <Select
            style={{ width: "100%" }}
            value={newStatus}
            onChange={setNewStatus}
            options={[
              { value: "PENDING", label: t("triage.pending") },
              { value: "ASSIGNED", label: t("triage.assigned") },
              { value: "COMPLETED", label: t("triage.completed") },
            ]}
          />
        </div>
      </Modal>

      {/* [G005 W6] 复评: 生命体征录入 + ESI 自动建议 */}
      <Modal
        title={`${t("w6Reg.triage.reTriage")} · ${reTriageItem?.patientName ?? ""}`}
        open={!!reTriageItem}
        confirmLoading={reTriaging}
        okText={t("w6Reg.triage.reTriage")}
        cancelText={t("w6Reg.cancel")}
        onOk={handleReTriage}
        onCancel={() => setReTriageItem(null)}
        width={560}
      >
        <Row gutter={[8, 8]}>
          {([
            ["systolicBp", t("w6Reg.safety.bp")],
            ["diastolicBp", "舒张压 (mmHg)"],
            ["heartRate", t("w6Reg.safety.hr")],
            ["temperature", t("w6Reg.safety.temp")],
            ["spo2", t("w6Reg.safety.spo2")],
            ["respiratoryRate", t("w6Reg.safety.rr")],
          ] as Array<[keyof VitalInput, string]>).map(([key, label]) => (
            <Col span={8} key={key}>
              <div style={{ fontSize: 12, marginBottom: 'var(--space-1, 4px)' }}>{label}</div>
              <InputNumber
                style={{ width: "100%" }}
                value={vitals[key]}
                onChange={(v) => setVitals((prev) => ({ ...prev, [key]: v ?? undefined }))}
              />
            </Col>
          ))}
        </Row>
        {reTriageInfo && (
          <div style={{ marginTop: 'var(--space-3, 12px)' }}>
            <Space>
              <span>{t("w6Reg.triage.esi")}:</span>
              <Tag color={esiColor(reTriageInfo.esiLevel)}>{esiLabel(reTriageInfo.esiLevel)}</Tag>
              <span>{t("w6Reg.triage.queuePriority")}:</span>
              <Tag color="volcano">{reTriageInfo.queuePriority ?? "-"}</Tag>
            </Space>
            {reTriageInfo.breaches.length > 0 && (
              <Alert style={{ marginTop: 'var(--space-2, 8px)' }} type="warning" showIcon message={t("w6Reg.triage.breach")} description={reTriageInfo.breaches.join("；")} />
            )}
          </div>
        )}
      </Modal>
    </PageContainer>
  );
};

export default TriagePage;
