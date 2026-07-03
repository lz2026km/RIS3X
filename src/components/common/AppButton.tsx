/**
 * AppButton - 统一按钮封装
 *
 * v3.0.6.8-23c (Stage 2 / Agent A7)
 *  - 封装 antd Button + 自实现 button 混合
 *  - 统一 size / variant / danger / loading / icon / block
 *  - 集成权限校验: permission 缺失时整按钮隐藏
 *  - 集成 type="button" 默认 (避免 form 内意外 submit)
 *  - 集成 :focus-visible 全局焦点环
 *  - 集成 cursor: not-allowed for disabled
 */
import { forwardRef, type ReactNode, type CSSProperties, type MouseEvent } from "react";
import { Button as AntButton } from "antd";
import { Tooltip } from "antd";
import type { ButtonProps as AntButtonProps } from "antd";
import { useRBAC, type Permission } from "../../hooks/useRBAC";

export type AppButtonSize = "compact" | "default" | "tall";
export type AppButtonVariant =
  | "primary"
  | "default"
  | "danger"
  | "dashed"
  | "link"
  | "text";

const SIZE_MAP: Record<AppButtonSize, AntButtonProps["size"]> = {
  compact: "small",
  default: "middle",
  tall: "large",
};

const PADDING_MAP: Record<AppButtonSize, string> = {
  compact: "4px 10px",
  default: "6px 14px",
  tall: "8px 18px",
};

const FONT_SIZE_MAP: Record<AppButtonSize, number> = {
  compact: 12,
  default: 13,
  tall: 14,
};

export interface AppButtonProps
  extends Omit<AntButtonProps, "size" | "type" | "danger" | "variant" | "htmlType"> {
  variant?: AppButtonVariant;
  size?: AppButtonSize;
  /** 权限码; 不通过则整按钮隐藏 (PermissionGate 行为) */
  permission?: Permission | string;
  /** 权限缺失时渲染的 fallback */
  permissionFallback?: ReactNode;
  /** 显示 loading 态 */
  loading?: boolean;
  /** 图标 (lucide-react 图标节点) */
  icon?: ReactNode;
  /** 是否占满父容器宽度 */
  block?: boolean;
  /** 自定义 style, 与变体样式合并 */
  style?: CSSProperties;
  /** 自定义类名 */
  className?: string;
  /** 子节点 (文本) */
  children?: ReactNode;
  /** 点击事件 */
  onClick?: (e: MouseEvent<HTMLElement>) => void;
  /** 涓轰粈涓堝喅瀹氬～鐣?鍦?Tooltip 涓噸鏄庝负浣曢棴鐒?*/
  disabledReason?: string;
  /** HTML button type (form submit/reset) - 灏?variant 鐨?type 绛栫暐鏄犲皠 */
  htmlType?: 'button' | 'submit' | 'reset';
  /** 娴嬭瘯 ID */
  testId?: string;
}

/**
 * 将 variant 映射为 antd type + 配色覆写
 */
function resolveVariantStyle(variant: AppButtonVariant): CSSProperties {
  switch (variant) {
    case "primary":
      return {
        background: "var(--c-primary, #1e40af)",
        borderColor: "var(--c-primary, #1e40af)",
        color: "#fff",
      };
    case "danger":
      return {
        background: "var(--c-danger, #ef4444)",
        borderColor: "var(--c-danger, #ef4444)",
        color: "#fff",
      };
    case "default":
      return {
        background: "#fff",
        borderColor: "var(--c-border, #e2e8f0)",
        color: "var(--c-text, #1e293b)",
      };
    case "dashed":
      return {
        background: "#fff",
        borderColor: "var(--c-border, #e2e8f0)",
        borderStyle: "dashed",
        color: "var(--c-text, #1e293b)",
      };
    case "link":
      return {
        background: "transparent",
        borderColor: "transparent",
        color: "var(--c-primary, #1e40af)",
        padding: "4px 6px",
      };
    case "text":
      return {
        background: "transparent",
        borderColor: "transparent",
        color: "var(--c-text, #475569)",
      };
    default:
      return {};
  }
}

export const AppButton = forwardRef<HTMLElement, AppButtonProps>(
  function AppButton(props, ref) {
    const {
      variant = "default",
      size = "default",
      permission,
      permissionFallback = null,
      loading = false,
      icon,
      block = false,
      style,
      className,
      children,
      disabled,
      onClick,
      htmlType: type,
      testId,
      disabledReason,
      ...rest
    } = props;

    const { can } = useRBAC();

    if (permission && !can(permission as Permission)) {
      return <>{permissionFallback}</>;
    }

    const sizeKey = SIZE_MAP[size];
    const isLink = variant === "link";
    const isText = variant === "text";
    const isDanger = variant === "danger";
    const isPrimary = variant === "primary";

    const antType: AntButtonProps["type"] = isPrimary
      ? "primary"
      : isLink
        ? "link"
        : isText
          ? "text"
          : isDanger
            ? "primary"
            : variant === "dashed"
              ? "dashed"
              : "default";

    const variantStyle = resolveVariantStyle(variant);
    const mergedStyle: CSSProperties = {
      padding: PADDING_MAP[size],
      fontSize: FONT_SIZE_MAP[size],
      fontWeight: 600,
      borderRadius: 8,
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      cursor: disabled || loading ? "not-allowed" : "pointer",
      width: block ? "100%" : undefined,
      justifyContent: block ? "center" : "center",
      transition: "background 0.15s, border-color 0.15s, color 0.15s",
      ...variantStyle,
      ...style,
    };

    const isDisabled = !!(disabled || loading);
    const showDisabledTip = isDisabled && !!disabledReason;

    const innerButton = (
      <AntButton
        ref={ref as any}
        type={antType}
        size={sizeKey}
        danger={isDanger}
        loading={loading}
        icon={icon}
        disabled={isDisabled}
        block={block}
        htmlType={(type ?? "button")}
        onClick={onClick}
        style={mergedStyle}
        className={className}
        data-testid={testId}
        {...rest}
      >
        {children}
      </AntButton>
    );

    return showDisabledTip ? (
      <Tooltip title={disabledReason}>
        <span style={ { display: "inline-flex" } }>{innerButton}</span>
      </Tooltip>
    ) : (
      innerButton
    );
  },
);

export default AppButton;