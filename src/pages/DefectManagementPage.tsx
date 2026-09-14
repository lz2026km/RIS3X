// ============================================================
// G005 放射科RIS系统 v3.0.5.0 - 缺陷管理中心 R3
// 路由 /defect-management - 报告质量缺陷分类/分析/趋势/整改
// 复用 ReportDefectLibraryPage 数据集
// v3.0.6.11: 行点击 → 详情抽屉;状态变更 → API
// ============================================================

import React, { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertOctagon,
  Search,
  Filter,
  TrendingUp,
  FileText,
  CheckCircle,
  BarChart3,
  X,
  Save,
  Plus,
} from 'lucide-react'
import { Tag, message, Spin, Modal, Form, Input, Select } from 'antd'
import { qcextApi, type QcDefectDto } from '../services/api/qcextApi'
import { DEFECT_LIBRARY } from '../data/qualityScoreMock'
import { t } from '../i18n/appI18n'

type StatusFilter = 'all' | 'open' | 'in_progress' | 'resolved'
type SeverityFilter = 'all' | 'high' | 'medium' | 'low'

interface DefectRecord {
  id: string;
  category: string;
  name: string;
  description?: string;
  suggestion?: string;
  severity?: SeverityFilter;
  status: 'open' | 'in_progress' | 'resolved';
  owner?: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  description: t('defectMgmt.catDescription'),
  terminology: t('defectMgmt.catTerminology'),
  format: t('defectMgmt.catFormat'),
  logic: t('defectMgmt.catLogic'),
  critical: t('defectMgmt.catCritical'),
  completeness: t('defectMgmt.catCompleteness'),
};

const SEVERITY_COLORS: Record<string, string> = {
  high: 'red',
  medium: 'orange',
  low: 'blue',
};

const STATUS_COLORS: Record<string, string> = {
  open: 'red',
  in_progress: 'orange',
  resolved: 'green',
};

const STATUS_LABELS: Record<string, string> = {
  open: t('defectMgmt.statusOpen'),
  in_progress: t('defectMgmt.statusInProgress'),
  resolved: t('defectMgmt.statusResolved'),
};

