/**
 * Hooks 统一导出
 * G005 Radiology RIS System
 * v3.0.6.8-23c (A1): 删除 useSidebar 导出(死代码 - 仅 useSidebarItems 局部函数被使用)
 * v3.0.6.10-1: 新增 useSafePagination/useFeatureGate 导出
 */
export { useAuth } from "./useAuth";
export { useWorklistFilter } from "./useWorklistFilter";
export { useReportDraft } from "./useReportDraft";
export { useUrlSync, parseArrayParam, encodeArrayParam } from "./useUrlSync";
export {
  useKeyboardShortcuts,
  getShortcutHint,
  SHORTCUTS,
} from "./useKeyboardShortcuts";
export { useGlobalShortcuts } from "./useGlobalShortcuts";
export {
  useUnsavedChanges,
  UnsavedChangesBanner,
  useFormDirtyState,
} from "./useUnsavedChanges";
export { useQueryParams } from "./useQueryParams";
export { usePagination } from "./usePagination";
export { useSafePagination } from "./useSafePagination";
export type {
  SafePaginationConfig,
  UseSafePaginationOptions,
  UseSafePaginationReturn,
} from "./useSafePagination";
export { useTenant } from "./useTenant";
export { useRBAC } from "./useRBAC";
export { useFeatureGate } from "./useFeatureGate";