import { Plugin, MarkdownView } from "obsidian";
import Color from "colorjs.io";

interface ColoredTagsPluginSettings {
	mySetting: string;
}

const DEFAULT_SETTINGS: ColoredTagsPluginSettings = {
	mySetting: "default",
};

export default class ColoredTagsPlugin extends Plugin {
	settings: ColoredTagsPluginSettings;
	updateDebounce: NodeJS.Timeout;
	tagsSet: Set<string> = new Set();

	async onload() {
		this.registerEvent(
			this.app.workspace.on("editor-change", () => {
				this.updateDebounce && clearTimeout(this.updateDebounce);
				this.updateDebounce = setTimeout(() => {
					const view =
						this.app.workspace.getActiveViewOfType(MarkdownView);
					if (view?.contentEl) {
						this.update(this.getTagsFromDOM(view.contentEl));
					}
				}, 300);
			})
		);

		this.tagsSet.clear();
		this.update(this.getTagsFromApp());

		this.registerEvent(
			this.app.workspace.on("active-leaf-change", () => {
				this.tagsSet.clear();
				this.update(this.getTagsFromApp());
			})
		);
	}

	getTagsFromDOM(domEl: HTMLElement): string[] {
		return Array.from(domEl.querySelectorAll(".tag, .cm-hashtag-end"))
			.map((tagEl: HTMLElement) => tagEl.innerText.replace(/\#/g, ""))
			.filter((tag) => !tag.match(/\/$/))
			.filter((x) => x);
	}

	getTagsFromApp(): string[] {
		return Object.keys(this.app.metadataCache.getTags())
			.map((tag) => {
				const tagName = tag.replace(/\#/g, "");

				return tagName;
			})
			.filter((tag) => !tag.match(/\/$/))
			.filter((x) => x.length);
	}

	update(tagsList: string[]) {
		if (tagsList.find((tag) => !this.tagsSet.has(tag))) {
			tagsList.forEach((tag) => {
				this.tagsSet.add(tag);
			});
			colorizeTags(Array.from(this.tagsSet.keys()));
		}
	}

	onunload() {
		this.updateDebounce && clearTimeout(this.updateDebounce);
		this.tagsSet.clear();
		removeCSS();
	}
}

function darkenColorForContrast(baseColor, contrast = 4.5) {
	const colorLight = new Color(baseColor).to("lch");
	const colorDark = new Color(baseColor).to("lch");

	colorLight.c = Math.max(colorLight.c + 3, 0);
	colorDark.c = Math.max(colorDark.c + 20, 0);

	for (let i = 0; i < 100; i++) {
		if (
			colorLight.contrastAPCA(baseColor) >= 60 &&
			colorLight.contrastWCAG21(baseColor) > contrast
		) {
			return colorLight.toString();
		}
		if (
			colorDark.contrastAPCA(baseColor) <= -60 &&
			colorDark.contrastWCAG21(baseColor) > contrast
		) {
			return colorDark.toString();
		}

		colorLight.l++;
		colorDark.l--;
	}
	return "#f00";
}

function getColors(
	input: string,
	isDarkTheme: boolean
): { background: string; color: string } {
	const chunks = input.split("/");
	const background =
		chunks
			.reduce((acc, chunk, i) => {
				const color = generateUniqueColor(chunk, isDarkTheme);
				if (acc) {
					return acc.mix(
						color,
						((chunks.length - i) / chunks.length) * 0.3 + 0.2
					);
				}
				return new Color(color);
			}, null)
			?.to("lch")
			.toString({ format: "lch" }) || "#000";

	const color = darkenColorForContrast(background);

	return { background, color };
}

function colorizeTags(tagNames: string[]) {
	tagNames = tagNames.map((tag) => tag.replace(/\#/g, ""));

	const css = tagNames
		.map((tagName) => {
			const tagHref = "#" + tagName.replace(/\//g, "\\/");
			const tagFlat = tagName.replace(/\//g, "");
			
			const { background: backgroundLight, color: colorLight } =
				getColors(tagName, false);
			const { background: backgroundDark, color: colorDark } = getColors(
				tagName,
				true
			);
			return `
				body a.tag[href="${tagHref}"], body .cm-s-obsidian .cm-line span.cm-tag-${tagFlat}.cm-hashtag {
					background-color: ${backgroundLight};
					color: ${colorLight};
				}
				body.theme-dark a.tag[href="${tagHref}"], body.theme-dark .cm-s-obsidian .cm-line span.cm-tag-${tagFlat}.cm-hashtag {
					background-color: ${backgroundDark};
					color: ${colorDark};
				}
		`;
		})
		.join("\n");

	insertCSS(css);
}

function generateUniqueColor(string: string, isDarkTheme: boolean) {
	const colorPalette = generateColorPalette(isDarkTheme);

	let hashCode = 0;
	for (let i = 0; i < string.length; i++) {
		hashCode = string.charCodeAt(i) + ((hashCode << 5) - hashCode);
	}

	hashCode = Math.abs(hashCode) % colorPalette.length;
	const selectedColor = colorPalette[hashCode];

	return selectedColor;
}

function generateColorPalette(isDarkTheme: boolean) {
	const PALETTE_SIZE = 36;
	const BASE_CHROMA = 16;
	const BASE_LIGHTNESS = 87;

	const hueIncrement = 360 / PALETTE_SIZE;

	const colorPalette = [];
	for (let i = 0; i < PALETTE_SIZE; i++) {
		const hue = i * hueIncrement;

		let chroma = BASE_CHROMA;
		let lightness = BASE_LIGHTNESS;
		if (isDarkTheme) {
			chroma = Math.round(BASE_CHROMA * 1.8);
			lightness = Math.round(BASE_LIGHTNESS / 2.5);
		}

		const lchColor = new Color("lch", [lightness, chroma, hue]).toString();
		colorPalette.push(lchColor);
	}

	return colorPalette;
}

function insertCSS(css: string): void {
	removeCSS();
	document.head
		.createEl("style", {
			type: "text/css",
			attr: { "colored-tags-style": "" },
		})
		.setText(css);
}

function removeCSS(): void {
	document.head.querySelectorAll('[colored-tags-style]').forEach((el) => {
		el.remove();
	});
}
