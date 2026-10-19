// covers: function:resolveAgentSupports, function:loadAgents, function:compileStageGraph
//
// A plugin persona stands beside a core stage's agents by listing the stage in
// `supports:`. These tests pin the rules: only a plugin persona may declare it,
// an enabled plugin's persona joins the stage's support agents and a disabled
// one changes nothing, only an inline stage takes one, a persona that already
// leads the stage is not named twice, and a stage name no stage carries is
// skipped instead of failing the compile.

import { afterEach, describe, expect, test } from "bun:test";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type AgentMetadata, loadAgents, resolveAgentSupports } from "../../core/tools/aidlc-lib.ts";
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

const personaMd = (plugin: string, role: string, supports: string[], extraFrontmatter = "") =>
  `---\nname: ${plugin}-${role}-agent\ndisplay_name: ${plugin} ${role}\nplugin: ${plugin}\n${extraFrontmatter}` +
  `supports:\n${supports.map((s) => `  - ${s}`).join("\n")}\n` +
  `description: >\n  Fixture specialist.\ndisallowedTools: Task\ntier: judgment\n---\n\n# ${plugin} ${role}\n`;

// A copy of the built Claude tree with extra agent files and an optional
// plugin selection, plus the env that points every loader at it.
function fixtureEnv(
  agents: Record<string, string>,
  plugins?: string[],
): Record<string, string | undefined> {
  const root = mkdtempSync(join(tmpdir(), "t404-"));
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

const supportsOf = (stages: GraphStage[]) =>
  Object.fromEntries(stages.map((s) => [s.slug, s.support_agents]));

describe("t404 resolveAgentSupports", () => {
  const roster = [
    agent("aidlc-devsecops-agent"),
    agent("x-security-agent", { plugin: "x", supports: ["infrastructure-design", "nfr-requirements"] }),
    agent("y-security-agent", { plugin: "y", supports: ["infrastructure-design"] }),
  ];

  test("names each enabled plugin persona under every stage it lists", () => {
    expect(resolveAgentSupports(roster, () => true)).toEqual(
      new Map([
        ["infrastructure-design", ["x-security-agent", "y-security-agent"]],
        ["nfr-requirements", ["x-security-agent"]],
      ]),
    );
  });

  test("leaves out a persona whose plugin is off", () => {
    expect(resolveAgentSupports(roster, (plugin) => plugin === "y")).toEqual(
      new Map([["infrastructure-design", ["y-security-agent"]]]),
    );
    expect(resolveAgentSupports(roster, () => false).size).toBe(0);
  });

  test("the shipped roster supports no stage", () => {
    expect(resolveAgentSupports(withEnvAndFreshCaches({}, () => loadAgents()), () => true).size).toBe(0);
  });
});

describe("t404 the loader reads supports", () => {
  test("a plugin persona's supports are listed on its metadata", () => {
    const env = fixtureEnv({ "sup-security-agent.md": personaMd("sup", "security", ["nfr-requirements"]) });
    withEnvAndFreshCaches(env, () => {
      expect(loadAgents().find((a) => a.slug === "sup-security-agent")?.supports).toEqual(["nfr-requirements"]);
    });
  });

  test("a core persona may not declare supports", () => {
    const env = fixtureEnv({
      "aidlc-extra-agent.md": personaMd("sup", "extra", ["nfr-requirements"]).replace(
        /name: sup-extra-agent[\s\S]*?plugin: sup\n/,
        "name: aidlc-extra-agent\ndisplay_name: Extra\n",
      ),
    });
    withEnvAndFreshCaches(env, () => {
      expect(() => loadAgents()).toThrow(/only a plugin persona stands beside/);
    });
  });

  test("a stage name must be lowercase-dashed", () => {
    const env = fixtureEnv({ "sup-security-agent.md": personaMd("sup", "security", ["NFR_Requirements"]) });
    withEnvAndFreshCaches(env, () => {
      expect(() => loadAgents()).toThrow(/supports "NFR_Requirements"/);
    });
  });
});

describe("t404 graph compile adds supporting personas", () => {
  const bare = () => withEnvAndFreshCaches(fixtureEnv({}), () => supportsOf(compileStageGraph().stages));

  test("an enabled persona joins its inline stages, last, and changes nothing else", () => {
    const before = bare();
    const env = fixtureEnv(
      { "sup-security-agent.md": personaMd("sup", "security", ["infrastructure-design", "nfr-requirements"]) },
      ["aidlc", "sup"],
    );
    const after = withEnvAndFreshCaches(env, () => supportsOf(compileStageGraph().stages));
    expect(after).toEqual({
      ...before,
      "infrastructure-design": [...before["infrastructure-design"], "sup-security-agent"],
      "nfr-requirements": [...before["nfr-requirements"], "sup-security-agent"],
    });
    // The core personas keep their seats beside it.
    expect(after["infrastructure-design"]).toContain("aidlc-devsecops-agent");
  });

  test("a stage that dispatches its agents and a stage no one carries are skipped", () => {
    const before = bare();
    const env = fixtureEnv(
      {
        "sup-security-agent.md": personaMd("sup", "security", [
          "practices-discovery",
          "no-such-stage",
          "infrastructure-design",
        ]),
      },
      ["aidlc", "sup"],
    );
    const after = withEnvAndFreshCaches(env, () => supportsOf(compileStageGraph().stages));
    expect(after["practices-discovery"]).toEqual(before["practices-discovery"]);
    expect(after["infrastructure-design"]).toEqual([...before["infrastructure-design"], "sup-security-agent"]);
  });

  test("a persona that already leads the stage is not named a second time", () => {
    const env = fixtureEnv(
      {
        "sup-platform-agent.md": personaMd("sup", "platform", ["infrastructure-design"], "slot: cloud-platform\n"),
      },
      ["aidlc", "sup"],
    );
    withEnvAndFreshCaches(env, () => {
      const node = compileStageGraph().stages.find((s) => s.slug === "infrastructure-design")!;
      expect(node.lead_agent).toBe("sup-platform-agent");
      expect(node.support_agents).not.toContain("sup-platform-agent");
      expect(node.lead_agent).not.toBe(AWS);
    });
  });

  test("a disabled plugin compiles byte-identical bare core", () => {
    const bareJson = withEnvAndFreshCaches(fixtureEnv({}, ["aidlc"]), () => compileStageGraph().json);
    const env = fixtureEnv(
      { "sup-security-agent.md": personaMd("sup", "security", ["infrastructure-design"]) },
      ["aidlc"],
    );
    expect(withEnvAndFreshCaches(env, () => compileStageGraph().json)).toBe(bareJson);
  });
});
