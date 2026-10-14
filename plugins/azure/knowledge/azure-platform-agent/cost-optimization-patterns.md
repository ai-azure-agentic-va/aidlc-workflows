# Azure Cost Optimization Patterns

## Purpose

Cost is designed in, not reviewed after the bill. Use these patterns when
estimating in Infrastructure Design, when sizing in Environment Provisioning,
and when reviewing spend in Feedback & Optimization.

## Compute: Rightsizing

### Process
1. Collect at least two weeks of CPU, memory, and request metrics
2. Read Azure Advisor cost recommendations for the subscription
3. Compare the current SKU with the smallest SKU that meets the NFR targets at peak
4. Resize in non-production first, then production during a low-traffic window

### Common Findings
- App Service plans with one app and a Premium tier it does not need
- VMs sized for a launch peak that never came back
- AKS node pools without the cluster autoscaler

## Pricing Models

### Pay-as-you-go
- Default; right for spiky, new, or short-lived workloads

### Azure Savings Plan for Compute
- A one- or three-year hourly spend commitment across eligible compute services
- Flexible across regions and SKUs; use for steady baseline compute

### Reservations
- A one- or three-year commitment to a specific resource type and region (VMs, Azure SQL Database, Cosmos DB, and others)
- Deepest discount; use only for load that will not move

### Spot Virtual Machines
- Unused capacity at a large discount, evicted at short notice
- For batch, CI agents, and fault-tolerant workers only

### Azure Hybrid Benefit
- Applies existing Windows Server and SQL Server licenses to Azure resources

## Storage: Blob Access Tiers and Lifecycle

### Tiers
| Tier | Use | Minimum retention charge |
|------|-----|--------------------------|
| Hot | Frequent access | none |
| Cool | Infrequent access | 30 days |
| Cold | Rare access, fast retrieval | 90 days |
| Archive | Long-term retention, retrieval in hours | 180 days |

### Rules
- Define a lifecycle management policy on every account that grows: move by last-modified or last-access time, then delete
- Do not archive data the system may need within hours

## Databases

- Azure SQL Database serverless pauses when idle; right for intermittent and non-production databases
- Cosmos DB: serverless for low or spiky traffic; autoscale throughput for variable load; provisioned for steady load
- PostgreSQL flexible server: burstable tiers for dev and test, and stop the server outside working hours

## Serverless and Containers

- Azure Functions consumption plans bill per execution and execution time; watch cold starts against latency NFRs
- Azure Container Apps on the consumption plan scale to zero when idle

## Monitoring Costs

- Log Analytics ingestion is often the largest monitoring cost
- Send verbose, rarely queried tables to the Basic or Auxiliary log plans
- Set retention per table; use sampling in Application Insights
- Set a daily cap on non-production workspaces

## Cost Allocation Tagging

### Required Tags
- `cost-center`, `owner`, `environment`, `workload`

### Enforcement
- Azure Policy requires the tags on resource groups and inherits them onto resources
- Cost analysis groups spend by tag; untagged spend is a finding

## Cost Management

### Budgets and Alerts
- One budget per workload and environment, with alerts at 50%, 80%, and 100% of forecast
- Anomaly alerts on each production subscription

### Monthly Cost Optimization Checklist
- Unattached managed disks and unused public IP addresses
- VMs stopped but not deallocated (still billed for compute)
- Idle App Service plans
- Non-production resources running outside working hours
- Reservation and savings plan utilization below target
