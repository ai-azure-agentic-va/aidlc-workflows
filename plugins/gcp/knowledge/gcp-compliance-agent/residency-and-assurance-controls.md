# Google Cloud Residency and Assurance Controls

How a compliance requirement lands on Google Cloud. Use it beside the Compliance
Agent's regulatory-frameworks: that guide says what the regulation requires,
this one says which Google Cloud mechanism meets it and where its limits are.

## Requirement to Control

| Requirement | Google Cloud mechanism | Check |
|-------------|------------------------|-------|
| Data stays in one country or region | Regional resources in the approved region; resource locations constraint at folder or organization scope | Constraint in the Terraform; Cloud Asset Inventory shows every data-bearing resource in an approved location |
| Data stays in a geography (for example the EU) | A multi-region or a set of regions inside the geography | The design names the exact locations the offering covers, taken from its location documentation |
| A named compliance regime with a control package | Assured Workloads folder | Projects exist only inside the folder; Assured Workloads shows no open violations |
| Google personnel access to content is visible | Access Transparency | Access Transparency logs reach the audit log sink |
| Google personnel access to content needs approval | Access Approval, which needs Access Transparency | Approvers and notification channels are named; a person owns the response process |
| Keys held outside Google, or every use justified | Cloud EKM with Key Access Justifications | Key manager policy decides by justification; availability risk recorded |
| Customer controls the keys | Cloud KMS customer-managed keys (software or Cloud HSM) | Organization Policy requires CMEK for the services in scope |
| Regulated data in a dedicated boundary | Dedicated folder and projects, a VPC Service Controls perimeter, labels or tags marking the data | Perimeter enforced, not dry-run; resources carry the marking |
| Audit trail retained for a period | Cloud Audit Logs in a log bucket with retention set to the period | Bucket retention is at least the requirement; locked where immutability is required |
| Continuous control monitoring | Security Command Center compliance monitoring, Organization Policy, Cloud Asset Inventory | Mapped findings reviewed on a schedule with an owner |

## Region and Location Choice

- Pick a single region for the strictest residency requirement; a dual-region or multi-region spreads data across more than one place, so read which locations it covers before using it for a country-level rule
- Location is fixed at creation for many resources (Cloud Storage buckets, BigQuery datasets, Cloud SQL instances); moving one is a copy and a migration, so decide before the first data lands
- Every copy of the data has a location: read replicas, backups, disaster recovery targets, exports, and BigQuery dataset copies
- Pub/Sub has a message storage policy that restricts where messages persist; Secret Manager has user-managed replication that names the locations; Artifact Registry repositories and Cloud Logging log buckets take a location too
- A customer-managed key generally has to sit in the same location as the data it protects; confirm per service
- The default log buckets in a new project use the global location unless a default storage location is set for the organization or folder; verify this in the Cloud Logging documentation when logs fall under the requirement
- Some services run control planes, metadata, or processing (analytics and AI features in particular) outside the storage location; confirm per service whether that falls under the requirement

## Resource Locations Constraint

- `constraints/gcp.resourceLocations` lists the allowed locations as regions, multi-regions, or value groups (for example `in:eu-locations`; confirm the group name in the current documentation)
- It applies when a resource is created in a service that supports it; resources that already exist outside the list stay where they are and need migration
- A service that does not support it ignores it, so check the supported-services list for every service in the design
- Roll it out in dry-run mode first and read the would-be violations
- It is a creation control, not a processing control: do not cite it as evidence that data is never processed elsewhere

## Assured Workloads

- It creates a folder that applies a chosen control package: location limits, a list of services allowed, encryption settings, and for some packages controls on Google support personnel
- Choose the package from the current Assured Workloads documentation (for example FedRAMP, CJIS, ITAR, DoD impact levels, or an EU or regional data boundary package; the list changes) and record the prerequisites it names, such as support level, region availability, and key requirements
- Create the folder with `google_assured_workloads_workload` in Terraform and create projects only inside it
- Only services the package allows can be used; check the design's services against the package before Infrastructure Design is approved
- Review its violation monitoring on a schedule and treat an open violation as a compliance finding

## Access Transparency and Access Approval

- Access Transparency writes a log entry (the `access_transparency` audit log in Cloud Logging) when Google personnel access customer content, with a stated reason; availability depends on the organization's support package, so verify it
- Access Approval sits on top: Google asks a named approver before access, and an unanswered request expires
- Neither covers every kind of Google access (access required by law is one example); read the current exclusions and list them as residual risk
- The operating cost is real: someone must watch the approval queue, and support cases wait on it

## Cloud EKM and Key Access Justifications

- Cloud EKM keeps key material in an external key manager that the organization or a partner runs; Cloud KMS holds a reference, and supported services call out to it
- Key Access Justifications adds a reason code to each request to the external key manager, which can allow or deny by reason
- Only some services support EKM keys; check the design's services against the current list
- If the external key manager is unreachable, data under that key cannot be read; record this against the availability NFR
- Choose EKM only when a requirement names external custody or per-use justification; customer-managed keys in Cloud KMS or Cloud HSM meet "customer controls the keys" without it

## Questions to Settle in Feasibility and NFR Requirements

- Which regulations and data classes drive location, and may data be processed outside the country that stores it
- Does the requirement name a compliance regime, provider-access control, or key custody, or does it only name a region
- Which Google Cloud organization, folders, and support package will the work use, and do existing organization policies already limit locations
- Which services does the design need, and does the regime's covered-services list include each of them
