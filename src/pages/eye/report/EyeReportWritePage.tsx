import React, { useState, useEffect } from "react";
import { Card, Row, Col, Tag, Select, Button, Input, Space, Badge, Collapse, message, Radio, Alert, Spin } from 'antd';
import { FileText, Save, Send, Printer, Mic, Brain, Stamp, AlertTriangle } from 'lucide-react';
import EyeLateralityBadge from "@/components/eye/EyeLateralityBadge";
import ReportTemplateSelector from "@/components/eye/ReportTemplateSelector";
import FindingLibraryPicker from "@/components/eye/FindingLibraryPicker";
import GradingScalePicker from "@/components/eye/GradingScalePicker";
import ReportDraftPanel from "@/components/eye/ReportDraftPanel";
import { eyeApi } from "../../../services/api/eyeApi";
import type { OphthalmologyReport, ReportTemplate, FindingLibraryItem, ReportAuditEntry } from '../../../types/eye';
import { AppModal } from "@/components/common/AppModal";
import { ErrorBanner } from "@/components/feedback";
import { t } from "../../../i18n/appI18n";
const MODALITY_LABELS: Record<string, string> = { fundus_photo: '眼底彩照', oct: 'OCT', ffa: 'FFA', icga: 'ICGA', visual_field: '视野', topography: '角膜地形图', pentacam: 'Pentacam', iol_master: 'IOL Master', ubm: 'UBM', slit_lamp: '裂隙灯', oct_a: 'OCTA', corneal_endothelium: '角膜内皮', tear_film: '泪膜', fundus_autofluorescence: '眼底自发荧光' };

const reportStatusColors: Record<string, string> = {
  draft: "default",
  pending_review: "orange",
  reviewing: "processing",
  published: "green",
  amended: "blue",
  printed: "purple",
  critical_value: "red",
};
const reportStatusLabels: Record<string, string> = {
  draft: "草稿",
  pending_review: "待审核",
  reviewing: "审核中",
  published: "已发布",
  amended: "已修改",
  printed: "已打印",
  critical_value: "危急值",
  oct_a: "OCTA",
  corneal_endothelium: "角膜内皮",
  tear_film: "泪膜",
  fundus_autofluorescence: "眼底自发荧光",
  borderline: "临界",
  cup_to_disc_ratio: "杯盘比",
  rim_width: "视盘缘宽度",
  arteriovenous_ratio: "动静脉比",
  abnormal: "异常",
  v6: "v6",
  text: "文本",
  findings_multi: "多发发现",
  images: "图像",
  productivity: "生产力",
  clinical: "临床",
  operational: "运营",
  financial: "财务",
};
const SEGMENT_TYPE_LABELS_DICT: Record<string, string> = {
  v6: 'V6 模板', text: '文本', findings_multi: '多发现', images: '图像',
  grading_scale: '分级标度', diagnosis: '诊断', measurement: '量测',
};

