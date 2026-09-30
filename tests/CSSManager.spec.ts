import { afterEach, describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { CSSManager } from "../src/CSSManager";
import { ColorResult } from "../src/ColorService";

const light: ColorResult = {
	background: "red",
	color: "white",
	linearGradient: ["red 0% 50%", "blue 50% 100%"],
};
const dark: ColorResult = {
	background: "blue",
	color: "black",
	linearGradient: ["blue 0% 50%", "red 50% 100%"],
};
const settle = async () => {
	await new Promise((resolve) => setTimeout(resolve, 0));
};
const managers: CSSManager[] = [];
const createManager = () => {
	const manager = new CSSManager();
	managers.push(manager);
	return manager;
};
const mount = (html: string) => {
	const root = document.createElement("div");
	root.innerHTML = html;
	document.body.append(root);
	return root;
};
const expectColors = (el: HTMLElement, expected = light) => {
	expect(el.hasAttribute("data-colored-tags")).toBe(true);
	expect(el.style.getPropertyValue("--colored-tags-light-background")).toBe(
		expected.background,
	);
	expect(el.style.getPropertyValue("--colored-tags-light-color")).toBe(
		expected.color,
	);
	expect(el.style.getPropertyValue("--colored-tags-light-gradient")).toBe(
		expected.linearGradient.join(", "),
	);
};

afterEach(() => {
	managers.splice(0).forEach((manager) => manager.removeAll());
	document.body.innerHTML = "";
	document.body.className = "";
	vi.restoreAllMocks();
});

describe("CSSManager", () => {
	it("uses custom properties without creating any style or link element", async () => {
		const manager = createManager();
		const root = mount('<a class="tag" href="#tag">#tag</a>');
		const create = vi.spyOn(document, "createElement");
		manager.setTagColors("tag", light, dark);
		await settle();
		const tag = root.querySelector<HTMLElement>("a")!;
		expectColors(tag);
		expect(
			tag.style.getPropertyValue("--colored-tags-dark-background"),
		).toBe(dark.background);
		expect(tag.style.getPropertyValue("--colored-tags-dark-color")).toBe(
			dark.color,
		);
		expect(tag.style.getPropertyValue("--colored-tags-dark-gradient")).toBe(
			dark.linearGradient.join(", "),
		);
		expect(create).not.toHaveBeenCalled();
		expect(document.querySelector("[colored-tags-style]")).toBeNull();
	});

	it.each(["Mixed/Case", "тег/子", "123tag", "a_b", "deep/nested/tag"])(
		"colors href-only links and editor classes for %s",
		async (name) => {
			const manager = createManager();
			const root =
				mount(`<a class="tag" href="#${name}">different label</a>
				<div class="cm-s-obsidian"><div class="cm-line"><span class="cm-hashtag colored-tag-${name.toLowerCase()}">#</span></div></div>`);
			manager.setTagColors(name, light, dark);
			await settle();
			expectColors(root.querySelector("a")!);
			expectColors(root.querySelector("span")!);
		},
	);

	it("retains native flat editor aliases without flattening nested or non-Latin tags", async () => {
		const manager = createManager();
		const root = mount(`<div class="cm-s-obsidian"><div class="cm-line">
			<span class="cm-hashtag cm-tag-AB"></span><span class="cm-hashtag cm-tag-ab"></span>
			<span class="cm-hashtag cm-tag-xy"></span><span class="cm-hashtag cm-tag-"></span>
		</div></div>`);
		manager.setTagColors("A_B", light, dark);
		manager.setTagColors("x/y", light, dark);
		manager.setTagColors("中文", light, dark);
		await settle();
		const spans = root.querySelectorAll<HTMLElement>("span");
		expectColors(spans[0]);
		expectColors(spans[1]);
		expect(spans[2].hasAttribute("data-colored-tags")).toBe(false);
		expect(spans[3].hasAttribute("data-colored-tags")).toBe(false);
	});

	it("colors Properties and Bases pills and their remove buttons only in tag fields", async () => {
		const manager = createManager();
		const root =
			mount(`<div class="metadata-property" data-property-key="TAGS">
			<div class="multi-select-pill colored-tag-tag"><span class="multi-select-pill-remove-button colored-tag-tag"></span></div>
		</div><div class="bases-metadata-value" data-property-type="Tags">
			<div class="multi-select-pill colored-tag-tag"><span class="multi-select-pill-remove-button colored-tag-tag"></span></div>
		</div><div class="metadata-property" data-property-key="other"><div class="multi-select-pill colored-tag-tag"></div></div>`);
		manager.setTagColors("tag", light, dark);
		await settle();
		expect(root.querySelectorAll("[data-colored-tags]")).toHaveLength(4);
		root.querySelectorAll<HTMLElement>("[data-colored-tags]").forEach(
			(el) => expectColors(el),
		);
	});

	it("uses last-written rule order when href, colored class and native aliases overlap", async () => {
		const manager = createManager();
		const root = mount(`<a class="tag colored-tag-first" href="#SECOND"></a>
			<div class="cm-s-obsidian"><div class="cm-line"><span class="cm-hashtag colored-tag-first cm-tag-second"></span></div></div>`);
		manager.setTagColors("first", light, dark);
		manager.setTagColors("second", dark, light);
		await settle();
		root.querySelectorAll<HTMLElement>("a, span").forEach((el) =>
			expectColors(el, dark),
		);
		manager.setTagColors("first", light, dark);
		await settle();
		root.querySelectorAll<HTMLElement>("a, span").forEach((el) =>
			expectColors(el),
		);
	});

	it("handles native flattened-name collisions in insertion order", async () => {
		const manager = createManager();
		const root = mount(
			'<div class="cm-s-obsidian"><div class="cm-line"><span class="cm-hashtag cm-tag-ab"></span></div></div>',
		);
		manager.setTagColors("ab", light, dark);
		manager.setTagColors("a_b", dark, light);
		await settle();
		expectColors(root.querySelector("span")!, dark);
	});

	it("updates reused nodes and clears stale properties when their tag is removed", async () => {
		const manager = createManager();
		const root = mount(
			'<a class="tag" href="#first"></a><a class="tag colored-tag-first"></a>',
		);
		manager.setTagColors("first", light, dark);
		manager.setTagColors("second", dark, light);
		await settle();
		const [hrefTag, classTag] = Array.from(
			root.querySelectorAll<HTMLElement>("a"),
		);
		hrefTag.setAttribute("href", "#second");
		classTag.className = "tag colored-tag-second";
		await settle();
		expectColors(hrefTag, dark);
		expectColors(classTag, dark);
		hrefTag.setAttribute("href", "https://example.com/#second");
		classTag.className = "tag";
		await settle();
		for (const tag of [hrefTag, classTag]) {
			expect(tag.hasAttribute("data-colored-tags")).toBe(false);
			expect(
				tag.style.getPropertyValue("--colored-tags-light-color"),
			).toBe("");
		}
	});

	it.each([
		["metadata-property", "data-property-key"],
		["bases-metadata-value", "data-property-type"],
	])("reacts when a %s ancestor changes property type", async (cls, attr) => {
		const manager = createManager();
		const root = mount(
			`<div class="${cls}" ${attr}="other"><div class="multi-select-pill colored-tag-tag"></div></div>`,
		);
		manager.setTagColors("tag", light, dark);
		await settle();
		const parent = root.firstElementChild!;
		const pill = root.querySelector<HTMLElement>(".multi-select-pill")!;
		parent.setAttribute(attr, "tags");
		await settle();
		expectColors(pill);
		parent.setAttribute(attr, "other");
		await settle();
		expect(pill.hasAttribute("data-colored-tags")).toBe(false);
	});

	it("handles late nodes, text mutations, removal, moves and reinsertion without retaining styles", async () => {
		const manager = createManager();
		manager.setTagColors("tag", light, dark);
		await settle();
		const root = mount(
			'<div class="cm-s-obsidian"><div class="cm-line"><span class="cm-hashtag colored-tag-tag"></span></div></div>',
		);
		const tag = root.querySelector<HTMLElement>("span")!;
		tag.append(document.createTextNode("#tag"));
		await settle();
		expectColors(tag);
		root.append(tag);
		await settle();
		expect(tag.hasAttribute("data-colored-tags")).toBe(false);
		root.querySelector(".cm-line")!.append(tag);
		await settle();
		expectColors(tag);
		root.remove();
		await settle();
		expect(tag.hasAttribute("data-colored-tags")).toBe(false);
		document.body.append(root);
		await settle();
		expectColors(tag);
	});

	it("batches refreshes and avoids rewriting unchanged properties", async () => {
		const manager = createManager();
		const root = mount('<a class="tag" href="#tag"></a>');
		const tag = root.querySelector<HTMLElement>("a")!;
		const setProps = vi.spyOn(tag, "setCssProps");
		manager.setTagColors("tag", light, dark);
		manager.setTagColors("other", dark, light);
		await settle();
		expect(setProps).toHaveBeenCalledTimes(1);
		tag.classList.add("unrelated");
		await settle();
		expect(setProps).toHaveBeenCalledTimes(1);
		manager.setTagColors("tag", dark, light);
		await settle();
		expect(setProps).toHaveBeenCalledTimes(2);
		expectColors(tag, dark);
	});

	it("cleans owned properties only, including detached nodes before the observer runs", async () => {
		const manager = createManager();
		const root = mount(
			'<a class="tag other" href="#tag" style="color: green; --other-plugin: keep"></a>',
		);
		const tag = root.querySelector<HTMLElement>("a")!;
		manager.setTagColors("tag", light, dark);
		await settle();
		root.remove();
		manager.removeAll();
		await settle();
		expect(tag.hasAttribute("data-colored-tags")).toBe(false);
		expect(tag.style.getPropertyValue("--colored-tags-light-color")).toBe(
			"",
		);
		expect(tag.style.color).toBe("green");
		expect(tag.style.getPropertyValue("--other-plugin")).toBe("keep");
		expect(tag.className).toBe("tag other");
		document.body.append(root);
		await settle();
		expect(tag.hasAttribute("data-colored-tags")).toBe(false);
	});

	it("cancels pending work on unload and can restart without stale colors", async () => {
		const manager = createManager();
		const root = mount(
			'<a class="tag" href="#old"></a><a class="tag" href="#new"></a>',
		);
		manager.setTagColors("old", light, dark);
		manager.removeAll();
		await settle();
		expect(root.querySelector("[data-colored-tags]")).toBeNull();
		manager.setTagColors("old", light, dark);
		manager.removeAll();
		manager.setTagColors("new", dark, light);
		await settle();
		expect(root.firstElementChild!.hasAttribute("data-colored-tags")).toBe(
			false,
		);
		expectColors(root.lastElementChild as HTMLElement, dark);
	});

	it("clears copied plugin styles when a cloned tag no longer has known colors", async () => {
		const manager = createManager();
		const root = mount('<a class="tag" href="#tag"></a>');
		const tag = root.querySelector<HTMLElement>("a")!;
		manager.setTagColors("tag", light, dark);
		await settle();
		const clone = tag.cloneNode(true) as HTMLElement;
		clone.setAttribute("href", "#unknown");
		root.append(clone);
		await settle();
		expect(clone.hasAttribute("data-colored-tags")).toBe(false);
		expect(clone.style.getPropertyValue("--colored-tags-light-color")).toBe(
			"",
		);

		const pendingClone = tag.cloneNode(true) as HTMLElement;
		root.append(pendingClone);
		manager.removeAll();
		expect(pendingClone.hasAttribute("data-colored-tags")).toBe(false);
		expect(
			pendingClone.style.getPropertyValue("--colored-tags-dark-gradient"),
		).toBe("");
	});

	it("keeps theme declarations in styles.css and remove buttons foreground-only", () => {
		const css = readFileSync("src/styles.css", "utf8");
		const rules = css
			.split("}")
			.filter((rule) => rule.includes("[data-colored-tags]"));
		expect(rules).toHaveLength(4);
		for (const rule of rules) {
			const theme = rule.includes("body.theme-dark") ? "dark" : "light";
			expect(rule).toContain(`color: var(--colored-tags-${theme}-color)`);
			if (rule.includes("multi-select-pill-remove-button")) {
				expect(rule).toContain(
					`stroke: var(--colored-tags-${theme}-color)`,
				);
				expect(rule).not.toContain("background");
			} else {
				expect(rule).toContain(
					`background-color: var(--colored-tags-${theme}-background)`,
				);
				expect(rule).toContain(
					`linear-gradient(108deg, var(--colored-tags-${theme}-gradient))`,
				);
			}
			expect(rule).not.toContain(":is(");
			expect(rule).not.toContain("!important");
		}
	});
});
