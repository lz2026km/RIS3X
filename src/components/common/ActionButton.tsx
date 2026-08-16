/**
 * G005 放射RIS系统 v3.0.6.11-103 Wave 7 - ActionButton
 * 按钮规范: 全站统一动作按钮
 *  - 10 类标准动作 (新建/编辑/删除/刷新/导出/导入/打印/保存/提交/取消)
 *  - 每类动作绑定标准 lucide 16px 图标 + 默认 variant (primary/danger/default)
 *  - 基于 AppButton 封装 (RBAC 权限 / loading / disabledReason Tooltip / focus-visible)
 *
 * 用法:
 *   <ActionButton action="create" onClick={...}>新建检查</ActionButton>
 *   <ActionButton action="delete" danger? onClick={...}>删除</ActionButton>
 *   <ActionButton action="refresh" loading={refreshing}>刷新列表</ActionButton>
 *   icon / variant 可显式覆盖默认值。
 */
import type { ReactNode } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  Download,
  Upload,
  Printer,
  Save,
  Send,
  X,
} from "lucide-react";
import { AppButton, type AppButtonProps, type AppButtonVariant } from "./AppButton";

/** 10 类标准动作类型 */
export type StandardAction =
  | "create"
  | "edit"
  | "delete"
  | "refresh"
  | "export"
  | "import"
  | "print"
  | "save"
  | "submit"
  | "cancel";

/** 标准动作 → 图标 (lucide 16px) */
export const ACTION_ICONS: Record<StandardAction, ReactNode> = {
  create: <Plus size={16} />,
  edit: <Pencil size={16} />,
  delete: <Trash2 size={16} />,
  refresh: <RefreshCw size={16} />,
  export: <Download size={16} />,
  import: <Upload size={16} />,
  print: <Printer size={16} />,
  save: <Save size={16} />,
  submit: <Send size={16} />,
  cancel: <X size={16} />,
};

/** 标准动作 → 默认 variant */
export const ACTION_VARIANTS: Record<StandardAction, AppButtonVariant> = {
  create: "primary",
  edit: "default",
  delete: "danger",
  refresh: "default",
  export: "default",
  import: "default",
  print: "default",
  save: "primary",
  submit: "primary",
  cancel: "default",
};

export interface ActionButtonProps
  extends Omit<AppButtonProps, "icon" | "variant"> {
  /** 标准动作类型 (决定默认图标与 variant) */
  action: StandardAction;
  /** 覆盖默认图标 */
  icon?: ReactNode;
  /** 覆盖默认 variant */
  variant?: AppButtonVariant;
}

export function ActionButton({
  action,
  icon,
  variant,
  ...rest
}: ActionButtonProps) {
  return (
    <AppButton
      variant={variant ?? ACTION_VARIANTS[action]}
      icon={icon ?? ACTION_ICONS[action]}
      {...rest}
    />
  );
}

export default ActionButton;
