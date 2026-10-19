---
target: aidlc-pipeline-deploy-agent
plugin: gcp
fragments:
  - anchor: after-preflight
    order: 100
  - anchor: in:Collaboration
    order: 100
---

## fragment: after-preflight

**Google Cloud (gcp plugin):** this project deploys to Google Cloud. Pipelines authenticate through Workload Identity Federation (or run in Cloud Build as a dedicated service account), never with a downloaded service account key. Store images in Artifact Registry. Preview every infrastructure change with `terraform plan` and publish it on the pull request. Use Cloud Run revision traffic splitting or Cloud Deploy canary phases for progressive releases.

## fragment: in:Collaboration

- **Works with (gcp)**: gcp-platform-agent (target projects, deployment service accounts and their roles, environment endpoints), gcp-pipeline-deploy-agent (Workload Identity Federation, Cloud Build, Artifact Registry, Cloud Deploy, rollouts, and Binary Authorization; it owns how this persona's method lands on Google Cloud)
