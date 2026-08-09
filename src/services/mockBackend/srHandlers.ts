// [v3.0.6.11-60] DICOM SR 全链路 mock handlers
// 覆盖: GET /dicom-sr (列表) / GET /dicom-sr/:id / GET /dicom-sr/by-report/:reportId
//      POST /dicom-sr/generate / POST /dicom-sr/:id/finalize / POST /dicom-sr/:id/push-oru
//      GET /dicom-sr/:id/download
import { http, HttpResponse, delay } from "msw";
import { get } from "./store";
import type { SrDocument, SrContentTree, SrConceptName, SrContentItem, SrSection } from "../api/srReportApi";

const API_BASE = (() => {
  try {
    return window.location.origin + "/api/v1";
  } catch {
    return "http://localhost:5173/api/v1";
  }
})();

const delayMs = (min = 60, max = 200) => Math.floor(Math.random() * (max - min) + min);

const DCM_CONCEPT = (code: string, meaning: string): SrConceptName => ({
  code,
  scheme: "DCM",
  meaning,
});

const SNOMED_ENTRIES: { keyword: string; code: string; meaning: string }[] = [
  { keyword: "未见明显异常", code: "17621005", meaning: "Normal (finding)" },
  { keyword: "未见异常", code: "17621005", meaning: "Normal (finding)" },
  { keyword: "气胸", code: "36118008", meaning: "Pneumothorax (disorder)" },
  { keyword: "骨折", code: "125605004", meaning: "Fracture of bone (disorder)" },
  { keyword: "水肿", code: "79654002", meaning: "Edema (finding)" },
  { keyword: "积液", code: "79654002", meaning: "Edema (finding)" },
  { keyword: "钙化", code: "44039008", meaning: "Calcification (morphologic abnormality)" },
  { keyword: "结节", code: "269256004", meaning: "Nodule (morphologic abnormality)" },
  { keyword: "肿块", code: "4147007", meaning: "Mass (morphologic abnormality)" },
  { keyword: "占位", code: "4147007", meaning: "Mass (morphologic abnormality)" },
];

const toSnomed = (text: string): SrConceptName[] => {
  const found = SNOMED_ENTRIES.filter((e) => text.includes(e.keyword)).map((e) => ({
    code: e.code,
    scheme: "SCT",
    meaning: e.meaning,
  }));
  return found.length > 0
    ? found
    : [{ code: "404684003", scheme: "SCT", meaning: "Clinical finding (finding)" }];
};

const TEMPLATES = [
  { id: "tid1500", label: "TID 1500 - 测量报告", labelEn: "TID 1500 - Measurement Report", description: "Imaging Measurement Report (DICOM PS 3.3 TID 1500)", tid: "1500" },
  { id: "tid2000", label: "TID 2000 - CAD SR", labelEn: "TID 2000 - CAD Document SR", description: "Computer-Aided Detection/Diagnosis SR (DICOM PS 3.3 TID 2000)", tid: "2000" },
];

// 内置报告池(供"从报告生成 SR"选择)
const MOCK_SR_SOURCE_REPORTS = [
  { id: "RPT-2026001", patientName: "张伟", patientId: "P20260001", modality: "CT", findings: "右上肺见磨玻璃密度结节, 边界清晰, 大小约 6.5mm。", impression: "肺结节, 未见明确恶性征象, 建议定期随访。" },
  { id: "RPT-2026002", patientName: "李娜", patientId: "P20260002", modality: "MR", findings: "左侧额叶见类圆形占位, 周围轻度水肿, 增强后明显强化。", impression: "占位性病变, 建议增强复查。" },
  { id: "RPT-2026003", patientName: "王芳", patientId: "P20260003", modality: "CT", findings: "右侧气胸, 肺组织压缩约 20%。", impression: "右侧气胸, 建议随访观察。" },
  { id: "RPT-2026004", patientName: "赵敏", patientId: "P20260004", modality: "DR", findings: "右桡骨远端见骨折线, 无明显移位。", impression: "右桡骨远端骨折。" },
  { id: "RPT-2026005", patientName: "陈杰", patientId: "P20260005", modality: "CT", findings: "胸部未见明显异常征象。", impression: "未见异常。" },
  { id: "RPT-2026006", patientName: "刘洋", patientId: "P20260006", modality: "MR", findings: "右膝关节内侧半月板后角见线样高信号。", impression: "可疑半月板损伤。" },
];