interface ReportEditorProps {
  report: OphthalmologyReport;
  templates: ReportTemplate[];
  findingsLibrary: FindingLibraryItem[];
  auditEntries: ReportAuditEntry[];
}
const ReportEditor: React.FC<ReportEditorProps> = ({ report, templates, findingsLibrary, auditEntries }) => {
  const [templateId, setTemplateId] = useState(report.templateId);
  const [findings, setFindings] = useState<string[]>(report.findings);
  const [impression, setImpression] = useState(report.impression);
  const [recommendations, setRecommendations] = useState(
    report.recommendations,
  );
  const [status, setStatus] = useState(report.status);
  const [showAiDialog, setShowAiDialog] = useState(false);
  const [showVoiceDialog, setShowVoiceDialog] = useState(false);
  const [printModal, setPrintModal] = useState(false);
  const [signModal, setSignModal] = useState(false);
  const [currentContent, setCurrentContent] = useState(
    report.sections.map((s) => s.content).join("\n\n"),
  );
  const [editing, setEditing] = useState("");
  const [savingDraft, setSavingDraft] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);

  const handleSaveDraft = async () => {
    setSavingDraft(true);
    try {
      const res = await eyeApi.createDraft({
        reportId: report.id,
        content: currentContent || editing,
        findings,
        impression,
        recommendations,
        status: 'draft',
      });
      if (res.success) {
        message.success(t('eyeReport.draftSaved'));
      } else {
        message.warning(res.error?.message ?? t('eyeReport.draftApiUnavailable'));
      }
    } catch {
      message.warning(t('eyeReport.draftApiUnavailable'));
    } finally {
      setSavingDraft(false);
    }
  };

  const handleSubmitReview = async () => {
    setSubmittingReview(true);
    try {
      const res = await eyeApi.submitReport(report.id);
      if (res.success) {
        message.success(t('eyeReport.submittedReview'));
        setStatus('pending_review');
      } else {
        message.warning(res.error?.message ?? t('eyeReport.submitApiUnavailable'));
        setStatus('pending_review');
      }
    } catch {
      setStatus('pending_review');
      message.success(t('eyeReport.submittedReviewLocal'));
    } finally {
      setSubmittingReview(false);
    }
  };

  const template = templates.find((tpl) => tpl.id === templateId);
  const findingsData = findingsLibrary.filter((f) =>
    findings.includes(f.id),
  );auditEntries.filter(
    (a) => a.reportId === report.id,
  );

  return (
    <>
      {/* [v3.0.6.8-86] 标题和报告选择已上移至父组件, 此处仅保留状态/操作按钮 */}
      <div
        style={{
          padding: 16,
          background: "var(--bg-card)",
          minHeight: "calc(100vh - 56px)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 12,
            flexWrap: "wrap",
          }}
        >
        <Tag color={reportStatusColors[status]}>
          {reportStatusLabels[status]}
        </Tag>
        <Tag color="blue">v{report.version}</Tag>
        <EyeLateralityBadge eyeSide={report.eyeSide as any} size="small" />
        <div style={{ flex: 1 }} />
        <Button
          size="small"
          icon={<Mic size={14} />}
          onClick={() => setShowVoiceDialog(!showVoiceDialog)}
          type={showVoiceDialog ? "primary" : "default"}
        >
          {t('eyeReport.voice')}
        </Button>
        <Button
          size="small"
          icon={<Brain size={14} />}
          onClick={() => setShowAiDialog(!showAiDialog)}
          type={showAiDialog ? "primary" : "default"}
        >
          {t('eyeReport.aiContinue')}
        </Button>
        <Button size="small" icon={<Save size={14} />} loading={savingDraft} onClick={() => void handleSaveDraft()}>
          {t('eyeReport.saveDraft')}
        </Button>
        <Button size="small" type="primary" icon={<Send size={14} />} loading={submittingReview} onClick={() => void handleSubmitReview()}>
          {t('eyeReport.submitReview')}
        </Button>
        <Button
          size="small"
          icon={<Stamp size={14} />}
          onClick={() => setSignModal(!signModal)}
        >
          {t('eyeReport.digitalSign')}
        </Button>
        <Button
          size="small"
          icon={<Printer size={14} />}
          onClick={() => setPrintModal(!printModal)}
        >
          {t('eyeReport.print')}
        </Button>
      </div>

      {/* 语音 / AI / 签名 / 打印 弹窗 */}
      <AppModal
        open={showVoiceDialog}
        onClose={() => setShowVoiceDialog(false)}
        title={t('eyeReport.voiceInputTitle')}
        icon={<Mic size={18} />}
        iconBg="var(--color-info-bg)"
        iconColor="#1e40af"
        size="sm"
      >
        <div style={{ fontSize: 13, color: "var(--text-primary)" }}>
          {t('eyeReport.voiceHint')}
        </div>
        <div
          style={{
            marginTop: 12,
            padding: 12,
            background: "var(--bg-card)",
            borderRadius: 6,
            border: "1px dashed var(--border-color)",
            fontSize: 12,
            color: "var(--text-secondary)",
            textAlign: "center",
          }}
        >
          {t('eyeReport.waitingVoice')}
        </div>
      </AppModal>
      <AppModal
        open={showAiDialog}
        onClose={() => setShowAiDialog(false)}
        title={t('eyeReport.aiTitle')}
        icon={<Brain size={18} />}
        iconBg="var(--color-warning-bg)"
        iconColor="#b45309"
        size="md"
        footer={
          <>
            <Tag>{t('eyeReport.tagIgnore')}</Tag>
            <Tag color="orange">{t('eyeReport.tagModify')}</Tag>
            <button
              onClick={() => setShowAiDialog(false)}
              style={{
                padding: "6px 14px",
                border: "none",
                background: "#3b82f6",
                color: "#fff",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {t('eyeReport.adoptAndClose')}
            </button>
          </>
        }
      >
        <div style={{ fontSize: 13, color: "var(--text-primary)" }}>
          {t('eyeReport.aiBasedOn')}
        </div>
        <ul
          style={{
            marginTop: 8,
            paddingLeft: 18,
            fontSize: 12,
            color: "var(--text-secondary)",
            lineHeight: 1.8,
          }}
        >
          <li>{t('eyeReport.aiItem1')}</li>
          <li>{t('eyeReport.aiItem2')}</li>
          <li>{t('eyeReport.aiItem3')}</li>
        </ul>
      </AppModal>
      <AppModal
        open={signModal}
        onClose={() => setSignModal(false)}
        title={t('eyeReport.signTitle')}
        icon={<Stamp size={18} />}
        iconBg="var(--color-success-bg)"
        iconColor="#15803d"
        size="sm"
        footer={
          <button
            onClick={() => setSignModal(false)}
            style={{
              padding: "6px 14px",
              border: "none",
              background: "#3b82f6",
              color: "#fff",
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {t('eyeReport.confirmSign')}
          </button>
        }
      >
        <div style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.8 }}>
          <div>
            <strong>{t('eyeReport.signDoctor')}</strong> {t('eyeReport.signDoctorName')}
          </div>
          <div>
            <strong>{t('eyeReport.signMethod')}</strong> <Tag color="green">{t('eyeReport.caCert')}</Tag>{" "}
            <Tag color="blue">{t('eyeReport.handwritingPad')}</Tag>
          </div>
          <div>
            <strong>{t('eyeReport.signTime')}</strong> 2026-06-20 16:50
          </div>
        </div>
      </AppModal>
      <AppModal
        open={printModal}
        onClose={() => setPrintModal(false)}
        title={t('eyeReport.printTitle')}
        icon={<Printer size={18} />}
        iconBg="var(--color-info-bg)"
        iconColor="#1e40af"
        size="sm"
        footer={
          <>
            <Tag color="orange">{t('eyeReport.cancel')}</Tag>
            <button
              onClick={() => setPrintModal(false)}
              style={{
                padding: "6px 14px",
                border: "1px solid var(--border-color)",
                background: "var(--bg-card)",
                color: "var(--text-secondary)",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {t('eyeReport.preview')}
            </button>
            <button
              onClick={() => setPrintModal(false)}
              style={{
                padding: "6px 14px",
                border: "none",
                background: "#3b82f6",
                color: "#fff",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {t('eyeReport.print')}
            </button>
          </>
        }
      >
        <div style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.8 }}>
          <div>
            <strong>{t('eyeReport.printer')}</strong> DryView 8700
          </div>
          <div>
            <strong>{t('eyeReport.film')}</strong> 4 张
          </div>
          <div>
            <strong>{t('eyeReport.reportCopies')}</strong> 2 份
          </div>
        </div>
      </AppModal>

      <Row gutter={12}>
        {/* 主编辑区 */}
        <Col span={16}>
          {/* 模板选择 */}
          <Card size="small" style={{ marginBottom: 8 }}>
            <ReportTemplateSelector
              value={templateId}
              onChange={setTemplateId}
            />
            {template && (
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                {t('eyeReport.segments', { count: template.sections.length })} ·{" "}
                {t('eyeReport.requiredCount', { count: template.sections.filter((s) => s.required).length })} · {t('eyeReport.version')}{" "}
                {template.version}
              </div>
            )}
          </Card>

          {/* 6 段所见编辑 */}
          <Collapse
            defaultActiveKey={template?.sections.map((s) => s.key) || []}
            size="small"
            items={
              (template?.sections || []).map((s) => ({
                key: s.key,
                label: (
                  <Space size={4}>
                    {s.required && <Badge status="error" />}
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: s.required ? 600 : 400,
                      }}
                    >
                      {s.title}
                    </span>
                    <Tag style={{ fontSize: 12 }}>{SEGMENT_TYPE_LABELS_DICT[s.type] || s.type}</Tag>
                  </Space>
                ),
                children: (
                  <div>
                    {s.type === "text" && (
                      <Input.TextArea
                        rows={3}
                        value={
                          editing ||
                          report.sections.find((rs) => rs.key === s.key)
                            ?.content ||
                          ""
                        }
                        onChange={(e) => setEditing(e.target.value)}
                        placeholder={`输入${s.title}...`}
                      />
                    )}
                    {s.type === "findings_multi" && (
                      <FindingLibraryPicker
                        value={findings}
                        onChange={setFindings}
                      />
                    )}
                    {s.type === "grading_scale" && (
                      <Space wrap>
                        {["gs-001", "gs-002", "gs-003", "gs-004", "gs-005"].map(
                          (g) => (
                            <GradingScalePicker key={g} scaleId={g} />
                          ),
                        )}
                      </Space>
                    )}
                    {s.type === "images" && (
                      <div style={{ display: "flex", gap: 8 }}>
                        {["ei-001", "ei-004", "ei-008"].map((img) => (
                          <div
                            key={img}
                            style={{
                              width: 120,
                              height: 80,
                              background: "#0f172a",
                              borderRadius: 4,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "var(--text-secondary)",
                              fontSize: 12,
                            }}
                          >
                            {img}
                          </div>
                        ))}
                      </div>
                    )}
                    {s.type === "diagnosis" && (
                      <Input.TextArea
                        rows={3}
                        value={`${impression}\n${recommendations}`}
                        onChange={(e) => {
                          const lines = e.target.value.split("\n");
                          setImpression(lines[0] || "");
                          setRecommendations(lines.slice(1).join("\n") || "");
                        }}
                      />
                    )}
                  </div>
                ),
              })) || []
            }
          />

          {/* 报告主文 */}
          <Card
            size="small"
            title={
              <Space>
                <FileText size={14} />
                {t('eyeReport.reportFullText')}
              </Space>
            }
            style={{ marginTop: 8 }}
          >
            <Input.TextArea
              rows={6}
              value={currentContent}
              onChange={(e) => setCurrentContent(e.target.value)}
              placeholder={t('eyeReport.reportPlaceholder')}
            />
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: 8,
                fontSize: 12,
                color: "var(--text-secondary)",
              }}
            >
              <span>
                {t('eyeReport.charCount')} {currentContent.length} | {t('eyeReport.findingsLabel')} {findings.length} | {t('eyeReport.versionLabel')} {report.version}
              </span>
              <Space>
                <Button size="small" icon={<Save size={12} />} loading={savingDraft} onClick={() => void handleSaveDraft()}>
                  {t('eyeReport.autoSave')}
                </Button>
                <Button size="small" type="primary" icon={<Send size={12} />} loading={submittingReview} onClick={() => void handleSubmitReview()}>
                  {t('eyeReport.submit')}
                </Button>
              </Space>
            </div>
          </Card>

          {/* 危急值触发 */}
          {status === "critical_value" && (
            <Alert
              title={
                <span>
                  <AlertTriangle size={14} /> {t('eyeReport.criticalValueTrigger')} {report.criticalValue}
                </span>
              }
              type="error"
              showIcon
              style={{ marginTop: 8, fontSize: 12 }}
            />
          )}
        </Col>

        {/* 右侧栏 */}
        <Col span={8}>
          {/* 患者+报告信息 */}
          <Card size="small" title={t('eyeReport.reportInfo')}>
            <div style={{ fontSize: 12, lineHeight: 2 }}>
              {t('eyeReport.patientLabel')} <strong>{report.patientName}</strong>
              <br />
              {t('eyeReport.examLabel')} <Tag>{MODALITY_LABELS[report.modality] || report.modality}</Tag>
              <br />
              {t('eyeReport.eyeSideLabel')}{" "}
              <EyeLateralityBadge
                eyeSide={report.eyeSide as any}
                size="small"
              />
              <br />
              {t('eyeReport.createdLabel')} {report.createdBy}{" "}
              {new Date(report.createdAt).toLocaleString()}
              <br />
              {t('eyeReport.reviewedLabel')}{" "}
              {report.reviewedBy &&
                `${report.reviewedBy} ${report.reviewedAt ? new Date(report.reviewedAt).toLocaleString() : ""}`}
              <br />
              {t('eyeReport.publishedLabel')}{" "}
              {report.publishedBy &&
                `${report.publishedBy} ${report.publishedAt ? new Date(report.publishedAt).toLocaleString() : ""}`}
              <br />
              {t('eyeReport.signedLabel')} {report.signedBy} ({report.signMethod})
            </div>
          </Card>

          {/* 已选征象 */}
          <Card
            size="small"
            title={t('eyeReport.findingsTitle', { count: findings.length })}
            style={{ marginTop: 8 }}
          >
            {findingsData.map((f) => (
              <Tag
                key={f.id}
                color={
                  f.severity === "severe"
                    ? "red"
                    : f.severity === "abnormal"
                      ? "orange"
                      : "green"
                }
                style={{ margin: 2 }}
              >
                {f.name}
              </Tag>
            ))}
          </Card>

          {/* 状态切换 */}
          <Card size="small" title={t('eyeReport.reportStatus')} style={{ marginTop: 8 }}>
            <Radio.Group
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              size="small"
            >
              {Object.entries(reportStatusLabels).map(([k, v]) => (
                <Radio.Button key={k} value={k} style={{ fontSize: 12 }}>
                  {v}
                </Radio.Button>
              ))}
            </Radio.Group>
          </Card>

          {/* 印象+建议 */}
          <Card size="small" title={t('eyeReport.impressionDiagnosis')} style={{ marginTop: 8 }}>
            <Input.TextArea
              rows={2}
              value={impression}
              onChange={(e) => setImpression(e.target.value)}
              size="small"
              placeholder={t('eyeReport.impressionPlaceholder')}
            />
          </Card>
          <Card size="small" title={t('eyeReport.treatmentAdvice')} style={{ marginTop: 4 }}>
            <Input.TextArea
              rows={2}
              value={recommendations}
              onChange={(e) => setRecommendations(e.target.value)}
              size="small"
              placeholder={t('eyeReport.advicePlaceholder')}
            />
          </Card>

          {/* 报告历史 */}
          <div style={{ marginTop: 8 }}>
            <ReportDraftPanel reportId={report.id} />
          </div>
        </Col>
      </Row>
    </div>
    </>
  );
};

