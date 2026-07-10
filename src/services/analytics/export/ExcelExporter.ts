import ExcelJS from 'exceljs';
import type { ExportRequest, ExportSheet } from '../../../types/analytics';

export class ExcelExporter {
  async export(request: ExportRequest): Promise<Blob> {
    const workbook = this.buildWorkbook(request);
    const buffer = await workbook.xlsx.writeBuffer();
    return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  async exportFromSheets(sheets: ExportSheet[], filename?: string): Promise<Blob> {
    const request: ExportRequest = {
      format: 'xlsx',
      filename: filename ?? 'export.xlsx',
      sheets,
    };
    return this.export(request);
  }

  private buildWorkbook(request: ExportRequest): ExcelJS.Workbook {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = request.author ?? 'G005-RIS';
    workbook.created = new Date();
    const sheets = request.sheets ?? [];
    if (sheets.length === 0) {
      const ws = workbook.addWorksheet(request.title ?? 'Report');
      ws.addRow([request.title ?? 'Report']);
      ws.addRow([`Generated: ${new Date().toISOString()}`]);
      return workbook;
    }
    for (const sheet of sheets) {
      const worksheet = workbook.addWorksheet(this.safeSheetName(sheet.name));
      const showTitle = request.title && sheet === sheets[0];
      if (showTitle) {
        worksheet.addRow([request.title]);
        worksheet.getRow(1).font = { bold: true, size: 14 };
        worksheet.addRow([]);
      }
      const headerRow = worksheet.addRow(sheet.columns.map(c => c.header));
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      });
      for (const row of sheet.rows) {
        const dataRow = worksheet.addRow(sheet.columns.map(c => row[c.key] ?? ''));
        dataRow.eachCell((cell, colNumber) => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
            left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
            bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
            right: { style: 'thin', color: { argb: 'FFCCCCCC' } },
          };
          if (colNumber % 2 === 0) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
          }
        });
      }
      worksheet.columns = sheet.columns.map((c) => ({
        header: c.header,
        key: c.key,
        width: c.width ?? Math.max(12, Math.min(40, (c.header.length * 1.5) + 4)),
      }));
      worksheet.eachRow((row) => {
        row.height = 18;
      });
      worksheet.views = [{ state: 'frozen', ySplit: showTitle ? 2 : 1 }];
    }
    return workbook;
  }

  private safeSheetName(name: string): string {
    const cleaned = (name ?? 'Sheet').replace(/[\\\/\?\*\[\]:]/g, '_');
    return cleaned.substring(0, 31);
  }
}

export const excelExporter = new ExcelExporter();
