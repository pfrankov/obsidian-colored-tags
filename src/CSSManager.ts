import { ColorResult } from "./ColorService";

const COLORED_ATTRIBUTE = "data-colored-tags";
const TAG_SELECTOR = [
	"a.tag",
	".cm-s-obsidian .cm-line span.cm-hashtag",
	'.metadata-property[data-property-key="tags" i] .multi-select-pill',
	'.metadata-property[data-property-key="tags" i] .multi-select-pill-remove-button',
	'.bases-metadata-value[data-property-type="tags" i] .multi-select-pill',
	'.bases-metadata-value[data-property-type="tags" i] .multi-select-pill-remove-button',
].join(", ");
const CANDIDATE_SELECTOR = `${TAG_SELECTOR}, [${COLORED_ATTRIBUTE}]`;

type TagStyle = {
	properties: Record<string, string>;
	order: number;
};

export class CSSManager {
	private tags = new Map<string, TagStyle>();
	private editorClasses = new Map<string, TagStyle>();
	private applied = new Map<HTMLElement, TagStyle>();
	private observer?: MutationObserver;
	private pending?: object;
	private order = 0;

	setTagColors(tagName: string, light: ColorResult, dark: ColorResult): void {
		const properties: Record<string, string> = {};
		for (const [theme, colors] of Object.entries({ light, dark })) {
			properties[`--colored-tags-${theme}-background`] =
				colors.background;
			properties[`--colored-tags-${theme}-color`] = colors.color;
			properties[`--colored-tags-${theme}-gradient`] =
				colors.linearGradient.join(", ");
		}
		const style = { properties, order: ++this.order };
		this.tags.set(tagName.toLowerCase(), style);

		// Preserve Obsidian's native flat-tag fallback, but never let a nested
		// tag's flattened name overwrite an unrelated root tag.
		const flat = tagName.replace(/[^0-9a-z-]/gi, "");
		if (flat && !tagName.includes("/")) {
			this.editorClasses.set(`cm-tag-${flat}`, style);
			this.editorClasses.set(`cm-tag-${flat.toLowerCase()}`, style);
		}

		this.startObserver();
		this.scheduleRefresh();
	}

	private startObserver(): void {
		if (this.observer) {
			return;
		}
		this.observer = new MutationObserver((mutations) => {
			const roots = new Set<Node>();
			for (const mutation of mutations) {
				if (mutation.type === "attributes") {
					roots.add(mutation.target);
				} else {
					mutation.addedNodes.forEach((node) => roots.add(node));
					mutation.removedNodes.forEach((node) => roots.add(node));
				}
			}
			roots.forEach((root) => this.applyTree(root));
		});
		this.observer.observe(document.body, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: [
				"class",
				"href",
				"data-property-key",
				"data-property-type",
			],
		});
	}

	private scheduleRefresh(): void {
		if (this.pending) {
			return;
		}
		const pending = (this.pending = {});
		void Promise.resolve().then(() => {
			if (this.pending !== pending) {
				return;
			}
			this.pending = undefined;
			this.applyTree(document.body);
		});
	}

	private applyTree(root: Node): void {
		if (!root.instanceOf(HTMLElement)) {
			return;
		}
		this.applyElement(root);
		root.querySelectorAll<HTMLElement>(CANDIDATE_SELECTOR).forEach((el) => {
			this.applyElement(el);
		});
	}

	private findStyle(el: HTMLElement): TagStyle | undefined {
		let style: TagStyle | undefined;

		if (el.matches("a.tag")) {
			const href = el.getAttribute("href");
			if (href?.startsWith("#")) {
				style = this.newerStyle(
					style,
					this.tags.get(href.slice(1).toLowerCase()),
				);
			}
		}
		for (const cls of Array.from(el.classList)) {
			if (cls.startsWith("colored-tag-")) {
				style = this.newerStyle(
					style,
					this.tags.get(cls.slice("colored-tag-".length)),
				);
			}
			if (el.matches("span.cm-hashtag")) {
				style = this.newerStyle(style, this.editorClasses.get(cls));
			}
		}
		return style;
	}

	private newerStyle(
		current: TagStyle | undefined,
		candidate: TagStyle | undefined,
	): TagStyle | undefined {
		return candidate && (!current || candidate.order > current.order)
			? candidate
			: current;
	}

	private applyElement(el: HTMLElement): void {
		const style =
			el.isConnected && el.matches(TAG_SELECTOR)
				? this.findStyle(el)
				: undefined;
		if (!style) {
			this.clearElement(el);
			return;
		}
		if (this.applied.get(el) !== style) {
			el.setCssProps(style.properties);
			this.applied.set(el, style);
		}
		if (!el.hasAttribute(COLORED_ATTRIBUTE)) {
			el.setAttribute(COLORED_ATTRIBUTE, "");
		}
	}

	private clearElement(el: HTMLElement): void {
		if (!this.applied.has(el) && !el.hasAttribute(COLORED_ATTRIBUTE)) {
			return;
		}
		for (const theme of ["light", "dark"]) {
			for (const property of ["background", "color", "gradient"]) {
				el.style.removeProperty(`--colored-tags-${theme}-${property}`);
			}
		}
		el.removeAttribute(COLORED_ATTRIBUTE);
		this.applied.delete(el);
	}

	removeAll(): void {
		this.observer?.disconnect();
		this.observer = undefined;
		this.pending = undefined;
		this.applied.forEach((_style, el) => this.clearElement(el));
		// A cloned node may copy our properties before the observer sees it.
		document
			.querySelectorAll<HTMLElement>(`[${COLORED_ATTRIBUTE}]`)
			.forEach((el) => this.clearElement(el));
		this.tags.clear();
		this.editorClasses.clear();
		this.order = 0;
	}
}
