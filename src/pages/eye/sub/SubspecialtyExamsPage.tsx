// [v3.0.6.8-37] PR 4: 8 亚专科纵深
// 对标: Medisoft mediSIGHT 8 亚专科模块
// 5 专科量表 + 接触镜 + 低视力
import {
  Card,
  Space,
  Tag,
  Button,
  Select,
  Input,
  Form,
  Row,
  Col,
  Divider,
  message,
  Empty,
  Alert,
  InputNumber,
  Radio,
} from "antd";
import { Eye, Activity, Compass, Layers, Zap, Glasses, Accessibility, Save, History } from 'lucide-react';
import { Inbox } from 'lucide-react'
import { DataTable, StatCard, StatCardGrid } from "../../../components/common"
// [v3.0.6.11-88 Round10] 接触镜验配走 API 层 (后端 POST /eye/contact-lens/fitting)
import { eyeApi } from '../../../services/api/eyeApi'
import { t } from '../../../i18n/appI18n'
import React, { useState, useEffect } from 'react';

const {  } = Input;

// [v3.0.6.11-103 Wave 3A] 亚专科检查记录历史 (后端 GET /eye/subspecialty/:sub/records)
const SubRecordHistory: React.FC<{
  sub: string;
  patientId: string;
  refreshKey: number;
}> = ({ sub, patientId, refreshKey }) => {
  const [records, setRecords] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await eyeApi.getSubspecialtyRecords(sub, { patientId });
        if (!cancelled && res.success) {
          const list = Array.isArray((res.data as any)?.data)
            ? (res.data as any).data
            : Array.isArray(res.data)
              ? res.data
              : [];
          setRecords(list);
        }
      } catch (e) {
        console.warn('[F03] SubRecordHistory Error:', (e as Error)?.message);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [sub, patientId, refreshKey]);
  return (
    <Card
      title={
        <Space>
          <History size={14} />
          {t('eye.sub.records')}
          <Tag color="blue">{records.length}</Tag>
        </Space>
      }
      size="small"
      style={{ marginTop: 16 }}
    >
      {!loaded ? (
        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('eyeSub.loading')}</div>
      ) : records.length === 0 ? (
        <Empty description={t('eye.common.noData')} image={<Inbox size={40} style={{ opacity: 0.4 }} />} />
      ) : (
        <DataTable
          rowKey={(r: any) => r.id}
          dataSource={records.slice(0, 5)}
          pagination={false}
          columns={[
            { title: t('eyeSub.thPatient'), dataIndex: 'patientName', render: (v: string) => v || '-' },
            { title: t('eyeSub.thDiagnosis'), dataIndex: 'diagnosis' },
            { title: t('eyeSub.thDate'), dataIndex: 'examDate' },
            { title: t('eyeSub.thKeyValues'), render: (_, r: any) => (r.findings ? JSON.stringify(Object.fromEntries(Object.entries(r.findings).filter(([k]) => !['method', 'note', 'modality', 'bodyPart'].includes(k)))) : '-') },
          ]}
          scroll={{ x: 'max-content' }}
        />
      )}
    </Card>
  );
};

// 5 专科 + 接触镜 + 低视力 = 7 页面 (PR 4 新增)

