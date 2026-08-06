/**
 * G005 放射RIS系统 v3.0.6.0 - 水印引擎
 * Phase R7:文字/图片水印,位置/透明度/旋转
 */
import type { WatermarkOptions } from '../../../types/export';

const DEFAULTS: WatermarkOptions = {
  type: 'text',
  text: 'DRAFT',
  opacity: 0.1,
  rotation: -30,
  fontSize: 80,
  color: '#dc2626',
  position: 'center',
};

export class WatermarkEngine {
  buildCss(opts: Partial<WatermarkOptions> = {}): string {
    const o: WatermarkOptions = { ...DEFAULTS, ...opts };
    if (o.type === 'text') {
      return this.textCss(o);
    }
    return this.imageCss(o);
  }

  buildOverlayHtml(opts: Partial<WatermarkOptions> = {}): string {
    const o: WatermarkOptions = { ...DEFAULTS, ...opts };
    const style = this.buildCss(o);
    if (o.type === 'image' && o.imageDataUrl) {
      return `<div class="watermark-layer" style="${style}"><img src="${o.imageDataUrl}" alt="watermark" style="width:200px;opacity:${o.opacity};" /></div>`;
    }
    const text = o.text ?? 'DRAFT';
    return `<div class="watermark-layer" style="${style}">${escapeHtml(text)}</div>`;
  }

  applyToHtml(html: string, opts: Partial<WatermarkOptions> = {}): string {
    const layer = this.buildOverlayHtml(opts);
    const o: WatermarkOptions = { ...DEFAULTS, ...opts };
    if (o.position === 'tile') {
      const tiles: string[] = [];
      for (let y = 0; y < 5; y++) {
        for (let x = 0; x < 4; x++) {
          const tile = `<div style="${this.buildCss(o)};position:absolute;top:${y * 200}px;left:${x * 250}px;">${o.type === 'text' ? escapeHtml(o.text ?? 'DRAFT') : `<img src="${o.imageDataUrl}" alt="wm" style="width:160px;" />`}</div>`;
          tiles.push(tile);
        }
      }
      const tileLayer = `<div class="watermark-tiles" style="position:fixed;inset:0;pointer-events:none;z-index:9998;">${tiles.join('')}</div>`;
      if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${tileLayer}</body>`);
      return html + tileLayer;
    }
    if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${layer}</body>`);
    return html + layer;
  }

  private textCss(o: WatermarkOptions): string {
    return [
      'position:fixed',
      'pointer-events:none',
      'z-index:9999',
      `opacity:${o.opacity}`,
      `transform:rotate(${o.rotation}deg)`,
      `font-size:${o.fontSize}px`,
      `color:${o.color}`,
      'font-weight:700',
      'font-family:sans-serif',
      'white-space:nowrap',
      this.positionCss(o.position),
    ].join(';');
  }

  private imageCss(o: WatermarkOptions): string {
    return [
      'position:fixed',
      'pointer-events:none',
      'z-index:9999',
      `opacity:${o.opacity}`,
      `transform:rotate(${o.rotation}deg)`,
      this.positionCss(o.position),
    ].join(';');
  }

  private positionCss(pos: WatermarkOptions['position']): string {
    switch (pos) {
      case 'center':
        return 'top:50%;left:50%;transform-origin:center;';
      case 'top-right':
        return 'top:30px;right:30px;';
      case 'bottom-left':
        return 'bottom:30px;left:30px;';
      case 'tile':
      default:
        return 'top:0;left:0;';
    }
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

let singleton: WatermarkEngine | null = null;

export function getWatermarkEngine(): WatermarkEngine {
  if (!singleton) singleton = new WatermarkEngine();
  return singleton;
}

export { DEFAULTS as WATERMARK_DEFAULTS };