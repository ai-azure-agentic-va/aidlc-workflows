# Delivery and Rollout on Google Cloud

How the Pipeline & Deploy Agent's deployment design lands on Google Cloud. Use
it beside the core deployment-strategies guide: that guide says which strategy
to pick and what gates to set, this one says how each is done on Google Cloud.

## Strategy to Google Cloud

| Core strategy (AWS implementation) | Google Cloud | Check |
|------------------------------------|--------------|-------|
| Blue/green (CodeDeploy on ECS, Lambda aliases) | Cloud Run: new revision with no traffic and a tag, test the tag URL, then move all traffic; GKE: second Deployment behind the same Service or Gateway | Previous revision stays deployable through the bake time |
| Canary (CodeDeploy canary configurations, API Gateway canary) | Cloud Deploy canary phases; Cloud Run traffic split by percentage between revisions | Percentages and bake time are written in the design |
| Rolling (ECS minimum and maximum percent, Auto Scaling) | GKE `maxSurge` and `maxUnavailable`; managed instance group rolling update | Readiness probe exists before the rolling update is allowed |
| Automatic rollback on a CloudWatch alarm | Cloud Deploy automation with a rollback repair rule, or a pipeline step that watches the alerting policy and shifts traffic back | A named alerting policy is the trigger |
| Feature flags (AppConfig, Evidently) | No direct server-side equivalent assumed; Firebase Remote Config for client apps or an OpenFeature-compatible service; verify before choosing | The design names the flag service and the owner |
| Connection draining | Cloud Run handles the stop signal (SIGTERM) before an instance stops; GKE `terminationGracePeriodSeconds`; load balancer draining timeout | The app finishes in-flight requests on the signal |

## Cloud Run Rollouts

```
gcloud run deploy SERVICE --image LOCATION-docker.pkg.dev/PROJECT/REPO/IMAGE@sha256:DIGEST --no-traffic --tag candidate
gcloud run services update-traffic SERVICE --to-tags candidate=10
gcloud run services update-traffic SERVICE --to-latest
gcloud run services update-traffic SERVICE --to-revisions PREVIOUS_REVISION=100
```

- Revisions are immutable: a change to configuration or secrets is a new revision, so a rollback is a traffic change, not a redeploy
- Once traffic is pinned to named revisions the service stops following the latest revision; `--to-latest` restores that, so state which mode each environment uses
- The tag URL passes through the same authentication as the service: smoke tests need an identity token and `roles/run.invoker`
- Add a startup probe so a revision that cannot start never takes traffic
- Deploy identity: `roles/run.developer` on the service and `roles/iam.serviceAccountUser` on the runtime service account; the runtime account pulls the image with the Artifact Registry reader role
- Binary Authorization on Cloud Run is a service setting; confirm it is set before the first deploy

## GKE Rollouts

- Deployment `RollingUpdate` with readiness probes, `maxSurge`, `maxUnavailable`, and a PodDisruptionBudget; gate on `kubectl rollout status --timeout`, and undo with `kubectl rollout undo`
- Credentials in GitHub Actions: `google-github-actions/get-gke-credentials` after Workload Identity Federation auth; no kubeconfig with a static token
- Private cluster control planes: run the deploy from a Cloud Build private pool or a self-hosted runner inside the network, or use Connect gateway; GitHub-hosted runners have no fixed address to allow
- GitOps alternative: commit the manifest change and let Config Sync apply it; then the pipeline's job ends at the commit, and the rollout check reads cluster state
- Managed instance groups: `gcloud compute instance-groups managed rolling-action start-update` with a new instance template; roll back by starting an update to the previous template

## Cloud Deploy

- Delivery pipeline (`google_clouddeploy_delivery_pipeline`) with ordered targets (`google_clouddeploy_target`) for dev, staging, and production; render and deploy with a `skaffold.yaml`
- Target types are GKE and Cloud Run (plus custom targets); a Compute Engine rollout is a pipeline step outside Cloud Deploy
- CI creates the release with the image digest (`gcloud deploy releases create`); promotion creates a rollout per target
- `require_approval` on the production target; approvers hold `roles/clouddeploy.approver`, and the approval request arrives on a Pub/Sub topic the team routes to chat or a ticket
- Execution service account per target (`execution_configs`), with deploy roles only in that target's project and `roles/clouddeploy.jobRunner`; a private worker pool for private targets
- Strategy: standard, or canary with percentages; a canary on GKE needs a traffic-split mechanism in the runtime config (Gateway API, service mesh, or Service-based), and on Cloud Run Cloud Deploy splits revisions
- Verify: enable the verification step so a smoke test container runs after each rollout and fails it
- Automations: promote after success, advance canary phases, and repair a failed rollout by retry or rollback
- Deploy policies can restrict rollouts to time windows (verify current support), which maps the core freeze-period rule
- Deployment log records release name, rollout names, image digest, and the approver

## Terraform and Other IaC Steps

- Pull request: `terraform fmt -check`, `validate`, tflint, checkov, then `terraform plan -out=tfplan`; post the plan summary on the pull request
- Apply: only from the pipeline, only the saved plan (`terraform apply tfplan`), production behind an approval gate
- Identities: the plan runs as a read-only identity; the apply identity holds write roles for that environment's project only
- State: versioned Cloud Storage bucket with locking, or Infrastructure Manager, whose previews play the role of `plan`
- A plan that destroys or replaces a stateful resource (database, bucket, key) stops the pipeline until a person approves

## Binary Authorization at Deploy Time

- Policy: require attestations from named attestors in production; allow in development if the team says so; the enforcement mode is `ENFORCED_BLOCK_AND_AUDIT_LOG`, and `DRYRUN_AUDIT_LOG_ONLY` comes first, with its audit log read before switching
- Attestor: an Artifact Analysis note plus a Cloud KMS asymmetric key; the pipeline step that signs (`gcloud container binauthz attestations sign-and-create`) runs after tests and the vulnerability gate and uses its own signing identity, never the deploy identity
- Builds in Cloud Build can use the built-in attestor for images built there (verify it is enabled in the project)
- Enforcement points: GKE cluster setting (`binary_authorization` evaluation mode) and the Cloud Run service setting; GKE also offers continuous validation of running pods
- Deploy by digest so the attestation and the running image are the same bytes
- A break-glass override is written to the audit log; treat it as an incident, as the core gate rule does

## Deployment Execution Checks

- Before: project and region match the environment inventory, the deploy identity holds only the roles listed, quotas cover the new revision or nodes, dependencies pass their uptime checks, and the migration job finished
- After: smoke tests pass against the new revision or rollout, the alerting policies named as rollback triggers stayed quiet for the bake time, and the log holds revision, digest, and rollout name
- Hand the revision and rollout names to the GCP Operations Agent so dashboards and alert thresholds can mark the release
