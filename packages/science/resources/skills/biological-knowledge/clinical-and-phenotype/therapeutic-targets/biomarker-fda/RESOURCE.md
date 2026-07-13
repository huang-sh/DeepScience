---
name: biomarker-fda
description: Access current public openFDA drug event, label, enforcement, and NDC datasets through the documented REST API. Use for regulatory records, labels, recalls, and adverse-event reports.
category: biological-knowledge/clinical-and-phenotype/therapeutic-targets
license: Unknown
metadata:
  access-mode: remote
  database: openFDA
  requires-network: true
  optional-credential-env: OPENFDA_API_KEY
---

# openFDA Remote Resource

Read `references/FDA_ref.md`, select the correct openFDA dataset, then construct a bounded request with an explicit search expression and pagination. An API key is optional. Preserve the response `meta` section; adverse-event reports do not establish causality.
