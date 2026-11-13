import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Tag,
  message,
} from "antd";
import { Image as ImageIcon, Plus, Trash2 } from "lucide-react";
import {
  reportApi,
  type ReportKeyImageDto,
} from "../../services/api/reportApi";
import { dicomWebApi } from "../../services/api/dicomApi";
import { UidCopyField } from "../common/UidCopyField";
import { t } from "../../i18n/appI18n";

export interface ReportKeyImagePanelProps {
  reportId: string;
  studyUid?: string;
  seriesUid?: string;
  examId?: string;
  onChanged?: () => void;
}

interface KeyImageFormValues {
  studyUid?: string;
  seriesUid?: string;
  sopUid?: string;
  frame?: number;
  label?: string;
}

export function ReportKeyImagePanel({
  reportId,
  studyUid,
  seriesUid,
  examId,
  onChanged,
}: ReportKeyImagePanelProps) {
  const [items, setItems] = useState<ReportKeyImageDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [seriesOptions, setSeriesOptions] = useState<
    Array<{ value: string; label: string }>
  >([]);
  const [instanceOptions, setInstanceOptions] = useState<
    Array<{ value: string; label: string }>
  >([]);
  const [form] = Form.useForm<KeyImageFormValues>();
  const formStudyUid = Form.useWatch("studyUid", form);
  const formSeriesUid = Form.useWatch("seriesUid", form);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await reportApi.getKeyImages(reportId);
      if (res.success) {
        setItems(res.data?.items ?? []);
      } else {
        setError(res.error?.message ?? t("reportKeyImages.loadFailed"));
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("reportKeyImages.loadFailed"),
      );
    } finally {
      setLoading(false);
    }
  }, [reportId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    if (!showAdd || !formStudyUid) {
      setSeriesOptions([]);
      return;
    }
    void (async () => {
      try {
        const res = await dicomWebApi.searchSeries(formStudyUid);
        if (cancelled) return;
        const list = Array.isArray(res.data) ? res.data : [];
        setSeriesOptions(
          list.map((s) => ({
            value: s.seriesInstanceUID,
            label: `${s.seriesNumber ?? "-"} · ${s.seriesDescription || s.modality || s.seriesInstanceUID}`,
          })),
        );
      } catch {
        if (!cancelled) setSeriesOptions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showAdd, formStudyUid]);

  useEffect(() => {
    let cancelled = false;
    if (!showAdd || !formStudyUid || !formSeriesUid) {
      setInstanceOptions([]);
      return;
    }
    void (async () => {
      try {
        const res = await dicomWebApi.searchInstances(
          formStudyUid,
          formSeriesUid,
        );
        if (cancelled) return;
        const list = Array.isArray(res.data) ? res.data : [];
        setInstanceOptions(
          list.map((i) => ({
            value: i.sopInstanceUID,
            label: `${i.instanceNumber ?? "-"} · ${i.sopInstanceUID}`,
          })),
        );
      } catch {
        if (!cancelled) setInstanceOptions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showAdd, formStudyUid, formSeriesUid]);

  const openAdd = () => {
    form.setFieldsValue({
      studyUid: studyUid ?? "",
      seriesUid: seriesUid ?? "",
    });
    setShowAdd(true);
  };

  const handleAdd = async () => {
    let values: KeyImageFormValues;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    const sopUid = String(values.sopUid ?? "").trim();
    if (!sopUid) {
      message.error(t("reportKeyImages.sopRequired"));
      return;
    }
    setSaving(true);
    try {
      const res = await reportApi.addKeyImage(reportId, {
        studyUid: String(values.studyUid ?? "").trim(),
        seriesUid: String(values.seriesUid ?? "").trim(),
        sopUid,
        imageKey: sopUid,
        frame: values.frame ?? 0,
        caption: String(values.label ?? "").trim(),
        label: String(values.label ?? "").trim(),
        examId,
      });
      if (!res.success) {
        message.error(res.error?.message ?? t("reportKeyImages.addFailed"));
        return;
      }
      message.success(t("reportKeyImages.added"));
      setShowAdd(false);
      form.resetFields();
      await load();
      onChanged?.();
    } catch (err) {
      message.error(
        err instanceof Error ? err.message : t("reportKeyImages.addFailed"),
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (imageId: string) => {
    try {
      const res = await reportApi.deleteKeyImage(reportId, imageId);
      if (!res.success) {
        message.error(res.error?.message ?? t("reportKeyImages.deleteFailed"));
        return;
      }
      message.success(t("reportKeyImages.deleted"));
      await load();
      onChanged?.();
    } catch (err) {
      message.error(
        err instanceof Error ? err.message : t("reportKeyImages.deleteFailed"),
      );
    }
  };

  const content = useMemo(() => {
    if (loading) {
      return (
        <div
          style={{
            padding: 24,
            textAlign: "center",
            color: "var(--text-muted, #64748b)",
            fontSize: 12,
          }}
        >
          {t("reportKeyImages.loading")}
        </div>
      );
    }
    if (error) {
      return (
        <div
          style={{
            padding: 16,
            borderRadius: 8,
            background: "var(--color-error-bg)",
            border: "1px solid var(--color-error-border)",
            color: "var(--color-error-600)",
            fontSize: 12,
          }}
        >
          {error}
        </div>
      );
    }
    if (items.length === 0) {
      return (
        <Empty
          image={<ImageIcon size={40} style={{ opacity: 0.4 }} />}
          description={t("reportKeyImages.empty")}
        />
      );
    }
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: 12,
        }}
      >
        {items.map((item) => (
          <div
            key={item.id}
            style={{
              border: "1px solid var(--border-color)",
              borderRadius: 8,
              overflow: "hidden",
              background: "var(--bg-card)",
            }}
          >
            <div
              style={{
                height: 120,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "var(--bg-primary)",
              }}
            >
              {item.thumbnail ? (
                <img
                  src={item.thumbnail}
                  alt={item.caption || item.sopUid}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <ImageIcon size={36} style={{ color: "#94a3b8" }} />
              )}
            </div>
            <div style={{ padding: 10 }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--text-primary)",
                  marginBottom: 4,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={item.caption || t("reportKeyImages.noCaption")}
              >
                {item.caption || t("reportKeyImages.noCaption")}
              </div>
              <Space size={4} wrap style={{ marginBottom: 6 }}>
                <Tag color="blue">
                  {t("reportKeyImages.frame")}: {item.frame}
                </Tag>
              </Space>
              <UidCopyField
                label={t("reportKeyImages.sopUid")}
                value={item.sopUid}
              />
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  marginTop: 6,
                }}
              >
                <Popconfirm
                  title={t("reportKeyImages.deleteConfirm")}
                  onConfirm={() => void handleDelete(item.id)}
                  okText={t("common.confirm")}
                  cancelText={t("common.cancel")}
                >
                  <Button
                    size="small"
                    type="text"
                    danger
                    icon={<Trash2 size={12} />}
                  >
                    {t("common.delete")}
                  </Button>
                </Popconfirm>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }, [loading, error, items]);

  return (
    <div data-testid="report-key-images-panel">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: "var(--color-primary-800)",
          }}
        >
          {t("reportKeyImages.title")} ({items.length})
        </div>
        <Button
          size="small"
          type="primary"
          icon={<Plus size={12} />}
          onClick={openAdd}
        >
          {t("reportKeyImages.add")}
        </Button>
      </div>
      {content}
      <Modal
        title={t("reportKeyImages.addTitle")}
        open={showAdd}
        onCancel={() => setShowAdd(false)}
        onOk={() => void handleAdd()}
        confirmLoading={saving}
        okText={t("common.save")}
        cancelText={t("common.cancel")}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item name="studyUid" label={t("reportKeyImages.studyUid")}>
            <Input placeholder={t("reportKeyImages.studyUidPlaceholder")} />
          </Form.Item>
          <Form.Item name="seriesUid" label={t("reportKeyImages.seriesUid")}>
            <Input placeholder={t("reportKeyImages.seriesUidPlaceholder")} />
          </Form.Item>
          {seriesOptions.length > 0 && (
            <Form.Item label={t("reportKeyImages.pickSeries")}>
              <Select
                allowClear
                showSearch
                filterOption={(input, option) =>
                  String(option?.label ?? "")
                    .toLowerCase()
                    .includes(input.toLowerCase())
                }
                placeholder={t("reportKeyImages.pickSeriesPlaceholder")}
                options={seriesOptions}
                onChange={(value) => form.setFieldValue("seriesUid", value)}
                style={{ width: "100%" }}
              />
            </Form.Item>
          )}
          <Form.Item
            name="sopUid"
            label={t("reportKeyImages.sopUid")}
            rules={[
              {
                required: true,
                message: t("reportKeyImages.sopRequired"),
              },
            ]}
          >
            <Input placeholder={t("reportKeyImages.sopUidPlaceholder")} />
          </Form.Item>
          {instanceOptions.length > 0 && (
            <Form.Item label={t("reportKeyImages.pickInstance")}>
              <Select
                allowClear
                showSearch
                filterOption={(input, option) =>
                  String(option?.label ?? "")
                    .toLowerCase()
                    .includes(input.toLowerCase())
                }
                placeholder={t("reportKeyImages.pickInstancePlaceholder")}
                options={instanceOptions}
                onChange={(value) => form.setFieldValue("sopUid", value)}
                style={{ width: "100%" }}
              />
            </Form.Item>
          )}
          <Form.Item name="frame" label={t("reportKeyImages.frame")}>
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="label" label={t("reportKeyImages.caption")}>
            <Input placeholder={t("reportKeyImages.captionPlaceholder")} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default ReportKeyImagePanel;
