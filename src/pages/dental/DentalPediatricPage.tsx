// [v3.0.6.11-103 Wave 9] 儿童牙科管理: KPI 统计 + 状态/搜索筛选 + 真表格(分页/空态) + 新建/编辑/删除/刷新/导出 + i18n + seed 回退
import React, { useState, useEffect, useMemo } from "react";
import {
  Table,
  Tag,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Space,
  Popconfirm,
  message,
} from "antd";
import { Wallet, Clock3, CheckCircle2, Baby } from "lucide-react";
import { DentalPageLayout, EmptyState, TreatmentActions } from "./DentalShared";
import type { DentalTreatment } from "./DentalShared";
import { dentalApi } from "../../services/api/dentalApi";
import { t } from "../../i18n/appI18n";
import { StatCard, StatCardGrid } from "../../components/common/StatCard";
import { ActionButton } from "../../components/common/ActionButton";
import { ErrorBanner } from "../../components/feedback";

const TYPE = "Pediatric";
const PAGE_SIZE = 10;

// 确定性 seed 回退 (API 不可用时展示, 与 MSW 字段对齐)
const SEED_TREATMENTS: any[] = [
  { id: "SEED-PED-001", patientId: "P92001", patientName: "刘子轩", toothNo: "E", diagnosis: "乳牙龋坏", plan: "窝沟封闭 + 氟保护", status: "InProgress", cost: 400, createdAt: "2026-08-01T09:30:00.000Z" },
  { id: "SEED-PED-002", patientId: "P92002", patientName: "陈语嫣", toothNo: "A", diagnosis: "乳牙深龋", plan: "乳牙根管治疗", status: "Planned", cost: 900, createdAt: "2026-08-02T10:00:00.000Z" },
  { id: "SEED-PED-003", patientId: "P92003", patientName: "赵一诺", toothNo: "K", diagnosis: "乳牙滞留", plan: "乳牙拔除", status: "InProgress", cost: 300, createdAt: "2026-07-28T14:20:00.000Z" },
  { id: "SEED-PED-004", patientId: "P92004", patientName: "孙浩然", toothNo: "F", diagnosis: "窝沟龋", plan: "充填治疗 + 窝沟封闭", status: "Completed", cost: 500, createdAt: "2026-07-20T11:00:00.000Z" },
  { id: "SEED-PED-005", patientId: "P92005", patientName: "周雨桐", toothNo: "T", diagnosis: "乳牙牙髓炎", plan: "乳牙根管治疗 + 预成冠", status: "Completed", cost: 1200, createdAt: "2026-07-15T09:00:00.000Z" },
  { id: "SEED-PED-006", patientId: "P92006", patientName: "吴彦博", toothNo: "C", diagnosis: "龋病风险评估", plan: "氟保护 + 口腔卫生指导", status: "Cancelled", cost: 200, createdAt: "2026-07-10T16:40:00.000Z" },
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
  a.download = `dental-pediatric-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export const DentalPediatricPage: React.FC = () => {
  const [treats, setT] = useState<DentalTreatment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
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
    setLoadError(null);
    try {
      const d = await dentalApi.listTreatments({ type: TYPE, page: 1, pageSize: 200 });
      if (d.success && Array.isArray(d.data) && d.data.length > 0) {
        setT(d.data);
        setFromSeed(false);
      } else {
        setT(SEED_TREATMENTS);
        setFromSeed(true);
        if (!d.success) setLoadError(t("w9.states.error"));
      }
    } catch {
      setT(SEED_TREATMENTS);
      setFromSeed(true);
      setLoadError(t("w9.states.error"));
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
      plan: rec.plan,
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
          message.success(t("w9.dentalPed.updated"));
        } else {
          message.error(d.error?.message || t("w9.dentalPed.updated"));
        }
      } else {
        const d = await dentalApi.createTreatment({ ...v, type: TYPE, status: "Planned" });
        if (d.success) {
          message.success(t("w9.dentalPed.created"));
          setT((prev) => [d.data, ...prev]);
        } else {
          message.error(d.error?.message || t("w9.dentalPed.created"));
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
        title: t("w9.dentalPed.title"),
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
              {t("w9.dentalPed.create")}
            </ActionButton>
          </Space>
        ),
      }}
      alert={{
        message: `${t("w9.dentalPed.deciduous")} · 窝沟封闭 / 氟保护`,
        type: "info",
      }}
    >
      {loadError && <ErrorBanner message={loadError} onRetry={() => void load()} retryLabel={t("w9.states.retry")} />}
      <StatCardGrid style={{ marginBottom: 16 }}>
        <StatCard title={t("w9.common.statsTotal")} value={treats.length} icon={<Baby size={18} />} color="primary" />
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
          tip={t("w9.dentalPed.empty")}
          onCreate={openCreate}
          createLabel={t("w9.dentalPed.create")}
        />
      ) : (
        <Table
          rowKey="id"
          size="small"
          pagination={{ current: page, pageSize: PAGE_SIZE, total: filtered.length, onChange: setPage, showSizeChanger: false }}
          dataSource={paged}
          columns={[
            { title: t("w9.common.patient"), dataIndex: "patientName", width: 100 },
            { title: t("w9.dentalPed.deciduous"), dataIndex: "toothNo", width: 100 },
            { title: t("w9.common.diagnosis"), dataIndex: "diagnosis" },
            { title: t("w9.common.plan"), dataIndex: "plan" },
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
        title={editing ? t("w9.dentalPed.editTitle") : t("w9.dentalPed.create")}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => void onSave()}
        okText={t("w9.common.create")}
        confirmLoading={saving}
      >
        <Form form={form} layout="vertical">
          <Form.Item label={t("w9.common.patientId")} name="patientId" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label={t("w9.dentalPed.deciduous")} name="toothNo" rules={[{ required: true }]}>
            <Input placeholder="例 A (右上乳中切牙)" />
          </Form.Item>
          <Form.Item label={t("w9.common.diagnosis")} name="diagnosis">
            <Input placeholder="例 乳牙龋坏" />
          </Form.Item>
          <Form.Item label={t("w9.common.plan")} name="plan">
            <Input placeholder="例 窝沟封闭 / 充填" />
          </Form.Item>
        </Form>
      </Modal>
    </DentalPageLayout>
  );
};

export default DentalPediatricPage;
