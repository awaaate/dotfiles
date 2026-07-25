import type { ExtensionAPI, ThemeColor } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { basename } from "node:path";

export default function (pi: ExtensionAPI) {
	pi.on("session_start", (_event, ctx) => {
		if (ctx.mode !== "tui") return;

		// The theme exposes a dedicated heat ramp for reasoning effort, one key
		// per level. The previous version painted the level with `warning`, which
		// said "something is wrong" about a setting that is simply a setting.
		//
		// The key union is derived from ctx.thinkingLevel rather than imported:
		// pi-coding-agent does not re-export ThinkingLevel (it only imports it
		// from pi-agent-core, which is a nested dependency an extension has no
		// business reaching into). Deriving it means this map cannot drift from
		// the real API — adding a level upstream becomes a compile error here.
		//
		// Values are ThemeColor, not string, so a mistyped key is caught at
		// compile time instead of silently falling back at runtime.
		type Level = NonNullable<typeof ctx.thinkingLevel>;
		const THINKING_COLOR: Record<Level, ThemeColor> = {
			off: "thinkingOff",
			minimal: "thinkingMinimal",
			low: "thinkingLow",
			medium: "thinkingMedium",
			high: "thinkingHigh",
			xhigh: "thinkingXhigh",
			max: "thinkingMax",
		};

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

		ctx.ui.setHeader((_tui, theme) => ({
			// render() reads the theme live rather than pre-baking colours, so
			// there is nothing cached to throw away on invalidate.
			invalidate() {},
			render(width: number): string[] {
				const title = `  ${theme.fg("accent", theme.bold("✦ pi"))} ${theme.fg("dim", "·")} ${theme.fg("text", theme.bold(project()))}`;

				const level = ctx.thinkingLevel;
				// Lowest priority last: on a narrow terminal these drop in reverse
				// order, so the model survives longer than the session name.
				// Hard-truncating instead would silently lose whichever segments
				// happened to sit on the right.
				const segments: string[] = [];
				if (ctx.model?.id) segments.push(theme.fg("muted", ctx.model.id));
				if (level) segments.push(theme.fg(THINKING_COLOR[level], level));
				const name = pi.getSessionName();
				if (name) segments.push(theme.fg("muted", name));

				const sep = theme.fg("dim", "  ·  ");
				let detail = "";
				for (let take = segments.length; take > 0; take--) {
					const candidate = `  ${segments.slice(0, take).join(sep)}`;
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
