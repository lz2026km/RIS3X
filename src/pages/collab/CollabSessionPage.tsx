import React, { useEffect, useState } from 'react';
import { Button, Space, Tag, Tabs, Badge } from 'antd';
import {
  Users,
  MessageSquare,
  Activity,
  GitCompare,
  Wifi,
  WifiOff,
  Edit3,
  Share2,
  Monitor,
  MessageCircle,
} from 'lucide-react';
// v3.0.6.11: collaborationMachine 已正式下线(dormant),移除 useMachine 调用,
// 改为本地 useState + presenceService / chatService / activityFeed 直接调用。
import PresenceIndicator from '../../components/collab/PresenceIndicator';
import CommentThread from '../../components/collab/CommentThread';
import ScreenShare from '../../components/collab/ScreenShare';
import ChatPanel from '../../components/collab/ChatPanel';
import ActivityFeedView from '../../components/collab/ActivityFeed';
import CollaborativeReportEditor from '../../components/collab/CollaborativeReportEditor';
import VersionDiff from '../../components/collab/VersionDiff';
import { presenceService } from '../../services/collab/PresenceService';
import { chatService } from '../../services/collab/ChatService';
import { activityFeed } from '../../services/collab/ActivityFeed';
import {
  COLLAB_USERS,
  COLLAB_VERSIONS,
} from '../../data/collabMock';
import type { CollabUser, CollabVersion } from '../../types/collab';

const currentUser: CollabUser = COLLAB_USERS[0]!;
const MOCK_REPORT_TEXT = `右肺下叶见一不规则软组织肿块影，大小约 4.5cm×3.8cm，边缘呈分叶状，伴毛刺，增强扫描示不均匀强化（动脉期 78HU，静脉期 95HU，延迟期 82HU，呈"快进快出"模式）。肿块与周围血管关系密切，主动脉旁及隆突下多发肿大淋巴结，短径 10-14mm。

诊断意见：
右肺下叶占位，肺癌可能，伴纵隔淋巴结转移（T2aN2M0），建议穿刺活检明确病理。`;

type ConnState = 'disconnected' | 'connecting' | 'connected' | 'screen_sharing' | 'syncing' | 'error';

