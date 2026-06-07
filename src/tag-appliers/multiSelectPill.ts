import { normalizeTagText } from "./TagApplier";

export function getMultiSelectPillTargets(pillEl: HTMLElement): HTMLElement[] {
	const removeButton = pillEl.querySelector<HTMLElement>(
		".multi-select-pill-remove-button",
	);
	return removeButton ? [pillEl, removeButton] : [pillEl];
}

export function getMultiSelectPillName(pillEl: HTMLElement): string | null {
	const content = pillEl.querySelector<HTMLElement>(
		".multi-select-pill-content",
	);
	return normalizeTagText(content?.textContent ?? pillEl.textContent);
}
