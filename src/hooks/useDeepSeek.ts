// ============================================================
// G005 放射RIS系统 v2.1.0 - useDeepSeek React Hook
// Phase R11 W9: 流式 + Vision + 历史
// ============================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DeepSeekClient, createDeepSeekFromEnv, type Message, type CompletionResponse } from '../services/deepseek';
import { buildReportGenerationPrompt, type RadiologyContext, buildReportSummaryPrompt, buildReportTranslationPrompt, buildQualityCheckPrompt, buildRadsAssessmentPrompt, buildPhraseExpansionPrompt, buildVisionAnalysisPrompt, buildDifferentialPrompt } from '../services/deepseekPrompts';

export type LLMTask = 'generate' | 'summarize' | 'translate' | 'quality' | 'rads' | 'expand' | 'vision' | 'differential' | 'custom';

export interface UseDeepSeekOptions {
  client?: DeepSeekClient;
  autoInit?: boolean;
  defaultModel?: string;
  onError?: (err: Error) => void;
}

export interface UseDeepSeekResult {
  // 状态
  ready: boolean;
  streaming: boolean;
  output: string;
  error: string | null;
  usage: { prompt: number; completion: number; total: number } | null;
  history: Array<{ task: LLMTask; input: string; output: string; ts: number; durationMs: number }>;
  // 控制
  cancel: () => void;
  reset: () => void;
  // 任务
  runTask: (task: LLMTask, opts: TaskOptions) => Promise<string>;
  // 低阶
  chat: (messages: Message[], opts?: { model?: string; stream?: boolean }) => Promise<string>;
  vision: (text: string, images: Array<{ url: string }>, ctx?: RadiologyContext) => Promise<string>;
}

export interface TaskOptions {
  context?: RadiologyContext;
  text?: string;
  images?: Array<{ url: string; detail?: 'low' | 'high' | 'auto' }>;
  systemPrompt?: string;
  userPrompt?: string;
  temperature?: number;
  maxTokens?: number;
}

