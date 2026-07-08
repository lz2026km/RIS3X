import { useState, useCallback } from "react";
import {
  DndContext,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Settings, X } from "lucide-react";
import { AppButton } from "./AppButton";

export interface ColumnSetting {
  key: string;
  title: string;
  visible: boolean;
  fixed: "left" | "right" | false;
}

interface ColumnSettingsPanelProps {
  tableId: string;
  columns: { key: string; title: React.ReactNode }[];
  value: ColumnSetting[];
  onChange: (settings: ColumnSetting[]) => void;
}

const STORAGE_PREFIX = "g005-col-settings-";

function loadSaved(tableId: string, fallback: ColumnSetting[]): ColumnSetting[] {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + tableId);
    if (raw) {
      const parsed = JSON.parse(raw) as ColumnSetting[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch { /* ignore */ }
  return fallback;
}

function saveToStorage(tableId: string, settings: ColumnSetting[]) {
  try {
    localStorage.setItem(STORAGE_PREFIX + tableId, JSON.stringify(settings));
  } catch { /* ignore */ }
}

interface SortableItemProps {
  id: string;
  label: string;
  visible: boolean;
  fixed: "left" | "right" | false;
  onToggle: () => void;
  onCycleFixed: () => void;
}

function SortableItem({ id, label, visible, fixed, onToggle, onCycleFixed }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 12px",
        background: isDragging ? "#f0f9ff" : "transparent",
        borderBottom: "1px solid #f1f5f9",
        cursor: "grab",
        userSelect: "none",
        touchAction: "none",
      }}
      {...attributes}
      {...listeners}
    >
      <span style={{ color: "#cbd5e1", fontSize: 12, flexShrink: 0 }}>⠿</span>
      <label
        style={{ flex: 1, fontSize: 12, color: "#334155", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
      >
        <input
          type="checkbox"
          checked={visible}
          onChange={onToggle}
          style={{ cursor: "pointer", accentColor: "#3b82f6" }}
        />
        {label}
      </label>
      <button
        onClick={(e) => { e.stopPropagation(); onCycleFixed(); }}
        title={fixed ? `固定${fixed === "left" ? "左侧" : "右侧"}` : "不固定"}
        style={{
          border: "none",
          background: "none",
          cursor: "pointer",
          padding: "2px 4px",
          fontSize: 10,
          color: fixed ? "#1e40af" : "#94a3b8",
          fontWeight: 600,
          whiteSpace: "nowrap",
        }}
      >
        {fixed === "left" ? "◀" : fixed === "right" ? "▶" : "⇔"}
      </button>
    </div>
  );
}

export function ColumnSettingsPanel({ tableId, columns: _columns, value, onChange }: ColumnSettingsPanelProps) {
  const [open, setOpen] = useState(false);
  const [local, setLocal] = useState<ColumnSetting[]>(() => loadSaved(tableId, value));

  const sync = useCallback(
    (next: ColumnSetting[]) => {
      setLocal(next);
      saveToStorage(tableId, next);
      onChange(next);
    },
    [tableId, onChange],
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = local.findIndex((c) => c.key === active.id);
    const newIndex = local.findIndex((c) => c.key === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    sync(arrayMove(local, oldIndex, newIndex));
  };

  const toggleVisible = (key: string) => {
    sync(local.map((c) => (c.key === key ? { ...c, visible: !c.visible } : c)));
  };

  const cycleFixed = (key: string) => {
    sync(
      local.map((c) =>
        c.key === key
          ? { ...c, fixed: c.fixed === false ? "left" : c.fixed === "left" ? "right" : false }
          : c,
      ),
    );
  };

  const handleOpen = () => {
    setLocal(loadSaved(tableId, value));
    setOpen((v) => !v);
  };

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <AppButton variant="text" size="compact" onClick={handleOpen} icon={<Settings size={14} />} style={{ color: "#64748b" }} />
      {open && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 999 }} onClick={() => setOpen(false)} />
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 4px)",
              right: 0,
              zIndex: 1000,
              background: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
              minWidth: 240,
              maxHeight: 360,
              overflow: "auto",
              padding: 4,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "8px 12px",
                borderBottom: "1px solid #e2e8f0",
                fontSize: 13,
                fontWeight: 600,
                color: "#1e293b",
              }}
            >
              <span>列设置</span>
              <button onClick={() => setOpen(false)} style={{ border: "none", background: "none", cursor: "pointer", padding: 2 }}>
                <X size={14} />
              </button>
            </div>
            <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={local.map((c) => c.key)} strategy={verticalListSortingStrategy}>
                {local.map((col) => (
                  <SortableItem
                    key={col.key}
                    id={col.key}
                    label={col.title}
                    visible={col.visible}
                    fixed={col.fixed}
                    onToggle={() => toggleVisible(col.key)}
                    onCycleFixed={() => cycleFixed(col.key)}
                  />
                ))}
              </SortableContext>
            </DndContext>
            <div style={{ padding: "8px 12px", borderTop: "1px solid #e2e8f0", fontSize: 11, color: "#94a3b8" }}>
              拖拽排序 · 勾选显隐 · 点击 ◀▶ 固定列
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default ColumnSettingsPanel;
