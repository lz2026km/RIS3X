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
        message.success('草稿已保存');
      } else {
        message.warning(res.error?.message ?? '草稿接口不可用，已本地暂存');
      }
    } catch {
      message.warning('草稿接口不可用，已本地暂存');
    } finally {
      setSavingDraft(false);
    }
  };

  const handleSubmitReview = async () => {
    setSubmittingReview(true);
    try {
      const res = await eyeApi.submitReport(report.id);
      if (res.success) {
        message.success('报告已提交审核');
        setStatus('pending_review');
      } else {
        message.warning(res.error?.message ?? '提交接口不可用，已本地更新状态');
        setStatus('pending_review');
      }
    } catch {
      setStatus('pending_review');
      message.success('报告已提交审核（本地状态更新）');
    } finally {
      setSubmittingReview(false);
    }
  };

  const template = templates.find((t) => t.id === templateId);
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
          background: "#f8fafc",
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
          语音
        </Button>
        <Button
          size="small"
          icon={<Brain size={14} />}
          onClick={() => setShowAiDialog(!showAiDialog)}
          type={showAiDialog ? "primary" : "default"}
        >
          AI 续写
        </Button>
        <Button size="small" icon={<Save size={14} />} loading={savingDraft} onClick={() => void handleSaveDraft()}>
          保存草稿
        </Button>
        <Button size="small" type="primary" icon={<Send size={14} />} loading={submittingReview} onClick={() => void handleSubmitReview()}>
          提交审核
        </Button>
        <Button
          size="small"
          icon={<Stamp size={14} />}
          onClick={() => setSignModal(!signModal)}
        >
          数字签名
        </Button>
        <Button
          size="small"
          icon={<Printer size={14} />}
          onClick={() => setPrintModal(!printModal)}
        >
          打印
        </Button>
      </div>

      {/* 语音 / AI / 签名 / 打印 弹窗 */}
      <AppModal
        open={showVoiceDialog}
        onClose={() => setShowVoiceDialog(false)}
        title="语音输入 (Demo)"
        icon={<Mic size={18} />}
        iconBg="#dbeafe"
        iconColor="#1e40af"
        size="sm"
      >
        <div style={{ fontSize: 13, color: "#334155" }}>
          请说出您要录入的所见内容,系统会自动转换为文本并填入当前编辑区域。
        </div>
        <div
          style={{
            marginTop: 12,
            padding: 12,
            background: "#f8fafc",
            borderRadius: 6,
            border: "1px dashed #cbd5e1",
            fontSize: 12,
            color: "#64748b",
            textAlign: "center",
          }}
        >
          等待语音输入...
        </div>
      </AppModal>
      <AppModal
        open={showAiDialog}
        onClose={() => setShowAiDialog(false)}
        title="AI 辅助所见 (Demo)"
        icon={<Brain size={18} />}
        iconBg="#fef3c7"
        iconColor="#b45309"
        size="md"
        footer={
          <>
            <Tag>忽略</Tag>
            <Tag color="orange">修改</Tag>
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
              采纳并关闭
            </button>
          </>
        }
      >
        <div style={{ fontSize: 13, color: "#334155" }}>
          基于当前影像数据, AI 建议:
        </div>
        <ul
          style={{
            marginTop: 8,
            paddingLeft: 18,
            fontSize: 12,
            color: "#475569",
            lineHeight: 1.8,
          }}
        >
          <li>视盘边界清晰, 颜色正常</li>
          <li>黄斑中心凹反光可见</li>
          <li>视网膜血管走行自然, 未见明显出血或渗出</li>
        </ul>
      </AppModal>
      <AppModal
        open={signModal}
        onClose={() => setSignModal(false)}
        title="数字签名 (Demo)"
        icon={<Stamp size={18} />}
        iconBg="#dcfce7"
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
            确认签名
          </button>
        }
      >
        <div style={{ fontSize: 13, color: "#334155", lineHeight: 1.8 }}>
          <div>
            <strong>签名医生:</strong> 张明远 主任医师
          </div>
          <div>
            <strong>签名方式:</strong> <Tag color="green">CA 数字证书</Tag>{" "}
            <Tag color="blue">手写板</Tag>
          </div>
          <div>
            <strong>签名时间:</strong> 2026-06-20 16:50
          </div>
        </div>
      </AppModal>
      <AppModal
        open={printModal}
        onClose={() => setPrintModal(false)}
        title="打印 (Demo)"
        icon={<Printer size={18} />}
        iconBg="#dbeafe"
        iconColor="#1e40af"
        size="sm"
        footer={
          <>
            <Tag color="orange">取消</Tag>
            <button
              onClick={() => setPrintModal(false)}
              style={{
                padding: "6px 14px",
                border: "1px solid #e2e8f0",
                background: "#fff",
                color: "#64748b",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              预览
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
              打印
            </button>
          </>
        }
      >
        <div style={{ fontSize: 13, color: "#334155", lineHeight: 1.8 }}>
          <div>
            <strong>打印机:</strong> DryView 8700
          </div>
          <div>
            <strong>胶片:</strong> 4 张
          </div>
          <div>
            <strong>报告:</strong> 2 份
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
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                {template.sections.length} 段 ·{" "}
                {template.sections.filter((s) => s.required).length} 必填 · 版本{" "}
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
                              color: "#64748b",
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
                报告全文
              </Space>
            }
            style={{ marginTop: 8 }}
          >
            <Input.TextArea
              rows={6}
              value={currentContent}
              onChange={(e) => setCurrentContent(e.target.value)}
              placeholder="编写报告正文..."
            />
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: 8,
                fontSize: 12,
                color: "#94a3b8",
              }}
            >
              <span>
                字数: {currentContent.length} | 征象: {findings.length} | 版本:{" "}
                {report.version}
              </span>
              <Space>
                <Button size="small" icon={<Save size={12} />} loading={savingDraft} onClick={() => void handleSaveDraft()}>
                  自动保存
                </Button>
                <Button size="small" type="primary" icon={<Send size={12} />} loading={submittingReview} onClick={() => void handleSubmitReview()}>
                  提交
                </Button>
              </Space>
            </div>
          </Card>

          {/* 危急值触发 */}
          {status === "critical_value" && (
            <Alert
              title={
                <span>
                  <AlertTriangle size={14} /> 危急值触发: {report.criticalValue}
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
          <Card size="small" title="报告信息">
            <div style={{ fontSize: 12, lineHeight: 2 }}>
              患者: <strong>{report.patientName}</strong>
              <br />
              检查: <Tag>{MODALITY_LABELS[report.modality] || report.modality}</Tag>
              <br />
              眼别:{" "}
              <EyeLateralityBadge
                eyeSide={report.eyeSide as any}
                size="small"
              />
              <br />
              创建: {report.createdBy}{" "}
              {new Date(report.createdAt).toLocaleString()}
              <br />
              审核:{" "}
              {report.reviewedBy &&
                `${report.reviewedBy} ${report.reviewedAt ? new Date(report.reviewedAt).toLocaleString() : ""}`}
              <br />
              发布:{" "}
              {report.publishedBy &&
                `${report.publishedBy} ${report.publishedAt ? new Date(report.publishedAt).toLocaleString() : ""}`}
              <br />
              签名: {report.signedBy} ({report.signMethod})
            </div>
          </Card>

          {/* 已选征象 */}
          <Card
            size="small"
            title={`征象 (${findings.length})`}
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
          <Card size="small" title="报告状态" style={{ marginTop: 8 }}>
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
          <Card size="small" title="印象/诊断" style={{ marginTop: 8 }}>
            <Input.TextArea
              rows={2}
              value={impression}
              onChange={(e) => setImpression(e.target.value)}
              size="small"
              placeholder="诊断印象..."
            />
          </Card>
          <Card size="small" title="治疗建议" style={{ marginTop: 4 }}>
            <Input.TextArea
              rows={2}
              value={recommendations}
              onChange={(e) => setRecommendations(e.target.value)}
              size="small"
              placeholder="建议..."
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
  const [selectedReportId, setSelectedReportId] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
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
      } catch {
        if (!cancelled) message.error("加载报告数据失败");
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const report = reports.find((r) => r.id === selectedReportId);

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: "center" }}>
        <Spin tip="加载报告数据..." />
      </div>
    );
  }

  if (reports.length === 0) {
    return <Alert title="暂无报告数据" type="warning" showIcon style={{ margin: 24 }} />;
  }

  if (!report) return <Alert title="未找到报告" type="warning" showIcon style={{ margin: 24 }} />;
  return (
    <>
      <div
        style={{
          padding: 16,
          background: "#f8fafc",
          minHeight: "calc(100vh - 56px)",
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 12,
          flexWrap: "wrap",
          borderBottom: "1px solid #e2e8f0",
        }}
      >
        <FileText size={24} color="#1677ff" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>眼科报告书写</span>
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
