# Google Cloud Evidence and Contractual Coverage

How a compliance claim gets proved on Google Cloud, and how to check that a
service is covered by the contract a requirement names. Use it beside the
Compliance Agent's regulatory-frameworks, which names AWS items throughout.

## AWS Item to Google Cloud Counterpart

| AWS item in the regulatory-frameworks guide | Google Cloud counterpart |
|---------------------------------------------|--------------------------|
| Region choice, Organizations SCP restricting regions | Regions, and the Organization Policy resource locations constraint |
| AWS Config rules and conformance packs | Security Command Center (Security Health Analytics detectors, compliance monitoring), Organization Policy constraints, custom constraints for house rules, Cloud Asset Inventory |
| Security Hub scoring against frameworks | Security Command Center compliance monitoring and its report exports |
| GuardDuty, Inspector | Security Command Center threat detection; Artifact Analysis and VM Manager vulnerability reports |
| cdk-nag rule packs | Checkov policies in CI and `gcloud beta terraform vet` against a policy library (verify its status) |
| CloudTrail in all regions, centralized bucket | Cloud Audit Logs with an organization aggregated sink to a log bucket in a logging project |
| S3 Object Lock | Cloud Storage retention policy with Bucket Lock, or a locked log bucket |
| CloudTrail log file integrity validation | No counterpart is relied on here; integrity rests on locked retention and tight IAM, and a requirement that names a digest check is raised as a gap |
| KMS | Cloud KMS (customer-managed keys), with Cloud HSM or Cloud EKM where named |
| PrivateLink | Private Service Connect |
| IAM Identity Center, Cognito | Cloud Identity with Workforce Identity Federation for staff; Identity Platform for customer sign-in |
| SSM Patch Manager | VM Manager OS patch management |
| DynamoDB TTL, S3 lifecycle | Cloud Storage lifecycle rules and retention policies, BigQuery table and partition expiration, Firestore TTL policies |
| PHI tagging, dedicated accounts or VPCs | Resource Manager tags and labels, BigQuery policy tags for columns, dedicated folders and projects, a VPC Service Controls perimeter |
| DSAR and PII discovery | Sensitive Data Protection discovery and de-identification |
| AWS shared responsibility model | Google Cloud shared responsibility, which Google also frames as shared fate |
| AWS BAA, HIPAA-eligible services page | Google's BAA and its published list of covered products |

## Evidence per Control

| Control | Evidence to keep |
|---------|------------------|
| Residency | The resource locations constraint in Terraform; a Cloud Asset Inventory export listing resource locations |
| Access control | An IAM policy export from Cloud Asset Inventory; IAM Recommender and Policy Analyzer results |
| Encryption | Key inventory with protection level and rotation schedule; the CMEK requirement constraint |
| Audit logging | The audit config and sink in Terraform; bucket retention and lock state |
| Vulnerability management | Artifact Analysis results; Security Command Center vulnerability findings with closure dates |
| Provider access | Access Transparency logs; Access Approval request history |
| Continuous monitoring | Scheduled Security Command Center compliance report exports |
| Google's own controls | The report or certificate from the Compliance Resource Center, with its date and the period or scope it states |

## Retention

- A user-defined log bucket holds logs for 1 to 3650 days; the `_Required` bucket keeps Admin Activity and System Event logs for a fixed 400 days, and the `_Default` bucket keeps 30 days unless changed
- A six-year requirement (2190 days) fits a log bucket; for longer, or for write-once storage, sink to Cloud Storage with a retention policy
- Locking a retention policy or a log bucket is permanent; confirm the period against the requirement and the retention periods in the Compliance Agent's audit trail guidance first
- Log access to the logs: enable Data Access audit logs for Cloud Logging in the logging project

## Shared Responsibility

- Google answers for the physical facilities, the infrastructure, and the managed service's own platform controls; its certifications and audit reports list which products and locations are in scope
- The customer answers for IAM, data classification, location choices, network configuration, key choices, log retention, and application security; for virtual machines it also answers for the operating system and above
- The split changes with the service model: Compute Engine, GKE, Cloud Run, and BigQuery each divide it differently, so read the per-service statement
- Record each control in the matrix as inherited, shared, or customer-owned
- A Google report covers Google's scope for its audit period; it does not make the workload compliant. Check that the report's scope names the services and locations the design uses

## Contractual Coverage (BAA, DPA, and similar)

1. Name the agreement the requirement needs: a BAA for PHI, the Cloud Data Processing Addendum for personal data under GDPR, or the program terms for a regime such as FedRAMP
2. List every Google Cloud service in the design, including the ones that only touch the data (logging, monitoring, keys, build, messaging)
3. Check each against Google's current published covered-services page for that regime, on the day of the decision; record the date and the page in the control matrix
4. A service that is not listed does not hold regulated data. Raise it to the Architect Agent as a design change, or record an accepted risk with the Compliance Agent
5. Confirm with the organization's contract owner that the agreement is in place before regulated data lands
6. Set a review trigger: re-check when a service is added or when Google changes the list

Cardholder data: Google publishes PCI DSS guidance and an attestation of
compliance for covered products (verify the current documents), but the
customer's own cardholder data environment still needs its own assessment. A SOC 2 or ISO 27001 report from
Google covers Google's controls, not the customer's audit scope.
