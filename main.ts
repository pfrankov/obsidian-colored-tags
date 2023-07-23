import {App, debounce, MarkdownView, Plugin, PluginSettingTab, Setting} from "obsidian";
import Color from "colorjs.io";

interface ColoredTagsPluginSettings {
	chroma: number;
	lightness: number;
	palette: number;
	seed: number;
	_version: number;
}

const DEFAULT_SETTINGS: ColoredTagsPluginSettings = {
	chroma: 16,
	lightness: 87,
	palette: 32,
	seed: 0,
	_version: 1,
}

export default class ColoredTagsPlugin extends Plugin {
	tagsSet: Set<string> = new Set();
	settings: ColoredTagsPluginSettings;
	palettes = {
		light: [],
		dark: []
	}

	async onload() {
		await this.loadSettings();
		this.reload();

		this.registerEvent(
			this.app.workspace.on("editor-change", debounce(() => {
				const view =
					this.app.workspace.getActiveViewOfType(MarkdownView);
				if (view?.contentEl) {
					this.update(this.getTagsFromDOM(view.contentEl));
				}
			}, 300, true))
		);

		this.registerEvent(
			this.app.workspace.on("active-leaf-change", () => {
				this.update(this.getTagsFromApp());
			})
		);

		this.addSettingTab(new ColoredTagsPluginSettingTab(this.app, this));
	}

