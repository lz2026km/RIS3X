import { usePagination } from "../../hooks/usePagination";
import { reportApi } from "../../services/api";
import { srDocumentApi } from "../../services/api/srReportApi";
import { SrConceptName, SrContentItem, SrDocument, SrSection } from '../../services/api/srReportApi'
import { EmptyState } from '../../components/common/EmptyState'
import {
  Card,
  Table,
  Tag,
  Space,
  Row,
  Col,
  Statistic,
  Button,
  Modal,
  Typography,
  Spin,
  Alert,
  Descriptions,
  Select,
  Radio,
  Input,
  Form,
  Empty,
  Divider,
  message,
} from "antd";
import {
  FileText,
  RefreshCw,
  Download,
  FileCheck2,
  Send,
  Database,
  ChevronRight,
  ClipboardPen,
} from "lucide-react";
import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Inbox } from 'lucide-react'
import { t } from "../../i18n/appI18n";

const { Text, Paragraph } = Typography;

const statusMeta: Record<string, { label: string; color: string }> = {
  draft: { label: t("srReport.statusDraft"), color: "orange" },
  finalized: { label: t("srReport.statusFinalized"), color: "green" },
  pushed: { label: t("srReport.statusPushed"), color: "purple" },
};

const valueTypeTag: Record<string, string> = {
  TEXT: "blue",
  CODE: "geekblue",
  NUM: "cyan",
  DATE: "gold",
  UIDREF: "volcano",
};

const SrReportPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<SrDocument[]>([]);
  const { pageData: docPageData, pagination: docPagination } = usePagination(documents, 10);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<SrDocument | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [pushingId, setPushingId] = useState("");
  const [finalizingId, setFinalizingId] = useState("");
  // [G005 Wave 8] SR → 报告回填: 测量摘要预览
  const [backfillOpen, setBackfillOpen] = useState(false);
  const [backfillLoading, setBackfillLoading] = useState(false);
  const [backfillData, setBackfillData] = useState<{
    srId: string;
    reportId: string;
    templateId: string;
    paragraph: string;
    measurements: Array<{ name: string; value: string; unit: string; source: string }>;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await srDocumentApi.listDocuments();
      if (res.success) {
        setDocuments(res.data ?? []);
      } else {
        setError(res.error?.message ?? t("srReport.loadFailed"));
        setDocuments([]);
      }
    } catch (e) {
      setError((e as Error)?.message ?? t("srReport.loadFailed"));
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // ?reportId=xxx → 自动打开生成弹窗并预选报告
  useEffect(() => {
    if (searchParams.get("reportId")) {
      setGenerateOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ───────────────────────── 操作 ─────────────────────────

  const openDetail = async (doc: SrDocument) => {
    setDetail(doc);
    setDetailLoading(true);
    try {
      const res = await srDocumentApi.getDocument(doc.id);
      if (res.success) setDetail(res.data);
    } finally {
      setDetailLoading(false);
    }
  };

  const finalize = async (r: SrDocument) => {
    setFinalizingId(r.id);
    try {
      const res = await srDocumentApi.finalizeDocument(r.id);
      if (res.success) {
        message.success(t("srReport.finalized"));
        void load();
        if (detail?.id === r.id) setDetail(res.data);
      } else {
        message.error(res.error?.message ?? t("srReport.finalizeFailed"));
      }
    } catch {
      message.error(t("srReport.finalizeFailed"));
    } finally {
      setFinalizingId("");
    }
  };

  const pushOru = async (r: SrDocument) => {
    setPushingId(r.id);
    try {
      const res = await srDocumentApi.pushOru(r.id);
      if (res.success) {
        message.success(
          res.data?.oru?.pushed
            ? t("w9d.srReport.oruPushed", { ack: res.data.oru.ackStatus })
            : t("w9d.srReport.oruArchived", { controlId: res.data?.oru.controlId ?? "-" }),
        );
        void load();
        if (detail?.id === r.id) setDetail(res.data?.document ?? null);
      } else {
        message.error(res.error?.message ?? t("srReport.oruFailed"));
      }
    } catch {
      message.error(t("srReport.oruFailed"));
    } finally {
      setPushingId("");
    }
  };

  const exportJson = (r: SrDocument) => {
    const blob = new Blob([JSON.stringify(r, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${r.sopInstanceUid || r.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
    message.success(`${t("srReport.exportedJson")} ${r.id}`);
  };

  const downloadDicom = async (r: SrDocument) => {
    const result = await srDocumentApi.downloadDocument(r.id);
    if (!result) {
      message.error(t("srReport.dicomDownloadFailed"));
      return;
    }
    const url = URL.createObjectURL(result.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = result.filename;
    a.click();
    URL.revokeObjectURL(url);
    message.success(`${t("srReport.downloadedDicom")} ${result.filename}`);
  };

  // ───────────────────────── [G005 Wave 8] SR → 报告回填 ─────────────────────────

  // 1) 调 /dicom-sr/to-report 解析 SR 测量值 → 预览摘要段落
  const openBackfillPreview = async (doc: SrDocument) => {
    setBackfillLoading(true);
    setBackfillData(null);
    setBackfillOpen(true);
    try {
      const res = await srDocumentApi.toReport(doc.id, doc.reportId);
      if (res.success) {
        setBackfillData(res.data);
      } else {
        message.error(res.error?.message ?? t("srReport.parseFailed"));
        setBackfillOpen(false);
      }
    } catch {
      message.error(t("srReport.parseNetworkFailed"));
      setBackfillOpen(false);
    } finally {
      setBackfillLoading(false);
    }
  };

  // 2) 确认回填: 复用 report-insert-html 通道 (ReportWritePage 监听) → 跳转书写页
  const confirmBackfill = () => {
    if (!backfillData) return;
    const esc = (v: unknown): string =>
      String(v ?? "").replace(/[<>&"']/g, (ch) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" })[ch] ?? ch);
    const html = [
      `<h3>${t("w9d.srReport.summaryTitle")}</h3>`,
      `<p>${t("w9d.srReport.sourceLabel")}: SR ${esc(backfillData.srId)} (${esc(backfillData.templateId)})</p>`,
      `<div>${backfillData.paragraph.split("\n").map((line) => `<p style="margin:2px 0">${esc(line)}</p>`).join("")}</div>`,
    ].join("\n");
    window.dispatchEvent(new CustomEvent("report-insert-html", { detail: { html } }));
    try { window.localStorage.setItem("ris_sr_backfill_pending", html) } catch { /* 忽略 */ }
    message.success(t("srReport.sentToEditor"));
    setBackfillOpen(false);
    navigate(`/reports/v3-write?reportId=${encodeURIComponent(backfillData.reportId)}`);
  };

  // ───────────────────────── 列表 ─────────────────────────

  const columns = [
    { title: t("srReport.colId"), dataIndex: "id", key: "id", width: 90 },
    { title: t("srReport.colPatient"), dataIndex: "patientName", key: "patientName", width: 100 },
    { title: t("srReport.colReportId"), dataIndex: "reportId", key: "reportId", width: 130 },
    {
      title: t("srReport.colTemplate"),
      dataIndex: "templateId",
      key: "templateId",
      width: 110,
      render: (v: string) => <Tag color={v === "tid1500" ? "cyan" : "blue"}>{v}</Tag>,
    },
    {
      title: t("srReport.colStatus"),
      dataIndex: "status",
      key: "status",
      width: 90,
      render: (v: string) => (
        <Tag color={statusMeta[v]?.color ?? "default"}>{statusMeta[v]?.label ?? v}</Tag>
      ),
    },
    {
      title: t("srReport.colSopUid"),
      dataIndex: "sopInstanceUid",
      key: "sop",
      ellipsis: true,
      render: (v: string) => (
        <Text style={{ fontSize: 11, fontFamily: "monospace" }}>{v}</Text>
      ),
    },
    {
      title: t("srReport.colCreatedAt"),
      dataIndex: "createdAt",
      key: "createdAt",
      width: 160,
      render: (v: string) => new Date(v).toLocaleString(),
    },
    {
      title: t("srReport.colActions"),
      key: "action",
      width: 320,
      render: (_: unknown, r: SrDocument) => (
        <Space size={4} wrap>
          <Button size="small" onClick={() => void openDetail(r)}>
            {t("srReport.view")}
          </Button>
          {r.status === "draft" && (
            <Button
              size="small"
              icon={<FileCheck2 size={14} />}
              loading={finalizingId === r.id}
              onClick={() => void finalize(r)}
            >
              {t("srReport.finalize")}
            </Button>
          )}
          <Button
            size="small"
            type="primary"
            ghost
            icon={<Send size={14} />}
            loading={pushingId === r.id}
            onClick={() => void pushOru(r)}
          >
            {t("srReport.oruPush")}
          </Button>
          <Button size="small" icon={<Download size={14} />} onClick={() => exportJson(r)}>
            JSON
          </Button>
          <Button
            size="small"
            icon={<Database size={14} />}
            onClick={() => void downloadDicom(r)}
          >
            DICOM
          </Button>
        </Space>
      ),
    },
  ];

  // ───────────────────────── 结构化树渲染 ─────────────────────────

  const renderConcept = (c: SrConceptName) => (
    <Text style={{ fontSize: 11, fontFamily: "monospace", color: "#64748b" }}>
      {c.scheme}:{c.code}
    </Text>
  );

  const renderItem = (item: SrContentItem, depth: number) => (
    <div key={`${item.conceptName.code}-${item.value}-${depth}`} style={{ marginLeft: depth * 18, marginBottom: 6 }}>
      <Space align="start" size={6}>
        <Tag color={valueTypeTag[item.valueType] ?? "default"} style={{ fontSize: 10, marginRight: 0 }}>
          {item.valueType}
        </Tag>
        <div>
          <Space size={6}>
            <Text style={{ fontSize: 13, fontWeight: 500 }}>{item.conceptName.meaning}</Text>
            {renderConcept(item.conceptName)}
            {item.relationshipType !== "CONTAINS" && (
              <Tag style={{ fontSize: 10 }}>{item.relationshipType}</Tag>
            )}
          </Space>
          {item.value && <div style={{ fontSize: 13, color: "var(--text-primary)" }}>{item.value}</div>}
          {item.valueType === "CODE" && item.code && (
            <div style={{ marginTop: 2 }}>
              <Tag color="geekblue" style={{ fontSize: 10 }}>
                {item.code.scheme}: {item.code.code} {item.code.meaning}
              </Tag>
            </div>
          )}
          {item.children?.map((c) => renderItem(c, depth + 1))}
        </div>
      </Space>
    </div>
  );

  const renderSection = (s: SrSection) => (
    <Card size="small" key={s.conceptName.code} title={s.title} style={{ marginBottom: 12 }}>
      <Space size={6} style={{ marginBottom: 8 }}>
        {renderConcept(s.conceptName)}
      </Space>
      {s.items.length > 0 ? (
        s.items.map((i) => renderItem(i, 0))
      ) : (
        <EmptyState description={t("srReport.noContent")} />
      )}
    </Card>
  );

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ marginBottom: 16 }} wrap>
        <FileText size={20} color="#2563eb" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>{t("srReport.title")}</span>
        <span style={{ fontSize: 12, color: "#94a3b8" }}>
          {t("srReport.subtitle")}
        </span>
        <Button
          size="small"
          icon={<RefreshCw size={14} />}
          onClick={() => void load()}
          loading={loading}
        >
          {t("srReport.refresh")}
        </Button>
        <Button size="small" type="primary" onClick={() => setGenerateOpen(true)}>
          {t("srReport.generateFromReport")}
        </Button>
      </Space>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic title={t("srReport.statDocs")} value={documents.length} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title={t("srReport.statFinalized")}
              value={documents.filter((d) => d.status === "finalized").length}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title={t("srReport.statPushed")}
              value={documents.filter((d) => d.status === "pushed").length}
            />
          </Card>
        </Col>
      </Row>
      {error && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          title={error}
          action={<Button size="small" onClick={() => void load()}><RefreshCw size={14} /> 
              {t("srReport.retry")}
            </Button>
          }
        />
      )}
      <Card>
        <Spin spinning={loading}>
          <Table
            rowKey="id"
            dataSource={docPageData}
            columns={columns}
            pagination={docPagination}
            size="small"
          scroll={{ x: 'max-content' }}
          />
        </Spin>
      </Card>

      {/* ─────────── 生成 SR 弹窗 ─────────── */}
      <GenerateSrModal
        open={generateOpen}
        onClose={() => {
          setGenerateOpen(false);
        }}
        presetReportId={searchParams.get("reportId") ?? undefined}
        onGenerated={(doc) => {
          setGenerateOpen(false);
          message.success(t("srReport.generated"));
          void load();
          void openDetail(doc);
        }}
      />

      {/* ─────────── 详情弹窗 ─────────── */}
      <Modal
        title={`${t("srReport.detailTitle")} - ${detail?.title ?? ""}`}
        open={detail != null}
        onCancel={() => setDetail(null)}
        footer={
          detail && (
            <Space>
              {detail.status === "draft" && (
                <Button
                  icon={<FileCheck2 size={14} />}
                  loading={finalizingId === detail.id}
                  onClick={() => void finalize(detail!)}
                >
                  {t("srReport.finalize")}
                </Button>
              )}
              {/* [G005 Wave 8] SR 测量值回填到报告 */}
              <Button
                icon={<ClipboardPen size={14} />}
                onClick={() => void openBackfillPreview(detail!)}
              >
                {t("srReport.backfillToReport")}
              </Button>
              <Button
                type="primary"
                icon={<Send size={14} />}
                loading={pushingId === detail.id}
                onClick={() => void pushOru(detail!)}
              >
                {t("srReport.oruPush")}
              </Button>
              <Button icon={<Download size={14} />} onClick={() => exportJson(detail!)}>
                {t("srReport.exportJson")}
              </Button>
              <Button icon={<Database size={14} />} onClick={() => void downloadDicom(detail!)}>
                {t("srReport.downloadDicom")}
              </Button>
            </Space>
          )
        }
        width={860}
      >
        <Spin spinning={detailLoading}>
          {detail && (
            <>
              <Descriptions
                column={2}
                bordered
                size="small"
                style={{ marginBottom: 16 }}
              >
                <Descriptions.Item label={t("srReport.colId")}>{detail.id}</Descriptions.Item>
                <Descriptions.Item label={t("srReport.colStatus")}>
                  <Tag color={statusMeta[detail.status]?.color ?? "default"}>
                    {statusMeta[detail.status]?.label ?? detail.status}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label={t("srReport.colPatient")}>
                  {detail.patientName} ({detail.patientId})
                </Descriptions.Item>
                <Descriptions.Item label={t("srReport.colReportId")}>
                  {detail.reportId}
                </Descriptions.Item>
                <Descriptions.Item label={t("srReport.colTemplate")}>
                  {detail.templateId} (TID {detail.tid})
                </Descriptions.Item>
                <Descriptions.Item label={t("srReport.modality")}>{detail.modality}</Descriptions.Item>
                <Descriptions.Item label={t("srReport.sopClassUid")} span={2}>
                  <Text style={{ fontSize: 11, fontFamily: "monospace" }}>
                    {detail.sopClassUid}
                  </Text>
                </Descriptions.Item>
                <Descriptions.Item label={t("srReport.studyUid")} span={2}>
                  <Text style={{ fontSize: 11, fontFamily: "monospace" }}>
                    {detail.studyInstanceUid}
                  </Text>
                </Descriptions.Item>
                {detail.hl7ControlId && (
                  <Descriptions.Item label={t("srReport.hl7ControlId")} span={2}>
                    <Text style={{ fontSize: 11, fontFamily: "monospace" }}>
                      {detail.hl7ControlId}
                    </Text>
                  </Descriptions.Item>
                )}
                {detail.pushedAt && (
                  <Descriptions.Item label={t("srReport.pushedAt")} span={2}>
                    {new Date(detail.pushedAt).toLocaleString()}
                  </Descriptions.Item>
                )}
              </Descriptions>

              <Divider titlePlacement="left" style={{ margin: "8px 0 16px" }}>
                {t("srReport.contentTree")} (TID {detail.tid})
              </Divider>
              <Card size="small" title={t("srReport.context")} style={{ marginBottom: 12 }}>
                <Descriptions column={3} size="small">
                  <Descriptions.Item label={t("srReport.colPatient")}>
                    {detail.content?.context?.patient?.name} (
                    {detail.content?.context?.patient?.id})
                  </Descriptions.Item>
                  <Descriptions.Item label={t("srReport.gender")}>
                    {detail.content?.context?.patient?.sex}
                  </Descriptions.Item>
                  <Descriptions.Item label={t("srReport.birthDate")}>
                    {detail.content?.context?.patient?.birthDate || "-"}
                  </Descriptions.Item>
                  <Descriptions.Item label={t("srReport.accessionNumber")}>
                    {detail.content?.context?.study?.accessionNumber || "-"}
                  </Descriptions.Item>
                  <Descriptions.Item label={t("srReport.studyDate")}>
                    {detail.content?.context?.study?.date || "-"}
                  </Descriptions.Item>
                  <Descriptions.Item label={t("srReport.reportAuthor")}>
                    {detail.content?.context?.report?.authorName || "-"}
                  </Descriptions.Item>
                </Descriptions>
              </Card>
              {detail.content?.sections?.length > 0 ? (
                detail.content.sections.map(renderSection)
              ) : (
                <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t("srReport.noSections")} />
              )}
              {detail.content?.codedEntries && detail.content.codedEntries.length > 0 && (
                <Card size="small" title={t("srReport.codedEntries")}>
                  <Space wrap>
                    {detail.content.codedEntries.map((c, i) => (
                      <Tag key={i} color="geekblue">
                        {c.scheme}:{c.code} {c.meaning}
                      </Tag>
                    ))}
                  </Space>
                </Card>
              )}
              {detail.hl7Message && (
                <>
                  <Divider titlePlacement="left" style={{ margin: "16px 0" }}>
                    {t("srReport.oruMessage")}
                  </Divider>
                  <pre
                    style={{
                      fontSize: 11,
                      fontFamily: "monospace",
                      background: "var(--bg-card)",
                      padding: 12,
                      borderRadius: 8,
                      maxHeight: 220,
                      overflow: "auto",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-all",
                    }}
                  >
                    {detail.hl7Message}
                  </pre>
                </>
              )}
              <Divider titlePlacement="left" style={{ margin: "16px 0" }}>
                {t("srReport.dicomText")}
              </Divider>
              <Paragraph
                style={{
                  fontSize: 11,
                  fontFamily: "monospace",
                  background: "var(--bg-card)",
                  padding: 12,
                  borderRadius: 8,
                  maxHeight: 260,
                  overflow: "auto",
                }}
              >
                {detail.rawContent}
              </Paragraph>
            </>
          )}
        </Spin>
      </Modal>

      {/* ─────────── [G005 Wave 8] SR 测量摘要回填预览 ─────────── */}
      <Modal
        title={t("srReport.backfillTitle")}
        open={backfillOpen}
        onCancel={() => setBackfillOpen(false)}
        footer={
          <Space>
            <Button onClick={() => setBackfillOpen(false)}>{t("srReport.cancel")}</Button>
            <Button
              type="primary"
              icon={<ClipboardPen size={14} />}
              disabled={!backfillData}
              onClick={confirmBackfill}
            >
              {t("srReport.insertAndJump")}
            </Button>
          </Space>
        }
        width={680}
      >
        <Spin spinning={backfillLoading}>
          {backfillData && (
            <>
              <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 10 }}>
                {t("srReport.backfillPrefix")} {backfillData.measurements.length} {t("srReport.backfillItems")} (SR {backfillData.srId} · {backfillData.templateId}){t("srReport.backfillSuffix")}
              </div>
              {backfillData.measurements.length > 0 && (
                <Table
                  size="small"
                  rowKey={(m, i) => `${m.name}-${m.value}-${i}`}
                  dataSource={backfillData.measurements}
                  columns={[
                    { title: t("srReport.measureName"), dataIndex: "name" },
                    { title: t("srReport.measureValue"), dataIndex: "value", width: 90 },
                    { title: t("srReport.measureUnit"), dataIndex: "unit", width: 90 },
                    { title: t("srReport.measureSource"), dataIndex: "source", width: 130, render: (v: string) => <Tag color={v === "measurement-group" ? "cyan" : v === "num-item" ? "blue" : "default"}>{v}</Tag> },
                  ]}
                  pagination={false}
                  style={{ marginBottom: 12 }}
                  scroll={{ x: "max-content" }}
                />
              )}
              <div style={{ fontSize: 13, color: "#334155", lineHeight: 1.8, background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 8, padding: "12px 14px", whiteSpace: "pre-wrap" }}>
                {backfillData.paragraph}
              </div>
            </>
          )}
        </Spin>
      </Modal>
    </div>
  );
};

