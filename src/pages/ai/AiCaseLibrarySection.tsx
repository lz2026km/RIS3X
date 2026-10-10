// [v3.0.6.11-104 Wave 2D] AI 病例库区块
// 接入 GET /ai-diagnosis/cases · GET /ai-diagnosis/cases/:model/:id
import { useCallback, useEffect, useState } from 'react';
import {
  Select,
  Space,
  Tag,
} from "antd";
import { BookOpen, Cpu, FileSearch } from 'lucide-react';
import {
  aiDiagnosisApi,
  type AiCaseDetail,
  type AiCaseLibraryDto,
  type AiDiagnosisModelKey,
  type AiDiagnosisResult,
} from '../../services/api/aiDiagnosisApi';
import { StatCard, StatCardGrid } from '../../components/common/StatCard';
import { DashboardCard } from '../../components/dashboard/DashboardCard';
import { DataTable } from '../../components/common/DataTable';
import { StateView } from '../../components/common/StateView';
import { t } from '../../i18n/appI18n';

type AiCaseSummaryKey = 'lungCad' | 'breastCad' | 'fractureCad' | 'cardiacAi';

const MODEL_KEYS: Array<{ key: AiDiagnosisModelKey; statKey: AiCaseSummaryKey; label: string; color: string }> = [
  { key: 'lung-cad', statKey: 'lungCad', label: 'lungCad', color: 'primary' },
  { key: 'breast-cad', statKey: 'breastCad', label: 'breastCad', color: 'warning' },
  { key: 'fracture-cad', statKey: 'fractureCad', label: 'fractureCad', color: 'info' },
  { key: 'cardiac-ai', statKey: 'cardiacAi', label: 'cardiacAi', color: 'error' },
];

function renderValue(v: unknown): string {
  if (v === null || v === undefined) return '-';
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

export function AiCaseLibrarySection() {
  const [library, setLibrary] = useState<AiCaseLibraryDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useState<AiDiagnosisModelKey>('lung-cad');
  const [cases, setCases] = useState<AiDiagnosisResult[]>([]);
  const [caseId, setCaseId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AiCaseDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const loadLibrary = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await aiDiagnosisApi.listCases();
    if (res.success) setLibrary(res.data ?? null);
    else setError(res.error?.message ?? t('w2d.loadFailed'));
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadLibrary();
  }, [loadLibrary]);

  const loadCases = useCallback(async (m: AiDiagnosisModelKey) => {
    setCaseId(null);
    setDetail(null);
    const res = await aiDiagnosisApi.listResults<AiDiagnosisResult>(m);
    setCases(res.success ? (res.data ?? []) : []);
  }, []);

  useEffect(() => {
    void loadCases(model);
  }, [loadCases, model]);

  const loadDetail = useCallback(async (m: AiDiagnosisModelKey, id: string) => {
    setCaseId(id);
    setDetailLoading(true);
    setDetailError(null);
    const res = await aiDiagnosisApi.getCase(m, id);
    if (res.success) setDetail(res.data ?? null);
    else setDetailError(res.error?.message ?? t('w2d.loadFailed'));
    setDetailLoading(false);
  }, []);

  const selectedSummary = library ? library[MODEL_KEYS.find((m) => m.key === model)?.statKey ?? 'lungCad'] : null;
  const detailEntries = detail ? Object.entries(detail).filter(([k]) => k !== 'id') : [];

  if (loading) {
    return <StateView loading skeletonRows={5} />;
  }
  if (error) {
    return <StateView error={error} onRetry={() => void loadLibrary()} />;
  }
  if (!library) {
    return <StateView empty emptyDescription={t('w2d.empty')} />;
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%', padding: 'var(--space-2, 8px)' }}>
      <StatCardGrid>
        {MODEL_KEYS.map((m) => {
          const summary = library[m.statKey];
          return (
            <StatCard
              key={m.key}
              title={t(`aiCase.${m.label}`)}
              value={summary?.total ?? 0}
              suffix={t('aiCase.cases')}
              icon={<Cpu size={18} />}
              color={m.color}
              gradient={m.key === model}
              onClick={() => setModel(m.key)}
            />
          );
        })}
      </StatCardGrid>

      <DashboardCard title={t('aiCase.byCategory')} icon={<BookOpen size={15} />} extra={<Tag color="default">{t('aiCase.generatedAt')}: {library.generatedAt.slice(0, 19).replace('T', ' ')}</Tag>}>
        <DataTable<{ key: string; count: number }>
          rowKey="key"
          showPagination={false}
          emptyText={t('w2d.empty')}
          dataSource={selectedSummary?.byCategory ?? []}
          columns={[
            { title: t('aiCase.category'), dataIndex: 'key', key: 'key' },
            { title: t('w2d.count'), dataIndex: 'count', key: 'count' },
          ]}
        />
      </DashboardCard>

      <DashboardCard title={t('aiCase.detail')} icon={<FileSearch size={15} />}>
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Space wrap>
            <Select
              style={{ width: 200 }}
              value={model}
              onChange={(v) => setModel(v)}
              options={MODEL_KEYS.map((m) => ({ value: m.key, label: t(`aiCase.${m.label}`) }))}
            />
            <Select
              style={{ width: 320 }}
              placeholder={t('aiCase.selectCase')}
              value={caseId ?? undefined}
              onChange={(v) => void loadDetail(model, v)}
              options={cases.map((c) => ({ value: c.id, label: `${c.patientName ?? c.id} · ${c.id}` }))}
            />
          </Space>
          <StateView
            loading={detailLoading}
            error={detailError}
            empty={!detail}
            emptyDescription={t('aiCase.selectCase')}
            onRetry={() => caseId && void loadDetail(model, caseId)}
          >
            {detail && (
              <DataTable
                showHeader={false}
                pagination={false}
                rowKey={(r) => r.k}
                dataSource={detailEntries.map(([k, v]) => ({ k, v }))}
                columns={[
                  { title: t('aiCase.field'), dataIndex: 'k', key: 'k', width: 220, render: (v: string) => <span style={{ fontWeight: 600 }}>{v}</span> },
                  {
                    title: t('aiCase.value'),
                    dataIndex: 'v',
                    key: 'v',
                    render: (v: unknown) => (
                      <span style={{ wordBreak: 'break-all', fontFamily: typeof v === 'object' ? 'monospace' : undefined, fontSize: 12 }}>
                        {renderValue(v)}
                      </span>
                    ),
                  },
                ]}
              />
            )}
          </StateView>
        </Space>
      </DashboardCard>
    </Space>
  );
}

export default AiCaseLibrarySection;
