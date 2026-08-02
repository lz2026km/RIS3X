/**
 * WindowPresets.ts
 * DICOM窗宽窗位预设表 - 按检查类型+部位分类
 */

// 窗宽窗位预设类型
export interface WindowPreset {
  name: string;
  ww: number; // Window Width
  wc: number; // Window Center (canonical name)
  wl?: number; // @deprecated Use `wc`. Kept for backward compat.
  category: string;
  description?: string;
}

function makePreset(p: Omit<WindowPreset, "wl">): WindowPreset {
  return { ...p, wl: p.wc };
}

const USER_PRESETS_KEY = "ris_user_window_presets";

export function getUserPresets(): WindowPreset[] {
  try {
    const raw = localStorage.getItem(USER_PRESETS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error("[WindowPresets] getUserPresets failed:", err);
    return [];
  }
}

export function saveUserPreset(preset: WindowPreset): void {
  const presets = getUserPresets().filter((p) => p.name !== preset.name);
  presets.push(preset);
  try {
    localStorage.setItem(USER_PRESETS_KEY, JSON.stringify(presets));
  } catch (err) {
    console.error("[WindowPresets] saveUserPreset failed:", err);
  }
}

export function deleteUserPreset(name: string): void {
  const presets = getUserPresets().filter((p) => p.name !== name);
  try {
    localStorage.setItem(USER_PRESETS_KEY, JSON.stringify(presets));
  } catch (err) {
    console.error("[WindowPresets] deleteUserPreset failed:", err);
  }
}

export function updateUserPreset(
  name: string,
  updates: Partial<Omit<WindowPreset, "name">>,
): void {
  const presets = getUserPresets();
  const idx = presets.findIndex((p) => p.name === name);
  if (idx >= 0) {
    presets[idx] = {
      ...presets[idx],
      ...updates,
      wl: updates.wc ?? presets[idx].wc,
    };
    try {
      localStorage.setItem(USER_PRESETS_KEY, JSON.stringify(presets));
    } catch (err) {
      console.error("[WindowPresets] updateUserPreset failed:", err);
    }
  }
}

export function exportUserPresets(): string {
  return JSON.stringify(getUserPresets(), null, 2);
}

export function importUserPresets(json: string): boolean {
  try {
    const parsed = JSON.parse(json) as WindowPreset[];
    if (!Array.isArray(parsed)) return false;
    const valid = parsed.filter(
      (p) => p.name && typeof p.ww === "number" && typeof p.wc === "number",
    );
    localStorage.setItem(USER_PRESETS_KEY, JSON.stringify(valid));
    return true;
  } catch (err) {
    console.error("[WindowPresets] importUserPresets failed:", err);
    return false;
  }
}

// 检查部位类型
export type BodyPart =
  | "HEAD"
  | "CHEST"
  | "ABDOMEN"
  | "SPINE"
  | "LIMB"
  | "PELVIS"
  | "MAMMOGRAPHY"
  | "CARDIAC"
  | "ANGIO"
  | "UNKNOWN";

// 所有窗宽窗位预设
export const WINDOW_PRESETS: WindowPreset[] = [
  // ========== 头部 (HEAD) ==========
  makePreset({
    name: "脑窗",
    ww: 80,
    wc: 40,
    category: "HEAD",
    description: "脑组织窗",
  }),
  makePreset({
    name: "脑出血窗",
    ww: 150,
    wc: 50,
    category: "HEAD",
    description: "脑出血观察窗 (急性出血/对比增强)",
  }),
  makePreset({
    name: "CTA 窗",
    ww: 800,
    wc: 150,
    category: "ANGIO",
    description: "CTA 血管窗 (CT 血管成像)",
  }),
  makePreset({
    name: "PET 融合窗",
    ww: 3000,
    wc: 1000,
    category: "PET",
    description: "PET/CT 融合显示窗",
  }),
  makePreset({
    name: "骨窗",
    ww: 2000,
    wc: 500,
    category: "HEAD",
    description: "颅骨骨窗",
  }),
  makePreset({
    name: "软组织窗",
    ww: 400,
    wc: 40,
    category: "HEAD",
    description: "头部软组织",
  }),

  // ========== 胸部 (CHEST) ==========
  makePreset({
    name: "肺窗",
    ww: 1500,
    wc: -600,
    category: "CHEST",
    description: "肺部纵隔窗",
  }),
  makePreset({
    name: "纵隔窗",
    ww: 400,
    wc: 40,
    category: "CHEST",
    description: "纵隔软组织窗",
  }),
  makePreset({
    name: "骨窗",
    ww: 2000,
    wc: 400,
    category: "CHEST",
    description: "胸部骨骼",
  }),

  // ========== 腹部 (ABDOMEN) ==========
  makePreset({
    name: "肝窗",
    ww: 150,
    wc: 50,
    category: "ABDOMEN",
    description: "肝脏窗",
  }),
  makePreset({
    name: "腹窗",
    ww: 350,
    wc: 50,
    category: "ABDOMEN",
    description: "腹部常规窗",
  }),
  makePreset({
    name: "骨窗",
    ww: 2000,
    wc: 400,
    category: "ABDOMEN",
    description: "腹部骨骼",
  }),

  // ========== 脊柱 (SPINE) ==========
  makePreset({
    name: "脊柱窗",
    ww: 1800,
    wc: 400,
    category: "SPINE",
    description: "脊柱椎体窗",
  }),

  // ========== 四肢 (LIMB) ==========
  makePreset({
    name: "四肢窗",
    ww: 2000,
    wc: 500,
    category: "LIMB",
    description: "四肢骨窗",
  }),

  // ========== 骨盆 (PELVIS) ==========
  makePreset({
    name: "骨盆窗",
    ww: 1800,
    wc: 400,
    category: "PELVIS",
    description: "骨盆窗",
  }),

  // ========== 乳腺 (MAMMOGRAPHY) ==========
  makePreset({
    name: "乳腺窗",
    ww: 400,
    wc: 300,
    category: "MAMMOGRAPHY",
    description: "乳腺钼靶窗",
  }),

  // ========== 心脏 (CARDIAC) ==========
  makePreset({
    name: "心脏窗",
    ww: 350,
    wc: 50,
    category: "CARDIAC",
    description: "心脏增强窗",
  }),

  // ========== 肝脏增强 (LIVER CONTRAST) ==========
  makePreset({
    name: "肝脏增强窗",
    ww: 200,
    wc: 60,
    category: "ABDOMEN",
    description: "肝脏增强扫描窗",
  }),

  // ========== 血管 (ANGIO) ==========
  makePreset({
    name: "血管窗",
    ww: 600,
    wc: 200,
    category: "ANGIO",
    description: "血管造影窗",
  }),

  // ========== 眼眶 (ORBIT) ==========
  makePreset({
    name: "眼眶窗",
    ww: 300,
    wc: 50,
    category: "HEAD",
    description: "眼眶软组织窗",
  }),

  // ========== MR 预设 (MR) ==========
  makePreset({
    name: "MR T1",
    ww: 1200,
    wc: 400,
    category: "MR",
    description: "MRI T1 加权像",
  }),
  makePreset({
    name: "MR T2",
    ww: 1600,
    wc: 600,
    category: "MR",
    description: "MRI T2 加权像",
  }),
  makePreset({
    name: "MR FLAIR",
    ww: 1400,
    wc: 500,
    category: "MR",
    description: "MRI FLAIR 序列",
  }),
  makePreset({
    name: "MR DWI",
    ww: 1000,
    wc: 500,
    category: "MR",
    description: "MRI 弥散加权成像",
  }),
  makePreset({
    name: "MR T1 增强",
    ww: 1200,
    wc: 450,
    category: "MR",
    description: "MRI T1 增强扫描",
  }),
  makePreset({
    name: "MR T2* (SWI)",
    ww: 1400,
    wc: 550,
    category: "MR",
    description: "MRI T2* 磁敏感加权",
  }),
  makePreset({
    name: "MR 脑白质",
    ww: 1600,
    wc: 650,
    category: "MR",
    description: "MRI 脑白质病变专用",
  }),
  makePreset({
    name: "MR 脊柱",
    ww: 1800,
    wc: 700,
    category: "MR",
    description: "MRI 脊柱成像",
  }),
  makePreset({
    name: "MR 关节",
    ww: 1400,
    wc: 500,
    category: "MR",
    description: "MRI 关节软组织",
  }),
  makePreset({
    name: "MR 腹部",
    ww: 1200,
    wc: 400,
    category: "MR",
    description: "MRI 腹部成像",
  }),
  makePreset({
    name: "MR MRA",
    ww: 800,
    wc: 300,
    category: "MR",
    description: "MRI 血管成像",
  }),
  makePreset({
    name: "MR DWI (b1000)",
    ww: 800,
    wc: 400,
    category: "MR",
    description: "MRI DWI b=1000 弥散",
  }),
];

// 根据部位获取预设 (精确 category 匹配, 避免子串误命中)
export function getPresetsByBodyPart(bodyPart: string): WindowPreset[] {
  const normalized = bodyPart.toUpperCase();
  return WINDOW_PRESETS.filter((p) => p.category.toUpperCase() === normalized);
}

// 根据Modality+BodyPart智能推荐预设
export function getRecommendedPresets(
  modality: string,
  bodyPart: string,
): WindowPreset[] {
  const normalizedBodyPart = bodyPart.toUpperCase();

  // CT 默认推荐
  if (modality === "CT") {
    if (
      normalizedBodyPart.includes("HEAD") ||
      normalizedBodyPart.includes("脑")
    ) {
      return WINDOW_PRESETS.filter((p) => p.category === "HEAD");
    }
    if (
      normalizedBodyPart.includes("CHEST") ||
      normalizedBodyPart.includes("胸")
    ) {
      return WINDOW_PRESETS.filter((p) => p.category === "CHEST");
    }
    if (
      normalizedBodyPart.includes("ABDOMEN") ||
      normalizedBodyPart.includes("腹")
    ) {
      return WINDOW_PRESETS.filter((p) => p.category === "ABDOMEN");
    }
    if (
      normalizedBodyPart.includes("SPINE") ||
      normalizedBodyPart.includes("脊柱")
    ) {
      return WINDOW_PRESETS.filter((p) => p.category === "SPINE");
    }
    if (
      normalizedBodyPart.includes("LIMB") ||
      normalizedBodyPart.includes("四肢")
    ) {
      return WINDOW_PRESETS.filter((p) => p.category === "LIMB");
    }
    if (
      normalizedBodyPart.includes("PELVIS") ||
      normalizedBodyPart.includes("骨盆")
    ) {
      return WINDOW_PRESETS.filter((p) => p.category === "PELVIS");
    }
    if (
      normalizedBodyPart.includes("MAMMO") ||
      normalizedBodyPart.includes("乳腺")
    ) {
      return WINDOW_PRESETS.filter((p) => p.category === "MAMMOGRAPHY");
    }
    if (
      normalizedBodyPart.includes("CARDIAC") ||
      normalizedBodyPart.includes("心脏")
    ) {
      return WINDOW_PRESETS.filter(
        (p) => p.category === "CARDIAC" || p.name === "心脏窗",
      );
    }
    if (
      normalizedBodyPart.includes("ANGIO") ||
      normalizedBodyPart.includes("血管")
    ) {
      return WINDOW_PRESETS.filter(
        (p) => p.category === "ANGIO" || p.name === "血管窗",
      );
    }
    if (
      normalizedBodyPart.includes("ORBIT") ||
      normalizedBodyPart.includes("眼眶")
    ) {
      return WINDOW_PRESETS.filter((p) => p.name === "眼眶窗");
    }
  }

  // MR 默认推荐 (normalizedLower 已 toLowerCase, 无需再查大写)
  if (modality === "MR") {
    const normalizedLower = normalizedBodyPart.toLowerCase();
    if (normalizedLower.includes("t1")) {
      return WINDOW_PRESETS.filter(
        (p) => p.category === "MR" && p.name === "MR T1",
      );
    }
    if (normalizedLower.includes("t2")) {
      return WINDOW_PRESETS.filter(
        (p) => p.category === "MR" && p.name === "MR T2",
      );
    }
    if (normalizedLower.includes("flair")) {
      return WINDOW_PRESETS.filter(
        (p) => p.category === "MR" && p.name === "MR FLAIR",
      );
    }
    if (normalizedLower.includes("dwi")) {
      return WINDOW_PRESETS.filter(
        (p) => p.category === "MR" && p.name === "MR DWI",
      );
    }
    return WINDOW_PRESETS.filter((p) => p.category === "MR");
  }

  // PET/PT 默认推荐融合窗
  if (modality === "PET" || modality === "PT") {
    return WINDOW_PRESETS.filter((p) => p.category === "PET");
  }

  // DR/XR 默认推荐骨窗
  if (modality === "DR" || modality === "XR") {
    return WINDOW_PRESETS.filter((p) => p.name === "骨窗");
  }

  // 默认返回常用预设
  return WINDOW_PRESETS.slice(0, 3);
}

// 获取默认窗宽窗位
export function getDefaultWindowPreset(
  modality: string,
  bodyPart: string,
): WindowPreset {
  const presets = getRecommendedPresets(modality, bodyPart);
  return (
    presets[0] ??
    makePreset({ name: "默认", ww: 400, wc: 40, category: "UNKNOWN" })
  );
}

// 标准化BodyPart
export function normalizeBodyPart(bodyPart: string): BodyPart {
  const normalized = bodyPart.toUpperCase();
  if (
    normalized.includes("HEAD") ||
    normalized.includes("脑") ||
    normalized.includes("ORBIT")
  )
    return "HEAD";
  if (
    normalized.includes("CHEST") ||
    normalized.includes("胸") ||
    normalized.includes("CARDIAC")
  )
    return "CHEST";
  if (
    normalized.includes("ABDOMEN") ||
    normalized.includes("腹") ||
    normalized.includes("LIVER")
  )
    return "ABDOMEN";
  if (normalized.includes("SPINE") || normalized.includes("脊柱"))
    return "SPINE";
  if (normalized.includes("LIMB") || normalized.includes("四肢")) return "LIMB";
  if (normalized.includes("PELVIS") || normalized.includes("骨盆"))
    return "PELVIS";
  if (normalized.includes("MAMMO") || normalized.includes("乳腺"))
    return "MAMMOGRAPHY";
  if (normalized.includes("ANGIO") || normalized.includes("血管"))
    return "ANGIO";
  return "UNKNOWN";
}
