/**
 * G005 RIS v3.0.6.8-27 - 影像质控专项页面
 * ACR 模体测试 / SNR / CNR / 重拍率 / 剂量合规
 */
import React, { useMemo, useState, useEffect } from "react";
import { message } from 'antd';
import { Camera, Activity, AlertTriangle, CheckCircle, Calendar, BarChart3 } from "lucide-react";
import { PageContainer } from "../../components/common/PageContainer";
import { PageHeader } from "../../components/common/PageHeader";
import { StickyActionBar } from "../../components/common/StickyActionBar";
import { StatCard, StatCardGrid } from "../../components/common/StatCard";
import { DEVICE_MASTER, DEVICES_BY_MODALITY } from "../../data/master";
import { qcextApi, type QcImageDto } from '../../services/api/qcextApi';

export default function ImageQualityControlPage() {
  const [modality, setModality] = useState<string>("all");
  const [qcImages, setQcImages] = useState<QcImageDto[]>([]);
  useEffect(() => {
    qcextApi.listQcImages().then(res => { if (res.success) setQcImages(res.data); }).catch((err) => { console.error('[F04]', err); });
  }, []);

  const stats = useMemo(() => {
    const filtered = modality === "all" ? DEVICE_MASTER : DEVICES_BY_MODALITY[modality as keyof typeof DEVICES_BY_MODALITY] || [];
    const a = filtered.filter((d) => d.imageQualityGrade === "A").length;
    const b = filtered.filter((d) => d.imageQualityGrade === "B").length;
    const c = filtered.filter((d) => d.imageQualityGrade === "C").length;
    const d = filtered.filter((d) => d.imageQualityGrade === "D").length;
    const doseCompliant = filtered.filter((d) => d.doseComplianceRate >= 90).length;
    const total = filtered.length;
    const avgDoseCompliance = total > 0 ? (filtered.reduce((s, x) => s + x.doseComplianceRate, 0) / total).toFixed(1) : "0";
    return { a, b, c, d, total, doseCompliant, avgDoseCompliance, pct: { a: (a / total) * 100, b: (b / total) * 100, c: (c / total) * 100, d: (d / total) * 100 } };
  }, [modality]);

  return (
    <PageContainer background="slate" maxWidth="wide">
      <PageHeader
        title={<><Camera size={20} color="#3b82f6" /> 影像质控专项</>}
        subtitle="ACR 模体测试 / 设备影像质量等级 / 剂量合规率 / 重拍率"
      />
      <StickyActionBar
        actions={[
          { key: "acr", label: "ACR 模体测试", onClick: () => message.success('ACR 模体测试已启动'), type: "primary", ariaLabel: "执行 ACR 模体测试" },
          { key: "snr", label: "SNR 测量", onClick: () => message.success('SNR 测量已启动'), type: "default", ariaLabel: "SNR 测量" },
          { key: "reject", label: "重拍率分析", onClick: () => message.success('重拍率分析已启动'), type: "default", ariaLabel: "重拍率分析" },
        ]}
        theme="light"
      />
      <div style={{ padding: 24 }}>
        <div style={{ marginBottom: 16, display: "flex", gap: 8 }}>
          {["all", "CT", "MR", "DR", "US", "MG", "DSA"].map((m) => (
            <button key={m} onClick={() => setModality(m)} style={{ padding: "6px 14px", background: modality === m ? "#1e40af" : "#fff", color: modality === m ? "#fff" : "#475569", border: "1px solid " + (modality === m ? "#1e40af" : "#cbd5e1"), borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
              {m === "all" ? "全部" : m}
            </button>
          ))}
        </div>

        <StatCardGrid columns={4} gap={12}>
          <StatCard label="A 级设备" value={stats.a} icon={<CheckCircle size={20} />} color="#10b981" subValue={`${stats.pct.a.toFixed(0)}%`} />
          <StatCard label="B 级" value={stats.b} icon={<Activity size={20} />} color="#3b82f6" subValue={`${stats.pct.b.toFixed(0)}%`} />
          <StatCard label="C 级" value={stats.c} icon={<AlertTriangle size={20} />} color="#f59e0b" subValue={`${stats.pct.c.toFixed(0)}%`} />
          <StatCard label="D 级 (需关注)" value={stats.d} icon={<AlertTriangle size={20} />} color="#dc2626" subValue={`${stats.pct.d.toFixed(0)}%`} />
        </StatCardGrid>

        <div style={{ marginTop: 24, background: "#fff", borderRadius: 10, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "#1e293b", margin: "0 0 16px" }}>设备影像质量详细</h3>
          <table style={{ width: "100%", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                {["设备 ID", "类型", "厂家型号", "影像等级", "剂量合规率", "月扫描", "故障率"].map((h) => (
                  <th key={h} style={{ padding: 10, textAlign: "left", fontWeight: 600, color: "#475569", borderBottom: "2px solid #e2e8f0" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DEVICE_MASTER.slice(0, 30).map((d) => (
                <tr key={d.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: 10, fontFamily: "monospace", fontSize: 11 }}>{d.id}</td>
                  <td style={{ padding: 10 }}>{d.modality}</td>
                  <td style={{ padding: 10 }}>{d.brand} {d.model}</td>
                  <td style={{ padding: 10 }}>
                    <span style={{ padding: "3px 10px", borderRadius: 4, fontSize: 11, fontWeight: 700, background: d.imageQualityGrade === "A" ? "#d1fae5" : d.imageQualityGrade === "D" ? "#fee2e2" : "#fef3c7", color: d.imageQualityGrade === "A" ? "#065f46" : d.imageQualityGrade === "D" ? "#991b1b" : "#92400e" }}>
                      {d.imageQualityGrade} 级
                    </span>
                  </td>
                  <td style={{ padding: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <div style={{ width: 60, height: 6, background: "#e2e8f0", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ width: `${d.doseComplianceRate}%`, height: "100%", background: d.doseComplianceRate >= 90 ? "#10b981" : d.doseComplianceRate >= 80 ? "#f59e0b" : "#dc2626" }} />
                      </div>
                      <span style={{ fontSize: 11, color: "#475569" }}>{d.doseComplianceRate}%</span>
                    </div>
                  </td>
                  <td style={{ padding: 10 }}>{d.monthlyScans}</td>
                  <td style={{ padding: 10 }}>{d.defectRate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </PageContainer>
  );
}