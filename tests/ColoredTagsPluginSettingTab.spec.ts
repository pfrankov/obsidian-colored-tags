import { describe, it, expect, vi } from "vitest";
import { ColoredTagsPluginSettingTab } from "../src/ColoredTagsPluginSettingTab";
import { App } from "./__mocks__/obsidian";
import { DEFAULT_SETTINGS } from "../src/defaultSettings";
import {
	ColoredTagsPaletteType,
	ColoredTagsPluginSettings,
} from "../src/interfaces";
import {
	CommunityPalettesService,
	CommunityPalette,
} from "../src/CommunityPalettesService";
import { I18n } from "../src/i18n";

const basePalettes = {
	light: ["#ff0000", "#00ff00"],
	dark: ["#000000", "#111111"],
};

const createTab = (
	options: {
		palettes?: typeof basePalettes;
		settings?: Partial<ColoredTagsPluginSettings>;
		saveSettings?: ReturnType<typeof vi.fn>;
		saveData?: ReturnType<typeof vi.fn>;
	} = {},
	app = new App(),
) => {
	const plugin = {
		palettes: options.palettes ?? { ...basePalettes },
		settings: {
			...JSON.parse(JSON.stringify(DEFAULT_SETTINGS)),
			...options.settings,
			palette: {
				...DEFAULT_SETTINGS.palette,
				...options.settings?.palette,
			},
			accessibility: {
				...DEFAULT_SETTINGS.accessibility,
				...options.settings?.accessibility,
			},
		},
		saveSettings: options.saveSettings ?? vi.fn(async () => {}),
		saveData: options.saveData ?? vi.fn(async () => {}),
		colorizeTag: vi.fn(),
	};
	return {
		app,
		plugin,
		tab: new ColoredTagsPluginSettingTab(app as any, plugin as any),
	};
};

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

const findSetting = (container: HTMLElement, text: string) =>
	Array.from(container.querySelectorAll(".setting-item")).find(
		(s) =>
			s.querySelector(".setting-item-name")?.textContent?.includes(text),
	) as HTMLElement | undefined;

