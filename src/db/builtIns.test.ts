import { describe, it, expect } from "vitest";
import {
  BUILT_IN_TYPES,
  LEGACY_SHADOWED_BY,
  filterLegacyShadowedTypes,
} from "./builtIns";

describe("BUILT_IN_TYPES", () => {
  it("seeds the canonical 12-type set including shoulders and abdomen", () => {
    expect(BUILT_IN_TYPES.map((t) => t.id)).toEqual([
      "neck",
      "shoulders",
      "chest",
      "abdomen",
      "waist",
      "hips",
      "left_biceps",
      "right_biceps",
      "left_thigh",
      "right_thigh",
      "left_calf",
      "right_calf",
    ]);
  });

  it("does not seed legacy generic ids on a fresh DB", () => {
    const ids = new Set(BUILT_IN_TYPES.map((t) => t.id));
    for (const legacy of ["hip", "arm", "leg", "thigh", "calf"]) {
      expect(ids.has(legacy)).toBe(false);
    }
  });

  it("orders types so torso comes before limbs and bilateral pairs are adjacent", () => {
    const ordered = [...BUILT_IN_TYPES].sort((a, b) => a.sortOrder - b.sortOrder);
    expect(ordered.map((t) => t.id)).toEqual(BUILT_IN_TYPES.map((t) => t.id));
    // every sortOrder is unique
    const orders = ordered.map((t) => t.sortOrder);
    expect(new Set(orders).size).toBe(orders.length);
  });

  it("marks every built-in as canonical, active, cm-unit", () => {
    for (const t of BUILT_IN_TYPES) {
      expect(t.isBuiltIn).toBe(true);
      expect(t.isActive).toBe(true);
      expect(t.unit).toBe("cm");
    }
  });
});

describe("filterLegacyShadowedTypes", () => {
  type T = { id: string; sortOrder: number };
  const make = (id: string, sortOrder = 0): T => ({ id, sortOrder });

  it("returns canonical-only input unchanged", () => {
    const input = [make("neck"), make("hips"), make("left_biceps")];
    expect(filterLegacyShadowedTypes(input)).toEqual(input);
  });

  it("hides legacy `hip` when canonical `hips` is present", () => {
    const input = [make("hip"), make("hips")];
    const out = filterLegacyShadowedTypes(input);
    expect(out.map((t) => t.id)).toEqual(["hips"]);
  });

  it("hides legacy `arm` when either bilateral biceps id is present", () => {
    const onlyLeft = [make("arm"), make("left_biceps")];
    expect(filterLegacyShadowedTypes(onlyLeft).map((t) => t.id)).toEqual([
      "left_biceps",
    ]);
    const onlyRight = [make("arm"), make("right_biceps")];
    expect(filterLegacyShadowedTypes(onlyRight).map((t) => t.id)).toEqual([
      "right_biceps",
    ]);
  });

  it("hides generic `thigh` when bilateral thigh ids exist", () => {
    const input = [make("thigh"), make("left_thigh"), make("right_thigh")];
    expect(filterLegacyShadowedTypes(input).map((t) => t.id)).toEqual([
      "left_thigh",
      "right_thigh",
    ]);
  });

  it("hides legacy `leg` when any bilateral thigh or calf id exists", () => {
    const input = [make("leg"), make("left_calf")];
    expect(filterLegacyShadowedTypes(input).map((t) => t.id)).toEqual([
      "left_calf",
    ]);
  });

  it("keeps a legacy row when its canonical replacement is absent (defensive)", () => {
    // E.g. a corrupted DB where `hips` was deleted but `hip` remains. We must
    // not strand the user with no selectable hip-region row.
    const input = [make("hip"), make("neck")];
    expect(filterLegacyShadowedTypes(input).map((t) => t.id).sort()).toEqual([
      "hip",
      "neck",
    ]);
  });

  it("preserves input order (no implicit re-sorting)", () => {
    const input = [
      make("right_biceps", 80),
      make("neck", 10),
      make("hips", 60),
    ];
    expect(filterLegacyShadowedTypes(input).map((t) => t.id)).toEqual([
      "right_biceps",
      "neck",
      "hips",
    ]);
  });

  it("does not mutate the input array", () => {
    const input = [make("hip"), make("hips")];
    const snapshot = input.map((t) => ({ ...t }));
    filterLegacyShadowedTypes(input);
    expect(input).toEqual(snapshot);
  });
});

describe("LEGACY_SHADOWED_BY", () => {
  it("only references canonical built-in ids as replacements", () => {
    const canonicalIds = new Set(BUILT_IN_TYPES.map((t) => t.id));
    for (const replacements of Object.values(LEGACY_SHADOWED_BY)) {
      for (const r of replacements) {
        expect(canonicalIds.has(r)).toBe(true);
      }
    }
  });

  it("never lists a canonical id as a legacy key", () => {
    const canonicalIds = new Set(BUILT_IN_TYPES.map((t) => t.id));
    for (const legacy of Object.keys(LEGACY_SHADOWED_BY)) {
      expect(canonicalIds.has(legacy)).toBe(false);
    }
  });
});
