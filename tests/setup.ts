import { vi } from "vitest";

// Use the manual mock for 'obsidian'
vi.mock("obsidian", async () => {
	// Import the manual mock file. Vitest supports returning a promise.
	const module = await import("./__mocks__/obsidian");
	return module;
});

// Polyfill `matchMedia` for jsdom environment (Vitest uses jsdom),
// to avoid `window.matchMedia is not a function` errors.
if (typeof window.matchMedia !== "function") {
	Object.defineProperty(window, "matchMedia", {
		writable: true,
		value: function (query: string) {
			return {
				matches: false,
				media: query,
				onchange: null,
				addListener: function () {},
				removeListener: function () {},
				addEventListener: function () {},
				removeEventListener: function () {},
				dispatchEvent: function () {
					return false;
				},
			};
		},
	});
}

// Ensure Obsidian-like helpers exist on HTMLElement prototype for tests
if (!(HTMLElement.prototype as any).createEl) {
	(HTMLElement.prototype as any).createEl = function (
		tag: string,
		attrs?: any,
		callback?: any,
	) {
		const el = document.createElement(tag as string) as any;
		if (typeof attrs === "string") {
			el.textContent = attrs;
		} else if (attrs?.text) {
			el.textContent = attrs.text;
		} else if (attrs?.attr) {
			Object.entries(attrs.attr).forEach(([k, v]) =>
				el.setAttribute(k, String(v)),
			);
		}
		if (attrs?.cls) el.className = attrs.cls;
		this.appendChild(el as unknown as Node);
		if (typeof callback === "function") callback(el);
		return el;
	};
}

if (!(HTMLElement.prototype as any).createDiv) {
	(HTMLElement.prototype as any).createDiv = function (
		o?: any,
		callback?: any,
	) {
		const div = document.createElement("div") as HTMLDivElement;
		if (typeof o === "string") {
			div.className = o;
		} else if (o?.cls) {
			div.className = o.cls;
		}
		this.appendChild(div as unknown as Node);
		if (typeof callback === "function") callback(div);
		return div;
	};
}

if (!(HTMLElement.prototype as any).createSpan) {
	(HTMLElement.prototype as any).createSpan = function (
		o?: any,
		callback?: any,
	) {
		const span = document.createElement("span");
		if (typeof o === "string") {
			span.className = o;
		} else if (o?.cls) {
			span.className = o.cls;
		}
		this.appendChild(span as unknown as Node);
		if (typeof callback === "function") callback(span);
		return span;
	};
}

if (!(HTMLElement.prototype as any).empty) {
	(HTMLElement.prototype as any).empty = function () {
		while (this.firstChild) this.removeChild(this.firstChild);
	};
}

if (!(HTMLElement.prototype as any).addClass) {
	(HTMLElement.prototype as any).addClass = function (name: string) {
		this.classList.add(name);
	};
}

if (!(HTMLElement.prototype as any).appendText) {
	(HTMLElement.prototype as any).appendText = function (text: string) {
		this.textContent = (this.textContent || "") + String(text);
	};
}
