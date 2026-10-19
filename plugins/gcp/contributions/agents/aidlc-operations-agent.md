---
target: aidlc-operations-agent
plugin: gcp
fragments:
  - anchor: after-preflight
    order: 100
  - anchor: in:Collaboration
    order: 100
---

## fragment: after-preflight

**Google Cloud (gcp plugin):** this project runs on Google Cloud. Where this persona names an AWS service, use its Google Cloud counterpart: CloudWatch dashboards become Cloud Monitoring dashboards, CloudWatch alarms become Cloud Monitoring alerting policies with notification channels, CloudWatch Logs become Cloud Logging log buckets and sinks, and X-Ray tracing becomes Cloud Trace fed by OpenTelemetry. Track SLOs with Cloud Monitoring service monitoring.

## fragment: in:Collaboration

- **Works with (gcp)**: gcp-platform-agent (provisioned Google Cloud resources, log buckets and sinks, autoscaling settings), gcp-operations-agent (Google Cloud Observability signals, alerting policies, SLOs, and cost signals; it owns how this persona's method lands on Google Cloud)
