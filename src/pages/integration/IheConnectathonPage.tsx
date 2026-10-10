/**
 * G005 放射RIS系统 v3.0.6.0 - IHE Connectathon 页面
 * 15 升级点:测试执行 / 报告导出 / Profile 列表 / 通过率
 */
import type {
  IheTestCase,
  IheConnectathonSession,
  IheTestStatus,
  IheProfileId,
} from "../../types/integration";
import { usePagination } from "@/hooks/usePagination";
import { startSession, runTestCase, addStep, endSession, exportReport, presetXdsTestCases, presetPixTestCases, presetPdqvTestCases, presetAtnaTestCases, presetPamTestCases } from '@services/integration/connectathon/IheTesting';
import { IHE_PROFILES } from "@services/integration/ihe/IheProfiles";
import {
  Card,
  Space,
  Tag,
  Button,
  Empty,
  Row,
  Col,
  Progress,
  Select,
  Input,
} from "antd";
import { DataTable, StatCard, StatCardGrid } from "../../components/common";
import {
  Activity,
  Trophy,
  Play,
  Download,
  Server,
  BookOpen,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  FileText,
} from "lucide-react";
import { Inbox } from 'lucide-react'
import React, { useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { seededUnit } from "../../utils/seededRandom";
import { t } from "../../i18n/appI18n";

export const IheConnectathonPage: React.FC = () => {
  const navigate = useNavigate();
  const [session, setSession] = useState<IheConnectathonSession | null>(null);
  const testCasePagination = usePagination(session?.testCases ?? [], 10);
  const [cfg, setCfg] = useState({
    name: "G005 Connectathon 2026",
    venue: "汉东省人民医院",
    track: "Radiology",
    monitor: "王主任",
  });
  const [selectedProfiles, setSelectedProfiles] = useState<IheProfileId[]>([
    "XDS.b",
    "PIX",
    "PDQ",
  ]);

  const handleStart = useCallback(() => {
    if (
      !cfg.name.trim() ||
      !cfg.venue.trim() ||
      !cfg.track.trim() ||
      !cfg.monitor.trim()
    ) {
      messageWarn(t("iheConn.msg.fillConfig"));
      return;
    }
    if (selectedProfiles.length === 0) {
      messageWarn(t("iheConn.msg.selectProfile"));
      return;
    }
    const s = startSession({
      name: cfg.name,
      venue: cfg.venue,
      track: cfg.track,
      monitor: cfg.monitor,
      profiles: selectedProfiles,
      systemUnderTest: {
        id: "g005-ris",
        name: "G005 RIS",
        vendor: "G005",
        version: "3.0.6.0",
      },
    });
    setSession(s);
  }, [cfg, selectedProfiles]);

  const handleLoadPresets = useCallback(() => {
    if (!session) {
      messageWarn(t("iheConn.msg.startFirst"));
      return;
    }
    const cases: IheTestCase[] = [];
    if (selectedProfiles.includes("XDS.b")) cases.push(...presetXdsTestCases());
    if (selectedProfiles.includes("PIX")) cases.push(...presetPixTestCases());
    if (selectedProfiles.includes("PDQ")) cases.push(...presetPdqvTestCases());
    if (selectedProfiles.includes("ATNA")) cases.push(...presetAtnaTestCases());
    if (selectedProfiles.includes("PAM")) cases.push(...presetPamTestCases());
    cases.forEach((tc) => addStep(tc, t("iheConn.step.prepare")));
    setSession({ ...session, testCases: cases });
  }, [session, selectedProfiles]);

  const handleRunAll = useCallback(async () => {
    if (!session) return;
    const updated: IheConnectathonSession = { ...session };
    for (const tc of updated.testCases) {
      let stepIndex = 0;
      const runner = async (_step: { id: string; description: string }) => {
        await new Promise((r) => setTimeout(r, 60));
        // [G005 W7] 确定性结果 (由 profile/titleEn/step 派生, 刷新后稳定不变)
        const passed = seededUnit(`${tc.profile}|${tc.titleEn}|${stepIndex}`) > 0.1;
        stepIndex += 1;
        return {
          status: passed
            ? ("pass" as IheTestStatus)
            : ("warning" as IheTestStatus),
          message: passed ? "OK" : t("iheConn.msg.slowResponse"),
          actual: "completed",
          expected: "completed",
        };
      };
      await runTestCase(tc, runner);
    }
    updated.passCount = updated.testCases.filter(
      (tc) => tc.status === "pass",
    ).length;
    updated.failCount = updated.testCases.filter(
      (tc) => tc.status === "fail",
    ).length;
    updated.warnCount = updated.testCases.filter(
      (tc) => tc.status === "warning",
    ).length;
    updated.skipCount = updated.testCases.filter(
      (tc) => tc.status === "skip",
    ).length;
    updated.totalCount = updated.testCases.length;
    setSession({ ...updated });
  }, [session]);

  const handleExport = useCallback(
    (fmt: "json" | "summary" | "kat") => {
      if (!session) return;
      const data = exportReport(session, fmt);
      const blob = new Blob([data], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `connectathon-${Date.now()}.${fmt === "json" ? "json" : "txt"}`;
      a.click();
      URL.revokeObjectURL(url);
    },
    [session],
  );

  const passRate = useMemo(() => {
    if (!session || session.totalCount === 0) return 0;
    return Math.round((session.passCount / session.totalCount) * 100);
  }, [session]);

  return (
    <div className="p-4 space-y-3">
      <Card size="small" className="shadow-sm">
        <div className="flex items-center justify-between">
          <Space>
            <Trophy className="w-5 h-5 text-yellow-600" />
            <div>
              <div className="text-base font-semibold">
                {t("iheConn.title")}
              </div>
              <div className="text-xs text-slate-500">
                {t("iheConn.subtitle")}
              </div>
            </div>
          </Space>
          <Space>
            <Tag color="yellow">Connectathon</Tag>
            <Tag color="red">IHE</Tag>
            {/* [G005 Wave2B P2] Math.random 本地模拟测试 → 模拟工具徽标 */}
            <Tag color="orange">{t("iheConn.mockBadge")}</Tag>
            {/* [G005 W7] 明确的「演示模拟」徽标 (确定性测试结果) */}
            <Tag color="volcano">{t("w7demo.simulatedBadge")}</Tag>
            <Button
              size="small"
              icon={<BookOpen className="w-3 h-3" />}
              onClick={() => navigate("/ihe/manager")}
            >
              {t("iheConn.viewProfile")}
            </Button>
          </Space>
        </div>
      </Card>

      <Row gutter={8}>
        <Col span={6}>
          <Card
            size="small"
            className="shadow-sm"
            title={
              <Space>
                <Server className="w-4 h-4" />
                <span>{t("iheConn.sessionConfig")}</span>
              </Space>
            }
          >
            <Space orientation="vertical" className="w-full">
              <div>
                <div className="text-xs text-slate-500">
                  <span style={{ color: "red" }}>*</span> {t("iheConn.name")}
                </div>
                <Input
                  required
                  maxLength={100}
                  value={cfg.name}
                  onChange={(e) =>
                    setCfg((c) => ({ ...c, name: e.target.value }))
                  }
                />
              </div>
              <div>
                <div className="text-xs text-slate-500">
                  <span style={{ color: "red" }}>*</span> {t("iheConn.venue")}
                </div>
                <Input
                  required
                  maxLength={100}
                  value={cfg.venue}
                  onChange={(e) =>
                    setCfg((c) => ({ ...c, venue: e.target.value }))
                  }
                />
              </div>
              <div>
                <div className="text-xs text-slate-500">
                  <span style={{ color: "red" }}>*</span> {t("iheConn.testItem")}
                </div>
                <Input
                  required
                  maxLength={100}
                  value={cfg.track}
                  onChange={(e) =>
                    setCfg((c) => ({ ...c, track: e.target.value }))
                  }
                />
              </div>
              <div>
                <div className="text-xs text-slate-500">
                  <span style={{ color: "red" }}>*</span> {t("iheConn.monitor")}
                </div>
                <Input
                  required
                  maxLength={100}
                  value={cfg.monitor}
                  onChange={(e) =>
                    setCfg((c) => ({ ...c, monitor: e.target.value }))
                  }
                />
              </div>
              <div>
                <div className="text-xs text-slate-500">{t("iheConn.profile")}</div>
                <Select
                  mode="multiple"
                  value={selectedProfiles}
                  onChange={(v) => setSelectedProfiles(v as IheProfileId[])}
                  className="w-full"
                  options={IHE_PROFILES.map((p) => ({
                    value: p.id,
                    label: p.acronym,
                  }))}
                />
              </div>
              <div className="flex gap-2">
                {!session ? (
                  <Button
                    type="primary"
                    icon={<Play className="w-3 h-3" />}
                    onClick={handleStart}
                  >
                    {t("iheConn.startSession")}
                  </Button>
                ) : (
                  <Button onClick={() => setSession(endSession())} danger>
                    {t("iheConn.endSession")}
                  </Button>
                )}
                <Button
                  icon={<Download className="w-3 h-3" />}
                  onClick={handleLoadPresets}
                  disabled={!session}
                >
                  {t("iheConn.loadCases")}
                </Button>
              </div>
              <div className="flex gap-2">
                <Button
                  icon={<Play className="w-3 h-3" />}
                  type="primary"
                  onClick={handleRunAll}
                  disabled={!session || !session.testCases.length}
                >
                  {t("iheConn.runAll")}
                </Button>
                <Button
                  icon={<Download className="w-3 h-3" />}
                  onClick={() => handleExport("summary")}
                  disabled={!session}
                >
                  Summary
                </Button>
                <Button
                  icon={<Download className="w-3 h-3" />}
                  onClick={() => handleExport("json")}
                  disabled={!session}
                >
                  JSON
                </Button>
              </div>
            </Space>
          </Card>
        </Col>
        <Col span={18}>
          <StatCardGrid minWidth={200} gap={8}>
            <StatCard
              title={t("iheConn.cases")}
              value={session?.totalCount ?? 0}
              color="#7c3aed"
              icon={<FileText className="w-3 h-3" style={{ color: "#7c3aed" }} />}
            />
            <StatCard
              title={t("iheConn.pass")}
              value={session?.passCount ?? 0}
              color="success"
              suffix={`/ ${session?.totalCount ?? 0}`}
              icon={<CheckCircle2 className="w-3 h-3" style={{ color: "#10b981" }} />}
            />
            <StatCard
              title={t("iheConn.warning")}
              value={session?.warnCount ?? 0}
              color="warning"
              icon={<AlertCircle className="w-3 h-3" style={{ color: "var(--color-warning-500)" }} />}
            />
            <StatCard
              title={t("iheConn.fail")}
              value={session?.failCount ?? 0}
              color="error"
              icon={<XCircle className="w-3 h-3" style={{ color: "var(--color-error-600)" }} />}
            />
            <StatCard
              title={t("iheConn.skip")}
              value={session?.skipCount ?? 0}
              color="#64748b"
              icon={<Clock className="w-3 h-3" style={{ color: 'var(--text-muted, #64748b)' }} />}
            />
          </StatCardGrid>

          <Card
            size="small"
            className="shadow-sm mt-2"
            title={
              <Space>
                <Activity className="w-4 h-4" />
                <span>{t("iheConn.passRate")}</span>
                <Tag
                  color={
                    passRate >= 80 ? "green" : passRate >= 60 ? "orange" : "red"
                  }
                >
                  {passRate}%
                </Tag>
              </Space>
            }
          >
            <Progress
              percent={passRate}
              status={
                passRate >= 80
                  ? "success"
                  : passRate >= 60
                    ? "active"
                    : "exception"
              }
              strokeColor={
                passRate >= 80
                  ? "#10b981"
                  : passRate >= 60
                    ? "var(--color-warning-500)"
                    : "var(--color-error-600)"
              }
            />
          </Card>

          <Card
            size="small"
            className="shadow-sm mt-2"
            title={
              <Space>
                <FileText className="w-4 h-4" />
                <span>{t("iheConn.testCases")}</span>
              </Space>
            }
          >
            {!session || session.testCases.length === 0 ? (
              <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t("iheConn.emptyClickLoad")} />
            ) : (
              <DataTable
                rowKey="id"
                pagination={testCasePagination.pagination}
                locale={{ emptyText: <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t("common.empty.noData")} /> }}
                scroll={{ x: "max-content" }}
                dataSource={testCasePagination.pageData}
                columns={[
                  {
                    title: t("iheConn.col.profile"),
                    dataIndex: "profile",
                    key: "profile",
                    render: (v) => <Tag color="red">{v}</Tag>,
                    width: 80,
                  },
                  { title: t("iheConn.col.title"), dataIndex: "titleEn", key: "titleEn" },
                  {
                    title: t("iheConn.col.actor"),
                    key: "actor",
                    render: (_, r) => (
                      <span className="text-xs">
                        {r.actor} / {r.role}
                      </span>
                    ),
                    width: 180,
                  },
                  {
                    title: t("iheConn.col.steps"),
                    dataIndex: "steps",
                    key: "steps",
                    render: (s) => <Tag>{s.length}</Tag>,
                    width: 60,
                  },
                  {
                    title: t("iheConn.col.status"),
                    dataIndex: "status",
                    key: "status",
                    render: (s) => (
                      <Tag color={statusColor(s as IheTestStatus)}>
                        {String(s).toUpperCase()}
                      </Tag>
                    ),
                    width: 90,
                  },
                  {
                    title: t("iheConn.col.duration"),
                    dataIndex: "durationMs",
                    key: "durationMs",
                    render: (v) => `${v}ms`,
                    width: 70,
                  },
                ]}
              />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

function statusColor(s: IheTestStatus): string {
  if (s === "pass") return "green";
  if (s === "fail") return "red";
  if (s === "warning") return "orange";
  if (s === "skip") return "default";
  if (s === "running") return "blue";
  return "default";
}

function messageWarn(msg: string): void {
  const d = document.createElement("div");
  d.textContent = msg;
  d.style.cssText =
    "position:fixed;top:24px;left:50%;transform:translateX(-50%);background:var(--color-error-600);color:#fff;padding:10px 20px;border-radius:8px;font-size:13px;font-weight:600;z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,0.15)";
  document.body.appendChild(d);
  setTimeout(() => {
    d.style.opacity = "0";
    d.style.transition = "opacity 0.3s";
    setTimeout(() => document.body.removeChild(d), 300);
  }, 2000);
}

export default IheConnectathonPage;
