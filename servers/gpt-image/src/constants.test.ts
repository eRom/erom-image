import { expect, test } from "bun:test";
import { DEFAULT_MODEL, MODELS, validateSize } from "./constants.js";

test("le modèle par défaut est gpt-image-2 et les modèles dépréciés sont absents", () => {
  expect(DEFAULT_MODEL).toBe("gpt-image-2");
  expect(MODELS).toContain("gpt-image-2");
  expect(MODELS).not.toContain("chatgpt-image-latest");
  expect(MODELS).not.toContain("gpt-image-1.5");
  expect(MODELS).not.toContain("gpt-image-1-mini");
});

test("accepte les presets", () => {
  for (const preset of ["auto", "1024x1024", "1536x1024", "1024x1536", "2048x2048"]) {
    expect(validateSize(preset)).toBe(preset);
  }
});

test("accepte les tailles custom valides", () => {
  expect(validateSize("2560x1440")).toBe("2560x1440");
  expect(validateSize("3072x1024")).toBe("3072x1024"); // ratio exactement 3:1
  expect(validateSize("3840x2160")).toBe("3840x2160"); // maximum documenté, 8 294 400 px pile
});

test("rejette les bords non multiples de 16", () => {
  expect(() => validateSize("1000x1000")).toThrow("multiples of 16");
});

test("rejette les bords au-delà de 3840", () => {
  expect(() => validateSize("4096x1600")).toThrow("must not exceed 3840px");
});

test("rejette un ratio supérieur à 3:1", () => {
  expect(() => validateSize("3072x512")).toThrow("aspect ratio");
});

test("rejette les tailles hors bornes de pixels", () => {
  expect(() => validateSize("512x512")).toThrow("total pixels"); // 262 144 < 655 360
  expect(() => validateSize("3824x3824")).toThrow("total pixels"); // 14,6 Mpx > 8,29 Mpx
});

test("rejette une syntaxe invalide", () => {
  expect(() => validateSize("1024*1024")).toThrow("Invalid size");
  expect(() => validateSize("big")).toThrow("Invalid size");
});
