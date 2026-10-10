/**
 * G005 放射RIS系统 v3.0.6.11-103 Wave 7 - FormField / FormSubmitBar / FORM_LAYOUT
 * 表单规范:
 *  - label 右对齐 (labelCol 100px) / 必填红星标准 (红色 * + aria-label="必填")
 *  - 错误提示统一 (红色 12px, 图标 + 文案)
 *  - FormSubmitBar: 提交/取消/重置 标准按钮组 (ActionButton 图标标准)
 *  - FORM_LAYOUT: antd Form 的 labelCol/wrapperCol 标准 (label 100px / 内容余量)
 *
 * 用法 (自定义表单):
 *   <FormField label="患者姓名" required error={formErrors.name}>
 *     <input ... />
 *   </FormField>
 *
 * 用法 (antd Form):
 *   <Form {...FORM_LAYOUT} requiredMark>
 */
import { AlertTriangle } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { ActionButton } from "./ActionButton";

/** 标准 label 宽度 (与 FORM_LAYOUT 保持一致) */
export const FORM_LABEL_WIDTH = 100;

/** antd Form 标准布局: label 100px / 内容余量 */
export const FORM_LAYOUT = {
  labelCol: { flex: `${FORM_LABEL_WIDTH}px` },
  wrapperCol: { flex: "auto" },
};

export interface FormFieldProps {
  label: ReactNode;
  /** 必填红星 */
  required?: boolean;
  /** 字段错误文案 (统一红色提示) */
  error?: ReactNode;
  /** 字段说明 (次要灰字) */
  hint?: ReactNode;
  /** 关联 input id */
  htmlFor?: string;
  /** label 宽度, 默认 100 (label 右对齐) */
  labelWidth?: number;
  /** 布局: 水平 (label 右对齐) | 垂直 */
  layout?: "horizontal" | "vertical";
  style?: CSSProperties;
  testId?: string;
  children: ReactNode;
}

/**
 * 统一表单字段包装: label 右对齐 + 必填红星 + 错误提示 + 控制
 */
export function FormField({
  label,
  required = false,
  error,
  hint,
  htmlFor,
  labelWidth = FORM_LABEL_WIDTH,
  layout = "horizontal",
  style,
  testId,
  children,
}: FormFieldProps) {
  const isHorizontal = layout === "horizontal";
  const fieldStyle: CSSProperties = isHorizontal
    ? { display: "flex", alignItems: "flex-start", gap: 'var(--space-3, 12px)' }
    : { display: "flex", flexDirection: "column", gap: 'var(--space-1, 4px)' };

  return (
    <div style={{ ...fieldStyle, ...style }} data-testid={testId}>
      <label
        htmlFor={htmlFor}
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: "#334155",
          lineHeight: 1.6,
          textAlign: isHorizontal ? "right" : "left",
          flexShrink: 0,
          ...(isHorizontal ? { width: labelWidth } : undefined),
        }}
      >
        {label}
        {required && (
          <span aria-label="必填" style={{ color: "var(--color-error-500)", marginLeft: 2 }}>
            *
          </span>
        )}
      </label>
      <div style={{ flex: 1, minWidth: 0 }}>
        {children}
        {hint && !error && (
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 'var(--space-1, 4px)' }}>
            {hint}
          </div>
        )}
        {error && (
          <div
            role="alert"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 'var(--space-1, 4px)',
              marginTop: 'var(--space-1, 4px)',
              color: "var(--color-error-500)",
              fontSize: 12,
              lineHeight: 1.5,
            }}
          >
            <AlertTriangle size={12} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export interface FormSubmitBarProps {
  /** 提交回调 (主按钮, action="submit") */
  onSubmit?: () => void;
  /** 取消回调 (次按钮, action="cancel") */
  onCancel?: () => void;
  /** 重置回调 (文本按钮, action="refresh") */
  onReset?: () => void;
  submitting?: boolean;
  submitDisabled?: boolean;
  submitText?: string;
  cancelText?: string;
  resetText?: string;
  /** 按钮尺寸 */
  size?: "compact" | "default" | "tall";
  align?: "left" | "right" | "center";
  style?: CSSProperties;
}

/**
 * 表单提交按钮组: 重置(可选) + 取消 + 提交 标准组合
 */
export function FormSubmitBar({
  onSubmit,
  onCancel,
  onReset,
  submitting = false,
  submitDisabled = false,
  submitText = "提交",
  cancelText = "取消",
  resetText = "重置",
  size = "default",
  align = "right",
  style,
}: FormSubmitBarProps) {
  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        justifyContent:
          align === "left" ? "flex-start" : align === "center" ? "center" : "flex-end",
        ...style,
      }}
    >
      {onReset && (
        <ActionButton action="refresh" variant="text" size={size} onClick={onReset}>
          {resetText}
        </ActionButton>
      )}
      {onCancel && (
        <ActionButton action="cancel" size={size} onClick={onCancel}>
          {cancelText}
        </ActionButton>
      )}
      {onSubmit && (
        <ActionButton
          action="submit"
          size={size}
          loading={submitting}
          disabled={submitDisabled}
          onClick={onSubmit}
        >
          {submitText}
        </ActionButton>
      )}
    </div>
  );
}

export default FormField;
