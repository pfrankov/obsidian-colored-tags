import { MetadataCache } from "obsidian";
import { normalizeTagName } from "./tagUtils";

// Extend MetadataCache to include getTags method that exists in runtime but not in types
declare module "obsidian" {
	interface MetadataCache {
		getTags(): Record<string, number>;
	}
}

export class TagManager {
	private tagsMap: Map<string, number>;
	private renderedTags = new Set<string>();

	constructor(knownTags: Record<string, number>) {
		const normalized = Object.entries(knownTags || {}).reduce<
			Array<[string, number]>
		>((acc, [tagName, order]) => {
			const normalizedName = normalizeTagName(tagName);
			if (normalizedName) {
				acc.push([normalizedName, order]);
			}
			return acc;
		}, []);
		this.tagsMap = new Map(normalized);
	}

	getTagsMap(): Map<string, number> {
		return this.tagsMap;
	}

	clearRenderedTags(): void {
		this.renderedTags.clear();
	}

	markAsRendered(tagName: string): void {
		this.renderedTags.add(tagName);
	}

	isRendered(tagName: string): boolean {
		return this.renderedTags.has(tagName);
	}

	async updateKnownTags(metadataCache: MetadataCache): Promise<boolean> {
		const orderedTags = this.collectTagPaths(metadataCache);
		const nextMap = this.buildOrders(orderedTags);
		const hasChanges = this.hasChanged(nextMap);

		if (hasChanges) {
			this.tagsMap = nextMap;
		}

		return hasChanges;
	}

	private collectTagPaths(metadataCache: MetadataCache): string[] {
		const paths = new Set<string>();
		Object.keys(metadataCache.getTags())
			.map((tag) => normalizeTagName(tag))
			.filter((tag) => tag.length > 0 && !tag.match(/\/$/))
			.forEach((tag) => {
				const chunks = tag.split("/");
				let combined = "";
				for (const chunk of chunks) {
					combined = combined ? `${combined}/${chunk}` : chunk;
					paths.add(combined);
				}
			});

		return Array.from(paths).sort((a, b) => {
			const depthDiff = a.split("/").length - b.split("/").length;
			return depthDiff !== 0 ? depthDiff : a.localeCompare(b);
		});
	}

	private buildOrders(tags: string[]): Map<string, number> {
		const nextMap = new Map<string, number>();
		const parentMaxOrder = new Map<string, number>();

		for (const tag of tags) {
			const parentIndex = tag.lastIndexOf("/");
			const parentKey =
				parentIndex === -1 ? "" : tag.slice(0, parentIndex);
			const previousOrder = this.tagsMap.get(tag);
			const order =
				previousOrder ?? (parentMaxOrder.get(parentKey) ?? 0) + 1;

			nextMap.set(tag, order);
			parentMaxOrder.set(
				parentKey,
				Math.max(parentMaxOrder.get(parentKey) ?? 0, order),
			);
		}

		return nextMap;
	}

	private hasChanged(nextMap: Map<string, number>): boolean {
		if (nextMap.size !== this.tagsMap.size) {
			return true;
		}
		for (const [tag, order] of nextMap.entries()) {
			if (this.tagsMap.get(tag) !== order) {
				return true;
			}
		}
		return false;
	}

	exportKnownTags(): Record<string, number> {
		return Object.fromEntries(this.tagsMap.entries());
	}
}
