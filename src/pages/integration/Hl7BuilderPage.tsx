import React, { useState, useEffect, useCallback } from "react";
import {
  Card, Space, Tag, Button, Tabs, Form, Input, Select, DatePicker, Table, Alert, message,
} from "antd";
import { Code, Eye, Send, Hammer, FileText, History, RefreshCw } from "lucide-react";
import { hl7Api } from "../../services/api/integrationApi";
import { hl7Api as rawHl7Api } from "../../services/api/hl7Api";
import type { Hl7Report, Hl7ArchiveRecord } from "../../services/api/integrationApi";
import { usePagination } from "../../hooks/usePagination";
import { t } from "../../i18n/appI18n";

const { RangePicker } = DatePicker;

interface BuilderForm {
  patientId: string;
  examId: string;
  reportFinding: string;
  reportImpression: string;
  accessionNumber: string;
  procedureCode: string;
  patientName: string;
  patientSex: string;
  modality: string;
  doctorId: string;
  doctorName: string;
  department: string;
  scheduleRange: [unknown, unknown] | null;
  note: string;
}

const defaultForm: BuilderForm = {
  patientId: "",
  examId: "",
  reportFinding: "",
  reportImpression: "",
  accessionNumber: "",
  procedureCode: "",
  patientName: "",
  patientSex: "M",
  modality: "CT",
  doctorId: "",
  doctorName: "",
  department: "",
  scheduleRange: null,
  note: "",
};

const messageTypes = [
  { key: "ORU^R01", label: "ORU^R01" },
  { key: "ORM^O01", label: "ORM^O01" },
  { key: "DFT^P03", label: "DFT^P03" },
  { key: "SIU^S12", label: "SIU^S12" },
];

