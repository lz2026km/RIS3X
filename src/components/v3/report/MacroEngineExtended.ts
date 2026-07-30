import type { MacroContext, MacroResult } from "./MacroEngine";

const FUNCTIONS: Record<string, (...args: unknown[]) => unknown> = {
  // ========== ORIGINAL FUNCTIONS ==========
  upper: (s) => (typeof s === "string" ? s.toUpperCase() : s),
  lower: (s) => (typeof s === "string" ? s.toLowerCase() : s),
  trim: (s) => (typeof s === "string" ? s.trim() : s),
  round: (n, d) => {
    const num = Number(n);
    const dec = d === undefined ? 0 : Number(d);
    const f = 10 ** dec;
    return Math.round(num * f) / f;
  },
  floor: (n) => Math.floor(Number(n)),
  ceil: (n) => Math.ceil(Number(n)),
  abs: (n) => Math.abs(Number(n)),
  min: (...args) => Math.min(...args.map(Number)),
  max: (...args) => Math.max(...args.map(Number)),
  concat: (...args) =>
    args.map((a) => (a === null || a === undefined ? "" : String(a))).join(""),
  join: (arr, sep) =>
    Array.isArray(arr) ? arr.join(String(sep ?? "")) : String(arr),
  length: (s) =>
    typeof s === "string" ? s.length : Array.isArray(s) ? s.length : 0,
  upperFirst: (s) =>
    typeof s === "string" ? s.charAt(0).toUpperCase() + s.slice(1) : s,
  default: (v, d) => (v === null || v === undefined || v === "" ? d : v),
  date: (format?: unknown) => {
    const d = new Date();
    const map: Record<string, string> = {
      YYYY: String(d.getFullYear()),
      MM: String(d.getMonth() + 1).padStart(2, "0"),
      DD: String(d.getDate()).padStart(2, "0"),
      HH: String(d.getHours()).padStart(2, "0"),
      mm: String(d.getMinutes()).padStart(2, "0"),
      ss: String(d.getSeconds()).padStart(2, "0"),
    };
    return String(format ?? "YYYY-MM-DD").replace(
      /YYYY|MM|DD|HH|mm|ss/g,
      (k) => map[k] ?? k,
    );
  },
  if: (cond, a, b) => (cond ? a : b),
  sum: (...args) => args.flat().reduce((a, b) => Number(a) + Number(b), 0),
  avg: (...args) => {
    const arr = args.flat().map(Number);
    return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  },

  // ========== PATIENT FUNCTIONS ==========
  patientName: () => "{{patient.name}}",
  patientAge: () => "{{patient.age}}",
  patientGender: () => "{{patient.gender}}",
  patientBMI: (weight: unknown, height: unknown) => {
    const w = Number(weight);
    const h = Number(height);
    if (!h) return 0;
    return w / ((h / 100) * (h / 100));
  },
  formatDate: (dateStr: unknown, format: unknown) => {
    const d = new Date(String(dateStr));
    if (isNaN(d.getTime())) return String(dateStr);
    const fmt = String(format || "YYYY-MM-DD");
    const map: Record<string, string> = {
      YYYY: String(d.getFullYear()),
      MM: String(d.getMonth() + 1).padStart(2, "0"),
      DD: String(d.getDate()).padStart(2, "0"),
      HH: String(d.getHours()).padStart(2, "0"),
      mm: String(d.getMinutes()).padStart(2, "0"),
      ss: String(d.getSeconds()).padStart(2, "0"),
    };
    return fmt.replace(/YYYY|MM|DD|HH|mm|ss/g, (k) => map[k] ?? k);
  },
  timeAgo: (dateStr: unknown) => {
    const d = new Date(String(dateStr));
    if (isNaN(d.getTime())) return String(dateStr);
    const diff = Date.now() - d.getTime();
    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return "刚刚";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}分钟前`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}小时前`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}天前`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}个月前`;
    return `${Math.floor(months / 12)}年前`;
  },

  // ========== MEDICAL FUNCTIONS ==========
  huToGray: (hu: unknown) => {
    const v = Number(hu);
    if (v <= -1000) return "空气";
    if (v <= -500) return "肺实质";
    if (v <= -50) return "脂肪";
    if (v <= 50) return "水样密度";
    if (v <= 200) return "软组织";
    if (v <= 1000) return "骨骼";
    return "金属/高密度";
  },
  modalityLabel: (modality: unknown) => {
    const m = String(modality).toUpperCase();
    const labels: Record<string, string> = {
      CT: "CT",
      MR: "磁共振",
      MRI: "磁共振",
      XR: "X线",
      CR: "X线(CR)",
      DR: "X线(DR)",
      US: "超声",
      PET: "PET",
      NM: "核医学",
      DX: "数字化X线",
      MG: "乳腺X线",
      DSA: "DSA",
      RF: "透视",
      OT: "其他",
    };
    return labels[m] ?? m;
  },
  bodyPartLabel: (code: unknown) => {
    const c = String(code).toUpperCase();
    const labels: Record<string, string> = {
      HEAD: "头部",
      BRAIN: "脑部",
      CHEST: "胸部",
      ABDOMEN: "腹部",
      PELVIS: "盆腔",
      SPINE: "脊柱",
      NECK: "颈部",
      LIMB: "四肢",
      CARDIAC: "心脏",
      BREAST: "乳腺",
      SINUS: "鼻窦",
      EYE: "眼部",
      DENTAL: "口腔",
      THYROID: "甲状腺",
      VASCULAR: "血管",
      WHOLE_BODY: "全身",
    };
    return labels[c] ?? c;
  },
  radsCategoryDesc: (rads: unknown) => {
    const r = String(rads).toUpperCase();
    const birads: Record<string, string> = {
      "BI-RADS 0": "评估不完整",
      "BI-RADS 1": "阴性",
      "BI-RADS 2": "良性",
      "BI-RADS 3": "可能良性",
      "BI-RADS 4": "可疑恶性",
      "BI-RADS 4A": "低度可疑恶性",
      "BI-RADS 4B": "中度可疑恶性",
      "BI-RADS 4C": "高度可疑恶性",
      "BI-RADS 5": "高度提示恶性",
      "BI-RADS 6": "已活检证实恶性",
    };
    if (birads[r]) return birads[r];
    if (r.startsWith("PI-RADS")) {
      const level = r.replace("PI-RADS ", "");
      const pi: Record<string, string> = {
        "1": "临床显著癌可能性极低",
        "2": "临床显著癌可能性低",
        "3": "临床显著癌可能性中等",
        "4": "临床显著癌可能性高",
        "5": "临床显著癌可能性极高",
      };
      return pi[level] ?? r;
    }
    if (r.startsWith("TI-RADS")) {
      const level = r.replace("TI-RADS ", "");
      const ti: Record<string, string> = {
        "1": "良性",
        "2": "无可疑特征",
        "3": "低度可疑",
        "4": "中度可疑",
        "5": "高度可疑",
      };
      return ti[level] ?? r;
    }
    return r;
  },
  kpiFormat: (value: unknown, decimals: unknown) => {
    const num = Number(value);
    if (isNaN(num)) return "0";
    const dec = decimals === undefined ? 0 : Number(decimals);
    return num.toLocaleString("en-US", {
      minimumFractionDigits: dec,
      maximumFractionDigits: dec,
    });
  },

  // ========== STRING FUNCTIONS ==========
  truncate: (str: unknown, maxLen: unknown) => {
    const s = String(str ?? "");
    const len = Number(maxLen);
    if (s.length <= len) return s;
    return s.slice(0, len) + "...";
  },
  padLeft: (str: unknown, len: unknown, char: unknown) => {
    return String(str ?? "").padStart(Number(len), String(char ?? " "));
  },
  padRight: (str: unknown, len: unknown, char: unknown) => {
    return String(str ?? "").padEnd(Number(len), String(char ?? " "));
  },
  replace: (str: unknown, search: unknown, replacement: unknown) => {
    const s = String(str ?? "");
    const r = String(replacement ?? "");
    const sr = String(search ?? "");
    return s.split(sr).join(r);
  },
  match: (str: unknown, pattern: unknown) => {
    try {
      return new RegExp(String(pattern).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(String(str ?? ""));
    } catch {
      return false;
    }
  },
  split: (str: unknown, delimiter: unknown, index: unknown) => {
    const parts = String(str ?? "").split(String(delimiter ?? ","));
    const idx = Number(index);
    if (isNaN(idx)) return parts;
    return parts[idx] ?? "";
  },
  contains: (str: unknown, substr: unknown) => {
    return String(str ?? "").includes(String(substr ?? ""));
  },

  // ========== ARRAY FUNCTIONS ==========
  first: (arr: unknown) => {
    return Array.isArray(arr) && arr.length ? arr[0] : undefined;
  },
  last: (arr: unknown) => {
    return Array.isArray(arr) && arr.length ? arr[arr.length - 1] : undefined;
  },
  nth: (arr: unknown, index: unknown) => {
    if (!Array.isArray(arr)) return undefined;
    const idx = Number(index);
    return arr[idx] ?? undefined;
  },
  count: (arr: unknown) => {
    return Array.isArray(arr) ? arr.length : 0;
  },
  sort: (arr: unknown) => {
    if (!Array.isArray(arr)) return arr;
    return [...arr].sort((a, b) => {
      if (typeof a === "number" && typeof b === "number") return a - b;
      return String(a).localeCompare(String(b));
    });
  },
  reverse: (arr: unknown) => {
    return Array.isArray(arr) ? [...arr].reverse() : arr;
  },
  unique: (arr: unknown) => {
    if (!Array.isArray(arr)) return arr;
    return [...new Set(arr)];
  },
  filter: (arr: unknown, predicate: unknown) => {
    if (!Array.isArray(arr)) return arr;
    const pred = String(predicate ?? "").trim();
    const m = pred.match(/^([<>=!]+)\s*(\d+(?:\.\d+)?)$/);
    if (m) {
      const op = m[1];
      const num = Number(m[2]);
      return arr.filter((item) => {
        const v = Number(item);
        if (op === ">") return v > num;
        if (op === "<") return v < num;
        if (op === ">=") return v >= num;
        if (op === "<=") return v <= num;
        if (op === "==") return v === num;
        if (op === "!=") return v !== num;
        return true;
      });
    }
    if (pred === "truthy") return arr.filter(Boolean);
    if (pred === "falsy") return arr.filter((x) => !x);
    return arr;
  },
  map: (arr: unknown, field: unknown) => {
    if (!Array.isArray(arr)) return arr;
    const f = String(field ?? "");
    return arr.map((item) => {
      if (item && typeof item === "object")
        return (item as Record<string, unknown>)[f];
      return undefined;
    });
  },

  // ========== MATH FUNCTIONS ==========
  percent: (value: unknown, total: unknown) => {
    const v = Number(value);
    const t = Number(total);
    if (!t) return 0;
    return (v / t) * 100;
  },
  median: (arr: unknown) => {
    if (!Array.isArray(arr) || !arr.length) return 0;
    const sorted = [...arr].map(Number).sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 !== 0) return sorted[mid];
    const left = sorted[mid - 1];
    const right = sorted[mid];
    if (left === undefined || right === undefined) return 0;
    return (left + right) / 2;
  },
  roundTo: (value: unknown, decimals: unknown) => {
    const num = Number(value);
    const dec = decimals === undefined ? 0 : Number(decimals);
    const f = 10 ** dec;
    return Math.round(num * f) / f;
  },
  clamp: (value: unknown, min: unknown, max: unknown) => {
    const v = Number(value);
    const mn = Number(min);
    const mx = Number(max);
    return Math.min(Math.max(v, mn), mx);
  },
  random: (min: unknown, max: unknown) => {
    const mn = Math.ceil(Number(min));
    const mx = Math.floor(Number(max));
    return Math.floor(Math.random() * (mx - mn + 1)) + mn;
  },
};

