import type { ExtensionAPI, ExtensionContext, ThemeColor } from "@earendil-works/pi-coding-agent";

/**
 * Iris Toys — a live context gauge, plus two commands that draw things.
 *
 * Everything renders through `setWidget`, which ADDS a component to the UI.
 * `setHeader`/`setFooter` replace pi's built-ins wholesale and clobber other
 * extensions, so they are avoided here entirely.
 */

/** Eighth-blocks give sub-character precision, so the bar moves smoothly. */
const EIGHTHS = ["", "▏", "▎", "▍", "▌", "▋", "▊", "▉"];

/**
 * Context pressure, coloured by how close compaction is. The thresholds are
 * the point of the widget: the footer already prints a percentage, and a
 * number does not make you *feel* that you are about to lose history.
 */
function pressure(pct: number): { colour: ThemeColor; note: string } {
	if (pct >= 90) return { colour: "error", note: "compacting soon" };
	if (pct >= 75) return { colour: "warning", note: "getting full" };
	if (pct >= 55) return { colour: "thinkingHigh", note: "" };
	return { colour: "success", note: "" };
}

function bar(fraction: number, cells: number): string {
	const total = Math.max(0, Math.min(1, fraction)) * cells;
	const full = Math.floor(total);
	const rest = EIGHTHS[Math.floor((total - full) * 8)] ?? "";
	return "█".repeat(full) + rest;
}

export default function (pi: ExtensionAPI) {
	pi.on("session_start", (_event, ctx) => {
		if (ctx.mode !== "tui") return;

		const theme = ctx.ui.theme;

		// ── Live context gauge ──────────────────────────────────────────────
		// Below the editor and deliberately quiet: this is ambient, and ambient
		// means you should be able to ignore it. It is a short fixed-width track
		// rather than a full-width bar, and it stays in neutral greys until the
		// number is actually worth reacting to.
		//
		// Reads usage inside render() rather than closing over a value, so the
		// same widget stays correct as the session grows.
		const drawGauge = () => {
			ctx.ui.setWidget(
				"iris.gauge",
				(_tui, t) => ({
					invalidate() {},
					render(width: number): string[] {
						const usage = ctx.getContextUsage();
						const pct = usage?.percent ?? null;
						const cells = Math.min(18, Math.max(6, width - 16));

						// Unknown is a real state, not zero: before the first response
						// and right after a compaction pi does not know the token count.
						// An empty bar would claim the context is empty, which is a
						// different statement.
						if (pct === null) {
							return ["  " + t.fg("borderMuted", "┈".repeat(cells) + "  —")];
						}

						const { colour, note } = pressure(pct);
						const filled = Math.round((pct / 100) * cells);

						// Grey until 75%. Colour is a signal, and a gauge that is
						// always coloured has spent it before there is anything to say.
						const fillColour: ThemeColor = pct >= 75 ? colour : "dim";
						const textColour: ThemeColor = pct >= 75 ? colour : "borderMuted";

						return [
							"  " +
								t.fg(fillColour, "━".repeat(filled)) +
								t.fg("borderMuted", "┈".repeat(Math.max(0, cells - filled))) +
								t.fg(textColour, `  ${pct.toFixed(0)}%`) +
								(note ? t.fg(colour, `  ${note}`) : ""),
						];
					},
				}),
				{ placement: "belowEditor" },
			);
		};

		// The widget re-renders on its own when pi redraws, but these force it
		// at the moments the number actually moves.
		pi.on("turn_start", drawGauge);
		pi.on("turn_end", drawGauge);
		pi.on("message_end", drawGauge);
		pi.on("session_compact", drawGauge);
		drawGauge();

		// ── /palette ────────────────────────────────────────────────────────
		// The whole repo is a design system; being able to see it from inside
		// the thing it themes is the point.
		pi.registerCommand("palette", {
			description: "Show the active theme's colours as swatches",
			async handler(_args: string, cmdCtx: ExtensionContext) {
				const groups: Array<[string, ThemeColor[]]> = [
					["accent", ["accent", "borderAccent", "border", "borderMuted"]],
					["state", ["success", "warning", "error", "muted", "dim"]],
					["syntax", [
						"syntaxKeyword", "syntaxFunction", "syntaxString",
						"syntaxNumber", "syntaxType", "syntaxComment",
					]],
					["thinking", [
						"thinkingOff", "thinkingMinimal", "thinkingLow", "thinkingMedium",
						"thinkingHigh", "thinkingXhigh", "thinkingMax",
					]],
				];

				const lines: string[] = ["", `  ${theme.fg("accent", theme.bold("✦ palette"))}`];
				for (const [name, keys] of groups) {
					const swatches = keys.map((k) => theme.fg(k, "███")).join(" ");
					lines.push(`  ${theme.fg("dim", name.padEnd(9))} ${swatches}`);
					lines.push(`  ${" ".repeat(9)} ${keys.map((k) => theme.fg("dim", k.slice(0, 3).padEnd(3))).join(" ")}`);
				}
				lines.push("");

				cmdCtx.ui.setWidget("iris.palette", lines, { placement: "aboveEditor" });
				// Transient by design: it is a look, not a permanent fixture.
				setTimeout(() => cmdCtx.ui.setWidget("iris.palette", undefined), 12_000);
			},
		});

		// ── /gauge ──────────────────────────────────────────────────────────
		// The always-on widget shows a bar and a percentage; this shows the raw
		// numbers behind it, which is what you want when deciding whether to
		// compact by hand.
		pi.registerCommand("gauge", {
			description: "Show exact context token counts, not just the bar",
			async handler(_args: string, cmdCtx: ExtensionContext) {
				const usage = cmdCtx.getContextUsage();
				if (!usage || usage.percent === null) {
					// Genuinely unknown right after a compaction, so say that rather
					// than drawing a zero and implying an empty context.
					cmdCtx.ui.notify("Context size is unknown until the next response", "info");
					return;
				}
				const { colour, note } = pressure(usage.percent);
				const line =
					`  ${theme.fg(colour, bar(usage.percent / 100, 40))}` +
					`${theme.fg("borderMuted", "░".repeat(Math.max(0, 40 - Math.ceil((usage.percent / 100) * 40))))}` +
					`  ${theme.fg(colour, `${usage.percent.toFixed(1)}%`)}` +
					`  ${theme.fg("dim", `${usage.tokens ?? "?"} / ${usage.contextWindow}`)}` +
					(note ? `  ${theme.fg(colour, note)}` : "");
				cmdCtx.ui.setWidget("iris.palette", ["", line, ""], { placement: "aboveEditor" });
				setTimeout(() => cmdCtx.ui.setWidget("iris.palette", undefined), 10_000);
			},
		});

		pi.on("session_shutdown", () => {
			ctx.ui.setWidget("iris.gauge", undefined);
			ctx.ui.setWidget("iris.palette", undefined);
		});
	});
}
