# Azure Well-Architected Framework

## Purpose

The Azure Well-Architected Framework is the review standard for every
infrastructure decision on Azure. Use it in Feasibility to surface risks early,
in NFR Design and Infrastructure Design to justify service choices, and in
Feedback & Optimization to compare the running system against its targets.

## Five Pillars Overview

| Pillar | Question it answers |
|--------|---------------------|
| Reliability | Does the workload meet its availability and recovery targets? |
| Security | Is the workload protected against threats, with least access? |
| Cost Optimization | Does the workload deliver its value at the lowest sensible cost? |
| Operational Excellence | Can the team deploy, observe, and change it safely? |
| Performance Efficiency | Does it scale to demand without waste? |

Azure has no separate sustainability pillar; sustainability guidance is a
workload perspective. Record carbon-relevant choices (region, right-sizing,
scale-to-zero) under Cost Optimization and Performance Efficiency.

## Pillar 1: Reliability

### Key Questions
- What are the availability target (SLO) and the recovery targets (RTO, RPO)?
- Which components are single points of failure?
- What happens when an availability zone or a region fails?

### Best Practices
- Use availability zones; prefer zone-redundant SKUs where the service offers them
- Compute the composite SLA of the critical path, not just each service's SLA
- Add health probes, retries with exponential backoff, and circuit breakers
- Protect data with Azure Backup and point-in-time restore; test the restore
- For regional failover, pair Azure Front Door or Traffic Manager with replicated data
- Run failure-mode analysis and fault experiments with Azure Chaos Studio

### Common Anti-Patterns
- A zonal SKU in production because it was the template default
- Backups that are never restored in a drill
- Failover that depends on a manual portal step nobody has rehearsed

## Pillar 2: Security

### Key Questions
- How does every service and pipeline authenticate, and with what scope?
- Which endpoints are reachable from the public internet, and why?
- Where are secrets, keys, and certificates kept and rotated?

### Best Practices
- Apply Zero Trust: identity is the primary perimeter
- Use Microsoft Entra ID with managed identities for services and workload identity federation for pipelines
- Grant Azure RBAC roles at the narrowest scope; use Privileged Identity Management for elevated access
- Keep secrets, keys, and certificates in Azure Key Vault with RBAC authorization, soft delete, and purge protection
- Use Private Link and private endpoints for data services; disable public network access where possible
- Enable Microsoft Defender for Cloud and track the secure score against the Microsoft cloud security benchmark
- Enforce guardrails with Azure Policy at the management group

### Common Anti-Patterns
- Connection strings with account keys in app settings
- A service principal with Contributor on the whole subscription
- Storage accounts with public blob access left on

## Pillar 3: Cost Optimization

### Key Questions
- What does each environment cost per month, and who owns that cost?
- Which resources run when nobody uses them?
- Which commitments (reservations, savings plan) match stable usage?

### Best Practices
- Estimate with the Azure Pricing Calculator before provisioning
- Tag every resource for cost allocation and enforce tags with Azure Policy
- Set Cost Management budgets and anomaly alerts per workload
- Right-size from Azure Advisor and real metrics; prefer autoscale and scale-to-zero
- Buy reservations or an Azure savings plan for compute only for proven steady load

### Common Anti-Patterns
- Production-sized SKUs in dev and test
- Log Analytics ingestion nobody reads
- VMs stopped from inside the OS but still allocated, and still billed

## Pillar 4: Operational Excellence

### Key Questions
- Can every environment be rebuilt from code?
- How are changes rolled out, and how are they rolled back?
- How does the team learn about a problem before users do?

### Best Practices
- Define everything in Bicep or Terraform; treat portal changes as drift
- Use safe deployment practices: progressive exposure through rings, slots, or revisions
- Send diagnostic settings for every resource to a Log Analytics workspace
- Alert on symptoms users feel; route alerts through action groups
- Keep runbooks next to the alerts that need them

### Common Anti-Patterns
- A "temporary" manual fix that the next deployment silently reverts
- Alerts that page on every CPU spike

## Pillar 5: Performance Efficiency

### Key Questions
- What load must the system carry at peak, and how does it scale?
- Where are the hot paths, and what caches them?

### Best Practices
- Scale out rather than up; configure autoscale on the signals that track load
- Cache at the edge with Azure Front Door and in the application tier
- Load test before launch with Azure Load Testing and compare against NFR targets
- Choose regions close to users and data

### Common Anti-Patterns
- Autoscale rules that scale out but never scale in
- Chatty calls across regions on the critical path

## Well-Architected Review Process

### When to Conduct
- At Feasibility, for the overall direction
- At NFR Design and Infrastructure Design, for each Unit with infrastructure
- At Feedback & Optimization, against the running system

### Steps
1. List the workload's critical flows and their NFR targets
2. Walk each pillar's key questions against the design or the running system
3. Read Azure Advisor recommendations and the Advisor score for each pillar
4. Record each finding with its risk, the pillar it affects, and the trade-off taken
5. Turn accepted findings into backlog items with owners
