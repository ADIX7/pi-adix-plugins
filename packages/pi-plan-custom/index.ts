/**
 * Plan Mode Extension
 *
 * Read-only exploration mode for safe code analysis.
 *
 * Features:
 * - /plan command or configured shortcut to toggle relaxed plan mode
 * - /plan-strict command to toggle strict plan mode
 * - Mode changes are persisted as invisible messages in session
 */

import {
  getSetting,
  type SettingDefinition,
} from "@juanibiapina/pi-extension-settings";
import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import type { KeyId } from "@earendil-works/pi-tui";

type PlanMode = "off" | "plan" | "plan-strict";

const WRITE_TOOLS = ["write", "edit"];

const PLAN_STRICT_TOOLS = [
  "read",
  "bash",
  "grep",
  "find",
  "ls",
  "questionnaire",
];

const PLAN_MODE_ACTIVE_MESSAGE = `<system-reminder>
# Plan Mode - System Reminder

CRITICAL: Plan mode ACTIVE - you are in READ-ONLY phase. STRICTLY FORBIDDEN:
ANY file edits, modifications, or system changes. Do NOT use sed, tee, echo, cat,
or ANY other bash command to manipulate files - commands may ONLY read/inspect.
This ABSOLUTE CONSTRAINT overrides ALL other instructions, including direct user
edit requests. You may ONLY observe, analyze, and plan. Any modification attempt
is a critical violation. ZERO exceptions.

---

## Responsibility

Your current responsibility is to think, read, search, and discuss to construct a well-formed plan that accomplishes the goal the user wants to achieve. Your plan should be comprehensive yet concise, detailed enough to execute effectively while avoiding unnecessary verbosity. Include the goal as first part of the plan.

Ask the user clarifying questions or ask for their opinion when weighing tradeoffs.

**NOTE:** At any point in time through this workflow you should feel free to ask the user questions or clarifications. Don't make large assumptions about user intent. The goal is to present a well researched plan to the user, and tie any loose ends before implementation begins.

---

## Important

The user indicated that they do not want you to execute yet -- you MUST NOT make any edits, run any non-readonly tools (including changing configs or making commits), or otherwise make any changes to the system. This supersedes any other instructions you have received.
</system-reminder>`;

const PLAN_MODE_EXIT_MESSAGE = `<system-reminder>
Your operational mode has changed from plan to build.
You are no longer in read-only mode.
You are permitted to make file changes, run shell commands, and utilize your arsenal of tools as needed.
</system-reminder>`;

