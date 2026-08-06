/**
 * G005 放射RIS系统 v3.0.6.0 - MLLP 监控页面
 * 20 升级点:页面包装 / 头部描述 / 操作指南 / 端口配置
 */
import React from 'react';
import { Card, Space, Tag, Button, Row, Col } from 'antd';
import { Activity, Server, BookOpen, Cpu, Network } from 'lucide-react';
import { MllpMonitor } from '@components/integration/MllpMonitor';
import { useNavigate } from 'react-router-dom';

export const MllpMonitorPage: React.FC = () => {
  const navigate = useNavigate();
  return (
    <div className="p-4 space-y-3">
      <Card size="small" className="shadow-sm">
        <div className="flex items-center justify-between">
          <Space>
            <Activity className="w-5 h-5 text-purple-600" />
            <div>
              <div className="text-base font-semibold">MLLP 监控</div>
              <div className="text-xs text-slate-500">HL7 v2.x Minimal Lower Layer Protocol · TCP 2575</div>
            </div>
          </Space>
          <Space>
            <Tag color="purple">v3.0.6.0</Tag>
            <Button size="small" icon={<BookOpen className="w-3 h-3" />} onClick={() => navigate('/integration/connectathon')}>IHE Connectathon</Button>
          </Space>
        </div>
      </Card>

      <Row gutter={8}>
        <Col span={16}>
          <MllpMonitor />
        </Col>
        <Col span={8}>
          <Card size="small" className="shadow-sm" title={<Space><Server className="w-4 h-4" /><span>MLLP 协议</span></Space>}>
            <div className="text-xs space-y-2 text-slate-600">
              <div>
                <Tag color="purple">MLLP</Tag>
                <Tag color="cyan">HL7 v2.x</Tag>
                <Tag color="blue">RFC 2711</Tag>
              </div>
              <p>MLLP (Minimal Lower Layer Protocol) 是 HL7 v2.x 在 TCP 上的最小封装协议。</p>
              <p>每帧以 <code className="bg-slate-100 px-1 rounded">&lt;VT&gt;</code> (0x0B) 开头,以 <code className="bg-slate-100 px-1 rounded">&lt;FS&gt;&lt;CR&gt;</code> (0x1C 0x0D) 结尾。</p>
              <h4 className="text-sm font-semibold mt-2 flex items-center gap-1"><Cpu className="w-3 h-3" /> 服务器特性</h4>
              <ul className="list-disc list-inside space-y-0.5">
                <li>WebSocket 桥接(浏览器内模拟)</li>
                <li>本地回环 Mock 客户端</li>
                <li>自动 ACK(AA/AE/AR)</li>
                <li>连接保活(30s 默认)</li>
                <li>实时事件流</li>
                <li>帧大小限制 4MB</li>
              </ul>
              <h4 className="text-sm font-semibold mt-2 flex items-center gap-1"><Network className="w-3 h-3" /> 帧格式</h4>
              <pre className="bg-slate-900 text-slate-100 p-2 rounded text-[10px] overflow-x-auto font-mono">
{`<VT> MSH|^~\\&|...<CR>
PID|1|...<CR>
...<CR>
<FS><CR>`}
              </pre>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default MllpMonitorPage;