const getValue = (path: string, ctx: MacroContext): unknown => {
  const parts = path.split(".").map((p) => p.trim());
  let v: unknown = ctx;
  for (const p of parts) {
    if (v === null || v === undefined) return undefined;
    v = (v as Record<string, unknown>)[p];
  }
  return v;
};

class ExprParser {
  private pos = 0;
  constructor(
    private readonly src: string,
    private readonly ctx: MacroContext,
  ) {}

  eof(): boolean {
    return this.pos >= this.src.length;
  }

  skipWhitespace(): void {
    while (this.pos < this.src.length && /\s/.test(this.src[this.pos]!))
      this.pos++;
  }

  peek(): string | undefined {
    return this.src[this.pos];
  }

  private stopChar(): boolean {
    const c = this.peek();
    if (c === undefined) return true;
    if (c === "," || c === ")" || c === "]") return true;
    return false;
  }

  parseTernary(): unknown {
    const cond = this.parseOr();
    this.skipWhitespace();
    if (this.peek() === "?") {
      this.pos++;
      const a = this.parseTernary();
      this.skipWhitespace();
      if (this.peek() !== ":") throw new Error("三元表达式缺少 :");
      this.pos++;
      const b = this.parseTernary();
      return cond ? a : b;
    }
    return cond;
  }

