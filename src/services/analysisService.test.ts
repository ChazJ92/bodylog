import { describe, it, expect } from "vitest";
import {
  resolveAnalysisCircumferences,
  navyBodyFat,
  waistToHip,
  deurenbergBodyFat,
  rfmBodyFat,
  reasonNavyBodyFatUnavailable,
  reasonWaistToHipUnavailable,
  reasonDeurenbergUnavailable,
  reasonRfmUnavailable,
  reasonLeanFatMassUnavailable,
  bmi,
  type AnalysisInputs,
} from "./analysisService";

describe("resolveAnalysisCircumferences", () => {
  const types = new Map([
    ["waist", { name: "Waist" }],
    ["hips", { name: "Hips" }],
    ["neck", { name: "Neck" }],
    ["hip", { name: "Hip" }],
    ["custom_hip", { name: "Hips" }],
  ]);

  it("uses hips when only canonical hips id is present (hip/hips alias bug)", () => {
    const m = [{ measurementTypeId: "hips", valueCm: 100 }];
    expect(resolveAnalysisCircumferences(m, types)).toEqual({
      hipCm: 100,
    });
  });

  it("prefers hips over legacy hip when both exist", () => {
    const m = [
      { measurementTypeId: "hip", valueCm: 90 },
      { measurementTypeId: "hips", valueCm: 100 },
    ];
    expect(resolveAnalysisCircumferences(m, types).hipCm).toBe(100);
  });

  it("falls back to legacy hip when hips is absent", () => {
    const m = [{ measurementTypeId: "hip", valueCm: 88 }];
    expect(resolveAnalysisCircumferences(m, types)).toEqual({ hipCm: 88 });
  });

  it("resolves waist via waists id", () => {
    const m = [{ measurementTypeId: "waists", valueCm: 70 }];
    expect(resolveAnalysisCircumferences(m, types).waistCm).toBe(70);
  });

  it("matches hip circumference by type display name for custom ids", () => {
    const m = [{ measurementTypeId: "custom_hip", valueCm: 99 }];
    expect(resolveAnalysisCircumferences(m, types).hipCm).toBe(99);
  });
});

describe("navyBodyFat + waistToHip with hip/hips resolution", () => {
  const types = new Map([
    ["waist", { name: "Waist" }],
    ["hips", { name: "Hips" }],
    ["neck", { name: "Neck" }],
  ]);

  it("computes female Navy body fat when hip data is stored under hips", () => {
    const circumferences = resolveAnalysisCircumferences(
      [
        { measurementTypeId: "waist", valueCm: 80 },
        { measurementTypeId: "neck", valueCm: 30 },
        { measurementTypeId: "hips", valueCm: 100 },
      ],
      types,
    );
    const inputs: AnalysisInputs = {
      sex: "female",
      heightCm: 165,
      weightKg: 70,
      ...circumferences,
    };
    const bf = navyBodyFat(inputs);
    expect(bf).not.toBeNull();
    expect(bf!).toBeGreaterThan(5);
    expect(bf!).toBeLessThan(60);
  });

  it("computes waist-to-hip ratio when hip uses hips id", () => {
    const circumferences = resolveAnalysisCircumferences(
      [
        { measurementTypeId: "waist", valueCm: 80 },
        { measurementTypeId: "hips", valueCm: 100 },
      ],
      types,
    );
    expect(waistToHip(circumferences.waistCm, circumferences.hipCm)).toBeCloseTo(0.8, 6);
  });
});

describe("unavailable reasons", () => {
  it("Navy: female reports missing hip", () => {
    const i: AnalysisInputs = {
      sex: "female",
      heightCm: 170,
      waistCm: 80,
      neckCm: 35,
    };
    expect(reasonNavyBodyFatUnavailable(i)).toBe("Hip measurement not available.");
  });

  it("Navy: sex other", () => {
    const i: AnalysisInputs = { sex: "other", heightCm: 170, waistCm: 80, neckCm: 35 };
    expect(reasonNavyBodyFatUnavailable(i)).toMatch(/Sex must be male or female/);
  });

  it("WHR: missing hip", () => {
    const i: AnalysisInputs = { sex: "male", waistCm: 80 };
    expect(reasonWaistToHipUnavailable(i)).toBe("Hip measurement not available.");
  });

  it("Deurenberg: missing birth year", () => {
    const i: AnalysisInputs = {
      sex: "male",
      heightCm: 180,
      weightKg: 80,
    };
    expect(reasonDeurenbergUnavailable(i)).toMatch(/Birth year missing/);
  });

  it("RFM: missing waist", () => {
    const i: AnalysisInputs = { sex: "male", heightCm: 180 };
    expect(reasonRfmUnavailable(i)).toBe("Waist measurement not available.");
  });

  it("lean/fat: no bf source", () => {
    const i: AnalysisInputs = { sex: "male", weightKg: 80 };
    expect(reasonLeanFatMassUnavailable(i, null, null)).toMatch(/No body fat estimate/);
  });
});

describe("deurenbergBodyFat", () => {
  it("returns an estimate when BMI, sex, and age are available", () => {
    const i: AnalysisInputs = {
      sex: "female",
      heightCm: 165,
      weightKg: 65,
      birthYear: 1990,
    };
    const bf = deurenbergBodyFat(i, 2025);
    expect(bf).not.toBeNull();
    const b = bmi(i.weightKg, i.heightCm);
    expect(b).not.toBeNull();
    expect(bf).toBeGreaterThan(10);
    expect(bf).toBeLessThan(45);
  });

  it("returns null without birth year", () => {
    const i: AnalysisInputs = {
      sex: "male",
      heightCm: 180,
      weightKg: 85,
    };
    expect(deurenbergBodyFat(i, 2025)).toBeNull();
  });
});

describe("rfmBodyFat", () => {
  it("returns estimate for male", () => {
    const i: AnalysisInputs = {
      sex: "male",
      heightCm: 180,
      waistCm: 90,
    };
    const rfm = rfmBodyFat(i);
    expect(rfm).not.toBeNull();
    expect(rfm!).toBeGreaterThan(5);
    expect(rfm!).toBeLessThan(50);
  });

  it("returns null for sex other", () => {
    const i: AnalysisInputs = { sex: "other", heightCm: 180, waistCm: 90 };
    expect(rfmBodyFat(i)).toBeNull();
  });
});
