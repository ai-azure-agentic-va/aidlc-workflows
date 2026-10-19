# Google Cloud Guardrails and Detection

How the controls are enforced and watched on Google Cloud. Use it beside the
DevSecOps Agent's devsecops-pipeline-patterns: that guide names the gates, this
one names the Google Cloud mechanism behind each.

## Organization Policy Constraints

Constraint names move as managed constraints replace older ones; confirm the
current name in the Organization Policy documentation before writing Terraform.

| Constraint | What it does | When to enforce |
|------------|--------------|-----------------|
| `iam.disableServiceAccountKeyCreation` | Blocks new service account keys | Organization-wide, with recorded exceptions at project scope |
| `iam.disableServiceAccountKeyUpload` | Blocks uploading external keys to a service account | Organization-wide |
| `iam.automaticIamGrantsForDefaultServiceAccounts` | Stops default service accounts receiving broad roles automatically | Organization-wide |
| `iam.allowedPolicyMemberDomains` | Limits role grants to identities from named domains; blocks `allUsers` | Organization-wide for private workloads |
| `compute.vmExternalIpAccess` | Lists the VMs allowed an external IP | Deny all by default |
| `compute.requireOsLogin` | Requires OS Login on VMs | Organization-wide |
| `compute.skipDefaultNetworkCreation` | No default network in new projects | Organization-wide |
| `storage.publicAccessPrevention` | Blocks public buckets | Organization-wide; a public site bucket is a recorded exception |
| `storage.uniformBucketLevelAccess` | IAM only on buckets, no object ACLs | Organization-wide |
| `sql.restrictPublicIp` | No public IP on Cloud SQL | Organization-wide |
| `gcp.restrictNonCmekServices` and `gcp.restrictCmekCryptoKeyProjects` | Require CMEK for named services and limit which projects supply keys | Where a requirement makes CMEK mandatory |
| `gcp.resourceLocations` | Limits where new resources can be created | Where residency is a requirement (see the GCP Compliance Agent) |

- Manage them with `google_org_policy_policy` in Terraform at organization or folder scope; grant an exception at a narrower scope with a recorded reason
- Create a new constraint in dry-run mode first, read the would-be violations in the audit logs, then enforce
- Write a custom constraint for a house rule no predefined constraint covers
- Organization Policy limits what configuration is allowed; IAM limits who can act. Use both

## VPC Service Controls

- Define a perimeter around the projects that hold sensitive data, with the list of services it restricts and Access Context Manager access levels for trusted networks and identities
- Add ingress and egress rules for each flow that must cross the boundary, naming the identity, the service, and the resource; start the perimeter in dry-run mode
- Confirm each service in the design is supported by VPC Service Controls before relying on it
- Pipelines and Terraform runners that deploy into a perimeter need an ingress rule or must run inside it
- A perimeter limits API calls to Google-managed services; it does not filter VM-to-VM traffic and does not replace IAM
- Terraform: `google_access_context_manager_service_perimeter`

## Logging and Audit

- Admin Activity and System Event audit logs are always on; Policy Denied audit logs are on by default
- Data Access audit logs are off by default for most services; enable them for services that hold sensitive data with `google_project_iam_audit_config` (or the folder or organization form), choosing DATA_READ, DATA_WRITE, and ADMIN_READ per service because volume and cost follow the choice
- Route logs with an aggregated sink at organization scope into a log bucket in a dedicated logging project; set retention to the requirement and lock the bucket where immutability is required
- Enable VPC Flow Logs on sensitive subnets, firewall rule logging on deny rules, and Cloud NAT logging
- Alert on the changes that weaken a control: IAM policy changes, Organization Policy changes, service account key creation, and VPC Service Controls violations

## Security Command Center

- Activate at organization scope so findings cover every project; Standard, Premium, and Enterprise carry different detectors, so check the tier before listing a detector as a control
- Detectors to map to design risks: Security Health Analytics (misconfiguration), Event Threat Detection (log-based threats), Container Threat Detection, VM Threat Detection, and Web Security Scanner for supported web apps
- Export findings continuously to Pub/Sub or BigQuery; connect Google Security Operations when the team runs a security operations function
- Use mute rules only with a recorded reason and an expiry; give every High finding an owner and a ticket

## Supply Chain

- Images come from Artifact Registry only; Artifact Analysis scans on push, and the pipeline runs an on-demand scan before promotion
- Binary Authorization on GKE and Cloud Run requires an attestation from the pipeline's signer (a Cloud KMS asymmetric key, or Cloud Build provenance); begin with the audit-log-only dry-run mode, then enforce, and use continuous validation on GKE for running pods
- Give the Artifact Registry Writer role only to the pipeline's service account; runtime service accounts get Reader

## Pipeline Gates on Google Cloud

| Gate | Google Cloud step |
|------|-------------------|
| IaC scan | `terraform validate`, tflint with the Google ruleset, and Checkov on the plan or directory; fail on High |
| Plan policy check | `gcloud beta terraform vet` against a policy library (verify its current status before adopting) |
| Dependency and image scan | Artifact Analysis on push and on-demand scanning in the build |
| Secret detection | Gitleaks or truffleHog in a pre-commit hook and in CI |
| DAST | Web Security Scanner where it supports the target, otherwise OWASP ZAP against staging |
| Deploy gate | Binary Authorization attestation check |
| Post-deploy | Security Command Center findings reviewed; ticket on High |
