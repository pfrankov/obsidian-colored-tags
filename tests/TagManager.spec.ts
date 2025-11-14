import { describe, it, expect } from "vitest";
import { TagManager } from "../src/TagManager";

describe("TagManager", () => {
	it("initializes with known tags and manages rendered state", () => {
		const manager = new TagManager({ a: 1, b: 2 });

		expect(manager.getTagsMap().get("a")).toBe(1);
		expect(manager.getTagsMap().get("b")).toBe(2);

		manager.markAsRendered("a");
		expect(manager.isRendered("a")).toBe(true);
		expect(manager.isRendered("b")).toBe(false);

		manager.clearRenderedTags();
		expect(manager.isRendered("a")).toBe(false);
	});

	it("updates known tags from metadata cache and detects changes", async () => {
		const manager = new TagManager({});
		const metadataCache = {
			getTags: () => ({ "#a": 1, "#a/b": 1, "#c": 1 }),
		} as any;

		const changed = await manager.updateKnownTags(metadataCache);
		expect(changed).toBe(true);

		const exported = manager.exportKnownTags();
		expect(exported).toHaveProperty("a");
		expect(exported).toHaveProperty("a/b");
		expect(exported).toHaveProperty("c");

		const changedAgain = await manager.updateKnownTags(metadataCache);
		expect(changedAgain).toBe(false);
	});

	it("handles complex tag hierarchies with siblings and nesting", async () => {
		const manager = new TagManager({ existing: 5 });
		const metadataCache = {
			getTags: () => ({
				"#existing": 1,
				"#new": 1,
				"#parent": 1,
				"#parent/child1": 1,
				"#parent/child2": 1,
			}),
		} as any;

		await manager.updateKnownTags(metadataCache);
		const tagsMap = manager.getTagsMap();

		// Preserves existing orders
		expect(tagsMap.get("existing")).toBe(5);
		// Assigns sequential sibling orders
		expect(tagsMap.get("new")).toBe(6);
		expect(tagsMap.get("parent/child1")).toBe(1);
		expect(tagsMap.get("parent/child2")).toBe(2);
	});
});
