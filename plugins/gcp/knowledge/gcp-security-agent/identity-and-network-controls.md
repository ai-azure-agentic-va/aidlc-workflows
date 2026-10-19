# Google Cloud Identity and Network Controls

How a security requirement lands on Google Cloud. Use it beside the DevSecOps
Agent's security-guide: that guide says what to require, this one says which
Google Cloud control meets it.

## Requirement to Control

| Requirement | Google Cloud control | Check |
|-------------|----------------------|-------|
| Least-privilege access for people | Cloud Identity or Google Workspace groups (or Workforce Identity Federation), predefined roles at the narrowest resource scope, time-bound elevation for roles that change access | No person holds standing Owner, Editor, or an IAM-admin role on a project, folder, or organization |
| Least-privilege access for workloads | One attached service account per workload with scoped role bindings | No service account key, no default Compute Engine service account, no basic role on a workload account |
| Pipeline access to Google Cloud | Workload Identity Federation from GitHub Actions, GitLab, or another OIDC provider; or Cloud Build running as a dedicated service account | No service account key stored as a pipeline secret; the provider carries an attribute condition |
| Access from workloads outside Google Cloud | Workload Identity Federation (AWS, Azure, OIDC, or SAML identity providers) | No exported key; the pool trusts only the expected external identities |
| Secrets management | Secret Manager with IAM on each secret and a rotation schedule | Secrets read through service account identity; none in Terraform outputs or environment files |
| Encryption at rest | Google-managed encryption by default; Cloud KMS customer-managed keys when required; Cloud HSM or Cloud EKM when a requirement names them | Key choice recorded against the requirement that asked for it |
| Encryption in transit | Load balancers with an SSL policy at TLS 1.2 minimum; private paths to Google APIs | Every load balancer carries an SSL policy |
| Network isolation | Private Google Access, Private Service Connect, private IP on databases, no external IPs | Organization Policy and Security Command Center report no public data endpoints |
| Data exfiltration limits | VPC Service Controls perimeter around the projects holding sensitive data | Dry-run violations reviewed before the perimeter is enforced |
| Egress control | Firewall policy egress rules or Secure Web Proxy; Cloud NAT only translates addresses | Workload subnets reach the internet only through the controlled path |
| Web edge protection | Global external Application Load Balancer with a Cloud Armor security policy (preconfigured WAF rules, rate limiting) | Policy attached to every public backend service |
| Administrator access | Identity-Aware Proxy TCP forwarding for SSH and RDP, OS Login | No firewall rule opens SSH or RDP to the internet |

## IAM Practice

- Prefer predefined roles; write a custom role only when no predefined role fits and record the gap
- Assign to groups, not individuals, and bind on the resource itself (a bucket, a secret, a topic) before the project
- Treat Owner, Editor, and roles that can change IAM policy (Security Admin, Project IAM Admin, Organization Administrator) as findings that need a recorded reason
- Grant Service Account User and Service Account Token Creator on the specific service account, not on the project: a project-level grant covers every service account in it
- Use IAM Conditions for grants that expire or apply only to named resources, and Privileged Access Manager where the team wants approval-based elevation (verify it is available to the organization)
- Run IAM Recommender on a schedule to remove unused permissions; use Policy Simulator before a change and Policy Troubleshooter when access fails
- Use IAM deny policies at organization or folder scope for permissions nobody should hold there; a deny overrides any allow
- Keep key administration (Cloud KMS Admin) apart from key use (Encrypter/Decrypter) so no one principal holds both

## Service Account Patterns

- One service account per workload and environment, named for the workload; never reuse the default Compute Engine or App Engine service account
- Attach it to the resource: Cloud Run service identity, Compute Engine, Cloud Run functions, or the user-specified service account in Cloud Build
- On GKE use Workload Identity Federation for GKE so pods act as their Kubernetes service account principal, and give node pools a minimal dedicated service account
- Application code uses Application Default Credentials, so the same code runs on Google Cloud and locally with `gcloud auth application-default login`
- Pipelines: restrict the pool provider with an attribute condition on the repository (and branch or environment where it matters); grant roles to the federated principal directly where the service supports it, otherwise let it impersonate a deployment service account
- Pull images from Artifact Registry with the Artifact Registry Reader role on the runtime service account, never a static credential
- If a key is unavoidable (a tool that cannot federate), record the exception with an owner and an expiry, and let the key-creation constraint stay enforced everywhere else

## Network Patterns

- Shared VPC: the host project owns the network, workload projects attach as service projects, and firewall policies sit at organization or folder scope with deny as the base
- Enable Private Google Access on subnets whose workloads have no external IP; use a Private Service Connect endpoint for Google APIs and pick the `vpc-sc` bundle (or `restricted.googleapis.com`) when a perimeter is in use
- Databases and caches take private IP through private services access or Private Service Connect; turn public IP off
- Cloud Run: set ingress to internal or internal and Cloud Load Balancing; reach private resources through Direct VPC egress or a Serverless VPC Access connector; no `allUsers` invoker binding on a private service
- Give each firewall deny rule logging, enable VPC Flow Logs on subnets that carry sensitive traffic, and avoid the default network
- Reach VMs without public addresses through Identity-Aware Proxy TCP forwarding rather than a bastion with an external IP

## Checks to Run on a Design or an Environment

- Any user-managed service account key: list keys per service account with `gcloud iam service-accounts keys list --managed-by=user`
- Any `roles/owner` or `roles/editor` binding, and any role binding to `allUsers` or `allAuthenticatedUsers`: search the IAM policies in Cloud Asset Inventory
- Any workload running as the default Compute Engine or App Engine service account
- Any firewall rule that opens SSH (22) or RDP (3389) to `0.0.0.0/0`
- Any VM or Cloud SQL instance with a public IP, and any bucket without public access prevention
- Any workload identity pool provider with no attribute condition
- Any load balancer without an SSL policy, and any public backend service without a Cloud Armor policy
