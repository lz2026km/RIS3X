/**
 * UI-2 — Unified medical icon layer.
 *
 * A thin, additive wrapper around `@tabler/icons-react` that:
 *   - enforces one refined outline look: `stroke={1.5}` (Tabler defaults to a
 *     heavier, close-to-filled stroke 2);
 *   - snaps every size to the 14 / 16 / 18 / 20 token ladder (default 16);
 *   - exposes a semantic `MedicalIcon` naming map so clinical pages ask for
 *     `MedicalIcon.patient` / `MedicalIcon.critical` instead of guessing a
 *     library glyph.
 *
 * It deliberately does NOT migrate the existing lucide-react usage — new and
 * touched surfaces opt in, everything else keeps working.
 *
 * Usage:
 *   import { Icon, MedicalIcon, ICON_SIZES } from "@/components/common/Icon";
 *   <Icon icon={MedicalIcon.critical} size="lg" color="#dc2626" />
 *   const Ico = MedicalIcon.patient; <Ico size="sm" />
 */
import type { ComponentType, CSSProperties, SVGProps } from "react";
import {
  IconActivityHeartbeat as TablerActivityHeartbeat,
  IconAlertHexagon as TablerAlertHexagon,
  IconAlertTriangle as TablerAlertTriangle,
  IconArchive as TablerArchive,
  IconBell as TablerBell,
  IconBinaryTree as TablerBinaryTree,
  IconBook as TablerBook,
  IconBroadcast as TablerBroadcast,
  IconBuildingHospital as TablerBuildingHospital,
  IconCalendarEvent as TablerCalendarEvent,
  IconChartBar as TablerChartBar,
  IconChartHistogram as TablerChartHistogram,
  IconChartLine as TablerChartLine,
  IconCircleCheck as TablerCircleCheck,
  IconCircleX as TablerCircleX,
  IconClipboardList as TablerClipboardList,
  IconClock as TablerClock,
  IconDeviceDesktopAnalytics as TablerDeviceDesktopAnalytics,
  IconDeviceHeartMonitor as TablerDeviceHeartMonitor,
  IconDeviceMobile as TablerDeviceMobile,
  IconDownload as TablerDownload,
  IconEdit as TablerEdit,
  IconEye as TablerEye,
  IconFileAnalytics as TablerFileAnalytics,
  IconFileSearch as TablerFileSearch,
  IconFileText as TablerFileText,
  IconFilter as TablerFilter,
  IconFlag as TablerFlag,
  IconGlobe as TablerGlobe,
  IconHeartbeat as TablerHeartbeat,
  IconHome as TablerHome,
  IconInfoCircle as TablerInfoCircle,
  IconKey as TablerKey,
  IconLayoutDashboard as TablerLayoutDashboard,
  IconLink as TablerLink,
  IconLock as TablerLock,
  IconMail as TablerMail,
  IconMedal as TablerMedal,
  IconMessage as TablerMessage,
  IconMessageCircle as TablerMessageCircle,
  IconMicroscope as TablerMicroscope,
  IconNurse as TablerNurse,
  IconPhone as TablerPhone,
  IconPhoto as TablerPhoto,
  IconPhotoScan as TablerPhotoScan,
  IconPill as TablerPill,
  IconPlus as TablerPlus,
  IconPrinter as TablerPrinter,
  IconRefresh as TablerRefresh,
  IconReportMedical as TablerReportMedical,
  IconRobot as TablerRobot,
  IconRosetteDiscountCheck as TablerRosetteDiscountCheck,
  IconScan as TablerScan,
  IconSchool as TablerSchool,
  IconSearch as TablerSearch,
  IconSend as TablerSend,
  IconSettings as TablerSettings,
  IconShare as TablerShare,
  IconShieldCheck as TablerShieldCheck,
  IconShieldLock as TablerShieldLock,
  IconSparkles as TablerSparkles,
  IconStethoscope as TablerStethoscope,
  IconTool as TablerTool,
  IconTrophy as TablerTrophy,
  IconUpload as TablerUpload,
  IconUser as TablerUser,
  IconVideo as TablerVideo,
  IconWifi as TablerWifi,
  IconX as TablerX,
} from "@tabler/icons-react";

/* ------------------------------------------------------------------ */
/* Size tokens                                                         */
/* ------------------------------------------------------------------ */

/** Unified icon size tokens (px). */
export const ICON_SIZES = {
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
} as const;

export type IconSize = keyof typeof ICON_SIZES;
export type IconSizeValue = (typeof ICON_SIZES)[IconSize];

