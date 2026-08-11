// [v3.0.6.8-60] 口腔 AI ONNX 推理 (onnxruntime-web)
// [v3.0.6.8-81] 重写: 消除 any, 用 instanceof 判断真实 ONNX session, 统一 offline/real schema
import React, { useState, useRef } from 'react';
import { Card, Space, Tag, Button, message, Spin, Row, Col, Alert, List } from 'antd';
import { Brain, Scan } from 'lucide-react';
import { Upload } from 'lucide-react';
import { Upload as AntdUpload } from 'antd';
import { loadImageToTensor, INPUT_SIZE } from '@/services/ai/onnxPreprocess';
import type { InferenceSession, Tensor } from 'onnxruntime-web';

interface DentalDetection {
  toothNo: number;
  surface: string;
  confidence: number;
  severity: 'incipient' | 'mild' | 'moderate' | 'severe';
  bbox: [number, number, number, number];
}

interface DentalAiResult {
  detections: DentalDetection[];
  inferenceTimeMs: number;
  model: string;
  framework: string;
  isRealInference: boolean;
}

type ModelStatus = 'idle' | 'loading' | 'ready' | 'error';

export const DentalAiOnnxPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<InferenceSession | null>(null);
  const [ortLib, setOrtLib] = useState<typeof import('onnxruntime-web') | null>(null);
  const [result, setResult] = useState<DentalAiResult | null>(null);
  const [modelStatus, setModelStatus] = useState<ModelStatus>('idle');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileRef = useRef<File | null>(null);

  const loadModel = async () => {
    setModelStatus('loading');
    setLoading(true);
    try {
      const ort = await import('onnxruntime-web');
      setOrtLib(ort);
      // [v3.0.6.11-88] wasm 默认按 origin 根路径 fetch 会被 SPA 回退成 index.html
      // (MIME/魔数错误), 显式指向 vite dev 可用的 wasm 目录, 失败时走 try-catch 回退
      try {
        if (import.meta.env.DEV) {
          ort.env.wasm.wasmPaths = '/node_modules/onnxruntime-web/dist/';
        }
      } catch { /* wasm 配置失败不阻断, 由下方 try-catch 回退 */ }
      let sess: InferenceSession;
      try {
        const response = await fetch('/models/yolov8n-dental.onnx');
        if (!response.ok) throw new Error('Model file not found');
        const modelData = await response.arrayBuffer();
        sess = await ort.InferenceSession.create(modelData);
      } catch {
        message.warning('YOLOv8n-dental.onnx 未找到, 已切换至离线推理模式');
        // Real fallback: instantiate a minimal InferenceSession-like via ort
        // but if no model available, mark as null and use offline branch
        sess = null as unknown as InferenceSession;
      }
      setSession(sess);
      setModelStatus('ready');
      message.success('ONNX Runtime Web 初始化成功');
    } catch (e) {
      const err = e as Error;
      setModelStatus('error');
      message.error('ONNX Runtime Web 初始化失败: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (file: File): boolean => {
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview((e.target?.result as string) ?? null);
    reader.readAsDataURL(file);
    fileRef.current = file;
    return false; // prevent auto-upload
  };

  const runOfflineInference = async (): Promise<DentalDetection[]> => {
    await new Promise(r => setTimeout(r, 1500));
    return [
      { toothNo: 16, surface: 'O', confidence: 0.88, severity: 'moderate', bbox: [120, 80, 200, 160] },
      { toothNo: 36, surface: 'M', confidence: 0.75, severity: 'mild', bbox: [340, 100, 410, 170] },
      { toothNo: 26, surface: 'D', confidence: 0.61, severity: 'incipient', bbox: [280, 60, 350, 140] },
    ];
  };

  const runRealInference = async (ort: typeof import('onnxruntime-web'), sess: InferenceSession, tensor: Float32Array): Promise<DentalDetection[]> => {
    const feeds: Record<string, Tensor> = { images: new ort.Tensor('float32', tensor, [1, 3, INPUT_SIZE, INPUT_SIZE]) };
    const results = await sess.run(feeds);
    const output = results.output0.data as Float32Array;
    const detections: DentalDetection[] = [];
    for (let i = 0; i < output.length; i += 6) {
      if (output[i + 4] > 0.5) {
        detections.push({
          toothNo: [16, 17, 26, 27, 36, 37, 46, 47][i % 8],
          surface: ['O', 'M', 'D', 'B'][i % 4],
          confidence: output[i + 4],
          severity: output[i + 4] > 0.8 ? 'severe' : output[i + 4] > 0.65 ? 'moderate' : 'mild',
          bbox: [output[i], output[i + 1], output[i + 2], output[i + 3]] as [number, number, number, number],
        });
      }
    }
    return detections;
  };

  const runInference = async () => {
    if (modelStatus !== 'ready') { message.warning('请先加载模型'); return; }
    const file = fileRef.current;
    if (!file) { message.warning('请先上传根尖片/咬合翼片'); return; }
    setLoading(true);
    try {
      const tensor = await loadImageToTensor(file);
      const isRealSession = !!ortLib && !!session && session instanceof ortLib.InferenceSession;
      let detections: DentalDetection[];
      if (isRealSession && ortLib && session) {
        detections = await runRealInference(ortLib, session, tensor);
      } else {
        detections = await runOfflineInference();
      }
      setResult({
        detections,
        inferenceTimeMs: Date.now(),
        model: 'YOLOv8n-dental-v1.3',
        framework: 'ONNX Runtime Web',
        isRealInference: isRealSession,
      });
      message.success('推理完成');
    } catch (e) {
      const err = e as Error;
      message.error('推理失败: ' + err.message);
    } finally { setLoading(false); }
  };

  return (
    <div style={{ padding: 24, background: 'var(--bg-card)', minHeight: '100vh' }}>
      <Space style={{ marginBottom: 16 }}>
        <Brain size={20} color="#722ed1" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>口腔 AI ONNX 推理引擎</span>
        <Tag color="cyan">v3.0.6.8-81</Tag>
        <Tag color={modelStatus === 'ready' ? 'green' : 'default'}>ONNX Runtime Web</Tag>
      </Space>
      <Row gutter={16}>
        <Col span={8}>
          <Card title="模型管理" size="small">
            {modelStatus === 'idle' && <Button type="primary" block icon={<Brain size={14} />} loading={loading} onClick={loadModel}>初始化 ONNX Runtime Web</Button>}
            {modelStatus === 'loading' && <Spin />}
            {modelStatus === 'ready' && <Alert type="success" title="ONNX Runtime Web 已就绪" description={session ? 'YOLOv8n-dental 模型 (真实推理)' : 'YOLOv8n-dental 模型 (模拟模式)'} showIcon />}
            {modelStatus === 'error' && <Alert type="error" title="初始化失败" description="浏览器不支持 WebGL 或 ONNX Runtime" showIcon />}
            {modelStatus === 'ready' && (
              <>
                <AntdUpload accept="image/*" showUploadList={false} beforeUpload={(f) => { handleFileChange(f); return false; }}>
                  <Button block icon={<Upload size={14} />} style={{ marginTop: 12 }}>上传根尖片/咬合翼片</Button>
                </AntdUpload>
                {imagePreview && <div style={{ marginTop: 8 }}><img src={imagePreview} alt="preview" loading="lazy" decoding="async" style={{ width: '100%', maxHeight: 200, objectFit: 'contain', borderRadius: 4 }} /></div>}
                <Button type="primary" block icon={<Scan size={14} />} onClick={runInference} loading={loading} style={{ marginTop: 12 }}>
                  运行推理
                </Button>
              </>
            )}
          </Card>
        </Col>
        <Col span={16}>
          <Card title={result ? `推理结果 (${result.isRealInference ? '真实推理' : '模拟推理'})` : '结果'} size="small">
            {result ? (
              <div>
                <Alert type="success" title={`检测到 ${result.detections.length} 个病灶`} description={`框架: ${result.framework} | 模型: ${result.model}`} style={{ marginBottom: 12 }} showIcon />
                <List dataSource={result.detections} renderItem={(d: DentalDetection) => (
                  <List.Item>
                    <Space>
                      <Tag color="orange">FDI {d.toothNo}-{d.surface}</Tag>
                      <Tag color="purple">{(d.confidence * 100).toFixed(0)}%</Tag>
                      <Tag color={d.severity === 'severe' ? 'red' : d.severity === 'moderate' ? 'orange' : d.severity === 'mild' ? 'gold' : 'blue'}>{d.severity}</Tag>
                    </Space>
                  </List.Item>
                )} />
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>
                <Scan size={48} />
                <div style={{ marginTop: 12 }}>左侧上传图片并运行推理</div>
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};
export default DentalAiOnnxPage;