export function useDeepSeek(opts: UseDeepSeekOptions = {}): UseDeepSeekResult {
  const [ready, setReady] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<{ prompt: number; completion: number; total: number } | null>(null);
  const [history, setHistory] = useState<UseDeepSeekResult['history']>([]);
  const clientRef = useRef<DeepSeekClient | null>(opts.client ?? null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (opts.client) {
      clientRef.current = opts.client;
      setReady(true);
      return;
    }
    if (opts.autoInit !== false) {
      try {
        clientRef.current = createDeepSeekFromEnv();
        setReady(true);
      } catch (e) {
        setError((e as Error).message);
        setReady(false);
      }
    }
  }, [opts.client, opts.autoInit]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
  }, []);

  const reset = useCallback(() => {
    cancel();
    setOutput('');
    setError(null);
    setUsage(null);
  }, [cancel]);

  const runStream = useCallback(async (messages: Message[], task: LLMTask, startedAt: number, model?: string, temperature?: number, maxTokens?: number) => {
    const client = clientRef.current;
    if (!client) { setError('Client not initialized'); return ''; }
    abortRef.current = new AbortController();
    setStreaming(true);
    setError(null);
    setOutput('');
    setUsage(null);
    let acc = '';
    let promptTok = 0;
    let completionTok = 0;
    let totalTok = 0;
    try {
      // 估算 prompt tokens
      promptTok = Math.ceil(messages.reduce((s, m) => s + (typeof m.content === 'string' ? m.content.length : JSON.stringify(m.content).length), 0) / 4);
      for await (const chunk of client.stream({ messages, model, temperature, max_tokens: maxTokens, stream: true })) {
        if (abortRef.current?.signal.aborted) break;
        const delta = chunk.choices?.[0]?.delta?.content ?? '';
        if (delta) {
          acc += delta;
          setOutput(acc);
        }
      }
      completionTok = Math.ceil(acc.length / 4);
      totalTok = promptTok + completionTok;
      setUsage({ prompt: promptTok, completion: completionTok, total: totalTok });
      setHistory(h => [...h, { task, input: messages.map(m => typeof m.content === 'string' ? m.content : '[multimodal]').join('\n').slice(0, 200), output: acc, ts: Date.now(), durationMs: Date.now() - startedAt }]);
      return acc;
    } catch (e) {
      const err = e as Error;
      if (err.name !== 'AbortError') {
        setError(err.message);
        opts.onError?.(err);
      }
      return acc;
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }, [opts]);

  const runTask = useCallback(async (task: LLMTask, o: TaskOptions): Promise<string> => {
    const startedAt = Date.now();
    let messages: Message[] = [];
    let model: string | undefined;
    switch (task) {
      case 'generate':
        if (!o.context) throw new Error('context required for generate');
        messages = buildReportGenerationPrompt(o.context);
        break;
      case 'summarize':
        if (!o.text) throw new Error('text required for summarize');
        messages = buildReportSummaryPrompt(o.text);
        break;
      case 'translate':
        if (!o.text) throw new Error('text required for translate');
        messages = buildReportTranslationPrompt(o.text);
        break;
      case 'quality':
        if (!o.text || !o.context) throw new Error('text + context required for quality');
        messages = buildQualityCheckPrompt(o.text, o.context);
        break;
      case 'rads':
        if (!o.text) throw new Error('text required for rads');
        messages = buildRadsAssessmentPrompt(o.text);
        break;
      case 'expand':
        if (!o.text) throw new Error('text required for expand');
        messages = buildPhraseExpansionPrompt(o.text, o.context);
        break;
      case 'vision': {
        if (!o.context) throw new Error('context required for vision');
        if (!o.images || o.images.length === 0) throw new Error('images required for vision');
        messages = buildVisionAnalysisPrompt(o.context, o.text);
        model = (clientRef.current && (clientRef.current as unknown as { config?: { visionModel?: string } }).config?.visionModel) || undefined;
        const client = clientRef.current;
        if (!client) throw new Error('Client not initialized');
        const r: CompletionResponse = await client.vision({ text: o.text ?? '请分析', images: o.images, systemPrompt: messages[0]?.content.toString() });
        const out = r.choices[0]?.message.content?.toString() ?? '';
        setOutput(out);
        setUsage({ prompt: r.usage.prompt_tokens, completion: r.usage.completion_tokens, total: r.usage.total_tokens });
        setHistory(h => [...h, { task, input: `[vision ${o.images!.length} images]`, output: out, ts: Date.now(), durationMs: Date.now() - startedAt }]);
        return out;
      }
      case 'differential':
        if (!o.text || !o.context) throw new Error('text + context required for differential');
        messages = buildDifferentialPrompt(o.text, o.context);
        break;
      case 'custom':
        if (o.systemPrompt) messages.push({ role: 'system', content: o.systemPrompt });
        if (o.userPrompt) messages.push({ role: 'user', content: o.userPrompt });
        else if (o.text) messages.push({ role: 'user', content: o.text });
        break;
    }
    if (messages.length === 0) throw new Error(`No messages for task ${task}`);
    return runStream(messages, task, startedAt, model, o.temperature, o.maxTokens);
  }, [runStream]);

  const chat = useCallback(async (messages: Message[], co?: { model?: string; stream?: boolean }): Promise<string> => {
    const startedAt = Date.now();
    if (co?.stream === false) {
      const client = clientRef.current;
      if (!client) throw new Error('Client not initialized');
      const r = await client.completion({ messages, model: co.model });
      const out = r.choices[0]?.message.content?.toString() ?? '';
      setOutput(out);
      setHistory(h => [...h, { task: 'custom', input: messages.map(m => m.content.toString()).join('\n').slice(0, 200), output: out, ts: Date.now(), durationMs: Date.now() - startedAt }]);
      return out;
    }
    return runStream(messages, 'custom', startedAt, co?.model);
  }, [runStream]);

  const vision = useCallback(async (text: string, images: Array<{ url: string }>, ctx?: RadiologyContext): Promise<string> => {
    return runTask('vision', { text, images, context: ctx });
  }, [runTask]);

  return useMemo(() => ({
    ready, streaming, output, error, usage, history,
    cancel, reset, runTask, chat, vision,
  }), [ready, streaming, output, error, usage, history, cancel, reset, runTask, chat, vision]);
}
