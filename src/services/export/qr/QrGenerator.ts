/**
 * G005 放射RIS系统 v3.0.6.0 - QR 码生成器
 * Phase R7:报告封面/页脚/正文二维码
 */
import QRCode from 'qrcode';
import type { QrStampOptions } from '../../../types/export';

export interface QrGenerationResult {
  dataUrl: string;
  svgString: string;
  width: number;
  height: number;
}

const DEFAULTS: QrStampOptions = {
  content: '',
  size: 128,
  margin: 2,
  errorCorrectionLevel: 'M',
  position: 'top-right',
};

export class QrGenerator {
  async generate(opts: Partial<QrStampOptions> & { content: string }): Promise<QrGenerationResult> {
    const o: QrStampOptions = { ...DEFAULTS, ...opts };
    const dataUrl = await QRCode.toDataURL(o.content, {
      width: o.size,
      margin: o.margin,
      errorCorrectionLevel: o.errorCorrectionLevel,
      color: { dark: '#000000', light: '#ffffff' },
    });
    const svgString = await QRCode.toString(o.content, {
      type: 'svg',
      margin: o.margin,
      errorCorrectionLevel: o.errorCorrectionLevel,
    });
    return { dataUrl, svgString, width: o.size, height: o.size };
  }

  async generateReportUrl(baseUrl: string, reportId: string, extra?: Record<string, string>): Promise<string> {
    const url = new URL(`/reports/${encodeURIComponent(reportId)}`, baseUrl);
    if (extra) {
      Object.entries(extra).forEach(([k, v]) => url.searchParams.set(k, v));
    }
    return this.generate({ content: url.toString(), size: 128 });
  }

  async stampHtml(html: string, opts: Partial<QrStampOptions> & { content: string }): Promise<string> {
    const r = await this.generate(opts);
    const stamp = `<div class="qr-stamp" data-qr-position="${opts.position ?? DEFAULTS.position}" style="display:inline-block;">
      <img src="${r.dataUrl}" alt="QR Code" width="${r.width}" height="${r.height}" />
      ${opts.caption ? `<div style="font-size:10px;color:#475569;text-align:center;margin-top:4px;">${opts.caption}</div>` : ''}
    </div>`;
    const pos = opts.position ?? DEFAULTS.position;
    if (pos === 'inline') return html + stamp;
    if (/<\/body>/i.test(html)) {
      const style = positionCss(pos);
      return html.replace(/<\/body>/i, `<div style="${style}">${stamp}</div></body>`);
    }
    return html + stamp;
  }
}

function positionCss(pos: QrStampOptions['position']): string {
  switch (pos) {
    case 'top-right':
      return 'position:fixed;top:10px;right:10px;z-index:9999;';
    case 'bottom-right':
      return 'position:fixed;bottom:10px;right:10px;z-index:9999;';
    case 'bottom-center':
      return 'position:fixed;bottom:10px;left:50%;transform:translateX(-50%);z-index:9999;';
    case 'inline':
    default:
      return 'display:inline-block;';
  }
}

let singleton: QrGenerator | null = null;

export function getQrGenerator(): QrGenerator {
  if (!singleton) singleton = new QrGenerator();
  return singleton;
}