	getTagsFromDOM(domEl: HTMLElement): string[] {
		return Array.from(domEl.querySelectorAll(".tag, .cm-hashtag-end"))
			.map((tagEl: HTMLElement) => tagEl.innerText.replace(/#/g, ""))
			.filter((tag) => !tag.match(/\/$/))
			.filter((x) => x);
	}

	getTagsFromApp(): string[] {
		return Object.keys(this.app.metadataCache.getTags())
			.map((tag) => {
				return tag.replace(/#/g, "");
			})
			.filter((tag) => !tag.match(/\/$/))
			.filter((x) => x.length);
	}

	update(tagsList: string[]) {
		if (tagsList.find((tag) => !this.tagsSet.has(tag))) {
			tagsList.forEach((tag) => {
				if (!this.tagsSet.has(tag)) {
					this.tagsSet.add(tag);
					colorizeTag(tag, {palettes: this.palettes, settings: this.settings});
				}
			});
		}
	}

	reload() {
		this.onunload();
		this.generatePalettes();
		this.update(this.getTagsFromApp());
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.reload();
	}

	generatePalettes() {
		const commonPaletteConfig = {
			paletteSize: this.settings.palette,
			baseChroma: this.settings.chroma,
			baseLightness: this.settings.lightness,
		};

		this.palettes = {
			light: generateColorPalette({
				isDarkTheme: false,
				...commonPaletteConfig
			}),
			dark: generateColorPalette({
				isDarkTheme: true,
				...commonPaletteConfig
			})
		};
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	onunload() {
		this.tagsSet.clear();
		removeCSS();
	}
}

function darkenColorForContrast(baseColor, contrast = 4.5) {
	const colorLight = new Color(baseColor).to("lch");
	const colorDark = new Color(baseColor).to("lch");

	colorLight.c += 3;
	colorDark.c += 20;

	for (let i = 0; i < 100; i++) {
		if (
			colorLight.contrastAPCA(baseColor) >= 60 &&
			colorLight.contrastWCAG21(baseColor) >= contrast
		) {
			return colorLight.toString();
		}
		if (
			colorDark.contrastAPCA(baseColor) <= -60 &&
			colorDark.contrastWCAG21(baseColor) >= contrast
		) {
			return colorDark.toString();
		}

		colorLight.l++;
		colorDark.l--;
	}
	return "#fff";
}

function getColors(
	input: string,
	palette,
	seed
): { background: string; color: string } {
	const chunks = input.split("/");
	const background =
		chunks
			.reduce((acc, chunk, i) => {
				const color = generateUniqueColor(chunk, palette, seed);
				if (acc) {
					return acc.mix(
						color,
						((chunks.length - i) / chunks.length) * 0.3 + 0.2
					);
				}
				return new Color(color);
			}, null)
			?.to("lch")
			.toString({format: "lch"});

	const color = darkenColorForContrast(background);

	return {background, color};
}

function colorizeTag(tagName: string, { palettes, settings }) {
	tagName = tagName.replace(/#/g, "");

	const tagHref = "#" + tagName.replace(/\//g, "\\/");
	const tagFlat = tagName.replace(/\//g, "");


	const {background: backgroundLight, color: colorLight} = getColors(tagName, palettes.light, settings.seed);
	const {background: backgroundDark, color: colorDark} = getColors(
		tagName,
		palettes.dark,
		settings.seed
	);
	appendCSS(`
			body a.tag[href="${tagHref}"], body .cm-s-obsidian .cm-line span.cm-tag-${tagFlat}.cm-hashtag {
				background-color: ${backgroundLight};
				color: ${colorLight};
			}
			body.theme-dark a.tag[href="${tagHref}"], body.theme-dark .cm-s-obsidian .cm-line span.cm-tag-${tagFlat}.cm-hashtag {
				background-color: ${backgroundDark};
				color: ${colorDark};
			}
	`);

}

function generateUniqueColor(string: string, palette, seed) {
	let hashCode = 0;
	for (let i = 0; i < string.length; i++) {
		hashCode = string.charCodeAt(i) + seed + ((hashCode << 5) - hashCode);
	}

	hashCode = Math.abs(hashCode) % palette.length;
	return palette[hashCode];
}

interface ColorGeneratorConfig {
	isDarkTheme: boolean;
	paletteSize: number;
	baseChroma: number;
	baseLightness: number;
}

function generateColorPalette({isDarkTheme, paletteSize, baseChroma, baseLightness}: ColorGeneratorConfig) {
	const hueIncrement = 360 / paletteSize;

	const colorPalette = [];
	for (let i = 0; i < paletteSize; i++) {
		const hue = i * hueIncrement;

		let chroma = baseChroma;
		let lightness = baseLightness;
		if (isDarkTheme) {
			chroma = Math.round(baseChroma * 1.8);
			lightness = Math.round(baseLightness / 2.5);
		}

		const lchColor = new Color("lch", [lightness, chroma, hue]).toString();
		colorPalette.push(lchColor);
	}

	return colorPalette;
}

function appendCSS(css: string): void {
	let styleEl = document.head.querySelector('[colored-tags-style]');
	if (!styleEl) {
		styleEl = document.head
			.createEl("style", {
				type: "text/css",
				attr: {"colored-tags-style": ""},
			});
	}
	styleEl.appendText(css);
}

function removeCSS(): void {
	document.head.querySelectorAll('[colored-tags-style]').forEach((el) => {
		el.remove();
	});
}


class ColoredTagsPluginSettingTab extends PluginSettingTab {
	plugin: ColoredTagsPlugin;

	constructor(app: App, plugin: ColoredTagsPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Palette size')
			.setDesc('How many different colors are available.')
			.addSlider(slider =>
				slider.setLimits(9, 36, 9)
					.setValue(this.plugin.settings.palette)
					.onChange(async (value) => {
						slider.showTooltip();
						this.plugin.settings.palette = value;
						await this.plugin.saveSettings();
					})
			)

		new Setting(containerEl)
			.setName('Saturation')
			.addDropdown(dropdown =>
				dropdown.addOption(String(DEFAULT_SETTINGS.chroma), 'Default')
					.addOptions({
						'5': 'Faded',
						'32': 'Moderate',
						'64': 'Vivid',
						'128': 'Excessive',
					})
					.setValue(String(this.plugin.settings.chroma))
					.onChange(async (value) => {
						this.plugin.settings.chroma = Number(value);
						await this.plugin.saveSettings();
					})
			)

		new Setting(containerEl)
			.setName('Lightness')
			.addDropdown(dropdown =>
				dropdown.addOption(String(DEFAULT_SETTINGS.lightness), 'Default')
					.addOptions({
						'0': 'Dark',
						'32': 'Medium Dark',
						'64': 'Medium',
						'90': 'Light',
						'100': 'Bleach',
					})
					.setValue(String(this.plugin.settings.lightness))
					.onChange(async (value) => {
						this.plugin.settings.lightness = Number(value);
						await this.plugin.saveSettings();
					})
			)

		new Setting(containerEl)
			.setName('Palette shift')
			.setDesc('If the colors of some tags don\'t fit or are too repetitive, you can shift the palette.')
			.addSlider(slider =>
				slider.setLimits(0, 10, 1)
					.setValue(this.plugin.settings.seed)
					.onChange(async (value) => {
						slider.showTooltip();
						this.plugin.settings.seed = value;
						await this.plugin.saveSettings();
					})
			)
	}
}
