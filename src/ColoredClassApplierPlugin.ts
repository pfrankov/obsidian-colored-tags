import { EditorView, ViewUpdate, ViewPlugin } from "@codemirror/view";
import {
	applyColoredTagClass,
	cleanupColoredTagClasses,
	normalizeTagText,
} from "./tag-appliers/TagApplier";

export function applyColoredClasses(domElement: HTMLElement): void {
	const nodes = Array.from(
		domElement.getElementsByClassName("cm-hashtag"),
	) as HTMLElement[];

	let currentHashEl: HTMLElement | null = null;

	for (const el of nodes) {
		const text = el.innerText.trim();
		if (text === "#") {
			currentHashEl = el;
			continue;
		}

		if (!currentHashEl) {
			continue;
		}

		if (!normalizeTagText(text)) {
			continue;
		}

		applyColoredTagClass([el, currentHashEl], text);
	}
}

export function cleanupOldClasses(
	el: HTMLElement,
	hashEl: HTMLElement,
	newClassName: string,
): void {
	cleanupColoredTagClasses([el, hashEl], newClassName);
}

export function applyClassName(
	el: HTMLElement,
	hashEl: HTMLElement,
	className: string,
): void {
	if (!el.classList.contains(className)) {
		el.classList.add(className);
		hashEl.classList.add(className);
	}
}

export const coloredClassApplierPlugin = ViewPlugin.fromClass(
	class {
		constructor(view: EditorView) {
			applyColoredClasses(view.dom as unknown as HTMLElement);
		}

		update(update: ViewUpdate) {
			applyColoredClasses(update.view.dom as unknown as HTMLElement);
		}
	},
);
