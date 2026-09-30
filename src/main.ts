import { debounce, Plugin } from "obsidian";
import { coloredClassApplierPlugin } from "./ColoredClassApplierPlugin";
import { BaseViewTagApplier } from "./tag-appliers/BaseViewTagApplier";
import { ColoredTagsPluginSettingTab } from "./ColoredTagsPluginSettingTab";
import { DEFAULT_SETTINGS } from "./defaultSettings";
import {
	ColoredTagsPluginSettings,
	ColoredTagsPaletteType,
} from "./interfaces";
import { ColorService } from "./ColorService";
import { CSSManager } from "./CSSManager";
import { TagManager } from "./TagManager";
import { normalizePaletteIndex, normalizeTagName } from "./tagUtils";
import { PropertiesTagApplier } from "./tag-appliers/PropertiesTagApplier";

type LegacySettingsData = {
	_version: number;
	palette: number | ColoredTagsPluginSettings["palette"];
	seed?: number;
	chroma?: number;
	lightness?: number;
	tagColors?: Record<string, number>;
	[key: string]: unknown;
};

export default class ColoredTagsPlugin extends Plugin {
	private static readonly EDITOR_CHANGE_DEBOUNCE = 3000; // 3 seconds
	private static readonly LEAF_CHANGE_DEBOUNCE = 300; // 300ms

	settings!: ColoredTagsPluginSettings;
	palettes = {
		light: [] as string[],
		dark: [] as string[],
	};
	private tagColorMap: Map<string, number> = new Map();
	private baseViewTagApplier = new BaseViewTagApplier();
	private propertiesTagApplier = new PropertiesTagApplier();

	private colorService!: ColorService;
	private cssManager!: CSSManager;
	private tagManager!: TagManager;
	private saveKnownTagsPromise: Promise<void> | null = null;
	private saveKnownTagsQueued = false;

	async onload() {
		await this.loadSettings();
		this.colorService = new ColorService();
		this.cssManager = new CSSManager();
		this.tagManager = new TagManager(this.settings.knownTags);

		this.app.workspace.onLayoutReady(async () => {
			await this.saveKnownTags();
			this.reload();

			this.registerEvent(
				this.app.workspace.on(
					"editor-change",
					debounce(
						async () => {
							await this.saveKnownTags();
							this.update();
						},
						ColoredTagsPlugin.EDITOR_CHANGE_DEBOUNCE,
						true,
					),
				),
			);

			this.registerEvent(
				this.app.workspace.on(
					"active-leaf-change",
					debounce(
						async () => {
							await this.saveKnownTags();
							this.update();
						},
						ColoredTagsPlugin.LEAF_CHANGE_DEBOUNCE,
						true,
					),
				),
			);

			this.addSettingTab(new ColoredTagsPluginSettingTab(this.app, this));
			this.registerEditorExtension(coloredClassApplierPlugin);
		});
	}

	async saveKnownTags() {
		this.saveKnownTagsQueued = true;

		if (this.saveKnownTagsPromise) {
			await this.saveKnownTagsPromise;
			if (this.saveKnownTagsQueued) {
				await this.saveKnownTags();
			}
			return;
		}

		this.saveKnownTagsPromise = this.flushKnownTagsUpdates().finally(() => {
			this.saveKnownTagsPromise = null;
		});
		await this.saveKnownTagsPromise;
	}

	private async flushKnownTagsUpdates(): Promise<void> {
		while (this.saveKnownTagsQueued) {
			this.saveKnownTagsQueued = false;
			const hasChanges = await this.tagManager.updateKnownTags(
				this.app.metadataCache,
			);

			if (!hasChanges) {
				continue;
			}

			this.settings.knownTags = this.tagManager.exportKnownTags();
			await this.saveData(this.settings);
		}
	}

	update() {
		const tags = this.tagManager.getTagsMap();
		tags.forEach((order, tagName) => {
			if (!this.tagManager.isRendered(tagName)) {
				this.tagManager.markAsRendered(tagName);
				this.colorizeTag(tagName);
			}
		});
	}

	reload(palettes?: { light: string[]; dark: string[] }) {
		this.onunload();
		this.palettes =
			palettes ??
			this.colorService.generatePalettes(this.settings.palette);
		this.refreshTagColorMap();
		this.baseViewTagApplier.start();
		this.propertiesTagApplier.start();
		this.update();
	}

