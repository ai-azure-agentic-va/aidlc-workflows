# Terraform Best Practices on Google Cloud

## Purpose

Terraform is the default IaC tool for Google Cloud work. These practices apply
to every configuration the GCP Platform Agent designs in Infrastructure Design
and provisions in Environment Provisioning.

## Modules

### Rules
- Start from the Cloud Foundation Toolkit modules (`terraform-google-modules`); write a custom module only when none fits
- One module per logical unit (network, data, app hosting); a module owns its resources end to end
- Pin provider and module versions; upgrade them on purpose, in their own change
- Read resources owned elsewhere with data sources or remote state outputs, never with hard-coded IDs

## Variables and Outputs

### Rules
- Give every variable a `description` and a `type`; add `validation` blocks for constrained values
- Keep one `.tfvars` file per environment; configurations stay identical across environments
- Mark secret variables and outputs `sensitive = true`; prefer reading secrets from Secret Manager at runtime over passing them through Terraform

## State

- Keep state in a Cloud Storage bucket with object versioning on and uniform bucket-level access
- One state per configuration and environment; never share state between environments
- Restrict who can read the state bucket: state can hold sensitive values
- Or let Infrastructure Manager run Terraform and keep state for you

## Naming and Labels

- Follow one naming convention for the whole estate (for example `<workload>-<env>-<region>-<type>`)
- Apply labels for cost allocation (`cost-center`, `owner`, `environment`, `workload`) through a shared local or module input

## Security Defaults

### Identity
- Create a dedicated service account for each workload; grant roles on the narrowest resource
- Never create service account keys in Terraform; use attached service accounts and Workload Identity Federation

### Storage and Keys
- Cloud Storage: `uniform_bucket_level_access = true`, `public_access_prevention = "enforced"`
- Use Cloud KMS customer-managed keys when regulations require them

### Network
- Private IP for Cloud SQL and other data services; no public IPs on instances
- Firewall rules deny by default; open only what the design names

### Logging
- Keep Cloud Audit Logs on; set log bucket retention and sinks in code

## Testing and Validation

### In the Pipeline
- `terraform fmt -check` and `terraform validate` fail the build on errors
- tflint and checkov (or the team's chosen scanner) for misconfiguration
- `terraform plan` output attached to the pull request for review
- Apply from the pipeline only, with a service account that has the roles the plan needs

### What to Test
- Security defaults above are present on every resource that supports them
- Each environment's `.tfvars` plans cleanly
- No secret appears in outputs or in plain variables

## Organization Policies as a Guardrail

### Purpose
Configurations express intent; organization policies enforce it for every
change, including ones that bypass the pipeline.

### Common Constraints
- Disable service account key creation
- Restrict which resource locations are allowed
- Require uniform bucket-level access and public access prevention on Cloud Storage
- Restrict external IP addresses on VM instances
