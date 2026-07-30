// [v3.0.6.8-35] PR 2: AI 报告书写页面
// 眼科专病 STT + NLP 结构化提�?+ AI 续写 + 多轮改写 + 反馈闭环
// 对标: Nuance PowerScribe 360 眼科�?/ Medisoft mediSIGHT
import React, { useState, useCallback } from 'react';
import {
  Card, Space, Tag, Button, Select, Input, Form, Row, Col, Divider, message,
  Tabs, List, Rate, Modal, Spin, Empty, Tooltip, Progress, Alert, InputNumber, Switch, Typography,
} from 'antd';
import {
  Mic, Sparkles, Send, Save, RefreshCw, Wand2, Languages, Tag as TagIcon,
  ChevronRight, FileText, History, Star, AlertCircle, BookOpen,
} from 'lucide-react';

const { TextArea } = Input;

interface AIDiagnosis {
  name: string;
  code: string;
  confidence: number;
}

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

const { Text } = Typography || ({} as any);

export const AiReportWriterPage: React.FC = () => {
  const [patientName, setPatientName] = useState('张三');
  const [patientId, setPatientId] = useState('P000001');
  const [condition, setCondition] = useState<string>('dr');
  const [modality, setModality] = useState<string>('fundus');
  const [findings, setFindings] = useState('右眼视盘边界清晰,色淡�?杯盘比约 0.3。视网膜平伏,黄斑中心凹反光未见�?);
  const [aiText, setAiText] = useState('');
  const [busy, setBusy] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extraction, setExtraction] = useState<ExtractionResult | null>(null);
  const [vocab, setVocab] = useState<any>(null);
  const [history, setHistory] = useState<AISuggestion[]>([]);
  const [rewriteStyle, setRewriteStyle] = useState<'concise' | 'detailed' | 'academic'>('detailed');
  const [rewriteInstruction, setRewriteInstruction] = useState('');
  const [recording, setRecording] = useState(false);
  const [sttProgress, setSttProgress] = useState(0);
  const [showVocabModal, setShowVocabModal] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);

  // 加载术语�?
  const loadVocab = useCallback(async (cond: string) => {
    try {
      const r = await fetch(`/api/v1/eye/report/asr/vocab/${cond}`);
      const data = await r.json();
      if (data.success) setVocab(data.data);
    } catch (e) { console.warn('[F03] Error:', (e as Error)?.message); }
  }, []);

  React.useEffect(() => { loadVocab(condition); }, [condition, loadVocab]);

  // AI 续写
  const handleContinue = useCallback(async () => {
    setBusy(true);
    try {
      const r = await fetch('/api/v1/eye/report/ai/continue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientName, findings, modality, condition, maxWords: 300 }),
      });
      const data = await r.json();
      if (data.success) {
        setAiText(data.data.text);
        setHistory(prev => [{
          id: `H${Date.now()}`,
          text: data.data.text,
          condition,
          wordCount: data.data.wordCount,
          generatedAt: data.data.generatedAt,
        }, ...prev].slice(0, 10));
        message.success(`已生�?${data.data.wordCount} 字报告`);
      }
    } catch (e: any) {
      message.error(`续写失败: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }, [patientName, findings, modality, condition]);

  // 多轮改写
  const handleRewrite = useCallback(async () => {
    if (!aiText || !rewriteInstruction) {
      message.warning('请先�?AI 文本并输入改写指�?);
      return;
    }
    setBusy(true);
    try {
      const r = await fetch('/api/v1/eye/report/ai/rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ originalText: aiText, instruction: rewriteInstruction, style: rewriteStyle }),
      });
      const data = await r.json();
      if (data.success) {
        setAiText(data.data.rewritten);
        message.success('已改�?);
      }
    } catch (e: any) {
      message.error(`改写失败: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }, [aiText, rewriteInstruction, rewriteStyle]);

  // NLP 提取
  const handleExtract = useCallback(async () => {
    if (!aiText) { message.warning('请先�?AI 文本'); return; }
    setExtracting(true);
    try {
      const r = await fetch('/api/v1/eye/report/nlp/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: aiText, condition }),
      });
      const data = await r.json();
      if (data.success) {
        setExtraction(data.data);
        message.success('NLP 提取完成');
      }
    } catch (e: any) {
      message.error(`提取失败: ${e.message}`);
    } finally {
      setExtracting(false);
    }
  }, [aiText, condition]);

  // 模拟录音
  const handleRecord = useCallback(async () => {
    setRecording(true);
    setSttProgress(0);
    const interval = setInterval(() => {
      setSttProgress(p => {
        if (p >= 100) {
          clearInterval(interval);
          setRecording(false);
          return 100;
        }
        return p + 5;
      });
    }, 200);
    // 30s 后停�? 模拟语音转文�?
    setTimeout(async () => {
      try {
        const r = await fetch('/api/v1/eye/report/voice/transcribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ audio: '', language: 'zh-CN', condition }),
        });
        const data = await r.json();
        if (data.success) {
          setFindings(prev => prev ? prev + ' ' + data.data.text : data.data.text);
          message.success(`已识�?${data.data.termsDetected?.length || 0} 个术语`);
        }
      } catch (e) { console.warn('[F03] Error:', (e as Error)?.message); }
    }, 7000);
  }, [condition]);

  // 反馈
  const handleFeedback = useCallback(async (suggestion: AISuggestion, rating: number) => {
    try {
      await fetch('/api/v1/eye/report/ai/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId: suggestion.id, aiText: suggestion.text, rating }),
      });
      setHistory(prev => prev.map(h => h.id === suggestion.id ? { ...h, rating } : h));
      message.success('反馈已记�?);
    } catch (e) { console.warn('[F03] Error:', (e as Error)?.message); }
  }, []);

  return (
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }}>
        <FileText size={20} />
        <span style={{ fontSize: 18, fontWeight: 600 }}>眼科 AI 报告书写</span>
        <Tag color="cyan">PR2</Tag>
        <Tag color="purple">v3.0.6.8-35</Tag>
        <Tag color="blue">DeepSeek-Opthalmic</Tag>
      </Space>

      <Row gutter={16}>
        {/* 左侧输入�?*/}
        <Col span={10}>
          <Card title="输入信息" size="small">
            <Form layout="vertical" size="small">
              <Row gutter={8}>
                <Col span={12}>
                  <Form.Item label="患者姓�?>
                    <Input value={patientName} onChange={e => setPatientName(e.target.value)} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="患�?ID">
                    <Input value={patientId} onChange={e => setPatientId(e.target.value)} />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={8}>
                <Col span={12}>
                  <Form.Item label="病种">
                    <Select
                      value={condition}
                      onChange={setCondition}
                      options={[
                        { value: 'dr', label: '糖尿病视网膜病变 (DR)' },
                        { value: 'amd', label: '老年黄斑变�?(AMD)' },
                        { value: 'glaucoma', label: '青光�? },
                        { value: 'cataract', label: '白内�? },
                        { value: 'retinal-detachment', label: '视网膜脱�? },
                        { value: 'keratoconus', label: '圆锥角膜' },
                        { value: 'uveitis', label: '葡萄膜炎' },
                        { value: 'optic-neuritis', label: '视神经炎' },
                        { value: 'strabismus', label: '斜视' },
                        { value: 'oculoplasty', label: '眼整�? },
                        { value: 'default', label: '通用' },
                      ]}
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="影像模�?>
                    <Select
                      value={modality}
                      onChange={setModality}
                      options={[
                        { value: 'fundus', label: '眼底彩照' },
                        { value: 'oct', label: 'OCT' },
                        { value: 'octa', label: 'OCT-A' },
                        { value: 'ffa', label: 'FFA' },
                        { value: 'visualfield', label: '视野' },
                        { value: 'topography', label: '角膜地形�? },
                        { value: 'slitlamp', label: '裂隙�? },
                        { value: 'autofluorescence', label: '自发荧光' },
                      ]}
                    />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item label={
                <Space>
                  <span>检查所�?/span>
                  <Switch size="small" checked={voiceEnabled} onChange={setVoiceEnabled} checkedChildren="语音" unCheckedChildren="键盘" />
                  {voiceEnabled && (
                    <Tooltip title="按住说话 7 �?>
                      <Button size="small" icon={<Mic size={12} />} onClick={handleRecord} danger={recording}>
                        {recording ? '录音�?..' : '开始录�?}
                      </Button>
                    </Tooltip>
                  )}
                  <Button size="small" icon={<BookOpen size={12} />} onClick={() => setShowVocabModal(true)}>
                    术语�?
                  </Button>
                </Space>
              }>
                <TextArea
                  value={findings}
                  onChange={e => setFindings(e.target.value)}
                  rows={5}
                  placeholder="输入检查所�?或使用语音识�?
                />
                {recording && <Progress percent={sttProgress} size="small" status="active" />}
              </Form.Item>
            </Form>
          </Card>

          <Card title="AI 操作" size="small" style={{ marginTop: 16 }}>
            <Space wrap>
              <Button
                type="primary"
                icon={<Sparkles size={14} />}
                loading={busy}
                onClick={handleContinue}
              >
                AI 续写
              </Button>
              <Button
                icon={<Wand2 size={14} />}
                loading={busy}
                onClick={handleExtract}
                disabled={!aiText}
              >
                NLP 提取
              </Button>
              <Button
                icon={<RefreshCw size={14} />}
                loading={busy}
                onClick={handleRewrite}
                disabled={!aiText || !rewriteInstruction}
              >
                多轮改写
              </Button>
              <Button icon={<Save size={14} />} disabled={!aiText}>
                保存报告
              </Button>
            </Space>
            <Divider style={{ margin: '8px 0' }} />
            <Space.Compact style={{ width: '100%' }}>
              <Input
                placeholder="改写指令, �? 简化语言 / 添加 OCT 描述 / 转为英文"
                value={rewriteInstruction}
                onChange={e => setRewriteInstruction(e.target.value)}
              />
              <Select
                value={rewriteStyle}
                onChange={setRewriteStyle as any}
                style={{ width: 100 }}
                options={[
                  { value: 'concise', label: '精简' },
                  { value: 'detailed', label: '详细' },
                  { value: 'academic', label: '学术' },
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
                <Sparkles size={16} color="#1677ff" />
                AI 生成报告
                {extraction && <Tag color="green">NLP 已提�?/Tag>}
              </Space>
            }
            size="small"
            styles={{ body: { minHeight: 280 } }}
          >
            {busy ? (
              <div style={{ textAlign: 'center', padding: 60 }}>
                <Spin size="large" />
                <div style={{ marginTop: 16, color: '#666' }}>DeepSeek-Opthalmic 推理�?..</div>
              </div>
            ) : aiText ? (
              <TextArea
                value={aiText}
                onChange={e => setAiText(e.target.value)}
                rows={14}
                style={{ fontSize: 14, lineHeight: 1.6, fontFamily: 'inherit' }}
              />
            ) : (
              <Empty description="点击 AI 续写 生成报告" />
            )}
          </Card>

          {extraction && (
            <Card
              title={
                <Space>
                  <Wand2 size={16} color="#52c41a" />
                  NLP 结构化提�?
                  <Tag color="cyan">置信�?{(extraction.confidence * 100).toFixed(0)}%</Tag>
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
                    <Tag color="blue">侧别: {extraction.extracted.laterality || '未识�?}</Tag>
                  </Col>
                  <Col span={8}>
                    <Tag color="green">分级: {extraction.extracted.grade || '未识�?}</Tag>
                  </Col>
                  <Col span={8}>
                    <Tag color="purple">模型: {extraction.model}</Tag>
                  </Col>
                  <Col span={24}>
                    <Divider style={{ margin: '4px 0' }} />
                    <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>诊断 (ICD-10):</div>
                    {extraction.extracted.diagnoses.length > 0 ? (
                      extraction.extracted.diagnoses.map((d, i) => (
                        <Tag key={i} color="geekblue" style={{ margin: 2 }}>{d}</Tag>
                      ))
                    ) : (
                      <Tag>未识�?/Tag>
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
                      <Tag color="cyan">C/D: {extraction.extracted.cdRatio}</Tag>
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
                  AI 续写历史
                </Space>
              }
              size="small"
              style={{ marginTop: 16 }}
            >
              <List
                size="small"
                dataSource={history}
                renderItem={item => (
                  <List.Item
                    actions={[
                      <Rate
                        key="rate"
                        value={item.rating || 0}
                        onChange={r => handleFeedback(item, r)}
                      />,
                    ]}
                  >
                    <List.Item.Meta
                      title={
                        <Space>
                          <Tag color="cyan">{item.condition}</Tag>
                          <span style={{ fontSize: 12, color: '#999' }}>{item.wordCount} �?/span>
                        </Space>
                      }
                      description={
                        <div style={{ fontSize: 11, color: '#999' }}>
                          {new Date(item.generatedAt).toLocaleString('zh-CN')}
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

      {/* 术语�?Modal */}
      <Modal
        title={
          <Space>
            <BookOpen size={16} />
            眼科 {vocab?.cn || '术语�?}
            {vocab && <Tag color="cyan">{vocab.terms.length} �?/Tag>}
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
              message={vocab.cn + ' / ' + vocab.en}
              type="info"
              showIcon
              style={{ marginBottom: 12 }}
            />
            <div>
              {vocab.terms.map((t: string, i: number) => (
                <Tag.CheckableTag
                  key={i}
                  checked={false}
                  onChange={checked => {
                    if (checked) setFindings(prev => prev + (prev.endsWith('�?) ? '' : '�?) + t);
                  }}
                  style={{ margin: 4, fontSize: 13 }}
                >
                  {t}
                </Tag.CheckableTag>
              ))}
            </div>
          </>
        ) : (
          <Empty description="暂无术语�? />
        )}
      </Modal>
    </div>
  );
};

export default AiReportWriterPage;
