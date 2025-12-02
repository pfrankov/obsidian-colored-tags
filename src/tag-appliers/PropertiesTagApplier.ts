import { TagApplier, normalizeTagText } from "./TagApplier";

const PROPERTY_TAG_SELECTOR =
	'.metadata-property[data-property-key="tags" i] .multi-select-pill';

const getPropertyTagTargets = (pillEl: HTMLElement): HTMLElement[] => {
	const removeButton = pillEl.querySelector<HTMLElement>(
		".multi-select-pill-remove-button",
	);
	return removeButton ? [pillEl, removeButton] : [pillEl];
};

const getPropertyTagName = (pillEl: HTMLElement): string | null => {
	const content = pillEl.querySelector<HTMLElement>(
		".multi-select-pill-content",
	);
	return normalizeTagText(content?.textContent ?? pillEl.textContent);
};

const singleUseApplier = new TagApplier({
	selector: PROPERTY_TAG_SELECTOR,
	getTagText: getPropertyTagName,
	getTagTargets: getPropertyTagTargets,
});

export function applyPropertiesTagClasses(
	target: ParentNode = document.body,
): void {
	singleUseApplier.apply(target);
}

export class PropertiesTagApplier {
	private readonly applier: TagApplier;

	constructor() {
		this.applier = new TagApplier({
			selector: PROPERTY_TAG_SELECTOR,
			getTagText: getPropertyTagName,
			getTagTargets: getPropertyTagTargets,
		});
	}

	start(root: ParentNode = document.body): void {
		this.applier.start(root);
	}

	stop(): void {
		this.applier.stop();
	}
}
