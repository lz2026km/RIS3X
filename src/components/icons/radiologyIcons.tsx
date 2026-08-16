/**
 * G005 放射RIS系统 v3.0.6.11-103 Wave 5 - 放射专属图标集
 *
 * 33 个确定性纯函数图标组件 (lucide-react 基础图标组合 + 手绘 SVG):
 *   - 设备类 (10): CT / MR / DR / CR / US / MG / NM / PET / DSA / RF
 *   - 部位类 (6):  头颅 / 胸部 / 腹部 / 脊柱 / 四肢 / 乳腺
 *   - 流程类 (7):  登记 / 摆位 / 扫描 / 重建 / 审阅 / 发布 / 归档
 *   - 状态类 (5):  危急值 / 正常 / 待处理 / 已过期 / 异常
 *   - 补充类 (5):  辐射警示 / X 射线 / 放射医师 / 骨 / 脑
 *
 * 用法: <IconCt size={20} color="#3b82f6" />
 */
import type { FC, ReactNode } from "react";
import {
  Archive,
  AlertTriangle,
  Brain,
  CheckCircle2,
  ClipboardPlus,
  Layers,
  Radiation,
  Send,
} from "lucide-react";

export interface RadiologyIconProps {
  /** 图标尺寸 (px), 默认 24 */
  size?: number;
  /** 描边颜色, 默认 currentColor */
  color?: string;
  /** 描边宽度, 默认 1.8 */
  strokeWidth?: number;
  className?: string;
}

function Svg({
  size = 24,
  color = "currentColor",
  strokeWidth = 1.8,
  className,
  children,
}: RadiologyIconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

/* ============================================================
   设备类 (10) — CT / MR / DR / CR / US / MG / NM / PET / DSA / RF
   ============================================================ */

/** CT 扫描架 (gantry) */
export const IconCt: FC<RadiologyIconProps> = (p) => (
  <Svg {...p}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="5.5" />
    <circle cx="12" cy="12" r="4.5" />
    <path d="M12 9.5v5M9.5 12h5" />
  </Svg>
);

/** MR 磁共振 (bore + 磁体线圈) */
export const IconMr: FC<RadiologyIconProps> = (p) => (
  <Svg {...p}>
    <rect x="2.5" y="7" width="19" height="10" rx="4" />
    <circle cx="12" cy="12" r="2.5" />
    <path d="M5.5 4.5v15M18.5 4.5v15" />
  </Svg>
);

/** DR 数字化 X 线摄影 (球管 + 束线 + 探测器) */
export const IconDr: FC<RadiologyIconProps> = (p) => (
  <Svg {...p}>
    <rect x="4" y="3.5" width="6" height="4.5" rx="1" />
    <circle cx="7" cy="5.75" r="0.7" />
    <path d="M8.5 8l-4.5 10M8.5 8l4.5 10" />
    <path d="M3 18.5h11" />
    <path d="M15.5 6h5.5M15.5 9h3.5" />
  </Svg>
);

/** CR 计算机 X 线摄影 (IP 板) */
export const IconCr: FC<RadiologyIconProps> = (p) => (
  <Svg {...p}>
    <rect x="5" y="2.5" width="14" height="19" rx="2" />
    <circle cx="9" cy="6.5" r="0.9" />
    <path d="M9.5 11h5M9.5 14h5M9.5 17h5" />
  </Svg>
);

/** US 超声探头 (探头 + 声波) */
export const IconUs: FC<RadiologyIconProps> = (p) => (
  <Svg {...p}>
    <path d="M9 3.5h6a2.5 2.5 0 0 1 0 5h-6a2.5 2.5 0 0 1 0-5Z" />
    <path d="M12 8.5v1.5" />
    <path d="M7.5 13.5a4.5 3.2 0 0 0 9 0" />
    <path d="M9.5 17.5a2.5 1.8 0 0 0 5 0" />
  </Svg>
);

/** MG 乳腺摄影 (压迫板 + 乳腺轮廓) */
export const IconMg: FC<RadiologyIconProps> = (p) => (
  <Svg {...p}>
    <path d="M5 4.5h14" />
    <path d="M5 4.5v10" />
    <path d="M9 14.5q3-4 6 0" />
    <path d="M5 14.5h7" />
  </Svg>
);

/** NM 核医学 γ 相机 (探测器 + 准直栅格 + 检查床) */
export const IconNm: FC<RadiologyIconProps> = (p) => (
  <Svg {...p}>
    <rect x="4" y="3" width="16" height="6" rx="1.5" />
    <path d="M4 6h16" />
    <path d="M8 3v6M12 3v6M16 3v6" />
    <path d="M12 9v6" />
    <path d="M5 15h14" />
  </Svg>
);

/** PET 正电子发射断层 (环 + 示踪剂 + 湮灭线) */
export const IconPet: FC<RadiologyIconProps> = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="7" />
    <circle cx="12" cy="12" r="1.6" />
    <path d="M12 5v2.5M12 16.5V19M5 12h2.5M16.5 12H19" />
  </Svg>
);

