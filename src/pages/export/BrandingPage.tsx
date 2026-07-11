/**
 * G005 放射RIS系统 v3.0.6.0 - 品牌管理页面
 * Phase R7:站点品牌统一配置
 */
import React from 'react';
import { Palette, FileText } from 'lucide-react';
import { sanitizeHtml } from '../../utils/sanitization';
import { BrandingConfig } from '../../components/export/BrandingConfig';
import { getBrandingEngine } from '../../services/export/branding/BrandingEngine';

export default function BrandingPage() {
  const engine = getBrandingEngine();
  const config = engine.getConfig();

  const previewHtml = `
    <div style="font-family:${config.fontFamily}; color:#1e293b; max-width:800px; margin:0 auto; padding:40px;">
      ${engine.buildHtmlHeader()}
      <h2 style="color:${config.primaryColor};">放射诊断报告</h2>
      <p><strong>患者姓名：</strong>张三</p>
      <p><strong>检查项目：</strong>CT 胸部平扫</p>
      <p><strong>影像所见：</strong>双肺纹理清晰，未见明显异常密度影。</p>
      <p><strong>诊断意见：</strong>未见明显异常。</p>
      ${engine.buildHtmlFooter()}
    </div>
  `;

  return (
    <div style={{ padding: 20, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <Palette size={22} color="#7c3aed" />
        <div>
          <h1 style={{ fontSize: 22, color: '#1e293b', margin: 0 }}>品牌管理</h1>
          <p style={{ fontSize: 12, color: '#64748b', margin: '4px 0 0' }}>配置报告导出的站点品牌信息</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <BrandingConfig />

        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
            <FileText size={14} color="#7c3aed" />
            <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>报告预览</span>
          </div>
          <div style={{
            background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0',
            overflow: 'auto', maxHeight: 500,
          }}>
            <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(previewHtml) }} />
          </div>
        </div>
      </div>
    </div>
  );
}
