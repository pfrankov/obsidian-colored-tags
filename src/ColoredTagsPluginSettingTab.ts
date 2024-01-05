import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import ColoredTagsPlugin from "./main";
import { DEFAULT_SETTINGS } from "./defaultSettings";
import { ColoredTagsPaletteType } from "./interfaces";

export class ColoredTagsPluginSettingTab extends PluginSettingTab {
	plugin: ColoredTagsPlugin;
	showExperimental = false;
	showAccessibility = false;

	constructor(app: App, plugin: ColoredTagsPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	renderPalette(paletteEl: Node) {
		paletteEl.empty();
		let palette = this.plugin.palettes.light;
		if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
			palette = this.plugin.palettes.dark;
		}
		palette.forEach((paletteColor, index) => {
			const firstElementStyles =
				"border-radius: var(--radius-m) 0 0 var(--radius-m)";
			const lastElementStyles =
				"border-radius: 0 var(--radius-m) var(--radius-m) 0";
			const styles = [
				index === 0 && firstElementStyles,
				"flex: 1",
				"height: 2em",
				`background-color: ${paletteColor}`,
				index === palette.length - 1 && lastElementStyles,
			];
			paletteEl.createEl("div", {
				attr: { style: styles.filter(Boolean).join(";") },
			});
		});
	}

	renderTags(containerEl: Node) {
		const tagsObject = this.app.metadataCache.getTags();
		const tagsArray = Object.keys(tagsObject);

		if (!tagsArray.length) {
			return;
		}

		const tagEl = containerEl.createEl("div", {
			cls: "tagsExample",
			attr: {
				style: `display: flex; gap: 0.5em; align-items: center; justify-content: space-between; flex-wrap: wrap; margin: 1em 0 2em;`,
			},
		});

		tagsArray.sort((a, b) => {
			return tagsObject[b] - tagsObject[a];
		});
		const mostPopularTags = tagsArray.splice(0, 2);

		const mostPopularNestedTags = Object.values(
			tagsArray.reduce((acc, tag) => {
				const nestingLevel = tag.split("/").length;
				if (!acc[nestingLevel]) {
					acc[nestingLevel] = tag;
				}
				return acc;
			}, {}),
		);

		[...mostPopularTags, ...mostPopularNestedTags].forEach((tag) => {
			const link = tagEl.createEl("a", { attr: { href: tag } });
			link.classList.add("tag");
			link.innerText = tag;
		});
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		this.renderTags(containerEl);

		const paletteEl = containerEl.createEl("div", {
			cls: "palette",
			attr: { style: `display: flex; align-items: stretch` },
		});
		this.renderPalette(paletteEl);

		new Setting(containerEl)
			.setHeading()
			.setName("Palette")
			.setDesc("Select palette")
			.addDropdown((dropdown) =>
				dropdown
					.addOptions({
						[ColoredTagsPaletteType.ADAPTIVE_SOFT]:
							"🌸 Adaptive soft",
						[ColoredTagsPaletteType.ADAPTIVE_BRIGHT]:
							"🌺 Adaptive bright",
						[ColoredTagsPaletteType.CUSTOM]: "Custom",
					})
					.setValue(String(this.plugin.settings.palette.selected))
					.onChange(async (value: ColoredTagsPaletteType) => {
						this.plugin.settings.palette.selected = value;
						await this.plugin.saveSettings();
						this.display();
					}),
			);

		if (this.plugin.settings.palette.selected === "custom") {
			const customPaletteField = new Setting(containerEl)
				.setName("Custom palette")
				.setDesc("")
				.addText((text) => {
					text.inputEl.style.minWidth = "100%";
					text.setValue(
						this.plugin.settings.palette.custom,
					).setPlaceholder("Paste palette");
					text.onChange(async (value) => {
						if (/^([A-Fa-f0-9]{6}(-|$))+$/i.test(value)) {
							this.plugin.settings.palette.custom = value;
							await this.plugin.saveSettings();
							this.renderPalette(paletteEl);
						}
					});
				});
			customPaletteField.descEl.innerHTML = `
				The format is <code>XXXXXX-XXXXXX-XXXXXX</code> for each RGB color.<br/>
				You can share the best color palettes or get one <a href="https://github.com/pfrankov/obsidian-colored-tags/discussions/18">from the community</a>.
			`.trim();
		}

		new Setting(containerEl)
			.setName("Palette shift")
			.setDesc(
				"If the colors of some tags don't fit, you can shift the palette.",
			)
			.addSlider((slider) =>
				slider
					.setLimits(0, this.plugin.palettes.light.length - 1, 1)
					.setValue(this.plugin.settings.palette.seed)
					.onChange(async (value) => {
						slider.showTooltip();
						this.plugin.settings.palette.seed = value;
						await this.plugin.saveSettings();
						this.renderPalette(paletteEl);
					}),
			);

		new Setting(containerEl)
			.setHeading()
			.setName("🦾 Accessibility")
			.setDesc("Show accessibility options")
			.addToggle((toggle) =>
				toggle
					.setValue(this.showAccessibility)
					.onChange(async (value) => {
						this.showAccessibility = value;
						this.display();
					}),
			);

		if (this.showAccessibility) {
			new Setting(containerEl)
				.setName("High text contrast")
				.setDesc("Use only white and black colors for texts")
				.addToggle((toggle) =>
					toggle
						.setValue(
							this.plugin.settings.accessibility.highTextContrast,
						)
						.onChange(async (value) => {
							this.plugin.settings.accessibility.highTextContrast =
								value;
							await this.plugin.saveSettings();
							this.display();
						}),
				);
		}

		new Setting(containerEl)
			.setHeading()
			.setName("🧪 Experimental")
			.setDesc(
				"Dangerous actions or insanely unstable options that could be changed or removed in any time",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.showExperimental)
					.onChange(async (value) => {
						this.showExperimental = value;
						this.display();
					}),
			);

		if (this.showExperimental) {
			new Setting(containerEl)
				.setName("Mix colors")
				.setDesc("It helps to make text readable")
				.addToggle((toggle) =>
					toggle
						.setValue(this.plugin.settings.mixColors)
						.onChange(async (value) => {
							this.plugin.settings.mixColors = value;
							await this.plugin.saveSettings();
							this.display();
						}),
				);

			new Setting(containerEl)
				.setName("Gradient transition")
				.addToggle((toggle) =>
					toggle
						.setValue(this.plugin.settings.transition)
						.onChange(async (value) => {
							this.plugin.settings.transition = value;
							await this.plugin.saveSettings();
							this.display();
						}),
				);

			new Setting(containerEl)
				.setName("Reset config")
				.setDesc(
					"🚨 All colors of all tags will be recalculated as if it was the first launch of the plugin. Requires restart of Obsidian.",
				)
				.addButton((button) =>
					button
						.setButtonText("Reset")
						.setClass("mod-warning")
						.onClick(async () => {
							new Notice(
								`✅ Reset is done\nPlease restart Obsidian`,
								10000,
							);
							button.setDisabled(true);
							button.buttonEl.setAttribute("disabled", "true");
							button.buttonEl.classList.remove("mod-warning");
							this.plugin.settings = Object.assign(
								{},
								DEFAULT_SETTINGS,
							);
							await this.plugin.saveData(this.plugin.settings);
						}),
				);
		}
	}
}
