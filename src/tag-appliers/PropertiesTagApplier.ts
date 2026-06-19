import { TagApplier } from "./TagApplier";
import {
	getMultiSelectPillName,
	getMultiSelectPillTargets,
} from "./multiSelectPill";

const PROPERTY_TAG_SELECTOR =
	'.metadata-property[data-property-key="tags" i] .multi-select-pill';

const singleUseApplier = new TagApplier({
	selector: PROPERTY_TAG_SELECTOR,
	getTagText: getMultiSelectPillName,
	getTagTargets: getMultiSelectPillTargets,
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
			getTagText: getMultiSelectPillName,
			getTagTargets: getMultiSelectPillTargets,
		});
	}

	start(root: ParentNode = document.body): void {
		this.applier.start(root);
	}

	stop(): void {
		this.applier.stop();
	}
}
