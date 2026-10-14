---
target: environment-provisioning
plugin: azure
fragments:
  - anchor: before-step:1
    order: 100
---

## fragment: before-step:1

**Azure (azure plugin):** this project's cloud is Microsoft Azure. Where this stage says AWS environments, provision Azure environments: deploy the Construction templates (Bicep or Terraform) into each environment's subscription and resource groups, preview each deployment with `what-if` first, and validate the result against Azure Policy compliance and Microsoft Defender for Cloud recommendations.
