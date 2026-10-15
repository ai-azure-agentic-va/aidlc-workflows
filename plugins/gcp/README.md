# gcp — AI-DLC on Google Cloud

> A first-party **AIDLC plugin**. It puts a GCP Platform Agent on the stages
> the core AWS Platform Agent holds, so infrastructure work designs for Google
> Cloud. Design: [`docs/reference/18-plugin-mechanism.md`](../../docs/reference/18-plugin-mechanism.md#agent-slots).

## 1. What it does

- **Ships `gcp-platform-agent`**, which fills the core `cloud-platform` agent
  slot. While the plugin is on, it leads Infrastructure Design and Environment
  Provisioning and supports Feasibility, Domain Design, Contract Design, NFR
  Design, and Feedback & Optimization, in place of `aidlc-aws-platform-agent`.
- **Ships its knowledge**: the Google Cloud Well-Architected Framework, a
  Google Cloud infrastructure guide, Terraform practice, and Google Cloud cost
  patterns.
- **Adds Google Cloud notes** where core text names AWS services: the
  Operations and Pipeline & Deploy personas, and the Feasibility, Environment
  Provisioning, and Feedback & Optimization stages. Each note is one short
  paragraph that says which Google Cloud service to read for each AWS one.

It adds no stages, scopes, or sensors, and it changes no core file: turning it
off gives every stage back to the AWS agent and removes its notes.

## 2. How to use it

Every AI-DLC release ships this plugin beside its runtime, so a project needs
no plugin install. Choose Google Cloud for the project:

```bash
aidlc config project --cloud gcp --yes
aidlc config project --show        # Cloud: gcp (choices: aws, azure, gcp)
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
/plugin marketplace add <your-repo-or-path>/dist/plugins/gcp/claude
/plugin install aidlc-gcp@aidlc-plugins
# start a fresh session: the SessionStart hook composes the plugin
```

## 3. Layout

```
plugins/gcp/
  .aidlc-plugin/plugin.json                     # manifest
  agents/gcp-platform-agent.md                  # the persona (slot: cloud-platform)
  knowledge/gcp-platform-agent/*.md             # its methodology knowledge
  contributions/agents/aidlc-operations-agent.md
  contributions/agents/aidlc-pipeline-deploy-agent.md
  contributions/ideation/feasibility.md
  contributions/operation/environment-provisioning.md
  contributions/operation/feedback-optimization.md
  tests/plugin.test.ts                          # content suite (tests/harness/cloud-plugin-suite.ts)
```

## 4. Validate and test

```bash
bun dist/claude/.claude/tools/aidlc-plugin-validate.ts plugins/gcp
bun scripts/package.ts                      # emits dist/plugins/gcp/<harness>/
bun test plugins/gcp/tests/plugin.test.ts   # composes on all seven harnesses
```
