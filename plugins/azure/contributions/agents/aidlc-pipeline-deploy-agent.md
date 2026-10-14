---
target: aidlc-pipeline-deploy-agent
plugin: azure
fragments:
  - anchor: after-preflight
    order: 100
  - anchor: in:Collaboration
    order: 100
---

## fragment: after-preflight

**Azure (azure plugin):** this project deploys to Microsoft Azure. Pipelines sign in with workload identity federation (an OpenID Connect federated credential for GitHub Actions, or an Azure Pipelines service connection), never with a stored client secret. Preview every infrastructure change with `what-if` (or `terraform plan`) and publish it on the pull request. Use App Service deployment slots for blue-green swaps and Container Apps revisions with traffic splitting for canary releases.

## fragment: in:Collaboration

- **Works with (azure)**: azure-platform-agent (target subscriptions and resource groups, deployment identities and their role assignments, environment endpoints)
