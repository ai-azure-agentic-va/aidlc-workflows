# Azure Data Residency and Region Choice

How a residency or sovereignty requirement lands on Azure. Use it beside the
Compliance Agent's regulatory-frameworks guide: that guide says what the
obligation is, this one says which Azure choice meets it. Region lists, pairs,
and service availability change; confirm each against Microsoft's current
documentation before the design records it.

## Requirement to Control

| Requirement | Azure control | Check |
|-------------|---------------|-------|
| Data stays in a country or region | Deploy only to approved regions; Azure Policy Allowed locations and Allowed locations for resource groups with a deny effect at management group scope | Policy compliance shows no resource outside the approved list |
| Data stays in a jurisdiction such as the EU | Regions inside the matching geography; Microsoft EU Data Boundary for the services it covers | Each service's data location recorded; boundary scope verified for the services in the design |
| Backups and replicas stay in region | Zone-redundant or locally redundant options instead of geo-redundant ones; backup storage redundancy set explicitly per service | No geo-redundant setting on a store whose data may not leave the region |
| Disaster recovery stays inside the boundary | Recovery region chosen from the same geography | Region pair or chosen recovery region checked against the requirement |
| Support staff access to data is controlled | Customer Lockbox, where the service and support plan allow it | Lockbox enabled and its approvers named |
| National sovereignty controls | Azure Government, Azure operated by 21Vianet, or Microsoft Cloud for Sovereignty | Cloud chosen in Feasibility, with service availability confirmed |

## Region Selection Checks

Run these in Feasibility and again in Infrastructure Design:

- Every service in the design appears for the region in Microsoft's products-available-by-region list
- Availability zones are offered in the region, if the availability NFR needs them
- The services are in the audit scope for the standard the requirement cites (the Azure compliance documentation lists services by audit scope)
- Quota and capacity for the chosen SKUs are available in the region (hand the numbers to the Azure Platform Agent)
- The region is allowed by the team's `## Mandated` and `## Forbidden` memory entries

## Where Data Lands Outside the Chosen Region

- **Geo-redundant storage and backups**: geo-redundant Storage, database backups, and Recovery Services vaults can replicate to the paired region; choose the redundancy level explicitly
- **Region pairs**: pairs usually sit in one geography, a few cross it, and newer regions may have no pair; verify the pair before relying on it
- **Global services**: Azure Front Door, Traffic Manager, Azure DNS, and Microsoft Entra ID have their own data-location rules; the Allowed locations policy does not evaluate resources whose location is global, so list them in the design and justify each
- **Telemetry**: a Log Analytics workspace stores data in its own region; place workspaces and workspace-based Application Insights resources in an approved region
- **Support and diagnostics**: data shared in a support case follows the support terms, not the resource region; Customer Lockbox governs Microsoft engineer access
- **Copies made by people and pipelines**: exports, test data, and build artifacts in another region or subscription break residency as surely as a replica does

## Sovereign and Specialised Clouds

| Need | Option | Note |
|------|--------|------|
| US government workloads | Azure Government | Separate cloud with its own endpoints and onboarding; its service set differs from public Azure |
| Data in China under local operation | Microsoft Azure operated by 21Vianet | Operated by a local partner; separate accounts and endpoints |
| Sovereignty controls on the public cloud | Microsoft Cloud for Sovereignty (sovereign landing zone and policy baselines) | Verify availability and scope for the target region |

Pipelines, the Azure CLI, and IaC providers must target the chosen cloud
explicitly; a template that works in public Azure can name a service or SKU the
sovereign cloud does not offer yet.

## Evidence for a Residency Claim

- The Policy assignment of Allowed locations, with its compliance state exported on a schedule
- A resource inventory by location from Azure Resource Graph, attached to the control matrix
- The recorded redundancy setting of each data store, and the reason for any geo-redundant choice
- The list of global services in the design, with each one's documented data location
- The Microsoft documentation page and its retrieval date for every region or coverage statement the design relies on

## Common Gaps

- A policy that allows the right regions for resources but not for resource groups
- A geo-redundant default left in place on a database or storage account that holds regulated data
- A workspace or Application Insights resource created in a default region outside the approved list
- A recovery region chosen for latency without checking it against the residency requirement