describe("ColoredTagsPluginSettingTab", () => {
	describe("rendering", () => {
		it("renders palette with correct number of color elements", () => {
			const { tab } = createTab({
				palettes: {
					light: ["#ff0000", "#00ff00", "#0000ff"],
					dark: ["#000", "#111"],
				},
			});
			const paletteEl = document.createElement("div");

			tab.renderPalette(paletteEl as any);

			expect(paletteEl.children).toHaveLength(3);
		});

		it("uses dark palette when dark theme is active", () => {
			const { tab } = createTab({
				palettes: { light: ["#fff"], dark: ["#0000ff", "#111111"] },
			});
			const paletteEl = document.createElement("div");
			const originalMatchMedia = window.matchMedia;
			window.matchMedia = () => ({ matches: true }) as any;

			tab.renderPalette(paletteEl as any);

			const children = paletteEl.querySelectorAll("div");
			expect(children).toHaveLength(2);
			expect(children[0].getAttribute("style")).toContain("#0000ff");

			window.matchMedia = originalMatchMedia;
		});

		it("falls back to light palette when active palette is empty", () => {
			const { tab } = createTab({
				palettes: { light: ["#abcabc"], dark: [] },
			});
			const paletteEl = document.createElement("div");
			const originalMatchMedia = window.matchMedia;
			window.matchMedia = () => ({ matches: true }) as any;

			tab.renderPalette(paletteEl as any);

			const hasLightColor = Array.from(
				paletteEl.querySelectorAll("div"),
			).some((child) => child.getAttribute("style")?.includes("#abcabc"));
			expect(hasLightColor).toBe(true);

			window.matchMedia = originalMatchMedia;
		});

		it("renders tags from metadataCache", () => {
			const { tab } = createTab();
			const container = document.createElement("div");

			tab.renderTags(container as any);

			expect(container.querySelectorAll("a.tag").length).toBeGreaterThan(
				0,
			);
		});

		it("renders nothing when no tags exist", () => {
			const app = new App();
			app.metadataCache.getTags = () => ({});
			const { tab } = createTab({}, app);
			const container = document.createElement("div");

			tab.renderTags(container as any);

			expect(container.querySelectorAll("a.tag")).toHaveLength(0);
		});

		it("displays custom palette input for custom palette type", () => {
			const { tab } = createTab({
				settings: {
					palette: {
						selected: ColoredTagsPaletteType.CUSTOM,
						custom: "ff0000-00ff00",
						seed: 0,
					},
				},
			});

			tab.display();

			expect(
				tab.containerEl.querySelector(
					'input[placeholder="Paste palette"]',
				),
			).toBeTruthy();
		});

		it("animates palette preview when requested and animations are supported", () => {
			const { tab } = createTab({
				palettes: {
					light: ["#111111", "#222222"],
					dark: ["#333333"],
				},
			});
			const paletteEl = document.createElement("div");
			const animateSpy = vi.fn();
			(paletteEl as any).animate = animateSpy;

			tab.renderPalette(paletteEl as any, true);

			expect(animateSpy).toHaveBeenCalledWith(
				[{ opacity: 0.2 }, { opacity: 1 }],
				{ duration: 220, easing: "ease-out" },
			);
		});
	});

	describe("settings interactions", () => {
		it("toggles accessibility section and reveals High text contrast setting", async () => {
			const { tab } = createTab();
			tab.showAccessibility = false;
			tab.display();

			const accessibilitySetting = findSetting(
				tab.containerEl,
				"Accessibility",
			);
			const toggle = accessibilitySetting?.querySelector(
				'input[type="checkbox"]',
			) as HTMLInputElement;
			toggle.checked = true;
			toggle.dispatchEvent(new Event("change"));
			await tick();

			expect(tab.showAccessibility).toBe(true);
			expect(
				findSetting(tab.containerEl, "High text contrast"),
			).toBeTruthy();
		});

		it("toggles experimental section and reveals experimental controls", async () => {
			const { tab } = createTab();
			tab.showExperimental = false;
			tab.display();

			const experimentalSetting = findSetting(
				tab.containerEl,
				"Experimental",
			);
			const toggle = experimentalSetting?.querySelector(
				'input[type="checkbox"]',
			) as HTMLInputElement;
			toggle.checked = true;
			toggle.dispatchEvent(new Event("change"));
			await tick();

			expect(tab.showExperimental).toBe(true);
			expect(findSetting(tab.containerEl, "Mix colors")).toBeTruthy();
		});

		it("changes palette type via dropdown and triggers save", async () => {
			const saveSettings = vi.fn(async () => {});
			const { tab, plugin } = createTab({ saveSettings });
			const container = document.createElement("div");
			const paletteEl = document.createElement("div");

			tab["renderPaletteSettings"](container as any, paletteEl as any);
			const select = container.querySelector(
				"select",
			) as HTMLSelectElement;
			select.value = String(ColoredTagsPaletteType.CUSTOM);
			select.dispatchEvent(new Event("change"));
			await tick();

			expect(saveSettings).toHaveBeenCalled();
			expect(plugin.settings.palette.selected).toBe(
				ColoredTagsPaletteType.CUSTOM,
			);
		});

		it("changes palette seed via slider and re-renders", async () => {
			const saveSettings = vi.fn(async () => {});
			const { tab, plugin } = createTab({
				palettes: {
					light: ["#ff0000", "#00ff00", "#0000ff"],
					dark: ["#000000"],
				},
				saveSettings,
			});
			tab.renderPalette = vi.fn();
			const container = document.createElement("div");
			const paletteEl = document.createElement("div");

			tab["renderPaletteSettings"](container as any, paletteEl as any);
			const slider = container.querySelector(
				'input[type="range"]',
			) as HTMLInputElement;
			slider.value = "2";
			slider.dispatchEvent(new Event("change"));
			await tick();

			expect(saveSettings).toHaveBeenCalled();
			expect(tab.renderPalette).toHaveBeenCalled();
			expect(plugin.settings.palette.seed).toBe(2);
		});

		it("validates custom palette input and saves only valid values", async () => {
			const saveSettings = vi.fn(async () => {});
			const { tab, plugin } = createTab({ saveSettings });
			tab.renderPalette = vi.fn();
			const container = document.createElement("div");
			const paletteEl = document.createElement("div");

			tab["renderCustomPaletteField"](container as any, paletteEl as any);
			const input = container.querySelector(
				'input[placeholder="Paste palette"]',
			) as HTMLInputElement;

			input.value = "invalid-value";
			input.dispatchEvent(new Event("input"));
			await tick();
			expect(saveSettings).not.toHaveBeenCalled();

			input.value = "abcdef-123456";
			input.dispatchEvent(new Event("input"));
			await tick();
			expect(saveSettings).toHaveBeenCalled();
			expect(plugin.settings.palette.custom).toBe("abcdef-123456");
		});

		it("toggles highTextContrast setting", async () => {
			const saveSettings = vi.fn(async () => {});
			const { tab, plugin } = createTab({ saveSettings });
			tab.showAccessibility = true;
			tab.display();

			const setting = findSetting(tab.containerEl, "High text contrast");
			const checkbox = setting?.querySelector(
				'input[type="checkbox"]',
			) as HTMLInputElement;
			checkbox.checked = true;
			checkbox.dispatchEvent(new Event("change"));
			await tick();

			expect(saveSettings).toHaveBeenCalled();
			expect(plugin.settings.accessibility.highTextContrast).toBe(true);
		});

		it("toggles experimental features (mix colors and transition)", async () => {
			const saveSettings = vi.fn(async () => {});
			const { tab, plugin } = createTab({
				settings: { mixColors: false, transition: false },
				saveSettings,
			});
			tab.showExperimental = true;
			tab.display();

			const mixSetting = findSetting(tab.containerEl, "Mix colors");
			const mixToggle = mixSetting?.querySelector(
				'input[type="checkbox"]',
			) as HTMLInputElement;
			mixToggle.checked = true;
			mixToggle.dispatchEvent(new Event("change"));
			await tick();
			expect(plugin.settings.mixColors).toBe(true);

			const transitionSetting = findSetting(
				tab.containerEl,
				"Gradient transition",
			);
			const transitionToggle = transitionSetting?.querySelector(
				'input[type="checkbox"]',
			) as HTMLInputElement;
			transitionToggle.checked = true;
			transitionToggle.dispatchEvent(new Event("change"));
			await tick();
			expect(plugin.settings.transition).toBe(true);
			expect(saveSettings).toHaveBeenCalledTimes(2);

			expect(
				findSetting(tab.containerEl, "Tag assignments"),
			).toBeTruthy();
		});

		it("allows assigning palette color to a tag and lists overrides", async () => {
			const saveSettings = vi.fn(async () => {});
			const { tab, plugin } = createTab({ saveSettings });
			tab.showExperimental = true;
			tab.display();

			const input = tab.containerEl.querySelector(
				".tag-color-setting__input input",
			) as HTMLInputElement;
			const swatch = tab.containerEl.querySelector(
				".tag-color-setting__swatch",
			) as HTMLButtonElement;
			expect(swatch.disabled).toBe(true);

			input.value = "#a";
			input.dispatchEvent(new Event("input"));

			swatch.dispatchEvent(new Event("click"));
			await tick();

			expect(plugin.settings.tagColors["a"]).toBe(0);
			expect(
				tab.containerEl.querySelectorAll(".tag-color-setting__chip")
					.length,
			).toBe(1);
			expect(saveSettings).toHaveBeenCalled();
		});

		it("does not apply selection when no tag is entered", async () => {
			const saveSettings = vi.fn(async () => {});
			const { tab } = createTab({ saveSettings });
			tab.showExperimental = true;
			tab.display();

			const swatch = tab.containerEl.querySelector(
				".tag-color-setting__swatch",
			) as HTMLButtonElement;

			// Force-enable and click without entering a tag
			swatch.disabled = false;
			swatch.dispatchEvent(new Event("click"));
			await tick();

			expect(saveSettings).not.toHaveBeenCalled();
		});

		it("shows empty state when no tag assignments exist", () => {
			const { tab } = createTab({
				settings: { tagColors: undefined as any },
			});
			tab.showExperimental = true;
			tab.display();

			const emptyState = tab.containerEl.querySelector(
				".tag-color-setting__empty",
			);

			expect(emptyState).toBeTruthy();
		});

		it("removes tag color assignments via chip action", async () => {
			const saveSettings = vi.fn(async () => {});
			const { tab, plugin } = createTab({
				saveSettings,
				settings: { tagColors: { a: 0 } },
			});
			tab.showExperimental = true;
			tab.display();

			const removeBtn = tab.containerEl.querySelector(
				".tag-color-setting__chip-remove",
			) as HTMLButtonElement;
			removeBtn.dispatchEvent(new Event("click"));
			await tick();

			expect(plugin.settings.tagColors).toEqual({});
			expect(
				tab.containerEl.querySelectorAll(".tag-color-setting__chip")
					.length,
			).toBe(0);
			expect(saveSettings).toHaveBeenCalled();
		});

		it("refreshes tag color UI when palette changes", () => {
			const { tab } = createTab();
			tab.showExperimental = true;
			const renderPaletteSpy = vi.spyOn(
				tab as any,
				"renderPaletteSwatches",
			);
			const renderAssignmentsSpy = vi.spyOn(
				tab as any,
				"renderTagColorAssignments",
			);

			tab.display();
			renderPaletteSpy.mockClear();
			renderAssignmentsSpy.mockClear();

			(tab as any).notifyPaletteChange();

			expect(renderPaletteSpy).toHaveBeenCalledTimes(1);
			expect(renderAssignmentsSpy).toHaveBeenCalledTimes(1);
		});

		it("fills tag input when chip is clicked", () => {
			const { tab } = createTab({
				settings: { tagColors: { sample: 0 } },
			});
			tab.showExperimental = true;
			tab.display();

			const chip = tab.containerEl.querySelector(
				".tag-color-setting__chip a.tag",
			) as HTMLAnchorElement;
			const input = tab.containerEl.querySelector(
				".tag-color-setting__input input",
			) as HTMLInputElement;
			chip.dispatchEvent(
				new Event("click", { bubbles: true, cancelable: true }),
			);

			expect(input.value).toBe("#sample");
		});

		it("filters out invalid tags when populating datalist", () => {
			const app = new App();
			app.metadataCache.getTags = () => ({
				"#keep": 1,
				"#skip/": 1,
			});
			const { tab } = createTab({}, app);
			tab.showExperimental = true;
			tab.display();

			const options = Array.from(
				tab.containerEl.querySelectorAll("datalist option"),
			).map((opt) => opt.getAttribute("value"));

			expect(options).toContain("#keep");
			expect(options).not.toContain("#skip/");
		});

		it("handles missing metadataCache when populating datalist", () => {
			const app = new App();
			(app as any).metadataCache = undefined;
			const { tab } = createTab({}, app);
			const datalist = document.createElement("datalist");

			(tab as any).populateTagOptions(datalist);

			expect(datalist.children.length).toBe(0);
		});

		it("handles missing getTags method when populating datalist", () => {
			const app = new App();
			(app.metadataCache as any).getTags = undefined;
			const { tab } = createTab({}, app);
			const datalist = document.createElement("datalist");

			(tab as any).populateTagOptions(datalist);

			expect(datalist.children.length).toBe(0);
		});

		it("handles missing knownTags config when populating datalist", () => {
			const { tab } = createTab({
				settings: { knownTags: undefined as any },
			});
			const datalist = document.createElement("datalist");

			(tab as any).populateTagOptions(datalist);

			expect(datalist.children.length).toBeGreaterThan(0);
		});

		it("calls onChange callback when tag assignments are empty", () => {
			const { tab } = createTab({ settings: { tagColors: {} } });
			const listEl = document.createElement("div");
			const onChange = vi.fn();

			(tab as any).renderTagColorAssignments(listEl, onChange);

			expect(onChange).toHaveBeenCalled();
		});

		it("resets config to defaults", async () => {
			const saveSettings = vi.fn(async () => {});
			const { tab, plugin } = createTab({
				settings: { mixColors: false },
				saveSettings,
			});
			tab.showExperimental = true;
			tab.display();

			const resetSetting = findSetting(tab.containerEl, "Reset config");
			const resetButton = resetSetting?.querySelector(
				"button",
			) as HTMLButtonElement;
			resetButton.dispatchEvent(new Event("click"));
			await tick();

			expect(saveSettings).toHaveBeenCalled();
			expect(plugin.settings).toEqual(DEFAULT_SETTINGS);
		});
	});

	describe("community palettes section", () => {
		it("renders palette cards, removes loading state, and applies palette on click", async () => {
			const palettesMock: CommunityPalette[] = [
				{
					id: "1-0",
					value: "aabbcc-ddeeff",
					colors: ["#aabbcc", "#ddeeff"],
					author: "alpha",
					score: 3,
				},
			];
			const getPalettesSpy = vi
				.spyOn(CommunityPalettesService, "getCommunityPalettes")
				.mockResolvedValue(palettesMock);
			const saveSettings = vi.fn(async () => {});
			const { tab, plugin } = createTab({
				saveSettings,
				settings: {
					palette: {
						selected: ColoredTagsPaletteType.CUSTOM,
						custom: "",
						seed: 0,
					},
				},
			});
			tab.renderPalette = vi.fn();
			tab.display();
			await tick();

			const cards = tab.containerEl.querySelectorAll(
				".community-palette-card",
			);
			expect(cards).toHaveLength(1);
			expect(
				tab.containerEl.querySelector(".community-palettes__status"),
			).toBeNull();

			const customInput = tab.containerEl.querySelector(
				'input[placeholder="Paste palette"]',
			) as HTMLInputElement;
			(cards[0] as HTMLElement).dispatchEvent(new Event("click"));
			await tick();

			expect(plugin.settings.palette.custom).toBe("aabbcc-ddeeff");
			expect(customInput.value).toBe("aabbcc-ddeeff");
			expect(saveSettings).toHaveBeenCalled();
			expect(tab.renderPalette).toHaveBeenLastCalledWith(
				expect.any(HTMLElement),
				true,
			);
			expect(cards[0].classList.contains("is-selected")).toBe(true);
			expect(cards[0].getAttribute("aria-pressed")).toBe("true");
			getPalettesSpy.mockRestore();
		});

		it("applies community palette via keyboard interaction", async () => {
			const palettesMock: CommunityPalette[] = [
				{
					id: "1-0",
					value: "111111-222222",
					colors: ["#111111", "#222222"],
					author: "alpha",
					score: 3,
				},
			];
			const getPalettesSpy = vi
				.spyOn(CommunityPalettesService, "getCommunityPalettes")
				.mockResolvedValue(palettesMock);
			const { tab, plugin } = createTab({
				settings: {
					palette: {
						selected: ColoredTagsPaletteType.CUSTOM,
						custom: "",
						seed: 0,
					},
				},
			});
			tab.renderPalette = vi.fn();
			tab.display();
			await tick();

			const card = tab.containerEl.querySelector(
				".community-palette-card",
			) as HTMLElement;
			const event = new KeyboardEvent("keydown", {
				key: "Enter",
				bubbles: true,
				cancelable: true,
			});
			card.dispatchEvent(event);
			await tick();

			expect(plugin.settings.palette.custom).toBe("111111-222222");
			expect(card.classList.contains("is-selected")).toBe(true);

			const spaceEvent = new KeyboardEvent("keydown", {
				key: " ",
				bubbles: true,
				cancelable: true,
			});
			card.dispatchEvent(spaceEvent);
			await tick();

			expect(plugin.settings.palette.custom).toBe("111111-222222");
			getPalettesSpy.mockRestore();
		});

		it("auto-selects community palette when custom value matches and clears selection when palette changes", async () => {
			const palettesMock: CommunityPalette[] = [
				{
					id: "match-1",
					value: "aabbcc-ddeeff",
					colors: ["#aabbcc", "#ddeeff"],
					author: "alpha",
					score: 5,
				},
			];
			const getPalettesSpy = vi
				.spyOn(CommunityPalettesService, "getCommunityPalettes")
				.mockResolvedValue(palettesMock);
			const { tab } = createTab({
				settings: {
					palette: {
						selected: ColoredTagsPaletteType.CUSTOM,
						custom: "AABBCC-DDEEFF",
						seed: 0,
					},
				},
			});
			tab.display();
			await tick();

			const card = tab.containerEl.querySelector(
				".community-palette-card",
			) as HTMLElement;
			const input = tab.containerEl.querySelector(
				'input[placeholder="Paste palette"]',
			) as HTMLInputElement;
			expect(card.classList.contains("is-selected")).toBe(true);
			expect(card.getAttribute("aria-pressed")).toBe("true");

			input.value = "ffeeaa-ccbbaa";
			input.dispatchEvent(new Event("input"));
			await tick();

			expect(card.classList.contains("is-selected")).toBe(false);
			expect(card.getAttribute("aria-pressed")).toBe("false");

			input.value = "aabbcc-ddeeff";
			input.dispatchEvent(new Event("input"));
			await tick();

			expect(card.classList.contains("is-selected")).toBe(true);
			getPalettesSpy.mockRestore();
		});

		it("switches selected state when applying a different community palette", async () => {
			const palettesMock: CommunityPalette[] = [
				{
					id: "1-0",
					value: "111111-222222",
					colors: ["#111111", "#222222"],
					author: "one",
					score: 2,
				},
				{
					id: "2-0",
					value: "333333-444444",
					colors: ["#333333", "#444444"],
					author: "two",
					score: 4,
				},
			];
			const getPalettesSpy = vi
				.spyOn(CommunityPalettesService, "getCommunityPalettes")
				.mockResolvedValue(palettesMock);
			const { tab } = createTab({
				saveSettings: vi.fn(async () => {}),
				settings: {
					palette: {
						selected: ColoredTagsPaletteType.CUSTOM,
						custom: "",
						seed: 0,
					},
				},
			});
			tab.display();
			await tick();

			const cards = Array.from(
				tab.containerEl.querySelectorAll(".community-palette-card"),
			) as HTMLElement[];
			cards[0].dispatchEvent(new Event("click"));
			await tick();
			expect(cards[0].classList.contains("is-selected")).toBe(true);
			expect(cards[1].classList.contains("is-selected")).toBe(false);

			cards[1].dispatchEvent(new Event("click"));
			await tick();
			expect(cards[0].classList.contains("is-selected")).toBe(false);
			expect(cards[1].classList.contains("is-selected")).toBe(true);
			getPalettesSpy.mockRestore();
		});

		it("clears community palette selection when custom palette is not active", () => {
			const { tab } = createTab();
			const card = document.createElement("div");
			(tab as any).communityPaletteCards.set("value", card);

			(tab as any).updateCommunityPaletteSelection();

			expect(card.classList.contains("is-selected")).toBe(false);
			expect(card.getAttribute("aria-pressed")).toBe("false");
		});

		it("shows empty state when no community palettes are available", async () => {
			const getPalettesSpy = vi
				.spyOn(CommunityPalettesService, "getCommunityPalettes")
				.mockResolvedValue([]);
			const { tab } = createTab({
				settings: {
					palette: {
						selected: ColoredTagsPaletteType.CUSTOM,
						custom: "",
						seed: 0,
					},
				},
			});
			tab.display();
			await tick();

			const statusEl = tab.containerEl.querySelector(
				".community-palettes__status",
			) as HTMLElement;
			expect(statusEl.textContent).toBe(
				I18n.t("settings.palette.custom.community.empty"),
			);
			getPalettesSpy.mockRestore();
		});

		it("shows error message when community palettes fetch fails", async () => {
			const consoleSpy = vi
				.spyOn(console, "error")
				.mockImplementation(() => {});
			const getPalettesSpy = vi
				.spyOn(CommunityPalettesService, "getCommunityPalettes")
				.mockRejectedValue(new Error("network"));
			const { tab } = createTab({
				settings: {
					palette: {
						selected: ColoredTagsPaletteType.CUSTOM,
						custom: "",
						seed: 0,
					},
				},
			});
			tab.display();
			await tick();

			const statusEl = tab.containerEl.querySelector(
				".community-palettes__status",
			) as HTMLElement;
			expect(statusEl.textContent).toBe(
				I18n.t("settings.palette.custom.community.error"),
			);
			expect(consoleSpy).toHaveBeenCalled();
			consoleSpy.mockRestore();
			getPalettesSpy.mockRestore();
		});
	});
});
