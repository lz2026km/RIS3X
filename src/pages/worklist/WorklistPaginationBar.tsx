import { useState } from "react";

export default function PaginationBar({ total }: { total: number }) {
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, total);

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderTop: "1px solid #e2e8f0", background: "#f8fafc", fontSize: 12, color: "#64748b", flexWrap: "wrap", gap: 8 }}>
      <span>显示 {start}-{end} / 共 {total} 条</span>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage <= 1} style={{ padding: "4px 10px", border: "1px solid #e2e8f0", borderRadius: 6, background: safePage <= 1 ? "#f1f5f9" : "#fff", color: safePage <= 1 ? "#cbd5e1" : "#475569", cursor: safePage <= 1 ? "not-allowed" : "pointer", fontSize: 12 }}>上一页</button>
        <span style={{ padding: "4px 10px", fontWeight: 600, color: "#1e3a5f", fontVariantNumeric: "tabular-nums" }}>{safePage} / {totalPages}</span>
        <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages} style={{ padding: "4px 10px", border: "1px solid #e2e8f0", borderRadius: 6, background: safePage >= totalPages ? "#f1f5f9" : "#fff", color: safePage >= totalPages ? "#cbd5e1" : "#475569", cursor: safePage >= totalPages ? "not-allowed" : "pointer", fontSize: 12 }}>下一页</button>
      </div>
    </div>
  );
}
