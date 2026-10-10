import React, { useState } from "react";
import { jsPDF } from "jspdf";
import ExcelJS from "exceljs";
import { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, WidthType, AlignmentType } from 'docx';
import { Download, FileSpreadsheet, FileText, FileCode } from "lucide-react";

export type ExportFormat = "csv" | "json" | "xlsx" | "pdf" | "docx";

export interface ExportButtonProps {
  data: any[] | (() => any[]);
  filename?: string;
  formats?: ExportFormat[];
  label?: string;
  size?: "small" | "middle" | "large";
  disabled?: boolean;
  ariaLabel?: string;
  onBeforeExport?: (data: any[]) => any[];
  onExport?: (format: ExportFormat, data: any[]) => void;
}

const FORMAT_META: Record<
  ExportFormat,
  { label: string; icon: React.ReactNode; mime: string; ext: string }
> = {
  csv: { label: "CSV", icon: <FileSpreadsheet size={14} />, mime: "text/csv;charset=utf-8", ext: ".csv" },
  json: { label: "JSON", icon: <FileCode size={14} />, mime: "application/json", ext: ".json" },
  xlsx: { label: "Excel", icon: <FileSpreadsheet size={14} />, mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ext: ".xlsx" },
  pdf: { label: "PDF", icon: <FileText size={14} />, mime: "application/pdf", ext: ".pdf" },
  docx: { label: "Word", icon: <FileText size={14} />, mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ext: ".docx" },
};

function toCSV(rows: any[]): string {
  if (!rows || rows.length === 0) return "";
  const keys = Object.keys(rows[0]);
  const header = keys.join(",");
  const body = rows
    .map((r) =>
      keys
        .map((k) => {
          const v = r[k];
          if (v === null || v === undefined) return "";
          const s = String(v).replace(/"/g, '""');
          return /[",\n]/.test(s) ? `"${s}"` : s;
        })
        .join(","),
    )
    .join("\n");
  return "\uFEFF" + header + "\n" + body;
}

function downloadBlob(blob: Blob, filename: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function exportXLSX(rows: any[], filename: string) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Sheet1");
  if (!rows || rows.length === 0) {
    worksheet.getCell("A1").value = "无数据";
  } else {
    const keys = Object.keys(rows[0]);
    const headerRow = worksheet.addRow(keys);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };
      cell.alignment = { horizontal: "center" };
    });
    rows.forEach((r) => {
      worksheet.addRow(keys.map((k) => r[k] ?? ""));
    });
    worksheet.columns = keys.map(() => ({ width: 18 }));
  }
  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(new Blob([buffer], { type: FORMAT_META.xlsx.mime }), filename + FORMAT_META.xlsx.ext);
}

function exportPDF(rows: any[], filename: string) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 10;
  const colGap = 2;
  const rowH = 7;
  const fontSize = 7;
  const headerSize = 8;

  if (!rows || rows.length === 0) {
    doc.setFontSize(12);
    doc.text("无数据可导出", margin, margin + 10);
    doc.save(filename + ".pdf");
    return;
  }

  const keys = Object.keys(rows[0]);
  const colW = (pageW - margin * 2 - colGap * (keys.length - 1)) / keys.length;

  let y = margin + 10;
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(filename || "导出报表", pageW / 2, y, { align: "center" });
  y += 8;
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(new Date().toLocaleString("zh-CN"), pageW - margin, y, { align: "right" });
  y += 6;

  const drawTable = (startY: number, data: any[], maxY: number): number => {
    let curY = startY;
    doc.setFontSize(headerSize);
    doc.setFont("helvetica", "bold");
    doc.setFillColor(30, 58, 95);
    doc.setTextColor(255, 255, 255);
    keys.forEach((k, i) => {
      const x = margin + i * (colW + colGap);
      doc.rect(x, curY, colW, rowH, "F");
      doc.text(k, x + 0.5, curY + rowH - 1.5);
    });
    curY += rowH;
    doc.setFontSize(fontSize);
    doc.setFont("helvetica", "normal");
    for (let r = 0; r < data.length; r++) {
      if (curY + rowH > maxY) {
        doc.addPage();
        curY = margin + 10;
        doc.setFontSize(headerSize);
        doc.setFont("helvetica", "bold");
        doc.setFillColor(30, 58, 95);
        doc.setTextColor(255, 255, 255);
        keys.forEach((k, i) => {
          const x = margin + i * (colW + colGap);
          doc.rect(x, curY, colW, rowH, "F");
          doc.text(k, x + 0.5, curY + rowH - 1.5);
        });
        curY += rowH;
        doc.setFontSize(fontSize);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(0, 0, 0);
      }
      const row = data[r];
      const bg: [number, number, number] = r % 2 === 0 ? [255, 255, 255] : [248, 250, 252];
      keys.forEach((k, i) => {
        const x = margin + i * (colW + colGap);
        doc.setFillColor(...bg);
        doc.rect(x, curY, colW, rowH, "F");
        const val = row[k] === null || row[k] === undefined ? "-" : String(row[k]);
        doc.setTextColor(51, 65, 85);
        doc.text(val.substring(0, Math.floor(colW / 1.5)), x + 0.5, curY + rowH - 1.5);
      });
      curY += rowH;
    }
    return curY;
  };

  doc.setTextColor(0, 0, 0);
  drawTable(y, rows, pageH - margin);
  doc.save(filename + ".pdf");
}

