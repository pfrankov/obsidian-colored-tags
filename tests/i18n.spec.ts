import { afterEach, vi } from "vitest";
import { I18n } from "../src/i18n";
import { logger } from "../src/logger";
import en from "../src/i18n/en.json";

describe("I18n", () => {
	beforeEach(() => {
		window.localStorage.clear();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("returns translations for the active locale", () => {
		window.localStorage.setItem("language", "de");

		const translated = I18n.t("settings.palette.options.custom");

		expect(translated).toBe("Benutzerdefiniert");
	});

	it("falls back to english when locale is not supported", () => {
		window.localStorage.setItem("language", "fr");

		const translated = I18n.t("settings.palette.options.custom");

		expect(translated).toBe("Custom");
	});

	it("supports interpolation params", () => {
		window.localStorage.setItem("language", "en");

		const translated = I18n.t("notices.updateAvailable", {
			pluginName: "Colored Tags",
		});

		expect(translated).toBe("⬆️ Colored Tags: a new version is available");
	});

	it("replaces all occurrences of the same placeholder", () => {
		window.localStorage.setItem("language", "en");
		(en as any).__multi = "{{name}} says hi to {{name}}";

		try {
			const translated = I18n.t("__multi", { name: "Alice" });
			expect(translated).toBe("Alice says hi to Alice");
		} finally {
			delete (en as any).__multi;
		}
	});

	it("falls back to english value when locale translation is missing", () => {
		window.localStorage.setItem("language", "zh");
		const warnSpy = vi
			.spyOn(logger, "warn")
			.mockImplementation(() => undefined);
		(en as any).__test = { nested: "English fallback" };

		try {
			const translated = I18n.t("__test.nested");

			expect(translated).toBe("English fallback");
			expect(warnSpy).toHaveBeenCalledWith(
				"Translation missing: __test.nested",
			);
		} finally {
			delete (en as any).__test;
		}
	});

	it("returns the key when even english translation path is invalid", () => {
		window.localStorage.setItem("language", "en");
		const warnSpy = vi
			.spyOn(logger, "warn")
			.mockImplementation(() => undefined);

		const translated = I18n.t("settings.palette.heading.extra");

		expect(translated).toBe("settings.palette.heading.extra");
		expect(warnSpy).toHaveBeenCalledWith(
			"Translation missing: settings.palette.heading.extra",
		);
	});

	it("returns the key when translation resolves to a subtree", () => {
		window.localStorage.setItem("language", "en");

		const translated = I18n.t("settings.palette");

		expect(translated).toBe("settings.palette");
	});

	it("falls back to key when english subtree misses a child", () => {
		window.localStorage.setItem("language", "en");
		const warnSpy = vi
			.spyOn(logger, "warn")
			.mockImplementation(() => undefined);

		const translated = I18n.t("settings.palette.nonexistent");

		expect(translated).toBe("settings.palette.nonexistent");
		expect(warnSpy).toHaveBeenCalledWith(
			"Translation missing: settings.palette.nonexistent",
		);
	});
});
