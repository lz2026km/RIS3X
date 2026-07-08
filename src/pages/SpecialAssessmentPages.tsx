// ============================================================
// G005 放射科RIS系统 v1.0.5 - 8 大特殊分类评估页（统一组件）
// Phase R5：BI-RADS / Lung-RADS / PI-RADS / CAD-RADS / TI-RADS / RECIST / 骨龄 / 心脏CTA
// 单一文件多组件导出，根据 URL query 选择渲染
// ============================================================

import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ChevronLeft, Save, CheckCircle2,
  ListChecks,
  Award, History,
} from 'lucide-react';
import {
  SPECIAL_ASSESSMENTS,
} from '../data/criticalValueAssessmentMock';

// ============================================================
// 通用评估组件
// ============================================================
interface SpecialAssessmentPageProps {
  assessmentId: string;
}

const SpecialAssessmentPage: React.FC<SpecialAssessmentPageProps> = ({ assessmentId }) => {
  const navigate = useNavigate();
  const assessment = SPECIAL_ASSESSMENTS.find(a => a.id === assessmentId);

  if (!assessment) {
    return <div style={{ padding: 40, textAlign: 'center' }}>评估系统不存在</div>;
  }

  // 状态
  const [selectedGrade, setSelectedGrade] = useState<string>('');
  const [values, setValues] = useState<Record<string, any>>({});
  const [showHistory, setShowHistory] = useState(false);
  const [, setSavedMessage] = useState<string>('');

  // 模拟评估历史
  const mockHistory = [
    { date: '2026-05-15', grade: assessment.grades[0]?.value || '', doctor: '张明远' },
    { date: '2026-03-20', grade: assessment.grades[0]?.value || '', doctor: '李慧敏' },
    { date: '2026-01-10', grade: assessment.grades[0]?.value || '', doctor: '王建华' },
  ];

  // 计算结果
  const currentGrade = assessment.grades.find(g => g.value === selectedGrade);
  void currentGrade;

  return (
    <div style={{ padding: 20, maxWidth: 1400, margin: '0 auto' }}>
      {/* 顶部 */}
      <div style={{
        background: `linear-gradient(135deg, ${getGradientColor(assessment.category)} 0%, ${getGradientColor2(assessment.category)} 100%)`,
        borderRadius: 12, padding: 20, marginBottom: 16, color: '#fff',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => navigate('/critical-value')}
            style={{
              padding: 4, border: 'none', background: 'rgba(255,255,255,0.2)', color: '#fff',
              borderRadius: 4, cursor: 'pointer', display: 'flex',
            }}
          >
            <ChevronLeft size={18} />
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 2 }}>{assessment.modality} · {assessment.bodyPart}</div>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              {assessment.systemName} 评估
              <span style={{ fontSize: 12, padding: '2px 6px', background: 'rgba(255,255,255,0.2)', borderRadius: 3, fontWeight: 700 }}>
                {assessment.category}
              </span>
            </h1>
            <p style={{ fontSize: 12, margin: '4px 0 0', opacity: 0.9 }}>{assessment.description}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 12, opacity: 0.85 }}>指南参考</div>
            <div style={{ fontSize: 12, fontWeight: 600, marginTop: 2 }}>{assessment.reference}</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {/* 左：评估项目 */}
        <div style={{ background: '#fff', borderRadius: 8, padding: 16, border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1e40af', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <ListChecks size={13} /> 评估项目
          </div>
          {assessment.evaluationItems.map(item => (
            <div key={item.key} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: '#475569', fontWeight: 600, marginBottom: 4 }}>{item.label}</div>
              {item.type === 'select' && item.options && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {item.options.map(opt => {
                    const selected = values[item.key] === opt;
                    return (
                      <button
                        key={opt}
                        onClick={() => setValues({ ...values, [item.key]: opt })}
                        style={{
                          padding: '4px 10px', border: `1px solid ${selected ? '#3b82f6' : '#cbd5e1'}`,
                          borderRadius: 12, fontSize: 12, fontWeight: 600,
                          background: selected ? '#dbeafe' : '#fff',
                          color: selected ? '#1e40af' : '#475569',
                          cursor: 'pointer',
                        }}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              )}
              {item.type === 'number' && (
                <input
                  type="number"
                  value={values[item.key] || ''}
                  onChange={e => setValues({ ...values, [item.key]: e.target.value })}
                  style={{
                    width: '100%', padding: '6px 10px',
                    border: '1px solid #cbd5e1', borderRadius: 4, fontSize: 12, outline: 'none',
                  }}
                />
              )}
              {item.type === 'boolean' && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#475569' }}>
                  <input
                    type="checkbox"
                    checked={values[item.key] === true}
                    onChange={e => setValues({ ...values, [item.key]: e.target.checked })}
                    style={{ width: 16, height: 16 }}
                  />
                  {values[item.key] ? '是' : '否'}
                </label>
              )}
            </div>
          ))}
        </div>

        {/* 右：分级选择 + 评估结果 */}
        <div>
          {/* 分级选择 */}
          <div style={{ background: '#fff', borderRadius: 8, padding: 16, border: '1px solid #e2e8f0', marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1e40af', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Award size={13} /> {assessment.category} 分级
            </div>
            {assessment.grades.map(g => {
              const selected = selectedGrade === g.value;
              return (
                <button
                  key={g.value}
                  onClick={() => setSelectedGrade(g.value)}
                  style={{
                    width: '100%', padding: 10, marginBottom: 6,
                    background: selected ? g.color : '#f8fafc',
                    border: `2px solid ${selected ? g.color : '#e2e8f0'}`,
                    borderRadius: 6, textAlign: 'left', cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: selected ? '#fff' : g.color }}>
                      {g.label}
                    </span>
                    {selected && <CheckCircle2 size={16} color="#fff" />}
                  </div>
                  <div style={{ fontSize: 12, color: selected ? 'rgba(255,255,255,0.9)' : '#64748b', marginTop: 2 }}>
                    {g.description}
                  </div>
                  <div style={{ fontSize: 12, color: selected ? '#fff' : g.color, fontWeight: 600, marginTop: 4 }}>
                    → {g.action}
                  </div>
                </button>
              );
            })}
          </div>

          {/* 操作按钮 */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setShowHistory(!showHistory)}
              style={{
                flex: 1, padding: 10, border: '1px solid #cbd5e1', borderRadius: 6,
                background: '#fff', color: '#475569', fontSize: 12, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              }}
            >
              <History size={12} /> 历史记录
            </button>
            <button
              disabled={!selectedGrade}
              onClick={() => { setSavedMessage(`评估已保存: ${selectedGrade} 级 (${items.find((i: any) => i.key === Object.entries(values).find((e: any) => e[1] === selectedGrade)?.[0])?.label || '综合'})`); setShowHistory(true) }}
              style={{
                flex: 1, padding: 10, border: 'none', borderRadius: 6,
                background: selectedGrade ? '#10b981' : '#cbd5e1',
                color: '#fff', fontSize: 12, fontWeight: 600,
                cursor: selectedGrade ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              }}
            >
              <Save size={12} /> 保存评估
            </button>
          </div>
        </div>
      </div>

      {/* 历史 */}
      {showHistory && (
        <div style={{ background: '#fff', borderRadius: 8, padding: 16, border: '1px solid #e2e8f0', marginTop: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1e40af', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <History size={13} /> 历次评估记录
          </div>
          {mockHistory.map((h, i) => {
            const gradeObj = assessment.grades.find(g => g.value === h.grade);
            return (
              <div key={i} style={{
                padding: 10, marginBottom: 6, background: '#f8fafc', borderRadius: 4,
                border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <div style={{ fontSize: 12, color: '#64748b', minWidth: 80 }}>{h.date}</div>
                <div style={{ fontSize: 12, color: '#475569' }}>报告：{h.doctor}</div>
                {gradeObj && (
                  <span style={{
                    fontSize: 12, padding: '2px 8px', borderRadius: 10,
                    background: gradeObj.color, color: '#fff', fontWeight: 600,
                    marginLeft: 'auto',
                  }}>{gradeObj.label}</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ============================================================
// 颜色工具
// ============================================================
function getGradientColor(category: string): string {
  const map: Record<string, string> = {
    'BI-RADS': '#ec4899', 'Lung-RADS': '#0891b2', 'PI-RADS': '#7c3aed', 'CAD-RADS': '#dc2626',
    'TI-RADS': '#f59e0b', 'RECIST': '#10b981', '骨龄': '#3b82f6', '心脏CTA': '#be185d',
  };
  return map[category] || '#7c3aed';
}

function getGradientColor2(category: string): string {
  const map: Record<string, string> = {
    'BI-RADS': '#be185d', 'Lung-RADS': '#0e7490', 'PI-RADS': '#5b21b6', 'CAD-RADS': '#991b1b',
    'TI-RADS': '#b45309', 'RECIST': '#047857', '骨龄': '#1e40af', '心脏CTA': '#9d174d',
  };
  return map[category] || '#5b21b6';
}

// ============================================================
// 8 个具体页面（统一壳）
// ============================================================
export const BIRADSAssessmentPage: React.FC = () => <SpecialAssessmentPage assessmentId="sa-birads" />;
export const LungRADSAssessmentPage: React.FC = () => <SpecialAssessmentPage assessmentId="sa-lungrads" />;
export const PIRADSAssessmentPage: React.FC = () => <SpecialAssessmentPage assessmentId="sa-pirads" />;
export const CADRADSAssessmentPage: React.FC = () => <SpecialAssessmentPage assessmentId="sa-cadrads" />;
export const TIRADSAssessmentPage: React.FC = () => <SpecialAssessmentPage assessmentId="sa-tirads" />;
export const RECISTAssessmentPage: React.FC = () => <SpecialAssessmentPage assessmentId="sa-recist" />;
export const BoneAgeAssessmentPage: React.FC = () => <SpecialAssessmentPage assessmentId="sa-boneage" />;
export const CardiacCTAAssessmentPage: React.FC = () => <SpecialAssessmentPage assessmentId="sa-cardiac" />;

// 默认导出：根据 URL 参数选择
const SpecialAssessmentRouter: React.FC = () => {
  const [params] = useSearchParams();
  const system = params.get('system') || 'birads';
  const map: Record<string, string> = {
    birads: 'sa-birads', lungrads: 'sa-lungrads', pirads: 'sa-pirads', cadrads: 'sa-cadrads',
    tirads: 'sa-tirads', recist: 'sa-recist', boneage: 'sa-boneage', cardiac: 'sa-cardiac',
  };
  return <SpecialAssessmentPage assessmentId={map[system] || 'sa-birads'} />;
};

export default SpecialAssessmentRouter;
