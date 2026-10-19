# Azure Monitor Observability

How the Operations Agent's observability and SLO requirements land on Azure. Use
it beside the Operations Agent's observability-patterns and slo-sli-patterns
guides: those say what to measure and alert on, this one says which Azure
feature carries it.

## AWS to Azure

| Core guide names | Azure counterpart |
|------------------|-------------------|
| CloudWatch Metrics | Azure Monitor metrics (platform metrics, plus custom metrics from the application) |
| Embedded Metric Format custom metrics | OpenTelemetry metrics exported by the Azure Monitor OpenTelemetry distro to Application Insights |
| CloudWatch Logs and log groups | Log Analytics workspace tables, fed by diagnostic settings and data collection rules |
| CloudWatch Logs Insights | Kusto Query Language (KQL) in Log Analytics |
| X-Ray | Application Insights distributed tracing, Application Map, end-to-end transaction view |
| Dashboards | Azure Monitor workbooks, or Azure Managed Grafana |
| Alarms, SNS notifications | Azure Monitor alert rules and action groups |
| Composite alarms | A log search alert rule whose query combines the conditions |
| Anomaly Detection | Dynamic thresholds on metric alerts; `series_decompose_anomalies` in KQL |
| CloudWatch Synthetics canaries | Application Insights availability tests |
| Contributor Insights | KQL `summarize` and `top` over the log table |
| Cross-account log aggregation | A central workspace, or cross-workspace KQL queries |
| Log retention and S3 or Glacier archive | Workspace retention, long-term retention, and data export to a storage account |

## Telemetry Setup Checks

- A diagnostic setting sends each resource's logs and metrics to the workspace; Azure Policy with a deploy-if-not-exists effect covers resources created later
- Application Insights is workspace-based and points at the environment's workspace
- Each service sets a cloud role name and a version resource attribute, so the Application Map and the incident timeline show which build ran
- W3C trace context is propagated through every HTTP and messaging hop; a service that drops it breaks the trace
- Structured logs carry the trace and operation id so a log line joins its request
- AKS clusters send metrics to the managed Prometheus service and container logs to the workspace; Managed Grafana reads both

## Alert Design

- Alert on symptoms (error rate, latency percentile, availability test failure), not causes such as CPU alone
- Azure Monitor alert severity runs 0 (Critical) to 4 (Verbose); record the mapping to SEV1 to SEV4 and to P1 to P3 in one place
- Metric alerts: pick the aggregation and an evaluation window that tolerates a transient spike (for example three of five periods)
- Log search alerts: make the query return the measure you alert on, and check the evaluation frequency against the cost of running it
- Action groups hold the receivers (email, SMS, voice, push, webhook, Logic App, Automation runbook, Azure Function); one group per severity route, defined in the IaC
- Alert processing rules silence planned maintenance and route by scope without editing each rule
- Service Health alerts use the same action groups as application alerts

## SLI and SLO Queries

An SLI is a query you own. Availability from a workspace-based Application Insights resource:

```
AppRequests
| where TimeGenerated > ago(30d)
| summarize total = count(), good = countif(Success == true) by bin(TimeGenerated, 1h)
| extend availability = 100.0 * good / total
```

Slow requests, and request count by status code:

```
AppRequests
| where DurationMs > 1000
| top 20 by DurationMs desc

AppRequests
| summarize count() by ResultCode
```

- Application Insights decides `Success` from the status code; check how it classifies 4xx responses and compute from `ResultCode` when the SLI definition differs
- Exclude availability test traffic and health probes from the SLI
- Burn-rate alerts: one log search alert rule per window pair (for example 1 hour with 5 minutes, 6 hours with 30 minutes), each evaluating the error ratio against the budget
- Show the SLO, the budget remaining, and the burn trend on the workbook; Managed Grafana works where the team already uses it
- Record the table, filter, and window with the SLO so the measurement can be reproduced

## Availability Tests and Synthetic Checks

- Use standard availability tests from several locations for public endpoints, or a custom availability test for private or multi-step journeys
- Verify the test type against current Microsoft documentation before choosing; older test types have been retired
- Alert on test failure from more than one location, and route it as the user-facing severity
- A workload on a private network needs a test that can reach it; place the test or its runner inside the network

## Retention and Cost

- Set retention per table; keep audit and security tables long, and verbose application tables short
- Use the Basic or Auxiliary table plans and data collection rule transformations for high-volume, low-value logs
- Use a daily cap only on non-production workspaces, since a cap stops collection
- Review the workspace's largest tables monthly and drop fields or sampling that nobody queries
- Export to a storage account for retention beyond what the workspace should hold
