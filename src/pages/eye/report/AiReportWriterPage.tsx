// [v3.0.6.8-35] PR 2: AI 报告书写页面
// 眼科专病 STT + NLP 结构化提?+ AI 续写 + 多轮改写 + 反馈闭环
// 对标: Nuance PowerScribe 360 眼科?/ Medisoft mediSIGHT
import {
  Card,
  Space,
  Tag,
  Button,
  Select,
  Input,
  Form,
  Row,
  Col,
  Divider,
  message,
  List,
  Rate,
  Modal,
  Spin,
  Empty,
  Tooltip,
  Progress,
  Alert,
  Switch,
} from "antd";
import {
  Mic,
  Sparkles,
  Save,
  RefreshCw,
  Wand2,
  FileText,
  History,
  BookOpen,
} from "lucide-react";
import { Inbox } from 'lucide-react'
import React, { useState, useCallback, useRef } from "react";
import { t } from "../../../i18n/appI18n";

const { TextArea } = Input;

interface ExtractionResult {
  sourceText: string;
  extracted: {
    laterality: string | null;
    diagnoses: string[];
    grade: string | null;
    iol: string | null;
    iop: string | null;
    cdRatio: string | null;
  };
  icdMapped: string[];
  confidence: number;
  model: string;
}

interface AISuggestion {
  id: string;
  text: string;
  condition: string;
  wordCount: number;
  generatedAt: string;
  rating?: number;
}

// [G005 W7] 初始演示 AI 报告 — 保证页面打开即有数据 (非空白), 按钮可直接操作
const DEMO_AI_TEXT = `【检查所见】
右眼视盘边界清晰，色淡红，杯盘比约 0.3。视网膜平伏，黄斑中心凹反光未见明显异常。后极部未见明显出血、渗出。

【诊断】
1. 双眼屈光不正
2. 右眼轻度玻璃体混浊

【建议】
1. 定期复查眼底（3-6 个月）
2. 必要时行 OCT 或 FFA 检查
3. 注意用眼卫生，避免剧烈运动`;

const DEMO_HISTORY: AISuggestion[] = [
  {
    id: 'H-demo-1',
    text: DEMO_AI_TEXT,
    condition: 'dr',
    wordCount: DEMO_AI_TEXT.length,
    generatedAt: '2026-01-01T08:00:00.000Z',
  },
];

