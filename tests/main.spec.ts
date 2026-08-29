import { describe, expect, expectTypeOf, it, vi } from "vitest";
import ColoredTagsPlugin from "../src/main";
import { DEFAULT_SETTINGS } from "../src/defaultSettings";
import { App, requestUrl } from "obsidian";

function createDeferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((res) => {
		resolve = res;
	});
	return { promise, resolve };
}

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

	it("matches reading view tag links regardless of href casing", () => {
		const plugin = createPlugin();

		plugin.colorizeTag("Mixed/Case");

		const css = ((plugin as any).cssManager.append as any).mock.calls[0][0];
		expect(css).toContain('body a.tag[href="#Mixed\\/Case" i]');
	});

	it("does not leak flat selectors from nested tags to other tags", () => {
		const plugin = createPlugin();

		plugin.colorizeTag("ok/in/both/modes");

		const css = ((plugin as any).cssManager.append as any).mock.calls[0][0];
		expect(css).not.toContain(".cm-tag-okinbothmodes.cm-hashtag");
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

	it("persists known tags only when tag manager reports changes", async () => {
		const plugin = createPlugin();
		const saveDataSpy = vi
			.spyOn(plugin, "saveData")
			.mockResolvedValue(undefined);
		(plugin as any).tagManager.updateKnownTags = vi.fn(async () => true);
		(plugin as any).tagManager.exportKnownTags = vi.fn(() => ({
			fresh: 1,
		}));

		await plugin.saveKnownTags();

		expect(plugin.settings.knownTags).toEqual({ fresh: 1 });
		expect(saveDataSpy).toHaveBeenCalledWith(plugin.settings);
	});

	it("serializes concurrent known tag saves and flushes one queued rerun", async () => {
		const plugin = createPlugin();
		const firstUpdate = createDeferred<boolean>();
		const updateKnownTags = vi
			.fn()
			.mockImplementationOnce(() => firstUpdate.promise)
			.mockResolvedValueOnce(false);
		const exportKnownTags = vi.fn(() => ({ fresh: 1 }));
		const saveDataSpy = vi
			.spyOn(plugin, "saveData")
			.mockResolvedValue(undefined);

		(plugin as any).tagManager.updateKnownTags = updateKnownTags;
		(plugin as any).tagManager.exportKnownTags = exportKnownTags;

		const firstSave = plugin.saveKnownTags();
		const secondSave = plugin.saveKnownTags();

		expect(updateKnownTags).toHaveBeenCalledTimes(1);

		firstUpdate.resolve(true);
		await Promise.all([firstSave, secondSave]);

		expect(updateKnownTags).toHaveBeenCalledTimes(2);
		expect(exportKnownTags).toHaveBeenCalledTimes(1);
		expect(saveDataSpy).toHaveBeenCalledTimes(1);
	});

	it("does not drop a rerun queued while a save promise is settling", async () => {
		const plugin = createPlugin();
		const updateKnownTags = vi.fn(async () => false);

		(plugin as any).tagManager.updateKnownTags = updateKnownTags;

		const firstSave = plugin.saveKnownTags();
		const secondSave = new Promise<Promise<void>>((resolve) => {
			queueMicrotask(() => resolve(plugin.saveKnownTags()));
		});

		await Promise.all([firstSave, await secondSave]);

		expect(updateKnownTags).toHaveBeenCalledTimes(2);
	});
});


describe("ColoredTagsPlugin settings and update compatibility", () => {
	it("keeps legacy migration semantics and unknown fields", () => {
		const plugin = createPlugin();
		const legacy = {
			_version: 2, seed: 3, chroma: 17, lightness: 10,
			tagColors: { legacy: 2 }, unknownFutureField: "keep-me",
		};
		const migrated = (plugin as any).migrateSettings(legacy);
		expect(migrated._version).toBe(4);
		expect(migrated.palette.seed).toBe(3);
		expect(migrated.palette.selected).toBe("adaptive-bright");
		expect(migrated.tagColors).toEqual({ legacy: 2 });
		expect((migrated as any).unknownFutureField).toBe("keep-me");
	});

	it("preserves seed fallback behavior during migration", () => {
		const plugin = createPlugin();
		const migrated = (plugin as any).migrateSettings({
			_version: 2, seed: 0, chroma: 0, lightness: 0,
		});
		expect(migrated.palette.seed).toBe(0);
	});

	it("keeps update check request behavior with a typed response", async () => {
		const plugin = createPlugin();
		vi.mocked(requestUrl).mockResolvedValueOnce({
			status: 200,
			headers: {},
			arrayBuffer: new ArrayBuffer(0),
			json: { tag_name: "1.0.0" },
			text: "",
		});
		await plugin.checkUpdates();
		expect(requestUrl).toHaveBeenCalledWith(expect.objectContaining({
			url: "https://api.github.com/repos/pfrankov/obsidian-colored-tags/releases/latest",
			method: "GET",
		}));
	});
});
