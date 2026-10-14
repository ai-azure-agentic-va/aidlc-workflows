# Azure Infrastructure Guide

## IaC Tool Selection

| Tool | Best For | Considerations |
|------|----------|---------------|
| Bicep | Azure-native teams, day-zero support for new resource types | Azure only; state lives in Azure, not in a file |
| Terraform (azurerm, azapi) | Multi-cloud estates, existing Terraform skills | State file to secure and lock; provider lag on new features (azapi closes it) |
| ARM templates (JSON) | Existing estates already in ARM | Verbose; Bicep compiles to ARM and is preferred for new work |
| Pulumi | Teams wanting general-purpose languages | Smaller Azure community; state backend choice |

Start from Azure Verified Modules (published for both Bicep and Terraform)
before writing a module by hand.

## Landing Zone and Subscription Layout

- Organize subscriptions under management groups; apply Azure Policy and RBAC at the management group
- Separate platform subscriptions (connectivity, identity, management) from workload subscriptions
- Give production its own subscription; keep non-production apart from it
- One resource group per workload, environment, and lifecycle; resources that are deployed and deleted together share a group
- Follow the Cloud Adoption Framework Azure landing zone guidance for a new estate

## Networking

- Hub-and-spoke or Virtual WAN for shared connectivity; Azure Firewall in the hub for egress control
- Private endpoints plus private DNS zones for data services; disable their public network access
- Network security groups on every subnet; deny by default
- Azure Front Door (global) or Application Gateway (regional) with Web Application Firewall for inbound HTTP
- NAT Gateway for predictable outbound IPs

## Compute Selection

| Service | Use it for |
|---------|-----------|
| App Service | Web apps and APIs with little platform work; deployment slots for zero-downtime swaps |
| Azure Functions | Event-driven and scheduled work; consumption-based billing |
| Azure Container Apps | Containers without managing Kubernetes; scale to zero, revisions, KEDA scaling |
| Azure Kubernetes Service | Full Kubernetes control, many services, platform teams |
| Virtual Machines / Scale Sets | Lift-and-shift and software that needs an OS |

## Data and Messaging

- Relational: Azure SQL Database, Azure Database for PostgreSQL flexible server
- Document and global distribution: Azure Cosmos DB
- Objects and files: Azure Blob Storage with lifecycle management
- Messaging: Service Bus (commands and queues), Event Grid (reactive events), Event Hubs (high-volume streams)

## CI/CD Pipeline Design

### Standard Pipeline Stages
```
[Source] -> [Lint] -> [Build] -> [Unit Test] -> [SAST] -> [Package] ->
[IaC What-If] -> [Deploy Staging] -> [E2E Test] -> [Security Scan] ->
[Approval Gate] -> [Deploy Production] -> [Smoke Test] -> [Monitor]
```

### On Azure
- **GitHub Actions**: sign in with `azure/login` using an OpenID Connect federated credential; no stored client secret
- **Azure Pipelines**: use a service connection with workload identity federation
- **Preview**: run `az deployment group what-if` (or `terraform plan`) and publish the result on the pull request
- **Policy**: run PSRule for Azure or checkov on templates before deploying

## Deployment Strategies

### Blue-Green
- App Service: deploy to a staging slot, warm it up, then swap
- **Pro**: Instant swap back on failure

### Canary
- Container Apps: split traffic between revisions by percentage
- Front Door or Traffic Manager: weighted routing between regional stacks
- **Pro**: Limits the blast radius of a bad release

### Rolling
- AKS deployments with `maxSurge` and `maxUnavailable`; virtual machine scale sets with rolling upgrade policy

## Monitoring & Observability Stack

| Need | Azure service |
|------|---------------|
| Metrics and alerts | Azure Monitor metrics, alert rules, action groups |
| Logs | Log Analytics workspace (KQL), diagnostic settings on every resource |
| Traces and application telemetry | Application Insights (workspace-based) with the Azure Monitor OpenTelemetry distro |
| Dashboards | Azure Monitor workbooks, Azure Managed Grafana |
| Platform health | Service Health and Resource Health alerts |

## Environment Strategy

- The same templates deploy every environment; per-environment values live in parameter files (`.bicepparam` or `.tfvars`)
- Environments differ in SKU and instance count, never in topology
- Non-production can scale to zero or shut down out of hours; production cannot
