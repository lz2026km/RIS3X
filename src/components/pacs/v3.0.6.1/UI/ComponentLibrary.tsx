/**
 * G005 放射RIS系统 v3.0.6.1 - UI 组件库 (统一入口)
 */
import React, { useState } from 'react'
import { Card, Tabs, Tag, Space, Switch, Button, Slider } from 'antd'
import { Layout } from 'lucide-react'

export interface ComponentLibraryProps {
  theme?: 'light' | 'dark'
}

export const ComponentLibrary: React.FC<ComponentLibraryProps> = ({ theme = 'light' }) => {
  const [tab, setTab] = useState('colors')

  return (
    <div data-testid="component-library">
      <Card size="small" title={<Space><Layout size={14} />UI 组件库 ({theme})</Space>}>
        <Tabs
          activeKey={tab}
          onChange={setTab}
          items={[
            {
              key: 'colors',
              label: '颜色',
              children: (
                <Space wrap>
                  {[
                    { c: '#3b82f6', n: 'Primary' },
                    { c: '#16a34a', n: 'Success' },
                    { c: '#f59e0b', n: 'Warning' },
                    { c: '#dc2626', n: 'Danger' },
                    { c: '#8b5cf6', n: 'AI' },
                    { c: '#06b6d4', n: 'Info' },
                  ].map((x) => (
                    <div key={x.n} style={{ textAlign: 'center' }}>
                      <div style={{ width: 48, height: 48, background: x.c, borderRadius: 6 }} />
                      <div style={{ fontSize: 12, marginTop: 4 }}>{x.n}</div>
                      <div style={{ fontSize: 12, color: '#94a3b8' }}>{x.c}</div>
                    </div>
                  ))}
                </Space>
              ),
            },
            {
              key: 'tags',
              label: '标签',
              children: (
                <Space wrap>
                  <Tag color="blue">CT</Tag>
                  <Tag color="purple">MR</Tag>
                  <Tag color="green">DR</Tag>
                  <Tag color="red">危急值</Tag>
                  <Tag color="orange">STAT</Tag>
                  <Tag color="cyan">AI</Tag>
                  <Tag color="gold">随访</Tag>
                </Space>
              ),
            },
            {
              key: 'controls',
              label: '控件',
              children: (
                <Space orientation="vertical" size={10}>
                  <Switch defaultChecked />
                  <Slider defaultValue={50} />
                  <Space>
                    <Button>默认</Button>
                    <Button type="primary">主要</Button>
                    <Button danger>危险</Button>
                  </Space>
                </Space>
              ),
            },
          ]}
        />
      </Card>
    </div>
  )
}

export default ComponentLibrary