const srTemplates: Record<string, { tid: string; sopClassUid: string; label: string; labelEn: string }> = {
  tid1500: { tid: "1500", sopClassUid: "1.2.840.10008.5.1.4.1.1.88.33", label: "TID 1500", labelEn: "TID 1500 - Measurement Report" },
  tid2000: { tid: "2000", sopClassUid: "1.2.840.10008.5.1.4.1.1.88.22", label: "TID 2000", labelEn: "TID 2000 - CAD Document SR" },
};

const buildContentTree = (
  report: { id: string; patientName: string; patientId: string; modality: string; findings: string; impression: string },
  templateId: "tid1500" | "tid2000",
): SrContentTree => {
  const studyUID = `1.2.840.10008.5.1.4.1.1.2.1.${Date.now()}`;
  const findings = report.findings ?? "";
  const impression = report.impression ?? "";
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  const time = now.toISOString().slice(11, 19).replace(/:/g, "");
  const t = srTemplates[templateId]!;

  const textItem = (meaning: string, value: string): SrContentItem => ({
    relationshipType: "CONTAINS",
    conceptName: DCM_CONCEPT("121071", meaning),
    valueType: "TEXT",
    value,
  });
  const codedItem = (code: SrConceptName): SrContentItem => ({
    relationshipType: "CONTAINS",
    conceptName: DCM_CONCEPT("121071", "Finding"),
    valueType: "CODE",
    value: code.meaning,
    code,
  });

  const sections: SrSection[] = [];
  if (findings) {
    const items: SrContentItem[] = [textItem("Finding", findings), ...toSnomed(findings).map(codedItem)];
    sections.push({
      conceptName: DCM_CONCEPT("121071", "Finding"),
      title: "检查所见 / Findings",
      items,
    });
  }
  if (impression) {
    const items: SrContentItem[] = [textItem("Impression", impression), ...toSnomed(impression).map(codedItem)];
    sections.push({
      conceptName: DCM_CONCEPT("121073", "Impression"),
      title: "结论 / Impression",
      items,
    });
  }

  return {
    templateId: t.label,
    templateLabel: t.labelEn,
    context: {
      patient: { name: report.patientName, id: report.patientId, birthDate: "19850115", sex: "M" },
      study: { uid: studyUID, date, time, description: "常规检查", accessionNumber: `ACC-${Date.now().toString().slice(-6)}`, modality: report.modality },
      report: { id: report.id, authorId: "D101", authorName: "Dr. Wang", findings, impression, conclusion: impression, recommendations: "", reportDate: date },
    },
    sections,
    codedEntries: toSnomed(`${findings}\n${impression}`),
  };
};

