// covers: function:releasePluginsDir, function:releasePluginRoot, function:releasePluginNames,
// function:releasePluginAgents
//
// Where a release's own plugins are found. A native install unpacks the
// release archive into versions/<version>/, so the plugins sit beside the
// binary as plugins/<plugin>/<harness>/; AIDLC_RELEASE_PLUGINS_DIR names the
// folder for a Bun engine. A plugin counts only with a projection marker and a
// compose hook, and its personas are read from where each harness keeps them.

import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  releasePluginAgents,
  releasePluginNames,
  releasePluginRoot,
  releasePluginsDir,
} from "../../core/tools/aidlc-plugin.ts";

const scratch: string[] = [];
const saved = {
  dir: process.env.AIDLC_RELEASE_PLUGINS_DIR,
  compiled: process.env.AIDLC_COMPILED_EXECUTABLE,
};
afterEach(() => {
  for (const [key, value] of [
    ["AIDLC_RELEASE_PLUGINS_DIR", saved.dir],
    ["AIDLC_COMPILED_EXECUTABLE", saved.compiled],
  ] as const) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  for (const dir of scratch.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const persona = (plugin: string) =>
  `---\nname: ${plugin}-platform-agent\ndisplay_name: ${plugin}\nplugin: ${plugin}\nslot: cloud-platform\n` +
  "description: >\n  x\ndisallowedTools: Task\ntier: judgment\n---\n\n# x\n";

// A release's plugins folder: azure for claude and cursor (whose personas live
// under aidlc/agents/), and a folder without a compose hook that does not count.
function releaseFolder(): string {
  const root = mkdtempSync(join(tmpdir(), "aidlc-t403-"));
  scratch.push(root);
  const plugins = join(root, "versions", "9.9.9", "plugins");
  const projection = (plugin: string, harness: string, agentsDir: string[], hook = true) => {
    const dir = join(plugins, plugin, harness);
    mkdirSync(join(dir, ...agentsDir), { recursive: true });
    writeFileSync(join(dir, ".aidlc-plugin-projection.json"), "{}\n");
    if (hook) {
      mkdirSync(join(dir, "hooks"), { recursive: true });
      writeFileSync(join(dir, "hooks", "compose.ts"), "export function compose() {}\n");
    }
    writeFileSync(join(dir, ...agentsDir, `${plugin}-platform-agent.md`), persona(plugin));
  };
  projection("azure", "claude", ["agents"]);
  projection("azure", "cursor", ["aidlc", "agents"]);
  projection("half", "claude", ["agents"], false);
  return root;
}

describe("t403 release plugins", () => {
  test("a native engine finds them beside its binary", () => {
    delete process.env.AIDLC_RELEASE_PLUGINS_DIR;
    process.env.AIDLC_COMPILED_EXECUTABLE = "/opt/aidlc/versions/9.9.9/aidlc";
    expect(releasePluginsDir()).toBe("/opt/aidlc/versions/9.9.9/plugins");
  });

  test("AIDLC_RELEASE_PLUGINS_DIR wins, and a Bun engine has none without it", () => {
    delete process.env.AIDLC_COMPILED_EXECUTABLE;
    delete process.env.AIDLC_RELEASE_PLUGINS_DIR;
    expect(releasePluginsDir()).toBeNull();
    process.env.AIDLC_RELEASE_PLUGINS_DIR = "/srv/release/plugins";
    expect(releasePluginsDir()).toBe("/srv/release/plugins");
  });

  test("a plugin counts only with its marker and compose hook, per harness", () => {
    const root = releaseFolder();
    process.env.AIDLC_COMPILED_EXECUTABLE = join(root, "versions", "9.9.9", "aidlc");
    delete process.env.AIDLC_RELEASE_PLUGINS_DIR;
    expect(releasePluginNames("claude")).toEqual(["azure"]);
    expect(releasePluginNames("kiro")).toEqual([]);
    expect(releasePluginRoot("azure", "claude")).toBe(join(root, "versions", "9.9.9", "plugins", "azure", "claude"));
    expect(releasePluginRoot("half", "claude")).toBeNull();
    expect(releasePluginRoot("../azure", "claude")).toBeNull();
  });

  test("personas are read where each harness keeps them", () => {
    const root = releaseFolder();
    process.env.AIDLC_RELEASE_PLUGINS_DIR = join(root, "versions", "9.9.9", "plugins");
    for (const harness of ["claude", "cursor"]) {
      expect(releasePluginAgents(harness).map((agent) => [agent.slug, agent.plugin, agent.slot])).toEqual([
        ["azure-platform-agent", "azure", "cloud-platform"],
      ]);
    }
  });
});
