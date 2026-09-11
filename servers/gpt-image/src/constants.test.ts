import { expect, test } from "bun:test";
import { DEFAULT_EDIT_MODEL, DEFAULT_MODEL, MODELS, validateSize } from "./constants.js";

test("default models are exposed and deprecated models stay out", () => {
  expect(MODELS).toContain(DEFAULT_MODEL);
  expect(MODELS).toContain(DEFAULT_EDIT_MODEL);
  for (const deprecated of ["chatgpt-image-latest", "gpt-image-1.5", "gpt-image-1-mini"]) {
    expect(MODELS).not.toContain(deprecated);
  }
});

test("accepts size presets", () => {
  for (const preset of ["auto", "1024x1024", "1536x1024", "1024x1536", "2048x2048"]) {
    expect(validateSize(preset)).toBe(preset);
  }
});

test("accepts valid custom sizes", () => {
  expect(validateSize("2560x1440")).toBe("2560x1440");
  expect(validateSize("3072x1024")).toBe("3072x1024"); // exactly 3:1
  expect(validateSize("3840x2160")).toBe("3840x2160"); // documented maximum, exactly 8,294,400 px
});

test("rejects edges that are not multiples of 16", () => {
  expect(() => validateSize("1000x1000")).toThrow("multiples of 16");
});

test("rejects edges beyond 3840", () => {
  expect(() => validateSize("4096x1600")).toThrow("must not exceed 3840px");
});

test("rejects aspect ratios beyond 3:1", () => {
  expect(() => validateSize("3072x512")).toThrow("aspect ratio");
});

test("rejects sizes outside the pixel bounds", () => {
  expect(() => validateSize("512x512")).toThrow("total pixels"); // 262 144 < 655 360
  expect(() => validateSize("3824x3824")).toThrow("total pixels"); // 14.6 Mpx > 8.29 Mpx
});

test("rejects invalid syntax", () => {
  expect(() => validateSize("1024*1024")).toThrow("Invalid size");
  expect(() => validateSize("big")).toThrow("Invalid size");
});
