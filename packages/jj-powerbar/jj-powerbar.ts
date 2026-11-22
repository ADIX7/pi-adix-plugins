import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";

// Shows jj change-id short + closest bookmark via jj revset alias.
// Powerbar integration: render extension status key "jj".

export default function (pi: ExtensionAPI) {
  let last = "";
  let running: Promise<void> | null = null;

  pi.events.emit("powerbar:register-segment", {
    id: "jj-powerbar",
    label: "JJ",
  });

  const runJj = (cmd: string[], signal?: AbortSignal) =>
    pi.exec("jj", cmd, { timeout: 2000, signal });

  const runGit = (cmd: string[], signal?: AbortSignal) =>
    pi.exec("git", cmd, { timeout: 2000, signal });

  const firstNonEmptyLine = (s: string) => {
    for (const line of s.split(/\r?\n/)) {
      const t = line.trim();
      if (t) return t;
    }
    return "";
  };

  const refresh = async (ctx: ExtensionContext, signal?: AbortSignal) => {
    if (!ctx?.hasUI) return;
    if (running) return running;

    running = (async () => {
      try {
        // 1) Try jj first
        const [jjRevRes, jjBmRes] = await Promise.all([
          runJj(["log", "-r", "@", "--no-graph", "-T", "change_id.short()"], signal),
          runJj(
            [
              "log",
              "-r",
              "closest_bookmark(@)",
              "--no-graph",
              "-T",
              "bookmarks.join(\" \")",
            ],
            signal,
          ),
        ]);

        const jjRevFull =
          jjRevRes.code === 0
            ? firstNonEmptyLine(jjRevRes.stdout).split(/\s+/)[0] ?? ""
            : "";

        if (jjRevFull) {
          const jjRev = jjRevFull.slice(0, 2);
          const jjBm = firstNonEmptyLine(jjBmRes.stdout);
          const jjStatus = jjBm ? `${jjRev} • ${jjBm}` : jjRev;

          if (jjStatus !== last) {
            ctx.ui.setStatus("jj", jjStatus);
            pi.events.emit("powerbar:update", { id: "jj-powerbar", text: jjStatus });
            last = jjStatus;
          }
          return;
        }

        // 2) Fallback to git
        const inGit = await runGit(["rev-parse", "--is-inside-work-tree"], signal);
        let status = "no VCS";

        if (inGit.code === 0) {
          const branchRes = await runGit(
            ["symbolic-ref", "--quiet", "--short", "HEAD"],
            signal,
          );
          const branch = firstNonEmptyLine(branchRes.stdout);

          if (branchRes.code === 0 && branch) {
            status = ` ${branch}`;
          } else {
            const shaRes = await runGit(["rev-parse", "--short", "HEAD"], signal);
            const sha = firstNonEmptyLine(shaRes.stdout);
            status = shaRes.code === 0 && sha ? ` ${sha}` : "no VCS";
          }
        }

        if (status !== last) {
          ctx.ui.setStatus("jj", status);
          pi.events.emit("powerbar:update", { id: "jj-powerbar", text: status });
          last = status;
        }
      } catch {
        const status = " VCS";
        if (status !== last) {
          ctx.ui.setStatus("jj", status);
          pi.events.emit("powerbar:update", { id: "jj-powerbar", text: status });
          last = status;
        }
      } finally {
        running = null;
      }
    })();

    return running;
  };

  pi.on("session_start", async (_e, ctx) => {
    await refresh(ctx);
  });

  pi.on("turn_end", async (_e, ctx) => {
    await refresh(ctx);
  });

  pi.on("user_bash", async (e, ctx) => {
    if (!e.command.includes("jj") && !e.command.includes("git")) return;
    await refresh(ctx);
  });
}
