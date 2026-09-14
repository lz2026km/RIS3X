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
import { t } from "../../i18n/appI18n";

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
        message.success(t("dentalRestorative.created"));
        setModalOpen(false);
        form.resetFields();
        load();
      } else message.error(d.error?.message || t("dentalRestorative.createFailed"));
    } catch (e) {
      console.warn("[F03] Error:", (e as Error)?.message);
    }
  };
  return (
    <DentalPageLayout
      header={{
        title: t("dentalRestorative.title"),
        extra: (
          <Button
            type="primary"
            icon={<Plus size={14} />}
            onClick={() => setModalOpen(true)}
          >
            {t("dentalRestorative.createNew")}
          </Button>
        ),
      }}
    >
      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-secondary)" }}>
          {t("dentalRestorative.loading")}
        </div>
      ) : treats.length === 0 ? (
        <EmptyState
          tip={t("dentalRestorative.noRecords")}
          onCreate={() => setModalOpen(true)}
          createLabel={t("dentalRestorative.createNew")}
        />
      ) : (
        <Table
          rowKey="id"
          size="small"
          pagination={{ current: page, pageSize: PAGE_SIZE, total, onChange: setPage, showSizeChanger: false }}
          dataSource={treats}
          columns={[
            { title: t('dentalShared.patient'), dataIndex: "patientName", width: 100 },
            {
              title: t('dentalShared.toothNo'),
              dataIndex: "toothNo",
              width: 80,
              render: (n?: number) => (n ? <Tag color="blue">#{n}</Tag> : "-"),
            },
            { title: t('dentalShared.surface'), dataIndex: "toothSurface", width: 60 },
            {
              title: t("dentalRestorative.material"),
              dataIndex: "material",
              width: 100,
              render: (m?: string) => (m ? <Tag color="cyan">{m}</Tag> : "-"),
            },
            {
              title: t('dentalShared.cost'),
              dataIndex: "cost",
              width: 80,
              render: (v?: number) => (v != null ? `¥${v}` : "-"),
            },
            {
              title: t('dentalShared.status'),
              dataIndex: "status",
              width: 90,
              render: (s?: string) => <Tag>{s || "-"}</Tag>,
            },
            {
              title: t('dentalShared.actions'),
              width: 180,
              render: (_, rec) => <TreatmentActions record={rec} />,
            },
          ]}
        scroll={{ x: 'max-content' }}
        />
      )}
      <Modal
        title={t("dentalRestorative.modalTitle")}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={onCreate}
        okText={t("dentalRestorative.create")}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label={t('dentalShared.patientId')}
            name="patientId"
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>
          <Form.Item label={t('dentalShared.toothNo')} name="toothNo">
            <InputNumber min={11} max={48} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item label={t('dentalShared.surface')} name="toothSurface">
            <Select
              options={[
                { value: "O", label: t("dentalRestorative.surfaceO") },
                { value: "M", label: t("dentalRestorative.surfaceM") },
                { value: "D", label: t("dentalRestorative.surfaceD") },
                { value: "B", label: t("dentalRestorative.surfaceB") },
                { value: "L", label: t("dentalRestorative.surfaceL") },
              ]}
            />
          </Form.Item>
          <Form.Item label={t("dentalRestorative.material")} name="material">
            <Select
              options={[
                { value: "Z350", label: t("dentalRestorative.materialZ350") },
                { value: "P60", label: t("dentalRestorative.materialP60") },
                { value: "Glass", label: t("dentalRestorative.materialGlass") },
                { value: "Zirconia", label: t("dentalRestorative.materialZirconia") },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </DentalPageLayout>
  );
};

export default DentalRestorativePage;
