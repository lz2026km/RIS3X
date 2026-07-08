/**
 * G005 放射RIS系统 v3.0.6.0 - HL7 v2.x MLLP 服务器(浏览器 Mock)
 * 60 升级点:WebSocket 桥接 / <VT>/<FS>/<CR> 帧解析 / ACK 自动生成
 *      连接管理 / 事件订阅 / 统计 / 与 Hl7V2Parser 集成
 */

import {
  parse, validate, buildAckMessage, type Hl7ParsedMessage,
} from '../hl7V2/Hl7V2Parser';
import type {
  MllpServerConfig, MllpHandler, MllpEvent, MllpServerStats, MllpConnection,
  Hl7ValidationResult,
} from '../../../types/integration';

// ============================================================
// 1. MLLP 帧字符(不可打印)
// ============================================================
export const MLLP_VT = 0x0b; // <VT> 起始
export const MLLP_FS = 0x1c; // <FS> 结束
export const MLLP_CR = 0x0d; // <CR> 终止

export const MLLP_FRAME_START = String.fromCharCode(MLLP_VT);
export const MLLP_FRAME_END = String.fromCharCode(MLLP_FS) + String.fromCharCode(MLLP_CR);

// ============================================================
// 2. 默认配置
// ============================================================
const DEFAULT_CONFIG: MllpServerConfig = {
  port: 2575,
  host: '0.0.0.0',
  encoding: 'UTF-8',
  maxFrameBytes: 4 * 1024 * 1024,
  keepAliveMs: 30_000,
  autoAck: true,
  framingTimeoutMs: 5_000,
};

// ============================================================
// 3. 内部连接抽象(浏览器环境无 TCP,使用消息总线模拟)
// ============================================================
interface SimulatedConnection extends MllpConnection {
  buffer: number[];
  parserState: 'idle' | 'reading' | 'frame-ready' | 'closed';
}

// ============================================================
// 4. MllpServer 类
// ============================================================
export class Hl7MllpServer {
  private config: MllpServerConfig;
  private handlers: Set<MllpHandler> = new Set<MllpHandler>();
  private running = false;
  private startedAt: number | null = null;
  private totalConnections = 0;
  private totalMessages = 0;
  private totalAckSent = 0;
  private totalError = 0;
  private bytesReceived = 0;
  private bytesSent = 0;
  private connections: Map<string, SimulatedConnection> = new Map<string, SimulatedConnection>();
  private wsBridge: WebSocket | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private lastError: string | null = null;

