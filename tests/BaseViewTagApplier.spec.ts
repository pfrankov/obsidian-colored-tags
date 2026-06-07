import { describe, expect, it } from "vitest";
import {
	BaseViewTagApplier,
	applyBaseTagClasses,
	getTagNameFromElement,
} from "../src/tag-appliers/BaseViewTagApplier";

function createBasesTagsCell(...values: string[]): HTMLElement {
	const cell = document.createElement("div");
	cell.className =
		"bases-table-cell bases-metadata-value metadata-property-value";
	cell.setAttribute("data-property-type", "tags");

	const container = document.createElement("div");
	container.className = "multi-select-container";

	for (const value of values) {
		const pill = document.createElement("div");
		pill.className = "multi-select-pill";

		const content = document.createElement("div");
		content.className = "multi-select-pill-content";
		const span = document.createElement("span");
		span.textContent = value;
		content.appendChild(span);
		pill.appendChild(content);

		const remove = document.createElement("div");
		remove.className = "multi-select-pill-remove-button";
		pill.appendChild(remove);

		container.appendChild(pill);
	}

	cell.appendChild(container);
	return cell;
}

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

	it("reads the pill content for multi-select pills", () => {
		const cell = createBasesTagsCell("First");
		const pill = cell.querySelector<HTMLElement>(".multi-select-pill")!;

		expect(getTagNameFromElement(pill)).toBe("first");
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

	it("colors multi-select pills inside a bases tags cell", () => {
		const root = document.createElement("div");
		const cell = createBasesTagsCell("First", "Second");
		root.appendChild(cell);

		applyBaseTagClasses(root);

		const pills = cell.querySelectorAll<HTMLElement>(".multi-select-pill");
		expect(pills[0].classList.contains("colored-tag-first")).toBe(true);
		expect(pills[1].classList.contains("colored-tag-second")).toBe(true);

		const removeButtons = cell.querySelectorAll<HTMLElement>(
			".multi-select-pill-remove-button",
		);
		expect(removeButtons[0].classList.contains("colored-tag-first")).toBe(
			true,
		);
		expect(removeButtons[1].classList.contains("colored-tag-second")).toBe(
			true,
		);
	});

	it("ignores multi-select pills outside a tags cell", () => {
		const root = document.createElement("div");
		const cell = createBasesTagsCell("First");
		cell.setAttribute("data-property-type", "text");
		root.appendChild(cell);

		applyBaseTagClasses(root);

		const pill = cell.querySelector<HTMLElement>(".multi-select-pill")!;
		expect(pill.className.includes("colored-tag")).toBe(false);
	});

	it("adds classes to regular markdown tag links", () => {
		const applier = new BaseViewTagApplier();
		const root = document.createElement("div");

		const tag = document.createElement("a");
		tag.className = "tag";
		tag.setAttribute("href", "#okinbothmodes");
		tag.textContent = "#okinbothmodes";
		root.appendChild(tag);

		applier.start(root);

		expect(tag.classList.contains("colored-tag-okinbothmodes")).toBe(true);

		applier.stop();
	});
});
