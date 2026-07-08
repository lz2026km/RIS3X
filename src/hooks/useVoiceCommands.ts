/**
 * G005 放射RIS系统 v3.0.6.5 - 语音命令 Hook
 * 20 升级点:命令识别 / 上下文 / 触发回调
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { voiceCommandEngine } from '../../services/voice/commands/VoiceCommandEngine';
import type {
  VoiceCommandDefinition,
  VoiceCommandMatch,
  VoiceCommandContext,
  VoiceCommandAction,
} from '../../types/voice';

export interface UseVoiceCommandsOptions {
  context?: Partial<VoiceCommandContext>;
  onMatch?: (match: VoiceCommandMatch) => void;
  onAction?: (action: { action: VoiceCommandAction; payload?: Record<string, string>; matches: VoiceCommandMatch[] }) => void;
  autoApply?: boolean;
  enabled?: boolean;
}

export interface UseVoiceCommandsResult {
  matches: VoiceCommandMatch[];
  recentCommands: VoiceCommandDefinition[];
  availableCommands: VoiceCommandDefinition[];
  setContext: (ctx: Partial<VoiceCommandContext>) => void;
  getContext: () => VoiceCommandContext;
  processText: (text: string) => { text: string; matches: VoiceCommandMatch[]; actions: { action: VoiceCommandAction; payload?: Record<string, string> }[] };
  clear: () => void;
  enabled: boolean;
  setEnabled: (v: boolean) => void;
}

export function useVoiceCommands(options: UseVoiceCommandsOptions = {}): UseVoiceCommandsResult {
  const { context, onMatch, onAction, autoApply = false, enabled: enabledInit = true } = options;
  const [matches, setMatches] = useState<VoiceCommandMatch[]>([]);
  const [recent, setRecent] = useState<VoiceCommandDefinition[]>([]);
  const [enabled, setEnabled] = useState(enabledInit);
  const ctxRef = useRef(context);

  useEffect(() => {
    if (context) {
      voiceCommandEngine.setContext(context);
      ctxRef.current = context;
    }
  }, [context]);

  useEffect(() => {
    const refresh = () => {
      setRecent(voiceCommandEngine.getRecentCommands());
    };
    const i = window.setInterval(refresh, 1000);
    return () => window.clearInterval(i);
  }, []);

  const processText = useCallback((text: string) => {
    if (!enabled || !text) return { text, matches: [], actions: [] };
    const r = voiceCommandEngine.process(text, '');
    setMatches(r.matches);
    r.matches.forEach((m: VoiceCommandMatch) => onMatch?.(m));
    if (autoApply && r.actions.length > 0) {
      onAction?.({ action: r.actions[0]?.action ?? 'insert-text', payload: r.actions[0]?.payload, matches: r.matches });
    }
    return r;
  }, [enabled, onMatch, onAction, autoApply]);

  const available = useMemo(() => voiceCommandEngine.getRecentCommands(), []);

  return {
    matches,
    recentCommands: recent,
    availableCommands: available,
    setContext: (c) => voiceCommandEngine.setContext(c),
    getContext: () => voiceCommandEngine.getContext(),
    processText,
    clear: () => setMatches([]),
    enabled,
    setEnabled,
  };
}
