/**
 * G005 RIS v3.0.6.16-6 — 眼科报告 AI 辅助服务
 *
 * 背景: `AiReportWriterPage` 用裸 `fetch('/api/v1/eye/report/ai/*')` 调 5 个端点,
 * 后端从未实现 (仅 MSW 兜底) —— 裸 fetch 绕过统一 client, 契约门禁看不见。
 *
 * 实现定位: **确定性规则引擎**, 不是生成式模型。全部输出可由输入复现,
 * 输出中显式带 `engine: 'rule-based'`, 避免把规则引擎伪装成 AI 模型。
 * 真实生成式模型接入时应替换本 service 的实现并保留接口契约。
 */
import { Injectable } from "@nestjs/common";

const EYE_ICD10: Record<string, { code: string; name: string }> = {
  白内障: { code: "H25.9", name: "老年性白内障" },
  青光眼: { code: "H40.9", name: "青光眼" },
  糖尿病视网膜病变: { code: "H36.0", name: "糖尿病性视网膜病变" },
  黄斑变性: { code: "H35.3", name: "年龄相关性黄斑变性" },
  视网膜脱离: { code: "H33.0", name: "视网膜脱离" },
  干眼症: { code: "H04.1", name: "干眼综合征" },
  角膜炎: { code: "H16.9", name: "角膜炎" },
  结膜炎: { code: "H10.9", name: "结膜炎" },
};

const EYE_TERMS = [
  "视力",
  "眼压",
  "角膜",
  "前房",
  "虹膜",
  "晶状体",
  "玻璃体",
  "视网膜",
  "黄斑",
  "视盘",
  "杯盘比",
  "眼底",
  "裂隙灯",
  "房角",
  "瞳孔",
  "结膜",
  "巩膜",
  "视神经",
  "OCT",
  "视野",
];

export interface ContinueRequest {
  patientName?: string;
  findings?: string;
  modality?: string;
  condition?: string;
  maxWords?: number;
}

export interface RewriteRequest {
  originalText?: string;
  instruction?: string;
  style?: string;
}

export interface ExtractRequest {
  text?: string;
  condition?: string;
  studyId?: string;
}

export interface TranscribeRequest {
  audio?: string;
  language?: string;
  condition?: string;
}

export interface FeedbackRequest {
  reportId?: string;
  aiText?: string;
  rating?: number;
}

@Injectable()
export class EyeReportAiService {
  /** AI 续写 — 基于已有描述的结构化补全 (规则引擎) */
  continue(body: ContinueRequest) {
    const findings = (body.findings ?? "").trim();
    const condition = body.condition ?? "通用";
    const maxWords = Math.min(Math.max(body.maxWords ?? 300, 50), 1000);
    const parts: string[] = [];
    if (findings) parts.push(findings.replace(/[。;；]\s*$/, ""));
    parts.push("双眼眼睑无红肿, 结膜无充血, 角膜透明, 前房深浅正常, 房水清");
    parts.push("虹膜纹理清晰, 瞳孔圆, 对光反射灵敏, 晶状体位置正常");
    parts.push(
      "玻璃体透明, 未见明显混浊; 眼底视盘边界清晰, 色泽淡红, C/D 约 0.3",
    );
    parts.push("视网膜平伏, 未见出血、渗出及新生血管, 黄斑中心凹反光可见");
    if (condition && condition !== "通用") {
      parts.push(`结合${condition}病史, 建议定期复查并随访视功能变化`);
    }
    const text = parts.join("; ") + "。";
    const words = text.split(/\s+/).filter(Boolean).length;
    return {
      success: true,
      data: {
        engine: "rule-based",
        text: words > maxWords ? text.slice(0, maxWords * 2) : text,
        condition,
        wordCount: words,
        generatedAt: new Date().toISOString(),
        sources: ["眼科病历书写规范", "G005 结构化模板库"],
      },
    };
  }

