import React, { useState, useEffect } from "react";
import {
  Table,
  Tag,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  message,
} from "antd";
import { Plus } from "lucide-react";
import { DentalPageLayout, EmptyState, TreatmentActions } from "./DentalShared";
import type { DentalTreatment } from "./DentalShared";
// [v3.0.6.11-88 Round10] raw fetch → dentalApi.listTreatments/createTreatment (后端 /dental/treatments 真实存在)
import { dentalApi } from "../../services/api/dentalApi";

export const DentalRestorativePage: React.FC = () => {
  const [treats, setT] = useState<DentalTreatment[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const PAGE_SIZE = 10;
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();
  const load = () => {
    setLoading(true);
    dentalApi.listTreatments({ type: 'Restorative', page, pageSize: PAGE_SIZE })
      .then((d) => {
        if (d.success) {
          setT(d.data);
          setTotal((d.meta as { total?: number } | undefined)?.total ?? d.data?.length ?? 0);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };
  useEffect(() => {
    load();
  }, [page]);
  const onCreate = async () => {
    try {
      const v = await form.validateFields();
      const d = await dentalApi.createTreatment({ ...v, type: "Restorative" });
      if (d.success) {
        message.success("已创建修复治疗");
        setModalOpen(false);
        form.resetFields();
        load();
      } else message.error(d.error?.message || "创建失败");
    } catch (e) {
      console.warn("[F03] Error:", (e as Error)?.message);
    }
  };
  return (
    <DentalPageLayout
      header={{
        title: "修复 (CAD/CAM)",
        extra: (
          <Button
            type="primary"
            icon={<Plus size={14} />}
            onClick={() => setModalOpen(true)}
          >
            新建修复
          </Button>
        ),
      }}
    >
      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-secondary)" }}>
          加载中...
        </div>
      ) : treats.length === 0 ? (
        <EmptyState
          tip="暂无修复记录"
          onCreate={() => setModalOpen(true)}
          createLabel="新建修复"
        />
      ) : (
        <Table
          rowKey="id"
          size="small"
          pagination={{ current: page, pageSize: PAGE_SIZE, total, onChange: setPage, showSizeChanger: false }}
          dataSource={treats}
          columns={[
            { title: "患者", dataIndex: "patientName", width: 100 },
            {
              title: "牙位",
              dataIndex: "toothNo",
              width: 80,
              render: (n?: number) => (n ? <Tag color="blue">#{n}</Tag> : "-"),
            },
            { title: "面", dataIndex: "toothSurface", width: 60 },
            {
              title: "材料",
              dataIndex: "material",
              width: 100,
              render: (m?: string) => (m ? <Tag color="cyan">{m}</Tag> : "-"),
            },
            {
              title: "费用",
              dataIndex: "cost",
              width: 80,
              render: (v?: number) => (v != null ? `¥${v}` : "-"),
            },
            {
              title: "状态",
              dataIndex: "status",
              width: 90,
              render: (s?: string) => <Tag>{s || "-"}</Tag>,
            },
            {
              title: "操作",
              width: 180,
              render: (_, t) => <TreatmentActions record={t} />,
            },
          ]}
        scroll={{ x: 'max-content' }}
        />
      )}
      <Modal
        title="新建修复治疗"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={onCreate}
        okText="创建"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="患者ID"
            name="patientId"
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>
          <Form.Item label="牙位" name="toothNo">
            <InputNumber min={11} max={48} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item label="面" name="toothSurface">
            <Select
              options={[
                { value: "O", label: "O 颌面" },
                { value: "M", label: "M 近中" },
                { value: "D", label: "D 远中" },
                { value: "B", label: "B 颊侧" },
                { value: "L", label: "L 舌侧" },
              ]}
            />
          </Form.Item>
          <Form.Item label="材料" name="material">
            <Select
              options={[
                { value: "Z350", label: "Z350 树脂" },
                { value: "P60", label: "P60 后牙树脂" },
                { value: "Glass", label: "玻璃离子" },
                { value: "Zirconia", label: "二氧化锆" },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </DentalPageLayout>
  );
};

export default DentalRestorativePage;
