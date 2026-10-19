# Azure Regulatory Evidence and Coverage

How a compliance obligation is evidenced and contractually covered on Azure. Use
it beside the Compliance Agent's regulatory-frameworks guide, which names AWS
tools for the same jobs. Standards, built-in initiatives, and service coverage
change; read the current Microsoft documentation before the control matrix
records a claim.

## AWS to Azure

| Core guide names | Azure counterpart |
|------------------|-------------------|
| AWS Config rules and conformance packs | Azure Policy regulatory compliance built-in initiatives, assigned through IaC at management group scope |
| Custom Config rules (Lambda-backed) | Custom Azure Policy definitions and initiatives, kept in the IaC repository |
| Security Hub compliance scoring | Microsoft Defender for Cloud regulatory compliance dashboard |
| cdk-nag rule packs | Bicep linter, PSRule for Azure, or checkov in the pipeline; Azure Policy checks the deployed result |
| AWS Artifact (audit reports) | Service Trust Portal |
| KMS | Azure Key Vault or Managed HSM |
| CloudTrail in all regions to an immutable bucket | Activity log and Microsoft Entra logs through diagnostic settings to Log Analytics, and to a storage account with immutable (WORM) storage |
| CloudTrail log file integrity validation | No single counterpart; use immutable storage, restricted write access, and logged access to the logs |
| S3 Object Lock | Immutable storage for Blob Storage (time-based retention, legal hold) |
| Organizations SCPs that restrict regions | Azure Policy Allowed locations with a deny effect |
| PrivateLink | Private endpoints (Azure Private Link) |
| Isolated accounts or VPCs for regulated data | Dedicated subscriptions or resource groups and virtual networks under a management group, tagged for the data class |
| Cognito or IAM Identity Center with MFA | Microsoft Entra ID with Conditional Access requiring MFA |
| GuardDuty and Inspector | Microsoft Defender for Cloud plans |
| SSM Patch Manager | Azure Update Manager |
| S3 lifecycle and DynamoDB TTL for expiry | Blob Storage lifecycle management and Azure Cosmos DB time to live |
| AWS BAA and the HIPAA eligible services page | Microsoft's contractual terms and its current compliance documentation; no one-to-one page, so verify per service |

## Standards on Azure

- **Azure Policy initiatives**: Azure publishes built-in regulatory compliance initiatives for many standards (for example ISO 27001, NIST SP 800-53, PCI DSS, SOC 2, FedRAMP, and the CIS Azure benchmark); list the current set and assign the one the requirement cites
- **Microsoft cloud security benchmark**: the baseline Defender for Cloud assesses by default; it is a security baseline, not a regulatory standard
- **Added standards**: add a standard to the Defender for Cloud regulatory compliance dashboard per subscription or management group, after checking which Defender plan the standard needs
- **Manual controls**: a standard includes controls no automated assessment can test; record each as manual with an owner and an attestation, never as passing
- **No initiative**: where no built-in initiative exists for the standard, map its controls to the closest built-in policies and write custom ones for the gaps

## Evidence Sources

| Evidence | Azure source |
|----------|--------------|
| Microsoft's certifications, audit reports, and attestations | Service Trust Portal |
| Customer-side control assessments and improvement actions | Microsoft Purview Compliance Manager (check the template covers the Azure services in scope) |
| Standard-level posture over time | Defender for Cloud regulatory compliance dashboard, with its exportable report |
| Resource-level compliance state | Azure Policy compliance state, queried with Azure Resource Graph or exported to Log Analytics or storage |
| Who changed what | Activity log and Microsoft Entra audit logs |
| Who signed in and from where | Microsoft Entra sign-in logs |
| Data access | Resource diagnostic logs (for example Key Vault and Storage logs) sent to Log Analytics |
| Where regulated data sits | Microsoft Purview Data Map scans, sensitivity labels, and Azure SQL data discovery and classification |
| Deployed configuration matches the template | `what-if` output and deployment stack state kept with the release record |

## Shared Responsibility

- Microsoft operates the physical datacentres, the host, and the platform layers each service type includes; the split moves toward the customer from SaaS to PaaS to IaaS
- The team always owns its data, its identities, its access configuration, and the configuration of every service it deploys
- A Microsoft audit report evidences Microsoft's controls only; a customer SOC 2 or PCI DSS assessment still needs the team's own controls evidenced
- Record the split per service in the control matrix, with the customer-side action and its owner

## Contractual Coverage

- Confirm the data protection terms and, for health data, the BAA are in place for the tenant before regulated data is stored
- Verify each service in the design against Microsoft's current list of services covered for the standard or agreement; record the page and date
- Treat preview features and newly released services as uncovered until the documentation says otherwise
- A service that cannot be confirmed goes on the RAID log with an alternative design

## Keys and Confidential Computing

| Requirement | Azure option | Check |
|-------------|--------------|-------|
| Customer-managed keys | Key Vault (or Managed HSM) key referenced by the service | The service supports customer-managed keys; rotation policy set; access by managed identity |
| Single-tenant HSM or a named FIPS level | Managed HSM | Validation level checked against the requirement's wording |
| Control over Microsoft support access | Customer Lockbox | Service and support plan eligible; approvers named |
| Data protected while in use | Confidential virtual machines or confidential containers, with Azure Attestation | Region and SKU available; attestation verified by the workload |
