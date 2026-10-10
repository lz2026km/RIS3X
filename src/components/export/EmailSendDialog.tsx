/**
 * G005 放射RIS系统 v3.0.6.0 - 邮件发送对话框
 * Phase R7:填写收件人/主题/正文 + 附件报告
 */
import React, { useState } from 'react';
import { Send, X, Paperclip, Mail } from 'lucide-react';
import { getEmailService } from '../../services/export/email/EmailService';
import type { EmailAttachment, ExportResult } from '../../types/export';

interface EmailSendDialogProps {
  open: boolean;
  onClose: () => void;
  reportId: string;
  exportResult?: ExportResult;
}

export const EmailSendDialog: React.FC<EmailSendDialogProps> = ({ open, onClose, reportId, exportResult }) => {
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [subject, setSubject] = useState(`放射诊断报告 - ${reportId}`);
  const [body, setBody] = useState('您好，\n\n请查收放射诊断报告。\n\n此致');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message?: string } | null>(null);

  const handleSend = async () => {
    if (!to.trim()) return;
    setSending(true);
    setResult(null);
    try {
      const svc = getEmailService();
      const attachments: EmailAttachment[] = [];
      if (exportResult?.blob && exportResult?.fileName) {
        attachments.push({
          filename: exportResult.fileName,
          blob: exportResult.blob,
          contentType: exportResult.blob.type,
        });
      }
      const res = await svc.send({
        to: to.split(',').map(s => s.trim()).filter(Boolean),
        cc: cc ? cc.split(',').map(s => s.trim()).filter(Boolean) : undefined,
        subject,
        body,
        attachments: attachments.length ? attachments : undefined,
      });
      setResult({ success: res.status === 'sent' || res.status === 'queued', message: res.status });
    } catch (e) {
      setResult({ success: false, message: String(e) });
    } finally {
      setSending(false);
    }
  };

  if (!open) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1050 }}>
      <div style={{ background: 'var(--bg-card)', borderRadius: 12, width: 520, boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Mail size={18} color="var(--color-primary-600)" />
            <span style={{ fontSize: 16, fontWeight: 700, color: '#1e293b' }}>邮件发送</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><X size={18} /></button>
        </div>

        <div style={{ padding: 20 }}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>收件人 *</label>
            <input value={to} onChange={e => setTo(e.target.value)} placeholder="请输入收件人邮箱，多个用逗号分隔" style={inputStyle} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>抄送</label>
            <input value={cc} onChange={e => setCc(e.target.value)} placeholder="请输入抄送邮箱（可选）" style={inputStyle} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>主题</label>
            <input value={subject} onChange={e => setSubject(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>正文</label>
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={5} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
          </div>

          {exportResult && (
            <div style={{ padding: 8, background: '#f0fdf4', borderRadius: 6, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--color-success-600)' }}>
              <Paperclip size={12} /> 已附加: {exportResult.fileName}
            </div>
          )}

          {result && (
            <div style={{ padding: 10, background: result.success ? '#f0fdf4' : '#fef2f2', borderRadius: 6, marginBottom: 12, fontSize: 12, color: result.success ? 'var(--color-success-600)' : 'var(--color-error-600)' }}>
              {result.success ? '邮件已排队发送' : `发送失败: ${result.message}`}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleSend} disabled={sending || !to.trim()} style={sending || !to.trim() ? btnDisabled : btnPrimary}>
              <Send size={14} /> {sending ? '发送中...' : '发送'}
            </button>
            <button onClick={onClose} style={btnSecondary}>取消</button>
          </div>
        </div>
      </div>
    </div>
  );
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 12, };
const btnPrimary: React.CSSProperties = {
  flex: 1, padding: '8px 16px', border: 'none', borderRadius: 6, background: 'var(--color-primary-600)', color: '#fff',
  fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center',
};
const btnSecondary: React.CSSProperties = {
  padding: '8px 16px', border: '1px solid #cbd5e1', borderRadius: 6, background: 'var(--bg-card)', color: '#475569', fontSize: 12, cursor: 'pointer',
};
const btnDisabled: React.CSSProperties = {
  ...btnPrimary, background: '#cbd5e1', cursor: 'not-allowed',
};
