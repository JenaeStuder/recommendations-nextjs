import { describe, expect, it } from "vitest";
import { contrast, luminance, over } from "./contrast";

describe("contrast", () => {
  it("matches the WCAG reference values", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrast("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
    expect(contrast("#767676", "#ffffff")).toBeCloseTo(4.54, 2); // the well-known smallest grey that passes AA on white
  });

  it("does not care which colour is given first", () => {
    expect(contrast("#2b1d22", "#f5eee3")).toBe(contrast("#f5eee3", "#2b1d22"));
  });

  it("has black at 0 luminance and white at 1", () => {
    expect(luminance("#000000")).toBe(0);
    expect(luminance("#ffffff")).toBeCloseTo(1, 10);
  });

  it("rejects anything that is not #rrggbb", () => {
    expect(() => contrast("red", "#ffffff")).toThrow();
    expect(() => contrast("#fff", "#ffffff")).toThrow();
  });
});

describe("over", () => {
  it("is the foreground at full alpha and the background at none", () => {
    expect(over("#102030", "#ffffff", 1)).toBe("#102030");
    expect(over("#102030", "#ffffff", 0)).toBe("#ffffff");
  });

  it("blends halfway at 50%", () => {
    expect(over("#000000", "#ffffff", 0.5)).toBe("#808080");
  });
});
