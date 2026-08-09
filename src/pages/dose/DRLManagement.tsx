import { useEffect, useState } from "react";
import { AlertTriangle, ShieldAlert, CheckCircle, Zap, RefreshCw } from "lucide-react";
import { Button, Input, InputNumber, Select, Table, Tag, message, Space } from "antd";
import { rdsrApi, type DrlEntry, type DoseAlert, type DrlCheckRecordInput, type DrlCheckResult } from "../../services/api/rdsrApi";
import { criticalAlertApi } from "../../services/api/criticalAlertApi";
import { drlRecords } from "./mockData";
import type { DRLRecord } from "./types";

interface CheckDraft {
  key: string;
  patientName?: string;
  modality: string;
  bodyPart: string;
  ctdivol?: number;
  dlp?: number;
  age?: number;
}

const BODY_PARTS = ["头部", "胸部", "腹部", "盆腔", "腰椎"];

export default function DRLManagement() {
  const [rows, setRows] = useState<DrlEntry[]>([]);
  const [rowsLoading, setRowsLoading] = useState(true);
  const [alerts, setAlerts] = useState<DoseAlert[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [checkDrafts, setCheckDrafts] = useState<CheckDraft[]>([{ key: "d1", modality: "CT", bodyPart: "胸部" }]);
  const [checkResult, setCheckResult] = useState<DrlCheckResult[] | null>(null);
  const [checking, setChecking] = useState(false);
  const [reportingId, setReportingId] = useState<string | null>(null);
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);

  const loadDrls = async () => {
    setRowsLoading(true);
    try {
      const res = await rdsrApi.getDrls();
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        setRows(res.data);
        return;
      }
    } catch { /* fallback below */ }
    const demoRows: DrlEntry[] = drlRecords.map((r: DRLRecord) => ({
      modality: r.modality,
      bodyPart: r.examType,
      ctdivolDrl: r.nationalDRL ?? r.localDRL ?? 0,
      dlpDrl: r.localDRL ?? r.nationalDRL ?? 0,
      source: "演示数据",
    }));
    setRows(demoRows);
  };

  const loadAlerts = async () => {
    setAlertsLoading(true);
    try {
      const res = await rdsrApi.getAlerts();
      if (res.success && Array.isArray(res.data)) setAlerts(res.data);
    } catch { /* keep current */ } finally {
      setAlertsLoading(false);
    }
  };

  useEffect(() => {
    void loadDrls();
    void loadAlerts();
  }, []);

  const saveDrlRow = async (row: DrlEntry) => {
    const res = await rdsrApi.updateDrl({
      bodyPart: row.bodyPart,
      modality: row.modality,
      ctdivolDrl: row.ctdivolDrl,
      dlpDrl: row.dlpDrl,
      source: "自定义",
      ageGroup: row.ageGroup,
    });
    if (!res.success) {
      message.error(`阈值保存失败: ${row.modality}/${row.bodyPart}`);
      return;
    }
    setRows(res.data);
    message.success(`已保存 DRL 阈值: ${row.modality}/${row.bodyPart} (CTDIvol ${row.ctdivolDrl} / DLP ${row.dlpDrl})`);
  };

  const patchRow = (key: string, patch: Partial<DrlEntry>) => {
    setRows((prev) => prev.map((r) => `${r.modality}:${r.bodyPart}` === key ? { ...r, ...patch } : r));
  };

  const patchDraft = (key: string, patch: Partial<CheckDraft>) => {
    setCheckDrafts((prev) => prev.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  };

  const runCheck = async () => {
    const records: DrlCheckRecordInput[] = checkDrafts.map((d) => ({
      patientName: d.patientName,
      modality: d.modality,
      bodyPart: d.bodyPart,
      ctdivol: d.ctdivol,
      dlp: d.dlp,
      age: d.age,
    }));
    if (records.some((r) => r.ctdivol === undefined && r.dlp === undefined)) {
      message.warning("请至少填写每行 CTDIvol 或 DLP 剂量值");
      return;
    }
    setChecking(true);
    try {
      const res = await rdsrApi.check(records);
      if (!res.success) throw new Error((res.error as { message?: string })?.message || "DRL 检查失败");
      setCheckResult(res.data.overLimit);
      message.success(`检查完成: ${res.data.checked} 条实例, ${res.data.overLimitCount} 条超限 (${res.data.criticalCount} 危 / ${res.data.warningCount} 警), 自动生成危急值 ${res.data.generatedAlertCount} 条`);
      void loadAlerts();
    } catch (e) {
      message.error((e as Error)?.message || "DRL 检查失败");
    } finally {
      setChecking(false);
    }
  };

  const reportCritical = async (item: DrlCheckResult) => {
    setReportingId(item.id);
    try {
      const res = await criticalAlertApi.create({
        level: item.level === "critical" ? "critical" : "warning",
        patientId: item.patientId ?? undefined,
        patientName: item.patientName ?? "未知患者",
        modality: item.modality,
        title: `辐射剂量超 DRL (${item.modality}/${item.bodyPart})`,
        description: `实测 CTDIvol ${item.ctdivol}mGy、DLP ${item.dlp}mGy·cm, ${item.reason}, 需剂量复核`,
      });
      if (!res.success) throw new Error((res.error as { message?: string })?.message || "上报失败");
      message.success(`已上报危急值告警: ${res.data.id}`);
      if (item.level === "critical") {
        const ok = await rdsrApi.ackAlert(item.id).catch(() => null);
        if (ok?.success) void loadAlerts();
      }
    } catch (e) {
      message.error((e as Error)?.message || "上报失败");
    } finally {
      setReportingId(null);
    }
  };

  const acknowledge = async (id: string) => {
    setAcknowledgingId(id);
    try {
      const res = await rdsrApi.ackAlert(id);
      if (!res.success) throw new Error((res.error as { message?: string })?.message || "确认失败");
      message.success(`告警 ${id} 已确认`);
      void loadAlerts();
    } catch (e) {
      message.error((e as Error)?.message || "确认失败");
    } finally {
      setAcknowledgingId(null);
    }
  };

  const thresholdColumns = [
    { title: "模态", dataIndex: "modality", key: "modality", width: 70, render: (v: string) => <span style={modalityTag}>{v}</span> },
    { title: "部位", dataIndex: "bodyPart", key: "bodyPart" },
    { title: "年龄段", dataIndex: "ageGroup", key: "ageGroup", width: 90, render: (v?: string) => v === "child" ? <Tag color="orange">儿童</Tag> : <Tag color="blue">成人</Tag> },
    {
      title: "CTDIvol 阈值 (mGy)", key: "ctdivolDrl", width: 150,
      render: (_: unknown, r: DrlEntry) => (
        <InputNumber min={0} value={r.ctdivolDrl} onChange={(v) => patchRow(`${r.modality}:${r.bodyPart}`, { ctdivolDrl: v ?? 0 })} style={{ width: 110 }} />
      ),
    },
    {
      title: "DLP 阈值 (mGy·cm)", key: "dlpDrl", width: 160,
      render: (_: unknown, r: DrlEntry) => (
        <InputNumber min={0} value={r.dlpDrl} onChange={(v) => patchRow(`${r.modality}:${r.bodyPart}`, { dlpDrl: v ?? 0 })} style={{ width: 120 }} />
      ),
    },
    { title: "来源", dataIndex: "source", key: "source" },
    {
      title: "操作", key: "action", width: 90,
      render: (_: unknown, r: DrlEntry) => <Button size="small" type="primary" onClick={() => saveDrlRow(r)}>保存</Button>,
    },
  ];

  const checkColumns = [
    { title: "患者", dataIndex: "patientName", key: "patientName", render: (v?: string | null) => v ?? "未知患者" },
    { title: "模态", dataIndex: "modality", key: "modality", width: 60 },
    { title: "部位", dataIndex: "bodyPart", key: "bodyPart", width: 70 },
    {
      title: "剂量 / 阈值", key: "dose",
      render: (_: unknown, r: DrlCheckResult) => (
        <span style={{ fontSize: 12 }}>
          CTDIvol <b style={{ color: "#1e40af" }}>{r.ctdivol}</b>/{r.ctdivolDrl} · DLP <b style={{ color: "#1e40af" }}>{r.dlp}</b>/{r.dlpDrl}
        </span>
      ),
    },
    {
      title: "超出", key: "exceeded",
      render: (_: unknown, r: DrlCheckResult) => (
        <Tag color={r.level === "critical" ? "red" : "orange"}>
          {r.level === "critical" ? "危" : "警"} 超 {Math.max(r.exceededBy.ctdivol, r.exceededBy.dlp)}%
        </Tag>
      ),
    },
    { title: "理由", dataIndex: "reason", key: "reason", ellipsis: true },
    {
      title: "操作", key: "action", width: 150,
      render: (_: unknown, r: DrlCheckResult) => (
        <Button
          size="small"
          danger
          icon={<ShieldAlert size={12} />}
          loading={reportingId === r.id}
          onClick={() => reportCritical(r)}
        >
          上报危急值
        </Button>
      ),
    },
  ];

  const alertColumns = [
    { title: "患者", dataIndex: "patientName", key: "patientName" },
    { title: "部位", dataIndex: "bodyPart", key: "bodyPart", width: 80 },
    {
      title: "剂量/阈值", key: "dose",
      render: (_: unknown, a: DoseAlert) => <span style={{ fontSize: 12 }}>{a.dlp}/{a.dlpDrl} mGy·cm</span>,
    },
    { title: "日期", dataIndex: "date", key: "date", width: 110 },
    {
      title: "级别", key: "level", width: 70,
      render: (_: unknown, a: DoseAlert) => (
        <Tag color={a.level === "critical" ? "red" : "orange"}>{a.level === "critical" ? "危急" : "警告"}</Tag>
      ),
    },
    {
      title: "状态", key: "status", width: 90,
      render: (_: unknown, a: DoseAlert) => a.acknowledged ? <Tag color="green">已确认</Tag> : <Tag color="volcano">待处理</Tag>,
    },
    {
      title: "操作", key: "action", width: 160,
      render: (_: unknown, a: DoseAlert) => (
        <Space size={4}>
          <Button size="small" type="primary" icon={<CheckCircle size={12} />} disabled={a.acknowledged} loading={acknowledgingId === a.id} onClick={() => acknowledge(a.id)}>确认</Button>
          {a.level === "critical" && (
            <Button
              size="small"
              danger
              icon={<ShieldAlert size={12} />}
              loading={reportingId === a.id}
              onClick={() => reportCritical({
                id: a.id,
                patientId: a.patientId,
                patientName: a.patientName,
                modality: a.modality,
                bodyPart: a.bodyPart,
                ctdivol: a.ctdivol,
                dlp: a.dlp,
                examDate: a.date,
                ageGroup: "adult",
                level: a.level,
                ctdivolDrl: a.ctdivolDrl,
                dlpDrl: a.dlpDrl,
                exceededBy: { ctdivol: a.ctdivolDrl > 0 ? Math.round((a.ctdivol / a.ctdivolDrl - 1) * 100) : 0, dlp: a.dlpDrl > 0 ? Math.round((a.dlp / a.dlpDrl - 1) * 100) : 0 },
                reason: `超过 DRL ${a.ctdivolDrl}/${a.dlpDrl}`,
              })}
            >
              上报
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <style>{`.drl-row-critical td { background: #fef2f2 !important; } .drl-row-warning td { background: #fffbeb !important; }`}</style>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        <div style={kpiBox}>
          <div style={{ fontSize: 12, color: "#64748b" }}>DRL 阈值配置数</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#1e40af", marginTop: 4 }}>{rows.length}</div>
        </div>
        <div style={kpiBox}>
          <div style={{ fontSize: 12, color: "#64748b" }}>超限告警记录</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: alerts.length > 0 ? "#dc2626" : "#16a34a", marginTop: 4 }}>{alerts.length}</div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>条</div>
        </div>
        <div style={kpiBox}>
          <div style={{ fontSize: 12, color: "#64748b" }}>危急告警</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#dc2626", marginTop: 4 }}>{alerts.filter((a) => a.level === "critical" && !a.acknowledged).length}</div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>未闭环</div>
        </div>
        <div style={kpiBox}>
          <div style={{ fontSize: 12, color: "#64748b" }}>儿童(年龄&lt;15)阈值</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#d97706", marginTop: 4 }}>{rows.filter((r) => r.ageGroup === "child").length}</div>
        </div>
      </div>

      <div style={{ background: "#fff", borderRadius: 12, padding: 20, border: "1px solid #e2e8f0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#1e40af", display: "flex", alignItems: "center", gap: 8 }}>
            <Zap size={16} color="#2563eb" />
            DRL 阈值配置（可编辑保存）
          </div>
          <Button size="small" icon={<RefreshCw size={13} />} onClick={() => { void loadDrls(); void loadAlerts(); }}>刷新</Button>
        </div>
        <Table
          rowKey={(r) => `${r.modality}:${r.bodyPart}:${r.ageGroup ?? "adult"}`}
          columns={thresholdColumns}
          dataSource={rows}
          size="small"
          loading={rowsLoading}
          pagination={false}
          scroll={{ x: "max-content" }}
        />
      </div>

      <div style={{ background: "#fff", borderRadius: 12, padding: 20, border: "1px solid #e2e8f0" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#1e40af", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <AlertTriangle size={16} color="#dc2626" />
          超限告警闭环 · 实例剂量检查（POST /rdsr/check）
        </div>
        {checkDrafts.map((d) => (
          <div key={d.key} style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap", alignItems: "center" }}>
            <Input placeholder="患者姓名" value={d.patientName} onChange={(e) => patchDraft(d.key, { patientName: e.target.value })} style={{ width: 120 }} />
            <Select value={d.modality} onChange={(v) => patchDraft(d.key, { modality: v })} options={[{ value: "CT", label: "CT" }, { value: "MR", label: "MR" }]} style={{ width: 80 }} />
            <Select value={d.bodyPart} onChange={(v) => patchDraft(d.key, { bodyPart: v })} options={BODY_PARTS.map((b) => ({ value: b, label: b }))} style={{ width: 90 }} />
            <InputNumber addonBefore="CTDIvol" placeholder="mGy" value={d.ctdivol} onChange={(v) => patchDraft(d.key, { ctdivol: v ?? undefined })} style={{ width: 160 }} />
            <InputNumber addonBefore="DLP" placeholder="mGy·cm" value={d.dlp} onChange={(v) => patchDraft(d.key, { dlp: v ?? undefined })} style={{ width: 180 }} />
            <InputNumber addonBefore="年龄" value={d.age} onChange={(v) => patchDraft(d.key, { age: v ?? undefined })} style={{ width: 110 }} />
            {checkDrafts.length > 1 && (
              <Button size="small" onClick={() => setCheckDrafts((prev) => prev.filter((x) => x.key !== d.key))}>删除</Button>
            )}
          </div>
        ))}
        <Space style={{ marginTop: 8 }}>
          <Button size="small" onClick={() => setCheckDrafts((prev) => [...prev, { key: `d${Date.now()}`, modality: "CT", bodyPart: "胸部" }])}>+ 添加实例</Button>
          <Button type="primary" icon={<Zap size={13} />} loading={checking} onClick={runCheck}>开始 DRL 检查</Button>
        </Space>
        {checkResult && (
          <Table scroll={{ x: 'max-content' }}
            rowKey="id"
            columns={checkColumns}
            dataSource={checkResult}
            size="small"
            style={{ marginTop: 16 }}
            pagination={false}
            locale={{ emptyText: "无超限实例" }}
            rowClassName={(r) => (r.level === "critical" ? "drl-row-critical" : "drl-row-warning")}
          />
        )}
      </div>

      <div style={{ background: "#fff", borderRadius: 12, padding: 20, border: "1px solid #e2e8f0" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#1e40af", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <ShieldAlert size={16} color="#16a34a" />
          历史超限告警记录（确认 = 真实写回 /rdsr/alerts/:id/ack）
        </div>
        <Table scroll={{ x: 'max-content' }}
          rowKey="id"
          columns={alertColumns}
          dataSource={alerts}
          size="small"
          loading={alertsLoading}
          pagination={{ pageSize: 10, showSizeChanger: false }}
          locale={{ emptyText: "暂无超限告警" }}
        />
      </div>
    </div>
  );
}

const kpiBox: React.CSSProperties = {
  background: "#fff",
  borderRadius: 10,
  padding: "14px 16px",
  border: "1px solid #e2e8f0",
  textAlign: "center",
};

const modalityTag: React.CSSProperties = {
  padding: "2px 8px",
  background: "#eff6ff",
  color: "#2563eb",
  borderRadius: 4,
  fontSize: 12,
  fontWeight: 600,
};
