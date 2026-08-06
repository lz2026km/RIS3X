/**
 * 日期格式化工具 - G005 统一实现
 * 收敛 pages/* 与 utils/* 中的重复 formatDate/formatTime/formatDateTime 定义
 */

/** ISO 字符串 → YYYY-MM-DD（空值返回 '-'） */
export function formatDate(dt?: string | null): string {
  if (!dt) return '-';
  return dt.slice(0, 10);
}

/** ISO 字符串 → YYYY-MM-DD HH:mm（空值返回 '-'，短串原样返回） */
export function formatDateTime(dt?: string | null): string {
  if (!dt) return '-';
  return dt.length >= 16 ? dt.slice(0, 16) : dt;
}

/** ISO 字符串 → HH:mm（空值返回 '-'） */
export function formatTime(dt?: string | null): string {
  if (!dt) return '-';
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return dt;
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Date → YYYY-MM-DD */
export function formatDateObj(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Date → YYYY-MM-DD HH:mm（zh-CN 本地化） */
export function formatDateTimeObj(date: Date): string {
  return date.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
}