const DEFAULT_STROKE = 1.5;

/* ------------------------------------------------------------------ */
/* Base wrapper                                                        */
/* ------------------------------------------------------------------ */

/** Props accepted by every Tabler icon component (subset we care about). */
export type TablerIconComponent = ComponentType<
  {
    size?: string | number;
    stroke?: string | number;
    color?: string;
    title?: string;
    className?: string;
    style?: CSSProperties;
  } & Omit<SVGProps<SVGSVGElement>, "stroke">
>;

export interface IconProps
  extends Omit<
    SVGProps<SVGSVGElement>,
    "stroke" | "width" | "height" | "ref"
  > {
  /** The Tabler icon component to render. */
  icon: TablerIconComponent;
  /** Token name or explicit pixel value. Defaults to `"md"` (16px). */
  size?: IconSize | number;
  /** Stroke width. Defaults to the refined `1.5`. */
  stroke?: number;
  color?: string;
  title?: string;
}

/** Resolve a size token / number to a pixel value. */
export function resolveIconSize(size: IconSize | number = "md"): number {
  return typeof size === "number" ? size : ICON_SIZES[size];
}

/**
 * Base icon wrapper. Keeps a single visual contract across the app.
 */
export function Icon({
  icon: IconCmp,
  size = "md",
  stroke = DEFAULT_STROKE,
  color = "currentColor",
  title,
  ...rest
}: IconProps) {
  return (
    <IconCmp
      size={resolveIconSize(size)}
      stroke={stroke}
      color={color}
      title={title}
      aria-hidden={title ? undefined : true}
      {...rest}
    />
  );
}

/** Options for `createIcon`. */
export interface CreateIconOptions {
  /** Default size baked into the wrapped component. */
  size?: IconSize | number;
  /** Default stroke baked into the wrapped component. */
  stroke?: number;
}

/** Props of a component produced by `createIcon` (icon already bound). */
export type BoundIconProps = Omit<IconProps, "icon">;

/**
 * Wrap a raw Tabler icon so it picks up `size` / `stroke` token defaults.
 */
export function createIcon(
  Tabler: TablerIconComponent,
  options: CreateIconOptions = {},
): ComponentType<BoundIconProps> {
  const Wrapped = (props: BoundIconProps) => (
    <Icon
      icon={Tabler}
      size={options.size ?? "md"}
      stroke={options.stroke ?? DEFAULT_STROKE}
      {...props}
    />
  );
  Wrapped.displayName = "BoundIcon";
  return Wrapped;
}

/* ------------------------------------------------------------------ */
/* Curated re-exports (unified defaults)                               */
/* ------------------------------------------------------------------ */