/** DSA 数字减影血管造影 (血管树) */
export const IconDsa: FC<RadiologyIconProps> = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M9.5 6v5.5L6.5 16" />
    <path d="M9.5 11.5l3 1.5 2.5-4" />
    <path d="M12.5 13l3.5 3.5" />
  </Svg>
);

/** RF 数字胃肠机 (球管 + C 臂 + 监视器) */
export const IconRf: FC<RadiologyIconProps> = (p) => (
  <Svg {...p}>
    <rect x="3.5" y="4" width="5.5" height="4" rx="1" />
    <path d="M6.25 8v8" />
    <path d="M3.5 16.5h5.5" />
    <rect x="12.5" y="4" width="8" height="5.5" rx="1" />
    <path d="M14 5.5h5" />
    <path d="M4 13.5a8 3 0 0 0 16 0" />
  </Svg>
);

/* ============================================================
   部位类 (6) — 头颅 / 胸部 / 腹部 / 脊柱 / 四肢 / 乳腺
   ============================================================ */

/** 头颅 */
export const IconHead: FC<RadiologyIconProps> = (p) => (
  <Svg {...p}>
    <path d="M5 14v-1.5a7 6 0 0 1 14 0V14" />
    <path d="M5 14h14v1.2a6.5 4.2 0 0 1-14 0z" />
    <circle cx="9.5" cy="11" r="1.1" />
    <circle cx="14.5" cy="11" r="1.1" />
    <path d="M12 13v1.8M10.6 14.8h2.8" />
  </Svg>
);

/** 胸部 (双肺 + 气管) */
export const IconChest: FC<RadiologyIconProps> = (p) => (
  <Svg {...p}>
    <path d="M12 4v3.5" />
    <path d="M12 7.5C9.5 5.8 5.5 6.8 5.5 10c0 4.5 2.5 8.5 6.5 9.5" />
    <path d="M12 7.5c2.5-1.7 6.5-.7 6.5 2.5 0 4.5-2.5 8.5-6.5 9.5" />
  </Svg>
);

/** 腹部 */
export const IconAbdomen: FC<RadiologyIconProps> = (p) => (
  <Svg {...p}>
    <ellipse cx="12" cy="12" rx="6.5" ry="8" />
    <path d="M9.5 9.5h5M9.5 12.5h5M9.5 15.5h5" />
  </Svg>
);

/** 脊柱 (椎体序列) */
export const IconSpine: FC<RadiologyIconProps> = (p) => (
  <Svg {...p}>
    <path d="M11.5 3c-3.5 2.5-3.5 15.5 0 18" />
    <path d="M8.5 6.5h3M8.5 9.5h3M8.5 12.5h3M8.5 15.5h3M9 18.5h2.5" />
  </Svg>
);

/** 四肢 (长骨) */
export const IconLimb: FC<RadiologyIconProps> = (p) => (
  <Svg {...p}>
    <path d="M6.5 3.5l9.5 15.5" />
    <circle cx="6.5" cy="3" r="1.6" />
    <circle cx="16" cy="19.5" r="1.6" />
  </Svg>
);

/** 乳腺 (轮廓 + 病灶标记) */
export const IconBreast: FC<RadiologyIconProps> = (p) => (
  <Svg {...p}>
    <path d="M4.5 16h15" />
    <path d="M6.5 16q5.5-11 11 0" />
    <circle cx="9" cy="13" r="1.4" />
  </Svg>
);

/* ============================================================
   流程类 (7) — 登记 / 摆位 / 扫描 / 重建 / 审阅 / 发布 / 归档
   ============================================================ */

/** 登记 (clipboard + plus) */
export const IconRegistration: FC<RadiologyIconProps> = (p) => (
  <ClipboardPlus {...p} />
);

/** 摆位 (检查床患者 + 定位准星) */
export const IconPositioning: FC<RadiologyIconProps> = (p) => (
  <Svg {...p}>
    <path d="M3 18.5h18" />
    <circle cx="6.5" cy="15" r="1.5" />
    <path d="M8 18.5q1.5-3 4-3t4 3" />
    <circle cx="17.5" cy="6.5" r="3.2" />
    <path d="M17.5 1.8v2M17.5 9.2v2M11.8 6.5h2M21.2 6.5h-2" />
  </Svg>
);

/** 扫描 (扫描架 + 扫查线) */
export const IconScanning: FC<RadiologyIconProps> = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="10.5" r="6" />
    <path d="M12 10.5L17 7" />
    <path d="M4.5 19h15" />
    <path d="M8 19v-2h8v2" />
  </Svg>
);

/** 重建 (层叠体块) */
export const IconReconstruction: FC<RadiologyIconProps> = (p) => (
  <Layers {...p} />
);

/** 审阅 (影像 + 观察) */
export const IconReview: FC<RadiologyIconProps> = (p) => (
  <Svg {...p}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
    <path d="M7 15.5l2.5-3 2 2 3-3.5 2.5 2.5" />
    <circle cx="17" cy="8" r="1.2" />
  </Svg>
);