export const StrabismusPage: React.FC = () => {
  const [eye, setEye] = useState<'OD' | 'OS'>('OD');
  const [horiz, setHoriz] = useState(10);
  const [vert, setVert] = useState(0);
  const [torsion, setTorsion] = useState(0);
  const [patientId, setPatientId] = useState('P000001');
  const [result, setResult] = useState<any>(null);
  // [v3.0.6.11-103 Wave 3A] 检查记录历史刷新
  const [histVer, setHistVer] = useState(0);

  const handleSubmit = async () => {
    try {
      // [G005 Wave1A P0] raw fetch → eyeApi (后端 eye-subspecialty 模块真实实现)
      const res = await eyeApi.strabismusSynoptophore({ patientId, eye, horizontalPrism: horiz, verticalPrism: vert, torsion });
      if (res.success) { setResult(res.data); setHistVer(v => v + 1); message.success(t('eyeSub.strabismusDone')); }
    } catch (e: any) { message.error(e.message); }
  };

  return (
    <div style={{ padding: 24, background: 'var(--bg-card)',}}>
      <Space style={{ marginBottom: 16 }}>
        <Eye size={20} />
        <span style={{ fontSize: 18, fontWeight: 600 }}>{t('eyeSub.strabismusTitle')}</span>
        {/* [G005 Wave1A P0] /eye/subspecialty|low-vision|contact-lens 已接真实后端, MSW 仅 dev 兜底 */}
        <Tag color="green">{t('eyeSub.realBackend')}</Tag>
        <Tag color="cyan">PR4</Tag>
        <Tag color="purple">v3.0.6.8-37</Tag>
        <Tag color="blue">{t('eyeSub.strabismusTag')}</Tag>
      </Space>
      <Row gutter={16}>
        <Col span={10}>
          <Card title={t('eyeSub.strabismusCard')} size="small">
            <Form layout="vertical" size="small">
              <Form.Item label={t('eyeSub.patientId')}><Input value={patientId} onChange={e => setPatientId(e.target.value)} /></Form.Item>
              <Form.Item label={t('eyeSub.eyeSide')}>
                <Radio.Group value={eye} onChange={e => setEye(e.target.value)}>
                  <Radio.Button value="OD">{t('eyeSub.odRight')}</Radio.Button>
                  <Radio.Button value="OS">{t('eyeSub.osLeft')}</Radio.Button>
                </Radio.Group>
              </Form.Item>
              <Form.Item label={`${t('eyeSub.horizontalDeviation')} (Δ) - ${horiz > 0 ? t('eyeSub.esotropia') : horiz < 0 ? t('eyeSub.exotropia') : t('eyeSub.orthophoria')}`}>
                <InputNumber value={horiz} onChange={v => setHoriz(v || 0)} min={-50} max={50} step={1} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item label={`${t('eyeSub.verticalDeviation')} (Δ) - ${vert > 0 ? t('eyeSub.hypertropia') : vert < 0 ? t('eyeSub.hypotropia') : t('eyeSub.orthophoria')}`}>
                <InputNumber value={vert} onChange={v => setVert(v || 0)} min={-20} max={20} step={1} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item label={`${t('eyeSub.torsionDeviation')} (°)`}>
                <InputNumber value={torsion} onChange={v => setTorsion(v || 0)} min={-30} max={30} step={1} style={{ width: '100%' }} />
              </Form.Item>
              <Button type="primary" block icon={<Save size={14} />} onClick={handleSubmit}>{t('eyeSub.save')}</Button>
            </Form>
          </Card>
        </Col>
        <Col span={14}>
          <Card title={t('eyeSub.resultsTitle')} size="small">
            {result ? (
              <>
                <StatCardGrid minWidth={200} gap={16}>
                  <StatCard title={t('eyeSub.horizontal')} value={`${result.result.horizontal.value} ${result.result.horizontal.unit}`}
                    color={Math.abs(result.result.horizontal.value) > 10 ? 'error' : 'success'}
                    sub={result.result.horizontal.type} />
                  <StatCard title={t('eyeSub.vertical')} value={`${result.result.vertical.value} ${result.result.vertical.unit}`}
                    sub={result.result.vertical.type} />
                  <StatCard title={t('eyeSub.torsion')} value={`${result.result.torsion.value}${result.result.torsion.unit}`} />
                </StatCardGrid>
                <Divider style={{ margin: '8px 0' }} />
                <Alert title={result.diagnosis} type={result.diagnosis === '正常' ? 'success' : 'warning'} showIcon />
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 8 }}>{t('eyeSub.method')}: {result.method}</div>
              </>
            ) : <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t('eyeSub.clickSave')} />}
          </Card>
        </Col>
      </Row>
      {/* [v3.0.6.11-103 Wave 3A] 检查记录历史 */}
      <SubRecordHistory sub="strabismus" patientId={patientId} refreshKey={histVer} />
    </div>
  );
};

