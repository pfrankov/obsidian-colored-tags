import {
	App,
	Notice,
	PluginSettingTab,
	Setting,
	TextComponent,
} from "obsidian";
import ColoredTagsPlugin from "./main";
import { DEFAULT_SETTINGS } from "./defaultSettings";
import { ColoredTagsPaletteType } from "./interfaces";
import { I18n } from "./i18n";
import {
	CommunityPalette,
	CommunityPalettesService,
} from "./CommunityPalettesService";

export class ColoredTagsPluginSettingTab extends PluginSettingTab {
	plugin: ColoredTagsPlugin;
	showExperimental = false;
	showAccessibility = false;
	private communityPaletteDescriptionCounter = 0;
	private communityPaletteCards: Map<string, HTMLElement> = new Map();

	constructor(app: App, plugin: ColoredTagsPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	renderPalette(paletteEl: HTMLElement, animate = false) {
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

		if (animate && paletteEl.animate) {
			paletteEl.animate([{ opacity: 0.2 }, { opacity: 1 }], {
				duration: 220,
				easing: "ease-out",
			});
		}
	}

	renderTags(containerEl: Node) {
		const tagsObject = this.app.metadataCache.getTags();
		const tagsArray = Object.keys(tagsObject);

		if (!tagsArray.length) {
			return;
		}

		const tagEl = containerEl.createEl("div", {
			cls: "tagsExample",
		});

		tagsArray.sort((a, b) => {
			return tagsObject[b] - tagsObject[a];
		});
		const mostPopularTags = tagsArray.splice(0, 2);

		const mostPopularNestedTags = Object.values(
			tagsArray.reduce<Record<number, string>>((acc, tag) => {
				const nestingLevel = tag.split("/").length;
				if (!acc[nestingLevel]) {
					acc[nestingLevel] = tag;
				}
				return acc;
			}, {}),
		);

		[...mostPopularTags, ...mostPopularNestedTags].forEach(
			(tag: string) => {
				const link = tagEl.createEl("a", { attr: { href: tag } });
				link.classList.add("tag");
				link.innerText = tag;
			},
		);
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();
		containerEl.classList.add("colored-tags-settings");

		this.renderTags(containerEl);

		const paletteEl = containerEl.createEl("div", {
			cls: "palette",
		});
		this.renderPalette(paletteEl);

		this.renderPaletteSettings(containerEl, paletteEl);
		this.renderAccessibilitySettings(containerEl);
		this.renderExperimentalSettings(containerEl);
	}

	private renderPaletteSettings(
		containerEl: HTMLElement,
		paletteEl: HTMLElement,
	): void {
		new Setting(containerEl)
			.setHeading()
			.setName(I18n.t("settings.palette.heading"))
			.setDesc(I18n.t("settings.palette.description"))
			.addDropdown((dropdown) =>
				dropdown
					.addOptions({
						[ColoredTagsPaletteType.ADAPTIVE_SOFT]: I18n.t(
							"settings.palette.options.adaptiveSoft",
						),
						[ColoredTagsPaletteType.ADAPTIVE_BRIGHT]: I18n.t(
							"settings.palette.options.adaptiveBright",
						),
						[ColoredTagsPaletteType.CUSTOM]: I18n.t(
							"settings.palette.options.custom",
						),
					})
					.setValue(String(this.plugin.settings.palette.selected))
					.onChange(async (value) => {
						this.plugin.settings.palette.selected =
							value as ColoredTagsPaletteType;
						await this.plugin.saveSettings();
						this.display();
					}),
			);

		if (this.plugin.settings.palette.selected === "custom") {
			this.renderCustomPaletteField(containerEl, paletteEl);
		}

		new Setting(containerEl)
			.setName(I18n.t("settings.palette.shift.name"))
			.setDesc(I18n.t("settings.palette.shift.description"))
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
	}

	private renderCustomPaletteField(
		containerEl: HTMLElement,
		paletteEl: HTMLElement,
	): void {
		let customPaletteInput: TextComponent | null = null;
		const customPaletteField = new Setting(containerEl)
			.setName(I18n.t("settings.palette.custom.name"))
			.setDesc("")
			.addText((text) => {
				customPaletteInput = text;
				text.inputEl.style.minWidth = "100%";
				text.setValue(
					this.plugin.settings.palette.custom,
				).setPlaceholder(I18n.t("settings.palette.custom.placeholder"));
				text.onChange(async (value) => {
					if (/^([A-Fa-f0-9]{6}(-|$))+$/i.test(value)) {
						this.plugin.settings.palette.custom = value;
						await this.plugin.saveSettings();
						this.renderPalette(paletteEl);
						this.updateCommunityPaletteSelection();
					}
				});
			});
		customPaletteField.descEl.innerHTML = I18n.t(
			"settings.palette.custom.description",
		);

		if (customPaletteInput) {
			this.renderCommunityPalettesSection(
				containerEl,
				paletteEl,
				customPaletteInput,
			);
		}
	}

	private renderCommunityPalettesSection(
		containerEl: HTMLElement,
		paletteEl: HTMLElement,
		inputComponent: TextComponent,
	): void {
		this.communityPaletteDescriptionCounter = 0;
		this.communityPaletteCards = new Map();
		const sectionSetting = new Setting(containerEl)
			.setName(I18n.t("settings.palette.custom.community.heading"))
			.setDesc("");
		sectionSetting.settingEl.classList.add("community-palettes");
		const descEl = sectionSetting.descEl;
		descEl.empty();
		const communityLinkStart =
			'<a href="https://github.com/pfrankov/obsidian-colored-tags/discussions/18" target="_blank">';
		const communityLinkEnd = "</a>";
		const descriptionEl = descEl.createDiv({
			cls: "community-palettes__description",
		});
		descriptionEl.innerHTML = I18n.t(
			"settings.palette.custom.community.description",
			{ communityLinkStart, communityLinkEnd },
		);

		const scrollContainer = descEl.createDiv({
			cls: "community-palettes__scroll",
		});

		const gridEl = scrollContainer.createDiv({
			cls: "community-palettes__grid",
		});

		const statusEl = scrollContainer.createDiv({
			cls: "community-palettes__status",
			text: I18n.t("settings.palette.custom.community.loading"),
		});

		CommunityPalettesService.getCommunityPalettes()
			.then((palettes) => {
				if (!palettes.length) {
					statusEl.textContent = I18n.t(
						"settings.palette.custom.community.empty",
					);
					return;
				}
				statusEl.remove();
				palettes.forEach((palette) => {
					const card = this.renderCommunityPaletteCard(
						gridEl,
						palette,
						paletteEl,
						inputComponent,
					);
					this.communityPaletteCards.set(
						this.normalizePaletteValue(palette.value),
						card,
					);
				});
				this.updateCommunityPaletteSelection();
			})
			.catch((error) => {
				console.error(error);
				statusEl.textContent = I18n.t(
					"settings.palette.custom.community.error",
				);
			});
	}

	private renderCommunityPaletteCard(
		gridEl: HTMLElement,
		palette: CommunityPalette,
		paletteEl: HTMLElement,
		inputComponent: TextComponent,
	): HTMLElement {
		const descriptionId = `community-palette-desc-${this.communityPaletteDescriptionCounter++}`;
		const card = gridEl.createDiv({
			cls: "community-palette-card",
			attr: {
				role: "button",
				tabindex: "0",
				"aria-describedby": descriptionId,
				"aria-pressed": "false",
			},
		});

		card.createSpan({
			cls: "visually-hidden",
			attr: { id: descriptionId },
			text: I18n.t("settings.palette.custom.community.applyHint"),
		});

		const paletteRow = card.createDiv({
			cls: "community-palette-card__preview",
		});

		palette.colors.forEach((color) => {
			paletteRow.createDiv({
				attr: {
					style: `flex: 1; background-color: ${color};`,
				},
			});
		});

		const metaEl = card.createDiv({
			cls: "community-palette-card__meta",
		});

		metaEl.createSpan({
			cls: "community-palette-card__author",
			text: palette.author,
		});
		metaEl.createSpan({
			cls: "community-palette-card__upvotes",
			text: `❤️ ${palette.score}`,
		});

		const applyPalette = () => {
			void this.applyCommunityPalette(
				palette,
				inputComponent,
				paletteEl,
			);
		};

		card.addEventListener("click", applyPalette);
		card.addEventListener("keydown", (event) => {
			if (event.key === "Enter" || event.key === " ") {
				event.preventDefault();
				applyPalette();
			}
		});

		return card;
	}

	private async applyCommunityPalette(
		palette: CommunityPalette,
		inputComponent: TextComponent,
		paletteEl: HTMLElement,
	) {
		this.plugin.settings.palette.custom = palette.value;
		inputComponent.setValue(palette.value);
		await this.plugin.saveSettings();
		this.renderPalette(paletteEl, true);
		this.updateCommunityPaletteSelection();
		new Notice(
			I18n.t("notices.communityPaletteApplied", {
				author: palette.author,
			}),
			4000,
		);
	}

	private normalizePaletteValue(value?: string): string {
		return (value || "")
			.replace(/#/g, "")
			.replace(/\s+/g, "")
			.trim()
			.toLowerCase();
	}

	private updateCommunityPaletteSelection(): void {
		if (!this.communityPaletteCards.size) {
			return;
		}
		const isCustomSelected =
			this.plugin.settings.palette.selected ===
			ColoredTagsPaletteType.CUSTOM;
		const normalizedCustom = isCustomSelected
			? this.normalizePaletteValue(
				this.plugin.settings.palette.custom,
			  )
			: "";
		const hasMatch = Boolean(normalizedCustom);

		this.communityPaletteCards.forEach((card, value) => {
			const isSelected = hasMatch && value === normalizedCustom;
			if (isSelected) {
				card.classList.add("is-selected");
			} else {
				card.classList.remove("is-selected");
			}
			card.setAttribute("aria-pressed", isSelected ? "true" : "false");
		});
	}

	private renderAccessibilitySettings(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setHeading()
			.setName(I18n.t("settings.accessibility.heading"))
			.setDesc(I18n.t("settings.accessibility.description"))
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
				.setName(I18n.t("settings.accessibility.highTextContrast.name"))
				.setDesc(
					I18n.t(
						"settings.accessibility.highTextContrast.description",
					),
				)
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
	}

	private renderExperimentalSettings(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setHeading()
			.setName(I18n.t("settings.experimental.heading"))
			.setDesc(I18n.t("settings.experimental.description"))
			.addToggle((toggle) =>
				toggle
					.setValue(this.showExperimental)
					.onChange(async (value) => {
						this.showExperimental = value;
						this.display();
					}),
			);

		if (!this.showExperimental) {
			return;
		}

		new Setting(containerEl)
			.setName(I18n.t("settings.experimental.mixColors.name"))
			.setDesc(I18n.t("settings.experimental.mixColors.description"))
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
			.setName(I18n.t("settings.experimental.gradientTransition.name"))
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
			.setName(I18n.t("settings.experimental.reset.name"))
			.setDesc(I18n.t("settings.experimental.reset.description"))
			.addButton((button) =>
				button
					.setButtonText(I18n.t("settings.experimental.reset.button"))
					.setClass("mod-warning")
					.onClick(async () => {
						new Notice(I18n.t("notices.resetDone"), 10000);
						button.setDisabled(true);
						button.buttonEl.setAttribute("disabled", "true");
						button.buttonEl.classList.remove("mod-warning");
						this.plugin.settings = Object.assign(
							{},
							DEFAULT_SETTINGS,
						);
						await this.plugin.saveData(this.plugin.settings);
						this.updateCommunityPaletteSelection();
					}),
			);
	}
}
