import { describe, it, expect, beforeEach } from "vitest";
import { CSSManager } from "../src/CSSManager";

describe("CSSManager", () => {
	beforeEach(() => {
		document.head.innerHTML = "";
	});

	it("appends multiple CSS rules into a single batched style tag", async () => {
		const manager = new CSSManager();

		manager.append(".a { color: red }");
		manager.append(".b { color: blue }");
		await Promise.resolve();

		const styles = document.head.querySelectorAll("[colored-tags-style]");
		expect(styles).toHaveLength(1);

		const styleText = styles[0].textContent || "";
		expect(styleText).toContain(".a { color: red }");
		expect(styleText).toContain(".b { color: blue }");
	});

	it("removes all colored-tags styles", async () => {
		const manager = new CSSManager();

		manager.append(".test { color: green }");
		await Promise.resolve();
		expect(
			document.head.querySelectorAll("[colored-tags-style]"),
		).toHaveLength(1);

		manager.removeAll();
		expect(
			document.head.querySelectorAll("[colored-tags-style]"),
		).toHaveLength(0);
	});
});
