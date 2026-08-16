// [v3.0.6.11-103 Wave 9] 根管治疗管理: KPI 统计 + 状态/搜索筛选 + 真表格(分页/空态) + 新建/编辑/删除/刷新/导出 + i18n + seed 回退
import React, { useState, useEffect, useMemo } from "react";
import {
  Table,
  Tag,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Popconfirm,
  message,
} from "antd";
import { Wallet, Clock3, CheckCircle2, Stethoscope } from "lucide-react";
import { DentalPageLayout, EmptyState, TreatmentActions } from "./DentalShared";
import type { DentalTreatment } from "./DentalShared";
import { dentalApi } from "../../services/api/dentalApi";
import { t } from "../../i18n/appI18n";
import { StatCard, StatCardGrid } from "../../components/common/StatCard";
import { ActionButton } from "../../components/common/ActionButton";

const TYPE = "Endodontic";
const PAGE_SIZE = 10;

// 确定性 seed 回退 (API 不可用时展示, 与 MSW 字段对齐)
const SEED_TREATMENTS: DentalTreatment[] = [
  { id: "SEED-ENDO-001", patientId: "P90001", patientName: "张伟", toothNo: 16, diagnosis: "慢性牙髓炎", plan: "根管治疗后全冠修复", status: "InProgress", cost: 1800, createdAt: "2026-08-01T09:30:00.000Z" },
  { id: "SEED-ENDO-002", patientId: "P90002", patientName: "王芳", toothNo: 26, diagnosis: "急性牙髓炎", plan: "根管治疗 (一次法)", status: "Planned", cost: 1500, createdAt: "2026-08-02T10:00:00.000Z" },
  { id: "SEED-ENDO-003", patientId: "P90003", patientName: "李娜", toothNo: 46, diagnosis: "根尖周炎", plan: "根管再治疗 + 冠修复", status: "InProgress", cost: 3200, createdAt: "2026-07-28T14:20:00.000Z" },
  { id: "SEED-ENDO-004", patientId: "P90004", patientName: "刘敏", toothNo: 36, diagnosis: "慢性牙髓炎", plan: "根管治疗后全冠修复", status: "Completed", cost: 2600, createdAt: "2026-07-20T11:00:00.000Z" },
  { id: "SEED-ENDO-005", patientId: "P90005", patientName: "陈静", toothNo: 11, diagnosis: "牙髓坏死", plan: "根管治疗 + 牙体充填", status: "Completed", cost: 1200, createdAt: "2026-07-15T09:00:00.000Z" },
  { id: "SEED-ENDO-006", patientId: "P90006", patientName: "杨丽", toothNo: 24, diagnosis: "急性根尖周炎", plan: "根管开放引流 + 根管治疗", status: "Cancelled", cost: 900, createdAt: "2026-07-10T16:40:00.000Z" },
];

const STATUS_OPTIONS = [
  { value: "", label: "" },
  { value: "Planned", label: "Planned" },
  { value: "InProgress", label: "InProgress" },
  { value: "Completed", label: "Completed" },
  { value: "Cancelled", label: "Cancelled" },
];

