// [v3.0.6.8-89] Phase 1: 手术导板设计 + 种植上部系统
// 对标: 3Shape Implant Studio Guide Module
import React, { useState, useEffect } from "react";
import {
  Card,
  Space,
  Tag,
  Button,
  Select,
  Row,
  Col,
  Form,
  message,
  Tabs,
  Badge,
  Divider,
  List,
  Modal,
} from "antd";
import { CheckCircle2, Download, Eye, Layers, Save } from "lucide-react";
import { dentalApi } from "../../services/api/dentalApi";
import { ErrorBanner } from "../../components/feedback";
import { t } from "../../i18n/appI18n";
import { StatCard, StatCardGrid, PageContainer } from "../../components/common";

const guideTypes = () => [
  { value: "fully-guided", label: t('dentalGuide.typeFullyGuided') },
  { value: "partially-guided", label: t('dentalGuide.typePartiallyGuided') },
  { value: "pilot-drill", label: t('dentalGuide.typePilotDrill') },
  { value: "sleeveless", label: t('dentalGuide.typeSleeveless') },
];

export const DentalGuidePage: React.FC = () => {
  const [guides, setGuides] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [sleeves, setSleeves] = useState<any[]>([]);
  const [abutments, setAbutments] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("guides");
  const [newGuide, setNewGuide] = useState({
    plan3dId: "",
    type: "fully-guided",
    material: "resin-print",
    sleeveType: "",
  });
  // [G005 Wave1A P1] 套筒配置: dentalApi.updateGuideSleeve (PUT /dental/guide/:id/sleeve)
  const [sleeveModal, setSleeveModal] = useState<{ open: boolean; guide: any; sleeveType: string; saving: boolean }>({ open: false, guide: null, sleeveType: "", saving: false });
  const [previewGuide, setPreviewGuide] = useState<any | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  const loadGuides = async () => {
    const list = await dentalApi.listSurgicalGuides();
    if (Array.isArray(list)) setGuides(list);
  };

  useEffect(() => {
    setLoadError(null);
    dentalApi
      .listSurgicalGuides()
      .then((r) => {
        if (Array.isArray(r)) setGuides(r);
        else setLoadError(t("w9.states.error"));
      })
      .catch((err) => {
        console.error("[F04]", err);
        setLoadError(t("w9.states.error"));
      });
    dentalApi
      .listImplantPlans3d()
      .then((r) => {
        if (Array.isArray(r)) setPlans(r);
      })
      .catch((err) => {
        console.error("[F04]", err);
      });
    dentalApi
      .getGuideSleeves()
      .then((r) => {
        if (Array.isArray(r)) setSleeves(r);
      })
      .catch((err) => {
        console.error("[F04]", err);
      });
    dentalApi
      .getGuideMaterials()
      .then((r) => {
        if (Array.isArray(r)) setMaterials(r);
      })
      .catch((err) => {
        console.error("[F04]", err);
      });
  }, [reloadTick]);

  const handleBrandChange = (brand: string) => {
    dentalApi
      .getAbutments(brand)
      .then((r) => {
        if (Array.isArray(r)) setAbutments(r);
      })
      .catch((err) => {
        console.error("[F04]", err);
      });
    dentalApi
      .getGuideSleeves(brand)
      .then((r) => {
        if (Array.isArray(r)) setSleeves(r);
      })
      .catch((err) => {
        console.error("[F04]", err);
      });
  };

  const handleCreate = async () => {
    if (!newGuide.plan3dId) {
      message.warning(t('dentalGuide.selectPlan'));
      return;
    }
    setBusy(true);
    try {
      await dentalApi.createSurgicalGuide(newGuide);
      message.success(t('dentalGuide.guideCreated'));
      const list = await dentalApi.listSurgicalGuides();
      if (Array.isArray(list)) setGuides(list);
    } catch (e) {
      console.warn("[F03] Error:", (e as Error)?.message);
    }
    setBusy(false);
  };

  const handleExportStl = async (id: string) => {
    setBusy(true);
    try {
      const res = (await dentalApi.exportSurgicalGuide(id)) as any;
      message.success(t('dentalGuide.guideGenerated', { size: res.size }));
    } catch (e) {
      console.warn("[F03] Error:", (e as Error)?.message);
    }
    setBusy(false);
  };

  const handleUpdateSleeve = async () => {
    const g = sleeveModal.guide;
    if (!g?.id) return;
    setSleeveModal(prev => ({ ...prev, saving: true }));
    try {
      const res = await dentalApi.updateGuideSleeve(g.id, { sleeveType: sleeveModal.sleeveType });
      if (res.success) {
        message.success(t('dentalGuide.sleeveUpdated', { type: sleeveModal.sleeveType }));
        setSleeveModal({ open: false, guide: null, sleeveType: "", saving: false });
        await loadGuides();
      } else {
        message.error(res.error?.message ?? t('dentalGuide.sleeveUpdateFailed'));
        setSleeveModal(prev => ({ ...prev, saving: false }));
      }
    } catch (e: any) {
      message.error(e?.message ?? t('dentalGuide.sleeveUpdateFailed'));
      setSleeveModal(prev => ({ ...prev, saving: false }));
    }
  };

  return (
    <PageContainer padding={24}>
      <Space style={{ marginBottom: 16 }}>
        <Layers size={20} color="#2563eb" />
        <span style={{ fontSize: 18, fontWeight: 600 }}>
          {t('dentalGuide.title')}
        </span>
        <Tag color="cyan">v3.0.6.8-89</Tag>
        <Tag color="purple">{t('dentalGuide.guideModuleTag')}</Tag>
      </Space>
      {loadError && <ErrorBanner message={loadError} onRetry={() => setReloadTick((n) => n + 1)} retryLabel={t("w9.states.retry")} />}
      <StatCardGrid minWidth={200} gap={16} style={{ marginBottom: 16 }}>
        <StatCard title={t('dentalGuide.totalGuides')} value={guides.length} icon={<Layers size={16} />} />
        <StatCard title={t('dentalGuide.designing')} value={guides.filter((g: any) => g.status === "designing").length} color="warning" />
        <StatCard title={t('dentalGuide.exportedStl')} value={guides.filter((g: any) => g.guideFile).length} color="success" />
        <StatCard title={t('dentalGuide.abutmentOptions')} value={abutments.length} />
      </StatCardGrid>
      <Tabs
        activeKey={tab}
        onChange={setTab}
        items={[
          {
            key: "guides",
            label: t('dentalGuide.tabGuides'),
            children: (
              <>
                <Row gutter={16}>
                  <Col span={8}>
                    <Card size="small" title={t('dentalGuide.newGuide')}>
                      <Form layout="vertical" size="small">
                        <Form.Item label={t('dentalGuide.linkedPlan')}>
                          <Select
                            value={newGuide.plan3dId}
                            onChange={(v) => {
                              const p = plans.find((pl: any) => pl.id === v);
                              setNewGuide({ ...newGuide, plan3dId: v });
                              if (p) handleBrandChange(p.brand);
                            }}
                            options={plans.map((p: any) => ({
                              value: p.id,
                              label: `#${p.toothNo} ${p.patientName} (${p.brand})`,
                            }))}
                          />
                        </Form.Item>
                        <Form.Item label={t('dentalGuide.guideType')}>
                          <Select
                            value={newGuide.type}
                            onChange={(v) =>
                              setNewGuide({ ...newGuide, type: v })
                            }
                            options={guideTypes()}
                          />
                        </Form.Item>
                        <Form.Item label={t('dentalGuide.material')}>
                          <Select
                            value={newGuide.material}
                            onChange={(v) =>
                              setNewGuide({ ...newGuide, material: v })
                            }
                            options={materials.map((m: any) => ({
                              value: m.id,
                              label: m.name,
                            }))}
                          />
                        </Form.Item>
                        <Form.Item label={t('dentalGuide.metalSleeve')}>
                          <Select
                            value={newGuide.sleeveType}
                            onChange={(v) =>
                              setNewGuide({ ...newGuide, sleeveType: v })
                            }
                            options={sleeves.map((s: any) => ({
                              value: s.type,
                              label: `${s.type} (Ø${s.diameter}mm)`,
                            }))}
                          />
                        </Form.Item>
                        <Button
                          type="primary"
                          block
                          icon={<Save size={14} />}
                          onClick={handleCreate}
                          loading={busy}
                        >
                          {t('dentalGuide.createDesign')}
                        </Button>
                      </Form>
                    </Card>
                  </Col>
                  <Col span={16}>
                    <Card size="small" title={t('dentalGuide.guideList')}>
                      {guides.map((g: any) => (
                        <Card
                          key={g.id}
                          size="small"
                          style={{
                            marginBottom: 8,
                            borderLeft: `4px solid ${g.status === "designed" ? "#52c41a" : "#faad14"}`,
                          }}
                        >
                          <Space
                            style={{
                              justifyContent: "space-between",
                              width: "100%",
                            }}
                          >
                            <div>
                              <Tag color="purple">FDI #{g.toothNo}</Tag>
                              <Tag color="blue">{g.type}</Tag>
                              <span style={{ fontSize: 13 }}>
                                {g.patientName} - {g.createdBy}
                              </span>
                            </div>
                            <Badge
                              status={
                                g.status === "designed"
                                  ? "success"
                                  : "processing"
                              }
                              text={g.status}
                            />
                          </Space>
                          <div
                            style={{
                              fontSize: 11,
                              color: "var(--text-secondary)",
                              marginTop: 4,
                            }}
                          >
                            {g.material} | {g.sleeveType || t('dentalGuide.sleeveToSelect')} |{" "}
                            {g.fixationPin ? t('dentalGuide.withPin') : t('dentalGuide.withoutPin')} |{" "}
                            {g.createdAt?.slice(0, 10)}
                          </div>
                          <Divider style={{ margin: "4px 0" }} />
                          <Space>
                            {g.status === "designing" && (
                              <Button size="small" icon={<Eye size={10} />} onClick={() => setPreviewGuide(g)}>
                                {t('dentalGuide.preview')}
                              </Button>
                            )}
                            {g.status === "designing" && (
                              <Button
                                size="small"
                                type="primary"
                                icon={<Save size={10} />}
                                onClick={() => setSleeveModal({ open: true, guide: g, sleeveType: g.sleeveType || sleeves[0]?.type || "", saving: false })}
                              >
                                {t('dentalGuide.configureSleeve')}
                              </Button>
                            )}
                            <Button
                              size="small"
                              icon={<Download size={10} />}
                              onClick={() => handleExportStl(g.id)}
                            >
                              {t('dentalGuide.exportStl')}
                            </Button>
                            {g.guideFile && (
                              <Tag
                                color="green"
                                icon={<CheckCircle2 size={10} />}
                              >
                                {t('dentalGuide.exported')}
                              </Tag>
                            )}
                          </Space>
                        </Card>
                      ))}
                    </Card>
                  </Col>
                </Row>
              </>
            ),
          },
          {
            key: "abutment",
            label: t('dentalGuide.tabAbutment'),
            children: (
              <>
                <Row gutter={12}>
                  <Col span={12}>
                    <Card size="small" title={t('dentalGuide.abutmentOptions')}>
                      <Select
                        placeholder={t('dentalGuide.selectBrand')}
                        onChange={handleBrandChange}
                        style={{ width: 200, marginBottom: 12 }}
                        options={[
                          { value: "straumann", label: "Straumann" },
                          { value: "nobel", label: "Nobel" },
                          { value: "osstem", label: "Osstem" },
                          { value: "neobiotech", label: "Neobiotech" },
                        ]}
                      />
                      <List
                        size="small"
                        dataSource={abutments}
                        renderItem={(a: any) => (
                          <List.Item>
                            <Space>
                              <Tag
                                color={
                                  a.type.includes("zirconia")
                                    ? "magenta"
                                    : "blue"
                                }
                              >
                                {a.type}
                              </Tag>
                              <span style={{ fontSize: 12 }}>
                                {a.material} ¥{a.price}
                              </span>
                              <Tag>{a.angle}°</Tag>
                            </Space>
                          </List.Item>
                        )}
                      />
                    </Card>
                  </Col>
                  <Col span={12}>
                    <Card size="small" title={t('dentalGuide.sleeveSelection')}>
                      <Select
                        placeholder={t('dentalGuide.selectBrand')}
                        onChange={(v) =>
                          dentalApi.getGuideSleeves(v as string).then((r) => {
                            if (Array.isArray(r)) setSleeves(r);
                          })
                        }
                        style={{ width: 200, marginBottom: 12 }}
                        options={[
                          { value: "straumann", label: "Straumann" },
                          { value: "nobel", label: "Nobel" },
                          { value: "osstem", label: "Osstem" },
                          { value: "neobiotech", label: "Neobiotech" },
                        ]}
                      />
                      <List
                        size="small"
                        dataSource={sleeves}
                        renderItem={(s: any) => (
                          <List.Item>
                            <Space>
                              <Tag color="blue">{s.type}</Tag>
                              <span style={{ fontSize: 12 }}>
                                Ø{s.diameter} × {s.height}mm
                              </span>
                              <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                                {t('dentalGuide.compatible')}: {s.compatible?.slice(0, 2).join(", ")}...
                              </span>
                            </Space>
                          </List.Item>
                        )}
                      />
                    </Card>
                  </Col>
                </Row>
              </>
            ),
          },
        ]}
      />
      <Modal
        title={t('dentalGuide.configSleeveTitle', { id: sleeveModal.guide?.id ?? '' })}
        open={sleeveModal.open}
        onCancel={() => setSleeveModal({ open: false, guide: null, sleeveType: "", saving: false })}
        onOk={() => void handleUpdateSleeve()}
        confirmLoading={sleeveModal.saving}
        width={400}
      >
        <div style={{ fontSize: 13, marginBottom: 8 }}>
          {t('dentalGuide.guideLabel')}: {sleeveModal.guide?.patientName ?? '-'} · FDI #{sleeveModal.guide?.toothNo ?? '-'}
        </div>
        <Select
          value={sleeveModal.sleeveType}
          onChange={(v) => setSleeveModal(prev => ({ ...prev, sleeveType: v }))}
          style={{ width: '100%' }}
          placeholder={t('dentalGuide.selectSleeveModel')}
          options={sleeves.map((s: any) => ({
            value: s.type,
            label: `${s.type} (Ø${s.diameter}mm × ${s.height}mm)`,
          }))}
        />
      </Modal>
      <Modal
        title={t('w1Buttons.dental.previewTitle')}
        open={!!previewGuide}
        onCancel={() => setPreviewGuide(null)}
        footer={<Button onClick={() => setPreviewGuide(null)}>{t('w1Buttons.dental.close')}</Button>}
        width={560}
      >
        {previewGuide && (
          <div>
            <div style={{ background: '#0f172a', borderRadius: 8, padding: 16, display: 'flex', justifyContent: 'center' }}>
              <svg width="320" height="190" viewBox="0 0 320 190" aria-label={t('w1Buttons.dental.previewTitle')}>
                <rect x="0" y="0" width="320" height="190" fill="#0f172a" />
                <path d="M40 130 Q40 40 160 40 Q280 40 280 130" fill="none" stroke="#38bdf8" strokeWidth="3" />
                <path d="M55 140 Q55 65 160 65 Q265 65 265 140" fill="none" stroke="#1d4ed8" strokeWidth="2" strokeDasharray="6 4" />
                {[0, 1, 2, 3, 4, 5].map((i) => {
                  const a = (-70 + i * 28) * (Math.PI / 180);
                  const x = 160 + Math.sin(a) * 110;
                  const y = 120 - Math.cos(a) * 80;
                  const active = previewGuide.toothNo != null && (Number(previewGuide.toothNo) % 6) === i;
                  return <circle key={i} cx={x} cy={y} r={active ? 11 : 8} fill={active ? '#f59e0b' : '#334155'} stroke="#94a3b8" strokeWidth="1" />;
                })}
                <text x="160" y="178" textAnchor="middle" fill="#94a3b8" fontSize="11">FDI #{previewGuide.toothNo ?? '-'} · {previewGuide.type}</text>
              </svg>
            </div>
            <div style={{ marginTop: 12, fontSize: 13, lineHeight: 1.9, color: 'var(--text-primary)' }}>
              <div>{t('dentalGuide.guideLabel')}: {previewGuide.patientName ?? '-'} - {previewGuide.createdBy ?? '-'}</div>
              <div>{t('dentalGuide.guideType')}: {previewGuide.type}</div>
              <div>{t('dentalGuide.material')}: {previewGuide.material}</div>
              <div>{t('dentalGuide.metalSleeve')}: {previewGuide.sleeveType || t('dentalGuide.sleeveToSelect')}</div>
              <div>{previewGuide.fixationPin ? t('dentalGuide.withPin') : t('dentalGuide.withoutPin')} · {previewGuide.createdAt?.slice(0, 10) ?? '-'}</div>
            </div>
            <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-secondary)' }}>{t('w1Buttons.dental.previewHint')}</div>
          </div>
        )}
      </Modal>
    </PageContainer>
  );
};
export default DentalGuidePage;