  parseOr(): unknown {
    let left = this.parseAnd();
    while (!this.eof()) {
      this.skipWhitespace();
      if (this.peek() !== "|") break;
      this.pos++;
      if (this.peek() !== "|") throw new Error("期望 |");
      this.pos++;
      const right = this.parseAnd();
      left = left || right;
    }
    return left;
  }

  parseAnd(): unknown {
    let left = this.parseCmp();
    while (!this.eof()) {
      this.skipWhitespace();
      if (this.peek() !== "&") break;
      this.pos++;
      if (this.peek() !== "&") throw new Error("期望 &");
      this.pos++;
      const right = this.parseCmp();
      left = left && right;
    }
    return left;
  }

  parseCmp(): unknown {
    let left = this.parseAdd();
    while (!this.eof()) {
      this.skipWhitespace();
      if (this.stopChar()) break;
      const rest = this.src.slice(this.pos);
      let op: string | null = null;
      let opLen = 0;
      if (rest.startsWith("===")) {
        op = "===";
        opLen = 3;
      } else if (rest.startsWith("!==")) {
        op = "!==";
        opLen = 3;
      } else if (rest.startsWith("==")) {
        op = "==";
        opLen = 2;
      } else if (rest.startsWith("!=")) {
        op = "!=";
        opLen = 2;
      } else if (rest.startsWith(">=")) {
        op = ">=";
        opLen = 2;
      } else if (rest.startsWith("<=")) {
        op = "<=";
        opLen = 2;
      } else if (rest.startsWith(">")) {
        op = ">";
        opLen = 1;
      } else if (rest.startsWith("<")) {
        op = "<";
        opLen = 1;
      }
      if (!op) break;
      this.pos += opLen;
      const right = this.parseAdd();
      switch (op) {
        case "==":
          left = left === right;
          break;
        case "===":
          left = left === right;
          break;
        case "!=":
          left = left !== right;
          break;
        case "!==":
          left = left !== right;
          break;
        case ">":
          left = Number(left) > Number(right);
          break;
        case "<":
          left = Number(left) < Number(right);
          break;
        case ">=":
          left = Number(left) >= Number(right);
          break;
        case "<=":
          left = Number(left) <= Number(right);
          break;
      }
    }
    return left;
  }