function exportCsv(rows: DentalTreatment[]): void {
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const header = ["id", "patientId", "patientName", "toothNo", "diagnosis", "plan", "status", "cost", "createdAt"];
  const lines = [header.join(","), ...rows.map((r) => [r.id, r.patientId, r.patientName, r.toothNo, r.diagnosis, r.plan, r.status, r.cost, r.createdAt].map(esc).join(","))];
  const blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `dental-endo-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export const DentalEndoPage: React.FC = () => {
  const [treats, setT] = useState<DentalTreatment[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromSeed, setFromSeed] = useState(false);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<DentalTreatment | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const d = await dentalApi.listTreatments({ type: TYPE, page: 1, pageSize: 200 });
      if (d.success && Array.isArray(d.data) && d.data.length > 0) {
        setT(d.data);
        setFromSeed(false);
      } else {
        setT(SEED_TREATMENTS);
        setFromSeed(true);
      }
    } catch {
      setT(SEED_TREATMENTS);
      setFromSeed(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    let rows = treats;
    if (statusFilter) rows = rows.filter((r) => r.status === statusFilter);
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter((r) =>
        (r.patientName || "").toLowerCase().includes(q) ||
        (r.patientId || "").toLowerCase().includes(q) ||
        (r.diagnosis || "").toLowerCase().includes(q),
      );
    }
    return rows;
  }, [treats, statusFilter, search]);

  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const doneCount = treats.filter((r) => r.status === "Completed").length;
  const activeCount = treats.filter((r) => r.status === "InProgress").length;
  const totalCost = treats.reduce((s, r) => s + (r.cost ?? 0), 0);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (rec: DentalTreatment) => {
    setEditing(rec);
    form.setFieldsValue({
      patientId: rec.patientId,
      toothNo: rec.toothNo,
      diagnosis: rec.diagnosis,
      rootCount: (rec as unknown as { rootCount?: number }).rootCount,
    });
    setModalOpen(true);
  };

  const onSave = async () => {
    try {
      const v = await form.validateFields();
      setSaving(true);
      if (editing) {
        const d = await dentalApi.updateTreatment(editing.id, { ...v, type: TYPE });
        if (d.success) {
          setT((prev) => prev.map((r) => (r.id === editing.id ? { ...r, ...v } : r)));
          message.success(t("w9.dentalEndo.updated"));
        } else {
          message.error(d.error?.message || t("w9.dentalEndo.updated"));
        }
      } else {
        const d = await dentalApi.createTreatment({ ...v, type: TYPE, status: "Planned" });
        if (d.success) {
          message.success(t("w9.dentalEndo.created"));
          setT((prev) => [d.data, ...prev]);
        } else {
          message.error(d.error?.message || t("w9.dentalEndo.created"));
        }
      }
      setModalOpen(false);
      form.resetFields();
    } catch (e) {
      console.warn("[F03] Error:", (e as Error)?.message);
    } finally {
      setSaving(false);
    }
  };

  const onDelete = (rec: DentalTreatment) => {
    setT((prev) => prev.filter((r) => r.id !== rec.id));
    message.success(t("w9.common.deleteSuccess"));
  };

  const onExport = () => {
    if (filtered.length === 0) return;
    exportCsv(filtered);
    message.success(t("w9.common.exportSuccess"));
  };

  return (
    <DentalPageLayout
      header={{
        title: t("w9.dentalEndo.title"),
        version: "v3.0.6.11-103",
        tags: [fromSeed && <Tag key="src" color="orange">{t("w9.common.apiFallback")}</Tag>],
        extra: (
          <Space wrap>
            <ActionButton action="refresh" size="compact" loading={loading} onClick={() => void load()}>
              {t("w9.common.refresh")}
            </ActionButton>
            <ActionButton action="export" size="compact" disabled={filtered.length === 0} onClick={onExport}>
              {t("w9.common.export")}
            </ActionButton>
            <ActionButton action="create" size="compact" onClick={openCreate}>
              {t("w9.dentalEndo.create")}
            </ActionButton>
          </Space>
        ),
      }}
    >
      <StatCardGrid style={{ marginBottom: 16 }}>
        <StatCard title={t("w9.common.statsTotal")} value={treats.length} icon={<Stethoscope size={18} />} color="primary" />
        <StatCard title={t("w9.common.statsActive")} value={activeCount} icon={<Clock3 size={18} />} color="warning" />
        <StatCard title={t("w9.common.statsDone")} value={doneCount} icon={<CheckCircle2 size={18} />} color="success" />
        <StatCard title={t("w9.common.statsCost")} value={totalCost.toLocaleString("zh-CN")} suffix="¥" icon={<Wallet size={18} />} color="error" />
      </StatCardGrid>

      <Space style={{ marginBottom: 12 }} wrap>
        <Select
          size="small"
          style={{ width: 140 }}
          value={statusFilter}
          onChange={(v) => { setStatusFilter(v); setPage(1); }}
          options={STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.value || t("w9.common.allStatus") }))}
        />
        <Input
          size="small"
          allowClear
          style={{ width: 220 }}
          placeholder={t("w9.common.filterPatient")}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
        <Tag color={fromSeed ? "orange" : "green"} style={{ marginInlineEnd: 0 }}>
          {filtered.length} / {treats.length}
        </Tag>
      </Space>

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-secondary)" }}>{t("w9.common.loading")}</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          tip={t("w9.dentalEndo.empty")}
          onCreate={openCreate}
          createLabel={t("w9.dentalEndo.create")}
        />
      ) : (
        <Table
          rowKey="id"
          size="small"
          pagination={{ current: page, pageSize: PAGE_SIZE, total: filtered.length, onChange: setPage, showSizeChanger: false }}
          dataSource={paged}
          columns={[
            { title: t("w9.common.patient"), dataIndex: "patientName", width: 100 },
            {
              title: t("w9.dentalEndo.tooth"),
              dataIndex: "toothNo",
              width: 90,
              render: (n?: number) => (n ? <Tag color="blue">#{n}</Tag> : "-"),
            },
            { title: t("w9.common.diagnosis"), dataIndex: "diagnosis" },
            { title: t("w9.dentalEndo.rootCount"), dataIndex: "rootCount", width: 80, render: (v?: number) => v ?? "-" },
            { title: t("w9.common.cost"), dataIndex: "cost", width: 90, render: (v?: number) => (v != null ? `¥${v.toLocaleString("zh-CN")}` : "-") },
            {
              title: t("w9.common.status"),
              dataIndex: "status",
              width: 110,
              render: (s?: string) => (
                <Tag color={s === "Completed" ? "green" : s === "InProgress" ? "orange" : s === "Cancelled" ? "red" : "default"}>
                  {s || "-"}
                </Tag>
              ),
            },
            {
              title: t("w9.common.actions"),
              width: 220,
              render: (_, rec) => (
                <Space size={4}>
                  <Button size="small" onClick={() => openEdit(rec)}>{t("w9.common.edit")}</Button>
                  <TreatmentActions record={rec} />
                  <Popconfirm title={t("w9.common.deleteConfirm")} onConfirm={() => onDelete(rec)}>
                    <ActionButton action="delete" size="compact">
                      {t("w9.common.delete")}
                    </ActionButton>
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
          scroll={{ x: "max-content" }}
        />
      )}

      <Modal
        title={editing ? t("w9.dentalEndo.editTitle") : t("w9.dentalEndo.create")}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => void onSave()}
        okText={t("w9.common.create")}
        confirmLoading={saving}
      >
        <Form form={form} layout="vertical">
          <Form.Item label={t("w9.common.patientId")} name="patientId" rules={[{ required: true }]}>
            <Input placeholder="例 P100001" />
          </Form.Item>
          <Form.Item label={t("w9.dentalEndo.tooth")} name="toothNo" rules={[{ required: true }]}>
            <InputNumber min={11} max={48} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item label={t("w9.common.diagnosis")} name="diagnosis">
            <Input placeholder="例 慢性牙髓炎" />
          </Form.Item>
          <Form.Item label={t("w9.dentalEndo.rootCount")} name="rootCount">
            <InputNumber min={1} max={5} style={{ width: "100%" }} />
          </Form.Item>
        </Form>
      </Modal>
    </DentalPageLayout>
  );
};

export default DentalEndoPage;
