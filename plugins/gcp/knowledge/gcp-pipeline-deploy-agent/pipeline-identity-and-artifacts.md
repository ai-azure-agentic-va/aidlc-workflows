# Pipeline Identity and Artifacts on Google Cloud

How the Pipeline & Deploy Agent's CI design lands on Google Cloud. Use it
beside the core cicd-patterns guide: that guide says what the pipeline must do,
this one says which Google Cloud service does it and what to check.

## Pattern to Service

| Core pattern (AWS name) | Google Cloud | Check |
|-------------------------|--------------|-------|
| GitHub Actions, CodePipeline, CodeBuild | GitHub Actions for GitHub repositories, or Cloud Build with triggers | One CI tool per repository; the pipeline is defined in repository files |
| `buildspec.yml` | Cloud Build `cloudbuild.yaml` (`steps`, `images`, `artifacts`, `options`) | Config is in the repository, not edited in the console |
| IAM role assumed through OIDC | Workload Identity Federation (pool and OIDC provider) | No service account key file in the repository or in CI secrets |
| CodeBuild service role | Cloud Build user-specified service account | One account per pipeline, roles listed in the IaC |
| CodeBuild in a VPC | Cloud Build private pool (`google_cloudbuild_worker_pool`) | Builds that need private resources run in the pool |
| ECR | Artifact Registry Docker repository | Immutable tags, cleanup policy, reference by digest |
| CodeArtifact | Artifact Registry npm, Python, Maven, Go, or generic repositories; remote repositories proxy upstream, virtual repositories combine them | Clients point at the virtual repository |
| S3 for build outputs and templates | Cloud Storage bucket with object versioning | Bucket has lifecycle rules and uniform bucket-level access |
| ECR image scanning | Artifact Analysis vulnerability scanning | Gate reads the result for the pushed digest |
| Secrets in builds | Secret Manager through Cloud Build `availableSecrets` or the `get-secretmanager-secrets` action | No secret in substitutions or logs |
| CodePipeline manual approval | Cloud Deploy target approval, or a GitHub environment with required reviewers | One approval point, recorded in the pipeline design |

## Workload Identity Federation from GitHub Actions

- Create a workload identity pool and an OIDC provider with issuer `https://token.actions.githubusercontent.com`
- Map `google.subject=assertion.sub` and `attribute.repository=assertion.repository`; add `attribute.environment` or the ref when a deploy identity is per environment
- Set an attribute condition, for example `assertion.repository == 'ORG/REPO'`; without one the provider trusts tokens from any repository
- Grant access to `principalSet://iam.googleapis.com/projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/POOL/attribute.repository/ORG/REPO`: roles directly on the resources where the service accepts federated principals, otherwise `roles/iam.workloadIdentityUser` on a deployer service account
- Workflow: `permissions: id-token: write` and `contents: read`, then `google-github-actions/auth` with `workload_identity_provider` and, when impersonating, `service_account`
- Production: trust only the production environment claim or a protected branch or tag, and use a different deployer identity from development
- Pull requests from forks never receive cloud credentials
- Check: no user-managed keys exist on pipeline service accounts, and the organization policy `iam.disableServiceAccountKeyCreation` is enforced

```
permissions:
  id-token: write
  contents: read
steps:
  - uses: google-github-actions/auth@<commit-sha>
    with:
      workload_identity_provider: projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/POOL/providers/PROVIDER
      service_account: deployer@PROJECT_ID.iam.gserviceaccount.com
```

- Pin third-party actions by commit SHA; the deploy identity is only as safe as the code that runs with it
- Leave out `service_account` when roles are granted directly to the federated principal

## Cloud Build

- Set `serviceAccount` in the build config or trigger; with a user-specified service account also set the logging option (`options.logging`, for example `CLOUD_LOGGING_ONLY`) or the build is rejected
- Build identity roles: `roles/artifactregistry.writer` on the target repository and `roles/logging.logWriter`; a deploy identity additionally gets `roles/clouddeploy.releaser` or `roles/run.developer`, kept on a separate account
- Triggers (`google_cloudbuild_trigger`): pull request triggers use comment control so untrusted contributors do not start builds; production triggers use `approval_config`
- Private pools: choose no public egress when the builds need none, and make sure the pool can reach Google APIs (Private Google Access or Cloud NAT)
- Provenance: set `options.requestedVerifyOption: VERIFIED` so Cloud Build generates verified provenance for the images it builds
- Speed: reuse layers with BuildKit cache or `--cache-from` the previous image, choose `options.machineType` for the heavy steps, and run independent steps in parallel with `waitFor`

## Artifact Registry

- Create repositories in the runtime's region (or a multi-region that contains it) so pulls stay local; one repository per application or team
- IAM on the repository: `roles/artifactregistry.writer` for the pipeline, `roles/artifactregistry.reader` for the runtime service identity and service agents that pull
- Docker repositories: enable immutable tags; image path is `LOCATION-docker.pkg.dev/PROJECT/REPOSITORY/IMAGE`; tag with the commit SHA and reference `@sha256:` digests after the build
- Cleanup policies replace ECR lifecycle rules: keep the most recent 30 tagged versions, delete untagged versions older than 7 days, and run the policy in dry-run first (a keep rule wins over a delete rule)
- Remote repositories proxy upstream registries and virtual repositories put several repositories behind one endpoint, with priority order deciding which source wins
- Container Registry (`gcr.io`) is replaced by Artifact Registry: do not start new work on it
- Promotion between environments moves the same digest; when production has its own repository, copy by digest and compare the digest before and after

## Supply Chain Gates

- Vulnerability scanning: enable the Container Scanning API so Artifact Analysis scans pushed images; the gate fails the pipeline on the severity the quality gate sets (core default: no Critical or High)
- Provenance and attestations: Cloud Build provenance proves where an image was built; a signing step after tests and the scan adds a Binary Authorization attestation (see delivery-and-rollout)
- Dependency inputs: route package installs through the virtual repository so a build never pulls straight from a public registry
- Policy ownership: the GCP Security Agent decides which attestations production requires; this agent implements the steps that create them