  parseAdd(): unknown {
    let left = this.parseMul();
    while (!this.eof()) {
      this.skipWhitespace();
      if (this.stopChar()) break;
      const c = this.peek()!;
      if (c !== "+" && c !== "-") break;
      if (c === "-" && this.isUnaryPosition()) break;
      this.pos++;
      const right = this.parseMul();
      if (c === "+") {
        left =
          typeof left === "string" || typeof right === "string"
            ? String(left ?? "") + String(right ?? "")
            : Number(left) + Number(right);
      } else {
        left = Number(left) - Number(right);
      }
    }
    return left;
  }

  parseMul(): unknown {
    let left = this.parseUnary();
    while (!this.eof()) {
      this.skipWhitespace();
      if (this.stopChar()) break;
      const c = this.peek()!;
      if (c !== "*" && c !== "/" && c !== "%") break;
      this.pos++;
      const right = this.parseUnary();
      if (c === "*") left = Number(left) * Number(right);
      else if (c === "/") left = Number(left) / Number(right);
      else left = Number(left) % Number(right);
    }
    return left;
  }

  parseUnary(): unknown {
    this.skipWhitespace();
    const c = this.peek();
    if (c === "!") {
      this.pos++;
      return !this.parseUnary();
    }
    if (c === "-") {
      this.pos++;
      return -Number(this.parseUnary());
    }
    return this.parsePrimary();
  }

