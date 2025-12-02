import { describe, expect, expectTypeOf, it, vi } from "vitest";
import ColoredTagsPlugin from "../src/main";
import { DEFAULT_SETTINGS } from "../src/defaultSettings";
import { App } from "obsidian";

const createPlugin = () => {
	const app = new App();
	const plugin = new ColoredTagsPlugin(
		app as any,
		{ version: "1.0.0" } as any,
	);
	plugin.settings = { ...DEFAULT_SETTINGS, tagColors: {} };
	plugin.palettes = { light: ["#111111"], dark: ["#222222"] };

	(plugin as any).cssManager = {
		append: vi.fn(),
		removeAll: vi.fn(),
	} as any;

	(plugin as any).tagManager = {
		getTagsMap: vi.fn(() => new Map([["tag", 1]])),
		markAsRendered: vi.fn(),
		isRendered: vi.fn(),
		clearRenderedTags: vi.fn(),
		exportKnownTags: vi.fn(() => ({})),
		updateKnownTags: vi.fn(async () => false),
	} as any;

	(plugin as any).colorService = {
		getColors: vi.fn(() => ({
			background: "#000000",
			color: "#ffffff",
			linearGradient: ["#000000", "#111111"],
		})),
		findClosestColorIndex: vi.fn(() => 0),
	} as any;

	return plugin;
};

describe("ColoredTagsPlugin tag colors", () => {
	it("exposes typed tag helpers", () => {
		const plugin = createPlugin();
		expectTypeOf(plugin.settings.tagColors).toMatchTypeOf<
			Record<string, number>
		>();
		expectTypeOf(plugin.colorizeTag).returns.toBeVoid();
	});

	it("passes tag color overrides to ColorService when colorizing", () => {
		const plugin = createPlugin();
		(plugin as any).tagColorMap = new Map([["tag", 2]]);

		plugin.colorizeTag("#tag");

		const calls = ((plugin as any).colorService.getColors as any).mock
			.calls;
		expect(calls).toHaveLength(2);
		expect(calls[0][4]).toBe((plugin as any).tagColorMap);
		expect(calls[1][4]).toBe((plugin as any).tagColorMap);
	});

	it("includes property tag selectors in generated styles", () => {
		const plugin = createPlugin();

		plugin.colorizeTag("excalidraw");

		const css = ((plugin as any).cssManager.append as any).mock.calls[0][0];
		expect(css).toContain(
			'body .metadata-property[data-property-key="tags" i] .multi-select-pill.colored-tag-excalidraw',
		);
		expect(css).toContain(
			'body .metadata-property[data-property-key="tags" i] .multi-select-pill-remove-button.colored-tag-excalidraw',
		);
	});

	it("remaps tag colors to the closest match when palettes change", () => {
		const plugin = createPlugin();
		plugin.settings.tagColors = { "#tag/": -1, " other ": 2, "#": 0 };
		((plugin as any).colorService as any).findClosestColorIndex = vi.fn(
			() => 1,
		);

		(plugin as any).remapTagColors(
			{ light: ["#000000", "#111111"], dark: [] },
			{ light: ["#999999", "#888888"], dark: [] },
		);

		expect(plugin.settings.tagColors).toEqual({ tag: 1, other: 1 });
		expect(
			((plugin as any).colorService as any).findClosestColorIndex,
		).toHaveBeenCalledWith("#111111", ["#999999", "#888888"]);
	});

	it("detects palette changes correctly", () => {
		const plugin = createPlugin();

		expect(
			(plugin as any).havePalettesChanged(
				{ light: ["#1"], dark: ["#2"] },
				{ light: ["#1"], dark: ["#2"] },
			),
		).toBe(false);

		expect(
			(plugin as any).havePalettesChanged(
				{ light: ["#1"], dark: ["#2"] },
				{ light: ["#1", "#3"], dark: ["#2"] },
			),
		).toBe(true);
	});

	it("normalizes tag names when building color map", () => {
		const plugin = createPlugin();
		plugin.settings.tagColors = { "#Parent/Child/": 3 };

		(plugin as any).refreshTagColorMap();

		expect((plugin as any).tagColorMap.get("parent/child")).toBe(3);
	});
});
