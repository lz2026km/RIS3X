// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Trash2, Save, CheckCircle, RotateCcw, BellRing, Loader2, AlertTriangle } from 'lucide-react';
import { followupApi, type FollowUpPlan } from '../services/api/followupApi';
import { reportApi } from '../services/api/reportApi';

interface FollowUpPatient {
  id: string;
  patientId: string;
  patientName: string;
  examType?: string;
  examDate: string;
  followUpType?: string;
  nextFollowUpDate: string;
  status: '待随访' | '进行中' | '已完成' | '逾期';
  reaction?: '无反应' | '轻度' | '中度' | '重度';
  notes?: string;
  reminderEnabled?: boolean;
  intervalDays?: number;
}

// [W4-B] 后端状态枚举 → 页面中文状态
const STATUS_MAP: Record<string, '待随访' | '进行中' | '已完成' | '逾期'> = {
  PENDING: '待随访',
  IN_PROGRESS: '进行中',
  COMPLETED: '已完成',
  OVERDUE: '逾期',
};

// [W4-B] 后端 FollowUpPlan → 页面行记录 (examType/followUpType 后端未持久化, 渲染 '—')
const mapPlan = (p: FollowUpPlan): FollowUpPatient => ({
  id: p.id,
  patientId: p.patientId,
  patientName: p.patientName,
  examDate: (p.planDate ?? '').slice(0, 10),
  nextFollowUpDate: (p.nextDate ?? '').slice(0, 10),
  status: STATUS_MAP[p.status] ?? '待随访',
  notes: p.note || undefined,
  reminderEnabled: p.reminderEnabled,
  intervalDays: p.intervalDays,
});

