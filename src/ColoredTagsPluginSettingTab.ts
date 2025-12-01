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
import { normalizePaletteIndex, normalizeTagName } from "./tagUtils";
import {
	CommunityPalette,
	CommunityPalettesService,
} from "./CommunityPalettesService";

const SELECTED_CLASS = "is-selected";

export class ColoredTagsPluginSettingTab extends PluginSettingTab {
	plugin: ColoredTagsPlugin;
	showExperimental = false;
	showAccessibility = false;
	private communityPaletteDescriptionCounter = 0;
	private communityPaletteCards: Map<string, HTMLElement> = new Map();
	private paletteChangeSubscribers: Array<() => void> = [];

	constructor(app: App, plugin: ColoredTagsPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	renderPalette(paletteEl: HTMLElement, animate = false) {
		paletteEl.empty();
		const palette = this.getActivePalette();
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
		this.paletteChangeSubscribers = [];

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
						this.notifyPaletteChange();
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
						this.notifyPaletteChange();
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
		const descriptionId = `community-palette-desc-${this
			.communityPaletteDescriptionCounter++}`;
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
			void this.applyCommunityPalette(palette, inputComponent, paletteEl);
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
		this.notifyPaletteChange();
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
			? this.normalizePaletteValue(this.plugin.settings.palette.custom)
			: "";
		const hasMatch = Boolean(normalizedCustom);

		this.communityPaletteCards.forEach((card, value) => {
			const isSelected = hasMatch && value === normalizedCustom;
			if (isSelected) {
				card.classList.add(SELECTED_CLASS);
			} else {
				card.classList.remove(SELECTED_CLASS);
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

		this.renderTagPaletteOverrides(containerEl);

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
						await this.plugin.saveSettings();
						this.updateCommunityPaletteSelection();
					}),
			);
	}

	private renderTagPaletteOverrides(containerEl: HTMLElement): void {
		const tagPaletteSetting = new Setting(containerEl)
			.setName(I18n.t("settings.experimental.tagColors.name"))
			.setDesc(I18n.t("settings.experimental.tagColors.description"));
		tagPaletteSetting.settingEl.classList.add("tag-color-setting-item");

		tagPaletteSetting.controlEl.empty();

		const wrapper = tagPaletteSetting.controlEl.createDiv({
			cls: "tag-color-setting",
		});
		const controlsRow = wrapper.createDiv({
			cls: "tag-color-setting__row",
		});
		const inputContainer = controlsRow.createDiv({
			cls: "tag-color-setting__input",
		});

		const datalistId = `tag-color-list-${Date.now()}`;
		const datalist = inputContainer.createEl("datalist", {
			attr: { id: datalistId },
		});
		const refreshTagOptions = () => this.populateTagOptions(datalist);
		refreshTagOptions();

		let currentTag = "";
		const tagInput = new TextComponent(inputContainer);
		tagInput
			.setPlaceholder(
				I18n.t("settings.experimental.tagColors.placeholder"),
			)
			.setValue("");
		tagInput.inputEl.setAttr("list", datalistId);
		tagInput.onChange((value) => {
			currentTag = normalizeTagName(value);
			updateSelectedSwatch();
		});

		const paletteEl = controlsRow.createDiv({
			cls: "tag-color-setting__palette",
		});
		const listContainer = wrapper.createDiv({
			cls: "tag-color-setting__chips",
		});

		const handleAssignmentsChange = () => {
			updateSelectionState();
			refreshTagOptions();
		};

		const updateSelectedSwatch = () => {
			const palette = this.getActivePalette();
			const assignedIndex =
				(this.plugin.settings.tagColors &&
					this.plugin.settings.tagColors[currentTag]) ??
				null;
			Array.from(paletteEl.children).forEach((child, index) => {
				child.classList.toggle(
					SELECTED_CLASS,
					assignedIndex !== null &&
						assignedIndex !== undefined &&
						normalizePaletteIndex(assignedIndex, palette.length) ===
							index,
				);
				(child as HTMLButtonElement).disabled = !currentTag;
			});
		};

		const updateSelectionState = () => {
			updateSelectedSwatch();
		};

		const applySelection = async (index: number) => {
			if (!currentTag) {
				return;
			}
			this.plugin.settings.tagColors[currentTag] = index;
			await this.plugin.saveSettings();
			this.plugin.colorizeTag(currentTag);
			this.renderTagColorAssignments(
				listContainer,
				handleAssignmentsChange,
			);
		};

		this.renderPaletteSwatches(paletteEl, applySelection);
		this.renderTagColorAssignments(listContainer, handleAssignmentsChange);

		this.subscribeToPaletteChange(() => {
			this.renderPaletteSwatches(paletteEl, applySelection);
			this.renderTagColorAssignments(
				listContainer,
				handleAssignmentsChange,
			);
			updateSelectionState();
		});

		updateSelectionState();
	}

	private renderPaletteSwatches(
		paletteEl: HTMLElement,
		onSelect: (index: number) => void,
	) {
		paletteEl.empty();
		const palette = this.getActivePalette();

		palette.forEach((color, index) => {
			const swatch = paletteEl.createEl("button", {
				cls: "tag-color-setting__swatch",
				attr: {
					type: "button",
					style: `background-color: ${color}`,
					"aria-label": `${I18n.t(
						"settings.experimental.tagColors.applyHint",
					)} ${index + 1}`,
				},
			});
			swatch.addEventListener("click", () => onSelect(index));
		});
	}

	private renderTagColorAssignments(
		listEl: HTMLElement,
		onChange?: () => void,
	): void {
		listEl.empty();
		const entries = Object.entries(this.plugin.settings.tagColors || {});

		if (!entries.length) {
			listEl.createDiv({
				cls: "tag-color-setting__empty",
				text: I18n.t("settings.experimental.tagColors.empty"),
			});
			onChange?.();
			return;
		}

		entries
			.sort(([tagA], [tagB]) => tagA.localeCompare(tagB))
			.forEach(([tag]) => {
				const chipWrapper = listEl.createDiv({
					cls: "tag-color-setting__chip",
				});
				const chip = chipWrapper.createEl("a", {
					cls: "tag",
					text: `#${tag}`,
					attr: {
						href: `#${tag}`,
					},
				});
				chip.addEventListener("click", (event) => {
					event.preventDefault();
					const tagInputEl = listEl
						.closest(".tag-color-setting")
						?.querySelector<HTMLInputElement>(
							".tag-color-setting__input input",
						);
					if (tagInputEl) {
						tagInputEl.value = `#${tag}`;
						tagInputEl.dispatchEvent(new Event("input"));
					}
				});

				const removeButton = chipWrapper.createEl("button", {
					cls: "tag-color-setting__chip-remove",
					attr: {
						type: "button",
						"aria-label": I18n.t(
							"settings.experimental.tagColors.clear",
						),
						title: I18n.t("settings.experimental.tagColors.clear"),
					},
					text: "✕",
				});
				removeButton.addEventListener("click", async (event) => {
					event.preventDefault();
					event.stopPropagation();
					delete this.plugin.settings.tagColors[tag];
					await this.plugin.saveSettings();
					this.renderTagColorAssignments(listEl, onChange);
				});
			});

		onChange?.();
	}

	private populateTagOptions(datalist: HTMLElement): void {
		datalist.empty();
		const knownTags = new Set(
			Object.keys(this.plugin.settings.knownTags || {}),
		);
		const assignedTags = new Set(
			Object.keys(this.plugin.settings.tagColors || {}),
		);
		const metadataTags = Object.keys(
			this.app.metadataCache?.getTags?.() || {},
		)
			.map((tag) => normalizeTagName(tag))
			.filter((tag) => tag.length > 0);
		metadataTags.forEach((tag) => knownTags.add(tag));

		Array.from(knownTags)
			.filter((tag) => !assignedTags.has(tag))
			.sort((a, b) => a.localeCompare(b))
			.forEach((tag) => {
				datalist.createEl("option", {
					attr: { value: `#${tag}` },
				});
			});
	}

	private getActivePalette(): string[] {
		let palette = this.plugin.palettes.light;
		if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
			palette = this.plugin.palettes.dark;
		}
		return palette.length ? palette : this.plugin.palettes.light;
	}

	private subscribeToPaletteChange(callback: () => void) {
		this.paletteChangeSubscribers.push(callback);
	}

	private notifyPaletteChange() {
		this.paletteChangeSubscribers.forEach((cb) => cb());
	}
}