async function exportDOCX(rows: any[], filename: string) {
  if (!rows || rows.length === 0) {
    const emptyDoc = new Document({ sections: [{ children: [new Paragraph("无数据")] }] });
    const buffer = await Packer.toBuffer(emptyDoc);
    downloadBlob(new Blob([buffer], { type: FORMAT_META.docx.mime }), filename + FORMAT_META.docx.ext);
    return;
  }
  const keys = Object.keys(rows[0]);
  const headerCells = keys.map((k) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: k, bold: true, color: "FFFFFF" })], alignment: AlignmentType.CENTER })] }));
  const headerRow = new TableRow({ children: headerCells, tableHeader: true });
  const dataRows = rows.map(
    (r) =>
      new TableRow({
        children: keys.map(
          (k) =>
            new TableCell({
              children: [new Paragraph({ children: [new TextRun(String(r[k] ?? ""))] })],
            }),
        ),
      }),
  );
  const table = new Table({
    rows: [headerRow, ...dataRows],
    width: { size: 100, type: WidthType.PERCENTAGE },
  });
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ children: [new TextRun({ text: filename || "导出报表", bold: true, size: 28 })], alignment: AlignmentType.CENTER }),
          new Paragraph({ children: [new TextRun({ text: new Date().toLocaleString("zh-CN"), size: 16, color: "888888" })], alignment: AlignmentType.RIGHT }),
          table,
        ],
      },
    ],
  });
  const buffer = await Packer.toBuffer(doc);
  downloadBlob(new Blob([buffer], { type: FORMAT_META.docx.mime }), filename + FORMAT_META.docx.ext);
}

export function ExportButton({
  data,
  filename = "export",
  formats = ["csv", "json"],
  label = "导出",
  size = "middle",
  disabled,
  ariaLabel,
  onBeforeExport,
  onExport,
}: ExportButtonProps) {
  const [open, setOpen] = useState(false);

  const handleExport = async (fmt: ExportFormat) => {
    setOpen(false);
    let rows = typeof data === "function" ? data() : data;
    if (onBeforeExport) rows = onBeforeExport(rows);
    if (onExport) onExport(fmt, rows);
    if (fmt === "csv") {
      downloadBlob(new Blob([toCSV(rows)], { type: FORMAT_META.csv.mime }), filename + FORMAT_META.csv.ext);
    } else if (fmt === "json") {
      downloadBlob(new Blob([JSON.stringify(rows, null, 2)], { type: FORMAT_META.json.mime }), filename + FORMAT_META.json.ext);
    } else if (fmt === "xlsx") {
      await exportXLSX(rows, filename);
    } else if (fmt === "pdf") {
      exportPDF(rows, filename);
    } else if (fmt === "docx") {
      await exportDOCX(rows, filename);
    }
  };

  const padding = size === "small" ? "4px 10px" : size === "large" ? "8px 18px" : "6px 14px";
  const fSize = size === "small" ? 12 : size === "large" ? 14 : 13;

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        disabled={disabled}
        aria-label={ariaLabel || label}
        onClick={() => setOpen(!open)}
        style={{
          padding,
          fontSize: fSize,
          fontWeight: 600,
          background: "var(--bg-card)",
          color: "var(--color-primary-800)",
          border: "1px solid var(--border-color)",
          borderRadius: 6,
          cursor: disabled ? "not-allowed" : "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <Download size={14} />
        {label}
      </button>
      {open && (
        <div
          role="menu"
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            right: 0,
            background: "var(--bg-card)",
            border: "1px solid var(--border-color)",
            borderRadius: 8,
            boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
            padding: 4,
            minWidth: 140,
            zIndex: 200,
          }}
        >
          {formats.map((fmt) => {
            const meta = FORMAT_META[fmt];
            return (
              <button
                key={fmt}
                role="menuitem"
                onClick={() => handleExport(fmt)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  width: "100%",
                  padding: "8px 12px",
                  background: "transparent",
                  border: "none",
                  borderRadius: 4,
                  cursor: "pointer",
                  fontSize: 12,
                  color: "#1e293b",
                  textAlign: "left",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                {meta.icon}
                导出为 {meta.label}
              </button>
            );
          })}
        </div>
      )}
      {open && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 99 }}
          onClick={() => setOpen(false)}
        />
      )}
    </div>
  );
}

export default ExportButton;
