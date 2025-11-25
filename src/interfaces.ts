export interface ColoredTagsPluginSettings {
	palette: {
		seed: number;
		selected: ColoredTagsPaletteType;
		custom: string;
	};
	mixColors: boolean;
	transition: boolean;
	accessibility: {
		highTextContrast: boolean;
	};
	knownTags: {
		[name: string]: number;
	};
	tagColors: {
		[name: string]: number;
	};
	_version: number;
}

export interface ColorGeneratorConfig {
	isDarkTheme: boolean;
	paletteSize: number;
	baseChroma: number;
	baseLightness: number;
	seed: number;
	isShuffling: boolean;
	constantOffset: number;
}

export interface ColorProcessorConfig {
	isDarkTheme: boolean;
	palette: string[];
	seed: number;
}

export const enum ColoredTagsPaletteType {
	ADAPTIVE_SOFT = "adaptive-soft",
	ADAPTIVE_BRIGHT = "adaptive-bright",
	CUSTOM = "custom",
}
