// ============================================================
// G005 放射科RIS系统 v1.0.4 - 关键字全量扫描页
// Phase R4：基于 R1 keywordChecker 引擎的全库扫描
// ============================================================

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Search, AlertTriangle, Info, CheckCircle2, XCircle,
  Filter, FileText, Tag, Settings,
  Activity,
  ShieldAlert, Wand2, Database, Loader2,
} from 'lucide-react';
import {
  ANATOMY_PAIR_RULES,
  POS_NEG_WORD_RULES,
  NEGATION_WORDS,
  PUNCTUATION_RULES,
  STANDARD_FORMAT_RULES,
  LESION_KEYWORDS_BY_MODALITY,
} from '../data/keywordRules';
import { checkKeywords, type KeywordCheckOutput, type KeywordIssue } from '../utils/keywordChecker';
import { extendedReportMock } from '../data/reportSubsystemMock';
import { reportApi } from '../services/api/reportApi';
import { DataTable } from '../components/common/DataTable';
import { ActionButton, ExportButton } from '../components/common';
import type { ColumnsType } from 'antd/es/table';
import { t } from '../i18n/appI18n';

// ============================================================
// 严重度配置
// ============================================================
const SEVERITY_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  error:   { label: t('kwc.sev.error'), color: '#ef4444', bg: '#ef444422', icon: XCircle },
  warning: { label: t('kwc.sev.warning'), color: '#f59e0b', bg: '#f59e0b22', icon: AlertTriangle },
  info:    { label: t('kwc.sev.info'), color: '#3b82f6', bg: '#3b82f622', icon: Info },
};

const CATEGORY_LABELS: Record<string, string> = {
  anatomy: t('kwc.cat.anatomy'),
  logic: t('kwc.cat.logic'),
  punctuation: t('kwc.cat.punctuation'),
  format: t('kwc.cat.format'),
  completeness: t('kwc.cat.completeness'),
  critical: t('kwc.cat.critical'),
};

// 扫描用报告行 (reportApi 归一化 / 演示报告回退)
interface ScanReportRow {
  id: string;
  patientName: string;
  modality: string;
  bodyPart: string;
  examItemName: string;
  examFindings: string;
  diagnosis: string;
  impression: string;
}

