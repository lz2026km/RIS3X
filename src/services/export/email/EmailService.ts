/**
 * G005 放射RIS系统 v3.0.6.0 - 邮件发送服务
 * Phase R7:SMTP 模拟 / Mailto 后备 / 附件内联
 */
import type { EmailMessage, EmailAttachment, ExportResult } from '../../../types/export';

export type EmailSendStatus = 'queued' | 'sent' | 'failed';

export interface EmailSendResult {
  messageId: string;
  status: EmailSendStatus;
  to: string[];
  error?: string;
  timestamp: number;
}

export class EmailService {
  private sentLog: EmailSendResult[] = [];
  private readonly STORAGE_KEY = 'g005:export:email:log';

  async send(msg: EmailMessage): Promise<EmailSendResult> {
    const messageId = `email-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    if (!msg.to.length) {
      const result: EmailSendResult = { messageId, status: 'failed', to: [], error: 'No recipients', timestamp: Date.now() };
      this.log(result);
      return result;
    }

    try {
      const mailtoString = this.buildMailto(msg);
      if (mailtoString.length < 2000) {
        window.location.href = mailtoString;
      }

      const result: EmailSendResult = {
        messageId,
        status: 'queued',
        to: msg.to,
        timestamp: Date.now(),
      };
      this.log(result);

      if (msg.attachments?.length) {
        await this.handleAttachments(msg);
      }

      result.status = 'sent';
      this.log(result);
      return result;
    } catch (e) {
      const result: EmailSendResult = {
        messageId,
        status: 'failed',
        to: msg.to,
        error: e instanceof Error ? e.message : String(e),
        timestamp: Date.now(),
      };
      this.log(result);
      return result;
    }
  }

  async sendWithAttachment(
    to: string[],
    subject: string,
    body: string,
    attachment: EmailAttachment,
    isHtml?: boolean,
  ): Promise<EmailSendResult> {
    return this.send({
      to,
      subject,
      body,
      attachments: [attachment],
      isHtml,
    });
  }

  async downloadAsAttachment(result: ExportResult): Promise<EmailAttachment | null> {
    if (!result.blob || !result.fileName) return null;
    return {
      filename: result.fileName,
      blob: result.blob,
      contentType: result.blob.type,
    };
  }

  getSendLog(): EmailSendResult[] {
    return [...this.sentLog];
  }

  clearLog(): void {
    this.sentLog = [];
    try { localStorage.removeItem(this.STORAGE_KEY); } catch { /* ignore */ }
  }

  private async handleAttachments(msg: EmailMessage): Promise<void> {
    for (const att of msg.attachments ?? []) {
      const url = URL.createObjectURL(att.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = att.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }

  private buildMailto(msg: EmailMessage): string {
    const params = new URLSearchParams();
    params.set('to', msg.to.join(','));
    if (msg.cc?.length) params.set('cc', msg.cc.join(','));
    if (msg.subject) params.set('subject', msg.subject);
    if (msg.body) params.set('body', msg.body);
    return `mailto:?${params.toString()}`;
  }

  private log(result: EmailSendResult): void {
    this.sentLog.push(result);
    if (this.sentLog.length > 100) this.sentLog = this.sentLog.slice(-100);
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.sentLog));
    } catch { /* ignore */ }
  }
}

let singleton: EmailService | null = null;
export function getEmailService(): EmailService {
  if (!singleton) singleton = new EmailService();
  return singleton;
}
