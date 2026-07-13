---
name: biomarker-drugbank
description: Access licensed DrugBank v1 drug records through its documented API. Use when current DrugBank-specific annotations are required and an authorized API key is available.
category: biological-knowledge/clinical-and-phenotype/therapeutic-targets
license: Unknown
metadata:
  access-mode: remote
  database: DrugBank
  requires-network: true
  credential-env: DRUGBANK_API_KEY
---

# DrugBank Remote Resource

Read `references/DrugBank_ref.md`, verify `DRUGBANK_API_KEY` exists without printing it, then construct a bounded authenticated request to the documented DrugBank API. If credentials or licensing are unavailable, report that limitation rather than substituting another database.
