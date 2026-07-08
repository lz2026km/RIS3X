// @ts-nocheck
import { Download, Upload, X } from "lucide-react";
import { t } from '../../i18n/appI18n';
import { COLORS, styles } from './DataReportCharts';

export default function DataReportExport({
  showExportModal, setShowExportModal, exportType,
  selectedExportFormat, setSelectedExportFormat,
  showUploadModal, setShowUploadModal, uploadDataType,
  selectedDevice, setSelectedDevice,
  showNewConsultationModal, setShowNewConsultationModal,
}) {
  const exportTypeLabel =
    exportType === "examVolume" ? "检查量统计"
    : exportType === "deviceUsage" ? "设备使用率"
    : exportType === "qualityScore" ? "报告质量评分"
    : exportType === "doseStats" ? "辐射剂量统计"
    : "会诊统计";

  const uploadTypeLabel =
    uploadDataType === "examVolume" ? "检查量统计"
    : uploadDataType === "deviceUsage" ? "设备使用率"
    : uploadDataType === "qualityScore" ? "报告质量评分"
    : uploadDataType === "doseStats" ? "辐射剂量统计"
    : "会诊统计";

  return (
    <>
      {showExportModal && (
        <div style={styles.modalOverlay} onClick={() => setShowExportModal(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div style={{ fontSize: "16px", fontWeight: 600 }}>{t('dc.confirmExport')}</div>
              <button style={{ background: "none", border: "none", cursor: "pointer", padding: "4px" }} onClick={() => setShowExportModal(false)}><X size={18} /></button>
            </div>
            <div style={styles.modalBody}>
              <p style={{ marginBottom: "16px" }}>确定要导出 <strong>{exportTypeLabel}</strong> 数据吗？</p>
              <div style={{ backgroundColor: "#f8fafc", padding: "12px", borderRadius: "6px", marginBottom: "16px" }}>
                <div style={{ fontSize: "13px", color: COLORS.textMuted, marginBottom: "8px" }}>{t('dc.exportFormat')}</div>
                <div style={{ display: "flex", gap: "8px" }}>
                  {["excel", "csv", "pdf"].map((fmt) => (
                    <button key={fmt} style={{ ...styles.btn, ...(selectedExportFormat === fmt ? styles.btnPrimary : styles.btnOutline) }} onClick={() => setSelectedExportFormat(fmt)}>
                      {fmt === "excel" ? "Excel (.xlsx)" : fmt === "csv" ? "CSV (.csv)" : "PDF (.pdf)"}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                <button style={{ ...styles.btn, ...styles.btnOutline }} onClick={() => setShowExportModal(false)}>{t('dc.cancel')}</button>
                <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={() => setShowExportModal(false)}><Download size={14} />{t('dc.confirmExport')}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showUploadModal && (
        <div style={styles.modalOverlay} onClick={() => setShowUploadModal(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div style={{ fontSize: "16px", fontWeight: 600 }}>{t('dc.confirmUpload')}</div>
              <button style={{ background: "none", border: "none", cursor: "pointer", padding: "4px" }} onClick={() => setShowUploadModal(false)}><X size={18} /></button>
            </div>
            <div style={styles.modalBody}>
              <p style={{ marginBottom: "16px" }}>确定要上报 <strong>{uploadTypeLabel}</strong> 数据吗？</p>
              <div style={{ backgroundColor: "#f8fafc", padding: "12px", borderRadius: "6px", marginBottom: "16px" }}>
                <div style={{ fontSize: "13px", color: COLORS.textMuted, marginBottom: "8px" }}>{t('dc.uploadNote')}</div>
                <div style={{ fontSize: "13px" }}>{t('dc.uploadWarning')}</div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                <button style={{ ...styles.btn, ...styles.btnOutline }} onClick={() => setShowUploadModal(false)}>{t('dc.cancel')}</button>
                <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={() => setShowUploadModal(false)}><Upload size={14} />{t('dc.confirmUpload')}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedDevice && (
        <div style={styles.modalOverlay} onClick={() => setSelectedDevice(null)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div style={{ fontSize: "16px", fontWeight: 600 }}>设备详情 - {selectedDevice.name}</div>
              <button style={{ background: "none", border: "none", cursor: "pointer", padding: "4px" }} onClick={() => setSelectedDevice(null)}><X size={18} /></button>
            </div>
            <div style={styles.modalBody}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
                <div><div style={{ fontSize: "12px", color: COLORS.textMuted, marginBottom: "4px" }}>{t('dc.deviceName')}</div><div style={{ fontWeight: 500 }}>{selectedDevice.name}</div></div>
                <div><div style={{ fontSize: "12px", color: COLORS.textMuted, marginBottom: "4px" }}>{t('dc.usageRate')}</div><div style={{ fontWeight: 500, color: selectedDevice.usage >= 80 ? COLORS.success : selectedDevice.usage >= 60 ? COLORS.warning : COLORS.danger }}>{selectedDevice.usage}%</div></div>
                <div><div style={{ fontSize: "12px", color: COLORS.textMuted, marginBottom: "4px" }}>{t('dcm.avgReportTime')}</div><div style={{ fontWeight: 500 }}>{selectedDevice.avgReport} min</div></div>
                <div><div style={{ fontSize: "12px", color: COLORS.textMuted, marginBottom: "4px" }}>{t('qcimage.status')}</div><div style={{ fontWeight: 500, color: selectedDevice.status === "正常运行" ? COLORS.success : COLORS.warning }}>{selectedDevice.status}</div></div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                <button style={{ ...styles.btn, ...styles.btnOutline }} onClick={() => setSelectedDevice(null)}>{t('dcm.close')}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showNewConsultationModal && (
        <div style={styles.modalOverlay} onClick={() => setShowNewConsultationModal(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div style={{ fontSize: "16px", fontWeight: 600 }}>{t('dc.newConsultation')}</div>
              <button style={{ background: "none", border: "none", cursor: "pointer", padding: "4px" }} onClick={() => setShowNewConsultationModal(false)}><X size={18} /></button>
            </div>
            <div style={styles.modalBody}>
              <p style={{ marginBottom: "16px", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ padding: "4px 12px", borderRadius: 20, background: "#dcfce7", color: "#16a34a", fontSize: 12, fontWeight: 700 }}>{t('dc.featureActive')}</span>
                <span>{t('dc.consultActiveDesc')}</span>
              </p>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                <button style={{ ...styles.btn, ...styles.btnOutline }} onClick={() => setShowNewConsultationModal(false)}>{t('dcm.close')}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
