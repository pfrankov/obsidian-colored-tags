import { describe, expect, it, vi } from "vitest";
import {
	TagApplier,
	applyColoredTagClass,
	applyColoredTagClassesInRoot,
	normalizeTagText,
	defaultTagTextGetter,
} from "../src/tag-appliers/TagApplier";

describe("TagApplier helpers", () => {
	it("ignores empty tag text", () => {
		const el = document.createElement("a");

		applyColoredTagClass([el], "   ");

		expect(el.className).toBe("");
	});

	it("cleans up old colored classes before applying a new one", () => {
		const el = document.createElement("a");
		el.className = "colored-tag-old other";

		applyColoredTagClass([el], "#new");

		expect(el.classList.contains("colored-tag-old")).toBe(false);
		expect(el.classList.contains("colored-tag-new")).toBe(true);
		expect(el.classList.contains("other")).toBe(true);
	});

	it("does not duplicate colored class when already applied", () => {
		const el = document.createElement("a");

		applyColoredTagClass([el], "#dup");
		const classCount = el.classList.length;
		applyColoredTagClass([el], "#dup");

		expect(el.classList.length).toBe(classCount);
	});

	it("returns null when tag text is missing", () => {
		expect(normalizeTagText(null)).toBeNull();
	});

	it("returns null from default getter when textContent is null", () => {
		const el = document.createElement("div");
		(el as any).textContent = null;

		expect(defaultTagTextGetter(el)).toBeNull();
	});

	it("uses default text getter when applying in root", () => {
		const el = document.createElement("div");
		el.className = "tag";
		el.textContent = "  #Default ";

		applyColoredTagClassesInRoot(el, ".tag");

		expect(el.classList.contains("colored-tag-default")).toBe(true);
	});

	it("applies classes to descendants when root does not match selector", () => {
		const root = document.createElement("div");
		const child = document.createElement("span");
		child.className = "tag";
		child.textContent = "#child";
		root.appendChild(child);

		applyColoredTagClassesInRoot(root, ".tag");

		expect(child.classList.contains("colored-tag-child")).toBe(true);
	});

	it("uses default getter inside TagApplier.apply", () => {
		const applier = new TagApplier({ selector: ".tag" });
		const root = document.createElement("div");
		root.className = "tag";
		root.textContent = "#Apply";

		applier.apply(root);

		expect(root.classList.contains("colored-tag-apply")).toBe(true);
	});

	it("handles mutation branches", () => {
		const applier = new TagApplier({ selector: ".tag" });
		const parent = document.createElement("div");
		const tag = document.createElement("span");
		tag.className = "tag";
		tag.textContent = "#old";
		parent.appendChild(tag);

		const rafSpy = vi
			.spyOn(window, "requestAnimationFrame")
			.mockImplementation((cb: FrameRequestCallback) => {
				cb(0);
				return 0;
			});
		const applySpy = vi.spyOn(applier, "apply");

		(applier as any).handleMutation({
			type: "characterData",
			target: tag.firstChild as Node,
			addedNodes: [] as any,
			removedNodes: [] as any,
			previousSibling: null,
			nextSibling: null,
			oldValue: null,
			attributeName: null,
			attributeNamespace: null,
		} as MutationRecord);

		expect(applySpy).toHaveBeenCalledWith(tag);
		applySpy.mockClear();

		(applier as any).handleMutation({
			type: "characterData",
			target: { parentNode: null } as any,
			addedNodes: [] as any,
			removedNodes: [] as any,
			previousSibling: null,
			nextSibling: null,
			oldValue: null,
			attributeName: null,
			attributeNamespace: null,
		} as MutationRecord);

		expect(applySpy).not.toHaveBeenCalled();
		applySpy.mockClear();

		const fragment = document.createDocumentFragment();
		const addedTag = document.createElement("span");
		addedTag.className = "tag";
		fragment.appendChild(addedTag);

		(applier as any).handleMutation({
			type: "childList",
			target: parent,
			addedNodes: [fragment, document.createTextNode("ignore")] as any,
			removedNodes: [] as any,
			previousSibling: null,
			nextSibling: null,
			oldValue: null,
			attributeName: null,
			attributeNamespace: null,
		} as MutationRecord);

		expect(applySpy).toHaveBeenCalledWith(fragment);
		expect(applySpy).toHaveBeenCalledTimes(1);
		rafSpy.mockRestore();
	});

	it("coalesces multiple mutations into one scheduled flush", () => {
		const applier = new TagApplier({ selector: ".tag" });
		const parent = document.createElement("div");

		const scheduled: FrameRequestCallback[] = [];
		vi.spyOn(window, "requestAnimationFrame").mockImplementation(
			(cb: FrameRequestCallback) => {
				scheduled.push(cb);
				return scheduled.length;
			},
		);
		const applySpy = vi.spyOn(applier, "apply");

		const first = document.createElement("span");
		first.className = "tag";
		(applier as any).handleMutation({
			type: "childList",
			target: parent,
			addedNodes: [first] as any,
			removedNodes: [] as any,
			previousSibling: null,
			nextSibling: null,
			oldValue: null,
			attributeName: null,
			attributeNamespace: null,
		} as MutationRecord);

		const second = document.createElement("span");
		second.className = "tag";
		(applier as any).handleMutation({
			type: "childList",
			target: parent,
			addedNodes: [second] as any,
			removedNodes: [] as any,
			previousSibling: null,
			nextSibling: null,
			oldValue: null,
			attributeName: null,
			attributeNamespace: null,
		} as MutationRecord);

		expect(scheduled).toHaveLength(1);
		scheduled[0](0 as any);
		expect(applySpy).toHaveBeenCalledTimes(2);
	});

	it("applies colored classes to custom targets", () => {
		const pill = document.createElement("div");
		pill.className = "tag";
		pill.textContent = "#tag";

		const remove = document.createElement("button");
		pill.appendChild(remove);

		const applier = new TagApplier({
			selector: ".tag",
			getTagTargets: (el) => [
				el,
				...Array.from(el.querySelectorAll("button")),
			],
		});

		applier.apply(pill);

		expect(pill.classList.contains("colored-tag-tag")).toBe(true);
		expect(remove.classList.contains("colored-tag-tag")).toBe(true);
	});
});

