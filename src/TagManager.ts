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
		const normalized: Array<[string, number]> = [];
		for (const [tagName, order] of Object.entries(knownTags || {})) {
			const normalizedName = normalizeTagName(tagName);
			if (normalizedName) {
				normalized.push([normalizedName, order]);
			}
		}
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
		for (const rawTag of Object.keys(metadataCache.getTags())) {
			const tag = normalizeTagName(rawTag);
			if (!tag) {
				continue;
			}

			const chunks = tag.split("/");
			let combined = "";
			for (const chunk of chunks) {
				combined = combined ? `${combined}/${chunk}` : chunk;
				paths.add(combined);
			}
		}

		return Array.from(paths).sort((a, b) => {
			const depthDiff = a.split("/").length - b.split("/").length;
			return depthDiff !== 0 ? depthDiff : a.localeCompare(b);
		});
	}

	private buildOrders(tags: string[]): Map<string, number> {
		const nextMap = new Map<string, number>();
		const parentMaxOrder = new Map<string, number>();

		for (const tag of tags) {
			const previousOrder = this.tagsMap.get(tag);
			if (previousOrder === undefined) {
				continue;
			}

			const parentKey = this.getParentKey(tag);
			parentMaxOrder.set(
				parentKey,
				Math.max(parentMaxOrder.get(parentKey) ?? 0, previousOrder),
			);
		}

		for (const tag of tags) {
			const parentKey = this.getParentKey(tag);
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

	private getParentKey(tag: string): string {
		const parentIndex = tag.lastIndexOf("/");
		return parentIndex === -1 ? "" : tag.slice(0, parentIndex);
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
