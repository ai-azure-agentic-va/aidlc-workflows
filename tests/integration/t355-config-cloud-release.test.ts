// covers: function:syncReleasePlugins, function:releasePluginRoot, function:releasePluginNames,
// function:releasePluginAgents, function:releasePluginsDir
//
// `aidlc config project --cloud` with no plugin installed in the host: the
// cloud plugins the release ships beside its runtime are offered, a choice
// composes one from the release, a switch strips the earlier cloud and brings
// a re-chosen one's notes back, and doctor and `plugin list` count a release
// plugin as installed whether it is on or off. AIDLC_RELEASE_PLUGINS_DIR points
// this copy-channel install at the checkout's built plugins, as a native
// install finds its own beside the binary.

import {
  NATIVE_FIXTURE_SETUP_TIMEOUT_MS,
  NATIVE_RUNTIME_CASE_TIMEOUT_MS,
  remainingOperationTimeoutMs,
} from "../harness/test-budget.ts";
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { REPO_ROOT } from "../harness/fixtures.ts";

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

function env(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    AIDLC_INSTALL_ROOT: join(scratch, "machine", "share", "aidlc"),
    AIDLC_BIN_DIR: join(scratch, "machine", "bin"),
    AIDLC_RELEASE_PLUGINS_DIR: join(DIST, "plugins"),
    // An empty Claude plugin registry: the host installs nothing.
    CLAUDE_CONFIG_DIR: join(scratch, "claude-home"),
    CLAUDE_PROJECT_DIR: project,
    AIDLC_HARNESS_DIR: ".claude",
    NO_COLOR: "1",
  };
}

function aidlc(...args: string[]) {
  const result = spawnSync(BUN, [join(project, ".claude", "tools", "aidlc.ts"), ...args], {
    cwd: project,
    encoding: "utf-8",
    env: env(),
    timeout: remainingOperationTimeoutMs(NATIVE_RUNTIME_CASE_TIMEOUT_MS),
  });
  return { status: result.status, out: `${result.stdout ?? ""}${result.stderr ?? ""}` };
}

const data = (name: string) => join(project, ".claude", "tools", "data", name);

const naming = (agent: string) =>
  (JSON.parse(readFileSync(data("stage-graph.json"), "utf-8")) as Array<{
    slug: string;
    lead_agent: string;
    support_agents: string[];
  }>)
    .filter((s) => s.lead_agent === agent || s.support_agents.includes(agent))
    .map((s) => s.slug)
    .sort();

const NOTED = [
  [".claude", "aidlc-common", "stages", "ideation", "feasibility.md"],
  [".claude", "agents", "aidlc-operations-agent.md"],
];
const notes = (plugin: string) =>
  NOTED.filter((rel) => readFileSync(join(project, ...rel), "utf-8").includes(`(${plugin} plugin)`)).length;

function pluginRows(): Record<string, string> {
  const listed = aidlc("engine", "plugin", "list", "--json");
  expect(listed.status, listed.out).toBe(0);
  const parsed = JSON.parse(listed.out) as { data?: { statuses?: Array<{ key: string; state: string }> } };
  return Object.fromEntries((parsed.data?.statuses ?? []).map((row) => [row.key, row.state]));
}

beforeAll(() => {
  scratch = mkdtempSync(join(tmpdir(), "aidlc-t355-"));
  project = join(scratch, "project");
  mkdirSync(join(project, ".git"), { recursive: true });
  mkdirSync(join(scratch, "claude-home", "plugins"), { recursive: true });
  writeFileSync(join(scratch, "claude-home", "plugins", "installed_plugins.json"), '{"version":2,"plugins":{}}\n');
  writeFileSync(join(scratch, "claude-home", "settings.json"), "{}\n");
  const installed = spawnSync(
    BUN,
    [join(DIST, "claude", ".claude", "tools", "aidlc.ts"), "config", "--harness", "claude", "--from", join(DIST, "claude"), "--mcp", "none", "--yes"],
    { cwd: project, encoding: "utf-8", env: env(), timeout: remainingOperationTimeoutMs(NATIVE_RUNTIME_CASE_TIMEOUT_MS) },
  );
  if (installed.status !== 0) throw new Error(`install failed: ${installed.stdout}${installed.stderr}`);
});

afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true });
});

describe("t355 --cloud composes a cloud plugin the release ships", () => {
  test("the release's cloud plugins are offered before any is installed", () => {
    expect(existsSync(join(project, ".claude", "agents", "azure-platform-agent.md"))).toBe(false);
    const shown = aidlc("config", "project", "--show", "--json");
    expect(shown.status, shown.out).toBe(0);
    const { cloud, cloudChoices } = (JSON.parse(shown.out) as { data: { cloud: string; cloudChoices: string[] } }).data;
    expect({ cloud, cloudChoices }).toEqual({ cloud: "aws", cloudChoices: ["aws", "azure", "gcp"] });
  });

  test("--cloud azure composes the Azure plugin from the release, with no host install", () => {
    const chosen = aidlc("config", "project", "--cloud", "azure", "--yes");
    expect(chosen.status, chosen.out).toBe(0);
    expect(chosen.out).toContain("Set up the azure plugin this release ships.");
    expect(existsSync(join(project, ".claude", "agents", "azure-platform-agent.md"))).toBe(true);
    expect(existsSync(data("plugin-compose-azure.json"))).toBe(true);
    expect(naming("azure-platform-agent")).toEqual(PLATFORM_STAGES);
    expect(notes("azure")).toBe(NOTED.length);
  });

  test("doctor and plugin list count the release plugin as installed", () => {
    expect(pluginRows()).toEqual({ azure: "current" });
    const doctor = aidlc("doctor", "--verbose");
    expect(doctor.out).not.toContain("installed plugin missing");
  });

  test("a refresh with nothing new composes nothing again", () => {
    const again = aidlc("config", "project", "--cloud", "azure", "--yes");
    expect(again.status, again.out).toBe(0);
    expect(again.out).not.toContain("Set up the");
  });

  test("switching to gcp strips Azure and composes GCP; Azure reads as installed and off", () => {
    const switched = aidlc("config", "project", "--cloud", "gcp", "--yes");
    expect(switched.status, switched.out).toBe(0);
    expect(switched.out).toContain("Set up the gcp plugin this release ships.");
    expect(naming("gcp-platform-agent")).toEqual(PLATFORM_STAGES);
    expect(naming("azure-platform-agent")).toEqual([]);
    expect(notes("azure")).toBe(0);
    expect(notes("gcp")).toBe(NOTED.length);
    expect(pluginRows()).toEqual({ azure: "installed-disabled", gcp: "current" });
    expect(aidlc("doctor", "--verbose").out).not.toContain("installed plugin missing");
  });

  test("choosing azure again brings its notes back", () => {
    const back = aidlc("config", "project", "--cloud", "azure", "--yes");
    expect(back.status, back.out).toBe(0);
    expect(naming("azure-platform-agent")).toEqual(PLATFORM_STAGES);
    expect(notes("azure")).toBe(NOTED.length);
    expect(notes("gcp")).toBe(0);
  });

  test("--cloud aws turns every cloud plugin off", () => {
    const aws = aidlc("config", "project", "--cloud", "aws", "--yes");
    expect(aws.status, aws.out).toBe(0);
    expect(naming("aidlc-aws-platform-agent")).toEqual(PLATFORM_STAGES);
    expect(notes("azure")).toBe(0);
    expect(notes("gcp")).toBe(0);
  });
});
