// covers: function:resolveAgentSlots, function:loadAgents, function:compileStageGraph,
// function:cloudChoices, function:selectedCloud, function:cloudPlugins, function:readAgents,
// function:CLOUD_PLATFORM_SLOT, function:CORE_CLOUD
//
// An agent slot is a seat a core persona opens with `slot: <name>` and one
// enabled plugin persona may fill by declaring the same slot. These tests pin
// the resolution rules, then compile the shipped core stages against a copy of
// the Claude tree: with no filler the graph is bare core, one enabled filler
// takes every stage that names the core default, a disabled filler changes
// nothing, and two enabled fillers fail the compile naming both plugins.

import { afterEach, describe, expect, test } from "bun:test";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  type AgentMetadata,
  CLOUD_PLATFORM_SLOT,
  cloudChoices,
  cloudPlugins,
  CORE_CLOUD,
  loadAgents,
  readAgents,
  resolveAgentSlots,
  selectedCloud,
} from "../../core/tools/aidlc-lib.ts";
import { compileStageGraph, type GraphStage } from "../../core/tools/aidlc-graph.ts";
import { REPO_ROOT, withEnvAndFreshCaches } from "../harness/fixtures.ts";

const CLAUDE_ROOT = join(REPO_ROOT, "dist", "claude", ".claude");
const AWS = "aidlc-aws-platform-agent";

const tempDirs: string[] = [];
afterEach(() => {
  for (const d of tempDirs.splice(0)) rmSync(d, { recursive: true, force: true });
  withEnvAndFreshCaches({}, () => undefined);
});

const agent = (slug: string, extra: Partial<AgentMetadata> = {}): AgentMetadata => ({
  slug,
  display_name: slug,
  examples: [],
  ...extra,
});

const pluginAgentMd = (plugin: string, slot: string) =>
  `---\nname: ${plugin}-platform-agent\ndisplay_name: ${plugin} Platform Agent\n` +
  `plugin: ${plugin}\nslot: ${slot}\ndescription: >\n  Fixture persona for the ${slot} slot.\n` +
  `disallowedTools: Task\ntier: judgment\n---\n\n# ${plugin} Platform Agent\n`;

// A copy of the built Claude tree with extra agent files and an optional
// plugin selection, plus the env that points every loader at it.
function fixtureEnv(
  agents: Record<string, string>,
  plugins?: string[],
): Record<string, string | undefined> {
  const root = mkdtempSync(join(tmpdir(), "t402-"));
  tempDirs.push(root);
  cpSync(CLAUDE_ROOT, root, { recursive: true });
  for (const [name, body] of Object.entries(agents)) {
    writeFileSync(join(root, "agents", name), body, "utf-8");
  }
  if (plugins) {
    const path = join(root, "tools", "data", "harness.json");
    const data = JSON.parse(readFileSync(path, "utf-8")) as Record<string, unknown>;
    writeFileSync(path, `${JSON.stringify({ ...data, plugins }, null, 2)}\n`, "utf-8");
  }
  return {
    AIDLC_RUNTIME_HARNESS_ROOT: root,
    AIDLC_AGENTS_DIR: undefined,
    AIDLC_STAGES_DIR: undefined,
    AIDLC_STAGE_GRAPH: undefined,
    AIDLC_SCOPES_DIR: undefined,
    AIDLC_SCOPE_GRID: undefined,
    AIDLC_SCOPE_MAPPING: undefined,
  };
}

const agentsOf = (stages: GraphStage[]) =>
  Object.fromEntries(stages.map((s) => [s.slug, [s.lead_agent, ...s.support_agents]]));