const EyeReportWritePage: React.FC = () => {
  const [reports, setReports] = useState<OphthalmologyReport[]>([]);
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [findingsLibrary, _setFindingsLibrary] = useState<FindingLibraryItem[]>([]);
  const [auditEntries, _setAuditEntries] = useState<ReportAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [selectedReportId, setSelectedReportId] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const [reportsRes, templatesRes, _findingsRes] = await Promise.all([
          eyeApi.getReports(),
          eyeApi.getTemplates(),
          eyeApi.getReports().then(() => eyeApi.getReports()),
        ]);
        if (cancelled) return;
        if (reportsRes.success && Array.isArray(reportsRes.data)) {
          setReports(reportsRes.data as unknown as OphthalmologyReport[]);
          if ((reportsRes.data as unknown as OphthalmologyReport[]).length > 0) {
            setSelectedReportId((reportsRes.data as unknown as OphthalmologyReport[])[0].id);
          }
        }
        if (templatesRes.success && Array.isArray(templatesRes.data)) {
          setTemplates(templatesRes.data as unknown as ReportTemplate[]);
        }
        if (!reportsRes.success && !templatesRes.success) setLoadError(t('w9.states.error'));
      } catch {
        if (!cancelled) { message.error(t('eyeReport.loadFailed')); setLoadError(t('w9.states.error')); }
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [reloadTick]);

  const report = reports.find((r) => r.id === selectedReportId);

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: "center" }}>
        <Spin tip={t('eyeReport.loadingData')} />
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <>
        {loadError && <ErrorBanner message={loadError} onRetry={() => setReloadTick((n) => n + 1)} retryLabel={t('w9.states.retry')} />}
        <Alert title={t('eyeReport.noReports')} type="warning" showIcon style={{ margin: 24 }} />
      </>
    );
  }

  if (!report) return <Alert title={t('eyeReport.reportNotFound')} type="warning" showIcon style={{ margin: 24 }} />;
  return (
    <>
      {loadError && <ErrorBanner message={loadError} onRetry={() => setReloadTick((n) => n + 1)} retryLabel={t('w9.states.retry')} />}
      <div
        style={{
          padding: 16,
          background: "var(--bg-card)",
          minHeight: "calc(100vh - 56px)",
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 12,
          flexWrap: "wrap",
          borderBottom: "1px solid var(--border-color)",
        }}
      >
        <FileText size={24} color="#2563eb" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>{t('eyeReport.title')}</span>
        <Select
          value={selectedReportId}
          onChange={setSelectedReportId}
          style={{ width: 220 }}
          options={reports.map((r) => ({
            value: r.id,
            label: `${r.patientName} — ${MODALITY_LABELS[r.modality] || r.modality}`,
          }))}
        />
      </div>
      <ReportEditor
        key={report.id}
        report={report}
        templates={templates}
        findingsLibrary={findingsLibrary}
        auditEntries={auditEntries}
      />
    </>
  );
};
export default EyeReportWritePage;