export const NeuroOphthalmologyPage: React.FC = () => {
  const [test, setTest] = useState<'ishihara' | 'farnsworth' | 'd15'>('ishihara');
  const [errors, setErrors] = useState(0);
  const [p100Lat, setP100Lat] = useState(105);
  const [p100Amp, setP100Amp] = useState(8.5);
  const [result, setResult] = useState<any>(null);
  // [v3.0.6.11-103 Wave 3A] 检查记录历史刷新
  const [histVer, setHistVer] = useState(0);

  const handleColor = async () => {
    try {
      // [G005 Wave1A P0] raw fetch → eyeApi (后端真实实现)
      const res = await eyeApi.neuroColorVision({ patientId: 'P000001', test, errors, eye: 'OD' });
      if (res.success) { setResult({ ...(res.data as any), type: 'color' }); setHistVer(v => v + 1); message.success(t('eyeSub.colorDone')); }
    } catch (e: any) { message.error(e.message); }
  };

  const handlePvep = async () => {
    try {
      // [G005 Wave1A P0] raw fetch → eyeApi (后端真实实现)
      const res = await eyeApi.neuroPvep({ patientId: 'P000001', eye: 'OD', p100Latency: p100Lat, p100Amplitude: p100Amp });
      if (res.success) { setResult({ ...(res.data as any), type: 'pvep' }); setHistVer(v => v + 1); message.success(t('eyeSub.pvepDone')); }
    } catch (e: any) { message.error(e.message); }
  };

  return (
    <div style={{ padding: 24, background: 'var(--bg-card)',}}>
      <Space style={{ marginBottom: 16 }}>
        <Activity size={20} />
        <span style={{ fontSize: 18, fontWeight: 600 }}>{t('eyeSub.neuroTitle')}</span>
        {/* [G005 Wave1A P0] /eye/subspecialty|low-vision|contact-lens 已接真实后端, MSW 仅 dev 兜底 */}
        <Tag color="green">{t('eyeSub.realBackend')}</Tag>
        <Tag color="cyan">PR4</Tag>
        <Tag color="purple">v3.0.6.8-37</Tag>
        <Tag color="blue">{t('eyeSub.neuroTag')}</Tag>
      </Space>
      <Row gutter={16}>
        <Col span={10}>
          <Card title={t('eyeSub.colorCard')} size="small">
            <Form layout="vertical" size="small">
              <Form.Item label={t('eyeSub.testMethod')}>
                <Radio.Group value={test} onChange={e => setTest(e.target.value)}>
                  <Radio.Button value="ishihara">Ishihara</Radio.Button>
                  <Radio.Button value="d15">D-15</Radio.Button>
                </Radio.Group>
              </Form.Item>
              <Form.Item label={t('eyeSub.errorCount')}>
                <InputNumber value={errors} onChange={v => setErrors(v || 0)} min={0} max={38} style={{ width: '100%' }} />
              </Form.Item>
              <Button type="primary" block onClick={handleColor}>{t('eyeSub.examine')}</Button>
            </Form>
          </Card>
          <Card title={t('eyeSub.pvepCard')} size="small" style={{ marginTop: 16 }}>
            <Form layout="vertical" size="small">
              <Form.Item label={t('eyeSub.p100Latency')}>
                <InputNumber value={p100Lat} onChange={v => setP100Lat(v || 105)} min={80} max={200} step={1} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item label={t('eyeSub.p100Amplitude')}>
                <InputNumber value={p100Amp} onChange={v => setP100Amp(v || 8.5)} min={1} max={30} step={0.1} style={{ width: '100%' }} />
              </Form.Item>
              <Button type="primary" block onClick={handlePvep}>{t('eyeSub.examine')}</Button>
            </Form>
          </Card>
        </Col>
        <Col span={14}>
          <Card title={t('eyeSub.resultsTitle')} size="small">
            {result ? (
              result.type === 'color' ? (
                <Alert title={result.diagnosis} description={`${result.method} | ${t('eyeSub.errors')}: ${result.errors}`} type={result.diagnosis.includes('异常') ? 'warning' : 'success'} showIcon />
              ) : (
                <>
                  <StatCardGrid minWidth={200} gap={16}>
                    <StatCard title={t('eyeSub.p100LatencyShort')} value={`${result.p100Latency.value} ${result.p100Latency.unit}`} color={result.p100Latency.normal ? 'success' : 'error'} />
                    <StatCard title={t('eyeSub.p100AmplitudeShort')} value={`${result.p100Amplitude.value} ${result.p100Amplitude.unit}`} />
                  </StatCardGrid>
                  <Alert style={{ marginTop: 16 }} title={result.diagnosis} type={result.diagnosis.includes('正常') ? 'success' : 'warning'} showIcon />
                </>
              )
            ) : <Empty description={t('eyeSub.noData')} image={<Inbox size={48} style={{opacity:0.4}}/>} />}
          </Card>
        </Col>
      </Row>
      {/* [v3.0.6.11-103 Wave 3A] 检查记录历史 */}
      <SubRecordHistory sub="neuro" patientId="P000001" refreshKey={histVer} />
    </div>
  );
};

export const OcularOncologyPage: React.FC = () => {
  const [od, setOd] = useState(14);
  const [os, setOs] = useState(15);
  const [ref, setRef] = useState(12);
  const [result, setResult] = useState<any>(null);
  // [v3.0.6.11-103 Wave 3A] 检查记录历史刷新
  const [histVer, setHistVer] = useState(0);
  const handleSubmit = async () => {
    try {
      // [G005 Wave1A P0] raw fetch → eyeApi (后端真实实现)
      const res = await eyeApi.oncologyExophthalmometry({ patientId: 'P000001', odValue: od, osValue: os, reference: ref });
      if (res.success) { setResult(res.data); setHistVer(v => v + 1); message.success(t('eyeSub.exophDone')); }
    } catch (e: any) { message.error(e.message); }
  };
  return (
    <div style={{ padding: 24, background: 'var(--bg-card)',}}>
      <Space style={{ marginBottom: 16 }}>
        <Compass size={20} />
        <span style={{ fontSize: 18, fontWeight: 600 }}>{t('eyeSub.oncologyTitle')}</span>
        {/* [G005 Wave1A P0] /eye/subspecialty|low-vision|contact-lens 已接真实后端, MSW 仅 dev 兜底 */}
        <Tag color="green">{t('eyeSub.realBackend')}</Tag>
        <Tag color="cyan">PR4</Tag>
        <Tag color="purple">v3.0.6.8-37</Tag>
        <Tag color="blue">{t('eyeSub.hertelTag')}</Tag>
      </Space>
      <Row gutter={16}>
        <Col span={10}>
          <Card title={t('eyeSub.hertelCard')} size="small">
            <Form layout="vertical" size="small">
              <Form.Item label={t('eyeSub.rightEyeOD')}><InputNumber value={od} onChange={v => setOd(v || 14)} min={5} max={30} step={0.5} style={{ width: '100%' }} /></Form.Item>
              <Form.Item label={t('eyeSub.leftEyeOS')}><InputNumber value={os} onChange={v => setOs(v || 15)} min={5} max={30} step={0.5} style={{ width: '100%' }} /></Form.Item>
              <Form.Item label={t('eyeSub.referenceValue')}><InputNumber value={ref} onChange={v => setRef(v || 12)} min={8} max={20} step={0.5} style={{ width: '100%' }} /></Form.Item>
              <Button type="primary" block onClick={handleSubmit}>{t('eyeSub.examine')}</Button>
            </Form>
          </Card>
        </Col>
        <Col span={14}>
          <Card title={t('eyeSub.resultCard')} size="small">
            {result ? (
              <>
                <StatCardGrid minWidth={200} gap={16}>
                  <StatCard title="OD" value={result.od.value} suffix="mm" />
                  <StatCard title="OS" value={result.os.value} suffix="mm" />
                  <StatCard title={t('eyeSub.difference')} value={result.difference} suffix="mm" color={result.difference > 2 ? 'error' : 'success'} />
                </StatCardGrid>
                <Alert style={{ marginTop: 16 }} title={result.diagnosis} type={result.diagnosis === '双眼对称' ? 'success' : 'warning'} showIcon />
              </>
            ) : <Empty description={t('eyeSub.noData')} image={<Inbox size={48} style={{opacity:0.4}}/>} />}
          </Card>
        </Col>
      </Row>
      {/* [v3.0.6.11-103 Wave 3A] 检查记录历史 */}
      <SubRecordHistory sub="oncology" patientId="P000001" refreshKey={histVer} />
    </div>
  );
};

