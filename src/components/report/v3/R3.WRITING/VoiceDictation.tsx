/**
 * G005 放射RIS系统 v3.0.5.1 - 语音听写
 * R3.WRITING 组 C:语音听写 Pro(Web Speech API)
 * 20 升级点:实时识别 / 自动标点 / 分段 / 命令 / 历史 / 多语言
 * Expanded: 段落选择 / 多说话人 / 医学术语管理 / 命令面板
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Card, Space, Button, Tag, Statistic, Select, Switch, Tooltip, message, Progress, Row, Col, Alert, Empty, List, Modal, Input, Collapse, Table } from 'antd';
import type { TableProps } from 'antd';
import {
  Mic, MicOff, Square, Volume2, Languages, Command, History, Play, Pause, Trash2,
  Activity, FileText, Clock, AlertCircle, Settings, ChevronRight, Type, BookOpen, User,
} from 'lucide-react';
import { VOICE_DICTATION_MOCK } from '@data/reportWritingMock';
import {
  startVoiceDictation, pauseVoiceDictation, resumeVoiceDictation, stopVoiceDictation,
  getVoiceDictationHistory,
} from '@services/writing/writingService';
import { asrApi } from '@services/api/asrApi';
import type { VoiceDictationSession, VoiceDictationState, VoiceDictationLang } from '@types/R3/R3.WRITING';

interface Props {
  reportId: string;
  onTextChange?: (text: string) => void;
  onInsert?: (text: string) => void;
  disabled?: boolean;
}

// ---------- 语言 ----------

const LANG_OPTIONS = [
  { value: 'zh-CN', label: '中文', color: '#dc2626' },
  { value: 'en-US', label: 'English', color: '#3b82f6' },
  { value: 'zh-EN', label: '中英混合', color: '#7c3aed' },
];

// ---------- 目标段落 ----------

const SECTIONS = [
  { key: 'findings', label: '影像所见' },
  { key: 'impression', label: '诊断印象' },
  { key: 'diagnosis', label: '诊断结论' },
  { key: 'recommendation', label: '建议' },
  { key: 'full', label: '全篇' },
] as const;

type SectionKey = (typeof SECTIONS)[number]['key'];

// ---------- 多说话人 ----------

const SPEAKERS = [
  { value: 'resident', label: '住院医' },
  { value: 'attending', label: '主治医师' },
  { value: 'transcriber', label: '报告录入员' },
] as const;

type SpeakerKey = (typeof SPEAKERS)[number]['value'];

// ---------- 语音命令 ----------

const VOICE_COMMANDS = [
  { command: '换行', action: '插入换行' },
  { command: '新段落', action: '新段落' },
  { command: '删除', action: '删除上一句' },
  { command: '清除', action: '清空所有' },
  { command: '句号', action: '插入句号' },
  { command: '逗号', action: '插入逗号' },
  { command: '冒号', action: '插入冒号' },
  { command: '左肺', action: '插入"左肺"' },
  { command: '右肺', action: '插入"右肺"' },
];

interface VoiceCommandTableItem {
  command: string;
  english: string;
  description: string;
}

const VOICE_COMMAND_TABLE_DATA: VoiceCommandTableItem[] = [
  { command: '新段落', english: 'New Paragraph', description: '在当前位置插入新段落' },
  { command: '下一字段', english: 'Next Field', description: '跳转到下一个输入字段' },
  { command: '保存草稿', english: 'Save Draft', description: '保存当前报告为草稿' },
  { command: '正常模板', english: 'Normal Template', description: '插入正常模板' },
  { command: '提交审核', english: 'Submit Report', description: '提交报告供审核' },
];

const VOICE_COMMAND_TABLE_COLUMNS: TableProps<VoiceCommandTableItem>['columns'] = [
  { title: '命令', dataIndex: 'command', key: 'command', width: 100 },
  { title: 'English', dataIndex: 'english', key: 'english', width: 140 },
  { title: '说明', dataIndex: 'description', key: 'description' },
];

// ---------- 医学术语词汇 ----------

interface MedicalVocabItem {
  term: string;
  normalized: string;
  category: string;
  modality: string;
}

const MEDICAL_VOCAB: MedicalVocabItem[] = [
  { term: '结节', normalized: '结节', category: '肺结节', modality: 'CT' },
  { term: '磨玻璃影', normalized: '磨玻璃密度影', category: '磨玻璃密度', modality: 'CT' },
  { term: '钙化灶', normalized: '钙化灶', category: '钙化', modality: 'CT' },
  { term: 'T1WI', normalized: 'T1加权像', category: '序列', modality: 'MR' },
  { term: 'T2WI', normalized: 'T2加权像', category: '序列', modality: 'MR' },
  { term: 'DWI', normalized: '弥散加权成像', category: '功能成像', modality: 'MR' },
  { term: '肺纹理增粗', normalized: '肺纹理增粗', category: '肺间质', modality: 'DR' },
  { term: '心影增大', normalized: '心影增大', category: '心脏', modality: 'DR' },
  { term: '肋膈角变钝', normalized: '肋膈角变钝', category: '胸膜', modality: 'DR' },
  { term: '低回声', normalized: '低回声', category: '回声', modality: 'US' },
  { term: '无回声', normalized: '无回声', category: '回声', modality: 'US' },
  { term: '混合回声', normalized: '混合回声', category: '回声', modality: 'US' },
];

const VOCAB_COLUMNS: TableProps<MedicalVocabItem>['columns'] = [
  { title: '术语', dataIndex: 'term', key: 'term', width: 100 },
  { title: '规范化', dataIndex: 'normalized', key: 'normalized', width: 130 },
  { title: '类别', dataIndex: 'category', key: 'category', width: 100 },
  { title: '模态', dataIndex: 'modality', key: 'modality', width: 60 },
];

// ---------- Component ----------

export const VoiceDictation: React.FC<Props> = ({ reportId, onTextChange, onInsert, disabled = false }) => {
  const [session, setSession] = useState<VoiceDictationSession | null>(null);
  const [lang, setLang] = useState<VoiceDictationLang>('zh-CN');
  const [autoPunct, setAutoPunct] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<VoiceDictationSession['history']>([]);
  const [interimDisplay, setInterimDisplay] = useState('');
  const [section, setSection] = useState<SectionKey>('full');
  const [speaker, setSpeaker] = useState<SpeakerKey>('resident');
  const [speakerHistory, setSpeakerHistory] = useState<{ speaker: string; time: Date }[]>([]);
  const [showVocab, setShowVocab] = useState(false);
  const recognitionRef = useRef<any>(null);
  const startTimeRef = useRef<number>(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaChunksRef = useRef<Blob[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef<VoiceDictationSession | null>(null);

  // 检查浏览器支持
  const isSupported = typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
  const isMediaRecorderSupported = typeof window !== 'undefined' && typeof window.MediaRecorder !== 'undefined';

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch { /* noop */ }
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try { mediaRecorderRef.current.stop(); } catch { /* noop */ }
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const handleSpeakerChange = useCallback((value: SpeakerKey) => {
    setSpeaker(value);
    setSpeakerHistory((prev) => [...prev, { speaker: SPEAKERS.find((s) => s.value === value)?.label ?? value, time: new Date() }]);
  }, []);

  // 停止录音后把真实 audio blob 交给后端转写(Phase 1.4 真实链路)
  const handleTranscribe = useCallback(async () => {
    const blob = new Blob(mediaChunksRef.current, { type: mediaRecorderRef.current?.mimeType || 'audio/webm' });
    const durationSec = Math.max(1, Math.round((Date.now() - startTimeRef.current) / 1000));
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
    mediaRecorderRef.current = null;
    mediaChunksRef.current = [];

    const current = sessionRef.current;
    if (!current) return;
    if (blob.size === 0) {
      const nextIdle = { ...current, state: 'idle' as const };
      sessionRef.current = nextIdle;
      setSession(nextIdle);
      return;
    }

    const nextProcessing = { ...current, state: 'processing' as const, interimText: '正在转写音频...' };
    sessionRef.current = nextProcessing;
    setSession(nextProcessing);
    setInterimDisplay('正在转写音频...');
    try {
      const res = await asrApi.transcribe(blob, durationSec, lang);
      const nextDone = {
        ...current,
        finalText: res.text,
        interimText: '',
        state: 'idle' as const,
        endedAt: new Date().toISOString(),
        totalDurationSec: res.duration,
        totalWords: res.text.replace(/\s/g, '').length,
        segments: res.segments.map((seg) => ({
          start: seg.start * 1000,
          end: seg.end * 1000,
          text: seg.text,
          confidence: seg.confidence,
        })),
      };
      sessionRef.current = nextDone;
      setSession(nextDone);
      setInterimDisplay('');
      onTextChange?.(res.text);
      message.success(`转写完成(${res.engine}引擎,置信度 ${(res.confidence * 100).toFixed(0)}%)`);
    } catch (e) {
      console.error('transcribe failed:', e);
      const nextError = { ...current, state: 'error' as const, interimText: '' };
      sessionRef.current = nextError;
      setSession(nextError);
      setInterimDisplay('');
      message.error('语音转写失败,请重试');
    }
  }, [lang, onTextChange]);

  const start = useCallback(async () => {
    if (disabled) return;
    if (!isSupported && !isMediaRecorderSupported) {
      message.warning('当前浏览器不支持语音识别,已使用 mock 模式');
    }
    const newSession = await startVoiceDictation(reportId, lang);
    sessionRef.current = newSession;
    setSession(newSession);
    setInterimDisplay('');
    startTimeRef.current = Date.now();

    // 优先真实链路:MediaRecorder 录音 → blob 上传 → 后端转写
    if (isMediaRecorderSupported) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;
        const recorder = new MediaRecorder(stream);
        mediaRecorderRef.current = recorder;
        mediaChunksRef.current = [];
        recorder.ondataavailable = (e: BlobEvent) => {
          if (e.data.size > 0) mediaChunksRef.current.push(e.data);
        };
        recorder.onstop = () => { void handleTranscribe(); };
        recorder.start();
        const nextListening = { ...newSession, state: 'listening' as const };
        sessionRef.current = nextListening;
        setSession(nextListening);
        return;
      } catch (e) {
        console.warn('MediaRecorder 启动失败,回退 Web Speech / mock:', e);
      }
    }

    // 真实 Web Speech API
    if (isSupported) {
      const SR = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      const recognition = new SR();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = lang;
      recognition.onresult = (event: any) => {
        let interim = '';
        let final = newSession.finalText;
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            final += (autoPunct ? autoPunctuate(transcript) : transcript);
          } else {
            interim += transcript;
          }
        }
        setInterimDisplay(interim);
        setSession((s) => s ? { ...s, finalText: final, interimText: interim, segments: [...s.segments, { start: Date.now() - startTimeRef.current, end: Date.now() - startTimeRef.current, text: final, confidence: 0.9 }] } : s);
        onTextChange?.(final);
      };
      recognition.onerror = (e: any) => {
        message.error(`识别错误: ${e.error}`);
      };
      recognition.onend = () => {
        if (recognitionRef.current && session?.state === 'listening') {
          try { recognition.start(); } catch { /* noop */ }
        }
      };
      recognitionRef.current = recognition;
      try { recognition.start(); } catch (e) { message.error('启动语音识别失败'); }
    } else {
      // Mock 模式 - 模拟识别
      mockRecognitionLoop(newSession);
    }
  }, [reportId, lang, autoPunct, isSupported, isMediaRecorderSupported, disabled, session?.state, onTextChange, handleTranscribe]);

  const mockRecognitionLoop = (initialSession: VoiceDictationSession) => {
    const MOCK_PHRASES = [
      '胸部 CT 平扫 + 增强所见,',
      '双侧胸廓对称,',
      '双肺纹理清晰,走行自然。',
      '右肺上叶尖段见一不规则形软组织密度结节,',
      '大小约 18 毫米乘 15 毫米。',
    ];
    let i = 0;
    const interval = setInterval(() => {
      if (i >= MOCK_PHRASES.length || !recognitionRef.current) {
        clearInterval(interval);
        return;
      }
      const phrase = MOCK_PHRASES[i] ?? '';
      setInterimDisplay(phrase);
      setSession((s) => s ? { ...s, finalText: s.finalText + phrase, interimText: phrase, segments: [...s.segments, { start: Date.now() - startTimeRef.current, end: Date.now() - startTimeRef.current, text: phrase, confidence: 0.85 + Math.random() * 0.1 }] } : s);
      onTextChange?.(initialSession.finalText + MOCK_PHRASES.slice(0, i + 1).join(''));
      i++;
    }, 1500);
    recognitionRef.current = { stop: () => { clearInterval(interval); } };
  };

  const pause = useCallback(async () => {
    if (!session) return;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try { mediaRecorderRef.current.pause(); } catch { /* noop */ }
    } else if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* noop */ }
    }
    const r = await pauseVoiceDictation(session.id);
    const nextPaused = { ...session, state: r.state };
    sessionRef.current = nextPaused;
    setSession(nextPaused);
  }, [session]);

  const resume = useCallback(async () => {
    if (!session) return;
    const r = await resumeVoiceDictation(session.id);
    const nextResumed = { ...session, state: r.state };
    sessionRef.current = nextResumed;
    setSession(nextResumed);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      try { mediaRecorderRef.current.resume(); } catch { /* noop */ }
    } else if (recognitionRef.current && isSupported) {
      try { recognitionRef.current.start(); } catch { /* noop */ }
    }
  }, [session, isSupported]);

  const stop = useCallback(async () => {
    if (!session) return;
    // MediaRecorder 路径:stop() 触发 onstop → handleTranscribe 上传真实音频
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
        return;
      } catch { /* noop */ }
    }
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* noop */ }
    }
    const r = await stopVoiceDictation(session.id);
    const nextStopped = { ...session, state: r.state, endedAt: new Date().toISOString(), totalDurationSec: r.durationSec, totalWords: r.totalWords };
    sessionRef.current = nextStopped;
    setSession(nextStopped);
    message.success(`已停止,共识别 ${r.totalWords} 词,耗时 ${r.durationSec} 秒`);
  }, [session]);

  const insert = useCallback(() => {
    if (!session) return;
    onInsert?.(session.finalText);
    message.success('已插入到编辑器');
  }, [session, onInsert]);

  const clearAll = useCallback(() => {
    setSession((s) => s ? { ...s, finalText: '', interimText: '', segments: [] } : s);
    setInterimDisplay('');
    message.success('已清空');
  }, []);

  const loadHistory = useCallback(async () => {
    const h = await getVoiceDictationHistory(reportId);
    setHistory(h);
    setShowHistory(true);
  }, [reportId]);

  if (!isSupported) {
    // 继续渲染,只是用 mock
  }

  const duration = session ? Math.floor((Date.now() - startTimeRef.current) / 1000) : 0;
  const state = session?.state ?? 'idle';

  return (
    <Card
      size="small"
      className="shadow-sm"
      title={
        <div className="flex items-center justify-between">
          <Space>
            <Volume2 className="w-4 h-4" style={{ color: state === 'listening' ? '#dc2626' : '#94a3b8' }} />
            <span className="font-semibold">语音听写</span>
            <Tag color={state === 'listening' ? 'red' : state === 'paused' ? 'orange' : 'default'}>
              {({ idle: '待机', listening: '聆听中', paused: '已暂停', processing: '处理中', error: '错误' } as const)[state as VoiceDictationState] ?? state}
            </Tag>
            {!isSupported && <Tag color="orange">mock 模式</Tag>}
          </Space>
          <Space>
            <Button size="small" icon={<BookOpen className="w-3 h-3" />} onClick={() => setShowVocab(true)}>词汇</Button>
            <Button size="small" icon={<History className="w-3 h-3" />} onClick={loadHistory}>历史</Button>
          </Space>
        </div>
      }
    >
      {!isSupported && (
        <Alert type="info" showIcon className="mb-3" title="当前浏览器不支持 Web Speech API,使用 Mock 模拟识别过程" />
      )}

      <div className="space-y-3">
        {/* 1. 段落选择 */}
        <div>
          <div className="text-xs font-semibold text-slate-600 mb-1">目标段落</div>
          <Space wrap>
            {SECTIONS.map((s) => (
              <Tag.CheckableTag
                key={s.key}
                checked={section === s.key}
                onChange={() => setSection(s.key)}
                className="text-xs px-3 py-0.5"
              >
                {s.label}
              </Tag.CheckableTag>
            ))}
          </Space>
        </div>

        {/* 2. 多说话人 + 语言 + 自动标点 */}
        <Row gutter={8} align="middle">
          <Col span={8}>
            <Space>
              <User className="w-3 h-3 text-slate-400" />
              <Select
                size="small"
                value={speaker}
                onChange={handleSpeakerChange}
                style={{ width: 110 }}
                options={SPEAKERS.map((s) => ({ value: s.value, label: s.label }))}
                disabled={state === 'listening'}
              />
            </Space>
          </Col>
          <Col span={8}>
            <Select
              size="small"
              value={lang}
              onChange={setLang}
              style={{ width: '100%' }}
              options={LANG_OPTIONS}
              disabled={state === 'listening'}
            />
          </Col>
          <Col span={8}>
            <Space>
              <span className="text-xs text-slate-500">自动标点</span>
              <Switch size="small" checked={autoPunct} onChange={setAutoPunct} disabled={state === 'listening'} />
            </Space>
          </Col>
        </Row>

        {speakerHistory.length > 0 && (
          <div className="text-[10px] text-slate-400">
            当前说话人: {SPEAKERS.find((s) => s.value === speaker)?.label} · 切换 {speakerHistory.length} 次
          </div>
        )}

        {/* 3. 统计 */}
        <Row gutter={8}>
          <Col span={6}><Statistic title="时长" value={duration} suffix="s" prefix={<Clock className="w-3 h-3" />} styles={{ content: {  fontSize: 14  } }} /></Col>
          <Col span={6}><Statistic title="词数" value={session?.totalWords ?? 0} prefix={<Type className="w-3 h-3" />} styles={{ content: {  fontSize: 14  } }} /></Col>
          <Col span={6}><Statistic title="分段" value={session?.segments.length ?? 0} prefix={<FileText className="w-3 h-3" />} styles={{ content: {  fontSize: 14  } }} /></Col>
          <Col span={6}><Statistic title="重试" value={0} prefix={<Activity className="w-3 h-3" />} styles={{ content: {  fontSize: 14  } }} /></Col>
        </Row>

        {/* 4. 识别文本显示 */}
        <div className="bg-slate-50 border border-slate-200 rounded p-3 min-h-[120px] max-h-48 overflow-y-auto">
          {session?.finalText ? (
            <div className="text-sm text-slate-800 whitespace-pre-wrap">{session.finalText}</div>
          ) : (
            <div className="text-sm text-slate-400 text-center py-8">点击"开始"按钮开始语音听写...</div>
          )}
          {interimDisplay && (
            <div className="text-sm text-slate-500 italic mt-2 border-t border-dashed border-slate-300 pt-2">
              {interimDisplay}
            </div>
          )}
        </div>

        {/* 5. 控制按钮 */}
        <div className="flex items-center justify-center gap-2">
          {state === 'idle' && (
            <Button type="primary" danger size="large" icon={<Mic className="w-5 h-5" />} onClick={start} disabled={disabled}>
              开始听写
            </Button>
          )}
          {state === 'listening' && (
            <>
              <Button type="primary" icon={<MicOff className="w-4 h-4" />} onClick={pause}>暂停</Button>
              <Button danger icon={<Square className="w-4 h-4" />} onClick={stop}>停止</Button>
            </>
          )}
          {state === 'paused' && (
            <>
              <Button type="primary" icon={<Mic className="w-4 h-4" />} onClick={resume}>继续</Button>
              <Button danger icon={<Square className="w-4 h-4" />} onClick={stop}>停止</Button>
            </>
          )}
        </div>

        {/* 6. 插入/清空 */}
        {session && session.finalText && (
          <div className="flex items-center gap-2">
            <Button type="primary" icon={<ChevronRight className="w-4 h-4" />} onClick={insert}>插入到编辑器</Button>
            <Button icon={<Trash2 className="w-4 h-4" />} onClick={clearAll}>清空</Button>
          </div>
        )}

        {/* 7. 语音命令帮助面板(可折叠) */}
        <Collapse
          size="small"
          items={[
            {
              key: 'voice-commands',
              label: (
                <span className="flex items-center gap-1 text-xs font-semibold text-slate-600">
                  <Command className="w-3 h-3" />语音命令帮助
                </span>
              ),
              children: (
                <div>
                  <Table
                    dataSource={VOICE_COMMAND_TABLE_DATA}
                    columns={VOICE_COMMAND_TABLE_COLUMNS}
                    size="small"
                    pagination={false}
                    rowKey="command"
                  />
                  <div className="mt-2 pt-2 border-t border-slate-100">
                    <span className="text-xs text-slate-500">快捷短语:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {VOICE_COMMANDS.map((c) => (
                        <Tag key={c.command} color="cyan" className="text-xs">
                          "{c.command}" → {c.action}
                        </Tag>
                      ))}
                    </div>
                  </div>
                </div>
              ),
            },
          ]}
        />

        {/* 8. 识别段落 */}
        {session && session.segments.length > 0 && (
          <div className="border-t border-slate-200 pt-3 max-h-32 overflow-y-auto">
            <h5 className="text-xs font-semibold text-slate-600 mb-2">识别段落 ({session.segments.length})</h5>
            <div className="space-y-1">
              {session.segments.slice(-5).map((seg, i) => (
                <div key={i} className="text-xs p-1 bg-white border border-slate-200 rounded">
                  <div className="text-slate-700">{seg.text}</div>
                  <div className="text-slate-400 text-[10px] mt-0.5">
                    {(seg.start / 1000).toFixed(1)}s ~ {(seg.end / 1000).toFixed(1)}s · 置信度 {(seg.confidence * 100).toFixed(0)}%
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 9. 医学术语词汇 Modal */}
      <Modal title="医学术语词汇" open={showVocab} onCancel={() => setShowVocab(false)} footer={null} width={520}>
        <Table
          dataSource={MEDICAL_VOCAB}
          columns={VOCAB_COLUMNS}
          size="small"
          pagination={false}
          rowKey="term"
        />
      </Modal>

      {/* 10. 语音听写历史 Modal */}
      <Modal title="语音听写历史" open={showHistory} onCancel={() => setShowHistory(false)} footer={null} width={600}>
        {history.length > 0 ? (
          <List
            dataSource={history}
            renderItem={(item) => (
              <List.Item
                actions={[<Button key="insert" size="small" type="primary" onClick={() => { onInsert?.(item.text); setShowHistory(false); }}>插入</Button>]}
              >
                <List.Item.Meta
                  title={<div className="text-sm">{item.text}</div>}
                  description={<div className="text-xs text-slate-500">{new Date(item.createdAt).toLocaleString()}</div>}
                />
              </List.Item>
            )}
          />
        ) : (
          <Empty description="暂无历史" />
        )}
      </Modal>
    </Card>
  );
};

// 简易自动标点
function autoPunctuate(text: string): string {
  let t = text.trim();
  if (!t) return t;
  if (!/[.,;:。,;;!?,]$/.test(t)) {
    t += '。';
  }
  return t + ' ';
}

export default VoiceDictation;
