/**
 * G005 放射RIS系统 v3.0.0 - Empty / Progress / Alert / Result Story
 * Phase T2-W5
 */

import type { Meta, StoryObj } from '@storybook/react';
import { AppEmpty, AppProgress, AppAlert, AppResult } from './index';
import { Button, Card, Space } from 'antd';

const meta: Meta = {
  title: 'Feedback/Empty Progress Alert Result',
  parameters: {
    layout: 'padded',
  },
};

export default meta;
type Story = StoryObj;

export const EmptyNoData: Story = {
  render: () => <AppEmpty variant="no-data" />,
};

export const EmptyNoResults: Story = {
  render: () => <AppEmpty variant="no-results" />,
};

export const EmptyNoPermission: Story = {
  render: () => <AppEmpty variant="no-permission" />,
};

export const EmptyError: Story = {
  render: () => <AppEmpty variant="error" />,
};

export const EmptyWithAction: Story = {
  render: () => (
    <AppEmpty
      variant="no-data"
      action={{
        label: '新建报告',
        onClick: () => { console.log('[Empty] 新建报告'); },
      }}
    />
  ),
};

export const Progress: Story = {
  render: () => (
    <Space orientation="vertical" size="large" style={{ width: '100%' }}>
      <Card title="基础进度条" size="small">
        <Space orientation="vertical" style={{ width: '100%' }}>
          <AppProgress percent={30} ariaLabel="加载 30%" />
          <AppProgress percent={70} ariaLabel="加载 70%" />
          <AppProgress percent={100} ariaLabel="完成" />
        </Space>
      </Card>
      <Card title="彩色进度条" size="small">
        <Space orientation="vertical" style={{ width: '100%' }}>
          <AppProgress percent={50} strokeColor="#1e40af" />
          <AppProgress percent={50} strokeColor={{ from: '#1e40af', to: '#10b981' }} />
        </Space>
      </Card>
      <Card title="小尺寸" size="small">
        <AppProgress percent={80} size="small" showInfo={false} />
      </Card>
    </Space>
  ),
};

export const AlertBasic: Story = {
  render: () => (
    <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
      <AppAlert type="info" message="信息提示" />
      <AppAlert type="success" message="成功消息" description="操作已成功完成" />
      <AppAlert type="warning" message="警告消息" description="请注意数据完整性" closable />
      <AppAlert
        type="error"
        message="危急值警告"
        description="患者 张三 出现主动脉夹层,Stanford A 型,请立即通知心外科"
        showIcon
      />
    </Space>
  ),
};

export const Result404: Story = {
  render: () => (
    <AppResult
      status="404"
      title="404"
      subTitle="抱歉,您访问的页面不存在。"
    />
  ),
};

export const Result403: Story = {
  render: () => (
    <AppResult
      status="403"
      title="403"
      subTitle="抱歉,您无权访问此页面。"
    />
  ),
};

export const ResultSuccess: Story = {
  render: () => (
    <AppResult
      status="success"
      title="提交成功"
      subTitle="报告已成功提交审核,请等待审核结果。"
      extra={[
        <Button type="primary" key="view">查看报告</Button>,
        <Button key="back">返回列表</Button>,
      ]}
    />
  ),
};

export const ResultError: Story = {
  render: () => (
    <AppResult
      status="error"
      title="提交失败"
      subTitle="请检查网络连接后重试。"
      extra={<Button type="primary">重试</Button>}
    />
  ),
};