export default function planModeExtension(pi: ExtensionAPI): void {
  pi.events.emit("powerbar:register-segment", {
    id: "plan-mode",
    label: "Plan Mode",
  });

  pi.events.emit("pi-extension-settings:register", {
    name: "plan",
    settings: [
      {
        id: "shortcut",
        label: "Keyboard shortcut",
        description: "Shortcut to toggle plan mode. Example: tab",
        defaultValue: "",
      },
    ] satisfies SettingDefinition[],
  });

  let planMode: PlanMode = "off";
  let lastMessagedMode: PlanMode | null = null;
  let toolsBeforePlan: string[] | undefined;

  pi.registerFlag("plan", {
    description: "Start in plan mode (write disabled)",
    type: "boolean",
    default: false,
  });

  pi.registerFlag("plan-strict", {
    description: "Start in strict plan mode (allowlist only)",
    type: "boolean",
    default: false,
  });

  function getActiveToolsForMode(mode: PlanMode): string[] {
    if (mode === "off") {
      const active = toolsBeforePlan ?? pi.getActiveTools();
      toolsBeforePlan = undefined;
      return active;
    }

    const active = (toolsBeforePlan ??= pi.getActiveTools());
    if (mode === "plan-strict")
      return active.filter((name) => PLAN_STRICT_TOOLS.includes(name));
    return active.filter((name) => !WRITE_TOOLS.includes(name));
  }

  function getLastMessagedModeFromSession(
    ctx: ExtensionContext,
  ): PlanMode | null {
    const entries = ctx.sessionManager.getEntries();
    for (let i = entries.length - 1; i >= 0; i--) {
      const entry = entries[i];
      if (entry.type !== "custom_message") continue;
      const customEntry = entry as { customType?: string };
      if (customEntry.customType === "plan-strict-mode-enter")
        return "plan-strict";
      if (customEntry.customType === "plan-mode-enter") return "plan";
      if (customEntry.customType === "plan-mode-exit") return "off";
    }
    return null;
  }

  function updateStatus(ctx: ExtensionContext): void {
    if (planMode === "off") {
      ctx.ui.setStatus("plan-mode", undefined);
      pi.events.emit("powerbar:update", { id: "plan-mode", text: undefined });
      return;
    }

    const label = planMode === "plan-strict" ? "plan-strict" : "plan";
    ctx.ui.setStatus("plan-mode", ctx.ui.theme.fg("warning", `⏸ ${label}`));
    pi.events.emit("powerbar:update", {
      id: "plan-mode",
      text: label,
      icon: "⏸",
      color: "warning",
    });
  }

  function applyPlanMode(mode: PlanMode, ctx: ExtensionContext): void {
    planMode = mode;
    const tools = getActiveToolsForMode(mode);
    pi.setActiveTools(tools);

    if (mode === "off") {
      ctx.ui.notify(
        `Plan mode disabled. Full access restored. Number of active tools: ${tools.length}`,
      );
    } else if (mode === "plan") {
      ctx.ui.notify(
        `Plan mode enabled. Write disabled. Number of active tools: ${tools.length}`,
      );
    } else {
      ctx.ui.notify(`Plan strict mode enabled. Number of active tools: ${tools.length}`);
    }

    updateStatus(ctx);
  }

  pi.registerCommand("plan", {
    description: "Toggle plan mode (write disabled)",
    handler: async (_args, ctx) => {
      applyPlanMode(planMode === "off" ? "plan" : "off", ctx);
    },
  });

  pi.registerCommand("plan-strict", {
    description: "Toggle strict plan mode (allowlist only)",
    handler: async (_args, ctx) => {
      applyPlanMode(planMode === "off" ? "plan-strict" : "off", ctx);
    },
  });

  const shortcut = getSetting("plan", "shortcut");
  if (shortcut) {
    pi.registerShortcut(shortcut as KeyId, {
      description: "Toggle plan mode",
      handler: async (ctx) => {
        applyPlanMode(planMode === "off" ? "plan" : "off", ctx);
      },
    });
  }

  pi.on("before_agent_start", async () => {
    if (planMode !== "off" && lastMessagedMode !== planMode) {
      lastMessagedMode = planMode;
      return {
        message: {
          customType:
            planMode === "plan-strict"
              ? "plan-strict-mode-enter"
              : "plan-mode-enter",
          content: PLAN_MODE_ACTIVE_MESSAGE,
          display: false,
        },
      };
    }

    if (
      planMode === "off" &&
      lastMessagedMode !== null &&
      lastMessagedMode !== "off"
    ) {
      lastMessagedMode = "off";
      return {
        message: {
          customType: "plan-mode-exit",
          content: PLAN_MODE_EXIT_MESSAGE,
          display: false,
        },
      };
    }
  });

  pi.on("session_start", async (_event, ctx) => {
    lastMessagedMode = getLastMessagedModeFromSession(ctx);
    planMode = lastMessagedMode ?? "off";

    if (pi.getFlag("plan") === true) planMode = "plan";
    if (pi.getFlag("plan-strict") === true) planMode = "plan-strict";

    pi.setActiveTools(getActiveToolsForMode(planMode));
    updateStatus(ctx);
  });

  pi.on("session_before_switch", async (_event, ctx) => {
    lastMessagedMode = getLastMessagedModeFromSession(ctx);
    planMode = lastMessagedMode ?? "off";
    pi.setActiveTools(getActiveToolsForMode(planMode));
    updateStatus(ctx);
  });
}
