import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { truncateToWidth } from "@earendil-works/pi-tui";
import { basename } from "node:path";

const formatTokens = (value: number | null): string => {
	if (value === null) return "?";
	if (value < 1_000) return String(value);
	return `${(value / 1_000).toFixed(value < 10_000 ? 1 : 0)}k`;
};

export default function (pi: ExtensionAPI) {
	pi.on("session_start", (_event, ctx) => {
		if (ctx.mode !== "tui") return;

		ctx.ui.setTitle(`pi · ${basename(ctx.cwd) || ctx.cwd}`);
		ctx.ui.setHiddenThinkingLabel("✦ reasoning");
		ctx.ui.setWorkingIndicator({
			frames: [
				ctx.ui.theme.fg("dim", "·"),
				ctx.ui.theme.fg("muted", "•"),
				ctx.ui.theme.fg("accent", "✦"),
				ctx.ui.theme.fg("warning", "◆"),
				ctx.ui.theme.fg("accent", "✦"),
				ctx.ui.theme.fg("muted", "•"),
			],
			intervalMs: 110,
		});

		ctx.ui.setHeader((_tui, theme) => ({
			invalidate() {},
			render(width: number): string[] {
				const project = basename(ctx.cwd) || ctx.cwd;
				const name = pi.getSessionName();
				const title = `  ${theme.fg("accent", theme.bold("✦ pi"))} ${theme.fg("dim", "·")} ${theme.fg("text", theme.bold(project))}`;
				const details = [ctx.model?.id, ctx.thinkingLevel, name].filter(Boolean).join("  ·  ");
				return ["", truncateToWidth(title, width), truncateToWidth(`  ${theme.fg("muted", details)}`, width), ""];
			},
		}));

		ctx.ui.setFooter((tui, theme, footerData) => {
			const unsubscribe = footerData.onBranchChange(() => tui.requestRender());
			return {
				dispose: unsubscribe,
				invalidate() {},
				render(width: number): string[] {
					const usage = ctx.getContextUsage();
					const branch = footerData.getGitBranch();
					const statuses = [...footerData.getExtensionStatuses().values()];
					const model = ctx.model?.id ?? "no model";
					const context = usage
						? `${formatTokens(usage.tokens)}/${formatTokens(usage.contextWindow)}`
						: "? tokens";

					const parts = [
						theme.fg("accent", theme.bold(` ✦ ${model}`)),
						theme.fg("warning", ctx.thinkingLevel ?? "off"),
						theme.fg("muted", context),
						branch ? theme.fg("success", `⑂ ${branch}`) : undefined,
						...statuses.map((status) => theme.fg("accent", status)),
					].filter((part): part is string => Boolean(part));

					return [truncateToWidth(parts.join(theme.fg("dim", "  │  ")), width)];
				},
			};
		});
	});
}
