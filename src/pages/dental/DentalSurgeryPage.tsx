import React, { useState, useEffect } from "react";
import { Table, Tag, Button, Modal, Form, Input, Select, message } from "antd";
import { Plus } from "lucide-react";
import { DentalPageLayout, EmptyState, TreatmentActions } from "./DentalShared";
import type { DentalTreatment } from "./DentalShared";

export const DentalSurgeryPage: React.FC = () => {
  const [treats, setT] = useState<DentalTreatment[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const PAGE_SIZE = 10;
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();
  const load = () => {
    setLoading(true);
    fetch(`/api/v1/dental/treatments?type=Surgery&page=${page}&pageSize=${PAGE_SIZE}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setT(d.data);
          setTotal(d.meta?.total ?? d.data?.length ?? 0);
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
      const r = await fetch("/api/v1/dental/treatments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...v, type: "Surgery" }),
      });
      const d = await r.json();
      if (d.success) {
        message.success("已创建外科手术");
        setModalOpen(false);
        form.resetFields();
        load();
      } else message.error(d.message || "创建失败");
    } catch (e) {
      console.warn("[F03] Error:", (e as Error)?.message);
    }
  };
  return (
    <DentalPageLayout
      header={{
        title: "口腔外科",
        extra: (
          <Button
            type="primary"
            icon={<Plus size={14} />}
            onClick={() => setModalOpen(true)}
          >
            新建手术
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
          tip="暂无口腔外科记录"
          onCreate={() => setModalOpen(true)}
          createLabel="新建手术"
        />
      ) : (
        <Table
          rowKey="id"
          size="small"
          pagination={{ current: page, pageSize: PAGE_SIZE, total, onChange: setPage, showSizeChanger: false }}
          dataSource={treats}
          columns={[
            { title: "患者", dataIndex: "patientName", width: 100 },
            { title: "术式", dataIndex: "plan" },
            {
              title: "麻醉",
              dataIndex: "anesthesia",
              width: 100,
              render: (a?: string) => (a ? <Tag color="orange">{a}</Tag> : "-"),
            },
            { title: "日期", dataIndex: "createdAt", width: 100 },
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
        title="新建口腔外科"
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
          <Form.Item label="术式" name="plan" rules={[{ required: true }]}>
            <Input placeholder="例 阻生牙拔除术" />
          </Form.Item>
          <Form.Item label="麻醉" name="anesthesia">
            <Select
              options={[
                { value: "局麻", label: "局麻" },
                { value: "全麻", label: "全麻" },
                { value: "镇静", label: "镇静" },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </DentalPageLayout>
  );
};

export default DentalSurgeryPage;
