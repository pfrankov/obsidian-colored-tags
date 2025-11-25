export function normalizeTagName(tagName: string): string {
	return tagName
		.replace(/#/g, "")
		.trim()
		.replace(/\s+/g, "")
		.replace(/\/+$/, "");
}

export function normalizePaletteIndex(index: number, length: number): number {
	if (length <= 0) {
		return 0;
	}
	const normalized = index % length;
	return normalized < 0 ? normalized + length : normalized;
}
