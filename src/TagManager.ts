import { MetadataCache } from "obsidian";

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
		this.tagsMap = new Map(Object.entries(knownTags));
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
		const appTags = Object.keys(metadataCache.getTags())
			.map((tag) => tag.replace(/#/g, ""))
			.filter((tag) => !tag.match(/\/$/) && tag.length > 0);

		const allTags = Array.from(
			new Set([...this.tagsMap.keys(), ...appTags]),
		);

		let hasChanges = false;
		for (const tag of allTags) {
			if (this.assignOrderToTagPath(tag, allTags)) {
				hasChanges = true;
			}
		}

		return hasChanges;
	}

	exportKnownTags(): Record<string, number> {
		return Object.fromEntries(this.tagsMap.entries());
	}

	private assignOrderToTagPath(tag: string, allTags: string[]): boolean {
		const chunks = tag.split("/");
		let combinedTag = "";
		let hasChanges = false;

		for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
			const key = [combinedTag, chunks[chunkIndex]]
				.filter(Boolean)
				.join("/");

			if (!this.tagsMap.has(key)) {
				const order = this.calculateOrderForNewTag(
					key,
					allTags,
					chunkIndex,
					combinedTag,
				);
				this.tagsMap.set(key, order);
				hasChanges = true;
			}

			combinedTag = key;
		}

		return hasChanges;
	}

	private calculateOrderForNewTag(
		key: string,
		allTags: string[],
		depth: number,
		parentPath: string,
	): number {
		const siblings = allTags.filter(
			(tag) =>
				tag.split("/").length === depth + 1 &&
				(parentPath ? tag.startsWith(parentPath) : true),
		);

		const maxOrder = siblings.reduce((max, sibling) => {
			return Math.max(max, this.tagsMap.get(sibling) || 0);
		}, 0);

		return maxOrder + 1;
	}
}
