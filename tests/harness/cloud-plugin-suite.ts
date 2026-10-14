// The shared content suite for a cloud plugin: one persona that fills the core
// cloud-platform slot, its knowledge, and prose notes for the stages and
// personas that name AWS services. The suite composes the plugin on every
// harness, checks what a run would load, then turns the plugin off and checks
// that bare core comes back.

import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import type { GraphStage } from "../../dist/claude/.claude/tools/aidlc-graph.ts";
import { shippedInlineContextEntries } from "../../dist/claude/.claude/tools/aidlc-inline-context.ts";
import { REPO_ROOT } from "./fixtures.ts";
import { harnessByName, type ShippedHarnessName } from "./harness-matrix.ts";
import { composePluginFixture, validatePluginContent } from "./plugin-kit.ts";
import {
  NATIVE_FIXTURE_SETUP_TIMEOUT_MS,
  NATIVE_STARTUP_TIMEOUT_MS,
  remainingOperationTimeoutMs,
} from "./test-budget.ts";

const AWS = "aidlc-aws-platform-agent";
const HARNESSES: readonly ShippedHarnessName[] = [
  "claude",
  "codex",
  "copilot",
  "cursor",
  "kiro",
  "kiro-ide",
  "opencode",
];
const PLATFORM_STAGES = [
  "contract-design",
  "domain-design",
  "environment-provisioning",
  "feasibility",
  "feedback-optimization",
  "infrastructure-design",
  "nfr-design",
];
const NOTED_PERSONAS = ["aidlc-operations-agent.md", "aidlc-pipeline-deploy-agent.md"];
const NOTED_STAGES = [
  ["ideation", "feasibility.md"],
  ["operation", "environment-provisioning.md"],
  ["operation", "feedback-optimization.md"],
];

export interface CloudPluginSuite {
  /** The plugin name, as `config project --cloud` takes it. */
  plugin: string;
  /** The authored plugin root. */
  pluginRoot: string;
  /** The text that opens every note the plugin adds. */
  note: string;
  /** The knowledge files the persona ships. */
  knowledge: string[];
}

const graph = (root: string): GraphStage[] =>
  JSON.parse(readFileSync(join(root, "tools", "data", "stage-graph.json"), "utf-8"));

const naming = (nodes: GraphStage[], agent: string) =>
  nodes.filter((s) => s.lead_agent === agent || s.support_agents.includes(agent)).map((s) => s.slug).sort();

export function cloudPluginSuite(options: CloudPluginSuite): void {
  setDefaultTimeout(NATIVE_FIXTURE_SETUP_TIMEOUT_MS);
  const agent = `${options.plugin}-platform-agent`;
  const scratch: string[] = [];
  afterAll(() => {
    for (const dir of scratch.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  const compose = (harness: ShippedHarnessName) => {
    const composed = composePluginFixture({
      plugin: options.plugin,
      harness,
      pluginBuilt: join(REPO_ROOT, "dist", "plugins", options.plugin, harness),
    });
    scratch.push(dirname(composed.projectDir));
    return { ...composed, root: join(composed.projectDir, harnessByName(harness).manifest.harnessDir) };
  };

  describe(`${options.plugin} plugin own content validation`, () => {
    test("passes the reusable plugin content validator", () => {
      expect(validatePluginContent(options.pluginRoot)).toEqual([]);
    });

    test("the bare-core platform stages are the seven the persona supports", () => {
      expect(naming(graph(join(REPO_ROOT, "dist", "claude", ".claude")), AWS)).toEqual(PLATFORM_STAGES);
    });
  });

  describe(`${options.plugin} plugin composed on every harness`, () => {
    for (const harness of HARNESSES) {
      test(`${harness}: the ${options.plugin} persona takes every platform stage, with no drops`, () => {
        const composed = compose(harness);
        expect(composed.dropLogs.trim()).toBe("");
        const nodes = graph(composed.root);
        expect(naming(nodes, agent)).toEqual(PLATFORM_STAGES);
        expect(naming(nodes, AWS)).toEqual([]);
      });
    }
  });

  describe(`${options.plugin} plugin on Claude Code`, () => {
    let composed: ReturnType<typeof compose>;
    beforeAll(() => {
      composed = compose("claude");
    });
    const read = (...rel: string[]) => readFileSync(join(composed.root, ...rel), "utf-8");
    const utility = (args: string[]) =>
      spawnSync(process.execPath, [join(composed.root, "tools", "aidlc-utility.ts"), ...args], {
        cwd: composed.projectDir,
        encoding: "utf-8",
        timeout: remainingOperationTimeoutMs(NATIVE_STARTUP_TIMEOUT_MS),
        env: { ...process.env, CLAUDE_PROJECT_DIR: composed.projectDir, AIDLC_HARNESS_DIR: ".claude" },
      });

    test("Infrastructure Design loads the plugin persona and its knowledge", () => {
      const node = graph(composed.root).find((s) => s.slug === "infrastructure-design")!;
      const rels = shippedInlineContextEntries(node, composed.root, ".claude").map((e) => e.rel);
      expect(rels).toContain(`.claude/agents/${agent}.md`);
      expect(rels).not.toContain(`.claude/agents/${AWS}.md`);
      for (const file of options.knowledge) {
        expect(rels).toContain(`.claude/knowledge/${agent}/${file}`);
      }
    });

    test("the notes reach the personas and stages that name AWS services", () => {
      for (const persona of NOTED_PERSONAS) {
        expect(read("agents", persona)).toContain(options.note);
        expect(read("agents", persona)).toContain(`Works with (${options.plugin})`);
      }
      for (const stage of NOTED_STAGES) {
        const body = read("aidlc-common", "stages", ...stage);
        expect(body.indexOf(options.note)).toBeGreaterThan(0);
        expect(body.indexOf(options.note)).toBeLessThan(body.indexOf("### Step 1"));
      }
    });

    test("doctor passes with the plugin composed", () => {
      const doctor = utility(["doctor", "--verbose", "--project-dir", composed.projectDir]);
      expect(doctor.status, `${doctor.stdout}${doctor.stderr}`).toBe(0);
    });

    test("turning the plugin off strips its notes and gives the stages back to the AWS agent", () => {
      const off = utility(["select-plugins", "aidlc"]);
      expect(off.status, off.stderr).toBe(0);
      expect(naming(graph(composed.root), AWS)).toEqual(PLATFORM_STAGES);
      expect(naming(graph(composed.root), agent)).toEqual([]);
      for (const persona of NOTED_PERSONAS) expect(read("agents", persona)).not.toContain(options.note);
      for (const stage of NOTED_STAGES) {
        expect(read("aidlc-common", "stages", ...stage)).not.toContain(options.note);
      }
    });
  });
}
