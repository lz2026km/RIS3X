// ============================================================
// G005 放射科RIS系统 v3.0.5.0 - 缺陷管理中心 R3
// 路由 /defect-management - 报告质量缺陷分类/分析/趋势/整改
// 复用 ReportDefectLibraryPage 数据集
// v3.0.6.11: 行点击 → 详情抽屉;状态变更 → API
// ============================================================

import React, { useMemo, useState } from 'react'
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
} from 'lucide-react'
import { Tag, message, Spin } from 'antd'
import { DEFECT_LIBRARY } from '../data/qualityScoreMock'

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
  description: '描述缺陷',
  terminology: '术语缺陷',
  format: '格式缺陷',
  logic: '逻辑缺陷',
  critical: '严重缺陷',
  completeness: '完整性缺陷',
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
  open: '待处理',
  in_progress: '整改中',
  resolved: '已闭环',
};

const DefectManagementPage: React.FC = () => {
  const navigate = useNavigate();
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

  const goDetail = (record: DefectRecord) => {
    navigate(`/defect-management/${record.id}`);
  };

  return (
    <div className="p-6 space-y-4" data-testid="defect-management-page">
      <div className="flex items-center gap-2">
        <AlertOctagon className="text-red-600" size={28} />
        <h1 className="text-2xl font-bold">缺陷管理中心 (R3)</h1>
      </div>
      <p className="text-gray-600">报告质量缺陷分类 · 整改追踪 · 趋势分析 · 闭环管理</p>

      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-lg border bg-white p-4">
          <div className="text-gray-500 text-sm">缺陷总数</div>
          <div className="text-2xl font-bold mt-1">{stats.all}</div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="text-gray-500 text-sm flex items-center gap-1"><FileText size={14}/>分类数</div>
          <div className="text-2xl font-bold mt-1">{Object.keys(stats.byCategory).length}</div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="text-gray-500 text-sm flex items-center gap-1"><TrendingUp size={14}/>高危</div>
          <div className="text-2xl font-bold mt-1 text-red-600">{stats.high}</div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="text-gray-500 text-sm flex items-center gap-1"><CheckCircle size={14}/>已闭环</div>
          <div className="text-2xl font-bold mt-1 text-green-600">{stats.byStatus.resolved}</div>
        </div>
      </div>

      <div className="rounded-lg border bg-white p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 border rounded px-2 py-1 flex-1 max-w-md">
            <Search size={16} className="text-gray-400" />
            <input
              className="flex-1 outline-none text-sm"
              placeholder="搜索缺陷名称..."
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
              <option value="all">全部状态</option>
              <option value="open">待处理</option>
              <option value="in_progress">整改中</option>
              <option value="resolved">已闭环</option>
            </select>
            <select
              className="border rounded px-2 py-1"
              value={severity}
              onChange={(e) => setSeverity(e.target.value as SeverityFilter)}
            >
              <option value="all">全部严重度</option>
              <option value="high">高</option>
              <option value="medium">中</option>
              <option value="low">低</option>
            </select>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-500" data-testid="defect-empty">
            <CheckCircle size={40} className="mx-auto mb-2 text-green-500" />
            <div className="text-base font-medium">未找到匹配的缺陷</div>
            <div className="text-sm mt-1">尝试调整筛选条件</div>
          </div>
        ) : (
          <table className="w-full mt-4 text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2">分类</th>
                <th className="py-2">缺陷名称</th>
                <th className="py-2">严重度</th>
                <th className="py-2">状态</th>
                <th className="py-2">责任人</th>
                <th className="py-2">描述</th>
                <th className="py-2">操作</th>
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
                    {d.severity && <Tag color={SEVERITY_COLORS[d.severity]}>{d.severity === 'high' ? '高' : d.severity === 'medium' ? '中' : '低'}</Tag>}
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
                      查看 →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="rounded-lg border bg-white p-4">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 size={18} className="text-blue-600" />
          <h2 className="font-semibold">分类分布</h2>
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
          <div className="w-[480px] max-w-full bg-white shadow-xl flex flex-col">
            <header className="px-5 py-4 border-b flex items-center justify-between">
              <div>
                <div className="text-xs text-gray-500">缺陷 ID</div>
                <div className="font-bold text-base font-mono">{selected.id}</div>
              </div>
              <button
                aria-label="关闭"
                onClick={() => setSelected(null)}
                className="text-gray-500 hover:text-gray-800"
              >
                <X size={20} />
              </button>
            </header>

            <div className="flex-1 overflow-auto p-5 space-y-4 text-sm">
              <div>
                <div className="text-xs text-gray-500 mb-1">名称</div>
                <div className="font-medium">{selected.name}</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-gray-500 mb-1">分类</div>
                  <span className="rounded bg-red-50 text-red-700 px-2 py-0.5 text-xs">
                    {CATEGORY_LABELS[selected.category] ?? selected.category}
                  </span>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">严重度</div>
                  {selected.severity && <Tag color={SEVERITY_COLORS[selected.severity]}>{selected.severity.toUpperCase()}</Tag>}
                </div>
                <div className="col-span-2">
                  <div className="text-xs text-gray-500 mb-1">当前状态</div>
                  <Tag color={STATUS_COLORS[selected.status]}>{STATUS_LABELS[selected.status]}</Tag>
                </div>
                <div className="col-span-2">
                  <div className="text-xs text-gray-500 mb-1">责任人</div>
                  <div>{selected.owner}</div>
                </div>
              </div>

              <section className="rounded border bg-gray-50 p-3">
                <div className="text-xs text-gray-500 mb-1">描述</div>
                <div className="text-sm text-gray-700">{selected.description ?? '—'}</div>
              </section>
              <section className="rounded border bg-gray-50 p-3">
                <div className="text-xs text-gray-500 mb-1">建议</div>
                <div className="text-sm text-gray-700">{selected.suggestion ?? '—'}</div>
              </section>

              <section>
                <div className="text-xs text-gray-500 mb-2">变更状态</div>
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
                      取消
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingStatus({ id: selected.id, status: selected.status })}
                      className="text-xs px-3 py-1.5 rounded bg-blue-500 text-white hover:bg-blue-600 flex items-center gap-1"
                      data-testid="defect-edit-status"
                    >
                      <Save size={12} /> 变更状态
                    </button>
                    <button
                      onClick={() => {
                        setSelected(null)
                        goDetail(selected)
                      }}
                      className="text-xs px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50"
                      data-testid="defect-full-detail"
                    >
                      完整详情 →
                    </button>
                  </div>
                )}
                {saving && <Spin size="small" className="ml-2" />}
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DefectManagementPage
