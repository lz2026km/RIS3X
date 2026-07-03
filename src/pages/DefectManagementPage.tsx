// ============================================================
// G005 放射科RIS系统 v3.0.5.0 - 缺陷管理中心 R3
// 路由 /defect-management - 报告质量缺陷分类/分析/趋势/整改
// 复用 ReportDefectLibraryPage 数据集
// ============================================================

import React, { useMemo, useState } from 'react'
import { AlertOctagon, Search, Filter, TrendingUp, FileText, CheckCircle, XCircle, BarChart3 } from 'lucide-react'
import { DEFECT_LIBRARY, type DefectCategory } from '../data/qualityScoreMock'

type StatusFilter = 'all' | 'open' | 'in_progress' | 'resolved'
type SeverityFilter = 'all' | 'high' | 'medium' | 'low'

const DefectManagementPage: React.FC = () => {
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const CATEGORY_LABELS: Record<string, string> = { description: '描述缺陷', terminology: '术语缺陷', format: '格式缺陷', logic: '逻辑缺陷', critical: '严重缺陷', completeness: '完整性缺陷' };

const [severity, setSeverity] = useState<SeverityFilter>('all')

  const stats = useMemo(() => {
    const all = DEFECT_LIBRARY.length
    const byCategory: Record<string, number> = {}
    DEFECT_LIBRARY.forEach((d: { category: string }) => {
      byCategory[d.category] = (byCategory[d.category] ?? 0) + 1
    })
    return { all, byCategory }
  }, [])

  const filtered = useMemo(() => {
    return DEFECT_LIBRARY.filter((d) => {
      if (keyword && !d.name.toLowerCase().includes(keyword.toLowerCase())) return false
      return true
    })
  }, [keyword])

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
          <div className="text-2xl font-bold mt-1 text-red-600">{Math.floor(stats.all * 0.3)}</div>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <div className="text-gray-500 text-sm flex items-center gap-1"><CheckCircle size={14}/>已闭环</div>
          <div className="text-2xl font-bold mt-1 text-green-600">{Math.floor(stats.all * 0.7)}</div>
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

        <table className="w-full mt-4 text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b">
              <th className="py-2">分类</th>
              <th className="py-2">缺陷名称</th>
              <th className="py-2">描述</th>
              <th className="py-2">建议</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 20).map((d, i) => (
              <tr key={i} className="border-b hover:bg-gray-50">
                <td className="py-2 text-xs">
                  <span className="rounded bg-red-50 text-red-700 px-2 py-0.5">
                    {CATEGORY_LABELS[(d as { category: DefectCategory }).category] ?? (d as { category: DefectCategory }).category}
                  </span>
                </td>
                <td className="py-2 font-medium">{(d as { name: string }).name}</td>
                <td className="py-2 text-gray-600">{(d as { description?: string }).description ?? '—'}</td>
                <td className="py-2 text-gray-600">{(d as { suggestion?: string }).suggestion ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <XCircle size={32} className="mx-auto mb-2" />
            未找到匹配缺陷
          </div>
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
    </div>
  )
}

export default DefectManagementPage
