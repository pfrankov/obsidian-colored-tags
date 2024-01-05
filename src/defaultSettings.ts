import {
	ColoredTagsPaletteType,
	ColoredTagsPluginSettings,
} from "./interfaces";

export const DEFAULT_SETTINGS: ColoredTagsPluginSettings = {
	palette: {
		seed: 0,
		selected: ColoredTagsPaletteType.ADAPTIVE_SOFT,
		custom: "e12729-f37324-f8cc1b-72b043-007f4e",
	},
	mixColors: true,
	transition: true,
	accessibility: {
		highTextContrast: false,
	},
	knownTags: {},
	_version: 3,
};
