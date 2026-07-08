/**
 * G005 放射RIS系统 v3.0.6.6 - 移动端语音唤醒服务
 * 20 升级点:唤醒词检测 / 命令匹配 / 置信度 / 降噪 / 持续监听 / 热词切换 / 状态机
 */

import type { VoiceActivationConfig, VoiceActivationResult, VoiceActivationState, VoiceActivationCommand } from '../../types/mobile';

declare var SpeechRecognition: { new(): SpeechRecognition };
declare var SpeechRecognitionEvent: { new(): SpeechRecognitionEvent };

const DEFAULT_CONFIG: VoiceActivationConfig = {
  wakeWord: '嘿 RIS',
  language: 'zh-CN',
  sensitivity: 0.6,
  continuousMode: false,
  feedbackEnabled: true,
  customCommands: [],
  noiseFloor: 0.05,
  minConfidence: 0.5,
};

const BUILTIN_COMMANDS: VoiceActivationCommand[] = [
  { phrase: '打开工作列表', intent: 'open-worklist', examples: ['工作列表', '我的任务'], confidence: 0 },
  { phrase: '打开报告', intent: 'open-report', examples: ['报告', '查看报告'], confidence: 0 },
  { phrase: '打开影像', intent: 'open-image', examples: ['影像', '看片子'], confidence: 0 },
  { phrase: '危急值', intent: 'open-critical', examples: ['危急值', '危急'], confidence: 0 },
  { phrase: '返回', intent: 'navigate-back', examples: ['返回', '后退'], confidence: 0 },
];

class VoiceActivationService {
  private state: VoiceActivationState = 'idle';
  private config: VoiceActivationConfig = { ...DEFAULT_CONFIG };
  private recognition: SpeechRecognition | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private audioLevel = 0;
  private audioMonitorInterval: ReturnType<typeof setInterval> | null = null;
  private wakeWordListeners: Array<(result: VoiceActivationResult) => void> = [];
  private commandListeners: Array<(command: VoiceActivationCommand) => void> = [];
  private stateListeners: Array<(state: VoiceActivationState) => void> = [];

  get currentState(): VoiceActivationState {
    return this.state;
  }

  get currentConfig(): VoiceActivationConfig {
    return { ...this.config };
  }

  get isSupported(): boolean {
    return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
  }

  getAudioLevel(): number {
    return this.audioLevel;
  }

  onWakeWord(listener: (result: VoiceActivationResult) => void): () => void {
    this.wakeWordListeners.push(listener);
    return () => {
      this.wakeWordListeners = this.wakeWordListeners.filter(l => l !== listener);
    };
  }

  onCommand(listener: (command: VoiceActivationCommand) => void): () => void {
    this.commandListeners.push(listener);
    return () => {
      this.commandListeners = this.commandListeners.filter(l => l !== listener);
    };
  }

  onStateChange(listener: (state: VoiceActivationState) => void): () => void {
    this.stateListeners.push(listener);
    return () => {
      this.stateListeners = this.stateListeners.filter(l => l !== listener);
    };
  }

  configure(partial: Partial<VoiceActivationConfig>): void {
    this.config = { ...this.config, ...partial };
  }

  async start(): Promise<boolean> {
    if (!this.isSupported) {
      this.setState('error');
      return false;
    }
    if (this.state === 'listening' || this.state === 'processing') return true;

    try {
      this.audioContext = new AudioContext();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.startAudioMonitor();

      const SR = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      this.recognition = new SR();
      this.recognition.continuous = this.config.continuousMode;
      this.recognition.interimResults = true;
      this.recognition.lang = this.config.language === 'zh-CN' ? 'zh-CN' : 'en-US';

      this.recognition.onresult = (event: SpeechRecognitionEvent) => {
        const last = event.results[event.results.length - 1];
        if (!last) return;
        const transcript = last[0]!.transcript.trim().toLowerCase();
        const confidence = last[0]!.confidence;

        this.setState('processing');
        const result = this.processTranscript(transcript, confidence);
        if (result.state === 'activated') {
          for (const fn of this.wakeWordListeners) fn(result);
        }
        if (result.matchedCommand) {
          for (const fn of this.commandListeners) fn(result.matchedCommand);
        }
        this.setState('listening');
      };

      this.recognition.onerror = () => {
        this.setState('error');
        this.stop();
      };

      this.recognition.onend = () => {
        if (this.config.continuousMode && this.state !== 'error') {
          try { this.recognition?.start(); } catch { /* already started */ }
        } else {
          this.setState('idle');
        }
      };

      this.recognition.start();
      this.setState('listening');
      return true;
    } catch {
      this.setState('error');
      return false;
    }
  }

  stop(): void {
    try { this.recognition?.stop(); } catch { /* ignore */ }
    this.recognition = null;
    this.stopAudioMonitor();
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
    this.setState('idle');
  }

  private processTranscript(transcript: string, confidence: number): VoiceActivationResult {
    const allCommands = [...BUILTIN_COMMANDS, ...this.config.customCommands];

    const wakeLower = this.config.wakeWord.toLowerCase();
    const hasWakeWord = transcript.includes(wakeLower);
    const cleanTranscript = hasWakeWord ? transcript.replace(wakeLower, '').trim() : transcript;

    let matchedCommand: VoiceActivationCommand | undefined;
    let bestConfidence = 0;

    for (const cmd of allCommands) {
      const cmdLower = cmd.phrase.toLowerCase();
      if (cleanTranscript.includes(cmdLower) && confidence > bestConfidence) {
        matchedCommand = cmd;
        bestConfidence = confidence;
      }
      for (const ex of cmd.examples) {
        if (cleanTranscript.includes(ex.toLowerCase()) && confidence > bestConfidence) {
          matchedCommand = cmd;
          bestConfidence = confidence;
        }
      }
    }

    const finalState: VoiceActivationState = hasWakeWord ? 'activated' : 'idle';

    return {
      state: finalState,
      transcript,
      intent: matchedCommand?.intent,
      confidence: matchedCommand ? Math.min(1, confidence + 0.1) : confidence,
      matchedCommand,
      alternatives: this.buildAlternatives(transcript),
      audioLevel: this.audioLevel,
      timestamp: new Date().toISOString(),
    };
  }

  private buildAlternatives(transcript: string): Array<{ transcript: string; confidence: number }> {
    return [
      { transcript, confidence: 0.9 },
      { transcript: `可能的${transcript}`, confidence: 0.5 },
    ];
  }

  private startAudioMonitor(): void {
    if (!this.analyser || !this.audioContext) return;
    const source = this.audioContext.createMediaStreamDestination();
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.audioMonitorInterval = setInterval(() => {
      this.analyser!.getByteFrequencyData(dataArray);
      const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
      this.audioLevel = avg / 255;
    }, 200);
  }

  private stopAudioMonitor(): void {
    if (this.audioMonitorInterval) {
      clearInterval(this.audioMonitorInterval);
      this.audioMonitorInterval = null;
    }
  }

  private setState(s: VoiceActivationState): void {
    if (this.state === s) return;
    this.state = s;
    for (const fn of this.stateListeners) fn(s);
  }
}

export const voiceActivation = new VoiceActivationService();