describe("TagApplier lifecycle", () => {
	it("cancels queued mutations on stop and can restart", async () => {
		const callbacks = new Map<number, FrameRequestCallback>();
		const request = vi
			.spyOn(window, "requestAnimationFrame")
			.mockImplementation((callback) => {
				callbacks.set(1, callback);
				return 1;
			});
		const cancel = vi
			.spyOn(window, "cancelAnimationFrame")
			.mockImplementation((id) => {
				callbacks.delete(id);
			});
		const applier = new TagApplier({ selector: ".tag" });
		const root = document.createElement("div");
		try {
			applier.start(root);
			root.innerHTML = '<a class="tag">#closed</a>';
			await Promise.resolve();
			expect(callbacks.size).toBe(1);
			applier.stop();
			expect(cancel).toHaveBeenCalledWith(1);
			expect(callbacks.size).toBe(0);
			expect(root.firstElementChild?.className).toBe("tag");
			applier.start(root);
			expect(root.firstElementChild?.className).toContain(
				"colored-tag-closed",
			);
			root.innerHTML = '<a class="tag">#reopened</a>';
			await Promise.resolve();
			callbacks.get(1)!(0);
			expect(root.firstElementChild?.className).toContain(
				"colored-tag-reopened",
			);
		} finally {
			applier.stop();
			request.mockRestore();
			cancel.mockRestore();
		}
	});

	it("schedules and cancels work in the observed document's window", async () => {
		const frame = document.createElement("iframe");
		document.body.appendChild(frame);
		const frameWindow = frame.contentWindow!;
		const frameDoc = frame.contentDocument!;
		(frameWindow as any).Node.prototype.instanceOf = function (type: any) {
			return this instanceof (frameWindow as any)[type.name];
		};
		const request = vi
			.spyOn(frameWindow, "requestAnimationFrame")
			.mockReturnValue(7);
		const cancel = vi.spyOn(frameWindow, "cancelAnimationFrame");
		const applier = new TagApplier({ selector: ".tag" });
		try {
			applier.start(frameDoc.body);
			frameDoc.body.innerHTML = '<a class="tag">#popout</a>';
			await Promise.resolve();
			expect(request).toHaveBeenCalledOnce();
			applier.stop();
			expect(cancel).toHaveBeenCalledWith(7);
		} finally {
			applier.stop();
			request.mockRestore();
			cancel.mockRestore();
			frame.remove();
		}
	});
});
