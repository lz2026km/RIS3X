// [v3.0.6.11-103 Wave 9] SNOMED CT 编码: KPI 统计 + 真表格(确认/复制到报告) + i18n + 加载态
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Code, Search, CheckCircle, FileText, BookOpen, ThumbsUp } from 'lucide-react'
import {
  Checkbox,
  Space,
  Tag,
  message,
} from "antd";
import { PageContainer } from "../../components/common/PageContainer"
import { PageHeader } from "../../components/common/PageHeader"
import { snomedApi, type SnomedCode } from "../../services/api/snomedApi"
import { t as t9 } from "../../i18n/appI18n"
import { StatCard, StatCardGrid } from "../../components/common/StatCard"
import { ActionButton } from "../../components/common/ActionButton"
// [v3.0.6.11-104 Wave 5C] SNOMED 收敛: SnomedEncoderPage + AutoCodingPage 内嵌为 Tab (旧路由 /snomed/encoder, /snomed/auto-coding redirect)
import SnomedEncoderPage from "../snomed/SnomedEncoderPage"
import AutoCodingPage from "./AutoCodingPage"

// [v3.0.6.11-104 Wave 5C] Tab 标签走 t()
const SNOMED_TABS = [
  { key: "encode" as const, label: t9("nav.snomedEncode"), icon: <Code size={15} /> },
  { key: "encoder" as const, label: t9("nav.snomedEncoder"), icon: <FileText size={15} /> },
  { key: "autoCoding" as const, label: t9("nav.autoCoding"), icon: <ThumbsUp size={15} /> },
]

