import type { ExtensionAPI, ThemeColor } from "@earendil-works/pi-coding-agent";

/**
 * Iris FX — the bits of a session that are nicer when they move.
 *
 * Everything here goes through `setStatus` and `setWorkingIndicator`, which ADD
 * to the UI. Nothing uses `setHeader`/`setFooter`, which replace pi's built-in
 * components wholesale and silently clobber other extensions.
 */

/** A braille spinner: 8 dots, so rotation reads as motion rather than flicker. */
const SPIN = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧"];

/**
 * The spinner also breathes through the accent ramp, so a long turn looks
 * alive instead of looping every 8 frames. Frame count is the lowest common
 * multiple of the two cycles, which keeps the loop seamless.
 */
const BREATH: ThemeColor[] = [
	"thinkingLow",
	"thinkingMedium",
	"accent",
	"borderAccent",
	"accent",
	"thinkingMedium",
];

const FRAME_MS = 90;

/** 0.4s · 12.3s · 4m 05s — never more precision than the number deserves. */
function elapsed(ms: number): string {
	if (ms < 1000) return `${ms}ms`;
	const s = ms / 1000;
	if (s < 60) return `${s.toFixed(1)}s`;
	const m = Math.floor(s / 60);
	return `${m}m ${String(Math.floor(s % 60)).padStart(2, "0")}s`;
}

export default function (pi: ExtensionAPI) {
	pi.on("session_start", (_event, ctx) => {
		// ctx.ui.* is a silent no-op outside the TUI, so skip the timers too
		// rather than burning intervals in print/json/rpc mode.
		if (ctx.mode !== "tui") return;

		const theme = ctx.ui.theme;

		// Bake glyph and colour into each frame: pi renders frames verbatim, so
		// the animation has to be pre-composed.
		const frames: string[] = [];
		for (let i = 0; i < SPIN.length * BREATH.length; i++) {
			frames.push(theme.fg(BREATH[i % BREATH.length], SPIN[i % SPIN.length]));
		}
		ctx.ui.setWorkingIndicator({ frames, intervalMs: FRAME_MS });

		let startedAt = 0;
		let ticker: ReturnType<typeof setInterval> | undefined;
		let settle: ReturnType<typeof setTimeout> | undefined;
		let tools = 0;

		const stopTicker = () => {
			if (ticker) clearInterval(ticker);
			ticker = undefined;
		};

		pi.on("turn_start", () => {
			startedAt = Date.now();
			tools = 0;
			stopTicker();
			if (settle) clearTimeout(settle);

			// 250ms: fast enough that the number feels live, slow enough that it
			// is not redrawing the footer four times a second for no reason.
			ticker = setInterval(() => {
				ctx.ui.setStatus("iris.timer", theme.fg("dim", `⏱ ${elapsed(Date.now() - startedAt)}`));
			}, 250);
		});

		pi.on("tool_execution_start", (e) => {
			tools++;
			// The working message sits next to the spinner, so it can say what is
			// actually happening instead of just that something is.
			ctx.ui.setWorkingMessage(e.toolName);
		});

		pi.on("tool_execution_end", () => {
			ctx.ui.setWorkingMessage(undefined);
		});

		pi.on("turn_end", () => {
			stopTicker();
			const took = Date.now() - startedAt;

			// Only a turn long enough to have been *waited on* is worth reporting.
			// Flashing "0.3s ✓" after every trivial exchange is noise.
			if (took < 2000) {
				ctx.ui.setStatus("iris.timer", undefined);
				return;
			}

			const parts = [theme.fg("success", "✓"), theme.fg("muted", elapsed(took))];
			if (tools > 0) {
				parts.push(theme.fg("dim", `${tools} ${tools === 1 ? "tool" : "tools"}`));
			}
			ctx.ui.setStatus("iris.timer", parts.join(theme.fg("dim", " · ")));

			// Clear it rather than leaving a stale time sitting in the footer for
			// the rest of the session.
			settle = setTimeout(() => ctx.ui.setStatus("iris.timer", undefined), 6000);
		});

		// Timers outlive the session unless they are torn down here — an interval
		// still calling setStatus on a replaced session is the classic leak.
		pi.on("session_shutdown", () => {
			stopTicker();
			if (settle) clearTimeout(settle);
			ctx.ui.setStatus("iris.timer", undefined);
			ctx.ui.setWorkingMessage(undefined);
		});
	});
}
