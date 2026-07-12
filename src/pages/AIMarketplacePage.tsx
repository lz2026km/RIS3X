import React, { useState, useMemo } from 'react';
import {
  Card, Button, Input, Select, Tag, Row, Col, Space, Badge, Empty, message, Typography,
} from 'antd';
import {
  Zap, Search, Download, CheckCircle, Star, Clock, DollarSign, Bot,
} from 'lucide-react';

interface AIApp {
  id: string;
  name: string;
  vendor: string;
  icon: string;
  category: string;
  price: string;
  rating: number;
  downloads: number;
  description: string;
  installed: boolean;
}

const mockApps: AIApp[] = [
  { id: 'A001', name: '肺结节AI检测', vendor: '深睿医疗', icon: '🔬', category: '影像诊断', price: '¥120,000/年', rating: 4.8, downloads: 2340, description: '基于深度学习的肺结节自动检测与良恶性分类', installed: true },
  { id: 'A002', name: '骨折AI筛查', vendor: '推想科技', icon: '🦴', category: '影像诊断', price: '¥98,000/年', rating: 4.6, downloads: 1890, description: 'DR/CT骨折自动检测与定位', installed: true },
  { id: 'A003', name: '脑卒中AI评估', vendor: '数坤科技', icon: '🧠', category: '急诊AI', price: '¥150,000/年', rating: 4.9, downloads: 1560, description: '脑卒中CTP/MRI智能评估与ASPECTS评分', installed: false },
  { id: 'A004', name: '乳腺AI筛查', vendor: '依图医疗', icon: '🎗️', category: '影像诊断', price: '¥88,000/年', rating: 4.5, downloads: 2100, description: '乳腺钼靶AI辅助筛查与BI-RADS分级', installed: false },
  { id: 'A005', name: '冠脉CTA分析', vendor: '联影智能', icon: '❤️', category: '心血管AI', price: '¥200,000/年', rating: 4.7, downloads: 980, description: '冠脉CTA自动分割与狭窄程度分析', installed: false },
  { id: 'A006', name: '骨龄AI评估', vendor: '依图医疗', icon: '📏', category: '儿科AI', price: '¥45,000/年', rating: 4.3, downloads: 3200, description: '儿童骨龄自动评估与身高预测', installed: false },
  { id: 'A007', name: '影像报告质控', vendor: '深睿医疗', icon: '📋', category: '质控AI', price: '¥65,000/年', rating: 4.4, downloads: 1450, description: '影像报告AI质控与评分', installed: false },
  { id: 'A008', name: '肺炎AI辅助诊断', vendor: '华为云', icon: '🫁', category: '影像诊断', price: '¥56,000/年', rating: 4.2, downloads: 2800, description: '肺炎CT影像AI辅助诊断', installed: false },
  { id: 'A009', name: '肋骨骨折AI检测', vendor: '推想科技', icon: '🩻', category: '影像诊断', price: '¥76,000/年', rating: 4.5, downloads: 1100, description: '肋骨骨折AI自动检测与VR重建', installed: false },
  { id: 'A010', name: '肝脏肿瘤AI评估', vendor: '数坤科技', icon: '🫁', category: '腹部AI', price: '¥135,000/年', rating: 4.6, downloads: 870, description: '肝脏肿瘤自动分割与LI-RADS分级', installed: false },
  { id: 'A011', name: '心脏AI超声分析', vendor: '飞利浦医疗', icon: '💓', category: '心血管AI', price: '¥180,000/年', rating: 4.8, downloads: 670, description: '心脏超声AI自动分析', installed: false },
  { id: 'A012', name: '智能报告生成', vendor: '零氪科技', icon: '✍️', category: '报告AI', price: '¥43,000/年', rating: 4.0, downloads: 4100, description: 'AI辅助影像报告智能生成', installed: false },
];

const categories = Array.from(new Set(mockApps.map(a => a.category)));

