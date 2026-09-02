import { describe, it, expect, vi, afterEach } from "vitest";
import { logger } from "../src/logger";

describe("logger", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("delegates warn to console.warn", () => {
		const spy = vi
			.spyOn(console, "warn")
			.mockImplementation(() => undefined);

		logger.warn("warn-message");

		expect(spy).toHaveBeenCalledWith("warn-message");
	});

	it("delegates error to console.error", () => {
		const spy = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);

		logger.error("error-message");

		expect(spy).toHaveBeenCalledWith("error-message");
	});

});
