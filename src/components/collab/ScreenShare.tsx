/**
 * G005 RIS v3.0.7 - 屏幕共享预览 (ScreenShare Preview)
 *
 *  - Mock 视频画面 (渐变背景 + 状态文本)
 *  - 主持人 / 观众信息
 *  - 录制 / 暂停 / 停止控制
 *  - 加入 / 离开观众
 */

import React, { useEffect, useState } from 'react';
import { Button, Space, Tag, Tooltip } from 'antd';
import {
  Play,
  Square,
  Pause,
  Circle,
  Users,
  Mic,
  MicOff,
  Video,
  VideoOff,
} from 'lucide-react';
import { screenShareService } from '../../services/collab/ScreenShareService';
import type { ScreenShareSession } from '../../types/collab';

export interface ScreenShareProps {
  roomId: string;
  currentUser: { id: string; name: string };
  /** 是否启用控制按钮 */
  canControl?: boolean;
  testIdPrefix?: string;
}

export const ScreenShare: React.FC<ScreenShareProps> = ({
  roomId,
  currentUser,
  canControl = true,
  testIdPrefix = 'screen-share',
}) => {
  const [session, setSession] = useState<ScreenShareSession | null>(null);

  const reload = () => {
    setSession(screenShareService.getActive(roomId));
  };

  useEffect(() => {
    reload();
    const timer = window.setInterval(reload, 1500);
    return () => window.clearInterval(timer);
  }, [roomId]);

  const start = () => {
    screenShareService.start(roomId, {
      presenterId: currentUser.id,
      presenterName: currentUser.name,
      hasAudio: true,
      hasVideo: true,
    });
  };

  const stop = () => {
    if (session) screenShareService.stop(session.id);
  };

  const pause = () => {
    if (session) screenShareService.pause(session.id);
  };

  const resume = () => {
    if (session) screenShareService.resume(session.id);
  };

  const record = () => {
    if (session) screenShareService.toggleRecording(session.id);
  };

  const join = () => {
    if (session) screenShareService.joinAsViewer(session.id, { userId: currentUser.id, userName: currentUser.name });
  };

  const leave = () => {
    if (session) screenShareService.leaveViewer(session.id, currentUser.id);
  };

  const isPresenter = session?.presenterId === currentUser.id;
  const isViewer = !!session?.viewers.some((v) => v.userId === currentUser.id);

  if (!session) {
    return (
      <div
        data-testid={`${testIdPrefix}-empty`}
        style={{
          padding: 24,
          background: '#0f172a',
          color: '#e2e8f0',
          borderRadius: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <Video size={36} color="#64748b" />
        <div style={{ fontSize: 13 }}>当前没有屏幕共享</div>
        {canControl && (
          <Button
            type="primary"
            icon={<Play size={14} />}
            onClick={start}
            data-testid={`${testIdPrefix}-start-btn`}
          >
            开始共享
          </Button>
        )}
      </div>
    );
  }

  const stateBadge = (() => {
    switch (session.state) {
      case 'sharing': return <Tag color="green" data-testid={`${testIdPrefix}-state-sharing`}>共享中</Tag>;
      case 'paused': return <Tag color="orange" data-testid={`${testIdPrefix}-state-paused`}>已暂停</Tag>;
      case 'requesting': return <Tag color="blue" data-testid={`${testIdPrefix}-state-requesting`}>连接中</Tag>;
      case 'stopped': return <Tag color="default">已停止</Tag>;
      default: return <Tag>{session.state}</Tag>;
    }
  })();

  return (
    <div
      data-testid={`${testIdPrefix}-active`}
      style={{
        background: '#0f172a',
        color: '#e2e8f0',
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      <div style={{ position: 'relative', aspectRatio: '16 / 9', background: 'linear-gradient(135deg, #1e3a5f 0%, #0f172a 50%, #1e293b 100%)' }}>
        {/* Mock 视频内容 */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <Video size={48} color="#475569" />
          <div style={{ fontSize: 12, color: '#cbd5e1' }}>屏幕共享画面 (Mock WebRTC)</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>主持人:{session.presenterName}</div>
        </div>
        {/* 录制指示灯 */}
        {session.recording && (
          <div
            data-testid={`${testIdPrefix}-recording`}
            style={{
              position: 'absolute',
              top: 8,
              left: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '2px 8px',
              background: 'rgba(220,38,38,0.85)',
              borderRadius: 4,
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            <Circle size={8} fill="#fff" color="#fff" />
            REC
          </div>
        )}
        {/* 顶部状态栏 */}
        <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 6, alignItems: 'center' }}>
          {stateBadge}
          <span style={{ fontSize: 12, color: '#94a3b8' }}>
            <Users size={11} style={{ verticalAlign: 'middle' }} /> {session.viewers.length}
          </span>
        </div>
      </div>
      <div style={{ padding: 8, background: '#1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space size={4}>
          <Tooltip title={session.hasAudio ? '麦克风开启' : '麦克风关闭'}>
            {session.hasAudio ? <Mic size={12} /> : <MicOff size={12} color="#dc2626" />}
          </Tooltip>
          <Tooltip title={session.hasVideo ? '视频开启' : '视频关闭'}>
            {session.hasVideo ? <Video size={12} /> : <VideoOff size={12} color="#dc2626" />}
          </Tooltip>
          <span style={{ fontSize: 12, color: '#cbd5e1' }}>
            {session.viewers.map((v) => v.userName).join(', ') || '无观众'}
          </span>
        </Space>
        <Space size={4}>
          {canControl && isPresenter && session.state === 'sharing' && (
            <Button size="small" icon={<Pause size={11} />} onClick={pause} data-testid={`${testIdPrefix}-pause-btn`} />
          )}
          {canControl && isPresenter && session.state === 'paused' && (
            <Button size="small" icon={<Play size={11} />} onClick={resume} data-testid={`${testIdPrefix}-resume-btn`} />
          )}
          {canControl && isPresenter && (
            <Button
              size="small"
              type={session.recording ? 'primary' : 'default'}
              icon={<Circle size={11} fill={session.recording ? '#dc2626' : 'transparent'} />}
              onClick={record}
              data-testid={`${testIdPrefix}-record-btn`}
            >
              {session.recording ? '停止录制' : '录制'}
            </Button>
          )}
          {!isPresenter && !isViewer && (
            <Button size="small" icon={<Play size={11} />} onClick={join} data-testid={`${testIdPrefix}-join-btn`}>
              加入观看
            </Button>
          )}
          {!isPresenter && isViewer && (
            <Button size="small" onClick={leave} data-testid={`${testIdPrefix}-leave-btn`}>
              离开
            </Button>
          )}
          {canControl && isPresenter && (
            <Button size="small" danger icon={<Square size={11} />} onClick={stop} data-testid={`${testIdPrefix}-stop-btn`}>
              结束
            </Button>
          )}
        </Space>
      </div>
    </div>
  );
};

export default ScreenShare;
