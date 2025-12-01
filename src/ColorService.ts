import Color from "colorjs.io";
import {
	ColorGeneratorConfig,
	ColorProcessorConfig,
	ColoredTagsPaletteType,
} from "./interfaces";
import { normalizePaletteIndex } from "./tagUtils";

export interface ColorResult {
	background: string;
	color: string;
	linearGradient: string[];
}

export class ColorService {
	private darkenMemoization = new Map<string, string>();

	generatePalettes(paletteConfig: {
		selected: ColoredTagsPaletteType;
		custom: string;
		seed: number;
	}): { light: string[]; dark: string[] } {
		if (paletteConfig.selected === ColoredTagsPaletteType.CUSTOM) {
			const palette = paletteConfig.custom
				.split("-")
				.filter(Boolean)
				.map((str) => `#${str}`);

			if (palette.length > 0) {
				return {
					light: this.processColorPalette({
						isDarkTheme: false,
						palette,
						seed: paletteConfig.seed,
					}),
					dark: this.processColorPalette({
						isDarkTheme: true,
						palette,
						seed: paletteConfig.seed,
					}),
				};
			}
		}

		const isBright =
			paletteConfig.selected === ColoredTagsPaletteType.ADAPTIVE_BRIGHT;
		const baseChroma = isBright ? 85 : 16;
		const baseLightness = isBright ? 75 : 87;
		const offset = 35;

		const commonConfig = {
			paletteSize: 8,
			seed: paletteConfig.seed,
			isShuffling: true,
			baseChroma,
			baseLightness,
			constantOffset: offset,
		};

		return {
			light: this.generateAdaptiveColorPalette({
				isDarkTheme: false,
				...commonConfig,
			}),
			dark: this.generateAdaptiveColorPalette({
				isDarkTheme: true,
				...commonConfig,
			}),
		};
	}

	getColors(
		tagName: string,
		palette: string[],
		tagsMap: Map<string, number>,
		options: {
			isMixing: boolean;
			isTransition: boolean;
			highTextContrast: boolean;
		},
		tagColorOverrides?: Map<string, number>,
	): ColorResult {
		const chunks = tagName.split("/");
		const gradientStops = this.calculateGradientStops(
			chunks,
			palette,
			tagsMap,
			options.isMixing,
			options.isTransition,
			tagColorOverrides,
		);

		const backgroundColor = new Color(gradientStops[0]);
		const background = backgroundColor.toString({ format: "lch" });

		const linearGradient = this.buildLinearGradient(
			gradientStops,
			options.isTransition,
		);

		const color = options.highTextContrast
			? this.calculateHighContrastColor(backgroundColor)
			: this.calculateDarkenedColor(backgroundColor);

		return { background, color, linearGradient };
	}

	private calculateGradientStops(
		chunks: string[],
		palette: string[],
		tagsMap: Map<string, number>,
		isMixing: boolean,
		isTransition: boolean,
		tagColorOverrides?: Map<string, number>,
	): string[] {
		const gradientStops: string[] = [];
		let backgroundColor: Color | null = null;
		let lastColor = "";
		let currentPath = "";

		for (const chunk of chunks) {
			const key = this.composeTagPath(currentPath, chunk);
			const order = tagsMap.get(key) || 1;
			const overrideIndex = tagColorOverrides?.get(key);

			const paletteForChunk = this.getPaletteForChunk(
				palette,
				lastColor,
				overrideIndex,
			);
			const colorFromPalette = this.pickColorFromPalette(
				paletteForChunk,
				order,
				overrideIndex,
			);
			lastColor = colorFromPalette;

			const newColor = this.buildColorForChunk(
				backgroundColor,
				colorFromPalette,
				isMixing,
				isTransition,
			);

			if (!backgroundColor) {
				backgroundColor = newColor;
			}

			gradientStops.push(newColor.toString({ format: "lch" }));
			currentPath = key;
		}
		return gradientStops;
	}

	private composeTagPath(parentPath: string, chunk: string): string {
		return parentPath ? `${parentPath}/${chunk}` : chunk;
	}

	private getPaletteForChunk(
		palette: string[],
		lastColor: string,
		overrideIndex?: number,
	): string[] {
		if (overrideIndex !== undefined || palette.length <= 1) {
			return palette;
		}

		const filtered = palette.filter((color) => color !== lastColor);
		return filtered.length > 0 ? filtered : palette;
	}

	private pickColorFromPalette(
		palette: string[],
		order: number,
		overrideIndex: number | undefined,
	): string {
		const indexSource =
			overrideIndex !== undefined ? overrideIndex : order - 1;
		const index = normalizePaletteIndex(indexSource, palette.length);
		return palette[index];
	}

