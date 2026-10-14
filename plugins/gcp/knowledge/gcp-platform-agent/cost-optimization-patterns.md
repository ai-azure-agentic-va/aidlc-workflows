# Google Cloud Cost Optimization Patterns

## Purpose

Cost is designed in, not reviewed after the bill. Use these patterns when
estimating in Infrastructure Design, when sizing in Environment Provisioning,
and when reviewing spend in Feedback & Optimization.

## Compute: Rightsizing

### Process
1. Collect at least two weeks of CPU, memory, and request metrics
2. Read Recommender machine-type and idle-resource recommendations for the projects
3. Compare the current machine type with the smallest one that meets the NFR targets at peak
4. Resize in non-production first, then production during a low-traffic window

### Common Findings
- Instances sized for a launch peak that never came back
- GKE Standard node pools without the cluster autoscaler
- Cloud Run services with minimum instances set higher than latency needs

## Pricing Models

### On-Demand
- Default; right for spiky, new, or short-lived workloads

### Sustained Use Discounts
- Applied automatically to eligible Compute Engine machine types that run for a large part of the month

### Committed Use Discounts
- Resource-based: a one- or three-year commitment to vCPUs and memory in a region
- Spend-based: a one- or three-year commitment to a spend level on eligible services
- Use only for proven steady load

### Spot VMs
- Spare capacity at a large discount, preempted at short notice
- For batch, CI workers, and fault-tolerant jobs only

## Storage: Cloud Storage Classes and Lifecycle

### Classes
| Class | Use | Minimum storage duration |
|-------|-----|--------------------------|
| Standard | Frequent access | none |
| Nearline | About once a month | 30 days |
| Coldline | About once a quarter | 90 days |
| Archive | Less than once a year | 365 days |

### Rules
- Define lifecycle rules on every bucket that grows: change class by age, then delete
- Use Autoclass when access patterns are unknown
- Retrieval from colder classes has a per-GB charge; do not archive data read often

## Databases and Analytics

- Cloud SQL: right-size the instance, and stop non-production instances outside working hours
- Spanner: size by processing units and scale with load
- BigQuery: partition and cluster tables; select only the columns needed; choose on-demand or capacity pricing by workload shape

## Serverless and Containers

- Cloud Run bills while a request is handled (or for the instance with CPU always allocated); scale to zero when idle
- GKE Autopilot bills for the resources pods request; set requests to what pods use

## Monitoring Costs

- Cloud Logging ingestion and retention are often the largest observability cost
- Exclude noisy logs with exclusion filters on the sinks
- Set retention per log bucket to what audits and investigations need

## Cost Allocation Labels

### Required Labels
- `cost-center`, `owner`, `environment`, `workload`

### Enforcement
- Apply labels in Terraform modules; check for them in the pipeline
- Group spend by label in Cloud Billing reports; unlabeled spend is a finding

## Budgets and Billing Data

### Budgets and Alerts
- One Cloud Billing budget per workload and environment, with alerts at 50%, 80%, and 100% of forecast
- Route budget alerts to Pub/Sub when automation must act on them

### Billing Export
- Export detailed billing data to BigQuery for cost-per-transaction and trend analysis

### Monthly Cost Optimization Checklist
- Unattached persistent disks and unused static IP addresses
- Idle instances and idle Cloud SQL instances flagged by Recommender
- Non-production resources running outside working hours
- Committed use discount utilization below target
- Log buckets retaining more than their audit need
