// The gcp plugin's own content validation: the shared cloud plugin suite,
// with Google Cloud's persona, knowledge, and note text.
//
// Run: bun test plugins/gcp/tests/plugin.test.ts

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cloudPluginSuite } from "../../../tests/harness/cloud-plugin-suite.ts";

cloudPluginSuite({
  plugin: "gcp",
  pluginRoot: join(dirname(fileURLToPath(import.meta.url)), ".."),
  note: "Google Cloud (gcp plugin)",
  knowledge: [
    "cost-optimization-patterns.md",
    "infrastructure-guide.md",
    "terraform-best-practices.md",
    "well-architected-framework.md",
  ],
});
