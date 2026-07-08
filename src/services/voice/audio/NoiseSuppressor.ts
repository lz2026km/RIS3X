/**
 * G005 放射RIS系统 v3.0.6.5 - 噪声抑制 (RNNoise / WebRTC 风格 mock)
 * 20 升级点:VAD / 噪声门限 / AGC / 多级强度
 */

import type { NoiseSuppressorConfig, AudioMetrics } from '../../../types/voice';

const DEFAULT_CONFIG: NoiseSuppressorConfig = {
  enabled: true,
  aggressiveness: 2,
  sampleRate: 16000,
  frameMs: 20,
  highPassFilterHz: 80,
  enableVad: true,
  vadThreshold: 0.5,
};

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export class NoiseSuppressor {
  private config: NoiseSuppressorConfig;
  private active = false;
  private noiseFloor = -55;
  private lastMetrics: AudioMetrics = {
    rmsLevel: 0,
    peakLevel: 0,
    snr: 20,
    voiceActivity: false,
    speechProbability: 0,
    noiseFloor: -55,
    clipping: false,
    latencyMs: 0,
    processedAt: 0,
  };
  private processedFrames = 0;
  private droppedFrames = 0;

  constructor(config: Partial<NoiseSuppressorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  setConfig(patch: Partial<NoiseSuppressorConfig>): void {
    this.config = { ...this.config, ...patch };
  }

  getConfig(): NoiseSuppressorConfig {
    return { ...this.config };
  }

  async start(): Promise<void> {
    await delay(30);
    this.active = true;
  }

  async stop(): Promise<void> {
    this.active = false;
  }

  isActive(): boolean {
    return this.active;
  }

  /**
   * 处理音频帧(mock): 模拟噪声抑制 + VAD
   */
  processFrame(audio: ArrayBuffer | Float32Array): { output: ArrayBuffer; metrics: AudioMetrics; dropped: boolean } {
    const start = performance.now();
    const samples = audio instanceof ArrayBuffer ? new Float32Array(audio) : audio;
    const output = new Float32Array(samples.length);

    let sum = 0;
    let peak = 0;
    for (let i = 0; i < samples.length; i++) {
      const v = samples[i] ?? 0;
      sum += v * v;
      if (Math.abs(v) > peak) peak = Math.abs(v);
    }
    const rms = Math.sqrt(sum / Math.max(1, samples.length));
    const rmsDb = 20 * Math.log10(Math.max(0.0001, rms));
    const snr = rmsDb - this.noiseFloor;
    const speechProb = this.computeSpeechProbability(rms, snr);
    const vad = speechProb > this.config.vadThreshold;
    this.noiseFloor = this.noiseFloor * 0.95 + rmsDb * 0.05;

    // 高通滤波 + 抑制
    const filtered = this.highPassFilter(samples);
    const suppressed = this.applySuppression(filtered, vad);

    for (let i = 0; i < samples.length; i++) output[i] = suppressed[i] ?? 0;

    const dropped = !vad && this.config.enableVad && rms < 0.05;
    if (dropped) this.droppedFrames += 1;
    this.processedFrames += 1;

    const metrics: AudioMetrics = {
      rmsLevel: Math.min(1, rms),
      peakLevel: Math.min(1, peak),
      snr,
      voiceActivity: vad,
      speechProbability: speechProb,
      noiseFloor: this.noiseFloor,
      clipping: peak > 0.99,
      latencyMs: performance.now() - start,
      processedAt: Date.now(),
    };
    this.lastMetrics = metrics;
    return { output: output.buffer, metrics, dropped };
  }

  getLastMetrics(): AudioMetrics {
    return { ...this.lastMetrics };
  }

  getStats(): { processedFrames: number; droppedFrames: number; dropRate: number } {
    const total = this.processedFrames;
    return {
      processedFrames: total,
      droppedFrames: this.droppedFrames,
      dropRate: total === 0 ? 0 : this.droppedFrames / total,
    };
  }

  private computeSpeechProbability(rms: number, snr: number): number {
    if (snr > 25) return Math.min(1, 0.85 + (snr - 25) * 0.01);
    if (snr > 15) return 0.6 + (snr - 15) * 0.025;
    if (snr > 5) return 0.3 + (snr - 5) * 0.03;
    return Math.max(0, rms * 2);
  }

  private highPassFilter(input: Float32Array): Float32Array {
    const out = new Float32Array(input.length);
    const rc = 1.0 / (2 * Math.PI * this.config.highPassFilterHz);
    const dt = 1 / this.config.sampleRate;
    const a = rc / (rc + dt);
    let prev = 0;
    let prevIn = 0;
    for (let i = 0; i < input.length; i++) {
      const v = input[i] ?? 0;
      const y = a * (prev + v - prevIn);
      out[i] = y;
      prev = y;
      prevIn = v;
    }
    return out;
  }

  private applySuppression(input: Float32Array, vad: boolean): Float32Array {
    const out = new Float32Array(input.length);
    const gain = vad ? 1.0 : 0.05;
    const reduction = [1.0, 0.5, 0.25, 0.1][this.config.aggressiveness] ?? 0.25;
    for (let i = 0; i < input.length; i++) {
      out[i] = (input[i] ?? 0) * gain * reduction;
    }
    return out;
  }
}

export const noiseSuppressor = new NoiseSuppressor();
export { DEFAULT_CONFIG };
