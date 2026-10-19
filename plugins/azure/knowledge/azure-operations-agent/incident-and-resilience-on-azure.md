# Incident and Resilience on Azure

How the Operations Agent's incident, chaos, scaling, and feedback requirements
land on Azure. Use it beside the Operations Agent's incident-response-guide:
that guide says what the process is, this one says which Azure tool carries
each step.

## AWS to Azure

| Core guide names | Azure counterpart |
|------------------|-------------------|
| SNS notification to on-call | Action group (email, SMS, voice, push, or a webhook to the paging tool) |
| SSM Automation runbooks | Azure Automation runbooks, Logic Apps workflows, or Azure Functions, run as a managed identity |
| EventBridge rule plus Step Functions remediation | Activity log or metric alert to an action group, then a Logic Apps workflow or Durable Functions |
| Lambda remediation from an alarm | Action group calling an Azure Function or Automation runbook |
| AWS Health Dashboard | Service Health (Azure-wide events) and Resource Health (one resource) |
| Auto Scaling policies on custom metrics | Azure Monitor autoscale, Container Apps scale rules (KEDA), AKS autoscaler and KEDA |
| Fault Injection Service | Azure Chaos Studio |
| Secrets Manager credential rotation | Key Vault rotation policy, or a near-expiry Event Grid event handled by a function |
| Cost Explorer, Budgets, Compute Optimizer | Cost Management cost analysis and budgets, Azure Advisor right-sizing |
| Multi-AZ failover | Zone-redundant service tiers, plus the service's own failover operation |

## Detection to Response

1. An alert rule fires and the action group notifies the on-call tool by severity
2. The responder checks Service Health and Resource Health for an Azure-side cause before the application
3. The Application Insights Application Map and end-to-end transaction view locate the failing dependency
4. The activity log and Azure Resource Graph change history show what changed in the window before the alert
5. Mitigation is a runbook, a traffic shift, a slot swap, or a rollback, whichever the runbook names
6. The postmortem attaches the alert history, the transaction evidence, and the change list

## Runbook Checks

- Runbooks live in source control and deploy through the IaC pipeline; a portal-only runbook is drift
- The runbook runs as a managed identity with a role scoped to the resources it touches, never as a person's credentials
- Each runbook counts its own attempts and stops after the limit (for example three restarts in ten minutes), because an alert can fire again after it resolves
- A runbook writes what it did to the incident record and to a log table the team can query
- A runbook that changes data or scale is tested in a non-production environment before an alert may start it

## Chaos Studio Checklist

- The target resource is onboarded to Chaos Studio with the capabilities the experiment needs
- The experiment has a managed identity, and that identity holds a role on each target
- Each fault comes from the Chaos Studio fault library for that target type (service-direct or agent-based); check the library rather than assuming a fault exists
- A steady-state query (an SLI) is written before the run, and the experiment is cancelled when an SLO alert fires
- Non-production first; production only with the team's recorded approval and a named responder
- The result, the resilience gap, and the remediation owner are written to the feedback report

## Autoscale and Capacity Checks

- Every scale-out rule has a scale-in rule, with minimum and maximum counts set
- The scale signal reflects load (queue depth, request rate, concurrency), not only CPU
- Cool-down is long enough that the service does not oscillate
- The maximum count fits the subscription's quota in that region
- Scale actions are visible in the activity log and on the workbook beside the load signal

## Recovery Targets

- State each tier's RTO and RPO and name the Azure mechanism that meets it: zone redundancy, geo-replication, Azure Backup, or Azure Site Recovery
- The Azure Platform Agent designs the mechanism; this agent tests it in a game day and records the measured recovery time
- Confirm the recovery region keeps data inside the residency boundary the Azure Compliance Agent recorded

## Cost and Feedback Signals

- Cost Management budgets alert through an action group at percentage thresholds of the monthly budget
- Cost anomaly alerts flag a spend shift that a budget would not catch
- Cost analysis grouped by the allocation tags gives cost per workload; divide by request count for cost per transaction
- Azure Advisor reliability, performance, and cost recommendations enter the feedback report with the evidence behind each
- A rise in Log Analytics ingestion is read as a telemetry cost finding and reviewed with the table list
