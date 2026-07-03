import { describe, it, expect } from "vitest";
import { mergeLayers, validate } from "../loader";
import { z } from "zod";

describe("mergeLayers", () => {
  it("returns defaults when no override or patch", () => {
    const m = mergeLayers({ defaults: { a: 1, b: 2 } });
    expect(m).toEqual({ a: 1, b: 2 });
  });

  it("overrides simple fields", () => {
    const m = mergeLayers({ defaults: { a: 1, b: 2 }, override: { b: 99 } });
    expect(m).toEqual({ a: 1, b: 99 });
  });

  it("patches override the override", () => {
    const m = mergeLayers({ defaults: { a: 1 }, override: { a: 2 }, patch: { a: 3 } });
    expect(m.a).toBe(3);
  });

  it("replaces arrays, does not concat", () => {
    const m = mergeLayers({ defaults: { xs: [1, 2, 3] }, override: { xs: [9] } });
    expect(m.xs).toEqual([9]);
  });

  it("deep-merges nested objects", () => {
    const m = mergeLayers({
      defaults: { a: { x: 1, y: 2 } },
      override: { a: { y: 99, z: 3 } },
    });
    expect(m.a).toEqual({ x: 1, y: 99, z: 3 });
  });
});

describe("validate", () => {
  it("returns ok for valid input", () => {
    const schema = z.object({ x: z.number() });
    const r = validate(schema, { x: 1 });
    expect(r.ok).toBe(true);
  });
  it("returns ok=false on missing field", () => {
    const schema = z.object({ x: z.number() });
    const r = validate(schema, {});
    expect(r.ok).toBe(false);
  });
});