describe("t402 resolveAgentSlots", () => {
  test("the core default holds a slot no enabled plugin fills", () => {
    const slots = resolveAgentSlots(
      [agent(AWS, { slot: "cloud-platform" }), agent("x-platform-agent", { plugin: "x", slot: "cloud-platform" })],
      () => false,
    );
    expect(slots).toEqual([{ slot: "cloud-platform", defaultAgent: AWS, agent: AWS, plugin: null }]);
  });

  test("one enabled plugin persona fills the slot", () => {
    const slots = resolveAgentSlots(
      [agent(AWS, { slot: "cloud-platform" }), agent("x-platform-agent", { plugin: "x", slot: "cloud-platform" })],
      (plugin) => plugin === "x",
    );
    expect(slots).toEqual([
      { slot: "cloud-platform", defaultAgent: AWS, agent: "x-platform-agent", plugin: "x" },
    ]);
  });

  test("two enabled cloud plugins are refused, naming both and the --cloud fix", () => {
    expect(() =>
      resolveAgentSlots(
        [
          agent(AWS, { slot: "cloud-platform" }),
          agent("x-platform-agent", { plugin: "x", slot: "cloud-platform" }),
          agent("y-platform-agent", { plugin: "y", slot: "cloud-platform" }),
        ],
        () => true,
      ),
    ).toThrow(/cloud plugin is turned on: x \(x-platform-agent\), y \(y-platform-agent\).*config project --cloud/);
  });

  test("two enabled fillers of another slot name the --plugins fix", () => {
    expect(() =>
      resolveAgentSlots(
        [
          agent("a-agent", { slot: "s" }),
          agent("x-agent", { plugin: "x", slot: "s" }),
          agent("y-agent", { plugin: "y", slot: "s" }),
        ],
        () => true,
      ),
    ).toThrow(/fills the slot "s": x \(x-agent\), y \(y-agent\).*config project --plugins/);
  });

  test("cloud choices are the core cloud then each cloud plugin, on or off", () => {
    const agents = [
      agent(AWS, { slot: "cloud-platform" }),
      agent("gcp-platform-agent", { plugin: "gcp", slot: "cloud-platform" }),
      agent("azure-platform-agent", { plugin: "azure", slot: "cloud-platform" }),
      agent("test-pro-metrics-agent", { plugin: "test-pro" }),
    ];
    expect(cloudChoices(agents)).toEqual(["aws", "azure", "gcp"]);
    expect(selectedCloud(agents, (plugin) => plugin === "gcp")).toBe("gcp");
    expect(selectedCloud(agents, () => false)).toBe("aws");
  });

  test("a plugin cannot fill a slot no core agent opens", () => {
    expect(() =>
      resolveAgentSlots([agent("x-architect-agent", { plugin: "x", slot: "architect" })], () => true),
    ).toThrow(/no core agent opens/);
  });

  test("a disabled plugin's unknown slot is inert", () => {
    expect(resolveAgentSlots([agent("x-architect-agent", { plugin: "x", slot: "architect" })], () => false))
      .toEqual([]);
  });

  test("two core agents cannot open the same slot", () => {
    expect(() =>
      resolveAgentSlots([agent("a-agent", { slot: "s" }), agent("b-agent", { slot: "s" })], () => true),
    ).toThrow(/both open the slot "s"/);
  });

  test("a plugin named like the core cloud fills the slot but is never a choice", () => {
    const agents = [
      agent(AWS, { slot: CLOUD_PLATFORM_SLOT }),
      agent("aws-platform-agent", { plugin: CORE_CLOUD, slot: CLOUD_PLATFORM_SLOT }),
      agent("azure-platform-agent", { plugin: "azure", slot: CLOUD_PLATFORM_SLOT }),
    ];
    // --cloud turns every one of these off; only the core name and azure are offered.
    expect(cloudPlugins(agents)).toEqual(["aws", "azure"]);
    expect(cloudChoices(agents)).toEqual(["aws", "azure"]);
  });

  test("readAgents reads one directory's roster, uncached", () => {
    const roster = readAgents(join(REPO_ROOT, "core", "agents"));
    expect(roster).toHaveLength(14);
    expect(roster.filter((a) => a.slot !== undefined).map((a) => a.slug)).toEqual([AWS]);
  });

  test("the shipped roster opens exactly the cloud-platform slot, held by the AWS agent", () => {
    withEnvAndFreshCaches({ AIDLC_AGENTS_DIR: join(REPO_ROOT, "core", "agents") }, () => {
      expect(resolveAgentSlots(loadAgents(), () => true)).toEqual([
        { slot: "cloud-platform", defaultAgent: AWS, agent: AWS, plugin: null },
      ]);
    });
  });

  test("the loader refuses a slot name that is not lowercase-dashed", () => {
    const env = fixtureEnv({ "x-platform-agent.md": pluginAgentMd("x", "Cloud_Platform") });
    withEnvAndFreshCaches(env, () => {
      expect(() => loadAgents()).toThrow(/slot "Cloud_Platform"/);
    });
  });
});

describe("t402 graph compile fills agent slots", () => {
  const bare = () => withEnvAndFreshCaches(fixtureEnv({}), () => agentsOf(compileStageGraph().stages));

  test("an enabled filler takes every stage that names the core default, and nothing else", () => {
    const before = bare();
    const env = fixtureEnv({ "slotfix-platform-agent.md": pluginAgentMd("slotfix", "cloud-platform") }, [
      "aidlc",
      "slotfix",
    ]);
    const after = withEnvAndFreshCaches(env, () => agentsOf(compileStageGraph().stages));
    const expected = Object.fromEntries(
      Object.entries(before).map(([slug, agents]) => [
        slug,
        agents.map((a) => (a === AWS ? "slotfix-platform-agent" : a)),
      ]),
    );
    expect(after).toEqual(expected);
    // The seven platform stages are the ones that change.
    const changed = Object.keys(before).filter((slug) => before[slug].includes(AWS)).sort();
    expect(changed).toEqual([
      "contract-design",
      "domain-design",
      "environment-provisioning",
      "feasibility",
      "feedback-optimization",
      "infrastructure-design",
      "nfr-design",
    ]);
  });

  test("a disabled filler compiles byte-identical bare core", () => {
    const bareJson = withEnvAndFreshCaches(fixtureEnv({}, ["aidlc"]), () => compileStageGraph().json);
    const env = fixtureEnv({ "slotfix-platform-agent.md": pluginAgentMd("slotfix", "cloud-platform") }, ["aidlc"]);
    expect(withEnvAndFreshCaches(env, () => compileStageGraph().json)).toBe(bareJson);
  });

  test("two enabled fillers fail the compile", () => {
    const env = fixtureEnv({
      "slotfix-platform-agent.md": pluginAgentMd("slotfix", "cloud-platform"),
      "slotalt-platform-agent.md": pluginAgentMd("slotalt", "cloud-platform"),
    });
    expect(() => withEnvAndFreshCaches(env, () => compileStageGraph())).toThrow(
      /slotalt \(slotalt-platform-agent\), slotfix \(slotfix-platform-agent\)/,
    );
  });
});
