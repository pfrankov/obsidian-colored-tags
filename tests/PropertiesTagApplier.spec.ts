import { describe, expect, it } from "vitest";
import {
	PropertiesTagApplier,
	applyPropertiesTagClasses,
} from "../src/tag-appliers/PropertiesTagApplier";

function createTagsProperty(
	key = "tags",
	value?: string,
	withRemoveButton = true,
): HTMLElement {
	const property = document.createElement("div");
	property.className = "metadata-property";
	property.setAttribute("data-property-key", key);

	const valueContainer = document.createElement("div");
	valueContainer.className = "metadata-property-value";

	const multiSelect = document.createElement("div");
	multiSelect.className = "multi-select-container";

	if (value !== undefined) {
		const pill = document.createElement("div");
		pill.className = "multi-select-pill";

		const content = document.createElement("div");
		content.className = "multi-select-pill-content";
		content.textContent = value;
		pill.appendChild(content);

		if (withRemoveButton) {
			const remove = document.createElement("div");
			remove.className = "multi-select-pill-remove-button";
			pill.appendChild(remove);
		}

		multiSelect.appendChild(pill);
	}

	valueContainer.appendChild(multiSelect);
	property.appendChild(valueContainer);

	return property;
}

describe("applyPropertiesTagClasses", () => {
	it("adds colored-tag class only to tags property chips", () => {
		const root = document.createElement("div");
		const tagsProperty = createTagsProperty("tags", "excalidraw");
		const otherProperty = createTagsProperty("cssclasses", "excalidraw");
		root.appendChild(tagsProperty);
		root.appendChild(otherProperty);

		applyPropertiesTagClasses(root);

		const tagsPill = tagsProperty.querySelector(".multi-select-pill");
		const otherPill = otherProperty.querySelector(".multi-select-pill");
		const tagsRemove = tagsProperty.querySelector(
			".multi-select-pill-remove-button",
		);
		const otherRemove = otherProperty.querySelector(
			".multi-select-pill-remove-button",
		);

		expect(tagsPill?.classList.contains("colored-tag-excalidraw")).toBe(
			true,
		);
		expect(otherPill?.className.includes("colored-tag-excalidraw")).toBe(
			false,
		);
		expect(tagsRemove?.classList.contains("colored-tag-excalidraw")).toBe(
			true,
		);
		expect(otherRemove?.className.includes("colored-tag-excalidraw")).toBe(
			false,
		);
	});

	it("handles pills without remove buttons gracefully", () => {
		const root = document.createElement("div");
		const tagsProperty = createTagsProperty("tags", "solo", false);
		root.appendChild(tagsProperty);

		applyPropertiesTagClasses(root);

		const pill = tagsProperty.querySelector(".multi-select-pill");
		expect(pill?.classList.contains("colored-tag-solo")).toBe(true);
	});

	it("falls back to pill text when content element is missing", () => {
		const root = document.createElement("div");
		const property = document.createElement("div");
		property.className = "metadata-property";
		property.setAttribute("data-property-key", "tags");

		const valueContainer = document.createElement("div");
		valueContainer.className = "metadata-property-value";

		const multiSelect = document.createElement("div");
		multiSelect.className = "multi-select-container";

		const pill = document.createElement("div");
		pill.className = "multi-select-pill";
		pill.textContent = " #bare ";
		multiSelect.appendChild(pill);

		valueContainer.appendChild(multiSelect);
		property.appendChild(valueContainer);
		root.appendChild(property);

		applyPropertiesTagClasses(root);

		expect(pill.classList.contains("colored-tag-bare")).toBe(true);
	});
});

describe("PropertiesTagApplier", () => {
	it("observes new property tag pills", async () => {
		const applier = new PropertiesTagApplier();
		const root = document.createElement("div");
		const tagsProperty = createTagsProperty("tags");
		const container = tagsProperty.querySelector(".multi-select-container");
		root.appendChild(tagsProperty);

		applier.start(root);

		const pill = document.createElement("div");
		pill.className = "multi-select-pill";
		const content = document.createElement("div");
		content.className = "multi-select-pill-content";
		content.textContent = "#Observed";
		pill.appendChild(content);
		const remove = document.createElement("div");
		remove.className = "multi-select-pill-remove-button";
		pill.appendChild(remove);
		container?.appendChild(pill);

		await new Promise((resolve) =>
			window.requestAnimationFrame(() => resolve(null)),
		);

		expect(pill.classList.contains("colored-tag-observed")).toBe(true);
		expect(remove.classList.contains("colored-tag-observed")).toBe(true);
		applier.stop();
	});
});