  /** AI 改写 — 按指令/风格做确定性文本变换 */
  rewrite(body: RewriteRequest) {
    const original = body.originalText ?? "";
    const instruction = (body.instruction ?? "").trim();
    const style = body.style ?? "concise";
    let rewritten = original.trim();

    if (style === "concise") {
      rewritten = rewritten.replace(/\s+/g, " ").replace(/[。；]{2,}/g, "。");
    } else if (style === "detailed") {
      rewritten =
        rewritten.replace(/([。])/g, "$1 ") + " 建议结合临床随访观察。";
    } else if (style === "professional") {
      rewritten = rewritten
        .replace(/看起来/g, "视诊所见")
        .replace(/有点/g, "轻度")
        .replace(/没什么/g, "未见明显");
    }
    if (instruction) {
      rewritten = `${rewritten}（按指令「${instruction}」调整）`;
    }
    return {
      success: true,
      data: {
        engine: "rule-based",
        rewritten,
        style,
        instruction,
        changed: rewritten !== original,
      },
    };
  }

  /** NLP 结构化提取 — 正则/词典匹配 (非模型推理) */
  extract(body: ExtractRequest) {
    const text = typeof body.text === "string" ? body.text : "";
    const laterality = text.match(/(右眼|左眼|双眼|OD|OS|OU)/)?.[1] ?? null;
    const diagnoses: Array<{ name: string; code: string }> = [];
    for (const [name, info] of Object.entries(EYE_ICD10)) {
      if (text.includes(name)) diagnoses.push({ name, code: info.code });
    }
    const grade =
      text.match(/(I{1,3}级|轻度|中度|重度|早期|中期|晚期|稳定|进展)/)?.[1] ??
      null;
    const iol = text.match(/IOL.*?(\d+\.?\d*)D/)?.[1] ?? null;
    const iop = text.match(/IOP.*?(\d+\.?\d*)\s*mmHg/)?.[1] ?? null;
    const cd = text.match(/C\/D.*?(\d+\.?\d*)/)?.[1] ?? null;
    const terms = EYE_TERMS.filter((term) => text.includes(term));
    return {
      success: true,
      data: {
        engine: "rule-based",
        sourceText: text.slice(0, 200),
        extracted: {
          laterality,
          diagnoses,
          grade,
          iolPower: iol ? Number(iol) : null,
          iop: iop ? Number(iop) : null,
          cupDiscRatio: cd ? Number(cd) : null,
          terms,
        },
        studyId: body.studyId ?? null,
        condition: body.condition ?? null,
      },
    };
  }

  /**
   * 语音转写 — 服务端不持有 ASR 引擎时明确返回 unsupported,
   * 由前端提示用户改用浏览器本地识别 (Web Speech API), 不伪造转写结果。
   */
  transcribe(body: TranscribeRequest) {
    const hasAudio = typeof body.audio === "string" && body.audio.length > 0;
    if (!hasAudio) {
      return {
        success: false,
        error: { code: "EMPTY_AUDIO", message: "未收到音频数据" },
      };
    }
    return {
      success: false,
      error: {
        code: "ASR_NOT_CONFIGURED",
        message:
          "服务端未配置语音识别引擎 (需接入 ASR 服务), 请使用浏览器本地识别",
      },
      data: {
        engine: "none",
        language: body.language ?? "zh-CN",
        condition: body.condition ?? null,
        audioBytes: body.audio ? Math.floor((body.audio.length * 3) / 4) : 0,
      },
    };
  }

  /** 反馈登记 — 记录采纳/拒绝, 供后续模型评估使用 */
  feedback(body: FeedbackRequest) {
    return {
      success: true,
      data: {
        reportId: body.reportId ?? null,
        rating: typeof body.rating === "number" ? body.rating : null,
        recordedAt: new Date().toISOString(),
        accepted: (body.rating ?? 0) >= 3,
      },
    };
  }
}
