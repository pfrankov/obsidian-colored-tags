import de from "./de.json";
import en from "./en.json";
import ru from "./ru.json";
import zh from "./zh.json";
import { logger } from "../logger";

type TranslationTree = {
	[key: string]: string | TranslationTree;
};

const locales: Record<string, TranslationTree> = {
	en: en as TranslationTree,
	ru: ru as TranslationTree,
	de: de as TranslationTree,
	zh: zh as TranslationTree,
};

export class I18n {
	static t(key: string, params?: { [key: string]: string }): string {
		const locale = window.localStorage.getItem("language") || "en";
		const keys = key.split(".");

		let translations: TranslationTree | string =
			locales[locale] || locales["en"];

		for (const k of keys) {
			if (typeof translations !== "object" || translations === null) {
				logger.warn(`Translation missing: ${key}`);
				translations = locales["en"];
				return this.extractEnglishValue(keys, key);
			}
			if ((translations as TranslationTree)[k] === undefined) {
				logger.warn(`Translation missing: ${key}`);
				translations = locales["en"];
				return this.extractEnglishValue(keys, key);
			}
			translations = (translations as TranslationTree)[k];
		}

		if (typeof translations !== "string") {
			return key;
		}

		let result = translations;

		// Handle string interpolation if params are provided
		if (params) {
			Object.entries(params).forEach(([key, value]) => {
				const placeholder = new RegExp(`{{${key}}}`, "g");
				result = result.replace(placeholder, value);
			});
		}

		return result;
	}
	private static extractEnglishValue(
		keys: string[],
		originalKey: string,
	): string {
		let engValue: TranslationTree | string | undefined = locales["en"];
		for (const ek of keys) {
			if (typeof engValue !== "object" || engValue === null) {
				engValue = undefined;
				break;
			}
			if (engValue[ek] === undefined) {
				engValue = undefined;
				break;
			}
			engValue = engValue[ek];
		}
		if (typeof engValue === "string") {
			return engValue;
		}
		return originalKey;
	}
}