export default function AIMarketplacePage() {
  const [searchText, setSearchText] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('全部');
  const [installedIds, setInstalledIds] = useState<string[]>(mockApps.filter(a => a.installed).map(a => a.id));

  const filteredApps = useMemo(() => {
    return mockApps.filter(a => {
      const matchSearch = !searchText || a.name.includes(searchText) || a.vendor.includes(searchText) || a.description.includes(searchText);
      const matchCategory = categoryFilter === '全部' || a.category === categoryFilter;
      return matchSearch && matchCategory;
    });
  }, [searchText, categoryFilter]);

  const handleInstall = (app: AIApp) => {
    setInstalledIds(prev => [...prev, app.id]);
    message.success(`${app.name} 安装成功`);
  };

  const handleUninstall = (app: AIApp) => {
    setInstalledIds(prev => prev.filter(id => id !== app.id));
    message.success(`${app.name} 已卸载`);
  };

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Space>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg, #7c3aed, #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Zap size={22} color="#fff" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>AI 应用市场</h2>
            <span style={{ color: '#94a3b8', fontSize: 13 }}>发现和部署AI智能应用</span>
          </div>
        </Space>
        <Badge count={installedIds.length} style={{ backgroundColor: '#7c3aed' }} showZero>
          <Tag icon={<CheckCircle size={14} />} color="purple">已安装</Tag>
        </Badge>
      </div>

      <Card variant="borderless" style={{ borderRadius: 12, marginBottom: 20 }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} md={10}>
            <Input
              prefix={<Search size={16} style={{ color: '#94a3b8' }} />}
              placeholder="搜索AI应用名称/厂商/描述..."
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={12} md={6}>
            <Select
              value={categoryFilter}
              onChange={setCategoryFilter}
              style={{ width: '100%' }}
              options={[
                { label: '全部分类', value: '全部' },
                ...categories.map(c => ({ label: c, value: c })),
              ]}
            />
          </Col>
          <Col xs={12} md={8}>
            <span style={{ color: '#94a3b8', fontSize: 13 }}>
              共 {filteredApps.length} 个应用
            </span>
          </Col>
        </Row>
      </Card>

      <Row gutter={[16, 16]}>
        {filteredApps.map(app => {
          const isInstalled = installedIds.includes(app.id);
          return (
            <Col key={app.id} xs={24} sm={12} md={8} lg={6}>
              <Card
                hoverable
                variant="borderless"
                style={{ borderRadius: 12, height: '100%', position: 'relative' }}
                actions={[
                  isInstalled ? (
                    <Button type="default" size="small" onClick={() => handleUninstall(app)}>卸载</Button>
                  ) : (
                    <Button type="primary" size="small" icon={<Download size={14} />} style={{ background: '#7c3aed', borderColor: '#7c3aed' }} onClick={() => handleInstall(app)}>安装</Button>
                  ),
                ]}
              >
                {isInstalled && (
                  <Badge count={<CheckCircle size={16} color="#52c41a" />} style={{ position: 'absolute', top: 12, right: 12, zIndex: 1 }} />
                )}
                <div style={{ textAlign: 'center', marginBottom: 12 }}>
                  <span style={{ fontSize: 40 }}>{app.icon}</span>
                </div>
                <Typography.Title level={5} style={{ textAlign: 'center', margin: 0 }}>{app.name}</Typography.Title>
                <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: 12, margin: '4px 0 8px' }}>{app.vendor}</div>
                <Tag color="geekblue" style={{ display: 'block', textAlign: 'center', marginBottom: 8 }}>{app.category}</Tag>
                <Typography.Paragraph type="secondary" style={{ fontSize: 12, margin: 0 }} ellipsis={{ rows: 2 }}>
                  {app.description}
                </Typography.Paragraph>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, fontSize: 12, color: '#94a3b8' }}>
                  <Space size={4}>
                    <DollarSign size={12} />
                    <span style={{ color: '#f59e0b', fontWeight: 600 }}>{app.price}</span>
                  </Space>
                  <Space size={4}>
                    <Star size={12} color="#faad14" fill="#faad14" />
                    <span style={{ fontWeight: 600 }}>{app.rating}</span>
                    <span>|</span>
                    <Download size={12} />
                    {app.downloads}
                  </Space>
                </div>
              </Card>
            </Col>
          );
        })}
      </Row>

      {filteredApps.length === 0 && (
        <Empty description="未找到匹配的AI应用" style={{ marginTop: 60 }} />
      )}
    </div>
  );
}
