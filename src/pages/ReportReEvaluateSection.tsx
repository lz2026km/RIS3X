// [v3.0.6.11-104 Wave 2D] 报告质量复评区块
// 接入 GET /report-quality-ext/score-rules · POST /reports/quality/re-evaluate/:reportId
import { useCallback, useEffect, useState } from 'react';
import { Button, Checkbox, Input, InputNumber, Space, Tag, message } from 'antd';
import type { TableColumnsType } from 'antd';
import { ClipboardCheck, FileText, RefreshCw, Save } from 'lucide-react';
import {
  reportQualityApi,
  type QualityEvaluation,
  type ScoreRule,
} from '../services/api/reportQualityApi';
import { DashboardCard } from '../components/dashboard/DashboardCard';
import { DataTable } from '../components/common/DataTable';
import { StateView } from '../components/common/StateView';
import { t } from '../i18n/appI18n';

function renderRuleValue(v: unknown): string {
  if (v === null || v === undefined) return '-';
  if (typeof v === 'object') {
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }
  return String(v);
}

export function ReportReEvaluateSection() {
  const [rules, setRules] = useState<ScoreRule[]>([]);
  const [rulesLoading, setRulesLoading] = useState(true);
  const [rulesError, setRulesError] = useState<string | null>(null);

  const [reportId, setReportId] = useState('');
  const [findings, setFindings] = useState('');
  const [conclusion, setConclusion] = useState('');
  const [suggestion, setSuggestion] = useState('');
  const [radsCategory, setRadsCategory] = useState('');
  const [hasCritical, setHasCritical] = useState(false);
  const [verified, setVerified] = useState(false);
  const [structuredCompletion, setStructuredCompletion] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<QualityEvaluation | null>(null);

  const loadRules = useCallback(async () => {
    setRulesLoading(true);
    setRulesError(null);
    const res = await reportQualityApi.getScoreRules();
    if (res.success) setRules(res.data?.items ?? []);
    else setRulesError(res.error?.message ?? t('w2d.loadFailed'));
    setRulesLoading(false);
  }, []);

  useEffect(() => {
    void loadRules();
  }, [loadRules]);

  const handleReEvaluate = async () => {
    if (!reportId.trim()) {
      message.warning(t('rqExt.reportIdRequired'));
      return;
    }
    if (!findings.trim() || !conclusion.trim()) {
      message.warning(t('rqExt.contentRequired'));
      return;
    }
    setSubmitting(true);
    const res = await reportQualityApi.reEvaluate(reportId.trim(), {
      reportId: reportId.trim(),
      findings: findings.trim(),
      conclusion: conclusion.trim(),
      suggestion: suggestion.trim() || undefined,
      radsCategory: radsCategory.trim() || undefined,
      hasCritical,
      verified,
      structuredCompletion: structuredCompletion ?? undefined,
    });
    setSubmitting(false);
    if (res.success && res.data) {
      setResult(res.data);
      message.success(t('rqExt.evaluated'));
    } else {
      message.error(res.error?.message ?? t('w2d.loadFailed'));
    }
  };

  const ruleColumns: TableColumnsType<ScoreRule> = [
    { title: t('rqExt.ruleKey'), dataIndex: 'key', key: 'key' },
    { title: t('rqExt.ruleValue'), dataIndex: 'value', key: 'value', render: (v: unknown) => <span style={{ fontSize: 12, fontFamily: 'monospace' }}>{renderRuleValue(v)}</span> },
  ];

  return (
    <Space direction="vertical" size={16} style={{ width: '100%', marginTop: 16 }}>
      <DashboardCard
        title={t('rqExt.reEvaluate')}
        icon={<ClipboardCheck size={15} />}
        extra={
          <Button size="small" icon={<RefreshCw size={12} />} onClick={() => void loadRules()} loading={rulesLoading}>
            {t('w2d.refresh')}
          </Button>
        }
      >
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{t('rqExt.reportId')}</div>
              <Input value={reportId} onChange={(e) => setReportId(e.target.value)} placeholder={t('rqExt.reportId')} allowClear />
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{t('rqExt.radsCategory')}</div>
              <Input value={radsCategory} onChange={(e) => setRadsCategory(e.target.value)} placeholder="RADS" allowClear />
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{t('rqExt.findings')}</div>
            <Input.TextArea rows={3} value={findings} onChange={(e) => setFindings(e.target.value)} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{t('rqExt.conclusion')}</div>
            <Input.TextArea rows={2} value={conclusion} onChange={(e) => setConclusion(e.target.value)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{t('rqExt.suggestion')}</div>
              <Input value={suggestion} onChange={(e) => setSuggestion(e.target.value)} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{t('rqExt.structuredCompletion')}</div>
              <InputNumber min={0} max={1} step={0.1} value={structuredCompletion} onChange={(v) => setStructuredCompletion(v)} style={{ width: '100%' }} />
            </div>
          </div>
          <Space wrap>
            <Checkbox checked={hasCritical} onChange={(e) => setHasCritical(e.target.checked)}>{t('rqExt.hasCritical')}</Checkbox>
            <Checkbox checked={verified} onChange={(e) => setVerified(e.target.checked)}>{t('rqExt.verified')}</Checkbox>
            <Button type="primary" icon={<Save size={14} />} loading={submitting} onClick={() => void handleReEvaluate()}>
              {t('rqExt.reEvaluate')}
            </Button>
          </Space>

          {result && (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8, padding: 12 }}>
              <Space wrap style={{ marginBottom: 8 }}>
                <Tag color="blue">{t('rqExt.totalScore')}: {result.totalScore}</Tag>
                <Tag color={result.grade === 'A' ? 'green' : result.grade === 'B' ? 'blue' : result.grade === 'C' ? 'orange' : 'red'}>
                  {t('rqExt.grade')}: {result.grade}
                </Tag>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{result.evaluatedAt}</span>
              </Space>
              <DataTable<QualityEvaluation['dimensions'][number]>
                rowKey="key"
                showPagination={false}
                emptyText={t('w2d.empty')}
                dataSource={result.dimensions}
                columns={[
                  { title: t('rqExt.dimension'), dataIndex: 'label', key: 'label' },
                  { title: t('rqExt.score'), key: 'score', render: (_v, r) => `${r.score} / ${r.max}` },
                  { title: t('w2d.percent'), dataIndex: 'weight', key: 'weight', render: (v: number) => `${Math.round(v * 100)}%` },
                  { title: t('rqExt.issues'), dataIndex: 'issues', key: 'issues', render: (v: string[]) => (v.length ? v.join('; ') : '-') },
                ]}
              />
              {result.suggestions.length > 0 && (
                <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                  {t('rqExt.suggestions')}: {result.suggestions.join('; ')}
                </div>
              )}
            </div>
          )}
        </Space>
      </DashboardCard>

      <DashboardCard title={t('rqExt.scoreRules')} icon={<FileText size={15} />}>
        <StateView loading={rulesLoading} error={rulesError} empty={rules.length === 0} emptyDescription={t('w2d.empty')} onRetry={() => void loadRules()}>
          <DataTable<ScoreRule> rowKey="key" dataSource={rules} columns={ruleColumns} emptyText={t('w2d.empty')} />
        </StateView>
      </DashboardCard>
    </Space>
  );
}

export default ReportReEvaluateSection;
