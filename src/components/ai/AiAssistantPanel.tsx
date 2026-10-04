// ============================================================
// G005 放射RIS系统 v3.0.6.5 - AI 助手 UI
// Phase R11 W9: LLM 报告生成/摘要/翻译面板
// Phase R3.AI-ORCH: 新增 Marketplace Tab
// ============================================================

import React, { useState } from 'react';
import { Bot, Loader2, CheckCircle2, Play } from 'lucide-react';
import { useDeepSeek, type LLMTask } from '../../hooks/useDeepSeek';
import type { RadiologyContext } from '../../services/deepseekPrompts';
import { aiService } from '../../services/ai/aiService';

export interface AiAssistantPanelProps {
  context: RadiologyContext;
  currentReport?: string;
  onApply?: (text: string) => void;
  height?: number;
}

const TASK_LABELS: Record<LLMTask, string> = {
  generate: '生成报告',
  summarize: '报告摘要',
  translate: '中→英翻译',
  quality: '质控检查',
  rads: 'RADS 分级',
  expand: '短语扩写',
  vision: '影像分析',
  differential: '鉴别诊断',
  custom: '自定义',
};

const PANEL_TABS = ['tasks', 'marketplace'] as const;
type PanelTab = (typeof PANEL_TABS)[number];

const PANEL_TAB_LABELS: Record<PanelTab, string> = {
  tasks: '任务',
  marketplace: '算法市场',
};

