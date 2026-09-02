import tsparser from "@typescript-eslint/parser";
import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";

export default defineConfig([
	{
		ignores: ["dist/**", "node_modules/**"],
	},
	...obsidianmd.configs.recommended,
	{
		files: ["src/**/*.ts"],
		languageOptions: {
			parser: tsparser,
			parserOptions: {
				project: "./tsconfig.json",
				tsconfigRootDir: import.meta.dirname,
			},
		},
	},
	{
		files: ["src/CSSManager.ts"],
		rules: {
			// Core functionality: generated selectors/colors are vault- and
			// user-specific, so they cannot be moved to static styles.css.
			"obsidianmd/no-forbidden-elements": "off",
		},
	},
]);
