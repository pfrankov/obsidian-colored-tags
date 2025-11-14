import { EditorView, ViewUpdate, ViewPlugin } from "@codemirror/view";

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

		const className = `colored-tag-${text.toLowerCase()}`;
		cleanupOldClasses(el, currentHashEl, className);
		applyClassName(el, currentHashEl, className);
	}
}

export function cleanupOldClasses(
	el: HTMLElement,
	hashEl: HTMLElement,
	newClassName: string,
): void {
	for (const cls of Array.from(el.classList)) {
		if (cls.startsWith("colored-tag-") && cls !== newClassName) {
			el.classList.remove(cls);
			hashEl.classList.remove(cls);
		}
	}
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
