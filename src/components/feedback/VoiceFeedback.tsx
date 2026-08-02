/**
 * G005 放射RIS系统 v3.0.6.5 - 语音听写实时反馈
 * 15 升级点:音频波形 / 实时识别 / 命令触发可视化
 */

import React, { useEffect, useRef } from 'react';
import { Card, Tag, Space, Progress, Statistic, Row, Col } from 'antd';
import { Activity, Mic, MicOff, Command, Volume2, BarChart3, Zap } from 'lucide-react';
import type { AudioMetrics, VoiceCommandMatch } from '../../types/voice';

interface Props {
  isListening: boolean;
  isPaused?: boolean;
  audioMetrics?: AudioMetrics | null;
  interimText?: string;
  matches?: VoiceCommandMatch[];
  level?: 'minimal' | 'normal' | 'verbose' | 'debug';
  height?: number;
}

export const VoiceFeedback: React.FC<Props> = ({
  isListening, isPaused = false, audioMetrics, interimText, matches = [], level = 'normal', height = 120,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const phaseRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      phaseRef.current += 0.12;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // 背景
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, w, h);

      // 中线
      ctx.strokeStyle = '#1e293b';
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();

      if (isListening && !isPaused) {
        const amp = audioMetrics?.rmsLevel ?? 0.3;
        const peak = audioMetrics?.peakLevel ?? 0.5;
        // 多频条
        const barCount = 48;
        const bw = w / barCount;
        for (let i = 0; i < barCount; i++) {
          const t = i / barCount;
          const a = Math.sin(phaseRef.current + t * 6) * 0.5 + 0.5;
          const e = Math.sin(phaseRef.current * 1.4 + t * 12) * 0.3 + 0.3;
          const intensity = (a * 0.6 + e * 0.4) * (0.5 + amp);
          const bh = intensity * (h * 0.42);
          const y = h / 2 - bh;
          const hue = 200 + t * 80;
          ctx.fillStyle = `hsl(${hue}, 80%, 60%)`;
          ctx.fillRect(i * bw + 1, y, bw - 2, bh * 2);
        }
        // 峰值线
        ctx.strokeStyle = `rgba(239, 68, 68, ${Math.min(1, peak * 2)})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, h * (1 - peak) / 2);
        ctx.lineTo(w, h * (1 - peak) / 2);
        ctx.stroke();
      } else {
        // 待机状态
        ctx.fillStyle = '#475569';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(isPaused ? '已暂停' : '待机', w / 2, h / 2 + 4);
      }
      rafRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [isListening, isPaused, audioMetrics]);

  const snr = audioMetrics?.snr ?? 0;
  const speechProb = audioMetrics?.speechProbability ?? 0;
  const rmsLevel = audioMetrics?.rmsLevel ?? 0;

  return (
    <Card
      size="small"
      title={
        <Space>
          <BarChart3 className="w-4 h-4" style={{ color: isListening ? '#dc2626' : '#94a3b8' }} />
          <span className="font-semibold">语音反馈</span>
          {isListening && !isPaused && <Tag color="red" className="text-[10px]">聆听中</Tag>}
          {isPaused && <Tag color="orange" className="text-[10px]">已暂停</Tag>}
          {!isListening && <Tag className="text-[10px]">待机</Tag>}
        </Space>
      }
      className="shadow-sm"
      bodyStyle={{ padding: 12 }}
    >
      <canvas
        ref={canvasRef}
        width={480}
        height={height}
        className="w-full rounded"
        style={{ height }}
      />

      {level !== 'minimal' && (
        <Row gutter={8} className="mt-2">
          <Col span={6}><Statistic title="音量" value={(rmsLevel * 100).toFixed(0)} suffix="%" styles={{ content: {  fontSize: 12  } }} /></Col>
          <Col span={6}><Statistic title="信噪比" value={snr.toFixed(1)} suffix="dB" styles={{ content: {  fontSize: 12, color: snr > 15 ? '#10b981' : '#f59e0b'  } }} /></Col>
          <Col span={6}><Statistic title="语音概率" value={(speechProb * 100).toFixed(0)} suffix="%" styles={{ content: {  fontSize: 12  } }} /></Col>
          <Col span={6}><Statistic title="延迟" value={audioMetrics?.latencyMs.toFixed(0) ?? '0'} suffix="ms" styles={{ content: {  fontSize: 12  } }} /></Col>
        </Row>
      )}

      {snr > 0 && (
        <Progress
          percent={Math.min(100, (snr + 10) * 2.5)}
          showInfo={false}
          size="small"
          strokeColor={snr > 15 ? '#10b981' : snr > 5 ? '#f59e0b' : '#dc2626'}
          className="mt-2"
        />
      )}

      {interimText && (
        <div className="mt-2 p-2 bg-slate-50 border border-slate-200 rounded">
          <Space className="mb-1">
            <Volume2 className="w-3 h-3 text-blue-500" />
            <span className="text-[10px] text-slate-500">实时识别:</span>
          </Space>
          <div className="text-xs text-slate-700 italic">{interimText}</div>
        </div>
      )}

      {matches.length > 0 && (
        <div className="mt-2">
          <Space className="mb-1">
            <Command className="w-3 h-3 text-purple-500" />
            <span className="text-[10px] text-slate-500">已触发命令:</span>
          </Space>
          <Space wrap size={4}>
            {matches.map((m, i) => (
              <Tag key={`${m.command.id}-${i}`} color="purple" className="text-[10px]">
                <Zap className="w-2 h-2 inline mr-1" />
                "{m.matchedPhrase}" → {m.command.action}
              </Tag>
            ))}
          </Space>
        </div>
      )}
    </Card>
  );
};

export default VoiceFeedback;
