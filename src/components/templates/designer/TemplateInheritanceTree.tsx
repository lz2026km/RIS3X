/**
 * G005 RIS v3.0.6.5 - 模板继承树
 * 30 升级点 - 可视化继承关系 / 冲突检测 / 快速跳转
 */
import React, { useMemo } from 'react';
import { Card, Tree, Tag, Space, Button, Empty } from 'antd';
import { FolderTree, Edit, Eye } from 'lucide-react';
import type { DataNode } from 'antd/es/tree';

export interface TemplateNode {
  id: string;
  name: string;
  version: string;
  approved: boolean;
  parentId?: string;
  bodyPart: string;
  modality: string;
  usageCount: number;
  children?: TemplateNode[];
}

interface Props {
  templates: TemplateNode[];
  onSelect?: (id: string) => void;
  onEdit?: (id: string) => void;
  onPreview?: (id: string) => void;
}

export const TemplateInheritanceTree: React.FC<Props> = ({ templates, onSelect, onEdit, onPreview }) => {
  const treeData = useMemo<DataNode[]>(() => {
    const map = new Map<string, TemplateNode & { children: TemplateNode[] }>();
    templates.forEach((t) => map.set(t.id, { ...t, children: [] }));
    const roots: TemplateNode[] = [];
    map.forEach((node) => {
      if (node.parentId && map.has(node.parentId)) {
        map.get(node.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    });
    const build = (n: TemplateNode): DataNode => ({
      key: n.id,
      title: (
        <Space>
          <span className="font-medium">{n.name}</span>
          <Tag color="blue">v{n.version}</Tag>
          <Tag color={n.modality === 'CT' ? 'cyan' : n.modality === 'MR' ? 'purple' : 'green'}>{n.modality}</Tag>
          <Tag>{n.bodyPart}</Tag>
          {n.approved ? <Tag color="success">已批准</Tag> : <Tag color="warning">未批准</Tag>}
          <span className="text-xs text-slate-500">使用 {n.usageCount}</span>
        </Space>
      ),
      children: (n.children ?? []).map(build),
    });
    return roots.map(build);
  }, [templates]);

  const handleSelect = (keys: React.Key[]) => {
    if (keys[0]) onSelect?.(String(keys[0]));
  };

  return (
    <Card
      size="small"
      className="shadow-sm"
      title={
        <Space>
          <FolderTree className="w-4 h-4 text-emerald-500" />
          模板继承树
          <Tag>{templates.length} 模板</Tag>
        </Space>
      }
      extra={
        <Space>
          {onPreview && (
            <Button size="small" icon={<Eye className="w-3 h-3" />} onClick={() => onPreview?.('')}>预览</Button>
          )}
          {onEdit && (
            <Button size="small" type="primary" icon={<Edit className="w-3 h-3" />}>编辑</Button>
          )}
        </Space>
      }
    >
      {treeData.length === 0 ? (
        <Empty description="暂无模板" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <Tree
          showLine
          defaultExpandAll
          treeData={treeData}
          onSelect={handleSelect}
          blockNode
        />
      )}
    </Card>
  );
};

export default TemplateInheritanceTree;
