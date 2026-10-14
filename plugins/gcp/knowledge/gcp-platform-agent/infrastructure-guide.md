# Google Cloud Infrastructure Guide

## IaC Tool Selection

| Tool | Best For | Considerations |
|------|----------|---------------|
| Terraform (google, google-beta) | The default for Google Cloud; multi-cloud estates | State to secure and lock; run it yourself or with Infrastructure Manager |
| Infrastructure Manager | Teams that want Google to run Terraform for them | Same Terraform configurations; managed state and runs |
| Config Connector | Platform teams that manage resources as Kubernetes objects | Needs a GKE cluster; Kubernetes skills |
| Pulumi | Teams wanting general-purpose languages | Smaller Google Cloud community; state backend choice |

Deployment Manager is deprecated; do not start new work on it. Start from the
Cloud Foundation Toolkit modules before writing a module by hand.

## Resource Hierarchy and Landing Zone

- Organization, then folders (for example by environment or business unit), then projects
- One project per workload and environment; production in its own project
- Apply organization policies and IAM at the folder or organization level
- A Shared VPC host project owns the network; workload projects attach as service projects
- Follow Google's landing zone guidance and the enterprise foundations blueprint for a new organization

## Networking

- VPC networks are global; subnets are regional
- Firewall policies at the organization or folder level, plus VPC firewall rules; deny by default
- Private Service Connect and Private Google Access so workloads reach Google APIs without public IPs
- Cloud NAT for outbound traffic from private instances
- Global external Application Load Balancer with Cloud Armor for inbound HTTP; Cloud CDN for cacheable content

## Compute Selection

| Service | Use it for |
|---------|-----------|
| Cloud Run | Containers and HTTP services with little platform work; scale to zero; revisions with traffic splitting |
| Cloud Run functions | Event-driven and scheduled work in a single function |
| GKE Autopilot | Kubernetes without managing nodes |
| GKE Standard | Full Kubernetes control, node-level tuning, platform teams |
| Compute Engine (managed instance groups) | Lift-and-shift and software that needs an OS |

## Data and Messaging

- Relational: Cloud SQL (PostgreSQL, MySQL, SQL Server), AlloyDB for PostgreSQL, Spanner for global scale
- Document: Firestore; wide-column: Bigtable; analytics: BigQuery
- Objects: Cloud Storage with lifecycle rules
- Messaging: Pub/Sub (events and streams), Eventarc (event routing), Cloud Tasks (dispatched work)

## CI/CD Pipeline Design

### Standard Pipeline Stages
```
[Source] -> [Lint] -> [Build] -> [Unit Test] -> [SAST] -> [Package] ->
[Terraform Plan] -> [Deploy Staging] -> [E2E Test] -> [Security Scan] ->
[Approval Gate] -> [Deploy Production] -> [Smoke Test] -> [Monitor]
```

### On Google Cloud
- **Cloud Build**: runs as a dedicated service account with only the roles the pipeline needs
- **GitHub Actions**: authenticate with `google-github-actions/auth` through Workload Identity Federation; no service account key
- **Artifact Registry**: stores images and packages, with vulnerability scanning
- **Cloud Deploy**: promotes releases through targets, with canary rollouts for Cloud Run and GKE
- **Preview**: run `terraform plan` and publish the result on the pull request

## Deployment Strategies

### Blue-Green
- Cloud Run: deploy a revision with no traffic and a tag, test it at its tag URL, then move all traffic

### Canary
- Cloud Run: split traffic between revisions by percentage
- Cloud Deploy: canary phases for Cloud Run and GKE targets
- Managed instance groups: canary updates with a second instance template

### Rolling
- GKE deployments with `maxSurge` and `maxUnavailable`; managed instance group rolling updates

## Monitoring & Observability Stack

| Need | Google Cloud service |
|------|---------------------|
| Metrics, dashboards, alerting | Cloud Monitoring (alerting policies, notification channels, uptime checks, SLOs) |
| Logs | Cloud Logging (log buckets, sinks, Log Analytics) |
| Traces | Cloud Trace, fed by OpenTelemetry |
| Errors and profiles | Error Reporting, Cloud Profiler |
| Audit | Cloud Audit Logs |

## Environment Strategy

- The same Terraform configurations deploy every environment; per-environment values live in `.tfvars` files or workspaces
- Environments differ in machine types and instance counts, never in topology
- Non-production can scale to zero or stop out of hours; production cannot
