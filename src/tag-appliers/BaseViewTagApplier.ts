import { TagApplier, normalizeTagText } from "./TagApplier";
import {
	getMultiSelectPillName,
	getMultiSelectPillTargets,
} from "./multiSelectPill";

// Bases renders `tags` property cells as multi-select pills (same widget as the
// file properties panel) inside `.bases-metadata-value[data-property-type="tags"]`.
const BASE_PILL_SELECTOR =
	'.bases-metadata-value[data-property-type="tags" i] .multi-select-pill';

// Fallback for anything that still renders tags as plain `a.tag` links.
const BASE_TAG_LINK_SELECTOR =
	'.bases-table a.tag, .bases-table-container a.tag, .value-list-container a.tag, a.tag[href^="#"]';

const BASE_TAG_SELECTOR = `${BASE_PILL_SELECTOR}, ${BASE_TAG_LINK_SELECTOR}`;

function isPill(el: HTMLElement): boolean {
	return el.classList.contains("multi-select-pill");
}

export function getTagNameFromElement(el: HTMLElement): string | null {
	return isPill(el)
		? getMultiSelectPillName(el)
		: normalizeTagText(el.textContent);
}

function getTagTargets(el: HTMLElement): HTMLElement[] {
	return isPill(el) ? getMultiSelectPillTargets(el) : [el];
}

const singleUseApplier = new TagApplier({
	selector: BASE_TAG_SELECTOR,
	getTagText: getTagNameFromElement,
	getTagTargets,
});

export function applyBaseTagClasses(target: ParentNode = document.body): void {
	singleUseApplier.apply(target);
}

export class BaseViewTagApplier {
	private readonly applier: TagApplier;

	constructor() {
		this.applier = new TagApplier({
			selector: BASE_TAG_SELECTOR,
			getTagText: getTagNameFromElement,
			getTagTargets,
		});
	}

	start(root: ParentNode = document.body): void {
		this.applier.start(root);
	}

	stop(): void {
		this.applier.stop();
	}
}
