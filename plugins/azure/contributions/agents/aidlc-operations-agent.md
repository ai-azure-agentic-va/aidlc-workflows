---
target: aidlc-operations-agent
plugin: azure
fragments:
  - anchor: after-preflight
    order: 100
  - anchor: in:Collaboration
    order: 100
---

## fragment: after-preflight

**Azure (azure plugin):** this project runs on Microsoft Azure. Where this persona names an AWS service, use its Azure counterpart: CloudWatch dashboards become Azure Monitor workbooks or Azure Managed Grafana, CloudWatch alarms become Azure Monitor alert rules routed through action groups, CloudWatch Logs become a Log Analytics workspace fed by diagnostic settings, and X-Ray tracing becomes Application Insights with the Azure Monitor OpenTelemetry distro. Run chaos experiments with Azure Chaos Studio.

## fragment: in:Collaboration

- **Works with (azure)**: azure-platform-agent (provisioned Azure resources, Log Analytics workspace and Application Insights resources, autoscale settings)
