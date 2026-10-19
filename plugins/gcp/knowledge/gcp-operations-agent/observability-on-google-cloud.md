# Observability on Google Cloud

How the Operations Agent's observability design lands on Google Cloud
Observability. Use it beside the core observability-patterns guide: that guide
says what to collect and alert on, this one says which Google Cloud feature
carries it. Confirm a metric type in Metrics Explorer before codifying it.

## Pattern to Feature

| Core pattern (AWS name) | Google Cloud feature | Check |
|-------------------------|----------------------|-------|
| CloudWatch metrics, custom metrics | Cloud Monitoring built-in metrics; OpenTelemetry metrics or log-based metrics for business signals | Each custom metric has an owner and a name from the team's convention |
| CloudWatch dashboards | Cloud Monitoring dashboards (`google_monitoring_dashboard`, JSON) | Dashboard is in the IaC; no console-only edits |
| CloudWatch alarms with SNS | Alerting policies with notification channels (`google_monitoring_alert_policy`) | Each policy has a severity label, documentation with a runbook link, and a channel |
| Composite alarms | One alerting policy with several conditions and a combiner (AND or OR) | Paging policies need two agreeing conditions or a duration |
| Metrics Math ratios | Ratio conditions (filter plus denominator filter) or PromQL conditions | Error ratio is a ratio, not a raw count |
| Anomaly detection | No one-to-one feature assumed: use rate-of-change or forecast conditions, or PromQL against `offset 1w`; verify current features before promising a band | The artifact says which stand-in was used |
| Log groups | Log buckets (`_Required`, `_Default`, custom) | Retention is set on every bucket that holds workload logs |
| Logs Insights | Logs Explorer queries; Log Analytics SQL on upgraded buckets | Saved queries live in the IaC or the repo |
| Metric filters | Log-based metrics (counter or distribution) | Labels are low cardinality |
| X-Ray | Cloud Trace fed by OpenTelemetry | Trace ID appears in the logs of the same request |
| Synthetics canaries | Uptime checks; synthetic monitors for scripted journeys | Policy alerts on check failure from more than one location |
| Cross-account observability | Metrics scope on a monitoring project; aggregated sinks to a logging project | Every project in the environment is in the scope |

## Golden Signals on Built-in Metrics

| Signal | Cloud Run | Load balancer or data service |
|--------|-----------|-------------------------------|
| Latency | `run.googleapis.com/request_latencies` (distribution) | `loadbalancing.googleapis.com/https/total_latencies` |
| Traffic | `run.googleapis.com/request_count` | `loadbalancing.googleapis.com/https/request_count` |
| Errors | `request_count` filtered on `response_code_class` 5xx, as a ratio of all requests | Same label on the load balancer metric |
| Saturation | `run.googleapis.com/container/cpu/utilizations`, `container/memory/utilizations`, `container/max_request_concurrencies` | Cloud SQL `cloudsql.googleapis.com/database/cpu/utilization` and `database/disk/utilization`; Pub/Sub `pubsub.googleapis.com/subscription/oldest_unacked_message_age` |

- Measure SLIs at the load balancer when one fronts the service; use Cloud Run request metrics otherwise
- GKE: system and workload logging and monitoring are cluster settings (`logging_config`, `monitoring_config` in Terraform); confirm both are enabled

## Alerting Policy Practice

- Terraform: `google_monitoring_alert_policy`, `google_monitoring_notification_channel`, and a `documentation` block in Markdown that links the runbook
- Severity: set it in `user_labels` and route by it: page channel for P1, chat channel for P2, ticket for P3
- Channels: email, SMS, Slack, PagerDuty, Pub/Sub, webhooks, and the mobile app; Slack and PagerDuty channels carry credentials, so keep them out of the repo
- Evaluation: set a duration so one bad datapoint does not fire; the core "3 out of 5" rule becomes an alignment period plus a duration
- Log-based alerting policies: set a notification rate limit and auto-close so one error storm is one incident
- Metric absence conditions catch a service that stopped reporting; add one for each paging signal

## Logging Practice

- Write JSON to stdout or stderr: `severity` (not `level`), `message`, `logging.googleapis.com/trace` as `projects/PROJECT_ID/traces/TRACE_ID`, and `logging.googleapis.com/spanId`
- `_Required` bucket: Admin Activity and System Event audit logs, fixed retention you cannot change; `_Default`: 30 days unless changed; custom buckets: retention you set
- Retention to propose: 30 days development, 90 days staging, production per the compliance requirement; archive to Cloud Storage with a sink when it must exceed bucket retention
- Aggregated sinks at the folder or organization with children included, to one bucket in a logging project; grant each sink's writer identity the role on its destination (`roles/logging.bucketWriter`, `roles/storage.objectCreator`, `roles/bigquery.dataEditor`, or `roles/pubsub.publisher`)
- Exclusion filters cut cost, but check every log-based metric and log-based alert that reads the excluded logs first
- Data Access audit logs are off by default for most services; enable them on sensitive services only, because volume is the cost

## Traces, Errors, and Profiles

- OpenTelemetry SDK with W3C trace context; set `service.name`, `service.version`, and environment as resource attributes
- Export through the OpenTelemetry Collector with the Google Cloud exporter or the exporter libraries; on Compute Engine run the Ops Agent for system metrics and log files
- Sample on a ratio in production and keep error traces; span attributes carry what X-Ray annotations carried, and no personal data goes in them
- Error Reporting groups log entries that hold a stack trace at ERROR severity; set service and version so errors map to a release
- Cloud Profiler needs an agent in the application: check the language is supported before promising it

## Managed Service for Prometheus

- GKE managed collection scrapes with `PodMonitoring` resources; query with PromQL in Cloud Monitoring, in dashboards, and in alerting policy conditions
- Pricing follows samples ingested: set scrape intervals and drop metrics nobody reads
- Use it when the team already runs Prometheus exporters or Grafana; otherwise built-in metrics are cheaper to run

## Telemetry Permissions

| Identity | Role | Needed when |
|----------|------|-------------|
| Workload service account | `roles/logging.logWriter` | Logs written through the API, not stdout |
| Workload service account | `roles/monitoring.metricWriter` | OpenTelemetry or custom metrics |
| Workload service account | `roles/cloudtrace.agent` | Spans |
| Workload service account | `roles/cloudprofiler.agent` | Profiles |
| Workload service account | `roles/errorreporting.writer` | Errors reported through the API |
| On-call engineers | `roles/monitoring.viewer`, `roles/logging.viewer` | Read access; grant editor roles to the pipeline identity, not people |
