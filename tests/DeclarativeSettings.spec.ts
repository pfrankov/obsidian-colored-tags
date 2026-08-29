import { App, Setting } from "obsidian";
import { vi } from "vitest";
import { ColoredTagsPluginSettingTab } from "../src/ColoredTagsPluginSettingTab";
import ColoredTagsPlugin from "../src/main";
import { DEFAULT_SETTINGS } from "../src/defaultSettings";
import { ColoredTagsPaletteType } from "../src/interfaces";

function createPlugin() {
	const app = new App();
	const plugin = {
		app,
		settings: structuredClone(DEFAULT_SETTINGS),
		palettes: {
			light: ["#111111", "#222222", "#333333"],
			dark: ["#aaaaaa", "#bbbbbb", "#cccccc"],
		},
		saveSettings: vi.fn(async () => undefined),
		colorizeTag: vi.fn(),
	} as unknown as ColoredTagsPlugin;
	return { app, plugin };
}

describe("declarative settings", () => {
	it("exposes searchable section definitions while excluding preview from search", () => {
		const { app, plugin } = createPlugin();
		const tab = new ColoredTagsPluginSettingTab(app, plugin);
		const definitions = tab.getSettingDefinitions();

		expect(definitions).toHaveLength(4);
		expect(definitions[0].searchable).toBe(false);
		expect(definitions[1].aliases ?? []).toHaveLength(3);
		expect(definitions[2].aliases ?? []).toHaveLength(1);
		expect(definitions[3].aliases ?? []).toHaveLength(4);
	});

	it("renders declarative sections through existing imperative renderers", () => {
		const { app, plugin } = createPlugin();
		const tab = new ColoredTagsPluginSettingTab(app, plugin);
		const definitions = tab.getSettingDefinitions();

		const cleanups: Array<() => void> = [];
		for (const definition of definitions) {
			const setting = new Setting(tab.containerEl);
			const cleanup = definition.render(setting);
			if (cleanup) {
				cleanups.push(cleanup);
			}
		}

		expect(tab.containerEl.classList.contains("colored-tags-settings")).toBe(true);
		expect(tab.containerEl.querySelector(".palette")).not.toBeNull();
		expect(
			tab.containerEl.querySelectorAll(".colored-tags-declarative-host"),
		).toHaveLength(4);
		expect(tab.containerEl.querySelector("select")).not.toBeNull();
		expect(
			tab.containerEl.querySelectorAll('input[type="checkbox"]').length,
		).toBeGreaterThanOrEqual(2);

		cleanups.forEach((cleanup) => cleanup());
	});

	it("creates a palette fallback when its section renders without the preview", () => {
		const { app, plugin } = createPlugin();
		const tab = new ColoredTagsPluginSettingTab(app, plugin);
		const paletteDefinition = tab.getSettingDefinitions()[1];
		const setting = new Setting(tab.containerEl);

		paletteDefinition.render(setting);

		expect(setting.settingEl.querySelector(".palette")).not.toBeNull();
	});

	it("uses settings update after a palette change", async () => {
		const { app, plugin } = createPlugin();
		plugin.settings.palette.selected = ColoredTagsPaletteType.ADAPTIVE_SOFT;
		const tab = new ColoredTagsPluginSettingTab(app, plugin);
		const update = vi.fn();
		(tab as unknown as { update: () => void }).update = update;
		const definitions = tab.getSettingDefinitions();

		definitions[0].render(new Setting(tab.containerEl));
		definitions[1].render(new Setting(tab.containerEl));

		const select = tab.containerEl.querySelector("select") as HTMLSelectElement;
		select.value = ColoredTagsPaletteType.ADAPTIVE_BRIGHT;
		select.dispatchEvent(new Event("change"));

		await vi.waitFor(() => {
			expect(update).toHaveBeenCalled();
		});
		expect(plugin.saveSettings).toHaveBeenCalled();
	});
});
