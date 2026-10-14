// covers: function:applyCloudAnswer, function:projectCloud, function:cloudChoices, function:selectedCloud
//
// `aidlc config project --cloud` in a project installed by `aidlc config`, with
// the azure and gcp plugins composed by their own hooks. The cloud is a plugin
// choice: the named cloud plugin on and the others off, or all of them off for
// the core AWS agent. Each change also rewrites the generated tables beside the
// orchestrator skill, which must not count as a local edit of that file.

import {
  NATIVE_FIXTURE_SETUP_TIMEOUT_MS,
  NATIVE_RUNTIME_CASE_TIMEOUT_MS,
  remainingOperationTimeoutMs,
} from "../harness/test-budget.ts";
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { REPO_ROOT, runOrchestrateNext } from "../harness/fixtures.ts";
import { expectedStages, sourceStages } from "../harness/scope-run.ts";

setDefaultTimeout(NATIVE_FIXTURE_SETUP_TIMEOUT_MS);
const BUN = process.execPath;
const DIST = join(REPO_ROOT, "dist");
const PLATFORM_STAGES = [
  "contract-design",
  "domain-design",
  "environment-provisioning",
  "feasibility",
  "feedback-optimization",
  "infrastructure-design",
  "nfr-design",
];

let scratch = "";
let project = "";

function env(extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    ...process.env,
    // Keep the host's own install out of the fixture.
    AIDLC_INSTALL_ROOT: join(scratch, "machine", "share", "aidlc"),
    AIDLC_BIN_DIR: join(scratch, "machine", "bin"),
    CLAUDE_PROJECT_DIR: project,
    AIDLC_HARNESS_DIR: ".claude",
    NO_COLOR: "1",
    ...extra,
  };
}

function run(command: string[], extra: NodeJS.ProcessEnv = {}, input?: string) {
  const result = spawnSync(BUN, command, {
    cwd: project,
    encoding: "utf-8",
    env: env(extra),
    input,
    timeout: remainingOperationTimeoutMs(NATIVE_RUNTIME_CASE_TIMEOUT_MS),
  });
  return { status: result.status, out: `${result.stdout ?? ""}${result.stderr ?? ""}` };
}

const config = (...args: string[]) => run([join(project, ".claude", "tools", "aidlc.ts"), "config", ...args]);

function composePlugin(plugin: string): void {
  const root = join(DIST, "plugins", plugin, "claude");
  const composed = run([join(root, "hooks", "compose.ts")], { CLAUDE_PLUGIN_ROOT: root });
  if (composed.status !== 0) throw new Error(`${plugin} compose failed: ${composed.out}`);
}

const graph = (): Array<{ slug: string; lead_agent: string; support_agents: string[] }> =>
  JSON.parse(readFileSync(join(project, ".claude", "tools", "data", "stage-graph.json"), "utf-8"));

const naming = (agent: string) =>
  graph()
    .filter((s) => s.lead_agent === agent || s.support_agents.includes(agent))
    .map((s) => s.slug)
    .sort();

const selection = () =>
  (JSON.parse(readFileSync(join(project, ".claude", "tools", "data", "harness.json"), "utf-8")) as {
    plugins?: string[];
  }).plugins ?? null;

const tables = () => readFileSync(join(project, ".claude", "skills", "aidlc", "tables.md"), "utf-8");

// The files a cloud plugin's notes go into, and whether one of them carries
// the plugin's note.
const NOTED = [
  [".claude", "aidlc-common", "stages", "ideation", "feasibility.md"],
  [".claude", "aidlc-common", "stages", "operation", "environment-provisioning.md"],
  [".claude", "agents", "aidlc-operations-agent.md"],
];
const notes = (plugin: string) =>
  NOTED.filter((rel) => readFileSync(join(project, ...rel), "utf-8").includes(`(${plugin} plugin)`)).length;
const record = (plugin: string) =>
  existsSync(join(project, ".claude", "tools", "data", `plugin-contrib-${plugin}.json`));

function shown(): { cloud: string | null; cloudChoices: string[] } {
  const result = config("project", "--show", "--json");
  expect(result.status, result.out).toBe(0);
  const { cloud, cloudChoices } = (JSON.parse(result.out) as {
    data: { cloud: string | null; cloudChoices: string[] };
  }).data;
  return { cloud, cloudChoices };
}

