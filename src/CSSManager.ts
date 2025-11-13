export class CSSManager {
	private appendBuffer: string[] = [];
	private isPending = false;
	private readonly ATTRIBUTE = "colored-tags-style";

	append(css: string): void {
		this.appendBuffer.push(css);
		if (this.isPending) {
			return;
		}
		this.isPending = true;
		Promise.resolve().then(() => this.flush());
	}

	private flush(): void {
		let styleEl = document.head.querySelector(`[${this.ATTRIBUTE}]`);
		if (!styleEl) {
			styleEl = document.head.createEl("style", {
				type: "text/css",
				attr: { [this.ATTRIBUTE]: "" },
			});
		}
		styleEl.appendText(this.appendBuffer.join("\n"));
		this.appendBuffer = [];
		this.isPending = false;
	}

	removeAll(): void {
		document.head.querySelectorAll(`[${this.ATTRIBUTE}]`).forEach((el) => {
			el.remove();
		});
	}
}