const buildRawContent = (content: SrContentTree, sopUID: string): string => {
  const lines = [
    "# DICOM Structured Report",
    `# DICOM Standard: PS 3.3-2024 (${content.templateId})`,
    `# SOP Class: ${content.templateLabel} (${content.templateId})`,
    `# SOP Instance UID: ${sopUID}`,
    `# Study Instance UID: ${content.context.study.uid}`,
    `# Patient: ${content.context.patient.name} (${content.context.patient.id})`,
    "#",
    "(00080005) CS = ISO_IR 100",
    `(00080016) UI = 1.2.840.10008.5.1.4.1.1.88.33`,
    `(00080018) UI = ${sopUID}`,
    `(00080020) DA = ${content.context.study.date}`,
    `(00080030) TM = ${content.context.study.time}`,
    "(00080060) CS = SR",
    `(00100010) PN = ${content.context.patient.name}`,
    `(00100020) LO = ${content.context.patient.id}`,
    `(0020000D) UI = ${content.context.study.uid}`,
    `(0020000E) UI = ${content.context.study.uid}.SR.1`,
    "(0040A040) CS = VERIFIED",
    "(0040A491) CS = COMPLETE",
    `(0040DB00) CS = ${content.templateId}`,
    `(0040DB01) LO = ${content.templateLabel}`,
    "(0040A730) SQ (Content Sequence)",
  ];
  for (const section of content.sections) {
    lines.push(
      "  (0040A010) SQ (Content Item)",
      "    (0040A040) CS = CONTAINS",
      `    (00080100) SH = ${section.conceptName.code}`,
      `    (00080104) LO = ${section.conceptName.meaning}`,
    );
    for (const item of section.items) {
      lines.push("    (0040A010) SQ (Content Item)", `      (0040A160) UT = ${item.value ?? ""}`);
      if (item.valueType === "CODE" && item.code) {
        lines.push("      (0040A168) SQ (Concept Code Sequence)", `        (00080100) SH = ${item.code.code}`, `        (00080102) SH = ${item.code.scheme}`, `        (00080104) LO = ${item.code.meaning}`);
      }
    }
  }
  lines.push("# ===== End of SR =====\n");
  return lines.join("\n");
};

// ───────────────────────── 内存存储 ─────────────────────────
let srDocuments: SrDocument[] = [];

// [G005 Wave4B] G-01 Encapsulated PDF 元数据对象 (内存)
let encapsulatedPdfs: { id: string; reportId: string; sopClassUid: string; sopInstanceUid: string; studyInstanceUid: string; pdfEmbedded: string; size: number; generatedFrom: 'input' | 'url' | 'report-text'; generatedAt: string }[] = [];

const nowIso = () => new Date().toISOString();

const toDoc = (doc: SrDocument): SrDocument => doc;

const findDoc = (id: string) => srDocuments.find((d) => d.id === id);

const oruMessage = (doc: SrDocument): string => {
  const findings = doc.content.sections.find((s) => s.conceptName.code === "121071")?.items.find((i) => i.valueType === "TEXT")?.value ?? "";
  const conclusion = doc.content.sections.find((s) => s.conceptName.code === "121073")?.items.find((i) => i.valueType === "TEXT")?.value ?? "";
  const ts = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const escapeText = (s: string) => s.replace(/\|/g, "\\F\\").replace(/\^/g, "\\S\\").replace(/\r?\n/g, "\\.br\\");
  return [
    "MSH|^~\\&|G005_RIS|G005_HOSPITAL|HIS_RECEIVER|HIS|" + ts + "||ORU^R01|G005-" + doc.reportId + "-" + ts + "|P|2.5.1",
    "PID|1||" + doc.patientId + "^^^G005^MR||" + doc.patientName + "^" + doc.patientName,
    "PV1|1|O|||||||||||||" + doc.content.context.study.accessionNumber + "^^G005^ACC",
    "OBR|1|" + doc.content.context.study.accessionNumber + "^^G005^FILL|" + doc.content.context.study.accessionNumber + "^^G005^FILL|" + doc.modality + "^" + doc.modality + "^DCM",
    "OBX|1|TX|18782-3^Radiology study observation^LN||" + escapeText(findings),
    "OBX|2|TX|19005-8^Radiology study conclusion^LN||" + escapeText(conclusion),
  ].join("\r");
};

