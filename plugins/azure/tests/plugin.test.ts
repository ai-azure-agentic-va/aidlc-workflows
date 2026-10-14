// The azure plugin's own content validation: the shared cloud plugin suite,
// with Azure's persona, knowledge, and note text.
//
// Run: bun test plugins/azure/tests/plugin.test.ts

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cloudPluginSuite } from "../../../tests/harness/cloud-plugin-suite.ts";

cloudPluginSuite({
  plugin: "azure",
  pluginRoot: join(dirname(fileURLToPath(import.meta.url)), ".."),
  note: "Azure (azure plugin)",
  knowledge: [
    "bicep-best-practices.md",
    "cost-optimization-patterns.md",
    "infrastructure-guide.md",
    "well-architected-framework.md",
  ],
});
