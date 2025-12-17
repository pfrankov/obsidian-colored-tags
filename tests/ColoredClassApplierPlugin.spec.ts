import { describe, it, expect } from "vitest";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import {
	applyColoredClasses,
	cleanupOldClasses,
	applyClassName,
	coloredClassApplierPlugin,
} from "../src/ColoredClassApplierPlugin";

const createHashtagPair = (hashText: string, tagText: string) => {
	const hash = document.createElement("span");
	hash.className = "cm-hashtag";
	hash.innerText = hashText;
	const tag = document.createElement("span");
	tag.className = "cm-hashtag";
	tag.innerText = tagText;
	return { hash, tag };
};

describe("ColoredClassApplierPlugin", () => {
	it("applies class to both tag and hash elements", () => {
		const el = document.createElement("span");
		const hashEl = document.createElement("span");

		applyClassName(el, hashEl, "colored-tag-foo");

		expect(el.classList.contains("colored-tag-foo")).toBe(true);
		expect(hashEl.classList.contains("colored-tag-foo")).toBe(true);
	});

	it("removes old colored-tag classes but keeps new one", () => {
		const el = document.createElement("span");
		const hashEl = document.createElement("span");
		el.classList.add("colored-tag-old", "colored-tag-keep", "other-class");
		hashEl.classList.add("colored-tag-old", "colored-tag-keep");

		cleanupOldClasses(el, hashEl, "colored-tag-keep");

		expect(el.classList.contains("colored-tag-old")).toBe(false);
		expect(hashEl.classList.contains("colored-tag-old")).toBe(false);
		expect(el.classList.contains("colored-tag-keep")).toBe(true);
		expect(el.classList.contains("other-class")).toBe(true);
	});

	it("applies colored classes to properly paired hashtags", () => {
		const container = document.createElement("div");
		const { hash: hash1, tag: tag1 } = createHashtagPair("#", "TagOne");
		const { hash: hash2, tag: tag2 } = createHashtagPair("#", "TagTwo");

		container.append(hash1, tag1, hash2, tag2);
		applyColoredClasses(container);

		expect(tag1.classList.contains("colored-tag-tagone")).toBe(true);
		expect(hash1.classList.contains("colored-tag-tagone")).toBe(true);
		expect(tag2.classList.contains("colored-tag-tagtwo")).toBe(true);
		expect(hash2.classList.contains("colored-tag-tagtwo")).toBe(true);
	});

	it("ignores orphaned hashtag elements without hash symbol", () => {
		const container = document.createElement("div");
		const orphan = document.createElement("span");
		orphan.className = "cm-hashtag";
		orphan.innerText = "TagWithoutHash";
		container.appendChild(orphan);

		applyColoredClasses(container);

		expect(
			Array.from(orphan.classList).some((cls) =>
				cls.startsWith("colored-tag-"),
			),
		).toBe(false);
	});

	it("combines multi-part hashtags into a single colored class", () => {
		const container = document.createElement("div");
		["#", "Fails", "/In", "/Both"].forEach((text) => {
			const part = document.createElement("span");
			part.className = "cm-hashtag";
			part.innerText = text;
			container.appendChild(part);
		});

		applyColoredClasses(container);

		Array.from(container.children).forEach((el) => {
			expect(
				(el as HTMLElement).classList.contains(
					"colored-tag-fails/in/both",
				),
			).toBe(true);
		});
	});

	it("skips tags that normalize to empty text", () => {
		const container = document.createElement("div");
		const hashEl = document.createElement("span");
		hashEl.className = "cm-hashtag";
		hashEl.innerText = "#";
		const emptyTag = document.createElement("span");
		emptyTag.className = "cm-hashtag";
		emptyTag.innerText = "#";

		container.append(hashEl, emptyTag);
		applyColoredClasses(container);

		expect(
			Array.from(emptyTag.classList).some((cls) =>
				cls.startsWith("colored-tag-"),
			),
		).toBe(false);
		expect(
			Array.from(hashEl.classList).some((cls) =>
				cls.startsWith("colored-tag-"),
			),
		).toBe(false);
	});

	it("skips tags with whitespace only text", () => {
		const container = document.createElement("div");
		const hashEl = document.createElement("span");
		hashEl.className = "cm-hashtag";
		hashEl.innerText = "#";
		const emptyTag = document.createElement("span");
		emptyTag.className = "cm-hashtag";
		emptyTag.innerText = "   ";

		container.append(hashEl, emptyTag);
		applyColoredClasses(container);

		expect(
			Array.from(emptyTag.classList).some((cls) =>
				cls.startsWith("colored-tag-"),
			),
		).toBe(false);
		expect(
			Array.from(hashEl.classList).some((cls) =>
				cls.startsWith("colored-tag-"),
			),
		).toBe(false);
	});

	it("integrates with EditorView lifecycle", () => {
		const view = new EditorView({
			state: EditorState.create({ doc: "#tag" }),
			parent: document.createElement("div"),
			extensions: [coloredClassApplierPlugin],
		});

		const { hash, tag } = createHashtagPair("#", "Lifecycle");
		view.dom.append(hash, tag);

		const plugin = (coloredClassApplierPlugin as any).create(view);
		expect(plugin).toBeTruthy();

		plugin.update({ view } as any);

		expect(tag.classList.contains("colored-tag-lifecycle")).toBe(true);
		expect(hash.classList.contains("colored-tag-lifecycle")).toBe(true);

		view.destroy();
	});
});
