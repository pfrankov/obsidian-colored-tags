export const COLORED_TAG_PREFIX = "colored-tag-";

export function normalizeTagText(
	text: string | null | undefined,
): string | null {
	if (!text) {
		return null;
	}

	const trimmed = text.trim();
	const normalized = trimmed.replace(/^#/, "");
	return normalized.length ? normalized.toLowerCase() : null;
}

export function buildColoredTagClass(tagName: string): string {
	return `${COLORED_TAG_PREFIX}${tagName}`;
}

export function cleanupColoredTagClasses(
	targets: Iterable<HTMLElement>,
	newClassName: string,
): void {
	for (const el of targets) {
		for (const cls of Array.from(el.classList)) {
			if (cls.startsWith(COLORED_TAG_PREFIX) && cls !== newClassName) {
				el.classList.remove(cls);
			}
		}
	}
}

export function applyColoredTagClass(
	targets: Iterable<HTMLElement>,
	tagText: string | null | undefined,
): void {
	const normalizedTag = normalizeTagText(tagText);
	if (!normalizedTag) {
		return;
	}

	const className = buildColoredTagClass(normalizedTag);
	cleanupColoredTagClasses(targets, className);

	for (const el of targets) {
		if (!el.classList.contains(className)) {
			el.classList.add(className);
		}
	}
}

type TagTextGetter = (el: HTMLElement) => string | null;

export const defaultTagTextGetter: TagTextGetter = (el) => {
	const text = el.textContent;
	return text ? text.trim() : null;
};

type TagTargetsGetter = (el: HTMLElement) => HTMLElement[];

export function applyColoredTagClassesInRoot(
	root: ParentNode,
	selector: string,
	getTagText: TagTextGetter = defaultTagTextGetter,
	getTagTargets: TagTargetsGetter = (el) => [el],
): void {
	const candidates: HTMLElement[] = [];

	if (root instanceof HTMLElement && root.matches(selector)) {
		candidates.push(root);
	}

	root.querySelectorAll<HTMLElement>(selector).forEach((el) => {
		candidates.push(el);
	});

	for (const el of candidates) {
		applyColoredTagClass(getTagTargets(el), getTagText(el));
	}
}

export interface TagApplierOptions {
	selector: string;
	getTagText?: TagTextGetter;
	getTagTargets?: TagTargetsGetter;
}

export class TagApplier {
	private observer?: MutationObserver;
	private readonly selector: string;
	private readonly getTagText: TagTextGetter;
	private readonly getTagTargets: TagTargetsGetter;
	private pendingNodes = new Set<ParentNode>();
	private flushHandle: number | null = null;

	constructor(options: TagApplierOptions) {
		this.selector = options.selector;
		this.getTagText = options.getTagText ?? defaultTagTextGetter;
		this.getTagTargets = options.getTagTargets ?? ((el) => [el]);
	}

	apply(root: ParentNode = document.body): void {
		applyColoredTagClassesInRoot(
			root,
			this.selector,
			this.getTagText,
			this.getTagTargets,
		);
	}

	start(root: ParentNode = document.body): void {
		this.stop();
		this.apply(root);

		this.observer = new MutationObserver((mutations) => {
			for (const mutation of mutations) {
				this.handleMutation(mutation);
			}
		});

		this.observer.observe(root, {
			childList: true,
			subtree: true,
			characterData: true,
		});
	}

	stop(): void {
		this.observer?.disconnect();
		this.observer = undefined;
	}

	private handleMutation(mutation: MutationRecord): void {
		if (mutation.type === "characterData") {
			const parent = mutation.target.parentNode;
			if (parent) {
				this.scheduleApply(parent);
			}
			return;
		}

		mutation.addedNodes.forEach((node) => {
			if (
				node instanceof HTMLElement ||
				node instanceof DocumentFragment
			) {
				this.scheduleApply(node);
			}
		});
	}

	private scheduleApply(target: ParentNode): void {
		this.pendingNodes.add(target);
		if (this.flushHandle !== null) {
			return;
		}
		const requestId = window.requestAnimationFrame(() => {
			this.flushHandle = null;
			const nodes = Array.from(this.pendingNodes);
			this.pendingNodes.clear();
			for (const node of nodes) {
				this.apply(node);
			}
		});
		this.flushHandle = requestId;
		if (this.pendingNodes.size === 0) {
			this.flushHandle = null;
		}
	}
}
