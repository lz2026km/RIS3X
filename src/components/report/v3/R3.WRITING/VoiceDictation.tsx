/**
 * G005 放射RIS系统 v3.0.5.1 - 语音听写
 * R3.WRITING 组 C:语音听写 Pro(Web Speech API)
 * 20 升级点:实时识别 / 自动标点 / 分段 / 命令 / 历史 / 多语言
 * Expanded: 段落选择 / 多说话人 / 医学术语管理 / 命令面板
 */

import { asrApi } from '@services/api/asrApi';
import { voiceWorkstationApi } from '@services/api/voiceWorkstationApi';
import type { CorrectionItem, LexiconEntry } from '@services/api/voiceWorkstationApi';
import {
  startVoiceDictation, pauseVoiceDictation, resumeVoiceDictation, stopVoiceDictation,
  getVoiceDictationHistory,
} from '@services/writing/writingService';
import type { VoiceDictationSession, VoiceDictationLang } from '@/types/R3/R3.WRITING';
import { Card, Space, Button, Tag, Statistic, Select, Switch, message, Row, Col, Alert, Empty, List, Modal, Collapse } from 'antd';
import { DataTable } from '../../../common';
import { TableProps } from 'antd'
import { Mic, MicOff, Square, Volume2, Command, History, Trash2, Activity, FileText, Clock, ChevronRight, BookOpen, User , Type, CheckCircle } from 'lucide-react';
import { Inbox } from 'lucide-react'
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { t } from '../../../../i18n/appI18n';

interface Props {
  reportId: string;
  onTextChange?: (text: string) => void;
  onInsert?: (text: string) => void;
  disabled?: boolean;
}

// ---------- 语言 ----------

const LANG_OPTIONS = [
  { value: 'zh-CN', label: t('aiDraft.voice.lang.zh'), color: 'var(--color-error-600)' },
  { value: 'en-US', label: 'English', color: 'var(--color-primary-500)' },
  { value: 'zh-EN', label: t('aiDraft.voice.lang.mixed'), color: '#7c3aed' },
];

// ---------- 目标段落 ----------

const SECTIONS = [
  { key: 'findings', label: t('aiDraft.voice.section.findings') },
  { key: 'impression', label: t('aiDraft.voice.section.impression') },
  { key: 'diagnosis', label: t('aiDraft.voice.section.diagnosis') },
  { key: 'recommendation', label: t('aiDraft.voice.section.recommendation') },
  { key: 'full', label: t('aiDraft.voice.section.full') },
] as const;

type SectionKey = (typeof SECTIONS)[number]['key'];

// ---------- 多说话人 ----------

const SPEAKERS = [
  { value: 'resident', label: t('aiDraft.voice.speaker.resident') },
  { value: 'attending', label: t('aiDraft.voice.speaker.attending') },
  { value: 'transcriber', label: t('aiDraft.voice.speaker.transcriber') },
] as const;

type SpeakerKey = (typeof SPEAKERS)[number]['value'];

// ---------- 语音命令 ----------

const VOICE_COMMANDS = [
  { command: '换行', action: t('aiDraft.voice.cmd.newline') },
  { command: '新段落', action: t('aiDraft.voice.cmd.newParagraph') },
  { command: '删除', action: t('aiDraft.voice.cmd.deletePrev') },
  { command: '清除', action: t('aiDraft.voice.cmd.clearAll') },
  { command: '句号', action: t('aiDraft.voice.cmd.period') },
  { command: '逗号', action: t('aiDraft.voice.cmd.comma') },
  { command: '冒号', action: t('aiDraft.voice.cmd.colon') },
  { command: '左肺', action: t('aiDraft.voice.cmd.leftLung') },
  { command: '右肺', action: t('aiDraft.voice.cmd.rightLung') },
];

interface VoiceCommandTableItem {
  command: string;
  english: string;
  description: string;
}

const VOICE_COMMAND_TABLE_DATA: VoiceCommandTableItem[] = [
  { command: '新段落', english: 'New Paragraph', description: t('aiDraft.voice.tblDesc.newParagraph') },
  { command: '下一字段', english: 'Next Field', description: t('aiDraft.voice.tblDesc.nextField') },
  { command: '保存草稿', english: 'Save Draft', description: t('aiDraft.voice.tblDesc.saveDraft') },
  { command: '正常模板', english: 'Normal Template', description: t('aiDraft.voice.tblDesc.normalTemplate') },
  { command: '提交审核', english: 'Submit Report', description: t('aiDraft.voice.tblDesc.submitReport') },
];