export const CorneaPage: React.FC = () => {
  const [kmax, setKmax] = useState(46.5);
  const [pachy, setPachy] = useState(540);
  const [bad, setBad] = useState(1.2);
  const [result, setResult] = useState<any>(null);
  // [v3.0.6.11-103 Wave 3A] 检查记录历史刷新
  const [histVer, setHistVer] = useState(0);
  const handleSubmit = async () => {
    try {
      // [G005 Wave1A P0] raw fetch → eyeApi (后端真实实现)
      const res = await eyeApi.corneaPentacam({ patientId: 'P000001', eye: 'OD', kmax, thinnestPachy: pachy, pachyMin: pachy, pachyMinX: 0, pachyMinY: -0.5 });
      if (res.success) { setResult(res.data); setHistVer(v => v + 1); message.success(t('eyeSub.corneaDone')); }
    } catch (e: any) { message.error(e.message); }
  };
  return (
    <div style={{ padding: 24, background: 'var(--bg-card)',}}>
      <Space style={{ marginBottom: 16 }}>
        <Layers size={20} />
        <span style={{ fontSize: 18, fontWeight: 600 }}>{t('eyeSub.corneaTitle')}</span>
        {/* [G005 Wave1A P0] /eye/subspecialty|low-vision|contact-lens 已接真实后端, MSW 仅 dev 兜底 */}
        <Tag color="green">{t('eyeSub.realBackend')}</Tag>
        <Tag color="cyan">PR4</Tag>
        <Tag color="purple">v3.0.6.8-37</Tag>
        <Tag color="blue">{t('eyeSub.corneaTag')}</Tag>
      </Space>
      <Row gutter={16}>
        <Col span={10}>
          <Card title={t('eyeSub.pentacamCard')} size="small">
            <Form layout="vertical" size="small">
              <Form.Item label={t('eyeSub.kmax')}><InputNumber value={kmax} onChange={v => setKmax(v || 46.5)} min={35} max={70} step={0.1} style={{ width: '100%' }} /></Form.Item>
              <Form.Item label={t('eyeSub.thinnestPachy')}><InputNumber value={pachy} onChange={v => setPachy(v || 540)} min={300} max={700} step={1} style={{ width: '100%' }} /></Form.Item>
              <Form.Item label={t('eyeSub.badIndex')}><InputNumber value={bad} onChange={v => setBad(v || 1.2)} min={-5} max={10} step={0.1} style={{ width: '100%' }} /></Form.Item>
              <Button type="primary" block onClick={handleSubmit}>{t('eyeSub.examine')}</Button>
            </Form>
          </Card>
        </Col>
        <Col span={14}>
          <Card title={t('eyeSub.resultCard')} size="small">
            {result ? (
              <>
                <StatCardGrid minWidth={200} gap={16}>
                  <StatCard title={t('eyeSub.maxK')} value={result.kmax.value} suffix="D" color={result.kmax.value > 47 ? 'error' : 'success'} />
                  <StatCard title={t('eyeSub.thinnestPoint')} value={result.thinnestPachy.value} suffix="μm" color={result.thinnestPachy.value < 480 ? 'error' : 'success'} />
                  <StatCard title={t('eyeSub.badScore')} value={result.badScore} color={result.badScore >= 2 ? 'error' : 'success'} />
                </StatCardGrid>
                <Alert style={{ marginTop: 16 }} title={result.diagnosis} type={result.isKeratoconus ? 'error' : 'success'} showIcon />
              </>
            ) : <Empty description={t('eyeSub.noData')} image={<Inbox size={48} style={{opacity:0.4}}/>} />}
          </Card>
        </Col>
      </Row>
      {/* [v3.0.6.11-103 Wave 3A] 检查记录历史 */}
      <SubRecordHistory sub="cornea" patientId="P000001" refreshKey={histVer} />
    </div>
  );
};

