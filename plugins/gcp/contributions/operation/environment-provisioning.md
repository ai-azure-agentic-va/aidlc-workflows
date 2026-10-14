---
target: environment-provisioning
plugin: gcp
fragments:
  - anchor: before-step:1
    order: 100
---

## fragment: before-step:1

**Google Cloud (gcp plugin):** this project's cloud is Google Cloud. Where this stage says AWS environments, provision Google Cloud environments: apply the Construction Terraform into each environment's project, review each `terraform plan` first, and validate the result against organization policy constraints and Security Command Center findings.
