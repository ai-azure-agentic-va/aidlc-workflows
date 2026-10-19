# Azure Identity and Network Controls

How a security requirement lands on Azure. Use it beside the DevSecOps Agent's
security-guide: that guide says what to require, this one says which Azure
control meets it.

## Requirement to Control

| Requirement | Azure control | Check |
|-------------|---------------|-------|
| Least-privilege access for people | Microsoft Entra groups, Azure RBAC at the narrowest scope, Privileged Identity Management for elevated roles | No standing Owner or Contributor on a subscription for a person |
| Least-privilege access for workloads | Managed identity with a scoped role assignment | No client secret or connection string with a key in app settings |
| Pipeline access to Azure | Workload identity federation (OpenID Connect) from GitHub Actions or Azure DevOps | No stored service principal secret in the pipeline |
| Secrets management | Azure Key Vault (RBAC authorization, soft delete, purge protection) | Secrets read through managed identity or Key Vault references |
| Encryption at rest | Platform-managed keys by default; customer-managed keys in Key Vault or Managed HSM when required | Key choice recorded against the requirement that asked for it |
| Encryption in transit | Minimum TLS 1.2 on every service, HTTPS only | Policy audits or denies services below the minimum |
| Network isolation | Private endpoints, private DNS zones, public network access disabled | Defender for Cloud and Azure Policy report no public data endpoints |
| Egress control | Azure Firewall or network virtual appliance with user-defined routes | Outbound traffic from workload subnets passes the firewall |
| Web edge protection | Front Door or Application Gateway with Web Application Firewall in prevention mode | WAF policy attached to every public endpoint |

## RBAC Practice

- Prefer built-in roles; write a custom role only when no built-in role fits and record the gap
- Assign to groups, not individuals; assign at resource group scope or narrower for workloads
- Treat Owner, Contributor, and User Access Administrator on a subscription as findings that need a recorded reason
- Use Privileged Identity Management for time-bound elevation of any role that can change access or data
- Use deployment stack deny settings to protect landing zone resources from changes made outside the IaC

## Managed Identity Patterns

- System-assigned identity when one resource needs one identity; user-assigned when several resources share one
- Grant the identity a data-plane role (for example Key Vault Secrets User, Storage Blob Data Reader), not a management-plane role
- Application code uses `DefaultAzureCredential` so the same code runs locally and in Azure
- Pull container images from Azure Container Registry with the AcrPull role on a managed identity, never an admin user

## Network Patterns

- Hub-and-spoke or Virtual WAN with the firewall in the hub; spokes peer to the hub
- Private endpoint per service per spoke, with private DNS zones linked to the hub
- Network security groups on every subnet with an explicit deny-all inbound rule beneath the allow rules
- Service endpoints only where a private endpoint is not offered for the service

## Posture and Detection

- Defender for Cloud: turn on the plans that match the services in the design (for example Servers, Containers, Storage, Key Vault, App Service, databases) and the foundational cloud security posture management
- Azure Policy: deny for rules that must never be broken (public access, missing encryption), audit for the rest, assigned at management group scope through IaC
- Logs: send Microsoft Entra sign-in and audit logs, the activity log, and resource diagnostic logs to a Log Analytics workspace; add Microsoft Sentinel where a team runs a security operations function
- IaC scanning in the pipeline: Bicep linter, PSRule for Azure, and checkov before `what-if` and deployment
