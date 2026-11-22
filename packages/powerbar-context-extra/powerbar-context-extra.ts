/**
 * Powerbar Context Producer
 *
 * Shows context window usage as a progress bar with percentage.
 * Color changes based on usage level: accent → warning → error.
 * Segment ID: "context-usage-extra"
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

function formatTokens(count: number): string {
	// Force consistent 3-digit grouping (no k/M), independent of host locale.
	return new Intl.NumberFormat("en-US", {
		useGrouping: true,
		maximumFractionDigits: 0,
	}).format(count);
}

function formatContextWindow(count: number): string {
	return count >= 1_000 ? `${Math.round(count / 1_000)}k` : formatTokens(count);
}

function getColor(pct: number): string {
	if (pct > 80) return "error";
	if (pct > 60) return "warning";
	return "muted";
}

function emitContextUsage(pi: ExtensionAPI, ctx: ExtensionContext): void {
	const usage = ctx.getContextUsage();
	if (usage && usage.tokens != null && usage.contextWindow > 0) {
		const pct = Math.round((usage.tokens / usage.contextWindow) * 100);
		pi.events.emit("powerbar:update", {
			id: "context-usage-extra",
			text: "",
			suffix: `${pct}% 󰛡 ${formatTokens(usage.tokens)} / ${formatContextWindow(usage.contextWindow)}`,
			bar: pct,
			color: getColor(pct),
		});
	}
}

function resetContextUsage(pi: ExtensionAPI): void {
	pi.events.emit("powerbar:update", {
		id: "context-usage-extra",
		text: undefined,
	});
}

export default function createExtension(pi: ExtensionAPI): void {
	pi.events.emit("powerbar:register-segment", { id: "context-usage-extra", label: "Context Usage+" });

	// Reset on new/switched session
	pi.on("session_start", async () => resetContextUsage(pi));
	pi.on("session_switch", async () => resetContextUsage(pi));
	pi.on("session_tree", async () => resetContextUsage(pi));

	// Update frequently during agent work
	pi.on("turn_start", async (_event, ctx) => emitContextUsage(pi, ctx));
	pi.on("tool_result", async (_event, ctx) => emitContextUsage(pi, ctx));
	pi.on("turn_end", async (_event, ctx) => emitContextUsage(pi, ctx));
}
