import { TagApplier, normalizeTagText } from "./TagApplier";

const BASE_TAG_SELECTOR =
	".bases-table a.tag, .bases-table-container a.tag, .value-list-container a.tag";

export function getTagNameFromElement(el: HTMLElement): string | null {
	return normalizeTagText(el.textContent);
}

const singleUseApplier = new TagApplier({
	selector: BASE_TAG_SELECTOR,
	getTagText: getTagNameFromElement,
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
		});
	}

	start(root: ParentNode = document.body): void {
		this.applier.start(root);
	}

	stop(): void {
		this.applier.stop();
	}
}