  parsePrimary(): unknown {
    this.skipWhitespace();
    if (this.eof()) throw new Error("意外的表达式结尾");
    const c = this.peek()!;
    if (c === "(") {
      this.pos++;
      const v = this.parseTernary();
      this.skipWhitespace();
      if (this.peek() !== ")") throw new Error("期望 )");
      this.pos++;
      return v;
    }
    if (c === "'" || c === '"') {
      return this.parseString();
    }
    if (/\d/.test(c) || c === "-" || c === "+") {
      if (c === "-" || c === "+") {
        this.pos++;
        const num = this.parseNumber();
        return c === "-" ? -num : num;
      }
      return this.parseNumber();
    }
    if (/[A-Za-z_$]/.test(c)) {
      const start = this.pos;
      while (
        this.pos < this.src.length &&
        /[A-Za-z0-9_$]/.test(this.src[this.pos]!)
      )
        this.pos++;
      const name = this.src.slice(start, this.pos);
      if (name === "true") return true;
      if (name === "false") return false;
      if (name === "null") return null;
      if (name === "undefined") return undefined;
      this.pos = start;
      return this.parseIdentOrFunc();
    }
    throw new Error(`意外的字符:${c}`);
  }

  private parseString(): string {
    const quote = this.peek()!;
    this.pos++;
    let s = "";
    while (this.pos < this.src.length && this.peek() !== quote) {
      s += this.src[this.pos];
      this.pos++;
    }
    if (this.peek() !== quote) throw new Error("未结束的字符串");
    this.pos++;
    return s;
  }

  private parseNumber(): number {
    const start = this.pos;
    while (this.pos < this.src.length && /[\d.]/.test(this.src[this.pos]!))
      this.pos++;
    return Number(this.src.slice(start, this.pos));
  }

  private parseIdentOrFunc(): unknown {
    const start = this.pos;
    while (
      this.pos < this.src.length &&
      /[A-Za-z0-9_$.]/.test(this.src[this.pos]!)
    )
      this.pos++;
    const name = this.src.slice(start, this.pos);
    this.skipWhitespace();
    if (this.peek() === "(") {
      if (!(name in FUNCTIONS)) throw new Error(`未知函数:${name}`);
      this.pos++;
      const args: unknown[] = [];
      this.skipWhitespace();
      if (this.peek() !== ")") {
        while (true) {
          args.push(this.parseTernary());
          this.skipWhitespace();
          if (this.peek() === ",") {
            this.pos++;
            continue;
          }
          break;
        }
      }
      if (this.peek() !== ")") throw new Error("期望 )");
      this.pos++;
      return (FUNCTIONS[name] as (...a: unknown[]) => unknown)(...args);
    }
    return getValue(name, this.ctx);
  }

  private isUnaryPosition(): boolean {
    return false;
  }
}

export const evaluateExpressionExtended = (
  expr: string,
  ctx: MacroContext,
): unknown => {
  const parser = new ExprParser(expr, ctx);
  const result = parser.parseTernary();
  parser.skipWhitespace();
  if (!parser.eof()) {
    throw new Error(`无法解析表达式:${expr}`);
  }
  return result;
};

const VAR_PATTERN = /\{\{\s*([\s\S]+?)\s*\}\}/g;

const collectVariables = (template: string): string[] => {
  const set = new Set<string>();
  const re = /\{\{\s*([\s\S]+?)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(template)) !== null) {
    const body = m[1]!;
    if (
      body.startsWith("#if") ||
      body.startsWith("#else") ||
      body.startsWith("/if") ||
      body.startsWith("#each") ||
      body.startsWith("/each")
    )
      continue;
    let cleaned = body.replace(/'[^']*'|"[^"]*"/g, "");
    let prev: string;
    do {
      prev = cleaned;
      cleaned = cleaned.replace(/[A-Za-z_$][A-Za-z0-9_$]*\s*\([^()]*\)/g, "");
    } while (cleaned !== prev);
    cleaned = cleaned.replace(/\d+(\.\d+)?/g, "");
    cleaned = cleaned.replace(/[+\-*/%<>=!&|?:(),]/g, " ");
    const idRe = /[A-Za-z_$][A-Za-z0-9_$]*(?:\.[A-Za-z_$][A-Za-z0-9_$]*)*/g;
    let im: RegExpExecArray | null;
    while ((im = idRe.exec(cleaned)) !== null) {
      const id = im[0]!;
      if (id in FUNCTIONS) continue;
      if (
        id === "true" ||
        id === "false" ||
        id === "null" ||
        id === "undefined"
      )
        continue;
      set.add(id);
    }
  }
  return Array.from(set);
};

