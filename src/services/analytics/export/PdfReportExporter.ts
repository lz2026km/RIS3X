import { jsPDF as JsPdf } from 'jspdf';
import type { jsPDF as JsPdfType } from 'jspdf';
import type { ExportRequest, ExportSheet } from '../../../types/analytics';

export interface PdfReportOptions {
  title: string;
  author?: string;
  subtitle?: string;
  orientation?: 'portrait' | 'landscape';
  pageSize?: 'A4' | 'A3' | 'Letter';
  includeTimestamp?: boolean;
  sections: PdfReportSection[];
}

export interface PdfReportSection {
  title: string;
  content: string;
  type: 'text' | 'table' | 'kpi-grid';
  data?: Record<string, unknown>[];
}

const FONT_TITLE = 18;
const FONT_SECTION = 13;
const FONT_HEADER = 9;
const FONT_CELL = 8;
const FONT_FOOTER = 7;
const MARGIN = 12;
const ROW_HEIGHT = 6;

export class PdfReportExporter {
  async export(request: ExportRequest): Promise<Blob> {
    const doc = this.createDoc(request.metadata);
    doc.setProperties({
      title: request.title ?? 'Report',
      author: request.author ?? 'G005-RIS',
      creator: 'G005-RIS',
    });
    this.renderHeader(doc, request);
    this.renderSections(doc, request);
    this.renderFooter(doc);
    const blob = doc.output('blob');
    return blob as Blob;
  }

  async exportReport(options: PdfReportOptions): Promise<Blob> {
    const request: ExportRequest = {
      format: 'pdf',
      filename: `${options.title.replace(/\s+/g, '_')}.pdf`,
      title: options.title,
      author: options.author,
      sheets: this.sectionsToSheets(options.sections),
      metadata: {
        orientation: options.orientation ?? 'portrait',
        pageSize: options.pageSize ?? 'A4',
        subtitle: options.subtitle ?? '',
        includeTimestamp: options.includeTimestamp !== false ? '1' : '0',
      },
    };
    return this.export(request);
  }

  private createDoc(metadata?: Record<string, string | number>): JsPdfType {
    const orientation = (metadata?.['orientation'] === 'landscape' ? 'landscape' : 'portrait') as 'portrait' | 'landscape';
    const pageSize = (metadata?.['pageSize'] === 'A3' || metadata?.['pageSize'] === 'Letter'
      ? metadata['pageSize']
      : 'a4') as 'a4' | 'a3' | 'letter';
    return new JsPdf({ orientation, unit: 'mm', format: pageSize });
  }

  private renderHeader(doc: JsPdfType, request: ExportRequest): void {
    const pageW = doc.internal.pageSize.getWidth();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(FONT_TITLE);
    doc.setTextColor(30, 58, 95);
    doc.text(request.title ?? 'Report', pageW / 2, MARGIN + 6, { align: 'center' });
    if (request.author) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(FONT_HEADER);
      doc.setTextColor(100, 116, 139);
      doc.text(`Author: ${request.author}`, pageW / 2, MARGIN + 12, { align: 'center' });
    }
    doc.setDrawColor(30, 58, 95);
    doc.setLineWidth(0.4);
    doc.line(MARGIN, MARGIN + 16, pageW - MARGIN, MARGIN + 16);
  }

  private renderSections(doc: JsPdfType, request: ExportRequest): void {
    let y = MARGIN + 22;
    const pageH = doc.internal.pageSize.getHeight();
    const sheets = request.sheets ?? [];
    for (const sheet of sheets) {
      y = this.ensureSpace(doc, y, pageH, ROW_HEIGHT * 3);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(FONT_SECTION);
      doc.setTextColor(30, 58, 95);
      doc.text(sheet.name, MARGIN, y);
      y += 6;
      y = this.renderTable(doc, sheet, y, pageH);
      y += 4;
    }
  }

  private renderTable(doc: JsPdfType, sheet: ExportSheet, startY: number, pageH: number): number {
    if (sheet.columns.length === 0) return startY;
    const pageW = doc.internal.pageSize.getWidth();
    const tableW = pageW - MARGIN * 2;
    const colCount = sheet.columns.length;
    const colW = tableW / colCount;
    let y = startY;
    y = this.ensureSpace(doc, y, pageH, ROW_HEIGHT * 2);
    doc.setFillColor(30, 58, 95);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(FONT_HEADER);
    doc.rect(MARGIN, y, tableW, ROW_HEIGHT, 'F');
    sheet.columns.forEach((c, i) => {
      const x = MARGIN + i * colW;
      doc.text(this.truncate(c.header, colW), x + 1, y + ROW_HEIGHT - 1.5);
    });
    y += ROW_HEIGHT;
    doc.setTextColor(51, 65, 85);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(FONT_CELL);
    if (sheet.rows.length === 0) {
      y = this.ensureSpace(doc, y, pageH, ROW_HEIGHT);
      doc.setTextColor(148, 163, 184);
      doc.text('(无数据)', MARGIN + 1, y + ROW_HEIGHT - 1.5);
      doc.setTextColor(51, 65, 85);
      return y + ROW_HEIGHT;
    }
    for (let r = 0; r < sheet.rows.length; r++) {
      y = this.ensureSpace(doc, y, pageH, ROW_HEIGHT);
      const bg: [number, number, number] = r % 2 === 0 ? [255, 255, 255] : [248, 250, 252];
      doc.setFillColor(...bg);
      doc.rect(MARGIN, y, tableW, ROW_HEIGHT, 'F');
      sheet.columns.forEach((c, i) => {
        const x = MARGIN + i * colW;
        const val = sheet.rows[r]![c.key];
        const text = val === null || val === undefined ? '-' : String(val);
        doc.text(this.truncate(text, colW), x + 1, y + ROW_HEIGHT - 1.5);
      });
      y += ROW_HEIGHT;
    }
    return y;
  }

  private ensureSpace(doc: JsPdfType, y: number, pageH: number, needed: number): number {
    if (y + needed > pageH - MARGIN) {
      doc.addPage();
      return MARGIN;
    }
    return y;
  }

  private renderFooter(doc: JsPdfType): void {
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(FONT_FOOTER);
      doc.setTextColor(148, 163, 184);
      doc.text(`Generated: ${new Date().toISOString()}`, MARGIN, pageH - 4);
      doc.text(`Page ${i} / ${pageCount}`, pageW - MARGIN, pageH - 4, { align: 'right' });
    }
  }

  private truncate(text: string, colW: number): string {
    const maxChars = Math.max(3, Math.floor(colW / 1.6));
    if (text.length <= maxChars) return text;
    return text.substring(0, Math.max(0, maxChars - 1)) + '\u2026';
  }

  private sectionsToSheets(sections: PdfReportSection[]): ExportSheet[] {
    return sections.map((s) => ({
      name: s.title,
      columns: s.data?.length
        ? Object.keys(s.data[0]!).map(k => ({ key: k, header: k }))
        : [{ key: 'content', header: '\u5185\u5bb9' }],
      rows: s.data ?? (s.type === 'text' ? [{ content: s.content }] : []),
    }));
  }
}

export const pdfReportExporter = new PdfReportExporter();
