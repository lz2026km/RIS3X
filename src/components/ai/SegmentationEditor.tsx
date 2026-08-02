/**
 * G005 放射RIS系统 v3.0.6.5 - 分割编辑器
 * A5-AI-ORCH / 20 点
 */

import React, { useEffect, useState } from 'react';
import { Card, Input, Button, Space, Tag, Statistic, Row, Col, Select, message, Progress, Divider, List } from 'antd';
import { Scissors, Save, Upload, Download, RefreshCw, Wand2, Play } from 'lucide-react';
import { segmentationService } from '../../services/ai/vision/SegmentationService';
import type { AISegmentationMask, AISegmentationClass } from '../../types/ai/orchestrator';

const CLASS_PRESETS = [
  { label: '肝脏', value: 'liver' },
  { label: '肺', value: 'lung' },
  { label: '脑', value: 'brain' },
  { label: '心脏', value: 'heart' },
  { label: '骨', value: 'bone' },
  { label: '乳腺', value: 'breast' },
];

export interface SegmentationEditorProps {
  studyId: string;
  sopInstanceUid: string;
  width?: number;
  height?: number;
}

export const SegmentationEditor: React.FC<SegmentationEditorProps> = ({
  studyId,
  sopInstanceUid,
  width = 512,
  height = 512,
}) => {
  const [prompt, setPrompt] = useState('liver');
  const [algorithm, setAlgorithm] = useState<string | undefined>();
  const [mask, setMask] = useState<AISegmentationMask | null>(null);
  const [running, setRunning] = useState(false);
  const [algos, setAlgos] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    setAlgos(segmentationService.getSegmentationAlgorithms().map((a) => ({ id: a.id, name: a.name })));
  }, []);

  const run = async () => {
    if (!prompt.trim()) {
      message.warning('请输入分割提示');
      return;
    }
    setRunning(true);
    try {
      const m = await segmentationService.segment({ studyId, sopInstanceUid, prompt, algorithmId: algorithm });
      setMask(m);
      message.success('分割完成');
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setRunning(false);
    }
  };

  const exportMask = async (fmt: 'rle' | 'png' | 'nifti' | 'dicom-seg') => {
    if (!mask) return;
    const r = await segmentationService.exportMask(mask.id, fmt);
    message.success(`已导出 (${r.bytes} bytes)`);
  };

  return (
    <div data-testid="segmentation-editor" style={{ padding: 16, background: '#0f172a', minHeight: '100vh', color: '#e2e8f0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <Scissors size={24} color="#06b6d4" />
        <h2 style={{ margin: 0 }}>AI 分割编辑器</h2>
      </div>

      <Row gutter={12}>
        <Col span={16}>
          <Card size="small" title="分割预览" bodyStyle={{ padding: 0, background: '#020617' }}>
            <div style={{ position: 'relative', width, height, background: '#0f172a' }}>
              {mask?.classes.map((c) => (
                <div
                  key={c.id}
                  style={{
                    position: 'absolute',
                    left: c.boundingBox.x,
                    top: c.boundingBox.y,
                    width: c.boundingBox.width,
                    height: c.boundingBox.height,
                    background: `${c.color}40`,
                    border: `2px solid ${c.color}`,
                    borderRadius: 4,
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: -22,
                      left: 0,
                      background: c.color,
                      color: 'white',
                      padding: '1px 6px',
                      borderRadius: 3,
                      fontSize: 12,
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {c.label} ({c.volumeMl?.toFixed(1)}mL)
                  </div>
                </div>
              ))}
              {!mask && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                  暂无分割结果
                </div>
              )}
            </div>
          </Card>
        </Col>

        <Col span={8}>
          <Card size="small" title="参数" style={{ marginBottom: 12 }}>
            <Space orientation="vertical" style={{ width: '100%' }}>
              <div>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>分割提示</div>
                <Input.TextArea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={2}
                  placeholder="如：liver / 肝脏 / 脑肿瘤"
                />
                <div style={{ marginTop: 4 }}>
                  <Space wrap size={4}>
                    {CLASS_PRESETS.map((p) => (
                      <Tag.CheckableTag
                        key={p.value}
                        checked={prompt === p.value}
                        onChange={(c) => c && setPrompt(p.value)}
                      >
                        {p.label}
                      </Tag.CheckableTag>
                    ))}
                  </Space>
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>算法</div>
                <Select
                  value={algorithm}
                  onChange={setAlgorithm}
                  style={{ width: '100%' }}
                  allowClear
                  placeholder="自动选择"
                  options={algos.map((a) => ({ value: a.id, label: a.name }))}
                />
              </div>
              <Button type="primary" icon={<Play size={14} />} onClick={run} loading={running} block>
                执行分割
              </Button>
              {mask && (
                <Button icon={<RefreshCw size={14} />} onClick={() => setMask(null)} block>
                  清除
                </Button>
              )}
            </Space>
          </Card>

          {mask && (
            <Card size="small" title="结果" style={{ marginBottom: 12 }}>
              <Row gutter={8}>
                <Col span={12}><Statistic title={<span style={{ color: '#94a3b8', fontSize: 12 }}>Dice</span>} value={mask.diceScore} precision={3} styles={{ content: {  fontSize: 18, color: '#10b981'  } }} /></Col>
                <Col span={12}><Statistic title={<span style={{ color: '#94a3b8', fontSize: 12 }}>类数</span>} value={mask.classes.length} styles={{ content: {  fontSize: 18, color: '#3b82f6'  } }} /></Col>
              </Row>
              <Divider style={{ margin: '8px 0', borderColor: '#334155' }} />
              <List
                size="small"
                dataSource={mask.classes}
                renderItem={(c: AISegmentationClass) => (
                  <List.Item style={{ padding: '4px 0' }}>
                    <div style={{ width: '100%' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 10, height: 10, background: c.color, borderRadius: 2 }} />
                        <span style={{ fontSize: 12, flex: 1 }}>{c.label}</span>
                        <span style={{ fontSize: 12, color: '#94a3b8' }}>{c.voxelCount} vox</span>
                      </div>
                    </div>
                  </List.Item>
                )}
              />
              <Divider style={{ margin: '8px 0', borderColor: '#334155' }} />
              <Space wrap>
                <Button size="small" icon={<Download size={12} />} onClick={() => exportMask('rle')}>RLE</Button>
                <Button size="small" icon={<Download size={12} />} onClick={() => exportMask('png')}>PNG</Button>
                <Button size="small" icon={<Download size={12} />} onClick={() => exportMask('nifti')}>NIfTI</Button>
                <Button size="small" icon={<Download size={12} />} onClick={() => exportMask('dicom-seg')}>DICOM-SEG</Button>
              </Space>
            </Card>
          )}
        </Col>
      </Row>
    </div>
  );
};

export default SegmentationEditor;
