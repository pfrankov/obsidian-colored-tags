import { describe, expect, it } from "vitest";
import {
	BaseViewTagApplier,
	applyBaseTagClasses,
	getTagNameFromElement,
} from "../src/tag-appliers/BaseViewTagApplier";

describe("getTagNameFromElement", () => {
	it("normalizes tag text and strips hash", () => {
		const el = document.createElement("a");
		el.textContent = "   #Тег/Tag  ";

		expect(getTagNameFromElement(el)).toBe("тег/tag");
	});

	it("returns null for empty content", () => {
		const el = document.createElement("a");
		el.textContent = "   ";

		expect(getTagNameFromElement(el)).toBeNull();
	});
});

describe("applyBaseTagClasses", () => {
	it("adds colored-tag class to tags inside base containers", () => {
		const container = document.createElement("div");
		container.className = "value-list-container";

		const first = document.createElement("a");
		first.className = "tag";
		first.textContent = "#First";
		container.appendChild(first);

		const second = document.createElement("a");
		second.className = "tag";
		second.textContent = "Second";
		container.appendChild(second);

		applyBaseTagClasses(container);

		expect(first.classList.contains("colored-tag-first")).toBe(true);
		expect(second.classList.contains("colored-tag-second")).toBe(true);
	});

	it("replaces stale colored-tag classes", () => {
		const container = document.createElement("div");
		container.className = "value-list-container";

		const tag = document.createElement("a");
		tag.className = "tag colored-tag-old";
		tag.textContent = "Actual";
		container.appendChild(tag);

		applyBaseTagClasses(container);

		expect(tag.classList.contains("colored-tag-old")).toBe(false);
		expect(tag.classList.contains("colored-tag-actual")).toBe(true);
	});
});

describe("BaseViewTagApplier", () => {
	it("observes newly added tag nodes", async () => {
		const applier = new BaseViewTagApplier();
		const root = document.createElement("div");
		const valueList = document.createElement("div");
		valueList.className = "value-list-container";
		root.appendChild(valueList);

		applier.start(root);

		const tag = document.createElement("a");
		tag.className = "tag";
		tag.textContent = "Observed";
		valueList.appendChild(tag);

		await new Promise((resolve) =>
			window.requestAnimationFrame(() => resolve(null)),
		);

		expect(tag.classList.contains("colored-tag-observed")).toBe(true);

		applier.stop();
	});

	it("applies classes immediately on start", () => {
		const applier = new BaseViewTagApplier();
		const root = document.createElement("div");
		root.className = "bases-table-container";

		const tag = document.createElement("a");
		tag.className = "tag";
		tag.textContent = "Instant";
		root.appendChild(tag);

		applier.start(root);

		expect(tag.classList.contains("colored-tag-instant")).toBe(true);

		applier.stop();
	});
});
