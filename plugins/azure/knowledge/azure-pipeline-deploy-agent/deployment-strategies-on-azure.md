# Deployment Strategies on Azure

How the Pipeline-Deploy Agent's deployment strategies and rollback rules land on
Azure. Use it beside its deployment-strategies guide: that guide says which
strategy to pick, this one says which Azure mechanism runs it. Hosting features
vary by service tier and plan; verify the tier before a design relies on one.

## Strategy to Azure Mechanism

| Core strategy (AWS mechanism) | Azure mechanism |
|-------------------------------|-----------------|
| Blue/green (CodeDeploy on ECS, Lambda aliases) | Container Apps: new revision at 0% traffic, tested on its revision label, then shifted to 100%. App Service: staging slot, warm-up, swap. AKS: a second Deployment with the Service or ingress switched over |
| Canary (CodeDeploy canary configurations) | Container Apps traffic weights across revisions. App Service slot traffic percentage. AKS weights through a service mesh or Gateway API, or a progressive-delivery controller such as Flagger or Argo Rollouts. Across regions: Azure Front Door origin weights |
| Rolling (ECS minimum healthy percent) | AKS rolling update with `maxSurge` and `maxUnavailable`. Container Apps in single revision mode replaces the revision after the new one is ready. Virtual Machine Scale Sets rolling upgrade policy |
| Feature flags (AppConfig) | Azure App Configuration feature flags with percentage or targeting filters |
| A/B testing (Evidently) | Feature flags plus Application Insights telemetry per variant; verify current experimentation support, because no managed counterpart is assumed |
| Edge routing (CloudFront with Lambda@Edge) | Azure Front Door rule sets routing on header or cookie |
| Alarm-driven automatic rollback | A pipeline step that queries Azure Monitor alerts and shifts traffic back; platform health probes handle only instance-level failures |

## Per-Service Notes

### Azure Container Apps
- Multiple revision mode is required for traffic weights and labels; single revision mode gives a platform-managed zero-downtime replacement
- A template change creates a new revision; the previous revision stays active until it is deactivated, so rollback is a traffic change
- Readiness and startup probes decide when a revision may take traffic; set them before the first canary
- Keep the previous revision active for the rollback window, then deactivate it to stop its cost

### Azure App Service
- Deployment slots need a plan tier that supports them (Standard or above); a slot shares the plan's compute, so load tests on a slot affect production
- Mark settings that must stay with a slot as slot settings; unmarked settings travel with the swap
- Warm up the slot and require its health check path to return healthy before the swap
- After a swap the old production sits in the staging slot; swapping back is the rollback

### Azure Functions
- Use deployment slots only where the hosting plan supports them (verify per plan)
- Where a slot is not available, deploy a new function app and switch traffic at Front Door or API Management

### Azure Kubernetes Service
- Use readiness probes, a `PodDisruptionBudget`, and a termination grace period so a rollout drains connections
- Roll back with `kubectl rollout undo`, or revert the Git commit when Flux reconciles the cluster
- Gate the next step on `kubectl rollout status` returning success
- Run the Flux GitOps extension where the team wants the cluster to converge on a repository

## Pre-Deployment Checks

- The federated login names the expected subscription (`az account show`)
- The `what-if` output was reviewed, with no unexpected deletes
- The region and resource group are approved, and Azure Policy compliance for the target is clean
- The image or package exists with the commit SHA tag, passed its scans, and the previous version is still retained
- The deployment window and freeze rules the team set are met (business hours or wait-timer checks)

## Smoke Tests and Health

- Run smoke tests against the revision label URL or the slot hostname before any traffic shifts
- Confirm the new revision, slot, or rollout reports healthy through its own status, not only the deploy command
- Hold a soak period and compare failure rate and latency with the pre-deploy baseline in Azure Monitor
- Fail the stage when a new Azure Monitor alert fires for the workload during the soak period
- Record the deployed version in telemetry and the activity log, and pass the marker to the Azure Operations Agent

## Rollback

| Mechanism | Rollback |
|-----------|----------|
| Container Apps revision | Move traffic weights back to the previous revision |
| App Service or Functions slot | Swap the slots back |
| AKS Deployment | `kubectl rollout undo`, or revert the commit in the GitOps repository |
| Bicep or ARM template | Redeploy the previous template version; there is no automatic restore of earlier state |
| Terraform | Apply the previous commit's configuration after a new plan review |
| Feature flag | Turn the flag off; no redeploy |

- Keep the previous template version tagged and published so a rollback is one command
- Database changes follow expand-contract: run the expand migration as its own pipeline job before the traffic shift, and never drop or rename in the same release
- Migration jobs run under a database-scoped identity, not an administrator account
