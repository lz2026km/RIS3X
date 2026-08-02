import { useState, useMemo, useEffect, useCallback } from "react";
import {
  BookOpen,
  Search,
  FileText,
  Calendar,
  Tag,
  ExternalLink,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import {
  Table,
  Input,
  Tree,
  Modal,
  Tag as AntTag,
  Card,
  Empty,
  Spin,
  Alert,
  Button,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import type { DataNode } from "antd/es/tree";
import { cdsApi } from "../../services/api/cdsApi";
import type { CdsGuidelineDto } from "../../services/api/cdsApi";

const CATEGORY_TREE: DataNode[] = [
  {
    title: "呼吸系统",
    key: "respiratory",
    children: [
      { title: "肺结节", key: "respiratory-nodule" },
      { title: "肺炎", key: "respiratory-pneumonia" },
      { title: "COPD", key: "respiratory-copd" },
    ],
  },
  {
    title: "循环系统",
    key: "circulatory",
    children: [
      { title: "冠心病", key: "circulatory-chd" },
      { title: "心肌病", key: "circulatory-cmp" },
    ],
  },
  {
    title: "消化系统",
    key: "digestive",
    children: [
      { title: "肝病", key: "digestive-liver" },
      { title: "胰腺", key: "digestive-pancreas" },
    ],
  },
  {
    title: "神经系统",
    key: "neurological",
    children: [
      { title: "脑血管", key: "neuro-cerebrovascular" },
      { title: "退行性病变", key: "neuro-degenerative" },
    ],
  },
];

const CATEGORY_LABELS: Record<string, string> = {
  "respiratory-nodule": "肺结节",
  "respiratory-pneumonia": "肺炎",
  "respiratory-copd": "COPD",
  "circulatory-chd": "冠心病",
  "circulatory-cmp": "心肌病",
  "digestive-liver": "肝病",
  "digestive-pancreas": "胰腺",
  "neuro-cerebrovascular": "脑血管",
  "neuro-degenerative": "退行性病变",
};

export default function GuidelineLibraryPage() {
  const [searchText, setSearchText] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [detailGuideline, setDetailGuideline] =
    useState<CdsGuidelineDto | null>(null);
  const [expandedKeys, setExpandedKeys] = useState<string[]>([
    "respiratory",
    "circulatory",
    "digestive",
    "neurological",
  ]);
  const [guidelines, setGuidelines] = useState<CdsGuidelineDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await cdsApi.listGuidelines();
      if (res.success) {
        setGuidelines(res.data ?? []);
      } else {
        setError(res.error?.message ?? "加载失败");
        setGuidelines([]);
      }
    } catch (e) {
      setError((e as Error)?.message ?? "加载失败");
      setGuidelines([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    let items = guidelines;
    if (selectedCategory) {
      items = items.filter((g) => g.category === selectedCategory);
    }
    if (searchText) {
      const q = searchText.toLowerCase();
      items = items.filter(
        (g) =>
          g.name.toLowerCase().includes(q) ||
          g.description.toLowerCase().includes(q) ||
          g.source.toLowerCase().includes(q),
      );
    }
    return items;
  }, [searchText, selectedCategory, guidelines]);

  const columns: ColumnsType<CdsGuidelineDto> = [
    {
      title: "指南名称",
      dataIndex: "name",
      key: "name",
      render: (name: string) => (
        <a
          onClick={() => {
            const g = filtered.find((x) => x.name === name);
            if (g) setDetailGuideline(g);
          }}
          style={{ cursor: "pointer" }}
        >
          {name}
        </a>
      ),
    },
    {
      title: "分类",
      dataIndex: "category",
      key: "category",
      width: 120,
      render: (c: string) => (
        <AntTag color="blue">{CATEGORY_LABELS[c] || c}</AntTag>
      ),
    },
    { title: "版本", dataIndex: "version", key: "version", width: 80 },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 80,
      render: (s: string) => (
        <AntTag color={s === "已发布" ? "green" : "default"}>{s}</AntTag>
      ),
    },
    { title: "更新日期", dataIndex: "updatedAt", key: "updatedAt", width: 110 },
    {
      title: "来源",
      dataIndex: "source",
      key: "source",
      width: 130,
    },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontSize: 14 }}>
      <header
        style={{
          background: "linear-gradient(135deg,#059669 0%,#10b981 100%)",
          color: "#fff",
          padding: "14px 24px",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <BookOpen size={20} />
        <div>
          <div style={{ fontSize: 16, fontWeight: 800 }}>临床指南库</div>
          <div style={{ fontSize: 12, opacity: 0.85 }}>
            基于循证医学的影像诊断指南 · 共 {guidelines.length} 篇
          </div>
        </div>
      </header>
      <div style={{ padding: 16, display: "flex", gap: 16 }}>
        <Card
          title="分类导航"
          size="small"
          style={{ width: 240, flexShrink: 0 }}
        >
          <Tree
            treeData={CATEGORY_TREE}
            selectedKeys={selectedCategory ? [selectedCategory] : []}
            onSelect={(keys) =>
              setSelectedCategory((keys[0] as string) || null)
            }
            expandedKeys={expandedKeys}
            onExpand={(keys) => setExpandedKeys(keys as string[])}
            switcherIcon={(props: any) =>
              props.expanded ? (
                <ChevronDown size={14} />
              ) : (
                <ChevronRight size={14} />
              )
            }
          />
        </Card>
        <div style={{ flex: 1 }}>
          <div style={{ marginBottom: 16, display: "flex", gap: 8 }}>
            <Input
              placeholder="搜索指南名称/描述/来源..."
              prefix={<Search size={14} />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 360 }}
              allowClear
            />
            <Button
              icon={<Calendar size={14} />}
              loading={loading}
              onClick={() => void load()}
            >
              刷新
            </Button>
          </div>
          {error && (
            <Alert
              type="error"
              showIcon
              style={{ marginBottom: 16 }}
              message={error}
              action={
                <Button size="small" onClick={() => void load()}>
                  重试
                </Button>
              }
            />
          )}
          <Spin spinning={loading}>
            <Table
              columns={columns}
              dataSource={filtered}
              rowKey="id"
              pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 条` }}
              size="middle"
              locale={{ emptyText: <Empty description="无匹配指南" /> }}
            />
          </Spin>
        </div>
      </div>
      <Modal
        title={
          <span>
            <FileText size={16} style={{ marginRight: 8 }} />
            {detailGuideline?.name}
          </span>
        }
        open={!!detailGuideline}
        onCancel={() => setDetailGuideline(null)}
        footer={null}
        width={640}
      >
        {detailGuideline && (
          <div>
            <p>
              <strong>版本：</strong>
              {detailGuideline.version}
            </p>
            <p>
              <strong>状态：</strong>
              <AntTag
                color={
                  detailGuideline.status === "已发布" ? "green" : "default"
                }
              >
                {detailGuideline.status}
              </AntTag>
            </p>
            <p>
              <strong>分类：</strong>
              <AntTag color="blue">
                {CATEGORY_LABELS[detailGuideline.category] ||
                  detailGuideline.category}
              </AntTag>
            </p>
            <p>
              <strong>来源：</strong>
              {detailGuideline.source}
            </p>
            <p>
              <strong>更新日期：</strong>
              {detailGuideline.updatedAt}
            </p>
            <p>
              <strong>描述：</strong>
              {detailGuideline.description}
            </p>
            <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
              <AntTag
                icon={<ExternalLink size={12} />}
                color="blue"
                style={{ cursor: "pointer" }}
              >
                查看原文
              </AntTag>
              <AntTag
                icon={<Tag size={12} />}
                color="green"
                style={{ cursor: "pointer" }}
              >
                添加到收藏
              </AntTag>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
