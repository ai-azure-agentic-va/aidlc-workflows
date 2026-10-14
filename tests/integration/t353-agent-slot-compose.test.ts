// covers: function:resolveAgentSlots, subcommand:aidlc-utility:select-plugins
//
// A plugin that ships only a persona filling the core cloud-platform slot,
// taken through the real path: standalone build, the compose hook on a copied
// Claude install, the compiled graph and the generated stage table, then
// plugin selection turning it off and on again.

import {
  NATIVE_FIXTURE_SETUP_TIMEOUT_MS,
  NATIVE_RUNTIME_CASE_TIMEOUT_MS,
  remainingOperationTimeoutMs,
} from "../harness/test-budget.ts";
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { REPO_ROOT } from "../harness/fixtures.ts";
import { composePluginFixture } from "../harness/plugin-kit.ts";

setDefaultTimeout(NATIVE_FIXTURE_SETUP_TIMEOUT_MS);
const BUN = process.execPath;
const BUILD_TOOL = join(REPO_ROOT, "dist", "claude", ".claude", "tools", "aidlc-plugin-build.ts");
const AWS = "aidlc-aws-platform-agent";
const PLATFORM_STAGES = [
  "contract-design",
  "domain-design",
  "environment-provisioning",
  "feasibility",
  "feedback-optimization",
  "infrastructure-design",
  "nfr-design",
];

interface Node {
  slug: string;
  lead_agent: string;
  support_agents: string[];
}

let tmp = "";
beforeAll(() => {
  tmp = mkdtempSync(join(tmpdir(), "aidlc-t353-"));
});
afterAll(() => {
  if (tmp) rmSync(tmp, { recursive: true, force: true });
});

// An authored plugin root whose only content is one slot-filling persona.
function slotPlugin(name: string): string {
  const root = join(tmp, "src", name);
  mkdirSync(join(root, ".aidlc-plugin"), { recursive: true });
  mkdirSync(join(root, "agents"), { recursive: true });
  writeFileSync(
    join(root, ".aidlc-plugin", "plugin.json"),
    `${JSON.stringify(
      {
        name,
        version: "0.1.0",
        description: `${name} fixture`,
        author: { name: "Fixture" },
        dependencies: ["core"],
        aidlc: { contributes: { agents: "agents/" } },
      },
      null,
      2,
    )}\n`,
  );
  writeFileSync(
    join(root, "agents", `${name}-platform-agent.md`),
    `---\nname: ${name}-platform-agent\ndisplay_name: ${name} Platform Agent\nplugin: ${name}\n` +
      "slot: cloud-platform\ndescription: >\n  Fixture persona for the cloud-platform slot.\n" +
      `disallowedTools: Task\ntier: judgment\n---\n\n# ${name} Platform Agent\n`,
  );
  return root;
}

function build(name: string): string {
  const out = join(tmp, "built", name);
  const result = spawnSync(BUN, [BUILD_TOOL, slotPlugin(name), "claude", out], {
    cwd: tmp,
    encoding: "utf-8",
    timeout: remainingOperationTimeoutMs(NATIVE_RUNTIME_CASE_TIMEOUT_MS),
  });
  if (result.status !== 0) throw new Error(`plugin build failed: ${result.stderr}`);
  return out;
}

function runUtility(project: string, args: string[]) {
  return spawnSync(BUN, [join(project, ".claude", "tools", "aidlc-utility.ts"), ...args], {
    cwd: project,
    encoding: "utf-8",
    timeout: remainingOperationTimeoutMs(NATIVE_RUNTIME_CASE_TIMEOUT_MS),
    env: { ...process.env, CLAUDE_PROJECT_DIR: project, AIDLC_HARNESS_DIR: ".claude" },
  });
}

const graph = (project: string): Node[] =>
  JSON.parse(readFileSync(join(project, ".claude", "tools", "data", "stage-graph.json"), "utf-8"));

const stagesNaming = (project: string, agent: string) =>
  graph(project)
    .filter((s) => s.lead_agent === agent || s.support_agents.includes(agent))
    .map((s) => s.slug)
    .sort();

const stageTable = (project: string) =>
  readFileSync(join(project, ".claude", "skills", "aidlc", "tables.md"), "utf-8");

describe("t353 a plugin persona fills the cloud-platform slot", () => {
  let project = "";

  test("compose puts the plugin persona on every platform stage", () => {
    const composed = composePluginFixture({
      plugin: "slotfix",
      harness: "claude",
      projectDir: join(tmp, "project"),
      pluginBuilt: build("slotfix"),
    });
    project = composed.projectDir;
    expect(composed.dropLogs).not.toContain("slotfix-platform-agent");
    expect(stagesNaming(project, "slotfix-platform-agent")).toEqual(PLATFORM_STAGES);
    expect(stagesNaming(project, AWS)).toEqual([]);
    expect(stageTable(project)).toContain("| infrastructure-design |");
    expect(stageTable(project)).toContain("slotfix-platform-agent");
    expect(stageTable(project)).not.toContain(AWS);
  });

  test("turning the plugin off gives the stages back to the core default", () => {
    const off = runUtility(project, ["select-plugins", "aidlc"]);
    expect(off.status, off.stderr).toBe(0);
    expect(stagesNaming(project, AWS)).toEqual(PLATFORM_STAGES);
    expect(stagesNaming(project, "slotfix-platform-agent")).toEqual([]);
    expect(stageTable(project)).not.toContain("slotfix-platform-agent");
  });

  test("turning it back on fills the slot again", () => {
    const on = runUtility(project, ["select-plugins", "aidlc,slotfix"]);
    expect(on.status, on.stderr).toBe(0);
    expect(stagesNaming(project, "slotfix-platform-agent")).toEqual(PLATFORM_STAGES);
  });
});