  constructor(config?: Partial<MllpServerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...(config ?? {}) };
  }

  // ---------------- 生命周期 ----------------
  start(): Promise<MllpServerStats> {
    if (this.running) {
      return Promise.resolve(this.stats());
    }
    this.running = true;
    this.startedAt = Date.now();
    this.lastError = null;
    this.emit({ type: 'start', ts: this.startedAt, port: this.config.port });
    // 启动 WebSocket 桥接(若服务器支持);否则使用本地回环
    this.tryAttachWebSocketBridge();
    // 启动保活定时器
    this.pingTimer = setInterval(() => this.tick(), 1_000);
    return Promise.resolve(this.stats());
  }

  stop(): Promise<MllpServerStats> {
    if (!this.running) {
      return Promise.resolve(this.stats());
    }
    this.running = false;
    this.startedAt = null;
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    if (this.wsBridge) {
      try { this.wsBridge.close(); } catch { /* noop */ }
      this.wsBridge = null;
    }
    for (const conn of this.connections.values()) {
      conn.status = 'closed';
      this.emit({ type: 'disconnect', peer: conn.remote, ts: Date.now(), reason: 'server-stop' });
    }
    this.connections.clear();
    this.emit({ type: 'stop', ts: Date.now() });
    return Promise.resolve(this.stats());
  }

  isRunning(): boolean { return this.running; }
  getLastError(): string | null { return this.lastError; }

  // ---------------- 事件订阅 ----------------
  onMessage(handler: MllpHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  off(handler: MllpHandler): void {
    this.handlers.delete(handler);
  }

  // ---------------- 报文接收(对外) ----------------
  /** 模拟客户端发送 MLLP 帧:浏览器中调用此方法即可触发解析 */
  receiveFramed(frame: string, peerRemote?: string): string {
    if (!this.running) {
      throw new Error('MLLP server not running');
    }
    const startIdx = frame.indexOf(MLLP_FRAME_START);
    const endIdx = frame.indexOf(MLLP_FRAME_END);
    if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
      this.totalError++;
      this.emit({ type: 'error', ts: Date.now(), message: 'MLLP 帧边界字符不完整', code: 'FRAMING' });
      throw new Error('Invalid MLLP frame: missing start/end delimiters');
    }
    const body = frame.slice(startIdx + 1, endIdx);
    return this.receiveRaw(body, peerRemote ?? 'mock://browser-peer');
  }

  receiveRaw(raw: string, peerRemote = 'mock://browser-peer'): string {
    if (!this.running) throw new Error('MLLP server not running');
    const conn = this.getOrCreateConnection(peerRemote);
    conn.lastActivity = Date.now();
    conn.messages += 1;
    this.totalMessages += 1;
    this.bytesReceived += new Blob([raw]).size;
    let parsed: Hl7ParsedMessage;
    let validation: Hl7ValidationResult;
    try {
      parsed = parse(raw);
      validation = validate(parsed);
    } catch (err) {
      this.totalError += 1;
      this.lastError = err instanceof Error ? err.message : String(err);
      this.emit({ type: 'error', peer: peerRemote, ts: Date.now(), message: this.lastError, code: 'PARSE' });
      const ack = buildAckMessage({
        ackCode: 'AE',
        originalControlId: 'UNKNOWN',
        textMessage: this.lastError,
      });
      this.sendAck(ack, conn, 'UNKNOWN', 'AE');
      return ack;
    }
    this.emit({
      type: 'message', peer: peerRemote, ts: Date.now(),
      message: parsed, raw, bytes: new Blob([raw]).size,
    });
    if (this.config.autoAck) {
      const ackCode: 'AA' | 'AE' | 'AR' = validation.passed ? 'AA' : 'AE';
      const ack = buildAckMessage({
        ackCode,
        originalControlId: parsed.messageControlId,
        textMessage: validation.passed ? 'Message accepted' : validation.issues.map((i) => i.message).join('; '),
      });
      this.sendAck(ack, conn, parsed.messageControlId, ackCode);
      return ack;
    }
    return '';
  }

  /** 发送 MLLP 帧到指定远端(浏览器内为事件触发) */
  sendTo(peer: string, payload: string): boolean {
    const conn = this.connections.get(this.connectionKey(peer));
    if (!conn || conn.status === 'closed') return false;
    const frame = MLLP_FRAME_START + payload + MLLP_FRAME_END;
    conn.lastActivity = Date.now();
    this.bytesSent += new Blob([frame]).size;
    this.emit({
      type: 'message', peer, ts: Date.now(),
      message: parse(payload),
      raw: frame,
      bytes: new Blob([frame]).size,
    });
    return true;
  }

  // ---------------- 工具 API ----------------
  listConnections(): MllpConnection[] {
    return Array.from(this.connections.values()).map((c) => ({
      id: c.id, remote: c.remote, connectedAt: c.connectedAt,
      messages: c.messages, lastActivity: c.lastActivity, status: c.status,
    }));
  }

  disconnect(peer: string): void {
    const key = this.connectionKey(peer);
    const conn = this.connections.get(key);
    if (!conn) return;
    conn.status = 'closed';
    this.connections.delete(key);
    this.emit({ type: 'disconnect', peer, ts: Date.now(), reason: 'manual' });
  }

  sendBroadcast(payload: string): number {
    let n = 0;
    for (const peer of this.connections.keys()) {
      if (this.sendTo(peer, payload)) n += 1;
    }
    return n;
  }

  stats(): MllpServerStats {
    return {
      port: this.config.port,
      running: this.running,
      startedAt: this.startedAt ?? undefined,
      uptimeMs: this.startedAt ? Date.now() - this.startedAt : 0,
      connections: this.listConnections(),
      totalConnections: this.totalConnections,
      totalMessages: this.totalMessages,
      totalAckSent: this.totalAckSent,
      totalError: this.totalError,
      bytesReceived: this.bytesReceived,
      bytesSent: this.bytesSent,
    };
  }

  getConfig(): MllpServerConfig { return { ...this.config }; }
  updateConfig(patch: Partial<MllpServerConfig>): void { this.config = { ...this.config, ...patch }; }

  // ---------------- 内部 ----------------
  private connectionKey(peer: string): string {
    return peer.startsWith('mock://') ? peer : `mock://${peer}`;
  }

  private getOrCreateConnection(peer: string): SimulatedConnection {
    const key = this.connectionKey(peer);
    let conn = this.connections.get(key);
    if (!conn) {
      this.totalConnections += 1;
      conn = {
        id: `c-${this.totalConnections}-${Date.now()}`,
        remote: key, connectedAt: Date.now(), messages: 0,
        lastActivity: Date.now(), status: 'connected', buffer: [],
        parserState: 'idle',
      };
      this.connections.set(key, conn);
      this.emit({ type: 'connect', peer: key, ts: Date.now() });
    }
    return conn;
  }

  private sendAck(ack: string, conn: SimulatedConnection, controlId: string, ackCode: 'AA' | 'AE' | 'AR'): void {
    const frame = MLLP_FRAME_START + ack + MLLP_FRAME_END;
    conn.lastActivity = Date.now();
    this.bytesSent += new Blob([frame]).size;
    this.totalAckSent += 1;
    this.emit({
      type: 'ack', peer: conn.remote, ts: Date.now(), ack: frame,
      controlId, ackCode,
    });
  }

  private emit(event: MllpEvent): void {
    for (const handler of this.handlers) {
      try { handler(event); }
      catch (err) { console.error('[MLLP] handler error:', err); }
    }
  }

  private tick(): void {
    const now = Date.now();
    for (const [key, conn] of this.connections.entries()) {
      if (now - conn.lastActivity > this.config.keepAliveMs * 2) {
        conn.status = 'closed';
        this.connections.delete(key);
        this.emit({ type: 'disconnect', peer: conn.remote, ts: now, reason: 'keep-alive-timeout' });
      } else if (now - conn.lastActivity > this.config.keepAliveMs) {
        if (conn.status === 'connected') conn.status = 'idle';
      }
    }
  }

  private tryAttachWebSocketBridge(): void {
    if (typeof window === 'undefined' || typeof WebSocket === 'undefined') return;
    const url = `ws://${window.location.hostname}:${this.config.port + 1}/mllp-bridge`;
    try {
      this.wsBridge = new WebSocket(url);
      this.wsBridge.addEventListener('open', () => {
        this.emit({ type: 'connect', peer: 'ws-bridge', ts: Date.now() });
      });
      this.wsBridge.addEventListener('message', (ev) => {
        if (typeof ev.data === 'string') {
          try { this.receiveFramed(ev.data, 'ws-bridge'); }
          catch (err) { console.warn('[MLLP] bridge message error:', err); }
        }
      });
      this.wsBridge.addEventListener('close', () => {
        this.emit({ type: 'disconnect', peer: 'ws-bridge', ts: Date.now(), reason: 'ws-closed' });
        this.wsBridge = null;
      });
      this.wsBridge.addEventListener('error', () => {
        this.emit({ type: 'error', peer: 'ws-bridge', ts: Date.now(), message: 'WebSocket bridge error', code: 'WS' });
      });
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : String(err);
      // WebSocket 不可用时,降级为纯内存模拟,不影响主功能
    }
  }
}

// ============================================================
// 5. 单例便捷访问
// ============================================================
let defaultServer: Hl7MllpServer | null = null;

export function getDefaultMllpServer(): Hl7MllpServer {
  if (!defaultServer) defaultServer = new Hl7MllpServer();
  return defaultServer;
}

export function resetDefaultMllpServer(): void {
  if (defaultServer) {
    void defaultServer.stop();
  }
  defaultServer = null;
}
