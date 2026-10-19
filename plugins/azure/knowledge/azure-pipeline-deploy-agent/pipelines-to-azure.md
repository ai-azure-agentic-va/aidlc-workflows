# Pipelines to Azure

How the Pipeline-Deploy Agent's CI/CD design lands on Azure. Use it beside its
cicd-patterns guide: that guide says what the pipeline does, this one says which
Azure and GitHub or Azure DevOps feature carries each step.

## AWS to Azure

| Core guide names | Azure counterpart |
|------------------|-------------------|
| CodePipeline and CodeBuild (`buildspec.yml`) | GitHub Actions workflows or Azure Pipelines YAML |
| IAM role assumed by the pipeline | Workload identity federation to a Microsoft Entra app registration or user-assigned managed identity |
| Amazon ECR | Azure Container Registry |
| ECR lifecycle policy | Azure Container Registry purge task (`acr purge`) |
| CodeArtifact | Azure Artifacts feeds with upstream sources, or GitHub Packages |
| S3 for ZIPs, templates, and build outputs | Pipeline artifacts, Blob Storage, or OCI artifacts in the registry (Bicep modules, Helm charts) |
| `cdk synth` | `bicep build` and `bicep lint` (or `terraform validate`) |
| CloudFormation change sets | `az deployment <scope> what-if` (or `terraform plan`) |
| Manual approval in CodePipeline | Environment required reviewers (GitHub) or environment approvals (Azure Pipelines) |
| LocalStack in integration tests | Azurite and the Azure Cosmos DB emulator where they fit; otherwise a short-lived resource group |
| Secrets Manager for pipeline secrets | Key Vault read by the pipeline identity |

## Workload Identity Federation

Create one Microsoft Entra app registration or user-assigned managed identity per
environment, add a federated credential for the pipeline, and grant it a role
on the target resource group. The credential matches its subject exactly.

| Trigger | GitHub subject |
|---------|----------------|
| Job using an environment | `repo:<org>/<repo>:environment:<name>` |
| Branch | `repo:<org>/<repo>:ref:refs/heads/<branch>` |
| Tag | `repo:<org>/<repo>:ref:refs/tags/<tag>` |
| Pull request | `repo:<org>/<repo>:pull_request` |

```yaml
permissions:
  id-token: write
  contents: read
jobs:
  deploy:
    environment: production
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@<pinned version>
      - uses: azure/login@<pinned version>
        with:
          client-id: <client id, from an environment variable>
          tenant-id: <tenant id, from an environment variable>
          subscription-id: <subscription id, from an environment variable>
      - run: az deployment group what-if --resource-group rg-app-prod --parameters prod.bicepparam
```

- Azure Pipelines: an Azure Resource Manager service connection that uses workload identity federation, referenced from the `AzureCLI@2` task
- The three ids are not secrets; no `AZURE_CLIENT_SECRET` exists anywhere in the repository or its settings
- Production's credential accepts only the production environment subject, so a pull request or another branch cannot deploy there
- Pin third-party actions and tasks to a reviewed version or commit SHA
- Targets with public access disabled need an agent inside the network: self-hosted agents, Managed DevOps Pools, or GitHub-hosted runners with Azure private networking (verify availability for the plan and region)

## Container Registry and Artifacts

- Build with `docker build` plus push, or `az acr build`; tag with the commit SHA and never deploy `latest`
- Log in with the federated identity and `az acr login`; the pipeline holds AcrPush, the runtime managed identity holds AcrPull, and the registry admin user stays disabled
- Lock a released tag against overwrite (`az acr repository update --write-enabled false`) where the team requires immutable releases
- Expire untagged and old images with a scheduled `acr purge` task, and keep the tags for the rollback window
- Publish Bicep modules to a private registry with a version tag, and reference them by tag from the templates
- Where provenance is required, produce GitHub artifact attestations or Notation signatures and verify them before deploy
- Tag every artifact with commit SHA, build number, branch, and timestamp, as the core guide asks

## IaC Steps

1. Lint and build: `bicep lint`, `bicep build`, the Azure Security Agent's scans (PSRule for Azure, checkov)
2. Preview: `what-if` at the template's scope (resource group, subscription, or management group), output posted on the pull request
3. Review: a person reads the preview; unexpected deletes block the run
4. Apply: `az deployment <scope> create` or a deployment stack (`az stack`) when deny settings and clean removal are wanted
5. Terraform: `terraform plan` saved as an artifact, `apply` of that saved plan after approval, state in Azure Storage with Microsoft Entra authentication and locking

`what-if` can show noise and cannot predict every outcome; it supports review, it
does not replace the post-deploy policy check.

## Approvals and Environment Checks

| Control | GitHub | Azure Pipelines |
|---------|--------|-----------------|
| Manual approval | Environment required reviewers | Environment approvals |
| Limit which branches deploy | Environment deployment branch and tag rules | Branch control check |
| Delay or window | Environment wait timer | Business hours check |
| One deployment at a time | `concurrency` group in the workflow | Exclusive lock check |
| Health gate on Azure Monitor | A workflow step that queries alerts, or a custom deployment protection rule | Query Azure Monitor alerts check, or an Invoke Azure Function or REST API check |

Verify the repository plan supports environment protection rules on private
repositories before the design relies on them.
