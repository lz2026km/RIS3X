// [v3.0.6.16-7] 表格批量选择导出: 将选中行 (DataTable bulkActions 的 selectedRows)
// 导出为前端生成的 CSV。仅导出标量字段, 列顺序取首行键序, 不依赖后端。
export function exportRowsToCsv(
  rows: ReadonlyArray<object>,
  fileName = "selection",
): void {
  if (!rows || rows.length === 0) return;
  const record = rows[0] as Record<string, unknown>;
  const keys = Object.keys(record).filter((key) => {
    const value = record[key];
    return (
      value === null || ["string", "number", "boolean"].includes(typeof value)
    );
  });
  const esc = (value: unknown): string =>
    `"${String(value ?? "").replace(/"/g, '""')}"`;
  const csv = [
    keys.join(","),
    ...(rows as ReadonlyArray<Record<string, unknown>>).map((row) =>
      keys.map((key) => esc(row[key])).join(","),
    ),
  ].join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${fileName}-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default exportRowsToCsv;
