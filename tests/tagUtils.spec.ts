import { describe, expect, expectTypeOf, it } from "vitest";
import { normalizePaletteIndex, normalizeTagName } from "../src/tagUtils";

describe("tagUtils", () => {
	it("normalizes tag names by stripping hashes, whitespace, and trailing slashes", () => {
		expect(normalizeTagName("#Parent/Child/")).toBe("Parent/Child");
		expect(normalizeTagName("  # spaced /tag // ")).toBe("spaced/tag");
	});

	it("wraps palette indices safely", () => {
		expect(normalizePaletteIndex(6, 5)).toBe(1);
		expect(normalizePaletteIndex(-1, 5)).toBe(4);
		expect(normalizePaletteIndex(2, 0)).toBe(0);
	});

	it("keeps stable typing for helpers", () => {
		expectTypeOf(normalizeTagName).parameters.toEqualTypeOf<[string]>();
		expectTypeOf(normalizeTagName).returns.toBeString();
		expectTypeOf(normalizePaletteIndex).parameters.toEqualTypeOf<
			[number, number]
		>();
		expectTypeOf(normalizePaletteIndex).returns.toBeNumber();
	});
});
