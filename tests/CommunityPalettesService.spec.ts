import { describe, it, expect, vi, beforeEach } from "vitest";
import { requestUrl } from "obsidian";
import { CommunityPalettesService } from "../src/CommunityPalettesService";

const mockedRequestUrl = vi.mocked(requestUrl);
type RequestUrlResponseType = Awaited<ReturnType<typeof requestUrl>>;
const mockResponse = (
	data: Partial<RequestUrlResponseType>,
): RequestUrlResponseType => data as RequestUrlResponseType;

const resetServiceState = () => {
	(CommunityPalettesService as any).cache = null;
	(CommunityPalettesService as any).pendingRequest = undefined;
};

describe("CommunityPalettesService", () => {
	beforeEach(() => {
		mockedRequestUrl.mockReset();
		resetServiceState();
	});

	it("fetches palettes, deduplicates them, sorts by popularity, and caches the result", async () => {
		mockedRequestUrl.mockResolvedValueOnce(
			mockResponse({
				status: 200,
				json: [
					{
						id: 1,
						body: "Palette aabbcc-ddeeff and ffeedd-ccbbaa",
						reactions: { "+1": 1 },
						user: {
							login: "alpha",
							html_url: "https://github.com/alpha",
						},
						html_url: "https://github.com/discussion/1",
					},
					{
						id: 2,
						body: "010203-abcdef plus repeated aabbcc-ddeeff",
						reactions: { "+1": 5 },
						user: { login: "beta" },
						html_url: "https://github.com/discussion/2",
					},
				],
			}),
		);

		const firstCall = await CommunityPalettesService.getCommunityPalettes();
		const secondCall =
			await CommunityPalettesService.getCommunityPalettes();

		expect(firstCall).toHaveLength(2);
		expect(firstCall[0]).toMatchObject({
			id: "2-0",
			value: "010203-abcdef",
			colors: ["#010203", "#abcdef"],
			score: 5,
			author: "beta",
			commentUrl: "https://github.com/discussion/2",
		});
		expect(firstCall[1]).toMatchObject({
			id: "1-0",
			value: "aabbcc-ddeeff",
			colors: ["#aabbcc", "#ddeeff"],
			score: 1,
			author: "alpha",
			authorUrl: "https://github.com/alpha",
		});
		expect(
			firstCall.some((palette) => palette.value === "ffeedd-ccbbaa"),
		).toBe(false);
		expect(secondCall).toBe(firstCall);
		expect(mockedRequestUrl).toHaveBeenCalledTimes(1);
	});

	it("only takes the first palette from each comment", async () => {
		mockedRequestUrl.mockResolvedValueOnce(
			mockResponse({
				status: 200,
				json: [
					{
						id: 1,
						body: "111111-222222 and 333333-444444",
						reactions: { "+1": 2 },
						user: { login: "alpha" },
					},
					{
						id: 2,
						body: "aaaaaa-bbbbbb 999999-888888",
						reactions: { "+1": 1 },
						user: { login: "beta" },
					},
				],
			}),
		);

		const palettes = await CommunityPalettesService.getCommunityPalettes();

		expect(palettes.map((palette) => palette.value)).toEqual([
			"111111-222222",
			"aaaaaa-bbbbbb",
		]);
		expect(
			palettes.some((palette) => palette.value === "333333-444444"),
		).toBe(false);
		expect(
			palettes.some((palette) => palette.value === "999999-888888"),
		).toBe(false);
	});

	it("only keeps one palette per author", async () => {
		mockedRequestUrl.mockResolvedValueOnce(
			mockResponse({
				status: 200,
				json: [
					{
						id: 1,
						body: "aaaaaa-bbbbbb",
						reactions: { "+1": 1 },
						user: { login: "alpha" },
					},
					{
						id: 2,
						body: "cccccc-dddddd",
						reactions: { "+1": 5 },
						user: { login: "alpha" },
					},
					{
						id: 3,
						body: "eeeeee-ffffff",
						reactions: { "+1": 3 },
						user: { login: "beta" },
					},
				],
			}),
		);

		const palettes = await CommunityPalettesService.getCommunityPalettes();

		expect(palettes).toHaveLength(2);
		expect(
			palettes.find((palette) => palette.value === "cccccc-dddddd"),
		).toBeUndefined();
		expect(palettes.map((palette) => palette.author)).toEqual([
			"beta",
			"alpha",
		]);
	});

	it("shares in-flight requests across concurrent consumers", async () => {
		let releaseRequest: (() => void) | undefined;
		mockedRequestUrl.mockImplementationOnce(
			() =>
				new Promise<RequestUrlResponseType>((resolve) => {
					releaseRequest = () =>
						resolve(mockResponse({ status: 200, json: [] }));
				}) as unknown as ReturnType<typeof requestUrl>,
		);

		const firstPromise = CommunityPalettesService.getCommunityPalettes();
		const secondPromise = CommunityPalettesService.getCommunityPalettes();
		releaseRequest?.();
		const [firstResult, secondResult] = await Promise.all([
			firstPromise,
			secondPromise,
		]);

		expect(firstResult).toEqual([]);
		expect(secondResult).toBe(firstResult);
		expect(mockedRequestUrl).toHaveBeenCalledTimes(1);
	});

	it("logs errors and resolves with empty data when the first request fails", async () => {
		const consoleSpy = vi
			.spyOn(console, "error")
			.mockImplementation(() => {});
		mockedRequestUrl.mockResolvedValueOnce(
			mockResponse({ status: 500, json: [] }),
		);

		await expect(
			CommunityPalettesService.getCommunityPalettes(),
		).resolves.toEqual([]);
		expect(consoleSpy).toHaveBeenCalled();
		consoleSpy.mockRestore();
	});

	it("handles network errors by logging and returning accumulated palettes", async () => {
		const consoleSpy = vi
			.spyOn(console, "error")
			.mockImplementation(() => {});
		mockedRequestUrl.mockRejectedValueOnce(new Error("network"));

		await expect(
			CommunityPalettesService.getCommunityPalettes(),
		).resolves.toEqual([]);
		expect(consoleSpy).toHaveBeenCalledWith(
			"Failed to fetch community palettes",
			expect.any(Error),
		);
		consoleSpy.mockRestore();
	});

	it("returns already loaded palettes when a later page fails", async () => {
		const consoleSpy = vi
			.spyOn(console, "error")
			.mockImplementation(() => {});
		const fullPage = Array.from({ length: 100 }, (_, index) => ({
			id: index + 1,
			body: `${(index + 1).toString(16).padStart(6, "0")}-${(index + 2)
				.toString(16)
				.padStart(6, "0")}`,
			reactions: { "+1": 1 },
			user: { login: `page1-author-${index}` },
		}));
		mockedRequestUrl
			.mockResolvedValueOnce(
				mockResponse({ status: 200, json: fullPage }),
			)
			.mockResolvedValueOnce(mockResponse({ status: 429, json: [] }));

		const palettes = await CommunityPalettesService.getCommunityPalettes();

		expect(palettes).toHaveLength(fullPage.length);
		expect(consoleSpy).toHaveBeenCalled();
		expect(mockedRequestUrl).toHaveBeenCalledTimes(2);
		consoleSpy.mockRestore();
	});

	it("keeps insertion order when palettes have identical scores", async () => {
		mockedRequestUrl.mockResolvedValueOnce(
			mockResponse({
				status: 200,
				json: [
					{
						id: 1,
						body: "fff000-000fff",
						reactions: { "+1": 2 },
						user: { login: "alpha" },
					},
					{
						id: 2,
						body: "111111-222222",
						reactions: { "+1": 2 },
						user: { login: "beta" },
					},
				],
			}),
		);

		const palettes = await CommunityPalettesService.getCommunityPalettes();

		expect(palettes.map((palette) => palette.id)).toEqual(["1-0", "2-0"]);
	});

	it("returns empty list when response payload is missing", async () => {
		mockedRequestUrl.mockResolvedValueOnce(mockResponse({ status: 200 }));

		await expect(
			CommunityPalettesService.getCommunityPalettes(),
		).resolves.toEqual([]);
	});

	it("handles comments lacking body or reactions", async () => {
		mockedRequestUrl.mockResolvedValueOnce(
			mockResponse({
				status: 200,
				json: [{ id: 1 }, { id: 2, body: "ffeeaa-bbccdd" }],
			}),
		);

		const palettes = await CommunityPalettesService.getCommunityPalettes();

		expect(palettes).toHaveLength(1);
		expect(palettes[0]).toMatchObject({
			id: "2-0",
			value: "ffeeaa-bbccdd",
			colors: ["#ffeeaa", "#bbccdd"],
			score: 0,
			author: "unknown",
		});
	});

	it("omits palettes whose reaction score is negative", async () => {
		mockedRequestUrl.mockResolvedValueOnce(
			mockResponse({
				status: 200,
				json: [
					{ id: 1, body: "aaaaaa-bbbbbb", reactions: { "-1": 2 } },
					{
						id: 2,
						body: "cccccc-dddddd",
						reactions: { "+1": 3, "-1": 1 },
					},
				],
			}),
		);

		const palettes = await CommunityPalettesService.getCommunityPalettes();

		expect(palettes).toHaveLength(1);
		expect(palettes[0]).toMatchObject({
			id: "2-0",
			score: 2,
			value: "cccccc-dddddd",
		});
	});

	it("requests subsequent pages when previous page is full", async () => {
		const fullPage = Array.from({ length: 100 }, (_, index) => ({
			id: index + 1,
			body: `${String(index).padStart(2, "0")}aaaa-bbbbbc`,
			reactions: { "+1": 1 },
			user: { login: `author-${index}` },
		}));
		mockedRequestUrl
			.mockResolvedValueOnce(
				mockResponse({ status: 200, json: fullPage }),
			)
			.mockResolvedValueOnce(
				mockResponse({
					status: 200,
					json: [
						{
							id: 999,
							body: "abcdef-123456",
							reactions: { "+1": 3 },
							user: { login: "author-999" },
						},
					],
				}),
			);

		const palettes = await CommunityPalettesService.getCommunityPalettes();

		expect(mockedRequestUrl).toHaveBeenCalledTimes(2);
		expect(palettes.find((palette) => palette.id === "999-0")).toBeTruthy();
	});
});