const DefectManagementPage: React.FC = () => {
  const navigate = useNavigate()
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [severity, setSeverity] = useState<SeverityFilter>('all')

  const SEVERITIES = ['high', 'medium', 'low'] as const;
  const STATUSES = ['open', 'in_progress', 'resolved'] as const;
  const OWNERS = ['张主任', '李医生', '王技师'] as const;

  const pick = <T extends readonly unknown[]>(arr: T, i: number): T[number] => arr[i % arr.length] as T[number];

  // 为 DEFECT_LIBRARY 注入本地衍生字段 (状态/严重度)
  const seedRecords = useMemo<DefectRecord[]>(() => {
    return DEFECT_LIBRARY.map((d: any, i) => ({
      id: d.id ?? `DEF-${String(i + 1).padStart(3, '0')}`,
      category: d.category,
      name: d.name,
      description: d.description,
      suggestion: d.suggestion,
      severity: pick(SEVERITIES, i),
      status: pick(STATUSES, i),
      owner: pick(OWNERS, i),
    }));
  }, []);

  const [localRecords, setLocalRecords] = useState<DefectRecord[]>(seedRecords);

  const [editingStatus, setEditingStatus] = useState<{ id: string; status: DefectRecord['status'] } | null>(null);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<DefectRecord | null>(null);

  // [G005 Wave1B] qcextApi.listQcDefects: 合并后端真实缺陷 (失败回退本地, 不阻断)
  useEffect(() => {
    qcextApi.listQcDefects()
      .then((res) => {
        if (!res.success || !Array.isArray(res.data) || res.data.length === 0) return;
        const mapped: DefectRecord[] = (res.data as QcDefectDto[]).map((d) => ({
          id: d.id,
          category: 'report',
          name: `${d.defectType}: ${d.description ?? ''}`.slice(0, 60),
          description: d.description,
          severity: d.severity === 'high' || d.severity === 'medium' || d.severity === 'low' ? d.severity : 'medium',
          status: d.status === 'open' || d.status === 'in_progress' || d.status === 'resolved' ? d.status : 'open',
          owner: d.reportedBy,
        }));
        setLocalRecords(prev => [...mapped, ...prev.filter(p => !mapped.some(m => m.id === p.id))]);
      })
      .catch(() => { /* 缺陷列表不可用不阻断 */ });
  }, []);

  // [G005 Wave1B] 上报缺陷: qcextApi.reportQcDefect (POST /qc-ext/defect)
  const [reportOpen, setReportOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reportForm] = Form.useForm();

  const handleReportDefect = () => {
    reportForm.validateFields().then(async (values) => {
      setReporting(true);
      try {
        const res = await qcextApi.reportQcDefect({
          reportId: values.reportId,
          defectType: values.defectType,
          description: values.description,
          severity: values.severity,
          reportedBy: '当前用户',
        });
        if (!res.success) throw new Error(res.error?.message ?? t('defectMgmt.reportFailed'));
        const dto = res.data as QcDefectDto | null;
        setLocalRecords(prev => [{
          id: dto?.id ?? `DEF-${Date.now()}`,
          category: 'report',
          name: `${values.defectType}: ${values.description}`.slice(0, 60),
          description: values.description,
          severity: values.severity,
          status: 'open',
          owner: dto?.reportedBy ?? '当前用户',
        }, ...prev]);
        setReportOpen(false);
        reportForm.resetFields();
        message.success(t('defectMgmt.reported'));
      } catch (e) {
        message.error(e instanceof Error ? e.message : t('defectMgmt.reportFailed'));
      } finally {
        setReporting(false);
      }
    });
  };

  const stats = useMemo(() => {
    const all = localRecords.length;
    const byCategory: Record<string, number> = {};
    const byStatus: Record<string, number> = { open: 0, in_progress: 0, resolved: 0 };
    let high = 0;
    localRecords.forEach((d) => {
      byCategory[d.category] = (byCategory[d.category] ?? 0) + 1;
      byStatus[d.status] = (byStatus[d.status] ?? 0) + 1;
      if (d.severity === 'high') high += 1;
    });
    return { all, byCategory, byStatus, high };
  }, [localRecords]);

  const filtered = useMemo(() => {
    return localRecords.filter((d) => {
      if (keyword && !d.name.toLowerCase().includes(keyword.toLowerCase())) return false;
      if (status !== 'all' && d.status !== status) return false;
      if (severity !== 'all' && d.severity !== severity) return false;
      return true;
    });
  }, [localRecords, keyword, status, severity]);

  const updateStatus = async (id: string, nextStatus: DefectRecord['status']) => {
    setSaving(true);
    try {
      await fetch(`/api/v1/quality/defects/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
    } catch { /* 网络错误不阻塞本地状态 */ }
    setLocalRecords((prev) => prev.map((r) => (r.id === id ? { ...r, status: nextStatus } : r)));
    if (selected?.id === id) setSelected({ ...selected, status: nextStatus });
    setEditingStatus(null);
    setSaving(false);
    message.success(`缺陷 #${id} 状态已更新为 ${STATUS_LABELS[nextStatus]}`);
  };

  const handleSelect = (record: DefectRecord) => {
    setSelected(record);
  };

  // [v3.0.6.11-88] 详情路由 /defect-management/:id 不存在(死链→forbidden),
  // 改为打开页内详情抽屉
  const goDetail = (record: DefectRecord) => {
    setSelected(record);
  };

  return (
    <div className="p-6 space-y-4" data-testid="defect-management-page">
      <div className="flex items-center gap-2">
        <AlertOctagon className="text-red-600" size={28} />
        <h1 className="text-2xl font-bold">{t('defectMgmt.title')}</h1>
        <Tag color="orange">{t('defectMgmt.primarySource')}</Tag>
        <Tag color="green">{t('defectMgmt.reportSource')}</Tag>
        <button
          onClick={() => setReportOpen(true)}
          className="ml-auto flex items-center gap-1 rounded bg-green-600 px-3 py-1.5 text-xs text-white hover:bg-green-700"
          data-testid="defect-report-button"
        >
          <Plus size={14} /> {t('defectMgmt.reportDefect')}
        </button>
      </div>
      <p className="text-gray-600">{t('defectMgmt.subtitle')}</p>

      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-lg border bg-card p-4">
          <div className="text-gray-500 text-sm">{t('defectMgmt.statsTotal')}</div>
          <div className="text-2xl font-bold mt-1">{stats.all}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-gray-500 text-sm flex items-center gap-1"><FileText size={14}/>{t('defectMgmt.statsCategories')}</div>
          <div className="text-2xl font-bold mt-1">{Object.keys(stats.byCategory).length}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-gray-500 text-sm flex items-center gap-1"><TrendingUp size={14}/>{t('defectMgmt.statsHigh')}</div>
          <div className="text-2xl font-bold mt-1 text-red-600">{stats.high}</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-gray-500 text-sm flex items-center gap-1"><CheckCircle size={14}/>{t('defectMgmt.statsResolved')}</div>
          <div className="text-2xl font-bold mt-1 text-green-600">{stats.byStatus.resolved}</div>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 border rounded px-2 py-1 flex-1 max-w-md">
            <Search size={16} className="text-gray-400" />
            <input
              className="flex-1 outline-none text-sm"
              placeholder={t('defectMgmt.searchPlaceholder')}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Filter size={14} className="text-gray-400" />
            <select
              className="border rounded px-2 py-1"
              value={status}
              onChange={(e) => setStatus(e.target.value as StatusFilter)}
            >
              <option value="all">{t('defectMgmt.allStatus')}</option>
              <option value="open">{t('defectMgmt.statusOpen')}</option>
              <option value="in_progress">{t('defectMgmt.statusInProgress')}</option>
              <option value="resolved">{t('defectMgmt.statusResolved')}</option>
            </select>
            <select
              className="border rounded px-2 py-1"
              value={severity}
              onChange={(e) => setSeverity(e.target.value as SeverityFilter)}
            >
              <option value="all">{t('defectMgmt.allSeverity')}</option>
              <option value="high">{t('defectMgmt.sevHigh')}</option>
              <option value="medium">{t('defectMgmt.sevMedium')}</option>
              <option value="low">{t('defectMgmt.sevLow')}</option>
            </select>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-500" data-testid="defect-empty">
            <CheckCircle size={40} className="mx-auto mb-2 text-green-500" />
            <div className="text-base font-medium">{t('defectMgmt.emptyTitle')}</div>
            <div className="text-sm mt-1">{t('defectMgmt.emptyHint')}</div>
          </div>
        ) : (
          <table className="w-full mt-4 text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2">{t('defectMgmt.colCategory')}</th>
                <th className="py-2">{t('defectMgmt.colName')}</th>
                <th className="py-2">{t('defectMgmt.colSeverity')}</th>
                <th className="py-2">{t('defectMgmt.colStatus')}</th>
                <th className="py-2">{t('defectMgmt.colOwner')}</th>
                <th className="py-2">{t('defectMgmt.colDescription')}</th>
                <th className="py-2">{t('defectMgmt.colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 20).map((d) => (
                <tr
                  key={d.id}
                  className="border-b hover:bg-gray-50 cursor-pointer"
                  onClick={() => handleSelect(d)}
                  data-testid={`defect-row-${d.id}`}
                >
                  <td className="py-2 text-xs">
                    <span className="rounded bg-red-50 text-red-700 px-2 py-0.5">
                      {CATEGORY_LABELS[d.category] ?? d.category}
                    </span>
                  </td>
                  <td className="py-2 font-medium">{d.name}</td>
                  <td className="py-2">
                    {d.severity && <Tag color={SEVERITY_COLORS[d.severity]}>{d.severity === 'high' ? t('defectMgmt.sevHigh') : d.severity === 'medium' ? t('defectMgmt.sevMedium') : t('defectMgmt.sevLow')}</Tag>}
                  </td>
                  <td className="py-2">
                    <Tag color={STATUS_COLORS[d.status]}>{STATUS_LABELS[d.status]}</Tag>
                  </td>
                  <td className="py-2 text-xs">{d.owner}</td>
                  <td className="py-2 text-gray-600 max-w-md truncate">{d.description ?? '—'}</td>
                  <td className="py-2">
                    <button
                      className="text-xs text-blue-600 hover:underline"
                      onClick={(e) => {
                        e.stopPropagation()
                        goDetail(d)
                      }}
                    >
                      {t('defectMgmt.viewArrow')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 size={18} className="text-blue-600" />
          <h2 className="font-semibold">{t('defectMgmt.categoryDistribution')}</h2>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {Object.entries(stats.byCategory).map(([cat, count]) => (
            <div key={CATEGORY_LABELS[cat] ?? cat} className="flex items-center justify-between p-2 bg-gray-50 rounded">
              <span className="text-sm">{CATEGORY_LABELS[cat] ?? cat}</span>
              <span className="text-sm font-bold">{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 详情抽屉 */}
      {selected && (
        <div className="fixed inset-0 z-50 flex" data-testid="defect-detail-drawer">
          <div className="flex-1 bg-black/40" onClick={() => setSelected(null)} />
          <div className="w-[480px] max-w-full bg-card shadow-xl flex flex-col">
            <header className="px-5 py-4 border-b flex items-center justify-between">
              <div>
                <div className="text-xs text-gray-500">{t('defectMgmt.defectId')}</div>
                <div className="font-bold text-base font-mono">{selected.id}</div>
              </div>
              <button
                aria-label={t('defectMgmt.close')}
                onClick={() => setSelected(null)}
                className="text-gray-500 hover:text-gray-800"
              >
                <X size={20} />
              </button>
            </header>

            <div className="flex-1 overflow-auto p-5 space-y-4 text-sm">
              <div>
                <div className="text-xs text-gray-500 mb-1">{t('defectMgmt.name')}</div>
                <div className="font-medium">{selected.name}</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-gray-500 mb-1">{t('defectMgmt.colCategory')}</div>
                  <span className="rounded bg-red-50 text-red-700 px-2 py-0.5 text-xs">
                    {CATEGORY_LABELS[selected.category] ?? selected.category}
                  </span>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">{t('defectMgmt.colSeverity')}</div>
                  {selected.severity && <Tag color={SEVERITY_COLORS[selected.severity]}>{selected.severity.toUpperCase()}</Tag>}
                </div>
                <div className="col-span-2">
                  <div className="text-xs text-gray-500 mb-1">{t('defectMgmt.currentStatus')}</div>
                  <Tag color={STATUS_COLORS[selected.status]}>{STATUS_LABELS[selected.status]}</Tag>
                </div>
                <div className="col-span-2">
                  <div className="text-xs text-gray-500 mb-1">{t('defectMgmt.colOwner')}</div>
                  <div>{selected.owner}</div>
                </div>
              </div>

              <section className="rounded border bg-gray-50 p-3">
                <div className="text-xs text-gray-500 mb-1">{t('defectMgmt.colDescription')}</div>
                <div className="text-sm text-gray-700">{selected.description ?? '—'}</div>
              </section>
              <section className="rounded border bg-gray-50 p-3">
                <div className="text-xs text-gray-500 mb-1">{t('defectMgmt.suggestion')}</div>
                <div className="text-sm text-gray-700">{selected.suggestion ?? '—'}</div>
              </section>

              <section>
                <div className="text-xs text-gray-500 mb-2">{t('defectMgmt.changeStatus')}</div>
                {editingStatus ? (
                  <div className="flex gap-2">
                    {(['open', 'in_progress', 'resolved'] as const).map((s) => (
                      <button
                        key={s}
                        disabled={saving}
                        onClick={() => updateStatus(selected.id, s)}
                        className={`text-xs px-2 py-1 rounded border ${selected.status === s ? 'bg-blue-100 border-blue-400' : 'border-gray-300 hover:bg-gray-50'}`}
                      >
                        {STATUS_LABELS[s]}
                      </button>
                    ))}
                    <button
                      onClick={() => setEditingStatus(null)}
                      className="text-xs px-2 py-1 rounded border border-gray-300"
                    >
                      {t('defectMgmt.cancel')}
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingStatus({ id: selected.id, status: selected.status })}
                      className="text-xs px-3 py-1.5 rounded bg-blue-500 text-white hover:bg-blue-600 flex items-center gap-1"
                      data-testid="defect-edit-status"
                    >
                      <Save size={12} /> {t('defectMgmt.changeStatus')}
                    </button>
                    <button
                      onClick={() => goDetail(selected)}
                      className="text-xs px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50"
                      data-testid="defect-full-detail"
                    >
                      {t('defectMgmt.fullDetail')}
                    </button>
                    <button
                      onClick={() => navigate(`/qc/pdca?defectId=${encodeURIComponent(selected.id)}`)}
                      className="text-xs px-3 py-1.5 rounded bg-purple-600 text-white hover:bg-purple-700 flex items-center gap-1"
                      data-testid="defect-start-pdca"
                    >
                      {t('defectMgmt.startPdca')}
                    </button>
                  </div>
                )}
                {saving && <Spin size="small" className="ml-2" />}
              </section>
            </div>
          </div>
        </div>
      )}
      {/* [G005 Wave1B] 上报缺陷弹窗 (qcextApi.reportQcDefect) */}
      <Modal
        title={t('defectMgmt.reportDefect')}
        open={reportOpen}
        onCancel={() => setReportOpen(false)}
        onOk={handleReportDefect}
        confirmLoading={reporting}
        okText={t('defectMgmt.submitReport')}
        cancelText={t('defectMgmt.cancel')}
      >
        <Form form={reportForm} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="reportId" label={t('defectMgmt.reportId')} rules={[{ required: true, message: t('defectMgmt.reportIdRequired') }]}>
            <Input placeholder="rpt-013" />
          </Form.Item>
          <Form.Item name="defectType" label={t('defectMgmt.defectType')} rules={[{ required: true, message: t('defectMgmt.defectTypeRequired') }]}>
            <Select
              placeholder={t('defectMgmt.selectDefectType')}
              options={[
                { value: '描述不完整/漏项', label: t('defectMgmt.dtIncomplete') },
                { value: '诊断结论不明确', label: t('defectMgmt.dtUnclear') },
                { value: '术语使用不规范', label: t('defectMgmt.dtTerminology') },
                { value: '检查所见与结论不符', label: t('defectMgmt.dtMismatch') },
                { value: '危急值漏报/迟报', label: t('defectMgmt.dtCriticalMiss') },
                { value: '报告超时', label: t('defectMgmt.dtTimeout') },
                { value: '其他缺陷', label: t('defectMgmt.dtOther') },
              ]}
            />
          </Form.Item>
          <Form.Item name="severity" label={t('defectMgmt.colSeverity')} initialValue="medium" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'high', label: t('defectMgmt.sevHigh') },
                { value: 'medium', label: t('defectMgmt.sevMedium') },
                { value: 'low', label: t('defectMgmt.sevLow') },
              ]}
            />
          </Form.Item>
          <Form.Item name="description" label={t('defectMgmt.defectDescription')} rules={[{ required: true, message: t('defectMgmt.descriptionRequired') }]}>
            <Input.TextArea rows={3} placeholder={t('defectMgmt.descriptionPlaceholder')} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default DefectManagementPage
