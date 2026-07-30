// ============================================================
// G005 放射RIS系统 v2.0.0 - 语音听写 (Web Speech API)
// Phase R8 W4-C: 中文连续听写 + 字段级焦�?+ 语音命令
// ============================================================

import { useState, useCallback, useRef, useEffect } from 'react';

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export interface VoiceDictationOptions {
  lang?: string;               // 默认 'zh-CN'
  continuous?: boolean;        // 默认 true
  interimResults?: boolean;    // 默认 true
  onResult?: (transcript: string, isFinal: boolean) => void;
  onError?: (error: string) => void;
  onEnd?: () => void;
}

export interface VoiceState {
  isSupported: boolean;
  isListening: boolean;
  isPaused: boolean;
  transcript: string;
  interimTranscript: string;
  error: string | null;
  duration: number;
}

export function useVoiceDictation(options: VoiceDictationOptions = {}) {
  const {
    lang = 'zh-CN',
    continuous = true,
    interimResults = true,
    onResult,
    onError,
    onEnd,
  } = options;

  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);

  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  // 初始化检�?
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      setIsSupported(!!SR);
    }
  }, []);

  const start = useCallback(() => {
    if (!isSupported) {
      setError('当前浏览器不支持语音识别（请使用 Chrome/Edge�?);
      return;
    }
    if (isListening) return;

    try {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SR();
      recognition.lang = lang;
      recognition.continuous = continuous;
      recognition.interimResults = interimResults;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event: any) => {
        let interim = '';
        let final = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcriptPart = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            final += transcriptPart;
          } else {
            interim += transcriptPart;
          }
        }
        if (interim) {
          setInterimTranscript(interim);
          onResult?.(interim, false);
        }
        if (final) {
          setTranscript(prev => prev + final);
          setInterimTranscript('');
          onResult?.(final, true);
        }
      };

      recognition.onerror = (event: any) => {
        const errMsg = event.error || '未知错误';
        setError(errMsg);
        onError?.(errMsg);
        if (errMsg === 'no-speech' || errMsg === 'audio-capture') {
          // 自动重启
          setTimeout(() => {
            if (isListening) start();
          }, 1000);
        }
      };

      recognition.onend = () => {
        if (isListening && !isPaused) {
          // 自动重启（Chrome 自动停止后）
          try {
            recognition.start();
          } catch (e) {
            setIsListening(false);
            onEnd?.();
          }
        } else {
          setIsListening(false);
          onEnd?.();
        }
      };

      recognition.start();
      recognitionRef.current = recognition;
      setIsListening(true);
      setIsPaused(false);
      setError(null);
      setTranscript('');
      setInterimTranscript('');
      setDuration(0);
      startTimeRef.current = Date.now();

      timerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
    } catch (e: any) {
      setError(e.message || '启动失败');
      setIsListening(false);
    }
  }, [isSupported, isListening, isPaused, lang, continuous, interimResults, onResult, onError, onEnd]);

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) { console.warn('[F03] Error:', (e as Error)?.message); }
      recognitionRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsListening(false);
    setIsPaused(false);
  }, []);

  const pause = useCallback(() => {
    if (recognitionRef.current && isListening) {
      try { recognitionRef.current.stop(); } catch (e) { console.warn('[F03] Error:', (e as Error)?.message); }
      setIsPaused(true);
    }
  }, [isListening]);

  const resume = useCallback(() => {
    if (isPaused) start();
  }, [isPaused, start]);

  const reset = useCallback(() => {
    stop();
    setTranscript('');
    setInterimTranscript('');
    setDuration(0);
    setError(null);
  }, [stop]);

  useEffect(() => () => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) { console.warn('[F03] Error:', (e as Error)?.message); }
    }
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  return {
    isSupported,
    isListening,
    isPaused,
    transcript,
    interimTranscript,
    error,
    duration,
    start,
    stop,
    pause,
    resume,
    reset,
  };
}

// 语音命令处理（中文）
export function processVoiceCommand(text: string): { command: string; cleanText: string } {
  const commands: Array<{ pattern: RegExp; command: string }> = [
    { pattern: /^(换行|回车|另起一�?/, command: '\n' },
    { pattern: /(新段|新段落|另起一�?/, command: '\n\n' },
    { pattern: /^(冒号|分号)/, command: '�? },
    { pattern: /(句号|�?/, command: '�? },
    { pattern: /(逗号|�?/, command: '�? },
    { pattern: /^(删除)/, command: 'DELETE' },
  ];

  for (const { pattern, command } of commands) {
    if (pattern.test(text)) {
      const cleanText = text.replace(pattern, '').trim();
      return { command, cleanText };
    }
  }
  return { command: '', cleanText: text };
}
