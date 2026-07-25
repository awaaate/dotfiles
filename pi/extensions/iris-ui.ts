import type { ExtensionAPI, ThemeColor } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";

/// Actions pi ships with NO default binding. They are the whole reason the
/// header exists, so they are listed in the order they are most used.
const SESSION_ACTIONS: ReadonlyArray<readonly [string, string]> = [
	["app.session.new", "new"],
	["app.session.tree", "tree"],
	["app.session.fork", "fork"],
	["app.session.resume", "resume"],
];

/// Resolve a binding by reading pi's own keybindings.json.
///
/// Deliberately tolerant: pi itself parses this file with a bare JSON.parse
/// inside `catch { return undefined }`, so a malformed file means pi is ALSO
/// running without these bindings — in which case advertising them would be a
/// lie, and showing nothing is correct.
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

		// An ember warming and cooling — the accent is identity, so the pulse
		// stays in the accent family rather than cycling through status hues.
		ctx.ui.setWorkingIndicator({
			frames: [
				ctx.ui.theme.fg("dim", "·"),
				ctx.ui.theme.fg("muted", "•"),
				ctx.ui.theme.fg("accent", "✦"),
				ctx.ui.theme.fg("borderAccent", "◆"),
				ctx.ui.theme.fg("accent", "✦"),
				ctx.ui.theme.fg("muted", "•"),
			],
			intervalMs: 110,
		});

		// NOTE: there is deliberately no setFooter here.
		//
		// The previous extension replaced pi's built-in footer wholesale, and the
		// built-in one shows strictly more: cwd, git branch, session name, a token
		// breakdown (input/output/cache read/cache write), cache hit rate, context
		// window percentage, COST, the model with its (auto)/(sub) markers, and
		// compaction state. The replacement showed a subset and silently dropped
		// the cost readout. Since the theme now colours the built-in footer
		// correctly, a custom one would only take information away.

		// The header shows what the FOOTER DOES NOT.
		//
		// With quietStartup the built-in header renders an empty Text, so
		// replacing it costs nothing — but it also means the startup keybinding
		// hints are gone, and this config adds four bindings pi ships unbound
		// (alt+n/t/k/r for new/tree/fork/resume). Undiscoverable shortcuts are
		// no better than no shortcuts, so the header advertises them.
		//
		// Model, thinking level, session name, cwd, branch, tokens and cost all
		// live in the built-in footer already. Repeating them here would just
		// spend two rows saying the same thing twice.
		ctx.ui.setHeader((_tui, theme) => ({
			// render() reads the theme live rather than pre-baking colours, so
			// there is nothing cached to throw away on invalidate.
			invalidate() {},
			render(width: number): string[] {
				const title = `  ${theme.fg("accent", theme.bold("✦ pi"))} ${theme.fg("dim", "·")} ${theme.fg("text", theme.bold(project()))}`;

				// Read the SAME file pi reads, so the hint cannot drift from the
				// actual binding. The header factory only receives (tui, theme) —
				// the KeybindingsManager is passed to custom() and the editor
				// factory, but not here.
				const hints: string[] = [];
				for (const [id, label] of SESSION_ACTIONS) {
					const key = boundKey(id);
					if (key) {
						hints.push(`${theme.fg("accent", key)} ${theme.fg("dim", label)}`);
					}
				}

				const sep = theme.fg("dim", "  ·  ");
				let detail = "";
				for (let take = hints.length; take > 0; take--) {
					const candidate = `  ${hints.slice(0, take).join(sep)}`;
					if (visibleWidth(candidate) <= width) {
						detail = candidate;
						break;
					}
				}

				// truncateToWidth is the backstop: render() must never return a
				// line wider than `width`, and the title itself can exceed it on a
				// very narrow terminal or a long project name.
				const lines = ["", truncateToWidth(title, width)];
				if (detail) lines.push(truncateToWidth(detail, width));
				lines.push("");
				return lines;
			},
		}));
	});
}