beforeAll(() => {
  scratch = mkdtempSync(join(tmpdir(), "aidlc-t354-"));
  project = join(scratch, "project");
  mkdirSync(join(project, ".git"), { recursive: true });
  const installed = run([
    join(DIST, "claude", ".claude", "tools", "aidlc.ts"),
    "config",
    "--harness",
    "claude",
    "--from",
    join(DIST, "claude"),
    "--mcp",
    "none",
    "--yes",
  ]);
  if (installed.status !== 0) throw new Error(`install failed: ${installed.out}`);
  composePlugin("azure");
});

afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true });
});

describe("t354 config project --cloud", () => {
  test("show reports the composed cloud and the choices", () => {
    expect(shown()).toEqual({ cloud: "azure", cloudChoices: ["aws", "azure"] });
    expect(config("project", "--show").out).toContain("Cloud: azure (choices: aws, azure)");
  });

  test("choosing the only installed cloud makes the selection explicit", () => {
    expect(selection()).toBeNull();
    const result = config("project", "--cloud", "azure", "--yes");
    expect(result.status, result.out).toBe(0);
    // A cloud plugin installed later then composes turned off.
    expect(selection()).toEqual(["aidlc", "azure"]);
    expect(result.out).toContain("Plugins are now chosen by name, so a plugin installed later is added turned off");
    expect(naming("azure-platform-agent")).toEqual(PLATFORM_STAGES);
  });

  test("--cloud aws gives the platform stages back to the AWS agent", () => {
    const result = config("project", "--cloud", "aws", "--yes");
    expect(result.status, result.out).toBe(0);
    expect(selection()).toEqual(["aidlc"]);
    expect(naming("aidlc-aws-platform-agent")).toEqual(PLATFORM_STAGES);
    expect(naming("azure-platform-agent")).toEqual([]);
    expect(tables()).not.toContain("azure-platform-agent");
    expect(shown().cloud).toBe("aws");
    // The AWS agent does not run stages that still say the project is on Azure.
    expect(notes("azure")).toBe(0);
    expect(record("azure")).toBe(false);
  });

  test("--cloud azure turns the Azure plugin back on", () => {
    const result = config("project", "--cloud", "azure", "--yes");
    expect(result.status, result.out).toBe(0);
    expect(selection()).toEqual(["aidlc", "azure"]);
    expect(naming("azure-platform-agent")).toEqual(PLATFORM_STAGES);
    expect(tables()).toContain("azure-platform-agent");
    // Its notes come back when the plugin composes again, at the next session start.
    expect(notes("azure")).toBe(0);
    composePlugin("azure");
    expect(notes("azure")).toBe(NOTED.length);
  });

  test("a second cloud plugin composes turned off, and --cloud switches to it", () => {
    composePlugin("gcp");
    expect(naming("azure-platform-agent")).toEqual(PLATFORM_STAGES);
    expect(shown()).toEqual({ cloud: "azure", cloudChoices: ["aws", "azure", "gcp"] });
    const result = config("project", "--cloud", "gcp", "--yes");
    expect(result.status, result.out).toBe(0);
    expect(selection()).toEqual(["aidlc", "gcp"]);
    expect(naming("gcp-platform-agent")).toEqual(PLATFORM_STAGES);
    expect(naming("azure-platform-agent")).toEqual([]);
    expect(notes("azure")).toBe(0);
    composePlugin("gcp");
    expect(notes("gcp")).toBe(NOTED.length);
    expect(notes("azure")).toBe(0);
  });

  test("--cloud refuses a cloud that is not installed", () => {
    const result = config("project", "--cloud", "oracle", "--yes");
    expect(result.status).toBe(2);
    expect(result.out).toContain("--cloud oracle: this project offers aws, azure, gcp.");
    expect(result.out).toContain("choose one of these first, and it joins turned off");
    expect(selection()).toEqual(["aidlc", "gcp"]);
  });

  test("the setup prompt asks for the cloud when a cloud plugin is installed", () => {
    // Answers on stdin: Enter keeps the plugins, the cloud, Enter keeps MCP
    // and completions, then yes to apply.
    const result = run(
      [join(project, ".claude", "tools", "aidlc.ts"), "config", "project"],
      { AIDLC_TEST_CONFIG_TTY: "1" },
      "\nazure\n\n\ny\n",
    );
    expect(result.status, result.out).toBe(0);
    expect(result.out).toContain("Cloud platform [aws/azure/gcp, Enter keep]:");
    expect(selection()).toEqual(["aidlc", "azure"]);
  });

  test("text added outside the tables survives a cloud change", () => {
    appendFileSync(join(project, ".claude", "skills", "aidlc", "tables.md"), "\nOur own note.\n");
    const result = config("project", "--cloud", "aws", "--yes");
    expect(result.status, result.out).toBe(0);
    expect(tables()).toContain("Our own note.");
    expect(tables()).not.toContain("azure-platform-agent");
    expect(naming("aidlc-aws-platform-agent")).toEqual(PLATFORM_STAGES);
  });

  test("show names an agent file it cannot read instead of failing", () => {
    const broken = join(project, ".claude", "agents", "broken-agent.md");
    writeFileSync(broken, "---\ndisplay_name: Broken\n---\n\n# Broken\n");
    try {
      const result = config("project", "--show");
      expect(result.status, result.out).toBe(0);
      expect(result.out).toContain("Cloud: Agent file");
      expect(result.out).toContain("broken-agent.md missing required frontmatter: name");
    } finally {
      rmSync(broken);
    }
  });

  test("a cloud switch with open work says so, and its platform stages run with the new cloud's agent", () => {
    // Direct state moves stand in for the stages before Feasibility, with no
    // chat named, as the stage-start narration tests do.
    const stateEnv = env({ AIDLC_ALLOW_DIRECT_STATE_TRANSITIONS: "1", AIDLC_SKIP_HUMAN_PRESENCE_GUARD: "1" });
    for (const key of ["AIDLC_SESSION_OVERRIDE", "CLAUDE_CODE_SESSION_ID", "CLAUDE_PID", "CODEX_THREAD_ID", "KIRO_SESSION_ID"]) {
      delete stateEnv[key];
    }
    const tool = (name: string, ...args: string[]) =>
      spawnSync(BUN, [join(project, ".claude", "tools", name), ...args, "--project-dir", project], {
        cwd: project,
        encoding: "utf-8",
        env: stateEnv,
        timeout: remainingOperationTimeoutMs(NATIVE_RUNTIME_CASE_TIMEOUT_MS),
      });
    const created = tool("aidlc-utility.ts", "intent-create", "--scope", "feature");
    expect(created.status, `${created.stdout}${created.stderr}`).toBe(0);

    const switched = config("project", "--cloud", "gcp", "--yes");
    expect(switched.status, switched.out).toBe(0);
    expect(switched.out).toContain(
      "now run with the GCP Platform Agent; a stage already finished keeps what the AWS Platform Agent produced.",
    );

    const init = new Set(sourceStages().filter((s) => s.phase === "initialization").map((s) => s.slug));
    const plan = expectedStages("feature", false).filter((slug) => !init.has(slug));
    const stage = "environment-provisioning";
    expect(tool("aidlc-jump.ts", "execute", "--target", stage, "--direction", "forward").status).toBe(0);
    const before = plan.slice(0, plan.indexOf(stage)).map((slug) => `${slug}=completed`);
    expect(tool("aidlc-state.ts", "checkbox", ...before).status).toBe(0);
    const step = runOrchestrateNext(join(project, ".claude", "tools", "aidlc-orchestrate.ts"), project, [], {
      env: stateEnv,
    });
    expect(step.directive?.stage, step.out).toBe(stage);
    expect(step.directive?.lead_agent).toBe("gcp-platform-agent");
    expect(step.directive?.inline_context_paths).toContain(".claude/agents/gcp-platform-agent.md");
    expect(step.directive?.inline_context_paths).toContain(
      ".claude/knowledge/gcp-platform-agent/terraform-best-practices.md",
    );
    // Spoken of as the seat it holds, as the AWS agent is.
    expect(String(step.directive?.narration)).toContain("wearing the platform engineer hat");
  });
});