	private buildColorForChunk(
		backgroundColor: Color | null,
		colorFromPalette: string,
		isMixing: boolean,
		isTransition: boolean,
	): Color {
		if (backgroundColor && isMixing) {
			return this.mixColors(
				backgroundColor,
				colorFromPalette,
				isTransition,
			);
		}

		return new Color(colorFromPalette).to("lch");
	}

	private mixColors(
		baseColor: Color,
		newColorStr: string,
		isTransition: boolean,
	): Color {
		const mixingLevel = isTransition ? 0.5 : 0.4;
		let mixed = baseColor.mix(newColorStr, mixingLevel, { space: "lch" });

		if (mixed.deltaE2000(baseColor) < 10) {
			mixed = baseColor.mix(newColorStr, mixingLevel + 0.1, {
				space: "lch",
			});
		}

		return mixed;
	}

	private buildLinearGradient(
		gradientStops: string[],
		isTransition: boolean,
	): string[] {
		const defaultGap = isTransition ? 50 : 0;
		const gap = (defaultGap / gradientStops.length) * 2;
		const sumOfGaps = gap * (gradientStops.length - 1);
		const elementSize = (100 - sumOfGaps) / gradientStops.length;

		return gradientStops.map((color, index) => {
			const start = index * (elementSize + gap);
			const end = start + elementSize;
			return `${color} ${start}% max(2em, ${end}%)`;
		});
	}

	private calculateHighContrastColor(backgroundColor: Color): string {
		const whiteColor = new Color("white");
		const blackColor = new Color("black");
		const onWhite = Math.abs(backgroundColor.contrast(whiteColor, "APCA"));
		const onBlack = Math.abs(backgroundColor.contrast(blackColor, "APCA"));

		return (onWhite > onBlack ? whiteColor : blackColor).toString();
	}

	private calculateDarkenedColor(baseColor: Color): string {
		const CONTRAST = 4.5;
		const memoKey = baseColor.toString();

		const cached = this.darkenMemoization.get(memoKey);
		if (cached) {
			return cached;
		}

		const colorLight = new Color(baseColor).to("lch");
		const colorDark = new Color(baseColor).to("lch");

		colorLight.c = Math.min(colorLight.c + 3, 100);
		colorDark.c = Math.min(colorDark.c + 20, 100);

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

		this.darkenMemoization.set(memoKey, result);
		return result;
	}

	private generateAdaptiveColorPalette(
		config: ColorGeneratorConfig,
	): string[] {
		const hueIncrement = 360 / config.paletteSize;
		const availableColors: string[] = [];

		for (let i = 0; i < config.paletteSize; i++) {
			const hue = i * hueIncrement + config.constantOffset;
			const chroma = config.isDarkTheme
				? Math.min(Math.round(config.baseChroma * 1.8), 100)
				: config.baseChroma;
			const lightness = config.isDarkTheme
				? Math.min(Math.round(config.baseLightness / 2.5), 100)
				: config.baseLightness;

			const lchColor = new Color("lch", [
				lightness,
				chroma,
				hue % 360,
			]).toString();
			availableColors.push(lchColor);
		}

		if (!config.isShuffling) {
			return availableColors;
		}

		// Shuffle the palette
		const result: string[] = [];
		const available = [...availableColors];
		let next = 0;

		while (available.length > 0) {
			result.push(available[next]);
			available.splice(next, 1);
			next = Math.round(next + available.length / 3) % available.length;
		}

		return this.rotatePalette(result, config.seed);
	}

	private processColorPalette(config: ColorProcessorConfig): string[] {
		const availableColors = config.palette.map((item) =>
			new Color(item).to("lch").toString(),
		);

		return this.rotatePalette(availableColors, config.seed);
	}

	private rotatePalette(colors: string[], seed: number): string[] {
		const result = [...colors];
		const cut = result.splice(-seed, seed);
		result.splice(0, 0, ...cut);
		return result;
	}

	findClosestColorIndex(sourceColor: string, palette: string[]): number {
		if (!palette.length) {
			return 0;
		}

		const source = new Color(sourceColor);
		let bestIndex = 0;
		let bestDistance = Number.POSITIVE_INFINITY;

		palette.forEach((color, index) => {
			const distance = source.deltaE2000(new Color(color));
			if (distance < bestDistance) {
				bestDistance = distance;
				bestIndex = index;
			}
		});

		return bestIndex;
	}
}