export default function AiAssistantPanel({ context, currentReport = '', onApply, height = 480 }: AiAssistantPanelProps) {
  const [tab, setTab] = useState<PanelTab>('tasks');
  const [marketplaceState, setMarketplaceState] = useState<{ listings: { algorithm: { id: string; name: string; vendor: string; type: string; modality: string[]; accuracy: number }; installed: boolean }[]; loading: boolean }>({ listings: [], loading: false });
  const llm = useDeepSeek();
  const [task, setTask] = useState<LLMTask>('generate');
  const [phrase, setPhrase] = useState('');

  const loadMarketplace = async () => {
    setMarketplaceState((s) => ({ ...s, loading: true }));
    try {
      const ms = aiService.getMarketplace();
      const list = await ms.listAlgorithms();
      setMarketplaceState({ listings: list.map((l) => ({ algorithm: { id: l.algorithm.id, name: l.algorithm.name, vendor: l.algorithm.vendor, type: l.algorithm.type, modality: l.algorithm.modality, accuracy: l.algorithm.accuracy }, installed: l.algorithm.installed })), loading: false });
    } catch {
      setMarketplaceState((s) => ({ ...s, loading: false }));
    }
  };

  React.useEffect(() => {
    if (tab === 'marketplace' && marketplaceState.listings.length === 0 && !marketplaceState.loading) {
      void loadMarketplace();
    }
  }, [tab]);

  const handleInstall = async (id: string) => {
    await aiService.getMarketplace().install(id);
    await loadMarketplace();
  };

  const runTask = async () => {
    const opts: Parameters<typeof llm.runTask>[1] = { context };
    if (task === 'generate' || task === 'vision' || task === 'differential') {
      opts.context = context;
    }
    if (task === 'summarize' || task === 'translate' || task === 'quality' || task === 'rads' || task === 'differential') {
      opts.text = currentReport;
    }
    if (task === 'expand') {
      opts.text = phrase;
    }
    await llm.runTask(task, opts);
  };

  return (
    <div data-testid="ai-assistant-panel" style={{ background: '#0f172a', color: '#e2e8f0', borderRadius: 8, padding: 12, height, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <Bot size={15} style={{ color: '#818cf8' }} />
        <span style={{ fontSize: 14, fontWeight: 600 }}>AI 助手</span>
        <span style={{ fontSize: 12, color: llm.ready ? '#10b981' : '#94a3b8' }}>{llm.ready ? 'DeepSeek 已就绪' : '未配置'}</span>
        <div style={{ flex: 1 }} />
        {tab === 'tasks' && (
          <>
            <button data-testid="ai-cancel-btn" onClick={llm.cancel} disabled={!llm.streaming} style={{ background: '#7f1d1d', color: 'white', border: 'none', borderRadius: 4, padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}>
              停止
            </button>
            <button data-testid="ai-reset-btn" onClick={llm.reset} style={{ background: '#334155', color: 'white', border: 'none', borderRadius: 4, padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}>
              清空
            </button>
          </>
        )}
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 10, borderBottom: '1px solid #334155' }}>
        {PANEL_TABS.map((t) => (
          <button
            key={t}
            data-testid={`ai-tab-${t}`}
            onClick={() => setTab(t)}
            style={{
              background: 'transparent',
              color: tab === t ? '#3b82f6' : '#94a3b8',
              border: 'none',
              borderBottom: tab === t ? '2px solid #3b82f6' : '2px solid transparent',
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: tab === t ? 600 : 400,
              cursor: 'pointer',
            }}
          >
            {PANEL_TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {tab === 'tasks' ? (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
            {(Object.keys(TASK_LABELS) as LLMTask[]).map(t => (
              <button
                key={t}
                data-testid={`ai-task-${t}`}
                onClick={() => setTask(t)}
                style={{
                  background: task === t ? '#3b82f6' : '#1e293b',
                  color: task === t ? 'white' : '#cbd5e1',
                  border: '1px solid #334155',
                  borderRadius: 14,
                  padding: '3px 10px',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                {TASK_LABELS[t]}
              </button>
            ))}
          </div>

          {task === 'expand' && (
            <input
              data-testid="ai-phrase-input"
              value={phrase}
              onChange={e => setPhrase(e.target.value)}
              placeholder="输入短语，如'右肺下叶斑片状高密度影'"
              style={{ background: '#1e293b', color: 'white', border: '1px solid #334155', borderRadius: 4, padding: 6, fontSize: 12, marginBottom: 8 }}
            />
          )}

          <button
            data-testid="ai-run-btn"
            onClick={runTask}
            disabled={llm.streaming}
            style={{
              background: llm.streaming ? '#64748b' : '#10b981',
              color: 'white', border: 'none', borderRadius: 4, padding: '8px 12px',
              fontSize: 12, cursor: llm.streaming ? 'not-allowed' : 'pointer', marginBottom: 10,
            }}
          >
            {llm.streaming ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Loader2 size={12} /> 生成中...</span>
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Play size={12} /> {TASK_LABELS[task]}</span>
            )}
          </button>

          <div data-testid="ai-output" style={{ flex: 1, background: '#020617', border: '1px solid #1e293b', borderRadius: 4, padding: 10, fontSize: 12, whiteSpace: 'pre-wrap', overflow: 'auto', fontFamily: 'ui-monospace, monospace' }}>
            {llm.error ? <span style={{ color: '#fca5a5' }}>错误: {llm.error}</span> : (llm.output || <span style={{ color: '#64748b' }}>输出将显示在此...</span>)}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, fontSize: 12, color: '#94a3b8' }}>
            {llm.usage && (
              <span data-testid="ai-usage">
                tokens: {llm.usage.total} (↑{llm.usage.prompt} ↓{llm.usage.completion})
              </span>
            )}
            {llm.streaming && <span data-testid="ai-streaming-badge" style={{ color: '#fbbf24' }}>● 流式中</span>}
            <div style={{ flex: 1 }} />
            {llm.output && onApply && (
              <button
                data-testid="ai-apply-btn"
                onClick={() => onApply(llm.output)}
                style={{ background: '#6366f1', color: 'white', border: 'none', borderRadius: 4, padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}
              >
                插入到报告
              </button>
            )}
          </div>

          {llm.history.length > 0 && (
            <details style={{ marginTop: 8, fontSize: 12, color: '#94a3b8' }}>
              <summary style={{ cursor: 'pointer' }}>历史 ({llm.history.length})</summary>
              <div style={{ maxHeight: 100, overflow: 'auto' }}>
                {llm.history.slice(-5).map((h, i) => (
                  <div key={i} style={{ padding: '2px 0', borderBottom: '1px solid #1e293b' }}>
                    [{TASK_LABELS[h.task]}] {h.durationMs}ms · {h.output.length} 字符
                  </div>
                ))}
              </div>
            </details>
          )}
        </>
      ) : (
        <div data-testid="ai-marketplace-tab" style={{ flex: 1, overflow: 'auto' }}>
          {marketplaceState.loading ? (
            <div style={{ textAlign: 'center', padding: 20, color: '#94a3b8' }}>加载中...</div>
          ) : (
            <div>
              {marketplaceState.listings.slice(0, 15).map((l) => (
                <div key={l.algorithm.id} style={{ background: '#020617', border: '1px solid #1e293b', borderRadius: 4, padding: 8, marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#f1f5f9' }}>{l.algorithm.name}</div>
                      <div style={{ fontSize: 12, color: '#94a3b8' }}>{l.algorithm.vendor} · {l.algorithm.type} · Acc {(l.algorithm.accuracy * 100).toFixed(0)}%</div>
                    </div>
                    {l.installed ? (
                      <span style={{ fontSize: 12, color: '#10b981', display: 'inline-flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={12} /> 已安装</span>
                    ) : (
                      <button
                        data-testid={`ai-install-${l.algorithm.id}`}
                        onClick={() => handleInstall(l.algorithm.id)}
                        style={{ background: '#3b82f6', color: 'white', border: 'none', borderRadius: 3, padding: '3px 8px', fontSize: 12, cursor: 'pointer' }}
                      >
                        安装
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
