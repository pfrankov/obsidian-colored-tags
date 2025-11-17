import { debounce, Notice, Plugin, requestUrl } from "obsidian";
import { coloredClassApplierPlugin } from "./ColoredClassApplierPlugin";
import { ColoredTagsPluginSettingTab } from "./ColoredTagsPluginSettingTab";
import { DEFAULT_SETTINGS } from "./defaultSettings";
import {
	ColoredTagsPluginSettings,
	ColoredTagsPaletteType,
} from "./interfaces";
import { ColorService } from "./ColorService";
import { CSSManager } from "./CSSManager";
import { TagManager } from "./TagManager";
import { I18n } from "./i18n";

export default class ColoredTagsPlugin extends Plugin {
	private static readonly INITIAL_UPDATE_CHECK_DELAY = 5000; // 5 seconds
	private static readonly EDITOR_CHANGE_DEBOUNCE = 3000; // 3 seconds
	private static readonly LEAF_CHANGE_DEBOUNCE = 300; // 300ms
	private static readonly UPDATE_CHECK_INTERVAL = 10800000; // 3 hours

	settings!: ColoredTagsPluginSettings;
	palettes = {
		light: [] as string[],
		dark: [] as string[],
	};

	private colorService!: ColorService;
	private cssManager!: CSSManager;
	private tagManager!: TagManager;
	private updatingInterval!: number;

	async onload() {
		await this.loadSettings();
		this.colorService = new ColorService();
		this.cssManager = new CSSManager();
		this.tagManager = new TagManager(this.settings.knownTags);

		this.app.workspace.onLayoutReady(async () => {
			await this.saveKnownTags();
			this.reload();

			window.setTimeout(() => {
				this.checkUpdates();
			}, ColoredTagsPlugin.INITIAL_UPDATE_CHECK_DELAY);

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
		const hasChanges = await this.tagManager.updateKnownTags(
			this.app.metadataCache,
		);

		if (hasChanges) {
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

	async checkUpdates() {
		try {
			const { json: response } = await requestUrl({
				url: "https://api.github.com/repos/pfrankov/obsidian-colored-tags/releases/latest",
				method: "GET",
				headers: {
					"Content-Type": "application/json",
				},
				contentType: "application/json",
			});

			if (response.tag_name !== this.manifest.version) {
				const pluginName = this.manifest?.name ?? "Colored Tags";
				new Notice(I18n.t("notices.updateAvailable", { pluginName }));
			}
		} catch (error) {
			console.error(error);
		}
	}

	reload() {
		this.onunload();
		this.palettes = this.colorService.generatePalettes(
			this.settings.palette,
		);
		this.update();
		this.updatingInterval = window.setInterval(
			() => this.checkUpdates(),
			ColoredTagsPlugin.UPDATE_CHECK_INTERVAL,
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.reload();
	}

	colorizeTag(tagName: string) {
		tagName = tagName.replace(/#/g, "");

		const tagsMap = this.tagManager.getTagsMap();

		const getColors = (palette: string[]) =>
			this.colorService.getColors(tagName, palette, tagsMap, {
				isMixing: this.settings.mixColors,
				isTransition: this.settings.transition,
				highTextContrast: this.settings.accessibility.highTextContrast,
			});

		const light = getColors(this.palettes.light);
		const dark = getColors(this.palettes.dark);

		const selectors = this.buildTagSelectors(tagName);
		const groups: Array<{
			prefix: string;
			colors: {
				background: string;
				color: string;
				linearGradient: string[];
			};
		}> = [
			{ prefix: "body", colors: light },
			{ prefix: "body.theme-dark", colors: dark },
		];

		const css = groups
			.map(({ prefix, colors }) => {
				const scoped = selectors
					.map((s) => `${prefix} ${s}`)
					.join(", ");
				return `${scoped} {\n\tbackground-color: ${
					colors.background
				};\n\tcolor: ${
					colors.color
				};\n\tbackground-image: linear-gradient(108deg, ${colors.linearGradient.join(
					", ",
				)});\n\t}`;
			})
			.join("\n");

		this.cssManager.append(`\n${css}\n`);
	}

	private buildTagSelectors(tagName: string): string[] {
		const tagHref = `#${tagName.replace(/\//g, "\\/")}`;
		const tagFlat = tagName.replace(/[^0-9a-z-]/gi, "");
		const tagLower = tagName.toLowerCase().replace(/\//g, "\\/");

		const selectors = [
			`a.tag[href="${tagHref}"]`,
			`.cm-s-obsidian .cm-line span.cm-hashtag.colored-tag-${tagLower}`,
		];

		if (tagFlat) {
			const flatLower = tagFlat.toLowerCase();
			selectors.push(
				`.cm-s-obsidian .cm-line span.cm-tag-${flatLower}.cm-hashtag`,
				`.cm-s-obsidian .cm-line span.cm-tag-${tagFlat}.cm-hashtag`,
			);
		}

		return selectors;
	}

	async loadSettings() {
		const loadedData = await this.loadData();
		this.settings = this.migrateSettings(loadedData);
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private migrateSettings(loadedData: any): ColoredTagsPluginSettings {
		let needToSave = false;

		if (loadedData && loadedData._version < 2) {
			loadedData.palette = 16;
			loadedData._version = 2;
			needToSave = true;
		}

		if (loadedData && loadedData._version < 3) {
			loadedData.palette = {
				...DEFAULT_SETTINGS.palette,
				seed: loadedData.seed || 0,
			};

			if (loadedData.chroma > 16 || loadedData.lightness > 87) {
				loadedData.palette.selected =
					ColoredTagsPaletteType.ADAPTIVE_BRIGHT;
			}

			delete loadedData.chroma;
			delete loadedData.lightness;
			delete loadedData.seed;
			loadedData._version = 3;
			needToSave = true;
		}

		const settings = Object.assign({}, DEFAULT_SETTINGS, loadedData);

		if (needToSave) {
			this.saveData(settings);
		}

		return settings;
	}

	onunload() {
		this.tagManager.clearRenderedTags();
		this.cssManager.removeAll();
		window.clearInterval(this.updatingInterval);
	}
}
