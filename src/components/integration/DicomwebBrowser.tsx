/**
 * G005 放射RIS系统 v3.0.6.0 - DICOMweb 浏览器
 * 20 升级点:Study/Series/Instance 三级浏览 / WADO 检索 / 缩略图 / 搜索
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  Card, Space, Button, Tag, message, Modal, Form, Input, Select, Tabs,
  Table, Empty, Statistic, Row, Col, Divider, Alert, InputNumber,
} from 'antd';
import {
  Database, Search, Upload, Download, Image, FileText, ListTree,
  RefreshCw, Send, Trash2, Eye, ChevronRight, Server, Activity, Code2,
  Layers, FileJson, CheckCircle2, AlertCircle, FolderTree, Folder, FolderOpen,
} from 'lucide-react';
import { qidoStudies, qidoSeries, qidoInstances, toDicomJson } from '@services/integration/dicomWeb/QidoRsServer';
import { stowInstances } from '@services/integration/dicomWeb/StowRsServer';
import { wadoRetrieveInstance, wadoRetrieveSeries, wadoRetrieveMetadata, wadoRenderThumbnail } from '@services/integration/dicomWeb/WadoRsServer';
import { stats as getStowStats, deleteStudy } from '@services/integration/dicomWeb/StowRsServer';
import type { QidoRsResult, DicomWebMetadata, StowRsUploadRequest, StowRsResult } from '../../types/integration';

export const DicomwebBrowser: React.FC = () => {
  const [studyResult, setStudyResult] = useState<QidoRsResult | null>(null);
  const [seriesResult, setSeriesResult] = useState<QidoRsResult | null>(null);
  const [instanceResult, setInstanceResult] = useState<QidoRsResult | null>(null);
  const [selectedStudy, setSelectedStudy] = useState<DicomWebMetadata | null>(null);
  const [selectedSeries, setSelectedSeries] = useState<DicomWebMetadata | null>(null);
  const [selectedInstance, setSelectedInstance] = useState<DicomWebMetadata | null>(null);
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadResult, setUploadResult] = useState<StowRsResult | null>(null);
  const [stowStats, setStowStats] = useState(() => getStowStats());

  const handleSearchStudies = useCallback(async (params: Record<string, string> = {}) => {
    setBusy(true);
    try {
      const r = await qidoStudies({
        PatientID: params['PatientID'],
        PatientName: params['PatientName'],
        StudyDate: params['StudyDate'],
        StudyDescription: params['StudyDescription'],
        Modality: params['Modality'],
        StudyInstanceUID: params['StudyInstanceUID'],
        limit: 50,
      });
      setStudyResult(r);
      setSelectedStudy(r.results[0] ?? null);
      setSeriesResult(null); setInstanceResult(null);
      setSelectedSeries(null); setSelectedInstance(null);
      message.success(`查询到 ${r.total} 个 Study`);
    } finally { setBusy(false); }
  }, []);

  const handleSelectStudy = useCallback(async (study: DicomWebMetadata) => {
    setSelectedStudy(study);
    setSelectedSeries(null); setSelectedInstance(null);
    setThumbnail(null);
    setInstanceResult(null);
    if (!study.studyInstanceUID) return;
    const r = await qidoSeries(study.studyInstanceUID, { limit: 100 });
    setSeriesResult(r);
    setSelectedSeries(r.results[0] ?? null);
  }, []);

  const handleSelectSeries = useCallback(async (series: DicomWebMetadata) => {
    setSelectedSeries(series);
    setSelectedInstance(null);
    setThumbnail(null);
    if (!series.studyInstanceUID || !series.seriesInstanceUID) return;
    const r = await qidoInstances(series.studyInstanceUID, series.seriesInstanceUID, { limit: 200 });
    setInstanceResult(r);
    setSelectedInstance(r.results[0] ?? null);
    if (r.results[0]?.sopInstanceUID) {
      const t = await wadoRenderThumbnail(series.studyInstanceUID, series.seriesInstanceUID, r.results[0].sopInstanceUID);
      if (t) {
        const url = URL.createObjectURL(t.body);
        setThumbnail(url);
      }
    }
  }, []);

  const handleUpload = useCallback(async (reqs: StowRsUploadRequest[]) => {
    setBusy(true);
    try {
      const r = await stowInstances(reqs);
      setUploadResult(r);
      setStowStats(getStowStats());
      message.success(`STOW 完成: ${r.storeCount} 成功 / ${r.failedCount} 失败`);
    } finally { setBusy(false); }
  }, []);

  const handleDeleteStudy = useCallback(() => {
    if (!selectedStudy?.studyInstanceUID) return;
    Modal.confirm({
      title: `确认删除 Study ${selectedStudy.studyInstanceUID.slice(-12)}?`,
      onOk: () => {
        const n = deleteStudy(selectedStudy.studyInstanceUID!);
        setStowStats(getStowStats());
        message.success(`已删除 ${n} 个实例`);
        setStudyResult(null); setSeriesResult(null); setInstanceResult(null);
        setSelectedStudy(null); setSelectedSeries(null); setSelectedInstance(null);
      },
    });
  }, [selectedStudy]);

  return (
    <div className="space-y-3">
      <Row gutter={8}>
        <Col span={4}><Card size="small"><Statistic title="实例总数" value={stowStats.totalInstances} prefix={<Database className="w-3 h-3" style={{ color: '#0891b2' }} />} valueStyle={{ fontSize: 16 }} /></Card></Col>
        <Col span={5}><Card size="small"><Statistic title="总字节" value={(stowStats.totalBytes / 1024).toFixed(1)} suffix="KB" prefix={<Layers className="w-3 h-3" style={{ color: '#7c3aed' }} />} valueStyle={{ fontSize: 16 }} /></Card></Col>
        <Col span={5}><Card size="small"><Statistic title="Study 命中" value={studyResult?.total ?? 0} prefix={<ListTree className="w-3 h-3" style={{ color: '#10b981' }} />} valueStyle={{ fontSize: 16 }} /></Card></Col>
        <Col span={5}><Card size="small"><Statistic title="Series 命中" value={seriesResult?.total ?? 0} prefix={<FolderTree className="w-3 h-3" style={{ color: '#3b82f6' }} />} valueStyle={{ fontSize: 16 }} /></Card></Col>
        <Col span={5}><Card size="small"><Statistic title="Instance 命中" value={instanceResult?.total ?? 0} prefix={<FileText className="w-3 h-3" style={{ color: '#dc2626' }} />} valueStyle={{ fontSize: 16 }} /></Card></Col>
      </Row>

      <Card size="small" className="shadow-sm" title={
        <div className="flex items-center justify-between">
          <Space><Search className="w-4 h-4" /><span>Query (QIDO-RS)</span></Space>
          <Space>
            <Button size="small" icon={<Upload className="w-3 h-3" />} type="primary" onClick={() => setUploadOpen(true)}>STOW</Button>
            <Button size="small" danger icon={<Trash2 className="w-3 h-3" />} onClick={handleDeleteStudy} disabled={!selectedStudy}>删除 Study</Button>
          </Space>
        </div>
      }>
        <SearchForm onSearch={handleSearchStudies} busy={busy} />
      </Card>

      <div className="grid grid-cols-4 gap-3">
        <Card size="small" className="col-span-1 shadow-sm" title={<Space><FolderTree className="w-4 h-4" /><span>Studies</span></Space>} bodyStyle={{ padding: 8 }}>
          {studyResult?.results.length ? (
            <div className="space-y-1 max-h-[460px] overflow-y-auto">
              {studyResult.results.map((s) => (
                <div key={s.studyInstanceUID} onClick={() => handleSelectStudy(s)}
                  className={`p-1.5 border rounded cursor-pointer text-xs ${selectedStudy?.studyInstanceUID === s.studyInstanceUID ? 'border-cyan-500 bg-cyan-50' : 'border-slate-200 hover:border-slate-300'}`}>
                  <div className="flex items-center justify-between">
                    <Tag color="cyan">{s.modality ?? '??'}</Tag>
                    <span className="text-slate-500 text-[10px]">{s.studyDate ?? '-'}</span>
                  </div>
                  <div className="font-semibold mt-1 truncate">{s.patientName ?? s.patientID ?? '-'}</div>
                  <div className="text-slate-500 truncate text-[10px]">{s.studyDescription ?? s.studyInstanceUID?.slice(-12)}</div>
                  <div className="text-slate-400 text-[10px]">{s.numberOfSeriesRelatedInstances ?? 0} instances</div>
                </div>
              ))}
            </div>
          ) : <Empty description="执行查询" />}
        </Card>

        <Card size="small" className="col-span-1 shadow-sm" title={<Space><FolderOpen className="w-4 h-4" /><span>Series</span></Space>} bodyStyle={{ padding: 8 }}>
          {seriesResult?.results.length ? (
            <div className="space-y-1 max-h-[460px] overflow-y-auto">
              {seriesResult.results.map((s) => (
                <div key={s.seriesInstanceUID} onClick={() => handleSelectSeries(s)}
                  className={`p-1.5 border rounded cursor-pointer text-xs ${selectedSeries?.seriesInstanceUID === s.seriesInstanceUID ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}>
                  <div className="flex items-center justify-between">
                    <Tag color="blue">{s.modality ?? '??'}</Tag>
                    <span className="text-slate-500 text-[10px]">#{s.numberOfSeriesRelatedInstances ?? 0}</span>
                  </div>
                  <div className="font-mono text-[10px] truncate mt-1">{s.seriesInstanceUID?.slice(-12)}</div>
                </div>
              ))}
            </div>
          ) : <Empty description="选择 Study" />}
        </Card>

        <Card size="small" className="col-span-1 shadow-sm" title={<Space><FileText className="w-4 h-4" /><span>Instances</span></Space>} bodyStyle={{ padding: 8 }}>
          {instanceResult?.results.length ? (
            <div className="space-y-1 max-h-[460px] overflow-y-auto">
              {instanceResult.results.map((i) => (
                <div key={i.sopInstanceUID} onClick={() => setSelectedInstance(i)}
                  className={`p-1.5 border rounded cursor-pointer text-xs ${selectedInstance?.sopInstanceUID === i.sopInstanceUID ? 'border-orange-500 bg-orange-50' : 'border-slate-200 hover:border-slate-300'}`}>
                  <div className="flex items-center justify-between">
                    <Tag color="orange">#{i.instanceNumber ?? '?'}</Tag>
                    <span className="text-slate-500 text-[10px]">{i.transferSyntaxUID?.split('.').pop()}</span>
                  </div>
                  <div className="font-mono text-[10px] truncate">{i.sopInstanceUID?.slice(-12)}</div>
                </div>
              ))}
            </div>
          ) : <Empty description="选择 Series" />}
        </Card>

        <Card size="small" className="col-span-1 shadow-sm" title={<Space><Image className="w-4 h-4" /><span>预览 (WADO-RS render)</span></Space>} bodyStyle={{ padding: 8 }}>
          {thumbnail ? (
            <div className="space-y-2 text-center">
              <img src={thumbnail} alt="thumbnail" className="w-full border rounded" />
              <div className="text-[10px] text-slate-500 break-all">{selectedInstance?.sopInstanceUID}</div>
            </div>
          ) : <Empty description="无缩略图" />}
        </Card>
      </div>

      {selectedInstance && (
        <Card size="small" className="shadow-sm" title={<Space><Code2 className="w-4 h-4" /><span>DICOM JSON Metadata</span></Space>}>
          <pre className="bg-slate-900 text-slate-100 p-3 rounded text-xs overflow-auto max-h-[300px] font-mono">{JSON.stringify(toDicomJson(selectedInstance), null, 2)}</pre>
        </Card>
      )}

      <Modal title={<Space><Upload className="w-4 h-4" /><span>STOW-RS 上传</span></Space>} open={uploadOpen} onCancel={() => setUploadOpen(false)} footer={null} width={520}>
        <UploadForm onSubmit={(reqs) => { handleUpload(reqs); setUploadOpen(false); }} />
        {uploadResult && <Alert className="mt-2" type={uploadResult.status === 'success' ? 'success' : 'warning'} message={`成功 ${uploadResult.storeCount} / 失败 ${uploadResult.failedCount}`} />}
      </Modal>
    </div>
  );
};

const SearchForm: React.FC<{ onSearch: (p: Record<string, string>) => void; busy: boolean }> = ({ onSearch, busy }) => {
  const [p, setP] = useState<Record<string, string>>({ PatientID: '', Modality: '', StudyDescription: '', PatientName: '', StudyDate: '' });
  return (
    <div className="grid grid-cols-6 gap-2">
      {[
        { k: 'PatientID', l: 'Patient ID' },
        { k: 'PatientName', l: 'Patient Name' },
        { k: 'StudyDate', l: 'Study Date (YYYYMMDD)' },
        { k: 'Modality', l: 'Modality' },
        { k: 'StudyDescription', l: 'Description' },
        { k: 'StudyInstanceUID', l: 'Study UID' },
      ].map((f) => (
        <div key={f.k}>
          <div className="text-xs text-slate-500 mb-0.5">{f.l}</div>
          <Input size="small" value={p[f.k] ?? ''} onChange={(e) => setP((s) => ({ ...s, [f.k]: e.target.value }))} />
        </div>
      ))}
      <div className="col-span-6 flex justify-end gap-2">
        <Button size="small" onClick={() => setP({ PatientID: '', Modality: '', StudyDescription: '', PatientName: '', StudyDate: '', StudyInstanceUID: '' })}>重置</Button>
        <Button size="small" type="primary" loading={busy} icon={<Search className="w-3 h-3" />} onClick={() => onSearch(p)}>查询</Button>
      </div>
    </div>
  );
};

const UploadForm: React.FC<{ onSubmit: (r: StowRsUploadRequest[]) => void }> = ({ onSubmit }) => {
  const [study, setStudy] = useState(`1.2.840.113556.1.8000.2554.${Date.now()}`);
  const [series, setSeries] = useState(`1.2.840.113556.1.8000.2554.2.${Date.now()}`);
  const [sop, setSop] = useState(`1.2.840.113556.1.8000.2554.3.${Date.now()}`);
  const [ts, setTs] = useState('1.2.840.10008.1.2.1');
  const [count, setCount] = useState(3);
  return (
    <Form layout="vertical">
      <Form.Item label="Study Instance UID"><Input value={study} onChange={(e) => setStudy(e.target.value)} /></Form.Item>
      <Form.Item label="Series Instance UID"><Input value={series} onChange={(e) => setSeries(e.target.value)} /></Form.Item>
      <Form.Item label="Transfer Syntax UID"><Input value={ts} onChange={(e) => setTs(e.target.value)} /></Form.Item>
      <Form.Item label="实例数"><InputNumber className="w-full" min={1} max={50} value={count} onChange={(v) => setCount(v ?? 1)} /></Form.Item>
      <div className="flex justify-end gap-2">
        <Button type="primary" onClick={() => {
          const reqs: StowRsUploadRequest[] = [];
          for (let i = 0; i < count; i++) {
            const buf = new TextEncoder().encode(`DICOM-MOCK-${i}-${Date.now()}`).buffer;
            reqs.push({
              studyInstanceUID: study,
              seriesInstanceUID: series,
              sopInstanceUID: `${sop}.${i + 1}`,
              transferSyntaxUID: ts as '1.2.840.10008.1.2.1',
              content: buf,
            });
          }
          onSubmit(reqs);
        }}>上传</Button>
      </div>
    </Form>
  );
};

export default DicomwebBrowser;
