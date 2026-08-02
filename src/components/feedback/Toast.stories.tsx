/**
 * G005 放射RIS系统 v3.0.0 - Toast / Modal / Notification / Confirm Story
 * Phase T2-W5
 */

import type { Meta, StoryObj } from '@storybook/react';
import { Button, Space, Card, Divider } from 'antd';
import { useToast, useNotification, useConfirm, AppModal } from './Toast';

const meta: Meta = {
  title: 'Feedback/Toast Modal Notification Confirm',
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: '统一的反馈组件,基于 antd 5 App.useApp() 模式。支持 i18n + a11y + 业务 hooks(toast.saved/confirm.delete/notification.criticalValue)。',
      },
    },
  },
};

export default meta;
type Story = StoryObj;

const ToastDemo = () => {
  const toast = useToast();
  return (
    <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
      <Card title="Toast 消息" size="small">
        <Space wrap>
          <Button onClick={() => toast.success('操作成功')} type="primary">成功</Button>
          <Button onClick={() => toast.error('操作失败,请重试')} danger>失败</Button>
          <Button onClick={() => toast.warning('请注意数据完整性')}>警告</Button>
          <Button onClick={() => toast.info('系统将于今晚 23:00 升级')}>信息</Button>
        </Space>
        <Divider />
        <Space wrap>
          <Button onClick={() => toast.saved()}>业务:已保存</Button>
          <Button onClick={() => toast.deleted()}>业务:已删除</Button>
          <Button onClick={() => toast.failed()}>业务:失败</Button>
          <Button onClick={() => toast.loading('加载中...')}>加载</Button>
        </Space>
      </Card>
    </Space>
  );
};

export const Toast: Story = {
  render: () => <ToastDemo />,
};

const NotificationDemo = () => {
  const notification = useNotification();
  return (
    <Card title="Notification 通知" size="small">
      <Space orientation="vertical" style={{ width: '100%' }}>
        <Space wrap>
          <Button onClick={() => notification.success('成功', '数据已保存到服务器')}>成功通知</Button>
          <Button danger onClick={() => notification.error('错误', '网络连接中断')}>错误通知</Button>
          <Button onClick={() => notification.warning('警告', '磁盘空间不足')}>警告通知</Button>
          <Button onClick={() => notification.info('信息', '新版本已发布')}>信息通知</Button>
        </Space>
        <Divider />
        <Button
          danger
          type="primary"
          onClick={() => notification.criticalValue('张三', '主动脉夹层 Stanford A 型')}
        >
          🚨 业务:危急值通知(张三 - 主动脉夹层)
        </Button>
      </Space>
    </Card>
  );
};

export const Notification: Story = {
  render: () => <NotificationDemo />,
};

const ConfirmDemo = () => {
  const confirm = useConfirm();
  return (
    <Card title="Confirm 确认" size="small">
      <Space wrap>
        <Button
          danger
          onClick={() => confirm.delete('测试报告 #001', () => { console.log('[Confirm] 已删除'); })}
        >
          删除操作
        </Button>
        <Button
          type="primary"
          onClick={() => confirm.submit('报告 #002', () => { console.log('[Confirm] 已提交审核'); })}
        >
          提交审核
        </Button>
        <Button
          onClick={() =>
            confirm.confirm({
              title: '自定义确认',
              content: '这是一个普通确认对话框',
              onOk: () => { console.log('[Confirm] 已确认'); },
            })
          }
        >
          自定义确认
        </Button>
      </Space>
    </Card>
  );
};

export const Confirm: Story = {
  render: () => <ConfirmDemo />,
};

const ModalBasic = ({ onClose }: { onClose: () => void }) => (
  <AppModal
    open={true}
    onCancel={onClose}
    title="基础模态框"
    description="这是一个使用 AppModal 业务封装的模态框"
    onOk={onClose}
  >
    <p>模态框内容区域</p>
    <p>支持 ESC 关闭、点击遮罩关闭、宽度自定义</p>
  </AppModal>
);

export const ModalBasicStory: Story = {
  render: () => <ModalBasic onClose={() => location.reload()} />,
};

const ModalWithFooter = ({ onClose }: { onClose: () => void }) => (
  <AppModal
    open={true}
    onCancel={onClose}
    title="报告详情"
    width={800}
    onOk={onClose}
    okText="保存"
    cancelText="取消"
  >
    <div style={{ padding: '0 0 16px' }}>
      <p><strong>患者:</strong>张三</p>
      <p><strong>检查:</strong>胸部 CT 平扫</p>
      <p><strong>状态:</strong>已审核</p>
    </div>
  </AppModal>
);

export const ModalWithFooterStory: Story = {
  render: () => <ModalWithFooter onClose={() => location.reload()} />,
};
