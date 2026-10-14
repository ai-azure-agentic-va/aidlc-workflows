# Bicep Best Practices

## Purpose

Bicep is the default IaC language for Azure work unless the team's rules name
Terraform. These practices apply to every module the Azure Platform Agent
designs in Infrastructure Design and provisions in Environment Provisioning.
When the team uses Terraform, apply the same rules to its modules.

## Modules

### Rules
- Start from Azure Verified Modules in the public Bicep registry (`br/public:avm/...`); write a custom module only when none fits
- One module per logical unit (network, data, app hosting); a module owns its resources end to end
- Reference resources from other deployments with the `existing` keyword, not by hard-coded resource ID strings
- Let symbolic references create dependencies; add `dependsOn` only where no reference exists

## Parameters and Outputs

### Rules
- Describe every parameter with `@description`; constrain with `@allowed`, `@minValue`, `@maxValue`, `@minLength`
- Keep one `.bicepparam` file per environment; templates stay identical across environments
- Mark secret parameters `@secure()`; never return a secret as an output
- Prefer passing a Key Vault reference over passing a secret value

## Naming

- Follow one naming convention for the whole estate (for example `<type>-<workload>-<env>-<region>`)
- Generate globally unique names with `uniqueString(resourceGroup().id)` rather than random values, so redeployments are stable

## Deployment Scope and Stacks

- Set `targetScope` explicitly: `resourceGroup` for workload resources, `subscription` to create resource groups, `managementGroup` for policy
- Use deployment stacks for workloads so the stack knows what it owns: deny settings stop out-of-band deletes, and removing a resource from the template can remove it from Azure
- Preview every change with `what-if` before applying it

## Security Defaults

### Identity
- Assign a managed identity to every compute resource and grant it the narrowest data-plane role it needs
- Turn off local (key-based) authentication where the service allows it (`disableLocalAuth: true`)

### Storage and Keys
- Storage accounts: `allowBlobPublicAccess: false`, `minimumTlsVersion: 'TLS1_2'`, `supportsHttpsTrafficOnly: true`
- Key Vault: `enableRbacAuthorization: true`, soft delete and purge protection on

### Network
- `publicNetworkAccess: 'Disabled'` on data services, reached through private endpoints
- Network security groups on every subnet

### Logging
- Every resource gets diagnostic settings that send logs and metrics to the workload's Log Analytics workspace

## Testing and Validation

### In the Pipeline
- `bicep lint` (configured in `bicepconfig.json`) fails the build on errors
- PSRule for Azure checks templates against Well-Architected rules
- checkov or the team's chosen scanner for security misconfiguration
- `what-if` output attached to the pull request for review

### What to Test
- Security defaults above are present on every resource that supports them
- Parameter files for each environment compile
- No secret appears in outputs or in plain parameters

## Azure Policy as a Guardrail

### Purpose
Templates express intent; Azure Policy enforces it for every deployment,
including ones that bypass the pipeline.

### Common Assignments
- Microsoft cloud security benchmark initiative (audit)
- Required tags, and inherit tags from the resource group (modify)
- Allowed regions and allowed SKUs (deny)
- Deny public network access on data services
