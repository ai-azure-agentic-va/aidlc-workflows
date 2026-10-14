# Google Cloud Well-Architected Framework

## Purpose

The Google Cloud Well-Architected Framework is the review standard for every
infrastructure decision on Google Cloud. Use it in Feasibility to surface risks
early, in NFR Design and Infrastructure Design to justify service choices, and
in Feedback & Optimization to compare the running system against its targets.

## Pillars Overview

| Pillar | Question it answers |
|--------|---------------------|
| Operational excellence | Can the team deploy, observe, and change it safely? |
| Security, privacy, and compliance | Is the workload protected, with least access and the controls its regulations need? |
| Reliability | Does the workload meet its availability and recovery targets? |
| Cost optimization | Does the workload deliver its value at the lowest sensible cost? |
| Performance optimization | Does it scale to demand without waste? |

Google also publishes sustainability guidance. Record carbon-relevant choices
(region carbon data, right-sizing, scale-to-zero) alongside cost and
performance decisions.

## Operational Excellence

### Key Questions
- Can every environment be rebuilt from code?
- How are changes rolled out, and how are they rolled back?
- How does the team learn about a problem before users do?

### Best Practices
- Define everything in Terraform; treat console changes as drift
- Roll out progressively: Cloud Run revision traffic splitting, Cloud Deploy canary, or managed instance group canary updates
- Route logs into log buckets with set retention; alert from Cloud Monitoring on symptoms users feel
- Define SLOs in Cloud Monitoring and alert on error-budget burn rate
- Keep runbooks next to the alerting policies that need them

### Common Anti-Patterns
- A "temporary" console fix that the next `terraform apply` silently reverts
- Alerting policies that fire on every CPU spike

## Security, Privacy, and Compliance

### Key Questions
- How does every workload and pipeline authenticate, and with what roles?
- Which endpoints are reachable from the public internet, and why?
- Where are secrets and keys kept, and who can read them?

### Best Practices
- Attach dedicated service accounts to workloads; never download service account keys
- Use Workload Identity Federation for CI systems and Workload Identity Federation for GKE for pods
- Grant predefined or custom roles on the narrowest resource; avoid basic roles
- Keep secrets in Secret Manager; use Cloud KMS customer-managed keys when regulations require them
- Enforce guardrails with organization policies (for example, no external IPs, no service account key creation, allowed regions)
- Protect sensitive data services with VPC Service Controls perimeters
- Turn on Security Command Center and review its findings

### Common Anti-Patterns
- A service account key checked into CI secrets
- Editor granted to a default service account
- Cloud Storage buckets without uniform bucket-level access

## Reliability

### Key Questions
- What are the availability target (SLO) and the recovery targets (RTO, RPO)?
- Which components are zonal, and what happens when a zone or region fails?

### Best Practices
- Prefer regional resources: regional managed instance groups, regional GKE clusters, Cloud SQL high availability
- Use multi-region services (Cloud Storage dual- or multi-region, Spanner multi-region) when the RPO demands it
- Put global external Application Load Balancers in front of multi-region backends
- Add health checks, retries with exponential backoff, and timeouts on every call
- Back up data and rehearse the restore

### Common Anti-Patterns
- A single-zone database behind a regional application tier
- Backups that are never restored in a drill

## Cost Optimization

### Key Questions
- What does each environment cost per month, and who owns that cost?
- Which resources run when nobody uses them?
- Which commitments match stable usage?

### Best Practices
- Estimate with the Google Cloud Pricing Calculator before provisioning
- Label every resource for cost allocation and export billing data to BigQuery
- Set Cloud Billing budgets with alerts per workload
- Right-size from Recommender findings; prefer autoscaling and scale-to-zero
- Buy committed use discounts only for proven steady load

### Common Anti-Patterns
- Production-sized machine types in dev and test
- Verbose logs ingested and retained that nobody reads

## Performance Optimization

### Key Questions
- What load must the system carry at peak, and how does it scale?
- Where are the hot paths, and what caches them?

### Best Practices
- Scale out with managed instance group or Cloud Run autoscaling on the signals that track load
- Cache at the edge with Cloud CDN and in the application tier with Memorystore
- Load test before launch and compare against NFR targets
- Choose regions close to users and data

## Well-Architected Review Process

### When to Conduct
- At Feasibility, for the overall direction
- At NFR Design and Infrastructure Design, for each Unit with infrastructure
- At Feedback & Optimization, against the running system

### Steps
1. List the workload's critical flows and their NFR targets
2. Walk each pillar's key questions against the design or the running system
3. Read Recommender and Security Command Center findings for the projects
4. Record each finding with its risk, the pillar it affects, and the trade-off taken
5. Turn accepted findings into backlog items with owners
