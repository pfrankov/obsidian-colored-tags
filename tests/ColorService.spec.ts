import { describe, it, expect } from "vitest";
import Color from "colorjs.io";
import { ColorService } from "../src/ColorService";
import { ColoredTagsPaletteType } from "../src/interfaces";

const service = new ColorService();
const tagMap = new Map([
	["parent", 1],
	["parent/child", 2],
]);

describe("ColorService", () => {
	describe("generatePalettes", () => {
		it("creates custom palettes in lch format and rotates by seed", () => {
			const config = {
				selected: ColoredTagsPaletteType.CUSTOM,
				custom: "ff0000-00ff00-0000ff",
				seed: 0,
			};
			const base = service.generatePalettes(config);
			const rotated = service.generatePalettes({ ...config, seed: 1 });

			expect(base.light).toHaveLength(3);
			expect(base.light[0]).toMatch(/lch\(/);
			expect(rotated.light[0]).toBe(base.light[2]);
		});

		it("generates adaptive palettes when custom is empty", () => {
			const palettes = service.generatePalettes({
				selected: ColoredTagsPaletteType.CUSTOM,
				custom: "",
				seed: 0,
			});

			expect(palettes.light).toHaveLength(8);
			expect(palettes.dark).toHaveLength(8);
		});

		it("creates different adaptive palettes for bright vs soft", () => {
			const bright = service.generatePalettes({
				selected: ColoredTagsPaletteType.ADAPTIVE_BRIGHT,
				custom: "",
				seed: 0,
			});
			const soft = service.generatePalettes({
				selected: ColoredTagsPaletteType.ADAPTIVE_SOFT,
				custom: "",
				seed: 0,
			});

			expect(bright.light).toHaveLength(8);
			expect(soft.light).toHaveLength(8);
			expect(bright.light[0]).not.toBe(soft.light[0]);
		});
	});

	describe("getColors", () => {
		it("creates gradient for nested tags with mixing and transition", () => {
			const palette = service.generatePalettes({
				selected: ColoredTagsPaletteType.CUSTOM,
				custom: "333333-343434-abcdef",
				seed: 0,
			}).light;

			const result = service.getColors("parent/child", palette, tagMap, {
				isMixing: true,
				isTransition: true,
				highTextContrast: false,
			});

			expect(result.background).toMatch(/lch\(/);
			expect(result.linearGradient).toHaveLength(2);
			expect(result.linearGradient[0]).toMatch(/max\(2em/);
		});

		it("creates gradient without transition gaps when disabled", () => {
			const result = service.getColors(
				"parent/child",
				["#123456", "#abcdef"],
				tagMap,
				{
					isMixing: true,
					isTransition: false,
					highTextContrast: false,
				},
			);

			expect(result.linearGradient).toHaveLength(2);
			expect(result.linearGradient[0]).toContain("0%");
			expect(result.linearGradient[1]).toContain("50%");
		});

		it("uses high-contrast text colors (white/black)", () => {
			const white = new Color("white").toString();
			const black = new Color("black").toString();
			const singleTagMap = new Map([["tag", 1]]);

			const dark = service.getColors("tag", ["#000000"], singleTagMap, {
				isMixing: false,
				isTransition: false,
				highTextContrast: true,
			});
			expect(dark.color).toBe(white);

			const light = service.getColors("tag", ["#ffffff"], singleTagMap, {
				isMixing: false,
				isTransition: false,
				highTextContrast: true,
			});
			expect(light.color).toBe(black);
		});

		it("handles unknown tags with default order", () => {
			const result = service.getColors(
				"unknown",
				["#123456"],
				new Map(),
				{
					isMixing: false,
					isTransition: false,
					highTextContrast: false,
				},
			);

			expect(result.linearGradient).toHaveLength(1);
			expect(result.background).toMatch(/lch\(/);
		});

		it("creates non-mixed colors for nested tags when mixing disabled", () => {
			const result = service.getColors(
				"parent/child",
				["#ff0000", "#00ff00"],
				tagMap,
				{
					isMixing: false,
					isTransition: false,
					highTextContrast: false,
				},
			);

			expect(result.linearGradient).toHaveLength(2);
			expect(result.linearGradient[0]).toContain("lch");
			expect(result.linearGradient[1]).toContain("lch");
		});
	});

	describe("private methods", () => {
		it("bumps mixing level for similar colors", () => {
			const baseColor = new Color("#333333").to("lch");
			const result = (service as any).mixColors(
				baseColor,
				"#343434",
				false,
			);
			const expected = new Color("#333333")
				.to("lch")
				.mix("#343434", 0.5, { space: "lch" });

			expect(result.toString()).toBe(expected.toString());
		});

		it("calculates high-contrast color correctly", () => {
			const white = new Color("white").toString();
			const black = new Color("black").toString();

			expect(
				(service as any).calculateHighContrastColor(
					new Color("#000000"),
				),
			).toBe(white);
			expect(
				(service as any).calculateHighContrastColor(
					new Color("#ffffff"),
				),
			).toBe(black);
		});

		it("calculates darkened color and memoizes results", () => {
			const darkBase = new Color("lch(10% 5 0)");
			const brightBase = new Color("lch(75% 5 0)");

			const lighterText = (service as any).calculateDarkenedColor(
				darkBase,
			);
			const darkerText = (service as any).calculateDarkenedColor(
				brightBase,
			);

			expect(lighterText).toMatch(/lch\(/);
			expect(darkerText).toMatch(/lch\(/);

			const memoSize = (service as any).darkenMemoization.size;
			expect((service as any).calculateDarkenedColor(brightBase)).toBe(
				darkerText,
			);
			expect((service as any).darkenMemoization.size).toBe(memoSize);
		});

		it("generates non-shuffled adaptive palette", () => {
			const config = {
				isDarkTheme: false,
				paletteSize: 3,
				baseChroma: 16,
				baseLightness: 87,
				seed: 2,
				isShuffling: false,
				constantOffset: 0,
			};

			const paletteA = (service as any).generateAdaptiveColorPalette(
				config,
			);
			const paletteB = (service as any).generateAdaptiveColorPalette({
				...config,
				seed: 0,
			});

			expect(paletteA).toEqual(paletteB);
			expect(paletteA[0]).toMatch(/lch\(/);
		});
	});
});
