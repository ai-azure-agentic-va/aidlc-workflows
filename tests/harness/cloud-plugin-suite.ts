// The shared content suite for a cloud plugin: one persona that fills the core
// cloud-platform slot, four specialists (security, compliance, operations,
// pipeline-deploy) that stand beside the core persona of the same trade on the
// cloud stages, their knowledge, and prose notes for the stages and personas
// that name AWS services. The suite composes the plugin on every harness,
// checks what a run would load, then turns the plugin off and checks that bare
// core comes back.

import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, rmSync } from "node:fs";
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
const NOTED_PERSONAS = [
  "aidlc-operations-agent.md",
  "aidlc-pipeline-deploy-agent.md",
  "aidlc-devsecops-agent.md",
  "aidlc-compliance-agent.md",
];
// Each cloud carries the same four specialists. A specialist stands beside the
// core persona of its trade on these stages (each one inline in core, so a
// plugin persona needs no native dispatch surface) and replaces no one.
const SPECIALISTS: Record<string, { counterpart: string; stages: string[] }> = {
  security: {
    counterpart: "aidlc-devsecops-agent",
    stages: ["environment-provisioning", "infrastructure-design", "nfr-requirements"],
  },
  compliance: {
    counterpart: "aidlc-compliance-agent",
    stages: ["environment-provisioning", "feasibility", "infrastructure-design", "nfr-requirements"],
  },
  operations: {
    counterpart: "aidlc-operations-agent",
    stages: ["feedback-optimization", "incident-response", "observability-setup"],
  },
  "pipeline-deploy": {
    counterpart: "aidlc-pipeline-deploy-agent",
    stages: ["ci-pipeline", "deployment-execution", "deployment-pipeline"],
  },
};
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

const frontmatterList = (text: string, key: string): string[] => {
  const block = text.match(new RegExp(`^${key}:\\n((?:[ \\t]+- .+\\n)+)`, "m"))?.[1] ?? "";
  return [...block.matchAll(/^[ \t]+- (.+)$/gm)].map((m) => m[1].trim()).sort();
};

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

  const specialist = (role: string) => `${options.plugin}-${role}-agent`;
  const expectSpecialists = (nodes: GraphStage[]) => {
    for (const [role, spec] of Object.entries(SPECIALISTS)) {
      expect(naming(nodes, specialist(role)), specialist(role)).toEqual(spec.stages);
      for (const slug of spec.stages) {
        const node = nodes.find((s) => s.slug === slug)!;
        expect(node.lead_agent).not.toBe(specialist(role));
        expect([node.lead_agent, ...node.support_agents], `${slug} keeps ${spec.counterpart}`).toContain(
          spec.counterpart,
        );
      }
    }
  };

  describe(`${options.plugin} plugin own content validation`, () => {
    test("passes the reusable plugin content validator", () => {
      expect(validatePluginContent(options.pluginRoot)).toEqual([]);
    });

    test("the bare-core platform stages are the seven the persona supports", () => {
      expect(naming(graph(join(REPO_ROOT, "dist", "claude", ".claude")), AWS)).toEqual(PLATFORM_STAGES);
    });
  });

  describe(`${options.plugin} specialists`, () => {
    for (const [role, spec] of Object.entries(SPECIALISTS)) {
      const slug = specialist(role);
      const text = () => readFileSync(join(options.pluginRoot, "agents", `${slug}.md`), "utf-8");

      test(`${slug} supports its stages, fills no seat, and ships knowledge`, () => {
        expect(frontmatterList(text(), "supports")).toEqual(spec.stages);
        expect(text()).toMatch(new RegExp(`^plugin: ${options.plugin}$`, "m"));
        expect(text()).not.toMatch(/^slot:/m);
        const files = readdirSync(join(options.pluginRoot, "knowledge", slug)).filter((f) => f.endsWith(".md"));
        expect(files.length).toBeGreaterThan(0);
      });

      test(`the stages ${slug} supports run inline in bare core, beside the core ${role} persona`, () => {
        const nodes = graph(join(REPO_ROOT, "dist", "claude", ".claude"));
        for (const stage of spec.stages) {
          const node = nodes.find((s) => s.slug === stage);
          expect(node, `stage ${stage}`).toBeDefined();
          expect(node!.mode).toBe("inline");
          expect([node!.lead_agent, ...node!.support_agents]).toContain(spec.counterpart);
        }
      });
    }
  });

  describe(`${options.plugin} plugin composed on every harness`, () => {
    for (const harness of HARNESSES) {
      test(`${harness}: the ${options.plugin} persona takes every platform stage, with no drops`, () => {
        const composed = compose(harness);
        expect(composed.dropLogs.trim()).toBe("");
        const nodes = graph(composed.root);
        expect(naming(nodes, agent)).toEqual(PLATFORM_STAGES);
        expect(naming(nodes, AWS)).toEqual([]);
        expectSpecialists(nodes);
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

    test("a specialist's stage loads its persona and knowledge", () => {
      for (const [role, spec] of Object.entries(SPECIALISTS)) {
        const slug = specialist(role);
        const node = graph(composed.root).find((s) => s.slug === spec.stages[0])!;
        const rels = shippedInlineContextEntries(node, composed.root, ".claude").map((e) => e.rel);
        expect(rels).toContain(`.claude/agents/${slug}.md`);
        for (const file of readdirSync(join(options.pluginRoot, "knowledge", slug)).filter((f) => f.endsWith(".md"))) {
          expect(rels).toContain(`.claude/knowledge/${slug}/${file}`);
        }
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

    test("turning the plugin off strips its notes and gives the stages back to the AWS agent and the core personas", () => {
      const off = utility(["select-plugins", "aidlc"]);
      expect(off.status, off.stderr).toBe(0);
      expect(naming(graph(composed.root), AWS)).toEqual(PLATFORM_STAGES);
      expect(naming(graph(composed.root), agent)).toEqual([]);
      for (const role of Object.keys(SPECIALISTS)) expect(naming(graph(composed.root), specialist(role))).toEqual([]);
      for (const persona of NOTED_PERSONAS) expect(read("agents", persona)).not.toContain(options.note);
      for (const stage of NOTED_STAGES) {
        expect(read("aidlc-common", "stages", ...stage)).not.toContain(options.note);
      }
    });
  });
}
