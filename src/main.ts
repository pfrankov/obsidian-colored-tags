import { debounce, Plugin } from "obsidian";
import Color from "colorjs.io";
import { coloredClassApplyerPlugin } from "./coloredClassApplyerPlugin";
import { ColoredTagsPluginSettingTab } from "./ColoredTagsPluginSettingTab";
import { DEFAULT_SETTINGS } from "./defaultSettings";
import {
	ColoredTagsPaletteType,
	ColoredTagsPluginSettings,
	ColorGeneratorConfig,
	ColorProcessorConfig,
} from "./interfaces";

export default class ColoredTagsPlugin extends Plugin {
	renderedTagsSet: Set<string> = new Set();
	tagsMap: Map<string, number>;

	settings: ColoredTagsPluginSettings;
	palettes = {
		light: [],
		dark: [],
	};

	async onload() {
		await this.loadSettings();
		this.tagsMap = new Map(Object.entries(this.settings.knownTags));

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
						3000,
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
						300,
						true,
					),
				),
			);

			this.addSettingTab(new ColoredTagsPluginSettingTab(this.app, this));
			this.registerEditorExtension(coloredClassApplyerPlugin);
		});
	}

	// O(n^2)
	// Need to be optimized
	async saveKnownTags() {
		let isNeedToSave = false;

		const combinedSet = new Set(this.tagsMap.keys());
		this.getTagsFromApp().forEach((tag) => {
			combinedSet.add(tag);
		});
		const combinedTags = Array.from(combinedSet);
		combinedTags.forEach((tag, index) => {
			const chunks = tag.split("/");

			let combinedTag = "";
			chunks.forEach((chunk, chunkIndex) => {
				const key = [combinedTag, chunk].filter(Boolean).join("/");
				if (!this.tagsMap.has(key)) {
					const siblings = combinedTags.filter((keyd) => {
						return (
							keyd.split("/").length === chunkIndex + 1 &&
							keyd.startsWith(combinedTag)
						);
					});

					const maxValue = siblings.reduce((acc, sibling) => {
						return Math.max(acc, this.tagsMap.get(sibling) || 0);
					}, 0);

					this.tagsMap.set(key, maxValue + 1);
					isNeedToSave = true;
				}

				combinedTag = key;
			});
		});

		if (isNeedToSave) {
			this.settings.knownTags = Object.fromEntries(
				this.tagsMap.entries(),
			);
			await this.saveData(this.settings);
		}
	}

	getTagsFromApp(): string[] {
		const tagsArray = Object.keys(this.app.metadataCache.getTags());
		return tagsArray
			.map((tag) => {
				return tag.replace(/#/g, "");
			})
			.filter((tag) => !tag.match(/\/$/))
			.filter((x) => x.length);
	}

	update() {
		const tags = this.tagsMap;
		tags.forEach((order, tagName) => {
			if (!this.renderedTagsSet.has(tagName)) {
				this.renderedTagsSet.add(tagName);
				this.colorizeTag(tagName);
			}
		});
	}

	reload() {
		this.onunload();
		this.generatePalettes();
		this.update();
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.reload();
	}

	getColors(
		input: string,
		palette: string[],
		isMixing: boolean,
		isTransition: boolean,
		highTextContrast: boolean,
	): { background: string; color: string; linearGradient: [] } {
		const chunks = input.split("/");
		let combinedTag = "";
		const gradientStops: { color: string; chunk: string }[] = [];
		let backgroundColor: Color;
		let lastColor = "";

		chunks.forEach((chunk) => {
			const key = [combinedTag, chunk].filter(Boolean).join("/");
			const order = this.tagsMap.get(key) || 1;
			const filteredPalette = palette.filter(
				(colorString) => colorString !== lastColor,
			);
			const colorFromPalette =
				filteredPalette[(order - 1) % filteredPalette.length];
			lastColor = colorFromPalette;

			let newColor;
			if (backgroundColor) {
				if (isMixing) {
					const mixingLevel = isTransition ? 0.5 : 0.4;

					newColor = backgroundColor.mix(
						colorFromPalette,
						mixingLevel,
						{ space: "lch" },
					);
					if (newColor.deltaE2000(backgroundColor) < 10) {
						newColor = backgroundColor.mix(
							colorFromPalette,
							mixingLevel + 0.1,
							{ space: "lch" },
						);
					}
				} else {
					newColor = new Color(colorFromPalette).to("lch");
				}
			}
			if (!backgroundColor) {
				backgroundColor = new Color(colorFromPalette).to("lch");
				combinedTag = key;
				newColor = backgroundColor;
			}

			gradientStops.push({
				color: newColor.toString({ format: "lch" }),
				chunk,
			});
		});

		const background = backgroundColor.toString({ format: "lch" });

		const defaultGap = isTransition ? 50 : 0;
		const gap = (defaultGap / gradientStops.length) * 2;
		const sumOfGaps = gap * (gradientStops.length - 1);
		const elementSize = (100 - sumOfGaps) / gradientStops.length;

		const linearGradient: string[] = gradientStops.map((item, index) => {
			const start = index * (elementSize + gap);
			const end = start + elementSize;
			return `${item.color} ${start}% max(2em, ${end}%)`;
		});

		let color;
		if (highTextContrast) {
			const whiteColor = new Color("white");
			const blackColor = new Color("black");
			const onWhite = Math.abs(
				backgroundColor.contrast(whiteColor, "APCA"),
			);
			const onBlack = Math.abs(
				backgroundColor.contrast(blackColor, "APCA"),
			);

			color = onWhite > onBlack ? whiteColor : blackColor;
		} else {
			color = darkenColorForContrast(backgroundColor);
		}

		return { background, color, linearGradient };
	}

	colorizeTag(tagName: string) {
		tagName = tagName.replace(/#/g, "");

		const tagHref = "#" + tagName.replace(/\//g, "\\/");
		const tagFlat = tagName.replace(/[^0-9a-z-]/gi, "");

		const {
			background: backgroundLight,
			color: colorLight,
			linearGradient: linearGradientLight,
		} = this.getColors(
			tagName,
			this.palettes.light,
			this.settings.mixColors,
			this.settings.transition,
			this.settings.accessibility.highTextContrast,
		);
		const {
			background: backgroundDark,
			color: colorDark,
			linearGradient: linearGradientDark,
		} = this.getColors(
			tagName,
			this.palettes.dark,
			this.settings.mixColors,
			this.settings.transition,
			this.settings.accessibility.highTextContrast,
		);

		const selectors = [
			`a.tag[href="${tagHref}"]`,
			`.cm-s-obsidian .cm-line span.cm-hashtag.colored-tag-${tagName
				.toLowerCase()
				.replace(/\//g, "\\/")}`,
		];

		if (tagFlat) {
			selectors.push(
				`.cm-s-obsidian .cm-line span.cm-tag-${tagFlat.toLowerCase()}.cm-hashtag`,
			);
			selectors.push(
				`.cm-s-obsidian .cm-line span.cm-tag-${tagFlat}.cm-hashtag`,
			);
		}

		const lightThemeSelectors = selectors.map(
			(selector) => "body " + selector,
		);
		const darkThemeSelectors = selectors.map(
			(selector) => "body.theme-dark " + selector,
		);

		const linearGradientRotation = "108deg";
		appendCSS(`
			${lightThemeSelectors.join(", ")} {
				background-color: ${backgroundLight};
				color: ${colorLight};
				background-image: linear-gradient(${linearGradientRotation}, ${linearGradientLight.join(
					", ",
				)});
			}
			${darkThemeSelectors.join(", ")} {
				background-color: ${backgroundDark};
				color: ${colorDark};
				background-image: linear-gradient(${linearGradientRotation}, ${linearGradientDark.join(
					", ",
				)});
			}
		`);
	}

	generatePalettes() {
		if (this.settings.palette.selected === ColoredTagsPaletteType.CUSTOM) {
			const paletteString = this.settings.palette.custom;
			const palette = paletteString
				.split("-")
				.filter(Boolean)
				.map((str) => `#${str}`);

			if (palette) {
				this.palettes = {
					light: processColorPalette({
						isDarkTheme: false,
						palette,
						seed: this.settings.palette.seed,
					}),
					dark: processColorPalette({
						isDarkTheme: true,
						palette,
						seed: this.settings.palette.seed,
					}),
				};
				return;
			}
		}

		let baseChroma = 16;
		let baseLightness = 87;
		let offset = 35;

		if (
			this.settings.palette.selected ===
			ColoredTagsPaletteType.ADAPTIVE_BRIGHT
		) {
			baseChroma = 85;
			baseLightness = 75;
		}

		const commonPaletteConfig = {
			paletteSize: 8,
			seed: this.settings.palette.seed,
			isShuffling: true,
			baseChroma,
			baseLightness,
		};

		this.palettes = {
			light: generateAdaptiveColorPalette({
				isDarkTheme: false,
				...commonPaletteConfig,
				constantOffset: offset,
			}),
			dark: generateAdaptiveColorPalette({
				isDarkTheme: true,
				...commonPaletteConfig,
				constantOffset: offset,
			}),
		};
	}

	async loadSettings() {
		const loadedData = await this.loadData();
		let needToSave = false;

		// Migration
		if (loadedData && loadedData._version < 2) {
			needToSave = true;

			loadedData.palette = 16;
			loadedData._version = 2;
		}
		if (loadedData && loadedData._version < 3) {
			needToSave = true;

			delete loadedData.palette;

			loadedData.palette = {
				...DEFAULT_SETTINGS.palette,
				seed: loadedData.seed,
			};

			if (loadedData.chroma > 16 || loadedData.lightness > 87) {
				loadedData.palette.selected =
					ColoredTagsPaletteType.ADAPTIVE_BRIGHT;
			}

			delete loadedData.chroma;
			delete loadedData.lightness;
			delete loadedData.seed;
			loadedData._version = 3;
		}

		this.settings = Object.assign({}, DEFAULT_SETTINGS, loadedData);

		if (needToSave) {
			await this.saveData(this.settings);
		}
	}

	onunload() {
		this.renderedTagsSet.clear();
		removeCSS();
	}
}

const darkenMemoization = new Map();
function darkenColorForContrast(baseColor) {
	const CONTRAST = 4.5;
	const memoizationKey = `${baseColor}`;
	if (darkenMemoization.has(memoizationKey)) {
		return darkenMemoization.get(memoizationKey);
	}

	const colorLight = new Color(baseColor).to("lch");
	const colorDark = new Color(baseColor).to("lch");

	colorLight.c += 3;
	colorDark.c += 20;

	if (colorLight.c > 100) {
		colorLight.c = 100;
	}
	if (colorDark.c > 100) {
		colorDark.c = 100;
	}

	let result = "#fff";
	for (let i = 0; i < 100; i++) {
		if (
			baseColor.contrastAPCA(colorLight) <= -60 &&
			colorLight.contrastWCAG21(baseColor) >= CONTRAST
		) {
			result = colorLight.toString();
			break;
		}
		if (
			baseColor.contrastAPCA(colorDark) >= 60 &&
			colorDark.contrastWCAG21(baseColor) >= CONTRAST
		) {
			result = colorDark.toString();
			break;
		}

		colorLight.l++;
		colorDark.l--;
	}

	darkenMemoization.set(memoizationKey, result);
	return result;
}

function generateAdaptiveColorPalette({
	isDarkTheme,
	paletteSize,
	baseChroma,
	baseLightness,
	constantOffset,
	isShuffling,
	seed,
}: ColorGeneratorConfig) {
	const hueIncrement = 360 / paletteSize;

	const availableColors = [];

	for (let i = 0; i < paletteSize; i++) {
		const hue = i * hueIncrement + constantOffset;

		let chroma = baseChroma;
		let lightness = baseLightness;
		if (isDarkTheme) {
			chroma = Math.min(Math.round(baseChroma * 1.8), 100);
			lightness = Math.min(Math.round(baseLightness / 2.5), 100);
		}

		const lchColor = new Color("lch", [
			lightness,
			chroma,
			hue % 360,
		]).toString();
		availableColors.push(lchColor);
	}

	if (!isShuffling) {
		return availableColors;
	}

	const result = [];

	let next = 0;
	const len = availableColors.length;
	while (result.length < len) {
		result.push(availableColors[next]);
		availableColors.splice(next, 1);
		next =
			Math.round(next + availableColors.length / 3) %
			availableColors.length;
	}

	const cut = result.splice(-seed, seed);
	result.splice(0, 0, ...cut);

	return result;
}
function processColorPalette({
	isDarkTheme,
	palette,
	seed,
}: ColorProcessorConfig) {
	const availableColors = [];

	for (const item of palette) {
		availableColors.push(new Color(item).to("lch").toString());
	}

	const result = availableColors;

	const cut = result.splice(-seed, seed);
	result.splice(0, 0, ...cut);

	return result;
}

let appendingCSSBuffer = [];
function appendCSS(css: string): void {
	appendingCSSBuffer.push(css);
	if (appendingCSSBuffer.length > 1) {
		return;
	}
	// Delay DOM manipulation for next tick
	Promise.resolve().then(() => {
		let styleEl = document.head.querySelector("[colored-tags-style]");
		if (!styleEl) {
			styleEl = document.head.createEl("style", {
				type: "text/css",
				attr: { "colored-tags-style": "" },
			});
		}
		styleEl.appendText(appendingCSSBuffer.join("\n"));

		appendingCSSBuffer = [];
	});
}

function removeCSS(): void {
	document.head.querySelectorAll("[colored-tags-style]").forEach((el) => {
		el.remove();
	});
}