// ============================================================
// 主组件
// ============================================================
export default function KeywordCheckPage() {
  // [W2-A] 报告列表接 reportApi 实时 (失败回退演示报告)
  const [reports, setReports] = useState<ScanReportRow[]>(extendedReportMock);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<'api' | 'demo'>('demo');
  const [apiError, setApiError] = useState('');
  // 选中报告
  const [selectedReportId, setSelectedReportId] = useState<string>('rpt-013');
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanResult, setScanResult] = useState<KeywordCheckOutput | null>(null);
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [selectedIssue, setSelectedIssue] = useState<KeywordIssue | null>(null);

  const loadReports = useCallback(async () => {
    setLoading(true);
    setApiError('');
    try {
      const res = await reportApi.list({ take: '50' });
      const list = Array.isArray(res.data) ? res.data : Array.isArray((res.data as any)?.items) ? (res.data as any).items : [];
      if (Array.isArray(list) && list.length > 0) {
        const mapped: ScanReportRow[] = list.map((r: any) => ({
          id: String(r.id),
          patientName: String(r.patientName ?? r.reportId ?? r.id),
          modality: String(r.modality ?? 'CT'),
          bodyPart: String(r.bodyPart ?? ''),
          examItemName: `${r.modality ?? 'CT'} ${r.bodyPart ?? ''}`.trim(),
          examFindings: String(r.findings ?? ''),
          diagnosis: String(r.diagnosis ?? ''),
          impression: String(r.impression ?? ''),
        }));
        setReports(mapped);
        setSelectedReportId(mapped[0]?.id ?? 'rpt-013');
        setSource('api');
      } else {
        setSource('demo');
        setApiError(t('kwc.apiUnavailable'));
      }
    } catch (e) {
      setSource('demo');
      setApiError(e instanceof Error ? e.message : t('kwc.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadReports(); }, [loadReports]);

  // 当前报告
  const currentReport = reports.find(r => r.id === selectedReportId);

  // 模拟扫描
  const handleScan = () => {
    if (!currentReport) return;
    setScanning(true);
    setScanProgress(0);

    const interval = setInterval(() => {
      setScanProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setScanning(false);
          // 执行真实扫描
          const text = [
            currentReport.examFindings,
            currentReport.diagnosis,
            currentReport.impression,
          ].join('\n');
          const result = checkKeywords({
            text,
            modality: currentReport.modality,
            bodyPart: currentReport.bodyPart,
            hasFindings: !!currentReport.examFindings,
            hasImpression: !!currentReport.impression,
          });
          setScanResult(result);
          return 100;
        }
        return prev + 10;
      });
    }, 80);
  };

  // 过滤问题
  const filteredIssues = useMemo(() => {
    if (!scanResult) return [];
    return scanResult.issues.filter(issue => {
      if (filterSeverity !== 'all' && issue.severity !== filterSeverity) return false;
      if (filterCategory !== 'all' && issue.category !== filterCategory) return false;
      return true;
    });
  }, [scanResult, filterSeverity, filterCategory]);

  // 规则库统计
  const ruleStats = useMemo(() => ({
    anatomy: ANATOMY_PAIR_RULES.length,
    logic: POS_NEG_WORD_RULES.length,
    negation: NEGATION_WORDS.length,
    punctuation: PUNCTUATION_RULES.length,
    format: STANDARD_FORMAT_RULES.length,
    lesion: Object.values(LESION_KEYWORDS_BY_MODALITY).flat().length,
  }), []);

  const reportColumns: ColumnsType<ScanReportRow> = [
    {
      title: t('w3tables.col.patient'), dataIndex: 'patientName', key: 'patientName',
      render: (_: unknown, r) => (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{r.patientName}</span>
          <span style={{ fontSize: 12, padding: '1px 4px', background: 'var(--color-info-bg)', color: '#1e40af', borderRadius: 2 }}>{r.modality}</span>
        </div>
      ),
    },
    { title: t('w3tables.col.examItem'), dataIndex: 'examItemName', key: 'examItemName' },
    { title: t('w3tables.col.reportNo'), dataIndex: 'id', key: 'id', width: 130 },
  ];

  const issueColumns: ColumnsType<KeywordIssue> = [
    {
      title: t('kwc.severity'), dataIndex: 'severity', key: 'severity', width: 100,
      render: (v: string) => {
        const sConf = SEVERITY_CONFIG[v];
        if (!sConf) return v;
        const SIcon = sConf.icon;
        return (
          <span style={{ fontSize: 12, padding: '1px 5px', borderRadius: 2, background: sConf.bg, color: sConf.color, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
            <SIcon size={9} /> {sConf.label}
          </span>
        );
      },
    },
    { title: t('kwc.categoryLabel'), dataIndex: 'category', key: 'category', width: 110, render: (v: string) => CATEGORY_LABELS[v] },
    {
      title: t('w3tables.col.description'), dataIndex: 'message', key: 'message',
      render: (v: string, issue) => (
        <div style={{ minWidth: 220 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{v}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{issue.suggestion}</div>
          {issue.matched && issue.matched !== '未找到' && (
            <div style={{ fontSize: 12, padding: '2px 6px', background: 'var(--color-warning-bg)', color: '#78350f', borderRadius: 3, marginTop: 4, display: 'inline-block', fontFamily: 'monospace' }}>"{issue.matched}"</div>
          )}
        </div>
      ),
    },
  ];

  return (
    <div style={{ padding: 20, maxWidth: 1600, margin: '0 auto' }}>
      {/* 顶部 */}
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Search size={20} color="#3b82f6" /> {t('kwc.title')}
            <span style={{ fontSize: 12, padding: '2px 6px', background: '#10b981', color: '#fff', borderRadius: 3, fontWeight: 700 }}>R4</span>
            <span style={{
              fontSize: 11, padding: '2px 8px', borderRadius: 10,
              background: source === 'api' ? 'var(--color-success-bg)' : 'var(--color-warning-bg)',
              color: source === 'api' ? '#16a34a' : '#92400e',
              border: `1px solid ${source === 'api' ? '#bbf7d0' : '#fde68a'}`,
              fontWeight: 500,
            }}>
              {loading ? t('kwc.syncing') : source === 'api' ? t('kwc.sourceApi') : t('kwc.sourceDemo')}
            </span>
          </h1>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
            {t('kwc.subtitle', { count: ruleStats.anatomy + ruleStats.logic + ruleStats.negation + ruleStats.punctuation + ruleStats.format + ruleStats.lesion })}
            {apiError && <span style={{ color: '#dc2626', marginLeft: 8 }}>{apiError}</span>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleScan}
            disabled={scanning}
            style={{
              padding: '8px 16px', border: 'none', borderRadius: 6,
              background: scanning ? '#94a3b8' : '#3b82f6',
              color: '#fff', fontSize: 13, fontWeight: 600,
              cursor: scanning ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
              boxShadow: '0 2px 4px rgba(59, 130, 246, 0.3)',
            }}
          >
            {scanning ? <Loader2 size={14} className="spin" /> : <Wand2 size={14} />}
            {scanning ? `扫描中 ${scanProgress}%` : t('kwc.startScan')}
          </button>
          <ActionButton action="refresh" loading={loading} onClick={() => void loadReports()}>{t('w45.actions.refresh')}</ActionButton>
          <ExportButton
            data={() => scanResult?.issues ?? reports}
            filename="keyword-check"
            label={t('w45.actions.export')}
            size="small"
            formats={["csv", "json"]}
          />
        </div>
      </div>

      {/* 规则库统计 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8, marginBottom: 16 }}>
        <RuleStatCard icon={Activity} label={t('kwc.cat.anatomy')} count={ruleStats.anatomy} color="#3b82f6" />
        <RuleStatCard icon={ShieldAlert} label={t('kwc.cat.logic')} count={ruleStats.logic} color="#dc2626" />
        <RuleStatCard icon={XCircle} label={t('kwc.negation')} count={ruleStats.negation} color="#f59e0b" />
        <RuleStatCard icon={Tag} label={t('kwc.rulePunctuation')} count={ruleStats.punctuation} color="#7c3aed" />
        <RuleStatCard icon={Settings} label={t('kwc.standardFormat')} count={ruleStats.format} color="#0891b2" />
        <RuleStatCard icon={Database} label={t('kwc.lesionKeywords')} count={ruleStats.lesion} color="#10b981" />
      </div>

      {/* 报告选择器 + 扫描区 */}
      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 12 }}>
        {/* 左：报告列表 */}
        <div style={{
          background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-color)',
          overflow: 'hidden', alignSelf: 'flex-start',
        }}>
          <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#1e40af', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              <FileText size={12} /> {t('kwc.selectReport')} ({reports.length})
            </div>
          </div>
          <DataTable<ScanReportRow>
            columns={reportColumns}
            dataSource={reports}
            rowKey="id"
            loading={loading}
            showPagination={false}
            emptyText={t('w3tables.empty')}
            onRow={(r) => ({
              onClick: () => { setSelectedReportId(r.id); setScanResult(null); },
              style: { cursor: 'pointer', background: selectedReportId === r.id ? 'var(--color-info-bg)' : undefined },
            })}
            scroll={{ x: 'max-content' }}
          />
        </div>

        {/* 右：扫描结果 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* 当前报告 */}
          {currentReport && (
            <div style={{
              background: 'var(--bg-card)', borderRadius: 8, padding: 16, border: '1px solid var(--border-color)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {currentReport.patientName} · {currentReport.modality} {currentReport.bodyPart}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{t('kwc.reportIdLabel')}{currentReport.id}</div>
                </div>
                {scanResult && (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <div style={{
                      fontSize: 26, fontWeight: 700,
                      color: scanResult.score >= 90 ? '#10b981' : scanResult.score >= 75 ? '#3b82f6' : scanResult.score >= 60 ? '#f59e0b' : '#dc2626',
                    }}>{scanResult.score}</div>
                    <div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('kwc.totalScore')}</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: scanResult.passed ? '#10b981' : '#dc2626' }}>
                        {scanResult.passed ? t('kwc.passed') : t('kwc.failed')}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 进度条 */}
              {scanning && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ height: 8, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{
                      width: `${scanProgress}%`, height: '100%',
                      background: 'linear-gradient(90deg, #3b82f6, #7c3aed)',
                      transition: 'width 0.1s linear',
                    }} />
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, textAlign: 'center' }}>
                    {t('kwc.scanning', { percent: scanProgress })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 扫描结果统计 */}
          {scanResult && !scanning && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                <ScoreCard icon={XCircle} label={t('kwc.sev.error')} count={scanResult.errorCount} color="#dc2626" />
                <ScoreCard icon={AlertTriangle} label={t('kwc.sev.warning')} count={scanResult.warningCount} color="#f59e0b" />
                <ScoreCard icon={Info} label={t('kwc.sev.info')} count={scanResult.infoCount} color="#3b82f6" />
                <ScoreCard icon={CheckCircle2} label={t('kwc.totalIssues')} count={scanResult.totalIssues} color="#7c3aed" />
              </div>

              {/* 过滤器 */}
              <div style={{
                background: 'var(--bg-card)', borderRadius: 8, padding: 10, border: '1px solid var(--border-color)',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <Filter size={12} color="var(--text-secondary)" />
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('kwc.filterLabel')}</span>
                <select value={filterSeverity} onChange={e => setFilterSeverity(e.target.value)} style={selectStyle}>
                  <option value="all">{t('kwc.allSeverities')}</option>
                  <option value="error">{t('kwc.sev.error')}</option>
                  <option value="warning">{t('kwc.sev.warning')}</option>
                  <option value="info">{t('kwc.sev.info')}</option>
                </select>
                <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} style={selectStyle}>
                  <option value="all">{t('kwc.allCategories')}</option>
                  {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
                <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-secondary)' }}>
                  {t('kwc.showCount', { shown: filteredIssues.length, total: scanResult.totalIssues })}
                </span>
              </div>

              {/* 问题列表 */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8 }}>
                {/* 左：问题列表 */}
                <div style={{
                  background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-color)',
                  overflow: 'hidden',
                }}>
                  <DataTable<KeywordIssue>
                    columns={issueColumns}
                    dataSource={filteredIssues}
                    rowKey="id"
                    showPagination={false}
                    scroll={{ x: 'max-content' }}
                    emptyText={(
                      <div style={{ padding: 20, textAlign: 'center', color: '#10b981' }}>
                        <CheckCircle2 size={40} style={{ display: 'block', margin: '0 auto 8px' }} />
                        <div style={{ fontSize: 13, fontWeight: 700 }}>{t('kwc.noIssues')}</div>
                        <div style={{ fontSize: 12, marginTop: 4 }}>{t('kwc.noIssuesHint')}</div>
                      </div>
                    )}
                    onRow={(issue) => ({
                      onClick: () => setSelectedIssue(issue),
                      style: { cursor: 'pointer', background: selectedIssue?.id === issue.id ? 'var(--color-info-bg)' : undefined },
                    })}
                  />
                </div>

                {/* 右：详情 + 建议 */}
                <div style={{
                  background: 'var(--bg-card)', borderRadius: 8, padding: 12, border: '1px solid var(--border-color)',
                }}>
                  {selectedIssue ? (
                    <>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#1e40af', marginBottom: 8 }}>{t('kwc.issueDetail')}</div>
                      <DetailRow label={t('kwc.severity')} value={SEVERITY_CONFIG[selectedIssue.severity]!.label} color={SEVERITY_CONFIG[selectedIssue.severity]!.color} />
                      <DetailRow label={t('kwc.categoryLabel')} value={CATEGORY_LABELS[selectedIssue.category]!} />
                      <DetailRow label={t('kwc.ruleId')} value={selectedIssue.ruleId} />
                      <DetailRow label={t('kwc.position')} value={selectedIssue.position >= 0 ? t('kwc.charPosition', { pos: selectedIssue.position }) : t('kwc.fullText')} />
                      <div style={{ marginTop: 8, padding: 8, background: 'var(--bg-card)', borderRadius: 4 }}>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{t('kwc.suggestionLabel')}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>{selectedIssue.suggestion}</div>
                      </div>
                    </>
                  ) : (
                    <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: 12, padding: 20 }}>
                      {t('kwc.clickIssue')}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {!scanResult && !scanning && (
            <div style={{
              background: 'var(--bg-card)', borderRadius: 8, padding: 40, textAlign: 'center',
              border: '1px dashed var(--border-color)',
            }}>
              <Search size={48} style={{ color: '#cbd5e1', display: 'block', margin: '0 auto 8px' }} />
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>{t('kwc.scanPrompt')}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                {t('kwc.scanPromptHint')}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 样式
// ============================================================
const selectStyle: React.CSSProperties = {
  padding: '4px 8px', border: '1px solid var(--border-color)', borderRadius: 4,
  fontSize: 12, };

// ============================================================
// 规则统计卡
// ============================================================
const RuleStatCard: React.FC<{ icon: any; label: string; count: number; color: string }> = ({ icon: Icon, label, count, color }) => (
  <div style={{
    background: 'var(--bg-card)', padding: 10, borderRadius: 8,
    border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 8,
  }}>
    <div style={{
      width: 32, height: 32, borderRadius: 6,
      background: `${color}15`, color: color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <Icon size={16} />
    </div>
    <div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{count} <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('kwc.unitCount')}</span></div>
    </div>
  </div>
);

// ============================================================
// 评分卡
// ============================================================
const ScoreCard: React.FC<{ icon: any; label: string; count: number; color: string }> = ({ icon: Icon, label, count, color }) => (
  <div style={{
    background: 'var(--bg-card)', padding: 12, borderRadius: 8,
    border: `1px solid ${color}30`,
    textAlign: 'center',
  }}>
    <Icon size={20} color={color} style={{ display: 'block', margin: '0 auto 4px' }} />
    <div style={{ fontSize: 22, fontWeight: 700, color }}>{count}</div>
    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</div>
  </div>
);

// ============================================================
// 详情行
// ============================================================
const DetailRow: React.FC<{ label: string; value: string; color?: string }> = ({ label, value, color }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 0' }}>
    <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
    <span style={{ fontWeight: 600, color: color || 'var(--text-primary)' }}>{value}</span>
  </div>
);
