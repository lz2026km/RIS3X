import { describe, it, expect } from "vitest";
import { gradingScalesModuleSchema, gradingScaleSchema, gradingScaleMetadataSchema } from "../modules/gradingScales.schema";

describe("gradingScales schema", () => {
  it("accepts a full scale with options", () => {
    const r = gradingScalesModuleSchema.safeParse({
      version: 1,
      scales: [
        {
          id: "gs-001",
          name: "DR",
          fullName: "DR International",
          category: "DR",
          description: "International DR grading",
          options: [
            { grade: "0", value: 0, label: "None", description: "no DR" },
            { grade: "1", value: 1, label: "Mild", description: "mild NPDR" },
          ],
        },
      ],
    });
    expect(r.success).toBe(true);
  });

  it("rejects duplicate grade within options", () => {
    const r = gradingScaleSchema.safeParse({
      id: "gs-x",
      name: "Test",
      fullName: "Test Scale",
      category: "Test",
      description: "Test",
      options: [
        { grade: "A", value: 0, label: "A", description: "a" },
        { grade: "A", value: 1, label: "B", description: "b" },
      ],
    });
    expect(r.success).toBe(false);
  });

  it("accepts empty metadata list (default)", () => {
    const r = gradingScalesModuleSchema.safeParse({
      version: 1,
      scales: [
        { id: "g", name: "n", fullName: "f", category: "c", description: "d", options: [{ grade: "0", value: 0, label: "l", description: "x" }] },
      ],
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.metadata).toEqual([]);
  });

  it("accepts metadata entries", () => {
    const r = gradingScaleMetadataSchema.safeParse({
      id: "gs-101",
      name: "DR",
      abbreviation: "ICDR",
      levels: 5,
      usedFor: "DR",
      source: "AAO 2017",
      isActive: true,
      lastUpdated: "2025-01-01T00:00:00Z",
    });
    expect(r.success).toBe(true);
  });

  it("rejects missing required fields", () => {
    const r = gradingScalesModuleSchema.safeParse({ version: 1, scales: [] });
    expect(r.success).toBe(false);
  });
});