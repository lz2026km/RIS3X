import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Modal,
  Button,
  Select,
  Switch,
  Radio,
  Space,
  Divider,
  Result,
} from "antd";
import {
  FileText,
  FileType2,
  Code,
  CheckCircle2,
  XCircle,
  Download,
} from "lucide-react";
import {
  type ExportFormat,
  exportReport,
  downloadExport,
  type ExportResult,
} from "../../services/exportService";

export interface ExportDialogProps {
  reportId: string;
  open: boolean;
  onCancel: () => void;
}

const FORMAT_OPTIONS: {
  value: ExportFormat;
  label: string;
  icon: React.ReactNode;
}[] = [
  { value: "pdf", label: "PDF", icon: <FileText /> },
  { value: "word", label: "Word", icon: <FileType2 /> },
  { value: "html", label: "HTML", icon: <Code /> },
  { value: "txt", label: "TXT", icon: <FileText /> },
];

export function ExportDialog({ reportId, open, onCancel }: ExportDialogProps) {
  const { i18n } = useTranslation();
  const isZh = i18n.language?.startsWith("zh");

  const [format, setFormat] = useState<ExportFormat>("pdf");
  const [includeImages, setIncludeImages] = useState(true);
  const [includeQR, setIncludeQR] = useState(false);
  const [paperSize, setPaperSize] = useState<"A4" | "A5" | "B5">("A4");
  const [orientation, setOrientation] = useState<"portrait" | "landscape">(
    "portrait",
  );
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState<ExportResult | null>(null);

  const showOptions = format === "pdf";

  const handleExport = async () => {
    setExporting(true);
    setResult(null);
    try {
      const res = await exportReport({
        format,
        reportId,
        includeImages,
        includeQR,
        paperSize,
        orientation,
      });
      setResult(res);
      if (res.success) {
        await downloadExport(res);
      }
    } catch (err: any) {
      setResult({ success: false, error: err?.message || "导出失败" });
    } finally {
      setExporting(false);
    }
  };

  const handleClose = () => {
    if (!exporting) {
      setResult(null);
      onCancel();
    }
  };

  const handleBack = () => {
    setResult(null);
  };

  return (
    <Modal
      title={isZh ? "导出报告" : "Export Report"}
      open={open}
      onCancel={handleClose}
      footer={null}
      width={520}
      destroyOnHidden
      maskClosable={!exporting}
      closable={!exporting}
    >
      {result ? (
        <>
          <Result
            status={result.success ? "success" : "error"}
            icon={
              result.success ? (
                <CheckCircle2 style={{ color: "#22c55e" }} />
              ) : (
                <XCircle style={{ color: "#ef4444" }} />
              )
            }
            title={
              result.success
                ? isZh
                  ? "导出成功"
                  : "Export Successful"
                : isZh
                  ? "导出失败"
                  : "Export Failed"
            }
            subTitle={
              result.error || (result.success ? `${result.fileName || ""}` : "")
            }
          />
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 12,
              marginTop: 16,
            }}
          >
            {result.success ? (
              <Button type="primary" onClick={handleClose}>
                {isZh ? "完成" : "Done"}
              </Button>
            ) : (
              <Button type="primary" onClick={handleBack}>
                {isZh ? "重试" : "Retry"}
              </Button>
            )}
          </div>
        </>
      ) : (
        <>
          <div style={{ marginBottom: 20 }}>
            <label
              htmlFor="exportFormat"
              aria-label={isZh ? "导出格式" : "Export Format"}
              style={{
                display: "block",
                marginBottom: 8,
                fontWeight: 500,
                fontSize: 12,
              }}
            >
              {isZh ? "导出格式" : "Export Format"}
            </label>
            <Radio.Group
              id="exportFormat"
              value={format}
              onChange={(e) => {
                setFormat(e.target.value);
                setResult(null);
              }}
              optionType="button"
              buttonStyle="solid"
              style={{ width: "100%", display: "flex" }}
            >
              {FORMAT_OPTIONS.map((opt) => (
                <Radio.Button
                  key={opt.value}
                  value={opt.value}
                  style={{
                    flex: 1,
                    textAlign: "center",
                    height: 48,
                    lineHeight: "48px",
                  }}
                >
                  <Space>
                    {opt.icon}
                    {opt.label}
                  </Space>
                </Radio.Button>
              ))}
            </Radio.Group>
          </div>

          {showOptions && (
            <>
              <Divider style={{ margin: "12px 0" }} />
              <div style={{ marginBottom: 16 }}>
                <label
                  htmlFor="paperSize"
                  aria-label={isZh ? "纸张大小" : "Paper Size"}
                  style={{
                    display: "block",
                    marginBottom: 8,
                    fontWeight: 500,
                    fontSize: 12,
                  }}
                >
                  {isZh ? "纸张大小" : "Paper Size"}
                </label>
                <Select
                  id="paperSize"
                  value={paperSize}
                  onChange={setPaperSize}
                  style={{ width: "100%" }}
                  options={[
                    { value: "A4", label: "A4 (210×297mm)" },
                    { value: "A5", label: "A5 (148×210mm)" },
                    { value: "B5", label: "B5 (176×250mm)" },
                  ]}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label
                  htmlFor="orientation"
                  aria-label={isZh ? "方向" : "Orientation"}
                  style={{
                    display: "block",
                    marginBottom: 8,
                    fontWeight: 500,
                    fontSize: 12,
                  }}
                >
                  {isZh ? "方向" : "Orientation"}
                </label>
                <Radio.Group
                  id="orientation"
                  value={orientation}
                  onChange={(e) => setOrientation(e.target.value)}
                  optionType="button"
                  buttonStyle="solid"
                >
                  <Radio.Button value="portrait">
                    {isZh ? "纵向" : "Portrait"}
                  </Radio.Button>
                  <Radio.Button value="landscape">
                    {isZh ? "横向" : "Landscape"}
                  </Radio.Button>
                </Radio.Group>
              </div>

              <div style={{ display: "flex", gap: 24, marginBottom: 8 }}>
                <div>
                  <label
                    htmlFor="includeImages"
                    aria-label={isZh ? "包含影像" : "Include Images"}
                    style={{
                      display: "block",
                      marginBottom: 6,
                      fontWeight: 500,
                      fontSize: 12,
                    }}
                  >
                    {isZh ? "包含影像" : "Include Images"}
                  </label>
                  <Switch
                    id="includeImages"
                    checked={includeImages}
                    onChange={setIncludeImages}
                  />
                </div>
                <div>
                  <label
                    htmlFor="includeQR"
                    aria-label={isZh ? "包含二维码" : "Include QR Code"}
                    style={{
                      display: "block",
                      marginBottom: 6,
                      fontWeight: 500,
                      fontSize: 12,
                    }}
                  >
                    {isZh ? "包含二维码" : "Include QR Code"}
                  </label>
                  <Switch
                    id="includeQR"
                    checked={includeQR}
                    onChange={setIncludeQR}
                  />
                </div>
              </div>
            </>
          )}

          <Divider style={{ margin: "16px 0" }} />

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Button onClick={handleClose} disabled={exporting}>
              {isZh ? "取消" : "Cancel"}
            </Button>
            <Button
              type="primary"
              icon={<Download />}
              onClick={handleExport}
              loading={exporting}
            >
              {exporting
                ? isZh
                  ? "导出中..."
                  : "Exporting..."
                : isZh
                  ? "导出"
                  : "Export"}
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}