export default function SnomedPage() {
  const { t } = useTranslation("snomed")
  const [activeTab, setActiveTab] = useState<"encode" | "encoder" | "autoCoding">("encode")
  const [text, setText] = useState("")
  const [codes, setCodes] = useState<SnomedCode[]>([])
  const [loading, setLoading] = useState(false)
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set())
  const [searchQ, setSearchQ] = useState("")
  const [searchResults, setSearchResults] = useState<SnomedCode[]>([])
  const [searching, setSearching] = useState(false)

  const handleEncode = async () => {
    if (!text.trim()) return
    setLoading(true)
    try {
      const res = await snomedApi.encode(text)
      setCodes(res.data.codes)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = async () => {
    if (!searchQ.trim()) return
    setSearching(true)
    try {
      const res = await snomedApi.search(searchQ)
      setSearchResults(res.data)
    } finally {
      setSearching(false)
    }
  }

  const toggleConfirm = (conceptId: string) => {
    setConfirmed(prev => {
      const next = new Set(prev)
      if (next.has(conceptId)) next.delete(conceptId)
      else next.add(conceptId)
      return next
    })
  }

  const confirmAll = () => {
    setConfirmed(new Set(codes.map(c => c.conceptId)))
    message.success(t9("w9.snomed.statsConfirmed"))
  }

  const copyToReport = (c: SnomedCode) => {
    setText(prev => `${prev.trim() ? prev.trim() + " " : ""}${c.pt}`)
    message.success(`${t9("w9.snomed.addedToReport")}: ${c.pt}`)
  }

  const avgConfidence = codes.length > 0
    ? `${(codes.reduce((s, c) => s + c.confidence, 0) / codes.length * 100).toFixed(0)}%`
    : "-"

  return (
    <PageContainer background="slate" maxWidth="wide">
      <PageHeader icon={<Code size={20} color="var(--color-primary-500)" />} title={t("title")} subtitle={t("subtitle")} />
      {/* [v3.0.6.11-104 Wave 5C] SNOMED 收敛: 编码 / 编码器 / 自动编码 三 Tab 同页 */}
      <div style={{ display: "flex", gap: 'var(--space-2, 8px)', padding: "12px 24px 0", flexWrap: "wrap" }}>
        {SNOMED_TABS.map(tab => (
          <button
            key={tab.key}
            data-testid={`snomed-tab-${tab.key}`}
            onClick={() => setActiveTab(tab.key)}
            style={{
              display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8,
              fontSize: 12, fontWeight: 600, cursor: "pointer", border: "1px solid var(--border-color)",
              background: activeTab === tab.key ? "var(--color-primary-800)" : "var(--bg-card)",
              color: activeTab === tab.key ? "#fff" : "#64748b",
            }}
          >
            {tab.icon}{tab.label}
          </button>
        ))}
      </div>

      {activeTab === "encode" && (
      <div style={{ padding: 'var(--space-6, 24px)' }}>
        <StatCardGrid style={{ marginBottom: 'var(--space-4, 16px)' }}>
          <StatCard title={t9("w9.snomed.statsTotal")} value={codes.length} icon={<FileText size={18} />} color="primary" />
          <StatCard title={t9("w9.snomed.statsConfirmed")} value={confirmed.size} icon={<CheckCircle size={18} />} color="success" />
          <StatCard title={t9("w9.snomed.statsAvgConfidence")} value={avgConfidence} icon={<ThumbsUp size={18} />} color="warning" />
          <StatCard title={t9("w9.snomed.statsSearched")} value={searchResults.length} icon={<Search size={18} />} color="info" />
        </StatCardGrid>

        <div style={{ display: "flex", gap: 'var(--space-5, 20px)', flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 320, background: "var(--bg-card)", borderRadius: 10, padding: 'var(--space-5, 20px)', boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary, #1e293b)', margin: "0 0 12px", display: "flex", alignItems: "center", gap: 6 }}>
              <FileText size={16} color="var(--color-primary-500)" />{t("reportInput")}
            </h3>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              rows={8}
              style={{ width: "100%", padding: 'var(--space-3, 12px)', border: "1px solid var(--border-color, #cbd5e1)", borderRadius: 6, fontSize: 12, fontFamily: "monospace", lineHeight: 1.6, resize: "vertical" }}
              placeholder={t("inputPlaceholder")}
            />
            <div style={{ marginTop: 'var(--space-3, 12px)' }}>
              <ActionButton action="submit" loading={loading} disabled={!text.trim()} onClick={() => void handleEncode()} icon={<Code size={14} />}>
                {loading ? t("encoding") : t("encode")}
              </ActionButton>
            </div>

            {codes.length > 0 && (
              <div style={{ marginTop: 'var(--space-4, 16px)' }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 'var(--space-2, 8px)' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary, #1e293b)' }}>{t("encodedCodes")} ({codes.length})</span>
                  <ActionButton action="save" size="compact" onClick={confirmAll} icon={<ThumbsUp size={12} />}>
                    {t("confirmAll")}
                  </ActionButton>
                </div>
                <DataTable
                  rowKey="conceptId"
                  dataSource={codes}
                  pagination={{ pageSize: 8, showSizeChanger: false }}
                  scroll={{ x: "max-content" }}
                  columns={[
                    {
                      title: "",
                      width: 48,
                      render: (_, c) => (
                        <Checkbox checked={confirmed.has(c.conceptId)} onChange={() => toggleConfirm(c.conceptId)} />
                      ),
                    },
                    {
                      title: t9("w9.snomed.pt"),
                      dataIndex: "pt",
                      render: (v: string, c) => (
                        <Space direction="vertical" size={0}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary, #1e293b)' }}>{v}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-muted, #64748b)' }}>{c.fsn}</span>
                        </Space>
                      ),
                    },
                    { title: t9("w9.snomed.conceptId"), dataIndex: "conceptId", width: 140, render: (v: string) => <Tag style={{ fontFamily: "monospace" }}>{v}</Tag> },
                    { title: t9("w9.snomed.semanticTag"), dataIndex: "semanticTag", width: 120, render: (v?: string) => v || "-" },
                    {
                      title: t9("w9.snomed.confidence"),
                      dataIndex: "confidence",
                      width: 100,
                      render: (v: number) => (
                        <span style={{ padding: "2px 6px", borderRadius: 4, background: v > 0.9 ? "#d1fae5" : "#fef3c7", color: v > 0.9 ? "#065f46" : "#92400e", fontWeight: 600 }}>
                          {(v * 100).toFixed(0)}%
                        </span>
                      ),
                    },
                    {
                      title: t9("w9.common.actions"),
                      width: 130,
                      render: (_, c) => (
                        <Space size={4}>
                          <ActionButton action="export" size="compact" onClick={() => copyToReport(c)} icon={<FileText size={12} />}>
                            {t9("w9.snomed.copyToReport")}
                          </ActionButton>
                          {confirmed.has(c.conceptId) && <CheckCircle size={14} color="#10b981" />}
                        </Space>
                      ),
                    },
                  ]}
                />
              </div>
            )}

            {codes.length === 0 && !loading && text && (
              <div style={{ marginTop: 'var(--space-3, 12px)', padding: 'var(--space-3, 12px)', background: "var(--bg-primary)", borderRadius: 6, color: 'var(--text-muted, #94a3b8)', fontSize: 12, textAlign: "center" }}>
                {t("noCodesFound")}
              </div>
            )}
          </div>

          <div style={{ flex: 1, minWidth: 320, background: "var(--bg-card)", borderRadius: 10, padding: 'var(--space-5, 20px)', boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary, #1e293b)', margin: "0 0 12px", display: "flex", alignItems: "center", gap: 6 }}>
              <Search size={16} color="#8b5cf6" />{t("searchCodes")}
            </h3>
            <div style={{ display: "flex", gap: 'var(--space-2, 8px)' }}>
              <input
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                onKeyDown={e => e.key === "Enter" && void handleSearch()}
                placeholder={t("searchPlaceholder")}
                style={{ flex: 1, padding: "8px 12px", border: "1px solid var(--border-color, #cbd5e1)", borderRadius: 6, fontSize: 12 }}
              />
              <ActionButton action="submit" loading={searching} disabled={!searchQ.trim()} onClick={() => void handleSearch()} icon={<Search size={14} />}>
                {t9("w9.common.search")}
              </ActionButton>
            </div>
            <div style={{ marginTop: 'var(--space-3, 12px)' }}>
              {searchResults.length > 0 && (
                <DataTable
                  rowKey="conceptId"
                  dataSource={searchResults}
                  pagination={{ pageSize: 8, showSizeChanger: false }}
                  scroll={{ x: "max-content" }}
                  columns={[
                    { title: t9("w9.snomed.pt"), dataIndex: "pt", render: (v: string) => <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary, #1e293b)' }}>{v}</span> },
                    { title: t9("w9.snomed.conceptId"), dataIndex: "conceptId", width: 150, render: (v: string) => <Tag style={{ fontFamily: "monospace" }}>{v}</Tag> },
                    { title: t9("w9.snomed.semanticTag"), dataIndex: "semanticTag", width: 120, render: (v?: string) => v || "-" },
                    {
                      title: t9("w9.common.actions"),
                      width: 130,
                      render: (_, c) => (
                        <ActionButton action="export" size="compact" onClick={() => copyToReport(c)} icon={<BookOpen size={12} />}>
                          {t9("w9.snomed.copyToReport")}
                        </ActionButton>
                      ),
                    },
                  ]}
                />
              )}
              {searchResults.length === 0 && searchQ && !searching && (
                <div style={{ padding: 'var(--space-3, 12px)', color: 'var(--text-muted, #94a3b8)', fontSize: 12, textAlign: "center" }}>{t("noSearchResults")}</div>
              )}
            </div>
          </div>
        </div>
      </div>
      )}

      {activeTab === "encoder" && (
        <div data-testid="snomed-embedded-encoder" style={{ background: "var(--bg-card)", borderRadius: 12, padding: 'var(--space-1, 4px)', border: "1px solid var(--border-color)" }}>
          <SnomedEncoderPage />
        </div>
      )}

      {activeTab === "autoCoding" && (
        <div data-testid="snomed-embedded-auto-coding" style={{ background: "var(--bg-card)", borderRadius: 12, padding: 'var(--space-1, 4px)', border: "1px solid var(--border-color)" }}>
          <AutoCodingPage />
        </div>
      )}
    </PageContainer>
  )
}

import { DataTable } from "../../components/common";