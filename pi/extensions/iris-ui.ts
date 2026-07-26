import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";

/**
 * Iris UI — a bordered welcome panel.
 *
 * The header is the FIRST child of pi's layout, before the chat container, so
 * it scrolls away as the conversation grows rather than pinning a box to the
 * top forever. That is what makes a panel this tall acceptable.
 *
 * Nothing here uses setFooter: pi's built-in footer already carries cwd, git
 * branch, session name, the token breakdown, cache hit rate, context
 * percentage and cost, and replacing it would only take information away.
 */

/** Actions pi ships with NO default binding — the reason this panel exists. */
const SESSION_ACTIONS: ReadonlyArray<readonly [string, string]> = [
	["app.session.new", "new session"],
	["app.session.tree", "session tree"],
	["app.session.fork", "fork"],
	["app.session.resume", "resume"],
];

const COMMANDS: ReadonlyArray<readonly [string, string]> = [
	["/palette", "theme colours"],
	["/gauge", "context detail"],
	["/review", "review staged"],
];

/**
 * Render key names the way macOS prints them on the keys themselves.
 *
 * "alt+n" is meaningless on a Mac keyboard — the key is labelled ⌥ Option.
 * Showing the glyph is the difference between a hint and a puzzle.
 */
function macKey(spec: string): string {
	const GLYPH: Record<string, string> = {
		alt: "⌥",
		option: "⌥",
		ctrl: "⌃",
		shift: "⇧",
		cmd: "⌘",
		super: "⌘",
		meta: "⌘",
	};
	const parts = spec.split("+");
	const key = parts.pop() ?? "";
	const mods = parts.map((m) => GLYPH[m.toLowerCase()] ?? `${m}+`).join("");
	return mods + (key.length === 1 ? key.toUpperCase() : key);
}

/**
 * Resolve a binding from pi's own keybindings.json.
 *
 * Deliberately tolerant: pi parses that file with a bare JSON.parse inside
 * `catch { return undefined }`, so a malformed file means pi is ALSO running
 * without these bindings. Advertising them then would be a lie, and showing
 * nothing is the honest result.
 */
let cachedBindings: Record<string, string | string[]> | null | undefined;
function boundKey(id: string): string | undefined {
	if (cachedBindings === undefined) {
		try {
			cachedBindings = JSON.parse(
				readFileSync(join(homedir(), ".pi/agent/keybindings.json"), "utf8"),
			) as Record<string, string | string[]>;
		} catch {
			cachedBindings = null;
		}
	}
	const raw = cachedBindings?.[id];
	const key = Array.isArray(raw) ? raw[0] : raw;
	return typeof key === "string" && key.length > 0 ? key : undefined;
}

export default function (pi: ExtensionAPI) {
	pi.on("session_start", (_event, ctx) => {
		if (ctx.mode !== "tui") return;

		const project = () => basename(ctx.cwd) || ctx.cwd;

		ctx.ui.setTitle(`pi · ${project()}`);
		ctx.ui.setHiddenThinkingLabel("✦ reasoning");

		ctx.ui.setHeader((_tui, theme) => ({
			// render() reads the theme live rather than pre-baking colours, so
			// there is nothing cached to throw away on invalidate.
			invalidate() {},
			render(width: number): string[] {
				// Cap the panel: a border stretched across an ultrawide terminal
				// reads as a table, not a card.
				const w = Math.min(width - 2, 92);

				// Too narrow for a frame — degrade to one line rather than drawing
				// a broken box.
				if (w < 34) {
					return [
						"",
						truncateToWidth(
							`  ${theme.fg("accent", "✦ pi")} ${theme.fg("dim", "·")} ${theme.fg("text", project())}`,
							width,
						),
						"",
					];
				}

				const B = (s: string) => theme.fg("borderMuted", s);
				const inner = w - 2;

				/** Pad by VISIBLE width — ANSI escapes break String.length. */
				const row = (content: string): string => {
					const pad = Math.max(0, inner - visibleWidth(content));
					return ` ${B("│")}${content}${" ".repeat(pad)}${B("│")}`;
				};

				const title = ` ${theme.fg("accent", theme.bold("pi"))} ${theme.fg("dim", "·")} ${theme.fg("text", project())} `;
				const top = ` ${B("╭─")}${title}${B("─".repeat(Math.max(0, inner - visibleWidth(title) - 2)))}${B("╮")}`;
				const bottom = ` ${B(`╰${"─".repeat(inner)}╯`)}`;

				// ── Left column: what this session IS ──────────────────────────
				const left: string[] = [
					`${theme.fg("accent", "✦")}  ${theme.fg("text", ctx.model?.id ?? "no model")}`,
				];
				if (ctx.thinkingLevel) left.push(`   ${theme.fg("muted", ctx.thinkingLevel)}`);
				left.push(`   ${theme.fg("dim", ctx.cwd.replace(homedir(), "~"))}`);

				// ── Right column: how to drive it ──────────────────────────────
				const right: Array<[string, string]> = [];
				for (const [id, label] of SESSION_ACTIONS) {
					const key = boundKey(id);
					if (key) right.push([macKey(key), label]);
				}
				for (const [cmd, label] of COMMANDS) right.push([cmd, label]);

				const keyW = right.reduce((m, [k]) => Math.max(m, visibleWidth(k)), 0);
				const labelW = right.reduce((m, [, l]) => Math.max(m, l.length), 0);
				const leftW = left.reduce((m, l) => Math.max(m, visibleWidth(l)), 0);

				// Two columns only when both fit with a real gutter; otherwise the
				// hints stack under the identity block.
				const gutter = 4;
				const twoCol = leftW + gutter + keyW + 2 + labelW + 4 <= inner;

				const hint = ([k, label]: [string, string]) =>
					theme.fg("accent", k) +
					" ".repeat(Math.max(1, keyW - visibleWidth(k) + 2)) +
					theme.fg("dim", label);

				const lines: string[] = [row("")];

				if (twoCol) {
					const rows = Math.max(left.length, right.length + 1);
					for (let i = 0; i < rows; i++) {
						const l = left[i] ?? "";
						const lPad = " ".repeat(Math.max(0, leftW - visibleWidth(l)));
						const r =
							i === 0
								? theme.fg("muted", theme.bold("getting started"))
								: right[i - 1]
									? hint(right[i - 1])
									: "";
						lines.push(row(`  ${l}${lPad}${" ".repeat(gutter)}${r}`));
					}
				} else {
					for (const l of left) lines.push(row(`  ${l}`));
					lines.push(row(""));
					for (const r of right) lines.push(row(`  ${hint(r)}`));
				}

				lines.push(row(""));
				// truncateToWidth is the backstop: render() must never return a
				// line wider than `width`.
				return ["", top, ...lines, bottom, ""].map((l) => truncateToWidth(l, width));
			},
		}));
	});
}