const CollabSessionPage: React.FC = () => {
  const [reportId] = useState('RP20260619013');
  const [activeTab, setActiveTab] = useState('editor');
  const [versions] = useState<CollabVersion[]>(COLLAB_VERSIONS);
  const [wsConnected, setWsConnected] = useState(true);
  const [sidePanel, setSidePanel] = useState<'comments' | 'chat' | 'activity' | 'diff' | null>('comments');

  // v3.0.6.11: 替换 useMachine 为本地 useState
  const [connState, setConnState] = useState<ConnState>('disconnected');
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [userCount, setUserCount] = useState(1);
  const [, _setPendingChanges] = useState(0);

  useEffect(() => {
    presenceService.update({
      id: currentUser.id,
      name: currentUser.name,
      role: currentUser.role,
      color: currentUser.color,
      status: 'editing',
      roomId: reportId,
      currentReportId: reportId,
    });
    chatService.joinRoom(reportId, currentUser.id);
    activityFeed.log({
      reportId,
      userId: currentUser.id,
      userName: currentUser.name,
      userColor: currentUser.color,
      type: 'join',
      detail: '加入协同会话',
    });
    setConnState('connecting');
    const timer = setTimeout(() => {
      setConnState('connected');
      setWsConnected(true);
      setUserCount(5);
    }, 800);
    return () => {
      clearTimeout(timer);
      presenceService.remove(currentUser.id);
    };
  }, []);

  const startScreenShare = () => {
    setIsScreenSharing(true);
    setConnState('screen_sharing');
  };

  const _stopScreenShare = () => {
    setIsScreenSharing(false);
    setConnState('connected');
  };
  void _stopScreenShare;

  const connStatus: ConnState = connState;
  const statusColor = connStatus === 'connected' || connStatus === 'screen_sharing' ? '#10b981' :
    connStatus === 'connecting' ? '#f59e0b' : '#dc2626';
  const statusLabel = connStatus === 'disconnected' ? '未连接' :
    connStatus === 'connecting' ? '连接中' :
    connStatus === 'screen_sharing' ? '共享中' :
    connStatus === 'syncing' ? '同步中' :
    connStatus === 'error' ? '错误' : '已连接';

  return (
    <div
      data-testid="collab-session-page"
      style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 60px)', background: '#f1f5f9' }}
    >
      <div style={{
        background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
        color: '#fff', padding: '8px 16px', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={18} />
            <span style={{ fontSize: 16, fontWeight: 700 }}>协同会话</span>
            <Tag color="cyan" style={{ fontSize: 12 }}>{reportId}</Tag>
          </div>
          <Space size={8}>
            <PresenceIndicator roomId={reportId} maxVisible={6} compact />
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
              {wsConnected ? <Wifi size={12} color="#86efac" /> : <WifiOff size={12} color="#fca5a5" />}
              <span style={{ color: statusColor, fontWeight: 600 }}>{statusLabel}</span>
            </span>
            {isScreenSharing && (
              <Tag color="red" style={{ fontSize: 12 }} icon={<Monitor size={10} />}>屏幕共享中</Tag>
            )}
          </Space>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, fontSize: 12, opacity: 0.9 }}>
          <span>当前用户: {currentUser.name}</span>
          <span>·</span>
          <span>在线: {userCount} 人</span>
          <span>·</span>
          <span>待同步: 0</span>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            size="small"
            tabBarExtraContent={
              <Badge
                count={3}
                title="协同视图 3 项"
                style={{ backgroundColor: '#3b82f6' }}
              />
            }
            style={{ margin: 0, padding: '0 8px', background: '#fff', borderBottom: '1px solid #e2e8f0' }}
            items={[
              { key: 'editor', label: <span><Edit3 size={12} /> 编辑</span> },
              { key: 'preview', label: <span><Monitor size={12} /> 预览</span> },
              { key: 'diff', label: <span><GitCompare size={12} /> 版本对比</span> },
            ]}
          />
          <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
            {activeTab === 'editor' && (
              <div style={{ position: 'relative' }}>
                <CollaborativeReportEditor
                  reportId={reportId}
                  user={{ id: currentUser.id, name: currentUser.name, role: currentUser.role, color: currentUser.color }}
                  initialText={MOCK_REPORT_TEXT}
                  height={500}
                  showAwareness
                />
                <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 4 }}>
                  <Button
                    size="small"
                    icon={<Share2 size={11} />}
                    onClick={startScreenShare}
                    disabled={isScreenSharing}
                  >
                    共享
                  </Button>
                </div>
              </div>
            )}
            {activeTab === 'preview' && (
              <div style={{ background: '#fff', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
                {MOCK_REPORT_TEXT}
              </div>
            )}
            {activeTab === 'diff' && (
              <VersionDiff
                versions={versions}
                showMerge
                mergeBaseVersion={versions[0]}
                mergeMineVersion={versions[1]}
                mergeTheirsVersion={versions[2]}
              />
            )}
          </div>

          <div style={{ padding: 8, background: '#fff', borderTop: '1px solid #e2e8f0', flexShrink: 0 }}>
            <ScreenShare roomId={reportId} currentUser={{ id: currentUser.id, name: currentUser.name }} canControl />
          </div>
        </div>

        <div style={{ width: 360, display: 'flex', flexDirection: 'column', borderLeft: '1px solid #e2e8f0', background: '#fff', flexShrink: 0 }}>
          <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0' }}>
            {([
              { key: 'comments', icon: <MessageSquare size={14} />, label: '评论' },
              { key: 'chat', icon: <MessageCircle size={14} />, label: '聊天' },
              { key: 'activity', icon: <Activity size={14} />, label: '活动' },
              { key: 'diff', icon: <GitCompare size={14} />, label: '版本' },
            ] as const).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setSidePanel(tab.key)}
                data-testid={`side-tab-${tab.key}`}
                style={{
                  flex: 1, padding: '8px 4px', border: 'none', cursor: 'pointer',
                  background: sidePanel === tab.key ? '#eff6ff' : '#fff',
                  color: sidePanel === tab.key ? '#1d4ed8' : '#64748b',
                  fontWeight: sidePanel === tab.key ? 600 : 400,
                  fontSize: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                  borderBottom: sidePanel === tab.key ? '2px solid #3b82f6' : '2px solid transparent',
                }}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
            {sidePanel === 'comments' && (
              <CommentThread
                reportId={reportId}
                currentUser={{ id: currentUser.id, name: currentUser.name, color: currentUser.color }}
                compact
                maxHeight={600}
              />
            )}
            {sidePanel === 'chat' && (
              <ChatPanel
                roomId={reportId}
                currentUser={{ id: currentUser.id, name: currentUser.name, color: currentUser.color }}
                compact
                maxHeight={600}
              />
            )}
            {sidePanel === 'activity' && (
              <ActivityFeedView reportId={reportId} limit={20} showFilters />
            )}
            {sidePanel === 'diff' && (
              <VersionDiff versions={versions} showMerge={false} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CollabSessionPage;
