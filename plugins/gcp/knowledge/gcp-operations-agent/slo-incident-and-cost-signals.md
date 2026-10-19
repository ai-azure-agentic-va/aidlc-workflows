# SLOs, Incidents, and Cost Signals on Google Cloud

How the Operations Agent's SLO, incident, and feedback methods land on Google
Cloud. Use it beside the core slo-sli-patterns and incident-response guides:
they say what to define and decide, this one says which Google Cloud feature
carries it.

## SLOs in Cloud Monitoring Service Monitoring

| Core SLI | Google Cloud SLI | Check |
|----------|------------------|-------|
| Availability | Request-based SLI: good requests over total requests, from `request_count` split on `response_code_class` | Good and total filters are written out in the artifact |
| Latency | Request-based SLI with a distribution cut on `request_latencies` (Cloud Run) or the load balancer latency metric | The threshold equals the NFR, for example 200 ms at the stated percentile |
| Freshness | Windows-based SLI over a metric such as age of the last successful sync | The window length is stated |
| Correctness | Good-over-total SLI on a log-based or custom metric | Invariant that counts as good is written down |

- Services: Cloud Run and App Engine services can be selected in service monitoring; for anything else define a custom service (`google_monitoring_custom_service`)
- Define SLOs as code with `google_monitoring_slo`; the compliance period is rolling (the core 30-day window) rather than calendar, to avoid reset-day gaming
- Probe traffic stays out of the SLI: uptime checks send the user agent `GoogleStackdriverMonitoring-UptimeChecks`, so exclude it in log-based metric SLIs
- Error budget remaining and compliance are read from the service monitoring page or the Cloud Monitoring API, and feed the SLO compliance report in Feedback & Optimization

## Burn-Rate Alerting

- One alerting policy per burn-rate window, using a burn-rate condition on the SLO (the `select_slo_burn_rate` filter takes the SLO and a lookback duration)
- Use the core windows and multipliers (fast, medium, slow) without change; this agent only maps them
- Route fast burn to the pager channel, medium burn to chat in business hours, slow burn to a ticket, by severity label
- Check: each SLO has a policy for every burn-rate tier, and each policy documentation links the runbook

## Availability Checks

- Uptime checks (HTTP, HTTPS, TCP) run from several Google-run locations; alert on `monitoring.googleapis.com/uptime_check/check_passed` and require failure from more than one location
- Internal-only endpoints need a private uptime check, which has network requirements: verify them in the current documentation before promising it
- Synthetic monitors run a scripted journey (login, place order) on a schedule; alert on their failure at P1 like the core canary rule
- Personalized Service Health shows Google Cloud incidents and planned maintenance that affect this project's products: route its events to the on-call path, and use them to rule a provider incident in or out early in an incident (verify the current notification options)

## Incident Tooling

| Core item (AWS name) | Google Cloud | Check |
|----------------------|--------------|-------|
| SNS notification | Notification channel on the alerting policy | Channel tested with a sent test notification |
| Incident Manager, escalation | Paging tool behind a PagerDuty or webhook channel | Escalation and rotation live in the paging tool, named in the plan |
| SSM Automation runbook | Markdown runbook in the repo; automation as a Cloud Run function or Workflows | Runbook link is in the policy documentation |
| EventBridge to Step Functions | Pub/Sub notification channel, then a Cloud Run function or Workflows | Notification service agent can publish to the topic |
| ECS or Lambda restart | Cloud Run: deploy a new revision or send traffic to the previous one; GKE: `kubectl rollout restart` or undo | Remediation identity is scoped to one service |
| RDS failover | Cloud SQL high availability instance, `gcloud sql instances failover` | Failover was rehearsed against the RTO |
| AWS Backup | Cloud SQL automated backups with point-in-time recovery, Spanner backups, Backup and DR Service, Cloud Storage object versioning | Restore tested, not only configured |
| Secret rotation | Secret Manager rotation schedule publishing to Pub/Sub, with a function that applies it | Dependent services reload the new version |
| CloudTrail timeline | Cloud Audit Logs (Admin Activity), Cloud Run revision list, Cloud Deploy rollout history | Timeline names the change that preceded the alert |

- Cap automated remediation (for example three restarts in ten minutes) inside the function or workflow, then page a human
- Multi-AZ targets map to regional resources: regional Cloud SQL high availability, regional GKE, regional managed instance groups; Spanner multi-region for the strictest RPO

## Cost and Feedback Signals

- Budgets: `google_billing_budget` with thresholds on current and forecasted spend, scoped by project or label; a budget notifies, it does not stop spend, so wire its Pub/Sub topic to a human or an automation
- Billing export to BigQuery: enable it early because it records from the day it is turned on (verify), then group by label (`cost-center`, `workload`, `environment`) and by service
- Cost per request: join exported cost by workload label with request counts from Cloud Monitoring; a rising ratio is an efficiency regression for the feedback report
- Cloud Billing anomaly detection flags unusual spend: verify its notification options before relying on it
- Observability cost belongs in the report: Cloud Logging ingestion and retention, custom metric volume, trace spans, and Prometheus samples

## Autoscaling Signals

| Runtime | Signals to watch and tune |
|---------|---------------------------|
| Cloud Run | Request concurrency and CPU utilization drive scaling; watch `container/instance_count`, minimum and maximum instances, and max concurrency against the NFR |
| GKE | Horizontal Pod Autoscaler on CPU, memory, or custom and external metrics; vertical pod autoscaling; cluster autoscaler or Autopilot for nodes |
| Managed instance groups | Autoscaler on CPU, load balancing capacity, a Cloud Monitoring metric, or a schedule |
| Queue consumers | Pub/Sub `oldest_unacked_message_age` or `num_undelivered_messages` as the scaling metric, not CPU |

- Machine-type and idle-resource findings come from Recommender: hand them to the GCP Platform Agent, which owns rightsizing
