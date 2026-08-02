import React, { useEffect, useState, useCallback } from "react";
import {
  Table,
  Button,
  Tag,
  Modal,
  Select,
  message,
  Card,
  Row,
  Col,
  Statistic,
  Space,
  Descriptions,
} from "antd";
import { api } from "../../services/api/client";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();
  const [items, setItems] = useState<TriageItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<TriageItem | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [newDoctor, setNewDoctor] = useState("");
  const [newStatus, setNewStatus] = useState<string>("");

  const fetchPending = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/triage/pending");
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
      const res = await api.post("/triage/assign", {
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

  const scoreColor = (score: number) => {
    if (score >= 16) return "red";
    if (score >= 11) return "orange";
    if (score >= 6) return "gold";
    return "green";
  };

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
    <div style={{ padding: 24 }}>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic title={t("triage.totalPending")} value={items.length} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title={t("triage.critical")} value={criticalCount} styles={{ content: {  color: "#cf1322"  } }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title={t("triage.urgent")} value={urgentCount} styles={{ content: {  color: "#fa8c16"  } }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title={t("triage.unassigned")} value={pendingCount} />
          </Card>
        </Col>
      </Row>

      <Table
        dataSource={items}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10, showSizeChanger: true }}
      />

      <Modal
        title={t("triage.adjustTitle")}
        open={modalOpen}
        onOk={handleManualUpdate}
        onCancel={() => setModalOpen(false)}
      >
        {selectedItem && (
          <Descriptions column={1} size="small" style={{ marginBottom: 16 }}>
            <Descriptions.Item label={t("triage.patientName")}>{selectedItem.patientName}</Descriptions.Item>
            <Descriptions.Item label={t("triage.examType")}>{selectedItem.examType}</Descriptions.Item>
            <Descriptions.Item label={t("triage.score")}>
              <Tag color={scoreColor(selectedItem.score)}>{selectedItem.score}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label={t("triage.level")}>
              <Tag color={levelColor[selectedItem.level]}>{t(levelLabel[selectedItem.level])}</Tag>
            </Descriptions.Item>
          </Descriptions>
        )}
        <div style={{ marginBottom: 12 }}>
          <div style={{ marginBottom: 4 }}>{t("triage.doctor")}</div>
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
          <div style={{ marginBottom: 4 }}>{t("triage.status")}</div>
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
    </div>
  );
};

export default TriagePage;
