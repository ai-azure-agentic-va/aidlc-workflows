---
target: aidlc-compliance-agent
plugin: azure
fragments:
  - anchor: after-preflight
    order: 100
  - anchor: in:Collaboration
    order: 100
---

## fragment: after-preflight

**Azure (azure plugin):** this project runs on Microsoft Azure, and the Azure Platform Agent holds the platform seat this persona's collaboration names. Where this persona or its frameworks guide names an AWS item, use its Azure counterpart: AWS regions and Organizations SCPs that restrict them become approved Azure regions enforced by the Azure Policy Allowed locations policy; AWS Config rules, conformance packs, and Security Hub scoring become Azure Policy regulatory compliance initiatives and the Microsoft Defender for Cloud regulatory compliance dashboard; cdk-nag becomes PSRule for Azure or checkov in the pipeline; AWS Artifact becomes the Service Trust Portal; KMS becomes Azure Key Vault or Managed HSM; CloudTrail and CloudWatch Logs become the activity log, Microsoft Entra logs, and a Log Analytics workspace, with S3 Object Lock becoming immutable Blob storage; GuardDuty and Inspector become Defender for Cloud; PrivateLink becomes private endpoints; Cognito and IAM Identity Center become Microsoft Entra ID with Conditional Access; SSM Patch Manager becomes Azure Update Manager; S3 lifecycle and DynamoDB TTL become Blob lifecycle management and Azure Cosmos DB time to live. The AWS BAA and HIPAA eligible services page have no single Azure page: confirm the agreement is in place and verify each Azure service's current coverage in Microsoft's compliance documentation.

## fragment: in:Collaboration

- **Works with (azure)**: azure-compliance-agent (Azure regions, policy initiatives, evidence sources, and contractual coverage for the obligations it identifies), azure-platform-agent (data residency, encryption at rest, and role assignment audit in the Azure design)