export default function FollowUpPage() {
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'overdue'>('all');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<FollowUpPatient | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // [W4-B] 真实 API 数据 (列表/到期提醒/loading/error)
  const [followUpList, setFollowUpList] = useState<FollowUpPatient[]>([]);
  const [dueList, setDueList] = useState<FollowUpPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadFollowUps = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await followupApi.list({ search: searchKeyword || undefined });
      if (res.success) {
        setFollowUpList(res.data.data.map(mapPlan));
      } else {
        setLoadError(res.error?.message ?? '加载失败');
      }
    } catch (err) {
      setLoadError((err as Error)?.message ?? '网络错误');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadFollowUps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(() => { void loadFollowUps(); }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchKeyword]);

  useEffect(() => {
    let cancelled = false;
    followupApi.due(7).then(res => {
      if (cancelled) return;
      if (res.success) setDueList(res.data?.items ?? []);
    }).catch(() => { /* 到期提醒失败不阻塞页面 */ });
    return () => { cancelled = true; };
  }, [followUpList.length]);

  // [v3.0.6.11-92 Wave1B P0] reportId/examId: 报告→随访关联 (报告详情入口带入)
  const [newPlan, setNewPlan] = useState({ patientId: '', patientName: '', planDate: '', intervalDays: 30, note: '', reminderEnabled: true, reportId: undefined as string | undefined, examId: undefined as string | undefined });

  const filteredList = followUpList.filter(item => {
    const keywordMatch = searchKeyword === '' || 
      item.patientName.includes(searchKeyword) || 
      item.patientId.includes(searchKeyword);
    const tabMatch = activeTab === 'all' || 
      (activeTab === 'pending' && item.status === '待随访') ||
      (activeTab === 'overdue' && item.status === '逾期');
    return keywordMatch && tabMatch;
  });

  // [W2-4] 患者详情"随访"入口: /follow-up?patientId=xxx 自动定位该患者
  useEffect(() => {
    const pid = new URLSearchParams(window.location.search).get('patientId');
    if (pid) setSearchKeyword(pid);
  }, []);

  // [v3.0.6.11-92 Wave1B P0] 报告详情"创建随访"入口: /follow-up?patientId=..&reportId=..
  // 解析报告 → 预填创建弹窗 (患者/报告关联)
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const reportId = q.get('reportId');
    const pid = q.get('patientId');
    if (!reportId) return;
    let cancelled = false;
    reportApi.getById(reportId).then(async (res) => {
      if (cancelled || !res.success || !res.data) return;
      const r = res.data as any;
      const patientId = String(r.patientId ?? pid ?? '');
      const patientName = String(r.patientName ?? '');
      setNewPlan(f => ({
        ...f,
        patientId,
        patientName,
        reportId: String(r.id ?? reportId),
        examId: r.examId ? String(r.examId) : undefined,
        planDate: new Date().toISOString().slice(0, 10),
        note: `来源报告: ${String(r.reportId ?? r.id ?? reportId)} 创建随访`,
      }));
      if (patientId) setSearchKeyword(patientId);
      setShowCreateModal(true);
    }).catch(() => { /* 报告加载失败不阻塞页面 */ });
    return () => { cancelled = true; };
  }, []);

  const stats = {
    total: followUpList.length,
    pending: followUpList.filter(f => f.status === '待随访').length,
    overdue: followUpList.filter(f => f.status === '逾期').length,
    completed: followUpList.filter(f => f.status === '已完成').length
  };

  // [W4-B] 完成随访 → POST /followups/:id/complete
  const handleComplete = async (id: string) => {
    try {
      const res = await followupApi.complete(id);
      if (res.success) {
        setFollowUpList(list => list.map(item =>
          item.id === id ? { ...item, status: '已完成' as const } : item
        ));
      }
    } catch (err) {
      setLoadError((err as Error)?.message ?? '操作失败');
    }
    setShowModal(false);
    setSelectedPatient(null);
  };

  // [W4-B] 删除随访 → DELETE /followups/:id
  const handleDelete = async (item: FollowUpPatient) => {
    if (!window.confirm(`确认删除患者「${item.patientName}」的随访计划？`)) return;
    try {
      const res = await followupApi.remove(item.id);
      if (res.success) {
        setFollowUpList(list => list.filter(p => p.id !== item.id));
      }
    } catch (err) {
      setLoadError((err as Error)?.message ?? '删除失败');
    }
  };

  // [W4-B] 新建随访计划 → POST /followups
  const handleCreate = async () => {
    if (!newPlan.patientId || !newPlan.patientName || !newPlan.planDate) {
      setLoadError('请填写患者ID、姓名与随访日期');
      return;
    }
    setSaving(true);
    try {
      const res = await followupApi.create({
        patientId: newPlan.patientId,
        patientName: newPlan.patientName,
        reportId: newPlan.reportId,
        examId: newPlan.examId,
        planDate: newPlan.planDate,
        intervalDays: Number(newPlan.intervalDays) || 30,
        note: newPlan.note,
        reminderEnabled: newPlan.reminderEnabled,
      });
      if (res.success && res.data) {
        setFollowUpList(list => [mapPlan(res.data as any), ...list]);
        setShowCreateModal(false);
        setNewPlan({ patientId: '', patientName: '', planDate: '', intervalDays: 30, note: '', reminderEnabled: true, reportId: undefined, examId: undefined });
        setLoadError(null);
      }
    } catch (err) {
      setLoadError((err as Error)?.message ?? '创建失败');
    } finally {
      setSaving(false);
    }
  };

  const pageStyle: React.CSSProperties = {
    minHeight: '100vh',
    backgroundColor: 'var(--bg-card)',
    padding: '24px'
  };

  const headerStyle: React.CSSProperties = {
    marginBottom: '24px'
  };

  const titleStyle: React.CSSProperties = {
    fontSize: '20px',
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: '8px'
  };

  const subtitleStyle: React.CSSProperties = {
    fontSize: '14px',
    color: 'var(--text-secondary)'
  };

  const statsContainerStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '16px',
    marginBottom: '24px'
  };

  const statCardStyle: React.CSSProperties = {
    backgroundColor: 'var(--bg-card)',
    borderRadius: '8px',
    padding: '20px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
  };

  const statValueStyle: React.CSSProperties = {
    fontSize: '32px',
    fontWeight: '600',
    color: '#1890ff'
  };

  const statLabelStyle: React.CSSProperties = {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    marginTop: '4px'
  };

  const searchBarStyle: React.CSSProperties = {
    display: 'flex',
    gap: '12px',
    marginBottom: '24px'
  };

  const inputStyle: React.CSSProperties = {
    flex: 1,
    padding: '10px 16px',
    border: '1px solid var(--border-color)',
    borderRadius: '6px',
    fontSize: '14px'
  };

  const buttonStyle: React.CSSProperties = {
    padding: '10px 24px',
    backgroundColor: '#1890ff',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px'
  };

  const tabContainerStyle: React.CSSProperties = {
    display: 'flex',
    gap: '8px',
    marginBottom: '16px',
    borderBottom: '1px solid var(--border-color)'
  };

  const tabStyle = (isActive: boolean): React.CSSProperties => ({
    padding: '12px 24px',
    borderBottom: isActive ? '2px solid #1890ff' : '2px solid transparent',
    color: isActive ? '#1890ff' : '#666',
    cursor: 'pointer',
    fontSize: '14px',
    background: 'none',
    border: 'none'
  });

  const tableStyle: React.CSSProperties = {
    backgroundColor: 'var(--bg-card)',
    borderRadius: '8px',
    overflow: 'hidden',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
  };

  const getStatusTagStyle = (status: string): React.CSSProperties => {
    const baseStyle: React.CSSProperties = {
      padding: '4px 12px',
      borderRadius: '4px',
      fontSize: '12px'
    };
    switch (status) {
      case '待随访':
        return { ...baseStyle, backgroundColor: 'var(--color-warning-bg)', color: '#faad14' };
      case '进行中':
        return { ...baseStyle, backgroundColor: 'var(--color-info-bg)', color: '#1890ff' };
      case '已完成':
        return { ...baseStyle, backgroundColor: 'var(--color-success-bg)', color: '#52c41a' };
      case '逾期':
        return { ...baseStyle, backgroundColor: 'var(--color-error-bg)', color: '#ff4d4f' };
      default:
        return baseStyle;
    }
  };

  const getExamTypeStyle = (type: string): React.CSSProperties => {
    const colors: Record<string, string> = {
      'CT增强': '#ff6b6b',
      'MRI增强': '#4ecdc4',
      'CT平扫': '#ffe66d',
      'MRI平扫': '#95e1d3'
    };
    return {
      padding: '4px 8px',
      borderRadius: '4px',
      fontSize: '12px',
      backgroundColor: colors[type] || '#e8e8e8',
      color: 'var(--text-secondary)'
    };
  };

  const actionButtonStyle: React.CSSProperties = {
    padding: '6px 12px',
    backgroundColor: '#1890ff',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px'
  };

  const modalOverlayStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  };

  const modalStyle: React.CSSProperties = {
    backgroundColor: 'var(--bg-card)',
    borderRadius: '8px',
    padding: '24px',
    width: '500px',
    maxHeight: '80vh',
    overflow: 'auto'
  };

  const modalTitleStyle: React.CSSProperties = {
    fontSize: '18px',
    fontWeight: '600',
    marginBottom: '20px'
  };

  const formGroupStyle: React.CSSProperties = {
    marginBottom: '16px'
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '14px',
    color: 'var(--text-secondary)',
    marginBottom: '6px'
  };

  const selectStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid var(--border-color)',
    borderRadius: '4px',
    fontSize: '14px'
  };

  const modalButtonContainer: React.CSSProperties = {
    display: 'flex',
    gap: '12px',
    justifyContent: 'flex-end',
    marginTop: '24px'
  };

  const cancelButtonStyle: React.CSSProperties = {
    padding: '10px 24px',
    backgroundColor: 'var(--bg-card)',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px'
  };

  return (
    <div style={pageStyle}>
      <div style={headerStyle}>
        <h1 style={titleStyle}>放射科随访管理</h1>
        <p style={subtitleStyle}>CT/MRI增强复查、对比剂反应随访、肿瘤影像跟踪</p>
      </div>

      <div style={statsContainerStyle}>
        <div style={statCardStyle}>
          <div style={statValueStyle}>{stats.total}</div>
          <div style={statLabelStyle}>总随访数</div>
        </div>
        <div style={statCardStyle}>
          <div style={{...statValueStyle, color: '#faad14'}}>{stats.pending}</div>
          <div style={statLabelStyle}>待随访</div>
        </div>
        <div style={statCardStyle}>
          <div style={{...statValueStyle, color: '#ff4d4f'}}>{stats.overdue}</div>
          <div style={statLabelStyle}>逾期</div>
        </div>
        <div style={statCardStyle}>
          <div style={{...statValueStyle, color: '#52c41a'}}>{stats.completed}</div>
          <div style={statLabelStyle}>已完成</div>
        </div>
      </div>

      <div style={searchBarStyle}>
        <input
          type="text"
          placeholder="搜索患者姓名或ID..."
          value={searchKeyword}
          onChange={e => setSearchKeyword(e.target.value)}
          style={inputStyle}
        />
        <button style={buttonStyle} onClick={() => { setSearchKeyword(''); }}><RotateCcw size={14} /> 重置</button>
        <button style={{...buttonStyle, backgroundColor: '#52c41a'}} onClick={() => setShowCreateModal(true)}>+ 新增随访</button>
      </div>

      {/* [W4-B] 到期提醒横幅 (GET /followups/due?days=7) */}
      {dueList.length > 0 && (
        <div style={{
          marginBottom: '16px', padding: '12px 16px', borderRadius: '8px',
          backgroundColor: '#f9731622', border: '1px solid #ffd591',
          fontSize: '13px', color: '#ad6800'
        }}>
          <strong><BellRing size={14} style={{ verticalAlign: 'text-bottom' }} /> 即将到期 ({dueList.length})：</strong>
          {dueList.slice(0, 5).map(p => `${p.patientName}(${p.nextDate.slice(0, 10)})`).join('、')}
          {dueList.length > 5 && ` 等${dueList.length}项`}
        </div>
      )}

      {/* [W4-B] loading / error */}
      {loading && (
        <div style={{ marginBottom: '16px', padding: '16px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '14px' }}>
          <Loader2 size={14} style={{ verticalAlign: 'text-bottom' }} /> 加载随访计划中...
        </div>
      )}
      {loadError && !loading && (
        <div style={{
          marginBottom: '16px', padding: '12px 16px', borderRadius: '8px',
          backgroundColor: 'var(--color-error-bg)', border: '1px solid #ffa39e',
          fontSize: '13px', color: '#cf1322'
        }}>
          <AlertTriangle size={14} style={{ verticalAlign: 'text-bottom' }} /> {loadError}
        </div>
      )}

      <div style={tabContainerStyle}>
        <button style={tabStyle(activeTab === 'all')} onClick={() => setActiveTab('all')}>
          全部 ({stats.total})
        </button>
        <button style={tabStyle(activeTab === 'pending')} onClick={() => setActiveTab('pending')}>
          待随访 ({stats.pending})
        </button>
        <button style={tabStyle(activeTab === 'overdue')} onClick={() => setActiveTab('overdue')}>
          逾期 ({stats.overdue})
        </button>
      </div>

      <div style={tableStyle}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)' }}>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '14px', color: 'var(--text-secondary)' }}>患者信息</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '14px', color: 'var(--text-secondary)' }}>检查类型</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '14px', color: 'var(--text-secondary)' }}>随访类型</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '14px', color: 'var(--text-secondary)' }}>检查日期</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '14px', color: 'var(--text-secondary)' }}>随访日期</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '14px', color: 'var(--text-secondary)' }}>状态</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '14px', color: 'var(--text-secondary)' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredList.map(item => (
              <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-secondary)' }}>{item.patientName}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{item.patientId}</div>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={getExamTypeStyle(item.examType)}>{item.examType || '—'}</span>
                </td>
                <td style={{ padding: '12px 16px', fontSize: '14px', color: 'var(--text-secondary)' }}>{item.followUpType || '—'}</td>
                <td style={{ padding: '12px 16px', fontSize: '14px', color: 'var(--text-secondary)' }}>{item.examDate}</td>
                <td style={{ padding: '12px 16px', fontSize: '14px', color: 'var(--text-secondary)' }}>{item.nextFollowUpDate}</td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={getStatusTagStyle(item.status)}>{item.status}</span>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <button 
                    style={actionButtonStyle}
                    onClick={() => { setSelectedPatient(item); setShowModal(true); }}
                  >
                    详情
                  </button>
                  {item.status !== '已完成' && (
                    <button 
                      style={{...actionButtonStyle, marginLeft: '8px', backgroundColor: '#52c41a'}}
                      onClick={() => handleComplete(item.id)}
                    >
                      完成
                    </button>
                  )}
                  <button
                    style={{...actionButtonStyle, marginLeft: '8px', backgroundColor: '#ff4d4f', display: 'flex', alignItems: 'center', gap: 4}}
                    onClick={() => handleDelete(item)}
                  >
                    <Trash2 size={12} />
                    删除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && selectedPatient && (
        <div style={modalOverlayStyle} onClick={() => setShowModal(false)}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <h2 style={modalTitleStyle}>📋 随访详情</h2>
            
            <div style={formGroupStyle}>
              <label style={labelStyle}>患者姓名</label>
              <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{selectedPatient.patientName}</div>
            </div>
            
            <div style={formGroupStyle}>
              <label style={labelStyle}>患者ID</label>
              <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{selectedPatient.patientId}</div>
            </div>

            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px'}}>
              <div style={formGroupStyle}>
                <label style={labelStyle}>检查类型</label>
                <span style={getExamTypeStyle(selectedPatient.examType)}>{selectedPatient.examType || '—'}</span>
              </div>
              
              <div style={formGroupStyle}>
                <label style={labelStyle}>随访类型</label>
                <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{selectedPatient.followUpType || '—'}</div>
              </div>
            </div>

            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px'}}>
              <div style={formGroupStyle}>
                <label style={labelStyle}>检查日期</label>
                <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{selectedPatient.examDate}</div>
              </div>
              
              <div style={formGroupStyle}>
                <label style={labelStyle}>随访日期</label>
                <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{selectedPatient.nextFollowUpDate}</div>
              </div>
            </div>

            {selectedPatient.reaction && (
              <div style={formGroupStyle}>
                <label style={labelStyle}>对比剂反应</label>
                <span style={{
                  padding: '4px 12px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  backgroundColor: selectedPatient.reaction === '无反应' ? '#f6ffed' : 
                                   selectedPatient.reaction === '轻度' ? '#fffbe6' : 
                                   selectedPatient.reaction === '中度' ? '#fff7e6' : '#fff2f0',
                  color: selectedPatient.reaction === '无反应' ? '#52c41a' : 
                         selectedPatient.reaction === '轻度' ? '#faad14' : 
                         selectedPatient.reaction === '中度' ? '#fa8c16' : '#ff4d4f'
                }}>
                  {selectedPatient.reaction}
                </span>
              </div>
            )}

            <div style={formGroupStyle}>
              <label style={labelStyle}>备注信息</label>
              <div style={{ 
                fontSize: '14px', 
                color: 'var(--text-secondary)',
                padding: '12px',
                backgroundColor: 'var(--bg-card)',
                borderRadius: '4px',
                minHeight: '60px'
              }}>
                {selectedPatient.notes || '无'}
              </div>
            </div>

            <div style={formGroupStyle}>
              <label style={labelStyle}>更新随访状态</label>
              <select style={selectStyle}>
                <option value="">选择状态</option>
                <option value="completed">已完成</option>
                <option value="in_progress">进行中</option>
                <option value="pending">待随访</option>
              </select>
            </div>

            <div style={modalButtonContainer}>
              <button style={cancelButtonStyle} onClick={() => setShowModal(false)}>取消</button>
              <button 
                style={buttonStyle}
                onClick={() => handleComplete(selectedPatient.id)}
              >
                <CheckCircle size={14} /> 确认完成
              </button>
            </div>
          </div>
        </div>
      )}

      {/* [W4-B] 新建随访计划 (POST /followups) */}
      {showCreateModal && (
        <div style={modalOverlayStyle} onClick={() => setShowCreateModal(false)}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <h2 style={modalTitleStyle}>📋 新建随访计划</h2>

            <div style={formGroupStyle}>
              <label style={labelStyle}>患者ID *</label>
              <input
                type="text"
                value={newPlan.patientId}
                onChange={e => setNewPlan(f => ({ ...f, patientId: e.target.value }))}
                placeholder="例如 P202400001"
                style={{ ...inputStyle, flex: undefined, width: '100%', boxSizing: 'border-box' }}
              />
            </div>

            <div style={formGroupStyle}>
              <label style={labelStyle}>患者姓名 *</label>
              <input
                type="text"
                value={newPlan.patientName}
                onChange={e => setNewPlan(f => ({ ...f, patientName: e.target.value }))}
                placeholder="患者姓名"
                style={{ ...inputStyle, flex: undefined, width: '100%', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px'}}>
              <div style={formGroupStyle}>
                <label style={labelStyle}>随访日期 *</label>
                <input
                  type="date"
                  value={newPlan.planDate}
                  onChange={e => setNewPlan(f => ({ ...f, planDate: e.target.value }))}
                  style={{ ...inputStyle, flex: undefined, width: '100%', boxSizing: 'border-box' }}
                />
              </div>
              <div style={formGroupStyle}>
                <label style={labelStyle}>间隔天数</label>
                <input
                  type="number"
                  min={1}
                  value={newPlan.intervalDays}
                  onChange={e => setNewPlan(f => ({ ...f, intervalDays: Number(e.target.value) }))}
                  style={{ ...inputStyle, flex: undefined, width: '100%', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div style={formGroupStyle}>
              <label style={labelStyle}>随访备注</label>
              <textarea
                value={newPlan.note}
                onChange={e => setNewPlan(f => ({ ...f, note: e.target.value }))}
                placeholder="随访内容 / 注意事项"
                style={{ ...inputStyle, flex: undefined, width: '100%', boxSizing: 'border-box', minHeight: '60px', fontFamily: 'inherit' }}
              />
            </div>

            <div style={formGroupStyle}>
              <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={newPlan.reminderEnabled}
                  onChange={e => setNewPlan(f => ({ ...f, reminderEnabled: e.target.checked }))}
                />
                启用到期提醒
              </label>
            </div>

            <div style={modalButtonContainer}>
              <button style={cancelButtonStyle} onClick={() => setShowCreateModal(false)}>取消</button>
              <button
                style={{ ...buttonStyle, backgroundColor: '#52c41a' }}
                onClick={() => void handleCreate()}
                disabled={saving}
              >
                <Save size={14} /> {saving ? '保存中...' : '保存计划'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