	async saveSettings() {
		const previousPalettes = {
			light: [...this.palettes.light],
			dark: [...this.palettes.dark],
		};
		const nextPalettes = this.colorService.generatePalettes(
			this.settings.palette,
		);
		if (this.havePalettesChanged(previousPalettes, nextPalettes)) {
			this.remapTagColors(previousPalettes, nextPalettes);
		}
		await this.saveData(this.settings);
		this.reload(nextPalettes);
	}

	colorizeTag(tagName: string) {
		tagName = tagName.replace(/#/g, "");

		const tagsMap = this.tagManager.getTagsMap();

		const getColors = (palette: string[]) =>
			this.colorService.getColors(
				tagName,
				palette,
				tagsMap,
				{
					isMixing: this.settings.mixColors,
					isTransition: this.settings.transition,
					highTextContrast:
						this.settings.accessibility.highTextContrast,
				},
				this.tagColorMap,
			);

		const light = getColors(this.palettes.light);
		const dark = getColors(this.palettes.dark);

		this.cssManager.setTagColors(tagName, light, dark);
	}

	async loadSettings() {
		const loadedData = (await this.loadData()) as LegacySettingsData | null;
		this.settings = this.migrateSettings(loadedData);
	}

	private migrateSettings(
		loadedData: LegacySettingsData | null,
	): ColoredTagsPluginSettings {
		const data = (loadedData ? { ...loadedData } : {}) as LegacySettingsData;
		let currentVersion = data._version ?? 0;
		let needToSave = false;

		const applyMigration = (targetVersion: number, action: () => void) => {
			if (currentVersion < targetVersion) {
				action();
				currentVersion = targetVersion;
				data._version = targetVersion;
				needToSave = true;
			}
		};

		applyMigration(2, () => {
			data.palette = 16;
		});

		applyMigration(3, () => {
			data.palette = {
				...DEFAULT_SETTINGS.palette,
				seed: data.seed || 0,
			};
			if ((data.chroma as number) > 16 || (data.lightness as number) > 87) {
				data.palette.selected = ColoredTagsPaletteType.ADAPTIVE_BRIGHT;
			}
			delete data.chroma;
			delete data.lightness;
			delete data.seed;
		});

		applyMigration(4, () => {
			data.tagColors = data.tagColors || {};
		});

		const settings = Object.assign({}, DEFAULT_SETTINGS, data) as ColoredTagsPluginSettings;
		if (needToSave) {
			void this.saveData(settings);
		}
		return settings;
	}

	onunload() {
		this.tagManager.clearRenderedTags();
		this.cssManager.removeAll();
		this.baseViewTagApplier.stop();
		this.propertiesTagApplier.stop();
	}

	private refreshTagColorMap(): void {
		this.tagColorMap = new Map(
			Object.entries(this.settings.tagColors || {}).map(
				([tagName, paletteIndex]) => [
					normalizeTagName(tagName),
					paletteIndex,
				],
			),
		);
	}

	private havePalettesChanged(
		prev: { light: string[]; dark: string[] },
		next: { light: string[]; dark: string[] },
	): boolean {
		return (
			prev.light.length !== next.light.length ||
			prev.dark.length !== next.dark.length ||
			prev.light.some((color, index) => color !== next.light[index]) ||
			prev.dark.some((color, index) => color !== next.dark[index])
		);
	}

	private remapTagColors(
		previousPalettes: { light: string[]; dark: string[] },
		nextPalettes: { light: string[]; dark: string[] },
	): void {
		if (!previousPalettes.light.length || !nextPalettes.light.length) {
			return;
		}

		const remapped: Record<string, number> = {};
		const nextPalette = nextPalettes.light;
		const previousPalette = previousPalettes.light;

		Object.entries(this.settings.tagColors || {}).forEach(
			([tagName, paletteIndex]) => {
				const normalizedIndex = normalizePaletteIndex(
					paletteIndex,
					previousPalette.length,
				);
				const sourceColor = previousPalette[normalizedIndex];
				const normalizedTagName = normalizeTagName(tagName);
				if (!normalizedTagName) {
					return;
				}
				const bestMatch = this.colorService.findClosestColorIndex(
					sourceColor,
					nextPalette,
				);
				remapped[normalizedTagName] = bestMatch;
			},
		);

		this.settings.tagColors = remapped;
	}
}
