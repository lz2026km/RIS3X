import React, { useState, useEffect } from "react";
import { Table, Tag, Button, Modal, Form, Input, message } from "antd";
import { Plus } from "lucide-react";
import { DentalPageLayout, EmptyState, TreatmentActions } from "./DentalShared";
import type { DentalTreatment } from "./DentalShared";

export const DentalPediatricPage: React.FC = () => {
  const [treats, setT] = useState<DentalTreatment[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const PAGE_SIZE = 10;
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();
  const load = () => {
    setLoading(true);
    fetch(`/api/v1/dental/treatments?type=Pediatric&page=${page}&pageSize=${PAGE_SIZE}`)
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
        body: JSON.stringify({ ...v, type: "Pediatric" }),
      });
      const d = await r.json();
      if (d.success) {
        message.success("已创建儿童牙科记录");
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
        title: "儿童牙科",
        extra: (
          <Button
            type="primary"
            icon={<Plus size={14} />}
            onClick={() => setModalOpen(true)}
          >
            新建记录
          </Button>
        ),
      }}
      alert={{
        message: "儿童牙科专用功能: 乳牙编号 (A-T), 窝沟封闭, 氟保护",
        type: "info",
      }}
    >
      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>
          加载中...
        </div>
      ) : treats.length === 0 ? (
        <EmptyState
          tip="暂无儿童牙科记录"
          onCreate={() => setModalOpen(true)}
          createLabel="新建儿童牙科记录"
        />
      ) : (
        <Table
          rowKey="id"
          size="small"
          pagination={{ current: page, pageSize: PAGE_SIZE, total, onChange: setPage, showSizeChanger: false }}
          dataSource={treats}
          columns={[
            { title: "患者", dataIndex: "patientName", width: 100 },
            { title: "乳牙位", dataIndex: "toothNo", width: 80 },
            { title: "诊断", dataIndex: "diagnosis" },
            { title: "处理", dataIndex: "plan" },
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
        />
      )}
      <Modal
        title="新建儿童牙科记录"
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
          <Form.Item
            label="乳牙编号 (A-T)"
            name="toothNo"
            rules={[{ required: true }]}
          >
            <Input placeholder="例 A (右上乳中切牙)" />
          </Form.Item>
          <Form.Item label="诊断" name="diagnosis">
            <Input placeholder="例 乳牙龋坏" />
          </Form.Item>
          <Form.Item label="处理" name="plan">
            <Input placeholder="例 窝沟封闭 / 充填" />
          </Form.Item>
        </Form>
      </Modal>
    </DentalPageLayout>
  );
};

export default DentalPediatricPage;