const expandBlockIf = (
  template: string,
  ctx: MacroContext,
): { text: string; error?: string } => {
  const re =
    /\{\{#if\s+([\s\S]+?)\}\}([\s\S]*?)(?:\{\{#else\}\}([\s\S]*?))?\{\{\/if\}\}/g;
  let error: string | undefined;
  const out = template.replace(
    re,
    (_m: string, cond: string, a: string, b?: string) => {
      try {
        const v = evaluateExpressionExtended(cond, ctx);
        return v ? a : (b ?? "");
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
        return "";
      }
    },
  );
  return { text: out, error };
};

const expandBlockEach = (
  template: string,
  ctx: MacroContext,
): { text: string; error?: string } => {
  const re =
    /\{\{#each\s+([\s\S]+?)\s+as\s+([\s\S]+?)\}\}([\s\S]*?)\{\{\/each\}\}/g;
  let error: string | undefined;
  const out = template.replace(
    re,
    (_m: string, listPath: string, itemName: string, body: string) => {
      try {
        const list = getValue(listPath, ctx);
        if (!Array.isArray(list)) return "";
        return list
          .map((item) => {
            const subCtx = { ...ctx, [itemName]: item };
            const replaced = body.replace(VAR_PATTERN, (_, expr: string) => {
              try {
                return String(evaluateExpressionExtended(expr, subCtx) ?? "");
              } catch {
                return "";
              }
            });
            return replaced;
          })
          .join("");
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
        return "";
      }
    },
  );
  return { text: out, error };
};

export const renderMacroExtended = (
  template: string,
  ctx: MacroContext,
): MacroResult => {
  if (!template) return { ok: true, text: "" };
  try {
    let text = template;
    const ifRes = expandBlockIf(text, ctx);
    if (ifRes.error) return { ok: false, text: text, error: ifRes.error };
    text = ifRes.text;
    const eachRes = expandBlockEach(text, ctx);
    if (eachRes.error) return { ok: false, text, error: eachRes.error };
    text = eachRes.text;
    const computed: Record<string, unknown> = {};
    text = text.replace(VAR_PATTERN, (_m: string, expr: string) => {
      try {
        const v = evaluateExpressionExtended(expr, ctx);
        if (
          typeof v === "string" ||
          typeof v === "number" ||
          typeof v === "boolean"
        ) {
          computed[expr] = v;
          return String(v);
        }
        return JSON.stringify(v);
      } catch (e) {
        return `<<ERROR:${e instanceof Error ? e.message : String(e)}>>`;
      }
    });
    const variables = collectVariables(template);
    return { ok: true, text, variables, computed };
  } catch (e) {
    return {
      ok: false,
      text: template,
      error: e instanceof Error ? e.message : String(e),
    };
  }
};

export const evaluateExpression = evaluateExpressionExtended;
export const renderMacro = renderMacroExtended;

export { FUNCTIONS as EXTENDED_FUNCTIONS };

export const SAMPLE_TEMPLATE_EXTENDED = `检查日期:{{date("YYYY-MM-DD")}}
患者:{{patientName()}}({{patientGender()}}/{{patientAge()}}岁)
BMI:{{patientBMI(patient.weight, patient.height) | roundTo(1)}}
检查号:{{study.accession}}
设备:{{device.name}}
检查模态:{{modalityLabel(exam.modality)}}
检查部位:{{bodyPartLabel(exam.bodyPart)}}

影像所见:
{{#each items as item}}
- {{item.name}}:{{item.finding}}
{{/each}}

{{#if patient.age >= 18}}
成人检查方案
{{#else}}
未成年,建议结合儿科会诊
{{/if}}

报告医师:{{report.signedBy}}
质量评分:{{kpiFormat(report.qualityScore, 0)}} / 100
`;
