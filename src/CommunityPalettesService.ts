import { requestUrl } from "obsidian";

export interface CommunityPalette {
	id: string;
	value: string;
	colors: string[];
	author: string;
	authorUrl?: string;
	commentUrl?: string;
	score: number;
}

interface GitHubDiscussionComment {
	id: number;
	body?: string;
	html_url?: string;
	created_at?: string;
	user?: {
		login?: string;
		html_url?: string;
	};
	reactions?: Record<string, number | undefined>;
}

const DISCUSSION_COMMENTS_URL =
	"https://api.github.com/repos/pfrankov/obsidian-colored-tags/discussions/18/comments";
const PER_PAGE = 100;
const POSITIVE_REACTIONS = [
	"+1",
	"heart",
	"hooray",
	"rocket",
	"eyes",
	"laugh",
] as const;
const NEGATIVE_REACTIONS = ["-1", "confused"] as const;

export class CommunityPalettesService {
	private static cache: CommunityPalette[] | null = null;
	private static pendingRequest: Promise<CommunityPalette[]> | undefined;

	static async getCommunityPalettes(): Promise<CommunityPalette[]> {
		if (this.cache) {
			return this.cache;
		}

		if (this.pendingRequest) {
			return this.pendingRequest;
		}

		this.pendingRequest = this.fetchCommunityPalettes()
			.then((palettes) => {
				this.cache = palettes;
				return palettes;
			})
			.finally(() => {
				this.pendingRequest = undefined;
			});

		return this.pendingRequest;
	}

	private static async fetchCommunityPalettes(): Promise<CommunityPalette[]> {
		const palettes = await this.collectPalettes(
			1,
			[],
			new Set<string>(),
			new Set<string>(),
		);

		return palettes
			.sort((a, b) => {
				if (a.score === b.score) {
					return a.order - b.order;
				}
				return b.score - a.score;
			})
			.map(({ order: _order, ...palette }) => palette);
	}

	private static async collectPalettes(
		page: number,
		palettes: Array<CommunityPalette & { order: number }>,
		uniqueValues: Set<string>,
		authorsWithPalette: Set<string>,
	): Promise<Array<CommunityPalette & { order: number }>> {
		const response = await this.requestPage(page);
		if (!response) {
			return palettes;
		}

		const comments = (response.json ?? []) as GitHubDiscussionComment[];
		if (!comments.length) {
			return palettes;
		}

		this.appendPalettesFromComments(
			comments,
			palettes,
			uniqueValues,
			authorsWithPalette,
		);

		if (comments.length < PER_PAGE) {
			return palettes;
		}

		return this.collectPalettes(
			page + 1,
			palettes,
			uniqueValues,
			authorsWithPalette,
		);
	}

	private static async requestPage(page: number) {
		try {
			const response = await requestUrl({
				url: `${DISCUSSION_COMMENTS_URL}?per_page=${PER_PAGE}&page=${page}`,
				headers: {
					Accept: "application/vnd.github+json",
				},
				throw: false,
			});
			if (response.status !== 200) {
				console.error(
					`GitHub API responded with ${response.status} on page ${page}`,
				);
				return null;
			}
			return response;
		} catch (error) {
			console.error("Failed to fetch community palettes", error);
			return null;
		}
	}

	private static appendPalettesFromComments(
		comments: GitHubDiscussionComment[],
		palettes: Array<CommunityPalette & { order: number }>,
		uniqueValues: Set<string>,
		authorsWithPalette: Set<string>,
	) {
		const scoredComments = comments
			.map((comment) => ({
				comment,
				score: this.getReactionScore(comment.reactions),
			}))
			.filter(({ score }) => score >= 0);

		for (const { comment, score } of scoredComments) {
			const author = comment.user?.login || "unknown";
			if (authorsWithPalette.has(author)) {
				continue;
			}

			const palettesFromComment = this.extractPalettesFromBody(
				comment.body || "",
			);
			const [value] = palettesFromComment;
			if (!value || uniqueValues.has(value)) {
				continue;
			}
			uniqueValues.add(value);
			authorsWithPalette.add(author);
			palettes.push({
				id: `${comment.id}-0`,
				value,
				colors: value
					.split("-")
					.filter(Boolean)
					.map((hex) => `#${hex}`),
				author,
				authorUrl: comment.user?.html_url,
				commentUrl: comment.html_url,
				score,
				order: palettes.length,
			});
		}
	}

	private static extractPalettesFromBody(body: string): string[] {
		const regex = /\b([0-9a-fA-F]{6}(?:-[0-9a-fA-F]{6})+)\b/g;
		const results = new Set<string>();
		let match: RegExpExecArray | null;
		while ((match = regex.exec(body)) !== null) {
			results.add(match[1].toLowerCase());
		}
		return Array.from(results);
	}

	private static getReactionScore(
		reactions?: GitHubDiscussionComment["reactions"],
	): number {
		if (!reactions) {
			return 0;
		}
		const positive = POSITIVE_REACTIONS.reduce((total, key) => {
			return total + (reactions[key] ?? 0);
		}, 0);
		const negative = NEGATIVE_REACTIONS.reduce((total, key) => {
			return total + (reactions[key] ?? 0);
		}, 0);
		return positive - negative;
	}
}
