import { EditorView, ViewUpdate, ViewPlugin } from "@codemirror/view";

function coloredClassApplyer(domElement) {
	const tagElements = [];
	let hashEl = null;
	[].forEach.call(domElement.getElementsByClassName("cm-hashtag"), (el) => {
		if (el.innerText === "#") {
			hashEl = el;
			return;
		}

		tagElements.push({
			el,
			hashEl,
			className: `colored-tag-${el.innerText.trim().toLowerCase()}`,
		});
	});

	tagElements.forEach(({ el, hashEl, className }) => {
		el.classList.forEach((cls: string) => {
			if (cls.startsWith("colored-tag-") && cls !== className) {
				el.classList.remove(cls);
				hashEl.classList.remove(cls);
			}
		});
		if (!el.classList.contains(className)) {
			el.classList.add(className);
			hashEl.classList.add(className);
		}
	});
}

export const coloredClassApplyerPlugin = ViewPlugin.fromClass(
	class {
		constructor(view: EditorView) {
			coloredClassApplyer(view.dom);
		}

		update(update: ViewUpdate) {
			coloredClassApplyer(update.view.dom);
		}
	},
);
