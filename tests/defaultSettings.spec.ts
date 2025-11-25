import { describe, it, expect } from "vitest";
import { DEFAULT_SETTINGS } from "../src/defaultSettings";
import { ColoredTagsPaletteType } from "../src/interfaces";

describe("DEFAULT_SETTINGS", () => {
	it("contains valid structure and expected default values", () => {
		expect(DEFAULT_SETTINGS).toMatchObject({
			palette: {
				seed: 0,
				selected: ColoredTagsPaletteType.ADAPTIVE_SOFT,
				custom: expect.any(String),
			},
			mixColors: true,
			transition: true,
			accessibility: {
				highTextContrast: false,
			},
			knownTags: {},
			tagColors: {},
			_version: 4,
		});
	});

	it("has non-empty custom palette as fallback", () => {
		expect(DEFAULT_SETTINGS.palette.custom.length).toBeGreaterThan(0);
		expect(DEFAULT_SETTINGS.palette.custom).toMatch(/^[a-fA-F0-9-]+$/);
	});
});
