import { describe, it, expect } from "vitest";
import { TagManager } from "../src/TagManager";

function createMetadataCache(tags: string[]) {
	return {
		getTags: () =>
			Object.fromEntries(tags.map((tag) => [tag, 1] as const)),
	} as any;
}

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
		const metadataCache = createMetadataCache([
			"#existing",
			"#new",
			"#parent",
			"#parent/child1",
			"#parent/child2",
		]);

		await manager.updateKnownTags(metadataCache);
		const tagsMap = manager.getTagsMap();

		// Preserves existing orders
		expect(tagsMap.get("existing")).toBe(5);
		// Assigns sequential sibling orders
		expect(tagsMap.get("new")).toBe(6);
		expect(tagsMap.get("parent/child1")).toBe(1);
		expect(tagsMap.get("parent/child2")).toBe(2);
	});

	it("assigns unique sibling orders on first discovery", async () => {
		const manager = new TagManager({});
		const metadataCache = createMetadataCache(
			Array.from({ length: 11 }, (_, index) => `#tag${index + 1}`),
		);

		await manager.updateKnownTags(metadataCache);
		const tagsMap = manager.getTagsMap();
		const orders = Array.from(tagsMap.values());

		expect(new Set(orders).size).toBe(orders.length);
		expect(tagsMap.get("tag10")).not.toBe(tagsMap.get("tag2"));
		expect(tagsMap.get("tag11")).not.toBe(tagsMap.get("tag3"));
	});

	it("appends new siblings after the highest existing order", async () => {
		const manager = new TagManager(
			Object.fromEntries(
				Array.from({ length: 9 }, (_, index) => [
					`tag${index + 1}`,
					index + 1,
				]),
			),
		);
		const metadataCache = createMetadataCache(
			Array.from({ length: 11 }, (_, index) => `#tag${index + 1}`),
		);

		await manager.updateKnownTags(metadataCache);
		const tagsMap = manager.getTagsMap();

		expect(tagsMap.get("tag9")).toBe(9);
		expect(tagsMap.get("tag10")).toBe(10);
		expect(tagsMap.get("tag11")).toBe(11);
	});

	it("does not reuse existing sibling orders for tags that sort earlier", async () => {
		const manager = new TagManager({ zebra: 1, yak: 2 });
		const metadataCache = createMetadataCache([
			"#zebra",
			"#yak",
			"#aardvark",
		]);

		await manager.updateKnownTags(metadataCache);
		const tagsMap = manager.getTagsMap();

		expect(tagsMap.get("zebra")).toBe(1);
		expect(tagsMap.get("yak")).toBe(2);
		expect(tagsMap.get("aardvark")).toBe(3);
	});

	it("normalizes metadata tags and collapses duplicates with the same normalized name", async () => {
		const manager = new TagManager({});
		const metadataCache = createMetadataCache([
			"#Tag",
			"  # tag /  ",
			"#TAG/Child/",
			"#tag/child",
		]);

		await manager.updateKnownTags(metadataCache);

		expect(manager.exportKnownTags()).toEqual({
			tag: 1,
			"tag/child": 1,
		});
	});

	it("creates missing parent paths once for nested metadata tags", async () => {
		const manager = new TagManager({});
		const metadataCache = createMetadataCache([
			"#parent/child",
			"#parent/child/grand",
			"#parent/sibling",
		]);

		await manager.updateKnownTags(metadataCache);
		const tagsMap = manager.getTagsMap();

		expect(Array.from(tagsMap.keys())).toEqual([
			"parent",
			"parent/child",
			"parent/sibling",
			"parent/child/grand",
		]);
		expect(tagsMap.get("parent")).toBe(1);
		expect(tagsMap.get("parent/child")).toBe(1);
		expect(tagsMap.get("parent/sibling")).toBe(2);
		expect(tagsMap.get("parent/child/grand")).toBe(1);
	});

	it("handles mixed explicit and implicit parent tags without duplicating paths", async () => {
		const manager = new TagManager({});
		const metadataCache = createMetadataCache([
			"#Root",
			" #root/Child ",
			"#ROOT/child/grand/",
			"#root/sibling",
			"#root/child",
		]);

		await manager.updateKnownTags(metadataCache);

		expect(manager.exportKnownTags()).toEqual({
			root: 1,
			"root/child": 1,
			"root/sibling": 2,
			"root/child/grand": 1,
		});
	});

	it("assigns sibling orders independently for different parent tags", async () => {
		const manager = new TagManager({});
		const metadataCache = createMetadataCache([
			"#alpha/child1",
			"#alpha/child2",
			"#beta/child1",
			"#beta/child2",
		]);

		await manager.updateKnownTags(metadataCache);
		const tagsMap = manager.getTagsMap();

		expect(tagsMap.get("alpha")).toBe(1);
		expect(tagsMap.get("beta")).toBe(2);
		expect(tagsMap.get("alpha/child1")).toBe(1);
		expect(tagsMap.get("alpha/child2")).toBe(2);
		expect(tagsMap.get("beta/child1")).toBe(1);
		expect(tagsMap.get("beta/child2")).toBe(2);
	});

	it("appends after the highest existing order even when there are gaps", async () => {
		const manager = new TagManager({
			alpha: 1,
			"alpha/first": 1,
			"alpha/third": 3,
		});
		const metadataCache = createMetadataCache([
			"#alpha/first",
			"#alpha/second",
			"#alpha/third",
		]);

		await manager.updateKnownTags(metadataCache);
		const tagsMap = manager.getTagsMap();

		expect(tagsMap.get("alpha/first")).toBe(1);
		expect(tagsMap.get("alpha/third")).toBe(3);
		expect(tagsMap.get("alpha/second")).toBe(4);
	});

	it("ignores metadata tags that normalize to empty names", async () => {
		const manager = new TagManager({});
		const metadataCache = createMetadataCache(["#", "   ", "#///"]);

		const changed = await manager.updateKnownTags(metadataCache);

		expect(changed).toBe(false);
		expect(manager.exportKnownTags()).toEqual({});
	});

	it("removes tags that are no longer present in metadata", async () => {
		const manager = new TagManager({ keep: 1, drop: 2 });
		const metadataCache = {
			getTags: () => ({ "#KEEP": 1 }),
		} as any;

		const changed = await manager.updateKnownTags(metadataCache);

		expect(changed).toBe(true);
		expect(manager.getTagsMap().has("drop")).toBe(false);
		expect(manager.getTagsMap().has("keep")).toBe(true);
	});

	it("detects unchanged maps without flagging updates", () => {
		const manager = new TagManager({ stable: 1 });
		(manager as any).tagsMap = new Map([["stable", 1]]);

		const result = (manager as any).hasChanged(new Map([["stable", 1]]));

		expect(result).toBe(false);
	});

	it("detects reorders when sizes match", () => {
		const manager = new TagManager({ a: 1, b: 2 });
		(manager as any).tagsMap = new Map([
			["a", 1],
			["b", 2],
		]);

		const result = (manager as any).hasChanged(
			new Map([
				["a", 2],
				["b", 1],
			]),
		);

		expect(result).toBe(true);
	});

	it("ignores invalid tag names on construction", () => {
		const manager = new TagManager({ "#": 1, "   ": 2 });

		expect(manager.getTagsMap().size).toBe(0);
	});

	it("handles missing knownTags input gracefully", () => {
		const manager = new TagManager(undefined as any);

		expect(manager.getTagsMap().size).toBe(0);
	});
});
