export { PageHeader } from "./PageHeader";
export type { PageHeaderProps, PageHeaderVariant } from "./PageHeader";
// [UI-5] 专业应用外壳 + 统一卡片 / 页面模板
export { BrandMark } from "./BrandMark";
export type { BrandMarkProps } from "./BrandMark";
export { Card } from "./Card";
export type { CardProps, CardVariant, CardPadding } from "./Card";
export { PageTemplate } from "./PageTemplate";
export type { PageTemplateProps } from "./PageTemplate";
export { PageContainer } from "./PageContainer";
export type {
  PageContainerProps,
  PageBackground,
  PageMaxWidth,
} from "./PageContainer";
export { StatCard, StatCardGrid } from "./StatCard";
export type { StatCardProps, StatCardVariant } from "./StatCard";
export { SectionDivider } from "./SectionDivider";
export type { SectionDividerProps, SectionDividerVariant } from "./SectionDivider";
// [UI-D v3.0.6.13-0] 页面区块垂直节奏原语
export { PageSection } from "./PageSection";
export type { PageSectionProps } from "./PageSection";
export { TabBar } from "./TabBar";
export { FilterBar } from "./FilterBar";
export { PermissionGate } from "./PermissionGate";
export { AppModal } from "./AppModal";
export type { AppModalProps } from "./AppModal";
export { AppDrawer } from "./AppDrawer";
export type { AppDrawerProps, DrawerPlacement } from "./AppDrawer";
export { AppButton } from "./AppButton";
export type {
  AppButtonProps,
  AppButtonSize,
  AppButtonVariant,
} from "./AppButton";
// [v3.0.6.11-103 Wave 7] 按钮/表单/模态/三态 规范组件
export { ActionButton, ACTION_ICONS, ACTION_VARIANTS } from "./ActionButton";
export type { ActionButtonProps, StandardAction } from "./ActionButton";
export { FormField, FormSubmitBar, FORM_LAYOUT, FORM_LABEL_WIDTH } from "./FormField";
export type { FormFieldProps, FormSubmitBarProps } from "./FormField";
export { StateView } from "./StateView";
export type { StateViewProps } from "./StateView";
// [v3.0.6.8-26] UI 标准化新增组件
export { StickyActionBar } from "./StickyActionBar";
export type {
  StickyActionBarProps,
  StickyActionBarAction,
  StickyActionBarVariant,
  StickyActionBarTheme,
} from "./StickyActionBar";
export { ExportButton } from "./ExportButton";
export type { ExportButtonProps, ExportFormat } from "./ExportButton";
export { BackButton } from "./BackButton";
export type { BackButtonProps, BackButtonVariant, BackButtonSize } from "./BackButton";
// [v3.0.6.11-100 Wave 5A] UI 组件化新增
export { AppText } from "./AppText";
export type { AppTextProps, AppTextSize, AppTextWeight, AppTextColor } from "./AppText";
export { THEME_TOKENS, useThemeColors } from "./ThemeTokens";
export type { ThemeTokens } from "./ThemeTokens";
export { VirtualTable } from "./VirtualTable";
export type { VirtualTableProps } from "./VirtualTable";
// [UI-A v3.0.6.13-0] 统一数据表格 (裸 Table 迁移目标)
export { DataTable, DEFAULT_TABLE_PAGE_SIZE, TABLE_PAGE_SIZE_OPTIONS } from "./DataTable";
export type { DataTableProps, TableDensity } from "./DataTable";
export { EmptyState } from "./EmptyState";
export type { EmptyStateProps, EmptyStateType } from "./EmptyState";
export type { StatCardColor, StatCardTrend } from "./StatCard";
export type { PageHeaderSize, PageHeaderAlign, PageHeaderCrumb } from "./PageHeader";
// [v3.0.6.11-103 Wave 5] 放射专属图标集 + 专业主题包
export * from "../icons/radiologyIcons";
export type { RadiologyIconProps } from "../icons/radiologyIcons";
// [UI-3] 统一状态 / 严重度徽标 (antd Tag + statusTokens)
export { StatusTag } from "./StatusTag";
export type { StatusTagProps, StatusTagSize } from "./StatusTag";
export { SeverityTag } from "./SeverityTag";
export type { SeverityTagProps, SeverityTagSize } from "./SeverityTag";
