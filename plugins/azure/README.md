# azure — AI-DLC on Microsoft Azure

> A first-party **AIDLC plugin**. It puts an Azure Platform Agent on the
> stages the core AWS Platform Agent holds, so infrastructure work designs for
> Microsoft Azure. Design: [`docs/reference/18-plugin-mechanism.md`](../../docs/reference/18-plugin-mechanism.md#agent-slots).

## 1. What it does

- **Ships `azure-platform-agent`**, which fills the core `cloud-platform` agent
  slot. While the plugin is on, it leads Infrastructure Design and Environment
  Provisioning and supports Feasibility, Domain Design, Contract Design, NFR
  Design, and Feedback & Optimization, in place of `aidlc-aws-platform-agent`.
- **Ships four specialists** that stand beside the core persona of the same
  trade on the cloud stages and replace none of them: `azure-security-agent`
  (beside DevSecOps), `azure-compliance-agent` (beside Compliance),
  `azure-operations-agent` (beside Operations), and
  `azure-pipeline-deploy-agent` (beside Pipeline & Deploy). Each lists its
  stages in `supports:`, so graph compile adds it to them while the plugin is
  on ([Agent supports](../../docs/reference/18-plugin-mechanism.md#agent-supports)).
  The core persona keeps its method and knowledge; the specialist carries only
  what Azure adds.
- **Ships its knowledge**: the Azure Well-Architected Framework, an Azure
  infrastructure guide, Bicep practice, and Azure cost patterns.
- **Adds Azure notes** where core text names AWS services: the Operations,
  Pipeline & Deploy, DevSecOps, and Compliance personas, and the Feasibility,
  Environment Provisioning, and Feedback & Optimization stages. Each note is
  one short paragraph that says which Azure service to read for each AWS one.

It adds no stages, scopes, or sensors, and it changes no core file: turning it
off gives every stage back to the AWS agent and removes its specialists and notes.

## 2. How to use it

Every AI-DLC release ships this plugin beside its runtime, so a project needs
no plugin install. Choose Azure for the project:

```bash
aidlc config project --cloud azure --yes
aidlc config project --show        # Cloud: azure (choices: aws, azure, gcp)
```

The command sets the plugin up from the copy the release ships, and every
later `aidlc config` keeps it on the project's release. `--cloud aws` gives
the stages back to the AWS agent. Only one cloud plugin is on at a time;
`--cloud` turns the others off.

A copy-channel project has no release beside it. There, install the plugin
through your host, the way any AIDLC plugin is installed (see
[Distribution + install](../../docs/harness-engineering/10-authoring-a-plugin.md#5-distribution--install)),
then run the same `--cloud`. For Claude Code:

```
/plugin marketplace add <your-repo-or-path>/dist/plugins/azure/claude
/plugin install aidlc-azure@aidlc-plugins
# start a fresh session: the SessionStart hook composes the plugin
```

## 3. Layout

```
plugins/azure/
  .aidlc-plugin/plugin.json                     # manifest
  agents/azure-platform-agent.md                # the persona (slot: cloud-platform)
  agents/azure-<trade>-agent.md                  # four specialists (supports: [stages]): security, compliance, operations, pipeline-deploy
  knowledge/azure-platform-agent/*.md           # its methodology knowledge
  knowledge/azure-<trade>-agent/*.md            # each specialist's knowledge
  contributions/agents/aidlc-{operations,pipeline-deploy,devsecops,compliance}-agent.md
  contributions/ideation/feasibility.md
  contributions/operation/environment-provisioning.md
  contributions/operation/feedback-optimization.md
  tests/plugin.test.ts                          # content suite (tests/harness/cloud-plugin-suite.ts)
```

## 4. Validate and test

```bash
bun dist/claude/.claude/tools/aidlc-plugin-validate.ts plugins/azure
bun scripts/package.ts                        # emits dist/plugins/azure/<harness>/
bun test plugins/azure/tests/plugin.test.ts   # composes on all seven harnesses
```