const VOICE_COMMAND_TABLE_COLUMNS: TableProps<VoiceCommandTableItem>['columns'] = [
  { title: t('aiDraft.voice.col.command'), dataIndex: 'command', key: 'command', width: 100 },
  { title: 'English', dataIndex: 'english', key: 'english', width: 140 },
  { title: t('aiDraft.voice.col.description'), dataIndex: 'description', key: 'description' },
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
  { title: t('aiDraft.voice.col.term'), dataIndex: 'term', key: 'term', width: 100 },
  { title: t('aiDraft.voice.col.normalized'), dataIndex: 'normalized', key: 'normalized', width: 130 },
  { title: t('aiDraft.voice.col.category'), dataIndex: 'category', key: 'category', width: 100 },
  { title: t('aiDraft.voice.col.modality'), dataIndex: 'modality', key: 'modality', width: 60 },
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
  const [lexiconSize, setLexiconSize] = useState(0);
  const [onlineLexicon, setOnlineLexicon] = useState<LexiconEntry[] | null>(null);
  const [wsCorrections, setWsCorrections] = useState<CorrectionItem[]>([]);
  const [correctionSubmitted, setCorrectionSubmitted] = useState(false);
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

  // 医学词库: 加载规模用于校正提示, 失败静默 (不影响听写主链路)
  useEffect(() => {
    let cancelled = false;
    voiceWorkstationApi.listLexicon()
      .then((items) => { if (!cancelled) setLexiconSize(items.length); })
      .catch(() => { /* 词库不可用 */ });
    return () => { cancelled = true; };
  }, []);

  // 词汇面板打开时拉取在线词库 (失败回退静态词汇表)
  useEffect(() => {
    if (!showVocab) return;
    let cancelled = false;
    voiceWorkstationApi.listLexicon()
      .then((items) => { if (!cancelled) setOnlineLexicon(items); })
      .catch(() => { if (!cancelled) setOnlineLexicon(null); });
    return () => { cancelled = true; };
  }, [showVocab]);

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

    const nextProcessing = { ...current, state: 'processing' as const, interimText: t('aiDraft.voice.transcribing') };
    sessionRef.current = nextProcessing;
    setSession(nextProcessing);
    setInterimDisplay(t('aiDraft.voice.transcribing'));
    try {
      const res = await asrApi.transcribe(blob, durationSec, lang);
      // 词库校正: 同音词纠正 + corrections[] 提示
      let finalText = res.text;
      let corrections: CorrectionItem[] = [];
      try {
        const wsRes = await voiceWorkstationApi.transcribe({ text: res.text, reportId });
        finalText = wsRes.correctedText;
        corrections = wsRes.corrections;
      } catch (e) {
        console.warn('医学词库校正不可用,使用原始转写文本:', e);
      }
      setWsCorrections(corrections);
      setCorrectionSubmitted(false);
      const nextDone = {
        ...current,
        finalText,
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
      onTextChange?.(finalText);
      message.success(
        corrections.length > 0
          ? t('aiDraft.voice.transcribeDoneCorrected', { engine: res.engine, count: corrections.length })
          : t('aiDraft.voice.transcribeDone', { engine: res.engine, confidence: (res.confidence * 100).toFixed(0) }),
      );
    } catch (e) {
      console.error('transcribe failed:', e);
      const nextError = { ...current, state: 'error' as const, interimText: '' };
      sessionRef.current = nextError;
      setSession(nextError);
      setInterimDisplay('');
      message.error(t('aiDraft.voice.transcribeFailed'));
    }
  }, [lang, onTextChange]);

  const start = useCallback(async () => {
    if (disabled) return;
    if (!isSupported && !isMediaRecorderSupported) {
      message.warning(t('aiDraft.voice.unsupportedMock'));
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
        setSession((s: VoiceDictationSession | null) => s ? { ...s, finalText: final, interimText: interim, segments: [...s.segments, { start: Date.now() - startTimeRef.current, end: Date.now() - startTimeRef.current, text: final, confidence: 0.9 }] } : s);
        onTextChange?.(final);
      };
      recognition.onerror = (e: any) => {
        message.error(t('aiDraft.voice.recognizeError', { error: e.error }));
      };
      recognition.onend = () => {
        if (recognitionRef.current && session?.state === 'listening') {
          try { recognition.start(); } catch { /* noop */ }
        }
      };
      recognitionRef.current = recognition;
      try { recognition.start(); } catch (e) { message.error(t('aiDraft.voice.startFailed')); }
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
      setSession((s: VoiceDictationSession | null) => s ? { ...s, finalText: s.finalText + phrase, interimText: phrase, segments: [...s.segments, { start: Date.now() - startTimeRef.current, end: Date.now() - startTimeRef.current, text: phrase, confidence: 0.85 + Math.random() * 0.1 }] } : s);
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
    message.success(t('aiDraft.voice.stopped', { words: r.totalWords, seconds: r.durationSec }));
  }, [session]);

  const insert = useCallback(() => {
    if (!session) return;
    onInsert?.(session.finalText);
    message.success(t('aiDraft.voice.inserted'));
  }, [session, onInsert]);

  const clearAll = useCallback(() => {
    setSession((s: VoiceDictationSession | null) => s ? { ...s, finalText: '', interimText: '', segments: [] } : s);
    setInterimDisplay('');
    message.success(t('aiDraft.voice.cleared'));
  }, []);

  // 纠正反馈: 将本次校正结果提交给词库学习 (同音词积累为别名/新词条)
  const submitCorrections = useCallback(async () => {
    if (wsCorrections.length === 0) return;
    let ok = 0;
    for (const c of wsCorrections) {
      try {
        await voiceWorkstationApi.submitCorrection({ original: c.original, corrected: c.corrected });
        ok++;
      } catch { /* 单条失败不影响其余 */ }
    }
    if (ok > 0) {
      setCorrectionSubmitted(true);
      message.success(t('aiDraft.voice.correctionsSubmitted', { count: ok }));
    } else {
      message.error(t('aiDraft.voice.correctionsFailed'));
    }
  }, [wsCorrections]);

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
            <Volume2 className="w-4 h-4" style={{ color: state === 'listening' ? 'var(--color-error-600)' : '#94a3b8' }} />
            <span className="font-semibold">{t('aiDraft.voice.title')}</span>
            <Tag color={state === 'listening' ? 'red' : state === 'paused' ? 'orange' : 'default'}>
              {({ idle: t('aiDraft.voice.state.idle'), listening: t('aiDraft.voice.state.listening'), paused: t('aiDraft.voice.state.paused'), processing: t('aiDraft.voice.state.processing'), error: t('aiDraft.voice.state.error') } as Record<string, string>)[String(state)] ?? state}
            </Tag>
            {!isSupported && <Tag color="orange">{t('aiDraft.voice.mockMode')}</Tag>}
          </Space>
          <Space>
            <Button size="small" icon={<BookOpen className="w-3 h-3" />} onClick={() => setShowVocab(true)}>{t('aiDraft.voice.vocab')}</Button>
            <Button size="small" icon={<History className="w-3 h-3" />} onClick={loadHistory}>{t('aiDraft.voice.history')}</Button>
          </Space>
        </div>
      }
    >
      {!isSupported && (
        <Alert type="info" showIcon className="mb-3" title={t('aiDraft.voice.unsupportedAlert')} />
      )}

      <div className="space-y-3">
        {/* 1. 段落选择 */}
        <div>
          <div className="text-xs font-semibold text-slate-600 mb-1">{t('aiDraft.voice.targetSection')}</div>
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
              <span className="text-xs text-slate-500">{t('aiDraft.voice.autoPunct')}</span>
              <Switch size="small" checked={autoPunct} onChange={setAutoPunct} disabled={state === 'listening'} />
            </Space>
          </Col>
        </Row>

        {speakerHistory.length > 0 && (
          <div className="text-[10px] text-slate-400">
            {t('aiDraft.voice.currentSpeaker', { speaker: SPEAKERS.find((s) => s.value === speaker)?.label, count: speakerHistory.length })}
          </div>
        )}

        {/* 3. 统计 */}
        <Row gutter={8}>
          <Col span={6}><Statistic title={t('aiDraft.voice.stat.duration')} value={duration} suffix="s" prefix={<Clock className="w-3 h-3" />} styles={{ content: {  fontSize: 14  } }} /></Col>
          <Col span={6}><Statistic title={t('aiDraft.voice.stat.words')} value={session?.totalWords ?? 0} prefix={<Type className="w-3 h-3" />} styles={{ content: {  fontSize: 14  } }} /></Col>
          <Col span={6}><Statistic title={t('aiDraft.voice.stat.segments')} value={session?.segments.length ?? 0} prefix={<FileText className="w-3 h-3" />} styles={{ content: {  fontSize: 14  } }} /></Col>
          <Col span={6}><Statistic title={t('aiDraft.voice.stat.retries')} value={0} prefix={<Activity className="w-3 h-3" />} styles={{ content: {  fontSize: 14  } }} /></Col>
        </Row>

        {/* 4. 识别文本显示 */}
        <div className="bg-slate-50 border border-slate-200 rounded p-3 min-h-[120px] max-h-48 overflow-y-auto">
          {session?.finalText ? (
            <div className="text-sm text-slate-800 whitespace-pre-wrap">{session.finalText}</div>
          ) : (
            <div className="text-sm text-slate-400 text-center py-8">{t('aiDraft.voice.startHint')}</div>
          )}
          {interimDisplay && (
            <div className="text-sm text-slate-500 italic mt-2 border-t border-dashed border-slate-300 pt-2">
              {interimDisplay}
            </div>
          )}
        </div>

        {/* 4.5 医学词库校正提示 */}
        {wsCorrections.length > 0 && (
          <div className="border border-green-200 bg-green-50 rounded p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-green-700 flex items-center gap-1">
                <BookOpen className="w-3 h-3" />{t('aiDraft.voice.lexiconCorrections', { count: wsCorrections.length })}
              </span>
              <Tag color="green">{lexiconSize > 0 ? t('aiDraft.voice.lexiconEntries', { count: lexiconSize }) : t('aiDraft.voice.lexiconLoading')}</Tag>
            </div>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {wsCorrections.map((c, i) => (
                <div key={i} className="text-xs bg-white border border-green-100 rounded px-2 py-1 flex items-center gap-1.5">
                  <span className="text-red-500 line-through">{c.original}</span>
                  <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />
                  <span className="text-green-700 font-medium">{c.corrected}</span>
                  <Tag className="ml-auto shrink-0" color="cyan">{c.category}</Tag>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 mt-2">
              {!correctionSubmitted ? (
                <Button size="small" type="primary" ghost icon={<BookOpen className="w-3 h-3" />} onClick={submitCorrections}>
                  {t('aiDraft.voice.submitCorrections')}
                </Button>
              ) : (
                <span className="text-xs text-green-600 flex items-center gap-1"><CheckCircle className="w-3 h-3" />{t('aiDraft.voice.correctionsUpdated')}</span>
              )}
              <Button size="small" onClick={() => { setWsCorrections([]); }}>{t('aiDraft.voice.ignore')}</Button>
            </div>
          </div>
        )}

        {/* 5. 控制按钮 */}
        <div className="flex items-center justify-center gap-2">
          {state === 'idle' && (
            <Button type="primary" danger size="large" icon={<Mic className="w-5 h-5" />} onClick={start} disabled={disabled}>
              {t('aiDraft.voice.start')}
            </Button>
          )}
          {state === 'listening' && (
            <>
              <Button type="primary" icon={<MicOff className="w-4 h-4" />} onClick={pause}>{t('aiDraft.voice.pause')}</Button>
              <Button danger icon={<Square className="w-4 h-4" />} onClick={stop}>{t('aiDraft.voice.stop')}</Button>
            </>
          )}
          {state === 'paused' && (
            <>
              <Button type="primary" icon={<Mic className="w-4 h-4" />} onClick={resume}>{t('aiDraft.voice.resume')}</Button>
              <Button danger icon={<Square className="w-4 h-4" />} onClick={stop}>{t('aiDraft.voice.stop')}</Button>
            </>
          )}
        </div>

        {/* 6. 插入/清空 */}
        {session && session.finalText && (
          <div className="flex items-center gap-2">
            <Button type="primary" icon={<ChevronRight className="w-4 h-4" />} onClick={insert}>{t('aiDraft.voice.insertToEditor')}</Button>
            <Button icon={<Trash2 className="w-4 h-4" />} onClick={clearAll}>{t('aiDraft.voice.clear')}</Button>
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
                  <Command className="w-3 h-3" />{t('aiDraft.voice.commandHelp')}
                </span>
              ),
              children: (
                <div>
                  <DataTable
                    dataSource={VOICE_COMMAND_TABLE_DATA}
                    columns={VOICE_COMMAND_TABLE_COLUMNS}
                    pagination={false}
                    scroll={{ x: 'max-content' }}
                    rowKey="command"
                  />
                  <div className="mt-2 pt-2 border-t border-slate-100">
                    <span className="text-xs text-slate-500">{t('aiDraft.voice.quickPhrases')}</span>
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
            <h5 className="text-xs font-semibold text-slate-600 mb-2">{t('aiDraft.voice.recognizedSegments', { count: session.segments.length })}</h5>
            <div className="space-y-1">
              {session.segments.slice(-5).map((seg: { text: string; start: number; end: number; confidence: number }, i: number) => (
                <div key={i} className="text-xs p-1 bg-white border border-slate-200 rounded">
                  <div className="text-slate-700">{seg.text}</div>
                  <div className="text-slate-400 text-[10px] mt-0.5">
                    {(seg.start / 1000).toFixed(1)}s ~ {(seg.end / 1000).toFixed(1)}s · {t('aiDraft.voice.confidence')} {(seg.confidence * 100).toFixed(0)}%
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 9. 医学术语词汇 Modal (在线医学词库 + 静态回退) */}
      <Modal title={
        <span className="flex items-center gap-2">
          {t('aiDraft.voice.medicalVocab')}
          <Tag color="green">{onlineLexicon ? t('aiDraft.voice.lexiconEntries', { count: onlineLexicon.length }) : t('aiDraft.voice.onlineLoading')}</Tag>
        </span>
      } open={showVocab} onCancel={() => setShowVocab(false)} footer={null} width={640}>
        {onlineLexicon ? (
          <DataTable
            dataSource={onlineLexicon.slice(0, 100)}
            columns={[
              { title: t('aiDraft.voice.col.term'), dataIndex: 'term', key: 'term', width: 140 },
              { title: t('aiDraft.voice.col.categoryVocab'), dataIndex: 'category', key: 'category', width: 70, render: (v: string) => <Tag color="cyan">{v}</Tag> },
              { title: t('aiDraft.voice.col.priority'), dataIndex: 'priority', key: 'priority', width: 70 },
              { title: t('aiDraft.voice.col.aliases'), dataIndex: 'aliases', key: 'aliases', render: (v: string[]) => v.length > 0 ? v.join(' / ') : '-' },
            ]}
            pagination={{ pageSize: 10, showSizeChanger: false }}
            scroll={{ x: 'max-content' }}
            rowKey="id"
          />
        ) : (
          <DataTable
            dataSource={MEDICAL_VOCAB}
            columns={VOCAB_COLUMNS}
            pagination={false}
            scroll={{ x: 'max-content' }}
            rowKey="term"
          />
        )}
      </Modal>

      {/* 10. 语音听写历史 Modal */}
      <Modal title={t('aiDraft.voice.historyTitle')} open={showHistory} onCancel={() => setShowHistory(false)} footer={null} width={600}>
        {history.length > 0 ? (
          <List
            dataSource={history}
            renderItem={(item: { text: string; createdAt: string }) => (
              <List.Item
                actions={[<Button key="insert" size="small" type="primary" onClick={() => { onInsert?.(item.text); setShowHistory(false); }}>{t('aiDraft.voice.insert')}</Button>]}
              >
                <List.Item.Meta
                  title={<div className="text-sm">{item.text}</div>}
                  description={<div className="text-xs text-slate-500">{new Date(item.createdAt).toLocaleString()}</div>}
                />
              </List.Item>
            )}
          />
        ) : (
          <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t('aiDraft.voice.noHistory')} />
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