export const IconPatient = createIcon(TablerUser);
export const IconDoctor = createIcon(TablerStethoscope);
export const IconNurse = createIcon(TablerNurse);
export const IconTechnician = createIcon(TablerTool);
export const IconExam = createIcon(TablerPhotoScan);
export const IconReport = createIcon(TablerReportMedical);
export const IconReportText = createIcon(TablerFileText);
export const IconCritical = createIcon(TablerAlertTriangle);
export const IconCriticalHex = createIcon(TablerAlertHexagon);
export const IconDevice = createIcon(TablerDeviceHeartMonitor);
export const IconQc = createIcon(TablerRosetteDiscountCheck);
export const IconAi = createIcon(TablerSparkles);
export const IconRobot = createIcon(TablerRobot);
export const IconDicom = createIcon(TablerBinaryTree);
export const IconDrug = createIcon(TablerPill);
export const IconCalendar = createIcon(TablerCalendarEvent);
export const IconSearch = createIcon(TablerSearch);
export const IconSettings = createIcon(TablerSettings);
export const IconImage = createIcon(TablerPhoto);
export const IconUpload = createIcon(TablerUpload);
export const IconDownload = createIcon(TablerDownload);
export const IconShare = createIcon(TablerShare);
export const IconLock = createIcon(TablerLock);
export const IconBell = createIcon(TablerBell);
export const IconChart = createIcon(TablerChartBar);
export const IconStats = createIcon(TablerChartHistogram);
export const IconFinance = createIcon(TablerChartLine);
export const IconCheck = createIcon(TablerCircleCheck);
export const IconClose = createIcon(TablerCircleX);
export const IconX = createIcon(TablerX);
export const IconRefresh = createIcon(TablerRefresh);
export const IconLink = createIcon(TablerLink);
export const IconMail = createIcon(TablerMail);
export const IconPhone = createIcon(TablerPhone);
export const IconMessage = createIcon(TablerMessage);
export const IconMessageCircle = createIcon(TablerMessageCircle);
export const IconVideo = createIcon(TablerVideo);
export const IconEducation = createIcon(TablerSchool);
export const IconBook = createIcon(TablerBook);
export const IconAudit = createIcon(TablerFileAnalytics);
export const IconFileSearch = createIcon(TablerFileSearch);
export const IconSecurity = createIcon(TablerShieldLock);
export const IconShield = createIcon(TablerShieldCheck);
export const IconDashboard = createIcon(TablerLayoutDashboard);
export const IconWorklist = createIcon(TablerClipboardList);
export const IconMicroscope = createIcon(TablerMicroscope);
export const IconMonitor = createIcon(TablerActivityHeartbeat);
export const IconHeartbeat = createIcon(TablerHeartbeat);
export const IconPrint = createIcon(TablerPrinter);
export const IconArchive = createIcon(TablerArchive);
export const IconSend = createIcon(TablerSend);
export const IconEdit = createIcon(TablerEdit);
export const IconFilter = createIcon(TablerFilter);
export const IconPlus = createIcon(TablerPlus);
export const IconInfo = createIcon(TablerInfoCircle);
export const IconHome = createIcon(TablerHome);
export const IconKey = createIcon(TablerKey);
export const IconEye = createIcon(TablerEye);
export const IconGlobe = createIcon(TablerGlobe);
export const IconWifi = createIcon(TablerWifi);
export const IconTrophy = createIcon(TablerTrophy);
export const IconMedal = createIcon(TablerMedal);
export const IconHospital = createIcon(TablerBuildingHospital);
export const IconModality = createIcon(TablerScan);
export const IconBroadcast = createIcon(TablerBroadcast);
export const IconMobile = createIcon(TablerDeviceMobile);
export const IconAnalytics = createIcon(TablerDeviceDesktopAnalytics);
export const IconClock = createIcon(TablerClock);
export const IconFlag = createIcon(TablerFlag);

/* ------------------------------------------------------------------ */
/* Semantic clinical naming map                                        */
/* ------------------------------------------------------------------ */

/**
 * Common clinical concepts → unified icon components.
 * Pages should prefer these names over raw library glyphs.
 */
export const MedicalIcon = {
  patient: IconPatient,
  patients: createIcon(TablerUser),
  doctor: IconDoctor,
  nurse: IconNurse,
  technician: IconTechnician,
  exam: IconExam,
  report: IconReport,
  reportText: IconReportText,
  critical: IconCritical,
  alert: IconCritical,
  device: IconDevice,
  equipment: IconTechnician,
  qc: IconQc,
  quality: IconQc,
  ai: IconAi,
  robot: IconRobot,
  dicom: IconDicom,
  imaging: IconImage,
  image: IconImage,
  drug: IconDrug,
  medication: IconDrug,
  calendar: IconCalendar,
  appointment: IconCalendar,
  search: IconSearch,
  settings: IconSettings,
  upload: IconUpload,
  download: IconDownload,
  share: IconShare,
  lock: IconLock,
  security: IconSecurity,
  bell: IconBell,
  notification: IconBell,
  chart: IconChart,
  stats: IconStats,
  finance: IconFinance,
  revenue: IconFinance,
  check: IconCheck,
  close: IconClose,
  refresh: IconRefresh,
  link: IconLink,
  mail: IconMail,
  email: IconMail,
  phone: IconPhone,
  message: IconMessage,
  sms: IconMessage,
  pager: IconMessage,
  video: IconVideo,
  education: IconEducation,
  audit: IconAudit,
  dashboard: IconDashboard,
  home: IconHome,
  worklist: IconWorklist,
  lab: IconMicroscope,
  monitor: IconMonitor,
  heartbeat: IconHeartbeat,
  print: IconPrint,
  archive: IconArchive,
  send: IconSend,
  edit: IconEdit,
  filter: IconFilter,
  plus: IconPlus,
  info: IconInfo,
  key: IconKey,
  eye: IconEye,
  globe: IconGlobe,
  wifi: IconWifi,
  trophy: IconTrophy,
  medal: IconMedal,
  hospital: IconHospital,
  modality: IconModality,
  broadcast: IconBroadcast,
  mobile: IconMobile,
  analytics: IconAnalytics,
  clock: IconClock,
  flag: IconFlag,
  rank: IconTrophy,
} as const;

export type MedicalIconName = keyof typeof MedicalIcon;

export default Icon;
