// ============================================================
// G005 放射科RIS系统 v1.0.6 - 患者端报告门户 H5
// Phase R6：实名验证 + 二维码 + 报告查看 + 影像浏览 + 下载 + 分享
// ============================================================

import React, { useState, useEffect } from 'react';
import { message, Modal, Rate, Input } from 'antd';
import {
  Smartphone, Download, Share2, Eye,
  ChevronRight, FileText, Link2, MessageSquarePlus,
} from 'lucide-react';
import {
  PATIENT_REPORT_ACCESS,
  type PatientReportAccess,
} from '../data/deliveryExportSignatureMock';
import ShareDialog from '../components/portal/ShareDialog';
import QrShareButton from '../components/portal/QrShareButton';
import { patientPortalApi } from '../services/api/patientPortalApi';
import { shareApi } from '../services/api/shareApi';

// ============================================================
// 主组件
// ============================================================
export default function PatientReportPortalPage() {
  // [G005 W2-B] 写死数据源整改: useState(PATIENT_REPORT_ACCESS) → patientPortalApi.listReports()
  //              (GET /patient-portal/reports + /patient-portal/patients 派生患者可访问报告),
  //              API 失败时回退静态演示数据 (离线预览模式)
  const [access, setAccess] = useState<PatientReportAccess[]>(PATIENT_REPORT_ACCESS);
  const [accessSource, setAccessSource] = useState<'api' | 'static'>('static');
  const [accessLoading, setAccessLoading] = useState(true);
  const [selectedAccessId, setSelectedAccessId] = useState<string | null>('pa-001');
  const [showShareDialog, setShowShareDialog] = useState(false);

  // [G005 Wave1B] 宣教材料卡 (listEducation/getEducation) + 报告详情 (getReport)
  const [educationItems, setEducationItems] = useState<any[]>([]);
  const [educationDetail, setEducationDetail] = useState<any>(null);
  const [reportDetail, setReportDetail] = useState<any>(null);
  const [reportDetailLoading, setReportDetailLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await patientPortalApi.listEducation();
        if (cancelled) return;
        if (res.success && Array.isArray(res.data?.data)) setEducationItems(res.data.data);
      } catch { /* 宣教接口不可用, 保持空 */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleViewEducation = async (item: any) => {
    setEducationDetail(item);
    try {
      const res = await patientPortalApi.getEducation(item.id ?? item.key);
      if (res.success && Array.isArray(res.data?.data) && res.data.data.length > 0) {
        setEducationDetail({ ...item, ...res.data.data[0] });
      }
    } catch { /* 详情接口不可用, 使用列表项 */ }
  };

  const handleViewReportDetail = async () => {
    if (!selectedAccess) return;
    setReportDetailLoading(true);
    setReportDetail(null);
    try {
      const res = await patientPortalApi.getReport(selectedAccess.reportId);
      if (res.success && res.data) setReportDetail(res.data);
      else setReportDetail({ id: selectedAccess.reportId, patientName: selectedAccess.patientName, error: res.error?.message ?? '报告详情不可用' });
    } catch {
      setReportDetail({ id: selectedAccess.reportId, patientName: selectedAccess.patientName, error: '报告详情接口不可用' });
    }
    setReportDetailLoading(false);
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setAccessLoading(true);
      try {
        const [reportsRes, patientsRes] = await Promise.allSettled([
          patientPortalApi.listReports(),
          patientPortalApi.listPatients(),
        ]);
        if (cancelled) return;
        const reports = reportsRes.status === 'fulfilled' && reportsRes.value.success
          ? (reportsRes.value.data ?? [])
          : [];
        if (reports.length === 0) {
          setAccess(PATIENT_REPORT_ACCESS);
          setAccessSource('static');
          return;
        }
        const patients = patientsRes.status === 'fulfilled' && patientsRes.value.success && Array.isArray(patientsRes.value.data?.data)
          ? patientsRes.value.data.data
          : [];
        const nameById = new Map(patients.map(p => [p.id, p.name]));
        setAccess(reports.map(r => ({
          id: `pa-${r.id}`,
          reportId: r.examId ?? r.id,
          patientName: nameById.get(r.patientId) ?? '患者',
          accessToken: `PT-${r.id}`,
          qrCodeUrl: `/qrcode/${r.id}.png`,
          expiresAt: r.signedAt ?? r.examDate ?? '',
          viewCount: 0,
          downloadCount: 0,
          shareCount: 0,
          deviceFingerprint: 'WEB-REPORT-ACCESS',
          ipHistory: [],
        })));
        setAccessSource('api');
      } catch {
        setAccess(PATIENT_REPORT_ACCESS);
        setAccessSource('static');
      } finally {
        if (!cancelled) setAccessLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // 数据源切换后, 若默认选中项不存在则回落到第一条
  useEffect(() => {
    if (!accessLoading && access.length > 0 && !access.some(a => a.id === selectedAccessId)) {
      setSelectedAccessId(access[0]!.id);
    }
  }, [access, accessLoading, selectedAccessId]);

  // [G005 Wave1A P0] 反馈提交 (POST /patient-portal/feedback) + 患者端 mobile 摘要
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [mobileSummary, setMobileSummary] = useState<{ patients: number; doctors: number; nurses: number; techs: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [p, d, n, t] = await Promise.allSettled([
          patientPortalApi.getPatientMobile(),
          patientPortalApi.getDoctorMobile(),
          patientPortalApi.getNurseMobile(),
          patientPortalApi.getTechMobile(),
        ]);
        if (cancelled) return;
        const len = (r: PromiseSettledResult<any>) => (r.status === 'fulfilled' && Array.isArray(r.value.data?.data) ? r.value.data.data.length : 0);
        setMobileSummary({ patients: len(p), doctors: len(d), nurses: len(n), techs: len(t) });
      } catch { /* 静默回退 */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleSubmitFeedback = async () => {
    setFeedbackSubmitting(true);
    try {
      const res = await patientPortalApi.submitFeedback({
        patientName: selectedAccess?.patientName,
        rating: feedbackRating,
        category: 'report_portal',
        comment: feedbackComment || undefined,
      });
      if (res.success) {
        message.success('反馈已提交，感谢您的评价');
        setFeedbackOpen(false);
        setFeedbackComment('');
      } else {
        message.error(res.error?.message ?? '反馈提交失败');
      }
    } catch {
      message.error('反馈提交失败');
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  const selectedAccess = access.find(a => a.id === selectedAccessId);

  return (
    <div style={{ padding: 20, maxWidth: 1400, margin: '0 auto' }}>
      {/* 顶部 */}
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Smartphone size={20} color="#0ea5e9" /> 患者端报告门户 H5
            <span style={{ fontSize: 12, padding: '2px 6px', background: '#10b981', color: '#fff', borderRadius: 3, fontWeight: 700 }}>R6</span>
            {accessSource === 'api' ? (
              <span style={{ fontSize: 12, padding: '2px 8px', background: 'var(--color-info-bg)', color: '#1d4ed8', borderRadius: 10, fontWeight: 700, border: '1px solid #bfdbfe' }}>
                {accessLoading ? '加载中...' : `patient-portal API · ${access.length} 份可访问报告`}
              </span>
            ) : (
              <span style={{ fontSize: 12, padding: '2px 8px', background: 'var(--color-warning-bg)', color: '#d97706', borderRadius: 10, fontWeight: 700, border: '1px solid #fde68a' }}>
                静态演示数据（接口不可用回退）
              </span>
            )}
          </h1>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
            实名验证 + 二维码分享 + 报告查看 + 影像浏览 + 下载 + 分享 + 设备/IP 审计
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <QrShareButton shortUrl="https://r.hospital.cn/portal" label="患者入口" />
          <button
            onClick={() => setFeedbackOpen(true)}
            style={{ padding: '6px 12px', border: '1px solid #10b981', borderRadius: 6, background: 'var(--color-success-bg)', color: '#059669', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <MessageSquarePlus size={14} /> 服务反馈
          </button>
          <button
            onClick={() => setShowShareDialog(true)}
            style={{ padding: '6px 12px', border: '1px solid #7c3aed', borderRadius: 6, background: '#8b5cf622', color: '#6d28d9', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <Link2 size={14} /> 分享链接
          </button>
          <button
            onClick={async () => {
              try {
                const res = await patientPortalApi.listPatients();
                if (res.success) {
                  message.success(`H5 患者端已就绪 · 后端共 ${res.data?.data?.length ?? 0} 位患者可服务`);
                } else {
                  message.warning('H5 患者端离线预览模式');
                }
              } catch (e: any) {
                message.warning('H5 患者端离线预览模式: ' + (e?.message || String(e)));
              }
            }}
            style={{ padding: '6px 12px', border: '1px solid #3b82f6', borderRadius: 6, background: 'var(--bg-card)', color: '#1e40af', fontSize: 12, cursor: 'pointer' }}
          >
            预览 H5
          </button>
        </div>
      </div>

      {/* [G005 Wave1A P0] 患者端 mobile 摘要 (GET /patient-portal/mobile/{patients,doctors,nurses,techs}) */}
      {mobileSummary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16, padding: 10, background: 'var(--color-info-bg)', borderRadius: 8, border: '1px solid #bae6fd' }}>
          <div style={{ fontSize: 12, color: '#0c4a6e' }}>👤 患者 <b style={{ marginLeft: 4 }}>{mobileSummary.patients}</b></div>
          <div style={{ fontSize: 12, color: '#0c4a6e' }}>🩺 医生 <b style={{ marginLeft: 4 }}>{mobileSummary.doctors}</b></div>
          <div style={{ fontSize: 12, color: '#0c4a6e' }}>💉 护士 <b style={{ marginLeft: 4 }}>{mobileSummary.nurses}</b></div>
          <div style={{ fontSize: 12, color: '#0c4a6e' }}>⚙️ 技师 <b style={{ marginLeft: 4 }}>{mobileSummary.techs}</b></div>
        </div>
      )}

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
        <KpiCard icon={FileText} label="已发报告" value={access.length} color="#0ea5e9" />
        <KpiCard icon={Eye} label="总查看" value={access.reduce((s, a) => s + a.viewCount, 0)} color="#10b981" />
        <KpiCard icon={Download} label="总下载" value={access.reduce((s, a) => s + a.downloadCount, 0)} color="#7c3aed" />
        <KpiCard icon={Share2} label="总分享" value={access.reduce((s, a) => s + a.shareCount, 0)} color="#f59e0b" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 12 }}>
        {/* 左：访问列表 */}
        <div style={{ background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-color)', overflow: 'hidden' }}>
          <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)', fontSize: 12, fontWeight: 700, color: '#1e40af' }}>
            访问授权列表
          </div>
          <div>
            {access.map(a => (
              <div
                key={a.id}
                onClick={() => setSelectedAccessId(a.id)}
                style={{
                  padding: 10, borderBottom: '1px solid var(--border-light)',
                  background: selectedAccessId === a.id ? 'var(--color-info-bg)' : 'transparent',
                  borderLeft: selectedAccessId === a.id ? '3px solid #0ea5e9' : '3px solid transparent',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{a.patientName}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-secondary)' }}>{a.id}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{a.accessToken}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 4, fontSize: 12, color: 'var(--text-secondary)' }}>
                  <span>👁 {a.viewCount}</span>
                  <span>📥 {a.downloadCount}</span>
                  <span>↗ {a.shareCount}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 右：详情 + 预览 */}
        {selectedAccess && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* 详情卡片 */}
            <div style={{ background: 'var(--bg-card)', borderRadius: 8, padding: 16, border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #0ea5e9, #0284c7)', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, fontWeight: 700,
                }}>{selectedAccess.patientName[0]}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{selectedAccess.patientName}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                    令牌：<code style={{ background: 'var(--bg-card)', padding: '1px 6px', borderRadius: 3 }}>{selectedAccess.accessToken}</code>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>过期时间</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{selectedAccess.expiresAt}</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
                <InfoCell icon={Eye} label="查看" value={selectedAccess.viewCount} color="#10b981" />
                <InfoCell icon={Download} label="下载" value={selectedAccess.downloadCount} color="#3b82f6" />
                <InfoCell icon={Share2} label="分享" value={selectedAccess.shareCount} color="#7c3aed" />
                <InfoCell icon={Smartphone} label="设备" value={selectedAccess.deviceFingerprint.split('-')[0] ?? ''} color="#f59e0b" />
              </div>

              {/* [G005 Wave1B] 报告详情: patientPortalApi.getReport */}
              <button
                onClick={() => void handleViewReportDetail()}
                disabled={reportDetailLoading}
                style={{ marginBottom: 12, padding: '6px 14px', border: '1px solid #0ea5e9', borderRadius: 6, background: 'var(--color-info-bg)', color: '#0369a1', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <Eye size={13} /> {reportDetailLoading ? '加载报告详情...' : '查看报告详情'}
              </button>

              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 4 }}>📱 设备指纹</div>
                <div style={{ padding: 6, background: 'var(--bg-card)', borderRadius: 4, fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                  {selectedAccess.deviceFingerprint}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 4 }}>🌐 IP 历史</div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {selectedAccess.ipHistory.map((ip, i) => (
                    <span key={i} style={{ padding: '2px 8px', background: 'var(--color-info-bg)', color: '#0c4a6e', fontSize: 12, borderRadius: 10, fontFamily: 'monospace' }}>
                      {ip}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* 模拟 H5 预览 */}
            <div style={{ background: 'var(--bg-card)', borderRadius: 8, padding: 16, border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1e40af', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Smartphone size={13} /> H5 患者端预览
              </div>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <PhoneMockup access={selectedAccess} />
              </div>
            </div>
          </div>
        )}
      </div>
      {/* [G005 Wave1B] 宣教材料卡: patientPortalApi.listEducation / getEducation */}
      {educationItems.length > 0 && (
        <div style={{ background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-color)', padding: 12, marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#1e40af', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <FileText size={13} /> 宣教材料 ({educationItems.length}) <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 400 }}>patient-portal/education</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
            {educationItems.slice(0, 8).map((item: any) => (
              <button
                key={item.id ?? item.key}
                onClick={() => void handleViewEducation(item)}
                style={{ textAlign: 'left', padding: 10, borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-card)', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 4 }}
              >
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{item.title ?? item.key ?? item.id}</span>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{item.summary ?? item.content?.slice(0, 60) ?? ''}</span>
                <span style={{ fontSize: 11, color: '#0ea5e9' }}>查看全文 →</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <ShareDialog
        open={showShareDialog}
        onClose={() => setShowShareDialog(false)}
        patientId={selectedAccess?.reportId ?? 'p-000'}
        patientName={selectedAccess?.patientName ?? '患者'}
        doctorId="dr-001"
        doctorName="张医师"
        resourceIds={selectedAccess ? [selectedAccess.id] : []}
        resourceSummary={`${selectedAccess?.patientName ?? ''} 检查报告`}
        onCreated={async (url) => {
          try {
            await navigator.clipboard.writeText(url);
            message.success(`分享链接已生成并复制到剪贴板`);
          } catch {
            message.success(`分享链接已生成: ${url}`);
          }
        }}
      />

      {/* [G005 Wave1B] 宣教材料详情 Modal (getEducation) */}
      <Modal
        title={`宣教材料 - ${educationDetail?.title ?? educationDetail?.key ?? ''}`}
        open={!!educationDetail}
        onCancel={() => setEducationDetail(null)}
        footer={<button onClick={() => setEducationDetail(null)} style={{ padding: '6px 16px', border: '1px solid var(--border-color)', borderRadius: 6, background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer' }}>关闭</button>}
        width={520}
      >
        {educationDetail && (
          <div style={{ marginTop: 8 }}>
            <div style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {(educationDetail.category ? `分类: ${educationDetail.category} · ` : '') + (educationDetail.contentType ? `类型: ${educationDetail.contentType}` : '')}
              </span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.8, whiteSpace: 'pre-wrap', maxHeight: 360, overflowY: 'auto' }}>
              {educationDetail.content ?? educationDetail.value ?? '（无内容）'}
            </div>
            {educationDetail.updatedAt && <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-secondary)' }}>更新: {String(educationDetail.updatedAt).slice(0, 10)}</div>}
          </div>
        )}
      </Modal>

      {/* [G005 Wave1B] 报告详情 Modal (getReport) */}
      <Modal
        title={`报告详情 - ${reportDetail?.patientName ?? reportDetail?.id ?? ''}`}
        open={!!reportDetail}
        onCancel={() => setReportDetail(null)}
        footer={<button onClick={() => setReportDetail(null)} style={{ padding: '6px 16px', border: '1px solid var(--border-color)', borderRadius: 6, background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer' }}>关闭</button>}
        width={560}
      >
        {reportDetail && (
          <div style={{ marginTop: 8 }}>
            {reportDetail.error ? (
              <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 12 }}>{reportDetail.error}</div>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                  {reportDetail.modality && <span style={{ fontSize: 11, padding: '2px 8px', background: 'var(--color-info-bg)', color: '#0c4a6e', borderRadius: 10 }}>{reportDetail.modality}</span>}
                  {reportDetail.bodyPart && <span style={{ fontSize: 11, padding: '2px 8px', background: 'var(--color-info-bg)', color: '#0c4a6e', borderRadius: 10 }}>{reportDetail.bodyPart}</span>}
                  {reportDetail.examDate && <span style={{ fontSize: 11, padding: '2px 8px', background: 'var(--bg-card)', color: 'var(--text-secondary)', borderRadius: 10 }}>{String(reportDetail.examDate).slice(0, 10)}</span>}
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: reportDetail.isCritical ? 'var(--color-error-bg)' : 'var(--color-success-bg)', color: reportDetail.isCritical ? '#dc2626' : '#047857' }}>{reportDetail.isCritical ? '危急' : '状态: ' + (reportDetail.state ?? '-')}</span>
                </div>
                {reportDetail.findings && <DetailBlock label="检查所见" value={reportDetail.findings} />}
                {reportDetail.impression && <DetailBlock label="影像意见" value={reportDetail.impression} />}
                {reportDetail.diagnosis && <DetailBlock label="诊断" value={reportDetail.diagnosis} />}
                {reportDetail.recommendations && <DetailBlock label="建议" value={reportDetail.recommendations} />}
                {reportDetail.conclusion && <DetailBlock label="结论" value={reportDetail.conclusion} />}
                {!(reportDetail.findings || reportDetail.impression || reportDetail.diagnosis || reportDetail.recommendations || reportDetail.conclusion) && (
                  <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 12 }}>该报告暂无文本内容</div>
                )}
                {reportDetail.signedAt && <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-secondary)' }}>签名时间: {String(reportDetail.signedAt).replace('T', ' ').slice(0, 16)}</div>}
              </>
            )}
          </div>
        )}
      </Modal>

      {/* [G005 Wave1A P0] 服务反馈 (POST /patient-portal/feedback) */}
      <Modal
        title={<span><MessageSquarePlus size={16} style={{ marginRight: 6 }} />服务反馈</span>}
        open={feedbackOpen}
        onOk={() => void handleSubmitFeedback()}
        onCancel={() => setFeedbackOpen(false)}
        okText="提交反馈"
        cancelText="取消"
        confirmLoading={feedbackSubmitting}
        width={440}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>满意度评分</div>
            <Rate value={feedbackRating} onChange={setFeedbackRating} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>意见建议</div>
            <Input.TextArea
              rows={3}
              maxLength={500}
              placeholder="请输入您的意见或建议（可选）"
              value={feedbackComment}
              onChange={e => setFeedbackComment(e.target.value)}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ============================================================
// 手机模型组件
// ============================================================
const PhoneMockup: React.FC<{ access: PatientReportAccess }> = ({ access }) => {
  const [tab, setTab] = useState<'home' | 'report' | 'image' | 'me'>('home');

  const handleDownloadPdf = () => {
    const content = `患者报告\n患者: ${access.patientName}\n检查: 胸部 CT 平扫\n日期: 2026-06-04\n\n检查所见: 双肺纹理清晰...\n诊断意见: 胸部 CT 平扫未见明显异常。\n建议: 年度随访。\n\n本报告由 G005 RIS 患者端门户生成`;
    const blob = new Blob([content], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${access.patientName}-报告.pdf`;
    a.click();
    URL.revokeObjectURL(url);
    message.success('报告 PDF 已开始下载');
  };

  const handleShare = async () => {
    const fallback = `https://r.hospital.cn/portal/${access.accessToken}`;
    try {
      const res = await shareApi.create({
        studyId: access.reportId,
        patientName: access.patientName,
        toDept: 'patient-portal',
        protocol: 'wado',
        expiresAt: access.expiresAt,
      });
      if (res.success && res.data?.url) {
        const url = res.data.url.startsWith('http') ? res.data.url : fallback;
        try { await navigator.clipboard.writeText(url); message.success('分享链接已生成并复制到剪贴板'); }
        catch { message.success(`分享链接已生成: ${url}`); }
        return;
      }
    } catch (e) {
      console.warn('[Portal] shareApi.create failed, fallback:', e);
    }
    try { await navigator.clipboard.writeText(fallback); message.success('分享链接已生成并复制到剪贴板'); }
    catch { message.success(`分享链接已生成: ${fallback}`); }
  };

  return (
    <div style={{
      width: 280, height: 560, background: '#0f172a', borderRadius: 32,
      padding: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
    }}>
      <div style={{
        width: '100%', height: '100%', background: 'var(--bg-card)', borderRadius: 24,
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
      }}>
        {/* 状态栏 */}
        <div style={{ background: 'linear-gradient(135deg, #0ea5e9, #0284c7)', color: '#fff', padding: '8px 12px', fontSize: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>9:41</span>
            <span>📶 🔋</span>
          </div>
        </div>

        {/* 内容区 */}
        <div style={{ flex: 1, overflow: 'auto', padding: 10, fontSize: 12 }}>
          {tab === 'home' && (
            <div>
              <div style={{ background: 'linear-gradient(135deg, #0ea5e9, #0284c7)', color: '#fff', padding: 12, borderRadius: 8, marginBottom: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 700 }}>您好，{access.patientName}</div>
                <div style={{ fontSize: 12, opacity: 0.9, marginTop: 2 }}>您的影像报告已可查看</div>
                <button onClick={() => setTab('report')} style={{ marginTop: 8, padding: '4px 12px', background: 'var(--bg-card)', color: '#0ea5e9', border: 'none', borderRadius: 12, fontSize: 12, fontWeight: 600 }}>
                  查看报告 →
                </button>
              </div>
              <div style={{ background: 'var(--bg-card)', padding: 8, borderRadius: 6, marginBottom: 6 }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>📋 我的报告（1）</div>
                <div style={{ padding: 6, background: 'var(--bg-card)', borderRadius: 4, fontSize: 12 }}>
                  <div>胸部 CT 平扫</div>
                  <div style={{ color: 'var(--text-secondary)', marginTop: 2 }}>2026-06-04 · 14:30</div>
                </div>
              </div>
              <div style={{ background: 'var(--bg-card)', padding: 8, borderRadius: 6 }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>⚙️ 快速入口</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, fontSize: 12 }}>
                  <div style={{ textAlign: 'center' }}>📥<br/>下载</div>
                  <div style={{ textAlign: 'center' }}>↗<br/>分享</div>
                  <div style={{ textAlign: 'center' }}>🖼️<br/>影像</div>
                  <div style={{ textAlign: 'center' }}>👤<br/>咨询</div>
                </div>
              </div>
            </div>
          )}

          {tab === 'report' && (
            <div>
              <div style={{ background: 'var(--bg-card)', padding: 10, borderRadius: 6, marginBottom: 6 }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>胸部 CT 平扫</div>
                <div style={{ padding: 6, background: 'var(--color-success-bg)', borderRadius: 4, fontSize: 12, color: '#047857', marginBottom: 6 }}>
                  ✓ 报告已通过审核 · 已医生签名
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  <div style={{ marginBottom: 4 }}>
                    <strong>检查所见：</strong>双肺纹理清晰...
                  </div>
                  <div style={{ marginBottom: 4 }}>
                    <strong>诊断意见：</strong>胸部 CT 平扫未见明显异常。
                  </div>
                  <div>
                    <strong>建议：</strong>年度随访。
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                  <button onClick={handleDownloadPdf} style={{ flex: 1, padding: '4px 8px', background: '#0ea5e9', color: '#fff', border: 'none', borderRadius: 4, fontSize: 12 }}>
                    📥 PDF
                  </button>
                  <button onClick={() => setTab('image')} style={{ flex: 1, padding: '4px 8px', background: '#10b981', color: '#fff', border: 'none', borderRadius: 4, fontSize: 12 }}>
                    🖼️ 影像
                  </button>
                  <button onClick={() => void handleShare()} style={{ flex: 1, padding: '4px 8px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 4, fontSize: 12 }}>
                    ↗ 分享
                  </button>
                </div>
              </div>
            </div>
          )}

          {tab === 'image' && (
            <div style={{ background: '#0f172a', padding: 6, borderRadius: 6, color: '#fff', textAlign: 'center' }}>
              <div style={{ fontSize: 12, marginBottom: 6 }}>影像缩略图（模拟）</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 4 }}>
                {[1,2,3,4,5,6].map(i => (
                  <div key={i} style={{ aspectRatio: 1, background: 'linear-gradient(135deg, #1e293b, #334155)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>
                    {i}
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'me' && (
            <div style={{ background: 'var(--bg-card)', padding: 10, borderRadius: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#0ea5e9', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {access.patientName[0]}
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700 }}>{access.patientName}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>已实名认证 ✓</div>
                </div>
              </div>
              {[
                { icon: '🔒', label: '账户安全' },
                { icon: '📱', label: '设备管理' },
                { icon: '🌐', label: '登录历史' },
                { icon: '⚙️', label: '设置' },
                { icon: 'ℹ️', label: '关于' },
              ].map((m, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '8px 4px', borderBottom: '1px solid var(--border-light)', fontSize: 12 }}>
                  <span style={{ marginRight: 6 }}>{m.icon}</span>
                  <span>{m.label}</span>
                  <ChevronRight size={10} style={{ marginLeft: 'auto' }} color="var(--text-secondary)" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 底部 Tab */}
        <div style={{ background: 'var(--bg-card)', borderTop: '1px solid var(--border-color)', display: 'flex' }}>
          {([
            { key: 'home',   icon: '🏠', label: '首页' },
            { key: 'report', icon: '📋', label: '报告' },
            { key: 'image',  icon: '🖼️', label: '影像' },
            { key: 'me',     icon: '👤', label: '我的' },
          ] as const).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as any)}
              style={{
                flex: 1, padding: '6px 4px', border: 'none', background: 'transparent',
                color: tab === t.key ? '#0ea5e9' : '#94a3b8',
                fontSize: 12, fontWeight: tab === t.key ? 700 : 400,
                cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              }}
            >
              <span style={{ fontSize: 14 }}>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

// ============================================================
// KPI
// ============================================================
const KpiCard: React.FC<{ icon: any; label: string; value: number | string; color: string }> = ({ icon: Icon, label, value, color }) => (
  <div style={{ background: 'var(--bg-card)', padding: 12, borderRadius: 8, border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 10 }}>
    <div style={{ width: 36, height: 36, borderRadius: 8, background: `${color}15`, color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Icon size={18} />
    </div>
    <div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{value}</div>
    </div>
  </div>
);

// ============================================================
// 信息
// ============================================================
const InfoCell: React.FC<{ icon: any; label: string; value: number | string; color: string }> = ({ icon: Icon, label, value, color }) => (
  <div>
    <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
      <Icon size={10} /> {label}
    </div>
    <div style={{ fontSize: 18, fontWeight: 700, color, marginTop: 2 }}>{value}</div>
  </div>
);

// [G005 Wave1B] 报告详情文本块
const DetailBlock: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={{ marginBottom: 10 }}>
    <div style={{ fontSize: 12, fontWeight: 600, color: '#1e40af', marginBottom: 4 }}>{label}</div>
    <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.7, background: 'var(--bg-card)', padding: 8, borderRadius: 6, border: '1px solid var(--border-color)', whiteSpace: 'pre-wrap' }}>{value}</div>
  </div>
);