export const AiReportWriterPage: React.FC = () => {
  const [patientName, setPatientName] = useState("张三");
  const [patientId, setPatientId] = useState("P000001");
  const [condition, setCondition] = useState<string>("dr");
  const [modality, setModality] = useState<string>("fundus");
  const [findings, setFindings] = useState(
    "右眼视盘边界清晰,色淡红,杯盘比约 0.3。视网膜平伏,黄斑中心凹反光未见明显异常。",
  );
  const [aiText, setAiText] = useState(DEMO_AI_TEXT);
  const [busy, setBusy] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extraction, setExtraction] = useState<ExtractionResult | null>(null);
  const [vocab, setVocab] = useState<any>(null);
  const [history, setHistory] = useState<AISuggestion[]>(DEMO_HISTORY);
  const [rewriteStyle, setRewriteStyle] = useState<
    "concise" | "detailed" | "academic"
  >("detailed");
  const [rewriteInstruction, setRewriteInstruction] = useState("");
  const [recording, setRecording] = useState(false);
  const [sttProgress, setSttProgress] = useState(0);
  const [showVocabModal, setShowVocabModal] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);

  // 加载术语库
  const loadVocab = useCallback(async (cond: string) => {
    try {
      const r = await fetch(`/api/v1/eye/report/asr/vocab/${cond}`);
      const data = await r.json();
      if (data.success) setVocab(data.data);
    } catch (e) {
      console.warn("[F03] Error:", (e as Error)?.message);
    }
  }, []);

  React.useEffect(() => {
    loadVocab(condition);
  }, [condition, loadVocab]);

  // AI 续写
  const handleContinue = useCallback(async () => {
    setBusy(true);
    try {
      const r = await fetch("/api/v1/eye/report/ai/continue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientName,
          findings,
          modality,
          condition,
          maxWords: 300,
        }),
      });
      const data = await r.json();
      if (data.success) {
        setAiText(data.data.text);
        setHistory((prev) =>
          [
            {
              id: `H${Date.now()}`,
              text: data.data.text,
              condition,
              wordCount: data.data.wordCount,
              generatedAt: data.data.generatedAt,
            },
            ...prev,
          ].slice(0, 10),
        );
        message.success(t('w9d.aiReportWriter.generated', { count: data.data.wordCount }));
      }
    } catch (e: any) {
      message.error(t('w9d.aiReportWriter.continueFailed', { msg: e.message }));
    } finally {
      setBusy(false);
    }
  }, [patientName, findings, modality, condition]);

  // 多轮改写
  const handleRewrite = useCallback(async () => {
    if (!aiText || !rewriteInstruction) {
      message.warning(t('aiReportWriter.needAiTextAndInstruction'));
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/v1/eye/report/ai/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalText: aiText,
          instruction: rewriteInstruction,
          style: rewriteStyle,
        }),
      });
      const data = await r.json();
      if (data.success) {
        setAiText(data.data.rewritten);
        message.success(t('aiReportWriter.rewritten'));
      }
    } catch (e: any) {
      message.error(t('w9d.aiReportWriter.rewriteFailed', { msg: e.message }));
    } finally {
      setBusy(false);
    }
  }, [aiText, rewriteInstruction, rewriteStyle]);

  // NLP 提取
  const handleExtract = useCallback(async () => {
    if (!aiText) {
      message.warning(t('aiReportWriter.needAiText'));
      return;
    }
    setExtracting(true);
    try {
      const r = await fetch("/api/v1/eye/report/nlp/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: aiText, condition }),
      });
      const data = await r.json();
      if (data.success) {
        setExtraction(data.data);
        message.success(t('aiReportWriter.nlpDone'));
      }
    } catch (e: any) {
      message.error(t('w9d.aiReportWriter.extractFailed', { msg: e.message }));
    } finally {
      setExtracting(false);
    }
  }, [aiText, condition]);

  // [v3.0.6.11-99 Wave8A P1] 真实录音: MediaRecorder 采集 → 现有 transcribe 接口 (base64);
  // 浏览器无 navigator.mediaDevices / 麦克风不可用时回退模拟录音 + 标注
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const transcribeAudio = useCallback(async (audioBase64: string, simulated: boolean) => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setSttProgress(100);
    setRecording(false);
    try {
      const r = await fetch("/api/v1/eye/report/voice/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio: audioBase64, language: "zh-CN", condition }),
      });
      const data = await r.json();
      if (data.success) {
        setFindings((prev) =>
          prev ? prev + " " + data.data.text : data.data.text,
        );
        message.success(
          t('w9d.aiReportWriter.termsDetected', { count: data.data.termsDetected?.length || 0, source: simulated ? t('w9d.aiReportWriter.simulatedAudio') : t('w9d.aiReportWriter.realAudio') }),
        );
      }
    } catch (e) {
      console.warn("[F03] Error:", (e as Error)?.message);
      message.warning(t('aiReportWriter.transcribeUnavailable'));
    }
  }, [condition]);

  const handleRecord = useCallback(async () => {
    if (recording) {
      // 再次点击 → 停止并转写
      mediaRecorderRef.current?.stop();
      return;
    }
    const supportsRecorder =
      typeof navigator !== "undefined" &&
      !!navigator.mediaDevices?.getUserMedia &&
      typeof MediaRecorder !== "undefined";
    if (!supportsRecorder) {
      // 回退: 模拟录音 (7s 后调用同一转写接口, 标注)
      setRecording(true);
      setSttProgress(0);
      const interval = setInterval(() => {
        setSttProgress((p) => {
          if (p >= 100) { clearInterval(interval); return 100; }
          return p + 5;
        });
      }, 200);
      timerRef.current = interval;
      setTimeout(() => { void transcribeAudio("", true); }, 7000);
      message.warning(t('aiReportWriter.recordingUnsupported'));
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = String(reader.result ?? "").split(",")[1] ?? "";
          void transcribeAudio(base64, false);
        };
        reader.readAsDataURL(blob);
        mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
        mediaRecorderRef.current = null;
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      mediaStreamRef.current = stream;
      setRecording(true);
      setSttProgress(0);
      const interval = setInterval(() => {
        setSttProgress((p) => (p >= 100 ? 100 : p + 5));
      }, 200);
      timerRef.current = interval;
      message.success(t('aiReportWriter.recordingStarted'));
    } catch {
      message.error(t('aiReportWriter.micDenied'));
    }
  }, [recording, transcribeAudio]);

  // [G005] 保存 AI 报告草稿到本地 (演示: localStorage + toast)
  const handleSave = useCallback(() => {
    if (!aiText) return;
    try {
      const draft = {
        patientId, patientName, condition, modality, findings, aiText,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(`eye.aiReport.draft.${patientId}`, JSON.stringify(draft));
      message.success(t('w1Buttons.aiReport.saved'));
    } catch {
      message.error(t('w1Buttons.aiReport.saveFailed'));
    }
  }, [aiText, patientId, patientName, condition, modality, findings]);

  // 反馈
  const handleFeedback = useCallback(
    async (suggestion: AISuggestion, rating: number) => {
      try {
        await fetch("/api/v1/eye/report/ai/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reportId: suggestion.id,
            aiText: suggestion.text,
            rating,
          }),
        });
        setHistory((prev) =>
          prev.map((h) => (h.id === suggestion.id ? { ...h, rating } : h)),
        );
        message.success(t('aiReportWriter.feedbackRecorded'));
      } catch (e) {
        console.warn("[F03] Error:", (e as Error)?.message);
      }
    },
    [],
  );

  return (
    <div style={{ padding: 24, background: "var(--bg-card)",}}>
      <Space style={{ marginBottom: 16 }}>
        <FileText size={20} />
        <span style={{ fontSize: 18, fontWeight: 600 }}>{t('aiReportWriter.title')}</span>
        <Tag color="cyan">PR2</Tag>
        <Tag color="purple">v3.0.6.8-35</Tag>
        <Tag color="blue">DeepSeek-Opthalmic</Tag>
        {/* [v3.0.6.11-88 Round10] /eye/report/ai|nlp|voice 后端未实现, MSW 演示数据 */}
        <Tag color="orange">{t('aiReportWriter.demoData')}</Tag>
        {/* [G005 W7] 明确的「演示模拟」徽标 (STT/NLP/AI 均为本地/模拟) */}
        <Tooltip title={t('w7demo.aiSimulated')}>
          <Tag color="volcano">{t('w7demo.simulatedBadge')}</Tag>
        </Tooltip>
      </Space>

      <Row gutter={16}>
        {/* 左侧输入?*/}
        <Col span={10}>
          <Card title={t('aiReportWriter.inputInfo')} size="small">
            <Form layout="vertical" size="small">
              <Row gutter={8}>
                <Col span={12}>
                  <Form.Item label={t('aiReportWriter.patientName')}>
                    <Input
                      value={patientName}
                      onChange={(e) => setPatientName(e.target.value)}
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label={t('aiReportWriter.patientId')}>
                    <Input
                      value={patientId}
                      onChange={(e) => setPatientId(e.target.value)}
                    />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={8}>
                <Col span={12}>
                  <Form.Item label={t('aiReportWriter.condition')}>
                    <Select
                      value={condition}
                      onChange={setCondition}
                      options={[
                        { value: "dr", label: t('aiReportWriter.condDr') },
                        { value: "amd", label: t('aiReportWriter.condAmd') },
                        { value: "glaucoma", label: t('aiReportWriter.condGlaucoma') },
                        { value: "cataract", label: t('aiReportWriter.condCataract') },
                        { value: "retinal-detachment", label: t('aiReportWriter.condRetinalDetachment') },
                        { value: "keratoconus", label: t('aiReportWriter.condKeratoconus') },
                        { value: "uveitis", label: t('aiReportWriter.condUveitis') },
                        { value: "optic-neuritis", label: t('aiReportWriter.condOpticNeuritis') },
                        { value: "strabismus", label: t('aiReportWriter.condStrabismus') },
                        { value: "oculoplasty", label: t('aiReportWriter.condOculoplasty') },
                        { value: "default", label: t('aiReportWriter.condDefault') },
                      ]}
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label={t('aiReportWriter.modality')}>
                    <Select
                      value={modality}
                      onChange={setModality}
                      options={[
                        { value: "fundus", label: t('aiReportWriter.modFundus') },
                        { value: "oct", label: "OCT" },
                        { value: "octa", label: "OCT-A" },
                        { value: "ffa", label: "FFA" },
                        { value: "visualfield", label: t('aiReportWriter.modVisualField') },
                        { value: "topography", label: t('aiReportWriter.modTopography') },
                        { value: "slitlamp", label: t('aiReportWriter.modSlitLamp') },
                        { value: "autofluorescence", label: t('aiReportWriter.modAutofluorescence') },
                      ]}
                    />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item
                label={
                  <Space>
                    <span>{t('aiReportWriter.findingsLabel')}</span>
                    <Switch
                      size="small"
                      checked={voiceEnabled}
                      onChange={setVoiceEnabled}
                      checkedChildren={t('aiReportWriter.voice')}
                      unCheckedChildren={t('aiReportWriter.keyboard')}
                    />
                    {voiceEnabled && (
                      <Tooltip title={t('aiReportWriter.recordTip')}>
                        <Button
                          size="small"
                          icon={<Mic size={12} />}
                          onClick={() => void handleRecord()}
                          danger={recording}
                        >
                          {recording ? t('aiReportWriter.recordingClickStop') : t('aiReportWriter.startRecord')}
                        </Button>
                      </Tooltip>
                    )}
                    <Button
                      size="small"
                      icon={<BookOpen size={12} />}
                      onClick={() => setShowVocabModal(true)}
                    >
                      {t('aiReportWriter.vocabLibrary')}
                    </Button>
                  </Space>
                }
              >
                <TextArea
                  value={findings}
                  onChange={(e) => setFindings(e.target.value)}
                  rows={5}
                  placeholder={t('aiReportWriter.findingsPlaceholder')}
                />
                {recording && (
                  <Progress
                    percent={sttProgress}
                    size="small"
                    status="active"
                  />
                )}
              </Form.Item>
            </Form>
          </Card>

          <Card title={t('aiReportWriter.aiOps')} size="small" style={{ marginTop: 16 }}>
            <Space wrap>
              <Button
                type="primary"
                icon={<Sparkles size={14} />}
                loading={busy}
                onClick={handleContinue}
              >
                {t('aiReportWriter.aiContinue')}
              </Button>
              <Button
                icon={<Wand2 size={14} />}
                loading={busy}
                onClick={handleExtract}
                disabled={!aiText}
              >
                {t('aiReportWriter.nlpExtract')}
              </Button>
              <Button
                icon={<RefreshCw size={14} />}
                loading={busy}
                onClick={handleRewrite}
                disabled={!aiText || !rewriteInstruction}
              >
                {t('aiReportWriter.multiRewrite')}
              </Button>
              <Button icon={<Save size={14} />} disabled={!aiText} onClick={handleSave}>
                {t('aiReportWriter.saveReport')}
              </Button>
            </Space>
            <Divider style={{ margin: "8px 0" }} />
            <Space.Compact style={{ width: "100%" }}>
              <Input
                placeholder={t('aiReportWriter.rewritePlaceholder')}
                value={rewriteInstruction}
                onChange={(e) => setRewriteInstruction(e.target.value)}
              />
              <Select
                value={rewriteStyle}
                onChange={setRewriteStyle as any}
                style={{ width: 100 }}
                options={[
                  { value: "concise", label: t('aiReportWriter.styleConcise') },
                  { value: "detailed", label: t('aiReportWriter.styleDetailed') },
                  { value: "academic", label: t('aiReportWriter.styleAcademic') },
                ]}
              />
            </Space.Compact>
          </Card>
        </Col>

        {/* 右侧 AI 输出 + NLP 提取 */}
        <Col span={14}>
          <Card
            title={
              <Space>
                <Sparkles size={16} color="var(--color-primary-600)" />
                {t('aiReportWriter.aiGeneratedReport')}
                {extraction && <Tag color="green">{t('aiReportWriter.nlpExtracted')}</Tag>}
              </Space>
            }
            size="small"
            styles={{ body: { minHeight: 280 } }}
          >
            {busy ? (
              <div style={{ textAlign: "center", padding: 60 }}>
                <Spin size="large" />
                <div style={{ marginTop: 16, color: "var(--text-secondary)" }}>
                  {t('aiReportWriter.inferring')}
                </div>
              </div>
            ) : aiText ? (
              <TextArea
                value={aiText}
                onChange={(e) => setAiText(e.target.value)}
                rows={14}
                style={{ fontSize: 14, lineHeight: 1.6, fontFamily: "inherit" }}
              />
            ) : (
              <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t('aiReportWriter.continueHint')} />
            )}
          </Card>

          {extraction && (
            <Card
              title={
                <Space>
                  <Wand2 size={16} color="#52c41a" />
                  {t('aiReportWriter.nlpStructured')}
                  <Tag color="cyan">
                    {t('aiReportWriter.confidence')} {(extraction.confidence * 100).toFixed(0)}%
                  </Tag>
                </Space>
              }
              size="small"
              style={{ marginTop: 16 }}
            >
              {extracting ? (
                <Spin />
              ) : (
                <Row gutter={[8, 8]}>
                  <Col span={8}>
                    <Tag color="blue">
                      {t('aiReportWriter.laterality')} {extraction.extracted.laterality || t('aiReportWriter.notRecognized')}
                    </Tag>
                  </Col>
                  <Col span={8}>
                    <Tag color="green">
                      {t('aiReportWriter.grade')} {extraction.extracted.grade || t('aiReportWriter.notRecognized')}
                    </Tag>
                  </Col>
                  <Col span={8}>
                    <Tag color="purple">{t('aiReportWriter.model')} {extraction.model}</Tag>
                  </Col>
                  <Col span={24}>
                    <Divider style={{ margin: "4px 0" }} />
                    <div
                      style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}
                    >
                      {t('aiReportWriter.diagnosisIcd')}
                    </div>
                    {extraction.extracted.diagnoses.length > 0 ? (
                      extraction.extracted.diagnoses.map((d, i) => (
                        <Tag key={i} color="geekblue" style={{ margin: 2 }}>
                          {d}
                        </Tag>
                      ))
                    ) : (
                      <Tag>{t('aiReportWriter.notRecognized')}</Tag>
                    )}
                  </Col>
                  {extraction.extracted.iol && (
                    <Col span={8}>
                      <Tag color="magenta">IOL: {extraction.extracted.iol}</Tag>
                    </Col>
                  )}
                  {extraction.extracted.iop && (
                    <Col span={8}>
                      <Tag color="orange">IOP: {extraction.extracted.iop}</Tag>
                    </Col>
                  )}
                  {extraction.extracted.cdRatio && (
                    <Col span={8}>
                      <Tag color="cyan">
                        C/D: {extraction.extracted.cdRatio}
                      </Tag>
                    </Col>
                  )}
                </Row>
              )}
            </Card>
          )}

          {history.length > 0 && (
            <Card
              title={
                <Space>
                  <History size={16} />
                  {t('aiReportWriter.continueHistory')}
                </Space>
              }
              size="small"
              style={{ marginTop: 16 }}
            >
              <List
                size="small"
                dataSource={history}
                renderItem={(item) => (
                  <List.Item
                    actions={[
                      <Rate
                        key="rate"
                        value={item.rating || 0}
                        onChange={(r) => handleFeedback(item, r)}
                      />,
                    ]}
                  >
                    <List.Item.Meta
                      title={
                        <Space>
                          <Tag color="cyan">{item.condition}</Tag>
                          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                            {item.wordCount} {t('aiReportWriter.words')}
                          </span>
                        </Space>
                      }
                      description={
                        <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                          {new Date(item.generatedAt).toLocaleString("zh-CN")}
                        </div>
                      }
                    />
                  </List.Item>
                )}
              />
            </Card>
          )}
        </Col>
      </Row>

      {/* 术语库Modal */}
      <Modal
        title={
          <Space>
            <BookOpen size={16} />
            {t('aiReportWriter.eyePrefix')} {vocab?.cn || t('aiReportWriter.vocabLibrary')}
            {vocab && <Tag color="cyan">{vocab.terms.length} {t('aiReportWriter.items')}</Tag>}
          </Space>
        }
        open={showVocabModal}
        onCancel={() => setShowVocabModal(false)}
        footer={null}
        width={680}
      >
        {vocab ? (
          <>
            <Alert
              title={vocab.cn + " / " + vocab.en}
              type="info"
              showIcon
              style={{ marginBottom: 12 }}
            />
            <div>
              {vocab.terms.map((term: string, i: number) => (
                <Tag.CheckableTag
                  key={i}
                  checked={false}
                  onChange={(checked) => {
                    if (checked)
                      setFindings(
                        (prev) => prev + (prev.endsWith(" ") ? "" : " ") + term,
                      );
                  }}
                  style={{ margin: 4, fontSize: 12 }}
                >
                  {term}
                </Tag.CheckableTag>
              ))}
            </div>
          </>
        ) : (
          <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t('aiReportWriter.noVocab')} />
        )}
      </Modal>
    </div>
  );
};

export default AiReportWriterPage;