export const ContactLensFittingPage: React.FC = () => {
  const [lensType, setLensType] = useState('RGP');
  const [brand, setBrand] = useState('Bausch + Lomb');
  const [bc, setBc] = useState(7.8);
  const [dia, setDia] = useState(14.0);
  const [power, setPower] = useState(-3.0);
  const [result, setResult] = useState<any>(null);
  const handleSubmit = async () => {
    try {
      // [v3.0.6.11-88 Round10] raw fetch → eyeApi.contactLensFitting (后端 POST /eye/contact-lens/fitting 真实存在)
      const res = await eyeApi.contactLensFitting({ patientId: 'P000001', lensType, brand, bc, dia, power });
      if (res.success) { setResult(res.data); message.success(t('eyeSub.lensSaved')); }
    } catch (e: any) { message.error(e.message); }
  };
  return (
    <div style={{ padding: 24, background: 'var(--bg-card)',}}>
      <Space style={{ marginBottom: 16 }}>
        <Glasses size={20} />
        <span style={{ fontSize: 18, fontWeight: 600 }}>{t('eyeSub.lensTitle')}</span>
        {/* [G005 Wave1A P0] /eye/subspecialty|low-vision|contact-lens 已接真实后端, MSW 仅 dev 兜底 */}
        <Tag color="green">{t('eyeSub.realBackend')}</Tag>
        <Tag color="cyan">PR4</Tag>
        <Tag color="purple">v3.0.6.8-37</Tag>
        <Tag color="blue">{t('eyeSub.lensTag')}</Tag>
      </Space>
      <Row gutter={16}>
        <Col span={10}>
          <Card title={t('eyeSub.fittingParams')} size="small">
            <Form layout="vertical" size="small">
              <Form.Item label={t('eyeSub.lensType')}>
                <Select value={lensType} onChange={setLensType} options={[
                  { value: 'RGP', label: t('eyeSub.lensTypeRgp') },
                  { value: 'Scleral', label: t('eyeSub.lensTypeScleral') },
                  { value: 'OK', label: t('eyeSub.lensTypeOk') },
                  { value: 'Soft', label: t('eyeSub.lensTypeSoft') },
                ]} />
              </Form.Item>
              <Form.Item label={t('eyeSub.brand')}><Input value={brand} onChange={e => setBrand(e.target.value)} /></Form.Item>
              <Form.Item label={t('eyeSub.baseCurve')}><InputNumber value={bc} onChange={v => setBc(v || 7.8)} min={6} max={12} step={0.1} style={{ width: '100%' }} /></Form.Item>
              <Form.Item label={t('eyeSub.diameter')}><InputNumber value={dia} onChange={v => setDia(v || 14.0)} min={10} max={24} step={0.1} style={{ width: '100%' }} /></Form.Item>
              <Form.Item label={t('eyeSub.power')}><InputNumber value={power} onChange={v => setPower(v || -3.0)} min={-30} max={30} step={0.25} style={{ width: '100%' }} /></Form.Item>
              <Button type="primary" block icon={<Save size={14} />} onClick={handleSubmit}>{t('eyeSub.saveFitting')}</Button>
            </Form>
          </Card>
        </Col>
        <Col span={14}>
          <Card title={t('eyeSub.fittingResult')} size="small">
            {result ? (
              <>
                <StatCardGrid minWidth={200} gap={16}>
                  <StatCard title={t('eyeSub.fittingId')} value={result.fittingId} />
                  <StatCard title={t('eyeSub.type')} value={result.lensType} />
                  <StatCard title={t('eyeSub.bc')} value={result.bc} suffix="mm" />
                  <StatCard title={t('eyeSub.dia')} value={result.dia} suffix="mm" />
                  <StatCard title={t('eyeSub.powerShort')} value={result.power} suffix="D" />
                </StatCardGrid>
                <Alert style={{ marginTop: 16 }} title={`${t('eyeSub.fit')}: ${result.fit}`} type="success" showIcon />
              </>
            ) : <Empty description={t('eyeSub.noData')} image={<Inbox size={48} style={{opacity:0.4}}/>} />}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export const LowVisionPage: React.FC = () => {
  const [reDist, setReDist] = useState('0.1');
  const [reNear, setReNear] = useState('0.5');
  const [leDist, setLeDist] = useState('0.08');
  const [leNear, setLeNear] = useState('0.4');
  const [reDevice, setReDevice] = useState('普通眼镜 + 手持放大镜 4X');
  const [result, setResult] = useState<any>(null);
  const handleSubmit = async () => {
    try {
      // [G005 Wave1A P0] raw fetch → eyeApi (后端真实实现)
      const res = await eyeApi.lowVisionPrescription({ patientId: 'P000001', reDist, reNear, leDist, leNear, reDevice, leDevice: reDevice, recommendation: '手持放大镜 4X' });
      if (res.success) { setResult(res.data); message.success(t('eyeSub.lowVisionSaved')); }
    } catch (e: any) { message.error(e.message); }
  };
  // [v3.0.6.11-103 Wave 3A] 加载最近处方 (后端 GET /eye/low-vision/prescription)
  const loadLatest = async () => {
    try {
      const res = await eyeApi.getLowVisionPrescription();
      if (res.success) { setResult(res.data); message.success(t('eyeSub.latestLoaded')); }
    } catch (e: any) { message.error(e.message); }
  };
  return (
    <div style={{ padding: 24, background: 'var(--bg-card)',}}>
      <Space style={{ marginBottom: 16 }}>
        <Accessibility size={20} />
        <span style={{ fontSize: 18, fontWeight: 600 }}>{t('eyeSub.lowVisionTitle')}</span>
        {/* [G005 Wave1A P0] /eye/subspecialty|low-vision|contact-lens 已接真实后端, MSW 仅 dev 兜底 */}
        <Tag color="green">{t('eyeSub.realBackend')}</Tag>
        <Tag color="cyan">PR4</Tag>
        <Tag color="purple">v3.0.6.8-37</Tag>
        <Tag color="blue">{t('eyeSub.lowVisionTag')}</Tag>
      </Space>
      <Row gutter={16}>
        <Col span={10}>
          <Card title={t('eyeSub.vaParams')} size="small">
            <Form layout="vertical" size="small">
              <Row gutter={8}>
                <Col span={12}><Form.Item label={t('eyeSub.odDist')}><Input value={reDist} onChange={e => setReDist(e.target.value)} /></Form.Item></Col>
                <Col span={12}><Form.Item label={t('eyeSub.odNear')}><Input value={reNear} onChange={e => setReNear(e.target.value)} /></Form.Item></Col>
              </Row>
              <Row gutter={8}>
                <Col span={12}><Form.Item label={t('eyeSub.osDist')}><Input value={leDist} onChange={e => setLeDist(e.target.value)} /></Form.Item></Col>
                <Col span={12}><Form.Item label={t('eyeSub.osNear')}><Input value={leNear} onChange={e => setLeNear(e.target.value)} /></Form.Item></Col>
              </Row>
              <Form.Item label={t('eyeSub.deviceRecommend')}><Input value={reDevice} onChange={e => setReDevice(e.target.value)} /></Form.Item>
              <Button type="primary" block onClick={handleSubmit}>{t('eyeSub.issuePrescription')}</Button>
            </Form>
          </Card>
        </Col>
        <Col span={14}>
          <Card title={t('eyeSub.prescriptionCard')} size="small">
            {result ? (
              <Row gutter={[16, 16]}>
                <Col span={12}>
                  <Card size="small" title={t('eyeSub.odRightEye')}>
                    <div>{t('eyeSub.far')}: {result.rightEye?.distance ?? result.odDistance ?? '-'}</div>
                    <div>{t('eyeSub.near')}: {result.rightEye?.near ?? result.odNear ?? '-'}</div>
                    <div>{t('eyeSub.aid')}: {result.rightEye?.device ?? '-'}</div>
                  </Card>
                </Col>
                <Col span={12}>
                  <Card size="small" title={t('eyeSub.osLeftEye')}>
                    <div>{t('eyeSub.far')}: {result.leftEye?.distance ?? result.osDistance ?? '-'}</div>
                    <div>{t('eyeSub.near')}: {result.leftEye?.near ?? result.osNear ?? '-'}</div>
                    <div>{t('eyeSub.aid')}: {result.leftEye?.device ?? '-'}</div>
                  </Card>
                </Col>
                <Col span={24}><Alert title={t('eyeSub.recommendDevice')} description={result.deviceRecommendation ?? '-'} type="success" showIcon /></Col>
              </Row>
            ) : <Empty description={t('eyeSub.noData')} image={<Inbox size={48} style={{opacity:0.4}}/>} />}
          </Card>
          {/* [v3.0.6.11-103 Wave 3A] 加载最近处方 */}
          <Button style={{ marginTop: 8 }} icon={<Save size={12} />} onClick={loadLatest}>
            {t('eye.sub.loadLatest')}
          </Button>
        </Col>
      </Row>
    </div>
  );
};

// ===== [v3.0.6.8-83] Cataract + Refractive (PR4 补齐) =====
export const CataractPage: React.FC = () => {
  const [nuclearGrade, setNuclearGrade] = useState(2);
  const [corticalGrade, setCorticalGrade] = useState(1);
  const [pscGrade, setPscGrade] = useState(0);
  const [va, setVa] = useState('0.3');
  const [result, setResult] = useState<any>(null);
  // [v3.0.6.11-103 Wave 3A] 检查记录历史刷新
  const [histVer, setHistVer] = useState(0);
  const handleSubmit = async () => {
    try {
      // [G005 Wave1A P0] raw fetch → eyeApi (后端真实实现)
      const res = await eyeApi.cataractLensOpacity({ patientId: 'P000001', eye: 'OD', nuclearGrade, corticalGrade, pscGrade, bestCorrectedVA: va });
      if (res.success) { setResult(res.data); setHistVer(v => v + 1); message.success(t('eyeSub.cataractDone')); }
    } catch (e: any) { message.error(e.message); }
  };
  const gradeColor = (g: number) => g >= 3 ? '#ff4d4f' : g >= 2 ? '#faad14' : '#52c41a';
  return (
    <div style={{ padding: 24, background: 'var(--bg-card)',}}>
      <Space style={{ marginBottom: 16 }}>
        <Eye size={20} />
        <span style={{ fontSize: 18, fontWeight: 600 }}>{t('eyeSub.cataractTitle')}</span>
        {/* [G005 Wave1A P0] /eye/subspecialty|low-vision|contact-lens 已接真实后端, MSW 仅 dev 兜底 */}
        <Tag color="green">{t('eyeSub.realBackend')}</Tag>
        <Tag color="cyan">PR4</Tag>
        <Tag color="purple">v3.0.6.8-83</Tag>
        <Tag color="blue">{t('eyeSub.cataractTag')}</Tag>
      </Space>
      <Row gutter={16}>
        <Col span={10}>
          <Card title={t('eyeSub.cataractCard')} size="small">
            <Form layout="vertical" size="small">
              <Form.Item label={`${t('eyeSub.nuclear')} (Grade ${nuclearGrade})`}><InputNumber value={nuclearGrade} onChange={v => setNuclearGrade(v || 0)} min={0} max={5} step={1} style={{ width: '100%' }} /></Form.Item>
              <Form.Item label={`${t('eyeSub.cortical')} (Grade ${corticalGrade})`}><InputNumber value={corticalGrade} onChange={v => setCorticalGrade(v || 0)} min={0} max={5} step={1} style={{ width: '100%' }} /></Form.Item>
              <Form.Item label={`${t('eyeSub.psc')} (Grade ${pscGrade})`}><InputNumber value={pscGrade} onChange={v => setPscGrade(v || 0)} min={0} max={5} step={1} style={{ width: '100%' }} /></Form.Item>
              <Form.Item label={t('eyeSub.bcva')}><Input value={va} onChange={e => setVa(e.target.value)} /></Form.Item>
              <Button type="primary" block onClick={handleSubmit}>{t('eyeSub.evaluate')}</Button>
            </Form>
          </Card>
        </Col>
        <Col span={14}>
          <Card title={t('eyeSub.resultCard')} size="small">
            {result ? (
              <>
                <StatCardGrid minWidth={200} gap={16}>
                  <StatCard title={t('eyeSub.nuclearShort')} value={result.nuclearGrade} color={gradeColor(result.nuclearGrade)} />
                  <StatCard title={t('eyeSub.corticalShort')} value={result.corticalGrade} color={gradeColor(result.corticalGrade)} />
                  <StatCard title={t('eyeSub.pscShort')} value={result.pscGrade} color={gradeColor(result.pscGrade)} />
                  <StatCard title={t('eyeSub.totalGrade')} value={result.totalScore} color={result.totalScore >= 4 ? 'error' : 'success'} />
                </StatCardGrid>
                <Alert style={{ marginTop: 16 }} title={result.diagnosis} description={`${t('eyeSub.suggestion')}: ${result.recommendation}`} type={result.needsSurgery ? 'warning' : 'success'} showIcon />
              </>
            ) : <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t('eyeSub.clickEvaluate')} />}
          </Card>
        </Col>
      </Row>
      {/* [v3.0.6.11-103 Wave 3A] 检查记录历史 */}
      <SubRecordHistory sub="cataract" patientId="P000001" refreshKey={histVer} />
    </div>
  );
};

export const RefractivePage: React.FC = () => {
  const [sphereOD, setSphereOD] = useState(-3.5);
  const [cylinderOD, setCylinderOD] = useState(-0.75);
  const [axisOD, setAxisOD] = useState(180);
  const [sphereOS, setSphereOS] = useState(-3.0);
  const [cylinderOS, setCylinderOS] = useState(-0.5);
  const [axisOS, setAxisOS] = useState(170);
  const [result, setResult] = useState<any>(null);
  // [v3.0.6.11-103 Wave 3A] 检查记录历史刷新
  const [histVer, setHistVer] = useState(0);
  const handleSubmit = async () => {
    try {
      // [G005 Wave1A P0] raw fetch → eyeApi (后端真实实现)
      const res = await eyeApi.refractivePrescription({
        patientId: 'P000001',
        rightEye: { sphere: sphereOD, cylinder: cylinderOD, axis: axisOD },
        leftEye: { sphere: sphereOS, cylinder: cylinderOS, axis: axisOS },
      });
      if (res.success) { setResult(res.data); setHistVer(v => v + 1); message.success(t('eyeSub.refractiveDone')); }
    } catch (e: any) { message.error(e.message); }
  };
  // [v3.0.6.11-103 Wave 3A] 加载最近处方 (后端 GET /eye/subspecialty/refractive/prescription)
  const loadLatest = async () => {
    try {
      const res = await eyeApi.getRefractivePrescription();
      if (res.success) { setResult(res.data); message.success(t('eyeSub.latestLoaded')); }
    } catch (e: any) { message.error(e.message); }
  };
  return (
    <div style={{ padding: 24, background: 'var(--bg-card)',}}>
      <Space style={{ marginBottom: 16 }}>
        <Zap size={20} />
        <span style={{ fontSize: 18, fontWeight: 600 }}>{t('eyeSub.refractiveTitle')}</span>
        {/* [G005 Wave1A P0] /eye/subspecialty|low-vision|contact-lens 已接真实后端, MSW 仅 dev 兜底 */}
        <Tag color="green">{t('eyeSub.realBackend')}</Tag>
        <Tag color="cyan">PR4</Tag>
        <Tag color="purple">v3.0.6.8-83</Tag>
        <Tag color="blue">{t('eyeSub.refractiveTag')}</Tag>
      </Space>
      <Row gutter={16}>
        <Col span={10}>
          <Card title={t('eyeSub.refractiveParams')} size="small">
            <Form layout="vertical" size="small">
              <Divider style={{ margin: '4px 0' }}>{t('eyeSub.odRightEye')}</Divider>
              <Form.Item label={t('eyeSub.sphere')}><InputNumber value={sphereOD} onChange={v => setSphereOD(v || 0)} min={-20} max={20} step={0.25} style={{ width: '100%' }} /></Form.Item>
              <Form.Item label={t('eyeSub.cylinder')}><InputNumber value={cylinderOD} onChange={v => setCylinderOD(v || 0)} min={-10} max={0} step={0.25} style={{ width: '100%' }} /></Form.Item>
              <Form.Item label={t('eyeSub.axis')}><InputNumber value={axisOD} onChange={v => setAxisOD(v || 0)} min={0} max={180} step={1} style={{ width: '100%' }} /></Form.Item>
              <Divider style={{ margin: '4px 0' }}>{t('eyeSub.osLeftEye')}</Divider>
              <Form.Item label={t('eyeSub.sphere')}><InputNumber value={sphereOS} onChange={v => setSphereOS(v || 0)} min={-20} max={20} step={0.25} style={{ width: '100%' }} /></Form.Item>
              <Form.Item label={t('eyeSub.cylinder')}><InputNumber value={cylinderOS} onChange={v => setCylinderOS(v || 0)} min={-10} max={0} step={0.25} style={{ width: '100%' }} /></Form.Item>
              <Form.Item label={t('eyeSub.axis')}><InputNumber value={axisOS} onChange={v => setAxisOS(v || 0)} min={0} max={180} step={1} style={{ width: '100%' }} /></Form.Item>
              <Button type="primary" block onClick={handleSubmit}>{t('eyeSub.issuePrescription')}</Button>
            </Form>
          </Card>
        </Col>
        <Col span={14}>
          <Card title={t('eyeSub.rxPlan')} size="small">
            {result ? (
              <Row gutter={[16, 16]}>
                <Col span={12}>
                  <Card size="small" title={t('eyeSub.odRightEye')}>
                    <div>S: {result.prescription.rightEye.sphere} D</div>
                    <div>C: {result.prescription.rightEye.cylinder} D</div>
                    <div>AXIS: {result.prescription.rightEye.axis}°</div>
                    <div>SE: {result.prescription.rightEye.se} D</div>
                  </Card>
                </Col>
                <Col span={12}>
                  <Card size="small" title={t('eyeSub.osLeftEye')}>
                    <div>S: {result.prescription.leftEye.sphere} D</div>
                    <div>C: {result.prescription.leftEye.cylinder} D</div>
                    <div>AXIS: {result.prescription.leftEye.axis}°</div>
                    <div>SE: {result.prescription.leftEye.se} D</div>
                  </Card>
                </Col>
                <Col span={24}>
                  <Alert
                    title={`${t('eyeSub.recommendedProcedure')}: ${result.recommendedProcedure}`}
                    description={`${t('eyeSub.rationale')}: ${result.procedureRationale}`}
                    type="info" showIcon />
                </Col>
                <Col span={24}>
                  <Alert
                    title={`${t('eyeSub.expectedPostopVA')}: ${result.expectedPostopVA}`}
                    description={`${t('eyeSub.riskLevel')}: ${result.riskLevel}`}
                    type={result.riskLevel === 'low' ? 'success' : 'warning'} showIcon />
                </Col>
              </Row>
            ) : <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t('eyeSub.clickPrescribe')} />}
          </Card>
          {/* [v3.0.6.11-103 Wave 3A] 加载最近处方 */}
          <Button style={{ marginTop: 8 }} icon={<Save size={12} />} onClick={loadLatest}>
            {t('eye.sub.loadLatest')}
          </Button>
        </Col>
      </Row>
      {/* [v3.0.6.11-103 Wave 3A] 检查记录历史 */}
      <SubRecordHistory sub="refractive" patientId="P000001" refreshKey={histVer} />
    </div>
  );
};
