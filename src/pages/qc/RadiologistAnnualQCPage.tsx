/**
 * G005 RIS v3.0.6.8-27 - 医生年度质控档案
 * 展示每位医生全年的质控 KPI 趋势 + 评分历史
 */
import { useMemo, useState, useEffect } from 'react';
import { Users, Award, TrendingUp, TrendingDown, ChevronRight } from "lucide-react";
import { PageContainer } from "../../components/common/PageContainer";
import { PageHeader } from "../../components/common/PageHeader";
import { StickyActionBar } from "../../components/common/StickyActionBar";
import { StatCard, StatCardGrid } from "../../components/common/StatCard";
import { DOCTOR_MASTER } from '../../data/master';
import { DOCTOR_PERFORMANCE_PRE } from "../../data/_generators";
import { qcextApi, type RadiologistAnnualDto } from '../../services/api/qcextApi';

export default function RadiologistAnnualQCPage() {
  const [selectedId, setSelectedId] = useState<string | null>(DOCTOR_MASTER[0]?.id || null);
  const [search, setSearch] = useState("");
  const [_annualData, setAnnualData] = useState<RadiologistAnnualDto[]>([]);
  useEffect(() => {
    qcextApi.listRadiologistAnnual().then(res => { if (res.success) setAnnualData(res.data); }).catch((err) => { console.error('[F04]', err); });
  }, []);

  const filteredDoctors = useMemo(() => {
    return DOCTOR_MASTER.filter((d) =>
      d.title !== "技师" && d.title !== "护士" && d.title !== "护师"
    ).filter((d) => !search || d.name.includes(search) || d.id.includes(search));
  }, [search]);

  const selected = DOCTOR_MASTER.find((d) => d.id === selectedId);
  const selectedHistory = useMemo(() => {
    return DOCTOR_PERFORMANCE_PRE.filter((p) => p.doctorId === selectedId);
  }, [selectedId]);

  return (
    <PageContainer background="slate" maxWidth="wide">
      <PageHeader
        title={<><Users size={20} color="#7c3aed" /> 医生年度质控档案</>}
        subtitle="每位医生全年质控 KPI 趋势 / 评分历史 / 绩效分析"
      />
      <StickyActionBar
        actions={[
          { key: "export", label: "导出档案", onClick: () => {}, type: "primary", ariaLabel: "导出医生档案" },
          { key: "compare", label: "对比分析", onClick: () => {}, type: "default", ariaLabel: "对比分析" },
        ]}
        theme="light"
      />
      <div style={{ padding: 24, display: "grid", gridTemplateColumns: "300px 1fr", gap: 16 }}>
        {/* 左侧: 医生列表 */}
        <div style={{ background: "#fff", borderRadius: 10, padding: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", maxHeight: 800, overflowY: "auto" }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索医生..."
            style={{ width: "100%", padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 13, marginBottom: 12 }}
          />
          {filteredDoctors.slice(0, 50).map((d) => (
            <button
              key={d.id}
              onClick={() => setSelectedId(d.id)}
              style={{
                width: "100%",
                padding: 10,
                background: selectedId === d.id ? "#eff6ff" : "transparent",
                border: "1px solid " + (selectedId === d.id ? "#3b82f6" : "transparent"),
                borderRadius: 6,
                cursor: "pointer",
                marginBottom: 4,
                display: "flex",
                alignItems: "center",
                gap: 8,
                textAlign: "left",
              }}
            >
              <div style={{ width: 32, height: 32, background: "#1e40af", color: "#fff", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700 }}>
                {d.name[0]}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{d.name}</div>
                <div style={{ fontSize: 11, color: "#64748b" }}>{d.id} · {d.title}</div>
              </div>
              {selectedId === d.id && <ChevronRight size={14} color="#3b82f6" />}
            </button>
          ))}
        </div>

        {/* 右侧: 详情 */}
        {selected && (
          <div>
            <div style={{ background: "#fff", borderRadius: 10, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
                <div style={{ width: 64, height: 64, background: "linear-gradient(135deg, #1e40af, #3b82f6)", color: "#fff", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 700 }}>
                  {selected.name[0]}
                </div>
                <div style={{ flex: 1 }}>
                  <h2 style={{ fontSize: 22, fontWeight: 700, color: "#1e293b", margin: 0 }}>{selected.name}</h2>
                  <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
                    {selected.id} · {selected.title} · {selected.subspecialty} · 工龄 {selected.yearsOfExperience} 年
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 32, fontWeight: 800, color: selected.annualQCScore >= 90 ? "#10b981" : "#f59e0b" }}>{selected.annualQCScore}</div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>年度质控分</div>
                </div>
              </div>
              <StatCardGrid columns={5} gap={8}>
                <StatCard label="月报告" value={selected.monthlyReportCount} icon={<Award size={16} />} color="#1e40af" />
                <StatCard label="月危急值" value={selected.monthlyCriticalValueCount} icon={<Award size={16} />} color="#dc2626" />
                <StatCard label="月双签" value={selected.monthlyCosignCount} icon={<Award size={16} />} color="#f59e0b" />
                <StatCard label="缺陷率" value={selected.defectRate as unknown as string} icon={<TrendingDown size={16} />} color="#dc2626" />
                <StatCard label="及时率" value={selected.timelyRate as unknown as string} icon={<TrendingUp size={16} />} color="#10b981" />
              </StatCardGrid>
            </div>

            <div style={{ background: "#fff", borderRadius: 10, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "#1e293b", margin: "0 0 16px" }}>月度质控趋势</h3>
              {selectedHistory.length > 0 ? (
                <div>
                  <div style={{ height: 200, display: "flex", alignItems: "flex-end", gap: 8, padding: "0 8px" }}>
                    {selectedHistory.map((h) => (
                      <div key={h.id} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                        <div style={{ fontSize: 10, color: "#1e293b", fontWeight: 700 }}>{h.qcScore}</div>
                        <div style={{ width: "100%", height: `${(h.qcScore / 100) * 160}px`, background: h.qcScore >= 90 ? "linear-gradient(180deg, #10b981, #059669)" : h.qcScore >= 80 ? "linear-gradient(180deg, #f59e0b, #d97706)" : "linear-gradient(180deg, #dc2626, #991b1b)", borderRadius: "4px 4px 0 0", minHeight: 4 }} />
                        <div style={{ fontSize: 9, color: "#94a3b8" }}>{h.month.slice(5)}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 16, fontSize: 12, color: "#475569" }}>
                    <strong>6 个月累计:</strong> {selectedHistory.length} 个月 · 平均分 {(selectedHistory.reduce((s, h) => s + h.qcScore, 0) / selectedHistory.length).toFixed(1)} · 趋势 {selectedHistory[selectedHistory.length - 1]!.qcScore > selectedHistory[0]!.qcScore ? "↑ 上升" : "↓ 下降"}
                  </div>
                </div>
              ) : (
                <div style={{ padding: 40, textAlign: "center", color: "#94a3b8", fontSize: 14 }}>暂无历史评分数据</div>
              )}
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  );
}