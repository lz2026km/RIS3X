import React from "react";
import { Input, Tag, Checkbox } from 'antd';
import { Search } from "lucide-react";
import { MOCK_FINDINGS_LIBRARY } from "../../data/eyeFindingsLibraryMock";

const FindingLibraryPicker: React.FC<{
  value?: string[];
  onChange?: (v: string[]) => void;
}> = ({ value = [], onChange }) => {
  const [search, setSearch] = React.useState("");
  const items = search
    ? MOCK_FINDINGS_LIBRARY.filter(
        (f) => f.name.includes(search) || f.category.includes(search),
      )
    : MOCK_FINDINGS_LIBRARY;
  return (
    <div>
      <Input
        prefix={<Search size={14} />}
        placeholder="搜索征象..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ marginBottom: 6 }}
        size="small"
      />
      <div style={{ maxHeight: 200, overflow: "auto", fontSize: 12 }}>
        {items.slice(0, 30).map((f) => (
          <div
            key={f.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "2px 0",
            }}
          >
            <Checkbox
              checked={value.includes(f.id)}
              onChange={(e) =>
                onChange?.(
                  e.target.checked
                    ? [...value, f.id]
                    : value.filter((v) => v !== f.id),
                )
              }
            />
            <span>{f.name}</span>
            <Tag
              color={
                f.severity === "severe"
                  ? "red"
                  : f.severity === "abnormal"
                    ? "orange"
                    : "green"
              }
              style={{ fontSize: 12 }}
            >
              {f.category.split("-")[0]}
            </Tag>
          </div>
        ))}
      </div>
    </div>
  );
};
export default FindingLibraryPicker;