// ───────────────────────── 生成 SR 弹窗组件 ─────────────────────────

const GenerateSrModal: React.FC<{
  open: boolean;
  onClose: () => void;
  presetReportId?: string;
  onGenerated: (doc: SrDocument) => void;
}> = ({ open, onClose, presetReportId, onGenerated }) => {
  const [form] = Form.useForm();
  const [reports, setReports] = useState<
    { id: string; patientName: string; findings: string; impression: string }[]
  >([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [loadError, setLoadError] = useState("");

  const loadReports = useCallback(async () => {
    setReportsLoading(true);
    setLoadError("");
    try {
      const res = await reportApi.list({ pageSize: 100 } as never);
      const items = (Array.isArray(res.data) ? res.data : [])
        .filter((r) => r && typeof r === "object" && "id" in r)
        .map((r) => ({
          id: String((r as { id: string }).id),
          patientName: String((r as { patientName?: string }).patientName ?? ""),
          findings: String((r as { findings?: string }).findings ?? ""),
          impression: String(
            (r as { impression?: string }).impression ??
              (r as { conclusion?: string }).conclusion ??
              "",
          ),
        }));
      setReports(items);
      if (items.length === 0) setLoadError(t("srReport.noReports"));
    } catch {
      setLoadError(t("srReport.reportsLoadFailed"));
    } finally {
      setReportsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      form.setFieldsValue({
        templateId: "tid1500",
        reportId: presetReportId,
      });
      void loadReports();
    }
  }, [open, presetReportId, form, loadReports]);

  const onSubmit = async () => {
    const values = await form.validateFields();
    setGenerating(true);
    try {
      const res = await srDocumentApi.generateByReport({
        reportId: values.reportId,
        templateId: values.templateId,
        findings: values.findings || undefined,
        impression: values.impression || undefined,
      });
      if (res.success) {
        onGenerated(res.data);
      } else {
        message.error(res.error?.message ?? t("srReport.generateFailed"));
      }
    } catch {
      message.error(t("srReport.generateFailed"));
    } finally {
      setGenerating(false);
    }
  };

  const watchedReportId = Form.useWatch("reportId", form);
  const selectedReport = reports.find((r) => r.id === watchedReportId);

  return (
    <Modal
      title={t("srReport.generateTitle")}
      open={open}
      onCancel={onClose}
      onOk={() => void onSubmit()}
      okText={t("srReport.generateOk")}
      confirmLoading={generating}
      width={640}
    >
      {loadError && !reportsLoading && (
        <Alert type="warning" showIcon style={{ marginBottom: 12 }} title={loadError} />
      )}
      <Form form={form} layout="vertical">
        <Form.Item
          label={t("srReport.selectReport")}
          name="reportId"
          rules={[{ required: true, message: t("srReport.selectReportRequired") }]}
        >
          <Select
            loading={reportsLoading}
            placeholder={t("srReport.selectReportPlaceholder")}
            showSearch
            optionFilterProp="label"
            options={reports.map((r) => ({
              value: r.id,
              label: `${r.patientName} / ${r.id}`,
            }))}
          />
        </Form.Item>
        {selectedReport && (
          <Card size="small" style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>
              {selectedReport.patientName} - {t("srReport.findingsLabel")} {selectedReport.findings || t("srReport.emptyPlaceholder")}
            </div>
            <div style={{ fontSize: 12, color: "#64748b" }}>
              {t("srReport.impressionLabel")} {selectedReport.impression || t("srReport.emptyPlaceholder")}
            </div>
          </Card>
        )}
        <Form.Item label={t("srReport.srTemplate")} name="templateId" initialValue="tid1500">
          <Radio.Group>
            <Radio value="tid1500">{t("srReport.tid1500")}</Radio>
            <Radio value="tid2000">{t("srReport.tid2000")}</Radio>
          </Radio.Group>
        </Form.Item>
        <Form.Item label={t("srReport.findingsOverride")} name="findings">
          <Input.TextArea rows={2} placeholder={t("srReport.findingsOverridePlaceholder")} />
        </Form.Item>
        <Form.Item label={t("srReport.impressionOverride")} name="impression">
          <Input.TextArea rows={2} placeholder={t("srReport.impressionOverridePlaceholder")} />
        </Form.Item>
      </Form>
      <div style={{ fontSize: 12, color: "#94a3b8", display: "flex", alignItems: "center", gap: 4 }}>
        <ChevronRight size={12} /> {t("srReport.generateHint")}
      </div>
    </Modal>
  );
};

export default SrReportPage;
