// Type definitions for colorjs.io that are missing or incorrect in the official types
declare module "colorjs.io" {
	export default class Color {
		constructor(color: string);
		constructor(colorSpace: string, coords: number[]);
		constructor(color: Color);

		to(colorSpace: string): Color;
		mix(
			color: string | Color,
			amount: number,
			options?: { space?: string },
		): Color;
		contrast(color: Color | string, algorithm?: string): number;
		contrastAPCA(color: Color | string): number;
		contrastWCAG21(color: Color | string): number;
		deltaE2000(color: Color): number;
		toString(options?: { format?: string }): string;

		c: number;
		l: number;
		h: number;

		uv: [number, number];
		xy: [number, number];
	}
}
