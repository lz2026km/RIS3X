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
import { DataTable } from "../../components/common";
import { EmptyState } from "../../components/common/EmptyState";
import { AppText } from "../../components/common/AppText";
import { DOCTOR_MASTER } from '../../data/master';
import { DOCTOR_PERFORMANCE_PRE } from "../../data/_generators";
import { qcextApi, type RadiologistAnnualDto } from '../../services/api/qcextApi';
import { LoadingBanner, ErrorBanner } from '../../components/feedback';
import { t } from '../../i18n/appI18n';

type AnnualCompareRow = { metric: string; selected: string | number; dept: string | number; unit: string; better: string };

function downloadCsv(filename: string, sections: Array<{ title: string; rows: (string | number)[][] }>) {
  const lines: string[] = [];
  sections.forEach((s) => {
    lines.push(`### ${s.title}`);
    s.rows.forEach((r) => lines.push(r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')));
    lines.push('');
  });
  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function RadiologistAnnualQCPage() {
  const [selectedId, setSelectedId] = useState<string | null>(DOCTOR_MASTER[0]?.id || null);
  const [search, setSearch] = useState("");
  const [showCompare, setShowCompare] = useState(false);
  const [_annualData, setAnnualData] = useState<RadiologistAnnualDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  useEffect(() => {
    qcextApi.listRadiologistAnnual()
      .then(res => { if (res.success) { setAnnualData(res.data); setLoadError(null); } })
      .catch((err) => { console.error('[F04]', err); setLoadError(t('w9.states.error')); })
      .finally(() => setLoading(false));
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

  // 对比分析: 选中医生 vs 科室平均 (6 个月全量绩效派生)
  const compareData = useMemo(() => {
    const mine = selectedHistory;
    const dept = DOCTOR_PERFORMANCE_PRE;
    const avg = (arr: number[]) => (arr.length ? arr.reduce((s, n) => s + n, 0) / arr.length : 0);
    if (mine.length === 0) return [];
    return [
      { metric: 'annualQc.metric.monthlyReports', selected: Math.round(avg(mine.map((h) => h.reportCount))), dept: Math.round(avg(dept.map((h) => h.reportCount))), unit: 'annualQc.unit.copies', better: 'high' },
      { metric: 'annualQc.metric.avgQcScore', selected: avg(mine.map((h) => h.qcScore)).toFixed(1), dept: avg(dept.map((h) => h.qcScore)).toFixed(1), unit: 'annualQc.unit.points', better: 'high' },
      { metric: 'annualQc.metric.defectRate', selected: avg(mine.map((h) => h.defectRate)).toFixed(1), dept: avg(dept.map((h) => h.defectRate)).toFixed(1), unit: '%', better: 'low' },
      { metric: 'annualQc.metric.timelyRate', selected: avg(mine.map((h) => h.timelyRate)).toFixed(1), dept: avg(dept.map((h) => h.timelyRate)).toFixed(1), unit: '%', better: 'high' },
      { metric: 'annualQc.metric.avgTat', selected: Math.round(avg(mine.map((h) => h.avgTAT))), dept: Math.round(avg(dept.map((h) => h.avgTAT))), unit: 'annualQc.unit.points', better: 'low' },
      { metric: 'annualQc.metric.monthlyCritical', selected: Math.round(avg(mine.map((h) => h.criticalValueCount))), dept: Math.round(avg(dept.map((h) => h.criticalValueCount))), unit: 'annualQc.unit.cases', better: 'low' },
    ];
  }, [selectedHistory]);

  // 导出档案: 医生基本信息 + 月度趋势 + 年度档案 → CSV
  const handleExportAnnual = () => {
    if (!selected) return;
    const sections: Array<{ title: string; rows: (string | number)[][] }> = [
      {
        title: '医生基本信息',
        rows: [
          ['工号', selected.id],
          ['姓名', selected.name],
          ['职称', selected.title],
          ['亚专科', selected.subspecialty],
          ['工龄(年)', selected.yearsOfExperience],
          ['年度质控分', selected.annualQCScore],
          ['月报告数', selected.monthlyReportCount],
          ['月危急值', selected.monthlyCriticalValueCount],
          ['月双签', selected.monthlyCosignCount],
          ['缺陷率', selected.defectRate as unknown as string],
          ['及时率', selected.timelyRate as unknown as string],
        ],
      },
      {
        title: '月度质控趋势(评分/工作量/缺陷)',
        rows: [
          ['月份', '质控分', '报告量', '缺陷数', '缺陷率(%)', '及时率(%)', '平均TAT(分)', '等级'],
          ...selectedHistory.map((h) => [h.month, h.qcScore, h.reportCount, h.defectCount, h.defectRate, h.timelyRate, h.avgTAT, h.grade]),
        ],
      },
    ];
    const annual = _annualData.filter((a) => a.doctorId === selected.id);
    if (annual.length > 0) {
      sections.push({
        title: '医生年度质控档案',
        rows: [
          ['年度', '总分', '格式分', '准确分', '及时分', '报告数', '缺陷数', '等级'],
          ...annual.map((a) => [a.year, a.totalScore, a.formatScore, a.accuracyScore, a.timelinessScore, a.reportCount, a.defectCount, a.grade]),
        ],
      });
    }
    downloadCsv(`医生年度档案_${selected.name}.csv`, sections);
  };

  return (
    <PageContainer background="slate" maxWidth="wide">
      <PageHeader
        icon={<Users size={20} color="#7c3aed" />}
        title={t('annualQc.title')}
        subtitle={t('annualQc.subtitle')}
      />
      {loading && <LoadingBanner message={t('w9.states.loading')} />}
      {loadError && !loading && <ErrorBanner message={loadError} />}
      <StickyActionBar
        actions={[
          { key: "export", label: t('annualQc.exportProfile'), onClick: handleExportAnnual, type: "primary", ariaLabel: t('annualQc.exportProfileAria') },
          { key: "compare", label: showCompare ? t('annualQc.closeCompare') : t('annualQc.compare'), onClick: () => setShowCompare((v) => !v), type: "default", ariaLabel: t('annualQc.compareAria') },
        ]}
        theme="light"
      />
      {showCompare && selected && compareData.length > 0 && (
        <div style={{ padding: "0 24px 16px" }}>
          <div style={{ background: "var(--bg-card)", borderRadius: 10, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 12px" }}>
              {t('annualQc.compareTitle', { name: selected.name })}
              <span style={{ marginLeft: 8, padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600, background: "var(--color-warning-bg)", color: "#92400e" }}>{t('annualQc.demoData')}</span>
            </h3>
            <div style={{ overflowX: "auto" }}>
              <DataTable<AnnualCompareRow>
                rowKey="metric"
                dataSource={compareData}
                showPagination={false}
                showExport={false}
                showDensity={false}
                columns={[
                  { title: t('annualQc.colMetric'), dataIndex: 'metric', key: 'metric', render: (v: string) => t(v) },
                  {
                    title: selected.name, key: 'selected', align: 'right',
                    render: (_: unknown, c: AnnualCompareRow) => (
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{c.selected} {t(c.unit)}</span>
                    ),
                  },
                  {
                    title: t('annualQc.colDeptAvg'), key: 'dept', align: 'right',
                    render: (_: unknown, c: AnnualCompareRow) => <>{c.dept} {t(c.unit)}</>,
                  },
                  {
                    title: t('annualQc.colDiff'), key: 'diff', align: 'right',
                    render: (_: unknown, c: AnnualCompareRow) => {
                      const diff = parseFloat(String(c.selected)) - parseFloat(String(c.dept));
                      return (
                        <span style={{ color: diff === 0 ? '#64748b' : diff > 0 ? '#059669' : '#dc2626', fontWeight: 600 }}>
                          {diff > 0 ? '+' : ''}{Math.abs(diff) < 0.05 ? '0' : diff.toFixed(1)} {t(c.unit)}
                        </span>
                      );
                    },
                  },
                  {
                    title: t('annualQc.colConclusion'), key: 'conclusion', align: 'center',
                    render: (_: unknown, c: AnnualCompareRow) => {
                      const diff = parseFloat(String(c.selected)) - parseFloat(String(c.dept));
                      const better = c.better === 'low' ? diff < 0 : diff > 0;
                      return (
                        <span style={{ padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: better ? 'var(--color-success-bg)' : 'var(--color-error-bg)', color: better ? '#065f46' : '#991b1b' }}>
                          {better ? t('annualQc.betterThanAvg') : t('annualQc.belowAvg')}
                        </span>
                      );
                    },
                  },
                ]}
              />
            </div>
          </div>
        </div>
      )}
      <div style={{ padding: 24, display: "grid", gridTemplateColumns: "300px 1fr", gap: 16 }}>
        {/* 左侧: 医生列表 */}
        <div style={{ background: "var(--bg-card)", borderRadius: 10, padding: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", maxHeight: 800, overflowY: "auto" }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('annualQc.searchDoctor')}
            style={{ width: "100%", padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 12, marginBottom: 12 }}
          />
          {filteredDoctors.slice(0, 50).map((d) => (
            <button
              key={d.id}
              onClick={() => setSelectedId(d.id)}
              style={{
                width: "100%",
                padding: 10,
                background: selectedId === d.id ? "var(--color-info-bg)" : "transparent",
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
                <AppText size="sm" weight={600} style={{ display: "block" }}>{d.name}</AppText>
                <AppText size="xs" color="muted" as="div">{d.id} · {d.title}</AppText>
              </div>
              {selectedId === d.id && <ChevronRight size={14} color="#3b82f6" />}
            </button>
          ))}
        </div>

        {/* 右侧: 详情 */}
        {selected && (
          <div>
            <div style={{ background: "var(--bg-card)", borderRadius: 10, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
                <div style={{ width: 64, height: 64, background: "linear-gradient(135deg, #1e40af, #3b82f6)", color: "#fff", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, fontWeight: 700 }}>
                  {selected.name[0]}
                </div>
                <div style={{ flex: 1 }}>
                  <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>{selected.name}</h2>
                  <AppText size="sm" color="secondary" style={{ marginTop: 4, display: "block" }}>
                    {selected.id} · {selected.title} · {selected.subspecialty} · {t('annualQc.yearsOfService', { years: selected.yearsOfExperience })}
                  </AppText>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: selected.annualQCScore >= 90 ? "#10b981" : "#f59e0b" }}>{selected.annualQCScore}</div>
                  <AppText size="xs" color="muted" as="div">{t('annualQc.annualScore')}</AppText>
                </div>
              </div>
              <StatCardGrid columns={5} gap={8}>
                <StatCard label={t('annualQc.monthlyReports')} value={selected.monthlyReportCount} icon={<Award size={16} />} color="#1e40af" />
                <StatCard label={t('annualQc.monthlyCritical')} value={selected.monthlyCriticalValueCount} icon={<Award size={16} />} color="#dc2626" />
                <StatCard label={t('annualQc.monthlyCosign')} value={selected.monthlyCosignCount} icon={<Award size={16} />} color="#f59e0b" />
                <StatCard label={t('annualQc.defectRate')} value={selected.defectRate as unknown as string} icon={<TrendingDown size={16} />} color="#dc2626" />
                <StatCard label={t('annualQc.timelyRate')} value={selected.timelyRate as unknown as string} icon={<TrendingUp size={16} />} color="#10b981" />
              </StatCardGrid>
            </div>

            <div style={{ background: "var(--bg-card)", borderRadius: 10, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 16px" }}>{t('annualQc.monthlyTrend')}
                <span style={{ marginLeft: 8, padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600, background: "var(--color-warning-bg)", color: "#92400e" }}>{t('annualQc.demoData')}</span>
              </h3>
              {selectedHistory.length > 0 ? (
                <div>
                  <div style={{ height: 200, display: "flex", alignItems: "flex-end", gap: 8, padding: "0 8px" }}>
                    {selectedHistory.map((h) => (
                      <div key={h.id} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                        <div style={{ fontSize: 10, color: "var(--text-primary)", fontWeight: 700 }}>{h.qcScore}</div>
                        <div style={{ width: "100%", height: `${(h.qcScore / 100) * 160}px`, background: h.qcScore >= 90 ? "linear-gradient(180deg, #10b981, #059669)" : h.qcScore >= 80 ? "linear-gradient(180deg, #f59e0b, #d97706)" : "linear-gradient(180deg, #dc2626, #991b1b)", borderRadius: "4px 4px 0 0", minHeight: 4 }} />
                        <div style={{ fontSize: 10, color: "#94a3b8" }}>{h.month.slice(5)}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 16, fontSize: 12, color: "#475569" }}>
                    <strong>{t('annualQc.sixMonthCumulative')}</strong> {t('annualQc.summary', { months: selectedHistory.length, avg: (selectedHistory.reduce((s, h) => s + h.qcScore, 0) / selectedHistory.length).toFixed(1), trend: selectedHistory[selectedHistory.length - 1]!.qcScore > selectedHistory[0]!.qcScore ? t('annualQc.trendUp') : t('annualQc.trendDown') })}
                  </div>
                </div>
              ) : (
                <EmptyState description={t('annualQc.noHistory')} />
              )}
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  );
}