/** 发布 (发送报告) */
export const IconPublish: FC<RadiologyIconProps> = (p) => <Send {...p} />;

/** 归档 */
export const IconArchive: FC<RadiologyIconProps> = (p) => <Archive {...p} />;

/* ============================================================
   状态类 (5) — 危急值 / 正常 / 待处理 / 已过期 / 异常
   ============================================================ */

/** 危急值 */
export const IconCritical: FC<RadiologyIconProps> = (p) => (
  <AlertTriangle {...p} />
);

/** 正常 */
export const IconNormal: FC<RadiologyIconProps> = (p) => (
  <CheckCircle2 {...p} />
);

/** 待处理 */
export const IconPending: FC<RadiologyIconProps> = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
    <circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" />
  </Svg>
);

/** 已过期 */
export const IconExpired: FC<RadiologyIconProps> = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
    <path d="M8.5 15.5l7-7M15.5 15.5l-7-7" />
  </Svg>
);

/** 异常 (脉冲 + 否定) */
export const IconAbnormal: FC<RadiologyIconProps> = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M6.5 13h2l1.5-3 2 5.5 2-6.5 1.5 4h2.5" />
  </Svg>
);

/* ============================================================
   补充类 (5) — 辐射警示 / X 射线 / 放射医师 / 骨 / 脑
   ============================================================ */

/** 辐射警示符号 */
export const IconRadiationSign: FC<RadiologyIconProps> = (p) => (
  <Radiation {...p} />
);

/** X 射线 (靶心准直) */
export const IconXRayBeam: FC<RadiologyIconProps> = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="4.5" />
    <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" />
    <path d="M6.5 6.5l1.5 1.5M17.5 17.5l-1.5-1.5M17.5 6.5L16 8M6.5 17.5l1.5-1.5" />
  </Svg>
);

/** 放射医师 (听诊器) */
export const IconRadiologist: FC<RadiologyIconProps> = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="5.5" r="2.3" />
    <path d="M7 20a5 5 0 0 1 10 0" />
    <path d="M9.8 5.5a2.6 2.6 0 0 0 4.4 0" />
    <path d="M12 8v3.5" />
    <circle cx="12" cy="13.5" r="1.3" />
  </Svg>
);

/** 骨 */
export const IconBone: FC<RadiologyIconProps> = (p) => (
  <Svg {...p}>
    <path d="M6.5 3.5l9.5 15.5" />
    <circle cx="6.5" cy="3" r="1.6" />
    <circle cx="16" cy="19.5" r="1.6" />
  </Svg>
);

/** 脑 */
export const IconBrain: FC<RadiologyIconProps> = (p) => <Brain {...p} />;

/* ============================================================
   导出映射 (供业务按 key 取用)
   ============================================================ */

/** 模态设备 → 图标 */
export const MODALITY_ICON_MAP: Record<string, FC<RadiologyIconProps>> = {
  CT: IconCt,
  MR: IconMr,
  DR: IconDr,
  CR: IconCr,
  US: IconUs,
  MG: IconMg,
  NM: IconNm,
  PET: IconPet,
  DSA: IconDsa,
  RF: IconRf,
  XA: IconDsa,
  DX: IconDr,
};

/** 流程 → 图标 */
export const PROCESS_ICON_MAP: Record<string, FC<RadiologyIconProps>> = {
  register: IconRegistration,
  positioning: IconPositioning,
  scan: IconScanning,
  reconstruct: IconReconstruction,
  review: IconReview,
  publish: IconPublish,
  archive: IconArchive,
};

/** 状态 → 图标 */
export const STATUS_ICON_MAP: Record<string, FC<RadiologyIconProps>> = {
  critical: IconCritical,
  normal: IconNormal,
  pending: IconPending,
  expired: IconExpired,
  abnormal: IconAbnormal,
};

/** 全部图标索引 */
export const RADIOLOGY_ICONS: Record<string, FC<RadiologyIconProps>> = {
  ct: IconCt,
  mr: IconMr,
  dr: IconDr,
  cr: IconCr,
  us: IconUs,
  mg: IconMg,
  nm: IconNm,
  pet: IconPet,
  dsa: IconDsa,
  rf: IconRf,
  head: IconHead,
  chest: IconChest,
  abdomen: IconAbdomen,
  spine: IconSpine,
  limb: IconLimb,
  breast: IconBreast,
  registration: IconRegistration,
  positioning: IconPositioning,
  scanning: IconScanning,
  reconstruction: IconReconstruction,
  review: IconReview,
  publish: IconPublish,
  archive: IconArchive,
  critical: IconCritical,
  normal: IconNormal,
  pending: IconPending,
  expired: IconExpired,
  abnormal: IconAbnormal,
  radiation: IconRadiationSign,
  xray: IconXRayBeam,
  radiologist: IconRadiologist,
  bone: IconBone,
  brain: IconBrain,
};

export default RADIOLOGY_ICONS;