export const Hl7BuilderPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState("ORU^R01");
  const [form] = Form.useForm<BuilderForm>();
  const [preview, setPreview] = useState<string | null>(null);
  const [previewMeta, setPreviewMeta] = useState<{ controlId: string; messageType: string; bytes: number } | null>(null);
  const [loading, setLoading] = useState({ preview: false, send: false });
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<Hl7ArchiveRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  // [W1-B] 直发端点: 批量 ORU (POST /hl7/batch) / 推送 ORU (POST /hl7/push-oru)
  const [batchSending, setBatchSending] = useState(false);
  const [pushSending, setPushSending] = useState(false);
  // [W3-C] 受控分页: 发送历史表
  const historyPagination = usePagination(history, 8);

  const getValues = useCallback((): BuilderForm => {
    const v = form.getFieldsValue();
    return { ...defaultForm, ...v };
  }, [form]);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await hl7Api.getArchive({ direction: "OUTBOUND" });
      if (res.success) {
        setHistory(Array.isArray(res.data) ? res.data : []);
      } else {
        setError(res.error?.message ?? t('hl7Builder.loadHistoryFailed'));
      }
    } catch {
      setError(t('hl7Builder.loadHistoryFailed'));
    }
    setHistoryLoading(false);
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const buildPayload = (values: BuilderForm) => {
    const base: Hl7Report = {
      accessionNumber: values.accessionNumber,
      patientName: values.patientName,
      patientId: values.patientId,
      patientSex: (values.patientSex as Hl7Report["patientSex"]) ?? "O",
      modality: values.modality || "CT",
      studyDate: "",
      studyTime: "",
      findings: values.reportFinding,
      conclusion: values.reportImpression,
      authorName: values.doctorName,
      authorId: values.doctorId,
      reportId: values.examId,
    };
    return base;
  };

  const handlePreview = async () => {
    setLoading((p) => ({ ...p, preview: true }));
    setPreview(null);
    setPreviewMeta(null);
    setError(null);
    try {
      const values = getValues();
      let res;
      if (activeTab === "ORM^O01") {
        res = await hl7Api.buildOrm({
          ...buildPayload(values),
          patientId: values.patientId,
          patientName: values.patientName,
          patientSex: (values.patientSex as Hl7Report["patientSex"]) ?? "O",
          accessionNumber: values.accessionNumber,
          modality: values.modality || "CT",
          bodyPart: values.procedureCode,
          orderNumber: values.examId,
          orderingDoctor: values.doctorName,
        });
      } else if (activeTab === "DFT^P03") {
        res = await hl7Api.buildDft({
          patientId: values.patientId,
          patientName: values.patientName,
          patientSex: (values.patientSex as Hl7Report["patientSex"]) ?? "O",
          invoiceNumber: values.accessionNumber,
          totalAmount: "0",
          chargeCode: values.procedureCode,
          chargeName: values.reportFinding,
        });
      } else if (activeTab === "SIU^S12") {
        res = await rawHl7Api.siu({
          patientId: values.patientId,
          patientName: values.patientName,
          patientSex: values.patientSex || "M",
          doctorId: values.doctorId,
          doctorName: values.doctorName,
          department: values.department,
          startDateTime: (values.scheduleRange as any)?.[0]?.format("YYYY-MM-DDTHH:mm:ss") ?? "",
          endDateTime: (values.scheduleRange as any)?.[1]?.format("YYYY-MM-DDTHH:mm:ss") ?? "",
          note: values.note,
        });
      } else {
        res = await hl7Api.buildOru(buildPayload(values));
      }
      if (res.success && res.data) {
        const d = res.data as { message?: string; controlId?: string; messageType?: string; bytes?: number };
        if (d.message) {
          setPreview(d.message);
          setPreviewMeta({ controlId: d.controlId ?? "", messageType: d.messageType ?? activeTab, bytes: d.bytes ?? d.message.length });
        } else {
          setError(t('hl7Builder.missingMessage'));
        }
      } else {
        setError(res.error?.message ?? t('hl7Builder.previewFailed'));
      }
    } catch {
      setError(t('hl7Builder.previewRequestFailed'));
    }
    setLoading((p) => ({ ...p, preview: false }));
  };

  const handleSend = async () => {
    setLoading((p) => ({ ...p, send: true }));
    setError(null);
    try {
      const values = getValues();
      let res;
      if (activeTab === "SIU^S12") {
        res = await rawHl7Api.siu({
          patientId: values.patientId,
          patientName: values.patientName,
          patientSex: values.patientSex || "M",
          doctorId: values.doctorId,
          doctorName: values.doctorName,
          department: values.department,
          startDateTime: (values.scheduleRange as any)?.[0]?.format("YYYY-MM-DDTHH:mm:ss") ?? "",
          endDateTime: (values.scheduleRange as any)?.[1]?.format("YYYY-MM-DDTHH:mm:ss") ?? "",
          note: values.note,
        });
      } else {
        const base = buildPayload(values);
        if (activeTab === "ORM^O01") {
          res = await hl7Api.buildOrm({
            patientId: base.patientId,
            patientName: base.patientName,
            patientSex: base.patientSex,
            accessionNumber: base.accessionNumber,
            modality: base.modality,
            bodyPart: values.procedureCode,
            orderNumber: values.examId,
            orderingDoctor: values.doctorName,
          });
        } else if (activeTab === "DFT^P03") {
          res = await hl7Api.buildDft({
            patientId: base.patientId,
            patientName: base.patientName,
            patientSex: base.patientSex,
            invoiceNumber: base.accessionNumber,
            totalAmount: "0",
            chargeCode: values.procedureCode,
            chargeName: values.reportFinding,
          });
        } else {
          res = await hl7Api.buildOru(base);
        }
      }
      if (res.success) {
        const d = res.data as { message?: string; controlId?: string } | undefined;
        if (d?.message) setPreview(d.message);
        message.success(t('w9e.hl7Builder.sentWithControl', { id: d?.controlId ?? "-" }));
        fetchHistory();
      } else {
        setError(res.error?.message ?? t('hl7Builder.sendFailed'));
      }
    } catch {
      setError(t('hl7Builder.sendRequestFailed'));
    }
    setLoading((p) => ({ ...p, send: false }));
  };

  const historyColumns = [
    { title: t('hl7Builder.colType'), dataIndex: "messageType", key: "messageType", width: 110, render: (v: string) => <Tag color="purple">{v}</Tag> },
    { title: t('hl7Builder.colControlId'), dataIndex: "controlId", key: "controlId", ellipsis: true },
    {
      title: "ACK",
      dataIndex: "ackStatus",
      key: "ackStatus",
      width: 100,
      render: (v: string) => {
        const map: Record<string, string> = { SUCCESS: "green", FAILED: "red", PENDING: "orange" };
        return <Tag color={map[v] || "default"}>{v}</Tag>;
      },
    },
    { title: t('hl7Builder.colRetry'), dataIndex: "retryCount", key: "retryCount", width: 60 },
    { title: t('hl7Builder.colTime'), dataIndex: "createdAt", key: "createdAt", width: 180, render: (v: string) => new Date(v).toLocaleString() },
  ];

  const isSiu = activeTab === "SIU^S12";

  // [W1-B] 批量发送 ORU: POST /hl7/batch (hl7Api.buildBatch)
  const handleBatchSend = async () => {
    setBatchSending(true);
    setError(null);
    try {
      const base = buildPayload(getValues());
      const reports: Hl7Report[] = [base, { ...base, accessionNumber: `${base.accessionNumber}-B`, reportId: `${base.reportId}-B` }];
      const res = await hl7Api.buildBatch(reports);
      if (res.success) {
        message.success(t('w9e.hl7Builder.batchSent', { count: res.data?.count ?? reports.length }));
        fetchHistory();
      } else {
        setError(res.error?.message ?? t('hl7Builder.batchFailed'));
      }
    } catch {
      setError(t('hl7Builder.batchRequestFailed'));
    }
    setBatchSending(false);
  };

  // [W1-B] 推送 ORU: POST /hl7/push-oru (hl7Api.pushOru)
  const handlePushOru = async () => {
    setPushSending(true);
    setError(null);
    try {
      const values = getValues();
      if (!values.examId.trim()) {
        setError(t('hl7Builder.examIdRequired'));
        return;
      }
      const res = await hl7Api.pushOru(values.examId.trim(), values.examId.trim());
      if (res.success) {
        message.success(t('w9e.hl7Builder.oruPushed'));
        fetchHistory();
      } else {
        setError(res.error?.message ?? t('hl7Builder.pushFailed'));
      }
    } catch {
      setError(t('hl7Builder.pushRequestFailed'));
    }
    setPushSending(false);
  };

  return (
    <div className="p-4 space-y-3">
      <Card size="small" className="shadow-sm">
        <div className="flex items-center justify-between">
          <Space>
            <Hammer className="w-5 h-5 text-amber-600" />
            <div>
              <div className="text-base font-semibold">{t('hl7Builder.title')}</div>
              <div className="text-xs text-slate-500">{t('hl7Builder.subtitle')}</div>
            </div>
          </Space>
          <Tag color="amber">{t('hl7Builder.builderTag')}</Tag>
        </div>
      </Card>

      {error && (
        <Alert type="error" showIcon message={error} closable onClose={() => setError(null)} />
      )}

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={messageTypes.map((mt) => ({
          key: mt.key,
          label: <Space size={4}><FileText className="w-3 h-3" />{mt.label}</Space>,
          children: (
            <div className="space-y-3">
              <Card size="small" className="shadow-sm" title={<Space><Code className="w-4 h-4" /><span>{t('hl7Builder.form')}</span></Space>}>
                <Form form={form} layout="vertical" size="small" initialValues={defaultForm}>
                  <div className="grid grid-cols-3 gap-4">
                    <Form.Item label={t('hl7Builder.patientId')} name="patientId">
                      <Input placeholder="P00123456" />
                    </Form.Item>
                    <Form.Item label={t('hl7Builder.patientName')} name="patientName">
                      <Input placeholder={t('hl7Builder.patientNamePlaceholder')} />
                    </Form.Item>
                    <Form.Item label={t('hl7Builder.sex')} name="patientSex">
                      <Select options={[{ value: "M", label: "M" }, { value: "F", label: "F" }, { value: "O", label: "O" }]} />
                    </Form.Item>
                    <Form.Item label={t('hl7Builder.examId')} name="examId">
                      <Input placeholder="E2026001" />
                    </Form.Item>
                    <Form.Item label={t('hl7Builder.accessionNumber')} name="accessionNumber">
                      <Input placeholder="ACC20260001" />
                    </Form.Item>
                    <Form.Item label={t('hl7Builder.procedureCode')} name="procedureCode">
                      <Input placeholder={isSiu ? "CTCHEST" : "CTCHEST"} />
                    </Form.Item>
                    {!isSiu && (
                      <Form.Item label={t('hl7Builder.modality')} name="modality">
                        <Select options={[{ value: "CT", label: "CT" }, { value: "MR", label: "MR" }, { value: "US", label: "US" }, { value: "XA", label: "XA" }, { value: "DX", label: "DX" }]} />
                      </Form.Item>
                    )}
                    <Form.Item label={t('hl7Builder.doctorId')} name="doctorId">
                      <Input placeholder="D001" />
                    </Form.Item>
                    <Form.Item label={t('hl7Builder.doctorName')} name="doctorName">
                      <Input placeholder={t('hl7Builder.doctorNamePlaceholder')} />
                    </Form.Item>
                    {isSiu && (
                      <>
                        <Form.Item label={t('hl7Builder.department')} name="department">
                          <Input placeholder={t('hl7Builder.departmentPlaceholder')} />
                        </Form.Item>
                        <Form.Item label={t('hl7Builder.scheduleTime')} name="scheduleRange">
                          <RangePicker showTime style={{ width: "100%" }} />
                        </Form.Item>
                        <Form.Item label={t('hl7Builder.note')} name="note">
                          <Input placeholder={t('hl7Builder.notePlaceholder')} />
                        </Form.Item>
                      </>
                    )}
                  </div>
                  {!isSiu && (
                    <>
                      <Form.Item label={t('hl7Builder.reportFinding')} name="reportFinding">
                        <Input.TextArea rows={3} placeholder={t('hl7Builder.findingPlaceholder')} />
                      </Form.Item>
                      <Form.Item label={t('hl7Builder.reportImpression')} name="reportImpression">
                        <Input.TextArea rows={2} placeholder={t('hl7Builder.impressionPlaceholder')} />
                      </Form.Item>
                    </>
                  )}
                </Form>
              </Card>

              <div className="flex gap-2">
                <Button
                  type="primary"
                  icon={<Eye className="w-3 h-3" />}
                  onClick={handlePreview}
                  loading={loading.preview}
                >
                  {t('hl7Builder.generatePreview')}
                </Button>
                <Button
                  icon={<Send className="w-3 h-3" />}
                  onClick={handleSend}
                  loading={loading.send}
                >
                  {t('hl7Builder.sendToRemote')}
                </Button>
                {activeTab === "ORU^R01" && (
                  <>
                    <Button
                      icon={<Send className="w-3 h-3" />}
                      onClick={handleBatchSend}
                      loading={batchSending}
                    >
                      {t('hl7Builder.batchOru')}
                    </Button>
                    <Button
                      icon={<Send className="w-3 h-3" />}
                      onClick={handlePushOru}
                      loading={pushSending}
                    >
                      {t('hl7Builder.pushOru')}
                    </Button>
                  </>
                )}
              </div>

              {preview && (
                <Card
                  size="small"
                  className="shadow-sm"
                  title={<Space><Code className="w-4 h-4" /><span>{t('hl7Builder.rawMessage')}</span><Tag>{previewMeta?.messageType}</Tag><span className="text-xs text-slate-400">{previewMeta?.controlId} · {previewMeta?.bytes} bytes</span></Space>}
                >
                  <pre className="bg-slate-900 text-slate-100 p-3 rounded text-xs font-mono overflow-auto max-h-80 whitespace-pre-wrap">
                    {preview}
                  </pre>
                </Card>
              )}
            </div>
          ),
        }))}
      />

      <Card
        size="small"
        className="shadow-sm"
        title={<Space><History className="w-4 h-4" /><span>{t('hl7Builder.sendHistory')}</span></Space>}
        extra={<Button size="small" icon={<RefreshCw className="w-3 h-3" />} onClick={fetchHistory}>{t('hl7Builder.refresh')}</Button>}
      >
        <Table
          rowKey="id"
          size="small"
          loading={historyLoading}
          dataSource={historyPagination.pageData}
          columns={historyColumns}
          pagination={historyPagination.pagination}
          expandable={{
            expandedRowRender: (r: Hl7ArchiveRecord) => (
              <pre className="bg-slate-50 p-2 rounded text-xs font-mono overflow-auto whitespace-pre-wrap">{r.rawMessage}</pre>
            ),
          }}
        scroll={{ x: 'max-content' }}
        />
      </Card>
    </div>
  );
};

export default Hl7BuilderPage;