// ───────────────────────── Handlers ─────────────────────────
export const srHandlers = [
  http.get(`${API_BASE}/dicom-sr`, async () => {
    await delay(delayMs());
    return HttpResponse.json({ success: true, data: srDocuments.map(toDoc) });
  }),

  http.get(`${API_BASE}/dicom-sr/by-report/:reportId`, async ({ params }) => {
    await delay(delayMs());
    const doc = srDocuments.find((d) => d.reportId === params.reportId);
    if (!doc) return HttpResponse.json({ success: false, error: { code: "NOT_FOUND", message: "SR document not found" } }, { status: 404 });
    return HttpResponse.json({ success: true, data: toDoc(doc) });
  }),

  http.get(`${API_BASE}/dicom-sr/:id`, async ({ params }) => {
    await delay(delayMs());
    const doc = findDoc(String(params.id));
    if (!doc) return HttpResponse.json({ success: false, error: { code: "NOT_FOUND", message: "SR document not found" } }, { status: 404 });
    return HttpResponse.json({ success: true, data: toDoc(doc) });
  }),

  http.get(`${API_BASE}/dicom-sr/:id/download`, async ({ params }) => {
    await delay(delayMs());
    const doc = findDoc(String(params.id));
    if (!doc) return HttpResponse.json({ success: false, error: { code: "NOT_FOUND" } }, { status: 404 });
    return HttpResponse.text(doc.rawContent, {
      headers: {
        "Content-Type": "application/dicom",
        "Content-Disposition": `attachment; filename="${doc.sopInstanceUid}.sr"`,
      },
    });
  }),

  http.post(`${API_BASE}/dicom-sr/templates`, async () => {
    await delay(delayMs());
    return HttpResponse.json({ success: true, data: TEMPLATES });
  }),

  http.post(`${API_BASE}/dicom-sr/generate`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as { reportId: string; templateId?: "tid1500" | "tid2000"; findings?: string; impression?: string };
    // 优先从共享 store 取真实报告(与 /reports 一致), 兜底内置报告池
    const stored = get<any>("exams", body.reportId);
    const fallback = MOCK_SR_SOURCE_REPORTS.find((r) => r.id === body.reportId);
    const source = stored ?? fallback;
    if (!source) {
      return HttpResponse.json({ success: false, error: { code: "NOT_FOUND", message: `Report ${body.reportId} not found` } }, { status: 404 });
    }
    const templateId = body.templateId ?? "tid1500";
    const sopUID = `1.2.840.10008.5.1.4.1.1.88.11.1.${Date.now()}`;
    const reportCtx = {
      id: source.reportId ?? source.id,
      patientName: source.patientName ?? "未知患者",
      patientId: source.patientId ?? source.patientID ?? "UNKNOWN",
      modality: source.modality ?? "CT",
      findings: body.findings ?? source.findings ?? "",
      impression: body.impression ?? source.impression ?? source.diagnosis ?? "",
    };
    const content = buildContentTree(reportCtx, templateId);
    const existing = srDocuments.find((d) => d.reportId === body.reportId && d.templateId === templateId);
    const now = nowIso();
    const tmpl = srTemplates[templateId]!;
    const doc: SrDocument = {
      id: existing?.id ?? `sr-${Date.now()}`,
      reportId: source.id,
      templateId,
      tid: tmpl.tid,
      status: "draft",
      sopInstanceUid: existing?.sopInstanceUid ?? sopUID,
      studyInstanceUid: content.context.study.uid,
      seriesInstanceUid: `${content.context.study.uid}.SR.1`,
      sopClassUid: tmpl.sopClassUid,
      patientName: source.patientName,
      patientId: source.patientId,
      modality: source.modality,
      title: `${tmpl.labelEn} / ${source.impression.slice(0, 24)}`,
      content,
      rawContent: buildRawContent(content, sopUID),
      hl7ControlId: existing?.hl7ControlId ?? null,
      hl7Message: existing?.hl7Message ?? null,
      pushedAt: existing?.pushedAt ?? null,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    if (existing) {
      srDocuments = srDocuments.map((d) => (d.id === existing.id ? doc : d));
    } else {
      srDocuments = [doc, ...srDocuments];
    }
    return HttpResponse.json({ success: true, data: toDoc(doc) }, { status: 201 });
  }),

  // [G005 Wave4A] G-14 AI 结果 → DICOM SR 封装 (TID 2000 CAD SR 默认)
  http.post(`${API_BASE}/dicom-sr/from-ai`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as {
      studyId: string;
      findings: Array<{ label: string; confidence?: number; x?: number; y?: number; width?: number; height?: number; description?: string }>;
      templateId?: "tid1500" | "tid2000";
      modelName?: string;
      summary?: string;
    };
    const studyId = String(body.studyId ?? "");
    if (!studyId || !Array.isArray(body.findings) || body.findings.length === 0) {
      return HttpResponse.json({ success: false, error: { code: "BAD_REQUEST", message: "studyId 与 findings 为必填" } }, { status: 400 });
    }
    const templateId = body.templateId ?? "tid2000";
    const tmpl = srTemplates[templateId]!;
    const now = nowIso();
    const sopUID = `1.2.840.10008.5.1.4.1.1.88.11.1.${Date.now()}`;
    const findingsText = body.findings
      .map((f) => {
        const conf = f.confidence !== undefined ? ` (置信度 ${Math.round(f.confidence * 100)}%)` : "";
        const loc = f.x !== undefined && f.y !== undefined ? ` @(${Math.round(f.x * 100)},${Math.round(f.y * 100)})` : "";
        return `${f.label}${conf}${loc}`;
      })
      .join("\n");
    const impression = body.summary ?? "";
    const studyUID = `1.2.840.10008.5.1.4.1.1.2.1.${Date.now()}`;

    const content: SrContentTree = {
      templateId: tmpl.label,
      templateLabel: tmpl.labelEn,
      context: {
        patient: { name: "AI 患者", id: `AI-${studyId}`, birthDate: "", sex: "O" },
        study: {
          uid: studyUID,
          date: now.slice(0, 10).replace(/-/g, ""),
          time: now.slice(11, 19).replace(/:/g, ""),
          description: "AI 自动质控/检出",
          accessionNumber: `ACC-${studyId.replace(/[^0-9]/g, "").slice(-6)}`,
          modality: "CT",
        },
        report: {
          id: `AI-${studyId}`,
          authorId: "AI-ENGINE",
          authorName: body.modelName ?? "AI Engine",
          findings: findingsText,
          impression,
          conclusion: impression,
          recommendations: "",
          reportDate: now.slice(0, 10).replace(/-/g, ""),
        },
      },
      sections: [
        {
          conceptName: DCM_CONCEPT("121071", "Finding"),
          title: "检查所见 / Findings",
          items: [{ relationshipType: "CONTAINS", conceptName: DCM_CONCEPT("121071", "Finding"), valueType: "TEXT", value: findingsText }],
        },
        {
          conceptName: DCM_CONCEPT("121120", "CAD Processing and Findings Summary"),
          title: "CAD 总结 / CAD Processing and Findings Summary",
          items: body.findings.map((f) => ({
            relationshipType: "CONTAINS",
            conceptName: DCM_CONCEPT("121071", "Finding"),
            valueType: "TEXT",
            value: `${f.label}${f.confidence !== undefined ? `, 置信度 ${Math.round(f.confidence * 100)}%` : ""}`,
          })),
        },
      ],
      codedEntries: toSnomed(findingsText),
    };

    const doc: SrDocument = {
      id: `sr-ai-${Date.now()}`,
      reportId: `AI-${studyId}`,
      templateId,
      tid: tmpl.tid,
      status: "draft",
      sopInstanceUid: sopUID,
      studyInstanceUid: studyUID,
      seriesInstanceUid: `${studyUID}.SR.1`,
      sopClassUid: tmpl.sopClassUid,
      patientName: "AI 患者",
      patientId: `AI-${studyId}`,
      modality: "CT",
      title: `${tmpl.labelEn} / AI 检出 ${body.findings.length} 处`,
      content,
      rawContent: buildRawContent(content, sopUID),
      hl7ControlId: null,
      hl7Message: null,
      pushedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    srDocuments = [doc, ...srDocuments];
    return HttpResponse.json({ success: true, data: toDoc(doc) }, { status: 201 });
  }),

  // [G005 Wave4B] G-01 DICOM PDF 封装 (Encapsulated PDF Storage)
  http.post(`${API_BASE}/dicom-sr/encapsulate-pdf`, async ({ request }) => {
    await delay(delayMs());
    const body = (await request.json()) as { reportId?: string; studyId?: string; pdfUrl?: string; pdfBase64?: string };
    if (!body.reportId && !body.studyId) {
      return HttpResponse.json({ success: false, error: { code: "BAD_REQUEST", message: "reportId 或 studyId 必填" } }, { status: 400 });
    }
    const reportId = body.reportId ?? `RPT-${body.studyId}`;
    const source = get<any>("exams", body.reportId ?? "") ?? MOCK_SR_SOURCE_REPORTS.find((r) => r.id === reportId);
    let pdfEmbedded = "";
    let generatedFrom: "input" | "url" | "report-text" = "input";
    if (body.pdfBase64 && body.pdfBase64.trim()) {
      pdfEmbedded = body.pdfBase64.trim();
      generatedFrom = "input";
    } else if (body.pdfUrl && body.pdfUrl.trim()) {
      pdfEmbedded = `url:${body.pdfUrl.trim()}`;
      generatedFrom = "url";
    } else {
      const text = [
        "%PDF-1.4 Encapsulated PDF Stream (generated by G005 RIS)",
        `Report: ${reportId}`,
        `Patient: ${source?.patientName ?? "未知患者"}`,
        `Study UID: 1.2.840.10008.5.1.4.1.1.2.1.${Date.now()}`,
        `Findings: ${source?.findings ?? ""}`,
        `Impression: ${source?.impression ?? source?.diagnosis ?? ""}`,
        `Generated At: ${new Date().toISOString()}`,
      ].join("\n");
      pdfEmbedded = btoa(unescape(encodeURIComponent(text)));
      generatedFrom = "report-text";
    }
    const now = new Date().toISOString();
    const doc = {
      id: `pdf-${Date.now().toString(36)}-${encapsulatedPdfs.length + 1}`,
      reportId,
      sopClassUid: "1.2.840.10008.5.1.4.1.1.104.1",
      sopInstanceUid: `1.2.840.10008.5.1.4.1.1.104.1.${Date.now()}`,
      studyInstanceUid: `1.2.840.10008.5.1.4.1.1.2.1.${Date.now()}`,
      pdfEmbedded,
      size: pdfEmbedded.length,
      generatedFrom,
      generatedAt: now,
    };
    encapsulatedPdfs = [doc, ...encapsulatedPdfs];
    return HttpResponse.json({ success: true, data: doc }, { status: 201 });
  }),

  http.get(`${API_BASE}/dicom-sr/encapsulated/:id`, async ({ params }) => {
    await delay(delayMs());
    const doc = encapsulatedPdfs.find((d) => d.id === params.id);
    if (!doc) return HttpResponse.json({ success: false, error: { code: "NOT_FOUND", message: "Encapsulated PDF not found" } }, { status: 404 });
    return HttpResponse.json({ success: true, data: doc });
  }),

  http.post(`${API_BASE}/dicom-sr/:id/finalize`, async ({ params }) => {
    await delay(delayMs());
    const doc = findDoc(String(params.id));
    if (!doc) return HttpResponse.json({ success: false, error: { code: "NOT_FOUND" } }, { status: 404 });
    if (doc.status === "pushed") {
      return HttpResponse.json({ success: false, error: { code: "BAD_REQUEST", message: "SR document already pushed" } }, { status: 400 });
    }
    doc.status = "finalized";
    doc.updatedAt = nowIso();
    return HttpResponse.json({ success: true, data: toDoc(doc) });
  }),

  http.post(`${API_BASE}/dicom-sr/:id/push-oru`, async ({ params }) => {
    await delay(delayMs());
    const doc = findDoc(String(params.id));
    if (!doc) return HttpResponse.json({ success: false, error: { code: "NOT_FOUND" } }, { status: 404 });
    const message = oruMessage(doc);
    const controlId = `G005-${doc.reportId}-${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}`;
    doc.status = "pushed";
    doc.hl7ControlId = controlId;
    doc.hl7Message = message;
    doc.pushedAt = nowIso();
    doc.updatedAt = nowIso();
    return HttpResponse.json({
      success: true,
      data: { document: toDoc(doc), oru: { message, controlId, pushed: false, ackStatus: "SKIPPED" } },
    });
  }),
];
